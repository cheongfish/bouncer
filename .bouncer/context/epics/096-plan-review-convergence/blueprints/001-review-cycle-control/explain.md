---
type: bouncer.explain
title: 001 explain
description: Explain for 001
resource: .bouncer/context/epics/096-plan-review-convergence/blueprints/001-review-cycle-control/explain.md
tags:
  - bouncer
  - explain
timestamp: '2026-10-12T22:47:30.391+09:00'
bouncer:
  id: EXPLAIN-001
  epic_id: '096'
  blueprint_id: '001'
  status: published
  comprehension:
    - range_from: 83808f81ac1e395736e89c121a712a46fec0daa1
      range_to: aea99f9cfed0e90d6c5bef81ef7a1ec1628cf159
      diff_sha: 013d738729b757485b42a008b7f42284f447d4f70a84a7c09933d6ade2777e10
      recorded_at: '2026-10-12T23:00:00+09:00'
  task_commits:
    - task: EPIC-096/BP-001/TASK-001
      sha: c260ef17
      intent_anchor: task-001
    - task: EPIC-096/BP-001/TASK-002
      sha: 9d792ff0
      intent_anchor: task-002
    - task: EPIC-096/BP-001/TASK-003
      sha: aea99f9c
      intent_anchor: task-003
---
# Explain

## Background

계획 리뷰는 findings를 고치고 다시 검토하는 일을 반복한다. 그런데 전체를 처음부터 다시 시작하면 지난 리뷰 이력과 재시작 횟수가 0으로 돌아가, 같은 계획을 끝없이 돌릴 수 있었다. 후속 리뷰가 직전 결과를 참조하지 않아도 통과하는 경로도 있었다. 이 변경은 리뷰 반복을 CLI가 기록하고, 재시작을 cycle당 한 번으로 제한하며, 후속 리뷰가 직전 dispatch를 반드시 이어받게 한다.

## Intuition

리뷰 한 사이클은 출입 기록부다. `start`로 열고 `record`로 라운드를 적고, 처음부터 다시 하려면 `restart`를 단 한 번만 쓴다. 기록부를 찢어도(런타임 상태 삭제) `context-review.md`에 남은 표식이 "이미 한 번 썼다"고 알려 준다.

## Code

- `scripts/src/lib/context-review-state.ts` — cycle 상태, 잠금, 원자적 저장, 재시작 한도와 표식
- `scripts/src/lib/cli-context-review-command.ts` — `bouncer context-review start|record|restart`
- `scripts/src/lib/review-dispatch.ts` — `--previous` 필수 검사와 `previous-payload-*` 거부
- `rules/document-schema.md`, `references/context-review/index.md`, `skills/bouncer-plan/` — 규칙과 workflow 문서

## Quiz

1. 재시작 한도에 관한 질문
2. `state.json`이 삭제된 뒤의 `start`/`restart` 동작
3. 리뷰 증거가 있는 blueprint의 후속 `review-dispatch plan`에서 `--previous`가 없을 때의 결과
4. `record` 성공과 계획 승인의 관계

## Tasks

### EPIC-096/BP-001/TASK-001 · `c260ef17`

#### Goal & intent

계획 리뷰 cycle과 immutable 보고·dispatch를 CLI로 기록하고 전체 재시작을 누적 1회로 제한한다. 수용 기준은 epic 1~3·10~11이며 최종 검증 명령은 `npm run ci`이다.

#### Current behavior

- `scripts/src/lib/cli.ts:32`는 공개 registry이고 context-review 명령이 없다. `scripts/src/lib/review-record.ts:189`는 execute review.md만 기록한다.
- `review-record.ts:234`의 round append와 `:111`의 finding ID merge는 과거 finding 버전을 보관하지 않는다.
- I/O: `frontmatter.ts:32`는 UTF-8 파일 읽기, `render.ts:8`은 YAML·본문 출력, `review-record.ts:273`은 sibling tmp + rename 패턴이다. 원자적 rename에 동시 writer 잠금은 없다.
- 재현 자료: `test/review-record.test.js:96,128,143,158,259`는 성공 기록·잘못된 순서·입력·수용 거부를 검사한다. 계획 cycle 테스트는 없다. 조사 단계에서는 테스트를 실행하지 않았다.

#### Target behavior

- 성공: start가 cycle을 만들고 동일 start 재호출·프로세스 reload는 id와 횟수를 유지한다. record는 actual reviewer 보고와 dispatch만 저장한다. restart는 0→1만 허용하고 active evidence를 보관한다.
- 실패: 두 번째 restart, 오래된 서로 다른 전이, malformed report, stale dispatch, 불법 target, unresolved closure는 명시적 오류로 기존 파일을 유지한다. 동일 완료 전이는 no-op이다.
- 보존: execute review.md, context canonical finding status resolved|accepted, read-only reviewer 권한, G18 승인 주체.

