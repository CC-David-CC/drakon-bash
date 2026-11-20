import { rawLines } from './runtime/compiler.mjs';
export const language = {
  id: 'bash',
  label: 'Bash',
  extension: '.sh',
  projectExtension: '.drakonsh',
  accent: '#5755ac',
  light: '#e8e6fb',
  short: 'SH',
  reserved: new Set(
    'if then else elif fi case esac for select while until do done in function time coproc return local readonly declare typeset break continue exit source builtin command'.split(
      ' ',
    ),
  ),
  indent: '  ',
  preamble: ['#!/usr/bin/env bash'],
  footer: (n) => ['', 'if [[ ${BASH_SOURCE[0]} == "$0" ]]; then', '  ' + n + ' "$@"', 'fi'],
  signature: (n) => n + '() {',
  bind: (p) => p.map((name, i) => 'local ' + name + '="${' + (i + 1) + '-}"'),
  functionEnd: '}',
  comment: '#',
  sourceLines: (s, i) => rawLines(s, i, /<<|['"`\\]/),
  empty: ':',
  breakLine: 'break',
  ifOpen: (c) => 'if ' + c.replace(/;\s*$/, '') + '; then',
  elseOpen: 'else',
  ifClose: 'fi',
  loopOpen(text) {
    const t = (text || '').trim().replace(/;\s*do$/, '');
    if (!t) return 'while true; do';
    if (/^(for|while|until)\s+\S/.test(t)) return t + '; do';
    throw Error('Use “for item in "$@"” or “while command” for this Bash loop.');
  },
  loopClose: 'done',
  assign: (v, e) => {
    if (!/^[A-Za-z_]\w*$/.test(v)) throw Error('A Bash shelf needs a variable name.');
    return v + '=' + e;
  },
  storeChoice: (v, e) => 'local ' + v + '\n' + v + '=' + e,
  readChoice: (v) => '"$' + v + '"',
  equal: (a, b) => '( __drakon_value=' + b + '; [[ ' + a + ' == "$__drakon_value" ]] )',
  negate: (c) => '! { ' + c.replace(/;\s*$/, '') + '; }',
  unmatched: "printf '%s\\n' 'Unexpected case value' >&2; return 1",
  sample: {
    condition: '[[ $level =~ ^[0-9]+$ ]] && (( 10#$level >= 70 ))',
    high: "printf '%s\\n' strong",
    low: "printf '%s\\n' weak",
  },
  hints: {
    action: 'Example: printf \'%s\\n\' "$item"',
    question: 'Example: [[ -n $value ]]',
    loopbegin: 'for item in "$@"',
    insertion: 'process "$value"',
    select: '"$value"',
    case: 'A shell word, or empty for default',
    comment: 'Comment',
    shelf: 'Value expression',
  },
};
