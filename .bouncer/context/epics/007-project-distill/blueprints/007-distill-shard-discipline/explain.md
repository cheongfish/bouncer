---
type: bouncer.explain
title: 002 explain
description: Explain for 002
resource: .bouncer/context/epics/007-project-distill/blueprints/007-distill-shard-discipline/explain.md
tags:
  - bouncer
  - explain
timestamp: '2026-08-24T15:14:46.644+09:00'
bouncer:
  id: EXPLAIN-007
  epic_id: '007'
  blueprint_id: '007'
  status: published
  comprehension:
    - range_from: develop
      range_to: 063f9bb5a1a880166a44200ecf5a5ee445b114db
      diff_sha: 8da998f6ee2e796040a961cae8ee9d5af229e610342cff69a770238411ad3092
      quiz_score: 3/3
      disposition: 기본값·stderr 관측·승격/plan 노출이 경고-정보 계약이라는 점을 바로 짚음
      recorded_at: '2026-08-24T15:16:36+09:00'
---
# Explain

## Background
`S26`은 Distill 샤드 바이트 상한 경고인데 기본 `max_bytes`가 64KB라서 이 저장소의 13KB짜리 `plugin-skills`도 걸리지 않았다. 승격 ACQ와 plan 프리플라이트에도 크기가 안 보여서 샤드가 커져도 사람이 볼 기회가 없었다.

이번 변경은 기본값을 6KB(6144)로 내리고, `distill --all`이 stderr에 샤드별·총합 바이트를 낸 뒤, finalize 승격 ACQ와 plan 프리플라이트 한 줄 보고에 그 관측을 붙인다. 초과는 경고·정보일 뿐 게이트나 자동 절삭이 아니다.

## Intuition
저울 눈금을 실제 짐 크기에 맞추고, 눈금이 넘친 짐만 계산대에 적어 두는 식이다. 짐 자체를 잘라 버리지 않는다.

## Code
- `scripts/src/lib/config.ts` — `DEFAULT_DISTILL_CONFIG.max_bytes = 6 * 1024`
- `scripts/src/lib/cli-project-commands.ts` — `--all` 전용 stderr 요약(`distill: <id> <bytes>`, `distill: total …`); `--for`/`--route`/`--audit`는 조용
- `skills/bouncer-finalize/SKILL.md` — 승격 ACQ에 stderr 상한 초과 목록 + `replace`/`drop`을 `add`보다 먼저 검토
- `skills/bouncer-plan/SKILL.md` — 프리플라이트 `--all` 직후 총량 한 줄 보고(샤드별 표 금지)
- 계약: `test/cli-project-commands.test.js`, `test/validate-structural.test.js`(기본값 경로 S26), `test/skill-bouncer-*.test.js`

이 저장소 `.bouncer/config.json`은 `max_bytes: 65536`을 명시하므로 기본값 변경의 영향을 받지 않는다. 기본값 경로는 테스트 픽스처로만 판정한다.

## Quiz
1. 기본 `max_bytes`를 6144로 둔 직접 이유는?
   - A) 라우팅이 큰 샤드를 잘라 쓰게 하려고
   - B) `S26`이 실제 샤드 크기(약 6–13KB)에서 경고를 내게 하려고
   - C) `init`이 기존 `config.json`의 `max_bytes`를 덮어쓰게 하려고

2. `distill --all`의 크기 요약은 어디에 나가며, `--audit`에서는?
   - A) stderr — `--audit`는 요약을 내지 않는다(`audit.err === ''` 계약)
   - B) stdout — `--audit`에도 같은 요약을 붙인다
   - C) JSON `audit.shards` 필드 — 바이트가 페이로드에 실린다

3. finalize 승격 ACQ에서 상한 초과 샤드를 보여 주는 뜻은?
   - A) 정보로만 보여 주고, 초과 대상은 `add`보다 `replace`/`drop`을 먼저 검토한다
   - B) 초과면 승격을 자동 거절하고 샤드를 분할한다
   - C) plan·finalize 게이트를 실패시켜 마감을 막는다

