# ledger-004 채점 루브릭 v1-draft

대상 요청은 [`-f` 짧은 옵션 PRD](../tasks/ledger-004.prd.md)이다. 이 루브릭은 실행 전에
고정하고 두 조건에 동일하게 적용한다. 평가자는 조건명, 사용 토큰, 실행 시간을 보지 않고
최종 diff를 기준 커밋 `934cb3433f649447372f46051d703a5388384b72`
(`fixtures/ledger-cli-v2.bundle`)의 새 checkout에 적용한 뒤 판정한다. 평가용 입력은
`ledger-004/entries.json`이며 에이전트 작업 환경에 두지 않는다.

## 판정 방식

`ledger-001` 루브릭의 판정 방식을 따른다. 세부 검사는 전부 맞으면 점수를 주고 아니면
0점이다. `outcome_success`는 100점일 때만 참이다. 정상 명령은 종료 코드 0, 빈 stderr,
지정한 stdout을 요구하고, 오류 명령은 종료 코드 1, 비어 있지 않은 stderr, 빈 stdout을
요구한다. 오류 문구는 채점하지 않는다.

E1–E3은 S1(`list -f`)이 통과할 때만 점수를 준다. 기준 코드도 `-f`를 알 수 없는 옵션으로
거부하므로, 기능 없이 오류 점수를 얻지 않게 하기 위해서다. 기준 커밋은 R1·R2만 통과해
**10점**이다.

## 기능 정확도: 100점

평가용 파일은 4개 항목이다: `e1` 2026-01 rent 50000, `e2` 2026-01 food 1234,
`e3` 2026-02 food 566, `e4` 2026-01 books 999 (입력 순서 그대로).

| ID | 점수 | 검사와 통과 조건 |
| --- | ---: | --- |
| S1 | 15 | `list -f <평가 파일>`이 네 항목을 입력 순서대로 `date\tcategory\tamount\tid`로 출력한다. |
| S2 | 10 | `total -f <평가 파일>`이 `52799`를 출력한다. |
| S3 | 15 | `summary -f <평가 파일> --month 2026-01`이 `books\t1\t999`, `food\t1\t1234`, `rent\t1\t50000`, `TOTAL\t3\t52233`을 출력한다. |
| S4 | 10 | `summary --month 2026-02 -f <평가 파일>`(`-f`가 뒤)이 `food\t1\t566`, `TOTAL\t1\t566`을 출력한다. |
| S5 | 10 | `list --category food -f <평가 파일>`이 `e2`, `e3` 두 줄만 출력한다. |
| E1 | 10 | `list -f`(값 없음)가 오류 명령 조건을 만족한다. |
| E2 | 10 | `list -f <평가 파일> --file <평가 파일>`이 오류 명령 조건을 만족한다 (같은 옵션 중복). |
| E3 | 5 | `summary --month 2026-01 -f`(마지막 값 없음)가 오류 명령 조건을 만족한다. |
| R1 | 5 | 저장소의 `data/entries.json`에 대한 `list --file`, `total --file`, `summary --file … --month 2026-01` 출력이 기준 커밋과 같다. |
| R2 | 5 | `npm test`가 통과한다. |
| D1 | 5 | `README.md`와 `docs/commands.md`가 모두 `-f`를 옵션 단어로 언급한다. |

S5는 `ledger-003`의 접두사 결함과 무관하도록 평가 파일에 접두사가 겹치는 분류를 두지 않는다.
D1은 문서에 반영했는지만 자동 판정한다. 설명의 질은 채점하지 않는다.

## 검증기 자체 검증

`verifiers/testdata/ledger-004/`의 patch로 확인한다. `ledger-004.test.cjs`가 매번 다시 확인한다.

| patch | 기대 점수 | 의미 |
| --- | ---: | --- |
| (빈 patch, 기준 커밋) | 10 | R1·R2만 통과 |
| `correct-parser-alias` | 100 | 옵션 파서에 별칭 지원 추가 |
| `correct-cli-normalize` | 100 | CLI 진입점에서 `-f`를 `--file`로 바꿈 |
| `wrong-list-only` | 65 | `list`만 지원 → S2·S3·S4 실패 |
| `wrong-duplicate-ignored` | 90 | `-f`와 `--file` 동시 사용을 허용 → E2 실패 |

## 별도 기록 항목

`ledger-001` 루브릭과 같다: 변경 범위(파일 목록, Bouncer 관리 파일은 자동 감점하지 않음),
보고 정확도(`accurate`·`inaccurate`·`unjudgeable`), 비용.
