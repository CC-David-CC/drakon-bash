export const FORMAT = 'webos.drakon/1';
const itemTypes = new Set([
  'branch',
  'end',
  'action',
  'question',
  'select',
  'case',
  'loopbegin',
  'loopend',
  'comment',
  'insertion',
  'shelf',
]);
export class DiagramError extends Error {
  constructor(message, nodeId = null, functionId = null) {
    super(message);
    this.nodeId = nodeId;
    this.functionId = functionId;
  }
}
export function blankFunction(name, id = crypto.randomUUID()) {
  return {
    id,
    name,
    params: '',
    items: { 1: { type: 'branch', branchId: 0, one: '2' }, 2: { type: 'end' } },
  };
}
export function project(language, sample = false) {
  const f = blankFunction(sample ? 'signal_band' : 'main');
  if (sample) {
    f.params = 'level';
    f.items = {
      1: { type: 'branch', branchId: 0, one: '2' },
      2: { type: 'question', content: language.sample.condition, one: '3', two: '4', flag1: 1 },
      3: { type: 'action', content: language.sample.high, one: '5' },
      4: { type: 'action', content: language.sample.low, one: '5' },
      5: { type: 'end' },
    };
  }
  return {
    format: FORMAT,
    language: language.id,
    name: sample ? 'Signal bands' : 'Untitled',
    functions: [f],
  };
}
export function validateGraph(fn) {
  const fail = (msg, id) => {
    throw new DiagramError(msg, id, fn.id);
  };
  const items = fn.items;
  if (!items || typeof items !== 'object' || Array.isArray(items)) fail('Missing diagram items.');
  const ids = Object.keys(items);
  if (!ids.length || ids.length > 2000) fail('A diagram must contain between 1 and 2,000 items.');
  const branches = [],
    ends = [];
  for (const id of ids) {
    const n = items[id];
    if (!/^[1-9]\d{0,8}$/.test(id) || !n || !itemTypes.has(n.type))
      fail('Unsupported diagram item ' + (n?.type ?? id) + '.', id);
    for (const key of ['content', 'secondary'])
      if (n[key] != null && (typeof n[key] !== 'string' || n[key].length > 100000))
        fail('Invalid icon text.', id);
    if (n.side || n.link || n.final)
      fail('Timing, external links, and early-end metadata require a different diagram.', id);
    if (n.type === 'branch') {
      branches.push(id);
      if (!Number.isInteger(n.branchId)) fail('Invalid branch ordinal.', id);
    }
    if (n.type === 'end') ends.push(id);
    if (n.type !== 'end' && !n.one) fail('Missing outgoing path.', id);
    if (n.type === 'end' && (n.one || n.two)) fail('End has an outgoing path.', id);
    if (n.type === 'question' && (!n.two || ![undefined, null, 0, 1].includes(n.flag1)))
      fail('Decision needs two labeled paths.', id);
    if (n.type !== 'question' && n.type !== 'case' && n.two) fail('Unexpected second path.', id);
    for (const key of ['one', 'two'])
      if (n[key] != null && (typeof n[key] !== 'string' || !Object.hasOwn(items, n[key])))
        fail('Missing destination for ' + key + '.', id);
    if (
      (n.type === 'select' && items[n.one]?.type !== 'case') ||
      (n.type === 'case' && n.two && items[n.two]?.type !== 'case')
    )
      fail('Invalid Select / Case chain.', id);
  }
  if (branches.length !== 1 || ends.length !== 1)
    fail(
      'Use one entry and one End per function. Silhouettes require separate functions.',
      branches[1] ?? ends[1],
    );
  // Explicit Loop begin/end pairs are acyclic in the saved diagram.
  const seen = new Set(),
    active = new Set();
  function visit(id, depth) {
    if (depth > 700) fail('Flow nesting exceeds 700 items.', id);
    if (active.has(id)) fail('Use a paired Loop for a back edge.', id);
    if (seen.has(id)) return;
    active.add(id);
    for (const k of ['one', 'two']) if (items[id][k]) visit(items[id][k], depth + 1);
    active.delete(id);
    seen.add(id);
  }
  visit(branches[0], 0);
  if (seen.size !== ids.length)
    fail(
      'Disconnected item.',
      ids.find((id) => !seen.has(id)),
    );
}
export function readProject(value, language) {
  if (typeof value === 'string') value = JSON.parse(value);
  if (value?.format !== FORMAT) throw Error('This file is not a DRAKON Generator project.');
  if (value.language !== language.id)
    throw Error('This project belongs in the DRAKON ' + String(value.language) + ' app.');
  if (
    typeof value.name !== 'string' ||
    !value.name.trim() ||
    value.name.length > 160 ||
    !Array.isArray(value.functions) ||
    !value.functions.length ||
    value.functions.length > 250
  )
    throw Error('Invalid project name or function list.');
  const ids = new Set();
  const functions = value.functions.map((f) => {
    if (
      !f ||
      typeof f.id !== 'string' ||
      !/^[A-Za-z0-9_-]{1,90}$/.test(f.id) ||
      ids.has(f.id) ||
      typeof f.name !== 'string' ||
      f.name.length > 200 ||
      typeof f.params !== 'string' ||
      f.params.length > 4000
    )
      throw Error('Invalid function metadata.');
    ids.add(f.id);
    validateGraph(f);
    // Only data that participates in editing is passed to the canvas.
    const items = {};
    for (const [id, n] of Object.entries(f.items)) {
      items[id] = { type: n.type };
      for (const k of ['one', 'two', 'flag1', 'branchId', 'content', 'secondary'])
        if (n[k] != null) items[id][k] = n[k];
    }
    return { id: f.id, name: f.name, params: f.params, items };
  });
  return { format: FORMAT, language: language.id, name: value.name, functions };
}
export function filename(name) {
  return (
    (name || 'diagram')
      .trim()
      .replace(/[/\\\u0000-\u001f:*?"<>|]+/g, '-')
      .replace(/^\.+|\.+$/g, '')
      .slice(0, 90) || 'diagram'
  );
}
