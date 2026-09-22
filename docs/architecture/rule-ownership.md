# governance 규범 소유권

BP3 부분 이전 이후 기준선이다. BP2 규범의 현재 소유자는 `rules/planning.md`, 실행·commit 범위 규범은 `rules/commit-scope.md`이고, coordinator mutation 절차와 남은 light·BP4 구현 설명은 `rules/governance.md`에 있다. 이 표는 정본 문장을 복제하지 않으며 current owner 경로의 heading·구절로만 단위를 가리킨다.

- `source_path`: `rules/governance.md`
- `source_sha256`: `14cbd9b56da5563c527a3347c991b918966d7f0b04fd2848ce2fcc74b58f55ea`

`source_sha256`는 `source_path` 파일의 원문 바이트에 대한 SHA-256이다. 줄바꿈 정규화나 재직렬화를 거치지 않는다. 그 파일의 바이트가 바뀌면 같은 변경에서 `sha256sum`으로 이 값을 다시 계산하고, BP3·BP4 locator가 여전히 그 바이트 안의 heading과 구절을 가리키는지 맞춘다. digest와 바이트가 다르면 이 문서는 기준선이 아니다. `source_path` 밖(`rules/planning.md`, `rules/commit-scope.md`)으로 옮긴 행의 구절 존재는 ownership 검사가 각 행이 선언한 current owner 경로로 확인한다. 그래서 owner가 세 파일에 걸쳐도 검사 입력은 행마다 경로 하나다.

## 표 계약

소유권 표의 열은 `id`, `source`, `current owner`, `target owner`, `consumers`, `migration BP`이다. `source`는 현재 정본의 heading과, 그 heading 안에서 한 단위만 가리키는 구절이다. `current owner`는 그 구절이 들어 있는 경로이다. 구절은 파일을 열어 그대로 찾는다.

`target owner`는 `AGENTS.md`, `shared rule`, `agent`, `skill`, `docs/code` 중 하나이다. 둘 이상의 소비자가 같은 판단을 하면 `shared rule`이다. 한 역할만 수행하는 절차는 `agent`이다. 한 workflow의 절차는 `skill`이다. lock, fencing, scale을 읽는 코드 위치처럼 에이전트가 실행 중 다시 추론하지 않는 설명은 `docs/code`이다. 이 파일의 단위 가운데 여섯 workflow가 모두 같은 불변조건으로 읽는 항목은 없다. 모든 세션이 읽는 네 경계는 이미 `AGENTS.md`에 있다.

`migration BP`는 `BP2`, `BP3`, `BP4` 중 하나이다. BP2는 plan, init, spec-authoring, template, scaffold가 읽는 계획 계약이다. BP3는 run, execute, commit, finalize, coordinator가 읽는 실행 계약이다. BP4는 구현 설명과, 정본을 비운 뒤 남는 배포 및 공개 문서 참조이다.

load graph의 열은 `consumer`, `startup`, `step`, `failure`이다. consumer는 `init`, `plan`, `run`, `execute`, `commit`, `finalize`, `coordinator` 중 하나이고 각 이름은 한 행이다. 셀 값 `없음`은 그 단계에서 추가로 여는 rule이나 reference가 없다는 뜻이다. 경로를 적은 셀은 그 단계에서 여는 파일이다.

적재는 명령이 있는 위치로 나눈다. 번호 단계 앞에서 `Read`하는 파일만 startup이다. 번호 단계 안의 `read`는 step이다. 성공 경로에는 없고 실패 분기에서만 `read`하는 파일은 failure이다. 같은 단계가 성공 경로와 그 단계의 실패를 함께 다루면 step에 적고, 실패에서만 여는 파일은 failure에 따로 적는다. preamble의 경로 나열, 설치하지 않는다는 고지, runtime index의 링크는 적재가 아니다. `rules/plugin-root.md`가 이미 정한 대로 `AGENTS.md`만 기본 적재이고, `rules/commit-scope.md`·`rules/governance.md`·`rules/planning.md`는 startup에 넣지 않는다.

