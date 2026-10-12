---
type: bouncer.explain
title: 001 explain
description: Explain for 001
resource: .bouncer/context/epics/095-coding-standards-pr-retro/blueprints/001-coding-standards/explain.md
tags:
  - bouncer
  - explain
timestamp: '2026-10-12T14:08:48.200+09:00'
bouncer:
  id: EXPLAIN-001
  epic_id: '095'
  blueprint_id: '001'
  status: published
  comprehension:
    - range_from: 9b6ad71492abea41a2caf85a4b5f4da580d9ee64
      range_to: 91fde4bdbc909cf2bfcb7a63f31db8090c03643d
      diff_sha: e500dd7a386570b7f6ecc10fc18910ae8b269d0182084753df1b50a44b5c20a3
      recorded_at: '2026-10-12T14:20:00+09:00'
  task_commits:
    - task: EPIC-095/BP-001/TASK-001
      sha: 275639f7
      intent_anchor: task-001
    - task: EPIC-095/BP-001/TASK-002
      sha: 63acca7e
      intent_anchor: task-002
    - task: EPIC-095/BP-001/TASK-003
      sha: 91fde4bd
      intent_anchor: task-003
---
# Explain

## Background

구현자 지침, 리뷰어 지침, 명세 작성 지침, 코디네이터 카드가 같은 코딩 규칙(테스트, 오류 처리, 재사용, 한국어 주석)을 각자 복사해 들고 있었다. 문서마다 문장이 조금씩 달라 기준이 갈라졌고, 리뷰어가 "테스트가 실제로 결함을 잡는가"를 확인할 근거도 없었다. 이 변경은 규칙을 한 곳에 모으고, 테스트 신뢰성 판정에 쓸 증거(Red run)를 구현자에서 리뷰어까지 전달하게 한다.

## Intuition

사내 규정집을 한 권으로 합치고, 각 부서 매뉴얼에는 "규정집 몇 장을 보라"는 한 줄만 남긴 것이다. 거기에 "시험이 먼저 실패하는 것을 직접 봤다"는 확인서를 심사자에게 붙여 보낸다.

## Code

- `references/coding-standards/index.md` — 아홉 절로 된 정본(Tests, Test trust, Error handling, Reuse and abstraction, Comments and docstrings 등).
- `references/implementation/index.md`, `agents/bouncer-implementer.md`, `agents/bouncer-reviewer.md`, `references/spec-authoring/index.md` — 중복 본문을 줄이고 정본을 Read하도록 바꾼 역할 문서.
- `references/review/assets/reviewer-prompt.md`, `references/coordinator-cards/{review,final_review,implement}.md`, `skills/bouncer-execute/references/{agent-dispatch,review-round}.md` — `{{RED_RUN}}` 칸과 Red run 전달 경로.
- `scripts/check-doc-shape.js` — `PATH_CONTRACTS`에 정본의 절 이름과 순서 계약 추가.
- `.codex/agents/*.toml` — 역할 문서에서 재생성한 거울 파일.

## Quiz

아래 퀴즈는 /bouncer-finalize 채팅에서 한 번에 제시한다. 정답과 응답은 이 문서에 쓰지 않는다.

1. 리뷰어는 Red run 줄이 `미제공`일 때 어떻게 판정하나? (A) 판정하지 않는다 (B) `correctness_tests` finding을 낸다, 기본 severity는 minor (C) 무조건 major로 막는다
2. 테스트를 쓸 때 구현보다 먼저 실행해 실패 이유를 확인하는 이유는? (A) 실행 시간을 줄이려고 (B) 구현 전에 통과하는 테스트는 아무것도 증명하지 못하므로 (C) 모의 객체를 쓰지 않으려고
3. 오류 처리 규칙에서 올바른 것은? (A) 절차 전체를 하나의 try로 감싼다 (B) 모든 오류에 같은 대체값을 돌려준다 (C) 예상한 오류만 흡수하고 나머지는 다시 던지며, 흡수 이유를 한국어 주석으로 남긴다
4. 정본 `references/coding-standards/index.md`에서 절 이름이나 순서가 어긋나면? (A) 문서 모양 검사가 실패한다 (B) 아무 일도 없다 (C) 리뷰어가 자동으로 고친다
5. 정본의 Tests 절이 정규식이나 부분 문자열로 단언하지 말라고 하는 대상은? (A) 반환값과 종료 코드 (B) 문서 문구나 소스 텍스트 (C) 오류 코드

