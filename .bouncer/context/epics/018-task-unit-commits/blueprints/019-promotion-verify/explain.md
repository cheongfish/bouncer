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
      quiz_score: 0/3
      disposition: 세 문항 모두 틀렸다. 감사는 샤드 파일을 직접 읽고, finalize 검증은 잠금 앞이며, 미달은 표본에서 빼지 않고 먼저 보고한다.
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

## Tasks

### Task 001

#### Goal & intent

`test/distill.test.js`의 불릿 감사가 사람이 유지하는 상수 목록 대신 저장소의 Distill
샤드 파일에서 기대값을 유도한다. 감사가 지키려는 것은 「샤드를 읽어 렌더한 결과가
샤드 파일이 실제로 담은 불릿 집합과 같고, 라우팅이 꺼졌을 때 선택 결과도 그와 같다」는
불변식이다. 승격으로 불릿이 늘거나 바뀌어도 이 불변식은 그대로이므로, 목록을 손으로
고치는 단계가 사라진다.

`ORIGINAL_BULLET_HASHES`가 원래 담던 「샤딩 이전 원본 불릿을 하나도 잃지 않았다」는
1회성 이관 감사는 이미 승격분이 손으로 덧붙으면서 성립하지 않는다. 이 task는 그
소급 감사를 되살리지 않고, 지금 지킬 수 있는 불변식으로 대체한다. 대신 샤드 본문이
바뀌었다는 사실 자체는 더 이상 해시로 고정되지 않는다 — 본문 판정은 finalize의
승격 동의와 diff 리뷰가 맡는다.

#### Interface

- 제공: `test/distill.test.js`가 `.bouncer/Distill.md`의 `distill.shards` 목록을 읽어
  각 `.bouncer/distill/<id>.md` 본문에서 기대 불릿 해시 집합을 유도하고, 이를
  `renderShards(state)`와 라우팅 비활성 선택 렌더 결과에 각각 대조한다.
- 거부: 상수로 고정된 기대 해시 목록. 파일에 `ORIGINAL_BULLET_HASHES`가 남아 있으면
  이 task는 완료가 아니다. 유도 집합이 비어도 통과하는 단언(빈 배열 대 빈 배열)도
  거부한다 — 불릿 수가 0보다 크다는 단언을 함께 둔다.
- 남는 사각지대(의도한 것): 기대값과 렌더 결과가 같은 샤드 파일에서 나오므로, 샤드
  본문이 지워지거나 잘려도 양쪽이 함께 줄어 이 감사는 통과한다. 본문 손실을
  테스트에서 잡는 수단은 이 변경 뒤 남지 않는다. 그 판정은 finalize의 승격 동의와
  diff 리뷰가 맡는다. 이 사실을 브리프 밖에서 다시 주장하지 않는다.

#### Touch

- Modify `test/distill.test.js` — `ORIGINAL_BULLET_HASHES` 상수와 그 참조 두 곳을
  제거하고, 샤드 파일에서 기대 불릿 해시를 유도하는 헬퍼로 대체한다.

#### Constraints

- 기대값을 `renderShards` 출력에서 다시 유도해 자기 자신과 비교하지 않는다. 파일을
  직접 읽는 경로(프론트매터 분리 후 본문)로 유도해야 읽기·렌더 파이프라인이 감사 대상에 남는다.
- 기존 단언(`state.mode`, `state.valid`, `routing_enabled`, `state.ids` 일곱 개,
  샤드별 세 섹션 존재, `pathsKnown`/`pullsKnown`, `disabledSelection.full`)은 그대로 둔다.
- `bulletHashes` 함수의 파싱 규칙(헤딩에서 블록 종료, `- ` 시작, 후행 개행 정규화)은
  바꾸지 않는다. 파싱을 바꾸면 감사 대상 자체가 달라진다.
- 테스트 본문의 비자명한 의도는 한국어 주석으로 남긴다.

### Task 002

#### Goal & intent

