---
type: bouncer.epic
title: EPIC-011 graphify-signal
description: Epic EPIC-011
resource: .bouncer/context/epics/EPIC-011-graphify-signal/index.md
tags:
  - bouncer
  - epic
timestamp: '2026-08-04T15:34:53.512+09:00'
bouncer:
  id: EPIC-011
  epic_id: EPIC-011
  status: approved
---
# EPIC-011 graphify-signal

## Intent
- 문제: 그래프가 만들어지지 않아도 아무도 그 사실을 듣지 못한다. SessionStart 훅은
  `skip-no-graphify`만 경고하고 `skip-no-dirs`는 조용히 넘긴다. `graph-sync`는 source가
  빠지고 context만 빌드돼도 `"ok": true, "built": ["context"], "failed": []`를 돌려주므로
  성공처럼 읽힌다. `graphify-runner`의 우아한 스킵 조건은 "두 `graph.json`이 **모두**
  없을 때"라, source만 없는 이 상태에서 발동하지 않고 context 그래프를 질의해 소스와
  무관한 경로를 돌려준다. 그 위에 `bouncer init`이 실재 여부를 확인하지 않고
  `source_dirs: ["src", "test"]`를 심는다. 세 가지가 겹쳐, 다른 프로젝트에서 스캐폴딩한
  직후 그래프 없이 계획이 진행됐고 에이전트가 영향 경로를 손으로 주입했다.
- 목표: 그래프 부재는 언제나 신호로 드러나고, 스캐폴딩 기본값이 존재하지 않는 경로를
  심어 무음 실패를 만들지 않는다.

## Success criteria
1. `graphify.enabled`가 `true`이고 `source_dirs`에 실재하는 디렉터리가 하나도 없을 때,
   SessionStart 훅이 누락된 디렉터리 이름을 포함한 경고를 stderr로 출력한다.
2. 같은 상태에서 `bouncer graph-sync` 출력이 source 그래프 미생성을 최상위 필드로
   신호한다 — `built`/`failed`만 보고 성공으로 읽히지 않는다.
3. `graphify-runner`의 우아한 스킵이 source `graph.json` 부재만으로 발동한다. context
   그래프가 존재하는지 여부가 그 판단을 바꾸지 않는다.
4. `bouncer init`이 실재하지 않는 디렉터리를 `source_dirs` 기본값으로 쓰지 않는다.
   후보를 찾지 못하면 빈 배열을 쓰고 사용자에게 직접 채우라고 알린다.
5. `source_dirs`가 `["."]`일 때 `graph-sync`를 연속 두 번 실행하면 두 번째가
   `skip-fresh`다.
6. 두 개 이상의 part를 빌드해도 저장소 루트 `graphify-out/manifest.json`이 덮어써지지
   않는다.

## Out of scope
- graphify CLI 자체의 수정, 그리고 설치된 스킬과 패키지의 버전 불일치 경고 대응.
  외부 도구의 문제이며 이 저장소에서 고칠 수 없다.
- Cursor에 SessionStart 대응 훅을 신설하는 것. Cursor는 지금 자동 빌드가 없고 plan
  시점 재동기화에만 의존하는데, 이것이 의도인지 결함인지는 별도 판단이 필요하다.
- `config.source_dirs`가 `scripts`/`hooks`/`test`일 때 source 질의가 `skills/` 경로를
  돌려주지 않는 기존 Distill gotcha 해소. 원인이 다르다 — 이쪽은 설정된 디렉터리가
  실재하는데도 관심 경로가 그 밖에 있는 경우다.
- graphify를 기본 활성화로 바꾸는 것. 옵트인 정책(`graphify.enabled: false` 기본)은
  그대로 두고, 옵트인한 사용자에게만 신호를 준다.
- 그래프가 없을 때 `suggested_paths`를 추론으로 채우는 것. 비워 두고 사용자 확인을
  요구하는 현재 계약을 유지한다.

## Blueprints
* [무음 스킵을 신호로 드러냄](blueprints/BP-001-silent-skip-signal/index.md) - 옵트인 상태의 source 그래프 미생성을 `graph-sync` 반환 필드와 SessionStart 경고로 노출하고, `graphify-runner`의 스킵 조건을 source 그래프 부재 기준으로 고친다
* [그래프 경로 계약 정정](blueprints/BP-002-graph-path-contract/index.md) - `init`의 `source_dirs` 기본값을 실재 디렉터리 탐지로 바꾸고, 신선도 판정에서 산출물 디렉터리를 제외하며, part 빌드가 루트 `manifest.json`을 침범하지 않게 cwd를 격리한다
