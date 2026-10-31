'use strict';
const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const crypto = require('node:crypto');
const { execFileSync } = require('node:child_process');
const yaml = require('js-yaml');
const { runCli } = require('../packages/cli/dist/cli');
const {
  classifyPlanReview,
  classifyExecuteReview,
  EXECUTE_SMALL_MAX_FILES,
  EXECUTE_SMALL_MAX_LINES,
} = require('../packages/cli/dist/review-dispatch');
const { validateBlueprint } = require('../packages/cli/dist/validate');
const { registerFixtureEpic } = require('./helpers/epic-registry');

const EPIC_REL = '.bouncer/context/epics/001-auth';
const BP_REL = `${EPIC_REL}/blueprints/001-login`;

function gitEnv() {
  const env = { ...process.env };
  delete env.GIT_DIR;
  delete env.GIT_WORK_TREE;
  delete env.GIT_INDEX_FILE;
  delete env.GIT_OBJECT_DIRECTORY;
  return env;
}

function git(cwd, args) {
  return execFileSync('git', args, { cwd, encoding: 'utf8', env: gitEnv() });
}

function writeDoc(repo, rel, data, body = '# x\n') {
  // blueprint index는 epic 등록부 항목과 attribution을 함께 채운다.
  const bpIndex = /epics\/(\d{3}-[^/]+)\/blueprints\/[^/]+\/index\.md$/.exec(rel);
  if (bpIndex && data && data.type === 'bouncer.blueprint') {
    registerFixtureEpic(repo, bpIndex[1]);
    data = { ...data, bouncer: { attribution: 'fixture', ...data.bouncer } };
  }
  const abs = path.join(repo, rel);
  fs.mkdirSync(path.dirname(abs), { recursive: true });
  fs.writeFileSync(abs, `---\n${yaml.dump(data)}---\n${body}`);
}

function writeBundleIndex(repo, epicDirs = ['001-auth']) {
  const lines = epicDirs.map((d) => {
    const m = d.match(/^(\d{3})-(.+)$/);
    // S13는 index summary와 epic frontmatter description이 같아야 한다.
    // fixture description은 항상 'd'로 맞춘다.
    return `* [${m[1]} ${m[2]}](epics/${d}/index.md) - d`;
  });
  const abs = path.join(repo, '.bouncer/context/index.md');
  fs.mkdirSync(path.dirname(abs), { recursive: true });
  fs.writeFileSync(abs, `---\nokf_version: "0.1"\n---\n# Epics\n\n${lines.join('\n')}\n`);
}

function taskBody({ interfaceText, touchText }) {
  return `# Tasks

## Goal & intent
Ship the change.

## Current behavior
None.

## Target behavior
Done.

## Interface
${interfaceText}

## Touch
${touchText}

## Do not touch
- \`other/keep.ts\`

## Constraints
Keep scope tight.

## Checklist
- [ ] red
`;
}

// affected_paths 기본값을 Touch 백틱 경로에서 뽑아 Touch 본문(=cluster touch_paths·digest)과 맞춘다.
function touchBacktickPaths(touchText) {
  return [...touchText.matchAll(/`([^`]+)`/g)].map((m) => m[1]);
}

function writeCommitTask(repo, number, {
  interfaceText = '- `sharedFn`\n',
  touchText = '- `src/a.ts`\n',
  reviewRisk,
  status = 'ready',
  dependsOn = [],
  affectedPaths = touchBacktickPaths(touchText),
} = {}) {
  const dir = `${BP_REL}/tasks/${number}`;
  const bouncer = {
    id: `TASKS-${number}`,
    epic_id: '001',
    blueprint_id: '001',
    status,
    execution_kind: 'commit',
    affected_paths: affectedPaths,
    depends_on: dependsOn,
    parallel_safe: false,
    dependency_gate: 'integrated',
  };
  if (reviewRisk !== undefined) bouncer.review_risk = reviewRisk;
  writeDoc(repo, `${dir}/tasks.md`, {
    type: 'bouncer.tasks',
    title: `Task ${number}`,
    description: 'd',
    resource: `${dir}/tasks.md`,
    tags: ['bouncer'],
    timestamp: '2026-07-01T00:00:00+09:00',
    bouncer,
  }, taskBody({ interfaceText, touchText }));
  writeDoc(repo, `${dir}/verification.md`, {
    type: 'bouncer.verification',
    title: 'v',
    description: 'd',
    resource: `${dir}/verification.md`,
    tags: ['bouncer'],
    timestamp: '2026-07-01T00:00:00+09:00',
    bouncer: {
      id: `VERIFY-${number}`, epic_id: '001', blueprint_id: '001', status: 'pending',
    },
  });
  writeDoc(repo, `${dir}/review.md`, {
    type: 'bouncer.review',
    title: 'r',
    description: 'd',
    resource: `${dir}/review.md`,
    tags: ['bouncer'],
    timestamp: '2026-07-01T00:00:00+09:00',
    bouncer: {
      id: `REVIEW-${number}`, epic_id: '001', blueprint_id: '001', status: 'pending',
      review: { required: true },
    },
  });
}

function verificationBody(touchText) {
  return `# Verification node

## Goal & intent
Record CI evidence.

## Interface
None.

## Touch
${touchText}

## Do not touch
- \`other/keep.ts\`

## Checklist
- [ ] run verify
`;
}

function writeVerificationTask(repo, number, {
  dependsOn = ['TASKS-001'],
  touchText = '- Source changes: none; record CI evidence only.\n',
} = {}) {
  const dir = `${BP_REL}/tasks/${number}`;
  writeDoc(repo, `${dir}/tasks.md`, {
    type: 'bouncer.tasks',
    title: `Verify ${number}`,
    description: 'd',
    resource: `${dir}/tasks.md`,
    tags: ['bouncer'],
    timestamp: '2026-07-01T00:00:00+09:00',
    bouncer: {
      id: `TASKS-${number}`,
      epic_id: '001',
      blueprint_id: '001',
      status: 'ready',
      execution_kind: 'verification',
      affected_paths: [],
      depends_on: dependsOn,
      parallel_safe: false,
      dependency_gate: 'integrated',
      verify: 'node --test',
    },
  }, verificationBody(touchText));
  writeDoc(repo, `${dir}/verification.md`, {
    type: 'bouncer.verification',
    title: 'v',
    description: 'd',
    resource: `${dir}/verification.md`,
    tags: ['bouncer'],
    timestamp: '2026-07-01T00:00:00+09:00',
    bouncer: {
      id: `VERIFY-${number}`, epic_id: '001', blueprint_id: '001', status: 'pending',
    },
  });
}

function writePlanTree(repo, { scale = 'full', complexity, tasks = ['001'], reviewContract } = {}) {
  writeBundleIndex(repo);
  writeDoc(repo, `${EPIC_REL}/index.md`, {
    type: 'bouncer.epic',
    title: 'Auth',
    description: 'd',
    resource: `${EPIC_REL}/index.md`,
    tags: ['bouncer'],
    timestamp: '2026-07-01T00:00:00+09:00',
    bouncer: { id: '001', epic_id: '001', status: 'approved' },
  }, '# Auth epic\n');
  writeDoc(repo, `${BP_REL}/index.md`, {
    type: 'bouncer.blueprint',
    title: 'Login',
    description: 'd',
    resource: `${BP_REL}/index.md`,
    tags: ['bouncer'],
    timestamp: '2026-07-01T00:00:00+09:00',
    bouncer: {
      id: '001', epic_id: '001', blueprint_id: '001', status: 'approved', scale,
      ...(complexity === undefined ? {} : { complexity }),
      // S38: 표식은 review_scope blueprint가 전제다. 표식 fixture만 이 전제를 갖춘다.
      ...(reviewContract === undefined ? {} : { review_scope: 'blueprint', review_contract: reviewContract }),
    },
  }, '# Login blueprint\n');
  for (const number of tasks) {
    if (number === '003' && scale === 'full') {
      // optional verification slot filled by callers
    }
    writeCommitTask(repo, number, {
      dependsOn: number === '001' ? [] : ['TASKS-001'],
      interfaceText: number === '002'
        ? '- `sharedFn`\n- `classifyPlanReview`\n'
        : '- `sharedFn`\n',
      touchText: number === '002'
        ? '- `src/shared.ts`\n- `src/b.ts`\n'
        : '- `src/shared.ts`\n- `src/a.ts`\n',
    });
  }
}

function makeRepo() {
  const repo = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), 'bouncer-review-dispatch-')));
  git(repo, ['init', '-q', '-b', 'main']);
  git(repo, ['config', 'user.email', 'test@example.com']);
  git(repo, ['config', 'user.name', 'test']);
  fs.writeFileSync(path.join(repo, 'README'), 'base\n');
  git(repo, ['add', 'README']);
  git(repo, ['commit', '-qm', 'baseline']);
  return repo;
}

// 계획 문서(.bouncer/context 아래)는 새 계약에서 리뷰 대상이다. fixture가 만든 계획 문서를
// 변경으로 세지 않도록 baseline 커밋에 모두 담고 그 SHA를 base로 돌려준다.
function commitBaseline(repo) {
  git(repo, ['add', '-A']);
  git(repo, ['commit', '-qm', 'baseline with plan documents']);
  return git(repo, ['rev-parse', 'HEAD']).trim();
}

function capture(argv) {
  const buf = { out: '', err: '' };
  const code = runCli(argv, {
    out: (s) => { buf.out += s; },
    err: (s) => { buf.err += s; },
  });
  return { code, ...buf };
}

// v2 digest 계약: 문서 경로·본문·정규화 판단 구조를 경계가 있는 ordered 배열로 직렬화해 hash한다.
// 구조는 브리프의 필드 목록과 schema 기본값(부재=빈 배열/false/integrated/commit)에서 직접 만든다.
function expectedStructure(rel, data) {
  const b = (data && data.bouncer) || {};
  if (/\/tasks\/\d{3}\/tasks\.md$/.test(rel)) {
    return {
      affected_paths: [...(b.affected_paths || [])].sort(),
      depends_on: [...(b.depends_on || [])].sort(),
      parallel_safe: b.parallel_safe === true,
      dependency_gate: b.dependency_gate || 'integrated',
      exclusive_resources: [...(b.exclusive_resources || [])].sort(),
      execution_kind: b.execution_kind || 'commit',
    };
  }
  if (rel === `${BP_REL}/index.md`) {
    return { scale: b.scale === 'light' ? 'light' : 'full', review_scope: b.review_scope === 'blueprint' ? 'blueprint' : null };
  }
  return {};
}

function expectedContent(repo) {
  const documents = [
    `${EPIC_REL}/index.md`,
    `${BP_REL}/index.md`,
  ];
  const tasksRoot = path.join(repo, BP_REL, 'tasks');
  if (fs.existsSync(tasksRoot)) {
    for (const name of fs.readdirSync(tasksRoot).sort()) {
      if (!/^\d{3}$/.test(name)) continue;
      documents.push(`${BP_REL}/tasks/${name}/tasks.md`);
    }
  }
  const content = {};
  for (const rel of documents) {
    const raw = fs.readFileSync(path.join(repo, rel), 'utf8');
    const m = raw.match(/^---\n([\s\S]*?)\n---\n/);
    content[rel] = { body: raw.slice(m[0].length), structure: expectedStructure(rel, yaml.load(m[1])) };
  }
  return { documents, content };
}

function expectedDigest(repo) {
  const { documents, content } = expectedContent(repo);
  const digest = crypto.createHash('sha256')
    .update(JSON.stringify(documents.map((file) => ({ file, body: content[file].body, structure: content[file].structure }))))
    .digest('hex');
  return { digest, documents };
}

test('size constants → are exported from one module', () => {
  assert.strictEqual(EXECUTE_SMALL_MAX_FILES, 3);
  assert.strictEqual(EXECUTE_SMALL_MAX_LINES, 200);
});

test('snapshot contract → exposes the same pure digest helpers without I/O dependencies', () => {
  const contractPath = require.resolve('../packages/cli/dist/plan-snapshot-contract');
  const compatibility = require('../packages/cli/dist/plan-snapshot');
  const Module = require('node:module');
  const originalLoad = Module._load;
  const blocked = new Set([
    'node:fs', 'fs', 'node:child_process', 'child_process',
    './plan-snapshot', './plan-approve', './scaffold', './review-dispatch', './validate',
  ]);
  const attempted = [];
  Module._load = function (request, parent, isMain) {
    if (blocked.has(request)) {
      attempted.push(request);
      throw new Error(`forbidden contract dependency: ${request}`);
    }
    return originalLoad.call(this, request, parent, isMain);
  };
  let contract;
  try {
    delete require.cache[contractPath];
    contract = require(contractPath);
  } finally {
    Module._load = originalLoad;
  }
  assert.deepStrictEqual(attempted, []);
  assert.strictEqual(typeof contract.digestPlanContent, 'function');
  assert.strictEqual(typeof contract.normalizeStructure, 'function');
  assert.strictEqual(compatibility.SNAPSHOT_VERSION, contract.SNAPSHOT_VERSION);
  const structure = { affected_paths: ['b', 'a'] };
  const content = { a: { body: 'body', structure } };
  assert.strictEqual(compatibility.digestPlanContent(['a'], content), contract.digestPlanContent(['a'], content));
  assert.deepStrictEqual(
    compatibility.normalizeStructure('task', { affected_paths: ['b', 'a'] }),
    contract.normalizeStructure('task', { affected_paths: ['b', 'a'] }),
  );
  assert.strictEqual(compatibility.structureKindOf(`${BP_REL}/index.md`, BP_REL), contract.structureKindOf(`${BP_REL}/index.md`, BP_REL));
  assert.strictEqual(compatibility.hashBody('body'), contract.hashBody('body'));
  assert.strictEqual(compatibility.hashStructure(structure), contract.hashStructure(structure));

  // 금지 모듈을 요구하는 fixture로 감시 장치가 실제 위반을 잡는지도 확인한다.
  const violatingFixture = () => Module._load('node:fs', module, false);
  assert.throws(() => {
    Module._load = function (request, parent, isMain) {
      if (blocked.has(request)) throw new Error(`forbidden contract dependency: ${request}`);
      return originalLoad.call(this, request, parent, isMain);
    };
    violatingFixture();
  }, /forbidden contract dependency: node:fs/);
  Module._load = originalLoad;
});

test('plan with a single commit task → returns combined', () => {
  const repo = makeRepo();
  writePlanTree(repo, { scale: 'full', tasks: ['001'] });
  writeVerificationTask(repo, '002', { dependsOn: ['TASKS-001'] });
  const result = classifyPlanReview({ repoRoot: repo, blueprintDir: BP_REL });
  assert.strictEqual(result.ok, true);
  assert.strictEqual(result.strategy, 'single');
  assert.strictEqual(result.task_count, 1);
  assert.deepStrictEqual(result.perspectives, ['combined']);
  const expected = expectedDigest(repo);
  assert.strictEqual(result.target.digest, expected.digest);
  assert.deepStrictEqual(result.target.documents, expected.documents);
  assert.ok(Array.isArray(result.reasons) && result.reasons.length > 0);
});

const PLAN_PERSPECTIVES = ['consistency', 'scope_minimality', 'verifiability', 'risk_security'];

test('plan with review_contract brief on a full blueprint → returns perspectives with four names', () => {
  const repo = makeRepo();
  writePlanTree(repo, { scale: 'full', tasks: ['001'], reviewContract: 'brief' });
  writeVerificationTask(repo, '002', { dependsOn: ['TASKS-001'] });
  const result = classifyPlanReview({ repoRoot: repo, blueprintDir: BP_REL });
  assert.strictEqual(result.ok, true);
  assert.strictEqual(result.strategy, 'perspectives');
  assert.deepStrictEqual(result.perspectives, PLAN_PERSPECTIVES);
  assert.strictEqual(result.task_count, 1);
  assert.strictEqual(result.clusters.length, 1);
  assert.strictEqual(result.follow_up, 'full');
});

test('plan with review_contract brief and complexity low → returns verifiability with follow_up', () => {
  const repo = makeRepo();
  writePlanTree(repo, { complexity: 'low', tasks: ['001'], reviewContract: 'brief' });
  const result = classifyPlanReview({ repoRoot: repo, blueprintDir: BP_REL });
  assert.strictEqual(result.ok, true);
  assert.strictEqual(result.strategy, 'perspectives');
  assert.deepStrictEqual(result.perspectives, ['verifiability']);
  assert.strictEqual(result.follow_up, 'full');
  assert.ok(result.parts && result.documents_content);
});

test('plan with a perspectives previous payload → accepts it and reports a follow_up', () => {
  const repo = makeRepo();
  writePlanTree(repo, { scale: 'full', tasks: ['001'], reviewContract: 'brief' });
  const first = classifyPlanReview({ repoRoot: repo, blueprintDir: BP_REL });
  assert.strictEqual(first.strategy, 'perspectives');
  const again = classifyPlanReview({ repoRoot: repo, blueprintDir: BP_REL, previous: first });
  assert.strictEqual(again.ok, true, JSON.stringify(again));
  assert.strictEqual(again.strategy, 'perspectives');
  assert.strictEqual(again.follow_up, 'partial');
});

test('legacy blueprint with a non single/clustered previous strategy → returns the legacy rejection object', () => {
  const repo = makeRepo();
  writePlanTree(repo, { scale: 'full', tasks: ['001'] });
  const first = classifyPlanReview({ repoRoot: repo, blueprintDir: BP_REL });
  for (const strategy of ['perspectives', 'bogus']) {
    const result = classifyPlanReview({
      repoRoot: repo, blueprintDir: BP_REL, previous: { ...previousPayload(first), strategy },
    });
    assert.deepStrictEqual(result, {
      ok: false,
      reason: 'previous-payload-invalid',
      cause: 'previous strategy must be single or clustered',
      next: 'pass the unmodified JSON that review-dispatch plan printed for this blueprint',
    }, strategy);
  }
});

