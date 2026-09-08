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

const BP_REL = '.bouncer/context/epics/001-auth/blueprints/001-login';
const BP_OTHER = '.bouncer/context/epics/002-billing/blueprints/001-invoices';

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
  // 묶음은 세 문서가 다 있어야 구조 검사를 지난다. task 문서를 쓸 때 짝 문서가
  // 없으면 pending 상태로 채워 fixture마다 같은 보일러플레이트를 반복하지 않는다.
  const unit = /^(.*)\/tasks\/(\d{3})\/tasks\.md$/.exec(rel);
  if (data && data.type === 'bouncer.tasks' && unit) {
    writeUnitSiblings(repo, unit[1], unit[2], data.bouncer || {});
  }
}

function writeUnitSiblings(repo, bpDir, number, { epic_id: epicId, blueprint_id: bpId }) {
  for (const [kind, prefix] of [['verification', 'VERIFY'], ['review', 'REVIEW']]) {
    const rel = `${bpDir}/tasks/${number}/${kind}.md`;
    if (fs.existsSync(path.join(repo, rel))) continue;
    writeDoc(repo, rel, {
      type: `bouncer.${kind}`, title: kind, description: kind, resource: rel,
      tags: ['bouncer'], timestamp: '2026-07-01T00:00:00+09:00',
      bouncer: {
        id: `${prefix}-${number}`, epic_id: epicId, blueprint_id: bpId, status: 'pending',
        ...(kind === 'review' ? { review: { required: true } } : {}),
      },
    });
  }
}

// current --set이 plan 게이트를 타므로, 통과 fixture는 G18이 요구하는
// accepted context-review.md를 함께 둔다. 일부러 문서를 빼는 실패 케이스는
// 이 헬퍼를 부르지 않는다.
function writeAcceptedContextReview(repo) {
  writeDoc(repo, `${BP_REL}/context-review.md`, {
    type: 'bouncer.context_review',
    title: '001 context review',
    description: 'Context review for 001',
    resource: `${BP_REL}/context-review.md`,
    tags: ['bouncer', 'context_review'],
    timestamp: '2026-07-01T00:00:00+09:00',
    bouncer: {
      id: 'CTXREVIEW-001',
      epic_id: '001',
      blueprint_id: '001',
      status: 'accepted',
      context_review: { findings: [] },
    },
  }, '# Context review\n\n## Findings\n(none)\n');
}

function tmpGitRepo() {
  const repo = fs.mkdtempSync(path.join(os.tmpdir(), 'bouncer-cli-current-'));
  execFileSync('git', ['init', '--quiet'], { cwd: repo });
  return repo;
}

function headBranch(repo) {
  return execFileSync('git', ['symbolic-ref', '--short', 'HEAD'], {
    cwd: repo,
    encoding: 'utf8',
  }).trim();
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
  writeDoc(repo, '.bouncer/context/epics/001-auth/index.md', {
    type: 'bouncer.epic', title: 'Auth epic', description: '001',
    resource: '.bouncer/context/epics/001-auth/index.md',
    tags: ['bouncer', 'epic'], timestamp: '2026-07-01T00:00:00+09:00',
    bouncer: { id: '001', epic_id: '001', status: 'approved' },
  });
  writeDoc(repo, `${BP_REL}/index.md`, {
    type: 'bouncer.blueprint', title: 'Login blueprint', description: '001',
    resource: `${BP_REL}/index.md`,
    tags: ['bouncer', 'blueprint'], timestamp: '2026-07-01T00:00:00+09:00',
    bouncer: {
      id: '001', epic_id: '001', blueprint_id: '001', status: 'approved',
    },
  });
  writeDoc(repo, `${BP_REL}/tasks/001/tasks.md`, {
    type: 'bouncer.tasks', title: 'Login tasks', description: 'Tasks for 001',
    resource: `${BP_REL}/tasks/001/tasks.md`,
    tags: ['bouncer', 'tasks'], timestamp: '2026-07-01T00:00:00+09:00',
    bouncer: {
      id: 'TASKS-001', epic_id: '001', blueprint_id: '001', status: 'ready',
      graph: { suggested_paths: ['src/'], basis: 'manual: src/' },
      affected_paths: ['./src/auth/login.js', './test/auth/login.test.js'],
    },
  }, PLAN_BODY);
  ensureEpicIndexEntry({
    repoRoot: repo, epicId: '001', name: 'auth', description: 'Epic 001',
  });
  writeAcceptedContextReview(repo);
}

