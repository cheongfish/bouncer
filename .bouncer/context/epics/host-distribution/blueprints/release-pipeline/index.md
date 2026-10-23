---
type: bouncer.blueprint
title: 런타임 선행 게시와 플러그인 릴리스 경로 완성
description: Runtime publication precedes the matching plugin release with version checks and resumable integrity verification.
resource: .bouncer/context/epics/host-distribution/blueprints/release-pipeline/index.md
tags:
  - bouncer
  - blueprint
  - npm
  - release
  - distribution
timestamp: '2026-10-23T21:09:02.657+09:00'
bouncer:
  id: release-pipeline
  epic_id: host-distribution
  blueprint_id: release-pipeline
  status: approved
  order: 15
  commit_type: chore
  scale: full
  review_scope: blueprint
  verification_policy: scoped_terminal
  review_contract: brief
  attribution: npm 런타임과 플러그인의 분리 배포 및 릴리스 게시 순서와 설치 계약 완성
  prerequisites:
    - blueprint: .bouncer/context/epics/host-distribution/blueprints/runtime-packaging
      merged_commit: c55c21bbd3f864658bad9ef4e7018f0644b9be7d
  supersedes: []
---
# 런타임 선행 게시와 플러그인 릴리스 경로 완성

Epic: [host-distribution](../../index.md)

## Intent
- npm 런타임과 플러그인의 배포 경계를 완성하고 같은 버전의 런타임 게시가 확인된 뒤 플러그인을 게시하도록 함.
- 수동 실행과 게시 재실행의 계약을 고정하고 독립 설치 및 개발·복구 절차를 문서화함.

## Contract
- 요구사항 근거는 로컬 `REQUIREMENTS_NPM_RUNTIME_SPLIT.md`의 FR-3~6, §6 3~5단계와 §8이다. 문서 자체는 커밋하지 않는다. 사용자 결정: B 잔여 작업 포함, 루트 version 정본, trusted publishing 전용, 동일 version·integrity 재실행 허용.
- 선행 B의 병합은 위 prerequisite SHA와 `git log`로 확인했다. B 본문의 중단 상태를 완료로 고쳐 쓰지 않고 실제 checkout에서 남은 resolver·pack 결합을 이 계획으로 마감한다.
- plugin pack은 manifest·agents·hooks·skills·rules·references·AGENTS를 포함하고 runtime 경로를 포함하지 않는다. runtime pack은 bin·dist·vendor/license·resources·package metadata·README/LICENSE만 포함한다. 각 pack 결과가 파일 목록 정본이며 builder에 별도 필터 정본을 만들지 않는다.
- 자산 루트는 명시 `BOUNCER_HOME` → 지원 호스트 후보 순이다. runtime 상대 경로 추측과 launcher 필수 조건을 제거한다. 선택한 plugin version과 runtime package version은 문자열 전체가 일치해야 한다. 최신 후보가 불일치하면 과거 후보로 우회하지 않는다. 자산을 읽지 않는 명령은 plugin 없이 동작한다.
- 버전 정본은 루트 `package.json.version`이다. CLI package, lock top-level·root·workspace, 네 plugin manifest와 Claude marketplace entry를 동기화·검사한다. version이 없는 `.agents/plugins/marketplace.json`에는 필드를 추가하지 않는다. 실제 버전 bump는 이번 작업에 포함하지 않는다.
- `workflow_dispatch`는 빌드·CI·두 pack dry-run·release tree 생성 확인만 수행한다. 실제 npm publish와 release branch push는 `push` 이벤트의 정확한 `bouncer--v<version>` 태그에서만 수행한다. 태그와 버전 정본의 일치를 외부 변경 전에 검사한다.
- 태그 실행은 한 번 만든 runtime tgz의 version·SHA-512 integrity를 사용한다. npm version 조회에서 해당 버전만 없는 경우 새로 publish한다. 기존 버전이 정확히 일치하면 publish를 건너뛰고 plugin 게시로 진행한다. publish 뒤에도 registry version·integrity를 재확인한다. 재빌드한 다른 tgz로 바꿔 게시하지 않는다.
- npm 인증은 GitHub-hosted runner의 OIDC만 사용한다. npm CLI >=11.5.1과 Node >=24를 확인하며 publish job에 `id-token: write`를 부여한다. package repository metadata는 실제 저장소와 일치한다. npm publisher 설정은 운영자의 별도 작업이다. provenance는 공개 repository·공개 package의 OIDC 게시 조건을 문서화하고 미실행 상태를 성공으로 기록하지 않는다.
- plugin branch는 확인된 npm 결과 뒤에만 갱신한다. 이전 release를 부모로 삼아 비강제 push하며, 산출 tree가 같으면 새 commit/push 없이 성공한다. release가 없는 경우만 orphan 생성한다. 원격 조회·인증 오류를 브랜치 없음으로 삼지 않는다. 동시 태그 게시는 직렬화하며 실패한 push는 npm을 다시 덮어쓰지 않고 다음 재실행으로 복구한다.
- 수용 기준:
  1. asset-only plugin의 resolver·agent seed·print·coordinator 카드가 동작하고 mismatch가 식별 가능한 실패로 노출된다. 순수 명령과 commit/SessionStart 기존 계약은 유지된다.
  2. clean snapshot의 실제 두 pack에서 필수 파일 누락과 상호 금지 파일이 없고, tgz의 임시 local/global 설치와 asset-only plugin 조합이 성공한다.
  3. 모든 버전 필드의 drift가 검사 실패가 되며 동기화는 다른 metadata·dependency를 바꾸지 않는다.
  4. manual·잘못된 tag·registry 오류·integrity 불일치·publish 실패에서는 plugin 게시가 실행되지 않는다. 동일 npm 산출물 재실행은 plugin 게시를 재개한다.
  5. 설치 문서는 npm 우선 설치, local/global 경로, BOUNCER_BIN/HOME, Bash·PowerShell 개발·복구, trusted publisher 외부 준비와 재실행을 설명한다.
  6. task별 focused 검증과 정확히 하나의 terminal 전체 CI가 통과한다. 실행 증적은 실행 workflow가 기록한다.
