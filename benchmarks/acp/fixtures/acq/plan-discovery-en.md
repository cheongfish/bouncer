Open decisions 권장안을 기록한 뒤, Discover 확인 게이트를 올립니다.

**Open decisions (권장안 채택)**

| # | Decision | Choice | Rationale |
|---|----------|--------|-----------|
| 1 | Server `handlerTimeout` negatives | **B** — schema `minimum: 0` | `0` = no timeout; negatives have no meaning for an app timer. Route already requires positive ints; server should not allow `-1` while forbidding route `0` when a server value is set. |
| 2 | Timeout vs disconnect race | **A** — first abort wins | Matches `AbortController` / `AbortSignal` (reason is fixed on first abort). No special preference logic. |
| 3 | `onTimeout` hook | **A** — do not run for `handlerTimeout` | `onTimeout` is socket/`connectionTimeout` hang-up (no response). Handler timeout must send 503 via the error handler; keep paths separate. |
| 4 | `Detecting-When-Clients-Abort.md` | **A** — update guide | `request.signal` is the new abort surface; leaving only `raw.aborted` would mislead once the feature ships. |

---

### Discovery framing

**Goal**  
Add application-level route lifecycle timeout (`handlerTimeout`) and lazy `request.signal` (`AbortSignal`) so slow handlers on keep-alive connections can be bounded and cancelled cooperatively.

**Scope**
- Server option `handlerTimeout` (ms integer, default `0` = off; reject negatives; expose on `fastify.initialConfig.handlerTimeout`)
- Route option `handlerTimeout` (positive int only; overrides server; cannot disable when server > 0; readable via `request.routeOptions.handlerTimeout`)
- Timer covers post-routing lifecycle: onRequest → body parse → validation → handler → serialization; on fire: `FST_ERR_HANDLER_TIMEOUT` (503, `Request timed out.`), abort `request.signal`, route error handler may customize
- Route registration error `FST_ERR_ROUTE_HANDLER_TIMEOUT_OPTION_NOT_INT`
- Lazy `request.signal`: abort on timeout (`reason` = timeout error) or client disconnect (`AbortError`); first abort wins; zero-cost until first read
- Cleanup: response end, stream end, `reply.hijack()`; skip 404 / `setNotFoundHandler`; single response on race
- Types + docs: Server, Routes, Request, Errors, Lifecycle/Hooks; contrast with `connectionTimeout`/`requestTimeout`; update `Detecting-When-Clients-Abort.md`
- Tests for new behavior; regenerate `lib/config-validator.js` via `build:validation`

**Non-goals**
- Changing `connectionTimeout` / `requestTimeout` / socket `onTimeout` semantics
- Forcing handler async work to stop (cooperative only via `request.signal`)
- Applying timeout to 404 / `setNotFoundHandler`
- Letting a route set `handlerTimeout: 0` when server timeout is enabled
- Version bump / changelog release (maintainers own releases)

**Success criteria**
1. Server/route options behave as specified (defaults, override, validation errors)
2. Timeout yields one 503 `FST_ERR_HANDLER_TIMEOUT` through route `errorHandler`; `request.signal` aborted with that reason
3. Client disconnect aborts signal with `AbortError`; distinguishable via `signal.reason.code`
4. No timer leaks after response/hijack/stream end; 404 path unaffected
5. Types and listed docs updated; existing tests still pass
6. `npm run build:validation` keeps `config-validator` in sync; CI green (`lint` / unit / typescript / coverage)

**Edge cases & failure modes**
- Handler finishes at same moment as timeout → only one response
- Timeout with `handlerTimeout: 0` → no timer; signal still works for disconnect
- Hijack / stream → timer cleared; handler owns response after hijack
- Invalid route option → registration throw, no route installed
- Server negative / non-integer → init validation failure (`FST_ERR_INIT_OPTS_INVALID`)
- Timeout vs disconnect race → first abort wins

**Overlap**  
No existing epics under `.bouncer/context/epics/`. Related symbols (`routeHandler`, `validateBodyLimitOption`, `processOptions`, `handleRequest`, `Request`) have no intent/Explain provenance (`unlinked`/`unresolved`). New work; pattern after `bodyLimit` route validation and existing timeout options.

**Open decisions** — settled above (1B, 2A, 3A, 4A).

**Project rules**
1. Behavior change needs tests; PR must keep CI green (`npm run lint`, `npm run unit`, `npm run test:typescript`; coverage 100% via `coverage:ci-check-coverage`)
2. Options schema changes: edit `build/build-validation.js`, run `npm run build:validation` (do not hand-edit `lib/config-validator.js`)
3. No version bump in PRs (CONTRIBUTING)
4. Pre-merge / local verify signal: `npm test` (lint + unit + typescript) — also `config.verify`

---

**AskUserQuestion — plan.discovery**
<!-- acq {"gate":"plan.discovery","options":["A","B","C"],"recommended":"A"} -->

1. **Re-ground**: Confirm Goal / Scope / Non-goals / Success criteria / Edge cases / Overlap (with open decisions as recorded).
2. **Recommend-why**: Framing matches the PRD; open details use AbortSignal-native and socket-`onTimeout`-separated choices so implementation stays coherent with existing Fastify timeouts.
3. **Options**:
   - A) Confirm discovery framing as written (Recommended)
   - B) Revise — reply with what to change
   - C) Cancel planning