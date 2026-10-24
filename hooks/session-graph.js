#!/usr/bin/env node
'use strict';
// SessionStart hook: 공개 `bouncer graph-sync`를 저장소 루트에서 실행하고, 결과 JSON의
// `warnings`를 stderr에 그대로 쓴다. 경고 문구 정본은 런타임의 graphSyncWarnings 한
// 곳이라 이 훅은 문구를 복제하지 않는다. 런타임이 없거나 실패해도 세션을 막지 않는다
// — 어떤 경우에도 exit 0이고 stdout에는 아무것도 쓰지 않는다.
const { runRuntime } = require('./runtime-cli');

let raw = '';
process.stdin.setEncoding('utf8');
process.stdin.on('data', (chunk) => { raw += chunk; });
process.stdin.on('end', () => {
  let payload;
  try { payload = raw.trim() ? JSON.parse(raw) : {}; } catch (_e) { payload = {}; }
  const repoRoot = (payload && payload.cwd) || process.cwd();
  // argv는 고정 리터럴이고 repoRoot는 spawn cwd로만 간다(graph-sync는 --repo 없으면 cwd 사용).
  // 시간 제한은 두지 않는다: 그래프 갱신은 오래 걸릴 수 있고 호스트가 훅 timeout을 관리한다.
  // runRuntime은 PATH 탐색의 권한 오류(EACCES)나 비문자열 cwd(spawn TypeError)로 throw할
  // 수 있다. SessionStart는 어떤 경우에도 exit 0이어야 하므로 모든 throw를 경고 한 줄로
  // 바꾼다 — 세션을 막는 것보다 경고가 안전하다.
  let r;
  try {
    r = runRuntime(['graph-sync'], { cwd: repoRoot });
  } catch (e) {
    process.stderr.write(`session-graph: bouncer graph-sync failed (${(e && (e.code || e.name)) || 'unknown'})\n`);
    process.exit(0);
  }
  if (!r.found) {
    process.stderr.write(
      'session-graph: bouncer runtime not found; put the bouncer CLI on PATH or set BOUNCER_BIN to its '
      + 'absolute path\n',
    );
    process.exit(0);
  }
  let result;
  try {
    result = JSON.parse(r.stdout);
  } catch {
    // JSON.parse는 SyntaxError만 던지지만 훅은 exit 0을 지켜야 하므로 어떤 오류든
    // result를 비워 아래에서 실패 사유 한 줄을 남기게 한다. graph-sync는 exit 1이어도
    // JSON을 내므로 파싱 실패는 런타임 자체의 실패다.
    result = null;
  }
  if (result && Array.isArray(result.warnings)) {
    for (const line of result.warnings) process.stderr.write(String(line));
  } else {
    const first = String(r.stderr).split('\n').find((l) => l.trim() !== '') || '';
    const label = r.status === null ? (r.signal || (r.error && r.error.code) || 'unknown') : r.status;
    process.stderr.write(`session-graph: bouncer graph-sync failed (${label})${first ? `: ${first}` : ''}\n`);
  }
  process.exit(0);
});
