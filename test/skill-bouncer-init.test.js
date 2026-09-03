'use strict';
const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');
const { parseFrontmatter } = require('../scripts/lib/frontmatter');
const { checkDocShape } = require('../scripts/check-doc-shape');

const root = path.join(__dirname, '..');
const md = fs.readFileSync(path.join(root, 'skills', 'bouncer-init', 'SKILL.md'), 'utf8');

function assertShape(document, contract) {
  const result = checkDocShape(document, contract);
  assert.deepStrictEqual(result.errors, [], result.errors.join('; '));
  return result.shape;
}

function assertPromotionDecisionContract(document) {
  const shape = assertShape(document, { steps: { required: [3] } });
  const step3 = shape.steps.find((step) => step.number === 3).body;
  // graphifyPromotion은 질문 산문이 아니라 이 ACQ가 소비하는 CLI 결과 상태다.
  assert.match(step3, /graphifyPromotion/);

  const choices = [...step3.matchAll(/^\s*-\s+\*\*([A-Z])\)\*\*/gm)].map((match) => match[1]);
  assert.deepStrictEqual(choices, ['A', 'B', 'C']);

  // 선택지와 실행 효과는 코드 블록의 A/B 표식으로 결속한다. C에는 promotion
  // 명령을 대응시키지 않아, 명령 없는 선택이 no-write 경로임을 유지한다.
  const effects = [...step3.matchAll(
    /^\s*#\s*([A-Z])\)[^\n]*\n\s*node\s+"\$\{BOUNCER_ROOT\}\/scripts\/bouncer"\s+init((?:\s+--[\w-]+)*)\s*$/gm,
  )].map((match) => ({ option: match[1], flags: match[2].trim() }));
  assert.deepStrictEqual(effects, [
    { option: 'A', flags: '--promote-graphify' },
    { option: 'B', flags: '--promote-graphify --no-graphify' },
  ]);
}

test('bouncer-init skill has a description and calls scripts/bouncer init', () => {
  const { data, body } = parseFrontmatter(md);
  assertShape(md, { frontmatter: { required: ['name', 'description'], values: { name: 'bouncer-init' } } });
  assert.ok(typeof data.description === 'string' && data.description.length > 0);
  assert.match(body, /scripts\/bouncer"\s+init\b/);
  assert.match(body, /idempotent|already exists|no changes/i);
  assert.match(body, /\.bouncer\//);
  assert.match(body, /\/bouncer-plan/);
  assert.doesNotMatch(md, /superpowers/i);
});

test('bouncer-init skill surfaces gitignore suggestions and consent write', () => {
  assert.match(md, /gitignoreSuggestions/);
  assert.match(md, /\.gitignore/);
  assert.match(md, /--write-gitignore/);
  // 동의 후에만 마커 블록을 씀 — "절대 쓰지 않음"은 폐기.
  assert.match(md, /consent|ACQ|agree|동의/i);
});

test('bouncer-init promotion ACQ keeps option order, CLI effects, and no-write state', () => {
  assertPromotionDecisionContract(md);
});

test('bouncer-init promotion ACQ permits rewording but rejects swapped CLI effects', () => {
  const reworded = md
    .replace('**Promotion ACQ** — when the result carries', '**Graphify choice** — when the result carries')
    .replace('**A)** Enable and install (recommended)', '**A)** Use the managed setup (recommended)')
    .replace('**B)** Enable only (no install attempt)', '**B)** Keep the existing executable')
    .replace('**C)** Leave as-is', '**C)** Defer this decision');
  assert.doesNotThrow(() => assertPromotionDecisionContract(reworded));

  const swappedEffects = md
    .replace('# A) enable + install\n     node "${BOUNCER_ROOT}/scripts/bouncer" init --promote-graphify',
      '# A) enable only\n     node "${BOUNCER_ROOT}/scripts/bouncer" init --promote-graphify --no-graphify')
    .replace('# B) enable only\n     node "${BOUNCER_ROOT}/scripts/bouncer" init --promote-graphify --no-graphify',
      '# B) enable + install\n     node "${BOUNCER_ROOT}/scripts/bouncer" init --promote-graphify');
  assert.throws(() => assertPromotionDecisionContract(swappedEffects), assert.AssertionError);
});

test('bouncer-init tells the user to commit the bootstrap before planning', () => {
  const { body } = parseFrontmatter(md);
  assert.match(body, /git add[^\n]*\.bouncer|commit[^\n]*\.bouncer/i);
  // The guidance is only correct before /bouncer-plan writes the active pointer,
  // after which the commit guard blocks files outside affected_paths.
  assert.match(body, /before[^\n]*\/bouncer-plan|\/bouncer-plan[^\n]*after/i);
});


test('bouncer-init keeps Promotion/Gitignore/Branch ACQ in step 3 with an index', () => {
  const shape = assertShape(md, {
    headings: { required: ['ACQ (AskUserQuestion) gates'] },
    steps: { required: [1, 2, 3, 4, 5], order: true, acq: [3] },
    acqIndex: { heading: 'ACQ (AskUserQuestion) gates', steps: [3], only: true },
  });
  // 단계의 선택 결과는 문구가 아니라 CLI 플래그·상태 필드라는 계약 키로 고정한다.
  const step3 = shape.steps.find((step) => step.number === 3).body;
  assert.match(step3, /graphifyPromotion/);
  assert.match(step3, /gitignoreSuggestions/);
  assert.match(step3, /baseBranchUnresolved/);
  assert.match(step3, /--promote-graphify/);
  assert.match(step3, /--write-gitignore/);
});
