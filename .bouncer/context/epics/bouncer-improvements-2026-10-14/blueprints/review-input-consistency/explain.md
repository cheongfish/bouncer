---
type: bouncer.explain
title: 001 explain
description: Explain for 001
resource: .bouncer/context/epics/bouncer-improvements-2026-10-14/blueprints/review-input-consistency/explain.md
tags:
  - bouncer
  - explain
timestamp: '2026-10-14T11:23:04.060+09:00'
bouncer:
  id: EXPLAIN-review-input-consistency
  epic_id: bouncer-improvements-2026-10-14
  blueprint_id: review-input-consistency
  status: published
  comprehension:
    - range_from: e5e5464c1ad555508998d27cc57a53480782b0fc
      range_to: f3b99d2f4f82a8a95ad2e66e06fb4e3bcc14b296
      diff_sha: 987216bdd9fe3e9f76b2d4d30655e69f4b62c303665635626fcb38faf2ac2ed4
      recorded_at: '2026-10-14T11:40:00+09:00'
  task_commits:
    - task: bouncer-improvements-2026-10-14/review-input-consistency/001
      sha: 8414f3f3
      intent_anchor: task-001
    - task: bouncer-improvements-2026-10-14/review-input-consistency/002
      sha: 2bb6f8d4
      intent_anchor: task-002
    - task: bouncer-improvements-2026-10-14/review-input-consistency/003
      sha: f3b99d2f
      intent_anchor: task-003
---
# Explain

## Background

실행 리뷰는 두 가지를 따로 계산했다. 규모 분류는 `git diff --numstat base head`로 커밋된 변경만 셌고, 리뷰어는 별도로 작업 트리를 읽었다. 그래서 아직 커밋하지 않은 변경(staged, unstaged, untracked)은 줄 수에서 빠져 리뷰가 실제보다 작게 분류될 수 있었고, 리뷰어가 본 내용과 분류가 근거로 삼은 내용이 달랐다. 또 리뷰 도중 파일이 바뀌어도 라운드를 accepted로 기록할 수 있었다.

## Intuition

리뷰 대상을 사진 한 장으로 찍어 두고, 분류도 리뷰도 승인도 그 사진 한 장만 본다. 승인할 때 현재 작업 트리가 사진과 다르면 승인하지 않는다.

## Code

- `scripts/src/lib/review-snapshot.ts`: 최종 작업 트리를 한 번 수집해 `.bouncer/runtime/review-snapshots/`에 artifact로 저장하고, 내용 해시를 `snapshot_id`로 쓴다. 저장된 artifact를 읽는 로더와 지금 상태가 같은지 보는 일치 검사도 여기에 있다. 수집 중 파일이 바뀌면 성공 artifact를 돌려주지 않는다. 소스, index, 브랜치는 건드리지 않는다.
- `scripts/src/lib/review-dispatch.ts`: `classifyExecuteReview`가 스냅샷 통계로 임계값을 판정하고 `target`에 `snapshot_id`와 `snapshot_path`를 싣는다. `head`가 현재 HEAD와 다르거나 수집이 실패하면 줄 수 0으로 접지 않고 `ok:false`를 돌려준다.
- `scripts/src/lib/review-record.ts`의 `checkSnapshotBinding`: 새 라운드에 `target.snapshot_id`가 없거나, 스냅샷의 범위·base·head가 다르면 거절한다. accepted로 기록하려면 지금 작업 트리가 스냅샷과 같아야 하고, 다르면 `review-snapshot-stale`로 거절한다. 거절은 파일을 쓰기 전에 일어난다. 저장된 문서를 검증하는 gate는 `snapshot_id`가 없는 과거 라운드도 받는다.
- `references/review/**`, 코디네이터 카드, `agents/bouncer-reviewer.md`: 리뷰어가 `git diff` 대신 `snapshot_id`가 가리키는 artifact를 읽도록 호출 지침을 바꿨다. delta 리뷰는 수정 뒤 새 스냅샷을 받는다.
- 설계상 한계: 같은 크기·같은 mtime으로 덮어쓴 파일은 수집 중 변경으로 감지하지 못한다. 깨끗한 submodule 포인터 변경도 포함해 gitlink는 모두 `unsupported-state`로 거절한다. 하위 git 저장소(untracked)는 건너뛴다. 변경 파일이 매우 많으면 git 인자 길이 한도를 넘을 수 있다.

