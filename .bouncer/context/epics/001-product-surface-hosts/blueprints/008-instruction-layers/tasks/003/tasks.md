---
type: bouncer.tasks
title: core.md 재진술 네 문장을 지우고 minimality 사다리를 정본으로 정합
description: always 샤드인 core.md에서 상위 층이 이미 말하는 네 문장을 지우고, 정본 선언대로 implementer 에이전트와 minimality 스킬의 사다리 순서·scale 매핑을 맞춘다
resource: .bouncer/context/epics/001-product-surface-hosts/blueprints/008-instruction-layers/tasks/003/tasks.md
tags:
  - bouncer
  - tasks
timestamp: '2026-08-31T08:39:18.988+09:00'
bouncer:
  id: TASKS-003
  epic_id: '001'
  blueprint_id: '008'
  status: verified
  verify: npm run ci
  commit_intent:
    - always 샤드인 core.md가 마스터 룰과 계약 문서를 네 문장 그대로 다시 말해 모든 사이클에 중복이 실림
    - 그중 한 문장이 사실과 다른 minimality 정본 주장이라, 갈라진 사다리를 선언된 정본대로 맞추고 문장을 고침
  affected_paths:
    - .bouncer/distill/core.md
    - agents/bouncer-implementer.md
    - test/skill-minimality.test.js
    - test/agents.test.js
  scope_evidence:
    producer: graphify
    generated_at: '2026-08-31T08:39:18.988+09:00'
    suggested_paths:
      - test
    basis:
      - graph: source
        status: reused
        query: minimality ladder implementer agent core.md shard
        result: test/ 아래 사다리·에이전트 문구 단언 군집 (skill-minimality.test.js)
      - graph: context
        status: updated
        query: minimality ladder implementer agent core.md shard
        result: .bouncer/context/epics/059-audit-followup/blueprints/002-instruction-layers/tasks/<NNN>/tasks.md 신규 문서만 히트 — 계획 문서 자체이므로 경로 후보로 쓰지 않음
---

# Tasks

Blueprint: [008](../../index.md)

## Goal & intent
`.bouncer/distill/core.md`는 `always: true` 샤드라 모든 라우트·모든 사이클에 무조건 실린다. 그 안에 상위 층이 이미 말하는 네 문장이 그대로 있다 — 워크플로 순서(하드룰 5), 정본 문서 위치(하드룰 1), 활성 포인터 표면(`rules/current-pointer.md`), 그리고 minimality 정본 주장(`references/minimality/index.md`). Distill 층은 "이 저장소에서만 참인 것"을 담는 자리이므로 이 넷은 층을 잘못 앉은 문장이다.

네 번째 문장은 중복일 뿐 아니라 **사실이 아니다**. `Minimality lives only in the minimality skill`이라고 적혀 있지만, `references/implementation/index.md`가 정본을 `agents/bouncer-implementer.md`로 지목하고 사다리가 실제로 거기 인라인으로 있다. 두 벌은 이미 갈라졌다 — 스킬은 7단(YAGNI 포함, native → stdlib), 에이전트는 6단(YAGNI 없음, stdlib → native). YAGNI 단의 부재는 의도로 읽힌다(구현 단계에서 승인된 브리프를 줄이면 안 된다). **순서가 뒤집힌 것은 의도로 보이지 않는다.** 게다가 스킬의 Intensity 절이 `bouncer.scale: light`에서 1–4단만 적용하라고 정하는데, `agents/bouncer-implementer.md`에는 `scale`도 `light`도 0회 등장한다 — 구현 경로에 그 매핑의 소비자가 없다.

이 task는 헌장을 새로 정하지 않는다. 이미 선언된 정본을 이행할 뿐이다.

