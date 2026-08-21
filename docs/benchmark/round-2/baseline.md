# 2회차 기준선: PR #53 게이트만 적용된 on-arm

**측정일: 2026-08-21 (KST)**  
**베이스 커밋: `c7df084953e440a0a2366a52213af67f4c6e55ba`** (`Merge pull request #53 from cheongfish/fix/001-gate-integrity`)  
**arm:** Bouncer on만. t1~t4를 각각 독립 clone에서 1회.  
**모델:** Cursor Grok 4.6, 단일 세션, 셀당 반복 1회.  
**도구:** 기존 `skills/agentic-code-benchmark`의 `collect_metrics.py` / `scorecard.py` (저장소에 수집 스크립트를 추가하지 않음). 원시 JSON·diff·로그는 clone 밖 `/tmp/bouncer-r2-baseline/.benchmarks/`와 독립 심사 산출 `/tmp/bouncer-r2-judge/`에만 두었다.

이 파일이 Task 005가 비교할 기준값이다. 제품 코드·프롬프트·scaffold는 측정 전에 바꾸지 않았다. 베이스는 PR #53이 `develop`에 머지된 직후이며, 1회차 베이스 `3f52018`보다 G13 원장 대조와 `git commit -a` 스코프 검사가 코드로 강제된다.

## 태스크 정본 해시

구현 에이전트에게는 각 JSON의 `prompt`만 전달했다. `done_when`은 심사(점수표)에만 썼다. 파일을 수정하지 않았다.

| id | 파일 | prompt sha256 | done_when sha256 |
| --- | --- | --- | --- |
| t1 | `docs/benchmark/tasks/t1-verify-dry-run.json` | `e037014f285fdc77ca424f6a48eee45369796f086ec4e24445c93d3ab3fc0f77` | `69104afe14b34b9f393a90fae944ddfd414be47d6b55e5ad006e088e0f30fe56` |
| t2 | `docs/benchmark/tasks/t2-verify-cmd-expansion.json` | `e74d47c3036e935e9531766c346a1c22969c5a126f0fd7c8a1a06b4b50ee60fe` | `164c829094c01b006966411f22bbddce3d8903bb5b4e277b14c492cec08286bf` |
| t3 | `docs/benchmark/tasks/t3-current-cmd-refactor.json` | `37ad75d76067424d0ed1ea5be26863dafb0ed7c27135bb37220f0def68537df1` | `92b9cbaad87efed6bf94416d627188af284cea922c7efa55ea864af43282661b` |
| t4 | `docs/benchmark/tasks/t4-slow-verify-signal.json` | `d024c734c846e2f9cca58a38387948fbaf9be6933277c0a2d44c5a4a2e3a0b47` | `b5296aa5ef2182d6e7bbbdc1debc05d596a223db55110f5eedf210089386dfd7` |

해시 입력은 UTF-8 원문(prompt 문자열, `done_when` 배열의 `json.dumps(..., ensure_ascii=False)`).

## 격리

| clone | HEAD | `.git` inode (`--git-common-dir`) |
| --- | --- | --- |
| `/tmp/bouncer-r2-baseline/clones/t1-on` | `516d6a344d1662bad64dd29d94a675d588960139` | 13248262 |
| `/tmp/bouncer-r2-baseline/clones/t2-on` | `b1edaa6976eabca7dc7af3577f4059aa969379b0` | 13255704 |
| `/tmp/bouncer-r2-baseline/clones/t3-on` | `6a1f1a99981ecf32c9178a87e850221ac9c326e0` | 13260978 |
| `/tmp/bouncer-r2-baseline/clones/t4-on` | `585de6ef482cd71f3ae4eedff12c54c6357822ac` | 13269111 |

`git clone --no-hardlinks --no-local` 후 `c7df084`에 detach. linked worktree 없음. `.bouncer/context`를 clone끼리 공유하지 않음. 포인터와 verify 원장은 clone별 `.git/bouncer/`에만 있다.

on 조건: 각 clone에서 `scripts/bouncer`로 scaffold → plan 게이트 → `current --set` → 구현 → `bouncer verify` → execute 게이트 → `bouncer commit --yes`. 설치된 플러그인 `/bouncer-*`와 PreToolUse 훅은 돌리지 않았다(1회차 protocol과 같은 CLI 에뮬레이션).

구현 편집은 네 clone에 **한 Cursor 세션**에서 적용했다. CLI 사이클은 clone별 독립 프로세스다.

## 검증 명령

네 런 모두 같은 argv, 같은 순서:

1. `npm test`
2. `npm run lint`
3. `npm run typecheck`
4. `npm run build`

`bouncer verify`의 `config.verify`는 `npm test`라서 G13 원장에는 테스트 명령만 남는다. 네 명령 전부는 `collect_metrics.py`가 커밋 후 한 번 더 실행했다. `collect_s`는 그 네 명령 합이다.

## 런별 결과 (005 비교 표본)

