---
type: bouncer.explain
title: review-close-drive-efficiency explain
description: Explain for review-close-drive-efficiency
resource: .bouncer/context/epics/gates-review/blueprints/review-close-drive-efficiency/explain.md
tags:
  - bouncer
  - explain
timestamp: '2026-11-01T16:51:19.628+09:00'
bouncer:
  id: EXPLAIN-review-close-drive-efficiency
  epic_id: gates-review
  blueprint_id: review-close-drive-efficiency
  status: published
  comprehension:
    - range_from: 08a38e35c96b15c92e58cb5c2872fcc05b974b99
      range_to: eddf2d13ceb7eab545c0d3d0fa337606b02e6036
      diff_sha: f769792343e1a6c613d733bfa020c5293dabfcd640f70a5a345aa93d2c64971d
      recorded_at: '2026-11-01T16:51:57.007+09:00'
  task_commits:
    - task: gates-review/review-close-drive-efficiency/001
      sha: 49b5e12a
      intent_anchor: task-001
    - task: gates-review/review-close-drive-efficiency/002
      sha: dc9d0bc7
      intent_anchor: task-002
    - task: gates-review/review-close-drive-efficiency/003
      sha: 65da250e
      intent_anchor: task-003
    - task: gates-review/review-close-drive-efficiency/004
      sha: c7b89d14
      intent_anchor: task-004
    - task: gates-review/review-close-drive-efficiency/006
      sha: eddf2d13
      intent_anchor: task-006
---
# Explain

## Background

리뷰한 계약이 변경되면 변경 문서와 위험 수용 판단을 연결해 종결 근거를 남겨야 한다. 한국어 종결형 검사에서 발생하던 오탐과 드라이브 조회의 반복도 줄인다.

## Code

`packages/cli/src/context-review-state.ts`는 계약 변경 링크를 검증하고 수용 기록을 남긴다. 링크한 finding은 현재 close의 처분에서 `accepted`여야 하며, 거절 시 문서는 바뀌지 않는다. 계약 비교는 task 문서의 `scope_parts` 묶음 단위이므로 같은 문서 안의 무관한 변경까지 함께 수용될 수 있다.

`packages/cli/src/templates.ts`는 한국어 문장의 개수와 형식을 검사하되 특정 종결형은 요구하지 않는다. `cli-intent-command.ts`는 reviewer의 여러 task 조회를 처리하고, `coordinate-advance.ts`는 종료 결과에 상태를 포함한다. 상태 조회에 실패하면 `advance-status-unavailable`과 실행된 단계 목록을 반환한다.

표식 불일치 테스트는 restart 중단 상태를 직접 구성한다. 작업 003의 구현 전 테스트 실행 기록은 없으며, 기준 커밋에서의 사후 재현만 존재한다. 최종 검증 증거는 `a2eac4d3921c149a7e4ba8d1cc4d3950dd4bd4d595737e0169e8d8acbaf0c6ee`, 리뷰 기록은 `review.md`에 있다.

## Quiz

1. 계약 변경 링크의 finding은 현재 close의 처분에서 어떤 상태여야 하나요?
   - A) `accepted`
   - B) `open`
   - C) 처분에 없어도 됨

2. 여러 `--task`를 함께 사용하는 `intent sections` 호출에서 지원하는 역할은 무엇인가요?
   - A) `implementer`
   - B) `reviewer`
   - C) `debugger`

3. `coordinate advance`가 종료 시 상태를 읽지 못하면 어떤 결과를 반환하나요?
   - A) 빈 상태를 포함한 성공
   - B) 실행된 단계 목록을 버린 실패
   - C) `advance-status-unavailable`과 실행된 단계 목록

## Tasks

### gates-review/review-close-drive-efficiency/001 · `49b5e12a`

#### Goal & intent

리뷰 후 Interface/Touch 계약을 고친 계획이 delta 라운드를 다 쓴 뒤에도, 사용자가 위험을 명시적으로 수용한 변경에 한해 추적 가능하게 close되어야 한다.

#### Current behavior

