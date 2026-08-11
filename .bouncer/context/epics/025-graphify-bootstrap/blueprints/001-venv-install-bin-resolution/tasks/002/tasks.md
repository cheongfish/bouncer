---
type: bouncer.tasks
title: init이 .bouncer/.venv에 graphify를 설치하고 경로를 기록
description: venv 설치와 멱등·실패 처리, 기존 config 승격 플래그, .gitignore 마커 블록
resource: .bouncer/context/epics/025-graphify-bootstrap/blueprints/001-venv-install-bin-resolution/tasks/002/tasks.md
tags:
  - bouncer
  - tasks
timestamp: '2026-08-11T13:29:26.057+09:00'
bouncer:
  id: TASKS-002
  epic_id: '025'
  blueprint_id: '001'
  status: ready
  commit_intent:
    - graphify 설치가 사용자 몫이라 부트스트랩 직후 그래프가 비어 있었음
    - init이 격리된 venv에 설치하고 실패해도 부트스트랩을 막지 않게 하려 함
  affected_paths:
    - scripts/src/lib/graphify.ts
    - scripts/lib/graphify.js
    - scripts/src/lib/init.ts
    - scripts/lib/init.js
    - scripts/src/lib/cli.ts
    - scripts/lib/cli.js
    - scripts/src/lib/finalize.ts
    - scripts/lib/finalize.js
    - test/graphify.test.js
    - test/init.test.js
    - test/cli-init.test.js
    - test/finalize.test.js
    - .gitignore
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
        result: 52 nodes; init()/defaultConfig()/gitignoreSuggestions()가 상위 히트
      - graph: context
        status: updated
        query: graphify 설치 실행 경로 init config 기본값
        result: 15 nodes; 003-multi-agent-plugin distill만 히트해 경로 근거로는 쓰지 않음
---
# Tasks

Blueprint: [001](../../index.md)

## Goal & intent

`bouncer init`이 새 프로젝트를 부트스트랩할 때 `.bouncer/.venv`를 만들고 graphify를 설치한
뒤 그 실행 파일 경로를 `config.graphify.bin`에 기록한다. python이 없거나 설치가 실패하면
경고만 남기고 exit 0으로 끝난다. 이미 초기화된 프로젝트의 `graphify.enabled`는 명시적
승격 요청이 있을 때만 바뀐다. `.gitignore`는 요청이 있을 때만, 마커 블록 안에서만 쓴다.

## Interface

- 제공
  - `setupGraphify({ repoRoot, exec, platform })` — `scripts/src/lib/graphify.ts`에 추가.
    - venv 실행 파일이 이미 있으면 아무것도 실행하지 않고
      `{ status: 'reused', bin: <rel path> }`.
    - 없으면 `python3 -m venv .bouncer/.venv` → `<venv>/bin/pip install graphifyy` →
      `<venv>/bin/graphify install` 순서로 실행하고 `{ status: 'installed', bin }`.
    - 어느 단계든 실패하면 `{ status: 'failed', bin: null, reason: <단계와 메시지> }`.
      throw하지 않는다.
    - `exec`는 주입 가능한 `execFileSync` 자리. 테스트는 항상 주입한다.
  - `init({ repoRoot, timestamp, graphify })` — `graphify`는 `{ install, setup }`.
    `install`의 라이브러리 기본값은 `false`이고, `setup` 기본값은 `setupGraphify`.
    - 신규 부트스트랩 + `install: true`: `setup`을 돌린 결과로 config를 만든다. 성공이면
      `graphify: { enabled: true, bin }`, 실패면 `graphify: { enabled: false }`.
    - 결과에 `graphifyInstall: { status, bin?, reason? }`을 담는다. 실패해도 `ok`는 그대로다.
  - `init` 승격 경로 — bootstrap이 `ready`이고 기존 `graphify.enabled`가 `true`가 아닐 때:
    - 기본 호출은 아무것도 쓰지 않고 `graphifyPromotion: 'candidate'`만 보고한다.
    - `promote: true`면 기존 config를 파싱해 `graphify.enabled`(+ 설치 성공 시 `bin`)만
      바꿔 다시 쓰고 `graphifyPromotion: 'promoted'`를 보고한다.
  - `.gitignore` 쓰기 — `writeGitignore: true`일 때만. `# bouncer`와 `# /bouncer` 사이를
    `SUGGESTED_IGNORES`로 채운다. 블록이 이미 있으면 그 안만 갱신하고, 없으면 파일 끝에
    붙인다. 파일이 없으면 만든다. 결과에 `gitignoreWritten: true|false`.
  - `SUGGESTED_IGNORES`에 `.bouncer/.venv/`를 더하고, finalize의 `RUNTIME_ARTIFACTS`에도
    같은 항목을 더해 venv 파일이 범위 위반으로 보고되지 않게 한다.
  - CLI `bouncer init` 플래그: `--no-graphify`, `--promote-graphify`, `--write-gitignore`.
    `cmdInit`은 기본으로 `install: true`를 넘긴다.
- 거부
  - bootstrap이 `partial`/`legacy`면 설치도 승격도 시도하지 않는다. 기존 반환값을 유지한다.
  - 승격은 `graphify.enabled`(와 `bin`) 외 어떤 키도 바꾸지 않는다. 파일을 재생성하지 않는다.
  - `--promote-graphify` 없이 기존 config가 바뀌는 경로는 없다.
  - 마커 블록 밖의 `.gitignore` 내용은 읽기만 하고 바꾸지 않는다.
  - `setupGraphify`는 venv가 있으면 upgrade를 시도하지 않는다.

## Touch

