---
type: bouncer.epic
title: 001 product-surface-hosts
description: '`bouncer` CLI 사용성, 다중 에이전트 플러그인, 호스트 지원, 설치 환경 및 감사 후속 조치를 통합 관리'
resource: .bouncer/context/epics/001-product-surface-hosts/index.md
tags:
  - bouncer
  - epic
timestamp: '2026-07-27T02:39:49.163Z'
bouncer:
  id: '001'
  epic_id: '001'
  status: approved
---
# 001 product-surface-hosts

`bouncer` CLI 사용성, 다중 에이전트 플러그인 지원, 설치 환경 및 호스트 런타임 역사를 하나의 제품 표면 계층으로 관리한다.

## Blueprints
* [001 cli-help](blueprints/001-cli-help/index.md) - bouncer를 인자 없이 실행하거나 --help를 주면 사용법을 출력한다
* [002 cursor-codex-manifests](blueprints/002-cursor-codex-manifests/index.md) - Cursor·Codex 플러그인 매니페스트를 추가하고 명령·훅 경로를 에이전트 중립으로 만든다
* [003 commands-to-skills](blueprints/003-commands-to-skills/index.md) - 워크플로 진입점 네 개를 `commands/`에서 `skills/`로 이관해 Codex도 읽는 공통 표면에 올린다
* [004 venv-install-bin-resolution](blueprints/004-venv-install-bin-resolution/index.md) - graphify 실행 경로 해석기를 만들어 `scripts/src/lib/session-graph.ts`와 스킬이 쓰게 하고, `scripts/src/lib/init.ts`가 `.bouncer/.venv`에 설치하며, `docs/install.md`·`skills/bouncer-init` 안내를 그 흐름으로 바꾼다
* [005 antigravity-plugin-surface](blueprints/005-antigravity-plugin-surface/index.md) - 루트 `plugin.json` 배포 표면과 `antigravity` provider 배선을 만들고(`scripts/src/lib/init.ts`, 테스트), 설치·설정 문서(`docs/install.md`, `README.md`)에 호스트를 추가한다
* [006 host-candidate-launcher](blueprints/006-host-candidate-launcher/index.md) - PATH launcher와 워크플로 루트 해석을 `scripts/`, `skills/`, `rules/`, `docs/`, `test/`에서 호스트 후보 선택 계약으로 바꾼다
* [007 install-first-five-minutes](blueprints/007-install-first-five-minutes/index.md) - `init`이 사용자 저장소에 남기는 venv·브랜치 기본값·`.codex/`·부트스트랩 커밋 범위를 고친다 (`scripts/src/lib/init.ts`, `scripts/src/lib/graphify.ts`, `scripts/src/lib/codex-agents.ts`, `README.md`)
* [008 instruction-layers](blueprints/008-instruction-layers/index.md) - 네 지시문 층의 역할 경계를 표로 세우고 마스터 룰·`core.md`의 재진술을 지우며 Distill 승격이 재진술을 걸러내게 한다 — 지시문 네 층의 파일(`CLAUDE.md`, `skills/bouncer-finalize/references/distill-promotion.md`, `references/spec-authoring/index.md`, `.bouncer/distill/core.md`, `agents/bouncer-implementer.md`)과 설치 문서(`docs/install.md`, `rules/plugin-root.md`), 그리고 그 계약을 단언하는 테스트 넷(`test/master-rules.test.js`, `test/skill-minimality.test.js`, `test/agents.test.js`, `test/public-name-regression.test.js`)
* [009 debt-items](blueprints/009-debt-items/index.md) - B8 커밋 탐지와 B16 YAML 진단을 고치고 B7·B9·B10·B11의 유지 결정을 한 문서에 기록한다
