---
type: bouncer.explain
title: 003 설명
description: Explanation for the 039 release security blueprint
resource: .bouncer/context/epics/039-release-security/blueprints/003-one-zero-release/explain.md
tags:
  - bouncer
  - explain
timestamp: '2026-08-15T20:25:55.963+09:00'
bouncer:
  id: EXPLAIN-003
  epic_id: '039'
  blueprint_id: '003'
  status: published
  comprehension:
    - range_from: develop
      range_to: 73e0c94b950e571c226773b4e35a6eafed8b4a6f
      diff_sha: d67e2f5db9888f7e51209fa308bab1ed18c1d7639f7e4a6c66dfa9e2fcd36dbb
      quiz_score: 3/3
      disposition: 릴리스 문서와 태그 후 운영 경계를 이해함
      recorded_at: '2026-08-15T20:26:46+09:00'
---
# 설명

## 배경
배포 매니페스트와 npm 메타데이터가 이전 버전을 가리키면 설치 호스트마다 서로
다른 릴리스를 보게 된다. 이 blueprint는 모든 공개 버전을 `1.0.0`으로 맞추고,
그 정합성을 테스트로 고정했다. 출시 문서는 태그 전에는 준비 상태와 미검증 상태만
말하고, 태그 이후의 smoke 증거는 태그에 연결된 GitHub Release에 남기도록 분리했다.

## 직관
같은 봉인을 붙인 상자를 먼저 검사한 뒤, 봉인을 찍고 그 봉인 번호로 배송 기록을
남기는 흐름이다.

## 코드
- `package.json`, `package-lock.json`, 각 호스트 매니페스트: 공개 버전 `1.0.0`의
  단일 기준이다.
- `test/cursor-plugin.test.js`, `test/distribution.test.js`: 패키지·lockfile·호스트
  매니페스트·marketplace의 version drift를 거부한다.
- `CHANGELOG.md`, `README.md`, `docs/README.md`, `docs/compatibility.md`:
  태그 전 1.0.0 출시 준비 상태와 미검증 설치 현황을 설명한다.
- `docs/install.md`, `docs/PILOT.md`: 최종 HEAD CI, 태그와 push, 태그 기준 3×4
  smoke, 동일 태그 GitHub Release 기록의 운영 순서를 안내한다.

## 퀴즈
1. 태그 전 문서가 설치 성공이나 지원 확정을 주장하지 않는 이유는 무엇인가?
   - A) 문서 빌드 시간을 줄이기 위해서
   - B) smoke 증거가 아직 없기 때문에
   - C) 매니페스트가 JSON이기 때문에

2. 릴리스 운영에서 `npm run ci`가 실행되는 올바른 시점은 언제인가?
   - A) 모든 blueprint 커밋을 포함한 최종 HEAD에서, 태그 생성 전에
   - B) task 001 커밋 직후에만
   - C) GitHub Release 작성 뒤에

3. 태그 기준 smoke의 3×4 매트릭스 결과는 어디에 기록하는가?
   - A) 다음 task의 `verification.md`
   - B) 태그에 연결된 GitHub Release
   - C) `package-lock.json`

## 이해 상태
정답: 1-B, 2-A, 3-B. 응답: 1-B, 2-A, 3-B. 결과: 3/3 정답.
Disposition: 릴리스 문서와 태그 후 운영 경계를 이해함.

## Tasks

### Task 001

#### Interface

- 제공: 여섯 배포 메타데이터 파일과 lockfile의 root package 버전 `1.0.0`, 그리고
  이를 비교하는 배포 회귀 검사.
- 거부: 이름은 같지만 버전이 다른 매니페스트·marketplace 항목·lockfile은 테스트를
  통과하지 못한다.

## 변경 범위

- Modify `package.json` — 패키지 공개 버전을 `1.0.0`으로 올린다.
- Modify `package-lock.json` — lockfile root package 버전을 package 메타데이터와 맞춘다.
- Modify `.claude-plugin/plugin.json` — Claude 플러그인 버전을 맞춘다.
- Modify `.claude-plugin/marketplace.json` — marketplace 항목 버전을 맞춘다.
- Modify `.cursor-plugin/plugin.json` — Cursor 플러그인 버전을 맞춘다.
- Modify `.codex-plugin/plugin.json` — Codex 플러그인 버전을 맞춘다.
- Modify `plugin.json` — Antigravity 플러그인 버전을 맞춘다.
- Modify `test/cursor-plugin.test.js` — 네 호스트와 package 버전 일치 검사를 추가한다.
- Modify `test/distribution.test.js` — Claude marketplace·package 버전 검사에
  기대 릴리스 버전을 고정한다.

## 변경 금지

