---
type: bouncer.tasks
title: 벤치마크 스킬과 참조 제거
description: Deletes the benchmark skill, obsolete benchmark documentation, and dependent assertions.
resource: .bouncer/context/epics/062-document-commit-contracts/blueprints/004-benchmark-skill-removal/tasks/001/tasks.md
tags:
  - bouncer
  - tasks
timestamp: '2026-09-04T13:25:50.574+09:00'
bouncer:
  id: TASKS-001
  epic_id: '062'
  blueprint_id: '004'
  status: verified
  verify: npm test
  affected_paths:
    - skills/agentic-code-benchmark/NOTICE.md
    - skills/agentic-code-benchmark/SKILL.md
    - skills/agentic-code-benchmark/references/rubric.md
    - skills/agentic-code-benchmark/references/task-suite.md
    - skills/agentic-code-benchmark/scripts/bridge_pier.py
    - skills/agentic-code-benchmark/scripts/collect_metrics.py
    - skills/agentic-code-benchmark/scripts/run_deepswe.py
    - skills/agentic-code-benchmark/scripts/scorecard.py
    - docs/benchmark/context-corpus-search.md
    - docs/benchmark/context-cost.md
    - docs/benchmark/deepswe/comparison.md
    - docs/benchmark/deepswe/protocol.md
    - docs/benchmark/deepswe/results/.gitkeep
    - docs/benchmark/deepswe/results/052-vanilla-abs-module-cache-flags/run.log
    - docs/benchmark/deepswe/results/052-vanilla-abs-module-cache-flags/tasks/abs-module-cache-flags/ctrf.json
    - docs/benchmark/deepswe/results/052-vanilla-abs-module-cache-flags/tasks/abs-module-cache-flags/reward.json
    - docs/benchmark/deepswe/results/052-vanilla-abs-module-cache-flags/tasks/abs-module-cache-flags/test-stdout.txt
    - docs/benchmark/deepswe/results/052-vanilla-abs-stepped-slices/run.log
    - docs/benchmark/deepswe/results/052-vanilla-abs-stepped-slices/tasks/abs-stepped-slices/ctrf.json
    - docs/benchmark/deepswe/results/052-vanilla-abs-stepped-slices/tasks/abs-stepped-slices/reward.json
    - docs/benchmark/deepswe/results/052-vanilla-abs-stepped-slices/tasks/abs-stepped-slices/test-stdout.txt
    - docs/benchmark/deepswe/results/052-vanilla-actionlint-action-pinning-lint/run.log
    - docs/benchmark/deepswe/results/052-vanilla-actionlint-action-pinning-lint/tasks/actionlint-action-pinning-lint/ctrf.json
    - docs/benchmark/deepswe/results/052-vanilla-actionlint-action-pinning-lint/tasks/actionlint-action-pinning-lint/reward.json
    - docs/benchmark/deepswe/results/052-vanilla-actionlint-action-pinning-lint/tasks/actionlint-action-pinning-lint/test-stdout.txt
    - docs/benchmark/deepswe/sample.md
    - docs/benchmark/graphify-search-quality.md
    - docs/benchmark/history.md
    - docs/benchmark/protocol.md
    - docs/benchmark/task-selection.md
    - docs/benchmark/tasks/README.md
    - docs/benchmark/tasks/cli-equals-flags.json
    - docs/benchmark/tasks/commit-violation-detail.json
    - docs/benchmark/tasks/cursor-host-lookup.json
    - docs/benchmark/tasks/frontmatter-crlf.json
    - docs/benchmark/tasks/json-parse-position.json
    - docs/benchmark/tasks/kst-calendar-date.json
    - docs/benchmark/tasks/reuse-context-root.json
    - docs/benchmark/tasks/reuse-enoent-check.json
    - docs/benchmark/tasks/usage-readability.json
    - docs/benchmark/tasks/yaml-codec-extract.json
    - README.md
    - docs/ARCHITECTURE.md
    - docs/contributing.md
    - docs/install.md
    - docs/README.md
    - docs/configuration.md
    - rules/skill-shape.md
    - test/distill.test.js
    - test/open-source-readiness.test.js
    - test/public-name-regression.test.js
    - test/trust-boundary.test.js
    - test/skill-agentic-code-benchmark.test.js
    - test/benchmark-context-cost.test.js
    - test/graph-search-quality.test.js
    - .bouncer/distill/plugin-benchmark.md
    - CHANGELOG.md
    - test/skill-bouncer-surface.test.js
    - .bouncer/Distill.md
  scope_evidence:
    producer: graphify
    generated_at: '2026-09-04T13:33:00.000+09:00'
    suggested_paths: []
    # 유효 엔트리 필드: graph, status, query, result — 예시는 주석이라 파싱되지 않는다
    # - graph: source | test | context
    #   status: updated | reused | fail-skip | skip-disabled | missing
    #   query: <graphify 조회>
    #   result: <한 줄 요약>
    # quality/candidates는 graph-suggest 뒤에만 채운다 — scaffold가 제조하지 않는다
    basis:
      - { graph: source, status: reused, query: document commit contract removal finalize task evidence, result: source graph fresh; ranking omitted due to 156 candidate explosion }
      - { graph: test, status: reused, query: document commit contract removal finalize task evidence, result: test graph fresh; ranking omitted due to 156 candidate explosion }
      - { graph: context, status: updated, query: document commit contract removal finalize task evidence, result: context graph rebuilt; ranking omitted due to 156 candidate explosion }
    quality: { status: low-confidence, confidence: low, reasons: [source omissions, result explosion] }
    candidates: { implementation: [], test: [], context: [] }
  commit_intent:
    - 사용되지 않는 벤치마크 표면과 유지 비용을 제거함
    - 워크플로 계약에는 대체 계측을 섞지 않음
