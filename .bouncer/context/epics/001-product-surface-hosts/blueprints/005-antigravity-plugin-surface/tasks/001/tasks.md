---
type: bouncer.tasks
title: Antigravity 배포 표면과 provider 블록
description: 루트 plugin.json을 만들고 init 기본 config에 antigravity provider 블록을 추가한다
resource: .bouncer/context/epics/001-product-surface-hosts/blueprints/005-antigravity-plugin-surface/tasks/001/tasks.md
tags:
  - bouncer
  - tasks
timestamp: '2026-08-11T18:00:54.377+09:00'
bouncer:
  id: TASKS-001
  epic_id: '001'
  blueprint_id: '005'
  status: verified
  commit_intent:
    - 호스트가 플러그인 루트에서 매니페스트를 찾아 저장소가 그대로는 설치되지 않는 상태임
    - 호스트별 model 이름이 호환되지 않으므로 provider 블록을 분리해 자리를 만듦
  affected_paths:
    - plugin.json
    - scripts/src/lib/init.ts
    - scripts/lib/init.js
    - scripts/src/lib/subagents.ts
    - scripts/lib/subagents.js
    - test/init.test.js
    - test/subagents.test.js
    - test/cursor-plugin.test.js
  graph:
    generated_at: '2026-08-11T18:10:00.000+09:00'
    command: graphify query (source + context)
    suggested_paths:
      - scripts/src/lib
      - scripts/lib
      - test
    basis:
      - graph: source
        status: reused
        query: Antigravity plugin manifest provider subagents init default config resolveSubagentModel host / defaultConfig init config.json subagents provider blocks
        result: 24+17 hits. scripts/src/lib/subagents.ts (resolveProvider/resolveSubagentModel), scripts/src/lib/init.ts, scripts/lib 대응 emit, test/plugin-wiring.test.js
      - graph: context
        status: updated
        query: Antigravity host provider plugin manifest install docs
        result: 2 hits, 모두 문서(.bouncer/context/epics/028-antigravity-host/index.md 등). 구현 경로 없음
---
# Tasks

Blueprint: [005](../../index.md)

## Goal & intent

이 저장소가 Antigravity 플러그인으로 인식된다. 루트 `plugin.json`이 생겨
`agy plugin validate`가 `skills/` 16개, `agents/` 3개, `hooks/` 6개를 모두
processed로 보고하고, `subagents.provider: "antigravity"`가 전용 블록으로
해석된다.

호스트 조사 결과 중 이 태스크의 전제:

- Antigravity 플러그인 루트는 `plugin.json` + 관례 경로 `skills/` · `agents/` ·
  `hooks/`다. `agents/`가 지원되므로 named agent 라우팅을 fallback으로 내리지
  않는다 (Codex와 다르다).
- 호스트는 플러그인 루트를 알려주는 환경 변수를 내보내지 않는다. 따라서
  provider 감지는 명시 pin만 허용하고 `resolveProvider`의 env 표는 그대로 둔다.

## Interface

- 제공:
  - 루트 `plugin.json` — `{ "name": "bouncer", "version": <나머지 매니페스트와 동일>, "description": …, "author": { "name", "email" } }`
  - `defaultConfig().subagents.antigravity` — `bouncer-reviewer` / `bouncer-implementer` / `bouncer-debugger` 모두 `"inherit"`
- 거부:
  - `plugin.json`에 `skills` / `agents` / `hooks` 경로 키를 선언하지 않는다. 관례 탐색이 잡으며, 재선언은 호스트가 플러그인을 거부하는 원인이다.
  - `resolveProvider`에 새 환경 변수 분기를 넣지 않는다. `provider` 인자와 `config.subagents.provider` 외의 신호로 `antigravity`가 반환되면 안 된다.
  - `BOUNCER_HOME`은 provider 신호가 아니다. 기존 동작(신호 없음 → `{ model: null, provider: null }`)을 유지한다.

## Touch

- Create `plugin.json` — Antigravity 플러그인 매니페스트. 이름·버전은 다른 세 매니페스트와 동일하게 맞춘다.
- Modify `scripts/src/lib/init.ts` — `defaultConfig().subagents`에 `antigravity` 블록 추가, provider 블록 분리 이유 주석에 호스트 하나 반영.
- Modify `scripts/lib/init.js` — 위 변경의 CJS emit (`npm run build` / `pretest` 산출물).
- Modify `scripts/src/lib/subagents.ts` — `resolveProvider` 주석에 Antigravity도 명시 pin이 필요한 호스트임을 적는다.
- Modify `scripts/lib/subagents.js` — 위 변경의 CJS emit.
- Modify `test/init.test.js` — `init writes the exact config.json shape`가 박아 둔 `subagents` 리터럴에 `antigravity` 블록 추가.
- Modify `test/subagents.test.js` — `antigravity` pin 해석과 env로는 `antigravity`가 되지 않음을 검사.
- Modify `test/cursor-plugin.test.js` — 매니페스트 동기화 대상을 넷으로 늘리고 루트 `plugin.json` 레이아웃을 검사. 파일 상단 주석의 "three manifests" 서술도 넷으로 고친다.

## Do not touch

