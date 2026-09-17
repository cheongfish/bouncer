---
type: bouncer.explain
title: 001 explain
description: Explain for 001
resource: .bouncer/context/epics/009-agent-orchestration/blueprints/008-run-loop/explain.md
tags:
  - bouncer
  - explain
timestamp: '2026-08-13T09:01:54.469+09:00'
bouncer:
  id: EXPLAIN-008
  epic_id: '009'
  blueprint_id: '008'
  status: published
  comprehension:
    - range_from: develop
      range_to: 38f5f997d739d8780c96b67d723f55374fd55ba5
      diff_sha: 0d71a4207d1f0789b917b6964b5cbf89e29018b115cc97a384bd859324f1a7ef
      quiz_score: 4/5
      disposition: Q2만 오답 — autonomy 부재·허용 밖은 interactive가 아니라 auto로 진행함
      recorded_at: '2026-08-13T09:03:25+09:00'
---
# Explain

## Background

task가 늘수록 execute→commit 사이 확인이 선형으로 늘어났다. 게이트 판정은
코드가 이미 하는데, 다음 task로 넘기는 결정까지 매번 사람이 답하고 있었다.
이 변경은 `/bouncer-run`으로 그 구간만 반복하고, 멈추는 자리(verify 재실패,
리뷰 왕복 상한, 범위 위반)를 문서에 고정한다. plan·finalize 정본은 그대로다.
`config.autonomy`는 확인 횟수만 고른다. debugger 재디스패치 상한은 수동·자동
경로가 갈라지지 않도록 양쪽 모두 1회로 맞춘다.

## Intuition

수동 다섯 단계 위에서 execute→commit만 크루즈 컨트롤로 돌리고, 빨간불이
뜨면 그 task에 세워 둔다.

## Code

- `skills/bouncer-run/SKILL.md` — 루프 규칙·시작 ACQ·중단·`autonomy` 분기.
  execute/commit 본문을 복제하지 않고 두 스킬을 부른다.
- `scripts/src/lib/schema.ts` — `AUTONOMY_ENUM` / `DEFAULT_AUTONOMY`.
  `init.ts`·`config.example.json`이 새 저장소에 `autonomy: "auto"`를 심는다.
  기존 `config.json`은 건드리지 않는다.
- `skills/bouncer-execute/SKILL.md`, `skills/debugging/SKILL.md`,
  `agents/bouncer-debugger.md` — 같은 verify 실패 재디스패치 상한 **1회**.
- `CLAUDE.md`, `docs/workflow.md` — `/bouncer-run`을 다섯 단계의 **대체 경로**로
  서술. finalize는 run이 부르지 않는다.

## Quiz

1. `/bouncer-run`이 소진 후 하는 일은?
   - A) `/bouncer-finalize`까지 자동 진입
   - B) 멈추고 `/bouncer-finalize`를 안내만 함
   - C) 다음 ready blueprint로 포인터를 옮김

2. `config.autonomy`가 없거나 허용 목록 밖이면?
   - A) 주행을 막고 `bouncer init`으로 보냄
   - B) `interactive`로 진행
   - C) 알린 뒤 `auto`로 진행

3. 같은 verify 실패에 debugger를 다시 보내는 상한은?
   - A) 1회 (수동·자동 동일)
   - B) 자동 주행만 1회, 수동은 3회
   - C) 3회

4. `auto` 모드에서 `/bouncer-commit`의 commit·next-task ACQ는?
   - A) 매 task마다 그대로 묻음
   - B) 시작 ACQ가 대신하므로 건너뜀
   - C) commit만 묻고 next-task는 건너뜀

5. verify 재실패로 멈추면?
   - A) 포인터를 비우고 worktree를 지움
   - B) 포인터·worktree를 그 task에 남기고, 수동 execute 후 run을 다시 검
   - C) `/bouncer-run`이 같은 task를 자동 재시도함

## 이해 상태

