'use strict';
const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { computeSourceHash } = require('../scripts/build-stamp');

/**
 * tmp 트리를 만든다. files는 [상대경로, 내용] 쌍이고 주어진 순서대로 쓴다.
 *
 * @param {Array<[string, string]>} files - 쓸 파일 목록
 * @returns {string} tmp root
 */
function makeTree(files) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'bouncer-stamp-'));
  for (const [rel, body] of files) {
    fs.mkdirSync(path.dirname(path.join(root, rel)), { recursive: true });
    fs.writeFileSync(path.join(root, rel), body);
  }
  return root;
}

const BASE = [
  ['tsconfig.json', '{"a":1}'],
  ['scripts/src/lib/a.ts', 'export const a = 1;\n'],
  ['scripts/src/lib/sub/b.ts', 'export const b = 2;\n'],
];

test('same files written in a different order → same hash', () => {
  const first = computeSourceHash(makeTree(BASE));
  const second = computeSourceHash(makeTree([...BASE].reverse()));
  assert.match(first, /^sha256:[0-9a-f]{64}$/);
  assert.strictEqual(first, second);
});

test('tsconfig.json differs by one byte → hash differs', () => {
  const changed = BASE.map(([rel, body]) => [rel, rel === 'tsconfig.json' ? '{"a":2}' : body]);
  assert.notStrictEqual(computeSourceHash(makeTree(BASE)), computeSourceHash(makeTree(changed)));
});

test('a .ts file renamed with the same bytes → hash differs', () => {
  const renamed = BASE.map(([rel, body]) => [rel === 'scripts/src/lib/a.ts' ? 'scripts/src/lib/c.ts' : rel, body]);
  assert.notStrictEqual(computeSourceHash(makeTree(BASE)), computeSourceHash(makeTree(renamed)));
});
