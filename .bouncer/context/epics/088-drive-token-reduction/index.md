---
type: bouncer.epic
title: 드라이브 토큰 비용 절감
description: Cut Bouncer drive token cost by removing coordinator recovery loops and source lookups first, then restructuring the drive, while fixing the approval and review issues found during the 1.5.4 remeasurement.
resource: .bouncer/context/epics/088-drive-token-reduction/index.md
tags:
  - bouncer
  - epic
  - coordinator
  - token-cost
  - benchmark
timestamp: '2026-10-06T17:17:50.659+09:00'
bouncer:
  id: '088'
  epic_id: '088'
  status: approved
  supersedes: []
---
# 드라이브 토큰 비용 절감

## Intent
- 문제: `workflow-token-analysis.md`의 1.5.4 재측정에서 bouncer-full은 vanilla보다 처리량을 70~100배 썼다. run coordinator 한 세션이 실행 전체의 40~50%를 차지했고, 그 셸 명령의 절반은 CLI 사용법을 소스에서 역산하는 명령과 Bouncer 버그를 복구하는 루프였다.
- 목표: 먼저 복구 루프와 소스 역산을 없애고(1단계), 그다음 coordinator 루프를 CLI 상태 기계로 옮긴다(2단계). 같은 재측정에서 확인한 승인 추론·리뷰 독립성 문제와 벤치마크 하네스 후속 과제도 이 epic에서 blueprint로 더한다.

## Success criteria
1. coordinator 드라이브의 정상 순서(report → commit → record)에서 record가 `stale-worker-report`로 거절되지 않는다. brief 본문이나 brief 내용 frontmatter(`affected_paths`, `verify`, `depends_on` 등)가 바뀌면 여전히 거절된다.
2. coordinator worker worktree에서 수동 복사 없이 execute 게이트가 통과한다.
3. `bouncer coordinate <sub> --help`, `bouncer review record --help`, `bouncer dispatch print --help`가 exit 0으로 해당 서브커맨드의 플래그, 허용값, 입력 형식을 출력한다. 입력이 JSON 파일인 `review record --round`는 그대로 기록되는 JSON 예시를 함께 출력한다.
4. `/bouncer-run`과 coordinator는 모든 task를 통합·검증한 뒤 멈추고, `/bouncer-finalize`를 직접 진행하지 않는다.
5. Cursor 벤치마크 `bouncer` 이미지가 로그인 셸 프로필(`/etc/profile.d`)과 `node`의 `.bashrc`에 플러그인 `scripts` 경로를 넣는다. 정적 테스트가 Dockerfile을 판정하고, 컨테이너의 `bash -lc`·`bash -c` 확인 결과는 작업 보고에 남긴다.
6. 각 blueprint는 `npm run ci`를 통과하고 CHANGELOG `[Unreleased]`에 항목을 남긴다.
7. `bouncer coordinate next --blueprint <dir> [--task <NNN>]`는 원장 bytes와 worktree를 바꾸지 않고, 지금 실행할 행동 하나와 fence·lease를 채운 `argv`를 돌려준다.
8. 정상 경로 fixture 두 개(commit task 2개와 verification node의 per-task review 모드, blueprint review 모드)에서 `coordinate next`의 `argv` 실행과 worker 단계 흉내만 반복하면 `done`에 도달한다.
9. coordinator 지침의 Procedure는 `coordinate next` 호출, `argv` 실행, `judge` 항목 판단의 반복이고, commit 단계를 명시한다.
10. `coordinate next` 응답은 `judge`가 있거나 worker를 띄우는 행동과 `blocked`에만 해당 계약 카드 본문을 `card`로 싣고, 그 밖의 행동에는 `card` 키가 없다.
11. coordinator 지침과 생성 TOML에 `skills/bouncer-execute/references/` 세 문서의 경로와 그것을 읽으라는 지시가 없고, Worker dispatch·Task round의 drive 세부 규칙은 `references/coordinator-cards/`에 있다.
12. 카드와 execute reference 양쪽에 걸리는 규칙(리뷰 상한 discovery·fix·delta 각 1회, debugger 1회, stale Brief revision 처리, CLI `perspectives` 순서 권위)이 테스트로 일치한다.
13. execute 게이트와 `bouncer verify`는 verify가 통과하면 lease·pointer가 가리키는 `ready` commit task의 `tasks.md`를 `verified`로 바꾼다. verify 실패, lease·pointer 없이 listing에서 고른 task, `execution_kind: verification` task, `ready`가 아닌 상태, integration worktree의 terminal verification은 상태를 바꾸지 않는다.
14. verify 카드와 `skills/bouncer-execute/SKILL.md`에 task 상태를 손으로 바꾸라는 지시가 없다.
15. implement·review·final_review 카드는 print dispatch `--input` 텍스트 템플릿(항목과 순서)을 싣고, `bouncer dispatch print`가 역할 본문을 붙이므로 역할 문서를 읽지 않는다고 적는다. 테스트가 섹션 존재, 역할 문서를 읽지 않는다는 문장, 템플릿 항목 순서를 확인한다.
16. `bouncer review record --help`의 round 예시가 blueprint 리뷰 모드의 `task_brief_hashes`와 `intent_bundles`를 보여준다.
17. `bouncer review-dispatch plan --help`와 `-h`는 exit 0으로 G18을 통과하는 round 1 예시(round 필드와 finding 필드), context finding status·severity·관점 enum, 현재 snapshot digest를 `review-dispatch plan` 출력의 `target.digest`에서 옮긴다는 안내를 출력한다. 테스트가 그 예시에 해당 digest를 넣은 `context-review.md`로 plan 게이트 G18 통과를 확인한다.
18. plan context-review reference 두 문서에 digest를 손으로 계산하는 절차가 없고, fingerprint 예시가 `context:` 접두사와 context 관점 category를 쓴다.
19. execute 리뷰 finding status에 `open`이 있다. 문서 status가 `accepted`이면서 `open` finding이 남으면 `review record`가 거절하고, context review(G18)는 `open`을 계속 거절한다.
20. review·final_review 카드는 finding status 값과 의미를 문서 `--status`와 나눠 적고, `open` must_fix가 남은 discovery round와 그 finding을 `resolved`로 바꾸는 delta round 예시 JSON을 싣는다. 테스트가 두 예시를 차례로 `review record`에 넣어 둘 다 성공하는지 확인한다.
21. ledger-001~004·fastify-001 평가자 정책은 `policy_version` 3이고, `finalize.remainder` 답이 A(`finalize --yes` 커밋과 worktree 제거)이며, `finalize.next_blueprint` 항목이 없고, `approval_record`에 2026-10-08 사용자 승인이 있다. 응답기는 `policy_version` 3만 받고, v088004-1 finalize 질문 fixture에 finalize 증거가 있으면 A로, 없으면 답하지 않는다.
22. `run-bouncer-full.cjs`는 finalize 뒤 integration worktree가 없어도 finalize 전에 기록한 integration 브랜치 ref에서 closed blueprint, HEAD, `diff.patch`를 모은다. 그 브랜치를 찾지 못하면 run을 `stopped`로 끝낸다.

