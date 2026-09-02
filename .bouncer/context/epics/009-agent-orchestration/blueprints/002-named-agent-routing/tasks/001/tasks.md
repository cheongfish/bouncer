---
type: bouncer.tasks
title: agents 디렉터리 추가와 review·execute 디스패치 전환
description: named agent 문서, 스킬 라우팅, 문서 계약 테스트
resource: .bouncer/context/epics/009-agent-orchestration/blueprints/002-named-agent-routing/tasks/001/tasks.md
tags:
  - bouncer
  - tasks
timestamp: '2026-08-03T08:21:43.832Z'
bouncer:
  id: TASKS-001
  epic_id: '009'
  blueprint_id: '002'
  status: verified
  affected_paths:
    - agents/bouncer-reviewer.md
    - agents/bouncer-implementer.md
    - skills/review/SKILL.md
    - skills/review/reviewer-prompt.md
    - skills/bouncer-execute/SKILL.md
    - test/agents.test.js
    - test/skill-review.test.js
    - test/skill-bouncer-execute.test.js
    - docs/ARCHITECTURE.md
  graph:
    generated_at: '2026-08-03T08:24:39.000Z'
    command: graphify query
    suggested_paths:
      - skills
      - test
    basis: query "review dispatch reviewer prompt subagent skill execute implementation agent routing" — 반환 노드 대부분이 리브랜드 이전 색인이라 쓸 수 없었다 (commands/sdd-*.md, .superpowers/, skills/review-adapter, skills/verification-adapter 는 모두 삭제된 경로다). 살아 있는 노드는 skills/ 와 test/ 뿐이라 거기까지만 롤업하고, agents/ 와 docs/ 는 수동으로 보탰다. 그래프 재생성 전에는 이 블루프린트의 제안을 신뢰하지 말 것.
---
# Tasks

Blueprint: [002](../../index.md)

## Goal & intent
플러그인 루트에 `agents/bouncer-reviewer.md`와 `agents/bouncer-implementer.md`를
두고, `skills/review`와 `skills/bouncer-execute` step 3·5가 generic 서브에이전트
대신 그 이름으로 디스패치한다. 디스패치 직전 `resolveSubagentModel`(001)로
모델을 조회해 적용하고, 호스트가 slug를 거부하면 `inherit`로 재시도, named
agent 자체가 없는 호스트(Codex)면 기존 generic/인라인 경로로 떨어진다. 루브릭
내용은 그대로 옮기기만 한다. 검증은 `npm test`.

## Interface
- 제공: `agents/bouncer-reviewer.md` — 읽기 전용 리뷰어 페르소나, 가드,
  Findings 출력 계약. frontmatter는 `name`(basename과 동일), `description`,
  `model: inherit`, `readonly: true`.
- 제공: `agents/bouncer-implementer.md` — `tasks.md` 브리프만 권위로 삼는 구현자
  페르소나. frontmatter는 `name`, `description`, `model: inherit`.
- 제공: 두 스킬 본문에 디스패치 4단계(모델 조회 → named agent 호출 → slug 거부
  시 `inherit` 재시도 및 사용자 고지 → named agent 미지원 시 generic/인라인
  폴백)가 명시된다.
- 제공: `reviewer-prompt.md`는 에이전트 고정 본문(루브릭)이 아니라 **호출
  프롬프트에 붙는 brief 슬롯**임이 문서 자체에 적힌다. `{{BRIEF}}`,
  `{{BASE}}`, `{{HEAD}}`, `{{CONSTRAINTS}}` 플레이스홀더는 유지한다.
- 거부: 서브에이전트는 `review.md`의 상태·frontmatter를 쓰지 않고, git 커밋과
  문서 상태 전이를 하지 않는다. 두 가지 모두 컨트롤러가 유지한다.
- 거부: 매니페스트에 `agents` 경로를 선언하지 않는다. Claude 로더는 관례 경로
  재선언을 중복으로 보고 플러그인 전체를 거부한 전례가 있고, Cursor는 경로
  미지정 시 `agents/`를 자동 탐색한다.
- 거부: Codex는 named agent 라우팅 대상이 아니다. `.codex-plugin/plugin.json`이
  인식하는 컴포넌트는 `skills`·`mcpServers`·`apps`·`hooks` 뿐이라 `agents/`가
  배포되지 않는다.

## Touch
- Create `agents/bouncer-reviewer.md` — 읽기 전용 리뷰어 에이전트 문서.
- Create `agents/bouncer-implementer.md` — 구현자 에이전트 문서.
- Modify `skills/review/SKILL.md` — step 3의 "fresh generic 서브에이전트"를
  `bouncer-reviewer` 라우팅 + 모델 적용 + 폴백 절차로 교체.
- Modify `skills/review/reviewer-prompt.md` — brief 슬롯 성격을 머리말에 명시하고
  에이전트 문서와 중복되는 페르소나 문장을 정리. 플레이스홀더는 유지.
- Modify `skills/bouncer-execute/SKILL.md` — step 3을 `bouncer-implementer`,
  step 5를 `bouncer-reviewer` 라우팅으로 교체.
- Create `test/agents.test.js` — 두 에이전트 문서의 존재와 frontmatter 계약
  (`name` == basename, `model: inherit`, reviewer `readonly: true`)을 고정.
