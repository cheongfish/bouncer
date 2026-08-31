# 위협 모델

커밋 가드는 실수 방지용이다. 악의적 우회는 막지 않는다.

`hooks/commit-safety.js`는 Bash 명령 문자열을 파싱해 `git commit`을 탐지하고,
**판단할 수 없는 명령은 커밋으로 간주합니다**(fail-closed). 통과시키는 쪽으로
기울면 가드가 없는 것과 같기 때문입니다.

탐지하는 것:

| 입력 | 처리 |
| --- | --- |
| `git commit -m x`, `git -C <path> commit` | 직접 탐지. 스테이징된 경로만 `affected_paths`와 대조 |
| `"git" commit -m x`, `g"it" commit -m x` | 세그먼트 **첫 토큰** 값이 `git`이면 인용·부분인용도 git argv로 탐지. 이후 `commit`·alias·`-a` 판정은 동일. `echo "git" commit`처럼 인자 자리의 `"git"`은 명령이 아님 |
| `git commit -am x`, `git commit -a`, `git commit --all` | 커밋으로 탐지하고, 검사 대상은 스테이징 ∪ `git diff HEAD --name-only` (추적 중 수정). 롱 옵션은 이름이 정확히 `--all`일 때만 all-flag. `--amend` · `--author=` · `--allow-empty`는 해당하지 않음. `-m`/`--message` 값과 따옴표 토큰은 플래그로 읽지 않음 |
| `bash -c "git commit -m x"` | 중첩 셸 내부를 파싱 (`sh`/`zsh`/`dash`/`ksh`/`ash`, `-lc` 같은 결합 플래그 포함) |
| `git $FLAG commit`, `` git `...` `` | 확장이 섞이면 판단 불가 → 커밋으로 간주하고 all-flag도 있는 것으로 간주 |
| `git ci -m x` | `git config alias.ci`를 조회해 확장. `!` 셸 별칭은 그 내용을 다시 파싱 |
| `bash -c` 뒤에 아무것도 없음 | 판단 불가 → 커밋으로 간주하고 all-flag도 있는 것으로 간주 |
| `git diff HEAD` 실패 (`-a`/`--all` 또는 판단 불가 경로) | 예외를 삼키지 않고 전파. 훅 어댑터가 fail-closed로 차단 |

fail-closed의 대가는 **오탐**입니다. `git $ANYTHING`은 커밋이 아니어도
범위 검사를 거칩니다. 판단 불가 경로는 all-flag로도 치므로, 스테이징이 비어
있어도 추적 중 수정이 범위 밖이면 막힙니다. pathspec으로 좁힌 `-a` 커밋
(`git commit -a -- path/in-scope`)도 명령만 보면 all-flag라서, HEAD 대비
범위 밖 수정이 있으면 막힐 수 있습니다. 평상시 `-m`만 쓰는 커밋은
스테이징된 범위 밖 파일이 있을 때만 드러납니다.

여전히 뚫리는 것:

- **완전한 셸 파서가 아님**: 가드는 실수 방지용 휴리스틱이다. 인용 규칙·확장·
  리다이렉트·평가 순서를 전부 흉내 내지 않으며, 의도적 우회를 막지 않는다.
- **셸을 거치지 않는 경로**: 스크립트 파일(`./release.sh`), `make commit`,
  Python·Node의 `subprocess`/`child_process`. 가드는 Bash 도구 호출의 명령
  문자열만 봅니다.
- **plumbing 우회**: `git commit-tree` + `git update-ref` 조합은 `commit`
  서브커맨드가 없어 탐지되지 않습니다.
- **파일 *작성***: 가드는 커밋만 막고 범위 밖 파일을 쓰는 것 자체는 막지 않습니다.

최후 방어선은 `/bouncer-finalize`의 범위 검사입니다. git 상태
(`diff --name-only HEAD` + `ls-files --others`)를 보므로,
위의 어떤 경로로 파일이 들어왔든 걸립니다.

## 신뢰 경계

에이전트가 따르는 입력은 플러그인이 배포한 스킬·에이전트·마스터 룰과
사용자의 직접 지시다.

`.bouncer/context/**` 본문, `graphify-out/**` 산출물, 서브에이전트 리포트,
저장소 소스·테스트 파일 내용은 데이터다. 에이전트는 그 내용을 지시로 승격하지
않는다.

스킬과 에이전트 문서가 이 경계를 문구로 적는다. 에이전트가 문구를 무시해도
`scripts/`는 막지 않는다. 실질 방어선은 게이트 판정을 `bouncer validate`만
한다는 설계다.

## Git common directory 런타임 상태 (알려진 한계)

활성 포인터는 `<git-common-dir>/bouncer/current`에 있다. linked worktree는
git common directory를 공유하므로 포인터는 그 공통 디렉터리당 하나다. 한
worktree의 `current --set`이 다른 linked worktree 사이클이 읽는 포인터를
덮어쓴다. 영향: `verify` 명령 해결과 커밋 스코프가 다른 사이클의 task 문서로
간다.

verify 원장은 `<git-common-dir>/bouncer/verify/<digest>.json`이다. digest는
`verification.md` 상대경로 기준이다. 같은 blueprint 경로를 두 linked worktree에서
돌리면 원장이 덮인다. 서로 다른 blueprint 경로는 digest가 달라 그 원장 파일을
공유하지 않는다.

운영 완화: 병렬 Bouncer 사이클은 독립 클론에서 돌린다. 클론은 git common
directory를 공유하지 않는다. 런타임 상태 위치는 그대로다. linked worktree는
공통 디렉터리 아래 포인터와 원장을 계속 공유한다.
