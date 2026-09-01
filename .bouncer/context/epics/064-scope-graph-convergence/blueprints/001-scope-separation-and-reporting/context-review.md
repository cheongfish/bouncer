---
type: bouncer.context_review
title: 스코프 분리와 세 스코프 보고 계획 판정
description: Context review findings for blueprint 064-001, covering emitted build artifacts, the skip-no-dirs aggregation regression, and the third root graph.json fixture.
resource: .bouncer/context/epics/064-scope-graph-convergence/blueprints/001-scope-separation-and-reporting/context-review.md
tags:
  - bouncer
  - context_review
  - graph-scope
  - session-graph
  - check-emit
timestamp: '2026-09-01T15:49:01.158+09:00'
bouncer:
  id: CTXREVIEW-001
  epic_id: '064'
  blueprint_id: '001'
  status: accepted
  context_review:
    findings:
      - id: CR-001
        severity: blocker
        status: resolved
      - id: CR-002
        severity: blocker
        status: resolved
      - id: CR-003
        severity: blocker
        status: resolved
      - id: CR-004
        severity: major
        status: resolved
      - id: CR-005
        severity: major
        status: resolved
      - id: CR-006
        severity: minor
        status: resolved
      - id: CR-007
        severity: minor
        status: resolved
      - id: CR-008
        severity: minor
        status: resolved
---
# Context review

## Findings

- **CR-001** — severity: blocker — status: resolved
  - `scripts/lib/graph-scope.js`·`scripts/lib/session-graph.js`는 추적되는 `tsc` 산출물이고 `npm run check:emit`이 `.ts`와의 동기화를 강제하는데 task 001의 `affected_paths`에 없었다. 그대로 실행하면 커밋에 out-of-scope 파일 둘이 실리거나 `check:emit`이 깨진다.
  - 조치: 두 경로를 task 001의 `affected_paths`와 Touch에 추가하고, Constraints를 "손으로 고치지 않고 `npm run build`로만 갱신한다"로 정정했으며, 빌드·`check:emit` 확인을 Checklist에 넣었다. epic 063 task 001이 같은 형태로 `scripts/lib/context-digest.js`를 싣는 선례를 따랐다.

- **CR-002** — severity: blocker — status: resolved
  - `planSessionGraph`는 `graphs.every((g) => g.action === 'skip-no-dirs')`로 최상위 `skip-no-dirs` 요약을 만든다. 항상 실리는 `skip-unconfigured` 항목이 이 술어를 거짓으로 만들어, 입력이 하나도 없는 저장소가 `skip-fresh`("graphs are up to date")로 보고된다. task 001이 명시적으로 거부한 요약 의미 변경이 조용히 일어난다.
  - 조치: blueprint Contract 실패 모드에 이 집계 붕괴를 적고, task 001 Interface의 거부 절에 "source·context 입력이 없는 저장소는 `skip-no-dirs`로 남아야 한다"를 명시했으며, 회귀 테스트와 집계 제외 구현을 Checklist 항목으로 넣었다.

- **CR-003** — severity: blocker — status: resolved
  - 루트 `graphify-out/graph.json` 참조는 둘이 아니라 셋이다. `test/commit-guard.test.js:30`의 `files` 배열이 누락되어 있어 epic 성공 기준 5와 task 003의 마무리 grep이 모두 실패했을 것이다.
  - 조치: `test/commit-guard.test.js`를 task 003의 `affected_paths`·Touch·Checklist에 추가하고 Goal의 "두 테스트"를 "세 테스트"로 정정했다.

- **CR-004** — severity: major — status: resolved
  - `docs/install.md`에는 루트 `graph.json` 참조가 없다. task 003의 Goal과 `commit_intent`가 이 문서를 "남은 루트 참조"로 묶어 사실을 과장했고, 실제 편집(두 스코프 서술을 셋으로 넓히기)은 어떤 성공 기준에도 걸려 있지 않았다.
  - 조치: Goal과 `commit_intent`를 "픽스처 셋은 죽은 경로 치환, install.md는 두 스코프 서술 확장"으로 분리해 다시 쓰고, epic 성공 기준 4에 `docs/install.md`를 명시해 추적성을 만들었다.

- **CR-005** — severity: major — status: resolved
  - task 001 Checklist가 인덱스·길이 의존 단언 네 곳 중 하나(`:417`)만 지목했다. `:118~129`(`graphs.length === 2`, `graphs[0]`/`graphs[1]`, `every(action === 'build')`), `:509~518`, `:585`도 세 항목 계약에서 깨진다.
  - 조치: 해당 항목을 네 지점을 모두 나열하고 이름 기반 조회를 요구하는 항목으로 교체했다. `test/graphify.test.js`가 이미 `.find(name === 'context')`를 써서 안전하다는 판정은 그대로 유지했다.

- **CR-006** — severity: minor — status: resolved
  - `skip-unconfigured` 항목의 나머지 필드 형태가 정의되지 않았고, `missing` 제외가 `graph.json` 존재 여부가 아니라 `action` 기준이어야 한다는 점이 계약에 없었다. `test_dirs`를 쓰다 지운 프로젝트에 산출물이 남는 경우도 빠져 있었다.
  - 조치: Contract에 `dirs: []`·`configured: []`·`outDir: 'graphify-out/test'`를 고정하고 제외 판정이 `action` 키 기준임을 적었으며, 잔여 산출물 케이스를 실패 모드와 Checklist 테스트로 추가했다.

- **CR-007** — severity: minor — status: resolved
  - task 003의 `docs/ARCHITECTURE.md` 보호 사유("이미 세 스코프를 정확히 서술")가 `:230`의 실제 문장과 맞지 않았다.
  - 조치: 사유를 "빌드 수와 보고 수의 구분은 `docs/configuration.md`(task 001)가 담당하고, `:230`은 빌드 서술이라 변경 뒤에도 참이다"로 고쳤다.

- **CR-008** — severity: minor — status: resolved
  - epic 성공 기준 1이 gitignore 대상 산출물의 존재를 요구해, 커밋된 트리만으로는 나중에 확인할 수 없다.
  - 조치: 기준 1에 증적 위치(`tasks/002/verification.md`에 명령과 출력 그대로)를 명시했다. 하드룰 3의 증적 규칙과 일치한다.
