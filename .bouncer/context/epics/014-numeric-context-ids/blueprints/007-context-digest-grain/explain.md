---
type: bouncer.explain
title: 001 explain
description: Explain for 001
resource: .bouncer/context/epics/014-numeric-context-ids/blueprints/007-context-digest-grain/explain.md
tags:
  - bouncer
  - explain
timestamp: '2026-08-25T10:25:24.681+09:00'
bouncer:
  id: EXPLAIN-007
  epic_id: '014'
  blueprint_id: '007'
  status: published
  comprehension:
    - range_from: develop
      range_to: fb556fcaa875c836ffd11f045825b294f1f5d94f
      diff_sha: c3a8ecb5faa896716c5cd03f4a02b071b56a52f6357f8e8bab3de823dd61132c
      quiz_score: 3/3
      disposition: all three answers correct; whitelist headings, task-path gate, and map.json remap understood
      recorded_at: '2026-08-25T10:28:04+09:00'
---
# Explain

## Background
047의 brief 주입 작업이 context 그래프에서 계약·구현 어휘를 찾으려다 fail-skip으로
끝났다. 원인은 재빌드 누락이 아니라 `digestRulesFor` 화이트리스트였다. Distill
`## Decisions`, epic `## Success criteria`, BP `explain.md` 세 섹션만 파생 트리에
들어가고, blueprint `index.md`의 `## Intent` / `## Contract`와 task
`tasks/<NNN>/tasks.md`의 `## Goal & intent` / `## Interface`는 통째로 빠졌다.
재빌드 후 파생 파일은 103개 / 158044바이트, 노드 308개, `derived-leak` 0이었다.
047이 남긴 질의어(`presentCurrent pointer payload scale`,
`execute task brief scope_evidence injection`)는 각각 10노드를 돌려줬다.

## Intuition
계약서와 작업지시서만 검색 색인에 넣고, 실행 기록(verification/review)과 구형
task 파일명은 그대로 빼 둔다.

## Code
- `scripts/src/lib/context-digest.ts` — `digestRulesFor`에 blueprint `index.md`
  갈래와 `TASK_DIR_RE` + `TASK_UNIT_BASENAMES[0]`로 판정하는 task 브리프 갈래를
  추가한다. CJS emit은 `scripts/lib/context-digest.js`.
- `test/context-digest.test.js` — 허용·거절 경로와 `map.json` 원본 경로 단언.
- `test/session-graph.test.js` — 빈 digest 픽스처 주석만 고친다(단언 유지).
- `docs/configuration.md`, `docs/ARCHITECTURE.md` — 화이트리스트 목록을 코드와
  같은 순서·헤딩으로 맞춘다.

## Quiz
1. `digestRulesFor`가 blueprint `index.md`에서 뽑는 헤딩은?
   - A) `## Background` / `## Intuition` / `## Code`
   - B) `## Intent` / `## Contract`
   - C) `## Goal & intent` / `## Interface`

2. task 경로가 화이트리스트에 들어가려면 무엇이 필요한가?
   - A) basename이 `tasks.md`이기만 하면 된다
   - B) `tasks/<세 자리>/tasks.md`이고 `TASK_DIR_RE`·`TASK_UNIT_BASENAMES[0]`를
     통과해야 한다
   - C) `tasks-001.md` 같은 구형 루트 파일도 포함한다

3. 파생 트리에 올라간 노드의 `source_file`은 어디에 남는가?
   - A) `graphify-out/context-src/` 아래 파생 이름
   - B) `map.json` remapping 뒤 저장소-상대 원본 경로
   - C) Distill 샤드 상대 경로

## 이해 상태
- 점수: 3/3
- Q1 정답 B / 응답 B — 맞음 (`## Intent` / `## Contract`)
- Q2 정답 B / 응답 B — 맞음 (`TASK_DIR_RE` + `TASK_UNIT_BASENAMES[0]`)
- Q3 정답 B / 응답 B — 맞음 (`map.json` 원본 경로 remap)
- disposition: 화이트리스트 헤딩·task 경로 판정·remap 계약을 모두 이해함

