---
type: bouncer.explain
title: 001 explain
description: Explain for 001
resource: .bouncer/context/epics/060-graphify-search-quality/blueprints/007-derived-anchors-and-coverage/explain.md
tags:
  - bouncer
  - explain
  - context-digest
  - graph-suggest
timestamp: '2026-09-01T15:34:26.849+09:00'
bouncer:
  id: EXPLAIN-001
  epic_id: '060'
  blueprint_id: '007'
  status: published
  comprehension:
    - range_from: develop
      range_to: d50b06a99aeb00e1f1027c3107753fda5abe2157
      diff_sha: 1458eee2351139bd866287d7fdbea585229e43076cf7910c28eb861ec9b651f1
      quiz_score: 4/4
      disposition: emit·Touch·tags·Distill 규칙 네 축을 모두 맞춤. Distill graph shard 문구 갱신은 후속.
      recorded_at: '2026-09-01T15:35:54+09:00'
---
# Explain

## Background
`buildContextDigest`는 화이트리스트 절 본문이 비면 파생 파일을 만들지 않았다. epic·blueprint 인덱스처럼 살릴 절이 없는 문서는 그래프에서 통째로 빠졌고, 경로·`## Touch`·`tags`에 이미 있는 ASCII 검색 값도 버렸다. 이 PR은 파생 본문 앞에 계층 앵커·Touch 경로·도메인 태그 헤딩을 넣고, Distill master는 `## Shards`·shard는 Invariants/Gotchas/Decisions를 색인하도록 `digestRulesFor`를 맞춘다. 작성 규칙은 `rules/okf.md`와 `references/spec-authoring/index.md`에 tags가 검색 어휘임을 적는다.

## Intuition
문서가 이미 들고 있는 경로 id·Touch 경로·태그를 헤딩으로 올려, 질의 토큰이 context 라벨과 source_file에 동시에 걸리게 한다.

## Code
- `scripts/src/lib/context-digest.ts` — `anchorsFor`, `touchPathHeadings`, `tagLabels`, 헤딩 조립(앵커 → Touch → 태그 → 절), emit 조건, Distill 규칙
- `scripts/lib/context-digest.js` — 동일 CJS emit
- `test/context-digest.test.js` — 세 함수·파생 본문·Distill 픽스처
- `test/session-graph.test.js` — empty digest 스킵 픽스처를 Distill(앵커 없음)으로 조정
- `rules/okf.md`, `references/spec-authoring/index.md`, `test/skill-spec-authoring.test.js` — tags 검색 어휘 계약
- Distill 후속: `.bouncer/distill/graph.md`의 "whitelist headings only"는 이 PR 이후 사실과 어긋남 — 승격 시 갱신 대상

## Quiz
1. 파생 파일이 만들어지는 최소 조건은?
   - A) 화이트리스트 절 본문이 비어 있지 않을 때만
   - B) 계층 앵커가 있거나 절 본문이 있을 때
   - C) frontmatter `tags`가 2개 이상일 때만

2. `touchPathHeadings`가 경로를 승격하는 대상은?
   - A) epic·blueprint·task 문서의 모든 백틱 경로
   - B) `## Do not touch`에 적힌 경로만
   - C) `tasks.md`의 `## Touch` 절 백틱 경로만 (토큰 문자 집합 통과분)

3. `tagLabels`가 승격에서 빼는 구조 태그는?
   - A) `bouncer`와 문서 `type: bouncer.<kind>`에서 역산한 kind 태그
   - B) 고정 목록 `epic`·`blueprint`·`tasks`·`explain`·`verification`·`review`
   - C) `description`과 `title`의 모든 토큰

4. master Distill과 shard의 `digestRulesFor` 반환은?
   - A) master `['## Shards']`, shard `['## Invariants','## Gotchas','## Decisions']`
   - B) 둘 다 `['## Decisions']`
   - C) master `['## Decisions']`, shard `['## Shards']`

## 이해 상태
- 정답: 1B, 2C, 3A, 4A
- 응답: 1B, 2C, 3A, 4A
- 채점: 4/4 전부 정답
- disposition: emit·Touch·tags·Distill 규칙 네 축을 모두 맞춤. Distill graph shard 문구 갱신은 후속.
- quiz_score: 4/4 · range develop..d50b06a · diff_sha 1458eee2…

## Tasks

### Task 001

#### Goal & intent

`buildContextDigest`가 만드는 파생 파일이 본문 앞에 계층 앵커 헤딩을 담는다.
`epic-063`처럼 토큰 하나로 질의하면 그 epic의 `index.md` 파생 문서와 그 아래 모든
blueprint·task 파생 문서가 함께 label hit한다. 앵커는 문서 경로에서만 파생하므로
작성자가 본문에 아무것도 적지 않아도 된다.

