---
type: bouncer.explain
title: 001 explain
description: Explain for 001
resource: .bouncer/context/epics/007-project-distill/blueprints/005-checkout-relative-distill/explain.md
tags:
  - bouncer
  - explain
timestamp: '2026-08-15T15:17:00.314+09:00'
bouncer:
  id: EXPLAIN-005
  epic_id: '007'
  blueprint_id: '005'
  status: published
  comprehension:
    - range_from: develop
      range_to: ec573e44b28aa04500b1458cc150e91fc1259ca5
      diff_sha: f4db01cf74b43e3192977e6cda4879dad254832637f353932f095c3547ac6b77
      quiz_score: 3/3
      disposition: 세 문항 모두 정답. Distill base가 checkout 우선이며 finalize 승격은 payload repoRoot와 같은 cwd에서 이뤄진다는 계약을 확인함.
      recorded_at: '2026-08-15T15:18:10+09:00'
---
# Explain

## Background
`distill.ts`의 옛 `resolveProjectRoot`는 전달받은 root를 항상
`runtimePaths().projectRoot`(main worktree)로 덮어썼다. `cmdDistill`도
`readShards`에 main root만 넣었다. 그 결과 `--repo`는 저장소만 고르고
checkout은 고르지 못했고, `/bouncer-finalize` 승격 쓰기는 main Distill로,
`finalize --yes` remainder 커밋은 execute worktree로 갈라져 승격분이
커밋·PR에서 빠졌다.

이번 변경은 Distill base를 현재 checkout 우선으로 해석하고, finalize 승격
경로의 출처를 `bouncer distill --all --json` payload의 `repoRoot` 하나로
고정한다. plan/execute/run의 `project-root` 읽기 경로는 그대로 둔다.

## Intuition
책장(main)과 작업대(execute worktree)가 둘 다 `.bouncer/Distill.md`를 가질 수
있을 때, finalize는 작업대에 쓴 뒤 그 작업대에서 커밋한다. 책장 주소로 써서
작업대 장부에만 올리면 장부에 빈칸이 남는다.

## Code
- `scripts/src/lib/distill.ts` — `resolveDistillRoot`: (1) 해당 root에
  `.bouncer/Distill.md`가 있으면 그 root, (2) 없으면 `runtimePaths().projectRoot`,
  (3) Git 불가 시 전달 root. `readShards`의 `repoRoot`가 이 값이다.
- `scripts/src/lib/cli-project-commands.ts` — `cmdDistill`이 Git 가용성만
  `runtimePaths`로 보고, 읽기·config base는 `resolveDistillRoot` 결과를 쓴다.
- `skills/bouncer-finalize/SKILL.md` — 승격 audit은 `--repo` 없이, step 3
  finalize와 **같은 checkout cwd**에서 돌린다. 승격 절대 경로는 payload
  `repoRoot`에서만 온다.
- `CLAUDE.md` 하드룰 7 — plan/execute/run은 `PROJECT_ROOT`, finalize 승격은
  payload `repoRoot`.
- 회귀: `test/distill.test.js`, `test/cli-project-commands.test.js`,
  `test/finalize.test.js`(linked checkout에서 Distill·shard가 staged에 포함).

## Quiz
1. finalize 승격 audit을 어디에 두고, Distill 절대 경로는 어디서 받나?
   - A) main worktree에서 `bouncer project-root`로 조립한다
   - B) `--repo`로 main을 넘기고, cwd는 상관없다
   - C) execute worktree(같은 checkout)에서 돌리고, payload `repoRoot`를 쓴다

2. linked checkout에 `.bouncer/Distill.md`가 있을 때 `resolveDistillRoot`는?
   - A) 그 linked checkout root를 반환한다
   - B) 항상 `runtimePaths().projectRoot`(main)를 반환한다
   - C) shard 디렉터리 유무로 base를 고른다

3. plan/execute의 Distill 읽기와 finalize 승격 base의 관계는?
   - A) 둘 다 항상 execute worktree cwd다
   - B) plan/execute는 `project-root`/`PROJECT_ROOT`, finalize 승격은 payload
     `repoRoot`(checkout 우선)다
   - C) 둘 다 `bouncer project-root`만 쓴다

## 이해 상태
- quiz_score: 3/3
- 응답: 1C, 2A, 3B
- 정답: 1C, 2A, 3B — 전부 맞음
- disposition: 세 문항 모두 정답. Distill base가 checkout 우선이며 finalize 승격은 payload repoRoot와 같은 cwd에서 이뤄진다는 계약을 확인함.
- range: develop..ec573e44b28aa04500b1458cc150e91fc1259ca5
- diff_sha: f4db01cf74b43e3192977e6cda4879dad254832637f353932f095c3547ac6b77
- recorded_at: 2026-08-15T15:18:10+09:00

## Tasks

### Task 001

#### Goal & intent