`closeCycle`은 현재 snapshot digest가 baseline과 다르면 문서 집합·`structure_parts`·`scope_parts`가 모두 같은 본문 수정만 인증하고, 나머지는 `context-review-state-conflict`로 거절한다(`packages/cli/src/context-review-state.ts:572-583`). 계약(Interface/Touch) 변경은 delta 라운드로만 닫히므로 delta 이후 계약이 또 바뀌면 close할 방법이 없다.

#### Target behavior

`context-review close`에 `--contract-links <json-file>` 플래그를 더한다. 파일은 `[{ "finding_id": "CR-<8hex>", "path": "<저장소 상대 경로>", "sections": ["Interface", "Touch"] }]` 배열이다.
- `scope_parts`는 `tasks/<NNN>/tasks.md`에만 있으므로(`packages/cli/src/plan-snapshot.ts:109`) `path`는 `tasks/<NNN>/tasks.md`로 끝나는 해당 blueprint task 문서의 정규화된 저장소 상대 전체 경로만 허용한다. epic·blueprint `index.md`의 계약 변경은 링크할 수 없고 거절된다.
- 계약 digest가 baseline과 다르고 구조(`structure_parts`·문서 집합)가 같을 때, `scope_parts[path]`가 baseline과 달라진 모든 문서가 링크에 있어야 한다. 각 링크의 `finding_id`는 (a) `--accept-risk`에 있고 (b) 이 cycle의 `must_fix` finding이며 (c) 이 close의 dispositions에서 `accepted`이고 (d) finding의 `file`이 링크의 `path`와 같아야 한다. 하나라도 어긋나면 거절한다. 검사 순서는 구조·scope 대조 → 링크 형식 → `projectClosure`(accept-risk 대상 검증) → 링크와 처분 대조이며, cycle에 없는 `finding_id`는 링크 형식 검사에서 `context-review-input-invalid`로 거절한다. 기존 advisory finding을 `--accept-risk`에 넣으면 `projectClosure`가 `context-review-unresolved-findings`로, (a)(c)(d)는 `context-review-state-conflict`로 거절한다.
- 비교 단위는 `scope_parts[path]`(해당 task 문서의 Interface·Touch·`affected_paths`·`depends_on` 묶음 해시)다. 같은 문서 안의 무관한 계약 변경은 기계적으로 구분할 수 없으므로 링크한 문서의 이 묶음 전체가 재검토 없이 수용된다. `sections`는 수용 범위를 사람에게 설명하는 기록용이며 digest 단위를 바꾸지 않는다.
- close 성공 시 closure 원장 `closure.contract_acceptances`와 `context-review.md`의 `bouncer.context_review.contract_acceptances`에 `[{ finding_id, path, sections, before_digest, after_digest }]`를 쓰고, 두 곳과 close 결과 JSON의 최상위에 `accepted_without_rereview: true`(frontmatter는 `bouncer.context_review.accepted_without_rereview`)를 쓴다. `before_digest`는 baseline의 `scope_parts[path]`, `after_digest`는 현재 값이다. disposition 파일 형식은 바꾸지 않는다.
- 전이 키에는 `--contract-links` 원본 바이트의 sha256을 더한다. 수용 뒤 계약이 또 바뀌면 baseline은 여전히 리뷰한 원본이므로 새 링크로 다시 close해야 한다.
- `--contract-links`가 없는 close(변경 없음 또는 본문만 변경)는 기존 동작을 그대로 유지한다.

#### Interface