function writeAcceptedContextReviewAt(repo, bpRel, epicId, bpId) {
  writeDoc(repo, `${bpRel}/context-review.md`, {
    type: 'bouncer.context_review',
    title: `${bpId} context review`,
    description: `Context review for ${bpId}`,
    resource: `${bpRel}/context-review.md`,
    tags: ['bouncer', 'context_review'],
    timestamp: '2026-07-01T00:00:00+09:00',
    bouncer: {
      id: `CTXREVIEW-${bpId}`,
      epic_id: epicId,
      blueprint_id: bpId,
      status: 'accepted',
      context_review: { findings: [] },
    },
  }, '# Context review\n\n## Findings\n(none)\n');
}

function writeOtherPlanPassingBlueprint(repo) {
  writeDoc(repo, '.bouncer/context/epics/002-billing/index.md', {
    type: 'bouncer.epic', title: 'Billing epic', description: '002',
    resource: '.bouncer/context/epics/002-billing/index.md',
    tags: ['bouncer', 'epic'], timestamp: '2026-07-01T00:00:00+09:00',
    bouncer: { id: '002', epic_id: '002', status: 'approved' },
  });
  writeDoc(repo, `${BP_OTHER}/index.md`, {
    type: 'bouncer.blueprint', title: 'Invoices blueprint', description: '002',
    resource: `${BP_OTHER}/index.md`,
    tags: ['bouncer', 'blueprint'], timestamp: '2026-07-01T00:00:00+09:00',
    bouncer: {
      id: '001', epic_id: '002', blueprint_id: '001', status: 'approved',
    },
  });
  const otherBody = `# Tasks

## Goal & intent
Ship invoice totals.

## Interface
\`sumInvoices(input) -> Result\`

## Touch
- \`src/billing/\`
- \`test/billing/\`

## Do not touch
- \`src/auth/\`

## Checklist
- [ ] implement sumInvoices
`;
  writeDoc(repo, `${BP_OTHER}/tasks/001/tasks.md`, {
    type: 'bouncer.tasks', title: 'Invoice tasks', description: 'Tasks for 002',
    resource: `${BP_OTHER}/tasks/001/tasks.md`,
    tags: ['bouncer', 'tasks'], timestamp: '2026-07-01T00:00:00+09:00',
    bouncer: {
      id: 'TASKS-001', epic_id: '002', blueprint_id: '001', status: 'ready',
      graph: { suggested_paths: ['src/'], basis: 'manual: src/' },
      affected_paths: ['./src/billing/invoices.js', './test/billing/invoices.test.js'],
    },
  }, otherBody);
  ensureEpicIndexEntry({
    repoRoot: repo, epicId: '002', name: 'billing', description: 'Epic 002',
  });
  writeAcceptedContextReviewAt(repo, BP_OTHER, '002', '001');
}

function pointerFile(repo) {
  return path.join(repo, '.git', 'bouncer', 'current');
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
  // writePlanPassingBlueprint 없이 포인터만 쓰면 index.md 가 없어 scale 은 null.
  assert.deepStrictEqual(parsed.current, { blueprint: BP_REL, base: 'develop', task: null, scale: null });
  assert.strictEqual(parsed.ready, undefined);
});

test('current --set writes pointer when plan gate passes', () => {
  const repo = tmpGitRepo();
  writePlanPassingBlueprint(repo);
  const r = capture(['current', '--repo', repo, '--set', BP_REL]);
  assert.strictEqual(r.code, 0);
  const parsed = JSON.parse(r.out);
  assert.strictEqual(parsed.ok, true);
  const base = headBranch(repo);
  // 묶음이 하나뿐이면 자동 선택으로 그 문서가 task 가 된다.
  // CLI 응답은 path+id; 포인터 파일은 path 문자열.
  assert.deepStrictEqual(parsed.current, {
    blueprint: BP_REL,
    base,
    task: { path: `${BP_REL}/tasks/001/tasks.md`, id: 'TASKS-001' },
    scale: null,
  });
  assert.deepStrictEqual(readCurrent({ repoRoot: repo }), {
    blueprint: BP_REL, base, task: `${BP_REL}/tasks/001/tasks.md`,
  });
});

