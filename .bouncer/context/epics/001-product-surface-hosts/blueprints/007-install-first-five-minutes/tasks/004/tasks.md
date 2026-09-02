---
type: bouncer.tasks
title: 부트스트랩 커밋 안내를 명시적 경로 목록으로 축소
description: 문서와 스킬의 부트스트랩 커밋 명령이 .bouncer 전체 대신 필요한 경로만 스테이징하게 한다
resource: .bouncer/context/epics/001-product-surface-hosts/blueprints/007-install-first-five-minutes/tasks/004/tasks.md
tags:
  - bouncer
  - tasks
timestamp: '2026-08-28T15:37:36.026+09:00'
bouncer:
  id: TASKS-004
  epic_id: '001'
  blueprint_id: '007'
  status: verified
  commit_intent:
    - "`git add .bouncer`가 설치 산출물까지 통째로 스테이징하게 만듦"
    - 커밋해야 하는 경로만 명시해 첫 커밋이 저장소를 어지럽히지 않게 함
  verify: npm run ci
  affected_paths:
    - README.md
    - docs/context-versioning.md
    - skills/bouncer-init/SKILL.md
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

Blueprint: [007](../../index.md)

## Goal & intent
README·문서·`/bouncer-init`이 안내하는 부트스트랩 커밋 명령을 `git add .bouncer`에서 명시적 경로 목록으로 좁힌다. task 002가 venv를 작업 트리 밖으로 옮겨 재현은 이미 끊기지만, 안내 자체가 "디렉터리 통째로 담기"를 가르치는 한 다음 설치 산출물이 생기면 같은 일이 반복된다. 커밋해야 하는 것은 `config.json`·`context/`·`Distill.md` 셋이고, Codex 파일은 task 003 이후 조건부이므로 안내도 조건부여야 한다.

## Interface
- 제공: 세 곳(`README.md`, `docs/context-versioning.md`, `skills/bouncer-init/SKILL.md`)의 커밋 명령이 같은 명시적 경로 목록을 쓴다.
- 제공: `.codex/agents`는 그 디렉터리가 실제로 생성됐을 때만 안내에 포함된다.
- 거부: `git add .bouncer` 또는 `git add -A` 형태를 안내에 남기지 않는다.
- 거부: 커밋을 대신 실행하지 않는다. 부트스트랩 기록은 사용자의 결정이라는 기존 문장을 유지한다.

## Touch
- Modify `README.md` — Quickstart의 `git add .bouncer`를 경로 목록으로 바꾼다
- Modify `docs/context-versioning.md` — 같은 명령을 같은 목록으로 맞춘다
- Modify `skills/bouncer-init/SKILL.md` — step 4의 명령과 그 아래 두 이유 문장을 새 목록에 맞춘다. `.codex/agents`는 조건부로 적는다
- Modify `docs/install.md` — 부트스트랩 커밋 절이 있으면 같은 목록으로 맞춘다

## Do not touch
- `scripts/` — 이 task는 문서와 스킬 문구만 고친다. 코드 동작은 task 001~003이 이미 바꿨다
- `CLAUDE.md`
- `rules/`
- `test/` — 이 문구를 단언하는 테스트는 현재 없고, B10 이행 방침상 새로 만들지 않는다

## Constraints
- 세 곳의 명령 문자열이 서로 어긋나지 않는다. 한 곳을 고치면 나머지도 같은 커밋에서 고친다.
- 한국어 본문을 유지한다.
- 문서 문구를 단언하는 테스트를 새로 추가하지 않는다 — ADR G절의 "식별자만 단언한다" 방침을 따른다.
- 커밋 명령은 `.gitmessage` 규약의 `chore:` 타입을 유지한다.

## Checklist
- [ ] 저장소 전체에서 `git add .bouncer` 문자열의 잔여 위치를 찾는다:
      ```bash
      grep -rn "git add .bouncer" README.md docs/ skills/
      ```
- [ ] 찾은 세 곳 전부를 다음 형태의 명시적 목록으로 바꾼다:
      ```bash
      git add .bouncer/config.json .bouncer/context .bouncer/Distill.md && git commit -m "chore: bootstrap bouncer"
      ```
- [ ] `skills/bouncer-init/SKILL.md`에서 `.codex/agents`를 조건부 문장으로 분리한다
- [ ] `docs/install.md`에 같은 명령이 있으면 함께 맞춘다
- [ ] 위 grep을 다시 돌려 잔여가 0건인지 확인한다
- [ ] `npm run ci`가 통과한다
