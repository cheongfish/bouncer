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

test('pointer 없이 current → null과 ready 후보를 반환한다', () => {
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

test('pointer가 있는 current → ready를 생략한다', () => {
  const repo = tmpGitRepo();
  writeCurrent({ repoRoot: repo, blueprint: BP_REL, base: 'develop' });
  const r = capture(['current', '--repo', repo]);
  assert.strictEqual(r.code, 0);
  const parsed = JSON.parse(r.out);
  assert.strictEqual(parsed.ok, true);
  // writePlanPassingBlueprint 없이 포인터만 쓰면 index.md 가 없어 scale 은 null.
  assert.deepStrictEqual(parsed.current, {
    blueprint: BP_REL, base: 'develop', task: null, scale: null, effectiveTask: null,
  });
  assert.strictEqual(parsed.ready, undefined);
});

test('plan gate가 통과할 때 current --set → pointer를 쓴다', () => {
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
    effectiveTask: {
      source: 'pointer',
      blueprint: BP_REL,
      path: `${BP_REL}/tasks/001/tasks.md`,
      id: 'TASKS-001',
    },
  });
  assert.deepStrictEqual(readCurrent({ repoRoot: repo }), {
    blueprint: BP_REL, base, task: `${BP_REL}/tasks/001/tasks.md`,
  });
});

