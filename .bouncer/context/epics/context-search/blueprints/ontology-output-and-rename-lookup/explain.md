---
type: bouncer.explain
title: ontology-output-and-rename-lookup explain
description: Explain for ontology-output-and-rename-lookup
resource: .bouncer/context/epics/context-search/blueprints/ontology-output-and-rename-lookup/explain.md
tags:
  - bouncer
  - explain
timestamp: '2026-10-31T21:51:27.534+09:00'
bouncer:
  id: EXPLAIN-ontology-output-and-rename-lookup
  epic_id: context-search
  blueprint_id: ontology-output-and-rename-lookup
  status: published
  comprehension:
    - range_from: a6cc3c0f3d8cc8869fb4ddf761abee694df7454f
      range_to: 7cb650e83092f4cfba873866d18ced084639afd7
      diff_sha: 1b34948719e935c5867e57e734dc8e288798448b7eb1fbaae2e67e588b92364f
      recorded_at: '2026-10-31T21:52:18.127+09:00'
  task_commits:
    - task: context-search/ontology-output-and-rename-lookup/001
      sha: f2b177df
      intent_anchor: task-001
    - task: context-search/ontology-output-and-rename-lookup/002
      sha: f17a8fc1
      intent_anchor: task-002
    - task: context-search/ontology-output-and-rename-lookup/003
      sha: 7cb650e8
      intent_anchor: task-003
---
# Explain

## Background

`bouncer ontology` JSON을 파이프로 받으면 OS 파이프 버퍼(보통 65,536바이트)에서 잘려 `JSON.parse`가 실패했다. `packages/cli/bin/bouncer`가 `runCli` 직후 `process.exit`를 호출해 stdout 기록이 커널로 넘어가기 전에 프로세스가 끝났기 때문이다. 기본 응답의 `warnings`는 코어가 모은 항목 배열 그대로라 결과가 경고 본문에 묻혔다. `file`·`impact`는 색인의 현재 경로 키만 봐서, 문서를 옮긴 뒤 새 경로로 질의하면 옛 경로를 적은 blueprint가 빠졌다.

이번 변경은 세 가지를 고친다. 종료는 stdout·stderr drain 뒤에 같은 코드로 끝낸다. 기본 `warnings`는 `{total, by_code}` 요약이고 `--warnings detail`만 항목 배열을 붙인다. 현재 경로가 HEAD blob이면 `git log --follow`가 이은 과거 이름을 합쳐 조회하고, 질의 경로를 뺀 이름을 `aliases`로 돌려준다. 옛 이름으로 새 이름 쪽 blueprint를 찾는 반대 방향은 하지 않는다.

## Code

- `packages/cli/bin/bouncer` — `exitWhenFlushed`가 `writableNeedDrain`/`writableLength`로 drain을 기다린 뒤 `process.exit`한다. `onStdoutError`는 stdout `EPIPE`만 삼키고, 잡아 둔 `runCli` 코드를 유지한다. drain과 EPIPE가 둘 다 없으면 열린 핸들로 남을 수 있다.
- `packages/cli/src/cli-ontology-command.ts` — `summarizeWarnings`가 코어 배열을 접는다. `code` 문자열이 있는 항목만 센다. `--warnings` 기본은 `summary`, 값은 `summary` 또는 `detail`이다. `--limit` 의미는 그대로다.
- `packages/cli/src/cli-usage.ts`, `packages/cli/src/cli-project-commands.ts` — ontology usage에 `--warnings <summary|detail>`을 적는다. 두 파일 리터럴은 아직 두 벌이다.
- `packages/cli/src/context-ontology.ts` — `collectRenameNames`가 unborn HEAD이거나 `HEAD:path`가 blob이 아니면 입력 경로 한 키로 접는다. 그 외는 `--literal-pathspecs`와 `git log --follow -M -z`로 이름 집합을 만든다. `unionFileMatches`·`unionFileEvidence`가 그 합집합으로 조회한다. impact 확장은 시작 blueprint가 실제로 가진 토큰·파일만 탄다.
- `docs/context-ontology.md` — `--warnings`, `aliases`, 기본 경고 요약, rename 합집합과 반대 방향 거부를 적는다.
- `test/ontology-cli-contract.test.js`, `test/tiers.json` — 셸 파이프 완전성·EPIPE, 경고 요약, rename 합집합을 integration 테스트로 고정한다.

