---
type: bouncer.explain
title: closeout-record-generation explain
description: Explain for closeout-record-generation
resource: .bouncer/context/epics/finalize-closeout/blueprints/closeout-record-generation/explain.md
tags:
  - bouncer
  - explain
timestamp: '2026-10-23T11:41:13.812+09:00'
bouncer:
  id: EXPLAIN-closeout-record-generation
  epic_id: finalize-closeout
  blueprint_id: closeout-record-generation
  status: published
  comprehension:
    - range_from: 871e2d9c79eeb1472b247440a839ab43e0a0c48c
      range_to: ef9a882767469679228af71e9fc43cc743e1f251
      diff_sha: 6a0e1fd34f5a06a14c7686d4e711ecf19940d859ef248a9fa270beda8762ff0b
      recorded_at: '2026-10-23T12:13:32+09:00'
  task_commits:
    - task: finalize-closeout/closeout-record-generation/001
      sha: 6c9c1911
      intent_anchor: task-001
    - task: finalize-closeout/closeout-record-generation/002
      sha: ebb217d2
      intent_anchor: task-002
    - task: finalize-closeout/closeout-record-generation/004
      sha: ef9a8827
      intent_anchor: task-004
---
# Explain

## Background

마감(finalize) 단계에는 사람이 손으로 채우던 두 곳이 있었다. 하나는 사용자가 quiz에 답한 뒤 `explain.md`에 남기는 이해 기록(`bouncer.comprehension`)이고, 다른 하나는 draft PR 본문이다. 이해 기록은 `range_from`, `range_to`, `diff_sha`, `recorded_at`을 직접 베껴 적어야 해서 값이 어긋나기 쉬웠고, quiz 없이 기록만 만들어 낼 길도 막혀 있지 않았다. PR 본문은 매번 digest에서 사람이 다시 조립했다.

이 변경은 두 작업을 명령으로 옮긴다. 이해 기록은 사용자가 quiz에 답했다는 확인(`--confirm-quiz`)을 받은 호출만 쓰고, 현재 HEAD와 diff 해시가 digest와 맞을 때만 기록한다. PR 본문은 보존된 digest와 요약 파일에서 정해진 절 순서로 만든다. 기록이 plan 승인이나 검증을 대신하지는 않는다.

## Code

- `scripts/src/lib/finalize-comprehension.ts` — `recordComprehension`. 동의 → digest 모양 → Explain 읽기 → HEAD·`diff_sha` 일치 순으로 검사한 뒤, 임시 파일에 쓰고 rename해서 blueprint entry 하나만 교체한다. `task` 필드는 만들지 않고 Explain 본문과 다른 frontmatter는 그대로 둔다.
- `scripts/src/lib/cli-git-commands.ts` — `cmdFinalize`가 `finalize comprehension`과 `finalize pr-body`를 분기한다. flag 오류는 exit 2, 거절은 exit 1이다. 거절 reason은 `comprehension-consent-required`, `comprehension-input-invalid`, `comprehension-target-stale`이다.
- `scripts/src/lib/finalize-pr.ts` — `renderPrBody`와 `extractSummarySection`. 요약 파일의 `## 배경 · 변경 의도`, `## 주요 변경 내용` 두 절을 꺼내 쓰고, 둘 중 하나라도 없거나 비면 거절한다. 절 순서는 관련 이슈, 배경, 변경, 로직 흐름, 리뷰 포인트, 확인 방법이다. 리뷰 포인트에는 미해결 must_fix와 양수인 `drive_issues`가 한 줄로 들어간다. 요약 본문 안에서 H2를 쓰면 그 절이 거기서 끝나므로 H3 이하를 써야 한다.
- `--refresh`는 기존 유효 entry가 있을 때만 허용된다. base가 같은 후속 HEAD에서는 `range_from`을 유지하고 `range_to`, `diff_sha`, `recorded_at`을 현재 값으로 바꾼다. quiz를 건너뛰는 최초 기록 수단으로는 쓸 수 없다.
- `test/tiers.json` — 새 `comprehension.test.js`가 git 저장소와 프로세스를 띄우므로 unit 계층에서 integration 계층으로 옮겼다.
- 알려진 한계: `--blueprint` 경로가 checkout 밖으로 나가는 것은 막지 않는다. 로컬 CLI라 영향은 제한적이다.

## Quiz

1. `bouncer finalize comprehension --blueprint <dir> --digest <json>`을 `--confirm-quiz`나 `--refresh` 없이 호출하면 어떻게 되는가?
   - a) 현재 digest로 entry를 기록하고 경고만 낸다.
   - b) 파일은 바뀌지 않고 `comprehension-consent-required`로 거절되며 exit 1로 끝난다.
   - c) 사용법 오류로 보고 exit 2로 끝난다.
