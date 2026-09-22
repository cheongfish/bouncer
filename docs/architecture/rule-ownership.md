# governance 규범 소유권

`rules/governance.md`의 규범 단위와 workflow 적재 단계의 기준선이다. 이 문서는 정본을 옮기지 않는다. 후속 Blueprint가 같은 표를 읽고 문장을 옮긴다.

- `source_path`: `rules/governance.md`
- `source_sha256`: `a6eca121bf2bea9e48ea8e8d623cb2f7867d522da812db50289fb0c2cb4d288d`

`source_sha256`는 그 파일의 원문 바이트에 대한 SHA-256이다. 줄바꿈 정규화나 재직렬화를 거치지 않는다. `rules/governance.md`의 바이트가 바뀌면 같은 변경에서 `sha256sum rules/governance.md`로 이 값을 다시 계산하고, 아래 locator가 여전히 그 바이트 안의 heading과 구절을 가리키는지 맞춘다. digest와 바이트가 다르면 이 문서는 기준선이 아니다.

## 표 계약

소유권 표의 열은 `id`, `source`, `current owner`, `target owner`, `consumers`, `migration BP`이다. `source`는 현재 정본의 heading과, 그 heading 안에서 한 단위만 가리키는 구절이다. `current owner`는 그 구절이 들어 있는 경로이다. 구절은 파일을 열어 그대로 찾는다.

`target owner`는 `AGENTS.md`, `shared rule`, `agent`, `skill`, `docs/code` 중 하나이다. 둘 이상의 소비자가 같은 판단을 하면 `shared rule`이다. 한 역할만 수행하는 절차는 `agent`이다. 한 workflow의 절차는 `skill`이다. lock, fencing, scale을 읽는 코드 위치처럼 에이전트가 실행 중 다시 추론하지 않는 설명은 `docs/code`이다. 이 파일의 단위 가운데 여섯 workflow가 모두 같은 불변조건으로 읽는 항목은 없다. 모든 세션이 읽는 네 경계는 이미 `AGENTS.md`에 있다.

`migration BP`는 `BP2`, `BP3`, `BP4` 중 하나이다. BP2는 plan, init, spec-authoring, template, scaffold가 읽는 계획 계약이다. BP3는 run, execute, commit, finalize, coordinator가 읽는 실행 계약이다. BP4는 구현 설명과, 정본을 비운 뒤 남는 배포 및 공개 문서 참조이다.

load graph의 열은 `consumer`, `startup`, `step`, `failure`이다. consumer는 `init`, `plan`, `run`, `execute`, `commit`, `finalize`, `coordinator` 중 하나이고 각 이름은 한 행이다. 셀 값 `없음`은 그 단계에서 추가로 여는 rule이나 reference가 없다는 뜻이다. 경로를 적은 셀은 그 단계에서 여는 파일이다.

적재는 명령이 있는 위치로 나눈다. 번호 단계 앞에서 `Read`하는 파일만 startup이다. 번호 단계 안의 `read`는 step이다. 성공 경로에는 없고 실패 분기에서만 `read`하는 파일은 failure이다. 같은 단계가 성공 경로와 그 단계의 실패를 함께 다루면 step에 적고, 실패에서만 여는 파일은 failure에 따로 적는다. preamble의 경로 나열, 설치하지 않는다는 고지, runtime index의 링크는 적재가 아니다. `rules/plugin-root.md`가 이미 정한 대로 `AGENTS.md`만 기본 적재이고, `rules/governance.md`는 startup에 넣지 않는다.

heading과 술어가 없는 안내 줄은 행이 아니다. 해당 줄은 `# Governance`, `## Blueprint sizing rule`, `## Lightweight cycle`, `What stays the same:`, `## Task DAG and approved scope`, `## Coordinator mode`이다. `What shrinks (five things only):`는 축소 범위가 다섯이라는 술어가 있으므로 행으로 둔다.

## 소유권

