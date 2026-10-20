---
type: bouncer.explain
title: 001 explain
description: Explain for 001
resource: .bouncer/context/epics/intent-fence-guard/blueprints/intent-fence-guard/explain.md
tags:
  - bouncer
  - explain
timestamp: '2026-10-13T08:11:51.312+09:00'
bouncer:
  id: EXPLAIN-intent-fence-guard
  epic_id: intent-fence-guard
  blueprint_id: intent-fence-guard
  status: published
  comprehension:
    - range_from: f2450fbe16fb9f33f5b7455cb0ef3a1f0ab5c535
      range_to: 76020edeae267f8347a29b17180417ebcc19bf53
      diff_sha: 684529e40788a3f53aa78e3db85209162cb51db989a2032a62b36138373b5512
      recorded_at: '2026-10-13T08:12:00+09:00'
  task_commits:
    - task: intent-fence-guard/intent-fence-guard/001
      sha: 76020ede
      intent_anchor: task-001
---
# Explain

## Background

승인된 blueprint의 `## Intent`에 Mermaid·코드 펜스가 있으면 `parseIntentBody`가 펜스 줄을 문장으로 읽어 finalize 커밋 직전에 스택으로 터졌다. 이 변경은 펜스를 문장 집계에서 빼고, plan·finalize gate와 `finalize prepare`가 깨진 Intent를 `S33` 구조화 실패로 먼저 돌려주게 한다. `buildFinalizeCommitMessage`가 던지는 계약은 그대로 두고, 그 경로에 닿기 전에 막는다.

## Intuition

Intent는 문장만 남기고 다이어그램은 옆 절로 보낸다. 검사도 finalize 막판이 아니라 plan·finalize·prepare에서 같은 파서로 먼저 걸린다.

## Code

- `scripts/src/lib/templates.ts` — `parseIntentBody`: 불릿·공백을 벗긴 뒤 `` ``` ``/`~~~` 펜스 구간을 건너뛰고 문장만 모은다. 섹션 끝은 예전처럼 첫 `## ` 줄이다 펜스 추적보다 먼저 자른다.
- `scripts/src/lib/validate.ts` — `S33`: `gate`가 `plan` 또는 `finalize`이고 status가 `draft`가 아니며 `## Intent` 헤딩이 있을 때만 `parseIntentBody`를 돌린다. `GATE_FAILURE_HINTS`에 `next` 안내를 둔다.
- `scripts/src/lib/finalize-digest.ts` — `prepareFinalizeDigest`: 헤딩이 있는데 파싱이 깨지면 `{ ok: false, reason: 'validate', failures: [S33] }`(`next` 없음). 헤딩 부재는 예전처럼 `intent: []`.
- `rules/document-schema.md`, `references/spec-authoring/index.md`, `CHANGELOG.md` — Intent에 펜스를 두지 말 것과 `S33` 계약을 문서화한다.
- `test/intent-fence-guard.test.js` — 펜스 건너뛰기·gate 범위·prepare 실패 형태.

## Quiz

1. `parseIntentBody`가 `## Intent` 안의 코드 펜스를 만나면 어떻게 하는가?
   - (가) 펜스 줄과 안쪽 줄을 문장으로 집계한다.
   - (나) 펜스 구간을 건너뛰고 문장만 모은다.
   - (다) 펜스가 있으면 항상 오류를 던진다.
2. 검증 코드 `S33`이 나오는 gate는?
   - (가) `plan`과 `finalize`만 (`draft`가 아니고 `## Intent` 헤딩이 있을 때).
   - (나) `execute`와 `commit`만.
   - (다) 모든 gate.
3. `prepareFinalizeDigest`가 `## Intent` 헤딩은 있는데 내용이 깨진 blueprint를 만나면?
   - (가) `intent: []`로 조용히 통과한다.
   - (나) `{ ok: false, reason: 'validate', failures: [S33] }`을 돌려준다.
   - (다) 프로세스를 스택 트레이스로 종료한다.
