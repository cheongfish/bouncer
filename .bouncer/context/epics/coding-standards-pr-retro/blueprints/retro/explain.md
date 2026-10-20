---
type: bouncer.explain
title: 004 explain
description: Explain for 004
resource: .bouncer/context/epics/coding-standards-pr-retro/blueprints/retro/explain.md
tags:
  - bouncer
  - explain
timestamp: '2026-10-12T17:00:37.927+09:00'
bouncer:
  id: EXPLAIN-retro
  epic_id: coding-standards-pr-retro
  blueprint_id: retro
  status: published
  comprehension:
    - range_from: d0a5811f91d506a6339f17253879dddb527491bf
      range_to: 42d0f95e2d3f9bff7c620ebdbded988de2ceefd8
      diff_sha: df3144b880308b06de30a8c88d1c7db2c291d3cf4bfb030e8f29d96f3c13bcc7
      recorded_at: '2026-10-12T18:00:00+09:00'
  task_commits:
    - task: coding-standards-pr-retro/retro/001
      sha: 2ba85722
      intent_anchor: task-001
    - task: coding-standards-pr-retro/retro/002
      sha: 71438d1c
      intent_anchor: task-002
    - task: coding-standards-pr-retro/retro/003
      sha: e200452b
      intent_anchor: task-003
    - task: coding-standards-pr-retro/retro/004
      sha: d7fb11b7
      intent_anchor: task-004
    - task: coding-standards-pr-retro/retro/005
      sha: 42d0f95e
      intent_anchor: task-005
---
# Explain

## Background

세션에서 드러난 실패, 반복된 정정, 헛된 탐색은 그 세션이 끝나면 사라진다. 기존 체크와 규칙을 고칠 근거가 대화와 transcript에만 남아 있기 때문이다. 이 변경은 그 근거를 개선 후보로 바꾸는 `/bouncer-retro`를 추가한다. 결과는 채팅에만 출력하고 파일, 규칙, 권한, `.bouncer/` 상태는 바꾸지 않는다. 후보를 채택하려면 별도의 `/bouncer-plan`을 거친다.

근거를 모으는 길은 둘이다. 단독 호출에서는 `bouncer retro sources`로 이 프로젝트의 Claude Code, Codex, Cursor transcript 후보를 최신순으로 나열하고, 사용자가 고른 세션만 `bouncer retro read`로 읽는다. `/bouncer-finalize` 끝에서는 정리 단계가 worktree와 ledger를 지운 뒤라서 현재 대화만 근거로 쓰고, 사용자 응답을 기다리지 않는다.

## Intuition

사고 보고서를 쓰기 전에 블랙박스를 목록으로 먼저 훑고, 필요한 것만 재생하는 흐름이다. 목록(`sources`)은 내용을 열지 않고, 재생(`read`)은 한 번에 한 세션만 연다.

## Code

- `scripts/src/lib/retro-sources.ts` — 세 도구의 transcript 후보를 찾아 최신순 JSON과 `skipped` 사유를 낸다. 본문은 읽지 않는다.
- `scripts/src/lib/retro-read.ts` — Claude Code/Codex JSONL과 Cursor `state.vscdb`를 `{ role, text }` 메시지로 정규화한다. `--max-chars`(기본 200000)를 넘으면 최신 메시지를 남긴다.
- `scripts/src/lib/cli-retro-command.ts`, `scripts/src/lib/cli.ts` — `retro sources` / `retro read` 명령 연결.
- `skills/bouncer-retro/SKILL.md` — 근거 수집, 문제 발견, 기존 장치 확인, 후보 제안, 인계 5단계.
- `skills/bouncer-finalize/SKILL.md` — 5단계 끝의 자동 retro 문단.
- `rules/cli.md`, `rules/acq-gates.json`, `rules/skill-shape.md`, `rules/output.md` — 명령 문서와 스킬 목록 갱신.

## Quiz

1. `bouncer retro read`가 transcript를 `--max-chars`보다 길게 만나면 어떻게 되는가?
   - (가) 오래된 메시지부터 남기고 최신 메시지를 잘라낸다.
   - (나) 최신 메시지를 남기고 오래된 메시지를 버린다.
   - (다) `unsupported-schema` 오류로 실패한다.
2. `/bouncer-finalize` 안에서 자동 retro가 실행되는 조건은?
   - (가) finalize가 닫혔고 `release-main`이 `ok: true`를 돌려준 경우. PR을 거절하거나 건너뛰어도 실행된다.
   - (나) 사용자가 PR을 만들기로 승인한 경우에만.
   - (다) 퀴즈를 모두 맞힌 경우에만.
