// test/retro-sources.test.js
'use strict';
const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const {
  listRetroSources, defaultRetroRoots, claudeProjectSlug,
} = require('../scripts/lib/retro-sources');

// CLI 모듈은 구현 전 red 단계에서도 lib 단언이 먼저 실패하도록 지연 로드한다.
function loadCli() {
  return require('../scripts/lib/cli-retro-command');
}

function tmp() {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'retro-src-'));
}

function write(p, body) {
  fs.mkdirSync(path.dirname(p), { recursive: true });
  fs.writeFileSync(p, body);
}

// 세 host 루트를 모두 임시 디렉터리로 만든다. 실제 home은 읽지 않는다.
function makeEnv() {
  const base = tmp();
  const root = path.join(base, 'proj');
  fs.mkdirSync(root);
  const roots = {
    claude: path.join(base, 'claude'),
    codex: path.join(base, 'codex'),
    cursor: path.join(base, 'cursor'),
  };
  return { base, root, roots };
}

function populate({ root, roots }) {
  const slug = claudeProjectSlug(root);
  write(path.join(roots.claude, slug, 'a.jsonl'), '{}\n');
  write(path.join(roots.claude, `${slug}--worktrees-x`, 'b.jsonl'), '{}\n');
  write(path.join(roots.claude, '-other', 'c.jsonl'), '{}\n');
  write(path.join(roots.codex, '2026/10/12/rollout-1.jsonl'),
    `${JSON.stringify({ type: 'session_meta', payload: { cwd: root } })}\nbody\n`);
  write(path.join(roots.codex, '2026/10/12/rollout-2.jsonl'), 'not json\n');
  write(path.join(roots.cursor, 'h1/workspace.json'), JSON.stringify({ folder: `file://${root}` }));
  write(path.join(roots.cursor, 'h1/state.vscdb'), 'sqlite');
}

test('세 host fixture → 일치하는 후보만 나열하고 해석 불가 메타는 skipped에 남긴다', () => {
  const env = makeEnv();
  populate(env);
  const r = listRetroSources({ projectRoot: env.root, roots: env.roots, limit: 20 });
  assert.deepStrictEqual(
    r.sources.map((s) => [s.host, path.basename(s.path)]).sort(),
    [['claude-code', 'a.jsonl'], ['claude-code', 'b.jsonl'], ['codex', 'rollout-1.jsonl'], ['cursor', 'state.vscdb']],
  );
  assert.ok(r.skipped.some((s) => s.reason === 'unparseable-session-meta'));
  assert.strictEqual(r.project_root, env.root);
  assert.strictEqual(r.sources.find((s) => s.host === 'cursor').format, 'sqlite');
  assert.strictEqual(r.sources.find((s) => s.host === 'codex').format, 'jsonl');
});

test('점이 든 경로 → claude slug가 영숫자 아닌 글자를 모두 하이픈으로 바꾼다', () => {
  assert.strictEqual(claudeProjectSlug('/home/a/repo.x'), '-home-a-repo-x');
});

test('cursor 루트가 없을 때 → root-missing이 skipped에 남는다', () => {
  const env = makeEnv();
  populate(env);
  env.roots.cursor = path.join(env.base, 'absent');
  const r = listRetroSources({ projectRoot: env.root, roots: env.roots, limit: 20 });
  assert.ok(r.skipped.some((s) => s.host === 'cursor' && s.reason === 'root-missing'));
});

test('claude 루트에 일치 디렉터리가 없을 때 → no-project-match가 루트 경로와 함께 남는다', () => {
  const env = makeEnv();
  write(path.join(env.roots.claude, '-other', 'c.jsonl'), '{}\n');
  const r = listRetroSources({ projectRoot: env.root, roots: env.roots, limit: 20 });
  assert.ok(r.skipped.some((s) => s.host === 'claude-code'
    && s.reason === 'no-project-match' && s.path === env.roots.claude));
});

test('codex 루트 권한이 없을 때 → permission-denied가 skipped에 남는다', (t) => {
  if (process.getuid?.() === 0) { t.skip('root는 chmod 000을 무시한다'); return; }
  const env = makeEnv();
  populate(env);
  fs.chmodSync(env.roots.codex, 0o000);
  try {
    const r = listRetroSources({ projectRoot: env.root, roots: env.roots, limit: 20 });
    assert.ok(r.skipped.some((s) => s.host === 'codex' && s.reason === 'permission-denied'));
  } finally {
    fs.chmodSync(env.roots.codex, 0o755);
  }
});

