'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { execFileSync, spawnSync } = require('node:child_process');

const { runCli } = require('../scripts/lib/cli');

const dirs = [];

/**
 * 임시 저장소 루트를 만든다. realpath(tmpdir) 아래에만 두어 실제 checkout과
 * 사용자 홈 설정을 건드리지 않는다.
 *
 * @returns {string} 정리 대상에 등록된 임시 repo 절대 경로
 */
function tmpRepo() {
  const root = fs.realpathSync(os.tmpdir());
  const dir = fs.mkdtempSync(path.join(root, 'bouncer-terminal-intent-'));
  dirs.push(dir);
  return dir;
}

/**
 * 고정 identity·gpgsign=false로 git을 실행한다. 전역 Git config와 signing에
 * 의존하지 않기 위해 GIT_CONFIG_NOSYSTEM=1을 켠다.
 *
 * @param {string} repo - fixture repo cwd
 * @param {string[]} args - git argv
 * @param {NodeJS.ProcessEnv} [extraEnv] - AUTHOR/COMMITTER DATE 등
 * @returns {string} stdout
 */
function git(repo, args, extraEnv = {}) {
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

/**
 * main branch로 빈 Git 저장소를 연다.
 *
 * @param {string} repo - 임시 루트
 */
function initGit(repo) {
  git(repo, ['init', '-b', 'main']);
}

/**
 * repo 상대 경로에 파일을 쓴다.
 *
 * @param {string} repo - 임시 루트
 * @param {string} rel - repo-relative path
 * @param {string} content - 파일 본문
 */
function writeFile(repo, rel, content) {
  const abs = path.join(repo, rel);
  fs.mkdirSync(path.dirname(abs), { recursive: true });
  fs.writeFileSync(abs, content);
}

/**
 * 고정 시각으로 staged 전체를 commit하고 HEAD SHA를 돌린다.
 *
 * @param {string} repo - 임시 루트
 * @param {string} message - commit message(트레일러 포함 가능)
 * @param {string} date - GIT_AUTHOR_DATE / GIT_COMMITTER_DATE
 * @returns {string} 40자리 HEAD SHA
 */
function commit(repo, message, date) {
  git(repo, ['add', '-A']);
  git(repo, ['-c', 'commit.gpgsign=false', 'commit', '-m', message], {
    GIT_AUTHOR_DATE: date,
    GIT_COMMITTER_DATE: date,
  });
  return git(repo, ['rev-parse', 'HEAD']).trim();
}

/**
 * 배포 CLI 표면만 호출한다. TypeScript 모듈을 직접 불러 종단 경계를 우회하지 않는다.
 *
 * @param {string[]} argv - `bouncer` 뒤 argv
 * @returns {{ code: number, out: string, err: string }}
 */
function capture(argv) {
  const buf = { out: '', err: '' };
  const code = runCli(argv, {
    out: (value) => { buf.out += value; },
    err: (value) => { buf.err += value; },
  });
  return { code, ...buf };
}

/**
 * Explain task_commits 행을 YAML 조각으로 직렬화한다.
 *
 * @param {{ task: string, sha: string, intent_anchor: string }[]} rows - Explain 행
 * @returns {string} frontmatter용 YAML
 */
function renderTaskCommits(rows) {
  return rows.map((row) => [
    '    - task: ' + JSON.stringify(row.task),
    '      sha: ' + JSON.stringify(row.sha),
    '      intent_anchor: ' + JSON.stringify(row.intent_anchor),
  ].join('\n')).join('\n');
}

/**
 * EPIC-001/BP-001 Explain을 쓴다. resolver는 파일 존재만 보므로 commit하지 않아도 된다.
 *
 * @param {string} repo - 임시 루트
 * @param {{ task: string, sha: string, intent_anchor: string }[]} rows - task_commits
 * @returns {string} explain.md repo-relative path
 */
function writeExplain(repo, rows) {
  const rel = '.bouncer/context/epics/001-demo/blueprints/001-demo/explain.md';
  writeFile(repo, rel, [
    '---',
    'type: bouncer.explain',
    'title: terminal fixture',
    'description: terminal fixture',
    `resource: ${rel}`,
    'tags: [bouncer]',
    "timestamp: '2026-09-16T00:00:00+09:00'",
    'bouncer:',
    '  id: EXPLAIN-001',
    "  epic_id: '001'",
    "  blueprint_id: '001'",
    '  status: published',
    '  task_commits:',
    renderTaskCommits(rows),
    '---',
    '# Explain',
    '',
    '## Background',
    '',
    'terminal provenance fixture',
    '',
    '## Intuition',
    '',
    'stable task id joins trailer and Explain',
    '',
    '## Code',
    '',
    'src/one.ts shared',
    '',
  ].join('\n'));
  return rel;
}

/**
 * 선택한 함수용 Task 문서를 남긴다. trailer·Explain이 가리킬 안정 Task ID의 근거다.
 *
 * @param {string} repo - 임시 루트
 * @param {string} taskDigits - '001' | '002'
 * @param {string} bodyLine - Goal 한 줄
 */
function writeTaskDoc(repo, taskDigits, bodyLine) {
  const rel = `.bouncer/context/epics/001-demo/blueprints/001-demo/tasks/${taskDigits}/tasks.md`;
  writeFile(repo, rel, [
    '---',
    'type: bouncer.tasks',
    'title: shared task',
    'description: fixture',
    `resource: ${rel}`,
    'tags: [bouncer]',
    "timestamp: '2026-09-16T00:00:00+09:00'",
    'bouncer:',
    `  id: TASKS-${taskDigits}`,
    "  epic_id: '001'",
    "  blueprint_id: '001'",
    '  status: ready',
    '  affected_paths:',
    '    - src/one.ts',
    '---',
    '# Tasks',
    '',
    '## Goal & intent',
    '',
    bodyLine,
    '',
  ].join('\n'));
}

/**
 * 저장소 안 결정적 Graphify double. 설치·네트워크·PATH의 실제 graphify를 쓰지 않는다.
 * `--version`은 호환 lock과 맞추고, `update`는 cwd에 source/test용 graph.json만 만든다.
 *
 * @param {string} repo - 임시 루트
 * @returns {string} bin 절대 경로
 */
function installGraphifyDouble(repo) {
  const rel = 'tools/graphify';
  const abs = path.join(repo, rel);
  writeFile(repo, rel, [
    '#!/usr/bin/env node',
    "'use strict';",
    "const fs = require('node:fs');",
    "const path = require('node:path');",
    'const args = process.argv.slice(2);',
    "if (args[0] === '--version') {",
    "  process.stdout.write('0.9.56\\n');",
    '  process.exit(0);',
    '}',
    // part cwd에 graph.json만 둔다. context/context-src 트리는 만들지 않는다.
    "if (args[0] === 'update') {",
    '  const outDir = process.env.GRAPHIFY_OUT || process.cwd();',
    '  const target = path.isAbsolute(outDir)',
    '    ? path.join(outDir, \'graph.json\')',
    '    : path.join(process.cwd(), outDir, \'graph.json\');',
    '  fs.mkdirSync(path.dirname(target), { recursive: true });',
    '  fs.writeFileSync(target, JSON.stringify({',
    "    nodes: [{ id: 'n1', source_file: 'a.ts' }],",
    '    links: [],',
    '    hyperedges: [],',
    '  }));',
    '  process.exit(0);',
    '}',
    'process.exit(0);',
    '',
  ].join('\n'));
  fs.chmodSync(abs, 0o755);
  return abs;
}

/**
 * Plan 전제용 graphify lock. executable은 double 절대 경로라 probe가 PATH를 보지 않는다.
 *
 * @param {string} repo - 임시 루트
 * @param {string} executableAbs - double 절대 경로
 */
function writeCompatibleLock(repo, executableAbs) {
  const pluginVersion = JSON.parse(
    fs.readFileSync(path.join(__dirname, '..', 'plugin.json'), 'utf8'),
  ).version;
  writeFile(repo, '.bouncer/graphify.lock.json', `${JSON.stringify({
    schema_version: 1,
    package: 'graphifyy',
    package_version: '0.9.56',
    cli_version: '0.9.56',
    bouncer_version: pluginVersion,
    graph_schema_version: '1',
    installed_at: '2026-09-16T00:00:00.000+09:00',
    executable: executableAbs,
  }, null, 2)}\n`);
}

test.after(() => {
  for (const dir of dirs) {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test('terminal intent provenance joins selection, commits, freshness, and graph scope', () => {
  const repo = tmpRepo();
  initGit(repo);

  const initResult = capture(['init', '--no-graphify', '--repo', repo]);
  assert.equal(initResult.code, 0, initResult.err);
  const cfg = JSON.parse(fs.readFileSync(path.join(repo, '.bouncer/config.json'), 'utf8'));
  assert.equal(Object.hasOwn(cfg, 'context_dirs'), false);

  writeFile(repo, 'src/one.ts', 'export function shared() { return 1; }\n');
  writeFile(repo, 'src/two.ts', 'export function shared() { return 2; }\n');
  commit(repo, 'feat: two shared definitions\n', '2026-01-01T00:00:00 +0900');

  const ambiguous = capture(['intent', '--repo', repo, '--symbol', 'shared']);
  assert.equal(ambiguous.code, 0, ambiguous.err);
  const ambiguousPayload = JSON.parse(ambiguous.out);
  assert.equal(ambiguousPayload.status, 'ambiguous');
  assert.ok(ambiguousPayload.candidates.length >= 2);
  assert.ok(ambiguousPayload.candidates.every((item) => typeof item.candidate_ref === 'string'));
  assert.ok(ambiguousPayload.candidates.every((item) => !String(item.candidate_ref).includes('/')));

  // 배열 순서가 아니라 path로 고른 뒤, 그 항목이 돌려준 opaque ref만 --candidate에 넘긴다.
  const chosen = ambiguousPayload.candidates.find((item) => item.symbol_ref.path === 'src/one.ts');
  assert.ok(chosen, 'expected src/one.ts among ambiguous candidates');
  const chosenRef = chosen.candidate_ref;

  const unknownRef = 'a'.repeat(64);
  assert.equal(unknownRef.length, 64);
  assert.ok(!ambiguousPayload.candidates.some((item) => item.candidate_ref === unknownRef));
  const unknown = capture([
    'intent', '--repo', repo, '--symbol', 'shared', '--candidate', unknownRef,
  ]);
  assert.equal(unknown.code, 1);
  assert.equal(unknown.out, '');
  assert.match(unknown.err, /^intent:/);

  writeTaskDoc(repo, '001', 'first linked edit of shared');
  writeFile(repo, 'src/one.ts', 'export function shared() { return 10; }\n');
  const firstSha = commit(
    repo,
    'feat: link shared task 001\n\nBouncer-Task: EPIC-001/BP-001/TASK-001\nBouncer-Intent: EPIC-001/BP-001\n',
    '2026-01-02T00:00:00 +0900',
  );
  const firstMessage = git(repo, ['log', '-1', '--format=%B', firstSha]);
  assert.equal((firstMessage.match(/^Bouncer-Task: EPIC-001\/BP-001\/TASK-001$/gm) || []).length, 1);
  assert.equal((firstMessage.match(/^Bouncer-Intent: EPIC-001\/BP-001$/gm) || []).length, 1);

  const firstExplainRow = {
    task: 'EPIC-001/BP-001/TASK-001',
    sha: firstSha.slice(0, 8),
    intent_anchor: 'task-001',
  };
  writeExplain(repo, [firstExplainRow]);
  assert.match(firstExplainRow.sha, /^[0-9a-f]{8}$/);

  const firstLookup = capture([
    'intent', '--repo', repo, '--symbol', 'shared', '--candidate', chosenRef,
  ]);
  assert.equal(firstLookup.code, 0, firstLookup.err);
  const firstPayload = JSON.parse(firstLookup.out);
  assert.equal(firstPayload.status, 'resolved');
  const firstCandidate = firstPayload.candidates.find((item) => item.task === 'EPIC-001/BP-001/TASK-001');
  assert.ok(firstCandidate);
  assert.match(firstCandidate.commit, /^[0-9a-f]{40}$/);
  assert.equal(firstCandidate.commit.slice(0, 8), firstExplainRow.sha);
  assert.equal(firstCandidate.freshness, 'current');

  writeTaskDoc(repo, '002', 'second linked edit of shared');
  writeFile(repo, 'src/one.ts', 'export function shared() { return 20; }\n');
  const secondSha = commit(
    repo,
    'feat: link shared task 002\n\nBouncer-Task: EPIC-001/BP-001/TASK-002\nBouncer-Intent: EPIC-001/BP-001\n',
    '2026-01-03T00:00:00 +0900',
  );
  // 첫 커밋(310–312)과 동일: secondSha 메시지에 trailer가 정확히 한 번씩 있어야 한다.
  const secondMessage = git(repo, ['log', '-1', '--format=%B', secondSha]);
  assert.equal((secondMessage.match(/^Bouncer-Task: EPIC-001\/BP-001\/TASK-002$/gm) || []).length, 1);
  assert.equal((secondMessage.match(/^Bouncer-Intent: EPIC-001\/BP-001$/gm) || []).length, 1);
  const secondExplainRow = {
    task: 'EPIC-001/BP-001/TASK-002',
    sha: secondSha.slice(0, 8),
    intent_anchor: 'task-002',
  };
  writeExplain(repo, [firstExplainRow, secondExplainRow]);

  const secondLookup = capture([
    'intent', '--repo', repo, '--symbol', 'shared', '--candidate', chosenRef,
  ]);
  assert.equal(secondLookup.code, 0, secondLookup.err);
  const secondPayload = JSON.parse(secondLookup.out);
  assert.equal(secondPayload.status, 'resolved');
  const byTask = Object.fromEntries(secondPayload.candidates.map((item) => [item.task, item]));
  assert.equal(byTask['EPIC-001/BP-001/TASK-001'].freshness, 'possibly-superseded');
  assert.equal(byTask['EPIC-001/BP-001/TASK-002'].freshness, 'current');
  assert.match(byTask['EPIC-001/BP-001/TASK-002'].commit, /^[0-9a-f]{40}$/);
  assert.equal(byTask['EPIC-001/BP-001/TASK-002'].commit.slice(0, 8), secondExplainRow.sha);

  writeFile(repo, 'test/shared.test.ts', 'export {};\n');
  const binAbs = installGraphifyDouble(repo);
  writeCompatibleLock(repo, binAbs);
  cfg.source_dirs = ['src'];
  cfg.graphify = {
    ...(cfg.graphify || {}),
    enabled: true,
    bin: 'tools/graphify',
    test_dirs: ['test'],
  };
  fs.writeFileSync(path.join(repo, '.bouncer/config.json'), `${JSON.stringify(cfg, null, 2)}\n`);

  const sync = capture(['graph-sync', '--repo', repo]);
  assert.equal(sync.code, 0, sync.err);
  const syncPayload = JSON.parse(sync.out);
  assert.deepEqual(syncPayload.graphs.map((graph) => graph.name), ['source', 'test']);

  const hook = path.join(__dirname, '..', 'hooks', 'session-graph.js');
  const session = spawnSync(process.execPath, [hook], {
    input: JSON.stringify({ cwd: repo }),
    encoding: 'utf8',
  });
  // hooks/session-graph.js는 항상 exit(0)이므로 status만으로는 건강 동기화를
  // 보장하지 못한다. 건강한 sync는 graphSyncWarnings를 stderr에 쓰지 않는다.
  assert.equal(session.status, 0, session.stderr);
  assert.equal(String(session.stderr || ''), '');

  // SessionStart 후에도 context 산출물이 생기지 않았는지 재확인.
  assert.ok(!fs.existsSync(path.join(repo, 'graphify-out/context')));
  assert.ok(!fs.existsSync(path.join(repo, 'graphify-out/context-src')));
  // graph-sync가 남긴 source/test graph.json은 그대로 있어야 한다.
  assert.ok(fs.existsSync(path.join(repo, 'graphify-out/source/graph.json')));
  assert.ok(fs.existsSync(path.join(repo, 'graphify-out/test/graph.json')));
});
