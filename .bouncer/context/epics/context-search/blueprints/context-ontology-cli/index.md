---
type: bouncer.blueprint
title: 컨텍스트 온톨로지 조회 명령 추가
description: Exposes merged context ontology retrieval through a read-only CLI with tests and usage documentation.
resource: .bouncer/context/epics/context-search/blueprints/context-ontology-cli/index.md
tags:
  - bouncer
  - blueprint
  - ontology
  - cli
  - retrieval
timestamp: '2026-10-18T12:58:49.894+09:00'
bouncer:
  id: context-ontology-cli
  epic_id: context-search
  blueprint_id: context-ontology-cli
  status: closed
  order: 39
  commit_type: feat
  scale: full
  review_scope: blueprint
  verification_policy: scoped_terminal
  supersedes: []
---
# 컨텍스트 온톨로지 조회 명령

Epic: [111](../../../context-ontology/index.md)

## Intent
병합된 컨텍스트 온톨로지 검색 코어를 CLI에서 조회하도록 함.
읽기 전용 명령의 입력·출력·오류 계약과 사용 문서를 회귀 테스트로 검증함.

## Base & execution
- 기준은 `develop`의 `61651ba5f098e64301159f217125b40c5d52cc5d`다. 기존 blueprint `111/001`의 코어 TASKS-001은 이미 병합됐다.
- 이 blueprint의 TASKS-001은 이전 TASKS-002의 CLI 범위만 수행하는 새 구현 작업이다. 이전 task 상태·ledger·integration/worker worktree를 재사용하거나 수정하지 않는다.
- 최초 DAG는 TASKS-001(commit) → TASKS-002(verification)였으며, 사용자 승인 lint 복구 TASKS-003을 추가한 최종 DAG는 `001 → 003 → 002`다. 최종 scope revision은 `r3`, repair wave는 1이다.

## 통합 결과와 남은 작업

- CLI 구현 TASKS-001은 `worker e32c2cb4`에서 `integration 1c69027b`로, lint 복구 TASKS-003은 `worker 239c4129`에서 `integration 18d19f6f`로 통합됐다. `18d19f6f`는 메인 `develop`과 `origin/develop`에 반영됐다.
- 최초 CLI 관련 회귀 테스트는 102개, lint 복구의 CLI·코어 테스트는 16개가 통과했다. 두 테스트 집합은 중복되므로 합산하지 않는다. 메인 통합 뒤 build와 관련 테스트 16개도 통과했다.
- 종단 `npm run ci`는 exit 1이다. `test/commit-hook.test.js:544`의 테스트 이름에 ` → `가 없는 오류를 `outside_scope`로 기록했으며 TASKS-002는 `verifying`에 남아 있다.
- 최종 리뷰 `CT-001`은 `major / must_fix / deferred`다. CLI 결과 정렬·구체 evidence·무매칭 `results: []`의 fixture 기대값 검증 보강이 남아 있다. 해결이나 사용자 위험 수용을 뜻하지 않는다.
- 실행 CLI는 위 예외·후속 작업을 기록하고 `done`을 반환했다. Bouncer finalize는 실행하지 않았고 문서 상태를 `closed`로 바꾸지 않는다. 영구 Explain은 아직 작성되지 않았다.

자세한 커밋·검증·증적 위치는 [통합 기록](../../../../../../docs/reviews/2026-10-18-context-ontology-cli-integration.md)에 정리했다. 메인의 미추적 task·verification·review 문서는 실행 전 사본이므로 최신 실행 상태로 해석하지 않는다.

## Contract
### 인터페이스
- `bouncer ontology entity --entity <token>`, `bouncer ontology file --file <path>`, `bouncer ontology impact --file <path>`를 제공한다. 각 형식은 singleton `--repo`와 `--limit`을 받는다. limit은 기본 20, 정수 1..100이다.
- 성공 시 코어의 `version/query/results/total/truncated/warnings` 응답을 stdout JSON 하나와 개행으로 출력한다. 무매칭은 `results: []`와 exit 0이다.
- 인자 오류와 `ontology-input-invalid`는 stderr와 exit 2, `ontology-io-failed`는 stderr와 exit 1이다. 실패에는 stdout이 없고 stderr 접두는 `ontology: `다. 다른 예외는 다시 throw한다.
### 데이터·상태
- 매 조회에서 메모리 색인을 만들며 저장소 파일이나 캐시를 쓰지 않는다. draft 포함·검색·정렬·경고는 기존 코어 계약을 따른다.
- entity는 정확 토큰 일치, file은 저장소 상대 파일 경로 일치다. impact는 공유 엔티티·파일의 한 단계 관계이며 인과를 주장하지 않는다.
- help·다른 명령·잘못된 ontology argv는 ontology 코어를 적재하지 않는다. 기존 intent query·bundle·sections의 JSON·종료 코드·캐시 계약을 유지한다.
### 수용 기준
- 목표는 epic 성공 기준 2–4·6–8 중 CLI 범위를 충족하는 것이다. JSON, 경계 limit, 경고와 무매칭의 구분, 입력 거절, I/O 실패, lazy loading을 integration 테스트로 검증한다. 미충족 검증 항목은 위 통합 결과와 남은 작업에 구분했다.
- 한국어 사용 문서에 세 질의의 실행 예, 응답 필드, exit code, 경고, draft 포함, 비인과성, 매 조회 색인과 생성본 관리 경계를 적는다.
- 구현 작업의 관련 테스트와 종단 작업의 전체 CI를 각각 검증한다. build 후 check:emit을 실행하고 생성본은 staging·commit하지 않는다.
### 실패 모드·엣지 케이스
- 누락·빈 값·중복 singleton·알 수 없는 옵션·여분 positional·selector 혼합·안전하지 않은 파일 경로·limit 범위 이탈을 거절한다.
- 실제 checkout root가 아닌 repo와 파일시스템 실패를 코어 오류 코드에 따라 구분한다. 경고는 성공 응답에 남긴다.
- 완료되지 않은 다른 작업의 문서를 링크하거나 검증 통과를 가정하지 않는다.

## Out of scope
- 병합된 ontology 코어의 동작 변경, 기존 intent·bundle·sections와 Graphify 구현 변경.
- 사용자 승인 예외로 `scripts/src/lib/context-ontology.ts`의 lint 전용 수정을 복구 범위에 포함했다. 관찰 가능한 ontology 동작과 공개 인터페이스를 보존한다.
- 기존 TASKS-003의 생성본 staging 복구 절차·테스트와 아직 없는 복구 문서 링크.
- 이전 ledger·task 상태·worktree 수정, 생성본 커밋, 새 의존성과 벤치마크 수정.

## One-commit justification
새 CLI의 parser·lazy 등록·help·동작 테스트·사용 문서를 하나의 구현 커밋으로 묶었다. 이후 사용자 승인 lint 복구를 별도 커밋으로 통합했다. 종단 검증 작업은 source를 수정하지 않고 전체 CI 증적만 남겼다.
