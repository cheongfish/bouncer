'use strict';
const test = require('node:test');
const assert = require('node:assert');
const path = require('node:path');
const { loadModuleGraph, findCycles, reachable } = require('./helpers/module-graph');

const LIB_DIR = path.join(__dirname, '..', 'scripts', 'src', 'lib');
const graph = loadModuleGraph(LIB_DIR);

// 하위 모듈이 전이적으로 닿으면 안 되는 상위 계층(접두 일치 또는 정확히 일치).
const FORBIDDEN = /^(cli|validate|finalize)|^(coordinator|current|verification)$/;
const LOW_LAYER = ['execution-dag', 'path-overlap', 'review-policy', 'execution-contracts'];

test('module graph → has no import cycle', () => {
  assert.deepEqual(findCycles(graph), []);
});

test('verification → never reaches current', () => {
  assert.deepEqual([...reachable(graph, 'verification')].filter((m) => m === 'current'), []);
});

test('fake graph where verification imports current → reachability check flags it', () => {
  const fake = new Map(graph);
  fake.set('verification', new Set([...graph.get('verification'), 'current']));
  assert.ok(reachable(fake, 'verification').has('current'));
});

test('verification-target → never imports cli, validate, finalize or coordinator directly', () => {
  const direct = [...graph.get('verification-target')];
  assert.deepEqual(direct.filter((m) => /^(cli|validate|finalize)|^coordinator$/.test(m)), []);
});

test('low-layer modules → never reach cli, validate, coordinator, current, verification or finalize', () => {
  for (const name of LOW_LAYER) {
    const offenders = [...reachable(graph, name)].filter((mod) => FORBIDDEN.test(mod));
    assert.deepEqual(offenders, [], `${name} reaches ${offenders.join(', ')}`);
  }
});

test('execution-dag → direct runtime imports stay within config and path-overlap', () => {
  const direct = [...graph.get('execution-dag')];
  assert.deepEqual(direct.filter((mod) => !['config', 'path-overlap'].includes(mod)), []);
  const transitive = [...reachable(graph, 'execution-dag')];
  assert.deepEqual(transitive.filter((mod) => !['config', 'guards', 'path-overlap'].includes(mod)), []);
});

test('fake graph where execution-dag imports validate-sections → allow-list check flags it', () => {
  const fake = new Map([
    ['execution-dag', new Set(['config', 'validate-sections'])],
    ['config', new Set()],
    ['validate-sections', new Set()],
  ]);
  const offenders = [...fake.get('execution-dag')].filter((mod) => !['config', 'path-overlap'].includes(mod));
  assert.deepEqual(offenders, ['validate-sections']);
  assert.ok([...reachable(fake, 'execution-dag')].some((mod) => FORBIDDEN.test(mod)));
});

test('reachable from a module absent in the graph → throws module not in graph', () => {
  assert.throws(() => reachable(new Map(), 'execution-dag'), /module not in graph: execution-dag/);
});

test('findCycles on a two-module loop → reports the loop', () => {
  const loop = new Map([['a', new Set(['b'])], ['b', new Set(['a'])]]);
  assert.deepEqual(findCycles(loop), [['a', 'b']]);
});

test('loadModuleGraph on a dir with an unresolvable require → throws', () => {
  const fs = require('node:fs');
  const os = require('node:os');
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'graph-'));
  try {
    fs.writeFileSync(path.join(dir, 'a.ts'), "import x = require('./missing');\n");
    assert.throws(() => loadModuleGraph(dir), /unresolved relative require/);
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});
