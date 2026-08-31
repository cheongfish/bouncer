---
type: bouncer.tasks
title: 플러그인 루트 설치 안내를 실제 설치 경로에 맞게 정정
description: 호스트 플러그인 설치가 npm bin을 링크하지 않는다는 사실에 맞춰 docs/install.md의 bouncer-root PATH 안내를 명시적 등록 단계로 바꾼다
resource: .bouncer/context/epics/059-audit-followup/blueprints/002-instruction-layers/tasks/004/tasks.md
tags:
  - bouncer
  - tasks
timestamp: '2026-08-31T08:39:19.024+09:00'
bouncer:
  id: TASKS-004
  epic_id: '059'
  blueprint_id: '002'
  status: ready
  verify: npm run ci
  commit_intent:
    - 호스트 플러그인 설치는 캐시 디렉터리 복사일 뿐 npm install을 돌리지 않아 선언된 bin이 PATH에 링크되지 않음
    - 설치 문서가 등록을 자동이라고 말해 모든 워크플로 셸의 첫 줄이 실패하므로 실제로 동작하는 등록 단계로 바꿈
  affected_paths:
    - docs/install.md
    - rules/plugin-root.md
    - test/public-name-regression.test.js
  scope_evidence:
    producer: graphify
    generated_at: '2026-08-31T08:39:19.024+09:00'
    suggested_paths:
      - test
    basis:
      - graph: source
        status: reused
        query: plugin root bouncer-root PATH install docs
        result: test/ 아래 설치 문서 단언 군집 (public-name-regression.test.js)
      - graph: context
        status: updated
        query: plugin root bouncer-root PATH install docs
        result: .bouncer/context/epics/059-audit-followup/blueprints/002-instruction-layers/tasks/<NNN>/tasks.md 신규 문서만 히트 — 계획 문서 자체이므로 경로 후보로 쓰지 않음
---

# Tasks

Blueprint: [002](../../index.md)

## Goal & intent
`docs/install.md`의 「플러그인 루트」 절이 "패키지가 설치하면 `bouncer-root` bin이 PATH에 등록됩니다"라고 말한다. 호스트 플러그인 설치 경로에서 이 문장은 사실이 아니다. 원인은 하나다 — 호스트 설치는 저장소를 `~/.claude/plugins/cache/<marketplace>/bouncer/<version>/`로 복사하는 것이고 `npm install`을 돌리지 않는다. `package.json`이 `bin.bouncer`와 `bin.bouncer-root`를 선언하지만 그 선언을 읽어 링크할 명령이 실행되지 않으므로, 실행 파일은 그 안 `scripts/`에 남고 PATH에는 아무것도 링크되지 않는다.

`"private": true`는 이 실패의 원인이 **아니다** — `npm publish`를 막을 뿐이고, 로컬 경로에 대한 `npm link` / `npm install -g <path>`는 private 패키지에서도 bin을 링크한다. 문서가 이 둘을 섞어 적으면 사용자에게 거짓을 전달한다.

결과가 가볍지 않다. `rules/plugin-root.md`가 정한 모든 워크플로 셸의 첫 줄이 `BOUNCER_ROOT="$(bouncer-root --auto)" || exit $?`이므로, PATH 등록이 없으면 `/bouncer-plan`을 포함한 여섯 워크플로가 첫 명령에서 `command not found`로 끝난다. 이 계획 회차에서도 재현됐다. 감사가 "호스트 설치기 문제인지 저장소 레이아웃 문제인지 아직 가리지 않았다"고 남긴 항목이고, 위 두 사실이 그것을 가린다 — **설치 문서의 오기**다.

이 task는 문서만 고친다. 저장소 레이아웃(`scripts/`에 실행 파일을 두는 것)도 `bin` 선언도 바꾸지 않는다 — npm 설치 경로에서는 그 선언이 옳게 동작하고, 문제는 그 경로가 유일한 경로인 것처럼 적힌 데 있다.

**문서 수정만으로 실패가 사라지지 않는다는 것을 명시해 둔다.** `rules/plugin-root.md`가 정한 열두 소비자 셸의 첫 줄은 그대로이고, 새 호스트 설치에서 사용자가 PATH를 직접 등록하기 전까지 여섯 워크플로는 여전히 첫 명령에서 죽는다. 이 task가 닫는 것은 "문서가 사실과 다르다"이고, "등록 없이도 도는가"는 닫지 않는다. 자동 해결(런처 폴백, 호스트 설치기 배선, 레이아웃 이동)은 blueprint Out of scope이며 별도 회차 몫이다 — 이 task는 그 결정을 앞당기지 않는다.

