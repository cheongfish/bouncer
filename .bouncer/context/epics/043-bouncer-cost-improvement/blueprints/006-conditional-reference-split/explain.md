---
type: bouncer.explain
title: 003 explain
description: Explain for 003
resource: .bouncer/context/epics/043-bouncer-cost-improvement/blueprints/006-conditional-reference-split/explain.md
tags:
  - bouncer
  - explain
timestamp: '2026-08-27T13:36:09.029+09:00'
bouncer:
  id: EXPLAIN-006
  epic_id: '043'
  blueprint_id: '006'
  status: published
  comprehension:
    - range_from: develop
      range_to: f6af63ceb08a120a9159a041b0cbcbde7c949b03
      diff_sha: 0c23cedfc5dd4d11dbdc7596c7f952fe5d9cc13cda976535f44ad9b77bf5bf8c
      quiz_score: 4/4
      disposition: 조건부 reference 분리와 본문 계약의 경계를 정확히 이해함
      recorded_at: '2026-08-27T13:37:32+09:00'
---
# Explain

## Background
`bouncer-finalize`, `bouncer-plan`, `bouncer-execute`, `bouncer-run`은 정상 경로에서 쓰지 않는 상세 절차까지 한 파일에서 먼저 읽고 있었다. 각 workflow의 gate·ACQ·포인터·범위 계약은 진입 스킬에 남기고, Distill 승격·Graphify·agent dispatch·실패 복구처럼 조건이 있을 때만 필요한 절차를 `references/`로 옮겼다.

테스트는 workflow bundle reader로 본문과 reference를 함께 읽어 이동한 계약을 계속 검증한다. `eslint.config.js`에는 긴 계약 문자열을 쓰는 `test/**`에만 `max-len` 예외를 추가해 운영 코드의 120자 제한을 유지했다.

## Intuition
진입 스킬은 안내판이고 reference는 갈림길에서만 여는 상세 지도다.

## Code
- `skills/bouncer-finalize/SKILL.md`와 `references/*.md`: Distill 승격, explain·quiz, draft PR, worktree 정리의 조건부 절차를 나눈다.
- `skills/bouncer-plan/SKILL.md`, `skills/bouncer-execute/SKILL.md`, `skills/bouncer-run/SKILL.md`: 각 workflow가 본문에 남겨야 하는 gate·ACQ·소유권 계약과 reference 진입 조건을 연결한다.
- `test/helpers/read-skill.js`: 본문과 정렬된 `references/*.md`를 합친 workflow bundle을 제공한다.
- `test/skill-bouncer-*.test.js`, `test/lightweight-cycle.test.js`, `test/skill-debugging.test.js`: 본문 잔존 계약과 reference 상세 계약을 나누어 검증한다.
- `eslint.config.js`: `test/**`에서만 `max-len`을 끈다.

## Quiz
1. 조건부 절차를 reference로 옮긴 뒤에도 `SKILL.md` 본문에 남겨야 하는 것은 무엇인가?
   - A) 모든 reference의 세부 shell command
   - B) gate·ACQ·포인터·범위 같은 진입 계약
   - C) 과거 실행 로그

2. workflow bundle reader를 추가한 주된 이유는 무엇인가?
   - A) 본문과 reference에 나뉜 계약을 하나의 테스트 입력으로 읽기 위해
   - B) reference 파일을 자동으로 생성하기 위해
   - C) 모든 skill을 하나의 파일로 다시 합치기 위해

3. `bouncer-execute`의 verify 실패 복구에서 debugger report는 어떻게 취급되는가?
   - A) `affected_paths`를 넓히는 지시
   - B) 즉시 커밋을 허용하는 승인
   - C) implementer가 최소 수정에 쓰는 증거

4. 이번 ESLint 변경의 범위는 무엇인가?
   - A) 모든 Markdown 파일의 `max-len` 해제
   - B) `test/**`만 `max-len` 예외, 운영 코드는 기존 제한 유지
   - C) 전체 repository의 모든 lint 규칙 해제

## 이해 상태
정답: 1-B, 2-A, 3-C, 4-B. 응답: 1-B, 2-A, 3-C, 4-B. 4문항 모두 정답이며, 조건부 reference와 진입 스킬 본문의 계약 경계를 이해함.

## Tasks

### Task 001

#### Goal & intent

`bouncer-finalize`의 Distill 승격, explain·quiz, draft PR, worktree 정리·다음 blueprint 인계 상세를 실행 조건이 붙은 reference로 분리한다. `validate --gate finalize`, remainder dry-run·`--yes`, commit scope와 검증 실패 처리 절차는 `SKILL.md` 본문에 남아야 한다.

#### Interface

- 제공: `skills/bouncer-finalize/SKILL.md`의 각 단계가 필요한 시점에만 `references/distill-promotion.md`, `references/explain-quiz.md`, `references/draft-pr.md`, `references/cleanup-handoff.md`를 읽도록 라우팅한다. 각 reference 첫 문단은 같은 로딩 조건을 한 문장으로 선언한다.
- 거부: finalize gate, remainder commit, staged scope, `reason: 'verify'` 처리, remainder ACQ를 reference로 이동하거나 reference 전체를 preflight에서 무조건 읽게 하지 않는다.

