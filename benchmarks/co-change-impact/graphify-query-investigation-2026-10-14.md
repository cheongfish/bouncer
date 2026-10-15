# Graphify 질의 조사 기록 — 2026-10-14 (2026-10-15 실험 결과 추가)

## 목적

Plan 단계에서 증거 수집과 영향 경로 조사를 할 때 에이전트가 원본 코드를 넓게 읽는 비용을 줄이기 위해, Graphify 그래프의 질의 형태별 결과와 반환량을 확인했다. 2026-10-15에는 이 규칙이 실제로 수정 대상 파일 추정의 정확도와 토큰을 개선하는지 여러 BP에서 실험했다.

처음에는 `scripts/sr/lib/`가 지정됐으나 저장소에 해당 경로는 없었다. 실제 대상인 `scripts/src/lib/`를 사용했다.

## 요약 (결론 먼저)

1. 소스 파일(`scripts/src`) 탐색은 Graphify를 쓸 만하다. 소스 recall은 0.92이고, 소스 파일이 이미 있는 Task 69개 중 65개(94%)에서 정답 소스를 하나도 빠뜨리지 않았다. 다만 `grep`만 쓰는 기준선(D)과의 차이는 통계적으로 유의하지 않았다(F1 +0.055, 95% 신뢰구간 [−0.009, +0.127], BP 9개).
2. 테스트·규칙·에이전트·스킬 문서는 Graphify로 찾지 못한다(그래프에 없거나 연결이 끊김). `grep -l`과 에이전트 판단이 기계적 규칙 어느 것보다 낫다.
3. 자연어 문장 질의는 한 번에 약 2,250토큰이고 파일 식별도 불안정하다. 정확한 심볼·상수 질의를 `;`로 묶어 한 번의 Bash 호출로 실행하는 것을 권한다.
4. 토큰 절감은 입증되지 않았다. 그래프를 쓴 조건이 그래프 없이 `grep`만 쓴 조건보다 에이전트 총 토큰이 6~12% 더 들었다(규칙 문서를 읽는 비용 포함).
5. 정답의 10~15%는 아직 없는 새 파일이라 F1 상한이 약 0.94~0.96이다. 0.9 목표는 소스·문서·테스트가 거의 다 맞아야 닿는다.
6. 그래프가 평가·질의 시점의 코드와 어긋나면 결과가 오염된다. 이번 실험에서 변경 후 그래프를 변경 전 질의에 쓰는 오염을 한 번 겪었다. stale 방지 방법은 아래에 정리했다.
7. 현행 `bouncer graph-suggest`는 BP 12개, Task 34개 전부에서 후보를 내지 못했다(F1 0). 그래서 `graph-suggest`와 그 소스·테스트·규칙·스킬 파일을 제거하고 plan이 원본 Graphify 질의로 후보를 찾게 하는 전환안을 정리했다.

## 환경과 그래프 생성

- Graphify: `graphifyy==0.9.56` (`resources/graphify-compat.json`의 고정 버전)
- 설치 위치: `/tmp/bouncer-graphify-0.9.56`의 임시 가상환경
  - 세션 중간에 이 디렉터리가 사라졌다. 재설치는 `python3 -m venv`가 `ensurepip` 부재로 실패해서 `uv venv /tmp/bouncer-graphify-0.9.56 && uv pip install --python /tmp/bouncer-graphify-0.9.56/bin/python graphifyy==0.9.56`로 했다.
- source graph: `graphify update scripts/src/lib` → `graphify-out/source/graph.json`. 현재 코드 기준 1,883 nodes, 4,380 links, 약 1.8 MB, 생성 약 4.9초
- test graph: `graphify update test` → `graphify-out/test-direct/graph.json`. 1,736 nodes, 2,094 links
- 문서 그래프는 만들지 못했다. 마크다운(스킬·규칙·에이전트·참조 문서)은 `graphify extract`의 LLM 의미 추출이 필요한데, 이 환경에 API 키와 `ollama`가 없었다. `graphify update`는 코드 파일만 처리한다.

`graphify-out/`은 Git 무시 대상이며, 저장소 소스나 Bouncer 설정 파일은 수정하지 않았다.

## Bouncer graph-suggest와 원본 Graphify의 구분

초기 실험에서 Bouncer의 `graph-suggest`도 확인했지만, 이 도구에는 2-hop 탐색 중 seed 하나당 최대 8개 파일이라는 fan-out cap이 있다. 중심 함수인 `classifyPlanReview`와 그 내부 보조 함수는 이 cap에 걸려 기본 응답에서 후보가 비워졌다.

이 문서의 권장 규칙은 그 구현을 사용하지 않는다. Graphify 패키지의 원본 CLI `query`와 `explain`을 사용한다.

2026-10-15 실험(E5)에서 `graph-suggest`는 BP 12개, Task 34개 전부에서 후보를 내지 못했다. 그래서 `graph-suggest`와 관련 소스·테스트·규칙·스킬 문서를 제거하고 원본 질의로 전환하는 안을 "graph-suggest 제거와 원본 Graphify 질의 전환안" 절에 정리했다.

## 질의 형태별 관찰

### 넓은 자연어 질의는 시작 노드를 과도하게 늘린다

다음과 같은 질문은 source graph에서 각각 615개와 680개의 노드를 탐색했다.

```text
How does classifyPlanReview choose combined single review for one to three commit tasks and clustered review for four or more?

Change plan context review from task threshold one to three while preserving clustered behavior for four tasks.
```

