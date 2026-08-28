---
type: bouncer.epic
title: 감사 후속 조치
description: 외부 감사가 남긴 설치·지시문·경량 경로·부채 항목을 게이트 계약을 바꾸지 않고 닫는다
resource: .bouncer/context/epics/059-audit-followup/index.md
tags:
  - bouncer
  - epic
timestamp: '2026-08-28T15:37:26.904+09:00'
bouncer:
  id: '059'
  epic_id: '059'
  status: approved
  supersedes: []
---
# 059 감사 후속 조치

## Intent
- 문제: 외부 감사가 `bouncer-audit.md`에 14건을 남겼고, 설치 첫 5분의 부작용 네 건과 지시문 층의 중복은 재현까지 끝났는데 고쳐지지 않았다.
- 목표: B5(효과 입증)와 B12(두 번째 커미터)를 뺀 항목을 blueprint 넷으로 나눠 닫는다 — 001 설치 첫 5분, 002 지시문 층, 003 경량 경로 기본화, 004 부채 항목. 게이트 계약과 신뢰 경계는 그대로 둔다.

## Success criteria
1. `git init -b main` 저장소에서 `bouncer init` 뒤 README Quickstart를 그대로 따라 했을 때 스테이징되는 경로 중 `.bouncer/.venv/` 하위가 0건이다.
2. 같은 저장소에서 `init`이 쓴 `config.json`의 `base_branch`와 `pr.base`가 `main`이다. 탐지할 수 없는 저장소에서는 두 키가 `config.json`에 없고, `init` 반환 JSON에 미해결 신호가 실리며, `bouncer current --set`이 `develop`을 대신 쓰지 않는다.
3. Codex 신호가 없는 저장소의 `init` 결과 `created[]`에 `.codex/` 경로가 0건이고, 이미 `.codex/agents/*.toml`을 가진 저장소의 기존 동작은 그대로다.
4. graphify 설치가 실패한 뒤 사용자 저장소 작업 트리에 남는 venv 잔해가 0건이고, `init`이 기록하는 `graphify.enabled` 값이 같은 실행의 설치 시도 여부와 어긋나지 않는다.
5. `CLAUDE.md`에 네 지시문 층의 역할 경계가 표로 있고, `bouncer-audit.md` B14 표의 중복 항목이 마스터 룰에서 사라지며, 갱신된 앵커로 `test/master-rules.test.js`가 통과한다. 하드룰 11의 번호와 본문은 바뀌지 않는다.
6. `/bouncer-finalize`의 Distill 승격 제안이 마스터 룰·`rules/`·스킬이 이미 진술하는 후보를 제외한 목록으로 제시되고, 제외한 항목과 그 근거를 함께 보인다.
7. `/bouncer-plan`의 기본 진입이 `scale: light`이고 `full`은 사용자 선언으로 올라간다. G4·G5·G11·G12는 두 경로에서 같은 실패를 낸다.
8. B7·B8·B9·B10·B11 각각에 대해 고친 커밋이 있거나, 고치지 않는다는 결정과 근거가 `docs/` 안 한 파일에 남는다.
9. 각 task의 `npm run ci`가 통과한다.

## Out of scope
- B5 효과 입증 — epic 051·052의 DeepSWE 스트림이 담당한다. 벤치마크 프롬프트·루브릭·회차 기록을 건드리지 않는다.
- B12 두 번째 커미터 — 사람 배치 문제라 코드 변경으로 닫히지 않는다.
- 게이트 코드(G/S) 추가·삭제와 판정 로직 변경. 결번(B9)은 기록 결정이지 코드 변경이 아니다.
- 하드룰 11의 삭제·번호 재배열 — epic 054 성공조건 5가 `CLAUDE.md`를 정본으로 고정했고 12곳 이상이 번호로 인용한다.
- Distill 라우팅 알고리즘과 CLI 계약 — epic 058 Out of scope를 그대로 잇는다.
- 설치 캐시(`~/.claude/plugins/cache/**`)와 이미 닫힌 `.bouncer/context/**` 문서.

## Blueprints
<!-- 성공조건 5~8은 blueprint 002(지시문 층)·003(경량 경로)·004(부채 항목)가 가진다.
     각 blueprint는 별도 `/bouncer-plan` 회차에서 열고, 열릴 때 이 목록에 줄을 더한다. -->
* [001 설치 첫 5분 부작용 제거](blueprints/001-install-first-five-minutes/index.md) - `init`이 사용자 저장소에 남기는 venv·브랜치 기본값·`.codex/`·부트스트랩 커밋 범위를 고친다 (`scripts/src/lib/init.ts`, `scripts/src/lib/graphify.ts`, `scripts/src/lib/codex-agents.ts`, `README.md`)
