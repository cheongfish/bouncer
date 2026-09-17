---
type: bouncer.explain
title: Distill 읽기 지점을 프리플라이트·라우팅 두 층으로 줄임
description: Explain for 002
resource: .bouncer/context/epics/009-agent-orchestration/blueprints/011-distill-read-scope/explain.md
tags:
  - bouncer
  - explain
timestamp: '2026-08-25T13:45:10.023+09:00'
bouncer:
  id: EXPLAIN-011
  epic_id: '009'
  blueprint_id: '011'
  status: published
  comprehension:
    - range_from: develop
      range_to: 0ea1288aa2be3835ad5af21e8e94f1bc1d538504
      diff_sha: ec3b9670fb4744e96098bd29eac598e0389ad2b8f2d027276ca37e05f11ee59a
      quiz_score: 0/3
      disposition: preflight를 --for와 섞었고, finalize map을 파일 재읽기·route 본문으로 본 상태임.
      recorded_at: '2026-08-25T13:46:34+09:00'
---
# Explain

## Background
Distill 7샤드가 한 plan 사이클에서 `--all`로 세 번 실렸다. 프리플라이트,
`discovery`, `spec-authoring`이 같은 본문을 나눠 가졌고, finalize는
`--all --json` 뒤에 샤드 파일을 또 읽었다. 경로가 없는 계획 초반에 비용이
몰렸고, execute·run의 `--for`는 이미 필요한 샤드만 받고 있었다.

이번 변경은 계획 초반을 `always` 샤드와 인벤토리만 받게 하고, 전량은
baseline 파일로만 남긴다. 확정된 `affected_paths`에 대한 `--for` 집합은
그대로다.

## Intuition
지도 목록은 처음부터 주고, 본문은 길이 정해진 뒤에만 펼친다.

## Code
- `scripts/src/lib/cli-project-commands.ts`의 `alwaysDistillSelection`이
  `--preflight`를 만든다. `always: true` 본문만 렌더하고 `audit`에는 등록
  샤드 전체를 싣는다. 샤드가 아니면 전량 fail-open이다.
- `/bouncer-plan`은 `--all` stdout을 컨텍스트에 넣지 않고 baseline 파일로
  남긴 뒤 `--preflight`만 주입한다. `discovery`와 `spec-authoring`도 그
  출력을 받는다. 재접지는 기존처럼 `--for`다.
- `/bouncer-finalize`는 `--all --json`의 `content`를 `# <id>` 경계로 갈라
  shard map을 만든다. 샤드 파일을 다시 열지 않고, 분해 id가
  `audit.shards`와 다르면 승격을 포기한다.
- `CLAUDE.md` 하드룰 7이 위 두 층을 고정한다. 테스트는
  `test/cli-project-commands.test.js`와 각 스킬 계약 테스트다.

## Quiz
1. `bouncer distill --preflight`가 stdout으로 내는 것은 무엇인가?
   - A) 등록된 모든 샤드 본문과 인벤토리
   - B) `always: true` 샤드 본문과 전체 샤드 인벤토리
   - C) `affected_paths`에 라우팅된 샤드 본문만

2. 이 블루프린트 이후 `/bouncer-execute`가 Distill을 읽는 방식은?
   - A) 확정 경로마다 기존처럼 `distill --for <path>`
   - B) `--preflight`로 바뀌어 `always` 샤드만 받는다
   - C) `--all` stdout을 다시 컨텍스트에 넣는다

3. finalize가 spec-authoring에 넘기는 shard map은 어디서 오나?
   - A) `PROJECT_ROOT` 아래 샤드 파일을 하나씩 다시 읽는다
   - B) `--route` 선택 결과의 본문을 붙인다
   - C) `--all --json` payload `content`를 알려진 `# <id>` 경계로 분해한다

## 이해 상태
정답은 1-B, 2-A, 3-C이며 응답은 1-C, 2-B, 3-B였다. 세 문항 모두 오답으로
0/3을 기록했다. `--preflight`는 라우팅이 아니라 `always` 본문+인벤토리이고,
execute의 `--for`는 그대로이며, finalize map은 `--all --json` `content` 분해다.

## Tasks

### Task 001

#### Goal & intent

`bouncer distill --preflight [--json]`이 생겨서, `always: true` 샤드 본문과
등록된 전체 샤드 인벤토리만 출력한다. `--all`과 달리 나머지 샤드 본문은
싣지 않는다. 이 모드가 있어야 002 태스크가 plan·discovery·spec-authoring의
읽기를 옮길 자리가 생긴다. 완료 판정은 `npm run ci`와, `--preflight` stdout이
`--all` stdout보다 작으면서 `audit.shards`에는 7개가 모두 들어 있음이다.

