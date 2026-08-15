---
type: bouncer.tasks
title: 1.0 버전 정합성
description: Tasks for 001
resource: .bouncer/context/epics/039-open-source-one-zero/blueprints/003-one-zero-release/tasks/001/tasks.md
tags:
  - bouncer
  - tasks
timestamp: '2026-08-15T19:41:48.040+09:00'
bouncer:
  id: TASKS-001
  epic_id: '039'
  blueprint_id: '003'
  status: verified
  commit_intent:
    - 공개 배포물이 같은 버전을 가리키게 함
    - 매니페스트 drift를 회귀 검사로 막음
  verify: npm test
  affected_paths:
    - package.json
    - package-lock.json
    - .claude-plugin/plugin.json
    - .claude-plugin/marketplace.json
    - .cursor-plugin/plugin.json
    - .codex-plugin/plugin.json
    - plugin.json
    - test/cursor-plugin.test.js
    - test/distribution.test.js
  graph:
    generated_at: '2026-08-15T19:44:00+09:00'
    command: graphify query "1.0.0 release plugin manifests marketplace package lockfile changelog installation smoke pilot tag" --graph graphify-out/{source,context}/graph.json
    suggested_paths:
      - test
      - .bouncer/context
    basis:
      - graph: source
        status: reused
        query: 1.0.0 release plugin manifests marketplace package lockfile changelog installation smoke pilot tag
        result: 75 nodes; test/distribution.test.js, test/plugin-wiring.test.js, test/public-contract.test.js
      - graph: context
        status: updated
        query: 1.0.0 release plugin manifests marketplace package lockfile changelog installation smoke pilot tag
        result: 10 nodes; prior 1.0 release and plugin-surface context records
---
# Tasks

Blueprint: [003](../../index.md)

## Goal & intent
<!-- 구현자가 다른 문서 없이 시작할 수 있게.
     수용 기준과 검증 명령도 여기에 적거나 Checklist에 명시한다. -->
모든 배포 매니페스트와 npm 메타데이터가 `1.0.0`을 공개하고, 회귀 테스트가
package·Claude marketplace·네 호스트 매니페스트의 버전 drift를 실패로 만든다.

## Interface
<!-- 계약이 리뷰에서 검증 가능하도록 제공하는 것과 거부하는 것을 함께 적습니다. -->
- 제공: 여섯 배포 메타데이터 파일과 lockfile의 root package 버전 `1.0.0`, 그리고
  이를 비교하는 배포 회귀 검사.
- 거부: 이름은 같지만 버전이 다른 매니페스트·marketplace 항목·lockfile은 테스트를
  통과하지 못한다.

## Touch
<!-- frontmatter bouncer.affected_paths의 모든 경로가 여기서 정당화되어야 합니다 (G11).
     디렉터리가 아니라 파일 단위로, 동사(Create/Modify/Delete/Rename)를 붙입니다.
     디렉터리 하나로 뭉치면 그 안 모든 파일이 열려 G11이 사실상 통과만 합니다.
     경로는 백틱으로 감쌉니다. -->
- Modify `package.json` — 패키지 공개 버전을 `1.0.0`으로 올린다.
- Modify `package-lock.json` — lockfile root package 버전을 package 메타데이터와 맞춘다.
- Modify `.claude-plugin/plugin.json` — Claude 플러그인 버전을 맞춘다.
- Modify `.claude-plugin/marketplace.json` — marketplace 항목 버전을 맞춘다.
- Modify `.cursor-plugin/plugin.json` — Cursor 플러그인 버전을 맞춘다.
- Modify `.codex-plugin/plugin.json` — Codex 플러그인 버전을 맞춘다.
- Modify `plugin.json` — Antigravity 플러그인 버전을 맞춘다.
- Modify `test/cursor-plugin.test.js` — 네 호스트와 package 버전 일치 검사를 추가한다.
- Modify `test/distribution.test.js` — Claude marketplace·package 버전 검사에
  기대 릴리스 버전을 고정한다.

## Do not touch
<!-- 여기 적은 경로가 affected_paths와 겹치면 G12가 막습니다.
     epic / blueprint의 Out of scope에서 이어받습니다. -->
- `scripts/` — 버전 승격은 런타임·CLI 동작을 바꾸지 않는다.
- `docs/` — 릴리스 노트와 설치 안내는 다음 task에서 다룬다.

## Constraints
<!-- 경로로 표현되지 않는, 작업 전체에 걸리는 규칙. 허용된 파일 안에서도 지켜야 합니다.
     예: 하위 호환 별칭을 남기지 않는다 / 기존 게이트 번호와 본문 계약을 유지한다 /
     공개 문자열은 한국어를 유지한다.
     막을 대상이 경로뿐이면 Do not touch에 적습니다. -->
- 기존 매니페스트의 이름, 설명, hooks·skills 선언과 marketplace source를 바꾸지 않는다.
- `npm version`처럼 lockfile 외 파일을 넓게 바꾸는 명령은 쓰지 않고, 바뀐 버전 필드만
  수정한다.
- `1.0.0` 태그는 이 task에서 만들지 않는다.

## Checklist
<!-- 각 항목은 구현자가 순서대로 실행 가능해야 합니다.
     행위를 바꾸는 항목은 실패 테스트 → 실패 확인 → 구현 순서로 적습니다.
     기대하는 assertion·상수·명령은 코드블록으로 그대로 적어 해석 여지를 없앱니다.
     blueprint Contract에서 이연된 테스트 본문·구현 시퀀스가 들어올 자리입니다.
     수용 기준·검증 명령을 체크 항목으로 포함하세요. -->
- [ ] version parity가 없는 상태에서 먼저 `test/cursor-plugin.test.js`와
  `test/distribution.test.js`에 `1.0.0` 기대값을 추가하고 실패를 확인한다.
- [ ] 위 Touch의 package·lockfile·다섯 매니페스트 버전을 모두 `1.0.0`으로 수정한다.
- [ ] 다음 명령으로 해당 회귀 검사를 실행한다.

  ```bash
  node --test test/cursor-plugin.test.js test/distribution.test.js
  ```

- [ ] `npm test`를 실행해 전체 테스트가 통과하는지 확인한다.
