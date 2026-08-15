---
type: bouncer.context_review
title: 001 context review
description: Context review for 001
resource: .bouncer/context/epics/038-distill-worktree-base/blueprints/001-checkout-relative-distill/context-review.md
tags:
  - bouncer
  - context_review
timestamp: '2026-08-15T14:26:51.349+09:00'
bouncer:
  id: CTXREVIEW-001
  epic_id: '038'
  blueprint_id: '001'
  status: accepted
  context_review:
    findings:
      - id: CR-001
        severity: blocker
        status: resolved
      - id: CR-002
        severity: major
        status: resolved
      - id: CR-003
        severity: major
        status: resolved
      - id: CR-004
        severity: minor
        status: resolved
      - id: CR-005
        severity: minor
        status: resolved
      - id: CR-006
        severity: minor
        status: resolved
      - id: CR-007
        severity: minor
        status: resolved
      - id: CR-008
        severity: minor
        status: accepted
        note: >-
          읽기 base(main worktree)와 쓰기 base(현재 checkout)가 갈리는 것은
          되돌릴 결함이 아니라 의도된 선택이다. plan/execute/run은 stdout만
          소비하고, 다른 blueprint가 base 브랜치에 먼저 병합된 뒤에는 main이
          더 최신이라 읽기 쪽이 낫다. 세 스킬까지 checkout 기준으로 옮기면
          이번 범위를 넘고 이득도 없어, 경계를 없애는 대신 epic Intent에
          명시하는 쪽으로 정정했다.
---
# Context review

## Findings

- **CR-001 — blocker — resolved.** task 002가 `PROJECT_ROOT` 프리플라이트를
  걷어내면서, 승격 audit을 **어느 cwd에서** 실행하는지를 어디에도 적지 않았다.
  `--repo`만 지우고 세션 cwd가 main worktree이면 해석기가 main을 돌려주어
  보고된 버그가 그대로 살아남는데, 그 상태로도 성공 조건 1~3·5는 모두
  통과한다. blueprint Contract에 cwd 계약을 추가하고, task 002의 Interface·
  Checklist·프로즈 테스트에 "step 1 audit과 step 3 `bouncer finalize`가 같은
  checkout"이라는 요구를 넣었다.

- **CR-002 — major — resolved.** epic 성공 조건 4(execute worktree에서
  `finalize --yes` 시 Distill·shard가 staged에 포함)를 검증하는 항목이 어느
  Checklist에도 없었다. `test/finalize.test.js`를 task 001의 Touch와
  `affected_paths`에 넣고, linked checkout 기준 `finalize --yes`의 `staged`를
  단정하는 회귀를 Checklist에 추가했다.

- **CR-003 — major — resolved.** task 001 Constraints가 `scope.ts`·
  `context-digest.ts`는 "상대 경로만 쓰므로 영향 없음"이라고 적었는데 사실이
  아니다. 해석기는 *어느 인덱스 파일을 읽을지*를 정하므로 base가 옮겨지면
  `makeFinalizeAllowed`의 허용 집합과 digest 후보가 그 checkout의 인덱스에서
  나온다. 문구를 사실대로 고치고, 커밋 대상 checkout의 인덱스로 판정하는 것이
  옳다는 근거를 남겼다. scope 쪽 영향은 CR-002로 추가한
  `test/finalize.test.js` 회귀가 덮는다.

- **CR-004 — minor — resolved.** `resolveDistillRoot({ repoRoot, runtime })`만
  적으면 `readShards`의 기존 인자 병합
  (`runtime || suppliedRuntimePaths || suppliedPaths`)이 사라져 `paths` /
  `runtimePaths` 호출자가 조용히 폴백으로 떨어진다. 병합을 그대로 보존하라는
  Constraint와 Checklist 문구를 넣었다.

- **CR-005 — minor — resolved.** Distill은 있는데 `config.json`은 없는
  checkout에서 `routingEnabled`가 인덱스 flag로 떨어지는 기존 fail-open이
  실패 모드 목록에 없었다. blueprint Contract 실패 모드와 task 001
  Constraints에 추가했다.

- **CR-006 — minor — resolved.** 폴백 fixture 두 개의 전제가 빠져 있었다.
  main의 Distill이 tracked면 linked checkout에도 체크아웃되어 1단계에 걸리므로
  커밋하지 않은 상태여야 하고, symlink된 `os.tmpdir()`에서는 `runtimePaths`의
  `path.resolve` 결과와 fixture 경로가 어긋난다. 두 조건을 Checklist에 명시했다.

- **CR-007 — minor — resolved.** `test/distill.test.js`가 빌드 산출물
  `../scripts/lib/distill`을 import하므로 첫 red는 단정 실패가 아니라 missing
  export다. 순서를 `npm run build` → 테스트로 바로잡고, 첫 red의 성격을 명시해
  구현자가 잘못된 신호로 읽지 않게 했다.

- **CR-008 — minor — accepted.** frontmatter `note` 참조.
