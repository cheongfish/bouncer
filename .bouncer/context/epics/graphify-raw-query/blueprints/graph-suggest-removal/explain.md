---
type: bouncer.explain
title: 001 explain
description: Explain for 001
resource: .bouncer/context/epics/graphify-raw-query/blueprints/graph-suggest-removal/explain.md
tags:
  - bouncer
  - explain
timestamp: '2026-10-15T10:54:47.852+09:00'
bouncer:
  id: EXPLAIN-graph-suggest-removal
  epic_id: graphify-raw-query
  blueprint_id: graph-suggest-removal
  status: published
  comprehension:
    - range_from: 62a9bebbd953dcbbfa59c535a89c4308756778cc
      range_to: abee943975f1f8b565d06136481e16bb553c7652
      diff_sha: ba9d0d48b6323153534b53928707d5ced266c1eb57eea6f17f0ceb4faf40b46b
      recorded_at: '2026-10-15T11:00:58+09:00'
  task_commits:
    - task: graphify-raw-query/graph-suggest-removal/001
      sha: 99e75bdb
      intent_anchor: task-001
    - task: graphify-raw-query/graph-suggest-removal/002
      sha: abee9439
      intent_anchor: task-002
---
# Explain

## Background

plan은 수정 대상 파일을 `bouncer graph-suggest`로 추정했다. 이 명령은 중심 함수에서 출발하는 변경에서 탐색 상한(파일 8개)에 걸려 후보를 거의 내지 못했고, 2026-10-15 실험에서는 Task 34개 전부에서 후보가 비었다. 반면 원본 `graphify explain`·`query` 질의는 소스 파일 기준 F1 0.911이었다. 또 그래프는 작성이 끝난 뒤에야 갱신되어, Discover와 증거 수집이 갱신 전 그래프를 읽을 수 있었다. 이 변경은 plan 초입에 그래프를 갱신하고 원본 질의와 `grep -l`로 후보와 근거를 만들게 하며, 쓸모를 잃은 `graph-suggest` 명령과 구현을 제거한다.

## Intuition

색인 카드를 먼저 최신으로 고쳐 두고, 카드가 가리키는 책장만 열어 필요한 쪽을 읽는다. 카드에 없는 책(테스트·문서)은 제목 검색(`grep`)으로 찾는다. 예전에는 카드 정리 담당(`graph-suggest`)이 책장이 많은 곳에서는 아무것도 가져오지 못했다.

## Code

- `references/graphify-runner/index.md`: 원본 질의 기준의 다섯 단계. 함수 앵커는 `explain`, 상수 앵커는 `query --budget 1000`이며 `[!] TRUNCATED`가 나올 때만 3000으로 한 번 다시 실행한다. `Complete answer over budget`은 이미 완전한 결과라 다시 실행하지 않는다. 앵커 질의는 한 번의 Bash 호출로 묶고, 자연어 질의·짐작한 심볼·줄 번호는 쓰지 않는다. 소스 외 파일은 `grep -l`로 찾고 생성본 쌍을 함께 넣으며, 후보마다 근거 한 줄을 남기고 `graphify-out/` 경로는 걸러낸다. 그래프가 없으면 `rg` 기반 후보를 제시한다.
- `skills/bouncer-plan/SKILL.md`, `skills/bouncer-plan/references/scope-confirm.md`: 1단계 Discover 전에 `bouncer graph-sync`를 실행하고, 사용자에게는 `graph-suggest` 출력 대신 후보와 근거 목록을 보인다.
- `skills/bouncer-plan/references/evidence-dispatch.md`, `references/spec-authoring/index.md`: `io_coupling`은 `explain`으로 읽을 곳을 먼저 좁힌 뒤 해당 줄 범위에서 I/O를 판정한다. 그래프에는 I/O가 보이지 않기 때문이다. Touch `근거`에는 호출자 수를 적을 수 있고, 그래프 결과로 테스트 기대값을 정하지 않는다.
- `scripts/src/lib/cli-project-commands.ts`, `scripts/src/lib/cli.ts`, `rules/cli.md`: `graph-suggest` 등록과 사용법을 지운다. 이후 실행은 일반 unknown command(exit 2)이고, 별칭이나 제거 안내 메시지는 두지 않는다. 이 동작은 `test/cli-help.test.js`가 검사한다.
- `scripts/src/lib/graph-search.ts`, `test/graph-search.test.js`, `test/fixtures/graph-search-quality.json`: 구현 1,202줄, 테스트 1,170줄과 참조 없는 fixture를 삭제한다.
- `scripts/check-doc-shape.js`, `test/skill-bouncer-plan.test.js`, `test/skill-bouncer-surface.test.js`: 삭제한 `graphify-suggestions.md`의 링크·존재 검사를 정리한다.
- 한계: 진입 스킬 단어 수 합계가 8662로 상한 8665에 근접해 있다. 이 저장소는 `graphify.enabled`가 `false`라서 새 흐름을 실제 plan에서 실행해 보지는 않았다.
- 검증: `npm run ci` 통과.

