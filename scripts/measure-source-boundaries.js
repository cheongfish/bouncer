'use strict';

const fs = require('node:fs');
const path = require('node:path');
const { spawnSync } = require('node:child_process');
const { performance } = require('node:perf_hooks');

const MODULES = ['coordinator', 'scope', 'finalize', 'verification', 'validate', 'measure-source-boundaries'];
const COVERAGE_ARGS = [
  '--experimental-test-coverage', '--test-coverage-include=packages/cli/dist/**',
  '--test-coverage-lines=94', '--test-coverage-branches=82', '--test-coverage-functions=96',
];

/** LF byte 기준으로 텍스트의 줄 수를 반환한다. CRLF도 LF 하나로 센다.
 * @param {string|Buffer} content - 측정할 파일 내용
 * @returns {number} LF 바이트 수
 */
function countLf(content) {
  const bytes = Buffer.isBuffer(content) ? content : Buffer.from(content);
  let count = 0;
  for (const byte of bytes) if (byte === 10) count += 1;
  return count;
}

/** 기존 리터럴 require 표기에서 scripts/lib 대상 이름을 중복 없이 정렬해 뽑는다.
 * @param {string} source - 테스트 소스
 * @returns {string[]} 고유 대상 basename 목록
 */
function directRequires(source) {
  return [...new Set([...source.matchAll(/require\(['"]\.\.\/packages\/cli\/dist\/([^'"/]+)['"]\)/g)].map((m) => m[1]))].sort();
}

/** 파일 목록의 기존 표 집계와 재귀 총량을 만든다.
 * @param {{path:string,content:string|Buffer}[]} files - 저장소 상대 경로와 파일 내용
 * @returns {object} 최상위·재귀 소스, 테스트, 직접 require 집계
 */
function summarizeInventory(files) {
  const source = files.filter((f) => /^packages\/cli\/src\/.*\.ts$/.test(f.path));
  const top = source.filter((f) => !f.path.slice('packages/cli/src/'.length).includes('/'));
  const tests = files.filter((f) => /^test\/[^/]+\.test\.js$/.test(f.path));
  const byTest = tests.map((f) => directRequires(String(f.content)));
  return {
    topLevel: { files: top.length, lines: top.reduce((n, f) => n + countLf(f.content), 0) },
    recursive: { files: source.length, lines: source.reduce((n, f) => n + countLf(f.content), 0) },
    test: { files: tests.length, lines: tests.reduce((n, f) => n + countLf(f.content), 0) },
    directRequireFiles: byTest.filter((a) => a.length).length,
    directRequireTargets: [...new Set(byTest.flat())].sort(),
  };
}

/** 테스트 파일을 동일한 정렬 규칙의 Node argv로 바꾼다.
 * @param {string[]} files - test/ 기준 파일 이름 목록
 * @param {boolean} coverage - coverage 옵션 포함 여부
 * @returns {string[]} 셸 없이 실행할 Node argv
 */
function buildTestArgv(files, coverage) {
  const suite = ['--test', ...files.slice().sort().map((f) => `test/${f}`)];
  return coverage ? [...COVERAGE_ARGS, '--test-reporter=tap', ...suite] : suite;
}

/** Node coverage의 단일 all-files 행을 검사한다.
 * @param {string} output - Node test runner 출력
 * @returns {{lines:number,branches:number,functions:number}} coverage 비율
 */
