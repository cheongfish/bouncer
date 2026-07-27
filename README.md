# Bouncer

에이전트가 "다 했습니다"라고 말하기 전에, 실제로 했는지 검사하는 Claude Code 플러그인.

## 무엇을 해결하나

코딩 에이전트에게 일을 맡기면 세 가지가 반복됩니다.

- **범위가 번진다.** 인증을 고치라고 했는데 결제 코드까지 손댄다.
- **검증이 말뿐이다.** "테스트 전부 통과"라고 적지만 실행한 적은 없다.
- **커밋이 뒤섞인다.** 한 커밋에 기능·리팩터·포맷팅이 함께 들어와 리뷰가 불가능하다.

Bouncer는 작업을 **하나의 리뷰 가능한 커밋** 단위(blueprint)로 쪼개고, 각 단계를
게이트로 막습니다. 게이트는 문서 상태와 본문을 결정적으로 검사하는 Node 스크립트라
에이전트가 설득할 대상이 아닙니다. 통과하거나, 실패 코드가 나오거나 둘 중 하나입니다.

**검증은 실제로 실행됩니다.** execute 게이트는 `config.json`의 `verify` 명령을 직접
돌려 종료 코드와 출력을 `verification.md`에 기록하고, 그 메타데이터가 없거나 본문과
어긋나면 G13으로 실패시킵니다. 에이전트가 손으로 쓴 "통과했습니다"만으로는 못 지나갑니다.

## 설치

사내 Git 저장소에 이 저장소를 올린 뒤, 팀원은 Claude Code 세션에서 두 줄이면 됩니다.

```
/plugin marketplace add <사내-git-url>
/plugin install bouncer@chunjae-tools
```

로컬 경로에서 바로 써 볼 수도 있습니다.

```
/plugin marketplace add ./path/to/bouncer
/plugin install bouncer@chunjae-tools
```

**`npm install`은 필요 없습니다.** Claude Code는 플러그인을 클론만 하고 의존성을
설치하지 않으므로, 런타임에 필요한 `js-yaml`은 `scripts/vendor/`에 벤더링돼 있습니다
(자세한 내용은 `scripts/vendor/README.md`). Node 24에서 검증했습니다. 런타임 코드는
Node 표준 모듈만 쓰지만 더 낮은 버전은 아직 확인하지 않았습니다.

사내 저장소가 **비공개**라면 SSH 리모트를 권장합니다. 백그라운드 자동 업데이트는 git
credential helper를 비활성화한 채 `git pull`을 돌리기 때문에 HTTPS 인증이 실패하고
전체 재클론으로 폴백합니다. SSH 키(`ssh-agent`)는 이 영향을 받지 않습니다. 함께
`CLAUDE_CODE_PLUGIN_KEEP_MARKETPLACE_ON_FAILURE=1`을 설정하면 갱신 실패 시 기존
클론을 유지합니다.

## Quickstart (5분)

```
/bouncer-init
```

`.bouncer/`를 만듭니다 — `config.json`, 거버넌스 문서, 문서 템플릿. 기존 파일은
건드리지 않습니다. `.gitignore`에 추가할 항목을 **안내만** 하고 직접 쓰지 않으니,
알려주는 항목을 직접 넣으세요.

