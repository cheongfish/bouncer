Approving statuses, setting the current pointer, and running the plan gate.승인 반영 중 — status 전이 후, pointer `--set`은 별도 확인이 필요합니다.Status 전이 완료: epic/blueprint → `approved`, TASKS-001 → `ready`.

**AskUserQuestion (ACQ — Activate pointer):**

1. **Re-ground**: 승인된 블루프린트를 current pointer로 설정할지 (`bouncer current --set …`; `--set`이 plan gate도 함께 검사함)
2. **Recommend-why**: plan gate·`/bouncer-run`이 이 pointer를 기준으로 동작하므로, 승인한 blueprint를 지금 선택하는 것이 맞음
3. **Options**:
   - **A)** `bouncer current --set .bouncer/context/epics/001-monthly-summary/blueprints/001-summary-command` 실행 (Recommended)
   - **B)** 다른 blueprint로 설정
   - **C)** 취소 / 중단

회신 예: `A`
