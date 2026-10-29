---
type: bouncer.blueprint
title: 실행 회고 후속 정리와 결합 경로 탐지
description: Close the last drive's retro follow-ups and add read-only coupled-path detection to plan inspect.
resource: .bouncer/context/epics/drive-execution/blueprints/retro-followups-coupled-paths/index.md
tags:
  - bouncer
  - blueprint
  - direct-run
  - coordinate-dispatch
  - scope-revise
  - plan-inspect
  - coupled-paths
timestamp: '2026-10-29T12:27:22.959+09:00'
bouncer:
  id: retro-followups-coupled-paths
  epic_id: drive-execution
  blueprint_id: retro-followups-coupled-paths
  status: closed
  order: 73
  commit_type: feat
  scale: full
  review_scope: blueprint
  verification_policy: scoped_terminal
  review_contract: brief
  attribution: bouncer-run 단계의 direct-run 문구·coordinate dispatch·범위 개정 회귀 테스트와 결합 경로 탐지 후속이라 drive-execution에 귀속
  supersedes: []
---
# 실행 회고 후속 정리와 결합 경로 탐지

Epic: [drive-execution](../../index.md)

## Intent
- 직전 drive 회고에서 나온 인계 규칙 공백, report 디렉터리 누락, 범위 합집합 회귀 위험을 문서·코드·테스트로 닫는다.
- `bouncer plan inspect --blueprint`가 생성 짝과 경로 문자열로 찾은 테스트를 읽기 전용으로 보여 주어 계획 단계의 범위 누락을 줄인다.

## Contract
- 인터페이스:
  - 직접 실행 리뷰 인계(`skills/bouncer-run/references/direct-run.md`, `skills/bouncer-run/SKILL.md`, `agents/bouncer-coordinator.md`): reviewer report 하나라도 `must_fix`를 담으면 root는 그 라운드를 기록하지 않고 인계한다. `must_fix`가 없는 라운드만 root가 기록한다. 인계 때 root는 reviewer 보고 원문 파일을 쓰고 `coordinate note`의 `review-handoff:` note로 그 경로와 리뷰 `target`을 넘기며, coordinator는 mode·base·head·`snapshot_id`·perspective 집합과 파일 sha256이 모두 맞을 때만 그 파일로 라운드를 기록한다. `must_fix` 판정은 reviewer finding의 actionability hint로 하며 controller 집계보다 앞선다.
  - `bouncer coordinate dispatch`: 원장에 attempt를 쓰기 전에 `report_path`의 부모 디렉터리를 만든다. 만들 수 없으면 `ok: false`, `reason: 'dispatch-report-dir-failed'`로 거절하고 원장을 바꾸지 않는다.
  - `bouncer plan inspect --blueprint <dir>`: 성공 JSON에 `coupledPaths`를 더한다. `--blueprint`가 없으면 `coupledPaths: null`이다.
  - 계획 흐름(`skills/bouncer-plan/SKILL.md` step 4, `scope-confirm.md`, `agents/bouncer-plan-coordinator.md`): planner 초안 뒤 plan coordinator가 inspect를 돌려 덮이지 않은 짝·후보를 `ask`·`needs_user`로 올리고, root가 `plan.affected_paths`를 다시 물어 사용자가 확정한 경로만 더한다.

```ts
type CoupledPair = {
  task: string; source: string; path: string;
  kind: 'codex-agent-toml' | 'gitignore-exception'; covered: boolean;
};
type CoupledCandidate = {
  task: string; source: string; path: string; kind: 'path-literal';
  evidence: { line: number; text: string };
};
type CoupledPaths = { advisory: true; pairs: CoupledPair[]; candidates: CoupledCandidate[] };
```

- 데이터·상태: 원장 스키마와 task 문서 스키마는 바뀌지 않는다.
  - 인계 원문 파일: 소유자는 직접 실행 root이고 위치는 integration cwd의 `.bouncer/runtime/print/review-handoff-<mode>-<perspective>.md`(`<mode>`는 `discovery` 또는 `delta`, 단일·delta 리뷰의 `<perspective>`는 `combined`)다. root는 쓰기 전에 기존 `review-handoff-*.md`를 지운다. 원장에는 기존 note decision 하나만 더해진다.
  - dispatch는 worker worktree에 `.bouncer/runtime/reports/` 빈 디렉터리를 만든다.
  - plan inspect는 어떤 파일도 쓰지 않는다.
