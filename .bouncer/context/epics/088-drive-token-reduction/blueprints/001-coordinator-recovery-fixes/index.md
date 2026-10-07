---
type: bouncer.blueprint
title: coordinator 복구 루프 제거
description: Removes the coordinator drive's recovery loops and source lookups by fixing the brief hash, worker seed, CLI help, run-stage boundary, and benchmark PATH.
resource: .bouncer/context/epics/088-drive-token-reduction/blueprints/001-coordinator-recovery-fixes/index.md
tags:
  - bouncer
  - blueprint
  - coordinator
  - cli-help
  - worktree
timestamp: '2026-10-06T17:17:50.753+09:00'
bouncer:
  id: '001'
  epic_id: '088'
  blueprint_id: '001'
  status: closed
  commit_type: fix
  scale: full
  review_scope: blueprint
  supersedes: []
---
# coordinator 복구 루프 제거

Epic: [088](../../index.md)

## Intent
coordinator 드라이브가 정상 순서에서 `stale-worker-report`로 재디스패치하고 worker seed를 손으로 메우며 CLI 형식을 소스에서 역산하던 원인을 없앰. run 단계는 통합·검증에서 멈추고 벤치마크 컨테이너는 `bouncer`를 바로 찾게 함.

## Contract
- 인터페이스
  - task brief 해시: `tasks.md`에서 `bouncer.status`와 `bouncer.commit_sha`를 뺀 정규형의 SHA-256. `coordinate dispatch`·`record`와 `intent bundle`이 같은 함수 하나를 쓴다. 다른 frontmatter 키와 본문은 해시에 들어간다.
  - `seedCoordinatorWorker` 성공 결과의 `seeded`에 epic `index.md`와 `.bouncer/context/index.md`가 base에 있을 때 들어간다.
  - `bouncer coordinate <sub> --help`, `bouncer review record --help`, `bouncer dispatch print --help`: stdout, exit 0. 필수 인자 검사보다 먼저 처리한다. 필수 플래그 누락(exit 2)은 stderr에 기존 오류 줄과 해당 서브커맨드 usage를 함께 쓴다.
  - `/bouncer-run`·coordinator 지침: closing action이 없다. 터미널 보고는 사용자에게 `/bouncer-finalize` 실행을 안내한다.
- 데이터·상태
  - 원장 스키마와 reason 집합은 바뀌지 않는다. 원장에 저장되는 `task_brief_hash` 값의 정의만 바뀐다.
- 수용 기준: epic Success criteria 1~6.
- 검증 명령: 각 task `bouncer.verify`. 머지 전 `npm run ci`는 PR CI가 실행한다.
- 실패 모드·엣지 케이스
  - 업그레이드 전에 열린 attempt는 record에서 `stale-worker-report`를 한 번 받고, 기존 복구(재디스패치)로 진행한다.
  - frontmatter가 없거나 파싱되지 않는 `tasks.md`는 해시 계산이 오류를 던지고 dispatch·record가 원장을 쓰지 않는다. CLI는 기존 예외 경로대로 stderr `coordinate: <message>`, exit 1로 끝난다.
  - YAML 키 순서·인용 방식만 다른 재직렬화는 해시를 바꾸지 않는다.
  - base에 epic·context index가 없으면 seed는 그 파일을 건너뛰고 성공한다.
  - `--help`가 다른 플래그와 함께 오면 다른 플래그를 무시하고 도움말만 출력한다. 다른 플래그의 값 자리에 온 `-h`는 도움말로 보지 않는다.

## Out of scope
- 2단계 상태 기계(`bouncer run next`), 단계별 계약 카드, 과제 크기별 절차.
- plan 승인 추론, open decisions의 ACQ 전환, print dispatch의 context-reviewer 지원.
- 벤치마크 하네스 finalize 정책과 수집 경로, 재측정 실행.
- `coordinate` 서브커맨드의 동작·reason·출력 JSON 변경(도움말 텍스트 제외).

## One-commit justification
- PR 하나로 리뷰하는 1단계 묶음이고 task마다 한 커밋이 된다. TASKS-003과 TASKS-005만 `agents/bouncer-coordinator.md`와 그 TOML을 함께 바꾸며, `depends_on`이 003 → 005 순서를 고정한다. 1단계 효과는 다섯 수정이 함께 들어간 상태에서 재측정해야 판단할 수 있다.

## Documents
* [Tasks 001 — brief 해시에서 lifecycle 키 제외](tasks/001/tasks.md) - 공유 해시 함수, dispatch·record·intent bundle 적용, 회귀 테스트
* [Tasks 002 — worker seed에 index 추가](tasks/002/tasks.md) - epic·context index seed, 회귀 테스트
* [Tasks 003 — 서브커맨드 도움말](tasks/003/tasks.md) - `--help`·누락 usage, 입력 JSON 예시, 지침 한 줄
* [Tasks 004 — 벤치마크 셸 PATH](tasks/004/tasks.md) - profile.d·bashrc PATH
* [Tasks 005 — run 단계 경계](tasks/005/tasks.md) - closing action 제거, 보고 안내
* [Verification](tasks/001/verification.md) - 검증 명령과 증적
* [Review](review.md) - 리뷰 발견사항
* [Context review](context-review.md) - 계획 문서 정합성 판정
