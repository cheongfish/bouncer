---
type: bouncer.explain
title: 001 explain
description: Explain for 001
resource: .bouncer/context/epics/018-task-unit-commits/blueprints/016-comprehension-gate-move/explain.md
tags:
  - bouncer
  - explain
timestamp: '2026-08-12T13:20:37.604+09:00'
bouncer:
  id: EXPLAIN-016
  epic_id: '018'
  blueprint_id: '016'
  status: published
  comprehension:
    - range_from: develop
      range_to: d2625d674bbc36983838003eb117073e006427f5
      diff_sha: 6c05e0115dbd4f1c9f692f55a1e88889b0353f751eb996065efb90576f6c416e
      quiz_score: 2/2
      disposition: 스테이징 읽기 실패→G17, makeAllowed는 scope로 옮겨 순환을 끊음
      recorded_at: '2026-08-12T13:36:46+09:00'
---
# Explain

## Background
이해 기록은 blueprint당 엔트리 하나이고, finalize G16이 그 `diff_sha`를
`range_from..HEAD`와 대조한다. commit 게이트는 `explain.md`를 보지 않는다.
포인터 task의 G6/G7/G8을 다시 보고, 스테이징 경로가 `affected_paths` 안인지
G17로 검사한다. G15 번호는 비운다. `makeAllowed` 등은 `finalize.ts`에 있어
`validate`가 그대로 가져오면 순환이 생기므로 `scope.ts`로 옮겼다.
`/bouncer-commit`에서 explain·퀴즈를 빼고 `/bouncer-finalize`로 옮겼다.

## Intuition
마감 도장은 finalize가 찍고, 커밋 직전엔 「지금 올린 파일이 이 task 칸 안인가」만
본다. 도장 잉크통(`makeAllowed`)은 공통 서랍(`scope`)에 빼 둔다.

## Code
- `scripts/src/lib/comprehension.ts` — `resolveComprehensionEntry`(마지막 엔트리).
- `scripts/src/lib/scope.ts` — `isUnder`·`RUNTIME_ARTIFACTS`·`isRuntimeArtifact`·
  `makeAllowed`. `finalize`/`commit`/`commit-guard`/`seed-worktree`가 여기서 가져온다.
- `scripts/src/lib/validate.ts` — commit: G6/G7/G8 + `deps.stagedFiles` → G17.
  git 실패는 예외가 아니라 G17. G15는 결번 주석만. finalize G16은 BP 단일
  엔트리 `diff_sha` 대조.
- 스킬: `bouncer-commit`에서 explain-diff 제거, `bouncer-finalize`에 Distill 다음
  explain·퀴즈 단계 추가.
- 회귀: `test/validate-gates.test.js`(G17 위반·통과·staged 읽기 실패),
  `test/cli-commit.test.js`, `test/commit-task.test.js`,
  `test/skill-bouncer-finalize.test.js`.

## Quiz
1. `validate --gate commit`이 스테이징 목록을 못 읽으면?
   - A) 조용히 통과한다
   - B) G17 failure로 보고한다
   - C) G15 failure로 보고한다

2. `makeAllowed`를 `finalize.ts`에 그대로 두고 `validate.ts`가 가져오면?
   - A) 문제 없다 — finalize가 validate를 require하지 않는다
   - B) 순환 require가 생긴다 — 그래서 `scope.ts`로 옮긴다
   - C) G9가 막아주므로 옮겨도 그만이다

## 이해 상태
- 점수: 2/2
- Q1 정답 B / 응답 B — 맞음
- Q2 정답 B / 응답 B — 맞음
- disposition: 스테이징 읽기 실패→G17, makeAllowed는 scope로 옮겨 순환을 끊음

## Tasks

### Task 001

#### Goal & intent

`explain.md`의 `bouncer.comprehension`이 blueprint당 엔트리 하나가 되고,
finalize 게이트(G16)가 그 엔트리의 `diff_sha`를 `range_from..HEAD`와 직접
대조한다. task 번호로 엔트리를 찾던 계약과 G16의 task별 루프가 사라진다.
`quiz_score`가 필수 필드로 올라가, 퀴즈를 건너뛰고 `disposition`만 채운
문서는 finalize를 통과하지 못한다. commit 게이트 분기는 이 task에서 손대지
않는다 — TASKS-002가 통째로 다시 쓴다.

#### Interface

