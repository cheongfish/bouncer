---
type: bouncer.explain
title: 001 explain
description: Explain for 001
resource: .bouncer/context/epics/004-planning-quality-governance/blueprints/007-context-review-guard/explain.md
tags:
  - bouncer
  - explain
timestamp: '2026-08-13T12:16:49.415+09:00'
bouncer:
  id: EXPLAIN-007
  epic_id: '004'
  blueprint_id: '007'
  status: published
  comprehension:
    - range_from: develop
      range_to: 9bee47d627466d310a78286eae89e0c4383ac338
      diff_sha: a04bca890a5e0784db305d629728c3c741b0cd918e4081620d748c57e8b67e70
      quiz_score: 3/6
      disposition: Q1–Q3 오답 — G18은 plan 전용이고 문서는 BP 루트 CTXREVIEW이며 게이트는 필드만 읽음
      recorded_at: '2026-08-13T12:21:44+09:00'
---
# Explain

## Background

plan 게이트는 필드가 채워졌는지만 봤다. 에픽·blueprint·tasks가 서로 어긋나도
승인이 났고, 그 브리프는 execute에서야 깨졌다. `/bouncer-run`은 그 사이를
사람이 보지 못한 채 주행한다.

이 변경은 blueprint 루트에 `context-review.md`를 두고, 승인 직전에
`bouncer-context-reviewer`가 계획 문서를 판정하게 한다. **G18**은 그 문서의
status와 findings 형식만 본다. 판정 문장은 에이전트가 쓰고, 통과 여부는
`bouncer validate`가 가른다.

같이 고정한 것: minimality 래더에서 native platform과 표준 라이브러리를 갈라
세우고 `bouncer.scale`에 강도를 매긴 것, 컨텍스트 본문·그래프 산출물·서브에이전트
리포트를 지시로 읽지 않는다는 경계를 `docs/security.md`에 적은 것.

## Intuition

execute의 `review.md`를 plan 입구에 하나 더 붙인 것이다. 게이트는 표의 칸이
채워졌는지만 본다.

## Code

- `scripts/src/lib/schema.ts` · `paths.ts` · `scaffold.ts` — 종류
  `bouncer.context_review`, 파일은 blueprint 루트 `context-review.md`, id는
  `CTXREVIEW-<bp>`. `scaffold blueprint`가 같이 만들고, 기존 BP는
  `bouncer scaffold context-review --blueprint`. 파일이 있으면 거절한다
  (`scaffoldExplain`의 조용한 no-op과 다름).
- `skills/context-review/SKILL.md`, `agents/bouncer-context-reviewer.md` —
  네 범위(문서 간 모순, 범위, 한국어, 성공 기준 검증 가능성). 에이전트는
  read-only. 컨트롤러가 `context-review.md`를 쓰고 status를 올린다.
- `skills/bouncer-plan/SKILL.md` — `affected_paths` 확정 다음, 승인 직전에
  named 디스패치 네 단계(미지원 호스트는 인라인 폴백).
- `scripts/src/lib/validate.ts` — plan 전용 G18. findings 계약은 G14와 같다
  (`id`·`severity`·`status`, `accepted`에는 note). 배열이 아닌 findings는
  빈 목록으로 떨어뜨리지 않는다. `scale: light` 분기는 없다.
- `skills/minimality/SKILL.md` — 7단. 3단 native platform, 4단 표준 라이브러리.
  `light`는 1–4단만, 부재·`full`은 7단. `scripts/`는 이 매핑을 읽지 않는다.
- `docs/security.md` 「신뢰 경계」 — 플러그인 스킬·에이전트·마스터 룰과 사용자
  직접 지시만 따른다. `test/trust-boundary.test.js`가 스킬 8·에이전트 4의
  문구를 순회한다. 실질 방어선은 게이트 판정을 `bouncer validate`만 한다는
  설계다.

## Quiz

1. G18이 막는 게이트는?
   - A) plan과 execute
   - B) plan만
   - C) plan·execute·finalize 전부

2. `context-review.md`의 위치와 id는?
   - A) `tasks/<NNN>/context-review.md`, id `REVIEW-<NNN>`
   - B) epic 루트 `context-review.md`, id `CTXREVIEW-<epic>`
   - C) blueprint 루트 `context-review.md`, id `CTXREVIEW-<bp>`