test('review_contract brief blueprint with a bogus previous strategy → keeps the three-strategy cause', () => {
  for (const complexity of [undefined, 'low']) {
    const repo = makeRepo();
    writePlanTree(repo, { scale: 'full', complexity, tasks: ['001'], reviewContract: 'brief' });
    const first = classifyPlanReview({ repoRoot: repo, blueprintDir: BP_REL });
    const result = classifyPlanReview({
      repoRoot: repo, blueprintDir: BP_REL, previous: { ...previousPayload(first), strategy: 'bogus' },
    });
    assert.strictEqual(result.reason, 'previous-payload-invalid', String(complexity));
    assert.strictEqual(result.cause, 'previous strategy must be single, clustered or perspectives', String(complexity));
    const ok = classifyPlanReview({ repoRoot: repo, blueprintDir: BP_REL, previous: first });
    assert.strictEqual(ok.ok, true, String(complexity));
    assert.strictEqual(ok.strategy, 'perspectives', String(complexity));
  }
});

test('plan with review_contract other → rejects with review-contract-invalid', () => {
  for (const scale of ['full', 'light']) {
    const repo = makeRepo();
    writePlanTree(repo, { scale, tasks: ['001'], reviewContract: 'other' });
    const result = classifyPlanReview({ repoRoot: repo, blueprintDir: BP_REL });
    assert.strictEqual(result.ok, false, scale);
    assert.strictEqual(result.error, 'review-contract-invalid: review_contract must be brief', scale);
  }
});

function rewriteTasksGoal(repo, number, goalLine) {
  const abs = path.join(repo, BP_REL, 'tasks', number, 'tasks.md');
  const raw = fs.readFileSync(abs, 'utf8');
  const updated = raw.replace(
    /## Goal & intent\n[\s\S]*?\n## Current behavior/,
    `## Goal & intent\n${goalLine}\n\n## Current behavior`,
  );
  fs.writeFileSync(abs, updated);
}

// 공개 분류 결과를 그대로 직렬화한 정상 payload. 일부 필드만 골라 만든 축소본은
// 엄격한 previous 검사를 피해 가므로 실제 출력 모양을 보존한다.
function previousPayload(result) {
  return JSON.parse(JSON.stringify(result));
}

// follow_up·parts·scope_parts 계약. 범위 필드는 각각 단독으로 full을 강제해야 한다
// (한 테스트에서 Interface·Touch·affected_paths를 같이 바꾸면 어느 한 필드를
// scopeMaterial에서 빼도 통과하므로 F-001 회귀가 안 잡힌다).
test('plan follow_up without previous → is full with empty changed_documents', () => {
  const repo = makeRepo();
  writePlanTree(repo, { scale: 'full', tasks: ['001'] });
  const out = classifyPlanReview({ repoRoot: repo, blueprintDir: BP_REL });
  assert.strictEqual(out.ok, true);
  assert.strictEqual(out.strategy, 'single');
  assert.strictEqual(out.follow_up, 'full');
  // 최초 full은 전체 현재 문서를 변경 목록으로 두고 before는 null이다.
  assert.deepStrictEqual(out.changed_documents, [...expectedDigest(repo).documents].sort());
  assert.ok(out.revision_diff.every((d) => d.before === null && d.after !== null));
  assert.ok(out.parts && typeof out.parts === 'object');
  assert.ok(out.scope_parts && typeof out.scope_parts === 'object');
  const expected = expectedDigest(repo);
  assert.strictEqual(out.target.digest, expected.digest);
  assert.deepStrictEqual(Object.keys(out.parts).sort(), [...expected.documents].sort());
  assert.ok(out.parts[`${BP_REL}/tasks/001/tasks.md`]);
  assert.ok(out.scope_parts[`${BP_REL}/tasks/001/tasks.md`]);
});

test('plan follow_up with a Goal-only body change → is partial with that tasks.md', () => {
  const repo = makeRepo();
  writePlanTree(repo, { scale: 'full', tasks: ['001'] });
  const before = classifyPlanReview({ repoRoot: repo, blueprintDir: BP_REL });
  assert.strictEqual(before.ok, true);
  const digestBefore = before.target.digest;
  rewriteTasksGoal(repo, '001', 'Ship a different goal wording.');
  const out = classifyPlanReview({
    repoRoot: repo,
    blueprintDir: BP_REL,
    previous: previousPayload(before),
  });
  assert.strictEqual(out.ok, true);
  assert.strictEqual(out.follow_up, 'partial');
  assert.deepStrictEqual(out.changed_documents, [`${BP_REL}/tasks/001/tasks.md`]);
  // 본문만 바뀌어도 집계 digest는 새 본문 기준이며, 회귀로 계산 순서가 깨지지 않았는지 확인.
  const expected = expectedDigest(repo);
  assert.strictEqual(out.target.digest, expected.digest);
  assert.notStrictEqual(out.target.digest, digestBefore);
});

test('plan follow_up with unchanged documents → is partial with empty list', () => {
  const repo = makeRepo();
  writePlanTree(repo, { scale: 'full', tasks: ['001'] });
  const before = classifyPlanReview({ repoRoot: repo, blueprintDir: BP_REL });
  const out = classifyPlanReview({
    repoRoot: repo,
    blueprintDir: BP_REL,
    previous: previousPayload(before),
  });
  assert.strictEqual(out.ok, true);
  assert.strictEqual(out.follow_up, 'partial');
  assert.deepStrictEqual(out.changed_documents, []);
  assert.strictEqual(out.target.digest, before.target.digest);
});

test('plan follow_up with an epic index body change → is partial with the epic and all tasks related', () => {
  const repo = makeRepo();
  writePlanTree(repo, { scale: 'full', tasks: ['001'] });
  const before = classifyPlanReview({ repoRoot: repo, blueprintDir: BP_REL });
  const abs = path.join(repo, `${EPIC_REL}/index.md`);
  fs.writeFileSync(abs, fs.readFileSync(abs, 'utf8').replace('# Auth epic\n', '# Auth epic revised\n'));
  const out = classifyPlanReview({
    repoRoot: repo,
    blueprintDir: BP_REL,
    previous: previousPayload(before),
  });
  assert.strictEqual(out.ok, true);
  assert.strictEqual(out.follow_up, 'partial');
  assert.deepStrictEqual(out.changed_documents, [`${EPIC_REL}/index.md`]);
  assert.deepStrictEqual(out.related_documents, [`${BP_REL}/index.md`, `${BP_REL}/tasks/001/tasks.md`]);
  assert.deepStrictEqual(out.revision_diff.map((d) => d.file), [`${EPIC_REL}/index.md`]);
  assert.strictEqual(out.revision_diff[0].before.body, '# Auth epic\n');
  assert.strictEqual(out.revision_diff[0].after.body, '# Auth epic revised\n');
});

test('plan follow_up with a blueprint index body change → is partial with the blueprint index changed', () => {
  const repo = makeRepo();
  writePlanTree(repo, { scale: 'full', tasks: ['001'] });
  const before = classifyPlanReview({ repoRoot: repo, blueprintDir: BP_REL });
  const abs = path.join(repo, `${BP_REL}/index.md`);
  fs.writeFileSync(abs, fs.readFileSync(abs, 'utf8').replace('# Login blueprint\n', '# Login blueprint revised\n'));
  const out = classifyPlanReview({
    repoRoot: repo,
    blueprintDir: BP_REL,
    previous: previousPayload(before),
  });
  assert.strictEqual(out.ok, true);
  assert.strictEqual(out.follow_up, 'partial');
  assert.deepStrictEqual(out.changed_documents, [`${BP_REL}/index.md`]);
});

// writePlanTree(001) 기본 Touch/Interface. 단독 변이 시 다른 scope 입력은 이 값을 유지한다.
const PLAN_TASK_001_INTERFACE = '- `sharedFn`\n';
const PLAN_TASK_001_TOUCH = '- `src/shared.ts`\n- `src/a.ts`\n';
const PLAN_TASK_001_AFFECTED = ['src/shared.ts', 'src/a.ts'];

test('plan follow_up with an Interface-only change → is partial with that tasks.md changed', () => {
  const repo = makeRepo();
  writePlanTree(repo, { scale: 'full', tasks: ['001'] });
  const before = classifyPlanReview({ repoRoot: repo, blueprintDir: BP_REL });
  // Interface만 바꾼다. Touch·affected_paths·depends_on은 그대로 — Interface가
  // scopeMaterial에서 빠지면 follow_up이 partial로 기울어 F-001이 다시 열린다.
  writeCommitTask(repo, '001', {
    interfaceText: '- `sharedFn`\n- `newExport`\n',
    touchText: PLAN_TASK_001_TOUCH,
    affectedPaths: PLAN_TASK_001_AFFECTED,
  });
  const out = classifyPlanReview({
    repoRoot: repo,
    blueprintDir: BP_REL,
    previous: previousPayload(before),
  });
  assert.strictEqual(out.ok, true);
  assert.strictEqual(out.follow_up, 'partial');
  assert.deepStrictEqual(out.changed_documents, [`${BP_REL}/tasks/001/tasks.md`]);
  assert.notStrictEqual(
    out.scope_parts[`${BP_REL}/tasks/001/tasks.md`],
    before.scope_parts[`${BP_REL}/tasks/001/tasks.md`],
  );
});

test('plan follow_up with a Touch-only change → is partial with that tasks.md changed', () => {
  const repo = makeRepo();
  writePlanTree(repo, { scale: 'full', tasks: ['001'] });
  const before = classifyPlanReview({ repoRoot: repo, blueprintDir: BP_REL });
  // 같은 백틱 경로를 유지해 affected_paths는 고정하고 Touch 절 문구만 바꾼다.
  writeCommitTask(repo, '001', {
    interfaceText: PLAN_TASK_001_INTERFACE,
    touchText: '- Modify `src/shared.ts`\n- Modify `src/a.ts`\n',
    affectedPaths: PLAN_TASK_001_AFFECTED,
  });
  const out = classifyPlanReview({
    repoRoot: repo,
    blueprintDir: BP_REL,
    previous: previousPayload(before),
  });
  assert.strictEqual(out.ok, true);
  assert.strictEqual(out.follow_up, 'partial');
  assert.deepStrictEqual(out.changed_documents, [`${BP_REL}/tasks/001/tasks.md`]);
  assert.notStrictEqual(
    out.scope_parts[`${BP_REL}/tasks/001/tasks.md`],
    before.scope_parts[`${BP_REL}/tasks/001/tasks.md`],
  );
});

test('plan follow_up with an affected_paths-only scope_parts change → is full', () => {
  const repo = makeRepo();
  writePlanTree(repo, { scale: 'full', tasks: ['001'] });
  const before = classifyPlanReview({ repoRoot: repo, blueprintDir: BP_REL });
  // Touch 본문은 그대로 두고 affected_paths만 축소한다.
  // frontmatter만 바뀌므로 parts는 같아도 scope_parts가 달라 full이어야 한다.
  writeCommitTask(repo, '001', {
    interfaceText: PLAN_TASK_001_INTERFACE,
    touchText: PLAN_TASK_001_TOUCH,
    affectedPaths: ['src/a.ts'],
  });
  const out = classifyPlanReview({
    repoRoot: repo,
    blueprintDir: BP_REL,
    previous: previousPayload(before),
  });
  assert.strictEqual(out.ok, true);
  assert.strictEqual(out.follow_up, 'full');
  assert.deepStrictEqual(out.changed_documents, [`${BP_REL}/tasks/001/tasks.md`]);
  assert.notStrictEqual(
    out.scope_parts[`${BP_REL}/tasks/001/tasks.md`],
    before.scope_parts[`${BP_REL}/tasks/001/tasks.md`],
  );
});

test('plan follow_up with a depends_on-only scope_parts change → is full', () => {
  const repo = makeRepo();
  writePlanTree(repo, { scale: 'full', tasks: ['001', '002'] });
  const before = classifyPlanReview({ repoRoot: repo, blueprintDir: BP_REL });
  // 002의 depends_on만 비운다. Interface·Touch·affected_paths는 writePlanTree(002)와 동일.
  writeCommitTask(repo, '002', {
    dependsOn: [],
    interfaceText: '- `sharedFn`\n- `classifyPlanReview`\n',
    touchText: '- `src/shared.ts`\n- `src/b.ts`\n',
  });
  const out = classifyPlanReview({
    repoRoot: repo,
    blueprintDir: BP_REL,
    previous: previousPayload(before),
  });
  assert.strictEqual(out.ok, true);
  assert.strictEqual(out.follow_up, 'full');
  assert.deepStrictEqual(out.changed_documents, [`${BP_REL}/tasks/002/tasks.md`]);
  assert.notStrictEqual(
    out.scope_parts[`${BP_REL}/tasks/002/tasks.md`],
    before.scope_parts[`${BP_REL}/tasks/002/tasks.md`],
  );
});

test('plan follow_up with an added task → is full', () => {
  const repo = makeRepo();
  writePlanTree(repo, { scale: 'full', tasks: ['001'] });
  const before = classifyPlanReview({ repoRoot: repo, blueprintDir: BP_REL });
  writeCommitTask(repo, '002', {
    dependsOn: ['TASKS-001'],
    interfaceText: '- `sharedFn`\n- `classifyPlanReview`\n',
    touchText: '- `src/shared.ts`\n- `src/b.ts`\n',
  });
  const out = classifyPlanReview({
    repoRoot: repo,
    blueprintDir: BP_REL,
    previous: previousPayload(before),
  });
  assert.strictEqual(out.ok, true);
  assert.strictEqual(out.strategy, 'single');
  assert.strictEqual(out.follow_up, 'full');
  assert.deepStrictEqual(out.changed_documents, [`${BP_REL}/tasks/002/tasks.md`]);
});

test('plan with an invalid previous payload → rejects with previous-payload-invalid', () => {
  const repo = makeRepo();
  writePlanTree(repo, { scale: 'full', tasks: ['001'] });
  const missingParts = classifyPlanReview({
    repoRoot: repo,
    blueprintDir: BP_REL,
    previous: { ok: true, target: { digest: 'x', documents: [] } },
  });
  assert.strictEqual(missingParts.ok, false);
  assert.strictEqual(missingParts.reason, 'previous-payload-invalid');

  const prevPath = path.join(repo, 'previous.json');
  fs.writeFileSync(prevPath, '{ not json');
  const badJson = capture([
    'review-dispatch', 'plan', '--blueprint', BP_REL, '--repo', repo,
    '--previous', prevPath,
  ]);
  assert.strictEqual(badJson.code, 1);
  const badPayload = JSON.parse(badJson.out);
  assert.strictEqual(badPayload.ok, false);
  assert.strictEqual(badPayload.reason, 'previous-payload-invalid');

  const missingFile = capture([
    'review-dispatch', 'plan', '--blueprint', BP_REL, '--repo', repo,
    '--previous', path.join(repo, 'no-such-previous.json'),
  ]);
  assert.strictEqual(missingFile.code, 1);
  assert.strictEqual(JSON.parse(missingFile.out).reason, 'previous-payload-invalid');

  const bareFlag = capture([
    'review-dispatch', 'plan', '--blueprint', BP_REL, '--repo', repo, '--previous',
  ]);
  assert.strictEqual(bareFlag.code, 2);
});

test('plan with parts present → aggregate digest stays invariant', () => {
  const repo = makeRepo();
  writePlanTree(repo, { scale: 'full', tasks: ['001', '002'] });
  const out = classifyPlanReview({ repoRoot: repo, blueprintDir: BP_REL });
  assert.strictEqual(out.ok, true);
  const expected = expectedDigest(repo);
  assert.strictEqual(out.target.digest, expected.digest);
  assert.deepStrictEqual(out.target.documents, expected.documents);
  // 문서별 parts의 본문 sha256을 이어 붙인 값이 집계 digest가 아니다 — 집계는
  // 기존처럼 본문을 한 해시로 이어 붙인 결과여야 한다.
  const joinedParts = crypto.createHash('sha256');
  for (const rel of expected.documents) joinedParts.update(Buffer.from(out.parts[rel], 'hex'));
  assert.notStrictEqual(joinedParts.digest('hex'), out.target.digest);
});

test('plan with three commit tasks → returns single combined', () => {
  const repo = makeRepo();
  writePlanTree(repo, { scale: 'full', tasks: ['001', '002', '003'] });
  const result = classifyPlanReview({ repoRoot: repo, blueprintDir: BP_REL });
  assert.strictEqual(result.ok, true);
  assert.strictEqual(result.strategy, 'single');
  assert.strictEqual(result.task_count, 3);
  assert.deepStrictEqual(result.perspectives, ['combined']);
  assert.strictEqual(result.clusters.length, 1);
  assert.deepStrictEqual(result.clusters[0].tasks, ['TASKS-001', 'TASKS-002', 'TASKS-003']);
  assert.deepStrictEqual(result.clusters[0].touch_paths, ['src/a.ts', 'src/b.ts', 'src/shared.ts']);
});

test('plan with four commit tasks → returns single combined', () => {
  const repo = makeRepo();
  writePlanTree(repo, { scale: 'full', tasks: ['001', '002', '003', '004'] });
  const result = classifyPlanReview({ repoRoot: repo, blueprintDir: BP_REL });
  assert.strictEqual(result.ok, true);
  assert.strictEqual(result.strategy, 'single');
  assert.strictEqual(result.task_count, 4);
  assert.deepStrictEqual(result.perspectives, ['combined']);
});

