---
type: bouncer.tasks
title: 그래프 동기화와 히스토리 임포트 분해
description: session-graph.ts와 import-history.ts를 계획·실행·렌더 층으로 나눈다
resource: .bouncer/context/epics/035-scripts-refactor/blueprints/001-core-module-split/tasks/004/tasks.md
tags:
  - bouncer
  - tasks
timestamp: '2026-08-14T09:53:11.293+09:00'
bouncer:
  id: TASKS-004
  epic_id: '035'
  blueprint_id: '001'
  status: ready
  commit_intent:
    - 무엇을 할지 정하는 코드와 실제로 외부 명령을 부르는 코드가 한 파일에 섞여 있어, 테스트가 어디까지 순수한지 경계가 흐렸음
    - 판단하는 층과 바깥을 건드리는 층을 파일로 갈라 그 경계를 눈에 보이게 함
  affected_paths:
    - scripts/src/lib/session-graph.ts
    - scripts/src/lib/graph-scope.ts
    - scripts/src/lib/graph-exec.ts
    - scripts/src/lib/import-history.ts
    - scripts/src/lib/import-types.ts
    - scripts/src/lib/import-git.ts
    - scripts/src/lib/import-render.ts
    - scripts/lib/session-graph.js
    - scripts/lib/graph-scope.js
    - scripts/lib/graph-exec.js
    - scripts/lib/import-history.js
    - scripts/lib/import-types.js
    - scripts/lib/import-git.js
    - scripts/lib/import-render.js
  graph:
    generated_at: '2026-08-14T10:05:38.205+09:00'
    command: graphify query "validateBlueprint checkGate checkStructural runCli parseFlags syncSessionGraphs planImport readConfig" --graph graphify-out/{source,context}/graph.json
    suggested_paths:
      - scripts/src/lib
      - scripts/lib
      - test
    basis:
      - graph: source
        status: reused
        query: validateBlueprint checkGate checkStructural runCli parseFlags syncSessionGraphs planImport readConfig
        result: 46 nodes; session-graph/import-history 함수는 cli 진입점을 통해서만 걸려 직접 히트가 얕음 — 경로는 파일 읽기로 직접 확인함.
      - graph: context
        status: updated
        query: scripts 코어 모듈 분해 리팩토링 TypeScript 구조
        result: 4 nodes; epic 006-scripts-typescript와 이번 035 인덱스만. 코드 경로 힌트 없음.
---
# Tasks

Blueprint: [001](../../index.md)

## Goal & intent
`session-graph.ts`(481줄)와 `import-history.ts`(522줄)가 각각 세 모듈로 나뉜다.
두 파일 모두 같은 모양의 문제를 갖는다 — 「무엇을 할지 정하는」 순수 계산과
「실제로 `graphify`/`git`을 부르고 파일을 쓰는」 부수효과가 한 파일에 섞여
있다. 경계를 파일로 그으면 어느 함수가 주입 가능한 `deps` 없이도 안전한지가
읽는 것만으로 드러난다.

계획 결과 객체의 필드, 그래프 상태 어휘(`updated` / `reused` / `fail-skip` /
`skip-disabled` / `missing`), 임포트 거부 사유는 그대로다.

## Interface
- 제공: `scripts/lib/session-graph.js`와 `scripts/lib/import-history.js`의
  `module.exports` 키 집합이 지금과 동일하다. 구현이 옮겨 가더라도 두 파일이
  배럴로 재수출한다. `hooks/session-graph.js`가 이 이름으로만 접근한다.
- 제공: 두 파일이 공유하는 TypeScript 타입은 `scripts/src/lib/import-types.ts`에
  모은다(`ImportPlan`, `ImportEntry`, `RawCommit`, `ImportError` 등 현재
  `import-history.ts` 상단에 선언된 것들).