2. 기존 유효 entry가 있고 base가 같은 후속 HEAD에서 `--refresh`를 실행하면 entry는 어떻게 바뀌는가?
   - a) 기존 entry 뒤에 두 번째 entry가 추가된다.
   - b) `range_to`만 바뀌고 `diff_sha`와 `recorded_at`은 그대로다.
   - c) `range_from`은 유지되고 `range_to`, `diff_sha`, `recorded_at`이 현재 값으로 바뀐다.
3. PR 본문 생성에 쓰는 요약 파일에 `## 주요 변경 내용` 절이 없거나 비어 있으면 어떻게 되는가?
   - a) 렌더러가 그 입력을 거절한다.
   - b) 해당 절을 빈 채로 두고 본문을 만든다.
   - c) digest의 intent로 그 절을 대신 채운다.

## Tasks

### finalize-closeout/closeout-record-generation/001 · `6c9c1911`

#### Goal & intent

- R-X3를 사용자 확인 이후 이해 기록 메타데이터 생성로 처리한다. 성공 판정은 아래 Target behavior와 epic 성공 기준 3이다.
- 전용 검증: `node --test test/comprehension.test.js test/cli-help.test.js test/cli-help-static.test.js`. 사용자 확인을 받은 명령이며 frontmatter에 설정한다.

#### Current behavior

- 조사 HEAD: `6c20e0babef5c50e17d3617a3919367bc493c898`.
- comprehension.ts:53은 governance 경로를 제외한 변경 경로 집합 hash를 계산하고 :109는 마지막 entry를 읽는다. 기록 CLI는 없다.
- references/explain-diff/index.md:106은 {range_from,range_to,diff_sha,recorded_at} 한 항목을 수기로 쓰도록 한다.
- explain-quiz.md:13은 사용자 quiz 답변 없이는 finalize를 중단한다. refresh는 hash/prose drift만 있으면 재quiz하지 않는 기존 경로다.
- I/O: computeDiffSha:24의 git spawnSync와 exec seam, finalize-explain.ts:85,121의 readDoc/renderDoc 파일 쓰기 방식이 기존 관찰점이다.

#### Target behavior

- finalize comprehension --confirm-quiz가 현재 digest 범위에 맞는 entry를 생성하며 KST now를 직접 기록한다.
- 기록은 정확히 한 blueprint entry를 교체하고 task 필드를 만들지 않는다. 기존 Explain 본문·타 frontmatter·timestamp·published 상태는 유지한다.
- 확인 없는 호출과 stale digest·손상 입력은 파일 bytes를 바꾸지 않는다. refresh는 별도 --refresh로 기존 유효 기록이 있을 때만 허용한다.

#### Interface

- CLI: bouncer finalize comprehension --blueprint <dir> --digest <json-file> --confirm-quiz [--repo <dir>]; refresh는 --refresh를 사용하며 두 flag는 상호배타다.
- 쓰기 대상은 실행 checkout의 해당 blueprint explain.md다. digest.blueprint·range.base/head를 검증하고 현재 HEAD 및 computeDiffSha와 일치해야 한다.
- 신규 finalize-comprehension.ts 입력 {repoRoot,blueprintDir,digest,confirmed,refresh,deps?}; deps.exec(args)→{status,stdout}, deps.now()→Date, deps.fs.readFileSync/writeFileSync/renameSync를 지원한다.
- 성공 {ok:true,entry:{range_from,range_to,diff_sha,recorded_at}}; 거절 reason은 comprehension-consent-required, comprehension-input-invalid, comprehension-target-stale다. flag 오류는 exit 2, 거절은 exit 1이다.
- --refresh는 기존 유효 entry를 요구한다. base가 같은 후속 HEAD에서는 range_from을 유지하고 range_to를 검증한 digest.range.head로 바꾸며 diff_sha와 recorded_at도 현재 값으로 갱신한다. quiz를 건너뛰는 최초 기록 대체 수단으로 쓰지 않는다.

#### Touch