test('env로 CLAUDE_CONFIG_DIR·CODEX_HOME을 줄 때 → 두 루트가 그 아래로 정해진다', () => {
  const r = defaultRetroRoots({
    homeDir: '/h', platform: 'linux', env: { CLAUDE_CONFIG_DIR: '/c', CODEX_HOME: '/x' },
  });
  assert.strictEqual(r.claude, path.join('/c', 'projects'));
  assert.strictEqual(r.codex, path.join('/x', 'sessions'));
  assert.strictEqual(r.cursor, path.join('/h', '.config/Cursor/User/workspaceStorage'));
});

test('env가 비었을 때 → home 아래 기본 루트를 쓴다', () => {
  const r = defaultRetroRoots({ homeDir: '/h', platform: 'linux', env: {} });
  assert.strictEqual(r.claude, path.join('/h', '.claude/projects'));
  assert.strictEqual(r.codex, path.join('/h', '.codex/sessions'));
});

test('platform이 darwin일 때 → cursor 루트가 Library/Application Support 아래다', () => {
  const r = defaultRetroRoots({ homeDir: '/h', platform: 'darwin', env: {} });
  assert.strictEqual(r.cursor, path.join('/h', 'Library/Application Support/Cursor/User/workspaceStorage'));
});

test('platform이 win32이고 APPDATA가 있을 때 → cursor 루트가 APPDATA 아래다', () => {
  const r = defaultRetroRoots({ homeDir: '/h', platform: 'win32', env: { APPDATA: '/ad' } });
  assert.strictEqual(r.cursor, path.join('/ad', 'Cursor/User/workspaceStorage'));
});

test('mtime이 서로 다른 claude 파일 셋 → limit 20은 최신순, limit 1은 최신 하나다', () => {
  const env = makeEnv();
  const dir = path.join(env.roots.claude, claudeProjectSlug(env.root));
  const files = ['old', 'mid', 'new'].map((n) => path.join(dir, `${n}.jsonl`));
  files.forEach((f) => write(f, '{}\n'));
  // 파일명 순서와 mtime 순서를 어긋나게 해 정렬을 실제로 검증한다.
  fs.utimesSync(files[0], 1000, 1000);
  fs.utimesSync(files[1], 2000, 2000);
  fs.utimesSync(files[2], 3000, 3000);
  const all = listRetroSources({ projectRoot: env.root, roots: env.roots, limit: 20 });
  assert.deepStrictEqual(all.sources.map((s) => path.basename(s.path)), ['new.jsonl', 'mid.jsonl', 'old.jsonl']);
  const one = listRetroSources({ projectRoot: env.root, roots: env.roots, limit: 1 });
  assert.deepStrictEqual(one.sources.map((s) => path.basename(s.path)), ['new.jsonl']);
});

function runRetro(rest, deps) {
  const buf = { out: '', err: '' };
  const code = loadCli().run(rest, {
    out: (s) => { buf.out += s; },
    err: (s) => { buf.err += s; },
  }, deps);
  return { code, ...buf };
}

test('resolveProjectRoot가 throw할 때 → ok:false와 종료 코드 1이다', () => {
  const r = runRetro(['sources'], { resolveProjectRoot: () => { throw new Error('저장소 아님'); } });
  assert.strictEqual(r.code, 1);
  assert.strictEqual(JSON.parse(r.out).ok, false);
});

test('모르는 하위 명령·플래그·범위 밖 limit → 각각 종료 코드 2다', () => {
  const deps = { resolveProjectRoot: () => '/x' };
  for (const rest of [['nope'], ['sources', '--bogus'], ['sources', '--limit', '0'], ['sources', '--limit', '201'],
    ['sources', '--limit', 'abc']]) {
    const r = runRetro(rest, deps);
    assert.strictEqual(r.code, 2, rest.join(' '));
    assert.strictEqual(r.out, '');
    assert.ok(r.err.length > 0);
  }
});

test('모든 루트를 주입한 정상 실행 → 종료 코드 0과 project_root가 담긴 ok JSON이다', () => {
  const env = makeEnv();
  populate(env);
  const r = runRetro(['sources', '--repo', env.root, '--claude-root', env.roots.claude,
    '--codex-root', env.roots.codex, '--cursor-root', env.roots.cursor], {});
  assert.strictEqual(r.code, 0);
  const j = JSON.parse(r.out);
  assert.strictEqual(j.ok, true);
  assert.strictEqual(j.project_root, env.root);
  assert.strictEqual(j.sources.length, 4);
});
