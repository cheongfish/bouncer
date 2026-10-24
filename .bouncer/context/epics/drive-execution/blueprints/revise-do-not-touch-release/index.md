---
type: bouncer.blueprint
title: 범위 개정 시 수정 금지 경로 명시 해제
description: coordinate revise releases conflicting Do not touch entries in the same revision so a revised task brief never forbids its own scope.
resource: .bouncer/context/epics/drive-execution/blueprints/revise-do-not-touch-release/index.md
tags:
  - bouncer
  - blueprint
  - coordinator
  - scope-revision
  - do-not-touch
  - task-brief
timestamp: '2026-10-23T19:42:33.546+09:00'
bouncer:
  id: revise-do-not-touch-release
  epic_id: drive-execution
  blueprint_id: revise-do-not-touch-release
  status: closed
  order: 66
  commit_type: feat
  scale: full
  review_scope: blueprint
  verification_policy: scoped_terminal
  review_contract: brief
  attribution: coordinate revise의 범위 개정과 task brief 수정 금지 목록 정합은 bouncer-run 실행 단계 동작이다
  supersedes: []
---
# 범위 개정 시 수정 금지 경로 명시 해제

Epic: [drive-execution](../../index.md)

## Intent
- 범위 개정으로 넓힌 경로가 같은 task brief의 수정 금지 목록에 남아 worker가 모순된 지시를 받는 일을 방지함.
- 겹치는 수정 금지 항목을 명시적으로 해제할 때만 범위 개정을 허용하고, 해제 내역을 같은 revision의 판단 기록으로 남김.

## Contract
- 인터페이스: `bouncer coordinate revise`에 반복 가능한 `--release-do-not-touch <p>`를 추가한다. 값은 task 문서 `## Do not touch`(또는 `## 절대 수정 금지`) 절에 적힌 경로 토큰과 같은 표기다. 기존 `--paths`·`--new-path`·`--reason`·fence 인자 의미는 바뀌지 않는다.

  ```text
  reviseTaskScope({ ..., releaseDoNotTouch?: string[] })
    → { ok: true, revision, previous, paths, revoked?, warnings?, releasedDoNotTouch? }
    | { ok: false, reason: 'scope-do-not-touch-conflict' | 'release-do-not-touch-unknown', paths: string[] }
    | { ok: false, reason: <기존 거절 코드> }
  ```
- 용어:
  - 충돌 항목: 직전 승인 scope(`previous`)에 없던 새 scope 경로와 `pathsOverlap`으로 겹치는 Do not touch 경로 토큰이다. 예: 새 경로 `packages/cli/bin/bouncer`, Do not touch `- \`packages/cli/bin/bouncer\``.
  - 경로 토큰: `extractPathCandidates`가 Do not touch 절에서 뽑는 값(백틱 경로와 경로 모양의 민 단어)이다.
- 데이터·상태:
  - 성공 시 task 문서의 `affected_paths`·`scope_revision`과 본문 Do not touch 절의 해제 토큰 제거를 파일 쓰기 한 번에 기록한다. 그 뒤 원장 쓰기 순서와 잠금 재확인 규칙은 지금과 같다.
  - 해제가 있을 때만 원장 scope decision과 성공 결과에 `releasedDoNotTouch`(해제 토큰 배열)를 둔다. 해제가 없으면 두 출력 모두 지금과 바이트가 같다.
  - 본문이 바뀌므로 `taskBriefHash`가 바뀌고, `coordinate next`는 기존 규칙대로 재디스패치를 안내한다.
- 수용 기준:
  1. 충돌 항목이 있는데 해제 목록이 그 집합을 덮지 않으면 `scope-do-not-touch-conflict`(남은 충돌 토큰을 `paths`에)로 exit 1이고 task 문서·원장 바이트가 바뀌지 않는다.
  2. 해제 목록에 충돌 항목이 아닌 값이 있으면 `release-do-not-touch-unknown`(그 값들을 `paths`에)으로 exit 1이고 바이트가 바뀌지 않는다.
  3. 해제 목록이 충돌 집합과 같으면 frontmatter·본문·원장이 한 revision으로 바뀌고, 해제 토큰이 Do not touch 절에서 사라지며 나머지 항목은 남는다.
  4. 충돌이 없고 해제 플래그도 없는 기존 호출의 stdout·task 문서·원장은 지금과 같다.
  5. 두 새 거절 코드는 `cause`·`next` 힌트를 갖고, help·`rules/cli.md`·`revise` 카드가 플래그와 거절을 설명한다.
- 검증 명령: TASKS-001은 `node --test test/commit-task.test.js test/cli-coordinate.test.js test/cli-help.test.js`, terminal TASKS-002는 `npm run ci`.
- 실패 모드·엣지 케이스:
  - 디렉터리 항목: Do not touch `hooks/`와 새 경로 `hooks/x.js`는 겹친다. 해제 값은 하위 경로가 아니라 토큰 `hooks/` 그대로여야 한다.
  - 한 줄에 토큰이 여럿: 해제 토큰과 바로 붙은 쉼표 구분자만 지운다. 해제 토큰이 나온 줄에 남은 경로 토큰이 없으면 그 줄을 지우고, 해제 토큰이 없던 줄(경로 없는 산문 금지 포함)은 그대로 둔다.
  - 경로 토큰이 없는 산문 금지("모든 source 경로" 등)는 충돌로 판정하지 못한다. 기계 판정은 plan gate와 같은 경로 토큰 규칙에 한정하며, 이 한계를 받아들인다.
  - Do not touch 절이 없거나 비어 있으면 충돌이 없다. 그때 해제 플래그를 주면 `release-do-not-touch-unknown`이다.
  - `previous`에 이미 있던 경로는 충돌 검사 대상이 아니다. 계획 때 이미 승인된 관계를 다시 묻지 않는다.
  - 판정 순서: 기존 glob·out-of-bounds·추적 검사 다음, 문서 쓰기 앞에서 충돌을 검사한다. 잠금을 잃으면 문서도 원장도 쓰지 않는다.
  - 값 없는 `--release-do-not-touch`는 usage 오류(exit 2)다.

## Out of scope
- `## Touch` 절에 새 경로를 자동으로 추가하는 일.
- `coordinate next` judge `fields`, `repair --resume-task` 허용 조건, `run detach`의 in-flight 거절 조건 변경.
- runtime-packaging TASKS-003의 실제 재개(revise·revoke·새 attempt). 병합 뒤 운영 단계로 사용자 승인을 받아 수행한다.
- npm 런타임 분리의 릴리스 파이프라인 blueprint와 이 checkout의 훅 `BOUNCER_HOME` 판정 문제.
- 원장 decision 검증기(`runtime-state.ts`)와 다른 coordinator 명령의 출력 형식.

## One-commit justification
- 해제 판정, 본문 편집, CLI 플래그, 거절 힌트, 문서가 한 계약을 이룬다. 일부만 들어가면 플래그 없이 막히거나 문서가 없는 거절이 생긴다. 구현은 commit task 하나이고 전체 검증은 terminal task가 맡는다.