## Tasks

### EPIC-095/BP-001/TASK-001 · `275639f7`

#### Goal & intent

`references/coding-standards/index.md`를 공통 코딩·테스트·한국어 주석 기준의 유일한 정본으로 만든다. 역할 문서의 중복 본문은 `${BOUNCER_ROOT}/references/coding-standards/index.md` Read 지시로 바꾼다. 수용 기준은 epic Success criteria 1·2이며, 검증 명령은 `npm run ci`이다.

#### Current behavior

- 동작 중심 테스트 문단("Assert observable behavior: return values, exit codes, … Name each test as "<condition> → <result>".")이 같은 글자로 네 곳에 있다.
  - `agents/bouncer-implementer.md:121`(Procedure step 5 "Tests first", :115-125)
  - `agents/bouncer-reviewer.md:85`(:83 "Under `correctness_tests`, report a new or changed test that violates this rule:")
  - `references/review/assets/reviewer-prompt.md:112`
  - `references/spec-authoring/index.md:177`("**Checklist** (behavior assertions)")
- 재사용 사다리는 `agents/bouncer-implementer.md:81-95`("Already in this codebase? Reuse… Native platform… Standard library…")에 있다. 대응하는 reviewer Over-engineering rubric은 `agents/bouncer-reviewer.md:126-135`이다.
- 좁은 오류 처리 기준은 `agents/bouncer-implementer.md:99-109`에 있고, reviewer 거울 rubric은 `agents/bouncer-reviewer.md:117-122`이다.
- 이유 주석 기준은 `agents/bouncer-reviewer.md:115-116`에 있다. 정본 규칙은 `references/implementation/index.md:47-56`이다.
- 한국어 주석·docstring 정본은 `references/implementation/index.md` `## Language and detailed comments`(:45-158)에 있다. 내용은 Summary/Args/Returns(:61-66), JSDoc vs `Args:`/`Returns:`(:70), JS·Python 예시(:83-100)이다.
- implementation/index.md를 주석 기준 때문에 읽게 하는 곳:
  - `agents/bouncer-implementer.md:110-114`(접두 없는 경로)
  - `agents/bouncer-coordinator.md:142`(접두 없음)
  - `references/coordinator-cards/implement.md:9-13`(Summary/Args/Returns 재서술)
  - `skills/bouncer-run/SKILL.md:40`
  - `skills/bouncer-run/references/light-run.md:13`
  - `docs/architecture/rule-ownership.md:76`(coordinator 행)과 :78(run·coordinator 설명 문단)
  - `skills/bouncer-execute/SKILL.md:41`은 skill flow 안내라서 구현 호출 계약 링크로 유지한다.
- `test/rule-ownership.test.js`(약 :380-395)는 load-graph 행의 각 참조가 그 consumer 원본의 해당 단계에 실제로 인용됐는지 단언한다. consumer 원본은 execute가 `skills/bouncer-execute/SKILL.md`, coordinator가 `agents/bouncer-coordinator.md`(:72-73)이다. 그래서 execute 행(:73)은 바꾸지 않는다. coordinator 행은 coordinator.md의 실제 인용과 같아야 한다.
- 주석 기준 원문(`references/implementation/index.md:63`)은 "- **Args** — one line per parameter."이다. `references/coordinator-cards/implement.md:11-12`의 "requires Summary, one Args entry per / parameter"는 두 줄에 걸쳐 있다.
- `scripts/check-doc-shape.js:912-918`은 implementation/index.md 제목 순서를 `['When this applies','Steps','Language and detailed comments','Guardrails','Return']`로 강제한다.
- Codex 미러: `scripts/src/lib/codex-agents.ts:41-70` `mdToCodexToml`이 md 본문 전체를 `developer_instructions`로 복사한다. `test/agents.test.js:46-48,74-75,118-140`이 `.codex/agents/*.toml`과 byte 단위로 비교한다. 재생성 npm script는 없다. `init --seed-codex-agents`(`codex-agents.ts:170-186`)는 쓰기 경로이므로 쓰지 않는다.
- I/O 관찰 지점은 `test/agents.test.js:26,62`(md·toml 읽기)와 `test/doc-shape-cli.test.js:8,19-20`(doc-shape CLI spawnSync)이다.
- 재현은 `npm run build && node --test test/agents.test.js test/doc-shape-cli.test.js test/distribution.test.js test/plugin-doc-cites.test.js && npm run lint:docs`이다. 현재는 모두 통과한다.

