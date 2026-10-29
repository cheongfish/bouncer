// test/cursor-plugin.test.js
// Bouncer ships from one repository as a Claude Code, Cursor, Codex, and
// Antigravity plugin. The four manifests describe the same artifact, so a
// version or name that drifts between them ships a plugin that claims to be
// something it is not. Hook adapters wear different protocols but must reach
// the same verdict, so the Cursor one is exercised against the shared guard.
'use strict';
const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { execFileSync } = require('node:child_process');
const { writeCurrent } = require('../packages/cli/dist/current');

const root = path.join(__dirname, '..');
const readJson = (rel) => JSON.parse(fs.readFileSync(path.join(root, rel), 'utf8'));

const LAUNCHER_SKILLS = [
  'bouncer-init', 'bouncer-plan',
  'bouncer-finalize', 'bouncer-run', 'explain-diff', 'graphify-runner',
  'review',
];
// 호스 카탈로그에서 뺀 보조는 references/<name>/index.md에 본문이 있다.
// 워크플로만 skills/<name>/SKILL.md를 유지한다(런처 보조는 references/).
const LAUNCHER_UNPUBLISHED = new Set(['explain-diff', 'graphify-runner', 'review']);

/**
 * LAUNCHER_SKILLS 항목의 런처 셸이 들어 있는 본문 경로.
 *
 * @param {string} name - 스킬 디렉터리 이름
 * @returns {string} 워크트리 절대 경로
 */
function launcherSkillPath(name) {
  if (LAUNCHER_UNPUBLISHED.has(name)) {
    return path.join(root, 'references', name, 'index.md');
  }
  return path.join(root, 'skills', name, 'SKILL.md');
}

// Antigravity discovers skills/ · agents/ · hooks/ by convention. Re-declaring
// those path keys in the root plugin.json is how the host rejects the plugin.
test('the Antigravity root plugin.json → omits convention path keys', () => {
  const antigravity = readJson('plugin.json');
  for (const key of ['skills', 'agents', 'hooks', 'commands']) {
    assert.ok(!(key in antigravity), `plugin.json must not re-declare ${key}`);
  }
  for (const dir of ['skills', 'agents', 'hooks']) {
    assert.ok(fs.existsSync(path.join(root, dir)));
  }
});

// Cursor discovers hooks/hooks.json by convention, and that file speaks Claude
// Code's event names. Naming the Cursor file in the manifest replaces the
// discovery, so this declaration is what keeps Cursor from loading a hook
// definition it cannot understand.
test('the Cursor manifest → points hooks at the Cursor hook file', () => {
  const cursor = readJson('.cursor-plugin/plugin.json');
  assert.strictEqual(cursor.hooks, './hooks/cursor-hooks.json');
  assert.ok(fs.existsSync(path.join(root, 'hooks/cursor-hooks.json')));
});

test('cursor-hooks.json → registers commit safety on beforeShellExecution', () => {
  const hooks = readJson('hooks/cursor-hooks.json');
  assert.strictEqual(hooks.version, 1);
  const entries = hooks.hooks.beforeShellExecution;
  assert.ok(Array.isArray(entries), 'no beforeShellExecution entries');
  assert.ok(entries[0].command.includes('cursor-commit-safety.js'));
  assert.strictEqual(entries[0].command, 'node ./hooks/cursor-commit-safety.js');
});

// Single-plugin repos only need plugin.json. marketplace.json is for
// multi-plugin Cursor marketplaces; Claude Code still uses
// .claude-plugin/marketplace.json for /plugin marketplace add.
test('the Cursor plugin → has no marketplace.json', () => {
  assert.ok(
    !fs.existsSync(path.join(root, '.cursor-plugin/marketplace.json')),
    'single-plugin Cursor layout must omit .cursor-plugin/marketplace.json',
  );
});

// Codex's official validator rejects a `hooks` key in plugin.json, but still
// auto-discovers hooks/hooks.json. Declaring hooks here would fail validation
// and keep the plugin from installing.
test('the Codex manifest → omits hooks and points skills at ./skills/', () => {
  const codex = readJson('.codex-plugin/plugin.json');
  assert.ok(!('hooks' in codex), 'Codex plugin.json must not declare hooks');
  assert.strictEqual(codex.skills, './skills/');
  assert.ok(codex.interface && typeof codex.interface === 'object');
});

test('the Codex marketplace → lists bouncer at the repository root', () => {
  const market = readJson('.agents/plugins/marketplace.json');
  const entry = (market.plugins || []).find((p) => p.name === 'bouncer');
  assert.ok(entry, 'no bouncer entry');
  assert.deepStrictEqual(entry.source, { source: 'local', path: './' });
});

