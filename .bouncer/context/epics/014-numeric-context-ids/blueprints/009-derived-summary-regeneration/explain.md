---
type: bouncer.explain
title: 001 explain
description: Explain for 001
resource: .bouncer/context/epics/014-numeric-context-ids/blueprints/009-derived-summary-regeneration/explain.md
tags:
  - bouncer
  - explain
timestamp: '2026-08-31T14:33:19.871+09:00'
bouncer:
  id: EXPLAIN-009
  epic_id: '014'
  blueprint_id: '009'
  status: published
  comprehension:
    - range_from: develop
      range_to: ccab569a8c779bcc29a9d46e9c2b82f5683f2098
      diff_sha: c2e5523a146c0444d9e213ab5386a87a6c48fa8deaa6048c2cc4094f80f4704a
      quiz_score: 1/2
      disposition: 핵심 정본·파생값 계약은 이해했으나 S13의 실패 동작을 재확인할 필요가 있음
      recorded_at: '2026-08-31T14:34:10+09:00'
---
# Explain

## Background

에픽 문서의 `description`과 번들 색인 행을 각각 저술하면서 플레이스홀더와 요약 불일치가 누적되었다. 이번 변경은 frontmatter description을 정본으로 고정하고 scaffold 재진입, S13 구조 검사, 기존 62개 에픽 데이터 보정을 같은 규칙으로 묶어 drift가 다시 생기지 않게 한다.

## Intuition

에픽 description을 원장으로 두고 색인 행은 그 원장에서 다시 인쇄하는 파생 영수증처럼 다룬다.

## Code

핵심 생성·검사 로직은 `scripts/src/lib/epic-index.ts`, `scripts/src/lib/scaffold.ts`, `scripts/src/lib/cli-doc-commands.ts`에 있고 CommonJS 소비본은 `scripts/lib/`에서 빌드로 재생성한다. `ensureEpicIndexEntry`는 canonical epic의 description을 읽어 색인 행을 append·replace·no-op으로 처리하며, S13은 같은 정본과 행 요약의 일치를 검사한다. `test/scaffold.test.js`와 `test/validate-structural.test.js`가 거부·재진입·불일치 회귀를 검증하고, 관련 문서와 기존 epic index들은 새 단방향 계약에 맞춰졌다.

## Quiz

1. 기존 canonical epic에 `scaffold epic`을 같은 경로로 다시 실행할 때 정본으로 사용되는 값은 무엇인가?
   - A) 새 CLI 인자의 description
   - B) 기존 epic frontmatter의 description
   - C) 색인 행에 이미 적힌 요약

2. S13이 description과 색인 행의 요약이 다르다고 판단하면 어떻게 되는가?
   - A) 색인 행을 조용히 고친다
   - B) 해당 불일치를 구조 검증 실패로 보고한다
   - C) epic frontmatter를 색인 행에 맞춘다

## 이해 상태

1번: B — 정답. 기존 epic frontmatter의 description이 재생성의 정본임.
2번: C — 오답. 정답은 B이며, S13은 description과 색인 요약 불일치를 구조 검증 실패로 보고함.
결과: 1/2. disposition: 핵심 정본·파생값 계약은 이해했으나 S13의 실패 동작을 재확인할 필요가 있음.

## Tasks

### Task 001

#### Goal & intent

에픽 frontmatter `description`만 사람이 저술하고 번들 색인 행은 그 값에서 재생성한다. 신규 scaffold·기존 행 갱신·S13·61개 기존 데이터가 같은 계약을 사용하며, 플레이스홀더와 실제 요약 불일치가 0개인 상태에서 저장소 검증이 통과해야 한다.

#### Interface

