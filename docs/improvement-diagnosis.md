# 개선 진단

이 문서는 현재 Bouncer 플러그인의 개선 후보를 코드·문서·CI 구성에 근거해
정리하고, 착수 전에 내린 결정을 함께 기록한다. 호스트별 설치 smoke 검증은
이번 착수 범위에서 제외한다 — 관련 항목과 보류된 방향은 P4에 남긴다.

## 요약

| 우선순위 | 항목 | 핵심 문제 | 상태 |
| --- | --- | --- | --- |
| P1 | `verify_allowlist` 일관성과 worktree config seed | plan과 runtime이 서로 다른 allowlist를 적용하고, execute worktree는 프로젝트 config를 못 볼 수 있다 | 착수 |
| P2 | 활성 blueprint 병렬 실행 | 저장소당 활성 포인터가 하나뿐이라 두 사이클이 서로 덮는다 | 해소 |
| P3 | 플랫폼 CI | Windows 계약이 있지만 CI는 Ubuntu만 실행한다 | 진행하지 않음 |
| P4 | 설치 후 실행 경로 | 일부 호스트에서 별도 환경 설정 없이는 launcher를 찾지 못한다 | 진행하지 않음 |

현재 코드 품질 게이트 자체는 양호하다. 2026-09-05 기준 로컬에서 `npm run ci`를
실행했으며, 테스트 1,002개와 emit 검사, lint, 문서 검사, 타입 검사, `npm audit`
모두 통과했다. 아래 항목은 이 결과와 별개인 제품 동작·운영 경로의 개선점이다.

## P1 — `verify_allowlist` 정책 통일과 worktree config seed

### 관찰

allowlist 해석이 세 지점에서 서로 다르다.

- 런타임은 프로젝트 config 값을 기본 목록 **대신** 쓴다. 키가 없거나 배열이
  아닐 때만 기본 목록으로 돌아가고, 명시적 `[]`는 전면 차단으로 남긴다:
  [config.ts](../scripts/src/lib/config.ts) `getVerifyAllowlist()`
- plan 구조 검사(S12)와 `readVerifyCommand()`는 config를 읽지 않고 기본
  목록만 쓴다: [validate-structural.ts](../scripts/src/lib/validate-structural.ts),
  [verification.ts](../scripts/src/lib/verification.ts) `isValidVerifyCommand()`
- 런타임은 config 파일 부재와 파손을 모두 기본 목록으로 접는다.
  `readConfigResult()`는 `missing`과 `invalid`를 구분하지만 호출부가 그 구분을
  버린다: [verification.ts](../scripts/src/lib/verification.ts) `runVerification()`

따라서 프로젝트가 `verify_allowlist: ["bun"]`을 명시해도 task별 verify에
`bun test`를 쓰면 plan 단계에서 거절된다. 반대로 config 수준 `verify`는
런타임에서 허용된다. 같은 설정 키가 문서 위치에 따라 다른 결과를 만든다.

관측 차이가 잘 드러나지 않는 이유는 `init`이 기본 목록 전체를 config 파일에
그대로 기록하기 때문이다([init.ts](../scripts/src/lib/init.ts)). 사용자가 목록을
직접 줄였을 때만 차이가 표면화된다.

여기에 worktree 문제가 겹친다. execute는 worktree를 cwd로 verify를 실행하는데,
`.bouncer/config.json`은 `init`의 gitignore 제안 목록에 없어 보통은 추적되지만,
이 저장소처럼 무시하기로 한 저장소에서는 worktree가 config를 아예 받지 못한다.
그러면 런타임이 조용히 기본 목록으로 되돌아가 P1 통일의 효과가 worktree 안에서
사라진다.

### 영향

- 사용자는 허용한 실행 파일이 왜 plan에서 막히는지 이해하기 어렵다.
- config가 파손돼도 런타임이 기본 목록으로 폴백하므로, allowlist를 좁혀 둔
  저장소에서 실행 경계가 조용히 **넓어진다**.