- 제공: `bouncer context-review close --blueprint <dir> --dispositions <json> --accept-risk <ids> --contract-links <json-file>`.
- 거부 `context-review-input-invalid`: 링크 파일을 읽을 수 없거나 JSON이 아님; 배열이 아님; 필드 누락; `sections`가 `Interface`/`Touch` 밖; `finding_id`가 cycle에 없음; `path`가 해당 blueprint의 `tasks/<NNN>/tasks.md`로 끝나는 저장소 상대 전체 경로가 아니거나 정규화되지 않음(`..`·`./`·절대 경로·백슬래시); 같은 `path` 중복; `scope_parts`가 바뀌지 않은 문서에 대한 링크.
- 거부 `context-review-state-conflict`: 구조 변경; 링크 없이 또는 링크되지 않은 문서의 계약 변경(`--contract-links` 없는 기존 cycle 포함, 링크가 빈 배열인 경우 포함); 링크한 `finding_id`가 `--accept-risk`에 없음; `finding.file`이 링크 `path`와 다름; 링크한 finding이 이 close에서 `accepted`가 아님. advisory(`must_fix`가 아닌) finding을 `--accept-risk`에 넣으면 기존 `context-review-unresolved-findings`로 거절되며, advisory만으로는 계약 변경을 close할 수 없다.
- 거절 시 state·closure·`context-review.md`는 바뀌지 않는다.
- `--contract-links`는 `close`에서만 유효하고 다른 verb에서는 `--contract-links is only valid for close`로 거절한다.

#### Touch

| 경로 | 심볼 | 변경 | 현재 책임 | 계획한 변경 | 근거 |
| --- | --- | --- | --- | --- | --- |
| `packages/cli/src/context-review-state.ts` | `closeCycle` | Modify | 계약 변경 close를 거절한다 | 링크·동의 검증과 계약 수용 기록 | `packages/cli/src/context-review-state.ts:572-583` |
| `packages/cli/src/context-review-transitions.ts` | `sameStructureAndScope`·`compareShape` | Modify | 구조와 scope 동일 여부만 판정한다 | 구조 동일·scope 상이를 구분해 문서별 변경 경로를 돌려준다 | `packages/cli/src/context-review-transitions.ts:190-214` |
| `packages/cli/src/context-review-transitions.ts` | closure 기록 | Modify | closure에 `accept_risk`·digest만 쓴다 | `contract_acceptances`를 closure에 담는다 | `packages/cli/src/context-review-transitions.ts:332-356` |
| `packages/cli/src/context-review-contracts.ts` | `Closure` | Modify | closure 형식 정의 | `contract_acceptances` 필드 추가 | `packages/cli/src/context-review-contracts.ts:23` |
| `packages/cli/src/context-review-store.ts` | closure 읽기·쓰기 | Modify | closure 검증 | 새 필드를 보존하고 형식을 검증한다 | `packages/cli/src/context-review-store.ts:430` |
| `packages/cli/src/context-review-projection.ts` | `context-review.md` 투영 | Modify | `closure_target_digest`를 frontmatter에 쓴다 | 수용 기록과 `accepted_without_rereview`를 쓴다 | `packages/cli/src/context-review-projection.ts:139` |
| `packages/cli/src/cli-context-review-command.ts` | `close` 인자·`HELP` | Modify | `--dispositions`·`--accept-risk`만 받는다 | `--contract-links` 파싱과 예시 | `packages/cli/src/cli-context-review-command.ts:207-222,275-279` |
| `packages/cli/src/cli-usage.ts` | `context-review` 사용법 | Modify | close 사용법 | 새 플래그 설명 | `packages/cli/src/cli-usage.ts:23-29` |
| `skills/bouncer-plan/references/context-review.md` | close 절차 | Modify | 계약 변경은 delta·restart로만 처리한다고 안내한다 | delta 소진 뒤 링크·동의로 close하는 절차와 범위 고지 | `skills/bouncer-plan/references/context-review.md:151-162,245-247` |
| `references/context-review/index.md` | close 행동 설명 | Modify | 리뷰 종결 규칙 | 수용 기록과 재검토 없는 수용을 서술 | `references/context-review/index.md:96` |
| `rules/cli.md` | `context-review close` 설명 | Modify | close가 `--dispositions`·`--accept-risk`만 받는다고 적는다 | `--contract-links`와 거절 코드 서술 | `rules/cli.md:684` |
| `rules/document-schema.md` | `context-review.md` 형식 | Modify | frontmatter 필드 정의 | `bouncer.context_review.contract_acceptances`·`accepted_without_rereview` | `rules/document-schema.md:72` |
| `agents/bouncer-plan-coordinator.md` | close 위임 문구 | Modify | root가 close를 실행한다고 적는다 | 필요 시 root가 쓸 링크 파일 안내 | `agents/bouncer-plan-coordinator.md:79-80` |
| `.codex/agents/bouncer-plan-coordinator.toml` | 생성본 | Modify | agents 문서에서 생성 | 재생성해 동기화 | epic Success criteria 23 |
| `test/context-review-state.test.js` | 새 close 계약 테스트 | Create | 없음 | 아래 계약 단언 | Checklist |
| `test/skill-context-review.test.js` | 리뷰 절차 문구 | Modify | close 절차 문구 검증 | 새 플래그·고지 문구 | `test/skill-context-review.test.js:1` |
| `test/skill-bouncer-surface.test.js` | 경로 리터럴 | Modify | 문서 경로 참조 검증 | 바뀐 문서와 맞춤 | `test/skill-bouncer-surface.test.js:72,288` |
| `test/tiers.json` | tier 등록 | Modify | 테스트 tier 목록 | 새 테스트 파일 등록 | epic Success criteria 26 |