- 실패 모드·엣지 케이스:
  - 무효 명시 루트·필수 자산 누락은 성공 루트로 폴백하지 않는다. 버전 불일치는 두 버전과 일치 버전 설치·명시 루트 복구 방법을 알린다. seed의 루트 부재 no-op과 mismatch 실패를 구분한다.
  - registry E404만 새 게시 분기로 처리한다. 인증·네트워크·손상 응답·누락 integrity·서로 다른 version/name은 중단한다. npm 버전은 덮어쓰지 않는다.
  - plugin push만 실패한 재실행은 npm 동일성 검사부터 재개한다. 같은 version이지만 tgz integrity가 달라졌으면 중단한다.
  - dist 누락·stale build·bin-links=false·PATH 부재는 설치 문서에 원인과 복구를 제시한다. smoke는 사용자 전역 설치와 호스트 캐시를 수정하지 않는다.
  - 외부 npm scope/package/trusted publisher 준비가 없으면 실제 게시는 운영 준비 미완료다. 이번 검증은 fake registry/argv와 임시 설치로 계약을 확인한다.
- 사용자 확인에 따라 구현 task별 focused 명령과 terminal `npm run ci`를 task frontmatter에 기록했다.

## Task DAG

| task | 내용 | depends_on | parallel_safe | dependency_gate | execution_kind |
| --- | --- | --- | --- | --- | --- |
| TASKS-001 | asset-only resolver와 mismatch 전파 | [] | false | integrated | commit |
| TASKS-002 | 두 pack 경계와 독립 설치 smoke | [TASKS-001] | false | integrated | commit |
| TASKS-003 | 루트 정본 버전 동기화와 검사 | [TASKS-002] | false | integrated | commit |
| TASKS-004 | trusted 게시와 dry-run·재실행 | [TASKS-003] | false | integrated | commit |
| TASKS-005 | 설치·개발·운영 문서 | [TASKS-001, TASKS-004] | false | integrated | commit |
| TASKS-006 | 전체 CI | [TASKS-001, TASKS-002, TASKS-003, TASKS-004, TASKS-005] | false | integrated | verification |

001이 asset-only 허용을 먼저 제공하고 002가 실제 설치로 검증한다. 002~004는 package metadata와 배포 테스트를 공유하므로 직렬이다. 005는 001의 resolver와 004의 실제 게시 인터페이스를 설명하므로 그 결과를 기다린다. terminal task는 다섯 구현 task를 모두 기다린다.

## 설계 선택
- 기존 builder와 root pack 정본을 유지한다. 신규 파일은 반복 사용할 pack 검사, 버전 check/write, 외부 게시 orchestration 세 저장소용 script와 각각의 회귀 테스트로 한정한다. npm 공개 CLI 명령을 늘리거나 새 dependency·설정 계층을 만들지 않는다.
- source graph는 구성 경로 scripts/src가 없어 sync가 skip-no-dirs였다. test graph는 skip-unconfigured였다. 현재 파일·테스트를 rg로 조사했고 graph 후보로 실행 범위를 정하지 않는다.
- intent는 buildReleaseTree의 pack 정본 유지와 public-cli-boundary의 공개 CLI/오류 경계를 참고했다. runBouncerRoot는 unlinked였다. possibly-superseded 항목은 Explain body가 비어 있어 이전 제약을 가져오지 않았으며 현재 코드와 사용자 결정을 기준으로 작성했다.
- plan inspect의 routing은 tasks/dependencies에 근거한 full-candidate이며 사용자 full 선언과 일치한다. affected_paths는 사용자가 확인한 task별 경로를 기록했다.

## Out of scope
- 실제 npm publish, scope/package 생성, trusted publisher 연결, token 설정, Git tag/push, GitHub Release, 첫 stable 공개와 전체 호스트·OS smoke.
- 런타임 도메인 리팩터링, gate·context schema·원장 상태 변경, hook timeout과 Windows 셸 하드닝.
- 선행 blueprint 상태·검증 증적 소급 변경, Graphify 설정 수정, 로컬 요구사항과 인계 메모 커밋.

## One-commit justification
- 같은 버전의 두 배포물을 안전한 순서로 게시하는 한 PR 단위다. resolver, pack, version, publisher, docs를 다섯 리뷰 가능한 commit으로 나누고 전체 검증은 source commit 없는 terminal node가 담당한다.
