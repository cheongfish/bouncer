---
type: bouncer.explain
title: 004 explain
description: Explain for 004
resource: .bouncer/context/epics/085-finalize-runtime-slimming/blueprints/004-plan-evidence-dispatch/explain.md
tags:
  - bouncer
  - explain
timestamp: '2026-10-06T09:00:28.613+09:00'
bouncer:
  id: EXPLAIN-004
  epic_id: '085'
  blueprint_id: '004'
  status: published
  comprehension:
    - range_from: 1f973c5b0aabd1e1ff78ee3dfc39251f0fd7adce
      range_to: 579cd5355a6c4adf5a39fa2da2a05884a8f9ea8b
      diff_sha: 881501d453c899de8e0419a4ae0f69a81eb13f160ab3311e9c6c4305eea06f7c
      quiz_score: 3/3
      disposition: 세 문항 모두 정답.
      recorded_at: '2026-10-06T09:15:00+09:00'
  task_commits:
    - task: EPIC-085/BP-004/TASK-001
      sha: 579cd535
      intent_anchor: task-001
  coordinator:
    integration_branch: feat/085-004-plan-evidence-dispatch
    tasks:
      - id: '001'
        branch: bouncer/085-004-001
        scope_revision: null
        actual_paths:
          - CHANGELOG.md
          - docs/architecture/rule-ownership.md
          - skills/bouncer-plan/SKILL.md
          - test/skill-bouncer-plan.test.js
          - test/skill-bouncer-surface.test.js
          - skills/bouncer-plan/references/evidence-dispatch.md
      - id: '002'
        branch: null
        scope_revision: null
        actual_paths: []
---
# Explain

## Background

full blueprint를 `/bouncer-plan` step 3에서 쓸 때, commit task마다 Current behavior 근거를 컨트롤러가 직접 읽으면 그 코드가 세션 문맥에 쌓인다. 이 드라이브는 그 탐색을 task당 generic 읽기 전용 subagent 한 번에 넘기고, 컨트롤러는 보고 네 필드만으로 본문을 쓰게 했다. CLI·게이트·named role은 그대로다.

드라이브는 001을 worker `bouncer/085-004-001` SHA `c57c418bc548a2314fbdc20accf1396d05611d97`로 커밋한 뒤 integration `579cd5355a6c4adf5a39fa2da2a05884a8f9ea8b`로 fan-in했다. 002 `npm run ci`는 review.md 스캐폴드 HTML 주석 때문에 한 번 실패했고, 사용자가 주석을 지운 뒤 `verification-retry`로 `terminalFailure`만 지우고 재실행해 통과했다. repair wave는 없다. DAG는 `001 → 002` 그대로다. 001 `actualPaths`는 승인 `affected_paths`와 같다.

## Intuition

task 근거 수집을 컨트롤러 문맥이 아니라 병렬 읽기 전용 보고로 옮긴다.

## Code

읽는 순서:

- `skills/bouncer-plan/references/evidence-dispatch.md` — full blueprint commit task 근거 수집 계약
- `skills/bouncer-plan/SKILL.md` step 3 Author — `scale: full`일 때만 위 reference를 연다
- `docs/architecture/rule-ownership.md` load graph plan 행 `3 Author:`
- `test/skill-bouncer-plan.test.js`, `test/skill-bouncer-surface.test.js` — Interface·로컬 reference 목록
- `CHANGELOG.md` `[Unreleased]` Added

integration HEAD `579cd5355a6c4adf5a39fa2da2a05884a8f9ea8b`, 브랜치 `feat/085-004-plan-evidence-dispatch`.

## Quiz

1. full blueprint step 3에서 evidence-dispatch를 여는 시점은?
   - A) task bundle scaffold 뒤, Current behavior와 Touch를 쓰기 전
   - B) Scope confirm 뒤, context review 직전
   - C) light blueprint를 포함해 Author 단계 시작 직후

