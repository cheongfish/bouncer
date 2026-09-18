'use strict';

const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { execFileSync, spawnSync } = require('node:child_process');

const { runCli } = require('../scripts/lib/cli');
const repoRoot = path.join(__dirname, '..');

/**
 * 격리된 Node process에서 CLI module cache를 관측한다. 같은 테스트 process의
 * require.cache는 이전 suite가 이미 intent를 적재했을 수 있어, lazy 경계를
 * 이 helper로만 고정한다.
 *
 * @param {string} source - cwd=repoRoot에서 실행할 -e 본문. 마지막에
 *   `{keys,code,out,err}` JSON을 stdout에 써야 한다.
 * @returns {{keys: string[], code: number|null, out: string, err: string}}
 */
function probeIntentCache(source) {
  const result = spawnSync(process.execPath, ['-e', source], {
    cwd: repoRoot,
    encoding: 'utf8',
    env: process.env,
  });
  assert.equal(result.status, 0, result.stderr || result.stdout);
  return JSON.parse(result.stdout);
}

const INTENT_CACHE_FILTER = `
  var keys = Object.keys(require.cache)
    .filter((p) => /\\/(symbol-index|intent-provenance|intent-bundle|cli-intent-command)\\.js$/.test(p))
    .map((p) => require('path').basename(p))
    .sort();
`;

const INTENT_RESOLVER_MODULES = [
  'intent-bundle.js',
  'intent-provenance.js',
  'symbol-index.js',
];

function capture(argv) {
  const buf = { out: '', err: '' };
  const code = runCli(argv, {
    out: (value) => { buf.out += value; },
    err: (value) => { buf.err += value; },
  });
  return { code, ...buf };
}

test('tracked active sources contain no retired Distill public surface', () => {
  // 과거 context 기록은 계약 대상이 아니다. 추적된 실행·배포 source와 예제 설정만
  // 검사해, 역사 문서의 언급 때문에 재도입 방지 검사가 흔들리지 않게 한다.
  const retired = ['d', 'istill'].join('');
  const tracked = execFileSync('git', [
    'ls-files', '--',
    'scripts/src/lib/layout.ts',
    'scripts/lib/layout.js',
    'scripts/src/lib/config.ts',
    'scripts/lib/config.js',
    'scripts/src/lib/cli-project-commands.ts',
    'scripts/lib/cli-project-commands.js',
    'scripts/src/lib/cli.ts',
    'scripts/lib/cli.js',
    'scripts/src/lib/validate-structural.ts',
    'scripts/lib/validate-structural.js',
    'scripts/src/lib/validate.ts',
    'scripts/lib/validate.js',
    'config.example.json',
  ], { cwd: path.join(__dirname, '..'), encoding: 'utf8' })
    .trim()
    .split('\n')
    .filter(Boolean);
  const matches = tracked.filter((rel) => new RegExp(retired, 'i').test(
    fs.readFileSync(path.join(__dirname, '..', rel), 'utf8'),
  ));

  assert.deepStrictEqual(matches, []);
});

test('retired distill command is rejected', () => {
  const retired = capture([['d', 'istill'].join('')]);
  assert.strictEqual(retired.code, 2);
  assert.match(retired.err, /unknown command/);
});

function tmpRoot() {
  return fs.realpathSync(os.tmpdir());
}

test('init --upgrade-graphify exposes the upgrade payload', () => {
  const repo = fs.mkdtempSync(path.join(tmpRoot(), 'bouncer-cli-upgrade-'));
  execFileSync('git', ['init'], { cwd: repo, stdio: 'ignore' });
  const first = capture(['init', '--repo', repo, '--no-graphify']);
  assert.strictEqual(first.code, 0);
  const lockPath = path.join(repo, '.bouncer', 'graphify.lock.json');
  const stale = {
    schema_version: 1,
    package: 'graphifyy',
    package_version: '0.8.0',
    cli_version: '0.8.0',
    bouncer_version: '1.0.0',
    graph_schema_version: '0',
    installed_at: '2026-01-01T00:00:00.000+09:00',
  };
  fs.writeFileSync(lockPath, `${JSON.stringify(stale, null, 2)}\n`);
  const available = capture(['init', '--repo', repo, '--no-graphify']);
  assert.strictEqual(available.code, 0);
  assert.strictEqual(JSON.parse(available.out).graphifyUpgradeAvailable, true);

  const commonDir = execFileSync('git', ['rev-parse', '--git-common-dir'], {
    cwd: repo, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'],
  }).trim();
  const lockDir = path.join(path.resolve(repo, commonDir), 'bouncer');
  fs.mkdirSync(lockDir, { recursive: true });
  fs.writeFileSync(path.join(lockDir, 'upgrade.lock'), 'held');
  const before = fs.readFileSync(lockPath);
  const upgrade = capture(['init', '--repo', repo, '--upgrade-graphify']);
  const payload = JSON.parse(upgrade.out);
  assert.ok(payload.graphifyUpgrade);
  assert.strictEqual(payload.graphifyUpgrade.status, 'failed');
  assert.deepStrictEqual(fs.readFileSync(lockPath), before);
});

test('init help names --upgrade-graphify', () => {
  const result = capture(['help']);
  assert.strictEqual(result.code, 0);
  assert.match(result.out, /upgrade-graphify/);
});

test('graph-sync records version-incompatible without installing', () => {
  const repo = fs.mkdtempSync(path.join(tmpRoot(), 'bouncer-cli-sync-incompat-'));
  execFileSync('git', ['init'], { cwd: repo, stdio: 'ignore' });
  assert.strictEqual(capture(['init', '--repo', repo, '--no-graphify']).code, 0);
  const binRel = 'tools/graphify';
  fs.mkdirSync(path.join(repo, 'tools'));
  fs.writeFileSync(path.join(repo, binRel), '');
  const cfgPath = path.join(repo, '.bouncer', 'config.json');
  const cfg = JSON.parse(fs.readFileSync(cfgPath, 'utf8'));
  cfg.graphify = { ...(cfg.graphify || {}), enabled: true, bin: binRel };
  fs.writeFileSync(cfgPath, `${JSON.stringify(cfg, null, 2)}\n`);
  fs.writeFileSync(path.join(repo, '.bouncer', 'graphify.lock.json'), `${JSON.stringify({
    schema_version: 1,
    package: 'graphifyy',
    package_version: '0.8.0',
    cli_version: '0.8.0',
    bouncer_version: '1.0.0',
    graph_schema_version: '0',
    installed_at: '2026-01-01T00:00:00.000+09:00',
  }, null, 2)}\n`);
  const result = capture(['graph-sync', '--repo', repo]);
  const payload = JSON.parse(result.out);
  assert.strictEqual(payload.status, 'version-incompatible');
  assert.strictEqual(payload.action, 'skip-version-incompatible');
  assert.ok(!fs.existsSync(path.join(repo, '.bouncer/.venv')));
});

