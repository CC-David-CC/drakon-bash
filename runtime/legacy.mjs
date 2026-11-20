import { DiagramError, validateGraph } from './model.mjs';
let sqlite;
const legacyType = {
  action: 'action',
  if: 'question',
  select: 'select',
  case: 'case',
  loopstart: 'loopbegin',
  loopend: 'loopend',
  commentin: 'comment',
  insertion: 'insertion',
  shelf: 'shelf',
};

export async function openLegacy(bytes, language) {
  if (
    bytes.byteLength > 32 * 1024 * 1024 ||
    new TextDecoder().decode(bytes.subarray(0, 16)) !== 'SQLite format 3\u0000'
  )
    throw Error('Choose an SQLite DRAKON .drn file (up to 32 MiB).');
  sqlite ??= import('./vendor/sqlite.mjs')
    .then((m) => m.default())
    .catch((e) => {
      sqlite = undefined;
      throw e;
    });
  const SQL = await sqlite,
    db = new SQL.Database(bytes);
  const query = (sql, params = []) => {
    const s = db.prepare(sql);
    try {
      s.bind(params);
      const rows = [];
      while (s.step()) rows.push(s.getAsObject());
      return rows;
    } finally {
      s.free();
    }
  };
  try {
    const info = Object.fromEntries(query('SELECT key,value FROM info').map((r) => [r.key, r.value]));
    if (info.type !== 'drakon' || String(info.start_version) !== '1')
      throw Error('Expected a DRAKON Editor 1.x project.');
    if (info.language) {
      const target = /python/i.test(info.language)
        ? 'python'
        : /^(javascript|drakonjs)$/i.test(info.language)
          ? 'javascript'
          : /^bash$/i.test(info.language)
            ? 'bash'
            : null;
      if (target !== language.id)
        throw Error('This file declares ' + info.language + '. Open it in the matching generator.');
    }
    const cols = query('PRAGMA table_info(items)').map((r) => r.name);
    const diagrams = query('SELECT diagram_id AS id,name FROM diagrams ORDER BY name LIMIT 5001');
    if (!diagrams.length || diagrams.length > 5000)
      throw Error('Expected between 1 and 5,000 diagrams.');
    return {
      diagrams,
      sourceLanguage: info.language || 'unspecified',
      close: () => db.close(),
      convert(id) {
        const entry = diagrams.find((d) => d.id === id);
        if (!entry) throw Error('Unknown diagram.');
        const rows = query(
          'SELECT item_id AS id,type,text,x,y,w,h,a,b,' +
            (cols.includes('text2') ? 'text2' : 'NULL AS text2') +
            ' FROM items WHERE diagram_id=? ORDER BY item_id LIMIT 2001',
          [id],
        );
        try {
          return fromGeometry(entry, rows, language);
        } catch (e) {
          throw new DiagramError(
            entry.name + (e.nodeId ? ' · item ' + e.nodeId : '') + ' — ' + e.message,
            e.nodeId,
            String(id),
          );
        }
      },
    };
  } catch (e) {
    db.close();
    throw e;
  }
}

