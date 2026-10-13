# 직렬 4-task 드라이브 측정

같은 직렬 4-task 계획을 세 방식으로 실행해 `bouncer metrics summary`를 비교하는 fixture다.
계획 문서는 세 모드에서 같고 `.bouncer/config.json`만 다르다. 측정 결과는 [`results.md`](results.md)에 기록한다.

| 모드 | `.bouncer/config.json` | 실행 방식 |
| --- | --- | --- |
| `baseline` | `coordinator.waves_per_session: 1` | wave마다 coordinator를 새로 기동한다(기존 동작). |
| `auto` | `coordinator.waves_per_session: "auto"` | 직렬·무예외 wave를 같은 coordinator 세션에서 잇는다(상한 4). |
| `direct` | `auto`에 `coordinator.direct_max_commit_tasks: 4` | coordinator 없이 root가 직접 실행한다. |

## fixture 만들기

모드마다 빈 디렉터리를 하나씩 준비한다.

```bash
node benchmarks/drive-serial-4/setup.cjs <빈 디렉터리> --mode <baseline|auto|direct>
```

디렉터리에 git 저장소와 첫 커밋, `package.json`(`"test": "node --test"`), approved epic 하나와
approved blueprint 하나(commit task 4개 `TASKS-001`→`004`와 verification 노드 `TASKS-005`), 그 blueprint를 가리키는
포인터가 만들어진다. 성공하면 `{"blueprintDir": ...}`를 한 줄로 출력한다. 대상이 없거나 비어 있지 않거나
`--mode`가 세 값 밖이면 아무것도 쓰지 않고 exit 2로 끝난다.

## 실행 절차

각 fixture 디렉터리에서 Claude Code를 열고 같은 절차를 반복한다.

1. `/bouncer-run`을 실행한다.
2. 시작 ACQ에서 모드에 맞는 선택지를 고른다.
   - `baseline`·`auto`: coordinator 드라이브를 고른다.
   - `direct`: "직접 실행(coordinator 없음)"을 고른다. 이 선택지는 `direct_eligible`이 true일 때만 보인다.
3. 드라이브가 끝나면 아래 명령으로 계측 요약을 수집한다.

   ```bash
   bouncer metrics summary --blueprint .bouncer/context/epics/001-drive-serial/blueprints/001-serial-four
   ```

모드 사이에 모델·호스트 설정을 바꾸지 않는다. 한 모드를 여러 번 돌리면 실행마다 따로 기록한다.

## 기록 방법

[`results.md`](results.md) 표에 모드별로 다음을 적는다.

- 총 토큰, coordinator 기동 수, root-direct 세션 수: `bouncer metrics summary` 출력.
- 벽시계 시간: 시작 ACQ 응답부터 드라이브 종료까지 직접 잰 값.
- root 컨텍스트 증가: 호스트가 보여 주는 root 세션의 컨텍스트 사용량 차이.
- 판단 결과 동일성: 세 모드가 같은 task를 같은 판단(accepted 등)으로 끝냈는지.

호스트가 토큰이나 시간을 주지 않아 측정하지 못한 칸은 `미측정`으로 두지 않고 사유와 함께 `미확인`으로 적는다.
`waves_per_session` 상한 4와 `direct_max_commit_tasks` 3은 이 측정 전의 잠정값이다. 측정 뒤 바꾸면 같은 문서에 근거를 적는다.
