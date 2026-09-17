---
type: bouncer.explain
title: 003 explain
description: Explain for 003
resource: .bouncer/context/epics/009-agent-orchestration/blueprints/012-plugin-arm-benchmark/explain.md
tags:
  - bouncer
  - explain
timestamp: '2026-08-25T16:09:52.245+09:00'
bouncer:
  id: EXPLAIN-012
  epic_id: '009'
  blueprint_id: '012'
  status: published
  comprehension:
    - range_from: develop
      range_to: 01b082aa55068e14b41d692dc6086df78dbb12aa
      diff_sha: 8c26e088f76e6351df6e36aa2ab3b13596604e19f35b204dad06a395bda1acdb
      quiz_score: 2/3
      disposition: Q2를 빈 usage 객체로 골랐음. 플래그가 있을 때만 준 키를 싣는다.
      recorded_at: '2026-08-25T16:11:04+09:00'
---
# Explain

## Background
옛 벤치마크는 off/on 두 arm이었고, 태스크 넷은 이 저장소를 보고 손으로 골랐다.
토큰은 런 기록에 남지 않았다. 이 변경은 1–3회차 수치를 `docs/benchmark/history.md`
한 장으로 옮긴 뒤 나머지 옛 문서를 지우고, DeepSWE shape을 각색한 태스크 JSON
10개와 선정 근거를 세우고, vanilla / 비교 플러그인 / bouncer 세 arm 프로토콜과
`collect_metrics.py`의 선택 `usage` 플래그를 붙인다. 30런 실행은 여기 없다.

## Intuition
스위트(JSON 10)와 재는 축(프로토콜 3 arm)을 갈라 놓고, 토큰·시간은 채점하지
않는 `usage`에만 싣는다.

## Code
- `docs/benchmark/history.md` — 1–3회차 표. Distill light-contract 인용의 착지점.
- `docs/benchmark/tasks/*.json`, `tasks/README.md`, `task-selection.md` — 정본
  10개. `base`는 회차 일괄 갱신.
- `docs/benchmark/protocol.md` — 세 arm 통제·절차·plan 단계 스냅샷.
- `skills/agentic-code-benchmark/scripts/collect_metrics.py` — `--tokens-in` 등
  네 플래그. 준 키만 `usage`. `scorecard.py`는 그대로.
- `test/skill-agentic-code-benchmark.test.js` — 플래그 유무.
- `test/public-name-regression.test.js` — 비교 arm 문서 셋만 세 번째 플러그인
  이름 허용.

## Quiz
1. 1–3회차 시간 배수·계획 문서 줄 수를 다음에 어디서 읽나?
2. `collect_metrics.py`가 metrics JSON에 `usage`를 넣는 조건은?
3. 벤치마크 arm은 어디에 정의되나?

## 이해 상태
3문항. 정답 1A / 2B / 3C. 응답 1A / 2A / 3C. 2/3 정답.
Q2는 빈 `usage: {}`를 골랐다. 플래그 하나 이상일 때만 준 키를 넣고, 없으면 키를
생략한다. 마감은 막지 않는다.

## Tasks

### Task 001

#### Goal & intent

`docs/benchmark/` 아래 기존 자산 전부(README·protocol·tasks·runs·diffs·
round-2·round-3)를 지운다. 지우기 **전에** 1·2·3회차의 핵심 수치를 뽑아
`docs/benchmark/history.md` 표 하나로 옮긴다. 이 한 장이 이후 회차가 옛
수치를 인용할 유일한 자리이고, Distill `core`의 「Round 3 measured four
documents at 97 lines…」 결정이 가리킬 착지점이다. 완료 판정은 옛 파일이
하나도 남지 않고 `history.md`가 세 회차를 담으며 `npm run ci`가 통과하는
것이다.

#### Interface

- 제공:
  - `docs/benchmark/history.md` — 회차별 한 행씩, 열은 회차 · 측정일 ·
    베이스 커밋 · arm 구성 · 시간 배수 · test quality Δ · 계획 문서 줄 수 ·
    on 실격 수 · G18/S9/G4. 값이 그 회차에 없으면 `—`로 두고 지어내지
    않는다.
  - 표 아래에 세 회차가 무엇을 재려던 회차였는지 각 두 줄 이내로 적고,
    상세는 git 히스토리에 있다고 한 줄로 가리킨다.
- 거부:
  - 옛 문서의 서술을 통째로 옮겨 오는 것. 이 파일은 요약이지 아카이브가
    아니다.
  - 원본이 적지 않은 수치를 추정으로 채우는 것. 1회차에는 런별 벽시계가
    없으므로 그 칸은 `—`다.

#### Touch

- Delete `docs/benchmark` — README·protocol·tasks·runs·diffs·round-2·
  round-3를 포함한 하위 전체. 새 스위트는 002·003이 같은 경로에 다시 세운다.
