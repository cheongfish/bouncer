// test/config-help.test.js
'use strict';
const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');
const { runCli } = require('../scripts/lib/cli');
const { NAMED_AGENTS } = require('../scripts/lib/codex-agents');

const doc = fs.readFileSync(path.join(__dirname, '..', 'docs/configuration.md'), 'utf8');

function cliHelp() {
  let out = '';
  const code = runCli(['config', '--help'], { out: (s) => { out += s; }, err: () => {} });
  assert.strictEqual(code, 0);
  return out;
}

// docs 표의 `subagents.*` 행에서 키와 둘째 칸의 큰따옴표 리터럴만 읽는다.
function readDocs() {
  const keys = new Map();
  for (const line of doc.split('\n')) {
    if (!line.startsWith('| `subagents.')) continue;
    const cells = line.split(/(?<!\\)\|/).map((c) => c.trim());
    const key = /^`([^`]+)`$/.exec(cells[1])[1];
    const values = [];
    for (const m of cells[2].matchAll(/"([^"]*)"/g)) values.push(m[1]);
    if (/없음/.test(cells[2])) values.push('absent');
    keys.set(key, values.sort());
  }
  const para = doc.slice(doc.indexOf('`<agent>`는'));
  const agents = [...para.slice(0, para.indexOf('\n\n')).matchAll(/`(bouncer-[a-z-]+)`/g)].map((m) => m[1]);
  return { keys, agents: agents.sort() };
}

// CLI 출력에서 같은 구조를 뽑는다. `<...>` 자리표시자 값은 버린다.
function readCli(text) {
  const keys = new Map();
  for (const line of text.split('\n')) {
    const m = /^ {2}(subagents\.\S+)\s{2,}(.+)$/.exec(line);
    if (!m) continue;
    keys.set(m[1], m[2].split(' | ').filter((v) => !v.startsWith('<')).sort());
  }
  const agentLine = text.split('\n').find((l) => /^ {4}<agent>:/.test(l) || /^ {2}<agent>:/.test(l));
  const agents = agentLine.replace(/^\s*<agent>:\s*/, '').split(', ').sort();
  return { keys, agents };
}

test('config --help keys, values, and agents match docs/configuration.md', () => {
  const d = readDocs();
  const c = readCli(cliHelp());
  assert.deepStrictEqual([...c.keys.keys()].sort(), [...d.keys.keys()].sort());
  for (const [k, v] of d.keys) {
    assert.deepStrictEqual(c.keys.get(k), v, k);
  }
  assert.deepStrictEqual(c.agents, d.agents);
  assert.deepStrictEqual(c.agents, [...NAMED_AGENTS].sort());
});
