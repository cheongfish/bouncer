---
type: bouncer.explain
title: 지시문 층 역할 헌장과 재진술 제거
description: 네 지시문 층의 경계를 표로 세우고 마스터 룰·core.md 재진술을 지우며 Distill 승격과 설치 안내를 그 경계에 맞춘다
resource: .bouncer/context/epics/059-audit-followup/blueprints/002-instruction-layers/explain.md
tags:
  - bouncer
  - explain
timestamp: '2026-08-31T09:51:56.475+09:00'
bouncer:
  id: EXPLAIN-002
  epic_id: '059'
  blueprint_id: '002'
  status: published
  comprehension:
    - range_from: develop
      range_to: a15fa5b46caba38c678c441b40e8e0f8c68dc96e
      diff_sha: '6bc024191e7b443b5d54a7546c464962927ad601a5ee330ca59815cdc1fca4d8'
      quiz_score: '3/4'
      disposition: 사다리 2·3단을 stdlib→native로 골랐고 native→stdlib·YAGNI 부재가 정답임
      recorded_at: '2026-08-31T09:54:18+09:00'
---
# Explain

## Background

지시문은 하드룰, 워크플로 절차, 공유 계약, 이 저장소에서만 참인 사실 네 층인데
어느 층이 무엇을 말하는지 적은 문서가 없었다. 같은 문장이 `CLAUDE.md`와 스킬에
겹치고, `always: true`인 `.bouncer/distill/core.md`가 마스터 룰과 `rules/`를
다시 실었다. 승격은 동의만 받고 상위 층 재진술인지 묻지 않았다.

`docs/install.md`는 호스트 플러그인 설치가 `bouncer-root`를 PATH에 올린다고
적었는데, 호스트는 캐시 복사만 하고 `npm install`을 돌리지 않는다. 워크플로
셸 첫 줄이 그 명령이라 등록 전에는 `command not found`로 죽는다.

이 회차는 헌장 표를 `CLAUDE.md`에 두고, 스킬이 이미 더 구체적으로 말하는
하드룰 본문은 `Detail:` 포인터로 줄이고, 승격 제안에 재진술 제외를 넣고,
`core.md` 네 절과 implementer 사다리 순서를 정본에 맞추고, 설치 안내를
경로별로 고친다.

## Intuition

네 층 표가 정본이고, 아래 층은 위 층이 이미 말한 문장을 다시 쓰지 않는다.

## Code

- `CLAUDE.md` — `## Instruction layers` 표. 하드룰 7은 Distill 정본 경로,
  승격 동의 한 번, `--route` 합산을 샤드 본문으로 붙이지 않는다는 셋만 남기고
  절차는 스킬·레퍼런스로 포인터. 세션수칙 4는 `references/verification/index.md`.
- `test/master-rules.test.js` — 옮겨 간 문자열은 보유 파일에 `match`,
  `CLAUDE.md`에는 `doesNotMatch`.
- `skills/bouncer-finalize/references/distill-promotion.md`,
  `references/spec-authoring/index.md` — `add`/`replace` 앞에서 상위 세 층을
  보고, 제외 목록을 제안과 같은 ACQ에 싣는다. `drop`에는 제외를 적용하지 않는다.
- `.bouncer/distill/core.md` — 하드룰 1 불릿 전체, 포인터 표면 재진술,
  워크플로 순서 재진술, "minimality는 스킬에만 산다"를 지움. 포인터 파일
  경로·JSON, G16, confirm-then `--set`, `scripts/`가 Intensity 매핑을 읽지
  않는다는 문장은 남김.
- `agents/bouncer-implementer.md` — 사다리 2·3단을 native → stdlib. YAGNI
  단은 구현 경로에 없다(승인된 브리프를 줄이지 않음).
- `docs/install.md`, `rules/plugin-root.md` — 호스트 설치는 `scripts/`를
  PATH에 넣는 단계. 로컬 `npm install`은 `node_modules/.bin`. `-g` / `npm link`는
  prefix `bin`. `BOUNCER_HOME`은 한 번 오버라이드.

## Quiz

1. Distill 층(`## Instruction layers`의 Repo-true)에 앉힐 문장은 무엇인가?
   - A) 모든 호스트에서 같은 워크플로 순서
   - B) 이 체크아웃에서만 참인 사실
   - C) 게이트 코드가 읽는 설정 키

2. Distill 승격에서 상위 층이 이미 같은 계약을 말할 때 어떻게 하는가?
   - A) `drop` 목록에 넣고 게이트를 실패시킨다
   - B) `add`/`replace`에서 조용히 버린다
   - C) `add`/`replace`에서 빼되 제외 목록과 근거 경로를 같은 ACQ에 싣는다

3. 이 회차 이후 implementer 사다리 2·3단과 YAGNI는?
   - A) native 다음 stdlib. YAGNI 단은 구현 경로에 없다
   - B) stdlib 다음 native. YAGNI를 에이전트에 넣었다
   - C) native만 남기고 stdlib 단을 지웠다

4. 호스트 플러그인 설치에서 `bouncer-root`는 어떻게 등록하는가?
   - A) `"private": true`를 끄면 호스트가 bin을 링크한다
   - B) 플러그인 루트 `scripts/`를 PATH에 넣는다. 로컬 `npm install`은
     `node_modules/.bin`만 링크한다
   - C) `npm install -g bouncer`로 레지스트리 패키지를 깐다

## 이해 상태

퀴즈 4문항, 응답 4, 정답 3 (`quiz_score: 3/4`).

- Q1 Repo-true: B (정답). 응답 B. 맞음.
- Q2 승격 제외: C (정답). 응답 C. 맞음.
- Q3 사다리: A (정답, native→stdlib, YAGNI 없음). 응답 B. 틀림.
- Q4 호스트 PATH: B (정답). 응답 B. 맞음.

disposition: 사다리 2·3단을 stdlib→native로 골랐고 native→stdlib·YAGNI 부재가 정답임.
range_from `develop` .. range_to `a15fa5b46caba38c678c441b40e8e0f8c68dc96e`.
diff_sha `6bc024191e7b443b5d54a7546c464962927ad601a5ee330ca59815cdc1fca4d8`.
