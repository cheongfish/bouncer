---
type: bouncer.blueprint
title: 그래프 경로 계약을 실재 디렉터리와 격리된 산출 위치로 정정
description: Blueprint 002
resource: .bouncer/context/epics/011-graphify-signal/blueprints/002-graph-path-contract/index.md
tags:
  - bouncer
  - blueprint
timestamp: '2026-08-04T15:34:53.569+09:00'
bouncer:
  id: '002'
  epic_id: '011'
  blueprint_id: '002'
  status: approved
  commit_type: fix
  commit_intent:
    - 스캐폴딩이 실재하지 않는 디렉터리를 그래프 대상으로 심고 산출물이 스캔 대상과 겹쳐 신선도와 캐시가 함께 무너졌음
    - 그래프가 읽는 경로와 쓰는 경로를 분리해 설정만 맞으면 예상대로 동작하게 함
---
# 002 graph-path-contract

Epic: [011](../../index.md)

## Intent
- 문제: 그래프가 **읽는** 경로와 **쓰는** 경로가 세 곳에서 어긋나 있다. 첫째,
  `bouncer init`은 저장소를 보지 않고 `source_dirs: ["src", "test"]`를 심어, 다른
  레이아웃의 프로젝트에서는 옵트인하는 순간 대상이 0개가 된다. 둘째, 신선도 판정이
  설정된 디렉터리 아래 전체 mtime을 보는데 산출물인 `graphify-out/`이 그 아래 들어오면
  (`source_dirs: ["."]`) 빌드가 끝나는 순간 다시 stale이 되어 매 세션·매 plan마다 전체
  재빌드가 걸린다. 셋째, `graphify update`는 `GRAPHIFY_OUT`과 무관하게 AST 캐시 인덱스를
  `<cwd>/graphify-out/manifest.json`에 쓴다. part를 여러 개 빌드하는 현재 구조에서는
  그 하나의 파일을 네 번 덮어쓰고, 같은 저장소에서 graphify를 직접 쓰는 사용자의 상태도
  함께 무너뜨린다.
- 완료 조건: 스캐폴딩이 실재하는 디렉터리만 `source_dirs`에 넣는다. 산출물 디렉터리가
  신선도 판정에서 빠져 두 번째 `graph-sync`가 `skip-fresh`가 된다. part 빌드가 저장소
  루트 `manifest.json`을 건드리지 않는다. 011 성공 조건 4–6이 참이 되고 `npm test`가
  통과한다.

## Contract
<!-- Contract-First: 계약만. 구현 코드 금지. -->
- 인터페이스 (스캐폴딩): `init`이 쓰는 `source_dirs` 기본값을 저장소 루트의 실재
  디렉터리에서 고른다. 후보 목록은 코드에 고정된 순서를 갖고, 그중 존재하는 것만
  결과에 남는다. 하나도 없으면 빈 배열을 쓰고 `init` 반환에 사용자가 직접 채워야 한다는
  사실을 싣는다 — 조용히 그럴듯한 값을 심지 않는다. `context_dirs` 기본값은 그대로다.
- 인터페이스 (신선도): 최신 mtime 탐색이 산출물·의존성·VCS 디렉터리를 건너뛴다.
  제외 목록은 코드에 고정되며 설정 키로 노출하지 않는다. 제외 대상은 스캔 결과에서만
  빠지고, `existingDirs`가 판단하는 "디렉터리가 실재하는가"에는 영향을 주지 않는다.
- 인터페이스 (산출 격리): part 빌드가 `graphify`를 호출할 때 작업 디렉터리를 그 part의
  산출 디렉터리로 두어, 도구가 고정 위치에 쓰는 `manifest.json`이 part 안에 떨어지게
  한다. 스캔 대상은 절대 경로로 넘긴다. `graph.json`이 지금 떨어지는 위치
  (`graphify-out/<scope>/parts/<slug>/`)와 스코프 그래프의 최종 경로
  (`graphify-out/<scope>/graph.json`)는 바뀌지 않는다.
- 데이터·상태: `.bouncer/config.json`에 새 키를 만들지 않는다. 기존 저장소의
  `source_dirs`를 마이그레이션하지 않는다 — `init`은 이미 존재하는 설정을 덮어쓰지
  않는다는 현재 성질을 그대로 지킨다. 그래프 산출물의 스키마도 그대로다.
- 수용 기준: 011 성공 조건 4, 5, 6이 참이 된다. `npm test` 통과.
- 검증 명령: `npm test`
- 실패 모드·엣지 케이스:
  - 후보 디렉터리가 여럿 실재 — 고정된 순서로 모두 넣는다. 개수를 임의로 자르지 않는다.
  - 후보가 하나도 없음 — 빈 배열. 이때 옵트인하면 001의 누락 경고가 상황을 설명한다.
  - `source_dirs`에 `.`이 들어간 경우 — 제외 목록 덕분에 두 번째 동기화가 `skip-fresh`가
    된다. `.` 자체를 거부하지는 않는다.
  - 심볼릭 링크와 순환 — 최신 mtime 탐색이 무한 루프에 빠지지 않아야 한다.
  - `graphify`가 part 산출 디렉터리를 미리 만들어 두지 않으면 cwd 지정이 실패한다.
    호출 전에 디렉터리가 존재함을 보장한다.
  - 거부: 산출물 제외를 사용자 설정으로 여는 것. 제외 대상이 설정 가능해지면 같은
    무한 재빌드를 사용자가 다시 만들 수 있다.

## Out of scope
- 001이 만든 `missing`·경고·스킬 스킵 조건. 이 blueprint는 그 신호가 애초에 덜
  울리도록 원인을 줄이지만, 신호 표면 자체는 건드리지 않는다.
- 기존 프로젝트의 `.bouncer/config.json` 자동 마이그레이션. `init`이 기존 설정을
  존중한다는 성질이 더 중요하다.
- `merge-graphs` 경로에서 `hyperedges`와 `built_at_commit`이 사라지고 노드 id에
  `parts::` 접두사가 붙는 문제. 지금 소비자가 `source_file`만 쓰므로 무해하고, 고치려면
  병합 산출물의 형식 계약을 새로 세워야 한다.
- 그래프 산출 위치(`graphify-out/`)를 옮기거나 이름을 바꾸는 것.
- graphify CLI가 `GRAPHIFY_OUT`을 `manifest.json`에 적용하지 않는 것 자체. 외부 도구의
  동작이며 이 커밋은 cwd로 우회한다.

## One-commit justification
- 세 수정이 같은 하나의 계약을 고친다 — 그래프가 읽는 경로와 쓰는 경로의 분리. 어느
  하나만 고치면 계약이 여전히 깨져 있다.
- 쪼개면 검증이 성립하지 않는다. `source_dirs`만 고치면 `.`을 고른 프로젝트가 즉시
  무한 재빌드에 걸리고, 신선도만 고치면 대상이 0개인 프로젝트에서는 관측되지 않는다.
- 세 수정 모두 판정 규칙이 아니라 경로 계산을 바꾼다. 회귀 범위가 경로에 한정되고,
  기존 게이트·빌드 대상 선정 테스트가 그대로 통과하는 것이 그 경계의 증거다.

## Documents
* [Tasks](tasks.md) - 구현 브리프
* [Verification](verification.md) - 검증 명령과 증적
* [Review](review.md) - 리뷰 발견사항
<!-- distill.md는 plan scaffold에 포함되지 않습니다. /bouncer-finalize가 작성합니다. -->
