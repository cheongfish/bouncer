---
type: bouncer.explain
title: 001 설명
description: Explanation for the 039 release security blueprint
resource: .bouncer/context/epics/039-release-security/blueprints/001-security-legal-baseline/explain.md
tags:
  - bouncer
  - explain
timestamp: '2026-08-15T18:22:40.424+09:00'
bouncer:
  id: EXPLAIN-001
  epic_id: '039'
  blueprint_id: '001'
  status: published
  comprehension:
    - range_from: develop
      range_to: 0c611712170ddc00ad7747af5da01c4551ef788d
      diff_sha: 9b4c4a0cb7cd8c463e7d545196c65534f4fe0a1eeb02042d896e26671545a51c
      quiz_score: '5/5'
      disposition: 벤더 바이트 동일·Apache-2.0·기본 strict·통합 ci·coverage 하한을 모두 맞춤
      recorded_at: '2026-08-15T18:23:51+09:00'
---
# 설명

## 배경
공개 전에 런타임 벤더(`scripts/vendor/js-yaml.js`)가 high 취약 버전에 묶여 있었고,
루트에 Apache-2.0·보안 제보·기여 규칙이 없었다. TypeScript는 암시적 any를 허용했고,
GitHub와 GitLab은 서로 다른 검사 명령을 돌렸다. 이 blueprint는 벤더를 안전 버전과
바이트 단위로 맞추고, 라이선스·거버넌스 문서를 고정하고, `scripts/src` 전체를
`strict: true`로 올린 뒤, `npm run ci` 하나로 emit·coverage·lint·typecheck·audit를
묶어 두 CI가 같은 계약을 강제하게 한다.

## 직관
배포본·타입·CI가 세 갈래로 새지 않게, 한 저장소 명령으로 막는 공개 차단선이다.

## 코드
- `scripts/vendor/js-yaml.js` + `test/distribution.test.js` — 설치본과 바이트 동일, 최소 4.3.1
- `LICENSE`, `SECURITY.md`, `CODE_OF_CONDUCT.md`, `docs/contributing.md`,
  `test/open-source-readiness.test.js` — Apache-2.0과 공개 거버넌스
- `tsconfig.json` (`strict: true`), `eslint.config.js` (`typescript-eslint`) —
  전 제품 TypeScript 소스
- `scripts/check-emit.js`, `package.json`의 `ci` / `test:coverage`,
  `.github/workflows/test.yml`, `.gitlab-ci.yml`, `.githooks/pre-commit`,
  `test/ci-contract.test.js` — 공통 CI와 로컬 pre-commit(emit+lint)

## 퀴즈
1. 런타임 벤더 보안을 닫을 때 이 blueprint가 강제하는 핵심 계약은?
   - A) `package-lock.json`만 안전하면 `scripts/vendor`는 그대로 둬도 된다
   - B) 설치된 `js-yaml` dist와 `scripts/vendor/js-yaml.js`가 바이트 단위로 같고 최소 4.3.1이다
   - C) `npm audit`가 vendor 디렉터리를 직접 스캔한다

2. 저장소 라이선스와 `package.json` SPDX는?
   - A) Apache-2.0, `package.json`에도 `Apache-2.0`을 둔다
   - B) MIT, `package.json`에는 license 필드를 두지 않는다
   - C) Unlicense, NOTICE만 루트에 둔다

3. TypeScript 기본 설정은 이 blueprint 이후 무엇이 맞나?
   - A) 기본 `tsconfig.json`은 `strict: false`이고 `tsconfig.strict.json`만 strict다
   - B) typecheck는 건너뛰고 ESLint만 켠다
   - C) 기본 `tsconfig.json`이 `strict: true`이며 임시 `tsconfig.strict.json`은 제거됐다

4. `npm run ci`가 묶는 순서와 두 CI의 호출 방식은?
   - A) `check:emit` → `test:coverage` → `lint` → `typecheck` → `npm audit --audit-level=high`이고, 두 CI는 `npm ci` 뒤 `npm run ci`만 호출한다
   - B) GitHub는 `npm test`, GitLab은 `npm run lint`만 호출한다
   - C) coverage를 먼저 돌린 뒤 emit을 검사한다

5. coverage 하한의 측정 범위와 수치는?
   - A) 저장소 전체, line 80%
   - B) `scripts/vendor/**`만, function 100%
   - C) `scripts/lib/**`만, line 94% / branch 83% / function 96%

## 이해 상태
- 점수: 5/5
- 정답: 1B, 2A, 3C, 4A, 5C
- 응답: 1B, 2A, 3C, 4A, 5C
- 채점: 전부 정답
- disposition: 벤더 바이트 동일·Apache-2.0·기본 strict·통합 ci·coverage 하한을 모두 맞춤
- range: develop..0c611712170ddc00ad7747af5da01c4551ef788d
- diff_sha: 9b4c4a0cb7cd8c463e7d545196c65534f4fe0a1eeb02042d896e26671545a51c