- config를 무시하는 저장소에서는 정책 통일이 base에만 적용되고 worktree에는
  적용되지 않는다.

### 결정

1. **합성 규칙은 대체를 유지한다.** 프로젝트 목록이 기본 목록을 대체하고,
   합집합은 쓰지 않는다. 합집합으로 바꾸면 `[]`가 기본 목록과 같아져 전면
   차단을 표현할 수단이 사라지고 런타임 동작도 함께 바뀐다.
2. **plan을 런타임에 맞춘다.** S12와 task별 command 선택이 런타임과 같은
   프로젝트 allowlist를 받는다.
3. **config 실패는 부재와 파손을 구분한다.** 부재는 기본 목록으로 계속하고,
   파손(깨진 JSON·권한 오류)은 오류로 중단한다. plan과 런타임 양쪽에 같은
   규칙을 적용한다 — 런타임 폴백을 없애는 동작 변경이 포함된다.
4. **seed 단계에서 config를 worktree로 복사한다.** worktree가 git으로부터
   `.bouncer/config.json`을 받지 못한 경우에만 base에서 복사한다. 추적 중인
   저장소는 HEAD 버전을 정본으로 유지한다 — 커밋되지 않은 설정을 검증 정책의
   정본으로 삼지 않기 위함이며, 동시에 커밋 훅 충돌을 원천 차단한다(아래).

### 조치

`isValidVerifyCommand()` 호출부가 모두 같은 프로젝트 설정 allowlist를 받도록
정리한다. S12, task별 command 선택, 실제 실행의 allowlist 해석을 공용 함수로
모으고 다음 경우를 회귀 테스트로 고정한다.

1. 기본 allowlist 밖이지만 프로젝트 allowlist에는 있는 task verify가 plan·execute를 모두 통과한다.
2. 어느 allowlist에도 없는 실행 파일은 plan·execute 모두 거절한다.
3. 셸 연산자와 미종료 인용은 allowlist와 무관하게 두 단계 모두 거절한다.
4. config 부재는 기본 목록으로 진행하고, 파손된 config는 plan·execute 모두 중단한다.

config seed는 `seed-worktree`에 복사 전용 단계로 넣는다. execute 스킬이 이미
그 명령을 부르므로 호출 지점이 늘지 않고, worktree를 재사용할 때도 매번
반영된다.

- 대상은 `.bouncer/config.json` 하나로 못박는다. `.bouncer/Distill.md`는
  [plugin-root.md](../rules/plugin-root.md)가 `${PROJECT_ROOT}` 밖에서 읽고 쓰는 것을
  금지하므로 복사 대상이 아니다.
- 기존 이전 집합과 분리한다. `seedWorktree()`의 phase 2는 base 파일을 복원하거나
  삭제하는 **이동**이므로([seed-worktree.ts](../scripts/src/lib/seed-worktree.ts)),
  config를 그 집합에 넣으면 base의 config가 사라진다. 반환값도 `moved`와 구분되는
  별도 필드로 보고한다.
- worktree가 이미 config를 가지고 있으면 덮어쓰지 않는다. 덮어쓰면 추적 저장소에서
  `affected_paths` 밖의 tracked-modified 파일이 생겨 커밋 훅 G17이 커밋을 막는다
  ([commit-hook.ts](../scripts/src/lib/commit-hook.ts)).
- base에 config가 없으면 무동작으로 성공한다. `init` 직후 config 없이 도는 정상
  경로를 깨뜨리지 않되, execute 스킬이 한 줄 경고를 보여 준다.

## P2 — 활성 blueprint 상태의 병렬 안전성

### 관찰

runtime 상태는 Git common directory에 저장되고 linked worktree가 이를 공유한다.
다만 공유 상태가 모두 충돌하는 것은 아니었다.

