# 컨텍스트 문서 버전관리

**`.bouncer/`는 `runtime/`을 뺀 전체를 커밋합니다.** 설계 전제입니다.
`/bouncer-finalize`는 코드 변경과 그 blueprint의 문서를 **한 커밋에 함께** 담습니다.
문서를 gitignore하면 게이트를 통과했다는 증적(각 `tasks/<NNN>/verification.md`의 종료 코드,
`affected_paths` 승인 기록)이 로컬에만 남고 리뷰어에게 도달하지 않아, 이 도구의
존재 이유가 사라집니다.

| 대상 | 방침 | 누가 커밋하나 |
| --- | --- | --- |
| `.bouncer/context/**` | 커밋 | `/bouncer-finalize`가 코드·plan 문서와 함께 |
| `.bouncer/config.json` | 커밋 | **사용자가 `/bouncer-init` 직후 별도 커밋으로** |
| `graphify-out/` | 제외 | `-` (`.gitignore`, init이 안내) |
| 활성 blueprint 포인터 | 제외 | `$GIT_COMMON_DIR/bouncer/pointers/<epic-id>/<blueprint-id>.json` — JSON `{blueprint, task?, base}` (`task`는 task 문서 상대 경로, 없으면 미지정). cwd가 중첩·유일 평면 worktree면 그 key만 선택하고, 기준 checkout은 포인터가 하나일 때만 선택한다. 레거시 `$GIT_COMMON_DIR/bouncer/current`는 충돌 없는 첫 `--set`에서 namespace로 이관한다 |
| execute worktree | 제외 | `<repo>/.worktrees/<epic id>/<blueprint id>` (gitignore / finalize 무시; 이미 열린 평면 `.worktrees/<blueprint id>`만 재사용) |
| integration worktree | 제외 | `<repo>/.worktrees/<epic id>/<blueprint id>/integration` — branch `bouncer/<epic id>-<blueprint id>-integration`. coordinator 주행의 fan-in 대상 |
| worker worktree | 제외 | `<repo>/.worktrees/<epic id>/<blueprint id>/workers/<NNN>` — branch `bouncer/<epic id>-<blueprint id>-<NNN>`. ready wave가 연 task마다 하나 |
| coordinator 원장 | 제외 | `<integration worktree>/.bouncer/runtime/coordinator.json` — 실행 상태이지 컨텍스트 문서가 아니다 (gitignore / 커밋 범위 검사 무시; init이 `.gitignore` 항목을 안내) |

verify 원장(`$GIT_COMMON_DIR/bouncer/verify/<digest>.json`)은 verification 문서
상대경로 digest로 이미 task별로 갈려 있다. 포인터 namespace는 그 원장 경로를
바꾸지 않는다.

문서 골격(템플릿)과 제품 규칙(`rules/governance.md` · `rules/okf.md`),
세션 마스터 룰(`CLAUDE.md` / `AGENTS.md`)은 프로젝트에 설치되지 않습니다.
scaffold와 finalize PR 본문은 플러그인 내장값(`scripts/lib/templates.js`)만
사용합니다.

## 부트스트랩은 왜 따로 커밋해야 하나

`.bouncer/config.json`은 blueprint가 커밋할 수 있는 범위에 **없습니다.** 그래서
커밋하지 않은 채로 두면 첫 `/bouncer-finalize`가 out-of-scope로 중단됩니다.
게다가 `/bouncer-plan`이 활성 blueprint를 기록하고 나면 커밋 가드가
`affected_paths` 밖 파일을 막으므로, **`/bouncer-init`과 `/bouncer-plan` 사이**가
이 커밋을 남길 수 있는 유일한 구간입니다.

```bash
git add .bouncer/config.json .bouncer/context && git commit -m "chore: bootstrap bouncer"
```

## coordinator 실행 상태의 버전·정리 경계

coordinator 원장(`.bouncer/runtime/coordinator.json`)은 **런타임 상태**이지
컨텍스트 문서가 아닙니다. `.bouncer/context/**`와 달리 커밋하지 않습니다.

