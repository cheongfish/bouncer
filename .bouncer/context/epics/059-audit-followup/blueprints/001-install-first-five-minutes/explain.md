---
type: bouncer.explain
title: 001 explain
description: Explain for 001
resource: .bouncer/context/epics/059-audit-followup/blueprints/001-install-first-five-minutes/explain.md
tags:
  - bouncer
  - explain
timestamp: '2026-08-28T16:46:19.040+09:00'
bouncer:
  id: EXPLAIN-001
  epic_id: '059'
  blueprint_id: '001'
  status: published
  comprehension:
    - range_from: develop
      range_to: 4d40f1dc7db521618fda390f9c4424df83d49f23
      diff_sha: 939e69a511863c9de7c1a99ba00a382acf8e714e551a634f33d74c66eae131c3
      quiz_score: '3/4'
      disposition: "4문항 중 3정답. venv 신규 위치를 레거시 .bouncer/.venv로 골랐음."
      recorded_at: '2026-08-28T16:49:08+09:00'
---
# Explain

## Background
`bouncer init`이 빈 저장소에 네 가지를 남겼다. `base_branch`와 `pr.base`가 `develop` 리터럴이고, graphify venv가 `.bouncer/.venv/`에 생기며, Claude만 쓰는 저장소에도 `.codex/agents/*.toml`이 생기고, README가 `git add .bouncer`를 가르쳤다. 파일럿이 첫 5분에 만나는 부작용이라 한 PR에서 네 커밋으로 끊었다.

## Intuition
설치는 소비자 작업 트리에 추정값과 호스트 파일을 심지 않고, 커밋 안내도 필요한 경로만 적는다.

## Code
- `scripts/src/lib/init.ts` — `detectDefaultBranch`: `origin/HEAD` 다음 `HEAD`. 실패하면 두 키를 쓰지 않고 `baseBranchUnresolved`를 싣는다. `inspectBootstrap`은 `base_branch` 부재를 `partial`로 보지 않는다.
- `scripts/src/lib/cli-current-command.ts` — `--set` base는 `config.base_branch` 다음 체크아웃 브랜치. HEAD가 아니면 빈 문자열을 쓰지 않고 exit 1.
- `scripts/src/lib/graphify.ts` — 신규 venv는 `<git-common-dir>/bouncer/venv`. 이미 `.bouncer/.venv/`가 있으면 그대로 쓴다. 비-git은 레거시 폴백. 이번 실행이 만든 디렉터리만 실패 시 지운다.
- `scripts/src/lib/codex-agents.ts` — `shouldEnsureCodexAgents`: `.codex/` 존재 또는 `seedCodexAgents`. CLI 플래그는 `--seed-codex-agents`.
- 안내: `README.md`, `docs/context-versioning.md`, `skills/bouncer-init/SKILL.md`가 `git add .bouncer/config.json .bouncer/context .bouncer/Distill.md`를 쓴다. `.codex/agents`는 스킬에서만 조건부.

## Quiz
1. `init`이 기본 브랜치를 탐지하지 못하면 `config.json`에 무엇을 쓰는가?
   - A) `base_branch`와 `pr.base`에 `main`
   - B) 두 키를 쓰지 않고 반환 JSON에 `baseBranchUnresolved`
   - C) `base_branch`만 `develop`, `pr.base`는 비움
2. 신규 graphify venv 후보는 어디에 놓이는가?
   - A) `<git-common-dir>/bouncer/venv`
   - B) 저장소 루트의 `.bouncer/.venv`
   - C) `node_modules/.graphify`
3. `.codex/agents/*.toml`을 심는 조건은?
   - A) 실행 중인 CLI 이름이 `codex`이면
   - B) 항상 네 파일을 만든다
   - C) `.codex/`가 이미 있거나 `--seed-codex-agents`
4. 부트스트랩 커밋 안내가 스테이징하는 경로는?
   - A) `git add .bouncer`
   - B) `.bouncer/config.json`, `.bouncer/context`, `.bouncer/Distill.md`
   - C) `git add -A`

## 이해 상태
퀴즈 3/4. 정답 B / A / C / B. 응답 B / B / C / B. 문항 2만 오답(신규 venv를 `.bouncer/.venv`로 봄). disposition: venv 신규 위치를 레거시 경로로 골랐음.
