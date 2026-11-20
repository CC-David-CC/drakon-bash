import { createDrakonWidget } from './vendor/widget.mjs';
import { project, blankFunction, readProject, filename } from './model.mjs';
import { generate } from './compiler.mjs';
import { fileBridge, downloadFile } from './files.mjs';
import { button, ask, showMenu, paintLine, ico } from './view.mjs';
import { css } from './style.mjs';

const cap = 32 * 1024 * 1024;
const encoder = new TextEncoder(),
  decoder = new TextDecoder('utf-8', { fatal: true });
const tools = [
  ['action', 'Action'],
  ['shelf', 'Assign'],
  ['question', 'Decision'],
  ['foreach', 'Loop'],
  ['select', 'Select'],
  ['case', 'Case'],
  ['insertion', 'Call'],
  ['comment', 'Note'],
];
export function mountStudio(host, lang) {
  const doc = host?.ownerDocument || document,
    element = doc.createElement('div');
  element.className = 'window-content drakon-generator';
  element.style.cssText =
    'position:relative;display:flex;flex:1 1 auto;min-width:0;min-height:0;height:100%;overflow:hidden;padding:0';
  const root = element.attachShadow({ mode: 'open' }),
    style = doc.createElement('style');
  style.textContent = css;
  root.append(style);
  const shell = doc.createElement('div');
  shell.className = 'shell';
  shell.style.setProperty('--accent', lang.accent);
  shell.style.setProperty('--tint', lang.light);
  shell.innerHTML = `<header class="bar"><div class="brand"><span class="brand-mark">${ico('flow')}</span>DRAKON <span class="tag"></span></div><div class="bar-group"></div></header>
  <div class="projectbar"><button type="button" class="projectname" title="Rename project"></button><span class="slash">/</span><select class="fn-select" aria-label="Function"></select><span class="fn-actions"></span><div class="controls"><div class="switch"><button type="button" data-tab="diagram">Diagram</button><button type="button" data-tab="source">Source</button></div><span class="history"></span></div></div>
  <main class="work" data-tab="diagram"><section class="board" aria-label="Diagram editor"><div class="subhead">Diagram<div class="controls zoom-controls"></div></div><div class="canvas" tabindex="0" aria-label="DRAKON diagram"></div><div class="palette" aria-label="Insert diagram items"></div></section>
  <section class="codepanel" aria-label="Generated source"><div class="subhead">${ico('code')}<span class="code-name"></span><div class="controls code-tools"></div></div><div class="code" aria-label="Source lines"></div></section></main>
  <footer class="status" role="status"><span class="message"></span><span class="counts"></span></footer>`;
  root.append(shell);
  const get = (s) => shell.querySelector(s),
    canvas = get('.canvas'),
    select = get('.fn-select'),
    code = get('.code');
  get('.tag').textContent = lang.label;
  const controller = new AbortController(),
    signal = controller.signal,
    bridge = fileBridge(host, signal),
    widget = createDrakonWidget(root);
  let data = project(lang, true),
    current = data.functions[0],
    baseline = JSON.stringify(data),
    binding = null,
    output = null,
    problem = null,
    selected = null;
  let loaded = false,
    disposed = false,
    busy = false,
    paused = false,
    revision = 0,
    closeIntent = null,
    menu = null,
    width = 0,
    height = 0,
    clipboard = null,
    disposedHost = null;
  let viewEpoch = 0,
    activeTab = 'diagram';
  const observers = new Set(),
    exportsByPath = new Map();
  const dirty = () => JSON.stringify(data) !== baseline;
  function changed() {
    revision++;
    closeIntent = null;
    for (const cb of observers) cb();
  }
  function assertLive() {
    if (disposed || signal.aborted) throw new DOMException('Window closed.', 'AbortError');
  }
  function say(text, error = false) {
    if (!disposed) {
      get('.message').textContent = text;
      get('.status').dataset.error = String(error);
    }
  }
  function report(e) {
    if (e?.name !== 'AbortError') say(e?.message || String(e), true);
  }
  function closeMenu() {
    menu?.();
    menu = null;
  }
  function popup(anchor, options, coords) {
    closeMenu();
    const b = anchor?.getBoundingClientRect();
    menu = showMenu(root, coords?.x ?? b.left, coords?.y ?? b.bottom, options);
  }
  function run(action) {
    return async (...args) => {
      if (disposed || busy || paused) return;
      busy = true;
      shell.inert = true;
      changed();
      closeMenu();
      try {
        return await action(...args);
      } catch (e) {
        report(e);
      } finally {
        if (!disposed) {
          busy = false;
          shell.inert = paused;
          changed();
        }
      }
    };
  }
  function btn(where, label, icon, action, style = 'btn') {
    const b = button(doc, label, style, icon);
    where.append(b);
    b.addEventListener('click', action, { signal });
    return b;
  }
  function menuAction(text, fn) {
    return { text, action: run(fn) };
  }
  const config = {
    textFormat: 'plain',
    canvasIcons: true,
    canSelect: true,
    drawZones: false,
    font: '14px Inter, sans-serif',
    minWidth: 95,
    maxWidth: 255,
    padding: 9,
    theme: {
      background: '#f4f6f1',
      iconBack: '#ffffff',
      iconBorder: '#64766a',
      color: '#1b2c22',
      lines: '#667b6d',
      backText: '#465c50',
      lineWidth: 1.3,
      borderWidth: 1.2,
      shadowColor: '',
      candyFill: lang.light,
      candyBorder: lang.accent,
      icons: {
        question: { iconBack: lang.light, iconBorder: lang.accent },
        header: { iconBack: '#dce6dc' },
        end: { iconBack: '#dce6dc' },
      },
    },
    startEditContent: (item, ro) => {
      if (!ro) void run(() => editItem(item))();
    },
    startEditSecondary: (item) => void run(() => editItem(item, true))(),
    showContextMenu: (x, y, items) => {
      if (paused || busy || disposed) return;
      const allowed = items.filter(
        (i) =>
          i.action &&
          /^(Edit content|Edit upper text|Delete|Copy|Cut|Paste|Swap|Insert Case)/i.test(i.text || ''),
      );
      if (allowed.length)
        popup(
          null,
          allowed.map((o) => ({
            text: o.text,
            action: () => {
              try {
                o.action();
              } catch (e) {
                report(e);
              }
            },
          })),
          { x, y },
        );
    },
    getClipboard: () => clipboard,
    setClipboard: (value) => {
      clipboard = value;
    },
    onSelectionChanged: (items) => {
      selected = Array.isArray(items) ? (items[0] ?? null) : items;
      highlight();
    },
    onZoomChanged: () => {
      if (!disposed) get('.zoom').textContent = Math.round(widget.getZoom() / 100) + '%';
    },
  };
  function paintCanvas(force = false) {
    if (disposed || (!canvas.clientWidth && !force)) return;
    const x = Math.max(150, canvas.clientWidth || 470),
      y = Math.max(100, canvas.clientHeight || 350);
    if (!force && x === width && y === height) return;
    width = x;
    height = y;
    canvas.replaceChildren(widget.render(width, height, config));
    if (loaded) widget.redraw();
  }
  const resize = new ResizeObserver(() => {
    try {
      paintCanvas();
    } catch (e) {
      report(e);
    }
  });
  resize.observe(canvas);
  function sync() {
    if (!loaded || disposed) return;
    const saved = JSON.parse(widget.exportJson());
    current.items = saved.items;
    current.name = saved.name ?? current.name;
    current.params = saved.params ?? '';
  }
  function highlight() {
    if (disposed) return;
    const id = selected?.id == null ? null : String(selected.id);
    for (const b of code.querySelectorAll('.line'))
      b.classList.toggle('match', id !== null && b.dataset.node === id && b.dataset.fn === current.id);
  }
  function update() {
    if (disposed) return;
    get('.projectname').textContent = data.name;
    select.replaceChildren(
      ...data.functions.map((f) => {
        const o = doc.createElement('option');
        o.value = f.id;
        o.textContent = f.name || 'Untitled function';
        return o;
      }),
    );
    select.value = current.id;
    get('.counts').textContent =
      data.functions.length +
      ' ' +
      (data.functions.length === 1 ? 'function' : 'functions') +
      ' · ' +
      Object.keys(current.items).length +
      ' items';
    get('.code-name').textContent = filename(data.name) + lang.extension;
    code.replaceChildren();
    output = null;
    problem = null;
    try {
      output = generate(data, lang);
    } catch (e) {
      problem = e;
    }
    if (problem) {
      const box = doc.createElement('div');
      box.className = 'problem';
      const title = doc.createElement('div');
      title.className = 'error-label';
      title.textContent = 'Generation paused';
      const p = doc.createElement('p');
      p.textContent = problem.message;
      box.append(title, p);
      if (problem.functionId)
        btn(
          box,
          'Go to diagram',
          null,
          run(() => locate(problem.functionId, problem.nodeId)),
        );
      code.append(box);
    } else {
      const frag = doc.createDocumentFragment();
      output.rows.forEach((r, i) => {
        const b = doc.createElement('button');
        b.type = 'button';
        b.className = 'line';
        b.dataset.fn = r.functionId ?? '';
        b.dataset.node = r.nodeId ?? '';
        b.tabIndex = r.functionId ? 0 : -1;
        const num = doc.createElement('span');
        num.className = 'num';
        num.textContent = String(i + 1);
        num.setAttribute('aria-hidden', 'true');
        const text = doc.createElement('span');
        paintLine(text, r.text);
        b.append(num, text);
        frag.append(b);
      });
      code.append(frag);
      highlight();
    }
    exportButton.disabled = !output;
    copyButton.disabled = !output;
  }
  function onEdit(epoch) {
    queueMicrotask(() => {
      if (epoch !== viewEpoch || !loaded || disposed) return;
      sync();
      changed();
      update();
      clearTool();
      say(dirty() ? 'Edited · save project to keep changes.' : 'Ready');
    });
  }
  async function display(fn, reuse = false) {
    const epoch = ++viewEpoch;
    loaded = false;
    selected = null;
    clearTool();
    current = fn;
    paintCanvas();
    const input = { ...structuredClone(fn), type: 'drakon', access: 'write' };
    const sender = { pushEdit: () => onEdit(epoch), stop: () => {} };
    await widget.setDiagram(fn.id, input, sender, reuse);
    assertLive();
    if (epoch !== viewEpoch) return;
    loaded = true;
    update();
    if (!reuse) widget.goHome();
  }
  function tab(name) {
    activeTab = name;
    get('.work').dataset.tab = name;
    for (const b of shell.querySelectorAll('.switch button'))
      b.setAttribute('aria-pressed', String(b.dataset.tab === name));
  }
  async function locate(fid, id) {
    const fn = data.functions.find((f) => f.id === fid);
    if (!fn) return;
    if (fn !== current) {
      sync();
      await display(fn);
    }
    tab('diagram');
    paintCanvas();
    if (id && Object.hasOwn(fn.items, id)) {
      widget.showItem(id);
      selected = { id, type: fn.items[id].type, content: fn.items[id].content };
      highlight();
    } else widget.goHome();
  }
  code.addEventListener(
    'click',
    (e) => {
      const b = e.target.closest('.line');
      if (b?.dataset.fn) void run(() => locate(b.dataset.fn, b.dataset.node))();
    },
    { signal },
  );
  function clearTool() {
    for (const b of shell.querySelectorAll('.tool')) b.setAttribute('aria-pressed', 'false');
    canvas.classList.remove('overlay');
  }
  async function editItem(item, secondary = false) {
    if (!item) return say('Select an icon to edit.');
    if (
      item.type === 'header' ||
      item.type === 'params' ||
      (!current.items[item.id] && ['header', 'params'].includes(item.id))
    )
      return functionForm(false);
    const n = current.items[item.id];
    if (!n || ['end', 'branch', 'loopend'].includes(n.type))
      return say('Select an action, condition, loop, or note.');
    if (n.type === 'shelf') {
      const values = await ask(
        root,
        'Edit assignment',
        [
          {
            key: 'target',
            label: 'Assignment target',
            value: n.secondary || '',
            required: true,
            max: 100000,
          },
          {
            key: 'expression',
            label: 'Value expression',
            value: n.content || '',
            multi: true,
            required: true,
            max: 100000,
          },
        ],
        'Apply',
      );
      assertLive();
      if (!values) return;
      widget.setSecondary(String(item.id), values.target);
      widget.setContent(String(item.id), values.expression);
      return;
    }
    const k = secondary ? 'secondary' : 'content',
      title =
        n.type === 'question'
          ? 'Edit decision'
          : n.type === 'loopbegin'
            ? 'Edit loop'
            : 'Edit ' + n.type;
    const result = await ask(
      root,
      title,
      [
        {
          key: 'value',
          label: secondary
            ? 'Assignment target'
            : n.type === 'question'
              ? 'Condition'
              : n.type === 'loopbegin'
                ? 'Loop header'
                : 'Contents',
          multi: true,
          value: n[k] || '',
          placeholder: lang.hints[n.type] || '',
          max: 100000,
        },
      ],
      'Apply',
    );
    assertLive();
    if (!result) return;
    (secondary ? widget.setSecondary : widget.setContent)(String(item.id), result.value);
  }
  async function functionForm(add) {
    sync();
    const f = add ? blankFunction('function_' + (data.functions.length + 1)) : current;
    const r = await ask(
      root,
      add ? 'Add function' : 'Function settings',
      [
        { key: 'name', label: 'Function name', value: f.name, required: true, max: 160 },
        { key: 'params', label: 'Parameters (comma-separated names)', value: f.params, max: 4000 },
      ],
      add ? 'Add function' : 'Apply',
    );
    assertLive();
    if (!r) return;
    f.name = r.name.trim();
    f.params = r.params.trim();
    if (add) data.functions.push(f);
    await display(f);
    changed();
    say('Function updated.');
  }
  async function removeFunction() {
    if (data.functions.length === 1) throw Error('A project needs one function.');
    if (!(await ask(root, 'Delete ' + current.name + '?', [], 'Delete'))) return;
    assertLive();
    data.functions = data.functions.filter((f) => f !== current);
    await display(data.functions[0]);
    changed();
    say('Function deleted.');
  }
  async function rename() {
    const r = await ask(
      root,
      'Rename project',
      [{ key: 'name', label: 'Project name', value: data.name, required: true, max: 160 }],
      'Rename',
    );
    assertLive();
    if (r && r.name.trim()) {
      data.name = r.name.trim();
      changed();
      update();
      say('Project renamed.');
    }
  }
  async function canReplace() {
    sync();
    return (
      !dirty() ||
      !!(await ask(
        root,
        'Discard unsaved changes?',
        [],
        'Discard changes',
        'Your current project has edits.',
      ))
    );
  }
  async function adopt(next, resource = null, isClean = true) {
    data = next;
    binding = resource ? { path: resource.path, sha256: resource.sha256 } : null;
    exportsByPath.clear();
    await display(next.functions[0]);
    baseline = isClean ? JSON.stringify(data) : '';
    changed();
    if (bridge.hosted) bridge.bind(binding);
  }
  const input = doc.createElement('input');
  input.type = 'file';
  input.hidden = true;
  input.accept = lang.projectExtension + ',.drn';
  root.append(input);
  async function importBytes(bytes, name, resource = null) {
    if (bytes.byteLength > cap) throw Error('Choose a project under 32 MiB.');
    if (name.toLowerCase().endsWith('.drn')) {
      const { openLegacy } = await import('./legacy.mjs');
      const db = await openLegacy(bytes, lang);
      try {
        assertLive();
        const hint = db.sourceLanguage.includes('2.x')
          ? 'The file declares Python 2. Review action text for Python 3.'
          : 'Select the functions to import into a new project.';
        const picked = await ask(
          root,
          'Import DRAKON functions',
          [
            {
              key: 'ids',
              label: 'Functions',
              choices: db.diagrams.map((d) => [d.id, d.name]),
              multiple: true,
              required: true,
            },
          ],
          'Import',
          hint,
        );
        assertLive();
        if (!picked) return;
        const next = {
          ...project(lang),
          name: name
            .split('/')
            .pop()
            .replace(/\.drn$/i, ''),
          functions: picked.ids.map((id) => db.convert(Number(id))),
        };
        await adopt(next, null, false);
        say('Imported ' + next.functions.length + ' function(s). Save an editable project.');
      } finally {
        db.close();
      }
      return;
    }
    const next = readProject(decoder.decode(bytes), lang);
    await adopt(next, resource);
    say(resource ? 'Opened from Files.' : 'Opened device project.');
  }
  async function openDevice() {
    input.value = '';
    input.click();
  }
  input.addEventListener(
    'change',
    run(async () => {
      const f = input.files?.[0];
      if (!f || !(await canReplace())) return;
      if (f.size > cap) throw Error('Choose a project under 32 MiB.');
      const bytes = new Uint8Array(await f.arrayBuffer());
      assertLive();
      await importBytes(bytes, f.name);
    }),
    { signal },
  );
  async function openAccount() {
    const p = await bridge.pick([lang.projectExtension, '.drn']);
    if (!p || !(await canReplace())) return;
    const f = await bridge.read(p);
    await importBytes(f.bytes, p, f);
  }
  // undefined signals a cancelled overwrite. null is the create-only precondition.
  async function writeRevision(path, known) {
    if (known) return known;
    const revision = await bridge.version(path);
    assertLive();
    if (revision && !(await ask(root, 'Replace existing file?', [], 'Replace', path))) return undefined;
    return revision;
  }
  async function save(asCopy = false, device = false) {
    sync();
    const serialized = JSON.stringify(data, null, 2) + '\n',
      before = JSON.stringify(data),
      name = filename(data.name) + lang.projectExtension;
    if (device || !bridge.hosted) {
      downloadFile(doc, serialized, name, 'application/json');
      if (!bridge.hosted) baseline = before;
      changed();
      say('Downloaded ' + name + '.');
      return;
    }
    const target = (!asCopy && binding?.path) || (await bridge.destination(name, lang.projectExtension));
    if (!target) return;
    const previous = await writeRevision(target, binding?.path === target ? binding.sha256 : null);
    if (previous === undefined) return;
    const saved = await bridge.write(target, encoder.encode(serialized), previous);
    assertLive();
    binding = saved;
    baseline = before;
    bridge.bind(saved);
    changed();
    say('Saved to Files · ' + target);
  }
  async function exportCode(device = false) {
    sync();
    const generated = generate(data, lang),
      name = filename(data.name) + lang.extension;
    if (device || !bridge.hosted) {
      downloadFile(doc, generated.source, name, 'text/plain;charset=utf-8');
      say('Exported ' + name + '.');
      return;
    }
    const p = await bridge.destination(name, lang.extension);
    if (!p) return;
    const previous = await writeRevision(p, exportsByPath.get(p));
    if (previous === undefined) return;
    const saved = await bridge.write(p, encoder.encode(generated.source), previous);
    exportsByPath.set(p, saved.sha256);
    say('Source saved to Files · ' + p);
  }
  async function newProject() {
    if (!(await canReplace())) return;
    const r = await ask(
      root,
      'New ' + lang.label + ' project',
      [{ key: 'name', label: 'Project name', value: 'Untitled', required: true, max: 160 }],
      'Create',
    );
    assertLive();
    if (!r?.name.trim()) return;
    const next = project(lang);
    next.name = r.name.trim();
    await adopt(next, null, false);
    say('New project.');
  }
  const bar = get('.bar-group');
  btn(bar, 'New', 'plus', run(newProject));
  btn(
    bar,
    'Open',
    'open',
    run(() => (bridge.hosted ? openAccount() : openDevice())),
  );
  btn(
    bar,
    'Save',
    'save',
    run(() => save()),
  );
  const more = btn(
    bar,
    'File options',
    'dots',
    () =>
      popup(more, [
        ...(bridge.hosted
          ? [
              menuAction('Save project as…', () => save(true)),
              menuAction('Open device file…', openDevice),
              menuAction('Download project', () => save(false, true)),
              menuAction('Download source', () => exportCode(true)),
            ]
          : []),
        menuAction('Import .drn file…', openDevice),
        menuAction('Rename project', rename),
      ]),
    'iconbtn',
  );
  const exportButton = btn(
    bar,
    'Export ' + lang.extension,
    'export',
    run(() => exportCode()),
    'btn primary',
  );
  const copyButton = btn(
    get('.code-tools'),
    'Copy source',
    'copy',
    run(async () => {
      await navigator.clipboard.writeText(generate(data, lang).source);
      say('Source copied.');
    }),
    'iconbtn',
  );
  btn(
    get('.fn-actions'),
    'Add function',
    'plus',
    run(() => functionForm(true)),
    'iconbtn',
  );
  const settings = btn(
    get('.fn-actions'),
    'Function options',
    'dots',
    () =>
      popup(settings, [
        menuAction('Function settings', () => functionForm(false)),
        menuAction('Delete function', removeFunction),
      ]),
    'iconbtn',
  );
  btn(
    get('.history'),
    'Undo',
    'undo',
    run(() => widget.undo()),
    'iconbtn',
  );
  btn(
    get('.history'),
    'Redo',
    'redo',
    run(() => widget.redo()),
    'iconbtn',
  );
  const zooms = get('.zoom-controls');
  btn(
    zooms,
    'Zoom out',
    'minus',
    run(() => widget.setZoom(Math.max(4000, widget.getZoom() - 1000))),
    'iconbtn',
  );
  const z = doc.createElement('span');
  z.className = 'zoom';
  z.textContent = '100%';
  zooms.append(z);
  btn(
    zooms,
    'Zoom in',
    'plus',
    run(() => widget.setZoom(Math.min(22000, widget.getZoom() + 1000))),
    'iconbtn',
  );
  btn(
    zooms,
    'Center diagram',
    'center',
    run(() => widget.goHome()),
    'iconbtn',
  );
  btn(
    zooms,
    'Edit selected icon',
    'edit',
    run(() => editItem(selected)),
    'iconbtn',
  );
  for (const [type, label] of tools) {
    const b = btn(
      get('.palette'),
      label,
      type,
      run(() => {
        if (!loaded) return;
        clearTool();
        widget.showInsertionSockets(type);
        b.setAttribute('aria-pressed', 'true');
        canvas.classList.add('overlay');
        say('Choose an insertion point for ' + label.toLowerCase() + '.');
      }),
      'tool',
    );
    b.setAttribute('aria-pressed', 'false');
  }
  get('.projectname').onclick = run(rename);
  select.onchange = run(async () => {
    sync();
    const id = select.value;
    await display(data.functions.find((f) => f.id === id));
  });
  for (const b of shell.querySelectorAll('.switch button'))
    b.onclick = () => {
      tab(b.dataset.tab);
      if (activeTab === 'diagram') paintCanvas();
    };
  tab('diagram');
  root.addEventListener(
    'keydown',
    (e) => {
      if (
        busy ||
        paused ||
        root.querySelector('dialog[open]') ||
        ['INPUT', 'TEXTAREA', 'SELECT'].includes(e.target.tagName)
      )
        return;
      const ctrl = e.ctrlKey || e.metaKey;
      if (ctrl && e.key.toLowerCase() === 's') {
        e.preventDefault();
        void run(() => save(e.shiftKey))();
      }
      if (ctrl && e.key.toLowerCase() === 'z') {
        e.preventDefault();
        if (e.shiftKey) widget.redo();
        else widget.undo();
      }
      if (e.target === canvas && e.key === 'Delete') {
        e.preventDefault();
        widget.deleteSelection();
      }
    },
    { signal },
  );
  function dispose() {
    if (disposed) return;
    disposed = true;
    viewEpoch++;
    controller.abort();
    host?.signal?.removeEventListener('abort', disposedHost);
    resize.disconnect();
    closeMenu();
    for (const dialog of root.querySelectorAll('dialog[open]')) dialog.close();
    widget.dispose();
    observers.clear();
    element.remove();
  }
  disposedHost = dispose;
  host?.signal?.addEventListener('abort', dispose, { once: true });
  busy = true;
  shell.inert = true;
  const ready = (async () => {
    try {
      await Promise.resolve();
      assertLive();
      paintCanvas(true);
      const launch = bridge.launch();
      if (launch) {
        const file = await bridge.read(launch.path, launch.restore ? undefined : launch.sha256);
        await importBytes(file.bytes, file.path, file);
      } else {
        await display(current);
        say('Ready · ' + (bridge.hosted ? 'Account Files' : 'Device files'));
      }
      assertLive();
      element.dataset.state = 'ready';
    } catch (e) {
      if (!disposed) {
        element.dataset.state = 'error';
        report(e);
      }
      throw e;
    } finally {
      if (!disposed) {
        busy = false;
        shell.inert = paused;
        changed();
      }
    }
  })();
  ready.catch(() => {});
  if (host?.signal?.aborted) dispose();
  const lifecycle = {
    snapshot: () => ({ revision, dirty: dirty(), pending: busy }),
    subscribe(cb) {
      observers.add(cb);
      return () => observers.delete(cb);
    },
    async quiesce() {
      if (busy || root.querySelector('dialog[open]'))
        throw Error('Finish the current editor action first.');
      paused = true;
      shell.inert = true;
      return {
        release() {
          paused = false;
          shell.inert = busy;
        },
      };
    },
    commitClose() {
      if (closeIntent !== null && closeIntent !== JSON.stringify(data))
        throw Error('The project changed during close.');
      return true;
    },
  };
  return {
    element,
    ready,
    dispose,
    lifecycle,
    focus() {
      canvas.focus();
      return true;
    },
    inspect() {
      sync();
      return {
        project: structuredClone(data),
        binding: binding ? { path: binding.path, sha256: binding.sha256 } : null,
        dirty: dirty(),
        source: output?.source ?? null,
        diagnostic: problem?.message ?? null,
      };
    },
    async requestClose() {
      if (disposed) return true;
      if (busy || paused || root.querySelector('dialog[open]')) return false;
      sync();
      const at = JSON.stringify(data);
      if (dirty() && !(await ask(root, 'Close with unsaved changes?', [], 'Discard and close')))
        return false;
      if (disposed || at !== JSON.stringify(data)) return false;
      closeIntent = at;
      return true;
    },
  };
}
