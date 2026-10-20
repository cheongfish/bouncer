---
type: bouncer.explain
title: context-review-fix-restart explain
description: Explain for context-review-fix-restart
resource: .bouncer/context/epics/plan-workflow/blueprints/context-review-fix-restart/explain.md
tags:
  - bouncer
  - explain
timestamp: '2026-10-21T08:49:09.585+09:00'
bouncer:
  id: EXPLAIN-context-review-fix-restart
  epic_id: plan-workflow
  blueprint_id: context-review-fix-restart
  status: published
  comprehension:
    - range_from: 02ab0140603afe59cfaa69d1573b193d5fb2c7c2
      range_to: 50382b09dd3036168ac86612defd1c4201a07ef1
      diff_sha: 656f5d083400f492034ae6cc772d92bfc87795d13492695221c7954c61824157
      recorded_at: '2026-10-21T09:10:00+09:00'
  task_commits:
    - task: plan-workflow/context-review-fix-restart/001
      sha: 18c05c5f
      intent_anchor: task-001
    - task: plan-workflow/context-review-fix-restart/002
      sha: 50382b09
      intent_anchor: task-002
---
# Explain

## Background

context review는 계획 문서를 승인하기 전에 두 라운드(discovery, delta)로 검토한다. delta 뒤에도 `must_fix` finding이 열려 있으면, 사용자가 그 섹션을 고쳐도 `context-review restart`는 "고치라"며 거절하고 `close`는 "restart가 필요하다"며 서로를 가리켰다. 결과적으로 고치기 전 문서를 accepted-risk로 승인하는 길밖에 없었다.

이 변경으로 열린 `must_fix`의 대상 섹션을 실제로 고쳤는지를 본문 비교로 판정한다. 모두 고쳤으면 본문만 바뀐 경우 `close`, 계약·구조까지 바뀐 경우 `restart`로 나간다. 고치지 않았으면 지금처럼 사용자에게 멈춘다.

## Code

- `scripts/src/lib/context-review-state.ts`: `openMustFixesFixed`가 열린 `must_fix` 전부의 대상이 기준 대비 고쳐졌는지 판정한다. 기준은 `latest_dispatch` 저장본이고, 새 내용은 `loadDispatch`가 재계산 대조를 통과한 `documents_content` 본문이다. payload의 `changed_documents`·`revision_diff`는 위조될 수 있어 쓰지 않는다. `extractSection`은 finding의 `symbol`과 정규화(`sectionKey`: 소문자, 영숫자 외 제거)로 일치하는 첫 heading부터 같은 단계 이상의 다음 heading 직전까지를 뽑고, 코드 펜스 안의 `#`은 무시한다. `symbol`이 `-`면 file 본문 전체를 비교한다.
- `restartCycle`과 `routeFollowUp`: 둘 다 같은 판정을 쓴다. 대상을 모두 고쳤으면 `context-review-unresolved-findings`로 멈추지 않는다. 안내 문구도 "restart cannot resolve findings"에서 "대상 섹션을 고치면 route가 close 또는 restart로 안내한다"로 바뀌었다.
- `skills/bouncer-plan/references/context-review.md`: close 단계와 route 목록이 세 갈래(본문만 수정 → close, 계약·구조 수정 → restart, 미수정 → user)를 설명한다.
- 테스트: `test/context-review-state.test.js`, `test/skill-context-review.test.js`.

설계 선택과 한계: 섹션 비교는 첫 번째 일치 heading만 본다. heading이 중복되면 첫 번째만 비교한다. 대상 섹션이 한쪽 문서에서 사라지면 "고쳐지지 않음"으로 본다. 문서 문구를 정규식으로 검증하는 테스트가 있어 문구 변경에 약하다.

## Quiz

1. delta 라운드 뒤 `must_fix`가 열려 있고, 사용자가 그 finding의 대상 섹션 본문만 고쳤다(Interface·Touch는 그대로). `context-review route`는 어디로 안내하나?
   - A) `close`
   - B) `restart`
   - C) `user` (accepted-risk 또는 중단)
2. 열린 `must_fix`가 둘 있고 하나의 대상 섹션만 고쳤다. 결과는?
   - A) 고친 것이 하나라도 있으면 `close` 또는 `restart`로 진행한다
   - B) 둘 다 고쳐야 진행하고, 아니면 `user`로 멈춘다
   - C) 고치지 않은 finding은 자동으로 accepted 처리된다