- 제공:
  - `comprehension.resolveComprehensionEntry(comprehension)` — 배열의 마지막
    엔트리를 반환. `{ ok: true, entry }` 또는
    `{ ok: false, reason: 'not-a-list' | 'missing' | 'incomplete' }`.
    절대 throw하지 않는다.
  - G16이 `computeDiffSha({ repoRoot, base: entry.range_from, exec })`로
    해시를 다시 계산하고 `entry.diff_sha`와 대조한다. 계산 실패와 불일치는
    서로 다른 메시지다.
- 거부:
  - 배열이 아닌 값(구 단일 객체 포함) → `not-a-list`.
  - 빈 배열 → `missing`.
  - `range_from` / `diff_sha` / `disposition` / `quiz_score` 중 하나라도
    비었거나 문자열이 아니면 → `incomplete`. `quiz_score: '0/0'`은 값이
    있으므로 형식상 통과이고, 이 계약이 막는 것은 빈 값이다.
  - `findComprehensionEntry`와 `normalizeTaskKey`는 남기지 않는다. 별칭도
    두지 않는다.

#### Touch

- Modify `scripts/src/lib/comprehension.ts` — `findComprehensionEntry`를
  `resolveComprehensionEntry`로 바꾸고 `quiz_score`를 필수 필드에 추가,
  `normalizeTaskKey`와 `duplicate` 사유를 제거한다.
- Modify `scripts/lib/comprehension.js` — 위 변경의 CJS 산출물 동기화.
- Modify `scripts/src/lib/validate.ts` — finalize 분기의 task별 루프를 단일
  엔트리 판정으로 바꾸고 `diff_sha` 대조를 추가한다.
- Modify `scripts/lib/validate.js` — 위 변경의 CJS 산출물 동기화.
- Modify `test/comprehension.test.js` — 엔트리 조회 테스트를 새 계약으로
  바꾸고 `quiz_score` 누락 케이스를 추가한다.
- Modify `test/validate-gates.test.js` — G16 픽스처와 단언을 단일 엔트리 +
  해시 판정으로 바꾼다.
- Modify `test/finalize.test.js` — `fullBlueprint` 픽스처의 comprehension
  엔트리에 `quiz_score`를 넣고 해시가 맞도록 맞춘다.
- Modify `test/scaffold.test.js` — 빈 배열 단언에 붙은 G15 설명 주석을 새
  판정 주체(G16)로 고친다.

#### Constraints

- `validate.ts`의 `commit` 게이트 분기는 이 task에서 고치지 않는다. G15
  코드가 그대로 남아 있어도 이 커밋은 완결이며, 제거는 TASKS-002가 한다.
- `scripts/lib/*.js`는 손으로 고치지 않는다. `npm run build`(또는 `pretest`)의
  산출물을 그대로 커밋한다.
- 하위 호환 별칭을 남기지 않는다. `findComprehensionEntry`라는 이름이 코드에
  남으면 안 된다.
- 0.7 문서 읽기 호환은 마이그레이션이 아니라 조회 규칙으로만 해결한다.
  변환 함수나 스크립트를 만들지 않는다.
- 실패 메시지는 기존 톤을 유지한다(영문 한 줄). 계산 실패와 해시 불일치는
  서로 다른 문자열이어야 한다.

### Task 002

#### Goal & intent

`validate --gate commit`이 `explain.md`를 더 이상 보지 않는다. 대신 포인터
task의 `tasks`/`verification`/`review` 상태를 G6/G7/G8로 다시 판정하고,
스테이징된 경로가 그 task의 `affected_paths` 안인지 신규 코드 G17로 검사한다.
G15는 폐기하고 번호를 비워 둔다. 검사에 필요한 `makeAllowed`가 `finalize.ts`
에 있고 `finalize.ts`가 `validate.ts`를 require하므로, 그 헬퍼들을 새 모듈
`scripts/src/lib/scope.ts`로 옮겨 순환을 만들지 않는다.

#### Interface

- 제공:
  - `scripts/src/lib/scope.ts` — `isUnder`, `RUNTIME_ARTIFACTS`,
    `isRuntimeArtifact`, `makeAllowed`. `finalize.ts`에 있던 구현을 그대로
    옮긴 것이며 동작은 바뀌지 않는다. 의존은 `./paths`와 `./layout`뿐이다.
  - `checkGate` commit 분기가 `deps.stagedFiles({ repoRoot })`로 스테이징
    목록을 얻는다. 기본 구현은 `git diff --cached --name-only`이고,
    `{ ok: true, files }` 또는 `{ ok: false, reason }`을 돌려준다. 절대
    throw하지 않는다.
  - 실패 코드는 G6/G7/G8(execute와 같은 문자열 계약)과 G17이다.
    G17 메시지는 위반 경로를 담는다.
