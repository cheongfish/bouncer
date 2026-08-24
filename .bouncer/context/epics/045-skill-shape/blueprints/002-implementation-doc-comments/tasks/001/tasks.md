---
type: bouncer.tasks
title: 구현 스킬에 한국어 docstring 계약 추가
description: Tasks for 001
resource: .bouncer/context/epics/045-skill-shape/blueprints/002-implementation-doc-comments/tasks/001/tasks.md
tags:
  - bouncer
  - tasks
timestamp: '2026-08-24T10:18:28.110+09:00'
bouncer:
  id: TASKS-001
  epic_id: '045'
  blueprint_id: '002'
  status: verified
  commit_intent:
    - 인라인 주석 규정만 있고 함수 단위 docstring과 그 언어에 대한 계약이 없음
    - 구현 언어와 무관하게 한국어 요약·인자·반환값을 적도록 구현 스킬에 규정함
  affected_paths:
    - skills/implementation/SKILL.md
    - test/skill-implementation.test.js
  scope_evidence:
    producer: graphify
    generated_at: '2026-08-24T10:18:28.110+09:00'
    suggested_paths:
      - skills/implementation/SKILL.md
      - test/skill-implementation.test.js
    basis:
      - graph: source
        status: reused
        query: implementation skill comment contract docstring
        result: >-
          graph-sync reported skip-fresh; both graphs returned the same node set naming deleted paths (commands/sdd-plan.md, skills/okf-authoring, skills/sdd-minimality, .superpowers/); results discarded and paths seeded manually
      - graph: context
        status: reused
        query: 구현 스킬 주석 계약 하드룰 9
        result: >-
          graph-sync reported skip-fresh; both graphs returned the same node set naming deleted paths (commands/sdd-plan.md, skills/okf-authoring, skills/sdd-minimality, .superpowers/); results discarded and paths seeded manually
---
# Tasks

Blueprint: [002](../../index.md)

## Goal & intent
`skills/implementation/SKILL.md`의 「Detailed comments」 단계에 docstring 계약을 더한다.
지금 그 단계는 인라인 why-주석만 규정한다. 함수·메서드 단위로 무엇을 남겨야 하는지,
그리고 그것을 어느 언어로 쓰는지가 비어 있다.

계약은 넷이다. **요약** — 무엇을 하는가에 더해 실패·재시도·부작용처럼 호출자가 알아야
할 동작까지. **Args** — 인자마다 `이름 (타입): 설명` 한 줄. **Returns** — 반환 타입과
그 의미, 분기하면 분기별로. **언어** — 구현 언어와 무관하게 한국어. 식별자·타입명·
경로는 원문 그대로 둔다.

절차가 긴 함수는 본문에 번호 단계 주석을 달고, 비자명한 결정에는 그 자리에서 근거를
남긴다. 기존 4단계의 why-주석 규정은 그대로 두고 그 위에 얹는다.

이 task는 BP-001 TASKS-002 **뒤에** 실행한다. 그 task가 이 파일의 `## Flow`를
`## Steps`로 바꾸고 「Detailed comments」 단계는 그 절 안에 있다. 착수 시점에 절
이름이 아직 `## Flow`라면 BP-001이 끝나지 않은 것이므로 구현하지 말고 보고한다.

## Interface
- 제공: `skills/implementation/SKILL.md`의 「Detailed comments」 단계. 인라인 why-주석
  규정과 docstring 계약 둘을 갖고, 계약에는 TypeScript(JSDoc)와 Python 두 언어의 형태
  예시가 각각 있다.
- 거부: 하드룰 9 언급, 기존 `scripts/lib/validate.js` Bad/Good 대조 예시 셋, 그 예시의
  한국어 조각(`파싱하지 않아야`, `같은 헬퍼를 써야`, `재승인 경로가 없`)은 지우지
  않는다. lint 규칙이나 검사기를 추가하지 않는다 — 이 계약은 리뷰가 읽는 산문이다.

## Touch
- Modify `skills/implementation/SKILL.md` — 「Detailed comments」 단계에 docstring 계약과 두 언어 예시 추가
- Modify `test/skill-implementation.test.js` — docstring 계약 단정 추가

## Do not touch
- `CLAUDE.md` — 하드룰 9는 포인터로 남긴다. 상세 지침이 구현 스킬 본문에 있어야
  한다는 것이 기록된 결정이다.
- `agents/bouncer-implementer.md` — 하드룰 본문을 되풀이하지 않는다는 같은 결정이 걸린다.
- `scripts/` — docstring 소급 적용은 이 blueprint의 범위가 아니다.
- `.eslintrc`, `tsconfig.json` 등 검사 설정 — 게이트를 만들지 않는다.

