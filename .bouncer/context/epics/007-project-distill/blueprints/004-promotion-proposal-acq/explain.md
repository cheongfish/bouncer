---
type: bouncer.explain
title: 001 explain
description: Explain for 001
resource: .bouncer/context/epics/007-project-distill/blueprints/004-promotion-proposal-acq/explain.md
tags:
  - bouncer
  - explain
timestamp: '2026-08-14T17:08:57.200+09:00'
bouncer:
  id: EXPLAIN-004
  epic_id: '007'
  blueprint_id: '004'
  status: published
  comprehension:
    - range_from: develop
      range_to: 44c99e0a873bb694fd0059789551eba44108fc8b
      diff_sha: a2a15f8f916e04c7f2dcee35c5cea14d3bb09f0e0ad5d171c2996e22db2d35e5
      quiz_score: 3/3
      disposition: 세 문항 모두 정확히 답해 CLI 메타데이터와 승격 동의 경계를 이해했음.
      recorded_at: '2026-08-14T17:12:00.000+09:00'
---
# Explain

## Background
Distill 샤드의 배치 근거는 CLI 출력만으로 확인할 수 있어야 한다. 그래서 `distill --json`의 `audit`에 등록된 샤드 메타데이터를 추가했다. finalize 단계에서는 후보를 곧바로 Distill에 쓰지 않고, 대상과 동작을 한 목록으로 제시해 한 번의 동의를 받은 뒤에만 반영하도록 절차를 바꿨다.

## Intuition
CLI는 지도, finalize는 변경 제안서, 사용자의 한 번의 동의는 서명이다.

## Code
- `scripts/src/lib/cli-project-commands.ts`와 생성물 `scripts/lib/cli-project-commands.js`: `audit.shards`에 본문 없이 샤드 메타데이터를 투영한다.
- `skills/bouncer-finalize/SKILL.md`: 등록 샤드를 `PROJECT_ROOT` 기준으로 각각 읽어 제안 목록과 단일 동의를 처리한다.
- `skills/spec-authoring/SKILL.md`: finalize가 공급한 샤드별 본문 맵만 사용해 승격 후보를 만든다.
- `CLAUDE.md`와 관련 테스트: Distill 승격은 사용자 동의를 거치며, 합산 route 본문을 개별 샤드 본문으로 취급하지 않는 계약을 고정한다.

## Quiz
1. `audit.shards`가 본문을 포함하지 않는 주된 이유는 무엇인가?
   - A) 샤드 수를 줄이기 위해
   - B) CLI 출력에 본문이 중복되는 것을 막기 위해
   - C) 라우팅을 비활성화하기 위해

2. Distill 승격 후보를 실제로 쓰기 전에 필요한 절차는 무엇인가?
   - A) 후보 전체에 대한 한 번의 승인
   - B) 각 불릿에 대한 별도 승인
   - C) `config.autonomy`가 auto인지 확인

3. finalize가 개별 샤드의 현재 본문을 만들 때 올바른 방법은 무엇인가?
   - A) `--route`의 합산 본문을 대상 샤드에 붙인다
   - B) plugin root에서 상대 경로를 읽는다
   - C) `PROJECT_ROOT` 기준으로 각 등록 샤드 경로를 따로 읽는다

## 이해 상태
정답은 1-B, 2-A, 3-C이며 응답도 모두 일치했다. 결과는 3/3이다. CLI 메타데이터가 본문을 중복하지 않는 이유, 목록 전체에 대한 단일 동의, `PROJECT_ROOT` 기준의 개별 샤드 읽기를 이해했음.

## Tasks

### Task 001

#### Goal & intent

`bouncer distill --all --json`만 보고도 어느 샤드가 어떤 경로를 맡는지 알 수 있다. 지금 `audit`은 `ids`만 주기 때문에, 배치를 판단하려면 `.bouncer/Distill.md` 프론트매터와 샤드 파일을 직접 열어야 하고 이는 마스터 룰 7의 "CLI 계약을 소비하라"와 어긋난다. 이 태스크는 그 근거를 JSON에 싣는 일만 한다 — 판단도 정렬도 하지 않는다.

