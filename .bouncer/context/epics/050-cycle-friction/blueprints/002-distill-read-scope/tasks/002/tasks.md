---
type: bouncer.tasks
title: plan 프리플라이트와 하위 스킬을 preflight 층으로 옮김
description: plan·discovery·spec-authoring이 전량 대신 preflight 출력과 baseline 파일 경로를 소비하도록 지침과 하드룰을 바꾼다
resource: .bouncer/context/epics/050-cycle-friction/blueprints/002-distill-read-scope/tasks/002/tasks.md
tags:
  - bouncer
  - tasks
timestamp: '2026-08-25T12:35:04.089+09:00'
bouncer:
  id: TASKS-002
  epic_id: '050'
  blueprint_id: '002'
  status: verified
  verify: npm run ci
  commit_intent:
    - 같은 42.7KB가 plan·discovery·spec-authoring에 최대 세 번 실려 계획 초반 비용이 몰려 있었음
    - 경로 확정 전에는 preflight 층만 싣고 전량은 파일 baseline으로 남기도록 지침을 옮김
  affected_paths:
    - skills/bouncer-plan/SKILL.md
    - skills/discovery/SKILL.md
    - skills/spec-authoring/SKILL.md
    - CLAUDE.md
    - test/skill-bouncer-plan.test.js
    - test/skill-discovery.test.js
    - test/skill-spec-authoring.test.js
    - test/master-rules.test.js
  scope_evidence:
    producer: graphify
    generated_at: '2026-08-25T12:35:04.089+09:00'
    suggested_paths:
      - scripts/src/lib/cli.ts
      - test/skill-bouncer-surface.test.js
    basis:
      - graph: source
        status: reused
        query: query 'distill' (BFS depth=2)
        result: source_dirs가 scripts/hooks/test라 skills/·CLAUDE.md는 조회 결과에 나오지 않음 — 수동 보강 필요
      - graph: context
        status: reused
        query: query 'Distill 읽기 프리플라이트'
        result: 038 checkout-relative-distill 계약과 plugin-skills 샤드가 인접 — 하드룰 7 문구 충돌 확인용
---
# Tasks

Blueprint: [002](../../index.md)

## Goal & intent
`/bouncer-plan` 프리플라이트가 `--all` 출력을 컨텍스트에 붓는 대신,
`--all`은 스크래치 baseline 파일로 받고 컨텍스트에는 `--preflight` 출력만
싣는다. `discovery`와 `spec-authoring`은 "완전한 `--all` 출력"이 아니라
preflight 출력 + baseline 절대 경로를 받는다. `CLAUDE.md` 하드룰 7이 이
두 층(프리플라이트 / 재접지)을 기술한다. 완료 판정은 세 스킬 본문에
`--all` 출력 소비 문장이 남지 않고 `npm run ci`가 통과하는 것이다.

## Interface
- 제공:
  - `/bouncer-plan` **Project Distill** 절: `distill --all`은 baseline 파일로
    리다이렉트하고 stderr 총량 한 줄 보고는 유지, 컨텍스트 주입은
    `distill --preflight`. baseline 파일의 절대 경로와 preflight 출력을
    `discovery` / `spec-authoring`에 함께 넘긴다.
  - `discovery` step 1: 소비 대상이 preflight 출력 + baseline 경로임을 명시.
    파일·인덱스 부재는 여전히 하드 스톱이 아니며 Overlap `"none"` 폴백 유지.
  - `spec-authoring` step 2 project Distill 항목: 계획 작성 시점의 근거는
    재접지된 `--for` 결과와 preflight 출력이고, 전량이 필요하면 baseline
    파일을 연다.
  - `CLAUDE.md` 하드룰 7: 읽기가 두 층임을 기술 — 경로 확정 전에는
    `--preflight`(+ baseline 파일), 확정 후에는 경로별 `--for`.
- 거부:
  - baseline 파일이 없는 상태에서 라우팅 결과로 baseline을 대체하는 것.
    지침은 `--all` 재실행을 지시한다.
  - finalize의 승격 읽기 계약(하드룰 7 후반부, `--all --json` 감사와 샤드
    전량 검색)은 이 태스크에서 바꾸지 않는다 — 003 소관.

