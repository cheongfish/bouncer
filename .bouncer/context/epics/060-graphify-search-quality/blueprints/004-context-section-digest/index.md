---
type: bouncer.blueprint
title: context 그래프 섹션 다이제스트 도입
description: 화이트리스트 섹션 파생 트리를 만들고 context 그래프 빌드를 그 트리로 옮긴다
resource: .bouncer/context/epics/060-graphify-search-quality/blueprints/004-context-section-digest/index.md
tags:
  - bouncer
  - blueprint
timestamp: '2026-08-11T14:56:45.103+09:00'
bouncer:
  id: '004'
  epic_id: '060'
  blueprint_id: '004'
  status: approved
  commit_type: feat
  commit_intent:
    - context 그래프의 3분의 2가 체크리스트와 증적 같은 기계 생성물이라 쿼리 신호가 묻힘
    - 의사결정 섹션만 뽑은 파생 트리를 인덱싱해 노드 수를 줄이면서 결과 경로는 원본으로 유지함
---
# 004 context-section-digest

Epic: [060](../../index.md)

## Intent
- 문제: `context_dirs`는 디렉터리 단위라 문서 안의 섹션을 잘라낼 수 없다. 설정만으로는 `tasks.md`의 Touch/Checklist와 `verification.md` 증적을 그래프에서 뺄 방법이 없다.
- 완료 조건: context 그래프가 파생 트리에서 빌드되고, 그 그래프의 노드 경로는 전부 원본 저장소 경로이며, 파생 경로가 `suggested_paths`까지 새는 경로가 두 겹으로 막힌다.

## Contract
- 인터페이스: 새 모듈 `scripts/src/lib/context-digest.ts`가 `CONTEXT_DIGEST_OUT`, `digestRulesFor(rel)`, `extractSections(markdown, headings)`, `buildContextDigest({ repoRoot, contextDirs })`를 내보낸다. `session-graph`의 graph scope에 `scanDirs`(빌드가 실제로 스캔할 경로)와 `watchFiles`(freshness에만 쓰는 파일)가 추가되고, `normalizeGraphPaths`가 선택적 `map`을 받는다.
- 데이터·상태: `graphify-out/context-src/`에 평탄한 이름의 `.md` 파일들과 `map.json`(`{ "<평탄 파일명>": "<원본 저장소-상대 경로>" }`)이 생긴다. 빌드마다 전체 재생성하므로 삭제된 문서가 남지 않는다. `graphify-out/`은 이미 gitignore 대상이라 새 무시 규칙이 필요 없다.
- 수용 기준: epic Success criteria 1–6.
- 검증 명령: `npm test`
- 실패 모드·엣지 케이스:
  - 화이트리스트 섹션이 하나도 없는 문서는 파생 파일을 만들지 않는다. 빈 섹션만 남는 파일도 만들지 않는다.
  - 파생 트리가 비면 graphify를 호출하지 않고 그 scope를 건너뛴다. 빈 디렉터리를 스캔시켜 빈 그래프를 덮어쓰지 않는다.
  - 평탄 이름이 충돌하면(`a.b`와 `a-b`가 같은 슬러그로 접힘) 접미사를 붙여 분리한다. `map.json`이 유일한 진실이다.
  - `map.json`에 없는 노드는 드롭한다. 파생 이름을 그대로 `source_file`에 남기는 폴백을 두지 않는다.
  - `.bouncer/Distill.md`는 `context_dirs` 밖이라 mtime 감시에서 빠진다. `watchFiles`로 따로 넣지 않으면 Distill만 고친 세션에서 그래프가 stale로 남는다.
  - freshness walk는 `graphify-out`을 prune하므로 파생물이 자기 자신을 stale로 만드는 루프는 생기지 않는다.

## Out of scope
- source 그래프 scope의 `dirs` / 스캔 대상
- `graphify query` 호출 문자열과 디렉터리 롤업 규칙
- `.bouncer/config.json` 스키마에 화이트리스트 설정 키 추가

## One-commit justification
task 001은 파생 트리 생성과 그래프 빌드 배선을 함께 바꾼다. 추출기만 있고 배선이 없으면 아무도 그 트리를 읽지 않고, 배선만 바꾸면 스캔 대상이 없어 그래프가 깨진다. task 002는 그 위에 소비 측 방어선과 문서를 얹는 별개의 리뷰 단위다. 두 커밋이 한 blueprint = 한 PR을 이룬다.

## Documents
* [Tasks 001](tasks/001/tasks.md) - 파생 트리 추출기와 그래프 빌드 배선
* [Verification 001](tasks/001/verification.md) - 검증 명령과 증적
* [Review 001](tasks/001/review.md) - 리뷰 발견사항
* [Tasks 002](tasks/002/tasks.md) - 소비 측 방어 필터와 문서 갱신
* [Verification 002](tasks/002/verification.md) - 검증 명령과 증적
* [Review 002](tasks/002/review.md) - 리뷰 발견사항
