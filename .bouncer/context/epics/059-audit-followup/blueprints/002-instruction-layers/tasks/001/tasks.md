---
type: bouncer.tasks
title: 지시문 층 역할 헌장을 세우고 마스터 룰 재진술을 포인터로 축약
description: CLAUDE.md에 네 지시문 층의 역할 경계 표를 더하고, 스킬이 이미 더 구체적으로 말하는 하드룰 본문을 Detail 포인터로 줄이며 그 문자열 앵커를 실제 보유 파일로 옮긴다
resource: .bouncer/context/epics/059-audit-followup/blueprints/002-instruction-layers/tasks/001/tasks.md
tags:
  - bouncer
  - tasks
timestamp: '2026-08-31T08:39:18.895+09:00'
bouncer:
  id: TASKS-001
  epic_id: '059'
  blueprint_id: '002'
  status: verified
  verify: npm run ci
  commit_intent:
    - 지시문이 네 층인데 경계를 정의한 문서가 없어 같은 규칙이 마스터 룰과 스킬에 중복 착지함
    - 역할 헌장 표를 세우고 스킬이 더 구체적으로 말하는 하드룰 본문은 포인터로 줄여 예산과 정본을 함께 회복함
  affected_paths:
    - CLAUDE.md
    - test/master-rules.test.js
  scope_evidence:
    producer: graphify
    generated_at: '2026-08-31T08:39:18.895+09:00'
    suggested_paths:
      - test
    basis:
      - graph: source
        status: reused
        query: CLAUDE.md master rules instruction layers charter budget bytes anchors
        result: test/ 아래 마스터 룰 문구 단언 파일 군집 (master-rules.test.js 중심)
      - graph: context
        status: updated
        query: CLAUDE.md master rules instruction layers charter budget bytes anchors
        result: .bouncer/context/epics/059-audit-followup/blueprints/002-instruction-layers/tasks/<NNN>/tasks.md 신규 문서만 히트 — 계획 문서 자체이므로 경로 후보로 쓰지 않음
---

# Tasks

Blueprint: [002](../../index.md)

## Goal & intent
`CLAUDE.md`를 읽는 세션이 "어떤 규칙이 어느 층에 사는가"를 표 하나로 판정할 수 있게 된다. 지금은 그 경계가 어디에도 없어서, 마스터 룰이 스킬·레퍼런스가 이미 실행 가능한 형태로 말하는 것을 축약 재진술한다(감사 B14 표 10행). 이 task는 `## Instruction layers` 표를 더하고, 그 헌장이 "스킬에만 있어야 한다"고 판정하는 하드룰 본문을 `Detail: <경로>` 포인터로 줄인다 — 하드룰 10이 이미 쓰고 있는 형식이 본보기다.

예산이 이 작업을 강제한다. `CLAUDE.md`는 6,127B이고 상한이 6,135B(`test/master-rules.test.js`)라 여유가 8바이트다. 표를 *더하는* 변경이므로 같은 커밋에서 회수하지 않으면 테스트가 먼저 막는다. 회수량 1순위는 하드룰 7(1,623B, 파일의 26.5%)이고, 그 내용은 plan·execute·run의 **Project root**·**Project Distill** 블록과 `skills/bouncer-finalize/references/distill-promotion.md`가 셸까지 붙여 이미 말하고 있다.

삭제는 단독 편집이 아니다. 룰 1·2·3·5·6·7·8·9·11이 `test/master-rules.test.js`의 문자열 단언에 묶여 있으므로, 본문을 줄이는 것과 그 단언을 실제 보유 파일로 옮기는 것이 **한 커밋**이다. 앵커를 약화시켜 통과시키는 것은 이 task의 실패다 — 같은 계약 문자열이 다른 파일에서 단언되어야 한다.

