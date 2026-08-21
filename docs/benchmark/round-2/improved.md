# 2회차 개선 on-arm: Task 002~004가 있는 HEAD

**측정일: 2026-08-21 (KST)**  
**베이스 커밋: `6101b2baddf6d5e272cf805643950898100b77e9`** (`feat: 병렬 측정 공유 상태 제약 문서화`. 부모에 scaffold 힌트 `fbdba63`, worktree 저장소 인식 `801b02b`가 포함됨)  
**arm:** Bouncer on만. t1~t4를 각각 독립 clone에서 1회.  
**모델:** Cursor Grok 4.6, 클론마다 구현 에이전트 1명, 셀당 반복 1회.  
**도구:** 기존 `skills/agentic-code-benchmark`의 `collect_metrics.py` / `scorecard.py`. 원시 JSON·diff·로그는 clone 밖 `/tmp/bouncer-r2-improved/.benchmarks/`와 독립 심사 `/tmp/bouncer-r2-improved/judge/`에만 두었다.

이 파일이 Task 001 기준선(`c7df084`)과 1회차 off를 비교할 개선 표본이다. 제품 프롬프트는 기준선과 같다.

## 태스크 정본 해시

구현 에이전트에게는 각 JSON의 `prompt`만 전달했다. `done_when`은 심사에만 썼다. `docs/benchmark/tasks/`는 수정하지 않았다.

| id | 파일 | prompt sha256 | done_when sha256 |
| --- | --- | --- | --- |
| t1 | `docs/benchmark/tasks/t1-verify-dry-run.json` | `e037014f285fdc77ca424f6a48eee45369796f086ec4e24445c93d3ab3fc0f77` | `69104afe14b34b9f393a90fae944ddfd414be47d6b55e5ad006e088e0f30fe56` |
| t2 | `docs/benchmark/tasks/t2-verify-cmd-expansion.json` | `e74d47c3036e935e9531766c346a1c22969c5a126f0fd7c8a1a06b4b50ee60fe` | `164c829094c01b006966411f22bbddce3d8903bb5b4e277b14c492cec08286bf` |
| t3 | `docs/benchmark/tasks/t3-current-cmd-refactor.json` | `37ad75d76067424d0ed1ea5be26863dafb0ed7c27135bb37220f0def68537df1` | `92b9cbaad87efed6bf94416d627188af284cea922c7efa55ea864af43282661b` |
| t4 | `docs/benchmark/tasks/t4-slow-verify-signal.json` | `d024c734c846e2f9cca58a38387948fbaf9be6933277c0a2d44c5a4a2e3a0b47` | `b5296aa5ef2182d6e7bbbdc1debc05d596a223db55110f5eedf210089386dfd7` |

해시 입력은 UTF-8 원문(prompt 문자열, `done_when` 배열의 `json.dumps(..., ensure_ascii=False)`). Task 001 `baseline.md` 표와 바이트가 같다.

## 격리

| clone | HEAD (시작) | HEAD (커밋 후) | `.git` inode (`--git-common-dir`) |
| --- | --- | --- | ---: |
| `/tmp/bouncer-r2-improved/clones/t1-on` | `6101b2b` | `6da350b` | 13401081 |
| `/tmp/bouncer-r2-improved/clones/t2-on` | `6101b2b` | `8d0adc5` | 13401090 |
| `/tmp/bouncer-r2-improved/clones/t3-on` | `6101b2b` | `2c278db` | 13401092 |
| `/tmp/bouncer-r2-improved/clones/t4-on` | `6101b2b` | `7643119` | 13522222 |

`git clone --no-hardlinks --no-local` 후 `6101b2b`에 detach. linked worktree 없음. 포인터와 verify 원장은 clone별 `.git/bouncer/`에만 있다.

on 조건: 각 clone에서 `scripts/bouncer`로 scaffold → plan 게이트 → `current --set` → 구현 → `bouncer verify` → execute 게이트 → `bouncer commit --yes`. 설치된 플러그인 `/bouncer-*`와 PreToolUse 훅은 돌리지 않았다.

구현은 클론마다 **별도 세션**이다. 한 세션이 네 clone에 코드를 밀어 넣은 뒤 CLI만 재는 방식은 쓰지 않았다.

## 검증 명령

네 런 모두 같은 argv, 같은 순서:

1. `npm test`
2. `npm run lint`
3. `npm run typecheck`
4. `npm run build`