동시에 파생 파일 생성 조건을 넓힌다. 지금은 화이트리스트 절 본문이 비면 파일을
만들지 않아 epic `001`·`002`·`003`·`005`와 BP `001-cli-usability/001-cli-help`,
`002-commit-artifacts/001-evidence-and-message`가 그래프에서 통째로 사라진다.
앵커만 있어도 파일을 쓰면 이 6건이 최소한 계층 좌표를 가진 노드로 남는다.

검증은 `npm test`이며, 아래 Checklist의 단언이 모두 통과해야 한다.

#### Interface

- 제공: `context-digest.ts`가 `anchorsFor(rel: string): string[]`를 추가로 내보낸다.
  가장 좁은 앵커부터 부모 순으로 돌려준다.
  ```
  anchorsFor('.bouncer/context/epics/063-x/blueprints/001-y/tasks/002/tasks.md')
    -> ['task-063-001-002', 'bp-063-001', 'epic-063']
  anchorsFor('.bouncer/context/epics/063-x/blueprints/001-y/index.md')
    -> ['bp-063-001', 'epic-063']
  anchorsFor('.bouncer/context/epics/063-x/blueprints/001-y/explain.md')
    -> ['bp-063-001', 'epic-063']
  anchorsFor('.bouncer/context/epics/063-x/index.md') -> ['epic-063']
  anchorsFor('.bouncer/Distill.md') -> []
  ```
  blueprint 디렉터리 바로 아래 문서(`explain.md`, `context-review.md`)는 blueprint
  문서와 같은 두 앵커를 얻는다.
  파생 파일 본문은 `` 다음 빈 줄, 그 다음 앵커마다 `## <anchor>`
  한 줄, 그 다음 빈 줄, 그 다음 기존 `extractSections()` 결과 순서가 된다.
- 거부: 규칙은 하나다 — 어떤 층의 id가 선행 세 자리 `\d{3}`(task 층은 `TASK_DIR_RE`)에
  맞지 않으면 그 층과 그 아래 층의 앵커를 만들지 않고, 유효한 상위 층의 앵커는 그대로
  남긴다. epic 층이 깨지면 결과는 빈 배열이고, task 층만 깨지면 `['bp-063-001',
  'epic-063']`이다. 없는 id를 지어내거나 하위 층 앵커를 상위 id로 대신 만들지 않는다.
  Distill과 shard는 계층 id 자체가 없으므로 빈 배열이며, 이는 오류가 아니다.

#### Touch

- Modify `scripts/src/lib/context-digest.ts` — `anchorsFor` 추가, 파생 본문 조립에 앵커 헤딩 삽입, 파일 생성 조건을 `앵커 또는 절 본문`으로 완화, `module.exports`에 추가
- Modify `scripts/lib/context-digest.js` — `tsc` 산출물이 저장소에 추적되고 `npm run check:emit`이 `.ts`와의 동기화를 강제하므로 같은 커밋에 포함
- Modify `test/context-digest.test.js` — `anchorsFor` 단언과 파생 본문 형식·생성 조건 단언 추가
- Modify `test/session-graph.test.js` — 앵커만으로도 digest가 생기는 새 emit 규칙에 맞게 empty-digest 스킵 단언·픽스처를 조정

#### Constraints

- 앵커 문자열은 `rules/okf.md`「Derived context-digest anchors」의 문법을 그대로 따른다. 콜론·공백·한글을 넣지 않는다.
- id는 zero-padded 세 자리를 그대로 쓴다. 파싱해서 숫자로 바꾸고 다시 채우지 않는다.
- `map.json`의 키·값 형식과 `flattenSlug`·`uniqueFlatName` 동작은 바꾸지 않는다.
- 비ASCII 슬러그가 섞인 디렉터리에서도 앵커는 id 부분만 쓰므로 항상 ASCII다.
- 새 함수는 순수 함수로 두고 파일 시스템에 접근하지 않는다.

### Task 002

#### Goal & intent

`tasks/<NNN>/tasks.md`의 `## Touch`에 적힌 파일 경로가 파생 문서에서 헤딩 한 줄이 된다.
토크나이저가 `/` `.` `-` `_`를 보존하므로 `scripts/src/lib/context-digest.ts` 같은 경로는
질의에서 토큰 하나로 남고, 그 토큰이 context 노드 라벨과 source 그래프의 `source_file`
양쪽에 동시에 맞는다. 지금은 205쌍의 Touch가 통째로 버려져 이 통로가 없다.

