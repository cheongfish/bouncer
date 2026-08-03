# 게이트

게이트는 문서 상태와 본문을 결정적으로 검사하는 Node 스크립트입니다. 에이전트가
설득할 대상이 아니라, 통과하거나 실패 코드가 나오거나 둘 중 하나입니다.

```
bouncer validate --blueprint <dir> --gate <plan|execute|finalize>
```

| 게이트 | 검사 |
| --- | --- |
| **plan** | G1 epic `approved` · G2 blueprint `approved` · G3 tasks `ready` · G4 `graph.suggested_paths` 존재 + `graph.basis` 비어있지 않음 · G5 `affected_paths` 비어있지 않음 · G10 tasks 5개 섹션 작성됨 · G11 `affected_paths`가 Touch로 정당화됨 · G12 Do not touch와 `affected_paths`가 겹치지 않음 |
| **execute** | G6 tasks `verified` · G7 verification `passed` · G8 리뷰 `accepted`(또는 `required: false`) · G13 `verify` 명령 실제 실행 + 종료 코드 0 + 본문이 기록된 메타데이터와 일치 · G14 `## Findings` 존재 + 각 finding의 severity/status 유효 |
| **finalize** | G9 distill `published` |

`S`로 시작하는 코드(S0–S11)는 게이트와 무관하게 항상 검사하는 구조/스키마 위반입니다.

섹션은 **헤딩만 있고 본문이 비면 미작성으로 판정**합니다. 갓 scaffold한 문서가
G10에 걸리는 것은 의도된 동작입니다.

**검증은 실제로 실행됩니다.** execute 게이트의 G13은 `config.json`의 `verify`
명령을 하네스가 직접 돌린 메타데이터가 있어야 통과합니다. 에이전트가 손으로 쓴
"통과했습니다"만으로는 못 지나갑니다.

증상별 대처는 [troubleshooting.md](troubleshooting.md)를 보세요.
설계 배경은 [ARCHITECTURE.md](ARCHITECTURE.md)에 있습니다.