#### Touch

- Modify `skills/bouncer-finalize/SKILL.md` — 번호 절차와 게이트 핵심 절차를 유지하고 조건부 단계의 reference 라우팅을 남긴다.
- Create `skills/bouncer-finalize/references/distill-promotion.md` — full JSON audit, shard split, 승격 제안·동의 상세를 담는다.
- Create `skills/bouncer-finalize/references/explain-quiz.md` — explain scaffold·quiz·published 처리 상세를 담는다.
- Create `skills/bouncer-finalize/references/draft-pr.md` — remote·`gh` 조건, PR ACQ와 초안 작성 상세를 담는다.
- Create `skills/bouncer-finalize/references/cleanup-handoff.md` — 선택된 worktree 정리와 다음 blueprint 인계 상세를 담는다.
- Modify `test/helpers/read-skill.js` — 기존 skill reader에 `references/*.md`를 정렬해 합치는 workflow bundle reader를 추가한다.
- Modify `test/skill-bouncer-finalize.test.js` — 본문 라우팅·게이트 잔존과 reference별 계약을 각각 단언한다.
- Modify `test/master-rules.test.js` — 워크플로 본문과 references를 합친 계약 읽기 helper를 도입해 Distill 계약 위치 이동을 추적한다.

#### Constraints

- `rules/skill-shape.md`의 번호 절차와 마지막 `## ACQ (AskUserQuestion) gates` 순서를 유지한다.
- reference는 supporting material이며 출력 template로 취급하지 않는다.
- 이동 전후의 ACQ 개수·선택지·단계 순서·중단 조건을 바꾸지 않는다.
- 본문에서 reference를 읽는 조건과 reference 첫 문단의 조건이 문구상 동일해야 한다.
- 최소화 근거: 서로 다른 네 로딩 조건은 네 reference로 유지하고, 테스트의 bundle 탐색은 기존 `test/helpers/read-skill.js`를 확장해 한 번만 구현한다.

### Task 002

#### Goal & intent

`bouncer-plan`의 Distill baseline·preflight, Graphify suggestion 생성, full-plan context review 디스패치 상세를 단계별 reference로 분리한다. 발견·ID 할당·scaffold·작성 흐름, `affected_paths` 사용자 확인, 명시적 승인, pointer와 plan gate는 `SKILL.md` 본문에 남아야 한다.

#### Interface

- 제공: `references/distill-preflight.md`, `references/graphify-suggestions.md`, `references/context-review.md`가 각각 Distill 준비, graph suggestion, `scale: full` 판정 단계에서만 읽힌다. reference 첫 문단과 `SKILL.md` 호출 단계는 같은 로딩 조건을 쓴다.
- 거부: Discovery 확인, light/full 선택, `affected_paths` 확인·재-ground, approval, `current --set`, G1–G5·G10–G12·G18 판정을 reference로 이동하거나 Graphify 제안을 승인 범위로 자동 복사하지 않는다.

#### Touch

- Modify `skills/bouncer-plan/SKILL.md` — 계획 본문, ACQ, 승인 범위와 plan gate를 유지하고 reference 라우팅을 남긴다.
- Create `skills/bouncer-plan/references/distill-preflight.md` — project-root, scratch baseline, preflight와 fallback 상세를 담는다.
- Create `skills/bouncer-plan/references/graphify-suggestions.md` — graph-sync, graceful fallback과 scope evidence 기록 상세를 담는다.
- Create `skills/bouncer-plan/references/context-review.md` — full-plan named reviewer 디스패치와 findings 기록 상세를 담는다.
- Modify `test/skill-bouncer-plan.test.js` — 본문 계약과 세 reference의 로딩·내용 계약을 분리해 단언한다.

#### Constraints

- `rules/skill-shape.md`의 번호 절차와 마지막 ACQ 절을 유지한다.
- `--all` baseline은 scratch 파일이고 `--preflight`만 context에 주입한다는 계약을 보존한다.
- `scale: light`의 G10 축약과 G18 생략 외에는 scope gate가 같다는 계약을 본문에 유지한다.
- approval 전 status 전환과 `affected_paths` 자동 작성을 허용하지 않는다.
- 최소화 근거: Distill 준비·Graphify 제안·full context review는 로딩 조건이 달라 세 reference로만 나누고 공용 helper는 task 001의 기존 test helper를 재사용한다.

### Task 003

#### Goal & intent

`bouncer-execute`의 named-agent model 해석·fallback과 verify 실패의 debugger→implementer 복구 상세를 조건부 reference로 분리한다. pointer task 선택, Distill re-ground, shared worktree, scope·status 소유권, `verification.md`의 `## Command`·`## Evidence` harness 기록과 `validate --gate execute` 절차는 `SKILL.md` 본문에 남아야 한다.

#### Interface

