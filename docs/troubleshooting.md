# 막혔을 때

| 증상 | 원인과 대처 |
| --- | --- |
| `G10 tasks missing implementation-ready sections` | 해당 섹션 본문이 비어 있습니다. 헤딩만으로는, 또 템플릿 안내 주석만으로는 통과하지 않습니다 |
| `G10 tasks sections still contain <TODO: …> placeholders` | 템플릿 placeholder를 실제 내용으로 바꾸지 않았습니다 |
| `G4 tasks.graph.basis missing or empty` | `/bouncer-plan`의 그래프 단계를 건너뛰었습니다. graphify가 꺼져 있어도 `graphify-runner`가 폴백 근거를 기록해야 합니다 |
| `G13 missing successful harness verification metadata` | `verify` 명령이 실행되지 않았거나 실패했습니다. 손으로 쓴 증적은 통과하지 않습니다 |
| `G9 distill.status != published` | distill이 아직 `published`가 아닙니다 |
| `S11 blueprint documents not found` | blueprint 경로가 틀렸습니다(오타 등). 문서 문제가 아니라 경로 문제입니다 |
| `commit blocked: files outside affected_paths` | 범위 밖 파일이 스테이징됐습니다. 범위를 넓혀야 한다면 `/bouncer-plan`으로 돌아가 `affected_paths`를 다시 승인받으세요 |
| finalize가 `out-of-scope`로 중단 | `node_modules/`, `graphify-out/`, `.worktrees/`는 무시하므로 그 외 파일입니다 |

게이트 코드 전체는 [gates.md](gates.md)를 보세요.
파일럿·알려진 마찰은 [PILOT.md](PILOT.md)를 보세요.

## 피드백

막히거나 이해가 안 된 지점은 이슈로 남겨 주세요. GitHub은 New issue의
**막힌 지점 (friction)** / **버그** 템플릿, GitLab은 Description template의
`friction` / `bug`를 쓰면 됩니다.

**스스로 우회한 경우에도 기록해 주세요.** 우회 방법이 곧 문서에 들어갈 내용입니다.