function intentGit(repo, args, extraEnv = {}) {
  return execFileSync('git', args, {
    cwd: repo,
    encoding: 'utf8',
    env: {
      ...process.env,
      GIT_CONFIG_NOSYSTEM: '1',
      GIT_AUTHOR_NAME: 'bouncer-test',
      GIT_AUTHOR_EMAIL: 't@example.com',
      GIT_COMMITTER_NAME: 'bouncer-test',
      GIT_COMMITTER_EMAIL: 't@example.com',
      ...extraEnv,
    },
    stdio: ['ignore', 'pipe', 'pipe'],
  });
}

function intentRepo() {
  const repo = fs.mkdtempSync(path.join(tmpRoot(), 'bouncer-cli-intent-'));
  intentGit(repo, ['init', '-b', 'main']);
  return repo;
}

function writeIntentFile(repo, rel, content) {
  const abs = path.join(repo, rel);
  fs.mkdirSync(path.dirname(abs), { recursive: true });
  fs.writeFileSync(abs, content);
}

function commitIntent(repo, message) {
  intentGit(repo, ['add', '-A']);
  intentGit(repo, ['-c', 'commit.gpgsign=false', 'commit', '-m', message], {
    GIT_AUTHOR_DATE: '2026-01-01T00:00:00 +0900',
    GIT_COMMITTER_DATE: '2026-01-01T00:00:00 +0900',
  });
  return intentGit(repo, ['rev-parse', 'HEAD']).trim();
}

function writeIntentExplain(repo, sha8) {
  const rel = '.bouncer/context/epics/071-epic/blueprints/002-bp/explain.md';
  writeIntentFile(repo, rel, [
    '---',
    'type: bouncer.explain',
    'title: fixture',
    'description: fixture',
    `resource: ${rel}`,
    'tags: [bouncer]',
    "timestamp: '2026-09-14T00:00:00+09:00'",
    'bouncer:',
    '  id: EXPLAIN-001',
    "  epic_id: '071'",
    "  blueprint_id: '002'",
    '  status: published',
    '  task_commits:',
    '    - task: "EPIC-071/BP-002/TASK-001"',
    '      sha: "' + sha8 + '"',
    '      intent_anchor: task-001',
    '---',
    '# Explain',
    '',
    '## Background',
    '',
    'approved function intent',
    '',
    '## Intuition',
    '',
    'stable task id is the join key',
    '',
    '## Code',
    '',
    'src/app.ts targetFn',
    '',
  ].join('\n'));
  return rel;
}

test('intent returns resolved JSON and exit 0 for a linked function', () => {
  const repo = intentRepo();
  writeIntentFile(repo, 'src/app.ts', 'export function targetFn() { return 1; }\n');
  const sha = commitIntent(
    repo,
    'feat: add targetFn\n\nBouncer-Task: EPIC-071/BP-002/TASK-001\nBouncer-Intent: EPIC-071/BP-002\n',
  );
  writeIntentExplain(repo, sha.slice(0, 8));

  const result = capture(['intent', '--repo', repo, '--symbol', 'targetFn']);
  assert.equal(result.code, 0);
  assert.equal(result.err, '');
  const payload = JSON.parse(result.out);
  assert.equal(payload.status, 'resolved');
  assert.equal(payload.symbol, 'targetFn');
  assert.equal(payload.symbol_ref.path, 'src/app.ts');
  assert.ok(Array.isArray(payload.candidates));
  assert.ok(payload.candidates.length >= 1);
  assert.equal(payload.candidates[0].task, 'EPIC-071/BP-002/TASK-001');
  assert.equal(typeof payload.truncated, 'boolean');

  const limited = capture(['intent', '--repo', repo, '--symbol', 'targetFn', '--limit', '1']);
  assert.equal(limited.code, 0);
  assert.ok(JSON.parse(limited.out).candidates.length <= 1);
});

test('intent returns exit-0 JSON for ambiguous, unresolved, and unlinked statuses', () => {
  const ambiguousRepo = intentRepo();
  writeIntentFile(ambiguousRepo, 'src/one.ts', 'export function shared() { return 1; }\n');
  writeIntentFile(ambiguousRepo, 'src/two.ts', 'export function shared() { return 2; }\n');
  commitIntent(ambiguousRepo, 'feat: two shared defs\n');
  const ambiguous = capture(['intent', '--repo', ambiguousRepo, '--symbol', 'shared']);
  assert.equal(ambiguous.code, 0);
  assert.equal(ambiguous.err, '');
  const ambiguousPayload = JSON.parse(ambiguous.out);
  assert.equal(ambiguousPayload.status, 'ambiguous');
  assert.ok(ambiguousPayload.candidates.length >= 2);
  assert.equal(typeof ambiguousPayload.candidates[0].candidate_ref, 'string');

  const chosen = capture([
    'intent', '--repo', ambiguousRepo, '--symbol', 'shared',
    '--candidate', ambiguousPayload.candidates[0].candidate_ref,
  ]);
  assert.equal(chosen.code, 0);
  const chosenPayload = JSON.parse(chosen.out);
  assert.ok(chosenPayload.status === 'resolved' || chosenPayload.status === 'unlinked');

  const unresolvedRepo = intentRepo();
  writeIntentFile(unresolvedRepo, 'src/keep.ts', 'export function keep() { return 1; }\n');
  commitIntent(unresolvedRepo, 'feat: keep\n');
  const unresolved = capture(['intent', '--repo', unresolvedRepo, '--symbol', 'neverDefined']);
  assert.equal(unresolved.code, 0);
  assert.equal(unresolved.err, '');
  assert.equal(JSON.parse(unresolved.out).status, 'unresolved');

  const unlinkedRepo = intentRepo();
  writeIntentFile(unlinkedRepo, 'src/app.ts', 'export function targetFn() { return 1; }\n');
  commitIntent(unlinkedRepo, 'feat: unlinked targetFn\n');
  const unlinked = capture(['intent', '--repo', unlinkedRepo, '--symbol', 'targetFn']);
  assert.equal(unlinked.code, 0);
  assert.equal(unlinked.err, '');
  assert.equal(JSON.parse(unlinked.out).status, 'unlinked');
});