#### Constraints

- 기존 cycle에 `--contract-links`가 없으면 계약 변경은 계속 거절하고, 변경 없는 close의 결과는 바뀌지 않는다.
- 수용은 close 한 번의 원자적 동작이다. 어느 검증이든 실패하면 state·closure·`context-review.md`를 바꾸지 않는다.
- 재검토 없이 수용된다는 사실은 close 결과 JSON에도 `accepted_without_rereview: true`로 나온다.

### gates-review/review-close-drive-efficiency/002 · `dc9d0bc7`

#### Goal & intent

정상적인 한국어 문장이 `…나눔.`처럼 허용 목록 밖 어미로 끝났다는 이유만으로 plan과 commit에서 거절되지 않아야 한다.

#### Current behavior

`normalizeAuthoredLines`는 빈 문장·줄바꿈·한글 부재와 함께 허용 어미 정규식(`packages/cli/src/templates.ts:378-380`)을 검사한다. plan gate의 S34(`packages/cli/src/validate.ts:352-379`)와 `bouncer commit`(`packages/cli/src/commit-message.ts:70-71`), blueprint Intent(S33, `parseIntentBody`)가 이 함수를 공유해 같은 오탐을 낸다. S32는 목록 형태와 0–2개 문자열만 본다(`packages/cli/src/schema.ts:293-297`).

#### Target behavior

`normalizeAuthoredLines`에서 허용 어미 정규식 검사 한 줄만 제거한다. S34 코드와 `validate.ts`의 호출은 남아, 이제 빈 문장·줄바꿈·한글 부재·원소 수 위반만 거절한다. 어미가 허용 목록 밖인 문장은 plan gate, `bouncer commit`, S33 모두에서 통과하고 commit 본문에 원문이 그대로 실린다.

#### Interface

- 제공: 종결형 정규식이 없는 `normalizeAuthoredLines(raw, field)`. 반환은 트림된 문장 배열이다.
- 유지(거부): 목록이 아닌 값(`must be a YAML list of 1-2 Korean sentences`), 문자열이 아닌 원소, 3개 이상, 빈 문장, 줄바꿈, 한글 없는 문장은 기존처럼 거절한다. `[]`와 필드 부재는 작성 전 scaffold로 통과하고 `commit_*` 본문이 비는 것도 지금과 같다.
- 오류 메시지의 "terminal sentences"·"(한국어 종결 문장)" 표현은 "Korean sentences"·"(한국어 문장)"으로 바꾼다. 거절 코드(`S34`, `S33`, `commit`의 기존 reason)는 바뀌지 않는다.

#### Touch

