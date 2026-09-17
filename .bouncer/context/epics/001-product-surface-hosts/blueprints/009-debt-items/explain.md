---
type: bouncer.explain
title: 004 explain
description: Explain for 004
resource: .bouncer/context/epics/001-product-surface-hosts/blueprints/009-debt-items/explain.md
tags:
  - bouncer
  - explain
timestamp: '2026-08-31T11:43:13.143+09:00'
bouncer:
  id: EXPLAIN-009
  epic_id: '001'
  blueprint_id: '009'
  status: published
  comprehension:
    - range_from: develop
      range_to: b086b2e0cc4c252b5c6386b4278875533a68e905
      diff_sha: 1060e30ee7e2e100c0d0300e06de8e4ebb41623a1320f611d88cbdef7d2ec6ba
      quiz_score: 4/4
      disposition: 명령어 자리 vs 인자 자리, YAML 선두 인용, G18 파싱/부재 분기, B11 clone 완화를 diff와 맞게 이해함
      recorded_at: '2026-08-31T11:46:00+09:00'
---
# Explain

## Background

감사에서 B7–B11·B16이 남았다. B8(따옴표 git 명령 탐지)과 B16(YAML frontmatter 작성·진단)은
재현 가능한 결함이었고, 나머지는 기존 설계와 맞닿는 유지 항목이었다. 이 blueprint는 B8·B16을
고치고 B7–B11의 처분을 `docs/audit-debt-decisions.md` 한곳에 고정한다. 게이트 코드·포인터
저장 위치·G16 comprehension 계약은 바꾸지 않는다.

## Intuition

명령어 자리와 인자 자리를 구분하는 얇은 가드, YAML 선두 문자만 인용하는 작성 규칙, 파싱 실패와
파일 부재를 다른 복구 안내로 나누는 진단, 그리고 “고침 vs 유지”를 표로 남기는 결정 기록 — 네
task가 각각 다른 층을 맡는다.

## Code

- **B8 탐지:** `scripts/src/lib/commit-hook.ts` — `isCommandPositionGit()`로 세그먼트 첫 토큰의
  인용 git만 허용. `test/commit-hook.test.js`, `docs/security.md`.
- **B16 작성:** `references/spec-authoring/index.md` — author-written scalar 선두 예약 지시자
  인용. `skills/bouncer-plan/references/context-review.md` — finding `note`에 동일 규칙 연결.
- **B16 진단:** `scripts/src/lib/validate.ts`(parseErrors 전달),
  `scripts/src/lib/validate-gates.ts`(G18 분기). `test/validate-structural.test.js`,
  `test/validate-gates.test.js`, `docs/troubleshooting.md`.
- **결정 기록:** `docs/audit-debt-decisions.md` — B7–B11 표. `docs/README.md` 목차 연결.

## Quiz

**Q1.** `"git" commit -m x`를 커밋으로 탐지할 때, `echo "git" commit`을 커밋으로 보지 않는
핵심 이유는?

- A) `echo`는 git alias라서
- B) 인용 git은 세그먼트 **첫 토큰(명령어 자리)**일 때만 git argv로 본다
- C) echo 뒤 문자열은 항상 주석 처리된다

**Q2.** task frontmatter의 `commit_intent`에 `` `git add` ``처럼 백틱으로 시작하는 값을
평문 `- ` 뒤에 쓰면 어떤 일이 생기기 쉬운가?

- A) YAML 파서가 태그/alias로 읽어 frontmatter 전체가 깨진다
- B) `commit_intent`만 무시되고 본문은 그대로다
- C) plan gate가 자동으로 작은따옴표로 감싼다

**Q3.** `context-review.md`가 디스크에 있는데 frontmatter 파싱이 실패하면, plan gate G18은
어떤 메시지 쪽으로 분기하는가?

- A) `context-review.md missing ... scaffold context-review`
- B) `context-review.md has invalid frontmatter; fix the S0 parse error`
- C) G18을 건너뛰고 plan gate를 통과시킨다

**Q4.** B11(저장소당 활성 blueprint 하나)의 운영 완화로 문서에 적힌 방법은?

