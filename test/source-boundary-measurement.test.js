'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawnSync } = require('node:child_process');
const {
  countLf,
  directRequires,
  buildTestArgv,
  parseCoverage,
  summarizeInventory,
  runProbe,
  probeModule,
  compareReport,
  validateInventory,
} = require('../scripts/measure-source-boundaries');

test('LF counting → handles CRLF, missing final LF, and empty files', () => {
  assert.deepEqual([countLf('a\r\nb\r\n'), countLf('a\nb'), countLf('')], [2, 1, 0]);
});

test('inventory → distinguishes top-level and recursive sources and deduplicates requires', () => {
  const files = [
    { path: 'scripts/src/lib/a.ts', content: 'a\nb\n' },
    { path: 'scripts/src/lib/nested/b.ts', content: 'c' },
    { path: 'test/a.test.js', content: "require('../scripts/lib/a'); require('../scripts/lib/a');" },
  ];
  assert.deepEqual(summarizeInventory(files), {
    topLevel: { files: 1, lines: 2 }, recursive: { files: 2, lines: 2 },
    test: { files: 1, lines: 0 }, directRequireFiles: 1, directRequireTargets: ['a'],
  });
  assert.deepEqual(directRequires("require('../scripts/lib/a'); require('../scripts/lib/a'); require('../scripts/lib/b');"), ['a', 'b']);
});

test('subprocess fixture → measures LF bytes and unique require targets from a checkout', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'boundary-inventory-'));
  try {
    fs.mkdirSync(path.join(dir, 'scripts/src/lib/nested'), { recursive: true });
    fs.mkdirSync(path.join(dir, 'test'), { recursive: true });
    fs.writeFileSync(path.join(dir, 'scripts/src/lib/a.ts'), Buffer.from('a\r\nb\r\n'));
    fs.writeFileSync(path.join(dir, 'scripts/src/lib/nested/b.ts'), 'c');
    fs.writeFileSync(path.join(dir, 'test/a.test.js'), "require('../scripts/lib/a'); require('../scripts/lib/a');");
    const modulePath = path.resolve(__dirname, '../scripts/measure-source-boundaries.js');
    const code = `const fs=require('node:fs'); const p=require('node:path'); const m=require(${JSON.stringify(modulePath)}); const files=['scripts/src/lib/a.ts','scripts/src/lib/nested/b.ts','test/a.test.js'].map(path=>({path,content:fs.readFileSync(p.join(process.cwd(),path))})); process.stdout.write(JSON.stringify(m.summarizeInventory(files)));`;
    const measured = runProbe(process.execPath, ['-e', code], dir);
    assert.deepEqual(measured, {
      topLevel: { files: 1, lines: 2 }, recursive: { files: 2, lines: 2 },
      test: { files: 1, lines: 0 }, directRequireFiles: 1, directRequireTargets: ['a'],
    });
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test('test argv → uses sorted suite and shared coverage thresholds', () => {
  assert.deepEqual(buildTestArgv(['z.test.js', 'a.test.js'], false), ['--test', 'test/a.test.js', 'test/z.test.js']);
  assert.deepEqual(buildTestArgv(['b.test.js', 'a.test.js'], true), [
    '--test', 'test/a.test.js', 'test/b.test.js', '--experimental-test-coverage',
    '--test-coverage-include=scripts/lib/**', '--test-coverage-lines=94',
    '--test-coverage-branches=82', '--test-coverage-functions=96',
  ]);
});

test('coverage summary → accepts one valid all-files row and rejects missing, duplicate, or invalid rows', () => {
  assert.deepEqual(parseCoverage('# all files | 95.00 | 85.00 | 98.00 |\n'), { lines: 95, branches: 85, functions: 98 });
  for (const text of ['', '# all files | 95 | 85 | 98 |\n# all files | 95 | 85 | 98 |', '# all files | 93 | 82 | 96 |']) {
    assert.throws(() => parseCoverage(text));
  }
});

test('probe → isolates module cache and rejects spawn errors or nonzero exits', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'boundary-probe-'));
  const child = path.join(dir, 'child.js');
  fs.writeFileSync(child, "process.stdout.write(JSON.stringify({cache:Object.keys(require.cache).length}));");
  assert.deepEqual(runProbe(process.execPath, [child], dir), { cache: 1 });
  assert.throws(() => runProbe(path.join(dir, 'missing'), [], dir), /spawn/);
  assert.throws(() => runProbe(process.execPath, ['-e', "process.kill(process.pid, 'SIGTERM')"], dir), /signal SIGTERM/);
  fs.writeFileSync(child, 'process.exit(4)');
  assert.throws(() => runProbe(process.execPath, [child], dir), /exit 4/);
  fs.rmSync(dir, { recursive: true, force: true });
});

test('baseline without new module → records absent while required module absence fails', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'boundary-absent-'));
  fs.mkdirSync(path.join(dir, 'scripts'), { recursive: true });
  assert.deepEqual(probeModule(dir, 'measure-source-boundaries'), { status: 'absent', exports: [] });
  assert.throws(() => probeModule(dir, 'coordinator'), /required probe module missing/);
  fs.rmSync(dir, { recursive: true, force: true });
});

test('comparison report → accepts matching snapshots and rejects altered measurements', () => {
  const snapshot = {
    schemaVersion: 1, nodeMajor: 24, nodePath: '/node', nodeVersion: 'v24.0.0', npmVersion: '11',
    platform: 'linux', arch: 'x64', definition: { suite: 'same' }, revision: 'a'.repeat(40),
    inventory: { topLevel: { files: 2, lines: 30 }, test: { files: 4, lines: 50 } },
    coverage: { lines: 95, branches: 85, functions: 98 }, probes: {}, counts: {}, durationsMs: {},
    exitStatus: { build: 0, suite: 0, coverage: 0, npmTest: 0 },
  };
  const report = { before: snapshot, after: { ...snapshot, revision: 'b'.repeat(40) } };
  assert.equal(compareReport(report), true);
  assert.throws(() => compareReport({ ...report, after: { ...report.after, definition: { suite: 'other' } } }));
  const md = [
    `| scripts/src/lib/*.ts 모듈 수 | 2 | 2 | measured |`,
    `| scripts/src/lib/*.ts 합계 줄 수 | 30 | 30 | measured |`,
    `| test/*.test.js 파일 수 | 4 | 4 | measured |`,
    `| test/*.test.js 합계 줄 수 | 50 | 50 | measured |`,
    `| coverage lines | 95% | 95% | measured |`,
    `| coverage branches | 85% | 85% | measured |`,
    `| coverage functions | 98% | 98% | measured |`,
    snapshot.revision, report.after.revision,
  ].join('\n');
  assert.equal(validateInventory(report, md), true);
  assert.throws(() => validateInventory(report, md.replace('| 30 | 30 |', '| 31 | 30 |')));
});
