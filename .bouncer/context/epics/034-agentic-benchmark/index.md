---
type: bouncer.epic
title: 에이전트 코드 품질 벤치마크
description: 워크플로 밖 개발자 도구로 벤치마크 스킬을 반입해 런 사이 비교 가능한 점수를 남긴다
resource: .bouncer/context/epics/034-agentic-benchmark/index.md
tags:
  - bouncer
  - epic
timestamp: '2026-08-13T13:18:25.045+09:00'
bouncer:
  id: '034'
  epic_id: '034'
  status: approved
---
# 034 agentic-benchmark

## Intent
- 문제: Bouncer의 게이트는 한 런이 계약을 지켰는지 pass/fail로만 답한다. 모델을
  바꾸거나 `/bouncer-run`을 켜거나 프롬프트 방식을 손봤을 때 산출 코드가 실제로
  나아졌는지는 게이트가 답하지 않고, 지금은 인상으로 판단하고 있다.
- 목표: 런 하나를 0-100 점수와 근거 기록으로 남겨 런끼리 비교할 수 있게 한다.
  판정 체계는 게이트와 섞지 않고 워크플로 밖 개발자 도구로 둔다.

## Success criteria
1. `skills/agentic-code-benchmark/SKILL.md`가 존재하고, frontmatter `name`이
   디렉터리명과 같으며, 워크플로 스킬 전용 문구(`This skill should be used only
   when the user explicitly asks`)를 쓰지 않는다.
2. `references/rubric.md`의 다섯 판정 차원 제목이 `scripts/scorecard.py`
   `DIMENSIONS`의 표시 문자열과 같은 순서로 일치하고, 40 측정 + 60 판정 합성이
   `SKILL.md`와 `scorecard.py`에 남아 있다. (합성 비율은 루브릭 본문이 아니라 그
   두 파일에 적혀 있다.)
3. `python3 skills/agentic-code-benchmark/scripts/collect_metrics.py --help`와
   `python3 skills/agentic-code-benchmark/scripts/scorecard.py template`이 표준
   라이브러리만으로 동작한다.
4. `docs/ARCHITECTURE.md` §4 일반 워크플로 스킬 **표의 행**에 이 스킬이 없고,
   워크플로 밖 도구이자 게이트 판정에 관여하지 않음이 §4 산문과 §F에 서술된다.
5. Apache-2.0 출처 고지(저장소·경로·라이선스 식별자·원본 URL)가
   `skills/agentic-code-benchmark/NOTICE.md`에 있고 `SKILL.md`가 그 파일을
   가리킨다.
6. `test/skill-agentic-code-benchmark.test.js`가 위 계약을 단언하고 `npm test`가
   통과한다.

## Out of scope
- 워크플로·게이트 연결. `/bouncer-execute`·`/bouncer-commit`·`/bouncer-finalize`의
  절차와 G/S 코드는 그대로 둔다. 점수는 어떤 게이트의 입력도 되지 않는다.
- 루브릭 재설계. `bouncer-followups.md`가 참조하던 Ponytail 4축(code size /
  correctness / security / robustness)으로 갈아엎지 않는다 — 반입 스킬의 5차원을
  정본으로 삼고 `PLANNING-DECISIONS-1.0.md` §9 문장을 그쪽으로 갱신한다.
- Python 스크립트의 Node 포팅. Node 전용 약속은 `scripts/lib`와 훅이 지는 것이고,
  이 스킬은 CLI·게이트 경로를 건드리지 않는다.
- CI 연동과 점수 임계값. 최소 점수로 PR을 막는 것은 임계값 합의가 먼저다.
- `.benchmarks/` 산출물의 저장소 반입. 스킬은 경로만 안내하고 결과물은 커밋하지
  않는다.

## Blueprints
* [001 benchmark-skill](blueprints/001-benchmark-skill/index.md) - `agentic-code-benchmark` 스킬(SKILL.md·rubric·task-suite·수집/채점 스크립트)을 Bouncer 맥락으로 각색해 반입하고 출처 고지·계약 테스트·문서 위치 서술을 붙임 — `skills/agentic-code-benchmark/`·`test/skill-agentic-code-benchmark.test.js`·`test/trust-boundary.test.js`·`docs/ARCHITECTURE.md`·`README.md`·`PLANNING-DECISIONS-1.0.md`
