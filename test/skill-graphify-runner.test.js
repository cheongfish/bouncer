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
  assert.match(md, /bouncer\.scope_evidence\.suggested_paths/);
  assert.match(md, /legacy read compatibility/i);
  assert.match(md, /not available|unavailable|absent|skip/i);
  assert.match(md, /bouncer\.graph|\/bouncer-plan/);
  // PATH 직접 호출 형태는 거부 — 해석된 "$GRAPHIFY_BIN" query 만 허용.
  assert.doesNotMatch(md, /`graphify query`/);
  assert.doesNotMatch(md, /\bsdd\b|superpowers/i);
});

test('graphify-runner records basis and documents freshness policy', () => {
  const md = readSkill('graphify-runner');
  assert.match(md, /bouncer\.scope_evidence\.basis/);
  assert.match(md, /producer: graphify/);
  assert.match(md, /legacy.*compatibility/i);
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
  // 7df16a1이 스킬에서 docs/install.md 포인터를 제거함 — 에이전트 지시문에
  // 사람용 문서 경로를 두지 않으므로 그 문자열을 요구하지 않는다.
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

test('graphify-runner excludes graphify-out hits and does not translate derived names', () => {
  const md = readSkill('graphify-runner');
  assert.match(md, /graphify-out\//);
  assert.match(md, /(제외|버리|drop|exclude)/i);
  assert.match(md, /파생\s*이름[\s\S]{0,80}번역하지\s*않는다|does not translate/i);
});

test('graphify-runner calls graph-suggest after sync and records structured quality evidence', () => {
  const md = readSkill('graphify-runner');
  assert.match(md, /graph-sync/);
  assert.match(md, /graph-suggest/);
  assert.match(md, /scope_evidence\.quality|quality:/);
  assert.match(md, /scope_evidence\.candidates|candidates:/);
  assert.match(md, /implementation/);
  assert.match(md, /low-confidence/);
  assert.match(md, /graphify-out\/source/);
  assert.match(md, /graphify-out\/test/);
  assert.match(md, /graphify-out\/context/);
  // 디렉터리 롤업은 파일 후보 계약으로 대체된다.
  assert.doesNotMatch(md, /Roll up to directories/);
  assert.match(md, /suggested_paths/);
});

test('graphify-runner leaves empty suggested_paths on low-confidence or unavailable', () => {
  const md = readSkill('graphify-runner');
  assert.match(md, /low-confidence/);
  assert.match(md, /unavailable/);
  assert.match(md, /suggested_paths[\s\S]{0,160}(\[\]|empty|빈)/i);
});

test('graphify-runner uses English ASCII noun queries and prioritizes ASCII seeds', () => {
  const md = readSkill('graphify-runner');
  assert.match(md, /English ASCII noun-oriented\s+(query|`--query` values)/i);
  assert.match(md, /--seed/);
  assert.match(md, /paths, symbols, (and )?anchors/i);
  assert.doesNotMatch(md, /--query\s+"[^"\n]*[가-힣][^"\n]*"/);
  assert.match(md, /do not[\s\S]{0,80}tokenizer extension/i);
});
