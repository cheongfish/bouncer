# 막혔을 때

| 증상 | 원인과 대처 |
| --- | --- |
| `G10 tasks missing implementation-ready sections` | 해당 섹션 본문이 비어 있습니다. 헤딩만으로는, 또 템플릿 안내 주석만으로는 통과하지 않습니다 |
| `G10 tasks sections still contain <TODO: …> placeholders` | 템플릿 placeholder를 실제 내용으로 바꾸지 않았습니다 |
| `G4 tasks.graph.basis missing or empty` | `/bouncer-plan`의 그래프 단계를 건너뛰었습니다. graphify가 꺼져 있어도 `graphify-runner`가 폴백 근거를 기록해야 합니다 |
| `graphify not on PATH` / 경로 추천 없음 | 선택 의존성. `pip install graphifyy && graphify install` 후 `graphify.enabled: true`. 없으면 `affected_paths`를 수동 확정하면 됩니다 ([install.md](install.md)) |
| `G13 missing successful harness verification metadata` | `verify` 명령이 실행되지 않았거나 실패했습니다. 손으로 쓴 증적은 통과하지 않습니다 |
| `G15 explain missing written sections` | `explain.md` 다섯 섹션(Background / Intuition / Code / Quiz / 이해 상태) 중 본문이 비어 있습니다. 헤딩·주석만으로는 통과하지 않습니다 |
| `G15 explain comprehension record missing` | `bouncer.comprehension`이 없거나 `disposition`/`diff_sha`가 빈 문자열입니다. 스캐폴드 직후 상태입니다 — 기록 후 다시 검사하세요 |
| `G15 explain diff_sha does not match` / `could not be computed` | 기록된 `diff_sha`가 게이트가 다시 계산한 값과 다르거나, base/저장소 문제로 계산에 실패했습니다. base는 포인터 → `config.base_branch` → `develop` 순입니다 |
| `.bouncer/context/Distill.md` 없음 | `bouncer init`이 골격을 만듭니다. plan/execute 전에 Read해야 합니다 |
| `S11 blueprint documents not found` | blueprint 경로가 틀렸습니다(오타 등). 경로를 확인하세요 |
| `commit blocked: files outside affected_paths` | 범위 밖 파일이 스테이징됐습니다. 범위를 넓혀야 한다면 `/bouncer-plan`으로 돌아가 `affected_paths`를 다시 승인받으세요 |
| worktree에 `tasks.md`가 없음 | `/bouncer-execute` step 2의 `bouncer seed-worktree`를 건너뛰었습니다. plan은 커밋하지 않으므로 문서는 base에만 있습니다 |
| base에 EPIC 문서가 `??`로 남고 같은 파일이 PR에도 있음 | seed 누락이거나 구버전 스킬입니다. base에서 `seed-worktree`를 실행하면 복사·정리가 한 번에 됩니다 |
| `seed-worktree`가 `conflict`로 실패 | worktree에 같은 경로가 다른 내용으로 이미 있습니다. base는 건드리지 않았으니 손으로 정리한 뒤 다시 실행하세요 |
| finalize가 `out-of-scope`로 중단 | `node_modules/`, `graphify-out/`, `.worktrees/`는 무시. `.bouncer/context/Distill.md`는 항상 허용됩니다 |

게이트 코드 전체는 [gates.md](gates.md)를 보세요.
파일럿·알려진 마찰은 [PILOT.md](PILOT.md)를 보세요.

## 피드백

막히거나 이해가 안 된 지점은 이슈로 남겨 주세요. GitHub은 New issue의
**막힌 지점 (friction)** / **버그** 템플릿, GitLab은 Description template의
`friction` / `bug`를 쓰면 됩니다.

**스스로 우회한 경우에도 기록해 주세요.** 우회 방법이 곧 문서에 들어갈 내용입니다.
