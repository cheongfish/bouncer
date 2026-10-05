---
type: bouncer.explain
title: 003 explain
description: Explain for 003
resource: .bouncer/context/epics/085-finalize-runtime-slimming/blueprints/003-gate-failure-hints/explain.md
tags:
  - bouncer
  - explain
timestamp: '2026-10-02T19:28:11.034+09:00'
bouncer:
  id: EXPLAIN-003
  epic_id: '085'
  blueprint_id: '003'
  status: published
  comprehension:
    - range_from: f274ba55a3ae3185d1e0793f321856819c972f21
      range_to: 650e5c59f16c8048e142af472c458a69502b10fc
      diff_sha: 3e5953d145efdfd9ad47eb43cba39569898cf068af8f37b8cbe2b4e8d5e2eac4
      quiz_score: 1/4
      disposition: 4문항 중 1정답. 낮은 점수는 기록만 하고 마감을 막지 않음.
      recorded_at: '2026-10-06T08:06:00+09:00'
  task_commits:
    - task: EPIC-085/BP-003/TASK-001
      sha: 645c419b
      intent_anchor: task-001
    - task: EPIC-085/BP-003/TASK-002
      sha: e9b20e88
      intent_anchor: task-002
    - task: EPIC-085/BP-003/TASK-004
      sha: 5d498f14
      intent_anchor: task-004
    - task: EPIC-085/BP-003/TASK-005
      sha: 650e5c59
      intent_anchor: task-005
  coordinator:
    integration_branch: feat/085-003-gate-failure-hints
    tasks:
      - id: '001'
        branch: bouncer/085-003-001
        scope_revision: null
        actual_paths:
          - CHANGELOG.md
          - rules/cli.md
          - scripts/src/lib/validate.ts
          - test/validate-hints.test.js
      - id: '002'
        branch: bouncer/085-003-002
        scope_revision: null
        actual_paths:
          - AGENTS.md
          - CHANGELOG.md
          - README.md
          - docs/README.md
          - docs/configuration.md
          - docs/workflow.md
          - references/spec-authoring/index.md
          - rules/document-schema.md
          - rules/gates.md
          - test/master-rules.test.js
      - id: '003'
        branch: null
        scope_revision: null
        actual_paths: []
      - id: '004'
        branch: bouncer/085-003-004
        scope_revision: r1
        actual_paths:
          - scripts/src/lib/validate.ts
      - id: '005'
        branch: bouncer/085-003-005
        scope_revision: r2
        actual_paths:
          - scripts/src/lib/templates.ts
          - test/legacy-comments.test.js
---
# Explain

## Background
`bouncer validate` 실패가 복구 방법을 `next` hint로 직접 말하게 하고, 그 내용만 남아 있던 `rules/gates.md`와 AGENTS.md runtime rule 목록을 지운다. 계획 DAG는 001 → 002 → 003이었다. 종단 `npm run ci`가 두 번 실패해 repair wave가 붙었다. r1(004)은 003이 004에, 004가 002에 의존하게 바꿨다. r2(005)는 003이 005에, 005가 004에 의존하게 바꿨다. integration HEAD는 `650e5c59f16c8048e142af472c458a69502b10fc`, revision r2.

## Intuition
실패 코드의 다음 행동은 CLI `next`에 있고, `gates.md`는 그 복사본이 아니다.