## Tasks

### Task 001

#### Goal & intent

`digestRulesFor`가 blueprint `index.md`의 `## Intent` / `## Contract`와 task
`tasks/<NNN>/tasks.md`의 `## Goal & intent` / `## Interface`를 파생 트리로
뽑는다. 그 결과 재빌드한 context 그래프에서 계약 어휘와 구현 어휘가 조회되고,
모든 히트는 여전히 저장소-상대 원본 경로를 가리킨다. 026이 세운 나머지 계약
(빈 섹션 시 파일 미생성, `map.json` remap, 미매핑 노드 드롭)은 그대로다.

#### Interface

- 제공: `digestRulesFor(rel)`이 blueprint `index.md` 경로에 대해
  `['## Intent', '## Contract']`를, `tasks/<NNN>/tasks.md` 경로에 대해
  `['## Goal & intent', '## Interface']`를 돌려준다. 기존 네 갈래(Distill 본체,
  Distill 샤드, epic `index.md`, `explain.md`)의 반환값은 바뀌지 않는다.
- 거부: 세 자리 숫자가 아닌 `tasks/` 하위 디렉터리(`tasks/1/tasks.md`), 구형 루트
  `tasks.md`와 `tasks-<NNN>.md`, blueprint 디렉터리 밖의 `index.md`는 계속
  `null`을 돌려준다. epic `index.md`는 `blueprints/` 분기에 걸리지 않는다.
- 거부: 요청한 헤딩이 없거나 본문이 비면 그 섹션을 빼고, 남는 섹션이 없으면
  `extractSections`가 `''`를 돌려 파생 파일을 만들지 않는다. 이 동작에 새 분기를
  넣지 않는다.

#### Touch

- Modify `scripts/src/lib/context-digest.ts` — `digestRulesFor`에 blueprint
  `index.md`와 task `tasks.md` 두 갈래를 더한다.
- Modify `scripts/lib/context-digest.js` — 커밋되는 CJS emit. `npm run build`가
  다시 생성하고 `check:emit`이 드리프트를 잡는다.
- Modify `test/context-digest.test.js` — 화이트리스트 단언과 거부 경로 단언을
  새 갈래까지 넓힌다.
- Modify `test/session-graph.test.js` — `empty context digest skips graphify …`
  픽스처의 「화이트리스트 문서 없음」 주석이 거짓이 된다. 그 픽스처의
  `tasks.md`는 이제 화이트리스트 경로이고, `## Checklist`만 있어 섹션이 비기
  때문에 digest count가 0으로 남는 것이다. 단언은 그대로 두고 주석만 고친다.
- Modify `docs/configuration.md` — 「컨텍스트 그래프」 절의 화이트리스트 목록을
  다섯 종류로 고친다.
- Modify `docs/ARCHITECTURE.md` — §D-1의 같은 서술을 고친다.

#### Constraints

- `digestRulesFor`의 반환 계약(헤딩 배열 또는 `null`)을 유지한다. 새 반환 형태나
  옵션 인자를 만들지 않는다.
- task 경로 판정에 `tasks.md` 문자열과 `\d{3}` 규칙을 하드코딩하지 않는다.
  Distill `context-layout` 불변식이 그 판정을 `tasks-docs.ts` 한 곳으로 묶어
  두었으므로 `TASK_DIR_RE`와 `TASK_UNIT_BASENAMES[0]`을 import해 쓴다.
  두 상수는 이미 export돼 있으므로 `tasks-docs.ts` 자체는 수정하지 않는다.
  `context-digest.ts`는 이미 `./distill`과 `./layout`을 require하므로 emit
  상대 경로 계약에 새로 걸리는 것은 없다.
- 사람용 문서의 화이트리스트 서술은 코드와 같은 순서·같은 헤딩 이름을 쓴다.
  "셋입니다" 같은 개수 표현이 남지 않게 한다.
- 공개 문자열과 주석은 한국어를 유지한다.