출력 예산을 350 tokens로 두면 결과의 대부분이 잘린다. 일반 단어(`plan`, `task`, `review`, 수사 등)가 여러 파일·심볼을 시작점으로 만들기 때문이다.

관련 함수 네 개를 하나의 query에 함께 넣은 경우도 104 nodes가 탐색됐다.

```text
classifyPlanReview loadCommitTaskSignals buildClusters decidePlanFollowUp
```

### 중심 오케스트레이터에는 query보다 explain이 적합하다

다음 호출은 BFS 2-hop 결과 대신 정확한 노드의 직접 연결만 반환했다.

```bash
graphify explain "classifyPlanReview" \
  --graph graphify-out/source/graph.json
```

결과:

- 위치: `scripts/src/lib/review-dispatch.ts:L531`
- 직접 연결: 11개
- 요구사항에 중요한 연결: `loadCommitTaskSignals`, `decidePlanFollowUp`, `buildClusters`
- 그 밖에 snapshot, validation, previous-payload 검사 연결도 함께 확인됨

이 방식은 파일 수 상한을 적용하지 않으며, 중심 함수 주변의 책임 경계를 좁게 확인할 수 있다.

### 정적 템플릿 계약에는 정확한 상수명이 효과적이다

```bash
graphify query "TEMPLATES" \
  --graph graphify-out/source/graph.json \
  --budget 200
```

이 질의는 `scripts/src/lib/templates.ts:L63`의 `TEMPLATES` 노드 하나만 반환했다. 템플릿 문구 변경의 파일을 좁게 식별하기에 적합하다.

### 테스트 그래프는 심볼 질의로는 안정적이지 않다 (2026-10-14 관찰을 수정)

처음 관찰에서는 `query "classifyPlanReview" --context call`이 `test/review-dispatch.test.js:L11`의 import binding을 반환했다. 그러나 여러 BP에서 반복하자 테스트 그래프 질의는 "No matching nodes"로 끝나는 경우가 잦았다(예: 한 BP에서 시도한 심볼 10개 중 8개, 다른 BP에서는 10개 전부). 원인은 아래 "테스트 그래프가 소스와 이어지지 않는 이유" 참고. 테스트 제목이나 assertion 문자열은 AST 심볼이 아니므로 Graphify 질의로 행위 단위까지 찾으려 하지 말아야 한다.

### 질의 출력 크기 실측 (2026-10-15, 글자 수/3으로 환산한 토큰 추정)

| 질의 | 출력 |
| --- | --- |
| `explain` (연결 수에 비례) | 약 180~570토큰 |
| 상수 `query "TEMPLATES" --budget 200` | 약 165토큰 |
| 테스트 `query "<심볼>" --context call --budget 200` | 약 270토큰 |
| 없는 심볼 `query` | 약 63토큰 ("No matching nodes") |
| 자연어 문장 `query --budget 2000` | 약 2,250토큰 |
| 같은 자연어 문장 `--budget 200` | 약 510토큰 (예산을 줄여도 거의 줄지 않음) |

`--budget`은 출력 상한으로만 동작하고 시작 노드와 탐색 폭을 좁히지 않는다. 소스 파일을 읽는 비용(글자 수/3 추정)은 `commit.ts` 약 7천, `validate-gates.ts` 약 2만 4천, `coordinator.ts` 약 6만 9천 토큰, `scripts/src/lib` 전체 약 57만 토큰이다. 질의 한 번의 출력은 작지만 왕복 횟수가 많으면 맥락 재처리 비용이 쌓인다(질의 횟수가 많은 조건에서 총 토큰이 줄지 않은 것과 일치하나, 왕복 비용만 따로 측정하지는 않았다).

## EPIC-098/BP-003/TASK-001 검증 (2026-10-14)

완료 커밋 `552a22d9`의 변경 파일은 다음 세 개다.

```text
scripts/src/lib/review-dispatch.ts
scripts/src/lib/templates.ts
test/review-dispatch.test.js
```

아래 원본 Graphify 질의 묶음은 같은 세 파일을 식별했다. 단, 아래 test 행은 이후 실험에서 일반화되지 않았다.

| 책임 | 질의 | 식별 파일 |
| --- | --- | --- |
| plan dispatch | `explain "classifyPlanReview"` | `scripts/src/lib/review-dispatch.ts` |
| context-review template | `query "TEMPLATES"` | `scripts/src/lib/templates.ts` |
| 테스트 | test graph의 `query "classifyPlanReview" --context call` | `test/review-dispatch.test.js` |

## 실험 (2026-10-15)

### 방법

