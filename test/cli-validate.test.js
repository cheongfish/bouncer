'use strict';
const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const yaml = require('js-yaml');
const { runCli } = require('../scripts/lib/cli');

const BP_REL = '.bouncer/context/epics/001-auth/blueprints/001-login';

function writeDoc(repo, rel, data) {
  const abs = path.join(repo, rel);
  fs.mkdirSync(path.dirname(abs), { recursive: true });
  fs.writeFileSync(abs, `---\n${yaml.dump(data)}---\n# x\n`);
}

function capture() {
  const buf = { out: '', err: '' };
  return {
    io: { out: (s) => { buf.out += s; }, err: (s) => { buf.err += s; } },
    buf,
  };
}

test('validate emits JSON and exit 1 on failure', () => {
  const repo = fs.mkdtempSync(path.join(os.tmpdir(), 'bouncer-'));
  writeDoc(repo, `${BP_REL}/tasks/001/tasks.md`, {
    type: 'bouncer.tasks', title: 't', description: 'd', resource: `${BP_REL}/tasks/001/tasks.md`,
    tags: ['bouncer'], timestamp: '2026-07-01T00:00:00+09:00',
    bouncer: { id: 'TASKS-001', epic_id: '001', blueprint_id: '001', status: 'ready', affected_paths: [] },
  });
  const { io, buf } = capture();
  const code = runCli(['validate', '--repo', repo, '--blueprint', BP_REL], io);
  assert.strictEqual(code, 1);
  const parsed = JSON.parse(buf.out);
  assert.strictEqual(parsed.ok, false);
  assert.ok(parsed.failures.some((f) => f.code === 'S7'));
});

test('validate --gate plan includes G18 when context-review.md is missing', () => {
  const repo = fs.mkdtempSync(path.join(os.tmpdir(), 'bouncer-'));
  const tasksBody = `# Tasks

## Goal & intent
Ship login validation.

## Interface
\`validateLogin(input) -> Result\`

## Touch
- \`src/auth/\`

## Do not touch
- \`src/payments/\`

## Checklist
- [ ] implement validateLogin
`;
  writeDoc(repo, '.bouncer/context/epics/001-auth/index.md', {
    type: 'bouncer.epic', title: 'Auth epic', description: 'auth epic',
    resource: '.bouncer/context/epics/001-auth/index.md',
    tags: ['bouncer', 'epic'], timestamp: '2026-07-01T00:00:00+09:00',
    bouncer: { id: '001', epic_id: '001', status: 'approved' },
  });
  writeDoc(repo, `${BP_REL}/index.md`, {
    type: 'bouncer.blueprint', title: 'Login blueprint', description: '001',
    resource: `${BP_REL}/index.md`,
    tags: ['bouncer', 'blueprint'], timestamp: '2026-07-01T00:00:00+09:00',
    bouncer: { id: '001', epic_id: '001', blueprint_id: '001', status: 'approved' },
  });
  const tasksRel = `${BP_REL}/tasks/001/tasks.md`;
  const abs = path.join(repo, tasksRel);
  fs.mkdirSync(path.dirname(abs), { recursive: true });
  fs.writeFileSync(abs, `---\n${yaml.dump({
    type: 'bouncer.tasks', title: 'Login tasks', description: 'Tasks for 001',
    resource: tasksRel, tags: ['bouncer', 'tasks'], timestamp: '2026-07-01T00:00:00+09:00',
    bouncer: {
      id: 'TASKS-001', epic_id: '001', blueprint_id: '001', status: 'ready',
      graph: { suggested_paths: ['src/'], basis: 'manual: src/' },
      affected_paths: ['src/auth/login.js'],
    },
  })}---\n${tasksBody}`);
  writeDoc(repo, `${BP_REL}/tasks/001/verification.md`, {
    type: 'bouncer.verification', title: 'Verify 001', description: 'v',
    resource: `${BP_REL}/tasks/001/verification.md`,
    tags: ['bouncer'], timestamp: '2026-07-01T00:00:00+09:00',
    bouncer: { id: 'VERIFY-001', epic_id: '001', blueprint_id: '001', status: 'pending' },
  });
  writeDoc(repo, `${BP_REL}/tasks/001/review.md`, {
    type: 'bouncer.review', title: 'Review 001', description: 'r',
    resource: `${BP_REL}/tasks/001/review.md`,
    tags: ['bouncer'], timestamp: '2026-07-01T00:00:00+09:00',
    bouncer: { id: 'REVIEW-001', epic_id: '001', blueprint_id: '001', status: 'pending' },
  });
  const indexAbs = path.join(repo, '.bouncer/context/index.md');
  fs.mkdirSync(path.dirname(indexAbs), { recursive: true });
  fs.writeFileSync(
    indexAbs,
    '---\nokf_version: "0.1"\n---\n# Epics\n\n'
    + '* [001 auth](epics/001-auth/index.md) - Epic 001\n',
  );
  const { io, buf } = capture();
  const code = runCli(
    ['validate', '--repo', repo, '--blueprint', BP_REL, '--gate', 'plan'],
    io,
  );
  assert.strictEqual(code, 1);
  const parsed = JSON.parse(buf.out);
  assert.strictEqual(parsed.ok, false);
  assert.ok(parsed.failures.some((f) => f.code === 'G18'));
});

