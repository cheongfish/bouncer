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

test('intentional export=/import=require signature → mismatch fails tsc --noEmit', () => {
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

const libSrc = path.join(root, 'scripts', 'src', 'lib');

/**
 * `scripts/src/lib/*.ts` 중 최상위 `export =`를 가진 모듈을 디렉터리 스캔으로 모은다.
 * 모듈 이름을 테스트에 고정하지 않아야 이름 변경·분리에 거짓 실패하지 않고,
 * 새로 추가된 `export =` 모듈도 자동으로 경계 검사에 들어온다.
 *
 * @returns {string[]} 확장자를 뗀 모듈 절대 경로(슬래시 구분), 이름순
 */
function exportAssignmentModules() {
  return fs.readdirSync(libSrc)
    .filter((name) => name.endsWith('.ts') && !name.endsWith('.d.ts'))
    .filter((name) => /^export =/m.test(fs.readFileSync(path.join(libSrc, name), 'utf8')))
    .sort()
    .map((name) => path.join(libSrc, name.slice(0, -'.ts'.length)).replace(/\\/g, '/'));
}

test('every scripts/src/lib export= module → typechecks through typeof import()', () => {
  const modules = exportAssignmentModules();
  // 스캔이 비면 fixture가 아무것도 검사하지 않고 통과하므로 먼저 막는다.
  assert.ok(modules.length > 0, `no export= module found under ${libSrc}`);
  // affected_paths 밖 fixture를 추가하지 않고, 임시 파일에서 export= 경계를 검사한다.
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'bouncer-ts-export-ok-'));
  const okFixture = path.join(dir, 'export-assignment-ok.ts');
  fs.writeFileSync(okFixture, [
    "'use strict';",
    ...modules.map((modulePath, i) => `type Module${i} = typeof import('${modulePath}');`),
    ...modules.map((_, i) => `declare const module${i}: Module${i};`),
    ...modules.map((_, i) => `void module${i};`),
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
