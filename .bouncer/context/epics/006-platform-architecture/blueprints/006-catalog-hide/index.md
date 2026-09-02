---
type: bouncer.blueprint
title: 카탈로그에서 보조 스킬 숨김
description: 11개 보조 스킬을 references/로 옮기고 호스 목록·호출 경로·테스트를 공개 스킬만 남기게 맞춘다
resource: .bouncer/context/epics/006-platform-architecture/blueprints/006-catalog-hide/index.md
tags:
  - bouncer
  - blueprint
timestamp: '2026-08-28T11:43:50.455+09:00'
bouncer:
  id: '006'
  epic_id: '006'
  blueprint_id: '006'
  status: closed
  commit_type: refactor
  scale: full
  supersedes: []

---
# 006 catalog-hide

Epic: [006](../../index.md)

## Intent
- 문제: 보조 스킬이 `skills/*/SKILL.md`라서 호스가 목록에 넣고 암묵 호출한다.
- 완료 조건: 공개 카탈로그는 워크플로 여섯 + `agentic-code-benchmark` + `migrate-ids`뿐이고, 11개 보조는 `references/<name>/index.md`를 워크플로가 읽는다.

```mermaid
flowchart LR
  W["/bouncer-*"] --> R["references/name/index.md"]
  H[호스 목록] --> S["skills/*/SKILL.md"]
  S -.-> W
```

## Contract
- 인터페이스: 호스가 관례로 스캔하는 스킬은 `skills/<dir>/SKILL.md`만이다. 보조 11개는 플러그인 루트 `references/<name>/index.md`로 옮기고 파일명을 `SKILL.md`로 두지 않는다. 기존 하위 `references/`·`assets/`·`LICENSE`는 같은 이름 디렉터리 아래로 따라간다. 진입 스킬과 `CLAUDE.md`는 그 경로를 Read 대상으로만 적는다.
- 데이터·상태: 카탈로그 정본 개수는 8 (`bouncer-init|plan|execute|commit|finalize|run`, `agentic-code-benchmark`, `migrate-ids`). description 100–180자·총합 3,000자 예산은 이 8개 `SKILL.md`에만 적용한다. 보조 본문의 YAML `name`은 유지한다. `docs/ARCHITECTURE.md` §4 일반 스킬 표의 이름 집합은 그대로 두고, 위치가 카탈로그가 아님을 본문에 적는다.
- 수용 기준: epic 성공 조건 1–5가 참이다.
- 검증 명령: `npm run ci`
- 실패 모드·엣지 케이스: Codex `.codex-plugin/plugin.json`의 `skills: ./skills/`가 `skills/`만 가리키므로 보조를 그 트리에 `SKILL.md`로 남기면 실패다. 진입 스킬 `references/`에 보조를 복제 흡수하지 않는다. 공유 본문은 플러그인 루트 `references/` 한곳이다. `skills/review/assets/reviewer-prompt.md` 이동 후 named agent 인용 경로가 깨지면 같은 커밋에서 고친다. `skills/stop-slop/LICENSE` 해시 핀은 새 경로로 옮긴다.

## Out of scope
- 보조 본문의 절차 문장 재작성
- `migrate-ids`·`agentic-code-benchmark` 비공개
- 과거 epic 문서 소급
- 게이트 번호·CLI

## One-commit justification
- 카탈로그에서 빼는 일과 호출·테스트·문서 경로가 한 계약이라 한 PR로 본다. 커밋은 task 두 개로 나눈다. 001은 이동과 CI, 002는 사람이 읽는 문서와 Distill 샤드 경로다.

## Documents
* [Tasks 001](tasks/001/tasks.md) - 트리 이동과 호출·테스트
* [Verification 001](tasks/001/verification.md) - 검증 명령과 증적
* [Review 001](tasks/001/review.md) - 리뷰 발견사항
* [Tasks 002](tasks/002/tasks.md) - 문서·Distill 경로
* [Verification 002](tasks/002/verification.md) - 검증 명령과 증적
* [Review 002](tasks/002/review.md) - 리뷰 발견사항
* [Context review](context-review.md) - 계획 문서 정합성 판정
