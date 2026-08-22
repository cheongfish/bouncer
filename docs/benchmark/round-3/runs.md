# 3회차 on-arm: light 계획 계약

**측정일: 2026-08-22 (KST)**
**베이스 커밋: `b0679f5d78b1e23babbfc61a557b4999fa1e09b0`** (`feat: light 전용 scaffold와 plan gate 도입`, BP002 Task 001)
**arm:** Bouncer on-light만. t1~t4를 각각 독립 clone에서 1회.
**모델:** Claude Opus 5, 클론마다 구현 에이전트 1명, 셀당 반복 1회.
**도구:** 기존 `skills/agentic-code-benchmark`의 `collect_metrics.py` / `scorecard.py`. 원시 JSON·diff·판정은 clone 밖 임시 `.benchmarks/`와 `judge/`에만 두었다.

on arm은 이번 회차부터 light 계약이다. scaffold는 `bouncer scaffold blueprint --scale light` 한 줄이고 계획 문서는 blueprint `index.md` + `tasks/001/{tasks,verification,review}.md` 넷이다. `context-review.md`가 없으므로 plan 게이트의 G18도 없고, task 본문은 `Goal & intent`·`Touch`·`Checklist` 셋만 채웠다. 나머지 게이트 조건은 1·2회차와 같다.

## 태스크 정본 해시

구현 에이전트에게는 각 JSON의 `prompt`만 전달했다. `done_when`은 심사에만 썼다. `docs/benchmark/tasks/`는 수정하지 않았다.

| id | 파일 | prompt sha256 | done_when sha256 |
| --- | --- | --- | --- |
| t1 | `docs/benchmark/tasks/t1-verify-dry-run.json` | `e037014f285fdc77ca424f6a48eee45369796f086ec4e24445c93d3ab3fc0f77` | `69104afe14b34b9f393a90fae944ddfd414be47d6b55e5ad006e088e0f30fe56` |
| t2 | `docs/benchmark/tasks/t2-verify-cmd-expansion.json` | `e74d47c3036e935e9531766c346a1c22969c5a126f0fd7c8a1a06b4b50ee60fe` | `164c829094c01b006966411f22bbddce3d8903bb5b4e277b14c492cec08286bf` |
| t3 | `docs/benchmark/tasks/t3-current-cmd-refactor.json` | `37ad75d76067424d0ed1ea5be26863dafb0ed7c27135bb37220f0def68537df1` | `92b9cbaad87efed6bf94416d627188af284cea922c7efa55ea864af43282661b` |
| t4 | `docs/benchmark/tasks/t4-slow-verify-signal.json` | `d024c734c846e2f9cca58a38387948fbaf9be6933277c0a2d44c5a4a2e3a0b47` | `b5296aa5ef2182d6e7bbbdc1debc05d596a223db55110f5eedf210089386dfd7` |

해시 입력은 UTF-8 원문(prompt 문자열, `done_when` 배열의 `json.dumps(..., ensure_ascii=False)`). 2회차 `baseline.md` / `improved.md` 표와 바이트가 같다. 표본 배제 조건인 prompt 불일치는 없다.

## 격리

| clone | HEAD (시작) | HEAD (커밋 후) | `.git` inode |
| --- | --- | --- | ---: |
| `clones/t1-on` | `b0679f5` | `138c37b` | 13402617 |
| `clones/t2-on` | `b0679f5` | `ee8197c` | 13523503 |
| `clones/t3-on` | `b0679f5` | `e9550a8` | 13523507 |
| `clones/t4-on` | `b0679f5` | `cfd9e29` | 13523522 |

`git clone --no-hardlinks --no-local` 후 `b0679f5`에 detach. linked worktree 없음. 포인터와 verify 원장은 clone별 `.git/bouncer/`에만 있다(protocol.md 2절).

on-light 조건: 각 clone에서 `scripts/bouncer`로 `scaffold epic` → `scaffold blueprint --scale light` → plan 게이트 → `current --set` → 구현 → `bouncer verify` → execute 게이트 → `bouncer commit --yes`. 설치된 플러그인 `/bouncer-*`와 PreToolUse 훅은 1·2회차와 같이 돌리지 않았다. 네 런 모두 governance의 light 경로대로 공용 유지보수 에픽 `044-maintenance`를 새로 만들고 그 아래 blueprint `001`을 쌓았다.

## 검증 명령

네 런 모두 같은 argv, 같은 순서: `npm test` → `npm run lint` → `npm run typecheck` → `npm run build`. `bouncer verify`의 `config.verify`는 `npm test`다. 네 명령 전부는 `collect_metrics.py`가 커밋 후 한 번 더 실행했고 `collect_s`는 그 합이다. 1·2회차와 argv가 같다.

## 런별 결과