## Code
- TASKS-001 `bouncer/085-003-001` `3ae83cb84e1ff7b4860be014faef7ccef5fe87b6`. `paths` 비어 있음. `actualPaths`: `CHANGELOG.md`, `rules/cli.md`, `scripts/src/lib/validate.ts`, `test/validate-hints.test.js`. 1회차 수용 뒤 commit stamp로 2회차 확인. 범위 개정 없음.
- TASKS-002 `bouncer/085-003-002` `2687dffa016a2cf18e26b8ed56fc53e7a113af62`. `paths` 비어 있음. `actualPaths`: `AGENTS.md`, `CHANGELOG.md`, `README.md`, `docs/README.md`, `docs/configuration.md`, `docs/workflow.md`, `references/spec-authoring/index.md`, `rules/document-schema.md`, `rules/gates.md`, `test/master-rules.test.js`.
- TASKS-003 worker 없음. `npm run ci` exit 0, evidence `27c1bda79c194eaa42552601f42e70ad3fdfd5d31528061f2fe01fc98cede2e4`.
- TASKS-004 repair r1 `bouncer/085-003-004` `fa4d1fbce48588bc571dd45ab37eaec624a3ac1d`. 초기 `paths` 비어 있음 → `actualPaths`/`nextScope`: `scripts/src/lib/validate.ts`. 원인: G18 `next` 문자열이 eslint max-len 120을 넘김. hint 문구는 그대로 줄만 나눔.
- TASKS-005 repair r2 `bouncer/085-003-005` `74fbcfe637fdb29de138401683a664ad149764c2`. 초기 `paths` 비어 있음 → `scripts/src/lib/templates.ts`, `test/legacy-comments.test.js`. 원인: TASKS-001 brief의 인라인 백틱 안 HTML 주석 예시가 `lint:context-comments`에 걸림.
- 읽기: `scripts/src/lib/validate.ts`(`GATE_FAILURE_HINTS`, `withGateFailureHints`), `scripts/src/lib/templates.ts`(`extractCommentBodies`), `rules/cli.md`. `rules/gates.md`는 삭제됨.

## Quiz
출제 4문항. full scale, 커밋·repair·검증 경로가 갈라져 4문항.

1. TASKS-001이 한 일의 핵심은?
   - A) `rules/gates.md`를 늘려 G 코드를 문서화한다
   - B) `validate` 실패 항목에 `next` hint를 붙인다
   - C) `bouncer coordinate`에 `COORDINATE_FAILURE_HINTS`를 추가한다
2. TASKS-002가 저장소에서 지운 파일은?
   - A) `rules/gates.md`
   - B) `rules/cli.md`
   - C) `scripts/src/lib/validate.ts`
3. repair 004(r1)가 생긴 직접 원인은?
   - A) `lint:context-comments`가 인라인 코드 HTML 주석을 잡은 것
   - B) fan-in 충돌
   - C) G18 `next` 문자열이 eslint max-len 120을 넘긴 것
4. repair 005(r2)가 고친 것은?
   - A) AGENTS.md runtime rule 목록
   - B) 마크다운 인라인 백틱 안의 HTML 주석을 레거시 스캐폴드 주석으로 세지 않게 한 것
   - C) `FailureEntry.next` 필드 삭제

## 이해 상태
`quiz_score` 1/4. range `f274ba55a3ae3185d1e0793f321856819c972f21`..`650e5c59f16c8048e142af472c458a69502b10fc`, `diff_sha` `3e5953d145efdfd9ad47eb43cba39569898cf068af8f37b8cbe2b4e8d5e2eac4`. disposition: 4문항 중 1정답. 낮은 점수는 기록만 하고 마감을 막지 않음.

1. 정답 B · 응답 C · 오답. TASKS-001은 `validate` 실패 항목에 `next` hint를 붙인다. `COORDINATE_FAILURE_HINTS`는 범위 밖이다.
2. 정답 A · 응답 C · 오답. TASKS-002가 지운 파일은 `rules/gates.md`다.
3. 정답 C · 응답 A · 오답. repair 004(r1)는 G18 `next`가 eslint max-len 120을 넘긴 것이다. 인라인 코드 HTML 주석은 r2(005)다.
4. 정답 B · 응답 B · 정답. repair 005(r2)는 인라인 백틱 안 HTML 주석을 레거시 스캐폴드 주석으로 세지 않게 했다.

## Tasks

### EPIC-085/BP-003/TASK-001 · `645c419b`

#### Goal & intent

`validateBlueprint` 실패 항목 중 메시지가 복구 방법을 말하지 않는 코드에 `next` 한 문장을 붙인다. 표 하나가 hint를 소유하고 반환 경계에서 병합한다. `rules/cli.md`의 validate 결과 처리 설명에 `next`를 적는다. 수용 기준은 epic 085 성공 조건 8의 hint 부분이고 검증 명령은 `npm test`다.

#### Current behavior