3. finding의 `symbol`이 `goal-intent`이고 문서에 `## Goal & intent` 섹션이 있다. 이 섹션 안의 코드 펜스에 `# comment` 줄이 있으면?
   - A) 새 heading으로 보고 섹션이 거기서 끝난다
   - B) heading으로 보지 않아 섹션이 계속 이어진다
   - C) 코드 펜스가 있는 문서는 비교에서 제외된다

## Tasks

### plan-workflow/context-review-fix-restart/001 · `18c05c5f`

#### Goal & intent

delta 라운드 뒤 열린 `must_fix`의 대상 섹션을 고친 계획이 막히지 않게 한다. 본문만 고쳤으면 route가 `close`를, 계약·구조도 바뀌었으면 route가 `restart`를 내고 `restart`가 받아들인다. 고치지 않은 계획, legacy 기준, 한도 소진은 지금처럼 거절한다. 수용 기준은 blueprint Contract 수용 기준 1~4이고 검증 명령은 `node --test test/context-review-state.test.js`다.

#### Current behavior

- `restartCycle`(`scripts/src/lib/context-review-state.ts:1320`)은 `state.cycle.active_reports.length >= 2`이고 open `must_fix`가 하나라도 있으면 수정 내용을 보지 않고 `context-review-unresolved-findings`로 거절한다(`:1374-1380`). 닫힌 cycle은 `state.projection.findings`, 열린 cycle은 `foldReports` 결과를 본다(`:1370-1373`).
- `routeFollowUp`(`:1511`)의 3단계(`:1552-1560`)는 닫히지 않은 cycle에서 round가 `ROUND_MODES.length`에 이르고 open `must_fix`가 있으면 `route('user', 'context-review-unresolved-findings', …)`를 돌려준다. 6단계 restart 판정(`:1577-1584`)까지 가지 않는다.
- 한편 `closeCycle`(`:1129`)은 baseline과 구조·계약이 다르면 `context-review-state-conflict`로 거절한다(`:1221-1232`). 그래서 고친 사용자는 restart·close 어느 쪽으로도 나갈 수 없다.
- 입력: `loadDispatch`(`:251-314`)는 payload의 `parts`·`scope_parts`·`structure_parts`·`documents_content`를 현재 blueprint에서 다시 계산해 같을 때만 받는다. `changed_documents`·`revision_diff`는 대조하지 않는다. 마지막 리뷰 dispatch 원문은 `readRef(ctx, repoRoot, state.cycle.latest_dispatch)`(`:466`)로 읽는다.
- finding의 `file`은 계획 문서 저장소 상대 경로, `symbol`은 절 heading의 slug 또는 `-`다(`agents/bouncer-context-reviewer.md:181-182`). `documents_content`는 문서 경로 → `{ body, structure }`다(`scripts/src/lib/plan-snapshot.ts:143-160`).
- 재현: `test/context-review-state.test.js:231`의 "delta 뒤 미해결 must_fix가 남은 상태의 restart" 테스트가 `changeDocs`로 본문을 바꾼 뒤에도 `context-review-unresolved-findings`를 확인한다. 확인한 명령은 `npm run build && node --test test/context-review-state.test.js`다.

#### Target behavior

- 판정 순서(delta를 쓴 열린 cycle, 열린 `must_fix` 존재 시, 첫 일치):
  1. 모두 고쳐짐 + `compareShape(baseline, newPayload)`의 `structure`·`scope`가 모두 같음 → `routeFollowUp`은 3단계에서 멈추지 않고 4단계 `close`(`context-review-close-available`)를 낸다. `closeCycle`은 바꾸지 않는다: 본문만 바뀐 snapshot은 이미 `sameStructureAndScope` 검사를 통과하고(`:1221-1232`), dispositions의 `resolved`는 `CONTEXT_REVIEW_STATUS` 검사만 받는다(`:1258-1266`). 그래서 고친 finding을 `resolved`로 둔 `close`가 성공한다.
  2. 모두 고쳐짐 + 구조나 계약이 다름 → `routeFollowUp`은 6단계 `restart`를, `restartCycle`은 `:1374` 거절을 건너뛰고 기존 흐름(직전 digest 동일 검사 → archive → discovery 재개)으로 `ok: true`를 낸다.
  3. 하나라도 고쳐지지 않음 → route `user`, restart `context-review-unresolved-findings`(현행).
  4. 기준 저장본에 `documents_content`가 없거나 finding `file`이 어느 한쪽에 없음 → 3과 같다.