- Modify `scripts/src/lib/graphify.ts` — `setupGraphify` 추가.
- Modify `scripts/lib/graphify.js` — 위 emit.
- Modify `scripts/src/lib/init.ts` — 설치 배선, 승격 분기, 마커 블록 쓰기, `SUGGESTED_IGNORES`.
- Modify `scripts/lib/init.js` — 위 emit.
- Modify `scripts/src/lib/cli.ts` — `cmdInit` 플래그 세 개와 `install: true` 기본값.
- Modify `scripts/lib/cli.js` — 위 emit.
- Modify `scripts/src/lib/finalize.ts` — `RUNTIME_ARTIFACTS`에 `.bouncer/.venv/` 추가,
  ".gitignore를 직접 수정하지 않음" 주석을 동의 기반 쓰기로 정정.
- Modify `scripts/lib/finalize.js` — 위 emit.
- Modify `test/finalize.test.js` — runtime artifact 목록 검사에 venv 경로 추가.
- Modify `test/graphify.test.js` — `setupGraphify` 순서·멱등·실패 계약.
- Modify `test/init.test.js` — 설치 주입, 승격, 마커 블록, 기존 `.gitignore` 불변 테스트 갱신.
- Modify `test/cli-init.test.js` — 플래그별 동작.
- Modify `.gitignore` — 이 저장소도 `.bouncer/.venv/`를 무시한다.

## Do not touch

- `scripts/src/lib/session-graph.ts` — 해석기 소비는 TASKS-001에서 끝났다.
- `hooks/session-graph.js` — 훅은 설치를 하지 않는다.
- `docs/**`, `skills/**` — TASKS-003이 맡는다.
- `.bouncer/config.json` — 이 저장소는 이미 `graphify.enabled: true`다.
- `config.example.json` — TASKS-001에서 이미 맞췄다.

## Constraints

- 설치는 네트워크를 탄다. 테스트는 `exec`/`setup`을 반드시 주입하고 실제 pip을 호출하지
  않는다. `init()`의 라이브러리 기본값이 설치 안 함인 이유가 이것이다.
- venv를 activate하지 않는다. bin의 실행 파일을 경로로 직접 호출한다. 셸 블록마다 새 셸이라
  activate 상태가 이어지지 않는다.
- 설치 실패로 init을 하드 실패시키지 않는다(`ok`와 exit code 유지).
- `.gitignore` 쓰기는 동의 신호(`--write-gitignore`)가 있을 때만 일어난다. 기본 `init`은
  지금처럼 제안만 한다.
- 승격은 `graphify.enabled` 한 키에만 적용한다. `verify`, `base_branch`, `source_dirs` 등
  다른 기본값을 위한 범용 마이그레이션 경로를 만들지 않는다.
- `scripts/lib/*.js`는 `npm run build`로 재생성한다.
- 코드 주석은 한국어, CLI 출력 문자열은 영어.

## Checklist

- [ ] `test/graphify.test.js`에 `setupGraphify` 테스트를 먼저 추가하고 실패를 확인한다.
  - venv 실행 파일이 있으면 `exec` 호출 0회, `status: 'reused'`
  - 없으면 호출 순서가 `python3 -m venv …` → `…/pip install graphifyy` →
    `…/graphify install`, `status: 'installed'`
  - 첫 단계에서 throw하면 이후 단계를 실행하지 않고 `status: 'failed'` + `reason`에 단계 표시
  - 어떤 실패에도 `setupGraphify` 자신은 throw하지 않는다
- [ ] `setupGraphify`를 구현한다.
- [ ] `test/init.test.js`에 다음을 추가하고 실패를 확인한다.
  - `init({ repoRoot, graphify: { install: true, setup: () => ({ status: 'installed', bin: '.bouncer/.venv/bin/graphify' }) } })`
    가 쓴 config가 `{ enabled: true, bin: '.bouncer/.venv/bin/graphify' }`
  - `setup`이 `failed`를 돌려주면 config는 `{ enabled: false }`이고 `result.ok`는 `true`,
    `result.graphifyInstall.reason`이 비어 있지 않다
  - `install`을 넘기지 않으면 `setup`이 호출되지 않는다
  - ready bootstrap + 기존 `graphify.enabled: false` + 승격 요청 없음 → config 파일이
    바이트 단위로 그대로이고 `graphifyPromotion === 'candidate'`
  - 같은 상황 + `promote: true` → `graphify.enabled`만 `true`가 되고 `verify`,
    `base_branch`, `source_dirs`, `subagents`가 보존된다
  - `writeGitignore: true`를 두 번 실행해도 `# bouncer` 블록이 하나뿐이고
    `.bouncer/.venv/`가 그 안에 있다
  - 마커 블록 밖 기존 줄은 그대로 남는다
  - `writeGitignore` 없이 부르면 기존 `.gitignore`가 바이트 단위로 불변이고 파일이 없으면
    만들지 않는다(기존 두 테스트 유지)
- [ ] `init.ts`를 구현해 위를 통과시킨다.
- [ ] `cli.ts`의 `cmdInit`에 `--no-graphify`, `--promote-graphify`, `--write-gitignore`를
      배선하고 기본 `install: true`를 넘긴다. `test/cli-init.test.js`에 플래그별 동작을
      추가한다(`--no-graphify`가 설치를 건너뛰는지 포함).
- [ ] `finalize.ts`의 `RUNTIME_ARTIFACTS`에 `.bouncer/.venv/`를 넣고
      `test/finalize.test.js:282` 근처 목록 검사를 함께 갱신한다.
- [ ] 저장소 `.gitignore`에 `.bouncer/.venv/`를 추가한다.
- [ ] `npm run build`로 emit을 재생성한다.
- [ ] `npm test`가 통과한다.
