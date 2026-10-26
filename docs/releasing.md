# 릴리스

유지보수자용 문서입니다. runtime(npm package `@cheongfish/bouncer`)과 plugin(`release`
브랜치) 공개 절차를 설명합니다. runtime과 plugin은 독립된 버전을 사용하며
plugin manifest의 `runtimeCompatibility`가 호환 관계를 선언합니다. 설치 방법은
[install.md](install.md)에 있습니다.

한 번 공개한 버전은 덮어쓸 수 없습니다. `unpublish`, 태그 강제 이동, 같은 버전 재공개는
복구 방법으로 쓰지 않습니다. 잘못 공개했다면 다음 patch 버전으로 고쳐서 올립니다.

## 공개 구조

| 배포물 | 위치 | 갱신 방식 |
| --- | --- | --- |
| runtime | npm `@cheongfish/bouncer` | 태그 push → `release.yml`이 OIDC로 게시 |
| plugin | 저장소 `release` 브랜치 | 같은 workflow가 npm 게시 확인 뒤 새 커밋으로 갱신 |

plugin과 runtime 버전이 다를 수 있습니다. `runtimeCompatibility`가 누락된 과거 plugin은
기존 동작과의 호환을 위해 정확히 같은 runtime 버전만 허용합니다. 게시는 CI가 검사한
runtime tarball과 plugin tree를 그대로 사용하고, plugin의 호환 범위를 검증한 뒤
npm runtime이 확인된 경우에만 `release` 브랜치를 갱신합니다.

`release.yml`의 트리거는 `bouncer--v*` 태그 push입니다. 수동 실행(`workflow_dispatch`)은
prepare 검증만 하고 `publish` job은 건너뜁니다.

## 일반 릴리스 순서

예시는 `0.1.13`입니다.

1. runtime 변경이면 루트 `package.json`의 `version`을 올리고 `npm run sync:versions`로
   runtime lock metadata를 동기화합니다. plugin 자산이나 호환 범위를 변경할 때만
   `plugin.json`과 host manifest의 plugin `version`을 올립니다.

   ```bash
   npm run sync:versions     # package-lock, plugin.json 4종, marketplace.json 동기화
   npm run check:versions
   npm ci
   npm run ci
   ```

   `sync:versions`는 plugin 버전을 runtime에 덮어쓰지 않습니다. 문서의 설치 예시도
   새 runtime을 가리키도록 직접 고칩니다.
   `CHANGELOG.md`에 `## [0.1.13]` 항목을 추가합니다.
2. PR로 `develop`에 병합합니다.
3. 수동 workflow 실행으로 prepare 검증과 dry-run을 확인합니다. release 브랜치에 쓰지 않고
   npm에 게시하지 않습니다.

   ```bash
   gh workflow run release.yml --ref develop
   gh run list --workflow=release.yml --limit 1
   ```

4. 정확한 버전의 태그가 없고, 병합된 최종 검증 HEAD를 가리키는지 확인합니다. 태그는
   `bouncer--v<version>`입니다. 다른 커밋을 가리키는 기존 태그가 있으면 중단합니다.
5. 별도 운영 승인을 받은 뒤에만 최종 HEAD에 annotated tag를 만들고 push합니다. plugin을
   변경하지 않은 runtime 전용 릴리스라면 plugin 버전과 트리는 그대로 둡니다. 이 push가
   곧 npm 공개입니다.

   ```bash
   git switch develop && git pull --ff-only
   git tag -a bouncer--v0.1.13 -m "bouncer 0.1.13"
   git push origin bouncer--v0.1.13
   ```

   workflow는 태그, 루트 version, runtime pack의 버전과 plugin의 runtime 호환 범위를
   확인한 뒤 OIDC로 npm에 게시하고 `release` 브랜치를 갱신합니다.
6. 결과를 각각 확인합니다. 하나라도 실패하면 사용자에게 설치 완료를 안내하지 않습니다.

   ```bash
   gh run watch
   npm view @cheongfish/bouncer version dist.integrity    # 새 버전과 integrity
   git ls-remote --heads origin release                  # 새 커밋
   ```

   npm 페이지의 provenance 표시도 확인합니다. 게시 직후에는 레지스트리에 반영되기까지
   몇 분 걸릴 수 있어, 처음에는 `E404`가 나올 수 있습니다.
