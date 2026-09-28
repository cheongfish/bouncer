---
type: bouncer.epic
title: 로드맵 잔여 배포·규칙 정리
description: Closes the remaining roadmap items by shipping built CommonJS through a release branch and removing the leftover governance rule file.
resource: .bouncer/context/epics/079-roadmap-closeout/index.md
tags:
  - bouncer
  - epic
  - release
  - build-artifact
  - governance
timestamp: '2026-09-28T08:57:09.891+09:00'
bouncer:
  id: '079'
  epic_id: '079'
  status: approved
  supersedes: []
---
# 079 로드맵 잔여 배포·규칙 정리

## Intent
- 문제: 생성 CommonJS(`scripts/lib/**`)를 TypeScript 원본과 함께 Git에 추적해 코드 탐색 결과가 중복되고, Epic 077이 남긴 `rules/governance.md`에는 구현 설명 4개만 남아 규칙 색인과 테스트가 빈 정본을 계속 가리킨다.
- 목표: 설치본은 `release` 브랜치의 빌드 산출물로 받고 개발 브랜치는 TypeScript만 추적하며, 남은 구현 설명을 구현 코드 옆으로 옮긴 뒤 `rules/governance.md`를 삭제한다.

## Success criteria
1. `develop`에서 `git ls-files scripts/lib`가 빈 출력을 내고 `.gitignore`가 `scripts/lib/`를 제외한다.
2. `node scripts/build-release.js --out <dir>`가 빌드 뒤 만든 트리의 정렬된 상대 파일 목록이 `npm pack --dry-run --json`의 `files[].path` 정렬 목록과 같고, 그 목록에 `scripts/lib/cli.js`, `scripts/lib/commit-hook.js`, `scripts/lib/session-graph.js`가 있다.
3. `BOUNCER_HOME=<dir> node <dir>/scripts/bouncer --help`가 0으로 끝나고, 그 트리에 `node_modules`가 없다.
4. `.github/workflows/release.yml`이 `bouncer--v*` 태그 trigger와 기본 브랜치 전용 `workflow_dispatch` trigger, `npm run ci` 선행, `release` 브랜치 fetch, `--force` 없는 `HEAD:refs/heads/release` push를 선언하고 테스트가 이 원문 계약을 확인한다. 실제 태그 push·수동 실행과 그 실행 결과는 Out of scope의 운영 확인이다.
5. 빌드 전 checkout에서 `scripts/bouncer`가 `scripts/lib`가 없다는 이유와 `npm run build` 안내를 stderr에 쓰고 1로 끝난다.
6. `npm run check:emit`은 빌드 성공과 `scripts/lib` 미추적을 확인하고, 추적된 `scripts/lib` 파일이 하나라도 있으면 1로 끝난다.
7. `rules/governance.md`가 없고, `AGENTS.md`, `rules/**`, `skills/**`, `agents/**`, `scripts/src/**`에 그 경로가 없으며, 그 파일을 읽거나 존재를 요구하는 테스트가 없다. 부재를 확인하는 `doesNotMatch` 가드는 남는다.
8. `GOV-SIZING-VERIFY-RUN`, `GOV-LIGHT-SCALE-READ-SITES`, `GOV-COORD-LOCK`, `GOV-COORD-REPAIR-WRITE` 행의 current owner가 `scripts/src/lib/*.ts`이고 ownership 테스트가 그 locator를 찾는다.
9. `npm run ci`가 통과한다.

## Out of scope
- gate code, CLI 상태 전이, 문서 schema, runtime config와 runtime dependency 추가·변경.
- `tsconfig.json`의 emit 설정과 `scripts/src/lib/**`의 동작 변경(주석 이동만 허용).
- 저장소 기본 브랜치 URL을 가리키는 원격 marketplace 등록(`/plugin marketplace add <git-url>` 등)의 지속 지원. 병합 뒤 그 경로는 `scripts/lib` 없는 트리를 받으므로 `docs/install.md`가 `release` 브랜치 clone 뒤 로컬 경로 설치로 안내하고, 카탈로그 `source` 형식(`.claude-plugin/marketplace.json`, `.agents/plugins/marketplace.json`)은 바꾸지 않는다.
- 원격 태그 push, `workflow_dispatch` 수동 실행, `release` 브랜치 최초 생성, 호스트별 설치 smoke와 GitHub Release 기록 — 사용자 동의가 필요한 운영 작업이다.
- 동결된 `rules-reorganization-proposal.md` 수정과 epic id `078` 중복 정리.

## Blueprints
* [001 릴리스 산출물 전환과 governance 규칙 삭제](blueprints/001-release-artifact-governance-removal/index.md) - release 브랜치 빌드 산출물을 만들고 `scripts/lib` 추적을 끊으며 `rules/governance.md`의 남은 설명을 코드로 옮겨 삭제한다.
