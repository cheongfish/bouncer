#!/usr/bin/env node
'use strict';
// SessionStart: 구형 EPIC-/BP- context 디렉터리가 있으면 stderr로 이관 안내.
// graph 훅과 분리 — graphify 실패·비활성에 안내가 묻히지 않게 한다.
// migrate를 자동 실행하지 않으며, 예외를 삼켜 세션을 막지 않는다(항상 exit 0).
const { discoverLegacyIds, legacyIdsWarnings } = require('../scripts/lib/migrate-ids');

let raw = '';
process.stdin.setEncoding('utf8');
process.stdin.on('data', (chunk) => { raw += chunk; });
process.stdin.on('end', () => {
  let payload;
  try { payload = raw.trim() ? JSON.parse(raw) : {}; } catch (_e) { payload = {}; }
  const repoRoot = payload.cwd || process.cwd();
  try {
    const discovery = discoverLegacyIds({ repoRoot });
    for (const line of legacyIdsWarnings(discovery)) process.stderr.write(line);
  } catch (_e) { /* never block the session on legacy-id discovery failure */ }
  process.exit(0);
});
