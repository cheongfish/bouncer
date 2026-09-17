---
type: bouncer.explain
title: 002 설명
description: Explanation for the 039 release security blueprint
resource: .bouncer/context/epics/039-release-security/blueprints/002-public-contract-freeze/explain.md
tags:
  - bouncer
  - explain
timestamp: '2026-08-15T19:33:08.511+09:00'
bouncer:
  id: EXPLAIN-002
  epic_id: '039'
  blueprint_id: '002'
  status: published
  comprehension:
    - range_from: develop
      range_to: 181301af4b8d744e420bcee38dcb40736eac07f9
      diff_sha: 5654e420f5951be9c8081ac73799ef6ab35732b1ca897f5cb70c65d181902cb9
      quiz_score: 2/3
      disposition: 공개 계약·파일럿 정합성의 핵심은 이해했으며 폐기 절차의 minor/major 순서를 기록함
      recorded_at: '2026-08-15T19:34:04+09:00'
---
# 설명

## 배경
공개 표면이 여러 문서에 흩어져 있어 구현과 문서가 어긋나도 발견하기 어려웠다.
이번 변경은 CLI·문서 스키마·게이트 코드·워크플로 스킬·설정 키의 정본을
`docs/compatibility.md`에 모으고, 이름 집합 drift를 테스트 실패로 바꾼다. 파일럿을
실행하지 않은 호스트가 지원되는 것처럼 읽히지 않도록 저장소 유형과 호스트 조합의
기록 틀, 설치 지원 판정도 함께 고정했다.

## 직관
공개 계약을 목차 하나와 자동 대조표로 묶어, 문서와 구현이 서로 다른 말을 하지
못하게 만든다.

## 코드
`docs/compatibility.md`는 다섯 공개 표면과 하위 호환·폐기 정책의 정본이다.
`test/public-contract.test.js`는 CLI 도움말, `scripts/lib/*.js`, schema export,
`skills/bouncer-*`, `config.example.json`의 이름 집합을 문서와 비교하고 결번
`G9`·`G15`·`S14`를 확인한다. `docs/PILOT.md`는 3×4 파일럿 매트릭스와 기록
형식을 제공하며, `docs/install.md`는 호스트별 세 행이 모두 검증된 경우에만
검증됨으로 파생한다. `README.md`와 compatibility 문서는 설치 가능성과 지원
선언을 구분해 링크한다.

## 퀴즈
1. `docs/install.md`에서 호스트 상태를 `검증됨`으로 바꿀 수 있는 조건은 무엇인가?
   - A) 해당 호스트의 세 저장소 유형 행이 모두 `검증됨`일 때
   - B) 한 번이라도 설치 명령을 실행했을 때
   - C) README에 호스트 이름이 있을 때

2. 공개 계약 drift 테스트가 게이트 코드를 수집하는 구현 범위는 무엇인가?
   - A) `validate*.js` 파일만
   - B) `scripts/lib/*.js` 전체의 문자열 리터럴
   - C) `docs/gates.md`의 표만

3. 폐기할 공개 이름의 호환 절차로 맞는 것은 무엇인가?
   - A) 즉시 삭제하고 다음 릴리스에서 공지
   - B) 한 minor 릴리스 동안 유지하고 `CHANGELOG`에 기록한 뒤 다음 major에서 제거
   - C) 이름을 같은 의미로 즉시 재사용

## 이해 상태
응답: 1A, 2B, 3C
정답: 1A, 2B, 3B
결과: 1번 정답, 2번 정답, 3번 오답
점수: 2/3
처리: 낮은 점수도 재시험 없이 기록하며, 3번의 폐기 절차는 다음 major 제거 전에
최소 한 minor 릴리스 유지와 `CHANGELOG` 기록이 필요하다는 설명을 남김.

## Tasks

### Task 001

#### Interface

- 제공: `docs/compatibility.md`가 다음을 선언한다.
  - 공개 표면 다섯 종의 **이름 목록**. 각 항목은 백틱으로 감싸고 설명은 기존
    문서(`cli.md`·`gates.md`·`workflow.md`·`configuration.md`)로 링크한다.
  - 계약이 아닌 것: 내부 모듈 경로와 `scripts/lib` emit 레이아웃, 진단·로그 문구,
    문서 산문 표현, `graphify-out/` 산출물, 서브에이전트 프롬프트 본문.
  - breaking change 정의: 위 이름 목록에서 무엇이 사라지거나, 같은 이름의 판정
    결과가 뒤집히거나, 기존 문서가 새 필수 필드 없이는 게이트를 통과하지 못하게
    되는 변경.
  - 폐기 절차: 최소 한 개 minor 릴리스 동안 기존 이름을 유지하고 CHANGELOG에
    폐기를 적은 뒤 다음 major에서 제거한다. 문서 레이아웃 변경은 `bouncer migrate`
    하위 명령을 함께 낸다.
  - 결번 코드 재사용 금지: `G9`, `G15`, `S14`는 영구 결번이다.