2. 근거 수집 subagent 입력 allowlist에 들어가는 것은?
   - A) 다른 task의 골격과 이전 보고
   - B) task id, task 골격, discovery Goal·Scope, 후보 경로, 읽기 전용 cwd
   - C) `affected_paths`와 pointer를 바꾸는 bouncer 명령

3. 보고가 `affected_paths`를 정하는가?
   - A) 보고의 `observations`가 곧 `affected_paths`다
   - B) 보고는 `affected_paths`를 정하지 않는다. step 4 사용자 확인으로만 정한다
   - C) verification task 보고만 `affected_paths`를 채운다

## 이해 상태

정답: 1A, 2B, 3B. 사용자 응답: 1A, 2B, 3B. 전부 맞음. `quiz_score` 3/3. disposition: 세 문항 모두 정답.

## Tasks

### EPIC-085/BP-004/TASK-001 · `579cd535`

#### Goal & intent

`/bouncer-plan` step 3에서 full blueprint의 commit task마다 generic read-only subagent 하나가 근거(관찰점, I/O coupling, 테스트·fixture, 미해결 질문)를 모아 오게 한다. task 본문과 frontmatter 작성은 controller가 계속 맡는다. 계약은 새 reference `skills/bouncer-plan/references/evidence-dispatch.md` 한 곳에 둔다. 수용 기준은 epic 085 성공 조건 10–12이고 검증 명령은 `npm test`다.

#### Current behavior

- `skills/bouncer-plan/SKILL.md:141-203` step 3 Author는 controller가 `spec-authoring`으로 모든 task의 Goal & intent·Current behavior·Target behavior·Interface·Touch·Do not touch·Constraints·Checklist를 직접 쓰라고만 지시한다. Current behavior의 `file:line` 관찰점과 I/O coupling 근거를 누가 어떻게 모으는지는 정하지 않으므로, 실제로는 controller가 task마다 코드를 직접 읽는다.
- plan에서 subagent를 쓰는 곳은 step 5 context review 하나다. `skills/bouncer-plan/references/context-review.md:71-79`는 named agent가 없을 때 "fresh generic read-only subagent"에 역할 문서 전문과 controller 입력을 싣는 fallback을 정한다. 이 reference는 `rules/subagent-model.md`를 인용하고, 그 규칙(`:3`)은 named Bouncer-agent dispatch에만 적용된다. 같은 규칙 item 6(`:49`)은 모든 dispatch를 foreground로, item 7(`:55`)은 Cursor `subagents.dispatch: "print"`일 때 Task subagent를 쓰지 않도록 정한다.
- `docs/architecture/rule-ownership.md:71` load graph의 plan 행 step 열이 step 3에서 여는 문서를 `references/spec-authoring/index.md`·`rules/document-schema.md`·`rules/planning.md`·`references/stop-slop/index.md`·`skills/bouncer-plan/references/graphify-suggestions.md`·`references/graphify-runner/index.md`로 적는다.
- `test/rule-ownership.test.js:379` `load graph declarations follow the current consumer phase sections`는 load graph 셀의 각 경로가 SKILL.md의 해당 phase 구간에 있는지 단언한다(`./` 접두는 지우고 비교).
- `test/skill-bouncer-surface.test.js:198-215` `CONDITIONAL_HELPERS['bouncer-plan'].local`과 `:289-296` `SKILL_LOCAL_REFS['bouncer-plan']`이 plan 로컬 reference를 `graphify-suggestions.md`·`context-review.md`·`scope-confirm.md` 셋으로 고정한다. 앞 목록은 번호 단계 앞에서 그 파일을 읽지 않는지, 뒤 목록은 `./references/<file>` 표기로 인용하는지 검사한다.
- 재현: `node --test test/skill-bouncer-plan.test.js test/skill-bouncer-surface.test.js test/rule-ownership.test.js test/master-rules.test.js`가 지금 통과한다.

#### Target behavior

