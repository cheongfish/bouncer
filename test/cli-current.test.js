'use strict';
const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const yaml = require('js-yaml');
const { execFileSync } = require('node:child_process');
const { runCli } = require('../scripts/lib/cli');
const { readCurrent, writeCurrent } = require('../scripts/lib/current');
const { ensureEpicIndexEntry } = require('../scripts/lib/epic-index');

const BP_REL = '.bouncer/context/epics/EPIC-001-auth/blueprints/BP-001-login';

function capture(argv) {
  const buf = { out: '', err: '' };
  const code = runCli(argv, {
    out: (s) => { buf.out += s; },
    err: (s) => { buf.err += s; },
  });
  return { code, ...buf };
}

function writeDoc(repo, rel, data, body = '# x\n') {
  const abs = path.join(repo, rel);
  fs.mkdirSync(path.dirname(abs), { recursive: true });
  fs.writeFileSync(abs, `---\n${yaml.dump(data)}---\n${body}`);
}

function tmpGitRepo() {
  const repo = fs.mkdtempSync(path.join(os.tmpdir(), 'bouncer-cli-current-'));
  execFileSync('git', ['init', '--quiet'], { cwd: repo });
  return repo;
}

const PLAN_BODY = `# Tasks

## Goal & intent
Ship login validation.

## Interface
\`validateLogin(input) -> Result\`

## Touch
- \`src/auth/\`
- \`test/auth/\`

## Do not touch
- \`src/payments/\`

## Checklist
- [ ] implement validateLogin
`;

function writePlanPassingBlueprint(repo) {
  writeDoc(repo, '.bouncer/context/epics/EPIC-001-auth/index.md', {
    type: 'bouncer.epic', title: 'Auth epic', description: 'EPIC-001',
    resource: '.bouncer/context/epics/EPIC-001-auth/index.md',
    tags: ['bouncer', 'epic'], timestamp: '2026-07-01T00:00:00+09:00',
    bouncer: { id: 'EPIC-001', epic_id: 'EPIC-001', status: 'approved' },
  });
  writeDoc(repo, `${BP_REL}/index.md`, {
    type: 'bouncer.blueprint', title: 'Login blueprint', description: 'BP-001',
    resource: `${BP_REL}/index.md`,
    tags: ['bouncer', 'blueprint'], timestamp: '2026-07-01T00:00:00+09:00',
    bouncer: {
      id: 'BP-001', epic_id: 'EPIC-001', blueprint_id: 'BP-001', status: 'approved',
    },
  });
  writeDoc(repo, `${BP_REL}/tasks.md`, {
    type: 'bouncer.tasks', title: 'Login tasks', description: 'Tasks for BP-001',
    resource: `${BP_REL}/tasks.md`,
    tags: ['bouncer', 'tasks'], timestamp: '2026-07-01T00:00:00+09:00',
    bouncer: {
      id: 'TASKS-BP-001', epic_id: 'EPIC-001', blueprint_id: 'BP-001', status: 'ready',
      graph: { suggested_paths: ['src/'], basis: 'manual: src/' },
      affected_paths: ['./src/auth/login.js', './test/auth/login.test.js'],
    },
  }, PLAN_BODY);
  ensureEpicIndexEntry({
    repoRoot: repo, epicId: 'EPIC-001', name: 'auth', description: 'Epic EPIC-001',
  });
}

test('current with no pointer returns null and ready candidates', () => {
  const repo = tmpGitRepo();
  writePlanPassingBlueprint(repo);
  const r = capture(['current', '--repo', repo]);
  assert.strictEqual(r.code, 0);
  const parsed = JSON.parse(r.out);
  assert.strictEqual(parsed.ok, true);
  assert.strictEqual(parsed.current, null);
  assert.ok(parsed.ready.length > 0);
  assert.strictEqual(parsed.ready[0].blueprint, BP_REL);
  assert.strictEqual(parsed.ready[0].status, 'ready');
});

test('current with a pointer omits ready', () => {
  const repo = tmpGitRepo();
  writeCurrent({ repoRoot: repo, blueprint: BP_REL, base: 'develop' });
  const r = capture(['current', '--repo', repo]);
  assert.strictEqual(r.code, 0);
  const parsed = JSON.parse(r.out);
  assert.strictEqual(parsed.ok, true);
  assert.deepStrictEqual(parsed.current, { blueprint: BP_REL, base: 'develop' });
  assert.strictEqual(parsed.ready, undefined);
});