| 경로 | 심볼 | 변경 | 현재 책임 | 계획한 변경 | 근거 |
| --- | --- | --- | --- | --- | --- |
| `packages/cli/src/templates.ts` | `normalizeAuthoredLines` | Modify | 빈 문장·줄바꿈·한글·종결형을 검사한다 | 종결형 정규식 제거와 메시지 정리(S33 메시지 `templates.ts:436` 포함) | `packages/cli/src/templates.ts:351-384,436` |
| `packages/cli/src/templates.ts` | scaffold 주석 본문 | Modify | "1~2개의 한국어 종결 문장" 안내 | 종결 문장 표현 제거 | `packages/cli/src/templates.ts:238` |
| `packages/cli/src/validate.ts` | S34 블록 주석·next 힌트 | Modify | "종결어미 판정" 설명과 종결형을 언급하는 next 문구 | 형식 검사 설명으로 정정(코드는 유지) | `packages/cli/src/validate.ts:98,106,115,352-356` |
| `packages/cli/src/schema.ts` | `isValidAuthoredLineList` 주석 | Modify | "한국어 종결형은 커밋 때 판정" 주석 | 주석 정정 | `packages/cli/src/schema.ts:288` |
| `packages/cli/src/scaffold.ts` | scaffold 주석 | Modify | "한국어 종결형을 그때 검사" 주석 | 주석 정정 | `packages/cli/src/scaffold.ts:351` |
| `packages/cli/src/validate-structural.ts` | S32 주석 | Modify | "한국어 종결형은 커밋 정규화가 맡는다" 주석 | 주석 정정 | `packages/cli/src/validate-structural.ts:323` |
| `rules/document-schema.md` | S34 설명 | Modify | 종결 어미 실패 예시를 든다 | S34가 보는 항목에서 종결형 제거 | `rules/document-schema.md:165,167,168,175,182` |
| `skills/bouncer-plan/SKILL.md` | 작성 안내 | Modify | 종결 문장 안내 | "한국어 문장"으로 정정 | `skills/bouncer-plan/SKILL.md:252,254` |
| `references/spec-authoring/index.md` | commit 필드 작성 규칙 | Modify | "종결 문장"과 S34 안내 | 종결형 표현 제거 | `references/spec-authoring/index.md:41,57,59,71,345,349,354,360` |
| `test/commit-sentence-gate.test.js` | 문장 게이트 테스트 | Modify | 종결형 거절을 단언한다 | 종결형 통과·나머지 거절 경계 단언 | `test/commit-sentence-gate.test.js:87,102` |
| `test/skill-bouncer-surface.test.js` | 경로 리터럴 | Modify | 문서 경로 참조 검증 | 문서 변경과 맞춤 | `test/skill-bouncer-surface.test.js:72,287,291` |
| `test/doc-shape-cli.test.js` | 문서 형식 테스트 | Modify | `skills/bouncer-plan/SKILL.md` 참조 검증 | 문구 변경과 맞춤 | `test/doc-shape-cli.test.js:353` |

#### Constraints

- 종결형 때문에 S34를 기대하던 기존 단언을 뒤집는다: `test/commit-sentence-gate.test.js:87`(plan gate에서 `['커밋 구간을 일치시킴.']`이 S34)은 S34 없음으로, `:102`(`commit_summary`만 잘못된 경우 S34 하나)는 `commit_summary: ['']`(빈 문장)을 입력으로 바꿔 같은 단언 구조를 유지한다. 두 테스트 제목은 각각 `commit_intent with previously disallowed ending on plan gate → no S34`, `only commit_summary empty on plan gate → exactly one S34 for commit_summary`로 바꾼다.
- 이 task는 `packages/cli/src/commit-message.ts`를 수정하지 않는다. 공통 함수가 바뀌므로 commit 쪽 동작은 테스트로만 확인한다.
- S32 목록 형태와 0–2개, 빈 항목·줄바꿈 거절, 한글 포함 요건, 원소 수 1–2는 그대로다.
- S33 blueprint Intent는 같은 공통 함수를 쓰므로 종결형을 더 이상 검사하지 않는다. 이 변화는 의도된 것이다.
- 과거 blueprint 문서는 수정하지 않는다.

### gates-review/review-close-drive-efficiency/003 · `65da250e`

#### Goal & intent

