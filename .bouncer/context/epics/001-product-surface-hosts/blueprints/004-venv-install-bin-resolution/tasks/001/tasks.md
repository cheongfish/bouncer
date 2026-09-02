---
type: bouncer.tasks
title: graphify 실행 경로 해석기 신설과 기본 활성화
description: resolveGraphifyBin을 만들어 session-graph 호출부와 CLI가 쓰게 하고 graphify.enabled 기본값을 올림
resource: .bouncer/context/epics/001-product-surface-hosts/blueprints/004-venv-install-bin-resolution/tasks/001/tasks.md
tags:
  - bouncer
  - tasks
timestamp: '2026-08-11T13:29:26.057+09:00'
bouncer:
  id: TASKS-001
  epic_id: '001'
  blueprint_id: '004'
  status: verified
  commit_intent:
    - 그래프 빌드가 PATH의 graphify만 찾아 격리 설치본을 쓰지 못했음
    - 설정·venv·PATH 순으로 실행 파일을 고르는 단일 해석기를 두려 함
  affected_paths:
    - scripts/src/lib/graphify.ts
    - scripts/lib/graphify.js
    - scripts/src/lib/session-graph.ts
    - scripts/lib/session-graph.js
    - scripts/src/lib/init.ts
    - scripts/lib/init.js
    - scripts/src/lib/cli.ts
    - scripts/lib/cli.js
    - config.example.json
    - test/graphify.test.js
    - test/session-graph.test.js
    - test/init.test.js
    - test/cli-help.test.js
  graph:
    generated_at: '2026-08-11T13:43:15+09:00'
    command: graphify query (source + context)
    suggested_paths:
      - scripts/src/lib
      - scripts/lib
      - test
      - skills/graphify-runner
      - skills/bouncer-init
      - docs
    basis:
      - graph: source
        status: reused
        query: graphify bin resolution venv install init config gitignore session-graph
        result: 52 nodes; scripts/src/lib/{init,session-graph,cli}.ts와 그 CJS emit이 상위
      - graph: context
        status: updated
        query: graphify 설치 실행 경로 init config 기본값
        result: 15 nodes; 003-multi-agent-plugin distill만 히트해 경로 근거로는 쓰지 않음
---
# Tasks

Blueprint: [004](../../index.md)

## Goal & intent

graphify 실행 파일을 고르는 곳이 한 군데가 된다. `scripts/src/lib/session-graph.ts`는
`graphify`를 이름으로 실행하지 않고 해석된 절대 경로(또는 PATH 이름)를 받아 쓴다. 새
`bouncer init`이 쓰는 config의 `graphify.enabled`는 `true`가 된다. 설치 자체는 다음 task가
맡고, 여기서는 "설치돼 있으면 찾아 쓴다"까지 완성한다.

## Interface

- 제공
  - `scripts/src/lib/graphify.ts` 신설, CJS emit `scripts/lib/graphify.js`.
    - `venvBinRel(platform)` — `win32`면 `.bouncer/.venv/Scripts/graphify.exe`, 그 외
      `.bouncer/.venv/bin/graphify`. 반환값은 POSIX 구분자 상대 경로.
    - `resolveGraphifyBin({ repoRoot, config, platform, exists, hasOnPath })` —
      `{ bin, source }`. 후보 순서는 `config.graphify.bin` → `venvBinRel` → PATH의
      `graphify`. 앞 후보가 실존하지 않으면 다음으로 내려간다. `config`/`platform`/
      `exists`/`hasOnPath`는 모두 선택이며 기본값은 실제 파일 시스템과 `process.platform`.
      `bin`은 `source`가 `config`/`venv`일 때 절대 경로, `path`일 때 `'graphify'`.
    - 모듈은 `.bouncer/config.json`을 스스로 읽어도 되지만 읽기 실패는 `config` 없음과
      같게 다룬다.
  - CLI `bouncer graphify-bin` — 해석된 `bin`을 stdout에 한 줄 출력하고 exit 0.
  - `config.graphify.bin` — 저장소 루트 기준 상대 경로 문자열(선택). `init`의 기본 config에는
    쓰지 않는다(다음 task).
- 거부
  - `resolveGraphifyBin`은 어떤 입력에도 throw하지 않는다. 후보가 없으면
    `{ bin: null, source: null }`.
  - `config.graphify.bin`이 문자열이 아니거나 빈 문자열이면 없는 것으로 본다.
  - `bouncer graphify-bin`은 해석 실패 시 stdout에 아무것도 쓰지 않고 stderr에 사유를 남긴 뒤
    exit 1.

## Touch

- Create `scripts/src/lib/graphify.ts` — 실행 경로 해석기. `init.ts`가 다음 task에서 이 모듈을
  쓰는데 `session-graph.ts`가 이미 `init.ts`를 require하므로, 해석기를 `session-graph.ts`에
  두면 순환 참조가 된다.
