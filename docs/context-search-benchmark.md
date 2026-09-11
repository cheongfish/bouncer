# Context search benchmark

## 재현 메타데이터

Q1–Q6은 한 checkout과 한 graph build에서 측정했다. baseline과 새 검색 사이에
graph를 다시 만들지 않았다.
기록한 graph build SHA는 임시 corpus의 `context`, `source`, `test`
`graph.json` raw bytes를 그 순서로 연결한 SHA-256이며, test가 매 실행마다
실제 graph bytes에서 다시 계산한다.

| 항목 | 값 |
| --- | --- |
| commit | `d7cc974b53794635654c77923dddbe9fe585cd5e` |
| graph build SHA | `f6e47b6d34610b37288c5b4b8aabd849ef3f1e6dc05517fed48492f055d67eca` |
| Graphify CLI | `0.8.22` |
| build time | `2026-09-10T16:18:40+09:00` |
| fixture | `test/fixtures/context-corpus-queries.json` |
| timing environment | Node `v24.13.1`, `linux-x64` |

재현 명령은 `node --test test/context-corpus-search.test.js
test/graph-search.test.js`다. `planning retrieval tokens`는 같은 Q1–Q6 요청과
반환 JSON을 tokenizer에 넣어 합산한 값이며, 질의 자체나 시스템 prompt는 넣지
않았다. 따라서 두 방식의 검색 주입량만 비교한다.

검색 시간은 `performance.now()`로 Q1–Q6 한 batch를 10회 warm-up 후
100회 반복해 median과 p95를 기록했다. 두 방식은 같은 process와
같은 임시 graph 세트를 순차로 사용했다.
baseline은 `graphSuggest`의 direct BFS 출력, 새 검색은 `contextSearch`의
실제 출력에서 rank·Recall·MRR·후보 수를 계산한다. JSON에 복제한
후보 목록은 두지 않는다.

## 결과

| 방식 | Recall@8 | MRR | broad FP | zero-hit | 후보 중앙값 | tokens | median ms | p95 ms |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| direct BFS | 0.1111 | 0.25 | 0.0 | 0.0 | 0 | 1,844 | 0.273 | 0.357 |
| context-search | 1.0 | 1.0 | 0.0 | 1.0 | 3 | 612 | 0.470 | 0.594 |

Recall@8은 모든 기대 문서의 top-8 포함 비율이고 MRR은 기대 문서가 있는
Q1·Q2·Q3·Q6에서 첫 기대 문서의 reciprocal rank 평균이다. Q4와 Q5는 정답
후보가 없다. 각각 `low-confidence: broad-query`, `zero-hit`이어야 하며 빈 후보가
정답이다.

| query | mode | status | expected rank |
| --- | --- | --- | --- |
| Q1 | decision | ranked | 1, 3, 2 |
| Q2 | implementation | ranked | 3, 1 |
| Q3 | decision | ranked | 1, 2 |
| Q4 | decision | low-confidence: broad-query | 없음 |
| Q5 | decision | zero-hit | 없음 |
| Q6 | history | ranked | 1, 2 |

Q4·Q5는 사람이 후보를 보충하지 않았다. JSON fixture의 빈
`expected_docs`와 실행으로 계산한 빈 `expected_ranks`, 검색기의 실제 빈
`candidates` assertion이 임의 추천 회귀를 거절한다.

## 마지막 legacy read와 제거 순서

현재 self-hosted cycle은 `docs/distill-decommission-audit.md`의 48개 항목 매핑과
local focused test를 마지막 입력으로 읽었다. 그 다음 tracked master와 일곱 shard,
plan/finalize의 두 전용 reference를 삭제했다. 삭제 뒤 원본 context corpus를
`mktemp` checkout으로 복사해 `buildContextDigest`와 Graphify 0.8.22 `update`를
실행했다. repo의 보호된 `graphify-out/`은 쓰지 않았다. 생성 map은
471 entries, graph는 6,347 nodes/5,876 links였고, map과 node/link
`source_file`에 삭제된 master·shard 경로는 0개였다. SHA-256와 명령
형태는 JSON의 `post_deletion_regeneration`에 기록했다.
역사 epic 본문의 과거 용어는 변경하지 않으며 active-leftover 검사는 별도
allowlist로 역사 corpus를 제외한다.
