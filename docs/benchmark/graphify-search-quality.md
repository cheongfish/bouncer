# Graphify 검색 품질 고정 평가

고정 corpus로 context-first `graph-suggest`와 기존 자연어+BFS+디렉터리 롤업 후보의 precision·recall을 같은 정답 경로로 비교한다. 임계치 미달은 `test/graph-search-quality.test.js`가 실패로 남긴다. 이 문서는 수치와 재현 명령만 기록한다.

## Corpus

출처: 저장소 루트 `graphify-evaluation.md` discovery(읽기 전용). 사례 `light-plan`, `verification-ledger`, `graphify-bootstrap`의 최소 node·link slice와 gold·legacy 후보는 `test/fixtures/graph-search-quality.json`에 고정했다. context 본문은 넣지 않았다.

## 측정 환경

| 항목 | 값 |
| --- | --- |
| Graphify package | `0.8.22` |
| Graphify skill | `0.9.41` |
| 검색 API | Task 002 `graphSuggest` (`scripts/lib/graph-search.js`) |
| `exclude_dirs` | `scripts/lib` |
| top-N 절단 | 10 |

원 실험 source 탐색 노드 수(97·36·71)는 보조 지표다. precision·recall 분모로 쓰지 않는다.

| 사례 | legacy source 탐색 노드 |
| --- | ---: |
| `light-plan` | 97 |
| `verification-ledger` | 36 |
| `graphify-bootstrap` | 71 |

## 임계치

| 지표 | 임계치 |
| --- | --- |
| 상위 10개 중 관련 구현 | ≥ 7 |
| 필수 구현 recall | ≥ 80% |
| 무연결 test-only 비율 (세 사례 top-10 합집합) | ≤ 10% |
| generated (`exclude_dirs` 아래) | 0 |
| 저신뢰 프로브 | 빈 `suggested_paths` + 비어 있지 않은 `reasons` |

추천 합집합 분모가 0이면 평가 실패다.

## 기존·신규 precision / recall

같은 gold implementation·같은 top-10 절단. legacy는 fixture `legacy_candidates`. 신규는 `graphSuggest` 구현 후보.

| 사례 | legacy precision | legacy recall | new precision | new recall | new status |
| --- | ---: | ---: | ---: | ---: | --- |
| `light-plan` | 0.00 | 0.00 | 1.00 | 1.00 | ranked |
| `verification-ledger` | 0.00 | 0.00 | 1.00 | 1.00 | ranked |
| `graphify-bootstrap` | 0.10 | 0.14 | 1.00 | 1.00 | ranked |

세 사례 모두 상위 10개(구현 후보 기준) 관련 구현 7개. `light-plan`의 `low_confidence_probe` 질의 `plan gate test result`는 `low-confidence`와 빈 추천을 남긴다.

## 신규 test-only · generated

세 사례 신규 top-10 추천 합집합 기준(마지막 통과 측정).

| 지표 | 값 |
| --- | ---: |
| unlinked test-only rate | 0.00 |
| generated count | 0 |

## 재현

```bash
npm test -- test/graph-search-quality.test.js
```

전체 회귀:

```bash
npm run ci
```
