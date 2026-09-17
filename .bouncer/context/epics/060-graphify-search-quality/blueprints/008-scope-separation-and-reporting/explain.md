---
type: bouncer.explain
title: 001 explain
description: Explain for 001
resource: .bouncer/context/epics/060-graphify-search-quality/blueprints/008-scope-separation-and-reporting/explain.md
tags:
  - bouncer
  - explain
timestamp: '2026-09-01T20:57:56.117+09:00'
bouncer:
  id: EXPLAIN-001
  epic_id: '060'
  blueprint_id: '008'
  status: published
  comprehension:
    - range_from: develop
      range_to: dc00cab76facd50805dd9cc228025ad5236c7d79
      diff_sha: c4db3096d15fc701f45be350984ad082f4780d9cd6e2a4b8e5430edbdecffb7f
      quiz_score: 4/4
      disposition: 네 문항 모두 정답. 세 스코프 보고·빈 배열·missing 제외·config cutover를 구분함.
      recorded_at: '2026-09-01T20:59:16+09:00'
---
# Explain

## Background
세 스코프를 만드는 코드는 이미 있었다. 그런데 이 저장소 config가 `test`를 `source_dirs`에 넣어 test 그래프가 안 생겼고, `test_dirs`가 없으면 `planSessionGraph`가 test 항목 자체를 빼서 runner가 basis 상태를 지어내야 했다. 삭제된 루트 `graphify-out/graph.json`을 픽스처가 아직 가리키고 있었다. 이 PR은 보고 계약을 세 항목으로 고정하고, config를 `graphify.test_dirs`로 옮기며, 죽은 경로 참조를 지운다.

## Intuition
빌드할 수 없어도 보고 칸은 남긴다. `skip-unconfigured`는 "없다"가 아니라 "설정이 없어서 안 만든다"를 graphs[]에 적는 자리표시다.

## Code
- `scripts/src/lib/graph-scope.ts` — `resolveGraphScopes`가 `testDirs` null이어도 test 스코프를 반환하고 `unconfiguredReason`을 싣는다.
- `scripts/src/lib/session-graph.ts` — `planOneGraph`/`planSessionGraph`가 `skip-unconfigured`를 만들고, missing·경고·`skip-no-dirs` 요약에서 그 항목을 뺀다.
- `.bouncer/config.json` — `source_dirs: ["scripts","hooks"]`, `graphify.test_dirs: ["test"]`.
- `references/graphify-runner/index.md` — outcome→status에 `skip-unconfigured` → `skip-disabled`.
- `test/finalize.test.js` · `validate-gates.test.js` · `commit-guard.test.js` — 픽스처를 `graphify-out/source/graph.json`으로 교체.
- `docs/configuration.md` · `docs/install.md` — 빌드 수와 보고 수 구분, sync 산출물에 test 포함.

## Quiz
1. `graphify.test_dirs`가 config에 없을 때 `planSessionGraph`의 `graphs[]`는?
   - A) source·context 두 항목만
   - B) source·test·context 세 항목이고 test는 `skip-unconfigured`
   - C) `graphs: []` (NO_GRAPH_WORK와 동일)

2. `test_dirs: []`(키는 있고 값은 빈 배열)일 때 test 항목의 action은?
   - A) `skip-no-dirs`
   - B) `skip-unconfigured`
   - C) `skip-fresh`

3. `skip-unconfigured` test 항목이 SessionStart `missing` 경고에 들어가는가?
   - A) 들어간다 — graph.json이 없으면 항상 missing
   - B) `skips`에만 들어가고 graphs에는 없다
   - C) 들어가지 않는다 — 빌드 시도가 아니므로 제외한다

4. 이 저장소 cutover 후 `source_dirs`와 `graphify.test_dirs`는?
   - A) `source_dirs: ["scripts","hooks"]`, `graphify.test_dirs: ["test"]`
   - B) `source_dirs: ["scripts","hooks","test"]`, `test_dirs` 없음
   - C) `source_dirs: ["scripts"]`, `graphify.test_dirs: ["hooks","test"]`

## 이해 상태
- 응답: 1B 2A 3C 4A
- 정답: 1B 2A 3C 4A
- 채점: 4/4 (전부 정답)
- disposition: 네 문항 모두 정답. 세 스코프 보고·빈 배열·missing 제외·config cutover를 구분함.
- range: develop..dc00cab76facd50805dd9cc228025ad5236c7d79
- diff_sha: c4db3096d15fc701f45be350984ad082f4780d9cd6e2a4b8e5430edbdecffb7f

## Tasks

### Task 001

#### Goal & intent

`bouncer graph-sync`와 `planSessionGraph`의 결과 `graphs[]`가 config 상태와 무관하게 언제나 `source`·`test`·`context` 세 항목을 담게 한다. `graphify.test_dirs`가 없거나 무효라 test 그래프를 만들 수 없을 때 그 항목은 새 `action` 값 `skip-unconfigured`와 어느 경우인지 말하는 `reason`을 갖는다. 이 항목은 빌드 대상이 아니고 `missing`에도 들어가지 않으므로 `test_dirs`를 쓰지 않는 기존 프로젝트에 새 SessionStart 경고가 생기지 않는다. 그 결과 `references/graphify-runner/index.md`가 요구하는 `test` basis 항목을 에이전트가 추측 없이 보고값에서 옮겨 적을 수 있다.