test('current --set writes pointer when plan gate passes', () => {
  const repo = tmpGitRepo();
  writePlanPassingBlueprint(repo);
  const r = capture(['current', '--repo', repo, '--set', BP_REL]);
  assert.strictEqual(r.code, 0);
  const parsed = JSON.parse(r.out);
  assert.strictEqual(parsed.ok, true);
  assert.deepStrictEqual(parsed.current, { blueprint: BP_REL, base: 'develop' });
  assert.deepStrictEqual(readCurrent({ repoRoot: repo }), {
    blueprint: BP_REL, base: 'develop',
  });
});

test('current --set respects --base and config base_branch', () => {
  const repo = tmpGitRepo();
  writePlanPassingBlueprint(repo);
  const withFlag = capture(['current', '--repo', repo, '--set', BP_REL, '--base', 'main']);
  assert.strictEqual(withFlag.code, 0);
  assert.strictEqual(JSON.parse(withFlag.out).current.base, 'main');

  capture(['current', '--repo', repo, '--clear']);
  fs.mkdirSync(path.join(repo, '.bouncer'), { recursive: true });
  fs.writeFileSync(
    path.join(repo, '.bouncer', 'config.json'),
    JSON.stringify({ base_branch: 'trunk' }),
  );
  const withConfig = capture(['current', '--repo', repo, '--set', BP_REL]);
  assert.strictEqual(withConfig.code, 0);
  assert.strictEqual(JSON.parse(withConfig.out).current.base, 'trunk');
});

test('current --set does not write pointer when plan gate fails', () => {
  const repo = tmpGitRepo();
  // Blueprint documents exist but fail the plan gate (draft statuses).
  writeDoc(repo, '.bouncer/context/epics/EPIC-001-auth/index.md', {
    type: 'bouncer.epic', title: 'Auth epic', description: 'EPIC-001',
    resource: '.bouncer/context/epics/EPIC-001-auth/index.md',
    tags: ['bouncer', 'epic'], timestamp: '2026-07-01T00:00:00+09:00',
    bouncer: { id: 'EPIC-001', epic_id: 'EPIC-001', status: 'draft' },
  });
  writeDoc(repo, `${BP_REL}/index.md`, {
    type: 'bouncer.blueprint', title: 'Login blueprint', description: 'BP-001',
    resource: `${BP_REL}/index.md`,
    tags: ['bouncer', 'blueprint'], timestamp: '2026-07-01T00:00:00+09:00',
    bouncer: {
      id: 'BP-001', epic_id: 'EPIC-001', blueprint_id: 'BP-001', status: 'draft',
    },
  });
  writeDoc(repo, `${BP_REL}/tasks.md`, {
    type: 'bouncer.tasks', title: 'Login tasks', description: 'Tasks for BP-001',
    resource: `${BP_REL}/tasks.md`,
    tags: ['bouncer', 'tasks'], timestamp: '2026-07-01T00:00:00+09:00',
    bouncer: {
      id: 'TASKS-BP-001', epic_id: 'EPIC-001', blueprint_id: 'BP-001', status: 'draft',
      affected_paths: [],
    },
  });
  const r = capture(['current', '--repo', repo, '--set', BP_REL]);
  assert.strictEqual(r.code, 1);
  const parsed = JSON.parse(r.out);
  assert.strictEqual(parsed.ok, false);
  assert.ok(Array.isArray(parsed.failures));
  assert.ok(parsed.failures.length > 0);
  assert.strictEqual(readCurrent({ repoRoot: repo }), null);
});

test('current --set without a value exits 2', () => {
  assert.strictEqual(capture(['current', '--set']).code, 2);
  assert.match(capture(['current', '--set']).err, /--set requires a blueprint directory/);
  assert.strictEqual(capture(['current', '--set', '--clear']).code, 2);
});

test('current --set and --clear together exit 2', () => {
  const r = capture(['current', '--set', BP_REL, '--clear']);
  assert.strictEqual(r.code, 2);
  assert.match(r.err, /--set and --clear are mutually exclusive/);
});

test('current --clear is idempotent', () => {
  const repo = tmpGitRepo();
  writeCurrent({ repoRoot: repo, blueprint: BP_REL, base: 'develop' });
  assert.strictEqual(capture(['current', '--repo', repo, '--clear']).code, 0);
  const again = capture(['current', '--repo', repo, '--clear']);
  assert.strictEqual(again.code, 0);
  const parsed = JSON.parse(again.out);
  assert.strictEqual(parsed.ok, true);
  assert.strictEqual(parsed.current, null);
  assert.strictEqual(readCurrent({ repoRoot: repo }), null);
});
