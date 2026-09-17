---
type: bouncer.explain
title: 001 explain
description: Explain for 001
resource: .bouncer/context/epics/001-product-surface-hosts/blueprints/006-host-candidate-launcher/explain.md
tags:
  - bouncer
  - explain
timestamp: '2026-08-24T16:01:31.770+09:00'
bouncer:
  id: EXPLAIN-006
  epic_id: '001'
  blueprint_id: '006'
  status: published
  comprehension:
    - range_from: 5a3142932e1e886a49c7627d20db1d04a2fed5cd
      range_to: 74a21f8b9e77b1ce96c0d16c22516754f4c65da7
      diff_sha: cc5021b092021099cf1a331702d216e6d62de8ea7933302756de221769c9efbf
      quiz_score: 2/3
      disposition: 핵심 실행 경계는 이해했고, 수동 override 우선순위만 보완함.
      recorded_at: '2026-08-24T16:02:46.000+09:00'
---
# Explain

## Background
호스트가 플러그인 루트 환경변수를 주입하지 않으면 workflow skill은 자신의
`scripts/bouncer` 위치를 알 수 없었다. `bouncer-root`는 수동 override를 먼저
검증하고, 알려진 Codex·Claude·Antigravity 설치 후보 중 재현 가능한 하나를 고른다.
그 결과를 모든 workflow의 독립 Shell block이 같은 방식으로 소비하게 했다.

## Intuition
각 workflow가 길을 추측하지 않고, 공통 안내원이 검증한 플러그인 루트만 받아 출발하는 구조다.

## Code
- `scripts/src/lib/plugin-root.ts`는 후보 검증, strict semver 정렬, host 필터와
  `BOUNCER_HOME` 우선순위를 담당한다.
- `scripts/src/lib/bouncer-root.ts`와 `scripts/bouncer-root`는 PATH 명령의 argv·TTY
  선택을 얇게 연결한다. 소비 환경을 위해 CJS emit도 `scripts/lib/`에 함께 둔다.
- `rules/plugin-root.md`, workflow skill 문서, `docs/install.md`는
  `bouncer-root --auto` 호출과 수동 override·provider pin의 경계를 같은 계약으로
  설명한다.
- `test/plugin-root.test.js`와 workflow surface 회귀 테스트는 후보 선택과 문서화된
  호출 표면이 함께 유지되는지 확인한다.

## Quiz
1. `BOUNCER_HOME`이 유효한 플러그인 루트를 가리킬 때 launcher의 동작은 무엇인가?
   - A) host 후보보다 먼저 그 경로를 사용한다.
   - B) 항상 가장 높은 semver 후보를 사용한다.
   - C) provider pin 값으로 경로를 바꾼다.

2. `--select`를 TTY가 없는 환경에서 실행하면 어떻게 해야 하는가?
   - A) 첫 번째 후보를 조용히 선택한다.
   - B) `--auto` 또는 `BOUNCER_HOME`을 쓰라는 오류로 종료한다.
   - C) 현재 작업 디렉터리를 플러그인 루트로 쓴다.

3. Cursor 사용자가 workflow Shell에서 플러그인 루트를 제공해야 할 때 맞는 설명은 무엇인가?
   - A) `bouncer-root --auto`가 Cursor 설치를 자동 탐색한다.
   - B) `subagents.provider`가 launcher의 경로를 자동 설정한다.
   - C) 절대 경로를 담은 일회성 `BOUNCER_HOME` override를 제공하고 provider pin은 별도로 둔다.

## 이해 상태
정답은 1-A, 2-B, 3-C이며 응답은 1-B, 2-B, 3-C였다. 1번은 오답, 2번과 3번은
정답으로 2/3을 기록했다. 수동 `BOUNCER_HOME` override가 유효하면 host 후보보다 먼저
사용한다는 경계를 보완했다.

## Tasks

### Task 001

#### Goal & intent

PATH에 설치된 `bouncer-root`가 `BOUNCER_HOME`을 먼저 검증하거나 Codex·Claude·
Antigravity의 알려진 설치 후보를 찾아 선택하도록 만든다. 자동 모드는 가장 높은
유효 semver를 고르고, `--select`는 대화형 번호 선택을 제공한다.

