---
type: bouncer.tasks
title: plugin_advisors 기본값과 advise 서브커맨드·advisor 모듈을 제거함
description: Tasks for 001
resource: .bouncer/context/epics/016-advisor-removal/blueprints/001-ponytail-advisor-removal/tasks.md
tags:
  - bouncer
  - tasks
timestamp: '2026-08-06T10:35:22.949+09:00'
bouncer:
  id: TASKS-001
  epic_id: '016'
  blueprint_id: '001'
  status: verified
  affected_paths:
    - .bouncer/config.json
    - config.example.json
    - scripts/src/lib/advisor.ts
    - scripts/src/lib/cli.ts
    - scripts/src/lib/init.ts
    - scripts/lib/advisor.js
    - scripts/lib/cli.js
    - scripts/lib/init.js
    - test/advisor.test.js
    - test/cli-advise.test.js
    - test/cli-help.test.js
    - test/init.test.js
    - docs/cli.md
    - docs/configuration.md
    - docs/workflow.md
    - docs/ARCHITECTURE.md
  graph:
    generated_at: '2026-08-06T10:49:37.000+09:00'
    command: bouncer graph-sync && graphify query (source + context)
    suggested_paths:
      - scripts/src/lib
      - scripts/lib
      - test
      - docs
    basis:
      - graph: source
        status: reused
        query: >-
          remove plugin_advisors ponytail config and bouncer advise CLI
          subcommand advisor module / cmdAdvise recommendMode detectPhase
        result: >-
          graph-sync skip-fresh. CONFIG 노드가 scripts/src/lib/init.ts,
          scripts/lib/init.js를 가리키고 두 번째 질의가 scripts/src/lib/advisor.ts와
          cli.ts/cli.js의 advisor import를 반환했다 → scripts/src/lib, scripts/lib.
          source_dirs가 scripts/hooks/test라 docs/·config.example.json은 잡히지
          않아 test·docs를 손으로 더했다.
      - graph: context
        status: updated
        query: >-
          remove plugin_advisors ponytail config and bouncer advise CLI
          subcommand advisor module
        result: >-
          graph-sync built. 방금 작성한 016 blueprint 문서 노드만 반환해 코드
          경로 제안에는 기여하지 않았다.
---
# Tasks

Blueprint: [001](index.md)

## Goal & intent
`plugin_advisors.ponytail` 설정과 그 유일한 소비 경로인 `bouncer advise`를 저장소에서 걷어낸다.
제거 대상은 한 갈래로 묶여 있다. 기본 config 블록(`init` · `config.example.json` · 이 저장소의 `.bouncer/config.json`),
`advisor` 모듈(`readConfig` · `detectPhase` · `recommendMode`), `cli`의 `cmdAdvise` · dispatch · `USAGE` 행,
이 갈래만 겨냥한 테스트 두 개, 이를 명령으로 안내하는 문서 문장들.

`scripts/`는 TypeScript 소스이고 `scripts/lib`의 CommonJS 산출을 함께 커밋한다.
`npm test`의 `pretest`가 `tsc`를 돌리므로 `scripts/src`를 고친 뒤 `npm run build`(또는 `npm test`)로
산출을 갱신하되, `tsc`는 지워진 소스의 산출을 자동으로 지우지 않으므로 `scripts/lib/advisor.js`는 손으로 삭제한다.

검증 명령은 `npm test`.

## Interface
- 제공: `bouncer` CLI 명령 집합에서 `advise`가 빠진다. `bouncer --help` / `bouncer` / `bouncer -h` 출력의
  명령 목록에 `advise` 행이 없다. `bouncer init`이 쓰는 기본 `config.json`은 `plugin_advisors` 키 없이
  `source_dirs` · `context_dirs` · `graphify` · `verify` · `base_branch` · `pr` · `subagents`만 가진다
  (나머지 키의 값과 순서는 그대로).
- 거부: `bouncer advise`는 이제 미지원 명령이다. `runCli`의 `default` 분기를 타서 stderr에
  `unknown command: advise`와 usage를 쓰고 종료 코드 `2`로 끝난다. 하위 호환 별칭이나 폐기 안내 문구를
  남기지 않는다. 프로젝트 config에 이미 있는 `plugin_advisors`는 읽는 코드가 없으므로 무시되며,
  경고나 검증 실패를 만들지 않는다.

## Touch
- Modify `.bouncer/config.json` — 이 저장소 자체 설정에서 `plugin_advisors` 블록 삭제
- Modify `config.example.json` — 예시 config에서 `plugin_advisors` 블록 삭제
- Modify `scripts/src/lib/init.ts` — `defaultConfig`의 `plugin_advisors` 항목 삭제
- Delete `scripts/src/lib/advisor.ts` — 세 export 모두 `advise` 전용이라 명령과 함께 사라짐
- Modify `scripts/src/lib/cli.ts` — `./advisor` import, `cmdAdvise`, `case 'advise'`, `USAGE`의 `advise` 행 삭제
- Modify `scripts/lib/init.js` — TypeScript 산출 갱신
- Modify `scripts/lib/cli.js` — TypeScript 산출 갱신
- Delete `scripts/lib/advisor.js` — 소스가 사라진 산출물이라 손으로 삭제
- Delete `test/advisor.test.js` — `detectPhase` · `recommendMode` 전용 테스트
- Delete `test/cli-advise.test.js` — `bouncer advise` 전용 테스트
- Modify `test/cli-help.test.js` — 기대 명령 목록에서 `'advise'` 제거
- Modify `test/init.test.js` — 기본 config shape 기대값과 `docs/workflow.md` 단언 갱신
- Modify `docs/cli.md` — 명령 표에서 `bouncer advise` 행 삭제
- Modify `docs/configuration.md` — 설정 표에서 `plugin_advisors.ponytail` 행 삭제
- Modify `docs/workflow.md` — `bouncer advise`를 안내하는 5번 항목 삭제
- Modify `docs/ARCHITECTURE.md` — Ponytail 절에서 `bouncer advise` 병행 문장만 삭제

