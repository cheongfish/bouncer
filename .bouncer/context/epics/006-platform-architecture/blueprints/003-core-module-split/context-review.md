---
type: bouncer.context_review
title: 001 context review
description: Context review for 001
resource: .bouncer/context/epics/006-platform-architecture/blueprints/003-core-module-split/context-review.md
tags:
  - bouncer
  - context_review
timestamp: '2026-08-14T10:05:38.205+09:00'
bouncer:
  id: 'CTXREVIEW-003'
  epic_id: '006'
  blueprint_id: '003'
  status: accepted
  context_review:
    findings:
      - id: CR-001
        severity: blocker
        status: resolved
        note: graphify.ts readConfigSafe와 verification.ts 인라인 파서를 인벤토리에 넣고 task 001 Touch·affected_paths에 추가함.
      - id: CR-002
        severity: blocker
        status: resolved
        note: 검증 grep을 JSON.parse 기준으로 바꾸고, init의 config 쓰기 경로가 왜 대상이 아닌지 명시함.
      - id: CR-003
        severity: blocker
        status: resolved
        note: CR-001 해소로 성공 기준 5가 실제 달성 가능해짐. 기준 5 문구도 파싱 구현 기준으로 다시 씀.
      - id: CR-004
        severity: major
        status: resolved
        note: emit 일치 검사 주체를 .githooks/pre-commit으로 정정하고, pretest의 tsc가 산출을 덮어쓴다는 이유를 epic 기준 6과 blueprint 검증 명령에 적음.
      - id: CR-005
        severity: major
        status: resolved
        note: realHasGraphify를 graph-exec.ts로 옮기고, resolveGraphifyBin의 PATH 탐색이 프로세스를 띄운다는 근거를 Touch와 Constraints에 적음.
      - id: CR-006
        severity: major
        status: resolved
        note: 줄 수를 소스 기준으로 정정함 (validate 936, cli 495, session-graph 481, import-history 522). 앞선 수치는 emit 기준이었음.
      - id: CR-007
        severity: minor
        status: resolved
        note: 핸들러 수를 13개로 정정함.
      - id: CR-008
        severity: minor
        status: resolved
        note: validate-gates → validate-structural 간선을 의존 방향에 명시하고, isValidGraphBasis 중복 구현 금지를 같은 항목에 붙임.
      - id: CR-009
        severity: minor
        status: resolved
        note: readConfig에서 객체 모양 검사를 빼 기존 동작을 그대로 보존하고, 객체 판정은 init 호출 지점에 남김.
      - id: CR-010
        severity: minor
        status: resolved
        note: 성공 기준 3을 --help 출력과 기존 cli 테스트로 한정하고, 기준선을 작업 전에 뜨는 절차를 task 002 체크리스트 첫 항목으로 넣음.
      - id: CR-011
        severity: minor
        status: resolved
        note: moduleDetection force 때문에 import type 구문이 필요하다는 점과 emit이 빈 스텁이라는 점을 Touch에 적음.
      - id: CR-012
        severity: minor
        status: resolved
        note: 설치된 플러그인 캐시로 도는 커밋 안전 훅의 오탐 위험을 blueprint 실패 모드에 추가함.
      - id: CR-013
        severity: nit
        status: resolved
        note: hooks 파일 4개가 lib 모듈 3개를 부른다는 관계로 문구를 고침.
      - id: CR-014
        severity: nit
        status: resolved
        note: git stash 기준선을 버리고 작업 전 캡처 방식으로 바꿈.

---
# Context review

## Findings
- CR-001 (blocker, resolved) — config 리더 인벤토리가 불완전했다.
  `scripts/src/lib/graphify.ts`의 `readConfigSafe`와 `scripts/src/lib/verification.ts`의
  인라인 파서가 빠져 있어, task 001이 끝나도 파싱 구현이 셋 남았다. 두 파일을
  Touch와 `affected_paths`에 넣었다. `verification.ts`는 파일 없음과 깨진 JSON을
  구분해 던져야 하므로 `readConfigResult`를 별도 반환 형태로 설계했다.
