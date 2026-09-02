---
type: bouncer.tasks
title: bouncer-debugger 에이전트와 4단계 debugging 절차를 넣음
description: read-only 디버거·근본원인 우선 절차·execute verify 실패 배선
resource: .bouncer/context/epics/009-agent-orchestration/blueprints/006-debugger-agent/tasks/001/tasks.md
tags:
  - bouncer
  - tasks
timestamp: '2026-08-06T09:12:53.161+09:00'
bouncer:
  id: TASKS-001
  epic_id: '009'
  blueprint_id: '006'
  status: verified
  affected_paths:
    - agents/bouncer-debugger.md
    - skills/debugging/SKILL.md
    - skills/bouncer-execute/SKILL.md
    - config.example.json
    - scripts/src/lib/init.ts
    - scripts/lib/init.js
    - test/init.test.js
    - test/agents.test.js
    - test/subagents.test.js
    - test/skill-debugging.test.js
    - test/skill-bouncer-execute.test.js
    - docs/workflow.md
  graph:
    generated_at: '2026-08-06T09:31:32+09:00'
    command: graphify query (source + context graphs)
    suggested_paths:
      - scripts/src/lib
      - scripts/lib
      - test
      - agents
      - skills/debugging
      - skills/bouncer-execute
      - docs
    basis: 'graph-sync rebuilt the context graph (built: context; source already fresh; failed: none). Source query "subagents resolveSubagentModel agents debugger init config provider" returned scripts/src/lib/subagents.ts, scripts/lib/subagents.js, test/master-rules.test.js; subagents.ts itself needs no edit because resolveSubagentModel does not hardcode agent names, so only init.ts (which seeds the default subagents block) is in affected_paths. Context query "debugging verify failure agent dispatch execute" returned only a stale node pointing outside this repo (an sdd-plugin path), so it contributed nothing — the execute dispatch shape was taken from skills/bouncer-execute step 3 instead. agents/, skills/, and docs/ were added by hand because config.source_dirs is scripts/hooks/test.'
---
# Tasks

Blueprint: [006](../../index.md)

## Goal & intent
read-only 서브에이전트 `bouncer-debugger`를 추가한다. `agents/bouncer-debugger.md`가
페르소나·권한·출력 계약을 담고, `skills/debugging/SKILL.md`이 4단계 행동 브리프가
되며, `/bouncer-execute` step 4가 verify 실패 시 이 에이전트를 디스패치한다.
에이전트는 파일을 고치지 않고 근본원인 리포트만 반환한다 — 수정은 implementer나
컨트롤러가 한다. 검증은 `npm test`.

## Interface
- 제공: `agents/bouncer-debugger.md` — `name: bouncer-debugger`, `model: inherit`,
  `readonly: true`, 4단계 절차, 출력 계약(재현·증거·단일 가설·최소 수정 제안·
  필요한 회귀 테스트).
- 제공: `skills/debugging/SKILL.md` 4단계 갱신 — Root cause → Pattern →
  Hypothesis → Implementation. 근본원인 조사 전 수정 금지, 3회 실패 시 아키텍처
  escalate.
- 제공: `/bouncer-execute` step 4의 디스패치 4단계
  (`resolveSubagentModel` → 네임드 호출 → 슬러그 거절 시 `inherit` 재시도 →
  네임드 미지원 시 인라인 폴백).
- 제공: `subagents` 기본값에 세 provider 모두 `bouncer-debugger: inherit`.
- 거부: 디버거의 파일 수정·`git commit`·문서 상태 전환·`affected_paths` 확장.
- 거부: 근본원인 없이 제안하는 수정, 같은 실패에 대한 무한 재디스패치.

## Touch
- Create `agents/bouncer-debugger.md` — read-only 디버거 페르소나·권한·출력 계약.
- Modify `skills/debugging/SKILL.md` — 5줄 흐름을 4단계 절차로 다시 쓰고
  Guardrails를 보강한다.
- Modify `skills/bouncer-execute/SKILL.md` — step 4 verify 실패 경로에 디버거
  디스패치 절차를 넣고, 상단 skill flow 줄의 `debugging` 언급을 맞춘다.
- Modify `config.example.json` — `subagents`의 claude/cursor/codex 블록에
  `"bouncer-debugger": "inherit"` 추가.
- Modify `scripts/src/lib/init.ts` — 같은 세 블록의 기본값 추가.
- Modify `scripts/lib/init.js` — build 산출.
- Modify `test/init.test.js` — 기대 `subagents` 객체에 새 키 추가.
- Modify `test/agents.test.js` — 루프 목록에 `bouncer-debugger`를 넣고
  `readonly: true` 단언 대상을 reviewer/debugger 둘로 넓힌다.
