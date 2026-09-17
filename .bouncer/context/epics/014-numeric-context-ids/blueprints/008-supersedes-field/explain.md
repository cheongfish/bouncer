---
type: bouncer.explain
title: 002 explain
description: Explain for 002
resource: .bouncer/context/epics/014-numeric-context-ids/blueprints/008-supersedes-field/explain.md
tags:
  - bouncer
  - explain
timestamp: '2026-08-25T10:52:45.374+09:00'
bouncer:
  id: EXPLAIN-008
  epic_id: '014'
  blueprint_id: '008'
  status: published
  comprehension:
    - range_from: develop
      range_to: a863fb3bbf584fd7c426cbb3db96f84108078f3c
      diff_sha: b905e4cbae8ca0ac7fc59b11f25eee12153ff6f8f62c5652dfcad36911987190
      quiz_score: 3/3
      disposition: S27 거절 조건·스캐폴드 대상·부재 허용을 모두 맞춤
      recorded_at: '2026-08-25T10:54:29+09:00'
---
# Explain

## Background
프론트매터에서 값만 읽어 뽑을 수 있는 관계는 포함(epic→bp→task), 문서→코드 경로,
문서→후보 경로까지다. 결정→결정 계보는 빠져 있다. blueprint status에 `superseded`는
있지만 무엇이 무엇을 대체했는지 적을 칸이 없어서, Distill 과거 결정과 충돌할 때
매번 전문 검색에만 의존한다.

이번 PR은 epic·blueprint에 `bouncer.supersedes` 자리와 형식 검사(S27)만 넣는다.
값을 채우는 판단과 읽는 소비자는 나중 일이다. 기존 문서에는 소급하지 않는다.

## Intuition
주소록에 「이전 주소」 칸을 만든 것과 같다. 비어 있어도 되고, 형식만 맞으면
통과한다. 그 주소가 실제로 존재하는지는 이번 검사가 보지 않는다.

## Code
- `scripts/src/lib/schema.ts` — `isValidSupersedes` (부재·빈 배열·비공백 문자열 배열만 통과)
- `scripts/src/lib/scaffold.ts` — epic·blueprint에 `supersedes: []` (task 등에는 없음)
- `scripts/src/lib/validate-structural.ts` — epic·blueprint만 S27
- 문서: `docs/compatibility.md`·`docs/gates.md`·`docs/troubleshooting.md`의 S27,
  `rules/okf.md` Plan fields

## Quiz
1. S27이 거절하는 경우는?
   - A) 존재하지 않는 문서를 가리키는 경로
   - B) `supersedes`가 문자열이거나 원소가 빈 문자열인 배열
   - C) epic에 `supersedes: []`가 있는 경우

2. 스캐폴드가 `supersedes: []`를 넣는 문서 종류는?
   - A) epic과 blueprint만
   - B) epic·blueprint·tasks
   - C) 모든 OKF 문서 종류

3. 기존 epic·blueprint에 `supersedes` 키가 없을 때 구조 검사는?
   - A) S27로 실패한다
   - B) 마이그레이션이 빈 배열을 채운 뒤에야 통과한다
   - C) 통과한다 (부재는 허용)

## 이해 상태
- quiz_score: 3/3
- 정답: 1-B, 2-A, 3-C
- 응답: 1-B, 2-A, 3-C (전부 맞음)
- disposition: S27 거절 조건·스캐폴드 대상·부재 허용을 모두 맞춤
- range: develop..a863fb3bbf584fd7c426cbb3db96f84108078f3c
- diff_sha: b905e4cbae8ca0ac7fc59b11f25eee12153ff6f8f62c5652dfcad36911987190

## Tasks

### Task 001

#### Goal & intent

epic과 blueprint 프론트매터에 `bouncer.supersedes`가 생긴다. `schema.ts`가 허용
형태 판정을 한 곳에서 export하고, `scaffold epic` / `scaffold blueprint`가 빈
배열을 쓰며, 형식이 틀리면 `bouncer validate`가 S27로 거절한다. 필드가 없는 기존
문서 616개는 전부 그대로 통과한다. 값을 채우는 것은 사람의 판단이고, 이번 작업은
자리와 형식 검사까지다.

#### Interface

- 제공: `schema.ts`가 `isValidSupersedes(value)`를 export한다. 판정은
  `undefined`(부재) 통과, 빈 배열 통과, 그리고 모든 원소가 공백이 아닌 문자열인
  배열 통과다.
- 제공: `scaffold epic`이 만든 epic `index.md`와 `scaffold blueprint`가 만든
  blueprint `index.md`의 `bouncer` 블록에 `supersedes: []`가 있다.
