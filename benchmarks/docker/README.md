# Cursor CLI 실행 환경

`compose.cursor.yaml`은 같은 Cursor CLI 이미지 계열로 `vanilla`와 `bouncer`를
실행한다. `bouncer` 이미지에만 이 checkout의 Bouncer 플러그인 파일을 복사한다.
평가 전용 `verifier` 서비스에는 API 키와 네트워크가 없다.

## 실행

1. Cursor 대시보드에서 **Cursor API key**를 발급하고, 저장소 밖의 파일에
   저장한다. 키를 명령 인수·Compose YAML·Git 저장소에 적지 않는다.
2. 동일한 모델명을 두 조건에 사용한다. 각 호출은 새 기준 저장소를 만들며,
   기존 run ID를 덮어쓰지 않는다.

```sh
node benchmarks/run-cursor.cjs \
  --condition vanilla \
  --model '<Cursor CLI model name>' \
  --key-file /absolute/path/to/cursor-api-key

node benchmarks/run-cursor.cjs \
  --condition bouncer-full \
  --model '<same Cursor CLI model name>' \
  --key-file /absolute/path/to/cursor-api-key
```

`--task <task-id>`로 `tasks/<task-id>.yaml` 카드를 고른다(기본값 `ledger-001`).
`run-bouncer-full.cjs`도 같은 옵션을 받는다. `--run-id`와 `--timeout-minutes`를 지정할 수 있다. 키 없이 작업 공간과 프롬프트만
확인하려면 `--dry-run true`를 사용한다. Compose 이미지 빌드에는 인터넷 연결이
필요하며, Cursor CLI는 빌드 시 공식 설치 스크립트로 설치된다. 실행 기록의
`cursor_version`과 `image_id`를 비교해 버전이 달라진 실행을 합치지 않는다.

두 조건을 `cursor-grok-4.5-high` 모델로 연속 실행하려면 저장소 루트에서
`bash benchmarks/run-cursor-grok-4.5.sh`를 사용한다. 준비만 확인할 때는
`bash benchmarks/run-cursor-grok-4.5.sh --dry-run`을 사용한다.

## 자료 경계

- 에이전트: 새 `ledger-cli` 작업 공간(쓰기), 공통 PRD 프롬프트(읽기), API 키
  secret. Bouncer 조건에는 플러그인이 이미지 내부에 추가된다.
- 검증기: 최종 `diff.patch`, 기준 번들, 검증 코드·테스트 데이터. API 키가 없고
  `network_mode: none`이다.
- 호스트: `runs/<run-id>/`에 원본 Cursor JSONL, stderr, 최종 diff, 검증 결과를
  보관한다. 작업 공간은 무시되는 `.benchmarks/work/<run-id>/`에 남긴다.
  Cursor 로컬 대화 기록도 `cursor-projects/`에 보존한다. 원문이 포함되므로
  Git에 추가하지 않는다.

Cursor CLI는 `-p --force --output-format stream-json`으로 실행된다. Bouncer의
사용자 소유 승인까지 `--force`로 대신할 수는 없다. 승인 요청이 발생하면 그
run은 `awaiting_user_decision`으로 판정한다. `run.json`의 `usage`는 Cursor 결과
이벤트가 실제 토큰 수를 제공할 때만 `reported`로 기록한다. 제공하지 않으면
`unavailable`이고 비용도 `unknown`이다. 로컬 `agent-transcripts`에는 현재 확인한
형식상 토큰 필드가 없으므로 대화 길이로 토큰을 추정하지 않는다. `/bouncer-init`
실행 및 설정 파일 생성 여부도 남긴다.
이 활성화 표시는 전체 Bouncer 워크플로 완료의 증거가 아니므로, 유효 표본
집계 전에 게이트 증거를 확인한다.

## Print 모드 단계 실행 (bouncer-full 기본)

`run-bouncer-full.cjs`는 각 단계를 `run-print-stage.cjs`로 실행한다. Cursor ACP는
토큰 사용량을 어디에도 남기지 않으므로, 단계마다 컨테이너 하나를 띄워 두고 턴마다
`docker exec`로 `cursor-agent -p --output-format stream-json`을 실행한다. 두 번째 턴부터는
`--resume <chat-id>`로 같은 대화를 잇고, 채팅 저장소는 컨테이너 안에 남는다.
각 턴의 원본 스트림은 `cursor-turns/NN.jsonl`에 둔다. 텍스트 ACQ·퀴즈 응답은 ACP
단계와 같은 응답기를 쓴다.

