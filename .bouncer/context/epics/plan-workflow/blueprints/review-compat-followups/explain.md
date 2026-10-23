---
type: bouncer.explain
title: review-compat-followups explain
description: Explain for review-compat-followups
resource: .bouncer/context/epics/plan-workflow/blueprints/review-compat-followups/explain.md
tags:
  - bouncer
  - explain
timestamp: '2026-10-23T15:17:43.383+09:00'
bouncer:
  id: EXPLAIN-review-compat-followups
  epic_id: plan-workflow
  blueprint_id: review-compat-followups
  status: published
  comprehension:
    - range_from: b62eb3cdbe1ba52dc3233e76be9396e9ca647e1b
      range_to: 356d514b366389380df7008b204faf97d527ce2b
      diff_sha: 945bf8f7fff4a8774d2f2b0b3cb941dee7839859c86a5a6df4da87709c71cbfb
      recorded_at: '2026-10-23T15:18:24.923+09:00'
  task_commits:
    - task: plan-workflow/review-compat-followups/001
      sha: 7facae3e
      intent_anchor: task-001
    - task: plan-workflow/review-compat-followups/002
      sha: 89c7670e
      intent_anchor: task-002
    - task: plan-workflow/review-compat-followups/003
      sha: d57750ed
      intent_anchor: task-003
    - task: plan-workflow/review-compat-followups/004
      sha: 4dc68487
      intent_anchor: task-004
    - task: plan-workflow/review-compat-followups/005
      sha: 568c6b00
      intent_anchor: task-005
    - task: plan-workflow/review-compat-followups/006
      sha: e116b4e9
      intent_anchor: task-006
    - task: plan-workflow/review-compat-followups/008
      sha: 356d514b
      intent_anchor: task-008
---
# Explain

## Background

계획 리뷰 호환성 개편 뒤에 남은 후속 결함을 정리한 변경이다. 계획 승인 단계는 선행 병합(prerequisites) 항목의 형식 오류를 병합 상태 확인(G32)에서야 알려 주었고, 워커 토큰 스냅샷은 저장소 밖을 가리키는 symlink 경로도 따라가 쓸 수 있었다. scoped_terminal 계획의 task verify가 `check-doc-shape`를 부르면서 계약 없는 문서를 넘겨도 계획 단계에서는 걸러지지 않았고, 읽기 전용 리뷰어 역할 문서에는 호환 규칙 안내가 빠져 있었다.

## Code

- `scripts/src/lib/plan-approve.ts`, `plan-prerequisites.ts`: `prerequisiteFormatIssues`가 항목 형식 오류를 `S39 <설명>` cause로 만들고, `approvePlan`은 쓰기 전에 이를 거절한다. 별도 `checkPrerequisites` 호출 없이 같은 항목 목록을 재사용해 Git 이중 호출을 피한다. 잘못된 SHA가 있어도 canonical 경로는 중복 판정용 `seen`에 기록하는 기존 동작을 유지한다.
- `scripts/src/lib/drive-metrics.ts`: `snapshotLocationSafe`가 `realpath`·`lstat`로 경계를 검사한다. ENOENT 외 fs 오류는 안전하지 않음으로 접혀 invalid가 된다. `saveWorkerSnapshot`은 `wx` 배타 temp로 쓰고, 자기가 만든 파일만 정리한다(EEXIST는 남의 파일이라 지우지 않는다). 검사와 사용 사이 경쟁(TOCTOU)은 해결 범위 밖이다.
- `scripts/src/lib/doc-shape-contracts.ts`(신규), `scripts/check-doc-shape.js`: 문서 경로별 계약 판정을 공용 모듈로 분리했다.
- `scripts/src/lib/validate-gates-plan.ts`: 정적 G20이 모든 task의 verify(terminal 포함, legacy 포함)에서 계약 없는 문서 인자를 거절한다. 계약 없는 문서가 여럿이면 task당 G20 한 건에 경로를 쉼표로 나열하고, 이미 다른 argv 위반으로 거절된 verify는 진단을 중복하지 않는다. 한계: `check-doc-shape.js`가 빌드 산출 leaf를 require하므로 `npm run build` 없이는 checker가 로드되지 않는다.
- `agents/bouncer-context-reviewer.md`, `.codex/agents/bouncer-context-reviewer.toml`, `rules/document-schema.md`, `rules/cli.md`, `CHANGELOG.md`, `skills/bouncer-run/references/*`: 위 동작과 문구를 맞춘 문서·계약 갱신이다.
- 알려진 공백: 쓰기 도중 실패해 남은 partial temp를 정리하는 분기에 테스트가 없다(리뷰 advisory).
- 검증·리뷰 근거는 digest `evidence`의 verification 증적과 `review.md`를 따른다.

## Quiz

1. 선행 병합 항목에 형식 오류가 있는 계획을 승인하려 하면 어떻게 되는가?
   - A. 승인은 되고 병합 확인(G32) 단계에서 경고만 남는다.
   - B. 아무것도 쓰기 전에 `S39 <설명>` cause로 거절된다.
   - C. 잘못된 항목만 건너뛰고 나머지로 승인된다.
2. 워커 토큰 스냅샷의 저장 경로가 저장소 밖을 가리키는 symlink를 통과하면?
   - A. 링크를 따라가 대상 파일에 그대로 쓴다.
   - B. 경계 검사에서 안전하지 않다고 판정되어 invalid로 처리된다.
   - C. 링크를 삭제하고 새 파일을 만든다.