- `hooks/hooks.json` — 훅 이벤트와 command 경로는 이 태스크의 대상이 아니다. `${CLAUDE_PLUGIN_ROOT}` 치환 여부는 002의 수동 확인 항목이다.
- `.claude-plugin/plugin.json`, `.cursor-plugin/plugin.json`, `.codex-plugin/plugin.json` — 기존 호스트 매니페스트는 그대로 둔다. 버전을 맞추는 쪽은 새로 만드는 루트 파일이다.
- `.agents/plugins/marketplace.json` — `source.path`가 이미 저장소 루트를 가리키므로 새 매니페스트가 생기면 그대로 맞는다.

## Constraints

- 문서(`docs/**`, `README.md`)는 이 태스크에서 손대지 않는다. 002의 대상이므로 경로 금지가 아니라 분업 규칙으로 지킨다.
- `scripts/src/**/*.ts`를 고치면 대응하는 `scripts/lib/*.js` emit을 같은 커밋에 담는다. 소비자는 Node만 쓰므로 TS 런타임을 요구하면 안 된다.
- 공개 문자열과 주석의 언어 관례를 지킨다 — `scripts/src/**` 주석은 기존과 같이 한국어.
- 게이트 코드(G/S 번호)와 문서 스키마는 건드리지 않는다. provider 값은 자유 문자열이므로 `schema.ts` 등록 대상이 아니다.
- 새 의존성을 추가하지 않는다.

## Checklist

- [ ] `test/cursor-plugin.test.js`의 매니페스트 동기화 테스트를 넷으로 확장하고, 루트 `plugin.json`을 읽는 실패 테스트를 먼저 추가한다.

  ```js
  const antigravity = readJson('plugin.json');
  for (const m of [claude, cursor, codex, antigravity]) {
    assert.strictEqual(m.name, 'bouncer');
    assert.strictEqual(m.version, claude.version);
  }
  ```

- [ ] 같은 파일에 Antigravity 관례 경로 검사를 추가한다. 매니페스트가 경로 키를 재선언하지 않는다는 것까지 함께 잠근다.

  ```js
  const antigravity = readJson('plugin.json');
  for (const key of ['skills', 'agents', 'hooks', 'commands']) {
    assert.ok(!(key in antigravity), `plugin.json must not re-declare ${key}`);
  }
  for (const dir of ['skills', 'agents', 'hooks']) {
    assert.ok(fs.existsSync(path.join(root, dir)));
  }
  ```

- [ ] `npm test`로 위 두 테스트가 실패하는 것을 확인한다.
- [ ] 루트 `plugin.json`을 만든다. `version`은 `.claude-plugin/plugin.json`과 같은 값으로 적는다.

  선행 조사에서 관측된 키는 `name` / `description` / `disabled`뿐이다. `version`과
  `author`는 관측되지 않았으므로, 아래 validate 항목에서 이 두 키를 포함한
  상태로 통과하는지가 확인 대상이다.
- [ ] `test/subagents.test.js`에 pin 해석 테스트를 추가한다.

  ```js
  test('config.subagents.provider antigravity resolves the antigravity block', () => {
    assert.deepStrictEqual(
      resolveSubagentModel({ repoRoot: /* antigravity pin이 있는 임시 repo */, agentName: 'bouncer-reviewer' }),
      { model: /* 그 블록에 적은 값 */, provider: 'antigravity' },
    );
  });
  ```

- [ ] `test/subagents.test.js`에 env가 `antigravity`를 만들지 못한다는 회귀 테스트를 추가한다. `BOUNCER_HOME`만 설정한 상태에서 결과가 `{ model: null, provider: null }`이어야 한다.
- [ ] `test/init.test.js`의 `subagents` 리터럴에 블록을 추가한다.

  ```js
  antigravity: {
    'bouncer-reviewer': 'inherit',
    'bouncer-implementer': 'inherit',
    'bouncer-debugger': 'inherit',
  },
  ```

- [ ] `scripts/src/lib/init.ts`의 `defaultConfig()`에 같은 모양의 `antigravity` 블록을 추가한다.
- [ ] `scripts/src/lib/subagents.ts`의 `resolveProvider` 주석에 Antigravity도 플러그인 루트 env가 없어 명시 pin이 필요하다는 사실을 적는다.
- [ ] `npm run build`로 `scripts/lib/init.js` · `scripts/lib/subagents.js` emit을 갱신한다.
- [ ] `npm test`가 통과한다.
- [ ] `agy plugin validate .`가 `version`·`author`를 포함한 루트 `plugin.json`으로 `skills` / `agents` / `hooks`를 모두 processed로 보고하는지 확인한다.
  - 미지 키 때문에 거부되면 매니페스트에서 `version`·`author`를 빼고, `test/cursor-plugin.test.js`의 버전 동기화 대상을 기존 세 매니페스트로 되돌린 뒤(루트 파일은 `name`과 레이아웃만 검사) blueprint로 에스컬레이션한다. epic Success criteria 2가 걸리는 변경이므로 임의로 진행하지 않는다.
  - `agy`가 없는 환경이면 건너뛰고 002의 수동 확인 체크리스트에 남긴다. 이 경우 두 키의 수용 여부는 릴리스 전까지 미확인 상태다.
