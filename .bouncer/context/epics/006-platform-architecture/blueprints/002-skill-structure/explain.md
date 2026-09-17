---
type: bouncer.explain
title: 001 explain
description: Explain for 001
resource: .bouncer/context/epics/006-platform-architecture/blueprints/002-skill-structure/explain.md
tags:
  - bouncer
  - explain
timestamp: '2026-08-12T10:21:42.483+09:00'
bouncer:
  id: EXPLAIN-002
  epic_id: '006'
  blueprint_id: '002'
  status: published
  comprehension:
    - task: '001'
      range_from: develop
      range_to: d1c62aa67734ef2f7ec2b43169db1bb8be143aba
      diff_sha: e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855
      quiz_score: 2/2
      disposition: 퀴즈 2문항 만점. 셸 BOUNCER_ROOT 대입 유지와 3인칭 description을 확인함.
      recorded_at: 2026-08-12T01:22:52.000Z
    - task: '002'
      range_from: d1c62aa67734ef2f7ec2b43169db1bb8be143aba
      range_to: 12347fccc9edc20f2277aea20a8ceffbdf27ab88
      diff_sha: 46cc386cc9c3596ca88f2291a17a4b93e62c3f0c30ad7ce9f0ccf6a8e4a6558e
      quiz_score: 2/2
      disposition: 퀴즈 2문항 만점. reviewer-prompt assets 이동과 3인칭 description을 확인함.
      recorded_at: 2026-08-12T01:30:24.000Z
    - task: '003'
      range_from: 12347fccc9edc20f2277aea20a8ceffbdf27ab88
      range_to: 9dcac360068e3b584626b122757e208676d67d20
      diff_sha: a167a2bb9526cc5fd7a48c6180d1c8f7fae347e290c17837f628dc6dc184922e
      quiz_score: 2/2
      disposition: 퀴즈 2문항 만점. 하드룰 9 위치와 validate.js 대비 예시를 확인함.
      recorded_at: 2026-08-12T01:43:00.000Z
    - task: '004'
      range_from: 9dcac360068e3b584626b122757e208676d67d20
      range_to: 1bef4e0e7ba11d063b45a392eff5202616eb7c39
      diff_sha: 7c21c8b2d79634d53100f0431f87fb3db3aa0f1ffabd528858f67e9c24028ceb
      quiz_score: 0/2
      disposition: 퀴즈 2문항 0점. remainder는 최고 번호 task intent, task 커밋은 폴백 없이 생략임을 다시 확인함.
      recorded_at: 2026-08-12T02:04:32.000Z
---
# Explain

## Background
워크플로 스킬 다섯 개는 플러그인 루트 산문을 `docs/install.md` 참조로 줄였고,
나머지 열한 개는 description을 3인칭으로 맞추며 `reviewer-prompt.md`를
`skills/review/assets/`로 옮겼다. 코드 주석 규칙은 `CLAUDE.md` 하드룰 9로
올렸고, 좋은/나쁜 주석 대비는 `skills/implementation/SKILL.md`에 둔다.
커밋 단위는 task 문서인데 커밋 의도(`commit_intent`)는 blueprint에 쓰라는
지침이 남아 있어 작성 위치가 어긋나 있었다. 이번 task는 의도를 task 문서에만
두고, finalize remainder도 번호가 가장 큰 유효 task intent를 읽게 바꿨다.

## Intuition
커밋 한 장의 배경·의도는 그 장을 만든 task 문서에만 적는다. 마감 remainder는
마지막 task의 의도 두 줄을 빌려 쓴다.

## Code
- `skills/bouncer-{init,plan,execute,commit,finalize}/SKILL.md` — 플러그인 루트
  산문 → `docs/install.md` 참조 (task 001)
- 워크플로 밖 스킬 11개 `SKILL.md` — description 3인칭; `reviewer-prompt.md` →
  `skills/review/assets/` (task 002)
- `CLAUDE.md` — 하드룰 9 Code comments; `skills/implementation/SKILL.md` —
  Bad/Good 주석 대비 (task 003)
- `scripts/src/lib/finalize.ts` (+ `scripts/lib/finalize.js`) — task 커밋은
  task `commit_intent`만; remainder는 taskUnits 스캔 후 최고 번호 유효 2줄
  (task 004)
