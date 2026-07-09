'use strict';
const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { checkGate, parseTasksSections, extractPathCandidates, validateBlueprint } = require('../scripts/lib/validate');

const rels = {
  epicIndex: 'context/epics/EPIC-001-auth/index.md',
  blueprintIndex: 'context/epics/EPIC-001-auth/blueprints/BP-001-login/index.md',
  tasks: 'context/epics/EPIC-001-auth/blueprints/BP-001-login/tasks.md',
  verification: 'context/epics/EPIC-001-auth/blueprints/BP-001-login/verification.md',
  review: 'context/epics/EPIC-001-auth/blueprints/BP-001-login/review.md',
  distill: 'context/epics/EPIC-001-auth/blueprints/BP-001-login/distill.md',
};

const READY_BODY = `# Tasks

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

function doc(status, extra = {}, body) {
  const d = { data: { sdd: { status, ...extra } }, rel: 'x' };
  if (body !== undefined) d.body = body;
  return d;
}

test('parseTasksSections reads English headings', () => {
  const s = parseTasksSections(READY_BODY);
  assert.ok(s.goal.includes('Ship login'));
  assert.ok(s.interface.includes('validateLogin'));
  assert.ok(s.touch.includes('src/auth/'));
  assert.ok(s.doNotTouch.includes('src/payments/'));
  assert.ok(s.checklist.includes('implement validateLogin'));
});

test('parseTasksSections accepts Korean aliases', () => {
  const body = `## 목적·의도\nwhy\n\n## 인터페이스\napi\n\n## 수정할 부분\n\`src/x.js\`\n\n## 절대 수정 금지\n\`src/y.js\`\n\n## 체크리스트\n- [ ] a\n`;
  const s = parseTasksSections(body);
  assert.strictEqual(s.goal, 'why');
  assert.strictEqual(s.interface, 'api');
  assert.ok(s.touch.includes('src/x.js'));
  assert.ok(s.doNotTouch.includes('src/y.js'));
  assert.ok(s.checklist.includes('- [ ] a'));
});

test('extractPathCandidates finds backtick and bare paths', () => {
  const paths = extractPathCandidates('- `src/auth/login.js`\n- test/auth/login.test.js\n');
  assert.ok(paths.includes('src/auth/login.js'));
  assert.ok(paths.includes('test/auth/login.test.js'));
});

test('plan gate passes when all conditions met including G10–G12', () => {
  const docs = {
    epicIndex: doc('approved'),
    blueprintIndex: doc('approved'),
    tasks: doc('ready', {
      graph: { suggested_paths: ['src/'] },
      affected_paths: ['src/auth/login.js', 'test/auth/login.test.js'],
    }, READY_BODY),
  };
  const failures = [];
  checkGate('plan', docs, rels, failures);
  assert.deepStrictEqual(failures, []);
});

test('plan gate flags G3 and G4 and G5', () => {
  const docs = {
    epicIndex: doc('approved'),
    blueprintIndex: doc('approved'),
    tasks: doc('draft', { affected_paths: [] }, READY_BODY),
  };
  const failures = [];
  checkGate('plan', docs, rels, failures);
  const codes = failures.map((f) => f.code);
  assert.ok(codes.includes('G3'));
  assert.ok(codes.includes('G4'));
  assert.ok(codes.includes('G5'));
});

test('plan gate G10 fails when a section is missing', () => {
  const body = `# Tasks\n\n## Goal & intent\nx\n\n## Interface\ny\n\n## Touch\n\`src/\`\n\n## Checklist\n- [ ] a\n`;
  const docs = {
    epicIndex: doc('approved'),
    blueprintIndex: doc('approved'),
    tasks: doc('ready', {
      graph: { suggested_paths: ['src/'] },
      affected_paths: ['src/a.js'],
    }, body),
  };
  const failures = [];
  checkGate('plan', docs, rels, failures);
  assert.ok(failures.some((f) => f.code === 'G10'));
});

test('plan gate G11 fails when affected_paths not justified by Touch', () => {
  const docs = {
    epicIndex: doc('approved'),
    blueprintIndex: doc('approved'),
    tasks: doc('ready', {
      graph: { suggested_paths: ['src/'] },
      affected_paths: ['src/auth/login.js', 'src/unrelated/x.js'],
    }, READY_BODY),
  };
  const failures = [];
  checkGate('plan', docs, rels, failures);
  assert.ok(failures.some((f) => f.code === 'G11'));
});