test('validate --gate plan exits 0 with warnings when affected_paths exceeds 20', () => {
  const repo = fs.mkdtempSync(path.join(os.tmpdir(), 'bouncer-'));
  const tasksBody = `# Tasks

## Goal & intent
Ship login validation.

## Interface
\`validateLogin(input) -> Result\`

## Touch
- \`src/auth/\`

## Do not touch
- \`src/payments/\`

## Checklist
- [ ] implement validateLogin
`;
  const paths21 = Array.from(
    { length: 21 },
    (_, i) => `src/auth/f${String(i + 1).padStart(2, '0')}.js`,
  );
  writeDoc(repo, '.bouncer/context/epics/001-auth/index.md', {
    type: 'bouncer.epic', title: 'Auth epic', description: 'auth epic',
    resource: '.bouncer/context/epics/001-auth/index.md',
    tags: ['bouncer', 'epic'], timestamp: '2026-07-01T00:00:00+09:00',
    bouncer: { id: '001', epic_id: '001', status: 'approved' },
  });
  writeDoc(repo, `${BP_REL}/index.md`, {
    type: 'bouncer.blueprint', title: 'Login blueprint', description: '001',
    resource: `${BP_REL}/index.md`,
    tags: ['bouncer', 'blueprint'], timestamp: '2026-07-01T00:00:00+09:00',
    bouncer: { id: '001', epic_id: '001', blueprint_id: '001', status: 'approved' },
  });
  const tasksRel = `${BP_REL}/tasks/001/tasks.md`;
  const abs = path.join(repo, tasksRel);
  fs.mkdirSync(path.dirname(abs), { recursive: true });
  fs.writeFileSync(abs, `---\n${yaml.dump({
    type: 'bouncer.tasks', title: 'Login tasks', description: 'Tasks for 001',
    resource: tasksRel, tags: ['bouncer', 'tasks'], timestamp: '2026-07-01T00:00:00+09:00',
    bouncer: {
      id: 'TASKS-001', epic_id: '001', blueprint_id: '001', status: 'ready',
      graph: { suggested_paths: ['src/'], basis: 'manual: src/' },
      affected_paths: paths21,
    },
  })}---\n${tasksBody}`);
  writeDoc(repo, `${BP_REL}/tasks/001/verification.md`, {
    type: 'bouncer.verification', title: 'Verify 001', description: 'v',
    resource: `${BP_REL}/tasks/001/verification.md`,
    tags: ['bouncer'], timestamp: '2026-07-01T00:00:00+09:00',
    bouncer: { id: 'VERIFY-001', epic_id: '001', blueprint_id: '001', status: 'pending' },
  });
  writeDoc(repo, `${BP_REL}/tasks/001/review.md`, {
    type: 'bouncer.review', title: 'Review 001', description: 'r',
    resource: `${BP_REL}/tasks/001/review.md`,
    tags: ['bouncer'], timestamp: '2026-07-01T00:00:00+09:00',
    bouncer: { id: 'REVIEW-001', epic_id: '001', blueprint_id: '001', status: 'pending' },
  });
  writeDoc(repo, `${BP_REL}/context-review.md`, {
    type: 'bouncer.context_review', title: '001 context review', description: 'c',
    resource: `${BP_REL}/context-review.md`,
    tags: ['bouncer', 'context_review'], timestamp: '2026-07-01T00:00:00+09:00',
    bouncer: {
      id: 'CTXREVIEW-001', epic_id: '001', blueprint_id: '001', status: 'accepted',
      context_review: { findings: [] },
    },
  });
  const crAbs = path.join(repo, `${BP_REL}/context-review.md`);
  fs.writeFileSync(
    crAbs,
    fs.readFileSync(crAbs, 'utf8').replace('# x\n', '# Context review\n\n## Findings\n(none)\n'),
  );
  const indexAbs = path.join(repo, '.bouncer/context/index.md');
  fs.mkdirSync(path.dirname(indexAbs), { recursive: true });
  fs.writeFileSync(
    indexAbs,
    '---\nokf_version: "0.1"\n---\n# Epics\n\n'
    + '* [001 auth](epics/001-auth/index.md) - auth epic\n',
  );
  const { io, buf } = capture();
  const code = runCli(
    ['validate', '--repo', repo, '--blueprint', BP_REL, '--gate', 'plan'],
    io,
  );
  assert.strictEqual(code, 0, `warnings alone must exit 0; stderr=${buf.err}`);
  const parsed = JSON.parse(buf.out);
  assert.strictEqual(parsed.ok, true);
  assert.deepStrictEqual(parsed.failures, []);
  assert.ok(Array.isArray(parsed.warnings));
  assert.strictEqual(parsed.warnings.length, 1);
  assert.match(parsed.warnings[0].message, /21/);
  assert.match(parsed.warnings[0].message, /split the task|task를 분리/i);
  assert.strictEqual(buf.err, '', 'no stderr advisory prose outside JSON');
});