3. 자동 retro 도중 실패하면 finalize 결과는 어떻게 되는가?
   - (가) `closed` 상태를 되돌리고 finalize를 다시 요구한다.
   - (나) 한 줄 `retro: 실행하지 못함 — <이유>. finalize 결과는 그대로임`만 출력하고 기존 출력, `closed`, 포인터는 바꾸지 않는다.
   - (다) 사용자에게 재시도 여부를 묻는 질문을 연다.
4. 단독 `/bouncer-retro`에서 사용자가 경로를 지정하지 않으면 transcript는 어떻게 다뤄지는가?
   - (가) 최신 세션 하나를 자동으로 읽는다.
   - (나) 후보 전체를 한꺼번에 읽는다.
   - (다) `retro sources` 후보를 채팅에 나열하고, 사용자가 고른 세션만 `retro read`로 읽는다.

## Tasks

### coding-standards-pr-retro/retro/001 · `2ba85722`

#### Goal & intent

`bouncer retro sources`를 추가한다. 현재 프로젝트에 속한 transcript 후보를 host별로 찾아 최신순으로 나열하고, 찾지 못한 출처는 이유와 함께 `skipped`에 남긴다. 수용 기준은 epic Success criteria 6이며, 검증 명령은 `npm run ci`이다.

#### Current behavior

- `retro` 명령은 없다. `scripts/src/lib/cli.ts:31-67` `COMMANDS` registry가 help를 조립한다(:76-79). 모르는 명령은 stderr와 종료 코드 2다(:94-98).
- 모듈 형식은 `export =`·`import x = require()`이다(:15-17). 독립 명령 모듈 선례는 `scripts/src/lib/cli-review-dispatch-command.ts`(`{run, usage}`, `parseFlags` 사용)이고, :58-66에서 등록한다.
- JSON 관례: `io.out(JSON.stringify({ok:true,...}, null, 2)+'\n')`(`cli-project-commands.ts:59,68`). 종료 코드는 0 성공, 1 운영 실패, 2 잘못된 사용이다(`rules/cli.md:245-252`).
- home 주입 선례는 `plugin-root.ts:115` `options.homeDir ?? os.homedir()`이다. host 루트를 덮어쓰는 env는 없다.
- `node:sqlite` 사용처는 없다. `package.json:34-35` `engines.node`는 `>=24`이다.
- `test/cli-help.test.js:9-30` `SUBCOMMANDS`가 help에 모든 명령이 있는지 단언한다.
- `test/tiers.json`의 모든 테스트 파일은 unit/integration 중 한 곳에 있어야 한다. unit tier는 프로세스 생성을 막는다(`test/test-tiers.test.js:40-80`).
- 커버리지 임계값은 `scripts/lib/**` lines 94·branches 82·functions 96이다(`package.json:46`).

#### Target behavior

- 성공: `listRetroSources`가 host별 규칙으로 후보를 모은다.
  - Claude Code
    - 루트: `--claude-root` 또는 `$CLAUDE_CONFIG_DIR/projects` 또는 `<home>/.claude/projects`
    - 프로젝트 slug는 project root의 영숫자 아닌 글자를 모두 `-`로 바꾼 값이다.
    - slug와 같은 이름 또는 `<slug>--`로 시작하는 이름(`.worktrees` 아래 worktree)의 디렉터리에서 바로 아래 `*.jsonl`을 모은다.
  - Codex
    - 루트: `--codex-root` 또는 `$CODEX_HOME/sessions` 또는 `<home>/.codex/sessions`
    - 아래 모든 `*.jsonl`의 첫 줄(최대 64KiB)을 JSON으로 읽는다.
    - `payload.cwd`가 project root와 같거나 그 아래이면 후보다.
  - Cursor
    - 루트: `--cursor-root` 또는 플랫폼 기본값
      - linux: `<home>/.config/Cursor/User/workspaceStorage`
      - darwin: `<home>/Library/Application Support/Cursor/User/workspaceStorage`
      - win32: `%APPDATA%/Cursor/User/workspaceStorage`
    - 각 `<hash>/workspace.json`의 `folder` `file://` URI를 디코드한다. project root와 같거나 그 아래이면 같은 디렉터리의 `state.vscdb`가 후보다(`format: 'sqlite'`).
  - 결과는 `mtime` 내림차순이고 `--limit`(기본 20)개까지다.
