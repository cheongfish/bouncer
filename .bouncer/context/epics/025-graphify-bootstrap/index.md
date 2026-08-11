---
type: bouncer.epic
title: graphify를 init이 설치하고 그 경로로 실행
description: bouncer init이 .bouncer/.venv에 graphify를 설치하고, graph-sync와 graphify-runner가 PATH 대신 그 경로를 쓴다
resource: .bouncer/context/epics/025-graphify-bootstrap/index.md
tags:
  - bouncer
  - epic
timestamp: '2026-08-11T13:29:26.024+09:00'
bouncer:
  id: '025'
  epic_id: '025'
  status: approved
---
# 025 graphify-bootstrap

## Intent
- 문제: graphify는 선택 의존성이라 기본이 꺼져 있고 설치가 사용자 몫이다. 그래서
  `/bouncer-plan`이 `suggested_paths`를 비운 채 지나가고, `affected_paths`를 매번
  손으로 채운다.
- 목표: `bouncer init`이 `.bouncer/.venv`에 graphify를 설치하고 그 실행 파일 경로를
  `config.graphify.bin`에 기록하며, `graph-sync`와 `graphify-runner`가 PATH가 아니라
  해석된 경로로 graphify를 호출한다.

## Success criteria
1. `config.graphify.bin`이 없고 `.bouncer/.venv`에 graphify가 있으면 `bouncer graph-sync`가
   그 실행 파일로 그래프를 빌드한다.
2. 실행 경로 해석 순서가 `config.graphify.bin` → `.bouncer/.venv` 기본 경로 → PATH의
   `graphify`이고, 셋 다 없으면 `skip-no-graphify`로 끝난다(exit 0).
3. 새 `bouncer init`이 만드는 `config.json`의 `graphify.enabled`가 `true`다.
4. python 부재나 pip 실패로 설치가 안 되면 `init`이 exit 0으로 끝나고, `graphify.enabled`를
   `false`로 남긴 뒤 실패 사유를 결과에 담는다.
5. `.bouncer/.venv`가 이미 있으면 `init` 재실행이 설치를 건너뛴다.
6. 이미 `graphify.enabled: false`로 초기화된 config는 `init` 재실행만으로 바뀌지 않고,
   명시적 승격 요청이 있을 때 `enabled` 한 키만 바뀐다.
7. `.gitignore` 마커 블록 쓰기를 두 번 실행해도 블록이 하나만 남는다.
8. `npm test`가 통과한다.

## Out of scope
- context 그래프 경량화(섹션 화이트리스트, 파생 트리) — PLANNING-DECISIONS §1-1.
- `verify`, `base_branch`, `source_dirs` 등 다른 config 기본값의 마이그레이션. 일반적인
  config 마이그레이션 프레임워크는 만들지 않는다.
- graphify 자체의 질의 품질, 그래프 스키마, `merge-graphs` 동작.
- CI에서 실제 pip 설치를 수행하는 검증. 설치 실행부는 주입 가능한 형태로만 테스트한다.

## Blueprints
* [001 venv 설치와 실행 경로 해석](blueprints/001-venv-install-bin-resolution/index.md) - graphify 실행 경로 해석기를 만들어 `scripts/src/lib/session-graph.ts`와 스킬이 쓰게 하고, `scripts/src/lib/init.ts`가 `.bouncer/.venv`에 설치하며, `docs/install.md`·`skills/bouncer-init` 안내를 그 흐름으로 바꾼다
