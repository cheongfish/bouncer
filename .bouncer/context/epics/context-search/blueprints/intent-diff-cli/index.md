---
type: bouncer.blueprint
title: 리뷰 snapshot 기반 변경 함수 intent 근거 조회 명령 추가
description: Add a read-only bouncer intent diff command that extracts changed functions from a frozen review snapshot and attaches base-revision intent evidence under a fixed byte budget.
resource: .bouncer/context/epics/context-search/blueprints/intent-diff-cli/index.md
tags:
  - bouncer
  - blueprint
  - intent
  - review-snapshot
  - cli
  - provenance
timestamp: '2026-10-31T23:08:44.899+09:00'
bouncer:
  id: intent-diff-cli
  epic_id: context-search
  blueprint_id: intent-diff-cli
  status: closed
  order: 45
  commit_type: feat
  scale: full
  complexity: standard
  review_scope: blueprint
  verification_policy: scoped_terminal
  review_contract: brief
  prerequisites:
    - blueprint: .bouncer/context/epics/context-search/blueprints/intent-revision-lookup
      merged_commit: 1b7ac9ff80d77da42ac3981494a9f9e35ba01b9c
---
# 리뷰 snapshot 기반 변경 함수 intent 근거 조회 명령 추가

Epic: [context-search](../../index.md)

## Intent
리뷰 diff에 포함된 함수의 과거 결정과 제약을 reviewer 입력과 별개로 먼저 재현 가능하게 뽑을 수 있어야 하므로, 동결된 review snapshot에서 변경 함수를 추출하고 기준 SHA의 intent 근거를 붙여 출력하는 읽기 전용 `bouncer intent diff`를 추가함. dispatch와 reviewer 입력은 바꾸지 않으며, 추출 누락과 근거 부재는 coverage 상태로 구분해 드러냄.

## Contract
- 전제: blueprint `intent-revision-lookup`의 `listDefinitionsInText`, `intent-revision`, `resolveIntentAtRevision`을 소비한다. 병합 전에는 계획 문서가 승인될 수 없도록 `bouncer.prerequisites`로 선언해야 하며, 병합 SHA는 병합 뒤에만 알 수 있어 승인 전에 채운다.
- 인터페이스: 공개 CLI `bouncer intent diff --snapshot <path> --history-ref <sha> [--repo <dir>]`. 내부 모듈 `review-diff-intent`(`extractChangedFunctions`, `collectDiffIntent`)와 `cli-intent-diff-command`(`run`)를 추가한다. 기존 `intent` query·bundle·sections 하위 명령의 입력·출력은 바뀌지 않는다.
- 입력 검증: `--snapshot`은 `<repo>/.bouncer/runtime/review-snapshots/<64자 hex>/snapshot.json` 정규 경로(`.`·`..`·빈 세그먼트·끝 `/` 없이 글자 그대로. `<repo>`는 `--repo`의 realpath 또는 주어진 경로)여야 하고 내용 해시가 그 id와 같아야 한다. `--history-ref`는 7~40자 소문자 hex이며 확정한 SHA가 snapshot의 `target.base`와 같아야 한다(초기 버전은 같을 때만 허용).
- 출력 데이터(성공, exit 0, stdout JSON 하나): `snapshot_id`, `base`, `history_ref`, `projection_version`, `budget_policy`, 전달 슬롯 `slot`, 전체 `manifest`, `digest`.
  - `manifest`: 모든 변경 파일의 coverage(`covered | excluded | unsupported | parse_failed`와 사유, `role`(`symbol-index`가 낸 값, 파싱 대상이 아니면 `null`), 함수 밖 변경 줄 수)와 모든 후보(식별 좌표, `mapping`, 줄 수, `evidence`, `delivery`).
  - `slot`: 순위에서 고른 최대 8개 후보의 근거와 요약·생략 개수·`manifest_digest`. 직렬화(`canonicalJson`) 12 KiB(UTF-8) 이하, 함수별 근거 본문 3 KiB 이하이며 절 단위로만 생략한다.
  - 후보 `mapping`은 `paired | deleted | added | moved | ambiguous_mapping`, `evidence`는 `linked | unlinked | added_no_history | not_queried`, `delivery`는 `selected | omitted_by_count | omitted_by_bytes | manifest_only`다. coverage 진단은 결함 finding이 아니며 "문제 없음"을 뜻하지 않는다.
  - 기존 intent bundle과의 중복 제거는 하지 않는다(`bundle_dedupe: 'not_applied'`를 슬롯에 적는다). CLI가 bundle을 입력으로 받지 않으므로 확인 불가인 항목은 유지한다는 원칙을 적용한 것이다.
