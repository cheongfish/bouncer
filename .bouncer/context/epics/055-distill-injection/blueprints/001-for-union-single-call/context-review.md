---
type: bouncer.context_review
title: 001 for-union-single-call 계획 정합성 판정
description: Context review for 재접지 단일 호출 전환 계획
resource: .bouncer/context/epics/055-distill-injection/blueprints/001-for-union-single-call/context-review.md
tags:
  - bouncer
  - context_review
timestamp: '2026-08-27T10:49:42.247+09:00'
bouncer:
  id: CTXREVIEW-001
  epic_id: '055'
  blueprint_id: '001'
  status: accepted
  context_review:
    findings:
      - id: CR-01
        severity: major
        status: resolved
      - id: CR-02
        severity: major
        status: resolved
      - id: CR-03
        severity: major
        status: resolved
      - id: CR-04
        severity: minor
        status: resolved
      - id: CR-05
        severity: minor
        status: resolved
      - id: CR-06
        severity: minor
        status: accepted
        note: docs/configuration.md, docs/cli.md, cli-project-commands.ts usage 문자열은 --for 구문 설명이지 재접지 호출 횟수 계약이 아니고 npm run ci에 영향이 없다. task 002 Do not touch에 명시해 구현자가 헤매지 않게 했다.
      - id: CR-07
        severity: nit
        status: resolved
      - id: CR-08
        severity: nit
        status: resolved
      - id: CR-09
        severity: nit
        status: accepted
        note: epics/050-cycle-friction/.../explain.md:58은 지나간 회차 기록이라 소급 수정하지 않는다. 인벤토리 grep을 CLAUDE.md와 skills/로 좁혀 이 파일이 더는 걸리지 않고, Do not touch에도 적었다.
---
# Context review

## Findings
- CR-01 (major, resolved) — 잠금 테스트는 다섯 문서 모두에 `--for … --for` 를 요구하는데 Interface·Checklist는 `bouncer-plan`에만 셸 블록을 넣게 되어 있어, 그대로 따르면 `npm run ci`가 red다. Interface를 「다섯 모두 반복 플래그 형태를 담는다」로 고치고, 나머지 넷에 인라인 형태를 넣는 Checklist 항목을 더했다.
- CR-02 (major, resolved) — 부정 단언의 `[^\n]{0,40}`가 줄바꿈을 못 넘어 `skills/bouncer-plan/SKILL.md:206`과 `skills/bouncer-run/SKILL.md:22`의 줄바꿈된 문구를 놓쳤다. `[\s\S]`로 고쳤고, 고친 정규식이 네 곳 모두 잡는 것을 확인했다.
- CR-03 (major, resolved) — blueprint 실패 모드가 `test/master-rules.test.js:149,151`을 재접지 문장 단언이라고 잘못 적어 task 002 Constraints와 충돌했다. 그 단언은 `skills/bouncer-run/SKILL.md:105-106`을 가리키며 이번 변경 뒤에도 통과한다. blueprint 항목을 사실대로 고쳤다.
- CR-04 (minor, resolved) — 인벤토리 grep이 저장소 전체를 훑어 계획 문서와 지난 회차 explain까지 16건을 냈고, `.bouncer/distill/core.md`는 애초에 걸리지 않았다. `CLAUDE.md`와 `skills/`로 좁혀 정확히 네 줄이 나오게 하고, core.md는 `distill --for` 로 따로 확인하는 항목을 분리했다.
- CR-05 (minor, resolved) — epic 성공 기준 1은 네 문서, 기준 2는 다섯 문서를 대상으로 삼아 어긋났다. 기준 1에 core.md가 애초에 그 문구를 담지 않아 대상이 아니라는 사실을 명시했다.
- CR-06 (minor, accepted) — 프론트매터 note 참조.
- CR-07 (nit, resolved) — task 001의 두 번째 조각이 앞 블록의 `repo`를 재사용하는데 「인접 블록에서」라고 적혀 있었다. 같은 블록 안에서 잇도록 고치고, 떼어낼 경우 `fixture()`가 따로 필요하다는 점을 적었다.
- CR-08 (nit, resolved) — 본문은 「`--all` 출력과 같다」, 스니펫은 리터럴 비교라 표현이 어긋났다. 본문을 리터럴 기준으로 맞췄다.
- CR-09 (nit, accepted) — 프론트매터 note 참조.
