---
type: bouncer.tasks
title: 지시문 비용 측정 계약 문서 추가
description: 회귀 시나리오 7종과 정적·실행 지표 수집 명령을 docs/benchmark/context-cost.md에 고정한다
resource: .bouncer/context/epics/054-skill-context-optimization/blueprints/001-baseline-measurement/tasks/001/tasks.md
tags:
  - bouncer
  - tasks
timestamp: '2026-08-26T14:53:09.105+09:00'
bouncer:
  id: TASKS-001
  epic_id: '054'
  blueprint_id: '001'
  status: verified
  verify: npm run ci
  commit_intent:
    - 구조 변경 전후를 같은 기준으로 비교할 시나리오와 지표 수집 명령이 어디에도 없었음
    - 최악값 추정이 아니라 실측으로 재구조화 규모를 정하려 함
  affected_paths:
    - docs/benchmark/context-cost.md
    - docs/benchmark/protocol.md
    - test/benchmark-context-cost.test.js
  scope_evidence:
    producer: graphify
    generated_at: '2026-08-26T15:05:00.000+09:00'
    suggested_paths:
      - test
      - .bouncer/context/epics/054-skill-context-optimization/blueprints/001-baseline-measurement
    basis:
      - graph: source
        status: reused
        query: 'benchmark context cost measurement docs protocol history static metrics scenarios'
        result: '18 nodes; hits roll up to test/ only (skill-agentic-code-benchmark.test.js, validate-gates.test.js, finalize-pure.test.js). config.source_dirs is scripts/hooks/test so docs/ cannot be suggested.'
      - graph: context
        status: updated
        query: 'benchmark context cost measurement docs protocol history static metrics scenarios'
        result: '9 nodes; hits are this blueprint plus epic 052 deepswe-run-plumbing plan docs — self and adjacent-plan noise, no new scope.'
---
# Tasks

Blueprint: [001](../../index.md)

## Goal & intent
`docs/benchmark/context-cost.md`가 생겨서, 이후 누구든 같은 명령으로 Bouncer 지시문 비용의 정적 지표를 뽑고 같은 7개 시나리오로 실행 지표를 재현할 수 있다. 이 문서가 epic 054의 baseline과 최종 회차가 공유하는 측정 계약이다. 다섯 정적 지표는 epic 성공 조건 1·5·6이 남긴 흔적을 재는 것이지 조건 2·3·4까지 대신 판정하지 않는다 — 그 셋은 리뷰가 문서를 읽고 본다. 수치는 이 task에서 적지 않는다 — 계약과 그 계약을 고정하는 테스트만 만든다.

## Interface
- 제공:
  - `docs/benchmark/context-cost.md` — `## 회귀 시나리오`(7행 표: id, 실행 조건, 진입 스킬), `## 정적 지표`(5개 항목, 각각 명령 코드펜스), `## 런당 기록 값`, `## Baseline`(task 002·003이 채울 빈 표) 네 절.
  - 시나리오 id 7개: `s1-light-cycle`, `s2-full-plan`, `s3-verify-recovery`, `s4-review-roundtrip`, `s5-finalize-distill`, `s6-finalize-bare`, `s7-run-multitask`.
  - `docs/benchmark/protocol.md`에 이 문서를 가리키는 한 줄.
  - `test/benchmark-context-cost.test.js` — 위 네 절과 시나리오 id 7개의 존재를 단정. id는 백틱으로 감싼 형태(`` `s1-light-cycle` ``)로 단정해 산문에 우연히 섞인 부분 문자열이 통과하지 않게 한다.
- 거부:
  - 새 수집 스크립트·새 npm 의존성·새 메트릭 스키마 키. 실행 지표는 `collect_metrics.py`의 기존 `usage` 키만 쓴다.
  - 이 task에서의 수치 기입. `## Baseline` 표는 헤더만 두고 행은 비운다.
  - `docs/benchmark/history.md`의 1–3회차 행과 DeepSWE 절 수정.

## Touch
- Create `docs/benchmark/context-cost.md` — 시나리오 7종, 정적 지표 5종과 명령, 런당 기록 값, 빈 Baseline 표.
- Modify `docs/benchmark/protocol.md` — 지시문 비용 측정이 `context-cost.md`에 있다는 링크 한 줄을 문서 앞부분에 추가.
- Create `test/benchmark-context-cost.test.js` — 문서의 네 필수 절과 시나리오 id 7개를 리터럴로 단정.

## Do not touch
- `skills/agentic-code-benchmark` — 루브릭·점수·arm 정의는 이 epic 밖이다.
- `docs/benchmark/history.md` — 실행 회차 기록은 blueprint 006 소관이다.
- `docs/benchmark/deepswe` — 별도 스위트이고 열이 다르다.
- `skills/bouncer-plan` — 구조 변경은 blueprint 002 이후다.
- `agents` — 역할별 정본화는 blueprint 002 소관이다.
- `rules` — 반복 규칙 공통화는 blueprint 004 소관이다.