heading과 술어가 없는 안내 줄은 행이 아니다. governance 쪽은 `# Governance`, `## Blueprint sizing rule`, `## Lightweight cycle`, `What stays the same:`, `## Task DAG and approved scope`, `## Coordinator mode`이다. planning 쪽은 `# Planning`, `## Blueprint sizing rule`, `## Lightweight cycle`, `What stays the same:`, `## Task DAG and approved scope`, `## Epic naming`이다. commit-scope 쪽은 `# Commit scope`, `## Commit unit and staging`, `## Approved and ledger scope`, `## Worktree and enforcement layers`이다. `What shrinks (five things only):`는 축소 범위가 다섯이라는 술어가 있으므로 행으로 둔다.

## 소유권

| id | source | current owner | target owner | consumers | migration BP |
| --- | --- | --- | --- | --- | --- |
| GOV-SIZING-ONE-COMMIT | `## Blueprint sizing rule` / `one reviewable commit` | `rules/planning.md` | shared rule | plan · references/spec-authoring/index.md · scripts/lib/templates.js | BP2 |
| GOV-SIZING-VERIFY-SHAPE | `## Blueprint sizing rule` / `source diff` | `rules/planning.md` | shared rule | plan · scripts/lib/scaffold.js · test/validate-structural.test.js | BP2 |
| GOV-SIZING-VERIFY-RUN | `## Blueprint sizing rule` / `integrated로 전이하지 않는다` | `rules/governance.md` | shared rule | run · coordinator | BP3 |
| GOV-SIZING-PATH-WARNING | `## Blueprint sizing rule` / `exceeds 20` | `rules/planning.md` | docs/code | plan · test/validate-gates.test.js | BP2 |
| GOV-SIZING-COMMIT-UNIT | `## Commit unit and staging` / `does not commit` | `rules/commit-scope.md` | shared rule | execute · commit · run · finalize | BP3 |
| GOV-SIZING-STAGE-TASK | `## Commit unit and staging` / `candidate set` | `rules/commit-scope.md` | shared rule | commit · scripts/lib/scope.js | BP3 |
| GOV-SIZING-STAGE-FINALIZE | `## Commit unit and staging` / `tracked transient deletions` | `rules/commit-scope.md` | shared rule | commit · finalize | BP3 |
| GOV-SIZING-EXPLAIN-STAMP | `## Commit unit and staging` / `sha, intent_anchor` | `rules/commit-scope.md` | shared rule | commit · finalize | BP3 |
| GOV-LIGHT-DECLARATION | `## Lightweight cycle` / `no automatic sizing` | `rules/planning.md` | shared rule | plan · execute · scripts/lib/scaffold.js · test/lightweight-cycle.test.js | BP2 |
| GOV-LIGHT-SCALE-FLAG | `## Lightweight cycle` / `exit code 2` | `rules/planning.md` | shared rule | plan · scripts/lib/scaffold.js · test/lightweight-cycle.test.js | BP2 |
| GOV-LIGHT-SHRINK-CLOSED | `## Lightweight cycle` / `five things only` | `rules/planning.md` | skill | plan · test/lightweight-cycle.test.js | BP2 |
| GOV-LIGHT-DOC-SET | `## Lightweight cycle` / `100 lines or fewer` | `rules/planning.md` | shared rule | plan · references/spec-authoring/index.md · scripts/lib/templates.js · scripts/lib/scaffold.js · docs/workflow.md · test/lightweight-cycle.test.js | BP2 |
| GOV-LIGHT-G10 | `## Lightweight cycle` / `requires only` | `rules/planning.md` | shared rule | plan · references/spec-authoring/index.md · docs/workflow.md · test/lightweight-cycle.test.js | BP2 |
| GOV-LIGHT-MAINTENANCE-EPIC | `## Lightweight cycle` / `maintenance epic` | `rules/planning.md` | skill | plan · test/lightweight-cycle.test.js | BP2 |
| GOV-LIGHT-INLINE-DISPATCH | `## Lightweight cycle` / `named agents are unavailable` | `rules/governance.md` | shared rule | execute · run · test/workflow-safety-canon.test.js · test/lightweight-cycle.test.js | BP3 |
| GOV-LIGHT-QUIZ | `## Lightweight cycle` / `one question` | `rules/governance.md` | shared rule | finalize · references/explain-diff/index.md · test/lightweight-cycle.test.js | BP3 |
| GOV-LIGHT-UNCHANGED-DOCS | `## Lightweight cycle` / `are still authored` | `rules/planning.md` | skill | plan · test/lightweight-cycle.test.js | BP2 |
| GOV-LIGHT-UNCHANGED-GATES | `## Lightweight cycle` / `G16 comprehension` | `rules/planning.md` | shared rule | plan · commit · finalize · test/lightweight-cycle.test.js | BP2 |
| GOV-LIGHT-CANONICAL-CONTEXT | `## Lightweight cycle` / `Canonical context remains` | `rules/governance.md` | skill | finalize | BP3 |
| GOV-LIGHT-SCALE-READ-SITES | `## Lightweight cycle` / `scaffoldBlueprint` | `rules/governance.md` | docs/code | scripts/lib/scaffold.js · scripts/lib/validate-gates.js · scripts/lib/validate-structural.js · test/lightweight-cycle.test.js | BP4 |
| GOV-LIGHT-INLINE-LIMIT | `## Lightweight cycle` / `self-review pressure` | `rules/governance.md` | skill | execute · test/lightweight-cycle.test.js | BP3 |
| GOV-LIGHT-RETURN-FULL | `## Lightweight cycle` / `scaffold context-review` | `rules/planning.md` | shared rule | plan · references/spec-authoring/index.md · docs/workflow.md · test/lightweight-cycle.test.js | BP2 |
| GOV-DAG-FIELDS | `## Task DAG and approved scope` / `default sort key` | `rules/planning.md` | shared rule | plan · coordinator · rules/document-schema.md · test/master-rules.test.js | BP2 |
| GOV-DAG-WAVES | `## Task DAG and approved scope` / `share a wave` | `rules/planning.md` | shared rule | plan · coordinator · test/master-rules.test.js | BP2 |
| GOV-DAG-GATE | `## Task DAG and approved scope` / `G19` | `rules/planning.md` | docs/code | plan · test/master-rules.test.js | BP2 |
| GOV-DAG-BASELINE | `## Task DAG and approved scope` / `does not freeze` | `rules/planning.md` | shared rule | plan · coordinator · test/master-rules.test.js | BP2 |
| GOV-DAG-SCOPE-ESTIMATE | `## Approved and ledger scope` / `initial estimate` | `rules/commit-scope.md` | shared rule | plan · coordinator | BP3 |
| GOV-COORD-TOPOLOGY | `## Approved and ledger scope` / `initial expected scope` | `rules/commit-scope.md` | shared rule | run · execute · commit · finalize · coordinator · test/workflow-safety-canon.test.js · test/master-rules.test.js · test/skill-bouncer-run.test.js | BP3 |
| GOV-COORD-REVISION | `## Coordinator mode` / `refused without a reason` | `rules/governance.md` | shared rule | coordinator · commit · test/master-rules.test.js | BP3 |
| GOV-COORD-LOCK | `## Coordinator mode` / `nextRevision` | `rules/governance.md` | docs/code | scripts/lib/scope.js | BP4 |
| GOV-COORD-PATH-BOUNDARY | `## Approved and ledger scope` / `governance tree are refused. Inside that boundary` | `rules/commit-scope.md` | shared rule | coordinator · commit · test/master-rules.test.js · test/agents.test.js | BP3 |
| GOV-COORD-SCOPE-AUDIT | `## Approved and ledger scope` / `ledger's current scope instead of the approval snapshot, and refuses a commit` | `rules/commit-scope.md` | shared rule | commit · coordinator · test/master-rules.test.js | BP3 |
| GOV-COORD-COMMIT-WORKTREE | `## Worktree and enforcement layers` / `stays read-only` | `rules/commit-scope.md` | shared rule | run · execute · commit · finalize · coordinator · test/workflow-safety-canon.test.js | BP3 |
| GOV-COORD-AUTHORITY | `## Coordinator mode` / `workers report` | `rules/governance.md` | agent | coordinator · run · commit · execute | BP3 |
| GOV-COORD-CRITICAL-RECOVERY | `## Coordinator mode` / `exactly one such recovery` | `rules/governance.md` | agent | coordinator | BP3 |
| GOV-COORD-G17 | `## Worktree and enforcement layers` / `weaker of the three` | `rules/commit-scope.md` | shared rule | commit · coordinator · test/master-rules.test.js | BP3 |
| GOV-COORD-NO-LEDGER | `## Approved and ledger scope` / `Without a coordinator ledger` | `rules/commit-scope.md` | shared rule | plan · commit | BP3 |
| GOV-COORD-REPAIR | `## Coordinator mode` / `at most two dynamic repair` | `rules/governance.md` | shared rule | coordinator · run | BP3 |
| GOV-COORD-REPAIR-WRITE | `## Coordinator mode` / `one write unit` | `rules/governance.md` | docs/code | scripts/lib/coordinator.js | BP4 |
| GOV-COORD-PARTIAL-CLOSE | `## Coordinator mode` / `partial_closed` | `rules/governance.md` | shared rule | coordinator · run · finalize | BP3 |

