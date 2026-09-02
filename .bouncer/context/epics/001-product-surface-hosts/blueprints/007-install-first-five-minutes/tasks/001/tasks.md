---
type: bouncer.tasks
title: base_branch 하드코딩 제거와 저장소 기본 브랜치 탐지
description: init이 base_branch와 pr.base를 저장소에서 탐지하고, 탐지에 실패하면 값을 추측하지 않고 묻는다
resource: .bouncer/context/epics/001-product-surface-hosts/blueprints/007-install-first-five-minutes/tasks/001/tasks.md
tags:
  - bouncer
  - tasks
timestamp: '2026-08-28T15:37:30.626+09:00'
bouncer:
  id: TASKS-001
  epic_id: '001'
  blueprint_id: '007'
  status: verified
  commit_intent:
    - 사내 관습인 `develop`이 제품 기본값으로 굳어 `main` 저장소에서도 잘못된 base가 쓰임
    - 탐지에 실패하면 값을 추측하지 않고 사용자에게 묻도록 함
  verify: npm run ci
  affected_paths:
    - scripts/src/lib/init.ts
    - scripts/lib/init.js
    - scripts/src/lib/cli-current-command.ts
    - scripts/lib/cli-current-command.js
    - test/init.test.js
    - test/cli-init.test.js
    - test/cli-current.test.js
    - config.example.json
    - docs/configuration.md
    - skills/bouncer-init/SKILL.md
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

Blueprint: [007](../../index.md)

## Goal & intent
`bouncer init`이 `config.json`의 `base_branch`와 `pr.base`를 저장소에서 탐지해 쓴다. `git init -b main` 저장소에서 `init`을 돌리면 두 값이 `main`이어야 하고, 탐지할 수 없는 저장소에서는 값을 추측하지 않고 `/bouncer-init`이 사용자에게 묻는다. 지금은 `scripts/src/lib/init.ts:72`와 `pr.base`가 `'develop'` 리터럴이라, 사용자는 첫 `/bouncer-finalize`에서 draft PR이 없는 base를 향할 때까지 이 사실을 모른다.

## Interface
- 제공: `init.ts`에 기본 브랜치 탐지를 더한다. 순서는 `git symbolic-ref --short refs/remotes/origin/HEAD`의 `origin/` 접두사를 뗀 값 → `git symbolic-ref --short HEAD`. 첫 성공값을 `base_branch`와 `pr.base`에 함께 쓴다.
- 제공: 둘 다 실패하면 `config.json`에 두 키를 쓰지 않고, `init` 반환 JSON에 미해결 신호를 실어 `/bouncer-init`이 브랜치 ACQ를 띄운다.
- 거부: 탐지 실패를 `develop`이나 `main`으로 대체하지 않는다. 예외를 밖으로 던지지 않고 미해결로 수렴한다.
- 제공: `bouncer current --set`의 base 결정에서도 `'develop'` 리터럴을 없앤다. 순서는 `config.base_branch` → 현재 체크아웃 브랜치. 지금은 `scripts/src/lib/cli-current-command.ts:126`이 config에 키가 없으면 `'develop'`으로 떨어지는데, 이 task가 탐지 실패 시 키를 비우기로 하면서 그 경로가 오히려 더 자주 밟힌다.
- 거부: 이미 `base_branch`가 있는 소비자 `config.json`을 다시 쓰지 않는다 — 기존 멱등 계약 그대로다.
- 거부: `config.example.json`의 `base_branch`·`pr.base` **키를 지우지 않는다**. 바꾸는 것은 값뿐이다. `test/public-contract.test.js`가 예시 config의 최상위 키 집합과 `docs/compatibility.md` 「설정 키」 표를 대조하므로, 키를 없애면 두 파일이 함께 열려야 한다.

