---
type: bouncer.tasks
title: /bouncer-commit 스킬을 만들고 워크플로 문서를 새 단계 순서로 맞춤
description: Tasks for 005
resource: .bouncer/context/epics/018-task-unit-commits/blueprints/011-commit-stage/tasks/005/tasks.md
tags:
  - bouncer
  - tasks
timestamp: '2026-08-07T14:13:08.438+09:00'
bouncer:
  id: TASKS-005
  epic_id: '018'
  blueprint_id: '011'
  status: verified
  commit_intent:
    - 새 단계가 코드에만 있고 스킬과 문서는 여전히 네 단계 흐름을 안내함
    - 사용자가 만나는 스킬과 문서를 다섯 단계 흐름으로 맞춰 실제 경로와 어긋나지 않게 함
  affected_paths:
    - skills/bouncer-commit/SKILL.md
    - skills/bouncer-execute/SKILL.md
    - skills/bouncer-finalize/SKILL.md
    - skills/bouncer-plan/SKILL.md
    - skills/explain-diff/SKILL.md
    - skills/spec-authoring/SKILL.md
    - CLAUDE.md
    - README.md
    - docs/workflow.md
    - docs/gates.md
    - docs/cli.md
    - docs/governance.md
    - docs/contributing.md
    - docs/PILOT.md
    - docs/troubleshooting.md
    - docs/ARCHITECTURE.md
    - test/skill-bouncer-commit.test.js
    - test/skill-bouncer-surface.test.js
    - test/skill-bouncer-execute.test.js
    - test/skill-bouncer-finalize.test.js
    - test/skill-explain-diff.test.js
    - test/skill-spec-authoring.test.js
    - test/master-rules.test.js
    - test/verification-runner.test.js
  graph:
    generated_at: '2026-08-07T14:35:00+09:00'
    command: graphify query (source + context)
    suggested_paths:
      - scripts/src/lib
      - scripts/lib
      - test
      - skills
      - docs
    basis:
      - graph: source
        status: updated
        query: buildCommitMessage finalize.ts validate.ts comprehension.ts scaffold explain cli.ts
        result: 12 hits — 전부 폐기된 `.superpowers/` · `commands/sdd-*.md` 노드라 현재 트리와 대응되지 않음. 인덱스가 낡아 경로를 수동 확정
      - graph: context
        status: updated
        query: task 단위 커밋 finalize explain 이해 기록 게이트
        result: source 쿼리와 동일한 폐기 노드 12개. 사용 불가로 판단하고 수동 확정
---
# Tasks

Blueprint: [011](../../index.md)

## Goal & intent
사용자가 만나는 표면이 다섯 단계 흐름을 안내한다. `/bouncer-commit`이 task
하나를 닫고, `/bouncer-execute`는 커밋하지 않으며, `/bouncer-finalize`는 PR과
정리만 한다. 마스터 룰의 워크플로 순서와 공개 문서의 게이트 표가 003·004가
만든 실제 동작과 일치한다.

## Interface
- 제공
  - `skills/bouncer-commit/SKILL.md` — 프리플라이트(포인터) → 범위 dry-run →
    `explain-diff`로 대상 task 엔트리 기록 → `validate --gate commit` →
    ACQ 후 `bouncer commit --yes` → 다음 task ACQ + `bouncer current --set`.
  - `/bouncer-execute`: 커밋 지시를 걷어내고, worktree가 이미 있으면 재사용
    하라는 규칙을 명시한다(같은 blueprint의 모든 task가 하나를 공유).
  - `/bouncer-finalize`: Distill 승격 → `validate --gate finalize` →
    `finalize --yes` → draft PR ACQ → worktree 제거 → 다음 blueprint ACQ.
    task 커밋과 퀴즈 단계는 빠진다.
  - `explain-diff`: 퀴즈 범위가 `range_from..HEAD`이고, 결과를 엔트리 하나로
    append한다. 기존 엔트리를 고쳐 쓰지 않는다.
  - `spec-authoring`: task `bouncer.commit_intent`(2줄)를 필드 표에 추가하고,
    커밋 subject가 task `title`에서 온다는 점을 적는다.
  - 마스터 룰 하드룰 5의 순서가 init → plan → execute → commit → finalize다.
- 거부
  - `/bouncer-commit`을 워크플로 진입점이 아닌 보조 스킬로 쓰지 않는다.
    설명(`description`)은 다른 워크플로 스킬과 같은 "Use only when the user
    explicitly asks" 형태다.
  - `/bouncer-execute`에 커밋 문장을 남기지 않는다.
  - `bouncer-commit`을 `docs/ARCHITECTURE.md` §4 일반 스킬 표에 넣지 않는다.
    워크플로 스킬이다.