## Constraints
- 명령은 저장소 루트에서 그대로 붙여넣어 실행되는 형태로 적는다. `cd` 접두나 설명 대체 문구를 쓰지 않는다.
- 정적 지표는 저장소가 이미 쓰는 도구(`wc`, `awk`, `grep`, `sort`)로만 뽑는다. 새 스크립트를 만들지 않는다.
- 시나리오 정의는 `docs/benchmark/protocol.md`의 「공통 통제」와 「plan 단계 스냅샷」을 링크로 인용하고 문장을 복제하지 않는다.
- 문서 본문 산문은 한국어, 명령·경로·시나리오 id는 원문 그대로 둔다.
- 테스트는 `node:test`와 `node:assert`만 쓴다. 새 러너나 의존성을 넣지 않는다.
- `docs/benchmark/context-cost.md`에 `superpowers` 리터럴을 적지 않는다. `test/public-name-regression.test.js`의 `SUPERPOWERS_RE`가 그 이름 하나만 스캔하고 `COMPARISON_ARM_ALLOWLIST`가 예외 파일을 열거하는데, 새 문서는 그 목록에 없다. 커밋 전에는 untracked라 스캔에서 빠지므로 파일이 추적되는 커밋 직후에야 깨진다. 7개 시나리오는 모두 Bouncer 사이클 하나라 그 이름이 필요 없고, 언급이 필요하면 `protocol.md` 링크로 대신한다. `vanilla`·`bouncer`는 이 스캔 대상이 아니라 제약이 없다.

## Checklist
- [ ] `test/benchmark-context-cost.test.js`를 먼저 만든다. 문서를 읽어 네 절 제목이 모두 있고 시나리오 id 7개가 모두 등장하는지 단정한다.

      ```js
      const HEADINGS = ['## 회귀 시나리오', '## 정적 지표', '## 런당 기록 값', '## Baseline'];
      const IDS = ['s1-light-cycle', 's2-full-plan', 's3-verify-recovery', 's4-review-roundtrip',
                   's5-finalize-distill', 's6-finalize-bare', 's7-run-multitask'];
      // 백틱으로 감싼 형태만 인정한다: `${id}`
      ```

- [ ] `npm test`로 그 테스트가 실패하는 것을 확인한다.
- [ ] `docs/benchmark/context-cost.md`를 만들고 `## 회귀 시나리오` 표에 7행을 적는다. 각 행은 id, 실행 조건 한 줄, 진입 스킬이다. `s3-verify-recovery`와 `s4-review-roundtrip` 행에는 named agent fallback 경로를 직접 때린다고 적는다.
- [ ] `## 정적 지표`에 다섯 항목과 각각의 명령을 코드펜스로 적는다. 명령은 아래를 그대로 쓴다.

      ```bash
      # 1. description 총 문자 수
      awk '/^description:/ { sub(/^description:[[:space:]]*/, ""); s += length($0) } END { print s+0 }' skills/*/SKILL.md
      # 2. 진입 SKILL.md별 단어 수
      wc -w skills/*/SKILL.md | sort -rn
      # 3. 역할별 rubric 문서 쌍의 단어 수 (목표: 스킬 쪽이 호출 계약만 남아 축소)
      wc -w skills/implementation/SKILL.md agents/bouncer-implementer.md
      wc -w skills/review/SKILL.md agents/bouncer-reviewer.md
      wc -w skills/debugging/SKILL.md agents/bouncer-debugger.md
      wc -w skills/context-review/SKILL.md agents/bouncer-context-reviewer.md
      # 4. BOUNCER_ROOT 해석 블록을 품은 스킬 수
      grep -l 'bouncer-root --auto' skills/*/SKILL.md | wc -l
      # 5. 측정 시점 스킬 수 (모수)
      ls skills/*/SKILL.md | wc -l
      ```

- [ ] `## 런당 기록 값`에 `tokens_in`·`tokens_out`·`wall_s`·`tool_calls`·gate 통과율·review finding 수·scope 위반 수를 적는다. 앞 넷은 `collect_metrics.py`의 기존 `usage` 키이고, 플래그를 주지 않은 값은 0이 아니라 빈칸으로 남긴다고 명시한다. `.benchmarks/`는 `.gitignore` 대상이라 산출물이 저장소에 남지 않으므로, 각 행에 산출물 경로와 함께 그 값이 재계산이 아니라 전사(transcription)라는 점을 적는다고 명시한다.
- [ ] `## Baseline`에 헤더만 있는 빈 표 두 개를 둔다. 정적 표는 task 002가 채우고, 실행 표는 blueprint 006이 채운다고 표 위에 한 줄로 적는다.
- [ ] `docs/benchmark/protocol.md` 앞부분에 `context-cost.md` 링크 한 줄을 넣는다.
- [ ] `npm test`가 통과하는 것을 확인한다.
- [ ] `npm run ci`가 통과한다.
