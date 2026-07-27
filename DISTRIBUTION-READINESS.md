# Bouncer 팀 배포 준비 — 개선 사항

작성일: 2026-07-27
대상: 사내 팀 배포(내부 공유 → 실사용 → 확산)
현재 판단: **원격 저장소만 있으면 배포 가능.** 신뢰성 결함(P0-1), 첫 사용자 차단
요인(P1-1/P1-3/P1-4), 배포 자산(P0-2/P0-3)이 모두 해소됐다. 남은 것은 사내 Git에
올리고 그 URL을 팀에 공유하는 일이다.

갱신: 2026-07-27 — P0 전체와 P1 전체 완료. `npm test` 185/185 통과.
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

- [ ] **CI 추가.** `.github/workflows`에서 push/PR마다 `npm test`를 실행한다.
      기여자가 늘면 수동 실행에 의존할 수 없다.
- [ ] **LICENSE 추가.** 사내 배포라도 라이선스 표기가 없으면 재사용 조건이 불명확하다.
- [ ] **린터 도입.** 코드 스타일이 일관되지만 강제 수단이 없다. ESLint 설정과 CI 연동.
- [ ] **오류 메시지 개선.** 존재하지 않는 blueprint 경로로 finalize하면
      "문서 없음"이 아니라 `G9 distill.status != published`가 나온다. 문서 부재를
      별도 실패 코드로 구분한다.
- [ ] **죽은 설정 정리.** 저장소 `.gitignore`의 `.worktrees/`는 worktree가 저장소 밖으로
      옮겨진 뒤 의미가 없다.
- [ ] **문서 문구 테스트 비용 점검.** 34개 테스트 파일 중 13개가 Markdown 문구를
      정규식으로 검사한다. 리브랜드 회귀 방지에는 유효하나, 문구 수정마다 깨지므로
      검사 대상을 계약 수준(필수 섹션·명령 경로)으로 좁힐지 판단한다.

---

## P3 — 배포 후 확인

- [ ] **실사용 검증.** 이 저장소 자체를 Bouncer로 관리해 한 사이클을 완주한다.
      현재 `.bouncer/` 사용 이력이 없어 실제 에이전트 통합 경로가 미검증 상태다.
- [ ] **파일럿.** 팀원 1–2명에게 먼저 붙여 보고 막히는 지점을 기록한다.
- [ ] **피드백 창구.** 이슈 템플릿 또는 수집 채널을 정한다.

---

## 권장 순서

1. P0-1 (검증 실행) — 이것이 없으면 나머지 개선은 신뢰할 수 없는 도구를 다듬는 일이다.
2. P1-1, P1-3 — 첫 사용자가 즉시 막히는 지점.
3. P0-2, P0-3 — 문서와 배포 경로.
4. P2 — 운영 기반.
5. P3 — 실사용 검증과 확산.