## Constraints
- 기존 계약 테스트가 찾는 문자열을 유지한다. 아래는 망라가 아니므로 착수 전에
  `test/skill-implementation.test.js`를 직접 읽고 단정 다섯 개를 모두 확인한다:
  `Detailed comments`, `하드룰 9` 또는 `Hard rule 9`, `scripts/lib/validate.js`,
  `파싱하지 않아야`, `같은 헬퍼를 써야`, `재승인 경로가 없`, `why`,
  `invariant`/`trade-off`/`ceiling` 중 하나, `thorough` 또는 `Prefer thoroughness`
  또는 `상세`, 그리고 Bad/Good 대조 예시의 `**Bad**`·`**Good**` 굵은 표기.
  이 중 셋(`invariant`·`ceiling`·`Prefer thoroughness`)은 현재 파일에서 한 문장
  「Prefer thoroughness over brevity: intent, invariants, rejection paths,
  trade-offs, and known ceilings」이 혼자 떠받치고 있다. 단계를 두 갈래로 나누다
  그 문장을 지우면 예고 없이 `npm test`가 깨진다.
- 참조 구현의 외부 절대 경로를 문서에 적지 않는다. 다른 저장소의 파일이라 링크가
  깨진다. 형태만 발췌해 예시로 남긴다.
- 예시는 TypeScript(JSDoc)와 Python 둘 다 보인다. 이 저장소는 TS/JS이고 계약은 언어
  무관이므로 한쪽만 보이면 적용 형태가 모호해진다.
- 계약이 요구하는 것은 항목의 **존재**(요약·인자별 한 줄·반환)이지 표기법이 아니다.
  표기는 각 언어의 관용을 따른다 — JSDoc은 `@param {타입} 이름 - 설명`이고
  `이름 (타입): 설명`은 Python 쪽 관용이다. 두 형태를 섞어 쓰지 않는다.
- 스킬 지시문 산문은 영어를 유지한다. 예시 docstring의 내용은 한국어다 — 그것이 규정
  자체다.
- Touch에 적힌 두 파일 밖은 건드리지 않는다. 다른 스킬 문서와 다른 테스트 파일은
  이 작업과 무관하고, 기존 코드에 docstring을 소급해 다는 것도 범위가 아니다.
- 자명한 한 줄 함수까지 docstring을 요구하지 않는다. 기존 4단계가 이미 「Trivial
  one-liners that are self-evident need no comment」로 선을 그어 두었고, 그 선을 유지한다.

## Checklist
- [ ] `npm test`로 기준선이 green인지 확인한다.
- [ ] 「Detailed comments」 단계에 docstring 계약 넷(요약 / Args / Returns / 언어)을 적는다.
- [ ] TypeScript(JSDoc) 예시를 넣는다. 형태:
      ```ts
      /**
       * 활성 포인터가 가리키는 task 문서의 검증 명령을 해석한다.
       * 포인터가 존재하는 task를 지목하면 그 문서의 `bouncer.verify`만 읽고,
       * 아니면 번호 순으로 첫 선언을 취한 뒤 `config.verify`로 폴백한다.
       *
       * @param {string} repoRoot - 저장소 루트 절대 경로
       * @param {Pointer | null} pointer - 활성 포인터. null이면 문서 순회로 간다
       * @returns {string} 실행 가능한 단일 argv 문자열
       */
      ```
- [ ] Python 예시를 넣는다. 요약 여러 줄 뒤 `Args:` / `Returns:` 블록을 두고, 인자마다
      `이름 (타입): 설명` 한 줄인 형태로 적는다.
- [ ] 절차가 긴 함수의 번호 단계 주석(`# 1.` `# 2.`)과 비자명한 결정의 근거 주석을
      한 문단으로 규정한다.
- [ ] `test/skill-implementation.test.js`에 단정을 추가한다:
      ```js
      test('implementation requires Korean docstrings with args and returns', () => {
        const md = readSkill('implementation');
        // 파일 전체가 아니라 Detailed comments 단계 구간에만 단정을 건다.
        // skill-minimality.test.js가 `## Decision ladder` 구간을 자르는 것과 같은 방식.
        const step = md.match(/\*\*Detailed comments\*\*[\s\S]*?(?=\n\d+\. \*\*|\n## )/);
        assert.ok(step, 'implementation must keep a Detailed comments step');
        const s = step[0];
        assert.match(s, /docstring/i);
        assert.match(s, /Args|인자/);
        assert.match(s, /Returns|반환/);
        // 언어 무관 규정: 구현 언어와 상관없이 한국어라는 문장이 있어야 한다.
        assert.match(s, /regardless of[^\n]{0,40}language|구현 언어와 (?:무관|상관)/i);
        // 두 언어의 형태 예시가 모두 있어야 한다. JSDoc은 중괄호 타입이어야 한다.
        assert.match(s, /@param \{[^}]+\} \w+/);
        assert.match(s, /Args:/);
      });
      ```
- [ ] 사용자 홈이나 외부 저장소를 가리키는 절대 경로가 새로 들어가지 않았는지
      확인한다:
      ```
      grep -nE '(^|[^`[:alnum:]])(/home/|/Users/|~/)' skills/implementation/SKILL.md
      ```
      출력이 없어야 한다. 참조 구현은 형태만 발췌하고 그 파일의 위치는 적지 않는다.
- [ ] `npm test` 통과를 확인한다. 특히 `test/skill-implementation.test.js`가 green이어야 한다.
