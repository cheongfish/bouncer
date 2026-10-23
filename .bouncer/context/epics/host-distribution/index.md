---
type: bouncer.epic
title: 호스트 배포와 공개 설치 계약
description: 'Plugin distribution surface: host manifests, init and install, release and public contract'
resource: .bouncer/context/epics/host-distribution/index.md
tags:
  - bouncer
  - epic
timestamp: '2026-10-20T16:05:56.169+09:00'
bouncer:
  id: host-distribution
  epic_id: host-distribution
  status: approved
  supersedes: []
---
# 호스트 배포와 공개 설치 계약

## Intent
- 문제: 기능 영역이 같은 작업이 legacy epic 63개에 흩어져 있고, 등록부 도입 뒤 이 저장소에는 새 blueprint를 만들 활성 epic이 없다.
- 목표: 이 epic이 `host-distribution` 영역의 새 blueprint를 받는다. 포함: 플러그인 배포 표면: 호스트(Claude·Codex·Cursor·Antigravity) 매니페스트와 launcher, `bouncer init`과 설치, 릴리스·공개 계약·보안 기준선, 빌드 산출물 배포

## Success criteria
1. `host-distribution` 영역에 속하는 새 계획은 이 epic 아래 blueprint로 만든다.
2. 아래 legacy epic은 `legacy`로 그대로 두고 조회·이력에만 쓴다. 승인·검증 해시와 trailer 연결을 바꾸지 않는다.
3. npm runtime과 plugin pack은 각각 소유 파일만 포함하고 실제 pack 결과에서 필수·금지 파일을 검사한다.
4. clean snapshot에서 build/pack과 임시 local/global runtime 설치가 성공하고 asset-only plugin의 훅·자산을 공개 CLI로 사용한다.
5. source는 추적하고 dist는 빌드로 생성하며 추적하지 않는다. 경로 이전 뒤 기존 strict TypeScript·coverage 임계값·지연 적재 계약을 유지한다.
6. 변경 계약은 기존 테스트와 새 회귀 사례로 고정하고 종단 `npm run ci`로 확인한다. 테스트 이름과 real-process integration 배정을 유지한다.
7. `.gitmessage`의 한국어 명사형 제목과 종결 문장 본문을 따르며 로컬 요구사항·인계 메모를 커밋하지 않는다.
8. 루트 package version을 정본으로 runtime·manifest·lockfile을 검사하며 태그 버전 불일치는 외부 게시 전에 거부한다.
9. 수동 release 실행은 외부 게시를 하지 않고, 태그 실행은 동일 npm version·integrity 확인 뒤 plugin branch를 게시한다.
10. npm 인증은 trusted publishing으로 구성하고 설치·복구·개발 안내에 Bash와 PowerShell 절차를 제공한다. 외부 설정과 실제 배포에는 별도 승인을 받는다.

## Out of scope
- 실제 npm 게시·trusted publisher 연결·원격 tag/push와 전체 호스트·OS 점진 배포는 별도 운영 승인 대상으로 둔다.
- 공개 CLI 경계와 hook 소비자 이전은 기존 public-cli-boundary의 병합 결과를 재사용한다. 새 패키지화 blueprint는 남은 lint 두 건만 복구하고 기존 계약을 보존한다.
- 워크플로 단계별 동작 변경 → 해당 단계 영역
- legacy epic의 물리적 이관. 이 epic은 논리적 병합만 한다.
- legacy epic에 남은 미완료 blueprint는 모두 closed로 간주하고 상태를 바꾸지 않았다.

## Legacy epic 귀속
Epic 기능 분류의 매핑이다. △는 일부 blueprint가 다른 영역에 귀속된다는 뜻이다.

- [product-surface-hosts](../product-surface-hosts/index.md) △
- [release-security](../release-security/index.md)
- [roadmap-closeout](../roadmap-closeout/index.md)

### 다른 epic에서 이 영역으로 귀속되는 blueprint
| legacy epic | blueprint | 이유 |
| --- | --- | --- |
| 061 | 004 | 배포 유지보수 |

## Blueprints
- [runtime-packaging](blueprints/runtime-packaging/index.md): npm runtime workspace와 plugin release tree를 분리하고 두 배포물의 설치 실행을 검증한다.
- [release-pipeline](blueprints/release-pipeline/index.md): 남은 resolver·pack 결합을 제거하고 버전 검사, npm 선행 게시, 수동 dry-run과 설치 문서를 완성한다.