| 런 | wall_s | tool_calls_est | collect_s | test | lint | typecheck | build | 테스트 수 | verify 실행 |
| --- | ---: | ---: | ---: | --- | --- | --- | --- | ---: | ---: |
| t1-on | 261 | 22 | 4.29 | pass (1.46s) | pass | pass | pass | 741 | 2 |
| t2-on | 219 | 19 | 4.30 | pass (1.46s) | pass | pass | pass | 739 | 1 |
| t3-on | 219 | 21 | 4.30 | pass (1.45s) | pass | pass | pass | 738 | 1 |
| t4-on | 411 | 24 | 4.30 | pass (1.45s) | pass | pass | pass | 742 | 1 |

네 런 모두 네 검증이 전부 통과했다. 2회차 개선 표본에서 t2·t4를 깨뜨린 lint max-len 위반은 이번에 없다. t1의 verify 2회 중 한 번은 자기가 만든 `--dry-run` 확인이고 증적을 쓴 실행은 1회다.

토큰은 기록하지 않았다. 1회차 off/on 토큰 합(202,268 / 442,061)과 집계 경로가 달라 비교축에 넣지 않는다.

diff 모양(메트릭, `.bouncer/context` 포함):

| 런 | files | +/− | 테스트 줄 비율 | 계획 문서 `.bouncer/context` | 제품(context 제외) |
| --- | ---: | --- | ---: | --- | --- |
| t1-on | 12 | +326 / −14 | 0.184 | 6 files, +175 | 6 files, +151 / −14 |
| t2-on | 9 | +206 / −3 | 0.112 | 6 files, +175 | 3 files, +31 / −3 |
| t3-on | 8 | +202 / −10 | 0.000 | 6 files, +181 | 2 files, +21 / −10 |
| t4-on | 9 | +437 / −14 | 0.192 | 6 files, +190 | 3 files, +247 / −14 |

제품 6파일 중 절반은 `scripts/lib/**` 빌드 산출물이다. 빌드 산출물을 뺀 소스+테스트 변경은 t1 +117/−8, t2 +27/−2, t3 +11/−5, t4 +172/−7이다.

## 계획 문서 줄 수

네 계획 문서(blueprint `index.md` + task 묶음 셋)를 사이클 종료 시점에 `wc -l`로 셌다.

| 런 | index.md | tasks.md | verification.md | review.md | 합 |
| --- | ---: | ---: | ---: | ---: | ---: |
| scaffold 직후 (참조 측정) | 23 | 31 | 22 | 21 | **97** |
| t1-on | 23 | 52 | 47 | 24 | **146** |
| t2-on | 23 | 52 | 47 | 24 | **146** |
| t3-on | 24 | 53 | 47 | 27 | **151** |
| t4-on | 24 | 57 | 47 | 32 | **160** |

`scaffold 직후`는 같은 베이스의 별도 clone에서 `bouncer scaffold blueprint --scale light`만 실행해 잰 템플릿 산출값이다. governance가 약속한 "네 문서 100줄 이하"는 이 시점에서 97줄로 지켜진다.

작성 후 값이 146~160으로 커지는 몫은 두 갈래다. `verification.md`는 하네스가 증적을 쓰면서 22 → 47로 25줄 늘고, 나머지 24~38줄은 작성자가 채운 본문이다. 하네스 증적 25줄을 빼도 121 / 121 / 126 / 135로 100줄을 넘는다. 판정은 `README.md`에 적는다.

**plan 게이트 통과 시점의 런별 줄 수는 기록하지 못했다.** 위 표는 별도 clone의 템플릿 참조값 한 줄과 런별 사이클 종료 값 네 줄뿐이라, "각 런이 plan 게이트를 통과한 시점"의 값은 어느 행에도 없다. 그 값을 담았을 산출물은 런별 plan 게이트 통과 직후의 `.bouncer/context` 스냅샷인데, 네 clone은 사이클 끝에 커밋 하나만 남겨 중간 상태가 git 객체로 남지 않았고(`git fsck`에 dangling 없음) 임시 `.benchmarks/`에도 그 스냅샷이 없다. 남은 것은 `t1-on.cycle.json`의 작성자 메모(verify 증적 전 네 문서 116줄) 하나뿐이고, 이것도 plan 단계가 아니라 execute 본문 작성까지 끝난 시점 값이다.

따라서 앞 문단의 121 / 121 / 126 / 135는 사이클 종료 값에서 하네스 증적 몫을 뺀 **파생 대리값**이지 plan 단계 실측이 아니다. 100줄 목표가 겨냥하는 "scaffold + plan 단계 작성분"과 "사후 하네스 증적"을 가르는 숫자는 이번 회차에서 재지 못했다.