- 제공: `bouncer scaffold epic`은 신규 에픽에 비어 있지 않고 `Epic NNN`이 아닌 `--description`을 요구한다. 같은 canonical epic 경로에 재실행하면 기존 epic 파일은 바이트 단위로 보존하고 `.bouncer/context/index.md`의 해당 행만 현재 frontmatter에 맞춰 append·replace·no-op한다.
- 제공: `formatEpicIndexLine`은 신규 행을 만들 때 canonical id·slug와 frontmatter description을 사용한다. 기존 행에서 `ensureEpicIndexEntry`와 S13이 비교·교체하는 대상은 description 부분이며 link label·경로는 보존한다.
- 거부: 신규 scaffold의 description 누락·공백·`Epic <동일 id>` 값, 에픽 frontmatter의 읽기 실패·파싱 실패·비문자열 또는 빈 description은 조용히 fallback하지 않는다. CLI scaffold는 파일을 쓰기 전에 exit 2로 거절하고, 구조 검사는 S13으로 해당 파일과 원인을 보고한다.
- 거부: 재생성은 색인 frontmatter·`# Epics` 헤딩·다른 행·기존 행 순서를 바꾸거나 같은 epic 행을 중복 생성하지 않는다. 서로 다른 slug가 같은 id를 쓰는 기존 `024` 두 경로는 합치지 않는다.

#### Touch

- Modify `scripts/src/lib/epic-index.ts` — frontmatter 정본에서 기대 행을 만들고 기존 행 replace·S13 요약 비교를 구현한다.
- Modify `scripts/src/lib/scaffold.ts` — 신규 description 입력과 기존 epic 무덮어쓰기 재진입 계약을 적용한다.
- Modify `scripts/src/lib/cli-doc-commands.ts` — `scaffold epic --description` 검증·usage를 공개한다.
- Modify `scripts/lib/epic-index.js` — TypeScript 빌드 산출물을 재생성한다.
- Modify `scripts/lib/scaffold.js` — TypeScript 빌드 산출물을 재생성한다.
- Modify `scripts/lib/cli-doc-commands.js` — TypeScript 빌드 산출물을 재생성한다.
- Modify `test/scaffold.test.js` — description 필수 입력, 최초 행, 안전한 재실행, replace·no-op·거부를 검증한다.
- Modify `test/validate-structural.test.js` — S13 요약 mismatch와 frontmatter 오류를 검증하고 공용 fixture 행을 description과 맞춘다.
- Modify `test/cli-validate.test.js` — plan gate fixture의 epic description과 파생 행을 새 계약으로 맞춘다.
- Modify `test/validate-gates.test.js` — G gate fixture 세 곳의 literal 행을 epic description과 맞춘다.
- Modify `skills/agentic-code-benchmark/scripts/run_deepswe.py` — benchmark scaffold 호출에 유효한 epic description을 전달한다.
- Modify `skills/bouncer-plan/SKILL.md` — discovery description을 최초 scaffold에 넘기고 authoring 뒤 같은 epic을 재실행해 파생 행을 맞추도록 절차를 바꾼다.
- Modify `references/spec-authoring/index.md` — epic description만 저술하고 번들 행에는 저술 권한을 두지 않는 경계를 명시한다.
- Modify `references/spec-authoring/epic.md` — 완성 예시의 `Epic 077` description을 실제 한 문장으로 바꾼다.
- Modify `rules/okf.md` — frontmatter description 정본과 번들 색인 파생값의 소유권을 기록한다.
- Modify `scripts/src/lib/init.ts` — 초기 번들 색인 안내를 description 정본·append/replace·S13 요약 검사 계약으로 맞춘다.
- Modify `scripts/lib/init.js` — TypeScript 빌드로 초기 번들 색인 안내 산출물을 재생성한다.
- Modify `docs/cli.md` — `scaffold epic --description` 필수 입력과 안전한 재실행 동작을 공개한다.
- Modify `docs/gates.md` — S13의 요약 정합성 판정을 공개 계약에 추가한다.
- Modify `docs/compatibility.md` — S13 호환성 표를 경로·요약 검사로 갱신한다.
- Modify `docs/troubleshooting.md` — S13 요약 mismatch의 재생성 복구 절차를 추가한다.
- Modify `.bouncer/context/index.md` — 61개 기존 에픽과 061 행을 각 frontmatter description에서 재생성한다.
- Modify `.bouncer/context/epics/001-cli-usability/index.md` — 현재 실제 색인 행을 description으로 역방향 backfill한다.
- Modify `.bouncer/context/epics/002-commit-artifacts/index.md` — 현재 실제 색인 행을 description으로 역방향 backfill한다.
- Modify `.bouncer/context/epics/003-multi-agent-plugin/index.md` — 현재 실제 색인 행을 description으로 역방향 backfill한다.
- Modify `.bouncer/context/epics/004-starter-kit-convergence/index.md` — 현재 실제 색인 행을 description으로 역방향 backfill한다.
- Modify `.bouncer/context/epics/005-review-depth/index.md` — 현재 실제 색인 행을 description으로 역방향 backfill한다.
- Modify `.bouncer/context/epics/006-scripts-typescript/index.md` — 현재 실제 색인 행을 description으로 역방향 backfill한다.
- Modify `.bouncer/context/epics/007-project-distill/index.md` — 현재 실제 색인 행을 description으로 역방향 backfill한다.
- Modify `.bouncer/context/epics/008-worktree-seed/index.md` — 현재 실제 색인 행을 description으로 역방향 backfill한다.
- Modify `.bouncer/context/epics/010-active-pointer-cli/index.md` — 현재 실제 색인 행을 description으로 역방향 backfill한다.
- Modify `.bouncer/context/epics/011-graphify-signal/index.md` — 현재 실제 색인 행을 description으로 역방향 backfill한다.
- Modify `.bouncer/context/epics/012-finalize-handoff/index.md` — 현재 실제 색인 행을 description으로 역방향 backfill한다.
- Modify `.bouncer/context/epics/039-release-security/index.md` — 현재 실제 색인 행을 description으로 역방향 backfill한다.
- Modify `.bouncer/context/epics/016-advisor-removal/index.md` — Intent 목표에서 description을 저술한다.
- Modify `.bouncer/context/epics/017-verify-wrapper-guidance/index.md` — Intent 목표에서 description을 저술한다.
- Modify `.bouncer/context/epics/018-task-unit-commits/index.md` — Intent 목표에서 description을 저술한다.
- Modify `.bouncer/context/epics/019-task-pointer/index.md` — Intent 목표에서 description을 저술한다.
- Modify `.bouncer/context/epics/020-task-unit-artifacts/index.md` — Intent 목표에서 description을 저술한다.
- Modify `.bouncer/context/epics/021-task-commit-stage/index.md` — Intent 목표에서 description을 저술한다.
- Modify `.bouncer/context/epics/022-blueprint-closure/index.md` — Intent 목표에서 description을 저술한다.
- Modify `.bouncer/context/epics/023-worktree-layout/index.md` — Intent 목표에서 description을 저술한다.
- Modify `.bouncer/context/epics/024-light-path/index.md` — Intent 목표에서 description을 저술한다.
- Modify `.bouncer/context/epics/038-distill-worktree-base/index.md` — Intent 목표에서 description을 저술한다.
- Modify `.bouncer/context/epics/040-scope-evidence/index.md` — Intent 목표에서 description을 저술한다.
- Modify `.bouncer/context/epics/041-plan-mermaid-zoom/index.md` — Intent 목표에서 description을 저술한다.