## Quiz

아래 질문에 한 번에 답한다. 정답과 응답은 파일에 적지 않는다.

1. 상수 앵커 `query`가 `[!] TRUNCATED`를 출력했을 때 runner는 어떻게 하는가?
   - A) 자연어 문장으로 바꿔 다시 질의한다.
   - B) 같은 앵커로 `--budget 3000`을 한 번만 다시 실행한다.
   - C) 결과가 잘렸으니 후보 없음으로 처리한다.
2. 변경 후 `bouncer graph-suggest --query x`를 실행하면?
   - A) 빈 후보 JSON을 출력한다.
   - B) "제거됨" 안내 메시지와 함께 exit 0으로 끝난다.
   - C) unknown command로 exit 2가 된다.
3. `io_coupling`을 모을 때 `explain` 결과는 어떻게 쓰이는가?
   - A) 읽을 함수를 좁히는 데 쓰고, I/O 판정은 해당 줄을 읽어서 한다.
   - B) 그래프에 나온 `node:fs` 관계를 그대로 I/O 목록으로 쓴다.
   - C) `explain`이 호출자를 돌려주면 줄을 읽지 않고 Touch에 옮긴다.
4. 그래프(`graphify-out/source/graph.json`)를 만들 수 없는 환경에서 plan은?
   - A) 후보 없음으로 두고 경로를 직접 입력하라고만 안내한다.
   - B) 이전 세션의 그래프를 재사용한다.
   - C) `rg` 기반 후보를 근거와 함께 제시하고, basis에 그래프 상태를 남긴다.

## Tasks

### graphify-raw-query/graph-suggest-removal/001 · `99e75bdb`

#### Goal & intent

plan 스킬 문서가 `graph-suggest` 대신 원본 Graphify 질의(`explain`, `query`)와 `grep -l`로 수정 대상 후보를 찾게 한다. 그래프는 plan 초입에 갱신한다. 완료 판정은 epic Success criteria 1(문서·테스트 범위), 3, 4, 5이고, 중간 확인 명령은 `npm run lint:docs`와 `node --test test/skill-bouncer-plan.test.js test/skill-bouncer-surface.test.js`다. 최종 verify는 TASKS-003의 `npm run ci`다.

#### Current behavior

