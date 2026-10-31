---
type: bouncer.blueprint
title: ontology 출력 절단·경고 요약·rename 추적 수정
description: Fixes truncated piped output, replaces default warning dumps with a count summary, and follows git renames in bouncer ontology file lookups.
resource: .bouncer/context/epics/context-search/blueprints/ontology-output-and-rename-lookup/index.md
tags:
  - bouncer
  - blueprint
  - ontology
  - cli
  - warnings
  - git-rename
timestamp: '2026-10-31T20:53:49.506+09:00'
bouncer:
  id: ontology-output-and-rename-lookup
  epic_id: context-search
  blueprint_id: ontology-output-and-rename-lookup
  status: closed
  order: 43
  commit_type: fix
  scale: full
  complexity: standard
  review_scope: blueprint
  verification_policy: scoped_terminal
  review_contract: brief
  area: ontology
  attribution: ontology 조회 출력·경고·rename 추적 수정이 성공 기준의 중심이라 context-search 영역에 귀속
  supersedes: []
---
# ontology-output-and-rename-lookup

Epic: [context-search](../../index.md)

## Intent
파이프로 받은 `bouncer ontology` 출력이 잘리지 않고, 기본 출력은 경고 개수 요약만 담도록 함.
경로가 옮겨진 뒤에도 현재 경로로 질의하면 과거 이름을 기록한 blueprint가 함께 나오도록 함.

## Contract
- 근거 요구사항: 사용자 확정 범위 1(`bouncer ontology`의 세 결함만 대상, `--limit` 절단 동작은 문제가 아님)과 3(새 CLI 계약 테스트로 검증).
- 인터페이스:
  - 결함 1: stdout이 파이프일 때 `bouncer` 실행 파일은 stdout·stderr 기록이 끝난 뒤에만 `runCli`의 종료 코드로 끝난다. 재현은 `bouncer ontology file --file packages/cli/src/cli.ts --limit 100 | wc -c`가 125065가 아니라 65536을 내는 것이다.
  - 결함 2: `--warnings summary|detail` 옵션을 `entity`·`file`·`impact`가 받는다. 기본은 `summary`. 다른 값, 중복 지정, 값 누락은 exit 2다.
  - 결함 3: `file`·`impact`는 질의 경로의 과거 이름도 같은 파일로 보고 일치시킨다. 응답에 `aliases`(과거 이름, 정렬, 질의 값 제외)가 추가된다.
- 데이터·상태:
  - 응답 `warnings`는 `{ total, by_code }` 객체가 된다. `total`은 중복 제거 뒤 경고 수, `by_code`는 코드별 개수다. `detail`에서만 `details`(현재 `warnings` 배열과 같은 항목·정렬)가 더해진다. 이 변경은 `warnings`의 타입을 배열에서 객체로 바꾸므로 공개 출력 계약 변경이다.
  - `aliases`는 `entity` 질의에서 `[]`다. 이름 이력은 질의 때 `git log --follow`로 읽으며 색인·캐시 파일을 만들지 않는다.
  - 응답 `version`은 1로 둔다. `warnings`의 타입 변경과 `aliases` 추가는 소비자가 `docs/context-ontology.md`뿐인 읽기 전용 출력의 변경이며, 호환 판정을 `version`으로 하는 소비자가 이 저장소에 없다. CHANGELOG 기록은 이 계획에 넣지 않고 릴리스 시점에 따로 작성한다.
  - `results`, `total`, `truncated`, `--limit`의 의미와 범위(1..100, 기본 20)는 바꾸지 않는다.
- 수용 기준:
  1. 출력이 65,536바이트를 넘어도 파이프로 받은 stdout이 완전한 JSON 한 줄이고, 파일로 받은 출력과 바이트가 같다.
  2. 출력 형식과 무관하게 종료 코드(0/1/2)와 stderr 내용은 바뀌지 않는다.
  3. 기본 출력의 `warnings`는 개수 요약뿐이고 경고 항목 본문을 담지 않는다.
  4. `--warnings detail`의 `details`는 기존 `warnings` 배열과 항목·순서가 같다.
  5. 파일을 옮기기 전 이름만 기록한 blueprint가 현재 경로 질의(`file`·`impact`)에서 나오고, 여러 번 옮긴 이름도 이어진다.
  6. 이름 이력이 없는 경로와 `entity` 질의의 결과는 변경 전과 같다.
- 검증 명령: 구현 task는 각자 `node scripts/check-task.js test/ontology-cli-contract.test.js`, 종단 task는 `npm run ci`.
- 실패 모드·엣지 케이스:
  - 이름 집합은 HEAD가 있고 질의 경로가 HEAD의 파일(blob)일 때만 `git log --follow`로 구한다. 커밋이 없는 저장소(unborn HEAD), 저장소에 없는 경로, 디렉터리, `:(exclude)x` 같은 pathspec 문법의 값은 오류가 아니라 `aliases: []`이고 exit 0이다. 질의 값은 pathspec이 아니라 리터럴 경로로 다룬다.
  - 위 조건을 통과한 뒤 `git log`가 비정상 종료하면 `ontology-io-failed`(exit 1)다.
  - 출력을 받는 쪽이 일찍 닫혀도(EPIPE) 종료 코드는 `runCli` 반환값 그대로이고 stderr에 스택이나 오류를 남기지 않는다.

## Out of scope
- `--limit` 절단과 `truncated` 동작 변경
- `hooks/subagent-model.js`의 `hookEventName` 누락(별도 계획)
- 질의 경로가 옛 이름일 때 새 이름을 기록한 blueprint를 찾는 반대 방향 추적
- `bouncer-root`의 종료 방식 변경
- 리뷰를 마친 문서(`CONTEXT-ONTOLOGY-ROADMAP.md`)의 커밋 방지. 세 결함 수정은 위 Contract의 파일을 바꾸지만, 커밋 방지에 관한 파일 변경은 이 계획에 없다. 이 문서는 이미 `.git/info/exclude`에 있으며 해당 문서와 `BENCHMARK-REFORM-PROPOSAL.md`, `GRAPHIFY-WORKFLOW-PROPOSAL.md`를 건드리거나 stage하지 않는다.
- `docs/reviews`, 각 `review.md`, `.gitignore`의 변경과 `git rm`

## One-commit justification
- 세 결함은 모두 `bouncer ontology` 한 명령의 출력 계약에 속하고, 한 계약 테스트 파일과 사용 문서 한 곳이 이를 함께 검증한다. 결함마다 task를 나누되 같은 테스트 파일·문서·`queryContextOntology`를 공유하므로 한 blueprint(한 PR)로 묶는다.