#### Interface

- 제공: `scripts/bouncer-root` bin과 이를 뒷받침하는 `plugin-root` 라이브러리.
  성공 시 stdout에는 단 하나의 절대 경로만, 진단은 stderr에만 쓴다. `--host`,
  `--auto`, `--select`의 정책과 `BOUNCER_HOME` 우선순위는 테스트 가능한 공개 계약이다.
- 거부: 유효성 없는 `BOUNCER_HOME`, manifest 또는 `scripts/bouncer`가 없는 후보,
  미지원 host 값, TTY 없는 `--select`, 비semver 자동 후보, 그리고 후보 부재는
  명확한 오류로 종료한다. provider는 반환하거나 변경하지 않는다.

#### Touch

- Create `scripts/src/lib/plugin-root.ts` — 후보 탐색, manifest 검증, semver 정렬,
  선택 정책과 오류 진단을 순수 함수 중심으로 구현한다.
- Create `scripts/src/lib/bouncer-root.ts` — PATH bin의 argv·TTY 입출력을 얇게
  연결한다.
- Create `scripts/bouncer-root` — 컴파일된 launcher를 실행하는 Node shebang
  wrapper를 제공한다.
- Modify `package.json` — `bouncer-root`를 `bin`에 등록한다.
- Create `test/plugin-root.test.js` — override 우선, 호스트 필터, 후보 유효성,
  semver·동률 정렬, TTY 거부, stdin 번호 선택을 고정한다.
- Modify `scripts/lib/plugin-root.js` — TypeScript emit을 추적해 Node-only 소비자가
  TS runtime 없이 launcher를 실행하도록 한다.
- Modify `scripts/lib/bouncer-root.js` — TypeScript emit을 추적해 등록된 bin이
  컴파일 산출물을 실행하도록 한다.
- Modify `test/plugin-wiring.test.js` — 기존 `bouncer` bin 단독 단정이 새
  `bouncer-root` 공개 PATH 명령과 함께 성립하도록 갱신한다.

#### Constraints

- 후보 위치는 Codex·Claude·Antigravity의 문서화된 캐시·플러그인 경로만 대상으로
  하며, 홈 전체 `find`나 실행 프로세스명 추측을 추가하지 않는다.
- 후보의 version은 manifest/package 메타데이터에서 strict semver로 읽고, shell
  문자열 비교로 정렬하지 않는다. stdout은 성공 경로 한 줄만 유지한다.
- `BOUNCER_HOME`은 모든 host에서 쓸 수 있는 수동 override이며 provider 신호가
  아니라는 기존 계약을 유지한다. 새 런타임 의존성을 추가하지 않는다.

### Task 002

#### Goal & intent

워크플로 스킬이 환경변수 삼항식 대신 `bouncer-root` launcher를 호출하고, 설치 문서와
규칙 문서가 대화형 선택·자동 선택·수동 override·provider pin의 경계를 같은 말로
설명하게 한다.

#### Interface

- 제공: 모든 `bouncer-*` 워크플로가 각 Shell block에서 `bouncer-root` 결과를
  `BOUNCER_ROOT`로 할당하는 공통 호출 표면, 그리고 사용자에게 PATH launcher 설치와
  `--select` / `--auto` 사용법을 안내하는 문서.
- 거부: SessionStart·훅 환경 출력이 Agent Shell에 전달된다고 주장하는 문구,
  `BOUNCER_HOME`으로 provider를 추정하는 문구, 경로가 없을 때 cwd나 plugin cache를
  임의로 고르는 fallback.

#### Touch

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

#### Constraints

- 각 fenced Shell block은 독립 셸이므로 `BOUNCER_ROOT`를 읽는 같은 block 안에서
  launcher를 호출한다. 실패 상태를 command substitution으로 숨기지 않는다.
- 문서는 host 후보 경로가 구현의 allowlist임을 설명하되, 실제 사용자 홈의 절대 경로를
  고정값으로 제시하지 않는다. 비대화형 실행은 `--auto` 또는 `BOUNCER_HOME`을 쓴다.
- provider는 `.bouncer/config.json`의 명시 pin이 우선이며, launcher 선택 결과는
  provider·subagent model을 변경하지 않는다.
