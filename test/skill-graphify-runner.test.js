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
  assert.match(md, /\/bouncer-plan/);
  // PATH 직접 호출 형태는 거부 — 해석된 "$GRAPHIFY_BIN" query 만 허용.
  assert.doesNotMatch(md, /`graphify query`/);
  assert.doesNotMatch(md, /\bsdd\b|superpowers/i);
});

test('graphify-runner records basis and documents freshness policy', () => {
  const md = readSkill('graphify-runner');
  assert.match(md, /basis/);
  assert.match(md, /SessionStart|freshness|mtime/i);
  assert.match(md, /graph-sync/);
});

test('graphify-runner returns evidence to the caller without writing task frontmatter', () => {
  const md = readSkill('graphify-runner');
  assert.doesNotMatch(md, /scope_evidence|producer: graphify|legacy read compatibility/);
  assert.match(md, /\/bouncer-plan/);
  assert.match(md, /suggested_paths/);
  assert.match(md, /(does not|never) write[\s\S]{0,60}frontmatter/i);
});

test('graphify-runner basis status enum lists all five values', () => {
  const md = readSkill('graphify-runner');
  assert.match(md, /updated/);
  assert.match(md, /reused/);
  assert.match(md, /fail-skip/);
  assert.match(md, /skip-disabled/);
  assert.match(md, /missing/);
});

test('graphify-runner maps skip-unconfigured outcome to skip-disabled status', () => {
  const md = readSkill('graphify-runner');
  // outcome→status 표 행이 사라지면 에이전트가 test 미설정을 추측하게 된다.
  assert.match(md, /`skip-unconfigured`\s*\|\s*`skip-disabled`/);
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

test('graphify-runner queries source and test graphs after plan-time sync', () => {
  const md = readSkill('graphify-runner');
  assert.match(md, /graphify-out\/source/);
  assert.match(md, /graphify-out\/test/);
  assert.match(md, /source_dirs/);
  assert.match(md, /graph-sync/);
  // context graph 입력·질의·후보 안내가 남아 있으면 제거된 기능을 다시 가르친다.
  assert.doesNotMatch(md, /context_dirs|graphify-out\/context|candidates\.context|context graph/);
});

test('graphify-runner syncs before resolve/skip and rank; no context flow', () => {
  const md = readSkill('graphify-runner');
  const steps = md.slice(md.indexOf('## Steps'));
  // Headings keep the period inside bold (`**….**`), so match that form.
  const syncPos = steps.search(/\*\*Sync graphs after authoring\.\*\*/);
  const resolvePos = steps.search(/\*\*Resolve executable and availability\.\*\*/);
  const rankPos = steps.search(/\*\*Rank file candidates after authoring\.\*\*/);
  assert.ok(syncPos >= 0, 'sync step present');
  assert.ok(resolvePos >= 0, 'resolve/skip step present');
  assert.ok(rankPos >= 0, 'rank step present');
  // sync-derived skip checks must not precede plan-time graph-sync.
  assert.ok(syncPos < resolvePos, 'sync before resolve/skip');
  assert.ok(resolvePos < rankPos, 'resolve/skip before rank');
  // basis graph enum is source|test only — stronger than token absence alone.
  assert.match(md, /`graph`\s*\|\s*`source`\s*\\\|\s*`test`/);
  assert.doesNotMatch(md, /`graph`\s*\|\s*`source`\s*\\\|\s*`test`\s*\\\|\s*`context`/);
  assert.doesNotMatch(md, /pre-scaffold context|context candidates|candidates\.context/i);
  assert.doesNotMatch(md, /graphify-out\/context|context_dirs/);
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
  assert.match(md, /quality/);
  assert.match(md, /candidates/);
  assert.match(md, /implementation/);
  assert.match(md, /low-confidence/);
  assert.match(md, /graphify-out\/source/);
  assert.match(md, /graphify-out\/test/);
  // 디렉터리 롤업은 파일 후보 계약으로 대체된다.
  assert.doesNotMatch(md, /Roll up to directories/);
  assert.match(md, /suggested_paths/);
  // compact 기본 payload: path/role/score/basis code, 역할·전체 상한, 선택 debug.
  assert.match(md, /\brole\b/);
  assert.match(md, /3 candidates per role|역할당 최대 3|per role.*3/i);
  assert.match(md, /8 total|전체 8/i);
  assert.match(md, /compact/i);
  assert.match(md, /--debug/);
  assert.match(md, /\bdebug\b/);
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

test('graphify-runner excludes hub seeds and generic query words from examples', () => {
  const md = readSkill('graphify-runner');
  // 허브 시드·일반어 예시는 검색 공간을 팽창시키므로 실제 진입 심볼만 허용한다.
  assert.doesNotMatch(md, /--seed\s+"scripts\/bouncer"/);
  assert.doesNotMatch(md, /--query\s+"graph suggestion task evidence"/);
  // F1: 예시는 이 저장소의 실제 진입 경로/심볼이어야 한다(가짜 lib/… 금지).
  assert.match(md, /--seed\s+"scripts\/(?:src\/)?lib\/graph-search\.(?:ts|js)"/);
  assert.match(md, /--seed\s+"graphSuggest"/);
  assert.doesNotMatch(md, /--seed\s+"lib\/graph-suggest"/);
  assert.doesNotMatch(md, /--seed\s+"writeScopeEvidence"/);
  // F2: 원칙 1이 배제한 일반어가 예시 --query에 남아 있으면 안 된다.
  assert.doesNotMatch(md, /--query\s+"[^"]*\bevidence\b[^"]*"/);
  assert.doesNotMatch(md, /--query\s+"[^"]*\bsuggestion\b[^"]*"/);
  assert.doesNotMatch(md, /--query\s+"[^"]*\btask\b[^"]*"/);
  assert.match(md, /--query\s+"[^"]+"/);
});

test('graphify-runner documents search-space reduction principles', () => {
  const md = readSkill('graphify-runner');
  // 4대 원칙: 허브/일반어 배제, 1~2개 진입 심볼 시드, 삭제 대상 직접 시드, 사용자 승인 전제.
  assert.match(md, /hub|허브/i);
  assert.match(md, /generic|일반어/i);
  assert.match(md, /1\s*[–-]?\s*2|one\s*(?:or|to)\s*two|진입\s*심볼/i);
  assert.match(md, /delet(?:e|ion)|삭제/i);
  assert.match(md, /user\s+confirm|사용자\s*승인|confirm[\s\S]{0,40}`affected_paths`/i);
});

test('bouncer-plan graphify-suggestions reinforces search-space reduction', () => {
  const fs = require('node:fs');
  const path = require('node:path');
  const suggestions = fs.readFileSync(
    path.join(__dirname, '..', 'skills', 'bouncer-plan', 'references', 'graphify-suggestions.md'),
    'utf8',
  );
  assert.doesNotMatch(suggestions, /--seed\s+"scripts\/bouncer"/);
  assert.match(suggestions, /hub|허브|generic|일반어/i);
  assert.match(suggestions, /1\s*[–-]?\s*2|one\s*(?:or|to)\s*two|진입\s*심볼|entry\s*symbol/i);
  assert.match(suggestions, /delet(?:e|ion)|삭제/i);
  assert.match(suggestions, /confirm|승인|affected_paths/i);
});
