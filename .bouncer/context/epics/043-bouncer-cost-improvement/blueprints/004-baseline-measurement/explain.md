---
type: bouncer.explain
title: 001 explain
description: Explain for 001
resource: .bouncer/context/epics/043-bouncer-cost-improvement/blueprints/004-baseline-measurement/explain.md
tags:
  - bouncer
  - explain
timestamp: '2026-08-27T09:06:01.115+09:00'
bouncer:
  id: EXPLAIN-004
  epic_id: '043'
  blueprint_id: '004'
  status: published
  comprehension:
    - range_from: develop
      range_to: 181e96d97663219dde40c3be527b59ebe6833ea4
      diff_sha: 072484b61380c5300176117f6008bd7b4647c60be1050b732ceae3fac8bb6257
      quiz_score: 3/3
      disposition: 측정 계약과 정적 baseline 범위, superpowers 스캔, 측정 커밋을 질문으로 확인했고 전부 맞힘
      recorded_at: '2026-08-27T09:07:21+09:00'
---
# Explain

## Background
epic 054는 스킬 지시문 비용을 줄이려 한다. 계획 문서에 적은 최악값(plan 11,007단어 같은)은 보조 문서를 전부 읽었다는 가정이고, 실제로 그 사이클이 얼마나 읽는지 재지 않았다. `docs/benchmark/protocol.md`는 arm별 코드 품질 비교용이라 Bouncer 지시문 비용의 시나리오와 기록 칸이 없었다.

이 단위는 재구조화 전에 측정 계약을 고정한다. 회귀 시나리오 7종, 정적 지표 5종과 붙여넣기 명령, 런당 기록 키를 `docs/benchmark/context-cost.md`에 두고, 같은 명령으로 뽑은 변경 전 정적 수치를 Baseline 표에 남긴다. 사람이 돌린 7런의 실행 지표는 입력이 없어서 실행 표는 헤더만 두고 006이 채운다.

## Intuition
자를 먼저 만들고, 그 자로 지금 길이를 적어 둔다.

## Code
- `docs/benchmark/context-cost.md` — 시나리오 7행, 정적 명령 5개, 런당 `usage` 키, 정적 Baseline 수치, 실행 표 헤더
- `docs/benchmark/protocol.md` — 지시문 비용 측정이 `context-cost.md`에 있다는 한 줄
- `test/benchmark-context-cost.test.js` — 네 절·백틱 시나리오 id 7개, 정적 표에 데이터 행이 있음을 단정
- 정적 수치는 실행 워크트리 HEAD `1c73980`에서 문서에 적힌 명령을 그대로 돌린 값이다. `superpowers` 리터럴은 `test/public-name-regression.test.js`가 `git ls-files`로 스캔하므로 새 문서에 적지 않는다.

## Quiz
1. 이 blueprint가 저장소에 남기는 측정 산출물은?
   - A) 7런 실행 지표(`tokens_in` 등)까지 채운 Baseline 표
   - B) `history.md`에 더한 1–3회차 행
   - C) 시나리오·정적 명령·런당 키 계약과, 정적 지표만 채운 Baseline 표(실행 표는 헤더)

2. `context-cost.md`에 `superpowers`를 쓰지 않는 이유는?
   - A) `test/public-name-regression.test.js`가 `git ls-files`로 그 리터럴을 스캔하고, 추적되는 순간 테스트가 깨지기 때문
   - B) vanilla·bouncer arm 이름이 같은 스캔 대상이라서
   - C) `collect_metrics.py`가 그 문자열을 usage 키로 쓰기 때문

3. 정적 Baseline의 측정 대상 커밋은?
   - A) `develop`의 최신 커밋을 따로 checkout한 시점
   - B) task 001이 올라간 실행 워크트리 HEAD (`git rev-parse --short HEAD`)
   - C) task 002 커밋 이후의 HEAD

## 이해 상태
퀴즈 3/3. 응답 C A B.
정답: (1) C 계약과 정적 Baseline(실행 표는 헤더) (2) A git ls-files 스캔으로 추적 직후 깨짐 (3) B task 001이 올라간 워크트리 HEAD.
disposition: 측정 계약과 정적 baseline 범위, superpowers 스캔, 측정 커밋을 질문으로 확인했고 전부 맞힘.

## Tasks

### Task 001

#### Goal & intent

`docs/benchmark/context-cost.md`가 생겨서, 이후 누구든 같은 명령으로 Bouncer 지시문 비용의 정적 지표를 뽑고 같은 7개 시나리오로 실행 지표를 재현할 수 있다. 이 문서가 epic 054의 baseline과 최종 회차가 공유하는 측정 계약이다. 다섯 정적 지표는 epic 성공 조건 1·5·6이 남긴 흔적을 재는 것이지 조건 2·3·4까지 대신 판정하지 않는다 — 그 셋은 리뷰가 문서를 읽고 본다. 수치는 이 task에서 적지 않는다 — 계약과 그 계약을 고정하는 테스트만 만든다.

#### Interface