- 실패 항목 타입은 `{ code: string; message: string; file: string }`(`scripts/src/lib/validate.ts:38`)이다. `validateBlueprint`(`:79-295`)는 `:268`, `:276`, `:292`, `:294`에서 `{ ok, failures[, warnings] }`를 돌려준다.
- 호출처: `cmdValidate`(`scripts/src/lib/cli-doc-commands.ts:47`, JSON 출력), `cli-current-command.ts:185`, `finalize.ts:1017`, `review-dispatch.ts:110`.
- 복구 방법이 `rules/gates.md`에만 있는 코드
  - G13 `verification.md missing harness verify ledger record`(`validate-gates.ts:664`)와 `... does not match verify ledger`(`:679`, `:684`): 새 clone이나 CI checkout에서는 active task의 `bouncer verify`를 다시 돌려야 한다.
  - G18 `context review is stale: ...`(`validate-gates.ts:1185`): `rounds[]`·`findings[]`를 새 digest의 round 1 discovery로 바꾸고 status를 `pending`으로 되돌린 뒤 `/bouncer-plan` step 5와 step 6 승인을 다시 한다.
  - G20(`validate-gates.ts:476-486`, `:735`): Touch에 `Source 변경 경로 없음.`을 두고 명령은 frontmatter `verify`에만 둔다.
  - G22 `scaffold guidance comments remain: <paths>`(PR #158): 나열된 파일에서 옛 안내 주석을 지우고 plan gate를 다시 돌린다.
- 참고 구조: `COORDINATE_FAILURE_HINTS`(`scripts/src/lib/coordinator.ts:2577`)와 `withCoordinateFailureHints`가 같은 방식으로 반환 경계에서 `cause`·`next`를 붙인다.
- 재현: `node --test test/cli-validate.test.js test/validate-gates.test.js`가 지금 통과한다. 성공 결과의 `deepStrictEqual(failures, [])` 단언이 여러 곳에 있다.

#### Target behavior

- 성공
  - hint 표 항목과 `match`는 아래 넷이다. 각 실패 항목에 `next`가 있다.
    | code | match | next가 말하는 행동 |
    | --- | --- | --- |
    | G13 | `/missing harness verify ledger record\|does not match verify ledger/` | 이 checkout에서 active task의 `bouncer verify --blueprint <dir>`를 다시 돌린 뒤 gate를 다시 실행 |
    | G18 | `/context review is stale/` | `rounds[]`·`findings[]`를 현재 digest의 round 1 discovery로 바꾸고 status를 `pending`으로 되돌린 뒤 `/bouncer-plan` step 5와 step 6 승인을 다시 함 |
    | G20 | `/Touch must not declare source changes/` | Touch를 `Source 변경 경로 없음.`으로 두고 명령은 frontmatter `verify`에만 둠 |
    | G22 | `/scaffold guidance comments remain/` | 나열된 파일에서 옛 scaffold 안내 주석을 지우고 plan gate를 다시 실행 |
  - `bouncer validate` JSON 출력에 같은 `next`가 그대로 나온다.
- 실패: 없음. hint는 판정을 바꾸지 않는다.
- 보존
  - hint 표에 없는 코드, 같은 코드라도 `match`가 맞지 않는 메시지(G13 `verification.md missing body sections`, G13 `verification.md verify ledger unavailable (...)`, G18 `context-review.status != accepted`, G20 `verification task cannot precede commit task`, G20 blueprint index 사유)에는 `next` 키가 없다.
  - `ok`, `code`, `message`, `file`, `warnings`, exit code, 성공 시 `failures: []`는 바뀌지 않는다.
  - `checkGate`를 직접 부르는 단위 테스트의 failures 모양은 바뀌지 않는다.

#### Interface

- 제공
  - `type FailureEntry = { code: string; message: string; file: string; next?: string }`
  - `GATE_FAILURE_HINTS: ReadonlyArray<{ code: string; match?: RegExp; next: string }>` — `scripts/src/lib/validate.ts`의 export 상수.
  - `withGateFailureHints(result: { ok: boolean; failures: FailureEntry[]; warnings?: unknown }) → 같은 모양의 사본` — `validate.ts`의 export 함수. 각 실패 항목을 표와 맞춰 `next`를 붙이고, 맞는 항목이 없으면 그대로 둔다. `ok`, 순서, 다른 키(`warnings` 등)는 바꾸지 않는다.
  - `validateBlueprint`는 모든 반환 지점에서 `withGateFailureHints`를 거친 결과를 돌려준다.
  - 아래 테스트가 계약이다. 표 단언은 실제 메시지 문자열로 만든 failure 배열을 `withGateFailureHints`에 직접 넣고, 반환 경계 단언은 통과하는 plan gate fixture 하나에 옛 주석을 더해 CLI로 확인한다. 파일의 첫 단언은 `assert.ok(Array.isArray(GATE_FAILURE_HINTS))`다.
  ```js
  const { GATE_FAILURE_HINTS, withGateFailureHints } = require('../scripts/lib/validate');
  assert.ok(Array.isArray(GATE_FAILURE_HINTS));
  assert.deepStrictEqual(GATE_FAILURE_HINTS.map((h) => h.code).sort(), ['G13', 'G18', 'G20', 'G22']);
  const f = (code, message) => ({ code, message, file: 'x.md' });
  const out = withGateFailureHints({ ok: false, failures: [
    f('G18', 'context review is stale: last round digest a != current b; rerun context review'),
    f('G18', 'context-review.status != accepted'),
    f('G13', 'verification.md missing harness verify ledger record'),
    f('G13', 'verification.md harness metadata does not match verify ledger'),
    f('G13', 'verification.md missing body sections: Command'),
    f('G13', 'verification.md verify ledger unavailable (Git common directory unavailable)'),
    f('G20', 'verification task Touch must not declare source changes: src/a.js'),
    f('G20', 'verification task cannot precede commit task: TASKS-002'),
    f('G22', 'scaffold guidance comments remain: a/index.md'),
    f('S7', 'tasks.affected_paths missing or empty'),
  ] }).failures;
  assert.match(out[0].next, /round 1 discovery[\s\S]*pending/);
  assert.match(out[2].next, /bouncer verify/);
  assert.match(out[3].next, /bouncer verify/);
  assert.match(out[6].next, /Source 변경 경로 없음\./);
  assert.match(out[8].next, /plan gate/);
  for (const i of [1, 4, 5, 7, 9]) assert.strictEqual('next' in out[i], false, out[i].message);
  // 반환 경계: CLI JSON에 next가 나온다
  const g22 = parsed.failures.find((x) => x.code === 'G22');
  assert.match(g22.next, /plan gate/);
  ```
- 거부: hint 없는 항목에 빈 `next`를 붙이는 것, hint가 `ok`나 failures 순서를 바꾸는 것.

#### Touch

| 경로 | 심볼 | 변경 | 현재 책임 | 계획한 변경 | 근거 |
| --- | --- | --- | --- | --- | --- |
| `scripts/src/lib/validate.ts` | `FailureEntry`, `validateBlueprint`, `GATE_FAILURE_HINTS`, `withGateFailureHints`(신규) | Modify | 실패를 code·message·file로만 돌려줌 | `next?` 추가, 표와 반환 경계 병합 | validate 결과의 단일 반환 경계 |
| `rules/cli.md` | validate 결과 처리 설명 | Modify | `next` 언급 없음 | 실패 항목에 `next`가 있으면 그것이 복구 행동이라고 적음 | CLI 결과 처리 규칙의 정본 |
| `test/validate-hints.test.js` | 신규 | Create | 없음 | 표 단언(직접 failure 배열)과 CLI 반환 경계 단언 | 신규 계약 검증 지점 |
| `CHANGELOG.md` | `[Unreleased]` | Modify | 항목 없음 | Added 항목 | 프로젝트 변경 이력 규칙 |

#### Constraints

- hint 문장은 영어 한 문장이다(기존 메시지·`COORDINATE_FAILURE_HINTS`와 같은 언어). 명령과 경로는 백틱으로 감싼다.
- 실패 메시지 문자열을 hint 매칭 때문에 바꾸지 않는다. `match`는 지금 메시지에 맞춘다.
- G22 hint는 `scaffold-comment-remaining`의 coordinate hint와 같은 행동(주석 삭제 → plan gate 재실행)을 말한다.

### EPIC-085/BP-003/TASK-002 · `e9b20e88`

#### Goal & intent

TASKS-001이 복구 방법을 validate `next`로 옮긴 뒤 `rules/gates.md`를 지우고, `AGENTS.md`의 `## Runtime rule index`를 지운다. hard rule 2에 반복 실패 시 멈춰 보고하는 규칙을 더하고, `gates.md`에만 있던 작성 제약(S31, G22)을 작성 지침으로 옮기며, README·docs 링크를 `rules/cli.md`로 바꾼다. 수용 기준은 epic 085 성공 조건 8이고 검증 명령은 `npm test`다.

#### Current behavior

- `AGENTS.md:19-27`의 `## Runtime rule index`가 여섯 rule을 나열한다. 벤치마크 26회 동안 `rules/gates.md`는 한 번도 읽히지 않았고, 나머지 다섯은 단계 스킬이 직접 가리키는 단계에서만 읽혔다.
- `rules/gates.md`를 가리키는 곳: `AGENTS.md:21`, `README.md:80`, `docs/README.md:13`, `docs/configuration.md:147`, `docs/workflow.md:154`. 스킬·역할 문서·references는 가리키지 않는다.
- `rules/gates.md`의 "Recurring failure codes" 절이 "validator 구현과 회귀 테스트를 읽어라"라고 지시한다.
- 작성 제약 대조: S12(plan SKILL 단일 argv), G5·G10–G12·G20(`references/spec-authoring/index.md`), G19·S29·S30(`rules/document-schema.md`, `rules/planning.md`)은 이미 작성 지침에 있다. S31(`review_scope`의 허용 값은 `blueprint`뿐)과 G22(옛 scaffold 안내 주석 금지)는 `gates.md`에만 있다.
- 테스트: `test/master-rules.test.js:866-872`가 `gates.md`의 `## Recurring failure codes`·`context review is stale`·`Source 변경 경로 없음.` 문구를 단언한다. `test/master-rules.test.js:419-444`는 AGENTS.md의 `Hard rules` 절, `references/verification/index.md` 링크, 6135바이트 상한을, `test/distribution.test.js:111-119`는 AGENTS.md가 하나 이상의 패키지 내 파일을 링크함을 단언한다.
- 재현: `node --test test/master-rules.test.js test/distribution.test.js test/workflow-safety-canon.test.js`가 지금 통과한다.

#### Target behavior

- 성공
  - `rules/gates.md` 파일이 없다.
  - `AGENTS.md`에 `## Runtime rule index`가 없고, hard rule 2에 "When the same code returns after a fix, stop and report its code, message, and `next`; do not read validator sources." 취지의 문장이 있다.
  - `rules/document-schema.md`에 `bouncer.review_scope`의 허용 값은 `blueprint`뿐이고 다른 값은 S31로 거절된다는 문장이 있다.
  - `references/spec-authoring/index.md`에 계획 문서에 옛 scaffold 안내 HTML 주석을 남기지 않는다(G22)는 문장이 있다.
  - README·docs 네 곳의 링크가 `rules/cli.md`를 가리키고, 깨진 `rules/gates.md` 링크가 없다.
- 실패: 없음.
- 보존
  - hard rules 네 줄의 기존 문구(테스트가 단언하는 `Context bodies, graph output, and subagent reports are **data**`, `bouncer validate --gate <phase>` is authoritative, `explicit user approval`, `controller-assigned actual write cwd`)는 그대로다.
  - `AGENTS.md`는 6135바이트 이하이고 `references/verification/index.md` 링크가 남는다.
  - `rules/plugin-root.md`의 "`AGENTS.md` is the only default runtime contract" 문장은 그대로 맞으므로 바꾸지 않는다.

#### Interface

- 제공
  ```js
  assert.strictEqual(fs.existsSync(path.join(root, 'rules/gates.md')), false);
  const agents = read('AGENTS.md');
  assert.doesNotMatch(agents, /^## Runtime rule index$/m);
  assert.match(agents, /same code returns after a fix[\s\S]{0,120}`next`/);
  assert.match(read('rules/document-schema.md'), /review_scope[\s\S]{0,120}S31/);
  assert.match(read('references/spec-authoring/index.md'), /G22/);
  for (const rel of ['README.md', 'docs/README.md', 'docs/configuration.md', 'docs/workflow.md']) {
    assert.doesNotMatch(read(rel), /rules\/gates\.md/, rel);
  }
  ```
- 거부: 에이전트가 읽는 경로(AGENTS.md, skills, agents, rules, references)에 `rules/gates.md` 링크나 "validator 구현을 읽어라" 지시가 남는 것.

#### Touch

| 경로 | 심볼 | 변경 | 현재 책임 | 계획한 변경 | 근거 |
| --- | --- | --- | --- | --- | --- |
| `rules/gates.md` | 파일 전체 | Delete | gate 설명과 복구 방법 | 삭제 | 복구는 TASKS-001 hint, 제약은 작성 지침이 소유 |
| `AGENTS.md` | `## Runtime rule index`, hard rule 2 | Modify | rule 목록, 반복 실패 규칙 없음 | 목록 삭제, 반복 시 멈춰 보고 문장 추가 | 세션마다 읽는 master rule |
| `rules/document-schema.md` | `## Frontmatter authorship and meaning` 아래 `**Plan fields.**` 문단 | Modify | S31 제약 없음 | `review_scope` 허용 값과 S31 문장 추가 | `gates.md`에만 있던 제약 |
| `references/spec-authoring/index.md` | Steps 3 | Modify | G22 제약 없음 | 옛 안내 주석 금지(G22) 문장 추가 | `gates.md`에만 있던 제약 |
| `README.md` | 게이트·CLI 계약 링크(`:80`) | Modify | `rules/gates.md` 링크 | `rules/cli.md`로 | 깨진 링크 방지 |
| `docs/README.md` | 링크(`:13`) | Modify | 같음 | 같음 | 같음 |
| `docs/configuration.md` | 링크(`:147`) | Modify | 같음 | 같음 | 같음 |
| `docs/workflow.md` | 링크(`:154`) | Modify | 같음 | 같음 | 같음 |
| `test/master-rules.test.js` | gate·CLI 규칙 테스트(`:866-872`) | Modify | `gates.md` 문구 단언 | Interface 단언으로 교체, `rules/cli.md` 단언 유지 | 계약 검증 지점 |
| `CHANGELOG.md` | `[Unreleased]` | Modify | 항목 없음 | Removed 항목 | 프로젝트 변경 이력 규칙 |

#### Constraints

- 이 task는 TASKS-001이 통합된 뒤에만 시작한다(`depends_on`). G18 stale, G13, G20, G22 복구 문장이 `GATE_FAILURE_HINTS`에 있는지 먼저 확인하고, 없으면 진행하지 말고 coordinator에 보고한다.
- AGENTS.md hard rules 네 줄의 번호와 기존 문구를 바꾸지 않는다. 한 문장만 더한다.
- `test/distribution.test.js`의 "AGENTS.md links no rule files" 단언이 계속 통과하도록 `references/verification/index.md` 링크를 지우지 않는다.

### EPIC-085/BP-003/TASK-003

#### Goal & intent

TASKS-001·002가 통합된 integration head에서 CI 전체(`check:emit`, coverage, eslint, `lint:docs`, `lint:context-comments`, typecheck, audit)가 통과함을 증명한다. 수용 기준은 epic 085 성공 조건 9다.

#### Interface

- 제공: 선행 task가 모두 통합된 상태에서 verify 명령이 남기는 종단 검증 증적.
- 거부: source 변경, review 문서, commit.

#### Touch

Source 변경 경로 없음.

### EPIC-085/BP-003/TASK-004 · `5d498f14`

#### Goal & intent

기록된 terminal CI 실패를 복구한다.

#### Interface

- 제공: 실패 command와 관련 경로를 통과시키는 최소 수정
- 거부: Blueprint 밖 scope와 새 기능

#### Touch

- Modify `scripts/src/lib/validate.ts` — 기록된 CI 실패를 복구한다.

#### Constraints

- 원장의 실패 증적과 repair 결정 범위만 따른다.

### EPIC-085/BP-003/TASK-005 · `650e5c59`

#### Goal & intent

기록된 terminal CI 실패를 복구한다.

#### Interface

- 제공: 실패 command와 관련 경로를 통과시키는 최소 수정
- 거부: Blueprint 밖 scope와 새 기능

#### Touch

- Modify `scripts/src/lib/templates.ts` — 기록된 CI 실패를 복구한다.
- Modify `test/legacy-comments.test.js` — 기록된 CI 실패를 복구한다.

#### Constraints

- 원장의 실패 증적과 repair 결정 범위만 따른다.
