---
type: bouncer.explain
title: 002 explain
description: Explain for 002
resource: .bouncer/context/epics/096-plan-review-convergence/blueprints/002-delta-certification/explain.md
tags:
  - bouncer
  - explain
timestamp: '2026-10-12T23:27:04.530+09:00'
bouncer:
  id: EXPLAIN-002
  epic_id: '096'
  blueprint_id: '002'
  status: published
  comprehension:
    - range_from: df43e99e54fe1194f852cc28cf1a209edd844279
      range_to: cc56d9369938858c2978e8e99735a01cf714d287
      diff_sha: 96181182aca34b56b1b77f9feee51b38f42f9cc903599e828cc2e2aa258bfcd3
      recorded_at: '2026-10-12T23:27:43+09:00'
  task_commits:
    - task: EPIC-096/BP-002/TASK-001
      sha: 2799d334
      intent_anchor: task-001
    - task: EPIC-096/BP-002/TASK-002
      sha: f8752a15
      intent_anchor: task-002
    - task: EPIC-096/BP-002/TASK-003
      sha: cc56d936
      intent_anchor: task-003
---
# Explain

## Background

계획 리뷰는 승인된 구조를 그대로 두고 문서 내용만 보완해도 매번 처음부터 다시 발견(discovery) 리뷰를 돌렸다.
그래서 리뷰어는 무엇이 바뀌었는지 모른 채 전체를 다시 읽었고, 반복 횟수와 비용이 불어났다.
이번 변경은 구조가 유지되는 보완을 실제 변경분(diff)과 관련 계약에 대한 delta 인증으로 처리한다.
범위가 바뀌거나 delta 뒤 대상이 다시 stale이 되면 누적 재시작 한도 안에서만 전이하고, 기존 리뷰 기록은 보존한다.

## Intuition

교정쇄를 받은 편집자가 책 전체를 다시 읽는 대신, 수정 표시된 줄과 그 줄이 기대는 규칙만 확인하는 것과 같다.
수정이 목차(구조)를 건드렸을 때만 처음부터 다시 읽고, 그것도 한 번뿐이다.

## Code

- `scripts/src/lib/plan-snapshot.ts` — 계획 snapshot v2. 문서별 본문·구조 digest와 구조화된 내용(`documents_content`)을 만든다.
- `scripts/src/lib/review-dispatch.ts` — `follow_up`(full|partial)을 구조 digest로만 판정하고 `revision_diff`·`related_documents`를 채운다. 이전 payload 형식·내용 검증 포함.
- `scripts/src/lib/context-review-state.ts` — delta 뒤 stale 라우팅(`reuse|delta|restart|user`)과 restart 한도.
- `scripts/src/lib/cli-context-review-command.ts` — 읽기 전용 `context-review route` 동사.
- `agents/bouncer-context-reviewer.md`, `skills/bouncer-plan/references/context-review.md`, `rules/cli.md` — delta 입력 allowlist와 라우팅 설명.

## Quiz

1. `follow_up: partial`일 때 delta 리뷰어가 받는 입력은?
   - A) 새 digest와 이전 finding뿐이다.
   - B) 이전 finding, 변경 문서 목록, 실제 `revision_diff`(before/after), 관련 계약 본문(`related_documents`)이다.
   - C) 전체 대화 이력과 계획 문서 전부다.
2. delta를 이미 쓴 뒤 대상이 다시 stale이 됐고 `must_fix` finding이 아직 열려 있다. 라우팅 결과는?
   - A) `restart`로 처음부터 다시 발견 리뷰를 연다.
   - B) 이전 결과를 `reuse`한다.
   - C) `user`로 멈추고 사용자에게 보고한다.
3. 승인된 구조는 그대로이고 `tasks.md`의 scope 본문만 바뀌었다. `follow_up`은?
   - A) `partial`
   - B) `full`
   - C) `skip`
4. 이전 형식(legacy) digest만 남아 있는 기존 리뷰 증거가 있다. 첫 후속 분류는?
   - A) `partial`, 기존 증거를 delta 근거로 쓴다.
   - B) 분류를 거부하고 `previous-payload-stale`을 낸다.
   - C) `full`, 기존 증거는 delta 근거가 아니다.

## Tasks

### EPIC-096/BP-002/TASK-001 · `2799d334`

#### Goal & intent

