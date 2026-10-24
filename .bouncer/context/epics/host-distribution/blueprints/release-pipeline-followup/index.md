---
type: bouncer.blueprint
title: 릴리스 게시와 독립 설치 계약의 잔여 결함 해소
description: Release publication and isolated installation satisfy the existing contract with reproducible regression evidence.
resource: .bouncer/context/epics/host-distribution/blueprints/release-pipeline-followup/index.md
tags:
  - bouncer
  - blueprint
  - release
  - distribution
  - regression
timestamp: '2026-10-24T13:55:51.656+09:00'
bouncer:
  id: release-pipeline-followup
  epic_id: host-distribution
  blueprint_id: release-pipeline-followup
  status: closed
  order: 16
  commit_type: fix
  scale: full
  review_scope: blueprint
  verification_policy: scoped_terminal
  review_contract: brief
  attribution: 릴리스 게시와 독립 설치 계약의 미해결 리뷰 12건을 수정하고 회귀 증거를 보완함
  prerequisites:
    - blueprint: .bouncer/context/epics/host-distribution/blueprints/release-pipeline
      merged_commit: 8f9193456513a2cb99498cea792ff25f92175aec
  supersedes: []
---
# 릴리스 게시와 독립 설치 계약의 잔여 결함 해소

Epic: [host-distribution](../../index.md)

## Intent
- 릴리스 게시와 독립 설치에 남은 계약 위반을 수정해 잘못된 산출물의 게시를 차단함.
- 새 회귀 실행으로 오류 경계와 설치 결과를 검증하고 운영 문서의 누락을 보완함.

## Contract
- 기존 release-pipeline의 계약과 로컬 인계 NEXT_PLAN.md의 미해결 12건을 대상으로 한다. 인계 메모는 커밋하지 않는다. 선행 PR #276의 병합 SHA가 현재 HEAD의 조상임을 확인했다. 원래 review 원장 부재를 완료 증적으로 대체하지 않는다.
- 서로 다른 태그도 같은 release 게시 자원에 대해 직렬 실행한다. 실행 중인 게시를 취소하지 않는다.
- 루트 package.json.version을 정본으로 기존 syncVersions check와 isStrictSemver를 재사용한다. 모든 버전 metadata의 drift와 태그 불일치를 외부 명령 전에 거부한다. strict SemVer의 prerelease와 +build metadata를 문자열 전체로 비교한다.
- 새 npm 게시를 허용하는 lookup 실패는 구조화 응답의 code=E404와 pkgid가 요청 package@version 전체 문자열과 일치하는 경우뿐이다. summary는 식별 근거로 사용하지 않는다. 기존 버전의 name/version/integrity 확인과 게시 후 재확인을 보존한다.
- clean snapshot에서 실제 builder로 plugin release tree를 만들고 그 결과를 설치 검증에 사용한다. runtime tgz의 local/global 설치 각각에서 plugin 없는 current, asset-only 자산 해석, 실제 Codex seed 산출물을 확인한다. snapshot은 현재 추적 파일의 미커밋 내용과 staged 추가 파일을 반영한다.
- launcher 없는 plugin 허용과 mismatch 차단, manual 게시 차단은 현재 이미 존재하는 동작이다. 새 테스트의 정상 실행과 의도적으로 계약을 깨뜨린 격리 복사본의 실패 실행을 구분해 기록한다. 과거 Red 증거를 소급 작성하지 않는다.
- 설치 문서는 trusted publisher의 저장소/workflow 식별, OIDC 권한, 공개 repository/package와 provenance 조건, dist 누락·stale build의 원인 및 Bash·PowerShell 복구를 설명한다.
- 데이터·상태: context schema, gate와 coordinator ledger를 바꾸지 않는다. scoped_terminal 검증 정책을 유지한다. 사용자 확인에 따라 task별 focused 검증과 terminal npm run ci를 frontmatter에 기록했다.