Touch 줄은 `- Modify \`path\` — 이유` 형태라 동사·한국어 설명이 섞인다. 백틱 스팬만
후보로 보고 그중 토크나이저 문자 집합만으로 이뤄진 것을 남긴다.

검증은 `npm test`이며, 아래 Checklist의 단언이 모두 통과해야 한다.

#### Interface

- 제공: `context-digest.ts`가 `touchPathHeadings(markdown: string): string[]`를 추가로
  내보낸다. 문서 전체를 받아 `## Touch` 절만 보고, 등장 순서대로 중복을 제거한 경로
  배열을 돌려준다.
  ```
  touchPathHeadings('## Touch\n- Modify `scripts/src/lib/a.ts` — 이유\n- Create `test/a.test.js` — 이유\n')
    -> ['scripts/src/lib/a.ts', 'test/a.test.js']
  ```
  `buildContextDigest`는 `tasks.md` 대상에서만 이 결과를 앵커 헤딩 뒤에 `## <path>` 줄로
  덧붙인다.
- 거부: `## Touch` 절이 없으면 빈 배열이다. 백틱 밖의 문자열은 후보가 아니다. 백틱
  안이라도 `/^[A-Za-z0-9_./-]+$/`에 맞지 않으면 버린다 — 꺾쇠·콜론이 들어간 스캐폴드 자리표시자,
  한국어가 섞인 값, 공백을 포함한 값이 여기서 걸린다. `tasks.md` 이외의 문서에는
  적용하지 않는다.

#### Touch

- Modify `scripts/src/lib/context-digest.ts` — `touchPathHeadings` 추가, `tasks.md` 파생 본문에 경로 헤딩 삽입, `module.exports`에 추가
- Modify `scripts/lib/context-digest.js` — `tsc` 산출물이 추적되고 `npm run check:emit`이 동기화를 강제하므로 같은 커밋에 포함
- Modify `test/context-digest.test.js` — `touchPathHeadings` 단언과 파생 본문 통합 단언 추가

#### Constraints

- 경로 문자열을 정규화하지 않는다. 문서에 적힌 그대로 헤딩으로 만든다.
- 절 경계 판정은 기존 `extractSections`와 같은 규칙(`^##\s`)을 쓰고 별도 파서를 만들지 않는다.
- `## Touch` 이외의 절에 있는 백틱 경로는 승격하지 않는다. `Do not touch`의 보호 경로가 검색 후보로 올라오면 안 된다.
- 앵커 헤딩(task 001)과 경로 헤딩의 순서를 앵커 먼저로 고정한다.

### Task 003

#### Goal & intent

frontmatter `tags`가 문서의 도메인 검색 어휘가 되고, 다이제스트가 그 값을 헤딩으로
승격한다. `graph-search`는 라벨을 완전 일치로 비교하므로 문장형 `description`은
자연어 질의로 도달할 수 없다. 반면 `context-digest`, `worktree` 같은 단일 토큰 태그는
그대로 맞는다. 따라서 라벨 원천을 `tags` 하나로 고정한다.

scaffold가 모든 문서에 찍는 구조 태그는 승격하면 god label이 된다 — `explain` 75건,
`verification`·`review`·`tasks` 각 213건이다. 제외 대상을 고정 목록으로 두면 scaffold가
종류를 늘릴 때 조용히 어긋나고, `distill`처럼 kind 태그이면서 동시에 도메인 개념인
값을 영영 막는다. 그래서 문서 자신의 `type: bouncer.<kind>`에서 역산한 태그와
`bouncer` 둘만 제외한다. `.bouncer/distill/*.md`처럼 `bouncer.<kind>` 타입이 없는
문서는 `bouncer`만 제외한다.

이 task는 소비 쪽만 넣는다. 작성자가 도메인 태그를 적게 만드는 생산자 규칙은
task 005가 `rules/okf.md`와 `references/spec-authoring/index.md`에 넣는다.

검증은 `npm test`이며, 아래 Checklist의 단언이 모두 통과해야 한다.

#### Interface

- 제공: `context-digest.ts`가 `tagLabels(markdown: string): string[]`를 추가로 내보낸다.
  문서의 YAML frontmatter `tags` 목록에서 구조 태그를 뺀 뒤, 토크나이저 문자 집합만으로
  이뤄진 값을 등장 순서대로 중복 제거해 돌려준다.
  ```
  tagLabels('---\ntype: bouncer.epic\ntags:\n  - bouncer\n  - epic\n  - context-digest\n  - distill\n---\n')
    -> ['context-digest', 'distill']
  tagLabels('---\ntype: bouncer.explain\ntags:\n  - bouncer\n  - explain\n  - worktree\n---\n')
    -> ['worktree']
  ```
  제외 규칙은 `bouncer` 하나와 `type` 값에서 `bouncer.` 접두어를 뗀 문자열 하나뿐이다.
  `buildContextDigest`는 결과를 앵커·Touch 경로 헤딩 뒤에 `## <tag>` 줄로 덧붙인다.