- `skills/bouncer-plan/SKILL.md:40`의 데이터 목록에 "`graph-suggest` stdout"이 있다. `:43` Skill flow는 "source/test `graph-suggest` advice"로 끝난다. `:207`(3단계)은 `./references/graphify-suggestions.md`를 링크하고, 4단계 전에 `graph-suggest` stdout을 보이라고 한다. `:210`은 "never from `suggested_paths`, `candidates`, or inspect output"이라고 쓴다. preflight·Project root(`:91` 부근, `:32`~`:36`) 뒤에 그래프 갱신 지시는 없고, 1단계 Discover(`:45`~)는 `rg --files`/`rg -l`로 후보 목록을 만든다.
- `references/graphify-runner/index.md`: frontmatter description(`:3`)은 "to run graph-suggest and return role candidates, quality…"이다. Step 1(`:66`)은 "Sync graphs after authoring", Step 2(`:74`)는 실행 파일 해석과 skip, Step 3(`:107`~`:168`)은 `graph-suggest` Rank 규칙(`--query`/`--seed`/`--debug`/shrink), Step 4(`:169`)는 `suggested_paths` 매핑, Step 5(`:183`)는 반환이다. Guardrails(`:190`~)와 Return(`:213`~)은 `suggested_paths`·candidates를 반환 계약으로 둔다. `:144`는 seed 예시로 `scripts/src/lib/graph-search.ts`를 쓴다.
- `skills/bouncer-plan/references/graphify-suggestions.md`(20줄)는 `graph-suggest` 결과 표시 지침이다.
- `skills/bouncer-plan/references/scope-confirm.md:3`~`:6`은 "first show that task's `graph-suggest` stdout … role `candidates` … `quality.status`"를 요구한다.
- `skills/bouncer-plan/references/evidence-dispatch.md`(21줄)에는 그래프 지시가 없다. `:10`이 후보 경로 입력, `:13`이 네 보고 필드다.
- `references/spec-authoring/index.md:236`~`:242`는 tags·검색 어휘를 `graph-suggest` 기준으로 설명하고 예시 태그에 `graph-suggest`를 쓴다. Touch 규칙(`:145`~`:162`)에 호출자 수 근거나 그래프 사용 금지 규칙은 없다.
- `rules/document-schema.md:47`, `:51`, `:66`이 `graph-suggest`를 검색 어휘·advisory 입력으로 언급한다.
- `docs/architecture/rule-ownership.md:71` plan 행이 `skills/bouncer-plan/references/graphify-suggestions.md`를 나열한다. `docs/install.md:339`는 "`graphify-runner`는 그 경로로 `graph-sync` / query를 돌립니다"이다.
- `scripts/check-doc-shape.js:877`은 SKILL.md 3단계에 `./references/graphify-suggestions.md` 링크를 요구하고, `:908`~`:911`은 runner에 1~5단계 순서를 요구한다.
- `test/skill-bouncer-plan.test.js:14`는 `graphify-suggestions.md` 존재를, `test/skill-bouncer-surface.test.js:205`(CONDITIONAL_HELPERS)와 `:268`(SKILL_LOCAL_REFS, `:299`~`:305`에서 검사)은 SKILL.md의 `./references/graphify-suggestions.md` 인용을 요구한다.
- 재현: `rg -n 'graph-suggest|graphify-suggestions' skills references rules docs scripts/check-doc-shape.js test/skill-*.test.js`가 위 위치를 출력한다. 현재 `npm run lint:docs`는 통과한다.

#### Target behavior

- 성공:
  - SKILL.md: Project root 직후 1단계 전에 "Graph sync" 단락이 `bouncer graph-sync`를 실행하고 결과를 runner의 sync basis로 기록하게 한다. 1단계 Discover는 소스 진입점·관련 함수 후보를 runner Step 3의 앵커 질의로 먼저 찾고, 규약 파일·테스트·설정은 `rg`로 찾는다. 3단계는 작성 후 runner Step 3~5로 후보와 근거를 만든다고 쓰고 `graphify-suggestions.md` 링크를 없앤다. `:40`, `:43`, `:207`, `:210`의 `graph-suggest`·`suggested_paths`·`candidates` 표현은 "Graphify 질의 결과"로 바뀐다.
  - graphify-runner: 다섯 단계 — 1 Sync at plan entry(소스가 작성 중 바뀐 경우에만 재실행), 2 실행 파일 해석·가용성(부재 시 `rg` 폴백, basis 상태 기록), 3 소스 앵커 질의, 4 소스 외 `grep -l`, 5 반환(per-graph basis + 후보별 근거 한 줄). Step 3 규칙은 epic Success criterion 4 전부를 담는다. 새로 만들어질 파일은 Task 설명에 이름이 있을 때만 후보에 넣는다는 규칙도 Step 3에 둔다. Guardrails·Return에서 `suggested_paths`·`quality`·role `candidates`가 사라진다.
  - evidence-dispatch: `io_coupling`은 진입 함수 `explain` 결과로 읽을 호출 대상을 좁힌 뒤 해당 줄 범위만 읽어 `file:line`을 확정한다. 그래프에 I/O가 보이지 않음을 명시한다. `tests`는 `rg`로 찾되 확정된 소스 모듈을 출발점으로 쓴다. 그래프가 없으면 기존처럼 진입 파일을 읽는다.
  - spec-authoring: Touch `근거`에 `explain(<symbol>): 호출 N / 파일 M` 형식의 호출자 수를 쓸 수 있다. 그래프 결과로 테스트 기대값을 정하지 않는다. 간접 연결 때문에 export 영향 범위는 `rg`로 재확인한다. tags 지침은 "Graphify 질의와 `grep`이 쓰는 어휘"로 바뀌고 예시 태그에서 `graph-suggest`가 빠진다.
  - scope-confirm·document-schema·rule-ownership·install 문서의 해당 표현이 원본 질의 기준으로 바뀐다. `graphify-suggestions.md`는 삭제된다.
