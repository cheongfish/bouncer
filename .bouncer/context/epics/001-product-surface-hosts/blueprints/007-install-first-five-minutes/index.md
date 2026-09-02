---
type: bouncer.blueprint
title: 설치 첫 5분 부작용 제거
description: init이 사용자 저장소에 남기는 venv·브랜치 기본값·Codex 파일·부트스트랩 커밋 범위를 고친다
resource: .bouncer/context/epics/001-product-surface-hosts/blueprints/007-install-first-five-minutes/index.md
tags:
  - bouncer
  - blueprint
timestamp: '2026-08-28T15:37:30.626+09:00'
bouncer:
  id: '007'
  epic_id: '001'
  blueprint_id: '007'
  status: closed
  commit_type: fix
  scale: full
  supersedes: []
---
# 007 설치 첫 5분 부작용 제거

Epic: [001](../../index.md)

## Intent
- 문제: `bouncer init`이 사용자 저장소 안에 파이썬 venv를 만들고, README가 그것을 커밋하게 하고, 브랜치 기본값이 사내 관습인 `develop`으로 굳어 있고, 쓰지도 않는 호스트의 `.codex/`가 생긴다. 파일럿 참가자가 가장 먼저 만나는 네 가지다.
- 완료 조건: 빈 저장소 재현 절차(`git init -b main` → `init` → Quickstart)에서 네 부작용이 모두 0건이고, `init` 멱등성과 이미 설치된 소비자 저장소의 동작이 유지된다.

## Contract
- 인터페이스
  - `init`이 `base_branch`와 `pr.base`를 저장소에서 탐지한다. 탐지 순서는 `git symbolic-ref refs/remotes/origin/HEAD` → 현재 체크아웃 브랜치. 둘 다 실패하면 결과에 미해결 신호를 실어 `/bouncer-init`이 사용자에게 묻게 한다.
  - graphify venv 경로가 저장소 작업 트리 밖으로 나간다. venv 실행 파일·pip 후보 경로와 `SUGGESTED_IGNORES`가 같은 결정을 따른다.
  - `.codex/agents/*.toml` 생성이 호스트 신호에 조건화된다. 신호는 기존 `.codex/` 디렉터리 존재 또는 명시적 opt-in 플래그다.
  - 부트스트랩 커밋 안내가 `.bouncer` 전체가 아니라 명시적 경로 목록을 스테이징한다.
- 거부
  - 탐지 실패 시 `develop`이나 `main`을 추측해 쓰지 않는다 — 값을 비우고 묻는다.
  - 이미 `base_branch`가 있는 소비자 `config.json`을 덮어쓰지 않는다.
  - 이미 있는 `.codex/agents/*.toml`을 지우거나 옮기지 않는다. `# bouncer-generated` 표시가 없는 파일은 계속 사용자 소유다.
  - graphify 설치 실패가 `init`을 실패시키지 않는다(soft-fail 유지). 다만 실패 시 작업 트리에 잔해를 남기지 않는다.
- 데이터·상태: `config.json`의 `base_branch`·`pr.base` 기본값, `config.graphify.bin`이 가리키는 경로, venv 위치 상수, `init` 반환 JSON의 `created[]`와 브랜치 미해결 신호.
- 수용 기준: epic 성공조건 1·2·3·4. 넷 다 빈 저장소 재현 절차로 판정한다.
- 검증 명령: `npm run ci`
- 실패 모드·엣지 케이스
  - 원격이 없는 저장소, `origin/HEAD`가 설정되지 않은 저장소, detached HEAD → 탐지 실패 경로로 떨어져 묻는다.
  - 이미 `.bouncer/.venv/`를 가진 저장소 → 기존 venv를 계속 찾아 쓰고 강제 이전하지 않는다.
  - Windows(`Scripts/graphify.exe`, `Scripts/pip.exe`) 경로가 같은 결정을 따른다.
  - 네트워크가 없는 환경에서 venv 생성이 중간에 실패 → 잔해 정리 후 `enabled: false`로 내려간다.
  - git 저장소가 아닌 디렉터리에 `init`을 돌린다(현재 테스트 픽스처가 그렇다) → common directory가 없으므로 기존 `.bouncer/.venv` 위치로 폴백한다.
  - `.codex/`를 이미 가진 저장소 → 기존 seeding 동작이 유지된다.

## Out of scope
- graphify 알고리즘, `graph-sync`, Distill 라우팅.
- `CLAUDE.md`·`rules/`·워크플로 스킬의 절차 변경 — blueprint 002 소관이다. 이 blueprint가 `skills/bouncer-init/SKILL.md`를 만지는 것은 init 결과 보고, 브랜치 미해결 ACQ, 커밋 안내 문구에 한정된다.
- 게이트 코드 추가·삭제와 `bouncer validate` 판정 로직.
- 사용자 문서 전체의 영어 번역(B14 밖 공개 준비도 항목).

## One-commit justification
네 부작용이 모두 `init` 실행 경로 하나에서 나오고 같은 재현 절차로 판정된다. 리뷰어가 한 번에 볼 단위는 "설치가 사용자 저장소를 어지럽히지 않는다" 하나이고, 넷 중 하나만 고치면 재현 절차가 여전히 더럽다. task는 넷으로 나누어 각각 한 커밋으로 닫는다. 순서는 001 → 002 → 003 → 004이고, 004의 조건부 안내 문구는 003이 만든 동작을 전제하므로 003보다 앞설 수 없다. 네 task가 `scripts/src/lib/init.ts`와 그 산출물을 공유하므로, 재정렬하거나 rebase하면 `npm run build`를 다시 돌려야 `check:emit`이 통과한다.

## Documents
* [Tasks 001](tasks/001/tasks.md) - 기본 브랜치 탐지
* [Tasks 002](tasks/002/tasks.md) - venv 위치와 실패 정리
* [Tasks 003](tasks/003/tasks.md) - Codex 파일 호스트 조건화
* [Tasks 004](tasks/004/tasks.md) - 부트스트랩 커밋 범위
* [Verification 001](tasks/001/verification.md) - 검증 명령과 증적
* [Review 001](tasks/001/review.md) - 리뷰 발견사항
* [Verification 002](tasks/002/verification.md) - 검증 명령과 증적
* [Review 002](tasks/002/review.md) - 리뷰 발견사항
* [Verification 003](tasks/003/verification.md) - 검증 명령과 증적
* [Review 003](tasks/003/review.md) - 리뷰 발견사항
* [Verification 004](tasks/004/verification.md) - 검증 명령과 증적
* [Review 004](tasks/004/review.md) - 리뷰 발견사항
* [Context review](context-review.md) - 계획 문서 정합성 판정
<!-- explain.md는 plan scaffold에 포함되지 않습니다. /bouncer-finalize가 작성합니다. -->