만든 직후 별도 커밋으로 남기세요. 이유는 [컨텍스트 문서 버전관리](#컨텍스트-문서-버전관리)에 있습니다.

```bash
git add .bouncer && git commit -m "chore: bootstrap bouncer"
```

```
/bouncer-plan
```

epic → blueprint → tasks를 작성합니다. `tasks.md`의 5개 섹션(Goal & intent,
Interface, Touch, Do not touch, Checklist)이 이후 구현의 유일한 지시서입니다.
`affected_paths`는 **사용자가 확인**해야 하고, 이후 이 경로 밖의 커밋은 차단됩니다.

```
/bouncer-execute
```

격리된 worktree에서 tasks 지시서대로 구현하고, `verify` 명령을 실제로 실행해 증적을
남기고, 리뷰를 기록합니다.

```
/bouncer-finalize
```

배운 것을 distill에 남기고, 범위 밖 파일이 없는지 최종 확인한 뒤 한 커밋으로 묶습니다.
리모트와 `gh`가 있으면 draft PR까지 만들고, 없으면 조용히 건너뜁니다.

각 명령 끝에서 게이트가 돌고, 실패하면 코드와 파일이 찍힙니다. 고치고 다시 돌리면 됩니다.

## 게이트

```
bouncer validate --blueprint <dir> --gate <plan|execute|finalize>
```

| 게이트 | 검사 |
| --- | --- |
| **plan** | G1 epic `approved` · G2 blueprint `approved` · G3 tasks `ready` · G4 `graph.suggested_paths` 존재 + `graph.basis` 비어있지 않음 · G5 `affected_paths` 비어있지 않음 · G10 tasks 5개 섹션 작성됨 · G11 `affected_paths`가 Touch로 정당화됨 · G12 Do not touch와 `affected_paths`가 겹치지 않음 |
| **execute** | G6 tasks `verified` · G7 verification `passed` · G8 리뷰 `accepted`(또는 `required: false`) · G13 `verify` 명령 실제 실행 + 종료 코드 0 + 본문이 기록된 메타데이터와 일치 · G14 `## Findings` 존재 + 각 finding의 severity/status 유효 |
| **finalize** | G9 distill `published` |

`S`로 시작하는 코드(S1–S9)는 게이트와 무관하게 항상 검사하는 구조/스키마 위반입니다.

섹션은 **헤딩만 있고 본문이 비면 미작성으로 판정**합니다. 갓 scaffold한 문서가 G10에
걸리는 것은 의도된 동작입니다.

## 컨텍스트 문서 버전관리

**`.bouncer/` 전체를 커밋합니다.** 선택 사항이 아니라 설계 전제입니다 —
`/bouncer-finalize`는 코드 변경과 그 blueprint의 문서를 **한 커밋에 함께** 담습니다.
문서를 gitignore하면 게이트를 통과했다는 증적(`verification.md`의 실제 종료 코드,
`affected_paths` 승인 기록)이 로컬에만 남고 리뷰어에게 도달하지 않아, 이 도구의
존재 이유가 사라집니다.

| 대상 | 방침 | 누가 커밋하나 |
| --- | --- | --- |
| `.bouncer/context/**` | 커밋 | `/bouncer-finalize`가 코드와 함께 자동으로 |
| `.bouncer/config.json`, `governance.md`, `workflow.md`, `okf.md`, `templates/` | 커밋 | **사용자가 `/bouncer-init` 직후 별도 커밋으로** |
| `graphify-out/` | 제외 | — (`.gitignore`, init이 안내) |
| 활성 blueprint 포인터·worktree | 해당 없음 | 저장소 밖(`$GIT_COMMON_DIR/bouncer/`)에 저장됨 |

### 부트스트랩은 왜 따로 커밋해야 하나

`.bouncer/config.json`과 `templates/`는 blueprint가 커밋할 수 있는 범위에 **없습니다.**
그래서 커밋하지 않은 채로 두면 첫 `/bouncer-finalize`가 out-of-scope로 중단됩니다.
게다가 `/bouncer-plan`이 활성 blueprint를 기록하고 나면 커밋 가드가
`affected_paths` 밖 파일을 막으므로, **`/bouncer-init`과 `/bouncer-plan` 사이**가
이 커밋을 남길 수 있는 유일한 구간입니다.

`templates/`를 커밋해야 하는 이유가 하나 더 있습니다 — scaffold가 이 디렉터리를
런타임에 읽습니다. 커밋하지 않으면 팀원마다 다른 문서 골격이 생성됩니다.

### 문서는 "현행"이 아니라 "그 시점의 기록"입니다

커밋 이후 코드만 고치면 `tasks.md`는 과거 상태로 남습니다. 이건 결함이 아닙니다.
컨텍스트 문서는 살아있는 명세가 아니라 **그 커밋이 왜 그 범위였고 무엇으로
검증됐는지에 대한 기록**입니다. 최신 상태로 유지하려 들지 마세요. 범위가 바뀌면
새 blueprint를 만드는 것이 맞습니다.

PR diff의 문서 노이즈가 부담이면 GitHub 기준으로 접힘 처리할 수 있습니다.

```
# .gitattributes
.bouncer/context/** linguist-generated=true
```

## 설정 (`.bouncer/config.json`)

| 필드 | 기본값 | 설명 |
| --- | --- | --- |
| `source_dirs` | `["src", "test"]` | 그래프 생성과 탐색의 대상 디렉터리 |
| `verify` | `"npm test"` | **execute 게이트가 실제로 실행하는 명령.** 종료 코드 0이어야 G13 통과 |
| `base_branch` | `"develop"` | worktree와 PR의 기준 브랜치 |
| `pr.draft` | `true` | PR을 draft로 생성 |
| `pr.base` | `"develop"` | PR 대상 브랜치 |
| `pr.labels` | `["bouncer"]` | PR에 붙일 라벨 |
| `graphify` | `{ "enabled": false }` | 소스 그래프 생성. **기본 비활성.** 켜면 SessionStart에서 `graphify-out/` 캐시를 갱신하고 `suggested_paths`를 채웁니다 |
| `okf_version` | `"0.x"` | 문서 frontmatter 스키마 버전 |
| `plugin_advisors.ponytail` | (객체) | 단계별 Ponytail 모드 **권고**. 자동 전환하지 않습니다 |

## 막혔을 때

| 증상 | 원인과 대처 |
| --- | --- |
| `G10 tasks missing implementation-ready sections` | 해당 섹션 본문이 비어 있습니다. 헤딩만으로는 통과하지 않습니다 |
| `G4 tasks.graph.basis missing or empty` | `/bouncer-plan`의 그래프 단계를 건너뛰었습니다. graphify가 꺼져 있어도 `graphify-runner`가 폴백 근거를 기록해야 합니다 |
| `G13 missing successful harness verification metadata` | `verify` 명령이 실행되지 않았거나 실패했습니다. 손으로 쓴 증적은 통과하지 않습니다 |
| `G9 distill.status != published` | distill 미작성 — 다만 **blueprint 경로 자체가 틀렸을 때도 이 오류가 납니다.** 경로를 먼저 확인하세요 |
| `commit blocked: files outside affected_paths` | 범위 밖 파일이 스테이징됐습니다. 범위를 넓혀야 한다면 `/bouncer-plan`으로 돌아가 `affected_paths`를 다시 승인받으세요 |
| finalize가 `out-of-scope`로 중단 | `node_modules/`, `graphify-out/`, `.worktrees/`는 무시하므로 그 외 파일입니다 |

## 위협 모델

커밋 가드는 **실수 방지 장치이지 악의적 우회에 대한 방어가 아닙니다.**

`hooks/commit-safety.js`는 Bash 명령 문자열을 파싱해 `git commit`을 탐지합니다.
`git commit`, `git -C <path> commit`은 잡지만, 중첩 셸(`bash -c "git commit"`),
변수 확장(`git $FLAG commit`), 셸 별칭(`git ci`)은 **탐지하지 못합니다.** 또한
가드는 커밋만 막고 범위 밖 파일의 *작성*은 막지 않습니다.

최후 방어선은 `/bouncer-finalize`의 범위 검사입니다. 이건 명령 문자열이 아니라
실제 git 상태(`diff --name-only HEAD` + `ls-files --others`)를 보므로 우회할 수 없습니다.

## 개발

```bash
npm install    # devDependencies만 (테스트용)
npm test       # node --test
```

`scripts/`와 `hooks/` 아래 코드는 `node_modules`에 의존하면 안 됩니다 —
마켓플레이스 설치가 깨집니다. `test/distribution.test.js`가 이 계약을 강제합니다.

릴리스는 `claude plugin tag`로 `bouncer--v<version>` 태그를 만듭니다. 이 명령은
`plugin.json`과 `marketplace.json`의 버전 일치를 함께 검증합니다.

## 라이선스 / 문서

- `GOVERNANCE-ARCHITECTURE-DECISIONS.md` — 설계 결정 기록
- `CHANGELOG.md` — 변경 이력
- `DISTRIBUTION-READINESS.md` — 남은 배포 준비 항목
- `scripts/vendor/` — 벤더링된 서드파티 코드와 라이선스
