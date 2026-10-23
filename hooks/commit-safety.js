#!/usr/bin/env node
'use strict';
// PreToolUse hook: guards every `git commit` in the worktree against the
// active blueprint's affected_paths. Blocks by exiting 2 with the reason on
// stderr (Claude Code block semantics); allows by exiting 0.
//
// 판정은 공개 `bouncer commit-guard --command-stdin` CLI가 한다. 훅은 commit 가능성이
// 없는 명령과 Bouncer 컨텍스트가 없는 저장소를 런타임 없이 통과시키고, commit
// 가능성이 있는데 런타임이 없거나 실패하면 막는다(runtime-cli.js의 decideCommit).
const { decideCommit } = require('./runtime-cli');

let raw = '';
process.stdin.setEncoding('utf8');
process.stdin.on('data', (chunk) => { raw += chunk; });
process.stdin.on('end', () => {
  let payload = {};
  // 파싱할 수 없는 payload는 판정할 명령이 없으므로 허용한다(기존 계약).
  try { payload = raw.trim() ? JSON.parse(raw) : {}; } catch (_e) { process.exit(0); }
  // payload가 JSON `null` 등이면 프로퍼티 접근이 throw한다. 판정 전 throw도 통과가
  // 아니라 차단이어야 하므로(exit 1은 비차단) 여기서 exit 2로 바꾼다.
  let command;
  let repoRoot;
  try {
    command = payload.tool_input && typeof payload.tool_input.command === 'string'
      ? payload.tool_input.command : '';
    repoRoot = payload.cwd || process.cwd();
  } catch (_e) {
    process.stderr.write('commit-safety: unexpected error (bad payload); commit blocked\n');
    process.exit(2);
  }
  const result = decideCommit(command, repoRoot);
  if (result.block) {
    process.stderr.write(`${result.reason}\n`);
    process.exit(2);
  }
  process.exit(0);
});
