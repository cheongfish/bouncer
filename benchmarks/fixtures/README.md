# 기준 프로젝트

`ledger-cli.bundle`은 Bouncer와 관계없는 독립 Git 저장소의 기준 커밋을 담는다.
이 파일에서 매 실험마다 새 checkout을 만들고, 두 조건 모두 아래 SHA에서 시작한다.

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