4. `## Intent` 헤딩이 없는 blueprint에서 `S33`과 prepare Intent 처리는?
   - (가) plan·finalize가 `S33`을 내고 prepare도 실패한다.
   - (나) `S33` 대상이 아니고, prepare는 예전처럼 `intent: []`로 통과한다.
   - (다) execute gate만 `S33`을 낸다.

## Tasks

### intent-fence-guard/intent-fence-guard/001 · `76020ede`

#### Goal & intent

`## Intent` 아래 코드 펜스를 문장으로 읽지 않고, 올바르지 않은 Intent는 plan·finalize gate(`S33`), `finalize prepare`, `finalize`가 모두 `{ ok: false, reason: 'validate', failures }` 형태로 보고한다. 완료 판정은 epic 097 Success criteria 1~8이며, 최종 검증 명령은 `npm run ci`다.

#### Current behavior

- `parseIntentBody`(`scripts/src/lib/templates.ts:413`)는 주석을 지우고 `## Intent`부터 다음 `## `까지의 비지 않은 모든 줄을 불릿 표식만 벗겨 `normalizeAuthoredLines`에 넘긴다(`:417-431`). 펜스 처리가 없어 `graph TD` 같은 줄이 한국어 검사에서 `blueprint Intent must contain 1-2 Korean terminal sentences`로 던진다.
- `buildFinalizeCommitMessage`(`scripts/src/lib/finalize.ts:254-263`)는 `:258`에서 `parseIntentBody`를 try/catch 없이 호출하고, 유일한 호출 지점 `finalize()` `:1052`는 validate(`:1032-1033`)와 범위 검사(`:1047`) 뒤에 있다. 던진 오류는 `cmdFinalize`(`scripts/src/lib/cli-git-commands.ts:121-143`)에도 catch가 없어 스택 트레이스로 나온다.
- `prepareFinalizeDigest`(`scripts/src/lib/finalize-digest.ts:652-659`)는 같은 호출의 오류를 `intent = []`로 삼킨다. `finalize prepare`(`cli-git-commands.ts:64-79`)는 그래서 통과한다. `DigestFail`(`finalize-digest.ts:38-44`)에는 `failures` 필드가 없다.
- 실패 항목 형태는 `{ code, message, file }`이고 `next`는 `withGateFailureHints`가 `GATE_FAILURE_HINTS`(`scripts/src/lib/validate.ts:82-87` 부근)에서 병합한다. S 코드 중 `S33`은 비어 있고 최댓값은 `S32`다. `validateBlueprint`는 `docs.blueprintIndex.body`를 읽을 수 있으며(`validate.ts:226`), S8 검사(`:269-274`) 뒤에서 구조 검사를 돌린다.
- I/O 결합: `parseIntentBody`·`buildFinalizeCommitMessage`는 순수 함수다. `finalize()`는 `git`, `verifyExec`, `dependencyExec` 주입 지점을 갖는다(`finalize.ts:991`). `validateBlueprint` 본문 검사는 repoRoot 없이 docs만 쓰면 된다.
- 재현: 문장 한 줄 아래에 mermaid 블록을 둔 `## Intent` 본문을 `parseIntentBody`에 넣으면 위 오류가 난다. 기존 확인 테스트는 `test/finalize-pure.test.js:809-890`(문장 판정, 빈·누락 Intent)이고, `test/finalize-digest.test.js:647`은 깨진 YAML index에서 `intent`가 `[]`임을 단언한다(파싱 전 실패라 이 변경과 무관). `test/validate-hints.test.js:31`은 hint 코드 목록을 정확히 단언한다.
- 테스트는 빌드된 `scripts/lib/*`를 import하므로 `npm run build`가 먼저 필요하다.

#### Target behavior

