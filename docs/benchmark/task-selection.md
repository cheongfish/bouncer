# 벤치마크 태스크 선정

shape 이름은 `skills/agentic-code-benchmark/references/task-suite.md` 표를 그대로 쓴다. 같은 shape을 세 개 이상 넣지 않았다.

| 태스크 id | shape | DeepSWE에서 대응하는 실패 유형 | 이 저장소 적합성 근거 |
| --- | --- | --- | --- |
| `cli-equals-flags` | Bug fix from a real report | 진단이 필요한 버그 | `scripts/src/lib/cli-flags.ts`의 `parseFlags`는 `--repo /tmp`만 읽고 `--repo=/tmp`는 키 이름에 `=`를 남긴다. CLI 호출자가 GNU 관례를 쓰면 재현된다. |
| `frontmatter-crlf` | Bug fix from a real report | 회귀 테스트가 있어야 통과하는 수정 | `scripts/src/lib/frontmatter.ts`의 `FRONTMATTER_RE`는 `\n`만 연다. Windows 체크아웃의 `\r\n` 문서는 본문이 있는데도 `missing frontmatter block`으로 죽는다. 기존 `test/frontmatter.test.js`는 LF만 넣는다. |
| `kst-calendar-date` | Small feature in existing code | (해당 없음, 기능 추가) | `scripts/src/lib/time.ts`의 `nowIsoKst`가 이미 KST 파트를 쪼갠다. 시각 없이 날짜만 필요한 호출이 `test/time.test.js` 옆에 붙기 좋다. |
| `commit-violation-detail` | Small feature in existing code | (해당 없음, 기능 추가) | `scripts/src/lib/commit-guard.ts`는 위반 경로 문자열만 돌려준다. `test/commit-guard.test.js`가 그 배열을 고정하고 있어 메시지 필드를 넣으면 바로 깨진다. |
| `yaml-codec-extract` | Refactor with no behavior change | (해당 없음, 동작 유지) | `scripts/src/lib/frontmatter.ts`와 `scripts/src/lib/render.ts`가 `../vendor/js-yaml`을 각자 require한다. 로드/덤프 옵션을 한곳으로 모으면 파서가 갈라지지 않는다. |
| `cursor-host-lookup` | Cross-cutting change (3+ modules) | 여러 모듈에 걸친 변경 | 생산 모듈 셋이다. `scripts/src/lib/plugin-root.ts`의 `HOSTS`/`candidatePaths`, `scripts/src/lib/bouncer-root.ts`의 `--host` 오류 문구, `rules/plugin-root.md`의 호스트 나열이 같은 목록을 쓴다. 테스트 fixture는 Cursor 경로만 이미 안다. |
| `json-parse-position` | Cross-cutting change (3+ modules) | 여러 모듈에 걸친 변경 | 생산 모듈 셋이다. `scripts/src/lib/config.ts`가 줄/칸을 결과에 담고, `scripts/src/lib/verification.ts`가 오류 객체 필드와 `VERIFY_CONFIG_INVALID` 메시지에 넣고, `scripts/src/lib/cli-doc-commands.ts`의 `verify` stderr가 그 필드를 읽는다. |
| `reuse-context-root` | Task with an existing helper to reuse | (해당 없음, 중복 상수) | `scripts/src/lib/layout.ts`가 `CONTEXT_ROOT`를 두었는데 `scripts/src/lib/init.ts`의 `defaultConfig`는 `context_dirs`에 `'.bouncer/context'`를 다시 적는다. |
| `reuse-enoent-check` | Task with an existing helper to reuse | (해당 없음, 중복 분기) | `scripts/src/lib/config.ts`의 `isEnoentError`와 `scripts/src/lib/verification.ts`의 `errorCode(...) === 'ENOENT'`가 파일 부재를 따로 판정한다. |
| `usage-readability` | Task with an ambiguous requirement | (해당 없음, 요구가 모호함) | `scripts/src/lib/cli.ts`의 `USAGE_HEADER`/`USAGE_FOOTER`와 `test/cli-help.test.js`의 바이트 단위 비교가 있다. 「읽기 쉽게」만 주고 레이아웃을 고르라고 둔다. |

## DeepSWE 원본 목록

2026-08-25에 https://deepswe.datacurve.ai/ 의 Task Examples와 https://entrpi.github.io/misc/deepswe-scenarios/ 카탈로그를 열었다. 카탈로그는 113과제, 언어 분포, change type(`feature_request` 106 / `bugfix` 4 / `enhancement` 3), 검증을 base 테스트와 숨은 new-test로 나눈다고 적는다. 페이지의 전체 113행 표는 이 세션에서 행 본문이 비어 내려와서 instruction.md 전량은 받지 못했다. 그래서 과제 문장을 복사하지 않고, 카탈로그가 가리키는 실패 유형(진단이 필요한 버그, 여러 모듈에 걸친 변경, 숨은/회귀 테스트가 있어야 통과하는 수정)을 위 표의 저장소 경로에 각색했다. 표본은 10개로 유지한다.