- `skills/bouncer-{plan,commit,finalize}/SKILL.md`, `skills/spec-authoring`,
  `docs/PILOT.md`, `docs/contributing.md`, `.gitmessage` — blueprint
  `commit_intent` 출처 서술 제거 (task 004)
- `test/finalize-pure.test.js`, `test/finalize.test.js` — remainder·fixture
  계약 (task 004)

## Quiz
1. finalize remainder 커밋 본문의 배경·의도는 어디서 고르나?
   - A) blueprint `index.md`의 `bouncer.commit_intent` 2줄
   - B) 모든 task 문서의 유효 `commit_intent` 중 번호가 가장 큰 항목 2줄
   - C) 모든 task `commit_intent`를 이어 붙인 목록

2. task 커밋(`bouncer commit`)에서 task `commit_intent`가 없거나 무효일 때
   동작은?
   - A) 배경·의도 줄을 생략하고 제목·수정 내용만 남긴다
   - B) blueprint `commit_intent`로 폴백한다
   - C) 커밋을 거부하고 게이트를 실패시킨다

## 이해 상태
- (task 001) 문항 1 정답: B — 대입은 각 셸 블록에 그대로 남긴다
  - 응답: B / 정답
- (task 001) 문항 2 정답: C — `This skill should be used only when…` (3인칭)
  - 응답: C / 정답
- (task 001) quiz_score: 2/2
- (task 001) disposition: 퀴즈 2문항 만점. 셸 BOUNCER_ROOT 대입 유지와 3인칭 description을 확인함.
- (task 002) 문항 1 정답: B — `skills/review/assets/reviewer-prompt.md`
  - 응답: B / 정답
- (task 002) 문항 2 정답: A — `This skill should be used when/during/from…` (3인칭)
  - 응답: A / 정답
- (task 002) quiz_score: 2/2
- (task 002) disposition: 퀴즈 2문항 만점. reviewer-prompt assets 이동과 3인칭 description을 확인함.
- (task 003) 문항 1 정답: C — `CLAUDE.md` 하드룰 9 + implementation 스킬 예시
  - 응답: C / 정답
- (task 003) 문항 2 정답: A — `scripts/lib/validate.js`의 실제 게이트 주석
  - 응답: A / 정답
- (task 003) quiz_score: 2/2
- (task 003) disposition: 퀴즈 2문항 만점. 하드룰 9 위치와 validate.js 대비 예시를 확인함.
- (task 004) 문항 1 정답: B — 모든 task 문서의 유효 commit_intent 중 번호가 가장 큰 항목 2줄
  - 응답: C / 오답
- (task 004) 문항 2 정답: A — 배경·의도 줄을 생략하고 제목·수정 내용만 남긴다
  - 응답: B / 오답
- (task 004) quiz_score: 0/2
- (task 004) disposition: 퀴즈 2문항 0점. remainder는 최고 번호 task intent, task 커밋은 폴백 없이 생략임을 다시 확인함.

## Tasks

### Task 001

#### Goal & intent

워크플로 스킬 5개(`bouncer-init` / `bouncer-plan` / `bouncer-execute` /
`bouncer-commit` / `bouncer-finalize`)에서 플러그인 루트 해석을 설명하는 산문
문단을 걷어내고 `docs/install.md` 「플러그인 루트」 참조 한 줄로 대체한다.
같은 내용이 이미 `docs/install.md:121-135`에 있으므로 새 참조 파일은 만들지
않는다.

셸 블록의 `BOUNCER_ROOT=` 대입 줄은 **그대로 둔다**. 블록마다 새 셸이 뜨므로
대입은 중복이 아니라 실행 조건이고, `test/cursor-plugin.test.js`의
「every shell block that reads BOUNCER_ROOT also assigns it」가 이미 이를 강제한다.

frontmatter `description`은 skill anatomy에 맞춰 3인칭 서술로 바꾼다.

#### Interface

- 제공: 워크플로 스킬 5개의 `SKILL.md`. 본문 앞머리는 「Master rules」 라벨과
  `CLAUDE.md` 언급을 유지한 채 플러그인 루트 설명을 `docs/install.md` 링크로
  대체한 형태. `description`은 `This skill should be used ...` 형태의 3인칭.
