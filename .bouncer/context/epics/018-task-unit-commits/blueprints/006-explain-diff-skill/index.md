---
type: bouncer.blueprint
title: explain-diff 스킬을 신설하고 마감 단계에 설명·퀴즈·이해 기록을 배선함
description: skills/explain-diff 신설, finalize·spec-authoring·계약 테스트 배선
resource: .bouncer/context/epics/018-task-unit-commits/blueprints/006-explain-diff-skill/index.md
tags:
  - bouncer
  - blueprint
timestamp: '2026-08-05T09:50:11.577+09:00'
bouncer:
  id: '006'
  epic_id: '018'
  blueprint_id: '006'
  status: approved
  commit_type: feat
  commit_intent:
    - 마감이 설명 문서 저술을 spec-authoring에 맡겨 퀴즈·이해 기록 절차가 없고 G15 기록을 채울 경로가 스킬에 없었음
    - explain-diff 스킬로 저술·채점·comprehension 기록을 맡기고 finalize가 그 스킬을 호출하게 함
---
# 002 explain-diff-skill

Epic: [018](../../index.md)

## Intent
- 문제: 001이 `explain.md` 계약과 G15를 세웠지만, 본문을 누가 어떻게 쓰고
  퀴즈를 채점해 `bouncer.comprehension`을 남기는지는 스킬에 없다. finalize 1단계는
  여전히 `spec-authoring`을 가리켜 distill 시대의 승격 안내와 explain 저술이 한곳에
  섞여 있고, 퀴즈 채점·`diff_sha` 기록 절차가 없다.
- 완료 조건: `skills/explain-diff/SKILL.md`가 존재하고 `/bouncer-finalize`가 explain
  저술·퀴즈·comprehension 기록에 그 스킬을 쓴다. Distill 승격은 이 BP에서
  `spec-authoring` 호출로 남긴다(003이 승격 규칙을 바꾼다). 관련 계약 테스트와
  `npm test`가 통과한다.

## Contract
- 인터페이스: 하위 스킬 `explain-diff` — 경로 `skills/explain-diff/SKILL.md`.
  finalize만 호출한다. 워크플로 진입점(`bouncer-*`)이 아니다.
- 인터페이스 (`explain-diff`): `scaffold explain`으로 파일이 생긴 뒤, 다섯 섹션
  (Background / Intuition / Code / Quiz / 이해 상태) 본문을 쓰고, 사람에게 Quiz를
  제시·채점하며, `bouncer.comprehension` 네 필드와 `bouncer.status → published`를
  기록한다.
- 인터페이스 (`explain-diff`): `diff_sha`는 기존 `computeDiffSha`로 채운다. base는
  `bouncer current`의 `base`(없으면 `config.base_branch`). 새 CLI·퀴즈 엔진을
  만들지 않는다.
- 인터페이스 (`explain-diff`): 하위 명령이 없으므로 스킬이
  `${BOUNCER_ROOT}/scripts/lib/comprehension`을 `node -e`로 직접 부른다. 호출
  형태는 스킬 본문에 실행 가능한 코드블록으로 고정하고, 계약 테스트가 그 모듈
  경로와 `computeDiffSha` 호출을 단언한다. `repoRoot`는 실행 중인 워크트리
  루트다.
- 인터페이스 (`/bouncer-finalize` 1단계): `scaffold explain` → `explain-diff` →
  Distill 승격은 기존처럼 `spec-authoring` → 이후 validate.
- 데이터·상태: `comprehension.diff_sha` / `quiz_score` / `disposition` /
  `recorded_at`을 스킬이 채운다. `quiz_score` 예: `'3/5'`. 점수로 게이트를
  막지 않는다.
- 수용 기준: finalize 본문이 explain 저술에 `skills/explain-diff/SKILL.md`를
  가리키고, 그 경로에 `spec-authoring`만으로 explain을 쓰라는 지시가 없다.
- 수용 기준: `spec-authoring`은 plan 문서와 Distill 승격만 다루며, BP `explain.md`
  본문 저술·퀴즈를 지시하지 않는다.
- 수용 기준: 스킬 계약 테스트가 `explain-diff` 신원·다섯 섹션(각각 개별 단언)·
  comprehension 네 필드(각각 개별 단언)·`scripts/lib/comprehension` 호출·점수
  비차단 문구를 단언하고, finalize/surface 테스트가 새 배선을 단언한다.
- 수용 기준: 점수 비차단은 "차단하지 않는다"는 **긍정 문구**로 단언한다.
  `threshold` 같은 낱말의 부재로 단언하지 않는다 — 설명문에 그 낱말이 나오면
  자기모순으로 실패한다.
- 검증 명령: `npm test`
- 실패 모드·엣지 케이스: `explain.md`가 없으면 finalize가 먼저 scaffold한 뒤
  스킬에 들어간다. 스킬은 scaffold를 대체하지 않는다.
- 실패 모드·엣지 케이스: 빈 `diff_sha`/`disposition`은 G15 기록 누락이다. 스킬은
  네 필드를 채운 뒤에만 호출 측이 finalize 게이트를 돌리게 한다.
- 실패 모드·엣지 케이스: `computeDiffSha`가 `ok: false`면 해시를 꾸며 넣지 않고
  실패 이유를 보고한 뒤 멈춘다.

## Out of scope
- Distill 승격 규칙 변경·`## 이해 상태` 승격 제외·PR 본문 생성 (003).
- G15 스키마·`computeDiffSha`·게이트 판정 로직 재설계 (001 완료).
- 점수 임계값 차단, 이해 게이트 옵트아웃, HTML/브라우저 퀴즈.
- `/bouncer-execute`에 explain 배치.
- 새 `bouncer` CLI 하위 명령(퀴즈·comprehension 기록용).

## One-commit justification
- 스킬 본문, finalize 호출부, `spec-authoring` 정리, 템플릿 주석, 계약 테스트는
  한 배선의 양끝이다. 스킬만 생기면 테스트가 깨지고, finalize만 바꾸면 대상
  스킬이 없다.
- `scripts/lib/templates.js`는 소스와 같은 커밋의 빌드 산출물이다.

## Documents
* [Tasks](tasks.md) - 구현 브리프
* [Verification](verification.md) - 검증 명령과 증적
* [Review](review.md) - 리뷰 발견사항
<!-- explain.md는 plan scaffold에 포함되지 않습니다. /bouncer-finalize가 작성합니다. -->