test('current --set → blueprint index의 bouncer.scale을 제시한다', () => {
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

test('current --set에 --base와 config base_branch가 있으면 → 이를 따른다', () => {
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

test('config에 base_branch가 없을 때 current --set → checkout branch로 대체한다', () => {
  const repo = fs.mkdtempSync(path.join(os.tmpdir(), 'bouncer-cli-current-'));
  execFileSync('git', ['init', '-b', 'feature', '--quiet'], { cwd: repo });
  writePlanPassingBlueprint(repo);
  const r = capture(['current', '--repo', repo, '--set', BP_REL]);
  assert.strictEqual(r.code, 0);
  const parsed = JSON.parse(r.out);
  assert.strictEqual(parsed.current.base, 'feature');
  assert.notStrictEqual(parsed.current.base, 'develop');
});

test('HEAD가 detached이고 config에 base_branch가 없을 때 current --set → pointer를 쓰지 않는다', () => {
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

test('plan gate가 실패할 때 current --set → pointer를 쓰지 않는다', () => {
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

test('값 없이 current --set → exit 2를 낸다', () => {
  assert.strictEqual(capture(['current', '--set']).code, 2);
  assert.match(capture(['current', '--set']).err, /--set requires a blueprint directory/);
  assert.strictEqual(capture(['current', '--set', '--clear']).code, 2);
});

test('current --set과 --clear를 함께 주면 → exit 2를 낸다', () => {
  const r = capture(['current', '--set', BP_REL, '--clear']);
  assert.strictEqual(r.code, 2);
  assert.match(r.err, /--set and --clear are mutually exclusive/);
});

test('current --clear를 반복하면 → 멱등이다', () => {
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

test('current --set --task 002 → 그 task 문서를 기록한다', () => {
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
    effectiveTask: {
      source: 'pointer',
      blueprint: BP_REL,
      path: `${BP_REL}/tasks/002/tasks.md`,
      id: 'TASKS-002',
    },
  });
  assert.deepStrictEqual(readCurrent({ repoRoot: repo }), {
    blueprint: BP_REL,
    base,
    task: `${BP_REL}/tasks/002/tasks.md`,
  });
});

test('--task 번호가 없는 current --set --task → exit 2를 내고 pointer를 쓰지 않는다', () => {
  const repo = tmpGitRepo();
  writeNumberedPlanBlueprint(repo);
  const r = capture(['current', '--repo', repo, '--set', BP_REL, '--task', '099']);
  assert.strictEqual(r.code, 2);
  assert.match(r.err, /TASKS-001/);
  assert.match(r.err, /TASKS-002/);
  assert.strictEqual(readCurrent({ repoRoot: repo }), null);
});

test('--set 없이 current --task → exit 2를 낸다', () => {
  const r = capture(['current', '--task', '001']);
  assert.strictEqual(r.code, 2);
  assert.match(r.err, /--task requires --set/);
});

test('current --clear --task → exit 2를 낸다', () => {
  const r = capture(['current', '--clear', '--task', '001']);
  assert.strictEqual(r.code, 2);
  assert.match(r.err, /--clear and --task/);
});

test('pointer가 있는 bare current → JSON에 task 키가 포함된다', () => {
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

function pointersSnapshot(repo) {
  const root = path.join(repo, '.git', 'bouncer', 'pointers');
  const out = {};
  if (!fs.existsSync(root)) return out;
  for (const epic of fs.readdirSync(root)) {
    for (const f of fs.readdirSync(path.join(root, epic))) {
      out[`${epic}/${f}`] = fs.readFileSync(path.join(root, epic, f), 'utf8');
    }
  }
  return out;
}

test('base에 다른 key가 있을 때 current --set → CURRENT_WOULD_BE_AMBIGUOUS로 거절하고 포인터를 바꾸지 않는다', () => {
  const repo = tmpGitRepo();
  writePlanPassingBlueprint(repo);
  writeOtherPlanPassingBlueprint(repo);
  writeCurrent({ repoRoot: repo, blueprint: BP_REL, base: 'develop' });
  const before = pointersSnapshot(repo);
  const r = capture(['current', '--repo', repo, '--set', BP_OTHER]);
  assert.strictEqual(r.code, 1);
  const parsed = JSON.parse(r.out);
  assert.strictEqual(parsed.ok, false);
  assert.strictEqual(parsed.reason, 'CURRENT_WOULD_BE_AMBIGUOUS');
  assert.deepStrictEqual(parsed.candidates, [storedPointer(BP_REL, 'develop', null)]);
  assert.strictEqual(parsed.next.some((c) => c.includes('--replace')), true);
  assert.strictEqual(parsed.next.some((c) => c.includes('--keep-others')), true);
  assert.deepStrictEqual(pointersSnapshot(repo), before);
});

test('base에 key가 둘 이상일 때 새 key를 current --set → next에 --replace 없이 --keep-others만 낸다', () => {
  const repo = tmpGitRepo();
  writePlanPassingBlueprint(repo);
  writeOtherPlanPassingBlueprint(repo);
  writeCurrent({ repoRoot: repo, blueprint: BP_REL, base: 'develop' });
  writeCurrent({ repoRoot: repo, blueprint: BP_OTHER, base: 'main' });
  const third = '.bouncer/context/epics/003-extra/blueprints/001-x';
  const r = capture(['current', '--repo', repo, '--set', third]);
  assert.strictEqual(r.code, 1);
  const parsed = JSON.parse(r.out);
  assert.strictEqual(parsed.reason, 'CURRENT_WOULD_BE_AMBIGUOUS');
  assert.strictEqual(parsed.next.some((c) => c.includes('--replace')), false);
  assert.strictEqual(parsed.next.some((c) => c.includes('--keep-others')), true);
});

test('base에서 current --set --keep-others → key를 더하고 others를 보고한다', () => {
  const repo = tmpGitRepo();
  writePlanPassingBlueprint(repo);
  writeOtherPlanPassingBlueprint(repo);
  writeCurrent({ repoRoot: repo, blueprint: BP_REL, base: 'develop' });
  const before = readCurrent({ repoRoot: repo });
  const r = capture(['current', '--repo', repo, '--set', BP_OTHER, '--keep-others']);
  assert.strictEqual(r.code, 0);
  const parsed = JSON.parse(r.out);
  assert.strictEqual(parsed.ok, true);
  assert.strictEqual(parsed.current.blueprint, BP_OTHER);
  assert.deepStrictEqual(parsed.others, [{ blueprint: BP_REL }]);
  assert.ok(fs.existsSync(nsFile(repo, '001', '001')));
  assert.ok(fs.existsSync(nsFile(repo, '002', '001')));
  assert.deepStrictEqual(
    JSON.parse(fs.readFileSync(nsFile(repo, '001', '001'), 'utf8')),
    { blueprint: before.blueprint, base: before.base },
  );
});

test('current --keep-others를 --replace 또는 --clear와 쓰거나 --set 없이 쓰면 → exit 2', () => {
  const repo = tmpGitRepo();
  for (const argv of [
    ['--set', BP_REL, '--keep-others', '--replace'],
    ['--clear', '--keep-others'],
    ['--keep-others'],
  ]) {
    const r = capture(['current', '--repo', repo, ...argv]);
    assert.strictEqual(r.code, 2, argv.join(' '));
  }
});

test('current --set --replace로 다른 blueprint를 지정하면 → 전환하고 previous를 보고한다', () => {
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

test('--replace 없이 같은 blueprint를 current --set 하면 → task와 base를 갱신한다', () => {
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

test('current usage → parallel --set과 CURRENT_AMBIGUOUS --replace를 설명한다', () => {
  const { current } = require('../scripts/lib/cli-current-command');
  assert.match(current.usage, /parallel key/);
  assert.match(current.usage, /CURRENT_AMBIGUOUS/);
  assert.doesNotMatch(current.usage, /omitted, a conflict exits 2/);
});

test('--set 없이 current --replace → exit 2를 낸다', () => {
  const r = capture(['current', '--replace']);
  assert.strictEqual(r.code, 2);
  assert.match(r.err, /--replace requires --set/);
});

test('current --clear --replace → exit 2를 낸다', () => {
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

test('current --set --keep-others → parallel namespace 키를 추가하고 다른 키를 보존한다', () => {
  const repo = tmpGitRepo();
  writePlanPassingBlueprint(repo);
  writeOtherPlanPassingBlueprint(repo);
  writeCurrent({ repoRoot: repo, blueprint: BP_REL, base: 'develop' });
  const r = capture(['current', '--repo', repo, '--set', BP_OTHER, '--keep-others']);
  assert.strictEqual(r.code, 0);
  const parsed = JSON.parse(r.out);
  assert.strictEqual(parsed.ok, true);
  assert.strictEqual(parsed.current.blueprint, BP_OTHER);
  assert.ok(fs.existsSync(nsFile(repo, '001', '001')));
  assert.ok(fs.existsSync(nsFile(repo, '002', '001')));
});

test('nested worktree에서 다른 key가 있는 current --set → 거절 없이 추가한다', () => {
  const repo = tmpGitRepo();
  writePlanPassingBlueprint(repo);
  writeOtherPlanPassingBlueprint(repo);
  gitCommit(repo, 'docs');
  const nested = addWorktree(repo, '.worktrees/002/001');
  writeCurrent({ repoRoot: repo, blueprint: BP_REL, base: 'develop' });
  const r = capture(['current', '--repo', nested, '--set', BP_OTHER, '--base', 'main']);
  assert.strictEqual(r.code, 0);
  assert.ok(fs.existsSync(nsFile(repo, '001', '001')));
  assert.ok(fs.existsSync(nsFile(repo, '002', '001')));
});

test('nested worktree에서 current --replace → 선택된 키만 교체한다', () => {
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

test('후보가 여럿인 base에서 current --replace → 추측하지 않는다', () => {
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

test('base에서 pointer가 둘이면 current → 정렬된 storage 형태 후보와 함께 exit 1을 낸다', () => {
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
  assert.strictEqual(Array.isArray(parsed.next) && parsed.next.length > 0, true);
  assert.deepStrictEqual(parsed.candidates, [
    storedPointer(BP_REL, 'develop', `${BP_REL}/tasks/001/tasks.md`),
    storedPointer(BP_OTHER, 'main', null),
  ]);
  parsed.candidates.forEach((c) => {
    assert.strictEqual(typeof c.task === 'string' || c.task === null, true);
    assert.strictEqual(Object.prototype.hasOwnProperty.call(c, 'scale'), false);
  });
});

test('nested worktree에서 current --clear와 --task → 해당 namespace만 건드린다', () => {
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

test('legacy 삭제가 남은 상태에서 current --set → CURRENT_MIGRATION_INCOMPLETE를 보고하고 남은 legacy 삭제를 재시도한다', () => {
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

const __coordinatorMod = require('../scripts/lib/coordinator');
const { coordinatorPathsFor: __coordinatorPathsFor } = require('../scripts/lib/runtime-state');
const __crypto = require('node:crypto');
const __LEDGER_REL = '.bouncer/runtime/coordinator.json';
const __FENCED = new Set([
  'prepare', 'dispatch', 'report', 'record', 'rerecord', 'critical-recovery',
  'repair', 'integrate', 'partial-close', 'release', 'revoke',
]);
function __fence(repoRoot, blueprint) {
  const { ledgerFile } = __coordinatorPathsFor({ repoRoot, blueprint });
  return {
    ledgerPath: __LEDGER_REL,
    ledgerHash: __crypto.createHash('sha256').update(fs.readFileSync(ledgerFile)).digest('hex'),
  };
}
function coordinate(opts) {
  if (__FENCED.has(opts.command)
    && opts.ledgerPath === undefined && opts.ledgerHash === undefined) {
    try {
      opts = { ...opts, ...__fence(opts.repoRoot, opts.blueprint) };
    } catch (_error) { /* missing ledger → core rejects */ }
  }
  return __coordinatorMod.coordinate(opts);
}


test('coordinator ready wave가 있으면 current → 공개 payload에 투영한다', () => {
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

test('coordinator ledger를 읽을 수 없으면 current → 키를 버리지 않고 이를 보고한다', () => {
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

test('첫 pointer와 --reapprove에서 current --set → approval을 기록하고 task 진행에서는 기록하지 않는다', () => {
  const repo = tmpGitRepo();
  writeNumberedPlanBlueprint(repo);
  const first = JSON.parse(capture(['current', '--repo', repo, '--set', BP_REL]).out);
  assert.equal(first.approval, 'recorded');
  const advance = JSON.parse(capture([
    'current', '--repo', repo, '--set', BP_REL, '--task', '002',
  ]).out);
  assert.equal(advance.approval, 'unchanged');
  const again = JSON.parse(capture([
    'current', '--repo', repo, '--set', BP_REL, '--reapprove',
  ]).out);
  assert.equal(again.approval, 'recorded');
});

test('--set 없이 current --reapprove → exit 2를 낸다', () => {
  const r = capture(['current', '--reapprove']);
  assert.strictEqual(r.code, 2);
});
