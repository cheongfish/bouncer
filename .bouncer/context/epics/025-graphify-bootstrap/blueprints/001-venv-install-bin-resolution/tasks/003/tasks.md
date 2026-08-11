---
type: bouncer.tasks
title: 스킬과 문서를 해석된 graphify 경로 기준으로 정리
description: graphify-runner 호출부, bouncer-init ACQ 흐름, install·configuration·troubleshooting 문서와 Distill 결정 갱신
resource: .bouncer/context/epics/025-graphify-bootstrap/blueprints/001-venv-install-bin-resolution/tasks/003/tasks.md
tags:
  - bouncer
  - tasks
timestamp: '2026-08-11T13:29:26.057+09:00'
bouncer:
  id: TASKS-003
  epic_id: '025'
  blueprint_id: '001'
  status: verified
  commit_intent:
    - 스킬과 문서가 여전히 PATH 설치와 수동 활성화를 전제하고 있었음
    - 해석된 경로와 init 설치 흐름을 안내가 그대로 가리키게 하려 함
  affected_paths:
    - skills/graphify-runner/SKILL.md
    - skills/bouncer-init/SKILL.md
    - docs/install.md
    - docs/configuration.md
    - docs/troubleshooting.md
    - docs/ARCHITECTURE.md
    - .bouncer/Distill.md
    - CHANGELOG.md
    - test/skill-graphify-runner.test.js
    - test/skill-bouncer-init.test.js
  graph:
    generated_at: '2026-08-11T13:43:15+09:00'
    command: graphify query (source + context)
    suggested_paths:
      - scripts/src/lib
      - scripts/lib
      - test
      - skills/graphify-runner
      - skills/bouncer-init
      - docs
    basis:
      - graph: source
        status: reused
        query: graphify bin resolution venv install init config gitignore session-graph
        result: 52 nodes; source graph는 skills/·docs/를 담지 않아 스킬 경로는 수동 추가
      - graph: context
        status: updated
        query: graphify 설치 실행 경로 init config 기본값
        result: 15 nodes; 003-multi-agent-plugin distill만 히트해 경로 근거로는 쓰지 않음
---
# Tasks

Blueprint: [001](../../index.md)

## Goal & intent

`graphify-runner`가 `graphify query`를 PATH로 부르지 않고 `bouncer graphify-bin`이 돌려준
경로로 부른다. `/bouncer-init`은 설치 결과를 보고하고, 승격과 `.gitignore` 쓰기를 ACQ로
묻는다. 문서는 "직접 설치하고 `enabled`를 켜라" 대신 "init이 설치한다, 안 되면 이렇게
폴백한다"를 설명한다. Distill의 config 보존 결정 문장을 동의 기준으로 좁힌다.

## Interface

- 제공
  - `skills/graphify-runner/SKILL.md` — 질의 단계가 실행 경로를 먼저 해석한다.
    ```bash
    BOUNCER_ROOT="${BOUNCER_HOME:-${CLAUDE_PLUGIN_ROOT:-${PLUGIN_ROOT:-}}}"
    GRAPHIFY_BIN="$(node "${BOUNCER_ROOT}/scripts/bouncer" graphify-bin)" || GRAPHIFY_BIN=""
    ```
    `GRAPHIFY_BIN`이 비면 기존 graceful skip(=`basis` 엔트리 유지, `suggested_paths` 빈
    배열)으로 간다. 비어 있지 않으면 `"$GRAPHIFY_BIN" query …`로 두 그래프를 질의한다.
  - `skills/bouncer-init/SKILL.md` — 세 갈래를 명시한다.
    - 설치 성공/재사용: 결과와 `config.graphify.bin`을 보고한다.
    - 설치 실패: 사유와 함께 `graphify.enabled: false`로 남았음을 알리고, 수동 설치 후
      `bouncer init --promote-graphify`로 되돌아오는 길을 알려 준다.
    - 기존 프로젝트에서 `graphifyPromotion: 'candidate'`가 오면 ACQ로 묻는다 —
      A) 켜고 설치(권장) B) 켜기만 함 C) 그대로 둠. A/B에서만
      `bouncer init --promote-graphify`를 실행하고, C는 아무것도 쓰지 않는다.
      비대화 환경에서는 안내만 남긴다.
    - `gitignoreSuggestions`가 비어 있지 않으면 ACQ로 묻고, 동의할 때만
      `bouncer init --write-gitignore`를 실행한다. 거절하면 항목만 알려 준다.
  - 문서 — `docs/install.md`(설치 흐름과 오프라인 폴백), `docs/configuration.md`
    (`graphify.enabled` 기본값 `true`, `graphify.bin`과 해석 순서),
    `docs/troubleshooting.md`(`graphify not on PATH` 항목을 해석 실패 기준으로 개정),
    `docs/ARCHITECTURE.md`(`.gitignore`를 직접 수정하지 않는다는 서술 정정).
  - `.bouncer/Distill.md` — 두 항목.
    - Decisions의 `init default … existing config.json is never overwritten` 문장을 "동의
      없이는 변경하지 않음. `--promote-graphify`만 `graphify.enabled`(와 `bin`)를 바꾼다"로
      개정한다.
    - graphify 실행 경로 해석 순서(`config.graphify.bin` → `.bouncer/.venv` → PATH)와 단일
      해석기 위치를 Invariants에 남긴다.
