# 기여 / 개발

## 로컬 개발

```bash
npm install    # devDependencies만 (테스트·린트용)
npm run setup  # 커밋 메시지 템플릿 연결 (클론마다 1회)
npm test       # node --test
npm run lint   # eslint
```

## 커밋·PR 규약

커밋 메시지는 한국어 Conventional Commits를 따릅니다 — `type: 명사형 제목` +
`~함`으로 끝나는 본문 불릿 최대 3개. 본문에 파일·모듈 이름은 쓰지 않습니다(diff가
이미 보여줍니다). 전체 규칙은 [`.gitmessage`](../.gitmessage)에 있습니다.

`/bouncer-finalize`도 같은 규약을 씁니다. 메시지를 새로 짓지 않고 plan 때 쓴
문서 `title`을 그대로 조립합니다 — `bouncer.commit_type` + blueprint `title`이
제목, tasks/verification `title`이 본문 불릿. Epic/Blueprint/Distill 식별자는
커밋에 넣지 않고 PR 본문·blueprint 문서에 둡니다.
scaffold 기본값(`BP-001 slug` 등)을 남기면 그 문구가 커밋에 들어가므로,
`/bouncer-plan`에서 `.gitmessage` 기준으로 `title`을 고쳐 두세요.

`npm run setup`은 `git config commit.template .gitmessage`를 실행합니다. **클론해도
자동 적용되지 않습니다** — git이 저장소가 로컬 설정을 바꾸는 것을 막기 때문에
각자 한 번 실행해야 합니다. 그리고 이 템플릿은 에디터가 열릴 때만 보이므로
`git commit -m`에는 적용되지 않습니다.

PR/MR 본문 템플릿은 두 곳에 같은 형식으로 있습니다.

| 위치 | 쓰이는 곳 |
| --- | --- |
| `.github/pull_request_template.md` | GitHub PR 작성 시 자동 적용 |
| `.gitlab/merge_request_templates/기본.md` | GitLab MR 작성 시 템플릿 드롭다운에서 선택 |

`/bouncer-finalize`의 draft PR 본문은 플러그인 내장 템플릿
(`scripts/lib/templates.js`의 `pr.md`)을 사용합니다. 프로젝트에 별도 사본을
두지 않습니다.

PR **제목**은 커밋 subject와 다릅니다. finalize가 만드는 draft 제목 형식:

```text
[YYMMDD] (→ MergeTarget) [Type/Type] 요약
```

예: `[260803] (→ Develop) [Feat] 전역 Distill을 init·finalize 런타임에 연결`

- `YYMMDD` — 작성일(KST)
- `MergeTarget` — `config.base_branch` / `pr.base` (첫 글자 대문자)
- `Type` — 브랜치 커밋 타입의 PascalCase (`feat` → `Feat`); 여러 타입이면 `/`로 연결
- `요약` — 해당 커밋들을 대표하는 한국어 명사구 (보통 blueprint `title`)

Epic/Blueprint id는 제목에 넣지 않고 PR 본문 `## 🚦 Bouncer`에 둡니다.

GitLab에서 기본값으로 강제하려면 프로젝트 설정 → Merge requests →
*Default description template*에서 지정해야 합니다.

## CI와 배포 계약

CI는 `main`/`develop` 푸시와 PR마다 두 가지를 모두 돌립니다. GitHub Actions
(`.github/workflows/test.yml`)와 GitLab CI(`.gitlab-ci.yml`)를 함께 두어, 사내
GitLab과 GitHub 어느 쪽에 올려도 같은 계약이 강제됩니다.

`scripts/`와 `hooks/` 아래 코드는 `node_modules`에 의존하면 안 됩니다 —
마켓플레이스 설치가 깨집니다. `test/distribution.test.js`가 이 계약을 강제합니다.
`scripts/vendor/`는 서드파티 코드라 린트 대상에서 제외합니다.

릴리스는 `claude plugin tag`로 `bouncer--v<version>` 태그를 만듭니다. 이 명령은
`plugin.json`과 `marketplace.json`의 버전 일치를 함께 검증합니다.

## 피드백

사용 중 마찰·버그는 이슈 템플릿으로 남겨 주세요. 파일럿 안내는
[PILOT.md](PILOT.md)를 보세요.