## Quiz

1. 아직 커밋하지 않은 변경이 많은 상태에서 실행 리뷰를 분류하면 어떻게 되는가?
   - 가. 커밋된 변경만 세어 작게 분류된다.
   - 나. 최종 작업 트리 스냅샷의 통계로 분류되어 미커밋 변경도 포함된다.
   - 다. 미커밋 변경이 있으면 분류를 거절한다.
2. 리뷰를 시작한 뒤 파일이 바뀐 채 라운드를 accepted로 기록하려 하면?
   - 가. `review-snapshot-stale`로 거절되고 새 스냅샷으로 다시 리뷰해야 한다.
   - 나. 마지막 변경분만 자동으로 다시 리뷰한 뒤 기록된다.
   - 다. 경고만 남기고 기록된다.
3. 새 리뷰 라운드의 `target`에 `snapshot_id`가 없으면?
   - 가. 스냅샷 없이 `git diff`로 대신 검사한다.
   - 나. 과거 기록과의 호환을 위해 그대로 받는다.
   - 다. `review-snapshot-required`로 거절된다.
4. 이미 `snapshot_id` 없이 저장된 과거 라운드는 어떻게 되는가?
   - 가. 읽기와 gate 검증은 허용되지만 새 기록의 입력으로는 쓸 수 없다.
   - 나. gate 검증에서 실패한다.
   - 다. 자동으로 새 스냅샷으로 변환된다.
5. 스냅샷 수집 중에 대상 파일이 바뀐 것을 감지하면?
   - 가. 마지막 상태를 artifact로 저장하고 성공으로 돌려준다.
   - 나. 성공 artifact를 돌려주지 않고 실패로 알린다.
   - 다. 변경된 파일만 제외하고 저장한다.

## Tasks

### bouncer-improvements-2026-10-14/review-input-consistency/001 · `8414f3f3`

#### Goal & intent

미커밋 변경을 포함한 최종 파일 상태를 동결하고 리뷰 본문·규모 분류에 같은 스냅샷을 제공한다. epic 성공 기준 1·2·5·6·7을 충족한다.

#### Current behavior

- scripts/src/lib/review-dispatch.ts:782는 base·head를 커밋으로 해석하고 :798·1132에서 git diff --numstat base head를 실행한다. staged·unstaged·untracked를 세지 않는다.
- :102의 target은 base·head·task만 가지며 :833·847의 discovery·delta 반환에는 동결 내용이 없다. :805·808은 임계값과 light 정책을 소유한다.
- scripts/src/lib/cli-review-dispatch-command.ts:328·337은 분류 함수를 호출하고 JSON·exit 0/1을 출력한다. :45·350은 read-only라고 안내한다.
- scripts/src/lib/canonical-json.ts:15·37의 hash helper는 재사용 가능하다. coordinator.ts:1442·1449의 fingerprint는 untracked 내용을 빠뜨려 대신 쓸 수 없다.
- test/review-dispatch.test.js:240은 README만 baseline 커밋하고 :202의 계획 문서는 untracked다. 계획 문서를 포함하는 새 계약에 맞춰 fixture baseline을 준비한다.
- 소스 조사만 수행했다. 재현은 HEAD 고정 후 tracked 파일 500줄을 바꾸고 classifyExecuteReview 결과의 changed_lines를 확인하는 방식이다.

#### Target behavior

- 성공: base 이후 최종 파일·untracked 내용·mode·필터링된 index를 수집하고 artifact 통계로 기존 임계값을 판정한다. 같은 내용은 같은 id이다.
- 성공: 최종 상태를 한 번만 집계하며 index만 바뀌어도 id가 바뀐다. 계획 문서를 포함하고 자동 증거만 blueprint Contract 규칙으로 제외한다.
- 실패: head 불일치, Git·파일 읽기·저장 실패, 수집 중 변경, 표현 불가능한 충돌 index·dirty submodule을 ok:false로 반환한다. 실패를 줄 수 0으로 접지 않는다.
- 보존: plan dispatch·risk union·임계값·light·delta perspectives와 인자 오류 exit 2를 유지한다. source·index·branch를 바꾸지 않는다.

#### Interface