| 경로 | 심볼 | 변경 | 현재 책임 | 계획한 변경 | 근거 |
| --- | --- | --- | --- | --- | --- |
| `scripts/src/lib/finalize-comprehension.ts` | `신규 추출 지점: 확인 후 entry 기록` | Create | 신규 기록 소유자 | 입력/동의/범위 검증과 atomic 기록 | R-X3 명시 신규 모듈 |
| `scripts/src/lib/cli-git-commands.ts` | `cmdFinalize` | Modify | finalize CLI 분기 | comprehension 입력·consent·refresh 연결 | scripts/src/lib/cli-git-commands.ts:54 |
| `scripts/src/lib/cli-usage.ts` | `COMMAND_USAGE.finalize` | Modify | 정적 help | comprehension 사용법 추가 | scripts/src/lib/cli.ts:33 |
| `test/comprehension.test.js` | `관찰 가능한 반환·상태 단언` | Modify | 회귀 검증 | 기록·확인 누락·stale·refresh·atomic 실패 검증 | test/comprehension.test.js:64,134 |
| `test/cli-help.test.js` | `관찰 가능한 반환·상태 단언` | Modify | 회귀 검증 | 기록 명령 정적 help | test/cli-help.test.js |
| `test/cli-help-static.test.js` | `관찰 가능한 반환·상태 단언` | Modify | 회귀 검증 | 도움말의 무쓰기·lazy 계약 | test/cli-help-static.test.js |
| `references/explain-diff/index.md` | `문서 계약` | Modify | 워크플로와 계약 설명 | 수작업 metadata 대신 기록 CLI 사용 | references/explain-diff/index.md:106 |
| `skills/bouncer-finalize/references/explain-quiz.md` | `문서 계약` | Modify | 워크플로와 계약 설명 | 답변 뒤 기록·refresh 절차 연결 | skills/bouncer-finalize/references/explain-quiz.md:13 |
| `rules/cli.md` | `문서 계약` | Modify | 워크플로와 계약 설명 | 기록 명령·거절·refresh 계약 | rules/cli.md |

#### Constraints

- confirm-quiz는 실제 사용자 답변을 받은 controller만 전달한다. 이 계획 승인은 향후 finalize quiz의 동의가 아니다.
- computeDiffSha의 경로 집합 fingerprint 의미와 G16 판정은 바꾸지 않는다. 기록이 verification/plan approval을 대체하지 않는다.
- 기존 comprehension 배열 다건 읽기 호환성은 유지한다. 새 writer만 단일 entry 규칙을 적용한다.
- epic 성공 기준 3 및 5을 따른다. 한국어 주석·docstring과 condition → result 테스트 이름을 사용한다.
- 새 의존성·추상화·기능을 추가하지 않는다. 실패한 검증을 통과로 기록하거나 상태·증적을 수기로 채우지 않는다.
- TypeScript 변경 뒤 npm run build로 로컬 emit을 갱신하고 npm run check:emit로 확인한다. scripts/lib와 build stamp는 ignored 생성물이므로 수정·stage·커밋 범위에 넣지 않는다.

### finalize-closeout/closeout-record-generation/002 · `ebb217d2`

#### Goal & intent

- R-X4를 보존 digest 기반 PR 본문 초안 생성로 처리한다. 성공 판정은 아래 Target behavior와 epic 성공 기준 4이다.
- 전용 검증: `node --test test/finalize-pr.test.js test/finalize-digest.test.js test/cli-help.test.js test/cli-help-static.test.js`. 사용자 확인을 받은 명령이며 frontmatter에 설정한다.

#### Current behavior

- 조사 HEAD: `6c20e0babef5c50e17d3617a3919367bc493c898`.
- finalize-pr.ts:347의 buildPrDraft는 제목·sections 데이터를 만들지만 background/changes/flow가 null이고 Markdown renderer는 없다.
- finalize-digest.ts:151은 range와 evidence를 포함한다. prepare는 task 삭제 후 task-documents-missing이므로 보존한 digest를 PR까지 사용해야 한다.
- cmdFinalize:54는 기존 prepare/release-main/partial-finalize/links를 라우팅한다. 새 pr-body는 이들과 분리된 읽기 경로다.

#### Target behavior

- finalize pr-body는 저장 digest와 root의 한국어 요약 파일에서 검토 가능한 Markdown 초안을 stdout에 만든다.
- digest의 검증·review 근거·outside_scope·deferred must_fix·drive_issues/warnings를 누락 없이 반영한다. 실패를 통과로 요약하지 않는다.
- 같은 입력은 byte-identical 출력이며 정리 뒤 task 문서가 없어도 동작한다. PR 게시·파일 쓰기·Git 조회는 하지 않는다.

#### Interface

- CLI: bouncer finalize pr-body --digest <json-file> --summary <markdown-file> [--flow <mermaid-file>]. 성공 stdout은 Markdown, 오류 stderr와 exit 1, 사용법 오류 exit 2다.
- 요약 파일은 배경 · 변경 의도, 주요 변경 내용의 한국어 본문을 제공한다. 기존 관련 이슈/로직 흐름/리뷰 포인트/확인 방법 순서를 유지하고 근거 없는 빈 섹션은 생략한다.
- renderer는 {digest,summary,flow?} → string의 순수 함수로 finalize-pr.ts에 둔다. CLI만 파일을 읽는다. 유효 v2 digest와 필요한 range·task verification shape를 검증한다.
- 보존 digest만 사용하며 현재 task/원장/HEAD를 재조회하지 않는다. 외부 링크는 digest에 있는 것만 쓰며 경로를 URL로 발명하지 않는다.

#### Touch

