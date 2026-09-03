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
const { writeCurrent } = require('../scripts/lib/current');

const root = path.join(__dirname, '..');
const readJson = (rel) => JSON.parse(fs.readFileSync(path.join(root, rel), 'utf8'));

const BOUNCER_ROOT_LINE = 'BOUNCER_ROOT="$(bouncer-root --auto)" || exit $?';
const LAUNCHER_SKILLS = [
  'bouncer-init', 'bouncer-plan', 'bouncer-execute', 'bouncer-commit',
  'bouncer-finalize', 'bouncer-run', 'explain-diff', 'graphify-runner',
  'migrate-ids', 'review',
];
// 호스 카탈로그에서 뺀 보조는 references/<name>/index.md에 본문이 있다.
// 워크플로·migrate-ids만 skills/<name>/SKILL.md를 유지한다.
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

test('the four plugin manifests agree on name and version', () => {
  const expectedVersion = '1.3.4';
  const claude = readJson('.claude-plugin/plugin.json');
  const cursor = readJson('.cursor-plugin/plugin.json');
  const codex = readJson('.codex-plugin/plugin.json');
  const antigravity = readJson('plugin.json');
  for (const m of [claude, cursor, codex, antigravity]) {
    assert.strictEqual(m.name, 'bouncer');
    assert.strictEqual(m.version, expectedVersion);
    assert.strictEqual(m.version, claude.version);
  }
});

// Antigravity discovers skills/ · agents/ · hooks/ by convention. Re-declaring
// those path keys in the root plugin.json is how the host rejects the plugin.
test('the Antigravity root plugin.json omits convention path keys', () => {
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
test('the Cursor manifest points hooks at the Cursor hook file', () => {
  const cursor = readJson('.cursor-plugin/plugin.json');
  assert.strictEqual(cursor.hooks, './hooks/cursor-hooks.json');
  assert.ok(fs.existsSync(path.join(root, 'hooks/cursor-hooks.json')));
});

test('cursor-hooks.json registers commit safety on beforeShellExecution', () => {
  const hooks = readJson('hooks/cursor-hooks.json');
  assert.strictEqual(hooks.version, 1);
  const entries = hooks.hooks.beforeShellExecution;
  assert.ok(Array.isArray(entries), 'no beforeShellExecution entries');
  assert.ok(entries[0].command.includes('cursor-commit-safety.js'));
});

// Single-plugin repos only need plugin.json. marketplace.json is for
// multi-plugin Cursor marketplaces; Claude Code still uses
// .claude-plugin/marketplace.json for /plugin marketplace add.
test('the Cursor plugin has no marketplace.json', () => {
  assert.ok(
    !fs.existsSync(path.join(root, '.cursor-plugin/marketplace.json')),
    'single-plugin Cursor layout must omit .cursor-plugin/marketplace.json',
  );
});

// Codex's official validator rejects a `hooks` key in plugin.json, but still
// auto-discovers hooks/hooks.json. Declaring hooks here would fail validation
// and keep the plugin from installing.
test('the Codex manifest omits hooks and points skills at ./skills/', () => {
  const codex = readJson('.codex-plugin/plugin.json');
  assert.ok(!('hooks' in codex), 'Codex plugin.json must not declare hooks');
  assert.strictEqual(codex.skills, './skills/');
  assert.ok(codex.interface && typeof codex.interface === 'object');
});

test('the Codex marketplace lists bouncer at the repository root', () => {
  const market = readJson('.agents/plugins/marketplace.json');
  const entry = (market.plugins || []).find((p) => p.name === 'bouncer');
  assert.ok(entry, 'no bouncer entry');
  assert.deepStrictEqual(entry.source, { source: 'local', path: './' });
});

test('workflow shells resolve roots through the installed launcher', () => {
  for (const name of LAUNCHER_SKILLS) {
    const file = launcherSkillPath(name);
    const src = fs.readFileSync(file, 'utf8');
    const label = path.relative(root, file);
    assert.ok(
      !src.includes('CLAUDE_PLUGIN_ROOT') && !src.includes('PLUGIN_ROOT'),
      `${label} must not interpolate host root variables`,
    );
    assert.ok(
      src.includes(BOUNCER_ROOT_LINE),
      `${label} is missing the BOUNCER_ROOT resolution line`,
    );
    assert.ok(src.includes('${BOUNCER_ROOT}'), `${label} does not use BOUNCER_ROOT`);
  }
  const cursorHooks = fs.readFileSync(path.join(root, 'hooks/cursor-hooks.json'), 'utf8');
  assert.ok(
    !cursorHooks.includes('CLAUDE_PLUGIN_ROOT'),
    'cursor-hooks.json must not name CLAUDE_PLUGIN_ROOT',
  );
});

// Each fenced block is executed as its own shell, so an assignment made in an
// earlier block is gone by the time a later one runs. A block that reads
// ${BOUNCER_ROOT} without setting it first resolves to an empty prefix and
// runs `node /scripts/bouncer`.
test('every launcher shell block resolves BOUNCER_ROOT independently', () => {
  const workflowSkills = LAUNCHER_SKILLS.map(launcherSkillPath);
  const offenders = [];
  for (const file of workflowSkills) {
    const src = fs.readFileSync(file, 'utf8');
    const label = path.relative(root, file);
    for (const m of src.matchAll(/( *)```bash\n(.*?)\1```/gs)) {
      const body = m[2];
      if (!body.includes('${BOUNCER_ROOT}')) continue;
      if (!body.includes(BOUNCER_ROOT_LINE)) {
        offenders.push(`${label}: ${body.split('\n')[0].trim()}`);
      }
    }
  }
  assert.deepStrictEqual(offenders, [], `blocks read BOUNCER_ROOT without launcher:\n${offenders.join('\n')}`);
});

function runCursorHook(payload, cwd) {
  const out = execFileSync(process.execPath, [path.join(root, 'hooks/cursor-commit-safety.js')], {
    input: JSON.stringify(payload), encoding: 'utf8', cwd,
  });
  return JSON.parse(out);
}

// The adapter's whole job is translation: Cursor decides from stdout JSON, not
// from an exit code. A non-commit command must not be denied, and a commit that
// the shared guard rejects must come back as a deny carrying the reason.
test('the Cursor adapter allows commands that are not commits', () => {
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

test('the Cursor adapter denies a commit that reaches outside affected_paths', () => {
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

test('the Cursor adapter allows a commit that stays inside affected_paths', () => {
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
test('the Cursor adapter judges the workspace root, not its own cwd', () => {
  const { repo, git } = fixtureRepo();
  git(['add', 'src/other/b.js']);
  const res = runCursorHook({
    hook_event_name: 'beforeShellExecution',
    command: 'git commit -m x',
    workspace_roots: [repo],
  }, os.tmpdir());
  assert.strictEqual(res.permission, 'deny');
});