## Quiz

1. stdout이 OS 파이프일 때 `bouncer ontology` JSON이 65,536바이트에서 잘리지 않는 이유는?
   - A) `runCli`가 출력을 65,536바이트 단위로 나눠 쓴다
   - B) `exitWhenFlushed`가 stdout·stderr drain 뒤에만 `process.exit`를 호출한다
   - C) 파이프일 때 ontology가 파일로 리다이렉트한 뒤 그 파일을 다시 읽는다

2. `bouncer ontology` 기본 JSON의 `warnings` 형태는?
   - A) 코어 경고 항목 배열 그대로
   - B) `{ "total": <n>, "details": [...] }`만 있고 `by_code`는 없다
   - C) `{ "total": <n>, "by_code": { "<code>": <n> } }` 요약이고, 항목 배열은 `--warnings detail`일 때만 붙는다

3. `ontology file --file`에 현재 경로를 넣었을 때 과거 이름을 적은 blueprint가 나오는 조건은?
   - A) 현재 경로가 HEAD의 blob이고 `git log --follow`가 이은 이름을 합친다
   - B) 질의 문자열이 옛 경로여도 새 경로를 적은 blueprint를 찾는다
   - C) 색인을 재작성해 모든 과거 경로 키를 미리 넣어 둔다

4. 성공한 `ontology file` JSON에서 `aliases`는?
   - A) 질의 경로를 포함한 전체 이름 집합
   - B) 질의 경로를 제외한 과거 이름이며 사전순이다. `entity`와 이력이 없으면 빈 배열이다
   - C) `--warnings detail`일 때만 채워지는 경고 출처 목록이다

## Tasks

### context-search/ontology-output-and-rename-lookup/001 · `f2b177df`

#### Goal & intent

stdout이 OS 파이프일 때 `bouncer ontology` 출력이 65,536바이트에서 잘려 JSON이 깨지는 결함을 고친다. 수용 기준은 blueprint 수용 기준 1·2다: 65,536바이트를 넘는 출력이 파이프에서도 완전한 JSON 한 줄이고 파일로 받은 출력과 바이트가 같으며, 종료 코드와 stderr는 변하지 않는다. 검증 명령은 `node scripts/check-task.js test/ontology-cli-contract.test.js`다.

#### Current behavior

- 입력: `bouncer ontology file --file packages/cli/src/cli.ts --limit 100 --repo <checkout>`처럼 결과가 큰 질의를 stdout이 파이프인 채로 실행한다. 상태: `runCli`가 `process.stdout.write`로 한 번에 출력한 직후 `packages/cli/bin/bouncer`가 `process.exit(runCli(...))`로 프로세스를 끝낸다. 출력: 파이프에는 앞 65,536바이트만 도착한다.
- I/O 관찰 지점: 종료는 `packages/cli/bin/bouncer:26`의 `process.exit(runCli(process.argv.slice(2)))`, 출력은 `packages/cli/src/cli.ts:66`의 `process.stdout.write`다.
- 재현(관찰함, Node v22.19.0, Linux): 이 저장소에서 `node packages/cli/bin/bouncer ontology file --file packages/cli/src/cli.ts --limit 100 --repo "$PWD" | wc -c`는 65536, 같은 명령을 `> out.json`으로 리다이렉트하면 125065바이트다. `child_process.spawnSync`와 비동기 `spawn`의 stdio pipe는 이 결함을 재현하지 못한다(각각 126355바이트 전체 도착). 셸 파이프(`sh -c '… | cat'`)만 재현한다.
- 확인한 기존 테스트: ontology를 다루는 테스트는 없다(커밋 1027d1d3이 지움). `node scripts/check-task.js test/cli-help-static.test.js`는 통과한다.