## Do not touch
- `scripts/src/lib/subagents.ts`
- `scripts/lib/subagents.js`
- `skills/minimality/SKILL.md`
- `test/skill-minimality.test.js`
- `test/public-name-regression.test.js`
- `package.json`

## Constraints
- `docs/ARCHITECTURE.md`의 `## Graphify와 Ponytail의 위치` 절과 `### Ponytail: 원칙만 최소화 스킬로 흡수`
  제목·본문은 유지한다. `Ponytail은 bouncer advise 경로로 병행할 수 있다`는 문장 하나만 걷어낸다.
  `test/public-name-regression.test.js`가 이 문서에서 `Ponytail`을 찾으므로 절 전체를 지우면 깨진다.
- `bouncer init`이 만드는 기본 config에서 `plugin_advisors` 외의 키는 값·순서 모두 그대로 둔다.
  `test/init.test.js`의 `deepStrictEqual` 기대값도 해당 블록만 지운다.
- 하위 호환 경로를 남기지 않는다 — `advise` 별칭, 폐기 경고, `plugin_advisors` 마이그레이션 코드 모두 만들지 않는다.
- `bouncer init`은 이미 존재하는 `config.json`을 덮어쓰지 않는다. 이 성질을 바꾸지 않는다.
- `.bouncer/config.json`에는 아직 커밋되지 않은 `bouncer-debugger: "inherit"` 추가분이 base 체크아웃에 있다.
  execute worktree는 HEAD에서 시작하므로 그 줄이 보이지 않는 것이 정상이다 — 되살리려 하지 말고
  `plugin_advisors` 블록만 지운다.

## Checklist
- [ ] `test/init.test.js`의 기본 config 기대값에서 `plugin_advisors` 블록을 지우고, 같은 파일의 workflow 문서 단언 두 줄을 삭제한다.

  ```js
  assert.ok(/bouncer advise/.test(workflow));
  assert.ok(/Ponytail/.test(workflow));
  ```

- [ ] `test/cli-help.test.js`의 기대 명령 목록에서 `'advise'`를 제거한다.
- [ ] `test/advisor.test.js`와 `test/cli-advise.test.js`를 삭제한다.
- [ ] `npm test`를 돌려 `init` 기본 config 기대값과 `--help` 목록이 **실패**하는 것을 확인한다 (아직 구현 전).
- [ ] `scripts/src/lib/init.ts`의 `defaultConfig`에서 `plugin_advisors` 항목을 삭제한다.
- [ ] `scripts/src/lib/cli.ts`에서 `./advisor` import, `cmdAdvise` 함수, `case 'advise':` 분기, `USAGE`의 다음 행을 삭제한다.

  ```text
    advise     Print the recommended Ponytail mode for the current phase.
  ```

- [ ] `scripts/src/lib/advisor.ts`를 삭제한다.
- [ ] `npm run build` 후 `scripts/lib/advisor.js`를 삭제하고, `scripts/lib/cli.js` · `scripts/lib/init.js`가 갱신되었는지 확인한다.
- [ ] `config.example.json`과 `.bouncer/config.json`에서 `plugin_advisors` 블록을 삭제한다 (JSON이 유효한지 확인).
- [ ] `docs/cli.md`의 `bouncer advise` 표 행, `docs/configuration.md`의 `plugin_advisors.ponytail` 표 행, `docs/workflow.md`의 `bouncer advise` 항목을 삭제한다.
- [ ] `docs/ARCHITECTURE.md`에서 아래 문장만 지우고 절 제목과 나머지 본문은 남긴다.

  ```text
  Ponytail은 `bouncer advise` 경로로 병행할 수 있다.
  ```

- [ ] 잔여 참조가 없는지 확인한다 — `.bouncer/context/` 아래 과거 문서 기록은 제외한다.

  ```bash
  grep -rniI "plugin_advisors\|bouncer advise\|advisor" \
    --exclude-dir=node_modules --exclude-dir=.git --exclude-dir=graphify-out \
    --exclude-dir=.worktrees --exclude-dir=.bouncer \
    scripts test docs config.example.json skills hooks
  ```

- [ ] `bouncer advise`가 미지원 명령으로 처리되는지 확인한다.

  ```bash
  node scripts/bouncer advise; echo "exit=$?"   # stderr에 unknown command, exit=2
  ```

- [ ] `npm test`가 통과한다.