| 경로 | 심볼 | 변경 | 현재 책임 | 계획한 변경 | 근거 |
| --- | --- | --- | --- | --- | --- |
| `scripts/src/lib/finalize-pr.ts` | `buildPrDraft; 신규 추출 지점: 본문 renderer` | Modify | PR 구조 생성 | 순수 Markdown 초안 생성·입력 검증 | scripts/src/lib/finalize-pr.ts:347 |
| `scripts/src/lib/cli-git-commands.ts` | `cmdFinalize` | Modify | finalize CLI 분기 | digest/요약 파일을 읽는 pr-body 연결 | scripts/src/lib/cli-git-commands.ts:54 |
| `scripts/src/lib/cli-usage.ts` | `COMMAND_USAGE.finalize` | Modify | 정적 help | pr-body 사용법 | scripts/src/lib/cli.ts:33 |
| `test/finalize-pr.test.js` | `관찰 가능한 반환·상태 단언` | Modify | 회귀 검증 | 정확한 Markdown·경고·누락·결정성 검증 | test/finalize-pr.test.js:743,809,864 |
| `test/finalize-digest.test.js` | `관찰 가능한 반환·상태 단언` | Modify | 회귀 검증 | 보존 digest와 CLI·정리 후 사용 검증 | test/finalize-digest.test.js:217,662 |
| `test/cli-help.test.js` | `관찰 가능한 반환·상태 단언` | Modify | 회귀 검증 | pr-body help 계약 | test/cli-help.test.js |
| `test/cli-help-static.test.js` | `관찰 가능한 반환·상태 단언` | Modify | 회귀 검증 | 새 help의 무쓰기·미적재 보존 | test/cli-help-static.test.js |
| `skills/bouncer-finalize/references/draft-pr.md` | `문서 계약` | Modify | 워크플로와 계약 설명 | 보존 digest·요약·선택 flow로 초안 생성 | skills/bouncer-finalize/references/draft-pr.md:6,28 |
| `rules/cli.md` | `문서 계약` | Modify | 워크플로와 계약 설명 | pr-body stdout·오류 계약 | rules/cli.md |
| `CHANGELOG.md` | `문서 계약` | Modify | 워크플로와 계약 설명 | 기록 CLI와 PR 초안 Unreleased 기록 | 프로젝트 기여 규칙: Unreleased |

#### Constraints

- 외부 gh/glab·push·publish는 호출하지 않는다. root의 최종 내용 검토와 게시 동의를 그대로 유지한다.
- 기존 buildPrDraft 구조·PR 제목·merge target·draft 기본값을 바꾸지 않는다. renderer의 출력 형식은 요구된 산출물 계약으로 정확한 문자열을 단언한다.
- epic 성공 기준 4 및 5을 따른다. 한국어 주석·docstring과 condition → result 테스트 이름을 사용한다.
- 새 의존성·추상화·기능을 추가하지 않는다. 실패한 검증을 통과로 기록하거나 상태·증적을 수기로 채우지 않는다.
- TypeScript 변경 뒤 npm run build로 로컬 emit을 갱신하고 npm run check:emit로 확인한다. scripts/lib와 build stamp는 ignored 생성물이므로 수정·stage·커밋 범위에 넣지 않는다.

### finalize-closeout/closeout-record-generation/003

#### Goal & intent

모든 구현 task가 integrated인 integration checkout에서 전체 CI를 실행하여 마감 이해 기록과 PR 본문 초안 자동 생성의 종단 호환성을 확인한다.

#### Current behavior

선행 구현 task는 각각 전용 검증을 수행한다. 이 task가 정상 경로에서 첫 전체 CI를 담당한다.

#### Target behavior

- 성공: 실제 실행 증적을 verification runner가 기록한 뒤에만 integrated가 된다.
- 실패: verifying 상태와 원본 증적을 유지하며 coordinator가 원인을 분류한다.

#### Interface

- 제공: 선행 구현이 모두 통합된 뒤 전체 검증을 한 번 실행하여 남기는 증적.
- 거부: source 변경, review 문서 작성, task commit, 실패 증적의 수작업 수정.

#### Touch

Source 변경 경로 없음.

#### Constraints

- 검증 명령은 frontmatter verify 한 곳에서 소유한다. 전체 CI를 구현 task에 복사하지 않는다.
- 환경 오류와 scope 안팎의 코드 오류를 구별한다. 이 task에서 직접 repair하지 않는다.

### finalize-closeout/closeout-record-generation/004 · `ef9a8827`

#### Goal & intent

기록된 terminal CI 실패를 복구한다.

#### Interface

- 제공: 실패 command와 관련 경로를 통과시키는 최소 수정
- 거부: Blueprint 밖 scope와 새 기능

#### Touch

- Modify `test/tiers.json` — 기록된 CI 실패를 복구한다.

#### Constraints

- 원장의 실패 증적과 repair 결정 범위만 따른다.