- 성공
  - `skills/bouncer-plan/references/evidence-dispatch.md`가 있고 Interface의 문구를 담는다.
  - step 3 Author가 `scale: full`일 때 task bundle scaffold 뒤, Current behavior와 Touch를 쓰기 전에 `[evidence-dispatch.md](./references/evidence-dispatch.md)`를 읽으라고 지시한다. light blueprint는 읽지 않는다.
  - load graph plan 행 step 열의 `3 Author:` 구간에 `skills/bouncer-plan/references/evidence-dispatch.md`가 있다.
  - 두 스킬 표면 목록에 `evidence-dispatch.md`가 들어가 번호 단계 앞에서 읽지 않음과 `./references/` 표기가 함께 검사된다.
- 실패
  - reference가 commit task를 task당 하나씩 한 메시지에서 dispatch하라고 적지 않으면 Interface 단언이 실패한다.
  - reference가 `affected_paths`를 보고로 정하지 못하게 막지 않으면 Interface 단언이 실패한다.
  - reference에 입력 allowlist, 쓰기 금지, light·verification 제외, fallback 네 조건 문장 중 하나라도 없으면 Interface 단언이 실패한다.
- 보존
  - step 3의 나머지 지시(Korean 본문, DAG frontmatter, title·commit 필드, light 작성 범위, verify ACQ, stop-slop, Graphify)와 step 4–8은 그대로다.
  - context review dispatch와 `rules/subagent-model.md`는 바뀌지 않는다.

#### Interface

- 제공
  - `skills/bouncer-plan/references/evidence-dispatch.md` — plan task 근거 수집 계약의 단일 정본. 담을 내용:
    - 적용: `scale: full`, `execution_kind: commit` task 전부. 제외 문장은 "Skip a light blueprint and every `execution_kind: verification` task."다.
    - dispatch: task당 generic read-only subagent 하나, 모두 한 메시지에서 foreground, `fork_turns: "none"`. background handle은 보고가 아니다.
    - 입력 allowlist 문장: "Input allowlist: task id, task skeleton, discovery `Goal` and `Scope`, candidate paths, and the read-only cwd."
    - payload brief: 읽기 전용이고 아래 네 필드로만 보고한다. 금지 문장은 "The subagent writes no file and runs no `bouncer` command that changes frontmatter, status, or the pointer."다.
    - 보고 필드: `observations`, `io_coupling`, `tests`, `unresolved`.
    - controller 처리: 보고는 `AGENTS.md` hard rule 1의 data다. `file:line`을 다시 읽지 않고 그대로 Current behavior·Touch 근거로 쓴다. `unresolved`는 controller 조사나 사용자 질문으로 닫는다. 보고는 `affected_paths`를 정하지 않는다.
    - fallback 문장: "When the host has no generic subagent, `subagents.dispatch: "print"` is set on Cursor, the dispatch fails, or all four fields come back empty, the controller collects the same four fields inline for that task and does not dispatch it again."
  - 아래 테스트가 단언하는 문구가 계약이다.
  ```js
  const refPath = path.join(root, 'skills/bouncer-plan/references/evidence-dispatch.md');
  assert.ok(fs.existsSync(refPath), 'evidence-dispatch.md must exist');
  const ref = fs.readFileSync(refPath, 'utf8');
  assert.match(ref, /^When collecting task evidence for a `scale: full` blueprint, read this reference\./);
  assert.match(ref, /`execution_kind: commit`/);
  assert.match(ref, /Skip a light blueprint and every `execution_kind: verification` task\./);
  assert.match(ref, /Input allowlist: task id, task skeleton, discovery `Goal` and `Scope`, candidate paths, and the read-only cwd\./);
  assert.match(ref, /The subagent writes no file and runs no `bouncer` command that changes frontmatter, status, or the pointer\./);
  assert.match(ref, /one generic read-only subagent per[\s\S]{0,80}task/i);
  assert.match(ref, /in one message/i);
  assert.match(ref, /fork_turns: "none"/);
  for (const field of ['observations', 'io_coupling', 'tests', 'unresolved']) {
    assert.match(ref, new RegExp('`' + field + '`'));
  }
  assert.match(ref, /hard rule 1/);
  assert.match(ref, /never[\s\S]{0,80}`affected_paths`/i);
  assert.match(ref, /subagents\.dispatch: "print"/);
  assert.match(ref, /the dispatch fails, or all four fields come back empty/);
  assert.match(ref, /collects the same four fields inline for that task and does not dispatch it again/);
  const step3 = body.slice(body.indexOf('3. **Author.**'), body.indexOf('4. **Scope confirm.**'));
  assert.match(step3, /`scale: full`[\s\S]{0,240}\[evidence-dispatch\.md\]\(\.\/references\/evidence-dispatch\.md\)/);
  ```