- **사용량:** `cursor-logs/`에 마운트한 cursor-agent 세션 로그의 `agent_cli.turn.outcome`을
  요청 ID마다 한 번 합산해 `usage`로 기록한다. coordinator가 셸로 띄운 중첩
  `agent --print` 세션도 여기에 잡힌다. 턴별 CLI `result.usage` 합계는
  `usage_cli_result`로 함께 남긴다. Cursor Task subagent의 토큰은 두 경로 모두에 나오지
  않는다. 그래서 bouncer-full은 init에서 `subagents.dispatch: "print"` opt-in을 켠다.
  이 설정이 켜지면 Bouncer는 coordinator와 worker를 foreground `agent --print` 프로세스로
  띄운다(`rules/subagent-model.md` 7항). bootstrap 커밋 전에 이 설정이 없으면 run을 멈춘다.
- **사용량 완전성:** Task subagent도 `cursor-projects/`에 transcript는 남긴다.
  `usage_coverage`는 세션 로그에 turn이 없는 transcript(`unmetered_transcripts`)와 Task 도구
  호출 수(`task_calls`)를 기록한다. 둘 중 하나라도 있으면 그 단계의 `usage.status`는
  `incomplete`가 되고, run의 `usage_total_status`도 `incomplete`가 된다. 토큰 비교는
  `usage_total_status: reported`인 run만 쓴다.
- **셸 정책:** print 모드는 `--force`로 실행하므로, 이미지의 사용자 수준
  `beforeShellExecution` hook(`docker/shell-guard.cjs`)이 `shell-policy.cjs` 규칙으로
  외부 push·PR 생성·API 키 접근을 거부한다. 모든 판정은
  `cursor-projects/benchmark-shell-guard.jsonl`에 남고 `decisions.json`의 `shell_guard`로
  옮겨진다.
- **Task subagent 차단 (bouncer 이미지만):** 벤치마크의 Bouncer 설정은 `subagents.dispatch: print`이고
  `rules/cursor-print-dispatch.md`는 이때 Task subagent를 금지한다. Cursor는 Task subagent의 사용량을
  기록하지 않으므로, bouncer 이미지의 `preToolUse`(`Task`, `CallDynamicTool`로 부른 Task)와
  `subagentStart` hook(`docker/subagent-guard.cjs`)이 이를 거부하고 `agent --print` dispatch를
  안내한다. 판정은 `cursor-projects/benchmark-subagent-guard.jsonl`에 남고 `decisions.json`의
  `subagent_guard`, 단계 `run.json`의 `subagent_denied`, bouncer-full `run.json`의 단계별
  `subagent_denied`로 옮겨진다. 거부된 Task 호출은 subagent를 만들지 않으므로 `usage_coverage`의
  `denied_task_calls`로 빼고 계산한다. 규칙이 없는 vanilla 이미지에는 이 hook을 넣지 않는다.

## ACP 질문 응답 시험

`run-acp-stage.cjs`는 이미 준비된 작업 공간에서 Bouncer 단계를 하나 실행한다.
Cursor ACP의 구조화된 질문과 권한 요청을 `acp.jsonl`에 보존하고, 정책으로
확인된 질문만 답한다. 미해결 요청은 `decisions.json`에 기록하고
`awaiting_user_decision`으로 끝낸다. Cursor가 질문을 응답 메시지 텍스트로만
출력하는 경우도 같은 상태로 기록한다.
`cursor/task`, `cursor/update_todos`, `cursor/generate_image`는 Cursor 문서상 알림이므로
멈추지 않고 `decisions.json`의 `notifications`에 남긴다.
ACP의 `session/prompt` 응답에 `usage`가 있으면 `run.json`에 턴별로 기록한다.
`usage_update.used`는 컨텍스트 점유량이므로 누적 과금 토큰으로 합산하지 않는다.
각 단계의 `cursor-projects/`에는 Cursor가 생성한 로컬 파일이 보존된다.
실제 ACP 시험에서는 transcript JSONL이 생성되지 않았으므로, 이 경로에 파일이
없어도 정상이며 `acp.jsonl`을 원본 실행 기록으로 사용한다.

```sh
node benchmarks/run-acp-stage.cjs \
  --stage bouncer-init \
  --work-dir /absolute/path/to/prepared/workspace \
  --run-dir /absolute/path/to/new/results \
  --model cursor-grok-4.5-high \
  --key-file /absolute/path/to/cursor-api-key \
  --policy benchmarks/configs/ledger-001-evaluator-policy.json
```

