---
type: bouncer.distill
title: BP-001 distill
description: Distill for BP-001
resource: .bouncer/context/epics/EPIC-001-cli-usability/blueprints/BP-001-cli-help/distill.md
tags:
  - bouncer
  - distill
timestamp: '2026-07-27T02:39:49.182Z'
bouncer:
  id: DISTILL-BP-001
  epic_id: EPIC-001
  blueprint_id: BP-001
  status: published
---
# Distill

BP-001에서 배운 것. 이 저장소가 Bouncer로 관리된 첫 사이클이기도 하다.

## 구현에서

- 사용법 문자열은 `runCli` 위 모듈 상수 하나로 충분했다. 인자 파서를 도입하면
  의존성이 늘고 벤더링 부담이 생긴다(`test/distribution.test.js`가 막는다).
- 알 수 없는 명령일 때 사용법은 **stderr**로 낸다. stdout을 비워 둬야
  `bouncer validate ... | jq` 같은 사용을 오염시키지 않는다.

## 사이클에서 관찰한 것

- **부트스트랩 별도 커밋 규칙이 실제로 필요했다.** `.bouncer/config.json`의
  `source_dirs`를 이 저장소에 맞게(`scripts`/`hooks`/`test`) 고쳐야 했고, 이는
  `/bouncer-plan` 이전에만 커밋할 수 있는 변경이다.
- **`verification.md`가 부풀어 오른다.** 테스트 191개의 목록이 frontmatter
  `output_tail`(100줄)과 본문 `## Evidence`에 중복돼 문서가 229줄이 됐다.
  증적으로서의 가치는 종료 코드와 명령 문자열에 있고, 전체 목록은 그렇지 않다.
  R2로 기록했고 후속 blueprint 대상이다.
- 게이트는 한 번도 잘못된 통과를 주지 않았다. plan/execute/finalize 모두
  의도한 시점에만 통과했다.

## 다음 blueprint 후보

1. `output_tail` 축약(마지막 N줄 대신 요약 행) 또는 본문 중복 제거.
2. `graphify` 비활성 시 `graph.basis` 폴백 문구를 `graphify-runner`가
   자동 기입 — 지금은 손으로 적었다.

## 추가 관찰 (finalize 단계)

- **생성된 커밋 메시지의 품질이 문서 `title`에 전적으로 달려 있다.** scaffold 기본값을
  그대로 두면 `feat(BP-001): BP-001 cli-help` / `Implemented: - BP-001 tasks`처럼
  아무 정보 없는 메시지가 나온다. title을 커밋 제목으로 쓸 수 있게 적어야 한다.
  `/bouncer-plan`이 이 점을 안내하면 좋겠다.
- `buildCommitMessage`에는 trailer(예: `Co-Authored-By`)를 넣을 자리가 없다.
  팀 규약에 trailer가 있다면 후속 blueprint 대상이다.