#### Interface

- CLI 제공: `context-review start --blueprint <dir> --dispatch <json>`; `record --blueprint <dir> --dispatch <json> --round <json> [--status requested|addressed|accepted] [--accept-risk <id[,id...]>]`; `restart --blueprint <dir> --dispatch <json> --reason <text>`. `--repo <dir>`는 기존 CLI와 같은 repo override다. help 0, usage 2, 전이 거부 1이다.
- cycle shape: `{id:string,restart_count:0|1,history:ArchivedCycle[],active_reports:ReportRef[],latest_dispatch:{path:string,sha256:string}}`. Archive는 restart index·사유·당시 rounds/findings·보고/dispatch 참조를 보존한다. 자료는 blueprint와 cycle namespace에 묶는다.
- round JSON은 `{round:object,findings:object[]}`이며 discovery/delta 보고를 보관한다. in-progress 보고의 open은 active_reports 안에서만 허용하고 canonical findings enum을 늘리지 않는다. 최종 closure에서는 ID별 최신 처분을 합쳐 resolved 또는 note가 있는 accepted만 projection한다. must_fix accepted는 `--accept-risk` ID와 note가 일치하고 workflow가 명시 사용자 동의를 얻었을 때만 허용한다.
- 전이 식별자: current cycle id·restart index·round number·dispatch digest와 입력 파일 sha256을 결합한 키를 저장한다. 같은 키의 재요청은 no-op, 같은 expected state의 다른 키는 충돌이다.
- dispatch payload는 CLI가 읽어 현재 snapshot·문서 집합과 대조하고 cycle-owned runtime 아래에 immutable로 저장한다. 경로는 절대 repo가 아닌 repository-relative POSIX로 기록한다.
- 거부: strategy skip, closed blueprint, 다른 blueprint/cycle, 비정상 round 순서, target digest/document 불일치, root 밖·symlink 밖의 writer target, 손상된 history, 한도 소진. 기존 evidence가 있는 legacy start는 거부하며 일치하는 이전 payload를 이용한 명시 restart에서만 archive/import한다.
- 오류 JSON은 `{ok:false,reason:string,cause:unknown,next:string}`다. 기본 reason은 `context-review-restart-limit`, `context-review-state-conflict`, `context-review-unresolved-findings`, `context-review-target-invalid`, `context-review-legacy-evidence`로 구분한다.

#### Touch

| 경로 | 심볼 | 변경 | 현재 책임 | 계획한 변경 | 근거 |
| --- | --- | --- | --- | --- | --- |
| `scripts/src/lib/context-review-state.ts` | `신규 추출 지점: plan cycle 전이·기록` | Create | 전용 cycle writer 없음 | start/record/restart와 immutable dispatch·history·한도 검사 | 누적 상태의 단일 writer |
| `scripts/lib/context-review-state.js` | `TypeScript emit` | Create | 생성물 없음 | 상태 writer 생성물 | 배포 CLI 실행 코드 |
| `scripts/src/lib/cli-context-review-command.ts` | `신규 추출 지점: context-review CLI` | Create | 명령 없음 | 인자·help·JSON·exit 계약 | 공개 명령 진입점 |
| `scripts/lib/cli-context-review-command.js` | `TypeScript emit` | Create | 생성물 없음 | CLI 생성물 | 배포 parity |
| `scripts/src/lib/cli.ts` | `command registry` | Modify | cli.ts:32 command registry | context-review 등록과 usage 연결 | 공개 명령 라우팅 |
| `scripts/lib/cli.js` | `TypeScript emit` | Modify | registry 생성물 | TS registry와 동기화 | 배포 parity |
| `test/context-review-state.test.js` | `신규 추출 지점: cycle 상태·CLI 동작 검증` | Create | 상태 테스트 없음 | resume/cap/archive/acceptance/오류·원자성 검증 | 관찰 가능한 상태 계약 |
| `test/cli-help.test.js` | `SUBCOMMANDS·capture` | Modify | cli-help.test.js:9 고정 명령 목록 | 신규 명령 help·인자 exit 검증 | CLI 공개 목록 소비자 |
| `test/tiers.json` | `unit/integration test inventory` | Modify | 새 파일 등록 없음 | 새 테스트 파일의 적절한 tier 등록 | CI 명시 inventory |

#### Constraints

