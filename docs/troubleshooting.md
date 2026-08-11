# 막혔을 때

| 증상 | 원인과 대처 |
| --- | --- |
| `G10 tasks missing implementation-ready sections` | 해당 섹션 본문이 비어 있습니다. 헤딩만으로는, 또 템플릿 안내 주석만으로는 통과하지 않습니다 |
| `G10 tasks sections still contain <TODO: …> placeholders` | 템플릿 placeholder를 실제 내용으로 바꾸지 않았습니다 |
| `G4 tasks.graph.basis missing or empty` | `/bouncer-plan`의 그래프 단계를 건너뛰었습니다. `basis`는 비어 있지 않은 레거시 문자열 또는 엔트리 배열(`graph`/`status`/`query`/`result`; `status`는 `updated`·`reused`·`fail-skip`·`skip-disabled`·`missing`)이어야 합니다. graphify가 꺼져 있어도 `graphify-runner`가 엔트리를 남겨야 합니다 |
| graphify 실행 경로 해석 실패 / 경로 추천 없음 | `bouncer graphify-bin`이 config.bin → `.bouncer/.venv` → PATH에서 실행 파일을 못 찾은 상태입니다. `bouncer init`으로 설치하거나, 기존 프로젝트면 `bouncer init --promote-graphify`로 켠 뒤 다시 시도하세요. 오프라인은 [install.md](install.md) 수동 폴백. 없으면 `affected_paths`를 수동 확정하면 됩니다 |
| `G13 missing successful harness verification metadata` | `verify` 명령이 실행되지 않았거나 실패했습니다. 손으로 쓴 증적은 통과하지 않습니다 |
| `G15 explain missing written sections` | `explain.md` 다섯 섹션(Background / Intuition / Code / Quiz / 이해 상태) 중 본문이 비어 있습니다. 헤딩·주석만으로는 통과하지 않습니다. `/bouncer-commit`의 explain-diff 단계에서 채우세요 |
| `G15 explain comprehension record missing` | 포인터 task용 `bouncer.comprehension` 엔트리가 없거나 불완전합니다. 스캐폴드 직후 상태입니다 — 엔트리를 append한 뒤 다시 검사하세요 |
| `G15 explain diff_sha does not match range_from..HEAD` / `could not be computed` | 기록된 `diff_sha`가 게이트가 `range_from..HEAD`로 다시 계산한 값과 다르거나, base/저장소 문제로 계산에 실패했습니다. `range_from`은 첫 엔트리에서 포인터 `base`, 이후엔 직전 엔트리 `range_to`입니다 |
| `G16` (열린 task / explain / comprehension 커버) | finalize 게이트. 모든 task가 `verified`이고 explain이 `published`이며 task마다 comprehension 엔트리가 있어야 합니다. 남은 task는 `/bouncer-commit`으로 먼저 닫으세요 |
| `.bouncer/Distill.md` 없음 | `bouncer init`이 골격을 만듭니다(레거시 `context/Distill.md`는 새 경로로 옮김). plan/execute 전에 Read해야 합니다 |
| `S11 blueprint documents not found` | blueprint 경로가 틀렸습니다(오타 등). 경로를 확인하세요 |
| `S13 epic directory not listed` / `lists missing epic` | `.bouncer/context/index.md`와 `epics/` 디렉터리가 어긋났습니다. `bouncer scaffold epic`으로 만들거나 목록 줄을 맞추세요 |
| `S15 legacy task layout remains` | clean worktree에서 `bouncer migrate task-layout --dry-run`으로 이동 계획을 확인한 뒤 apply하세요. |
| `S16 non-canonical task directory` / `S17 task unit … missing` | task 디렉터리는 세 자리 번호여야 하며, 각 묶음에는 tasks·verification·review 문서가 모두 있어야 합니다. |
| `commit blocked: files outside affected_paths` | 범위 밖 파일이 스테이징됐습니다. 범위를 넓혀야 한다면 `/bouncer-plan`으로 돌아가 `affected_paths`를 다시 승인받으세요 |
| worktree에 task 묶음(`tasks/<NNN>/{tasks,verification,review}.md`)이 없음 | `/bouncer-execute` step 2의 `bouncer seed-worktree`를 건너뛰었습니다. plan은 커밋하지 않으므로 문서는 base에만 있습니다 |
| base에 EPIC 문서가 `??`로 남고 같은 파일이 PR에도 있음 | seed 누락이거나 구버전 스킬입니다. base에서 `seed-worktree`를 실행하면 복사·정리가 한 번에 됩니다 |
| `seed-worktree`가 `conflict`로 실패 | worktree에 같은 경로가 다른 내용으로 이미 있습니다. base는 건드리지 않았으니 손으로 정리한 뒤 다시 실행하세요 |
| finalize가 `out-of-scope`로 중단 | `node_modules/`, `graphify-out/`, `.worktrees/`는 무시. `.bouncer/Distill.md`는 항상 허용됩니다 |
| SessionStart에 `legacy EPIC-/BP- context directories` 경고 | 구형 디렉터리명이 남아 있습니다. `migrate-ids` 스킬 또는 `bouncer migrate ids --dry-run`으로 계획을 본 뒤 확인받고 apply하세요. 신·구 혼재·대상 충돌·dirty worktree면 apply가 거절됩니다 ([context-versioning.md](context-versioning.md)) |

게이트 코드 전체는 [gates.md](gates.md)를 보세요.
파일럿·알려진 마찰은 [PILOT.md](PILOT.md)를 보세요.

## 피드백

막히거나 이해가 안 된 지점은 이슈로 남겨 주세요. GitHub은 New issue의
**막힌 지점 (friction)** / **버그** 템플릿, GitLab은 Description template의
`friction` / `bug`를 쓰면 됩니다.

**스스로 우회한 경우에도 기록해 주세요.** 우회 방법이 곧 문서에 들어갈 내용입니다.
