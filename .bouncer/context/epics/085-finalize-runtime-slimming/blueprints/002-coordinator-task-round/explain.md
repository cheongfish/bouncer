---
type: bouncer.explain
title: 002 explain
description: Explain for 002
resource: .bouncer/context/epics/085-finalize-runtime-slimming/blueprints/002-coordinator-task-round/explain.md
tags:
  - bouncer
  - explain
timestamp: '2026-10-02T18:02:45.994+09:00'
bouncer:
  id: EXPLAIN-002
  epic_id: '085'
  blueprint_id: '002'
  status: published
  comprehension:
    - range_from: 2e733b24cccd9d41eb82e86a0d243ce170f7608d
      range_to: ed88762ffb98a9188d6dc2d8eeb3aeb0886857a9
      diff_sha: 6dd2365b34877da0db57f527f163a2ae23f233b5859e3d82f74d263177a86974
      quiz_score: 2/3
      disposition: Q3는 종단 CI(`npm run ci`)를 TASKS-001 execute gate(`npm test`)와 혼동. 마감은 막지 않음.
      recorded_at: '2026-10-02T18:20:00+09:00'
  task_commits:
    - task: EPIC-085/BP-002/TASK-001
      sha: ed88762f
      intent_anchor: task-001
  coordinator:
    integration_branch: feat/085-002-coordinator-task-round
    tasks:
      - id: '001'
        branch: bouncer/085-002-001
        scope_revision: null
        actual_paths:
          - .codex/agents/bouncer-coordinator.toml
          - CHANGELOG.md
          - agents/bouncer-coordinator.md
          - skills/bouncer-execute/SKILL.md
          - test/agents.test.js
          - test/skill-bouncer-execute.test.js
      - id: '002'
        branch: null
        scope_revision: null
        actual_paths: []
---
# Explain

## Background
drive wave마다 새 coordinator 세션이 단독 실행용 `skills/bouncer-execute/SKILL.md`를 다시 읽던 비용을 줄이려 했다. `agents/bouncer-coordinator.md`에 회차 계약 절을 두고, execute 스킬은 그 절을 가리키기만 한다. CLI와 원장 형식은 그대로다.

## Intuition
한 task 회차의 정본은 execute 스킬이 아니라 coordinator `## Task round`다.

## Code
- `agents/bouncer-coordinator.md` — `## Task round`: intent bundle 한 번 고정, `coordinate revise` 뒤 bundle 재검증, verification 준비와 `--gate execute`. Procedure Drive는 이 절을 따른다. 문서 본문에 `skills/bouncer-execute/SKILL.md` 경로는 두지 않는다.
- `.codex/agents/bouncer-coordinator.toml` — `mdToCodexToml` 재생성본. worker 브랜치 `bouncer/085-002-001`, SHA `4b501b4c3e3e9b5e35bba923e3777bbfb4de9a7c`, integration `ed88762ffb98a9188d6dc2d8eeb3aeb0886857a9`.
- `skills/bouncer-execute/SKILL.md` — drive에서 coordinator가 이 스킬을 읽지 않고 `## Task round`를 따른다고 적는다.
- `test/agents.test.js`, `test/skill-bouncer-execute.test.js`, `CHANGELOG.md`.
- TASKS-001 1회차는 위 여섯 경로를 바꾸고 execute gate `npm test`를 통과했다. commit stamp 뒤 `stale-worker-report`로 2회차를 다시 열었고, HEAD가 이미 brief를 만족해 추가 소스 수정은 없었다. 범위 개정·repair wave 없음. `actualPaths`는 그 여섯 경로와 같다.
- TASKS-002는 worker 없이 `npm run ci`(exit 0).

## Quiz
1. drive 한 task 회차의 정본은 어디인가?
   - A) `skills/bouncer-execute/SKILL.md` 전체
   - B) `agents/bouncer-coordinator.md`의 `## Task round`
   - C) `skills/bouncer-run/SKILL.md` dispatch payload
2. `.codex/agents/bouncer-coordinator.toml`은 어떻게 만드는가?
   - A) `mdToCodexToml`로 markdown에서 재생성한다
   - B) TOML을 손으로 고친다
   - C) coordinator CLI가 런타임에 쓴다
3. 이 drive에서 TASKS-002가 돌린 종단 명령은?
   - A) `npm test`
   - B) `bouncer commit --yes`
   - C) `npm run ci`

## 이해 상태
출제 3문항, 응답 3문항, `quiz_score` 2/3. range `2e733b24cccd9d41eb82e86a0d243ce170f7608d`..`ed88762ffb98a9188d6dc2d8eeb3aeb0886857a9`, `diff_sha` `6dd2365b34877da0db57f527f163a2ae23f233b5859e3d82f74d263177a86974`.

1. 정답 B · 응답 B · 정
2. 정답 A · 응답 A · 정
3. 정답 C(`npm run ci`) · 응답 A(`npm test`) · 오 — TASKS-001 execute gate와 종단 CI를 혼동