## Interface
- 제공:
  - `docs/install.md` 「플러그인 루트 (`bouncer-root`)」 절이 등록을 자동이라고 말하지 않는다. 대신 설치 경로별로 실제 동작하는 등록 단계를 준다 — 호스트 플러그인 설치에서는 플러그인 루트의 `scripts/` 디렉터리를 PATH에 더하고, npm 설치 경로에서는 선언된 bin이 그대로 쓰인다.
  - PATH를 쓸 수 없을 때의 대안으로 현행 `BOUNCER_HOME` 계약을 같은 자리에서 가리킨다(새 계약을 만들지 않는다).
  - PATH를 쓸 수 없을 때의 두 대안을 같은 자리에서 가리킨다 — 현행 `BOUNCER_HOME` 일회성 오버라이드, 그리고 로컬 경로에 대한 `npm link` / `npm install -g <plugin-root>`(전역 환경을 바꾸므로 기본값이 아니라 대안으로 적는다).
  - 등록이 되었는지 확인하는 한 줄(`bouncer-root --auto`가 절대 경로를 출력하는지)과, 실패했을 때 나오는 증상(`command not found`)을 함께 적는다.
  - 수용 기준: 고친 뒤 `docs/install.md`에 (1) 호스트 설치가 bin을 링크하지 않는다는 진술, (2) 실행 가능한 등록 단계, (3) 확인 명령과 실패 증상, (4) 남아 있는 제약(등록 전에는 워크플로가 첫 줄에서 실패한다)이 모두 있고, `test/public-name-regression.test.js`가 그 넷을 단언한다.
- 거부:
  - `"private": true` 때문에 bin 링크가 안 된다는 서술. 사실이 아니며 사용자를 잘못 이끈다.
  - `npm install -g bouncer`(레지스트리 이름) 안내. 이 패키지는 게시되지 않는다 — 로컬 경로 형태만 대안으로 적는다.
  - `BOUNCER_HOME`을 상시 설정값으로 승격하는 것. 현행 계약상 일회성 수동 오버라이드이고 host/provider 신호가 아니다.
  - 워크플로 셸의 첫 줄 형식 변경이나 `bouncer-root` 없이 도는 폴백 추가. `rules/plugin-root.md`가 단일 계약이고 12개 소비자 파일이 그 문자열을 그대로 담는다.
  - `scripts/`를 `bin/`으로 옮기는 저장소 레이아웃 변경.

## Touch
- Modify `docs/install.md` — 「플러그인 루트」 절의 자동 등록 문장을 설치 경로별 명시적 등록 단계로 교체하고, 확인 방법과 실패 증상을 적는다.
- Modify `rules/plugin-root.md` — "Install the `bouncer-root` package bin on `PATH`" 문장이 *어떻게* 하는지를 `docs/install.md`로 가리키게 한다.
- Modify `test/public-name-regression.test.js` — `docs/install.md`가 자동 등록 문구를 갖지 않고 명시적 등록 단계를 갖는지 단언한다(이 파일이 이미 `install`을 읽어 `bouncer-root --auto`·`--select`를 단언한다).

## Do not touch
- `package.json` — `bin` 선언과 `private: true`는 이 task의 입력이다.
- `scripts/bouncer`, `scripts/bouncer-root`, `scripts/lib/bouncer-root.js` — 실행 파일 위치와 후보 탐색 로직은 바꾸지 않는다.
- `skills/` — 워크플로 셸의 첫 줄은 플러그인 루트 계약 문서가 정한 단일 형식이고 그대로다.
- `.claude-plugin/`, `.codex-plugin/`, `.cursor-plugin/`, `.agents/`, 루트 `plugin.json` — 호스트 매니페스트는 이 task 밖이다.
- `CLAUDE.md` — 마스터 룰의 `## Plugin root` 절은 task 001의 예산 작업과 겹치므로 여기서 손대지 않는다.

## Constraints
- `docs/install.md`는 한국어 사용자 문서다. 추가 문장도 한국어를 유지하고 경로·명령·플래그는 그대로 둔다.
- 새 명령이나 새 환경변수를 도입하지 않는다. 안내는 이미 존재하는 표면(`PATH`, `BOUNCER_HOME`, `bouncer-root --auto`)만 쓴다.
- 기존 단언이 그대로 통과해야 한다 — `docs/install.md`에 `bouncer-root --auto`와 `bouncer-root --select`가 남는다.
- 문서가 특정 호스트의 캐시 절대 경로를 고정 값으로 적지 않는다. 플러그인 루트는 호스트·버전마다 다르므로 자리표시자로 적는다.

## Checklist
- [ ] 사실을 확인한다: 호스트 캐시 설치 디렉터리에 `node_modules/.bin`이나 `bouncer-root` 링크가 없다는 것, 그리고 `package.json`의 `bin` 선언이 npm 설치 경로에서는 유효하다는 것.
- [ ] 실패 테스트를 먼저 쓴다 — `test/public-name-regression.test.js`에 `docs/install.md`가 자동 등록 문구를 갖지 않고 명시적 등록 단계를 갖는지 단언하는 테스트를 추가하고, `node --test test/public-name-regression.test.js`로 실패를 확인한다.
- [ ] `docs/install.md` 「플러그인 루트」 절을 고친다. 최소한 이 넷을 담는다: 호스트 플러그인 설치는 npm bin을 링크하지 않는다는 사실, 플러그인 루트의 `scripts/`를 PATH에 더하는 단계, `BOUNCER_HOME` 대안, 확인 방법과 실패 증상.
- [ ] `rules/plugin-root.md`의 설치 문장이 `docs/install.md`를 가리키게 한다. 계약 문장 자체(`BOUNCER_ROOT="$(bouncer-root --auto)" || exit $?`)는 바꾸지 않는다.
- [ ] `npm run ci`를 실행해 그린을 확인한다.
