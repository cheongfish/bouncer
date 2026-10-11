# 기준 프로젝트

상류 커밋 과제의 기준 프로젝트는 `build-upstream-task.cjs`가 만든 생성물이다. 부모 트리 스냅샷은
`fixtures/upstream/<task-id>.bundle`에 담기고, 이 디렉터리는 Git이 무시한다(`.gitignore`).
만드는 법과 채점 방식은 [`../upstream/README.md`](../upstream/README.md)를 따른다.

실행기는 카드의 `base_commit`을 head로 가진 bundle 하나를 찾아 매 실험마다 새로 clone한다.
두 조건 모두 같은 SHA에서 시작한다.

```sh
git clone benchmarks/fixtures/upstream/<task-id>.bundle <새-실행-디렉터리>
git -C <새-실행-디렉터리> rev-parse HEAD
```

두 번째 명령의 결과가 카드의 `base_commit`과 같아야 한다. 실험 checkout에는
`benchmarks/tasks/`를 복사하지 않는다. bundle은 한 번 고정한 기준 코드이며,
과제를 바꾸려고 덮어쓰면 새로운 벤치마크 버전과 기준 SHA가 필요하다.

카드의 `workspace_setup`이 `apply_index_patch`·`copy`를 쓰면 원본 파일을 이 디렉터리에 둘 수 있다.
상류 과제는 `install_dependencies`로 고정한 `node_modules`를 복사한다.
