---
type: bouncer.blueprint
title: 벤치마크 응답기의 계약 기반 재작성
description: Rewrite the benchmark responder, evaluator policies, and runners to read only the BP 001 contracts, with plugin version checks and stopped-question capture.
resource: .bouncer/context/epics/093-benchmark-contract-stability/blueprints/002-responder-contract-rewrite/index.md
tags:
  - bouncer
  - blueprint
  - benchmark
  - harness
  - acq
timestamp: '2026-10-11T17:10:48.010+09:00'
bouncer:
  id: '002'
  epic_id: '093'
  blueprint_id: '002'
  status: closed
  commit_type: refactor
  scale: full
  review_scope: blueprint
  supersedes: []
---
# 002 벤치마크 응답기의 계약 기반 재작성

Epic: [093](../../index.md)

## Intent
- 응답기는 게이트별 cue 정규식과 legacy 경로로 채팅 문장을 추측하고 coordinator 원장을 직접 읽어 제품 버전이나 모델 문구가 바뀔 때마다 고쳐졌음.
- 응답기·정책·실행기가 BP 001의 카탈로그·판독 블록·drive 요약만 읽고 계약 밖 질문은 멈추며, 버전 불일치와 멈춘 질문을 실행 기록으로 남기게 함.

## Contract
- 인터페이스:
  - `benchmarks/acp/responder.cjs` `answerTextQuestion(policy, phase, text, workDir, deps)`의 반환 shape(`{ gate, choices, question, reply } | null`)는 유지한다. 판독 실패 이유는 새 export `readTextQuestions(text, catalog)`가 `{ questions } | { violation }`으로 알린다.
  - 실행기 `decisions.json` `unanswered[].method`의 `text/unread-question`·`text/unrecognized-question`은 `text/contract-violation`(이유 `reason` 포함) 하나로 합쳐진다. 블록·엄격 형식이 없는데 `AskUserQuestion` 문구나 `- X)` 선택지 줄 둘 이상이 있는 턴이 여기에 해당한다. `decisions[].method` `text/OpenDecisions`는 이름을 유지하고 판정만 `kind` 블록으로 바뀐다.
  - stage `run.json`과 `run-cursor` `run.json`의 `plugin_version`은 이미지 안 플러그인 `package.json` 값이다.
- 데이터·상태:

  ```text
  질문 판독 순서   블록(<!-- acq {...} -->) → rules/acq.md 엄격 형식(카탈로그 ID 제목 + "- X)" 둘 이상) → violation
  자유 입력 질문   블록 options [] + 본문 "- X)" 없음 → 게이트 decide가 replyText를 주면 답, 아니면 멈춤
  정책 커버리지    카탈로그 게이트마다 bouncer_decisions 항목, answer는 "stop" 또는 응답기 구현 답
  멈춘 질문 보관   <runDir>/unanswered/NN.md + <runDir>/unanswered/cases.json [{ file, source, phase, workdir:{}, reply:null, gates:[], expect:null, method, reason? }]
  ```

- 수용 기준: 에픽 Success criteria 1(응답기 쪽), 4–9, 10(BP 002 CHANGELOG 항목과 `npm run ci`).
- 검증 명령: `npm run ci`.
- 실패 모드·엣지 케이스:
  - 블록 JSON 파싱 실패, 카탈로그에 없는 `gate`, 블록 `options`와 본문 `- X)` 문자 불일치 → violation으로 멈춘다.
  - 한 턴에 질문이 여럿이면 각 질문이 블록이나 엄격 형식을 가져야 하고, 하나라도 답하지 못하면 턴 전체를 멈춘다.
  - 문장 안에 이어 붙은 미리보기 제목(`... **AskUserQuestion — plan.discovery**로 확정`)은 질문으로 세지 않는다.
  - host `cursor/ask_question`과 finalize quiz 경로는 블록 없이 지금처럼 답한다.
  - standalone finalize는 `drive: null`이라 `finalize.remainder`에서 멈춘다.
  - 이미지 플러그인 버전을 읽지 못해도 버전 불일치와 같이 유료 요청 전에 멈춘다.
  - vanilla 조건은 bouncer 이미지를 쓰지 않으므로 `plugin_version: null`로 둔다.

## Out of scope
- `rules/`, `skills/`, `references/`, `scripts/` 제품 변경(BP 001).
- 정책 `approval_state` 변경과 fastify-001 승인.
- `plan.activate_pointer`·`finalize.quiz`의 카탈로그 편입.
- 유료 재측정, `benchmarks/reports/` 재계산, `score-archived-run.cjs` 채점 규칙 변경.
- 1.5.6 light run 경로 정책 반영.

## One-commit justification
- 세 task가 모두 "응답기가 계약만 읽는다"는 같은 기준으로 `benchmarks/` 하네스를 바꾸고, 리뷰어는 fixture 재생 결과로 답한 질문·멈춘 질문의 경계를 한 PR에서 판단한다. task는 질문 판독, 정책 데이터화, drive·버전·보관으로 나뉘며 같은 `responder.cjs`를 순서대로 고친다.

## Documents
* [Tasks 001](tasks/001/tasks.md) - 판독 블록·엄격 형식 기반 질문 판독과 휴리스틱 제거
* [Tasks 002](tasks/002/tasks.md) - 정책 데이터화, 미구현 게이트 응답, 카탈로그 커버리지 테스트
* [Tasks 003](tasks/003/tasks.md) - drive 요약 사용, 플러그인 버전 검사, 멈춘 질문 보관
* [Review](review.md) - 리뷰 발견사항
* [Context review](context-review.md) - 계획 문서 정합성 판정
