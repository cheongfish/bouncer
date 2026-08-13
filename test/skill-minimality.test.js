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
  const items = ladder.split(/^(?=\d+\.\s)/m).filter((item) => /^\d+\.\s/.test(item));
  const hit = items.find((item) => item.toLowerCase().includes(phrase.toLowerCase()));
  assert.ok(hit, `ladder must include a numbered rung for ${JSON.stringify(phrase)}`);
  return hit.match(/^(\d+)\./)[1];
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

test('ARCHITECTURE §E records seven-rung ladder and bouncer.scale intensity', () => {
  const gov = fs.readFileSync(
    path.join(__dirname, '..', 'docs', 'ARCHITECTURE.md'),
    'utf8',
  );
  const section = gov.match(/### E\.\s*Ponytail 최소화 정책[\s\S]*?(?=\n### )/);
  assert.ok(section, 'ARCHITECTURE must keep §E Ponytail minimality policy');
  assert.match(section[0], /권장\(advisory\)이며 별도 게이트가 아니다/);
  assert.match(section[0], /\/bouncer-plan/);
  assert.match(section[0], /7단/);
  assert.match(section[0], /bouncer\.scale/);
  assert.match(section[0], /\blight\b/);
  assert.match(section[0], /\bfull\b/);
});