- 공유 모듈은 captureReviewSnapshot({repoRoot,blueprintDir,taskId,base,head,deps?}), loadReviewSnapshot({repoRoot,snapshotId,deps?}), checkReviewSnapshotCurrent({repoRoot,snapshotId,blueprintDir,taskId,base,head,deps?}) 책임을 제공한다. 이름은 검색 힌트이며 책임·입출력 계약이 수용 기준이다.
- 성공은 {ok:true,snapshot_id,snapshot_path,snapshot}; snapshot은 version:1, scope:{blueprint,task}, target:{base,head}, diff, files, index_entries, changed_files, changed_lines를 갖는다. diff와 files는 reviewer가 base 대비 변경을 읽을 수 있는 동결 내용이다.
- files는 정렬한 저장소 상대 path·mode·kind·content를 담는다. binary bytes는 base64이며 symlink는 링크 target 자체만 담는다. index_entries는 자동 증거를 필터링한 path·mode·blob 목록이다. timestamp·artifact path는 내용 hash에 넣지 않고 raw index 파일 hash로 self-stale을 만들지 않는다.
- 실패는 {ok:false,reason,cause,next}. id 형식·artifact 내용 hash·scope·안전한 경로를 검사하고 현재 HEAD와 다른 head 및 지원할 수 없는 상태를 거절한다. 최종 상태가 같은 staged/unstaged 상쇄는 줄 수 0으로 성공할 수 있다.
- deps.runGit(args:string[]) → Buffer, deps.readFile(path:string) → Buffer, deps.lstat(path:string) → file metadata, deps.readlink(path:string) → Buffer, deps.persistArtifact(path:string,content:Buffer) → void는 외부 I/O 주입 경계이다. persistArtifact는 같은 디렉터리 임시 파일과 원자 게시를 소유하며 저장 실패를 throw한다. 테스트는 이 함수의 오류를 주입해 성공 snapshot을 반환하지 않는지 확인한다. 읽기 실패·수집 중 변경 검사를 이 경계로 주입한다. classifyExecuteReview의 기존 exec 주입 호환을 유지한다.
- dispatch.target에 snapshot_id·snapshot_path를 추가한다. artifact는 .bouncer/runtime/review-snapshots/<snapshot_id>/snapshot.json에 저장하고 loader도 같은 경로를 유도한다. snapshot_path는 이 저장소 상대 경로이다. runtime 밖에는 쓰지 않으며 같은 id 파일을 검증 없이 덮어쓰지 않는다.

#### Touch

| 경로 | 심볼 | 변경 | 현재 책임 | 계획한 변경 | 근거 |
| --- | --- | --- | --- | --- | --- |
| `scripts/src/lib/review-snapshot.ts` | `신규 추출 지점: 수집·보존·로드·일치 검사` | Create | 없음 | 공유 snapshot 계약·수집 중 변경 거절 | 기존 helper는 동결 파일 내용을 제공하지 않음 |
| `scripts/src/lib/review-dispatch.ts` | `classifyExecuteReview / readNumstat` | Modify | 커밋 diff 기반 분류 | artifact 통계·id·path 기반 분류 | review-dispatch.ts:798·1132 |
| `scripts/src/lib/cli-review-dispatch-command.ts` | `USAGE / execute handler` | Modify | 분류 CLI·JSON 출력 | 저장 부작용·새 필드·오류 안내 | cli-review-dispatch-command.ts:45·328 |
| `test/review-snapshot.test.js` | `신규 추출 지점: Git snapshot 통합 검증` | Create | 없음 | 동결 내용·id·변경 감지 회귀 | 요구사항 기반 수집·로드 검증 필요 |
| `test/review-dispatch.test.js` | `Execute fixtures / target assertions` | Modify | 임계값·CLI 검증 | dirty 상태·새 target·stub·baseline 갱신 | review-dispatch.test.js:819·1160·1270 |
| `test/tiers.json` | `integration` | Modify | tier 등록 | snapshot integration 등록 | 실제 Git 테스트는 integration 소유 |

#### Constraints

- 승인된 affected_paths 안에서만 구현한다. 실행 CLI가 evidence·status를 기록하며 직접 통과를 선언하지 않는다.
- references/coding-standards/index.md의 요구사항 기반 테스트·예상 Red 실패·한국어 이유 주석·docstring 규칙을 적용한다.
- npm run build로 생성물을 갱신한다. scripts/lib는 Git ignore 대상이므로 affected_paths에 추가하지 않는다. tracked 생성물이 실제 바뀌면 승인된 경로만 staging하고 npm run check:emit를 실행한다. git add는 허용하며 구현 중 commit·push·branch 변경은 금지한다.
- 최종 완료 명령은 bouncer.verify의 npm run ci이다. focused 테스트·check:emit는 중간 확인이고 프로젝트 최종 통합 기준은 npm run ci이다.

