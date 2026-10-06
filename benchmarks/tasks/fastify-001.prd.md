# 핸들러 단위 타임아웃 (`handlerTimeout`)

`connectionTimeout`·`requestTimeout`은 소켓 단위라 keep-alive 연결에서 느린 핸들러 하나를 끊지
못합니다. 라우트 처리 전체에 걸리는 애플리케이션 단위 타임아웃과, 핸들러가 취소를 알 수 있는
`request.signal`을 추가해 주세요.

## 서버 옵션 `handlerTimeout`

- 정수 밀리초. 기본값은 `0`이고 `0`은 타임아웃 없음입니다.
- 라우팅부터 onRequest, 본문 파싱, 검증, 핸들러, 직렬화까지 라우트 생애주기 전체에 적용됩니다.
  그 안에 응답이 끝나지 않으면 `503 Service Unavailable` 오류 응답을 보내고 `request.signal`을
  abort합니다.
- `fastify.initialConfig.handlerTimeout`으로 설정값을 읽을 수 있어야 합니다(기본값이면 `0`).

## 라우트 옵션 `handlerTimeout`

- 라우트별로 서버 값을 덮어씁니다. 둘 다 있으면 라우트 값이 우선이고, 라우트에 값이 없으면 서버
  값을 물려받습니다. 서버 값이 있으면 라우트가 이를 끌 수는 없고 다른 양의 정수로만 바꿉니다.
- 라우트 값은 양의 정수여야 합니다. 정수가 아닌 값, 음수, 소수, `0`, 문자열은 라우트 등록 시점에
  `FST_ERR_ROUTE_HANDLER_TIMEOUT_OPTION_NOT_INT` 오류로 거절합니다.
- 핸들러 안에서 `request.routeOptions.handlerTimeout`으로 그 라우트에 적용되는 값(라우트 값,
  없으면 서버 값)을 읽을 수 있어야 합니다.

## 타임아웃 오류

- 타임아웃 오류 코드는 `FST_ERR_HANDLER_TIMEOUT`, 상태 코드 503, 메시지는 `Request timed out.`입니다.
- 이 오류는 라우트의 에러 핸들러를 거칩니다. 라우트별 `errorHandler`로 상태 코드나 본문을 바꿀 수
  있어야 합니다.
- 라우트 옵션 오류 `FST_ERR_ROUTE_HANDLER_TIMEOUT_OPTION_NOT_INT`의 메시지는
  ``"`handlerTimeout` option must be a positive integer."``입니다.
- 두 오류 코드는 기존 오류 코드와 같은 방식으로 등록하고 문서의 오류 목록에 넣습니다.
- 핸들러가 타임아웃과 거의 같은 시점에 끝나도 응답은 한 번만 보내야 합니다.

## `request.signal`

- `AbortSignal`입니다. 타임아웃이 발생하거나 클라이언트 연결이 끊기면 abort됩니다.
- 타임아웃이면 `signal.reason`이 `FST_ERR_HANDLER_TIMEOUT` 오류이고, 클라이언트 연결 끊김이면 일반
  `AbortError`입니다. `signal.reason.code`로 둘을 구분할 수 있어야 합니다.
- `handlerTimeout`이 `0`이어도 `request.signal`은 쓸 수 있고, 클라이언트 연결이 끊기면 abort됩니다.
  쓰지 않는 요청에는 비용이 들지 않도록 처음 읽을 때 만듭니다.
- 타임아웃은 협조적입니다. 오류 응답을 보낸 뒤에도 핸들러의 비동기 작업은 계속 돌 수 있으며,
  핸들러가 `request.signal`을 보고 스스로 멈춥니다.

## 예외와 정리

- 스트림 응답은 응답이 끝나면 타이머를 정리합니다.
- `reply.hijack()`을 호출하면 타이머를 해제합니다. 이후 응답은 핸들러가 책임집니다.
- 404 핸들러와 `setNotFoundHandler()`로 지정한 핸들러에는 적용하지 않습니다.
- 응답이 끝나면 타이머를 남기지 않아야 합니다.

## 타입과 문서

- TypeScript 타입: 서버 옵션 `handlerTimeout`, 라우트 옵션 `handlerTimeout`,
  `request.signal`(`AbortSignal`), `request.routeOptions.handlerTimeout`, 두 오류 코드.
- 문서: 서버 옵션, 라우트 옵션, Request, 오류 목록, 생애주기·hook 문서에 동작과 예시를 반영해
  주세요. `connectionTimeout`·`requestTimeout`과의 차이도 적어 주세요.
- 기존 동작과 기존 테스트는 바뀌지 않아야 합니다.