- CR-002 (blocker, resolved) — 검증 grep이 통과할 수 없는 기대를 걸고 있었다.
  `JSON.parse` 기준으로 바꾸고, `init.ts`가 설정 파일을 **쓰는** 경로는 왜 대상이
  아닌지 적었다.
- CR-003 (blocker, resolved) — CR-001 때문에 blueprint가 달성하지 못하는 epic
  성공 기준 5를 수용 기준으로 걸고 있었다. CR-001 해소로 실제 달성 가능해졌고,
  기준 5 문구도 「파싱하는 구현」 기준으로 다시 썼다.
- CR-004 (major, resolved) — `npm test`가 emit 일치를 본다는 서술이 틀렸다.
  `pretest`의 `tsc`는 `scripts/lib`를 덮어쓰므로 오래된 커밋 산출을 잡지 못한다.
  실제 검사 주체는 `.githooks/pre-commit`의 `git diff --exit-code -- scripts/lib`
  이며, epic 기준 6과 blueprint 검증 명령을 그렇게 정정했다.
- CR-005 (major, resolved) — task 004가 자기모순이었다. `graph-scope.ts`는
  프로세스를 부르지 않는다고 못 박아 놓고 `realHasGraphify`를 그 모듈에
  배정했는데, 이 함수는 `resolveGraphifyBin`을 거쳐
  `execFileSync('graphify', ['--version'])`를 돌린다. `graph-exec.ts`로 옮겼다.
- CR-006 (major, resolved) — 모든 줄 수가 emit(`scripts/lib/*.js`) 기준이라
  소스보다 작았다. 특히 `import-history.ts`는 407이 아니라 522줄이어서, 400줄
  기준을 맞추려면 세 갈래 분할이 덜어내야 할 양이 달라진다. 네 수치를 모두
  소스 기준으로 고쳤다.
- CR-007 (minor, resolved) — `cmd*` 핸들러는 15개가 아니라 13개다.
- CR-008 (minor, resolved) — 선언한 의존 방향에
  `validate-gates → validate-structural` 간선이 빠져 있었다. 그대로 따르면
  구현자가 `isValidGraphBasis`를 게이트 층에 다시 구현하게 되고, 이는 Distill이
  금지하는 S9/G4 분기다. 간선을 명시하고 중복 구현 금지를 같은 항목에 붙였다.
- CR-009 (minor, resolved) — 「한 글자도 바뀌지 않는다」가 참이 아니었다.
  `readConfig`가 비객체를 `null`로 접으면 잘못된 `config.json`에서
  `cli`·`subagents`·`session-graph` 동작이 달라진다. 모양 검사를 아예 빼고
  객체 판정을 `init` 호출 지점에 남기는 것으로 바꿔 동작을 그대로 보존했다.
- CR-010 (minor, resolved) — 성공 기준 3이 판정 불가능했다. `--help` 출력과 기존
  `test/cli-*.test.js`가 고정하는 범위로 한정하고, 기준선을 작업 전에 뜨는
  절차를 task 002 체크리스트 첫 항목으로 넣었다.
- CR-011 (minor, resolved) — `import-types.ts`가 동작하려면 `import type` 구문이
  필요하다(`moduleDetection: force`). 그 점과 emit이 빈 스텁이라는 점을 적었다.
- CR-012 (minor, resolved) — 네 task 모두 `scripts/lib`에 파일을 더하는데,
  커밋 안전 훅은 설치된 플러그인 캐시 코드로 돈다. 오탐 가능성과 확인 절차를
  blueprint 실패 모드에 추가했다.
- CR-013 (nit, resolved) — `hooks/`는 파일 4개이고 그것이 부르는 lib 모듈이
  3개다. 문구를 관계 그대로 고쳤다.
- CR-014 (nit, resolved) — `git stash` 기준선은 미추적 emit을 남겨 `stash pop`이
  충돌할 수 있다. 작업 전 캡처 방식으로 바꿨다.