`distill.ts`의 base 해석기를 현재 checkout 우선으로 바꾸고, `bouncer distill`
명령이 그 해석 결과를 그대로 쓰게 만든다. 완료 후 linked checkout에서
`bouncer distill --all --json`을 실행하면 payload `repoRoot`가 그 checkout의
절대 경로가 되고, Distill이 없는 checkout에서는 종전대로 main worktree가 된다.

지금 `resolveProjectRoot`는 전달받은 root를 항상 `runtimePaths().projectRoot`로
덮어쓴다(`scripts/src/lib/distill.ts:24-39`). 게다가 `cmdDistill`은 아예
`readShards({ repoRoot: paths.projectRoot })`로 main root를 직접 넣는다
(`scripts/src/lib/cli-project-commands.ts:135`). 두 곳을 함께 고쳐야 `--repo`가
checkout 선택으로 동작한다.

#### Interface

- 제공:
  - `scripts/src/lib/distill.ts` export에 `resolveDistillRoot`를 추가한다.
    시그니처는 `resolveDistillRoot({ repoRoot, runtime })`이고 절대 경로
    문자열을 돌려준다. 판정 순서는 blueprint Contract의 3단계와 같다.
  - `readShards`는 이 해석기를 통해 base를 정하고, 반환의 `repoRoot`에 그 값을
    담는다(기존 필드, 의미만 확정).
  - `bouncer distill --json` payload의 `repoRoot`가 해석된 base다.
- 거부:
  - `repoRoot`가 Git 저장소가 아니고 Distill도 없으면 `runtimePaths`가
    `unavailable`이므로 전달받은 root를 그대로 쓴다(기존 라이브러리 폴백 유지).
  - `bouncer distill`은 `runtimePaths`가 `unavailable`이면 지금처럼
    `distill: <reason>`을 stderr에 쓰고 exit 1. 이 분기는 유지한다.
  - 새 CLI 플래그를 만들지 않는다. checkout 선택은 기존 `--repo`와 cwd로만 한다.

#### Touch

- Modify `scripts/src/lib/distill.ts` — `resolveProjectRoot`를
  `resolveDistillRoot`로 바꿔 checkout 우선 판정을 넣고 export에 추가한다.
- Modify `scripts/src/lib/cli-project-commands.ts` — `cmdDistill`이
  `paths.projectRoot`를 강제하지 않고 해석된 base로 `readShards`와 `readConfig`를
  호출하게 한다. `runtimePaths` 호출은 Git 가용성 판정용으로만 남긴다.
- Modify `scripts/lib/distill.js` — `npm run build` 산출물 재생성.
- Modify `scripts/lib/cli-project-commands.js` — `npm run build` 산출물 재생성.
- Modify `test/distill.test.js` — 해석기 3분기 단위 테스트를 추가한다.
- Modify `test/cli-project-commands.test.js` — 실제 `git worktree`를 만든 뒤
  linked checkout에서 `distill --all --json`의 `repoRoot`를 확인하는 e2e를
  추가한다.
- Modify `test/finalize.test.js` — 에픽 성공 조건 4의 회귀를 추가한다. linked
  checkout에 승격을 쓰고 그 checkout에서 `finalize --yes`를 돌렸을 때
  `.bouncer/Distill.md`와 등록 shard가 staged에 들어가는지 본다. 이 파일은 이미
  worktree fixture와 `writeRegisteredDistillShard` 헬퍼를 갖고 있다.

#### Constraints

- shard 인덱스 무효·부재 시의 단일 파일 폴백(`legacyResult`) 판정 경로를 바꾸지
  않는다. 해석기는 base만 고르고 폴백 사유는 종전 그대로 남는다.
- `runtimePaths` 호출은 여전히 try/catch로 감싸 throw를 삼킨다. Git이 없는
  단위 테스트가 계속 통과해야 한다.
- 하위 호환 별칭(`resolveProjectRoot` re-export)을 남기지 않는다. 내부 함수라
  외부 소비자가 없다.
- `scripts/lib` CJS 산출물은 손으로 편집하지 않고 `npm run build`로만 만든다.
- `readShards`의 다른 두 소비자(`scripts/src/lib/scope.ts:31`,
  `scripts/src/lib/context-digest.ts:133`)도 base 이동의 영향을 받는다. 해석기가
  **어느 인덱스 파일을 읽을지**를 정하므로, linked checkout에서 실행하면
  `makeFinalizeAllowed`의 등록 shard 허용 집합과 digest 후보 목록이 그 checkout의
  인덱스에서 나온다. 의도된 변화다 — 커밋 대상 checkout의 인덱스로 그 checkout의
  스테이징을 판정하는 쪽이 옳다. 두 파일의 코드는 고치지 않는다.
- 존재 확인은 `.bouncer/Distill.md` 파일 하나만 본다. shard 디렉터리 유무나
  frontmatter 유효성으로 base를 고르지 않는다 — 그러면 폴백 판정과 뒤섞인다.
