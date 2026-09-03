---
type: bouncer.tasks
title: 셸 없는 검증 실행 경계
description: Makes configured verification commands execute as validated argv without shell interpretation.
resource: .bouncer/context/epics/061-structural-audit-remediation/blueprints/001-security-boundary-enforcement/tasks/001/tasks.md
tags:
  - bouncer
  - tasks
timestamp: '2026-09-03T12:07:49.935+09:00'
bouncer:
  id: TASKS-001
  epic_id: '061'
  blueprint_id: '001'
  status: verified
  verify: node --test test/verification-runner.test.js test/init.test.js test/validate-structural.test.js test/public-contract.test.js
  commit_intent:
    - 검증 명령을 셸 해석 없이 허용된 실행 파일의 argv로만 돌리게 함
    - 셸 연산자와 허용 목록 밖 argv0는 프로세스 시작 전에 거절함
  affected_paths:
    - scripts/src/lib/verification.ts
    - scripts/src/lib/config.ts
    - scripts/src/lib/init.ts
    - scripts/lib/verification.js
    - scripts/lib/config.js
    - scripts/lib/init.js
    - config.example.json
    - docs/configuration.md
    - docs/compatibility.md
    - test/verification-runner.test.js
    - test/init.test.js
    - test/validate-structural.test.js
  scope_evidence:
    producer: graphify
    generated_at: '2026-09-03T12:18:00.000+09:00'
    suggested_paths: []
    quality:
      status: low-confidence
      confidence: low
      reasons:
        - 'context seeds: 6 labels, 20 paths'
        - 'relation filter: calls, imports, imports_from (depth ≤ 2); contains ownership only'
        - 'result explosion: 142 candidates (≥ 50)'
    candidates:
      implementation: []
      test: []
      context: []
    basis:
      - graph: source
        status: reused
        query: verification command argv shell false allowed executable config
        result: source graph reused; graph-suggest returned low-confidence after 142 candidates
      - graph: test
        status: reused
        query: verification command argv shell false allowed executable config
        result: test graph reused; no reliable path suggestions
      - graph: context
        status: reused
        query: verification command argv shell false allowed executable config
        result: context graph reused; no reliable path suggestions
  commit_sha: 8b1493ef
---
# Tasks

Blueprint: [001](../../index.md)

<!-- scope_evidence.basis 엔트리 필드: graph, status, query, result.
     graph: source | test | context
     status: updated | reused | fail-skip | skip-disabled | missing
     quality/candidates는 graph-suggest 결과로만 채운다(scaffold는 비워 둔다).
     프론트매터 값은 []로 둔다. 이 주석을 실제 엔트리로 옮기면 빈 계획이 승인된다. -->

## Goal & intent
<!-- 구현자가 다른 문서 없이 시작할 수 있게.
     수용 기준과 검증 명령도 여기에 적거나 Checklist에 명시한다. -->
`tasks.bouncer.verify`와 `config.verify`를 argv로 파싱하고 허용된 실행 파일만 `shell: false`로 실행한다. 기존 증적 형식과 명령 선택 우선순위는 유지하며, 셸 연산자나 허용 목록 밖 실행 파일은 프로세스를 시작하기 전에 거부한다.

## Interface
<!-- 계약이 리뷰에서 검증 가능하도록 제공하는 것과 거부하는 것을 함께 적습니다. -->
- 제공: 검증 실행 함수가 파싱된 argv와 허용 실행 파일 목록을 사용한다.
- 거부: 빈 명령, `cd` 접두, 셸 메타문자, 파싱 실패, 허용 목록 밖 argv0는 `VERIFY_COMMAND_INVALID`로 거부한다.

## Touch
<!-- frontmatter bouncer.affected_paths의 모든 경로가 여기서 정당화되어야 합니다 (G11).
     디렉터리가 아니라 파일 단위로, 동사(Create/Modify/Delete/Rename)를 붙입니다.
     디렉터리 하나로 뭉치면 그 안 모든 파일이 열려 G11이 사실상 통과만 합니다.
     경로는 백틱으로 감쌉니다. -->
- Modify `scripts/src/lib/verification.ts` — argv 파싱·허용 목록 검사와 `shell: false` 실행을 구현함.
- Modify `scripts/src/lib/config.ts` — 허용 실행 파일 설정과 기본값을 읽음.
- Modify `scripts/src/lib/init.ts` — 신규 설정에 허용 목록을 기록함.
- Modify `scripts/lib/verification.js` — TypeScript emit 동반 산출물.
- Modify `scripts/lib/config.js` — TypeScript emit 동반 산출물.
- Modify `scripts/lib/init.js` — TypeScript emit 동반 산출물.
- Modify `config.example.json` — 공개 설정 예시에 허용 목록을 추가함.
- Modify `docs/configuration.md` — 검증 실행 계약을 설명함.
- Modify `docs/compatibility.md` — 공개 설정 키 목록에 `verify_allowlist`를 반영함.
- Modify `test/verification-runner.test.js` — 인자 보존과 거부 동작을 검증함.
- Modify `test/init.test.js` — 초기 설정 shape를 검증함.
- Modify `test/validate-structural.test.js` — 구조 검사 계약을 검증함.

## Do not touch
<!-- 여기 적은 경로가 affected_paths와 겹치면 G12가 막습니다.
     epic / blueprint의 Out of scope에서 이어받습니다. -->
- `scripts/src/lib/commit.ts` — 커밋 범위 통합은 task 002에서 다룸.
- `test/commit-task.test.js` — task 002의 회귀 테스트가 소유함.

## Constraints
<!-- 경로로 표현되지 않는, 작업 전체에 걸리는 규칙. 허용된 파일 안에서도 지켜야 합니다.
     예: 하위 호환 별칭을 남기지 않는다 / 기존 게이트 번호와 본문 계약을 유지한다 /
     공개 문자열은 한국어를 유지한다.
     막을 대상이 경로뿐이면 Do not touch에 적습니다. -->
- 기존 문자열 입력과 config 폴백은 유지하되 실행은 항상 argv 배열과 `shell: false`를 사용함.
- 허용 목록은 argv0 실행 파일명만 비교하며 새 의존성을 추가하지 않음.
- 검증 문서·원장의 상태, 종료 코드, 출력 tail 형식은 유지함.

## Checklist
<!-- 각 항목은 구현자가 순서대로 실행 가능해야 합니다.
     행위를 바꾸는 항목은 실패 테스트 → 실패 확인 → 구현 순서로 적습니다.
     기대하는 assertion·상수·명령은 코드블록으로 그대로 적어 해석 여지를 없앱니다.
     blueprint Contract에서 이연된 테스트 본문·구현 시퀀스가 들어올 자리입니다.
     수용 기준·검증 명령을 체크 항목으로 포함하세요. -->
- [ ] 셸 연산자·파싱 실패·허용 목록 밖 argv0를 실행하지 않는 실패 테스트를 추가하고 실패를 확인함.
- [ ] 인용 인자와 공백을 보존하는 argv 파서와 `shell: false` 실행을 구현함.
- [ ] 초기 설정·예시·문서·구조 검사를 허용 목록 계약에 맞춤.
- [ ] `node --test test/verification-runner.test.js test/init.test.js test/validate-structural.test.js test/public-contract.test.js`로 기존 증적과 새 거부 계약을 검증함.
