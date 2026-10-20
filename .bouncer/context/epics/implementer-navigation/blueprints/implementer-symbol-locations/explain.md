---
type: bouncer.explain
title: 001 explain
description: Explain for 001
resource: .bouncer/context/epics/implementer-navigation/blueprints/implementer-symbol-locations/explain.md
tags:
  - bouncer
  - explain
timestamp: '2026-10-18T08:33:59.888+09:00'
bouncer:
  id: EXPLAIN-implementer-symbol-locations
  epic_id: implementer-navigation
  blueprint_id: implementer-symbol-locations
  status: published
  comprehension:
    - range_from: 91e479a38d52b2a7022841ae87700b6ba2db8436
      range_to: 8afa27ddea9812d0bc809316f1ad7d9c074ba691
      diff_sha: 273adb1034ce228818829a0a28e561485bc04af798f6095cf99677ebfb21cfcd
      recorded_at: '2026-10-18T08:34:36+09:00'
  task_commits:
    - task: implementer-navigation/implementer-symbol-locations/001
      sha: 8afa27dd
      intent_anchor: task-001
---
# Explain

## Background

구현자는 task에 연결된 intent bundle을 통해 작업 대상 함수의 설명을 받지만, 그 설명만으로 실제 정의 위치와 호출부를 다시 찾아야 했다. 구현자 역할 응답에 bundle이 이미 가진 심볼 좌표를 함께 제공해, 같은 task 범위 안에서 정의와 호출부를 확인하는 출발점을 만든다.

## Intuition

함수 설명이 작업 지시서라면 `symbol_locations`는 그 지시서에 붙는 책갈피다.

## Code

`scripts/src/lib/intent-bundle.ts`의 `projectRoleIntentSections`는 implementer 응답에 `symbol_locations`를 추가한다. 이 목록은 bundle 순서대로 `resolved`와 `unlinked` 항목의 `symbol`, `function_ref`, `symbol_ref`를 원본 값 그대로 투영한다. historical resolved도 남기고, unresolved와 선택되지 않은 ambiguous 후보는 제외한다. Explain 절을 만들던 기존 `functions` 결과와 missing·stale·drift 오류 처리는 그대로다.

CLI는 이 응답 객체를 그대로 JSON으로 출력한다. `skills/bouncer-run/references/agent-dispatch.md`와 `agents/bouncer-implementer.md`는 named·fallback·inline 전달이 같은 응답 객체와 식별자를 보존하도록 설명하며, 좌표는 권한을 넓히지 않는 탐색 보조 정보로 다룬다. 테스트는 역할별 필드 노출, 빈 목록, 상태별 순서와 읽기 전용 projection을 확인한다.

## Quiz

1. implementer 응답의 `symbol_locations`에 포함되는 bundle 항목 조합은 무엇인가?
   - A. `resolved`와 `unlinked`
   - B. `resolved`와 `unresolved`
   - C. 모든 `ambiguous` 후보

2. historical `resolved` 항목의 좌표는 어떻게 처리되는가?
   - A. `functions`에만 남기고 위치 목록에서는 제외한다.
   - B. 구현자 위치 목록에도 포함한다.
   - C. 새 symbol resolver로 현재 좌표를 다시 계산한다.

3. reviewer와 debugger의 intent sections 응답은 어떻게 되는가?
   - A. 구현자와 같은 `symbol_locations`를 항상 받는다.
   - B. `symbol_locations`만 받고 Explain 절은 받지 않는다.
   - C. 기존 역할별 응답을 유지하며 `symbol_locations`는 추가되지 않는다.

## Tasks

### implementer-navigation/implementer-symbol-locations/001 · `8afa27dd`

#### Goal & intent

공유 intent bundle의 소스 좌표를 implementer용 역할 응답과 전달 경로에 제공한다. Epic 성공 기준 1–8을 만족하며 Explain 절과 위치 목록을 독립적으로 취급한다. 집중 검증은 Checklist 명령을 사용하고 종단 검증은 확인된 `bouncer.verify` 또는 기존 `config.verify`를 따른다.