## Touch
- Modify `scripts/src/lib/init.ts` — 기본 브랜치 탐지와 미해결 신호를 더하고 `'develop'` 리터럴 두 곳을 없앤다
- Modify `scripts/lib/init.js` — 위 변경의 `tsc` 산출물. `check:emit`이 대조한다
- Modify `scripts/src/lib/cli-current-command.ts` — base 결정의 `'develop'` 리터럴을 현재 브랜치 폴백으로 바꾼다
- Modify `scripts/lib/cli-current-command.js` — 위 변경의 `tsc` 산출물
- Modify `test/cli-current.test.js` — config에 `base_branch`가 없을 때 base가 `'develop'`이 아니라 현재 브랜치인지 단언한다
- Modify `test/init.test.js` — `main` 탐지·`origin/HEAD` 탐지·탐지 실패 미해결·기존 config 보존 네 경로를 단언한다
- Modify `test/cli-init.test.js` — CLI 반환 JSON에 미해결 신호가 실리는지 단언한다
- Modify `config.example.json` — `base_branch`·`pr.base`의 **값**만 중립적인 예시로 바꾼다. 키는 유지한다
- Modify `docs/configuration.md` — `base_branch`·`pr.base`의 결정 방식을 탐지 순서와 미해결 동작으로 다시 적는다
- Modify `skills/bouncer-init/SKILL.md` — 미해결 신호가 왔을 때의 브랜치 ACQ를 step 3 동의 게이트에 더하고 게이트 목록에 반영한다

## Do not touch
- `CLAUDE.md` — 마스터 룰 정리는 blueprint 002 소관이다
- `rules/` — 같은 이유
- `scripts/src/lib/validate.ts` — 게이트 판정은 이 task의 범위가 아니다
- `.bouncer/config.json` — 이 저장소의 소비자 설정이고, init은 기존 값을 덮어쓰지 않는다는 계약의 증거다

## Constraints
- `git` 호출 실패는 예외로 밖에 나가지 않고 미해결로 수렴한다. detached HEAD와 원격 없는 저장소가 같은 경로를 탄다.
- `base_branch`와 `pr.base`는 항상 같은 탐지 결과를 쓴다. 두 값이 갈라지는 경로를 만들지 않는다.
- 공개 문자열과 문서 본문은 한국어를 유지한다.
- `config.example.json`의 최상위 키 집합을 바꾸지 않는다. 바꾸면 `test/public-contract.test.js`와 `docs/compatibility.md`가 같은 커밋에 들어와야 하고, 그것은 이 task의 범위가 아니다.
- TS를 고치면 `npm run build` 산출물 `scripts/lib/*.js`를 같은 커밋에 포함한다. 빠지면 `npm run ci`의 `check:emit`이 막는다.

## Checklist
- [ ] `test/init.test.js`에 실패 테스트를 먼저 쓴다 — `git init -b main` 픽스처에서 `init` 뒤 config가 다음을 만족한다:
      ```js
      assert.equal(config.base_branch, 'main');
      assert.equal(config.pr.base, 'main');
      ```
- [ ] 같은 파일에 `origin/HEAD`가 `origin/trunk`를 가리키는 픽스처를 추가하고 두 값이 `'trunk'`인지 단언한다
- [ ] 탐지 실패 픽스처(원격 없음 + detached HEAD)에서 `config.base_branch`가 없고 `'develop'`이 아닌지 단언한다
- [ ] 위 세 테스트가 실패하는 것을 확인한다
- [ ] `scripts/src/lib/init.ts`에 탐지를 구현하고 `'develop'` 리터럴 두 곳을 제거한다
- [ ] `npm run build`로 `scripts/lib/init.js`를 갱신한다
- [ ] 기존 `base_branch`를 가진 config 픽스처에서 값이 그대로인지 단언해 멱등을 지킨다
- [ ] `test/cli-init.test.js`에 미해결 신호가 CLI JSON에 실리는지 단언을 더한다
- [ ] `test/cli-current.test.js`에 config `base_branch` 부재 시 base 폴백 단언을 더하고, 실패를 확인한 뒤 `scripts/src/lib/cli-current-command.ts`의 리터럴을 없앤다
- [ ] `config.example.json`의 값만 바꾸고 키 집합이 그대로인지 `npm test -- public-contract`로 확인한다
- [ ] `docs/configuration.md`를 탐지 계약에 맞춘다
- [ ] `skills/bouncer-init/SKILL.md`에 브랜치 ACQ를 더하고 하단 게이트 목록에 반영한다
- [ ] `npm run ci`가 통과한다
