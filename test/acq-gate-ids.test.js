'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.join(__dirname, '..');
const read = (rel) => fs.readFileSync(path.join(root, rel), 'utf8');

// ACQ gate ID 정본. 응답자(사람·평가 harness)는 표시 제목의 ID로 질문을 식별하므로,
// ID가 바뀌거나 빠지면 문구 추측으로 되돌아간다.
const CATALOG = {
  'bouncer-init': ['init.graphify_promotion', 'init.gitignore', 'init.base_branch', 'init.pre_commit_hook'],
  'bouncer-plan': ['plan.request', 'plan.discovery', 'plan.id_allocation', 'plan.light_scope',
    'plan.verify_command', 'plan.affected_paths', 'plan.approval'],
  'bouncer-execute': [],
  'bouncer-commit': ['commit.next_task'],
  'bouncer-run': ['run.start_drive'],
  'bouncer-finalize': ['finalize.remainder', 'finalize.pr'],
};

function skillFiles(skill) {
  const dir = path.join('skills', skill, 'references');
  const refs = fs.existsSync(path.join(root, dir))
    ? fs.readdirSync(path.join(root, dir)).filter((name) => name.endsWith('.md')).map((name) => path.join(dir, name))
    : [];
  return [path.join('skills', skill, 'SKILL.md'), ...refs];
}

test('acq display contract requires one gate ID heading per display', () => {
  const acq = read('rules/acq.md');
  assert.match(acq, /stable ID of the form `<workflow>\.<gate>`/);
  assert.match(acq, /Ask only gates that index lists/);
  assert.match(acq, /`\*\*AskUserQuestion —\s+<gate-id>\*\*` in chat, and the question title in the host UI/);
  assert.match(acq, /One display holds\s+exactly one gate/);
  assert.match(acq, /`- X\) label`/);
  assert.match(acq, /^\*\*AskUserQuestion — <gate-id>\*\*$/m);
  assert.doesNotMatch(acq, /^\*\*AskUserQuestion:\*\*$/m);
});

for (const [skill, ids] of Object.entries(CATALOG)) {
  test(`${skill} indexes exactly its gate IDs and uses each one where the gate runs`, () => {
    const body = read(path.join('skills', skill, 'SKILL.md'));
    const index = body.slice(body.indexOf('## ACQ (AskUserQuestion) gates'));
    const indexed = [...index.matchAll(/`([a-z]+\.[a-z_]+)`/g)].map((match) => match[1]);
    assert.deepEqual(indexed, ids);
    for (const id of ids) {
      assert.ok(id.startsWith(`${skill.replace('bouncer-', '')}.`), `${id} belongs to ${skill}`);
      const used = skillFiles(skill).some((rel) => {
        const text = read(rel);
        const procedure = rel.endsWith('SKILL.md') ? text.slice(0, text.indexOf('## ACQ (AskUserQuestion) gates')) : text;
        return procedure.includes(`\`${id}\``) || procedure.includes(`AskUserQuestion — ${id}**`);
      });
      assert.ok(used, `${skill}: ${id} is indexed but never named where the gate runs`);
    }
  });
}

const POLICY_NAMES = ['ledger-001', 'ledger-002', 'ledger-003', 'ledger-004', 'fastify-001'];

test('the benchmark evaluator policies answer only catalogued gate IDs', () => {
  const known = new Set(Object.values(CATALOG).flat());
  // 제품이 정의하지 않은 포인터 활성화 질문은 과거 run 호환용으로만 남는다.
  const legacy = new Set(['plan.activate_pointer', 'finalize.quiz']);
  for (const name of POLICY_NAMES) {
    const policy = JSON.parse(read(`benchmarks/configs/${name}-evaluator-policy.json`));
    for (const decision of policy.bouncer_decisions) {
      assert.ok(known.has(decision.gate) || legacy.has(decision.gate), `${name}: unknown policy gate ${decision.gate}`);
    }
  }
});

test('the benchmark evaluator policies are v3 and answer finalize.remainder with --yes', () => {
  for (const name of POLICY_NAMES) {
    const policy = JSON.parse(read(`benchmarks/configs/${name}-evaluator-policy.json`));
    assert.equal(policy.policy_version, 3, name);
    assert.ok(!policy.bouncer_decisions.some((d) => d.gate === 'finalize.next_blueprint'), name);
    const remainder = policy.bouncer_decisions.find((d) => d.gate === 'finalize.remainder');
    assert.equal(remainder.answer, 'finalize_yes_and_remove_worktrees', name);
    assert.match(policy.approval_record, /2026-10-08 conversation: 사용자 승인/, name);
  }
  // 승인은 finalize 항목 변경에 대한 것이라 fastify-001의 초안 상태는 유지된다.
  assert.equal(JSON.parse(read('benchmarks/configs/fastify-001-evaluator-policy.json')).approval_state, 'proposed');
});