3. scoped_terminal 계획의 task verify가 계약 없는 문서(`rules/document-schema.md` 등)를 `check-doc-shape`에 넘기면 계획 gate는?
   - A. 통과시키고 실행 단계에서 실패하게 둔다.
   - B. commit task에서만 거절하고 terminal verify는 허용한다.
   - C. terminal 포함 모든 task에서 G20으로 거절한다.
4. 스냅샷 쓰기가 EEXIST로 실패했을 때 temp 파일 정리는?
   - A. 항상 지운다.
   - B. 파일 크기가 0일 때만 지운다.
   - C. 남의 파일일 수 있으므로 지우지 않는다.

## Tasks

### plan-workflow/review-compat-followups/001 · `7facae3e`

#### Goal & intent

잘못된 선행 선언을 plan approve가 쓰기 전에 거절하고 선행 항목의 유효성 판정을 한 곳으로 모은다.

요구사항 1-1을 담당한다. 전용 검증은 사용자 확인을 받은 frontmatter bouncer.verify와 Checklist 마지막 항목에 기록한다.

#### Current behavior

approvePlan은 planPrerequisiteFailures의 entries·cycles 실패만 확인한 뒤 문서를 쓴다(scripts/src/lib/plan-approve.ts:220,231). report.formatIssues는 누락되어 HEAD·짧은 SHA처럼 entries에서 제외되는 입력이 승인될 수 있다. prerequisiteFormatIssues(:38), wellFormedTargets(:115), checkPrerequisites(:176)가 서로 다른 항목 선별 조건을 쓴다. 재현은 accepted context-review를 가진 승인 fixture에 자기참조·HEAD·짧은 SHA·비정규 경로·중복 선언을 각각 넣어 approvePlan을 호출한다. 기존 검증 근거는 test/plan-approve.test.js:370,385의 미병합·부재 거절 및 바이트 불변 단언이다. I/O 관측점은 plan-approve.ts:240의 writeFile과 plan-prerequisites.ts:158의 주입 Git 실행기다.

조사 HEAD: `b62eb3cdbe1ba52dc3233e76be9396e9ca647e1b`. 해당 증거 경로의 git diff --quiet 확인 결과 변경이 없어 근거를 재사용한다.

#### Target behavior

성공: 선언 부재·빈 배열·유효한 병합 SHA의 기존 승인은 유지한다. 실패: formatIssues가 하나라도 있으면 plan-approve-prerequisite으로 거절하고 cause에 S39와 해당 항목 설명, 기존 복구 next를 제공한다. epic·blueprint·모든 task의 바이트와 status는 그대로다. 보존: 존재·순환·병합 상태 거절은 기존 G32를 유지한다. 단일 항목 판정은 정확한 키·정본 경로·40자 소문자 SHA·자기참조·중복을 같은 기준으로 선별하며, 유효한 첫 항목만 Git 조회·그래프 간선에 사용한다.

#### Interface

- 제공: 기존 approvePlan({repoRoot, blueprintDir, deps?}) 결과 형식을 유지한다. 형식 거절의 reason은 plan-approve-prerequisite, cause는 S39를 포함한 문자열 배열이다. 선행 선언 shape는 {blueprint: string, merged_commit: string}이며 예는 정본 blueprint 디렉터리와 실제 40자 병합 SHA다.
- 거부: HEAD·짧은 SHA·추가 키·비정규 경로·중복·자기참조는 형식 오류이며 Git 입력으로 넘기지 않는다. 유효한 첫 선언 뒤 중복 항목은 별도 조회·간선이 아니다.
- 주입 seam: deps.writeFile(abs: string, text: string) → void로 쓰기 호출 수를 센다. checkPrerequisites의 exec(args: string[]) → {status: number, stdout: string}로 Git 호출을 기록한다. 테스트는 승인 직전 각 문서 원문을 Buffer로 보관한다.

#### Touch

| 경로 | 심볼 | 변경 | 현재 책임 | 계획한 변경 | 근거 |
| --- | --- | --- | --- | --- | --- |
| `scripts/src/lib/plan-approve.ts` | `approvePlan` | Modify | 상태 승인과 원자적 문서 쓰기 | 쓰기 전 formatIssues 거절과 S39 cause 연결 | scripts/src/lib/plan-approve.ts:220,231; test/plan-approve.test.js:370 |
| `scripts/src/lib/plan-prerequisites.ts` | `prerequisiteFormatIssues, checkPrerequisites, wellFormedTargets` | Modify | 형식 검사·Git 조회 대상·순환 간선 선택 | 공유 항목 판정으로 세 소비자 규칙 통합 | scripts/src/lib/plan-prerequisites.ts:38,115,176; test/plan-prerequisites.test.js:123 |
| `test/plan-approve.test.js` | `승인 fixture와 snapshot 단언` | Modify | 승인 성공·거절의 파일 보존 검사 | 5종 형식 오류의 reason·S39·쓰기 0회·bytes 불변 회귀 | test/plan-approve.test.js:30,370,385 |
| `test/plan-prerequisites.test.js` | `fakeGit, 중복 선언 테스트` | Modify | 선행 helper 형식과 Git 동작 검사 | 추가 키·비정본 경로·중복의 entries와 호출 수 단언 | test/plan-prerequisites.test.js:42,123,130 |

