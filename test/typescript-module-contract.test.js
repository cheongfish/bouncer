'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');
const { spawnSync } = require('node:child_process');

const root = path.join(__dirname, '..');
const fixture = path.join(__dirname, 'fixtures', 'typescript-module-contract-mismatch.ts');
const tsc = path.join(root, 'node_modules', 'typescript', 'bin', 'tsc');

test('intentional export=/import=require signature mismatch fails tsc --noEmit', () => {
  // fixture는 tsconfig include 밖이다. 프로젝트 빌드와 분리된 호출로만 경계 검사를 본다.
  const result = spawnSync(process.execPath, [
    tsc,
    '--noEmit',
    '--strict',
    '--module', 'commonjs',
    '--moduleResolution', 'node',
    '--esModuleInterop',
    '--skipLibCheck',
    '--target', 'ES2022',
    fixture,
  ], {
    cwd: root,
    encoding: 'utf8',
  });

  assert.notEqual(result.status, 0, `expected tsc failure, got stdout:\n${result.stdout}\nstderr:\n${result.stderr}`);
  const out = `${result.stdout}\n${result.stderr}`;
  // 공급자 string vs 소비자 number — 캐스트로 가려지지 않은 시그니처 불일치만 인정한다.
  assert.match(out, /Type 'string' is not assignable to type 'number'/);
});