### 수용 기준
1. SPEC-001/002/003과 CT-003: 태그 간 직렬화, 루트 정본과 metadata drift 검사, 정확한 E404, strict SemVer 태그 회귀가 통과한다.
2. SPEC-004/005와 CT-007: builder 산출 plugin, local/global의 plugin 없는 current, 현재 작업 내용 marker와 실제 seed 파일을 관찰하는 설치 smoke가 통과한다.
3. CT-004/005: asset-only·mismatch·manual guard의 격리 negative control에서 지정한 단언이 실패하고 정상 구현에서 통과한 실행 증거가 있다.
4. CT-006: 인증·네트워크·손상 JSON·name/version/integrity 누락/불일치·confirmation·실제 Git fetch 실패에서 이후 외부 쓰기 차단을 검증한다.
5. SPEC-006/007: 운영자가 trusted publishing 준비와 개발 빌드 실패 복구를 문서의 구체적 절차로 판별한다.
6. task별 focused 검증과 모든 commit task를 기다리는 정확히 하나의 terminal 전체 CI가 통과한다. 실행 workflow만 검증 증적을 기록한다.

### 실패 모드·엣지 케이스
- 다른 pkgid 또는 pkgid 없는 E404는 summary가 요청 spec을 포함해도 거부한다. 1.2.3과 1.2.30을 구별한다.
- 무효 SemVer, 손상 metadata, 루트/host/lockfile drift, 태그 불일치는 npm/Git 호출 전에 실패한다.
- registry 조회·재확인 실패와 artifact 불일치는 이후 plugin Git 쓰기를 막는다. fetch 실패는 worktree 생성·commit·push를 막으며 정리 호출은 쓰기 게시로 세지 않는다.
- plugin 없는 current는 로컬·전역 설치를 각각 빈 HOME과 명시 환경으로 실행해 실제 호스트 캐시의 영향을 배제한다.
- snapshot 및 mutation 테스트는 임시 저장소·prefix·cache만 쓰며 사용자 설치와 원격 registry를 변경하지 않는다.

## Task DAG

| task | 책임 | depends_on | parallel_safe | dependency_gate | execution_kind |
| --- | --- | --- | --- | --- | --- |
| TASKS-001 | 게시 경계와 실패 회귀, manual negative control | [] | true | integrated | commit |
| TASKS-002 | builder 기반 설치 smoke와 산출물 단언 | [] | true | integrated | commit |
| TASKS-003 | asset-only와 mismatch negative control | [] | true | integrated | commit |
| TASKS-004 | 운영 조건과 빌드 복구 문서 | [TASKS-001, TASKS-002] | false | integrated | commit |
| TASKS-005 | 전체 CI fan-in | [TASKS-001, TASKS-002, TASKS-003, TASKS-004] | false | integrated | verification |

001~003은 변경 경로가 겹치지 않는다. 004는 001의 실제 게시 검사와 002의 설치 결과를 문서에 반영하므로 두 결과의 통합을 기다린다. 005는 모든 구현의 통합을 기다린다.

## 최소 범위 판단
- 기존 syncVersions/isStrictSemver와 buildReleaseTree를 재사용한다. 새 dependency·source 파일·일반화된 실행 계층은 만들지 않는다.
- smoke의 root 인자와 실제 산출물 반환만 추가해 격리 fixture를 검사한다. runtime 공개 옵션은 늘리지 않는다. 기존 테스트 파일에 회귀와 negative control을 추가한다.

## 조사 근거
- 현재 HEAD: 27bfbef5f48f1e715fb6bff60bcd13b14883ee67. source graph는 구성 경로 부재로 조회하지 않았고 test graph는 미설정이다. rg 후보와 실제 코드·테스트를 사용한다.
- releaseRuntime, assertRegistryArtifact, smoke, syncVersions intent는 launcher root 해석 실패로 provenance를 확보하지 못했다. buildReleaseTree intent의 related Explain은 pack 목록 정본을 유지한 배경에만 참고했다. 현재 구현을 동작 정본으로 삼는다.

## Out of scope
- 실제 npm publish, trusted publisher 연결, npm scope/package 생성, Git tag/push, PR 및 GitHub Release 생성.
- 기존 drive의 repair 제한 재설정, partial-close, 선행 상태·승인·검증·review 원장의 소급 변경.
- runtime 구조·공개 CLI 기능·Graphify 설정·context schema·gate 변경, dist 추적과 버전 bump.
- 로컬 제안서·요구사항·인계 메모 커밋과 원래 worktree 산출물 복사.

## One-commit justification
- 같은 버전의 runtime과 plugin 배포 계약을 보완하는 한 PR이다. 게시 경계, 설치 smoke, resolver 회귀 증거, 문서를 네 리뷰 가능한 commit으로 나누고 전체 CI는 source commit 없는 terminal node에서 실행한다.