#### Target behavior

- 성공: `packages/cli/bin/bouncer`가 `runCli`의 반환 코드를 보존하되 stdout·stderr에 쓴 내용이 모두 전달된 뒤 종료한다. 65,536바이트가 넘는 출력도 파이프에서 완전하다.
- 실패: 인자 오류(exit 2)와 I/O 오류(exit 1)의 종료 코드·stderr 내용은 그대로다. 실패 때 stdout은 비어 있다.
- 보존: stale build 검사의 stderr 메시지와 exit 1, dist 누락 메시지와 exit 1은 그대로다. 명령이 끝난 뒤 프로세스가 열린 핸들 때문에 멈추지 않는다. `ontology` 외 명령의 출력·종료 코드도 같다. `bouncer-root` 실행 파일은 바꾸지 않는다.

#### Interface

- 제공: `bouncer` 실행 파일은 종료 코드 N으로 끝날 때 그 전에 요청한 stdout·stderr 기록이 모두 전달됨을 보장한다. 새 공개 옵션이나 export는 없다.
- 거부: 없다. 종료 코드를 바꾸거나 출력 크기를 제한하지 않는다.
- throw와 fallback: `runCli`가 던진 예외의 처리(비정상 종료와 stderr 출력)는 변경 전과 같다.

#### Touch

| 경로 | 심볼 | 변경 | 현재 책임 | 계획한 변경 | 근거 |
| --- | --- | --- | --- | --- | --- |
| `packages/cli/bin/bouncer` | 마지막 줄의 `process.exit(runCli(...))` | Modify | `runCli` 반환 직후 프로세스를 즉시 끝냄 | stdout·stderr flush가 끝난 뒤 같은 코드로 끝나도록 바꿈 | `packages/cli/bin/bouncer:26`; 셸 파이프 재현에서 65536바이트로 잘림 |
| `test/ontology-cli-contract.test.js` | 파이프 출력 완전성 테스트와 fixture 저장소 생성 | Create | 없음 | 큰 ontology 질의를 셸 파이프로 받아 완전성을 단언 | blueprint 수용 기준 1·2; 소비자 조사: `rg ontology test`는 0건 |
| `test/tiers.json` | `integration` 목록 | Modify | 테스트 파일의 tier 배정 정본 | 새 테스트 파일명 추가 | `scripts/check-task.js`가 미등록 파일을 거절함; `scripts/test-tier.js`가 이 목록을 실행함 |

#### Constraints

- `CONTEXT-ONTOLOGY-ROADMAP.md`(`.git/info/exclude`에 등록된 미추적 문서)와 `BENCHMARK-REFORM-PROPOSAL.md`, `GRAPHIFY-WORKFLOW-PROPOSAL.md`는 건드리지도, 수정하지도, stage하지도 않는다. 커밋 방지를 위해 파일을 바꾸는 작업은 이 task에 없다.
- 타깃 이외 명령의 동작은 같아야 한다: 종료 코드와 출력 내용 불변. 종료 방식 변경으로 어느 명령도 멈추거나 코드가 달라지면 안 된다.
- 테스트는 실제 git 저장소와 자식 프로세스를 쓰므로 integration tier다(`unit`은 `test/helpers/no-spawn.js`가 막는다). 테스트 이름은 `<조건> → <결과>`다(`npm run lint:test-names`).
- EPIPE 정책: 출력을 받는 쪽이 일찍 닫혀도(예: `| head -c 1`) 종료 코드는 `runCli` 반환값 그대로(성공 질의면 0)이고 stderr에 스택 추적이나 `EPIPE` 오류를 남기지 않으며 멈추지 않는다. stdout의 `EPIPE` 오류만 삼키고 다른 오류는 숨기지 않는다.
- 셸 파이프 재현은 POSIX 전용이다. `process.platform === 'win32'`에서는 이 한 테스트를 사유와 함께 skip한다. 인자는 셸 문자열에 끼우지 않고 `"$0" "$@"` 위치 인자로 넘긴다.
- 생성본 `packages/cli/dist`와 `scripts/lib`는 gitignore 대상이다. 테스트를 돌리기 전에 `npm run build`를 먼저 실행하고, 생성본을 stage하거나 `affected_paths`에 넣지 않는다.