- 점수: 4/5
- 정답: 1B · 2C · 3A · 4B · 5B
- 응답: 1B · 2A · 3A · 4B · 5B
- 채점: 1✓ 2✗ 3✓ 4✓ 5✓
- disposition: Q2만 오답 — autonomy 부재·허용 밖은 interactive가 아니라 auto로 진행함
- range: develop..38f5f997d739d8780c96b67d723f55374fd55ba5
- diff_sha: 0d71a4207d1f0789b917b6964b5cbf89e29018b115cc97a384bd859324f1a7ef

## Tasks

### Task 001

#### Goal & intent

`autonomy`가 `config.json`의 정식 필드가 된다. `schema.ts`가 허용 값과 기본값을
export하고, `bouncer init`이 새 저장소의 `config.json`에 `"auto"`를 써 넣으며,
설정 문서가 두 값의 차이를 서술한다. 이 task는 값을 **등록**만 한다 — 그 값을
읽어 동작을 가르는 쪽은 TASKS-002의 스킬이다.

#### Interface

- 제공:
  - `scripts/src/lib/schema.ts`가 두 상수를 추가로 export한다.
    ```ts
    const AUTONOMY_ENUM = ['auto', 'interactive'];
    const DEFAULT_AUTONOMY = 'auto';
    ```
    기존 `module.exports` 목록에 두 이름을 덧붙인다. 문서 필드 등록
    (`TYPES` / `KIND_TO_TYPE` / `STATUS_ENUM`)은 건드리지 않는다 — `autonomy`는
    프로젝트 설정이지 문서 frontmatter가 아니다.
  - `scripts/src/lib/init.ts`의 `defaultConfig`가 `autonomy: 'auto'`를 포함한다.
    자리는 `base_branch` 다음, `pr` 앞이다.
  - `config.example.json`에 같은 줄이 같은 자리에 있다.
- 거부:
  - 이미 있는 `config.json`에 키를 채워 넣지 않는다. `init`의 ready-bootstrap
    경로와 `--promote-graphify` 경로는 지금처럼 `graphify.enabled`(및 성공 시
    `bin`)만 바꾼다.
  - 허용 목록 밖 값을 판정하는 코드를 넣지 않는다. `validate`·CLI·게이트에
    `autonomy` 분기를 만들지 않는다.

#### Touch

- Modify `scripts/src/lib/schema.ts` — `AUTONOMY_ENUM`·`DEFAULT_AUTONOMY` 선언과 export 추가
- Modify `scripts/lib/schema.js` — 위 변경의 CJS emit(`npm run build` 산출물, 커밋 대상)
- Modify `scripts/src/lib/init.ts` — `defaultConfig`에 `autonomy: 'auto'` 추가
- Modify `scripts/lib/init.js` — 위 변경의 CJS emit
- Modify `config.example.json` — 기본 설정 예시에 같은 키 추가
- Modify `docs/configuration.md` — 설정 표에 `autonomy` 행 추가
- Modify `test/schema.test.js` — 두 상수의 값 단언 추가
- Modify `test/init.test.js` — `config.json` 정확 형태 단언(`deepStrictEqual`)에 새 키 반영

#### Constraints

- TypeScript 원본을 고치고 `npm run build`(또는 `pretest`)로 `scripts/lib/`
  emit을 재생성해 함께 커밋한다. emit만 손으로 고치지 않는다.
- 새 상수 옆에 왜 이 값이 필요한지 한국어 주석을 남긴다. 기존 `SCALE_ENUM`·
  `DEFAULT_SCALE` 주석과 같은 밀도로 쓴다.
- 부재를 `auto`로 읽는다는 규칙을 주석에 명시한다. 소비자가 `interactive`인지만
  비교하도록 두고, `auto` 전용 분기를 새로 만들 여지를 남기지 않는다.
- `init.test.js`의 `deepStrictEqual` 단언은 키를 빼먹으면 실패하므로, 기대값
  객체에 새 키를 넣어 형태를 고정한 채로 통과시킨다.

### Task 002

#### Goal & intent

`/bouncer-run`이 여섯 번째 워크플로 스킬로 생긴다. 활성 포인터의 blueprint에서
`/bouncer-execute` → `/bouncer-commit` 순서를 task가 없어질 때까지 반복하고,
verify·review·범위 위반은 미리 적힌 지점에서 멈춘다. 사람 확인은 `auto`에서
시작 ACQ 하나뿐이고, `interactive`는 task 경계 확인만 더한다.