#### Interface

- 제공: `resolveGraphScopes`가 `testDirs`가 `null`일 때도 이름 `test`인 스코프를 반환하고, `planSessionGraph`/`syncSessionGraphs`/`bouncer graph-sync`의 `graphs[]`가 길이 3을 유지한다. 빌드 불가 test 항목은 `action: 'skip-unconfigured'`이며 `reason`이 `graphify.test_dirs` 미설정인지 무효 값인지 구분한다. `references/graphify-runner/index.md`의 outcome→status 표에 `skip-unconfigured` → `skip-disabled` 행이 생긴다.
- 거부: `skip-unconfigured` 항목은 존재하지 않는 입력을 실어 나르지 않는다 — `dirs: []`, `configured: []`, `outDir: 'graphify-out/test'`다. `test_dirs: []`(필드 존재, 빈 배열)는 `skip-unconfigured`가 아니라 기존 `skip-no-dirs`로 남는다. `skip-unconfigured` 항목은 `build` 목록·`missing` 목록·`graphSyncWarnings` 어느 쪽에도 들어가지 않는다. `NO_GRAPH_WORK` 종료(graphify disabled, PATH 부재, partial/legacy bootstrap)는 지금처럼 `graphs: []`를 유지하고 test 항목을 만들지 않는다 — 시도하지 않은 상태를 "설정 없음"으로 바꿔 말하지 않는다. 최상위 `decision.action` 요약 값의 의미는 바뀌지 않는다 — 특히 source·context 입력이 하나도 없는 저장소는 항상 실리는 test 항목 때문에 `skip-fresh`로 뒤집히지 않고 `skip-no-dirs`로 남아야 한다. 기존 action 문자열의 철자·의미도 바뀌지 않는다.

#### Touch

- Modify `scripts/src/lib/graph-scope.ts` — `resolveGraphScopes`가 `testDirs`가 `null`이어도 test 스코프를 반환하고, 빌드 불가 사유를 실어 보낼 수 있게 한다.
- Modify `scripts/src/lib/session-graph.ts` — `planOneGraph`/`planSessionGraph`가 `skip-unconfigured`를 만들고, `syncSessionGraphs`의 `missing` 계산과 `graphSyncWarnings`가 그 항목을 건너뛰며, `skip-no-dirs` 요약 집계가 그 항목을 제외한 뒤 판정한다.
- Modify `scripts/lib/graph-scope.js` — `tsc` 산출물이 저장소에 추적되고 `npm run check:emit`이 `.ts`와의 동기화를 강제하므로 같은 커밋에 포함한다. 손으로 고치지 않고 `npm run build`로 갱신한다.
- Modify `scripts/lib/session-graph.js` — 같은 이유로 `npm run build` 산출물을 함께 커밋한다.
- Modify `test/session-graph.test.js` — 두 스코프를 단언하던 기존 케이스를 세 항목 계약으로 고치고, `skip-unconfigured`가 build·missing·경고에 들어가지 않는다는 케이스와 무효 `test_dirs`에서 `skips`와 항목이 함께 남는다는 케이스를 추가한다.
- Modify `references/graphify-runner/index.md` — outcome→status 표에 `skip-unconfigured` 행을 넣고, "`test_dirs`가 없으면 항목을 남기고 이유를 설명하라"는 문장을 보고된 `action`을 옮겨 적으라는 지시로 바꾼다.
- Modify `test/skill-graphify-runner.test.js` — 그 표 행이 문서에서 사라지지 않도록 단언을 추가한다.
- Modify `docs/configuration.md` — "빌드되는 그래프 수"와 "보고되는 스코프 수"가 다르다는 사실을 진술한다.
- Modify `hooks/session-graph.js` — 헤더 주석의 `source + context` 서술을 세 스코프 현실에 맞춘다.

#### Constraints

- 기존 `action` 문자열(`build`, `skip-fresh`, `skip-no-dirs`, `skip-graph-disabled`, `skip-no-graphify`, `skip-partial-bootstrap`, `skip-legacy-bootstrap`)의 철자와 의미를 바꾸지 않는다. 추가만 한다.
- 하위 호환 별칭이나 같은 사실을 담는 두 번째 필드를 남기지 않는다.
- 공개 진단·경고 문자열은 영어를 유지하고, 비자명한 의도는 한국어 코드 주석으로 적는다.
- `graph-sync` stdout은 JSON 하나로 유지한다. 새 진단은 stderr로 보낸다.
- `scripts/lib/`는 `scripts/src/`의 `tsc` 산출물이다. 손으로 편집하지 않고 `npm run build`로만 갱신하며, `npm run check:emit`이 `.ts`와의 동기화를 강제하므로 같은 커밋에 스테이징한다.