test('intent rejects missing, empty, invalid, duplicate, and unknown argv with exit 2', () => {
  for (const args of [
    [],
    ['--symbol', ''],
    ['--symbol', '   '],
    ['--symbol'],
    ['--symbol', 'fn', '--candidate'],
    ['--symbol', 'fn', '--candidate', ''],
    ['--symbol', 'fn', '--limit'],
    ['--symbol', 'fn', '--limit', '0'],
    ['--symbol', 'fn', '--limit', '6'],
    ['--symbol', 'fn', '--limit', 'abc'],
    ['--symbol', 'fn', '--limit', '1.5'],
    ['--symbol', 'fn', '--symbol', 'fn'],
    ['--symbol', 'fn', '--limit', '1', '--limit', '2'],
    ['--symbol', 'fn', '--candidate', 'ref', '--candidate', 'ref'],
    ['--symbol', 'fn', '--repo', '.', '--repo', '.'],
    ['--symbol', 'fn', '--unknown'],
    ['--symbol', 'fn', 'positional'],
    ['--symbol', 'fn', '--repo'],
  ]) {
    const result = capture(['intent', ...args]);
    assert.equal(result.code, 2, args.join(' '));
    assert.equal(result.out, '');
    assert.match(result.err, /^intent:/);
  }
});

test('CLI require, help, and a non-intent command leave intent modules out of require.cache', () => {
  // require·help·대표 일반 명령은 projectCommands만 타야 한다. intent-provenance와
  // symbol-index가 여기에 있으면 정적 import 회귀다.
  const cold = probeIntentCache(`
    'use strict';
    require('./scripts/lib/cli');
    ${INTENT_CACHE_FILTER}
    const afterRequire = keys.slice();
    const { runCli } = require('./scripts/lib/cli');
    const sink = { out() {}, err() {} };
    runCli(['help'], sink);
    ${INTENT_CACHE_FILTER}
    const afterHelp = keys.slice();
    runCli(['graphify-bin'], sink);
    ${INTENT_CACHE_FILTER}
    process.stdout.write(JSON.stringify({
      afterRequire, afterHelp, afterGeneral: keys, code: null, out: '', err: '',
    }));
  `);
  for (const label of ['afterRequire', 'afterHelp', 'afterGeneral']) {
    assert.deepStrictEqual(
      cold[label].filter((name) => INTENT_RESOLVER_MODULES.includes(name)),
      [],
      label,
    );
  }
});

test('valid intent dispatch loads dedicated command and provenance modules once', () => {
  const repo = intentRepo();
  writeIntentFile(repo, 'src/app.ts', 'export function targetFn() { return 1; }\n');
  const sha = commitIntent(
    repo,
    'feat: add targetFn\n\nBouncer-Task: EPIC-071/BP-002/TASK-001\nBouncer-Intent: EPIC-071/BP-002\n',
  );
  writeIntentExplain(repo, sha.slice(0, 8));

  const warm = probeIntentCache(`
    'use strict';
    const { runCli } = require('./scripts/lib/cli');
    let out = '';
    let err = '';
    const code = runCli(
      ${JSON.stringify(['intent', '--repo', repo, '--symbol', 'targetFn'])},
      { out: (s) => { out += s; }, err: (s) => { err += s; } },
    );
    ${INTENT_CACHE_FILTER}
    process.stdout.write(JSON.stringify({ keys, code, out, err }));
  `);
  assert.equal(warm.code, 0);
  assert.equal(warm.err, '');
  const payload = JSON.parse(warm.out);
  assert.equal(payload.status, 'resolved');
  assert.equal(payload.symbol, 'targetFn');
  assert.ok(warm.keys.includes('cli-intent-command.js'));
  assert.ok(warm.keys.includes('intent-provenance.js'));
  assert.ok(warm.keys.includes('symbol-index.js'));
});

test('rejected intent argv exits 2 without loading provenance or symbol-index', () => {
  // 값 없음·중복 option은 파서가 exit 2로 끝낸다. 이 경로에서 resolver를
  // require하면 lazy 경계가 깨진 것이다.
  for (const args of [
    ['intent'],
    ['intent', '--symbol'],
    ['intent', '--symbol', 'fn', '--symbol', 'fn'],
    ['intent', '--symbol', 'fn', '--limit', '1', '--limit', '2'],
    ['intent', '--symbol', 'fn', '--repo'],
  ]) {
    const rejected = probeIntentCache(`
      'use strict';
      const { runCli } = require('./scripts/lib/cli');
      let out = '';
      let err = '';
      const code = runCli(
        ${JSON.stringify(args)},
        { out: (s) => { out += s; }, err: (s) => { err += s; } },
      );
      ${INTENT_CACHE_FILTER}
      process.stdout.write(JSON.stringify({ keys, code, out, err }));
    `);
    assert.equal(rejected.code, 2, args.join(' '));
    assert.equal(rejected.out, '');
    assert.match(rejected.err, /^intent:/);
    for (const name of INTENT_RESOLVER_MODULES) {
      assert.ok(!rejected.keys.includes(name), `${args.join(' ')} loads ${name}`);
    }
  }
});

test('intent reports resolver Git and filesystem errors on stderr with exit 1', () => {
  const missingGit = fs.mkdtempSync(path.join(tmpRoot(), 'bouncer-cli-intent-nogit-'));
  writeIntentFile(missingGit, 'src/app.ts', 'export function targetFn() { return 1; }\n');
  const gitFail = capture(['intent', '--repo', missingGit, '--symbol', 'targetFn']);
  assert.equal(gitFail.code, 1);
  assert.equal(gitFail.out, '');
  assert.match(gitFail.err, /^intent:/);
  assert.match(gitFail.err, /git/i);

  const missingDir = path.join(tmpRoot(), `bouncer-cli-intent-missing-${process.pid}`);
  const fsFail = capture(['intent', '--repo', missingDir, '--symbol', 'targetFn']);
  assert.equal(fsFail.code, 1);
  assert.equal(fsFail.out, '');
  assert.match(fsFail.err, /^intent:/);
});

test('intent reports unknown --candidate on stderr with exit 1 and empty stdout', () => {
  // 파서는 비어 있지 않은 opaque ref를 통과시킨다. 발급되지 않은 값은
  // resolver가 던지므로 Git 부재와 같은 runtime 실패(exit 1)다. 부분 JSON을
  // 남기지 않는 계약은 여기만 덮는다 — empty --candidate는 이미 exit 2.
  const repo = intentRepo();
  writeIntentFile(repo, 'src/app.ts', 'export function targetFn() { return 1; }\n');
  commitIntent(repo, 'feat: add targetFn\n');

  const result = capture([
    'intent', '--repo', repo, '--symbol', 'targetFn', '--candidate', 'not-a-real-ref',
  ]);
  assert.equal(result.code, 1);
  assert.equal(result.out, '');
  assert.match(result.err, /^intent:/);
});

function intentBundleTaskRel(epic = '073', bp = '001', task = '001') {
  return `.bouncer/context/epics/${epic}-epic/blueprints/${bp}-bp/tasks/${task}/tasks.md`;
}

