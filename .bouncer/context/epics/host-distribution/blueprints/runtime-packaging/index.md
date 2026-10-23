---
type: bouncer.blueprint
title: npm 런타임 패키지와 플러그인 배포물 분리
description: The runtime npm package and plugin release tree build and run independently through the public CLI contract.
resource: .bouncer/context/epics/host-distribution/blueprints/runtime-packaging/index.md
tags:
  - bouncer
  - blueprint
  - npm
  - distribution
  - runtime
timestamp: '2026-10-23T17:19:31.496+09:00'
bouncer:
  id: runtime-packaging
  epic_id: host-distribution
  blueprint_id: runtime-packaging
  status: approved
  order: 14
  commit_type: refactor
  scale: full
  review_scope: blueprint
  verification_policy: scoped_terminal
  review_contract: brief
  attribution: npm 런타임과 플러그인 자산의 독립 배포를 위한 패키지 경계 및 release tree 분리
  prerequisites:
    - blueprint: .bouncer/context/epics/host-distribution/blueprints/public-cli-boundary
      merged_commit: d7e3729869a9bb7ee7b7b91742cfbff9d277d9a7
  supersedes: []
---
# npm 런타임 패키지와 플러그인 배포물 분리

Epic: [host-distribution](../../index.md)

## Intent
- 런타임을 npm 패키지로 분리해 플러그인이 공개 CLI와 검증된 자산 루트만으로 연결되도록 함.
- 두 배포물의 파일 목록과 독립 설치 실행을 검증해 빌드 산출물 누락과 내부 경로 의존을 방지함.

## Contract
- npm package는 `@cheongfish/bouncer`, version `1.6.0`, Node `>=24`이며 public bin은 `bouncer`, `bouncer-root`다. root package는 private 개발 오케스트레이션과 plugin release files를 소유한다.
- runtime 소유는 `packages/cli/{src,dist,bin,vendor,resources}`와 package metadata·README/LICENSE다. src와 build config는 개발 입력이며 tarball은 bin/dist/vendor/resources/package metadata/README/LICENSE만 포함한다.
- bin은 자기 dist를 실행한다. prepack이 package build를 수행한다. 개발 checkout source/stamp가 다르면 실행을 거부하며 tarball은 소비 저장소 source를 탐색·빌드하지 않는다.
- plugin root는 `BOUNCER_HOME` → 지원 호스트 설치 후보 순이다. runtime tree를 plugin root로 추측하지 않는다. 필수 plugin manifest/assets를 검증하고 선택한 plugin과 runtime 버전이 다르면 실행을 거부한다. 후보 선택·정렬은 기존 최신 strict-semver 정책을 유지한다.
- 자산을 읽지 않는 저장소·게이트 명령은 plugin 없이 동작한다. 자산을 읽는 Codex seed·print·coordinator card는 version mismatch를 명확한 실패로 다룬다. cwd 쓰기 경계와 hook의 공개 CLI 계약은 유지한다.
- plugin release tree는 root `npm pack --dry-run --json` 목록으로 만든다. plugin pack은 runtime 파일을, runtime pack은 plugin assets·host manifests를 포함하지 않는다. builder가 별도 파일 목록 정본을 만들지 않는다.
- 수용 기준:
  1. 선행 작업의 SessionStart lint 두 오류가 사라지고 기존 경고/exit 계약이 보존된다.
  2. 새 배치에서 build/typecheck/check:emit/기존 지연 적재·dependency boundary·coverage 기준이 유지된다.
  3. asset-only plugin이 유효하고 version mismatch·무효 명시 루트는 명확히 실패한다. 순수 명령은 plugin 부재에 영향받지 않는다.
  4. 두 실제 pack 목록에서 필수 파일이 모두 있고 상호 금지 파일이 0개다. clean snapshot pack이 생성한 runtime tgz의 local/global 설치와 plugin-only tree 조합이 동작한다.
  5. commit task별 focused 검증과 종단 `npm run ci`가 통과한다. 증적은 실행 단계가 기록한다.
