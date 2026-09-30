# ledger-002 채점 루브릭 v1

대상 요청은 [월 예산 초과 확인 명령 PRD](../tasks/ledger-002.prd.md)이다. 이 루브릭은 실행 전에
고정하고 두 조건에 동일하게 적용한다. 평가자는 조건명, 사용 토큰, 실행 시간을 보지 않고
최종 diff를 기준 커밋 `934cb3433f649447372f46051d703a5388384b72`
(`fixtures/ledger-cli-v2.bundle`)의 새 checkout에 적용한 뒤 판정한다. 평가용 입력은
`ledger-002/` 아래에 있으며 에이전트 작업 환경에 두지 않는다.

## 판정 방식

`ledger-001` 루브릭의 판정 방식을 따른다. 세부 검사는 전부 맞으면 점수를 주고 아니면
0점이며, `outcome_success`는 100점일 때만 참이다. 오류 명령은 종료 코드 1, 비어 있지 않은
stderr, 빈 stdout을 요구한다. 오류 문구는 채점하지 않는다.

- **의미 판정(B1·B3·B4·B6):** 각 줄을 공백 기준 5개 필드로 읽어 분류별 값을 비교한다. 줄 순서와
  구분 문자는 보지 않는다. 종료 코드는 0 또는 2이면 되고, stderr는 비어 있어야 한다.
- **형식 판정(B2):** 1월 stdout이 탭 구분, 지정 순서(JavaScript 기본 문자열 비교)와 정확히 같다.
- **종료 코드 판정(X1·X2):** 의미 판정을 통과한 출력에 대해 종료 코드만 따로 본다.
- **오류 판정(V1–V5):** 1월 `budget`이 표를 출력할 때만 점수를 준다. 기준 코드도 `budget`을
  알 수 없는 명령으로 거부하므로, 기능 없이 오류 점수를 얻지 않게 하기 위해서다.

기준 커밋은 R1·R2만 통과해 **7점**이다.

## 평가용 입력

`entries.json`의 2026년 1월 항목: `food` 700+600(1월 2일·31일), `travel` 500, `rent` 90000,
`fun` 250, `Gifts` 300. 2월: `food` 400. 경계 밖: 2025-12-31 `food` 99999, 2026-03 `travel` 1000.

| 파일 | 내용 |
| --- | --- |
| `budgets.json` | `food` 1200, `travel` 1000, `rent` 90000, `books` 500 |
| `budgets-zero.json` | `fun` 0, `food` 5000 |
| `budgets-empty.json` | `{}` |
| `budgets-array.json`, `budgets-not-json.json` | 배열, 깨진 JSON |
| `budgets-negative.json`, `budgets-fraction.json`, `budgets-empty-key.json`, `budgets-string.json` | 음수, 소수, 빈 키, 문자열 값 |

기대 출력(열 사이 탭):

```text
1월, budgets.json (종료 코드 2)
Gifts	300	-	-	NO_BUDGET
books	0	500	500	OK
food	1300	1200	-100	OVER
fun	250	-	-	NO_BUDGET
rent	90000	90000	0	OK
travel	500	1000	500	OK

2월, budgets.json (종료 코드 0)
books	0	500	500	OK
food	400	1200	800	OK
rent	0	90000	90000	OK
travel	0	1000	1000	OK

1월, budgets-zero.json (종료 코드 2)
Gifts	300	-	-	NO_BUDGET
food	1300	5000	3700	OK
fun	250	0	-250	OVER
rent	90000	-	-	NO_BUDGET
travel	500	-	-	NO_BUDGET
```

## 기능 정확도: 100점

| ID | 점수 | 검사와 통과 조건 |
| --- | ---: | --- |
| B1 | 15 | 1월·`budgets.json` 결과의 의미가 기대 출력과 같다. 월 경계 밖 항목 제외, 지출 없는 예산 분류, 예산 없는 분류, 지출 = 예산(`OK`, 잔액 0)을 포함한다. |
| B2 | 10 | 1월·`budgets.json` stdout이 기대 출력과 정확히 같다 (`Gifts`가 소문자 분류보다 앞). |
| B3 | 10 | 2월·`budgets.json` 결과의 의미가 기대 출력과 같다 (지출 0인 예산 분류 세 개 포함). |
| B4 | 5 | 1월·`budgets-zero.json` 결과의 의미가 기대 출력과 같다 (예산 0 초과는 `OVER`). |
| B5 | 5 | `budgets-empty.json`, 2026-04: stdout이 비어 있고 종료 코드 0, stderr 비어 있음. |
| B6 | 5 | `budget --month 2026-02 --budgets … --file …`(옵션 순서 변경) 결과의 의미가 2월 기대 출력과 같다. |
| X1 | 10 | 1월·`budgets.json`과 1월·`budgets-zero.json`이 모두 종료 코드 2다. |
| X2 | 5 | 2월·`budgets.json`이 종료 코드 0이다. |
| V1 | 5 | `--month 2026-13`이 오류 명령 조건을 만족한다. |
| V2 | 5 | 배열 예산 파일과 깨진 JSON 예산 파일이 모두 오류 명령 조건을 만족한다. |
| V3 | 5 | 음수, 소수, 빈 키, 문자열 값 예산 파일이 모두 오류 명령 조건을 만족한다. |
| V4 | 5 | `--budgets`, `--file`, `--month` 중 하나씩 빠진 세 명령이 모두 오류 명령 조건을 만족한다. |
| V5 | 5 | 알 수 없는 옵션(`--extra x`)과 없는 예산 파일 경로가 모두 오류 명령 조건을 만족한다. |
| R1 | 4 | 저장소의 `data/entries.json`에 대한 `list`, `total`, `summary --month 2026-01` 출력이 기준 커밋과 같다. |
| R2 | 3 | `npm test`가 통과한다. |
| D1 | 3 | `docs/commands.md`에 `budget` 제목이 있고, `test/` 아래 JS 파일 중 하나가 `budget`을 언급한다. |

D1은 PRD가 요구한 문서·테스트 추가 여부만 자동 판정한다. 설명과 테스트의 질은 채점하지 않는다.

## 검증기 자체 검증

`verifiers/testdata/ledger-002/`의 patch로 확인한다. `ledger-002.test.cjs`가 매번 다시 확인한다.

| patch | 기대 점수 | 실패 검사 | 의미 |
| --- | ---: | --- | --- |
| (빈 patch, 기준 커밋) | 7 | R1·R2 외 전부 | 기능 없음 |
| `correct-exit-code-return` | 100 | — | 명령이 `{ lines, exitCode }`를 반환, 검증 모듈 분리 |
| `correct-process-exit-code` | 100 | — | 명령 안에서 `process.exitCode = 2`, 한 파일에 구현 |
| `wrong-locale-sort` | 90 | B2 | `localeCompare` 정렬 → `Gifts` 순서 틀림 |
| `wrong-exit-always-zero` | 90 | X1 | 초과가 있어도 종료 코드 0 |
| `wrong-budget-values-unchecked` | 95 | V3 | 예산 값 검증 누락 |
| `wrong-spent-only` | 45 | B1·B2·B3·B6·X1·X2 | 지출 있는 분류만 출력 |

## 별도 기록 항목

`ledger-001` 루브릭과 같다: 변경 범위(파일 목록, Bouncer 관리 파일은 자동 감점하지 않음),
보고 정확도(`accurate`·`inaccurate`·`unjudgeable`), 비용.