3. G18이 읽는 것은?
   - A) status와 findings의 `id`·`severity`·`status` (`accepted`면 note), `## Findings` 절
   - B) 에이전트가 쓴 판정 문장
   - C) 스킬이 매긴 점수

4. G18을 문서·스킬(001·002) 다음에 올린 이유는?
   - A) `scale: light` 면제를 쓰기 위해
   - B) `review.md`를 재사용하려고
   - C) 이 blueprint의 `context-review.md`가 있어야 `current --set`이 자기 게이트를 통과하므로

5. minimality 래더에서 native platform과 표준 라이브러리 순서는?
   - A) native platform이 3단, 표준 라이브러리가 4단
   - B) 한 단에 묶여 있다
   - C) 표준 라이브러리가 3단, native platform이 4단

6. 컨텍스트 본문·그래프 산출물·서브에이전트 리포트를 지시로 읽으면?
   - A) `scripts/`가 패턴 탐지로 막는다
   - B) `scripts/`는 막지 않는다. 실질 방어선은 게이트 판정을 `bouncer validate`만 한다는 설계다
   - C) `scale: light`면 면제된다

## 이해 상태

- 점수: 3/6
- 정답: 1B · 2C · 3A · 4C · 5A · 6B
- 응답: 1A · 2B · 3B · 4C · 5A · 6B
- 채점: 1✗ 2✗ 3✗ 4✓ 5✓ 6✓
- disposition: Q1–Q3 오답 — G18은 plan 전용이고 문서는 BP 루트 CTXREVIEW이며 게이트는 필드만 읽음
- range: develop..9bee47d627466d310a78286eae89e0c4383ac338
- diff_sha: a04bca890a5e0784db305d629728c3c741b0cd918e4081620d748c57e8b67e70

## Tasks

### Task 001

#### Goal & intent

blueprint 루트에 `context-review.md`가 정본 문서로 존재할 수 있게 된다.
`bouncer scaffold blueprint`가 이 문서를 함께 만들고, 기존 blueprint에는
`bouncer scaffold context-review --blueprint <dir>`로 붙일 수 있다. 전체
저장소 validate가 새 문서를 알려진 종류로 인식해 S1–S5·S19를 내지 않는다.
이 task는 문서 종류와 생성 경로까지만 만든다 — 게이트(G18)는 TASKS-003,
문서를 쓰는 주체(스킬·에이전트)는 TASKS-002다.

#### Interface

- 제공:
  - `schema.ts`가 `bouncer.context_review`를 `TYPES`·`ID_PREFIX`
    (`CTXREVIEW-`)·`STATUS_ENUM`(`pending` | `requested` | `addressed` |
    `accepted`)·`KIND_TO_TYPE`(`context_review`)에 등록한다.
  - `paths.ts` `FILE_KIND`에 `'context-review.md': 'context_review'`.
  - `scaffold.ts` `scaffoldContextReview({ repoRoot, blueprintDir, timestamp })`
    가 `<bp>/context-review.md`를 만들고 생성 경로 배열을 돌려준다.
    `scaffoldBlueprint`가 `index.md` 다음, task 묶음보다 앞서 이를 호출한다.
  - `cli.ts`에 `scaffold context-review --blueprint <dir>` kind.
  - `validate.ts` `expectedTypeForPath`가 blueprint 아래 `context-review.md`에
    `bouncer.context_review`를 기대한다.
  - `validate.ts` `loadBlueprintDocs`가 blueprint 루트 `context-review.md`를
    `contextReview` 슬롯으로 읽는다(`explain`과 같은 BP 단위 슬롯, 부재는
    `null`). 이 task에서 슬롯까지 만드는 이유는 슬롯이 없으면 문서가 아예
    로드되지 않아 구조 검사가 돌지 않고, `expectedTypeForPath`는 export되지
    않아 `validateBlueprint` 경유로 S19를 볼 방법이 없기 때문이다. 슬롯은
    로드·구조 검사까지만 열고 게이트 판정은 넣지 않는다.
  - 문서 본문 템플릿은 `## Findings` 한 절이며, `review.md` 템플릿과 같은
    최소 형태를 쓴다.
