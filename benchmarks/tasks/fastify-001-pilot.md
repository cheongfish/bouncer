# fastify-001 파일럿 실행 계획

상태: 준비 완료 — 과제·검증기·스냅샷 빌더 검증 끝. **평가자 정책 승인 대기.** 실행 결과 없음.

## 1. 목적과 질문

ledger 과제(모듈 6개, 323줄)에서는 vanilla도 100점이라 Bouncer의 이득을 측정할 수 없었다. 1.5.4
bouncer-full은 같은 과제에서 vanilla보다 처리량(입력+캐시 읽기)을 약 70~100배 썼다. 이 파일럿은
`lib/` 8,222줄, 테스트 234개인 fastify의 실제 기능 커밋(#6521, 24개 파일)에서 다음을 확인한다.

1. 큰 코드베이스의 여러 면(`lib`·타입·문서·빌드 산출물)에 걸친 변경에서 두 조건의 점수가 갈리는가?
2. 갈린다면 Bouncer의 추가 비용(처리량, 시간) 대비 이득은 얼마인가?
3. bouncer-full이 큰 저장소에서 끝까지 도는가? 새로 멈추는 지점이 있는가?

## 2. 실행 매트릭스

| 조건 | 회수 | run ID | 실행기 | 모델 | 시간 제한 |
|---|---|---|---|---|---|
| vanilla | 3 | `up1-fastify-001-vanilla-{1,2,3}` | `run-cursor.cjs` | `cursor-grok-4.5-medium` | 60분 |
| bouncer-full | 3 | `up1-fastify-001-bouncer-full-{1,2,3}` | `run-bouncer-full.cjs` | `cursor-grok-4.5-medium` | 단계당 90분 |

- 모델과 이미지는 ledger 1.5.4 재측정(`v154-*`)과 같다.
- vanilla 3회를 먼저 돌린다. 짧고, 과제·검증기에 남은 문제를 싸게 드러낸다. 그다음 bouncer-full을
  차례로 돌린다.
- 같은 조건 안에서는 순차로 돌린다. 두 조건을 동시에 돌려도 컨테이너·포트는 분리되지만, 소요
  시간 비교가 흔들리므로 시간을 비교 지표로 쓰려면 순차로 한다.

## 3. 사전 준비 (실행 당일)

```sh
# 1) 코드: PR #168이 병합됐으면 develop, 아니면 feat/benchmark-upstream-tasks
git switch develop && git pull --ff-only
npm ci && npm run build

# 2) 생성물(스냅샷 bundle·숨은 테스트·node_modules·회귀 기준선). 네트워크·Docker 필요, 약 10분
node benchmarks/build-upstream-task.cjs fastify-001 --check-solution
```

2)의 출력이 다음과 같아야 한다. 다르면 실행하지 않고 원인부터 본다.

| 항목 | 기대값 |
|---|---|
| `snapshot` | `42fe25fd2a151def098ef6b59dee18ec8ccac632` (다르면 빌더가 멈춘다) |
| `baseline` | passing 184, failing 0 |
| `solution` | score 100 |
| `untouched` | score 31.1 (F1 11.1, R1 20) |

```sh
# 3) 평가자 정책 승인 — 사용자가 명시적으로 승인한 뒤에만 고친다(AGENTS.md 규칙 3).
#    benchmarks/configs/fastify-001-evaluator-policy.json
#      approval_state: "proposed" → "approved"
#      approved_by: null → "user"
#      approval_record 끝에 "; <날짜> conversation: 사용자 승인 — fastify-001 정책" 추가
#    proposed 상태에서는 run-bouncer-full.cjs가 시작을 거절한다.

# 4) 준비 상태 점검(키·비용 없음): 작업 공간·의존성 복사·프롬프트까지 확인하고 지운다
node benchmarks/run-cursor.cjs --task fastify-001 --condition vanilla --model cursor-grok-4.5-medium \
  --dry-run true --run-id up1-dryrun
ls .benchmarks/work/up1-dryrun/node_modules/.bin/borp   # 있어야 한다
rm -rf .benchmarks/work/up1-dryrun benchmarks/runs/up1-dryrun
```

