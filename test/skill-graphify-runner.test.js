'use strict';
const test = require('node:test');
const assert = require('node:assert');
const { parseFrontmatter } = require('../scripts/lib/frontmatter');
const { readSkill } = require('./helpers/read-skill');

test('graphify-runner has valid frontmatter', () => {
  const md = readSkill('graphify-runner');
  const { data } = parseFrontmatter(md);
  assert.strictEqual(data.name, 'graphify-runner');
  assert.ok(typeof data.description === 'string' && data.description.length > 0);
});

test('graphify-runner resolves bin then queries; no PATH `graphify query`', () => {
  const md = readSkill('graphify-runner');
  assert.match(md, /graphify-bin/);
  assert.match(md, /GRAPHIFY_BIN/);
  assert.match(md, /suggested_paths/);
  assert.match(md, /not available|unavailable|absent|skip/i);
  assert.match(md, /bouncer\.graph|\/bouncer-plan/);
  // PATH 직접 호출 형태는 거부 — 해석된 "$GRAPHIFY_BIN" query 만 허용.
  assert.doesNotMatch(md, /`graphify query`/);
  assert.doesNotMatch(md, /\bsdd\b|superpowers/i);
});

test('graphify-runner records basis and documents freshness policy', () => {
  const md = readSkill('graphify-runner');
  assert.match(md, /bouncer\.graph\.basis|graph\.basis|basis/i);
  assert.match(md, /SessionStart|freshness|mtime/i);
  assert.match(md, /graph-sync/);
});

test('graphify-runner basis status enum lists all five values', () => {
  const md = readSkill('graphify-runner');
  assert.match(md, /updated/);
  assert.match(md, /reused/);
  assert.match(md, /fail-skip/);
  assert.match(md, /skip-disabled/);
  assert.match(md, /missing/);
});

test('graphify-runner basis entry fields are named separately', () => {
  const md = readSkill('graphify-runner');
  assert.match(md, /`graph`/);
  assert.match(md, /`status`/);
  assert.match(md, /`query`/);
  assert.match(md, /`result`/);
});

test('graphify-runner treats graphify-out as user-managed local output', () => {
  const md = readSkill('graphify-runner');
  assert.match(md, /user-managed local output/i);
  assert.doesNotMatch(md, /local cache|gitignored cache/i);
});

test('graphify-runner handles disabled auto-build with user-confirmed affected paths', () => {
  const md = readSkill('graphify-runner');
  assert.match(md, /auto-build is disabled|automatic graph build is disabled/i);
  assert.match(md, /require the user to confirm\s+`affected_paths`/i);
});

test('graphify-runner tells users how to enable graphify when skipping', () => {
  const md = readSkill('graphify-runner');
  assert.match(md, /bouncer init/);
  assert.match(md, /--promote-graphify/);
  assert.match(md, /docs\/install\.md/);
});

test('graphify-runner queries source and context graphs after plan-time sync', () => {
  const md = readSkill('graphify-runner');
  assert.match(md, /graphify-out\/source/);
  assert.match(md, /graphify-out\/context/);
  assert.match(md, /context_dirs|source_dirs/);
  assert.match(md, /graph-sync/);
});

test('graphify-runner skips on source graph missing via graph-sync missing', () => {
  const md = readSkill('graphify-runner');
  assert.match(md, /missing/);
  assert.doesNotMatch(md, /both `graph\.json` files/);
  // Line-break–tolerant: the old "both … files" skip rule must be gone.
  assert.doesNotMatch(md, /both\s+`graph\.json` files/);
  assert.match(md, /source `graph\.json`/);
});

test('graphify-runner drops graphify-out hits before rollup and does not translate', () => {
  const md = readSkill('graphify-runner');
  // 계약: 롤업 전에 graphify-out/ 하위 히트 제외 + 파생 이름 번역 금지 (스킬 본문).
  assert.match(md, /graphify-out\//);
  assert.match(md, /롤업/);
  assert.match(md, /롤업\s*전에[\s\S]{0,200}`?graphify-out\/`?[\s\S]{0,120}(제외|버리)/);
  assert.match(md, /파생\s*이름[\s\S]{0,80}번역하지\s*않는다/);
});
