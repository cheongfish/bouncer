---
type: bouncer.explain
title: 001 explain
description: Explain for 001
resource: .bouncer/context/epics/018-task-unit-commits/blueprints/019-promotion-verify/explain.md
tags:
  - bouncer
  - explain
timestamp: '2026-08-22T15:59:41.606+09:00'
bouncer:
  id: EXPLAIN-019
  epic_id: '018'
  blueprint_id: '019'
  status: published
  comprehension:
    - range_from: develop
      range_to: 0b922fac3f74a952241dffdb2e1153648883b743
      diff_sha: 6166ee859939b32faba0be1ddbf1dd52fe1971b088c27ee2a960dd8a9f548c47
      quiz_score: '0/3'
      disposition: >-
        세 문항 모두 틀렸다. 감사는 샤드 파일을 직접 읽고, finalize 검증은
        잠금 앞이며, 미달은 표본에서 빼지 않고 먼저 보고한다.
      recorded_at: '2026-08-22T16:06:13+09:00'
---
# Explain

## Background
Distill 승격 커밋은 execute 게이트 밖에 있어서 `config.verify`를 한 번도 거치지
않았다. 그 검증을 붙이려 해도 `test/distill.test.js`가 불릿 해시를 상수 목록으로
고정해 두어, 샤드 본문이 늘 때마다 CI가 먼저 깨졌다. 043/002 마감이 그 목록을
손으로 고친 커밋(`1937355`)으로 복구했다.

이 변경은 감사를 샤드 파일에서 유도하게 바꾸고, `finalize --yes`가 잠금·스테이징
전에 검증 명령을 실행하게 하며, 다음 회차 측정이 plan-gate 시점 줄 수와 표본
조항 순서를 `docs/benchmark/protocol.md`만 읽고 따르게 한다.

## Intuition
승격 커밋도 다른 커밋처럼 검증을 통과해야 하고, 그 검증은 승격분이 자기 자신을
깨면 안 된다. 측정은 사이클 끝 줄 수가 아니라 plan 게이트를 막 통과한 트리를
남겨야 100줄 목표를 직접 잰다.

## Code
- `test/distill.test.js` — `ORIGINAL_BULLET_HASHES`를 지우고
  `.bouncer/Distill.md`의 `distill.shards` 순서로 샤드 본문을 `readDoc`한 뒤
  `bulletHashes`로 기대값을 만든다. 렌더·라우팅 비활성 선택과 대조하고, 유도
  집합이 비지 않았는지(`length > 100`)와 샤드 하나를 빼면 어긋나는지를 단언한다.
  본문 손실은 양쪽이 같이 줄어 이 감사가 잡지 않는다.
- `scripts/src/lib/finalize.ts` — out-of-scope 통과 후 `staged`를 계산하고,
  `--yes`이며 스테이징 대상이 있을 때만 `readVerifyCommand` /
  `executeVerify`를 돌린다. 실패는 `{ ok: false, reason: 'verify', code,
  command, exitCode }`. `writeClosedLock`은 검증 성공 뒤에 둔다. dry-run과
  빈 커밋 경로는 검증을 건너뛴다. 무효 `bouncer.verify`는 구조 검사 S12가
  `readVerifyCommand`보다 먼저 막아 `reason: 'validate'`로 끝난다.
- `skills/bouncer-finalize/SKILL.md`, `docs/cli.md`,
  `docs/troubleshooting.md` — `--yes`가 스테이징 전 검증을 돌리고
  `reason: 'verify'`에는 우회가 없다고 적는다.
- `docs/benchmark/protocol.md` — 「plan 단계 스냅샷」은
  `validate --gate plan` 직후 트리를 clone 밖
  `docs/benchmark/round-<N>/plan-snapshots/<run>/`에 복사한다. 「표본 제외와
  실패 보고」는 미달을 먼저 보고하고, 표본 제외는 프로토콜 위반에만 쓴다.

## Quiz
1. Distill 불릿 감사가 기대 해시를 얻는 방식은?
   - (a) `renderShards` 출력에서 다시 `bulletHashes`를 뽑아 자기 자신과 비교한다
   - (b) 샤드 파일을 `readDoc`으로 읽어 본문을 `bulletHashes`에 넘긴다
   - (c) `ORIGINAL_BULLET_HASHES` 상수를 승격마다 손으로 고친다

2. `bouncer finalize --yes`가 검증 명령을 실행하는 시점은?
   - (a) `writeClosedLock`으로 blueprint를 닫은 직후, 스테이징 전
   - (b) dry-run 보고를 만들기 전, out-of-scope 검사보다 앞
   - (c) out-of-scope 검사와 `staged` 계산 뒤, `writeClosedLock`·`stage` 앞

3. 측정 프로토콜에서 목표 미달과 표본 제외의 순서는?
   - (a) 미달은 미달로 보고하고, 표본 제외는 프로토콜 위반에만 적용한다
   - (b) 목표가 안 나온 런은 표본에서 빼서 성공률을 유지한다
   - (c) 심사자가 판단해서 둘 중 하나를 고른다

## 이해 상태
점수 `0/3`. 정답은 1-b, 2-c, 3-a. 응답은 1-a, 2-a, 3-b. 세 문항 모두 틀림.
감사는 `renderShards` 자기 비교가 아니라 샤드 파일을 `readDoc`으로 읽는다.
`--yes` 검증은 out-of-scope와 `staged` 계산 뒤, `writeClosedLock`·`stage` 앞이다.
목표 미달은 미달로 보고하고 표본 제외는 프로토콜 위반에만 쓴다.