#### Constraints

기존 단언 변경 범위: test/plan-prerequisites.test.js의 중복 선언 테스트(123행)를 보강하여 formatIssues 확인에 entries.length === 1과 유효한 첫 항목의 Git 조회만 발생함을 추가한다. 기존 미병합·부재·순환의 reason과 G32 기대값을 바꾸지 않는다. S39 구조 의미를 G32로 재정의하지 않는다. 새 의존성 없이 기존 read-only helper를 재사용한다.

원본 REQUIREMENTS_REVIEW_COMPAT_FOLLOWUPS.md는 로컬 참고 자료이며 git add·task commit·finalize remainder에 포함하지 않는다. 한국어 브리프·.gitmessage 커밋 규약을 지킨다. 검증 성공 증적과 상태는 실행 workflow만 기록한다.

### plan-workflow/review-compat-followups/002 · `89c7670e`

#### Goal & intent

snapshot 저장의 조상·임시 파일 경계를 보호하고 I/O 실패를 구조화된 거절로 바꾸며 partial merge와 문서 구조의 회귀 단언을 보강한다.

요구사항 1-2을 담당한다. 전용 검증은 사용자 확인을 받은 frontmatter bouncer.verify와 Checklist 마지막 항목에 기록한다.

#### Current behavior

snapshotLocationSafe는 dirname realpath의 ENOENT를 즉시 허용한다(scripts/src/lib/drive-metrics.ts:542,548). saveWorkerSnapshot은 :648에서 먼저 recursive mkdir을 수행하고 :650에서 검사하므로 .git/bouncer가 외부 symlink이고 metrics-snapshots가 없으면 외부 디렉터리를 만든다. :646의 예측 가능한 temp를 :651에서 일반 쓰기로 열어 symlink를 따른다. :543의 base realpath 및 :547·:555·:594의 non-ENOENT는 throw된다. SnapshotFs(:117)는 read/write/rename만 주입한다. partial merge는 finalize-release-main.ts:475 저장 뒤 :478 merge하지만 기존 테스트(:244)는 순서와 실패 무변경을 직접 검증하지 않는다. doc-shape-cli.test.js:328은 drive-metrics 정상 사본만 검사한다.

조사 HEAD: `b62eb3cdbe1ba52dc3233e76be9396e9ca647e1b`. 해당 증거 경로의 git diff --quiet 확인 결과 변경이 없어 근거를 재사용한다.

#### Target behavior

성공: 첫 저장·동일 hash 재사용·ledger 없는 기존 snapshot 복원과 JSON shape는 유지한다. 실패: 기존 조상들을 mkdir 전에 검사해 common dir 밖 경로에서 디렉터리·파일을 만들지 않는다. mkdir 뒤 경계도 재검사하고 temp는 배타 생성으로 기존 symlink를 따라 쓰지 않는다. 경계 검사·snapshot 읽기의 non-ENOENT는 metrics-snapshot-invalid, 디렉터리 mkdir·temp 생성·쓰기·rename의 I/O 오류는 metrics-snapshot-write-failed를 반환한다. 자신이 만든 temp만 정리하며 기존 snapshot과 외부 대상 바이트를 보존한다. partial merge 저장 실패 시 merge/commit 호출은 0회이고 commit 수·HEAD tree·porcelain·ledger·integration tree는 그대로다. 성공 시 저장 호출이 첫 merge보다 앞선다. 필수 H2를 없앤 drive-metrics 사본은 exit 1이다.

#### Interface

- 제공: saveWorkerSnapshot({commonGitDir, blueprint, ledgerFile, fs?, now?})의 성공 payload 및 snapshot version 1을 유지한다. 거절은 기존 reason 두 개를 사용한다.
- 거부: common dir 경계 이탈·snapshot symlink·경계 또는 snapshot 읽기 오류는 invalid다. 디렉터리 mkdir 또는 temp 생성·write·rename 실패는 write-failed다. ENOENT는 가장 가까운 기존 조상까지 검사한 뒤 첫 저장 상태로 처리한다. 프로그래밍 오류를 I/O 실패로 삼키지 않는다.
- fs seam: 기존 readFileSync(file[, encoding]), writeFileSync(file, data), renameSync(from,to) 주입 객체는 계속 허용한다. writeFileSync에는 배타 생성 options를 전달할 수 있도록 signature를 확장한다. realpathSync(file) → string, lstatSync(file) → fs.Stats, mkdirSync(dir, options) → string|undefined, unlinkSync(file) → void는 optional 주입으로 추가하고 부재면 node:fs로 fallback한다. 모든 경계 검사도 이 seam을 쓴다.
- release seam: deps.saveMetricsSnapshot({repoRoot,blueprint}) → {ok:boolean, reason?:string}, deps.git(args:string[]) → string. 두 seam의 이벤트를 한 배열에 기록해 save → merge 순서를 검사한다. 테스트 git은 기록 후 실제 fixture git에 위임한다.

#### Touch

