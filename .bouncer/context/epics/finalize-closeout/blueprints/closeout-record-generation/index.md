---
type: bouncer.blueprint
title: 마감 이해 기록과 PR 본문 초안 자동 생성
description: Generate confirmed comprehension metadata and render PR body drafts from preserved finalize digests.
resource: .bouncer/context/epics/finalize-closeout/blueprints/closeout-record-generation/index.md
tags:
  - bouncer
  - blueprint
  - finalize-closeout
  - drive-followups
timestamp: '2026-10-23T08:26:25.099+09:00'
bouncer:
  id: closeout-record-generation
  epic_id: finalize-closeout
  blueprint_id: closeout-record-generation
  status: closed
  order: 20
  commit_type: feat
  scale: full
  review_scope: blueprint
  verification_policy: scoped_terminal
  supersedes: []
  attribution: 수용 기준이 finalize-closeout의 마감 이해 기록과 PR 본문 초안 자동 생성에 집중하므로 해당 domain epic에 귀속함
---
# 마감 이해 기록과 PR 본문 초안 자동 생성

Epic: [finalize-closeout](../../index.md)

## Intent
- drive에서 드러난 R-X3·R-X4의 계약 공백을 닫아 같은 실패와 수작업 반복을 줄이려 함.
- 마감 이해 기록과 PR 본문 초안 자동 생성를 구현 task별 수용 기준과 종단 검증으로 확인함.

## Contract

### 인터페이스·데이터·상태
- comprehension 기록 CLI는 quiz에 대한 사용자 답변/확인 후에만 호출한다. 현재 diff 범위·fingerprint·KST 시각을 직접 채우며 blueprint entry를 하나만 유지한다.
- 새 명령은 기록 시점을 자동화하며 quiz 통과·승인·published 상태를 만들어내지 않는다. 기존 refresh의 재quiz 생략 조건은 유지한다.
- PR 본문 명령은 보존된 digest와 root가 작성한 한국어 요약 파일을 입력으로 받고 Markdown을 stdout에 출력한다. task 문서 재조회나 외부 게시를 하지 않는다.
- 검증·review·outside_scope·deferred must_fix·drive 이슈는 digest 근거로 작성한다. Mermaid는 root가 판단하여 선택적으로 제공한다.

### 수용 기준
1. TASKS-001이 R-X3를 담당하며 epic 성공 기준 3를 만족한다.
2. TASKS-002이 R-X4를 담당하며 epic 성공 기준 4를 만족한다.
3. epic 성공 기준 5에 따라 각 구현 task는 전용 검증, 종단 TASKS-003은 전체 CI를 수행한다. 검증 명령은 사용자 확인을 받아 task frontmatter에 설정한다.

### 실패 모드·엣지 케이스
- 사용자 확인 누락, digest 범위와 현재 HEAD 불일치, 잘못된 fingerprint, 대상 Explain 부재는 기록 전에 거절한다.
- 잘못된 digest·누락된 요약·근거 없는 성공은 PR 초안으로 만들지 않는다. 실패·미검증·미해결 경고를 보존한다.
- 정리 뒤에도 저장 digest로 본문을 만들 수 있어야 한다. 외부 링크는 제공된 유효 링크만 사용한다.

## 근거와 중복 처리
- 조사 HEAD: `6c20e0babef5c50e17d3617a3919367bc493c898`. 현재 checkout이 근거이며 과거 Explain은 현행 코드보다 우선하지 않는다.
- Graphify source는 계획 진입 시 skip-fresh로 재사용했고 test 그래프는 skip-unconfigured다. 그래프 근거는 advisory이며 승인 범위를 정하지 않는다.
- 기존 `final-review-brief-compliance`·`plan-review-perspectives`는 병합·closed 상태다. 새 계획은 그 위의 후속 변경이다.

## 실행 DAG

| Task | 요구사항 | depends_on | parallel_safe | dependency_gate | execution_kind |
| --- | --- | --- | --- | --- | --- |
| [TASKS-001](tasks/001/tasks.md) | R-X3 | [] | true | integrated | commit |
| [TASKS-002](tasks/002/tasks.md) | R-X4 | [TASKS-001](tasks/001/tasks.md) | false | integrated | commit |
| [TASKS-003](tasks/003/tasks.md) | 전체 CI | TASKS-001, TASKS-002 | false | integrated | verification |

