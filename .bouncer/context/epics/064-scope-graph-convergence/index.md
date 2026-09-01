---
type: bouncer.epic
title: 스코프 그래프 수렴
description: Separate the test scope from source_dirs, report all three graph scopes consistently, and drop the last root graphify-out/graph.json references so graph-suggest role candidates and scope status agree.
resource: .bouncer/context/epics/064-scope-graph-convergence/index.md
tags:
  - bouncer
  - epic
  - graph-scope
  - graph-sync
  - graph-suggest
  - test-dirs
timestamp: '2026-09-01T15:49:01.125+09:00'
bouncer:
  id: '064'
  epic_id: '064'
  status: approved
  supersedes: []
---
# 064 scope-graph-convergence

## Intent
- 문제: 세 스코프 그래프(source·test·context)를 만드는 기계는 이미 있는데, 이 저장소는 `source_dirs`에 `test`를 그대로 두어 test scope를 만들지 않는다. 그래서 `graph-suggest`의 test 역할 후보가 항상 비고 테스트 파일이 implementation 후보로 섞인다. 동시에 `resolveGraphScopes`는 `graphify.test_dirs`가 없으면 `test` 항목을 보고에서 통째로 빼는데, `references/graphify-runner/index.md`는 그 상태에서도 `test` basis 항목을 남기라고 요구한다 — 근거 없는 상태를 에이전트가 지어내야 하는 구멍이다.
- 목표: 역할 분류의 입력(config)과 상태 보고(`graph-sync`)를 세 스코프 기준으로 맞추고, 이미 사라진 루트 `graphify-out/graph.json`을 가리키는 마지막 참조를 정리한다.

## Success criteria
1. `.bouncer/config.json`의 `source_dirs`에 `test`가 없고 `graphify.test_dirs`가 `["test"]`이며, `bouncer graph-sync` 이후 `graphify-out/test/graph.json`이 존재한다. `graphify-out/`은 gitignore 대상이므로 이 조건의 증적은 `tasks/002/verification.md`에 명령과 출력 그대로 남는다.
2. `bouncer graph-suggest`가 이 저장소에서 `test/` 파일을 `candidates.test`로, `scripts/` 구현 파일을 `candidates.implementation`으로 분류한 실측 출력이 증적에 남는다.
3. `graphify.test_dirs`가 없거나 무효한 config에서도 `graph-sync` 결과의 `graphs[]`에 이름이 `test`인 항목이 사유와 함께 존재하고, 그 항목은 빌드 대상도 `missing`도 아니며 SessionStart 경고를 새로 만들지 않는다.
4. `references/graphify-runner/index.md`가 그 항목의 `action`을 basis `status`로 옮기는 사상을 표에 담고, `docs/configuration.md`가 "빌드되는 그래프 수"와 "보고되는 스코프 수"를 구분해 진술하며, `docs/install.md`의 sync 산출물 서술이 source·context 둘에서 test를 포함한 셋으로 넓어진다.
5. 저장소 안에 루트 `graphify-out/graph.json`을 가리키는 참조가 남지 않는다.
6. `npm test`가 통과한다.

## Out of scope
- 사용자 전역 `/graphify` 스킬과 전역 `CLAUDE.md`의 라우팅 — 저장소 밖 파일이라 이 에픽의 커밋 단위에 들어올 수 없다.
- cross-file 엣지 주입, 구조 순회, `path A B`, community 재계산 — 보류 lane이다.
- epic 압축과 기존 corpus frontmatter 일괄 영문화 — Wave 4가 맡는다.
- `graph-search.ts`의 매칭·점수 규칙과 역할 점수표 — epic 060 소관이다.
- `context-digest`의 파생 앵커·Touch 헤딩 생성 — epic 063이 맡는다.
- `graphify-out/` 아래 로컬 잔여물(`graph.html`, `GRAPH_REPORT.md`, `manifest.json`) 삭제 — gitignore 대상 런타임 캐시이지 저장소 변경이 아니다.
- `bouncer init`이 기존 config에 `graphify.test_dirs`를 추가하도록 바꾸는 것 — 기존 프로젝트 설정을 말없이 고치지 않는다는 현재 계약을 유지한다.

## Blueprints
* [스코프 분리와 세 스코프 보고](blueprints/001-scope-separation-and-reporting/index.md) - config에서 test scope를 분리하고 graph-scope·session-graph가 test 항목을 항상 보고하게 하며 루트 graph.json 참조를 정리한다