## Load graph

| consumer | startup | step | failure |
| --- | --- | --- | --- |
| init | `rules/plugin-root.md` · `AGENTS.md` | `2 Result handling: skills/bouncer-init/references/init-result.md` · `rules/output.md` · `rules/acq.md` | 없음 |
| plan | `rules/plugin-root.md` · `AGENTS.md` | `1 Discover: references/discovery/index.md` · `3 Author: references/spec-authoring/index.md` · `rules/document-schema.md` · `rules/planning.md` · `references/stop-slop/index.md` · `skills/bouncer-plan/references/graphify-suggestions.md` · `references/graphify-runner/index.md` · `4 Scope confirm: skills/bouncer-plan/references/scope-confirm.md` · `rules/acq.md` · `references/minimality/index.md` · `5 Review: skills/bouncer-plan/references/context-review.md` · `references/context-review/index.md` · `6 Approval: rules/acq.md` · `7 Activate: rules/current-pointer.md` · `8 Gate: rules/output.md` | 없음 |
| run | `rules/plugin-root.md` · `AGENTS.md` | `1 Preflight: rules/current-pointer.md` · `2 Start ACQ: rules/acq.md` · `4 Coordinator dispatch: rules/subagent-model.md` · `rules/governance.md` · `5 Report: rules/output.md` | 없음 |
| execute | `rules/plugin-root.md` · `AGENTS.md` | `1 Preflight: rules/current-pointer.md` · `2 Prepare: rules/commit-scope.md` · `3 Implement: references/implementation/index.md` · `rules/governance.md` · `rules/subagent-model.md` · `skills/bouncer-execute/references/agent-dispatch.md` · `4 Verify/recover: references/verification/index.md` · `5 Review: references/review/index.md` · `skills/bouncer-execute/references/review-round.md` · `6 Gate: rules/output.md` | `4 Verify/recover 실패: skills/bouncer-execute/references/verification-recovery.md` · `references/debugging/index.md` |
| commit | `rules/plugin-root.md` · `AGENTS.md` | `1 Current: rules/commit-scope.md` · `5 Handoff: rules/cli.md` · `rules/output.md` · `rules/current-pointer.md` · `rules/acq.md` | 없음 |
| finalize | `rules/plugin-root.md` · `AGENTS.md` | `1 Explain + quiz: skills/bouncer-finalize/references/explain-quiz.md` · `references/explain-diff/index.md` · `2 Remainder: rules/commit-scope.md` · `skills/bouncer-finalize/references/remainder.md` · `rules/acq.md` · `3 PR: skills/bouncer-finalize/references/draft-pr.md` · `4 Cleanup: skills/bouncer-finalize/references/cleanup-handoff.md` · `5 Handoff: rules/current-pointer.md` · `rules/output.md` | 없음 |
| coordinator | `AGENTS.md` | `Worker dispatch: rules/subagent-model.md` · `references/implementation/index.md` · `3 Drive와 5 Judge의 scope revision: rules/governance.md` | 없음 |