- 입력: 이미 쓰인 explain 문서의 Task별 Goal, Current behavior, Target behavior, Interface만 사용했다. 파일 경로와 줄 번호는 `<path>`로 마스킹했다. 정답이 새어 나가는지 별도 점검했고 남은 누출은 파일명이 겹치는 정도(약 4%)였다.
- 정답: 해당 Task 커밋의 실제 변경 파일(`git show --name-only`). `.bouncer/` 아래 문서와 `CHANGELOG.md`는 제외했다. CHANGELOG.md는 릴리스(태그) 때 PR을 보고 기록하는 파일이라 plan 단계에서 예측할 대상이 아니다.
- 스냅샷: BP의 첫 커밋의 부모 커밋을 `git archive`로 풀어 그 시점의 코드로 그래프를 만들었다. 에이전트는 스냅샷 안에서만 탐색하게 했고 `git log`/`show`/`diff`, 정답 파일, 다른 BP 디렉터리는 읽지 못하게 했다.
- 채점: Task별 경로 집합의 precision, recall, F1. BP 단위로 micro 평균을 내고, 조건 간 비교는 같은 BP끼리 짝지은 차이에 부트스트랩 95% 신뢰구간(20,000회)을 구했다. 일부는 부호 검정과 부호 뒤집기 순열 검정도 썼다(정규성 가정이 필요 없다).
- 조건:
  - **A** 규칙 적용: 이 문서의 규칙대로 Graphify(`explain`, 상수 `query`, 테스트 `--context call`)를 쓰고, 그래프에 없는 문서는 `grep`.
  - **B** 규칙 미적용: Task 설명 문장을 자연어 그대로 `graphify query`에 넘김.
  - **C** 후보 생성기: 소스는 Graphify로 확정하고, 소스 외 파일은 후보 생성기(`candidates.py`, 용어 `grep`·소스 import 매칭)가 낸 후보를 에이전트가 판정.
  - **D** 기준선: Graphify 없이 `grep`/`ls`/`find`와 파일 읽기만 사용.

### 실험 목록과 결과

| 실험 | 대상 | 결과 |
| --- | --- | --- |
| E1 | EPIC-099/BP-004 (Task 5개), 변경 후 그래프 | 오염으로 폐기: 그래프에 변경 후 심볼이 이미 있었음. A 0.93, B 0.92(F1 macro) |
| E2 | 같은 BP, 변경 전 그래프, A·B 각 3회 | A 0.90/0.88/0.88, B 0.91/0.74/0.65. B가 실행마다 크게 흔들림 |
| E3 | BP 30개 무작위(시드 42)로 A와 B 1회씩 | 아래 표 |
| E4 | 새 BP 12개(시드 7)로 A, C, D 1회씩 | 아래 표 |
| E5 | E4와 같은 BP 12개로 G(현행 `bouncer graph-suggest` 흐름) 1회씩 | "E5" 절 참고: 34개 Task 전부 후보 0개 |

### E3: BP 30개, A 대 B

| 지표 | A | B | 차이 (A−B) | 95% 신뢰구간 |
| --- | --- | --- | --- | --- |
| micro F1 (CHANGELOG 포함 채점) | 0.777 | 0.660 | +0.117 | [+0.073, +0.162] |
| precision | 0.878 | 0.636 | +0.243 | [+0.182, +0.308] |
| recall | 0.710 | 0.708 | +0.002 | [−0.041, +0.051] |
| 코드 파일만 F1 | 0.806 | 0.610 | +0.196 | [+0.122, +0.278] |

- 부호 검정: F1은 A 25승, B 4승, 동률 1. 순열 검정 p<0.001.
- CHANGELOG.md를 정답에서 빼고 다시 채점하면 A 0.823, B 0.690 (precision 0.878/0.634, recall 0.786/0.785).
- 이득은 precision에서 나왔다. 자연어 질의는 엉뚱한 파일을 많이 돌려주지만, recall은 같았다.

### E4: 새 BP 12개, A 대 C 대 D (CHANGELOG 제외)

| 범위 | A | C | D |
| --- | --- | --- | --- |
| 전체 파일 F1 | 0.796 | 0.813 | 0.776 |
| 소스 파일 F1 (해당 BP 9개) | 0.911 | 0.830 | 0.855 |
| 소스 외 파일 F1 | 0.743 | 0.787 | 0.740 |
| 에이전트 총 토큰 평균 | 50,777 | 53,378 | 47,752 |

- A−D 전체 F1 +0.021 [−0.013, +0.061], C−D +0.037 [−0.021, +0.092]. 모두 0을 포함해 구분되지 않는다.
- 소스 파일만: A−D +0.055 [−0.009, +0.127] (A 4승 1패). C는 D보다 −0.025로 오히려 낮았다. C는 테스트 그래프 질의를 금지했고 후보 판정 단계가 소스 확정과 분리된 영향일 수 있으나 원인은 검증하지 않았다.
- 토큰: A−D +3,026 (+6%, 95% 신뢰구간 [+68, +5,337]), C−D +5,626 (+12%, [+2,895, +7,811]). D 에이전트는 조사 문서를 읽지 않아서 A, C는 규칙 문서를 읽는 고정 비용만큼 불리하다. 이 비용을 분리해서 재지는 않았다.

### E5: 현행 `graph-suggest` 흐름(G)과의 병행 비교

조건 G: 에이전트가 `references/graphify-runner/index.md`의 Rank 단계 규칙(짧은 영어 명사구 `--query`, 입력 설명에 나온 진입 심볼 1~2개 `--seed`, cap 코드일 때만 `--debug` 1회와 shrink 재시도 1회)대로 `bouncer graph-suggest --repo <스냅샷>`만 사용한다. 다른 도구는 금지했다. 예측은 두 가지로 받았다: G(최종 status가 `ranked`일 때만 `suggested_paths`)와 G2(status와 무관하게 후보 전체).

| 지표 | 결과 |
| --- | --- |
| 후보가 하나라도 나온 Task | 0 / 34 (BP 12개 전부) |
| F1 (G, G2 모두) | 0.000 (A 0.796, D 0.776) |
| 최종 reasons | `seed.fanout_cap`, `traversal.frontier_cap`, `implementation.none` 중 하나 (`source.omitted`, `test.omitted`는 모든 호출에 붙음) |
| 에이전트 총 토큰 평균 | G 43,801 / D 47,752 / A 50,777 (결과가 비어 있어서 가장 쌌다) |