## Interface
- 제공:
  - `CLAUDE.md`에 `## Instruction layers` 절. 네 행 표 — 하드룰(`CLAUDE.md`) / 절차(`skills/*/SKILL.md`) / 계약(`rules/*.md`, `references/*/index.md`) / 이 저장소에서만 참인 것(`.bouncer/Distill.md`). 각 행은 담는 것·담지 않는 것·정본 위치를 가진다. `## When to invoke` 표는 이 헌장에서 "워크플로 진입 라우팅 인덱스"로 자리를 얻고 그대로 남는다.
  - 하드룰 7 본문을 `Detail:` 포인터 형태로 축약. **잔류 계약 셋은 남긴다** — Distill 정본이 `${PROJECT_ROOT}/.bouncer/Distill.md`이고 플러그인 루트·execute worktree cwd가 기준이 아니라는 것, finalize 승격이 동의 한 번을 받는다는 것, 그리고 aggregate/`--route` 출력을 개별 샤드 본문이나 쓰기 대상으로 붙이지 않는다는 것. 나머지는 plan/execute/run과 finalize 레퍼런스를 가리키는 포인터로 바꾼다.
  - B14 표의 나머지 행은 아래 처분표대로 다룬다. 룰 번호와 제목 줄은 그대로 둔다.
  - `test/master-rules.test.js`의 앵커 갱신: `CLAUDE.md`에서 사라진 계약 문자열마다 그 문자열을 실제로 담는 파일에 대한 단언을 세운다.
- 거부:
  - 하드룰 11(`Trust boundary`)의 번호·제목·본문 변경. 12곳 이상이 번호로 인용하고 `test/master-rules.test.js`가 이 룰을 신뢰 경계 SSOT로 못박는다.
  - 룰 번호 재배열. 자리는 두고 본문만 줄인다 — 인용 표면을 지키는 유일한 방법이다.
  - 앵커 단언의 삭제·약화(정규식 완화, `assert.ok(true)`, 스킵). 옮기는 것만 허용한다.
  - `## When to invoke` 표와 `## Plugin root` 절의 삭제. 각각 `test/master-rules.test.js`가 행 구조와 `bouncer-root --auto`·`BOUNCER_HOME`을 단언한다.
  - 상한 자체의 완화. 6,135B는 #80이 건 값이고 이 task의 입력이지 조정 대상이 아니다.

### B14 행별 처분
계획 시점에 앵커 보유 여부를 확인해 정한 값이다. 실행 중 판단으로 바꾸지 않는다.

| 행 | 처분 | 근거 |
| --- | --- | --- |
| 하드룰 1 후반 (루트 `context/` 비정규) | 삭제 | `skills/bouncer-init/SKILL.md`가 담고, `CLAUDE.md` 앵커가 없다 |
| 하드룰 3 (증거는 execute 게이트가 쓴다) | 축약, `execute gate` 문구 유지 | 앵커가 그 문구를 `CLAUDE.md`에서 요구한다 |
| 하드룰 5 후반 (plan은 `/bouncer-run`을 가리킨다) | 포인터화 | 순서 화살표·`/bouncer-commit`·`When to invoke` 행 앵커는 전반부와 표에 남는다 |
| 하드룰 7 | 잔류 계약 셋만 남기고 포인터화 | 회수량 1순위 |
| 하드룰 8 | **축약하지 않음** | 재진술이 아니라 유일 진술이다 — `.bouncer/context/epics/**` 본문이 한국어라는 범위 규칙을 다른 층이 말하지 않는다. `references/stop-slop/index.md`는 문체 지침이지 범위 규칙이 아니다 |
| 세션수칙 2·4 | 포인터화 | `CLAUDE.md` 앵커가 없다 |
| `## When to invoke` 표 | 유지 | blueprint Out of scope에 근거를 적었다 |

## Touch
- Modify `CLAUDE.md` — `## Instruction layers` 표를 더하고, B14 표가 지목한 하드룰·세션수칙 본문을 `Detail:` 포인터로 축약한다.
- Modify `test/master-rules.test.js` — `CLAUDE.md`에서 옮겨간 계약 문자열의 단언을 새 보유 파일 대상으로 갱신하고, 반복 `--for` 형식을 요구하는 파일 목록에서 `CLAUDE.md`를 뺀다.

## Do not touch
- `skills/` — 이 task는 마스터 룰에서 지우기만 한다. 스킬 본문에 문장을 옮겨 적을 필요가 없다(이미 더 구체적으로 있다). 스킬을 고쳐야 앵커가 성립한다면 그것은 "이미 말하고 있다"는 전제가 틀렸다는 뜻이므로 그 행을 축약 대상에서 제외한다.
- `references/` — 같은 이유.
- `rules/` — 같은 이유.
- `.bouncer/distill/core.md` — task 003 몫이다.
- `agents/` — task 003 몫이다.
- `scripts/` — 게이트 코드와 CLI 계약은 이 blueprint 밖이다.