function writeIntentBundleTask(repo, {
  epic = '073',
  bp = '001',
  task = '001',
  body = 'Goal for targetFn provenance reuse.\n',
} = {}) {
  const rel = intentBundleTaskRel(epic, bp, task);
  writeIntentFile(repo, rel, [
    '---',
    'type: bouncer.tasks',
    'title: fixture',
    'description: fixture',
    `resource: ${rel}`,
    'tags: [bouncer]',
    "timestamp: '2026-09-17T00:00:00+09:00'",
    'bouncer:',
    `  id: TASKS-${task}`,
    `  epic_id: '${epic}'`,
    `  blueprint_id: '${bp}'`,
    '  status: ready',
    '---',
    '# Tasks',
    '',
    body,
    '',
  ].join('\n'));
  return rel;
}

function seedIntentBundleRepo(bodyLine = 1) {
  const repo = intentRepo();
  writeIntentFile(repo, 'src/app.ts', [
    'export function targetFn() {',
    `  return ${bodyLine};`,
    '}',
    '',
  ].join('\n'));
  const sha = commitIntent(
    repo,
    'feat: add targetFn\n\nBouncer-Task: EPIC-071/BP-002/TASK-001\nBouncer-Intent: EPIC-071/BP-002\n',
  );
  writeIntentExplain(repo, sha.slice(0, 8));
  const taskFile = writeIntentBundleTask(repo);
  return { repo, sha, taskFile };
}

function intentBundleRecordPath(repo, taskFile) {
  const { intentBundlePathFor } = require('../scripts/lib/runtime-state');
  const located = intentBundlePathFor({
    repoRoot: repo,
    taskRel: taskFile,
    deps: { execFileSync },
  });
  return located.intentFile;
}

test('intent help names both query and bundle forms', () => {
  const result = capture(['help']);
  assert.strictEqual(result.code, 0);
  assert.match(result.out, /intent\s+--symbol/);
  assert.match(result.out, /intent\s+bundle --task/);
});

test('intent bundle creates then reuses the same bundle_id and revision', () => {
  const { repo, taskFile } = seedIntentBundleRepo();
  const first = capture([
    'intent', 'bundle', '--repo', repo, '--task', taskFile, '--symbol', 'targetFn',
  ]);
  assert.equal(first.code, 0);
  assert.equal(first.err, '');
  const created = JSON.parse(first.out);
  assert.equal(created.status, 'created');
  assert.match(created.bundle_id, /^[a-f0-9]{64}$/);
  assert.equal(created.revision, 1);
  assert.equal(created.task, 'EPIC-073/BP-001/TASK-001');

  const second = capture([
    'intent', 'bundle', '--repo', repo, '--task', taskFile, '--symbol', 'targetFn',
  ]);
  assert.equal(second.code, 0);
  assert.equal(second.err, '');
  const reused = JSON.parse(second.out);
  assert.equal(reused.status, 'reused');
  assert.equal(reused.bundle_id, created.bundle_id);
  assert.equal(reused.revision, created.revision);
});

test('intent bundle bumps revision when function body, Explain section, or set changes', () => {
  const { repo, taskFile } = seedIntentBundleRepo(1);
  const base = capture([
    'intent', 'bundle', '--repo', repo, '--task', taskFile, '--symbol', 'targetFn',
  ]);
  assert.equal(base.code, 0);
  const basePayload = JSON.parse(base.out);
  assert.equal(basePayload.revision, 1);

  writeIntentFile(repo, 'src/app.ts', [
    'export function targetFn() {',
    '  return 2;',
    '}',
    '',
  ].join('\n'));
  commitIntent(
    repo,
    'feat: retarget body\n\nBouncer-Task: EPIC-071/BP-002/TASK-001\nBouncer-Intent: EPIC-071/BP-002\n',
  );
  const afterBlob = capture([
    'intent', 'bundle', '--repo', repo, '--task', taskFile, '--symbol', 'targetFn',
  ]);
  assert.equal(afterBlob.code, 0);
  const afterBlobPayload = JSON.parse(afterBlob.out);
  assert.equal(afterBlobPayload.status, 'created');
  assert.notEqual(afterBlobPayload.bundle_id, basePayload.bundle_id);
  assert.equal(afterBlobPayload.revision, 2);

  writeIntentFile(repo, 'src/other.ts', 'export function otherFn() { return 1; }\n');
  commitIntent(
    repo,
    'feat: add otherFn\n\nBouncer-Task: EPIC-071/BP-002/TASK-002\nBouncer-Intent: EPIC-071/BP-002\n',
  );
  const afterSet = capture([
    'intent', 'bundle', '--repo', repo, '--task', taskFile,
    '--symbol', 'targetFn', '--symbol', 'otherFn',
  ]);
  assert.equal(afterSet.code, 0);
  const afterSetPayload = JSON.parse(afterSet.out);
  assert.equal(afterSetPayload.status, 'created');
  assert.notEqual(afterSetPayload.bundle_id, afterBlobPayload.bundle_id);
  assert.equal(afterSetPayload.revision, 3);

  const sha = intentGit(repo, ['rev-parse', 'HEAD']).trim();
  writeIntentExplain(repo, sha.slice(0, 8));
  // Explain Background를 바꿔 section hash miss를 강제한다.
  const explainRel = '.bouncer/context/epics/071-epic/blueprints/002-bp/explain.md';
  const explainBody = fs.readFileSync(path.join(repo, explainRel), 'utf8')
    .replace('approved function intent', 'rewritten background for cache miss');
  fs.writeFileSync(path.join(repo, explainRel), explainBody);
  const afterExplain = capture([
    'intent', 'bundle', '--repo', repo, '--task', taskFile,
    '--symbol', 'targetFn', '--symbol', 'otherFn',
  ]);
  assert.equal(afterExplain.code, 0);
  const afterExplainPayload = JSON.parse(afterExplain.out);
  assert.equal(afterExplainPayload.status, 'created');
  assert.notEqual(afterExplainPayload.bundle_id, afterSetPayload.bundle_id);
  assert.equal(afterExplainPayload.revision, 4);
});