- 실패:
  - `--limit`이 1..200 정수가 아니거나 모르는 플래그가 있으면 stderr에 usage를 쓰고 종료 코드 2를 낸다.
  - project root를 정하지 못하면 `{ok:false, error}`와 종료 코드 1이다.
  - host별 실패는 전체 실패가 아니다. skipped에 남긴다.
    - `root-missing`: 루트 없음
    - `permission-denied`: 읽기 권한 없음
    - `unparseable-session-meta`: Codex 첫 줄 해석 불가
    - `no-project-match`: 루트는 있으나 일치 항목 없음. `path`는 루트다.
- 보존: 다른 명령의 help 순서와 출력. transcript 내용은 읽지 않는다(Codex 첫 줄 메타만 읽는다).

#### Interface

- 제공:
  - `scripts/src/lib/retro-sources.ts`
    - `listRetroSources(opts: { projectRoot: string, roots: { claude: string, codex: string, cursor: string }, limit: number }) → { project_root, sources: Source[], skipped: Skipped[] }`
    - `defaultRetroRoots(opts: { homeDir: string, platform: NodeJS.Platform, env: Record<string, string | undefined> }) → { claude, codex, cursor }`
    - `claudeProjectSlug(projectRoot: string) → string`. 예: `'/home/a/repo.x'` → `'-home-a-repo-x'`
  - `Source = { host: 'claude-code' | 'codex' | 'cursor', path: string(절대 경로), format: 'jsonl' | 'sqlite', mtime: string(ISO 8601), size: number(bytes) }`
  - `Skipped = { host: 'claude-code' | 'codex' | 'cursor', path: string(루트 또는 파일 절대 경로), reason: 'root-missing' | 'permission-denied' | 'unparseable-session-meta' | 'no-project-match' }`
  - CLI 성공 출력은 stdout `{ ok: true, project_root, sources: Source[], skipped: Skipped[] }`(JSON, 2칸 들여쓰기)이고 종료 코드 0이다. 실패 출력은 stdout `{ ok: false, error: <한국어 메시지> }`이고 종료 코드 1이다. 잘못된 사용은 `run`이 throw하지 않고 stderr에 usage를 쓴 뒤 2를 돌려준다.
  - `scripts/src/lib/cli-retro-command.ts` `{ run(rest, io, deps?), usage }`. `retro sources`는 위 플래그를 받는다. 하위 명령 dispatch 자리는 TASKS-002의 `read`도 쓴다.
  - project root 결정: `--repo`가 있으면 `path.resolve(--repo)`를 쓴다. 없으면 `deps.resolveProjectRoot(cwd)`를 쓴다. 기본값은 `bouncer project-root`(`cli-project-commands.ts:299-311` `cmdProjectRoot`)와 같은 resolver다.
  - test seam: `deps.resolveProjectRoot(cwd: string) → string`. 실패하면 throw한다. CLI는 그 메시지를 `{ok:false, error}`로 쓰고 종료 코드 1을 낸다. `deps.homeDir`, `deps.platform`, `deps.env`는 `defaultRetroRoots` 입력이다.
  - registry 키 `retro`(`cli.ts`)
- 거부 (exit 2, throw 없음): 모르는 하위 명령, 모르는 플래그, 1..200 밖의 `--limit`
- skipped (정상 종료): 위 네 reason
- 도메인 용어: "project root 아래"는 경로를 정규화한 뒤 `p === root || p.startsWith(root + path.sep)`이다. 예: root `/r`이면 `/r/.worktrees/a`는 아래이고 `/r2`는 아니다.

#### Touch

| 경로 | 심볼 | 변경 | 현재 책임 | 계획한 변경 | 근거 |
| --- | --- | --- | --- | --- | --- |
| `scripts/src/lib/retro-sources.ts` | `listRetroSources`, `defaultRetroRoots`, `claudeProjectSlug` | Create | 없음 | host별 후보 탐색 | 상태 판정 진입점 |
| `scripts/src/lib/cli-retro-command.ts` | `run`, `usage` | Create | 없음 | `retro sources` 플래그 파싱·JSON 출력 | CLI 진입점 |
| `scripts/src/lib/cli.ts` | `COMMANDS` | Modify | retro 없음 | `retro` 등록 | :31-67 |
| `rules/cli.md` | `## Read-only discovery and Graphify` | Modify | retro 없음 | sh 블록 한 줄과 설명 문장 | :134-160 |
| `test/retro-sources.test.js` | host별 탐색 단언 | Create | 없음 | 임시 디렉터리 fixture로 lib 단언 | 검증 지점 |
| `test/cli-help.test.js` | `SUBCOMMANDS` | Modify | retro 없음 | `'retro'` 추가와 usage 단언 | :9-30 |
| `test/tiers.json` | `unit` | Modify | 기존 목록 | `retro-sources.test.js` 추가 | 계층 검사 |