- 실패: 없음(문서 변경). 판정 근거는 `npm run lint:docs` 통과와 아래 Checklist의 문자열 검색이다.
- 보존: plan 8단계 번호와 ACQ 위치(1·2·3·4·6), SKILL.md의 `scope-confirm.md`·`evidence-dispatch.md`·`context-review.md` 링크, runner의 sync 결과→`status` 매핑 표와 Graphify 활성화 안내 문구, `affected_paths`는 사용자 확인 후에만 쓴다는 규칙, AGENTS.md hard rule 1 적용.

#### Interface

- 제공: runner 반환 = per-graph sync basis 목록(`graph` `source`|`test`, `status`, `query`, `result`) + 후보 목록. 후보 한 줄은 `<path> — <근거>`이고 근거는 `graphify explain(<symbol>)`, `graphify query(<CONSTANT>)`, `grep -l <식별자>`, `생성본 쌍` 중 하나다.
- 제공: 소스 질의 명령 형식
  ```bash
  "$GRAPHIFY_BIN" explain "<function>" --graph graphify-out/source/graph.json; \
  "$GRAPHIFY_BIN" query "<CONSTANT>" --graph graphify-out/source/graph.json --budget 1000
  ```
- 거부: 자연어 문장 `query`, 일반 명사 앵커, 존재가 확인되지 않은 심볼 조회, 줄 번호를 결정 근거로 쓰기, 테스트 그래프 `--context call` 질의, 근거 없는 후보, `graphify-out/` 아래 경로, `CHANGELOG.md` 후보, Task 설명에 이름이 나오지 않은 아직 없는 새 파일(그래프에 없으므로 짐작으로 추가하지 않음).
- fallback: `GRAPHIFY_BIN` 공백·source 그래프 없음·sync 실패 → basis에 매핑된 `status`를 남기고 `rg` 기반 후보를 제시.

#### Touch

| 경로 | 심볼 | 변경 | 현재 책임 | 계획한 변경 | 근거 |
| --- | --- | --- | --- | --- | --- |
| `skills/bouncer-plan/SKILL.md` | 데이터 목록, Skill flow, Graph sync 단락, 1·3·4단계 | Modify | 작성 후 `graph-suggest` 결과 표시 | 초입 sync, Discover 앵커 질의, 링크 교체 | 흐름 진입점 |
| `references/graphify-runner/index.md` | Step 1~5, Guardrails, Return | Modify | `graph-suggest` Rank 규칙과 반환 계약 | 원본 질의 다섯 단계로 재작성 | 규칙 본문 소유 |
| `skills/bouncer-plan/references/graphify-suggestions.md` | 전체 | Delete | `graph-suggest` 표시 지침 | 삭제, 내용은 runner로 합침 | 결정 2a |
| `skills/bouncer-plan/references/evidence-dispatch.md` | `io_coupling`, `tests` 지시 | Modify | 수집 방법 미지정 | explain 우선 규칙 추가 | 결정 6a |
| `skills/bouncer-plan/references/scope-confirm.md` | 첫 단락 | Modify | `graph-suggest` stdout 표시 | 후보·근거 목록 표시 | 표시 계약 |
| `references/spec-authoring/index.md` | Touch 규칙, Language and prose tags | Modify | tags를 `graph-suggest` 어휘로 설명 | fan-in 근거·금지 규칙, 어휘 문구 교체 | 결정 6a |
| `rules/document-schema.md` | tags, Plan fields 단락 | Modify | `graph-suggest` 언급 | Graphify 질의·`grep`으로 교체 | 문자열 0건 기준 |
| `docs/architecture/rule-ownership.md` | plan 행 | Modify | `graphify-suggestions.md` 나열 | 항목 제거 | 삭제 파일 참조 |
| `docs/install.md` | graphify-runner 설명 문장 | Modify | `graph-sync` / query 문장 | plan 초입 sync·원본 질의로 문장 갱신 | 흐름 변경 반영 |
| `scripts/check-doc-shape.js` | `PATH_CONTRACTS['skills/bouncer-plan/SKILL.md'].steps.links[3]` | Modify | 3단계에 `graphify-suggestions.md` 링크 요구 | `./references/evidence-dispatch.md`만 요구 | lint:docs 계약 |
| `test/skill-bouncer-plan.test.js` | 로컬 reference 존재 테스트 | Modify | `graphify-suggestions.md` 존재 요구 | 목록에서 제거, 부재 단언 추가 | 삭제 반영 |
| `test/skill-bouncer-surface.test.js` | `CONDITIONAL_HELPERS`, `SKILL_LOCAL_REFS` | Modify | `graphify-suggestions.md` 인용 요구 | 두 목록에서 제거 | 삭제 반영 |

