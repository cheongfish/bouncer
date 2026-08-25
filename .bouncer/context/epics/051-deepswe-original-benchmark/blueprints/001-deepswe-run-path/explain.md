---
type: bouncer.explain
title: 001 explain
description: Explain for 001
resource: .bouncer/context/epics/051-deepswe-original-benchmark/blueprints/001-deepswe-run-path/explain.md
tags:
  - bouncer
  - explain
timestamp: '2026-08-25T21:12:18.485+09:00'
bouncer:
  id: EXPLAIN-001
  epic_id: '051'
  blueprint_id: '001'
  status: published
  comprehension:
    - range_from: develop
      range_to: 71f7098460f738221609236f7ff2c10d578a4986
      diff_sha: 3207833641058356438726986a52d11a68ea685615c793e7d0b351bfca396f53
      quiz_score: '3/4'
      disposition: >-
        러너·브리지·프로토콜의 계약과 이번 사이클의 git ls-files 함정은 짚었다.
        정리 경로를 두 군데 건 이유만 어긋났으므로, 다음 회차에 시그널 처리와
        finally의 실행 시점을 한 번 더 확인한다.
      recorded_at: '2026-08-25T21:16:16+09:00'
---
# Explain

## Background
DeepSWE 원본을 돌리려면 `deep-swe` 저장소가 있어야 한다. 그걸 이 저장소에
커밋할 수는 없고, 사용자 홈 어딘가에 풀어 두면 다음 회차가 어떤 상태의
클론을 쓴 것인지 알 수 없다. 돌린 뒤에도 문제가 남았다. Pier는 컨테이너
안에서 돌며 `reward.json`으로 통과 판정만 내고, 이 저장소의
`collect_metrics.py`는 diff와 커버리지 같은 measured 필드를 낸다. 둘이 다른
파일에 흩어져 있으면 런 하나를 한 장으로 볼 수 없고, `scorecard.py`에 넣을
입력도 없다. arm별 절차도 이 저장소 스위트를 전제로 적혀 있어 남의 저장소에는
그대로 쓸 수 없었다.

세 커밋이 그 셋을 각각 닫는다. 클론의 수명을 한 실행 안에 가두고, 두 판정을
JSON 한 장으로 합치고, 세 arm 절차를 원본 기준으로 다시 적는다.

## Intuition
러너는 빌려 온 작업장이다. 들어가서 일하고, 결과만 들고 나오고, 작업장은
반드시 허문다. 성공하든 실패하든 `Ctrl-C`로 끊기든 마찬가지다.

브리지는 그 위에 도장을 찍는다. Pier가 "통과"라고 말하고 이 저장소가 "이만큼
고쳤다"고 말하면, 브리지가 둘을 같은 종이에 올려 `scorecard.py`가 고쳐지지
않은 채로 채점하게 한다.

## Code
- `skills/agentic-code-benchmark/scripts/run_deepswe.py` — 선행 조건 확인 →
  결과 경로 충돌 확인 → 작업 경로 생성 → 클론 → `pier run` → 패치 얹은 사본
  → `collect_metrics.py` → 산출물 이동 → 제거. 제거는 `try/finally`와
  SIGINT·SIGTERM 핸들러 양쪽에 걸려 있고, 지울 경로는 인자 문자열이 아니라
  `.benchmarks/deepswe/<run-id>` 절대 경로로 다시 계산해 부모를 검사한 뒤
  지운다. 산출물·패치 탐색은 `walk_outputs(root, skip)`로 클론 서브트리를
  가지치기한다 — 스위트가 실어 온 `reward.json`이나 gold 패치를 이 런의
  것으로 오인하지 않기 위해서다.
- `skills/agentic-code-benchmark/scripts/bridge_pier.py` — metrics JSON의 모든
  키를 그대로 두고 `verdict`만 더한다. `schema`는 올리지 않는다. `pick()`의
  중첩 탐색은 태스크 id에만 열려 있다. id는 잘못 집어도 불일치 거부가
  받아 주지만, 보상과 통과 플래그는 잘못 집으면 그대로 지어낸 판정이 되기
  때문이다.
- `docs/benchmark/deepswe/protocol.md` — 세 arm의 통제와 절차. 러너가
  `pier run --agent`로 직접 몰 수 있는 것은 vanilla뿐이고 나머지 둘은 문서의
  절차로 선다는 비대칭을 숨기지 않고 적는다.