#### Constraints

- 사람은 epic frontmatter `description`만 수정하고 색인 행은 그 값에서 재생성한다.
- 강화된 S13과 기존 데이터 보정은 같은 커밋에 둔다. 어느 중간 상태에서도 새 검사가 저장소 자체를 실패시키는 커밋을 만들지 않는다.
- `type`, `resource`, `timestamp`, `bouncer.id`, `epic_id`, status와 기존 epic 본문은 바꾸지 않는다. backfill은 `description`만 수정한다.
- 기존 `024` 중복 id는 경로 문자열 전체로 구분한다. 이번 작업에서 번호를 재할당하거나 둘 중 하나를 supersede하지 않는다.
- `scripts/lib/*.js`는 손으로 편집하지 않고 `npm run build`로만 재생성한다.
- 색인 행 label과 순서는 기존 값을 보존하고 description 부분만 정본에 맞춘다. 경로 누락·초과·legacy prefix에 대한 기존 S13 메시지와 판단은 유지한다.
- Goal과 Interface에서 다루는 모든 파일은 Touch와 최종 `affected_paths`의 닫힌 집합 안에 있어야 한다.
- 새 명령·의존성·파일은 만들지 않는다. 기존 `scaffold epic`, frontmatter parser, `ensureEpicIndexEntry`를 재사용하는 것이 재생성 계약을 충족하는 가장 짧은 표면이다.