disposition: Q3 혼동만 기록. 재시험 없음. 마감은 막지 않음.

## Tasks

### EPIC-085/BP-002/TASK-001 · `ed88762f`

#### Goal & intent

coordinator가 drive 세션에서 `skills/bouncer-execute/SKILL.md`를 읽지 않고, `agents/bouncer-coordinator.md`의 새 `## Task round` 절만으로 한 task 회차(intent bundle 고정, worker dispatch, verification, execute gate)를 진행하게 한다. 수용 기준은 epic 085 성공 조건 7이고 검증 명령은 `npm test`다.

#### Current behavior

- `agents/bouncer-coordinator.md` Procedure 3단계(`:225-235`)가 "Read `skills/bouncer-execute/SKILL.md` once per session for verify evidence and the execute gate; do not read it again for later tasks."라고 지시한다. 083-003 이후 wave마다 coordinator 세션이 새로 뜨므로 각 세션의 첫 task가 이 13.7KB 문서와 그것이 가리키는 `rules/current-pointer.md`·`rules/commit-scope.md`·`rules/output.md`·`rules/acq.md`·`references/*/index.md`를 다시 읽는다.
- coordinator가 그 문서에서 실제로 쓰는 계약은 셋이다.
  - step 1 "Intent bundle (resolve once)": `bouncer intent bundle --task <path> --symbol <name>...`을 한 번 돌려 `task_brief_hash`·`intent_bundle_id`·`intent_bundle_revision`을 고정하고, 역할별 payload에 `bouncer intent sections --task <path> --role <role>` 출력을 `intent_sections`로 싣는다. 실패하면 dispatch하지 않는다.
  - step 3 scope revision 뒤 재검증: `coordinate revise` 다음 새 `coordinate dispatch`, `bouncer intent bundle` 재호출, 해시가 같으면 revision 유지, 다르면 새 revision 고정.
  - step 4·6: 기존 `verification.md`를 준비하되 `## Command`·`## Evidence`·상태를 직접 쓰지 않고, 구현이 끝난 뒤 `tasks → verified`, worker cwd에서 `bouncer validate --blueprint <dir> --gate execute`가 통과할 때까지 고친다.
- `skills/bouncer-execute/SKILL.md`의 `**Controller.**` 문단(`:15-22`)은 drive에서 이 스킬이 coordinator가 돌리는 회차라고 적는다. 그 소유 주장은 Target에서 가리킴 문장으로 바뀌며, 기존 회차 소유 문장은 남기지 않는다.
- `.codex/agents/bouncer-coordinator.toml`은 `mdToCodexToml`(`scripts/lib/codex-agents.js`) 생성본이며 `test/agents.test.js:594-`와 `test/distribution.test.js:227-245`가 바이트 일치를 단언한다.
- `test/agents.test.js:841-850` `bouncer-coordinator Drive points at execute references and reads SKILL once`가 Procedure 3단계 안에 세 참조 경로와 `skills/bouncer-execute/SKILL.md ... once` 문장이 있음을 단언한다. 이 task가 지우는 문장을 고정하는 테스트다.
- 재현: `node --test test/agents.test.js test/skill-bouncer-execute.test.js test/distribution.test.js test/skill-bouncer-run.test.js`가 지금 통과한다.

#### Target behavior

- 성공
  - `agents/bouncer-coordinator.md`에 `## Task round` 절이 Worker dispatch와 Procedure 사이에 있고 위 세 계약을 담는다. 그 문서에 `skills/bouncer-execute/SKILL.md` 경로가 없다.
  - Procedure 3단계는 "run the task round in `## Task round`"로 그 절을 가리킨다. 세 execute 참조(`agent-dispatch.md`, `review-round.md`, `verification-recovery.md`) 안내는 남는다.
  - `skills/bouncer-execute/SKILL.md` Controller 문단에 "Under a drive the coordinator does not load this skill; it follows `agents/bouncer-coordinator.md` `## Task round`."가 있다.
  - `.codex/agents/bouncer-coordinator.toml`이 새 md의 `mdToCodexToml` 결과와 같다.
- 실패
  - `## Task round`에 scope revision 뒤 bundle 재검증 단계가 없으면 Interface의 `coordinate revise` 단언이 실패한다.
  - execute SKILL Controller 문단이 drive에서 `## Task round`를 따른다고 가리키지 않으면 Interface의 execute 단언이 실패한다.
- 보존
  - Controller 문단의 역할 순서 단언 문구(`bouncer-implementer`→verify→`bouncer-debugger`→`bouncer-implementer`→`bouncer-reviewer` 순서, `never plays those roles itself`, `returned to the coordinator`, `does not re-read the diff`)는 그대로다. drive 회차 소유를 이 스킬에 두는 기존 문장은 가리킴 문장으로 바뀐다.
  - 단독 `/bouncer-execute`의 step 1–6 절차와 문구는 바뀌지 않는다. 이 절차는 단독 실행용으로 남고, drive 회차의 정본은 `## Task round`다.
  - coordinator의 Hard guards, review 절차, 출력 계약, 재Read 금지 문장은 그대로다.