| id | source | current owner | target owner | consumers | migration BP |
| --- | --- | --- | --- | --- | --- |
| GOV-SIZING-ONE-COMMIT | `## Blueprint sizing rule` / `one reviewable commit` | `rules/governance.md` | shared rule | plan · references/spec-authoring/index.md · scripts/lib/templates.js | BP2 |
| GOV-SIZING-VERIFY-SHAPE | `## Blueprint sizing rule` / `source diff` | `rules/governance.md` | shared rule | plan · scripts/lib/scaffold.js · test/validate-structural.test.js | BP2 |
| GOV-SIZING-VERIFY-RUN | `## Blueprint sizing rule` / `integrated로 전이하지 않는다` | `rules/governance.md` | shared rule | run · coordinator | BP3 |
| GOV-SIZING-PATH-WARNING | `## Blueprint sizing rule` / `exceeds 20` | `rules/governance.md` | docs/code | plan · test/validate-gates.test.js | BP2 |
| GOV-SIZING-COMMIT-UNIT | `## Blueprint sizing rule` / `does not commit` | `rules/governance.md` | shared rule | execute · commit · run · finalize | BP3 |
| GOV-SIZING-STAGE-TASK | `## Blueprint sizing rule` / `candidate set` | `rules/governance.md` | shared rule | commit · scripts/lib/scope.js | BP3 |
| GOV-SIZING-STAGE-FINALIZE | `## Blueprint sizing rule` / `tracked transient deletions` | `rules/governance.md` | skill | finalize | BP3 |
| GOV-SIZING-EXPLAIN-STAMP | `## Blueprint sizing rule` / `sha, intent_anchor` | `rules/governance.md` | shared rule | commit · finalize | BP3 |
| GOV-LIGHT-DECLARATION | `## Lightweight cycle` / `no automatic sizing` | `rules/governance.md` | shared rule | plan · execute · scripts/lib/scaffold.js · test/lightweight-cycle.test.js | BP2 |
| GOV-LIGHT-SCALE-FLAG | `## Lightweight cycle` / `exit code 2` | `rules/governance.md` | shared rule | plan · scripts/lib/scaffold.js · test/lightweight-cycle.test.js | BP2 |
| GOV-LIGHT-SHRINK-CLOSED | `## Lightweight cycle` / `five things only` | `rules/governance.md` | skill | plan · test/lightweight-cycle.test.js | BP2 |
| GOV-LIGHT-DOC-SET | `## Lightweight cycle` / `100 lines or fewer` | `rules/governance.md` | shared rule | plan · references/spec-authoring/index.md · scripts/lib/templates.js · scripts/lib/scaffold.js · docs/workflow.md · test/lightweight-cycle.test.js | BP2 |
| GOV-LIGHT-G10 | `## Lightweight cycle` / `requires only` | `rules/governance.md` | shared rule | plan · references/spec-authoring/index.md · docs/workflow.md · test/lightweight-cycle.test.js | BP2 |
| GOV-LIGHT-MAINTENANCE-EPIC | `## Lightweight cycle` / `maintenance epic` | `rules/governance.md` | skill | plan · test/lightweight-cycle.test.js | BP2 |
| GOV-LIGHT-INLINE-DISPATCH | `## Lightweight cycle` / `named agents are unavailable` | `rules/governance.md` | shared rule | execute · run · test/workflow-safety-canon.test.js · test/lightweight-cycle.test.js | BP3 |
| GOV-LIGHT-QUIZ | `## Lightweight cycle` / `one question` | `rules/governance.md` | shared rule | finalize · references/explain-diff/index.md · test/lightweight-cycle.test.js | BP3 |
| GOV-LIGHT-UNCHANGED-DOCS | `## Lightweight cycle` / `are still authored` | `rules/governance.md` | skill | plan · test/lightweight-cycle.test.js | BP2 |
| GOV-LIGHT-UNCHANGED-GATES | `## Lightweight cycle` / `G16 comprehension` | `rules/governance.md` | shared rule | plan · commit · finalize · test/lightweight-cycle.test.js | BP2 |
| GOV-LIGHT-CANONICAL-CONTEXT | `## Lightweight cycle` / `Canonical context remains` | `rules/governance.md` | skill | finalize | BP3 |
| GOV-LIGHT-SCALE-READ-SITES | `## Lightweight cycle` / `scaffoldBlueprint` | `rules/governance.md` | docs/code | scripts/lib/scaffold.js · scripts/lib/validate-gates.js · scripts/lib/validate-structural.js · test/lightweight-cycle.test.js | BP4 |
| GOV-LIGHT-INLINE-LIMIT | `## Lightweight cycle` / `self-review pressure` | `rules/governance.md` | skill | execute · test/lightweight-cycle.test.js | BP3 |
| GOV-LIGHT-RETURN-FULL | `## Lightweight cycle` / `scaffold context-review` | `rules/governance.md` | shared rule | plan · references/spec-authoring/index.md · docs/workflow.md · test/lightweight-cycle.test.js | BP2 |
| GOV-DAG-FIELDS | `## Task DAG and approved scope` / `default sort key` | `rules/governance.md` | shared rule | plan · coordinator · rules/okf.md · test/master-rules.test.js | BP2 |
| GOV-DAG-WAVES | `## Task DAG and approved scope` / `share a wave` | `rules/governance.md` | shared rule | plan · coordinator · test/master-rules.test.js | BP2 |
| GOV-DAG-GATE | `## Task DAG and approved scope` / `G19` | `rules/governance.md` | docs/code | plan · test/master-rules.test.js | BP2 |
| GOV-DAG-BASELINE | `## Task DAG and approved scope` / `does not freeze` | `rules/governance.md` | shared rule | plan · coordinator · test/master-rules.test.js | BP2 |
| GOV-DAG-SCOPE-ESTIMATE | `## Task DAG and approved scope` / `initial estimate` | `rules/governance.md` | shared rule | plan · coordinator | BP3 |
| GOV-COORD-TOPOLOGY | `## Coordinator mode` / `initial expected scope` | `rules/governance.md` | shared rule | run · execute · commit · finalize · coordinator · test/workflow-safety-canon.test.js · test/master-rules.test.js · test/skill-bouncer-run.test.js | BP3 |
| GOV-COORD-REVISION | `## Coordinator mode` / `refused without a reason` | `rules/governance.md` | shared rule | coordinator · commit · test/master-rules.test.js | BP3 |
| GOV-COORD-LOCK | `## Coordinator mode` / `nextRevision` | `rules/governance.md` | docs/code | scripts/lib/scope.js | BP4 |
| GOV-COORD-PATH-BOUNDARY | `## Coordinator mode` / `Inside that boundary` | `rules/governance.md` | shared rule | coordinator · commit · test/master-rules.test.js · test/agents.test.js | BP3 |
| GOV-COORD-SCOPE-AUDIT | `## Coordinator mode` / `ledger's current scope` | `rules/governance.md` | shared rule | commit · coordinator · test/master-rules.test.js | BP3 |
| GOV-COORD-COMMIT-WORKTREE | `## Coordinator mode` / `stays read-only` | `rules/governance.md` | shared rule | run · execute · commit · finalize · coordinator · test/workflow-safety-canon.test.js | BP3 |
| GOV-COORD-AUTHORITY | `## Coordinator mode` / `Workers report` | `rules/governance.md` | agent | coordinator · run · commit · execute | BP3 |
| GOV-COORD-CRITICAL-RECOVERY | `## Coordinator mode` / `exactly one such recovery` | `rules/governance.md` | agent | coordinator | BP3 |
| GOV-COORD-G17 | `## Coordinator mode` / `weaker of the three` | `rules/governance.md` | shared rule | commit · coordinator · test/master-rules.test.js | BP3 |
| GOV-COORD-NO-LEDGER | `## Coordinator mode` / `Without a coordinator ledger` | `rules/governance.md` | shared rule | plan · commit | BP3 |
| GOV-COORD-REPAIR | `## Coordinator mode` / `at most two dynamic repair` | `rules/governance.md` | shared rule | coordinator · run | BP3 |
| GOV-COORD-REPAIR-WRITE | `## Coordinator mode` / `one write unit` | `rules/governance.md` | docs/code | scripts/lib/coordinator.js | BP4 |
| GOV-COORD-PARTIAL-CLOSE | `## Coordinator mode` / `partial_closed` | `rules/governance.md` | shared rule | coordinator · run · finalize | BP3 |

