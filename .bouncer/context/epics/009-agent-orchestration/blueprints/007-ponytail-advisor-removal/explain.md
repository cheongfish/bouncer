---
type: bouncer.explain
title: 001 explain
description: Explain for 001
resource: .bouncer/context/epics/009-agent-orchestration/blueprints/007-ponytail-advisor-removal/explain.md
tags:
  - bouncer
  - explain
timestamp: '2026-08-06T11:01:37.295+09:00'
bouncer:
  id: EXPLAIN-007
  epic_id: '009'
  blueprint_id: '007'
  status: published
  comprehension:
    diff_sha: e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855
    quiz_score: 0/3
    disposition: >-
      accepted — Q1/Q2/Q3 missed (correct 1B 2C 3A); score does not block finalize
    recorded_at: '2026-08-06T11:03:56+09:00'
---
# Explain

## Background
`plugin_advisors.ponytail`은 init이 기본 config에 심지만 plan/execute/finalize도
게이트도 읽지 않았다. 유일한 소비 경로인 `bouncer advise`는 사람이 직접
실행한 뒤 출력 문자열을 다시 붙여 넣어야 모드가 바뀌었다. 최소화 규율은
이미 `minimality` 스킬이 맡으므로, 읽히지 않는 설정·명령·모듈·테스트·문서
안내를 한 갈래로 걷어냈다.

## Intuition
쓰이지 않는 권고 갈래를 끊으면, 남은 건 사람이 실제로 부르는 CLI와
`minimality`뿐이다.

## Code
- 설정: `.bouncer/config.json`, `config.example.json`, `init.ts` `defaultConfig`에서
  `plugin_advisors` 블록 삭제. 다른 키 값·순서는 그대로.
- CLI·모듈: `cli.ts`에서 `advise` import/`cmdAdvise`/dispatch/`USAGE` 행 삭제.
  `advisor.ts`·`scripts/lib/advisor.js` 삭제. `cmdCurrent --set`이 `base_branch`를
  읽도록 `cli.ts`에 삼키는 `readConfig`만 로컬로 둠(Do not touch인 `subagents`는
  손대지 않음).
- 테스트·문서: `test/advisor.test.js`·`cli-advise.test.js` 삭제, help/init 기대값
  갱신. `docs/cli.md`·`configuration.md`·`workflow.md`에서 명령 안내 삭제.
  `ARCHITECTURE.md` Ponytail ADR 절은 유지하고 `bouncer advise` 병행 문장만 삭제.

## Quiz
출제 근거: 삭제 중심의 한 갈래(설정·CLI·모듈·테스트·문서)라 계약 포인트 3문항.

1. `bouncer advise`를 실행하면?
   - A) 폐기 경고를 stderr에 쓰고 exit 0
   - B) 미지원 명령으로 `unknown command: advise`와 usage를 stderr에 쓰고 exit 2
   - C) `/ponytail lite` 문자열을 stdout에 출력

2. `bouncer init`이 새로 쓰는 기본 `config.json`에 대해 맞는 말은?
   - A) `plugin_advisors`를 비활성 플래그로 남긴다
   - B) 기존 프로젝트의 `plugin_advisors`를 자동 삭제한다
   - C) `plugin_advisors` 키 없이 나머지 키만 둔다

3. `docs/ARCHITECTURE.md`의 Ponytail ADR 절은?
   - A) 제목·본문을 유지하고 `bouncer advise` 병행 문장만 지운다
   - B) 절 전체를 삭제한다
   - C) `minimality` 언급까지 모두 지운다

## 이해 상태
퀴즈 0/3. 응답 `1-A, 2-A, 3-B`. 정답 Q1=B, Q2=C, Q3=A.
세 문항 모두 틀림. disposition accepted (점수 미달로 마감 차단 없음).
