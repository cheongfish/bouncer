---
type: bouncer.blueprint
title: 자동 주행 커맨드와 자율성 설정
description: /bouncer-run이 execute→commit을 task 소진까지 반복하고 autonomy가 확인 지점을 정한다
resource: .bouncer/context/epics/032-autonomous-run/blueprints/001-run-loop/index.md
tags:
  - bouncer
  - blueprint
timestamp: '2026-08-12T18:02:00.160+09:00'
bouncer:
  id: '001'
  epic_id: '032'
  blueprint_id: '001'
  status: closed
  commit_type: feat
  scale: full
---
# 001 run-loop

Epic: [032](../../index.md)

## Intent
- 문제: 진행을 미는 일과 판정하는 일이 섞여 있다. 게이트는 코드가 판정하는데
  다음 task로 넘어가는 결정까지 사람이 매번 답하고 있어, task가 늘수록 확인
  횟수만 선형으로 늘어난다.
- 완료 조건: 커맨드 하나가 execute→commit을 반복해 blueprint를 닫고, 멈추는
  자리가 문서에 미리 적혀 있어 어디서 멈췄는지 보고를 읽지 않아도 안다.

## Contract
- 인터페이스:
  - 새 워크플로 스킬 `/bouncer-run`. 활성 포인터의 blueprint에서
    `/bouncer-execute` → `/bouncer-commit`을 task가 없어질 때까지 반복한다.
    기존 두 커맨드는 그대로 남고 각자의 단일 책임을 유지한다 — 루프는 그
    본문을 복제하지 않고 같은 순서를 부른다.
  - `schema.ts`가 두 상수를 추가로 export한다.
    ```ts
    AUTONOMY_ENUM = ['auto', 'interactive']   // 부재 = 'auto'
    DEFAULT_AUTONOMY = 'auto'
    ```
  - `bouncer init`이 만드는 `config.json`에 `autonomy: "auto"`가 들어간다.
    이미 있는 `config.json`은 바뀌지 않는다(`--promote-graphify` 경로 포함).
  - 시작 ACQ가 주행 전 한 번 뜨고, 남은 task 목록과 각 task의
    `affected_paths`를 보여 준다.
- 데이터·상태:
  - `autonomy`는 `config.json`에만 산다. 문서 frontmatter에는 넣지 않으므로
    `schema.ts`의 문서 필드 등록이나 `validate`에는 손대지 않는다.
  - 루프는 상태 파일을 새로 만들지 않는다. 진행 상태는 활성 포인터
    (`<git-common-dir>/bouncer/current`)와 task 문서 status가 그대로 가진다.
  - 중단은 상태를 되감지 않는다. 포인터는 실패한 task에 남고 worktree도 남아,
    `/bouncer-execute`가 그 자리를 이어받는다.
- 수용 기준: 에픽 성공 기준 1–7.
- 검증 명령: `npm test`
- 실패 모드·엣지 케이스:
  - 포인터가 `null`이거나 열린 task가 없거나 blueprint가 `closed` — 주행을
    시작하지 않고 `/bouncer-plan` 또는 `/bouncer-finalize`로 보낸다.
  - verify 실패 — `bouncer-debugger` 경유로 한 번 고쳐 보고, 같은 verify가 또
    실패하면 그 task에서 멈춘다. 상한은 수동 경로와 자동 주행이 **같은 1회**다.
    기존 3회를 내리는 이유는 같은 실패를 세 번 다시 파는 일이 근본 원인이 아니라
    시도 횟수로 문제를 미는 형태이고, 무인 주행에서는 그 비용을 사람이 보지
    못한 채 치르기 때문이다. 상한을 한 곳에만 두어 두 경로가 갈라지지 않게 한다.
  - review finding이 남음 — implementer에게 되돌려 고치되 **2회**까지다. 상한에
    닿으면 `/bouncer-plan` 에스컬레이션이며, finding을 루프가 `accepted`로
    바꾸는 길은 없다.
  - commit 범위 위반(out-of-scope) — 하드 중단. 루프가 `affected_paths`를
    넓히거나 파일을 지워 통과시키지 않는다.
  - staged set이 비어 `committed: false` — 실패가 아니다. 다음 task로 간다.
  - `autonomy` 값이 허용 목록 밖 — 사용자에게 알리고 `auto`로 진행한다. 부재와
    같은 취급이며, 게이트가 아니므로 주행을 막지 않는다.
  - 중단 뒤 `/bouncer-run` 재호출 — 자동 재시도하지 않는다. 막힌 task 하나를
    `/bouncer-execute`로 닫은 뒤 다시 걸라고 안내한다.
  - task를 소진 — 멈추고 `/bouncer-finalize`를 안내한다.

## Out of scope
- 에픽 Out of scope 전부(새 CLI, finalize 자동 진입, blueprint 오버라이드,
  `config.json` 검사, `scale` 연동, 다중 blueprint 주행, BP-5·BP-6 항목).
- `/bouncer-execute`·`/bouncer-commit` 본문의 절차 변경. 루프는 두 스킬을
  호출자로서 이용할 뿐이고, 두 문서가 수동 경로로 계속 성립해야 한다. 예외는
  하나 — debugger 재디스패치 상한 숫자이며, 두 경로가 다른 수를 갖지 않도록
  TASKS-004가 함께 내린다. 절차 자체는 그대로다.
- named 디스패치 네 단계와 `scale: light` 인라인 규칙의 재서술. execute가
  가진 규칙이며 루프가 옮겨 적으면 사본이 둘로 갈린다.
- 호스트 매니페스트 수정. 세 매니페스트가 `skills/` 디렉터리를 통째로 가리키므로
  새 스킬 디렉터리는 등록 없이 잡힌다.

## One-commit justification
- 한 커밋이 아니라 넷이다. 설정 표면을 여는 일(`schema` · `init` · 설정 문서),
  루프 스킬 자체를 쓰는 일, 워크플로 서술을 여섯 단계로 맞추는 일, 디버거 상한을
  내리는 일은 각각 따로 되돌릴 수 있고 리뷰의 종류가 다르다. 특히 세 번째는
  docs-only라 코드 변경과 섞으면 diff가 읽히지 않고, 네 번째는 수동 경로의
  동작을 바꾸므로 루프 신설과 분리해야 되돌릴 자리가 분명해진다. blueprint는
  그대로 PR 하나다.

## Documents
* [Tasks 001](tasks/001/tasks.md) - autonomy 설정 표면 등록
* [Tasks 002](tasks/002/tasks.md) - /bouncer-run 스킬 신설
* [Tasks 003](tasks/003/tasks.md) - 워크플로 서술을 여섯 단계로 정렬
* [Tasks 004](tasks/004/tasks.md) - debugger 재디스패치 상한을 1회로 통일
<!-- explain.md는 plan scaffold에 포함되지 않습니다. /bouncer-finalize가 작성합니다. -->