- Modify `test/subagents.test.js` — `resolveSubagentModel`이 새 이름에 대해
  provider별 값과 miss→`{ model: null }`을 내는지 확인한다.
- Modify `test/skill-debugging.test.js` — 4단계 이름과 근본원인 우선·3회 실패
  escalate 문구를 단언한다.
- Modify `test/skill-bouncer-execute.test.js` — verify 실패 시 디버거 디스패치와
  폴백 문구를 단언한다.
- Modify `docs/workflow.md` — `/bouncer-execute` 행의 스킬 표기와 named 서브에이전트
  문장에 디버거를 넣는다.

## Do not touch
- `agents/bouncer-reviewer.md`·`agents/bouncer-implementer.md` — 기존 계약 유지.
- `skills/review/reviewer-prompt.md`·`skills/review/SKILL.md` — 리뷰 경로 미변경.
- `scripts/src/lib/subagents.ts` — `resolveSubagentModel`은 이름을 하드코딩하지
  않으므로 코드 변경이 필요 없다. 테스트만 새 이름을 다룬다.
- `docs/ARCHITECTURE.md` §4 generic skills 표와
  `test/public-name-regression.test.js` `APPROVED_GENERIC_SKILLS` —
  `debugging`은 이미 등재돼 있어 표를 건드릴 이유가 없다.
- `.claude-plugin/plugin.json` — `agents/`는 관례 경로라 재선언하면 플러그인이
  거절된다.
- `.bouncer/config.json` — 이 레포 설정은 miss 시 `inherit`이라 바꿀 필요가 없다.
- `scripts/src/lib/validate.ts` — 새 게이트 없음.

## Constraints
- 디버거는 read-only다. 에이전트 문서에 파일 수정·커밋·상태 전환 금지를 명시적
  문장으로 적는다(`bouncer-reviewer`의 Hard guards와 같은 강도).
- superpowers `systematic-debugging`의 4단계 뼈대만 가져오고 보조 문서는 옮기지
  않는다. 문구는 이 레포의 어조로 다시 쓴다 — 원문 통째 복사 금지.
- Codex는 네임드 라우팅 밖이다. 폴백 문구를 지우면 `agents/`가 없는 호스트에서
  execute 흐름이 끊긴다.
- `scripts/lib` 손편집 금지 — `npm run build`로 emit한다.
- 재디스패치 상한을 문서에 숫자로 적는다(무제한 재시도 금지).
- 에이전트·스킬 본문은 영어 유지.
- 새 generic skill을 만들지 않는다. `debugging`을 그대로 쓴다.

## Checklist
- [ ] `test/agents.test.js` 루프 목록에 `bouncer-debugger`를 추가하고 실패를 확인한다.
  ```js
  for (const name of ['bouncer-reviewer', 'bouncer-implementer', 'bouncer-debugger']) {
    // readonly 단언은 reviewer와 debugger 둘 다
  }
  ```
- [ ] `test/skill-debugging.test.js`에 4단계·근본원인 우선·3회 escalate 단언을
  각각 추가한다(교대 정규식 하나로 뭉치지 않는다).
- [ ] `test/skill-bouncer-execute.test.js`에 verify 실패 → 디버거 디스패치 →
  네임드 미지원 시 인라인 폴백 문구 단언을 추가한다.
- [ ] `test/init.test.js`·`test/subagents.test.js`에 새 이름을 반영한다.
- [ ] `agents/bouncer-debugger.md`를 만든다. `bouncer-reviewer.md`의 구조
  (Authority / Hard guards / 절차 / Output contract)를 따르되 내용은 디버깅용.
- [ ] `skills/debugging/SKILL.md`를 4단계로 다시 쓴다. 각 단계의 산출물과
  다음 단계로 넘어가는 조건을 적고, "근본원인 조사 전에는 수정안을 내지 않는다"를
  명시한다.
- [ ] `skills/bouncer-execute/SKILL.md` step 4에 디스패치 절차를 넣는다.
  implementer 디스패치(step 3)와 같은 4단계 형식을 쓴다.
- [ ] `config.example.json`·`scripts/src/lib/init.ts`에 기본값을 넣고
  `npm run build`로 `scripts/lib/init.js`를 재생성한다.
- [ ] `docs/workflow.md` 표와 named 서브에이전트 문장을 갱신한다.
- [ ] `npm test` 통과.
