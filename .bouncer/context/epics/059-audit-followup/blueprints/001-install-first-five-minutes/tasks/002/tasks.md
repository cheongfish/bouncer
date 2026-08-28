---
type: bouncer.tasks
title: graphify venv를 작업 트리 밖으로 이동하고 실패 잔해 정리
description: venv를 git common directory 아래로 옮겨 사용자 저장소에 스테이징되지 않게 하고 설치 실패 시 잔해를 지운다
resource: .bouncer/context/epics/059-audit-followup/blueprints/001-install-first-five-minutes/tasks/002/tasks.md
tags:
  - bouncer
  - tasks
timestamp: '2026-08-28T15:37:35.955+09:00'
bouncer:
  id: TASKS-002
  epic_id: '059'
  blueprint_id: '001'
  status: verified
  commit_intent:
    - 사용자 저장소 안에 만든 venv가 부트스트랩 커밋에 그대로 딸려 들어감
    - 설치가 실패해도 반쯤 만들어진 venv가 작업 트리에 남아 있음
  verify: npm run ci
  affected_paths:
    - scripts/src/lib/graphify.ts
    - scripts/lib/graphify.js
    - scripts/src/lib/init.ts
    - scripts/lib/init.js
    - test/graphify.test.js
    - test/init.test.js
    - test/cli-init.test.js
    - docs/configuration.md
    - docs/troubleshooting.md
    - docs/install.md
  scope_evidence:
    producer: graphify
    generated_at: '2026-08-28T15:43:07.000+09:00'
    suggested_paths:
      - test
      - .bouncer/context/epics/025-graphify-bootstrap/blueprints/001-venv-install-bin-resolution/tasks/001
      - .bouncer/context/epics/025-graphify-bootstrap/blueprints/001-venv-install-bin-resolution/tasks/002
      - .bouncer/context/epics/025-graphify-bootstrap/blueprints/001-venv-install-bin-resolution/tasks/003
    basis:
      - graph: source
        status: reused
        query: bouncer init base_branch default graphify venv install codex agents toml bootstrap commit scope gitignore
        result: 93 nodes, 3 files - test/init.test.js, test/public-name-regression.test.js, test/agents.test.js
      - graph: context
        status: updated
        query: init base_branch graphify venv codex agents bootstrap commit scope
        result: 3 files under epic 025 venv-install-bin-resolution tasks 001-003
---
# Tasks

Blueprint: [001](../../index.md)

## Goal & intent
graphify venv를 `.bouncer/.venv/`에서 git common directory 아래(`<git-common-dir>/bouncer/venv`)로 옮긴다. 그러면 venv가 작업 트리 밖에 있으므로 `git add`로 스테이징될 수 없고, `.gitignore` 동의 여부와 무관하게 B1의 재현이 사라진다. 함께, 설치가 중간에 실패하면 만들다 만 venv 디렉터리를 지우고 `graphify.enabled`를 `false`로 내린다. 위치 결정은 `runtime-state.ts`가 이미 쓰는 common directory 규약을 재사용한다 — 새 경로 개념을 만들지 않는다.

## Interface
- 제공: `graphify.ts`의 venv 실행 파일·pip 경로가 저장소 상대 경로 대신 common directory 기준 절대 경로를 쓴다. Windows(`Scripts/graphify.exe`, `Scripts/pip.exe`)도 같은 기준을 따른다.
- 제공: 설치 실패 시 이번 실행이 만든 venv 디렉터리를 지운 뒤 실패 결과를 반환한다.
- 거부: `init`을 실패시키지 않는다. graphify 설치 실패는 지금처럼 soft-fail이고 종료 코드는 0이다.
- 거부: 이미 `.bouncer/.venv/`를 가진 저장소를 강제로 이전하거나 지우지 않는다. 그 경로가 존재하면 후보 탐색이 계속 그것을 찾아 쓴다.
- 제공: git 저장소가 아닌 디렉터리에서는 common directory가 없으므로 기존 `.bouncer/.venv` 위치로 폴백한다. `init`은 비-git 디렉터리에서도 지원되고 현재 픽스처가 그렇다(`test/cli-init.test.js:44`).
- 제공: 같은 실행 안에서 설치를 시도했는지와 `config.graphify.enabled`에 기록되는 값이 어긋나지 않는다 — 감사 B4가 지적한 config 모순의 나머지 절반이다.
- 거부: 이번 실행이 만들지 않은 디렉터리를 지우지 않는다.
- 하위 호환: epic 025 blueprint 001이 `config.graphify.bin`을 저장소 루트 기준 상대 경로로 정했다. 이 task는 새로 기록하는 값만 새 위치의 절대 경로로 바꾸고, 기존 상대 경로 값은 계속 유효하게 해석한다. 소비자 config를 다시 쓰지 않는다.