run은 drive 진입 때 startup을 한 번 읽고, 같은 drive의 task 반복에서 `AGENTS.md`를 다시 열지 않는다. run 세션은 `references/implementation/index.md`를 열지 않으며, coordinator가 implementer dispatch 때 그 파일을 요구한다. plan step 3과 spec-authoring step 1이 여는 `rules/planning.md`는 계획 계약만 담는다. execute step 2, commit step 1, finalize step 2는 `rules/commit-scope.md`를 열고, run step 4와 coordinator의 scope revision은 `rules/governance.md`를 연다. governance는 실행 범위 판단을 `rules/commit-scope.md`로 가리키므로 그 두 소비자도 같은 정본에 도달한다. 단위별 판단 주체는 소유권 표가 가리키고, 그 목적 밖의 단위를 startup으로 올리지 않는다.

coordinator의 `rules/governance.md` 인용은 Hard guards의 scope revision 문장에 있다. 절차 1 Ground 앞에서 파일 전체를 `Read`하라는 명령은 없다. revision을 판단할 때 연다. repair 거절과 `partial_closed` 중지는 역할 문서의 Hard guards에 있고, 그 분기에서 `rules/governance.md`를 다시 열지 않는다.

## 참조 대조

아래는 `rg -n 'rules/(governance|planning|commit-scope)\.md' skills agents references test docs AGENTS.md rules`의 현재 일치이다(이 문서 자신은 제외). workflow 여섯과 coordinator는 load graph에 한 번씩 있다. 그 밖의 일치는 실행 중 적재 행이 아니라 소유권 소비자이거나 인덱스이거나, 이전한 단위를 새 정본으로 되돌려 가리키는 pointer 문장이다. 정규식 문자열로 경로를 쓰는 characterization(`rules\/commit-scope\.md`)은 이 rg에 걸리지 않으므로 표에도 넣지 않는다.

