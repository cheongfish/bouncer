---
type: bouncer.explain
title: drive-plan-quality explain
description: Explain for drive-plan-quality
resource: .bouncer/context/epics/plan-workflow/blueprints/drive-plan-quality/explain.md
tags:
  - bouncer
  - explain
timestamp: '2026-10-23T14:05:08.840+09:00'
bouncer:
  id: EXPLAIN-drive-plan-quality
  epic_id: plan-workflow
  blueprint_id: drive-plan-quality
  status: published
  comprehension:
    - range_from: 871e2d9c79eeb1472b247440a839ab43e0a0c48c
      range_to: a00e7f629fce9e77a091d7bd19f9680bb998c82f
      diff_sha: 868b9de042ee1a03a14f5c1dccac525353a5bbbd1fef8c75ec08dd72787aee02
      recorded_at: '2026-10-23T14:06:32.017+09:00'
  task_commits:
    - task: plan-workflow/drive-plan-quality/001
      sha: de2a35f5
      intent_anchor: task-001
    - task: plan-workflow/drive-plan-quality/002
      sha: ff175164
      intent_anchor: task-002
    - task: plan-workflow/drive-plan-quality/003
      sha: 183d49c1
      intent_anchor: task-003
    - task: plan-workflow/drive-plan-quality/004
      sha: b6d12064
      intent_anchor: task-004
    - task: plan-workflow/drive-plan-quality/006
      sha: a00e7f62
      intent_anchor: task-006
---
# Explain

## Background

계획 문서는 "다른 blueprint가 먼저 병합돼 있어야 한다"는 전제를 글로만 적을 수 있었다. 전제가 빠진 채 승인된 계획을 drive에서 돌리면 필요한 코드가 없는 checkout에서 실패하고, 사람이 수작업으로 원인을 찾아야 했다. 경량 계획 산출물 설명이 현행 계약과 어긋난 곳, 계획 작성자가 소비자를 조사하지 않아 영향 범위를 놓치던 곳, 리뷰어가 기존 단언 변경 범위를 판정하지 않던 곳도 같은 실패를 반복시켰다.

이 변경은 선행 병합 전제를 blueprint가 기계가 읽는 형식으로 선언하게 하고, 승인과 plan gate가 현재 checkout 기준으로 판정하게 한다. 문서와 리뷰어 지시는 현행 계약에 맞췄다.

## Code

- `rules/document-schema.md`, `scripts/src/lib/schema.ts`, `scripts/src/lib/validate-structural.ts`: blueprint `bouncer.prerequisites`는 선택 배열이다. 항목은 `{blueprint, merged_commit}` 두 키만 허용한다. `blueprint`는 저장소 상대 정규 경로이고 `merged_commit`은 40자 소문자 SHA다. squash나 rebase 병합이면 원래 worker SHA가 아니라 병합 결과 커밋을 적는다. 형식 위반은 S39이며 항목마다 메시지로 구분한다. 추가 키, 자기참조, 중복도 S39다. 선언이 없거나 `[]`이면 기존 계획은 그대로다.
- `scripts/src/lib/plan-prerequisites.ts`: 읽기 전용 helper다. 참조한 blueprint가 있는지, 순환이 있는지, `git merge-base --is-ancestor <merged_commit> HEAD`가 성립하는지 본다. 결과는 `merged | unmerged | object-missing | lookup-error`다. object 존재는 `git rev-parse --verify --quiet <sha>^{commit}`로 확인하고, exit 1은 없음, 그 외는 조회 오류로 본다. 조회 오류는 통과로 접지 않는다. 순환 탐색에서 참조 문서의 frontmatter 파싱 실패는 간선 없음으로 흡수한다. 그 문서의 구조 검사가 따로 보고한다.
- `scripts/src/lib/validate-gates-plan.ts`, `validate.ts`, `composite-gates.ts`: `planPrerequisiteFailures`가 준비되지 않은 선행마다 G32 한 건을 낸다. draft 검사, 정식 plan gate, `approvePlan`이 같은 함수를 부른다. 선언이 없으면 Git을 부르지 않는다. G32는 복합 gate `freshness-approval`에 등록돼 있다.
- `scripts/src/lib/plan-approve.ts`: context-review 통과를 확인한 뒤 쓰기 전에 선행을 판정한다. 준비되지 않았으면 `plan-approve-prerequisite`로 거절하고 파일은 바뀌지 않는다. `cause`에 `G32 <message>` 줄이 나온다. 형식 위반(S39)은 이 경로에서 거절하지 않는다. 이 점은 최종 리뷰에서 미해결 결함(F1)으로 남았다.
- `rules/planning.md`, `docs/workflow.md`, `skills/bouncer-plan/SKILL.md`, `references/spec-authoring/index.md`: 경량 계획 산출물 설명을 현행 계약에 맞췄다. 소비자 조사 의무를 기존 shape 소비 fixture 절 옆에 확장했다.
- `agents/bouncer-context-reviewer.md`와 생성본 `.codex/agents/bouncer-context-reviewer.toml`: 관점별 판정 기준을 보강했다. 소비 fixture 누락은 verifiability로, 문서 조사 누락은 consistency로 판정한다. consistency 관점에 Constraints의 기존 단언 변경 범위 판정은 아직 없다(F2).
- 알려진 약점: `rules/document-schema.md`에 "승인·gate에 아직 연결되지 않음" 문구가 남아 `rules/cli.md`와 어긋난다(F3).