`bouncer finalize --yes`가 커밋할 것이 있을 때 해석된 검증 명령을 먼저 실행하고,
실패하면 `closed` 잠금도 쓰지 않고 아무 경로도 스테이징하지 않은 채
`{ ok: false, reason: 'verify' }`로 끝난다. 지금은 execute 게이트만 검증을 돌리고
finalize는 문서 상태와 `diff_sha`만 보므로 Distill 승격이 항상 미검증으로 커밋된다.

검증은 승격 직전 사전 점검이지 task 증적이 아니다. 따라서 `verification.md`와 verify
원장에는 아무것도 쓰지 않는다 — 하드 규칙 3이 말하는 증적은 execute 게이트가 쓰는 것
하나뿐이고, 여기서 문서를 쓰면 어느 실행이 증적인지 구분되지 않는다.

#### Interface

- 제공:
  - `finalize({ ..., verifyExec })` — 선택 주입 지점. 기본값은 `verification.ts`의
    `executeVerify` 실제 실행. 테스트는 이 인자로 종료 코드를 정한다.
  - 실패 반환은 한 형태다: `{ ok: false, reason: 'verify', code, command, exitCode }`.
    검증 실행이 0이 아닌 코드로 끝나면 `code: 'VERIFY_FAILED'`이고 `command`/`exitCode`가
    실제 값이다. 명령을 해석하지 못하면 `command`/`exitCode`는 `null`이고 `code`가
    해석 오류 코드다.
  - 명령 해석은 `readVerifyCommand(repoRoot, blueprintDir)` 하나만 쓴다.
- 거부:
  - `--yes` 없는 dry-run에서는 실행하지 않는다. 읽기 전용 보고가 전체 테스트를
    끌고 오면 안 된다.
  - 스테이징 대상도 `closed` 잠금도 없어 커밋을 건너뛰는 경로에서는 실행하지 않는다.
  - `bouncer.verify`가 형식상 무효면 `config.verify`로 폴백하지 않는다. 폴백하면
    plan `S12` 누락을 숨긴다. 대신 `code: 'VERIFY_COMMAND_INVALID'` 실패로 끝낸다.
  - `config.verify`가 없거나 무효인 경우도 같은 형태의 실패다
    (`VERIFY_CONFIG_MISSING` / `VERIFY_CONFIG_INVALID`).
  - 세 해석 오류 중 어느 것도 예외로 새지 않는다. `cmdFinalize`에는 try/catch가 없고
    `runCli`에도 최상위 처리기가 없어, 던지면 결과 JSON 대신 스택 트레이스가 나오고
    종료 코드 계약(0/1)도 깨진다. 코드를 결과에 실으므로 조용한 폴백도 아니다.

#### Touch

- Modify `scripts/src/lib/finalize.ts` — out-of-scope 검사 통과 후, 잠금 기록·스테이징
  전에 검증을 실행하는 분기를 넣고 `verifyExec` 주입 인자를 받는다.
- Modify `scripts/lib/finalize.js` — 위 변경의 `tsc` 산출. `check:emit`이 소스와
  대조하므로 함께 커밋한다.
- Modify `test/finalize.test.js` — 검증 성공·실패·건너뜀 경로의 케이스를 추가한다.
- Modify `skills/bouncer-finalize/SKILL.md` — 3단계에 `--yes`가 검증을 실행한다는
  사실과 `reason: 'verify'` 실패 시 처리(고치고 재실행, 우회 없음)를 적는다.
- Modify `test/skill-bouncer-finalize.test.js` — 위 스킬 문장을 계약으로 고정한다.
- Modify `docs/cli.md` — `bouncer finalize` 행에 `--yes`가 검증을 실행한다는 설명을 넣는다.
- Modify `docs/troubleshooting.md` — finalize `out-of-scope` 행 옆에 `reason: 'verify'`
  행을 넣는다. 사용자가 가장 자주 만날 새 중단 지점이다.

#### Constraints

