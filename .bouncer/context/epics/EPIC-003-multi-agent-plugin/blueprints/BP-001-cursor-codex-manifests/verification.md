---
type: bouncer.verification
title: BP-001 verification
description: Verification for BP-001
resource: .bouncer/context/epics/EPIC-003-multi-agent-plugin/blueprints/BP-001-cursor-codex-manifests/verification.md
tags:
  - bouncer
  - verification
timestamp: '2026-07-27T16:58:12.166+09:00'
bouncer:
  id: VERIFY-BP-001
  epic_id: EPIC-003
  blueprint_id: BP-001
  status: pending
---
# Verification

## Spike

확인 방법: 공개 문서 + 로컬 설치물 실측. 추측한 항목은 README 한계로 적었다.

| 항목 | 결과 | 출처 |
| --- | --- | --- |
| Cursor 훅 플러그인 루트 | 공개 문서에 플러그인 루트 env 없음. 훅 커맨드는 플러그인 루트 기준 **상대 경로**. 훅 실행 시 `CURSOR_PROJECT_DIR` 등만 문서화됨 | https://cursor.com/docs/hooks ; 설치 플러그인 `superpowers`의 `hooks/hooks-cursor.json` |
| Cursor `beforeShellExecution` 입력 | `command`, `workspace_roots[]`, `cwd`, `hook_event_name` | https://cursor.com/docs/hooks ; GitButler deep dive |
| Cursor 거부 응답 | stdout JSON `{ permission: "allow"\|"deny"\|"ask", userMessage?, agentMessage? }` (exit 2도 deny와 동등) | https://cursor.com/docs/hooks ; https://cursor.com/docs/reference/third-party-hooks |
| Codex 플러그인 루트 | 훅 실행 시 `PLUGIN_ROOT` / `PLUGIN_DATA`. 호환 별칭으로 `CLAUDE_PLUGIN_ROOT` / `CLAUDE_PLUGIN_DATA`도 설정 | https://developers.openai.com/codex/plugins/build ; https://developers.openai.com/codex/hooks |
| Codex 훅 이벤트 | Claude와 같은 `PreToolUse`/`PostToolUse`/`SessionStart` 등. 셸은 matcher `Bash`. 차단은 exit `2`+stderr 또는 `permissionDecision: "deny"` | https://developers.openai.com/codex/hooks |
| Codex 매니페스트 `hooks` 키 | 공식 `validate_plugin.py` `allowed_keys`에 `hooks`/`commands` 없음 — 선언하면 검증 실패. 문서상 `hooks/hooks.json`은 **기본 탐색** | `~/.codex/skills/.system/plugin-creator/scripts/validate_plugin.py` 실측; 문서 기본 경로 |

확정 표현:

- 명령 셸: `BOUNCER_ROOT="${BOUNCER_HOME:-${CLAUDE_PLUGIN_ROOT:-${PLUGIN_ROOT:-}}}"`
- `hooks/hooks.json`: `${CLAUDE_PLUGIN_ROOT}` 유지 (Claude 네이티브 + Codex 호환 별칭). Cursor는 이 파일을 읽지 않음.
- Cursor 훅: `./hooks/...` 상대 경로.

## Command
<command>

## Evidence
<result>