#### Constraints

- 테스트는 실제 home을 읽지 않는다. 모든 루트를 임시 디렉터리로 주입한다.
- lib 테스트는 프로세스를 생성하지 않으므로 unit tier다.
- 이 명령은 transcript 본문을 읽지 않는다. 본문 읽기는 TASKS-002가 맡는다.
- 공개 오류 메시지는 한국어다.
- `scripts/lib/`는 빌드 결과이며 Touch에 넣지 않는다.

### coding-standards-pr-retro/retro/002 · `71438d1c`

#### Goal & intent

`bouncer retro read --path <file> [--max-chars <n>]`를 추가한다. Claude Code·Codex JSONL과 Cursor `state.vscdb`를 `{ role, text }` 목록으로 정규화한다. 수용 기준은 epic Success criteria 6·7의 근거 입력이며, 검증 명령은 `npm run ci`이다.

#### Current behavior

- TASKS-001 이후 `scripts/src/lib/cli-retro-command.ts`에 `retro sources`만 있다. 다른 하위 명령은 종료 코드 2다.
- transcript를 읽는 코드는 저장소에 없다. `node:sqlite` 사용처도 없다. `engines.node >=24`이므로 `require('node:sqlite').DatabaseSync`를 쓸 수 있다.
- 커버리지·unit tier 조건은 TASKS-001 Current behavior와 같다.

#### Target behavior

- 성공: `readTranscript(path, { maxChars })`가 형식별로 메시지를 뽑는다.
  - Claude Code(`.jsonl`, 줄 `type`이 `user`·`assistant`이고 `message`가 있음). 한 줄에서 메시지가 0개 이상 나온다.
    - `message.content`가 문자열이면 메시지 하나(role = 줄 `type`)다.
    - 배열이면 `type: 'text'` 항목의 `text`를 `\n`으로 이어 메시지 하나(role = 줄 `type`)를 만든다. text 항목이 없으면 만들지 않는다.
    - 같은 배열의 `type: 'tool_result'`·`is_error: true` 항목마다 `role: 'tool_error'` 메시지를 하나씩 더한다. 텍스트는 `content`가 문자열이면 그대로, 배열이면 그 안 `text`들을 `\n`으로 이은 값이다.
    - 한 줄의 메시지 순서는 text 메시지 다음 tool_error 메시지다.
  - Codex(`.jsonl`, 줄 `type: 'response_item'`이고 `payload.type: 'message'`): `payload.content[]`의 `input_text`·`output_text` 텍스트를 `\n`으로 이어 메시지 하나를 만든다. role은 `payload.role`이 `user`·`assistant`이면 그대로 쓰고, 그 밖의 값(`developer`, `system` 등)이면 `unknown`이다.
  - Cursor(`.vscdb`): read-only로 연 DB의 `ItemTable`에서 key가 `workbench.panel.aichat.view.aichat.chatdata`, `aiService.prompts`, `composer.composerData`인 행의 JSON 값을 읽는다. 값 안의 `text` 문자열 필드를 문서 순서대로 `role: 'unknown'` 메시지로 낸다.
  - JSONL 줄 분류
    - `JSON.parse`가 실패한 줄만 `skipped_lines`로 센다.
    - JSON이지만 메시지 줄이 아닌 것(Codex `session_meta`, Claude `summary` 등)과 text·tool_error가 없는 메시지 줄은 세지 않고 건너뛴다.
    - host는 첫 메시지 줄의 형태로 정한다.
  - 텍스트 합계가 `maxChars`(기본 200000)를 넘으면 가장 최근 메시지부터 남기고 `truncated: true`로 표시한다. 가장 최근 메시지 하나가 혼자 `maxChars`를 넘으면 그 메시지의 마지막 `maxChars` 글자만 남긴다.
  - CLI 성공 출력은 stdout `{ ok: true, host, format, messages, truncated, skipped_lines }`(JSON)이고 종료 코드 0이다.
- 실패:
  - 파일이 없거나 읽을 수 없으면 `reason: 'unreadable'`이다.
  - 형식을 알 수 없거나, JSONL에서 메시지를 하나도 얻지 못하거나, Cursor DB에 위 key가 없으면 `reason: 'unsupported-schema'`이다.
  - 두 경우 모두 CLI는 stdout에 `{ ok: false, reason, error: <한국어 메시지> }`를 쓰고 종료 코드 1을 낸다.
  - `--path`가 없거나 `--max-chars`가 양의 정수가 아니면 stderr에 usage를 쓰고 종료 코드 2다.
