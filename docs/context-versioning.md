# 컨텍스트 문서 버전관리

**`.bouncer/` 전체를 커밋합니다.** 설계 전제입니다.
`/bouncer-finalize`는 코드 변경과 그 blueprint의 문서를 **한 커밋에 함께** 담습니다.
문서를 gitignore하면 게이트를 통과했다는 증적(각 `tasks/<NNN>/verification.md`의 종료 코드,
`affected_paths` 승인 기록)이 로컬에만 남고 리뷰어에게 도달하지 않아, 이 도구의
존재 이유가 사라집니다.

| 대상 | 방침 | 누가 커밋하나 |
| --- | --- | --- |
| `.bouncer/context/**` | 커밋 | `/bouncer-finalize`가 코드·plan 문서와 함께 |
| `.bouncer/Distill.md` | 커밋 (에이전트 런타임 주의) | finalize가 BP explain에서 승격·교체·폐기 |
| `.bouncer/config.json` | 커밋 | **사용자가 `/bouncer-init` 직후 별도 커밋으로** |
| `graphify-out/` | 제외 | `-` (`.gitignore`, init이 안내) |
| 활성 blueprint 포인터 | 제외 | `$GIT_COMMON_DIR/bouncer/current` — JSON `{blueprint, task?, base}` (Git 공통 디렉터리; `task`는 task 문서 상대 경로, 없으면 미지정) |
| execute worktree | 제외 | `<repo>/.worktrees/<epic id>/<blueprint id>` (gitignore / finalize 무시; 이미 열린 평면 `.worktrees/<blueprint id>`만 재사용) |

문서 골격(템플릿)과 제품 규칙(`docs/governance.md` · `workflow.md` · `okf.md`),
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
git add .bouncer && git commit -m "chore: bootstrap bouncer"
```

## 문서는 그 시점의 기록입니다

커밋 이후 코드만 고치면 task 문서(`tasks/<NNN>/tasks.md`)는 과거 상태로 남습니다.
컨텍스트 문서는 **그 커밋이 왜 그 범위였고 무엇으로 검증됐는지에 대한 기록**입니다.
최신 상태로 유지하려 들지 마세요. 범위가 바뀌면 새 blueprint를 만드세요.

PR diff의 문서 노이즈가 부담이면 GitHub 기준으로 접힘 처리할 수 있습니다.

```
# .gitattributes
.bouncer/context/** linguist-generated=true
```

## 구형 `EPIC-`/`BP-` 명명에서 올리기

정본 경로는 `epics/014-slug/blueprints/001-slug`처럼 숫자 id다. 구형 접두가 붙은
트리가 남아 있으면 SessionStart(Claude/Codex)가 안내한다. 먼저
`bouncer migrate ids --dry-run`으로 계획을 확인하고 `bouncer migrate ids`를
적용한다(`migrate-ids` 스킬과 동일). migrate 전에는 validate가 구형 명명을
거절한다. Cursor는 SessionStart가 없으므로 CLI·스킬만 쓴다.