- 수용 기준: epic Success criteria 18·19가 참이다. 작업 001의 수용 기준은 direct-run 인계 규칙, dispatch 디렉터리 생성, 정규화 중복 제거 회귀 테스트다. 작업 002의 수용 기준은 `coupledPaths`의 짝·후보 출력, 읽기 전용 보장, 계획 흐름 문서 세 곳의 일치다. 종단 검증은 epic Success criteria 8의 `npm run ci`다.
- 검증 명령: 작업 001은 `node --test test/coordinator.test.js test/cli-coordinate.test.js test/skill-bouncer-run.test.js test/agents.test.js`, 작업 002는 `node --test test/plan-inspect.test.js test/agents.test.js test/skill-bouncer-surface.test.js`, 종단 검증은 `npm run ci`다.
- 실패 모드·엣지 케이스:
  - 이미 있는 디렉터리를 가리키는 symlink는 지금의 보고 파일 쓰기와 같이 그대로 따라간다. worktree 밖 대상 차단은 이번 범위가 아니다.
  - `report_path` 부모 디렉터리를 만들 수 없으면(경로에 파일, 대상 없는 symlink, 권한 없음 등 `mkdirSync`가 던지는 모든 경우) dispatch는 거절하고 attempt를 열지 않는다. 디렉터리가 이미 있으면 그대로 성공한다.
  - coordinator는 가장 최근 `review-handoff:` note 하나만 보고, mode·base·head·`snapshot_id`·perspective 집합이 같고 `files=` 경로가 integration cwd 안이며 sha256이 맞을 때만 그 파일로 라운드를 기록한다. note 본문이 2000자를 넘으면 자르지 않고 `unavailable` note로 바꾼다.
  - 인계 원문 파일을 쓰지 못하면 root는 `review-handoff: unavailable` note로 인계를 계속하고, coordinator는 discovery를 다시 돈다. note가 가리키는 base·head가 coordinator의 `next`와 다르면 coordinator는 그 파일을 근거로 삼지 않는다.
  - `coupledPaths`는 commit task만 본다. verification task와 빈 `affected_paths`는 짝·후보를 만들지 않는다.
  - 디렉터리 항목(`/`로 끝나는 값, 디스크의 디렉터리, 마지막 조각에 `.`이 없는 값)과 정규화 뒤 빈 값·`.`은 경로 문자열 검색을 하지 않는다. `agents`·`agents/`는 이름 목록의 모든 역할 짝으로 펼친다. 테스트 디렉터리는 symlink를 따라가지 않고 `node_modules`와 1 MiB 넘는 파일을 건너뛴다.
  - `test/`·`tests/`가 없거나 파일을 읽지 못하면 그 파일만 건너뛰고 `candidates`는 빈 배열일 수 있다. 오류로 바꾸지 않는다.
  - 탐지 결과는 `affected_paths`를 채우거나 넓히지 않고, gate·scope 판정에 쓰이지 않는다.

## Out of scope
- `affected_paths` 차단과 예상 경로 정책 완화
- inspect가 탐지 결과를 문서에 쓰거나 범위 판정에 강제하는 것
- CI 단계를 앞당기거나 실행 환경을 준비하는 것
- light blueprint 병합이나 복잡도 판정
- CHANGELOG·버전 문서 수정
- 승인된 `worker-lint-check` blueprint의 implementer lint 절차
- `skills/bouncer-run/references/drive-metrics.md:73-77`의 인계 순서에 note 단계를 넣는 것, `rules/cli.md:103`의 `plan inspect` 출력 서술에 `coupledPaths`를 넣는 것. 두 문서는 이 blueprint 뒤 한동안 새 규칙과 어긋나며, 이 잔여 위험은 후속 계획으로 미룬다. 그동안 인계 순서는 `direct-run.md` Handoff 표가, 출력 필드는 `plan inspect` JSON과 사용법 문자열이 정본이다.

## One-commit justification
- 세 변경 묶음은 모두 직전 drive 회고와 범위 누락 분석의 후속이며, 하나의 PR 리뷰에서 같은 회고 근거로 판정된다. 구현 task 둘은 경로가 겹치지 않아 병렬로 돌고 종단 검증 하나로 합쳐진다.