한 drive에서 coordinator 세션이 길어지는 것과 같은 상태를 CLI로 반복 조회하는 비용을 줄인다.

#### Current behavior

`coordinator.waves_per_session`의 `"auto"`·부재 상한은 4다(`packages/cli/src/config.ts:107,425-438`). `coordinate advance`는 `{ ok, executed, stop }`만 돌려줘(`packages/cli/src/coordinate-advance.ts:33-37`) 후속 판단마다 `coordinate status`를 따로 부른다. reviewer 입력은 task마다 `bouncer intent sections --task <path> --role reviewer`를 한 번씩 부른다(`skills/bouncer-run/references/review-round.md:16,60,155`).

#### Target behavior

1. `"auto"`와 부재의 상한을 2로 낮춘다. 명시한 정수 1–8은 그대로다. `benchmarks/` 아래 과거 측정 문서가 4를 말하는 것은 역사 기록이라 고치지 않는다.
2. `coordinate advance` 성공 응답(`ok: true`)에 `status` 필드를 더한다. 값은 advance 종료 시점의 `coordinate status`와 같은 객체다. `AdvanceDeps`에 `status`(읽기) 의존을 더해 테스트가 실패를 주입할 수 있게 한다(기본값은 실제 `coordinate status` 구현).
3. `status`를 읽지 못하면 `ok: false`, `reason: advance-status-unavailable`을 돌려주고, 이미 실행한 단계를 호출자가 다시 돌리지 않도록 `executed`를 응답에 그대로 싣는다.
4. `bouncer intent sections --role reviewer`가 `--task`를 여러 번 받는다. 둘 이상이면 `{ ok: true, tasks: [{ task, sections }] }`를 인자 순서대로 돌려준다. 일부가 실패하면 task마다 검사한 뒤 `ok: false`, `reason: intent-sections-partial`, `failures: [{ task, reason }]`, 그리고 성공한 task를 `tasks`에 함께 싣고 종료 코드 1로 끝낸다. 같은 `--task` 경로가 중복되면 첫 번째만 처리하고 중복은 `failures`에 `intent-task-duplicate`로 올린다. `--task`가 하나면 응답은 지금과 완전히 같다.

#### Interface

- 제공: `coordinator.waves_per_session` 자동 기본 2; `advance` 성공 응답의 `status`; 실패 `advance-status-unavailable`; `intent sections --task <p1> --task <p2> --role reviewer`의 `tasks[]`·`failures[]` 응답.
- 유지: 명시 wave 값의 유효 범위(1–8)와 거절 코드, `coordinate status`·`intent sections --task` 단일 호출의 응답과 종료 코드, `advance`의 기존 실패 응답.
- 변경(거부): `--role`이 reviewer가 아닌데 `--task`가 둘 이상이면 지금의 파서 오류(`duplicate option: --task`, 종료 코드 2) 대신 `intent-task-invalid`, 종료 코드 1로 거절한다. 이는 의도된 변경이다.

#### Touch