## Out of scope
- 재측정 실행 자체와 그 결과 해석. 이 epic은 측정 대상 코드와 하네스만 바꾼다.
- vanilla 대비 품질 이득을 재는 새 벤치마크 과제 추가(`workflow-token-analysis.md` 6.1절).
- 2단계 중 과제 크기별 절차, 5장 문제(plan 승인 추론, open decisions의 ACQ 전환, print dispatch의 context-reviewer 지원), Graphify 용도 전환은 Success criteria에 아직 넣지 않는다. 진행할 때 이 epic에 blueprint와 기준을 함께 추가한다.

## Blueprints
* [001 coordinator 복구 루프 제거](blueprints/001-coordinator-recovery-fixes/index.md) - `coordinator.ts`·`intent-bundle.ts` brief 해시, `seed-worktree.ts` worker seed, `coordinate`·`review record`·`dispatch print` 도움말, run·coordinator 지침의 finalize 진입, `Dockerfile.cursor` PATH를 고침
* [002 coordinator 다음 행동 CLI](blueprints/002-coordinator-next-action/index.md) - `coordinate-next.ts` 읽기 전용 행동 판정과 `coordinate next` 서브커맨드, `agents/bouncer-coordinator.md` Procedure를 `next` 루프로 바꿈
* [003 coordinator 계약 카드](blueprints/003-coordinator-contract-cards/index.md) - `references/coordinator-cards/` 행동별 drive 계약과 `coordinate-next.ts`의 `card` 첨부, `agents/bouncer-coordinator.md`에서 execute reference 읽기를 걷어냄
* [004 coordinator 지침 탐색 제거](blueprints/004-coordinator-lookup-removal/index.md) - `verification.ts` verify 통과 시 commit task `verified` 전환, implement·review·final_review 카드의 print dispatch 입력 템플릿, `review record --help` round 예시
* [005 리뷰 기록 형식과 finalize 정책](blueprints/005-review-format-finalize-policy/index.md) - `review-dispatch plan --help` context review 예시, `review record` finding status `open`과 review·final_review 카드 예시, ledger 평가자 정책 `finalize.remainder`·응답기·`run-bouncer-full.cjs` 증거 수집을 고침
