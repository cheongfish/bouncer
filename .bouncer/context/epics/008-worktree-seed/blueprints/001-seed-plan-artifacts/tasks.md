---
type: bouncer.tasks
title: plan 산출물을 worktree로 옮기는 하니스 명령을 추가함
description: Tasks for 001
resource: .bouncer/context/epics/008-worktree-seed/blueprints/001-seed-plan-artifacts/tasks.md
tags:
  - bouncer
  - tasks
timestamp: '2026-08-03T05:30:59.813Z'
bouncer:
  id: TASKS-001
  epic_id: '008'
  blueprint_id: '001'
  status: verified
  affected_paths:
    - scripts/src/lib/seed-worktree.ts
    - scripts/src/lib/cli.ts
    - scripts/lib/seed-worktree.js
    - scripts/lib/cli.js
    - skills/bouncer-execute/SKILL.md
    - test/seed-worktree.test.js
    - test/skill-bouncer-execute.test.js
    - test/cli-help.test.js
    - docs/cli.md
    - docs/workflow.md
    - docs/troubleshooting.md
    - .bouncer/context/index.md
  graph:
    generated_at: '2026-08-03T05:40:00.000Z'
    command: graphify query
    suggested_paths:
      - scripts/lib/
      - test/
    basis: graphify query "seed worktree copy plan context artifacts finalize makeAllowed cli usage execute worktree"; BFS depth=2 from makeAllowed()/finalize() hit finalize.js, cli.js (runCli/parseFlags/cmd*), paths.js (epicDirOf/toPosix), current.js and their tests — rolled up to scripts/lib/ and test/. The graph indexes the CJS emit only, and this snapshot is stale (it still lists removed profile.js / import-superpowers.js nodes), so the TypeScript sources under scripts/src/lib, skills/, docs/ and .bouncer/context were seeded into affected_paths manually.
---
# Tasks

Blueprint: [001](index.md)

## Goal & intent
`bouncer seed-worktree --blueprint <dir> --to <worktree-abs>`를 추가하고
`/bouncer-execute` step 2가 `git worktree add` **직후 base cwd에서** 이를
호출하게 한다. 완료 후 worktree에는 `tasks.md`를 포함한 plan 컨텍스트 산출물이
존재해 브리프가 성립하고, base 체크아웃에는 plan ghost `??`/`M`이 남지 않는다.
수용 기준은 Epic Success criteria 1–7. 검증: `npm run build && npm test`.

## Interface
- 제공 (CLI): `bouncer seed-worktree --blueprint <dir> --to <worktree-abs>
  [--repo <dir>]`. 결과 JSON을 stdout에 출력. 성공 0, 실패 1, 사용법 오류 2.
  USAGE 본문과 `docs/cli.md` 표에 한 줄씩 노출.
- 제공 (라이브러리): `scripts/src/lib/seed-worktree.ts`가
  `seedWorktree({ repoRoot, blueprintDir, worktreePath, git })`와 실제 git
  포트를 export한다. 포트 모양은 `finalize.realGit`을 따라 주입 가능하게 둔다:
  `changedFiles()` / `untrackedFiles()` / `existsInHead(path)` /
  `restore(path)` / `unstage(path)`.
- 제공 (결과): 성공 `{ ok: true, moved: [...], restored: [...] }` —
  `moved`는 worktree로 복사한 상대경로, `restored`는 base에서 HEAD로 되돌린
  상대경로. 실패 `{ ok: false, reason, ... }`.
- 거부: `--blueprint` 또는 `--to` 누락 → stderr 사용법 + 종료 코드 2.
  worktree에 같은 상대경로가 이미 있고 내용이 다름 → `reason: 'conflict'` 실패,
  base 무변경. 대상 집합 밖의 dirty 파일(예: `.bouncer/config.json`,
  `affected_paths` 코드) → 수집하지 않음.
- 유지: 기존 게이트 코드·스키마·`makeAllowed`·`.bouncer/current` 형식 불변.
  `scripts/src` 수정 후 `npm run build`로 `scripts/lib` CJS emit을 맞춘다.

## Touch
- Create `scripts/src/lib/seed-worktree.ts` — 대상 수집·복사·base 정리·JSON
  결과. `paths.epicDirOf` / `paths.toPosix` / `scaffold.CONTEXT_ROOT`를 재사용
- Modify `scripts/src/lib/cli.ts` — `seed-worktree` 서브커맨드 dispatch와
  USAGE 한 줄 추가
- Create `scripts/lib/seed-worktree.js` — `npm run build` CJS emit
- Modify `scripts/lib/cli.js` — `npm run build` CJS emit
- Modify `skills/bouncer-execute/SKILL.md` — step 2에서 `git worktree add`
  직후 base cwd 호출을 명시하고, 이후 cwd는 worktree라는 기존 규칙을 유지
- Create `test/seed-worktree.test.js` — 수집·복사·정리 분기와 실패 모드
- Modify `test/skill-bouncer-execute.test.js` — step 2가 seed 호출을 담는지
  표면 어서션 추가