## Touch
- Modify `scripts/src/lib/graphify.ts` — venv 실행 파일·pip 경로 결정을 common directory 기준으로 바꾸고, 실패 시 이번 실행 산출물만 정리한다
- Modify `scripts/lib/graphify.js` — 위 변경의 `tsc` 산출물
- Modify `scripts/src/lib/init.ts` — `SUGGESTED_IGNORES`에서 `.bouncer/.venv/`의 처지를 새 위치에 맞게 정리하고, 설치 호출부가 새 경로 결과를 그대로 기록하게 한다
- Modify `scripts/lib/init.js` — 위 변경의 `tsc` 산출물
- Modify `test/graphify.test.js` — 새 위치 결정, Windows 분기, 실패 시 정리, 기존 `.bouncer/.venv/` 재사용 네 경로를 단언한다
- Modify `test/init.test.js` — `init` 뒤 작업 트리에 venv 경로가 생기지 않는지, 설치 시도와 기록된 `enabled`가 일치하는지 단언한다
- Modify `test/cli-init.test.js` — `.gitignore` 마커 블록 단언(`:52`)이 `SUGGESTED_IGNORES` 변경과 어긋나지 않게 맞춘다
- Modify `docs/configuration.md` — `graphify.bin`이 가리키는 위치를 새 규약으로 적는다
- Modify `docs/troubleshooting.md` — venv 위치를 찾는 안내를 새 경로로 고친다
- Modify `docs/install.md` — 설치 산출물이 저장소 밖에 놓인다는 사실을 적는다

## Do not touch
- `scripts/src/lib/graph-exec.ts` — 실행 후보 해석 순서(config → venv → PATH)는 그대로다
- `scripts/src/lib/runtime-state.ts` — common directory 규약을 재사용만 하고 바꾸지 않는다
- `CLAUDE.md`
- `rules/`

## Constraints
- 후보 탐색 순서 `config.graphify.bin` → venv → PATH를 바꾸지 않는다. 바뀌는 것은 venv 후보가 가리키는 위치뿐이다.
- 기존 소비자 저장소의 `config.graphify.bin` 값은 유효한 한 그대로 쓴다. 경로 이전 마이그레이션을 넣지 않는다.
- 정리는 이번 실행이 만든 디렉터리에 한정한다. 존재하던 디렉터리를 재사용한 경우 실패해도 지우지 않는다.
- TS를 고치면 `npm run build` 산출물을 같은 커밋에 포함한다.
- `scripts/src/lib/scope.ts`의 `RUNTIME_ARTIFACTS`에 있는 `.bouncer/.venv/`는 그대로 둔다. 레거시 저장소와 비-git 폴백이 여전히 그 경로를 쓴다.
- epic 025 blueprint 001의 venv 위치 결정(``.bouncer/.venv``)을 이 task가 대체한다. 그 blueprint 문서는 닫혀 있으므로 소급 수정하지 않고, 새 결정은 이 task와 `docs/`에만 적는다.

## Checklist
- [ ] `test/graphify.test.js`에 실패 테스트를 먼저 쓴다 — venv 후보 경로가 작업 트리 밖(common directory 아래)인지:
      ```js
      assert.ok(!venvAbs.startsWith(path.join(repoRoot, '.bouncer')));
      ```
- [ ] git 저장소가 아닌 임시 디렉터리 픽스처에서 venv 경로가 `.bouncer/.venv` 폴백인지 단언한다
- [ ] Windows 플랫폼 인자로 같은 단언을 반복하고 `Scripts/` 분기가 유지되는지 확인한다
- [ ] 설치 중간 실패를 강제하는 픽스처에서 이번 실행이 만든 디렉터리가 남지 않는지 단언한다
- [ ] 기존 `.bouncer/.venv/bin/graphify`가 있는 픽스처에서 그 경로가 계속 선택되는지 단언한다
- [ ] 저장소 상대 경로가 들어 있는 기존 `config.graphify.bin` 픽스처에서 그 값이 계속 해석되는지 단언한다
- [ ] 위 테스트들이 실패하는 것을 확인한다
- [ ] `scripts/src/lib/graphify.ts`의 경로 결정과 실패 정리를 구현한다
- [ ] `scripts/src/lib/init.ts`의 `SUGGESTED_IGNORES`와 설치 호출부를 새 위치에 맞춘다
- [ ] `npm run build`로 산출물을 갱신한다
- [ ] `test/init.test.js`에 `init` 뒤 작업 트리 venv 부재 단언을 더한다
- [ ] `test/cli-init.test.js:52`의 마커 블록 단언을 새 `SUGGESTED_IGNORES`에 맞춘다
- [ ] `docs/configuration.md`·`docs/troubleshooting.md`·`docs/install.md`의 경로 안내를 고친다
- [ ] `npm run ci`가 통과한다
