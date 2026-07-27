# epic·blueprint·tasks 템플릿 개선과 OKF 정렬 설계

## 배경

`sdd-agent-starter-kit`의 템플릿을 참고해 Bouncer의 epic / blueprint / tasks
템플릿을 개선한다. 다만 두 시스템의 전제가 다르다. 스타터킷은 결정적 게이트가
없어 규율 전부를 템플릿 산문에 실었고(blueprint 템플릿 하나가 8개 섹션 + 길이
상한 규정), Bouncer는 G1–G14가 강제하므로 템플릿을 비워 두었다.

따라서 목표는 스타터킷 섹션의 이식이 아니라 **게이트가 나중에 실패시킬 것을
템플릿이 작성 시점에 미리 말해 주게 하는 것**이다. 스타터킷에서 가져오는 것은
섹션 구조가 아니라 그 안의 판단 기준이다.

## 결정

- 목표: 산출물 품질 상향 (게이트 강화가 아니라 문서 자체의 사고 밀도).
- 범위: `epic.md`, `blueprint.md`, `tasks.md` 세 템플릿. verification / review /
  distill / pr은 이번 범위 밖.
- 언어: 영문 헤딩 + 한국어 안내. 헤딩을 바꾸지 않는 이유는 `validate.js`의
  `SECTION_DEFS`가 이름으로 섹션을 찾기 때문이며, 한국어 별칭은 이미 지원된다.
- 미작성 감지: `<TODO: …>` 센티넬 검출.
- OKF 준수 범위: 인덱스와 링크(D3·D4)까지. 파일명 위반(D1)과 `resource` 의미
  오용(D2)은 이번 작업에서 제외.

## 핵심 제약: 안내를 늘리면 G10이 무력화된다

`parseSections`(`scripts/lib/validate.js`)는 헤딩 아래가 비었을 때만 `null`을
반환하고, G10은 그것으로 미작성을 잡는다. 즉 **빈 템플릿이 게이트를 통과할 수
없다**는 것이 유일한 안전장치였다. 섹션 아래에 안내 문구를 넣는 순간 그 섹션은
"작성됨"이 되어 손대지 않은 템플릿이 G10을 통과한다.

해법은 두 가지를 함께 적용한다.

1. `parseSections`가 **HTML 주석을 먼저 제거**한다. 주석만 있는 섹션은 미작성이다.
   `parseSections`는 G13·G14도 쓰므로 그쪽 판정도 함께 엄격해진다. 의도한 변경이다.
2. plan 게이트가 **`<TODO: …>` 잔존을 G10으로 보고**한다. 이 형태를 고른 이유는
   `<T>` 같은 제네릭을 오탐하지 않으면서 grep 가능하고 작성자 눈에 띄기 때문이다.
   `renderTemplate`이 치환하는 `<EPIC-id>` / `<BP-id>` / `<name>`과도 충돌하지 않는다.

placeholder 잔존은 `missing`이 없을 때만 보고하고, 이 경우 G11·G12 경로 검사는
건너뛴다. 치환되지 않은 템플릿 문자열을 스코프 위반으로 보고해 봐야 소음이다.

## 템플릿

### epic.md

`Intent` / `Out of scope` / `Blueprints` 세 섹션. 스타터킷의 `Intent` +
`Non-Goals` + `Scope Boundary` + `Routing Rule` + `Child Blueprints`를 압축한
것이다. Routing Rule은 별도 섹션 대신 주석으로 둔다 — 읽혀야 하지만 채울 필요는
없는 정보다. `Blueprints`는 OKF §6 인덱스 형식(`* [Title](url) - description`).

### blueprint.md

`Intent` / `Contract` / `Out of scope` / `One-commit justification` /
`Documents`. `Contract` 주석에 스타터킷의 Contract-First 규칙(구현 코드 금지,
코드 블록 20줄 상한)을 싣는다.

`One-commit justification`이 이 설계의 신규 항목이다. `.bouncer/governance.md`의
blueprint 사이징 규칙이 지금은 규정집에만 있고 작성 지점에는 없다. **이 칸을
채우지 못한다는 것 자체가 blueprint를 쪼개라는 신호**로 작동한다.

### tasks.md