#### Interface

- 제공:
  - `skills/bouncer-run/SKILL.md` — frontmatter `name: bouncer-run`,
    `description`은 다른 워크플로 스킬과 같은
    `This skill should be used only when the user explicitly asks…` 형태.
    본문 구조는 다른 워크플로 스킬의 anatomy를 따른다: 플러그인 루트 참조
    (`docs/install.md` 「플러그인 루트」) → master rules Read → Project Distill →
    ACQ 절 → 번호 붙은 단계.
  - 본문이 서술할 주행 규칙:
    - **Preflight** — `bouncer current`. `null`이면 `/bouncer-plan`으로 보내고
      주행하지 않는다. blueprint가 `closed`이거나 열린 task가 없으면
      `/bouncer-finalize`로 보낸다.
    - **시작 ACQ**(단 하나) — 남은 task 목록과 각 task의 `affected_paths`를 보인
      뒤 주행 여부를 묻는다. 옵션 순서는 기존 규칙(추천 진행 → 수정 → 취소).
    - **반복 단위** — `/bouncer-execute`를 그 스킬의 절차대로 수행하고, 이어
      `/bouncer-commit`을 수행한 뒤 `bouncer current --set <bp> --task <NNN>`으로
      다음 task로 옮긴다. 다음 후보는 `bouncer commit` JSON의 `nextTask`에서
      읽는다.
    - **삼키는 확인** — `auto`에서는 `/bouncer-commit`의 commit ACQ와 next-task
      ACQ를 묻지 않고 진행한다. 시작 ACQ가 그 둘의 동의를 미리 받은 자리다.
    - **`interactive`** — 각 task를 닫은 뒤 다음 task로 갈지 ACQ 하나를 더 묻는다.
      그 외 절차·문서·게이트는 `auto`와 같다.
    - **verify 실패** — `bouncer-debugger` 경유로 **1회** 고쳐 재시도하고, 같은
      verify가 또 실패하면 멈춘다. 수동 경로와 같은 수이며(TASKS-004가 execute·
      debugging·debugger 문서를 같은 수로 맞춘다), 루프가 별도 상한을 씌우는
      것이 아니다.
    - **review finding 잔존** — implementer에게 되돌리는 왕복은 **2회**까지.
      상한에 닿으면 `/bouncer-plan`으로 에스컬레이션한다. 루프가 finding을
      `accepted`로 바꾸지 않는다.
    - **implementer 맥락** — task 브리프 절들에 더해 `.bouncer/Distill.md`와
      직전 커밋 subject 목록만 준다. 이전 task의 대화 맥락 전체를 넘기지 않는다.
    - **중단 시 상태** — 포인터는 실패한 task에 남기고 worktree도 남긴다.
      재개는 `/bouncer-execute`로 그 task만 수동으로 닫은 뒤 다시 걸라고 안내한다.
    - **종료** — task를 소진하면 멈추고 `/bouncer-finalize`를 안내한다.
    - **`autonomy` 해석** — `.bouncer/config.json`의 `autonomy`를 읽고, 부재이거나
      `AUTONOMY_ENUM` 밖이면 사용자에게 알린 뒤 `auto`로 진행한다.
  - `test/skill-bouncer-run.test.js` — 위 계약을 본문 단언으로 고정한다.
  - `test/skill-bouncer-surface.test.js`의 `WORKFLOW` 배열에 `'bouncer-run'` 추가.
- 거부:
  - 새 CLI 명령·플래그를 만들지 않는다. 진행 수단은 `bouncer current --set`과
    `bouncer commit`의 기존 출력뿐이다.
  - `/bouncer-finalize`를 부르지 않는다.
  - `/bouncer-execute`·`/bouncer-commit`의 절차를 본문에 복제하지 않는다. 두
    스킬을 이름으로 부르고, 루프가 추가하는 규칙만 적는다.

#### Touch