- 공통 기준 `references/coding-standards/index.md`를 따른다. 새 테스트 이름은 `<조건> → <결과>`이고 예상값은 이 브리프에서 도출한다. 비자명한 변경에는 한국어 why 주석과 Summary/Args/Returns를 가진 docstring을 쓴다.
- 새로운 의존성을 추가하지 않고 기존 frontmatter·render·path·schema·검증 helper를 재사용한다.
- accepted-risk와 계획 승인에는 명시 사용자 동의가 필요하다. CLI 기록 성공을 plan gate 통과로 표현하지 않는다.
- canonical rounds의 sequence는 discovery 또는 discovery→delta다. cycle.history와 active_reports는 게이트 처분을 대신하지 않는다.
- 미해결 must_fix를 해결하려고 delta 뒤 restart하지 않는다. stale restart는 이전 certified target과 현재 snapshot의 변화가 있을 때만 허용한다.
- target document 검증을 끝낸 뒤 sibling tmp + rename으로 교체한다. payload를 먼저 저장한 실패는 참조되지 않은 파일만 남길 수 있으며 기존 record는 유지한다. 동시 전이는 같은 namespace의 배타 잠금과 expected-state 확인으로 한 번만 적용한다. 시작·재시작을 우회해 횟수를 0으로 만드는 기능은 추가하지 않는다.

### EPIC-096/BP-001/TASK-002 · `9d792ff0`

#### Goal & intent

후속 review-dispatch를 cycle latest_dispatch에 묶고 계획 workflow가 start/record/restart를 사용하도록 바꾼다. 수용 기준은 epic 1~4·10~12이며 task 001이 통합된 뒤 진행한다.

#### Current behavior

- `review-dispatch.ts:181,259`는 cycle 없이 previous를 읽고, 누락이면 항상 full이다. `:234`는 parts 객체만 검사하며 digest·blueprint를 대조하지 않는다.
- `skills/bouncer-plan/references/context-review.md:8,13`은 최초 분류를 두 번 호출하고, `:51`은 previous를 선택 인자로 쓰며 `:76`은 stale에서 rounds/findings를 교체한다.
- I/O: `cli-review-dispatch-command.ts:278`은 previous JSON을 파일에서 읽고 parse 실패를 exit 1로 반환한다. task 001의 상태 CLI가 추가된 base에서 cycle·immutable 참조를 읽는다.
- 재현 자료: `test/review-dispatch.test.js:330,342,550`은 reduced previous helper·previous 없는 full·손상 입력을 검사한다. 조사 중 테스트는 실행하지 않았다. repository 검색에서 다른 parts/scope_parts literal fixture 생성자는 없었다.

#### Target behavior

- 성공: 증거 없는 pending 계획의 최초 분류 → start → reviewer → record가 동일 immutable target을 사용한다. 후속 호출은 저장된 previous를 전달하고 한도 안에서만 restart한다.
- 실패: follow-up previous 누락·손상·다른 blueprint·최신 참조와 불일치는 reviewer 호출 전에 멈춘다. 반복 초기화·active evidence 덮어쓰기와 cycle 없는 legacy 재승인은 거부한다.
- 보존: 분류는 읽기 전용이다. light skip은 previous 검사와 cycle 생성 없이 유지하고 기존 full/partial 내용 조건은 BP 002 전까지 유지한다.

#### Interface

- `review-dispatch plan --blueprint <dir> [--previous <json>]` 공개 형태는 유지하되 optional은 증거 없는 최초 pending 계획만 뜻한다. runtime state.json, bouncer.context_review.restart_count 또는 기존 rounds/accepted evidence가 있으면 previous가 필수다.
- previous는 `{ok:true,phase:"plan",strategy:"single"|"clustered",target:{digest,documents},parts,scope_parts}`의 정상 payload이며 blueprint의 judged document identity·sha256 map·latest_dispatch 저장 파일과 대조한다. 동일 최초 snapshot 재확인은 저장된 previous를 전달한다.
- 누락은 `previous-payload-required`, 잘못된 JSON/형식/경로·다른 blueprint는 `previous-payload-invalid`, 저장 최신 payload와 다르면 `previous-payload-stale`을 출력한다. JSON에 cause와 next를 붙이고 exit 1이다.
- cycle 없는 legacy records는 gate의 기존 읽기 호환을 유지한다. 새 리뷰 전환은 유효한 previous를 복구하고 task 001의 명시 restart로 archive한다. 입력 불확실성을 최초 상태로 판단하지 않는다.
- workflow는 dispatch 결과를 저장한 뒤 start한다. 원본 reviewer 보고는 record 입력이고 canonical 상태 전이는 상태 CLI 소유다. discovery는 기존 CLI single/clustered 전략으로만 호출한다. 전체 재시작은 기존 자료를 archive하고 누적 1회에 포함한다.
- print 출력은 cycle id/restart index 하위로 구분한다. 전후 모든 호출에서 read-only reviewer·fork_turns none·독립 discovery finding 격리를 유지한다.

#### Touch