`.bouncer/context` 전체 추가 줄(175 / 175 / 181 / 190)은 위 네 문서에 에픽 `index.md`(28~29줄, light 경로에서 유지보수 에픽을 처음 만들며 1회 발생)와 컨텍스트 색인 1줄을 더한 값이다.

## 게이트 실패

각 clone의 `validate --gate` 출력에서 `failures`를 세었다.

| 런 | G18 | S9 | G4 | G10 | 실제로 난 코드 |
| --- | ---: | ---: | ---: | ---: | --- |
| t1-on | 0 | 0 | 0 | 0 | 없음. plan/execute/commit 첫 validate가 `ok: true` |
| t2-on | 0 | 0 | 0 | 0 | plan G1·G2·G3, execute G6·G8 — 전부 scaffold 기본 status를 넘기지 않아 난 상태 전이 코드 |
| t3-on | 0 | 0 | 0 | 0 | execute G14 — review finding severity에 `info`를 써서 enum(blocker/major/minor/nit) 위반 |
| t4-on | 0 | 0 | 0 | 0 | 없음. plan/execute/commit 첫 validate가 `ok: true` |

G18이 0인 것은 에이전트가 잘 써서가 아니라 light 계약에 context-review 문서가 없어 판정 대상이 없기 때문이다. 2회차 개선 표본의 G18 0과 같은 뜻이 아니다. 나머지 codes는 문서 내용 규칙이 아니라 status·enum 코드이며, 네 런 모두 게이트를 우회하지 않고 고쳐서 통과했다.

## 독립 블라인드 심사

구현 세션의 자가 채점은 쓰지 않는다. 코드를 쓴 적 없는 심사 프로세스 4개를 따로 띄웠다. 각 심사는 자기 패킷만 받았다: 제품 diff(`.bouncer/context` 제외), `prompt`, `done_when`, 루브릭. arm 이름·`t*-on` 같은 소스 클론 경로·구현 트랜스크립트·다른 런의 점수는 주지 않았고, `docs/benchmark/**`(이전 회차 점수)를 읽지 못하게 했다.

블라인드 클론은 `judge/clones/run-{T,U,V,W}`다. `git clone --no-hardlinks --no-local`로 만들었고 common-dir inode는 17726615 / 17468344 / 17198033 / 17726619으로 구현 클론과 다르다. 심사 트리에는 제품 diff만 얹었고 `.bouncer/context` 추가분은 넣지 않았다. 라벨은 태스크 번호와 순서를 맞추지 않았다.

| 런 | blind label | 합성 | 등급 | C | S | T | F | M | 심사 revert |
| --- | --- | ---: | --- | ---: | ---: | ---: | ---: | ---: | --- |
| t1-on | run-V | 95.19 | A | 5 | 5 | 4 | 5 | 4 | 실행. 741 / 739 pass / **2 fail** |
| t2-on | run-T | 92.79 | A | 3 | 5 | 4 | 5 | 5 | 실행. 739 / 737 pass / **2 fail** |
| t3-on | run-W | 90.39 | A | 5 | 5 | 2 | 4 | 5 | 실행. 738 / 738 pass / **0 fail** |
| t4-on | run-U | 87.99 | B | 4 | 4 | 4 | 4 | 4 | 실행. 742 / 738 pass / **4 fail** |

차원 약어: C 정확성, S 스코프, T 테스트, F 코드베이스 적합성, M 유지보수. 합성 = 측정 40 + 심사 60 (`scorecard.py`). 네 런 모두 측정 절반이 만점(39.99/40, 신뢰도 0.88)이라 합성 차이는 전부 심사 차이다. 네 심사자 모두 revert 체크를 **추론이 아니라 실행**했다고 요약에 명시했다.

심사자가 제품에서 짚은 것:

- t2 (run-T) 정확성 3: 술어 자체는 `$` 전부를 막고 S12와 런타임이 같은 함수를 쓴다. 그러나 `.bouncer/config.json`의 `verify` 폴백 경로(`verification.ts:155-158`)는 그 술어를 호출하지 않아, 심사자가 직접 확인했을 때 `readVerifyCommand`가 config에서 `"npm test $FLAGS"`를 그대로 돌려줬다. 프롬프트가 버그로 지목한 두 표면 중 하나가 남았다. 2회차 t2 심사(run-S)도 같은 지점을 정확성 3으로 깎았다.
- t3 (run-W) 테스트 2: 소스만 되돌려도 738/738. diff가 테스트를 한 줄도 추가하지 않아 추출을 잠그지 않는다. 2회차 t3도 같은 이유로 2였다. 1회차 t3는 3이었다.
- t4 (run-U) 스코프 4: 요청에 없는 env var `BOUNCER_VERIFY_SLOW_MS`와 export 3개·`executeVerify` 옵션 4개·실행 후 요약 채널이 붙었다. 다만 심사자가 `BOUNCER_VERIFY_SLOW_MS=1000`으로 `sleep 4`를 돌려 +1s·+2s·+3s에 stderr 신호가 **실행 중** 도달하는 것을 직접 확인했다(정확성 4). 2회차 t4는 이 지점에서 워치독이 끝난 뒤에도 한 줄을 더 찍어 정확성 3이었다.
- t4 (run-U) 테스트 4: 새 테스트 4개가 revert 시 전부 깨진다. 다만 전부 `progress` 시임을 스텁해서 실제 터미널 출력은 자동 테스트가 덮지 않는다.

