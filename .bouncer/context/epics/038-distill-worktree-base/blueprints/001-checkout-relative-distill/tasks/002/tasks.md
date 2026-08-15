---
type: bouncer.tasks
title: 승격 base를 CLI payload repoRoot로 고정
description: Tasks for 002
resource: .bouncer/context/epics/038-distill-worktree-base/blueprints/001-checkout-relative-distill/tasks/002/tasks.md
tags:
  - bouncer
  - tasks
timestamp: '2026-08-15T14:26:51.349+09:00'
bouncer:
  id: TASKS-002
  epic_id: '038'
  blueprint_id: '001'
  status: verified
  commit_intent:
    - finalize가 project-root로 승격 경로를 조립해 커밋하는 checkout과 어긋났음
    - 승격 base를 distill CLI payload의 repoRoot 하나로 고정해 경로 출처를 없앰
  affected_paths:
    - CLAUDE.md
    - skills/bouncer-finalize/SKILL.md
    - skills/spec-authoring/SKILL.md
    - test/master-rules.test.js
    - test/skill-bouncer-finalize.test.js
  graph:
    generated_at: '2026-08-15T14:26:51.349+09:00'
    command: graphify query
    suggested_paths:
      - skills
      - test
    basis:
      - graph: context
        status: updated
        query: Distill promotion finalize worktree
        result: >-
          .bouncer/distill/git-worktree.md와 epic 037
          promotion-consent의 index / explain이 인접. 승격 동의 절차는
          유지하고 base 출처만 바꾸면 되는 근거.
      - graph: source
        status: reused
        query: distill
        result: >-
          finalize.ts가 distill 클러스터에 인접하지만 프로즈 변경만으로는
          코드 경로가 바뀌지 않음. 이 task의 산출물은 문서와 프로즈 테스트뿐임.
---
# Tasks

Blueprint: [001](../../index.md)

## Goal & intent
`/bouncer-finalize`가 승격 대상 경로를 `bouncer project-root`로 조립하지 않고,
`bouncer distill --all --json` payload의 `repoRoot`에서 받게 한다. task 001이
그 값을 현재 checkout 기준으로 만들어 두었으므로, 승격 쓰기와 finalize의
remainder 커밋이 같은 checkout을 쓰게 된다.

경로 출처가 둘(`project-root` 조립 / CLI payload)이면 다시 갈라진다. finalize
쪽 출처를 하나만 남기는 것이 이 task의 전부다.

## Interface
- 제공:
  - `skills/bouncer-finalize/SKILL.md`가 승격 base를 `bouncer distill --all
    --json`의 payload `repoRoot`로 정의한다. shard의 등록 상대 경로는 모두 그
    base 기준으로 read/write한다.
  - 같은 스킬이 **cwd 계약**을 명시한다: 승격 audit은 `--repo` 없이 실행하며,
    그 cwd는 step 3의 `bouncer finalize`가 커밋할 checkout과 같아야 한다.
    `--repo`만 지우고 cwd를 main worktree에 두면 base가 main으로 돌아가
    이 버그가 그대로 남는다. `/bouncer-finalize` step 1~3은 하나의 checkout
    안에서 이어진다.
  - `CLAUDE.md` 하드룰 7이 "plan/execute/run은 `project-root`로 `PROJECT_ROOT`를
    묶고, finalize 승격은 CLI payload `repoRoot`를 base로 쓴다"로 갈린다.
  - `skills/spec-authoring/SKILL.md`의 "caller-provided absolute Distill path"
    설명이 그 base에서 온 값임을 명시한다.
- 거부:
  - `/bouncer-finalize`는 더 이상 `bouncer project-root`를 부르지 않는다.
    승격 경로를 `${PROJECT_ROOT}/...`로 조립하는 문장을 남기지 않는다.
  - `spec-authoring`은 여전히 CLI를 직접 부르지 않는다. base도 caller가 준다.
  - `skills/bouncer-plan`·`bouncer-execute`·`bouncer-run`의 `PROJECT_ROOT`
    바인딩은 그대로 둔다. 세 스킬은 stdout만 소비한다.

## Touch
- Modify `CLAUDE.md` — 하드룰 7에서 finalize 승격 base를 CLI payload `repoRoot`로
  분리하고, "execute worktree cwd는 Distill base가 아니다" 문구를 plan/execute
  읽기 경로에 한정한다.
- Modify `skills/bouncer-finalize/SKILL.md` — Project root 프리플라이트 블록을
  걷어내고 step 1의 base를 payload `repoRoot`로 다시 쓴다.
- Modify `skills/spec-authoring/SKILL.md` — Distill 절대 경로의 출처를 CLI
  payload `repoRoot`로 정정한다.
- Modify `test/master-rules.test.js` — `PROJECT_ROOT` 루프 대상에서
  `bouncer-finalize`를 빼고, finalize가 payload `repoRoot`를 승격 base로 쓰는지
  검사하는 assertion을 추가한다.
