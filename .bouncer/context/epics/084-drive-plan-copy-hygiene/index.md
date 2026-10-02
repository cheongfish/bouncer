---
type: bouncer.epic
title: drive 마감 뒤 메인 계획 사본 정리와 템플릿 안내 이전
description: Keep main free of closed blueprint plan copies after a drive and move scaffold authoring guidance out of templates into skills.
resource: .bouncer/context/epics/084-drive-plan-copy-hygiene/index.md
tags:
- bouncer
- epic
- finalize
- worktree
- scaffold-template
- plan-gate
timestamp: '2026-10-02T12:23:54.192+09:00'
bouncer:
  id: '084'
  epic_id: '084'
  status: approved
  supersedes: []
---
# 084 drive-plan-copy-hygiene

## Intent
- 문제: drive가 끝나도 메인에 남은 닫힌 blueprint의 계획 사본이 `git pull`·`git merge`를 overwrite로 막고, 시드 사본에 남은 스캐폴드 안내 주석이 종단 `lint:context-comments`를 실패시킨다.
- 목표: finalize가 메인 사본 정리와 worktree 제거, 다음 blueprint 이동까지 끝내고, 템플릿 안내 주석은 스킬 문서로 옮겨 남은 옛 주석을 plan 단계에서 막는다.

## 근거
`INCIDENT-TASKS-002-lint-context-comments.md`(083-002 사고 기록, 미추적 입력)를 따른다. 069-004 drive-document-flow의 copy+release 계약 중 release 부분을 이 epic이 대체한다.

## Success criteria
1. 메인 checkout에서 `bouncer finalize release-main --blueprint <bp>`를 실행하면 닫힌 blueprint 디렉터리 아래 미추적·staged 신규 파일이 모두 지워진다. 그 뒤 integration 브랜치를 메인에 `git merge`하면 overwrite 오류 없이 끝난다(e2e 테스트).
2. `release-main`은 sibling blueprint 디렉터리와, 수정되지 않은 tracked 파일을 바이트 그대로 둔다. 닫는 blueprint 트리 안에서 수정된 tracked 파일은 `HEAD`로 복원한다.
3. drive였다면(원장 존재) epic `index.md`와 `.bouncer/context/index.md`는 원장 `seedManifest`와 해시가 같을 때만 `HEAD` 복원 또는 삭제되고, 다르면 `preserved`로 보고된다. 원장에 `seedManifest`가 없으면 두 파일을 건드리지 않고 `preserved`로 보고한다.
4. 메인 checkout이 아닌 cwd, 닫히지 않은 blueprint, 끝나지 않은 drive, 정규형이 아닌 blueprint 경로에서 `release-main`은 JSON `reason`과 exit 1로 거절하고 파일을 하나도 바꾸지 않는다.
5. `bouncer coordinate release`는 usage 목록에서 빠지고, 호출하면 exit 2로 거절된다. `rules/cli.md`와 finalize 스킬에 `coordinate release`가 남지 않는다.
6. finalize 스킬의 `finalize.remainder` 질문에 worktree 유지 선택지가 없다. cleanup은 `release-main` 성공 뒤에만 `git worktree remove --force`로 worker와 integration을 모두 지우고, dirty-tree 경고 질문을 하지 않는다. `release-main`이 거절되면 worktree와 원장을 남긴다.
7. `release-main` 결과의 `next`는 메인 checkout 기준 같은 epic의 첫 approved blueprint(ready task 보유) 또는 `null`이다. 스킬은 질문 없이 `bouncer current --set`을 실행하고 결과를 알린다. plan gate가 거절하거나 `next`가 `null`이면 pointer는 비어 있고 그 사실을 알린다. `finalize.next_blueprint` ACQ는 없다.
8. `scripts/src/lib/templates.ts`의 full 템플릿 본문에 HTML 주석이 없다.
9. 템플릿에만 있던 작성 안내(blueprint Contract 규칙, One-commit 쪼개기 신호, epic Intent·Blueprints 색인 형식, Out of scope→Do not touch 상속, Goal & intent 수용 기준·Touch 백틱, fingerprint 정규화)가 `references/spec-authoring/index.md`, `references/review/index.md`, `references/context-review/index.md`, 두 reviewer agent에 있다.
10. 옛 스캐폴드 주석 본문이 blueprint 트리 문서나 epic `index.md`에 남아 있으면 plan gate가 G22로 거절하고, `coordinate bootstrap`은 worktree를 만들기 전에 `scaffold-comment-remaining`으로 거절하며, `lint:context-comments`도 계속 잡는다.
11. `npm run ci`가 통과한다.

## Out of scope
- 단독 `/bouncer-execute`의 이동 seed(`seedWorktree`) 변경
- GitHub PR merge를 기다린 뒤 worktree를 지우는 경로
- epic·blueprint 본문의 TODO 자리표시 게이트
- 이미 커밋된 옛 계획 문서 코퍼스의 주석 정리
- 테스트 헬퍼가 복제한 fence 명령 목록(`__FENCED`)의 정리
- `INCIDENT-TASKS-002-lint-context-comments.md` 커밋

## Blueprints
* [finalize 메인 사본 정리와 pointer 자동 이동](blueprints/001-finalize-main-release/index.md) - `finalize release-main` 추가, `coordinate release` 제거, finalize 스킬의 강제 worktree 제거·자동 `--set` — `scripts/src/lib`, `skills/bouncer-finalize`, `rules`, `docs/workflow.md`, `CHANGELOG.md`, `test`
* [템플릿 안내 주석을 스킬로 이전](blueprints/002-template-guidance-migration/index.md) - full 템플릿 주석 삭제, 작성 안내 이전, 옛 주석 G22·bootstrap 거절 — `scripts/src/lib`, `scripts/check-context-comments.js`, `references`, `agents`, `.codex/agents`, `rules/gates.md`, `docs/architecture`, `CHANGELOG.md`, `test`
