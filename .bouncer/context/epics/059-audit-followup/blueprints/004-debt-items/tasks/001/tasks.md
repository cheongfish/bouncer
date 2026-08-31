---
type: bouncer.tasks
title: 따옴표 명령어 커밋 탐지 보강
description: 명령어 위치에서 따옴표가 섞인 git 실행을 탐지하면서 인용 인자의 오탐을 막는다
resource: .bouncer/context/epics/059-audit-followup/blueprints/004-debt-items/tasks/001/tasks.md
tags:
  - bouncer
  - tasks
timestamp: '2026-08-31T10:40:22.463+09:00'
bouncer:
  id: TASKS-001
  epic_id: '059'
  blueprint_id: '004'
  status: verified
  verify: npm run ci
  commit_intent:
    - 따옴표가 섞인 git 실행이 커밋 가드를 우회하는 빈틈을 막음
    - 명령어 위치와 인자 위치를 구분해 기존 오탐 방지 계약을 유지함
  affected_paths:
    - scripts/src/lib/commit-hook.ts
    - scripts/lib/commit-hook.js
    - test/commit-hook.test.js
    - docs/security.md
  scope_evidence:
    producer: graphify
    generated_at: '2026-08-31T10:55:16+09:00'
    suggested_paths:
      - scripts/src/lib
      - test
      - .bouncer/context/epics/059-audit-followup/blueprints/004-debt-items/tasks/002
      - .bouncer/context/epics/059-audit-followup/blueprints/004-debt-items/tasks/003
      - .bouncer/context/epics/059-audit-followup/blueprints/004-debt-items/tasks/004
    # 유효 엔트리 필드: graph, status, query, result — 예시는 주석이라 파싱되지 않는다
    # - graph: source | context
    #   status: updated | reused | fail-skip | skip-disabled | missing
    #   query: <graphify 조회>
    #   result: <한 줄 요약>
    basis:
      - graph: source
        status: reused
        query: quoted git command commit hook token detection shell wrappers
        result: 95 hits; top paths scripts/src/lib/commit-hook.ts and test/session-graph.test.js
      - graph: context
        status: reused
        query: quoted git command commit hook audit followup debt items
        result: 9 hits; current BP004 task briefs were the only relevant context paths
---
# Tasks

Blueprint: [004](../../index.md)

<!-- scope_evidence.basis 엔트리 필드: graph, status, query, result.
     graph: source | context
     status: updated | reused | fail-skip | skip-disabled | missing
     프론트매터 값은 []로 둔다. 이 주석을 실제 엔트리로 옮기면 빈 계획이 승인된다. -->

## Goal & intent
명령어 위치에서 `"git" commit`과 `g"it" commit`을 커밋으로 탐지한다. 따옴표 안의 단순 언급과 커밋 메시지 인자는 계속 데이터로 취급하며 `npm run ci`로 검증한다.

## Interface
- 제공: `isGitCommit()`이 첫 명령어 토큰의 값이 `git`이면 전체 또는 일부가 인용됐어도 git argv로 해석한다. 이 경로에서도 `commit`, alias, `-a` 판정은 기존 로직을 그대로 사용한다.
- 거부: `echo "git" commit`, `echo "git commit"`, `git log --grep "commit"`, `docker commit`은 커밋으로 판정하지 않는다. `git commit -m "-a"`의 메시지는 all-flag가 아니다.

## Touch
- Modify `scripts/src/lib/commit-hook.ts` — 명령어 위치의 인용된 `git` 토큰만 허용하도록 탐지 조건을 좁혀 보강한다.
- Modify `scripts/lib/commit-hook.js` — TypeScript 변경의 커밋 대상 런타임 산출물을 갱신한다.
- Modify `test/commit-hook.test.js` — B8 재현 입력과 인자 위치 오탐 방지 배터리를 추가한다.
- Modify `docs/security.md` — 커밋 가드가 탐지하는 인용 명령어와 여전히 보장하지 않는 위협 경계를 기록한다.

## Do not touch
- `scripts/src/lib/commit-guard.ts` — staged 경로 허용 판정은 B8의 명령 문자열 탐지와 별개다.
- `hooks/commit-safety.js` — 훅 어댑터와 exit code 계약은 바꾸지 않는다.
- `docs/gates.md` — 게이트 코드·판정 조건 변경이 아니다.

## Constraints
- 커밋 가드는 실수 방지 장치이며 악의적 우회를 막는 완전한 셸 파서가 아니다.
- 판단 불가 입력의 fail-closed와 `-a`/`--all` 검사 범위는 그대로 유지한다.
- 생성 JavaScript는 `npm run build`로 만들고 손으로 TypeScript와 다른 로직을 쓰지 않는다.

## Checklist
- [ ] B8 재현과 오탐 방지 테스트를 추가한다.
  ```js
  assert.strictEqual(isGitCommit('"git" commit -m x'), true);
  assert.strictEqual(isGitCommit('g"it" commit -m x'), true);
  assert.strictEqual(isGitCommit('echo "git" commit'), false);
  assert.strictEqual(isGitCommit('git commit -m "-a"'), true);
  ```
- [ ] `node --test test/commit-hook.test.js`를 실행해 두 재현 입력이 실패하는지 확인한다.
- [ ] 첫 명령어 토큰에 한해서 인용 여부와 무관하게 값 `git`을 허용하고 기존 subcommand·all-flag 판정을 재사용한다.
- [ ] 보안 문서의 탐지 표와 비보장 범위를 새 동작에 맞춘다.
- [ ] `npm run build`와 `npm run ci`가 통과한다.