## Load graph

| consumer | startup | step | failure |
| --- | --- | --- | --- |
| init | `rules/plugin-root.md` · `AGENTS.md` | `2 Result handling: skills/bouncer-init/references/init-result.md` · `rules/output.md` · `rules/acq.md` | 없음 |
| plan | `rules/plugin-root.md` · `AGENTS.md` | `1 Discover: references/discovery/index.md` · `3 Author: references/spec-authoring/index.md` · `rules/okf.md` · `rules/governance.md` · `references/stop-slop/index.md` · `skills/bouncer-plan/references/graphify-suggestions.md` · `references/graphify-runner/index.md` · `4 Scope confirm: skills/bouncer-plan/references/scope-confirm.md` · `rules/acq.md` · `references/minimality/index.md` · `5 Review: skills/bouncer-plan/references/context-review.md` · `references/context-review/index.md` · `6 Approval: rules/acq.md` · `7 Activate: rules/current-pointer.md` · `8 Gate: rules/output.md` | 없음 |
| run | `rules/plugin-root.md` · `AGENTS.md` | `1 Preflight: rules/current-pointer.md` · `2 Start ACQ: rules/acq.md` · `4 Coordinator dispatch: rules/subagent-model.md` · `rules/governance.md` · `5 Report: rules/output.md` | 없음 |
| execute | `rules/plugin-root.md` · `AGENTS.md` | `1 Preflight: rules/current-pointer.md` · `2 Prepare: rules/governance.md` · `3 Implement: references/implementation/index.md` · `rules/subagent-model.md` · `skills/bouncer-execute/references/agent-dispatch.md` · `4 Verify/recover: references/verification/index.md` · `5 Review: references/review/index.md` · `skills/bouncer-execute/references/review-round.md` · `6 Gate: rules/output.md` | `4 Verify/recover 실패: skills/bouncer-execute/references/verification-recovery.md` · `references/debugging/index.md` |
| commit | `rules/plugin-root.md` · `AGENTS.md` | `1 Current: rules/governance.md` · `5 Handoff: rules/output.md` · `rules/current-pointer.md` · `rules/acq.md` | 없음 |
| finalize | `rules/plugin-root.md` · `AGENTS.md` | `1 Explain + quiz: skills/bouncer-finalize/references/explain-quiz.md` · `references/explain-diff/index.md` · `2 Remainder: rules/governance.md` · `skills/bouncer-finalize/references/remainder.md` · `rules/acq.md` · `3 PR: skills/bouncer-finalize/references/draft-pr.md` · `4 Cleanup: skills/bouncer-finalize/references/cleanup-handoff.md` · `5 Handoff: rules/current-pointer.md` · `rules/output.md` | 없음 |
| coordinator | `AGENTS.md` | `Worker dispatch: rules/subagent-model.md` · `references/implementation/index.md` · `3 Drive와 5 Judge의 scope revision: rules/governance.md` | 없음 |

