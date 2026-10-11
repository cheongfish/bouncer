ID와 full path 확인됨. 스캐폴드한 뒤 스펙 작성 규칙을 읽고 문서 작성으로 진행합니다.커밋 단위를 구현 1개 + 검증 1개로 정리하고, 증거 수집과 verify-command ACQ를 진행합니다.검증 태스크 scaffold는 `--verify`가 필요합니다. 권장 명령을 확인한 뒤 이어서 작성합니다.`subagents.dispatch`가 `print`라 증거는 컨트롤러가 인라인으로 모읍니다. verify 명령만 확인하면 검증 태스크를 scaffold하고 본문 작성에 들어갑니다.

**AskUserQuestion — plan.verify_command**
<!-- acq {"gate":"plan.verify_command","options":["A","B","C"],"recommended":"A"} -->

1. **Re-ground**: `verifySignals`에 `package.json#scripts`가 있음. 전역 `config.verify`는 `npm test`(lint + unit + typescript). CI 테스트 잡은 `npm run test:ci`(unit + typescript)
2. **Recommend-why**: CONTRIBUTING·`package.json`의 로컬 병합 전 검증은 `npm test`라서, 블루프린트에 그 명령을 고정하는 편이 이 기능의 회귀·타입·린트를 한 번에 증명함
3. **Options** (recommended-first):
   - A) Set `bouncer.verify` to `npm test` on each task (Recommended)
   - B) Set a different single argv (reply with the command, e.g. `npm run test:ci`)
   - C) Leave unset (keep global `config.verify`)