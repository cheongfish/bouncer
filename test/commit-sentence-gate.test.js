'use strict';
const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const yaml = require('js-yaml');
const { validateBlueprint } = require('../scripts/lib/validate');
const { ensureEpicIndexEntry } = require('../scripts/lib/epic-index');

const BP_REL = '.bouncer/context/epics/001-auth/blueprints/001-login';
const TS = '2026-07-01T00:00:00+09:00';

function writeDoc(repo, rel, data, body = '# x\n') {
  const abs = path.join(repo, rel);
  fs.mkdirSync(path.dirname(abs), { recursive: true });
  fs.writeFileSync(abs, `---\n${yaml.dump(data)}---\n${body}`);
}

// approved blueprint 하나에 task 하나를 쓴다. extra는 task 프론트매터의
// bouncer 블록에 합쳐져 commit_intent·commit_summary 값을 바꾼다.
function writeBlueprint(repo, extra) {
  writeDoc(repo, '.bouncer/context/epics/001-auth/index.md', {
    type: 'bouncer.epic', title: 'Auth', description: 'd',
    resource: '.bouncer/context/epics/001-auth/index.md',
    tags: ['bouncer'], timestamp: TS,
    bouncer: { id: '001', epic_id: '001', status: 'approved' },
  });
  ensureEpicIndexEntry({
    repoRoot: repo, epicId: '001', name: 'auth', description: 'd',
  });
  writeDoc(repo, `${BP_REL}/index.md`, {
    type: 'bouncer.blueprint', title: 'Login', description: 'd',
    resource: `${BP_REL}/index.md`, tags: ['bouncer'], timestamp: TS,
    bouncer: {
      id: '001', epic_id: '001', blueprint_id: '001', status: 'approved',
      commit_type: 'feat',
    },
  }, '# Blueprint\n');
  writeDoc(repo, `${BP_REL}/tasks/001/tasks.md`, {
    type: 'bouncer.tasks', title: 'Impl', description: 'd',
    resource: `${BP_REL}/tasks/001/tasks.md`, tags: ['bouncer'], timestamp: TS,
    bouncer: {
      id: 'TASKS-001', epic_id: '001', blueprint_id: '001', status: 'ready',
      affected_paths: ['src/auth/'], ...extra,
    },
  }, `# Tasks

## Goal & intent
로그인 검증을 옮긴다.

## Interface
validateLogin()

## Touch
- \`src/auth/\`

## Do not touch
- \`src/payments/\`

## Checklist
- [ ] done
`);
  writeDoc(repo, `${BP_REL}/tasks/001/verification.md`, {
    type: 'bouncer.verification', title: 'V', description: 'd',
    resource: `${BP_REL}/tasks/001/verification.md`, tags: ['bouncer'], timestamp: TS,
    bouncer: { id: 'VERIFY-001', epic_id: '001', blueprint_id: '001', status: 'pending' },
  });
  writeDoc(repo, `${BP_REL}/tasks/001/review.md`, {
    type: 'bouncer.review', title: 'R', description: 'd',
    resource: `${BP_REL}/tasks/001/review.md`, tags: ['bouncer'], timestamp: TS,
    bouncer: {
      id: 'REVIEW-001', epic_id: '001', blueprint_id: '001', status: 'pending',
      review: { required: true },
    },
  });
}

function run(extra, gate) {
  const repo = fs.mkdtempSync(path.join(os.tmpdir(), 'bouncer-s34-'));
  writeBlueprint(repo, extra);
  return validateBlueprint({ repoRoot: repo, blueprintDir: BP_REL, gate });
}

const s34 = (res) => res.failures.filter((f) => f.code === 'S34');

test('commit_intent with disallowed ending on plan gate → S34 with message prefix and next', () => {
  const res = run({ commit_intent: ['커밋 구간을 일치시킴.'] }, 'plan');
  const found = s34(res);
  assert.strictEqual(found.length, 1, JSON.stringify(res.failures));
  assert.match(found[0].message, /^commit_intent invalid: /);
  assert.match(found[0].next, /plan gate/);
});

test('commit_intent with disallowed ending on execute and commit gates → no S34', () => {
  for (const gate of ['execute', 'commit']) {
    const res = run({ commit_intent: ['커밋 구간을 일치시킴.'] }, gate);
    assert.deepStrictEqual(s34(res), [], `${gate}: ${JSON.stringify(res.failures)}`);
  }
});

test('only commit_summary invalid on plan gate → exactly one S34 for commit_summary', () => {
  const res = run({
    commit_intent: ['검사를 추가함.'],
    commit_summary: ['커밋 구간을 일치시킴.'],
  }, 'plan');
  const found = s34(res);
  assert.strictEqual(found.length, 1, JSON.stringify(res.failures));
  assert.match(found[0].message, /^commit_summary invalid: /);
});

test('absent, empty list, or valid sentences on plan gate → no S34', () => {
  for (const extra of [
    {},
    { commit_intent: [], commit_summary: [] },
    { commit_intent: ['검사를 추가함.'] },
  ]) {
    const res = run(extra, 'plan');
    assert.deepStrictEqual(s34(res), [], JSON.stringify(res.failures));
  }
});

test('scalar commit_intent on plan gate → S32 only, no S34', () => {
  const res = run({ commit_intent: '한 문장임.' }, 'plan');
  assert.ok(res.failures.some((f) => f.code === 'S32'), JSON.stringify(res.failures));
  assert.deepStrictEqual(s34(res), []);
});
