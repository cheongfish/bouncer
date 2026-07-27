# Bouncer 팀 배포 준비 — 개선 사항

작성일: 2026-07-27
대상: 사내 팀 배포(내부 공유 → 실사용 → 확산)
현재 판단: **원격 저장소만 있으면 배포 가능.** 신뢰성 결함(P0-1), 첫 사용자 차단
요인(P1-1/P1-3/P1-4), 배포 자산(P0-2/P0-3)이 모두 해소됐다. 남은 것은 사내 Git에
올리고 그 URL을 팀에 공유하는 일이다.

갱신: 2026-07-27 — P0·P1 전체, P2(LICENSE 제외), P3(파일럿 실행 제외) 완료.
`npm test` 194/194, `npm run lint` 통과.
남은 배포 차단 요인은 사내 Git 원격 저장소 등록 하나뿐이다.

## 판단 근거 (2026-07-27 실측)

- `npm test` 150/150 통과, `git diff --check` 정상.
- 임시 저장소에서 `init → scaffold → plan 게이트 → execute 게이트 → finalize`
  전 구간을 수동 실행해 정상 동작을 확인했다.
- 같은 실행에서 아래 P0/P1 결함을 재현했다.

---

## P0 — 배포 전 반드시 해결

### P0-1. 검증 증적을 하네스가 검증하지 않는다 — **해결됨 (7bb945f)**

**증상.** 한 번도 실행하지 않은 명령을 `verification.md`에 적어도 execute 게이트가
통과한다. 실측에서 "총 9999개 테스트 전부 통과(실제로는 실행한 적 없음)"라는 본문으로
`{ ok: true, failures: [] }`를 받았다.

**원인.** `config.json`의 `verify` 명령을 실행하는 코드가 저장소에 없다. G13은
`## Command` / `## Evidence` 헤딩 존재 여부만, G14는 `## Findings` 존재와 findings
스키마만 검사한다.

**영향.** 거버넌스 문서가 약속한 "실제 통과 증거"가 성립하지 않는다. 팀에 배포하면
"게이트를 통과했다"는 신호를 신뢰할 수 없고, 이는 이 플러그인의 존재 이유를 무너뜨린다.

**조치.**

- [x] `bouncer verify --blueprint <dir>` 서브커맨드를 추가해 `config.verify`를 직접 실행한다.
- [x] 종료 코드, 실행 시각, 출력 요약(말미 N줄), 명령 문자열을 하네스가
      `verification.md`의 `## Command` / `## Evidence`에 기록한다.
- [x] 하네스가 기록한 실행 메타데이터(예: `bouncer.verification.exit_code`,
      `ran_at`)가 없으면 G13을 실패시킨다. 에이전트가 손으로 쓴 본문만으로는
      통과할 수 없게 한다.
- [ ] 검증을 건너뛰어야 하는 예외 상황은 명시적 플래그와 사유 기록으로만 허용한다.

### P0-2. 설치·사용 문서가 없다 — **해결됨**

**증상.** README, 설치 안내, 예제 워크플로가 전혀 없다. 지금 팀원에게 저장소를 주면
무엇을 하는 도구인지, 어떻게 붙이는지 알 방법이 없다.

**조치.**

- [x] `README.md` 작성 — 정의, 해결하는 문제, 설치, 4개 명령 흐름, 게이트 표,
      막혔을 때 대처 표, 위협 모델(P1-2 항목), 개발 안내.
- [x] 5분 quickstart 포함.
- [x] `config.json` 전체 필드 설명 표 포함.

### P0-3. 배포 경로가 정의되지 않았다 — **해결됨 (원격 저장소 등록만 남음)**

**증상.** `package.json`이 `private: true`이고, 플러그인 마켓플레이스 매니페스트가 없으며,
태그·릴리스 없이 `develop` 브랜치 하나만 있다.

**조치.**

- [x] 배포 방식 확정: **같은 저장소를 마켓플레이스로**(`.claude-plugin/marketplace.json`,
      플러그인 소스 `"./"`). 사내 npm 레지스트리가 생기면 `npm` 소스로 전환 가능.
- [x] 매니페스트 작성 + 설치 명령 문서화. 로컬 등록·설치로 실제 검증했다
      (커맨드 4 / 스킬 8 / 훅 2 전부 해석됨).
