# 실행 원본

각 `runs/<run-id>/`에 다음 파일을 둔다. 실패하거나 시간 제한에 걸린 실행도
디렉터리를 보존하고 `run.json`에 종료 사유를 기록한다.

```text
run.json                 실행 설정, 버전, 시작·종료 시각, 종료 사유
cursor.stdout.jsonl      Cursor CLI 원본 이벤트
cursor.stderr.log        CLI 오류와 진단 출력
tool-events.jsonl        정규화한 도구·승인·질문 이벤트
final-answer.txt         에이전트 최종 응답
diff.patch               최종 변경 전체
external-verifier.log    평가자가 실행한 검증 명령·종료 코드·출력
gate-results.json        Bouncer 게이트 결과; 해당하지 않으면 null
```

현재 Cursor 파일럿 실행기는 `run.json`, `prompt.txt`, Cursor stdout/stderr,
`final-answer.txt`, `diff.patch`, `verifier.json` 및 verifier stdout/stderr를
생성한다. `tool-events.jsonl`과 `gate-results.json`의 정규화는 아직 제공하지
않으며, 누락된 usage·비용도 `unknown` 또는 `unavailable`로 둔다.
각 run의 `cursor-projects/`에는 Cursor 로컬 파일이 보존될 수 있다.
원문이므로 이 디렉터리는 저장소에 커밋하지 않는다.

원본 JSONL을 정규화한 값으로 대체하지 않는다. 사용량·명령 이벤트가 빠지면
임의로 추정하지 않고 해당 필드를 `unknown` 또는 `unjudgeable`로 기록한다.

## 출처와 표본 자격

단계 이미지는 작업 트리에서 빌드되므로 `run.json`은 측정한 코드를 함께 기록한다.

- `bouncer_commit`: 실행 시작 시 저장소 HEAD
- `bouncer_dirty`, `bouncer_dirty_paths`: 커밋되지 않은 변경(추적되지 않는 파일 포함)과 그 경로
- `sample_eligibility`: `{ eligible, reasons }`. 집계에는 `eligible: true`인 run만 넣는다.
  이유 코드는 `dirty_source`, `unknown_source`, `usage_incomplete`, `not_graded`다.
  과제 성공 여부는 자격과 무관하다 — 실패한 과제도 유효한 표본이다.