function fromGeometry(entry, rows, language) {
  const fail = (message, id) => {
    throw new DiagramError(message, id == null ? null : String(id));
  };
  if (!rows.length || rows.length > 2000) fail('Expected 1–2,000 diagram items.');
  const caps = rows.filter((r) => r.type === 'beginend').sort((a, b) => a.y - b.y);
  if (caps.length !== 2 || caps[0].y === caps[1].y)
    fail('Only primitive, single-entry functions can be imported.', caps[0]?.id);
  const [start, end] = caps;
  const verticals = rows
    .filter((r) => r.type === 'vertical')
    .map((r) => ({ x: r.x, lo: Math.min(r.y, r.y + r.h), hi: Math.max(r.y, r.y + r.h) }));
  const horizontals = rows
    .filter((r) => r.type === 'horizontal')
    .map((r) => ({ y: r.y, lo: Math.min(r.x, r.x + r.w), hi: Math.max(r.x, r.x + r.w) }));
  const symbols = rows.filter((r) => !['horizontal', 'vertical'].includes(r.type));
  const parameters = symbols.filter(
    (r) =>
      r.type === 'action' &&
      r.y === start.y &&
      r.x > start.x &&
      !verticals.some((v) => v.x === r.x && v.lo <= r.y && v.hi >= r.y),
  );
  if (parameters.length > 1) fail('Ambiguous parameter icon.', parameters[1].id);
  const param = parameters[0];
  const normalizedParams = (param?.text || '')
    .split('\n')
    .map((line) => line.split(/\/\/|#/)[0].trim())
    .filter(Boolean)
    .join(', ')
    .replace(/,\s*,/g, ',');
  const drawable = symbols.filter((r) => r !== param);
  for (const r of drawable) {
    if (r.type !== 'beginend' && !Object.hasOwn(legacyType, r.type))
      fail('Unsupported legacy icon "' + r.type + '".', r.id);
    if (r.type === 'if') horizontals.push({ y: r.y, lo: r.x, hi: r.x + r.w + r.a });
  }
  const key = (x, y) => x + ',' + y,
    coords = new Map(),
    points = new Map(),
    edges = new Map();
  const point = (x, y) => {
    const k = key(x, y);
    if (!points.has(k)) {
      if (points.size >= 12000) fail('This legacy diagram has too many line intersections.');
      points.set(k, { x, y });
      edges.set(k, []);
    }
    return k;
  };
  const connect = (a, b) => {
    edges.get(a).push(b);
    edges.get(b).push(a);
  };
  for (const r of drawable) {
    const k = point(r.x, r.y);
    if (coords.has(k)) fail('Overlapping program icons.', r.id);
    coords.set(k, r);
  }
  for (const v of verticals) {
    point(v.x, v.lo);
    point(v.x, v.hi);
  }
  for (const h of horizontals) {
    point(h.lo, h.y);
    point(h.hi, h.y);
    for (const v of verticals)
      if (v.x >= h.lo && v.x <= h.hi && h.y >= v.lo && h.y <= v.hi) point(v.x, h.y);
  }
  for (const segment of [...verticals, ...horizontals]) {
    const vertical = 'x' in segment;
    const nodes = [...points]
      .filter(([, p]) =>
        vertical
          ? p.x === segment.x && p.y >= segment.lo && p.y <= segment.hi
          : p.y === segment.y && p.x >= segment.lo && p.x <= segment.hi,
      )
      .sort((a, b) => (vertical ? a[1].y - b[1].y : a[1].x - b[1].x));
    for (let i = 1; i < nodes.length; i++) connect(nodes[i - 1][0], nodes[i][0]);
  }
  function across(k) {
    const found = new Set([k]),
      queue = [k],
      y = points.get(k).y;
    for (let i = 0; i < queue.length; i++)
      for (const n of edges.get(queue[i]))
        if (!found.has(n) && points.get(n).y === y) {
          found.add(n);
          queue.push(n);
        }
    return [...found];
  }
  function below(k) {
    return edges.get(k).find((n) => points.get(n).y > points.get(k).y);
  }
  function descend(first, id) {
    let k = first;
    for (let i = 0; i <= points.size && k; i++) {
      if (coords.has(k)) return coords.get(k);
      let next = below(k);
      if (!next) {
        const paths = [...new Set(across(k).map(below).filter(Boolean))];
        if (paths.length !== 1) fail('Ambiguous or disconnected join.', id);
        next = paths[0];
      }
      k = next;
    }
    fail('Disconnected flow path.', id);
  }
  const down = (r) => String(descend(below(key(r.x, r.y)), r.id).id);
  const items = {},
    casesSeen = new Set();
  for (const r of drawable) {
    const id = String(r.id),
      pos = key(r.x, r.y);
    if (r === start) {
      items[id] = { type: 'branch', branchId: 0, one: down(r) };
      continue;
    }
    if (r === end) {
      items[id] = { type: 'end' };
      continue;
    }
    const item = (items[id] ??= {});
    Object.assign(item, { type: legacyType[r.type], content: r.text || '', one: down(r) });
    if (r.type === 'if') {
      const lanes = across(pos).filter((k) => points.get(k).x > r.x && below(k));
      if (lanes.length !== 1) fail('Decision needs a unique right path.', id);
      item.two = String(descend(below(lanes[0]), id).id);
      item.flag1 = r.b ? 1 : 0;
    }
    if (r.type === 'select') {
      const first = drawable.find((n) => String(n.id) === item.one);
      if (first?.type !== 'case') fail('Select does not lead to Case.', id);
      const bus = horizontals
        .filter((h) => h.y > r.y && h.y < first.y && h.lo <= r.x && h.hi >= r.x)
        .sort((a, b) => a.y - b.y)[0];
      if (!bus) fail('Missing case distribution line.', id);
      const lanes = across(key(r.x, bus.y))
        .filter((k) => below(k))
        .sort((a, b) => points.get(a).x - points.get(b).x);
      const cases = lanes.map((k) => descend(below(k), id));
      if (cases[0] !== first || cases.some((c) => c.type !== 'case'))
        fail('Unrecognized case distribution.', id);
      cases.forEach((c, i) => {
        casesSeen.add(c.id);
        if (i + 1 < cases.length) (items[String(c.id)] ??= {}).two = String(cases[i + 1].id);
      });
    }
    if (r.type === 'case' && /^(else|default)$/i.test(item.content.trim())) item.content = '';
    if (r.type === 'shelf') item.secondary = r.text2 || '';
    if (r.type === 'loopstart' && language.id === 'python' && /;/.test(item.content))
      fail('Rewrite the legacy counting loop as a Python 3 for or while loop.', id);
  }
  for (const r of drawable) if (r.type === 'case' && !casesSeen.has(r.id)) fail('Orphan case.', r.id);
  const fn = { id: crypto.randomUUID(), name: entry.name, params: normalizedParams, items };
  validateGraph(fn);
  return fn;
}
