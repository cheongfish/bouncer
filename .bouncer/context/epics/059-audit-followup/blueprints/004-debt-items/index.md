---
type: bouncer.blueprint
title: 감사 부채 항목 정리
description: 커밋 탐지와 YAML 진단 결함을 고치고 나머지 감사 부채의 유지 결정을 기록한다
resource: .bouncer/context/epics/059-audit-followup/blueprints/004-debt-items/index.md
tags:
  - bouncer
  - blueprint
timestamp: '2026-08-31T10:40:22.463+09:00'
bouncer:
  id: '004'
  epic_id: '059'
  blueprint_id: '004'
  status: approved
  commit_type: fix
  scale: full
  supersedes: []
---
# 004 감사 부채 항목 정리

Epic: [059](../../index.md)

## Intent
- 문제: 감사 항목 B7–B11·B16은 성격이 서로 다르다. B8의 명령어 탐지와 B16의 YAML 작성·진단은 재현 가능한 결함이지만, B7·B9·B10·B11은 이해 확인·프로토콜 호환성·문서 테스트 이행·단일 활성 포인터라는 기존 설계 결정과 맞닿아 있다.
- 완료 조건: B8과 B16은 실패 테스트로 재현한 뒤 기존 계약을 바꾸지 않는 범위에서 고치고, B7–B11 전체의 처리 결과와 유지 근거를 사람이 찾을 수 있는 한 문서에 남긴다.

## Contract
- 인터페이스:
  - 커밋 가드는 명령어 위치의 `"git"`과 `g"it"`을 `git` 실행으로 인식하되, 인자 위치의 인용 문자열은 명령어로 오인하지 않는다.
  - 계획 frontmatter를 쓰는 규칙은 YAML 예약 지시자로 시작하는 문자열을 인용하도록 명시한다. task `commit_intent`와 context-review finding `note`가 같은 규칙을 따른다.
  - full blueprint의 `context-review.md`가 존재하지만 frontmatter 파싱에 실패하면 S0과 함께 “invalid frontmatter” 진단을 내고, 부재용 scaffold 안내를 내지 않는다.
  - `docs/audit-debt-decisions.md`는 B7–B11 각각의 처분, 근거, 재검토 조건을 한 표에서 제공한다.
- 데이터·상태: 게이트 코드와 status enum, 포인터·verify 원장 위치, comprehension 필드는 바꾸지 않는다. 새 런타임 상태나 설정 키를 만들지 않는다.
- 수용 기준: epic 성공조건 7–9. B8·B16 재현 테스트가 통과하고 B7–B11 처리 표가 문서 목차에서 연결된다.
- 검증 명령: `npm run ci`
- 실패 모드·엣지 케이스:
  - `echo "git" commit`이나 `git log --grep "commit"`을 커밋으로 오탐하면 커밋 가드가 일반 명령을 막는다.
  - `git commit -m "-a"`의 인용 메시지를 all-flag로 읽으면 검사 범위가 잘못 넓어진다.
  - 문자열 중간의 백틱은 유효하지만 첫 문자가 백틱인 YAML 평문 scalar는 파서가 거절한다. 인용 규칙은 두 경우를 구분해야 한다.
  - 파싱 실패를 문서 부재로 보고하면 사용자가 이미 존재하는 `context-review.md`를 다시 scaffold하려다 두 번째 오류를 만난다.
  - B7의 필수 퀴즈를 `autonomy: auto`가 생략하게 하면 G16 comprehension 계약이 약해지고, B11을 저장소 내 병렬화하면 공유 포인터와 verify 원장이 서로 덮어쓴다.

## Out of scope
- B5 DeepSWE 효과 입증, B6 지시문 합계 예산, B12 두 번째 커미터.
- P04 light 기본화와 024·043의 경량 계약 재작업.
- G/S 코드 추가·삭제·재사용, 게이트 통과 조건 변경, 포인터·원장의 저장 위치 변경.
- 악의적 셸 우회를 막는 완전한 셸 파서와 저장소 내부 병렬 blueprint 실행.
- 사용자 소유 감사 원문 `bouncer-audit.md` 및 이미 닫힌 blueprint 문서 수정.

## One-commit justification
- 한 PR에서 “감사 부채를 수정 또는 명시적 결정으로 닫는다”는 결과를 리뷰한다. 구현은 B8 탐지, B16 작성 규칙, B16 진단, 결정 기록의 네 독립 커밋으로 나눠 각 task가 단독으로 검증 가능하게 한다.

## Documents
* [Tasks 001](tasks/001/tasks.md) - 따옴표가 섞인 git 명령어 탐지
* [Tasks 002](tasks/002/tasks.md) - YAML frontmatter 인용 규칙
* [Tasks 003](tasks/003/tasks.md) - context-review 파싱 실패 진단
* [Tasks 004](tasks/004/tasks.md) - B7–B11 처리 결정 기록
* [Verification 001](tasks/001/verification.md) - 검증 명령과 증적
* [Review 001](tasks/001/review.md) - 리뷰 발견사항
* [Verification 002](tasks/002/verification.md) - 검증 명령과 증적
* [Review 002](tasks/002/review.md) - 리뷰 발견사항
* [Verification 003](tasks/003/verification.md) - 검증 명령과 증적
* [Review 003](tasks/003/review.md) - 리뷰 발견사항
* [Verification 004](tasks/004/verification.md) - 검증 명령과 증적
* [Review 004](tasks/004/review.md) - 리뷰 발견사항
* [Context review](context-review.md) - 계획 문서 정합성 판정
<!-- explain.md는 plan scaffold에 포함되지 않습니다. /bouncer-finalize가 작성합니다. -->