| 경로 | 심볼 | 변경 | 현재 책임 | 계획한 변경 | 근거 |
| --- | --- | --- | --- | --- | --- |
| `packages/cli/src/config.ts` | `AUTO_WAVES_PER_SESSION` | Modify | 자동 상한 4 | 2로 변경하고 주석의 "그 절반인 4"를 정정 | `packages/cli/src/config.ts:105-107,425-438` |
| `packages/cli/src/coordinate-advance.ts` | `AdvanceOk`·반환 지점 | Modify | `executed`와 `stop`만 반환 | `status`를 읽어 성공 응답에 포함 | `packages/cli/src/coordinate-advance.ts:33-37,281-297` |
| `packages/cli/src/cli-intent-command.ts` | `intent sections` 인자·실행 | Modify | `--task` 하나만 받는다 | `--task` 반복과 `tasks[]` 응답 | `packages/cli/src/cli-intent-command.ts:288-296` |
| `packages/cli/src/cli-usage.ts` | `coordinate advance`·`intent sections` 사용법 | Modify | 사용법 문자열 | `status` 필드와 반복 `--task` 설명 | `packages/cli/src/cli-usage.ts:17,20` |
| `docs/configuration.md` | `waves_per_session` 행 | Modify | "상한 4" | "상한 2" | `docs/configuration.md:21` |
| `rules/cli.md` | coordinate·intent 설명 | Modify | advance 응답·상한 설명 | 새 필드·플래그 서술 | `rules/cli.md:202,260,500` |
| `skills/bouncer-run/references/review-round.md` | reviewer 입력 수집 | Modify | task마다 `intent sections`를 부른다 | 여러 task는 한 번에 부르도록 안내 | `skills/bouncer-run/references/review-round.md:16,60,155` |
| `skills/bouncer-run/references/agent-dispatch.md` | 입력 수집 안내 | Modify | role별 단일 호출 안내 | reviewer 일괄 호출 안내 | `skills/bouncer-run/references/agent-dispatch.md:9,55` |
| `agents/bouncer-coordinator.md` | advance 후속 판단 | Modify | advance 뒤 `coordinate status`를 다시 부른다 | 응답의 `status`를 쓰도록 정정 | `agents/bouncer-coordinator.md:257,313` |
| `.codex/agents/bouncer-coordinator.toml` | 생성본 | Modify | agents 문서에서 생성 | 재생성해 동기화 | epic Success criteria 23 |
| `test/coordinate-advance.test.js` | advance status 테스트 | Create | 없음 | `status` 포함·실패 응답 불변 단언 | Checklist |
| `test/intent-bundle.test.js` | 일괄 입력 테스트 | Create | 없음 | `tasks[]`·실패 보존·단일 호출 불변 단언 | Checklist |
| `test/config-help.test.js` | wave 기본값 테스트 | Create | 없음 | auto·부재는 2, 명시값 유지, 문서 일치 | Checklist |
| `test/skill-bouncer-run.test.js` | drive 문서 계약 | Modify | drive 절차 문구 검증 | 새 호출 안내 검증 | `test/skill-bouncer-run.test.js:84` |
| `test/tiers.json` | tier 등록 | Modify | 테스트 tier 목록 | 새 테스트 3개 등록 | epic Success criteria 26 |

#### Constraints

- 명시한 `waves_per_session`의 유효 범위와 값, 잘못된 값의 거절 동작은 바꾸지 않는다.
- 단일 `--task` 호출과 `coordinate status` 단독 호출의 응답은 바이트 단위로 같다.
- 실패를 숨기지 않는다: `advance`가 `status`를 읽지 못하면 `ok: true`에 `status`를 비우지 않고 `advance-status-unavailable`로 실패하며 `executed`를 싣는다. 이는 새 실패 사례이고 기존 실패 응답은 바뀌지 않는다.

### gates-review/review-close-drive-efficiency/004 · `c7b89d14`

#### Goal & intent

긴 root 세션이 누적되지 않도록 drive 이후 단계(finalize)와 다음 plan을 새 세션에서 시작하라고 안내하고, 최종 사용량 기록 규칙이 handoff에서 지켜지는지 테스트로 고정한다.

#### Current behavior

`skills/bouncer-run/SKILL.md`는 drive 종료 뒤 새 세션에서 `/bouncer-finalize`를 시작하라는 안내가 없다. 최종 알림을 받은 뒤 한 번만 `metrics end`를 부르는 host별 규칙은 이미 `skills/bouncer-run/references/drive-metrics.md:28-40`에 있고, `skills/bouncer-run/SKILL.md:106-108,191`이 이를 가리킨다.

#### Target behavior

- `skills/bouncer-run/SKILL.md`의 drive 종료 안내와 `skills/bouncer-finalize/SKILL.md` 시작부에 "컨텍스트가 길어졌다면 새 세션에서 /bouncer-finalize를 시작한다."를 쓴다.
- `skills/bouncer-plan/SKILL.md`의 plan 종료 안내에 "/bouncer-run은 새 세션에서 시작한다."를 쓴다.
- `drive-metrics.md`는 수정하지 않는다. 대신 `skills/bouncer-run/SKILL.md`가 `metrics end`를 중간 알림 값이 아니라 최종 알림 이후에만 부른다고 `drive-metrics.md`의 host 표를 가리키는지 테스트로 고정한다.
- 새 문장은 고정 리터럴이며 테스트가 같은 문자열을 단언한다: run·finalize는 `컨텍스트가 길어졌다면 새 세션에서 /bouncer-finalize를 시작한다.`, plan은 `/bouncer-run은 새 세션에서 시작한다.`