`bouncer verify`의 `config.verify`는 `npm test`다. 네 명령 전부는 `collect_metrics.py`가 커밋 후 한 번 더 실행했다. `collect_s`는 그 네 명령 합이다.

## 런별 결과

| 런 | wall_s | tool_calls_est | collect_s | test | lint | typecheck | build | 테스트 수 | revert (심사 실행) |
| --- | ---: | ---: | ---: | --- | --- | --- | --- | ---: | --- |
| t1-on | 408 | 110 | 6.20 | pass (2.45s) | pass | pass | pass | 717 | 실행. 717 / 714 pass / **3 fail** |
| t2-on | 459 | 92 | 6.16 | pass (2.50s) | **fail** (max-len 130>120, `test/verification-runner.test.js:272`) | pass | pass | 715 | 실행. 715 / 712 pass / **3 fail** |
| t3-on | 199 | 62 | 6.03 | pass (2.44s) | pass | pass | pass | 713 | 실행. 713 / 713 pass / **0 fail**. 새 테스트가 없어 헬퍼를 되돌려도 스위트가 통과한다 |
| t4-on | 394 | 92 | 6.46 | pass (2.67s) | **fail** (max-len 135>120, `verification.ts:204`) | pass | pass | 715 | 실행. 715 / 714 pass / **1 fail** |

토큰 수는 Cursor가 API usage를 내보내지 않아 비었다. 비교축에 넣지 않는다.

diff 모양(메트릭, `.bouncer/context` 포함):

| 런 | files | +/− | 테스트 줄 비율 | 계획 문서 `.bouncer/context` | 제품(context 제외) |
| --- | ---: | --- | ---: | --- | --- |
| t1-on | 13 | +445 / −14 | 0.189 | 7 files, +266 | 6 files, +179 / −14 |
| t2-on | 11 | +338 / −7 | 0.104 | 7 files, +278 | 4 files, +60 / −7 |
| t3-on | 9 | +273 / −10 | 0.000 | 7 files, +252 | 2 files, +21 / −10 |
| t4-on | 10 | +390 / −16 | 0.067 | 7 files, +256 | 3 files, +134 / −16 |

## 게이트 실패 (plan/execute 로그)

각 clone의 `/tmp/bouncer-r2-improved/.benchmarks/t*-on.agent.log`에서 `validate --gate` JSON의 `failures`를 세었다. 에이전트가 쓴 cycle JSON과 같다.

| 런 | G18 | S9 | G4 | 다른 실패 |
| --- | ---: | ---: | ---: | --- |
| t1-on | 0 | 0 | 0 | plan/execute/commit 첫 validate가 `ok: true` |
| t2-on | 0 | 0 | 0 | plan/execute/commit 게이트는 통과. `bouncer verify`(npm test)가 구현 중 **2회 실패** 후 3회차에 통과. G18/S9/G4가 아니다 |
| t3-on | 0 | 0 | 0 | plan/execute/commit 첫 validate가 `ok: true` |
| t4-on | 0 | 0 | 0 | plan/execute/commit 첫 validate가 `ok: true` |

스키마 발견 왕복(G18/S9/G4)은 네 런 모두 0건이다. n=4에서 “힌트가 원인”이라고 일반화하지 않는다. 구현 에이전트가 첫 plan validate 전에 문서를 채워 통과한 기록이다.

## 독립 블라인드 심사 (품질 점수표)

구현 세션이 쓴 점수표는 쓰지 않는다. 코드를 쓰지 않은 심사 프로세스 4개를 따로 띄웠다. 각 심사는 자기 패킷만 받았다: 제품 diff(`.bouncer/context` 제외), `prompt`, `done_when`, 루브릭. arm 이름·소스 클론 경로·구현 트랜스크립트·다른 런의 점수는 주지 않았다.

블라인드 클론은 `/tmp/bouncer-r2-improved/judge/clones/run-{J,K,L,M}`다. `git clone --no-hardlinks --no-local`로 만들었고 common-dir inode는 13401616 / 13522730 / 13401718 / 13401846으로 구현 클론과 다르다. 심사용 작업 트리에 `.bouncer/context` 추가분은 넣지 않았다.

라벨은 태스크 번호와 순서를 맞추지 않았다. 대응은 점수 확정 뒤에만 이 보고서에 적는다.