- 거부:
  - `--blueprint` 누락 → `scaffold context-review: --blueprint is required`,
    종료 코드 2.
  - blueprint 디렉터리가 정본(`.bouncer/context/epics/**/blueprints/<NNN>-…`)이
    아니면 throw → `scaffold: <메시지>`, 종료 코드 2.
  - `context-review.md`가 이미 있으면 파일을 쓰지 않고 throw. `scaffoldExplain`의
    조용한 `[]` 반환과 다르다 — plan이 직접 부르는 명령이라 덮어쓰기가 사람 손에
    닿는다.
  - `closed` blueprint는 `scaffoldTask`와 같은 이유로 거절한다. 검사는 파일을
    쓰기 전에 끝낸다.

#### Touch

- Modify `scripts/src/lib/schema.ts` — 새 type·id 접두·status enum·kind 매핑 등록
- Modify `scripts/lib/schema.js` — 위 emit
- Modify `scripts/src/lib/paths.ts` — `FILE_KIND`에 `context-review.md` 추가
- Modify `scripts/lib/paths.js` — 위 emit
- Modify `scripts/src/lib/templates.ts` — `context-review.md` 본문 템플릿과
  blueprint 템플릿 Documents 목록에 새 문서 링크 추가
- Modify `scripts/lib/templates.js` — 위 emit
- Modify `scripts/src/lib/scaffold.ts` — `scaffoldContextReview` 추가와
  `scaffoldBlueprint` 호출, export
- Modify `scripts/lib/scaffold.js` — 위 emit
- Modify `scripts/src/lib/cli.ts` — `scaffold context-review` 분기
- Modify `scripts/lib/cli.js` — 위 emit
- Modify `scripts/src/lib/validate.ts` — `expectedTypeForPath`의 S19 매핑과
  `loadBlueprintDocs`의 `contextReview` 슬롯(로드만, 게이트 판정 없음)
- Modify `scripts/lib/validate.js` — 위 emit
- Modify `test/schema.test.js` — 새 type이 네 상수에 모두 등록됐는지
- Modify `test/paths.test.js` — `parsePathIds` kind 판정
- Modify `test/scaffold.test.js` — `created` 목록 변화와 중복·closed 거절
- Modify `test/validate-structural.test.js` — 정상 문서 통과와 type 불일치 S19
- Modify `test/cli-help.test.js` — 새 scaffold kind의 사용법 출력
- Modify `docs/cli.md` — `scaffold context-review` 행 추가
- Modify `docs/okf.md` — BP 루트 문서를 설명하는 문장 추가. 이 파일에는 문서
  종류 목록이 없고 task 묶음 세 문서를 설명하는 단락만 있으므로, 그 옆에
  `explain.md`·`context-review.md`가 BP 루트 문서라는 문장을 새로 쓴다

#### Constraints

- 새 어휘를 만들지 않는다. status enum과 findings 필드 이름(`id`·`severity`·
  `status`·`note`)은 `bouncer.review`의 것을 그대로 쓴다.
- 게이트 코드는 이 task에서 추가하지 않는다. `validate.ts` 수정은
  `expectedTypeForPath` 매핑과 `loadBlueprintDocs` 슬롯 두 곳이며,
  `checkGate`는 건드리지 않는다.
- 하위 호환 별칭·자동 마이그레이션을 두지 않는다. 032까지의 blueprint는
  문서가 없는 상태로 남는다.
- `scaffoldContextReview`는 모든 거절 검사를 통과한 뒤에만 파일을 쓴다.
- 비자명한 판단은 한국어 주석으로 남긴다 — 특히 `scaffoldExplain`과 중복 처리가
  갈리는 이유.

### Task 002

#### Goal & intent

`/bouncer-plan`이 승인 직전에 계획 문서를 판정하는 단계를 갖는다. 판정은
새 스킬 `context-review`가 정의하고, 실행은 read-only named agent
`bouncer-context-reviewer`가 맡으며, 결과는 TASKS-001이 만든
`context-review.md`에 남는다. 이 저장소의 blueprint `033/001`도 자기
`context-review.md`를 갖게 되어, TASKS-003이 G18을 켜는 순간 자기 게이트에
막히지 않는다. 게이트 코드는 이 task에서 추가하지 않는다.

#### Interface

