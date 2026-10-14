# plan-review

plan context review가 계획 결함을 관점 통합 전후로 똑같이 잡는지 재기 위한 fixture와 측정 절차다.
작은 계획(`001-small`, commit task 2개)과 큰 계획(`002-large`, commit task 4개)에 알려진 결함을 심는다.
이 폴더는 측정 입력만 만들고 측정은 실행하지 않는다. 결과는 사용자가 기록한다.

## fixture 만들기

```bash
mkdir /tmp/plan-review && node benchmarks/plan-review/setup.cjs /tmp/plan-review
```

성공하면 `{ ok, dir, blueprints: { small, large }, defects }` JSON 한 줄을 낸다. 비어 있지 않은 디렉터리는
파일을 쓰기 전에 exit 2로 거절한다. 두 blueprint는 `approved`, commit task는 `ready`, `context-review.md`는 `pending`이다.

## 심은 결함

| id | 결함 | 위치 | 잡는 주체 |
| --- | --- | --- | --- |
| D1 | Contract는 상태를 `context-review.md` frontmatter에 둔다고 하는데 task 브리프는 runtime `state.json`에 저장한다고 적음 | small·large | reviewer `cross_document` |
| D2 | Checklist가 수정하는 파일이 `affected_paths`에 없음 | small·large | reviewer. 변경 전 `scope`, 변경 후 `cross_document` |
| D3 | epic 성공 기준이 "리뷰 품질을 개선한다"처럼 판정할 수 없음 | epic | reviewer `success_criteria` |
| D4 | Touch에 `src/auth/session.ts`가 있는데 `review_risk: []` | small·large | plan gate `review-risk-missing` 경고 + reviewer |
| D5 | Touch Modify 경로 `src/missing.ts`가 저장소에 없음 | small·large | plan gate G25 |

D4·D5는 `setup.test.cjs`가 기계 단언으로 고정한다(plan gate 실패 코드는 `G25`와 pending context-review의 `G18`뿐,
경고에 `review-risk-missing`). D1–D3은 reviewer 판단이라 단언하지 않고 아래 절차로 측정한다.

## 측정 절차

변경 전과 변경 후를 각각 새 fixture 디렉터리에서 돌린다.

1. 변경 전: BP 003 merge 전 base의 plugin으로, 변경 후: merge된 plugin으로 같은 fixture를 만든다.
2. 각 blueprint에서 `/bouncer-plan` step 5(context review)를 실행한다. reviewer를 호출할 때마다
   `bouncer metrics start --kind context-review`로 시작하고 끝나면 `bouncer metrics end`로 닫는다.
3. `bouncer metrics summary`로 호출 수·토큰·시간을 읽는다. 기대 호출 수는 변경 후 small 1회(`combined`),
   large는 cluster별 `local` + `global`이다.
4. 산출된 `context-review.md` finding을 D1–D5와 대조한다. 대조는 결함 id 기준이다. 같은 결함을 변경 전에는
   legacy `scope`나 `korean_quality` 관점이, 변경 후에는 `combined`·`local`·`global` 호출이 잡아도 같은 결함으로 센다.
   - 유효 finding: D1–D5 중 하나를 가리키는 finding 수. 같은 결함을 가리키는 중복은 하나로 센다.
     D4·D5는 reviewer 대신 plan gate가 잡아도 잡은 것으로 센다(`bouncer validate --gate plan` 출력을 함께 본다).
   - 놓친 blocker/major: 어느 finding에도 대응되지 않은 결함 중 blocker 또는 major로 분류되어야 할 것의 수.
5. 결과를 [`../drive-serial-4/results.md`](../drive-serial-4/results.md)의 BP 003 표(호출 수·토큰·유효 finding·놓친 blocker/major)에 적는다.
   측정하지 못한 값은 `미측정`으로 두고 사유를 같은 문서 `미확인 사항`에 남긴다.
