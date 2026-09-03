'use strict';
const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');
const { parseFrontmatter } = require('../scripts/lib/frontmatter');

const root = path.join(__dirname, '..');
const md = fs.readFileSync(path.join(root, 'skills', 'bouncer-init', 'SKILL.md'), 'utf8');

test('bouncer-init skill has a description and calls scripts/bouncer init', () => {
  const { data, body } = parseFrontmatter(md);
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

test('bouncer-init promotion ACQ offers enable+install, enable-only, and leave-as-is', () => {
  assert.match(md, /graphifyPromotion/);
  assert.match(md, /candidate/);
  assert.match(md, /--promote-graphify/);
  // 세 선택지: 켜고 설치 / 켜기만 / 그대로.
  assert.match(md, /enable.*install|켜고 설치|A\)/i);
  assert.match(md, /enable only|켜기만|B\)/i);
  // Option C만 — gitignore "leave … untouched"와 겹치지 않게 고정.
  assert.match(md, /Leave as-is|\*\*C\)\*\*|C\) Leave/i);
});

test('bouncer-init tells the user to commit the bootstrap before planning', () => {
  const { body } = parseFrontmatter(md);
  assert.match(body, /git add[^\n]*\.bouncer|commit[^\n]*\.bouncer/i);
  // The guidance is only correct before /bouncer-plan writes the active pointer,
  // after which the commit guard blocks files outside affected_paths.
  assert.match(body, /before[^\n]*\/bouncer-plan|\/bouncer-plan[^\n]*after/i);
});

/**
 * @param {string} body
 * @param {number} n
 * @returns {string}
 */
function initStepBody(body, n) {
  const start = body.search(new RegExp(`^${n}\\. `, 'm'));
  assert.ok(start > -1, `missing init step ${n}`);
  const rest = body.slice(start);
  const next = rest.search(new RegExp(`\\n(?:${n + 1}\\. |## ACQ )`, 'm'));
  return next === -1 ? rest : rest.slice(0, next);
}

test('bouncer-init keeps Promotion/Gitignore/Branch ACQ in step 3 with an index', () => {
  const { body } = parseFrontmatter(md);
  const acqAt = body.indexOf('\n## ACQ (AskUserQuestion) gates\n');
  assert.ok(acqAt > -1);
  const index = body.slice(acqAt);
  assert.match(index, /[Ss]tep\s+3/);
  assert.doesNotMatch(index, /\*\*Options\*\*:/);
  // 선택지·결과 설명은 step 3에 남긴다.
  const step3 = initStepBody(body, 3);
  assert.match(step3, /Promotion ACQ|graphifyPromotion/);
  assert.match(step3, /Gitignore ACQ|gitignoreSuggestions/);
  assert.match(step3, /Branch ACQ|baseBranchUnresolved/);
  assert.match(step3, /Leave as-is|\*\*C\)\*\*|C\) Leave/i);
  assert.match(step3, /--promote-graphify/);
  assert.match(step3, /--write-gitignore/);
});
