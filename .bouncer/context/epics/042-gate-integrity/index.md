---
type: bouncer.epic
title: 042 게이트 보증 복구
description: G13·G17 두 게이트를 코드로 강제하고 보증 문구를 실제 동작에 맞춘다
resource: .bouncer/context/epics/042-gate-integrity/index.md
tags:
  - bouncer
  - epic
timestamp: '2026-08-21T15:07:14.606+09:00'
bouncer:
  id: '042'
  epic_id: '042'
  status: approved
---
# 042 게이트 보증 복구

## Intent
- 문제: README가 가장 크게 내세우는 두 보증이 코드로 강제되지 않는다. `git commit -am`은 커밋 시점에 스테이징하므로 PreToolUse 훅이 빈 인덱스를 보고 범위 밖 파일을 통과시키고, G13은 에이전트가 Write 툴로 그대로 만들 수 있는 마크다운 프론트매터만 읽는다.
- 목표: 두 게이트를 하네스가 실제로 강제하게 만들고, 강제되지 않는 범위는 README와 위협 모델 문서에서 걷어낸다.

## Success criteria
1. `test/commit-hook.test.js`에 `git commit -am x` 회귀 테스트가 있고, 스테이징이 비어 있고 추적 중 수정 파일이 범위 밖일 때 `evaluateCommit`이 `block: true`를 반환한다. 주입하는 `deps`는 `readCurrent` · `readAffectedPaths` · `stagedFiles` · `trackedModified` 넷 모두다 — 포인터를 주입하지 않으면 `evaluateCommit`이 활성 blueprint 없음으로 먼저 빠져나가 조건이 참이 되지 않는다.
2. 저장소 밖 참고 자료인 `repro-g17.sh`의 B 단계가 `BLOCKED`로 바뀐다. 이 스크립트는 저장소에 들어오지 않으므로 판정 근거는 조건 1의 회귀 테스트이고, 재현은 보조 확인이다.
3. 원장 없이 `verification.md` 프론트매터만 손으로 채운 입력이 execute·commit 두 게이트 모두에서 G13으로 실패한다. 이 저장소가 자기 자신의 플러그인 루트라 이번 blueprint의 execute 게이트는 병합 전까지 옛 빌드를 돌린다 — 판정은 `test/validate-gates.test.js`가 한다.
4. 게이트가 실행한 `npm run verify:strict`가 exit 0으로 끝난다.
5. README가 PreToolUse 가드(스테이징 ∪ `-a` 계열의 추적 중 수정 파일)와 commit 게이트 G17(스테이징만)을 구분해 적고, `docs/security.md` 탐지 표에 `git commit -am x` 행과 `git diff HEAD` 실패 시 차단, pathspec 오탐이 함께 적힌다.

## Out of scope
- `.bouncer/` 4.1MB·513파일을 배포물에서 분리하는 작업. 마켓플레이스 `source`가 저장소 자체라 분리 자체가 별도 결정이다.
- 버전을 0.x로 되돌리기. 1.0.0으로 이미 배포된 소비자 업데이트 경로가 깨진다.
- 컨텍스트 세금 손익분기 측정.
- SKILL.md 산문을 정규식으로 grep하는 테스트를 행동 테스트로 대체하기.
- `-a` 자체를 거부하는 엄격 모드와 그 설정 키.

## Blueprints
* [001 gate-integrity](blueprints/001-gate-integrity/index.md) - `git commit -a` 검사 집합 확장과 verify 증적 원장을 `scripts/src/lib`·`hooks`·`docs`에 적용한다
