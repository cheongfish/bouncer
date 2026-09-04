# 기여 / 개발

## 로컬 개발

```bash
npm install    # devDependencies만 (테스트·린트·타입검사용)
npm run setup  # 커밋 메시지 템플릿 + pre-commit 훅 연결 (클론마다 1회)
npm run ci     # emit → coverage → lint → lint:docs → typecheck → audit
```

로컬 확인은 `npm run ci` 하나다. 순서는 배포 CJS emit 검사(`check:emit`),
제품 코드 coverage, lint, 문서 구조 린트(`lint:docs` →
`node scripts/check-doc-shape.js`), typecheck, `npm audit --audit-level=high`다.
문서만 빠르게 보려면 `npm run lint:docs`를 단독으로 돌린다.
coverage는 vendored third-party와 test를 빼고 `scripts/lib/**`만 재며
하한은 line 94%, branch 82%, function 96%다. 기본 병렬 러너는 같은
스위트에서도 branch 수치가 출렁여 하한을 깨므로 `test:coverage`는
`--test-concurrency=1`로 돌린다. CI와 로컬 사이에도 소수 포인트
편차가 있어 branch는 1%p 버퍼를 둔다. audit는 레지스트리에 닿아야
하고, 레지스트리 실패를 성공으로 보지 않는다.

## 커밋·PR 규약

커밋 메시지는 한국어 Conventional Commits를 따릅니다. `type: 명사형 제목` +
배경·의도 2줄 + 수정 내용 불릿. 본문에 파일·모듈 이름은 쓰지 않습니다(diff가
이미 보여줍니다). 전체 규칙은 [`.gitmessage`](../.gitmessage)에 있습니다.

`/bouncer-commit`이 task 커밋 메시지를, `/bouncer-finalize`가 Distill 승격분
등 remainder 커밋 메시지를 plan 때 쓴 문서 필드로 조립합니다. 메시지를 새로
짓지 않습니다.

- **task 커밋** (`bouncer commit`): `bouncer.commit_type` + **task `title`**이
  제목(없으면 blueprint `title`), task `bouncer.commit_intent`(정확히 2줄;
  없거나 무효면 배경·의도 생략)이 배경·의도, verification `title`이 수정
  내용. blueprint `commit_intent` 폴백은 없다.
- **finalize remainder**: blueprint `title` + task 문서들을 번호 순으로 스캔해
  고른 **가장 큰 번호**의 유효 `commit_intent` 2줄. 유효 항목이 없으면
  제목만.

Epic/Blueprint/Distill 식별자는 커밋에 넣지 않고 PR 본문·blueprint 문서에
둡니다.
execute 브랜치도 같은 `bouncer.commit_type`을 prefix로 씁니다:
`<type>/<id>-<slug>` (`feat/…`, `refactor/…`, `test/…` 등).
scaffold 기본값(`001 slug` 등)을 남기면 그 문구가 커밋에 들어가므로,
`/bouncer-plan`에서 `.gitmessage` 기준으로 `title`·task `commit_intent`를
고쳐 두세요. `/bouncer-commit` 직전에 task `commit_intent`가 없으면 스킬이
Goal & intent에서 채워 넣을 수 있습니다.

`npm run setup`은 `git config commit.template .gitmessage`와
`git config core.hooksPath .githooks`를 실행합니다. **클론해도 자동 적용되지
않습니다.** git이 저장소가 로컬 설정을 바꾸는 것을 막기 때문에 각자 한 번
실행해야 합니다. 템플릿은 에디터가 열릴 때만 보이므로 `git commit -m`에는
적용되지 않습니다.

pre-commit(`.githooks/pre-commit`)은 `npm run check:emit`과 `npm run lint`만
돌립니다. emit 검사는 CI와 같은 `scripts/check-emit.js`를 씁니다. coverage와
audit는 매 커밋에는 넣지 않고 원격 CI에 둡니다. 우회는
`git commit --no-verify`입니다.

PR/MR 본문 템플릿은 두 곳에 같은 형식으로 있습니다.

| 위치 | 쓰이는 곳 |
| --- | --- |
| `.github/pull_request_template.md` | GitHub PR 작성 시 자동 적용 |
| `.gitlab/merge_request_templates/Default.md` | GitLab MR 작성 시 템플릿 드롭다운에서 선택 |