test('context-review template → guides new categories combined local global', () => {
  const { LEGACY_SCAFFOLD_COMMENT_BODIES } = require('../packages/cli/dist/templates');
  const guide = LEGACY_SCAFFOLD_COMMENT_BODIES.find((body) => body.includes('optional bouncer.context_review.rounds[]'));
  assert.ok(guide);
  assert.ok(guide.includes('category: combined | local | global | consistency | scope_minimality'));
  assert.ok(guide.includes('verifiability | risk_security'));
  assert.ok(!guide.includes('category: cross_document | scope | korean_quality'));
});

test('plan with two overlapping tasks → returns one combined cluster holding every task', () => {
  const repo = makeRepo();
  writePlanTree(repo, { scale: 'full', tasks: ['001', '002', '003', '004'] });
  const result = classifyPlanReview({ repoRoot: repo, blueprintDir: BP_REL });
  assert.strictEqual(result.ok, true);
  assert.strictEqual(result.strategy, 'single');
  assert.strictEqual(result.task_count, 4);
  assert.strictEqual(result.clusters.length, 1);
  assert.deepStrictEqual(result.clusters[0].tasks, ['TASKS-001', 'TASKS-002', 'TASKS-003', 'TASKS-004']);
  assert.ok(result.clusters[0].interface_keys.includes('sharedFn'));
  assert.ok(result.clusters[0].touch_paths.some((p) => p.includes('shared')));
  assert.deepStrictEqual(result.perspectives, ['combined']);
});

test('plan with two non-overlapping task pairs → still gets one single combined review', () => {
  const repo = makeRepo();
  writeBundleIndex(repo);
  writeDoc(repo, `${EPIC_REL}/index.md`, {
    type: 'bouncer.epic', title: 'Auth', description: 'd', resource: `${EPIC_REL}/index.md`,
    tags: ['bouncer'], timestamp: '2026-07-01T00:00:00+09:00',
    bouncer: { id: '001', epic_id: '001', status: 'approved' },
  }, '# Auth\n');
  writeDoc(repo, `${BP_REL}/index.md`, {
    type: 'bouncer.blueprint', title: 'Login', description: 'd', resource: `${BP_REL}/index.md`,
    tags: ['bouncer'], timestamp: '2026-07-01T00:00:00+09:00',
    bouncer: {
      id: '001', epic_id: '001', blueprint_id: '001', status: 'approved', scale: 'full',
    },
  }, '# Login\n');
  writeCommitTask(repo, '001', {
    interfaceText: '- `alphaOnly`\n',
    touchText: '- `src/alpha.ts`\n',
  });
  writeCommitTask(repo, '002', {
    dependsOn: ['TASKS-001'],
    interfaceText: '- `alphaOnly`\n',
    touchText: '- `src/alpha.ts`\n',
  });
  writeCommitTask(repo, '003', {
    dependsOn: ['TASKS-001'],
    interfaceText: '- `betaOnly`\n',
    touchText: '- `src/beta.ts`\n',
  });
  writeCommitTask(repo, '004', {
    dependsOn: ['TASKS-001'],
    interfaceText: '- `betaOnly`\n',
    touchText: '- `src/beta.ts`\n',
  });
  const result = classifyPlanReview({ repoRoot: repo, blueprintDir: BP_REL });
  assert.strictEqual(result.ok, true);
  assert.strictEqual(result.strategy, 'single');
  assert.strictEqual(result.clusters.length, 1);
  assert.deepStrictEqual(result.clusters[0].tasks, ['TASKS-001', 'TASKS-002', 'TASKS-003', 'TASKS-004']);
  assert.deepStrictEqual(result.perspectives, ['combined']);
});

test('plan with an empty Interface → rejects without perspectives', () => {
  const repo = makeRepo();
  writeBundleIndex(repo);
  writeDoc(repo, `${EPIC_REL}/index.md`, {
    type: 'bouncer.epic', title: 'Auth', description: 'd', resource: `${EPIC_REL}/index.md`,
    tags: ['bouncer'], timestamp: '2026-07-01T00:00:00+09:00',
    bouncer: { id: '001', epic_id: '001', status: 'approved' },
  }, '# Auth\n');
  writeDoc(repo, `${BP_REL}/index.md`, {
    type: 'bouncer.blueprint', title: 'Login', description: 'd', resource: `${BP_REL}/index.md`,
    tags: ['bouncer'], timestamp: '2026-07-01T00:00:00+09:00',
    bouncer: {
      id: '001', epic_id: '001', blueprint_id: '001', status: 'approved', scale: 'full',
    },
  }, '# Login\n');
  writeCommitTask(repo, '001', { interfaceText: '\n', touchText: '- `src/a.ts`\n' });
  const result = classifyPlanReview({ repoRoot: repo, blueprintDir: BP_REL });
  assert.strictEqual(result.ok, false);
  assert.ok(!('perspectives' in result) || result.perspectives === undefined);
});

test('plan draft validation with a verification Touch command → rejects before reviewers (G20)', () => {
  const repo = makeRepo();
  writePlanTree(repo, { scale: 'full', tasks: ['001'] });
  writeVerificationTask(repo, '002', { touchText: '- `npm run ci`\n' });
  const result = classifyPlanReview({ repoRoot: repo, blueprintDir: BP_REL });
  assert.strictEqual(result.ok, false);
  assert.strictEqual(result.error, 'plan draft validation failed');
  assert.ok(result.failures.some((f) => f.code === 'G20'), JSON.stringify(result.failures));
  assert.ok(!('perspectives' in result) || result.perspectives === undefined);
});

test('plan draft validation with a depends_on self-edge → rejects before reviewers (G19)', () => {
  const repo = makeRepo();
  writePlanTree(repo, { scale: 'full', tasks: ['001'] });
  writeCommitTask(repo, '001', {
    dependsOn: ['TASKS-001'],
    touchText: '- `src/shared.ts`\n- `src/a.ts`\n',
  });
  const result = classifyPlanReview({ repoRoot: repo, blueprintDir: BP_REL });
  assert.strictEqual(result.ok, false);
  assert.strictEqual(result.error, 'plan draft validation failed');
  assert.ok(result.failures.some((f) => f.code === 'G19'), JSON.stringify(result.failures));
});

// G20 draft 실패가 이미 있는 tree에 review_risk 문자열(구조 실패)을 더한다.
// 먼저 draft 실패만 있는 상태를 단언해 두어야, 뒤의 "S만 남음"이 draft 검사
// 건너뛰기 덕분이지 draft 실패가 원래 없어서가 아님이 드러난다.
function writeStructuralAndDraftFailureTree(repo) {
  writePlanTree(repo, { scale: 'full', tasks: ['001'] });
  writeVerificationTask(repo, '002', { touchText: '- `npm run ci`\n' });
  const draftOnly = validateBlueprint({ repoRoot: repo, blueprintDir: BP_REL, planDraft: true });
  assert.ok(draftOnly.failures.some((f) => f.code === 'G20'), JSON.stringify(draftOnly.failures));
  writeCommitTask(repo, '001', {
    reviewRisk: 'public_interface',
    touchText: '- `src/shared.ts`\n- `src/a.ts`\n',
  });
}

const DRAFT_CODES = ['G5', 'G19', 'G20'];

test('validateBlueprint planDraft with structural failures → skips draft checks', () => {
  const repo = makeRepo();
  writeStructuralAndDraftFailureTree(repo);
  const result = validateBlueprint({ repoRoot: repo, blueprintDir: BP_REL, planDraft: true });
  assert.strictEqual(result.ok, false);
  assert.ok(result.failures.length > 0);
  assert.ok(result.failures.every((f) => f.code.startsWith('S')), JSON.stringify(result.failures));
  assert.ok(!result.failures.some((f) => DRAFT_CODES.includes(f.code)), JSON.stringify(result.failures));
});

test('plan with structural and draft failures → structural failure wins and classifies as structural', () => {
  const repo = makeRepo();
  writeStructuralAndDraftFailureTree(repo);
  const result = classifyPlanReview({ repoRoot: repo, blueprintDir: BP_REL });
  assert.strictEqual(result.ok, false);
  assert.strictEqual(result.error, 'structural validation failed');
  assert.ok(result.failures.length > 0);
  assert.ok(result.failures.every((f) => f.code.startsWith('S')), JSON.stringify(result.failures));
  assert.ok(!('perspectives' in result) || result.perspectives === undefined);
});

test('execute with a small diff → returns single combined', () => {
  const repo = makeRepo();
  writePlanTree(repo, { tasks: ['001'] });
  const base = commitBaseline(repo);
  fs.mkdirSync(path.join(repo, 'src'), { recursive: true });
  fs.writeFileSync(path.join(repo, 'src/a.ts'), 'export const a = 1;\n');
  fs.writeFileSync(path.join(repo, 'src/b.ts'), 'export const b = 1;\n');
  git(repo, ['add', 'src/a.ts', 'src/b.ts']);
  git(repo, ['commit', '-qm', 'change']);
  const head = git(repo, ['rev-parse', 'HEAD']).trim();
  const result = classifyExecuteReview({
    repoRoot: repo, blueprintDir: BP_REL, taskId: '001', base, head,
  });
  assert.strictEqual(result.ok, true);
  assert.strictEqual(result.strategy, 'single');
  assert.ok(result.changed_files <= EXECUTE_SMALL_MAX_FILES);
  assert.ok(result.changed_lines <= EXECUTE_SMALL_MAX_LINES);
  assert.deepStrictEqual(result.risk_flags, []);
  assert.deepStrictEqual(result.perspectives, ['combined']);
  assert.deepStrictEqual(result.target, {
    base, head, task: '001',
    snapshot_id: result.target.snapshot_id,
    snapshot_path: `.bouncer/runtime/review-snapshots/${result.target.snapshot_id}/snapshot.json`,
  });
  assert.match(result.target.snapshot_id, /^[0-9a-f]{64}$/);
});

test('execute over the file threshold → returns parallel', () => {
  const repo = makeRepo();
  writePlanTree(repo, { tasks: ['001'] });
  const base = commitBaseline(repo);
  fs.mkdirSync(path.join(repo, 'src'), { recursive: true });
  for (const name of ['a', 'b', 'c', 'd']) {
    fs.writeFileSync(path.join(repo, `src/${name}.ts`), `export const ${name} = 1;\n`);
  }
  git(repo, ['add', 'src']);
  git(repo, ['commit', '-qm', 'many files']);
  const head = git(repo, ['rev-parse', 'HEAD']).trim();
  const result = classifyExecuteReview({
    repoRoot: repo, blueprintDir: BP_REL, taskId: '001', base, head,
  });
  assert.strictEqual(result.ok, true);
  assert.strictEqual(result.strategy, 'parallel');
  assert.ok(result.changed_files > EXECUTE_SMALL_MAX_FILES);
  assert.deepStrictEqual(result.perspectives, [
    'spec_scope', 'correctness_tests', 'minimality_maintainability',
  ]);
});

// light scale은 diff 크기와 무관하게 단일 combined. full(또는 scale 미선언)은
// 기존 임계값을 유지한다 — 경로 수·줄 수로 light를 추론하지 않는다.
test('execute with complexity low and a large diff via --blueprint → returns single combined', () => {
  const repo = makeRepo();
  writePlanTree(repo, { complexity: 'low', tasks: ['001'] });
  const base = commitBaseline(repo);
  fs.mkdirSync(path.join(repo, 'src'), { recursive: true });
  for (const name of ['a', 'b', 'c', 'd']) {
    fs.writeFileSync(path.join(repo, `src/${name}.ts`), `export const ${name} = 1;\n`);
  }
  git(repo, ['add', 'src']);
  git(repo, ['commit', '-qm', 'many files light']);
  const head = git(repo, ['rev-parse', 'HEAD']).trim();
  const out = classifyExecuteReview({
    repoRoot: repo, blueprintDir: BP_REL, taskId: '001', base, head,
  });
  assert.strictEqual(out.ok, true);
  assert.ok(out.changed_files > EXECUTE_SMALL_MAX_FILES);
  assert.strictEqual(out.strategy, 'single');
  assert.deepStrictEqual(out.perspectives, ['combined']);

  const cli = capture([
    'review-dispatch', 'execute',
    '--blueprint', BP_REL, '--task', '001', '--base', base, '--head', head,
    '--repo', repo,
  ]);
  assert.strictEqual(cli.code, 0, cli.err);
  const cliJson = JSON.parse(cli.out);
  assert.strictEqual(cliJson.strategy, 'single');
  assert.deepStrictEqual(cliJson.perspectives, ['combined']);
});

test('execute with full scale and a large diff even with --blueprint → stays parallel', () => {
  const repo = makeRepo();
  writePlanTree(repo, { scale: 'full', tasks: ['001'] });
  const base = commitBaseline(repo);
  fs.mkdirSync(path.join(repo, 'src'), { recursive: true });
  for (const name of ['a', 'b', 'c', 'd']) {
    fs.writeFileSync(path.join(repo, `src/${name}.ts`), `export const ${name} = 1;\n`);
  }
  git(repo, ['add', 'src']);
  git(repo, ['commit', '-qm', 'many files full']);
  const head = git(repo, ['rev-parse', 'HEAD']).trim();
  const out = classifyExecuteReview({
    repoRoot: repo, blueprintDir: BP_REL, taskId: '001', base, head,
  });
  assert.strictEqual(out.ok, true);
  assert.strictEqual(out.strategy, 'parallel');
  assert.deepStrictEqual(out.perspectives, [
    'spec_scope', 'correctness_tests', 'minimality_maintainability',
  ]);
});

// CT-002: light는 combined만 쓰지만 non-empty review_risk는 security를 붙인다.
// light large-diff 케이스만 있으면 risk append 분기가 light 경로에서 빠질 수 있다.
test('execute with complexity low and review_risk → yields combined and security', () => {
  const repo = makeRepo();
  writePlanTree(repo, { complexity: 'low', tasks: ['001'] });
  writeCommitTask(repo, '001', { reviewRisk: ['public_interface'] });
  const base = commitBaseline(repo);
  fs.mkdirSync(path.join(repo, 'src'), { recursive: true });
  fs.writeFileSync(path.join(repo, 'src/a.ts'), 'export const a = 1;\n');
  git(repo, ['add', 'src/a.ts']);
  git(repo, ['commit', '-qm', 'light risk']);
  const head = git(repo, ['rev-parse', 'HEAD']).trim();
  const out = classifyExecuteReview({
    repoRoot: repo, blueprintDir: BP_REL, taskId: '001', base, head,
  });
  assert.strictEqual(out.ok, true);
  assert.strictEqual(out.strategy, 'single');
  assert.deepStrictEqual(out.risk_flags, ['public_interface']);
  assert.deepStrictEqual(out.perspectives, ['combined', 'security']);
});

test('execute with risk flags → appends security on single and parallel', () => {
  const repo = makeRepo();
  writePlanTree(repo, { tasks: ['001'] });
  writeCommitTask(repo, '001', { reviewRisk: ['public_interface'] });
  const base = commitBaseline(repo);
  fs.mkdirSync(path.join(repo, 'src'), { recursive: true });
  fs.writeFileSync(path.join(repo, 'src/a.ts'), 'export const a = 1;\n');
  git(repo, ['add', 'src/a.ts']);
  git(repo, ['commit', '-qm', 'small risk']);
  const head = git(repo, ['rev-parse', 'HEAD']).trim();
  const small = classifyExecuteReview({
    repoRoot: repo, blueprintDir: BP_REL, taskId: '001', base, head,
  });
  assert.strictEqual(small.ok, true);
  assert.strictEqual(small.strategy, 'single');
  assert.deepStrictEqual(small.risk_flags, ['public_interface']);
  assert.deepStrictEqual(small.perspectives, ['combined', 'security']);

  // CT-003: 제목이 single·parallel 둘 다인데 parallel+security를 빠뜨리면
  // append 분기가 한쪽만 깨져도 통과한다.
  for (const name of ['a', 'b', 'c', 'd']) {
    fs.writeFileSync(path.join(repo, `src/${name}.ts`), `export const ${name} = 1;\n`);
  }
  git(repo, ['add', 'src']);
  git(repo, ['commit', '-qm', 'many files risk']);
  const parallelHead = git(repo, ['rev-parse', 'HEAD']).trim();
  const parallel = classifyExecuteReview({
    repoRoot: repo, blueprintDir: BP_REL, taskId: '001', base, head: parallelHead,
  });
  assert.strictEqual(parallel.ok, true);
  assert.strictEqual(parallel.strategy, 'parallel');
  assert.deepStrictEqual(parallel.risk_flags, ['public_interface']);
  assert.deepStrictEqual(parallel.perspectives, [
    'spec_scope', 'correctness_tests', 'minimality_maintainability', 'security',
  ]);
});