run은 drive 진입 때 startup을 한 번 읽고, 같은 drive의 task 반복에서 `AGENTS.md`를 다시 열지 않는다. run 세션은 `references/implementation/index.md`를 열지 않으며, coordinator가 implementer dispatch 때 그 파일을 요구한다. plan step 3과 spec-authoring step 1이 여는 `rules/governance.md`는 파일 전체가 한 바이트 범위라서 계획 판단 밖의 단위까지 함께 들어온다. execute step 2, commit step 1, finalize step 2, run step 4, coordinator의 scope revision도 같은 파일 전체를 연다. 단위별 판단 주체는 소유권 표가 가리키고, 그 목적 밖의 단위를 startup으로 올리지 않는다.

coordinator의 `rules/governance.md` 인용은 Hard guards의 scope revision 문장에 있다. 절차 1 Ground 앞에서 파일 전체를 `Read`하라는 명령은 없다. revision을 판단할 때 연다. repair 거절과 `partial_closed` 중지는 역할 문서의 Hard guards에 있고, 그 분기에서 `rules/governance.md`를 다시 열지 않는다.

## 참조 대조

아래는 `rg -n 'rules/governance\.md' skills agents references test docs AGENTS.md`의 현재 일치이다. workflow 여섯과 coordinator는 load graph에 한 번씩 있다. 그 밖의 일치는 실행 중 적재 행이 아니라 소유권 소비자이거나 인덱스이다.