- 측정 보존 blueprint를 먼저 병합한 뒤 시작한다. 두 계획이 같은 finalize CLI·정리 문서를 다루므로 병렬 실행하지 않는다.
- 종단 task는 사용자 확인을 받은 전체 CI 명령으로 scaffold한다. 구현 task의 변경 경로는 사용자 확인을 받은 각 task의 affected_paths가 정본이다.

## 전용 검증 명령 제안

사용자 확인을 받은 명령이며 task frontmatter에 동일하게 설정한다.

| Task | 제안 명령 |
| --- | --- |
| TASKS-001 | `node --test test/comprehension.test.js test/cli-help.test.js test/cli-help-static.test.js` |
| TASKS-002 | `node --test test/finalize-pr.test.js test/finalize-digest.test.js test/cli-help.test.js test/cli-help-static.test.js` |
| TASKS-003 | `npm run ci` |

## Out of scope
- quiz 자동 응답·승인 추정
- PR 자동 제출·ready·merge
- 기존 fingerprint 의미 변경
- Explain published 상태 자동 변경
- 요구사항 원문은 untracked 상태를 유지하며 커밋에 포함하지 않는다.

## One-commit justification
- 각 구현 task는 표의 한 책임만 한 커밋으로 다룬다. 서로 다른 계약은 분리하고 모든 구현 뒤 종단 검증 한 개로 묶는다.

## 요구사항 추적

| 요구사항 | 담당 | 완료 판정 |
| --- | --- | --- |
| R-X3 | [TASKS-001](tasks/001/tasks.md) | 해당 task Target behavior와 Checklist |
| R-X4 | [TASKS-002](tasks/002/tasks.md) | 해당 task Target behavior와 Checklist |

## 변경 경로 후보와 조사 근거

아래 목록은 조사 근거다. 사용자 확인을 받은 Touch 파일 목록을 각 task의 affected_paths에 기록했다.

| graph | status | query | result |
| --- | --- | --- | --- |
| source | reused | explain prepareFinalizeDigest; explain computeDiffSha; explain buildPrDraft; explain cmdFinalize | 최신 그래프의 관련 source 경로를 실제 코드·호출자 rg로 확인 |
| test | skip-disabled | graphify.test_dirs 미설정으로 질의 생략 | 테스트 후보는 rg 검색 및 실제 파일 근거 사용 |

### TASKS-001 — 사용자 확인 이후 이해 기록 메타데이터 생성

- `scripts/src/lib/finalize-comprehension.ts` — grep -l finalize-comprehension.ts (001 Touch의 명시적 신규 경로)
- `scripts/src/lib/cli-git-commands.ts` — grep -l finalize
- `scripts/src/lib/cli-usage.ts` — grep -l scaffold
- `test/comprehension.test.js` — grep -l comprehension
- `test/cli-help.test.js` — grep -l perspectives
- `test/cli-help-static.test.js` — grep -l context-review
- `references/explain-diff/index.md` — grep -l scaffold
- `skills/bouncer-finalize/references/explain-quiz.md` — grep -l scaffold
- `rules/cli.md` — grep -l review_contract

### TASKS-002 — 보존 digest 기반 PR 본문 초안 생성

- `scripts/src/lib/finalize-pr.ts` — grep -l finalize
- `scripts/src/lib/cli-git-commands.ts` — grep -l finalize
- `scripts/src/lib/cli-usage.ts` — grep -l scaffold
- `test/finalize-pr.test.js` — grep -l finalize
- `test/finalize-digest.test.js` — grep -l comprehension
- `test/cli-help.test.js` — grep -l perspectives
- `test/cli-help-static.test.js` — grep -l context-review
- `skills/bouncer-finalize/references/draft-pr.md` — grep -l finalize
- `rules/cli.md` — grep -l review_contract
- `CHANGELOG.md`는 Graphify 후보가 아닌 프로젝트 Unreleased 기록 의무로 Touch에 포함한다.


## 최소 변경 검토
- 새 의존성이나 일반화 계층을 추가하지 않는다. 기존 fs·crypto·git과 js-yaml을 재사용한다.
- 신규 파일 `scripts/src/lib/finalize-comprehension.ts`은 기존 순수 모듈 경계나 독립 판정 책임을 보존하기 위한 최소 분리이며 각 task Touch가 생성 근거를 소유한다.
- 기존 테스트를 실행하는 것만으로 해당 파일을 변경 경로에 추가하지 않는다. 역할 Markdown의 추적된 TOML만 생성본 수정 범위에 포함한다.