// parallel+review_risk fixture를 CLI --mode 계약에 재사용한다. delta는 reviewer만
// combined 하나로 접고, discovery 통계·risk_flags는 그대로 둔다.
test('parallel diff와 review_risk에 --mode delta → strategy single, perspectives [combined]', () => {
  const repo = makeRepo();
  writePlanTree(repo, { tasks: ['001'] });
  writeCommitTask(repo, '001', { reviewRisk: ['public_interface'] });
  const base = commitBaseline(repo);
  fs.mkdirSync(path.join(repo, 'src'), { recursive: true });
  for (const name of ['a', 'b', 'c', 'd']) {
    fs.writeFileSync(path.join(repo, `src/${name}.ts`), `export const ${name} = 1;\n`);
  }
  git(repo, ['add', 'src']);
  git(repo, ['commit', '-qm', 'many files risk delta']);
  const head = git(repo, ['rev-parse', 'HEAD']).trim();
  const discovery = capture([
    'review-dispatch', 'execute',
    '--blueprint', BP_REL, '--task', '001', '--base', base, '--head', head,
    '--repo', repo,
  ]);
  assert.strictEqual(discovery.code, 0);
  const d = JSON.parse(discovery.out);
  assert.strictEqual(d.strategy, 'parallel');
  assert.strictEqual(d.agent_dispatch.agent, 'bouncer-reviewer');
  const delta = capture([
    'review-dispatch', 'execute',
    '--blueprint', BP_REL, '--task', '001', '--base', base, '--head', head,
    '--repo', repo, '--mode', 'delta',
  ]);
  assert.strictEqual(delta.code, 0);
  const json = JSON.parse(delta.out);
  assert.strictEqual(json.ok, true);
  assert.strictEqual(json.strategy, 'single');
  assert.deepStrictEqual(json.perspectives, ['combined']);
  assert.deepStrictEqual(json.target, d.target);
  assert.deepStrictEqual(json.changed_files, d.changed_files);
  assert.deepStrictEqual(json.changed_lines, d.changed_lines);
  assert.deepStrictEqual(json.risk_flags, d.risk_flags);
  assert.deepStrictEqual(json.agent_dispatch, d.agent_dispatch);
  assert.strictEqual(json.reasons.length, d.reasons.length + 1);
});

test('task 없는 execute에 --mode delta → usage exit 2이고 stdout JSON이 없음', () => {
  const repo = makeRepo();
  writePlanTree(repo, { tasks: ['001'] });
  writeCommitTask(repo, '001', {});
  const base = commitBaseline(repo);
  const head = git(repo, ['rev-parse', 'HEAD']).trim();
  const run = capture([
    'review-dispatch', 'execute',
    '--blueprint', BP_REL, '--base', base, '--head', head,
    '--repo', repo, '--mode', 'delta',
  ]);
  assert.strictEqual(run.code, 2);
  assert.strictEqual(run.out, '');
  assert.match(run.err, /--task/);
});

// review_contract 표식 fixture. big=true면 임계값을 넘기는 4파일 diff, 아니면 1파일 diff를 커밋한다.
function markedRepo({
  reviewContract = 'brief', unmarked = false, scale = 'full', complexity, risk, big = false, tasks = ['001'], config,
} = {}) {
  const repo = makeRepo();
  if (config) writeConfig(repo, config);
  writePlanTree(repo, { scale, complexity, tasks, reviewContract: unmarked ? undefined : reviewContract });
  if (risk !== undefined) {
    tasks.forEach((n, i) => writeCommitTask(repo, n, { reviewRisk: risk[i] ?? risk[0] }));
  }
  const base = commitBaseline(repo);
  fs.mkdirSync(path.join(repo, 'src'), { recursive: true });
  for (const name of big ? ['a', 'b', 'c', 'd'] : ['a']) {
    fs.writeFileSync(path.join(repo, `src/${name}.ts`), `export const ${name} = 1;\n`);
  }
  git(repo, ['add', 'src']);
  git(repo, ['commit', '-qm', 'change']);
  const head = git(repo, ['rev-parse', 'HEAD']).trim();
  return { repo, base, head };
}

function discover({ repo, base, head }) {
  return classifyExecuteReview({ repoRoot: repo, blueprintDir: BP_REL, base, head });
}

const BRIEF_PERSPECTIVES = ['spec_scope', 'correctness_tests'];

test('review_contract brief with a large diff and public_interface → returns two brief perspectives', () => {
  const out = discover(markedRepo({ big: true, risk: [['public_interface']] }));
  assert.strictEqual(out.ok, true);
  assert.strictEqual(out.strategy, 'parallel');
  assert.deepStrictEqual(out.perspectives, BRIEF_PERSPECTIVES);
  assert.strictEqual(out.reasons[0], 'review_contract brief — brief-compliance perspectives');
  assert.ok(out.reasons[1].endsWith('no security reviewer'), out.reasons[1]);
});

test('review_contract brief with a small diff and no risk → returns the same two perspectives', () => {
  const out = discover(markedRepo({ big: false, risk: [[]] }));
  assert.strictEqual(out.ok, true);
  assert.strictEqual(out.strategy, 'parallel');
  assert.deepStrictEqual(out.perspectives, BRIEF_PERSPECTIVES);
});

test('review_contract brief with public_interface and authentication → appends security last', () => {
  const out = discover(markedRepo({ risk: [['public_interface', 'authentication']] }));
  assert.deepStrictEqual(out.perspectives, [...BRIEF_PERSPECTIVES, 'security']);
  assert.strictEqual(out.reasons[1], 'review_risk public_interface,authentication adds security reviewer');
});

test('review_contract brief with credential or authorization alone → includes security', () => {
  for (const flag of ['credential', 'authorization']) {
    const out = discover(markedRepo({ risk: [[flag]] }));
    assert.deepStrictEqual(out.perspectives, [...BRIEF_PERSPECTIVES, 'security'], flag);
  }
});

test('review_contract brief with security flag in a second task → unions across tasks', () => {
  const out = discover(markedRepo({ tasks: ['001', '002'], risk: [['public_interface'], ['credential']] }));
  assert.deepStrictEqual(out.perspectives, [...BRIEF_PERSPECTIVES, 'security']);
});

test('review_contract brief with a task-scoped review → keeps the legacy perspective rules', () => {
  const fx = markedRepo({ risk: [['public_interface']] });
  const out = classifyExecuteReview({
    repoRoot: fx.repo, blueprintDir: BP_REL, taskId: '001', base: fx.base, head: fx.head,
  });
  assert.deepStrictEqual(out.perspectives, ['combined', 'security']);
});

test('review_contract brief without a task and --mode delta → returns single combined', () => {
  const { repo, base, head } = markedRepo({ big: true, risk: [['public_interface']] });
  const run = capture([
    'review-dispatch', 'execute', '--blueprint', BP_REL, '--base', base, '--head', head,
    '--repo', repo, '--mode', 'delta',
  ]);
  assert.strictEqual(run.code, 0, run.err);
  const json = JSON.parse(run.out);
  assert.strictEqual(json.strategy, 'single');
  assert.deepStrictEqual(json.perspectives, ['combined']);
});

test('review_contract other on a full blueprint → discovery rejects with review-contract-invalid', () => {
  const out = discover(markedRepo({ reviewContract: 'other', scale: 'full' }));
  assert.strictEqual(out.ok, false);
  assert.ok(out.error.startsWith('review-contract-invalid'), out.error);
});

// light는 run 쪽 표식 해석기에서 legacy로 읽힌다. 잘못된 값의 거절은 S38이 맡는다.
test('review_contract other with complexity low → execute discovery rejects review-contract-invalid', () => {
  const out = discover(markedRepo({ reviewContract: 'other', complexity: 'low' }));
  assert.strictEqual(out.ok, false);
  assert.ok(String(out.error).startsWith('review-contract-invalid'), out.error);
});

test('review_contract brief on a low blueprint without a task → execute discovery equals unmarked low', () => {
  const marked = discover(markedRepo({ complexity: 'low' }));
  const unmarked = discover(markedRepo({ unmarked: true, complexity: 'low' }));
  assert.strictEqual(marked.ok, true);
  assert.strictEqual(marked.strategy, unmarked.strategy);
  assert.deepStrictEqual(marked.perspectives, unmarked.perspectives);
  assert.deepStrictEqual(marked.reasons, unmarked.reasons);
  assert.strictEqual(marked.strategy, 'single');
  assert.deepStrictEqual(marked.perspectives, ['combined']);
});

// 사용법 거절은 분류기 모듈을 적재하지 않는다. 테스트 파일이 이미 require했으므로 먼저 캐시에서 지운다.
const REVIEW_DISPATCH_PATH = require.resolve('../packages/cli/dist/review-dispatch');
function captureWithoutClassifier(argv) {
  delete require.cache[REVIEW_DISPATCH_PATH];
  const run = capture(argv);
  const loaded = Object.prototype.hasOwnProperty.call(require.cache, REVIEW_DISPATCH_PATH);
  return { ...run, loaded };
}

test('review_contract other without a task and --mode delta → exit 2 review-contract-invalid, classifier not loaded', () => {
  const { repo, base, head } = markedRepo({ reviewContract: 'other' });
  const run = captureWithoutClassifier([
    'review-dispatch', 'execute', '--blueprint', BP_REL, '--base', base, '--head', head,
    '--repo', repo, '--mode', 'delta',
  ]);
  assert.strictEqual(run.code, 2);
  assert.strictEqual(run.out, '');
  assert.match(run.err, /review-contract-invalid/);
  assert.strictEqual(run.loaded, false);
});

test('unmarked blueprint without a task and --mode delta → exit 2 --task usage, classifier not loaded', () => {
  const { repo, base, head } = markedRepo({ unmarked: true });
  const run = captureWithoutClassifier([
    'review-dispatch', 'execute', '--blueprint', BP_REL, '--base', base, '--head', head,
    '--repo', repo, '--mode', 'delta',
  ]);
  assert.strictEqual(run.code, 2);
  assert.strictEqual(run.out, '');
  assert.match(run.err, /--task/);
  assert.strictEqual(run.loaded, false);
});

test('blueprint without index and no task with --mode delta → exit 2 --task usage, classifier not loaded', () => {
  const repo = makeRepo();
  const base = git(repo, ['rev-parse', 'HEAD']).trim();
  const run = captureWithoutClassifier([
    'review-dispatch', 'execute', '--blueprint', BP_REL, '--base', base, '--head', base,
    '--repo', repo, '--mode', 'delta',
  ]);
  assert.strictEqual(run.code, 2);
  assert.strictEqual(run.out, '');
  assert.match(run.err, /--task/);
  assert.strictEqual(run.loaded, false);
});

test('--mode discovery → --mode 생략과 같은 JSON', () => {
  const repo = makeRepo();
  writePlanTree(repo, { tasks: ['001'] });
  writeCommitTask(repo, '001', { reviewRisk: ['public_interface'] });
  const base = commitBaseline(repo);
  fs.mkdirSync(path.join(repo, 'src'), { recursive: true });
  for (const name of ['a', 'b', 'c', 'd']) {
    fs.writeFileSync(path.join(repo, `src/${name}.ts`), `export const ${name} = 1;\n`);
  }
  git(repo, ['add', 'src']);
  git(repo, ['commit', '-qm', 'many files discovery mode']);
  const head = git(repo, ['rev-parse', 'HEAD']).trim();
  const omitted = capture([
    'review-dispatch', 'execute',
    '--blueprint', BP_REL, '--task', '001', '--base', base, '--head', head,
    '--repo', repo,
  ]);
  const explicit = capture([
    'review-dispatch', 'execute',
    '--blueprint', BP_REL, '--task', '001', '--base', base, '--head', head,
    '--repo', repo, '--mode', 'discovery',
  ]);
  assert.strictEqual(omitted.code, 0);
  assert.strictEqual(explicit.code, 0);
  assert.deepStrictEqual(JSON.parse(explicit.out), JSON.parse(omitted.out));
});

test('--mode bogus → exit 2', () => {
  const repo = makeRepo();
  writePlanTree(repo, { tasks: ['001'] });
  const bad = capture([
    'review-dispatch', 'execute',
    '--blueprint', BP_REL, '--task', '001', '--base', 'HEAD', '--head', 'HEAD',
    '--repo', repo, '--mode', 'bogus',
  ]);
  assert.strictEqual(bad.code, 2);
  assert.strictEqual(bad.out, '');
  assert.match(bad.err, /review-dispatch execute/);
});

test('--mode 값 없음 → exit 2', () => {
  const repo = makeRepo();
  writePlanTree(repo, { tasks: ['001'] });
  const bare = capture([
    'review-dispatch', 'execute',
    '--blueprint', BP_REL, '--task', '001', '--base', 'HEAD', '--head', 'HEAD',
    '--repo', repo, '--mode',
  ]);
  assert.strictEqual(bare.code, 2);
  assert.strictEqual(bare.out, '');
  assert.match(bare.err, /review-dispatch execute/);
});

test('execute with a non-canonical blueprintDir escape → rejects without perspectives', () => {
  // SEC-001: Plan은 validateBlueprint/isCanonicalBlueprintDir로 ../ 를 막지만
  // Execute가 path.join만 하면 repo 밖 tasks.md의 review_risk로 security를 연다.
  const repo = makeRepo();
  writePlanTree(repo, { tasks: ['001'] });
  const outsideRoot = path.join(path.dirname(repo), `${path.basename(repo)}-outside`);
  fs.mkdirSync(path.join(outsideRoot, 'tasks', '001'), { recursive: true });
  writeDoc(outsideRoot, 'tasks/001/tasks.md', {
    type: 'bouncer.tasks',
    title: 'Escaped',
    description: 'd',
    resource: 'tasks/001/tasks.md',
    tags: ['bouncer'],
    timestamp: '2026-07-01T00:00:00+09:00',
    bouncer: {
      id: 'TASKS-001',
      epic_id: '001',
      blueprint_id: '001',
      status: 'ready',
      execution_kind: 'commit',
      affected_paths: ['src/a.ts'],
      depends_on: [],
      parallel_safe: false,
      dependency_gate: 'integrated',
      review_risk: ['authentication'],
    },
  }, taskBody({ interfaceText: '- `x`\n', touchText: '- `src/a.ts`\n' }));
  const escaped = classifyExecuteReview({
    repoRoot: repo,
    blueprintDir: '../' + path.basename(outsideRoot),
    taskId: '001',
    base: 'HEAD',
    head: 'HEAD',
    exec: (file, args) => {
      assert.strictEqual(file, 'git');
      if (args[0] === 'rev-parse') return 'abc\n';
      if (args[0] === 'diff') return '1\t1\tsrc/a.ts\n';
      throw new Error(`unexpected git ${args.join(' ')}`);
    },
  });
  assert.strictEqual(escaped.ok, false);
  assert.ok(!('perspectives' in escaped) || escaped.perspectives === undefined);
  const planSame = classifyPlanReview({
    repoRoot: repo,
    blueprintDir: '../' + path.basename(outsideRoot),
  });
  assert.strictEqual(planSame.ok, false);
});

test('execute with review_risk S30 → rejects without perspectives', () => {
  // CT-001: Execute의 readReviewRisk S30 세 갈래는 Plan structural만으로는 회귀가 안 잡힌다.
  const repo = makeRepo();
  writePlanTree(repo, { tasks: ['001'] });
  const cases = [
    { reviewRisk: 'public_interface', error: /S30 review_risk must be an array/ },
    { reviewRisk: ['mystery'], error: /S30 review_risk value invalid/ },
    { reviewRisk: ['public_interface', 'public_interface'], error: /S30 review_risk duplicate/ },
  ];
  for (const { reviewRisk, error } of cases) {
    writeCommitTask(repo, '001', { reviewRisk });
    const result = classifyExecuteReview({
      repoRoot: repo,
      blueprintDir: BP_REL,
      taskId: '001',
      base: 'HEAD',
      head: 'HEAD',
      exec: (file, args) => {
        assert.strictEqual(file, 'git');
        if (args[0] === 'rev-parse') return 'abc\n';
        if (args[0] === 'diff') return '1\t1\tsrc/a.ts\n';
        throw new Error(`unexpected git ${args.join(' ')}`);
      },
    });
    assert.strictEqual(result.ok, false);
    assert.match(result.error, error);
    assert.ok(!('perspectives' in result) || result.perspectives === undefined);
  }
});

test('execute with a lines-only breach → returns parallel', () => {
  // CT-002: 파일 ≤3이어도 줄 합계 >200이면 parallel. 파일 임계만 보면 분기 한쪽이 빠진다.
  const lines = Array.from({ length: EXECUTE_SMALL_MAX_LINES + 1 }, (_, i) => `// ${i}`).join('\n') + '\n';
  const repo = makeRepo();
  writePlanTree(repo, { tasks: ['001'] });
  const base = commitBaseline(repo);
  fs.mkdirSync(path.join(repo, 'src'), { recursive: true });
  fs.writeFileSync(path.join(repo, 'src/a.ts'), lines);
  fs.writeFileSync(path.join(repo, 'src/b.ts'), 'export const b = 1;\n');
  git(repo, ['add', 'src/a.ts', 'src/b.ts']);
  git(repo, ['commit', '-qm', 'many lines']);
  const head = git(repo, ['rev-parse', 'HEAD']).trim();
  const result = classifyExecuteReview({
    repoRoot: repo, blueprintDir: BP_REL, taskId: '001', base, head,
  });
  assert.strictEqual(result.ok, true);
  assert.ok(result.changed_files <= EXECUTE_SMALL_MAX_FILES);
  assert.ok(result.changed_lines > EXECUTE_SMALL_MAX_LINES);
  assert.strictEqual(result.strategy, 'parallel');
  assert.deepStrictEqual(result.perspectives, [
    'spec_scope', 'correctness_tests', 'minimality_maintainability',
  ]);
});