#### Target behavior

- 성공:
  - `references/coding-standards/index.md`가 생기고 Interface의 H2 아홉 개를 갖는다. 내용 절 다섯 개는 아래와 같다.
    - `Tests`: 관찰 가능한 동작 단언, 형식이 계약일 때만 문구 단언, unit/integration 경계와 외부 의존성 대체, `<조건> → <결과>` 이름
    - `Test trust`: 요구사항 근거 기대값, mock은 외부 의존성만 대체, red 실패 이유 확인, 실행 근거 없는 검출 주장 금지
    - `Error handling`: 실패 지점 근처에서 처리, 예상한 오류만 구분, 흡수한 오류는 한국어 주석으로 명시
    - `Reuse and abstraction`: 재사용 사다리, 요구되지 않은 추상화·확장 금지
    - `Comments and docstrings`: implementation/index.md에서 옮긴 기준 전체. Summary/Args/Returns 계약은 약화하지 않는다.
  - `Core rules` 절에 "이 표준은 승인된 brief·`affected_paths`를 바꾸지 않으며 충돌하면 컨트롤러에 보고한다"를 둔다.
  - implementer Procedure에서 정본 기준 본문을 지우고 정본 Read 지시로 바꾼다.
    - step 1 "Understand, then climb"(:82-95): 재사용 사다리
    - step 3(:99-109): 좁은 오류 처리
    - step 4(:110-114): 주석·docstring
    - step 5(:115-125): 테스트 문단. 실패 테스트 우선 순서 문장은 남긴다.
    - 정본 Read 필수 지시는 step 1에 한 번 두고, step 3·4·5는 해당 절 이름만 가리킨다.
  - reviewer.md와 reviewer-prompt.md는 `correctness_tests`·code-quality·over-engineering rubric의 판정 기준 본문을 정본 Read로 바꾼다. severity·관점·Findings 계약 문장은 남긴다.
  - spec-authoring Checklist 규칙은 정본 `Tests` 절 참조 한 줄이 된다.
  - coordinator implement card, coordinator.md, bouncer-run, light-run은 주석 기준을 위해 coding-standards를 가리킨다.
  - rule-ownership coordinator 행(:76)과 설명 문단(:78)은 `references/implementation/index.md`를 `references/coding-standards/index.md`로 바꾼다. execute 행은 그대로 둔다.
  - 정본은 원문 영어 문장 "Assert observable behavior"와 "**Args** — one line per parameter."를 글자 그대로 유지한다. 잔존 검사가 정본을 식별하는 기준이다.
- 실패: 정본 밖 파일에 위 테스트 문단 또는 Summary/Args/Returns 기준 본문이 남으면 아래 Checklist의 `rg` 검사가 정본 외 경로를 출력한다.
- 보존:
  - implementer의 Authority·Hard guards·실패 테스트 우선 순서·Output contract 필드
  - reviewer의 관점·severity·discovery/delta·Findings 계약
  - `test/agents.test.js` heading 골격 검사
  - minimality의 계획 단계 사다리

#### Interface

- 제공:
  - `references/coding-standards/index.md`(frontmatter `name: coding-standards`, `description`)
    - 이 경로는 `scripts/check-doc-shape.js:702`가 `subskill`로 분류한다. 그래서 공통 제목 `When this applies`, 절차 제목(`Core rules` 허용, :739-743), `Guardrails`, `Return`이 필요하다(:745-747).
    - H2 순서: `When this applies` → `Core rules`(표준의 권한 한계와 충돌 보고) → `Tests` → `Test trust` → `Error handling` → `Reuse and abstraction` → `Comments and docstrings` → `Guardrails` → `Return`
  - `scripts/check-doc-shape.js` 경로 계약 두 개
    - `'references/coding-standards/index.md'`: name `coding-standards`, 위 H2 아홉 개를 required·order로 둔다.
    - `'references/implementation/index.md'`: 제목 순서 `When this applies`·`Steps`·`Guardrails`·`Return`