- 거부: `tags`가 없거나 배열이 아니면 빈 배열이다. 공백·콜론·한글이 섞인 값, `bouncer`,
  그 문서 자신의 kind 태그, `description`과 `title`은 승격하지 않는다. frontmatter가
  없으면 빈 배열이고, `type`이 없으면 `bouncer`만 제외한 나머지를 승격한다.

#### Touch

- Modify `scripts/src/lib/context-digest.ts` — `tagLabels` 추가, 파생 본문에 태그 헤딩 삽입, `module.exports`에 추가
- Modify `scripts/lib/context-digest.js` — `tsc` 산출물이 추적되고 `npm run check:emit`이 동기화를 강제하므로 같은 커밋에 포함
- Modify `test/context-digest.test.js` — `tagLabels` 단언과 파생 본문 통합 단언 추가

#### Constraints

- frontmatter 파싱은 이 파일 안의 최소 구현으로 끝낸다. `tags:` 블록의 `  - value` 줄만 읽고 일반 YAML 파서를 새로 들이지 않는다.
- 제외 대상은 문서의 `type` 값에서 역산한다. 종류 목록을 상수로 복제하지 않는다 — scaffold가 종류를 늘려도 규칙이 따라간다. `bouncer.context_review` → `context_review`처럼 접두어만 떼고 표기를 바꾸지 않는다.
- 승격 판정에 대소문자 변환을 넣지 않는다. `graph-search`가 비교 시점에 소문자화하므로 여기서 값을 바꾸면 원본과 어긋난다.
- 헤딩 순서는 앵커 → Touch 경로 → 태그로 고정한다.

### Task 004

#### Goal & intent

Distill 계층의 다이제스트 규칙을 실제 문서 모양에 맞춘다. shard 8건은 지금
`## Decisions`만 통과해 `## Invariants`와 `## Gotchas`가 통째로 드롭된다. 프로젝트
불변식과 함정이야말로 검색되어야 할 내용이므로 세 절을 모두 색인한다.

master `.bouncer/Distill.md`는 규칙이 `['## Decisions']`인데 실제 본문에는
`## Shards`뿐이라 파생 산출이 0건이다. master는 shard 목록과 freshness의 정본이므로
그 역할대로 `## Shards`를 색인해 watch 목록에 있으면서 산출이 없는 상태를 없앤다.

마지막으로 실제 저장소에서 다이제스트를 재빌드해 `map.json` 항목 수가 대상 문서 수와
일치하는지, 감사에서 누락으로 지목한 7건이 모두 등장하는지 실측해 `verification.md`에
증적으로 남긴다.

검증은 `npm test`이며, 아래 Checklist의 단언과 실측 항목이 모두 통과해야 한다.

#### Interface

- 제공: `digestRulesFor`가 Distill 계층에 대해 아래를 돌려준다.
  ```
  digestRulesFor('.bouncer/Distill.md')      -> ['## Shards']
  digestRulesFor('.bouncer/distill/core.md') -> ['## Invariants', '## Gotchas', '## Decisions']
  ```
  반환 타입과 다른 계층의 반환값은 그대로다.
- 거부: shard에 세 절 중 일부만 있으면 있는 절만 남기고 문서는 유지한다(기존
  `extractSections` 동작). 셋 다 없고 앵커도 없으면 지금처럼 파생 파일을 만들지 않는다.
  `DISTILL_SHARD_DIR` 밖의 경로는 shard로 취급하지 않는다.

#### Touch

- Modify `scripts/src/lib/context-digest.ts` — `digestRulesFor`의 master Distill·shard 분기 반환값 변경
- Modify `scripts/lib/context-digest.js` — `tsc` 산출물이 추적되고 `npm run check:emit`이 동기화를 강제하므로 같은 커밋에 포함
- Modify `test/context-digest.test.js` — 새 규칙 단언과 shard 파생 본문 세 절 단언으로 갱신

#### Constraints

