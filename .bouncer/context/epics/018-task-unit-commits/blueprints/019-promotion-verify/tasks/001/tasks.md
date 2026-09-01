---
type: bouncer.tasks
title: Distill 불릿 감사를 샤드 파일 유도값으로 바꿈
description: 손으로 고정한 sha256 목록을 제거하고 기대값을 샤드 파일에서 유도한다
resource: .bouncer/context/epics/018-task-unit-commits/blueprints/019-promotion-verify/tasks/001/tasks.md
tags:
  - bouncer
  - tasks
timestamp: '2026-08-22T14:16:25.821+09:00'
bouncer:
  id: TASKS-001
  epic_id: '018'
  blueprint_id: '019'
  status: verified
  commit_intent:
    - Distill 승격 때마다 고정 해시 목록을 손으로 갱신해야 해서 CI가 매번 깨짐
    - 기대값을 샤드 파일에서 유도해 감사가 승격에 따라 스스로 따라오게 함
  affected_paths:
    - test/distill.test.js
  scope_evidence:
    producer: graphify
    generated_at: '2026-08-22T15:05:00+09:00'
    suggested_paths:
      - test
      - .bouncer/context/epics/037-distill-promotion-consent
      - .bouncer/context/epics/044-finalize-evidence
    basis:
      - graph: source
        status: reused
        query: finalize verify command before staging distill promotion bullet audit test
        result: 3 hits — test/finalize.test.js, test/cli-project-commands.test.js, test/seed-worktree.test.js
      - graph: context
        status: updated
        query: finalize verify distill promotion benchmark protocol
        result: 3 hits under .bouncer/context/epics/037-distill-promotion-consent and 044-finalize-evidence
---
# Tasks

Blueprint: [019](../../index.md)

## Goal & intent
`test/distill.test.js`의 불릿 감사가 사람이 유지하는 상수 목록 대신 저장소의 Distill
샤드 파일에서 기대값을 유도한다. 감사가 지키려는 것은 「샤드를 읽어 렌더한 결과가
샤드 파일이 실제로 담은 불릿 집합과 같고, 라우팅이 꺼졌을 때 선택 결과도 그와 같다」는
불변식이다. 승격으로 불릿이 늘거나 바뀌어도 이 불변식은 그대로이므로, 목록을 손으로
고치는 단계가 사라진다.

`ORIGINAL_BULLET_HASHES`가 원래 담던 「샤딩 이전 원본 불릿을 하나도 잃지 않았다」는
1회성 이관 감사는 이미 승격분이 손으로 덧붙으면서 성립하지 않는다. 이 task는 그
소급 감사를 되살리지 않고, 지금 지킬 수 있는 불변식으로 대체한다. 대신 샤드 본문이
바뀌었다는 사실 자체는 더 이상 해시로 고정되지 않는다 — 본문 판정은 finalize의
승격 동의와 diff 리뷰가 맡는다.

## Interface
- 제공: `test/distill.test.js`가 `.bouncer/Distill.md`의 `distill.shards` 목록을 읽어
  각 `.bouncer/distill/<id>.md` 본문에서 기대 불릿 해시 집합을 유도하고, 이를
  `renderShards(state)`와 라우팅 비활성 선택 렌더 결과에 각각 대조한다.
- 거부: 상수로 고정된 기대 해시 목록. 파일에 `ORIGINAL_BULLET_HASHES`가 남아 있으면
  이 task는 완료가 아니다. 유도 집합이 비어도 통과하는 단언(빈 배열 대 빈 배열)도
  거부한다 — 불릿 수가 0보다 크다는 단언을 함께 둔다.
- 남는 사각지대(의도한 것): 기대값과 렌더 결과가 같은 샤드 파일에서 나오므로, 샤드
  본문이 지워지거나 잘려도 양쪽이 함께 줄어 이 감사는 통과한다. 본문 손실을
  테스트에서 잡는 수단은 이 변경 뒤 남지 않는다. 그 판정은 finalize의 승격 동의와
  diff 리뷰가 맡는다. 이 사실을 브리프 밖에서 다시 주장하지 않는다.

## Touch
- Modify `test/distill.test.js` — `ORIGINAL_BULLET_HASHES` 상수와 그 참조 두 곳을
  제거하고, 샤드 파일에서 기대 불릿 해시를 유도하는 헬퍼로 대체한다.

## Do not touch
- `.bouncer/distill/` — 샤드 본문은 승격 산출물이다. 감사를 통과시키려고 본문을
  고치면 감사가 무의미해진다.
- `.bouncer/Distill.md` — 샤드 인덱스는 이 task의 입력이지 수정 대상이 아니다.
- `scripts/src/lib/distill.ts` — 이번 변경은 테스트가 기대값을 얻는 방식만 바꾼다.
  읽기·렌더·라우팅 구현 계약은 그대로다.

## Constraints
- 기대값을 `renderShards` 출력에서 다시 유도해 자기 자신과 비교하지 않는다. 파일을
  직접 읽는 경로(프론트매터 분리 후 본문)로 유도해야 읽기·렌더 파이프라인이 감사 대상에 남는다.
- 기존 단언(`state.mode`, `state.valid`, `routing_enabled`, `state.ids` 일곱 개,
  샤드별 세 섹션 존재, `pathsKnown`/`pullsKnown`, `disabledSelection.full`)은 그대로 둔다.
- `bulletHashes` 함수의 파싱 규칙(헤딩에서 블록 종료, `- ` 시작, 후행 개행 정규화)은
  바꾸지 않는다. 파싱을 바꾸면 감사 대상 자체가 달라진다.
- 테스트 본문의 비자명한 의도는 한국어 주석으로 남긴다.

## Checklist
- [ ] `test/distill.test.js:454`의 `ORIGINAL_BULLET_HASHES` 배열을 삭제한다. 설명 주석은
      배열 위뿐 아니라 배열 **안**에도 끼어 있다(샤딩 브랜치 스냅샷 / 039-001 /
      043-002 블록). 배열과 함께 지운다.
- [ ] 샤드 파일에서 기대 해시를 유도하는 헬퍼를 추가한다. `.bouncer/Distill.md`를
      `readDoc`으로 읽어 `distill.shards`의 `id` 순서를 얻고, 각
      `.bouncer/distill/<id>.md`를 `readDoc`으로 읽어 본문만 이어 붙인 뒤
      기존 `bulletHashes`에 넘긴다.
- [ ] 유도 집합이 비지 않았음을 단언한다:
      ```js
      assert.ok(expected.length > 100);
      ```
- [ ] 렌더 대조 두 곳을 유도 집합으로 바꾼다:
      ```js
      assert.deepStrictEqual(bulletHashes(rendered), expected);
      assert.deepStrictEqual(
        bulletHashes(renderShards({ ...state, selection: disabledSelection })),
        expected,
      );
      ```
- [ ] 렌더가 등록된 샤드를 하나라도 빠뜨리면 대조가 걸리는지 고정한다:
      ```js
      // 이 단언이 지키는 것은 "렌더·라우팅이 등록된 샤드를 다 싣는가" 하나다.
      // 샤드 본문 자체가 줄면 기대값도 함께 줄어 잡히지 않는다 — 의도된 사각지대.
      const dropped = { ...state, shards: state.shards.slice(1) };
      assert.notDeepStrictEqual(bulletHashes(renderShards(dropped)), expected);
      ```
- [ ] `grep -n "ORIGINAL_BULLET_HASHES" test/distill.test.js`가 아무것도 내지 않는지 확인한다.
- [ ] `npm test`가 통과한다.