test('intent bundle returns ambiguous candidates without writing a record', () => {
  const repo = intentRepo();
  writeIntentFile(repo, 'src/one.ts', 'export function shared() { return 1; }\n');
  writeIntentFile(repo, 'src/two.ts', 'export function shared() { return 2; }\n');
  commitIntent(repo, 'feat: two shared defs\n');
  const taskFile = writeIntentBundleTask(repo);
  const recordPath = intentBundleRecordPath(repo, taskFile);

  const ambiguous = capture([
    'intent', 'bundle', '--repo', repo, '--task', taskFile, '--symbol', 'shared',
  ]);
  assert.equal(ambiguous.code, 0);
  assert.equal(ambiguous.err, '');
  const payload = JSON.parse(ambiguous.out);
  assert.equal(payload.status, 'ambiguous');
  assert.equal(payload.symbol, 'shared');
  assert.ok(payload.candidates.length >= 2);
  assert.equal(typeof payload.candidates[0].candidate_ref, 'string');
  assert.equal(fs.existsSync(recordPath), false);

  const chosen = capture([
    'intent', 'bundle', '--repo', repo, '--task', taskFile,
    '--symbol', 'shared', '--candidate', payload.candidates[0].candidate_ref,
  ]);
  assert.equal(chosen.code, 0);
  const chosenPayload = JSON.parse(chosen.out);
  assert.ok(chosenPayload.status === 'created' || chosenPayload.status === 'reused');
  assert.ok(fs.existsSync(recordPath));
});

test('intent bundle rejects malformed argv with exit 2 and empty stdout', () => {
  const task = intentBundleTaskRel();
  for (const args of [
    ['bundle'],
    ['bundle', '--task', task],
    ['bundle', '--symbol', 'fn'],
    ['bundle', '--task', '', '--symbol', 'fn'],
    ['bundle', '--task', '   ', '--symbol', 'fn'],
    ['bundle', '--task', 'docs/tasks.md', '--symbol', 'fn'],
    ['bundle', '--task', task, '--symbol', ''],
    ['bundle', '--task', task, '--symbol'],
    ['bundle', '--task', task, '--candidate', 'ref'],
    ['bundle', '--task', task, '--symbol', 'fn', '--candidate'],
    ['bundle', '--task', task, '--symbol', 'fn', '--candidate', ''],
    ['bundle', '--task', task, '--symbol', 'fn', '--candidate', 'a', '--candidate', 'b'],
    ['bundle', '--task', task, '--symbol', 'fn', '--symbol', 'fn'],
    ['bundle', '--task', task, '--symbol', 'fn', '--limit', '3'],
    ['bundle', '--task', task, '--symbol', 'fn', '--unknown'],
    ['bundle', '--task', task, '--symbol', 'fn', 'positional'],
    ['bundle', '--task', task, '--task', task, '--symbol', 'fn'],
    ['bundle', '--task', task, '--symbol', 'fn', '--repo'],
    ['not-bundle', '--task', task, '--symbol', 'fn'],
  ]) {
    const result = capture(['intent', ...args]);
    assert.equal(result.code, 2, args.join(' '));
    assert.equal(result.out, '');
    assert.match(result.err, /^intent:/);
  }
});

test('intent bundle Git and resolver failures leave empty stdout and no record', () => {
  const missingGit = fs.mkdtempSync(path.join(tmpRoot(), 'bouncer-cli-bundle-nogit-'));
  writeIntentFile(missingGit, 'src/app.ts', 'export function targetFn() { return 1; }\n');
  const taskFile = writeIntentBundleTask(missingGit);
  const gitFail = capture([
    'intent', 'bundle', '--repo', missingGit, '--task', taskFile, '--symbol', 'targetFn',
  ]);
  assert.equal(gitFail.code, 1);
  assert.equal(gitFail.out, '');
  assert.match(gitFail.err, /^intent:/);

  const { repo, taskFile: okTask } = seedIntentBundleRepo();
  const boom = capture([
    'intent', 'bundle', '--repo', repo, '--task', okTask,
    '--symbol', 'targetFn', '--candidate', 'not-a-real-ref',
  ]);
  assert.equal(boom.code, 1);
  assert.equal(boom.out, '');
  assert.match(boom.err, /^intent:/);
  assert.equal(fs.existsSync(intentBundleRecordPath(repo, okTask)), false);
});

test('intent bundle ambiguous recovery maps secondary resolver throw to exit 1', () => {
  // ambiguous 본 경로에서 2차 resolveIntentProvenance가 던지면 미처리 예외가
  // 아니라 다른 조회 실패와 같은 stderr+1·빈 stdout이어야 한다(CT-001).
  const task = intentBundleTaskRel();
  const probed = spawnSync(process.execPath, ['-e', `
    'use strict';
    const Module = require('module');
    const path = require('path');
    const origLoad = Module._load;
    Module._load = function(request, parent, isMain) {
      const resolved = Module._resolveFilename(request, parent, isMain);
      if (resolved.endsWith(path.sep + 'intent-bundle.js')) {
        return {
          resolveTaskIntentBundle() {
            throw new Error('ambiguous symbol requires candidate ref: shared');
          },
        };
      }
      if (resolved.endsWith(path.sep + 'intent-provenance.js')) {
        return {
          resolveIntentProvenance() {
            throw new Error('secondary provenance boom');
          },
        };
      }
      return origLoad.apply(this, arguments);
    };
    const { runCli } = require('./scripts/lib/cli');
    let out = '';
    let err = '';
    let code = 0;
    let threw = null;
    try {
      code = runCli(
        ['intent', 'bundle', '--repo', '.', '--task', ${JSON.stringify(task)}, '--symbol', 'shared'],
        { out: (s) => { out += s; }, err: (s) => { err += s; } },
      );
    } catch (error) {
      threw = error && error.message ? error.message : String(error);
    }
    process.stdout.write(JSON.stringify({ code, out, err, threw }));
  `], {
    cwd: repoRoot,
    encoding: 'utf8',
    env: process.env,
  });
  assert.equal(probed.status, 0, probed.stderr || probed.stdout);
  const result = JSON.parse(probed.stdout);
  assert.equal(result.threw, null);
  assert.equal(result.code, 1);
  assert.equal(result.out, '');
  assert.match(result.err, /^intent: secondary provenance boom\n$/);
});

test('rejected intent bundle argv exits 2 without loading resolver modules', () => {
  const task = intentBundleTaskRel();
  for (const args of [
    ['intent', 'bundle'],
    ['intent', 'bundle', '--task', task],
    ['intent', 'bundle', '--task', task, '--symbol', 'fn', '--limit', '1'],
    ['intent', 'bundle', '--task', 'docs/x.md', '--symbol', 'fn'],
    ['intent', 'not-bundle', '--task', task, '--symbol', 'fn'],
  ]) {
    const rejected = probeIntentCache(`
      'use strict';
      const { runCli } = require('./scripts/lib/cli');
      let out = '';
      let err = '';
      const code = runCli(
        ${JSON.stringify(args)},
        { out: (s) => { out += s; }, err: (s) => { err += s; } },
      );
      ${INTENT_CACHE_FILTER}
      process.stdout.write(JSON.stringify({ keys, code, out, err }));
    `);
    assert.equal(rejected.code, 2, args.join(' '));
    assert.equal(rejected.out, '');
    assert.match(rejected.err, /^intent:/);
    for (const name of INTENT_RESOLVER_MODULES) {
      assert.ok(!rejected.keys.includes(name), `${args.join(' ')} loads ${name}`);
    }
  }
});

