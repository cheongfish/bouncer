---
type: bouncer.epic
title: 드라이브·계획 리뷰 비용 절감과 실행 출처 보강
description: Cut drive restart and plan review costs, fix environment and output faults, and close worker report and role provenance gaps with measured effects.
resource: .bouncer/context/epics/drive-plan-cost-control/index.md
tags:
  - bouncer
  - epic
  - coordinator
  - context-review
  - drive-metrics
  - provenance
timestamp: '2026-10-13T10:42:05.623+09:00'
bouncer:
  id: drive-plan-cost-control
  epic_id: drive-plan-cost-control
  status: approved
  supersedes: []
---
# 098 드라이브·계획 리뷰 비용 절감과 실행 출처 보강

## Intent
직렬 드라이브의 coordinator 재기동, 작은 계획의 다중 context review 호출, 오래된 빌드와 `advance` 출력 오류가 구현과 무관한 비용을 만들고, worker 보고·SHA·역할 경계의 출처는 원장과 이력에 구조화되어 남지 않는다.
CLI가 계측·세션 경계·출처 검사를 결정적으로 처리하고 모델 판단은 보존하며, 효과는 기록된 측정값으로 확인한다.

## Success criteria
1. coordinator 자동 action(prepare·fan-in integrate·verification_node·supplement)이 `npm ci`를 실행해도 `bouncer coordinate advance`가 받는 자식 stdout은 단일 JSON 객체이고, 실제 launcher 경로 테스트가 이를 고정한다. `prepareDependencies`의 기본 `stdio:'inherit'`은 그대로다.
2. coordinator 역할 문서는 `unclear-result` 뒤 `coordinate next` 또는 `coordinate status`로 상태를 확인하기 전에 같은 mutation을 다시 실행하지 않는다고 명시한다.
3. `npm run build`가 `scripts/lib/.build-stamp`에 소스 해시를 기록하고, `scripts/src`가 있는 checkout에서 해시가 다르면 `scripts/bouncer`와 `scripts/bouncer-root`가 `stale-build`와 복구 명령을 출력하고 0이 아닌 코드로 끝난다. `scripts/src`가 없는 배포본은 검사를 생략한다.
4. fan-in이 만든 integration 커밋에 `Bouncer-Worker-Commit: <worker sha>` trailer가 있고, coordinator 출력 계약과 finalize digest가 worker SHA와 integration SHA를 출처와 함께 구분해 표시한다.
5. `.bouncer/runtime/drive-metrics.json`에 coordinator 세션별 시작·종료 원장 snapshot(decision 수·완료 task·원장 hash), 처리 task, 예외 판단 수, 토큰, 시간이 기록되고, plan context-review 호출별 perspective·target digest·토큰·시간이 기록되며, `coordinate status` checkpoint가 coordinator 세션을 `sessions[]`로 노출한다. 가격표나 토큰 분리값이 없으면 비용 대신 누락 사유가 기록된다.
6. full 드라이브의 `coordinate report`는 worker 보고 파일(`<worker>/.bouncer/runtime/reports/<task>-<attempt>.md`)에 Brief revision이 없으면 `report-revision-missing`으로 거절하고 활성 dispatch 값으로 보완하지 않는다. `open_choices[]`·`known_weaknesses[]`가 원장에 저장되고 finalize digest·PR 초안·explain 지침에 노출된다.
7. `references/coordinator-cards/report.md`에 보고 수락 전 blueprint Contract의 저장 위치·상태 소유권·인터페이스 문구와 보고의 변경 파일·편차를 대조하는 항목과, 불일치면 `accepted` 대신 `rework` 또는 `scope_revision`을 고르라는 문구가 있다.
8. `coordinate integrate`는 integration checkout에 seed manifest 경로와 integrated task evidence 경로 밖의 미커밋 변경이 있으면 `integration-source-mutated`로 거절하고, worker 커밋 diff 경로와 보고의 변경 파일이 다르면 실패 없이 경고한다.
9. `coordinator.waves_per_session`(기본 `auto`=상한 4, 정수 1–8, 잘못된 값은 prepare 차단)에 따라 직렬·무예외 wave는 같은 coordinator 세션에서 이어진다. 세션 경계는 root가 디스패치 전에 실행하는 `coordinate session-open`의 원장 `session` 결정이고, `coordinate next`는 상한 도달·직전 wave 예외·다음 wave 폭 2 이상에서 `prepare` 대신 `yield`를, `coordinate advance`는 `yield` 정지 사유를 돌려준다. verification 노드만 남은 wave는 yield하지 않고 같은 세션에서 실행된다.
10. `bouncer run preflight`가 `drive_shape`(serial·parallel·mixed)와 최대 wave 폭·commit task 수·위험 합집합·`parallel_safe` 수를 내고, plan gate는 인접 task 경로 중첩률 0.5 이상인 길이 3 이상 직렬 체인과 경로가 겹치지 않는 직렬 의존 edge를 실패 없는 경고로 표시한다.
11. `bouncer run preflight`의 `direct_eligible`은 full 원장·`drive_shape: serial`·열린 commit task 수 ≤ `coordinator.direct_max_commit_tasks`(기본 3, 0이면 끔)일 때만 true이고, 테스트가 이 경계를 고정한다. `/bouncer-run` 시작 ACQ는 그때만 직접 실행 선택지를 보이며 권장은 coordinator에 둔다. `skills/bouncer-run/references/direct-run.md`는 root가 정상 판단을 카드대로 기록하고, accepted가 아닌 판단이나 예외 정지에서는 그 판단을 원장에 기록하지 않고 coordinator에 넘기며(인계 디스패치 전 `coordinate session-open`의 `session` 결정만 남는다), root 직접 구현을 금지한다고 명시한다. `light-run.md`는 바뀌지 않는다.
12. 직렬 4-task fixture 생성 스크립트·측정 절차·기록 문서가 `benchmarks/drive-serial-4/`(`setup.cjs`, `README.md`, `results.md`)에 있다. 기록 문서는 기준선·다중 wave·직접 실행과 plan context review 변경 전후 결과 행을 `미측정`으로 두고, wave 상한 4와 N 3을 잠정값으로 표시한다. 실제 측정값과 최종 상한·N은 merge 뒤 사용자가 fixture를 실행해 같은 문서에 기록하며, 측정하지 못한 값은 사유와 함께 미확인으로 남는다.
13. plan context review의 필수 판단은 문서 정합성·범위(`cross_document`)와 검증 가능성(`success_criteria`)이고, commit task 3개 이하는 `combined` 한 번으로 dispatch된다. 기존 `korean_quality`·`scope` 기록은 읽기 호환되고 새 dispatch는 만들지 않는다.
14. Touch의 Modify·Delete·Rename 경로가 저장소에 없고 선행 task가 만드는 경로도 아니면 plan gate가 새 G 코드로 실패한다. context reviewer rubric은 Contract 저장 위치·상태 소유권과 task 브리프 문구의 대조, 보안 위험 표시 누락 확인을 포함하고, plan gate는 보안 경로 분류에 걸리는 Touch에 빈 `review_risk`를 경고한다.
15. 각 BP의 최종 검증은 `npm run ci`이고, 바뀐 `agents/*.md`마다 `.codex/agents/*.toml`이 생성 결과와 바이트 단위로 같으며, 진입 skill 단어 수 합계가 기준선 8665 미만이고, CHANGELOG.md `Unreleased`에 해당 BP 변경이 기록된다.