- 거부: 새 CLI 명령·게이트 코드·설정 키·문서 status를 만들지 않는다. 기존 문서의
  표를 이 문서로 복사하지 않는다. `BOUNCER_SCHEMA_VERSION`을 올리지 않는다.

## 변경 범위
- Create `docs/compatibility.md` — 공개 표면 다섯 목록, 계약이 아닌 것, breaking
  정의, 폐기 절차, 결번 목록, 마이그레이션 경로를 담는다.
- Modify `docs/gates.md` — 구조 코드 범위를 `S0–S26`으로 고치고 `S21`–`S26` 설명을
  추가한 뒤 `compatibility.md`를 링크한다.
- Modify `README.md` — 같은 `S0–S20` 표기를 고치고 계약 문서 링크를 넣는다.
- Modify `docs/README.md` — `docs` 목차 표에 `compatibility.md` 줄을 넣는다.

## 변경 금지
- `scripts/` — 이 task는 문서만 고친다. 코드가 바뀌어야 할 drift를 찾으면 문서가
  아니라 계획으로 되돌린다.
- `test/` — 계약을 강제하는 테스트는 task 002 소관이다.
- `docs/PILOT.md`, `docs/install.md` — 파일럿 매트릭스와 지원 선언은 task 003 소관이다.
- `.bouncer/` — 문서 task가 하네스 상태를 건드리지 않는다.

## 제약 조건
- `S21`–`S26`의 의미는 `scripts/src/lib/validate-structural.ts`의 실제 호출부에서
  읽어 적는다. 코드 번호를 추정하거나 새로 배정하지 않는다.
- 코드 집합은 `validate*` 파일만 보고 뽑지 않는다. `S13`은 `epic-index`에서
  발행되므로 `scripts/lib/*.js` 전체를 훑어야 목록이 완전해진다.
- `docs/compatibility.md`는 한국어로 쓰고 명령·코드·경로·키 이름만 원문으로 둔다.
- 목록은 이름만 담는다. 각 이름의 플래그·동작 설명을 여기에 복제하면 다음 drift가
  이 문서에서 난다.
- 문서 본문에 버전 `1.0.0`을 확정 사실로 적지 않는다. 승격은 BP003 소관이다.
- 기존 문서의 앵커(`gates.md`, `cli.md`의 헤딩)를 바꾸지 않는다. README와 스킬이
  링크로 참조한다.

### Task 002

#### Interface

- 제공: `test/public-contract.test.js`가 다섯 가지 집합 동등성을 단언한다.
  - CLI: `runCli([])` 사용법에서 뽑은 명령 이름 == 문서의 CLI 목록
  - 스키마: `require('../scripts/lib/schema')`의 `TYPES`·`STATUS_ENUM` 키·
    `SCALE_ENUM`·`AUTONOMY_ENUM`·`BOUNCER_SCHEMA_VERSION` == 문서의 스키마 목록
  - 게이트: `scripts/lib/*.js` 전체에서 발행되는 `G`/`S` 코드 == 문서의 코드 목록
  - 스킬: `skills/` 아래 `bouncer-`로 시작하는 디렉터리 이름 == 문서의 스킬 목록
  - 설정: `config.example.json` 최상위 키 == 문서의 설정 키 목록
  그리고 결번 단언: `G9`·`G15`·`S14`가 구현 코드 집합에도, 문서 목록에도 없다.
- 거부: 문서 설명 문장·표 순서·링크 대상에 대한 단언을 넣지 않는다. 실패 메시지가
  어느 이름이 어느 쪽에만 있는지 말하지 않는 형태(단순 `deepStrictEqual` 없이
  집합 차이를 못 보여주는 단언)를 넣지 않는다.

## 변경 범위
- Create `test/public-contract.test.js` — 위 다섯 집합 동등성과 결번 단언, 그리고
  각 목록 추출 헬퍼를 담는다.

## 변경 금지
- `docs/compatibility.md` — task 001이 쓴 정본이다. 테스트를 맞추려고 문서를 고쳐야
  한다면 그건 drift가 아니라 계획 문제이므로 되돌린다.
- `scripts/` — 테스트를 통과시키려고 구현을 바꾸지 않는다.
- `test/open-source-readiness.test.js`, `test/cli-help.test.js`,
  `test/public-name-regression.test.js` — 기존 단언을 이 task로 옮기거나 지우지 않는다.

