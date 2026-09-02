---
type: bouncer.tasks
title: subagents config 기본값과 모델 해석 헬퍼 추가
description: init 기본값, resolveSubagentModel, 설정 문서
resource: .bouncer/context/epics/009-agent-orchestration/blueprints/001-subagent-model-config-contract/tasks/001/tasks.md
tags:
  - bouncer
  - tasks
timestamp: '2026-08-03T07:48:50.273Z'
bouncer:
  id: TASKS-001
  epic_id: '009'
  blueprint_id: '001'
  status: verified
  affected_paths:
    - scripts/src/lib/subagents.ts
    - scripts/lib/subagents.js
    - scripts/src/lib/init.ts
    - scripts/lib/init.js
    - test/subagents.test.js
    - test/init.test.js
    - docs/configuration.md
  graph:
    generated_at: '2026-08-03T07:53:47.000Z'
    command: graphify query
    suggested_paths:
      - scripts/lib
      - test
    basis: query "subagent model config resolve provider init default config.json helper" — BFS from CONFIG / init() returned init.js, advisor.js (readConfig 선례), cli.js, init.test.js. 그래프는 emit된 JS만 색인하므로 scripts/src 와 docs 는 제안에 나오지 않아 수동으로 보탰다. 색인이 오래되어 이미 삭제된 import-superpowers.js·profile.js 가 함께 나왔고 그 노드는 버렸다.
---
# Tasks

Blueprint: [001](../../index.md)

## Goal & intent
`bouncer init`이 만드는 `.bouncer/config.json`에 `subagents` 블록이 포함되고,
새 모듈 `scripts/lib/subagents.js`의 `resolveSubagentModel`이 프로바이더와
에이전트 이름으로 모델 slug를 조회한다. 값이 없거나 판별에 실패하면 예외 대신
`{ model: null }`(부모 상속)을 돌려준다. 아직 호출자는 없다 — 002의 스킬
라우팅이 이 계약의 첫 소비자다. 검증은 `npm test`.

## Interface
- 제공: `scripts/lib/subagents.js` (소스 `scripts/src/lib/subagents.ts`)가
  `resolveSubagentModel({ repoRoot, agentName, provider })`를 내보낸다.
  반환값은 항상 `{ model: string | null, provider: string | null }`.
  - provider 결정 순서: 인자 `provider` → config `subagents.provider` →
    `CLAUDE_PLUGIN_ROOT`가 있으면 `'claude'` → `PLUGIN_ROOT`가 있으면 `'codex'`
    → `null`.
  - `subagents[provider][agentName]`이 비어 있지 않은 문자열이고 `'inherit'`이
    아니면 그 값을 `model`로 돌려준다.
- 제공: `bouncer init`의 기본 config에 `subagents` 블록이 추가된다. 값은
  세 프로바이더 × 두 에이전트 모두 `"inherit"`이며, 사용자가 편집할 자리를
  보여주는 것이 목적이다.
- 거부: 아래 입력에서 던지지 않고 `{ model: null }`을 돌려준다 —
  `.bouncer/config.json` 부재, JSON 파싱 실패, `subagents` 부재,
  provider 블록 부재, `agentName` 키 부재, 값이 `'inherit'`,
  값이 문자열이 아님(숫자·객체·`null`), provider 판별 실패.
- 거부: `BOUNCER_HOME`은 프로바이더 신호로 쓰지 않는다. 수동 오버라이드
  변수라 어떤 호스트에서도 설정될 수 있어 Cursor를 뜻하지 않는다. Cursor
  사용자는 `subagents.provider: "cursor"`를 명시한다.

## Touch
- Create `scripts/src/lib/subagents.ts` — `resolveSubagentModel`과 프로바이더
  판별 로직의 TypeScript 소스.
- Create `scripts/lib/subagents.js` — 위 소스의 CJS emit. 소비 저장소가 Node만으로
  돌 수 있도록 커밋한다.
- Modify `scripts/src/lib/init.ts` — `CONFIG` 상수에 `subagents` 기본 블록 추가.
- Modify `scripts/lib/init.js` — 위 변경의 CJS emit.
- Create `test/subagents.test.js` — Interface의 결정 순서와 거부 목록을 케이스로
  고정한다.
- Modify `test/init.test.js` — `init writes the exact config.json shape`의
  `deepStrictEqual` 기대값에 `subagents` 블록 추가.
