---
type: bouncer.blueprint
title: BP 설명 문서 계약을 세우고 마감 게이트를 이해 기록 검사로 교체
description: explain.md 문서 종류 신설, G9 폐지, G15 이해 게이트
resource: .bouncer/context/epics/018-task-unit-commits/blueprints/005-explain-doc-contract/index.md
tags:
  - bouncer
  - blueprint
timestamp: '2026-08-05T09:09:32.892+09:00'
bouncer:
  id: '005'
  epic_id: '018'
  blueprint_id: '005'
  status: approved
  commit_type: feat
  commit_intent:
    - BP 회고 문서가 본문 검사 없이 상태만으로 마감을 통과해 사람이 변경을 이해했는지가 저장소 어디에도 남지 않았음
    - 설명 문서와 이해 기록을 문서 계약으로 세우고 마감 게이트가 그 둘을 판정하게 함
---
# 001 explain-doc-contract

Epic: [018](../../index.md)

## Intent
- 문제: 마감 게이트가 검사하는 것은 `distill.md`의 `status == published` 하나뿐이다.
  본문이 비어 있어도, 회고가 diff와 무관해도 통과한다. 문서 종류(`bouncer.distill`)와
  게이트(`G9`)가 이미 그 자리를 차지하고 있어, 설명과 이해 기록을 얹으려면 기존 계약을
  교체해야 한다.
- 완료 조건: `bouncer.explain` 문서 종류와 `scaffold explain` 명령이 존재하고,
  `validate --gate finalize`가 `G15`로 다섯 섹션의 본문·`comprehension` 기록·`diff_sha`
  일치를 판정한다. `bouncer.distill`과 `G9`는 코드에서 사라진다. 013 성공 조건
  1–4, 6, 7이 참이 되고 `npm test`가 통과한다.

## Contract
- 인터페이스: 새 문서 종류 `bouncer.explain` — id 접두 `EXPLAIN-`, 상태
  `draft | published`, 파일명 `explain.md`. `bouncer.distill`은 등록에서 제거한다.
- 인터페이스: `bouncer scaffold explain --blueprint <dir>`가 `scaffold distill`을
  대체한다. 파일이 이미 있으면 아무것도 만들지 않고 빈 `created`를 돌려주는 현재 성질을
  유지한다.
- 인터페이스: 새 모듈이 `base..HEAD` 변경에서 거버넌스 문서를 제외한 해시를 계산한다.
  ```ts
  computeDiffSha(opts: {
    repoRoot: string;
    base: string;              // 포인터의 base 브랜치
    exec?: ExecFn;             // 테스트 주입용
  }): { ok: true; sha: string } | { ok: false; reason: DiffShaFailure };
  // DiffShaFailure = 'no-base' | 'not-a-repo' | 'exec-failed'
  ```
  실패는 던지지 않고 이유를 담은 값으로 돌려준다.
- 데이터·상태: `explain.md` 프론트매터에 `bouncer.comprehension` 블록이 선다.
  ```yaml
  bouncer:
    status: draft | published
    comprehension:
      diff_sha: ''          # 스캐폴드 기본값
      quiz_score: ''        # 예: '3/5'
      disposition: ''       # 자유 문자열. 빈 값은 미기록으로 판정
      recorded_at: ''
  ```
- 데이터·상태: `explain.md` 본문은 다섯 섹션이다 — `## Background`, `## Intuition`,
  `## Code`, `## Quiz`, `## 이해 상태`. 판정 규칙은 `G10`과 같다: 헤딩만 있고 본문이
  비면 미작성.
- 수용 기준: `validate --gate finalize`가 `G9` 대신 `G15`를 낸다. `G15`는 세 갈래로
  실패한다 — 섹션 미작성, `comprehension` 기록 누락, `diff_sha` 불일치. 코드에
  `quiz_score` 값을 비교해 실패를 만드는 경로가 없다.
- 수용 기준: `explain.md` 자신이 커밋에 포함돼도 `diff_sha`가 변하지 않는다.
- 검증 명령: `npm test`
- 실패 모드·엣지 케이스: base 브랜치가 없거나 저장소가 아니면 `computeDiffSha`가
  `ok: false`를 돌려주고, `G15`는 그 이유를 담아 **실패**한다. 계산 불가를 통과로
  처리하지 않는다.
- 실패 모드·엣지 케이스: `explain.md`가 아예 없으면 `G15`가 문서 부재로 실패한다.
  존재하지 않는 블루프린트 경로는 기존대로 `S11`이 맡고 `G15`로 새지 않는다.
- 실패 모드·엣지 케이스: 다른 에픽에 남은 `distill.md`는 읽지도 검사하지도 않는다.
  마이그레이션도 삭제도 하지 않는다.
- 실패 모드·엣지 케이스: `diff_sha`가 빈 문자열이면 불일치가 아니라 기록 누락으로
  판정한다 — 스캐폴드 직후 상태와 잘못된 해시를 구분해 보고한다.

## Out of scope
- `skills/explain-diff/` 신설과 퀴즈 채점 흐름. 002가 맡는다. 이 커밋은 문서 계약과
  게이트만 세우고, 본문을 누가 어떻게 쓰는지는 정하지 않는다.
- 프로젝트 `Distill.md` 승격 규칙 변경과 PR 본문 통합. 003이 맡는다.
- `PROJECT_DISTILL` 상수와 `.bouncer/context/Distill.md`의 내용·형식. 이름이 비슷할
  뿐 다른 문서다.
- 점수 임계값, 옵트아웃 플래그.

## One-commit justification
- 문서 종류 등록(`schema`), 파일명 대응(`paths`), 템플릿, 스캐폴드, 게이트 판정
  (`validate`)은 하나의 계약을 다섯 파일에 나눠 적은 것이다. 하나만 바꾸면 나머지가
  깨지므로 쪼갤 수 없다.
- `advisor`와 `bouncer-finalize` 스킬의 문자열은 이름이 바뀐 명령을 가리키는 호출부다.
  같은 커밋에서 고쳐야 `npm test`가 초록으로 남는다.
- `scripts/lib/*.js`는 `scripts/src/**`의 빌드 산출물이라 같은 커밋에 함께 든다.

## Documents
* [Tasks](tasks.md) - 구현 브리프
* [Verification](verification.md) - 검증 명령과 증적
* [Review](review.md) - 리뷰 발견사항
<!-- explain.md는 plan scaffold에 포함되지 않습니다. /bouncer-finalize가 작성합니다. -->