- 거부: subagent가 task 문서나 frontmatter를 쓰는 것, 보고로 `affected_paths`를 채우는 것, light blueprint나 verification task에 dispatch하는 것, 새 named role이나 `subagents.<provider>` slot을 두는 것.

#### Touch

| 경로 | 심볼 | 변경 | 현재 책임 | 계획한 변경 | 근거 |
| --- | --- | --- | --- | --- | --- |
| `skills/bouncer-plan/references/evidence-dispatch.md` | 문서 전체 | Create | 없음 | 근거 수집 계약 reference 작성 | 계약의 단일 정본 |
| `skills/bouncer-plan/SKILL.md` | step 3 `**Author.**` | Modify | controller가 근거 수집까지 직접 함 | full일 때 reference를 읽는 조건 문장 추가 | reference를 여는 유일한 지점 |
| `docs/architecture/rule-ownership.md` | `## Load graph` plan 행 | Modify | step 3 적재 목록에 새 reference 없음 | `3 Author:` 구간에 경로 추가 | `test/rule-ownership.test.js:379`가 load graph와 SKILL 구간 일치를 단언함 |
| `test/skill-bouncer-plan.test.js` | 새 테스트 | Modify | 근거 수집 단언 없음 | Interface의 단언 추가 | 계약 검증 지점 |
| `test/skill-bouncer-surface.test.js` | `CONDITIONAL_HELPERS`, `SKILL_LOCAL_REFS` | Modify | plan 로컬 reference를 셋으로 고정 | 두 목록에 `evidence-dispatch.md` 추가 | 새 로컬 reference의 적재 시점과 인용 표기 검사 |
| `CHANGELOG.md` | `[Unreleased]` | Modify | 항목 없음 | Added 항목 추가 | 프로젝트 변경 이력 규칙 |

#### Constraints

- reference와 SKILL 문장은 영어로 쓴다. plan 스킬과 그 reference의 기존 언어를 따른다.
- step 3에 추가하는 문장은 reference 가리킴과 적용 조건만 담는다. 입력·필드·fallback 목록을 SKILL에 베끼지 않는다.
- reference는 `rules/subagent-model.md`를 인용하지 않는다. named role이 아니므로 모델 해석과 slot 재시도를 적용하지 않는다. foreground 대기와 Cursor print 처리는 reference 안에 직접 적는다.
- 기존 테스트가 단언하는 step 3 문구(`Current behavior`, `spec-authoring`, `rules/planning.md`, `stop-slop`, `graphify-suggestions.md` 등)를 지우지 않는다.

### EPIC-085/BP-004/TASK-002

#### Goal & intent

TASKS-001이 통합된 integration head에서 CI 전체(`check:emit`, coverage, eslint, `lint:docs`, `lint:context-comments`, typecheck, audit)가 통과함을 증명한다. 수용 기준은 epic 085 성공 조건 9다.

#### Interface

- 제공: 선행 task가 통합된 상태에서 verify 명령이 남기는 종단 검증 증적.
- 거부: source 변경, review 문서, commit.

#### Touch

Source 변경 경로 없음.