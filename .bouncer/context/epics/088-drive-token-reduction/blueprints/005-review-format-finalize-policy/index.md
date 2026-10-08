---
type: bouncer.blueprint
title: 리뷰 기록 형식과 finalize 정책 정리
description: Lets plan and coordinator agents record context and execute review rounds from CLI help and cards alone, and lets ledger benchmarks reach finalize without responder intervention.
resource: .bouncer/context/epics/088-drive-token-reduction/blueprints/005-review-format-finalize-policy/index.md
tags:
  - bouncer
  - blueprint
  - context-review
  - review-record
  - benchmark
  - finalize
timestamp: '2026-10-08T08:28:12.599+09:00'
bouncer:
  id: '005'
  epic_id: '088'
  blueprint_id: '005'
  status: closed
  commit_type: feat
  scale: full
  review_scope: blueprint
  supersedes: []
---
# 리뷰 기록 형식과 finalize 정책 정리

Epic: [088](../../index.md)

## Intent
088-004 재측정에서 plan 에이전트는 G18 round 형식을, coordinator는 해결 전 must_fix의 finding status를 찾으려고 검증기 소스를 읽었고, ledger 정책은 사라진 finalize 선택지에 답해 두 run 모두 finalize에서 멈췄다. 이 blueprint는 두 형식을 CLI 도움말과 계약 카드에 두고, 정책·응답기·하네스를 현재 finalize 선택지에 맞춘다.

## Contract
- 인터페이스
  - `bouncer review-dispatch --help`·`-h`(서브커맨드 앞뒤 어디든)는 stdout에 도움말을 쓰고 exit 0이다. 도움말은 G18을 통과하는 context review round 1 YAML 예시 하나, finding 필수 필드, context finding status(`resolved|accepted`, `accepted`는 note 필수)·severity·context 관점 enum, 그리고 digest는 `review-dispatch plan` 출력의 `target.digest`를 옮긴다는 안내를 싣는다. `--help` 없는 기존 호출의 출력과 exit code는 그대로다.
  - `validate-sections`는 `CONTEXT_REVIEW_PERSPECTIVE`를 export한다.
  - execute 리뷰 finding status는 `resolved|accepted|deferred|open`이다. `open`은 note가 필요 없고, 리뷰 문서 status가 `accepted`면 actionability와 round 유무에 관계없이 실패다. context review status는 `resolved|accepted` 그대로다.
  - `references/coordinator-cards/{review,final_review}.md`는 finding status 표와 문서 `--status` 구분, repair wave 기록 순서, 예시 round JSON 두 개(discovery round의 `open` must_fix, 그 finding을 `resolved`로 바꾸는 delta round)를 싣는다.
  - 평가자 정책(ledger-001~004, fastify-001)은 `policy_version: 3`이다. 응답기 `loadPolicy`는 3만 받고, `finalize.remainder`에는 finalize 증거가 있을 때 권장 선택지 A로 답한다.
  - `run-bouncer-full.cjs`는 finalize 뒤 증거를 integration worktree가 아니라 integration 브랜치 ref에서 모은다.
- 데이터·상태: 리뷰 원장 모양(`rounds[]`, `findings[]`)은 바뀌지 않고 status 값 하나만 늘어난다. 정책 파일의 다른 답, run 기록 필드 이름, `verifier.json` 생성 경로는 그대로다.
- 수용 기준: epic Success criteria 6, 17~22.
- 검증 명령: 각 task `bouncer.verify`(`npm test`). Success criteria 6의 `npm run ci`(coverage 임계값, lint, lint:docs, typecheck, check:emit 포함)는 각 task Checklist 마지막 단계에서 실행하고, 머지 전 PR CI가 다시 실행한다.
- 실패 모드·엣지 케이스
  - `review-dispatch plan`이 `ok: false`면 digest가 없다. 도움말은 이때 리뷰를 부르지 않고 멈추라고 적는다.
  - `-h`가 `--` 플래그 값 자리에 오면 도움말로 보지 않는다(`review record --help`와 같은 규칙).
  - context review(G18)에 `open`이 오면 지금처럼 `status invalid`로 거절한다.
  - discovery round에서 `open` finding을 기록하면서 `--status accepted`를 주면 `review record`가 원장 bytes를 바꾸지 않고 거절한다.
  - finalize 증거(prepare·dry-run)가 없으면 응답기는 `finalize.remainder`에 답하지 않는다.
  - finalize 뒤 integration 브랜치를 찾지 못하거나, 그 ref의 blueprint가 `closed`가 아니면 run은 `stopped`다.

```mermaid
flowchart LR
  P[plan context review] --> R[run 리뷰 기록]
  R --> F[finalize remainder A]
  F --> H[브랜치 ref 증거 수집]
```

## Out of scope
- benchmark 과제 카드, rubric, verifier.
- coordinator가 repair wave를 여는 판단 기준과 `coordinate repair --review-finding`의 id 검사.
- execute reviewer 문서(`agents/bouncer-reviewer.md`, `references/review/index.md`)의 fingerprint 예시.
- ledger-v3 calibration, 재측정 실행.

## One-commit justification
- 세 task는 같은 재측정에서 나온 탐색·멈춤 원인을 하나씩 고치고, 하나의 PR로 다음 재측정의 비교 기준이 된다. 커밋은 task마다 나뉘고, 리뷰는 `review_scope: blueprint`에 따라 blueprint 범위 하나를 루트 `review.md`에서 한 번 판정한다.

## Documents
* [Tasks 001](tasks/001/tasks.md) - plan context review 도움말
* [Tasks 002](tasks/002/tasks.md) - finding status `open`과 카드 예시
* [Tasks 003](tasks/003/tasks.md) - 평가자 정책·응답기·하네스
* [Review](review.md) - 리뷰 발견사항
* [Context review](context-review.md) - 계획 문서 정합성 판정