문서 경계·본문·판단 구조를 포함하는 v2 snapshot과 실제 before/after를 만들고 구조가 같은 문서 보완을 partial로 분류한다. 수용 기준은 epic 5~7·11이며 BP 001이 실행 base에 통합되어야 한다.

#### Current behavior

- `plan-snapshot.ts:30`은 epic·blueprint·모든 task를 열거하고 `:62`는 경로와 경계 없이 본문만 hash한다. `:118` scope에는 affected_paths/depends_on/Interface/Touch만 있고 parallel_safe·execution_kind 등이 없다.
- `review-dispatch.ts:130,140,149`는 문서 집합·index body·scope hash 중 하나라도 바뀌면 full이며 changed_documents를 비운다. `:581,623`은 Interface/Touch로 cluster를 만든다.
- I/O: `cli-review-dispatch-command.ts:278`은 working tree의 prior payload JSON을 읽는다. 이전 본문을 git에서 얻는 경로는 없다. `validate-gates.ts:1321`의 G18은 computePlanSnapshot을 호출한다. snapshot은 validate/review-dispatch를 import할 수 없는 의존 아래층이다.
- 재현 자료: `test/review-dispatch.test.js:395,411,432,457`의 index/Interface/Touch full 단언, `:260,585`의 body-only hash, `test/cli-validate.test.js:450`의 scope-only freshness 유지 단언이 현재 계약이다. 테스트를 실행해 통과를 주장하지 않는다.

#### Target behavior

- 성공: 구조가 같은 epic/BP·Interface·Touch 변경은 partial이고 revision_diff와 관련 계약을 제공한다. metadata-only 범위/DAG 변경은 full이며 G18 stale을 만든다. uncommitted 문서도 immutable dispatch 내용으로 before를 얻는다.
- 실패: 내용/해시/문서 집합 불일치·타 blueprint·잘못된 v2 payload는 거부한다. 비교 가능한 digest-only legacy payload는 full migration으로 분류하고 before를 null로 표시한다. 이전 본문을 추정하지 않는다.
- 보존: status/title/timestamp/commit 증거 변경은 snapshot을 바꾸지 않는다. declared light skip·single/clustered discovery·한 cycle당 restart 1회·G18 판정 주체를 유지한다.

#### Interface

- v2 payload: `{snapshot_version:2,target:{digest,documents},parts,scope_parts,structure_parts,documents_content,follow_up,changed_documents,related_documents,revision_diff}`와 기존 plan strategy 필드다. documents_content는 repository-relative path별 `{body:string,structure:object}`다. parts는 body hash, structure_parts는 effective structure hash다.
- task structure shape: `{affected_paths:string[],depends_on:string[],parallel_safe:boolean,dependency_gate:"integrated",exclusive_resources:string[],execution_kind:"commit"|"verification"}`. blueprint structure는 `{scale:"full"|"light",review_scope:"blueprint"|null}`이며 absent 값은 schema 의미에 맞게 정규화한다. epic structure는 빈 객체다. 배열은 정규화·정렬하고 중복/잘못된 형태는 draft gate가 거부한다.
- digest 입력은 ordered `{file,body,structure}` 배열의 결정적 직렬화다. 문자열 사이 문서 경계를 유지한다. scope_parts는 이전 공개 Interface/Touch 관찰 hash로 보관하며 full 판단에는 사용하지 않는다.
- changed_documents는 추가/삭제/본문 또는 구조 변경의 합집합을 정렬한 목록이다. 초기 full은 전체 현재 문서를 변경 목록으로 표기하고 before null을 사용한다. 변화 없음은 partial과 빈 변경/diff를 돌려준다.
- revision_diff shape: `Array<{file:string,before:{body:string,structure:object}|null,after:{body:string,structure:object}|null}>`. partial에는 검증한 양쪽 내용이 있고 추가/삭제는 존재하지 않는 쪽만 null이다. legacy에서 unavailable before는 null과 reason으로 구분한다.
- related_documents는 changed task의 이전/현재 cluster 이웃과 DAG 양방향 transitive closure 및 epic/BP를 합치고 current judged set으로 제한한 정렬 목록이다. epic/BP 수정은 전체 task를 포함한다. 구조 full은 전체 current judged set이다. 변경된 문서는 delta 입력에서 한 번만 전달하고 related 목록은 중복을 제거한다.
- v2 previous는 hash·내용·정규화 구조·키 집합·target identity를 대조한다. invalid는 previous-payload-invalid이며 저장 최신 reference와 불일치는 BP 001의 previous-payload-stale이다. legacy 정상 digest-only input은 `follow_up:full`과 `legacy-payload-no-content` reason이고 restart 제한을 우회하지 않는다.