- 보존: `retro sources` 동작. 파일을 쓰지 않는다.

#### Interface

- 제공:
  - `scripts/src/lib/retro-read.ts`
    - `readTranscript(filePath: string, opts: { maxChars: number }) → { ok: true, host: 'claude-code' | 'codex' | 'cursor', format: 'jsonl' | 'sqlite', messages: { role: 'user' | 'assistant' | 'tool_error' | 'unknown', text: string }[], truncated: boolean, skipped_lines: number } | { ok: false, reason: 'unreadable' | 'unsupported-schema' }`
    - `normalizeJsonlLine(line: string) → { kind: 'invalid' } | { kind: 'ignored' } | { kind: 'messages', host: 'claude-code' | 'codex', messages: { role, text }[] }`. `invalid`는 `JSON.parse` 실패, `ignored`는 메시지가 아닌 JSON이다.
  - `cli-retro-command.ts`의 `read` 하위 명령과 usage
- 거부 (exit 2, throw 없음): `--path` 없음, 잘못된 `--max-chars`
- 실패 결과 (exit 1): `{ ok: false, reason: 'unreadable' | 'unsupported-schema', error }`

#### Touch

| 경로 | 심볼 | 변경 | 현재 책임 | 계획한 변경 | 근거 |
| --- | --- | --- | --- | --- | --- |
| `scripts/src/lib/retro-read.ts` | `readTranscript`, `normalizeJsonlLine` | Create | 없음 | 형식별 정규화 | 상태 판정 진입점 |
| `scripts/src/lib/cli-retro-command.ts` | `run`, `usage` | Modify | `sources`만 | `read` 하위 명령 추가 | CLI 진입점 |
| `rules/cli.md` | `## Read-only discovery and Graphify` | Modify | `retro sources`만 | `retro read` 한 줄과 설명 | 명령 문서 |
| `test/retro-read.test.js` | 형식별 정규화 단언 | Create | 없음 | JSONL fixture와 `node:sqlite`로 만든 임시 DB 단언 | 검증 지점 |
| `test/cli-help.test.js` | retro usage 단언 | Modify | `sources` usage | `read` usage와 `--max-chars 0` exit 2 | :172-184 패턴 |
| `test/tiers.json` | `unit` | Modify | 기존 목록 | `retro-read.test.js` 추가 | 계층 검사 |

#### Constraints

- 테스트 fixture는 임시 디렉터리에 만든다. 실제 사용자 transcript를 읽거나 저장소에 넣지 않는다.
- 출력 메시지에서 텍스트 외 필드(토큰 사용량, 파일 첨부 바이너리)는 버린다.
- 공개 오류 메시지는 한국어다.
- `node:sqlite`는 Cursor 경로에서만 lazy require하고, `DatabaseSync(path, { readOnly: true })`로만 연다. 이 두 가지는 구현 제약이며 테스트로 단언하지 않는다. reviewer가 diff로 확인한다.

### coding-standards-pr-retro/retro/003 · `e200452b`

#### Goal & intent

`skills/bouncer-retro/SKILL.md`를 추가하고 워크플로 스킬 목록을 가진 모든 곳에 등록한다. 수용 기준은 epic Success criteria 7이며, 검증 명령은 `npm run ci`이다.

#### Current behavior

- 워크플로 스킬은 여섯 개다(init, plan, execute, commit, run, finalize).
- 형태 선례는 `skills/bouncer-commit/SKILL.md:1-8`이다.
  - frontmatter `name`과 `description: "Use only when the user explicitly asks /bouncer-…; it …"`
  - `# /bouncer-…`
  - **Plugin root** 줄(글자 단위 검사, `test/skill-bouncer-surface.test.js:~102`)
  - **Master rules**(`${BOUNCER_ROOT}/AGENTS.md`만)
  - 번호 단계
  - 마지막 H2 `## ACQ (AskUserQuestion) gates`
