---
type: bouncer.blueprint
title: print dispatch 계약 빈칸 채우기
description: Lets plan, run, and init sessions finish Cursor print dispatch and subagents configuration from plugin documents and CLI output alone by adding the context-reviewer print role, a CLI-written coordinator input file, and a config help command.
resource: .bouncer/context/epics/088-drive-token-reduction/blueprints/006-print-dispatch-contract-gaps/index.md
tags:
  - bouncer
  - blueprint
  - print-dispatch
  - context-review
  - coordinator
  - config
timestamp: '2026-10-08T11:11:09.165+09:00'
bouncer:
  id: '006'
  epic_id: '088'
  blueprint_id: '006'
  status: closed
  commit_type: feat
  scale: full
  review_scope: blueprint
  supersedes: []
---
# print dispatch 계약 빈칸 채우기

Epic: [088](../../index.md)

## Intent
v088005 재측정에서 plan·run·init 세션은 context-reviewer print role, coordinator `--input` 형식, `subagents` 설정 키를 문서에서 찾지 못해 `scripts/`를 읽었고, plan은 자기 계획을 inline으로 검토했다. 이 blueprint는 그 세 빈칸을 CLI role·CLI가 쓰는 입력 파일·CLI 도움말로 채워 플러그인 소스 탐색 없이 끝나게 한다.

## Contract
- 인터페이스
  - `bouncer dispatch print --role context-reviewer`를 받는다. 식별 줄은 worker·reviewer와 같은 형식이고, 역할 본문은 `agents/bouncer-context-reviewer.md`, 모델은 `bouncer-context-reviewer` 슬롯이다. 읽기 전용 보호는 reviewer와 같다(식별 줄과 역할 본문의 hard guard). 코드 보호 장치를 새로 두지 않는다.
  - `skills/bouncer-plan/references/context-review.md`는 print opt-in일 때 호출마다 쓸 `dispatch print` 명령과 `--out` 규칙을 적는다. inline 검토는 dispatch 실패 때만 허용하고, `## Findings`에 `- inline context review: dispatch print failed (<reason>)` 한 줄을 남기게 한다.
  - `bouncer coordinate status --write-input <file>`는 기존 JSON 출력에 더해 coordinator `--input` 텍스트 파일을 쓴다. 담는 항목은 write cwd(`integrationPath`), blueprint, 원장 `base`, `checkpoint.ledger.{path,sha256,revision}`, `autonomy`(main checkout 설정), 읽기 전용 provenance(main worktree)다.
  - `bouncer config --help`·`-h`는 `subagents.provider`, `subagents.dispatch`, `subagents.<provider>.<agent>`의 허용값과 기본값을 출력한다. 값 목록은 코드 상수에서 만든다. CLI 출력이 원본이고 `docs/configuration.md` 표가 따라간다.
- 데이터·상태: 원장, `coordinate status`의 lib 반환값, `.bouncer/config.json` 형태, `context-review.md` frontmatter 스키마는 바뀌지 않는다. `--write-input`은 CLI 계층에서만 파일을 쓴다.
- 수용 기준: epic Success criteria 6, 23~26.
- 검증 명령: 각 task `bouncer.verify`(`npm test`). lint·typecheck·coverage를 포함한 `npm run ci`는 PR CI가 실행한다.
- 실패 모드·엣지 케이스
  - 목록에 없는 `--role`은 exit 2와 usage로 거절한다.
  - clustered context review는 print 프로세스를 여러 번 띄운다. prompt 파일 이름이 role마다 하나라서, 호출마다 다른 `--out`을 쓰지 않으면 앞 호출 산출물을 덮는다.
  - print dispatch가 `ok: false`를 돌려주면 inline 검토로 넘어가되 실패 사유를 기록한다. 기록 없이 inline으로 가는 경로는 문서에 남기지 않는다.
  - `--write-input`에 값이 없으면 exit 2와 usage. integration worktree가 아닌 cwd에서 부르면 기존 status와 같이 실패하고 파일을 쓰지 않는다.
  - `bouncer config`에 `--help`·`-h` 외 입력이 오면 exit 2와 usage를 stderr에 쓴다.

## Out of scope
- `coordinate next` 호출 수(INV-1)와 finalize 문서 로드(INV-2) 조사.
- ledger-004 재측정 실행, 벤치마크 과제 카드·rubric·verifier·평가자 정책, `dirty_source` 판정.
- `subagents` 값 검증 게이트, `init.ts` 기본 블록 재구성, `config.example.json` 갱신.
- `agents/*.md` 역할 문서와 생성 TOML, plan evidence dispatch의 print 경로.

## One-commit justification
- PR 하나로 리뷰하는 088 후속 묶음이고 task마다 한 커밋이 된다. TASKS-001은 context-reviewer role, TASKS-002는 coordinator 입력 파일, TASKS-003은 config 도움말을 맡는다. 001과 002는 `rules/cursor-print-dispatch.md`를, 세 task 모두 `rules/cli.md`와 CHANGELOG를 고치므로 `depends_on`이 001 → 002 → 003 순서를 고정한다.

## Documents
* [Tasks 001 — context-reviewer print role](tasks/001/tasks.md) - `print-dispatch.ts`·`cli-dispatch-command.ts`, plan context-review reference, 테스트
* [Tasks 002 — coordinator 입력 파일](tasks/002/tasks.md) - `coordinate status --write-input`, run 스킬 4단계, print dispatch 규칙 3항, 테스트
* [Tasks 003 — config 도움말](tasks/003/tasks.md) - `bouncer config --help`, `docs/configuration.md`, init 결과 안내, 테스트
* [Verification 001](tasks/001/verification.md) - 검증 명령과 증적
* [Verification 002](tasks/002/verification.md) - 검증 명령과 증적
* [Verification 003](tasks/003/verification.md) - 검증 명령과 증적
* [Review](review.md) - 리뷰 발견사항
* [Context review](context-review.md) - 계획 문서 정합성 판정
