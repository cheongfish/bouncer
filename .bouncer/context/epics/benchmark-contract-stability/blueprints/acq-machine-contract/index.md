---
type: bouncer.blueprint
title: ACQ 게이트 카탈로그와 판독 블록, finalize drive 요약 계약
description: Move the ACQ gate catalog to rules/acq-gates.json, require a machine-readable acq block in chat displays, and add a drive summary to finalize prepare.
resource: .bouncer/context/epics/benchmark-contract-stability/blueprints/acq-machine-contract/index.md
tags:
  - bouncer
  - blueprint
  - acq
  - finalize
  - benchmark
timestamp: '2026-10-11T17:10:47.913+09:00'
bouncer:
  id: acq-machine-contract
  epic_id: benchmark-contract-stability
  blueprint_id: acq-machine-contract
  status: closed
  order: 1
  commit_type: feat
  scale: full
  review_scope: blueprint
  supersedes: []
---
# 001 ACQ 게이트 카탈로그와 판독 블록, finalize drive 요약 계약

Epic: [093](../../index.md)

## Intent
- 게이트 ID 목록은 테스트 상수에만 있고 ACQ 채팅 표시와 drive 상태는 기계가 읽을 계약이 없어 벤치마크 응답기가 문장을 추측했음.
- 게이트 카탈로그를 데이터 파일로 옮기고 ACQ 표시에 판독 블록을, `finalize prepare`에 drive 요약을 더해 외부 소비자가 읽을 계약을 제공함.

## Contract
- 인터페이스:
  - `rules/acq-gates.json`: workflow 이름별 게이트 ID 배열. 제품 테스트와 BP 002 응답기가 읽는 유일한 목록이다.
  - `rules/acq.md` 채팅 표시: 제목 `**AskUserQuestion — <gate-id>**` 바로 다음 줄에 판독 블록 한 줄을 둔다. 선택지 없는 자유 입력 게이트(`plan.request`)는 `"options":[]`, `"recommended":null`이다. discovery open decisions 메시지는 질문 목록 앞에 `kind` 블록을 둔다. host UI(`AskUserQuestion`/`AskQuestion`)에는 블록을 두지 않는다.
  - `bouncer finalize prepare` 성공 결과에 최상위 `drive`가 생긴다. `pr` 입력 본문과 출력은 바뀌지 않는다.
- 데이터·상태:

  ```text
  rules/acq-gates.json  { "version": 1, "workflows": { "bouncer-init": ["init.graphify_promotion", ...], ... } }
  ACQ 블록             <!-- acq {"gate":"plan.discovery","options":["A","B","C"],"recommended":"A"} -->
  자유 입력 블록       <!-- acq {"gate":"plan.request","options":[],"recommended":null} -->
  open decisions 블록  <!-- acq {"kind":"open_decisions"} -->
  finalize prepare     drive: { ready: boolean, tasks: [{ id: string, status: string|null, sha: string|null }] } | null
  ```

- 수용 기준: 에픽 Success criteria 1(카탈로그 파일과 제품 테스트 쪽), 2, 3, 10(BP 001 CHANGELOG 항목과 `npm run ci`). 기준 1의 응답기 쪽은 BP 002가 맡는다.
- 검증 명령: `npm run ci`.
- 실패 모드·엣지 케이스:
  - 카탈로그 JSON과 어느 skill의 `## ACQ (AskUserQuestion) gates` 색인이 다르면 `test/acq-gate-ids.test.js`가 실패한다.
  - 한 display에 게이트 둘을 묶지 않는 기존 규칙은 그대로다. `(1/2)`·`(2/2)` display는 각자 블록을 가진다.
  - 원장이 없는 standalone finalize는 `drive: null`이다. 깨진 원장은 지금처럼 `coordinator-ledger`로 거절된다.
  - 원장 task에 status가 없거나 `integrated`가 아니면 `ready: false`다. task가 0개여도 `ready: false`다.
  - `execute-prepare`가 이미 boolean `drive` 키를 쓰지만 다른 명령의 결과이므로 이름 충돌로 보지 않는다.

## Out of scope
- `benchmarks/` 아래 모든 변경(BP 002).
- digest에 `coordinator`·`integrationHead` 같은 원장 필드를 다시 싣는 일.
- 게이트 추가·삭제·ID 변경과 각 workflow의 게이트 실행 시점 변경.
- 판독 블록 존재를 검사하는 게이트나 CLI 추가.

## One-commit justification
- 세 변경 모두 외부 소비자에게 내놓는 읽기 전용 계약이고, 리뷰어는 "카탈로그 이동과 표시·출력 추가가 기존 게이트 동작과 PR draft를 바꾸지 않는다"를 한 PR에서 판단한다. task 두 개는 rules·skills 문서 계약과 finalize CLI 출력으로 나뉜다.

## Documents
* [Tasks 001](tasks/001/tasks.md) - 게이트 카탈로그 데이터 파일과 ACQ 판독 블록 규칙
* [Tasks 002](tasks/002/tasks.md) - `finalize prepare` drive 요약과 CHANGELOG
* [Review](review.md) - 리뷰 발견사항
* [Context review](context-review.md) - 계획 문서 정합성 판정
