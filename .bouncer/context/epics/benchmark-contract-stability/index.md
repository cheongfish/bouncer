---
type: bouncer.epic
title: 벤치마크 응답기의 기계 판독 계약 전환
description: 벤치마크 응답기가 채팅 문장 추측 대신 Bouncer의 기계 판독 계약(게이트 카탈로그·ACQ 블록·drive 요약)만 읽게 해 버전·문구 변화마다 하네스를 고치는 반복을 없앤다.
resource: .bouncer/context/epics/benchmark-contract-stability/index.md
tags:
  - bouncer
  - epic
  - benchmark
  - acq
  - harness
  - finalize
timestamp: '2026-10-11T17:10:47.798+09:00'
bouncer:
  id: benchmark-contract-stability
  epic_id: benchmark-contract-stability
  status: approved
  supersedes: []
---
# 093 벤치마크 응답기의 기계 판독 계약 전환

## Intent
벤치마크 응답기(`benchmarks/acp/responder.cjs`)는 에이전트 채팅 문장을 정규식으로 추측해 질문을 찾고, CLI 내부 원장을 버전별 분기로 읽어 9/29 이후 14번 수정됐음.
이 epic은 Bouncer가 게이트 카탈로그·ACQ 판독 블록·drive 요약을 기계 판독 계약으로 내놓고, 응답기가 그 계약만 읽어 계약 밖 질문에서는 멈추게 함.

## Success criteria
1. ACQ 게이트 ID 정본은 `rules/acq-gates.json` 하나이고, `test/acq-gate-ids.test.js`와 응답기는 존재하는 게이트 ID 집합을 그 파일에서만 얻는다. 게이트별 결정 구현 표와 정책 전용 legacy ID(`plan.activate_pointer`, `finalize.quiz`)는 ID 집합으로 보지 않는다.
2. `rules/acq.md`의 채팅 표시 골격은 제목 다음 줄에 `<!-- acq {...} -->` 판독 블록 한 줄을 요구하고, discovery open decisions 메시지에는 `{"kind":"open_decisions"}` 블록을 요구한다.
3. `bouncer finalize prepare` 성공 결과는 coordinator 원장이 있으면 `drive: { ready, tasks: [{ id, status, sha }] }`를, 없으면 `drive: null`을 싣는다. `ready`는 task가 하나 이상이고 모두 status가 `integrated`일 때만 `true`다. `pr` draft 출력은 바뀌지 않는다.
4. 판독 블록이 있는 텍스트 질문에서 응답기는 블록의 `gate`·`options`로 답하고, 블록 `options`와 본문 `- X)` 선택지 문자 배열이 순서까지 같지 않으면 답하지 않고 `text/contract-violation`으로 기록한다. 선택지 없는 자유 입력 게이트는 블록 `"options":[]`로 표시한다.
5. 판독 블록이 없는 텍스트 질문은 `rules/acq.md` 형식(제목의 카탈로그 게이트 ID와 `- X)` 줄 둘 이상)일 때만 답한다. 응답기에 게이트별 cue 정규식, `trailingQuestion`, `optionGroups`, `delegateOpenDecisions`가 남아 있지 않다.
6. 다섯 평가자 정책 각각에서 카탈로그 게이트마다 `bouncer_decisions` 항목이 있고, 그 `answer`는 `stop`이거나 응답기가 구현한 답이다. 하나라도 어긋나면 벤치마크 테스트가 실패한다. 응답기에 `LEDGER_001_FACTS`가 없고, `init.graphify_promotion`·`init.base_branch`·`plan.request`·`commit.next_task`는 정책에 선언된 답으로 응답한다.
7. 응답기와 `run-bouncer-full.cjs`는 drive 준비 판정에 `finalize prepare`의 `drive`만 쓰고 `.bouncer/runtime/coordinator.json`을 읽지 않는다.
8. 컨테이너에 설치된 플러그인 `package.json` 버전이 checkout 버전과 다르면 실행기가 에이전트 요청 전에 0이 아닌 코드로 끝나고, 같으면 그 버전이 `run.json` `plugin_version`에 기록된다.
9. 응답기가 답하지 못해 멈춘 텍스트 질문은 run 디렉터리 `unanswered/`에 질문 원문 `NN.md`와 `fixtures/acq/cases.json` 항목 형식의 `cases.json`(`reply: null`, `gates: []`)으로 남는다.
10. 변경한 TypeScript의 생성 JavaScript는 `npm run check:emit`을 통과하고, 새 `test/*.test.js`는 `test/tiers.json`에 배정되며, CHANGELOG `[Unreleased]`에 BP별 항목이 있고, `npm run ci`가 통과한다.

## Out of scope
- 1.5.6 light run 경로와 `coordinate status` checkpoint를 평가자 정책에 반영하는 일(`plan.light_scope` 답 변경 포함).
- 평가자 정책의 `approval_state` 변경. `fastify-001`은 `proposed`로 남는다. 정책 JSON 수정은 2026-10-11 사용자 승인(ledger-001 `task_facts` 명시, 미선언 `init.pre_commit_hook`의 `stop` 명시)에 한한다.
- `plan.activate_pointer`·`finalize.quiz`를 카탈로그에 넣는 일. 둘은 정책 전용 legacy 항목으로 남는다.
- Cursor host AskQuestion 사용 강제와 finalize quiz 응답 경로 변경.
- 유료 재측정과 `benchmarks/reports/` 기존 보고서 재계산.
- digest에 coordinator 원장 전체(`coordinator`, `integrationHead` 등)를 다시 싣는 일.

## Blueprints
* [001 ACQ 기계 판독 계약](blueprints/acq-machine-contract/index.md) - 게이트 카탈로그를 `rules/acq-gates.json`으로 옮기고 `rules/acq.md`·discovery에 판독 블록을, `finalize prepare`에 `drive` 요약을 더한다.
* [002 응답기 계약 기반 재작성](blueprints/responder-contract-rewrite/index.md) - `benchmarks/` 응답기·정책·실행기가 BP 001 계약만 읽게 바꾸고 버전 일치 검사와 멈춘 질문 보관을 더한다.

## Execution order
BP 001 → BP 002 순서로 실행한다. BP 002가 BP 001의 카탈로그 파일·판독 블록·`drive` 필드를 입력으로 쓰므로 BP 001 finalize 뒤에 시작한다. BP 사이 순서는 운영 순서이며 task `depends_on`에 다른 BP를 연결하지 않는다.