## Interface
- 제공:
  - `.bouncer/distill/core.md`에서 상위 층 재진술 **절(clause)** 제거. 대상 넷은 각각 더 긴 불릿 안에 있으므로 불릿 통째로 지우지 않는다 — 아래 Checklist의 절 단위 표가 무엇이 지워지고 무엇이 남는지 정한다.
  - `agents/bouncer-implementer.md` 사다리의 네이티브 플랫폼·표준 라이브러리 순서를 `references/minimality/index.md`와 같은 순서(native → stdlib)로 맞춘다.
  - 두 문서의 단 수 차이(7단 대 6단)에 대한 명시적 근거 한 줄 — YAGNI 단이 구현 경로에 없는 것은 의도이며, 승인된 브리프를 구현에서 줄이지 않기 때문이라는 진술을 에이전트 문서에 남긴다.
  - `bouncer.scale` Intensity 매핑에 대한 결정: **아무것도 더하지 않는다.** `references/minimality/index.md`의 Intensity 절이 이미 "This mapping is a skill judgment criterion — not a gate and not a CLI path"라고 적고, `docs/ARCHITECTURE.md` §E가 같은 것을 기록한다. 매핑의 소비자는 계획·리뷰 판정이고 구현 경로에는 없다는 것이 결정이며, 새 문장을 더하면 이 blueprint가 지우려는 재진술을 하나 만드는 것이다.
- 거부:
  - `.bouncer/distill/core.md`의 Distill SSOT 결정 문장 삭제. `test/master-rules.test.js`가 이 파일에 반복 `--for` 형식을 요구한다.
  - `core.md`에서 이 저장소에만 참인 문장 삭제 — 라우팅 활성화 조건, `always`-only `core`, stderr 규약, `distill.max_bytes` 경고 전용, 넓은 디렉터리 `affected_paths`의 G12 함정, `git ls-files` 미추적 파일 함정, Distill SSOT 결정, 그리고 대상 불릿 안에 함께 있는 저장소 고유 절(포인터 파일 경로와 JSON 형태, G16 차단 조건, confirm-then `--set` 인계). 이 문장들은 Distill 층에 올바로 앉아 있다.
  - 사다리 단 수를 억지로 맞추는 것. 7단과 6단의 차이는 YAGNI 하나이고 그 부재는 의도다 — 에이전트에 YAGNI 단을 넣지 않는다.
  - `references/minimality/index.md`의 7단 순서·번호 변경. `test/skill-minimality.test.js`가 native와 stdlib이 서로 다른 단 번호를 갖는지 단언하고, `docs/ARCHITECTURE.md` §E가 7단을 기록한다.
  - `scripts/`가 이 매핑을 읽게 만드는 것. 현행 진술("`scripts/`는 이 매핑을 읽지 않는다")을 유지한다.

## Touch
- Modify `.bouncer/distill/core.md` — 상위 층 재진술 네 문장을 제거한다.
- Modify `agents/bouncer-implementer.md` — 사다리 2·3단 순서를 스킬과 맞추고, YAGNI 부재 근거와 `bouncer.scale` 관련 진술을 적는다.
- Modify `test/skill-minimality.test.js` — 에이전트 사다리의 native/stdlib 순서가 스킬과 일치하는지 단언한다.
- Modify `test/agents.test.js` — 에이전트 사다리를 읽는 기존 단언(`/[Ss]tandard library|stdlib/i`)이 순서까지 잡도록 조인다.

## Do not touch
- `docs/ARCHITECTURE.md` — §E의 7단·`bouncer.scale` 기록은 스킬 사다리에 대한 것이고 이 task는 스킬 사다리를 바꾸지 않는다.
- `references/minimality/index.md` — 7단 사다리와 Intensity 절은 이 task의 기준이지 변경 대상이 아니다. 매핑 소비자에 대한 진술이 이미 있으므로 문장을 더하지 않는다.
- `references/implementation/index.md` — implementer 에이전트 문서를 사다리 정본으로 지목하는 선언은 이 task의 입력이지 변경 대상이 아니다.
- `CLAUDE.md` — task 001 몫이다.
- `skills/bouncer-finalize/references/distill-promotion.md` — task 002 몫이다.
- `scripts/` — 게이트 코드와 CLI 계약은 이 blueprint 밖이다.

