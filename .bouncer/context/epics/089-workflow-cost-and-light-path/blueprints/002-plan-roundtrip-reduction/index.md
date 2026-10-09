---
type: bouncer.blueprint
title: plan 왕복 축소와 light 선택 신호
description: Reduce plan round-trips by batching independent questions, ordering declaration and approval, adding light routing signals to plan inspect, and defining partial context re-review.
resource: .bouncer/context/epics/089-workflow-cost-and-light-path/blueprints/002-plan-roundtrip-reduction/index.md
tags:
  - bouncer
  - blueprint
  - plan
  - light
  - context-review
timestamp: '2026-10-09T21:12:43.205+09:00'
bouncer:
  id: '002'
  epic_id: '089'
  blueprint_id: '002'
  status: closed
  commit_type: feat
  scale: full
  review_scope: blueprint
  supersedes: []
---
# 002 plan 왕복 축소와 light 선택 신호

Epic: [089](../../index.md)

## Intent
- 문제: plan은 독립 질문을 나눠 묻고, 단계 사이로 해결된 탐색 결과를 다시 넘기며, 보완 context review도 매번 전체 문서를 다시 읽힌다. light 선택은 사용자 판단 외에 근거 신호가 없다.
- 완료 조건: 독립 질문은 한 메시지로 묶이고, 단계 간에는 현재 계획·미결 결정·변경 요약만 전달되며, `plan inspect`가 light 추천 근거를 내고, context review 후속 라운드가 변경 부분만 받을 수 있는 조건이 CLI에 있다.

## Contract
- 인터페이스: `bouncer plan inspect --blueprint <dir>`(선택)이 `routing` 필드를 추가한다. 없으면 `routing: null`이다. `routing`은 `{ advisory: true, tasks: number, dependencies: number, modules: string[], riskPaths: Array<{ path, kind }>, recommendation: 'light-candidate'|'full-candidate', reasons: string[] }`다. `kind`는 `security`·`manifest`·`build`·`migration` 중 하나다.
- `bouncer review-dispatch plan --blueprint <dir> [--previous <file>]` 응답에 `parts`(문서 경로별 본문 sha256), `scope_parts`(task별 `affected_paths`·`depends_on`와 `## Interface`·`## Touch` 절 본문의 sha256), `follow_up: 'partial'|'full'`, `changed_documents`를 더한다. 이 필드는 `strategy`가 `single`·`clustered`인 성공 응답에만 있고 `skip`과 실패 응답에는 없다. 집계 digest 계산은 바뀌지 않는다.
- 데이터·상태: 라운드 mode enum(`discovery|delta`)과 G18 검사 형식은 바뀌지 않는다. `--previous`는 이전 dispatch payload를 저장한 파일이며, `partial`이면 delta 입력 규칙을 따르고 `full`이면 round 1 discovery를 다시 시작한다.
- 수용 기준: 에픽 Success criteria 4·5·6.
- 검증 명령: `npm run build && node --test test/plan-inspect.test.js test/review-dispatch.test.js test/validate-gates.test.js test/cli-validate.test.js test/skill-bouncer-plan.test.js test/skill-context-review.test.js test/skill-discovery.test.js test/acq-gate-ids.test.js test/lightweight-cycle.test.js test/skill-bouncer-surface.test.js`
- 실패 모드·엣지 케이스: 신호는 선택을 바꾸지 않는다(`recommendation`이 `light-candidate`여도 선언이 없으면 full). 삭제·이름 변경은 `affected_paths`에서 알 수 없으므로 신호에서 제외한다. 진입 SKILL 단어 수가 baseline 합계를 넘기지 않게 새 규칙은 reference에 둔다. task가 추가·삭제되거나 task의 Interface·Touch 절이 바뀌면 항상 `full`이다.

## Out of scope
- 선택 자동화와 자동 승인. ACQ gate id·순서 변경.
- context review 라운드 mode 추가와 G18 형식 변경.
- 벤치마크 응답기 fixture 수정.

## One-commit justification
- 세 task가 모두 plan 단계의 왕복 축소이며 `rules/planning.md`의 같은 절을 정합하게 고친다. 하나의 PR로 리뷰해야 용어 충돌이 없다.

## Documents
* [Tasks 001](tasks/001/tasks.md) - 질문 묶음과 선언·승인 순서
* [Tasks 002](tasks/002/tasks.md) - `plan inspect` light 신호
* [Tasks 003](tasks/003/tasks.md) - context review 후속 라운드 조건
* [Verification](tasks/001/verification.md) - 검증 명령과 증적
* [Review](review.md) - 리뷰 발견사항
* [Context review](context-review.md) - 계획 문서 정합성 판정