- 검증 명령은 사용자 확인에 따라 구현 task별 focused 명령과 정확히 하나의 terminal `npm run ci`로 설정한다.
- 데이터·상태: context 문서/원장/게이트 저장 형식을 바꾸지 않는다. runtime/plugin 배포 파일의 소유권과 실행 경로만 바뀐다.
- 실패 모드·엣지 케이스:
  - dist 부재·stale 개발 빌드: 자동 설치/빌드 없이 경로와 복구 명령을 stderr에 안내한다.
  - plugin manifest/필수 assets 누락·무효 BOUNCER_HOME: 다른 후보로 조용히 우회하지 않는다.
  - 선택된 최신 plugin과 runtime 버전 불일치: 일치하는 과거 plugin으로 폴백하지 않고 두 버전과 복구 방법을 알린다.
  - runtime이 없는 commit 검사: 기존 fail-closed. 일반 명령은 fast path로 통과하고 SessionStart는 경고 후 exit 0이다.
  - local bin이 호스트 PATH에 없음: 명시 BOUNCER_BIN을 사용한다. Windows .cmd와 Unix bin을 구분하고 bin-links=false의 복구 안내를 검증한다.
  - clean snapshot smoke는 현재 구현 diff를 포함해 예전 HEAD나 개발 생성물을 잘못 시험하지 않는다. 임시 prefix/cache 외의 사용자 설치를 변경하지 않는다.

## Task DAG
| task | 내용 | depends_on | parallel_safe | dependency_gate | execution_kind |
| --- | --- | --- | --- | --- | --- |
| TASKS-001 | SessionStart lint 복구 | [] | false | integrated | commit |
| TASKS-002 | runtime 배치와 개발 도구·테스트 경로 이전 | [TASKS-001] | false | integrated | commit |
| TASKS-003 | asset-only resolver와 version 검사 | [TASKS-002] | false | integrated | commit |
| TASKS-004 | 두 배포물 pack과 독립 설치 smoke | [TASKS-003] | false | integrated | commit |
| TASKS-005 | 전체 CI | [TASKS-001, TASKS-002, TASKS-003, TASKS-004] | false | integrated | verification |

공유 package metadata와 fixture, 테스트 경로 때문에 002~004는 직렬이다. 001은 사용자가 선택한 선행 복구이며, terminal은 모든 commit task의 통합을 기다린다.

## 현재 실행 상태
- TASKS-001과 TASKS-002는 integration worktree에 통합됐다.
- TASKS-003은 runtime launcher의 build guidance를 고쳐야 하지만, 최초 task brief의 `Do not touch` 제약과 수정된 affected paths가 일치하지 않아 중단됐다.
- scope revision `r1`은 `packages/cli/bin/bouncer`와 `packages/cli/bin/bouncer-root`를 affected paths에 추가했다. 다만 task brief의 `Do not touch` 목록을 같은 revision으로 갱신하는 실행 경로가 없어 새 worker attempt도 blocked 상태가 됐다.
- TASKS-003의 제약 목록과 affected paths를 원자적으로 갱신할 수 있는 실행 지원이 마련되기 전에는 후속 task 또는 terminal 검증을 실행하지 않는다.

## Out of scope
- release workflow의 tag/manual 분기, publish 후 plugin push 순서, 전체 manifest 버전 정본·동기화 검사, 운영 설치 문서 전면 개편은 다음 blueprint에서 다룬다.
- 실제 npm publish, npm 조직·token/trusted publishing 설정, Git tag/push와 첫 stable 배포.
- 네 호스트와 세 OS 전체 배포 검증 결과를 이번 로컬 smoke로 대신하지 않는다.
- 런타임 도메인 리팩터링, CLI 기능 의미·게이트·문서 스키마 변경, hook timeout·Windows ComSpec 하드닝.
- 선행 blueprint 상태를 소급 변경하거나 기존 승인·검증 증적을 작성하지 않는다. 요구사항과 인계 메모는 근거로만 읽고 커밋하지 않는다.

## One-commit justification
- 이 blueprint는 독립 설치 가능한 두 배포물을 만드는 한 PR 단위다. 배치·resolver·배포 목록 중 일부만 완료하면 tarball이나 plugin-only tree가 실행되지 않는다. 리뷰 가능한 변경 의도는 네 commit task로 나누며, 전체 검증은 source commit이 없는 terminal task로 분리한다.