- 기존 canonical hash helper와 Node·Git 기본 기능을 사용한다. 공유 모듈 하나는 수집과 acceptance가 동일 필터·hash를 쓰도록 필요한 최소 추출이다. 새 의존성·설정은 추가하지 않는다.
- 별도 live diff로 분류한 뒤 artifact를 재수집하지 않는다. 수집 전후 상태를 확인하고 불일치하면 성공 artifact를 반환하지 않는다.

### bouncer-improvements-2026-10-14/review-input-consistency/002 · `2bb6f8d4`

#### Goal & intent

새 실행 리뷰 라운드를 실제 스냅샷에 연결하고 현재 상태가 달라진 acceptance를 거절한다. 기존 저장 라운드를 변환하지 않고 epic 성공 기준 3·4·5·6·7을 충족한다.

#### Current behavior

- scripts/src/lib/review-record.ts:160–174는 round 객체·findings 배열만 검사한다. :199–217은 저장 위치를 고르고 :234–245는 기존 rounds 뒤에 입력을 추가한다.
- :250–270은 상속한 status도 검사한다. :273–279는 모든 검사 뒤 임시 파일·rename을 실행하므로 snapshot 거절도 쓰기 전에 해야 한다.
- scripts/src/lib/validate-sections.ts:89·431–450은 base/head·perspective target_head를 검사한다. context-review는 :99의 digest 계약이다.
- test/review-record.test.js:32·57·80은 가짜 SHA·non-Git fixture이며 :308·358은 CLI help·카드 JSON을 recorder에 직접 넣는다. snapshot fixture와 예시를 함께 갱신해야 한다.
- legacy stored shape는 test/validate-gates.test.js:1183·1204·2733과 cli-validate·finalize·coordinator 계열에도 있다. 새 입력에만 필수 id를 요구해 이 기존 fixture는 유지한다.
- 소스 조사만 수행했다. 재현은 valid new round에 id 없이 recordReview를 호출하면 현재 append되는 성공 경로이다.

#### Target behavior

- 성공: 새 round.target.snapshot_id를 shared loader로 검증하고 scope·base·head가 같으면 append한다. perspectives는 target을 상속한다.
- 성공: id 없는 기존 round 뒤에 유효한 새 round를 추가한다. 기존 기록과 context target.digest를 바꾸지 않는다.
- 실패: id 누락·형식·unknown·손상·다른 범위를 거절한다. effective status가 accepted면 새 마지막 snapshot과 현재 HEAD·내용·index를 비교하고 불일치 시 쓰기 전에 거절한다.
- 보존: finding·fingerprint·병합·round 순서·delta·critical recovery 한도와 atomic rename을 유지한다. delta 후 이전 discovery snapshot의 stale 여부로 acceptance를 막지 않는다.

#### Interface

- 기존 review record argv를 유지한다. 새 round.target.snapshot_id는 필수이며 경로 입력 옵션은 추가하지 않는다. loader가 runtime 경로를 유도한다.
- snapshot은 task001 version:1 artifact이다. 예: target:{base:<resolved sha>,head:<current sha>,snapshot_id:<64 lowercase hex>}. bp/task scope도 loader가 검사한다.
- 신규 입력의 reason은 review-snapshot-required, review-snapshot-invalid, review-snapshot-mismatch, review-snapshot-stale로 구분하고 cause·next를 제공한다. unknown·손상은 invalid, scope/target 차이는 mismatch이다. stale은 새 dispatch·재리뷰를 안내한다.
- 정적 저장 문서 검증기는 id가 없으면 기존 계약, 있으면 형식을 검사한다. 과거 artifact 존재·현재 freshness를 G14/G21에 요구하지 않는다. 새 append·acceptance에서 recorder가 runtime binding을 검사한다.
- failure는 기존 bytes·rounds를 유지하고 tmp를 남기지 않는다. accepted 상태를 상속한 append도 freshness를 검사한다. requested/addressed는 binding이 유효한 이전 snapshot을 기록할 수 있지만 acceptance에는 stale snapshot을 재사용할 수 없다.

#### Touch