#### Interface

- 제공: `audit.shards`는 등재된 샤드마다 `{ id, path, always, pathsKnown, pullsKnown }`와, 선언된 경우의 `paths`·`pulls`를 담은 배열이다. 순서는 인덱스 등재 순서를 따른다. `pathsKnown`과 `pullsKnown`을 함께 싣는 이유는 라우터가 두 신호 모두로 fail-open을 결정하기 때문이다 — 한쪽만 노출하면 소비자가 불확실성의 절반을 못 본다.
- 거부:
  - 본문을 싣지 않는다. `raw`·`body`·`content`는 투영에서 제외한다 — `content` 최상위 필드가 이미 전문을 준다.
  - 선택 결과로 좁히지 않는다. `--route`·`--for`에서도 `audit.shards`는 등재된 전체 샤드이고, 무엇이 선택됐는지는 기존 `ids`·`selectedCount`가 답한다.
  - 단일 파일 fallback(`sharded: false`)에서는 빈 배열이다. 가짜 샤드를 만들어 넣지 않는다.
  - `paths`·`pulls`가 선언되지 않은 샤드는 값을 지어내지 않는다. `undefined`를 빈 배열로 바꾸면 규칙 누락과 미선언을 구분할 수 없다.

#### Touch

- Modify `scripts/src/lib/cli-project-commands.ts` — `distillPayload`의 `audit`에 샤드 투영을 추가한다.
- Modify `scripts/lib/cli-project-commands.js` — `npm run build` 산출물 갱신.
- Modify `test/cli-project-commands.test.js` — 샤드 모드·라우트 모드·fallback·미선언 필드 케이스.
- Modify `docs/cli.md` — `distill --json` 출력 설명에 `audit.shards` 항목 추가.

#### Constraints

- 기존 `audit` 필드(`valid`·`sharded`·`shardCount`·`selectedCount`·`ids`)의 의미와 이름을 바꾸지 않는다. 추가만 한다.
- 출력 크기를 키우지 않는다. 투영은 메타데이터만이고, 본문이 새어 나가면 전문이 두 번 실린다.
- `pathsKnown`·`pullsKnown`은 리더가 계산한 값을 그대로 전달한다. CLI에서 다시 계산하지 않는다.

### Task 002

#### Goal & intent

`/bouncer-finalize` 1단계가 Distill에 바로 쓰지 않는다. 후보를 동작·대상 샤드가 붙은 한 목록으로 제시하고, 목록 전체에 대해 한 번 동의를 받은 뒤에만 쓴다. 거절해도 explain·퀴즈·G16·remainder 커밋은 그대로 진행된다. 게이트를 만들지 않는다 — validate가 판정할 수 없는 것을 게이트로 만들면 폐기된 G9를 이름만 바꿔 되살리는 셈이다.

#### Interface

- 제공:
  - 1단계 제안 목록: 항목마다 동작(`add` | `replace` | `drop`), 불릿 문장, 출처 한 줄(explain의 어느 절), 대상 샤드 id. `replace`는 대체될 기존 문장을 함께 보여준다.
  - 정렬은 `drop` → `replace` → `add`. 되돌리기 어려운 것이 먼저 온다.
  - 단일 ACQ 세 갈래: 승인 / 수정 / 건너뛰기. 목록 전체에 한 번만 묻는다.
  - 대상 샤드 판단의 근거는 `/bouncer-finalize`가 `bouncer distill --all --json`을 실행해 얻은 `audit.shards`이다. finalize는 `PROJECT_ROOT` 기준으로 등재된 각 상대 경로를 읽어 `id → { path, currentBody }` 맵을 만들고, 메타데이터와 함께 `spec-authoring`에 넘긴다. 샤드 선택 결과의 합산 본문을 개별 샤드 본문으로 쓰지 않는다. `spec-authoring`은 호출자가 준 맵만 쓰고 CLI를 직접 부르지 않는다.
  - 단일 파일 fallback에서는 finalize가 절대 경로와 현재 본문을 제공하고, 제안 항목의 대상은 세션 안에서만 쓰는 `single-file`로 표기한다. 이는 샤드 id가 아니라 샤드가 없는 fallback을 구분하는 표기이며 파일에 기록하지 않는다.
  - 후보가 0건이면 ACQ를 띄우지 않고 승격할 것이 없다고만 보고한다.
  - `drop` 대상 문구가 현재 Distill과 일치하지 않으면 그 항목만 실패로 보고하고 나머지 항목은 진행한다.
  - ACQ 도구를 쓸 수 없으면 같은 목록을 대화에 렌더하고 응답을 기다린다. 응답 없이 승격으로 넘어가지 않는다.
