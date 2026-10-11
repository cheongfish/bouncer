Open decisions는 권장안(A)으로 기록했습니다. Discover 확인 게이트를 진행합니다.

**Open decisions (recorded)**
1. **`onTimeout`:** A — 실행하지 않음. 기존 hook은 socket/`connectionTimeout`용이고 응답을 보내면 안 되므로, `handlerTimeout`은 error handler + `request.signal`만 사용함.
2. **`onRequestAbort`:** A — timeout abort 시 실행하지 않음. client disconnect와 `signal.reason.code`로 구분; hook 문서와 일치함.
3. **`reply.callNotFound()`:** A — 매칭된 라우트의 timer를 not-found 처리까지 유지. PRD의 404 제외는 unmatched/`setNotFoundHandler` 진입용으로 해석함.
4. **서버 옵션 검증:** A — `connectionTimeout`/`requestTimeout`과 같이 AJV `integer`(기본 `0`); 음수 전용 거절은 두지 않음.

---

### Discovery framing

**Goal**  
Keep-alive에서도 느린 라우트 하나만 끊을 수 있도록, 라우트 생애주기 전체의 애플리케이션 `handlerTimeout`과 협조적 취소용 `request.signal`을 추가한다.

**Scope**
- 서버/라우트 옵션 `handlerTimeout` (서버 기본 `0`=없음; 라우트는 양의 정수로만 덮어쓰기, `0`으로 끄기 불가)
- 타임아웃 시 `503` + `FST_ERR_HANDLER_TIMEOUT`, `request.signal` abort; 라우트 `errorHandler` 경유
- 라우트 등록 시 잘못된 라우트 옵션 → `FST_ERR_ROUTE_HANDLER_TIMEOUT_OPTION_NOT_INT`
- Lazy `request.signal` (timeout 또는 client disconnect; reason으로 구분)
- `hijack`/응답 종료/스트림 종료 시 타이머 정리; 404·`setNotFoundHandler`에는 미적용
- TS 타입, 문서(Server/Routes/Request/Errors/Hooks·생애주기, 기존 timeout과의 차이), 테스트
- `initialConfig.handlerTimeout`, `request.routeOptions.handlerTimeout`

**Non-goals**
- `connectionTimeout` / `requestTimeout` / `onTimeout` 의미 변경
- timeout 시 핸들러 강제 중단(비협조적 kill)
- 버전 bump / 릴리스 노트 작성(유지자 권한)

**Success criteria**
1. 서버·라우트 `handlerTimeout`이 PRD대로 동작하고 `initialConfig` / `routeOptions`로 읽힘
2. 타임아웃·옵션 오류 코드/상태/메시지가 PRD와 같고 Errors 문서·타입에 등록됨
3. `request.signal`이 lazy이며 timeout/disconnect reason을 구분함
4. hijack·응답 종료·스트림 종료 후 타이머 누수 없음; 이중 응답 없음
5. 404 / `setNotFoundHandler`에는 미적용; 기존 timeout·기존 테스트 동작 유지
6. 문서에 옵션·Request·오류·생애주기/hook·기존 timeout 차이 반영
7. 기여 규칙: 동작 변경에 테스트 포함; merge 전 CI green (`npm run test` / CI의 unit+typescript)

**Edge cases & failure modes**
- 핸들러와 timeout 거의 동시 완료 → 응답 1회
- timeout 후에도 핸들러 async 계속 가능(협조적); signal로 중단
- `handlerTimeout: 0`이어도 signal은 client disconnect에 abort
- 라우트가 서버 timeout을 `0`으로 끄려 하면 등록 거절
- `callNotFound()` 중에도 매칭 라우트 timer 유지(Open decision 3A)
- timeout은 `onTimeout`/`onRequestAbort`를 호출하지 않음(1A/2A)

**Overlap**  
에픽 없음. Intent는 unlinked/unresolved — 재사용 Explain 없음. 신규 에픽/블루프린트로 진행.

**Open decisions** — 위 1A–4A (사용자 위임, 권장안 채택)

**Project rules**
- 동작 변경 시 테스트 필수; PR는 CI green
- `build/build-validation.js` 변경 시 `npm run build:validation`로 generated validator 재생성
- 버전 bump 금지
- Merge 전 검증 후보: `npm run test` (lint+unit+typescript); CI는 unit+typescript 분리 실행

---

**AskUserQuestion — plan.discovery**
<!-- acq {"gate":"plan.discovery","options":["A","B","C"],"recommended":"A"} -->

1. **Re-ground**: 위 Goal / Scope / Non-goals / Success criteria / Edge cases / Overlap / Open decisions / Project rules를 이 계획의 기준으로 확정할지
2. **Recommend-why**: PRD와 코드 조사·위임된 open decisions를 반영한 framing이라 이대로 스캐폴드에 들어가기 좋음
3. **Options**:
   - A) Confirm discovery framing (Recommended)
   - B) Revise (수정할 항목을 적어 주세요)
   - C) Cancel planning