- A) linked worktree를 두 개 더 만든다
- B) namespaced 포인터를 즉시 켠다
- C) 병렬 사이클은 **독립 clone**에서 돌린다

## 이해 상태

퀴즈 4/4. Q1 B(명령어 자리 인용 git), Q2 A(YAML 선두 백틱 → 파서 깨짐), Q3 B(parse 실패
G18), Q4 C(병렬은 독립 clone). disposition: diff의 네 축(가드·작성·진단·결정 기록)을 구분해
답함.

## Tasks

### Task 001

#### Goal & intent

명령어 위치에서 `"git" commit`과 `g"it" commit`을 커밋으로 탐지한다. 따옴표 안의 단순 언급과 커밋 메시지 인자는 계속 데이터로 취급하며 `npm run ci`로 검증한다.

#### Interface

- 제공: `isGitCommit()`이 첫 명령어 토큰의 값이 `git`이면 전체 또는 일부가 인용됐어도 git argv로 해석한다. 이 경로에서도 `commit`, alias, `-a` 판정은 기존 로직을 그대로 사용한다.
- 거부: `echo "git" commit`, `echo "git commit"`, `git log --grep "commit"`, `docker commit`은 커밋으로 판정하지 않는다. `git commit -m "-a"`의 메시지는 all-flag가 아니다.

#### Touch

- Modify `scripts/src/lib/commit-hook.ts` — 명령어 위치의 인용된 `git` 토큰만 허용하도록 탐지 조건을 좁혀 보강한다.
- Modify `scripts/lib/commit-hook.js` — TypeScript 변경의 커밋 대상 런타임 산출물을 갱신한다.
- Modify `test/commit-hook.test.js` — B8 재현 입력과 인자 위치 오탐 방지 배터리를 추가한다.
- Modify `docs/security.md` — 커밋 가드가 탐지하는 인용 명령어와 여전히 보장하지 않는 위협 경계를 기록한다.

#### Constraints

- 커밋 가드는 실수 방지 장치이며 악의적 우회를 막는 완전한 셸 파서가 아니다.
- 판단 불가 입력의 fail-closed와 `-a`/`--all` 검사 범위는 그대로 유지한다.
- 생성 JavaScript는 `npm run build`로 만들고 손으로 TypeScript와 다른 로직을 쓰지 않는다.

### Task 002

#### Goal & intent

계획 작성자와 context-review controller가 백틱 등 YAML 예약 지시자로 시작하는 문자열을 평문 scalar로 쓰지 않도록 정본 규칙을 추가한다. `commit_intent`와 finding `note`를 포함한 author-written frontmatter에 적용하고 `npm run ci`로 문서 계약을 검증한다.

#### Interface

- 제공: `spec-authoring`은 YAML 예약 지시자로 시작하는 author-written 문자열을 작은따옴표 또는 block scalar로 기록하도록 요구한다. plan context-review controller도 finding `note`를 쓸 때 같은 규칙을 적용한다.
- 거부: 첫 문자가 백틱인 값을 `- ` 뒤에 평문으로 쓰지 않는다. 문자열 중간의 백틱이나 Markdown 본문의 백틱까지 불필요하게 인용 대상으로 넓히지 않는다.

#### Touch

- Modify `references/spec-authoring/index.md` — author-written frontmatter의 YAML 선두 문자 인용 규칙과 안전한 예시를 정본으로 추가한다.
- Modify `skills/bouncer-plan/references/context-review.md` — controller가 findings를 기록할 때 같은 인용 규칙을 적용하도록 연결한다.
- Modify `test/skill-spec-authoring.test.js` — 백틱 선두 scalar와 안전한 인용 형식을 식별자 중심으로 단언한다.
- Modify `test/skill-context-review.test.js` — context-review 기록 경로가 인용 규칙을 보유하는지 단언한다.

#### Constraints

- harness-owned frontmatter와 status 소유권 규칙은 바꾸지 않는다.
- 문구 전체를 바이트 단위로 고정하지 않고 위험 입력과 안전 형식의 식별자만 테스트한다.
- 작은따옴표 안의 작은따옴표는 YAML 규칙에 따라 두 번 써야 함을 예시에 포함한다.

