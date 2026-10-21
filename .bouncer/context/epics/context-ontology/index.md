---
type: bouncer.epic
title: 컨텍스트 결정 검색
description: Tracks deterministic context ontology retrieval and CLI delivery with source evidence and remaining verification work.
resource: .bouncer/context/epics/context-ontology/index.md
tags:
  - bouncer
  - epic
  - ontology
  - retrieval
  - provenance
timestamp: '2026-10-18T11:50:23.384+09:00'
bouncer:
  id: context-ontology
  epic_id: context-ontology
  status: approved
  supersedes: []
---
# 컨텍스트 결정 검색

## Intent
과거 결정의 엔티티와 파일 연결을 찾을 때 컨텍스트 문서와 Git 이력을 반복해서 읽어야 함.
기존 문서에서 출처가 있는 관계를 결정적으로 추출하고 Bouncer CLI로 조회하도록 함.

## 통합 현황

2026년 10월 18일 기준 검색 코어는 `61651ba5`에, CLI·테스트·사용 문서와 lint 복구는 `18d19f6f`에 통합됐고 `origin/develop`에도 반영됐다. 구현 커밋의 병합과 Bouncer finalize는 별개이며 epic과 blueprint의 승인 상태를 완료 상태로 바꾸지 않는다.

현재 남은 작업은 범위 밖 `test/commit-hook.test.js:544`의 테스트 이름 오류로 실패한 전체 CI와, CLI의 정렬·구체 evidence·빈 결과 검증을 보강하는 미해결 리뷰 `CT-001`이다. 아래 성공 기준은 목표이며 전부 충족됐다는 뜻이 아니다. 특히 성공 기준 5의 생성본 staging 복구 문서·회귀 테스트는 이번 CLI 실행에서 제외했다.

통합 SHA, 검증 결과, 후속 작업과 로컬 실행 기록 위치는 [통합 기록](../../../../docs/reviews/2026-10-18-context-ontology-cli-integration.md)에 정리했다.

## Success criteria
1. 기존 epic·blueprint·task·Explain에서 문서, 엔티티, 파일 노드와 출처가 있는 관계를 추출하며 원본 문서 형식을 바꾸지 않는다.
2. 엔티티·파일 조회와 파일 기준 영향 조회는 동일 입력에서 같은 정렬·중복 제거 결과를 반환한다. 영향은 공유 관계이며 인과를 주장하지 않는다.
3. 누락·잘못된 문서와 없는 Git 커밋은 명시한 경고로 남기고, 출처가 없는 관계를 만들지 않는다. 저장소 경계 밖 파일은 읽지 않는다.
4. 기존 intent 조회·bundle·sections의 응답과 승인·scope·gate 계약을 유지한다. 온톨로지 결과는 탐색 데이터이며 실행 권한을 부여하지 않는다.
5. 생성본 staging 충돌 복구 절차와 격리된 Git fixture 회귀 테스트가 빌드 산출물 및 무관한 staged 변경 보존을 입증한다.
6. 구현 범위는 scripts/src/**/*.ts와 필요한 테스트·문서로 제한한다. scripts/lib/*.js는 빌드 산출물로만 유지하고 실제 저장소에 staging·commit하지 않는다.
7. 모든 task의 검증 절차는 npm run build 다음 npm run check:emit을 실행한다. 구현 task는 각자 관련 테스트를 실행하고 종단 task는 npm run ci를 실행한다.
8. 기존 의존성·한국어 주석·한국어 커밋 규약 및 테스트 계층 분류를 지킨다. 검증 성공 증적은 실행 게이트가 기록한다.

## Out of scope
- 참고 문서의 독립 Python 실험과 에이전트 300회 실행, 토큰 절감·정확도 개선의 실측 주장.
- 인과 추론, LLM 관계 생성, 새 frontmatter 필드, 기존 문서 일괄 수정, 자동 staging 복구.
- 기존 intent provenance·bundle·sections 및 Graphify 체계 재설계. 새 계획은 이 계약을 대체하지 않는다.
- 참고 문서의 기존 코어 제외 결론은 이번 사용자의 코어 기능 추가 선택으로 범위만 전환한다. 기존 실험 기록을 소급 수정하지 않는다.

## Blueprints
* [컨텍스트 온톨로지 조회 명령](../context-search/blueprints/context-ontology-cli/index.md) - 병합된 코어에 CLI·테스트·사용 문서와 승인된 lint 복구를 추가한 독립 실행. 전체 CI 실패와 리뷰 후속 작업이 남아 있다.

이전 `001-context-ontology-retrieval`은 검색 코어의 출발 계획이다. 코어 TASKS-001 병합 후 해당 실행의 ledger가 blocked로 남아 새 CLI 실행에 재사용하지 않았다. 이전 계획·작업 지시서·증적과 worktree는 로컬에 보존하며, 미추적 이전 계획으로 향하는 링크를 공개 색인에 추가하지 않는다.
