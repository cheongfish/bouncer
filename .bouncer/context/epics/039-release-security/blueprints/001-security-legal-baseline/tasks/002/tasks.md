---
type: bouncer.tasks
title: Apache-2.0 공개 거버넌스 기반
description: Task specification for the 039 release security work
resource: .bouncer/context/epics/039-release-security/blueprints/001-security-legal-baseline/tasks/002/tasks.md
tags:
  - bouncer
  - tasks
timestamp: '2026-08-15T15:37:35.704+09:00'
bouncer:
  id: TASKS-002
  epic_id: '039'
  blueprint_id: '001'
  status: verified
  verify: npm test
  commit_intent:
    - 라이선스와 비공개 보안 신고 경로가 없어 외부 사용·기여·취약점 제보의 조건이 불명확함
    - Apache-2.0과 보안·행동·기여 정책을 루트 공개 문서와 패키지 메타데이터에 고정함
  affected_paths:
    - LICENSE
    - SECURITY.md
    - CODE_OF_CONDUCT.md
    - README.md
    - docs/contributing.md
    - package.json
    - test/open-source-readiness.test.js
  graph:
    generated_at: '2026-08-15T15:55:18+09:00'
    command: 'graphify query "Apache license security policy code of conduct contributing package metadata open source readiness" --graph graphify-out/{source,context}/graph.json'
    suggested_paths:
      - test
      - .bouncer/context/epics/033-quality-security/blueprints/001-context-review-guard
      - .bouncer/context/epics/037-distill-promotion-consent/blueprints/001-promotion-proposal-acq
      - .bouncer/context/epics/038-distill-worktree-base/blueprints/001-checkout-relative-distill
    basis:
      - graph: source
        status: reused
        query: Apache license security policy code of conduct contributing package metadata open source readiness
        result: '57 nodes; top paths: test/cli-verify.test.js, test/cli-init.test.js, test/cli-validate.test.js'
      - graph: context
        status: reused
        query: Apache license security policy code of conduct contributing package metadata open source readiness
        result: '12 nodes; top paths: epic 033, 037, and 038 blueprint explains'
---
# 작업

Blueprint: [001](../../index.md)

## 목표와 의도
저장소를 Apache-2.0으로 공개하고 외부 기여와 보안 제보가 따라야 할 규칙을 루트
문서에서 찾을 수 있게 한다. `package.json`은 npm 게시 여부와 무관하게 SPDX
라이선스와 저장소·이슈 위치를 갖는다. 공개 보안 이슈 대신 기존 plugin author
email로 비공개 제보를 받으며, 일반 버그는 기존 이슈 템플릿을 사용한다.

## 인터페이스
- 제공: 루트 `LICENSE`의 Apache-2.0 전문, `SECURITY.md`의 지원 버전·비공개
  신고·응답 범위, `CODE_OF_CONDUCT.md`의 행동 및 집행 기준, 기여물이
  Apache-2.0으로 제공된다는 `docs/contributing.md` 규칙을 추가한다.
- 거부: 보안 취약점을 일반 공개 이슈로 받는 안내, npm 게시 안내, 미검증 버전을
  지원한다고 읽히는 문구, 기존 제3자 라이선스 고지 삭제를 허용하지 않는다.

## 변경 범위
- Create `LICENSE` — 변경하지 않은 Apache License 2.0 전문을 둔다.
- Create `SECURITY.md` — 최신 릴리스 지원 범위, 비공개 신고 주소, 초기 응답과
  공개 조율 원칙을 적는다.
- Create `CODE_OF_CONDUCT.md` — Contributor Covenant 2.1 전문과 기존 author
  email 기반 집행 연락처를 둔다.
- Modify `README.md` — 라이선스 미지정 문구를 Apache-2.0 링크로 바꾸고 보안 신고와
  행동강령 진입점을 추가한다.
- Modify `docs/contributing.md` — 기여물의 Apache-2.0 제공, 행동강령, 보안 제보
  분리 규칙을 추가한다.
- Modify `package.json` — `license`, `repository`, `homepage`, `bugs`, `engines`를
  실제 Git 플러그인 배포와 Node 24 요구사항에 맞춘다.
- Create `test/open-source-readiness.test.js` — 루트 정책 파일과 package SPDX,
  README 링크, 제3자 고지 보존을 단언한다.

## 변경 금지
- `scripts/vendor/js-yaml.LICENSE` — js-yaml MIT 고지를 유지한다.
- `skills/stop-slop/LICENSE` — 반입 스킬의 MIT 고지를 유지한다.
- `skills/agentic-code-benchmark/NOTICE.md` — Apache-2.0 반입 출처를 유지한다.
- `plugin.json` — 플러그인 매니페스트 스키마에 확인되지 않은 license 키를 넣지 않는다.

## 제약 조건
- Apache-2.0 전문과 Contributor Covenant 2.1 전문은 공식 원문을 임의 번역하거나
  요약하지 않는다.
- 보안 연락처는 이미 매니페스트에 공개된 author email을 재사용하고 새 개인정보를
  추가하지 않는다.
- `private: true`는 유지한다. 이 필드는 npm 오게시를 막으며 오픈소스 라이선스와
  충돌하지 않는다.
- 저작권 소유자를 추정한 `NOTICE`를 만들지 않는다.

## 체크리스트
- [ ] `test/open-source-readiness.test.js`를 추가해 현재 상태에서 실패를 확인한다.
  ```js
  assert.match(license, /Apache License\s+Version 2\.0/);
  assert.strictEqual(pkg.license, 'Apache-2.0');
  assert.doesNotMatch(readme, /라이선스를 아직 지정하지 않았습니다/);
  ```
- [ ] Apache-2.0과 Contributor Covenant 2.1 공식 원문을 루트 파일에 추가한다.
- [ ] `SECURITY.md`에 지원 범위와 공개 이슈가 아닌 신고 경로를 적는다.
- [ ] README·기여 문서·package metadata를 같은 계약으로 맞춘다.
- [ ] 제3자 LICENSE/NOTICE 세 파일이 삭제·변경되지 않았는지 diff로 확인한다.
- [ ] `node --test test/open-source-readiness.test.js`와 `npm test`를 실행한다.
