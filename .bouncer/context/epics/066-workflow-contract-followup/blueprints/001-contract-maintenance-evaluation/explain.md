---
type: bouncer.explain
title: 001 explain
description: Explain for 001
resource: .bouncer/context/epics/066-workflow-contract-followup/blueprints/001-contract-maintenance-evaluation/explain.md
tags:
  - bouncer
  - explain
timestamp: '2026-09-06T15:56:22.327+09:00'
bouncer:
  id: EXPLAIN-001
  epic_id: '066'
  blueprint_id: '001'
  status: published
  comprehension:
    - range_from: develop
      range_to: cd602f3317ba214f8c38c2e74ff7c5135604f4f6
      diff_sha: 995e75a7dbc70092aaf53e2095cb74d2accb719483f55d7822f1b2b4bb82196e
      quiz_score: 4/4
      disposition: 사본 일치, 입증된 skill만 정비, context는 advisory라는 세 커밋의 경계를 맞췄다.
      recorded_at: '2026-09-06T15:58:04+09:00'
  task_commits:
    - id: '001'
      sha: 3d8fd275
    - id: '002'
      sha: 9ae126c3
    - id: '003'
      sha: cd602f33
---
# Explain

## Background

선행 계약 후속 검증에서 세 가지가 빠져 있었다. Codex implementer 사본이 Markdown 정본과 어긋나면 compact named payload의 전제가 깨진다. 여섯 진입 skill이 조건부 helper를 번호 단계 앞에 두면 기본 경로 비용이 커진다. context 검색이 범위를 승인하는 것처럼 읽히면 G4와 `affected_paths` 확인이 흔들린다. 이 브랜치는 CLI·validator·ranking 구현은 건드리지 않고, 사본 일치·측정된 skill 정비·고정 corpus 재실행 권고만 커밋 세 개로 남긴다.

## Intuition

정본은 한 곳, 수치는 같은 표, context는 조언일 뿐 승인 권한이 없다.

## Code

- `agents/bouncer-implementer.md` → `.codex/agents/bouncer-implementer.toml` (`mdToCodexToml`, `# bouncer-generated`). 회귀는 `test/agents.test.js`. `.gitignore`는 `.codex/`를 유지한 채 그 TOML만 재포함한다.
- 측정 정의와 전후 표는 `docs/workflow-contract.md`. 입증된 정비는 `skills/bouncer-plan/SKILL.md`(step 6 `minimality`, step 7 `context-review`)와 `skills/bouncer-execute/SKILL.md`(verify-failure의 `debugging`). 열 잠금은 `test/skill-bouncer-surface.test.js`.
- 재실행 값과 advisory 유지는 `docs/graphify-context-contribution.md`. fixture는 `test/fixtures/graph-search-quality.json`, 단언은 `test/graph-search.test.js`.

## Quiz

1. implementer 사본을 커밋 가능하게 만든 방법은?
   - A) `bouncer commit`이 `git add -f`를 쓰게 바꿨다
   - B) `.codex/` ignore는 두고 `!.codex/agents/bouncer-implementer.toml`만 재포함했다
   - C) 모든 `.codex/agents/*.toml`을 추적하게 열었다

2. Task 002가 skill 본문을 고친 조건은?
   - A) 구조 테스트가 기존 문서에서 예상한 이유로 실패한 skill만 정비했다
   - B) 단어 수가 기준선보다 큰 skill은 모두 줄였다
   - C) 여섯 skill의 번호 단계를 공통 reference로 옮겼다

3. compact named implementer payload를 쓰는 조건은?
   - A) 이전 task 대화와 Distill shard를 함께 실을 때
   - B) TOML이 없거나 사용자 소유일 때
   - C) 로컬 TOML이 `# bouncer-generated`로 시작하고 Markdown 변환 결과와 byte-for-byte 일치할 때

4. 고정 corpus 재실행 후 context 검색 정책 권고는?
   - A) extra_paths가 0이어도 ranking 가중치를 올렸다
   - B) 현 advisory 역할을 유지하고, context만으로 `affected_paths`를 승인하지 않는다
   - C) 사후 self-hit `1/2`를 pre-scaffold 실패로 합산해 필터를 바꿨다

## 이해 상태

질문 4, 응답 4, 정답 4. `quiz_score` `4/4`.

