---
type: bouncer.blueprint
title: 벤치마크 스킬 반입
description: agentic-code-benchmark를 Bouncer 전문 스킬로 각색 반입하고 출처 고지와 계약 테스트를 붙인다
resource: .bouncer/context/epics/034-agentic-benchmark/blueprints/001-benchmark-skill/index.md
tags:
  - bouncer
  - blueprint
timestamp: '2026-08-13T13:18:25.076+09:00'
bouncer:
  id: '001'
  epic_id: '034'
  blueprint_id: '001'
  status: closed
  commit_type: feat
  scale: full
---
# 001 benchmark-skill

Epic: [034](../../index.md)

## Intent
- 문제: 벤치마크 도구를 처음부터 설계할 이유가 없다. `agentic-code-benchmark`는
  측정 스크립트와 앵커가 붙은 루브릭을 이미 갖췄고, 없는 것은 Bouncer 맥락과
  이 저장소의 스킬 계약뿐이다.
- 완료 조건: 스킬이 `skills/agentic-code-benchmark/`에 있고, 출처 고지와 계약
  테스트가 붙어 있으며, 문서가 이 스킬을 워크플로 밖 도구로 위치시키고
  `npm test`가 통과한다.

## Contract
- 인터페이스: 새 스킬 디렉터리 `skills/agentic-code-benchmark/` — `SKILL.md`,
  `references/rubric.md`, `references/task-suite.md`,
  `scripts/collect_metrics.py`, `scripts/scorecard.py`. 반입 스킬의 CLI 표면은
  그대로다:

  ```text
  collect_metrics.py --base <ref>                       # 유일한 필수 인자
                     [--head <ref|WORKTREE>] [--label <s>] [--task-id <s>]
                     [--test-cmd|--lint-cmd|--typecheck-cmd|--build-cmd <argv>]
                     [--coverage-before|--coverage-after <n>] [--out <path>]
  scorecard.py template [--out <path>]                  # 미지정 시 stdout
  scorecard.py score --metrics <path> --judgment <path> [--out <path>] [--report <path>]
  scorecard.py compare <card.json> [<card.json>...]     # 위치 인자 (nargs="+")
  ```

  선택 인자는 원본의 기본값을 그대로 둔다. 이 표는 반입 대상 서술이지 새로
  정의하는 계약이 아니다 — 스크립트와 어긋나면 스크립트가 옳다.

- 데이터·상태: 저장소 상태를 바꾸지 않는다. 산출물은 사용자가 지정한 경로
  (관례상 `.benchmarks/`)이며 저장소에 반입하지 않는다. 이 스킬은
  `.bouncer/` 문서를 읽지도 쓰지도 않고 `bouncer` CLI를 호출하지 않는다.
- 수용 기준: 에픽 성공 조건 1–6.
- 검증 명령: `npm test`
- 실패 모드·엣지 케이스:
  - `python3` 부재 — 스킬은 실행 실패를 그대로 노출하지 않고, 필요 런타임과
    이 스킬이 선택 도구라는 점을 안내한다. 저장소의 Node 전용 경로는 영향받지
    않는다.
  - 자기 산출물 채점 — 코드를 쓴 세션이 그대로 채점하면 correctness·scope가
    부풀려진다. 판정은 서브에이전트로 넘기고, 넘길 수 없으면 리포트에
    자가 채점임을 적는다.
  - 근거 없는 점수 — 루브릭 규약상 0점이다. 이 규약이 사라지면 런 간 비교가
    무너지므로 계약 테스트가 문구를 잡는다.
  - 측정 명령 불일치 — 비교 대상 런끼리 체크 명령이 다르면 합성 점수를
    나란히 놓을 수 없다. `scorecard.py`의 confidence 표기가 그 사실을 알린다.
  - 이름 충돌·표면 회귀 — `bouncer-*` 접두 없는 19번째 스킬이 들어오면서
    `trust-boundary` 목록 길이 단언과 `cursor-plugin`의 접두어 필터가 걸린다.
  - 라이선스 — Apache-2.0 저작물을 실질 복사하므로 고지 없이는
    `docs/ARCHITECTURE.md` §4 규칙 위반이자 루브릭 자신의 blocking finding이다.
    원 저장소에 `LICENSE` 파일이 없고 이 저장소에도 없으므로, 전문 사본 대신
    출처·식별자·URL을 담은 `NOTICE.md`를 스킬 안에 둔다.
  - 산출물 유출 — `.benchmarks/`가 무시 목록에 없으면 실행 후 산출물이
    `git status`에 뜨고 다음 task의 commit-safety 스코프 판정에 걸린다.

## Out of scope
- 워크플로 스킬 목록·`/bouncer-*` 절차 변경. 이 스킬은 어떤 워크플로 스킬에서도
  호출되지 않는다.
- `docs/ARCHITECTURE.md` §4 일반 워크플로 스킬 표 확장. 표는 8개를 유지한다
  (`test/public-name-regression.test.js`의 `APPROVED_GENERIC_SKILLS`).
- `scripts/`·`hooks/`·`.bouncer/config.json`·플러그인 매니페스트. 스킬 디렉터리는
  관례 발견이라 매니페스트 등록이 필요 없다.
- 새 named agent. 판정 서브에이전트는 범용 에이전트로 충분하다.

## One-commit justification
- 스킬 본문·루브릭·스크립트·계약 테스트·문서 위치 서술은 서로 검증한다. 테스트만
  먼저 들어오면 `npm test`가 깨지고, 스킬만 먼저 들어오면 §4 표 밖 위치가 문서로
  고정되지 않는다. 리뷰어가 판단할 질문은 하나 — "이 반입이 Bouncer 계약을
  지키는가"이며 그건 한 diff에서 답해야 한다.

## Documents
* [Tasks](tasks/001/tasks.md) - 구현 브리프
* [Verification](tasks/001/verification.md) - 검증 명령과 증적
* [Review](tasks/001/review.md) - 리뷰 발견사항
* [Context review](context-review.md) - 계획 문서 정합성 판정
<!-- explain.md는 plan scaffold에 포함되지 않습니다. /bouncer-finalize가 작성합니다. -->
