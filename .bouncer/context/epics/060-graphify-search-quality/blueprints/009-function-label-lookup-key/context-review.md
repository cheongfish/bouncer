---
type: bouncer.context_review
title: 함수 label 조회 키 정규화 계획 판정
description: Context review findings for blueprint 060-009, covering one-sided normalization, the staged emit check, worktree scoping, and a sixth label-keyed comparison.
resource: .bouncer/context/epics/060-graphify-search-quality/blueprints/009-function-label-lookup-key/context-review.md
tags:
  - bouncer
  - context_review
  - graph-search
  - lookup-key
  - check-emit
timestamp: '2026-09-04T08:22:09.462+09:00'
bouncer:
  id: CTXREVIEW-009
  epic_id: '060'
  blueprint_id: '009'
  status: accepted
  context_review:
    findings:
      - id: CR-009-001
        severity: major
        status: resolved
      - id: CR-009-002
        severity: major
        status: resolved
      - id: CR-009-003
        severity: minor
        status: resolved
      - id: CR-009-004
        severity: minor
        status: resolved
      - id: CR-009-005
        severity: minor
        status: resolved
      - id: CR-009-006
        severity: minor
        status: resolved
      - id: CR-009-007
        severity: nit
        status: resolved
---
# Context review

## Findings

- **CR-009-001** — severity: major — status: resolved
  - test↔source 교차 관계 항목이 비교의 한쪽만 정규화하도록 적혀 있었다. `implSpecificLabels`는 `implSpecificLabels.add(n.label)`로 **원본** label을 담으므로, `link.target`·`link.source`·`tgt.label`만 `lookupKey`로 바꾸고 집합 원소 `l`은 `toLowerCase()`로 두면 두 키 공간이 어긋난다. 이는 blueprint Contract가 스스로 실패 모드로 지목한 바로 그 형태다.
  - 조치: Checklist 항목 (6/6)에 `implSpecificLabels`의 원소 `l` 자체도 정규화하라고 명시하고, `some` 콜백 두 곳 모두 해당한다고 적었다. blueprint Contract에도 「적용 지점(양쪽 정규화)」 항목을 추가해 집합 원소 쪽 정규화를 계약으로 올렸다.

- **CR-009-002** — severity: major — status: resolved
  - `npm run check:emit`을 단독 단계로 두면 올바른 구현에서도 반드시 실패한다. `scripts/check-emit.js:47`은 `git diff --exit-code -- scripts/lib`로 **unstaged** 변경만 보며, 그 위 주석이 "스테이징된 emit은 통과"라고 스스로 밝힌다. `npm run build`가 방금 생성물을 unstaged로 만든 직후라 실패가 구조적으로 보장된다.
  - 조치: 해당 Checklist 항목을 `git add` 세 파일 → `npm run check:emit` 순서로 바꾸고, 왜 스테이징이 선행해야 하는지를 항목 안에 적었다.

- **CR-009-003** — severity: minor — status: resolved
  - Constraints와 Checklist 첫 단계가 현재 `develop`의 더러운 작업 트리를 전제했다. 하드룰 10에 따라 execute는 `.worktrees/060/009`에서 도는데 그 트리에는 해당 수기 편집도 `.bouncer/config.json` 변경도 없다. 마지막 `git diff --stat` 확인도 `develop` 기준이면 거짓이 된다.
  - 조치: Constraints 첫 항목을 "모든 명령은 실행 worktree 안에서 돈다"로 다시 쓰고, 되돌리기 단계를 worktree 안에서의 조건부 확인으로 바꿨으며, 마지막 확인을 `git status --short`와 `affected_paths` 커밋 안전장치 기준으로 정정했다.

- **CR-009-004** — severity: minor — status: resolved
  - "이 다섯 곳이 전부다"가 사실이 아니었다. `definedFromContext`(`graph-search.ts:632-635`)가 `basis`의 `defines unique seed <seed>`에서 뽑은 seed 표기를 `contextSeedLabels.has(...)`로 대조하는데, 이 집합에는 괄호를 포함한 원본 label이 들어 있다. 정규화되지 않은 여섯 번째 label 키 비교다.
  - 조치: 이 지점을 여섯 번째 적용 지점으로 승격해 blueprint Contract와 Checklist (5/6)에 명시하고, Contract 문구를 "여섯 곳"으로 정정했다. 양쪽 모두 `lookupKey`를 거치도록 지시했다.

- **CR-009-005** — severity: minor — status: resolved
  - "결과 표시 값은 하나도 바뀌지 않는다"는 수용 기준이 과장이었다. 두 표기가 함께 seed로 들어오면 같은 노드로 풀려 `defines unique seed setupGraphify`와 `defines unique seed setupGraphify()`가 `basis`에 함께 쌓인다. `score`는 플래그 기반이라 그대로지만 `basis`는 실제로 늘어난다.
  - 조치: Contract 「데이터·상태(예외)」와 task Goal & intent·Interface 「허용」 항목에 이 중복을 명시하고, 불변으로 남는 값을 `path`·`score`·`confidence`로 좁혔다. 중복을 없애려 `basis` 문자열을 정규화하지 말라는 금지도 함께 적었다.

- **CR-009-006** — severity: minor — status: resolved
  - `GENERIC_WORDS` 제외 근거를 "괄호 표기와 무관하므로"라고 적었으나 부정확했다. `isGenericWord`는 seed뿐 아니라 node label로도 호출되므로(`graph-search.ts:654`) `graph()` 같은 label은 일반 명사로 걸러지지 않은 채 `implSpecificLabels`에 들어가고, 정규화 이후 `graph`와 같은 키를 갖게 된다. 제외 결정 자체는 옳지만 이유가 틀렸다.
  - 조치: 근거를 경로 비교와 일반 명사 차단으로 나누어 다시 쓰고, `isGenericWord`가 label로도 호출되어 생기는 잔여 위험을 blueprint 실패 모드와 task Constraints에 알려진 위험으로 기록하되 이번 범위 밖으로 명시했다.

- **CR-009-007** — severity: nit — status: resolved
  - `lookupKey`의 연산 순서가 `trim` → 소문자화 → 괄호 제거라서 `'foo ()'`가 `'foo '`로 남아 `'foo'`와 여전히 다른 키가 됐다. Constraints가 나중에 규칙을 더하는 것을 금지하므로 지금 잡아야 했다.
  - 조치: 순서를 소문자화 → 괄호 제거 → `trim`으로 바꾸고 그 순서를 Contract와 Interface에 계약으로 적었으며, `'setupGraphify ()'`와 seed `'setupGraphify'`가 같은 후보를 만든다는 테스트를 Checklist에 추가했다.