- Modify `test/cli-help.test.js` — `SUBCOMMANDS`에 `seed-worktree` 추가
- Modify `docs/cli.md` — 명령 표에 한 줄
- Modify `docs/workflow.md` — execute 단계 설명에 seed 한 줄
- Modify `docs/troubleshooting.md` — "base에 EPIC 문서가 `??`로 남고 PR에도
  있음 → seed 누락 또는 구버전 스킬" 행 추가
- Modify `.bouncer/context/index.md` — 008 인덱스 줄

## Do not touch
- `scripts/src/lib/finalize.ts` — allowed-set 계약을 참조만 하고 바꾸지 않는다
- `scripts/src/lib/validate.ts` — 게이트 코드·본문 계약 불변
- `scripts/src/lib/schema.ts` — 새 kind·필드 없음
- `scripts/src/lib/current.ts` — 포인터 형식 불변
- `scripts/src/lib/runtime-state.ts` — worktree 루트 결정 로직 불변
- `hooks/` — commit-safety 배선 변경 없음
- `package.json` — 의존성·스크립트 불변
- `skills/bouncer-plan/SKILL.md` — plan은 여전히 base에서 문서를 쓴다

## Constraints
- 파괴적 동작 순서를 지킨다: 복사 → 내용 일치 확인 → base 정리. `git checkout --`
  와 `git rm --cached`는 되돌릴 수 없으므로, 복사가 실패했거나 충돌이면 base는
  한 글자도 건드리지 않고 중단한다.
- base 제거 분기는 반드시 HEAD 존재 여부로 판단한다 (`git cat-file -e
  HEAD:<path>` 성공 여부). staged 신규 파일에 `git checkout --`를 쓰면
  `pathspec did not match`로 깨진다 — 단일 경로 구현 금지.
- 이전 대상은 닫힌 집합이다. `affected_paths` 코드·`.bouncer/context/Distill.md`
  ·로컬 전용 dirty는 대상 밖이며, 대상 판정은 `finalize.makeAllowed`의 컨텍스트
  기본 허용 규칙과 같은 경계를 쓴다.
- 새 런타임 의존성을 추가하지 않는다. Node 내장(`node:fs`, `node:path`,
  `node:child_process`)과 기존 헬퍼만 쓴다 (minimality).
- 테스트는 실제 `git` 저장소를 임시 디렉터리에 만들거나 주입된 git 포트를 쓴다.
  개발자 저장소의 실제 상태에 의존하지 않는다.
- 공개 문자열(USAGE·문서)은 기존 언어 관례를 따른다 — USAGE는 영어,
  `docs/` 본문은 한국어.
- TypeScript 소스 변경 후 커밋 전에 `npm run build`로 emit을 맞춘다.

## Checklist
- [ ] 실패 테스트 먼저 작성 (`test/seed-worktree.test.js`):
      - 새 epic 문서가 순수 untracked → worktree로 복사되고 base에서 삭제됨
      - tracked dirty `.bouncer/context/index.md` → 복사 후 base는 HEAD로 복원,
        `restored`에 포함
      - **staged 신규 파일**(`git add`한 `verification.md` 등) →
        `git rm --cached` 후 삭제로 성공, base clean
      - 대상 없음 → `{ ok: true, moved: [], restored: [] }`
      - worktree에 다른 내용의 같은 경로 존재 → `ok: false`, `reason: 'conflict'`,
        base 파일은 그대로
      - 복사 실패(예: `--to`가 없는 경로) → base 무변경으로 중단
      - 대상 밖 dirty(`.bouncer/config.json`)는 `moved`/`restored`에 없고 base에 남음
- [ ] 위 테스트가 현재 코드에서 실패함을 확인
- [ ] `scripts/src/lib/seed-worktree.ts` 구현 — 수집은
      `git diff --name-only HEAD`(staged 포함) + `git ls-files --others
      --exclude-standard`를 합치고, blueprint dir 트리 / `<epicDir>/index.md` /
      `.bouncer/context/index.md`로 필터
- [ ] CLI 배선: `cli.ts`에 `cmdSeedWorktree` + `case 'seed-worktree'`, USAGE에
      ```
      seed-worktree --blueprint <dir> --to <worktree>
                    Move plan context artifacts into a fresh worktree.
      ```
- [ ] `test/cli-help.test.js`의 `SUBCOMMANDS`에 `seed-worktree` 추가하고 통과 확인
- [ ] `skills/bouncer-execute/SKILL.md` step 2에 worktree add 직후 호출 블록 추가
      (base cwd에서 실행, `--to "${WORKTREE_PATH}"`), 표면 테스트에
      `assert.match(body, /seed-worktree/)` 어서션 추가
- [ ] `docs/cli.md` · `docs/workflow.md` · `docs/troubleshooting.md` 갱신
- [ ] `.bouncer/context/index.md`에 008 줄 추가
- [ ] `npm run build`로 `scripts/lib/seed-worktree.js` · `scripts/lib/cli.js` emit
- [ ] `npm test` 전체 통과
- [ ] 수용: Epic Success criteria 1–7이 테스트·문서로 판정 가능