#### Touch

| 경로 | 심볼 | 변경 | 현재 책임 | 계획한 변경 | 근거 |
| --- | --- | --- | --- | --- | --- |
| `scripts/src/lib/plan-snapshot.ts` | `computePlanSnapshot·computePlanParts` | Modify | plan-snapshot.ts:62 body만 hash·:118 Interface/Touch scope | version2 내용·구조·경계 hash | snapshot의 단일 원천 |
| `scripts/lib/plan-snapshot.js` | `TypeScript emit` | Modify | snapshot 생성물 | TS snapshot과 동기화 | 배포 parity |
| `scripts/src/lib/review-dispatch.ts` | `decidePlanFollowUp·classifyPlanReview` | Modify | review-dispatch.ts:130,140,149 broad full | structure 기반 full과 실제 변경/관련 목록 | 수렴 여부 분류 |
| `scripts/lib/review-dispatch.js` | `TypeScript emit` | Modify | 분류 생성물 | TS 분류와 동기화 | 배포 parity |
| `scripts/src/lib/cli-review-dispatch-command.ts` | `HELP·plan previous reader` | Modify | help의 body-only/partial-only 설명 | v2 payload·legacy migration·diff 공개 형식 | 공개 계약 소비자 |
| `scripts/lib/cli-review-dispatch-command.js` | `TypeScript emit` | Modify | CLI 생성물 | TS 도움말·입력 동기화 | 배포 parity |
| `scripts/src/lib/context-review-state.ts` | `신규 추출 지점: dispatch snapshot 검증` | Modify | BP 001의 immutable payload writer | v2 integrity와 legacy migration 판정 연결 | persisted evidence 안전성 |
| `scripts/lib/context-review-state.js` | `TypeScript emit` | Modify | BP 001의 writer 생성물 | v2 writer 동기화 | 배포 parity |
| `test/review-dispatch.test.js` | `snapshot·previousPayload·follow_up tests` | Modify | test:260 body hash·:330 previous·:395 index full | v2 출력·delta·구조 full·diff/related 검사 | serialized constructor 전체 영향 |
| `test/cli-validate.test.js` | `G18 snapshot freshness integration` | Modify | cli-validate.test.js:450 scope-only freshness 유지 단언 | scope/DAG stale와 lifecycle 안정성 단언 | 새 digest의 실제 gate 소비자 |
| `test/validate-gates.test.js` | `G18 matching/stale fixtures` | Modify | validate-gates.test.js:780,792,831,838 snapshot stub | v2 digest 결과·기존 stale/skip fixture 정합 | 동일 snapshot gate 회귀 |
| `test/context-review-state.test.js` | `versioned payload persistence` | Modify | BP 001의 archive·target 검증 | v2 bytes·불일치·legacy before null 검사 | 재개/정합성 증거 |

#### Constraints

- 공통 기준 `references/coding-standards/index.md`를 따른다. 새 테스트 이름은 `<조건> → <결과>`이고 예상값은 이 브리프에서 도출한다. 비자명한 변경에는 한국어 why 주석과 Summary/Args/Returns를 가진 docstring을 쓴다.
- 새로운 의존성을 추가하지 않고 기존 frontmatter·render·path·schema·검증 helper를 재사용한다.
- accepted-risk와 계획 승인에는 명시 사용자 동의가 필요하다. CLI 기록 성공을 plan gate 통과로 표현하지 않는다.
- 새 snapshot은 G18과 dispatcher가 같은 함수 결과를 사용한다. gate 구현 자체의 조건·failure code를 약화하지 않고 consumers의 기대 digest만 맞춘다.
- normalize effective defaults는 기존 schema/task helper를 재사용한다. affected_paths 경로 의미와 DAG 중복을 임의로 지우지 않는다.
- body whitespace까지 immutable byte 내용으로 비교한다. prior content를 git HEAD·현재 파일로 대체하지 않는다.
- snapshot은 validate·validate-gates·review-dispatch를 import하지 않는다. 전체 plan input만 reviewer diff로 보관하고 비계획 문서를 payload에 넣지 않는다.

### EPIC-096/BP-002/TASK-002 · `f8752a15`

#### Goal & intent