## Constraints
- 최종 `CLAUDE.md`는 6,135 UTF-8 바이트 이하여야 한다. 검증은 `npm run ci`가 한다.
- `CLAUDE.md`는 한국어 본문 규칙(하드룰 8)의 적용 대상이 아니다 — 현행대로 영어를 유지한다. 한국어 대상은 `.bouncer/context/epics/**`와 BP `explain.md`다.
- 포인터 줄은 실재하는 경로만 가리킨다. 가리킨 파일이 그 계약을 실제로 담고 있어야 하며, 담고 있지 않으면 그 행은 축약하지 않는다.
- 하드룰 절에는 코드 펜스를 넣지 않는다(현행 테스트가 `## Session conduct` 앞 구간에 ``` 부재를 단언한다).
- `## Session conduct` 제목과 `## Plugin root` 절의 셸 블록은 유지한다.

## Checklist
- [ ] 현재 값을 기록한다: `wc -c CLAUDE.md`(6,127 예상)와 상한 위치.
- [ ] 감사 B14 표 10행 각각에 대해 "가리킬 파일이 그 계약을 실제로 담는가"를 확인하고, 담지 않는 행은 축약 대상에서 뺀다. 확인한 결과를 커밋 본문이 아니라 이 task의 구현 노트(코드 주석이 아닌 리뷰 보고)로 남긴다.
- [ ] `CLAUDE.md`에 `## Instruction layers` 표를 추가한다.
- [ ] 하드룰 7 본문을 포인터로 축약한다.
- [ ] 실패를 먼저 확인한다 — 이 시점에서 `node --test test/master-rules.test.js`가 최소한 아래 단언들로 실패해야 하며, 실패 이유가 "옮겨간 문자열이 `CLAUDE.md`에 없다"인지 확인한다.
```
distill --all / --preflight / --for
baseline / single-file fallback
audit.shards / content split / # <id> / id 집합 불일치 / 상대 경로
when the two id sets match ... spec-authoring
```
- [ ] 앵커를 옮긴다. 대상 매핑:
```
distill --all, --preflight, baseline, single-file fallback
  → skills/bouncer-plan/references/distill-preflight.md
--for 반복 형식
  → skills/bouncer-plan/SKILL.md, skills/bouncer-execute/SKILL.md,
    skills/bouncer-run/SKILL.md, .bouncer/distill/core.md  (CLAUDE.md는 목록에서 제외)
audit.shards, content split, # <id>, id 집합 불일치,
  when the two id sets match → spec-authoring, 상대 경로
  → skills/bouncer-finalize/references/distill-promotion.md

CLAUDE.md에 잔류 (이관하지 않음):
  finalize ... consent  — distill-promotion.md는 "finalize 뒤 260자 안 consent"
                          형태를 만족하지 않고, 만족시키려면 task 002 소유 파일을
                          이 task에서 고쳐야 한다
  aggregate|selection, never ... attach, --route
                        — test/master-rules.test.js가 finalize 번들에
                          `distill --route` 부재를 이미 단언한다. 그 문자열이
                          살 수 있는 파일이 없으므로 이 행은 축약하지 않는다
```
- [ ] 나머지 B14 행(하드룰 1 후반·3·5 후반·8, 세션수칙 2·4)을 같은 규칙으로 축약하고 각 앵커를 옮긴다.
- [ ] 하드룰 11의 번호·제목·본문이 그대로인지 확인한다 — `assert.strictEqual((claude.match(/^11\.\s+\*\*Trust boundary\*\*/gm) || []).length, 1)`가 그대로 통과해야 한다.
- [ ] 앵커 이관은 새 보유 파일에 `assert.match`를 세우는 것과 `CLAUDE.md`에 `assert.doesNotMatch`를 세우는 것을 함께 한다 — 옛 자리로 문장이 되돌아오는 것을 막는 쪽이 이관의 절반이다.
- [ ] `wc -c CLAUDE.md`가 6,135 이하인지 확인한다.
- [ ] `npm run ci`를 실행해 그린을 확인한다.