- `resolveDistillRoot`는 `readShards`가 지금 쓰는 인자 병합
  (`runtime || suppliedRuntimePaths || suppliedPaths`,
  `scripts/src/lib/distill.ts:151-157`)을 그대로 보존한다. 세 별칭 중 하나만
  받도록 좁히면 기존 호출자가 조용히 폴백 경로로 떨어진다.
- `readConfig`의 base도 함께 옮기되, config가 없을 때 인덱스 flag로 떨어지는
  기존 fail-open(`cli-project-commands.ts:136-151`)은 유지한다.

### Task 002

#### Goal & intent

`/bouncer-finalize`가 승격 대상 경로를 `bouncer project-root`로 조립하지 않고,
`bouncer distill --all --json` payload의 `repoRoot`에서 받게 한다. task 001이
그 값을 현재 checkout 기준으로 만들어 두었으므로, 승격 쓰기와 finalize의
remainder 커밋이 같은 checkout을 쓰게 된다.

경로 출처가 둘(`project-root` 조립 / CLI payload)이면 다시 갈라진다. finalize
쪽 출처를 하나만 남기는 것이 이 task의 전부다.

#### Interface

- 제공:
  - `skills/bouncer-finalize/SKILL.md`가 승격 base를 `bouncer distill --all
    --json`의 payload `repoRoot`로 정의한다. shard의 등록 상대 경로는 모두 그
    base 기준으로 read/write한다.
  - 같은 스킬이 **cwd 계약**을 명시한다: 승격 audit은 `--repo` 없이 실행하며,
    그 cwd는 step 3의 `bouncer finalize`가 커밋할 checkout과 같아야 한다.
    `--repo`만 지우고 cwd를 main worktree에 두면 base가 main으로 돌아가
    이 버그가 그대로 남는다. `/bouncer-finalize` step 1~3은 하나의 checkout
    안에서 이어진다.
  - `CLAUDE.md` 하드룰 7이 "plan/execute/run은 `project-root`로 `PROJECT_ROOT`를
    묶고, finalize 승격은 CLI payload `repoRoot`를 base로 쓴다"로 갈린다.
  - `skills/spec-authoring/SKILL.md`의 "caller-provided absolute Distill path"
    설명이 그 base에서 온 값임을 명시한다.
- 거부:
  - `/bouncer-finalize`는 더 이상 `bouncer project-root`를 부르지 않는다.
    승격 경로를 `${PROJECT_ROOT}/...`로 조립하는 문장을 남기지 않는다.
  - `spec-authoring`은 여전히 CLI를 직접 부르지 않는다. base도 caller가 준다.
  - `skills/bouncer-plan`·`bouncer-execute`·`bouncer-run`의 `PROJECT_ROOT`
    바인딩은 그대로 둔다. 세 스킬은 stdout만 소비한다.

#### Touch

- Modify `CLAUDE.md` — 하드룰 7에서 finalize 승격 base를 CLI payload `repoRoot`로
  분리하고, "execute worktree cwd는 Distill base가 아니다" 문구를 plan/execute
  읽기 경로에 한정한다.
- Modify `skills/bouncer-finalize/SKILL.md` — Project root 프리플라이트 블록을
  걷어내고 step 1의 base를 payload `repoRoot`로 다시 쓴다.
- Modify `skills/spec-authoring/SKILL.md` — Distill 절대 경로의 출처를 CLI
  payload `repoRoot`로 정정한다.
- Modify `test/master-rules.test.js` — `PROJECT_ROOT` 루프 대상에서
  `bouncer-finalize`를 빼고, finalize가 payload `repoRoot`를 승격 base로 쓰는지
  검사하는 assertion을 추가한다.
- Modify `test/skill-bouncer-finalize.test.js` — `PROJECT_ROOT` 단정을 payload
  `repoRoot` 단정으로 바꾼다.

#### Constraints

- 하드룰 7의 다른 계약(전체 검색 우선, route 결과가 shard body를 대신하지 못함,
  단일 파일 폴백, 목록 단위 1회 동의)은 문구를 유지한다. 이번 변경은 base
  출처 한 줄이다.
- `test/master-rules.test.js:61-68`이 요구하는 `CLAUDE.md`의 `project-root` /
  `PROJECT_ROOT` 언급은 남아야 한다 — plan/execute 경로에서 여전히 참이다.
- `test/master-rules.test.js:163-169`의 discovery·spec-authoring
  "caller-provided absolute" 계약을 깨지 않는다.
- 프로즈는 한국어 규칙을 따르되 식별자·경로·코드 펜스는 그대로 둔다. Distill
  본문 내용을 마스터 룰에 넣지 않는다.
- Project root 블록을 걷어내도 남는 shell 블록은 각자 `BOUNCER_ROOT=` 대입을
  유지한다. 워크플로 스킬의 shell 블록은 매번 새 셸이다.
- `stop-slop`을 적용한다(자문).