- 거부:
  - 정본 내용을 `CLAUDE.md`, 소비 프로젝트 루트, `.bouncer/` 아래에 복사하지 않는다.
  - 접두 없는 `references/...` 인용은 새로 만들지 않는다(`test/plugin-doc-cites.test.js:80`).

#### Touch

| 경로 | 심볼 | 변경 | 현재 책임 | 계획한 변경 | 근거 |
| --- | --- | --- | --- | --- | --- |
| `references/coding-standards/index.md` | H2 아홉 개 | Create | 없음 | 공통 기준과 한국어 주석 기준 정본 | Success criteria 1 |
| `references/implementation/index.md` | `## Language and detailed comments` | Modify | 한국어 주석 정본 | 절을 지우고 Steps에 정본 링크 한 줄 | 2b 결정(이전) |
| `agents/bouncer-implementer.md` | Procedure step 1·3·4·5 | Modify | 재사용 사다리·오류 처리·주석·테스트 문단 본문 | 정본 Read 지시로 대체 | 중복 :82-125 |
| `agents/bouncer-reviewer.md` | rubric :83-135 | Modify | 테스트 문단·오류 처리·과설계 기준 본문 | 정본 Read 지시, severity 문장 유지 | 중복 :85,117-135 |
| `references/review/assets/reviewer-prompt.md` | 판정 기준 :110-112 | Modify | 테스트 문단 복사본 | 정본 Read 지시 | 중복 :112 |
| `references/spec-authoring/index.md` | Checklist (behavior assertions) | Modify | 테스트 문단 복사본 | 정본 `Tests` 절 참조 | 중복 :177 |
| `references/coordinator-cards/implement.md` | implementer 사전 Read 지시 | Modify | implementation/index.md와 Summary/Args/Returns 재서술 | coding-standards Read 지시만 | :9-13 |
| `agents/bouncer-coordinator.md` | implementer dispatch 지시 | Modify | implementation/index.md 지시 | coding-standards 지시 | :142 |
| `skills/bouncer-run/SKILL.md` | implementer Read 안내 | Modify | implementation/index.md | coding-standards | :40 |
| `skills/bouncer-run/references/light-run.md` | inline 구현 사전 Read | Modify | implementation/index.md | coding-standards 추가 | :13 |
| `docs/architecture/rule-ownership.md` | coordinator 행, 설명 문단 | Modify | coordinator가 implementation/index.md를 요구 | coding-standards로 교체, execute 행 유지 | :76,78, `test/rule-ownership.test.js` |
| `scripts/check-doc-shape.js` | `PATH_CONTRACTS` | Modify | implementation 제목 5개 강제 | 위 Interface 두 계약 | :912-918 |
| `.codex/agents/bouncer-implementer.toml` | `developer_instructions` | Modify | md 미러 | 재생성 | `test/agents.test.js:118-140` |
| `.codex/agents/bouncer-reviewer.toml` | `developer_instructions` | Modify | md 미러 | 재생성 | 같음 |
| `.codex/agents/bouncer-coordinator.toml` | `developer_instructions` | Modify | md 미러 | 재생성 | `test/agents.test.js:46-48` |
| `test/distribution.test.js` | 필수 패키지 파일 목록 | Modify | implementation/index.md 포함 확인 | coding-standards 추가 | :68-80 |
| `test/doc-shape-cli.test.js` | 경로 계약 단언 | Modify | 기존 계약 실행 | coding-standards 계약 위반 fixture 단언 추가 | 새 계약의 검증 지점 |

#### Constraints

- 새 인용은 모두 `${BOUNCER_ROOT}/references/coding-standards/index.md` 형식이다.
- 정본은 현재 적용할 기준만 담는다. 사건 기록, 과거 구현 설명, 회고 기록은 넣지 않는다(RT-06).
- 기계로 판정할 수 있는 항목(테스트 이름 형식)은 BP 002가 검사로 고정한다. 이 task는 정본 `Tests` 절에 이름 규칙 문장만 둔다. 아직 없는 검사 이름은 쓰지 않는다. 검사 이름 한 줄은 BP 002 TASKS-006이 더한다.
- `.codex/agents/*.toml`은 손으로 고치지 않는다. 빌드한 `scripts/lib/codex-agents.js`의 `mdToCodexToml` 결과만 쓴다.
- `scripts/lib/`는 gitignore된 빌드 결과이므로 Touch에 넣지 않는다.