## Out of scope
- reviewer 모델·수 변경과 096의 cycle·restart 1회·delta 계약 변경.
- light 모드(`scale: light`, `promote-stop`)의 의미 변경과 root 직접 구현 허용.
- 과거 세션 원문·토큰의 재구성. 확보하지 못한 증거는 미확인으로 기록한다.
- 자동 승인, 게이트 생략, 검증 증거 수기 작성.
- `prepareDependencies` 기본 stdio 변경과 finalize 설치 경로 변경.

## 작업 추적
| 작업 | 내용 | BP |
| --- | --- | --- |
| W04 | 개발 checkout stale build 감지 | 001 |
| W05 | worker 보고 출처 검사와 열린 선택·약점 구조화 | 001 |
| W07 | 세션별 토큰·진행 계측 | 001 |
| W08 | 보고 수락 시 Contract·구현 대조 | 001 |
| W10 | `advance` `unclear-result` 원인 수정 | 001 |
| W11 | coordinator 직접 수정 감지 | 001 |
| W12 | worker/integration SHA 출처 표기 | 001 |
| W01 | 다중 wave coordinator 세션 | 002 |
| W02 | 짧은 직렬 체인 직접 실행 | 002 |
| W03 | 계획 단계 DAG 피드백 | 002 |
| W06 | 보안 위험 표시 확인 | 003 |
| W09 | 저장 위치·상태 소유권 대조 | 003 |
| W13 | plan context review 관점 통합과 호출 축소 | 003 |

BP 002와 003은 BP 001이 대상 base에 통합된 뒤 별도 `/bouncer-plan`으로 이 epic에 추가한다.

## Blueprints
* [001 드라이브 기반 안정화와 실행 출처·계측](../drive-execution/blueprints/drive-foundation-provenance/index.md) - `advance` 출력 오염, stale build, SHA 출처, 세션 계측, worker 보고 구조화, integrate 역할 경계를 coordinator·launcher·finalize에서 고친다.
* [002 직렬 드라이브 세션 연속과 DAG 모양 판단](../drive-execution/blueprints/serial-drive-shape/index.md) - coordinate next·advance에 세션 경계와 `yield`를, preflight·plan gate에 DAG 모양 계산과 경고를, `/bouncer-run`에 짧은 직렬 체인 직접 실행을 더하고 측정 fixture를 둔다.
* [003 plan context review 관점 통합과 기계 검사 이관](../drive-execution/blueprints/plan-review-focus/index.md) - plan context review를 정합성·범위와 검증 가능성 두 판단으로 줄여 commit task 3개 이하는 한 번에 리뷰하고, Touch 경로 존재(G25)와 보안 위험 표시 누락 경고를 plan gate로 옮기며, seeded fixture로 탐지를 잰다.