test('unknown command exits 2', () => {
  const { io } = capture();
  assert.strictEqual(runCli(['frobnicate'], io), 2);
});

test('profile and import-superpowers commands are unsupported', () => {
  const { io } = capture();
  assert.strictEqual(runCli(['profile'], io), 2);
  assert.strictEqual(runCli(['import-superpowers'], io), 2);
});

test('validate without --blueprint exits 2 and does not report ok:true', () => {
  const repo = fs.mkdtempSync(path.join(os.tmpdir(), 'bouncer-'));
  const { io, buf } = capture();
  const code = runCli(['validate', '--repo', repo], io);
  assert.strictEqual(code, 2);
  assert.ok(!buf.out.includes('"ok": true'));
  assert.ok(buf.err.length > 0);
});

test('finalize without --blueprint exits 2', () => {
  const repo = fs.mkdtempSync(path.join(os.tmpdir(), 'bouncer-'));
  const { io, buf } = capture();
  const code = runCli(['finalize', '--repo', repo], io);
  assert.strictEqual(code, 2);
  assert.ok(buf.err.length > 0);
});

test('validate --gate plan preserves G19 DAG error code and task path', () => {
  const repo = fs.mkdtempSync(path.join(os.tmpdir(), 'bouncer-'));
  const tasksBody = `# Tasks

## Goal & intent
Ship login validation.

## Interface
\`validateLogin(input) -> Result\`

## Touch
- \`src/auth/\`

## Do not touch
- \`src/payments/\`

## Checklist
- [ ] implement validateLogin
`;
  writeDoc(repo, '.bouncer/context/epics/001-auth/index.md', {
    type: 'bouncer.epic', title: 'Auth epic', description: 'auth epic',
    resource: '.bouncer/context/epics/001-auth/index.md',
    tags: ['bouncer', 'epic'], timestamp: '2026-07-01T00:00:00+09:00',
    bouncer: { id: '001', epic_id: '001', status: 'approved' },
  });
  writeDoc(repo, `${BP_REL}/index.md`, {
    type: 'bouncer.blueprint', title: 'Login blueprint', description: '001',
    resource: `${BP_REL}/index.md`,
    tags: ['bouncer', 'blueprint'], timestamp: '2026-07-01T00:00:00+09:00',
    bouncer: { id: '001', epic_id: '001', blueprint_id: '001', status: 'approved' },
  });
  const tasksRel = `${BP_REL}/tasks/001/tasks.md`;
  const abs = path.join(repo, tasksRel);
  fs.mkdirSync(path.dirname(abs), { recursive: true });
  fs.writeFileSync(abs, `---\n${yaml.dump({
    type: 'bouncer.tasks', title: 'Login tasks', description: 'Tasks for 001',
    resource: tasksRel, tags: ['bouncer', 'tasks'], timestamp: '2026-07-01T00:00:00+09:00',
    bouncer: {
      id: 'TASKS-001', epic_id: '001', blueprint_id: '001', status: 'ready',
      depends_on: ['TASKS-999'],
      parallel_safe: false,
      dependency_gate: 'integrated',
      graph: { suggested_paths: ['src/'], basis: 'manual: src/' },
      affected_paths: ['src/auth/login.js'],
    },
  })}---\n${tasksBody}`);
  writeDoc(repo, `${BP_REL}/tasks/001/verification.md`, {
    type: 'bouncer.verification', title: 'Verify 001', description: 'v',
    resource: `${BP_REL}/tasks/001/verification.md`,
    tags: ['bouncer'], timestamp: '2026-07-01T00:00:00+09:00',
    bouncer: { id: 'VERIFY-001', epic_id: '001', blueprint_id: '001', status: 'pending' },
  });
  writeDoc(repo, `${BP_REL}/tasks/001/review.md`, {
    type: 'bouncer.review', title: 'Review 001', description: 'r',
    resource: `${BP_REL}/tasks/001/review.md`,
    tags: ['bouncer'], timestamp: '2026-07-01T00:00:00+09:00',
    bouncer: { id: 'REVIEW-001', epic_id: '001', blueprint_id: '001', status: 'pending' },
  });
  writeDoc(repo, `${BP_REL}/context-review.md`, {
    type: 'bouncer.context_review', title: 'Context review', description: 'cr',
    resource: `${BP_REL}/context-review.md`,
    tags: ['bouncer', 'context_review'], timestamp: '2026-07-01T00:00:00+09:00',
    bouncer: {
      id: 'CTXREVIEW-001', epic_id: '001', blueprint_id: '001', status: 'accepted',
      context_review: { findings: [] },
    },
  });
  const indexAbs = path.join(repo, '.bouncer/context/index.md');
  fs.mkdirSync(path.dirname(indexAbs), { recursive: true });
  fs.writeFileSync(
    indexAbs,
    '---\nokf_version: "0.1"\n---\n# Epics\n\n'
    + '* [001 auth](epics/001-auth/index.md) - auth epic\n',
  );
  const crAbs = path.join(repo, `${BP_REL}/context-review.md`);
  const crRaw = fs.readFileSync(crAbs, 'utf8');
  fs.writeFileSync(crAbs, `${crRaw}# Context review\n\n## Findings\n(none)\n`);

  const { io, buf } = capture();
  const code = runCli(['validate', '--repo', repo, '--blueprint', BP_REL, '--gate', 'plan'], io);
  assert.strictEqual(code, 1);
  const parsed = JSON.parse(buf.out);
  assert.strictEqual(parsed.ok, false);
  const g19 = parsed.failures.find((f) => f.code === 'G19');
  assert.ok(g19, `expected G19 in ${JSON.stringify(parsed.failures)}`);
  assert.match(g19.file, /tasks\/001\/tasks\.md$/);
  assert.match(g19.message, /TASKS-999|missing|unknown/i);
});