#### Interface

- 제공:
  - `distill --preflight`: `DISTILL_MODES`에 `preflight` 추가. 선택은
    `state.shards` 중 `always === true`인 것만, `reason`은 `preflight-always`.
    payload는 기존 `distillPayload`를 그대로 쓰므로 `audit.shards`에는
    선택과 무관하게 등록 전체가 실린다.
  - `--json` 지원. `--json` 없이는 `content`만 stdout으로 나간다.
  - 인덱스가 무효하거나 샤드가 아닌 단일 파일 폴백(`state.sharded !== true`)
    이면 `allDistillSelection(state, 'not-sharded')`로 전량을 낸다.
  - `always` 샤드가 하나도 없으면 선택은 비고 인벤토리만 나가며,
    `distill: preflight selected no always shard\n`을 stderr로 낸다.
  - `docs/cli.md` 명령표와 설명 문단에 `--preflight`를 기재한다.
- 거부:
  - `--preflight`에 경로 인자를 붙이면 `distill: preflight does not accept a path`
    를 stderr로 내고 종료 코드 2. `--all` / `--audit`과 같은 취급이다.
  - 모드 없이 호출했을 때의 사용법 문구에 `--preflight`를 넣되, 기존
    `--for` / `--all` / `--route` / `--audit`의 동작·출력 스키마는 그대로 둔다.

#### Touch

- Modify `scripts/src/lib/cli-project-commands.ts` — `DISTILL_MODES`에
  `preflight` 추가, 경로 인자 거부 분기 확장, `alwaysDistillSelection` 헬퍼와
  `cmdDistill`의 선택 분기, usage 문자열 갱신.
- Modify `scripts/lib/cli-project-commands.js` — 위 변경의 CJS emit
  (`npm run build`로 재생성; 소비자는 Node만 쓴다).
- Modify `test/cli-project-commands.test.js` — preflight 선택·인벤토리·경로
  거부·단일 파일 폴백·always 부재 stderr 케이스 추가.
- Modify `docs/cli.md` — 명령표 19행과 36~40행 설명에 `--preflight` 기재.

#### Constraints

- 기존 네 모드의 stdout 스키마와 종료 코드는 바뀌지 않는다. 새 키를 payload에
  더하지 않는다 — `mode` 값만 `preflight`로 달라진다.
- stdout은 pipe-clean을 유지한다. 진단은 전부 stderr다.
- `--all` 전용인 바이트 총량 요약(`writeDistillAllSizeSummary`)은
  `--preflight`에 붙이지 않는다. 선택 결과를 총량으로 오해하게 만든다.
- 새 모듈이나 새 config 키를 만들지 않는다. 선택 헬퍼는
  `allDistillSelection` 옆 같은 파일에 둔다.
- 주석은 한국어로, 왜 그렇게 갈랐는지만 남긴다.

### Task 002

#### Goal & intent

`/bouncer-plan` 프리플라이트가 `--all` 출력을 컨텍스트에 붓는 대신,
`--all`은 스크래치 baseline 파일로 받고 컨텍스트에는 `--preflight` 출력만
싣는다. `discovery`와 `spec-authoring`은 "완전한 `--all` 출력"이 아니라
preflight 출력 + baseline 절대 경로를 받는다. `CLAUDE.md` 하드룰 7이 이
두 층(프리플라이트 / 재접지)을 기술한다. 완료 판정은 세 스킬 본문에
`--all` 출력 소비 문장이 남지 않고 `npm run ci`가 통과하는 것이다.

#### Interface

- 제공:
  - `/bouncer-plan` **Project Distill** 절: `distill --all`은 baseline 파일로
    리다이렉트하고 stderr 총량 한 줄 보고는 유지, 컨텍스트 주입은
    `distill --preflight`. baseline 파일의 절대 경로와 preflight 출력을
    `discovery` / `spec-authoring`에 함께 넘긴다.
  - `discovery` step 1: 소비 대상이 preflight 출력 + baseline 경로임을 명시.
    파일·인덱스 부재는 여전히 하드 스톱이 아니며 Overlap `"none"` 폴백 유지.
  - `spec-authoring` step 2 project Distill 항목: 계획 작성 시점의 근거는
    재접지된 `--for` 결과와 preflight 출력이고, 전량이 필요하면 baseline
    파일을 연다.
  - `CLAUDE.md` 하드룰 7: 읽기가 두 층임을 기술 — 경로 확정 전에는
    `--preflight`(+ baseline 파일), 확정 후에는 경로별 `--for`.