- 질문하지 않는 스킬은 그 사실을 단계와 한 줄 색인에 쓴다(`rules/skill-shape.md:49-56`).
- 여섯 스킬을 열거하는 곳:
  - `rules/skill-shape.md:40-41`("Six entry skills"), :58("workflow six")
  - `rules/output.md:3-4`("여섯 진입 워크플로")
  - `README.md:47-52` 명령 블록
  - `docs/install.md:155-156`
  - `rules/acq-gates.json`. 빈 목록이 허용된다(`bouncer-execute: []`, :6).
  - `test/acq-gate-ids.test.js:42-49` 순서 목록
  - `test/skill-bouncer-surface.test.js`
    - `WORKFLOW`(:9-12)
    - `ENTRY_WORD_BASELINE`(:108-116, 합계 비교)
    - `ENTRY_STEP_COUNTS`(:147-154)
    - `CONDITIONAL_HELPERS`(:197-213)
    - `SKILL_LOCAL_REFS`(:260-281)
    - `CONDITIONAL_HELPERS`·`SKILL_LOCAL_REFS`는 `WORKFLOW` 이름으로 조회하므로 키가 빠지면 실패한다. `ENTRY_WORD_BASELINE`·`ENTRY_STEP_COUNTS`는 자기 키만 순회하므로 retro 키가 없으면 검사 없이 통과한다. 그래서 두 map에도 retro 값을 명시한다.
    - ACQ 색인은 `bouncer-execute`를 뺀 모든 스킬에서 step 번호를 인용해야 한다(:345-351).
  - `test/cursor-plugin.test.js:19-22` `LAUNCHER_SKILLS`: `bouncer` CLI를 직접 호출하는 스킬 목록. `CLAUDE_PLUGIN_ROOT`·`PLUGIN_ROOT` 금지 단언(:111-145)
- plugin manifest는 `"skills": "./skills/"`로 디렉터리를 자동으로 잡는다. 수정할 필요가 없다.
- 재현은 `node --test test/skill-bouncer-surface.test.js test/acq-gate-ids.test.js test/cursor-plugin.test.js`이다. 현재 통과한다.

#### Target behavior

- 성공: `/bouncer-retro` 스킬이 다섯 단계를 갖는다.
  1. **Evidence**: 근거를 모은다.
     - finalize에서 호출된 경우: 현재 대화만 쓴다. 이 대화에는 finalize digest의 검증 줄(`pr.sections.verification`)과 리뷰 요약(`evidence.review`, `pr.sections.review_points`)이 이미 들어 있다. step 4 Cleanup이 integration worktree와 그 안의 coordinator ledger를 지운 뒤라서 파일을 다시 열지 않고, transcript 탐색도 하지 않는다. 사용자 응답을 기다리지 않는다.
     - 단독 호출: 현재 대화와 사용자가 지정한 경로를 쓴다. 지정 경로가 없으면 `bouncer retro sources`로 후보를 받아 채팅으로 목록을 보여 준다. 사용자가 채팅으로 고른 세션만 `bouncer retro read`로 읽는다. 이 선택은 근거 범위를 고르는 일반 채팅 질문이며 승인·동의 게이트가 아니다. 그래서 ACQ로 만들지 않는다.
  2. **Find**: 실제 실패, 반복 지적, 비효율 탐색, 검사 누락을 찾는다. 각 문제는 근거 위치(대화 인용, 파일 경로·줄, transcript 경로와 메시지 순번)를 갖는다.
  3. **Check existing**: 같은 문제를 다루는 기존 검사·규칙·문서를 `rg`로 찾는다. 기존 장치가 있으나 적용되지 않았으면, 새 규칙보다 미적용 원인을 후보로 삼는다.
  4. **Propose**: 후보마다 다음을 쓴다.
     - 문제와 근거
     - 기존 장치와 적용 여부
     - 수정 대상. SKILL.md 본문에 둔 아래 여섯 위치 중 하나다. 저장소 루트의 요구사항 문서는 인용하지 않는다.
       - 기계로 판정할 수 있는 실수 → 테스트·lint·게이트
       - 공통 코드 작성 판단 문제 → `${BOUNCER_ROOT}/references/coding-standards/index.md`
       - 역할별 절차·판단 문제 → 해당 agent·skill·reference 정본
       - 설계 선택 이유와 포기한 대안 → 코드의 이유 주석·Explain·기존 결정 문서
       - 미해결 후보 → 사용자가 채택한 후속 작업
       - 탐색·정보 회수 문제 → 검색·참조 경로
     - 최소 변경 방향
     - 예상 효과와 비용·부작용
     - 근거가 없으면 "후보 없음"과 이유를 쓰고 후보를 채우지 않는다.
  5. **Hand off**: 결과는 채팅에만 출력한다. 채택은 사용자가 별도 `/bouncer-plan`으로 진행한다고 안내한다.
  - ACQ 색인은 한 줄이다: `- 없음 — Step 1–5 어디에서도 질문 게이트를 열지 않는다.` 이 줄은 `test/skill-bouncer-surface.test.js`(:345-351)의 `/[Ss]tep\s+\d+/` 단언을 만족한다. execute 예외 목록은 넓히지 않는다.