test('valid intent bundle dispatch loads bundle and provenance modules', () => {
  const { repo, taskFile } = seedIntentBundleRepo();
  const warm = probeIntentCache(`
    'use strict';
    const { runCli } = require('./scripts/lib/cli');
    let out = '';
    let err = '';
    const code = runCli(
      ${JSON.stringify([
    'intent', 'bundle', '--repo', repo, '--task', taskFile, '--symbol', 'targetFn',
  ])},
      { out: (s) => { out += s; }, err: (s) => { err += s; } },
    );
    ${INTENT_CACHE_FILTER}
    process.stdout.write(JSON.stringify({ keys, code, out, err }));
  `);
  assert.equal(warm.code, 0);
  assert.equal(warm.err, '');
  const payload = JSON.parse(warm.out);
  assert.equal(payload.status, 'created');
  assert.ok(warm.keys.includes('cli-intent-command.js'));
  assert.ok(warm.keys.includes('intent-bundle.js'));
  assert.ok(warm.keys.includes('intent-provenance.js'));
  assert.ok(warm.keys.includes('symbol-index.js'));
});

function writeSuggestGraphs(repo) {
  const sourceDir = path.join(repo, 'graphify-out', 'source');
  const testDir = path.join(repo, 'graphify-out', 'test');
  fs.mkdirSync(sourceDir, { recursive: true });
  fs.mkdirSync(testDir, { recursive: true });
  fs.mkdirSync(path.join(repo, '.bouncer'), { recursive: true });
  fs.writeFileSync(path.join(repo, '.bouncer/config.json'), JSON.stringify({
    source_dirs: ['src'],
    verify: 'npm test',
    base_branch: 'main',
    graphify: { enabled: true, test_dirs: ['test'], exclude_dirs: [] },
  }));
  fs.writeFileSync(path.join(sourceDir, 'graph.json'), JSON.stringify({
    nodes: [
      { id: 'f', label: 'owner.ts', source_file: 'src/owner.ts' },
      { id: 's', label: 'CliDbgSym', source_file: 'src/owner.ts' },
      { id: 'n', label: 'nbr.ts', source_file: 'src/nbr.ts' },
      { id: 'c', label: 'callFrom', source_file: 'src/nbr.ts' },
    ],
    links: [
      { relation: 'contains', source: 'n', target: 'c', source_file: 'src/nbr.ts' },
      { relation: 'calls', source: 'c', target: 's', source_file: 'src/nbr.ts' },
      { relation: 'imports', source: 'c', target: 'f', source_file: 'src/nbr.ts' },
    ],
  }));
  fs.writeFileSync(path.join(testDir, 'graph.json'), JSON.stringify({
    nodes: [
      { id: 'tf', label: 'owner.test.js', source_file: 'test/owner.test.js' },
      { id: 'ts', label: 'covers', source_file: 'test/owner.test.js' },
    ],
    links: [
      { relation: 'contains', source: 'tf', target: 'ts', source_file: 'test/owner.test.js' },
      { relation: 'calls', source: 'ts', target: 's', source_file: 'test/owner.test.js' },
    ],
  }));
}

test('graph-suggest --debug succeeds and keeps default fields identical', () => {
  const repo = fs.mkdtempSync(path.join(tmpRoot(), 'bouncer-cli-gsuggest-'));
  writeSuggestGraphs(repo);
  const plain = capture([
    'graph-suggest', '--repo', repo, '--query', 'CliDbgSym', '--seed', 'CliDbgSym',
  ]);
  assert.equal(plain.code, 0);
  const withDebug = capture([
    'graph-suggest', '--repo', repo, '--query', 'CliDbgSym', '--seed', 'CliDbgSym', '--debug',
  ]);
  assert.equal(withDebug.code, 0);
  const plainJson = JSON.parse(plain.out);
  const debugJson = JSON.parse(withDebug.out);
  const { debug, ...defaultFromDebug } = debugJson;
  assert.deepStrictEqual(defaultFromDebug, plainJson);
  assert.equal(plainJson.debug, undefined);
  assert.ok(debug);
  assert.ok(debug.candidates);
  assert.ok(debug.traversal);
});

test('graph-suggest rejects duplicate --debug and valued --debug with exit 2', () => {
  const dup = capture([
    'graph-suggest', '--query', 'x', '--debug', '--debug',
  ]);
  assert.equal(dup.code, 2);
  assert.match(dup.err, /^graph-suggest:/);
  assert.match(dup.err, /debug/i);
  assert.equal(dup.out, '');

  const valued = capture([
    'graph-suggest', '--query', 'x', '--debug', 'yes',
  ]);
  assert.equal(valued.code, 2);
  assert.match(valued.err, /^graph-suggest:/);
  assert.match(valued.err, /debug/i);
  assert.equal(valued.out, '');
});

