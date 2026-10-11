'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.join(__dirname, '..');
const read = (rel) => fs.readFileSync(path.join(root, rel), 'utf8');

// ACQ gate ID 정본은 rules/acq-gates.json이다. 응답자(사람·평가 harness)는 표시 제목의
// ID로 질문을 식별하므로, ID가 바뀌거나 빠지면 문구 추측으로 되돌아간다.
const CATALOG = JSON.parse(read('rules/acq-gates.json')).workflows;

function skillFiles(skill) {
  const dir = path.join('skills', skill, 'references');
  const refs = fs.existsSync(path.join(root, dir))
    ? fs.readdirSync(path.join(root, dir)).filter((name) => name.endsWith('.md')).map((name) => path.join(dir, name))
    : [];
  return [path.join('skills', skill, 'SKILL.md'), ...refs];
}

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

test('카탈로그 workflows 키 → ACQ 절을 가진 skills/*/SKILL.md의 skill 이름 집합과 같고 순서는 정해진 목록과 같음', () => {
  const withIndex = fs.readdirSync(path.join(root, 'skills')).filter((skill) => {
    const file = path.join(root, 'skills', skill, 'SKILL.md');
    return fs.existsSync(file) && fs.readFileSync(file, 'utf8').includes('## ACQ (AskUserQuestion) gates');
  });
  const keys = Object.keys(CATALOG);
  assert.deepEqual([...keys].sort(), withIndex.sort());
  assert.deepEqual(keys, ['bouncer-init', 'bouncer-plan', 'bouncer-execute', 'bouncer-commit', 'bouncer-run', 'bouncer-finalize']);
});

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

test('다섯 정책 → 카탈로그 모든 게이트에 bouncer_decisions 항목 있음', () => {
  const ids = Object.values(CATALOG).flat();
  for (const name of POLICY_NAMES) {
    const gates = new Set(JSON.parse(read(`benchmarks/configs/${name}-evaluator-policy.json`)).bouncer_decisions
      .map((decision) => decision.gate));
    for (const id of ids) assert.ok(gates.has(id), `${name}: missing policy entry for ${id}`);
  }
});

// ---- 판독 블록 검사 ----
// 채팅 ACQ display의 제목 다음 줄 `<!-- acq {...} -->`는 외부 응답기가 문장 추측 없이
// 게이트를 식별하게 하는 기계 계약이다. 형식(JSON)만 단언하고 문구는 보지 않는다.
const BLOCK = /^\s*<!-- acq (\{.*\}) -->\s*$/;

/**
 * 텍스트에서 `**AskUserQuestion — <id>**` 제목마다 다음 줄 블록과 선택지 문자를 모은다.
 *
 * @param {string} text - 스캔할 문서 본문
 * @returns {{id: string, block: object|null, letters: string[], recommended: string|null}[]} display별 추출 결과
 */
function scanDisplays(text) {
  const lines = text.split('\n');
  const out = [];
  lines.forEach((line, i) => {
    const title = line.match(/\*\*AskUserQuestion — (<gate-id>|[a-z]+\.[a-z_]+)(?: \(\d+\/\d+\))?\*\*/);
    if (!title) return;
    const m = (lines[i + 1] || '').match(BLOCK);
    const letters = [];
    let recommended = null;
    for (let j = i + 1; j < lines.length; j += 1) {
      const opt = lines[j].match(/^\s*- ([A-Z])\) (.*)$/);
      if (opt) {
        letters.push(opt[1]);
        if (opt[2].includes('(Recommended)')) recommended = opt[1];
      } else if (letters.length > 0 && lines[j].trim() === '') break;
    }
    out.push({ id: title[1], block: m ? JSON.parse(m[1]) : null, letters, recommended });
  });
  return out;
}

test('rules/acq.md 골격의 acq 블록 → JSON 파싱되고 options가 골격 `- X)` 문자 배열과 같으며 recommended가 (Recommended) 줄의 문자와 같음', () => {
  const skeleton = scanDisplays(read('rules/acq.md')).find((d) => d.id === '<gate-id>');
  assert.ok(skeleton && skeleton.block, 'skeleton has a block');
  assert.deepEqual(Object.keys(skeleton.block).sort(), ['gate', 'options', 'recommended']);
  assert.deepEqual(skeleton.block.options, skeleton.letters);
  assert.equal(skeleton.block.recommended, skeleton.recommended);
});

test('rules/acq.md의 자유 입력 블록 예시 → JSON 파싱되고 options가 [], recommended가 null', () => {
  const lines = read('rules/acq.md').split('\n').map((l) => l.match(BLOCK)).filter(Boolean).map((m) => JSON.parse(m[1]));
  const free = lines.find((b) => b.gate === 'plan.request');
  assert.ok(free, 'free-input example exists');
  assert.deepEqual(free.options, []);
  assert.equal(free.recommended, null);
});

test('skills/*/SKILL.md의 모든 AskUserQuestion 제목 → 다음 줄 블록의 gate·options·recommended가 표시와 같음', () => {
  let seen = 0;
  for (const skill of fs.readdirSync(path.join(root, 'skills'))) {
    const rel = path.join('skills', skill, 'SKILL.md');
    if (!fs.existsSync(path.join(root, rel))) continue;
    for (const d of scanDisplays(read(rel))) {
      seen += 1;
      assert.ok(d.block, `${rel}: ${d.id} has no block on the line after its title`);
      assert.equal(d.block.gate, d.id, `${rel}: block gate`);
      assert.deepEqual(d.block.options, d.letters, `${rel}: ${d.id} options`);
      assert.equal(d.block.recommended, d.recommended, `${rel}: ${d.id} recommended`);
    }
  }
  assert.ok(seen >= 3, 'scan found the chat displays');
});

test('references/discovery/index.md → open_decisions 블록 줄이 JSON 파싱되고 kind가 open_decisions', () => {
  const hit = read('references/discovery/index.md').split('\n').map((l) => l.match(/<!-- acq (\{"kind":"open_decisions"\}) -->/)).find(Boolean);
  assert.ok(hit, 'open_decisions block present');
  assert.equal(JSON.parse(hit[1]).kind, 'open_decisions');
});
