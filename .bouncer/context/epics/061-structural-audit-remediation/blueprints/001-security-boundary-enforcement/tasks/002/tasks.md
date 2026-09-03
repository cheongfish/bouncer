---
type: bouncer.tasks
title: 호스트 독립적 커밋 범위 가드
description: Routes CLI commits through the shared scope guard and documents host enforcement parity.
resource: .bouncer/context/epics/061-structural-audit-remediation/blueprints/001-security-boundary-enforcement/tasks/002/tasks.md
tags:
  - bouncer
  - tasks
timestamp: '2026-09-03T12:08:12.305+09:00'
bouncer:
  id: TASKS-002
  epic_id: '061'
  blueprint_id: '001'
  status: ready
  affected_paths:
    - scripts/src/lib/commit.ts
    - scripts/src/lib/commit-guard.ts
    - test/commit-task.test.js
    - test/cli-commit.test.js
    - test/commit-hook.test.js
    - docs/compatibility.md
  scope_evidence:
    producer: graphify
    generated_at: '2026-09-03T12:18:00.000+09:00'
    suggested_paths: []
    # 유효 엔트리 필드: graph, status, query, result — 예시는 주석이라 파싱되지 않는다
    # - graph: source | test | context
    #   status: updated | reused | fail-skip | skip-disabled | missing
    #   query: <graphify 조회>
    #   result: <한 줄 요약>
    # quality/candidates는 graph-suggest 뒤에만 채운다 — scaffold가 제조하지 않는다
    quality:
      status: low-confidence
      confidence: low
      reasons:
        - 'context seeds: 5 labels, 8 paths'
        - 'relation filter: calls, imports, imports_from (depth ≤ 2); contains ownership only'
        - 'result explosion: 69 candidates (≥ 50)'
    candidates:
      implementation: []
      test: []
      context: []
    basis:
      - graph: source
        status: reused
        query: commit scope guard host hook CLI compatibility
        result: source graph reused; graph-suggest returned low-confidence after 69 candidates
      - graph: test
        status: reused
        query: commit scope guard host hook CLI compatibility
        result: test graph reused; no reliable path suggestions
      - graph: context
        status: reused
        query: commit scope guard host hook CLI compatibility
        result: context graph reused; no reliable path suggestions
---
# Tasks

Blueprint: [001](../../index.md)

<!-- scope_evidence.basis 엔트리 필드: graph, status, query, result.
     graph: source | test | context
     status: updated | reused | fail-skip | skip-disabled | missing
     quality/candidates는 graph-suggest 결과로만 채운다(scaffold는 비워 둔다).
     프론트매터 값은 []로 둔다. 이 주석을 실제 엔트리로 옮기면 빈 계획이 승인된다. -->

## Goal & intent
<!-- 구현자가 다른 문서 없이 시작할 수 있게.
     수용 기준과 검증 명령도 여기에 적거나 Checklist에 명시한다. -->
CLI의 task 커밋과 호스트 훅이 동일한 `checkCommitSafety` 판정을 사용하도록 범위 검사를 단일화한다. 훅이 없는 호스트에서도 범위 밖 파일은 staging 전에 거부하고, 호스트별 집행 경로를 호환성 문서에서 확인할 수 있게 한다.

## Interface
<!-- 계약이 리뷰에서 검증 가능하도록 제공하는 것과 거부하는 것을 함께 적습니다. -->
- 제공: `commitTask`와 commit hook이 같은 `allow`·`violations` 결과를 사용하고, Claude·Cursor·Codex·Antigravity 각각에 대해 hook 존재 여부, CLI 직접 집행 여부, 범위 밖 변경의 기대 결과를 문서화한다.
- 거부: `affected_paths` 밖의 변경은 훅 유무와 `--yes` 여부에 관계없이 staging·commit 전에 거부한다.

## Touch
<!-- frontmatter bouncer.affected_paths의 모든 경로가 여기서 정당화되어야 합니다 (G11).
     디렉터리가 아니라 파일 단위로, 동사(Create/Modify/Delete/Rename)를 붙입니다.
     디렉터리 하나로 뭉치면 그 안 모든 파일이 열려 G11이 사실상 통과만 합니다.
     경로는 백틱으로 감쌉니다. -->
- Modify `scripts/src/lib/commit.ts` — 중복 범위 판정을 `checkCommitSafety` 호출로 통합함.
- Modify `scripts/src/lib/commit-guard.ts` — 공통 입력·위반 결과 계약을 고정함.
- Modify `test/commit-task.test.js` — task 커밋의 범위 거부를 검증함.
- Modify `test/cli-commit.test.js` — 훅 없는 직접 CLI 호출을 검증함.
- Modify `test/commit-hook.test.js` — hook·CLI 판정 일치를 검증함.
- Modify `docs/compatibility.md` — 네 호스트의 훅·CLI 집행 매트릭스를 기록함.

## Do not touch
<!-- 여기 적은 경로가 affected_paths와 겹치면 G12가 막습니다.
     epic / blueprint의 Out of scope에서 이어받습니다. -->
- `scripts/src/lib/verification.ts` — 검증 실행 경계는 task 001에서 소유함.
- `test/verification-runner.test.js` — 검증 argv 계약은 task 001에서 검증함.

## Constraints
<!-- 경로로 표현되지 않는, 작업 전체에 걸리는 규칙. 허용된 파일 안에서도 지켜야 합니다.
     예: 하위 호환 별칭을 남기지 않는다 / 기존 게이트 번호와 본문 계약을 유지한다 /
     공개 문자열은 한국어를 유지한다.
     막을 대상이 경로뿐이면 Do not touch에 적습니다. -->
- `makeAllowed`와 runtime artifact 예외를 유지하고 허용·거부 로직을 어댑터에 복제하지 않음.
- 새 의존성과 호스트별 우회 경로를 만들지 않음.

## Checklist
<!-- 각 항목은 구현자가 순서대로 실행 가능해야 합니다.
     행위를 바꾸는 항목은 실패 테스트 → 실패 확인 → 구현 순서로 적습니다.
     기대하는 assertion·상수·명령은 코드블록으로 그대로 적어 해석 여지를 없앱니다.
     blueprint Contract에서 이연된 테스트 본문·구현 시퀀스가 들어올 자리입니다.
     수용 기준·검증 명령을 체크 항목으로 포함하세요. -->
- [ ] task 커밋·CLI·hook의 허용·거부 케이스를 먼저 고정하고 현재 구현의 결과를 확인함.
- [ ] `commitTask`가 변경·untracked 파일을 공통 가드에 전달하도록 통합함.
- [ ] staging 전에 범위 밖 변경이 중단되고 hook·CLI 결과가 일치하는지 검증함.
- [ ] Claude·Cursor·Codex·Antigravity를 행으로, hook 유무·CLI 가드·범위 밖 변경 결과를 열로 갖는 매트릭스를 문서화하고 `npm test`를 실행함.