## Quiz

1. 선행 blueprint의 `merged_commit`이 현재 checkout HEAD의 조상이 아닌 채 `plan approve`를 실행하면 어떻게 되는가?
   - A) 경고만 출력하고 승인한다.
   - B) `plan-approve-prerequisite`로 거절하고 파일은 바뀌지 않는다.
   - C) 선행 blueprint를 자동으로 병합한 뒤 승인한다.
2. squash merge로 병합된 선행 blueprint의 `merged_commit`에는 무엇을 적는가?
   - A) 원래 worker 브랜치의 마지막 SHA
   - B) `HEAD` 같은 참조 이름
   - C) 병합 결과로 생긴 40자 소문자 SHA
3. Git 조회 자체가 실패해 병합 여부를 알 수 없으면(`lookup-error`) 어떻게 처리하는가?
   - A) 통과로 접지 않고 G32 실패로 보고한다.
   - B) 병합된 것으로 보고 통과시킨다.
   - C) 해당 항목만 건너뛰고 나머지로 판정한다.
4. `bouncer.prerequisites`가 없는 기존 blueprint는 어떻게 되는가?
   - A) 빈 배열 `[]`을 추가하라는 S39가 난다.
   - B) 영향이 없고 Git 조회도 하지 않는다.
   - C) 모든 선행이 없다는 G32 실패가 난다.

## Tasks

### plan-workflow/drive-plan-quality/001 · `de2a35f5`

#### Goal & intent

- R-M2를 경량 계획 산출물 설명의 현행 계약 반영로 처리한다. 성공 판정은 아래 Target behavior와 epic 성공 기준 7이다.
- 전용 검증: `node scripts/check-doc-shape.js rules/planning.md skills/bouncer-plan/SKILL.md references/spec-authoring/index.md`. 사용자 확인을 받은 명령이며 frontmatter에 설정한다.

#### Current behavior

- 조사 HEAD: `6c20e0babef5c50e17d3617a3919367bc493c898`.
- scaffold.ts:527,540과 test/scaffold.test.js:663은 신규 light에 표식과 context-review를 포함한 5문서를 만든다.
- rules/planning.md:69,93·docs/workflow.md:146·skills/bouncer-plan/SKILL.md:138·references/spec-authoring/index.md:216,228에는 4문서·review 생략 설명이 남아 있다.
- 문서만 변경하므로 runtime I/O 결합은 해당 없음이다. workflow step·ACQ 형태는 scripts/check-doc-shape.js:856이 검사한다.

#### Target behavior

- 성공: 신규 표식 light와 기존 무표식 light를 분리하여 문서 수·예산·리뷰·종단 task를 일관되게 설명한다.
- 실패/보존: 신규 light의 context review를 생략하도록 안내하지 않는다. 기존 무표식 light는 현행 skip과 기존 산출물 계약을 유지한다.

#### Interface

- 산출물 계약은 초기 5문서, context-review 제외 100줄, 종단 검증 추가 2문서다.
- plan skill의 light review 분기는 실제 marker별 라우팅을 따른다. full의 perspectives와 legacy single을 혼동하지 않는다.

#### Touch

