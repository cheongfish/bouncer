---
type: bouncer.blueprint
title: task 단위 커밋 단계 신설과 finalize 축소
description: Blueprint 001
resource: .bouncer/context/epics/021-task-commit-stage/blueprints/001-commit-stage/index.md
tags:
  - bouncer
  - blueprint
timestamp: '2026-08-07T14:13:08.438+09:00'
bouncer:
  id: '001'
  epic_id: '021'
  blueprint_id: '001'
  status: approved
  commit_type: feat
  commit_intent:
    - 커밋 단위는 task인데 마감이 blueprint 하나에 묶여 있어 task가 늘수록 커밋 제목과 이해 기록이 서로 덮임
    - task 하나를 닫는 단계를 떼어내고 finalize는 blueprint를 PR로 내보내는 일만 맡게 함
---
# task 단위 커밋 단계 신설과 finalize 축소

Epic: [021](../../index.md)

## Intent
- 문제: `finalize`가 커밋·이해 기록·PR·정리를 한 함수와 한 스킬에 담고 있다.
  subject는 blueprint `title` 고정이라 task마다 같은 문장이 반복되고,
  `explain.md`의 `comprehension`은 한 벌뿐이라 두 번째 task를 마감하면 첫
  기록이 사라진다. `base..HEAD` 해시도 task가 늘 때마다 어긋난다.
- 완료 조건: `bouncer commit`이 task 하나를 닫고, `bouncer finalize`가
  blueprint 하나를 마감한다. 두 단계가 각자의 게이트(`commit`/`finalize`)를
  갖고, epic 021 Success criteria 1~8을 만족한다.

## Contract
- 인터페이스
  - `scripts/src/lib/finalize.ts`: `buildCommitMessage(docs, taskUnit)`의
    subject가 대상 task `title`(없으면 blueprint `title`), 배경·의도가 대상
    task `bouncer.commit_intent` → blueprint `commit_intent` 순으로 결정된다.
  - `scripts/src/lib/commit.ts` (신규): `commitTask({ repoRoot, blueprintDir,
    yes, git })`가 dry-run/커밋과 다음 열린 task **후보 계산**을 담당한다.
    포인터는 옮기지 않는다 — 이동은 확인 후 `bouncer current --set`뿐이라는
    기존 결정을 유지한다. 범위 검사(`makeAllowed`)와 런타임 산출물 제외는
    `finalize.ts`의 기존 export를 재사용한다.
  - `scripts/src/lib/finalize.ts`: `finalize(...)`가 스테이징·커밋을 더 이상
    하지 않고, 마감 게이트 판정과 다음 blueprint 계산, 포인터 clear만 한다.
  - CLI: `bouncer commit --blueprint <dir> [--yes]`,
    `bouncer validate --gate commit`.
  - 새 스킬 `skills/bouncer-commit/SKILL.md`. `/bouncer-execute`는 커밋을
    하지 않고, `/bouncer-finalize`는 PR과 정리만 한다.
- 데이터·상태
  - `explain.md` `bouncer.comprehension`이 객체에서 **엔트리 배열**로 바뀐다.
    엔트리는 `task`(`\d{3}`), `range_from`, `range_to`, `diff_sha`,
    `quiz_score`, `disposition`, `recorded_at`.
  - `range_from`은 첫 엔트리에서 포인터 `base`, 이후 엔트리에서는 직전
    엔트리의 `range_to`. `range_to`는 기록 시점 `HEAD` sha.
  - `scaffold explain`의 기본값이 `comprehension: []`이다.
  - task `tasks.md` frontmatter에 선택 필드 `bouncer.commit_intent`(정확히
    2줄)가 추가된다. 없으면 blueprint 값으로 떨어진다.
  - 게이트 배치: G15는 `commit` 게이트로 옮겨 포인터 task 엔트리만 판정하고,
    `finalize` 게이트는 새 코드 G16을 쓴다.