### Task 003

#### Goal & intent

full blueprint의 `context-review.md`가 존재하지만 frontmatter 파싱에 실패하면 S0과 파싱 오류용 G18을 함께 보고한다. 실제 부재일 때만 scaffold 안내를 유지하며 게이트 통과 조건과 코드 집합은 바꾸지 않는다.

#### Interface

- 제공: plan gate가 loader의 `parseErrors`를 받아 `rels.contextReview`의 S0 존재 여부를 판별한다. 해당 오류가 있으면 G18은 invalid frontmatter와 S0 수정 지침을 보고한다.
- 거부: 파일이 실제로 없을 때는 기존 `context-review.md missing ... scaffold context-review` 메시지를 유지한다. 파싱 실패를 통과시키거나 G18을 생략하지 않는다.

#### Touch

- Modify `scripts/src/lib/validate.ts` — loader의 parse error 목록을 gate context에 전달한다.
- Modify `scripts/src/lib/validate-gates.ts` — context-review 파싱 실패와 실제 부재의 G18 메시지를 분기한다.
- Modify `scripts/lib/validate.js` — TypeScript 변경의 커밋 대상 런타임 산출물을 갱신한다.
- Modify `scripts/lib/validate-gates.js` — gate 진단 변경의 런타임 산출물을 갱신한다.
- Modify `test/validate-structural.test.js` — 잘못된 백틱 scalar가 S0과 invalid-frontmatter G18을 내는 통합 재현을 추가한다.
- Modify `test/validate-gates.test.js` — parseErrors가 있는 문서와 실제 missing 문서의 메시지 분기를 단언한다.
- Modify `docs/troubleshooting.md` — S0+G18 파싱 실패와 실제 missing의 서로 다른 복구 절차를 안내한다.

#### Constraints

- 결과는 계속 실패여야 하며 S0·G18 코드를 새 코드로 교체하지 않는다.
- light blueprint는 context-review가 없으므로 기존 G18 면제를 유지한다.
- 다른 optional 문서의 파싱 실패 메시지를 이번 task에서 일반화하지 않는다.
- 생성 JavaScript는 `npm run build`로 TypeScript와 일치시킨다.

### Task 004

#### Goal & intent

B7–B11 각각의 처분, 근거, 현재 완화책, 재검토 조건을 `docs/audit-debt-decisions.md` 한 문서에 기록한다. B8은 task 001의 수정으로 연결하고 B7·B9·B10·B11은 기존 계약을 유지하는 의식적 결정으로 남긴다.

#### Interface

- 제공: docs 목차에서 접근 가능한 결정 문서가 B7–B11마다 상태, 결정, 근거, 완화책, 재검토 조건을 제공한다. B8은 따옴표 명령어 탐지 보강을 수정 상태로 기록한다.
- 거부: “나중에 검토”만 적거나 재검토 조건 없이 영구 제약으로 선언하지 않는다. 결정 문서에서 새 게이트·설정·병렬 상태를 약속하지 않는다.

#### Touch

- Create `docs/audit-debt-decisions.md` — B7–B11 처리 표와 결정별 근거·완화책·재검토 조건을 담는다.
- Modify `docs/README.md` — 사람용 문서 목차에서 감사 부채 결정 문서를 연결한다.

#### Constraints

- B7은 `autonomy`가 `/bouncer-run`의 ACQ 빈도만 정하고 finalize 이해 확인은 생략하지 않는 현재 경계를 유지한다.
- B9는 G9·G15·S14를 호환성 기록용 결번으로 유지하고 재사용하지 않는다.
- B10은 식별자·계약 단언을 유지하되 문구 결합 테스트는 해당 문서를 수정하는 커밋에서 점진적으로 옮긴다는 ADR G 결정을 유지한다.
- B11은 저장소당 활성 blueprint 하나를 유지하고 병렬 작업은 독립 clone을 사용한다.
- 현재 사실과 미래 조건을 구분하고 완료되지 않은 구현을 완료로 표현하지 않는다.