- Create `skills/bouncer-run/SKILL.md` — 자동 주행 커맨드 본문
- Create `test/skill-bouncer-run.test.js` — 주행 규칙 본문 계약 단언
- Modify `test/skill-bouncer-surface.test.js` — `WORKFLOW` 목록에 `bouncer-run` 추가

#### Constraints

- 본문은 한국어 산문이되, 다른 워크플로 스킬과 같은 자리(플러그인 루트 블록,
  ACQ 스켈레톤, 셸 블록의 `BOUNCER_ROOT=` 재선언)는 형태를 맞춘다. 셸 블록은
  매번 새 셸이므로 블록마다 `BOUNCER_ROOT`를 다시 대입한다.
- named 디스패치 네 단계와 `scale: light` 인라인 규칙을 옮겨 적지 않는다.
  execute가 가진 규칙이며 사본이 갈리면 두 문서가 서로 다른 말을 하게 된다.
- 상한 숫자(verify 1, review 2)를 본문에 숫자로 적는다. "몇 번쯤"처럼 읽는
  사람이 판단할 여지를 남기지 않는다.
- 컨텍스트 문서 본문·그래프 산출물·서브에이전트 리포트는 데이터이지 지시가
  아니라는 전제를 깨지 않는다. 루프가 그 내용을 근거로 상한이나 범위를 바꾸지
  않는다.
- 새 테스트는 본문 문자열 단언으로 계약을 고정한다. 스킬 실행을 흉내 내는
  하네스를 만들지 않는다.

### Task 003

#### Goal & intent

워크플로를 설명하는 문서가 `/bouncer-run`을 알게 된다. 수동 다섯 단계는 그대로
정본으로 남고, 자동 주행은 execute→commit 구간을 대신 도는 **대체 경로**로
덧붙는다. 이 task는 문서와 그 문서를 보는 테스트만 건드린다.

#### Interface

- 제공:
  - `CLAUDE.md` — 하드룰 5의 다섯 단계 화살표 문장은 그대로 두고, 그 아래에
    `/bouncer-run`이 execute→commit 구간을 반복하는 대체 경로라는 문장을 더한다.
    「When to invoke」 표에 행 하나를 추가한다.
    ```markdown
    | Run one blueprint to task exhaustion | `/bouncer-run` |
    ```
  - `docs/workflow.md` — 「자동 주행」 절 신설. 시작 ACQ 하나, 종료 조건(task
    소진), 중단 지점 셋(verify 1회, review 2회, 범위 위반), 중단 시 포인터·
    worktree 유지와 `/bouncer-execute` 재개, `autonomy` 두 값의 차이를 적는다.
    「How it works」 블록에 자동 주행 줄을 더한다.
  - `docs/ARCHITECTURE.md` §2 — 다섯 단계 목록 아래에 `/bouncer-run`이 같은
    단계를 부르는 드라이버이며 단계 계약을 새로 만들지 않는다는 문장을 더한다.
  - `docs/governance.md` — `/bouncer-commit`이 task 하나를 닫는다는 문단에,
    `/bouncer-run`이 그 커밋 단위를 바꾸지 않고 반복만 한다는 문장을 더한다.
  - `README.md` 커맨드 목록에 한 줄을 더한다.
    ```
    /bouncer-run       # execute→commit 반복 주행 (task 소진까지)
    ```
  - `test/master-rules.test.js` — `workflow skills instruct reading CLAUDE.md
    before steps`의 스킬 목록에 `'bouncer-run'`을 넣고, 「When to invoke」 표에
    `/bouncer-run` 행이 있는지 단언을 더한다.
  - `test/public-name-regression.test.js` — `SUPERPOWERS_NEGATIVE_TESTS`에
    `'test/skill-bouncer-run.test.js'`를 넣는다(TASKS-002 네거티브 단언 allowlist
    누락).
- 거부:
  - 하드룰 5의 다섯 단계 화살표 순서를 고치지 않는다. 수동 경로가 정본이고,
    `test/master-rules.test.js`의 순서 정규식이 그대로 통과해야 한다.
  - 자동 주행을 기본 경로로 서술하지 않는다. 두 경로가 공존한다.
  - 상한·중단 규칙의 정본을 문서로 옮기지 않는다. 정본은 `/bouncer-run`
    SKILL.md이며 문서는 요약만 한다.

