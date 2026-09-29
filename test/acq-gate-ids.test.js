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
  'bouncer-init': ['init.graphify_promotion', 'init.gitignore', 'init.base_branch'],
  'bouncer-plan': ['plan.request', 'plan.discovery', 'plan.id_allocation', 'plan.light_scope',
    'plan.verify_command', 'plan.affected_paths', 'plan.approval'],
  'bouncer-execute': [],
  'bouncer-commit': ['commit.next_task'],
  'bouncer-run': ['run.start_drive'],
  'bouncer-finalize': ['finalize.remainder', 'finalize.pr', 'finalize.next_blueprint'],
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

test('the benchmark evaluator policy answers only catalogued gate IDs', () => {
  const policyFile = path.join(root, 'benchmarks', 'configs', 'ledger-001-evaluator-policy.json');
  if (!fs.existsSync(policyFile)) return;
  const known = new Set(Object.values(CATALOG).flat());
  // 제품이 정의하지 않은 포인터 활성화 질문은 과거 run 호환용으로만 남는다.
  const legacy = new Set(['plan.activate_pointer', 'finalize.quiz']);
  for (const decision of JSON.parse(fs.readFileSync(policyFile, 'utf8')).bouncer_decisions) {
    assert.ok(known.has(decision.gate) || legacy.has(decision.gate), `unknown policy gate ${decision.gate}`);
  }
});
