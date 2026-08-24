---
type: bouncer.explain
title: 002 explain
description: Explain for 002
resource: .bouncer/context/epics/047-context-injection/blueprints/002-distill-shard-discipline/explain.md
tags:
  - bouncer
  - explain
timestamp: '2026-08-24T15:14:46.644+09:00'
bouncer:
  id: EXPLAIN-002
  epic_id: '047'
  blueprint_id: '002'
  status: published
  comprehension:
    - range_from: develop
      range_to: 063f9bb5a1a880166a44200ecf5a5ee445b114db
      diff_sha: 8da998f6ee2e796040a961cae8ee9d5af229e610342cff69a770238411ad3092
      quiz_score: '3/3'
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