v2 diff와 관련 계약을 모든 delta dispatch에 전달하고 delta-used·no-change·unresolved·stale에 대해 명시적 cycle 전이를 적용한다. 수용 기준은 epic 8~12이며 task 001 통합 후 진행한다.

#### Current behavior

- `agents/bouncer-context-reviewer.md:18,85`는 이전 finding과 수정 문서를 받고 unchanged minor/nit 제한은 있지만 실제 before/after를 받지 않는다.
- `skills/bouncer-plan/references/context-review.md:73`은 stale partial에서 이미 delta가 있는지 검사하지 않는다. `SKILL.md:228`은 unresolved를 무조건 authoring으로 되돌린다.
- I/O: reference `:82~96`의 print 경로는 r1/r2만 쓰고 `print-dispatch.ts:289,313`은 그 디렉터리 파일을 덮어쓴다. caller의 cycle-qualified path로 충돌을 막을 수 있어 print runtime 수정은 필요 없다.
- `codex-agents.ts:41~69`의 mdToCodexToml이 역할 전체를 생성하며 `test/agents.test.js:71`은 모든 역할의 byte parity를 검사한다. task 001의 v2 데이터와 BP 001의 상태 API가 이 task의 실제 base다.
- 조사 단계에서 테스트를 실행하지 않았다. 기존 skill 테스트는 reference/fingerprint 형식만 확인하며 reviewer 의미 동작을 검증한다고 주장하지 않는다.

#### Target behavior

- 성공: delta는 이전 findings와 검증된 revision_diff·changed_documents·related 계약을 받는다. 변화 없음은 기존 reviewed target을 재사용하며 round를 추가하지 않는다. delta 뒤 새 stale는 full/partial 모두 남은 restart를 사용한다.
- 실패: 이미 사용한 delta에 세 번째 round 요청, 한도 소진, 미해결 must_fix를 자동 restart로 닫으려는 요청은 reason/cause/next와 함께 멈춘다. 사용자 accepted-risk는 ID와 note를 명시한 기록으로만 허용한다.
- 보존: named/fallback/inline/print의 read-only role·fork_turns none·discovery 격리, actionable 처분, 계획 재승인과 plan gate.

#### Interface

- delta call allowlist: `{mode:"delta",target,previous_findings,changed_documents,revision_diff,related_documents,cwd}`. target과 diff shape는 task 001 공개 payload 그대로다. related_documents는 목록과 그 문서의 현재 계약 내용이며 changed document의 before/after와 중복 전달하지 않는다. 전체 대화·전체 history·judged set 밖 문서는 제외한다.
- reviewer output은 기존 Findings schema다. 기존 ID를 재사용하고 resolved/regressed/new 관계를 표시한다. introduced_by_revision의 evidence는 revision_diff의 바뀐 passage에 연결한다. related의 unchanged 텍스트에서는 신규 minor/nit를 보고하지 않는다. missed_critical은 blocker/major와 구체 false-acceptance 경로만 허용한다.
- 상태 routing 출력은 `next_action:"reuse"|"delta"|"restart"|"user"`와 reason/cause/next를 가진다. 마지막 certified target과 새 target이 같으면 reuse이며 record는 immutable 보고를 덮어쓰지 않는다. discovery 뒤 partial만 delta다. delta를 이미 사용했거나 structural full이면 restart_count<1일 때 restart다. 아직 round가 pending이거나 unresolved delta must_fix면 user다.
- 전체 restart는 상태 CLI가 archive·횟수 증가를 먼저 완료한 뒤 discovery를 dispatch한다. 두 번째 restart와 세 번째 active round는 machine에서 거부한다. unresolved delta 해결을 위한 재작업은 자동으로 새 cycle을 만들지 않는다.
- print 출력 형식: `.bouncer/runtime/print/context-review/<cycle id>/restart-<0|1>/<r1-combined|r1-local-id|r1-global|r2-delta>/`. input.md는 동일 allowlist만 담고 이전 출력 디렉터리를 재사용하지 않는다. fallback은 역할 본문 전체와 이 필드를 모두 전달한다.
- 사용자 accepted-risk와 재승인은 workflow가 실제 답변을 받은 후에만 record 및 status transition을 수행한다. CLI는 답변 존재를 추론하지 않는다.

#### Touch