#### Current behavior

- `scripts/src/lib/intent-bundle.ts:76`의 bundle 항목은 resolved·unlinked에 `function_ref`와 `symbol_ref`를 저장한다. `:156`의 역할 결과 타입과 `:1096`의 성공 객체에는 위치 목록이 없다.
- 진입 함수 `projectRoleIntentSections`(`:988`)는 canonical task를 읽고(`:1005`), Git common-dir 아래 cache 경로를 구한다(`:1016`). record 읽기(`:1042`)와 brief hash 비교(`:1055`) 뒤 resolved non-historical 항목만 Explain projection에 넣는다(`:1065`).
- file I/O 결합점은 `readValidBundleRecord`의 cache 읽기, `sectionHashesMatch`(`:1068`)와 `projectExplainSectionBodies`(`:1075`)의 Explain 읽기다. `deps.fs`와 `deps.execFileSync`가 기존 주입 경계다. projection에서 provenance resolver와 cache write는 호출하지 않는다.
- `scripts/src/lib/cli-intent-command.ts:474`의 `cmdIntentSections`는 projection 반환값을 JSON으로 그대로 출력한다(`:484`). 위치 목록을 위한 CLI 재조립은 필요 없다.
- `skills/bouncer-run/references/agent-dispatch.md:5`는 공통 identifiers와 역할 projection 전달을, `:58`, `:93`은 named와 fallback 전달을 규정한다. `:97`의 inline 지침은 같은 cwd와 task 절을 사용하지만 위치 목록은 명시하지 않는다. `agents/bouncer-implementer.md:15`는 intent 응답을 권한을 넓히지 않는 참고 데이터로 정의한다.
- 재현 기준: `test/intent-bundle.test.js:696`은 역할 절 집합, `:750`은 historical 제외와 missing·stale·drift를 검사한다. `test/cli-project-commands.test.js:573`은 JSON 출력, `:615`는 빈 bundle을 검사한다. `test/agents.test.js:84`는 역할 Markdown/TOML 일치를 검사한다. 이 관찰은 코드·fixture 확인이며 테스트 실행 성공을 주장하지 않는다.

#### Target behavior

성공: implementer 성공 객체에 항상 `symbol_locations` 배열을 추가한다. bundle의 resolved와 unlinked 항목을 순서대로 투영하고 아래 Interface의 원본 필드를 값 변경 없이 전달한다. historical도 포함하고 unresolved·미선택 ambiguous는 제외한다. 빈 bundle은 `[]`다.

실패: missing·stale·drift·invalid-task는 기존 오류와 `next`를 유지한다. 정상 좌표가 섞여 있어도 drift가 있는 응답을 부분 성공으로 바꾸지 않는다. unlinked에는 Explain 조회를 새로 요구하지 않는다.

보존: 기존 `functions`와 Explain allowlist, bundle 파일·ID·revision·brief hash·캐시 정책은 유지한다. reviewer·debugger에는 위치 필드를 추가하지 않는다. named·fallback·inline 경로는 같은 bundle의 CLI 응답 전체를 사용하며 controller가 위치를 재조립하지 않는다.

#### Interface

