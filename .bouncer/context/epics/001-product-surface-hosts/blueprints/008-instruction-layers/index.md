---
type: bouncer.blueprint
title: 지시문 층 역할 헌장과 재진술 제거
description: 네 지시문 층의 역할 경계를 CLAUDE.md에 표로 세우고, 그 헌장으로 마스터 룰·core.md의 재진술을 지우며 Distill 승격이 재진술을 걸러내게 한다
resource: .bouncer/context/epics/001-product-surface-hosts/blueprints/008-instruction-layers/index.md
tags:
  - bouncer
  - blueprint
timestamp: '2026-08-31T08:39:18.895+09:00'
bouncer:
  id: '008'
  epic_id: '001'
  blueprint_id: '008'
  status: closed
  commit_type: refactor
  scale: full
  supersedes: []
---
# 008 지시문 층 역할 헌장과 재진술 제거

Epic: [001](../../index.md)

## Intent
- 문제: 지시문은 실질적으로 네 층(마스터 룰 / 워크플로 절차 / 계약 / 이 저장소에서만 참인 것)인데 경계를 정의한 문서가 없다. 그래서 같은 규칙이 여러 층에 착지한다 — 마스터 룰이 스킬을 축약 재진술하고(B14), `always: true`인 `.bouncer/distill/core.md`가 마스터 룰·`rules/`·`references/`를 네 문장 그대로 다시 말한다(B13). 승격 경로는 동의를 한 번 받을 뿐 "상위 층이 이미 말하고 있는가"를 묻지 않아 재진술이 계속 흘러든다. 같은 병의 구체적 사례로 minimality 사다리가 두 벌로 갈라져 있다(B17).
- 완료 조건: `CLAUDE.md`에 네 층 역할 경계 표가 있고, B14 표의 중복이 마스터 룰에서 포인터로 바뀌었으며, `/bouncer-finalize` 승격 제안이 재진술 후보를 제외 근거와 함께 걸러내고, `core.md` 중복 네 문장과 minimality 사다리 갈라짐이 사라진다. 각 task가 `npm run ci` 그린이다.

## Contract
- 인터페이스: `CLAUDE.md`에 `## Instruction layers` 표(층 / 담는 것 / 담지 않는 것 / 정본 위치) 추가. 하드룰 본문 중 스킬·레퍼런스가 이미 더 구체적으로(실행 가능한 셸까지) 말하는 것은 `Detail: <경로>` 포인터로 축약 — 하드룰 10이 이미 쓰는 형식이 본보기다. `skills/bouncer-finalize/references/distill-promotion.md`의 승격 제안 계약에 재진술 제외 단계와 제외 목록 표시 의무를 추가. `agents/bouncer-implementer.md`의 사다리를 정본 선언(`references/implementation/index.md:27-29`)대로 스킬과 정합.
- 데이터·상태: 문서·에이전트·테스트만 바뀐다. 게이트 코드(G/S), CLI 계약, 프론트매터 스키마, `.bouncer/config.json`은 그대로다. `bouncer.scale` Intensity 매핑은 스킬 판정 기준이지 CLI 경로가 아니라는 현행 진술을 유지한다.
- 수용 기준: task 004는 `docs/install.md`가 (1) 호스트 설치가 bin을 링크하지 않는다는 진술, (2) 실행 가능한 등록 단계, (3) 확인 명령과 실패 증상, (4) 등록 전 워크플로가 첫 줄에서 실패한다는 남은 제약을 담고 그 넷이 단언되면 끝난다. 조건 6은 **문서 계약**으로 판정한다 — `npm run ci`가 증명하는 것은 두 지시문 파일이 제외 단계와 근거 표시를 담는다는 것이고, 실제 승격 제안 실행을 관찰하지 않는다. 나머지는 에픽 성공조건 5(역할 헌장 표 + B14 중복 제거 + 갱신된 앵커로 `test/master-rules.test.js` 통과 + 하드룰 11 번호·본문 불변)와 6(승격 제안이 상위 층 재진술을 제외한 목록으로 나오고 제외 항목과 근거를 함께 보인다)을 만족한다. 추가로 `.bouncer/distill/core.md`에 B13 표의 네 문장이 없고, minimality 사다리가 스킬과 에이전트에서 같은 순서를 가진다.
- 검증 명령: `npm run ci`
- 실패 모드·엣지 케이스:
  - `CLAUDE.md` 여유가 8바이트다(6,127B / 상한 6,135B, `test/master-rules.test.js`). 표를 *더하는* 변경이므로 같은 커밋에서 회수하지 않으면 테스트가 먼저 막는다. 회수량 1순위는 하드룰 7(1,623B, 파일의 26.5%).
  - 룰 1·2·3·5·6·7·8·9·11이 `test/master-rules.test.js`의 문자열 단언에 묶여 있다. 본문을 지우면서 앵커를 옮기지 않으면 CI가 막는다 — 삭제와 앵커 갱신은 같은 커밋이다.
  - 하드룰 11은 12곳 이상이 **번호로** 인용하고 `test/master-rules.test.js`가 이 룰을 신뢰 경계 SSOT로 못박는다. 번호 재배열·삭제는 그 인용을 전부 깬다.
  - `.bouncer/distill/core.md`는 `always: true`라 삭제 효과가 모든 라우트·모든 사이클에 즉시 걸린다. 반복 `--for` 형식을 단언하는 테스트가 이 파일을 포함하므로 Distill SSOT 문장은 삭제 대상이 아니다.
  - 승격 필터는 판정을 자동 적용하지 않는다 — 제외는 제안 목록에서 빼는 것이고 근거를 함께 보여 사용자가 되돌릴 수 있어야 한다. 필터가 게이트가 되면 하드룰 3·4의 판정 주체가 바뀐다.
  - `docs/install.md`가 안내하는 `bouncer-root` PATH 등록은 호스트 설치 경로에서 성립하지 않는다 — 이 세션에서도 `command not found`로 재현됐다.