const ENTRY_SKILLS = ['bouncer-finalize', 'bouncer-init', 'bouncer-plan', 'bouncer-run'];

// 호스트 매니페스트의 skills 경로는 플러그인 루트 기준이다. 그 디렉터리에서 SKILL.md를 가진 하위 디렉터리 이름만 모은다.
// 호스트 관례 스캔이 보는 집합이 바로 이것이라, 진입 skill 외 디렉터리가 생기면 카탈로그에 새어 나간다.
function skillDirsOf(manifestRel) {
  const manifest = readJson(manifestRel);
  const dir = path.resolve(root, manifest.skills);
  return fs.readdirSync(dir, { withFileTypes: true })
    .filter((e) => e.isDirectory() && fs.existsSync(path.join(dir, e.name, 'SKILL.md')))
    .map((e) => e.name)
    .sort();
}

// `## <title>`부터 다음 `## ` 앞까지. 코드 펜스 안의 `## `은 문서에 없다는 전제다.
function installSection(title) {
  const text = fs.readFileSync(path.join(root, 'docs/install.md'), 'utf8');
  const start = text.indexOf(`\n## ${title}\n`);
  assert.ok(start >= 0, `docs/install.md has no "## ${title}" section`);
  const next = text.indexOf('\n## ', start + 1);
  return text.slice(start, next < 0 ? undefined : next);
}

test('Cursor and Codex skills directories → expose exactly the four entry skills', () => {
  for (const manifestRel of ['.cursor-plugin/plugin.json', '.codex-plugin/plugin.json']) {
    assert.deepStrictEqual(
      skillDirsOf(manifestRel),
      ENTRY_SKILLS,
      `${manifestRel} skills directory must hold only the entry skills`,
    );
  }
});

test('host manifests → never name the retired retro skill', () => {
  const manifests = [
    'plugin.json', '.claude-plugin/plugin.json', '.cursor-plugin/plugin.json',
    '.codex-plugin/plugin.json', '.agents/plugins/marketplace.json',
  ];
  for (const rel of manifests) {
    const src = fs.readFileSync(path.join(root, rel), 'utf8');
    assert.ok(!src.includes('bouncer-retro'), `${rel} must not name bouncer-retro`);
  }
});

test('install guide Cursor and Codex sections → name the four entry skills and the retro CLI path', () => {
  for (const title of ['Cursor', 'Codex']) {
    const body = installSection(title);
    for (const entry of ['/bouncer-init', '/bouncer-plan', '/bouncer-run', '/bouncer-finalize']) {
      assert.ok(body.includes(entry), `${title} section must name ${entry}`);
    }
    assert.ok(body.includes('bouncer retro sources'), `${title} section must name bouncer retro sources`);
  }
  // 줄바꿈이 문장 중간에 들어가도 같은 문구로 보도록 공백 연속을 한 칸으로 접는다.
  const cursor = installSection('Cursor');
  const folded = cursor.replace(/\s+/g, ' ');
  assert.ok(!cursor.includes('여섯'), 'Cursor section still states the stale workflow count');
  assert.ok(!folded.includes('밖 파일이 staged면 셸 실행을'), 'Cursor section still states the old deny rule');
  for (const needle of ['rules/commit-scope.md', '원장 scope', 'Do not touch', 'scope-do-not-touch-unreadable']) {
    assert.ok(cursor.includes(needle), `Cursor section must mention ${needle}`);
  }
});

test('workflow shells → invoke the installed bouncer launcher directly', () => {
  for (const name of LAUNCHER_SKILLS) {
    const file = launcherSkillPath(name);
    const src = fs.readFileSync(file, 'utf8');
    const label = path.relative(root, file);
    assert.ok(
      !src.includes('CLAUDE_PLUGIN_ROOT') && !src.includes('PLUGIN_ROOT'),
      `${label} must not interpolate host root variables`,
    );
    assert.doesNotMatch(src, /node\s+"\$\{BOUNCER_ROOT\}\/scripts\/bouncer"/);
    if (name !== 'review') assert.match(src, /\bbouncer(?:\s|$)/, `${label} must call bouncer directly`);
  }
  const cursorHooks = fs.readFileSync(path.join(root, 'hooks/cursor-hooks.json'), 'utf8');
  assert.ok(
    !cursorHooks.includes('CLAUDE_PLUGIN_ROOT'),
    'cursor-hooks.json must not name CLAUDE_PLUGIN_ROOT',
  );
});

