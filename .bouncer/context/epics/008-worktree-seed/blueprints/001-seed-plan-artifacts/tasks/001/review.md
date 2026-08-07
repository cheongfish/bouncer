---
type: bouncer.review
title: 001 review
description: Review for 001
resource: .bouncer/context/epics/008-worktree-seed/blueprints/001-seed-plan-artifacts/tasks/001/review.md
tags:
  - bouncer
  - review
timestamp: '2026-08-03T05:30:59.813Z'
bouncer:
  id: REVIEW-001
  epic_id: '008'
  blueprint_id: '001'
  status: accepted
  review:
    required: true
    findings:
      - severity: blocker
        status: resolved
        summary: 실제 worktree에는 HEAD 사본이 이미 있어 tracked dirty 대상이 항상 conflict로 실패했다
      - severity: blocker
        status: resolved
        summary: git checkout -- 는 index에서 복원하므로 staged 수정이 base에 ghost로 남으면서 restored로 보고됐다
      - severity: major
        status: resolved
        summary: 테스트의 worktree가 빈 임시 디렉터리여서 위 두 결함을 가렸다
      - severity: minor
        status: resolved
        summary: base에서 삭제된 문서가 ENOENT를 던져 라이브러리 계약을 깼다
      - severity: nit
        status: accepted
        summary: moved가 "복사한 경로"보다 넓은 의미로 쓰인다
        note: 호출자는 브리프 가독 여부를 확인하는 데 쓰므로 worktree에 존재하게 된 모든 대상을 담는 편이 유용하다. 동작 유지, 코드 주석으로 명시.
      - severity: nit
        status: resolved
        summary: USAGE 항목이 다른 서브커맨드의 한 줄 설명 형식을 깼다
      - severity: minor
        status: resolved
        summary: core.autocrlf 환경에서 git show 원본 블롭과 smudge된 체크아웃을 비교해 pristine 사본을 다시 conflict로 판정했다
      - severity: minor
        status: resolved
        summary: base에서 삭제된 문서를 건너뛰어 base에 D ghost가 남았다
---
# Review

리뷰 기준은 `tasks.md`의 Goal & intent / Interface / Touch / Do not touch /
Constraints / Checklist. diff 기준은 `develop`과 worktree 작업본(미커밋) +
untracked. 리뷰어는 읽기 전용 서브에이전트, 처분은 컨트롤러가 기록했다.

## Findings

- **[blocker · resolved] 실제 worktree에서 tracked dirty 대상이 항상 conflict**
  `git worktree add`가 만든 체크아웃에는 tracked 파일이 이미 HEAD 내용으로
  존재한다. 최초 구현은 "worktree에 파일이 있고 내용이 다르면 conflict"만 봤기
  때문에, epic마다 반드시 수정되는 `.bouncer/context/index.md`가 언제나 충돌로
  잡혀 명령이 exit 1로 끝나고 아무것도 seed되지 않았다. 판정을 3분기로 고쳤다 —
  base 사본과 동일하면 skip, HEAD 블롭과 동일하면 pristine 체크아웃이므로
  덮어쓰기, 둘 다 아니면 conflict (`scripts/src/lib/seed-worktree.ts` phase 1).
- **[blocker · resolved] staged 수정이 base에 ghost로 남음**
  `git checkout -- <path>`는 index에서 복원하므로, 이미 `git add`된 tracked
  문서는 dirty 내용 그대로 남는데도 결과는 `restored`로 성공을 보고했다.
  `git checkout HEAD -- <path>`로 바꿔 index와 working tree를 함께 되돌린다.
- **[major · resolved] 테스트가 위 두 결함을 가림**
  `--to` 대상이 빈 `mkdtemp` 디렉터리여서 pristine 체크아웃 경로를 한 번도
  타지 않았다. 실제 `git worktree add -q --detach`로 대상을 만들고, tracked
  문서의 staged 수정 케이스를 추가했다.
- **[minor · resolved] 삭제된 대상에서 ENOENT**
  `git diff --name-only HEAD`는 삭제도 보고하므로 `readFileSync`가 예외를
  던져 `{ ok: false, reason }` 계약이 깨졌다.
- **[nit · accepted] `moved`의 의미가 Interface보다 넓음**
  worktree에 이미 동일 내용으로 있어 복사를 건너뛴 대상도 `moved`에 담긴다.
  호출자는 브리프를 읽을 수 있는지 확인하는 용도로 쓰므로 현재 동작이 더
  유용하다고 판단해 유지하고, 코드 주석에 의미를 명시했다.
- **[nit · resolved] USAGE 형식** — 설명을 다른 서브커맨드와 같은 한 줄로 줄였다.
- **[minor · resolved] autocrlf 환경에서 conflict 재발**
  `git show HEAD:<path>`는 필터를 적용하지 않은 블롭을 주므로 CRLF로 smudge된
  체크아웃과 바이트가 달라 첫 번째 결함이 그대로 재현됐다.
  `git cat-file --filters HEAD:<path>`로 바꾸고 `core.autocrlf=true` 회귀
  테스트를 추가했다.
- **[minor · resolved] 삭제된 문서의 `D` ghost**
  옮길 것이 없더라도 base는 HEAD로 돌아가야 한다. 삭제된 대상도 phase 2에서
  복원하되 복사한 적이 없으므로 `moved`가 아니라 `restored`로만 보고한다.

수정 후 `npm run build && npm test` 261/261, `npm run lint`·`tsc --noEmit`
모두 통과. Do not touch 위반 없음, 변경 파일은 모두 Touch 목록 안.