test('current --set presents bouncer.scale from blueprint index', () => {
  const repo = tmpGitRepo();
  writePlanPassingBlueprint(repo);
  writeDoc(repo, `${BP_REL}/index.md`, {
    type: 'bouncer.blueprint', title: 'Login blueprint', description: '001',
    resource: `${BP_REL}/index.md`,
    tags: ['bouncer', 'blueprint'], timestamp: '2026-07-01T00:00:00+09:00',
    bouncer: {
      id: '001', epic_id: '001', blueprint_id: '001', status: 'approved',
      scale: 'full',
    },
  });
  const r = capture(['current', '--repo', repo, '--set', BP_REL]);
  assert.strictEqual(r.code, 0);
  const parsed = JSON.parse(r.out);
  assert.strictEqual(parsed.ok, true);
  assert.strictEqual(parsed.current.scale, 'full');
  // 파생값은 응답에만 싣는다. 포인터 파일 스키마는 { blueprint, task, base }.
  assert.deepStrictEqual(readCurrent({ repoRoot: repo }), {
    blueprint: BP_REL, base: headBranch(repo), task: `${BP_REL}/tasks/001/tasks.md`,
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

test('current --set falls back to the checkout branch when config omits base_branch', () => {
  const repo = fs.mkdtempSync(path.join(os.tmpdir(), 'bouncer-cli-current-'));
  execFileSync('git', ['init', '-b', 'feature', '--quiet'], { cwd: repo });
  writePlanPassingBlueprint(repo);
  const r = capture(['current', '--repo', repo, '--set', BP_REL]);
  assert.strictEqual(r.code, 0);
  const parsed = JSON.parse(r.out);
  assert.strictEqual(parsed.current.base, 'feature');
  assert.notStrictEqual(parsed.current.base, 'develop');
});

test('current --set does not write a pointer when HEAD is detached and config omits base_branch', () => {
  const repo = fs.mkdtempSync(path.join(os.tmpdir(), 'bouncer-cli-current-'));
  execFileSync('git', ['init', '-b', 'main', '--quiet'], { cwd: repo });
  execFileSync('git', ['commit', '--allow-empty', '-m', 'seed'], {
    cwd: repo,
    env: {
      ...process.env,
      GIT_AUTHOR_NAME: 'bouncer-test',
      GIT_AUTHOR_EMAIL: 't@example.com',
      GIT_COMMITTER_NAME: 'bouncer-test',
      GIT_COMMITTER_EMAIL: 't@example.com',
    },
  });
  execFileSync('git', ['checkout', '--detach', '--quiet'], { cwd: repo });
  writePlanPassingBlueprint(repo);
  const r = capture(['current', '--repo', repo, '--set', BP_REL]);
  assert.strictEqual(r.code, 1);
  assert.strictEqual(readCurrent({ repoRoot: repo }), null);
  assert.match(r.err, /cannot resolve base/);
  assert.doesNotMatch(r.out + r.err, /"base":\s*""/);
});

test('current --set does not write pointer when plan gate fails', () => {
  const repo = tmpGitRepo();
  // Blueprint documents exist but fail the plan gate (draft statuses).
  writeDoc(repo, '.bouncer/context/epics/001-auth/index.md', {
    type: 'bouncer.epic', title: 'Auth epic', description: '001',
    resource: '.bouncer/context/epics/001-auth/index.md',
    tags: ['bouncer', 'epic'], timestamp: '2026-07-01T00:00:00+09:00',
    bouncer: { id: '001', epic_id: '001', status: 'draft' },
  });
  writeDoc(repo, `${BP_REL}/index.md`, {
    type: 'bouncer.blueprint', title: 'Login blueprint', description: '001',
    resource: `${BP_REL}/index.md`,
    tags: ['bouncer', 'blueprint'], timestamp: '2026-07-01T00:00:00+09:00',
    bouncer: {
      id: '001', epic_id: '001', blueprint_id: '001', status: 'draft',
    },
  });
  writeDoc(repo, `${BP_REL}/tasks/001/tasks.md`, {
    type: 'bouncer.tasks', title: 'Login tasks', description: 'Tasks for 001',
    resource: `${BP_REL}/tasks/001/tasks.md`,
    tags: ['bouncer', 'tasks'], timestamp: '2026-07-01T00:00:00+09:00',
    bouncer: {
      id: 'TASKS-001', epic_id: '001', blueprint_id: '001', status: 'draft',
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

function writeNumberedPlanBlueprint(repo) {
  writeDoc(repo, '.bouncer/context/epics/001-auth/index.md', {
    type: 'bouncer.epic', title: 'Auth epic', description: '001',
    resource: '.bouncer/context/epics/001-auth/index.md',
    tags: ['bouncer', 'epic'], timestamp: '2026-07-01T00:00:00+09:00',
    bouncer: { id: '001', epic_id: '001', status: 'approved' },
  });
  writeDoc(repo, `${BP_REL}/index.md`, {
    type: 'bouncer.blueprint', title: 'Login blueprint', description: '001',
    resource: `${BP_REL}/index.md`,
    tags: ['bouncer', 'blueprint'], timestamp: '2026-07-01T00:00:00+09:00',
    bouncer: {
      id: '001', epic_id: '001', blueprint_id: '001', status: 'approved',
    },
  });
  for (const nnn of ['001', '002']) {
    writeDoc(repo, `${BP_REL}/tasks/${nnn}/tasks.md`, {
      type: 'bouncer.tasks', title: `Login tasks ${nnn}`, description: 'Tasks',
      resource: `${BP_REL}/tasks/${nnn}/tasks.md`,
      tags: ['bouncer', 'tasks'], timestamp: '2026-07-01T00:00:00+09:00',
      bouncer: {
        id: `TASKS-${nnn}`, epic_id: '001', blueprint_id: '001', status: 'ready',
        graph: { suggested_paths: ['src/'], basis: 'manual: src/' },
        affected_paths: [`./src/auth/${nnn}.js`],
      },
    }, PLAN_BODY);
  }
  ensureEpicIndexEntry({
    repoRoot: repo, epicId: '001', name: 'auth', description: 'Epic 001',
  });
  writeAcceptedContextReview(repo);
}

test('current --set --task 002 records that task document', () => {
  const repo = tmpGitRepo();
  writeNumberedPlanBlueprint(repo);
  const r = capture(['current', '--repo', repo, '--set', BP_REL, '--task', '002']);
  assert.strictEqual(r.code, 0);
  const parsed = JSON.parse(r.out);
  assert.strictEqual(parsed.ok, true);
  const base = headBranch(repo);
  assert.deepStrictEqual(parsed.current, {
    blueprint: BP_REL,
    base,
    task: { path: `${BP_REL}/tasks/002/tasks.md`, id: 'TASKS-002' },
    scale: null,
  });
  assert.deepStrictEqual(readCurrent({ repoRoot: repo }), {
    blueprint: BP_REL,
    base,
    task: `${BP_REL}/tasks/002/tasks.md`,
  });
});

test('current --set --task with missing number exits 2 and writes no pointer', () => {
  const repo = tmpGitRepo();
  writeNumberedPlanBlueprint(repo);
  const r = capture(['current', '--repo', repo, '--set', BP_REL, '--task', '099']);
  assert.strictEqual(r.code, 2);
  assert.match(r.err, /TASKS-001/);
  assert.match(r.err, /TASKS-002/);
  assert.strictEqual(readCurrent({ repoRoot: repo }), null);
});

test('current --task without --set exits 2', () => {
  const r = capture(['current', '--task', '001']);
  assert.strictEqual(r.code, 2);
  assert.match(r.err, /--task requires --set/);
});

test('current --clear --task exits 2', () => {
  const r = capture(['current', '--clear', '--task', '001']);
  assert.strictEqual(r.code, 2);
  assert.match(r.err, /--clear and --task/);
});

test('bare current JSON includes a task key on the pointer', () => {
  const repo = tmpGitRepo();
  writeNumberedPlanBlueprint(repo);
  writeCurrent({
    repoRoot: repo,
    blueprint: BP_REL,
    base: 'develop',
    task: `${BP_REL}/tasks/001/tasks.md`,
  });
  const r = capture(['current', '--repo', repo]);
  assert.strictEqual(r.code, 0);
  const parsed = JSON.parse(r.out);
  assert.strictEqual(parsed.ok, true);
  assert.ok(Object.prototype.hasOwnProperty.call(parsed.current, 'task'));
  assert.deepStrictEqual(parsed.current.task, {
    path: `${BP_REL}/tasks/001/tasks.md`,
    id: 'TASKS-001',
  });
});

test('current --set of a different blueprint without --replace adds a parallel key', () => {
  const repo = tmpGitRepo();
  writePlanPassingBlueprint(repo);
  writeOtherPlanPassingBlueprint(repo);
  writeCurrent({ repoRoot: repo, blueprint: BP_REL, base: 'develop' });
  const before = readCurrent({ repoRoot: repo });
  const r = capture(['current', '--repo', repo, '--set', BP_OTHER]);
  assert.strictEqual(r.code, 0);
  const parsed = JSON.parse(r.out);
  assert.strictEqual(parsed.ok, true);
  assert.strictEqual(parsed.current.blueprint, BP_OTHER);
  assert.ok(fs.existsSync(nsFile(repo, '001', '001')));
  assert.ok(fs.existsSync(nsFile(repo, '002', '001')));
  assert.deepStrictEqual(
    JSON.parse(fs.readFileSync(nsFile(repo, '001', '001'), 'utf8')),
    { blueprint: before.blueprint, base: before.base },
  );
});

test('current --set --replace switches a different blueprint and reports previous', () => {
  const repo = tmpGitRepo();
  writePlanPassingBlueprint(repo);
  writeOtherPlanPassingBlueprint(repo);
  writeCurrent({
    repoRoot: repo,
    blueprint: BP_REL,
    base: 'develop',
    task: `${BP_REL}/tasks/001/tasks.md`,
  });
  const r = capture(['current', '--repo', repo, '--set', BP_OTHER, '--replace']);
  assert.strictEqual(r.code, 0);
  const parsed = JSON.parse(r.out);
  assert.strictEqual(parsed.ok, true);
  const previous = {
    blueprint: BP_REL,
    base: 'develop',
    task: `${BP_REL}/tasks/001/tasks.md`,
  };
  assert.deepStrictEqual(parsed.previous, previous);
  assert.strictEqual(parsed.current.blueprint, BP_OTHER);
  assert.match(r.err, /previous/);
  assert.match(r.err, new RegExp(BP_REL.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')));
  const stored = readCurrent({ repoRoot: repo });
  assert.strictEqual(stored.blueprint, BP_OTHER);
  assert.strictEqual(stored.task, `${BP_OTHER}/tasks/001/tasks.md`);
});

test('current --set of the same blueprint updates task and base without --replace', () => {
  const repo = tmpGitRepo();
  writeNumberedPlanBlueprint(repo);
  writeCurrent({
    repoRoot: repo,
    blueprint: BP_REL,
    base: 'develop',
    task: `${BP_REL}/tasks/001/tasks.md`,
  });
  const r = capture([
    'current', '--repo', repo, '--set', BP_REL, '--task', '002', '--base', 'main',
  ]);
  assert.strictEqual(r.code, 0);
  const parsed = JSON.parse(r.out);
  assert.strictEqual(parsed.ok, true);
  assert.strictEqual(parsed.previous, undefined);
  assert.deepStrictEqual(parsed.current.task, {
    path: `${BP_REL}/tasks/002/tasks.md`,
    id: 'TASKS-002',
  });
  assert.strictEqual(parsed.current.base, 'main');
  assert.deepStrictEqual(readCurrent({ repoRoot: repo }), {
    blueprint: BP_REL,
    base: 'main',
    task: `${BP_REL}/tasks/002/tasks.md`,
  });
});

test('current usage describes parallel --set and CURRENT_AMBIGUOUS --replace', () => {
  const { current } = require('../scripts/lib/cli-current-command');
  assert.match(current.usage, /parallel key/);
  assert.match(current.usage, /CURRENT_AMBIGUOUS/);
  assert.doesNotMatch(current.usage, /omitted, a conflict exits 2/);
});

test('current --replace without --set exits 2', () => {
  const r = capture(['current', '--replace']);
  assert.strictEqual(r.code, 2);
  assert.match(r.err, /--replace requires --set/);
});

test('current --clear --replace exits 2', () => {
  const r = capture(['current', '--clear', '--replace']);
  assert.strictEqual(r.code, 2);
  assert.match(r.err, /--clear and --replace/);
});

function gitCommit(repo, message) {
  execFileSync('git', ['add', '.'], { cwd: repo });
  execFileSync('git', [
    '-c', 'user.name=Bouncer Test', '-c', 'user.email=test@example.com',
    'commit', '-m', message,
  ], { cwd: repo });
}

function addWorktree(repo, rel) {
  const abs = path.join(repo, rel);
  fs.mkdirSync(path.dirname(abs), { recursive: true });
  execFileSync('git', ['worktree', 'add', '--quiet', '--detach', abs], { cwd: repo });
  return abs;
}

function nsFile(repo, epicId, bpId) {
  return path.join(repo, '.git', 'bouncer', 'pointers', epicId, `${bpId}.json`);
}

function storedPointer(blueprint, base, task) {
  return { blueprint, base, task: task == null ? null : task };
}

test('current --set adds a parallel namespace key and preserves the other', () => {
  const repo = tmpGitRepo();
  writePlanPassingBlueprint(repo);
  writeOtherPlanPassingBlueprint(repo);
  writeCurrent({ repoRoot: repo, blueprint: BP_REL, base: 'develop' });
  const r = capture(['current', '--repo', repo, '--set', BP_OTHER]);
  assert.strictEqual(r.code, 0);
  const parsed = JSON.parse(r.out);
  assert.strictEqual(parsed.ok, true);
  assert.strictEqual(parsed.current.blueprint, BP_OTHER);
  assert.ok(fs.existsSync(nsFile(repo, '001', '001')));
  assert.ok(fs.existsSync(nsFile(repo, '002', '001')));
});

test('current --replace at a nested worktree replaces only the selected key', () => {
  const repo = tmpGitRepo();
  writePlanPassingBlueprint(repo);
  writeOtherPlanPassingBlueprint(repo);
  gitCommit(repo, 'docs');
  const nested = addWorktree(repo, '.worktrees/001/001');
  writeCurrent({
    repoRoot: repo,
    blueprint: BP_REL,
    base: 'develop',
    task: `${BP_REL}/tasks/001/tasks.md`,
  });
  writeCurrent({ repoRoot: repo, blueprint: BP_OTHER, base: 'main' });
  const r = capture(['current', '--repo', nested, '--set', BP_OTHER, '--replace', '--base', 'main']);
  assert.strictEqual(r.code, 0);
  const parsed = JSON.parse(r.out);
  assert.strictEqual(parsed.ok, true);
  assert.deepStrictEqual(parsed.previous, storedPointer(
    BP_REL, 'develop', `${BP_REL}/tasks/001/tasks.md`,
  ));
  assert.match(r.err, /previous/);
  assert.strictEqual(fs.existsSync(nsFile(repo, '001', '001')), false);
  assert.ok(fs.existsSync(nsFile(repo, '002', '001')));
});

test('current --replace at base with multiple candidates does not guess', () => {
  const repo = tmpGitRepo();
  writePlanPassingBlueprint(repo);
  writeOtherPlanPassingBlueprint(repo);
  writeCurrent({ repoRoot: repo, blueprint: BP_REL, base: 'develop' });
  writeCurrent({ repoRoot: repo, blueprint: BP_OTHER, base: 'main' });
  const beforeA = fs.readFileSync(nsFile(repo, '001', '001'));
  const beforeB = fs.readFileSync(nsFile(repo, '002', '001'));
  const r = capture(['current', '--repo', repo, '--set', BP_REL, '--replace']);
  assert.strictEqual(r.code, 1);
  const parsed = JSON.parse(r.out);
  assert.strictEqual(parsed.ok, false);
  assert.strictEqual(parsed.reason, 'CURRENT_AMBIGUOUS');
  assert.deepStrictEqual(parsed.candidates, [
    storedPointer(BP_REL, 'develop', null),
    storedPointer(BP_OTHER, 'main', null),
  ]);
  assert.deepStrictEqual(fs.readFileSync(nsFile(repo, '001', '001')), beforeA);
  assert.deepStrictEqual(fs.readFileSync(nsFile(repo, '002', '001')), beforeB);
});

test('current at base with two pointers exits 1 with sorted storage-shaped candidates', () => {
  const repo = tmpGitRepo();
  writeCurrent({ repoRoot: repo, blueprint: BP_OTHER, base: 'main' });
  writeCurrent({
    repoRoot: repo,
    blueprint: BP_REL,
    base: 'develop',
    task: `${BP_REL}/tasks/001/tasks.md`,
  });
  const r = capture(['current', '--repo', repo]);
  assert.strictEqual(r.code, 1);
  const parsed = JSON.parse(r.out);
  assert.strictEqual(parsed.ok, false);
  assert.strictEqual(parsed.reason, 'CURRENT_AMBIGUOUS');
  assert.deepStrictEqual(parsed.candidates, [
    storedPointer(BP_REL, 'develop', `${BP_REL}/tasks/001/tasks.md`),
    storedPointer(BP_OTHER, 'main', null),
  ]);
  parsed.candidates.forEach((c) => {
    assert.strictEqual(typeof c.task === 'string' || c.task === null, true);
    assert.strictEqual(Object.prototype.hasOwnProperty.call(c, 'scale'), false);
  });
});

test('current --clear and --task at a nested worktree touch only that namespace', () => {
  const repo = tmpGitRepo();
  writeNumberedPlanBlueprint(repo);
  writeOtherPlanPassingBlueprint(repo);
  gitCommit(repo, 'docs');
  const nested = addWorktree(repo, '.worktrees/001/001');
  writeCurrent({
    repoRoot: repo,
    blueprint: BP_REL,
    base: 'develop',
    task: `${BP_REL}/tasks/001/tasks.md`,
  });
  writeCurrent({ repoRoot: repo, blueprint: BP_OTHER, base: 'main' });

  const shown = capture(['current', '--repo', nested]);
  assert.strictEqual(shown.code, 0);
  assert.strictEqual(JSON.parse(shown.out).current.blueprint, BP_REL);

  const tasked = capture([
    'current', '--repo', nested, '--set', BP_REL, '--task', '002', '--base', 'develop',
  ]);
  assert.strictEqual(tasked.code, 0);
  assert.deepStrictEqual(JSON.parse(tasked.out).current.task, {
    path: `${BP_REL}/tasks/002/tasks.md`, id: 'TASKS-002',
  });
  assert.deepStrictEqual(readCurrent({ repoRoot: nested }), {
    blueprint: BP_REL, base: 'develop', task: `${BP_REL}/tasks/002/tasks.md`,
  });
  assert.deepStrictEqual(JSON.parse(fs.readFileSync(nsFile(repo, '002', '001'), 'utf8')).blueprint, BP_OTHER);

  const cleared = capture(['current', '--repo', nested, '--clear']);
  assert.strictEqual(cleared.code, 0);
  assert.strictEqual(JSON.parse(cleared.out).current, null);
  assert.strictEqual(readCurrent({ repoRoot: nested }), null);
  assert.ok(fs.existsSync(nsFile(repo, '002', '001')));
});

test('current --set reports CURRENT_MIGRATION_INCOMPLETE and retries the leftover legacy delete', () => {
  const repo = tmpGitRepo();
  writePlanPassingBlueprint(repo);
  const legacy = pointerFile(repo);
  fs.mkdirSync(path.dirname(legacy), { recursive: true });
  fs.writeFileSync(legacy, `${JSON.stringify({
    blueprint: BP_REL, base: 'develop', task: `${BP_REL}/tasks/001/tasks.md`,
  }, null, 2)}\n`);

  const origRm = fs.rmSync;
  let denyLegacy = true;
  fs.rmSync = function patched(p, ...rest) {
    if (denyLegacy && p === legacy) {
      const err = new Error('injected legacy unlink failure');
      err.code = 'EACCES';
      throw err;
    }
    return origRm.call(fs, p, ...rest);
  };
  try {
    const first = capture([
      'current', '--repo', repo, '--set', BP_REL, '--task', '001', '--base', 'develop',
    ]);
    assert.strictEqual(first.code, 1);
    const parsed = JSON.parse(first.out);
    assert.strictEqual(parsed.ok, false);
    assert.strictEqual(parsed.reason, 'CURRENT_MIGRATION_INCOMPLETE');
    assert.ok(fs.existsSync(legacy));
    assert.ok(fs.existsSync(nsFile(repo, '001', '001')));
    assert.deepStrictEqual(
      JSON.parse(fs.readFileSync(nsFile(repo, '001', '001'), 'utf8')),
      JSON.parse(fs.readFileSync(legacy, 'utf8')),
    );

    denyLegacy = false;
    const second = capture([
      'current', '--repo', repo, '--set', BP_REL, '--task', '001', '--base', 'develop',
    ]);
    assert.strictEqual(second.code, 0);
    assert.strictEqual(JSON.parse(second.out).ok, true);
    assert.strictEqual(fs.existsSync(legacy), false);
  } finally {
    fs.rmSync = origRm;
  }
});


// --- coordinator mode -------------------------------------------------------

const { coordinate } = require('../scripts/lib/coordinator');

test('current projects the coordinator ready wave into the public payload', () => {
  const repo = tmpGitRepo();
  const blueprint = '.bouncer/context/epics/071-x/blueprints/072-y';
  fs.mkdirSync(path.join(repo, blueprint, 'tasks', '001'), { recursive: true });
  fs.writeFileSync(
    path.join(repo, blueprint, 'tasks', '001', 'tasks.md'),
    '---\nbouncer:\n  id: TASKS-001\n  parallel_safe: true\n  affected_paths:\n    - src/\n---\n# Tasks\n',
  );
  const run = (args) => execFileSync('git', args, { cwd: repo, encoding: 'utf8' });
  run(['config', 'user.email', 't@example.com']);
  run(['config', 'user.name', 't']);
  run(['add', '-A']);
  run(['commit', '--quiet', '-m', 'plan']);
  coordinate({ command: 'bootstrap', repoRoot: repo, blueprint });
  writeCurrent({ repoRoot: repo, blueprint, base: 'develop' });

  const parsed = JSON.parse(capture(['current', '--repo', repo]).out);
  assert.strictEqual(parsed.ok, true);
  assert.strictEqual(parsed.current.coordinator.status, 'ok');
  assert.deepStrictEqual(parsed.current.coordinator.ready, ['001']);
  assert.strictEqual(parsed.current.coordinator.revision, null);
  assert.strictEqual(parsed.current.coordinator.tasks[0].id, '001');
});

test('current reports an unreadable coordinator ledger instead of dropping the key', () => {
  const repo = tmpGitRepo();
  const blueprint = '.bouncer/context/epics/073-x/blueprints/074-y';
  fs.mkdirSync(path.join(repo, blueprint, 'tasks', '001'), { recursive: true });
  fs.writeFileSync(
    path.join(repo, blueprint, 'tasks', '001', 'tasks.md'),
    '---\nbouncer:\n  id: TASKS-001\n  affected_paths:\n    - src/\n---\n# Tasks\n',
  );
  const run = (args) => execFileSync('git', args, { cwd: repo, encoding: 'utf8' });
  run(['config', 'user.email', 't@example.com']);
  run(['config', 'user.name', 't']);
  run(['add', '-A']);
  run(['commit', '--quiet', '-m', 'plan']);
  coordinate({ command: 'bootstrap', repoRoot: repo, blueprint });
  const ledgerFile = path.join(
    repo, '.worktrees', '073', '074', 'integration', '.bouncer', 'runtime', 'coordinator.json',
  );
  fs.writeFileSync(ledgerFile, '{ truncated');
  writeCurrent({ repoRoot: repo, blueprint, base: 'develop' });

  const parsed = JSON.parse(capture(['current', '--repo', repo]).out);
  assert.strictEqual(parsed.current.coordinator.status, 'unreadable');
  assert.strictEqual(parsed.current.coordinator.ledgerFile, ledgerFile);
  assert.deepStrictEqual(parsed.current.coordinator.ready, []);
});