### context-search/ontology-output-and-rename-lookup/002 · `f17a8fc1`

#### Goal & intent

`bouncer ontology`의 기본 응답에서 `warnings`가 출력의 대부분(이 저장소에서 668건, 결과 배열은 약 1KB)을 차지하는 문제를 고친다. 기본은 코드별 개수 요약이고 항목 목록은 `--warnings detail`에서만 나온다. 수용 기준은 blueprint 수용 기준 3·4와 Contract 데이터·상태 셋째 항목(`results`, `total`, `truncated`, `--limit` 의미 불변)이다. 검증 명령은 `node scripts/check-task.js test/ontology-cli-contract.test.js`다.

#### Current behavior

- 입력: `bouncer ontology entity --entity G5 --repo "$PWD" --limit 1`. 상태: `queryContextOntology`가 중복 제거한 `warnings` 배열 전체를 응답에 넣고(`packages/cli/src/context-ontology.ts:377`), CLI는 그대로 `JSON.stringify`한다(`packages/cli/src/cli-ontology-command.ts:42`). 출력: 이 저장소에서 경고 668건이며 코드별로 `path-rejected` 541(unsafe/glob 401, layout 밖 140), `document-invalid` 79, `commit-unavailable` 48이다.
- 옵션 파서: `parse`는 `--entity|--file`, `--repo`, `--limit`만 받고 그 밖은 `unknown or inapplicable option` 오류(exit 2)다(`packages/cli/src/cli-ontology-command.ts:68`). 모든 옵션은 값을 하나 요구하고 중복을 거절한다.
- 재현(관찰함): `node packages/cli/bin/bouncer ontology entity --entity G5 --repo "$PWD" --limit 1`의 JSON에서 `warnings.length`가 668이다.
- 소비자 조사: `rg -n ontology docs skills agents references rules`에서 이 명령 출력을 읽는 곳은 `docs/context-ontology.md`뿐이다(`docs/context-ontology.md:15`가 `warnings` 필드를 설명). 도움말 문구는 `packages/cli/src/cli-usage.ts:21`과 `packages/cli/src/cli-project-commands.ts:621`에 같은 내용으로 두 번 있다.

#### Target behavior

- 성공(기본, `--warnings summary`): 응답은 `version, query, results, total, truncated, warnings`를 같은 순서로 담고, `warnings`는 `{ "total": <n>, "by_code": { "<code>": <n>, ... } }`다. `by_code` 키는 코드 사전순이며 개수 합이 `total`이다. 경고가 없으면 `{ "total": 0, "by_code": {} }`다. 경고 항목의 `source`·`line`·`detail`은 나오지 않는다.
- 성공(`--warnings detail`): `warnings`는 위 요약에 `details`를 더한다. `details`는 변경 전 응답의 `warnings` 배열과 항목·정렬이 같다(정렬은 코드, 출처, 줄, 설명 순)(`code, source, line, detail`).
- 실패: `--warnings`의 값이 `summary`·`detail`이 아니거나 값이 없거나 두 번 지정되면 exit 2, stderr는 `ontology: `로 시작하고 stdout은 비어 있다.
- 보존: `results`, `total`, `truncated`, `query`와 `--limit`(1..100, 기본 20) 검증은 변경 전과 같다. 코어 `queryContextOntology`의 반환값(전체 `warnings` 배열)은 바꾸지 않는다. 변환은 CLI 계층에서 한다. 이후 task가 추가하는 최상위 필드(`aliases`)는 변환 없이 통과해야 한다.

