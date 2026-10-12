# DeepSWE 과제

[DeepSWE](https://github.com/datacurve-ai/deep-swe)(Datacurve AI)의 과제 중 네 개를 Bouncer 벤치마크 카드로 쓴다.
과제 명세·검증기는 Apache-2.0이고, 과제가 쓰는 상류 코드는 각 상류 프로젝트 라이선스를 따른다.
DeepSWE 라이선스는 상류 프로젝트를 다시 허가하지 않는다. 이 저장소는 과제 원본을 담지 않고
`fixtures/deepswe/`(gitignore)에 받아 쓴다.

- 저장소: `https://github.com/datacurve-ai/deep-swe`
- 고정 커밋: `0b9fabbb63b9104d678fe965e1632f2dd9eaa2ea` (`manifest.json`의 `commit`)

| card id | DeepSWE 과제 | 언어 | 상류 | 상류 라이선스 | f2p/p2p |
| --- | --- | --- | --- | --- | --- |
| `deepswe-quill-001` | `quill-shared-toolbar-focus` | TypeScript | slab/quill | BSD-3-Clause | 13/22 |
| `deepswe-expr-001` | `expr-try-catch-errors` | Go | expr-lang/expr | MIT | 79/66265 |
| `deepswe-statemachine-001` | `python-statemachine-state-data-scoping` | Python | fgmacedo/python-statemachine | MIT | 72/1286 |
| `deepswe-oxvg-001` | `oxvg-structural-selector-preservation` | Rust | noahbald/oxvg | MIT | 6/62 |

## 난이도 근거

공개 trials에서 grok 계열 모델의 해결률이 30~45%인 과제를 골랐다. 만점도 0점도 아니라 두 조건(vanilla,
bouncer-full)의 차이가 드러나는 구간이다.

## 명령

모든 명령은 저장소 루트에서 실행한다. Docker와 네트워크가 필요하다.

```sh
# 1. 준비: 과제 명세와 이미지의 /app을 fixtures/deepswe/<card-id>/ 와 <card-id>.bundle로 꺼낸다.
node benchmarks/prepare-deepswe-task.cjs <card-id>
# 2. 정답 확인: 빈 patch는 reward 0, task/solution/solution.patch는 reward 1이어야 한다.
node benchmarks/check-deepswe-solution.cjs <card-id>
# 3. 실행: 작업 공간 준비까지만 돌리는 dry-run, 이미지만 만드는 build-only, 실제 실행.
node benchmarks/run-cursor.cjs --task <card-id> --condition vanilla --model cursor-grok-4.5-medium --dry-run true --run-id <run-id>
node benchmarks/run-cursor.cjs --task <card-id> --condition vanilla --model cursor-grok-4.5-medium --build-only true --run-id <run-id>
```

평가자 정책(`configs/<card-id>-evaluator-policy.json`)은 `proposed`다. 측정 전에 사용자가 따로 승인해야 실행기가 받는다.

## 공식과의 차이

- 공식 채점은 에이전트 컨테이너에 네트워크가 없다. 이 벤치마크의 에이전트는 모델 API 호출을 위해 네트워크를 쓴다.
- 채점 컨테이너는 공식과 같이 `--network none`이고 에이전트 작업 공간을 마운트하지 않는다. patch만 `/logs/artifacts/model.patch`로 넘긴다.
- 지시문은 영어 원문 그대로 번역 없이 전달한다. 끝의 "새 브랜치에서 작업하고 커밋하라"는 문장도 그대로이며, 커밋 여부는 채점에 영향이 없다(카드 `evaluator_facts.commit`).

## 정답 확인 기록

정답 확인·dry-run·build-only 출력을 과제마다 남긴다(추적 파일이라 finalize 뒤에도 남는다).
산출물(`run.json`, 빌드 이미지 기록)은 출력을 붙인 뒤 지웠다.

2026-10-12, DeepSWE `0b9fabbb63b9104d678fe965e1632f2dd9eaa2ea`, checkout 플러그인 버전 1.5.7, 모델 `cursor-grok-4.5-medium`.
기대값: `untouched.reward 0`(`apply_failed` 아님), `solution.reward 1`, dry-run은 작업 공간 준비 뒤 `status: prepared`로 종료, build-only는 두 조건 모두 `status: built`이고 `image_id`가 `docker image inspect`와 같으며 bouncer 조건 `plugin_version`이 checkout 버전과 같음.

### deepswe-quill-001

```text
$ node benchmarks/check-deepswe-solution.cjs deepswe-quill-001
{"card_id":"deepswe-quill-001","untouched":{"reward":0,"f2p_passed":0,"f2p_total":13,"apply_failed":false},"solution":{"reward":1,"f2p_passed":13,"f2p_total":13,"apply_failed":false}}
$ node benchmarks/run-cursor.cjs --task deepswe-quill-001 --condition vanilla --model cursor-grok-4.5-medium --dry-run true --run-id dsw-dryrun-deepswe-quill-001
exit 0; run.json status=prepared; workspace_setup steps=[{"kind":"restore_untracked","source":"deepswe-quill-001","paths":["node_modules/","packages/quill/node_modules/"]}] index_tree=fad505ad3b2a18637882763acffc150db3561ff8
$ node benchmarks/run-cursor.cjs --task deepswe-quill-001 --condition vanilla --model cursor-grok-4.5-medium --build-only true --run-id dsw-build-v-deepswe-quill-001
exit 0; status=built image_id=sha256:5fc910551419693d5caf006568eb10cad85a4ed226e5bda2f3d8eb63b7a48a05 plugin_version=null
$ node benchmarks/run-cursor.cjs --task deepswe-quill-001 --condition bouncer-full --model cursor-grok-4.5-medium --build-only true --run-id dsw-build-b-deepswe-quill-001
exit 0; status=built image_id=sha256:38ce2ed4ecd2dc9f0e985cf363b3745a2c4f8e3e54b09f7a32a221ef2c340985 plugin_version=1.5.7
$ docker image inspect --format '{{.Id}}' bouncer-benchmark-deepswe-deepswe-quill-001-{vanilla,bouncer}:local
sha256:5fc910551419693d5caf006568eb10cad85a4ed226e5bda2f3d8eb63b7a48a05 / sha256:38ce2ed4ecd2dc9f0e985cf363b3745a2c4f8e3e54b09f7a32a221ef2c340985 (run.json의 image_id와 같음)
```

### deepswe-expr-001

```text
$ node benchmarks/check-deepswe-solution.cjs deepswe-expr-001
{"card_id":"deepswe-expr-001","untouched":{"reward":0,"f2p_passed":0,"f2p_total":79,"apply_failed":false},"solution":{"reward":1,"f2p_passed":79,"f2p_total":79,"apply_failed":false}}
$ node benchmarks/run-cursor.cjs --task deepswe-expr-001 --condition vanilla --model cursor-grok-4.5-medium --dry-run true --run-id dsw-dryrun-deepswe-expr-001
exit 0; run.json status=prepared; workspace_setup steps=[{"kind":"restore_untracked","source":"deepswe-expr-001","paths":[]}] index_tree=686643214052394fb41e743ccc34f4f3beedef46
$ node benchmarks/run-cursor.cjs --task deepswe-expr-001 --condition vanilla --model cursor-grok-4.5-medium --build-only true --run-id dsw-build-v-deepswe-expr-001
exit 0; status=built image_id=sha256:2b976c1de7f6f9ed8ce204e1a519d7555eccc94a0744f37399069b9a3ecfa74b plugin_version=null
$ node benchmarks/run-cursor.cjs --task deepswe-expr-001 --condition bouncer-full --model cursor-grok-4.5-medium --build-only true --run-id dsw-build-b-deepswe-expr-001
exit 0; status=built image_id=sha256:6b3eb48b0561d8fd94a4c3893a0ebef17c4b6fa0299f8a4880092face2b0c4d5 plugin_version=1.5.7
$ docker image inspect --format '{{.Id}}' bouncer-benchmark-deepswe-deepswe-expr-001-{vanilla,bouncer}:local
sha256:2b976c1de7f6f9ed8ce204e1a519d7555eccc94a0744f37399069b9a3ecfa74b / sha256:6b3eb48b0561d8fd94a4c3893a0ebef17c4b6fa0299f8a4880092face2b0c4d5 (run.json의 image_id와 같음)
```

### deepswe-statemachine-001

```text
$ node benchmarks/check-deepswe-solution.cjs deepswe-statemachine-001
{"card_id":"deepswe-statemachine-001","untouched":{"reward":0,"f2p_passed":0,"f2p_total":72,"apply_failed":false},"solution":{"reward":1,"f2p_passed":72,"f2p_total":72,"apply_failed":false}}
$ node benchmarks/run-cursor.cjs --task deepswe-statemachine-001 --condition vanilla --model cursor-grok-4.5-medium --dry-run true --run-id dsw-dryrun-deepswe-statemachine-001
exit 0; run.json status=prepared; workspace_setup steps=[{"kind":"restore_untracked","source":"deepswe-statemachine-001","paths":[]}] index_tree=754e1a52f3fe28c83eb4f2b3d1b1734786de9a56
$ node benchmarks/run-cursor.cjs --task deepswe-statemachine-001 --condition vanilla --model cursor-grok-4.5-medium --build-only true --run-id dsw-build-v-deepswe-statemachine-001
exit 0; status=built image_id=sha256:891f2f28420f36df51f1397ad2631e936cfaaaa0f9f12de7d02ed4e3c8b9d430 plugin_version=null
$ node benchmarks/run-cursor.cjs --task deepswe-statemachine-001 --condition bouncer-full --model cursor-grok-4.5-medium --build-only true --run-id dsw-build-b-deepswe-statemachine-001
exit 0; status=built image_id=sha256:b9e4194d967c34b4cfd42f3f25db02047fa2b5d88f207f12550f581b5e07e20f plugin_version=1.5.7
$ docker image inspect --format '{{.Id}}' bouncer-benchmark-deepswe-deepswe-statemachine-001-{vanilla,bouncer}:local
sha256:891f2f28420f36df51f1397ad2631e936cfaaaa0f9f12de7d02ed4e3c8b9d430 / sha256:b9e4194d967c34b4cfd42f3f25db02047fa2b5d88f207f12550f581b5e07e20f (run.json의 image_id와 같음)
```

### deepswe-oxvg-001

```text
$ node benchmarks/check-deepswe-solution.cjs deepswe-oxvg-001
{"card_id":"deepswe-oxvg-001","untouched":{"reward":0,"f2p_passed":0,"f2p_total":6,"apply_failed":false},"solution":{"reward":1,"f2p_passed":6,"f2p_total":6,"apply_failed":false}}
$ node benchmarks/run-cursor.cjs --task deepswe-oxvg-001 --condition vanilla --model cursor-grok-4.5-medium --dry-run true --run-id dsw-dryrun-deepswe-oxvg-001
exit 0; run.json status=prepared; workspace_setup steps=[{"kind":"restore_untracked","source":"deepswe-oxvg-001","paths":["target/"]}] index_tree=575fa4f3ff89639d6a331d0dd4ea0c35f9ff9550
$ node benchmarks/run-cursor.cjs --task deepswe-oxvg-001 --condition vanilla --model cursor-grok-4.5-medium --build-only true --run-id dsw-build-v-deepswe-oxvg-001
exit 0; status=built image_id=sha256:fb3c136c83e0ba5705b09606bae4c63a811e9d4f6a2b88b9ea386d9638877d52 plugin_version=null
$ node benchmarks/run-cursor.cjs --task deepswe-oxvg-001 --condition bouncer-full --model cursor-grok-4.5-medium --build-only true --run-id dsw-build-b-deepswe-oxvg-001
exit 0; status=built image_id=sha256:30de79158babe9af4232831e6922e3b4f0721346d85e0cb4b06e20318059b93b plugin_version=1.5.7
$ docker image inspect --format '{{.Id}}' bouncer-benchmark-deepswe-deepswe-oxvg-001-{vanilla,bouncer}:local
sha256:fb3c136c83e0ba5705b09606bae4c63a811e9d4f6a2b88b9ea386d9638877d52 / sha256:30de79158babe9af4232831e6922e3b4f0721346d85e0cb4b06e20318059b93b (run.json의 image_id와 같음)
```
참고: 채점 컨테이너가 root로 쓴 로그 때문에 임시 디렉터리를 호스트 사용자가 지우지 못한다. 정답 확인 명령은 이 경우 판정을 출력한 뒤
경고만 남기고 0으로 끝난다(quill·expr의 첫 실행은 이 처리를 넣기 전이라 판정 출력 뒤 종료 코드 1이었다).