성공 경로
- `parseIntentBody`는 펜스 줄과 펜스 안 줄을 집계에서 빼고, 남은 1–2개 문장이 한국어 종결형이면 그대로 돌려준다. 펜스가 없는 입력의 결과는 바뀌지 않는다.
- `validate --gate plan|finalize`는 올바른 Intent(펜스 포함)에 `S33`을 내지 않는다. 기존 043-005·060-001 index 본문도 `S33`을 받지 않는다.

실패 경로
- 펜스 밖 문장이 0개·3개 이상이거나 종결형이 아니거나 `## Intent`가 없으면 `parseIntentBody`는 기존 메시지로 던진다.
- blueprint `status`가 `draft`가 아니면 `validate --gate plan|finalize`는 그 오류를 `S33`(`file`: blueprint `index.md`, `next` 포함)로 보고한다. `## Intent` 헤딩이 없거나 `draft`이면 두 gate 모두 `S33`을 내지 않는다.
- `finalize prepare`는 `status`와 무관하게 `## Intent` 헤딩이 있고 내용이 깨진 Intent에서 `{ ok: false, reason: 'validate', failures: [S33] }`를 출력하고 종료 코드 1이다. 이 실패 항목에는 `next`가 없다. 헤딩이 없는 문서는 기존처럼 `intent: []`로 통과한다.
- `finalize()`는 올바르지 않은 Intent에서 finalize gate의 `S33`으로 `{ ok: false, reason: 'validate', failures }`를 돌려주고, 커밋 메시지 생성에 닿지 않아 스택 트레이스를 내지 않는다.

보존
- `buildFinalizeCommitMessage`·`normalizeAuthoredLines`·`parseIntentBody`의 던지는 계약과 메시지, task `commit_intent` 검사, 다른 gate 동작, 다른 `DigestFail` reason은 그대로다.

#### Interface

- 제공:
  - `parseIntentBody(body: unknown): string[]` — 시그니처 유지, 펜스 건너뛰기 추가.
  - 실패 항목 `{ code: 'S33', message: string, file: string }`, `message`는 `blueprint Intent invalid: <원 오류 메시지>`.
  - `GATE_FAILURE_HINTS`의 `{ code: 'S33', match: /blueprint Intent invalid/, next }`. `next`는 "`## Intent`에 한국어 종결 문장 1–2개만 두고 코드 펜스·다이어그램은 별도 `##` 헤딩으로 옮긴 뒤 gate를 다시 실행" 취지다.
  - `DigestFail.failures?: { code: string; message: string; file: string }[]` (`next` 없음).
- 거부(즉시 throw): `parseIntentBody`의 비문자열 body, 빈 Intent, 문장 3개 이상, 비한국어·비종결형 문장.
- 거부(실패 결과, throw 아님): `validate`의 `S33`, `finalize prepare`와 `finalize()`의 `reason: 'validate'`.
- 용어: **펜스 줄**은 불릿 표식(`-`, `*`, `+`)과 앞뒤 공백을 벗긴 뒤 `` ` `` 또는 `~`가 3개 이상 연속으로 시작하는 줄이다(예: `` ```mermaid ``). **닫는 펜스**는 같은 방식으로 불릿·공백을 벗긴 뒤 여는 펜스와 같은 문자(`` ` `` 또는 `~`)만으로, 여는 펜스 이상의 개수로 이루어진 줄이다(예: `` ``` ``). 뒤에 다른 글자가 있는 줄은 닫는 펜스가 아니다.

#### Touch

