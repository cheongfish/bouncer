---
type: bouncer.blueprint
title: 등록부 기반 도입
description: Add the epic registry file, profiles, init scaffolding, and the legacy epic guard
resource: .bouncer/context/epics/114-consumer-epic-registry/blueprints/001-registry-foundation/index.md
tags:
  - bouncer
  - blueprint
  - epic-registry
  - init
  - legacy
timestamp: '2026-10-20T11:27:39.085+09:00'
bouncer:
  id: '001'
  epic_id: '114'
  blueprint_id: '001'
  status: approved
  commit_type: feat
  scale: full
  review_scope: blueprint
  verification_policy: scoped_terminal
  supersedes: []
---
# 001 registry-foundation

Epic: [114](../../index.md)

## Intent
- 문제: 프로젝트가 어떤 epic을 쓰는지 정하는 정본이 없어, 계획마다 새 epic이 생기고 기존 epic과 공통 영역을 구분할 수 없다.
- 완료 조건: `bouncer init`이 `.bouncer/epics.json` 등록부와 공통 epic을 만들고, 기존 epic은 `legacy`로 등록되어 새 blueprint를 받지 않는다.

## Contract
- 인터페이스: `.bouncer/epics.json`(아래 형식), `bouncer init --profile <standard|domain-only> --domain-epic-limit <n>`. `bouncer scaffold blueprint`와 `bouncer plan approve`는 `legacy` epic 대상 요청을 거절한다.
- 데이터·상태:
  ```ts
  type EpicKind = 'common' | 'domain' | 'legacy';
  interface RegistryEpic { slug: string; id: string; kind: EpicKind; active: boolean;
    approval?: { reason: string; approvedAt: string } }
  interface EpicRegistry { version: 1; profile: string; domainEpicLimit: number;
    areas: string[]; areaPromotionThreshold?: number; epics: RegistryEpic[] }
  ```
  - 프로필은 이름표다. init이 구성을 등록부에 모두 펼쳐 쓰고, 검사는 등록부만 읽는다.
  - `standard`는 공통 epic 8개 활성, `domainEpicLimit: 0`이다. `domain-only`는 공통 epic 0개다.
  - 이 저장소는 `domain-only`, `domainEpicLimit: 8`, 기존 epic 전부 `legacy`인 등록부를 갖는다.
- 수용 기준: Epic Success criteria 1–4, 10이 참이다. 등록부가 없는 프로젝트의 기존 동작은 이 blueprint에서 바뀌지 않는다(차단은 BP003).
- 검증 명령: 종단 task `npm run ci`
- 실패 모드·엣지 케이스:
  - 등록부 JSON 파싱 실패, `version` 불일치, 필수 키 누락은 형식 위반으로 실패한다.
  - 공통 slug와 같은 기존 epic이 둘 이상이면 init이 등록부를 쓰지 않고 실패한다.
  - 공통 epic 디렉터리가 이미 있으면 그 ID를 재사용하고 파일을 다시 쓰지 않는다.
  - 등록부가 이미 있으면 init은 등록부를 다시 쓰지 않는다.
  - 공통 epic 0개 프로필도 유효하다.
  - 이 저장소에서는 epic 114도 `legacy`가 된다. BP002·003은 BP001 실행 전에 승인되므로 막히지 않는다(epic `## 승인 순서`).

## Out of scope
- plan gate의 등록부 검사와 등록부 없음 차단 (BP003)
- `plan inspect` 출력 변경과 스킬 기본 경로 전환 (BP002)
- 기존 테스트 fixture에 등록부를 추가하는 작업 (BP003)
- `legacy` epic의 물리적 이관

## One-commit justification
- 등록부 형식, 그것을 만드는 init, `legacy` 차단이 한 데이터 계약을 공유하므로 한 리뷰 단위다. task는 형식·init·차단으로 나눠 커밋한다.