| site | consumer | phase |
| --- | --- | --- |
| `skills/bouncer-init/SKILL.md:53` | init | 없음. 번호 단계 뒤의 설치 제외 고지이며 `rules/governance.md`를 읽지 않는다 |
| `skills/bouncer-plan/SKILL.md:144` | plan | step 3 Author. `rules/planning.md` |
| `skills/bouncer-run/SKILL.md:103` | run | step 4 Coordinator dispatch. `rules/governance.md` |
| `skills/bouncer-execute/SKILL.md:101` | execute | step 2 Prepare. `rules/commit-scope.md` |
| `skills/bouncer-execute/SKILL.md:109` | execute | step 3 Implement의 light 분기. `rules/governance.md` |
| `skills/bouncer-commit/SKILL.md:34` | commit | step 1 Current. `rules/commit-scope.md` |
| `skills/bouncer-finalize/SKILL.md:49` | finalize | step 2 Remainder. `rules/commit-scope.md` |
| `agents/bouncer-coordinator.md:74` | coordinator | step. scope revision |
| `rules/commit-scope.md:4, 8` | 없음 | 없음. 새 정본이 run·coordinator의 pointer 경유와 coordinator mutation 절차를 `rules/governance.md`로 되돌려 가리킨다 |
| `rules/governance.md:6, 14, 42, 48` | 없음 | 없음. BP2로 이전한 sizing·light·DAG 단위를 `rules/planning.md`로 가리키는 pointer 문장이다 |
| `rules/governance.md:10, 51, 57, 90` | 없음 | 없음. TASKS-001로 이전한 단위를 `rules/commit-scope.md`로 가리키는 pointer 문장이다 |
| `rules/planning.md:4-5` | 없음 | 없음. 머리말이 실행 범위를 `rules/commit-scope.md`, mutation 절차를 `rules/governance.md`로 가리킨다 |
| `rules/planning.md:21, 63, 64, 82` | 없음 | 없음. 실패 상태 전이와 light 실행 분기를 `rules/governance.md`로 가리키는 pointer 문장이다 |
| `rules/planning.md:103-104` | 없음 | 없음. 승인 scope 이전분은 `rules/commit-scope.md`, 개정 절차는 `rules/governance.md`를 가리킨다 |
| `rules/plugin-root.md:37` | 없음 | 없음. 조건부 product rule의 예시 열거이며 적재가 아니다 |
| `references/spec-authoring/index.md:26` | plan | step 3. spec-authoring step 1이 제품 규칙 위치를 `rules/planning.md`로 가리킨다 |
| `references/spec-authoring/index.md:174` | plan | step 3. light task 분기에서 `rules/planning.md` `## Lightweight cycle`을 가리킨다 |
| `docs/workflow.md:133` | plan | 없음. 사용자 문서가 `rules/planning.md` `## Lightweight cycle`을 가리킨다. GOV-LIGHT-DOC-SET, GOV-LIGHT-G10, GOV-LIGHT-RETURN-FULL의 소비자이다 |
| `AGENTS.md:23` | 없음 | 없음. runtime index의 planning 링크이다. startup에서 이 링크를 따라 열지 않는다 |
| `AGENTS.md:24` | 없음 | 없음. runtime index의 commit-scope 링크이다. startup에서 이 링크를 따라 열지 않는다 |
| `AGENTS.md:25` | 없음 | 없음. runtime index의 governance 링크이다. startup에서 이 링크를 따라 열지 않는다 |
| `test/lightweight-cycle.test.js:15` | 없음 | 없음. GOV-LIGHT-* planning locator를 읽는 characterization이다 |
| `test/lightweight-cycle.test.js:30` | 없음 | 없음. GOV-LIGHT-INLINE-DISPATCH 등 governance 잔여 light 실행 계약 |
| `test/lightweight-cycle.test.js:52` | 없음 | 없음. GOV-LIGHT-DECLARATION, GOV-LIGHT-RETURN-FULL |
| `test/lightweight-cycle.test.js:93` | 없음 | 없음. GOV-LIGHT-DOC-SET, GOV-LIGHT-G10, GOV-LIGHT-SCALE-FLAG |
| `test/lightweight-cycle.test.js:133` | 없음 | 없음. GOV-LIGHT-INLINE-DISPATCH. `execution_mode`가 없음을 run, execute와 함께 본다 |
| `test/master-rules.test.js:681` | 없음 | 없음. GOV-DAG-FIELDS, GOV-DAG-WAVES, GOV-DAG-GATE, GOV-DAG-BASELINE (`rules/planning.md`) |
| `test/master-rules.test.js:729-730` | 없음 | 없음. GOV-COORD-TOPOLOGY, GOV-COORD-PATH-BOUNDARY, GOV-COORD-SCOPE-AUDIT, GOV-COORD-G17을 새 정본에서 거절 술어까지 붙여 보고, governance에 같은 서술이 남지 않았음을 함께 본다 |
| `test/master-rules.test.js:771` | 없음 | 없음. 소비자 편집 회귀. `rules/planning.md`의 새 owner pointer가 살아 있고 옛 governance pointer가 돌아오지 않았음을 본다 |
| `test/master-rules.test.js:795, 798, 800` | 없음 | 없음. GOV-COORD-PATH-BOUNDARY. ceiling 문장이 새 정본에 하나, governance에 0개임을 센다 |
| `test/workflow-safety-canon.test.js:144, 150, 157` | 없음 | 없음. GOV-COORD-COMMIT-WORKTREE. execute, commit, finalize의 cite를 요구하고 run은 governance cite와 governance의 pointer 문장으로 본다 |
| `test/workflow-safety-canon.test.js:171` | 없음 | 없음. GOV-LIGHT-INLINE-DISPATCH. execute, run의 cite를 요구한다 |
| `test/skill-bouncer-commit.test.js:86` | 없음 | 없음. commit 본문이 commit-scope와 `rules/cli.md`를 나눠 가리키는지 본다 |
| `test/skill-bouncer-plan.test.js:542` | 없음 | 없음. plan step 3이 `rules/planning.md`를 여는지 보는 characterization이다 |
| `test/skill-bouncer-run.test.js:68` | 없음 | 없음. run step 4가 coordinator 문서와 `rules/governance.md`를 함께 가리키는지 본다 |
| `test/skill-bouncer-surface.test.js:180-182` | 없음 | 없음. 여섯 workflow의 Master rules 블록에 product rule(commit-scope 포함)이 없음을 고정한다 |
| `test/skill-spec-authoring.test.js:199` | 없음 | 없음. spec-authoring이 제품 규칙과 light 예산을 `rules/planning.md`로 가리키는지 본다 |
| `test/init.test.js:404` | 없음 | 없음. 파일 전체에 폐기된 외부 profile 문구가 없음을 본다 |
| `test/distribution.test.js:74` | 없음 | 없음. 패키지 파일 목록에 `rules/governance.md`가 있는지를 본다. 제거는 BP4이다 |

