const paths = {
  flow: 'M12 2v4m0 12v4m6-10h3v7h-9 M12 6l6 6-6 6-6-6z',
  plus: 'M12 5v14M5 12h14',
  minus: 'M5 12h14',
  open: 'M3 7h7l2 2h9l-3 10H4z M3 9V5h7l2 2h6',
  save: 'M4 3h13l3 3v15H4z M8 3v6h8V3 M8 20v-7h8v7',
  export: 'M12 3v12m-4-4 4 4 4-4 M4 16v5h16v-5',
  down: 'm7 10 5 5 5-5',
  dots: 'M5 12h1m5 0h1m5 0h1',
  undo: 'M4 9h9a6 6 0 0 1 0 12 M4 9l5-5M4 9l5 5',
  redo: 'M20 9h-9a6 6 0 0 0 0 12m9-12-5-5m5 5-5 5',
  copy: 'M8 8h12v13H8z M4 16V3h12',
  center: 'M8 4H4v4m12-4h4v4M4 16v4h4m12-4v4h-4',
  edit: 'm5 15 11-11 4 4L9 19l-5 1z',
  shelf: 'M3 5h18v14H3z M3 12h18',
  action: 'M3 6h18v12H3z',
  question: 'm12 3 10 9-10 9-10-9z',
  foreach: 'm5 7 4-4h6l4 4v13H5z',
  select: 'M3 4h18v11l-9 6-9-6z',
  case: 'm4 8 8-5 8 5v12H4z',
  insertion: 'M3 6h18v12H3z M6 6v12m12-12v12',
  comment: 'M5 4v16m0-14h14m-14 5h11',
  code: 'm8 6-6 6 6 6m8-12 6 6-6 6',
  function: 'M4 17h3l4-11h6m-10 6h7',
};
export function ico(name) {
  return (
    '<span class="ico" aria-hidden="true"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.65" stroke-linecap="round" stroke-linejoin="round"><path d="' +
    paths[name] +
    '"/></svg></span>'
  );
}
export function button(doc, label, cls = 'btn', icon = null) {
  const b = doc.createElement('button');
  b.type = 'button';
  b.className = cls;
  b.setAttribute('aria-label', label);
  b.title = label;
  if (icon) b.innerHTML = ico(icon);
  if (cls !== 'iconbtn') b.append(doc.createTextNode(label));
  return b;
}
export function ask(root, title, fields = [], submit = 'Save', message = '') {
  const doc = root.ownerDocument,
    dlg = doc.createElement('dialog'),
    form = doc.createElement('form'),
    h = doc.createElement('h2');
  h.textContent = title;
  dlg.setAttribute('aria-label', title);
  form.append(h);
  dlg.append(form);
  if (message) {
    const p = doc.createElement('p');
    p.textContent = message;
    form.append(p);
  }
  const entries = [];
  for (const spec of fields) {
    const l = doc.createElement('label');
    l.className = 'field';
    l.append(doc.createTextNode(spec.label));
    const el = doc.createElement(spec.choices ? 'select' : spec.multi ? 'textarea' : 'input');
    if (spec.choices) {
      el.multiple = !!spec.multiple;
      for (const [value, name] of spec.choices) {
        const o = doc.createElement('option');
        o.value = String(value);
        o.textContent = name;
        el.append(o);
      }
      if (el.multiple) {
        el.size = Math.min(8, el.options.length);
        if (el.options.length) el.options[0].selected = true;
      }
    }
    if (spec.value != null) el.value = spec.value;
    el.required = !!spec.required;
    el.placeholder = spec.placeholder || '';
    el.spellcheck = false;
    if (spec.max) el.maxLength = spec.max;
    l.append(el);
    form.append(l);
    entries.push([spec.key, el]);
  }
  const footer = doc.createElement('footer'),
    cancel = button(doc, 'Cancel'),
    ok = button(doc, submit, 'btn primary');
  ok.type = 'submit';
  footer.append(cancel, ok);
  form.append(footer);
  root.append(dlg);
  return new Promise((resolve) => {
    let result = null;
    form.addEventListener('submit', (e) => {
      e.preventDefault();
      result = Object.fromEntries(
        entries.map(([key, n]) => [
          key,
          n.multiple ? [...n.selectedOptions].map((o) => o.value) : n.value,
        ]),
      );
      dlg.close();
    });
    cancel.onclick = () => dlg.close();
    dlg.addEventListener(
      'close',
      () => {
        dlg.remove();
        resolve(result);
      },
      { once: true },
    );
    dlg.showModal();
    const first = entries[0]?.[1];
    if (first) {
      first.focus();
      if (first.tagName === 'INPUT') first.select();
    }
  });
}
export function showMenu(root, x, y, options) {
  const doc = root.ownerDocument,
    menu = doc.createElement('div');
  menu.className = 'menu';
  menu.setAttribute('role', 'menu');
  const el = root.host,
    box = el.getBoundingClientRect();
  function close() {
    menu.remove();
    doc.removeEventListener('pointerdown', outside, true);
    doc.removeEventListener('keydown', escape, true);
  }
  function outside(e) {
    if (!e.composedPath().includes(menu)) close();
  }
  function escape(e) {
    if (e.key === 'Escape') {
      e.stopPropagation();
      close();
    }
  }
  for (const opt of options) {
    const b = button(doc, opt.text, 'menubtn');
    b.setAttribute('role', 'menuitem');
    b.onclick = () => {
      close();
      opt.action();
    };
    menu.append(b);
  }
  root.append(menu);
  menu.style.left = Math.max(3, Math.min(x - box.left, box.width - menu.offsetWidth - 4)) + 'px';
  menu.style.top = Math.max(3, Math.min(y - box.top, box.height - menu.offsetHeight - 4)) + 'px';
  doc.addEventListener('pointerdown', outside, true);
  doc.addEventListener('keydown', escape, true);
  menu.firstElementChild?.focus();
  return close;
}
export function paintLine(target, text) {
  const regex =
    /("(?:\\.|[^"\\])*"|'(?:\\.|[^'\\])*'|\/\/.*$|^\s*#.*$|\b(?:export|function|def|if|then|fi|else|for|of|in|while|do|done|return|const|let|local|break|raise|throw|pass|true|false|True|False|None)\b|\b\d+\b)/g;
  let last = 0;
  for (const m of text.matchAll(regex)) {
    target.append(text.slice(last, m.index));
    const token = target.ownerDocument.createElement('span');
    token.className = /^["']/.test(m[0])
      ? 'str'
      : /^\s*#|^\/\//.test(m[0])
        ? 'comment'
        : /^\d/.test(m[0])
          ? 'literal'
          : 'kw';
    token.textContent = m[0];
    target.append(token);
    last = m.index + m[0].length;
  }
  target.append(text.slice(last));
}