- 거부
  - 스킬은 `graphify`를 이름으로 직접 실행하지 않는다.
  - `graphify-bin` 실패를 오류로 취급하지 않는다. 그래프 부재는 상태다.
  - 스킬이 `.bouncer/config.json`을 직접 편집하지 않는다. 승격은 CLI 플래그로만 한다.

## Touch

- Modify `skills/graphify-runner/SKILL.md` — 실행 경로 해석 단계와 질의 명령 교체.
- Modify `skills/bouncer-init/SKILL.md` — 설치 결과 보고, 승격 ACQ, `.gitignore` ACQ.
- Modify `docs/install.md` — init이 설치하는 흐름과 실패 시 수동 경로.
- Modify `docs/configuration.md` — `graphify` 기본값과 `bin` 필드 표 항목.
- Modify `docs/troubleshooting.md` — 경로 해석 실패와 승격 안내.
- Modify `docs/ARCHITECTURE.md` — `.gitignore` 서술 정정.
- Modify `.bouncer/Distill.md` — 결정 개정과 해석 순서 invariant.
- Modify `CHANGELOG.md` — Unreleased 절에 graphify 설치·경로 해석 변경을 한 항목으로 남긴다.
- Modify `test/skill-graphify-runner.test.js` — 해석 경로 사용과 PATH 직접 호출 부재 검사.
- Modify `test/skill-bouncer-init.test.js` — 승격·gitignore ACQ 문구 계약 검사.

## Do not touch

- `scripts/**` — 코드 표면은 TASKS-001·002에서 확정됐다. 문서가 코드를 따라간다.
- `hooks/**` — SessionStart 경고 문구는 그대로다.
- `.bouncer/context/epics/**` — 이 blueprint 자신의 계획 문서는 구현 대상이 아니다.
- `README.md` — 설치 안내의 SSOT는 install 문서이므로 README는 손대지 않는다.

## Constraints

- 문서·스킬 산문은 한국어로 유지한다. `.bouncer/Distill.md`는 영어로 유지한다.
- 문구를 바꾸는 곳마다 대응 스킬 계약 테스트를 함께 고친다. 테스트가 문자열을 고정하고
  있으면 테스트를 진실로 삼지 말고 새 문구에 맞춘다.
- Distill Decisions는 현재 상태만 적는다. 변경 이력을 덧붙이지 않고 문장을 교체한다.
- 게이트 번호(G4)와 `basis` 엔트리 계약은 바꾸지 않는다. 바뀌는 것은 실행 파일을 찾는
  방법뿐이다.
- 새 스킬을 만들지 않는다. `docs/ARCHITECTURE.md` §4 generic-skills 표는 건드리지 않는다.

## Checklist

- [ ] `skills/graphify-runner/SKILL.md` step 1–3을 고친다. `graphify query` 두 줄을
      `"$GRAPHIFY_BIN" query …`로 바꾸고, 해석 실패를 step 2 graceful skip에 연결한다.
      skip 안내 문구의 설치 지침을 `bouncer init`(및 `--promote-graphify`) 기준으로 고친다.
- [ ] `test/skill-graphify-runner.test.js`를 갱신한다. 최소한
      `graphify-bin`이 등장하고, `` `graphify query` `` 형태의 PATH 직접 호출이 남아 있지
      않음을 검사한다.
- [ ] `skills/bouncer-init/SKILL.md`의 3단계를 설치 결과 보고 + 승격 ACQ + gitignore ACQ로
      다시 쓴다. "Bouncer never edits `.gitignore`" 문장을 동의 후 마커 블록 쓰기로 고친다.
- [ ] `test/skill-bouncer-init.test.js`에 승격 ACQ 세 선택지와 `--write-gitignore` 언급을
      검사하는 항목을 추가한다.
- [ ] `docs/install.md`의 graphify 절을 고친다. `pip install graphifyy` 수동 절차는 오프라인
      폴백으로 남기고, 기본 경로는 `bouncer init`이다.
- [ ] `docs/configuration.md` 표의 `graphify` 행을 기본값 `true`로 고치고 `bin` 필드와 해석
      순서를 적는다.
- [ ] `docs/troubleshooting.md`의 `graphify not on PATH` 행을 해석 실패 기준으로 고치고
      승격 명령을 넣는다.
- [ ] `docs/ARCHITECTURE.md`에서 `.gitignore`를 직접 수정하지 않는다는 서술을 정정한다.
- [ ] `.bouncer/Distill.md`의 `init default …` 결정 문장을 교체하고 해석 순서 invariant를
      추가한다.
- [ ] `CHANGELOG.md`의 Unreleased 절에 graphify 설치·경로 해석 변경을 한 항목으로 적는다.
      버전 번호는 올리지 않는다.
- [ ] `npm test`가 통과한다.