API 키 파일: `/home/cheongwoon/.config/bouncer-benchmark/cursor-api-key` (권한 600, 내용은 출력하지 않는다).

## 4. 실행

```sh
K=/home/cheongwoon/.config/bouncer-benchmark/cursor-api-key
M=cursor-grok-4.5-medium

for n in 1 2 3; do
  node benchmarks/run-cursor.cjs --task fastify-001 --condition vanilla --model $M --key-file $K \
    --run-id up1-fastify-001-vanilla-$n --timeout-minutes 60
done

for n in 1 2 3; do
  node benchmarks/run-bouncer-full.cjs --task fastify-001 --model $M --key-file $K \
    --run-id up1-fastify-001-bouncer-full-$n --timeout-minutes 90
done
```

진행은 `benchmarks/runs/<run-id>/run.json`의 `status`와 bouncer-full 실행기 표준 오류의 단계 로그
(`01-init started` … `04-finalize started`)로 본다.

## 5. 멈췄을 때

| 증상 | 원인·처리 |
|---|---|
| bouncer-full `04-finalize stopped: awaiting_user_decision`, 질문이 `finalize.remainder` | **예상된 정지.** 1.5.4에 worktree 유지 선택지가 없다(f79ea8e2). 정책을 바꾸지 말고 `node benchmarks/score-archived-run.cjs <run-id>`로 아카이브에서 채점한다. 제품 변경은 remainder 커밋 전에 integration HEAD에 모두 있다 |
| 그 밖의 `awaiting_user_decision` | `<run>/<단계>/decisions.json`의 `unanswered[].text`를 본다. 새 질문 형식이면 응답기 버그인지 정책에 없는 결정인지 가린다. **정책에 없는 결정은 사용자 승인 없이 답하지 않는다.** 응답기 버그는 기록된 질문을 `benchmarks/acp/fixtures/acq/`에 회귀 테스트로 넣고 고친 뒤, 새 run ID(`…-<n>r`)로 다시 돌린다 |
| `integration incomplete` | `run.json`의 `error`에서 열린 task 상태를 본다. 원장은 integration worktree의 `.bouncer/runtime/coordinator.json`이다 |
| `provider error` | 같은 번호에 `r`을 붙여(`…-1r`) 다시 돌린다. 실패한 실행은 지우지 않는다 |
| vanilla `external verifier failed` | `<run>/verifier.stdout.json`의 `error`를 본다. 생성물이 없으면 3장 2)를 다시 한다 |
| 테스트가 `EADDRINUSE …:3000` | 호스트에서 직접 돌렸을 때만 생긴다. 실행·채점은 컨테이너 안이라 영향이 없다 |

실행이 중간에 멈춰도 완료된 단계의 토큰은 `run.json`에 남는다. 채점까지 못 간 실행은 회수에
넣지 않고 보충 실행을 한다.

## 6. 집계

```sh
# 실행별 점수·처리량·단계별 세션·도구 호출 분류
python3 benchmarks/aggregate/workflow-breakdown.py \
  up1-fastify-001-vanilla-1 up1-fastify-001-vanilla-2 up1-fastify-001-vanilla-3 \
  up1-fastify-001-bouncer-full-1 up1-fastify-001-bouncer-full-2 up1-fastify-001-bouncer-full-3

# 항목별 점수(F1 동작, F2 오류 코드, F3 설정, T1 타입, R1 회귀)
for r in benchmarks/runs/up1-fastify-001-*/verifier.json; do
  node -e "const v=require('./$r');console.log('$r'.split('/')[2], v.score,
    v.criteria.map(c=>c.id+'='+c.awarded).join(' '))"
done
```

결과 기록 양식:

| run | 점수 | F1 | F2 | F3 | T1 | R1 | 처리량(M) | 입력(k) | 소요(분) | 멈춘 곳 |
|---|---|---|---|---|---|---|---|---|---|---|
| vanilla-1 | | | | | | | | | | |
| vanilla-2 | | | | | | | | | | |
| vanilla-3 | | | | | | | | | | |
| bouncer-full-1 | | | | | | | | | | |
| bouncer-full-2 | | | | | | | | | | |
| bouncer-full-3 | | | | | | | | | | |

