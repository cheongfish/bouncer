# 컨텍스트 온톨로지 CLI 통합 기록과 남은 작업

2026년 10월 18일, 사용자의 요청에 따라 온톨로지 CLI 구현과 lint 복구를 메인 워크트리의 `develop`에 fast-forward로 통합했다. 기준은 `61651ba5`, 통합 결과는 `18d19f6f701c22bb2af40b6b4303f984be525ee1`이다. 전체 CI 실패와 미해결 리뷰 지적은 아래 후속 작업으로 남아 있다.

## 통합 내용

`bouncer ontology entity --entity <token>`, `bouncer ontology file --file <path>`, `bouncer ontology impact --file <path>`를 추가했다. 명령은 기존 코어를 지연 적재하고 JSON 결과를 출력하며 입력 오류는 exit 2, I/O 오류는 exit 1로 구분한다. help, 테스트 계층 등록, [사용 안내](../context-ontology.md)를 함께 추가했다.

사용자가 추가 승인한 lint 복구는 `scripts/src/lib/cli-ontology-command.ts`, `scripts/src/lib/context-ontology.ts`, `test/cli-ontology.test.js` 세 파일에 적용했다. 해당 파일의 lint 오류 68개를 수정했고, 복구 worker의 ESLint 검사와 CLI·코어 테스트 16개가 통과했다. 최초 CLI 구현의 관련 회귀 테스트는 102개가 통과했다. 두 테스트 집합은 중복되므로 합산하지 않는다.

| 변경 | worker 커밋 | integration 커밋 |
| --- | --- | --- |
| CLI·테스트·사용 문서 | `e32c2cb41a31422d357641e66b21ecc497f609b3` | `1c69027be66b5263c38a03a039631e53cb3478d5` |
| 코어·CLI·테스트 lint 복구 | `239c41295450e42d224cc7fa623d9399e0cd6e1a` | `18d19f6f701c22bb2af40b6b4303f984be525ee1` |

## 메인 워크트리 통합 후 검증

`develop` fast-forward 뒤 `npm run build`와 `node --test test/cli-ontology.test.js test/context-ontology.test.js`를 다시 실행해 성공했다(16 pass, 0 fail). `git diff --check`도 통과했다. 이후 사용자가 `git push`를 실행해 `origin/develop`에도 `61651ba5..18d19f6f`를 반영했다.

## 남은 CI 실패

통합 결과의 `npm run ci`는 exit 1이다. `test/commit-hook.test.js:544`의 테스트 이름에 필수 구분자 ` → `가 없어 `lint:test-names`가 실패한다. debugger가 아래 명령으로 재현했다.

```sh
node scripts/check-test-names.js test/commit-hook.test.js
```

해당 파일은 승인된 ontology CLI·코어 lint 범위 밖이므로 `outside_scope`로 기록했다. 이 분류는 CI 통과를 뜻하지 않는다. 종단 작업은 `verifying`에 남아 있고, 실패 증거 ID는 `8afc752ea9896da973b5cf799dff8ac3a381d25cf9bcbd54b2196840dcfed61c`, 연결된 source는 `18d19f6f701c22bb2af40b6b4303f984be525ee1`이다.

후속 수정에서는 테스트의 동작을 유지하면서 이름 형식을 바로잡고, 위 단일 파일 검사와 전체 `npm run ci`를 다시 실행해야 한다.

## 남은 리뷰 지적

`CT-001`은 `major / must_fix / deferred`다. `test/cli-ontology.test.js:52–65`에서 다음 관찰 가능한 결과의 구체적인 기대값 검증이 부족하다.

- 복수 결과가 계약에 맞게 정렬되는지.
- evidence가 fixture에서 기대한 문서·출처를 가리키는지.
- 유효한 무매칭 질의가 `results: []`와 exit 0을 반환하는지.

최종 리뷰는 네 관점의 단일 discovery round를 기록했다. 이 지적은 해결되거나 사용자가 위험을 수용한 상태가 아니다. 후속 작업에서는 독립적으로 정한 fixture 기대값으로 테스트를 보강하고 CLI·코어 테스트 및 전체 CI를 실행해야 한다. 초기 red run 누락 지적 `CT-002`는 원본 worker 보고서의 사전 실패 증거를 보충한 뒤 철회됐다.

## 실행 기록과 보존 상태

새 실행은 blueprint `111/002-context-ontology-cli`에서 시작했다. 원래 구현 TASKS-001과 lint 복구 TASKS-003은 `integrated`이며, DAG는 `001 → 003 → 002`, scope revision은 `r3`, repair wave는 1이다. CLI의 `coordinate advance`는 위 CI 예외와 리뷰 이월을 기록한 뒤 `done`을 반환했다.

복구 도중 coordinator의 조기 report·record로 worker 증적 SHA 불일치가 발생했다. fenced revoke·prepare로 새 lease를 발급하고 lint 수정을 재적용한 뒤 검증·커밋·통합을 마쳤다.

로컬 실행 증적은 다음 경로에 보존했다. `.worktrees`와 runtime 파일은 Git 추적 대상이 아니므로 다른 checkout에는 없을 수 있다.

- integration: `.worktrees/111/002/integration`
- 최초 구현 worker: `.worktrees/111/002/workers/001`
- 복구 worker: `.worktrees/111/002/workers/003`
- ledger: integration 아래 `.bouncer/runtime/coordinator.json`
- 종단 검증: integration 아래 `.bouncer/context/epics/context-ontology/blueprints/context-ontology-cli/tasks/002/verification.md`
- 최종 리뷰: integration 아래 `.bouncer/context/epics/context-ontology/blueprints/context-ontology-cli/review.md`

이전 blueprint `111/001`의 ledger와 worktree는 보존했다. 선택 충돌을 해소하기 위해 사용자가 승인한 이전 namespace 포인터만 제거했다. 구현 결과는 사용자의 push로 원격 `develop`에도 반영됐으며 Bouncer finalize와 PR 작성·병합은 수행하지 않았다. Git 통합이 Bouncer 문서 상태의 종결을 뜻하지는 않는다.

## 커밋하는 문서 범위

사용자 요청에 따라 컨텍스트 루트 색인, epic 색인, 새 blueprint 색인과 이 통합 기록 네 파일을 함께 정리했다. 공개 색인은 함께 커밋하는 문서만 링크한다. 이전 계획과 미추적 task·verification·review 문서, 로컬 Graphify 설치 lock, 기존 벤치마크·조사 문서는 이 문서 커밋에서 제외한다.

메인의 작업 지시서 사본에는 복구 TASKS-003과 최종 검증·리뷰가 반영되지 않았다. 최신 실행 증적은 위 integration 경로에 보존돼 있다. 이 문서 정리는 실행 승인·검증 증적·finalize를 대신하지 않으며 기존 ledger를 수정하지 않는다.
