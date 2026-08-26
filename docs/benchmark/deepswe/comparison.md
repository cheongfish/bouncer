# DeepSWE 원본 3 arm 비교 (052)

측정일 2026-08-26 (KST). 태스크 id는 [sample.md](sample.md) 「052 비교 태스크 3개」다.
런 id는 `052-<arm>-<task-id>`. 숫자는 그 런 산출물에서만 옮겼다. 값이 없는 칸은
비운다.

판정은 Pier `reward.json`이다. `reward > 0`이면 통과. `metrics.json`이 있는 런만
`merged.json`의 `verdict`을 쓴다. 이번 9런에는 `metrics.json`이 한 장도 없다.

## 통과

| 태스크 | vanilla | superpowers | bouncer |
| --- | --- | --- | --- |
| `abs-module-cache-flags` | false (`reward` 0) | | |
| `abs-stepped-slices` | false (`reward` 0) | | |
| `actionlint-action-pinning-lint` | false (`reward` 0) | | |
| **통과율** | 0/3 | | |

superpowers 세 런은 호스트에 플러그인이 없어 종료 코드 2이고 결과 경로가 없다.
bouncer 세 런은 PATH에 `bouncer`가 없어 종료 코드 2이고 결과 경로가 없다.
명령줄은 [protocol.md](protocol.md) 「052 비교 9런」에 있다.

## usage

`usage.wall_s` · `usage.tokens_in` · `usage.tokens_out`은 `metrics.json`의
`usage` 키다. 패치가 비어 `metrics.json`이 없으면 칸을 비운다.

| 태스크 | arm | wall_s | tokens_in | tokens_out |
| --- | --- | --- | --- | --- |
| `abs-module-cache-flags` | vanilla | | | |
| `abs-module-cache-flags` | superpowers | | | |
| `abs-module-cache-flags` | bouncer | | | |
| `abs-stepped-slices` | vanilla | | | |
| `abs-stepped-slices` | superpowers | | | |
| `abs-stepped-slices` | bouncer | | | |
| `actionlint-action-pinning-lint` | vanilla | | | |
| `actionlint-action-pinning-lint` | superpowers | | | |
| `actionlint-action-pinning-lint` | bouncer | | | |

vanilla 세 런은 `run.log`에 `NonZeroAgentExitCodeError`와 빈 패치 skip이 있다.
`bridge_pier.py`는 `metrics.json`이 없어 부르지 않았다.
