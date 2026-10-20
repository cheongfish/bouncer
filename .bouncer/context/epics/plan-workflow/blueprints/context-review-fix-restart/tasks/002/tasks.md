---
type: bouncer.tasks
title: delta 뒤 열린 must_fix의 restart 경로를 context review 안내에 반영함
description: Align the bouncer-plan context review guide with the restart path for fixed must_fix sections after delta
resource: .bouncer/context/epics/plan-workflow/blueprints/context-review-fix-restart/tasks/002/tasks.md
tags:
  - bouncer
  - tasks
  - context-review
  - skill-docs
timestamp: '2026-10-20T21:02:18.530+09:00'
bouncer:
  id: TASKS-002
  epic_id: plan-workflow
  blueprint_id: context-review-fix-restart
  status: ready
  execution_kind: commit
  depends_on: []
  parallel_safe: true
  dependency_gate: integrated
  review_risk: []
  verify: node --test test/skill-context-review.test.js test/skill-bouncer-plan.test.js
  affected_paths:
    - skills/bouncer-plan/references/context-review.md
    - test/skill-context-review.test.js
  commit_intent:
    - delta 뒤 열린 must_fix에 대해 skill이 실제로 불가능한 선택지를 내지 않게 함
  commit_summary:
    - 대상 섹션을 고친 뒤 restart하는 경로와 그 밖의 경우의 사용자 선택지를 안내에 적음
---
# Tasks

Blueprint: [context-review-fix-restart](../../index.md)

## Goal & intent
`skills/bouncer-plan/references/context-review.md`가 delta 뒤 열린 `must_fix`에 대해 CLI가 실제로 받는 세 결과만 안내하게 한다: 대상 섹션을 본문만 고쳤으면 `close`(고친 finding을 `resolved`), 계약·구조도 바꿨으면 `restart`, 고치지 않았으면 `user`(accepted-risk close 또는 중단). 수용 기준은 blueprint Contract 수용 기준 5이고 검증 명령은 `node --test test/skill-context-review.test.js test/skill-bouncer-plan.test.js`다.

## Current behavior
- 6단계 Close(`skills/bouncer-plan/references/context-review.md:103-115`)는 delta 뒤 열린 `must_fix`를 사용자에게 가져가고 accepted-risk만 `accepted`로 기록할 수 있다고 말한다. 고친 경우의 CLI 경로는 정의하지 않는다.
- route 목록(`:125-126`)은 "a `must_fix` finding is still open after the delta → `user`: stop and report. A restart does not resolve findings;"라고 적는다. 그래서 epic 119 plan에서 ACQ가 "수정 후 restart"를 선택지로 냈지만 CLI가 거절했다.
- 문서 형태 고정: `test/skill-bouncer-plan.test.js:13-19`는 파일 존재만 본다. `scripts/check-doc-shape.js`의 `PATH_CONTRACTS`에는 이 파일 항목이 없고 SKILL.md에서의 링크만 고정한다(`:872`). `test/skill-context-review.test.js:12-29`는 `fingerprint: context:` 예시 줄이 남아 있는지만 본다.

## Target behavior
- 성공: 6단계 Close와 route 목록이 delta 뒤 열린 `must_fix`에 대해 다음 세 결과를 안내한다. 판단은 `review-dispatch plan --previous` → `context-review route`의 `next_action`으로만 한다.
  1. finding의 `file`·`symbol` 섹션을 고쳤고 본문만 바뀜 → `close`: 고친 finding을 `resolved` disposition으로 두고 `bouncer context-review close`를 실행한다.
  2. 대상 섹션을 고쳤고 구조나 Interface/Touch도 바뀜 → `restart`: 한도 안에서 `bouncer context-review restart` 뒤 discovery를 다시 돌리고, 바뀐 계획은 다시 승인한다.
  3. 대상 섹션을 고치지 않았거나 무관한 섹션만 바뀜 → `user`: 사용자에게 "accepted-risk close(리뷰 기준 문서로 되돌린 뒤 `--accept-risk`) 후 승인 뒤 수정" 또는 "중단"만 제시한다.
- 실패: "A restart does not resolve findings" 문장과 "수정 후 restart"를 조건 없이 선택지로 내는 서술이 남지 않는다.
- 보존: `fingerprint: context:` 예시 줄, 다른 단계와 route 항목(reuse·delta·restart 한도) 서술은 그대로다.

## Interface
- 제공: skill reference 문서의 안내 문장. 코드·CLI 변경 없음.
- 거부: route가 `user`를 낸 상태에서 restart를 권하는 안내.

## Touch
| 경로 | 심볼 | 변경 | 현재 책임 | 계획한 변경 | 근거 |
| --- | --- | --- | --- | --- | --- |
| `skills/bouncer-plan/references/context-review.md` | `6. **Close**`, route 목록의 `must_fix` 항목 | Modify | delta 뒤 must_fix에서 restart 불가만 안내 | 대상 섹션 수정 시 restart 경로와 그 밖의 두 선택지를 안내 | 교착 재발 시 ACQ 선택지의 출처 |
| `test/skill-context-review.test.js` | 신규 문서 단언 | Modify | fingerprint 예시만 확인 | 옛 문장 부재와 새 경로 언급을 단언 | 검증 지점 |

## Do not touch
- `scripts/src/lib/context-review-state.ts` — TASKS-001 소유.
- `scripts/check-doc-shape.js` — 이 파일의 shape 계약을 새로 만들지 않는다.
- `references/context-review/index.md` — reviewer 행동 brief는 바뀌지 않는다.

## Constraints
- 문서는 영어 본문을 유지한다(기존 문서 언어).
- 테스트는 문장 전체가 아니라 핵심 구절(`does not resolve findings` 부재, `restart`와 `accepted-risk` 언급)만 단언한다(`test/skill-bouncer-plan.test.js:10-12`의 "문장은 고정하지 않는다" 원칙).

## Checklist
- [ ] `test/skill-context-review.test.js`에 실패 테스트를 추가한다. 문서에서 route 목록의 `must_fix` 항목과 6단계 Close를 잘라 단언한다.
  ```js
  const md = fs.readFileSync(path.join(root, 'skills', 'bouncer-plan', 'references', 'context-review.md'), 'utf8');
  // 6단계 Close 절과 route 목록의 must_fix 항목만 잘라 단언한다(문서 전체에 우연히 맞는 구절을 배제).
  const close = md.slice(md.indexOf('6. **Close**'), md.indexOf('When the plan gate reports'));
  const at = md.indexOf('- no round is recorded yet');
  const routeItem = md.slice(at, md.indexOf('\n- ', at + 1));
  assert.ok(!md.includes('A restart does not resolve findings'));      // 기대 red: 현재 문서에 있음
  assert.match(close, /body-only[\s\S]*`close`[\s\S]*resolved/);        // 기대 red: 현재 Close 절에 없음
  assert.match(close, /contract[\s\S]*`restart`/);                      // 기대 red: 현재 Close 절에 없음
  assert.match(routeItem, /accepted-risk[\s\S]*stop/);                   // 기대 red: 현재 route 항목에 없음
  ```
- [ ] `node --test test/skill-context-review.test.js`로 네 단언이 각각 실패하는 것을 한 단언씩 확인한다(앞 단언을 임시로 주석 처리해 다음 단언의 red를 본다).
- [ ] 6단계 Close와 route 목록의 `must_fix` 항목을 Target behavior의 세 결과대로 고친다.
- [ ] `npm run lint:docs`가 통과한다.
- [ ] `node --test test/skill-context-review.test.js test/skill-bouncer-plan.test.js`가 통과한다.