- Create `scripts/lib/graphify.js` — 위 모듈의 CJS emit. 소비자는 Node만 쓰므로 커밋한다.
- Modify `scripts/src/lib/session-graph.ts` — `realHasGraphify`, `runGraphifyUpdate`,
  `defaultExecGraphify`의 `merge-graphs` 호출을 해석된 `bin`으로 바꾼다.
- Modify `scripts/lib/session-graph.js` — 위 emit.
- Modify `scripts/src/lib/init.ts` — `defaultConfig`의 `graphify: { enabled: false }`를
  `true`로 바꾼다.
- Modify `scripts/lib/init.js` — 위 emit.
- Modify `scripts/src/lib/cli.ts` — `graphify-bin` 명령과 help 한 줄 추가.
- Modify `scripts/lib/cli.js` — 위 emit.
- Modify `config.example.json` — `graphify.enabled`를 `true`로, `bin` 설명은 문서에 맡긴다.
- Create `test/graphify.test.js` — 해석 순서·플랫폼·비throw 계약.
- Modify `test/session-graph.test.js` — exec 대상이 해석된 경로임을 검사.
- Modify `test/init.test.js` — `init writes the exact config.json shape` 기대값의
  `graphify.enabled`를 `true`로.
- Modify `test/cli-help.test.js` — 명령 목록에 `graphify-bin` 반영.

## Do not touch

- `hooks/session-graph.js` — `syncSessionGraphs`만 호출한다. 해석은 그 안에서 끝나야 한다.
- `scripts/src/lib/schema.ts` — `config.json`은 OKF 문서 frontmatter가 아니라 프로젝트
  설정이며 schema 등록 대상이 아니다.
- `.bouncer/config.json` — 이 저장소 자신의 설정은 이번 커밋에서 바꾸지 않는다.
- `.gitignore` — 다음 task가 맡는다.
- `docs/**`, `skills/**` — TASKS-003이 맡는다.

## Constraints

- `scripts/lib/*.js`는 손으로 고치지 않는다. `npm run build`(또는 `pretest`)로 재생성한 결과를
  커밋한다. `outDir`/`rootDir` 설정을 바꾸지 않는다.
- `session-graph.ts`에 `'graphify'` 문자열 리터럴을 실행 대상으로 남기지 않는다. PATH 폴백일
  때의 `'graphify'`는 해석기가 돌려준 값이어야 한다.
- `planSessionGraph`의 action 문자열(`skip-no-graphify` 등)과 `graphSyncWarnings` 문구는
  그대로 둔다. 해석 실패는 새 상태가 아니라 기존 "PATH에 없음"과 같은 상태다.
- 그래프 부재는 상태이지 오류다 — 해석 실패로 exit code를 바꾸지 않는다(`graphify-bin` 명령
  자체는 예외).
- 새 런타임 의존성을 추가하지 않는다. `node:` 내장 모듈만 쓴다.
- 코드 주석은 주변 파일과 같이 한국어로 쓰고, CLI 출력 문자열은 영어를 유지한다.

## Checklist

- [ ] `test/graphify.test.js`를 먼저 쓰고 실패를 확인한다. 최소 다음을 덮는다.
  - `venvBinRel('win32') === '.bouncer/.venv/Scripts/graphify.exe'`,
    `venvBinRel('linux') === '.bouncer/.venv/bin/graphify'`
  - `config.graphify.bin`이 실존하면 `{ source: 'config' }`
  - `bin`이 없거나 실존하지 않고 venv 실행 파일이 있으면 `{ source: 'venv' }`
  - venv 디렉터리는 있으나 실행 파일이 없고 PATH에 있으면 `{ source: 'path', bin: 'graphify' }`
  - 아무 후보도 없으면 `{ bin: null, source: null }`
  - `config`가 `null`, `graphify`가 문자열, `bin`이 숫자여도 throw하지 않는다
- [ ] `scripts/src/lib/graphify.ts`를 구현해 위 테스트를 통과시킨다.
- [ ] `test/session-graph.test.js`에 exec 대상 검사를 추가한다. `runGraphifyUpdate`가
      주입된 `exec`를 호출할 때 첫 인자가 해석된 경로여야 한다.
- [ ] `session-graph.ts`의 `realHasGraphify`를 해석기 기반으로 바꾼다. `command -v` 폴백은
      해석기의 PATH 후보 판정으로 흡수한다.
- [ ] `runGraphifyUpdate`와 `merge-graphs` 호출이 해석된 `bin`을 쓰게 배선한다. 해석은 실행
      루프마다 반복하지 말고 한 번 구한 값을 넘긴다.
- [ ] `defaultConfig`의 `graphify.enabled`를 `true`로 바꾸고 `test/init.test.js`의 기대
      config를 맞춘다.
- [ ] `config.example.json`의 `graphify.enabled`를 `true`로 맞춘다.
- [ ] `cli.ts`에 `graphify-bin` 명령을 추가한다. 성공은 `<path>\n`만 stdout에, 실패는 stderr +
      exit 1. help 목록과 `test/cli-help.test.js`를 함께 갱신한다.
- [ ] `npm run build`로 `scripts/lib/` emit을 재생성한다.
- [ ] `npm test`가 통과한다.