정책은 사용자 승인 뒤 `approved`로 활성화됐다. ACP 응답기는 실제로 질문이
도착했을 때만 정책 조건을 검사해 답하고, 허용된 로컬 도구 요청에는 일회성
권한을 준다. 외부 push·PR 생성과 API 키 노출 요청은 거부한다. 질문이 텍스트로
출력되면 같은 ACP 세션에 선택지를 다시 보낸다. 여러 질문이 한 답변에 있으면
각각 검사한 뒤 순서대로 묶어 답한다. 지원하지 않는 질문은
`awaiting_user_decision`으로 기록한다.

응답기는 선택지 문구가 아니라 ACQ 형식(`rules/acq.md`)으로 판정한다. 먼저
질문 머리말과 `Re-ground` 줄로 게이트를 하나 정하고, 그 게이트의 증거 검사를
통과한 경우에만 답한다. 정책 답이 "진행"인 게이트는 첫 번째 자리에 하나뿐인
`(Recommended)` 선택지를 고르되, 그 선택지가 수정·취소·거절 성격이면 멈춘다.
Light scope처럼 정책 답이 추천과 다를 수 있는 게이트는 선택지 내용으로 고른다.
게이트가 정해졌는데 답하지 못하면 다른 게이트로 넘기지 않고 멈춘다. 결정
기록의 `basis`는 `recommended`, `content`, `label` 중 어떤 근거로 골랐는지를
나타낸다.

실행에서 답하지 못한 질문은 `decisions.json`의 `unanswered[].text`에 남는다.
이 원문을 `acp/fixtures/acq/`에 옮기고 기대 답을 `cases.json`에 추가하면
`node --test acp/responder.test.cjs`가 유료 실행 없이 재생해 검증한다.

정책 v2는 plan 승인 질문의 명시적인 승인 선택지를 자동으로 고른다. 별도 품질
선별은 하지 않으며 Bouncer plan 게이트의 판정과 제품 검증 결과를 기록한다.
finalize 퀴즈가 1~10문항, 문항별 3지선다로 제시되면 각 문항의 첫 선택지를
합성 답변으로 한꺼번에 보낸다. 문항이나 선택지를 해석할 수 없으면
`awaiting_user_decision`으로 종료한다. 퀴즈 점수는 워크플로 기록에만 사용하고
제품 정확도에 합산하지 않는다. 퀴즈 응답에 든 토큰과 비용은 전체 실행 비용에
포함한다. 단계별 `run.json`의 `evaluator_policy_version`과
`evaluator_policy_sha256`으로 정책이 다른 실행을 구별한다.

`run-bouncer-full.cjs`는 새 기준 저장소에서 init → 별도 bootstrap 커밋 →
plan → run → integration worktree의 finalize를 순서대로 실행한다. finalize가
worktree를 지우므로 integration 브랜치 ref에서 닫힌 blueprint와 통합 HEAD의
패치를 모은 뒤 외부 검증기를 호출한다. 이 실행기는
진행 중인 시험 단계이므로 `run.json`의 상태와 모든 게이트 증거를 확인한 뒤
완결된 표본으로 집계한다.

단계 컨테이너는 stdio로 실행기와 ACP를 주고받으므로 컨테이너만 `-d`로 띄울 수
없다. 대신 `--detach`를 주면 실행기가 새 세션의 백그라운드 프로세스로 분리되어
터미널을 닫아도 계속 진행한다. 부모는 결과 디렉터리와 PID를 출력하고 바로
끝나며, 단계 시작·종료와 최종 상태는 `runs/<run-id>/driver.log`에 남는다.

```sh
node benchmarks/run-bouncer-full.cjs --detach \
  --model cursor-grok-4.5-high \
  --key-file /absolute/path/to/cursor-api-key
tail -f benchmarks/runs/<run-id>/driver.log
# 진행 중인 단계의 현재 턴 스트림(stream-json)
tail -f "$(ls -t benchmarks/runs/<run-id>/*/cursor-turns/*.jsonl | head -1)"
```

print 모드의 단계 컨테이너는 `sleep infinity`로 떠 있고 턴은 `docker exec`로 실행하므로
`docker logs`에는 아무것도 나오지 않는다. 에이전트 출력은 위의 `cursor-turns/NN.jsonl`에
쌓이고, subagent를 print 프로세스로 띄운 경우 그 출력은 컨테이너 안에서 에이전트가 정한
파일에 쓰인다(`docker exec <container> ps -ww -o pid,etime,args`로 실행 중인 프로세스를 본다).

