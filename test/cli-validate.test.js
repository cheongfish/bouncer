'use strict';
const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const yaml = require('js-yaml');
const { runCli } = require('../scripts/lib/cli');
const { readDoc } = require('../scripts/lib/frontmatter');
const { registerFixtureEpic } = require('./helpers/epic-registry');

const BP_REL = '.bouncer/context/epics/001-auth/blueprints/001-login';

function writeDoc(repo, rel, data) {
  // blueprint index는 epic 등록부 항목과 attribution을 함께 채운다.
  const bpIndex = /epics\/(\d{3}-[^/]+)\/blueprints\/[^/]+\/index\.md$/.exec(rel);
  if (bpIndex && data && data.type === 'bouncer.blueprint') {
    registerFixtureEpic(repo, bpIndex[1]);
    data = { ...data, bouncer: { attribution: 'fixture', ...data.bouncer } };
  }
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

test('validate on failure → emits JSON and exit 1', () => {
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

test('validate --gate plan when affected_paths exceeds 20 → exits 0 with warnings', () => {
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
      // src/auth/ Touch가 보안 토큰에 걸리므로 review-risk-missing이 task-split 단언을 흐리지 않게 한다.
      review_risk: ['authentication'],
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

test('validate --gate plan with security Touch and empty review_risk → exits 0 with review-risk-missing', () => {
  const repo = fs.mkdtempSync(path.join(os.tmpdir(), 'bouncer-'));
  const tasksBody = `# Tasks

## Goal & intent
Ship login validation.

## Interface
\`validateLogin(input) -> Result\`

## Touch
- \`src/auth/login.js\`

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
      review_risk: [],
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
  assert.strictEqual(parsed.warnings.length, 1);
  assert.strictEqual(parsed.warnings[0].code, 'review-risk-missing');
  assert.match(parsed.warnings[0].message, /src\/auth\/login\.js/);
});

test('unknown command → exits 2', () => {
  const { io } = capture();
  assert.strictEqual(runCli(['frobnicate'], io), 2);
});

test('profile and import-superpowers commands → are unsupported', () => {
  const { io } = capture();
  assert.strictEqual(runCli(['profile'], io), 2);
  assert.strictEqual(runCli(['import-superpowers'], io), 2);
});

test('validate without --blueprint → exits 2 and does not report ok:true', () => {
  const repo = fs.mkdtempSync(path.join(os.tmpdir(), 'bouncer-'));
  const { io, buf } = capture();
  const code = runCli(['validate', '--repo', repo], io);
  assert.strictEqual(code, 2);
  assert.ok(!buf.out.includes('"ok": true'));
  assert.ok(buf.err.length > 0);
});

test('validateBlueprint with planDraft combined with gate → rejects', () => {
  const { validateBlueprint } = require('../scripts/lib/validate');
  const repoRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'bouncer-'));
  assert.throws(
    () => validateBlueprint({ repoRoot, blueprintDir: BP_REL, gate: 'plan', planDraft: true }),
    /planDraft cannot be combined with gate/,
  );
});

test('finalize without --blueprint → exits 2', () => {
  const repo = fs.mkdtempSync(path.join(os.tmpdir(), 'bouncer-'));
  const { io, buf } = capture();
  const code = runCli(['finalize', '--repo', repo], io);
  assert.strictEqual(code, 2);
  assert.ok(buf.err.length > 0);
});

test('validate --gate plan with a DAG error → preserves G19 code and task path', () => {
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

const { coordinate } = require('./helpers/coordinator-fence');

const { reviseTaskScope } = require('../scripts/lib/scope');

test('validate --gate commit with a revised coordinator scope → judges staged paths against it', () => {
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

test('validate --gate execute in a worker cwd → judges the leased task', () => {
  const repo = fs.mkdtempSync(path.join(os.tmpdir(), 'bouncer-val-eff-'));
  const git = (args, cwd = repo) => execFileSync('git', args, { cwd, encoding: 'utf8' });
  git(['init', '-b', 'work', '--quiet']);
  git(['config', 'user.email', 't@example.com']);
  git(['config', 'user.name', 't']);
  const epic = '.bouncer/context/epics/096-eff';
  const blueprint = `${epic}/blueprints/001-y`;
  writeDoc(repo, `${epic}/index.md`, {
    type: 'bouncer.epic', title: 'e', description: 'd', resource: `${epic}/index.md`,
    tags: ['bouncer'], timestamp: '2026-07-01T00:00:00+09:00',
    bouncer: { id: '096', epic_id: '096', status: 'approved' },
  });
  writeDoc(repo, `${blueprint}/index.md`, {
    type: 'bouncer.blueprint', title: 'b', description: 'd', resource: `${blueprint}/index.md`,
    tags: ['bouncer'], timestamp: '2026-07-01T00:00:00+09:00',
    bouncer: { id: '001', epic_id: '096', blueprint_id: '001', status: 'approved' },
  });
  for (const [id, leaf] of [['001', 'a'], ['002', 'b']]) {
    writeDoc(repo, `${blueprint}/tasks/${id}/tasks.md`, {
      type: 'bouncer.tasks', title: `t${id}`, description: 'd',
      resource: `${blueprint}/tasks/${id}/tasks.md`, tags: ['bouncer'],
      timestamp: '2026-07-01T00:00:00+09:00',
      bouncer: {
        id: `TASKS-${id}`, epic_id: '096', blueprint_id: '001', status: 'ready',
        parallel_safe: true, affected_paths: [`src/${leaf}/`],
      },
    });
    writeDoc(repo, `${blueprint}/tasks/${id}/verification.md`, {
      type: 'bouncer.verification', title: `v${id}`, description: 'd',
      resource: `${blueprint}/tasks/${id}/verification.md`, tags: ['bouncer'],
      timestamp: '2026-07-01T00:00:00+09:00',
      bouncer: {
        id: `VERIFY-${id}`, epic_id: '096', blueprint_id: '001', status: 'pending',
      },
    });
    writeDoc(repo, `${blueprint}/tasks/${id}/review.md`, {
      type: 'bouncer.review', title: `r${id}`, description: 'd',
      resource: `${blueprint}/tasks/${id}/review.md`, tags: ['bouncer'],
      timestamp: '2026-07-01T00:00:00+09:00',
      bouncer: {
        id: `REVIEW-${id}`, epic_id: '096', blueprint_id: '001', status: 'pending',
        review: { required: false, reason: 'fixture' },
      },
    });
  }
  fs.mkdirSync(path.join(repo, '.bouncer'), { recursive: true });
  fs.writeFileSync(
    path.join(repo, '.bouncer/config.json'),
    JSON.stringify({ verify: 'node -e "process.exit(0)"' }),
  );
  git(['add', '-A']);
  git(['commit', '--quiet', '-m', 'plan']);
  const boot = coordinate({ command: 'bootstrap', repoRoot: repo, blueprint });
  fs.mkdirSync(path.join(boot.integrationPath, '.bouncer'), { recursive: true });
  fs.writeFileSync(
    path.join(boot.integrationPath, '.bouncer/config.json'),
    `${JSON.stringify({ coordinator: { max_parallel: 2 } }, null, 2)}\n`,
  );
  const prepared = coordinate({
    command: 'prepare', repoRoot: repo, blueprint, cwd: boot.integrationPath,
    deps: { makeLeaseId: (() => { let n = 0; return () => `val-lease-${++n}`; })() },
  });
  assert.strictEqual(prepared.ok, true, JSON.stringify(prepared));
  const worker002 = prepared.tasks.find((t) => t.id === '002').workerPath;
  const { writeCurrent } = require('../scripts/lib/current');
  writeCurrent({
    repoRoot: repo, blueprint, base: 'work', task: `${blueprint}/tasks/001/tasks.md`,
  });

  const withLease = capture();
  runCli(
    ['validate', '--repo', worker002, '--blueprint', blueprint, '--gate', 'execute'],
    withLease.io,
  );
  const withLeaseOut = JSON.parse(withLease.buf.out);
  // RD-002: lease 대상이 TASKS-002임을 증명한다. verify 통과 시 002만
  // ready→verified로 바뀌고 001은 그대로다. 미완 문서 실패 file도 002만.
  assert.strictEqual(
    readDoc(path.join(worker002, `${blueprint}/tasks/002/tasks.md`)).data.bouncer.status,
    'verified',
  );
  assert.strictEqual(
    readDoc(path.join(worker002, `${blueprint}/tasks/001/tasks.md`)).data.bouncer.status,
    'ready',
  );
  assert.strictEqual(withLeaseOut.ok, false, withLease.buf.out);
  const failures = withLeaseOut.failures || [];
  const unitFailures = failures.filter((f) => /tasks\/00[12]\//.test(f.file || ''));
  assert.ok(
    unitFailures.every((f) => /tasks\/002\//.test(f.file || '')),
    withLease.buf.out,
  );
  assert.ok(
    !failures.some((f) => /tasks\/001\//.test(f.file || '')),
    withLease.buf.out,
  );

  const ledgerFile = path.join(boot.integrationPath, '.bouncer/runtime/coordinator.json');
  const ledger = JSON.parse(fs.readFileSync(ledgerFile, 'utf8'));
  ledger.tasks.find((t) => t.id === '002').lease.status = 'revoked';
  fs.writeFileSync(ledgerFile, `${JSON.stringify(ledger, null, 2)}\n`);
  const noLease = capture();
  const noLeaseCode = runCli(
    ['validate', '--repo', worker002, '--blueprint', blueprint, '--gate', 'execute'],
    noLease.io,
  );
  assert.strictEqual(noLeaseCode, 1);
  const noLeaseOut = JSON.parse(noLease.buf.out);
  assert.ok(
    (noLeaseOut.failures || []).some((f) => f.code === 'G6' || /task/i.test(f.message || '')),
    noLease.buf.out,
  );

  fs.writeFileSync(ledgerFile, '{ truncated');
  const unread = capture();
  const unreadCode = runCli(
    ['validate', '--repo', worker002, '--blueprint', blueprint, '--gate', 'execute'],
    unread.io,
  );
  assert.strictEqual(unreadCode, 1);
});

test('blueprint review mode with a missing task review.md → does not emit S17', () => {
  const repo = fs.mkdtempSync(path.join(os.tmpdir(), 'bouncer-'));
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
    bouncer: {
      id: '001', epic_id: '001', blueprint_id: '001', status: 'approved',
      review_scope: 'blueprint',
    },
  });
  writeDoc(repo, `${BP_REL}/tasks/001/tasks.md`, {
    type: 'bouncer.tasks', title: 't', description: 'd',
    resource: `${BP_REL}/tasks/001/tasks.md`,
    tags: ['bouncer'], timestamp: '2026-07-01T00:00:00+09:00',
    bouncer: {
      id: 'TASKS-001', epic_id: '001', blueprint_id: '001', status: 'ready',
      affected_paths: ['src/auth/'],
    },
  });
  writeDoc(repo, `${BP_REL}/tasks/001/verification.md`, {
    type: 'bouncer.verification', title: 'v', description: 'd',
    resource: `${BP_REL}/tasks/001/verification.md`,
    tags: ['bouncer'], timestamp: '2026-07-01T00:00:00+09:00',
    bouncer: { id: 'VERIFY-001', epic_id: '001', blueprint_id: '001', status: 'pending' },
  });
  const { io, buf } = capture();
  runCli(['validate', '--repo', repo, '--blueprint', BP_REL], io);
  const parsed = JSON.parse(buf.out);
  assert.ok(!parsed.failures.some((f) => f.code === 'S17'), JSON.stringify(parsed.failures));
});

test('validate --gate plan on a freshly scaffolded blueprint → reports G20 for the missing task command and terminal node', () => {
  const { scaffoldEpic, scaffoldBlueprint } = require('../scripts/lib/scaffold');
  const repo = fs.mkdtempSync(path.join(os.tmpdir(), 'bouncer-'));
  const ts = '2026-07-01T00:00:00+09:00';
  scaffoldEpic({ repoRoot: repo, epicId: '001', name: 'auth', timestamp: ts, description: 'Auth epic description' });
  scaffoldBlueprint({
    repoRoot: repo, epicDir: '.bouncer/context/epics/001-auth', blueprintId: '001', name: 'login', timestamp: ts,
  });
  const { io, buf } = capture();
  const code = runCli(['validate', '--repo', repo, '--blueprint', BP_REL, '--gate', 'plan'], io);
  assert.strictEqual(code, 1);
  const g20 = JSON.parse(buf.out).failures.filter((f) => f.code === 'G20').map((f) => f.message);
  assert.ok(g20.some((m) => /own non-empty bouncer\.verify/.test(m)), JSON.stringify(g20));
  assert.ok(g20.some((m) => /terminal verification task/.test(m)), JSON.stringify(g20));
});

test('validate --gate plan on a blueprint without verification_policy → raises no G20 for the same shape', () => {
  const { scaffoldEpic, scaffoldBlueprint } = require('../scripts/lib/scaffold');
  const repo = fs.mkdtempSync(path.join(os.tmpdir(), 'bouncer-'));
  const ts = '2026-07-01T00:00:00+09:00';
  scaffoldEpic({ repoRoot: repo, epicId: '001', name: 'auth', timestamp: ts, description: 'Auth epic description' });
  scaffoldBlueprint({
    repoRoot: repo, epicDir: '.bouncer/context/epics/001-auth', blueprintId: '001', name: 'login', timestamp: ts,
  });
  const idx = path.join(repo, BP_REL, 'index.md');
  fs.writeFileSync(idx, fs.readFileSync(idx, 'utf8').replace(/\n {2}verification_policy: scoped_terminal/, ''));
  const { io, buf } = capture();
  runCli(['validate', '--repo', repo, '--blueprint', BP_REL, '--gate', 'plan'], io);
  assert.deepStrictEqual(JSON.parse(buf.out).failures.filter((f) => f.code === 'G20'), []);
});