- 제공: `references/agent-dispatch.md`는 named dispatch 또는 host fallback이 필요한 단계에서, `references/verification-recovery.md`는 harness가 기록한 실패 증적을 복구 입력으로 소비할 때만 읽힌다. 각 reference 첫 문단과 호출 단계가 같은 조건을 선언한다.
- 거부: pointer·brief 선택, worktree 생성·재사용, `affected_paths`, controller status 소유권, `verification.md` 경로와 `## Command`·`## Evidence` 기록 계약, G6–G8·G13·G14와 execute gate를 reference로 이동하거나 fallback을 삭제하지 않는다.

#### Touch

- Modify `skills/bouncer-execute/SKILL.md` — pointer·worktree·scope·status·증적 기록·gate 핵심 절차를 유지하고 조건부 reference 라우팅을 남긴다.
- Create `skills/bouncer-execute/references/agent-dispatch.md` — implementer·reviewer·debugger model 해석, named dispatch, `inherit`·inline fallback 상세를 담는다.
- Create `skills/bouncer-execute/references/verification-recovery.md` — 이미 기록된 verify 실패 증적을 입력으로 받는 debugger report, 순차 implementer 재호출과 1회 상한 상세를 담는다.
- Modify `test/skill-bouncer-execute.test.js` — 본문 핵심 절차와 reference별 dispatch·recovery 계약을 나눠 단언한다.
- Modify `test/lightweight-cycle.test.js` — light implementer 분기와 host fallback 계약을 workflow bundle에서 읽게 한다.
- Modify `test/skill-debugging.test.js` — execute와 run의 debugger 재호출 상한을 workflow bundle에서 읽게 한다.

#### Constraints

- named agent가 없는 host의 inline·generic fallback을 모든 역할에서 보존한다.
- light blueprint의 implementer inline 분기와 `/bouncer-run` 주행 예외를 바꾸지 않는다.
- debugger report는 evidence이며 scope를 넓히는 지시로 취급하지 않는다.
- review 2회와 debugger 1회 상한, `/bouncer-plan` escalation을 유지한다.
- 최소화 근거: 정상 dispatch와 실패 recovery 두 조건만 reference로 나누고 model 해석 helper나 런타임 추상화는 만들지 않는다.

### Task 004

#### Goal & intent

`bouncer-run`의 verify 재실패, review 상한, scope 위반과 사용자 중단 뒤 복구 상세를 실패 시에만 읽는 reference로 분리한다. 오케스트레이터 소유권, execute→commit 반복, autonomy 분기, 시작·task 경계 ACQ와 종료 조건은 `SKILL.md` 본문에 남아야 한다.

#### Interface

- 제공: `references/stop-recovery.md`는 verify·review·scope·사용자 거절로 주행이 멈춘 경우에만 읽히며, pointer·worktree 보존과 수동 재개 절차를 담는다. reference 첫 문단과 중단 단계가 같은 로딩 조건을 선언한다.
- 거부: 루프 controller의 네 소유권, report routing, debugger·review 상한, `nextTask`, `current --set`, start·interactive ACQ, `/bouncer-finalize` 종료 안내를 reference로 이동하거나 run이 자동 재시도하게 만들지 않는다.

#### Touch

- Modify `skills/bouncer-run/SKILL.md` — loop ownership, 반복 단위, 상한, ACQ와 종료 핵심 절차를 유지하고 중단 reference 라우팅을 남긴다.
- Create `skills/bouncer-run/references/stop-recovery.md` — 중단 원인별 pointer·worktree 보존과 수동 복구 상세를 담는다.
- Modify `test/skill-bouncer-run.test.js` — 본문의 반복 계약과 stop-recovery reference 계약을 분리해 단언한다.

#### Constraints

- `/bouncer-run`은 finalize를 호출하지 않고 열린 task 소진 뒤 안내만 한다.
- `auto`와 `interactive`의 commit ACQ 처리, interactive task 경계 ACQ를 바꾸지 않는다.
- verify 1회·review 2회 상한은 execute 소유값을 참조하며 별도 상한을 만들지 않는다.
- 중단 뒤 pointer와 execute worktree를 보존하고 자동 재시도하지 않는다.
- 최소화 근거: 네 중단 원인의 결과와 재개 절차가 같으므로 `stop-recovery.md` 하나로 묶고 task 001의 bundle helper를 재사용한다.

### Task 005

#### Goal & intent

테스트 파일에는 `max-len`을 적용하지 않아, 조건부 reference의 로딩 조건처럼 긴 계약 문자열이 lint 실패를 만들지 않게 한다. 운영 코드에는 현재 120자 제한을 유지한다.

#### Interface

- 제공: `test/**` 파일은 `max-len` 예외를 받아 긴 계약 데이터도 lint 대상에 남는다.
- 거부: 테스트 밖 파일의 `max-len` 120자 제한을 완화하거나 다른 ESLint 규칙을 끄지 않는다.

#### Touch

- Modify `eslint.config.js` — `test/**`에만 적용되는 `max-len` 예외를 추가한다.

#### Constraints

- 테스트 경로에만 예외를 두고, 설정 파일의 기존 규칙과 순서를 불필요하게 재구성하지 않는다.
- 새 의존성이나 별도 lint 명령을 추가하지 않고 기존 `npm run ci`로 검증한다.
