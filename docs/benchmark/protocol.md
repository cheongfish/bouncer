# 측정 프로토콜

**측정일: 2026-08-21 (KST)**
**베이스 커밋: `3f5201866b368a55baaae845981ab77b9b869bec`**
**도구: `skills/agentic-code-benchmark`** (측정 40 + 심사 60 = 0–100 합성 점수)

## 설계

태스크 4개 × arm 2개 = 구현 런 8개. 모든 런이 같은 베이스 커밋에서 출발하고,
서로의 산출물을 보지 못한다.

| arm | 조건 |
| --- | --- |
| **off** | 저장소를 주고 태스크 프롬프트만 전달. 검증 방식·커밋 여부 자유 |
| **on** | 같은 프롬프트 + Bouncer 사이클 강제 (plan → 게이트 → pointer → execute → `bouncer verify` → execute 게이트 → `bouncer commit`) |

on arm 은 `scripts/bouncer` CLI 로 사이클을 수행했다. 스킬 문서
(`bouncer-plan` / `bouncer-execute` / `bouncer-commit`)와 `rules/governance.md`
를 읽게 하고, 게이트 실패 코드는 반드시 고치게 했다(`--no-verify` 금지,
가드 우회 금지). 계획 문서 4종(blueprint index, context-review, tasks,
review)을 코드 작성 **전에** 채우고 plan 게이트를 통과해야 구현을 시작할 수
있었다.

## 통제

- 프롬프트는 두 arm 에 **토씨 하나 안 바꾸고** 동일하게 전달. `done_when` 은
  심사자에게만 주고 구현 에이전트에게는 주지 않았다.
- 모든 런 동일 모델(Claude Sonnet), 동일 서브에이전트 타입, 단발.
- 런 중 사람 개입 0회. 두 arm 모두 "물어볼 사람이 없다" 고 명시.
- 체크 명령은 8런 전부 동일: `npm test` / `npm run lint` / `npm run typecheck`
  / `npm run build`.
- 측정치는 다른 것을 실행하기 **전에** 수집했다(빌드 산출물이 diff 를 오염시키지
  않도록).

## 심사

런당 독립 심사 에이전트 1명. 심사자는 **코드를 쓴 적이 없고**, arm 라벨을
가린 채(`run-A` … `run-H`) 자기 런의 diff·원본 프롬프트·루브릭만 받았다.
다른 런의 점수는 보지 못했다.

블라인드를 위해 심사용 저장소를 **중립 이름의 새 클론**으로 만들고 해당 diff 만
적용했다(디렉터리명이 arm 을 노출하지 않도록). 심사자에게는 저장소 변형을
허용했고 — 측정치와 diff 는 이미 확보된 뒤였다 — revert 체크(소스만 되돌리고
테스트를 돌려 통과하면 그 테스트는 변경을 검증하지 않는다)를 실제로 실행하게
했다. 심사 요약에 실행했는지 추론했는지 명시하도록 요구했다.

블라인드 라벨 대응은 각 `runs/*.judgment.json` 의 `blind_label` 필드에 남겼다.

## 심사 대상에서 제외한 것

on arm 의 `.bouncer/context/**` 계획 문서는 **심사 diff 에서 제외**했다.
두 arm 을 같은 종류의 산출물(코드 + 테스트 + 문서)로 비교하기 위함이다.
포함하면 on 이 scope·maintainability 에서 부당하게 깎인다. 대신 계획 문서
분량은 비용 지표로 별도 보고한다(`comparison.md`).

## 하네스 결함과 그 대응 — 재현 시 반드시 읽을 것

측정 도중 **도구 자신의 결함 2건**이 드러났다.

### 1. `collect_metrics.py` 가 git worktree 를 거부한다

```
scripts/collect_metrics.py:175
    if not os.path.isdir(os.path.join(repo, ".git")):
        parser.error(f"{repo} is not a git repository")
```

worktree 는 `.git` 이 **파일**이다. 그런데 같은 스킬의
`references/task-suite.md` 는 A/B 프로토콜로 `git worktree add` 를 지시한다.
**문서에 적힌 절차를 그대로 따르면 첫 명령에서 죽는다.**