| 경로 | 심볼 | 변경 | 현재 책임 | 계획한 변경 | 근거 |
| --- | --- | --- | --- | --- | --- |
| `scripts/src/lib/drive-metrics.ts` | `snapshotLocationSafe, loadWorkerSnapshot, saveWorkerSnapshot, SnapshotFs` | Modify | 집계 snapshot 저장·복원과 경계 검사 | 기존 조상 사전 검사·배타 temp·I/O reason 변환·호환 seam | scripts/src/lib/drive-metrics.ts:117,542,584,623; test/cli-metrics.test.js:791,801 |
| `test/cli-metrics.test.js` | `snapshot symlink와 I/O 주입 테스트` | Modify | metrics CLI와 저장 helper 검증 | 미존재 하위 경로 조상 symlink·temp symlink·realpath/lstat/read/write/rename 오류 회귀 | test/cli-metrics.test.js:679,779,791,801 |
| `test/finalize-release-main.test.js` | `partial merge fixture, runRelease` | Modify | main 정리와 partial merge 검사 | 저장 실패 시 mutation 0회·commit/tree 보존 및 성공 호출 순서 단언 | scripts/src/lib/finalize-release-main.ts:65,475,478; test/finalize-release-main.test.js:148,244,750 |
| `test/doc-shape-cli.test.js` | `drive-metrics 경로 계약 테스트` | Modify | 실제 문서 사본의 CLI 구조 검사 | 필수 heading 제거 사본의 exit 1·경로·heading 실패 단언 | scripts/check-doc-shape.js:776,823; test/doc-shape-cli.test.js:312,328 |

#### Constraints

기존 단언 변경 범위: test/doc-shape-cli.test.js의 drive-metrics 정상 exit 0은 보존하고 필수 H2를 H3로 바꾼 사본의 exit 1을 추가한다. cli-metrics의 완성된 디렉터리 symlink 거절과 기존 ENOSPC 보존 기대값은 유지한다. finalize-release-main 런타임 저장 순서는 이미 올바르므로 테스트만 바꾸며 해당 source는 변경하지 않는다. 새 보안 라이브러리 없이 node:fs의 배타 파일 생성과 기존 경계 검사 패턴을 사용한다. 시점 경쟁 전체를 해결했다고 주장하지 않는다.

원본 REQUIREMENTS_REVIEW_COMPAT_FOLLOWUPS.md는 로컬 참고 자료이며 git add·task commit·finalize remainder에 포함하지 않는다. 한국어 브리프·.gitmessage 커밋 규약을 지킨다. 검증 성공 증적과 상태는 실행 workflow만 기록한다.

### plan-workflow/review-compat-followups/003 · `d57750ed`

#### Goal & intent

task verify의 명시적 check-doc-shape 대상에 계약이 있는지 plan gate와 plan draft가 같은 기준으로 검사한다.

요구사항 1-3을 담당한다. 전용 검증은 사용자 확인을 받은 frontmatter bouncer.verify와 Checklist 마지막 항목에 기록한다.

#### Current behavior

check-doc-shape는 classifyDocPath(:698) 또는 PATH_CONTRACTS(:781) 중 하나도 없는 인자에 exit 1을 반환한다(scripts/check-doc-shape.js:1125). plan의 G20은 argv·terminal 정책만 검사한다(scripts/src/lib/validate-gates-plan.ts:299). 기존 parser는 인용 인자와 shell 경계를 처리한다(command-argv.ts:26). checker의 계약 함수는 CLI와 같은 JS 파일 내부에 있고 exports에는 없다(:1175). package.json:14는 scripts/lib 전체를 배포하지만 개발용 checker는 배포하지 않는다. draft는 structural 실패 시 G 검사까지 가지 않는다(validate.ts:448). 재현은 유효한 scoped_terminal fixture의 commit verify만 node scripts/check-doc-shape.js docs/workflow.md로 바꾸고 draft/정식 plan을 검사한다.

조사 HEAD: `b62eb3cdbe1ba52dc3233e76be9396e9ca647e1b`. 해당 증거 경로의 git diff --quiet 확인 결과 변경이 없어 근거를 재사용한다.

#### Target behavior

성공: 종류 계약 경로 또는 경로 계약 경로를 인자로 가진 명령은 새 검사에서 통과한다. 실패: 명시된 문서 중 계약 없는 경로가 하나라도 있으면 해당 task 파일에 G20을 내고 메시지에 check-doc-shape와 대상 경로를 담는다. draft·정식 gate의 진단은 동일하다. 보존: 다른 verify, 인자 없는 checker 기본 스캔, 기존 argv 규칙·allowlist·scoped_terminal 정책과 legacy의 verify 선택성은 바꾸지 않는다. 계약 존재 판정은 파일 내용 실행이나 검사 명령 spawn 없이 수행한다.

#### Interface

- 제공: 새 순수 leaf는 classifyDocPath(relPath) → kind|null, pathContractFor(relPath) → contract|null, PATH_CONTRACTS를 공유한다. 이질 계약 표에 맞는 명시적 TypeScript 타입을 두고 strict를 만족한다. 기존 checker의 계약 정의와 순수 runRefLink builder를 이동하며 kind별 본문 검사·CLI는 남긴다. checker는 ./lib/doc-shape-contracts, plan은 ./doc-shape-contracts를 import한다.
- 인식 범위: 기존 parseVerifyArgv 결과에서 실행 파일이 node이고 다음 인자가 저장소의 scripts/check-doc-shape.js인 직접 호출이다. ./ 및 저장소 안 절대 script 경로를 같은 대상으로 정규화하고, 인용된 파일 인자는 argv 경계대로 처리한다. 파일 경로도 repoRoot 상대 POSIX로 정규화한다. 명시 파일 0개는 기본 스캔이라 새 실패를 만들지 않는다. npm wrapper·node 옵션·셸을 새로 해석하지 않는다.
- 거부: 명시 파일의 kind/path contract 부재는 G20이다. 계약 검사 때문에 파일을 require·실행하거나 내용을 읽지 않는다. 다른 parser 실패는 기존 S12/G20 경로가 처리한다.
- 주입 seam: 추가 process 실행 seam은 필요 없다. 순수 leaf는 I/O가 없고 tests는 같은 경로 집합의 checker 결과와 gate 결과를 비교한다.

