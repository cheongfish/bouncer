---
type: bouncer.context_review
title: 001 context review
description: Context review for 001
resource: .bouncer/context/epics/034-evaluation-benchmarking/blueprints/001-benchmark-skill/context-review.md
tags:
  - bouncer
  - context_review
timestamp: '2026-08-13T13:18:25.076+09:00'
bouncer:
  id: CTXREVIEW-001
  epic_id: '034'
  blueprint_id: '001'
  status: accepted
  context_review:
    findings:
      - id: CR-1
        severity: major
        status: resolved
      - id: CR-2
        severity: major
        status: resolved
      - id: CR-3
        severity: minor
        status: resolved
      - id: CR-4
        severity: minor
        status: resolved
      - id: CR-5
        severity: minor
        status: resolved
      - id: CR-6
        severity: minor
        status: resolved
      - id: CR-7
        severity: minor
        status: resolved
      - id: CR-8
        severity: nit
        status: resolved
      - id: CR-9
        severity: nit
        status: resolved
      - id: CR-10
        severity: nit
        status: accepted
        note: CHANGELOG는 이 저장소에서 릴리스 chore 커밋이 정리한다(29fa067, ed87c13). 기능 커밋마다 갱신하는 관행이 아니므로 Do not touch에 이유와 함께 명시하고 제외한다.
      - id: CR-11
        severity: nit
        status: resolved
---
# Context review

## Findings
- **CR-1** (major, resolved) — epic 성공 조건 2가 루브릭 본문에 없는 40/60 문자열과
  머신 키(`correctness`/`scope`/…)를 요구했다. 원본 `rubric.md`의 헤딩은
  `## 1. Correctness & spec fidelity` 형태이고 합성 비율은 `SKILL.md`와
  `scorecard.py`에만 있다. 브리프대로 단언을 쓰면 `npm test`가 실패한다.
  → 성공 조건 2를 헤딩 표시 문자열 ↔ `DIMENSIONS` 대응으로 고치고, 40/60 근거를
  두 파일로 옮겼다. Checklist 단언도 그 형태로 다시 썼다.
- **CR-2** (major, resolved) — Checklist가 §4 구간에 스킬 이름이 든 문단을 넣으라고
  하면서 동시에 §4에 이름이 없음을 단언하라고 해, 같은 커밋 안에서 서로를
  깨뜨렸다. → 단언 범위를 표 행(`^| \`agentic-code-benchmark\` |`)으로 한정하고,
  산문에는 이름이 있어야 함을 별도 단언으로 분리했다.
- **CR-3** (minor, resolved) — 성공 조건 3의 스크립트 경로가 저장소 루트 `scripts/`로
  읽혔다. 그 디렉터리는 Do not touch다. → 경로를
  `skills/agentic-code-benchmark/scripts/…`로 고쳤다.
- **CR-4** (minor, resolved) — blueprint Contract의 CLI 표기가 선택 인자를 필수처럼,
  `compare`의 위치 인자를 옵션처럼 적었다. 스크립트는 실질 변경 없이 반입하므로
  계약 문서가 산출물을 잘못 서술한 것이다. → 원본 시그니처대로 고치고, 어긋나면
  스크립트가 옳다는 문장을 붙였다.
- **CR-5** (minor, resolved) — "근거 없는 점수는 0점 규약을 계약 테스트가 잡는다"고
  선언했지만 Checklist에 그 단언이 없었다. → 0점 규약·`blocking_findings`·40/60
  단언을 Checklist에 추가했다.
- **CR-6** (minor, resolved) — `trust-boundary`의 `SKILLS`에 넣는 순간 `SKILL.md`가
  `DISTINCTION_RE`를 만족해야 하는데, 본문은 영어 강제이고 허용 문형이 지정되지
  않아 자연스러운 표현을 쓰면 테스트가 깨진다. → 정규식이 받는 영어 문장 하나를
  Constraints에 그대로 고정했다.
- **CR-7** (minor, resolved) — Apache-2.0 고지를 요구하면서 그것을 담을 파일이
  Touch에 없었다. 원 저장소에 `LICENSE`가 없고 이 저장소에도 없다.
  → `skills/agentic-code-benchmark/NOTICE.md`를 Touch와 `affected_paths`에 넣고,
  전문 사본 대신 식별자·URL로 대신한다는 판단을 문서에 남겼다.
- **CR-8** (nit, resolved) — `PLANNING-DECISIONS-1.0.md` §11의 완료 표기 관행은
  `완료 (PR #37)`인데 구현 시점에는 PR 번호를 모른다. → PR 번호 없이
  `완료 (034/001)`로 쓰도록 고정했다.
- **CR-9** (nit, resolved) — `.benchmarks/`가 `.gitignore`에 없어 실행 산출물이
  다음 커밋의 스코프 판정에 걸린다. → `.gitignore`를 Touch와 `affected_paths`에
  넣었다.
- **CR-10** (nit, accepted) — `CHANGELOG.md`가 Touch에 없다. 이 저장소는 릴리스
  `chore:` 커밋에서 `[Unreleased]`를 정리하는 관행이므로(`29fa067`, `ed87c13`)
  기능 커밋에서 제외하고, 그 이유를 Do not touch에 적었다.
- **CR-11** (nit, resolved) — §4 문단·§F 문장·README 줄이 어떤 단언으로도 덮이지
  않아 성공 조건 4가 `npm test`로 갈리지 않았다. → 산문 존재 단언과 README
  `python3` 단언을 Checklist에 추가했다.

리뷰어가 확인한 범위 밖 결론: `test/cursor-plugin.test.js`는 `skills/bouncer-*`만
순회하고, `test/public-name-regression.test.js`의 §4 표 추출은 백틱 표 행만 읽으며,
반입 파일에는 레거시 이름 토큰이 없다. 기존 테스트 중 빨개지는 것은
`test/trust-boundary.test.js` 하나이고 그것은 Touch와 `affected_paths`에 있다.