| site | consumer | phase |
| --- | --- | --- |
| `skills/bouncer-init/SKILL.md:53` | init | 없음. 번호 단계 뒤의 설치 제외 고지이며 `rules/governance.md`를 읽지 않는다 |
| `skills/bouncer-plan/SKILL.md:144` | plan | step 3 Author |
| `skills/bouncer-run/SKILL.md:103` | run | step 4 Coordinator dispatch |
| `skills/bouncer-execute/SKILL.md:101` | execute | step 2 Prepare |
| `skills/bouncer-commit/SKILL.md:34` | commit | step 1 Current |
| `skills/bouncer-finalize/SKILL.md:49` | finalize | step 2 Remainder |
| `agents/bouncer-coordinator.md:74` | coordinator | step. scope revision |
| `references/spec-authoring/index.md:26` | plan | step 3. spec-authoring step 1이 제품 규칙 위치를 가리킨다 |
| `references/spec-authoring/index.md:174` | plan | step 3. light task 분기에서 `## Lightweight cycle`을 가리킨다 |
| `docs/workflow.md:133` | plan | 없음. 사용자 문서가 `## Lightweight cycle`을 가리킨다. GOV-LIGHT-DOC-SET, GOV-LIGHT-G10, GOV-LIGHT-RETURN-FULL의 소비자이다 |
| `AGENTS.md:23` | 없음 | 없음. runtime index 링크이다. startup에서 이 링크를 따라 `rules/governance.md`를 열지 않는다 |
| `test/lightweight-cycle.test.js:15` | 없음 | 없음. GOV-LIGHT-* locator를 읽는 characterization이다 |
| `test/lightweight-cycle.test.js:45` | 없음 | 없음. GOV-LIGHT-DECLARATION, GOV-LIGHT-RETURN-FULL |
| `test/lightweight-cycle.test.js:86` | 없음 | 없음. GOV-LIGHT-DOC-SET, GOV-LIGHT-G10, GOV-LIGHT-SCALE-FLAG |
| `test/lightweight-cycle.test.js:126` | 없음 | 없음. GOV-LIGHT-INLINE-DISPATCH. `execution_mode`가 없음을 run, execute와 함께 본다 |
| `test/master-rules.test.js:680` | 없음 | 없음. GOV-DAG-FIELDS, GOV-DAG-WAVES, GOV-DAG-GATE, GOV-DAG-BASELINE |
| `test/master-rules.test.js:728` | 없음 | 없음. GOV-COORD-TOPOLOGY, GOV-COORD-REVISION, GOV-COORD-PATH-BOUNDARY, GOV-COORD-SCOPE-AUDIT, GOV-COORD-G17 |
| `test/master-rules.test.js:756` | 없음 | 없음. GOV-COORD-PATH-BOUNDARY. ceiling 문장의 정본 개수를 센다 |
| `test/workflow-safety-canon.test.js:144` | 없음 | 없음. GOV-COORD-TOPOLOGY, GOV-COORD-COMMIT-WORKTREE. execute, commit, finalize, run의 cite를 요구한다 |
| `test/workflow-safety-canon.test.js:167` | 없음 | 없음. GOV-LIGHT-INLINE-DISPATCH. execute, run의 cite를 요구한다 |
| `test/skill-bouncer-surface.test.js:180` | 없음 | 없음. 여섯 workflow의 Master rules 블록에 `rules/governance.md`가 없음을 고정한다 |
| `test/skill-bouncer-run.test.js:68` | 없음 | 없음. run step 4가 coordinator 문서와 `rules/governance.md`를 함께 가리키는지 본다 |
| `test/init.test.js:403` | 없음 | 없음. 파일 전체에 Superpowers profile 문구가 없음을 본다 |
| `test/distribution.test.js:74` | 없음 | 없음. 패키지 파일 목록에 `rules/governance.md`가 있는지를 본다. 제거는 BP4이다 |
| `test/agents.test.js:383` | 없음 | 없음. 경로 문자열은 없고 coordinator 본문의 `no ceiling`을 본다. 정본 구절은 GOV-COORD-PATH-BOUNDARY이다 |

`scripts/`는 위 rg 경로에 없다. `scripts/lib/templates.js`, `scripts/lib/scaffold.js`, `scripts/lib/validate-gates.js`, `scripts/lib/validate-structural.js`, `scripts/lib/scope.js`, `scripts/lib/coordinator.js`는 소유권 표의 consumers에만 있다.

## 보존된 결정

닫힌 Blueprint의 결정을 여기에 다시 구현하지 않는다. 해당 정본은 그대로 두고, 이 표는 그 정본을 가리킨다.