- `test/context-digest.test.js`에서 Distill을 다루는 자리는 넷이다: `:16`의 master 단언, `:37` 부근의 shard 단언, `:131` 테스트 안의 master 픽스처, 같은 테스트의 `.bouncer/distill/core.md` 픽스처. 넷을 모두 새 계약으로 옮기며, 단언은 교체하는 것이지 삭제하는 것이 아니다.
- master 픽스처가 `## Decisions`만 담은 채로 남으면 새 규칙에서 추출 결과가 비고 앵커도 없어 파생 파일이 생기지 않아 `originals.includes('.bouncer/Distill.md')`가 실패한다. 픽스처를 실제 문서처럼 `## Shards`를 담도록 바꾼다.
- 절 이름 문자열은 문서에 있는 그대로 쓴다. 정규화하거나 별칭을 만들지 않는다.
- 세 절의 순서를 `Invariants` → `Gotchas` → `Decisions`로 고정한다. shard 문서의 작성 순서와 같다.
- 실측은 저장소 기본 브랜치 상태에서 수행하고, `targets`·`emitted`·`missing` 세 값을 `verification.md`의 Evidence에 명령 출력 그대로 붙인다. 수치를 요약해 옮겨 적지 않는다.

### Task 005

#### Goal & intent

task 003이 `tags`를 검색 라벨로 승격시키지만, 지금 도메인 태그를 가진 epic은 62건 중
6건뿐이고 나머지는 scaffold 기본 태그 두 개뿐이다. 작성 규칙이 tags를 "작은 안정적
어휘"라고만 말하고 그것이 검색 라벨이 된다는 사실도, 단일 토큰이어야 한다는 제약도
적지 않기 때문이다.

`rules/okf.md`의 `tags` 항목과 `references/spec-authoring/index.md`의
「Language and prose」가 이 두 가지를 진술하게 만든다. 그러면 이후 계획하는 문서는
스스로 검색 가능한 도메인 어휘를 갖는다. 기존 435개 문서의 tags 일괄 정리는 하지
않는다 — Wave 4가 맡는다.

검증은 `npm test`이며, 아래 Checklist의 단언이 모두 통과해야 한다.

#### Interface

- 제공: `rules/okf.md`의 `tags` 항목이 세 가지를 진술한다. ① tags는
  `context-digest`가 파생 헤딩으로 승격하는 `graph-suggest` 검색 어휘다 ② 각 항목은
  `[A-Za-z0-9_./-]`만으로 이뤄진 영어 ASCII 단일 토큰이다 ③ `bouncer`와 그 문서
  자신의 종류 태그는 승격되지 않으므로 도메인 태그를 2~5개 더 적는다.
- 제공: `references/spec-authoring/index.md`「Language and prose」가 같은 의무를
  작성 시점의 지침으로 진술하고, 무엇이 도메인 태그인지 예를 든다.
- 거부: 기존 언어 계약 문장(영어 ASCII 의무, 한국어 `title` 예외, 코퍼스 일괄 재작성
  금지)을 지우거나 약화하지 않는다. tags 진술만 확장한다. 새 게이트 코드나 검증
  규칙을 추가하지 않는다 — 이 규칙은 작성 지침이지 게이트가 아니다.

#### Touch

- Modify `rules/okf.md` — `tags` 항목을 검색 어휘 계약으로 다시 쓰고, 「Derived context-digest anchors」의 미래 시제 문장을 현재 시제로 바꾼다
- Modify `references/spec-authoring/index.md` — 「Language and prose」에 도메인 태그 작성 지침을 넣는다
- Modify `test/skill-spec-authoring.test.js` — 두 문서의 tags 진술을 단언으로 고정한다

#### Constraints

- `test/skill-spec-authoring.test.js:71`의 기존 단언 `/tags[\s\S]{0,120}English ASCII/i`가 계속 통과해야 한다. 문장 사이에 120자를 넘는 삽입을 넣지 않는다.
- `test/init.test.js:432`가 `rules/okf.md`에서 금지 어휘를 검사하므로 `superpowers`·`methodology.profile`·`profile-aware`를 새 문장에 쓰지 않는다.
- 두 문서의 진술은 같은 필드 목록과 같은 문자 집합을 말해야 한다. 한쪽만 고치면 계약이 갈라진다.
- 예로 드는 태그는 승격 필터를 통과하는 값이어야 한다. 현재 `rules/okf.md`가 드는 `verification`은 213개 문서의 종류 태그라 그 문서들에서 라벨이 되지 않으므로 예시에서 뺀다. `worktree`, `context-digest`, `graph-suggest`를 쓴다.
- `rules/okf.md:86`의 "Wave 2 context-digest **will** generate…"는 이 blueprint가 Wave 2이므로 현재 시제로 바꾼다. 앵커 문법 자체는 건드리지 않는다.