| 경로 | 심볼 | 변경 | 현재 책임 | 계획한 변경 | 근거 |
| --- | --- | --- | --- | --- | --- |
| `rules/planning.md` | `문서 계약` | Modify | 워크플로와 계약 설명 | Lightweight cycle의 산출물·리뷰·예산 설명 정정 | rules/planning.md:69,93 |
| `docs/workflow.md` | `문서 계약` | Modify | 워크플로와 계약 설명 | light 생성·검증 흐름 정정 | docs/workflow.md:146 |
| `skills/bouncer-plan/SKILL.md` | `문서 계약` | Modify | 워크플로와 계약 설명 | light scaffold 및 marker별 리뷰 분기 정정 | skills/bouncer-plan/SKILL.md:138 |
| `references/spec-authoring/index.md` | `문서 계약` | Modify | 워크플로와 계약 설명 | light 작성 범위·예산·리뷰 설명 정정 | references/spec-authoring/index.md:216,228 |

#### Constraints

- scaffold.ts와 승인 runtime은 수정하지 않는다. 문구를 고정하는 regex 테스트는 추가하지 않는다.
- 전수 검색 범위는 rules/·docs/·skills/·references/·agents/이며 과거 .bouncer/context의 승인 이력은 재작성하지 않는다.
- epic 성공 기준 7 및 11을 따른다. 한국어 주석·docstring과 condition → result 테스트 이름을 사용한다.
- 새 의존성·추상화·기능을 추가하지 않는다. 실패한 검증을 통과로 기록하거나 상태·증적을 수기로 채우지 않는다.

### plan-workflow/drive-plan-quality/002 · `ff175164`

#### Goal & intent

- R-P1·R-P2·R-P3·R-P4를 계획 소비자 조사와 리뷰 판정 기준 명시로 처리한다. 성공 판정은 아래 Target behavior와 epic 성공 기준 8이다.
- 전용 검증: `node --test test/agents.test.js test/skill-bouncer-plan.test.js test/skill-spec-authoring.test.js`. 사용자 확인을 받은 명령이며 frontmatter에 설정한다.

#### Current behavior

- 조사 HEAD: `6c20e0babef5c50e17d3617a3919367bc493c898`.
- references/spec-authoring/index.md:162는 shape/gate 소비 fixture를 Touch에 포함하도록 이미 요구하지만 설명 문서 조사와 기존 단언 변경 범위가 연결되지 않는다.
- agents/bouncer-context-reviewer.md:167,181은 consistency/verifiability 책임을 나누지만 소비 fixture 누락과 expected red 도달성을 명시하지 않는다.
- 생성 결합: scripts/src/lib/codex-agents.ts:41의 mdToCodexToml과 test/agents.test.js:71이 Markdown/TOML 바이트 동등성을 검사한다.

#### Target behavior

- authoring은 계약을 구성·단언하는 테스트와 같은 동작 설명을 rg로 전수 조사하여 Touch에 file:line 근거를 남긴다.
- Constraints는 바꿔도 되는 기존 단언을 파일·테스트 이름·새 기대값 단위로 한정한다. 기존 red 실행 기록과 구현 시 실행할 expected red를 구분한다.
- verifiability는 소비 테스트 누락 및 도달 불가능한 red를 finding으로 내고, consistency는 설명 문서 조사 근거와 문서 간 계약 일치를 판정한다.

#### Interface

- 리뷰 기준: scaffold 출력 변경+소비 fixture 누락은 verifiability, 동작 설명 변경+관련 문서 조사 누락은 consistency다. 같은 누락을 여러 관점에서 중복 finding으로 만들지 않는다.
- expected red는 재현 명령·입력·도달하는 첫 실패 지점·원하는 assertion을 명시한다. structural 실패가 먼저면 그 상태를 근거로 목표 assertion의 실패를 주장하지 않는다.
- 리뷰 역할 정의의 heading·출력 계약은 유지하고 해당 관점 절에 판정 항목만 추가한다.

#### Touch

| 경로 | 심볼 | 변경 | 현재 책임 | 계획한 변경 | 근거 |
| --- | --- | --- | --- | --- | --- |
| `skills/bouncer-plan/SKILL.md` | `문서 계약` | Modify | 워크플로와 계약 설명 | 발견 단계의 소비 테스트·설명 문서 조사 의무 | skills/bouncer-plan/SKILL.md:49 |
| `references/spec-authoring/index.md` | `문서 계약` | Modify | 워크플로와 계약 설명 | Touch 근거·baseline/red 구별·기존 단언 변경 범위 | references/spec-authoring/index.md:121,162,194 |
| `agents/bouncer-context-reviewer.md` | `문서 계약` | Modify | 워크플로와 계약 설명 | consistency·verifiability 판정 보강 | agents/bouncer-context-reviewer.md:167,181 |
| `.codex/agents/bouncer-context-reviewer.toml` | `mdToCodexToml 생성본` | Modify | named reviewer 계약 | 역할 원문의 생성본 갱신 | test/agents.test.js:71 |