- 제공:
  - `skills/context-review/SKILL.md` — 판정 범위 네 가지(문서 간 모순, 범위
    검토, 한국어 품질, 성공 기준의 검증 가능성)와 findings 기록 형식.
  - `agents/bouncer-context-reviewer.md` — `name`이 basename과 같고
    `model: inherit`, `readonly: true`. 페르소나·하드 가드·출력 계약은
    `bouncer-reviewer.md`와 같은 자리 배분을 따른다. 판정 대상은 계획 문서
    (epic·blueprint·`tasks/<NNN>/tasks.md`)이고 산출 문서는 BP 루트
    `context-review.md`다 — task 디렉터리 `review.md`를 쓰지 않는다.
  - `/bouncer-plan` 신규 단계 — affected_paths 확정(6단계) 다음, 승인(7단계)
    직전. named 디스패치 네 단계(모델 해석 → named 호출 → slug 거절 시
    `inherit` 재시도 → named 미지원 시 인라인 폴백)를 그대로 쓴다.
  - `init.ts` 기본 `subagents` 블록 네 곳(claude / cursor / codex / antigravity)에
    `'bouncer-context-reviewer': 'inherit'`. `config.example.json`은 세 블록
    (claude / cursor / codex)뿐이므로 그 세 곳에만 넣는다 — antigravity 블록
    누락은 기존 드리프트이고 이 task가 고치지 않는다.
  - `docs/configuration.md`의 "네 프로바이더 × 세 에이전트" 문장과 에이전트
    이름 열거를 새 에이전트를 포함하도록 고친다.
  - 이 blueprint의 `context-review.md` 실물 — findings와 status가 채워진 상태.
    `scope.makeAllowed`가 blueprint 디렉터리 하위를 무조건 허용하므로
    `affected_paths`에 넣지 않는다.
- 거부:
  - 에이전트가 문서를 편집하거나 status를 뒤집는 것. 판정문만 돌려주고
    `context-review.md`에 기록하는 주체는 컨트롤러다.
  - `accepted` finding에 `note` 없이 승인하는 것.
  - Codex처럼 `agents/`를 배포할 수 없는 호스트에서 단계를 건너뛰는 것.
    인라인 폴백으로 같은 판정을 수행한다.

#### Touch

- Create `skills/context-review/SKILL.md` — 판정 범위와 기록 형식
- Create `agents/bouncer-context-reviewer.md` — read-only 리뷰어 에이전트
- Create `test/skill-context-review.test.js` — 스킬 본문 계약
- Create `.bouncer/context/epics/004-planning-quality-governance/blueprints/007-context-review-guard/context-review.md` — 이 blueprint 자신의 판정 기록
- Modify `skills/bouncer-plan/SKILL.md` — 승인 직전 단계 추가
- Modify `scripts/src/lib/init.ts` — 기본 subagents 블록에 새 에이전트
- Modify `scripts/lib/init.js` — 위 emit
- Modify `config.example.json` — 예시 subagents 블록 세 곳에 새 키
- Modify `test/agents.test.js` — frontmatter·readonly 순회에만 새 에이전트 추가
- Modify `test/skill-bouncer-plan.test.js` — 새 단계와 폴백 문구
- Modify `test/skill-bouncer-surface.test.js` — plan이 새 스킬을 경로로 인용
- Modify `test/init.test.js` — 기본 config의 새 키
- Modify `test/subagents.test.js` — 모델 해석이 새 이름을 다룸
- Modify `docs/workflow.md` — plan 단계 서술
- Modify `docs/ARCHITECTURE.md` — 전문 스킬로서의 위치(§4 일반 스킬 표 아님)
- Modify `docs/configuration.md` — subagents 절의 에이전트 개수·이름 열거 갱신

#### Constraints

- `context-review`는 `graphify-runner`·`migrate-ids`와 같은 전문 스킬이다.
  `docs/ARCHITECTURE.md` §4 일반 워크플로 스킬 표와 `APPROVED_GENERIC_SKILLS`에
  넣지 않는다.
- named 디스패치 네 단계 문구는 `/bouncer-execute`의 것을 재서술하지 말고 같은
  형태를 유지한다. 인라인 폴백 문장이 빠지면 Codex에서 이 단계가 영구히 막힌다.