// 각 fenced block은 독립 셸이므로 CLI 블록은 환경변수 bootstrap 없이 런처를
// 직접 부른다. 모듈 경로를 읽는 블록만 독립적인 루트 해석을 유지한다.
test('launcher shell blocks → call bouncer directly and scope root resolution to module paths', () => {
  const workflowSkills = LAUNCHER_SKILLS.map(launcherSkillPath);
  const offenders = [];
  for (const file of workflowSkills) {
    const src = fs.readFileSync(file, 'utf8');
    const label = path.relative(root, file);
    for (const m of src.matchAll(/( *)```bash\n(.*?)\1```/gs)) {
      const body = m[2];
      if (body.includes('node "${BOUNCER_ROOT}/scripts/bouncer"')) {
        offenders.push(`${label}: legacy scripts/bouncer invocation`);
      }
      if (body.includes('${BOUNCER_ROOT}') && !body.includes('BOUNCER_ROOT="$(bouncer-root --auto)"')) {
        offenders.push(`${label}: unresolved module root`);
      }
    }
  }
  assert.deepStrictEqual(offenders, [], `blocks read BOUNCER_ROOT without launcher:\n${offenders.join('\n')}`);
});

function runCursorHook(payload, cwd) {
  const out = execFileSync(process.execPath, [path.join(root, 'hooks/cursor-commit-safety.js')], {
    input: JSON.stringify(payload), encoding: 'utf8', cwd,
    // 훅은 공개 CLI를 spawn한다. 이 체크아웃의 런처를 명시해 PATH 설치 여부와 무관하게 한다.
    env: { ...process.env, BOUNCER_BIN: path.join(root, 'packages/cli/bin/bouncer') },
  });
  return JSON.parse(out);
}

// The adapter's whole job is translation: Cursor decides from stdout JSON, not
// from an exit code. A non-commit command must not be denied, and a commit that
// the shared guard rejects must come back as a deny carrying the reason.
test('the Cursor adapter given commands that are not commits → allows them', () => {
  const res = runCursorHook({
    hook_event_name: 'beforeShellExecution',
    command: 'ls -la',
    workspace_roots: [root],
  }, root);
  assert.strictEqual(res.permission, 'allow');
});

const BP = '.bouncer/context/epics/001-x/blueprints/001-y';

// A repository with an active blueprint whose affected_paths cover src/feature
// only, and one staged file on each side of that boundary.
function fixtureRepo() {
  const repo = fs.mkdtempSync(path.join(os.tmpdir(), 'bouncer-cursor-'));
  const git = (args) => execFileSync('git', args, { cwd: repo, stdio: 'ignore' });
  git(['init', '--quiet']);
  fs.mkdirSync(path.join(repo, BP, 'tasks/001'), { recursive: true });
  fs.writeFileSync(path.join(repo, BP, 'tasks/001/tasks.md'), [
    '---', 'bouncer:', '  affected_paths:', '    - src/feature', '---', '',
  ].join('\n'));
  fs.mkdirSync(path.join(repo, 'src/feature'), { recursive: true });
  fs.mkdirSync(path.join(repo, 'src/other'), { recursive: true });
  fs.writeFileSync(path.join(repo, 'src/feature/a.js'), '// in scope\n');
  fs.writeFileSync(path.join(repo, 'src/other/b.js'), '// out of scope\n');
  writeCurrent({ repoRoot: repo, blueprint: BP, base: 'develop' });
  return { repo, git };
}

test('the Cursor adapter given a commit that reaches outside affected_paths → denies it', () => {
  const { repo, git } = fixtureRepo();
  git(['add', 'src/feature/a.js', 'src/other/b.js']);
  const res = runCursorHook({
    hook_event_name: 'beforeShellExecution',
    command: 'git commit -m x',
    workspace_roots: [repo],
  }, repo);
  assert.strictEqual(res.permission, 'deny');
  assert.match(res.userMessage, /src\/other\/b\.js/);
  // The agent needs the reason too, or it retries the same blocked commit.
  assert.match(res.agentMessage, /src\/other\/b\.js/);
  assert.ok(!res.userMessage.includes('src/feature/a.js'));
});

test('the Cursor adapter given a commit that stays inside affected_paths → allows it', () => {
  const { repo, git } = fixtureRepo();
  git(['add', 'src/feature/a.js']);
  const res = runCursorHook({
    hook_event_name: 'beforeShellExecution',
    command: 'git commit -m x',
    workspace_roots: [repo],
  }, repo);
  assert.strictEqual(res.permission, 'allow');
});

// Cursor names the workspace `workspace_roots`; reading process.cwd() instead
// would inspect whatever directory Cursor happened to launch the hook from.
test('the Cursor adapter given a workspace root different from its own cwd → judges the workspace root', () => {
  const { repo, git } = fixtureRepo();
  git(['add', 'src/other/b.js']);
  const res = runCursorHook({
    hook_event_name: 'beforeShellExecution',
    command: 'git commit -m x',
    workspace_roots: [repo],
  }, os.tmpdir());
  assert.strictEqual(res.permission, 'deny');
});