| 런 | collect_s | test | lint | typecheck | build | 테스트 수 | revert |
| --- | ---: | --- | --- | --- | --- | ---: | --- |
| t1-on | 4.40 | pass (1.44s) | pass | pass | pass | 720 | 실행. 소스만 `c7df084`로 되돌림 → 720 tests / 712 pass / **8 fail** (`dryRunVerification is not a function` 포함) |
| t2-on | 4.49 | pass (1.56s) | pass | pass | pass | 712 | 실행. 712 / 710 pass / **2 fail** (S12 `$VAR` 테스트, `readVerifyCommand rejects non-single executable commands`) |
| t3-on | 4.37 | pass (1.44s) | pass | pass | pass | 711 | 실행. 711 / 711 pass / **0 fail**. 새 테스트가 없어 리팩터를 되돌려도 스위트가 통과한다 |
| t4-on | 4.58 | pass (1.65s) | **fail** (max-len 128>120, `verification.ts:373`) | pass | pass | 717 | 실행. 717 / 713 pass / **4 fail** (`still-running signal` stderr 빈 문자열 포함) |

diff 모양(메트릭, `.bouncer/context` 포함):

| 런 | files | +/− | 테스트 줄 비율 | 계획 문서 `.bouncer/context` | 제품(context 제외) |
| --- | ---: | --- | ---: | ---: | ---: |
| t1-on | 14 | +448 / −18 | 0.281 | 7 files, +225 | 7 files, +223 / −18 |
| t2-on | 11 | +251 / −5 | 0.096 | 7 files, +219 | 4 files, +32 / −5 |
| t3-on | 9 | +236 / −10 | 0.000 | 7 files, +215 | 2 files, +21 / −10 |
| t4-on | 10 | +513 / −62 | 0.183 | 7 files, +217 | 3 files, +296 / −62 |

## 독립 블라인드 심사 (품질 점수표)

구현 세션이 쓴 점수표는 쓰지 않는다. 코드를 쓰지 않은 심사 프로세스 4개를 따로 띄웠다. 각 심사는 자기 패킷만 받았다: 제품 diff(`.bouncer/context` 제외), `prompt`, `done_when`, 루브릭. arm 이름·`t1-on` 같은 소스 클론 경로·구현 트랜스크립트·다른 런의 점수는 주지 않았다.

블라인드 클론은 `/tmp/bouncer-r2-judge/clones/run-{P,Q,R,S}`다. `git clone --no-hardlinks --no-local`로 만들었고 common-dir inode는 13400507 / 14422909 / 14424120 / 14425331로 구현 클론과 다르다. 심사용 작업 트리에서 `.bouncer/context` 추가분은 빼서 `git diff`가 on-arm scaffold를 드러내지 않게 했다.

라벨은 태스크 번호와 순서를 맞추지 않았다. 대응은 점수 확정 뒤에만 이 보고서에 적는다.

| 런 | blind label | 합성 | 등급 | C | S | T | F | M | 심사 revert (실행) |
| --- | --- | ---: | --- | ---: | ---: | ---: | ---: | ---: | --- |
| t1-on | run-Q | 95.19 | A | 5 | 5 | 4 | 5 | 4 | 실행. 720 / 712 pass / **8 fail** |
| t2-on | run-S | 92.79 | A | 3 | 5 | 4 | 5 | 5 | 실행. 712 / 710 pass / **2 fail** |
| t3-on | run-P | 90.39 | A | 5 | 5 | 2 | 5 | 4 | 실행. 711 / 711 pass / **0 fail** |
| t4-on | run-R | 79.87 | C | 4 | 3 | 4 | 4 | 4 | 실행. 717 / 713 pass / **4 fail** |

차원 약어: C 정확성, S 스코프, T 테스트, F 코드베이스 적합성, M 유지보수. 합성 = 측정 40 + 심사 60 (`scorecard.py`). t4 측정 절반은 lint fail로 `static_clean` 0.5.

원시 심판 JSON: `/tmp/bouncer-r2-judge/blind/run-{P,Q,R,S}.judgment.json`. 카드: `/tmp/bouncer-r2-baseline/.benchmarks/blind/t*-on.card.json`.

심사자가 제품에서 짚은 것 (005가 합성만 보지 말 것):

- t2 (run-S) 정확성 3: 태스크 문서의 `$VAR`는 막히지만 `.bouncer/config.json`의 `config.verify`는 `readVerifyCommand`가 길이만 보고 통과시킨다. 프롬프트가 그 경로를 버그로 적었다.
- t3 (run-P) 테스트 2: 소스만 되돌리면 711/711. 새 테스트가 없어 추출을 잠그지 않는다.
- t4 (run-R) 스코프 3: env/config 키는 없으나 `heartbeatIntervalMs` / `createHeartbeatWorker` 주입과 `DEFAULT_SLOW_VERIFY_HEARTBEAT_MS` export가 요청에 없는 표면이다. 기본 30초 미만 입력은 신호가 없다.

## 합계 / 평균 (비교 가능한 표본 n=4)

