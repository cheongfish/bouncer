---
type: bouncer.tasks
title: 공개 표면과 하위 호환 정책 문서
description: Tasks for 001
resource: .bouncer/context/epics/039-open-source-one-zero/blueprints/002-public-contract-freeze/tasks/001/tasks.md
tags:
  - bouncer
  - tasks
timestamp: '2026-08-15T18:45:30.065+09:00'
bouncer:
  id: TASKS-001
  epic_id: '039'
  blueprint_id: '002'
  status: verified
  commit_intent:
    - 공개 표면이 네 문서에 흩어져 있어 무엇을 바꾸면 소비자가 깨지는지 판단할 근거가 없음
    - 계약 대상과 breaking·폐기 절차를 문서 한 곳에 모아 1.0 이후 변경 판단 기준을 만듦
  affected_paths:
    - docs/compatibility.md
    - docs/gates.md
    - docs/README.md
    - README.md
  graph:
    generated_at: '2026-08-15T18:50:15+09:00'
    command: 'graphify query "public contract compatibility policy CLI command registry gate codes schema version skills list config keys pilot matrix host support docs" --graph graphify-out/{source,context}/graph.json'
    suggested_paths:
      - test
      - docs
    basis:
      - graph: source
        status: reused
        query: public contract compatibility policy CLI command registry gate codes schema version skills list config keys pilot matrix host support docs
        result: '46 nodes; top paths: test/validate-gates.test.js, test/validate-structural.test.js (docs/ is outside config.source_dirs so it cannot appear)'
      - graph: context
        status: updated
        query: public contract compatibility policy CLI command registry gate codes schema version skills list config keys pilot matrix host support docs
        result: '8 nodes; .bouncer/distill/plugin-skills.md and past epic 009/013 docs only; no code target'
---
# Tasks

Blueprint: [002](../../index.md)

## Goal & intent
`docs/compatibility.md` 하나를 읽으면 Bouncer 1.0이 무엇을 계약으로 약속하는지,
무엇은 언제든 바뀌는지, 계약을 깨야 할 때 어떤 절차를 밟는지 알 수 있다. 계약
대상은 CLI 명령 이름, 문서 스키마(문서 종류·status 어휘·`bouncer_schema`), 게이트
G/S 코드, 워크플로 스킬(`skills/bouncer-*` 여섯 개), `.bouncer/config.json` 최상위
키 다섯 종이다. 상세 설명은 기존 문서가 계속 갖고 이 문서는 목록과 정책만 갖는다.
`skills/` 아래 나머지 보조 스킬은 계약이 아니다 — 워크플로가 내부에서 부르는
구현이라 이름과 구성이 바뀔 수 있다.

같은 커밋에서 이미 난 drift를 고친다. `docs/gates.md`와 `README.md`는 구조 코드가
`S0–S20`이라고 적지만 실제로는 `S26`까지 발행된다. `S21`–`S24`와 `S26`은 Distill
샤드 등록·`pulls`·순환·크기 경고이고, `S25`는 source 라우팅 공백이다.

## Interface
- 제공: `docs/compatibility.md`가 다음을 선언한다.
  - 공개 표면 다섯 종의 **이름 목록**. 각 항목은 백틱으로 감싸고 설명은 기존
    문서(`cli.md`·`gates.md`·`workflow.md`·`configuration.md`)로 링크한다.
  - 계약이 아닌 것: 내부 모듈 경로와 `scripts/lib` emit 레이아웃, 진단·로그 문구,
    문서 산문 표현, `graphify-out/` 산출물, 서브에이전트 프롬프트 본문.
  - breaking change 정의: 위 이름 목록에서 무엇이 사라지거나, 같은 이름의 판정
    결과가 뒤집히거나, 기존 문서가 새 필수 필드 없이는 게이트를 통과하지 못하게
    되는 변경.
  - 폐기 절차: 최소 한 개 minor 릴리스 동안 기존 이름을 유지하고 CHANGELOG에
    폐기를 적은 뒤 다음 major에서 제거한다. 문서 레이아웃 변경은 `bouncer migrate`
    하위 명령을 함께 낸다.
  - 결번 코드 재사용 금지: `G9`, `G15`, `S14`는 영구 결번이다.
- 거부: 새 CLI 명령·게이트 코드·설정 키·문서 status를 만들지 않는다. 기존 문서의
  표를 이 문서로 복사하지 않는다. `BOUNCER_SCHEMA_VERSION`을 올리지 않는다.

