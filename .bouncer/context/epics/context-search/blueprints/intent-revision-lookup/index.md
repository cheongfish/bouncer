---
type: bouncer.blueprint
title: 고정 SHA 기준 함수 열거와 intent 조회 API 추가
description: Add a fixed-revision function enumeration and intent provenance lookup that read definitions, Git history, Explain and registry only from one history SHA.
resource: .bouncer/context/epics/context-search/blueprints/intent-revision-lookup/index.md
tags:
  - bouncer
  - blueprint
  - intent
  - provenance
  - git-revision
  - symbol-index
timestamp: '2026-10-31T23:08:44.832+09:00'
bouncer:
  id: intent-revision-lookup
  epic_id: context-search
  blueprint_id: intent-revision-lookup
  status: closed
  order: 44
  commit_type: feat
  scale: full
  complexity: standard
  review_scope: blueprint
  verification_policy: scoped_terminal
  review_contract: brief
---
# 고정 SHA 기준 함수 열거와 intent 조회 API 추가

Epic: [context-search](../../index.md)

## Intent
기존 `intent` 조회는 작업 트리의 정의와 Explain을 읽고 revision 없는 blame/log를 실행해서, 리뷰 중인 변경이 자기 Explain을 근거로 삼는 경로를 막을 수 없었음. 함수 전체 열거와 intent 조회가 하나의 `history_ref` SHA 트리만 읽는 내부 API를 추가하고, 기존 작업 트리 조회의 동작은 그대로 유지함.

## Contract
- 인터페이스: 호출자가 여는 공개 CLI와 dispatch는 바뀌지 않는다. 내부 모듈 API 셋을 추가한다(`export =` 모듈). 저장소 도구로 `package.json` 스크립트 둘을 더한다(아래 검증 명령).
  - `symbol-index.listDefinitionsInText({ path, bytes })`: 이름 필터 없이 한 파일의 모든 지원 함수 정의를 열거한다. 순수 함수이며 파일 시스템과 Git을 읽지 않는다.
  - `intent-revision.listDefinitionsAtRevision({ repoRoot, ref, path })`: `ref` 트리의 blob 하나를 읽어 위 열거를 적용한다.
  - `intent-provenance.resolveIntentAtRevision({ repoRoot, historyRef, symbolRef, limit? })`: 고정 SHA의 정의·blame/log·Explain·registry만으로 근거를 만든다.
- 데이터·상태: 열거 결과는 파일마다 `parsed | unsupported | parse_failed | absent` 중 하나다. `absent`는 그 SHA에 파일이 없다는 뜻이다. `unsupported`는 `reason`(`extension`, `declaration-file`, `binary`, `symlink`, `submodule`)을 싣는다. 빈 파일은 정의 0개의 `parsed`이고, 구문 실패는 `parse_failed`다. 두 상태는 섞이지 않는다.
- 조회 결과(`resolveIntentAtRevision`)는 `history_ref`(40자 SHA), `symbol_ref`, `status`(`resolved | unlinked`), `explain_docs`(그 SHA에서 파싱에 성공한 Explain 수. 읽혔으나 파싱에 실패한 문서는 세지 않는다), `registry_blob_sha`(registry blob이 있으면 깨졌어도 그 blob SHA, 없으면 `null`), `total_linked`, 후보 목록(각 후보에 `explain_blob_sha`), `projection_version`, `digest`를 싣는다. 후보 본문은 절 단위 `sections: { name, body }[]`이며 이 API는 바이트 예산으로 자르지 않는다(예산 투영은 소비자 소관).
- 같은 입력은 `canonicalJson` 직렬화 기준으로 같은 바이트를 낸다. `digest`는 `digest`를 뺀 객체의 `sha256Canonical`이다.
- 수용 기준: epic Success criteria 1이 참이다. 작업 트리 파일·HEAD·디스크의 Explain·registry를 바꿔도 같은 `history_ref` 결과는 변하지 않고, `history_ref`를 바꾸면 그 SHA의 내용대로 바뀐다. `test/symbol-index.test.js`의 기존 구문 회귀 사례 12건(`PARSEABLE_CONSTRUCTS` 표 10건과 단독 테스트 2건)과 `test/terminal-intent-provenance.test.js`가 그대로 통과한다.
- 검증 명령: `bouncer.verify`는 셸 연산자를 받지 못하는 단일 실행 명령이라(`bouncer scaffold`가 거절함) `package.json`에 `verify:files`(`npm run build && node --test`, 테스트 파일은 `--` 뒤 인자)와 `verify:bp`(`npm test && npm run typecheck && npm run lint && npm run lint:docs && npm run check:emit`, build는 `pretest`)를 더한다. 구현 task는 `npm run verify:files -- <그 시점에 존재하는 test/symbol-index.test.js test/terminal-intent-provenance.test.js test/intent-revision.test.js>`, 종단 verification task는 `npm run verify:bp`다.
- 실패 모드·엣지 케이스:
  - throw(호출 오류): `ref`가 7~40자 소문자 hex가 아니거나(`HEAD`·브랜치·`~` 표기 금지) 커밋으로 풀리지 않을 때, 저장소가 Git이 아니거나 Git 명령이 실패할 때, `path`가 저장소 상대 정규 경로가 아닐 때, `symbolRef`의 `blob_sha`·줄 범위·`qualified_name`·`kind`가 그 SHA의 정의와 일치하지 않을 때, `limit`이 1..5 정수가 아닐 때.
  - 상태로 돌려주는 정상 부재: 그 SHA에 파일이 없음(`absent`), Explain이 하나도 없음(`explain_docs: 0`이며 `unlinked`), 연결된 커밋이 없음(`unlinked`). 이름이 같은 다른 파일의 정의로 대체하지 않고, 이후에 쓰인 Explain을 가져오지 않는다.
  - 기존 `resolveSymbol`·`resolveIntentProvenance`의 입력·출력·종료 조건은 바뀌지 않는다.

## Out of scope
- `bouncer intent` 하위 명령, help, `rules/cli.md`: 소비자는 다음 blueprint(`intent-diff-cli`)다.
- snapshot 읽기, 변경 함수 추출, 순위·예산·coverage manifest, reviewer 입력과 dispatch 변경
- 이동·이름 변경 추적, 호출 간 캐시, 병렬화
- `CHANGELOG.md`와 버전 파일

## One-commit justification
- 세 코드 변경은 "결과가 `history_ref` 하나로만 정해진다"는 한 불변식을 지탱한다: 순수 열거, Git 트리 읽기 경계, 그 위의 provenance 연결. 열거만 또는 조회만 따로 병합하면 소비자가 없고 불변식을 검증할 수 없어서 한 PR로 리뷰한다. 검증 스크립트 task는 이 PR의 task 검증 명령이 의존하는 도구라 같은 PR에 둔다.
