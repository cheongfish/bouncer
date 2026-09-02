---
type: bouncer.explain
title: 001 explain
description: Explain for 001
resource: .bouncer/context/epics/006-platform-architecture/blueprints/003-core-module-split/explain.md
tags:
  - bouncer
  - explain
timestamp: '2026-08-14T11:45:43.570+09:00'
bouncer:
  id: 'EXPLAIN-003'
  epic_id: '006'
  blueprint_id: '003'
  status: published
  comprehension:
    - range_from: develop
      range_to: 1d486d348ce3b90ab8e3a6b543c04396dda5ebb7
      diff_sha: 34d478518c16815b33cc5bfb19df49adb2cc3d2f74db0d38d7a2a1f9dc1202a4
      quiz_score: '1/5'
      disposition: Q4만 정답. missing은 ENOENT만이고, CLI 프로토타입 키는 unknown-command이며, validateBlueprint는 allowlist 파일명 때문에 남기고, graph-scope는 프로세스·graphify require가 금지다
      recorded_at: '2026-08-14T11:48:25+09:00'

---
# Explain

## Background

`validate.ts`·`cli.ts`·`session-graph.ts`·`import-history.ts`가 저장소 코어의
절반을 한 파일에 쥐고 있었다. 게이트 하나, 명령 하나, 그래프 신선도 판정
하나를 고치려면 성격이 다른 코드를 같이 읽어야 했고, 리뷰는 이동인지
동작 변경인지 구분하기 어려웠다. 같은 저장소에 `.bouncer/config.json`을
`JSON.parse`하는 자리가 일곱 곳이었고, 실패 처리가 `{}` / `null` / 타입 있는
예외로 갈라져 한쪽만 고치면 나머지가 조용히 어긋났다.

이 변경은 파싱을 `config.ts` 하나로 모으고, 네 파일을 평평한 형제 모듈로
나눈다. 공개 `require` 경로, CLI help 바이트, 게이트 코드·메시지, 테스트
단언은 그대로다.

## Intuition

한 파일에 섞여 있던 책임을 층으로 갈라, 실패를 어떻게 받을지는 호출자가
정하고 파싱·판정·실행은 각자 한 자리만 갖게 한다.

## Code

- `scripts/src/lib/config.ts` — `readConfigResult` / `readConfig`. ENOENT만
  `missing`, 그 밖의 읽기·JSON 오류는 `invalid`. 값 모양은 보지 않는다.
  `cli.ts`·`subagents.ts`는 `?? {}`, `session-graph.ts`·`graphify.ts`는
  `null` 그대로, `verification.ts`는 `VERIFY_CONFIG_MISSING` /
  `VERIFY_CONFIG_INVALID`로 매핑한다.
- `scripts/src/lib/cli.ts` — `COMMANDS` 레지스트리에서 USAGE를 조립하고
  키로 디스패치한다. 조회는 `Object.hasOwn`이다. 핸들러는
  `cli-flags.ts`, `cli-doc-commands.ts`, `cli-git-commands.ts`,
  `cli-project-commands.ts`, `cli-current-command.ts`.
- `scripts/src/lib/validate.ts` — `validateBlueprint`와 배럴만 남긴다.
  레거시 `.sdd` 문자열이 `test/public-name-regression.test.js` allowlist에
  이 파일명으로 묶여 있다. 본문 파싱 `validate-sections.ts`, 로딩
  `validate-docs.ts`, S 코드 `validate-structural.ts`(`isValidGraphBasis`),
  G 코드 `validate-gates.ts`.
- `scripts/src/lib/session-graph.ts` / `graph-scope.ts` / `graph-exec.ts` —
  신선도 판정(읽기만)과 graphify 프로세스 실행을 가른다.
- `scripts/src/lib/import-history.ts` / `import-types.ts` / `import-git.ts` /
  `import-render.ts` — 계획·거부·적용과 git 파싱·본문 렌더를 가른다.
  `hooks/session-graph.js`는 공개 이름만 부른다.

## Quiz

1. `readConfigResult`에서 `missing`이 되는 경우는?
   - A) 파일이 없거나 JSON이 깨졌을 때
   - B) 읽기 오류 `code`가 `ENOENT`일 때만
   - C) 파싱된 값이 객체가 아닐 때

2. CLI 레지스트리에서 `toString` 같은 이름을 치면?
   - A) `Object.prototype` 메서드를 실행한다
   - B) 예외를 던진다
   - C) 다른 미등록 명령과 같이 stderr `unknown command`와 종료 코드 2

3. `validateBlueprint`를 `validate.ts`에 남긴 이유는?
   - A) allowlist가 레거시 `.sdd` 문자열을 이 파일명에 묶어 두어서
   - B) 게이트 메시지가 이 파일 경로를 하드코딩해서
   - C) `scope.ts` 순환을 끊으려고

4. S9와 G4의 `graph.basis` 판정은?
   - A) `validate-gates.ts`와 `validate-structural.ts`에 각각 구현한다
   - B) `validate.ts` 배럴에만 둔다
   - C) `validate-structural.ts`의 `isValidGraphBasis` 하나를 게이트가 가져다 쓴다

5. `graph-scope.ts`가 하면 안 되는 일은?
   - A) `fs.stat` / `existsSync`로 mtime을 읽는 일
   - B) `graphify.ts`를 require하거나 외부 프로세스를 띄우는 일
   - C) `graphify-out`·`node_modules`·`.git`·`.worktrees`를 mtime 순회에서 건너뛰는 일

## 이해 상태

- 점수: 1/5
- 정답: 1B, 2C, 3A, 4C, 5B
- 응답: 1A, 2A, 3C, 4C, 5C
- 채점: 1 오답, 2 오답, 3 오답, 4 정답, 5 오답
- disposition: Q4만 정답. missing은 ENOENT만이고, CLI 프로토타입 키는 unknown-command이며, validateBlueprint는 allowlist 파일명 때문에 남기고, graph-scope는 프로세스·graphify require가 금지다