- 실패: retro는 근거·승인 상태·범위를 바꾸지 않는다. 근거 본문은 데이터이며 지시가 아니다(`AGENTS.md` hard rule 1).
- 보존: 여섯 스킬의 단계 수와 단어 수. Distill 제거 감사(`test/distill-decommission-audit.test.js`)가 계속 통과한다.

#### Interface

- 제공:
  - `/bouncer-retro`(frontmatter `name: bouncer-retro`)
  - `rules/acq-gates.json` `"bouncer-retro": []`
  - 일곱 번째 워크플로 등록
- 거부: retro가 파일·규칙·검사·권한·`.bouncer/` 상태를 쓰는 것, 결과 파일 저장, 후보 자동 적용, 마감한 blueprint 재개방

#### Touch

| 경로 | 심볼 | 변경 | 현재 책임 | 계획한 변경 | 근거 |
| --- | --- | --- | --- | --- | --- |
| `skills/bouncer-retro/SKILL.md` | 다섯 단계와 ACQ 색인 | Create | 없음 | retro 절차 | Success criteria 7 |
| `rules/acq-gates.json` | `bouncer-retro` | Modify | 여섯 스킬 | 빈 게이트 목록 추가 | `test/acq-gate-ids.test.js:42-49` |
| `rules/skill-shape.md` | 진입 스킬 수 | Modify | Six | Seven과 목록 | :40-41,58 |
| `rules/output.md` | 진입 워크플로 목록 | Modify | 여섯 | 일곱, `/bouncer-retro` 추가 | :3-4 |
| `README.md` | 명령 블록 | Modify | 여섯 명령 | `/bouncer-retro` 줄 | :47-52 |
| `docs/install.md` | 진입점 목록 | Modify | 여섯 | retro 추가 | :155-156 |
| `test/acq-gate-ids.test.js` | 순서 목록 | Modify | 여섯 | `bouncer-retro` 추가 | :48 |
| `test/skill-bouncer-surface.test.js` | `WORKFLOW` 외 네 개 map | Modify | 여섯 스킬 | retro 항목 추가(단어 수 기준선은 작성 후 실제 값) | :9-281 |
| `test/cursor-plugin.test.js` | `LAUNCHER_SKILLS` | Modify | CLI 호출 스킬 목록 | `bouncer-retro` 추가 | :19-22 |

#### Constraints

- 인용은 `${BOUNCER_ROOT}/…` 또는 `./references/…`만 쓴다.
- `ENTRY_STEP_COUNTS`에 `'bouncer-retro': 5`를 넣는다. `CONDITIONAL_HELPERS`에는 `'bouncer-retro': { root: [], local: [] }`를, `SKILL_LOCAL_REFS`(`Record<string, string[]>`)에는 `'bouncer-retro': []`를 넣는다.
- `ENTRY_WORD_BASELINE`의 `bouncer-retro` 값은 작성한 SKILL.md의 실제 단어 수에 1을 더한 값이다. 이렇게 해야 기존 합계 판정(`after < before`)이 새 스킬 때문에 흔들리지 않는다. 다른 스킬 기준선은 바꾸지 않는다.
- 문서 문구를 정규식으로 검사하는 새 테스트를 만들지 않는다. 기존 surface·ACQ 검사로 형태를 확인한다.
- 이 task는 동작 테스트의 red 단계가 surface 목록 단언이다.

### coding-standards-pr-retro/retro/004 · `d7fb11b7`

#### Goal & intent

`/bouncer-finalize` step 5 Handoff 끝에 retro 자동 실행 규칙을 둔다. finalize 성공 출력을 모두 렌더한 뒤 `${BOUNCER_ROOT}/skills/bouncer-retro/SKILL.md` 절차를 finalize 호출 모드로 실행한다. 수용 기준은 epic Success criteria 8이며, 검증 명령은 `npm run ci`이다.

#### Current behavior

- `skills/bouncer-finalize/SKILL.md`
  - :88 step 4 Cleanup
  - :90-99 step 5 Handoff: `release-main` `next`로 `--set` 실행, closed 종단 안내, 렌더 목록(explain/quiz, remainder `closed`, integration, PR, worktree, pointer, 다음 행동)
  - :101-108 ACQ 색인(`finalize.remainder`, `finalize.pr`)
  - 현재 108줄, 다섯 단계, 단어 기준선 1002
- `skills/bouncer-finalize/references/cleanup-handoff.md:14`: `release-main` `ok:false`면 step 5 `--set`을 실행하지 않는다. :25는 다음 pointer 처리다.
- `test/skill-bouncer-surface.test.js`
  - `ENTRY_STEP_COUNTS` finalize 5(:147-154)
  - `ENTRY_WORD_BASELINE` finalize 1002(:108-116)
  - 합계 비교(`after < before`). :105-107 주석이 의도된 성장 폭만큼 기준선을 올린 선례다.