| 런 | blind label | 합성 | 등급 | C | S | T | F | M | 심사 revert (실행) |
| --- | --- | ---: | --- | ---: | ---: | ---: | ---: | ---: | --- |
| t1-on | run-K | 95.19 | A | 5 | 5 | 4 | 5 | 4 | 실행. 717 / 714 pass / **3 fail** |
| t2-on | run-M | 89.47 | B | 5 | 5 | 4 | 5 | 4 | 실행. 715 / 712 pass / **3 fail** |
| t3-on | run-J | 87.99 | B | 5 | 5 | 2 | 4 | 4 | 실행. 713 / 713 pass / **0 fail** |
| t4-on | run-L | 75.07 | C | 3 | 4 | 3 | 4 | 3 | 실행. 715 / 714 pass / **1 fail** |

차원 약어: C 정확성, S 스코프, T 테스트, F 코드베이스 적합성, M 유지보수. 합성 = 측정 40 + 심사 60 (`scorecard.py`). t2·t4 측정 절반은 lint fail로 `static_clean` 0.5.

원시 심판 JSON: `/tmp/bouncer-r2-improved/judge/blind/run-{J,K,L,M}.judgment.json`. 카드: `/tmp/bouncer-r2-improved/.benchmarks/t*-on.card.json`.

심사자가 제품에서 짚은 것:

- t3 (run-J) 테스트 2: 소스만 되돌리면 713/713. 추출을 잠그는 새 테스트가 없다.
- t4 (run-L) 정확성 3: 워치독이 실행 중에 한 줄을 찍지만, `finish()`가 끝난 뒤에도 “아직 실행 중”이라고 한 줄을 더 찍는다. 새 테스트는 `warn` 주입 경로라 워치독을 건너뛴다.
- t2 (run-M) lint: 테스트 한 줄이 120자를 넘긴다. 게이트 `config.verify`는 `npm test`뿐이라 execute는 통과했다.

실격(블로킹 파인딩으로 합성을 35에 캡)은 0건이다. t4-off의 커버리지 CI 실패와 같은 종류의 블로킹은 없다.

## 합계 / 평균 (비교 가능한 표본 n=4)

| | 값 |
| --- | --- |
| wall_s 합계 | 1460 (24.33분) |
| wall_s 평균 | 365 |
| tool_calls_est 합계 | 356 |
| collect_s 합계 | 24.85 |
| collect_s 평균 | 6.21 |
| 합성 합계 | 347.72 |
| 합성 평균 | 86.93 |
| 등급 | A / B / B / C |
| test quality | 4 / 4 / 2 / 3 (평균 3.25) |
| 계획 문서 줄 | 266 / 278 / 252 / 256 (평균 263). 제품 크기와 무관하게 7파일이 붙는다 |
| 검증 | t1·t3 전부 pass. t2·t4는 test·typecheck·build pass, lint fail |
| revert fail 수 | 3 / 3 / 0 / 1 (독립 심사 실행) |
| 블라인드 라벨 | run-K / run-M / run-J / run-L |
| G18 / S9 / G4 | 0 / 0 / 0 (런 합도 0) |

## 제외 표본

| 사유 | 해당 | 기록만 남긴 값 |
| --- | --- | --- |
| 프롬프트·done_when 불일치 | 없음 | |
| `6101b2b`가 아닌 베이스 | 없음 | |
| linked worktree | 없음 | |
| 네 검증 명령 누락 | 없음 | |
| 자가 심사 | 없음. 합성은 블라인드 심사 4건이다 | |
| 에이전트 토큰 아님 | **토큰.** Cursor가 usage를 내보내지 않아 네 런 모두 없음 | |
| CLI 사이클을 에이전트 비용으로 위장 | 안 함. wall_s는 구현 에이전트 세션 길이 | collect_s 6.20 / 6.16 / 6.03 / 6.46은 네 검증 명령 합이다. 1회차 off 벽시계와 맞춰 쓰지 않는다 |

1회차 `docs/benchmark/runs/` 수치는 덮어쓰지 않았다.

## 한계

- **n=4**, 셀당 반복 1회, 단일 모델(Grok 4.6). 1회차 off는 Sonnet. 1회차 off 대비 Δ에는 모델 효과가 섞인다.
- **on arm은 CLI 에뮬레이션.** PreToolUse `hooks/commit-safety.js`는 미실행.
- 심사자 4명은 각자 한 명이다. 패널 투표는 없다. 제품 diff만 봤고 계획 문서는 1회차 protocol과 같이 심사에서 뺐다.
- t2 verify 2회 실패는 테스트 픽스처가 `;`를 포함해 강화된 술어에 걸린 구현 중 회귀다. 게이트 코드 G18/S9/G4로 세지 않았다.
