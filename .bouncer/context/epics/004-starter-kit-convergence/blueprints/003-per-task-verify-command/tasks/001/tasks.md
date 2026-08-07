---
type: bouncer.tasks
title: 검증 명령 해석에 블루프린트 선언과 형식 검사를 추가함
description: tasks.verify 선언, 전역 폴백, 단일 명령 형식 거절
resource: .bouncer/context/epics/004-starter-kit-convergence/blueprints/003-per-task-verify-command/tasks/001/tasks.md
tags:
  - bouncer
  - tasks
timestamp: '2026-08-02T23:44:42.331Z'
bouncer:
  id: TASKS-001
  epic_id: '004'
  blueprint_id: '003'
  status: verified
  affected_paths:
    - scripts/src/lib/verification.ts
    - scripts/lib/verification.js
    - scripts/src/lib/validate.ts
    - scripts/lib/validate.js
    - test/verification-runner.test.js
    - test/validate-structural.test.js
    - docs/ARCHITECTURE.md
    - docs/configuration.md
    - docs/cli.md
    - docs/gates.md
  graph:
    generated_at: '2026-08-04T08:41:25+09:00'
    command: graphify query (source + context)
    suggested_paths:
      - scripts/src/lib
      - scripts/lib
      - test
      - docs
    basis: graph-sync는 source를 skip-fresh, context를 재빌드했다. source 질의 "blueprint verify command declaration fallback readVerifyCommand config.verify structural validation"은 readVerifyCommand()/CONFIG에서 BFS로 verification.ts·verification.js·validate.ts·validate.js·cli.ts를 돌려줬고, 이것이 선언 해석과 구조 검사가 만나는 지점을 그대로 확인해 준다. context 질의는 verification.md의 Command/Evidence 골격만 나와 경로 제안에 쓸 정보가 없었다. `test`와 `docs`는 수동으로 보탰다 — config.source_dirs가 scripts/hooks/test라 docs는 색인되지 않고, 테스트 파일은 노드로 나오되 이 변경이 고칠 두 파일을 지목하지는 않는다. cli.ts는 verify 서브커맨드 배선일 뿐 시그니처 변경의 영향을 받지 않아 affected_paths에서 뺐다.
---
# Tasks

Blueprint: [003](index.md)

## Goal & intent
`tasks.md` frontmatter에 선택 필드 `bouncer.verify`를 선언하면 `bouncer verify`와
execute 게이트가 **그 명령**을 실행하고, 선언이 없으면 지금처럼 `config.verify`를
실행한다. 둘 다 없으면 기존 `VERIFY_CONFIG_INVALID` 계약이 유지된다. 선언된 명령이
단일 실행 가능 형식이 아니면 plan 단계의 구조 검사가 새 `S12`로 거절하고, 게이트를
우회해 실행에 도달해도 명령 해석이 `VERIFY_COMMAND_INVALID`로 거절한다. 증적
기록과 G13 판정 로직은 바뀌지 않는다 — 기록되는 문자열의 출처만 넓어진다.
검증은 `npm test`.

## Interface
- 제공: `scripts/src/lib/verification.ts`가 `isValidVerifyCommand(command)`를
  내보낸다. 반환값은 `boolean`이며, 아래 "거부" 규칙을 통과한 문자열에만 `true`.
- 제공: 같은 모듈의 `readVerifyCommand(repoRoot, blueprintDir)`가 두 번째 인자를
  받는다. `blueprintDir`이 주어지고 그 아래 `tasks.md`의 `bouncer.verify`가
  비어있지 않은 문자열이면 그 값을, 아니면 `config.verify`를 돌려준다. 두 번째
  인자는 선택이며, 생략하면 기존 동작(전역 명령만)과 동일하다.
- 제공: `runVerification`이 이미 가진 `blueprintDir`을 `readVerifyCommand`에
  넘긴다. `runVerification`의 시그니처와 반환값(`{ ok, command, exitCode }`)은
  그대로다.
- 제공: `scripts/src/lib/validate.ts`의 구조 검사가 `bouncer.tasks` 문서에서
  `bouncer.verify`가 존재할 때만 형식을 검사하고, 위반 시 코드 `S12`를 붙인다.
  필드가 없으면 아무 검사도 하지 않는다 — 기존 문서는 전부 유효하다.