## Touch
- Create `skills/bouncer-commit/SKILL.md` — task 마감 워크플로 스킬
- Create `test/skill-bouncer-commit.test.js` — 새 스킬의 계약 assert
- Modify `skills/bouncer-execute/SKILL.md` — 커밋 제거, worktree 재사용 규칙
- Modify `skills/bouncer-finalize/SKILL.md` — PR·정리로 축소
- Modify `skills/explain-diff/SKILL.md` — 엔트리 append와 범위
- Modify `skills/spec-authoring/SKILL.md` — task `commit_intent` 필드 표
- Modify `skills/bouncer-plan/SKILL.md` — 커밋 메시지 출처 안내
- Modify `CLAUDE.md` — 하드룰 5 순서와 「When to invoke」 표
- Modify `docs/workflow.md` `docs/gates.md` `docs/cli.md` `docs/governance.md` `docs/contributing.md` `docs/PILOT.md` `docs/troubleshooting.md` `docs/ARCHITECTURE.md` — 단계·게이트·CLI 표
- Modify `README.md` — 흐름 다이어그램과 명령 목록
- Modify `test/skill-bouncer-surface.test.js` — 워크플로 스킬 목록에 `bouncer-commit`
- Modify `test/master-rules.test.js` — 순서와 CLAUDE.md 읽기 대상
- Modify `test/skill-bouncer-execute.test.js` `test/skill-bouncer-finalize.test.js` `test/skill-explain-diff.test.js` `test/skill-spec-authoring.test.js` — 이동한 문장의 계약

## Do not touch
- `scripts/src/lib` `scripts/lib` — 동작은 001~004에서 확정
- `test/validate-gates.test.js` `test/finalize-pure.test.js` `test/cli-commit.test.js` — 코드 task의 테스트
- `.claude-plugin` `.codex-plugin` `.cursor-plugin` — `skills/`는 관례로 탐색되므로 매니페스트에 다시 선언하지 않는다
- `agents` — 서브에이전트 페르소나는 이번 범위가 아니다

## Constraints
- 문서·스킬 산문은 한국어를 유지한다(식별자·경로·코드 펜스 제외). 영어인
  기존 워크플로 스킬 본문은 그 언어를 그대로 따른다.
- ACQ 스켈레톤 형식(Re-ground / Recommend-why / recommended-first 옵션)을
  `/bouncer-commit`에도 그대로 쓴다. 새 형식을 만들지 않는다.
- 스킬은 `bouncer` CLI만 호출한다. `node -e`로 `scripts/lib/*`를 직접 부르지
  않는다(`explain-diff`의 기존 `computeDiffSha` 호출은 예외로 유지).
- 새 CLI·게이트·훅을 문서 작업 중에 추가하지 않는다. 문서는 001~004가 만든
  표면만 서술한다.
- **도구 스큐 주의.** 여기서 고친 스킬은 이 저장소 파일이고, 실행 중인 세션은
  설치된 플러그인 캐시(0.6.0)의 스킬을 계속 읽는다. 새 `/bouncer-commit`은
  플러그인을 다시 설치해야 호출된다. 이 blueprint를 닫을 때는 `bouncer commit`
  CLI를 직접 부르고, 스킬 반영은 릴리스 이후에 확인한다.
- `stop-slop`을 적용해 한국어 산문에서 군더더기를 걷어낸다(권고).

## Checklist
- [ ] `test/skill-bouncer-commit.test.js`를 먼저 쓴다. frontmatter `name`이
      `bouncer-commit`이고 description이 명시 호출 문구를 담는지,
      본문이 `validate --gate commit` · `bouncer commit --yes` ·
      `skills/explain-diff/SKILL.md` · `current --set`을 인용하는지 확인한다.
- [ ] `test/skill-bouncer-surface.test.js`의 `WORKFLOW` 배열에
      `'bouncer-commit'`을 넣고 기존 assert가 새 스킬에도 걸리게 한다.
- [ ] `test/skill-bouncer-execute.test.js`에 커밋 지시가 없다는 assert를
      추가한다. 금지 문구가 아니라 존재하는 문장으로 확인한다:
      ```js
      assert.match(execute, /\/bouncer-commit/);
      ```
- [ ] `test/master-rules.test.js`에서 워크플로 스킬 목록과 하드룰 5 순서에
      `bouncer-commit`이 들어가는지 확인한다.
- [ ] 위 테스트가 실패하는 것을 확인한 뒤 스킬 → 마스터 룰 → docs → README
      순으로 쓴다.
- [ ] `docs/gates.md` 표에 `commit`(G15)과 `finalize`(G16) 행이 각각 있는지
      확인한다.
- [ ] `npm test`가 통과한다.
