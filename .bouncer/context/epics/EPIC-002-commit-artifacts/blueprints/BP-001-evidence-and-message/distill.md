---
type: bouncer.distill
title: BP-001 distill
description: Distill for BP-001
resource: .bouncer/context/epics/EPIC-002-commit-artifacts/blueprints/BP-001-evidence-and-message/distill.md
tags:
  - bouncer
  - distill
timestamp: '2026-07-27T04:53:44.163Z'
bouncer:
  id: DISTILL-BP-001
  epic_id: EPIC-002
  blueprint_id: BP-001
  status: published
---
# Distill

EPIC-002/BP-001에서 배운 것. 이 저장소의 두 번째 Bouncer 사이클이다.

## 설계에서

- **증적의 가치는 결과에 따라 다르다.** 통과한 실행에서 증거는 종료 코드이고,
  실패한 실행에서 증거는 출력이다. 같은 형태로 기록하면 한쪽은 반드시 낭비가 된다.
  성공 시 20줄 꼬리는 `node --test`의 요약 블록과 정확히 겹쳐, 잃는 정보가 없었다.
- **언어를 하드코딩하지 않는 방법은 텍스트를 문서에서 가져오는 것이다.** 커밋
  메시지의 모든 문장은 문서 `title`에서 온다. 구조만 도구가 정하므로, 한국어 규약을
  쓰는 팀도 영어 규약을 쓰는 팀도 같은 코드로 각자의 규약을 지킬 수 있다.
- **파일 경로는 trailer에 둔다.** "본문에 파일명을 쓰지 않는다"는 규약과 추적성은
  충돌하지 않는다. trailer는 서술이 아니라 구조화된 메타데이터다.

## 사이클에서 관찰한 것

- **지난 사이클에서 고친 포인터 정리가 실제로 동작했다.** 이전 blueprint를 끝낸 뒤
  무관한 커밋이 막히지 않았고, 이번 사이클을 새로 시작할 수 있었다.
- **G11이 실수를 잡았다.** 범위를 넓히면서 `test/finalize.test.js`를
  `affected_paths`에만 넣고 Touch에 빠뜨렸는데 게이트가 즉시 실패시켰다. 사람이
  놓치기 쉬운 종류의 불일치다.
- **범위는 계획 시점에 확정되지 않는다.** 새 설정 키를 도입하니 `config.json`과
  README 설정 표가 따라왔다. tasks를 고치고 plan 게이트를 다시 통과시키는 경로가
  실제로 필요했고, 잘 동작했다.

## 다음 blueprint 후보

1. `/bouncer-plan`과 `spec-authoring`에 "`title`은 커밋 제목·본문 줄로 쓰인다"를
   명시. 지금은 문서 어디에도 없어 scaffold 기본값이 그대로 커밋에 남기 쉽다.
2. `graph.basis` 수기 입력 — 파일럿 결과를 보고 판단한다.