| decision | preserved contract | bind |
| --- | --- | --- |
| `043/006` | 조건부 상세는 그 조건의 번호 단계에서 연다. 게이트 판정, commit scope, 증적 기록은 skill 본문에 남긴다 | load graph의 startup은 `AGENTS.md`와 `rules/plugin-root.md`이다. `rules/governance.md`와 실패 전용 reference는 startup에 없다 |
| `043/007` | `rules/plugin-root.md`, `rules/acq.md`, `rules/current-pointer.md`, `rules/subagent-model.md`가 각 운영 블록의 정본이다. trust boundary는 `AGENTS.md` hard rule 1이다 | 이 표는 그 블록을 새 governance 단위로 다시 뽑지 않는다. GOV-COORD-AUTHORITY의 pointer 이동은 `rules/current-pointer.md`에 남기고, BP3는 그 문장을 새 rule로 복제하지 않는다 |
| `061/002` | 새 workflow 세션은 번호 단계 전에 master rule을 읽고, `/bouncer-run`의 같은 drive에서는 불변 규칙을 반복해서 다시 읽지 않는다. 그 Blueprint는 `rules/governance.md`의 light 분리를 범위 밖으로 두었다 | run startup은 drive당 한 번이다. light와 coordinator 본문의 분리는 GOV-LIGHT-*와 GOV-COORD-*의 migration BP로 남기고 이 기준선은 파일을 나누지 않는다 |
| `069/001` | 안전 경계 4의 정본은 `rules/governance.md` `## Coordinator mode`이고 소비자는 execute, commit, finalize, run이다. 안전 경계 6의 정본은 `## Lightweight cycle`이고 소비자는 execute, run이다. init의 Master rules 블록은 `rules/governance.md`를 열지 않는다. 진입 스킬의 번호 단계 수는 init 4, plan 8, execute 6, commit 5, run 5, finalize 5이다 | GOV-COORD-TOPOLOGY, GOV-COORD-COMMIT-WORKTREE, GOV-LIGHT-INLINE-DISPATCH가 그 행의 현재 locator이다. 이전 BP 전에는 이 경로를 유지한다. init load graph의 startup과 step에는 `rules/governance.md`가 없다 |

## Locator 줄 범위

줄 번호는 `source_sha256`가 가리키는 바이트에서의 힌트이다. 식별자는 `source`의 heading과 구절이다.

| unit | lines |
| --- | --- |
| GOV-SIZING-ONE-COMMIT | 5-10 |
| GOV-SIZING-VERIFY-SHAPE | 12-16 |
| GOV-SIZING-VERIFY-RUN | 12-16 |
| GOV-SIZING-PATH-WARNING | 18-22 |
| GOV-SIZING-COMMIT-UNIT | 24-29 |
| GOV-SIZING-STAGE-TASK | 31-34 |
| GOV-SIZING-STAGE-FINALIZE | 34-36 |
| GOV-SIZING-EXPLAIN-STAMP | 36-40 |
| GOV-LIGHT-DECLARATION | 44-49 |
| GOV-LIGHT-SCALE-FLAG | 51-54 |
| GOV-LIGHT-SHRINK-CLOSED | 56 |
| GOV-LIGHT-DOC-SET | 58-62 |
| GOV-LIGHT-G10 | 63-70 |
| GOV-LIGHT-MAINTENANCE-EPIC | 71-74 |
| GOV-LIGHT-INLINE-DISPATCH | 75-82 |
| GOV-LIGHT-QUIZ | 83-85 |
| GOV-LIGHT-UNCHANGED-DOCS | 89-90 |
| GOV-LIGHT-UNCHANGED-GATES | 91-95 |
| GOV-LIGHT-CANONICAL-CONTEXT | 96 |
| GOV-LIGHT-SCALE-READ-SITES | 98-102 |
| GOV-LIGHT-INLINE-LIMIT | 104-107 |
| GOV-LIGHT-RETURN-FULL | 107-110 |
| GOV-DAG-FIELDS | 114-117, 120-122 |
| GOV-DAG-WAVES | 117-119 |
| GOV-DAG-GATE | 124-126 |
| GOV-DAG-BASELINE | 126-128 |
| GOV-DAG-SCOPE-ESTIMATE | 130-131 |
| GOV-COORD-TOPOLOGY | 135-139 |
| GOV-COORD-REVISION | 141-145 |
| GOV-COORD-LOCK | 145-158 |
| GOV-COORD-PATH-BOUNDARY | 159-164 |
| GOV-COORD-SCOPE-AUDIT | 165-169 |
| GOV-COORD-COMMIT-WORKTREE | 170-172 |
| GOV-COORD-AUTHORITY | 172-173 |
| GOV-COORD-CRITICAL-RECOVERY | 174-181 |
| GOV-COORD-G17 | 183-188 |
| GOV-COORD-NO-LEDGER | 190-191 |
| GOV-COORD-REPAIR | 193-197 |
| GOV-COORD-REPAIR-WRITE | 197 |
| GOV-COORD-PARTIAL-CLOSE | 199-204 |