| 경로 | 심볼 | 변경 | 현재 책임 | 계획한 변경 | 근거 |
| --- | --- | --- | --- | --- | --- |
| `scripts/src/lib/templates.ts` | `parseIntentBody` | Modify | Intent 섹션의 모든 줄을 문장으로 집계 | 펜스 줄과 펜스 안 줄을 집계에서 제외 | 원인 지점(`:413-432`) |
| `scripts/src/lib/validate.ts` | `validateBlueprint`, `GATE_FAILURE_HINTS` | Modify | S8 등 구조 검사와 hint 병합 | plan·finalize gate에서 `S33` 추가, hint 행 추가 | docs.blueprintIndex 본문을 쓸 수 있는 지점(`:226`, `:269-274`) |
| `scripts/src/lib/finalize-digest.ts` | `prepareFinalizeDigest`, `DigestFail` | Modify | Intent 오류를 `[]`로 삼킴 | `S33` 실패로 반환, `failures` 필드 추가 | prepare가 통과하는 원인(`:652-659`) |
| `test/intent-fence-guard.test.js` | 신규 테스트 파일 | Create | 없음 | 파서·validate·prepare·finalize 시나리오 고정 | Intent 안 mermaid fixture 요구 |
| `test/finalize-digest.test.js` | digest fixture 본문(`:86`, `:308`, `:496`, `:849-852`) | Modify | 비한국어 Intent(`- digest input`, `- x`)로 `ok: true`를 기대 | Intent를 한국어 종결 문장으로 교체 | prepare가 깨진 Intent를 거절하게 되어 기존 fixture가 실패함. `:647`(깨진 YAML)은 파싱 전 실패라 변하지 않음 |
| `test/coordinator-e2e.test.js` | blueprint fixture 본문(`:492`, `:563`, `:951`) | Modify | 비한국어 Intent(`- release`, `- light inline drive`)로 finalize gate를 통과 | 한국어 종결 문장으로 교체 | approved fixture가 finalize gate의 `S33`을 받음 |
| `test/finalize-release-main.test.js` | blueprint fixture 본문(`:103`, `:114`, `:129`) | Modify | 비한국어 Intent(`- sibling`, `- close`)로 `finalize`를 실행 | 한국어 종결 문장으로 교체 | finalize gate의 `S33`을 받음 |
| `test/validate-hints.test.js` | hint 코드 목록 단언(`:31`) | Modify | hint 코드 목록을 정확히 단언 | 목록에 `S33` 추가 | 새 hint 행 때문에 목록이 달라짐 |
| `rules/document-schema.md` | blueprint Intent 규칙 단락(`:112-120`) | Modify | Intent를 1–2 한국어 문장으로 설명 | 펜스 건너뛰기와 `S33` 설명 추가 | 규칙의 정본 문서 |
| `references/spec-authoring/index.md` | blueprint 작성 규칙, 커밋 메시지 표(`:283-290`) | Modify | Intent 작성 규칙 | 다이어그램은 별도 헤딩에 둔다는 지침 추가 | 작성자가 보는 규칙 |
| `CHANGELOG.md` | `[Unreleased]` | Modify | 변경 기록 | 항목 추가 | 프로젝트 규칙 |

#### Constraints

- `buildFinalizeCommitMessage`·`normalizeAuthoredLines`는 계속 던진다. 변환은 호출하는 쪽(`finalize`, digest, validate)에서만 한다.
- `S33`은 `plan`·`finalize` gate에서만, blueprint `status`가 `draft`가 아니고 `## Intent` 헤딩이 있을 때만 낸다. `execute`·`commit`·`partial-close` gate는 바뀌지 않는다. 이 조건으로 draft·scaffold·헤딩 없는 fixture를 쓰는 기존 테스트를 보존한다. 그래도 위 Touch의 테스트 밖 파일이 깨지면 `affected_paths` 밖이므로 수정하지 말고 중단해 보고한다.
- `finalize()`와 `finalize.ts`는 바꾸지 않고, 다른 `reason` 값과 필드는 유지한다.
- 새 의존성이나 추상화 파일을 만들지 않는다. 펜스 판정은 `parseIntentBody` 안의 지역 로직으로 둔다.
- 테스트 이름은 `<조건> → <결과>` 형식이고 동작을 단언한다(`${BOUNCER_ROOT}/references/coding-standards/index.md`).
- 한국어 주석·docstring은 Summary/Args/Returns 기준을 따른다.