// --- coordinator mode -------------------------------------------------------

const { execFileSync } = require('node:child_process');
const { coordinate } = require('../scripts/lib/coordinator');
const { reviseTaskScope } = require('../scripts/lib/scope');

test('validate --gate commit judges staged paths against the revised coordinator scope', () => {
  const repo = fs.mkdtempSync(path.join(os.tmpdir(), 'bouncer-'));
  const git = (args, cwd = repo) => execFileSync('git', args, { cwd, encoding: 'utf8' });
  git(['init', '-b', 'work', '--quiet']);
  git(['config', 'user.email', 't@example.com']);
  git(['config', 'user.name', 't']);
  writeDoc(repo, '.bouncer/context/epics/001-auth/index.md', {
    type: 'bouncer.epic', title: 'Auth epic', description: 'auth epic',
    resource: '.bouncer/context/epics/001-auth/index.md',
    tags: ['bouncer', 'epic'], timestamp: '2026-07-01T00:00:00+09:00',
    bouncer: { id: '001', epic_id: '001', status: 'approved' },
  });
  writeDoc(repo, `${BP_REL}/index.md`, {
    type: 'bouncer.blueprint', title: 'Login blueprint', description: '001',
    resource: `${BP_REL}/index.md`,
    tags: ['bouncer', 'blueprint'], timestamp: '2026-07-01T00:00:00+09:00',
    bouncer: { id: '001', epic_id: '001', blueprint_id: '001', status: 'approved' },
  });
  writeDoc(repo, `${BP_REL}/tasks/001/tasks.md`, {
    type: 'bouncer.tasks', title: 'Login tasks', description: 'Tasks for 001',
    resource: `${BP_REL}/tasks/001/tasks.md`,
    tags: ['bouncer', 'tasks'], timestamp: '2026-07-01T00:00:00+09:00',
    bouncer: {
      id: 'TASKS-001', epic_id: '001', blueprint_id: '001', status: 'verified',
      affected_paths: ['src/auth/'],
    },
  });
  writeDoc(repo, `${BP_REL}/tasks/001/verification.md`, {
    type: 'bouncer.verification', title: 'Verify 001', description: 'v',
    resource: `${BP_REL}/tasks/001/verification.md`,
    tags: ['bouncer'], timestamp: '2026-07-01T00:00:00+09:00',
    bouncer: { id: 'VERIFY-001', epic_id: '001', blueprint_id: '001', status: 'passed' },
  });
  writeDoc(repo, `${BP_REL}/tasks/001/review.md`, {
    type: 'bouncer.review', title: 'Review 001', description: 'r',
    resource: `${BP_REL}/tasks/001/review.md`,
    tags: ['bouncer'], timestamp: '2026-07-01T00:00:00+09:00',
    bouncer: {
      id: 'REVIEW-001', epic_id: '001', blueprint_id: '001', status: 'accepted',
      review: { required: false, reason: 'fixture' },
    },
  });
  fs.mkdirSync(path.join(repo, 'src/auth'), { recursive: true });
  fs.mkdirSync(path.join(repo, 'src/session'), { recursive: true });
  fs.writeFileSync(path.join(repo, 'src/auth/login.ts'), 'export {}\n');
  fs.writeFileSync(path.join(repo, 'src/session/token.ts'), 'export {}\n');
  git(['add', '-A']);
  git(['commit', '--quiet', '-m', 'plan']);

  const boot = coordinate({ command: 'bootstrap', repoRoot: repo, blueprint: BP_REL });
  const prepared = coordinate({
    command: 'prepare', repoRoot: repo, blueprint: BP_REL, cwd: boot.integrationPath,
  });
  const worker = prepared.tasks[0].workerPath;
  const revised = reviseTaskScope({
    repoRoot: worker,
    blueprint: BP_REL,
    task: '001',
    paths: ['src/session/'],
    reason: 'login work moved into the session module',
  });
  assert.strictEqual(revised.ok, true);

  // 승인 시점 scope(src/auth/)에 있던 경로도 revision 뒤에는 범위 밖이다.
  fs.writeFileSync(path.join(worker, 'src/auth/login.ts'), 'export const x = 1;\n');
  git(['add', 'src/auth/login.ts'], worker);
  const outside = capture();
  const outsideCode = runCli(
    ['validate', '--repo', worker, '--blueprint', BP_REL, '--gate', 'commit'], outside.io,
  );
  assert.strictEqual(outsideCode, 1);
  const g17 = JSON.parse(outside.buf.out).failures.find((f) => f.code === 'G17');
  assert.ok(g17, outside.buf.out);
  assert.match(g17.file, /tasks\/001\/tasks\.md$/);
  assert.match(g17.message, /src\/auth\/login\.ts/);

  git(['reset', '--quiet', 'HEAD', 'src/auth/login.ts'], worker);
  git(['checkout', '--', 'src/auth/login.ts'], worker);
  fs.writeFileSync(path.join(worker, 'src/session/token.ts'), 'export const t = 1;\n');
  git(['add', 'src/session/token.ts'], worker);
  const inside = capture();
  runCli(['validate', '--repo', worker, '--blueprint', BP_REL, '--gate', 'commit'], inside.io);
  // 다른 게이트 실패는 이 픽스처의 관심사가 아니다 — G17만 사라져야 한다.
  const failures = JSON.parse(inside.buf.out).failures || [];
  assert.ok(!failures.some((f) => f.code === 'G17'), inside.buf.out);
});
