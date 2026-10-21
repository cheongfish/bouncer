---
type: bouncer.blueprint
title: legacy epic blueprint를 도메인 epic으로 옮기는 이관 명령
description: Move legacy epic blueprints under domain epics while old trailers keep resolving
resource: .bouncer/context/epics/context-search/blueprints/legacy-epic-merge/index.md
tags:
  - bouncer
  - blueprint
  - epic-registry
  - migration
  - stable-id
  - trailer
timestamp: '2026-10-20T21:01:49.382+09:00'
bouncer:
  id: legacy-epic-merge
  epic_id: context-search
  blueprint_id: legacy-epic-merge
  status: closed
  order: 2
  commit_type: feat
  scale: full
  review_scope: blueprint
  verification_policy: scoped_terminal
  attribution: 수용 기준의 중심이 등록부·식별자 해석과 컨텍스트 문서 이관이라 context-search 영역이다
  supersedes: []
---
# legacy-epic-merge

Epic: [context-search](../../index.md)

## Intent
- legacy epic 63개 아래 blueprint를 도메인 epic 8개 아래로 옮기는 `bouncer migrate merge-legacy-epics` 명령을 추가하고, 옮긴 뒤에도 옛 trailer로 설계 의도를 조회할 수 있게 함.
- 같은 PR에서 v2 등록부를 잘못 읽는 `plan inspect` 요약과 finalize trailer 조회의 등록부 누락을 바로잡음.

## Contract
- 인터페이스:
  - `bouncer migrate merge-legacy-epics [--yes] [--repo <dir>]`를 추가한다. `--yes`가 없으면 dry-run이고 디스크를 쓰지 않는다. 알 수 없는 option은 exit 2로 거절한다.
  - `bouncer plan inspect`의 `registry`는 v2에서 `epics[].dir`를 `.bouncer/context/epics/<slug>`로, `legacy[]`를 실제 legacy 디렉터리로 낸다. v2 `nextEpicId`는 항상 `null`이다.
  - `normalizeStableId`는 legacy 항목의 `moved_to`가 가리키는 도메인 epic slug로 번호 trailer와 legacy slug trailer를 정규화한다.
- 데이터·상태:
  - 등록부 v2 legacy 항목에 선택 필드 `moved_to: Record<bp-slug, domain-epic-slug>`를 둔다. 값은 같은 등록부의 `kind: domain` epic slug여야 하고, 어기면 S35다. `kind`, `legacy_id`, `blueprint_aliases`는 그대로 둔다.
  - 이관은 blueprint 디렉터리를 `epics/<domain>/blueprints/<bp-slug>`로 옮기고, 문서 안 식별자·경로·파생 해시를 `migrate context-slugs`와 같은 규칙(원래 공식과 일치한 값만 재계산)으로 다시 쓴다. legacy epic 디렉터리에는 `index.md`만 남고, 그 안의 blueprint 링크는 새 경로로 바뀐다.
  - 옮긴 blueprint의 `order`는 대상 epic의 기존 최댓값 뒤에 (legacy_id 오름차순, 원래 order) 순서로 붙는다.
  - 매핑은 각 도메인 epic `index.md`의 `## Legacy epic 귀속` 링크 목록과 `### 다른 epic에서 이 영역으로 귀속되는 blueprint` 예외 표에서 결정적으로 만든다.
- 수용 기준:
  1. v2 등록부 fixture에서 `plan inspect`가 도메인 epic의 실제 `dir`와 legacy 목록을 낸다.
  2. `moved_to`가 있는 등록부로 번호·legacy slug trailer가 `<domain>/<bp>[/<ddd>]`로 정규화되고, finalize trailer 조회가 등록부를 넘긴다.
  3. fixture에서 dry-run은 쓰기 0회로 이동·충돌·누락을 보고하고, `--yes` 적용 뒤 blueprint 수가 같고 옮긴 blueprint 전부 `validateBlueprint`를 통과한다.
  4. 적용 뒤 옛 trailer로 `resolveTaskCommits`가 새 위치 task를 찾는다.
  5. `npm run ci`가 통과한다.
- 검증 명령: 태스크별 `node --test …`, terminal `npm run ci`.
- 실패 모드·엣지 케이스:
  - blueprint의 대상 도메인 epic이 0개이거나 2개 이상이면 `merge-mapping-invalid`로 거절하고 아무것도 쓰지 않는다.
  - 예외 표의 legacy 번호나 blueprint 번호가 등록부에 없으면 `merge-mapping-invalid`다.
  - 예외 표 셀은 `NNN`, `NNN~MMM`, `NNN <slug>` 항목의 쉼표 목록만 해석한다. 범위 끝이나 번호가 별칭에 없거나 slug가 별칭과 다르면 `merge-mapping-invalid`다. 항목이 없는 자유 서술 행은 dry-run의 `unresolved_rows`로 보고하고, 그 값이 남아 있으면 `--yes` 적용을 `merge-mapping-invalid`로 거절한다(행 정규화는 적용 전 main의 governance 편집이다).
  - 대상 epic 안에서 slug가 겹치면 `migrate-slug-conflict`로 거절한다.
  - pointer·승인 파일·ledger·연결 worktree가 있으면 `migrate-in-progress`, 작업 트리가 더러우면 `migrate-dirty-tree`, 등록부가 없으면 `migrate-registry-missing`, 깨졌으면 S35다.
  - 적용 도중 실패하면 `migrate-failed`와 복구 명령(`git restore --staged --worktree .bouncer && git clean -fd .bouncer/context`)을 낸다. 자동 롤백은 없다.
  - 이미 옮겨져 이동할 blueprint가 없으면 쓰기 없이 성공한다.

## Out of scope
- 이 저장소에 이관을 실제로 적용하는 일. 병합 뒤 main에서 dry-run 결과를 보이고 사용자 승인을 받아 드라이브 밖에서 실행한다.
- legacy blueprint의 status 변경(draft 1개·approved 46개는 그대로 옮긴다).
- legacy epic 디렉터리와 등록부 legacy 항목 삭제.
- `area` 태깅과 공통 epic 이관(REQ-13의 소비 프로젝트 기능).
- `RegistryEpic.id` 타입을 선택 필드로 바꾸는 일.
- 소스 책임 분해.

## One-commit justification
- 등록부 필드·식별자 해석·이관 명령이 "옮겨도 옛 trailer가 이어진다"는 한 계약을 이루므로 한 PR로 리뷰한다.