- [x] `js-yaml` 벤더링 — Claude Code가 `npm install`을 돌리지 않으므로 필수였다.
      `node_modules` 없는 복사본에서 CLI와 훅 2개 동작을 실측 확인.
- [x] `main` 브랜치 생성, `bouncer--v0.1.0` 태그 생성(`claude plugin tag`가
      plugin.json ↔ marketplace.json 버전 일치를 검증하는 형식).
- [x] `CHANGELOG.md` 시작.
- [ ] **사내 Git 원격 저장소를 만들고 `main`과 태그를 푸시한다.** 현재 이 저장소에는
      `origin`이 없어 팀원이 설치할 URL이 존재하지 않는다.

---

## P1 — 첫 사용자가 바로 부딪히는 문제

### P1-1. 신규 저장소에서 finalize가 런타임 산출물 때문에 막힌다 — **해결됨**

**증상.** `.gitignore`가 없는 저장소에서 `graphify-out/graph.json`과
`node_modules/`가 out-of-scope 위반으로 잡혀 finalize가 하드 중단된다.

**원인.** 안전 부트스트랩 정책상 init이 `.gitignore`를 쓰지 않는데, finalize의
허용 집합에도 알려진 런타임 산출물 예외가 없다. 정책 D2는 `graphify-out/`을 제외
대상으로 규정하지만 이를 강제하거나 안내하는 코드가 없다.

**조치.**

- [x] finalize/커밋 가드가 `node_modules/`, `graphify-out/`, `.worktrees/`를
      위반이 아니라 무시 대상으로 다룬다 (`finalize.js` `RUNTIME_ARTIFACTS`).
      finalize는 스테이징 대상에서도 제외한다.
- [x] init이 `.gitignore` 누락을 감지해 추가할 항목을 **안내**한다(자동 수정 아님).
      `init` 결과의 `gitignoreSuggestions`, `/bouncer-init` 3단계.
- [x] 정책 D2 서술을 실제 동작과 일치시켰다.

### P1-2. 커밋 가드를 쉽게 우회할 수 있다 — **해결됨**

**증상.** `isGitCommit`이 다음을 탐지하지 못한다.

| 입력 | 탐지 |
| --- | --- |
| `git commit -m x` | O |
| `git -C /tmp/repo commit -m x` | O |
| `bash -c "git commit -m x"` | X → **O** (중첩 셸 파싱) |
| `git $FLAG commit` | X → **O** (판단 불가 → fail-closed) |
| `git ci -m x` (alias) | X → **O** (`git config`로 확장) |

또한 가드는 커밋만 막고 범위 밖 파일의 *작성*은 막지 않는다.

**조치.**

- [x] 인용부호를 인식하는 토크나이저로 교체하고, 중첩 셸(`sh`/`bash`/`zsh`/`dash`/
      `ksh`/`ash`, `-lc` 결합 플래그 포함) 내부를 재귀 파싱한다. 셸 확장이 섞이면
      판단 불가로 보고 fail-closed 한다. `git config alias.*`를 조회해 별칭을
      확장하며, `!` 셸 별칭은 그 내용을 다시 파싱한다.
- [x] 남은 우회 경로(셸을 거치지 않는 스크립트·`make`·`subprocess`, plumbing
      조합, 범위 밖 파일 *작성*)를 README 위협 모델에 명시했다.
- [x] finalize의 최종 범위 검사를 최후 방어선으로 유지(변경 없음).

실제 저장소에서 훅을 돌려 확인: `bash -c "git commit"`, `git ci`(실제 alias),
`git $FLAG commit` 모두 exit 2로 차단되고, `npm test`/`git status`는 통과했다.

오탐 비용: `git $ANYTHING`은 커밋이 아니어도 범위 검사를 거친다. 범위 밖 파일이
스테이징된 경우에만 실제로 막히므로 평상시에는 드러나지 않는다.

### P1-3. scaffold 산출물이 게이트 요구사항과 불일치한다 — **해결됨**

**증상.** init은 5개 섹션이 있는 `templates/tasks.md`를 만들지만, scaffold는
`# Tasks` + `- [ ] TODO` 본문을 쓴다. G10은 5개 섹션을 요구하므로 갓 scaffold한
문서는 항상 G10에 걸린다.

**조치.**

