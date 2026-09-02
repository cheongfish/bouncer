---
type: bouncer.tasks
title: Distill CLI 명령 추가
description: Tasks for 002
resource: .bouncer/context/epics/007-project-distill/blueprints/003-path-routed-distill/tasks/002/tasks.md
tags:
  - bouncer
  - tasks
timestamp: '2026-08-14T12:56:28.204+09:00'
bouncer:
  id: TASKS-002
  epic_id: '007'
  blueprint_id: '003'
  status: verified
  commit_intent:
    - 라우팅 결과를 워크플로와 감사에서 재현 가능하게 노출해야 함
    - stdout 파이프 소비를 진단 메시지로 오염시키지 않아야 함
  verify: npm test
  affected_paths:
    - scripts/src/lib/cli.ts
    - scripts/lib/cli.js
    - scripts/src/lib/cli-project-commands.ts
    - scripts/lib/cli-project-commands.js
    - docs/cli.md
    - test/cli-project-commands.test.js
  graph:
    generated_at: '2026-08-14T12:56:28.204+09:00'
    command: graphify query source+context
    suggested_paths: []
    basis:
      - graph: source
        status: reused
        query: Project Distill sharding path routing router CLI validation context digest graph scope finalize workflow skills
        result: 68 nodes; source graph advisory result recorded for blueprint task
      - graph: context
        status: updated
        query: Project Distill sharding path routing router CLI validation context digest graph scope finalize workflow skills
        result: 8 nodes; context graph advisory result recorded for blueprint task
---
# Tasks

Blueprint: [001](../../index.md)

## Goal & intent
<!-- 구현자가 다른 문서 없이 시작할 수 있게.
     수용 기준과 검증 명령도 여기에 적거나 Checklist에 명시한다. -->
라우터를 `bouncer distill` 서브명령으로 노출해 본문·대상 경로·감사 정보와 JSON을 제공한다.

## Interface
<!-- 계약이 리뷰에서 검증 가능하도록 제공하는 것과 거부하는 것을 함께 적습니다. -->
- 제공: `--for`, `--all`, `--route`, `--audit`, `--json` 모드와 stdout-정상/stderr-진단 계약.
- 거부: 알 수 없는 모드와 혼합된 잘못된 인자를 성공으로 해석하지 않는다.

## Touch
<!-- frontmatter bouncer.affected_paths의 모든 경로가 여기서 정당화되어야 합니다 (G11).
     디렉터리가 아니라 파일 단위로, 동사(Create/Modify/Delete/Rename)를 붙입니다.
     디렉터리 하나로 뭉치면 그 안 모든 파일이 열려 G11이 사실상 통과만 합니다.
     경로는 백틱으로 감쌉니다. -->
- Modify `scripts/src/lib/cli-project-commands.ts` — `distill` 등록과 인자 검증·출력을 배선한다.
- Modify `scripts/src/lib/cli.ts` — `distill` 명령을 top-level command registry에 등록한다.
- Modify `scripts/lib/cli.js` — CLI registry 변경의 CJS emit을 동기화한다.
- Modify `scripts/lib/cli-project-commands.js` — project command 변경의 CJS emit을 동기화한다.
- Modify `docs/cli.md` — 공개 명령과 모드별 출력을 설명한다.
- Create `test/cli-project-commands.test.js` — 모드, JSON, stdout/stderr 분리를 검증한다.

## Do not touch
<!-- 여기 적은 경로가 affected_paths와 겹치면 G12가 막습니다.
     epic / blueprint의 Out of scope에서 이어받습니다. -->
- `scripts/src/lib/distill.ts` — 라우팅 의미는 task 001의 테스트 계약을 유지한다.

## Constraints
<!-- 경로로 표현되지 않는, 작업 전체에 걸리는 규칙. 허용된 파일 안에서도 지켜야 합니다.
     예: 하위 호환 별칭을 남기지 않는다 / 기존 게이트 번호와 본문 계약을 유지한다 /
     공개 문자열은 한국어를 유지한다.
     막을 대상이 경로뿐이면 Do not touch에 적습니다. -->
- `runtimePaths`로 main worktree를 해석하고 linked checkout cwd를 기준으로 삼지 않는다.
- `--all`·`--audit`은 routing 설정과 임계값을 무시하고 전량을 대상으로 한다.

## Checklist
<!-- 각 항목은 구현자가 순서대로 실행 가능해야 합니다.
     행위를 바꾸는 항목은 실패 테스트 → 실패 확인 → 구현 순서로 적습니다.
     기대하는 assertion·상수·명령은 코드블록으로 그대로 적어 해석 여지를 없앱니다.
     blueprint Contract에서 이연된 테스트 본문·구현 시퀀스가 들어올 자리입니다.
     수용 기준·검증 명령을 체크 항목으로 포함하세요. -->
- [ ] 각 CLI 모드와 pipe-clean 출력을 실패 테스트로 작성한다.
- [ ] 명령 등록과 문서를 구현하고 오류를 stderr로 보낸다.
- [ ] `npm run build`로 CLI TypeScript 변경의 CJS emit을 동기화한다.
- [ ] `npm test`를 실행한다.