### EPIC-095/BP-001/TASK-002 · `63acca7e`

#### Goal & intent

implementer 출력 계약에 `Red run` 칸을 추가한다. coordinator와 `/bouncer-execute`는 리뷰 범위에 든 task마다 최근 attempt의 `Red run` 값을 한 줄씩 reviewer 호출 slot `{{RED_RUN}}`에 넣는다. task 범위 리뷰와 blueprint 범위 최종 리뷰 모두 해당된다. reviewer `correctness_tests`는 정본 `Test trust` 절로 판정한다. 수용 기준은 epic Success criteria 3이며, 검증 명령은 `npm run ci`이다.

#### Current behavior

- implementer 출력 계약은 `agents/bouncer-implementer.md:152-175`에 있다.
  - 필드는 Changed files, Checklist coverage, Tests(:162, "tests added or updated, and the result of the last run"), Deviations, Scope impact, Needs planning, Brief revision이다. red 실행 증거 칸은 없다.
  - step 6(:122-123)은 dispatch가 `report_path`를 주면 같은 계약을 그 파일에 쓴다.
- reviewer slot 템플릿은 `references/review/assets/reviewer-prompt.md:24-50`이다.
  - 자리표시자: MODE, PERSPECTIVE, STRATEGY, RISK_FLAGS, TARGET, BRIEF, INTENT_SECTIONS, TASK_BRIEF_HASH, INTENT_BUNDLE_ID, INTENT_BUNDLE_REVISION, CONSTRAINTS, delta 전용 PREVIOUS_FINDINGS·RESOLUTION·REVISION_DIFF
  - 본문은 :52부터 Mode → … → Constraints → Discovery rules 순서다.
- reviewer 입력 목록은 여섯 곳에 반복된다.
  - 템플릿 자체
  - `references/coordinator-cards/review.md:30-45`(`--input` 순서 :50-52)
  - `references/coordinator-cards/final_review.md:84`(blueprint 범위 최종 리뷰 `--input` 순서)
  - `skills/bouncer-execute/references/agent-dispatch.md:115-130`
  - `skills/bouncer-execute/references/review-round.md:58`(discovery reviewer 입력)
  - `references/review/index.md:17,90-96`
- `review_scope: blueprint`인 blueprint(새 scaffold 기본값)는 task별 리뷰 없이 마지막에 blueprint 범위 리뷰를 한 번 연다(`rules/planning.md` Blueprint sizing rule, `skills/bouncer-execute/SKILL.md:192-205`). 그래서 Red run이 task 리뷰에만 가면 이 경로에서는 판정되지 않는다.
- coordinator는 `references/coordinator-cards/review.md:65-69`의 `payload.report`로 보고를 읽는다. TS는 보고 필드를 파싱하지 않는다.
  - `coordinate-next.ts:218` `attachJudgeContext()`는 `{outcome, summary, attempt}`만 붙인다.
  - `print-dispatch.ts:97` `assemblePrintPrompt()`는 input을 그대로 잇는다.
  - 보고 파일은 `.bouncer/runtime/reports/<task>-<attempt>.md`이다(`coordinator.ts:189` `reportPathFor()`).
- reviewer는 brief, diff, 최신 verify 결과만 받는다(`reviewer-prompt.md:32,69`). `correctness_tests` 정의는 `agents/bouncer-reviewer.md:74-75`이다.
- 테스트 고정점은 두 곳이다.
  - `test/coordinate-next.test.js:1295-1311`이 `review`·`final_review` 공유 배열로 input 순서(Mode, Perspective, Target, Brief, Intent sections)를 단언한다. 새 칸을 Constraints 뒤에 두면 통과를 유지한다.
  - `test/agents.test.js:55,107`이 heading 골격을 본다.
- 재현은 `node --test test/coordinate-next.test.js test/agents.test.js test/print-dispatch.test.js`이다. 현재 통과한다.

#### Target behavior