- `test/public-name-regression.test.js` — 비교 arm 이름 스캔. `git ls-files`로
  대상을 뽑는다는 점이 이번 사이클의 핵심 함정이다.

## Quiz
1. 러너가 작업 경로를 지우는 코드를 `try/finally`에만 걸지 않고 SIGINT·SIGTERM
   핸들러에도 건 이유는?
   - (a) `finally`는 예외가 났을 때만 돌기 때문에
   - (b) SIGTERM 기본 처리는 프로세스를 그대로 죽여 `finally`가 돌지 않기 때문에
   - (c) 시그널 핸들러가 `finally`보다 먼저 돌아 정리가 두 번 되기 때문에

2. TASKS-001의 execute 게이트가 `npm run ci`를 exit 0으로 기록했는데, 그
   커밋 직후 같은 명령이 실패했다. 왜인가?
   - (a) 게이트가 `npm test`를 돌렸고 `npm run ci`는 돌리지 않았기 때문에
   - (b) 리뷰 왕복에서 더한 테스트가 뒤늦게 깨졌기 때문에
   - (c) 이름 스캔이 `git ls-files`로 대상을 뽑는데 그때 러너가 untracked였기 때문에

3. `bridge_pier.py`가 `--metrics`의 `task_id`가 `null`이면 거부하는 이유는?
   - (a) `collect_metrics.py`는 `--task-id`를 주지 않으면 그 자리에 `null`을
     넣으므로, 통과시키면 두 런의 조각이 붙는 것을 막는 대조가 무력해져서
   - (b) `scorecard.py`가 `task_id`를 가중치 계산에 쓰기 때문에
   - (c) `verdict` 블록의 모든 키가 필수라 하나라도 비면 스키마가 깨져서

4. 003의 스모크가 `pier` 부재로 실패했는데도 이 태스크가 실패로 판정되지
   않은 이유는?
   - (a) 스모크는 선택 항목이라 시도 자체가 필수가 아니어서
   - (b) 브리프가 "합성한 결과 JSON을 결과 디렉터리에 두는 것만이 실패"라고
     정해 두었고, 실패한 명령줄과 사유를 그대로 적었기 때문에
   - (c) `pier`는 선행 조건이 아니라 선택 의존성이라서

## 이해 상태
4문항 중 3문항 정답 (`3/4`). 범위는 `develop..71f7098`.

- Q1 정답 (b) — 응답 (a), **오답**. `finally`는 예외가 났을 때만이 아니라 정상
  종료에서도 돈다. 핸들러가 필요한 쪽은 SIGTERM이다. 기본 처리가 프로세스를
  그대로 죽여 `finally`에 닿지 못하기 때문이다. 실제로 리뷰가 이 지점을
  짚었다 — 처음 붙인 SIGINT 테스트는 핸들러를 지워도 통과해서
  `try/finally`만 고정하고 있었고, 종료 코드를 `128+signal`로 단언하고
  SIGTERM 케이스를 더한 뒤에야 핸들러를 고정하게 됐다.
- Q2 정답 (c) — 응답 (c), 정답. 이번 사이클이 한 번 멈춘 원인이다.
- Q3 정답 (a) — 응답 (a), 정답.
- Q4 정답 (b) — 응답 (b), 정답.

Disposition: 세 커밋의 계약과 `git ls-files` 함정은 짚었다. 정리 경로를 두
군데 건 이유만 어긋났으므로, 다음 회차에 시그널 처리와 `finally`의 실행 시점을
한 번 더 확인한다.

## 다음 회차로 넘기는 것
- 표본 런(`--n-tasks 10`)은 `metrics.json`을 내지 않는다. `metrics.json`과
  `--task-id`가 단수라 태스크별 measured 필드를 담을 이름이 없다. 10개 전수
  실행을 맡는 다음 에픽이 그 이름과 스키마를 정한다.
- `run_deepswe.py`의 docstring이 050의 `docs/benchmark/protocol.md`를 가리키는데
  실제 원본 절차는 `docs/benchmark/deepswe/protocol.md`에 있다. 002·003 모두
  러너를 Do not touch로 두어 이번에는 고칠 수 없었다.
- `sample.md`의 `--n-tasks 10` 명령줄에 measured 한계 단서가 없다. 그 문서는
  열린 task의 `affected_paths` 밖이었다.
- 스모크는 `pier` 부재로 서지 못했다. 배관은 아직 실제로 증명되지 않았다.
