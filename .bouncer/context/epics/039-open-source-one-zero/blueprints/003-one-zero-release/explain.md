---
type: bouncer.explain
title: 003 explain
description: Explain for 003
resource: .bouncer/context/epics/039-open-source-one-zero/blueprints/003-one-zero-release/explain.md
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
      quiz_score: '3/3'
      disposition: 릴리스 문서와 태그 후 운영 경계를 이해함
      recorded_at: '2026-08-15T20:26:46+09:00'
---
# Explain

## Background
배포 매니페스트와 npm 메타데이터가 이전 버전을 가리키면 설치 호스트마다 서로
다른 릴리스를 보게 된다. 이 blueprint는 모든 공개 버전을 `1.0.0`으로 맞추고,
그 정합성을 테스트로 고정했다. 출시 문서는 태그 전에는 준비 상태와 미검증 상태만
말하고, 태그 이후의 smoke 증거는 태그에 연결된 GitHub Release에 남기도록 분리했다.

## Intuition
같은 봉인을 붙인 상자를 먼저 검사한 뒤, 봉인을 찍고 그 봉인 번호로 배송 기록을
남기는 흐름이다.

## Code
- `package.json`, `package-lock.json`, 각 호스트 매니페스트: 공개 버전 `1.0.0`의
  단일 기준이다.
- `test/cursor-plugin.test.js`, `test/distribution.test.js`: 패키지·lockfile·호스트
  매니페스트·marketplace의 version drift를 거부한다.
- `CHANGELOG.md`, `README.md`, `docs/README.md`, `docs/compatibility.md`:
  태그 전 1.0.0 출시 준비 상태와 미검증 설치 현황을 설명한다.
- `docs/install.md`, `docs/PILOT.md`: 최종 HEAD CI, 태그와 push, 태그 기준 3×4
  smoke, 동일 태그 GitHub Release 기록의 운영 순서를 안내한다.

## Quiz
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