test('execute with a binary file → counts as file but not lines and does not force parallel', () => {
  const repo = makeRepo();
  writePlanTree(repo, { tasks: ['001'] });
  const base = commitBaseline(repo);
  fs.mkdirSync(path.join(repo, 'assets'), { recursive: true });
  fs.writeFileSync(path.join(repo, 'assets/logo.png'), Buffer.from([0, 1, 2, 255, 0]));
  fs.mkdirSync(path.join(repo, 'src'), { recursive: true });
  fs.writeFileSync(path.join(repo, 'src/a.ts'), 'export const a = 1;\n');
  git(repo, ['add', 'assets', 'src']);
  git(repo, ['commit', '-qm', 'binary']);
  const head = git(repo, ['rev-parse', 'HEAD']).trim();
  const result = classifyExecuteReview({
    repoRoot: repo, blueprintDir: BP_REL, taskId: '001', base, head,
  });
  assert.strictEqual(result.ok, true);
  assert.strictEqual(result.changed_files, 2);
  assert.strictEqual(result.changed_lines, 1);
  assert.strictEqual(result.strategy, 'single');
});

// 미커밋 변경을 세지 않던 결함의 회귀: 커밋 diff만 보면 아래 상태는 changed_lines 0이다.
test('execute with a 500-line uncommitted tracked edit → counts 500 lines and returns parallel', () => {
  const repo = makeRepo();
  writePlanTree(repo, { tasks: ['001'] });
  fs.mkdirSync(path.join(repo, 'src'), { recursive: true });
  fs.writeFileSync(path.join(repo, 'src/a.ts'), '');
  const base = commitBaseline(repo);
  fs.writeFileSync(
    path.join(repo, 'src/a.ts'),
    `${Array.from({ length: 500 }, (_, i) => `export const v${i} = ${i};`).join('\n')}\n`,
  );
  const result = classifyExecuteReview({
    repoRoot: repo, blueprintDir: BP_REL, taskId: '001', base, head: base,
  });
  assert.strictEqual(result.ok, true, JSON.stringify(result));
  assert.strictEqual(result.changed_lines, 500);
  assert.strictEqual(result.changed_files, 1);
  assert.strictEqual(result.strategy, 'parallel');
});

test('execute with untracked files added or edited → snapshot_id changes each time', () => {
  const repo = makeRepo();
  writePlanTree(repo, { tasks: ['001'] });
  const base = commitBaseline(repo);
  const run = () => classifyExecuteReview({
    repoRoot: repo, blueprintDir: BP_REL, taskId: '001', base, head: base,
  });
  const clean = run();
  fs.writeFileSync(path.join(repo, 'new.ts'), 'a\n');
  const added = run();
  fs.writeFileSync(path.join(repo, 'new.ts'), 'b\n');
  const edited = run();
  assert.notStrictEqual(added.target.snapshot_id, clean.target.snapshot_id);
  assert.notStrictEqual(edited.target.snapshot_id, added.target.snapshot_id);
});

test('execute with the same final content but a staged index → snapshot_id differs and lines match', () => {
  const repo = makeRepo();
  writePlanTree(repo, { tasks: ['001'] });
  fs.writeFileSync(path.join(repo, 'a.ts'), 'old\n');
  const base = commitBaseline(repo);
  fs.writeFileSync(path.join(repo, 'a.ts'), 'new\n');
  const run = () => classifyExecuteReview({
    repoRoot: repo, blueprintDir: BP_REL, taskId: '001', base, head: base,
  });
  const unstaged = run();
  git(repo, ['add', 'a.ts']);
  const staged = run();
  assert.strictEqual(staged.changed_lines, unstaged.changed_lines);
  assert.notStrictEqual(staged.target.snapshot_id, unstaged.target.snapshot_id);
});

test('execute with a head that is not the current HEAD → fails with reason cause next', () => {
  const repo = makeRepo();
  writePlanTree(repo, { tasks: ['001'] });
  const base = commitBaseline(repo);
  fs.writeFileSync(path.join(repo, 'later.ts'), 'x\n');
  git(repo, ['add', 'later.ts']);
  git(repo, ['commit', '-qm', 'later']);
  const result = classifyExecuteReview({
    repoRoot: repo, blueprintDir: BP_REL, taskId: '001', base, head: base,
  });
  assert.strictEqual(result.ok, false);
  assert.strictEqual(result.reason, 'head-mismatch');
  assert.ok(result.cause && result.next);
  const cli = capture([
    'review-dispatch', 'execute',
    '--blueprint', BP_REL, '--task', '001', '--base', base, '--head', base, '--repo', repo,
  ]);
  assert.strictEqual(cli.code, 1);
  assert.strictEqual(JSON.parse(cli.out).reason, 'head-mismatch');
});

test('execute classification → routes every git call through the injected exec and never diffs base against head', () => {
  const repo = makeRepo();
  writePlanTree(repo, { tasks: ['001'] });
  const base = commitBaseline(repo);
  fs.writeFileSync(path.join(repo, 'a.ts'), 'a\n');
  git(repo, ['add', 'a.ts']);
  git(repo, ['commit', '-qm', 'a']);
  const head = git(repo, ['rev-parse', 'HEAD']).trim();
  fs.writeFileSync(path.join(repo, 'b.ts'), 'b\n');
  const calls = [];
  const result = classifyExecuteReview({
    repoRoot: repo,
    blueprintDir: BP_REL,
    taskId: '001',
    base,
    head,
    exec: (file, args, options) => {
      calls.push(args);
      return execFileSync(file, args, { ...options, env: gitEnv() });
    },
  });
  assert.strictEqual(result.ok, true, JSON.stringify(result));
  assert.ok(calls.length > 0);
  // 커밋 범위 diff(base head)는 미커밋 변경을 빠뜨리므로 쓰지 않는다.
  assert.ok(!calls.some((args) => args.includes('diff') && args.includes(head)));
  assert.strictEqual(result.changed_files, 2);
});

test('execute with an unknown task and bad ref → fails without perspectives', () => {
  const repo = makeRepo();
  writePlanTree(repo, { tasks: ['001'] });
  const missing = classifyExecuteReview({
    repoRoot: repo, blueprintDir: BP_REL, taskId: '099', base: 'HEAD', head: 'HEAD',
  });
  assert.strictEqual(missing.ok, false);
  assert.ok(!('perspectives' in missing) || missing.perspectives === undefined);

  writeVerificationTask(repo, '002');
  const nonCommit = classifyExecuteReview({
    repoRoot: repo, blueprintDir: BP_REL, taskId: '002', base: 'HEAD', head: 'HEAD',
  });
  assert.strictEqual(nonCommit.ok, false);

  const badRef = classifyExecuteReview({
    repoRoot: repo, blueprintDir: BP_REL, taskId: '001',
    base: 'not-a-real-ref', head: 'also-missing',
  });
  assert.strictEqual(badRef.ok, false);
});

test('CLI review-dispatch plan and execute → emit JSON exit contracts', () => {
  const repo = makeRepo();
  writePlanTree(repo, { scale: 'full', tasks: ['001'] });
  fs.mkdirSync(path.join(repo, '.bouncer'), { recursive: true });
  fs.writeFileSync(path.join(repo, '.bouncer/config.json'), JSON.stringify({
    subagents: {
      provider: 'claude',
      claude: { 'bouncer-context-reviewer': 'claude-plan-model' },
      codex: { 'bouncer-reviewer': 'gpt-execute-model' },
    },
  }));
  const plan = capture([
    'review-dispatch', 'plan', '--blueprint', BP_REL, '--repo', repo,
  ]);
  assert.strictEqual(plan.code, 0);
  assert.strictEqual(plan.err, '');
  const planJson = JSON.parse(plan.out);
  assert.strictEqual(planJson.ok, true);
  assert.strictEqual(planJson.strategy, 'single');
  assert.deepStrictEqual(planJson.agent_dispatch, {
    agent: 'bouncer-context-reviewer', provider: 'claude', model: 'claude-plan-model',
  });
  const firstPlanTarget = planJson.target;
  fs.writeFileSync(path.join(repo, '.bouncer/config.json'), JSON.stringify({
    subagents: { provider: 'codex', codex: { 'bouncer-reviewer': 'gpt-execute-model' } },
  }));

  // CT-004: execute 성공(exit 0 + Execute JSON)과 분류 실패(exit 1 + ok:false)를
  // plan-only·argv exit 2만으로 대체하지 않는다.
  const base = commitBaseline(repo);
  fs.mkdirSync(path.join(repo, 'src'), { recursive: true });
  fs.writeFileSync(path.join(repo, 'src/a.ts'), 'export const a = 1;\n');
  git(repo, ['add', 'src/a.ts']);
  git(repo, ['commit', '-qm', 'cli execute']);
  const head = git(repo, ['rev-parse', 'HEAD']).trim();
  const executeOk = capture([
    'review-dispatch', 'execute',
    '--blueprint', BP_REL, '--task', '001', '--base', base, '--head', head,
    '--repo', repo,
  ]);
  assert.strictEqual(executeOk.code, 0);
  assert.strictEqual(executeOk.err, '');
  const executeJson = JSON.parse(executeOk.out);
  assert.strictEqual(executeJson.ok, true);
  assert.strictEqual(executeJson.phase, 'execute');
  assert.strictEqual(executeJson.strategy, 'single');
  assert.deepStrictEqual(executeJson.perspectives, ['combined']);
  assert.deepStrictEqual(executeJson.agent_dispatch, {
    agent: 'bouncer-reviewer', provider: 'codex', model: 'gpt-execute-model',
  });

  fs.writeFileSync(path.join(repo, '.bouncer/config.json'), JSON.stringify({
    subagents: {
      provider: 'claude',
      claude: { 'bouncer-context-reviewer': 'claude-updated-model' },
      codex: { 'bouncer-reviewer': 'gpt-updated-model' },
    },
  }));
  const updatedPlan = capture([
    'review-dispatch', 'plan', '--blueprint', BP_REL, '--repo', repo,
  ]);
  assert.strictEqual(updatedPlan.code, 0);
  const updatedPlanJson = JSON.parse(updatedPlan.out);
  assert.deepStrictEqual(updatedPlanJson.target, firstPlanTarget);
  assert.deepStrictEqual(updatedPlanJson.parts, planJson.parts);
  assert.deepStrictEqual(updatedPlanJson.follow_up, planJson.follow_up);
  assert.deepStrictEqual(updatedPlanJson.agent_dispatch, {
    agent: 'bouncer-context-reviewer', provider: 'claude', model: 'claude-updated-model',
  });

  const executeFail = capture([
    'review-dispatch', 'execute',
    '--blueprint', BP_REL, '--task', '099', '--base', base, '--head', head,
    '--repo', repo,
  ]);
  assert.strictEqual(executeFail.code, 1);
  const failJson = JSON.parse(executeFail.out);
  assert.strictEqual(failJson.ok, false);
  assert.ok(!('perspectives' in failJson) || failJson.perspectives === undefined);
  assert.ok(!('agent_dispatch' in failJson));

  const usage = capture(['review-dispatch']);
  assert.strictEqual(usage.code, 2);
  assert.match(usage.err, /review-dispatch/);
  assert.strictEqual(usage.out, '');

  const bad = capture([
    'review-dispatch', 'execute', '--blueprint', BP_REL, '--repo', repo,
  ]);
  assert.strictEqual(bad.code, 2);
  assert.match(bad.err, /--task|--base|--head/);
});

test('execute without taskId → classifies the whole blueprint diff and unions review_risk', () => {
  const repo = makeRepo();
  writePlanTree(repo, { tasks: ['001', '002'] });
  writeCommitTask(repo, '001', { reviewRisk: ['public_interface'] });
  writeCommitTask(repo, '002', {
    reviewRisk: ['authentication'],
    dependsOn: ['TASKS-001'],
    interfaceText: '- `sharedFn`\n- `classifyPlanReview`\n',
    touchText: '- `src/shared.ts`\n- `src/b.ts`\n',
  });
  const base = commitBaseline(repo);
  fs.mkdirSync(path.join(repo, 'src'), { recursive: true });
  fs.writeFileSync(path.join(repo, 'src/a.ts'), 'export const a = 1;\n');
  git(repo, ['add', 'src/a.ts']);
  git(repo, ['commit', '-qm', 'blueprint-wide']);
  const head = git(repo, ['rev-parse', 'HEAD']).trim();
  const result = classifyExecuteReview({
    repoRoot: repo, blueprintDir: BP_REL, base, head,
  });
  assert.strictEqual(result.ok, true);
  assert.deepStrictEqual(result.target, {
    base, head, task: null,
    snapshot_id: result.target.snapshot_id,
    snapshot_path: `.bouncer/runtime/review-snapshots/${result.target.snapshot_id}/snapshot.json`,
  });
  assert.deepStrictEqual(result.risk_flags, ['public_interface', 'authentication']);
  assert.strictEqual(result.perspectives.at(-1), 'security');
});

test('blueprint-wide execute with invalid review_risk → rejects without perspectives', () => {
  const repo = makeRepo();
  writePlanTree(repo, { tasks: ['001'] });
  writeCommitTask(repo, '001', { reviewRisk: ['bogus'] });
  const result = classifyExecuteReview({
    repoRoot: repo,
    blueprintDir: BP_REL,
    base: 'HEAD',
    head: 'HEAD',
    exec: (file, args) => {
      assert.strictEqual(file, 'git');
      if (args[0] === 'rev-parse') return 'abc\n';
      if (args[0] === 'diff') return '1\t1\tsrc/a.ts\n';
      throw new Error(`unexpected git ${args.join(' ')}`);
    },
  });
  assert.strictEqual(result.ok, false);
  assert.match(result.error, /S30 review_risk value invalid/);
  assert.ok(!('perspectives' in result) || result.perspectives === undefined);
});

test('CLI plan with a structural failure → exits 1 without reviewer list', () => {
  const repo = makeRepo();
  writeBundleIndex(repo);
  writeDoc(repo, `${EPIC_REL}/index.md`, {
    type: 'bouncer.epic', title: 'Auth', description: 'd', resource: `${EPIC_REL}/index.md`,
    tags: ['bouncer'], timestamp: '2026-07-01T00:00:00+09:00',
    bouncer: { id: '001', epic_id: '001', status: 'approved' },
  }, '# Auth\n');
  writeDoc(repo, `${BP_REL}/index.md`, {
    type: 'bouncer.blueprint', title: 'Login', description: 'd', resource: `${BP_REL}/index.md`,
    tags: ['bouncer'], timestamp: '2026-07-01T00:00:00+09:00',
    bouncer: {
      id: '001', epic_id: '001', blueprint_id: '001', status: 'approved', scale: 'full',
    },
  }, '# Login\n');
  writeCommitTask(repo, '001', { reviewRisk: 'public_interface' });
  const result = capture([
    'review-dispatch', 'plan', '--blueprint', BP_REL, '--repo', repo,
  ]);
  assert.strictEqual(result.code, 1);
  const payload = JSON.parse(result.out);
  assert.strictEqual(payload.ok, false);
  assert.ok(!('perspectives' in payload) || payload.perspectives === undefined);
  assert.ok(payload.failures.some((f) => f.code === 'S30'), result.out);
});

// --- 후속 리뷰 previous 결속(BP 096/001 task 002) ---------------------------------

const planArgs = (repo, extra = []) => [
  'review-dispatch', 'plan', '--blueprint', BP_REL, '--repo', repo, ...extra,
];

/** 분류 결과를 파일로 저장한다. start·--previous 입력으로 쓴다. */
function saveJson(repo, name, value) {
  const file = path.join(repo, name);
  fs.writeFileSync(file, `${JSON.stringify(value)}\n`);
  return file;
}

/** 최초 분류 → start까지 마친 repo와 저장된 최초 payload를 만든다. */
function startedRepo() {
  const repo = makeRepo();
  writePlanTree(repo, { scale: 'full', tasks: ['001'] });
  const first = classifyPlanReview({ repoRoot: repo, blueprintDir: BP_REL });
  assert.strictEqual(first.ok, true);
  const file = saveJson(repo, 'first.json', first);
  const started = capture(['context-review', 'start', '--repo', repo, '--blueprint', BP_REL, '--dispatch', file]);
  assert.strictEqual(started.code, 0, started.out + started.err);
  return { repo, first, file };
}

function runtimeBytes(repo) {
  const out = {};
  const walk = (dir) => {
    for (const ent of fs.readdirSync(dir, { withFileTypes: true })) {
      const abs = path.join(dir, ent.name);
      if (ent.isDirectory()) walk(abs);
      else out[abs] = fs.readFileSync(abs, 'utf8');
    }
  };
  const root = path.join(repo, '.bouncer', 'runtime');
  if (fs.existsSync(root)) walk(root);
  return out;
}

test('start 뒤 previous 없는 후속 분류 → previous-payload-required로 거부하고 cause와 next를 준다', () => {
  const { repo } = startedRepo();
  const followUp = classifyPlanReview({ repoRoot: repo, blueprintDir: BP_REL });
  assert.strictEqual(followUp.ok, false);
  assert.strictEqual(followUp.reason, 'previous-payload-required');
  assert.ok(followUp.cause && followUp.next);
  const cli = capture(planArgs(repo));
  assert.strictEqual(cli.code, 1);
  assert.strictEqual(JSON.parse(cli.out).reason, 'previous-payload-required');
});

test('start로 저장한 payload를 previous로 주면 → 후속 분류가 통과하고 저장 bytes를 바꾸지 않는다', () => {
  const { repo, first } = startedRepo();
  const before = runtimeBytes(repo);
  const followUp = classifyPlanReview({
    repoRoot: repo, blueprintDir: BP_REL, previous: previousPayload(first),
  });
  assert.strictEqual(followUp.ok, true);
  assert.strictEqual(followUp.follow_up, 'partial');
  assert.deepStrictEqual(followUp.changed_documents, []);
  assert.deepStrictEqual(runtimeBytes(repo), before);
});