- Modify `test/skill-bouncer-finalize.test.js` — `PROJECT_ROOT` 단정을 payload
  `repoRoot` 단정으로 바꾼다.

## Do not touch
- `scripts/**` — 이 task는 프로즈 계약만 바꾼다. 실행 코드는 task 001이 끝냈다.
- `skills/bouncer-plan/SKILL.md`, `skills/bouncer-execute/SKILL.md`,
  `skills/bouncer-run/SKILL.md` — 세 스킬의 Distill 소비 방식은 바뀌지 않는다.
- `skills/discovery/SKILL.md` — caller-provided 절대 경로 계약이 그대로 성립한다.
- `.bouncer/Distill.md`, `.bouncer/distill/**` — 승격은 `/bouncer-finalize`가
  한다. 계획 단계에서 미리 쓰지 않는다.

## Constraints
- 하드룰 7의 다른 계약(전체 검색 우선, route 결과가 shard body를 대신하지 못함,
  단일 파일 폴백, 목록 단위 1회 동의)은 문구를 유지한다. 이번 변경은 base
  출처 한 줄이다.
- `test/master-rules.test.js:61-68`이 요구하는 `CLAUDE.md`의 `project-root` /
  `PROJECT_ROOT` 언급은 남아야 한다 — plan/execute 경로에서 여전히 참이다.
- `test/master-rules.test.js:163-169`의 discovery·spec-authoring
  "caller-provided absolute" 계약을 깨지 않는다.
- 프로즈는 한국어 규칙을 따르되 식별자·경로·코드 펜스는 그대로 둔다. Distill
  본문 내용을 마스터 룰에 넣지 않는다.
- Project root 블록을 걷어내도 남는 shell 블록은 각자 `BOUNCER_ROOT=` 대입을
  유지한다. 워크플로 스킬의 shell 블록은 매번 새 셸이다.
- `stop-slop`을 적용한다(자문).

## Checklist
- [ ] `test/master-rules.test.js`의 `workflow skills resolve PROJECT_ROOT` 루프
      배열을 `['bouncer-plan', 'bouncer-execute', 'bouncer-run']`으로 줄인다.
- [ ] 같은 파일에 finalize 전용 실패 테스트를 추가한다.
      ```js
      const finalize = read('skills/bouncer-finalize/SKILL.md');
      // 긍정 단정으로 base 출처를 잠근다.
      assert.match(finalize, /payload[^\n]{0,40}`?repoRoot`?/i);
      // 경로 조립 형태만 좁게 금지한다. `project-root`라는 낱말 자체를
      // doesNotMatch로 막으면, "project-root로 조립하지 않는다"는 금지 문구를
      // 본문에 쓰는 순간 테스트가 깨진다(plugin-skills shard의 알려진 함정).
      assert.doesNotMatch(finalize, /\$\{PROJECT_ROOT\}\/\.bouncer\/Distill\.md/);
      // cwd 계약이 본문에 남아 있어야 한다.
      assert.match(finalize, /cwd/i);
      assert.match(finalize, /같은 checkout|동일한 checkout/);
      ```
- [ ] `finalize promotion searches all Distill content...` 테스트의
      `already-resolved…PROJECT_ROOT…` 단정을 `repoRoot` 기준으로 고친다.
- [ ] `test/skill-bouncer-finalize.test.js`의 `assert.match(body, /PROJECT_ROOT/)`
      를 `repoRoot` 단정으로 바꾼다.
- [ ] `node --test test/master-rules.test.js test/skill-bouncer-finalize.test.js`
      로 위 항목이 실패하는 것을 확인한다.
- [ ] `skills/bouncer-finalize/SKILL.md`에서 **Project root** 프리플라이트
      블록을 제거하고, step 1을 payload `repoRoot` 기준으로 다시 쓴다. shard
      상대 경로 해석, 개별 read 의무, `single-file` 폴백 문장은 base 이름만
      바꿔 유지한다. audit 명령은 `--repo` 없이
      `node "${BOUNCER_ROOT}/scripts/bouncer" distill --all --json`으로 적는다.
- [ ] 같은 스킬에 cwd 계약 문단을 넣는다 — step 1의 audit·승격 쓰기와 step 3의
      `bouncer finalize`가 같은 checkout에서 이어져야 하며, execute worktree가
      있으면 그 안에서 실행한다. step 5의 worktree 제거만 main worktree에서
      한다는 기존 문장과 충돌하지 않게 둘의 경계를 분명히 적는다.
- [ ] `CLAUDE.md` 하드룰 7을 갱신한다. plan/execute/run은 `project-root` +
      `PROJECT_ROOT`, finalize 승격은 payload `repoRoot`.
- [ ] `skills/spec-authoring/SKILL.md`에서 Distill 절대 경로 출처를 payload
      `repoRoot`로 정정한다.
- [ ] `npm test`가 통과한다.
