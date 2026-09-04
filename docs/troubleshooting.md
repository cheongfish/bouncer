# 막혔을 때

| 증상 | 원인과 대처 |
| --- | --- |
| `G10 tasks missing implementation-ready sections` | 해당 섹션 본문이 비어 있습니다. 헤딩만으로는, 또 템플릿 안내 주석만으로는 통과하지 않습니다. 필요한 절은 blueprint `bouncer.scale`이 정합니다 — full(부재·`full`)은 Goal & intent·Interface·Touch·Do not touch·Checklist 다섯, `light`는 Goal & intent·Touch·Checklist 셋입니다. 메시지에 나온 이름이 곧 그 blueprint의 목록이니 없는 절을 추가로 만들 필요는 없습니다 |
| `G10 tasks sections still contain <TODO: …> placeholders` | 템플릿 placeholder를 실제 내용으로 바꾸지 않았습니다 |
| `G4 tasks.scope_evidence.basis missing or empty` | `/bouncer-plan`의 Graphify evidence 단계를 건너뛰었습니다. `scope_evidence`에는 `producer: graphify`, 후보 `suggested_paths`, 비어 있지 않은 `basis` 엔트리 배열(`graph`/`status`/`query`/`result`; `graph`는 `source`·`test`·`context`, `status`는 `updated`·`reused`·`fail-skip`·`skip-disabled`·`missing`)이 필요합니다. graphify가 꺼져 있어도 `graphify-runner`가 source·test·context 엔트리를 남겨야 하며, 후보는 승인 범위가 아닙니다 |
| `G4` / `S9` quality·candidates 짝 깨짐·잘못된 후보·저신뢰 비어 있지 않은 추천 | 새 write form은 `quality`와 `candidates`를 함께 쓰거나 둘 다 생략합니다. `quality.status`가 `low-confidence` 또는 `unavailable`이면 `suggested_paths`는 반드시 `[]`입니다. 후보 객체는 Task 002와 같이 `path`·정수 `score`·`confidence`·비어 있지 않은 `basis`입니다. 깨진 evidence는 runner를 다시 돌리거나 수동으로 `affected_paths`만 확정하세요 — 추천을 승인 범위로 복사하지 마세요 |
| graphify 저신뢰(`low-confidence`) / `unavailable` | `graph-suggest`가 구현 후보를 내지 못했거나 source 그래프를 읽지 못한 상태입니다. `quality.reasons`를 사용자에게 보여 주고 `suggested_paths`는 비운 채, 사람이 `affected_paths`를 수동 확정합니다. 그래프를 쓰려면 `bouncer init` 또는 `bouncer init --promote-graphify` 후 `/bouncer-plan`을 다시 돌리세요 |
| graphify 실행 경로 해석 실패 / 경로 추천 없음 | `bouncer graphify-bin`이 config.bin → git common directory의 `bouncer/venv` → 레거시 `.bouncer/.venv` → PATH에서 실행 파일을 못 찾은 상태입니다. `bouncer init`으로 설치하거나, 기존 프로젝트면 `bouncer init --promote-graphify`로 켠 뒤 다시 시도하세요. 오프라인은 [install.md](install.md) 수동 폴백. 없으면 사용자가 `affected_paths`를 수동 확정하면 됩니다 |
| `G13 missing successful harness verification metadata` | `verify` 명령이 실행되지 않았거나 실패했습니다. 손으로 쓴 증적은 통과하지 않습니다 |
| `G13 missing harness verify ledger record` | `verification.md` 프론트매터는 있어도 Git common directory 원장이 없습니다. 활성 task에서 `bouncer verify`를 다시 실행하세요. 원장은 `.git` 아래라 클론·CI·다른 머신에 복제되지 않습니다. 과거 task를 일괄 마이그레이션하는 경로는 없습니다 |
| `G13 harness metadata does not match verify ledger` / `output_tail does not match verify ledger output_sha` | 문서의 `command`/`ran_at`/`exit_code` 또는 `output_tail` 해시가 원장과 다릅니다. 손으로 고친 문서는 통과하지 않습니다. 활성 task에서 `bouncer verify`를 다시 실행하세요 |
| `G13 verify ledger unavailable` | Git common directory를 찾지 못했습니다. Bouncer 작업은 Git 저장소 안에서 해야 하며, 복구는 저장소에서 `bouncer verify` 재실행입니다 |
| `G16 explain missing written sections` | `explain.md` 다섯 섹션(Background / Intuition / Code / Quiz / 이해 상태) 중 본문이 비어 있습니다. 헤딩·주석만으로는 통과하지 않습니다. `/bouncer-finalize`의 explain-diff 단계에서 채우세요 |
| `G16 explain comprehension record missing` / `incomplete` | BP용 `bouncer.comprehension` 엔트리가 없거나 `quiz_score` 등 필수 필드가 비어 있습니다. 스캐폴드 직후 상태입니다 — 엔트리를 쓴 뒤 다시 검사하세요 |
| `G16 explain diff_sha does not match range_from..HEAD` / `could not be computed` | 기록된 `diff_sha`가 게이트가 `range_from..HEAD`로 다시 계산한 값과 다르거나, base/저장소 문제로 계산에 실패했습니다. `range_from`은 포인터 `base`입니다. 퀴즈 이후 커밋이 쌓였다면 본문과 해시만 갱신하고 퀴즈는 다시 보지 않습니다 |
| `G16` (열린 task / explain / comprehension) | finalize 게이트. 모든 task가 `verified`이고 explain이 `published`이며 BP 단일 comprehension 엔트리가 있어야 합니다. 남은 task는 `/bouncer-commit`으로 먼저 닫으세요 |
| `G17 staged path outside affected_paths` / `could not read staged files` | commit 게이트. 스테이징된 경로가 포인터 task `affected_paths` 밖이거나, 스테이징 목록을 읽지 못했습니다. 범위를 고치거나 스테이징을 정리하세요 |
| `.bouncer/Distill.md` 없음(소비 프로젝트 root 기준) | `bouncer project-root`로 확정한 consuming project root 아래 경로입니다. `bouncer init`이 골격을 만듭니다(레거시 `context/Distill.md`는 새 경로로 옮김). plan/execute 전에 `${PROJECT_ROOT}/.bouncer/Distill.md`를 Read하세요. plugin 트리의 같은 상대 경로로 대체하지 마세요 |
| `S11 blueprint documents not found` | blueprint 경로가 틀렸습니다(오타 등). 경로를 확인하세요 |
| `S13 epic directory not listed` / `lists missing epic` | `.bouncer/context/index.md`와 `epics/` 디렉터리가 어긋났습니다. 유효한 `--description`으로 `bouncer scaffold epic`을 실행하세요 |
| `S13 epic summary mismatch` | 색인 행은 편집하지 않는 파생값입니다. epic frontmatter `description`을 확인한 뒤 같은 canonical 경로에 `bouncer scaffold epic --id <ddd> --name <slug> --description <text>`를 다시 실행해 행을 replace하고 S13을 재검사하세요 |
| `S13 epic description` 오류 | epic frontmatter를 읽거나 파싱할 수 없거나 description이 비문자열·빈 값·`Epic <id>` placeholder입니다. 원인을 먼저 고친 뒤 scaffold와 validate를 다시 실행하세요 |
| `S15 legacy task layout remains` | clean worktree에서 `bouncer migrate task-layout --dry-run`으로 이동 계획을 확인한 뒤 apply하세요. |
| `S16 non-canonical task directory` / `S17 task unit … missing` | task 디렉터리는 세 자리 번호여야 하며, 각 묶음에는 tasks·verification·review 문서가 모두 있어야 합니다. |
| `S18 imported document is out of gate scope` | 임포트 문서는 작업 대상이 아니다. 새 blueprint를 만들라 |
| `S19 type … does not match expected … for path` | 문서를 옮기거나 복사한 뒤 `type`을 안 고친 경우입니다. 경로가 요구하는 종류로 `type`을 맞추세요 |
| `S20 scale "…" not in enum` | blueprint `bouncer.scale`은 `light` 또는 `full`만 허용합니다. 오타를 고치거나 필드를 빼세요 |
| `S27 supersedes must be an array of non-empty document paths` | 값을 문서 경로 문자열 배열로 쓰거나 필드를 빼세요 |
| `scaffold blueprint: --scale must be one of light\|full` | `--scale` 값이 없거나 `light`/`full`이 아닙니다. 아무 문서도 만들지 않았으니 값을 고쳐 다시 실행하세요 |
| light blueprint인데 `G18 context-review.md missing` | `bouncer.scale`이 `light`가 아닙니다(오타·`full`로 되돌림). light로 유지하려면 blueprint `index.md`의 값을 고치고, full로 돌아가는 중이라면 `bouncer scaffold context-review --blueprint <dir>`로 문서를 만든 뒤 Interface·Do not touch 절도 채우세요 |
| `S0` + `G18 context-review.md has invalid frontmatter` | `context-review.md`는 있는데 YAML 프론트매터가 깨졌습니다(예: 백틱으로 시작하는 평문 scalar). 파일을 다시 scaffold하지 말고 S0 메시지대로 frontmatter를 고친 뒤 `bouncer validate --gate plan`으로 확인하세요 |
| `G18 context-review.md missing … scaffold context-review` | full blueprint에 문서가 실제로 없습니다. `bouncer scaffold context-review --blueprint <dir>`로 만든 뒤 status·Findings를 채우세요 |
| `commit blocked: files outside affected_paths` | 범위 밖 파일이 스테이징됐습니다. 범위를 넓혀야 한다면 `/bouncer-plan`으로 돌아가 `affected_paths`를 다시 승인받으세요 |
| worktree에 task 묶음(`tasks/<NNN>/{tasks,verification,review}.md`)이 없음 | `/bouncer-execute` step 2의 `bouncer seed-worktree`를 건너뛰었습니다. plan은 커밋하지 않으므로 문서는 base에만 있습니다 |
| base에 EPIC 문서가 `??`로 남고 같은 파일이 PR에도 있음 | seed 누락이거나 구버전 스킬입니다. base에서 `seed-worktree`를 실행하면 복사·정리가 한 번에 됩니다 |
| `seed-worktree`가 `conflict`로 실패 | worktree에 같은 경로가 다른 내용으로 이미 있습니다. base는 건드리지 않았으니 손으로 정리한 뒤 다시 실행하세요 |
| finalize가 `out-of-scope`로 중단 | `node_modules/`, `graphify-out/`, `.worktrees/`는 무시. `.bouncer/Distill.md`는 항상 허용됩니다 |
| finalize가 `reason: 'verify'`로 중단 | 승격 커밋 직전 검증 명령이 실패했거나 명령을 해석하지 못했다. `closed` 잠금과 스테이징은 하지 않았다. 결과의 `code`/`command`/`exitCode`로 원인을 고친 뒤 `--yes`를 다시 실행한다. 우회는 없다 |

게이트 코드 전체는 [gates.md](gates.md)를 보세요.
막힌 지점은 아래 피드백 경로로 남겨 주세요.

## 피드백

막히거나 이해가 안 된 지점은 이슈로 남겨 주세요. GitHub은 New issue의
**막힌 지점 (friction)** / **버그** 템플릿, GitLab은 Description template의
`friction` / `bug`를 쓰면 됩니다.

**스스로 우회한 경우에도 기록해 주세요.** 우회 방법이 곧 문서에 들어갈 내용입니다.