test('저장 최신 payload와 다른 previous → previous-payload-stale로 거부한다', () => {
  const { repo, first } = startedRepo();
  const altered = { ...previousPayload(first), reasons: ['edited by hand'] };
  const result = classifyPlanReview({ repoRoot: repo, blueprintDir: BP_REL, previous: altered });
  assert.strictEqual(result.ok, false);
  assert.strictEqual(result.reason, 'previous-payload-stale');
  const reduced = classifyPlanReview({
    repoRoot: repo,
    blueprintDir: BP_REL,
    previous: { ok: true, parts: first.parts, scope_parts: first.scope_parts, target: first.target },
  });
  assert.strictEqual(reduced.reason, 'previous-payload-invalid');
});

test('다른 blueprint의 previous → previous-payload-invalid로 거부한다', () => {
  const { repo, first } = startedRepo();
  const foreign = { ...previousPayload(first), blueprint: `${EPIC_REL}/blueprints/002-other` };
  const result = classifyPlanReview({ repoRoot: repo, blueprintDir: BP_REL, previous: foreign });
  assert.strictEqual(result.ok, false);
  assert.strictEqual(result.reason, 'previous-payload-invalid');
  const docs = { ...previousPayload(first), target: { ...first.target, documents: [`${EPIC_REL}/index.md`] } };
  assert.strictEqual(
    classifyPlanReview({ repoRoot: repo, blueprintDir: BP_REL, previous: docs }).reason,
    'previous-payload-invalid',
  );
});

test('restart 뒤 옛 payload를 previous로 주면 → stale이고 새 payload는 통과한다', () => {
  const { repo, first } = startedRepo();
  rewriteTasksGoal(repo, '001', 'Ship a rewritten plan.');
  const second = classifyPlanReview({
    repoRoot: repo, blueprintDir: BP_REL, previous: previousPayload(first),
  });
  assert.strictEqual(second.ok, true);
  const file = saveJson(repo, 'second.json', second);
  const restarted = capture([
    'context-review', 'restart', '--repo', repo, '--blueprint', BP_REL,
    '--dispatch', file, '--reason', 'plan rewritten',
  ]);
  assert.strictEqual(restarted.code, 0, restarted.out + restarted.err);
  const old = classifyPlanReview({ repoRoot: repo, blueprintDir: BP_REL, previous: previousPayload(first) });
  assert.strictEqual(old.reason, 'previous-payload-stale');
  const fresh = classifyPlanReview({ repoRoot: repo, blueprintDir: BP_REL, previous: previousPayload(second) });
  assert.strictEqual(fresh.ok, true);
});

test('cycle 없는 legacy 증거 → previous 없이는 거부하고 digest가 다른 previous는 stale이다', () => {
  const repo = makeRepo();
  writePlanTree(repo, { scale: 'full', tasks: ['001'] });
  const first = classifyPlanReview({ repoRoot: repo, blueprintDir: BP_REL });
  writeDoc(repo, `${BP_REL}/context-review.md`, {
    type: 'bouncer.context_review',
    title: 'Login context review',
    description: 'd',
    resource: `${BP_REL}/context-review.md`,
    tags: ['bouncer', 'context_review'],
    timestamp: '2026-07-01T00:00:00+09:00',
    bouncer: {
      id: 'CTXREVIEW-001', epic_id: '001', blueprint_id: '001', status: 'requested',
      context_review: {
        rounds: [{ round: 1, mode: 'discovery', target: { digest: first.target.digest } }],
        findings: [],
      },
    },
  });
  const required = classifyPlanReview({ repoRoot: repo, blueprintDir: BP_REL });
  assert.strictEqual(required.reason, 'previous-payload-required');
  const ok = classifyPlanReview({ repoRoot: repo, blueprintDir: BP_REL, previous: previousPayload(first) });
  assert.strictEqual(ok.ok, true);
  // 내용과 맞지 않는 digest는 위조라서 invalid다. 무결성이 맞는 다른 digest의 v2 payload만 stale이다.
  const forgedDigest = { ...previousPayload(first), target: { ...first.target, digest: 'f'.repeat(64) } };
  assert.strictEqual(
    classifyPlanReview({ repoRoot: repo, blueprintDir: BP_REL, previous: forgedDigest }).reason,
    'previous-payload-invalid',
  );
  rewriteTasksGoal(repo, '001', 'Ship a rewritten plan.');
  const otherSnapshot = classifyPlanReview({ repoRoot: repo, blueprintDir: BP_REL, previous: previousPayload(first) });
  assert.strictEqual(otherSnapshot.ok, true);
  rewriteTasksGoal(repo, '001', 'Ship a third wording.');
  assert.strictEqual(
    classifyPlanReview({ repoRoot: repo, blueprintDir: BP_REL, previous: previousPayload(otherSnapshot) }).reason,
    'previous-payload-stale',
  );
});

test('깨진 context-review 메타데이터 → 최초 상태로 보지 않고 reviewer 호출 전에 구조 실패로 거부한다', () => {
  const repo = makeRepo();
  writePlanTree(repo, { scale: 'full', tasks: ['001'] });
  fs.writeFileSync(path.join(repo, BP_REL, 'context-review.md'), '---\nbouncer: [unclosed\n---\n# x\n');
  const result = classifyPlanReview({ repoRoot: repo, blueprintDir: BP_REL });
  assert.strictEqual(result.ok, false);
  assert.strictEqual(result.error, 'structural validation failed');
  assert.strictEqual(result.perspectives, undefined);
});

test('--previous를 두 번 주면 → 사용법 오류 exit 2이고 분류하지 않는다', () => {
  const { repo, file } = startedRepo();
  const dup = capture(planArgs(repo, ['--previous', file, '--previous', file]));
  assert.strictEqual(dup.code, 2);
  assert.strictEqual(dup.out, '');
});

test('손상된 previous 파일 → CLI가 cause와 next를 붙여 exit 1로 거부한다', () => {
  const { repo } = startedRepo();
  const bad = path.join(repo, 'bad.json');
  fs.writeFileSync(bad, '{ not json');
  const r = capture(planArgs(repo, ['--previous', bad]));
  assert.strictEqual(r.code, 1);
  const body = JSON.parse(r.out);
  assert.strictEqual(body.reason, 'previous-payload-invalid');
  assert.ok(body.cause && body.next);
});

// --- repair TASKS-003: 표식 증거·공유 읽기 helper ------------------------------------

test('cycle 없이 restart_count 표식만 있는 context-review → 증거로 보고 previous를 요구한다', () => {
  const repo = makeRepo();
  writePlanTree(repo, { scale: 'full', tasks: ['001'] });
  writeDoc(repo, `${BP_REL}/context-review.md`, {
    type: 'bouncer.context_review',
    title: 'Login context review',
    description: 'd',
    resource: `${BP_REL}/context-review.md`,
    tags: ['bouncer', 'context_review'],
    timestamp: '2026-07-01T00:00:00+09:00',
    bouncer: {
      id: 'CTXREVIEW-001', epic_id: '001', blueprint_id: '001', status: 'pending',
      context_review: { findings: [], restart_count: 1 },
    },
  });
  const result = classifyPlanReview({ repoRoot: repo, blueprintDir: BP_REL });
  assert.strictEqual(result.ok, false);
  assert.strictEqual(result.reason, 'previous-payload-required');
});

test('restart 뒤 runtime state를 지워도 → 표식이 증거라 previous를 요구한다', () => {
  const { repo, first } = startedRepo();
  rewriteTasksGoal(repo, '001', 'Ship a rewritten plan.');
  const second = classifyPlanReview({ repoRoot: repo, blueprintDir: BP_REL, previous: previousPayload(first) });
  const file = saveJson(repo, 'second.json', second);
  const restarted = capture([
    'context-review', 'restart', '--repo', repo, '--blueprint', BP_REL, '--dispatch', file, '--reason', 'rewritten',
  ]);
  assert.strictEqual(restarted.code, 0, restarted.out + restarted.err);
  fs.rmSync(path.join(repo, '.bouncer', 'runtime'), { recursive: true });
  const result = classifyPlanReview({ repoRoot: repo, blueprintDir: BP_REL });
  assert.strictEqual(result.reason, 'previous-payload-required');
});

test('변조된 cycle.id의 state → 공유 검증으로 previous-payload-invalid 거부하고 bytes를 바꾸지 않는다', () => {
  const { repo, first } = startedRepo();
  const root = path.join(repo, '.bouncer', 'runtime', 'context-review');
  const statePath = path.join(root, fs.readdirSync(root)[0], 'state.json');
  const state = JSON.parse(fs.readFileSync(statePath, 'utf8'));
  // 파일도 옮겨 참조가 실제로 읽히게 한다: id 형식 검증만이 이 변조를 막는다.
  fs.renameSync(
    path.join(path.dirname(statePath), 'cycles', state.cycle.id),
    path.join(path.dirname(statePath), 'cycles', 'evil'),
  );
  state.cycle.id = 'evil';
  state.cycle.latest_dispatch.path = state.cycle.latest_dispatch.path.replace(/cr-[0-9a-f]{16}/, 'evil');
  fs.writeFileSync(statePath, JSON.stringify(state));
  const before = runtimeBytes(repo);
  const result = classifyPlanReview({ repoRoot: repo, blueprintDir: BP_REL, previous: previousPayload(first) });
  assert.strictEqual(result.reason, 'previous-payload-invalid');
  assert.deepStrictEqual(runtimeBytes(repo), before);
});

// --- v2 snapshot: 구조 분리·내용 diff·관련 문서(BP 096/002 task 001) ----------------

const TASK_001_REL = `${BP_REL}/tasks/001/tasks.md`;

/** tasks.md frontmatter의 bouncer 블록만 고쳐 쓴다. 본문은 그대로 둔다. */
function editTaskBouncer(repo, number, mutate) {
  const abs = path.join(repo, BP_REL, 'tasks', number, 'tasks.md');
  const raw = fs.readFileSync(abs, 'utf8');
  const m = raw.match(/^---\n([\s\S]*?)\n---\n/);
  const data = yaml.load(m[1]);
  mutate(data.bouncer, data);
  fs.writeFileSync(abs, `---\n${yaml.dump(data)}---\n${raw.slice(m[0].length)}`);
}

/** 서로 겹치지 않는 Interface·Touch를 가진 task를 쓴다. cluster 관계를 DAG와 분리해 검사하기 위함. */
function writeSoloTask(repo, number, dependsOn = [], extra = {}) {
  writeCommitTask(repo, number, {
    dependsOn,
    interfaceText: `- \`solo${number}\`\n`,
    touchText: `- \`src/solo${number}.ts\`\n`,
    ...extra,
  });
}

function planOf(repo, previous) {
  const out = classifyPlanReview({
    repoRoot: repo, blueprintDir: BP_REL, ...(previous ? { previous: previousPayload(previous) } : {}),
  });
  assert.strictEqual(out.ok, true, JSON.stringify(out));
  return out;
}

test('plan v2 payload → carries content, structure_parts and the contract field set', () => {
  const repo = makeRepo();
  writePlanTree(repo, { scale: 'full', tasks: ['001'] });
  const out = planOf(repo);
  assert.strictEqual(out.snapshot_version, 2);
  const expected = expectedContent(repo);
  assert.deepStrictEqual(out.documents_content, expected.content);
  assert.deepStrictEqual(out.documents_content[TASK_001_REL].structure, {
    affected_paths: ['src/a.ts', 'src/shared.ts'],
    depends_on: [],
    parallel_safe: false,
    dependency_gate: 'integrated',
    exclusive_resources: [],
    execution_kind: 'commit',
  });
  assert.deepStrictEqual(Object.keys(out.structure_parts).sort(), [...expected.documents].sort());
  assert.deepStrictEqual(out.related_documents, [...expected.documents].sort());
});

test('plan with status, title and timestamp edits only → keeps the digest and target unchanged', () => {
  const repo = makeRepo();
  writePlanTree(repo, { scale: 'full', tasks: ['001'] });
  const before = planOf(repo);
  const abs = path.join(repo, TASK_001_REL);
  const raw = fs.readFileSync(abs, 'utf8')
    .replace('status: ready', 'status: in_progress')
    .replace('title: Task 001', 'title: Renamed task')
    .replace(/timestamp: .*/, 'timestamp: \'2026-08-01T00:00:00+09:00\'');
  fs.writeFileSync(abs, raw);
  const after = planOf(repo, before);
  assert.deepStrictEqual(after.target, before.target);
  assert.strictEqual(after.follow_up, 'partial');
  assert.deepStrictEqual(after.changed_documents, []);
  assert.deepStrictEqual(after.revision_diff, []);
  assert.deepStrictEqual(after.related_documents, []);
});

test('plan with a document boundary shift → changes the digest', () => {
  const { digestPlanContent } = require('../packages/cli/dist/plan-snapshot');
  const doc = (body) => ({ body, structure: {} });
  const joined = digestPlanContent(['a', 'b'], { a: doc('x'), b: doc('yz') });
  const shifted = digestPlanContent(['a', 'b'], { a: doc('xy'), b: doc('z') });
  assert.notStrictEqual(joined, shifted);
});

test('plan with a body whitespace-only edit → is partial and the diff keeps the exact bytes', () => {
  const repo = makeRepo();
  writePlanTree(repo, { scale: 'full', tasks: ['001'] });
  const before = planOf(repo);
  const abs = path.join(repo, TASK_001_REL);
  fs.writeFileSync(abs, fs.readFileSync(abs, 'utf8').replace('Keep scope tight.', 'Keep scope tight. '));
  const after = planOf(repo, before);
  assert.notStrictEqual(after.target.digest, before.target.digest);
  assert.strictEqual(after.follow_up, 'partial');
  assert.deepStrictEqual(after.changed_documents, [TASK_001_REL]);
  const [entry] = after.revision_diff;
  assert.strictEqual(entry.before.body.includes('Keep scope tight.\n'), true);
  assert.strictEqual(entry.after.body.includes('Keep scope tight. \n'), true);
  assert.deepStrictEqual(entry.before.structure, entry.after.structure);
});

for (const [label, mutate] of [
  ['parallel_safe', (b) => { b.parallel_safe = true; }],
  ['exclusive_resources', (b) => { b.exclusive_resources = ['db-migration']; }],
  ['execution_kind', (b) => { b.execution_kind = 'verification'; b.verify = 'node --test'; }],
  ['dependency_gate removed to its default', null],
]) {
  test(`plan with a ${label} structure change → ${mutate ? 'is full with that task changed' : 'stays the same structure'}`, () => {
    const repo = makeRepo();
    writePlanTree(repo, { scale: 'full', tasks: ['001'] });
    const before = planOf(repo);
    if (mutate) {
      editTaskBouncer(repo, '001', mutate);
      // execution_kind를 바꾸면 draft 검사가 Interface 절 등을 따로 요구할 수 있어 gate 통과 여부와 무관하게
      // 구조 digest만 비교한다: 분류기가 실패하면 구조 입력을 직접 계산한다.
      const { computePlanParts } = require('../packages/cli/dist/plan-snapshot');
      const parts = computePlanParts({ repoRoot: repo, blueprintDir: BP_REL });
      assert.notStrictEqual(parts.structure_parts[TASK_001_REL], before.structure_parts[TASK_001_REL]);
      assert.strictEqual(parts.parts[TASK_001_REL], before.parts[TASK_001_REL]);
      if (label !== 'execution_kind') {
        const after = planOf(repo, before);
        assert.strictEqual(after.follow_up, 'full');
        assert.deepStrictEqual(after.changed_documents, [TASK_001_REL]);
      }
    } else {
      // 기본값을 명시한 표기와 생략한 표기는 같은 효과 구조여야 한다.
      editTaskBouncer(repo, '001', (b) => { delete b.dependency_gate; delete b.exclusive_resources; b.depends_on = []; });
      const after = planOf(repo, before);
      assert.deepStrictEqual(after.structure_parts, before.structure_parts);
      assert.strictEqual(after.target.digest, before.target.digest);
      assert.strictEqual(after.follow_up, 'partial');
    }
  });
}

test('plan with affected_paths listed in a different order → keeps the same structure', () => {
  const repo = makeRepo();
  writePlanTree(repo, { scale: 'full', tasks: ['001'] });
  const before = planOf(repo);
  editTaskBouncer(repo, '001', (b) => { b.affected_paths = [...b.affected_paths].reverse(); });
  const after = planOf(repo, before);
  assert.deepStrictEqual(after.structure_parts, before.structure_parts);
  assert.strictEqual(after.follow_up, 'partial');
  assert.deepStrictEqual(after.changed_documents, []);
});

test('plan with a task removed → is full and the diff nulls the missing after side', () => {
  const repo = makeRepo();
  writePlanTree(repo, { scale: 'full', tasks: ['001', '002'] });
  const before = planOf(repo);
  fs.rmSync(path.join(repo, BP_REL, 'tasks', '002'), { recursive: true });
  const after = planOf(repo, before);
  assert.strictEqual(after.follow_up, 'full');
  assert.deepStrictEqual(after.changed_documents, [`${BP_REL}/tasks/002/tasks.md`]);
  const [entry] = after.revision_diff;
  assert.strictEqual(entry.after, null);
  assert.strictEqual(entry.before.body, before.documents_content[entry.file].body);
  assert.deepStrictEqual(after.related_documents, [...after.target.documents].sort());
});

test('plan with a task added → is full and the diff nulls the missing before side', () => {
  const repo = makeRepo();
  writePlanTree(repo, { scale: 'full', tasks: ['001'] });
  const before = planOf(repo);
  writeSoloTask(repo, '002', ['TASKS-001']);
  const after = planOf(repo, before);
  assert.strictEqual(after.follow_up, 'full');
  assert.deepStrictEqual(after.revision_diff.map((d) => [d.file, d.before]), [[`${BP_REL}/tasks/002/tasks.md`, null]]);
});