#### Constraints

- 기존 shape 소비 fixture 의무를 새로 중복 정의하지 않고 같은 절을 확장한다.
- 문구 포함 여부만 검사하는 새 테스트는 만들지 않는다. 역할 시나리오로 판정 가능성을 검토하고 생성본은 parity로 확인한다.
- 이미 승인된 브리프를 retroactive로 거절하지 않는다. 새 계획과 이후 수정분에 적용한다.
- epic 성공 기준 8 및 11을 따른다. 한국어 주석·docstring과 condition → result 테스트 이름을 사용한다.
- 새 의존성·추상화·기능을 추가하지 않는다. 실패한 검증을 통과로 기록하거나 상태·증적을 수기로 채우지 않는다.
- 역할 Markdown을 정본으로 사용하며 ensureCodexAgents를 현재 cwd의 agentsDir로 호출해 해당 TOML을 갱신한다. 다른 역할 생성본은 변경하지 않는다.

### plan-workflow/drive-plan-quality/003 · `183d49c1`

#### Goal & intent

- R-P5를 선행 계획 병합 근거의 선언 형식 추가로 처리한다. 성공 판정은 아래 Target behavior와 epic 성공 기준 9이다.
- 전용 검증: `node --test test/schema.test.js test/validate-structural.test.js test/plan-prerequisites.test.js`. 사용자 확인을 받은 명령이며 frontmatter에 설정한다.

#### Current behavior

- 조사 HEAD: `6c20e0babef5c50e17d3617a3919367bc493c898`.
- 현재 depends_on은 같은 blueprint 내 task DAG다(schema.ts:195). blueprint 간 선행 병합 필드는 없다.
- closed는 finalize.ts:167,177의 문서 잠금이며 병합을 의미하지 않는다. task-commits.ts:87의 trailer resolver도 선행 전체 병합을 보증하지 않는다.
- 현재 G25는 제거된 코드다. test/validate-gates.test.js:3170의 문자열은 제거된 gate 회귀 fixture이며 새 기능 근거로 사용할 수 없다.

#### Target behavior

- 선행 blueprint와 실제 병합 결과 SHA를 선언하는 optional prerequisites를 도입한다. 선언이 없는 기존 계획은 기존대로다.
- 경로·SHA 형식·중복·자기참조·참조 누락·순환을 분리하여 검증하고, 병합 결과 SHA의 현재 HEAD ancestry를 판정할 helper를 제공한다.
- squash/rebase는 원래 worker SHA가 아닌 병합 결과 commit을 지정한다. 이 task에서는 승인·gate에 연결하지 않고 다음 task가 소비한다.

#### Interface

- bouncer.prerequisites: Array<{blueprint:string,merged_commit:string}>. blueprint는 저장소 상대 canonical blueprint 디렉터리, merged_commit은 40자리 소문자 SHA다. 부재/[]는 선행 없음이다.
- 신규 helper 입력 {repoRoot,blueprintDir,exec?}; exec(args:string[]) → {status:number,stdout:string}. 기본은 git spawnSync이며 셸을 사용하지 않는다.
- 형식 오류는 S39 후보로 반환한다. 존재·순환·SHA object 확인·git merge-base --is-ancestor <merged_commit> HEAD 결과는 판정 데이터로 반환하며 파일을 쓰지 않는다.
- 비조상 exit 1은 미병합, 그 외 Git 실패는 조회 오류다. 둘 다 통과로 접지 않는다. declared SHA와 blueprint 경로가 해당 선행 병합의 근거임은 브리프가 설명한다.

#### Touch