#### Touch

| 경로 | 심볼 | 변경 | 현재 책임 | 계획한 변경 | 근거 |
| --- | --- | --- | --- | --- | --- |
| `scripts/src/lib/doc-shape-contracts.ts` | `신규 추출 지점: 종류 분류와 경로 계약 정본` | Create | 현재 checker 안에 있는 순수 계약 정의 | classifyDocPath·PATH_CONTRACTS·pathContractFor와 순수 builder 추출 | scripts/check-doc-shape.js:698,762,781,972; package.json:14 |
| `scripts/check-doc-shape.js` | `classifyDocPath, PATH_CONTRACTS, pathContractFor 소비 지점` | Modify | 본문 구조 검사와 CLI | 공유 leaf를 사용하고 기존 CLI 계약 유지 | scripts/check-doc-shape.js:1068,1071,1125,1175 |
| `scripts/src/lib/validate-gates-plan.ts` | `checkPlanGate, checkPlanDraft, 신규 추출 지점: verify 문서 계약 판정` | Modify | 계획 scope·DAG·검증 정책 검사 | 동일한 정적 helper를 draft와 gate에 연결 | scripts/src/lib/validate-gates-plan.ts:466,661; test/validate-gates.test.js:2161,2239 |
| `test/validate-gates.test.js` | `G20·scoped_terminal·draft fixture` | Modify | task 검증 정책 입력 구성과 gate 검사 | 종류/경로 계약 성공·미계약 혼합 실패·draft 일치 회귀 | test/validate-gates.test.js:2161,2175,2227,2239 |
| `test/cli-validate.test.js` | `CLI plan draft fixture` | Modify | 실제 validate CLI 입출력 검사 | 유효 구조 fixture에서 미계약 경로 G20과 task 위치 진단 | scripts/src/lib/validate.ts:448; test/cli-validate.test.js:1 |
| `test/doc-shape-cli.test.js` | `checker CLI 계약 테스트` | Modify | 문서 CLI exit·구조·경로 검사 | 추출 전후 경로 계약 판정 동일 및 새 leaf 정본 검증 | scripts/check-doc-shape.js:1175; test/doc-shape-cli.test.js:28,40 |
| `test/distribution.test.js` | `npm package required files 검사` | Modify | 배포 포함 파일·개발 소스 누출 검사 | 새 compiled leaf가 패키지에 포함되고 require 가능함을 단언 | test/distribution.test.js:69,94; package.json:14 |

#### Constraints

기존 단언 변경 범위: 계약 정의 이동에 따른 import 경로만 조정하고 기존 G20·S12·terminal 개수·legacy·checker exit 기대값은 유지한다. 새 fixture는 다른 structural 오류를 없애 expected assertion에 도달하게 한다. 계약 목록을 두 군데 복제하지 않는다. 소비 저장소의 scripts/check-doc-shape.js를 동적 require하지 않는다. 새 의존성·package files·tsconfig 변경은 필요 없다. compiled leaf는 배포 산출물이며 git 추적하지 않는다.

원본 REQUIREMENTS_REVIEW_COMPAT_FOLLOWUPS.md는 로컬 참고 자료이며 git add·task commit·finalize remainder에 포함하지 않는다. 한국어 브리프·.gitmessage 커밋 규약을 지킨다. 검증 성공 증적과 상태는 실행 workflow만 기록한다.

### plan-workflow/review-compat-followups/004 · `4dc68487`

#### Goal & intent

계획 리뷰어의 consistency 판정에 기존 단언 변경 범위 확인을 명시하고 선행 선언 설명을 실제 승인·gate 연결과 맞춘다.

요구사항 2-1을 담당한다. 전용 검증은 사용자 확인을 받은 frontmatter bouncer.verify와 Checklist 마지막 항목에 기록한다.

#### Current behavior

agents/bouncer-context-reviewer.md:167의 consistency는 문서 일치·조사 근거를 보지만 Constraints의 기존 단언 변경 범위를 직접 요구하지 않는다. verifiability(:185)는 expected red·fixture를 이미 판정한다. rules/document-schema.md:124에는 승인·gate에 아직 연결되지 않았다는 문구가 있지만 rules/cli.md:115와 실제 G32는 연결돼 있다. TOML은 역할 Markdown의 생성본이며 test/agents.test.js:75가 바이트 일치를 검사한다. 재현은 해당 두 절을 읽고 plan-prerequisites·plan-approve 현행 계약과 대조한다. I/O는 codex-agents.ts:161의 정본 읽기와 :187 생성본 쓰기다.

조사 HEAD: `b62eb3cdbe1ba52dc3233e76be9396e9ca647e1b`. 해당 증거 경로의 git diff --quiet 확인 결과 변경이 없어 근거를 재사용한다.

#### Target behavior