---
# 벤치마크 스킬과 참조 제거

Blueprint: [004](../../index.md)

<!-- scope_evidence.basis 엔트리 필드: graph, status, query, result.
     graph: source | test | context
     status: updated | reused | fail-skip | skip-disabled | missing
     quality/candidates는 graph-suggest 결과로만 채운다(scaffold는 비워 둔다).
     프론트매터 값은 []로 둔다. 이 주석을 실제 엔트리로 옮기면 빈 계획이 승인된다. -->

## Goal & intent
<!-- 구현자가 다른 문서 없이 시작할 수 있게.
     수용 기준과 검증 명령도 여기에 적거나 Checklist에 명시한다. -->
`agentic-code-benchmark` 스킬과 그 결과·프로토콜 문서를 제거한다. 남은 문서와 테스트는 이 스킬이 더 이상 공개되거나 실행되지 않는다는 상태를 반영한다.

## Interface
<!-- 계약이 리뷰에서 검증 가능하도록 제공하는 것과 거부하는 것을 함께 적습니다. -->
- 제공: 현재 제공되는 Bouncer 스킬 목록과 설치 안내만 남긴다.
- 거부: benchmark 스킬 호출, benchmark 결과 문서, 폐기한 이름을 단언하는 테스트는 남기지 않는다.

## Touch
<!-- frontmatter bouncer.affected_paths의 모든 경로가 여기서 정당화되어야 합니다 (G11).
     디렉터리가 아니라 파일 단위로, 동사(Create/Modify/Delete/Rename)를 붙입니다.
     디렉터리 하나로 뭉치면 그 안 모든 파일이 열려 G11이 사실상 통과만 합니다.
     경로는 백틱으로 감쌉니다. -->
