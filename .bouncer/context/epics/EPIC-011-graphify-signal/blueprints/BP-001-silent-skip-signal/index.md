---
type: bouncer.blueprint
title: 그래프 미생성을 무음으로 넘기지 않고 신호로 드러냄
description: Blueprint BP-001
resource: .bouncer/context/epics/EPIC-011-graphify-signal/blueprints/BP-001-silent-skip-signal/index.md
tags:
  - bouncer
  - blueprint
timestamp: '2026-08-04T15:34:53.539+09:00'
bouncer:
  id: BP-001
  epic_id: EPIC-011
  blueprint_id: BP-001
  status: approved
  commit_type: fix
  commit_intent:
    - 옵트인했는데도 source 그래프가 만들어지지 않은 사실이 훅과 명령 출력 어디에도 드러나지 않아 계획이 그래프 없이 진행됐음
    - 그래프 부재를 하네스가 먼저 말하게 해 사용자가 원인을 추적하지 않아도 되게 함
---
# BP-001 silent-skip-signal

Epic: [EPIC-011](../../index.md)

## Intent
- 문제: `graphify.enabled`가 `true`인데도 `source_dirs`에 실재하는 디렉터리가 없으면
  `planOneGraph`가 `skip-no-dirs`를 돌려주고 그대로 끝난다. 훅은 이 값을 보지 않아
  아무 말도 하지 않고, `graph-sync`는 `"built": ["context"], "failed": []`를 출력해
  성공처럼 보인다. 사용자가 옵트인이라는 의사를 이미 밝혔는데 그 의사가 실현되지
  않았다는 사실만 전달되지 않는다.
- 완료 조건: 옵트인 상태에서 source 그래프가 없으면 `graph-sync` 출력의 최상위 필드와
  SessionStart stderr 양쪽에 드러난다. `graphify-runner`는 context 그래프의 존재 여부와
  무관하게 source 그래프가 없으면 우아하게 스킵한다. EPIC-011 성공 조건 1–3이 참이 되고
  `npm test`가 통과한다.

## Contract
<!-- Contract-First: 계약만. 구현 코드 금지. -->
- 인터페이스 (동기화 반환): `syncSessionGraphs`가 반환 객체에 `missing`을 싣는다.
  값은 그래프가 만들어지지 않은 스코프 이름의 배열(`['source']`, `['source', 'context']`,
  `[]`)이며 `resolveGraphScopes`의 순서를 따른다. graphify에 옵트인하지 않았거나
  (`skip-graph-disabled`) 부트스트랩이 온전하지 않아 그래프 작업 자체를 하지 않은
  경우에는 빈 배열이다 — 하지 않기로 한 일은 누락이 아니다. 기존 `ok`, `action`,
  `built`, `failed`, `graphs`의 의미와 타입은 바뀌지 않는다.
- 인터페이스 (계획 항목): `planOneGraph`가 돌려주는 스코프 항목이 설정에 적힌 디렉터리
  전체를 `configured`로 함께 싣는다. 기존 `dirs`는 지금처럼 **실재하는** 디렉터리만
  담는다. 두 값이 있어야 경고가 "무엇을 설정했는데 무엇이 없다"를 말할 수 있다.
- 인터페이스 (경고 문구): 동기화 결정을 사람이 읽을 경고 줄의 배열로 바꾸는 함수를
  `session-graph`가 내보낸다. 부트스트랩 이상(`partial`/`legacy`), `skip-no-graphify`,
  스코프 누락, 빌드 실패를 모두 이 함수가 만든다. 경고가 없으면 빈 배열이다.
  `hooks/session-graph.js`는 그 배열을 stderr로 출력할 뿐 문구를 직접 만들지 않는다 —
  현재 훅 안에만 있어 테스트가 닿지 못하는 문자열을 라이브러리로 내린다.
- 인터페이스 (스킬 계약): `graphify-runner`의 우아한 스킵 조건이 "두 `graph.json`이
  모두 없을 때"에서 "source `graph.json`이 없을 때"로 바뀐다. 스킬은 동기화 결과의
  `missing`을 근거로 판단하고, 그 사실을 `bouncer.graph.basis`에 남긴다.
- 데이터·상태: 없다. `.bouncer/config.json` 스키마, 그래프 산출물의 경로와 형식,
  신선도 판정 규칙은 모두 그대로다. 이 blueprint는 이미 계산된 결정을 밖으로 드러내기만
  한다.
- 수용 기준: EPIC-011 성공 조건 1, 2, 3이 참이 된다. `npm test` 통과.
- 검증 명령: `npm test`
- 실패 모드·엣지 케이스:
  - `source_dirs` 일부만 실재(예: `src`는 있고 `test`는 없음) — 있는 것으로 빌드를
    진행하고 그래프가 만들어지므로 `missing`에 들어가지 않는다. 누락된 디렉터리를
    경고로 알리되 실패로 다루지 않는다.
  - `graphify.enabled`가 `false`(기본) — 경고도 `missing`도 없다. 옵트인하지 않은
    사용자에게 이 신호를 보이면 기본 설치가 시끄러워진다.
  - `context_dirs`만 없는 경우 — `missing`에는 들어가지만 `graphify-runner`의 스킵을
    유발하지 않는다. 스킵을 결정하는 것은 source 그래프뿐이다.
  - 빌드가 예외로 실패한 경우(`failed`) — 그 스코프의 `graph.json`이 이전 빌드에서
    남아 있으면 `missing`에는 들어가지 않는다. 두 값은 서로 다른 질문에 답한다.
  - 훅은 어떤 경로로도 세션을 막지 않는다. 경고 생성이 예외를 던져도 `exit 0`이다.

## Out of scope
- `bouncer init`의 `source_dirs` 기본값. 무음을 만드는 또 하나의 원인이지만 고치는
  대상이 스캐폴딩 시점이라 BP-002로 분리한다.
- 신선도 판정(`newestMtimeUnder`)과 part 빌드의 cwd. 같은 파일을 건드리지만 판정
  로직을 바꾸는 변경이라 이 커밋의 "드러내기만 한다"는 성질을 깬다. BP-002.
- 경고를 stdout으로 옮기거나 `graph-sync`의 종료 코드를 바꾸는 것. stdout 파이프
  청정과 `0/1/2` 관례는 Distill 불변이다.
- `graph-sync`의 `ok`를 `false`로 뒤집는 것. 그래프 부재는 오류가 아니라 상태이고,
  포인터 부재를 오류로 다루지 않는 기존 결정과 같은 이유다.

## One-commit justification
- 변경의 실체는 하나다 — 이미 내려진 `skip-no-dirs` 판정을 소비자 세 곳(명령 출력,
  훅 stderr, 스킬 분기)에 도달시키는 것.
- 쪼갤 수 없다. `missing`만 추가한 커밋은 아무도 읽지 않는 필드를 남기고, 훅이나
  스킬만 고친 커밋은 근거로 삼을 필드가 없어 판정을 다시 손으로 유도해야 한다.
- 판정 로직을 건드리지 않으므로 회귀 범위가 출력 표면에 한정된다. 기존 신선도·빌드
  테스트가 그대로 통과하는 것이 그 경계의 증거다.

## Documents
* [Tasks](tasks.md) - 구현 브리프
* [Verification](verification.md) - 검증 명령과 증적
* [Review](review.md) - 리뷰 발견사항
<!-- distill.md는 plan scaffold에 포함되지 않습니다. /bouncer-finalize가 작성합니다. -->