- 성공:
  - implementer Output contract의 Tests 다음에 `Red run` 필드가 생긴다. 값은 둘 중 하나다.
    - `<실행한 명령> — <관측한 실패 단언 또는 실패 지점>`(Checklist가 red 단계를 가진 task)
    - `해당 없음: <이유>`(문서만 바꾸거나 red 단계가 없는 task)
  - verify 실패 재dispatch의 회귀 테스트도 같은 칸에 red 실행을 적는다.
  - reviewer-prompt에 `{{RED_RUN}}` 자리표시자와 `## Red run` 본문 절이 생긴다. 위치는 Constraints 다음, Discovery rules 앞이다.
  - `{{RED_RUN}}` 값은 리뷰 범위에 든 commit task마다 한 줄인 `TASKS-NNN: <Red run 값>`이다. task 범위 리뷰는 한 줄, blueprint 범위 최종 리뷰는 범위 안 모든 commit task의 줄을 task 번호 순서로 둔다.
  - 값의 출처
    - coordinator: 각 task의 가장 최근 attempt 보고 파일(`.bouncer/runtime/reports/<task>-<attempt>.md`)의 `Red run` 줄을 그대로 옮긴다.
    - `/bouncer-execute`: implementer dispatch에 coordinator와 같은 `report_path`(`.bouncer/runtime/reports/<task>-<attempt>.md`)를 준다. implementer는 이미 `report_path`가 있으면 Output contract를 그 파일에 쓴다(`agents/bouncer-implementer.md:123-126`). 그래서 이전 execute 실행에서 구현한 task의 보고도 남는다. reviewer slot은 coordinator와 같은 규칙으로 각 task의 가장 최근 attempt 보고 파일에서 `Red run` 줄을 옮긴다. 이 변경은 `agent-dispatch.md`의 implementer payload와 reviewer slot 절에 쓴다.
    - inline 구현 경로(`/bouncer-execute` light inline 분기, `bouncer-run` light-run): 구현을 직접 수행한 controller가 자신이 실행한 red 명령과 관측 결과를 같은 두 형식 중 하나로 쓴다. 이 규칙은 `references/review/index.md` 입력 목록에 둔다. execute inline 분기는 `agent-dispatch.md`, light-run은 `light-run.md` step 3 Review에서 reviewer를 부를 때 이 줄을 넘긴다고 쓴다.
    - 보고를 찾지 못한 task는 `TASKS-NNN: 미제공`으로 둔다.
  - coordinator review card, final_review card, agent-dispatch, review-round, review/index.md의 입력 목록과 `--input` 순서는 Constraints 다음에 `Red run`을 둔다.
  - `review-round.md`는 두 곳을 고친다. :58 discovery reviewer 입력과 :85 delta reviewer 입력(previous findings, resolution, revision-origin evidence) 모두에 Red run 줄을 더한다. delta에서는 수정 attempt의 최신 보고 값을 쓴다.
  - reviewer `correctness_tests` 정의와 rubric은 정본 `Test trust` 절로 판정한다고 쓴다. 판정 대상은 세 가지다.
    - 기대값이 brief·공개 계약에서 왔는가
    - mock이 검증 대상 동작을 대신하는가
    - red가 의도한 이유로 실패했는가
- 실패:
  - 다음 경우 reviewer는 그 task의 `correctness_tests` finding을 낸다(기본 `minor`, 공개 계약 테스트면 `major`).
    - 줄이 `미제공`이다.
    - 값이 허용 두 형식(`<명령> — <실패 단언·지점>`, `해당 없음: <이유>`) 어느 쪽에도 맞지 않는다.
    - red 단계가 있는 task인데 `해당 없음`이다.
    - 실패 이유가 brief가 지정한 기대 red와 다르다.
  - reviewer는 slot 값 없이 "결함을 검출한다"고 단정하지 않는다.
- 보존:
  - reviewer는 읽기 전용이고 테스트를 다시 실행할 의무가 없다.
  - execute gate가 성공 증거의 유일한 기록자다.
  - 기존 입력 순서(Mode … Constraints)를 지킨다.

#### Interface

- 제공:
  - implementer 보고 필드 `- **Red run**: <명령> — <실패 단언·지점>` 또는 `- **Red run**: 해당 없음: <이유>`
  - reviewer slot `{{RED_RUN}}`: `TASKS-NNN: <값>` 줄 목록(discovery·delta, task·blueprint 범위 공통)
  - print dispatch `--input` 절 `## Red run`(review·final_review 카드)