`scripts/`는 위 rg 경로에 없다. `scripts/lib/templates.js`, `scripts/lib/scaffold.js`, `scripts/lib/validate-gates.js`, `scripts/lib/validate-structural.js`, `scripts/lib/scope.js`, `scripts/lib/coordinator.js`는 소유권 표의 consumers에만 있다.

## 보존된 결정

닫힌 Blueprint의 결정을 여기에 다시 구현하지 않는다. 해당 정본은 그대로 두고, 이 표는 그 정본을 가리킨다.

| decision | preserved contract | bind |
| --- | --- | --- |
| `043/006` | 조건부 상세는 그 조건의 번호 단계에서 연다. 게이트 판정, commit scope, 증적 기록은 skill 본문에 남긴다 | load graph의 startup은 `AGENTS.md`와 `rules/plugin-root.md`이다. `rules/commit-scope.md`·`rules/governance.md`·`rules/planning.md`와 실패 전용 reference는 startup에 없다 |
| `043/007` | `rules/plugin-root.md`, `rules/acq.md`, `rules/current-pointer.md`, `rules/subagent-model.md`가 각 운영 블록의 정본이다. trust boundary는 `AGENTS.md` hard rule 1이다 | 이 표는 그 블록을 새 governance 단위로 다시 뽑지 않는다. GOV-COORD-AUTHORITY의 pointer 이동은 `rules/current-pointer.md`에 남기고, BP3는 그 문장을 새 rule로 복제하지 않는다 |
| `061/002` | 새 workflow 세션은 번호 단계 전에 master rule을 읽고, `/bouncer-run`의 같은 drive에서는 불변 규칙을 반복해서 다시 읽지 않는다 | run startup은 drive당 한 번이다. light 계획 계약은 `rules/planning.md`로, coordinator 본문은 `rules/governance.md`로 나뉘며 GOV-LIGHT-*와 GOV-COORD-*의 migration BP가 그 경계를 가리킨다 |
| `069/001` | 안전 경계 4의 정본은 `rules/governance.md` `## Coordinator mode`이고 소비자는 execute, commit, finalize, run이다. 안전 경계 6의 실행 정본은 `## Lightweight cycle`의 BP3 구절이고 소비자는 execute, run이다. 계획 light 계약은 `rules/planning.md`이다. init의 Master rules 블록은 두 파일을 startup으로 열지 않는다. 진입 스킬의 번호 단계 수는 init 4, plan 8, execute 6, commit 5, run 5, finalize 5이다 | GOV-COORD-TOPOLOGY, GOV-COORD-COMMIT-WORKTREE, GOV-LIGHT-INLINE-DISPATCH가 그 행의 현재 locator이다. 안전 경계 4의 정본은 TASKS-001에서 `rules/commit-scope.md`로 옮겼고 execute·commit·finalize가 그 경로를 직접 읽는다. run은 step 4에서 `rules/governance.md`를 읽고 그 pointer 문장을 따라 같은 정본에 도달하므로 소비자 집합은 그대로다. init load graph의 startup과 step에는 두 파일이 모두 없다 |