원시 심판 JSON: `judge/blind/run-{T,U,V,W}.judgment.json`. 카드: `.benchmarks/t*-on.card.json`.

실격(블로킹 파인딩으로 합성을 35에 캡)은 0건이다. 네 카드 모두 `cap_applied: null`, `blocking_findings: []`이다.

## 합계 / 평균 (n=4)

| | 값 |
| --- | --- |
| wall_s 합계 | 1110 (18.50분) |
| wall_s 평균 | 277.5 |
| tool_calls_est 합계 | 86 |
| collect_s 합계 | 17.19 |
| collect_s 평균 | 4.30 |
| 합성 합계 | 366.36 |
| 합성 평균 | 91.59 |
| 등급 | A / A / A / B |
| test quality | 4 / 4 / 2 / 4 (평균 3.50) |
| 계획 문서 4종 줄 | 146 / 146 / 151 / 160 (평균 150.75). scaffold 산출 기준 97 |
| 검증 | 네 런 모두 test·lint·typecheck·build 전부 pass |
| revert fail 수 | 2 / 2 / 0 / 4 (독립 심사 실행) |
| 블라인드 라벨 | run-V / run-T / run-W / run-U |
| G18 / S9 / G4 / G10 | 0 / 0 / 0 / 0 |
| 실격 | 0 |

## 제외 표본

| 사유 | 해당 | 비고 |
| --- | --- | --- |
| full로 실행된 런 | 없음. 네 런 모두 `--scale light`이고 `context-review.md`가 없다 | |
| prompt·`done_when` 불일치 | 없음. 해시가 2회차 표와 같다 | |
| 검증 argv 불일치 | 없음. 네 명령·순서가 1·2회차와 같다 | |
| 심사 규약 불일치 | 없음. 블라인드 라벨·독립 클론·revert 실행 요구가 2회차와 같다 | |
| `b0679f5`가 아닌 베이스 | 없음 | |
| linked worktree | 없음. 네 런 모두 독립 clone | |
| 자가 심사 | 없음. 합성은 블라인드 심사 4건이다 | |
| 100줄 초과 | **네 런 전부.** Interface의 배제 조항대로면 성공 표본이 0이 된다. 배제하지 않고 전부 싣고 `README.md`에서 미달로 판정한다 — 표본을 지우면 이번 회차의 결론 자체가 사라진다 | 146 / 146 / 151 / 160 |

1·2회차 `docs/benchmark/runs/`와 `docs/benchmark/round-2/` 수치는 덮어쓰지 않았다.

## 한계

- **n=4**, 셀당 반복 1회. t3의 test quality 2가 2·3회차 연속 같지만(1회차는 3) 동점인지 노이즈인지 이 설계로는 모른다.
- **모델이 또 바뀌었다.** 1회차 Sonnet, 2회차 Grok 4.6, 3회차 Claude Opus 5. 회차 간 Δ에는 계약 변화와 모델 변화가 함께 들어 있다. 이 회차의 합성 평균 91.59가 2회차 개선 86.93보다 높은 것을 light 계약의 효과로 읽으면 안 된다.
- **네 런을 동시에 돌렸다.** `wall_s`는 각 에이전트가 잰 자기 시작·종료 시각이다. 한 머신에서 병렬이라 `npm test`·`npm run build`가 겹치는 구간에 CPU 경합이 있다(런당 로컬 명령 시간은 4.3s 수준이라 몫은 작다). 2회차 개선 표본의 실행 동시성은 기록되지 않아 이 축이 회차 간에 동일한지 확인할 수 없다.
- **on arm은 CLI 에뮬레이션.** PreToolUse `hooks/commit-safety.js`와 `/bouncer-*` 슬래시 커맨드 경로는 미실행이다.
- 심사자 4명은 각자 한 명이다. 패널 투표는 없다. 제품 diff만 봤고 계획 문서는 1·2회차와 같이 심사에서 뺐다.
- 계획 문서 줄 수는 `on-light` 라벨이 붙는다. 1·2회차 값은 `on-full`이고 문서 세트가 다르므로 두 값을 빼서 감소분을 만들지 않는다(protocol.md 3회차 절).