## 이해 상태
- 정답: 1B, 2A, 3A
- 응답: 1B, 2A, 3A
- 채점: 3/3 정답
- disposition: 기본값·stderr 관측·승격/plan 노출이 경고-정보 계약이라는 점을 바로 짚음
- quiz_score: 3/3 · range develop..063f9bb5a1a880166a44200ecf5a5ee445b114db

## Tasks

### Task 001

#### Goal & intent

`DEFAULT_DISTILL_CONFIG.max_bytes`를 64KB에서 6KB(6144)로 낮추고, `bouncer distill --all`이 stderr에 샤드별 바이트와 총합을 한 줄로 낸다. 상한 검사 `S26`은 이미 `validate-structural.ts`에 있으나 기본 기준이 실제 샤드보다 5배 커서 아무것도 걸리지 않았다.

기준값 근거: 이 저장소의 영문 샤드는 대략 7.1 바이트/단어다. 6144 바이트는 ≈865 단어에 해당하고, 현재 샤드 분포에서 `plugin-skills`(13,445)·`validate-gates`(8,877)를 걸고 `core`(5,842)를 통과시킨다. 이 저장소 자신은 `.bouncer/config.json`에 `max_bytes: 65536`을 명시하고 있어 기본값 변경의 영향을 받지 않는다 — 테스트는 기본값 경로 픽스처로 판정한다.

stdout은 파이프 청결을 유지한다 — 크기 관측은 Distill route 진단과 같이 stderr로 간다.

#### Interface

- 제공: `DEFAULT_DISTILL_CONFIG.max_bytes`가 `6 * 1024`다. `config.example.json`과 `docs/configuration.md`의 기본값 표기가 같이 바뀐다.
- 제공: `bouncer distill --all`이 stderr에 `distill: <id> <bytes>` 샤드별 줄과 `distill: total <bytes> bytes across <n> shards` 총합 줄을 낸다. 초과 샤드에는 같은 줄에 기준 초과 표시를 붙인다.
- 거부: stdout 본문은 한 바이트도 바뀌지 않는다. 요약은 stderr 전용이다.
- 거부: `--for` / `--route` / `--audit` 모드에서는 요약을 내지 않는다. 라우팅 출력에 붙이면 선택 결과를 총량으로 오해하게 되고, `--audit`은 `test/cli-project-commands.test.js:141`이 `audit.err === ''`를 고정하고 있다. 요약은 `--all` 전용이다.
- 거부: 초과를 이유로 본문을 자르거나 샤드를 빼지 않는다. `max_bytes`는 경고 기준이고 하드 상한이 아니다.
- 거부: 기존 소비자 `config.json`의 `max_bytes` 값을 다시 쓰지 않는다.

#### Touch

- Modify `scripts/src/lib/config.ts` — `DEFAULT_DISTILL_CONFIG.max_bytes`를 `6 * 1024`로, 근거 주석을 갱신
- Modify `scripts/src/lib/cli-project-commands.ts` — `--all` 경로에서 `CliIo.err`로 샤드별·총합 요약을 낸다
- Modify `scripts/lib/config.js` — `npm run build` CJS emit
- Modify `scripts/lib/cli-project-commands.js` — 같은 emit
- Modify `config.example.json` — `distill.max_bytes`를 `6144`로
- Modify `docs/configuration.md` — 기본값 표기와 §설명을 갱신
- Modify `test/init.test.js` — `:49`·`:95`·`:118`이 `init`이 쓰는 `max_bytes: 65536`을 고정한다. 기본값을 낮추면 세 단언이 함께 걸린다 (`:488`은 스스로 쓴 픽스처라 그대로다)
- Modify `test/cli-project-commands.test.js` — `--all` stderr 요약과 stdout 불변을 단언
- Modify `test/validate-structural.test.js` — 기존 S26 픽스처는 `maxBytes: 1`을 명시해 기본값에 둔감하다. **기본값 경로** 픽스처를 새로 추가해 6144 기준의 걸림/통과를 판정한다
- Modify `test/distill.test.js` — 같은 이유로 S26 픽스처 확인

#### Constraints

