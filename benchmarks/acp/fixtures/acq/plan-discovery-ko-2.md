Open decisions는 권장안으로 확정했습니다. Discover 프레이밍을 정리한 뒤 확인을 요청합니다.**Open decisions** (권장안 채택 · 이번 항목만 대리 판단)

| # | 결정 | 근거 |
|---|------|------|
| 1 | **A** — 헤더/스트림이 이미 시작된 뒤 타임아웃이면 `request.signal`만 abort하고 두 번째 503은 보내지 않음 | PRD의 “응답은 한 번만”·협조적 타임아웃과 `reply.sent` 가드에 맞고, 부분 스트림에 503을 얹으면 프로토콜이 깨짐 |
| 2 | **A** — 먼저 reply를 claim한 쪽이 이김; 정상 send 시 타이머 동기 clear; 이미 sent면 타임아웃 no-op | 기존 `reply.sent` / `FST_ERR_REP_ALREADY_SENT` 패턴과 동일 |
| 3 | **A** — `handlerTimeout`은 `onTimeout`을 호출하지 않음 | `onTimeout` 문서·구현이 `connectionTimeout`(소켓) 전용; 의미를 넓히면 기존 훅 동작이 바뀜 |
| 4 | **A** — 서버 옵션은 `connectionTimeout`/`requestTimeout`과 같이 AJV `integer` 검증 | PRD가 서버용 전용 오류 코드를 정하지 않았고, 형제 옵션과 init 경로를 맞추는 편이 안전함 |

---

### Discovery framing

**Goal**  
Keep-alive 연결에서도 느린 라우트 하나를 애플리케이션 단위로 끊을 수 있도록, 서버/라우트 `handlerTimeout`과 lazy `request.signal`을 추가한다.

**Scope**
- 서버 옵션 `handlerTimeout`(정수 ms, 기본 `0` = 없음) → 라우팅~직렬화 전 생애주기에 적용; 만료 시 `FST_ERR_HANDLER_TIMEOUT`(503, `Request timed out.`) + signal abort
- 라우트 옵션 `handlerTimeout`(양의 정수만; 무효 값은 `FST_ERR_ROUTE_HANDLER_TIMEOUT_OPTION_NOT_INT`); 라우트 값이 서버 값보다 우선; 서버 값이 있을 때 라우트가 `0`으로 끌 수 없음
- `fastify.initialConfig.handlerTimeout`, `request.routeOptions.handlerTimeout`, lazy `request.signal`(`AbortSignal`; 타임아웃 vs 클라이언트 끊김을 `reason.code`로 구분)
- hijack / 응답 종료 / 스트림 종료 시 타이머 정리; 404·`setNotFoundHandler` 제외
- 오류 코드 등록, TS 타입, Server/Routes/Request/Errors/Lifecycle·Hooks 문서(`connectionTimeout`·`requestTimeout` 차이 포함)
- 단위·타입 테스트; `build:validation`으로 config validator 재생성

**Non-goals**
- `connectionTimeout` / `requestTimeout` / 소켓 `onTimeout` 의미 변경
- 타임아웃 후 핸들러 강제 중단(비협조적 cancel)
- 404 핸들러에 타임아웃 적용
- 버전 bump / 릴리스 노트 자동화

**Success criteria**
1. 서버·라우트 `handlerTimeout`이 PRD대로 동작하고, 만료 시 503 + `FST_ERR_HANDLER_TIMEOUT`이 라우트 `errorHandler`를 거친다
2. 라우트 옵션 검증·상속·`initialConfig` / `routeOptions` 노출이 PRD와 일치한다
3. `request.signal`이 lazy이고, 타임아웃/`AbortError`를 `reason.code`로 구분한다
4. hijack·응답/스트림 종료·404 제외·단일 응답 불변식이 지켜진다
5. 타입·문서가 갱신되고, 기존 테스트·동작이 깨지지 않는다(`npm run test:ci` 등)

**Edge cases & failure modes**
- 핸들러와 타임아웃 동시 완료 → 단일 응답(결정 2A)
- 스트림/헤더 전송 중 타임아웃 → signal만 abort(결정 1A)
- 라우트 `0`/음수/소수/문자열 → 등록 시 거절
- 서버 `handlerTimeout > 0`일 때 라우트가 끄기 불가
- `handlerTimeout: 0`이어도 signal은 클라이언트 끊김에 abort
- hijack 시 타이머 해제 후 응답은 핸들러 책임

**Overlap**  
기존 epic/blueprint 없음. `bouncer intent`는 `routeHandler`/`handleRequest`/`validateBodyLimitOption` 등 `unlinked`/`unresolved` — 재사용할 Explain 제약 없음. 인접 패턴: `bodyLimit` 라우트 검증, `connectionTimeout`/`requestTimeout` init, `onRequestAbort`, `reply.hijack`.

**Open decisions** — 위 표(1A–4A), 사용자 위임으로 확정.

**Project rules**
- 동작 변경에는 테스트 필요; CI green (`npm run test` = lint+unit+typescript; CI는 unit+typescript)
- 서버 옵션 추가 시 `build/build-validation.js` 수정 후 `npm run build:validation`로 `lib/config-validator.js` 재생성(무결성 검사 있음)
- 오류 코드는 `lib/errors.js` + `types/errors.d.ts` + `docs/Reference/Errors.md` (+ `test/internals/errors.test.js` 관례)
- API 문서(Server/Request/Routes/Hooks·Lifecycle) 반영; PR에서 버전 bump 금지

---

**AskUserQuestion — plan.discovery**
<!-- acq {"gate":"plan.discovery","options":["A","B","C"],"recommended":"A"} -->

1. **Re-ground**: Goal / Scope / Non-goals / Success criteria / Edge cases / Overlap / Open decisions / Project rules 확인
2. **Recommend-why**: PRD와 코드 근거가 맞고, 열린 세부 사항은 권장안(1A–4A)으로 닫혀 다음 단계(ID·scaffold)로 가기 충분함
3. **Options** (recommended-first):
   - A) Confirm discovery framing and proceed to scaffold (Recommended)
   - B) Revise framing (say what to change)
   - C) Cancel planning