- 에이전트에는 하드룰 9(주석)를 재서술하지 않는다 — 포인터만.
- 스킬 `description`은 3인칭 트리거 문장(`This skill should be used …`)이며 YAML
  안에서 `##`를 그대로 쓰지 않는다.
- `skills/context-review/SKILL.md`와 `agents/bouncer-context-reviewer.md` 본문은
  **영어**다. 기존 `skills/review` · `skills/debugging` · `agents/*.md`가 모두
  영어 본문이고, 하드룰 8의 한국어 범위는 `.bouncer/context/epics/**`와 BP
  `explain.md`다. 아래 Checklist의 판정 범위 네 가지는 이 브리프에서 한국어로
  적었을 뿐이며 스킬 본문에는 영어로 옮긴다.
- `assets/` 디스패치 템플릿을 만들지 않는다. `review`만 템플릿을 갖는 이유는
  base/HEAD·제약을 채워 넘겨야 하기 때문이고, context 판정은 대상이 문서 경로로
  이미 정해져 채울 자리가 없다. `bouncer-implementer` · `bouncer-debugger`처럼
  plan 단계 본문에서 인라인으로 프롬프트를 구성한다.
- 이 blueprint의 `context-review.md`는 `bouncer scaffold context-review`로 만들고
  손으로 파일을 새로 쓰지 않는다.
- 판정을 근거로 기존 계획 문서를 고쳐야 한다면 이 task에서 고치지 말고 finding으로
  남긴다. 계획 수정은 `/bouncer-plan`의 일이다.

### Task 003

#### Goal & intent

`bouncer validate --gate plan`이 `context-review.md`를 판정 대상으로 삼는다.
문서가 없거나 status가 `accepted`가 아니거나 findings 형식이 어긋나면 **G18**로
막힌다. 게이트가 읽는 것은 status와 세 필드뿐이고 판정 문장 자체는 읽지 않으므로,
LLM 판단이 게이트가 되지 않고 결정적 코드가 게이트로 남는다(하드룰 4).
TASKS-002가 이 blueprint의 문서를 이미 만들어 뒀으므로, 이 커밋 직후
`bouncer current --set`이 자기 자신에서 막히지 않는다.

#### Interface

- 제공:
  - plan 게이트에 **G18**. `contextReview` 슬롯은 TASKS-001이 이미 열어 뒀으므로
    이 task는 `docs.contextReview`를 읽어 판정만 한다. 실패 메시지는 사유별로
    갈린다.
    ```
    G18 context-review.md missing
    G18 context-review.status != accepted
    G18 context-review missing ## Findings body section
    G18 context-review finding <id> severity invalid: <value>
    G18 context-review finding <id> status invalid: <value>
    G18 context-review finding <id> accepted without note
    ```
  - findings 판정 규칙은 G14의 것과 같다 — `id`·`severity`·`status`가 있어야
    하고 `accepted`에는 비지 않은 `note`가 붙는다.
- 거부:
  - `scale: light`라는 이유의 면제. 조건 분기를 만들지 않는다.
  - execute / commit / finalize 게이트에 G18을 넣는 것. plan 전용이다.
  - `context_review.findings`가 배열이 아닌 값 — 빈 배열과 같게 취급하지 않고
    형식 위반으로 막는다.

#### Touch

- Modify `scripts/src/lib/validate.ts` — plan 게이트 G18 판정과 G14 findings
  검사부의 공용 헬퍼 추출
- Modify `scripts/lib/validate.js` — 위 emit
- Modify `test/validate-gates.test.js` — G18 통과·실패 분기
- Modify `test/cli-validate.test.js` — CLI 출력에 G18 코드가 실림
- Modify `test/cli-current.test.js` — `writePlanPassingBlueprint`와
  `writeNumberedPlanBlueprint`가 accepted `context-review.md`를 쓰게 함.
  `current --set`이 plan 게이트를 타므로 G18 이후 이 픽스처가 같이 맞아야 한다
- Modify `docs/gates.md` — plan 행에 G18 추가
- Modify `skills/bouncer-plan/SKILL.md` — 마지막 단계의 게이트 코드 목록 갱신
- Modify `test/skill-bouncer-plan.test.js` — 그 목록을 보는 단언

#### Constraints