- 거부:
  - baseline 파일이 없는 상태에서 라우팅 결과로 baseline을 대체하는 것.
    지침은 `--all` 재실행을 지시한다.
  - finalize의 승격 읽기 계약(하드룰 7 후반부, `--all --json` 감사와 샤드
    전량 검색)은 이 태스크에서 바꾸지 않는다 — 003 소관.

#### Touch

- Modify `skills/bouncer-plan/SKILL.md` — Project Distill 절과 step 6 재접지
  문단을 두 층 계약으로 고친다.
- Modify `skills/discovery/SKILL.md` — step 1 Pre-read와 Question checklist의
  Distill 소비 대상을 preflight + baseline으로 바꾼다.
- Modify `skills/spec-authoring/SKILL.md` — step 2 project Distill 항목의
  「complete `bouncer distill --all` output」 표현을 새 계약으로 바꾼다.
- Modify `CLAUDE.md` — 하드룰 7의 plan 읽기 문장을 두 층으로 다시 쓴다.
- Modify `test/skill-bouncer-plan.test.js` — preflight·baseline 문구 계약 assert.
- Modify `test/skill-discovery.test.js` — 소비 대상 변경 assert.
- Modify `test/skill-spec-authoring.test.js` — `--all` 전량 소비 문구 부재 assert.
- Modify `test/master-rules.test.js` — 하드룰 7 문구 계약 갱신.

#### Constraints

- 하드룰 7의 나머지 계약(PROJECT_ROOT 해석, 단일 파일 폴백, 라우트 결과가
  전수 검색을 대체하지 않음, Distill은 영어 런타임)은 문구를 유지한다.
- 스킬 본문에 Distill 본문 내용을 옮겨 적지 않는다 — 하드룰 7의 금지다.
- ACQ 게이트 목록과 단계 번호는 바뀌지 않는다. 프리플라이트는 여전히
  질문하지 않는 단계다.
- baseline 파일 경로는 세션 스크래치 디렉터리를 쓰고 저장소에 남기지 않는다.
- 스킬 본문 영어, 프로젝트 문서 한국어라는 기존 언어 규칙을 유지한다.

### Task 003

#### Goal & intent

`/bouncer-finalize` step 1이 `distill --all --json`을 한 번 부르고, 그
payload의 `content`와 `audit.shards`로 `id → {path, currentBody}` 맵을 만든다.
등록 샤드를 파일에서 다시 읽는 두 번째 패스를 없앤다. add/replace/drop 판단이
쓰는 정보는 그대로다 — 같은 본문을 두 번 싣던 것을 한 번으로 만드는 것뿐이다.
완료 판정은 finalize 본문에 샤드 파일 재읽기 지시가 남지 않고 `npm run ci`가
통과하는 것이다.

#### Interface

- 제공:
  - `/bouncer-finalize` step 1: `distill --all --json` 한 번 → payload의
    `repoRoot`로 각 `audit.shards[].path`를 해석하고, `content`를 갈라
    `currentBody`를 채운다. 경계는 `audit.shards[].id`로 만든 알려진 id
    집합에 속하는 `# <id>` 줄만 인정한다 — 임의의 `# ` 줄을 경계로 잡으면
    본문 안의 헤딩이 샤드를 쪼갠다. 그 맵을 `spec-authoring`에 넘긴다.
  - 분해 결과의 id 집합이 `audit.shards`의 id 집합과 다르면 승격을 진행하지
    않고 실패로 보고한다. 나머지 finalize 단계는 계속 진행한다.
  - `CLAUDE.md` 하드룰 7의 finalize 문장을 같은 계약으로 맞춘다.
- 거부:
  - 라우트/선택 출력(`--route`, `--for`)을 shard body나 write target으로
    쓰는 것 — 기존 금지를 유지한다.
  - 분해가 어긋났을 때 부분 맵으로 승격을 밀어붙이는 것. 완전성이 비용보다
    우선이다.

#### Touch

- Modify `skills/bouncer-finalize/SKILL.md` — step 1의 샤드 읽기 절차를
  payload 분해로 바꾸고 불일치 시 실패 보고 규칙을 적는다.
- Modify `skills/spec-authoring/SKILL.md` — Distill promotion proposal 절의
  "finalize가 각 샤드를 따로 읽어 넘긴다" 서술을 payload 유래로 고친다.
