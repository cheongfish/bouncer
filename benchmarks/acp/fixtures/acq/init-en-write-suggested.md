I'll look up the `/bouncer-init` skill and follow it for this PRD.Reading the bouncer plugin rules, then running init.Resolving the plugin root and running `bouncer init`.Checking the generated config and whether branch resolution needs a decision.Setting `subagents.provider` to `cursor` as requested, then presenting the required consent gates.**완료: bouncer init** · 생성: `.bouncer/config.json`, `.bouncer/context/index.md` · Graphify: 설치됨 (`graphify-out/` 후보) · `subagents.provider`: `cursor` · Branch: `main` 이미 설정됨(질문 불필요) · Promotion: 해당 없음

PRD는 보관만 해 두었습니다. epic/blueprint는 `/bouncer-plan`에서 작성합니다.

---

**AskUserQuestion:**

1. **Re-ground**: `.gitignore`에 Bouncer 권장 항목을 추가할지 결정합니다.
2. **Recommend-why**: 로컬 산출물(`node_modules/`, Graphify·worktree·venv·runtime)이 커밋에 섞이지 않게 막는 편이 안전함.
3. **Options** (recommended-first):
   - A) Write suggested `.gitignore` entries (Recommended)  
     → `node_modules/`, `graphify-out/`, `.worktrees/`, `.bouncer/.venv/`, `.bouncer/runtime/`
   - B) Leave `.gitignore` untouched
   - C) Cancel / stop here

답은 `A` / `B` / `C`로 주세요. 동의 전에는 `.gitignore`를 쓰지 않습니다.

---

동의·거절이 끝나면, 부트스트랩을 **별도 커밋**한 뒤 `/bouncer-plan`으로 넘어가세요:

```bash
git add .bouncer/config.json .bouncer/context && git commit -m "chore: bootstrap bouncer"
```

(원하면 커밋은 제가 대신 실행합니다.) 그전에 `.bouncer/config.json`의 `source_dirs` / `verify` / `base_branch` / `pr`도 수정할 수 있습니다.