#### Interface

- 제공: `bouncer ontology <entity|file|impact> ... [--warnings <summary|detail>]`. 기본 `summary`. 응답 `warnings` 객체의 필드는 `total`(정수), `by_code`(코드→정수 객체), `details`(`detail`일 때만, 항목 `{code, source, line, detail}` 배열)다.
- 용어 정의: 경고 코드는 `Warning.code` 문자열이다(예: `path-rejected`). 요약의 개수는 코어가 중복 제거한 경고 항목 수 기준이다(예: 같은 `code, source, line, detail`은 1건).
- 거부 (throw 쪽, 즉시 오류): `--warnings`가 `summary`·`detail` 외 값(`--warnings bogus`)이면 `ontology: --warnings must be summary or detail`, 값 누락이면 기존 `--warnings requires a value`, 중복이면 기존 `--warnings may be specified only once`로 exit 2다. 기존 규칙대로 값이 `--`로 시작하면 값 누락으로 본다.
- fallback / miss: 경고 0건은 오류가 아니라 `{ total: 0, by_code: {} }`다.
- 도움말(`ontology --help`)은 `--warnings`를 보여준다.

#### Touch

| 경로 | 심볼 | 변경 | 현재 책임 | 계획한 변경 | 근거 |
| --- | --- | --- | --- | --- | --- |
| `packages/cli/src/cli-ontology-command.ts` | `parse`, `run`, `Parsed` | Modify | argv 검증과 코어 결과의 JSON 출력 | `--warnings` 파싱·검증, 응답 `warnings`를 요약(+details)으로 변환 | `packages/cli/src/cli-ontology-command.ts:42`(출력), `:68`(옵션 허용 검사) |
| `packages/cli/src/cli-usage.ts` | `COMMAND_USAGE.ontology` | Modify | `ontology --help` 정적 문구 | 세 모드 줄에 `[--warnings <summary\|detail>]` 추가 | `packages/cli/src/cli-usage.ts:21`; `ontology --help`가 이 문구를 그대로 출력함(`packages/cli/src/cli.ts`의 `out(COMMAND_USAGE[cmd])`) |
| `packages/cli/src/cli-project-commands.ts` | `ontology.usage` | Modify | 같은 usage 문구의 두 번째 사본 | `cli-usage.ts`와 같은 문구로 맞춤 | `packages/cli/src/cli-project-commands.ts:621`(중복 리터럴) |
| `docs/context-ontology.md` | 응답·경고 설명 단락, 사용 예 | Modify | 응답 필드와 `warnings` 의미 설명 | `--warnings` 옵션, 요약 객체 모양, `details` 설명 추가 | `docs/context-ontology.md:15`(`warnings` 설명), 전체 소비자 조사 결과 이 문서가 유일 |
| `test/ontology-cli-contract.test.js` | 경고 요약·detail·거절 테스트 | Modify | 파이프 출력 테스트(앞 task) | 경고 계약 테스트 추가 | blueprint 수용 기준 3·4와 Contract 데이터·상태 셋째 항목 |

#### Constraints