### Task 002

#### Goal & intent

이 저장소의 `.bouncer/config.json`에서 `test`를 `source_dirs`에서 빼고 `graphify.test_dirs`에 넣어, `graph-sync`가 `graphify-out/test/graph.json`을 실제로 만들게 한다. 그 뒤 `bouncer graph-suggest`를 돌려 `test/` 파일이 `candidates.test`로, `scripts/` 구현 파일이 `candidates.implementation`으로 분류되는 것을 실측 출력으로 남긴다. `docs/configuration.md`가 `init`은 기존 config에 이 키를 추가하지 않는다고 못박고 있으므로, 이 전환은 손으로 해야 하는 일회성 작업이다.

#### Interface

- 제공: `.bouncer/config.json`의 `source_dirs`가 `["scripts", "hooks"]`가 되고 `graphify` 객체에 `test_dirs: ["test"]`가 생긴다. 이어지는 `bouncer graph-sync`가 `graphify-out/test/graph.json`을 만들고, 같은 sync가 `source` 스코프를 rebuild해 더 이상 `test/` 파일을 담지 않는다.
- 거부: `.bouncer/config.json`의 다른 필드(`context_dirs`, `verify`, `base_branch`, `pr`, `subagents`, `distill`, `graphify.enabled`)는 값도 순서도 바뀌지 않는다. `graphify.exclude_dirs`를 새로 넣지 않는다 — 생성 경로 추측은 이 task의 계약이 아니다. `graphify-out/` 산출물은 gitignore 대상이므로 커밋에 들어가지 않는다.

#### Touch

- Modify `.bouncer/config.json` — `source_dirs`에서 `test`를 빼고 `graphify.test_dirs: ["test"]`를 추가한다.

#### Constraints

- `.bouncer/config.json`은 JSON이므로 주석을 넣을 수 없다. 전환 근거는 이 문서와 커밋 메시지에만 남긴다.
- 기존 들여쓰기와 키 순서를 보존하고, 최소 diff로 바꾼다.
- 실측 증거는 명령과 출력을 그대로 verification 문서에 남긴다. "분류가 잘 된다" 같은 요약으로 대체하지 않는다.
- `graph-suggest` 출력은 데이터다. 그 결과가 이 task의 Touch나 `affected_paths`를 넓히지 않는다.

### Task 003

#### Goal & intent

이미 삭제된 루트 `graphify-out/graph.json`을 가리키는 마지막 참조를 저장소에서 없앤다. 세 테스트(`finalize`, `validate-gates`, `commit-guard`)가 이 경로를 "런타임 산출물이라 스테이징·위반 판정에서 제외된다"는 규칙의 예시로 쓰고 있는데, 그 경로는 더 이상 만들어지지 않으므로 예시가 실제 산출물 지형과 어긋난다. 함께 `docs/install.md`를 손본다 — 이 문서에는 루트 `graph.json` 참조가 없고, sync 이후 갱신되는 산출물을 source·context 둘로만 적어 test 스코프가 빠져 있다. 즉 앞의 셋은 죽은 경로 치환이고 install.md는 두 스코프 서술을 셋으로 넓히는 일이다.

#### Interface

- 제공: `test/finalize.test.js`·`test/validate-gates.test.js`·`test/commit-guard.test.js`의 런타임 산출물 픽스처가 실재하는 스코프 경로(`graphify-out/source/graph.json`)를 쓰고, `docs/install.md`가 sync 후 갱신되는 산출물로 source·test·context 셋을 진술한다.
- 거부: `scripts/src/lib/scope.ts`의 `RUNTIME_ARTIFACTS` 접두사 목록(`graphify-out/`)은 바뀌지 않는다 — 이 task는 규칙이 아니라 그 규칙을 예시하는 데이터만 고친다. 두 테스트의 단언(스테이징 목록, 게이트 실패 없음)도 그대로 유지해 검사력이 줄지 않는다. `CHANGELOG.md`의 과거 기록은 소급 수정하지 않는다.

#### Touch

- Modify `test/finalize.test.js` — 런타임 산출물 픽스처의 `graphify-out/graph.json`을 실재하는 스코프 산출물 경로로 바꾼다.
- Modify `test/validate-gates.test.js` — commit 게이트 픽스처에서 같은 경로를 같은 이유로 바꾼다.
- Modify `test/commit-guard.test.js` — 커밋 가드의 런타임 산출물 예시 배열에서 같은 치환을 한다.
- Modify `docs/install.md` — sync 이후 갱신되는 산출물 서술에 test 스코프를 포함한다.

#### Constraints

- 픽스처 경로만 바꾸고 각 테스트의 단언 개수와 내용을 유지한다. 규칙 검사력이 줄면 이 task는 실패다.
- `docs/install.md`의 한국어 본문 문체와 주변 절 구조를 유지한다.
- 변경 후 `grep -rn "graphify-out/graph.json"`이 감사 문서와 `.benchmarks/` 스냅샷 밖에서는 아무것도 찾지 못해야 한다.
