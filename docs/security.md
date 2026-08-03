# 위협 모델

커밋 가드는 **실수 방지 장치이지 악의적 우회에 대한 방어가 아닙니다.**

`hooks/commit-safety.js`는 Bash 명령 문자열을 파싱해 `git commit`을 탐지하고,
**판단할 수 없는 명령은 커밋으로 간주합니다**(fail-closed). 통과시키는 쪽으로
기울면 가드가 없는 것과 같기 때문입니다.

탐지하는 것:

| 입력 | 처리 |
| --- | --- |
| `git commit -m x`, `git -C <path> commit` | 직접 탐지 |
| `bash -c "git commit -m x"` | 중첩 셸 내부를 파싱 (`sh`/`zsh`/`dash`/`ksh`/`ash`, `-lc` 같은 결합 플래그 포함) |
| `git $FLAG commit`, `` git `...` `` | 확장이 섞이면 판단 불가 → 커밋으로 간주 |
| `git ci -m x` | `git config alias.ci`를 조회해 확장. `!` 셸 별칭은 그 내용을 다시 파싱 |
| `bash -c` 뒤에 아무것도 없음 | 판단 불가 → 커밋으로 간주 |

fail-closed의 대가는 **오탐**입니다. `git $ANYTHING`은 실제로 커밋이 아니어도
범위 검사를 거칩니다. 다만 범위 밖 파일이 스테이징돼 있을 때만 실제로 막히므로
평상시에는 드러나지 않습니다.

여전히 뚫리는 것:

- **셸을 거치지 않는 경로** — 스크립트 파일(`./release.sh`), `make commit`,
  Python·Node의 `subprocess`/`child_process`. 가드는 Bash 도구 호출의 명령
  문자열만 봅니다.
- **plumbing 우회** — `git commit-tree` + `git update-ref` 조합은 `commit`
  서브커맨드가 아니라 탐지되지 않습니다.
- **파일 *작성*** — 가드는 커밋만 막고 범위 밖 파일을 쓰는 것 자체는 막지 않습니다.

최후 방어선은 `/bouncer-finalize`의 범위 검사입니다. 이건 명령 문자열이 아니라
실제 git 상태(`diff --name-only HEAD` + `ls-files --others`)를 보므로,
위의 어떤 경로로 파일이 들어왔든 걸립니다.