- 거부: 스킬 `name`, 파일 경로, 셸 블록의 `BOUNCER_ROOT=` 대입, 번호가 붙은 절차
  단계의 순서와 내용은 바꾸지 않는다. 절차 의미가 달라져야 한다고 판단되면
  구현하지 말고 `/bouncer-plan`으로 되돌린다.

#### Touch

- Modify `skills/bouncer-init/SKILL.md` — 플러그인 루트 산문 → 참조 한 줄, description 3인칭화
- Modify `skills/bouncer-plan/SKILL.md` — 위와 동일
- Modify `skills/bouncer-execute/SKILL.md` — 위와 동일
- Modify `skills/bouncer-commit/SKILL.md` — 위와 동일
- Modify `skills/bouncer-finalize/SKILL.md` — 위와 동일
- Modify `test/skill-bouncer-surface.test.js` — description 단정을 3인칭 표현에 맞게 갱신
- Modify `test/skill-bouncer-commit.test.js` — 같은 이유로 description 단정 갱신

#### Constraints

- 「Master rules」 라벨 문자열과 `CLAUDE.md` 언급을 각 스킬 본문에 남긴다.
  `test/master-rules.test.js`가 워크플로 스킬 5개 전부에서 두 토큰을 찾는다.
- 스킬 YAML `description`에 따옴표 없는 `##`를 넣지 않는다(주석으로 잘린다).
- `skills/` 아래에 `SKILL.md` 없는 새 디렉터리를 만들지 않는다.
- 절차 단계의 문장을 줄이더라도 각 스킬 계약 테스트가 찾는 명령 문자열
  (`scaffold epic`, `validate --gate plan` 등)은 그대로 남긴다.
- 공개 문자열의 한국어/영어 구분은 현행을 유지한다.

### Task 002

#### Goal & intent

워크플로 밖 스킬 11개를 skill anatomy에 맞춘다. 두 가지다.

1. `description`을 3인칭 서술로 통일한다. 지금은 스킬마다 어조가 다르다.
2. `skills/review/reviewer-prompt.md`를 스킬 루트에서 `assets/` 아래로 옮긴다.
   anatomy에서 스킬 루트에는 `SKILL.md`만 두고, 채워 넣어 출력으로 쓰는 템플릿은
   `assets/`에 둔다. `skills/stop-slop/references/`가 이미 같은 형태의 선례다.

11개 스킬은 모두 100줄 안팎이라 `SKILL.md` 분량 문제는 없다 — 분할은 하지 않는다.

#### Interface

- 제공: 11개 스킬의 `SKILL.md`(3인칭 `description`)와
  `skills/review/assets/reviewer-prompt.md`.
- 거부: 스킬 `name`, 절차 단계의 순서·내용, 루브릭 문구는 바꾸지 않는다.
  `description`의 발동 조건(어떤 상황에서 이 스킬이 쓰이는가)은 어조만 바꾸고
  의미는 그대로 둔다.

#### Touch

- Modify `skills/discovery/SKILL.md` — description 3인칭화
- Modify `skills/spec-authoring/SKILL.md` — description 3인칭화
- Modify `skills/implementation/SKILL.md` — description 3인칭화
- Modify `skills/verification/SKILL.md` — description 3인칭화
- Modify `skills/minimality/SKILL.md` — description 3인칭화
- Modify `skills/debugging/SKILL.md` — description 3인칭화
- Modify `skills/stop-slop/SKILL.md` — description 3인칭화
- Modify `skills/explain-diff/SKILL.md` — description 3인칭화 (`/bouncer-commit` 언급 유지)
- Modify `skills/graphify-runner/SKILL.md` — description 3인칭화
- Modify `skills/migrate-ids/SKILL.md` — description 3인칭화
- Modify `skills/review/SKILL.md` — description 3인칭화, `reviewer-prompt.md` 링크 2곳 경로 갱신
- Rename `skills/review/reviewer-prompt.md` → `skills/review/assets/reviewer-prompt.md` — anatomy상 템플릿 위치
- Modify `skills/bouncer-execute/SKILL.md` — 5단계의 `reviewer-prompt.md` 경로 2곳 갱신
- Modify `agents/bouncer-reviewer.md` — 경로를 언급한다면 갱신 (Distill: 리뷰어 문서는 한 커밋 단위)
- Modify `test/skill-review.test.js` — `reviewer-prompt.md` 읽기 경로 갱신
- Modify `test/skill-bouncer-execute.test.js` — 경로 단정 갱신