## Touch
- Modify `skills/bouncer-plan/SKILL.md` — Project Distill 절과 step 6 재접지
  문단을 두 층 계약으로 고친다.
- Modify `skills/discovery/SKILL.md` — step 1 Pre-read와 Question checklist의
  Distill 소비 대상을 preflight + baseline으로 바꾼다.
- Modify `skills/spec-authoring/SKILL.md` — step 2 project Distill 항목의
  「complete `bouncer distill --all` output」 표현을 새 계약으로 바꾼다.
- Modify `CLAUDE.md` — 하드룰 7의 plan 읽기 문장을 두 층으로 다시 쓴다.
- Modify `test/skill-bouncer-plan.test.js` — preflight·baseline 문구 계약 assert.
- Modify `test/skill-discovery.test.js` — 소비 대상 변경 assert.
- Modify `test/skill-spec-authoring.test.js` — `--all` 전량 소비 문구 부재 assert.
- Modify `test/master-rules.test.js` — 하드룰 7 문구 계약 갱신.

## Do not touch
- `scripts/` — 이 태스크는 지침만 바꾼다. CLI는 001에서 끝났다.
- `skills/bouncer-execute/SKILL.md`, `skills/bouncer-run/SKILL.md` — 재접지
  `--for` 읽기는 유지 대상(epic 성공기준 5).
- `skills/bouncer-finalize/SKILL.md` — 003 소관.
- `.bouncer/Distill.md`, `.bouncer/distill/` — 004 소관.

## Constraints
- 하드룰 7의 나머지 계약(PROJECT_ROOT 해석, 단일 파일 폴백, 라우트 결과가
  전수 검색을 대체하지 않음, Distill은 영어 런타임)은 문구를 유지한다.
- 스킬 본문에 Distill 본문 내용을 옮겨 적지 않는다 — 하드룰 7의 금지다.
- ACQ 게이트 목록과 단계 번호는 바뀌지 않는다. 프리플라이트는 여전히
  질문하지 않는 단계다.
- baseline 파일 경로는 세션 스크래치 디렉터리를 쓰고 저장소에 남기지 않는다.
- 스킬 본문 영어, 프로젝트 문서 한국어라는 기존 언어 규칙을 유지한다.

## Checklist
- [ ] `test/skill-bouncer-plan.test.js`에 실패 assert를 먼저 넣는다:
      본문이 `distill --preflight`를 포함하고, `--all` 출력을 컨텍스트로
      소비하라는 문장은 포함하지 않는다.
- [ ] `test/skill-discovery.test.js` / `test/skill-spec-authoring.test.js` /
      `test/master-rules.test.js`에 같은 방향의 실패 assert를 넣는다.
- [ ] `node --test test/skill-bouncer-plan.test.js test/skill-discovery.test.js test/skill-spec-authoring.test.js test/master-rules.test.js`로 실패를 확인한다.
- [ ] `skills/bouncer-plan/SKILL.md` Project Distill 절을 고친다: `--all`은
      baseline 파일로, 컨텍스트 주입은 `--preflight`, stderr 총량 보고 유지.
- [ ] 같은 파일 step 6 재접지 문단에 baseline 유지 근거를 한 줄로 남긴다
      (라우트 결과가 baseline을 대체하지 않음).
- [ ] `skills/discovery/SKILL.md` step 1과 Question checklist를 고친다.
- [ ] `skills/spec-authoring/SKILL.md` step 2 project Distill 항목을 고친다.
- [ ] `CLAUDE.md` 하드룰 7 plan 문장을 두 층 계약으로 다시 쓴다.
- [ ] 변경 전후로 `affected_paths` 8개 경로에 대해
      `node scripts/bouncer distill --for <path> --repo "$PWD" | grep '^# '`를
      돌려 샤드 id 집합이 같음을 확인하고, 결과를 커밋 메시지가 아니라
      리뷰에서 인용할 수 있게 실행 로그로 남긴다.
- [ ] `npm run ci` 통과를 확인한다.