- stdout 계약은 불변이다. 기존 `--all` stdout을 바이트 단위로 비교하는 테스트가 있으면 그대로 통과해야 한다.
- `S26` 코드 번호와 메시지 형식을 바꾸지 않는다.
- 단일 파일 폴백(샤드 인덱스 부재·무효)에서는 샤드별 목록 없이 `distill: total <bytes> bytes (single-file)` 한 줄만 낸다 — `across 0 shards`처럼 샤드 수를 0으로 적지 않는다.
- 새 런타임 의존성이나 새 CLI 플래그를 넣지 않는다.
- 코드 주석은 한국어를 유지하고, 6144라는 숫자의 근거(바이트/단어 환산과 현재 샤드 분포)를 주석에 남긴다.

### Task 002

#### Goal & intent

task 001이 만든 관측값을 사람이 결정하는 두 지점에 붙인다. `/bouncer-finalize` step 1의 승격 ACQ가 상한 초과 샤드를 목록에 함께 보여주고(입력은 같은 step이 이미 돌리는 `distill --all --json` 호출의 stderr 요약이다), `/bouncer-plan`이 프리플라이트 직후 총량을 한 줄로 보고한다.

자동 절삭을 하지 않는 이유는 명시한다 — 샤드를 줄이는 판단이 잘못되면 다음 사이클이 그 규칙을 재발견해야 하므로, 초과는 정보이지 강제가 아니다. 승격 시 `add`보다 `replace`/`drop`을 먼저 검토하라는 규율도 같은 자리에 적는다. `spec-authoring`은 이미 「Decisions는 current 유효 선택이며 타임라인을 덧붙이지 않는다」를 규정하고 있으므로 새 규칙이 아니라 집행 강화다.

#### Interface

- 제공: ACQ에 올릴 초과 정보의 출처는 task 001이 `bouncer distill --all`의 **stderr**에 내는 요약이다. step 1은 이미 `distill --all --json`을 돌리므로 같은 호출의 stderr를 읽으면 되고, `audit.shards` 페이로드에는 바이트 크기가 없다(`id`·`path`·`always`·`pathsKnown`·`pullsKnown`·`paths`·`pulls`만 투영된다).
- 제공: `skills/bouncer-finalize/SKILL.md` step 1의 단일 ACQ 목록에 상한 초과 샤드가 표시되고, 초과 샤드를 대상으로 하는 제안은 `add`보다 `replace`/`drop`을 먼저 검토한다는 문장이 붙는다.
- 제공: `skills/bouncer-plan/SKILL.md`의 Project Distill 프리플라이트 절에, `--all` 직후 총량을 한 줄로 사용자에게 보고한다는 지시가 생긴다.
- 거부: ACQ 선택지 구조(approve / 일부 / 거절 세 가지)와 「한 번만, 목록 전체에 대해」 계약을 바꾸지 않는다.
- 거부: 초과를 게이트로 만들지 않는다. 초과 샤드가 있어도 plan·finalize 게이트는 통과한다.
- 거부: 초과를 이유로 승격을 자동 거절하거나 샤드를 자동 분할하지 않는다.

#### Touch

- Modify `skills/bouncer-finalize/SKILL.md` — step 1 승격 ACQ에 초과 노출과 `replace`/`drop` 우선 검토 문장을 넣는다
- Modify `skills/bouncer-plan/SKILL.md` — Project Distill 절에 총량 한 줄 보고 지시를 넣는다
- Modify `test/skill-bouncer-finalize.test.js` — 초과 노출과 우선 검토 문구를 계약으로 고정한다
- Modify `test/skill-bouncer-plan.test.js` — 총량 보고 지시를 계약으로 고정한다
- Modify `docs/configuration.md` — `max_bytes` 초과가 어디에 보이는지 한 문장 덧붙인다

#### Constraints

- 규칙 본문은 각 워크플로 스킬 한 곳에만 둔다. 마스터 규칙에 복제하지 않는다.
- `/bouncer-plan`의 보고는 한 줄이다. 샤드별 표를 세션에 출력하지 않는다 — 그 자체가 주입이 된다.
- 계약 테스트는 긍정 매치로 고정한다.
- 공개 문자열은 한국어를 유지한다.