- findings 판정은 G14와 같은 규칙이므로 로직을 복제하지 말고 공용 헬퍼로 뽑아
  두 게이트가 같은 답을 내게 한다. 규칙이 갈라지면 두 리뷰 문서가 다른 계약을
  갖게 된다.
- 게이트는 finding의 본문 문장을 읽지 않는다. status와 세 필드, `## Findings`
  절의 존재까지다.
- 기존 게이트 코드 번호와 메시지 형식을 바꾸지 않는다. G18은 새 번호다.
- 문서가 없을 때의 메시지는 파일 경로를 함께 알려 `bouncer scaffold
  context-review`로 이어지게 한다.
- 비자명한 판단은 한국어 주석으로 남긴다 — 특히 `light` 면제를 두지 않은 이유.

### Task 004

#### Goal & intent

`minimality` 래더가 "표준 라이브러리"와 "네이티브 플랫폼 기능"을 별도 단으로
가르고, 판단 강도를 blueprint frontmatter의 기존 `bouncer.scale`(`light` |
`full`)에 매핑한다. 새 설정 키나 새 모드 어휘를 만들지 않고, `ponytail-mcp`도
도입하지 않는다 — 흡수 대상은 래더 문구뿐이다.

#### Interface

- 제공:
  - `skills/minimality/SKILL.md` 래더가 7단이 된다. 이 문서는 영어 본문이므로
    단 제목도 영어이며, 아래는 기존 문구를 그대로 이어받은 형태다.
    ```
    1 Does this need to exist in the plan? (YAGNI)
    2 Already in this codebase? (reuse)
    3 Prefer a native platform feature
    4 Prefer the standard library
    5 Prefer an already installed dependency
    6 Prefer the shortest working surface
    7 Only then propose minimal new code
    ```
    기존 3단 `Prefer the **standard library** or **native platform feature**`을
    가르는 것이므로 `standard library`와 `native platform` 두 표현이 본문에
    그대로 남아야 한다 — `test/skill-minimality.test.js`가 그 문자열을 단언한다.
  - 같은 문서에 강도 매핑 절. `bouncer.scale`이 `light`면 래더 1–4단까지만
    적용하고 근거 기록을 한 줄로 줄인다. 부재·`full`은 7단 전부다.
  - `docs/ARCHITECTURE.md` §E가 래더 단 수와 강도 매핑의 근거를 담는다.
- 거부:
  - 새 `config.json` 키나 새 enum. 강도는 기존 `SCALE_ENUM`만 읽는다.
  - `scripts/`가 이 매핑을 읽는 코드 경로. 강도는 스킬 문서의 판단 기준이며
    게이트도 CLI도 아니다.
  - `plugin_advisors` / `bouncer advise` 재도입.

#### Touch

- Modify `skills/minimality/SKILL.md` — 래더 7단 분리와 강도 매핑 절
- Modify `test/skill-minimality.test.js` — 새 단 구성과 강도 매핑 단언
- Modify `docs/ARCHITECTURE.md` — §E에 래더 단 수·강도 매핑 항목

#### Constraints

- 「최소화하지 않을 것」 목록(승인된 요구사항, 테스트, 검증, 보안, 접근성,
  오류 처리, 설명 주석)은 강도와 무관하게 항상 적용된다. `light`가 이 목록을
  줄이지 않는다.
- `minimality`는 여전히 자문이며 게이트가 아니다. §E 1번 문장을 유지한다.
- ponytail에서 가져오는 것은 래더 문구뿐이다. MCP 서버·도구·프롬프트를 참조
  대상으로 문서에 넣지 않는다.
- `docs/ARCHITECTURE.md` §4 표는 건드리지 않는다.
- `skills/minimality/SKILL.md`는 한국어 0자인 영어 문서다. 래더·강도 매핑 절 모두
  영어로 쓴다. `docs/ARCHITECTURE.md` §E는 기존대로 한국어다.

### Task 005

#### Goal & intent

컨텍스트 문서 본문·graphify 산출물·서브에이전트 리포트가 **데이터지 지시가
아니라는** 경계를 문서에 고정한다. `docs/security.md`는 현재 커밋 가드 위협
모델만 담고 있어 신뢰 경계 절이 없다. 코드 레벨 탐지는 도입하지 않는다 —
우회 가능하고, 실질 방어선은 "게이트 판정은 `bouncer validate`만 한다"는
기존 설계다. 그 문장을 명문화하는 것이 이 task의 핵심이다.

