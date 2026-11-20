import { structuredTree } from './vendor/structure.mjs';
import { validateGraph, DiagramError } from './model.mjs';

export function generate(doc, lang) {
  const rows = [],
    names = new Set();
  const line = (text, fn = null, node = null) => rows.push({ text, functionId: fn, nodeId: node });
  if (doc?.language !== lang.id) throw new DiagramError('Project language mismatch.');
  if (!Array.isArray(doc.functions) || !doc.functions.length || doc.functions.length > 250)
    throw new DiagramError('A project needs between 1 and 250 functions.');
  for (const text of lang.preamble) line(text);
  for (const [index, fn] of doc.functions.entries()) {
    try {
      validateGraph(fn);
      const params = fn.params.trim()
        ? fn.params
            .trim()
            .split(/,\s*|\n+/)
            .map((p) => p.trim())
        : [];
      for (const word of [fn.name, ...params]) {
        if (!/^[A-Za-z_][A-Za-z0-9_]*$/.test(word) || lang.reserved.has(word))
          throw new DiagramError('Use a valid ' + lang.label + ' identifier instead of "' + word + '".');
      }
      if (new Set(params).size !== params.length)
        throw new DiagramError('Parameter names must be unique.');
      if (names.has(fn.name)) throw new DiagramError('Function name "' + fn.name + '" appears twice.');
      names.add(fn.name);
      if (index || lang.preamble.length) line('');
      const items = structuredClone(fn.items),
        original = new Map();
      // A selector may have side effects. Evaluate it once before testing cases.
      let next = Math.max(...Object.keys(items).map(Number)) + 1;
      const userText = JSON.stringify(fn);
      for (const [id, item] of Object.entries(fn.items)) {
        if (
          ['action', 'question', 'select', 'loopbegin', 'insertion', 'shelf'].includes(item.type) &&
          !item.content?.trim()
        )
          throw new DiagramError(
            'Enter ' +
              (item.type === 'question'
                ? 'a condition'
                : item.type === 'loopbegin'
                  ? 'a loop header'
                  : 'code') +
              ' for this icon.',
            id,
          );
        if (item.type === 'shelf' && !item.secondary?.trim())
          throw new DiagramError('Enter an assignment target for this shelf.', id);
        if (item.type !== 'select') continue;
        let variable = '__drakon_case_' + id;
        while (userText.includes(variable)) variable += '_';
        const inserted = String(next++);
        for (const old of Object.values(items))
          for (const k of ['one', 'two']) if (old[k] === id) old[k] = inserted;
        items[inserted] = { type: 'action', content: lang.storeChoice(variable, item.content), one: id };
        items[id].content = lang.readChoice(variable);
        original.set(inserted, id);
      }
      const tree = structuredTree({ name: fn.name, items });
      const branch = tree.branches[0];
      if (!branch || tree.branches.length !== 1) throw new DiagramError('The diagram needs one entry.');
      const write = (text, level, id) =>
        line(lang.indent.repeat(level) + text, fn.id, original.get(id) ?? id ?? null);
      const emit = (nodes, level) => {
        if (!nodes.length && lang.empty) write(lang.empty, level, null);
        for (const n of nodes) {
          const id = n.id;
          try {
            switch (n.type) {
              case 'action':
              case 'insertion': {
                const lines = lang.sourceLines(n.content || '', lang.indent.repeat(level));
                for (const text of lines) line(text, fn.id, original.get(id) ?? id);
                break;
              }
              case 'comment':
                for (const text of (n.content || '').split('\n'))
                  write(lang.comment + ' ' + text, level, id);
                break;
              case 'shelf':
                write(lang.assign(n.secondary, n.content), level, id);
                break;
              case 'question':
                write(lang.ifOpen(predicate(n.content, lang)), level, id);
                emit(n.yes, level + 1);
                if (n.no.length) {
                  write(lang.elseOpen, level, id);
                  emit(n.no, level + 1);
                }
                if (lang.ifClose) write(lang.ifClose, level, id);
                break;
              case 'loop':
              case 'loopbegin':
                write(lang.loopOpen(n.content), level, id);
                emit(n.body, level + 1);
                if (lang.loopClose) write(lang.loopClose, level, id);
                break;
              case 'break':
                write(lang.breakLine, level, id);
                break;
              case 'error':
                write(lang.unmatched, level, id);
                break;
              default:
                throw new DiagramError('Unsupported operation "' + n.type + '".', id);
            }
          } catch (e) {
            e.nodeId ??= id;
            throw e;
          }
        }
        if (nodes.length && nodes.every((n) => n.type === 'comment') && lang.empty)
          write(lang.empty, level, null);
      };
      write(lang.signature(fn.name, params), 0, null);
      for (const text of lang.bind(params)) write(text, 1, null);
      emit(branch.body, 1);
      if (lang.functionEnd) write(lang.functionEnd, 0, null);
    } catch (e) {
      throw new DiagramError(e.message, e.nodeId ?? null, fn.id);
    }
  }
  for (const text of lang.footer(doc.functions[0].name)) line(text);
  return { source: rows.map((r) => r.text).join('\n') + '\n', rows };
}
function predicate(value, lang) {
  if (typeof value === 'string') return value;
  if (value?.operator === 'equal') return lang.equal(value.left, value.right);
  if (value?.operator === 'not') return lang.negate(predicate(value.operand, lang));
  throw new DiagramError('Unsupported decision expression.');
}
export function rawLines(text, indent, verbatim = /`|\\\n/) {
  // Continuation lines can be literal strings or shell heredocs.
  const normalized = text.replace(/\r\n?/g, '\n');
  const literal = verbatim.test(normalized);
  return normalized.split('\n').map((s, i) => (i === 0 || !literal ? indent + s : s));
}