7. 새 임시 디렉터리에서 레지스트리 버전을 설치해 `bouncer --help`, `bouncer-root --auto`,
   `bouncer init`이 동작하는지 확인합니다.

게시를 다시 실행해도 안전합니다. npm 레지스트리의 같은 name/version/integrity를 확인하고,
이미 같은 integrity가 있으면 npm publish를 건너뛰고 `release` 브랜치 게시를 이어갑니다.
버전이 다르거나 integrity가 일치하지 않으면 중단합니다. 태그를 다시 만들 필요 없이
`gh run rerun`으로 같은 실행을 다시 돌립니다.

## trusted publisher와 provenance 운영 조건

최초 게시 전에 운영자가 npm과 GitHub 양쪽에서 다음을 준비하고 확인합니다. 둘 다
외부 권한 작업이며, 이 문서와 로컬 검사는 설정 완료나 공개 상태를 증명하지
않습니다. 태그 push는 별도 승인 후에 수행합니다.

- npm package `@cheongfish/bouncer`의 trusted publisher 설정에는 실제 publish job과
  같은 값을 넣습니다. owner는 `cheongfish`, repository는 `bouncer`, workflow
  filename은 `release.yml`입니다. 이름은 `.github/workflows/`의 파일명이며
  workflow의 표시 이름(`name: release`)이 아닙니다. 대소문자와 `.yml` 확장자까지
  정확히 일치해야 합니다. 설정 위치는 package 페이지의 Settings입니다.
  ([npm trusted publishing](https://docs.npmjs.com/trusted-publishers/))
- 현재 publish job은 GitHub environment를 쓰지 않으므로 npm 쪽 environment 칸은
  비워 둡니다. environment를 지정하려면 workflow에 같은 이름의 `environment:`를
  먼저 추가해야 합니다.
- 허용 action은 직접 publish입니다. workflow가 `scripts/release-runtime.js`를 통해
  게시하므로 staged publish 승인을 요구하는 설정은 쓰지 않습니다.
  ([npm trusted publishing](https://docs.npmjs.com/trusted-publishers/))
- OIDC 게시는 publish job의 `id-token: write` 권한, GitHub-hosted runner
  (`ubuntu-latest`; self-hosted runner는 공식 문서상 미지원), npm CLI 11.5.1
  이상과 Node 22.14.0 이상이 필요합니다. workflow는 npm `^11.5.1`을 설치하고 token
  없이 OIDC로 게시합니다. token fallback은 권장하지 않습니다. Node 24는 이
  저장소의 선택이며 공식 최소 조건과 구별합니다.
  ([npm trusted publishing](https://docs.npmjs.com/trusted-publishers/))
- npm 쪽 설정은 저장할 때 검증되지 않아 오류가 게시 시점에야 드러나고, 새 설정은
  첫 게시를 2일 안에 성공시키지 못하면 만료됩니다. 설정은 수정할 수 없고 삭제 후
  다시 만들어야 합니다. 태그 push 직전에 등록하고 값을 다시 대조하세요.
  ([npm trusted publishing](https://docs.npmjs.com/trusted-publishers/))
- provenance는 OIDC 게시, 공개 source repository, 공개 package가 모두 충족될 때
  자동 생성되므로 `--provenance` 플래그는 필요하지 않습니다.
  ([npm trusted publishing](https://docs.npmjs.com/trusted-publishers/)) 별도로
  provenance 문서는 `package.json`의 공개 `repository`가 게시 source와
  (대소문자까지) 일치해야 한다고 요구하며, 첫 게시에는 `--access public`이
  필요합니다. `packages/cli/package.json`의 repository metadata가
  `cheongfish/bouncer`를 가리키고 `publishConfig.access`가 `public`인지, 게시
  명령이 `--access public`을 쓰는지 게시 전에 확인합니다.
  ([npm provenance](https://docs.npmjs.com/generating-provenance-statements/))
- GitHub 저장소의 Actions 허용 범위가 `all`이면 별도 설정이 필요 없습니다. 범위를
  제한한다면 GitHub이 만든 action 허용을 켜야 합니다. workflow는 `actions/checkout`,
  `setup-node`, `upload-artifact`, `download-artifact`를 씁니다.
- 운영자가 직접 확인할 항목: package와 repository의 공개 여부, npm publisher 등록
  값, 게시 후 registry의 provenance 표시. 위 조건은 2026-10-24에 두 공식 문서를
  읽고 실제 workflow와 대조한 것입니다. 공식 조건은 바뀔 수 있으므로 게시 직전에
  다시 확인합니다.

## 첫 공개 기록 (0.1.10)

`@cheongfish/bouncer@0.1.10`은 workflow가 아니라 **수동으로** 공개했습니다. 새 package는
npm에 존재하기 전에는 trusted publisher 등록 화면이 열리지 않기 때문입니다(package 페이지
Settings가 `Not Found`). 첫 버전 이후의 공개는 모두 태그 push로 합니다.

수동 공개에서 겪은 일과 대응은 다음과 같습니다.

| 증상 | 원인 | 대응 |
| --- | --- | --- |
| `E403 Two-factor authentication ... is required` | 계정에 2FA가 없거나 공개용 인증이 전달되지 않음 | 계정에 2FA를 `Authorization and publishing`으로 켠다 |
| `EOTP` | 서버가 두 번째 인증을 요구했으나 명령에 코드가 없고 웹 인증도 안내되지 않음 | 일반 터미널에서 `--otp` 없이 다시 실행해 security key 인증 URL이 나오는지 본다 |
| `E401` / `E404 ... PUT` | `npm login` 토큰 만료. 인증이 없으면 scope 패키지 PUT이 404로 보인다 | `npm login` 후 `npm whoami`가 계정을 보이는지 확인하고 곧바로 공개한다 |
| 공개 직후 조회가 `E404` | 레지스트리 전파 지연 | 몇 분 뒤 다시 조회한다. 업로드가 `+ <package>@<version>`을 출력했다면 성공이다 |

- npm은 2025년 10월 중순부터 새 TOTP(인증 앱) 등록을 막았습니다. 새로 설정할 수 있는
  2FA는 security key와 passkey입니다. 보안 키는 웹에서만 등록할 수 있고 명령줄에서도
  쓸 수 있습니다.
  ([Datadog 분석](https://securitylabs.datadoghq.com/articles/decoding-the-recommendations-for-npm-maintainers/),
  [npm 2FA 문서](https://docs.npmjs.com/about-two-factor-authentication/))
- 수동 공개 전에 dry-run으로 tarball 내용을 확인했습니다.
  `npm publish --workspace=@cheongfish/bouncer --access public --dry-run`
- 공개 후 레지스트리의 `dist.shasum`과 `dist.integrity`가 로컬 tarball과 일치하는지
  대조했습니다.
- 공개 직후 레지스트리에는 `0.0.0-stage`라는 2개 파일짜리 자리표시자 버전이 함께 보입니다.
  npm이 첫 공개 처리에서 만든 것이며 `latest` 태그는 공개한 버전을 가리킵니다.
- `0.1.10`은 수동 공개라 `bouncer--v0.1.10` 태그를 달지 않았습니다. 태그를 달면 workflow가
  같은 버전을 다시 처리하려 합니다. 그 이전의 `bouncer--v*` 태그(1.x 이하)는 버전을
  0.1.x로 다시 시작하면서 모두 삭제했습니다.
- `release` 브랜치는 workflow 대신 아래 절차로 한 번 갱신했습니다.

## `release` 브랜치를 수동으로 갱신하기

workflow가 실패했거나 수동으로 맞춰야 할 때 쓰는 복구 절차입니다. workflow의 신원
(`github-actions[bot]`)을 흉내 내지 않고 자신의 git 신원으로 커밋합니다.

1. 공개한 버전의 소스 커밋에서 plugin 트리를 만들고, 버전이 runtime과 같은지 확인합니다.

   ```bash
   node scripts/build-release.js --out "$TMPDIR/plugin-tree"
   grep '"version"' "$TMPDIR/plugin-tree/plugin.json"
   ```

2. 원격 `release` 끝을 부모로 하는 임시 worktree에서 내용을 교체하고 커밋합니다.
   강제 푸시는 쓰지 않습니다.

   ```bash
   git fetch origin release
   git worktree add --detach "$TMPDIR/release-wt" origin/release
   cd "$TMPDIR/release-wt"
   find . -mindepth 1 -maxdepth 1 ! -name .git -exec rm -rf {} +
   cp -r "$TMPDIR/plugin-tree/." .
   git add -A && git commit -m "release: bouncer--v<version>"
   git push origin HEAD:refs/heads/release
   ```

3. 임시 worktree를 지우고, 원격 트리가 만든 트리와 같은지 대조합니다.
