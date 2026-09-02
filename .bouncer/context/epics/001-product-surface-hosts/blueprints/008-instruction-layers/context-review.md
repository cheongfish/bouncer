---
type: bouncer.context_review
title: 002 지시문 층 계획 정합성 판정
description: blueprint 002의 epic·blueprint·task 네 문서에 대한 bouncer-context-reviewer 판정과 그 처분
resource: .bouncer/context/epics/001-product-surface-hosts/blueprints/008-instruction-layers/context-review.md
tags:
  - bouncer
  - context_review
timestamp: '2026-08-31T08:39:18.895+09:00'
bouncer:
  id: CTXREVIEW-008
  epic_id: '001'
  blueprint_id: '008'
  status: accepted
  context_review:
    findings:
      - id: CR-001
        severity: blocker
        status: resolved
        note: --route 앵커를 finalize 레퍼런스로 옮길 수 없다. 잔류로 처분해 task 001 Interface에 못박고 매핑 fence에서 뺐다.
      - id: CR-002
        severity: major
        status: resolved
        note: finalize consent 앵커가 매핑에 없었고 대상 파일이 정규식을 만족하지 않는다. 잔류 계약 셋에 포함시켰다.
      - id: CR-003
        severity: major
        status: resolved
        note: 비-룰7 행에 매핑이 없었다. B14 행별 처분표를 계획 시점 값으로 task 001에 넣었다.
      - id: CR-004
        severity: major
        status: resolved
        note: 하드룰 8은 재진술이 아니라 한국어 범위의 유일 진술이다. 처분표에서 축약 제외로 확정했다.
      - id: CR-005
        severity: major
        status: resolved
        note: core.md 대상은 복합 불릿이다. 절 단위 지운다/남긴다 표를 task 003 Checklist에 넣었다.
      - id: CR-006
        severity: minor
        status: resolved
        note: core.md에 없는 graphify-out 경계 문장을 거부 목록에서 뺐다.
      - id: CR-007
        severity: minor
        status: accepted
        note: test/distill.test.js의 샤드 바이트 상한을 task 003 Constraints에 기록했다. 삭제는 값을 내리기만 하므로 affected_paths 확장은 필요 없다.
      - id: CR-008
        severity: major
        status: resolved
        note: private true는 bin 링크를 막지 않는다. 원인을 npm install 미실행 하나로 고치고 npm link 대안을 Interface에 넣었다.
      - id: CR-009
        severity: major
        status: resolved
        note: 문서 수정만으로 실패가 남는다는 사실을 task 004 Goal과 blueprint Out of scope에 명시했다.
      - id: CR-010
        severity: major
        status: resolved
        note: task 004 수용 기준 네 항목을 Interface와 blueprint Contract에 넣었다.
      - id: CR-011
        severity: minor
        status: resolved
        note: epic Blueprints 줄을 실제 잠근 열두 경로 기준으로 다시 썼다.
      - id: CR-012
        severity: minor
        status: resolved
        note: either/or를 없앴다. Intensity 매핑에는 아무것도 더하지 않기로 하고 references/minimality/index.md를 affected_paths에서 뺐다.
      - id: CR-013
        severity: minor
        status: resolved
        note: 같은 결정으로 해소. 매핑 소비자 부재 진술은 core.md의 남는 절이 유일 보유자다.
      - id: CR-014
        severity: minor
        status: resolved
        note: task 002 Goal에 task 001 앵커 보존 의무를 한 줄로 넣었다.
      - id: CR-015
        severity: minor
        status: accepted
        note: 에픽 성공조건 6은 approved 문서라 문구를 바꾸지 않는다. 대신 blueprint 수용 기준에 판정 대상이 문서 계약이며 승격 실행을 관찰하지 않는다고 적었다.
      - id: CR-016
        severity: nit
        status: accepted
        note: source_dirs가 scripts/hooks/test뿐이라 그래프가 문서 변경을 가리키지 못한다. 경로는 계약 blast check로 잠갔고 scripts는 각 task 거부 절에 근거와 함께 제외했다.
---

# Context review

판정자 `bouncer-context-reviewer` · 대상 epic 059 / blueprint 002 / task 001–004.

검증되어 발견사항이 없는 것: `CLAUDE.md` 6,127B·상한 6,135B·하드룰 7 1,623B(26.5%) 세 수치가 모두 실측과 일치하고, 실제 루트 `CLAUDE.md`를 읽는 테스트는 `test/master-rules.test.js` 하나뿐이다. 네 task 어디에도 Do not touch와 `affected_paths`의 겹침이 없고, Goal이 Touch 밖 파일을 주장하지 않는다.

## Findings
- CR-001 · blocker · resolved — --route 앵커를 finalize 레퍼런스로 옮길 수 없다. 잔류로 처분해 task 001 Interface에 못박고 매핑 fence에서 뺐다.
- CR-002 · major · resolved — finalize consent 앵커가 매핑에 없었고 대상 파일이 정규식을 만족하지 않는다. 잔류 계약 셋에 포함시켰다.
- CR-003 · major · resolved — 비-룰7 행에 매핑이 없었다. B14 행별 처분표를 계획 시점 값으로 task 001에 넣었다.
- CR-004 · major · resolved — 하드룰 8은 재진술이 아니라 한국어 범위의 유일 진술이다. 처분표에서 축약 제외로 확정했다.
- CR-005 · major · resolved — core.md 대상은 복합 불릿이다. 절 단위 지운다/남긴다 표를 task 003 Checklist에 넣었다.
- CR-006 · minor · resolved — core.md에 없는 graphify-out 경계 문장을 거부 목록에서 뺐다.
- CR-007 · minor · accepted — test/distill.test.js의 샤드 바이트 상한을 task 003 Constraints에 기록했다. 삭제는 값을 내리기만 하므로 affected_paths 확장은 필요 없다.
- CR-008 · major · resolved — private true는 bin 링크를 막지 않는다. 원인을 npm install 미실행 하나로 고치고 npm link 대안을 Interface에 넣었다.
- CR-009 · major · resolved — 문서 수정만으로 실패가 남는다는 사실을 task 004 Goal과 blueprint Out of scope에 명시했다.
- CR-010 · major · resolved — task 004 수용 기준 네 항목을 Interface와 blueprint Contract에 넣었다.
- CR-011 · minor · resolved — epic Blueprints 줄을 실제 잠근 열두 경로 기준으로 다시 썼다.
- CR-012 · minor · resolved — either/or를 없앴다. Intensity 매핑에는 아무것도 더하지 않기로 하고 references/minimality/index.md를 affected_paths에서 뺐다.
- CR-013 · minor · resolved — 같은 결정으로 해소. 매핑 소비자 부재 진술은 core.md의 남는 절이 유일 보유자다.
- CR-014 · minor · resolved — task 002 Goal에 task 001 앵커 보존 의무를 한 줄로 넣었다.
- CR-015 · minor · accepted — 에픽 성공조건 6은 approved 문서라 문구를 바꾸지 않는다. 대신 blueprint 수용 기준에 판정 대상이 문서 계약이며 승격 실행을 관찰하지 않는다고 적었다.
- CR-016 · nit · accepted — source_dirs가 scripts/hooks/test뿐이라 그래프가 문서 변경을 가리키지 못한다. 경로는 계약 blast check로 잠갔고 scripts는 각 task 거부 절에 근거와 함께 제외했다.