- Create `docs/benchmark/history.md` — 위 표와 회차별 두 줄 요약.
- Modify `test/lightweight-cycle.test.js` — `docs/benchmark/protocol.md`가
  「3회차 on arm: light 계약」을 담는지 보는 assert가 삭제로 깨진다. light
  계약 문서 계약을 보는 나머지 assert는 그대로 두고 이 한 줄만 걷어낸다.
- Modify `README.md` — 1회차 on/off 결과표와 「방법·한계·후속 회차는
  docs/benchmark/」 문단이 지워진 문서를 가리키게 된다. 표의 수치는
  `history.md`로 옮기고 본문은 그 한 장을 가리키게 고친다.

#### Constraints

- 수치 추출과 삭제가 한 커밋이다. 삭제를 먼저 하면 같은 커밋 안에서 원본을
  잃는다 — Checklist 순서를 지킨다.
- 표의 모든 숫자는 지워지는 문서에서 그대로 옮긴 값이어야 한다. 다시
  계산하거나 반올림을 바꾸지 않는다.
- 회차 간 수치를 빼서 새 판정을 만들지 않는다. 세 회차는 문서 세트와 계약이
  달라 직접 비교가 성립하지 않는다는 것이 3회차 기록의 결론이다.
- 한국어 본문. 경로·식별자·코드 펜스는 그대로.

### Task 002

#### Goal & intent

`docs/benchmark/tasks/`에 태스크 10개의 정본 JSON을 세우고,
`docs/benchmark/task-selection.md`에 각 태스크가 어떤 shape이며 왜 이
저장소에 적합한지를 한 줄씩 남긴다. shape 분류는
`skills/agentic-code-benchmark/references/task-suite.md`의 표를 기준으로
쓰되, DeepSWE가 다루는 실패 유형(진단이 필요한 버그, 여러 모듈에 걸친
변경, 회귀 테스트가 있어야 통과하는 수정)이 표본에 들어가야 한다. 완료
판정은 JSON 10개가 네 필드를 모두 갖고 근거 문서가 10줄을 채우며
`npm run ci`가 통과하는 것이다.

#### Interface

- 제공:
  - `docs/benchmark/tasks/<id>.json` 10개. 각각 `id`(kebab-case),
    `base`(고정 커밋 sha), `prompt`(두 arm에 토씨 하나 안 바꾸고 전달할
    한국어 또는 영어 지시), `done_when`(심사자용 판정 문장 배열),
    `checks`(이 저장소에서 실제로 도는 명령 맵)를 갖는다.
  - `docs/benchmark/tasks/README.md` — 파일 규약, 한 회차 안에서 `base`를
    하나로 통일한다는 규칙, 그리고 실행 회차가 열 파일의 `base`를 일괄
    갱신한다는 규약.
  - `docs/benchmark/task-selection.md` — 10행 표(태스크 id · shape ·
    DeepSWE에서 대응하는 실패 유형 · 이 저장소 적합성 근거)와, DeepSWE
    원본 목록을 어떤 경로로 확인했는지 또는 확인하지 못했는지 한 문단.
- 거부:
  - `done_when`을 프롬프트에 섞는 것. 판정 조건은 심사자에게만 간다.
  - 이 저장소에서 돌지 않는 `checks` 명령. 각 명령은 작성 시점에 실제로
    실행해 보고 적는다.
  - 10개 중 어느 하나라도 `base`가 비거나 브랜치 이름인 것. 재현이 깨진다.

#### Touch

- Create `docs/benchmark/tasks/README.md` — 파일 규약과 `base` 고정 규칙.
- Create `docs/benchmark/task-selection.md` — 10행 선정 근거 표와 출처 문단.
- Create `docs/benchmark/tasks` — 태스크 정본 JSON 10개가 들어갈 자리.

#### Constraints

- 10개는 shape이 겹치지 않게 고른다. 같은 shape을 셋 이상 넣으면 표본이
  한쪽으로 쏠려 arm 간 차이가 shape 차이에 묻힌다.
- 프롬프트는 arm 중립이어야 한다. Bouncer 용어(`blueprint`, `게이트`,
  `affected_paths`)나 다른 플러그인 용어를 프롬프트에 넣지 않는다 — 그것을
  가르는 것은 프로토콜이다.
- 한 회차 안에서 열 태스크의 `base`는 하나로 통일한다. 태스크마다 다른
  base를 쓰면 arm 간 비교가 태스크 간 비교와 섞인다.
- 정본에 적는 `base`는 작성 시점의 `develop` 커밋이고, 그것이 최종값은
  아니다. 이 blueprint가 머지되기 전 커밋에는 태스크 003이 붙일 `usage`
  플래그가 아직 없어서 그 base로는 토큰을 기록할 수 없다. 실행 회차가 그
  회차의 공통 base로 열 파일을 일괄 갱신한다는 규약을
  `docs/benchmark/tasks/README.md`에 적는다.
- 네트워크로 DeepSWE 원본 목록을 확인하지 못하면 shape 분류 기반 각색으로
  진행하고 그 사실을 `task-selection.md`에 적는다. 10개를 줄이지 않는다.