## Out of scope
- SKILL 본문·`rules/`·Distill 샤드 **합계** 바이트 상한을 CI로 잠그는 일(B6 잔여). 에픽 성공조건 5·6 밖이고 별도 회차 몫이다.
- `## When to invoke` 표 삭제. B14 표 마지막 행이 각 스킬 `description`과의 중복을 지적하지만, 이 표는 세션 진입 라우팅이고 `test/master-rules.test.js`가 구조로 잡고 있다 — 표는 유지하고 헌장에서 "라우팅 인덱스"로 자리를 명시한다.
- 하드룰 11의 번호·본문 변경, 게이트 코드 추가·삭제, Distill 라우팅 알고리즘과 CLI 계약.
- #77(description 100–180자·합계 ≤3,000)과 #80(`CLAUDE.md` ≤6,135B, 8샤드 `max_bytes`) 이 이미 닫은 예산·압축 표면의 재작업.
- `bouncer-root`를 등록 없이 해석되게 만드는 일 — 런처 폴백, 호스트 설치기 배선, `scripts/`→`bin/` 레이아웃 이동. task 004는 문서가 사실과 다른 것만 닫고, 새 호스트 설치에서 사용자가 PATH를 등록하기 전까지 여섯 워크플로가 첫 줄에서 실패한다는 사실은 남는다. 어느 쪽이 원인인지(호스트 설치기 대 저장소 레이아웃)를 가린 뒤 별도 회차에서 결정한다.
- B5 효과 입증(epic 051·052 소유)과 B7–B11·B16(blueprint 004 몫).

## One-commit justification
- 한 task = 한 커밋이고 blueprint가 PR 단위다. 네 task는 모두 "어느 층이 무엇을 말하는가"라는 한 결정에서 갈라져 나오고, 리뷰어가 헌장 표 하나를 기준으로 나머지 셋을 판정할 수 있다. task 001이 헌장을 세우고, 002가 그 헌장을 승격 경로에 배선하고, 003이 헌장 위반 잔여분을 청소하며, 004는 같은 "지시문이 사실과 다르다" 축의 설치 안내 오기를 고친다.

## Documents
* [Tasks 001](tasks/001/tasks.md) - 역할 헌장 표와 마스터 룰 재진술 축약
* [Tasks 002](tasks/002/tasks.md) - Distill 승격의 재진술 제외 단계
* [Tasks 003](tasks/003/tasks.md) - core.md 중복 제거와 minimality 사다리 정합
* [Tasks 004](tasks/004/tasks.md) - 플러그인 루트 설치 안내 정정
* [Context review](context-review.md) - 계획 문서 정합성 판정
<!-- explain.md는 plan scaffold에 포함되지 않습니다. /bouncer-finalize가 작성합니다. -->