- Delete `skills/agentic-code-benchmark/NOTICE.md` — 스킬의 라이선스 고지를 제거한다.
- Delete `skills/agentic-code-benchmark/SKILL.md` — 폐기 스킬 진입 문서를 제거한다.
- Delete `skills/agentic-code-benchmark/references/rubric.md` — 루브릭을 제거한다.
- Delete `skills/agentic-code-benchmark/references/task-suite.md` — task suite 참조를 제거한다.
- Delete `skills/agentic-code-benchmark/scripts/bridge_pier.py` — 보조 실행기를 제거한다.
- Delete `skills/agentic-code-benchmark/scripts/collect_metrics.py` — 메트릭 수집기를 제거한다.
- Delete `skills/agentic-code-benchmark/scripts/run_deepswe.py` — DeepSWE 실행기를 제거한다.
- Delete `skills/agentic-code-benchmark/scripts/scorecard.py` — 점수 계산기를 제거한다.
- Delete `docs/benchmark/context-corpus-search.md` — 벤치마크 문서를 제거한다.
- Delete `docs/benchmark/context-cost.md` — 벤치마크 문서를 제거한다.
- Delete `docs/benchmark/deepswe/comparison.md` — 벤치마크 문서를 제거한다.
- Delete `docs/benchmark/deepswe/protocol.md` — 벤치마크 문서를 제거한다.
- Delete `docs/benchmark/deepswe/results/.gitkeep` — 결과 보관소 표식을 제거한다.
- Delete `docs/benchmark/deepswe/results/052-vanilla-abs-module-cache-flags/run.log` — 기록 결과를 제거한다.
- Delete `docs/benchmark/deepswe/results/052-vanilla-abs-module-cache-flags/tasks/abs-module-cache-flags/ctrf.json` — 기록 결과를 제거한다.
- Delete `docs/benchmark/deepswe/results/052-vanilla-abs-module-cache-flags/tasks/abs-module-cache-flags/reward.json` — 기록 결과를 제거한다.
- Delete `docs/benchmark/deepswe/results/052-vanilla-abs-module-cache-flags/tasks/abs-module-cache-flags/test-stdout.txt` — 기록 결과를 제거한다.
- Delete `docs/benchmark/deepswe/results/052-vanilla-abs-stepped-slices/run.log` — 기록 결과를 제거한다.
- Delete `docs/benchmark/deepswe/results/052-vanilla-abs-stepped-slices/tasks/abs-stepped-slices/ctrf.json` — 기록 결과를 제거한다.
- Delete `docs/benchmark/deepswe/results/052-vanilla-abs-stepped-slices/tasks/abs-stepped-slices/reward.json` — 기록 결과를 제거한다.
- Delete `docs/benchmark/deepswe/results/052-vanilla-abs-stepped-slices/tasks/abs-stepped-slices/test-stdout.txt` — 기록 결과를 제거한다.
- Delete `docs/benchmark/deepswe/results/052-vanilla-actionlint-action-pinning-lint/run.log` — 기록 결과를 제거한다.
- Delete `docs/benchmark/deepswe/results/052-vanilla-actionlint-action-pinning-lint/tasks/actionlint-action-pinning-lint/ctrf.json` — 기록 결과를 제거한다.
- Delete `docs/benchmark/deepswe/results/052-vanilla-actionlint-action-pinning-lint/tasks/actionlint-action-pinning-lint/reward.json` — 기록 결과를 제거한다.
- Delete `docs/benchmark/deepswe/results/052-vanilla-actionlint-action-pinning-lint/tasks/actionlint-action-pinning-lint/test-stdout.txt` — 기록 결과를 제거한다.
- Delete `docs/benchmark/deepswe/sample.md` — 벤치마크 샘플을 제거한다.
- Delete `docs/benchmark/graphify-search-quality.md` — 품질 측정 문서를 제거한다.
- Delete `docs/benchmark/history.md` — 측정 이력을 제거한다.
- Delete `docs/benchmark/protocol.md` — 측정 프로토콜을 제거한다.
- Delete `docs/benchmark/task-selection.md` — task 선택 규칙을 제거한다.
- Delete `docs/benchmark/tasks/README.md` — task suite 안내를 제거한다.
- Delete `docs/benchmark/tasks/cli-equals-flags.json` — suite task를 제거한다.
- Delete `docs/benchmark/tasks/commit-violation-detail.json` — suite task를 제거한다.
- Delete `docs/benchmark/tasks/cursor-host-lookup.json` — suite task를 제거한다.
- Delete `docs/benchmark/tasks/frontmatter-crlf.json` — suite task를 제거한다.
- Delete `docs/benchmark/tasks/json-parse-position.json` — suite task를 제거한다.
- Delete `docs/benchmark/tasks/kst-calendar-date.json` — suite task를 제거한다.
- Delete `docs/benchmark/tasks/reuse-context-root.json` — suite task를 제거한다.
- Delete `docs/benchmark/tasks/reuse-enoent-check.json` — suite task를 제거한다.
- Delete `docs/benchmark/tasks/usage-readability.json` — suite task를 제거한다.
- Delete `docs/benchmark/tasks/yaml-codec-extract.json` — suite task를 제거한다.
- Delete `test/skill-agentic-code-benchmark.test.js` — 전용 스킬 테스트를 제거한다.
- Delete `test/benchmark-context-cost.test.js` — 전용 비용 테스트를 제거한다.
- Delete `test/graph-search-quality.test.js` — 벤치마크 전제의 전용 테스트를 제거한다.
- Modify `README.md` — 공개 기능 목록에서 벤치마크를 제거한다.
- Modify `docs/ARCHITECTURE.md` — 폐기한 구성요소 설명을 제거한다.
- Modify `docs/contributing.md` — 벤치마크 기여 안내를 제거한다.
- Modify `docs/install.md` — 설치 표면을 갱신한다.
- Modify `docs/README.md` — 문서 색인을 갱신한다.
- Modify `docs/configuration.md` — 벤치마크 설정 안내를 제거한다.
- Modify `rules/skill-shape.md` — 삭제한 스킬의 구조 단언을 제거한다.
- Modify `test/distill.test.js` — 삭제한 Distill shard 단언을 갱신한다.
- Modify `test/open-source-readiness.test.js` — 공개 문서 단언을 갱신한다.
- Modify `test/public-name-regression.test.js` — 공개 이름 목록을 갱신한다.
- Modify `test/trust-boundary.test.js` — 폐기 스킬 참조를 제거한다.
- Modify `.bouncer/distill/plugin-benchmark.md` — 폐기한 runtime shard를 제거한다.
- Modify `CHANGELOG.md` — 공개 스킬 제거를 기록한다.
- Modify `test/skill-bouncer-surface.test.js` — 카탈로그 스킬 수 단언을 갱신한다.
- Modify `.bouncer/Distill.md` — plugin-benchmark 샤드 인덱스를 제거한다.