원인 확인(스냅샷 하나에서 직접 실행):

- 중심 심볼(`TEMPLATES`, `buildPrDraft`, `classifyRun`)은 `--query`와 `--seed`를 같은 심볼 하나로 최소화해도 `seed.fanout_cap`(2-hop 탐색이 파일 8개 초과)에 걸려 후보가 비었다. 말단 심볼(`normalizeAuthoredLines`)은 `ranked`로 구현 후보 3개를 냈다. 즉 도구는 동작하지만, plan에서 흔한 "중심 함수에서 출발하는 변경"에는 후보를 못 낸다. 첫 조사(`classifyPlanReview`)와 같은 현상이다.
- `source.omitted`/`test.omitted`는 모든 호출에 붙었다. 고정 버전(0.9.56)의 `graphify update`가 `indirect_call`, `method`, `dynamic_import` 관계를 내는데 `graph-search.ts`의 `KNOWN_RELATIONS`(`contains`, `calls`, `imports`, `imports_from`)에 없어서 "skipped unknown relation"으로 버려진다. 프로젝트의 `graph-exec.ts`도 `graphify update`를 그대로 쓰고 제외 디렉터리만 걸러서, 같은 상황이 실제 프로젝트 그래프에도 있을 가능성이 높다(직접 확인하지는 못했다). 이 때문에 `ranked`가 막히지는 않았지만 사유 코드가 항상 붙는다.
- 그래프는 `graphify update scripts/src/lib`, `graphify update test`로 만들었다. 프로젝트의 `graph-sync`(설정 기반 디렉터리, `parts` 병합)와 완전히 같은 경로는 아니다. 위 관계 처리와 8개 상한은 그래프를 만드는 쪽이 아니라 `graph-suggest` 코드의 성질이라 이 차이로 결과가 뒤집힐 가능성은 낮지만, 같은 입력으로 검증하지는 않았다.
- 에이전트 입력은 가려진 설명에서 뽑은 심볼 seed였다. 사용자가 말단 심볼을 seed로 잘 고르면 결과가 달라질 수 있다.

### 정확도 병목 분석 (A 예측 vs 정답)

- 소스(`scripts/src`) 파일: precision 0.87~0.90, recall 0.92. 소스가 있는 Task 69개 중 65개(94%)에서 정답 소스를 빠짐없이 찾았다.
- 소스 외 파일(테스트·규칙·에이전트·문서): precision 0.84~0.86, recall 0.69~0.72.
- 놓친 파일 173개(CHANGELOG 포함 집계)의 구성: 문서 88개(51%), 기존 테스트 46개(27%), 새 파일 35개(20%), 기존 소스 4개. 그중 `CHANGELOG.md`가 Task 46건 중 42건에서 빠졌는데, 이 파일은 정답에서 제외하기로 했다.
- Task의 정답 파일 집합을 한 개도 놓치지도 더하지도 않은 Task(완전 일치)는 27%(70개 중 19개)와 12%(34개 중 4개)였다. plan이 이 목록을 그대로 신뢰하면 대부분 Task에서 누락이나 군더더기가 생긴다.
- 정답에서 아직 존재하지 않는 새 파일의 비중은 9.6%(30개 BP)와 14.9%(12개 BP). 새 파일을 한 번도 맞히지 못하면 F1 상한은 약 0.955와 0.941이다.

### 테스트 그래프가 소스와 이어지지 않는 이유

테스트는 `require('../scripts/lib/<모듈>')`처럼 컴파일된 빌드 산출물을 가져온다. `scripts/lib/`는 Git에 올라가지 않아서 소스 그래프(`scripts/src/lib/*.ts`)와 이름으로만 대응되고, 소스와 테스트를 하나의 그래프로 합쳐도 테스트→소스 연결이 BP 하나 기준 1개뿐이었다.

### 기계적 규칙 시험 (오프라인, 에이전트 없음, BP 42개)

정답 테스트 250개를 유형별로 나누면: 변경된 소스 모듈을 import하는 테스트 48%, 변경된 소스가 아예 없는 Task의 테스트 29%(문서·스킬 변경을 검증), 다른 모듈만 import하는 테스트 17%, `scripts/lib`를 import하지 않는 테스트 6%. 소스를 정확히 알고 있어도 import 규칙의 recall 상한은 48%다.

| 규칙 | precision | recall | F1 |
| --- | --- | --- | --- |
| 소스 외 파일: 용어 `grep`+이름 매칭 색인(TF-IDF 비슷한 점수) | 0.32 | 0.41 | 0.31 |
| 테스트: import 규칙 | 0.27~0.31 | 0.49~0.50 | 0.29~0.31 |
| 테스트: 변경 문서 경로·이름 참조 규칙 (상위 3~6개) | 0.12~0.15 | 0.15~0.27 | 0.12~0.17 |
| 테스트: 두 규칙 합집합 | 0.28~0.32 | 0.62~0.71 | 0.35~0.37 |
| 테스트: 에이전트 A | 0.77 | 0.74 | 0.74 |
| 테스트: 에이전트 A + 두 규칙 | 0.34~0.39 | 0.86~0.89 | 0.45~0.50 |

규칙을 에이전트 결과에 더하면 recall은 오르지만 precision이 크게 떨어져 F1이 낮아진다. 후보를 자동으로 합치는 방식은 쓰지 않는다. (30개 BP에서 만든 초기 프로토타입도 같은 방향: 용어 `grep` 후보 단독 F1 0.30~0.36, 에이전트가 놓친 소스 외 파일 92개 중 48개(52%)는 후보에 있었으나 Task당 오답 후보가 평균 10.4개.)