test('migrate retention dry-run returns JSON audit without writes', () => {
  const yaml = require('js-yaml');
  const crypto = require('node:crypto');
  const repo = fs.mkdtempSync(path.join(os.tmpdir(), 'bouncer-cli-retention-'));
  const bp = '.bouncer/context/epics/091-cli-retention/blueprints/001-sample';
  const writeDoc = (rel, data, body = '# x\n') => {
    const abs = path.join(repo, rel);
    fs.mkdirSync(path.dirname(abs), { recursive: true });
    fs.writeFileSync(abs, `---\n${yaml.dump(data)}---\n${body}`);
  };
  const hashTree = () => {
    const out = {};
    const walk = (absDir, relBase) => {
      for (const name of fs.readdirSync(absDir).sort()) {
        const abs = path.join(absDir, name);
        const rel = relBase ? `${relBase}/${name}` : name;
        if (fs.statSync(abs).isDirectory()) walk(abs, rel);
        else out[rel] = crypto.createHash('sha256').update(fs.readFileSync(abs)).digest('hex');
      }
    };
    const context = path.join(repo, '.bouncer/context');
    if (fs.existsSync(context)) walk(context, '.bouncer/context');
    return out;
  };
  writeDoc(`${bp}/index.md`, {
    type: 'bouncer.blueprint',
    title: 'Sample',
    description: 'cli retention fixture',
    resource: `${bp}/index.md`,
    tags: ['bouncer'],
    timestamp: '2026-09-17T00:00:00+09:00',
    bouncer: {
      id: '001',
      epic_id: '091',
      blueprint_id: '001',
      status: 'closed',
      commit_type: 'feat',
      scale: 'light',
      supersedes: [],
    },
  });
  writeDoc(`${bp}/explain.md`, {
    type: 'bouncer.explain',
    title: 'Explain',
    description: 'cli retention explain',
    resource: `${bp}/explain.md`,
    tags: ['bouncer'],
    timestamp: '2026-09-17T00:00:00+09:00',
    bouncer: {
      id: 'EXPLAIN-001',
      epic_id: '091',
      blueprint_id: '001',
      status: 'published',
    },
  }, '# Explain\n\n## Background\nx\n');

  const compactedBefore = hashTree();
  const result = capture(['migrate', 'retention', '--repo', repo]);
  assert.strictEqual(result.code, 0, result.err);
  const json = JSON.parse(result.out);
  assert.strictEqual(json.ok, true);
  assert.ok(Array.isArray(json.results));
  assert.strictEqual(json.results[0].status, 'already-compacted');
  assert.deepStrictEqual(hashTree(), compactedBefore);
  assert.equal(result.err, '');

  // eligible fixture — dry-run이 이미 축약된 경우만이 아니라 적격 대상에서도
  // 바이트를 바꾸지 않는지 해시로 잠근다.
  const eligibleBp = '.bouncer/context/epics/091-cli-retention/blueprints/002-eligible';
  writeDoc(`${eligibleBp}/index.md`, {
    type: 'bouncer.blueprint',
    title: 'Eligible',
    description: 'cli retention eligible',
    resource: `${eligibleBp}/index.md`,
    tags: ['bouncer'],
    timestamp: '2026-09-17T00:00:00+09:00',
    bouncer: {
      id: '002',
      epic_id: '091',
      blueprint_id: '002',
      status: 'closed',
      commit_type: 'feat',
      scale: 'full',
      supersedes: [],
    },
  });
  writeDoc(`${eligibleBp}/explain.md`, {
    type: 'bouncer.explain',
    title: 'Explain',
    description: 'cli retention explain',
    resource: `${eligibleBp}/explain.md`,
    tags: ['bouncer'],
    timestamp: '2026-09-17T00:00:00+09:00',
    bouncer: {
      id: 'EXPLAIN-002',
      epic_id: '091',
      blueprint_id: '002',
      status: 'published',
    },
  }, '# Explain\n\n## Background\nx\n');
  writeDoc(`${eligibleBp}/tasks/001/tasks.md`, {
    type: 'bouncer.tasks',
    title: 'Task 001',
    description: 'fixture task',
    resource: `${eligibleBp}/tasks/001/tasks.md`,
    tags: ['bouncer'],
    timestamp: '2026-09-17T00:00:00+09:00',
    bouncer: {
      id: 'TASKS-001',
      epic_id: '091',
      blueprint_id: '002',
      status: 'done',
      execution_kind: 'commit',
      affected_paths: ['scripts/src/lib/retention-migration.ts'],
      commit_sha: 'deadbeef',
      depends_on: [],
      parallel_safe: false,
      dependency_gate: 'integrated',
    },
  }, `# Tasks

## Goal & intent
CLI dry-run must not mutate eligible fixtures.

## Interface
auditRetention

## Touch
- \`scripts/src/lib/retention-migration.ts\`

## Constraints
- no writes on dry-run

## Do not touch
- marker

## Checklist
- [ ] marker
`);
  writeDoc(`${eligibleBp}/tasks/001/verification.md`, {
    type: 'bouncer.verification',
    title: 'Verify 001',
    description: 'fixture verify',
    resource: `${eligibleBp}/tasks/001/verification.md`,
    tags: ['bouncer'],
    timestamp: '2026-09-17T00:00:00+09:00',
    bouncer: {
      id: 'VERIFY-001',
      epic_id: '091',
      blueprint_id: '002',
      status: 'passed',
    },
  }, '# Verification\n');
  writeDoc(`${eligibleBp}/tasks/001/review.md`, {
    type: 'bouncer.review',
    title: 'Review 001',
    description: 'fixture review',
    resource: `${eligibleBp}/tasks/001/review.md`,
    tags: ['bouncer'],
    timestamp: '2026-09-17T00:00:00+09:00',
    bouncer: {
      id: 'REVIEW-001',
      epic_id: '091',
      blueprint_id: '002',
      status: 'approved',
    },
  }, '# Review\n');
  writeDoc(`${eligibleBp}/context-review.md`, {
    type: 'bouncer.context_review',
    title: 'Context review',
    description: 'fixture context-review',
    resource: `${eligibleBp}/context-review.md`,
    tags: ['bouncer'],
    timestamp: '2026-09-17T00:00:00+09:00',
    bouncer: {
      id: 'CONTEXT-REVIEW-002',
      epic_id: '091',
      blueprint_id: '002',
      status: 'passed',
    },
  }, '# Context review\n');

  const eligibleBefore = hashTree();
  const eligibleDry = capture(['migrate', 'retention', '--repo', repo]);
  assert.strictEqual(eligibleDry.code, 0, eligibleDry.err);
  const eligibleJson = JSON.parse(eligibleDry.out);
  assert.strictEqual(eligibleJson.ok, true);
  const eligibleRow = eligibleJson.results.find((row) => row.blueprint === eligibleBp);
  assert.ok(eligibleRow);
  assert.strictEqual(eligibleRow.status, 'eligible');
  assert.deepStrictEqual(hashTree(), eligibleBefore);
});

