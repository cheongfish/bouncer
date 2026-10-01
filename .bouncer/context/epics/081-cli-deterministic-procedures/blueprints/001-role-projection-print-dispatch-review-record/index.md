---
type: bouncer.blueprint
title: 역할 projection·print 디스패치·리뷰 기록 CLI
description: Add intent sections, dispatch print, and review record commands and point execution guidance at them
resource: .bouncer/context/epics/081-cli-deterministic-procedures/blueprints/001-role-projection-print-dispatch-review-record/index.md
tags:
  - bouncer
  - blueprint
  - cli
  - intent
  - dispatch
  - review
timestamp: '2026-10-01T12:55:01.897+09:00'
bouncer:
  id: '001'
  epic_id: '081'
  blueprint_id: '001'
  status: closed
  commit_type: feat
  scale: full
  review_scope: blueprint
  supersedes: []
---
# 001 역할 projection·print 디스패치·리뷰 기록 CLI

Epic: [081](../../index.md)

## Intent
역할별 `intent_sections`, Cursor print 디스패치, 리뷰 라운드 원장 기록을 각각 CLI 명령 하나로 실행하게 한다.
실행 지침은 손으로 조립하는 절차 대신 그 명령을 가리킨다.

## Contract
- 인터페이스
  - `bouncer intent sections --task <tasks.md> --role <implementer|reviewer|debugger> [--repo <dir>]`: read-only. 성공하면 `{ ok: true, role, bundle_id, revision, task_brief_hash, functions: [{ symbol, function_ref, explain, freshness, sections: [{ name, body }] }] }`를 낸다.
  - `bouncer dispatch print --role <implementer|reviewer|debugger|coordinator> --cwd <dir> --input <file> --out <dir> [--repo <dir>]`: foreground로 `agent --print`를 한 번 실행한다. 성공하면 `{ ok: true, role, model, exit_code, report, prompt, stdout, stderr }`를 낸다.
  - `bouncer review record --blueprint <dir> [--task <ddd>] --round <json> [--status <requested|addressed|accepted>] [--repo <dir>]`: 라운드 하나와 findings 갱신을 `review.md` frontmatter에 기록한다. 성공하면 `{ ok: true, path, round, status, findings }`를 낸다.
  - 세 명령 모두 운영 실패는 `{ ok: false, reason, cause, next }`와 exit 1, 잘못된 argv는 exit 2다.
- 데이터·상태
  - 역할별 절 집합: implementer는 Goal & intent·Current behavior·Target behavior·Interface·Touch·Constraints, reviewer·debugger는 Goal & intent·Interface·Touch·Constraints. Explain의 Background·Intuition·Code는 어느 역할에도 넣지 않는다.
  - intent bundle record와 cache 경로(`intentBundlePathFor`)는 바꾸지 않는다. `intent sections`는 읽기만 한다.
  - print prompt 파일과 stdout(`.jsonl`)·stderr(`.log`) 파일은 `--out` 디렉터리에 역할 이름으로 생긴다.
  - `review record`가 쓰는 파일은 `review_scope: blueprint`이면 blueprint 루트 `review.md`, 아니면 `tasks/<ddd>/review.md`다. status는 `--status`를 줬을 때만 바뀐다.
- 수용 기준: epic Success criteria 1~7.
- 검증 명령: 구현 task 001~003은 `npm test`, 종단 task 004는 `npm run ci`.
- 실패 모드·엣지 케이스
  - intent: bundle cache 없음, brief hash 불일치, Explain 절 hash 불일치이면 `ok: false`다. resolved이면서 historical이 아닌 함수가 하나도 없으면 `functions: []`인 `ok: true`다.
  - print: `subagents.provider`가 `cursor`가 아니거나 `subagents.dispatch`가 `print`가 아니면 실행 전에 `ok: false`다. `agent`가 PATH에 없거나, `agent status`가 exit 0이 아니거나 출력에 대소문자 무시 `not logged in`이 있어도 같다. payload가 `-`로 시작해도 `--` 뒤에 넘겨 옵션으로 읽히지 않는다.
  - review: 다음 번호가 아닌 round, 허용되지 않는 mode 순서, 대상 파일 없음, `review_scope`가 없는데 `--task` 누락, 열린 must_fix가 남은 채 `--status accepted`이면 파일을 바꾸지 않고 `ok: false`다.

## Out of scope
- epic Out of scope 전부.
- `scripts/src/lib/validate-sections.ts`·`scripts/src/lib/validate-gates.ts`의 검사 규칙과 gate 코드. 새 명령은 기존 검사를 호출만 한다.
- `scripts/src/lib/subagents.ts`의 model 해석 규칙, `scripts/src/lib/codex-agents.ts`의 TOML 변환.
- `benchmarks/` 하네스.

## One-commit justification
- task 3개가 각각 한 커밋이다. 셋 다 `scripts/src/lib/cli.ts` 명령 등록, `rules/cli.md`, `test/cli-help.test.js`, `agents/bouncer-coordinator.md`를 함께 고치므로 001 → 002 → 003 순서로 쌓아 한 PR로 리뷰한다.
- 세 명령은 같은 감사 항목(P2)의 결과물이고, 지침 변경도 같은 drive 절차(dispatch → review)를 따라 이어진다.

## Documents
* [001 역할별 intent sections](tasks/001/tasks.md) - bundle에서 역할별 Explain 절 본문을 내는 명령
* [002 print 디스패치 실행](tasks/002/tasks.md) - payload 조립·실행·report 추출 명령
* [003 리뷰 라운드 기록](tasks/003/tasks.md) - 검증된 round·findings를 review.md에 쓰는 명령
* [004 종단 검증](tasks/004/tasks.md) - 통합 뒤 전체 CI
* [Review](review.md) - 리뷰 발견사항
* [Context review](context-review.md) - 계획 문서 정합성 판정