- 한국어 본문. JSON 안의 키와 명령 문자열은 그대로.

### Task 003

#### Goal & intent

`docs/benchmark/protocol.md`를 vanilla · superpowers · bouncer 세 arm 기준으로
새로 쓰고, `collect_metrics.py`가 토큰·벽시계·툴콜을 받아 metrics JSON에
채점하지 않는 `usage` 블록으로 싣게 한다. 이 둘이 서면 태스크 002의 스위트를
다음 회차에 그대로 돌릴 수 있다. 완료 판정은 프로토콜이 세 arm을 각각
정의하고, 플래그를 준 호출만 `usage`를 내며, `npm run ci`가 통과하는 것이다.

#### Interface

- 제공:
  - `docs/benchmark/protocol.md`: arm 표(vanilla = 플러그인 없음,
    superpowers = superpowers만, bouncer = Bouncer 사이클 강제), 세 arm에
    공통인 통제 조건(같은 base, 같은 모델, 같은 프롬프트, 사람 개입 0,
    같은 checks), arm별 실행 절차, 그리고 런당 기록해야 할 값의 목록.
  - superpowers arm은 그 플러그인이 설치되어 있어야 한다는 선행 조건을
    적는다. 설치 절차 자체는 이 문서 밖이다.
  - `collect_metrics.py`에 `--tokens-in`, `--tokens-out`, `--wall-s`,
    `--tool-calls` 네 플래그(모두 선택, 정수). 하나 이상 주어지면 metrics
    JSON 최상위에 `usage` 객체를 싣고, 준 키만 담는다.
  - `skills/agentic-code-benchmark/SKILL.md`와 `references/task-suite.md`에
    `usage` 기록과 arm 축을 한 문단씩 반영한다.
- 거부:
  - 플래그를 하나도 주지 않은 호출에 빈 `usage: {}`를 넣는 것. 키 자체를
    만들지 않는다.
  - 주지 않은 값을 `0`이나 `null`로 채우는 것. "재지 않음"과 "0이었음"이
    구분되어야 한다.
  - `usage`를 `objective_breakdown`이나 합성 점수에 넣는 것. 기록 전용이다.
  - `metrics` 스키마 문자열 변경. 선택 키만 늘었으므로 `…/metrics/1`을
    유지한다.

#### Touch

- Create `docs/benchmark/protocol.md` — 3 arm 통제 조건과 실행 절차.
- Modify `skills/agentic-code-benchmark/scripts/collect_metrics.py` —
  네 플래그 추가와 `usage` 조립.
- Modify `skills/agentic-code-benchmark/SKILL.md` — `usage` 기록과 arm 축
  반영.
- Modify `skills/agentic-code-benchmark/references/task-suite.md` —
  A/B 절을 3 arm으로 넓힌다.
- Modify `test/skill-agentic-code-benchmark.test.js` — 플래그 유무에 따른
  `usage` 존재/부재 assert 추가.
- Modify `test/public-name-regression.test.js` — 벤치마크 비교 arm으로
  세 번째 플러그인 이름을 적는 파일만 허용한다. Bouncer가 그 플러그인을
  워크플로로 통합했다는 서술은 계속 막는다.

#### Constraints

- `usage`는 채점 입력이 아니다. 합성 점수는 같은 metrics에 대해 이 변경
  전후로 같은 값을 내야 한다.
- 기존 필드는 하나도 이름이 바뀌거나 사라지지 않는다.
- 플래그 파싱은 `argparse`의 기존 패턴을 그대로 쓴다. 새 의존성이나 별도
  설정 파일을 만들지 않는다.
- 프로토콜은 3회차까지의 통제 조건(같은 모델, 사람 개입 0, 동일 checks,
  측정치를 다른 실행 전에 수집)을 그대로 승계한다. 승계하는 줄임을
  문서에서 알아볼 수 있게 적는다.
- `agentic-code-benchmark`는 워크플로 밖 특화 스킬이다. `collect_metrics.py`에
  `BOUNCER_ROOT` 해석이나 `scripts/bouncer` 호출을 넣지 않고, `usage` 값이
  `verification.md`·`review.md`·게이트 판정으로 흘러가게 하지 않는다.
- 프로토콜의 plan 단계 스냅샷 절차를 승계한다. 하네스는 런별 plan 단계
  `.bouncer/context` 트리를 보관하지 않고 실행 clone은 커밋 하나로 squash되므로,
  그 절차가 빠지면 계획 단계 비용을 사후에 잴 수 없다.
- 파이썬 주석은 영어, 문서 본문은 한국어.
- 공개 이름 회귀는 Bouncer 제품 표면에 세 번째 플러그인 통합을 쓰지
  못하게 한다. 벤치마크 프로토콜·하네스 스킬이 비교 arm으로 그 이름을
  적는 것은 통합이 아니다. 허용 목록은 그 비교 문서에만 열고, 목록을
  비우거나 제품 문서를 넣지 않는다.