- 제공: `validate-structural.ts`가 `S27`을 낸다. 대상은 `bouncer.epic`과
  `bouncer.blueprint` 두 종류뿐이다.
- 거부: 배열이 아닌 값(문자열·객체·숫자), 원소에 빈 문자열·공백 문자열·비문자열이
  섞인 배열은 S27로 거절한다.
- 거부하지 않음: 존재하지 않는 문서를 가리키는 경로, 자기 자신 참조, 순환,
  중복 원소. 참조 무결성을 검사하지 않는다.
- 거부하지 않음: task·verification·review·explain·context_review 문서에 이 필드가
  있는 경우. 미등록 키를 거절하는 규칙을 새로 만들지 않는다.

#### Touch

- Modify `scripts/src/lib/schema.ts` — `isValidSupersedes`를 구현하고 export한다.
- Modify `scripts/lib/schema.js` — 커밋되는 CJS emit.
- Modify `scripts/src/lib/scaffold.ts` — `scaffoldEpic`과 `scaffoldBlueprint`의
  `bouncer` 블록에 `supersedes: []`를 더한다.
- Modify `scripts/lib/scaffold.js` — 커밋되는 CJS emit.
- Modify `scripts/src/lib/validate-structural.ts` — `schema.ts`의 판정을 import해
  S27을 낸다.
- Modify `scripts/lib/validate-structural.js` — 커밋되는 CJS emit.
- Modify `test/schema.test.js` — `isValidSupersedes`의 통과·거부 입력을 단언한다.
- Modify `test/scaffold.test.js` — epic·blueprint에 `supersedes: []`가 있고
  task·verification·review에는 없다는 것을 단언한다.
- Modify `test/validate-structural.test.js` — S27의 거부와 부재 통과를 단언한다.
- Modify `docs/compatibility.md` — 「게이트 코드」 절의 S 범위와 목록에 `S27`을
  더한다. `test/public-contract.test.js`가 이 문서와 구현의 코드 집합을 대조한다.
- Modify `docs/gates.md` — 범위 문장 `S0–S26`을 `S0–S27`로 고치고 사람용 S 코드
  설명에 S27 한 줄을 더한다.
- Modify `docs/troubleshooting.md` — S 코드 표에 S27 행을 더한다. 그 표는 사람이
  프론트매터를 고쳐 푸는 위반만 담은 부분 집합이고 S27이 거기 해당한다.
- Modify `rules/okf.md` — Plan fields 문단에 `bouncer.supersedes`의 의미와
  "형식만 검사한다"는 한계를 영어 한두 문장으로 적는다.

#### Constraints

- 판정은 `schema.ts`에 한 번만 구현하고 `validate-structural.ts`가 import한다.
  epic 성공 조건 4가 `schema.ts`의 export를 요구하므로 그쪽이 집이다.
  `isValidGraphBasis`는 `validate-structural.ts`에 있지만, 그것은 S9와 G4가
  같은 술어를 쓰게 하려는 배치이고 스키마 상수 export와는 다른 문제다.
  어느 쪽이든 구현은 한 곳뿐이라는 규율은 같다.
- `docs/compatibility.md`의 **「문서 스키마」 표**에는 `supersedes`를 넣지 않는다.
  `test/public-contract.test.js`가 그 표 행의 backtick 토큰 중 `type`·`status`·
  `bouncer.*`가 아닌 것을 전부 status 값으로 간주해 `STATUS_ENUM` 값 집합과
  대조하므로, 열거값이 없는 필드 이름을 표에 넣으면 즉시 깨진다. 절 산문의
  backtick은 `SCALE_ENUM`·`AUTONOMY_ENUM` 쪽에서 따로 수집되므로 표와 규칙이
  다르다. 「게이트 코드」 절에는 `S27`을 반드시 넣는다 — 그 절은
  `scripts/lib/*.js`의 `'S27'` 리터럴 수집 결과와 대조되므로, 빠지면 같은
  테스트가 실패한다.
- S27은 새 번호다. 결번(G9·G15·S14)을 재사용하지 않는다.
- 필드 부재는 어떤 문서 종류에서도 실패가 아니다. `scale`이 S20에서 부재를
  허용하는 것과 같은 계약이다.
- `commit_type`·`scale`처럼 `supersedes`도 epic·blueprint 전용이다. 스캐폴드가
  task·verification·review·context_review에 쓰지 않는다.
- 공개 문자열과 코드 주석은 한국어를 유지한다. `rules/okf.md`는 영어다.