| 경로 | 심볼 | 변경 | 현재 책임 | 계획한 변경 | 근거 |
| --- | --- | --- | --- | --- | --- |
| `scripts/src/lib/review-record.ts` | `recordReview / readRoundInput` | Modify | round append·atomic 기록 | 새 id·freshness 검증·no-write 거절 | review-record.ts:199·234·250·273 |
| `scripts/src/lib/cli-review-command.ts` | `HELP_ROUND_EXAMPLE / HELP` | Modify | CLI 실행 예시 | snapshot_id·freshness 오류 안내 | cli-review-command.ts:29·67 |
| `scripts/src/lib/validate-sections.ts` | `executeTarget / collectFindingFailures` | Modify | 공유 round·finding 검증 | 저장 id 형식·legacy/context 분리 | validate-sections.ts:89·431 |
| `test/review-record.test.js` | `fixtures / CLI examples` | Modify | recorder·실행 예시 검증 | snapshot fixture·stale·atomic·legacy 회귀 | review-record.test.js:32·308·358·384 |
| `test/validate-gates.test.js` | `execute / context round fixtures` | Modify | G14·G21 compatibility | id 형식과 legacy/context 분리 검증 | validate-gates.test.js:1183·1204·568 |
| `test/tiers.json` | `unit / integration` | Modify | tier 목록 | Git fixture를 쓰는 recorder integration 이동 | 현재 non-Git recorder fixture 교체 |
| `references/coordinator-cards/review.md` | `repair-wave JSON examples` | Modify | task round 예시 | snapshot_id 예시 추가 | review-record.test.js:358 실행 fixture |
| `references/coordinator-cards/final_review.md` | `repair-wave JSON examples` | Modify | BP round 예시 | snapshot_id 예시 추가 | review-record.test.js:358 실행 fixture |

#### Constraints

- 승인된 affected_paths 안에서만 구현한다. 실행 CLI가 evidence·status를 기록하며 직접 통과를 선언하지 않는다.
- references/coding-standards/index.md의 요구사항 기반 테스트·예상 Red 실패·한국어 이유 주석·docstring 규칙을 적용한다.
- npm run build로 생성물을 갱신한다. scripts/lib는 Git ignore 대상이므로 affected_paths에 추가하지 않는다. tracked 생성물이 실제 바뀌면 승인된 경로만 staging하고 npm run check:emit를 실행한다. git add는 허용하며 구현 중 commit·push·branch 변경은 금지한다.
- 최종 완료 명령은 bouncer.verify의 npm run ci이다. focused 테스트·check:emit는 중간 확인이고 프로젝트 최종 통합 기준은 npm run ci이다.

- task001 helper를 소비하며 hash·필터·Git 수집기를 복제하지 않는다. 카드의 일반 문장 연결은 task003 소유이며 이 task는 실행 JSON 예시만 갱신한다.
- card·help 예시는 placeholder id를 보여주고 fixture가 생성한 실제 id·SHA로 치환해 실행한다. 기존 저장 id 부재와 새 입력 id 누락을 구분한다.

### bouncer-improvements-2026-10-14/review-input-consistency/003 · `f3b99d2f`

#### Goal & intent

task·blueprint 최종 리뷰와 discovery·delta, named·generic·inline·print reviewer가 같은 스냅샷을 읽고 id를 기록하도록 지침을 연결한다. epic 성공 기준 1·3·4·6·8을 충족한다.

#### Current behavior

- references/review/index.md:47은 BP에서 git diff base, task에서 git diff base...HEAD와 untracked를 읽게 한다. :78은 base·head만 동결하고 :120은 delta에서 live diff를 다시 읽는다.
- reviewer-prompt.md:30의 TARGET은 base/head·brief·bundle 정보를 받지만 snapshot은 없다. :136의 delta도 live diff를 명시한다.
- review-round.md:13·89·107, task card :16·50·83, final card :14·36·80은 freeze·print·record를 따로 전달한다. print는 카드 안에서 입력을 구성하므로 카드 자체에도 안내가 필요하다.
- agents/bouncer-reviewer.md:16은 frozen target 권한을 소유한다. test/agents.test.js:71은 생성기 mdToCodexToml 결과와 TOML 바이트를 비교한다. coordinator 역할 :159·254는 카드에 위임하므로 바꾸지 않는다.
- 문서 조사만 수행했다. 새 wording assertion 테스트를 만들지 않고 기존 slot·Red run 위치·역할 패리티와 실행 예시로 계약을 확인한다.