## 소스코드 대상 쿼리 방법 (권장)

### 규칙

1. Goal, Current behavior, Target behavior, Interface에서 변경 책임을 `source orchestration`, `static template/config`로 먼저 분리한다. 테스트·규칙·문서는 아래 "소스 외 파일 찾기"로 따로 처리한다.
2. 각 책임에서 코드에 실제 존재하는 정확한 ASCII 앵커를 선택한다. 우선순위는 함수명, 상수명. 존재 여부가 확실하지 않은 이름을 짐작해서 조회하지 않는다(없는 심볼 조회가 반복적인 낭비의 원인이었다).
3. 중심 오케스트레이터 함수는 `graphify explain "<symbol>"`로 조회한다.
4. 정적 계약은 `graphify query "<CONSTANT>" --budget 200`으로 조회한다.
5. 한 Task의 여러 앵커 질의는 한 번의 Bash 호출에서 `;`로 묶는다. 왕복 횟수를 줄이기 위해서다.
6. 일반 명사, 긴 자연어, 복수 책임 심볼을 하나의 query에 섞지 않는다.
7. 새로 만들어지는 소스 파일은 그래프에 없다. Task 설명에 이름이 나올 때만 추가하고, 그렇지 않으면 추가하지 않는다.
8. Graphify가 파일 앵커를 식별한 뒤에만 해당 파일의 필요한 부분을 읽는다. Graph 결과는 advisory evidence이며 scope를 자동 확정하지 않는다.
9. 테스트 그래프 질의(`--context call`)는 하지 않는다. 위 이유로 효과가 낮다.

### 소스 외 파일(테스트, 규칙, 에이전트, 스킬, 참조 문서) 찾기

Graphify로는 찾을 수 없으므로 에이전트가 Task 설명을 보고 `grep -l`로 직접 확인한다.

1. Task 설명의 코드 식별자(reason 문자열, 플래그, 심볼)로 문서·규칙을 `grep -l`로 한 번에 조회한다. 일반 영어 단어는 용어로 쓰지 않는다.
2. 확정한 소스 모듈을 import하는 테스트는 `grep -l "scripts/lib/<모듈>" test/`로 확인하되, 이것만으로 정하지 않는다(정답 테스트의 절반 이상을 놓친다). 문서·스킬 변경을 검증하는 공용 테스트(`agents.test.js`, `skill-*.test.js` 등)는 변경 문서 경로를 `grep -l`로 따로 확인한다.
3. `agents/X.md`가 목록에 있으면 생성본 `.codex/agents/X.toml`을 함께 넣는다.
4. `CHANGELOG.md`는 포함하지 않는다.
5. 후보가 많으면(Task당 10개 이상) 근거가 약한 것부터 제거한다. 기계적으로 후보를 추가하는 규칙은 쓰지 않는다.

### 피해야 할 패턴

- 요구사항 전체를 자연어 문장으로 `graphify query`에 전달 (한 번에 약 2,250토큰, 파일 식별도 불안정)
- `plan`, `task`, `review`, `combined`, 숫자 조건처럼 넓게 매칭되는 단어를 seed로 사용
- 서로 다른 source/template/test 책임을 한 질의에 병합
- test 이름·assertion 문자열을 그래프 심볼처럼 검색
- 존재하지 않는 상수명·함수명을 짐작해서 질의 (`HELP_REGISTRY`, `HINTS`, `COMMAND_REGISTRY`처럼 이번 실험에서 반복됨)
- 원본 Graphify의 `--budget`을 탐색 범위 제한으로 해석: 이 옵션은 출력량만 제한하며, 시작 노드와 BFS 폭은 좁히지 않는다.
- 행 번호를 결정에 사용: 줄 번호는 코드가 바뀌면 가장 먼저 어긋난다. 경로와 심볼만 증거로 쓴다.

## 그래프 stale 방지 방법

### 실제로 겪은 문제

- E1은 현재(변경 후) 코드로 만든 그래프에 이미 변경 후 심볼(`commitExceptionResult`, `touchPathEscapesRepo`)이 있어 점수가 부풀었다. 변경 전 커밋 스냅샷에서 그래프를 다시 만들어 해소했다(E2부터).
- 일부 BP 스냅샷에서 에이전트가 "그래프에는 있는데 스냅샷에 없는 파일"을 보고했다. 점검해 보니 외부 모듈 가짜 노드(`node:fs` 등)와 `test/dyn`을 빼면 모든 그래프 파일이 스냅샷에 있었다. 에이전트가 새로 만들어질 파일을 오인한 것이다.
- 한 BP(098-002)는 스냅샷에 앞선 변경이 이미 일부 반영되어 있다고 보고되었다. 설명서에 넣지 않은 선행 Task가 있으면 스냅샷이 그만큼 앞선 상태가 된다.

### 현행 구현

`graph-sync`의 freshness는 "설정된 디렉터리 아래 가장 최근 mtime ≤ graph.json mtime"이다(`references/graphify-runner/index.md`의 Guardrails, `scripts/src/lib/graph-scope.ts`). 파생 산출물(`graphify-out/`)의 mtime은 입력에서 제외한다. mtime 기준은 `git checkout`으로 파일 mtime이 바뀌면 재빌드를 유도하지만, 같은 mtime으로 내용이 바뀌는 경우나 워크트리 사이 복사된 그래프는 잡지 못한다.

