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

## Spike findings
체크리스트 1번이 요구한 확인. 문서만으로는 확정되지 않아 **로컬에 설치된 실물**을
읽어 확인했다.

- **Cursor 훅 경로 — 환경변수 불필요.** 설치된 공식 플러그인
  `~/.cursor/plugins/cache/cursor-public/superpowers/<hash>/hooks/hooks-cursor.json`이
  `"command": "./hooks/session-start"`을 쓴다. 플러그인 루트 기준 상대 경로가
  동작한다는 뜻이므로 훅에는 루트 토큰 문제가 없다. 같은 플러그인의
  `.cursor-plugin/plugin.json`이 `"hooks": "./hooks/hooks-cursor.json"`으로 Claude용
  `hooks/hooks.json`과 분리하는 방식도 여기서 확인했다.
- **Cursor `beforeShellExecution` 프로토콜.** 입력은
  `{ command, workspace_roots, hook_event_name }`, 출력은 stdout JSON
  `{ permission: "allow"|"deny"|"ask", userMessage?, agentMessage? }`.
  출처: <https://cursor.com/docs/reference/plugins> 및 타입 정의
  <https://github.com/johnlindquist/cursor-hooks>. `cwd`가 없어 어댑터는
  `workspace_roots[0]`를 저장소 루트로 쓴다 — 회귀 테스트로 고정했다.
- **Codex 매니페스트는 `hooks`/`commands`를 받지 않는다.** 로컬 Codex 0.145의 공식
  검증기 `~/.codex/skills/.system/plugin-creator/scripts/validate_plugin.py`의
  `allowed_keys`는 `id, name, version, description, skills, apps, mcpServers,
  interface, author, homepage, repository, license, keywords`뿐이고, 동봉된
  `references/plugin-json-spec.md`도 "Validation rejects unsupported manifest
  fields such as `hooks`"라고 명시한다. 따라서 Codex 플러그인으로는 4개 명령도
  커밋 가드도 노출할 수 없어 BP-002로 분리했다 (tasks.md `## Deviations`).

`npm run lint`은 이 worktree에 `node_modules`가 없어 전역 ESLint 6이 잡히고 flat
config를 읽지 못한다. 이 변경과 무관한 환경 제약이며, 설정된 verify 명령은
`npm test`다.

## Command
<command>

## Evidence
<result>