- `CONTEXT-ONTOLOGY-ROADMAP.md`(`.git/info/exclude`에 등록된 미추적 문서)와 `BENCHMARK-REFORM-PROPOSAL.md`, `GRAPHIFY-WORKFLOW-PROPOSAL.md`는 건드리지도, 수정하지도, stage하지도 않는다. 커밋 방지를 위해 파일을 바꾸는 작업은 이 task에 없다.
- `--limit`의 범위·기본값·`truncated` 의미는 바꾸지 않는다.
- 도움말 정적 문구는 모듈을 적재하지 않는 경로를 유지한다(`test/cli-help-static.test.js`의 `loaded` 단언). `cli-usage.ts`에 새 `require`를 추가하지 않는다.
- 기존 기대값의 변경 범위: 기존 테스트 파일의 어떤 단언도 바꾸지 않는다. 이 변경이 깨는 단언은 없다(ontology 단언은 1027d1d3에서 삭제됨). `test/cli-help-static.test.js`는 `COMMAND_USAGE`와 help 출력을 동적으로 비교하므로 문구 변경에 영향받지 않아야 한다.
- 문서 문구는 단언하지 않는다. `docs/context-ontology.md`는 `npm run lint:docs`(문서 구조 검사)만 통과하면 된다. 코드·옵션 이름은 영어 ASCII, 설명은 한국어다.
- 생성본 `packages/cli/dist`는 stage하지 않는다. 테스트 전에 `npm run build`를 실행한다.

### context-search/ontology-output-and-rename-lookup/003 · `7cb650e8`

#### Goal & intent

파일이 옮겨지거나 이름이 바뀐 뒤 현재 경로로 `bouncer ontology file|impact`를 질의하면, 과거 이름을 기록한 blueprint가 나오지 않는 결함을 고친다. 수용 기준은 blueprint 수용 기준 5·6이다: 현재 경로 질의가 과거 이름만 기록한 blueprint를 포함하고(여러 번 옮긴 이름도 이어짐), 이력이 없는 경로와 `entity` 질의는 변경 전과 같다. 검증 명령은 `node scripts/check-task.js test/ontology-cli-contract.test.js`다.

#### Current behavior

- 입력: 파일 질의 `packages/cli/src/cli.ts`. 상태: 색인의 `files` 맵은 문서가 기록한 문자열 그대로를 키로 쓰고, `queryContextOntology`는 `index.files.get(query.value)` 한 키만 조회한다(`packages/cli/src/context-ontology.ts:305`). impact의 시작 증거도 `index.fileEvidence.get(bp)?.get(query.value)` 한 키다(`packages/cli/src/context-ontology.ts:314`). 출력: 이 저장소에서 현재 경로 `packages/cli/src/cli.ts`는 blueprint 1건, 과거 경로 `scripts/src/lib/cli.ts`는 27건, `scripts/lib/cli.js`는 13건이다.
- rename은 Explain의 `task_commits` 커밋 하나 안에서만 `git diff-tree -M`으로 옛·새 이름을 함께 기록한다(`packages/cli/src/context-ontology.ts:623`). 서로 다른 시점의 rename은 연결되지 않는다.
- 재현(관찰함): `node packages/cli/bin/bouncer ontology file --file <경로> --repo "$PWD" --limit 100`의 `total`로 위 건수를 확인한다. `git log --follow --name-only -M -z --format= -- packages/cli/src/cli.ts`는 `packages/cli/src/cli.ts`, `scripts/src/lib/cli.ts`, `scripts/lib/cli.js`를 모두 돌려주며 약 50ms다.
- I/O 관찰 지점: git 호출은 `runGit`(`packages/cli/src/context-ontology.ts:758`) 한 곳이며 셸 없이 argv 배열로 실행한다. 쿼리 함수는 지금 git을 호출하지 않는다(`index.repoRoot`는 색인에 있다).
- 이 시점에 ontology 테스트는 앞 task가 만든 `test/ontology-cli-contract.test.js`뿐이다.

#### Target behavior

