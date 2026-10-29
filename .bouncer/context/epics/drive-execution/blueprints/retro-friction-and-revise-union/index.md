---
type: bouncer.blueprint
title: 마찰 4건 문서 수정과 범위 개정 합집합 기본값
description: Close four run-drive friction points in role docs and make coordinate revise widen the task scope by default.
resource: .bouncer/context/epics/drive-execution/blueprints/retro-friction-and-revise-union/index.md
tags:
  - bouncer
  - blueprint
  - coordinator
  - scope-revision
  - retro
  - codex-agents
timestamp: '2026-10-29T11:22:13.335+09:00'
bouncer:
  id: retro-friction-and-revise-union
  epic_id: drive-execution
  blueprint_id: retro-friction-and-revise-union
  status: closed
  order: 72
  commit_type: feat
  scale: full
  review_scope: blueprint
  verification_policy: scoped_terminal
  review_contract: brief
  attribution: retro 마찰 4건 문서 수정과 coordinate revise 범위 개정은 bouncer-run 실행 단계 동작이다
  supersedes: []
---
# 마찰 4건 문서 수정과 범위 개정 합집합 기본값

Epic: [drive-execution](../../index.md)

## Intent
- 지난 retro가 찾은 run drive 마찰 4건(구현 worker 커밋, coordinator 보고 근거, Constraints 누락, Codex 점검 소음)을 역할 문서에서 막음.
- `coordinate revise`가 기본으로 직전 scope를 유지한 채 넓히기만 하도록 바꿔 scope 축소와 그 뒤 복원 작업의 연쇄를 없앰.

## Contract
- 인터페이스:
  - `bouncer coordinate revise`의 `--paths`와 `--new-path`는 직전 scope에 더해지는 값이다. 교체는 값 없는 boolean 플래그 `--replace`를 줄 때만 한다. 나머지 인자 의미는 그대로다.
  - 문서 계약 네 가지: direct-run implement 행은 worker에게 커밋 금지를 전하고 커밋은 advance가 만든다고 적는다. coordinator Output contract는 커밋 내용 주장에 확인 명령과 결과 발췌를 요구한다. implementer Checklist coverage는 brief Constraints 항목마다 대응 한 줄을 요구한다. `codex-agents check`와 mismatch 재시드는 Codex 호스트의 named 디스패치에만 적용한다고 적는다.

  ```text
  reviseTaskScope({ ..., replace?: boolean })
    next = replace ? (paths ∪ newPaths) : (previous ∪ paths ∪ newPaths)
    → { ok: true, revision, previous, paths, revoked?, releasedDoNotTouch?, warnings? }
    warnings(scope-paths-dropped)는 replace가 true일 때만 붙는다.
  ```
- 용어: `previous`는 원장 `entry.scope.paths`, 없으면 task 문서의 선언 `affected_paths`다. 예: 직전 `['src/auth/']`에 `--paths src/session/`를 주면 결과는 `['src/auth/', 'src/session/']`이다.
- 데이터·상태: 이 변경은 `cli-execution-scope-contract` blueprint가 확정한 "`--paths`는 scope 전체 교체" 의미를 뒤집는다. 교체는 `--replace`로만 남는다. 합집합 순서는 직전 scope, `--paths`, `--new-path`이며 `normalizeScopeEntry` 기준으로 중복을 한 번만 둔다. decision의 `previous`/`next`와 문서 `scope_revision` 기록 방식은 그대로다. `agents/*.md`를 고치면 `.codex/agents/*.toml` 생성본을 같이 다시 만든다.
- 수용 기준:
  1. direct-run implement 행이 커밋 금지와 advance 커밋을 명시하고, accepted 점검 문구가 advance가 만든 task 커밋(`Bouncer-Task` trailer 포함)을 가리킨다. `agent-dispatch.md`의 Named implementer 절에는 같은 줄을 넣지 않는다.
  2. coordinator Output contract가 커밋 내용 주장에 확인 명령과 결과 발췌를 요구하고, 확인하지 못한 주장은 `미확인`으로 쓰게 한다. root 재확인 규칙은 만들지 않는다.
  3. implementer Checklist coverage 규칙이 Constraints 항목마다 단언 테스트(`file:line`) 또는 `해당 없음: <이유>` 한 줄을 요구한다. 보고 template의 `##` 섹션 목록은 그대로다.
  4. `agent-dispatch.md`와 `rules/subagent-model.md`가 같은 점검을 Codex 호스트 named 디스패치 한정으로 적는다. Claude Code·Cursor와 Codex가 아닌 호스트는 점검 없이 compact input으로 named 디스패치한다. TASKS-001이 `test/skill-bouncer-run.test.js`에서 두 문서의 해당 문단을 단언한다.
  5. `--replace` 없이 직전보다 작은 집합을 주면 직전 scope가 유지되고 `warnings` 키가 없다. `--replace`를 주면 전달 집합으로 교체되고 줄어든 경로가 `scope-paths-dropped`로 나온다.
  6. `.codex/agents/*.toml`이 `agents/*.md` 생성본과 바이트 일치한다.
  7. `npm run ci`가 통과한다.
- 검증 명령: TASKS-001은 `node scripts/check-task.js test/agents.test.js test/subagents.test.js test/skill-bouncer-run.test.js`, TASKS-002는 `node scripts/check-task.js test/cli-coordinate.test.js test/commit-task.test.js test/cli-help.test.js test/cli-validate.test.js`, terminal TASKS-003은 `npm run ci`. 빌드는 drive 환경이 맡는다.
- 실패 모드·엣지 케이스:
  - 직전 scope가 원장에 없으면 선언 `affected_paths`가 `previous`다.
  - `--paths`와 `--new-path`가 모두 비면 `--replace` 여부와 무관하게 `scope-paths-required`이며, hint 문구도 합집합 의미로 고친다.
  - `--replace`에 값이 붙으면 usage 오류(exit 2)다.
  - `--replace`와 `--release-do-not-touch`를 함께 줄 수 있다. 해제 판정은 새 경로(직전 scope에 없던 경로) 기준 그대로다.
  - glob·추적 검사는 플래그로 받은 값에만 걸고, out-of-bounds 검사는 직전 scope 면제를 유지하며, Do not touch 충돌 검사는 바뀌지 않는다.
  - 생성 TOML이 어긋나면 `codex-agents check`가 `mismatch`를 보고한다.

## Out of scope
- 제안서의 다른 클러스터(결합 경로 탐지, CI 앞당기기, 환경 준비, light 통합, 복잡도 판정, workflow 도구화, 측정).
- affected_paths 정책(예상 경로, 금지선) 변경과 out-of-bounds, 추적, Do not touch 검사 변경.
- root가 coordinator 보고를 다시 확인하는 규칙.
- CHANGELOG, version 문서, 저장소 루트 제안서 파일 커밋.

## One-commit justification
- 문서 네 건과 revise 계약은 둘 다 run drive 마찰을 닫는 한 묶음이다. 두 commit task 모두 `agents/bouncer-coordinator.md`와 그 TOML을 고치므로 직렬로 두고, 전체 검증은 terminal task가 맡아 한 리뷰 단위로 낸다.
