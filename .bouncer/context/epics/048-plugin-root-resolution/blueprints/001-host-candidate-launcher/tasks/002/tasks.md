---
type: bouncer.tasks
title: 워크플로 루트 해석과 설치 안내 이관
description: 모든 워크플로가 launcher를 사용하고 호스트별 선택 정책을 안내한다
resource: .bouncer/context/epics/048-plugin-root-resolution/blueprints/001-host-candidate-launcher/tasks/002/tasks.md
tags:
  - bouncer
  - tasks
timestamp: '2026-08-24T15:32:36.463+09:00'
bouncer:
  id: TASKS-002
  epic_id: '048'
  blueprint_id: '001'
  status: verified
  commit_intent:
    - 호스트별 루트 환경변수 계약이 스킬 셸까지 보장된다고 볼 수 없는 상태임
    - 같은 선택 정책과 provider 경계를 모든 진입점에서 일관되게 보여야 함
  affected_paths:
    - CLAUDE.md
    - rules/plugin-root.md
    - skills/bouncer-init/SKILL.md
    - skills/bouncer-plan/SKILL.md
    - skills/bouncer-execute/SKILL.md
    - skills/bouncer-commit/SKILL.md
    - skills/bouncer-finalize/SKILL.md
    - skills/bouncer-run/SKILL.md
    - skills/explain-diff/SKILL.md
    - skills/graphify-runner/SKILL.md
    - skills/migrate-ids/SKILL.md
    - skills/review/SKILL.md
    - docs/install.md
    - README.md
    - test/cursor-plugin.test.js
    - test/master-rules.test.js
    - test/public-name-regression.test.js
  scope_evidence:
    producer: graphify
    generated_at: '2026-08-24T15:36:21.000+09:00'
    suggested_paths:
      - test
    # 유효 엔트리 필드: graph, status, query, result — 예시는 주석이라 파싱되지 않는다
    # - graph: source | context
    #   status: updated | reused | fail-skip | skip-disabled | missing
    #   query: <graphify 조회>
    #   result: <한 줄 요약>
    basis:
      - graph: source
        status: reused
        query: 'plugin root launcher BOUNCER_HOME candidate host semver interactive select workflow skills'
        result: '59 nodes; top source hits are test/skill-bouncer-surface.test.js, test/distribution.test.js, and test/plugin-wiring.test.js'
      - graph: context
        status: updated
        query: 'plugin root launcher BOUNCER_HOME candidate host semver interactive select workflow skills'
        result: '8 nodes; top context hits are the Antigravity plugin-surface explain document and this epic index'
---
# Tasks

Blueprint: [001](../../index.md)

<!-- scope_evidence.basis 엔트리 필드: graph, status, query, result.
     graph: source | context
     status: updated | reused | fail-skip | skip-disabled | missing
     프론트매터 값은 []로 둔다. 이 주석을 실제 엔트리로 옮기면 빈 계획이 승인된다. -->

## Goal & intent
워크플로 스킬이 환경변수 삼항식 대신 `bouncer-root` launcher를 호출하고, 설치 문서와
규칙 문서가 대화형 선택·자동 선택·수동 override·provider pin의 경계를 같은 말로
설명하게 한다.

## Interface
- 제공: 모든 `bouncer-*` 워크플로가 각 Shell block에서 `bouncer-root` 결과를
  `BOUNCER_ROOT`로 할당하는 공통 호출 표면, 그리고 사용자에게 PATH launcher 설치와
  `--select` / `--auto` 사용법을 안내하는 문서.
- 거부: SessionStart·훅 환경 출력이 Agent Shell에 전달된다고 주장하는 문구,
  `BOUNCER_HOME`으로 provider를 추정하는 문구, 경로가 없을 때 cwd나 plugin cache를
  임의로 고르는 fallback.

## Touch
- Modify `CLAUDE.md` — plugin-root shell 예시를 launcher 계약으로 바꿔 모든
  workflow가 참조하는 master rule과 일치시킨다.
- Modify `rules/plugin-root.md` — launcher 부트스트랩, 후보 검증·정렬, 선택 모드와
  provider 분리 계약을 SSOT로 바꾼다.
- Modify `skills/bouncer-init/SKILL.md` — 각 CLI Shell block이 launcher 결과를
  사용하도록 바꾼다.
