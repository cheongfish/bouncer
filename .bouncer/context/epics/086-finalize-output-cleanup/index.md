---
type: bouncer.epic
title: finalize PR base와 결과 출력 정리
description: Finalize resolves the PR base from the repository default branch, and finalize result JSON stops carrying coordinator drive records.
resource: .bouncer/context/epics/086-finalize-output-cleanup/index.md
tags:
  - bouncer
  - epic
  - finalize
  - pr
  - coordinator
timestamp: '2026-10-06T10:11:03.092+09:00'
bouncer:
  id: '086'
  epic_id: '086'
  status: approved
  supersedes: []
---
# 086 finalize PR base와 결과 출력 정리

## Intent
- 문제: config에 `pr.base`·`base_branch`가 없으면 finalize digest가 PR base를 `main`으로 고정해, 기본 브랜치가 `develop`인 저장소에서 `gh pr create --base main`이 실패하고 제목이 `(→ Main)`이 된다. 085가 digest에서 뺀 drive 실행 기록(repair wave, decisions, scope revision, actual paths)은 `finalize` dry-run·`--yes`·partial_closed 결과의 `coordinator`에 남아 모델에게 보인다.
- 목표: PR base는 config, 그다음 `origin/HEAD`에서 정하고, 둘 다 없으면 추측하지 않고 사용자에게 묻는다. finalize 결과 JSON에서 drive 실행 기록을 담던 `coordinator`를 뺀다.

## Success criteria
1. config에 `pr.base`·`base_branch`가 없고 `origin/HEAD`가 `origin/develop`인 저장소에서 `bouncer finalize prepare` digest의 `git.pr_base`와 `pr.base`가 `develop`이고 `pr.title_prefix`가 `(→ Develop)`을 담는다.
2. config도 `origin/HEAD`도 없으면 digest `git.pr_base`·`pr.base`·`pr.title_prefix`가 `null`이고 `pr.title_prefix_template`이 `{base}` 자리를 담는다. 현재 checkout branch를 PR base로 쓰지 않는다.
3. config `pr.base` 또는 `base_branch`가 있으면 지금과 같은 값이 나온다. `bouncer init`의 `base_branch` 탐지 결과는 바뀌지 않는다.
4. `skills/bouncer-finalize/references/draft-pr.md`가 `gh pr create --base`에 digest `pr.base`를 쓰게 하고, `pr.base`가 `null`이면 `finalize.pr` ACQ에서 base를 물어 `pr.title_prefix_template`의 `{base}`를 채우게 한다.
5. `bouncer finalize`의 dry-run, `--yes`(빈 커밋 경로 포함), partial_closed, `coordinator-ledger` 거절 결과에 `coordinator` 키가 없다. top-level `worktrees`·`branch`·`integration`·`ledgerFile`·`integrationPath` 값은 지금과 같다.
6. finalize provenance가 `repairWaves`, `decisions`, `terminalFailure`, `userConfirmed`, `lifecycleStatus`, `integrationHead`, `revision`, task별 `scopeRevision`·`actualPaths`를 만들지 않는다.
7. `CHANGELOG.md` `[Unreleased]`에 두 변경이 기록되고, 종단 검증에서 `npm run ci`가 통과한다.

## Out of scope
- `validate-sections.ts`의 `## 이해 상태` heading 정의(옛 문서의 빈 절이 Quiz에 섞이지 않게 의도적으로 남김)
- closed blueprint G2 메시지와 validate hint 표
- `bouncer init`의 `base_branch` 탐지 규칙과 이 저장소의 `.bouncer/config.json` 생성
- 플러그인 릴리스·재설치
- `finalize release-main` 결과와 `coordinate` 출력

## Blueprints
* [001 finalize PR base 탐지와 결과 provenance 축소](blueprints/001-pr-base-and-result-provenance/index.md) - digest PR base를 config → `origin/HEAD` → `null`로 정하고 finalize 결과에서 `coordinator`를 뺀다 (finalize digest·PR draft·finalize CLI, draft-pr 지침)
