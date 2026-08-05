---
type: bouncer.blueprint
title: 마감 뒤 다음 블루프린트 후보를 계산해 통지하고 확인 후 포인터를 옮김
description: Blueprint 001
resource: .bouncer/context/epics/012-finalize-handoff/blueprints/001-next-blueprint-handoff/index.md
tags:
  - bouncer
  - blueprint
timestamp: '2026-08-04T18:03:35.679+09:00'
bouncer:
  id: '001'
  epic_id: '012'
  blueprint_id: '001'
  status: approved
  commit_type: feat
  commit_intent:
    - 승인된 블루프린트가 여러 개 대기 중이어도 마감이 끝나면 다음 대상을 사용자가 직접 찾아 포인터를 지정해야 했음
    - 다음이 무엇인지는 기억할 상태가 아니라 문서에서 계산할 값이므로 마감 시점에 계산해 확인만 받게 함
---
# 001 next-blueprint-handoff

Epic: [012](../../index.md)

## Intent
- 문제: 마감은 커밋 후 포인터를 지우고 끝난다. 다음 블루프린트가 승인·ready 상태로
  이미 대기 중이어도 그 사실이 마감 자리에서는 전달되지 않아, 사용자가 에픽 문서를 다시
  열고 경로를 복사해 포인터를 지정해야 한다. 후보 열거 로직(`listReadyBlueprints`)은
  이미 있는데 마감이 그것을 부르지 않는다.
- 완료 조건: 마감 명령의 반환에 다음 후보와 남은 후보가 실리고, 마감 스킬이 그것을
  보여준 뒤 승낙을 받아 `bouncer current --set`을 실행한다. 012 성공 조건 1–7이
  참이 되고 `npm test`가 통과한다.

## Contract
- 인터페이스 (후보 계산): `current` 모듈이 `nextBlueprint({ repoRoot, blueprintDir })`를
  내보낸다. `blueprintDir`는 방금 마감한 블루프린트이며, 반환은 다음 형태다.

  ```
  {
    next: {
      blueprint: string,        // repo 기준 posix 경로
      epic: string,             // 에픽 디렉터리 이름
      sameEpic: boolean,
      sharedPaths: string[]     // 마감 대상과 겹치는 affected_paths (없으면 [])
    } | null,
    remaining: Array<{ blueprint, epic, sameEpic }>   // next를 제외한 나머지
  }
  ```

  후보 원천은 `listReadyBlueprints` 하나다. 그 함수가 이미 `verified`를 제외하므로
  방금 마감한 블루프린트는 자기 자신을 후보로 제안하지 않는다.
- 데이터·상태: 새 파일도 새 프론트매터 필드도 만들지 않는다. 순서의 원천은 에픽
  `index.md` 본문의 `## Blueprints` 목록이며, 그 목록은 이미 존재하는 값이다.
  정렬은 (1) 같은 에픽 우선, (2) 에픽 목록에 나온 순서, (3) 목록에 없는 항목은 경로
  사전순으로 뒤에, (4) 다른 에픽은 에픽 디렉터리 이름 사전순.
- 인터페이스 (마감 반환): `finalize(...)`가 dry-run과 커밋 완료 양쪽 반환에 `next`를
  `nextBlueprint`의 결과 그대로 싣는다. `cmdFinalize`가 결과 객체를 통째로 직렬화하므로
  명령 표면을 건드리지 않고 흘러나간다.
- 인터페이스 (마감 스킬): `skills/bouncer-finalize/SKILL.md`에 워크트리 정리와 최종 보고
  사이의 단계를 하나 더한다. 후보·경고를 보여주고 **명시적 승낙**을 받은 경우에만
  `bouncer current --set <다음 블루프린트>`를 실행한다. 거절하면 포인터를 건드리지 않고
  명령만 남긴다.
- 수용 기준: 012 성공 조건 1–7.
- 검증 명령: `npm test`
- 실패 모드·엣지 케이스:
  - 후보 없음 → `next: null`, `remaining: []`. 스킬은 이 단계를 조용히 건너뛴다.
  - 에픽 `## Blueprints` 목록이 실제 디렉터리와 어긋남(이 저장소의 현재 상태) →
    목록에 있는 것부터 그 순서로, 없는 것은 사전순으로 뒤에. 후보가 유실되지 않는다.
  - 에픽 `index.md`를 읽을 수 없음 → 그 에픽 후보는 사전순으로 정렬한다. 예외를 던지지
    않는다.
  - `current --set`은 기록 전에 plan 게이트를 돌린다. 후보의 게이트가 깨져 있으면
    포인터는 쓰이지 않고 실패가 보고된다 — 커밋은 이미 끝났으므로 마감은 그 실패로
    중단되지 않고 사실만 보고한다.
  - 같은 에픽에 후보가 없고 다른 에픽에만 있는 경우 → 제안하되 `sameEpic: false`로
    구분하고 스킬이 "다른 에픽"임을 밝힌다.
  - 다음 후보가 이번 마감 대상과 `affected_paths`를 공유하는 경우 → `sharedPaths`에
    담아 경고한다. 전진은 허용한다.
  - 실행 워크트리를 남긴 채 전진하는 경우 → 포인터는 Git common directory에서 공유되므로
    남은 워크트리의 커밋 가드가 새 블루프린트의 경로를 강제한다. 스킬이 이 점을 경고에
    포함한다.

## Out of scope
- 공개 CLI 명령 신설. 계산 결과는 기존 `finalize` 명령의 반환 필드로만 나간다.
- 포인터 파일 위치·형식, 커밋 후 포인터를 지우는 동작.
- 배치 실행, base 브랜치 연쇄 자동화.
- `advisor.detectPhase` / `advise` 명령.

## One-commit justification
- 함수 하나(`nextBlueprint`), 그것을 싣는 반환 필드 하나(`finalize.next`), 그것을 쓰는
  소비자 하나(마감 스킬)가 한 계약의 세 면이다. 나눠 커밋하면 계산은 있는데 아무도 읽지
  않거나, 스킬이 없는 필드를 읽는 중간 상태가 생긴다.

## Documents
* [Tasks](tasks.md) - 구현 브리프
* [Verification](verification.md) - 검증 명령과 증적
* [Review](review.md) - 리뷰 발견사항