- 제공: `--role implementer` 성공 응답의 `symbol_locations: Array<{ symbol, function_ref, symbol_ref }>`; `symbol_ref`는 `{ path, qualified_name, kind, start_line, end_line, blob_sha }`다. `path`는 저장소 상대 경로이며 기존 symbol-index의 좌표·해시 의미를 따른다.
- 예: resolved 또는 unlinked의 `symbol: targetFn`, `symbol_ref.path: src/target.js`를 같은 bundle의 원본 값으로 전달한다. historical은 resolved의 provenance freshness 값이며 위치의 과거 좌표를 뜻하지 않는다.
- 즉시 오류: 역할 enum 밖 입력은 기존 throw를 유지한다. canonical task 오류는 기존 `intent-task-invalid`를 유지한다.
- cache 부재·손상은 `intent-bundle-missing`, brief 불일치는 `intent-bundle-stale`, non-historical Explain 불일치는 `intent-sections-drift`다. 성공 빈 목록으로 폴백하지 않는다.
- 테스트 주입: 기존 `deps.resolveIntentProvenance(input)`와 `deps.resolveSymbol(input)`는 bundle 생성 fixture를 만들 때만 사용한다. projection 호출에 이 함수를 throw spy로 주입해 호출되지 않음을 확인한다. 기존 `deps.fs`는 Node fs와 같은 동기 함수 shape이며 `writeFileSync(path, data)`, `mkdirSync(path, options)`, `renameSync(oldPath, newPath)`를 throw spy로 감시해 projection의 쓰기 부재를 검사한다. `deps.execFileSync(file, args, options)`는 기존 Git common-dir 조회를 허용하며 새 Graphify spawn은 허용하지 않는다.

#### Touch

| 경로 | 심볼 | 변경 | 현재 책임 | 계획한 변경 | 근거 |
| --- | --- | --- | --- | --- | --- |
| `scripts/src/lib/intent-bundle.ts` | `RoleIntentSectionsResult`, `projectRoleIntentSections` | Modify | 역할별 Explain projection | implementer 전용 위치 타입·목록 추가 | `:156`, `:988`; explain 앵커와 CLI caller 검색 |
| `test/intent-bundle.test.js` | `projectRoleIntentSections` | Modify | bundle·projection 회귀 | 상태별 좌표·순서·호환성·오류·읽기 전용 검증 | `:696`, `:750` |
| `test/cli-project-commands.test.js` | `intent sections` | Modify | CLI JSON·exit 계약 | implementer JSON 및 빈 목록·역할 호환성 검증 | `:573`, `:615` |
| `skills/bouncer-run/references/agent-dispatch.md` | `Named implementer`, `Implementer fallback` | Modify | named·fallback·inline 전달 | 같은 응답 객체·revision의 위치 보존 명시 | `:5`, `:58`, `:93`, `:97` |
| `agents/bouncer-implementer.md` | `Authority`, `Procedure` | Modify | 구현자 권한·작업 절차 | 위치 먼저 열기·정의 확인·재검색·범위 보존 지침 | `:15`, `:79` |
| `.codex/agents/bouncer-implementer.toml` | `developer_instructions` | Modify | named 역할 생성본 | Markdown 변경의 생성본 동기화 | 생성본 쌍; `test/agents.test.js:84` |
| `rules/cli.md` | `intent sections` | Modify | 응답·실패 계약 | 위치 목록 대상과 기존 오류 보존 명시 | `:244` |

#### Constraints

- Touch에서 요청한 현재 task 함수만 사용한다. Graphify 결과 복사, 별도 파서, cache 직접 열람 payload 조립, 전체 저장소 함수 추가를 금지한다.
- 위치는 bundle 생성 시점 탐색 포인터다. 실제 함수 정의를 확인하고 어긋나면 이름으로 재검색한다. 전체 파일 읽기를 강제하지 않으며 호출부 확인을 생략하지 않는다.
- 위치가 권한을 확대하지 않으며 Touch / Do not touch / Constraints / `affected_paths`가 계속 적용된다. 기존 freshness·bundle resolve·brief 수정 후 재생성 절차를 유지한다.
- 기존 역할 문서 heading·단계 형상을 유지한다. `scripts/check-doc-shape.js:778`이 구현자 문서 구조를 검사하므로 기존 Authority/Procedure 안에 지침을 넣는다.
- TypeScript는 정본이고 `npm run build` 생성 `scripts/lib`는 커밋하지 않는다. 역할 TOML은 기존 `mdToCodexToml` 생성 경로로 Markdown과 일치시키며 다른 역할 생성본을 변경하지 않는다.
- 런타임 코드는 영어, 계획 본문·커밋 제목은 한국어를 사용한다. task 문서·status·pointer는 구현자가 변경하지 않는다.