- 거부: `readVerifyCommand`는 아래 입력에 대해 `code`가 `VERIFY_COMMAND_INVALID`인
  오류를 던진다. 판정은 `isValidVerifyCommand` 하나가 소유하고 구조 검사는 그것을
  재사용한다 — 규칙을 두 곳에 복제하지 않는다.
  - trim 후 빈 문자열, 또는 문자열이 아닌 값
  - 셸 제어 문자 `&` `|` `;` `` ` `` `>` `<` `$(` `\n` 중 하나라도 포함
  - 첫 토큰이 `cd`
- 거부: `bouncer.verify`가 없고 `config.verify`도 없거나 빈 문자열이면 기존과 같이
  `VERIFY_CONFIG_INVALID`를 던진다. 새 코드로 바꾸지 않는다.

## Touch
- Modify `scripts/src/lib/verification.ts` — `isValidVerifyCommand` 추가,
  `readVerifyCommand`가 `blueprintDir`을 받아 선언 → 전역 순으로 해석, 형식 위반
  거절, `runVerification`에서 `blueprintDir` 전달.
- Modify `scripts/lib/verification.js` — 위 소스의 빌드 산출물. `npm run build`
  (`pretest`)로 재생성해 커밋한다. 손으로 편집하지 않는다.
- Modify `scripts/src/lib/validate.ts` — `checkStructural`의 `bouncer.tasks`
  분기에 `bouncer.verify` 형식 검사(`S12`)를 추가.
- Modify `scripts/lib/validate.js` — 위 소스의 빌드 산출물. 재생성해 커밋한다.
- Modify `test/verification-runner.test.js` — 선언 우선, 전역 폴백, 형식 거절,
  선언 없음 회귀를 덮는 테스트 추가.
- Modify `test/validate-structural.test.js` — `S12` 발생/미발생 테스트 추가.
- Modify `docs/ARCHITECTURE.md` — B.2를 "전역 단일 명령"에서 "블루프린트 선언 +
  전역 폴백"으로 한 줄 갱신.
- Modify `docs/configuration.md` — `verify` 행에 블루프린트 선언이 우선한다는
  단서를 붙인다.
- Modify `docs/cli.md` — `bouncer verify` 설명이 `config.verify`만 가리키는 문장을
  선언·폴백으로 고친다.
- Modify `docs/gates.md` — `S` 코드 범위 `S0–S11`을 `S0–S12`로 고치고 `S12`가 무엇을
  막는지 한 줄 덧붙인다.

## Do not touch
- `scripts/src/lib/schema.ts` — 타입·id 접두어·상태 열거만 담는다. 필드 형태 검사를
  여기로 옮기지 않는다.
- `scripts/src/lib/scaffold.ts` — 새 필드는 선택이므로 scaffold가 빈 값을 심지
  않는다.
- `scripts/src/lib/commit-hook.ts` — 커밋 스코프 판정은 이 변경의 범위 밖이다.
- `scripts/src/lib/finalize.ts` — 마감 흐름은 바뀌지 않는다.
- `.bouncer/config.json` — 이 저장소의 전역 `verify`는 그대로 둔다. 폴백 경로가
  회귀 없이 도는지 확인하는 기준선이다.

## Constraints
- 형식 판정 규칙은 `verification.ts` 한 곳에만 둔다. `validate.ts`는 그것을
  import해서 쓰고 정규식을 복제하지 않는다.
- 하위 호환: `readVerifyCommand(repoRoot)` 한 인자 호출이 계속 동작해야 한다.
  기존 테스트를 시그니처 때문에 고치는 일이 없어야 한다.
- 기존 오류 코드(`VERIFY_CONFIG_MISSING`, `VERIFY_CONFIG_INVALID`,
  `VERIFY_DOCUMENT_MISSING`, `VERIFY_BLUEPRINT_INVALID`)의 의미와 문자열을
  바꾸지 않는다. 새 코드는 `VERIFY_COMMAND_INVALID` 하나만 는다.
- G13 판정 로직은 손대지 않는다. 선언 유무로 분기하지 않는다.
- `scripts/lib/*.js`는 `npm run build` 산출물이다. 소스는 항상 `scripts/src/**`이며
  산출물을 직접 편집하지 않는다.
- 새 런타임 의존성을 추가하지 않는다 (Node 표준 라이브러리 + 벤더링 `js-yaml`).
- 공개 오류 메시지는 기존 관례대로 영어 소문자 문장을 유지한다.

## Checklist
- [ ] `test/verification-runner.test.js`에 실패 테스트를 먼저 추가하고 `npm test`로
      **예상된 이유로** 실패하는지 확인한다.
      - 선언 우선: `tasks.md`에 `verify: node -e "process.exit(0)"`가 있고
        `config.verify`가 `npm test`일 때 `runVerification`이 실행한 명령이 선언
        쪽이고, 기록된 `bouncer.verification.command`도 같아야 한다.
      - 전역 폴백: `tasks.md`에 `bouncer.verify`가 없으면 `config.verify`가 실행된다.
      - `tasks.md` 자체가 없을 때도 전역 폴백으로 동작한다 (예: 문서가 아직 없는 경로).
      - 형식 거절:
        ```js
        assert.throws(() => readVerifyCommand(repo, BP_REL), (e) => e.code === 'VERIFY_COMMAND_INVALID');
        ```
        입력은 `cd sub && npm test`, `npm test | tee out.log`, `a; b`, `  ` 각각.
      - 하위 호환: `readVerifyCommand(repo)`(인자 하나)가 여전히 `config.verify`를
        돌려준다.
- [ ] `scripts/src/lib/verification.ts`에 `isValidVerifyCommand`를 추가한다.
      ```js
      const VERIFY_COMMAND_FORBIDDEN = /[&|;`<>\n]|\$\(/;
      function isValidVerifyCommand(command) {
        if (typeof command !== 'string') return false;
        const trimmed = command.trim();
        if (!trimmed) return false;
        if (VERIFY_COMMAND_FORBIDDEN.test(trimmed)) return false;
        return trimmed.split(/\s+/)[0] !== 'cd';
      }
      ```
- [ ] `readVerifyCommand(repoRoot, blueprintDir)`를 구현한다. `blueprintDir`이
      주어지면 `<repoRoot>/<blueprintDir>/tasks.md`를 `readDoc`으로 읽어
      `data.bouncer.verify`를 본다. 파일이 없거나(`ENOENT`) 필드가 없으면 전역으로
      내려간다. 필드가 있는데 `isValidVerifyCommand`가 `false`면
      `verificationError('VERIFY_COMMAND_INVALID', …)`를 던진다.
- [ ] `runVerification`에서 `readVerifyCommand(repoRoot, blueprintDir)`로 호출을
      바꾸고, `isValidVerifyCommand`를 `module.exports`에 추가한다.
- [ ] `test/validate-structural.test.js`에 실패 테스트를 추가하고 실패를 확인한다 —
      `bouncer.verify: 'cd x && npm test'`인 tasks 문서가 `S12`를 내고,
      `bouncer.verify`가 없는 문서는 `S12`를 내지 않는다.
- [ ] `scripts/src/lib/validate.ts`의 `checkStructural` `bouncer.tasks` 분기에
      추가한다.
      ```js
      if (bouncer.verify !== undefined && !isValidVerifyCommand(bouncer.verify)) {
        add('S12', 'tasks.verify must be a single executable command');
      }
      ```
      `isValidVerifyCommand`는 `require('./verification')`에서 가져온다.
- [ ] `npm test`가 통과할 때까지 구현을 마무리한다 (`pretest`가 `scripts/lib/*.js`를
      재생성하므로 산출물 diff가 함께 남는지 확인한다).
- [ ] 문서 네 곳을 갱신한다 — `docs/ARCHITECTURE.md` B.2, `docs/configuration.md`
      `verify` 행, `docs/cli.md`의 `bouncer verify` 행, `docs/gates.md`의 `S0–S11`
      범위와 `S12` 설명.
- [ ] 이 저장소 자체는 `bouncer.verify`를 선언하지 않은 채로 두고 `npm test`가
      통과하는지 확인한다 — 폴백 경로의 무회귀 증적이다.
