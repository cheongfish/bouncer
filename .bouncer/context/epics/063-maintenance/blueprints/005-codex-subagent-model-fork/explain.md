---
type: bouncer.explain
title: 005 explain
description: Explain for 005
resource: .bouncer/context/epics/063-maintenance/blueprints/005-codex-subagent-model-fork/explain.md
tags:
  - bouncer
  - explain
timestamp: '2026-10-13T22:03:51.784+09:00'
bouncer:
  id: EXPLAIN-005
  epic_id: '063'
  blueprint_id: '005'
  status: published
  comprehension:
    - range_from: 6204600c302e2d332d1736974c38a5717b9e67c0
      range_to: 3e89165b7542a280ff4741ed28a6bf5ba22d859b
      diff_sha: 2c96ca120b169a1f770fa370a164797ad3c12b39793df5759c237c593e49ce72
      recorded_at: '2026-10-13T22:10:00+09:00'
  task_commits:
    - task: EPIC-063/BP-005/TASK-001
      sha: a9a7a484
      intent_anchor: task-001
---
# Explain

## Background

Codex는 전체 대화를 이어받는 fork 호출에 `model` 지정을 받지 않는다. 공통 규칙 `rules/subagent-model.md`가 이 조건을 말하지 않아, `config.json`에 역할별 모델을 적어도 run·execute 경로에서는 부모 모델로 돌았다. 이 변경은 규칙에 그 조건을 명시하고, 사용자가 `subagents.<provider>.<role>`에 복사할 모델 slug 목록을 예제 설정에 둔다.

## Intuition

택배에 "원본 그대로 복사본"이라는 스티커가 붙으면 수령인을 바꿀 수 없다. 모델을 바꾸려면 `fork_turns: "none"`으로 스티커를 떼야 한다.

## Code

- `rules/subagent-model.md` 1번 항목: Codex에서 slug를 넘기면 같은 호출에 `fork_turns: "none"`을 지정한다. 출력이 `inherit`이면 `model`만 생략하고 `fork_turns`는 호출 워크플로가 정한다. 3번 항목의 slug 거절 시 `inherit` 1회 재시도는 그대로다.
- `test/subagents.test.js`: 1번 항목에 Codex, `fork_turns: "none"`, slug 조건이 함께 있는지 고정하는 계약 테스트.
- `config.example.json`: 최상위 `_models`에 codex·cursor·claude 모델 목록을 둔다. cursor 목록은 Cursor 자체 모델(grok 4.7/4.6/4.5, composer-2.5)만 담고, Cursor에서 Claude·GPT를 쓰려면 다른 목록 slug에 `-high`를 붙인다. resolver는 `subagents`만 읽으므로 동작은 바뀌지 않는다.

## 변경 전후

| 항목 | 변경 전 | 변경 후 |
| --- | --- | --- |
| Codex에서 slug를 넘길 때의 호출 규칙 (`rules/subagent-model.md` 1번) | 규칙에 조건이 없어 역할별 모델이 적용되지 않을 수 있었음 (변경 전 결과 미관측) | 같은 호출에 `fork_turns: "none"`을 함께 지정 |
| 출력이 `inherit`일 때 | `model`만 생략 | 동일. `fork_turns`는 호출 워크플로가 정함 |
| slug 거절 시 | `inherit`로 1회 재시도 | 동일 (바뀌지 않음) |
| 계약 테스트 (`test/subagents.test.js`) | 해당 조건을 고정하는 테스트 없음 | Codex·`fork_turns: "none"`·slug 조건을 단언하는 테스트 추가 |
| 예제 설정 (`config.example.json`) | 모델 slug 목록 없음 | `_models`에 codex·cursor·claude 목록 추가. resolver는 `subagents`만 읽으므로 동작 불변 |

## Quiz

1. Codex에서 `bouncer subagent-model`이 slug를 출력하면 named dispatch는 어떻게 호출해야 하는가?
   - A) `model`만 넘기고 `fork_turns`는 기본값을 쓴다.
   - B) `model`과 함께 `fork_turns: "none"`을 지정한다.
   - C) `model`을 생략하고 `fork_turns: "none"`만 지정한다.

## Tasks

### EPIC-063/BP-005/TASK-001 · `a9a7a484`

#### Goal & intent

Codex 호스트에서 `bouncer subagent-model`이 slug를 내면, named dispatch가 `fork_turns: "none"`과 그 `model`을 함께 넘겨 config의 역할별 모델로 실행된다. 출력이 `inherit`이면 `model`만 생략하는 기존 상속 동작을 유지하고, 그때 `fork_turns`는 호출 워크플로가 정한 값을 따른다(plan의 context-review·evidence dispatch는 이미 `"none"`). Claude Code·Cursor 호출과 slug 거절 시 `inherit` 1회 재시도(3번 항목)는 바뀌지 않는다.
사용자는 `config.example.json`의 `_models` 목록에서 프로바이더별 모델 slug를 성능 순으로 골라 `subagents.<provider>.<role>`에 복사할 수 있다.

#### Touch

- Modify `rules/subagent-model.md` — 1번 항목에 Codex 한정으로 slug 전달 시 `fork_turns: "none"`을 함께 지정하는 문장을 추가한다.
- Modify `test/subagents.test.js` — 1번 항목이 Codex·`fork_turns: "none"`·slug 조건을 함께 담는지 고정하는 계약 테스트를 추가한다.
- Modify `config.example.json` — 최상위 `_models`에 codex·cursor·claude별 모델 slug 배열(성능 순, 최대 6개, 2026-10-13 기준)과 `_comment` 안내 한 줄을 추가한다. resolver는 `subagents.<provider>`만 읽으므로 동작은 바뀌지 않는다.