- 검증 실행 위치는 out-of-scope 검사 **뒤**, `writeClosedLock`·`stage` **앞**이다.
  잠금이 먼저 쓰이면 검증 실패 시 blueprint가 닫힌 채 커밋만 없는 상태가 남는다.
- 현재 코드는 `writeClosedLock`이 `mergeLocked`로 `staged`를 계산하기 전에 실행된다.
  「커밋할 것이 있을 때만 검증」과 「잠금 전에 검증」을 동시에 지키려면
  `writeClosedLock` 호출을 `staged` 계산 뒤로 옮겨야 한다. 이 재배치가 이 task에서
  유일하게 자명하지 않은 편집이다.
- 잠금만으로 커밋이 생기는 경우(승격분 없이 blueprint를 닫기만 하는 실행)도 검증을
  돌린다. 그 커밋도 저장소 파일을 바꾸고, 예외를 두면 「승격이면 검증」이라는 규칙이
  「어떤 finalize 커밋은 검증되지 않는다」로 돌아간다.
- 실패 반환에 `violations`·`staged`를 섞지 않는다. 실패 이유는 `reason` 하나로 읽힌다.
- 테스트는 실제 명령을 실행하지 않는다. `verifyExec` 주입으로만 종료 코드를 만든다.
- 기존 반환 형태(`dryRun`, `committed`, `staged`, `commitMessage`, `pointerCleared`,
  `next`, `closed`)의 필드 이름과 의미를 바꾸지 않는다.
- 비자명한 순서 결정(잠금 전에 검증하는 이유)은 한국어 주석으로 코드에 남긴다.
- 소스는 `scripts/src/**`에서 고치고 `npm run build`로 emit을 갱신한다. `scripts/lib/**`를
  직접 편집하지 않는다.

### Task 003

#### Goal & intent

다음 회차를 도는 사람이 `docs/benchmark/protocol.md`만 읽고 두 가지를 할 수 있다.
첫째, 런마다 plan 게이트를 통과한 시점의 계획 문서 줄 수를 남긴다. 3회차는 이걸
남기지 못해(각 실행 clone이 커밋 하나로 squash되고 `.benchmarks/`에도 트리 사본이
없었다) 100줄 목표가 실제로 묻는 값을 재지 못했고, 보고된 값은 사이클 종료 시점
줄 수(146/146/151/160)에서 하네스 몫 25줄을 뺀 파생 대리값 121/121/126/135였다.
둘째, 어떤 런을 표본에서 빼고 어떤 런을 미달로 보고하는지 헷갈리지 않는다.

#### Interface

- 제공: `protocol.md`에 절 두 개.
  - 「plan 단계 스냅샷」 — 무엇을 언제 어디에 남기는지. 명령까지 그대로 적는다.
  - 「표본 제외와 실패 보고」 — 두 의무의 적용 순서를 한 문장으로 못박는다.
- 거부: 두 절 모두 판단을 읽는 사람에게 넘기는 표현("적절히", "필요하면")을 쓰지
  않는다. 다음 회차가 같은 자리에서 다시 갈리면 이 task는 실패다.

#### Touch

- Modify `docs/benchmark/protocol.md` — 위 두 절을 넣고, 「한계」 절에 3회차 줄 수가
  파생 대리값이라는 항목을 하나 더한다.

#### Constraints

- 문서만 바꾸는 커밋이다. 테스트를 새로 붙이지 않는다 — 이 절들은 사람이 읽는
  실행 지침이고, 문구를 계약 테스트로 고정하면 다음 회차가 절차를 다듬을 때마다
  무관한 테스트가 깨진다.
- 기존 절 순서와 제목을 유지한다. `test/lightweight-cycle.test.js`가
  「3회차 on arm: light 계약」 제목을 참조한다.
- 3회차가 실제로 겪은 사실(네 런이 146~160줄, 네 런 모두 100줄 초과)을 근거로 적되,
  그 판정을 다시 쓰지 않는다.