- 거부:
  - 스테이징 목록을 읽지 못하면(저장소 아님, git 실패) G17 failure로 보고한다.
    조용히 통과시키지 않는다.
  - `affected_paths`가 비어 있으면 blueprint 디렉터리 밖 경로는 전부 위반이다
    (plan G5가 이미 비어 있는 값을 막으므로 새 예외를 두지 않는다).
  - `finalize.ts`는 옮긴 네 이름을 다시 export하지 않는다.

#### Touch

- Create `scripts/src/lib/scope.ts` — `isUnder`·`RUNTIME_ARTIFACTS`·
  `isRuntimeArtifact`·`makeAllowed`를 담는 새 모듈.
- Create `scripts/lib/scope.js` — 위 모듈의 CJS 산출물.
- Modify `scripts/src/lib/finalize.ts` — 옮긴 네 이름을 지우고 `./scope`에서
  가져다 쓰며, 재수출하지 않는다.
- Modify `scripts/lib/finalize.js` — 산출물 동기화.
- Modify `scripts/src/lib/commit.ts` — `makeAllowed`·`isRuntimeArtifact`
  import 출처를 `./scope`로 옮긴다.
- Modify `scripts/lib/commit.js` — 산출물 동기화.
- Modify `scripts/src/lib/commit-guard.ts` — 같은 import 이동.
- Modify `scripts/lib/commit-guard.js` — 산출물 동기화.
- Modify `scripts/src/lib/seed-worktree.ts` — `isUnder` import 이동.
- Modify `scripts/lib/seed-worktree.js` — 산출물 동기화.
- Modify `scripts/src/lib/validate.ts` — commit 분기를 G6/G7/G8 + G17로 다시
  쓰고 G15 코드를 결번 주석으로 남긴다.
- Modify `scripts/lib/validate.js` — 산출물 동기화.
- Modify `test/validate-gates.test.js` — commit 게이트 테스트를 새 판정으로
  교체하고 G17 케이스를 추가한다.
- Modify `test/cli-commit.test.js` — G15를 기대하던 단언을 새 코드로 바꾼다.
- Modify `test/commit-task.test.js` — commit 게이트가 explain을 보지 않으므로
  `comprehensionOk` 분기를 정리한다.
- Modify `test/finalize-pure.test.js` — `makeAllowed`·`isUnder` import 출처를
  `scripts/lib/scope`로 바꾼다.
- Modify `test/validate-structural.test.js` — G15를 가리키는 설명 주석을
  현재 코드로 고친다.

#### Constraints

- G15 번호를 재사용하지 않는다. `validate.ts`에 결번 주석 한 줄만 남긴다
  (`G9` 결번 주석과 같은 형식).
- `bouncer commit` / `bouncer finalize`의 스테이징·커밋 동작은 바꾸지 않는다.
  G17은 같은 판정을 게이트에서 한 번 더 하는 것이다.
- `scope.ts`로의 이동은 순수 이동이다. 함수 본문·시그니처·주석을 다시 쓰지
  않는다.
- `scripts/lib/*.js`는 손으로 고치지 않는다. 빌드 산출물을 그대로 커밋한다.
- git 호출은 주입 가능한 형태로만 한다. 테스트가 실제 저장소 없이 commit
  게이트를 돌릴 수 있어야 한다.
- 이 저장소에서 이 task를 커밋할 때, 설치된 플러그인 캐시가 아직 옛 게이트를
  쓴다는 점을 전제한다. 커밋 훅이 오탐하면 워크트리의 `readAffectedPaths`로
  범위를 먼저 확인한다.

### Task 003

#### Goal & intent

`explain-diff` 호출이 `/bouncer-commit`에서 사라지고 `/bouncer-finalize`의
Distill 승격 다음 단계로 들어간다. `explain-diff` 자신은 task별 append가
아니라 blueprint 엔트리 하나를 쓰고, `range_from`은 포인터 `base`이며
`quiz_score`가 필수다. explain 템플릿의 `## 이해 상태`는 task별 소제목 없는
단일 블록이 된다. 게이트 문서·워크플로 문서·README 다이어그램이 새 판정
(commit = G6/G7/G8 + G17, finalize = G16)을 가리킨다.

#### Interface