- 거부:
  - `Red run` 값을 verification.md `## Evidence`에 쓰거나 성공 증거로 쓰지 않는다.
  - TS 코드가 보고나 slot을 파싱·검증하게 만들지 않는다.

#### Touch

| 경로 | 심볼 | 변경 | 현재 책임 | 계획한 변경 | 근거 |
| --- | --- | --- | --- | --- | --- |
| `agents/bouncer-implementer.md` | `## Output contract` | Modify | 7개 필드, red 칸 없음 | Tests 다음 `Red run` 추가 | :152-175 |
| `agents/bouncer-reviewer.md` | `correctness_tests` 정의·rubric | Modify | 누락 테스트·계약 파손만 판정 | 정본 `Test trust` Read와 task별 Red run 사용 | :74-85 |
| `references/review/assets/reviewer-prompt.md` | slot 자리표시자·본문 | Modify | Red run 칸 없음 | `{{RED_RUN}}`, `## Red run` 추가 | :24-50 |
| `references/review/index.md` | 입력 목록 | Modify | 같은 목록 반복 | Red run 추가 | :17,90-96 |
| `references/coordinator-cards/review.md` | slot·`--input` 순서 | Modify | Constraints까지 | Red run 추가, 보고 파일에서 옮기는 규칙 | :30-52,65-69 |
| `references/coordinator-cards/final_review.md` | `--input` 순서 | Modify | Constraints까지 | 범위 안 task별 Red run 줄 추가 | :84, blueprint 범위 리뷰 |
| `skills/bouncer-execute/references/agent-dispatch.md` | implementer payload, reviewer slot 목록 | Modify | `report_path` 없음, 같은 목록 반복 | implementer에 `report_path` 전달, Red run 보고 파일·inline 출처 규칙 추가 | :80-81, :115-130 |
| `skills/bouncer-execute/references/review-round.md` | discovery reviewer 입력 | Modify | brief·diff·latest verify | Red run 추가 | :58 |
| `skills/bouncer-run/references/light-run.md` | step 3 Review | Modify | named reviewer 호출만 있음 | controller가 실행한 red를 Red run 줄로 넘기는 문장 | :20-27 |
| `references/coding-standards/index.md` | `Test trust` | Modify | TASKS-001이 만든 판정 기준 | `Red run` finding 조건 문장 추가 | 정본 단일화 |
| `.codex/agents/bouncer-implementer.toml` | `developer_instructions` | Modify | md 미러 | 재생성 | `test/agents.test.js:118-140` |
| `.codex/agents/bouncer-reviewer.toml` | `developer_instructions` | Modify | md 미러 | 재생성 | 같음 |
| `test/coordinate-next.test.js` | review·final_review input 순서 단언 | Modify | Mode~Intent sections 순서 | 두 카드 모두 Red run이 Constraints 뒤에 있다는 단언 | :1295-1311 |
| `CHANGELOG.md` | `[Unreleased]` | Modify | 088 항목까지 | BP 001 항목 | 프로젝트 관례 |

#### Constraints

- 새 입력 칸은 기존 순서의 뒤(Constraints 다음)에만 둔다. 순서 단언을 깨지 않는다.
- `Test trust` 절의 세 판정 대상 본문은 TASKS-001이 쓴다. 이 task는 `Red run` finding 조건 문장만 그 절에 더한다.
- reviewer 판정 기준 본문은 정본에만 있다. reviewer.md에는 Read 지시와 severity 문장만 둔다.
- TOML 재생성 방법은 TASKS-001 Checklist와 같다.

### EPIC-095/BP-001/TASK-003 · `91fde4bd`

#### Goal & intent

기록된 terminal CI 실패를 복구한다.

#### Interface

- 제공: 실패 command와 관련 경로를 통과시키는 최소 수정
- 거부: Blueprint 밖 scope와 새 기능

#### Touch

- Modify `references/review/assets/reviewer-prompt.md` — 기록된 CI 실패를 복구한다.
- Modify `CHANGELOG.md` — 기록된 CI 실패를 복구한다.

#### Constraints

- 원장의 실패 증적과 repair 결정 범위만 따른다.