function parseCoverage(output) {
  const rows = output.split(/\r?\n/).filter((line) => /^#\s*all files\s*\|/i.test(line));
  if (rows.length !== 1) {
    throw new Error(`coverage summary must contain exactly one all files row (found ${rows.length})`);
  }
  const values = rows[0].split('|').slice(1, 4).map((value) => Number(value.trim().replace(/%$/, '')));
  if (values.length !== 3 || values.some((v) => !Number.isFinite(v) || v < 0 || v > 100)
      || values[0] < 94 || values[1] < 82 || values[2] < 96) {
    throw new Error(`coverage summary has invalid or below-threshold values: ${rows[0]}`);
  }
  return { lines: values[0], branches: values[1], functions: values[2] };
}

/** 독립 child의 성공 JSON만 받아 cache 오염과 실패 결과의 성공 오인을 막는다.
 * @param {string} command - 실행 파일
 * @param {string[]} args - 인자
 * @param {string} cwd - 자식 작업 디렉터리
 * @returns {unknown} stdout JSON
 */
function runProbe(command, args, cwd) {
  const result = spawnSync(command, args, { cwd, encoding: 'utf8', shell: false });
  if (result.error) throw new Error(`probe spawn failed: ${result.error.message}`);
  if (result.signal) throw new Error(`probe terminated by signal ${result.signal}`);
  if (result.status !== 0) throw new Error(`probe exit ${result.status}: ${result.stderr || result.stdout}`);
  try { return JSON.parse(result.stdout); } catch (error) {
    throw new Error(`probe returned invalid JSON: ${error.message}`, { cause: error });
  }
}

/** 두 snapshot의 실행 환경과 측정 정의를 비교한다.
 * @param {{before:object,after:object}} report - 비교 보고서
 * @returns {true} 계약이 맞으면 true
 */
function compareReport(report) {
  if (!report || !report.before || !report.after) throw new Error('report requires before and after snapshots');
  const { before, after } = report;
  const requiredKeys = [
    'schemaVersion', 'nodeMajor', 'nodePath', 'nodeVersion', 'npmVersion', 'platform', 'arch', 'definition',
  ];
  for (const key of requiredKeys) {
    if (JSON.stringify(before[key]) !== JSON.stringify(after[key])) throw new Error(`snapshot mismatch: ${key}`);
  }
  for (const snap of [before, after]) {
    if (snap.schemaVersion !== 1 || snap.nodeMajor !== 24 || !/^[0-9a-f]{40}$/.test(snap.revision || '')) {
      throw new Error('snapshot has unsupported schema, Node major, or unresolved revision');
    }
    if (snap.failures && snap.failures.length) throw new Error('report contains failed measurements');
    if (!snap.inventory || !snap.coverage || !snap.probes || !snap.counts || !snap.durationsMs || !snap.exitStatus) {
      throw new Error('snapshot is missing measured inventory, probes, counts, coverage, or timings');
    }
    const exits = [snap.exitStatus.build, snap.exitStatus.suite, snap.exitStatus.coverage, snap.exitStatus.npmTest];
    if (exits.some((code) => code !== 0)) {
      throw new Error('snapshot contains a failed command status');
    }
    const pcts = [snap.coverage.lines, snap.coverage.branches, snap.coverage.functions];
    if (pcts.some((n) => !Number.isFinite(n) || n < 0 || n > 100)) {
      throw new Error('snapshot contains invalid coverage values');
    }
  }
  return true;
}

/** 셸 없이 한 명령을 실행하고 벽시계 시간을 함께 측정한다.
 * @param {string} command - 실행 파일
 * @param {string[]} args - 인자 배열
 * @param {string} cwd - 명령 작업 디렉터리
 * @param {object} options - spawn 옵션 덮어쓰기
 * @returns {{result:object,durationMs:number}} 자식 결과와 경과 시간
 */
function run(command, args, cwd, options = {}) {
  const start = performance.now();
  const result = spawnSync(command, args, { cwd, encoding: 'utf8', shell: false, ...options });
  return { result, durationMs: Math.round(performance.now() - start) };
}

/** 명령 실패를 측정 산출물로 흘리지 않고 원인과 함께 중단한다.
 * @param {string} label - 오류 메시지에 표시할 단계
 * @param {{result:object}} measured - run 결과
 * @returns {object} 정상 종료한 spawn 결과
 */
function requireSuccess(label, measured) {
  const { result } = measured;
  if (result.error) throw new Error(`${label} spawn failed: ${result.error.message}`);
  if (result.signal) throw new Error(`${label} terminated by signal ${result.signal}`);
  if (result.status !== 0) throw new Error(`${label} exit ${result.status}: ${result.stderr || result.stdout}`);
  return result;
}

/** 지정 디렉터리의 파일을 재귀 열거한다.
 * @param {string} root - checkout 루트
 * @param {string} dir - 루트 기준 하위 경로
 * @returns {string[]} POSIX 형태 상대 경로
 */
function walk(root, dir) {
  const result = [];
  for (const entry of fs.readdirSync(path.join(root, dir), { withFileTypes: true })) {
    const rel = path.posix.join(dir, entry.name);
    if (entry.isDirectory()) result.push(...walk(root, rel));
    else if (entry.isFile()) result.push(rel);
  }
  return result;
}

/** 각 export probe를 새 Node 프로세스에서 수행하며 baseline의 신규 모듈만 absent로 허용한다.
 * @param {string} repo - checkout 루트
 * @param {string} mod - 측정 대상 모듈 이름
 * @returns {{status:string,exports?:string[],keys?:string[],cache?:string[]}} 적재 상태 및 관찰값
 */
function probeModule(repo, mod) {
  const rel = mod === 'measure-source-boundaries'
    ? 'scripts/measure-source-boundaries.js' : `packages/cli/dist/${mod}.js`;
  if (!fs.existsSync(path.join(repo, rel))) {
    if (mod === 'measure-source-boundaries') return { status: 'absent', exports: [] };
    throw new Error(`required probe module missing: ${rel}`);
  }
  const code = [
    `const p=require('node:path'); const m=require('./${rel}'); const keys=Object.keys(m).sort();`,
    " const cache=Object.keys(require.cache).filter(k=>k.includes(p.join('scripts','lib')+p.sep))",
    ".map(k=>p.relative(process.cwd(),k).split(p.sep).join('/')).sort();",
    ' console.log(JSON.stringify({keys,cache}));',
  ].join('');
  return { status: 'present', ...runProbe(process.execPath, ['-e', code], repo) };
}

/** 한 checkout을 동일한 build·suite·coverage·probe 프로토콜로 측정한다.
 * Node 24와 깨끗한 tracked source가 아니면 결과 파일을 쓰지 않는다.
 * @param {string} repo - 측정 checkout 절대 경로
 * @param {string} output - 원자적으로 쓸 JSON 경로
 * @returns {object} 저장한 schema version 1 snapshot
 */
function snapshot(repo, output) {
  const nodeMajor = Number(process.versions.node.split('.')[0]);
  if (nodeMajor !== 24) throw new Error(`Node major 24 required; found ${process.versions.node}`);
  const git = (args) => requireSuccess(`git ${args[0]}`, run('git', args, repo)).stdout.trim();
  const revision = git(['rev-parse', '--verify', 'HEAD^{commit}']);
  if (!/^[0-9a-f]{40}$/.test(revision)) throw new Error('revision is not a full commit SHA');
  const dirty = git(['status', '--porcelain', '--untracked-files=no', '--', 'packages/cli/src', 'test']);
  if (dirty) throw new Error(`tracked source is dirty:\n${dirty}`);

  const all = [...walk(repo, 'packages/cli/src'), ...walk(repo, 'test')];
  const files = all.filter((f) => f.endsWith('.ts') || f.endsWith('.js')).map((rel) => ({
    path: rel,
    content: fs.readFileSync(path.join(repo, rel)),
  }));
  const inventory = summarizeInventory(files);
  const suite = files.map((f) => f.path).filter((f) => /^test\/[^/]+\.test\.js$/.test(f)).map((f) => path.posix.basename(f)).sort();
  const npm = process.platform === 'win32' ? 'npm.cmd' : 'npm';
  const nodePath = process.execPath;
  const definition = {
    suite: 'sorted test/*.test.js', node: nodePath, coverage: COVERAGE_ARGS, thresholds: [94, 82, 96],
  };

  const build = run(npm, ['run', 'build'], repo);
  requireSuccess('build', build);
  const probes = {};
  for (const mod of MODULES) {
    probes[mod] = probeModule(repo, mod);
  }
  const runSuite = run(nodePath, buildTestArgv(suite, false), repo);
  const suiteResult = requireSuccess('suite', runSuite);
  const counts = Object.fromEntries(['tests', 'suites', 'pass', 'fail', 'cancelled', 'skipped', 'todo'].map((key) => {
    const match = suiteResult.stdout.match(new RegExp(`# ${key} ([0-9]+)`));
    return [key, match ? Number(match[1]) : 0];
  }));
  const coverageRun = run(nodePath, buildTestArgv(suite, true), repo);
  const coverageResult = requireSuccess('coverage', coverageRun);
  const coverage = parseCoverage(coverageResult.stdout);
  const npmVersion = requireSuccess('npm --version', run(npm, ['--version'], repo)).stdout.trim();
  const npmTest = run(npm, ['test'], repo);
  requireSuccess('npm test', npmTest);
  const data = {
    schemaVersion: 1, revision, nodePath, nodeVersion: process.version, nodeMajor,
    npmVersion, platform: process.platform, arch: process.arch, definition,
    inventory, suite, probes, counts, coverage,
    durationsMs: {
      build: build.durationMs, suite: runSuite.durationMs,
      coverage: coverageRun.durationMs, npmTest: npmTest.durationMs,
    },
    exitStatus: {
      build: build.result.status, suite: runSuite.result.status,
      coverage: coverageRun.result.status, npmTest: npmTest.result.status,
    },
    failures: [],
  };
  const temp = `${output}.${process.pid}.tmp`;
  fs.writeFileSync(temp, `${JSON.stringify(data, null, 2)}\n`, { flag: 'wx' });
  fs.renameSync(temp, output);
  return data;
}

/** 비교 보고서와 markdown inventory를 검증한다.
 * @param {string} reportPath - 비교 JSON 경로
 * @param {string} inventoryPath - inventory Markdown 경로
 * @returns {void} 모두 일치하면 반환하고 불일치는 예외로 거절한다
 */
function checkReport(reportPath, inventoryPath) {
  const report = JSON.parse(fs.readFileSync(reportPath, 'utf8'));
  compareReport(report);
  validateInventory(report, fs.readFileSync(inventoryPath, 'utf8'));
}

/** Markdown inventory의 표시값과 두 원본 snapshot을 필드별로 대조한다.
 * @param {object} report - before/after snapshot 비교 자료
 * @param {string} inventory - inventory markdown
 * @returns {true} 모든 표시값이 원본과 일치하면 true
 */
function validateInventory(report, inventory) {
  compareReport(report);
  if (/미측정/.test(inventory)) throw new Error('inventory still contains unmeasured values');
  const rows = new Map(inventory.split(/\r?\n/).filter((line) => /^\|/.test(line)).map((line) => {
    const cells = line.split('|').slice(1, -1).map((cell) => cell.trim().replace(/`/g, ''));
    return [cells[0], cells];
  }));
  const specs = [
    ['packages/cli/src/*.ts 모듈 수', (s) => s.inventory.topLevel.files],
    ['packages/cli/src/*.ts 합계 줄 수', (s) => s.inventory.topLevel.lines],
    ['test/*.test.js 파일 수', (s) => s.inventory.test.files],
    ['test/*.test.js 합계 줄 수', (s) => s.inventory.test.lines],
    ['coverage lines', (s) => `${s.coverage.lines}%`],
    ['coverage branches', (s) => `${s.coverage.branches}%`],
    ['coverage functions', (s) => `${s.coverage.functions}%`],
  ];
  for (const [label, valueOf] of specs) {
    const cells = rows.get(label);
    if (!cells || cells.length < 4) throw new Error(`inventory measurement row missing: ${label}`);
    for (const [index, snap] of [[1, report.before], [2, report.after]]) {
      if (String(cells[index]) !== String(valueOf(snap))) {
        throw new Error(`inventory ${label} does not match ${snap.revision}`);
      }
    }
  }
  if (!inventory.includes(report.before.revision) || !inventory.includes(report.after.revision)) {
    throw new Error('inventory does not contain both full measurement SHAs');
  }
  return true;
}

/** CLI 하위 명령을 실행하며 사용자 입력 및 측정 오류를 비0 종료로 노출한다.
 * @param {string[]} argv - 명령 이름과 플래그
 * @returns {void} 완료 또는 process.exitCode 설정
 */
function main(argv) {
  try {
    if (argv[0] === 'snapshot') {
      const repoAt = argv.indexOf('--repo'); const outAt = argv.indexOf('--output');
      if (repoAt < 0 || outAt < 0 || !argv[repoAt + 1] || !argv[outAt + 1]) {
        throw new Error('usage: snapshot --repo <checkout> --output <json>');
      }
      snapshot(path.resolve(argv[repoAt + 1]), path.resolve(argv[outAt + 1]));
    } else if (argv[0] === 'check-report') {
      const reportAt = argv.indexOf('--report'); const invAt = argv.indexOf('--inventory');
      if (reportAt < 0 || invAt < 0 || !argv[reportAt + 1] || !argv[invAt + 1]) {
        throw new Error('usage: check-report --report <comparison.json> --inventory <md>');
      }
      checkReport(path.resolve(argv[reportAt + 1]), path.resolve(argv[invAt + 1]));
    } else throw new Error('usage: snapshot|check-report');
  } catch (error) {
    process.stderr.write(`measure-source-boundaries: ${error.message}\n`);
    process.exitCode = 1;
  }
}

if (require.main === module) main(process.argv.slice(2));

module.exports = {
  countLf, directRequires, buildTestArgv, parseCoverage, runProbe, probeModule,
  summarizeInventory, compareReport, validateInventory,
};
