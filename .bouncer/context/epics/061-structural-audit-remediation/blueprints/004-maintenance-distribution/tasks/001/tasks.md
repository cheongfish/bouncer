---
type: bouncer.tasks
title: 문서 계약 구조 검사로 전환
description: Replaces prose-sensitive documentation assertions with structural contract checks.
resource: .bouncer/context/epics/061-structural-audit-remediation/blueprints/004-maintenance-distribution/tasks/001/tasks.md
tags:
  - bouncer
  - tasks
  - documentation
  - structural-testing
timestamp: '2026-09-03T16:13:46.051+09:00'
bouncer:
  id: TASKS-001
  epic_id: '061'
  blueprint_id: '004'
  status: verified
  commit_intent: |-
    산문 표현 변경이 동작 계약 테스트를 깨뜨리는 결합을 제거함
    문서의 필수 구조와 링크를 기계적으로 검증할 수 있게 함
  verify: npm test
  affected_paths:
    - .bouncer/context/epics/061-structural-audit-remediation/index.md
    - scripts/check-doc-shape.js
    - test/master-rules.test.js
    - test/skill-bouncer-plan.test.js
    - test/skill-bouncer-execute.test.js
    - test/skill-bouncer-commit.test.js
    - test/skill-bouncer-finalize.test.js
    - test/skill-bouncer-run.test.js
    - test/skill-bouncer-init.test.js
  scope_evidence:
    producer: graphify
    generated_at: '2026-09-03T16:17:10.000+09:00'
    suggested_paths: []
    basis:
      - graph: source
        status: reused
        query: documentation structural contract markdown test
        result: source graph was fresh; no ranked implementation candidate
      - graph: test
        status: reused
        query: documentation structural contract markdown test
        result: test graph was fresh; no ranked test candidate
      - graph: context
        status: updated
        query: documentation structural contract markdown test
        result: context graph produced an over-broad 200-candidate result
    quality:
      status: low-confidence
      confidence: low
      reasons:
        - 'context seeds: 5 labels, 124 paths'
        - relation filter returned an over-broad 200-candidate result
    candidates:
      implementation: []
      test: []
      context: []
  commit_sha: 6a3f8f5c
---
# 문서 계약 구조 검사로 전환

Blueprint: [004](../../index.md)

<!-- scope_evidence.basis 엔트리 필드: graph, status, query, result.
     graph: source | test | context
     status: updated | reused | fail-skip | skip-disabled | missing
     quality/candidates는 graph-suggest 결과로만 채운다(scaffold는 비워 둔다).
     프론트매터 값은 []로 둔다. 이 주석을 실제 엔트리로 옮기면 빈 계획이 승인된다. -->

## Goal & intent
<!-- 구현자가 다른 문서 없이 시작할 수 있게.
     수용 기준과 검증 명령도 여기에 적거나 Checklist에 명시한다. -->
문서·스킬 계약 검증을 특정 단어의 정규식 존재 여부에서 필수 H2, 순서, frontmatter, 링크 같은 구조 판정으로 옮긴다. 동등한 산문 다듬기는 통과하고, 계약 구조의 누락·순서 오류·깨진 참조와 HTML 주석 안에만 있는 가짜 구조는 실패해야 한다.

## Interface
<!-- 계약이 리뷰에서 검증 가능하도록 제공하는 것과 거부하는 것을 함께 적습니다. -->
- 제공: 재사용 가능한 문서 구조 검사 도우미와 이를 사용하는 대상 skill·rule 계약 테스트.
- 거부: 표현 자체만을 요구하는 단어·문장 정규식과, 필수 구조를 판정하지 못하는 모호한 통과 조건. 중첩 이미지 링크, 주석만 있는 frontmatter description, HTML 주석 안에만 있는 heading·link·번호 단계·ACQ 블록, 여러 줄 inline code 안의 heading·번호 단계는 계약을 만족하지 않는다.

## Touch
<!-- frontmatter bouncer.affected_paths의 모든 경로가 여기서 정당화되어야 합니다 (G11).
     디렉터리가 아니라 파일 단위로, 동사(Create/Modify/Delete/Rename)를 붙입니다.
     디렉터리 하나로 뭉치면 그 안 모든 파일이 열려 G11이 사실상 통과만 합니다.
     경로는 백틱으로 감쌉니다. -->