산출물 판정: consistency는 기존 테스트 단언을 바꾸는 task의 Constraints가 파일·테스트명·새 기대값을 특정했는지 판정한다. verifiability의 기존 책임은 유지한다. schema는 S39 형식 검사와 승인 전/G32 병합 준비 검사 연결을 설명하며 미연결 문장을 제거한다. TOML은 Markdown에서 재생성되어 바이트 단위로 같다. 런타임·문서 schema 필드·기존 blueprint 상태는 바꾸지 않는다.

#### Interface

- 제공: consistency 관점 지시와 생성된 Codex 역할 본문, prerequisites 설명의 현행 계약이다.
- 거부: Constraints에 기존 assertion 변경 범위가 없거나 파일·테스트명·기대값이 특정되지 않은 브리프를 consistency가 누락 없이 지적하도록 명시한다. 새 관점·추가 리뷰 라운드는 도입하지 않는다.
- 생성 seam: ensureCodexAgents({repoRoot: string, created: string[], agentsDir?: string}) → void를 사용한다. agentsDir는 이 checkout의 agents 절대 경로로 고정하여 설치된 plugin의 오래된 정본을 읽지 않는다.

#### Touch

| 경로 | 심볼 | 변경 | 현재 책임 | 계획한 변경 | 근거 |
| --- | --- | --- | --- | --- | --- |
| `agents/bouncer-context-reviewer.md` | `consistency` | Modify | 관점별 계획 리뷰 rubric 정본 | Constraints의 기존 단언 파일·테스트명·새 기대값 판정 추가 | agents/bouncer-context-reviewer.md:167; references/spec-authoring/index.md의 Constraints 계약 |
| `.codex/agents/bouncer-context-reviewer.toml` | `developer_instructions` | Modify | Codex 역할 생성본 | Markdown 수정 후 ensureCodexAgents로 재생성 | scripts/src/lib/codex-agents.ts:161; test/agents.test.js:75 |
| `rules/document-schema.md` | `bouncer.prerequisites 설명` | Modify | 문서 필드 의미와 검증 계약 | 미연결 문장을 S39·승인·draft·G32의 현행 연결 설명으로 교체 | rules/document-schema.md:124; rules/cli.md:115 |
| `test/skill-context-review.test.js` | `consistency rubric 계약 테스트` | Modify | 리뷰어 관점 구조·책임 검사 | consistency 절에서 기존 assertion 변경 범위 확인 책임을 검증 | test/skill-context-review.test.js:61; agents/bouncer-context-reviewer.md:167 |

#### Constraints

기존 단언 변경 범위 없음. 새 rubric 책임 단언을 추가하며 기존 관점 수·이름·delta 정책 단언을 바꾸지 않는다. 역할 Markdown과 제품 규칙은 저장소 관례대로 영어로 작성하고 계획 브리프는 한국어로 작성한다. TOML을 손으로 고치지 않는다. 생성 명령은 다른 역할 생성본에 부수 diff를 만들지 않았는지 확인한다.

원본 REQUIREMENTS_REVIEW_COMPAT_FOLLOWUPS.md는 로컬 참고 자료이며 git add·task commit·finalize remainder에 포함하지 않는다. 한국어 브리프·.gitmessage 커밋 규약을 지킨다. 검증 성공 증적과 상태는 실행 workflow만 기록한다.

### plan-workflow/review-compat-followups/005 · `568c6b00`

#### Goal & intent

intent cache 재사용·symlink 거절, 직접 실행 인계 실패 경계, snapshot 시각 출처를 실제 런타임과 일치시킨다.

요구사항 2-2 (rules/cli.md의 function_ref는 TASKS-006)을 담당한다. 전용 검증은 사용자 확인을 받은 frontmatter bouncer.verify와 Checklist 마지막 항목에 기록한다.

#### Current behavior

agent-dispatch.md:227은 reused 조건에 function_ref가 없고 :238은 symlink-escaped를 created revision 1로 적는다. 실제 isCacheHit는 intent-bundle.ts:652에서 function_ref를 비교하고 assertIntentPathInCommonDir(:910)는 경계 이탈을 즉시 거절한다. direct-run.md:61 서문은 모든 실패에서 중단한다고 쓰지만 표의 metrics end/start는 never blocks다. drive-metrics.md:103은 snapshot의 recorded_at을 보고하라고만 하며 summary 출력에는 없고 저장 파일에 있다. I/O 근거는 drive-metrics.ts:642의 recorded_at 기록 및 intent-bundle.ts:924의 실경로 조회다.

조사 HEAD: `b62eb3cdbe1ba52dc3233e76be9396e9ca647e1b`. 해당 증거 경로의 git diff --quiet 확인 결과 변경이 없어 근거를 재사용한다.

#### Target behavior

산출물 판정: reused 조건에 task_brief_hash·함수 집합·function_ref·blob·section 일치를 모두 명시한다. missing/malformed cache는 created revision 1이며 symlink 경계 위반은 즉시 실패로 별도 설명한다. 인계는 2·4·5단계 실패만 중단하며 1·3단계 metrics 실패는 보고 후 계속한다. snapshot recorded_at은 metrics snapshot 결과 path의 저장 JSON에서 읽는 값으로 출처를 밝힌다. summary JSON에 필드를 추가하지 않는다.

#### Interface

