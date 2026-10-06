I'll run `/bouncer-plan` for the `-f` short-option PRD: load Bouncer rules, preflight the plan state, then walk discovery through the plan gate with every required decision asked.Resolving the Bouncer plugin root and loading ACQ fallback rules next.No blueprint is selected. Next I'll ground discovery in the codebase for `--file` / `-f` parsing.Preflight: no blueprint/task/base is selected (`current.status: empty`).

Discovery is grounded in `src/args.js` (`parseOptions` — long options only, pair-stepping), command modules that all require `file`, tests in `test/args.test.js` / `test/cli.test.js`, and docs in `README.md` / `docs/commands.md`. `bouncer intent` for `parseOptions` / `main` returned `unlinked` (no provenance). No epics yet; no `CONTRIBUTING.md` / `AGENTS.md` / CI workflows.

---

### Draft framing

**Goal**  
`list` / `total` / `summary`에서 `--file <path>`와 동일하게 `-f <path>`를 받을 수 있게 하고, 문서에 `-f`를 반영한다. 기존 `--file` 동작·출력은 그대로 둔다.

**Scope**
- `parseOptions`(또는 동등 계층)에서 `-f` → `file` 별칭
- 세 명령 모두에서 `-f` / `--file` 동등 동작, 옵션 순서 무관
- `-f` 값 없음 → 기존과 같은 옵션 오류(stderr, exit 1)
- `-f`와 `--file` 동시 지정 → duplicate와 동일 오류
- `README.md`, `docs/commands.md`에 `-f` 반영
- 관련 단위/CLI 테스트 추가·갱신

**Non-goals**
- `-m` / `-c` 등 다른 짧은 옵션
- 스토리지·집계·출력 포맷 변경
- `--file` 장기 옵션 제거·동작 변경

**Success criteria**
1. `list`/`total`/`summary`에서 `-f <path>`가 `--file <path>`와 동일 결과
2. `-f`만 있고 값 없음 → stderr 메시지, stdout 없음, exit 1
3. `-f`와 `--file` 동시 → duplicate와 동일 오류 계열
4. 기존 `--file` 사용·출력이 회귀하지 않음
5. `README.md`·`docs/commands.md`에 `-f` 사용법이 보임
6. `npm test` 통과

**Edge cases & failure modes**
- `-f` 값 누락 / 다음 토큰이 다른 옵션
- `-f` + `--file` (및 `--file` + `-f`) 중복
- `-f`와 다른 옵션 임의의 순서
- 알 수 없는 짧은 옵션(예: `-x`)은 계속 거절
- 필수 `file`이 `-f`/`--file` 둘 다 없을 때 기존 required 오류 유지

**Overlap**  
에픽/블루프린트 없음. intent `unlinked`. 신규 스트림.

**Project rules**  
`none found` (기여 가이드·CI 없음). 관례상 `npm test` (`package.json#scripts`), `CHANGELOG.md` Unreleased는 있으나 강제 규칙 문서는 없음.

---

요청과 코드만으로 갈라질 수 있는 동작이 있어, Discover 확인 전에 아래를 먼저 정해 주세요.

**AskUserQuestion — plan.open_decisions** *(discovery clarifying; not the Discover ACQ)*

1. **Re-ground**: `-f` 값 붙임 형태와 `cli.js` USAGE 문구 범위
2. **Recommend-why**: PRD는 `-f <path>`(공백)와 README/docs만 명시하므로, 붙여 쓴 형태는 거절하고 USAGE는 문서와 맞추는 편이 범위가 작음
3. **Options**

**Q1. `-fpath`처럼 공백 없이 붙인 값**
- A) 거절(unexpected/unknown) — Recommended
- B) 수락(`-fpath` ≡ `-f path`)
- C) 기타(직접 기입)

**Q2. `src/cli.js`의 USAGE 문자열에 `-f` 반영**
- A) 반영(`--file`/`-f` 병기) — Recommended
- B) 변경하지 않음(README·docs만)
- C) 기타(직접 기입)

**Q3. `CHANGELOG.md` Unreleased 항목**
- A) 추가하지 않음(PRD 범위 밖) — Recommended
- B) Unreleased에 `-f` 한 줄 추가
- C) 기타(직접 기입)

답은 예: `Q1=A, Q2=A, Q3=A` 형태로 주시면 됩니다. 답 받은 뒤 **AskUserQuestion — plan.discovery**로 Goal/Scope 등을 확정하겠습니다.
