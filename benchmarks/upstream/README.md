# 상류 저장소 커밋 과제

`ledger-cli`보다 큰 코드베이스에서 Bouncer와 vanilla를 비교하려고, 공개 저장소의 실제 커밋을
과제로 쓴다. 커밋의 부모 트리가 과제 스냅샷이고, 커밋이 추가·수정한 테스트가 숨은 채점
기준이다. 정답이 상류 유지보수자의 판단이라 채점이 결정적이다.

| 파일 | 내용 | Git |
|---|---|---|
| `upstream/<task>.json` | 상류 저장소·커밋, 스냅샷 정체성, 숨은 테스트, 채점 항목 | 추적 |
| `upstream/<task>.package-lock.json` | 의존성 고정 lockfile | 추적 |
| `tasks/<task>.yaml`, `tasks/<task>.prd.md` | 과제 카드와 요청 | 추적 |
| `fixtures/upstream/<task>.bundle` | 스냅샷 bundle | 생성물(무시) |
| `fixtures/upstream/<task>/hidden/` | 상류 커밋의 숨은 테스트 파일. 테스트 실행기가 찾지 못하게 `<경로>.hidden`으로 둔다 | 생성물(무시) |
| `fixtures/upstream/<task>/deps/node_modules` | lockfile로 설치한 의존성 | 생성물(무시) |
| `fixtures/upstream/<task>/baseline.json` | 스냅샷에서 통과하는 회귀 테스트 파일 | 생성물(무시) |

## 만들기

```sh
node benchmarks/build-upstream-task.cjs fastify-001 --check-solution
```

네트워크(Git, npm)와 Docker가 필요하다. 상류 저장소는 `.benchmarks/upstream-cache/`에 bare clone한다.

- 스냅샷은 상류 부모의 트리로 만든 부모 없는 커밋이다. 작성자·날짜를 고정하므로 같은 트리는 항상
  같은 SHA가 되고, 과제 카드의 `base_commit`과 설정의 `snapshot.commit`이 이를 고정한다. 다르면
  빌드가 멈춘다. 에이전트는 상류 이력과 정답 커밋을 볼 수 없다.
- 회귀 기준선은 채점과 같은 verifier 컨테이너(네트워크 없음, 읽기 전용 루트)에서 계산한다.
- `--check-solution`은 손대지 않은 스냅샷과 상류 정답을 채점해 출력한다. 정답이 100점이 아니면
  과제를 고치기 전에 유료 실행을 하지 않는다.

## 실행에서 달라지는 점

- 과제 카드의 `workspace_setup`에 `install_dependencies: <task>`를 두면 실행기가 고정 의존성을 작업
  공간 `node_modules`에 복사한다. 두 조건이 같은 설치 상태에서 시작한다. 작업 공간 보관에서는
  `node_modules`를 뺀다.
- Bouncer worker worktree는 작업 공간 안(`.worktrees/…`)에 있어 Node 모듈 해석이 상위
  `node_modules`를 찾는다.
- 검증기는 `verifiers/upstream-tests.cjs` 하나를 설정 파일로 공유한다.

## 과제

| 과제 | 상류 | 규모 | 설명 |
|---|---|---|---|
| `fastify-001` | fastify/fastify#6521 (`f376f608`) | 24개 파일, +906/−305 | 핸들러 단위 타임아웃과 `request.signal`. 실행 계획: [`tasks/fastify-001-pilot.md`](../tasks/fastify-001-pilot.md) |

## 채점 뒤 도구

- `node benchmarks/score-archived-run.cjs <run-id>`: `finalize.remainder`에서 멈춘 bouncer-full 실행을
  작업 공간 아카이브의 integration HEAD로 채점한다.
- `python3 benchmarks/aggregate/workflow-breakdown.py <run-id> ...`: 실행별 점수·처리량과 세션·도구
  호출 분류.