- handoff 문구를 단언하는 테스트는 없다.

#### Target behavior

- 성공: step 5 Handoff 끝에 문단 하나를 추가한다(단계 수 5 유지).
  - 성공 출력을 렌더한 다음, `${BOUNCER_ROOT}/skills/bouncer-retro/SKILL.md`를 읽고 finalize 호출 모드로 실행한다.
  - 근거는 현재 대화뿐이다(finalize digest의 검증 줄·리뷰 요약 포함). 성공 경로에서는 step 4 Cleanup이 integration worktree와 coordinator ledger를 이미 지웠으므로 파일을 다시 열지 않는다. transcript 탐색도 하지 않는다. TASKS-003 step 1의 finalize 모드와 같다.
  - "finalize 성공"은 `finalize --yes`가 blueprint를 `closed`로 만들었고, `release-main`이 `ok: true`인 경우다. `release-main`이 `ok: false`이면 blueprint는 `closed`이지만 cleanup이 끝나지 않은 상태다(`cleanup-handoff.md:14`). 이때는 retro를 실행하지 않고, 출력도 더하지 않는다.
  - 결과는 `retro` 머리말 아래 채팅에 출력한다.
- 실패:
  - retro 도중 오류나 중단이 생기면 `retro: 실행하지 못함 — <이유>. finalize 결과는 그대로임` 한 줄만 출력한다.
  - 근거가 없는 경우는 실패가 아니다. retro 스킬 step 4 규칙대로 "후보 없음"과 이유를 출력한다(TASKS-003, Blueprint Contract와 같음).
  - 이미 렌더한 성공 출력, `closed` 상태, pointer 결과는 다시 쓰거나 바꾸지 않는다.
  - finalize가 `ok:false`이거나 step 5에 도달하지 못하면 retro를 실행하지 않는다.
- 보존:
  - finalize 단계 수 5, ACQ 게이트 두 개, 렌더 목록 순서
  - retro는 사용자 응답을 기다리지 않는다. retro 미실행을 실패·미완료로 표시하지 않는다.
  - PR 단계가 거절·생략된 성공 finalize에서도 retro를 실행한다.

#### Interface

- 제공: finalize step 5의 자동 retro 규칙 문단
- 거부:
  - retro를 위한 새 ACQ
  - retro 결과로 finalize 출력·상태를 고치는 것
  - finalize 실패 경로에서 retro를 실행하는 것

#### Touch

| 경로 | 심볼 | 변경 | 현재 책임 | 계획한 변경 | 근거 |
| --- | --- | --- | --- | --- | --- |
| `skills/bouncer-finalize/SKILL.md` | step 5 Handoff | Modify | 성공 렌더와 다음 행동 | 끝에 자동 retro 문단 | :90-99 |
| `test/skill-bouncer-surface.test.js` | `ENTRY_WORD_BASELINE` finalize | Modify | finalize 1002 | 추가한 단어 수만큼 기준선과 주석 | :105-116 |
| `CHANGELOG.md` | `[Unreleased]` | Modify | BP 003 항목까지 | "세션 근거 retro (EPIC 095 BP 004)" 항목 | 프로젝트 관례 |

#### Constraints

- 추가 문단은 120단어 이내다. 기준선은 추가한 실제 단어 수만큼만 올리고, 주석에 "095-004: 자동 retro 문단 +N 단어"를 남긴다.
- 새 단계를 만들지 않는다(`ENTRY_STEP_COUNTS` 불변).
- 문서 문구를 단언하는 새 테스트를 만들지 않는다(정본 `Tests` 절). 이 task는 red 단계가 없고, implementer 보고 `Red run`은 `해당 없음: 스킬 문서 규칙 변경`이다.
- retro 인용은 step 5 안에만 두어 numbered step 앞부분 검사(`CONDITIONAL_HELPERS`)를 지킨다.

### coding-standards-pr-retro/retro/005 · `42d0f95e`

#### Goal & intent

기록된 terminal CI 실패를 복구한다.

#### Interface

- 제공: 실패 command와 관련 경로를 통과시키는 최소 수정
- 거부: Blueprint 밖 scope와 새 기능

#### Touch

- Modify `scripts/src/lib/retro-sources.ts` — 기록된 CI 실패를 복구한다.
- Modify `test/retro-sources.test.js` — 기록된 CI 실패를 복구한다.

#### Constraints

- 원장의 실패 증적과 repair 결정 범위만 따른다.