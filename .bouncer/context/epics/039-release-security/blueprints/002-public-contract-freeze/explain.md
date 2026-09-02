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
      quiz_score: '2/3'
      disposition: "공개 계약·파일럿 정합성의 핵심은 이해했으며 폐기 절차의 minor/major 순서를 기록함"
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