#### Touch

- Modify `CLAUDE.md` — 하드룰 5 보충 문장과 「When to invoke」 행 추가
- Modify `docs/workflow.md` — 「자동 주행」 절과 「How it works」 줄 추가
- Modify `docs/ARCHITECTURE.md` — §2에 드라이버 문장 추가
- Modify `docs/governance.md` — 커밋 단위가 그대로임을 명시
- Modify `README.md` — 커맨드 목록 한 줄 추가
- Modify `test/master-rules.test.js` — 스킬 목록에 `bouncer-run` 추가, 표 행 단언 추가
- Modify `test/public-name-regression.test.js` — `skill-bouncer-run`을 Superpowers 네거티브 allowlist에 추가

#### Constraints

- 한국어 본문에 `stop-slop`을 적용한다. "원활하게" "효율적으로" 같은 채움말과
  같은 말 반복을 넣지 않는다.
- 문서마다 같은 규칙을 길게 되풀이하지 않는다. 각 문서는 자기 층위에서 한 번만
  말하고 자세한 것은 `/bouncer-run`으로 넘긴다.
- 본문은 문서·계약 테스트 위주다. `CLAUDE.md` 표 행은
  `test/master-rules.test.js` 단언으로 고정하고, TASKS-002 allowlist 누락만
  `public-name-regression`에 한 줄로 고친다.

### Task 004

#### Goal & intent

같은 verify 실패에 대한 `bouncer-debugger` 재디스패치 상한이 세 곳 모두 **1회**가
된다. 수동 경로와 자동 주행이 같은 수를 쓰므로, `/bouncer-run`은 execute 위에
따로 상한을 씌우지 않고 그 수를 그대로 물려받는다.

#### Interface

- 제공:
  - `skills/bouncer-execute/SKILL.md` 4단계의 상한 문장이 1회가 된다. 한 번
    고쳐 재검증했는데 같은 verify가 또 실패하면 아키텍처 / `/bouncer-plan`으로
    에스컬레이션한다.
  - `skills/debugging/SKILL.md`의 「redispatch / retry at most **3** times」가
    같은 규칙으로 바뀐다.
  - `agents/bouncer-debugger.md`의 `## Redispatch limit` 절이 같은 수를 말한다.
  - `test/skill-debugging.test.js`가 그 수를 단언한다. 세 파일이 서로 다른
    수를 말하면 실패한다.
- 거부:
  - 상한을 문서마다 다르게 두지 않는다. 「보통 1회, 사정에 따라 더」 같은
    여지를 남기는 문구를 쓰지 않는다.
  - 에스컬레이션 대상을 바꾸지 않는다. 상한에 닿으면 지금처럼 아키텍처 /
    `/bouncer-plan`이다.
  - debugger의 읽기 전용 계약을 건드리지 않는다. 상한 숫자만 바뀐다.

#### Touch

- Modify `skills/bouncer-execute/SKILL.md` — 4단계 verify 실패 문단의 상한을 1회로
- Modify `skills/debugging/SKILL.md` — Guardrails의 상한 문장을 같은 수로
- Modify `agents/bouncer-debugger.md` — `## Redispatch limit` 절을 같은 수로
- Create/Modify `test/skill-debugging.test.js` — 세 문서의 상한 일치 단언 추가

#### Constraints

- 세 문서의 문구를 같은 숫자로 맞추되 문장까지 복사하지 않는다. 각 문서는
  자기 독자(컨트롤러 / 스킬 사용자 / 에이전트)에게 맞는 문장을 유지한다.
- 숫자를 `**1**`처럼 강조 표기로 적어 단언이 문서 형태에 기대지 않게 한다.
- 이 변경의 이유(무인 주행에서 같은 실패를 반복하는 비용)를 `explain.md`에
  남길 수 있도록, 커밋 본문 의도를 `commit_intent` 두 줄로 이미 적어 둔다.