## 제약 조건
- Node 24 내장 test runner와 `node:fs`만 쓴다. 마크다운 파서나 스키마 검증
  의존성을 추가하지 않는다.
- 문서에서 이름을 뽑을 때는 지정한 섹션 헤딩 아래의 백틱 토큰만 읽는다. 문서 전체를
  훑으면 산문에 나온 명령 이름까지 목록으로 오인한다.
- 게이트 코드는 emit(`scripts/lib/*.js`) 전체의 인용된 문자열 리터럴에서 뽑는다.
  `validate*`만 보면 `epic-index.js`가 내는 `S13`이 빠져 문서와 테스트가 같이 틀린
  채로 통과한다. 주석이나 메시지 본문의 코드 언급은 집합에 넣지 않는다.
- `capture`는 `test/cli-help.test.js` 안의 파일-지역 함수다. 새 테스트는 자기
  `runCli` 캡처 헬퍼를 직접 정의한다.
- `test/cli-help.test.js`의 `SUBCOMMANDS` 배열은 이름 13개라 `distill`이 빠져 있다.
  이 task는 그 배열을 고치지 않는다. 문서 목록이 정본이고 그 파일은 사용법 출력에
  이름이 나오는지만 보는 별개 검사다.
- 테스트가 실패할 때 어느 쪽에 있고 어느 쪽에 없는지가 메시지에 남아야 한다.
- 기존 테스트의 단언을 완화하거나 skip하지 않는다.

### Task 003

#### Interface

- 제공:
  - `docs/PILOT.md`에 매트릭스 표(열: 저장소 유형 · 호스트 · 상태 · 실행 기록 링크)와
    실행 한 건을 적는 기록 형식(단계별 성공·실패, 사용자 개입 횟수, 소요 시간,
    막힌 지점)을 넣는다.
  - `docs/install.md`에 지원 현황 표(열: 호스트 · 상태)를 넣고, `미검증` 호스트는
    설치 방법만 적고 지원한다고 쓰지 않는다는 규칙을 명시한다. 호스트 상태는
    매트릭스에서 그 호스트의 저장소 유형 세 행이 **모두** `검증됨`일 때만
    `검증됨`이고 나머지는 `미검증`이다.
  - `README.md`의 호스트 문구를 「설치됩니다」 수준으로 두고 지원 선언으로 읽히지
    않게 다듬은 뒤 `docs/install.md` 지원 현황으로 링크한다.
  - `test/public-contract.test.js`에 매트릭스 정합 단언을 추가한다.
- 거부: `검증됨` / `미검증` 밖의 상태 문자열, 매트릭스에 없는 호스트의 지원 선언,
  매트릭스에 없는 저장소 유형, 실행 기록 없이 `검증됨`으로 바뀐 행을 거부한다.

## 변경 범위
- Modify `docs/PILOT.md` — 매트릭스 표와 실행 기록 형식, 상태 어휘 규칙을 추가한다.
- Modify `docs/install.md` — 지원 현황 표와 미검증 호스트 표기 규칙을 추가한다.
- Modify `test/public-contract.test.js` — 두 문서의 호스트 집합·상태 일치와 상태
  어휘를 단언한다.
- Modify `docs/compatibility.md` — 지원 선언 규칙이 계약 문서에서 참조되도록 한 줄 링크한다.
- Modify `README.md` — 네 호스트를 지원 목록처럼 읽히게 두지 않고 설치 가능 목록으로
  두면서 지원 현황 표를 링크한다.

## 변경 금지
- `scripts/` — 문서와 테스트만 바뀐다. 파일럿 기록을 위한 CLI를 만들지 않는다.
- `docs/gates.md`, `docs/cli.md` — 이 task는 지원 선언만 다룬다.
- `.github/`, `.gitlab-ci.yml` — CI 계약은 BP001이 확정했다.

## 제약 조건
- 상태 어휘는 `검증됨`과 `미검증` 둘뿐이다. 「부분 지원」 같은 중간 값을 만들면
  판정이 사람 해석으로 돌아간다.
- 이 task는 어떤 행도 `검증됨`으로 바꾸지 않는다. 실행 증거가 없기 때문이다.
- 저장소 유형은 세 종을 고정하고 그 정의를 문서에 적는다. 예: 애플리케이션 저장소,
  모노레포, 문서·설정 중심 저장소.
- 호스트 목록은 `docs/install.md`가 이미 설치를 설명하는 네 호스트와 같아야 한다.
  새 호스트를 여기서 추가하지 않는다.
- 기존 「이미 알려진 마찰」 표와 기록 방법 절을 지우지 않는다. 파일럿 참가자가
  참조하는 부분이다.
- 테스트는 표의 행 구성만 본다. 설명 산문을 판정하지 않는다.