- 제공: agent-dispatch·direct-run·drive-metrics 세 참조 문서의 런타임 설명이다.
- 거부: symlink 경계 이탈을 cache miss로 취급하거나 metrics 실패를 인계 차단으로 읽는 설명, summary에 없는 recorded_at을 출력 필드라고 적는 설명을 제거한다. 함수 참조 shape는 intent bundle의 opaque function_ref 문자열이며 같은 symbol 이름이어도 이 값이 다르면 재사용하지 않는다.
- 주입 seam: 해당 없음. 문서 산출물만 바꾸며 런타임 I/O나 테스트 seam을 추가하지 않는다.

#### Touch

| 경로 | 심볼 | 변경 | 현재 책임 | 계획한 변경 | 근거 |
| --- | --- | --- | --- | --- | --- |
| `skills/bouncer-run/references/agent-dispatch.md` | `Intent bundle cache와 revision 표` | Modify | role dispatch와 intent bundle 소비 안내 | function_ref 일치와 경계 거절/cache miss 구분 | skills/bouncer-run/references/agent-dispatch.md:227,238; scripts/src/lib/intent-bundle.ts:652,910 |
| `skills/bouncer-run/references/direct-run.md` | `Handoff` | Modify | 직접 실행에서 coordinator 인계 절차 | 2·4·5 실패 중단과 1·3 비차단 구분 | skills/bouncer-run/references/direct-run.md:61,66 |
| `skills/bouncer-run/references/drive-metrics.md` | `Closing report의 worker_tokens_source 표` | Modify | 토큰 집계 출처 보고 | snapshot JSON path의 recorded_at 출처 명시 | skills/bouncer-run/references/drive-metrics.md:103; scripts/src/lib/drive-metrics.ts:642 |

#### Constraints

기존 단언 변경 범위 없음. 문서의 필수 H2와 순서를 유지하며 계약 없는 direct-run.md를 check-doc-shape 명시 인자로 넣지 않는다. source·summary schema·캐시 상태를 변경하지 않는다. rules/cli.md의 같은 function_ref 설명은 TASKS-006이 단독 소유하여 공유 파일 충돌을 막는다.

원본 REQUIREMENTS_REVIEW_COMPAT_FOLLOWUPS.md는 로컬 참고 자료이며 git add·task commit·finalize remainder에 포함하지 않는다. 한국어 브리프·.gitmessage 커밋 규약을 지킨다. 검증 성공 증적과 상태는 실행 workflow만 기록한다.

### plan-workflow/review-compat-followups/006 · `e116b4e9`

#### Goal & intent

리뷰·finalize 안내와 공유 CLI 요약을 실제 조건에 맞추고 Unreleased의 comprehension 및 legacy 응답 복원 누락을 채운다.

요구사항 2-3 전체 및 2-2의 rules/cli.md function_ref을 담당한다. 전용 검증은 사용자 확인을 받은 frontmatter bouncer.verify와 Checklist 마지막 항목에 기록한다.

#### Current behavior

review-round.md:90은 두 번째 repair에 두 reason을 함께 적지만 coordinator-repair.ts:292,297은 second repair와 newPaths를 구분한다. rules/cli.md:400,443은 plan perspectives와 brief/legacy security·delta 조건을 섞어 설명한다. :21 synopsis에는 cli-usage.ts:12의 --repo가 없다. CHANGELOG.md:8 Unreleased에는 comprehension 기록 CLI와 legacy previous 전략 거절 응답 복원의 독립 기록이 없다. legacy 복원 근거는 review-dispatch.ts:363와 context-review-store의 호환 분기이며 PR #266 보존 Explain:32,36 및 test/review-dispatch.test.js:461과 일치한다. I/O는 comprehension.ts가 아니라 finalize-comprehension.ts:85의 확인 판정·:131의 단일 entry 기록이며 이번 task는 설명만 바꾼다.

조사 HEAD: `b62eb3cdbe1ba52dc3233e76be9396e9ca647e1b`. 해당 증거 경로의 git diff --quiet 확인 결과 변경이 없어 근거를 재사용한다.

#### Target behavior

산출물 판정: 두 번째 repair는 final-review-single-round, 첫 repair의 newPaths는 final-review-repair-scope로 구분한다. plan은 무표식 light skip/full single, brief full 4관점/light verifiability perspectives를 적는다. execute brief 조건은 full·task-less 최종 리뷰이며 discovery security는 authentication/authorization/credential에만 추가한다. 일반/light/task 범위의 non-empty review_risk security와 모든 delta의 combined 조건을 구분한다. CLI의 cache reused에 function_ref를 포함하고 새 verify 정적 G20 계약을 설명한다. comprehension synopsis에 --repo를 넣는다. Unreleased는 comprehension confirm-quiz/refresh·동의 없는 쓰기 거절과 legacy previous perspectives의 기존 cause/reason/next 복원을 기존 항목과 중복 없이 기록하고 이번 1-1~1-3 변경도 기록한다.

#### Interface

- 제공: review-round 안내, rules/cli 명령 synopsis·조건 요약, CHANGELOG의 Added/Changed/Fixed 기록이다.
- 거부: legacy·light에도 brief 최종 리뷰 정책을 적용하는 설명, delta에 discovery 관점을 나열하는 설명을 남기지 않는다. legacy 응답 복원은 표식 없는 plan의 이전 perspectives payload에 대한 기존 거절 객체 복원이며 새 legacy 동작을 만들지 않는다.
- 주입 seam: 해당 없음. 런타임·CLI 플래그·rejection table reason 집합은 변경하지 않는다.