- 제공:
  - `/bouncer-finalize` 순서: Distill 승격 → explain 작성 + 퀴즈 →
    `validate --gate finalize` → `finalize --yes` → PR.
  - `/bouncer-commit` 순서: scope dry-run → `validate --gate commit` →
    상태 확인 → 커밋 ACQ → 다음 task ACQ. explain 단계가 없다.
  - `explain-diff`는 `bouncer.comprehension`에 엔트리 하나를 쓴다.
    `task` 필드를 쓰지 않고, `range_from`은 포인터 `base`이며,
    `quiz_score`는 비울 수 없다.
- 거부:
  - 퀴즈를 건너뛰고 `disposition`에 사유만 남기는 경로를 없앤다.
    퀴즈 미응답이면 finalize를 중단한다.
  - 퀴즈 이후 커밋이 더 쌓여 해시가 어긋나면 본문과 `diff_sha`만 갱신한다.
    퀴즈를 다시 내지 않는다.
  - 스킬 문구에 G15를 남기지 않는다.

#### Touch

- Modify `skills/bouncer-commit/SKILL.md` — explain 단계(step 2)를 지우고
  이후 단계 번호와 게이트 설명, frontmatter `description`을 고친다.
- Modify `skills/bouncer-finalize/SKILL.md` — Distill 승격 다음에 explain +
  퀴즈 단계를 넣고, "퀴즈를 여기서 돌리지 않는다"는 금지 문구와
  `description`을 고친다.
- Modify `skills/explain-diff/SKILL.md` — task별 append를 blueprint 단일
  엔트리로 바꾸고, `range_from`을 포인터 `base`로 고정하며, 퀴즈 스킵 예외를
  없애고 `## 이해 상태` 단일 블록 규칙을 적는다.
- Modify `scripts/src/lib/templates.ts` — explain 템플릿의 `## 이해 상태`
  주석을 단일 블록 안내로 바꾼다.
- Modify `scripts/lib/templates.js` — 산출물 동기화.
- Modify `docs/gates.md` — commit·finalize 행을 새 판정으로 바꾸고 G17을
  추가, G15를 결번으로 적는다.
- Modify `docs/workflow.md` — 단계 목록·다이어그램·스킬 표의 explain 위치를
  옮긴다.
- Modify `docs/troubleshooting.md` — G15 증상 행을 G16·G17 행으로 바꾼다.
- Modify `docs/ARCHITECTURE.md` — `explain-diff`를 finalize 하위 스킬로
  적는다.
- Modify `docs/governance.md` — `/bouncer-commit` 한 줄 설명에서 comprehension
  단계를 뺀다.
- Modify `docs/cli.md` — `scaffold explain` 호출 주체를 `/bouncer-finalize`로
  고친다.
- Modify `README.md` — 워크플로 다이어그램의 `explain-diff` 노드와 게이트
  라벨을 옮긴다.
- Modify `CLAUDE.md` — "When to invoke" 표에서 explain 기록 주체를 옮긴다.
- Modify `test/skill-bouncer-commit.test.js` — explain-diff 참조 단언을
  부재 단언으로 바꾼다.
- Modify `test/skill-bouncer-finalize.test.js` — 부재 단언을 존재 단언으로
  바꾸고 순서를 못 박는다.
- Modify `test/skill-explain-diff.test.js` — 단일 엔트리·`quiz_score` 필수·
  단일 블록 계약을 단언한다.
- Modify `test/skill-bouncer-surface.test.js` — 스킬 참조 그래프 단언을
  새 호출 관계로 고친다.
- Modify `test/lightweight-cycle.test.js` — `scale: light` 1문항 규칙이
  새 문구에서도 성립하도록 단언을 맞춘다.

#### Constraints

- 게이트 코드를 바꾸지 않는다. 이 task는 문서와 스킬 산문, 그리고 explain
  템플릿 문자열만 만진다.
- 한국어 본문에는 `stop-slop`을 적용한다. 스킬 산문은 기존 영어/한국어 혼용
  관례를 그대로 따른다(단계 설명은 영어, ACQ 문구는 한국어).
- 스킬 계약 테스트는 부재 단언(`doesNotMatch`)만으로 규칙을 표현하지 않는다.
  금지 문구 자체가 매칭을 깨뜨리므로 존재 단언을 함께 둔다.
- 퀴즈 문항 수 규칙(1–10 판단, `scale: light`면 1)은 그대로 둔다.
- 커밋 메시지·PR 본문 규칙은 건드리지 않는다.