- Modify `docs/configuration.md` — 설정 표에 `subagents` 행 추가와 provider별
  블록·`inherit` 센티널 설명.

## Do not touch
- `skills/` — named agent 라우팅은 002. 이 커밋에는 호출자가 없다.
- `.cursor-plugin/plugin.json` · `.claude-plugin/plugin.json` ·
  `.codex-plugin/plugin.json` — `agents` 경로 선언은 002.
- `.bouncer/config.json` — 이 저장소 자신의 설정. init 기본값 변경은 새로
  부트스트랩하는 저장소에만 적용되며, 여기 손대면 001의 diff가 자기 설정
  변경과 섞인다.
- `scripts/src/lib/schema.ts` · `scripts/lib/schema.js` — 문서 frontmatter
  스키마이지 프로젝트 설정 스키마가 아니다. `subagents`는 여기 등록하지 않는다.
- `scripts/src/lib/cli.ts` · `scripts/lib/cli.js` — 새 서브커맨드를 만들지
  않는다. 스킬은 `node -e`로 lib을 직접 부른다.

## Constraints
- `resolveSubagentModel`은 어떤 입력에도 던지지 않는다. `advisor.js`의
  `readConfig`처럼 파싱 실패를 삼키고 기본값으로 떨어진다.
- 파일 읽기는 `node:fs`/`node:path`만 쓴다. 새 의존성을 추가하지 않는다.
- `scripts/lib/*.js`는 손으로 고치지 않는다. `scripts/src`를 고치고
  `npm run build`(또는 `pretest`)로 emit을 재생성한 뒤 그 결과를 커밋한다.
- `outDir`/`rootDir` 설정을 건드리지 않는다 — `tsc`가 `require('../vendor/…')`를
  다시 쓰지 않으므로 emit 위치가 바뀌면 상대 경로가 깨진다.
- `subagents`는 어떤 게이트의 입력도 아니다. `validate`나 G/S 코드에 연결하지
  않는다.
- 공개 문자열과 문서는 한국어를 유지한다.
- 비자명한 판별 순서와 "던지지 않는다" 계약에는 why 주석을 남긴다.

## Checklist
- [x] `test/subagents.test.js`를 먼저 작성한다. 최소 다음을 단정한다:
  ```js
  // provider 인자가 config.subagents.provider보다 우선
  resolveSubagentModel({ repoRoot, agentName: 'bouncer-reviewer', provider: 'cursor' })
  // → { model: 'composer-2.5-fast', provider: 'cursor' }

  // CLAUDE_PLUGIN_ROOT → claude, PLUGIN_ROOT만 있으면 codex
  // 둘 다 없고 config.subagents.provider도 없으면
  // → { model: null, provider: null }

  // 값이 'inherit' 이거나 문자열이 아니면
  // → { model: null, provider: <판별된 provider> }

  // config.json 부재 / '{broken' 파싱 실패 / subagents 부재
  // → 던지지 않고 { model: null }
  ```
- [x] `node --test test/subagents.test.js`가 모듈 부재로 실패하는 것을 확인한다.
- [x] `scripts/src/lib/subagents.ts`를 구현한다. config 읽기는 `advisor.ts`의
      `readConfig`와 같은 try/catch 형태로 둔다.
- [x] `npm run build`로 `scripts/lib/subagents.js` emit을 만들고 커밋 대상에
      포함한다.
- [x] `scripts/src/lib/init.ts`의 `CONFIG`에 아래 블록을 추가한다:
  ```js
  subagents: {
    claude: { 'bouncer-reviewer': 'inherit', 'bouncer-implementer': 'inherit' },
    cursor: { 'bouncer-reviewer': 'inherit', 'bouncer-implementer': 'inherit' },
    codex: { 'bouncer-reviewer': 'inherit', 'bouncer-implementer': 'inherit' },
  },
  ```
- [x] `test/init.test.js`의 `init writes the exact config.json shape`
      `deepStrictEqual` 기대값에 같은 블록을 반영한다.
- [x] `docs/configuration.md` 표에 `subagents` 행을 추가하고, 프로바이더마다
      모델 ID 네임스페이스가 달라 provider별 블록이 필요하다는 점과 `inherit`이
      부모 상속을 뜻한다는 점, Cursor는 `subagents.provider: "cursor"`를 명시해야
      한다는 점을 적는다.
- [x] `npm test`가 통과한다.