| | 값 |
| --- | --- |
| collect_s 합계 | 17.84 |
| collect_s 평균 | 4.46 |
| 합성 합계 | 358.24 |
| 합성 평균 | 89.56 |
| 등급 | A / A / A / C |
| 계획 문서 줄 | 225 / 219 / 215 / 217 (평균 219). 제품 크기와 무관하게 7파일이 붙는다 |
| 검증 | t1–t3 전부 pass. t4는 test·typecheck·build pass, lint fail |
| revert fail 수 | 8 / 2 / 0 / 4 (구현 측정과 독립 심사 모두 실행. 실패 수는 같다) |
| 블라인드 라벨 | run-Q / run-S / run-P / run-R |

## 제외 표본

Interface는 자가 심사 런과 비교 불가한 비용 열을 기준선 표본에서 뺀다. 값은 원시 JSON에 남아 있고, Task 005 Δ의 분모가 아니다.

| 사유 | 해당 | 기록만 남긴 값 |
| --- | --- | --- |
| `c7df084`가 아닌 베이스 | 없음 | |
| 수정된 프롬프트 | 없음 | |
| linked worktree | 없음. 1회차 on 첫 실행(worktree·공유 common-dir)은 이번 회차에 다시 돌리지 않았다 | |
| 공유 `.bouncer/context` | 없음 | |
| 네 검증 명령 누락 | 없음 | |
| 자가 심사 | **구현 세션이 채점한 점수표.** `run-W`…`run-Z`와 `task_id` t1–t4가 arm·태스크를 드러냈다. 위 표의 합성은 이 숫자가 아니다. | 구현 세션 합성 t1 95.19 / t2 99.99 / t3 95.19 / t4 87.07 (평균 94.36). 등급 A/A/A/B |
| 에이전트 비용 아님 | **토큰·툴콜·cycle_s.** 한 세션에서 네 clone에 구현을 적용한 뒤 CLI 사이클만 재었다. Cursor가 API usage를 내보내지 않아 토큰은 비었다. `t*-cycle.json`의 `wall_s`는 약 3s다. 1회차 on 합계(에이전트 벽시계)와 맞춰 쓰지 않는다. | cycle_s 3.08 / 3.14 / 3.21 / 3.49 (합 12.92, 평균 3.23). 툴콜을 13으로 센 것은 CLI+npm 스텝 수다. 토큰: 네 런 모두 없음 |
| t1 scaffold no-op | t1 cycle JSON의 `scaffold_epic`/`scaffold_bp`가 `already-exists`다. t2–t4는 epic·blueprint를 새로 만들었다. 같은 13을 더해 합계 52를 만들지 않는다. | t1 CLI 스텝 13은 비교축에서 뺀다 |

1회차 `docs/benchmark/runs/` 수치는 덮어쓰지 않았다. 그 베이스는 `3f52018`이라 이 표와 더하면 안 된다.

## 한계

- **n=4**, 셀당 반복 1회, 단일 모델(Grok 4.6). 1회차는 Sonnet. 모델이 바뀌면 005의 Δ에 모델 효과가 섞인다.
- **에이전트 토큰·툴콜·벽시계 없음.** 005가 비용 Δ를 쓰려면 clone별 독립 on-arm 에이전트 런을 다시 재야 한다.
- **on arm은 CLI 에뮬레이션.** PreToolUse `hooks/commit-safety.js`는 미실행. G13은 `bouncer verify`가 `npm test`를 돌려 원장을 쓴 경로만 확인했다(verification.md `command: npm test`, exit 0).
- t4 전달분이 lint max-len을 깨므로 lint fail은 게이트가 린트를 강제하지 않은 결과이기도 하다. `config.verify`는 `npm test`뿐이다.
- 심사자 4명은 각자 한 명이다. 패널 투표는 없다. 제품 diff만 봤고 계획 문서는 1회차 protocol과 같이 심사에서 뺐다.

## Task 005에 넘기는 기준값 요약

PR #53만 있는 트리(`c7df084`)에서 Bouncer on, t1~t4 각 1회. 비교 가능한 지표:

- 네 검증: t1–t3 전부 pass, t4는 test·typecheck·build pass / lint fail
- revert: t1 8 fail, t2 2 fail, t3 0 fail, t4 4 fail (구현 측정과 독립 심사 모두 실행)
- 계획 문서: 런당 7파일, +215~225줄
- collect_s: 4.40 / 4.49 / 4.37 / 4.58 (평균 4.46)
- 제품 diff: t1 +223/−18 (7 files), t2 +32/−5 (4), t3 +21/−10 (2), t4 +296/−62 (3)
- 독립 블라인드 합성: t1 95.19 (run-Q, A), t2 92.79 (run-S, A), t3 90.39 (run-P, A), t4 79.87 (run-R, C). 평균 89.56
- 차원: t1 5/5/4/5/4, t2 3/5/4/5/5, t3 5/5/2/5/4, t4 4/3/4/4/4

쓰지 말 것: 구현 세션 합성 94.36과 그 차원·등급 A/A/A/B, 빈 토큰, 툴콜 13 또는 합 52, cycle_s ≈ 3s.