`/bouncer-finalize`의 draft PR 본문은 플러그인 내장 템플릿
(`scripts/lib/templates.js`의 `pr.md`)을 사용합니다. 프로젝트에 별도 사본을
두지 않습니다. 자동·수동 템플릿은 같은 섹션 순서입니다.

1. `관련 이슈` — 근거 있는 이슈와, head branch/commit에서 열리는 Explain
   Markdown 링크. 이슈가 없으면 이슈 불릿을 만들지 않습니다. 수동 비-Bouncer
   요청에서는 Explain 줄을 지울 수 있습니다.
2. `배경 · 변경 의도` — Explain `Background` / `Intuition`을 요약·구체화
3. `주요 변경 내용` — Explain `Code` + branch diff
4. `로직 흐름` — 흐름이 바뀐 경우만 Mermaid. 아니면 제목까지 삭제
5. `리뷰 포인트` — Explain·diff·계획·accepted finding만
6. `확인 방법` — task 검증 증적(번호순)과 PR 직전 `finalize --yes` 최종 검증

`## 이해 상태`·Quiz·comprehension·Epic/Blueprint id·Features/Fixes 체크박스는
넣지 않습니다.

PR **제목**은 커밋 subject와 다릅니다. finalize가 만드는 draft 제목 형식:

```text
[YYMMDD] (→ MergeTarget) [Type/Type] 요약
```

예: `[260803] (→ Develop) [Feat] 전역 Distill을 init·finalize 런타임에 연결`

- `YYMMDD`: 작성일(KST)
- `MergeTarget`: `config.base_branch` / `pr.base` (첫 글자 대문자)
- `Type`: 브랜치 커밋 타입의 PascalCase (`feat` → `Feat`); 여러 타입이면 `/`로 연결
- `요약`: 해당 커밋들을 대표하는 한국어 명사구 (보통 blueprint `title`)

Epic/Blueprint id는 제목과 본문 어디에도 넣지 않습니다.

GitLab에서 기본값으로 강제하려면 프로젝트 설정 → Merge requests →
*Default description template*에서 지정해야 합니다.

## CI와 배포 계약

CI는 `main`/`develop` 푸시와 PR마다 같은 명령을 돌립니다. GitHub Actions
(`.github/workflows/test.yml`)와 GitLab CI(`.gitlab-ci.yml`)는 러너 문법만
다르고, `npm ci` 뒤에 `npm run ci`만 호출합니다.

`scripts/`와 `hooks/` 아래 코드는 `node_modules`에 의존하면 안 됩니다.
마켓플레이스 설치가 깨집니다. `test/distribution.test.js`가 이 계약을 강제합니다.
`scripts/vendor/`는 서드파티 코드라 린트 대상에서 제외합니다.

릴리스는 `claude plugin tag`로 `bouncer--v<version>` 태그를 만듭니다. 이 명령이
검증하는 범위는 `.claude-plugin`의 `plugin.json`과 `marketplace.json`까지입니다.
버전이 일치해야 하는 매니페스트는 넷입니다(`.claude-plugin` /
`.cursor-plugin` / `.codex-plugin` / 루트 `plugin.json`). `package.json`도
같은 값이어야 합니다. 나머지 매니페스트 일치는
`test/cursor-plugin.test.js`가 잡습니다.

## 라이선스와 기여물

이 저장소는 [Apache-2.0](../LICENSE)입니다. PR·패치·문서 등 기여물은 별도의
약정이 없으면 같은 Apache-2.0 조건으로 제공되는 것으로 봅니다. 제3자 고지
(`scripts/vendor/js-yaml.LICENSE`, `references/stop-slop/LICENSE`)는 반입
코드의 원 라이선스이므로 삭제하지 않습니다.

참여는 [Contributor Covenant 2.1](../CODE_OF_CONDUCT.md)을 따릅니다.

## 피드백

사용 중 마찰·버그는 이슈 템플릿(**막힌 지점** / **버그**)으로 남겨 주세요.

보안 취약점은 공개 이슈·PR로 올리지 말고 [SECURITY.md](../SECURITY.md)의
비공개 이메일로 제보하세요.