기준점: 상류 정답 100, 손대지 않은 스냅샷 31.1. 31.1을 넘는 만큼이 실제 구현이다.

## 7. 판정 기준

표본이 조건당 3회라 결과는 파일럿 판단이고 통계적 결론이 아니다.

| 결과 | 판단 | 다음 단계 |
|---|---|---|
| bouncer 평균 점수가 vanilla보다 10점 이상 높거나, 100점 회수가 2회 이상 많다 | 큰 코드베이스에서 이득이 있다 | undici B1 과제를 추가해 두 번째 저장소에서 확인하고, 토큰 절감 1단계(brief 해시, worker seed, CLI `--help`, PATH)를 진행한다 |
| 점수 차가 10점 미만이고 100점 회수가 같다 | 이득을 보이지 못했다 | B1 한 과제로 한 번 더 확인한 뒤 전체 사이클의 적용 범위를 줄일지 정한다 |
| bouncer가 낮다 | 이 과제 유형에서는 손해다 | 전체 사이클을 기본 경로로 두지 않는 쪽으로 정리한다. 경량 경로(단일 세션) 검토 |

비용은 판정과 별도로 기록한다. 조건별 평균 처리량, 처리량 비율(bouncer/vanilla), 소요 시간이다.
항목별(F1~R1)로 어느 면에서 갈렸는지도 적는다. 예를 들어 타입(T1)이나 설정 검증기 재생성(F3)처럼
여러 면을 맞추는 일에서 갈렸는지 본다.

## 8. 예상 비용과 시간

추정이다. 첫 실행 뒤 갱신한다.

| 조건 | 1회 처리량 | 1회 시간 | 3회 합계 시간 |
|---|---|---|---|
| vanilla | 0.5~3M | 5~20분 | ~1시간 |
| bouncer-full | 15~30M | 40~90분 | 2~4.5시간 |

ledger-004에서는 vanilla 약 0.1M·2분, bouncer-full 약 10M·30분이었다. 코드베이스가 25배 크고
변경이 24개 파일이라 양쪽 모두 늘어난다고 본다.

## 9. 알려진 위험

- **Bouncer worktree 의존성**: worker worktree(`.worktrees/…`)는 작업 공간 안에 있어 Node 모듈 해석이
  상위 `node_modules`를 찾는다. 사전 점검에서 확인했다. fastify는 `package-lock.json`을 커밋하지
  않아 Bouncer의 worktree `npm ci`는 돌지 않는다.
- **검증 명령**: plan이 권하는 검증 명령이 `npm test`(lint + unit + 타입)면 실행마다 수 분이 걸린다.
  응답기는 `package.json`에 있는 스크립트면 권장안을 받는다.
- **`init.gitignore`**: fastify에는 `.gitignore`가 있고 `node_modules/`가 들어 있다. Bouncer는 나머지
  4개를 마커 블록으로 덧붙이자고 묻고, 응답기는 이 경우를 답한다.
- **open decisions**: PRD가 공개 계약을 자세히 적어 질문이 적을 것으로 보지만, 나오면 정책대로 판단을
  위임하는 답을 한 줄 보낸다.
- **Graphify**: `bouncer init`이 fastify 그래프를 만든다(약 1~2분 추가).
- **숨은 테스트 1개 제외**: 내부 심볼(`lib/symbols`)을 읽는 `timer is cleaned up after fast response`는
  채점에서 뺐다. 타이머 누수는 채점하지 않는다.
- **알려진 Bouncer 결함**(`workflow-token-analysis` 분석): stale-worker-report로 implementer 재디스패치,
  worker seed 누락, run 단계의 finalize 침범, 위임 답변에서 승인을 추론. 이번 파일럿에서 다시 나오면
  run ID와 함께 기록한다.

## 10. 끝난 뒤

1. 6장 표를 이 문서 아래에 채우고 상태를 "결과 있음"으로 바꾼다.
2. 판정 기준(7장)에 따른 다음 단계를 정한다.
3. 실행 원본(`benchmarks/runs/up1-*`)은 커밋하지 않는다. 아카이브는 `.benchmarks/archive/`에 남는다.