1. 정답 B. 응답 B. 맞음. `.codex/` ignore를 유지한 채 implementer TOML만 재포함했다.
2. 정답 A. 응답 A. 맞음. 구조 테스트가 실패한 skill만 정비했다.
3. 정답 C. 응답 C. 맞음. generated marker와 byte-for-byte 일치일 때만 compact payload를 쓴다.
4. 정답 B. 응답 B. 맞음. context는 advisory로 남기고 `affected_paths` 승인 권한이 없다.

disposition: 사본 일치, 입증된 skill만 정비, context는 advisory라는 세 커밋의 경계를 맞췄다.

## Tasks

### Task 001

#### Goal & intent

현재 일치하는 implementer Markdown 정본과 Codex TOML 사본의 byte-for-byte 정합성을 결정론적 테스트로 고정한다. `.codex/` ignore는 유지한 채 그 TOML만 재포함해 `bouncer commit`의 `git add --`가 스테이징할 수 있게 한다.

#### Interface

- 제공: `mdToCodexToml(agents/bouncer-implementer.md)` 결과와 `.codex/agents/bouncer-implementer.toml`의 완전 일치를 단언한다. 해당 TOML은 ignore 예외로 추적 가능해야 한다.
- 거부: marker 부재, 내용 불일치, 기존 실행 agent 재사용, 다른 `.codex/` 파일 추적, 커밋 CLI를 `git add -f`로 바꾸는 경로.

#### Do not touch

- `agents/bouncer-implementer.md` — 현재 역할 정본은 변경하지 않는다.
- `.codex/agents/bouncer-reviewer.toml` — 발견된 별도 불일치는 이번 task 범위가 아니다.
- `skills/bouncer-execute/references/agent-dispatch.md` — exact-match와 fallback 계약은 이미 구현돼 있다.
- `scripts/src/lib/finalize.ts` — 커밋 스테이징을 `git add -f`로 바꾸지 않는다.

### Task 002

#### Goal & intent

여섯 진입 workflow skill을 동일 기준으로 측정한다. 계약 중복, 여러 파일의 동시 수정 부담, 기본 경로가 읽는 불필요한 조건부 절차 중 하나를 회귀 테스트로 입증한 skill만 정비하고 나머지는 측정값과 무변경 이유를 남긴다.

#### Interface

- 제공: `bouncer-init`, `bouncer-plan`, `bouncer-execute`, `bouncer-commit`, `bouncer-run`, `bouncer-finalize`에 같은 측정표를 적용하고, 변경한 skill마다 소유 규칙·조건부 reference·회귀 테스트를 연결한다.
- 거부: 총 줄 수나 단어 수 감소만으로 정비를 정당화하지 않는다. ACQ, gate, trust boundary, scope 계약을 삭제하거나 새 reference와 dependency를 만들어 수치를 낮추지 않는다.

#### Do not touch

- `CLAUDE.md` — trust boundary와 session 규칙의 정본은 바꾸지 않는다.
- `rules/` — 공통 계약을 이 task의 측정 결과에 맞춰 바꾸지 않는다.
- `references/` — 새 추상화나 reference 이동으로 문서 수치를 낮추지 않는다.
- `scripts/` — CLI와 validator 동작은 범위 밖이다.
- `agents/` — named agent 역할 정본은 Task 001의 검증 대상일 뿐 이 task에서 수정하지 않는다.

### Task 003

#### Goal & intent

기존 고정 corpus와 현재 초안 self-hit 실패 fixture를 재실행해 source·test 기준선과 context 보강 결과를 비교한다. 결과로 현 advisory 역할 유지 여부를 권고하되 ranking 계약과 workflow는 변경하지 않는다.

#### Interface

- 제공: 사례별 추가 발견 경로 수, top-k=3 recall, 오추천 수, current-draft self-hit 비율과 정책 판정을 한 문서에 기록한다.
- 거부: context 결과만으로 G4 품질이나 `affected_paths`를 승인하지 않는다. 측정이 임계치를 어겨도 점수·필터·실행 순서를 이 task에서 수정하지 않는다.

#### Do not touch