#### Constraints

- 본문 규칙 문서는 영어로 쓴다(기존 runner·SKILL.md 언어 유지). 숫자 상한(`--budget 1000`/`3000`, 재실행 1회)은 runner Step 3에만 두고 SKILL.md·evidence-dispatch는 runner를 가리킨다.
- check-doc-shape 계약: SKILL.md 1~8단계 순서와 ACQ 위치, runner 1~5단계 순서를 유지한다. Graph sync 단락은 번호 없는 단락으로 1단계 앞에 둔다.
- 그래프 결과·후보는 advisory이며 frontmatter에 쓰지 않는다는 기존 규칙과 AGENTS.md hard rule 1 문장을 유지한다.
- 테스트 이름은 `<조건> → <결과>` 형식(`npm run lint:test-names`).

### graphify-raw-query/graph-suggest-removal/002 · `abee9439`

#### Goal & intent

`bouncer graph-suggest` 명령과 그 구현(`graph-search.ts`), 테스트, 고아 fixture를 제거한다. 제거 뒤 명령은 일반 unknown command 경로로 exit 2가 된다. 완료 판정은 epic Success criteria 1(CLI 범위)과 2이고, 중간 확인 명령은 `npm run build`와 `node --test test/cli-help.test.js test/cli-project-commands.test.js test/test-tiers.test.js`다. 최종 verify는 TASKS-003의 `npm run ci`다.

#### Current behavior

- `scripts/src/lib/cli-project-commands.ts:21`~`:22`가 `import graphSearch = require('./graph-search'); const { graphSuggest } = graphSearch;`로 가져온다. `:72`~`:78` `type GraphSuggestArgs`, `:80`~`:149` JSDoc과 `parseGraphSuggestArgs`, `:151`~`:168` `cmdGraphSuggest`, `:461`~`:466` 레지스트리 항목 `'graph-suggest': { run: cmdGraphSuggest, usage: "  graph-suggest --query <text> [--seed <value>]... [--debug]\n ..." }`가 있다.
- `scripts/src/lib/cli.ts:52`가 `'graph-suggest': projectCommands['graph-suggest']`로 매핑한다. USAGE는 `:87`~`:90`에서 COMMANDS 값으로 만든다. 알 수 없는 명령은 `:104`~`:111`에서 `Object.hasOwn(COMMANDS, cmd)`가 거짓이면 `unknown command: ${cmd}\n\n${USAGE}`를 stderr에 쓰고 2를 반환한다.
- `scripts/src/lib/graph-search.ts`(1,202줄)는 `./graph-scope`(`DEFAULT_SOURCE_OUT`, `DEFAULT_TEST_OUT`, `realExcludeDirs`)와 `./posix-path`만 import한다. export(`SCORE`, `REASON`, `graphSuggest`, `tokenize` 등)를 쓰는 곳은 `cli-project-commands.ts`와 `test/graph-search.test.js`뿐이다.
- `test/graph-search.test.js`(1,170줄)는 `../scripts/lib/graph-search`를 require한다.
- `test/fixtures/graph-search-quality.json`은 추적되지만 어떤 테스트·스크립트도 참조하지 않는다(`CHANGELOG.md`의 이력 언급만 있음).
- `test/cli-help.test.js:11` SUBCOMMANDS 배열에 `'graph-suggest'`가 있고 `:62`~`:70`이 usage와 대조한다. `:117`~`:125`는 usage 정규식, `:127`~`:146`은 인자 오류 exit 2 세 건이다.
- `test/cli-project-commands.test.js:885`~`:921` 부근에 `graph-suggest --debug` 테스트 두 건이 있다.
- `test/tiers.json:19`의 `unit` 목록에 `"graph-search.test.js"`가 있다. `test/test-tiers.test.js:43`~`:48`은 목록 파일이 실제로 있어야 하고, `:30`~`:35`는 모든 테스트 파일이 tier에 있어야 한다고 단언한다.
- `rules/cli.md:190`에 `bouncer graph-suggest --query <text> [--seed <value>]... [--debug]` 사용법이 있다.
- hooks, agents, `scripts/bouncer`, 플러그인 manifest에는 참조가 없다.
- 재현: `node scripts/bouncer graph-suggest --query x`는 지금 JSON 결과를 낸다. `npm test`는 통과한다.

