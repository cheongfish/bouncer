# co-change-impact

과거 커밋에서 함께 바뀐 파일 이력이 BP의 소스 외 변경 파일(테스트·규칙·에이전트·스킬·참조 문서)을
예측하는지 재는 백테스트다. 컨텍스트 문서 frontmatter의 `task_commits`로 BP와 커밋을 잇는다.
결과와 판단은 [`case-study.md`](case-study.md)에, 그 뒤 논의와 다음 실험 계획은
[`ontology-retrieval-plan.md`](ontology-retrieval-plan.md)에, 앞선 Graphify 질의 실험은
[`graphify-query-investigation-2026-10-14.md`](graphify-query-investigation-2026-10-14.md)에 있다.

```text
benchmarks/co-change-impact/
  README.md
  case-study.md                                 결과와 결정 기록
  ontology-retrieval-plan.md                    온톨로지 논의·손익·다음 실험 계획
  context-search-share.py                       세션 기록에서 컨텍스트 검색 비중 측정
  graphify-query-investigation-2026-10-14.md    Graphify 질의 실험 기록(사본)
  backtest.py                                   백테스트 실행기
  summarize.py                                  집계·부트스트랩
  results.json                                  BP별 결과(2026-10-15, develop 711be703)
  summary.txt                                   summarize.py 출력
```

## 실행

저장소 루트에서 실행한다. 외부 패키지는 쓰지 않는다(Python 3 표준 라이브러리, `git`).

```bash
python3 -I benchmarks/co-change-impact/backtest.py . /tmp/co-change-results.json
python3 -I benchmarks/co-change-impact/summarize.py /tmp/co-change-results.json
```

BP 56개 기준 수 분이 걸린다. 결과는 실행 시점의 `.bouncer/context`와 git 이력에 따라 달라진다.

## 평가 설계

- 표본: `explain.md`의 `task_commits`가 실제 커밋으로 풀리고, 소스와 소스 외 변경이 모두 있는 BP
- seed: BP가 바꾼 `scripts/src/` 파일. 소스 탐색은 해결됐다고 가정한다(낙관적 가정)
- 정답: BP가 바꾼 소스 외 파일. `.bouncer/`, `scripts/lib/`(빌드 산출물), `package-lock.json`, `CHANGELOG.md`는 뺀다
- 학습 데이터: BP 첫 커밋보다 이른 `git log --no-merges` 커밋만 사용한다. 파일 60개를 넘는 커밋은 일괄 변경으로 보고 뺀다
- 후보: BP 첫 커밋의 부모 트리에 있는 파일만 인정한다

| 조건 | 정의 |
| --- | --- |
| G | seed 파일 stem을 `git grep -l -F`로 `test rules agents skills references .codex docs hooks resources`에서 찾음 |
| C | co-change 지지도 2 이상, 신뢰도(동시 변경 수 / seed 변경 수) 0.2 이상 |
| CK | co-change 신뢰도 상위 8개(지지도 2 이상) |
| U | G ∪ C |
| R | G 후보를 co-change 신뢰도(지지도 1 이상)로 정렬한 상위 15개 |
| GC | G 중 co-change 이력이 한 번이라도 있는 파일 |
| RU | G와 co-change 후보의 합집합을 신뢰도로 정렬한 상위 15개 |

조건 간 비교는 같은 BP끼리 짝지은 F1 차이에 부트스트랩(5,000회) 95% 신뢰구간을 구한다.
