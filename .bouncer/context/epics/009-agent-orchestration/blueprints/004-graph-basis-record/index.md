---
type: bouncer.blueprint
title: graph.basis를 그래프별 질의 레코드로 바꿈
description: basis 엔트리 리스트 스키마·검증·스캐폴드·graphify-runner 기록 규칙
resource: .bouncer/context/epics/009-agent-orchestration/blueprints/004-graph-basis-record/index.md
tags:
  - bouncer
  - blueprint
timestamp: '2026-08-06T09:12:53.161+09:00'
bouncer:
  id: '004'
  epic_id: '009'
  blueprint_id: '004'
  status: approved
  commit_type: feat
  commit_intent:
    - 그래프 질의 근거를 기계가 읽을 수 있게 함
    - 어떤 그래프가 왜 갱신되지 않았는지 남김
---
# 004 graph-basis-record

Epic: [009](../../index.md)

## Intent
- 문제: `bouncer.graph.basis`가 자유 문장이라 어떤 그래프가 갱신됐는지, 어떤 질의가 실패해 건너뛰었는지, 그래서 어떤 결과로 `suggested_paths`가 나왔는지 사람이 문장을 파헤쳐야 안다. 리뷰도 도구도 이 값을 근거로 쓰지 못한다.
- 완료 조건: `basis`가 그래프별 엔트리 리스트를 받고, `status`가 정해진 다섯 값 중 하나이며, 기존 문자열 `basis` 문서는 그대로 통과한다. 015 성공 조건 2·3.

## Contract
- 데이터·상태: `tasks.bouncer.graph.basis`는 아래 둘 중 하나다.
  - 레거시: 비어 있지 않은 문자열(하위호환, 계속 유효)
  - 정본: 엔트리 객체의 비어 있지 않은 배열
  ```yaml
  basis:
    - graph: source          # source | context
      status: updated        # updated | reused | fail-skip | skip-disabled | missing
      query: 'cli validate scaffold basis'
      result: '12 hits; scripts/src/lib/validate.ts, scripts/lib/validate.js, …'
  ```
- 데이터·상태: `status` 의미 — `updated` 재빌드됨 / `reused` 최신이라 재빌드 없이 씀 / `fail-skip` 빌드 또는 질의 실패로 건너뜀 / `skip-disabled` `graphify.enabled`가 꺼졌거나 CLI 부재 / `missing` 동기화 후에도 `graph.json` 없음.
- 인터페이스: `validate` S9·G4가 문자열과 배열을 모두 받고, 배열이면 각 엔트리의 `graph`·`status`·`query`·`result`가 비어 있지 않은 문자열이며 `status`가 enum에 드는지 본다. 위반은 기존 코드(S9/G4)로 보고한다.
- 인터페이스: `scaffold blueprint`가 `basis: []`를 내보낸다. 빈 배열은 지금의 빈 문자열과 같이 G4에서 떨어진다 — 그래프 단계를 돌아야 통과한다.
- 인터페이스: `skills/graphify-runner/SKILL.md` step 5가 그래프마다 엔트리 하나를 적는 절차로 바뀐다. 질의를 못 돌린 그래프도 엔트리를 남긴다.
- 수용 기준: 015 성공 조건 2·3. 기존 fixture(`test/native-profile-e2e.test.js`, `test/cli-*.test.js`, `test/migrate-ids.test.js`)의 문자열 `basis`가 수정 없이 통과한다.
- 검증 명령: `npm test`
- 실패 모드·엣지 케이스: 빈 배열·엔트리 아닌 원소·미지의 `status`·빈 `query`는 거절한다. `result`가 길면 히트 수와 상위 경로 요약으로 줄인다(원문 덤프 금지). graphify가 없어도 `skip-disabled`/`missing` 엔트리로 G4를 통과해야 하므로, 그래프 부재가 계획을 막지 않는다.

## Out of scope
- `graph.suggested_paths`·`generated_at`·`command` 필드 형식 변경.
- `graph-sync`·`syncSessionGraphs` 동작 변경 — 이번 건은 결과를 어떻게 적느냐만 다룬다.
- 기존 문서의 문자열 `basis`를 배열로 일괄 마이그레이션.
- `schema.ts` 등록 — `graph`는 지금도 `validate.ts`가 소유한다.

## One-commit justification
스키마 검증·스캐폴드 기본값·기록 스킬·문서가 한 계약의 앞뒷면이라 따로 커밋하면 중간 상태에서 G4가 어긋난다.

## Documents
* [Tasks](tasks/001/tasks.md) - 구현 브리프
* [Verification](tasks/001/verification.md) - 검증 명령과 증적
* [Review](tasks/001/review.md) - 리뷰 발견사항
<!-- explain.md는 plan scaffold에 포함되지 않습니다. /bouncer-finalize가 작성합니다. -->