### 제안 (이번 실험에서 직접 검증하지 못한 것은 "미검증")

1. **빌드 스탬프 기록**: 그래프를 만들 때 `graphify-out/<graph>/.built-from`에 `git rev-parse HEAD`와 대상 디렉터리의 트리 해시(`git rev-parse HEAD:scripts/src/lib`, `HEAD:test`)를 쓴다. 질의 전에 현재 값과 비교해 다르면 재빌드한다. (미검증)
2. **미커밋 변경 처리**: 트리 해시는 작업 트리의 미커밋 변경을 반영하지 못하므로 `git status --porcelain -- scripts/src test`가 비어 있지 않으면 기존 mtime 검사를 함께 적용하거나 stale로 취급한다. (미검증)
3. **재빌드 비용**: `graphify update <dir>`는 이번 실험에서 소스 약 3~5초였다(1,883 노드 4.9초, 스냅샷 빌드 약 3초). 질의마다 재빌드해도 부담이 작다.
4. **결과 경로 검증**: 질의 결과의 파일 경로를 `test -e`로 확인하고, 존재하지 않는 경로가 나오면 stale 신호로 보고 재빌드한다. 단, 가짜 노드(`node:*`, `test/dyn`)는 제외한다. 이 검사는 이번 실험에서 그래프 점검에 사용했다.
5. **체크아웃별 그래프**: 그래프(`graphify-out/`)는 체크아웃마다 따로 만든다. main 체크아웃의 그래프를 워크트리나 다른 브랜치에서 재사용하지 않는다. plan이 도는 작업 디렉터리에서 빌드한다.
6. **줄 번호 사용 금지**: `explain` 출력의 `L287` 같은 줄 번호는 결정에 쓰지 않고 파일 경로와 심볼만 증거로 쓴다.
7. **평가 시**: 과거 BP를 평가할 때는 BP 첫 커밋의 부모 커밋을 스냅샷으로 풀어 그래프를 만들고, 변경 후 심볼이 그래프에 없는지 확인한다.

## graph-suggest 제거와 원본 Graphify 질의 전환안 (제안, 실제 plan 흐름에서는 미검증)

### 결정과 근거

plan의 수정 대상 파일 추정은 `bouncer graph-suggest` 대신 원본 Graphify 질의(`graphify explain`, `graphify query "<CONSTANT>"`)로 한다. `graph-suggest`와 그 파생물(소스, 테스트, 규칙, 스킬 문서)은 모두 제거한다. 근거:

- E5: 현행 `graph-suggest` 흐름은 BP 12개, Task 34개 전부에서 후보를 내지 못했다(F1 0.000). 같은 BP에서 원본 질의를 쓰는 A는 전체 F1 0.796, 소스 파일 F1 0.911이었다.
- 중심 심볼에서 출발하는 변경은 `graph-suggest`의 2-hop fan-out cap(파일 8개)에 걸린다. 이 cap은 도구의 설계 성질이라 질의를 잘 짜서 피할 수 없다.
- 모든 호출에 `source.omitted`/`test.omitted`가 붙는다. 고정 버전(0.9.56)이 내는 관계 3종이 `KNOWN_RELATIONS`에 없기 때문이다.
- `graph-suggest`를 유지한 채 폴백만 추가하는 안은 쓰지 않는다. 폴백이 사실상 모든 경우에 실행되어 유지 비용(약 2,400줄의 코드와 테스트, 규칙·스킬 문서 다수)만 남는다.

그래프 빌드·freshness·실행 파일 해석 경로(`graph-sync`, `graphify-bin`)는 원본 질의도 같은 그래프를 필요로 하므로 유지한다.

### 대상 파일 (삭제, 수정, 유지)

아래 목록은 `graph-suggest`, `graphSuggest`, `graph-search`, `graphify-suggestions` 문자열로 저장소를 검색한 결과다. 이 문서 작성 시점에 파일은 삭제하지 않았다.

**삭제**

| 파일 | 크기 | 내용 |
| --- | --- | --- |
| `scripts/src/lib/graph-search.ts` | 1,202줄 | `graphSuggest` 구현(점수표, fan-out/frontier cap, 후보 상한) |
| `test/graph-search.test.js` | 1,170줄 | 위 구현의 단위 테스트 |
| `skills/bouncer-plan/references/graphify-suggestions.md` | 20줄 | `graph-suggest` 결과 표시 지침. 원본 질의용 짧은 지침으로 대체하거나 `graphify-runner`에 합친다(아래 "새 plan 흐름") |

**수정 (`graph-suggest` 관련 부분만 제거하거나 원본 질의로 교체)**