## Touch
- Create `docs/compatibility.md` — 공개 표면 다섯 목록, 계약이 아닌 것, breaking
  정의, 폐기 절차, 결번 목록, 마이그레이션 경로를 담는다.
- Modify `docs/gates.md` — 구조 코드 범위를 `S0–S26`으로 고치고 `S21`–`S26` 설명을
  추가한 뒤 `compatibility.md`를 링크한다.
- Modify `README.md` — 같은 `S0–S20` 표기를 고치고 계약 문서 링크를 넣는다.
- Modify `docs/README.md` — `docs` 목차 표에 `compatibility.md` 줄을 넣는다.

## Do not touch
- `scripts/` — 이 task는 문서만 고친다. 코드가 바뀌어야 할 drift를 찾으면 문서가
  아니라 계획으로 되돌린다.
- `test/` — 계약을 강제하는 테스트는 task 002 소관이다.
- `docs/PILOT.md`, `docs/install.md` — 파일럿 매트릭스와 지원 선언은 task 003 소관이다.
- `.bouncer/` — 문서 task가 하네스 상태를 건드리지 않는다.

## Constraints
- `S21`–`S26`의 의미는 `scripts/src/lib/validate-structural.ts`의 실제 호출부에서
  읽어 적는다. 코드 번호를 추정하거나 새로 배정하지 않는다.
- 코드 집합은 `validate*` 파일만 보고 뽑지 않는다. `S13`은 `epic-index`에서
  발행되므로 `scripts/lib/*.js` 전체를 훑어야 목록이 완전해진다.
- `docs/compatibility.md`는 한국어로 쓰고 명령·코드·경로·키 이름만 원문으로 둔다.
- 목록은 이름만 담는다. 각 이름의 플래그·동작 설명을 여기에 복제하면 다음 drift가
  이 문서에서 난다.
- 문서 본문에 버전 `1.0.0`을 확정 사실로 적지 않는다. 승격은 BP003 소관이다.
- 기존 문서의 앵커(`gates.md`, `cli.md`의 헤딩)를 바꾸지 않는다. README와 스킬이
  링크로 참조한다.

## Checklist
- [ ] `node scripts/bouncer --help` 출력에서 명령 이름 14개를 확인하고 그 집합을
  `docs/compatibility.md`에 적는다.
  ```text
  validate verify scaffold commit finalize seed-worktree init graph-sync
  graphify-bin project-root distill current migrate import
  ```
- [ ] `require('./scripts/lib/schema')`의 `TYPES`, `STATUS_ENUM`,
  `BOUNCER_SCHEMA_VERSION`, `SCALE_ENUM`, `AUTONOMY_ENUM`을 읽어 문서 스키마 절을
  채운다. 값을 손으로 바꾸지 않는다.
- [ ] `scripts/lib/*.js` 전체에서 발행되는 `G`/`S` 코드 집합을 뽑아 게이트 절에
  적는다. `epic-index.js`의 `S13`이 목록에 들어갔는지 확인하고, `G9`·`G15`·`S14`가
  집합에 없음을 확인한 뒤 결번으로 선언한다.
  ```bash
  grep -ohE "'[GS][0-9]{1,2}'" scripts/lib/*.js | sort -u
  ```
- [ ] `skills/bouncer-*` 여섯 디렉터리 이름과 `.bouncer/config.json` 최상위 키를
  (`config.example.json` 기준) 목록에 반영하고, 나머지 보조 스킬은 계약이 아니라고
  「계약이 아닌 것」 절에 적는다.
- [ ] `docs/gates.md`의 `S0–S20`을 실제 범위로 고치고 `S21`–`S26` 여섯 줄을 추가한다.
  ```text
  S21 등록되지 않은 orphan Distill 샤드
  S22 always가 아닌 샤드에 라우팅 paths가 없음
  S23 shard pulls 누락·무효 또는 없는 샤드 참조
  S24 shard pulls 순환
  S25 source 라우팅 공백 — 어떤 샤드도 해당 source 디렉터리를 담당하지 않음
  S26 샤드가 byte 경고 임계값을 넘음
  ```
- [ ] `README.md`의 같은 표기를 고치고, `docs/README.md` 목차에 새 문서를 넣는다.
- [ ] `npm test`가 통과한다.
