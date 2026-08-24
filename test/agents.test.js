'use strict';
const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');
const { parseFrontmatter } = require('../scripts/lib/frontmatter');

const root = path.join(__dirname, '..');
const agentsDir = path.join(root, 'agents');

// 네 named agent — 골격·frontmatter 단언이 공유하는 이름 목록.
const AGENTS = [
  'bouncer-reviewer', 'bouncer-implementer', 'bouncer-debugger',
  'bouncer-context-reviewer',
];
const READONLY = ['bouncer-reviewer', 'bouncer-debugger', 'bouncer-context-reviewer'];

// context-reviewer는 execute 삼인조와 같이 inherit 슬롯·readonly를 쓰지만,
// 판정 대상이 계획 문서 전체이고 산출은 BP 루트 context-review.md라
// tasks/<NNN>/tasks.md 단독 브리프·task-dir review.md 단언 순회에는 넣지 않는다.
for (const name of AGENTS) {
  test(`agents/${name}.md exists with name == basename and model inherit`, () => {
    const filePath = path.join(agentsDir, `${name}.md`);
    assert.ok(fs.existsSync(filePath), `missing ${filePath}`);
    const md = fs.readFileSync(filePath, 'utf8');
    const { data } = parseFrontmatter(md);
    assert.strictEqual(data.name, name);
    assert.strictEqual(data.model, 'inherit');
    if (
      name === 'bouncer-reviewer'
      || name === 'bouncer-debugger'
      || name === 'bouncer-context-reviewer'
    ) {
      assert.strictEqual(data.readonly, true);
    }
  });
}

test('agents describe task bundle briefs and task-local evidence documents', () => {
  for (const name of ['bouncer-reviewer', 'bouncer-implementer', 'bouncer-debugger']) {
    const md = fs.readFileSync(path.join(agentsDir, `${name}.md`), 'utf8');
    assert.match(md, /tasks\/<NNN>\/tasks\.md/);
  }
  for (const name of ['bouncer-reviewer', 'bouncer-debugger']) {
    const md = fs.readFileSync(path.join(agentsDir, `${name}.md`), 'utf8');
    assert.match(md, /task directory.*review\.md|review\.md.*task directory/i);
  }
});

test('bouncer-context-reviewer records into blueprint-root context-review.md', () => {
  const md = fs.readFileSync(
    path.join(agentsDir, 'bouncer-context-reviewer.md'),
    'utf8',
  );
  assert.match(md, /context-review\.md/);
});

// 컨트롤러(특히 /bouncer-run 루프)는 diff를 다시 읽지 않고 이 필드로만 라우팅한다.
test('bouncer-implementer applies debugger report as evidence on verify-failure re-dispatch', () => {
  const md = fs.readFileSync(path.join(agentsDir, 'bouncer-implementer.md'), 'utf8');
  assert.match(md, /Verify-failure re-dispatch/);
  assert.match(md, /Minimum fix proposal/);
  assert.match(md, /Required regression test/);
  assert.match(md, /evidence/);
  assert.match(md, /Needs planning/);
});

test('bouncer-implementer points comment rule at hard rule 9 without restating it', () => {
  const md = fs.readFileSync(path.join(agentsDir, 'bouncer-implementer.md'), 'utf8');
  assert.match(md, /Detailed comments/i);
  assert.match(md, /[Hh]ard rule 9|하드룰 9/);
  assert.match(md, /skills\/implementation\/SKILL\.md|CLAUDE\.md/);
  // Rule body lives in master rules + implementation skill — no second copy.
  assert.doesNotMatch(md, /known ceilings/);
  assert.doesNotMatch(md, /Prefer thoroughness/);
});

test('agent docs share the body skeleton and end with the output contract', () => {
  for (const name of AGENTS) {
    const md = fs.readFileSync(path.join(root, 'agents', `${name}.md`), 'utf8');
    const heads = [...md.matchAll(/^## .*$/gm)].map((m) => m[0]);
    assert.strictEqual(heads[0], '## Authority', name);
    // 가드 절은 권한 바로 뒤. 도메인 절(Scope, Rubric 등)은 그 아래로 간다.
    const guard = READONLY.includes(name) ? '## Hard guards (read-only)' : '## Hard guards';
    assert.strictEqual(heads[1], guard, name);
    assert.ok(heads.includes('## Procedure') || READONLY.includes(name), name);
    assert.strictEqual(heads[heads.length - 1], '## Output contract', name);
  }
});

test('agent doc bodies use English headings', () => {
  for (const name of AGENTS) {
    const md = fs.readFileSync(path.join(root, 'agents', `${name}.md`), 'utf8');
    const ko = [...md.matchAll(/^#{2,3} .*[가-힣].*$/gm)].map((m) => m[0]);
    assert.deepStrictEqual(ko, [], `${name}: ${ko.join(' | ')}`);
  }
});