섹션 다섯 개(`Goal & intent` / `Interface` / `Touch` / `Do not touch` /
`Checklist`)를 그대로 두고, 각 섹션에 해당 게이트가 무엇을 보는지만 붙인다.
`Touch`에는 G11(affected_paths 정당화), `Do not touch`에는 G12(교차 금지).

스타터킷의 `Primary / Dependent / Related / Out of Scope` 4분할은 의도적으로
가져오지 않는다. Bouncer의 2분할이 G11·G12와 1:1로 대응하므로, 검사되지 않는
축을 더하면 게이트와 문서가 어긋난다.

## OKF v0.1 정렬

스펙 원문은 스타터킷 히스토리의 `context/artifacts/okf_spec.md`(커밋 `13c3ea2`
직전)에 있다. 대조 결과는 다음과 같다.

| # | 현재 | OKF v0.1 | 처리 |
| --- | --- | --- | --- |
| D1 | epic/blueprint 본체 파일명이 `index.md`이고 frontmatter를 가짐 | `index.md`는 예약 파일명(§3.1), frontmatter 금지(§6), §9 적합성 조건 3 | **이연** — layout·paths·validate·scaffold와 기존 문서 마이그레이션까지 번짐 |
| D2 | `resource`가 자기 경로 | resource는 기술 대상 asset의 canonical URI, 추상 개념이면 생략(§4.1) | **이연** — 스키마·S1·S3 변경. 자기 경로 무결성은 §4.1 Extensions로 `bouncer.path`에 두는 안이 있음 |
| D3 | 루트 인덱스가 산문 한 줄, `okf_version`이 `config.json`에 | §6 목록 형식, §11은 번들 루트 index.md frontmatter를 유일한 선언 위치로 지정 | **적용** |
| D4 | 문서 간 링크 없음 | 링크가 곧 그래프 엣지(§5.3) | **적용** |

본문 구조는 이미 적합하다. §4.2는 필수 본문 섹션을 두지 않고 "freeform prose보다
headings·lists·tables를 선호하라"고만 하므로, H2 섹션 구조는 그대로 유효하다.

### 링크 형식

OKF §5.1은 번들 상대 절대 링크(`/epics/…`)를 권장하지만, 그러면 웹 git 호스트가
저장소 루트로 해석해 전부 깨진다. §5.2 상대 링크도 정식 지원이므로 **상대 링크**를
쓴다. 테스트가 절대 링크 재도입을 막는다.

### 버전 문자열 이원화

`config.json`의 `okf_version: "0.x"`와 `.bouncer/okf.md`의 "Pinned OKF version:
0.x"는 §11의 `<major>.<minor>` 형식이 아니라 유효한 OKF 버전이 아니었다. 게다가
둘은 서로 다른 것을 가리킨다. 분리한다.

- `.bouncer/context/index.md` frontmatter `okf_version: "0.1"` — OKF 스펙 버전.
- `config.json` `schema_version: "0.x"` — Bouncer 자체 frontmatter 스키마 버전.
  (`okf_version`에서 개명. 이 키를 읽는 코드는 없어 동작 호환성 영향 없음.)

## 알려진 구멍

`init`은 `.bouncer/`가 이미 있으면 `already-initialized`로 아무것도 쓰지 않는다
(`scripts/lib/init.js`). **이미 `/bouncer-init`을 돌린 프로젝트는 새 템플릿을
자동으로 받지 못한다.** 이번에는 파일럿 팀에 수동 교체를 안내하는 것으로 하고,
갱신 명령(`bouncer init --refresh-templates` 등)은 별도 항목으로 남긴다.

## 검증

- `test/validate-gates.test.js` — 주석만 있는 섹션 실패, `<TODO:` 잔존 실패,
  안내 주석과 실제 내용이 공존할 때 통과, 제네릭 `<T>` 오탐 없음, **배포되는
  tasks 템플릿이 손대지 않은 채로는 plan 게이트를 통과할 수 없음**.
- `test/init.test.js` — 루트 인덱스의 §11 frontmatter와 §6 본문 형식,
  epic/blueprint 템플릿이 절대 링크를 쓰지 않고 상대 링크로 이웃을 가리킴.