- `test/fixtures/graph-search-quality.json` — 기존 고정 corpus와 임계치를 결과에 맞춰 바꾸지 않는다.
- `test/graph-search.test.js` — 기존 측정 및 self-hit 실패 단언을 수정하지 않는다.
- `scripts/src/lib/graph-search.ts` — ranking 구현은 별도 계획 대상이다.
- `references/graphify-runner/index.md` — workflow 정책은 측정 결과만으로 이 task에서 바꾸지 않는다.
## Goal & intent
현재 일치하는 implementer Markdown 정본과 Codex TOML 사본의 byte-for-byte 정합성을 결정론적 테스트로 고정한다. `.codex/` ignore는 유지한 채 그 TOML만 재포함해 `bouncer commit`의 `git add --`가 스테이징할 수 있게 한다.

## Interface
- 제공: `mdToCodexToml(agents/bouncer-implementer.md)` 결과와 `.codex/agents/bouncer-implementer.toml`의 완전 일치를 단언한다. 해당 TOML은 ignore 예외로 추적 가능해야 한다.
- 거부: marker 부재, 내용 불일치, 기존 실행 agent 재사용, 다른 `.codex/` 파일 추적, 커밋 CLI를 `git add -f`로 바꾸는 경로.

## Do not touch
- `agents/bouncer-implementer.md` — 현재 역할 정본은 변경하지 않는다.
- `.codex/agents/bouncer-reviewer.toml` — 발견된 별도 불일치는 이번 task 범위가 아니다.
- `skills/bouncer-execute/references/agent-dispatch.md` — exact-match와 fallback 계약은 이미 구현돼 있다.
- `scripts/src/lib/finalize.ts` — 커밋 스테이징을 `git add -f`로 바꾸지 않는다.

### Task 002

## Goal & intent
여섯 진입 workflow skill을 동일 기준으로 측정한다. 계약 중복, 여러 파일의 동시 수정 부담, 기본 경로가 읽는 불필요한 조건부 절차 중 하나를 회귀 테스트로 입증한 skill만 정비하고 나머지는 측정값과 무변경 이유를 남긴다.

## Interface
- 제공: `bouncer-init`, `bouncer-plan`, `bouncer-execute`, `bouncer-commit`, `bouncer-run`, `bouncer-finalize`에 같은 측정표를 적용하고, 변경한 skill마다 소유 규칙·조건부 reference·회귀 테스트를 연결한다.
- 거부: 총 줄 수나 단어 수 감소만으로 정비를 정당화하지 않는다. ACQ, gate, trust boundary, scope 계약을 삭제하거나 새 reference와 dependency를 만들어 수치를 낮추지 않는다.

## Do not touch
- `CLAUDE.md` — trust boundary와 session 규칙의 정본은 바꾸지 않는다.
- `rules/` — 공통 계약을 이 task의 측정 결과에 맞춰 바꾸지 않는다.
- `references/` — 새 추상화나 reference 이동으로 문서 수치를 낮추지 않는다.
- `scripts/` — CLI와 validator 동작은 범위 밖이다.
- `agents/` — named agent 역할 정본은 Task 001의 검증 대상일 뿐 이 task에서 수정하지 않는다.

### Task 003

## Goal & intent
기존 고정 corpus와 현재 초안 self-hit 실패 fixture를 재실행해 source·test 기준선과 context 보강 결과를 비교한다. 결과로 현 advisory 역할 유지 여부를 권고하되 ranking 계약과 workflow는 변경하지 않는다.

## Interface
- 제공: 사례별 추가 발견 경로 수, top-k=3 recall, 오추천 수, current-draft self-hit 비율과 정책 판정을 한 문서에 기록한다.
- 거부: context 결과만으로 G4 품질이나 `affected_paths`를 승인하지 않는다. 측정이 임계치를 어겨도 점수·필터·실행 순서를 이 task에서 수정하지 않는다.

## Do not touch
- `test/fixtures/graph-search-quality.json` — 기존 고정 corpus와 임계치를 결과에 맞춰 바꾸지 않는다.
- `test/graph-search.test.js` — 기존 측정 및 self-hit 실패 단언을 수정하지 않는다.
- `scripts/src/lib/graph-search.ts` — ranking 구현은 별도 계획 대상이다.
- `references/graphify-runner/index.md` — workflow 정책은 측정 결과만으로 이 task에서 바꾸지 않는다.
