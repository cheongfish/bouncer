# 월별 지출 요약 명령

## 배경

이 저장소의 Ledger CLI는 JSON 지출 내역을 `list`로 보여 주거나 `total`로
전체 금액을 합산할 수 있습니다. 월별 지출을 분류별로 확인할 수 있도록
`summary` 명령을 추가해 주세요. 금액 단위는 기존 데이터와 같은 정수 센트입니다.

## 요구사항

- `node src/cli.js summary --file <path> --month <YYYY-MM>` 형식으로 실행합니다.
  `--file`과 `--month` 옵션의 순서는 어느 쪽이 먼저여도 됩니다.
- 지정한 월의 항목만 집계합니다. 각 분류마다 항목 수와 금액 합계를 한 줄로
  출력하고, 분류명 오름차순으로 정렬합니다. 각 줄의 형식은
  `<category>\t<count>\t<amount_cents>`입니다.
- 마지막 줄에는 `TOTAL\t<count>\t<amount_cents>` 형식으로 해당 월 전체의
  항목 수와 금액 합계를 출력합니다. 해당 월에 항목이 없어도 `TOTAL\t0\t0`을
  출력합니다.
- `--month`는 실제 달을 뜻하는 `YYYY-MM` 형식이어야 합니다. 예를 들어
  `2026-01`은 유효하고 `2026-00`, `2026-13`, `2026-1`은 유효하지 않습니다.
  잘못된 옵션, 누락된 값, 유효하지 않은 월은 오류 메시지를 stderr에 출력하고
  종료 코드 1로 끝내며, stdout에는 부분 결과를 남기지 않습니다.
- 기존 `list`와 `total` 명령의 입력·출력 동작을 유지합니다.

## 사용 예

저장소에 포함된 `data/entries.json`에 대해 다음 명령을 실행하면:

```sh
node src/cli.js summary --file data/entries.json --month 2026-01
```

stdout은 다음과 같습니다. 열 사이에는 탭 한 개가 들어갑니다.

```text
food	1	1200
travel	1	800
TOTAL	2	2000
```
