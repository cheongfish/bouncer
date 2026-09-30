# `list --category`가 다른 분류까지 보여 주는 문제

`list --category food`로 조회하면 `food` 항목뿐 아니라 `foodtruck` 항목도 함께
나옵니다. 분류 필터는 이름이 정확히 같은 항목만 보여 줘야 합니다.

## 재현

다음 내용의 파일을 `entries.json`으로 저장하고:

```json
[
  { "id": "c1", "date": "2026-03-01", "category": "food", "amount_cents": 500 },
  { "id": "c2", "date": "2026-03-02", "category": "foodtruck", "amount_cents": 700 },
  { "id": "c3", "date": "2026-03-03", "category": "travel", "amount_cents": 300 }
]
```

실행합니다.

```sh
node src/cli.js list --file entries.json --category food
```

기대하는 stdout(열 사이는 탭 한 개):

```text
2026-03-01	food	500	c1
```

실제로는 `c2` 줄도 함께 출력됩니다.

## 요청

- 분류 필터는 이름이 정확히 같은 항목만 남깁니다. 대소문자를 구분합니다.
- 다른 명령과 옵션의 동작은 그대로 유지합니다.
- 이 문제를 다시 잡을 수 있는 테스트를 추가해 주세요.
- 수정이 끝나면 커밋까지 해 주세요.