## Locator 줄 범위

줄 번호는 current owner 파일 바이트에서의 힌트이다. 식별자는 `source`의 heading과 구절이다. 접두어 `planning`은 `rules/planning.md`, `commit-scope`는 `rules/commit-scope.md`, `governance`는 `rules/governance.md`를 가리킨다.

| unit | lines |
| --- | --- |
| GOV-SIZING-ONE-COMMIT | planning 10-14 |
| GOV-SIZING-VERIFY-SHAPE | planning 16-21 |
| GOV-SIZING-VERIFY-RUN | governance 5-7 |
| GOV-SIZING-PATH-WARNING | planning 23-27 |
| GOV-SIZING-COMMIT-UNIT | commit-scope 13-18 |
| GOV-SIZING-STAGE-TASK | commit-scope 20-23 |
| GOV-SIZING-STAGE-FINALIZE | commit-scope 22-23 |
| GOV-SIZING-EXPLAIN-STAMP | commit-scope 23-29 |
| GOV-LIGHT-DECLARATION | planning 31-36 |
| GOV-LIGHT-SCALE-FLAG | planning 38-41 |
| GOV-LIGHT-SHRINK-CLOSED | planning 43 |
| GOV-LIGHT-DOC-SET | planning 45-49 |
| GOV-LIGHT-G10 | planning 50-57 |
| GOV-LIGHT-MAINTENANCE-EPIC | planning 58-61 |
| GOV-LIGHT-INLINE-DISPATCH | governance 17-24 |
| GOV-LIGHT-QUIZ | governance 25-27 |
| GOV-LIGHT-UNCHANGED-DOCS | planning 69-70 |
| GOV-LIGHT-UNCHANGED-GATES | planning 71-75 |
| GOV-LIGHT-CANONICAL-CONTEXT | governance 31 |
| GOV-LIGHT-SCALE-READ-SITES | governance 33-37 |
| GOV-LIGHT-INLINE-LIMIT | governance 39-41 |
| GOV-LIGHT-RETURN-FULL | planning 77-79 |
| GOV-DAG-FIELDS | planning 87-90, 92-94 |
| GOV-DAG-WAVES | planning 89-91 |
| GOV-DAG-GATE | planning 96-98 |
| GOV-DAG-BASELINE | planning 98-100 |
| GOV-DAG-SCOPE-ESTIMATE | commit-scope 33-34 |
| GOV-COORD-TOPOLOGY | commit-scope 35-40 |
| GOV-COORD-REVISION | governance 60-64 |
| GOV-COORD-LOCK | governance 64-77 |
| GOV-COORD-PATH-BOUNDARY | commit-scope 41-46 |
| GOV-COORD-SCOPE-AUDIT | commit-scope 47-51 |
| GOV-COORD-COMMIT-WORKTREE | commit-scope 58-60 |
| GOV-COORD-AUTHORITY | governance 78-79 |
| GOV-COORD-CRITICAL-RECOVERY | governance 80-87 |
| GOV-COORD-G17 | commit-scope 62-67 |
| GOV-COORD-NO-LEDGER | commit-scope 53-54 |
| GOV-COORD-REPAIR | governance 93-97 |
| GOV-COORD-REPAIR-WRITE | governance 97 |
| GOV-COORD-PARTIAL-CLOSE | governance 99-104 |