run이 끝나면 실행기는 `.benchmarks/work/<run-id>/`를 `.benchmarks/archive/<run-id>.tar.gz`로
압축하고, 목록과 내용이 원본과 같은지 확인한 뒤에만 원본을 지운다. init이 설치한 Graphify venv
(`.git/bouncer/venv`, run당 약 200MB)는 다시 만들 수 있어 제외한다. 결과는 `run.json`의
`workspace_archive`에 남고, 검증에 실패하면 원본을 그대로 둔다. 작업 디렉터리를 그대로 두려면
`run-bouncer-full.cjs`에 `--keep-workspace`, `run-cursor.cjs`에 `--keep-workspace true`를 준다.
복원은 `tar -xzf .benchmarks/archive/<run-id>.tar.gz -C .benchmarks/work`이며, worktree의 `.git`
링크는 컨테이너 경로를 가리키므로 호스트 git 호출에는 `GIT_DIR`을 지정한다.

중단할 때는 `kill -TERM -- -"$(cat benchmarks/runs/<run-id>/driver.pid)"`로 실행기
프로세스 그룹을 끝낸 뒤, 남은 `cursor-bench-print-*`(ACP 실행기는 `cursor-bench-acp-*`)
컨테이너를 `docker rm -f`로 지운다.

## 정확한 사용량 대조

현재 Cursor CLI/ACP 실행이 `usage` 필드를 보내지 않으면 로컬 transcript만으로는
입력·출력·캐시 토큰 수를 알 수 없다. 팀 관리자가 Cursor Admin API의
`POST /teams/filtered-usage-events` 응답을 **모든 페이지** 내려받아 JSON 파일로
저장하면, 다음 명령으로 `conversationId`와 실행기의 `session_id`를 매칭해
`run.json`의 `admin_api_usage`에 토큰과 실제 청구액(센트)을 기록할 수 있다.

```sh
node benchmarks/import-cursor-usage.cjs \
  --run-dir benchmarks/runs/<run-id> \
  --events /absolute/path/to/all-usage-event-pages.json
```

단일 페이지 응답은 JSON 객체로, 여러 페이지는 페이지 순서의 응답 객체 배열로
저장한다. Admin API 키는 일반 Cursor CLI API 키와 다르며 이 명령에는 필요 없다.
API 응답은 저장소 밖에 두고, `conversationId`가 없는 이벤트는 임의로 배분하지
않는다. 관리자 권한이나 해당 이벤트가 없으면 정확한 비용은 `unknown`으로 둔다.
관리자 키 파일이 준비되면 모든 기록된 세션의 기간을 자동으로 계산하고 페이지를
끝까지 조회해 대조할 수도 있다. 키 값이나 다른 팀원 이벤트는 출력·저장하지 않는다.

```sh
node benchmarks/fetch-cursor-admin-usage.cjs \
  --admin-key-file /absolute/path/to/cursor-admin-api-key \
  --runs-root benchmarks/runs
```

관리자 키가 없는 개인 계정에서는 이 조회를 실행할 수 없다. 일반 Cursor CLI
API 키는 Admin API 인증에 사용할 수 없다.
기존 CLI 실행의 `cursor.stdout.jsonl`에 `result.usage`가 남아 있다면 관리자 키 없이
해당 토큰 수만 복구할 수 있다. 비용은 이 로그에 없으므로 채우지 않는다.

```sh
node benchmarks/backfill-cursor-cli-usage.cjs --runs-root benchmarks/runs
```

`admin_api_usage.entrypoints`에는 `init`, `plan`, `run`, `finalize`의 세션별
입력·출력·캐시 토큰, 청구액, 실행 시간과 종료 상태가 기록된다. 중간에 멈춘
단계도 세션 ID가 있으면 집계한다. 여러 실행의 단계별 평균과 표본 수는 다음처럼
확인한다.

```sh
node benchmarks/aggregate/entrypoint-usage.cjs \
  benchmarks/runs/<first-run-id> benchmarks/runs/<second-run-id>
```

`run` 내부의 개별 `execute`·`commit` 호출은 같은 ACP 세션에 포함되어 현재
자료만으로 비용을 분리할 수 없다. 단계별 평균은 성공·중단 상태별 표본 수와
함께 해석한다.

Cursor CLI가 새 버전으로 자동 갱신될 수 있으므로 실험 전후의 버전이 동일한지
검토한다. Docker 이미지 빌드만으로 CLI 버전이 영구 고정되는 것은 아니다.
