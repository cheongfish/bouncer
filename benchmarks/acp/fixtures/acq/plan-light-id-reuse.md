Discovery confirmed. Next are the Step 2 decisions.

---

**AskUserQuestion (ACQ — Light scope):**

1. **Re-ground**: 이 작업을 narrow-scope **light**로 갈지, 기본 **full**로 갈지
2. **Recommend-why**: CLI 파싱·집계 함수·테스트가 한 PR에 묶이고 공개 인터페이스·오류 계약이 있어 `full`(context-review 포함)이 맞음. Light는 Interface/Do not touch·context-review가 빠짐
3. **Options**:
   - **A)** Full scale (Recommended)
   - **B)** Light scale (maintenance epic에 blueprint만)
   - **C)** Cancel

---

**AskUserQuestion (ACQ — ID allocation):**

1. **Re-ground**: epic/blueprint id를 어떻게 잡을지
2. **Recommend-why**: 동일 PRD용 draft `001-monthly-summary` / `001-summary-command`가 이미 있어 재사용이 중복 scaffold를 피함. 신규면 inspect 제안은 epic `002`
3. **Options**:
   - **A)** Reuse existing `001-monthly-summary` / `001-summary-command` (Recommended)
   - **B)** New epic — reply with id/slug (default suggestion: `002` + your slug)
   - **C)** Reuse epic `001` but new blueprint id/slug
   - **D)** Cancel

Reply with Light choice (**A**/**B**/**C**) and ID choice (**A**/**B**/**C**/**D**), e.g. `Light: A, ID: A`.
