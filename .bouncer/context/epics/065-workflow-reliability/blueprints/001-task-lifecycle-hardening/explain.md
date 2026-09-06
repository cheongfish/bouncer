---
type: bouncer.explain
title: 001 explain
description: Explain for 001
resource: .bouncer/context/epics/065-workflow-reliability/blueprints/001-task-lifecycle-hardening/explain.md
tags:
  - bouncer
  - explain
timestamp: '2026-09-06T12:59:10.449+09:00'
bouncer:
  id: EXPLAIN-001
  epic_id: '065'
  blueprint_id: '001'
  status: published
  comprehension:
    - range_from: develop
      range_to: fe7bad54b18f82bdad687adb357f70887dee034e
      diff_sha: 6e18bf08d530026311071369f7713b8128915a1678d084d5e747417d035a01af
      quiz_score: 2/4
      disposition: sibling 자동 제외와 explicit-file을 혼동했고, 세 번째 round 진입과 deferred/G18 분리는 맞혔다.
      recorded_at: '2026-09-06T13:02:46+09:00'
  task_commits:
    - id: '001'
      sha: '90855785'
    - id: '002'
      sha: fe7bad54
---
# Explain

## Background
실행 중 이웃 task의 스캐폴드 HTML 주석이 활성 task의 `lint:context-comments`를 막았다. 경로만으로 sibling 묶음 전체를 빼면 `ready` 문서의 금지 주석도 숨고, 활성 묶음의 pending `verification.md`/`review.md`까지 빼면 실행 중인 증적이 검사에서 빠진다. 리뷰는 같은 finding을 다시 보고도 이전 ID와 처분을 남기지 못했고, 위험 수용과 후속 이연이 한 상태값에 섞였다.

이 블루프린트는 문서별 `bouncer.status === 'pending'`인 다른 unit만 자동 검사에서 빼고, execute 리뷰에 조건부 세 번째 round와 `deferred`를 넣는다.

## Intuition
이웃의 빈 칸은 건너뛰고, 지금 쓰는 칸과 이미 채워진 칸은 검사한다. 리뷰는 두 번이 기본이고, 같은 범위의 새 결함만 한 번 더 본다.

## Code
- `scripts/check-context-comments.js` — `isPendingTaskSibling()`이 `unit.dir !== activeUnit.dir`인 뒤 `documentBouncerStatus() === 'pending'`일 때만 제외한다. `changedContextFiles()`만 이 필터를 탄다. `checkContextComments({ files })`는 전달 파일을 모두 검사한다.
- `test/context-comments.test.js` — active, pending sibling, non-pending sibling, 혼합 status, 깨진 frontmatter, explicit-file 경로를 고정한다.
- `scripts/src/lib/validate-sections.ts` — `EXECUTE_REVIEW_STATUS`에 `deferred`를 두고 `CONTEXT_REVIEW_STATUS`는 `resolved | accepted`다. 선택적 `rounds[]`는 양의 `round`, 문자열 `previous_finding_ids`, 0 이상 `new`/`resolved`/`regressed`다.
- `scripts/src/lib/validate-gates.ts` — G14는 execute status와 rounds를 보고, G18은 context status만 본다.
- `skills/bouncer-execute/SKILL.md` — `round <= 2`이거나, round 3에서 기존 blocker/major 해소·verify 통과·신규 finding이 Goal/Interface/Constraints/`affected_paths` 안일 때만 재리뷰한다. `/bouncer-run`은 이 상한을 복제하지 않고 참조한다.

## Quiz
1. 인자 없는 context 주석 검사가 자동 대상에서 빼는 파일은?
   - A) 같은 블루프린트의 모든 sibling 묶음 전체
   - B) 다른 task 묶음에서 `bouncer.status`가 `pending`인 문서만
   - C) 활성 묶음의 pending `verification.md`와 `review.md`

2. `checkContextComments({ files })`에 pending sibling 경로를 넘기면?
   - A) 포인터가 없으면 명령을 거부한다
   - B) pending이므로 건너뛴다
   - C) 상태와 관계없이 그 파일을 검사한다

3. 세 번째 review round에 들어가려면?
   - A) 기존 blocker·major가 해소되고 최근 verify가 통과했으며 신규 actionable finding이 Goal, Interface, Constraints, `affected_paths` 안에 있다
   - B) minor finding만 남아 있으면 무조건 한 번 더 본다
   - C) 두 번째 round에서 막히면 네 번째까지 이어서 고친다

