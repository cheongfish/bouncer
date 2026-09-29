# 기준 프로젝트

`ledger-cli.bundle`은 Bouncer와 관계없는 독립 Git 저장소의 기준 커밋을 담는다.
이 파일에서 매 실험마다 새 checkout을 만들고, 두 조건 모두 아래 SHA에서 시작한다.
`ledger-001`이 이 bundle을 쓴다.

| 항목 | 값 |
| --- | --- |
| 프로젝트 | Ledger CLI (Node.js, 외부 의존성 없음) |
| 기준 커밋 | `a75fd4165864f1459221695012894d6333382bf7` |
| Node.js | 20 이상 |
| 기존 검증 | `npm test` |

새 checkout을 만드는 예시:

```sh
git clone benchmarks/fixtures/ledger-cli.bundle <새-실행-디렉터리>
git -C <새-실행-디렉터리> rev-parse HEAD
```

두 번째 명령의 결과가 위 SHA와 같아야 한다. 실험 checkout에는
`benchmarks/tasks/`를 복사하지 않는다. bundle은 한 번 고정한 기준 코드이며,
과제를 바꾸려고 덮어쓰면 새로운 벤치마크 버전과 기준 SHA가 필요하다.

## ledger-cli v2

`ledger-cli-v2.bundle`은 v1 위에 모듈 분리·`summary`·`list --category`를 더한 기준
프로젝트다. `ledger-002`–`ledger-004` 파일럿 과제가 쓴다. 구조와 심어 둔 결함은
[파일럿 설계](../tasks/ledger-v2-pilot.md)에 적었다. 이 README와 설계 문서는 평가 전용이다.

| 항목 | 값 |
| --- | --- |
| 기준 커밋 | `934cb3433f649447372f46051d703a5388384b72` |
| 기존 검증 | `npm test` (28개 통과) |

`ledger-003`만 clone 직후 사전 상태를 적용한다.

```sh
git -C <새-실행-디렉터리> apply --index benchmarks/fixtures/ledger-003.wip.patch
mkdir <새-실행-디렉터리>/ci-artifacts
cp benchmarks/fixtures/ledger-003.test-report.txt <새-실행-디렉터리>/ci-artifacts/test-report.txt
```

적용 후 작업 트리의 `npm test`는 29개 통과, 1개 실패여야 한다.