## Do not touch
<!-- 여기 적은 경로가 affected_paths와 겹치면 G12가 막습니다.
     epic / blueprint의 Out of scope에서 이어받습니다. -->
- `skills/bouncer-*/` — Bouncer 워크플로 스킬의 동작을 바꾸지 않는다.

## Constraints
<!-- 경로로 표현되지 않는, 작업 전체에 걸리는 규칙. 허용된 파일 안에서도 지켜야 합니다.
     예: 하위 호환 별칭을 남기지 않는다 / 기존 게이트 번호와 본문 계약을 유지한다 /
     공개 문자열은 한국어를 유지한다.
     막을 대상이 경로뿐이면 Do not touch에 적습니다. -->
- 대체 측정기, 새 의존성, 빈 디렉터리나 호환성 별칭을 만들지 않는다.

## Checklist
<!-- 각 항목은 구현자가 순서대로 실행 가능해야 합니다.
     행위를 바꾸는 항목은 실패 테스트 → 실패 확인 → 구현 순서로 적습니다.
     기대하는 assertion·상수·명령은 코드블록으로 그대로 적어 해석 여지를 없앱니다.
     blueprint Contract에서 이연된 테스트 본문·구현 시퀀스가 들어올 자리입니다.
     수용 기준·검증 명령을 체크 항목으로 포함하세요. -->
- [ ] 삭제 표면을 단언하는 테스트를 먼저 제거·갱신하고, 워크플로가 benchmark 출력에 의존하지 않음을 확인한다.
- [ ] 스킬·문서·Distill·카탈로그 참조를 제거한다.
- [ ] `agentic-code-benchmark`와 `docs/benchmark` 잔존 검색을 수행한다.
- [ ] `npm test`를 실행한다.