#### Interface

- 제공: 세 skill 문서의 새 세션 안내 문장, 그리고 `metrics end` 시점을 고정하는 문서 테스트.
- 거부: `drive-metrics.md`는 이 task의 쓰기 범위가 아니다. 최종 알림이 없는 host는 지금처럼 token 없이 missing으로 종료한다.

#### Touch

| 경로 | 심볼 | 변경 | 현재 책임 | 계획한 변경 | 근거 |
| --- | --- | --- | --- | --- | --- |
| `skills/bouncer-run/SKILL.md` | drive 종료 안내 | Modify | 종료 뒤 다음 단계 안내가 없다 | 새 세션에서 finalize 시작을 안내 | `skills/bouncer-run/SKILL.md:106-108,191` |
| `skills/bouncer-finalize/SKILL.md` | 시작부 안내 | Modify | 새 세션 권고 없음 | 새 세션 권고 문장 | `skills/bouncer-finalize/SKILL.md` |
| `skills/bouncer-plan/SKILL.md` | plan 종료 안내 | Modify | `/bouncer-run`을 가리킨다 | 새 세션 권고 추가 | `skills/bouncer-plan/SKILL.md:381` |
| `test/skill-bouncer-run.test.js` | workflow 계약 | Modify | drive 문서 계약 검증 | 새 세션 안내와 `metrics end` 시점 단언 | `test/skill-bouncer-run.test.js:84` |
| `test/skill-bouncer-finalize.test.js` | finalize 문서 계약 | Modify | finalize 문서 계약 검증 | 새 세션 안내 단언 | `test/skill-bouncer-finalize.test.js` |

#### Constraints

- 이미 있는 host별 사용량 규칙(`drive-metrics.md`)을 중복해서 바꾸지 않는다. handoff에서 규칙이 어긋나는 곳이 확인될 때만 그 문장을 맞춘다.
- 중간 알림 값으로는 `metrics end`를 부르지 않고, 최종 알림이 없는 host의 missing 종료는 유지한다.

### gates-review/review-close-drive-efficiency/005

#### Goal & intent

모든 구현 task 통합 후 저장소 전체 CI가 통과함을 확인한다.

#### Interface

- 제공: 구현 task가 모두 통합된 뒤 전체 검증 명령을 한 번 실행해 남기는 종단 검증 증적. 구현 task는 각자 task 전용 명령만 갖는다.
- 거부: source 변경, review 문서, commit.

#### Touch

Source 변경 경로 없음.

### gates-review/review-close-drive-efficiency/006 · `eddf2d13`

#### Goal & intent

최종 리뷰 finding을 수정한다.

- SPEC-001 (major, spec_scope, must_fix) — packages/cli/src/context-review-state.ts#closeCycle — tasks/001 target behavior
- CT-001 (major, correctness_tests, must_fix) — test/context-review-state.test.js#Red run — tasks/001 checklist
- CT-003 (major, correctness_tests, must_fix) — test/coordinate-advance.test.js#Red run — tasks/003 checklist

#### Interface

- 제공: 기록된 리뷰 finding을 해소하는 최소 수정
- 거부: Blueprint 밖 scope와 새 기능

#### Touch

- Modify `packages/cli/src/context-review-state.ts` — 기록된 리뷰 finding을 수정한다.
- Modify `test/context-review-state.test.js` — 기록된 리뷰 finding을 수정한다.
- Modify `test/coordinate-advance.test.js` — 기록된 리뷰 finding을 수정한다.

#### Constraints

- 원장의 실패 증적과 repair 결정 범위만 따른다.