대응: 측정을 위해 로컬 사본만 `os.path.exists` 로 바꿔 실행했다. 저장소의
스킬 파일은 이 벤치마크에서 수정하지 않았다. 수정은 별도 task 로 처리해야
한다.

### 2. 활성 포인터가 저장소당 하나다 — 병렬 사이클 충돌

`runtime-state.ts` 의 `runtimePaths()` 는 포인터를
`$(git rev-parse --git-common-dir)/bouncer/current` 에 둔다. `--git-common-dir`
는 **모든 linked worktree 가 공유**한다. 실측:

```
t1-on → 001-verify-dry-run
t2-on → 001-verify-dry-run   ← 자기 blueprint 아님
t3-on → 001-verify-dry-run   ← 자기 blueprint 아님
t4-on → 001-verify-dry-run   ← 자기 blueprint 아님
```

마지막에 `current --set` 한 런이 나머지의 포인터를 덮어쓴다. `verify` 의 명령
해결은 포인터 task 문서로 좁혀지고(`entriesForVerify`) 커밋 스코프도 포인터를
타므로, 충돌하면 다른 런의 문서를 읽는다.

Bouncer 의 핵심 서사가 "격리된 worktree 에서 구현한다" 이고 벤치마크 스킬의
A/B 프로토콜도 "런마다 worktree 하나" 를 요구하는데, **Bouncer 자신은 병렬
worktree 에서 두 사이클을 동시에 돌릴 수 없다.** 이 제약은 어느 문서에도
없다.

대응: on arm 첫 실행 4건(worktree 기반)을 **전량 폐기**하고, 저장소당 하나의
포인터가 보장되도록 **독립 클론 4개**로 재실행했다. 이 파일의 모든 on 수치는
재실행분이다. off arm 은 포인터를 쓰지 않으므로 영향이 없어 유지했다.

**측정 이후 같은 성질의 상태가 하나 더 늘었다.** PR #53(`c7df084`)이 도입한
verify 원장은 `verifyLedgerPathFor()` 를 통해
`<git-common-dir>/bouncer/verify/<digest>.json` 에 저장된다. 주석이 "linked
worktree가 같은 레코드를 보게" 라고 적고 있으므로 의도된 설계다. digest 가
`verification.md` 상대경로 기반이라 서로 다른 blueprint 끼리는 충돌하지 않지만,
**같은 blueprint 경로를 두 worktree 에서 돌리면 원장이 덮인다.** 재측정 시에도
worktree 가 아니라 독립 클론을 써야 한다.

## 한계

- **베이스 커밋이 PR #53 이전이다.** `3f52018` 시점의 G13 은 `verification.md`
  프론트매터만 읽어 손으로 쓴 `status: passed` 를 통과시켰고, 커밋 스코프 가드는
  `git commit -a` 로 우회됐다 — 둘 다 `c7df084` 에서 수정됐다. 따라서 이 실험의
  on arm 은 게이트가 강제해서가 아니라 **프롬프트 지시를 자발적으로 따라서**
  프로토콜을 지켰다. 측정치는 유효하지만 잰 대상은 "게이트의 강제력" 이 아니라
  "프로토콜 준수의 효과" 다. 재측정은 `c7df084` 이상에서 해야 둘이 일치한다.
- **n=4.** 스킬 권장 5–8 미만.
- **셀당 반복 1회.** 태스크별 분산 미측정. t3 의 Δ 0.00 이 진짜 동점인지 노이즈인지
  구분 불가.
- **on arm 은 CLI 에뮬레이션이다.** 설치된 플러그인이 아니라 `scripts/bouncer` 를
  직접 호출했다. 따라서 `/bouncer-*` 슬래시 커맨드 경로와 **PreToolUse 커밋 훅
  (`hooks/commit-safety.js`) 은 이번 실험에서 실행되지 않았다.** G17 의
  Bash 훅 경로는 미검증이다. 검증된 것은 `bouncer commit` 의 스코프 검사뿐이다.
- **태스크가 대부분 설계된 것이다.** t2 만 실제 코드에서 발견한 버그다.
- **심사자도 LLM 이고 런당 1명이다.** 패널 투표나 적대적 교차검증이 없다.
- **단일 모델·단일 세션.** 모델 간 일반화 근거 없음.
