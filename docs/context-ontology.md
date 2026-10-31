# Context ontology 사용법

`bouncer ontology`는 `.bouncer/context`의 문서를 매 조회 메모리에서 색인해 정확한 엔티티·파일 일치와 한 단계 영향 후보를 JSON으로 출력하는 읽기 전용 명령이다. 색인이나 캐시 파일은 만들지 않는다.

```sh
bouncer ontology entity --entity G5
bouncer ontology file --file src/cli.ts --repo /path/to/checkout --limit 10
bouncer ontology impact --file docs/context-ontology.md
```

`--repo`를 생략하면 현재 디렉터리를 사용한다. 상대 경로는 현재 디렉터리 기준으로 해석되며, 해당 경로가 Git checkout 자체여야 한다. 하위 디렉터리에서 실행해도 저장소 루트로 자동 이동하지 않는다. `--limit`은 기본 20, 범위는 1부터 100이다. `--warnings`는 `summary`(기본) 또는 `detail`이다. 결과 배열은 안정적으로 정렬되고, `total`은 전체 개수이며 `truncated`는 지정한 limit 때문에 일부가 생략됐음을 나타낸다.

질의는 정확히 일치한다. `entity`는 토큰을 부분 검색하지 않는다. `file`·`impact`는 저장소 상대 경로를 받으며, 현재 경로가 HEAD의 blob이면 `git log --follow`가 이은 과거 이름까지 합쳐 조회한다. 반대 방향(옛 이름으로 새 이름 쪽 blueprint를 찾는 일)은 하지 않는다. 이름 이음은 git `-M` 기본 유사도(50%)를 따른다. 이력이 없거나 HEAD에 파일이 없거나 커밋이 없는 저장소는 입력 경로 한 키만 조회한다. `impact`는 그 합집합 blueprint에서 시작해 공유 엔티티나 파일을 통해 한 단계만 확장한다. 이 관계는 발견 후보를 보여줄 뿐 인과 관계나 실제 변경 영향을 증명하지 않는다.

정상 응답에는 결과가 없어도 `version`, 질의, `results`, `total`, `truncated`, `aliases`, `warnings`가 포함된다. `aliases`는 질의 경로를 제외한 과거 이름이며 사전순이다. `entity`와 이력이 없는 질의는 `aliases`가 빈 배열이다. 빈 `results`는 일치 항목이 없다는 뜻이다. 기본 `warnings`는 `{ "total": <n>, "by_code": { "<code>": <n> } }` 요약이다. `by_code` 키는 코드 사전순이며 개수 합이 `total`과 같다. 경고가 없으면 `{ "total": 0, "by_code": {} }`이다. `--warnings detail`일 때만 `details` 배열이 붙고, 항목은 `{code, source, line, detail}`이며 코드·출처·줄·설명 순이다. 경고가 있어도 사용 가능한 결과는 반환한다. draft 문서도 색인 대상이므로 상태를 확인한 뒤 해석한다.

잘못된 옵션, 안전하지 않은 경로, 범위를 벗어난 limit, 코어가 거절하는 입력은 stderr에 `ontology:` 설명을 출력하고 exit 2로 끝난다. 저장소나 파일 I/O 실패는 stderr와 exit 1을 사용한다. stdout은 성공한 JSON 한 줄에만 사용한다.

명령은 실행 때마다 최신 문서를 읽어 메모리 색인을 새로 구성한다. 따라서 반복 질의는 별도 준비 단계 없이 최신 context를 반영하며, 디스크 캐시 관리가 필요 없다. 개발 checkout에서는 [설치 안내](install.md)의 build 정책에 따라 배포용 `scripts/lib` 산출물을 생성한다. 생성본은 소스처럼 직접 편집하거나 별도 관리하지 않는다.