| 경로 | 심볼 | 변경 | 현재 책임 | 계획한 변경 | 근거 |
| --- | --- | --- | --- | --- | --- |
| `scripts/src/lib/schema.ts` | `신규 추출 지점: prerequisites 형식` | Modify | 문서 필드 정의 | optional 선행 계약 정의 | scripts/src/lib/schema.ts:195 |
| `scripts/src/lib/validate-structural.ts` | `신규 추출 지점: 선행 선언 구조 검사` | Modify | 문서 구조 검사 | S39 형식 검사 연결 | scripts/src/lib/validate-structural.ts |
| `scripts/src/lib/plan-prerequisites.ts` | `신규 추출 지점: 선행 참조·병합 검사` | Create | 신규 읽기 전용 판정 | 참조·cycle·ancestry 판정 | R-P5에서 명시한 신규 helper |
| `rules/document-schema.md` | `문서 계약` | Modify | 워크플로와 계약 설명 | prerequisites shape·부재 정책·병합 SHA 의미 | rules/document-schema.md:58 |
| `test/schema.test.js` | `관찰 가능한 반환·상태 단언` | Modify | 회귀 검증 | 선행 선언 허용/거절 shape 검사 | test/schema.test.js |
| `test/validate-structural.test.js` | `관찰 가능한 반환·상태 단언` | Modify | 회귀 검증 | S39 경로·SHA·중복 형식 시나리오 | test/validate-structural.test.js |
| `test/plan-prerequisites.test.js` | `선행 검사 시나리오` | Create | 신규 helper 검증 | Git seam과 참조·cycle·조상 판정 | R-P5 신규 helper의 관찰 가능한 판정 |
| `test/tiers.json` | `unit 목록` | Modify | 테스트 tier 등록 | 신규 helper 테스트 등록 | test/tiers.json:1 |

#### Constraints

- 기존 필드 의미와 task DAG는 그대로 둔다. 명시하지 않은 선행 관계를 문서 본문이나 파일명에서 추측하지 않는다.
- ancestry의 기준은 현재 checkout HEAD이며 pointer 선택 전에 실행 가능해야 한다. 저장된 base·원격 접근은 필요 없다.
- 부정확한 SHA의 다른 blueprint 귀속을 자동 추론하지 않는다. 사용자 지정 근거와 참조 설명을 리뷰하고 ancestry만 기계 판정한다.
- epic 성공 기준 9 및 11을 따른다. 한국어 주석·docstring과 condition → result 테스트 이름을 사용한다.
- 새 의존성·추상화·기능을 추가하지 않는다. 실패한 검증을 통과로 기록하거나 상태·증적을 수기로 채우지 않는다.
- TypeScript 변경 뒤 npm run build로 로컬 emit을 갱신하고 npm run check:emit로 확인한다. scripts/lib와 build stamp는 ignored 생성물이므로 수정·stage·커밋 범위에 넣지 않는다.

### plan-workflow/drive-plan-quality/004 · `b6d12064`

#### Goal & intent

- R-P5를 승인과 계획 게이트에 선행 병합 판정 연결로 처리한다. 성공 판정은 아래 Target behavior와 epic 성공 기준 10이다.
- 전용 검증: `node --test test/validate-gates.test.js test/plan-approve.test.js test/composite-gates.test.js`. 사용자 확인을 받은 명령이며 frontmatter에 설정한다.

#### Current behavior

- 조사 HEAD: `6c20e0babef5c50e17d3617a3919367bc493c898`.
- checkPlanGate는 validate-gates.ts:91에서 호출된다. checkPlanDraft는 validate.ts:446에서 호출되며 현재 G5/G19/G20만 공유한다.
- approvePlan은 plan-approve.ts:196 이후 상태를 쓰므로 선행 거절을 모든 쓰기보다 앞에 둬야 한다.
- TASKS-003이 optional 선행 선언과 판정 helper를 제공한다. 이 task는 그 결과를 draft·정식 plan gate·approvePlan에 연결한다.

#### Target behavior

- 선행 선언의 참조 오류·미병합·Git 조회 오류는 G32로 거절한다. 결과에 선행 경로·원인·복구 next를 담는다.
- draft·정식 gate·approvePlan이 같은 helper를 쓰고, 승인 거절 시 모든 문서 bytes가 그대로다.
- G32를 freshness-approval 복합 gate에 연결한다. 선언이 없는 기존 fixture와 current --set 경로는 기존처럼 동작한다.

#### Interface

- G32: declared prerequisite is not ready; file은 해당 blueprint index, next는 누락 참조/병합 결과 SHA를 수정하거나 선행 병합을 현재 checkout에 반영한 뒤 재검사하는 명령이다.
- checkPlanDraft의 context에 repoRoot·blueprintDir·Git seam을 전달한다. 새로운 pointer나 승인 상태를 요구하지 않는다.
- approvePlan은 쓰기 전에 공통 검사를 호출한다. 실패 payload/exit 1은 기존 gate 실패 전달 계약을 따른다.

#### Touch