| 경로 | 심볼 | 변경 | 현재 책임 | 계획한 변경 | 근거 |
| --- | --- | --- | --- | --- | --- |
| `scripts/src/lib/review-dispatch.ts` | `classifyPlanReview` | Modify | review-dispatch.ts:259 previous 없으면 full | cycle latest_dispatch와 previous 대조·오류 분리 | 읽기 전용 후속 분류 진입 |
| `scripts/lib/review-dispatch.js` | `TypeScript emit` | Modify | 분류 생성물 | TS 분류와 동기화 | 배포 parity |
| `scripts/src/lib/cli-review-dispatch-command.ts` | `plan handler·HELP` | Modify | cli-review-dispatch-command.ts:278 previous JSON 읽기 | 저장 참조·strict previous·상태 CLI help | 공개 payload 소비자 |
| `scripts/lib/cli-review-dispatch-command.js` | `TypeScript emit` | Modify | help·handler 생성물 | TS 변경 동기화 | 배포 parity |
| `skills/bouncer-plan/SKILL.md` | `Review·Gate` | Modify | Review와 stale는 reference로 넘김 | 상태 CLI와 중단/복귀 구분 | workflow 진입점 |
| `skills/bouncer-plan/references/context-review.md` | `Freeze·Revise·Close·stale` | Modify | context-review.md:51 previous 선택·:76 기록 교체 | start/record/restart·immutable previous·이력 보존 | 반복 경로 소유자 |
| `references/context-review/index.md` | `Contract·Return` | Modify | index.md:60 legacy·:90 controller 직접 기록 | cycle 기록 소유와 canonical projection | reviewer 판단과 기록 분리 |
| `rules/document-schema.md` | `Generated evidence fields` | Modify | document-schema.md:122 증거 필드 | cycle·보고 참조·canonical 처분 계약 | serialized state 설명 |
| `rules/cli.md` | `review-dispatch plan` | Modify | rules/cli.md:184 읽기 전용 계약 | context-review 명령과 previous 필수 설명 | 공개 CLI 정본 |
| `test/review-dispatch.test.js` | `previousPayload·follow_up tests` | Modify | review-dispatch.test.js:330 reduced payload helper | 최초/후속·누락·타 cycle·immutability 검증 | serialized shape 생성자 |
| `test/context-review-state.test.js` | `plan follow-up integration` | Modify | 선행 task의 신규 상태 테스트 | classifier와 writer 연쇄·재개·한도 검증 | 실제 반복 차단 검증 |
| `test/cli-help.test.js` | `review-dispatch help assertions` | Modify | cli-help.test.js:414 고정 YAML help 검사 | 변경된 공개 help·record 샘플 정합성 | 기존 공개 형식 소비자 |
| `CHANGELOG.md` | `Unreleased` | Modify | 현재 릴리스 기록 | BP 001 반복 제한·previous 변경 기록 | 사용자가 알아야 할 동작 변화 |

#### Constraints

- 공통 기준 `references/coding-standards/index.md`를 따른다. 새 테스트 이름은 `<조건> → <결과>`이고 예상값은 이 브리프에서 도출한다. 비자명한 변경에는 한국어 why 주석과 Summary/Args/Returns를 가진 docstring을 쓴다.
- 새로운 의존성을 추가하지 않고 기존 frontmatter·render·path·schema·검증 helper를 재사용한다.
- accepted-risk와 계획 승인에는 명시 사용자 동의가 필요하다. CLI 기록 성공을 plan gate 통과로 표현하지 않는다.
- 이 task에서는 full/partial 조건과 body-only snapshot hash를 바꾸지 않는다. BP 002가 구조/문서 분리를 맡는다.
- 계획 승인과 affected_paths 확인 ACQ는 유지한다. stale로 계획 본문이 바뀌면 리뷰 후 step 6 재승인을 받는다.
- 직전 immutable payload와 실패 code/reason·next를 사용자에게 보여 주고 같은 실패 반복은 master rules대로 중단한다.
- 문서 문구를 regex로 검사하는 새 테스트를 만들지 않는다. 기존 helper shape 소비자와 CLI 공개 output·exit·저장 bytes로 연결을 검증한다.

### EPIC-096/BP-001/TASK-003 · `aea99f9c`

#### Goal & intent

기록된 terminal CI 실패를 복구한다.

#### Interface

- 제공: 실패 command와 관련 경로를 통과시키는 최소 수정
- 거부: Blueprint 밖 scope와 새 기능

#### Touch

- Modify `scripts/src/lib/context-review-state.ts` — 기록된 CI 실패를 복구한다.
- Modify `scripts/src/lib/review-dispatch.ts` — 기록된 CI 실패를 복구한다.
- Modify `test/context-review-state.test.js` — 기록된 CI 실패를 복구한다.
- Modify `test/review-dispatch.test.js` — 기록된 CI 실패를 복구한다.
- Modify `rules/document-schema.md` — 기록된 CI 실패를 복구한다.

#### Constraints

- 원장의 실패 증적과 repair 결정 범위만 따른다.