- Modify `skills/bouncer-plan/SKILL.md` — 프로젝트 루트·Distill·scaffold·gate
  호출의 루트 해석을 launcher로 통일한다.
- Modify `skills/bouncer-execute/SKILL.md` — execute worktree와 plugin root를
  계속 분리하면서 launcher를 사용한다.
- Modify `skills/bouncer-commit/SKILL.md` — commit gate·pointer 호출을 launcher로
  통일한다.
- Modify `skills/bouncer-finalize/SKILL.md` — finalize의 모든 독립 Shell block을
  launcher로 통일한다.
- Modify `skills/bouncer-run/SKILL.md` — 반복 drive의 CLI 호출을 launcher로
  통일한다.
- Modify `skills/explain-diff/SKILL.md` — finalize가 호출하는 독립 Shell block의
  루트 해석을 launcher로 통일한다.
- Modify `skills/graphify-runner/SKILL.md` — plan-time graph CLI 호출의 루트
  해석을 launcher로 통일한다.
- Modify `skills/migrate-ids/SKILL.md` — migration CLI 호출의 루트 해석을
  launcher로 통일한다.
- Modify `skills/review/SKILL.md` — reviewer model 해석에 쓰는 CLI require 경로를
  launcher 결과로 통일한다.
- Modify `docs/install.md` — PATH launcher 설치, `--select` 번호 선택,
  `--auto` 최고 버전 선택, `BOUNCER_HOME` 일회성 override와 host filter를 안내한다.
- Modify `README.md` — 설치 안내에서 영구 `BOUNCER_HOME` export 요구를 launcher
  안내로 바꾼다.
- Modify `test/cursor-plugin.test.js` — 모든 workflow가 이전 삼항식 대신 launcher
  계약을 사용하고 빈 prefix로 실행하지 않음을 단정한다.
- Modify `test/master-rules.test.js` — master rule과 workflow의 plugin-root
  해석 계약이 같은 launcher 표면을 가리키도록 단정을 갱신한다.
- Modify `test/public-name-regression.test.js` — 새 공개 PATH 명령과 문서 표면이
  고정된 이름 정책을 만족하도록 단정을 갱신한다.

## Do not touch
- `scripts/src/lib/subagents.ts` — provider 결정 계약은 바꾸지 않는다.
- `scripts/lib/subagents.js` — provider 결정 계약은 바꾸지 않는다.
- `hooks/hooks.json` — 호스트가 치환하는 훅 토큰은 일반 스킬 셸 해석과 별개로 둔다.
- `hooks/cursor-hooks.json` — 상대 훅 경로와 commit-safety 계약은 바꾸지 않는다.

## Constraints
- 각 fenced Shell block은 독립 셸이므로 `BOUNCER_ROOT`를 읽는 같은 block 안에서
  launcher를 호출한다. 실패 상태를 command substitution으로 숨기지 않는다.
- 문서는 host 후보 경로가 구현의 allowlist임을 설명하되, 실제 사용자 홈의 절대 경로를
  고정값으로 제시하지 않는다. 비대화형 실행은 `--auto` 또는 `BOUNCER_HOME`을 쓴다.
- provider는 `.bouncer/config.json`의 명시 pin이 우선이며, launcher 선택 결과는
  provider·subagent model을 변경하지 않는다.

## Checklist
- [ ] `test/cursor-plugin.test.js`와 public-name 회귀 테스트를 먼저 갱신해 모든
  workflow skill이 다음 패턴을 갖도록 실패 조건을 만든다.

  ```bash
  BOUNCER_ROOT="$(bouncer-root --auto)" || exit $?
  node "${BOUNCER_ROOT}/scripts/bouncer" <command>
  ```

- [ ] 여섯 workflow와 `explain-diff`·`graphify-runner`·`migrate-ids`·`review`의
  모든 독립 Shell block을 이 패턴으로 이관하고, 프로젝트 `PROJECT_ROOT`·Distill의
  기존 CLI 해석 규칙은 유지한다.
- [ ] `rules/plugin-root.md`, `docs/install.md`, `README.md`에서 수동 override,
  대화형 선택, 자동 선택, host filter, PATH 설치와 provider pin의 차이를 일관되게
  설명한다.
- [ ] `npm test`를 실행해 문서 표면 계약과 모든 기존 테스트가 통과함을 확인한다.