## Constraints
- `.bouncer/distill/core.md`는 영어 에이전트 런타임이다(하드룰 8). 남는 문장도 영어를 유지한다.
- 샤드 프론트매터(`distill.id`, `always`, `pulls`)와 `## Invariants` / `## Gotchas` / `## Decisions` 절 구조를 유지한다.
- 문장 삭제 후 `node scripts/bouncer distill --all`이 여전히 8샤드를 렌더하고 `core`가 `always`-only여야 한다.
- 사다리 정합은 순서만 바꾼다. 각 단의 문구와 "첫 번째로 성립하는 단에서 멈춘다"는 규칙은 그대로 둔다.
- 에이전트 문서의 Authority·Hard guards·Scope·Output contract 절은 건드리지 않는다.
- `test/distill.test.js`가 실제 샤드에 `core: 4096` 바이트와 합계 상한을 건다(현재 `core.md` 4,079B, 합계 30,993B). 이 task는 지우기만 하므로 두 값 모두 내려간다 — 상한을 조정하지 않는다.

## Checklist
- [ ] `.bouncer/distill/core.md`에서 절 단위로 지운다. 각 행의 "남긴다"는 상위 층에 보유 파일이 없어서 Distill 층이 유일한 자리인 절이다:
```
불릿                    지운다                              남긴다
Invariants/canonical    canonical docs live only under      (불릿 전체가 재진술 → 통째 삭제)
                        .bouncer/context/  → 하드룰 1
Invariants/pointer      active pointer surface is           <git-common-dir>/bouncer/current 경로,
                        bouncer current   → rules/          { blueprint, task?, base } JSON 형태,
                        current-pointer.md                  current.task.path 브리프 규칙
Decisions/workflow      workflow order is init → … →        G16 차단 조건, confirm-then --set 인계,
                        finalize  → 하드룰 5 / 각 SKILL     one execute worktree 재사용
Decisions/minimality    lives only in the minimality        scripts/ does not read this mapping
                        skill (seven rungs …)               (이 절이 매핑 소비자 부재의 유일한 진술이다)
```
- [ ] 남긴 절만으로 문장이 성립하도록 다듬고, Distill SSOT 결정 문장과 이 저장소 고유 문장이 남아 있는지 확인한다.
- [ ] `Decisions/minimality` 불릿에 남는 문장이 정본을 잘못 지목하지 않는지 확인한다 — `only in the minimality skill`이라는 주장은 `references/implementation/index.md`의 정본 선언과 모순이므로 사라져야 한다.
- [ ] 지운 네 문장이 `core.md`로 되돌아오지 않도록 `test/master-rules.test.js`가 아닌 이 task의 테스트에서 `doesNotMatch`를 세울지 판단하고, 세우지 않기로 하면 그 근거를 리뷰 보고에 남긴다.
- [ ] `node scripts/bouncer distill --all`이 8샤드를 렌더하고 `core` 본문에 반복 `--for` 형식이 남아 있는지 확인한다.
- [ ] 실패 테스트를 먼저 쓴다 — `test/skill-minimality.test.js`에 에이전트 사다리에서 native가 stdlib보다 앞 단 번호인지 단언하는 테스트를 추가하고 실패를 확인한다.
- [ ] `agents/bouncer-implementer.md` §Procedure 1의 2단과 3단을 맞바꾼다. 결과 순서:
```
1. 이 코드베이스에 이미 있나
2. 네이티브 플랫폼
3. 표준 라이브러리
4. 설치된 의존성
5. 한 줄로 되나
6. 최소 새 코드
```
- [ ] YAGNI 단이 구현 경로에 없는 이유를 에이전트 문서에 한 줄로 적는다.
- [ ] `bouncer.scale` Intensity 매핑의 소비자를 한 곳에 명시한다 — 스킬 전용임을 `references/minimality/index.md`에 적거나, 에이전트가 매핑을 읽도록 배선한다. 고른 쪽과 그 이유를 리뷰 보고에 남긴다.
- [ ] `test/agents.test.js`의 사다리 단언을 순서까지 잡도록 조이고, 조인 단언이 정합 전 코드에서 실패하는지 확인한다.
- [ ] `npm run ci`를 실행해 그린을 확인한다.
