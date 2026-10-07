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

## Out of scope
- 재측정 실행 자체와 그 결과 해석. 이 epic은 측정 대상 코드와 하네스만 바꾼다.
- vanilla 대비 품질 이득을 재는 새 벤치마크 과제 추가(`workflow-token-analysis.md` 6.1절).
- 2단계, 5장 문제(plan 승인 추론, open decisions의 ACQ 전환, print dispatch의 context-reviewer 지원), 하네스 finalize 정책 변경, Graphify 용도 전환은 Success criteria에 아직 넣지 않는다. 진행할 때 이 epic에 blueprint와 기준을 함께 추가한다.

## Blueprints
* [001 coordinator 복구 루프 제거](blueprints/001-coordinator-recovery-fixes/index.md) - `coordinator.ts`·`intent-bundle.ts` brief 해시, `seed-worktree.ts` worker seed, `coordinate`·`review record`·`dispatch print` 도움말, run·coordinator 지침의 finalize 진입, `Dockerfile.cursor` PATH를 고침