test('plan with a body edit inside a DAG chain → lists predecessors and successors but not unrelated tasks', () => {
  const repo = makeRepo();
  writePlanTree(repo, { scale: 'full', tasks: ['001'] });
  writeSoloTask(repo, '002', ['TASKS-001']);
  writeSoloTask(repo, '003', ['TASKS-002']);
  writeSoloTask(repo, '004');
  const before = planOf(repo);
  rewriteTasksGoal(repo, '002', 'Chain middle reworded.');
  const after = planOf(repo, before);
  assert.strictEqual(after.follow_up, 'partial');
  assert.deepStrictEqual(after.changed_documents, [`${BP_REL}/tasks/002/tasks.md`]);
  assert.deepStrictEqual(after.related_documents, [
    `${EPIC_REL}/index.md`,
    `${BP_REL}/index.md`,
    `${BP_REL}/tasks/001/tasks.md`,
    `${BP_REL}/tasks/003/tasks.md`,
  ].sort());
});

// Interface 키 공유만으로 cluster가 묶이는 pair(001, 002)와 단독 task(003). depends_on은 모두 비워
// cluster 이웃과 DAG closure를 분리해 검사하고, affected_paths는 건드리지 않아 구조는 유지한다.
function writeSharedKeyPair(repo) {
  writePlanTree(repo, { scale: 'full', tasks: [] });
  writeCommitTask(repo, '001', { interfaceText: '- `sharedKey`\n', touchText: '- `src/one.ts`\n' });
  writeCommitTask(repo, '002', { interfaceText: '- `sharedKey`\n', touchText: '- `src/two.ts`\n' });
  writeSoloTask(repo, '003');
  // cluster 이웃 계산을 보려면 commit task가 여러 개여야 한다(payload strategy는 항상 single).
  writeSoloTask(repo, '004');
}

test('plan with a task that leaves its cluster → still relates the previous cluster neighbour', () => {
  const repo = makeRepo();
  writeSharedKeyPair(repo);
  const before = planOf(repo);
  // 신규 payload는 항상 single이라 cluster는 하나다. 관련 문서 계산은 payload가 아니라 내용의
  // Interface 키 공유로 만든 cluster 이웃을 따로 쓴다.
  assert.strictEqual(before.strategy, 'single');
  assert.strictEqual(before.clusters.length, 1);
  writeCommitTask(repo, '002', { interfaceText: '- `loneKey`\n', touchText: '- `src/two.ts`\n' });
  const after = planOf(repo, before);
  assert.strictEqual(after.follow_up, 'partial');
  assert.deepStrictEqual(after.changed_documents, [`${BP_REL}/tasks/002/tasks.md`]);
  assert.ok(after.related_documents.includes(TASK_001_REL), 'previous cluster neighbour is related');
  assert.ok(!after.related_documents.includes(`${BP_REL}/tasks/003/tasks.md`));
});

test('plan with a task that joins a cluster → relates the current cluster neighbour', () => {
  const repo = makeRepo();
  writeSharedKeyPair(repo);
  const before = planOf(repo);
  writeCommitTask(repo, '003', { interfaceText: '- `sharedKey`\n', touchText: '- `src/solo003.ts`\n' });
  const after = planOf(repo, before);
  assert.strictEqual(after.follow_up, 'partial');
  assert.deepStrictEqual(after.changed_documents, [`${BP_REL}/tasks/003/tasks.md`]);
  assert.ok(after.related_documents.includes(TASK_001_REL));
  assert.ok(after.related_documents.includes(`${BP_REL}/tasks/002/tasks.md`));
});

test('plan with a legacy digest-only previous → is full with the legacy reason and a null before', () => {
  const repo = makeRepo();
  writePlanTree(repo, { scale: 'full', tasks: ['001'] });
  const v2 = planOf(repo);
  const legacy = {
    ok: true, phase: 'plan', strategy: 'single', target: v2.target, parts: v2.parts, scope_parts: v2.scope_parts,
  };
  const out = classifyPlanReview({ repoRoot: repo, blueprintDir: BP_REL, previous: legacy });
  assert.strictEqual(out.ok, true);
  assert.strictEqual(out.follow_up, 'full');
  assert.deepStrictEqual(out.changed_documents, [...v2.target.documents].sort());
  assert.ok(out.revision_diff.every((d) => d.before === null && d.reason === 'legacy-payload-no-content'));
  assert.ok(out.reasons.some((r) => r.startsWith('legacy-payload-no-content')));
});

test('plan with a tampered v2 previous → rejects with previous-payload-invalid', () => {
  const repo = makeRepo();
  writePlanTree(repo, { scale: 'full', tasks: ['001'] });
  const first = planOf(repo);
  const mutations = {
    'body no longer matches parts': (p) => { p.documents_content[TASK_001_REL].body += 'x'; },
    'structure no longer matches structure_parts': (p) => { p.documents_content[TASK_001_REL].structure.parallel_safe = true; },
    'structure is not normalized': (p) => { p.documents_content[TASK_001_REL].structure.affected_paths.reverse(); },
    'digest differs from content': (p) => { p.target.digest = 'a'.repeat(64); },
    'content has an extra document': (p) => { p.documents_content['extra/other.md'] = { body: '', structure: {} }; },
    'content misses a document': (p) => { delete p.documents_content[TASK_001_REL]; },
    'unsupported version': (p) => { p.snapshot_version = 3; },
    'document order is shuffled': (p) => { p.target.documents.reverse(); },
    'follow_up is unknown': (p) => { p.follow_up = 'maybe'; },
    'structure_parts is missing': (p) => { delete p.structure_parts; },
  };
  for (const [label, mutate] of Object.entries(mutations)) {
    const payload = previousPayload(first);
    mutate(payload);
    const out = classifyPlanReview({ repoRoot: repo, blueprintDir: BP_REL, previous: payload });
    assert.strictEqual(out.ok, false, label);
    assert.strictEqual(out.reason, 'previous-payload-invalid', label);
  }
});

test('plan from the CLI with a v2 previous file → prints the delta fields', () => {
  const repo = makeRepo();
  writePlanTree(repo, { scale: 'full', tasks: ['001'] });
  const first = planOf(repo);
  const file = saveJson(repo, 'prev-v2.json', first);
  rewriteTasksGoal(repo, '001', 'CLI delta wording.');
  const run = capture(planArgs(repo, ['--previous', file]));
  assert.strictEqual(run.code, 0, run.out + run.err);
  const out = JSON.parse(run.out);
  assert.strictEqual(out.follow_up, 'partial');
  assert.deepStrictEqual(out.revision_diff.map((d) => d.file), [TASK_001_REL]);
});

test('legacy digest-only previous after a recorded round → the migration review restarts within the limit', () => {
  const repo = makeRepo();
  writePlanTree(repo, { scale: 'full', tasks: ['001'] });
  const v2 = planOf(repo);
  const legacyDigest = 'b'.repeat(64);
  writeDoc(repo, `${BP_REL}/context-review.md`, {
    type: 'bouncer.context_review',
    title: 'Login context review',
    description: 'd',
    resource: `${BP_REL}/context-review.md`,
    tags: ['bouncer', 'context_review'],
    timestamp: '2026-07-01T00:00:00+09:00',
    bouncer: {
      id: 'CTXREVIEW-001', epic_id: '001', blueprint_id: '001', status: 'requested',
      context_review: {
        rounds: [{ round: 1, mode: 'discovery', target: { digest: legacyDigest } }],
        findings: [],
      },
    },
  });
  // 옛 digest를 인증한 기록은 새 snapshot과 digest가 달라 stale이며 새 digest를 승인한 것으로 보지 않는다.
  const legacyPrevious = {
    ok: true, phase: 'plan', strategy: 'single',
    target: { digest: legacyDigest, documents: v2.target.documents },
    parts: v2.parts, scope_parts: v2.scope_parts,
  };
  const migrated = classifyPlanReview({ repoRoot: repo, blueprintDir: BP_REL, previous: legacyPrevious });
  assert.strictEqual(migrated.ok, true, JSON.stringify(migrated));
  assert.strictEqual(migrated.follow_up, 'full');
  const file = saveJson(repo, 'migrated.json', migrated);
  const restarted = capture([
    'context-review', 'restart', '--repo', repo, '--blueprint', BP_REL,
    '--dispatch', file, '--reason', 'v2 snapshot migration',
  ]);
  assert.strictEqual(restarted.code, 0, restarted.out + restarted.err);
  const again = capture([
    'context-review', 'restart', '--repo', repo, '--blueprint', BP_REL,
    '--dispatch', file, '--reason', 'second migration',
  ]);
  assert.strictEqual(again.code, 1, 'the restart limit still applies after a migration');
});

test('review-dispatch --help → Enums에 기록용·보고용 finding status 두 줄 출력', () => {
  const out = capture(['review-dispatch', '--help']).out;
  assert.match(out, /finding status \(record input\): open\|resolved\|accepted/);
  assert.match(out, /finding status \(context-review\.md\): resolved\|accepted/);
});

// --- review-contract-deduplication: index 단일 읽기와 계약별 계산 분리 회귀 ---

// readIndex seam은 파일 I/O만 대체한다. 분류 함수는 그대로 실행한다.
function countingReadIndex(real) {
  const files = [];
  const readIndex = (file) => {
    files.push(file);
    return real(file);
  };
  return { readIndex, files };
}

const readDocForTest = require('../packages/cli/dist/frontmatter').readDoc;

test('plan with a legacy full blueprint → reads the blueprint index exactly once', () => {
  const repo = makeRepo();
  writePlanTree(repo, { scale: 'full', tasks: ['001'] });
  const { readIndex, files } = countingReadIndex(readDocForTest);
  const result = classifyPlanReview({ repoRoot: repo, blueprintDir: BP_REL, deps: { readIndex } });
  assert.strictEqual(result.ok, true);
  assert.deepStrictEqual(files, [path.join(repo, BP_REL, 'index.md')]);
});

test('plan with a brief low blueprint → reads the index once and keeps verifiability', () => {
  const repo = makeRepo();
  writePlanTree(repo, { complexity: 'low', tasks: ['001'], reviewContract: 'brief' });
  const { readIndex, files } = countingReadIndex(readDocForTest);
  const result = classifyPlanReview({ repoRoot: repo, blueprintDir: BP_REL, deps: { readIndex } });
  assert.strictEqual(result.ok, true);
  assert.strictEqual(result.strategy, 'perspectives');
  assert.deepStrictEqual(result.perspectives, ['verifiability']);
  assert.strictEqual(files.length, 1);
});

test('plan with an unmarked blueprint → reads the index once and returns single', () => {
  const repo = makeRepo();
  writePlanTree(repo, { scale: 'full', tasks: ['001'] });
  const { readIndex, files } = countingReadIndex(readDocForTest);
  const result = classifyPlanReview({ repoRoot: repo, blueprintDir: BP_REL, deps: { readIndex } });
  assert.strictEqual(result.strategy, 'single');
  assert.strictEqual(files.length, 1);
});

test('plan with an invalid marker → rejects review-contract-invalid after one index read', () => {
  const repo = makeRepo();
  writePlanTree(repo, { scale: 'full', tasks: ['001'], reviewContract: 'other' });
  const { readIndex, files } = countingReadIndex(readDocForTest);
  const result = classifyPlanReview({ repoRoot: repo, blueprintDir: BP_REL, deps: { readIndex } });
  assert.strictEqual(result.error, 'review-contract-invalid: review_contract must be brief');
  assert.strictEqual(files.length, 1);
});

test('plan with a reader failure on a structurally valid tree → rejects blueprint index unreadable', () => {
  const repo = makeRepo();
  writePlanTree(repo, { scale: 'full', tasks: ['001'] });
  let calls = 0;
  const readIndex = () => {
    calls += 1;
    throw new Error('boom');
  };
  const result = classifyPlanReview({ repoRoot: repo, blueprintDir: BP_REL, deps: { readIndex } });
  assert.deepStrictEqual(result, { ok: false, error: 'blueprint index unreadable: boom' });
  assert.strictEqual(calls, 1);
});

test('plan with a broken index file on disk → structural failure wins over the unreadable error', () => {
  const repo = makeRepo();
  writePlanTree(repo, { scale: 'full', tasks: ['001'] });
  fs.writeFileSync(path.join(repo, BP_REL, 'index.md'), '---\n: : [broken\n---\n');
  const result = classifyPlanReview({ repoRoot: repo, blueprintDir: BP_REL });
  assert.strictEqual(result.ok, false);
  assert.strictEqual(result.error, 'structural validation failed');
});

// 현재 분류 결과 matrix. 기대값은 리뷰 계약 규칙에서 유도한다: brief 관점은 task 없는
// standard 리뷰에만 적용되고, low는 계약과 무관하게 combined 하나이며, delta는 combined로 접는다.
for (const complexity of ['standard', 'low']) {
  for (const contract of ['legacy', 'brief']) {
    for (const scope of ['root', 'task']) {
      for (const mode of ['discovery', 'delta']) {
        if (mode === 'delta' && scope === 'task') continue; // delta는 task 없는 리뷰 전용
        test(`execute ${complexity}/${contract}/${scope}/${mode} with a credential risk → returns the contract's classification`, () => {
          // provider와 등급 매핑을 고정해 등급 근거 줄이 실행 환경 설정에 흔들리지 않게 한다.
          const fx = markedRepo({
            scale: 'full',
            complexity: complexity === 'low' ? 'low' : undefined,
            unmarked: contract === 'legacy', big: true, risk: [['credential']], config: STRONG_CLAUDE,
          });
          const out = classifyExecuteReview({
            repoRoot: fx.repo, blueprintDir: BP_REL, taskId: scope === 'task' ? '001' : undefined,
            base: fx.base, head: fx.head, reviewMode: mode,
          });
          const brief = contract === 'brief' && complexity === 'standard' && scope === 'root';
          assert.strictEqual(out.ok, true);
          assert.strictEqual(out.changed_files, 4);
          assert.deepStrictEqual(out.risk_flags, ['credential']);
          assert.strictEqual(out.target.task, scope === 'task' ? '001' : null);
          if (mode === 'delta') {
            assert.strictEqual(out.strategy, 'single');
            assert.deepStrictEqual(out.perspectives, ['combined']);
            assert.strictEqual(out.reasons.at(-1), 'delta review — single combined reviewer after discovery');
          } else if (brief) {
            assert.strictEqual(out.strategy, 'parallel');
            assert.deepStrictEqual(out.perspectives, ['spec_scope', 'correctness_tests', 'security']);
            assert.deepStrictEqual(out.reasons, [
              'review_contract brief — brief-compliance perspectives',
              'review_risk credential adds security reviewer',
              'reviewer tier strong — review_risk credential',
            ]);
          } else if (complexity === 'low') {
            assert.strictEqual(out.strategy, 'single');
            assert.deepStrictEqual(out.perspectives, ['combined', 'security']);
            assert.deepStrictEqual(out.reasons, [
              'blueprint complexity is low — single combined reviewer regardless of diff size',
              'review_risk credential adds security reviewer',
              'reviewer tier strong — review_risk credential',
            ]);
          } else {
            assert.strictEqual(out.strategy, 'parallel');
            assert.deepStrictEqual(out.perspectives,
              ['spec_scope', 'correctness_tests', 'minimality_maintainability', 'security']);
            assert.strictEqual(out.reasons[0], 'diff exceeds small thresholds (files=4, lines=4)');
          }
        });
      }
    }
  }
}

test('execute with a missing blueprint index → rejects blueprint index unreadable before the marker check', () => {
  const fx = markedRepo({});
  fs.rmSync(path.join(fx.repo, BP_REL, 'index.md'));
  const out = discover(fx);
  assert.strictEqual(out.ok, false);
  assert.ok(out.error.startsWith('blueprint index unreadable:'), out.error);
});

// ---- 리뷰어 등급(reviewer_tier) ----
function writeConfig(repo, cfg) {
  fs.mkdirSync(path.join(repo, '.bouncer'), { recursive: true });
  fs.writeFileSync(path.join(repo, '.bouncer/config.json'), JSON.stringify(cfg));
}

const STRONG_CLAUDE = {
  subagents: { provider: 'claude' },
  model_tiers: { claude: { strong: 'claude-strong-x', standard: 'claude-standard-x' } },
};

function tierPlan(repo) {
  return classifyPlanReview({ repoRoot: repo, blueprintDir: BP_REL });
}

// risk 배열은 task 번호 순서. 지정 없으면 review_risk 필드를 쓰지 않는다.
function tierPlanRepo(tasks, risks = []) {
  const repo = makeRepo();
  writePlanTree(repo, { tasks });
  tasks.forEach((n, i) => {
    if (risks[i] !== undefined) writeCommitTask(repo, n, { reviewRisk: risks[i] });
  });
  return repo;
}

test('plan with two commit tasks and empty review_risk → reviewer_tier standard, not applied', () => {
  const plan = tierPlan(tierPlanRepo(['001', '002'], [[], []]));
  assert.strictEqual(plan.reviewer_tier, 'standard');
  assert.strictEqual(plan.reviewer_tier_applied, false);
  assert.ok(plan.reasons.some((r) => r.startsWith('reviewer tier standard')), plan.reasons.join('|'));
});

test('plan with three commit tasks → reviewer_tier strong', () => {
  const plan = tierPlan(tierPlanRepo(['001', '002', '003']));
  assert.strictEqual(plan.reviewer_tier, 'strong');
});

