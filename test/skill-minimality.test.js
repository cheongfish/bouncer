'use strict';
const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');
const { parseFrontmatter } = require('../scripts/lib/frontmatter');
const { readSkill } = require('./helpers/read-skill');

test('minimality has valid frontmatter identity', () => {
  const md = readSkill('minimality');
  const { data } = parseFrontmatter(md);
  assert.match(md, /name:\s*minimality/);
  assert.strictEqual(data.name, 'minimality');
  assert.ok(typeof data.description === 'string' && data.description.length > 0);
});

test('minimality preserves required scope and escalates conflicts to planning', () => {
  const md = readSkill('minimality');
  assert.match(md, /reuse/i);
  assert.match(md, /dependenc/i);
  assert.match(md, /require|test|verification|security|accessib/i);
  assert.match(md, /rationale|record/i);
  assert.match(md, /plann?ing/i);
  assert.match(md, /advisory|not a gate/i);
  assert.doesNotMatch(md, /\/bouncer-plan|superpowers/i);
});

test('minimality ladder covers YAGNI, reuse, stdlib/platform, and shortest surface', () => {
  const md = readSkill('minimality');
  assert.match(md, /YAGNI|need to exist/i);
  assert.match(md, /Already in this codebase|Reuse/i);
  assert.match(md, /standard library/);
  assert.match(md, /native platform/);
  assert.match(md, /shortest working|fewest files/i);
  assert.match(md, /Over-engineering/i);
  assert.match(md, /[Ee]xplanatory comments/);
});

function decisionLadder(md) {
  const section = md.match(/## Decision ladder[\s\S]*?(?=\n## )/);
  assert.ok(section, 'minimality must keep a Decision ladder section');
  return section[0];
}

// 한 단이 두 표현을 같이 담으면 둘 다 같은 번호로 잡힌다. 별도 단인지
// 보려면 번호가 갈라져 있는지를 봐야 한다.
function rungNumberFor(ladder, phrase) {
  // 구현 agent 사다리는 Procedure 1 아래 들여 쓴다. 선행 공백을 허용해야
  // 번호가 안 잡힌 채 '단이 없다'로 실패하지 않는다.
  const items = ladder.split(/^(?=\s*\d+\.\s)/m).filter((item) => /^\s*\d+\.\s/.test(item));
  const hit = items.find((item) => item.toLowerCase().includes(phrase.toLowerCase()));
  assert.ok(hit, `ladder must include a numbered rung for ${JSON.stringify(phrase)}`);
  return hit.match(/^\s*(\d+)\./)[1];
}

test('minimality ladder numbers native platform and standard library as separate rungs', () => {
  const ladder = decisionLadder(readSkill('minimality'));
  const numbers = [...ladder.matchAll(/^(\d+)\.\s/gm)].map((m) => Number(m[1]));
  assert.deepStrictEqual(numbers, [1, 2, 3, 4, 5, 6, 7]);
  const native = rungNumberFor(ladder, 'native platform');
  const stdlib = rungNumberFor(ladder, 'standard library');
  assert.notStrictEqual(
    native,
    stdlib,
    'native platform and standard library must not share a rung number',
  );
});

function implementerClimbLadder() {
  const md = fs.readFileSync(
    path.join(__dirname, '..', 'agents', 'bouncer-implementer.md'),
    'utf8',
  );
  const section = md.match(/Understand, then climb[\s\S]*?(?=\n2\. \*\*Focused change)/);
  assert.ok(section, 'implementer Procedure 1 must keep the climb ladder');
  return section[0];
}

// 구현 경로 사다리는 스킬과 native→stdlib 순서를 맞춘다. YAGNI 단은 브리프
// 축소를 막으려고 일부러 없다 — 단 개수를 7로 맞추는 단언은 두지 않는다.
test('implementer climb ladder numbers native platform before standard library', () => {
  const ladder = implementerClimbLadder();
  const native = Number(rungNumberFor(ladder, 'native platform'));
  const stdlib = Number(rungNumberFor(ladder, 'standard library'));
  assert.ok(
    native < stdlib,
    `native platform rung must precede standard library (got native=${native}, stdlib=${stdlib})`,
  );
});

test('Distill core drops upper-layer restatements and keeps repo-true clauses', () => {
  const core = fs.readFileSync(
    path.join(__dirname, '..', '.bouncer', 'distill', 'core.md'),
    'utf8',
  );
  assert.doesNotMatch(core, /Canonical Bouncer docs live only under/);
  assert.doesNotMatch(core, /Active pointer surface is `bouncer current`/);
  assert.doesNotMatch(core, /Workflow order is init/);
  assert.doesNotMatch(core, /Minimality lives only in the `minimality` skill/);
  assert.doesNotMatch(core, /only in the minimality skill/i);
  assert.match(core, /<git-common-dir>\/bouncer\/current/);
  assert.match(core, /\{\s*blueprint,\s*task\?,\s*base\s*\}/);
  assert.match(core, /current\.task\.path/);
  assert.match(core, /G16 blocks/);
  assert.match(core, /confirm-then `--set`/);
  assert.match(core, /One execute worktree is reused/);
  assert.match(core, /`scripts\/` does not read/);
  assert.match(core, /--for <path-1> --for <path-2>/);
});

test('minimality maps judgment intensity onto existing bouncer.scale', () => {
  const md = readSkill('minimality');
  assert.match(md, /bouncer\.scale/);
  assert.match(md, /\blight\b/);
  assert.match(md, /\bfull\b/);
  assert.match(md, /1[–-]4/);
  assert.doesNotMatch(md, /\blite\b|\bultra\b/);
});

test('minimality do-not-minimize list applies regardless of intensity', () => {
  const md = readSkill('minimality');
  assert.match(md, /Do NOT minimize/i);
  assert.match(md, /regardless of intensity/);
});