- 성공: `file`·`impact` 질의는 질의 경로 P의 이름 집합 N(P)를 `git log --follow`로 구해 N(P) 중 어느 이름이든 기록한 blueprint를 일치로 본다. `file`은 일치 blueprint 집합이 N(P) 각 이름의 `files.get(...)` 합집합이고 각 결과의 `evidence`는 N(P)에 속한 이름의 증거 합집합이다. `impact`의 시작 blueprint도 같은 합집합이며 시작 증거도 같은 규칙이다. 응답에 `aliases`(N(P)에서 P를 뺀 이름, 사전순)가 더해진다. `entity`는 `aliases: []`다.
- 실패: 이름 집합을 구하는 조건(아래 Interface 용어 정의)을 통과한 뒤 `git log`가 비정상 종료하면 코드 `ontology-io-failed`의 오류가 되어 CLI가 stderr `ontology: …`와 exit 1로 끝낸다. git을 시작하지 못하면 기존 `runGit`처럼 `ontology-io-failed`다.
- 보존: 이력이 없는 경로, 저장소에 없는 경로, 디렉터리, 커밋이 하나도 없는 저장소(unborn HEAD)의 질의, `:(exclude)x` 같은 pathspec 문법의 값은 오류 없이 exit 0, `aliases: []`이고 결과는 변경 전과 같다. `entity` 질의 결과, `total`·`truncated`·`--limit` 의미, `--warnings` 요약은 변경 전과 같다(`total`은 합집합 기준 전체 개수). 색인·캐시 파일을 쓰지 않는다. 질의 경로가 옛 이름일 때 새 이름 쪽 blueprint를 찾는 반대 방향은 하지 않는다.

#### Interface

- 제공: 응답 최상위 필드 `aliases: string[]`. 위치는 `truncated` 다음, `warnings` 바로 앞이다(앞 task의 CLI 변환은 알 수 없는 최상위 필드를 키 순서대로 통과시킨다). 코어 `queryContextOntology(index, query)`의 시그니처는 그대로이고 반환 객체에 `aliases`가 더해진다.
- 용어 정의: 이름 집합 N(P)는 다음 순서로 정한다. (1) `git rev-parse --verify --quiet HEAD`가 종료 코드 1이면(커밋 없음) N(P)={P}. 그 밖의 비정상 종료는 `ontology-io-failed`. (2) `git cat-file -t HEAD:P`가 실패하거나 결과가 `blob`이 아니면(HEAD에 없는 경로, 디렉터리, pathspec 문법 값) N(P)={P}. (3) 그 밖에는 `git --literal-pathspecs log --follow --name-only -M -z --format= -- P`가 출력한 저장소 상대 경로의 중복 제거 집합이다(P 자신 포함). `--literal-pathspecs`는 `log` 앞에 오는 git 전역 옵션이라 P를 magic 없는 리터럴 경로로 만든다. 모양은 NUL로 구분된 POSIX 상대 경로이고, 예는 P=`lib/new-name.ts`일 때 `{lib/new-name.ts, src/mid-name.ts, src/old-name.ts}`다. 출력의 빈 문자열은 버린다.
- 거부 (throw): 기존 `validateFileQuery`의 안전하지 않은 경로 거절은 그대로다(git 호출 전에 거절). 위 (1)·(2)의 miss 판정을 통과한 뒤 `git log`가 시작 후 비정상 종료하면 `ontology-io-failed`(`git log failed for <P>`).
- miss / fallback: 이력이 없거나, HEAD가 없거나(unborn), HEAD의 파일이 아닌(디렉터리·없는 경로·pathspec 문법) 경로는 N(P) = {P}이고 `aliases: []`, 결과는 P 한 키 조회와 같다. 예: `src`(디렉터리), `:(exclude)lib/new-name.ts`.
- 시험용 주입은 만들지 않는다. 테스트는 실제 git 저장소와 CLI 경계로 확인한다.

#### Touch

