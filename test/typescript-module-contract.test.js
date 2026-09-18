'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawnSync } = require('node:child_process');

const root = path.join(__dirname, '..');
const fixture = path.join(__dirname, 'fixtures', 'typescript-module-contract-mismatch.ts');
const tsc = path.join(root, 'node_modules', 'typescript', 'bin', 'tsc');

const TSC_BOUNDARY_ARGS = [
  '--noEmit',
  '--strict',
  '--module', 'commonjs',
  '--moduleResolution', 'node',
  '--esModuleInterop',
  '--skipLibCheck',
  '--target', 'ES2022',
];

test('intentional export=/import=require signature mismatch fails tsc --noEmit', () => {
  // fixture는 tsconfig include 밖이다. 프로젝트 빌드와 분리된 호출로만 경계 검사를 본다.
  const result = spawnSync(process.execPath, [
    tsc,
    ...TSC_BOUNDARY_ARGS,
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

test('intent-bundle and cli-intent-command export= boundaries typecheck', () => {
  // affected_paths 밖 fixture를 추가하지 않고, 임시 파일에서 export= 경계를 검사한다.
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'bouncer-ts-intent-ok-'));
  const okFixture = path.join(dir, 'intent-ok.ts');
  fs.writeFileSync(okFixture, [
    "'use strict';",
    "type IntentBundle = typeof import('"
      + path.join(root, 'scripts/src/lib/intent-bundle').replace(/\\/g, '/')
      + "');",
    "type IntentCommand = typeof import('"
      + path.join(root, 'scripts/src/lib/cli-intent-command').replace(/\\/g, '/')
      + "');",
    'declare const intentBundle: IntentBundle;',
    'declare const intentCommand: IntentCommand;',
    "const resolve: IntentBundle['resolveTaskIntentBundle'] = intentBundle.resolveTaskIntentBundle;",
    "const run: IntentCommand['run'] = intentCommand.run;",
    'void resolve;',
    'void run;',
    '',
  ].join('\n'));

  const result = spawnSync(process.execPath, [
    tsc,
    ...TSC_BOUNDARY_ARGS,
    okFixture,
  ], {
    cwd: root,
    encoding: 'utf8',
  });
  fs.rmSync(dir, { recursive: true, force: true });

  assert.equal(
    result.status,
    0,
    `expected tsc success, got stdout:\n${result.stdout}\nstderr:\n${result.stderr}`,
  );
});