- 거부: 그래프 상태 어휘·경로 정규화 결과·`graphSyncWarnings` 문구 변경,
  임포트 커밋 메시지 조립 방식 변경, 새 CLI 표면.

## Touch
- Create `scripts/src/lib/graph-scope.ts` — `SCAN_EXCLUDED_DIRS`,
  `DEFAULT_SOURCE_OUT`, `DEFAULT_CONTEXT_OUT`, `DEFAULT_CONTEXT_DIRS`,
  `realGraphifyEnabled`, `realSourceDirs`, `realContextDirs`,
  `realExistingDirs`, `newestMtimeUnder`, `realNewestMtime`, `realGraphMtime`,
  `resolveGraphScopes`. 어떤 범위가 최신인지 판정하는 층 — 파일시스템 읽기만
  한다.
- Create `scripts/src/lib/graph-exec.ts` — `realHasGraphify`, `graphifyOutEnv`,
  `partOutDir`, `runGraphifyUpdate`, `normalizeGraphPaths`, `defaultExecGraphify`.
  실제로 graphify를 부르고 결과 경로를 되돌리는 층. `realHasGraphify`가 여기
  있는 이유는 `resolveGraphifyBin`의 PATH 탐색이 `execFileSync('graphify',
  ['--version'])`를 돌리기 때문이다 — 이름은 판정처럼 보이지만 프로세스를
  띄운다.
- Modify `scripts/src/lib/session-graph.ts` — `planOneGraph`, `planSessionGraph`,
  `NO_GRAPH_WORK`, `syncSessionGraphs`, `graphSyncWarnings`와 배럴 재수출.
- Create `scripts/src/lib/import-types.ts` — 세 임포트 모듈이 공유하는 타입 선언.
  `tsconfig`가 `moduleDetection: force`라 모든 `.ts`가 모듈이므로, 소비자는
  `import type { … } from './import-types';`로 가져온다. 런타임 값 참조는 지금처럼
  `require`로 남긴다. 타입만 있는 파일이므로 emit은 빈 exports 스텁이다 —
  그래도 커밋되는 산출이라 `affected_paths`에 넣는다.
- Create `scripts/src/lib/import-git.ts` — `LOG_FORMAT`, `EPIC_ID_PREFIX_RE`,
  `slugFromSubject`, `parseLogOutput`, `gitLogArgs`, `listChangedFiles`.
  git 로그를 읽고 파싱하는 층.
- Create `scripts/src/lib/import-render.ts` — `renderEpicBody`,
  `renderBlueprintBody`, `writeImportDoc`. 문서 본문을 만드는 층.
- Modify `scripts/src/lib/import-history.ts` — `emptyPlan`, `nextEpicId`,
  `collectRefusals`, `planImport`, `failResult`, `applyImport`와 배럴 재수출.
- Create `scripts/lib/graph-scope.js` — emit.
- Create `scripts/lib/graph-exec.js` — emit.
- Modify `scripts/lib/session-graph.js` — emit.
- Create `scripts/lib/import-types.js` — emit.
- Create `scripts/lib/import-git.js` — emit.
- Create `scripts/lib/import-render.js` — emit.
- Modify `scripts/lib/import-history.js` — emit.

## Do not touch
- `test/**` — `test/session-graph.test.js`, `test/import-history.test.js`,
  `test/graphify.test.js`가 계약을 고정한다.
- `hooks/session-graph.js`, `hooks/session-legacy-ids.js` — 훅은 공개 이름만
  부르며 그 이름은 바뀌지 않는다.
- `scripts/src/lib/graphify.ts` — `resolveGraphifyBin`은 단일 해석기로 그대로
  둔다.
- `scripts/src/lib/context-digest.ts` — 컨텍스트 다이제스트 빌드는 이 task 밖이다.
- `scripts/vendor/**`.

