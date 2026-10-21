---
type: bouncer.blueprint
title: CLI 실행·범위 계약 결함 수정
description: Makes print dispatch reject empty reports, keeps bouncer commit failures as one stdout JSON object, warns when coordinate revise drops scope paths, parses integrate dirty paths with -z, and rejects G25 Touch paths outside the repository.
resource: .bouncer/context/epics/drive-execution/blueprints/cli-execution-scope-contract/index.md
tags:
  - bouncer
  - blueprint
  - cli
  - coordinator
  - scope
  - dispatch
timestamp: '2026-10-14T14:24:39.789+09:00'
bouncer:
  id: cli-execution-scope-contract
  epic_id: drive-execution
  blueprint_id: cli-execution-scope-contract
  status: closed
  order: 54
  commit_type: fix
  scale: full
  review_scope: blueprint
  supersedes: []
---
# CLI 실행·범위 계약 결함 수정

Epic: [099](../../../bouncer-improvements-2026-10-14/index.md)

## Intent
빈 보고서 성공 처리, commit 예외의 비JSON 출력, revise의 조용한 범위 축소, C-quote 경로 오판, 저장소 밖 Touch 경로 통과처럼 드라이브를 멈추거나 판정을 틀리게 하던 CLI 계약 결함을 바로잡음.
각 명령은 실패를 기계가 읽을 수 있는 reason으로 돌려주고, 기존 성공 경로와 결과 shape는 유지함.

## Contract
- 인터페이스:
  - `bouncer dispatch print`: 최종 result event의 `result`가 문자열이 아니거나 trim 후 빈 문자열이면 `{ ok: false, reason: 'report-missing', cause, next, stdout, stderr }`, exit 1. 판정 순서는 `result-missing` → `result-error` → `report-missing`이다.
  - `bouncer commit --blueprint <dir> [--yes]`: `commitTask`가 던진 예외는 CLI 경계에서 `{ ok: false, reason: 'commit-exception', cause, recovery: { action: 'report-and-stop', detail } }` 한 객체로 stdout에 내고 exit 1. `commitTask` 함수 자체의 throw 계약은 바꾸지 않는다.
  - `bouncer coordinate revise`: 성공 결과에 이전 범위에서 빠진 경로가 있을 때만 `warnings: [{ code: 'scope-paths-dropped', paths: string[] }]`를 붙인다. 교체 의미와 기존 거절 reason은 그대로다.
  - `bouncer coordinate integrate`: 허용 목록 비교와 `integration-source-mutated`의 `paths`는 Git이 C-quote하지 않은 원래 경로 문자열을 쓴다.
  - plan gate G25: 기존 `Touch path does not exist: …` 실패에 더해 `Touch path escapes repository: …` 실패를 같은 코드로 낸다.
- 데이터·상태: 원장 schema, task 문서 frontmatter, 결과 JSON의 기존 필드는 바꾸지 않는다. `warnings`는 revise 결과에만 생기는 선택 키다.
- 수용 기준: epic 성공 기준 18–22를 충족하고, 바뀐 계약 밖의 기존 테스트는 그대로 통과한다.
- 검증 명령: task별 focused 테스트는 Checklist에 두고, 최종 검증은 `npm run ci`다.
- 실패 모드·엣지 케이스:
  - print dispatch에서 `is_error: true`이고 result가 빈 경우는 `result-error`다.
  - commit은 stage 뒤 `git commit`이 실패해도 stage된 index를 되돌리지 않는다(현재 동작 유지). `cause`는 error message 첫 줄이고, `recovery`(`report-and-stop`)가 더 진행하지 말고 보고하라고 안내한다.
  - revise의 이전 범위는 원장 `scope.paths`, 없으면 문서 `affected_paths`다. 둘 다 비어 있으면 경고가 없다.
  - porcelain `-z`의 rename·copy 항목은 다음 토큰이 원래 경로이고 양쪽을 모두 검사한다.
  - G25에서 `a/../b`처럼 정규화 뒤에도 저장소 안이면 통과하고, 저장소 밖 경로에는 존재 검사를 하지 않는다.

## Out of scope
- `coordinate revise --add-path`(B-03), revise 축소를 거절하는 모드.
- `sourceStatus`·`initialWorktreeState`와 dirty 무시 목록 통합. seed worktree가 `git ls-files`(비`-z`)로 읽어 한국어 blueprint 경로를 escape하는 문제는 별도 후속 작업이다.
- commit 실패 뒤 index 복원, 커밋 검증기 허용 어미 목록, `commitTask`의 내부 throw 정책.
- `parseTouchRows`의 행 정규화, `.bouncer`·`.git` 대상 Touch 경로 거절.

## One-commit justification
- 다섯 결함은 서로 다른 CLI 명령의 실패 계약이라 task 다섯 개로 나눠 병렬로 진행하고, 백로그 8절 3번 묶음 하나로 리뷰받도록 하나의 PR로 묶는다. B-02는 B-01과 같은 coordinator 역할 문서를 고치므로 그 뒤에 실행한다.

## Documents
* [Tasks 001](tasks/001/tasks.md) - print dispatch 빈 보고서 거절
* [Tasks 002](tasks/002/tasks.md) - commit 예외의 JSON 실패 출력과 coordinator commit 지시 정리
* [Tasks 003](tasks/003/tasks.md) - revise 범위 축소 경고와 교체 의미 명시
* [Tasks 004](tasks/004/tasks.md) - integrate dirty 경로 `-z` 파싱
* [Tasks 005](tasks/005/tasks.md) - G25 저장소 밖 경로 거절과 Rename old 회귀 테스트
* [Verification](tasks/001/verification.md) - task별 실행 검증 증적
* [Review](review.md) - blueprint 최종 리뷰
* [Context review](context-review.md) - 계획 문서 정합성 판정