4. execute review의 `deferred`와 context review G18의 관계는?
   - A) 두 문서 모두 `deferred`를 허용한다
   - B) execute만 `deferred`를 허용하고 G18은 `deferred`를 거부한다
   - C) G18만 `deferred`를 허용하고 execute G14는 거부한다

## 이해 상태
퀴즈 4문항, 응답 4, 점수 2/4.

1. 자동 제외 대상 — 정답 B, 응답 C, 오답. 활성 묶음 pending leaf는 검사에 남기고, 다른 unit의 pending 문서만 뺀다.
2. explicit-file pending sibling — 정답 C, 응답 B, 오답. `files` 인자는 sibling 필터를 타지 않는다.
3. 세 번째 round 진입 — 정답 A, 응답 A, 정답.
4. execute `deferred`와 G18 — 정답 B, 응답 B, 정답.

disposition: sibling 자동 제외와 explicit-file을 혼동했고, 세 번째 round 진입과 deferred/G18 분리는 맞혔다.

## Tasks

### Task 001

#### Goal & intent

인자 없는 context 주석 검사에서 현재 task가 아닌 문서를 경로만으로 제외하지 않고 각 문서의 `bouncer.status`를 읽는다. pending sibling만 제외하며 active 문서, pending이 아닌 sibling, explicit-file 입력은 검사한다.

#### Interface

- 제공: `changedContextFiles(repoRoot, base)`는 active pointer가 있으면 sibling 문서 중 frontmatter `bouncer.status === 'pending'`인 파일만 제외한다. status는 task bundle 대표값이 아니라 후보 문서마다 판정한다.
- 제공: `checkContextComments({ files })`의 explicit-file 경로는 기존처럼 전달된 context Markdown을 모두 검사한다.
- 거부: frontmatter가 없거나 파싱할 수 없거나 `bouncer.status`가 `pending`이 아닌 sibling을 pending으로 추정해 숨기지 않는다. 해당 파일은 검사 대상으로 남긴다.

#### Do not touch

- `scripts/src/lib/templates.ts` — scaffold 본문과 status 기본값은 바꾸지 않는다.
- `scripts/src/lib/current.ts` — active pointer 계약은 바꾸지 않는다.
- `.bouncer/context/epics/` — 검사 통과를 위해 sibling 계획 문서를 수정하지 않는다.

### Task 002

#### Goal & intent

기본 두 번의 review round 뒤에도 현재 task 정확성에 영향을 주는 actionable finding이 새로 발견되면, 기존 blocker·major 해결과 verify 통과 및 brief·scope 충족을 전제로 세 번째 round를 한 번 허용한다. review 기록은 finding의 위험 수용과 후속 이연을 분리하고 round 사이의 관계를 보존한다.

#### Interface

- 제공: `/bouncer-execute`는 첫 두 round 이후 기존 blocker·major가 모두 해결되고 verify가 통과했으며 신규 actionable finding이 Goal, Interface, Constraints, `affected_paths` 안에 있을 때만 세 번째 round를 한 번 실행한다. `/bouncer-run`은 이 상한과 중단 결과를 그대로 따른다.
- 제공: execute review finding status는 `resolved | accepted | deferred`다. `accepted`는 권한 있는 위험 수용, `deferred`는 현재 task와 독립적인 후속 planning 항목이며 둘 다 비어 있지 않은 `note`를 요구한다.
- 제공: `bouncer.review.rounds[]`가 있으면 각 항목은 양의 정수 `round`, 문자열 배열 `previous_finding_ids`, 0 이상의 정수 `new`·`resolved`·`regressed`를 가진다. reviewer 입력에는 이전 finding ID, 해결 방식, 수정 diff, 최신 verify 결과가 포함된다.
- 거부: G14는 context review finding의 `deferred`, note 없는 `accepted`·`deferred`, 음수 또는 비정수 집계, 중복·역순 round를 거부한다. reviewer와 controller는 현재 정확성에 영향을 주는 finding의 이연과 세 번째 round 뒤 추가 수정·재리뷰를 거부한다.

#### Do not touch

- `references/context-review/index.md` — context review는 기존 `resolved | accepted` 계약을 유지한다.
- `agents/bouncer-context-reviewer.md` — context review의 판정과 출력 계약을 넓히지 않는다.
- `.bouncer/config.json` — 새 정책 설정이나 retry 횟수 설정을 추가하지 않는다.