---
type: bouncer.epic
title: 검증 정책과 활성 포인터 안전성
description: Unifies verification policy and isolates active blueprint state across linked worktrees.
resource: .bouncer/context/epics/064-runtime-policy-pointer-safety/index.md
tags:
  - bouncer
  - epic
  - verification
  - config
  - worktree
  - pointer
timestamp: '2026-09-05T21:02:51.368+09:00'
bouncer:
  id: '064'
  epic_id: '064'
  status: approved
  supersedes: []
---
# 검증 정책과 활성 포인터 안전성

## Intent

- 문제: 검증 정책을 읽는 단계마다 allowlist와 config 오류 처리가 다르고, linked worktree는 활성 포인터 한 슬롯을 공유해 서로 다른 실행 주기가 충돌한다.
- 목표: plan과 execute가 같은 검증 정책을 적용하고, 활성 포인터를 epic·blueprint별로 분리해 여러 실행 주기를 안전하게 운용한다.

## Success criteria

1. 프로젝트 `verify_allowlist`가 허용한 명령은 plan·execute에서 모두 통과하고, 목록 밖 명령은 두 단계에서 모두 거절된다.
2. 셸 연산자와 미종료 인용은 allowlist와 무관하게 plan·execute에서 프로세스 시작 전에 거절된다.
3. config 부재는 기본 allowlist로 진행하고, 깨진 JSON과 읽기 오류는 plan·execute를 중단한다.
4. `seed-worktree`는 대상 worktree에 config가 없을 때만 `.bouncer/config.json`을 복사하고, 기존 파일을 덮어쓰거나 base 파일을 이동하지 않는다.
5. 서로 다른 blueprint의 활성 포인터가 epic·blueprint 키로 분리되고, execute worktree에서는 cwd에 대응하는 포인터만 해석된다.
6. base에서 활성 포인터가 여러 개면 후보를 출력하고 중단하며, 레거시 포인터와 새 포인터가 충돌해도 한쪽을 임의로 선택하지 않는다.
7. 기존 단일 포인터는 계속 읽을 수 있고 첫 `current --set`에서 키 형식으로 이관된다.
8. 각 blueprint의 회귀 테스트와 저장소 전체 `npm run ci`가 통과한다.

## Out of scope

- Windows·macOS CI job 추가와 지원 플랫폼 확대
- 설치 후 launcher 발견 경로와 호스트 환경 변수 계약 변경
- verify 원장 경로와 기록 형식 재설계
- `.bouncer/Distill.md`의 worktree 복사
- 허용된 프로젝트 명령의 샌드박싱

## Blueprints

* [검증 정책 일관성](blueprints/001-verify-policy-consistency/index.md) - config allowlist와 오류 판정을 plan·execute에서 공유하고, worktree에 config를 보존 복사한다.

P2의 포인터 충돌 차단과 namespace 전환은 P1 완료 뒤 별도 blueprint로 계획한다.
