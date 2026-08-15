---
type: bouncer.blueprint
title: Distill base를 현재 checkout 기준으로 해석
description: Blueprint 001
resource: .bouncer/context/epics/038-distill-worktree-base/blueprints/001-checkout-relative-distill/index.md
tags:
  - bouncer
  - blueprint
timestamp: '2026-08-15T14:26:51.349+09:00'
bouncer:
  id: '001'
  epic_id: '038'
  blueprint_id: '001'
  status: closed
  commit_type: fix
  scale: full
---
# 001 checkout-relative-distill

Epic: [038](../../index.md)

## Intent
- 문제: `distill.ts`의 `resolveProjectRoot`가 전달받은 root를 무조건
  `runtimePaths().projectRoot`로 다시 매핑한다. 그래서 `--repo`는 "어느
  저장소"만 고를 뿐 "어느 checkout"은 고를 수 없고, finalize의 승격 쓰기는
  main worktree로, remainder 커밋은 execute worktree로 갈린다.
- 완료 조건: Distill base가 현재 checkout 우선으로 해석되고, finalize가 그
  base를 CLI payload에서 받아 승격을 쓴다.

## Contract
- 인터페이스:
  - `scripts/src/lib/distill.ts`가 `resolveDistillRoot({ repoRoot, runtime })`를
    export한다. 판정 순서는 세 단계다.

    ```
    1) `${repoRoot}/.bouncer/Distill.md`가 존재하면 → repoRoot
    2) runtimePaths가 유효하면                      → paths.projectRoot
    3) 그 외 (Git 미초기화·단위 테스트)             → repoRoot
    ```

  - `readShards`는 이 해석기를 그대로 쓰고, 반환의 `repoRoot`가 해석된 base다.
  - `bouncer distill`의 JSON payload `repoRoot`가 그 base의 절대 경로다.
    (`distillPayload`가 이미 노출하므로 새 필드를 만들지 않는다.)
  - **cwd 계약**: `/bouncer-finalize`의 승격 audit은 `--repo` 없이, `bouncer
    finalize`가 커밋할 checkout과 **같은 cwd**에서 실행한다. 해석기만 고치고
    `--repo`를 지우면, 세션 cwd가 main worktree일 때 base가 다시 main으로
    돌아가 이 버그가 그대로 남는다. 두 명령의 cwd 일치가 이 blueprint의 핵심
    계약이다.
- 데이터·상태: 문서 frontmatter도 `.bouncer/config.json`도 새 키를 얻지 않는다.
  Distill 인덱스 형식(`distill.version` / `shards`)은 그대로다.
- 수용 기준: 에픽 성공 조건 1–5.
- 검증 명령: `npm test`
- 실패 모드·엣지 케이스:
  - linked checkout에 Distill이 없음(`.bouncer/`를 gitignore한 프로젝트) →
    main worktree 폴백. 그 경우 Distill은 애초에 커밋 대상이 아니라 누락도 없다.
  - Git 저장소가 아님 → `distill` 명령은 지금처럼 stderr + exit 1.
  - shard 인덱스가 없거나 무효 → CLI의 단일 파일 폴백 유지. 해석기 변경이
    폴백 판정에 끼어들지 않는다.
  - execute 브랜치의 Distill이 base 브랜치보다 오래됨 → 일반 머지 문제로 두고
    차단하지 않는다.
  - `runtimePaths`가 throw → 기존처럼 삼켜서 전달받은 root로 폴백한다.
  - checkout에 `.bouncer/Distill.md`는 있는데 `.bouncer/config.json`은 없음 →
    `readConfig`가 빈 결과를 주고 `routingEnabled`가 인덱스 flag로 떨어진다
    (`cli-project-commands.ts:136-151`의 기존 fail-open). base를 옮겨도 이
    분기를 바꾸지 않는다.
  - base 이동은 `readShards`의 다른 소비자(`scope.ts:31`,
    `context-digest.ts:133`)가 **어느 인덱스 파일을 읽는지**도 바꾼다.
    의도된 변화이며 `## Contract` 수용 기준에 포함한다.

## Out of scope
- 이슈 방안 B(cross-worktree 복사·원복)와 별도 탐지 가드.
- `bouncer project-root` 명령의 반환값. 여전히 main worktree를 출력한다.
- `commit-safety` / `commit-guard` / `runtime-state` / `scope.ts`.
- `skills/bouncer-plan`·`bouncer-execute`·`bouncer-run`의 Distill 프로즈.
  세 스킬은 CLI stdout만 소비하므로 경로 계약이 바뀌지 않는다.

## One-commit justification
- 커밋 단위는 task 문서다. 001은 해석기와 CLI 배선 + 실행 가능한 테스트,
  002는 그 위에 얹히는 하드룰·스킬 프로즈 계약이다. 리뷰 관점이 서로 달라
  나눴고, blueprint 하나가 PR 하나로 남는다.

## Documents
* [Tasks 001](tasks/001/tasks.md) - CLI 해석기 구현 브리프
* [Verification 001](tasks/001/verification.md) - 검증 명령과 증적
* [Review 001](tasks/001/review.md) - 리뷰 발견사항
* [Tasks 002](tasks/002/tasks.md) - 승격 경로 계약 구현 브리프
* [Verification 002](tasks/002/verification.md) - 검증 명령과 증적
* [Review 002](tasks/002/review.md) - 리뷰 발견사항
* [Context review](context-review.md) - 계획 문서 정합성 판정