- Modify `test/skill-review.test.js` — `fresh generic` 단정을 named agent 라우팅
  식별자 단정으로 교체.
- Modify `test/skill-bouncer-execute.test.js` — step 3·5의 라우팅 식별자 단정
  추가 및 `fresh generic` 단정 교체.
- Modify `docs/ARCHITECTURE.md` — A절에 "서브에이전트 모델 권고는 런타임 힌트이며
  게이트 입력이 아니므로 A.3과 충돌하지 않는다", "Codex는 named agent 라우팅에서
  제외한다"를 결정으로 기록.

## Do not touch
- `scripts/` — 001이 소유한다. 이 커밋은 `resolveSubagentModel`을 호출만 하고
  구현·시그니처를 바꾸지 않는다.
- `.claude-plugin/plugin.json` · `.cursor-plugin/plugin.json` ·
  `.codex-plugin/plugin.json` — 매니페스트에 에이전트 디렉터리 키를 재선언하지
  않는다. 호스트가 관례 경로를 자동 탐색한다.
- `.bouncer/config.json` — 이 저장소 자신의 설정. 기본값은 `bouncer init`이 준다.
- `skills/implementation/SKILL.md` · `skills/verification/SKILL.md` ·
  `skills/minimality/SKILL.md` · `skills/debugging/SKILL.md` — 호출되는 스킬의
  내용은 그대로다. 바뀌는 것은 컨트롤러의 디스패치 방식뿐이다.

## Constraints
- 루브릭·심각도 기준·Findings 스키마의 **내용**을 바꾸지 않는다. 문장을 옮기더라도
  판정 결과가 달라지면 안 된다.
- 게이트 코드와 문서 계약을 유지한다. G8·G14와 `bouncer.review.findings[]`,
  본문 `## Findings` 요구는 그대로다.
- 문서 테스트는 **식별자 존재**만 단언한다 (`docs/ARCHITECTURE.md` G.2).
  어절 인접성이나 문장 배열을 단언하지 않는다.
- 폴백 경로를 지운 채로 두지 않는다. named agent를 못 쓰는 호스트에서 리뷰가
  아예 돌지 않으면 G8이 막히므로, generic/인라인 경로 문구가 남아야 한다.
- 에이전트 frontmatter에 호스트 전용 키를 늘리지 않는다. 본문은 호스트 간 동일하게
  유지한다.
- 공개 문자열과 문서는 한국어를 유지하되, 스킬·에이전트 마크다운은 기존 파일의
  언어 관례를 따른다 (스킬 본문은 영어).
- 새 의존성을 추가하지 않는다.

## Checklist
- [x] `test/agents.test.js`를 먼저 작성한다. 최소 다음을 단정한다:
  ```js
  // 두 파일이 존재하고 frontmatter name이 basename과 같다
  ['bouncer-reviewer', 'bouncer-implementer']
  // data.model === 'inherit'
  // bouncer-reviewer 는 data.readonly === true
  ```
- [x] `node --test test/agents.test.js`가 파일 부재로 실패하는 것을 확인한다.
- [x] `agents/bouncer-reviewer.md`를 만든다. 페르소나·읽기 전용 가드·Findings
      출력 계약(`severity`, 근거 `file:line`, disposition 힌트)을 담고,
      `review.md` 편집과 상태 전이 금지를 명시한다.
- [x] `agents/bouncer-implementer.md`를 만든다. `tasks.md`의 여섯 섹션만 권위로
      삼고 `affected_paths` 밖을 고치지 않으며 git 명령과 문서 상태 전이를 하지
      않는다고 명시한다. 막히면 멈추고 컨트롤러에 보고한다.
- [x] `skills/review/SKILL.md` step 3을 아래 순서로 다시 쓴다:
  ```
  1) node -e "…resolveSubagentModel({repoRoot:process.cwd(),agentName:'bouncer-reviewer'})"
  2) bouncer-reviewer 를 그 model 로 호출 (brief 는 호출 프롬프트에 첨부)
  3) slug 거부 → inherit 재시도 + 사용자 고지
  4) named agent 미지원 → 기존 generic 서브에이전트 / 인라인 read-only 폴백
  ```
- [x] `skills/review/reviewer-prompt.md` 머리말을 brief 슬롯 성격으로 고치고
      플레이스홀더 네 개를 유지한다.
- [x] `skills/bouncer-execute/SKILL.md` step 3을 `bouncer-implementer`,
      step 5를 `bouncer-reviewer` 라우팅으로 바꾸고, 커밋과 상태 전이는 컨트롤러
      책임임을 남긴다.
- [x] `test/skill-review.test.js`의 `assert.match(md, /fresh generic|generic.*subagent/i)`를
      `bouncer-reviewer` · `resolveSubagentModel` · `inherit` 식별자 단정으로 바꾸고,
      폴백 문구가 남아 있는지도 단정한다.
- [x] `test/skill-bouncer-execute.test.js`의 step 5 테스트를 같은 방식으로 바꾸고,
      step 3에 `bouncer-implementer` 단정을 추가한다.
- [x] `docs/ARCHITECTURE.md` A절에 결정 두 줄을 추가한다.
- [x] `npm test`가 통과한다.