#### Constraints

- 리뷰어 루브릭 문구 자체는 바꾸지 않는다. Distill은 루브릭 · `reviewer-prompt.md` ·
  `agents/bouncer-reviewer.md` · execute 디스패치를 한 커밋 단위로 묶는데,
  이 task에서 함께 움직이는 것은 **경로뿐**이고 판정 내용은 아니다.
- `skills/explain-diff/SKILL.md`의 `description`은 `/bouncer-commit` 문자열을
  유지한다 (`test/skill-explain-diff.test.js:16`).
- 스킬 YAML `description`에 따옴표 없는 `##`를 넣지 않는다.
- 파일 이동은 `git mv`로 해서 이력이 rename으로 남게 한다.
- `skills/` 아래에 `SKILL.md` 없는 디렉터리가 새로 생기지만, `assets/`는
  `stop-slop/references/`와 같은 하위 디렉터리 형태이므로 스킬 탐색 대상이
  아니다. 스킬과 같은 계층에 새 디렉터리를 만들지는 않는다.

### Task 003

#### Goal & intent

코드 주석 규칙은 지금 `skills/implementation/SKILL.md:32-40`과
`agents/bouncer-implementer.md:53`에만 있다. 두 곳 모두 구현 경로 안이라,
그 경로를 타지 않는 에이전트는 규칙을 보지 못한다. 자동 루프가 task마다 새
implementer를 여는 구조로 가면 해석이 더 갈린다.

규칙을 `CLAUDE.md` 하드룰로 올려 모든 스킬·서브에이전트에 걸리게 하고,
`implementation` 스킬에는 좋은 주석과 나쁜 주석을 대비한 예시를 넣는다.
지금 규칙은 서술만 있고 예시가 없어 "상세히"의 기준이 사람마다 다르다.

#### Interface

- 제공: `CLAUDE.md` 「Hard rules」에 코드 주석 규칙 한 항목(9번).
  `skills/implementation/SKILL.md`에 좋은/나쁜 주석 대비 예시 2~3쌍.
- 거부: 기존 하드룰 1~8의 번호와 내용은 바꾸지 않는다. 주석 규칙의 **내용**
  자체(왜를 적는다 / 자명한 한 줄은 생략 / 한국어)는 현행을 그대로 옮기며,
  새 요구사항을 추가하지 않는다.

#### Touch

- Modify `CLAUDE.md` — 하드룰 9(코드 주석) 추가
- Modify `skills/implementation/SKILL.md` — 4번 항목을 하드룰 참조로 정리하고 대비 예시 추가
- Modify `agents/bouncer-implementer.md` — 하드룰과 같은 내용을 가리키도록 정리
- Modify `test/master-rules.test.js` — 하드룰 9 존재 단정 추가
- Modify `test/skill-implementation.test.js` — 예시 존재 단정 추가
- Modify `test/agents.test.js` — implementer 문서의 주석 규칙 단정 갱신

#### Constraints

- 하드룰은 **경로와 의무만** 적고 예시는 넣지 않는다. `CLAUDE.md` 7번이
  Distill을 다루는 방식(경로와 읽기 의무만, 본문 내용은 금지)과 같은 형태를
  따른다. 예시는 `implementation` 스킬에 둔다.
- 예시는 이 저장소의 실제 코드에서 가져온다. 가공한 가짜 예시를 만들지 않는다.
  `scripts/lib/validate.js`의 게이트 주석이 좋은 예시의 후보다.
- 하드룰 번호는 9로 이어 붙인다. 기존 번호를 재배치하면
  `test/master-rules.test.js`와 스킬 본문의 「하드룰 N」 언급이 어긋난다.
- 저장소 전체에서 「하드룰 N」 형태로 번호를 인용한 곳이 있으면 그 번호가
  여전히 맞는지 확인한다.

