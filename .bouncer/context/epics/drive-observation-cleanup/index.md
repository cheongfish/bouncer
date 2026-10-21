---
type: bouncer.epic
title: 드라이브 관찰 결과 정리
description: Clean up digest and PR input noise, reconcile post-drive state, improve CLI error guidance, and cut duplicated context found in the 089/004 drive.
resource: .bouncer/context/epics/drive-observation-cleanup/index.md
tags:
  - bouncer
  - epic
  - finalize
  - digest
  - cli
  - coordinator
timestamp: '2026-10-10T21:36:43.484+09:00'
bouncer:
  id: drive-observation-cleanup
  epic_id: drive-observation-cleanup
  status: approved
  supersedes: []
---
# 091 드라이브 관찰 결과 정리

## Intent
089/004 drive에서 finalize digest가 blueprint 본문과 중복 항목을 PR 입력에 섞고, 종료 뒤 상태가 해결된 실패를 계속 보이며, CLI 오류가 다음 행동을 알려주지 않고, 스킬 문서가 같은 컨텍스트를 반복해서 읽게 했음.
이 epic은 digest·종료 상태·CLI 오류 출력·스킬 문서를 고쳐 이 관찰들을 없애고, 승인 게이트와 검증 증거의 의미는 바꾸지 않음.

## Success criteria
1. digest의 `out_of_scope`는 `## Out of scope` 절 안의 항목만 담는다. 다음 `## ` 제목부터는 포함하지 않는다.
2. 같은 deferred·accepted finding은 `pr.sections.review_points`에 한 번만 나타나고, digest `unverified`의 `finding-deferred` 행은 유지된다.
3. `pr.sections.verification`에는 같은 문자열이 두 번 이상 나타나지 않는다.
4. digest `symbols`는 들여쓰기 없는 줄에서 선언된 이름만 담는다.
5. repair 뒤 terminal verification 재실행이 통과해 그 task가 integrated되면 해당 terminal failure는 `bouncer current`와 checkpoint의 미해결 실패로 나오지 않는다. 코디네이터의 repair 라우팅과 partial-close 판정은 기존과 같다.
6. `execution_kind: verification` task가 없는 blueprint의 digest `unverified`에는 `terminal-missing`이 없다. `headVerified`는 그 경우 `null`로 유지된다.
7. `--blueprint`가 필요한 CLI 명령을 그 인자 없이 실행하면 exit 2는 유지하고, closed가 아닌 blueprint 후보와 `next`를 함께 출력한다. 후보를 자동 선택하거나 포인터로 대체하지 않는다. finalize 스킬 본문은 finalize gate 명령을 `--blueprint`와 함께 적는다.
8. `coordinate next`·`advance`의 cwd 오류는 JSON `ok:false`와 `next`로 반환된다.
9. cwd 또는 그 상위에서 처음 만나는 bouncer 소스 checkout이 있고 실행 중인 CLI 루트가 그 checkout과 realpath가 다르면 stderr에 경고 한 줄을 출력한다. 비교할 수 없으면 출력하지 않으며 stdout JSON은 바뀌지 않는다.
10. 코디네이터가 worktree를 제거한 뒤 `.worktrees/` 아래에서 비게 된 상위 디렉터리를 `rmdir`로 제거한다. 비어 있지 않거나 `.worktrees/` 밖이면 남긴다. finalize cleanup 안내도 같은 규칙을 적는다.
11. 워크플로 스킬은 `AGENTS.md`가 이미 시스템 컨텍스트에 있으면 다시 Read하지 않아도 된다고 적는다. `/bouncer-run`은 같은 세션에서 preflight를 다시 실행하면 이전 결과와 달라진 필드만 한 줄로 요약하고 start ACQ는 그대로 묻는다고 적는다.
12. `/bouncer-run`은 `affected_paths`를 start ACQ에서만 보여주고, 코디네이터 입력은 `--write-input` 파일 경로로 전달한다고 적는다.
13. 각 task Checklist가 지정한 실패 테스트와 문구 고정 테스트가 추가·갱신되어 통과하고, 변경한 TypeScript의 생성 JavaScript는 `npm run check:emit`을 통과하며, CHANGELOG `[Unreleased]`에 task별 항목이 있다. `npm run ci`가 통과하고 최종 검증 증거는 execute gate만 기록한다.

## Out of scope
- 090에서 처리한 코디네이터 반환 계약, 조기 반환 재개, finalize 의존성 준비.
- `--blueprint` 자동 선택과 포인터 대체.
- finalize `--yes`의 검증 증거 재사용, 코디네이터의 `verify:strict` 반복 실행 축소.
- PR `background`·`changes`·`flow` 자동 채움, `explain-quiz.md`와 `explain-diff`의 병합.
- start ACQ 생략이나 자동 승인.
- auto mode 분류기, 권한 범위 같은 호스트 동작.

## Blueprints
* [001 digest PR 입력 정리](../drive-execution/blueprints/digest-pr-input/index.md) - finalize digest와 PR draft에서 Out of scope 절 경계, finding 중복, 검증 줄 중복, 지역 symbol을 정리한다.
* [002 종료 상태 정합성](blueprints/002-terminal-state-consistency/index.md) - coordinator 원장의 terminal failure 해결 표시와 digest의 terminal-missing 조건을 고친다.
* [003 CLI 오류 안내와 정리](blueprints/003-cli-ergonomics/index.md) - CLI의 --blueprint 누락·cwd 오류 출력, 버전 불일치 경고, 빈 worktree 상위 디렉터리 정리를 구현한다.
* [004 컨텍스트 중복 축소](blueprints/004-context-dedup/index.md) - 워크플로 스킬 문서에서 AGENTS.md 재독, run 재실행, affected_paths 중복 표시, 코디네이터 입력 전달 문구를 고친다.

## Execution order
BP 001 → BP 002 → BP 003 → BP 004 순서로 실행한다. BP 001과 002가 `finalize-digest.ts`를, BP 003과 004가 CHANGELOG와 스킬 문서를 공유하므로 BP를 동시에 실행하지 않는다. BP 사이 순서는 운영 순서이며 task `depends_on`에 다른 BP를 연결하지 않는다.