| 경로 | 심볼 | 변경 | 현재 책임 | 계획한 변경 | 근거 |
| --- | --- | --- | --- | --- | --- |
| `packages/cli/src/context-ontology.ts` | `queryContextOntology`, `runGit`(재사용), 신규 추출 지점: 질의 경로의 rename 이름 집합 계산 | Modify | 질의 경로 한 키로만 `files`·`fileEvidence`를 조회 | `file`·`impact`에서 이름 집합 N(P)로 합집합 조회, `aliases` 반환 | `packages/cli/src/context-ontology.ts:305`(일치), `:314`(impact 시작 증거), `:367`(결과 evidence), `:371`(응답 모양) |
| `docs/context-ontology.md` | 정확 일치 설명 단락 | Modify | 파일 질의가 저장소 상대 경로 정확 일치임을 설명 | rename 이력 추적과 `aliases` 설명 추가, 응답 필드 목록에 `aliases` 추가 | `docs/context-ontology.md:13`(질의는 정확히 일치한다), `docs/context-ontology.md:15`(응답 필드 목록 `version, …, truncated, warnings`; 앞 task가 `warnings` 설명을 바꾼 같은 단락) |
| `test/ontology-cli-contract.test.js` | rename 추적 테스트 | Modify | 파이프·경고 계약 테스트(앞 task) | rename 계약 테스트 추가 | blueprint 수용 기준 5·6 |

#### Constraints

- `CONTEXT-ONTOLOGY-ROADMAP.md`(`.git/info/exclude`에 등록된 미추적 문서)와 `BENCHMARK-REFORM-PROPOSAL.md`, `GRAPHIFY-WORKFLOW-PROPOSAL.md`는 건드리지도, 수정하지도, stage하지도 않는다. 커밋 방지를 위해 파일을 바꾸는 작업은 이 task에 없다.
- git은 `runGit`처럼 셸 없이 argv 배열로 호출한다. 질의 경로는 `--` 뒤에만 두고, `git log`에는 전역 옵션 `--literal-pathspecs`를 `log` 앞에 붙인다(환경 변수 `GIT_LITERAL_PATHSPECS=1`도 같은 효과). `git log --follow`는 pathspec이 정확히 하나여야 하므로 magic 값이 들어가면 git이 오류로 끝나는 것을 위 (2)의 blob 확인이 미리 막는다.
- 코어는 색인을 변경하지 않는다(`queryContextOntology`의 기존 계약). 이름 집합은 질의 호출 안에서만 계산하고 모듈 상태에 캐시하지 않는다.
- `--limit`의 의미는 그대로다. 합집합 정렬은 기존 `compare` 정렬을 쓴다.
- 문서 문구는 단언하지 않는다. `npm run lint:docs`만 통과하면 된다.
- 생성본 `packages/cli/dist`는 stage하지 않는다. 테스트 전에 `npm run build`를 실행한다.
- 이 task가 끝나도 `git` 이력이 얕은 clone이면 과거 이름이 일부만 나올 수 있다. 오류로 취급하지 않는다.

### context-search/ontology-output-and-rename-lookup/004

#### Goal & intent

앞 세 구현 task가 모두 통합된 뒤 `npm run ci`를 한 번 실행해 blueprint 수용 기준 1~6이 전체 검증과 함께 유지됨을 증적으로 남긴다. 구현 task는 각자 `node scripts/check-task.js test/ontology-cli-contract.test.js`만 실행했으므로 전체 테스트 스위트, 타입 검사, lint, 문서 구조 검사, `npm audit`는 이 task가 처음 실행한다.

#### Interface

- 제공: 구현 task가 모두 통합된 뒤 전체 검증 명령을 한 번 실행해 남기는 종단 검증 증적. 구현 task는 각자 task 전용 명령만 갖는다.
- 거부: source 변경, review 문서, commit.

#### Touch

Source 변경 경로 없음.

#### Constraints

- `CONTEXT-ONTOLOGY-ROADMAP.md`(`.git/info/exclude`에 등록된 미추적 문서)와 `BENCHMARK-REFORM-PROPOSAL.md`, `GRAPHIFY-WORKFLOW-PROPOSAL.md`는 건드리지도, 수정하지도, stage하지도 않는다. 커밋 방지를 위해 파일을 바꾸는 작업은 이 task에 없다.
- 이 task는 파일을 만들거나 바꾸지 않고 `npm run ci` 결과만 증적으로 남긴다.