#### Touch

| 경로 | 심볼 | 변경 | 현재 책임 | 계획한 변경 | 근거 |
| --- | --- | --- | --- | --- | --- |
| `skills/bouncer-run/references/review-round.md` | `brief repair·delta 안내` | Modify | 최종 리뷰 수정 라운드 설명 | second repair와 newPaths 거절 코드를 분리 | skills/bouncer-run/references/review-round.md:90; scripts/src/lib/coordinator-repair.ts:292,297 |
| `rules/cli.md` | `review-dispatch, finalize comprehension, intent cache, task verify 설명` | Modify | 공유 CLI synopsis·출력 계약 | legacy/brief·security·plan perspectives·delta·function_ref·--repo·정적 G20 설명 | rules/cli.md:21,400,443; scripts/src/lib/review-dispatch.ts:832,920,957; scripts/src/lib/cli-usage.ts:12 |
| `CHANGELOG.md` | `Unreleased` | Modify | 사용자 변경 이력 | comprehension CLI·legacy 거절 복원·이번 승인/저장/검증 보강 기록 | CHANGELOG.md:8,57; scripts/src/lib/review-dispatch.ts:363; test/review-dispatch.test.js:461; scripts/src/lib/finalize-comprehension.ts:85,117 |

#### Constraints

기존 단언 변경 범위 없음. 문구 검사를 통과시키려 테스트나 런타임을 바꾸지 않는다. rules/cli.md 거절 표의 기존 지원 reason을 삭제하거나 새 reason을 발명하지 않는다. review-round.md·CHANGELOG.md는 종류/경로 계약이 없으므로 직접 doc-shape 인자로 넣지 않는다. 공유 rules/cli.md·CHANGELOG.md 변경은 이 task가 단독 소유한다.

원본 REQUIREMENTS_REVIEW_COMPAT_FOLLOWUPS.md는 로컬 참고 자료이며 git add·task commit·finalize remainder에 포함하지 않는다. 한국어 브리프·.gitmessage 커밋 규약을 지킨다. 검증 성공 증적과 상태는 실행 workflow만 기록한다.

### plan-workflow/review-compat-followups/007

#### Goal & intent

구현 task 여섯 개가 모두 통합된 결과를 프로젝트 전체 CI로 검증한다. 이 task는 source 변경이나 커밋 없이 실행 증적만 남긴다.

#### Current behavior

선행 구현 task는 각자 전용 검증만 실행한다. package.json의 ci와 .github/workflows/test.yml:20이 전체 CI 명령의 근거다. 모든 depends_on이 integrated가 되기 전에는 이 task를 실행하지 않는다.

#### Target behavior

성공: 모든 구현 통합 후 frontmatter의 전체 CI를 실행하고 실제 exit code와 출력을 실행 workflow가 verification.md에 기록한다. 실패: 결과를 성공으로 기록하지 않고 coordinator의 terminal failure 복구 절차로 넘긴다. 기존 증적 소유권과 상태 전이는 유지한다.

#### Interface

- 제공: 구현 task가 모두 통합된 뒤 전체 검증 명령을 실행해 남기는 종단 검증 증적.
- 거부: source 변경, review 문서, commit. 실패를 숨기기 위한 scope 또는 검증 명령 변경.

#### Touch

Source 변경 경로 없음.

#### Constraints

affected_paths는 빈 배열이다. 모든 선행 task의 dependency_gate는 integrated다. 원본 요구사항 파일을 stage·커밋하거나 CI 실행 증적 대신 수기 성공 주장을 작성하지 않는다.

### plan-workflow/review-compat-followups/008 · `356d514b`

#### Goal & intent

최종 리뷰 finding을 수정한다.

- F-CT-1 (major, correctness_tests, must_fix) — scripts/src/lib/validate-gates-plan.ts#checkScopedTerminalPolicy — Contract 인터페이스·데이터·상태
- F-SS-2 (minor, spec_scope, must_fix) — rules/cli.md#review-dispatch 설명 (정적 G20) — tasks/006 Target behavior
- F-SS-1 (minor, spec_scope, must_fix) — rules/document-schema.md#bouncer.prerequisites 설명 — tasks/004 Target behavior
- F-SS-3 (minor, spec_scope, must_fix) — rules/cli.md#plan approve 설명 — Contract 인터페이스·데이터·상태
- F-CT-2 (minor, correctness_tests, must_fix) — test/plan-approve.test.js#FORMAT_CASES — tasks/001 Target behavior

#### Interface

- 제공: 기록된 리뷰 finding을 해소하는 최소 수정
- 거부: Blueprint 밖 scope와 새 기능

#### Touch

- Modify `scripts/src/lib/validate-gates-plan.ts` — 기록된 리뷰 finding을 수정한다.
- Modify `test/validate-gates.test.js` — 기록된 리뷰 finding을 수정한다.
- Modify `test/cli-validate.test.js` — 기록된 리뷰 finding을 수정한다.
- Modify `rules/cli.md` — 기록된 리뷰 finding을 수정한다.
- Modify `CHANGELOG.md` — 기록된 리뷰 finding을 수정한다.
- Modify `rules/document-schema.md` — 기록된 리뷰 finding을 수정한다.
- Modify `test/plan-approve.test.js` — 기록된 리뷰 finding을 수정한다.

#### Constraints

- 원장의 실패 증적과 repair 결정 범위만 따른다.