| 경로 | 심볼 | 변경 | 현재 책임 | 계획한 변경 | 근거 |
| --- | --- | --- | --- | --- | --- |
| `scripts/src/lib/validate-gates-plan.ts` | `checkPlanGate; checkPlanDraft` | Modify | plan 판정 | 공통 선행 검사 G32 연결 | scripts/src/lib/validate-gates-plan.ts:422,611 |
| `scripts/src/lib/validate.ts` | `plan draft 호출 지점` | Modify | 검증 orchestration | repoRoot·blueprintDir·deps 전달 | scripts/src/lib/validate.ts:446 |
| `scripts/src/lib/plan-approve.ts` | `approvePlan` | Modify | 승인 상태 전이 | 쓰기 전 선행 판정 | scripts/src/lib/plan-approve.ts:196,212 |
| `scripts/src/lib/composite-gates.ts` | `COMPOSITE_GATES` | Modify | 복합 gate 매핑 | G32 freshness-approval 등록 | scripts/src/lib/composite-gates.ts:70 |
| `test/validate-gates.test.js` | `관찰 가능한 반환·상태 단언` | Modify | 회귀 검증 | draft·plan 동일 선행 거절 및 기존 부재 정책 | test/validate-gates.test.js |
| `test/plan-approve.test.js` | `관찰 가능한 반환·상태 단언` | Modify | 회귀 검증 | 미병합 승인 거절·전체 bytes 불변 | test/plan-approve.test.js:98 |
| `test/composite-gates.test.js` | `관찰 가능한 반환·상태 단언` | Modify | 회귀 검증 | G32 매핑과 소비 failure 형식 | test/composite-gates.test.js |
| `rules/cli.md` | `문서 계약` | Modify | 워크플로와 계약 설명 | 선행 병합 gate 및 복구 절차 | rules/cli.md |
| `skills/bouncer-plan/SKILL.md` | `문서 계약` | Modify | 워크플로와 계약 설명 | 선행 선언 조사·병합 근거 기록 절차 | skills/bouncer-plan/SKILL.md:49 |
| `CHANGELOG.md` | `문서 계약` | Modify | 워크플로와 계약 설명 | 계획 품질·light 설명·선행 gate Unreleased 기록 | 프로젝트 기여 규칙: Unreleased |

#### Constraints

- 기존 G25를 되살리거나 제거된 gate fixture를 새 기능 단언으로 바꾸지 않는다.
- 기존 테스트 변경 허용 범위는 composite gate 코드 목록/개수의 G32 추가다. 선행 없는 승인 성공 fixture와 기존 실패 우선순위를 약화하지 않는다.
- epic 성공 기준 10 및 11을 따른다. 한국어 주석·docstring과 condition → result 테스트 이름을 사용한다.
- 새 의존성·추상화·기능을 추가하지 않는다. 실패한 검증을 통과로 기록하거나 상태·증적을 수기로 채우지 않는다.
- TypeScript 변경 뒤 npm run build로 로컬 emit을 갱신하고 npm run check:emit로 확인한다. scripts/lib와 build stamp는 ignored 생성물이므로 수정·stage·커밋 범위에 넣지 않는다.

### plan-workflow/drive-plan-quality/005

#### Goal & intent

모든 구현 task가 integrated인 integration checkout에서 전체 CI를 실행하여 계획 영향 범위와 선행 병합 검증 강화의 종단 호환성을 확인한다.

#### Current behavior

선행 구현 task는 각각 전용 검증을 수행한다. 이 task가 정상 경로에서 첫 전체 CI를 담당한다.

#### Target behavior

- 성공: 실제 실행 증적을 verification runner가 기록한 뒤에만 integrated가 된다.
- 실패: verifying 상태와 원본 증적을 유지하며 coordinator가 원인을 분류한다.

#### Interface

- 제공: 선행 구현이 모두 통합된 뒤 전체 검증을 한 번 실행하여 남기는 증적.
- 거부: source 변경, review 문서 작성, task commit, 실패 증적의 수작업 수정.

#### Touch

Source 변경 경로 없음.

#### Constraints

- 검증 명령은 frontmatter verify 한 곳에서 소유한다. 전체 CI를 구현 task에 복사하지 않는다.
- 환경 오류와 scope 안팎의 코드 오류를 구별한다. 이 task에서 직접 repair하지 않는다.

### plan-workflow/drive-plan-quality/006 · `a00e7f62`

#### Goal & intent

기록된 terminal CI 실패를 복구한다.

#### Interface

- 제공: 실패 command와 관련 경로를 통과시키는 최소 수정
- 거부: Blueprint 밖 scope와 새 기능

#### Touch

- Modify `test/validate-hints.test.js` — 기록된 CI 실패를 복구한다.

#### Constraints

- 원장의 실패 증적과 repair 결정 범위만 따른다.