- verify 원장은 verification 문서 상대경로의 sha256으로 파일이 갈린다. 즉 이미
  task별로 분리돼 있고 blueprint 사이에서 충돌하지 않는다:
  [runtime-state.ts](../scripts/src/lib/runtime-state.ts) `verifyLedgerPathFor()`
- worktree 경로도 epic·blueprint id로 갈린다:
  [runtime-state.ts](../scripts/src/lib/runtime-state.ts) `worktreePathFor()`
- 진단 시점의 단일 슬롯은 활성 포인터뿐이었다. 경로는
  `<common-git-dir>/bouncer/current`로 고정돼 있었다.

B11은 [audit-debt-decisions.md](audit-debt-decisions.md)에서 해소됐다.

### 영향

- 서로 다른 작업이 같은 현재 task를 가리킬 수 있다.
- 문제 발생 시 변경 내용은 정상이어도 gate 실패 원인을 추적하기 어렵다.
- 팀원이 병렬 worktree를 일반적인 Git 사용 방식으로 이해할수록 사고 가능성이 커진다.

### 결정

epic 064 blueprint 002가 임시 보호와 최종 namespace를 **같은 계획으로**
승인했다. 독립 clone 완화는 쓰지 않는다.

1. **덮어쓰기 보호가 첫 task다.** 전환 중 다른 활성 blueprint를 조용히 지우지
   못하게 `--replace`와 `previous` payload를 둔다.
2. **최종 저장은 epic·blueprint id namespace다.**
   `pointers/<epic-id>/<blueprint-id>.json`. 기본 `--set`은 대상 key를
   추가·갱신하고 다른 key를 보존한다. `--replace`는 현재 위치에서 유일하게
   선택된 key를 지운 뒤 대상으로 바꾼다. worktree 경로를 키로 쓰지 않는다.
   원장과 worktree 경로는 이미 분리돼 있어 범위 밖이다.
3. **포인터 해석은 cwd 우선, base에서는 단일 해석이다.** cwd가
   `.worktrees/<epic>/<blueprint>` 아래면 그 blueprint의 포인터를 읽는다. base에서
   실행하면 활성 포인터가 하나일 때 그대로 쓰고, 둘 이상이면 후보 목록을 JSON으로
   내고 중단한다.
4. **레거시 포인터는 읽기 호환 후 자동 이관한다.** 기존 단일 파일을 계속 읽되
   첫 `--set`에서 키 형식으로 옮기고 레거시를 지운다. 레거시와 키 형식이 다른
   blueprint를 가리키면 자동 병합하지 말고 둘 다 출력하며 중단한다.

### 조치

blueprint 002의 세 task가 위 계약을 이어서 닫는다. 별도 blueprint로 namespace를
미루지 않았다.

1. Task 001 — `current --set`의 덮어쓰기 차단과 `--replace` / `previous`.
2. Task 002 — namespace 저장, 위치별 선택, 레거시 이관, 충돌 시 중단.
3. Task 003 — `/bouncer-plan`·`/bouncer-execute` 시작 경고와 규칙·사용자 문서를
   최종 계약에 맞춘다.

## P3 — 플랫폼 CI 확대 (진행하지 않음)

### 관찰

GitHub Actions와 GitLab CI는 모두 Node 24 Linux 한 환경만 실행한다.

- GitHub workflow: [test.yml](../.github/workflows/test.yml)
- GitLab pipeline: [.gitlab-ci.yml](../.gitlab-ci.yml)

반면 공개 설정은 Windows에서 `npm.cmd`, `node.exe`, `make` 등의 실행 파일명을
정규화하는 동작을 설명한다. 즉 Windows는 단순한 비지원 환경이 아니라 동작을
명시한 환경이다.

### 영향

- Windows 전용 경로 구분자·실행 파일 확장자·spawn 동작 회귀가 릴리스 전
  검출되지 않는다.
- Linux만 통과한 배포본이 Windows 소비 저장소에서 검증 실행에 실패할 수 있다.

### 보류된 방향