- 제공:
  - `docs/benchmark/context-cost.md` — `## 회귀 시나리오`(7행 표: id, 실행 조건, 진입 스킬), `## 정적 지표`(5개 항목, 각각 명령 코드펜스), `## 런당 기록 값`, `## Baseline`(task 002·003이 채울 빈 표) 네 절.
  - 시나리오 id 7개: `s1-light-cycle`, `s2-full-plan`, `s3-verify-recovery`, `s4-review-roundtrip`, `s5-finalize-distill`, `s6-finalize-bare`, `s7-run-multitask`.
  - `docs/benchmark/protocol.md`에 이 문서를 가리키는 한 줄.
  - `test/benchmark-context-cost.test.js` — 위 네 절과 시나리오 id 7개의 존재를 단정. id는 백틱으로 감싼 형태(`` `s1-light-cycle` ``)로 단정해 산문에 우연히 섞인 부분 문자열이 통과하지 않게 한다.
- 거부:
  - 새 수집 스크립트·새 npm 의존성·새 메트릭 스키마 키. 실행 지표는 `collect_metrics.py`의 기존 `usage` 키만 쓴다.
  - 이 task에서의 수치 기입. `## Baseline` 표는 헤더만 두고 행은 비운다.
  - `docs/benchmark/history.md`의 1–3회차 행과 DeepSWE 절 수정.

#### Touch

- Create `docs/benchmark/context-cost.md` — 시나리오 7종, 정적 지표 5종과 명령, 런당 기록 값, 빈 Baseline 표.
- Modify `docs/benchmark/protocol.md` — 지시문 비용 측정이 `context-cost.md`에 있다는 링크 한 줄을 문서 앞부분에 추가.
- Create `test/benchmark-context-cost.test.js` — 문서의 네 필수 절과 시나리오 id 7개를 리터럴로 단정.

#### Constraints

- 명령은 저장소 루트에서 그대로 붙여넣어 실행되는 형태로 적는다. `cd` 접두나 설명 대체 문구를 쓰지 않는다.
- 정적 지표는 저장소가 이미 쓰는 도구(`wc`, `awk`, `grep`, `sort`)로만 뽑는다. 새 스크립트를 만들지 않는다.
- 시나리오 정의는 `docs/benchmark/protocol.md`의 「공통 통제」와 「plan 단계 스냅샷」을 링크로 인용하고 문장을 복제하지 않는다.
- 문서 본문 산문은 한국어, 명령·경로·시나리오 id는 원문 그대로 둔다.
- 테스트는 `node:test`와 `node:assert`만 쓴다. 새 러너나 의존성을 넣지 않는다.
- `docs/benchmark/context-cost.md`에 `superpowers` 리터럴을 적지 않는다. `test/public-name-regression.test.js`의 `SUPERPOWERS_RE`가 그 이름 하나만 스캔하고 `COMPARISON_ARM_ALLOWLIST`가 예외 파일을 열거하는데, 새 문서는 그 목록에 없다. 커밋 전에는 untracked라 스캔에서 빠지므로 파일이 추적되는 커밋 직후에야 깨진다. 7개 시나리오는 모두 Bouncer 사이클 하나라 그 이름이 필요 없고, 언급이 필요하면 `protocol.md` 링크로 대신한다. `vanilla`·`bouncer`는 이 스캔 대상이 아니라 제약이 없다.

### Task 002

#### Goal & intent

`docs/benchmark/context-cost.md`의 정적 Baseline 표가 실제 수치로 채워져서, blueprint 002~005가 끝난 뒤 같은 명령을 다시 돌려 뺄셈으로 절감폭을 판정할 수 있다. 수치와 함께 측정 커밋 sha와 측정 시점 스킬 수를 남겨, 모수가 달라진 회차를 서로 빼는 실수를 막는다.

#### Interface

- 제공: `docs/benchmark/context-cost.md`의 `## Baseline` 정적 표에 다섯 지표 행과 헤더(측정일, 베이스 커밋, 스킬 수)가 채워진다. `test/benchmark-context-cost.test.js`가 그 표에 데이터 행이 있음을 단정한다.
- 거부: task 001이 정의하지 않은 지표를 새로 추가하는 것, 명령을 바꿔 뽑은 수치, 실행 지표(`tokens_in` 등)를 이 표에 섞는 것. 실행 표는 헤더만 둔 채 blueprint 006에 넘긴다.

#### Touch

- Modify `docs/benchmark/context-cost.md` — `## Baseline` 정적 표에 다섯 지표 행과 측정 메타(측정일, 베이스 커밋 sha, 스킬 수)를 채운다.
- Modify `test/benchmark-context-cost.test.js` — 정적 Baseline 표가 헤더 외에 데이터 행을 가진다고 단정하는 케이스를 더한다.

#### Constraints

- 수치는 task 001이 적어 둔 명령을 그대로 돌려서만 얻는다. 명령을 고쳐야 한다면 그것은 task 001 계약이 틀렸다는 신호이므로 `/bouncer-plan`으로 에스컬레이션한다.
- 측정 대상 커밋은 이 task의 실행 워크트리 `HEAD`, 즉 task 001 커밋이 올라간 시점이다. `git rev-parse --short HEAD`가 내는 값을 그대로 표에 적는다. 별도 커밋을 checkout해서 재지 않는다 — task 001은 `docs/`와 `test/`만 만졌으므로 `skills/`·`agents/` 모수가 그 사이에 달라지지 않는다.
- 지표 정의와 명령 문장은 이 task에서 바꾸지 않는다.
- 문서 산문은 한국어, 명령·경로·지표 이름은 그대로 둔다.