test('plan with one commit task and public_interface review_risk → reviewer_tier strong', () => {
  const plan = tierPlan(tierPlanRepo(['001'], [['public_interface']]));
  assert.strictEqual(plan.reviewer_tier, 'strong');
});

test('plan with review_contract brief perspectives → carries the tier fields too', () => {
  const repo = makeRepo();
  writePlanTree(repo, { tasks: ['001'], reviewContract: 'brief' });
  const plan = tierPlan(repo);
  assert.strictEqual(plan.strategy, 'perspectives');
  assert.strictEqual(plan.reviewer_tier, 'standard');
  assert.strictEqual(plan.reviewer_tier_applied, false);
});

test('plan with a malformed review_risk on one task → returns the union failure unchanged', () => {
  const repo = tierPlanRepo(['001'], [['bogus']]);
  const plan = tierPlan(repo);
  assert.strictEqual(plan.ok, false);
  assert.strictEqual(plan.reviewer_tier, undefined);
  // 실패 사유가 S30이어야 한다: 다른 이유의 plan 실패로는 이 사례가 통과하지 못하게 한다.
  assert.ok(plan.failures.some((f) => f.code === 'S30'), JSON.stringify(plan.failures));
});

test('plan with strong tier and model_tiers.claude.strong → agent_dispatch.model is the mapped slug', () => {
  const repo = tierPlanRepo(['001', '002', '003']);
  writeConfig(repo, STRONG_CLAUDE);
  const plan = tierPlan(repo);
  assert.strictEqual(plan.reviewer_tier, 'strong');
  assert.strictEqual(plan.reviewer_tier_applied, true);
  assert.deepStrictEqual(plan.agent_dispatch, {
    agent: 'bouncer-context-reviewer', provider: 'claude', model: 'claude-strong-x',
  });
});

test('plan with strong tier mapped to inherit → keeps the slot dispatch with a tier-inherit reason', () => {
  const repo = tierPlanRepo(['001', '002', '003']);
  writeConfig(repo, {
    subagents: { provider: 'claude', claude: { 'bouncer-context-reviewer': 'slot-model' } },
    model_tiers: { claude: { strong: 'inherit' } },
  });
  const plan = tierPlan(repo);
  assert.strictEqual(plan.reviewer_tier, 'strong');
  assert.strictEqual(plan.reviewer_tier_applied, false);
  assert.deepStrictEqual(plan.agent_dispatch, {
    agent: 'bouncer-context-reviewer', provider: 'claude', model: 'slot-model',
  });
  assert.ok(plan.reasons.includes(
    'reviewer tier strong not applied: tier-inherit (fix: model_tiers.claude.strong)',
  ), plan.reasons.join('|'));
});

test('plan with strong tier mapped to inherit and no slot → keeps the null model dispatch with the reason', () => {
  const repo = tierPlanRepo(['001', '002', '003']);
  writeConfig(repo, {
    subagents: { provider: 'claude' },
    model_tiers: { claude: { strong: 'inherit' } },
  });
  const plan = tierPlan(repo);
  assert.strictEqual(plan.reviewer_tier_applied, false);
  assert.deepStrictEqual(plan.agent_dispatch, {
    agent: 'bouncer-context-reviewer', provider: 'claude', model: null,
  });
  assert.ok(plan.reasons.includes(
    'reviewer tier strong not applied: tier-inherit (fix: model_tiers.claude.strong)',
  ), plan.reasons.join('|'));
});

test('plan with strong tier and no strong mapping → keeps the old agent_dispatch with a not-applied reason', () => {
  const repo = tierPlanRepo(['001', '002', '003']);
  writeConfig(repo, {
    subagents: { provider: 'claude', claude: { 'bouncer-context-reviewer': 'slot-model' } },
  });
  const plan = tierPlan(repo);
  assert.strictEqual(plan.reviewer_tier, 'strong');
  assert.strictEqual(plan.reviewer_tier_applied, false);
  assert.deepStrictEqual(plan.agent_dispatch, {
    agent: 'bouncer-context-reviewer', provider: 'claude', model: 'slot-model',
  });
  assert.ok(plan.reasons.includes(
    'reviewer tier strong not applied: tier-unmapped (fix: model_tiers.claude.strong)',
  ), plan.reasons.join('|'));
});

test('plan with standard tier and a standard mapping → agent_dispatch stays the old value', () => {
  const repo = tierPlanRepo(['001'], [[]]);
  writeConfig(repo, {
    subagents: { provider: 'claude' },
    model_tiers: { claude: { standard: 'claude-standard-x' } },
    roles: { 'bouncer-context-reviewer': { tier: 'light' } },
  });
  const plan = tierPlan(repo);
  assert.strictEqual(plan.reviewer_tier, 'standard');
  assert.strictEqual(plan.reviewer_tier_applied, false);
  assert.deepStrictEqual(plan.agent_dispatch, {
    agent: 'bouncer-context-reviewer', provider: 'claude', model: null,
  });
});

test('plan with no model_tiers → agent_dispatch equals the slot-only resolution', () => {
  const repo = tierPlanRepo(['001', '002', '003']);
  writeConfig(repo, {
    subagents: { provider: 'claude', claude: { 'bouncer-context-reviewer': 'slot-model' } },
  });
  assert.deepStrictEqual(tierPlan(repo).agent_dispatch, {
    agent: 'bouncer-context-reviewer', provider: 'claude', model: 'slot-model',
  });
});

test('plan with strong tier and an unknown provider → not applied with a not-applied reason', () => {
  const repo = tierPlanRepo(['001', '002', '003']);
  writeConfig(repo, { model_tiers: { claude: { strong: 'claude-strong-x' } } });
  const saved = {};
  const keys = ['CLAUDE_PLUGIN_ROOT', 'PLUGIN_ROOT', 'CLAUDECODE', 'CODEX_THREAD_ID'];
  for (const k of keys) { saved[k] = process.env[k]; delete process.env[k]; }
  let plan;
  try {
    plan = tierPlan(repo);
  } finally {
    for (const k of keys) if (saved[k] !== undefined) process.env[k] = saved[k];
  }
  assert.strictEqual(plan.reviewer_tier, 'strong');
  assert.strictEqual(plan.reviewer_tier_applied, false);
  assert.ok(plan.reasons.some((r) => r.includes('not applied')), plan.reasons.join('|'));
});

test('plan with min_reviewer_tier strong and a small plan → reviewer_tier strong', () => {
  const repo = tierPlanRepo(['001'], [[]]);
  writeConfig(repo, { review: { min_reviewer_tier: 'strong' } });
  assert.strictEqual(tierPlan(repo).reviewer_tier, 'strong');
});

test('plan with min_reviewer_tier standard → has no effect on a strong calculation', () => {
  const repo = tierPlanRepo(['001'], [['public_interface']]);
  writeConfig(repo, { review: { min_reviewer_tier: 'standard' } });
  assert.strictEqual(tierPlan(repo).reviewer_tier, 'strong');
  const small = tierPlanRepo(['001'], [[]]);
  writeConfig(small, { review: { min_reviewer_tier: 'standard' } });
  assert.strictEqual(tierPlan(small).reviewer_tier, 'standard');
});

test('plan with an invalid min_reviewer_tier → rejects with review-min-reviewer-tier-invalid', () => {
  for (const bad of ['light', 'strng', 3, null, ['strong']]) {
    const repo = tierPlanRepo(['001'], [[]]);
    writeConfig(repo, { review: { min_reviewer_tier: bad } });
    assert.deepStrictEqual(tierPlan(repo), {
      ok: false, error: 'review config invalid',
      reason: 'review-min-reviewer-tier-invalid', next: 'review.min_reviewer_tier',
    }, JSON.stringify(bad));
  }
});

// execute: task 범위 fixture와 blueprint 범위 fixture
function tierExecute({ tasks, risks, taskId, mode, cfg }) {
  const repo = makeRepo();
  writePlanTree(repo, { tasks });
  tasks.forEach((n, i) => {
    if (risks && risks[i] !== undefined) writeCommitTask(repo, n, { reviewRisk: risks[i] });
  });
  if (cfg) writeConfig(repo, cfg);
  const base = commitBaseline(repo);
  fs.mkdirSync(path.join(repo, 'src'), { recursive: true });
  fs.writeFileSync(path.join(repo, 'src/a.ts'), 'export const a = 1;\n');
  git(repo, ['add', 'src']);
  git(repo, ['commit', '-qm', 'change']);
  const head = git(repo, ['rev-parse', 'HEAD']).trim();
  return classifyExecuteReview({
    repoRoot: repo, blueprintDir: BP_REL, taskId, base, head, reviewMode: mode,
  });
}

test('execute task scope with empty review_risk → reviewer_tier standard even among many tasks', () => {
  const out = tierExecute({ tasks: ['001', '002', '003'], risks: [[], [], []], taskId: '001' });
  assert.strictEqual(out.reviewer_tier, 'standard');
  assert.strictEqual(out.reviewer_tier_applied, false);
});

test('execute task scope with authentication review_risk → reviewer_tier strong', () => {
  const out = tierExecute({ tasks: ['001'], risks: [['authentication']], taskId: '001' });
  assert.strictEqual(out.reviewer_tier, 'strong');
});

test('execute blueprint scope with three commit tasks and empty review_risk → reviewer_tier strong', () => {
  const out = tierExecute({ tasks: ['001', '002', '003'], risks: [[], [], []] });
  assert.strictEqual(out.reviewer_tier, 'strong');
});

test('execute blueprint scope with two commit tasks and empty review_risk → reviewer_tier standard', () => {
  const out = tierExecute({ tasks: ['001', '002'], risks: [[], []] });
  assert.strictEqual(out.reviewer_tier, 'standard');
});

test('execute delta path with strong tier → carries both fields and applies the mapping', () => {
  const out = tierExecute({
    tasks: ['001'], risks: [['public_interface']], taskId: '001', mode: 'delta', cfg: STRONG_CLAUDE,
  });
  assert.strictEqual(out.ok, true);
  assert.strictEqual(out.reviewer_tier, 'strong');
  assert.strictEqual(out.reviewer_tier_applied, true);
  assert.deepStrictEqual(out.agent_dispatch, {
    agent: 'bouncer-reviewer', provider: 'claude', model: 'claude-strong-x',
  });
  assert.ok(out.reasons.some((r) => r.startsWith('reviewer tier strong')));
});

test('execute with strong tier and no strong mapping → keeps agent_dispatch and adds the not-applied reason', () => {
  const out = tierExecute({
    tasks: ['001'], risks: [['public_interface']], taskId: '001',
    cfg: { subagents: { provider: 'claude', claude: { 'bouncer-reviewer': 'slot-model' } } },
  });
  assert.strictEqual(out.reviewer_tier_applied, false);
  assert.deepStrictEqual(out.agent_dispatch, {
    agent: 'bouncer-reviewer', provider: 'claude', model: 'slot-model',
  });
  assert.ok(out.reasons.includes(
    'reviewer tier strong not applied: tier-unmapped (fix: model_tiers.claude.strong)',
  ), out.reasons.join('|'));
});

test('execute with codex strong tier mapped to inherit → keeps the codex slot and adds the tier-inherit reason', () => {
  const out = tierExecute({
    tasks: ['001'], risks: [['public_interface']], taskId: '001',
    cfg: {
      subagents: { provider: 'codex', codex: { 'bouncer-reviewer': 'codex-slot-x' } },
      model_tiers: { codex: { strong: 'inherit' } },
    },
  });
  assert.strictEqual(out.reviewer_tier, 'strong');
  assert.strictEqual(out.reviewer_tier_applied, false);
  assert.deepStrictEqual(out.agent_dispatch, {
    agent: 'bouncer-reviewer', provider: 'codex', model: 'codex-slot-x',
  });
  assert.ok(out.reasons.includes(
    'reviewer tier strong not applied: tier-inherit (fix: model_tiers.codex.strong)',
  ), out.reasons.join('|'));
});

test('execute with min_reviewer_tier light → rejects with review-min-reviewer-tier-invalid', () => {
  const out = tierExecute({
    tasks: ['001'], risks: [[]], taskId: '001', cfg: { review: { min_reviewer_tier: 'light' } },
  });
  assert.deepStrictEqual(out, {
    ok: false, error: 'review config invalid',
    reason: 'review-min-reviewer-tier-invalid', next: 'review.min_reviewer_tier',
  });
});

test('execute with min_reviewer_tier strong → raises a small task to strong', () => {
  const out = tierExecute({
    tasks: ['001'], risks: [[]], taskId: '001', cfg: { review: { min_reviewer_tier: 'strong' } },
  });
  assert.strictEqual(out.reviewer_tier, 'strong');
});

function largeDiff(repo) {
  const base = commitBaseline(repo);
  fs.mkdirSync(path.join(repo, 'src'), { recursive: true });
  for (const name of ['a', 'b', 'c', 'd']) {
    fs.writeFileSync(path.join(repo, `src/${name}.ts`), `export const ${name} = 1;\n`);
  }
  git(repo, ['add', 'src']);
  git(repo, ['commit', '-qm', 'large']);
  return { base, head: git(repo, ['rev-parse', 'HEAD']).trim() };
}

test('execute large diff with complexity low → single combined; standard stays parallel', () => {
  const lowRepo = makeRepo();
  writePlanTree(lowRepo, { complexity: 'low', tasks: ['001'] });
  const lowDiff = largeDiff(lowRepo);
  const low = classifyExecuteReview({
    repoRoot: lowRepo, blueprintDir: BP_REL, taskId: '001', base: lowDiff.base, head: lowDiff.head,
  });
  assert.deepStrictEqual([low.strategy, low.perspectives], ['single', ['combined']]);
  assert.ok(low.reasons.some((r) => r.includes('blueprint complexity is low')), low.reasons.join('|'));
  const stdRepo = makeRepo();
  writePlanTree(stdRepo, { tasks: ['001'] });
  const stdDiff = largeDiff(stdRepo);
  const standard = classifyExecuteReview({
    repoRoot: stdRepo, blueprintDir: BP_REL, taskId: '001', base: stdDiff.base, head: stdDiff.head,
  });
  assert.strictEqual(standard.strategy, 'parallel');
});

test('plan three empty-risk tasks → low is standard tier and standard is strong', () => {
  const lowRepo = makeRepo();
  writePlanTree(lowRepo, { complexity: 'low', tasks: ['001', '002', '003'], reviewContract: 'brief' });
  ['001', '002', '003'].forEach((n) => writeCommitTask(lowRepo, n, { reviewRisk: [] }));
  const low = classifyPlanReview({ repoRoot: lowRepo, blueprintDir: BP_REL });
  assert.strictEqual(low.reviewer_tier, 'standard');
  assert.deepStrictEqual(low.perspectives, ['verifiability']);
  assert.ok(low.reasons.some((r) => r.includes('complexity low (no task-count threshold)')), low.reasons.join('|'));
  const stdRepo = makeRepo();
  writePlanTree(stdRepo, { tasks: ['001', '002', '003'], reviewContract: 'brief' });
  const standard = classifyPlanReview({ repoRoot: stdRepo, blueprintDir: BP_REL });
  assert.strictEqual(standard.reviewer_tier, 'strong');
  assert.deepStrictEqual(standard.perspectives, PLAN_PERSPECTIVES);
});

test('plan low with credential review_risk → verifiability and risk_security and strong', () => {
  const repo = makeRepo();
  writePlanTree(repo, { complexity: 'low', tasks: ['001'], reviewContract: 'brief' });
  writeCommitTask(repo, '001', { reviewRisk: ['credential'] });
  const plan = classifyPlanReview({ repoRoot: repo, blueprintDir: BP_REL });
  assert.deepStrictEqual(plan.perspectives, ['verifiability', 'risk_security']);
  assert.strictEqual(plan.reviewer_tier, 'strong');
});

test('execute low with credential and a large diff → single combined+security on task and root; delta drops security', () => {
  const repo = makeRepo();
  writePlanTree(repo, { complexity: 'low', tasks: ['001'] });
  writeCommitTask(repo, '001', { reviewRisk: ['credential'] });
  writeConfig(repo, STRONG_CLAUDE);
  const { base, head } = largeDiff(repo);
  for (const taskId of ['001', undefined]) {
    const out = classifyExecuteReview({ repoRoot: repo, blueprintDir: BP_REL, taskId, base, head });
    assert.deepStrictEqual(
      [out.strategy, out.perspectives, out.reviewer_tier],
      ['single', ['combined', 'security'], 'strong'],
    );
    assert.ok(out.reasons.some((r) => r.includes('review_risk credential adds security reviewer')), out.reasons.join('|'));
  }
  const delta = classifyExecuteReview({
    repoRoot: repo, blueprintDir: BP_REL, taskId: '001', base, head, reviewMode: 'delta',
  });
  assert.strictEqual(delta.strategy, 'single');
  assert.deepStrictEqual(delta.perspectives, ['combined']);
});

test('plan with complexity medium → structural validation failed; execute names invalid complexity', () => {
  const repo = makeRepo();
  writePlanTree(repo, { complexity: 'medium', tasks: ['001'], reviewContract: 'brief' });
  const plan = classifyPlanReview({ repoRoot: repo, blueprintDir: BP_REL });
  assert.strictEqual(plan.ok, false);
  assert.strictEqual(plan.error, 'structural validation failed');
  assert.ok(plan.failures.some((f) => f.code === 'S20'), JSON.stringify(plan.failures));
  const { base, head } = largeDiff(repo);
  const exe = classifyExecuteReview({
    repoRoot: repo, blueprintDir: BP_REL, taskId: '001', base, head,
  });
  assert.deepStrictEqual(exe, { ok: false, error: 'blueprint complexity invalid: expected low or standard' });
});