- "고쳐짐"(finding 하나): 기준 = `latest_dispatch` 저장본의 `documents_content`, 새 내용 = 이번 dispatch의 `documents_content`. `symbol`이 `-`이면 `file` 본문이 다를 때, 아니면 Interface의 섹션 일치 규칙으로 찾은 섹션 본문이 양쪽에 있고 서로 다를 때다.
- `restartCycle`은 규칙 1 상황(본문만 변경)에서도 모두 고쳐졌으면 restart를 받아들인다. route가 `close`를 권할 뿐 restart를 막지 않는다.
- 보존: open `must_fix`가 없을 때, discovery만 기록된 cycle, 닫힌 cycle의 projection 기준 판정, 직전 digest 동일 시 `context-review-state-conflict`, `restart_count` 한도 검사가 판정보다 먼저인 순서, 한도 1회는 바뀌지 않는다. 거절 `next` 문구는 "restart cannot resolve findings" 대신 "대상 섹션을 고치면 route가 close 또는 restart를 안내한다"는 내용으로 바꾼다.

#### Interface

- 제공: 내부 판정 `신규 추출 지점: 열린 must_fix가 모두 고쳐졌는지 판정` — 입력 `(findings: Finding[], baseline: Record<string, {body: string}> | undefined, current: Record<string, {body: string}>)`, 출력 `boolean`. `restartCycle`과 `routeFollowUp` 3단계가 같은 함수를 부른다. CLI 플래그·출력 모양·reason 코드는 그대로다.
- 섹션 일치 규칙: finding `symbol`과 각 heading 텍스트를 소문자로 바꾸고 영숫자(한글 포함)가 아닌 문자를 모두 지운 값이 같으면 그 heading의 섹션이다. 예: `goal-intent` → `goalintent`, `## Goal & intent` → `goalintent`로 일치. 섹션 본문은 그 heading 줄부터 같은 단계 이상의 다음 heading 직전까지다.
- 거부: 판정이 `false`이면 restart는 `context-review-unresolved-findings`, route는 `user`. payload의 `changed_documents`·`revision_diff`는 판정 입력으로 쓰지 않는다(`loadDispatch`가 대조하지 않는 값이라 위조 가능).

#### Touch

| 경로 | 심볼 | 변경 | 현재 책임 | 계획한 변경 | 근거 |
| --- | --- | --- | --- | --- | --- |
| `scripts/src/lib/context-review-state.ts` | `restartCycle`, `routeFollowUp`, `신규 추출 지점: 고쳐짐 판정` | Modify | delta 뒤 open must_fix면 수정 여부와 무관하게 restart 거절, route는 user | 기준·새 `documents_content`로 대상 섹션 수정 여부를 판정해 본문만 변경이면 route `close`, 계약 변경이면 route·restart가 `restart`를 허용 | 거절 분기 `:1374-1380`, `:1552-1560`이 교착의 직접 원인 |
| `test/context-review-state.test.js` | delta 뒤 restart·route 회귀 테스트 | Modify | `:231`이 본문 수정 뒤에도 거절만 확인 | close·restart 두 성공 흐름과 무관 수정·한도·legacy 거절을 단언 | 검증 지점 |

#### Constraints

- `RESTART_LIMIT`(1)과 `ROUND_MODES` 길이는 바꾸지 않는다.
- 판정 함수는 파일을 읽지 않는다. 기준 내용은 이미 `readRef`로 읽은 `latest` 원문에서 꺼낸다.
- `closeCycle`의 conflict 검사는 손대지 않는다.
- 기존 `test/context-review-state.test.js:231` 테스트는 "무관 섹션만 바뀐 경우"로 의미를 유지하도록 고치되, 기대 reason은 그대로 둔다.

### plan-workflow/context-review-fix-restart/002 · `50382b09`

#### Goal & intent

`skills/bouncer-plan/references/context-review.md`가 delta 뒤 열린 `must_fix`에 대해 CLI가 실제로 받는 세 결과만 안내하게 한다: 대상 섹션을 본문만 고쳤으면 `close`(고친 finding을 `resolved`), 계약·구조도 바꿨으면 `restart`, 고치지 않았으면 `user`(accepted-risk close 또는 중단). 수용 기준은 blueprint Contract 수용 기준 5이고 검증 명령은 `node --test test/skill-context-review.test.js test/skill-bouncer-plan.test.js`다.