- 수용 기준: epic 021 Success criteria 1~8.
- 검증 명령: `npm test`
- 실패 모드·엣지 케이스
  - 포인터에 task가 없거나 지목한 문서가 사라짐 — 019/020이 정한 폴백(번호가
    가장 앞선 묶음)을 그대로 쓴다. 새 해석기를 만들지 않는다.
  - `commit_intent`가 1줄이거나 3줄 이상 — 현행처럼 무효로 보고 다음 출처로
    떨어진다. task가 무효면 blueprint, 그것도 무효면 배경·의도 bullet 없음.
  - 구 형식(객체) `comprehension` — `commit` 게이트가 형식 불일치로 명시
    거절한다. 자동 변환하지 않는다.
  - 같은 task 번호 엔트리가 두 개 — 마지막 것을 쓰지 않고 형식 오류로 거절한다.
  - 커밋할 변경이 하나도 없음 — dry-run은 빈 스테이징으로 성공하고, 커밋
    단계는 빈 커밋을 만들지 않는다.
  - `commit` 실행 시 범위 밖 파일이 남아 있음 — 아무것도 스테이징하지 않고
    중단한다(현행 finalize의 hard abort와 같다).
  - 같은 blueprint에 열린 task가 남은 채로 finalize — G16 실패. 남은 task
    번호를 실패 메시지에 담는다.
  - 두 번째 task의 execute에서 worktree가 이미 있음 — 새로 만들지 않고
    재사용하고 `seed-worktree`만 다시 돌린다.
  - 직전 task의 커밋이 다음 task의 `range_from..HEAD`에 섞임 — governance
    문서는 해시 제외 경로라 값이 흔들리지 않는다.
  - 자기 저장소를 고치는 동안의 도구 스큐 — CLI는 `BOUNCER_HOME`이 가리키는
    이 저장소에서 즉시 반영되지만, 워크플로 스킬과 commit-safety 훅은 설치된
    플러그인 캐시에서 온다. 003 이후 이 blueprint의 task는 `bouncer commit`을
    직접 호출해 닫고, 캐시 스킬의 옛 마감 경로를 쓰지 않는다.

## Out of scope
- 머지된 blueprint 잠금 status와 그 게이트 규칙.
- worktree 디렉터리 위치 변경(`.worktrees/<epic-id>/<bp-id>`)과 브랜치 이름 규칙.
- PR 제목·본문 형식, `templates.ts`의 `pr.md`.
- 완료된 blueprint의 `explain.md`를 새 형식으로 옮기는 마이그레이션 도구.
- `computeDiffSha`의 제외 경로(`.bouncer/context/`)와 해시 방식.
- `bouncer migrate` 계열, graphify, init.

## One-commit justification
- 한 커밋이 아니다. 커밋 메시지·이해 기록·새 CLI·게이트 재배치·스킬 문서가
  서로를 전제해서 하나로 묶으면 리뷰가 불가능하다. task 5개로 나눠 각각
  커밋하고 blueprint 하나를 PR 단위로 삼는다.
- 005가 스킬과 공개 문서를 한꺼번에 바꾼다. `/bouncer-commit` 신설과 execute·
  finalize의 책임 이동은 같은 문장 집합을 건드려서, 나누면 중간 커밋의 문서가
  존재하지 않는 단계를 가리킨다.

## Documents
* [Tasks 001](tasks/001/tasks.md) - 커밋 메시지 출처
* [Tasks 002](tasks/002/tasks.md) - 이해 기록과 G15
* [Tasks 003](tasks/003/tasks.md) - `bouncer commit`과 commit 게이트
* [Tasks 004](tasks/004/tasks.md) - finalize 축소와 G16
* [Tasks 005](tasks/005/tasks.md) - 스킬과 문서
<!-- explain.md는 plan scaffold에 포함되지 않습니다. /bouncer-finalize가 작성합니다. -->
