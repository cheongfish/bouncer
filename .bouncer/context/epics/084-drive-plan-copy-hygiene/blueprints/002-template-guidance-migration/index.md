---
type: bouncer.blueprint
title: 템플릿 안내 주석을 스킬 문서로 이전
description: Move scaffold template guidance comments into spec-authoring and reviewer docs, strip them from full templates, and reject leftover legacy comments at the plan gate and bootstrap.
resource: .bouncer/context/epics/084-drive-plan-copy-hygiene/blueprints/002-template-guidance-migration/index.md
tags:
  - bouncer
  - blueprint
  - scaffold-template
  - spec-authoring
  - plan-gate
timestamp: '2026-10-02T12:23:54.450+09:00'
bouncer:
  id: '002'
  epic_id: '084'
  blueprint_id: '002'
  status: closed
  commit_type: refactor
  scale: full
  review_scope: blueprint
  supersedes: []
---
# 002 template-guidance-migration

Epic: [084](../../index.md)

## Intent
스캐폴드 템플릿의 안내 주석을 작성 스킬과 리뷰 문서로 옮기고 템플릿에서 지워 시드 사본에 주석이 남지 않게 함.
이미 만들어진 초안에 남은 옛 주석은 plan gate와 bootstrap에서 막아 종단 CI 실패로 이어지지 않게 함.

## Contract
- 인터페이스:
  - `scripts/src/lib/templates.ts`: `TEMPLATES`의 epic·blueprint·tasks·verification-tasks·review·context-review·explain 본문에서 HTML 주석을 모두 지운다. 제목, TODO 자리표시, 고정 문구는 그대로 둔다. `SCAFFOLD_COMMENT_BODIES`는 `LEGACY_SCAFFOLD_COMMENT_BODIES`(현재 주석 본문을 고정한 리터럴 배열)로 바꾸고, 판정 함수를 export한다.
    ```ts
    const LEGACY_SCAFFOLD_COMMENT_BODIES: readonly string[]; // 정규화된 본문, 동결
    function findLegacyScaffoldComments(body: string): string[]; // 일치한 정규화 본문
    ```
  - 공용 스캐너 `scanLegacyScaffoldComments({ repoRoot, blueprintDir }): string[]`(새 모듈 `scripts/src/lib/legacy-comments.ts`): epic `index.md`와 blueprint 디렉터리 아래 모든 `.md`(index, tasks, verification, review, context-review, explain 포함) 중 옛 주석이 있는 파일의 저장소 상대 경로를 정렬해 돌려준다. G22와 bootstrap이 같은 파일 집합을 쓰게 하는 유일한 지점이다.
  - plan gate: 새 코드 **G22** — 스캐너 결과가 비어 있지 않으면 `scaffold guidance comments remain: <rel>[, <rel>]…`로 거절한다. `rules/gates.md` Plan rules에 등록한다.
  - `coordinate bootstrap`: worktree를 만들기 전에 메인에서 같은 스캐너를 돌려 `{ ok: false, reason: 'scaffold-comment-remaining', paths }`로 거절한다. `COORDINATE_FAILURE_HINTS`에 같은 이름의 힌트를 추가한다.
  - `lint:context-comments`: 판정 출처만 `findLegacyScaffoldComments`로 바꾸고 동작은 그대로다.
- 데이터·상태: 상태 전이 없음. 주석 판정 집합은 앞으로 템플릿이 바뀌어도 늘거나 줄지 않는 동결 상수다.
- 기준선: BP-001이 `scripts/src/lib/coordinator.ts`와 `CHANGELOG.md`를 먼저 고친다. 이 blueprint는 BP-001이 `develop`에 병합된 뒤의 head에서 시작한다. tasks에 적힌 줄 번호는 병합 전 기준이라 위치 안내일 뿐이다. 심볼 이름으로 찾는다.
- 수용 기준: epic 성공 기준 8–11.
- 검증 명령: `npm run ci`
- 실패 모드·엣지 케이스:
  - 저자가 쓴 주석(옛 본문과 정규화 결과가 다름)은 G22·bootstrap·lint 어디서도 거절하지 않는다.
  - 줄 끝·들여쓰기만 다른 옛 주석은 `normalizeCommentBody`로 같은 것으로 본다.
  - light 템플릿은 원래 주석이 없어 바뀌지 않는다.
  - 빈 explain 절은 주석이 없어도 G16이 계속 거절한다.
  - bootstrap 거절은 integration worktree·branch·원장을 만들지 않는다. 재개(원장 존재) bootstrap은 seed하지 않으므로 검사하지 않는다.

## Out of scope
- 이미 커밋된 옛 계획 문서 코퍼스의 주석 정리
- epic·blueprint 본문 TODO 자리표시 게이트
- `PR_TEMPLATE` 변경 (주석이 없다)
- review-dispatch plan draft 검사(`checkPlanDraft`)에 G22 추가

## One-commit justification
- TASKS-001은 안내를 옮겨 받을 문서를, TASKS-002는 템플릿 주석 삭제와 동결 상수를, TASKS-003은 그 상수를 쓰는 G22·bootstrap 거절을 한 커밋씩 닫는다. 안내가 먼저 자리를 잡아야 주석을 지워도 작성 정보가 사라지지 않는다. TASKS-004는 통합 head의 전체 CI를 확인한다.

## Documents
* [Task 001](tasks/001/tasks.md) - 작성·리뷰 안내를 스킬 문서로 이전
* [Task 002](tasks/002/tasks.md) - 템플릿 주석 삭제와 동결 상수
* [Task 003](tasks/003/tasks.md) - 옛 주석 G22·bootstrap 거절
* [Task 004](tasks/004/tasks.md) - 종단 CI 검증
* [Review](review.md) - 리뷰 발견사항
* [Context review](context-review.md) - 계획 문서 정합성 판정
