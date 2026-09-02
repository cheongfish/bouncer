---
type: bouncer.tasks
title: 플러그인 루트 후보 선택 launcher 추가
description: 검증된 호스트 설치 후보에서 Bouncer 플러그인 루트를 선택한다
resource: .bouncer/context/epics/001-product-surface-hosts/blueprints/006-host-candidate-launcher/tasks/001/tasks.md
tags:
  - bouncer
  - tasks
timestamp: '2026-08-24T15:31:47.607+09:00'
bouncer:
  id: TASKS-001
  epic_id: '001'
  blueprint_id: '006'
  status: verified
  verify: npm test
  commit_intent:
    - 플러그인 루트를 받지 못하는 호스트에서는 스킬이 CLI 위치를 알 수 없는 상태임
    - 설치 경로를 영구 환경변수로 기록하지 않고도 재현 가능하게 선택해야 함
  affected_paths:
    - scripts/src/lib/plugin-root.ts
    - scripts/src/lib/bouncer-root.ts
    - scripts/bouncer-root
    - package.json
    - test/plugin-root.test.js
    - scripts/lib/plugin-root.js
    - scripts/lib/bouncer-root.js
    - test/plugin-wiring.test.js
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

Blueprint: [006](../../index.md)

<!-- scope_evidence.basis 엔트리 필드: graph, status, query, result.
     graph: source | context
     status: updated | reused | fail-skip | skip-disabled | missing
     프론트매터 값은 []로 둔다. 이 주석을 실제 엔트리로 옮기면 빈 계획이 승인된다. -->

## Goal & intent
PATH에 설치된 `bouncer-root`가 `BOUNCER_HOME`을 먼저 검증하거나 Codex·Claude·
Antigravity의 알려진 설치 후보를 찾아 선택하도록 만든다. 자동 모드는 가장 높은
유효 semver를 고르고, `--select`는 대화형 번호 선택을 제공한다.

## Interface
- 제공: `scripts/bouncer-root` bin과 이를 뒷받침하는 `plugin-root` 라이브러리.
  성공 시 stdout에는 단 하나의 절대 경로만, 진단은 stderr에만 쓴다. `--host`,
  `--auto`, `--select`의 정책과 `BOUNCER_HOME` 우선순위는 테스트 가능한 공개 계약이다.
- 거부: 유효성 없는 `BOUNCER_HOME`, manifest 또는 `scripts/bouncer`가 없는 후보,
  미지원 host 값, TTY 없는 `--select`, 비semver 자동 후보, 그리고 후보 부재는
  명확한 오류로 종료한다. provider는 반환하거나 변경하지 않는다.

## Touch
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

## Do not touch
- `scripts/src/lib/subagents.ts` — 후보 선택을 provider 감지로 섞지 않는다.
- `scripts/lib/subagents.js` — 같은 provider 경계를 보존한다.
- `.bouncer/config.json` — launcher는 영구 프로젝트 설정을 쓰지 않는다.

## Constraints
- 후보 위치는 Codex·Claude·Antigravity의 문서화된 캐시·플러그인 경로만 대상으로
  하며, 홈 전체 `find`나 실행 프로세스명 추측을 추가하지 않는다.
- 후보의 version은 manifest/package 메타데이터에서 strict semver로 읽고, shell
  문자열 비교로 정렬하지 않는다. stdout은 성공 경로 한 줄만 유지한다.
- `BOUNCER_HOME`은 모든 host에서 쓸 수 있는 수동 override이며 provider 신호가
  아니라는 기존 계약을 유지한다. 새 런타임 의존성을 추가하지 않는다.

## Checklist
- [ ] `test/plugin-root.test.js`에서 임시 홈·플러그인 fixture를 만들고, 아직 없는
  launcher에 대해 다음 동작을 먼저 단정한다.

  ```text
  BOUNCER_HOME > --host 후보 > 전체 후보
  auto: semver 내림차순, 동률은 절대 경로 오름차순
  --select + 비TTY: 오류
  --select + "2\n": 두 번째 표시 후보
  ```

- [ ] 새 라이브러리와 bin을 구현해 fixture 테스트가 통과하게 하고, `plugin.json`
  또는 package metadata의 이름·strict semver 버전 및 `scripts/bouncer` 존재 여부로
  후보를 검증한다.
- [ ] `package.json` bin 등록과 CJS emit을 갱신해 `node scripts/lib/bouncer-root.js`
  및 패키지 설치 뒤 `bouncer-root`가 같은 계약을 실행하게 한다.
- [ ] `npm test`를 실행해 launcher 테스트와 기존 provider 테스트가 함께 통과함을
  확인한다.
