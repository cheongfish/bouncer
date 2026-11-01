---
type: bouncer.blueprint
title: review-close-drive-efficiency
description: Blueprint review-close-drive-efficiency
resource: .bouncer/context/epics/gates-review/blueprints/review-close-drive-efficiency/index.md
tags:
  - bouncer
  - blueprint
timestamp: '2026-11-01T14:59:08.237+09:00'
bouncer:
  id: review-close-drive-efficiency
  epic_id: gates-review
  blueprint_id: review-close-drive-efficiency
  status: closed
  order: 23
  commit_type: feat
  scale: full
  complexity: standard
  review_scope: blueprint
  verification_policy: scoped_terminal
  review_contract: brief
---
# review-close-drive-efficiency

Epic: [gates-review](../../index.md)

## Intent
리뷰 이후 계약 변경을 명시적 위험 수용과 추적 기록으로 안전하게 종결하고 한국어 종결형 오탐을 제거한다. 드라이브 세션과 조회 비용을 줄이고 최종 사용량 기록을 보존한다.

## Contract
- `context-review close`는 `--contract-links <json>`로 finding ID별 문서 경로와 Interface/Touch 절을 받는다. 계약 digest가 reviewed baseline과 다르고 구조가 같을 때, 바뀐 모든 문서가 링크돼 있고 각 링크의 finding이 `--accept-risk`로 명시 수용된 경우에만 close한다. 링크 경로는 `tasks/<NNN>/tasks.md`만 허용하고, 비교 단위는 해당 문서의 `scope_parts`(Interface·Touch·`affected_paths`·`depends_on` 묶음)이므로 링크한 문서의 이 묶음 전체가 재검토 없이 수용된다.
- 수용한 항목의 전후 digest와 재검토 없이 수용한 사실은 closure 원장(`contract_acceptances`, `accepted_without_rereview`)과 `context-review.md` frontmatter에 기록한다. disposition 형식은 바뀌지 않는다.
- 구조 변경, 링크되지 않은 문서의 계약 변경, `--accept-risk`·dispositions·`finding.file`과 맞지 않는 링크는 `context-review-state-conflict`로, 형식이 잘못된 링크는 `context-review-input-invalid`로 거절하고 상태를 바꾸지 않는다. `--contract-links` 없는 close는 기존 동작이며 계약 변경은 계속 거절된다. delta 소진 뒤에도 유효한 링크와 동의가 있으면 close할 수 있다.
- S34 코드는 유지하되 한국어 종결형(허용 어미) 판정을 `normalizeAuthoredLines`에서 제거한다. plan gate S34, `bouncer commit`, S33 Intent가 같은 함수를 쓰므로 모두 종결형을 검사하지 않는다. 목록 형태, 1–2개, 빈 항목·줄바꿈 거절, 한글 포함은 그대로다.
- `coordinator.waves_per_session`의 `"auto"`·부재 상한은 2이고 명시값(1–8)은 유지한다. `coordinate advance` 성공 응답은 `status`(`coordinate status`와 같은 객체)를 싣고, `intent sections --role reviewer`는 `--task`를 여러 번 받아 `tasks[]`로 돌려준다. 단일 호출 응답은 바뀌지 않는다.
- drive 이후 `/bouncer-finalize`와 plan 이후 `/bouncer-run`은 새 세션에서 시작하도록 skill 문서에 안내한다. 최종 알림 이후에만 `metrics end`를 부르는 기존 규칙(`drive-metrics.md`)은 테스트로 고정하고 규칙 자체는 바꾸지 않는다. 최종 검증은 `npm run ci`다.

## 실패 모드·엣지 케이스
- 링크한 문서에서 같은 묶음 안의 무관한 변경은 구분되지 않아 함께 수용된다. 사용자 동의 안내에 이 사실을 적는다.
- 연결 정보 없는 기존 cycle과 변경 없는 close는 호환된다.
- `advance`가 `status`를 읽지 못하면 성공으로 돌려주지 않는다. 일괄 reviewer 입력에서 일부 task가 실패해도 성공한 task 결과는 숨기지 않는다.

## Out of scope
- reviewer tier 변경과 과거 blueprint 이력 수정.

## One-commit justification
- 리뷰 종결 교착(001), 그 문장 게이트 오탐(002), 같은 drive에서 관측된 조회 비용(003)과 세션 안내(004)를 하나의 PR로 묶는다. task는 네 개의 commit task와 종단 검증 하나이며 공유 파일이 있어 001 → 002·003 → 004 순서로 통합한다.