#### Interface

- 제공
  - `agents/bouncer-coordinator.md` `## Task round` — drive 회차 계약의 단일 정본.
  - 아래 테스트가 단언하는 문구가 계약이다.
  ```js
  const md = read('agents/bouncer-coordinator.md');
  assert.match(md, /^## Task round$/m);
  assert.doesNotMatch(md, /skills\/bouncer-execute\/SKILL\.md/);
  const round = md.slice(md.indexOf('## Task round'), md.indexOf('## Procedure'));
  assert.match(round, /bouncer intent bundle/);
  assert.match(round, /bouncer intent sections/);
  assert.match(round, /task_brief_hash/);
  assert.match(round, /intent_bundle_revision/);
  assert.match(round, /--gate execute/);
  assert.match(round, /never hand-write|do not write `## Command`/i);
  assert.match(round, /coordinate revise[\s\S]{0,240}bouncer intent bundle/);
  const exec = read('skills/bouncer-execute/SKILL.md');
  assert.match(exec, /does not load this skill[\s\S]{0,80}## Task round/);
  ```
- 거부: coordinator 문서에 `skills/bouncer-execute/SKILL.md` 경로가 있는 것, TOML을 생성 함수 밖에서 고치는 것.

#### Touch

| 경로 | 심볼 | 변경 | 현재 책임 | 계획한 변경 | 근거 |
| --- | --- | --- | --- | --- | --- |
| `agents/bouncer-coordinator.md` | `## Task round`(신규 절), Procedure 3단계 | Modify | execute SKILL을 세션마다 읽게 함 | 회차 계약 절 추가, 문서에서 `skills/bouncer-execute/SKILL.md` 경로 삭제 | 회차 계약의 새 정본 |
| `.codex/agents/bouncer-coordinator.toml` | 생성본 전체 | Modify | 옛 md의 생성본 | 새 md에서 `mdToCodexToml`로 재생성 | 바이트 패리티 테스트 |
| `skills/bouncer-execute/SKILL.md` | `**Controller.**` 문단 | Modify | drive 회차를 이 스킬이 맡는다고 적음 | 그 소유 문장을 coordinator `## Task round` 가리킴 문장으로 바꾸고, 역할 순서 단언은 유지 | 정본이 두 곳으로 갈라지지 않게 함 |
| `test/agents.test.js` | coordinator 문서 단언, `bouncer-coordinator Drive points at execute references and reads SKILL once`(`:841-850`) | Modify | 회차 계약 절 단언 없음, SKILL once 문장 고정 | Interface의 coordinator 단언 추가, `:841-850` 테스트를 "Drive가 세 참조 경로와 `## Task round`를 가리키고 SKILL.md를 가리키지 않는다"로 교체 | 지우는 문장을 고정한 기존 테스트와 새 계약 검증 지점 |
| `test/skill-bouncer-execute.test.js` | Controller 문단 단언 | Modify | coordinator 절 가리킴 단언 없음 | Interface의 execute 단언 추가 | 계약 검증 지점 |
| `CHANGELOG.md` | `[Unreleased]` | Modify | 항목 없음 | Changed 항목 추가 | 프로젝트 변경 이력 규칙 |

#### Constraints

- `.codex/agents/bouncer-coordinator.toml`은 손으로 고치지 않는다. 아래 명령으로만 만든다.
  ```bash
  npm run build
  node -e 'const fs=require("fs");const {mdToCodexToml}=require("./scripts/lib/codex-agents");fs.writeFileSync(".codex/agents/bouncer-coordinator.toml",mdToCodexToml(fs.readFileSync("agents/bouncer-coordinator.md","utf8")))'
  ```
- `## Task round`는 execute SKILL 문장을 통째로 옮기지 않는다. drive에서 coordinator가 쓰는 세 계약만 담고, 단독 실행 전용 내용(`bouncer current` 처리, `execute prepare`, light inline 분기, `/bouncer-plan` 복귀 안내)은 넣지 않는다.
- 기존 테스트가 단언하는 coordinator 문구(`coordinate dispatch`, `previous_outcome`, `--ledger-path <checkpoint.ledger.path>`, `review-dispatch execute`, `rules/commit-scope.md` 등)를 지우지 않는다. 예외는 `test/agents.test.js:841-850`이 고정한 "SKILL.md once" 문장 하나이며, 그 테스트는 이 task에서 교체한다.

### EPIC-085/BP-002/TASK-002

#### Goal & intent

TASKS-001이 통합된 integration head에서 CI 전체(`check:emit`, coverage, eslint, `lint:docs`, `lint:context-comments`, typecheck, audit)가 통과함을 증명한다. 수용 기준은 epic 085 성공 조건 9다.

#### Interface

- 제공: 선행 task가 통합된 상태에서 verify 명령이 남기는 종단 검증 증적.
- 거부: source 변경, review 문서, commit.

#### Touch

Source 변경 경로 없음.