- `scripts/` — 버전 승격은 런타임·CLI 동작을 바꾸지 않는다.
- `docs/` — 릴리스 노트와 설치 안내는 다음 task에서 다룬다.

## 제약 조건

- 기존 매니페스트의 이름, 설명, hooks·skills 선언과 marketplace source를 바꾸지 않는다.
- `npm version`처럼 lockfile 외 파일을 넓게 바꾸는 명령은 쓰지 않고, 바뀐 버전 필드만
  수정한다.
- `1.0.0` 태그는 이 task에서 만들지 않는다.

### Task 002

#### Interface

- 제공: `CHANGELOG.md`의 `1.0.0` 출시 준비 노트와 README·문서 목차의 `1.0.0`
  출시 예정 상태 표기.
- 거부: 태그 전 공개 완료, 실행하지 않은 호스트의 설치 성공, 또는 지원 상태를
  문서가 주장하지 않는다.

## 변경 범위

- Modify `CHANGELOG.md` — `1.0.0` 출시 준비·공개 계약·배포 변경을 Unreleased 아래에 기록한다.
- Modify `README.md` — 파일럿 표기와 현재 배포 목표를 1.0.0 출시 예정 상태로 갱신한다.
- Modify `docs/README.md` — Changelog 링크의 표시 버전과 anchor를 1.0.0 출시 준비 항목으로 갱신한다.
- Modify `docs/compatibility.md` — 아직 릴리스되지 않았다는 문구를 1.0.0 출시 준비와
  호환 정책으로 바꾼다.

## 변경 금지

- `.claude-plugin/` — 배포 버전은 task 001에서 확정한다.
- `docs/install.md` — 실제 smoke 결과와 지원 상태는 task 003에서 기록한다.
- `docs/PILOT.md` — 실행 증거가 생기기 전에는 파일럿 표를 바꾸지 않는다.

## 제약 조건

- Keep a Changelog와 Semantic Versioning 표기를 유지한다.
- 릴리스 문서는 이 blueprint의 목표 릴리스일인 `2026-08-15`를 사용한다. 실제
  `bouncer--v1.0.0` 태그는 모든 task 커밋이 병합된 최종 HEAD에서 task 003 이후
  별도 릴리스 운영 절차로 만든다.
- 태그 생성 전에는 `1.0.0`의 공개 완료·설치 성공·지원 확정을 문서에 단정하지 않는다.
- 공개 CLI·게이트·스키마·호환 정책의 의미는 BP002에서 동결한 범위를 벗어나지 않는다.

### Task 003

#### Interface

- 제공: 태그 후 GitHub Release로 연결되는 `docs/install.md` 설치 절차와
  `docs/PILOT.md` 기록 형식. 릴리스 운영자는 최종 HEAD에 annotated
  `bouncer--v1.0.0` 태그를 만들고, 동일 태그의 GitHub Release에 commit SHA와
  3×4 매트릭스별 결과를 남긴다.
- 거부: 태그 전 smoke 결과를 확정하거나, 증거 없는 조합을 `검증됨`으로 바꾸거나,
  기존 태그를 삭제·강제 이동하지 않는다.

## 변경 범위

- Modify `docs/install.md` — 태그 기준 smoke 실행 절차와 GitHub Release 증거 위치를 안내한다.
- Modify `docs/PILOT.md` — 3×4 저장소 유형·호스트별 결과를 동일 태그 GitHub Release에
  commit SHA와 함께 남기는 형식과 미검증 상태를 기록한다.

## 변경 금지

- `package.json` — 버전은 task 001에서 고정한다.
- `CHANGELOG.md` — 릴리스 노트는 task 002에서 고정한다.
- `.bouncer/context/epics/039-release-security/blueprints/001-security-legal-baseline/` —
  완료된 공개 기반 계획은 변경하지 않는다.

## 제약 조건

- 이 task에서는 태그를 만들지 않는다. 세 task 커밋이 병합된 최종 HEAD에서
  `npm run ci`가 성공한 뒤에만 릴리스 운영자가 태그를 만든다.
- 릴리스 운영자는 `git tag -a bouncer--v1.0.0 <merged-head>`를 사용하고, 태그가
  이미 존재하거나 다른 커밋을 가리키면 중단해 사용자에게 보고한다.
- 태그 push와 원격 marketplace 설치에는 사용자 인증·외부 권한이 필요하므로 릴리스
  운영 시점에 별도 동의를 받는다.
- GitHub Release 작성과 태그 후 smoke는 blueprint 완료 뒤 릴리스 운영자가 수행하는
  외부 작업이며, 그 완료 여부는 이 task의 `npm test` 게이트가 대신 판단하지 않는다.