#### Target behavior

- 성공: controller가 dispatch target의 id·path를 TARGET에 전달하고 reviewer는 artifact diff·내용을 읽는다. live git diff로 다시 수집하지 않는다.
- 성공: task·BP·print·fallback에 같은 계약을 전달한다. delta는 수정 후 새 snapshot으로 전체 변경을 판단하고 이전 finding·snapshot은 비교 근거로 전달한다.
- 실패: artifact 누락·손상·target 불일치와 recorder stale은 next에 따라 새 snapshot·재분류·재리뷰를 안내한다. status·round를 손으로 수정해 우회하지 않는다.
- 보존: perspectives·security, brief·intent 필터·Red run 위치, 독립 리뷰·단일 fix·delta·critical recovery·위험 수용 권한을 유지한다.

#### Interface

- 기존 TARGET 슬롯에 snapshot_id·snapshot_path를 넣고 새 placeholder·heading·perspective별 복제 id를 만들지 않는다. artifact version·base/head·scope가 dispatch와 같아야 한다.
- reviewer는 동결 content·metadata를 판단 근거로 사용하며 현재 checkout의 다른 내용을 snapshot 내용으로 주장하지 않는다. 읽지 못하면 재분류 요청을 보고한다.
- 새 예시는 target.snapshot_id를 포함한다. id 없는 저장 round는 읽기 호환이며 신규 record 입력으로 재사용할 수 없음을 설명한다.
- read-only 의미는 source·index·branch 불변이며 dispatch의 runtime artifact 저장 부작용을 안내한다.

#### Touch

| 경로 | 심볼 | 변경 | 현재 책임 | 계획한 변경 | 근거 |
| --- | --- | --- | --- | --- | --- |
| `references/review/index.md` | `Steps Load / Review` | Modify | 리뷰 절차 | artifact 소비·stale 처리 | review/index.md:47·78·120 |
| `references/review/assets/reviewer-prompt.md` | `TARGET / delta rules` | Modify | reviewer slot | id·path 전달·동결 내용 읽기 | reviewer-prompt.md:30·136 |
| `references/coordinator-cards/review.md` | `freeze / record / print` | Modify | task 호출 계약 | snapshot dispatch·artifact·failure next | review.md:16·50·83 |
| `references/coordinator-cards/final_review.md` | `freeze / record / print` | Modify | BP·delta 호출 | snapshot 전달·freshness·최신 delta binding | final_review.md:14·36·80 |
| `skills/bouncer-execute/references/review-round.md` | `freeze / delta / record` | Modify | execute 리뷰 흐름 | task·BP snapshot 계약 연결 | review-round.md:13·89·107 |
| `references/spec-authoring/review-rounds.md` | `round target examples` | Modify | 저장 round 예시 | 신규 id·legacy 호환 설명 | review-rounds.md:49·67 |
| `agents/bouncer-reviewer.md` | `Authority / frozen target` | Modify | named·fallback 역할 | 지정 artifact만 읽는 권한 계약 | bouncer-reviewer.md:16 |
| `.codex/agents/bouncer-reviewer.toml` | `generated instructions` | Modify | Codex reviewer 역할 | mdToCodexToml 재생성 | test/agents.test.js:71 바이트 패리티 |

#### Constraints

- 승인된 affected_paths 안에서만 구현한다. 실행 CLI가 evidence·status를 기록하며 직접 통과를 선언하지 않는다.
- references/coding-standards/index.md의 요구사항 기반 테스트·예상 Red 실패·한국어 이유 주석·docstring 규칙을 적용한다.
- npm run build로 생성물을 갱신한다. scripts/lib는 Git ignore 대상이므로 affected_paths에 추가하지 않는다. tracked 생성물이 실제 바뀌면 승인된 경로만 staging하고 npm run check:emit를 실행한다. git add는 허용하며 구현 중 commit·push·branch 변경은 금지한다.
- 최종 완료 명령은 bouncer.verify의 npm run ci이다. focused 테스트·check:emit는 중간 확인이고 프로젝트 최종 통합 기준은 npm run ci이다.

- task001·002의 필드·reason 계약을 그대로 소비한다. coordinator 역할 변경은 추가하지 않는다.
- task002의 실행 카드 예시를 유지한다. 문서 문자열을 검증하는 새 테스트 대신 기계 형식·패리티·기존 슬롯 순서 검증을 사용한다.