| 파일 | 수정 내용 |
| --- | --- |
| `scripts/src/lib/cli-project-commands.ts` | `graph-search` import(21~22행), `parseGraphSuggestArgs`(81행 부근), `cmdGraphSuggest`(151행), 명령 레지스트리의 `'graph-suggest'` 항목(461행)과 usage 문구 제거 |
| `scripts/src/lib/cli.ts` | 52행 `'graph-suggest': projectCommands['graph-suggest']` 매핑 제거 |
| `rules/cli.md` | 190행 근처 `bouncer graph-suggest ...` 사용법과 설명 제거 |
| `references/graphify-runner/index.md` | Step 3 Rank를 원본 질의로 재작성하고 Step 4·Guardrails·Return의 `graph-suggest` 서술 제거(아래 "새 plan 흐름") |
| `skills/bouncer-plan/SKILL.md` | 40·43·207행의 `graph-suggest` stdout, `graphify-suggestions.md` 참조를 원본 질의 안내로 교체 |
| `skills/bouncer-plan/references/scope-confirm.md` | 4행 `graph-suggest` stdout 표현을 원본 질의 결과로 교체 |
| `rules/document-schema.md` | 47·51·66행의 "`graph-suggest`가 쓰는 검색 어휘" 서술을 "원본 Graphify 질의/`grep`이 쓰는 어휘"로 교체 |
| `references/spec-authoring/index.md` | 236~242행 tags 작성 지침의 `graph-suggest` 언급 교체. 예시 태그 `graph-suggest`는 다른 단어로 바꾼다 |
| `docs/architecture/rule-ownership.md` | 71행의 plan 소유권 표에서 `graphify-suggestions.md` 항목 갱신 |
| `scripts/check-doc-shape.js` | 877행의 `graphify-suggestions.md` 참조 목록 갱신 |
| `test/cli-help.test.js` | 11행 명령 목록, 117~128행 `graph-suggest` usage 테스트 제거 |
| `test/cli-project-commands.test.js` | 885~911행 부근 `graph-suggest` 테스트 제거 |
| `test/tiers.json` | 19행 `graph-search.test.js` 항목 제거 |
| `test/skill-bouncer-plan.test.js` | 14행의 파일 목록에서 `graphify-suggestions.md` 제거(또는 대체 파일명으로 교체) |
| `test/skill-bouncer-surface.test.js` | 205·268행의 `graphify-suggestions.md` 항목 제거(또는 대체 파일명으로 교체) |
| `benchmarks/acp/fixtures/acq/plan-affected-paths-{en,en-2,ko}.md` | `graph-suggest` 언급을 확인한 뒤 있으면 교체 (벤치마크 입력이라 변경 영향 확인 필요) |

**유지**

| 파일 | 이유 |
| --- | --- |
| `scripts/src/lib/graph-exec.ts`, `graph-scope.ts`, `graphify.ts`, `session-graph.ts`와 각 테스트 | 그래프 빌드, freshness, 실행 파일 해석, SessionStart 동기화. 원본 질의도 같은 그래프를 쓴다 |
| `bouncer graph-sync`, `bouncer graphify-bin` 명령 | 위와 같은 이유 |
| `CHANGELOG.md` | 이력 문서. 제거 사실은 다음 릴리스 기록에 적는다 |
| `.bouncer/context/` 아래 `graph-suggest`를 언급하는 과거 계획·설명 문서 23개 | 이력 기록이라 수정하지 않는다 |
| `scripts/lib/`(컴파일 산출물, Git 무시) | 소스 수정 후 `npm run build`로 재생성한다 |

**열린 결정**: `test` 그래프를 더 이상 질의하지 않으므로 `config.graphify.test_dirs`로 만드는 테스트 그래프가 필요한지 정한다. 필요 없다면 `graph-scope.ts`의 test 스코프와 `graph-sync` 보고 항목을 줄이는 후속 작업이 생기고, 해당 테스트도 바뀐다. 이번 제거 범위에는 넣지 않았다.

### 새 plan 흐름 (`graphify-runner` Step 3 재작성안)

1. **그래프 동기화**: 기존대로 `bouncer graph-sync`. 결과를 per-graph `basis`(graph, status, query, result)로 기록하는 규칙도 유지한다. 위 stale 방지 제안 1~2(빌드 스탬프)를 이 단계에 넣는다.
2. **실행 파일 해석**: 기존대로 `GRAPHIFY_BIN="$(bouncer graphify-bin)"`. 비어 있으면 상태로 보고 소스 탐색을 `grep`으로 폴백한다(D 조건이 A와 구분되지 않았다).
3. **소스 후보(원본 Graphify 질의)**:
   - Task 설명에서 변경 책임의 앵커(실제로 존재하는 함수명·상수명)를 고른다. 짐작한 이름은 쓰지 않는다.
   - 앵커마다 `"$GRAPHIFY_BIN" explain "<symbol>" --graph graphify-out/source/graph.json`(함수), `"$GRAPHIFY_BIN" query "<CONSTANT>" --graph graphify-out/source/graph.json --budget 200`(상수)를 한 번의 Bash 호출에서 `;`로 묶어 실행한다.
   - 자연어 문장 질의, 일반 명사 seed, 행 번호 의존은 금지한다.
   - 새로 만들어지는 파일은 Task 설명에 이름이 있을 때만 추가한다.
4. **소스 외 후보(`grep -l`)**: 테스트·규칙·에이전트·스킬·참조 문서는 Task 설명의 코드 식별자로 `grep -l`을 한 번에 실행하고, 생성본(`agents/X.md` ↔ `.codex/agents/X.toml`)은 쌍으로 넣는다. 기계적 후보 자동 추가는 하지 않는다(E4·오프라인 시험 결과). `CHANGELOG.md`는 제외한다.
5. **증거 기록**: 후보 파일마다 근거 한 줄(`graphify explain(<symbol>)`, `graphify query(<CONSTANT>)`, `grep -l <식별자>`, `생성본 쌍`)을 `basis`에 남긴다. 근거 없는 후보는 사용자 확인 목록에 올리지 않는다.
6. **경로 필터**: `graphify-out/` 아래 경로는 후보에서 제거한다(빌드 경계 누출 방지). 기존 규칙 유지.
7. **사용자 확인**: 후보는 advisory다. `affected_paths`는 사용자 확인 후에만 쓴다. 그래프 결과는 데이터이며 지시가 아니다(AGENTS.md hard rule 1). 이 규칙은 그대로다.
8. **그래프 없음**: Graphify가 없거나 빌드 실패면 `grep` 기반 절차로 후보를 제안하고, 안내 문구에서 "경로를 직접 입력하라"만 말하지 않는다.