test('migrate retention option combinations exit 2; apply failure exits 1', () => {
  const yaml = require('js-yaml');
  const repo = fs.mkdtempSync(path.join(os.tmpdir(), 'bouncer-cli-retention-'));
  const bp = '.bouncer/context/epics/091-cli-retention/blueprints/001-sample';
  const writeDoc = (rel, data, body = '# x\n') => {
    const abs = path.join(repo, rel);
    fs.mkdirSync(path.dirname(abs), { recursive: true });
    fs.writeFileSync(abs, `---\n${yaml.dump(data)}---\n${body}`);
  };
  writeDoc(`${bp}/index.md`, {
    type: 'bouncer.blueprint',
    title: 'Sample',
    description: 'cli retention fixture',
    resource: `${bp}/index.md`,
    tags: ['bouncer'],
    timestamp: '2026-09-17T00:00:00+09:00',
    bouncer: {
      id: '001',
      epic_id: '091',
      blueprint_id: '001',
      status: 'closed',
      commit_type: 'feat',
      scale: 'light',
      supersedes: [],
    },
  });
  writeDoc(`${bp}/explain.md`, {
    type: 'bouncer.explain',
    title: 'Explain',
    description: 'cli retention explain',
    resource: `${bp}/explain.md`,
    tags: ['bouncer'],
    timestamp: '2026-09-17T00:00:00+09:00',
    bouncer: {
      id: 'EXPLAIN-001',
      epic_id: '091',
      blueprint_id: '001',
      status: 'published',
    },
  }, '# Explain\n\n## Background\nx\n');

  const blueprintOnly = capture(['migrate', 'retention', '--blueprint', bp, '--repo', repo]);
  assert.strictEqual(blueprintOnly.code, 2);
  assert.match(blueprintOnly.err, /--blueprint requires --apply/);
  assert.equal(blueprintOnly.out, '');

  const applyOnly = capture(['migrate', 'retention', '--apply', '--repo', repo]);
  assert.strictEqual(applyOnly.code, 2);
  assert.match(applyOnly.err, /--apply requires --blueprint/);
  assert.equal(applyOnly.out, '');

  const unknown = capture(['migrate', 'retention', '--dry-run', '--repo', repo]);
  assert.strictEqual(unknown.code, 2);
  assert.match(unknown.err, /unknown option/);

  const dup = capture([
    'migrate', 'retention', '--apply', '--blueprint', bp, '--blueprint', bp, '--repo', repo,
  ]);
  assert.strictEqual(dup.code, 2);
  assert.match(dup.err, /duplicate option: --blueprint/);

  // already-compacted 대상 apply → 실행 실패(1), 사용법(2)이 아님
  const notEligible = capture([
    'migrate', 'retention', '--apply', '--blueprint', bp, '--repo', repo,
  ]);
  assert.strictEqual(notEligible.code, 1);
  const payload = JSON.parse(notEligible.out);
  assert.strictEqual(payload.ok, false);
  assert.strictEqual(payload.status, 'already-compacted');
});

test('migrate retention apply eligible exits 0; invalid paths exit 1 with INVALID_PATH', () => {
  const yaml = require('js-yaml');
  const repo = fs.mkdtempSync(path.join(os.tmpdir(), 'bouncer-cli-retention-apply-'));
  const bp = '.bouncer/context/epics/091-cli-apply/blueprints/001-ready';
  const writeDoc = (rel, data, body = '# x\n') => {
    const abs = path.join(repo, rel);
    fs.mkdirSync(path.dirname(abs), { recursive: true });
    fs.writeFileSync(abs, `---\n${yaml.dump(data)}---\n${body}`);
  };
  writeDoc(`${bp}/index.md`, {
    type: 'bouncer.blueprint',
    title: 'Ready',
    description: 'cli retention apply fixture',
    resource: `${bp}/index.md`,
    tags: ['bouncer'],
    timestamp: '2026-09-17T00:00:00+09:00',
    bouncer: {
      id: '001',
      epic_id: '091',
      blueprint_id: '001',
      status: 'closed',
      commit_type: 'feat',
      scale: 'full',
      supersedes: [],
    },
  });
  writeDoc(`${bp}/explain.md`, {
    type: 'bouncer.explain',
    title: 'Explain',
    description: 'cli retention explain',
    resource: `${bp}/explain.md`,
    tags: ['bouncer'],
    timestamp: '2026-09-17T00:00:00+09:00',
    bouncer: {
      id: 'EXPLAIN-001',
      epic_id: '091',
      blueprint_id: '001',
      status: 'published',
    },
  }, '# Explain\n\n## Background\nx\n');
  writeDoc(`${bp}/tasks/001/tasks.md`, {
    type: 'bouncer.tasks',
    title: 'Task 001',
    description: 'fixture task',
    resource: `${bp}/tasks/001/tasks.md`,
    tags: ['bouncer'],
    timestamp: '2026-09-17T00:00:00+09:00',
    bouncer: {
      id: 'TASKS-001',
      epic_id: '091',
      blueprint_id: '001',
      status: 'done',
      execution_kind: 'commit',
      affected_paths: ['scripts/src/lib/retention-migration.ts'],
      commit_sha: 'deadbeef',
      depends_on: [],
      parallel_safe: false,
      dependency_gate: 'integrated',
    },
  }, `# Tasks

## Goal & intent
CLI apply on eligible blueprint should exit 0.

## Interface
migrateRetention

## Touch
- \`scripts/src/lib/retention-migration.ts\`

## Constraints
- single path apply

## Do not touch
- marker

## Checklist
- [ ] marker
`);
  writeDoc(`${bp}/tasks/001/verification.md`, {
    type: 'bouncer.verification',
    title: 'Verify 001',
    description: 'fixture verify',
    resource: `${bp}/tasks/001/verification.md`,
    tags: ['bouncer'],
    timestamp: '2026-09-17T00:00:00+09:00',
    bouncer: {
      id: 'VERIFY-001',
      epic_id: '091',
      blueprint_id: '001',
      status: 'passed',
    },
  }, '# Verification\n');
  writeDoc(`${bp}/tasks/001/review.md`, {
    type: 'bouncer.review',
    title: 'Review 001',
    description: 'fixture review',
    resource: `${bp}/tasks/001/review.md`,
    tags: ['bouncer'],
    timestamp: '2026-09-17T00:00:00+09:00',
    bouncer: {
      id: 'REVIEW-001',
      epic_id: '091',
      blueprint_id: '001',
      status: 'approved',
    },
  }, '# Review\n');

  const applied = capture([
    'migrate', 'retention', '--apply', '--blueprint', bp, '--repo', repo,
  ]);
  assert.strictEqual(applied.code, 0, applied.err || applied.out);
  const appliedPayload = JSON.parse(applied.out);
  assert.strictEqual(appliedPayload.ok, true);
  assert.strictEqual(appliedPayload.status, 'eligible');
  assert.match(
    fs.readFileSync(path.join(repo, `${bp}/explain.md`), 'utf8'),
    /## Tasks/,
  );
  assert.equal(fs.existsSync(path.join(repo, `${bp}/tasks/001/tasks.md`)), false);

  const absolute = capture([
    'migrate', 'retention', '--apply', '--blueprint', path.resolve(repo, bp), '--repo', repo,
  ]);
  assert.strictEqual(absolute.code, 1);
  assert.strictEqual(JSON.parse(absolute.out).code, 'INVALID_PATH');

  const escaped = capture([
    'migrate', 'retention', '--apply',
    '--blueprint', '.bouncer/context/epics/091-x/blueprints/../001-ready',
    '--repo', repo,
  ]);
  assert.strictEqual(escaped.code, 1);
  assert.strictEqual(JSON.parse(escaped.out).code, 'INVALID_PATH');

  const nonBlueprint = capture([
    'migrate', 'retention', '--apply',
    '--blueprint', '.bouncer/context/epics/091-cli-apply',
    '--repo', repo,
  ]);
  assert.strictEqual(nonBlueprint.code, 1);
  assert.strictEqual(JSON.parse(nonBlueprint.out).code, 'INVALID_PATH');
});