원장은 integration worktree 안에 있으므로, main checkout에서 보면
`.worktrees/…` 아래 경로입니다 — 커밋 범위 검사는 `.worktrees/`를 runtime
artifact로 무시하니 그 자리에서는 걸리지 않습니다. integration worktree
자신의 커밋 범위에서도 마찬가지입니다: `.bouncer/runtime/`이 runtime artifact
목록에 있어 스테이징돼도 `out-of-scope`로 보고되지 않고, `bouncer init`이
권하는 `.gitignore` 항목에도 있어 새 저장소는 처음부터 원장을 추적하지
않습니다. 규칙은 `.bouncer/runtime/` 한 갈래에만 적용되므로
`.bouncer/context/**`는 그대로 커밋 대상입니다.

| | 원장 | 컨텍스트 문서 |
| --- | --- | --- |
| 어디 있나 | integration worktree 안 | 저장소 트리 |
| 커밋하나 | 아니오 | 예 |
| 언제 사라지나 | 그 integration worktree가 제거될 때 | 지우지 않음(finalize의 일회성 정리 제외) |
| 무엇의 정본인가 | 주행 중 task 상태·현재 scope·결정 로그 | 그 커밋이 왜 그 범위였는지에 대한 기록 |

원장은 주행 하나의 수명 동안만 정본입니다. 주행이 `blocked`로 끝나면 원장과
두 worktree를 **그대로 둡니다** — 그것이 재개 지점이고, 지우면 이미 `recorded`
상태인 worker SHA와 결정 로그를 함께 잃습니다. 정리는 `/bouncer-finalize`가
blueprint를 닫을 때 한 번만 합니다.

주행이 끝난 뒤 남는 장기 증적은 원장이 아니라 커밋된 것들입니다.

- 각 task 커밋과 integration branch의 이력 — 무엇이 어떤 순서로 들어갔는지
- task 문서의 `affected_paths`와 `scope_revision` — 마지막 개정이 남긴 범위
- BP `explain.md` — finalize가 남기는 이해 증적

원장의 결정 로그는 append-only지만 커밋되지 않으므로, 리뷰어에게 도달해야 하는
판단은 task 문서와 커밋 메시지에도 남아야 합니다.

## 문서는 그 시점의 기록입니다

커밋 이후 코드만 고치면 task 문서(`tasks/<NNN>/tasks.md`)는 과거 상태로 남습니다.
컨텍스트 문서는 **그 커밋이 왜 그 범위였고 무엇으로 검증됐는지에 대한 기록**입니다.
최신 상태로 유지하려 들지 마세요. 범위가 바뀌면 새 blueprint를 만드세요.

예외는 `/bouncer-finalize`의 일회성 정리뿐입니다. G16을 통과한 remainder 커밋에서
`tasks/<NNN>/tasks.md`, `tasks/<NNN>/verification.md`, `tasks/<NNN>/review.md`,
있을 때의 `context-review.md`를 지우고, `explain.md`는 장기 증적으로 남깁니다.
닫힌 Blueprint를 다시 열어 고치지 말고, 후속은 sibling Blueprint나 새 Epic으로
계획하세요. 상세는
[context-retention-and-epic-lifecycle.md](context-retention-and-epic-lifecycle.md)에
있습니다.

PR diff의 문서 노이즈가 부담이면 GitHub 기준으로 접힘 처리할 수 있습니다.

```
# .gitattributes
.bouncer/context/** linguist-generated=true
```

## 정본 epic/blueprint id

정본 경로는 `epics/014-slug/blueprints/001-slug`처럼 접두 없는 숫자 id다.
구형 `EPIC-`/`BP-` 접두가 붙은 경로·frontmatter는 validate가 거절한다.
자동 이관 CLI는 제공하지 않는다. 구형 루트 task 문서는
`bouncer migrate task-layout`으로 `tasks/<NNN>/` 묶음으로 옮긴다.
