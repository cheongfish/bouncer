---
type: bouncer.explain
title: 005 explain
description: Explain for 005
resource: .bouncer/context/epics/061-structural-audit-remediation/blueprints/005-doc-lint-cli/explain.md
tags:
  - bouncer
  - explain
timestamp: '2026-09-04T09:30:27.180+09:00'
bouncer:
  id: EXPLAIN-005
  epic_id: '061'
  blueprint_id: '005'
  status: published
  comprehension:
    - range_from: develop
      range_to: 05a3ab29f6c782caa2bf8200ee2ce511da63cbcb
      diff_sha: 60224a3119e64cce116b2045137c0d8792e6b011df2d61c81e23c97d92fd650b
      quiz_score: 3/3
      disposition: CLI 입구·CI 삽입 위치·누락 파일 거부를 모두 맞춤
      recorded_at: '2026-09-04T09:31:34+09:00'
  task_commits:
    - id: '001'
      sha: 05a3ab29
---
# Explain

## Background
`scripts/check-doc-shape.js`는 문서 구조 계약을 검사하지만, 호출 경로가
`test/master-rules.test.js` 등 단위 테스트뿐이었다. 문서만 고친 뒤에도
`npm test` 전체(또는 관련 스위트)를 돌려야 했고, CI에도 문서 린트가
별도 단계로 없었다. 이 블루프린트는 같은 검사기를 CLI로 열어
`npm run lint:docs`와 `npm run ci`의 `lint` 직후 단계로 묶는다.

## Intuition
검사기는 그대로 두고, 입구만 `node scripts/check-doc-shape.js`와
`npm run lint:docs`로 연다.

## Code
- `scripts/check-doc-shape.js` — `runCli`, `classifyDocPath`,
  `workflowSkillContract` / `agentContract` / `subskillContract`. 인자 없으면
  `skills`·`agents`·`references`를 걷되 계약이 있는 경로만 검사한다.
  `require.main === module`이 `process.argv.slice(2)`를 `runCli`에 넘긴다.
- `package.json` — `"lint:docs": "node scripts/check-doc-shape.js"`,
  `ci`는 `lint` 직후 `lint:docs`.
- `test/doc-shape-cli.test.js` — 프로세스 spawn으로 exit 0/1·stderr·파일 인자.
- `test/ci-contract.test.js` — `lint:docs` 존재와 CI 순서.
- `docs/contributing.md` — 로컬/`ci` 설명에 `lint:docs` 반영.

## Quiz
1. 인자 없이 `node scripts/check-doc-shape.js`를 돌리면 기본으로 무엇을 하나?
   - A) `scripts/src/lib/**` TypeScript만 타입체크한다
   - B) `skills`·`agents`·`references` 트리에서 skill-shape 계약이 있는 문서를 검사한다
   - C) `.bouncer/context/**` OKF frontmatter만 검사한다

2. `npm run ci`에서 `lint:docs`는 어디에 끼워졌나?
   - A) `check:emit` 바로 앞
   - B) `typecheck`와 `npm audit` 사이
   - C) `npm run lint` 직후

3. 존재하지 않는 파일 경로를 CLI 인자로 넘기면?
   - A) 해당 인자만 건너뛰고 나머지는 검사한 뒤 항상 exit 0
   - B) stderr에 오류를 쓰고 exit 1로 끝난다
   - C) 대화형으로 경로를 다시 묻는다

## 이해 상태
- quiz_score: 3/3
- Q1 정답 B / 응답 B — 맞음
- Q2 정답 C / 응답 C — 맞음
- Q3 정답 B / 응답 B — 맞음
- disposition: CLI 입구·CI 삽입 위치·누락 파일 거부를 모두 맞춤
- range: develop..05a3ab29f6c782caa2bf8200ee2ce511da63cbcb