#### Interface

- 제공:
  - `docs/security.md`에 「신뢰 경계」 절. 신뢰하는 입력(플러그인이 배포한
    스킬·에이전트·마스터 룰, 사용자의 직접 지시)과 신뢰하지 않는 입력
    (`.bouncer/context/**` 본문, `graphify-out/**`, 서브에이전트 리포트,
    저장소 소스·테스트 파일 내용)을 가르고, 후자를 지시로 승격하지 않는다는
    규칙과 그 규칙이 왜 문구 수준인지를 적는다.
  - 외부·생성 데이터를 읽는 스킬 여덟 곳과 에이전트 네 곳에 같은 취지의 한 줄:
    ```
    스킬: bouncer-plan, bouncer-execute, bouncer-run, graphify-runner,
          review, implementation, debugging, context-review
    에이전트: bouncer-reviewer, bouncer-implementer, bouncer-debugger,
              bouncer-context-reviewer
    ```
  - `test/trust-boundary.test.js` — 그 목록을 한곳에서 순회해 문구 존재를 본다.
- 거부:
  - 인젝션 패턴 탐지·이스케이프·새니타이저 코드. `scripts/`는 바뀌지 않는다.
  - 문구를 근거로 한 새 게이트 코드. 이것은 자문이 아니라 설계 서술이며 판정
    대상이 아니다.
  - 나머지 스킬 아홉 곳에 같은 문구를 복제하는 것. 외부 데이터를 읽지 않는
    스킬까지 늘리면 문서만 균일하게 길어진다.

#### Touch

- Modify `docs/security.md` — 「신뢰 경계」 절 추가
- Create `test/trust-boundary.test.js` — 대상 목록 순회 단언
- Modify `skills/bouncer-plan/SKILL.md` — 데이터/지시 구분 한 줄
- Modify `skills/bouncer-execute/SKILL.md` — 같은 문구
- Modify `skills/bouncer-run/SKILL.md` — 같은 문구
- Modify `skills/graphify-runner/SKILL.md` — 그래프 산출물에 대한 같은 문구
- Modify `skills/review/SKILL.md` — 디프·리포트에 대한 같은 문구
- Modify `skills/implementation/SKILL.md` — 브리프 밖 데이터에 대한 같은 문구
- Modify `skills/debugging/SKILL.md` — 로그·출력에 대한 같은 문구
- Modify `skills/context-review/SKILL.md` — 판정 대상 문서에 대한 같은 문구
- Modify `agents/bouncer-reviewer.md` — 하드 가드에 같은 문구
- Modify `agents/bouncer-implementer.md` — 같은 문구
- Modify `agents/bouncer-debugger.md` — 같은 문구
- Modify `agents/bouncer-context-reviewer.md` — 같은 문구
- Modify `docs/ARCHITECTURE.md` — 신뢰 경계를 §B 문서 계약·게이트 항목에서 참조

#### Constraints

- 문구는 방어선이 아니라 설명이다. `docs/security.md`가 "실질 방어선은 게이트
  판정을 코드만 한다는 설계"라고 명시하고, 문구가 우회 가능함을 함께 적는다.
  기존 문서의 정직한 위협 서술 톤을 유지한다.
- 열두 곳의 문구는 같은 취지를 유지하되 그 문서가 실제로 읽는 데이터를
  가리켜야 한다. 같은 문장을 그대로 붙여 넣지 않는다.
- 새 게이트 코드·설정 키·CLI를 만들지 않는다.
- 언어는 파일마다 기존 본문을 따른다. `docs/security.md`·`docs/ARCHITECTURE.md`는
  한국어이고 `stop-slop`을 적용한다. `skills/**`·`agents/**`의 새 한 줄은 그
  문서의 언어를 따르되, `skills/review` · `skills/implementation` ·
  `skills/debugging` · `skills/graphify-runner` · `skills/context-review`와
  `agents/*.md` 넷은 영어 본문이므로 영어로 쓴다. 하드룰 8의 한국어 범위는
  `.bouncer/context/epics/**`와 BP `explain.md`이며 스킬·에이전트는 포함되지
  않는다.