## Constraints
- 옮기거나 새로 만드는 함수는 내부의 의미 있는 로직 블록(가드, 분기, 루프,
  누적, 조기 반환)마다 한국어 주석을 단다. 주석은 다음 줄이 이미 말하는
  *무엇*이 아니라 *왜*를 적는다 — 이 순서여야 하는 이유, 이 값을 거르는 이유,
  이 분기를 만들게 한 실패 사례, 의도적으로 하지 않은 선택. 특히 그래프 신선도
  판정에서 파생 트리(`graphify-out`)를 왜 걷지 않는지, 임포트 거부 검사가 왜
  첫 쓰기 앞에 전부 모여 있어야 하는지를 남긴다.
- 부수효과 경계를 흐리지 않는다. `graph-scope.ts`는 읽기(`fs.stat`,
  `existsSync`)만 하고 외부 프로세스를 부르지 않는다 — `graphify.ts`도
  require하지 않는다(그 모듈의 PATH 탐색이 프로세스를 띄운다). 프로세스 실행은
  `graph-exec.ts`에만 둔다.
- `import-git.ts`의 git 호출은 지금처럼 주입된 `deps.execFileSync`를 통해서만
  한다. 모듈 안에서 직접 `child_process`를 부르지 않는다.
- 그래프 부재는 오류가 아니라 상태다. `syncSessionGraphs`가 `NO_GRAPH_WORK`
  경로에서 `ok`를 뒤집지 않는 동작을 유지한다.
- 순환 금지: `graph-exec` / `graph-scope`는 `session-graph`를 require하지 않고,
  `import-git` / `import-render`는 `import-history`를 require하지 않는다.
- 하위 디렉터리를 만들지 않는다. 평평한 형제 파일로만 나눈다.
- 커밋 전에 `npm run build`로 emit을 갱신한다.

## Checklist
- [ ] `graph-scope.ts`를 만들고 설정·디렉터리·mtime 판정 함수를 옮긴다.
      `newestMtimeUnder`가 `graphify-out`, `node_modules`, `.git`, `.worktrees`를
      건너뛰고 디렉터리 심링크를 따라가지 않는 동작을 그대로 둔다.
- [ ] `graph-exec.ts`를 만들고 `realHasGraphify`와 graphify 실행·경로 정규화를
      옮긴다.
      `normalizeGraphPaths(..., { map })` 리맵 경로가 유지되는지 확인한다.
- [ ] `session-graph.ts`에 계획·오케스트레이션·경고 문구만 남기고 배럴로
      재수출한다. 키 집합 확인:
      ```bash
      node -e "console.log(Object.keys(require('./scripts/lib/session-graph')).sort().join(','))"
      ```
- [ ] `import-types.ts`를 만들고 `import-history.ts` 상단 타입 선언을 옮긴다.
      소비자는 `import type { … } from './import-types';`를 쓴다 —
      `moduleDetection: force`라 bare 타입 별칭은 파일을 넘어 보이지 않는다.
      `npm run typecheck`로 확인한다.
- [ ] `import-git.ts`를 만들고 git 로그 파싱을 옮긴다.
- [ ] `import-render.ts`를 만들고 본문 렌더·문서 쓰기를 옮긴다. import epic
      본문이 `## Intent`와 `## Blueprints`만 갖는 현재 형태를 유지한다.
- [ ] `import-history.ts`에 계획·거부·적용만 남기고 배럴로 재수출한다
      (`planImport`, `applyImport`).
- [ ] 순환 의존이 없는지 확인한다 — 하위 모듈에서 `require('./session-graph')`
      / `require('./import-history')` 히트가 0이어야 한다.
- [ ] 일곱 파일이 각각 400줄 이하인지 확인한다.
- [ ] 훅이 여전히 동작하는지 본다:
      ```bash
      node hooks/session-graph.js
      ```
- [ ] `npm test`가 `test/**` 수정 없이 통과한다.
- [ ] `npm run lint`가 통과하고 `git diff --exit-code -- scripts/lib`가 빌드 후
      깨끗하다.
