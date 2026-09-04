---
type: bouncer.tasks
title: 문서 구조 검사 CLI 런처와 npm run lint:docs 신설
description: Tasks for document shape check CLI launcher and npm run lint:docs script
resource: .bouncer/context/epics/061-structural-audit-remediation/blueprints/005-doc-lint-cli/tasks/001/tasks.md
tags:
  - bouncer
  - tasks
  - lint
  - cli
timestamp: '2026-09-04T09:08:37.412+09:00'
bouncer:
  id: TASKS-001
  epic_id: '061'
  blueprint_id: '005'
  status: verified
  verify: npm test
  commit_intent:
    - scripts/check-doc-shape.js에 독립 CLI 런처를 추가하고 npm run lint:docs 스크립트를 신설함
    - CI 및 검증 파이프라인에 문서 구조 린트를 통합하고 전용 테스트로 실행 계약을 검증함
  affected_paths:
    - scripts/check-doc-shape.js
    - package.json
    - test/ci-contract.test.js
    - test/doc-shape-cli.test.js
    - docs/contributing.md
  scope_evidence:
    producer: graphify
    generated_at: '2026-09-04T09:12:00.000+09:00'
    suggested_paths: []
    quality:
      status: low-confidence
      confidence: low
      reasons:
        - "context seeds: 2 labels, 2 paths"
        - "relation filter: calls, imports, imports_from (depth ≤ 2); contains ownership only"
        - "no source/context functional link; no implementation candidates"
    candidates:
      implementation: []
      test:
        - path: test/master-rules.test.js
          score: -12
          confidence: low
          basis:
            - generic name match for shape
            - test-only without implementation link
            - contains-only reach
        - path: test/ci-contract.test.js
          score: -12
          confidence: low
          basis:
            - generic name match for docs
            - test-only without implementation link
            - contains-only reach
      context:
        - path: .bouncer/context/epics/061-structural-audit-remediation/blueprints/005-doc-lint-cli/index.md
          score: 4
          confidence: medium
          basis:
            - context graph hit
    basis:
      - graph: source
        status: updated
        query: document shape check check-doc-shape cli lint:docs
        result: scripts/src/lib does not contain doc shape tooling
      - graph: test
        status: updated
        query: document shape check check-doc-shape cli lint:docs
        result: matched document test candidates
      - graph: context
        status: updated
        query: document shape check check-doc-shape cli lint:docs
        result: matched blueprint 005 index
---
# Tasks

Blueprint: [005](../../index.md)

## Goal & intent
`scripts/check-doc-shape.js`를 커맨드라인에서 단독 실행 가능한 CLI 도구로 확장하고, `package.json`에 `lint:docs` 스크립트를 추가하여 단위 테스트 실행 없이도 문서 계약 위반 여부를 빠르게 검증할 수 있도록 한다. 이를 `npm run ci` 파이프라인에 통합하고, 전용 테스트를 통해 CLI 동작 계약을 검증한다.

## Interface
- 제공:
  - `node scripts/check-doc-shape.js [files...]`: CLI 인터페이스. 인자 전달 시 해당 파일만 검사하며, 인자 생략 시 `rules/skill-shape.md`에 구조 계약이 정의된 표준 문서군(`skills/**/*.md`, `agents/*.md`, `references/**/*.md`)을 스캔하여 검사한다. 정상 시 exit code 0, 위반 시 exit code 1 및 위반 내용을 stderr에 출력한다.
  - `npm run lint:docs`: 저장소 문서 전체의 구조 계약을 검사하는 npm 스크립트.
  - `check-doc-shape.js` 모듈 함수: 기존 `checkDocShape`, `extractDocShape`를 그대로 유지하고, CLI 런처 함수 `runCli(argv, opts)`를 함께 내보낸다. 파일 경로에 따른 계약 매핑(`workflowSkillContract`, `agentContract`, `subskillContract`)을 내장한다.
- 거부:
  - 존재하지 않는 문서 경로나 유효하지 않은 파일 인자 전달 시 stderr에 오류를 출력하고 exit code 1로 종료한다.
  - 필수 H2 섹션 누락, 순서 불일치, 깨진 링크 등 구조 계약 위반이 발생하면 무시하지 않고 즉시 stderr에 위반 내역을 출력하고 exit code 1로 실패한다.

## Touch
- Modify `scripts/check-doc-shape.js` — CLI 런처 `runCli` 함수(경로별 계약 매핑 포함) 및 `if (require.main === module)` 실행 블록 추가, 위반 사항 stderr 출력
- Modify `package.json` — `scripts.lint:docs` 추가 및 `scripts.ci` 파이프라인(`npm run lint` 직후)에 `npm run lint:docs` 연계
- Modify `test/ci-contract.test.js` — CI 스크립트 계약 단언에 `lint:docs` 포함 여부 및 순서 반영
- Create `test/doc-shape-cli.test.js` — `check-doc-shape.js` CLI의 정상 실행(0), 결함 문서 감지(1), 파일 인자 처리 및 stderr 출력 검증
- Modify `docs/contributing.md` — 로컬 개발 검증 절차 및 CI 파이프라인 단계 설명에 `npm run lint:docs` 반영

## Do not touch
- `scripts/src/lib/**` — Bouncer 코어 로직 보존
- `scripts/lib/**` — CJS emit 파일 보존
- `rules/**` 및 `skills/**` — 기존 규약 문서 구조 보존
- `.bouncer/context/epics/061-structural-audit-remediation/blueprints/00[1-4]/**` — 이전 완료 블루프린트 보존

## Constraints
- `scripts/check-doc-shape.js`는 `node_modules`의 외부 패키지를 require하지 않고 Node.js 내장 모듈(`node:fs`, `node:path` 등)만 사용한다.
- 기존 `test/master-rules.test.js` 및 `test/skill-*.test.js`가 의존하는 `checkDocShape`, `extractDocShape`의 기존 시그니처와 반환 형태를 보존한다.
- 문서 계약 매핑은 `rules/skill-shape.md`에 명시된 규칙(Workflow skills, Agents, Subskills)을 기준으로 수행한다.
- `npm run check:emit` 및 `npm test`가 모두 성공해야 한다.

## Checklist
1. `test/doc-shape-cli.test.js`를 작성해 `check-doc-shape.js`를 프로세스로 실행했을 때의 성공(0) 및 실패(1, stderr 출력) 동작을 검증하는 테스트를 추가한다 (실패 확인).
2. `scripts/check-doc-shape.js`에 CLI 인자 파싱, 문서 유형별 계약 매핑, 스캔 검사 실행 및 exit code 반환 로직(`runCli`)을 구현하고 `require.main === module` 진입점을 연결한다.
3. `package.json`의 `scripts`에 `"lint:docs": "node scripts/check-doc-shape.js"`를 추가하고, `ci` 스크립트의 `npm run lint` 직후에 `npm run lint:docs`를 편입한다.
4. `test/ci-contract.test.js`에서 `package.json`의 CI 스크립트 순서와 `lint:docs` 단언을 갱신한다.
5. `docs/contributing.md`에 `npm run lint:docs` 실행 가이드 및 CI 파이프라인 단계 설명을 갱신한다.
6. `npm run lint:docs` 및 `npm test`를 실행하여 모든 검증이 정상 통과함을 확인한다.
