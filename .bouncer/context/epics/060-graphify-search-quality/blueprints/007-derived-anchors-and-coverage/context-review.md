---
type: bouncer.context_review
title: 001 context review
description: Context review for the derived anchors and digest coverage plan.
resource: .bouncer/context/epics/060-graphify-search-quality/blueprints/007-derived-anchors-and-coverage/context-review.md
tags:
  - bouncer
  - context_review
  - context-digest
timestamp: '2026-09-01T14:30:31.830+09:00'
bouncer:
  id: CTXREVIEW-001
  epic_id: '060'
  blueprint_id: '007'
  status: accepted
  context_review:
    findings:
      - id: CR-1
        severity: major
        status: resolved
      - id: CR-2
        severity: major
        status: resolved
      - id: CR-3
        severity: major
        status: resolved
      - id: CR-4
        severity: major
        status: resolved
      - id: CR-5
        severity: major
        status: resolved
      - id: CR-6
        severity: major
        status: resolved
      - id: CR-7
        severity: minor
        status: resolved
      - id: CR-8
        severity: minor
        status: resolved
      - id: CR-9
        severity: minor
        status: resolved
      - id: CR-10
        severity: minor
        status: resolved
      - id: CR-11
        severity: nit
        status: resolved
      - id: CR-12
        severity: nit
        status: accepted
        note: >-
          Distill 승격은 /bouncer-finalize의 역할이므로 task가 문서를 고치지 않는다.
          blueprint Intent에 후속 항목으로 명시해 finalize가 놓치지 않게 했다.
---
# Context review

## Findings

- CR-1 · major · resolved — task 004가 `digestRulesFor('.bouncer/Distill.md')`를
  `['## Shards']`로 바꾸면 `test/context-digest.test.js:131` 테스트의 master 픽스처가
  `## Decisions`만 담고 있어 추출 결과가 비고 파생 파일이 만들어지지 않아
  `originals.includes('.bouncer/Distill.md')`가 실패한다. Constraints를 "Distill을 다루는
  네 자리(단언 둘, 픽스처 둘)"로 넓히고, 두 픽스처를 새 계약에 맞게 바꾸는 Checklist
  항목을 추가했다.

- CR-2 · major · resolved — task 003이 `distill`을 구조 태그로 제외하면서 task 005와
  `rules/okf.md`는 `distill`을 도메인 태그 예시로 제시해 계약이 갈라졌다. 고정
  `STRUCTURAL_TAGS` 목록을 없애고, 문서 자신의 `type: bouncer.<kind>`에서 역산한 태그와
  `bouncer` 둘만 제외하는 규칙으로 바꿨다. shard의 `distill`은 라벨로 남고 explain
  문서의 `explain`은 걸린다. task 005의 예시에서 `verification`을 빼고 `worktree`,
  `context-digest`, `graph-suggest`로 바꿨다.

- CR-3 · major · resolved — `explain`이 75개 문서의 kind 태그인데 제외 목록에 없어
  god label이 될 뻔했다. CR-2의 kind 역산 규칙이 목록 관리 없이 이 경우를 덮는다.
  blueprint Contract의 엣지 케이스도 같은 규칙으로 다시 썼다.

- CR-4 · major · resolved — blueprint Contract가 세 함수 모두 "정렬된 배열"이라고
  적었으나 task 001은 좁은 층부터 부모 순, task 002·003은 등장 순을 요구한다.
  Contract를 "중복 제거하되 순서는 함수마다 다르다 — 앵커는 좁은 층부터, 나머지는
  등장 순, 정렬하지 않는다"로 고쳤다.

- CR-5 · major · resolved — task 001의 거부 절이 잘못된 층에 대해 "상위 앵커도 이어
  붙이지 않는다"와 "상위 두 앵커만 남는다"를 나란히 적어 서로 반대였다. 규칙 하나로
  통일했다 — 깨진 층과 그 아래만 버리고 유효한 상위 층은 남긴다. 상위는 유효하고
  task 층만 깨진 혼합 사례를 Checklist 단언에 넣었다.

- CR-6 · major · resolved — epic 성공 조건 6의 "대상 문서 수와 일치"는 분모를 정의한
  문서가 없고, Contract가 "헤딩도 절도 없는 문서는 만들지 않는다"고 명시해 등식이
  성립할 수 없었다. "`digestRulesFor`가 `null`이 아닌 모든 문서가 `map.json`에
  등장하고, 빠진 항목은 절도 앵커도 없는 문서로만 설명된다"로 다시 썼고, task 004의
  Checklist가 `targets`·`emitted`·`missing` 세 값을 출력하도록 명령을 바꿨다.
  `bouncer graph-sync`라는 이름과 실제 실행 명령의 불일치도 함께 없앴다.

- CR-7 · minor · resolved — epic 성공 조건 2의 "각 파일 경로"가 task 002의 거부 규칙
  (자리표시자·한국어·비토크나이저 문자 탈락)보다 넓었다. "토크나이저 문자 집합을
  만족하는 각 백틱 경로"로 한정했다.

- CR-8 · minor · resolved — task 005의 Checklist 코드가 `okf`를 새로 읽으면서 기존
  테스트의 지역 변수 `language`를 함께 썼다. spec-authoring 단언은 기존
  「Language and prose」테스트에 이어 붙이고 okf 단언은 별도 테스트로 추가하도록
  스니펫을 나눴다.

- CR-9 · minor · resolved — One-commit 근거가 "같은 생성 경계"만 말해 task 005를
  설명하지 못했다. 소비자와 생산자를 갈라 머지하면 어느 쪽도 단독으로 검증되지
  않는다는 실제 이유를 앞세워 다시 썼다.

- CR-10 · minor · resolved — `anchorsFor` 예시가 blueprint 디렉터리 바로 아래 문서
  (`explain.md`, `context-review.md`)를 다루지 않았다. 예시와 Checklist 단언에
  `explain.md`를 넣고, 그 문서들이 blueprint와 같은 두 앵커를 얻는다고 명시했다.

- CR-11 · nit · resolved — `rules/okf.md:86`의 "Wave 2 context-digest **will**
  generate…"가 이 blueprint 이후 낡는다. task 005가 이미 그 파일을 수정하므로 현재
  시제로 바꾸는 Checklist 항목과 `assert.doesNotMatch` 단언을 추가했다.

- CR-12 · nit · accepted — `.bouncer/distill/graph.md`가 컨텍스트 트리를
  "whitelist headings only"로 적고 있어 이 blueprint 이후 부정확해진다. Distill 승격은
  `/bouncer-finalize`의 역할이므로 task가 문서를 고치지 않고, blueprint Intent에 후속
  항목으로 명시해 finalize가 놓치지 않게 했다.