- Modify `CLAUDE.md` — 하드룰 7 finalize 문장을 같은 계약으로 맞춘다.
- Modify `test/skill-bouncer-finalize.test.js` — payload 분해·불일치 실패
  문구 계약 assert.
- Modify `test/skill-spec-authoring.test.js` — 승격 입력 출처 문구 assert.
- Modify `test/master-rules.test.js` — 하드룰 7 finalize 문구 계약 갱신.

#### Constraints

- 승격 동의는 지금처럼 목록 전체에 대한 한 번의 ACQ다(037 계약). 샤드별로
  묻는 형태로 바꾸지 않는다.
- 거부는 게이트가 아니며 나머지 finalize를 계속 진행한다는 기존 규칙을
  유지한다.
- `## 이해 상태` / `## Quiz` / comprehension 필드를 Distill로 승격하지 않는
  금지는 그대로다.
- 분해 규칙은 스킬 본문의 절차로만 적는다 — `scripts/`에 파서를 만들지
  않는다.
- 태스크 002가 고친 `CLAUDE.md` 하드룰 7의 plan 두 층 문장과
  `test/master-rules.test.js`의 그 assert는 되돌리지 않는다. 이 태스크가
  같은 파일에서 손대는 것은 finalize 문장뿐이다.

### Task 004

#### Goal & intent

`.bouncer/config.json`이 `distill.routing_enabled: true`이고 CLI가 config를
인덱스 메타데이터보다 우선하므로 라우팅은 켜져 있다. 그런데
`.bouncer/Distill.md` frontmatter는 `routing_enabled: false`이고, 7개 샤드
본문 첫 줄은 전부 「routing remains disabled until the project explicitly
opts in」이다. 읽는 쪽 컨텍스트에 매번 실려 가는 거짓 진술이라 둘 다
정정한다. 완료 판정은 저장소에서 두 문자열이 사라지고 `npm run ci`가
통과하는 것이다.

#### Interface

- 제공:
  - `.bouncer/Distill.md` frontmatter `distill.routing_enabled`가 `true`.
  - 각 샤드 본문의 `# <id>` 다음 안내 문단을 그 샤드가 무엇을 담는지
    한 줄로 말하는 영어 문장으로 교체한다.
  - `test/distill.test.js`가 인덱스 `routing_enabled`를 `true`로 고정한다.
- 거부:
  - `## Invariants` / `## Gotchas` / `## Decisions` 아래 규칙 문장을
    더하거나 빼거나 고치는 것. 이번에 바뀌는 것은 헤딩 아래 안내 문단과
    frontmatter 플래그뿐이다.
  - `shards[]`의 `id` / `always` / `paths` / `pulls` 변경.

#### Touch

- Modify `.bouncer/Distill.md` — frontmatter `routing_enabled`를 `true`로.
- Modify `.bouncer/distill/core.md` — 안내 문단 교체.
- Modify `.bouncer/distill/validate-gates.md` — 안내 문단 교체.
- Modify `.bouncer/distill/context-layout.md` — 안내 문단 교체.
- Modify `.bouncer/distill/git-worktree.md` — 안내 문단 교체.
- Modify `.bouncer/distill/graph.md` — 안내 문단 교체.
- Modify `.bouncer/distill/plugin-skills.md` — 안내 문단 교체.
- Modify `.bouncer/distill/build-ts.md` — 안내 문단 교체.
- Modify `test/distill.test.js` — 인덱스가 `routing_enabled: true`임을 고정하는
  assert를 맞춘다.

#### Constraints

- Distill은 영어 런타임이다. 교체 문장도 영어로 쓴다.
- 규칙 불릿의 개수와 문장은 보존한다. 승격/삭제는 finalize 소관이지
  이 태스크가 아니다.
- `git-worktree.md`처럼 `## Invariants`가 비어 있는 샤드의 빈 헤딩은
  그대로 둔다 — 렌더 형식이다.
- 안내 문장은 샤드마다 한 줄이며 규칙을 요약하지 않는다. 요약을 넣으면
  본문과 이중 진술이 된다.
- 샤드 파일은 원래 finalize 승격 경로에서만 열리도록 `makeAllowed`가 좁혀져
  있다(`scripts/src/lib/scope.ts`의 「일반 task가 샤드를 몰래 커밋하는 회귀를
  막는다」). 이번에는 규칙 승격이 아니라 사실과 어긋난 안내 문장·플래그 정정이라
  경로를 `affected_paths`에 명시해 통과시킨다. 이 예외를 근거로 규칙 불릿을
  건드리면 그 금지를 깨는 것이다.