- [x] scaffold가 `.bouncer/templates/`를 런타임에 읽어 본문으로 사용한다.
      템플릿이 없거나 비었으면 `scripts/lib/templates.js`의 내장 기본값으로 폴백.
      `<EPIC-id>` / `<BP-id>` / `<name>` 치환 지원.
- [x] init과 scaffold가 같은 템플릿 정의(`scripts/lib/templates.js`)를 공유한다.
      `verification.md`(`## Command`/`## Evidence`)와 `review.md`(`## Findings`)의
      불일치도 함께 해소됐다.

참고: 섹션 헤딩만 있고 본문이 비면 `parseSections`가 미작성으로 판정하므로,
갓 scaffold한 tasks.md는 여전히 G10에 걸린다. 작성 전 통과를 막는 의도된 동작이다.

### P1-4. 그래프 근거 게이트가 기본값으로 자동 충족된다 — **해결됨**

**증상.** scaffold가 `graph.basis: scaffold-default`를 미리 써넣어 G4의 basis 검사가
무의미해진다.

**조치.**

- [x] scaffold가 `graph.basis`를 빈 문자열로 두어, `graphify-runner`(또는 사용자)가
      실제 근거를 기록해야 G4를 통과한다. `/bouncer-plan` 5·9단계에 명시.

---

## P2 — 팀 운영을 위해 필요

- [x] **CI 추가.** GitHub Actions(`.github/workflows/test.yml`)와 GitLab CI
      (`.gitlab-ci.yml`)를 모두 추가. `main`/`develop` 푸시와 PR마다 `npm test` +
      `npm run lint`. 사설 저장소 과금을 고려해 `ubuntu-latest` 단일 러너만 사용
      (Linux 1x, Windows 2x, macOS 10x).
- [ ] **LICENSE 추가.** 보류 — 사내 정책 확인 필요. 개인 GitHub은 private으로 결정.
- [x] **린터 도입.** ESLint flat config(`eslint.config.js`)로 기존 스타일을 규칙화.
      `max-len`은 실측 관례에 맞춰 120(초과 7줄은 수정). 벤더링 코드 제외.
      도입 중 죽은 인자 `init({ timestamp })`, 불필요한 초기 할당 2건, 남은
      eslint-disable 지시문 1건을 제거했다.
- [x] **오류 메시지 개선.** `S11 blueprint documents not found`를 추가해 경로 오타를
      문서 문제와 구분한다. blueprint 문서가 하나도 없으면 게이트 검사와 `verify`
      명령 실행을 건너뛰고 즉시 반환한다. epic index는 존재 판정에서 제외해야
      blueprint 이름 오타가 새지 않는다.
- [x] **죽은 설정 정리.** `.gitignore`에서 `.worktrees/` 제거.
      `finalize.js`의 `RUNTIME_ARTIFACTS`에는 남겨 둔다 — 구 레이아웃에서 넘어온
      저장소의 잔여 디렉터리를 범위 위반으로 보고하지 않기 위해서다(주석으로 명시).
- [x] **문서 문구 테스트 비용 점검 — 판단 완료.** 유지한다. 근거와 향후 작성 규칙은
      `GOVERNANCE-ARCHITECTURE-DECISIONS.md` 섹션 G에 기록했다. 요지: 명령·스킬
      마크다운은 에이전트를 구동하는 제품 표면이므로 계약 검사에 해당하고, 실제로
      이 저장소에서 회귀를 잡아냈다. 다만 앞으로는 *식별자 존재*만 단언하고 문장
      구조는 단언하지 않는다. 일괄 재작성은 하지 않는다(실계약 삭제 위험).
      현황: 37개 파일 중 13개가 문서 대상, 문구 단언 142개.

---

## P3 — 배포 후 확인

- [x] **실사용 검증 — 완주.** EPIC-001/BP-001(`bouncer` CLI 사용법 출력)로 init →
      plan 게이트 → execute 게이트 → finalize 전 구간을 돌리고, Bouncer가 직접
      커밋했다(`a221b3b`, 9개 파일). 게이트는 한 번도 잘못된 통과를 주지 않았다.

      **찾은 것 (이것이 이 항목의 성과다):**
      - *배포 차단급* — finalize가 `.bouncer/current`를 정리하지 않아 사이클 종료 후
        무관한 커밋이 전부 차단됐다. 파일럿 첫날 전원이 부딪혔을 문제. 수정 완료.
      - 기록된 증적이 저장소 자체의 이름 가드를 깨뜨렸다. `.bouncer/context/`를
        기록물로 분류해 해결.
      - 미해결로 기록: `verification.md` 중복 기록(229줄), 커밋 메시지가 문서
        `title`에 좌우됨, trailer 자리 없음, `graph.basis` 수기 입력.