- Create `scripts/check-doc-shape.js` — Markdown frontmatter, H2 순서, 링크·필수 계약을 구조적으로 판정한다.
- Modify `.bouncer/context/epics/061-structural-audit-remediation/index.md` — 이 blueprint의 epic 등록과 성공 조건을 유지한다.
- Modify `test/master-rules.test.js` — master rule의 구조 계약을 새 검사기에 맞춘다.
- Modify `test/skill-bouncer-plan.test.js` — plan skill의 단계·ACQ·참조 계약을 구조 검사로 바꾼다.
- Modify `test/skill-bouncer-execute.test.js` — execute skill의 단계·참조 계약을 구조 검사로 바꾼다.
- Modify `test/skill-bouncer-commit.test.js` — commit skill의 단계·참조 계약을 구조 검사로 바꾼다.
- Modify `test/skill-bouncer-finalize.test.js` — finalize skill의 단계·참조 계약을 구조 검사로 바꾼다.
- Modify `test/skill-bouncer-run.test.js` — run skill의 단계·참조 계약을 구조 검사로 바꾼다.
- Modify `test/skill-bouncer-init.test.js` — init skill의 단계·참조 계약을 구조 검사로 바꾼다.

## Do not touch
<!-- 여기 적은 경로가 affected_paths와 겹치면 G12가 막습니다.
     epic / blueprint의 Out of scope에서 이어받습니다. -->
- `skills/**` — 검사 전환만 수행하며 skill 본문 계약 자체는 바꾸지 않는다.
- `rules/**` — 검사 전환만 수행하며 rule 본문 계약 자체는 바꾸지 않는다.

## Constraints
<!-- 경로로 표현되지 않는, 작업 전체에 걸리는 규칙. 허용된 파일 안에서도 지켜야 합니다.
     예: 하위 호환 별칭을 남기지 않는다 / 기존 게이트 번호와 본문 계약을 유지한다 /
     공개 문자열은 한국어를 유지한다.
     막을 대상이 경로뿐이면 Do not touch에 적습니다. -->
- Node 표준 라이브러리만 사용하고 새 Markdown·테스트 의존성을 추가하지 않는다.
- 구조 검사는 기존 계약의 의미를 보존하며, 표현 문구를 새로운 정본으로 만들지 않는다.
- HTML 주석은 보이는 Markdown 구조로 해석하지 않되, 주석의 앞뒤에 있는 실제 구조와 기존 fence·inline code 경계 판정은 보존한다.
- ACQ 테스트는 특정 영어 선택지 문구가 아니라 선택지 순서, 관련 CLI flag, 상태 효과로 계약을 판정한다.
- 여러 줄 inline code의 내부 줄은 heading·번호 단계·링크 추출보다 먼저 제외한다.

## Checklist
<!-- 각 항목은 구현자가 순서대로 실행 가능해야 합니다.
     행위를 바꾸는 항목은 실패 테스트 → 실패 확인 → 구현 순서로 적습니다.
     기대하는 assertion·상수·명령은 코드블록으로 그대로 적어 해석 여지를 없앱니다.
     blueprint Contract에서 이연된 테스트 본문·구현 시퀀스가 들어올 자리입니다.
     수용 기준·검증 명령을 체크 항목으로 포함하세요. -->
- [ ] 대상 테스트의 산문 정규식이 구조상 무엇을 보장하려는지 분류한다.
- [ ] 새 구조 검사에 대한 실패 사례를 먼저 작성하고 현재 구현에서 실패함을 확인한다.
- [ ] H2·frontmatter·링크·명시된 단계 계약을 판정하는 최소 도우미를 구현한다.
- [ ] 대상 테스트를 도우미 기반 단언으로 옮기고 동등 산문 변경이 통과하는 회귀 사례를 추가한다.
- [ ] 중첩 이미지 링크와 주석만 있는 description이 실패하는 회귀 테스트를 추가하고, multiline code span·fence 경계를 포함해 링크·frontmatter 판정을 보존한다.
- [ ] HTML 주석 안에만 있는 heading·link·번호 단계·ACQ 블록이 실패하고, 주석 앞뒤의 실제 구조는 계속 통과하는 회귀 테스트를 먼저 추가한다.
- [ ] 주석 구간을 구조 판정에서 제외하는 최소 구현을 추가하고 multiline 주석과 fence·inline code 경계의 기존 회귀를 다시 확인한다.
- [ ] graphify promotion ACQ의 선택지 문구를 동등 표현으로 바꾼 회귀 테스트를 추가하고, 순서와 `--promote-graphify` 효과가 유지될 때만 통과하게 한다.
- [ ] 여러 줄 inline code 안의 H2와 번호 단계가 구조 계약을 통과하지 않는 실패 사례를 먼저 추가하고, code span 밖의 실제 구조가 계속 통과하도록 구현한다.
- [ ] `npm test`를 실행해 전체 계약을 확인한다.