#### Current behavior

- 6단계 Close(`skills/bouncer-plan/references/context-review.md:103-115`)는 delta 뒤 열린 `must_fix`를 사용자에게 가져가고 accepted-risk만 `accepted`로 기록할 수 있다고 말한다. 고친 경우의 CLI 경로는 정의하지 않는다.
- route 목록(`:125-126`)은 "a `must_fix` finding is still open after the delta → `user`: stop and report. A restart does not resolve findings;"라고 적는다. 그래서 epic 119 plan에서 ACQ가 "수정 후 restart"를 선택지로 냈지만 CLI가 거절했다.
- 문서 형태 고정: `test/skill-bouncer-plan.test.js:13-19`는 파일 존재만 본다. `scripts/check-doc-shape.js`의 `PATH_CONTRACTS`에는 이 파일 항목이 없고 SKILL.md에서의 링크만 고정한다(`:872`). `test/skill-context-review.test.js:12-29`는 `fingerprint: context:` 예시 줄이 남아 있는지만 본다.

#### Target behavior

- 성공: 6단계 Close와 route 목록이 delta 뒤 열린 `must_fix`에 대해 다음 세 결과를 안내한다. 판단은 `review-dispatch plan --previous` → `context-review route`의 `next_action`으로만 한다.
  1. finding의 `file`·`symbol` 섹션을 고쳤고 본문만 바뀜 → `close`: 고친 finding을 `resolved` disposition으로 두고 `bouncer context-review close`를 실행한다.
  2. 대상 섹션을 고쳤고 구조나 Interface/Touch도 바뀜 → `restart`: 한도 안에서 `bouncer context-review restart` 뒤 discovery를 다시 돌리고, 바뀐 계획은 다시 승인한다.
  3. 대상 섹션을 고치지 않았거나 무관한 섹션만 바뀜 → `user`: 사용자에게 "accepted-risk close(리뷰 기준 문서로 되돌린 뒤 `--accept-risk`) 후 승인 뒤 수정" 또는 "중단"만 제시한다.
- 실패: "A restart does not resolve findings" 문장과 "수정 후 restart"를 조건 없이 선택지로 내는 서술이 남지 않는다.
- 보존: `fingerprint: context:` 예시 줄, 다른 단계와 route 항목(reuse·delta·restart 한도) 서술은 그대로다.

#### Interface

- 제공: skill reference 문서의 안내 문장. 코드·CLI 변경 없음.
- 거부: route가 `user`를 낸 상태에서 restart를 권하는 안내.

#### Touch

| 경로 | 심볼 | 변경 | 현재 책임 | 계획한 변경 | 근거 |
| --- | --- | --- | --- | --- | --- |
| `skills/bouncer-plan/references/context-review.md` | `6. **Close**`, route 목록의 `must_fix` 항목 | Modify | delta 뒤 must_fix에서 restart 불가만 안내 | 대상 섹션 수정 시 restart 경로와 그 밖의 두 선택지를 안내 | 교착 재발 시 ACQ 선택지의 출처 |
| `test/skill-context-review.test.js` | 신규 문서 단언 | Modify | fingerprint 예시만 확인 | 옛 문장 부재와 새 경로 언급을 단언 | 검증 지점 |

#### Constraints

- 문서는 영어 본문을 유지한다(기존 문서 언어).
- 테스트는 문장 전체가 아니라 핵심 구절(`does not resolve findings` 부재, `restart`와 `accepted-risk` 언급)만 단언한다(`test/skill-bouncer-plan.test.js:10-12`의 "문장은 고정하지 않는다" 원칙).

### plan-workflow/context-review-fix-restart/003

#### Goal & intent

TASKS-001(restart·route 판정)과 TASKS-002(skill 안내)가 통합된 뒤 `npm run ci` 전체가 통과해, 판정 변경이 다른 context review·plan gate 테스트와 문서 형태 검사를 깨지 않음을 증명한다.

#### Interface

- 제공: 구현 task가 모두 통합된 뒤 전체 검증 명령을 한 번 실행해 남기는 종단 검증 증적. 구현 task는 각자 task 전용 명령만 갖는다.
- 거부: source 변경, review 문서, commit.

#### Touch

Source 변경 경로 없음.