- 데이터·상태: 명령은 소스·index·branch·리뷰 상태·snapshot artifact·`.bouncer/runtime`을 쓰지 않는다. 같은 snapshot과 `history_ref`는 같은 바이트와 `digest`를 낸다.
- 수용 기준: epic Success criteria 1이 참이다. 고정 fixture의 후보·mapping·정렬·예산 기대값과 정확히 일치하고, 지원 불가·파싱 실패는 coverage 실패로 계수된다. 사람이 라벨링한 과거 diff 표본(Checklist의 회귀 표본)에서 설명되지 않은 누락이 없다.
- 검증 명령: 구현 task는 `npm run verify:files -- <그 시점에 존재하는 test/review-diff-intent.test.js test/intent-diff-command.test.js>`, 종단 verification task는 `npm run verify:bp`다. 두 스크립트는 `intent-revision-lookup`이 추가한다.
- 실패 모드·엣지 케이스:
  - exit 2(사용법, stderr): 필수 option 누락·중복·알 수 없는 option·빈 값, `--history-ref` 형식 위반, 존재하지 않거나 디렉터리가 아닌 `--repo`. 이때 snapshot·Git·resolver 모듈을 적재하지 않는다.
  - exit 1(stdout `{ok:false, reason, cause, next}` 하나, 부분 결과 없음): `snapshot-path-invalid`, snapshot 로더의 `invalid-snapshot-id | snapshot-missing | snapshot-corrupt | read-failed | unsafe-path`, `history-unreadable`(SHA를 확정하지 못함·Git 실패), `history-ref-mismatch`, `collect-failed`(후보 수집 중 던져진 모든 Error. 메시지가 없는 예외도 고정 cause `unexpected exception without message`로 같은 reason).
  - 상태로 돌려주는 정상 부재(exit 0): 변경 함수 없음, 신규 함수(`added_no_history`), 근거 부재(`unlinked`), 파싱 실패·지원 불가·제외 역할 파일, 예산 생략.
  - 이동·이름 변경은 이전 함수와 새 함수의 함수 이름을 가린 본문이 정확히 같고 양쪽이 1:1일 때만 `moved`로 묶는다. 여러 가능성이면 `ambiguous_mapping`으로 남기고 추측하지 않으며 이전 함수를 버리지 않는다.

## Out of scope
- reviewer 입력·dispatch·`review-record`·reviewer prompt·agent 문서 변경, 운영 자동 활성화, 재생 실험(BP-03 이후)
- `review-snapshot.ts` 쓰기 경로와 snapshot 스키마·id 계산 변경, 근거를 artifact 파일로 저장하는 일
- 태스크 리뷰 확장, delta 재수집, 호출 간 캐시
- `bouncer intent bundle`과의 중복 제거, `--task` 입력
- `CHANGELOG.md`와 버전 파일

## One-commit justification
- 추출, 근거 부착·예산, CLI는 모두 "snapshot 하나에서 정해진 한 출력"을 만드는 한 흐름이다. 추출만 병합하면 소비자가 없고 CLI만 병합하면 입력이 없으며, 세 부분 모두 같은 fixture로 함께 검증해야 누락·오탐을 분리해 볼 수 있다. 따라서 한 PR로 리뷰한다.