- [ ] **파일럿.** 실제 팀원이 필요해 미실행. 안내 문서 `docs/PILOT.md` 준비 완료
      (목적·첫 사이클 절차·기록 방법·운영자 체크리스트·알려진 마찰 목록).
- [x] **피드백 창구.** 이슈 템플릿을 두 호스트 모두에 추가했다
      (`.github/ISSUE_TEMPLATE/`, `.gitlab/issue_templates/`). friction/bug 2종이며,
      "스스로 우회한 경우에도 기록"을 명시했다.

---

## 다음 세션 시작점 (2026-07-27 기준)

현재 상태: `develop` = `main` = `7054610`, 워킹 트리 clean, `npm test` 194/194,
`npm run lint` 통과, 태그 `bouncer--v0.1.0`. **원격 저장소 없음.**

### 남은 작업 (우선순위 순)

1. **원격 등록 + 푸시** — 유일한 배포 차단 요인. 사내 GitLab과 개인 GitHub(private)
   두 곳. 비공개이므로 SSH 리모트 권장(이유는 README 설치 절).
   푸시 전까지 태그는 옮겨도 되지만, 푸시 후에는 버전을 올릴 것.

2. **커밋 산출물 정리 blueprint** — 아래 셋은 한 관심사라 한 blueprint로 묶는다.
   - `verification.md` 중복 기록: `verification.js`가 같은 출력을 frontmatter
     `output_tail`과 본문 `## Evidence`에 두 번 쓴다(191개 테스트 기준 229줄).
     G13이 본문에 요구하는 것은 명령 문자열과 `Exit code: 0`뿐이므로 본문
     코드블록은 뺄 수 있다. 실패 시에는 본문에도 꼬리를 남기는 편이 낫다.
   - `buildCommitMessage`가 팀 규약을 위반한다: 스코프 `(BP-001)` 사용, 본문에
     distill 파일 경로. 제안 형태는 제목·본문을 팀 규약대로 두고 Epic/Blueprint/
     Distill을 **trailer**로 내리는 것. 언어는 문서 `title`에서 오므로 하드코딩
     하지 않는다 — 다른 팀이 설치해도 그 팀 언어를 따라야 한다.
   - trailer 자리 추가(`Co-Authored-By` 등). 위 변경에 함께 들어간다.

   `test/finalize-pure.test.js`가 현재 형식을 고정하고 있으므로 함께 고쳐야 한다.

3. **LICENSE** — 회사 정책 확인 대기. 개인 GitHub은 private으로 결정됨.

4. **파일럿 실행** — 원격 등록 후. `docs/PILOT.md` 참조.

5. **`graph.basis` 수기 입력** — 파일럿에서 실제 불편 보고가 나오면 그때 판단한다.
   지금 자동화하면 P1-4(게이트 자동 충족)가 되돌아간다.

### 이 저장소의 규약

- 커밋: 한국어 Conventional Commits (`.gitmessage`). `type: 명사형 제목` +
  `~함` 본문 최대 3줄, 본문에 파일·모듈명 금지. 출처는 `~/.cursor/skills/commit`.
- 작업 방식: TDD(실패 테스트 먼저), 문서 테스트는 식별자 존재만 단언
  (`GOVERNANCE-ARCHITECTURE-DECISIONS.md` 섹션 G).
- 가능하면 Bouncer 사이클로 진행한다. 이 저장소가 첫 사용자다.

---

## 권장 순서

1. P0-1 (검증 실행) — 이것이 없으면 나머지 개선은 신뢰할 수 없는 도구를 다듬는 일이다.
2. P1-1, P1-3 — 첫 사용자가 즉시 막히는 지점.
3. P0-2, P0-3 — 문서와 배포 경로.
4. P2 — 운영 기반.
5. P3 — 실사용 검증과 확산.