| 경로 | 심볼 | 변경 | 현재 책임 | 계획한 변경 | 근거 |
| --- | --- | --- | --- | --- | --- |
| `scripts/src/lib/context-review-state.ts` | `신규 추출 지점: stale follow-up routing` | Modify | BP 001 cycle state와 BP 002 v2 | delta-used stale의 restart/limit·no-change/미해결 분기 | 기계 전이 제한 |
| `scripts/lib/context-review-state.js` | `TypeScript emit` | Modify | writer 생성물 | stale routing 동기화 | 배포 parity |
| `agents/bouncer-context-reviewer.md` | `Authority·Delta·Output` | Modify | agent:18,85 diff와 related 계약 없음 | 실제 before/after·계약 참조 입력과 origin 증거 | 판단 역할 계약 |
| `.codex/agents/bouncer-context-reviewer.toml` | `mdToCodexToml output` | Modify | generated role TOML | agent md와 byte parity | Codex 역할 소비자 |
| `skills/bouncer-plan/SKILL.md` | `Review·Gate` | Modify | SKILL.md:228 unresolved이면 authoring 복귀 | delta 이후 unresolved/stale를 구분 | workflow 진입 |
| `skills/bouncer-plan/references/context-review.md` | `Delta·Close·stale·print/fallback` | Modify | reference:51,73 입력 부족·무조건 재시작 | v2 delta allowlist·한도·cycle별 print | 모든 dispatch 소비자 |
| `references/context-review/index.md` | `Load·Judge·Return` | Modify | reference:31,78 revised-only 판단 | related 계약 참조와 실제 revision 경계 | 판단 reference 정본 |
| `rules/cli.md` | `plan payload·context-review state` | Modify | 기존 parts/full 설명 | v2 공개 필드·stale routing 설명 | 공개 CLI 정본 |
| `test/context-review-state.test.js` | `stale/delta transition behavior` | Modify | BP 001 cycle tests | delta 뒤 stale/한도/no-change/미해결 전이 검증 | 관찰 가능한 루프 종료 |
| `CHANGELOG.md` | `Unreleased` | Modify | BP 001 변경 기록 이후 | BP 002 delta·scope freshness·migration 기록 | 사용자가 알아야 할 동작 변화 |

#### Constraints

- 공통 기준 `references/coding-standards/index.md`를 따른다. 새 테스트 이름은 `<조건> → <결과>`이고 예상값은 이 브리프에서 도출한다. 비자명한 변경에는 한국어 why 주석과 Summary/Args/Returns를 가진 docstring을 쓴다.
- 새로운 의존성을 추가하지 않고 기존 frontmatter·render·path·schema·검증 helper를 재사용한다.
- accepted-risk와 계획 승인에는 명시 사용자 동의가 필요하다. CLI 기록 성공을 plan gate 통과로 표현하지 않는다.
- discovery 전략은 CLI만 정한다. partial delta가 cluster 변화로 discovery fan-out을 다시 열지 않는다. 관련 계약은 판정 근거이며 새 rubric/perspective를 추가하지 않는다.
- reviewer 지침의 의미 준수를 문구 regex로 증명하지 않는다. 상태 전이 output·입력 payload 필드·TOML byte parity로 검증 가능한 계약만 검사한다.
- changed_documents 밖 문서를 무조건 금지하던 old delta allowlist는 related_documents의 계약 참조로 명시 교체한다. 새 finding의 origin 제한은 그대로 유지한다.

### EPIC-096/BP-002/TASK-003 · `cc56d936`

#### Goal & intent

기록된 terminal CI 실패를 복구한다.

#### Interface

- 제공: 실패 command와 관련 경로를 통과시키는 최소 수정
- 거부: Blueprint 밖 scope와 새 기능

#### Touch

- Modify `scripts/src/lib/cli-context-review-command.ts` — 기록된 CI 실패를 복구한다.
- Modify `scripts/src/lib/context-review-state.ts` — 기록된 CI 실패를 복구한다.
- Modify `test/context-review-state.test.js` — 기록된 CI 실패를 복구한다.
- Modify `rules/cli.md` — 기록된 CI 실패를 복구한다.
- Modify `skills/bouncer-plan/SKILL.md` — 기록된 CI 실패를 복구한다.
- Modify `skills/bouncer-plan/references/context-review.md` — 기록된 CI 실패를 복구한다.
- Modify `CHANGELOG.md` — 기록된 CI 실패를 복구한다.

#### Constraints

- 원장의 실패 증적과 repair 결정 범위만 따른다.