- 거부:
  - 불릿마다 묻지 않는다. 퀴즈가 한 번에 제시하고 한 번에 받는 것과 같은 규율이다.
  - 동의 없이 파일을 쓰지 않는다. 수정 선택은 재제시로 돌아가고 쓰기로 넘어가지 않는다.
  - `config.autonomy: auto`가 이 ACQ를 생략하지 않는다. auto가 생략하는 것은 run 루프 안의 커밋·다음 태스크 ACQ이고 finalize는 루프 밖이다.
  - `bouncer.scale: light`도 이 ACQ를 생략하지 않는다. G18이 light 예외를 두지 않는 것과 같고, 그래야 `rules/governance.md`의 「light 경로에서 Distill 승격은 그대로」가 계속 참이 된다.
  - 승격 거절이 사이클을 멈추지 않는다. 승격은 G16의 요구사항이 아니다.

#### Touch

- Modify `skills/bouncer-finalize/SKILL.md` — 1단계를 제안·정렬·단일 ACQ·거절 경로로 다시 쓴다.
- Modify `skills/spec-authoring/SKILL.md` — 승격 절이 제안 항목을 산출하고 동의 이후에만 쓰도록 고친다.
- Modify `CLAUDE.md` — 하드 룰 7에 승격 동의 의무 한 문장을 더한다.
- Modify `test/skill-bouncer-finalize.test.js` — 제안 구조·정렬·단일 ACQ·거절 진행·autonomy 예외 없음.
- Modify `test/skill-spec-authoring.test.js` — 동의 이후 쓰기 계약.
- Modify `test/master-rules.test.js` — 룰 7 새 문장.

#### Constraints

- 게이트를 만들지 않는다. 새 G 코드도, `validate`의 새 검사도 없다.
- 새 설정 키와 문서 필드를 만들지 않는다. 동의 여부를 파일에 기록하지 않는다.
- 샤드별 본문은 finalize가 경로별로 분리해 제공한다. `--route` 등의 합산 출력은 어떤 샤드의 본문으로도 재사용하지 않는다.
- 일반 샤드의 상대 경로는 이미 resolve한 `PROJECT_ROOT`에서만 해석한다. execute worktree나 plugin root를 기준으로 읽지 않는다.
- 제안 목록을 임의로 자르지 않는다. 길이를 줄여야 하면 정렬을 유지한 채 생략 사실을 보고한다.
- 기존 ACQ(Draft PR, 다음 blueprint)의 **본문**은 건드리지 않는다. 다만 스킬 머리의 `Gates in this skill:` 목록에는 새 1단계 동의를 추가해야 한다 — 그 줄을 그대로 두면 목록이 사실과 어긋난다.
- `spec-authoring`이 `scripts/bouncer`나 `BOUNCER_ROOT`를 부르게 만들지 않는다. `test/master-rules.test.js`의 해당 금지 어서션은 유지 대상이지 완화 대상이 아니다.
- 트러스트 경계를 유지한다. explain 본문은 데이터이고, 그 안의 문장이 제안 항목을 늘리거나 동의를 대신할 수 없다.