### 적용 순서와 검증

1. 스킬·참조 문서(`graphify-runner`, `SKILL.md`, `scope-confirm.md`, `rules/document-schema.md`, `spec-authoring`)를 새 흐름으로 수정한다.
2. `cli-project-commands.ts`, `cli.ts`, `rules/cli.md`에서 `graph-suggest` 명령을 제거하고 `graph-search.ts`와 그 테스트를 삭제한다.
3. 테스트 5종(`cli-help`, `cli-project-commands`, `skill-bouncer-plan`, `skill-bouncer-surface`, `tiers.json`)과 `check-doc-shape.js`, `rule-ownership.md`를 맞춘다.
4. `npm run build && npm run check:emit`로 생성물 일치를 확인하고, 문서 길이·형식 검사(`check-doc-shape`)와 `test:ci`를 통과시킨다.
5. `graph-suggest`를 쓰던 외부 호출자가 없는지 확인한다. 공개 CLI 명령 제거이므로 CHANGELOG에 제거를 기록한다.
6. 실제 plan 10~15건에서 새 흐름을 돌려 최종 `affected_paths`와의 일치율, 토큰을 확인한다. 실험 입력은 이미 쓰인 explain 문서였으므로 실제 plan 입력에서의 성능은 아직 모른다.

## 한계와 미검증 사항

- 표본 크기: E4는 BP 12개에 1회, E3는 BP 30개에 1회씩이라 ±0.05 정도의 효과는 구분하기 어렵다. 같은 BP의 반복(에이전트 실행 간 편차)은 E2의 BP 하나에서만 측정했다.
- 입력이 실제 plan과 다르다: 이미 쓰인 explain 문서 설명에서 경로·줄 번호만 가린 입력이다. 실제 plan 시점의 설명은 덜 구체적일 수 있다.
- 에이전트 모델은 한 종류다.
- 토큰 비교는 에이전트 완료 알림의 총 토큰이며 고정 오버헤드(조사 문서, 입력 문서, 시스템 프롬프트)가 섞여 있다. 질의 출력 크기 실측과 다르게, 왕복 비용은 직접 분리해 재지 않았다.
- 문서 그래프(`graphify extract`)는 LLM 백엔드가 없어 시험하지 못했다. 마크다운을 의미 추출한 그래프가 소스 외 파일 recall을 올리는지는 모른다.
- BP는 첫 커밋 부모의 단일 스냅샷으로 평가했다. 여러 Task로 이루어진 BP의 뒤쪽 Task는 앞선 Task의 변경을 전제한 설명인데 스냅샷에는 그 변경이 없다.
- 정답 파일에 새 파일이 10~15% 포함되어 있어 F1 0.9 목표의 상한을 낮춘다. 평가에서 새 파일을 별도로 집계하는 방법도 고려할 수 있다.
- 일부 BP는 설명서 형식 차이로 앞쪽 Task가 선정에서 빠졌다(예: 098-002). 이 경우 스냅샷이 일부 변경된 상태일 수 있다.

## 권장 evidence 형식

```text
Graphify evidence
- source orchestration: explain(classifyPlanReview)
  -> scripts/src/lib/review-dispatch.ts
- template contract: query(TEMPLATES)
  -> scripts/src/lib/templates.ts

Non-source evidence (grep)
- test: grep -l "scripts/lib/review-dispatch" test/ + 용어 일치
  -> test/review-dispatch.test.js
- docs/agents: grep -l "<식별자>" rules/ agents/ references/ skills/
  -> agents/bouncer-coordinator.md  (+ .codex/agents/bouncer-coordinator.toml 생성본)
```

이 형식은 작은 결과를 유지하면서도 소스 영향 경로는 Graphify로, 소스 외 영향 경로는 `grep` 근거로 각각 확인하게 한다. CHANGELOG.md는 포함하지 않는다.

## 재현 방법

실험 산출물과 스크립트는 모두 `graphify-out/`(Git 무시) 아래에 있고 버전 관리되지 않는다.

- `graphify-out/eval3/`: BP 30개 입력, 정답, 스냅샷, 예측(`out/pred-{A,B}.json`), 분석 스크립트 `analyze.py`
- `graphify-out/eval4/`: BP 12개 입력, 정답, 스냅샷, 예측(`out/pred-{A,C,D}.json`), `build4.py`(후보 선정과 스냅샷·그래프 빌드), `candidates.py`(후보 생성기), `score4.py`·`score_acd.py`(채점), `tokens.json`(에이전트별 토큰)
- `graphify-out/nonsrc_index.py`, `graphify-out/docref.py`: 기계적 규칙 시험(오프라인)
- `graphify-out/eval/`(BP-004 입력·정답·채점기)와 `graphify-out/eval2/`(BP-004 변경 전 그래프와 A·B 각 3회 예측)는 남아 있다. 세션 임시 폴더에 있던 BP 선정·빌드 스크립트(`scan3.py`, `build3.py`)는 정리되어 없고, `eval4/build4.py`가 같은 절차를 한 파일로 재구성한 것이다. E3의 BP 선정은 무작위 시드 42였다.
- 이 문서의 수치를 다시 얻으려면 Graphify 가상환경을 위 방법으로 재설치해야 한다.