#### Target behavior

- 성공: `node scripts/bouncer graph-suggest --query x`가 stderr 첫 줄 `unknown command: graph-suggest`와 exit 2로 끝난다. `bouncer --help` usage에 `graph-suggest`가 없다. `graph-search.ts`, `test/graph-search.test.js`, `test/fixtures/graph-search-quality.json`이 없다.
- 실패: 없음(제거). 남은 import가 있으면 `npm run build`(`tsc`)가 실패하는 것으로 드러난다.
- 보존: `graph-sync`, `graphify-bin` 명령과 usage, 다른 명령의 usage 순서·문구, unknown command 처리 경로, `graph-scope.ts`의 export.

#### Interface

- 제공: `COMMANDS`에서 `'graph-suggest'` 키가 사라진다. 다른 공개 명령 집합은 같다.
- 거부: `bouncer graph-suggest ...`는 인자와 무관하게 unknown command(exit 2)다. 별도 제거 안내 메시지나 별칭은 두지 않는다(결정 1a).

#### Touch

| 경로 | 심볼 | 변경 | 현재 책임 | 계획한 변경 | 근거 |
| --- | --- | --- | --- | --- | --- |
| `scripts/src/lib/graph-search.ts` | `graphSuggest` 외 전체 | Delete | 후보 순위 구현 | 삭제 | 호출자는 `cmdGraphSuggest` 하나 |
| `scripts/src/lib/cli-project-commands.ts` | `GraphSuggestArgs`, `parseGraphSuggestArgs`, `cmdGraphSuggest`, 레지스트리 `'graph-suggest'` | Modify | 명령 파싱·실행·등록 | 네 심볼과 import 삭제 | 명령 진입점 |
| `scripts/src/lib/cli.ts` | `COMMANDS['graph-suggest']` | Modify | 명령 매핑 | 매핑 삭제 | dispatch 표 |
| `rules/cli.md` | graph-suggest 사용법 | Modify | 공개 사용법 문서 | 항목 삭제 | 공개 CLI 문서 |
| `test/graph-search.test.js` | 전체 | Delete | 구현 단위 테스트 | 삭제 | 대상 모듈 삭제 |
| `test/fixtures/graph-search-quality.json` | 전체 | Delete | 참조 없는 fixture | 삭제 | 고아 파생물 |
| `test/cli-help.test.js` | SUBCOMMANDS, graph-suggest usage·인자 테스트 | Modify | 명령 목록·usage 단언 | 목록에서 제거, 세 인자 테스트 삭제, unknown command 단언 추가 | 검증 지점 |
| `test/cli-project-commands.test.js` | graph-suggest `--debug` 테스트 | Modify | `--debug` 동작 단언 | 두 테스트 삭제 | 대상 명령 삭제 |
| `test/tiers.json` | `unit` 목록 | Modify | 테스트 tier 배정 | `graph-search.test.js` 제거 | `test-tiers.test.js` 계약 |

#### Constraints

- unknown command 처리 코드(`cli.ts:104`~`:111`)는 바꾸지 않는다.
- 테스트 이름은 `<조건> → <결과>` 형식이고, 단언은 stderr 첫 줄과 exit code처럼 관찰 가능한 결과만 본다.
- 소스 삭제 뒤 로컬 `scripts/lib/graph-search.js`가 남아도 추적 대상이 아니므로 커밋하지 않는다.