test('plan gate G12 fails when do-not-touch intersects affected_paths', () => {
  const body = `# Tasks

## Goal & intent
x

## Interface
y

## Touch
- \`src/auth/\`

## Do not touch
- \`src/auth/login.js\`

## Checklist
- [ ] a
`;
  const docs = {
    epicIndex: doc('approved'),
    blueprintIndex: doc('approved'),
    tasks: doc('ready', {
      graph: { suggested_paths: ['src/'] },
      affected_paths: ['src/auth/login.js'],
    }, body),
  };
  const failures = [];
  checkGate('plan', docs, rels, failures);
  assert.ok(failures.some((f) => f.code === 'G12'));
});

test('execute gate: review optional satisfies G8', () => {
  const docs = {
    tasks: doc('verified'),
    verification: doc('passed'),
    review: doc('pending', { review: { required: false, reason: 'docs-only' } }),
  };
  const failures = [];
  checkGate('execute', docs, rels, failures);
  assert.deepStrictEqual(failures, []);
});

test('finalize gate requires distill published', () => {
  const failures = [];
  checkGate('finalize', { distill: doc('draft') }, rels, failures);
  assert.deepStrictEqual(failures.map((f) => f.code), ['G9']);
});

const BP_REL = 'context/epics/EPIC-001-auth/blueprints/BP-001-login';

function mkRepo() {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'sdd-gates-'));
}

function writeDoc(repo, rel, data, body = '# x\n') {
  const yaml = require('js-yaml');
  const abs = path.join(repo, rel);
  fs.mkdirSync(path.dirname(abs), { recursive: true });
  fs.writeFileSync(abs, `---\n${yaml.dump(data)}---\n${body}`);
}

function epicDoc() {
  return {
    type: 'sdd.epic',
    title: 'Auth epic',
    description: 'EPIC-001',
    resource: 'context/epics/EPIC-001-auth/index.md',
    tags: ['sdd', 'epic'],
    timestamp: '2026-07-01T00:00:00+09:00',
    sdd: { id: 'EPIC-001', epic_id: 'EPIC-001', status: 'approved' },
  };
}

function blueprintDoc() {
  return {
    type: 'sdd.blueprint',
    title: 'Login blueprint',
    description: 'BP-001',
    resource: `${BP_REL}/index.md`,
    tags: ['sdd', 'blueprint'],
    timestamp: '2026-07-01T00:00:00+09:00',
    sdd: { id: 'BP-001', epic_id: 'EPIC-001', blueprint_id: 'BP-001', status: 'approved' },
  };
}

function planReadyTasksBody() {
  return `# Tasks

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
}

function planReadyTasks() {
  return {
    type: 'sdd.tasks',
    title: 'Login tasks',
    description: 'Tasks for BP-001',
    resource: `${BP_REL}/tasks.md`,
    tags: ['sdd', 'tasks'],
    timestamp: '2026-07-01T00:00:00+09:00',
    sdd: {
      id: 'TASKS-BP-001',
      epic_id: 'EPIC-001',
      blueprint_id: 'BP-001',
      status: 'ready',
      graph: { suggested_paths: ['src/'] },
      affected_paths: ['./src/auth/login.js', './test/auth/login.test.js'],
    },
  };
}

function writePlanBlueprint(repo, tasksBody) {
  writeDoc(repo, 'context/epics/EPIC-001-auth/index.md', epicDoc());
  writeDoc(repo, `${BP_REL}/index.md`, blueprintDoc());
  writeDoc(repo, `${BP_REL}/tasks.md`, planReadyTasks(), tasksBody);
}

test('validateBlueprint plan gate loads tasks body from disk for G10–G12 pass', () => {
  const repo = mkRepo();
  writePlanBlueprint(repo, planReadyTasksBody());
  const res = validateBlueprint({ repoRoot: repo, blueprintDir: BP_REL, gate: 'plan' });
  assert.deepStrictEqual(res, { ok: true, failures: [] });
});

test('validateBlueprint plan gate G10 fails via file-loaded body when section missing', () => {
  const repo = mkRepo();
  const body = `# Tasks

## Goal & intent
x

## Interface
y

## Touch
\`src/\`

## Checklist
- [ ] a
`;
  writePlanBlueprint(repo, body);
  const res = validateBlueprint({ repoRoot: repo, blueprintDir: BP_REL, gate: 'plan' });
  assert.strictEqual(res.ok, false);
  assert.ok(res.failures.some((f) => f.code === 'G10'));
});