재개할 경우 GitHub Actions에 Windows job을 추가해 `npm ci`와 `npm run ci`를
실행하고, 다음 경로를 명시적으로 검증하는 테스트를 보강한다.

- `npm.cmd`, `node.exe`, `*.bat` allowlist 정규화
- 공백이 든 경로와 인용된 인자 처리
- `bouncer` 및 `bouncer-root` launcher의 종료 코드 전달

macOS는 Windows 안정화 뒤 실제 지원 범위나 사용자 비중에 따라 추가한다.

현재는 진행하지 않는다. GitHub Actions의 Linux job과 GitLab CI 구성을 유지한다.
Windows를 지원 환경으로 선언하거나 Windows에서 발생한 회귀를 확인하면 다시
검토한다.

## P4 — 설치 후 launcher 발견성 (진행하지 않음)

### 관찰

플러그인 호스트는 저장소를 캐시로 복사하지만 `npm install`을 하지 않으므로
`package.json`의 `bin`만으로 `bouncer`와 `bouncer-root`가 PATH에 등록되지는
않는다. Cursor는 특히 `bouncer-root --auto`의 지원 후보가 아니어서
`BOUNCER_HOME`을 별도로 지정해야 한다.

- Cursor 설정 요구와 대체 실행 방법: [install.md](install.md)
- launcher는 `BOUNCER_HOME`과 지원 호스트 후보 탐색만 쓴다. cwd를 뒤지지 않고
  임의 home 스캔으로 폴백하지 않는 것이 명시된 계약이다:
  [plugin-root.md](../rules/plugin-root.md)

### 영향

- 설치는 성공했지만 첫 워크플로 명령이 `command not found` 또는 플러그인 루트
  해석 실패로 끝날 수 있다.
- 사용자가 캐시 경로와 환경 변수의 차이를 알아야 하므로 온보딩 마찰이 크다.
- 호스트마다 시작 절차가 달라 지원·문서 유지 부담이 늘어난다.

### 보류된 방향

이번에는 진행하지 않는다. 재개할 때의 출발점으로 조사 결과를 남긴다.

- **진단 책임 경계.** PATH 등록 이전 실패는 호스트 설치 단계가 처리하고,
  launcher 실행 이후의 plugin root 해석 실패는 `bouncer-root`가 처리한다.
  `bouncer-root`가 자기 자신이 실행되지 못한 실패까지 진단할 수는 없다.
  스킬의 첫 launcher 실패는 감지한 호스트와 복사 가능한 복구 명령을 stderr에
  한 번에 출력하도록 구조화한다.
- **진입 경로.** `bouncer-root`가 `CLAUDE_PLUGIN_ROOT`/`PLUGIN_ROOT`를
  `BOUNCER_HOME` 다음 순위로 읽되, `BOUNCER_HOME`과 같은 검증을 통과한 값만
  채택한다. 호스트별 adapter는 유지 대상이 호스트 수만큼 늘어 이 항목이 지적한
  문제를 키우므로 택하지 않는다. 이 방향은
  [plugin-root.md](../rules/plugin-root.md)의 명시 계약을 넓히므로 규칙·문서를
  함께 고쳐야 한다.
- **확인 환경.** Claude Code와 Cursor 두 호스트에서 확인한다. 성공 조건은
  호스트마다 "플러그인 설치 → 새 셸 → `bouncer-root --auto` 종료 코드 0 → 첫
  워크플로 명령 종료 코드 0"이다.

## 실행 순서

1. P1 — allowlist 정책 통일과 worktree config seed를 한 묶음으로 처리한다.
   따로 두면 config를 무시하는 저장소에서 정책이 base에만 적용되는 절반짜리
   상태가 남는다.
2. P2 — epic 064 blueprint 002가 덮어쓰기 보호와 namespace 저장·워크플로
   전환을 한 계획으로 승인했고, 이 문서는 그 최종 계약만 남긴다.

P3과 P4는 이번 순서에서 제외한다.