### Task 004

#### Goal & intent

커밋 단위는 task 문서 하나인데, 커밋 의도(`bouncer.commit_intent`)는 지침상
blueprint `index.md`에 쓰고 task에는 "선택적으로" 쓰는 것으로 서술돼 있다.
단위와 작성 위치가 어긋나 있다.

작성 위치를 **task 문서로 일원화**한다. `index.md`에는 쓰지 않는다.
그 결과 `finalize`의 Distill remainder 커밋이 읽을 출처가 사라지므로,
remainder도 task 문서들에서 의도를 찾도록 바꾼다.

현행 코드는 이미 task → blueprint 순으로 해석한다(`scripts/lib/finalize.js:94`).
바뀌는 것은 **remainder 경로**(같은 파일 118행)와 지침 서술이다.

#### Interface

- 제공:
  - task 커밋 본문 — 현행 유지. 대상 task 문서의 `commit_intent` 2줄.
  - remainder 커밋 본문 — blueprint가 아니라 **모든 task 문서를 번호 순으로
    스캔**해 유효한 `commit_intent`(문자열 2개 리스트)를 찾는다. 그중
    **번호가 가장 큰 항목**을 쓴다. 근거는 `.gitmessage`가 배경·의도를
    **정확히 2줄**로 제한해 N개를 이어 붙일 수 없고, remainder는 blueprint의
    마지막 상태를 커밋하므로 마지막 task의 의도가 가장 가깝기 때문이다.
  - 유효한 항목이 하나도 없으면 배경·의도 줄 없이 제목과 수정 내용만 남긴다
    (현행 `|| []` 동작과 동일).
- 거부: `commit_intent`의 형태는 바꾸지 않는다 — 문자열 **정확히 2개**의 YAML
  리스트만 유효하고, 블록 스칼라나 1줄·3줄은 무효 처리한다
  (`normalizeIntent`의 현행 계약). blueprint `commit_type`은 그대로 둔다.

#### Touch

- Modify `scripts/src/lib/finalize.ts` — remainder intent 해석을 blueprint 단일 출처에서 전체 task 스캔으로
- Modify `scripts/lib/finalize.js` — 위 변경의 CJS emit 반영
- Modify `skills/bouncer-plan/SKILL.md` — 4단계에서 `commit_intent`를 task 문서에 쓰도록, index에는 쓰지 않도록
- Modify `skills/spec-authoring/SKILL.md` — 필드 표와 서술에서 blueprint `commit_intent` 항목 제거·조정
- Modify `skills/bouncer-commit/SKILL.md` — "task then blueprint" 폴백 서술을 task 단일 출처로
- Modify `skills/bouncer-finalize/SKILL.md` — dry-run 전 blueprint `commit_intent` 요구 문구를 새 규칙으로
- Modify `docs/PILOT.md` — 커밋 본문 조립 설명 갱신
- Modify `docs/contributing.md` — task 단일 출처·remainder 최고 번호 규칙으로 갱신
- Modify `.gitmessage` — 본문 조립 출처 설명 갱신
- Modify `test/finalize-pure.test.js` — remainder intent 해석 테스트 추가·갱신
- Modify `test/finalize.test.js` — fixture intent를 task로 옮기고 expectation 갱신

#### Constraints

- `scripts/src/lib/*.ts`를 고치면 `scripts/lib/*.js` CJS emit을 함께 커밋한다.
  소비자는 Node 전용이고 빌드 산출물이 저장소에 들어가 있다(Distill Invariants).
- `normalizeIntent`의 `Array.isArray` + 길이 2 계약을 유지한다. 이 계약이 느슨해지면
  블록 스칼라로 쓴 문서가 조용히 통과해 커밋 본문이 비는 회귀가 생긴다.
- 커밋 본문 줄 수 상한(배경·의도 2줄 + 수정 내용 1~2줄, 합계 4줄)을 넘기지 않는다.
- 커밋 의도 문구에는 파일·모듈·패키지 이름을 쓰지 않는다(`.gitmessage`).
- 지침에서 blueprint `commit_intent`를 지울 때 `commit_type`까지 지우지 않는다 —
  브랜치 접두사와 커밋 타입이 거기서 온다.
