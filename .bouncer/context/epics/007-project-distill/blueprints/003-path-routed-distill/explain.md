---
type: bouncer.explain
title: 001 explain
description: Explain for 001
resource: .bouncer/context/epics/007-project-distill/blueprints/003-path-routed-distill/explain.md
tags:
  - bouncer
  - explain
timestamp: '2026-08-14T15:13:01.210+09:00'
bouncer:
  id: EXPLAIN-003
  epic_id: '007'
  blueprint_id: '003'
  status: published
  comprehension:
    - range_from: develop
      range_to: 899dd65f9cd0f5e91928bbe60cb5f9bec7bdae5e
      diff_sha: 127fe1875129f0a83aee31379de960d31bca311e208d42aa1cc90d7e84715939
      quiz_score: '1/3'
      disposition: '1/3으로 기록하며 낮은 점수도 마감 차단 사유로 사용하지 않음.'
      recorded_at: '2026-08-14T15:15:07.000+09:00'
---
# Explain

## Background
단일 `.bouncer/Distill.md`를 매번 전부 읽으면 변경과 무관한 규칙이 신호를 덮는다. 반대로 문장을 자동 분류하거나 일부를 버리면 기존 운영 규칙이 조용히 사라질 수 있다. 이 blueprint는 원문을 7개 shard로 사람이 분배하고, 구조 검증과 전량 audit을 거친 뒤에만 경로 선택 소비를 켠다.

라우팅은 `always` shard, 경로 일치, `pulls` 전이 폐쇄를 기준으로 동작한다. 미매칭·불확실한 metadata·구조 오류는 선택 결과를 만들지 않고 전체 shard로 되돌린다. 결과 byte 기준은 경고용이며 본문을 자르지 않는다.

## Intuition
Distill을 한 권의 책에서 색인된 여러 장으로 나누되, 색인이 의심스러우면 책 전체를 펼친다.

## Code
라우팅과 렌더링의 핵심은 `scripts/src/lib/distill.ts`와 생성된 `scripts/lib/distill.js`에 있다. `scripts/src/lib/cli-project-commands.ts`는 `--for`, `--all`, `--route`, `--audit`를 연결하고 config의 명시값을 적용한다.

구조 검사는 `scripts/src/lib/validate-structural.ts`가 담당하며, `scripts/src/lib/finalize.ts`와 `scripts/src/lib/graph-scope.ts`가 finalize·graph 계약을 소비한다. 원문 분배와 보존 감사는 `.bouncer/Distill.md`, `.bouncer/distill/*.md`, `test/distill.test.js`에서 확인한다. 운영 전환값과 byte 경고 의미는 `.bouncer/config.json`과 `docs/configuration.md`에 있다.

## Quiz
1. `bouncer distill --for`가 일부 shard가 아니라 전체 shard를 출력하는 경우는 무엇인가?
   - A) 매칭된 shard의 `pulls`가 비어 있을 때
   - B) routing이 비활성화됐거나 경로가 매칭되지 않거나 metadata가 불확실할 때
   - C) 선택 결과가 `max_bytes`를 넘을 때

2. 이 blueprint에서 `distill.max_bytes`의 역할은 무엇인가?
   - A) 결과를 해당 byte 수에서 잘라내는 하드 상한
   - B) 초과 shard를 결과에서 제외하는 필터
   - C) UTF-8 byte 초과를 알리는 관찰용 경고 기준

3. routing을 활성화하기 전에 보존을 확인하는 방법은 무엇인가?
   - A) 모든 shard를 렌더링한 결과의 원문 bullet hash가 감사 목록과 일치하는지 확인한다.
   - B) 대표 파일 하나에 대한 route 결과만 확인한다.
   - C) shard 파일 수가 7개인지 확인한다.

## 이해 상태
정답은 1번 B, 2번 C, 3번 A이다. 사용자는 1번 C, 2번 C, 3번 B로 응답했다. 1번은 오답이며 2번은 정답이고 3번은 오답이다. 점수는 1/3으로 기록하며, 낮은 점수도 blueprint 마감을 막지 않는다.
