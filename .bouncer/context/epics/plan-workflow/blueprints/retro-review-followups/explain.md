---
type: bouncer.explain
title: retro-review-followups explain
description: Explain for retro-review-followups
resource: .bouncer/context/epics/plan-workflow/blueprints/retro-review-followups/explain.md
tags:
  - bouncer
  - explain
timestamp: '2026-10-29T08:33:54.154+09:00'
bouncer:
  id: EXPLAIN-retro-review-followups
  epic_id: plan-workflow
  blueprint_id: retro-review-followups
  status: published
  comprehension:
    - range_from: 130dc802bc529f4ddbf1420158fd812859344edf
      range_to: 9638dd1f2756de7d949e4ca72b9516d9e5c45589
      diff_sha: d2a6621a2898b4adf23870e90134ab7afe48bb59ca35ce68e0ee8bb9dbfa3983
      recorded_at: '2026-10-29T08:34:32.555+09:00'
  task_commits:
    - task: plan-workflow/retro-review-followups/001
      sha: f086bd34
      intent_anchor: task-001
    - task: plan-workflow/retro-review-followups/002
      sha: eade298a
      intent_anchor: task-002
    - task: plan-workflow/retro-review-followups/003
      sha: a3aa03d4
      intent_anchor: task-003
    - task: plan-workflow/retro-review-followups/004
      sha: 9638dd1f
      intent_anchor: task-004
---
# Explain

## Background

이전 리뷰에서 넘어온 항목 가운데 확인 가능한 것만 정리했다. 테스트가 실패 경로를 제대로 잡는지, 문서의 복구 안내가 실제 동작과 맞는지, 계획 승인 때 사용자가 근거를 볼 수 있는지가 대상이다. 공개 API, 원장·오류 shape, gate, 운영 timeout은 바꾸지 않았다.

사용자에게 보이는 동작 변화는 세 가지다.

- 워커가 보존할 patch·ref가 없고 보고서만 남긴 경우에도 `coordinate` 출력에 `salvage` 키가 생기고 `report`가 담긴다. `salvage` 키가 없는 경우는 patch·ref·report가 모두 없을 때뿐이다.
- 계획 승인 전에 root가 dispositions 파일을 읽어 finding별 ID·처분·note를 보여 준다. accepted-risk finding에는 구체적 위험, 고치지 않는 이유, 수용 근거를 덧붙이고 그 ID에 대한 명시적 동의를 받는다.
- plan coordinator가 `nesting-unavailable`을 반환하면 root가 coordinator 임무를 넘겨받고 가능한 reviewer dispatch를 계속한다. subagent가 전혀 없는 호스트에서만 generic, inline, print 순서로 내려간다.

## Code

- `rules/cli.md`, `skills/bouncer-run/references/agent-dispatch.md`: salvage 키 조건과, 보존된 report가 `미제공`일 때 Red run을 부재로 보는 규칙을 고쳤다. `test/salvage-report-docs.test.js`는 해당 문장을 찾아 의미 단위로 확인한다. 한 문장 안에 단어가 있는지만 보므로 조건을 뒤집은 문구도 통과할 수 있다는 한계가 있고, 후속으로 보류했다.
- `test/coordinator.test.js`: report의 temp 파일 쓰기와 rename이 실패하는 경우를 fs stub으로 주입한다. 실패 뒤 재시도 성공도 확인한다. stub은 pid regex로 temp 이름을 매칭하며, 정확한 경로 매칭은 후속으로 보류했다.
- `skills/bouncer-plan/SKILL.md`, `references/context-review.md`, `agents/bouncer-plan-coordinator.md`와 생성본 `.codex/agents/bouncer-plan-coordinator.toml`: 위 승인 인계와 fallback 규칙. coordinator Procedure 6이 넘기는 필드가 Output contract 목록에 빠져 있는 점은 후속으로 보류했다.
- `test/subagent-model-hook.test.js`: 20초 sleep으로 timeout을 만들던 fixture를 child 한정 `runRuntime` stub으로 바꿨다. 호출 횟수와 `--tier strong` 전달도 단언한다. 사용처가 사라진 `strongSleep` 파라미터는 제거했다.
- `test/build-release.test.js`: 내부 경로 검사를 `hasInternalPathViolation` helper로 뽑고 허용 줄(`PLANNING_ALLOWED_LINE`)과 음수 사례 5건을 추가했다. 허용 줄은 정규화 뒤 완전 일치만 인정하며 공백 변형은 허용하지 않는다.
- `test/review-dispatch.test.js`: S30 단언이 `failures[].code`를 확인한다.
- `test/plan-ledger.test.js`: `git init` spawn을 `.git` 최소 메타데이터 파일로 바꿨다. 실제 `git rev-parse --git-common-dir`가 `.git`을 반환하므로 handler의 main-root 해석은 유지된다. 거절 반환값은 exit status 1까지 단언한다.

검증은 digest의 `evidence.verification`에 있는 task별 증적 다섯 건과 `evidence.review`의 최종 리뷰(1라운드)가 근거다.

## Quiz

퀴즈는 채팅에서 진행했고 답안과 점수는 기록하지 않는다.

## Tasks

### plan-workflow/retro-review-followups/001 · `f086bd34`

#### Goal & intent

RETRO 3-2의 S30 검출·실제 대기 제거·예시 경로 예외 축소를 세 기존 테스트 파일에서 완료한다. 수용 기준은 epic SC24·SC29다. 확정 verify는 `node scripts/check-task.js test/review-dispatch.test.js test/subagent-model-hook.test.js test/build-release.test.js`다.

#### Current behavior

- malformed `review_risk`의 tier plan 사례는 `ok === false`와 등급 부재만 확인한다(`test/review-dispatch.test.js:2530`). CLI 구조 실패 사례도 오류의 구체적인 코드를 확인하지 않는다(`:1758`). Plan 구조 실패의 S30은 `failures[].code`에 있고 `error`는 `structural validation failed`다(`packages/cli/src/review-dispatch.ts:632`). 오류 필드를 `reason`으로 추측하면 안 된다.
- 기본 조회와 strong 조회 timeout 테스트는 `sleep 30`을 사용한다(`test/subagent-model-hook.test.js:163`, `:338`). 운영 상수 20000은 조회 두 곳에 전달된다(`hooks/subagent-model.js:10`, `:55`, `:102`).
- 배포 문서 검사는 `rules/planning.md` 전체를 `examples`에서 제외한다(`test/build-release.test.js:194`). 실제 예외가 필요한 줄은 ``- `packages/cli/package.json` `` 한 줄이다(`rules/planning.md:207`).
- I/O: hook은 `runRuntime`을 module load 때 구조 분해한다(`hooks/subagent-model.js:4`). 기존 hook 테스트는 별도 Node 프로세스의 stdout·stderr·exit를 관찰한다(`test/subagent-model-hook.test.js:11`).
- 조사 중 원래 timeout 테스트는 실행하지 않았다. 코드에서 대기 경로를 확인했으며 실행 성공을 주장하지 않는다.

#### Target behavior

- 성공: 두 malformed plan 사례가 S30을 직접 단언한다. timeout 두 사례는 실제 대기 없이 각각 차단·slot fallback을 구분한다. 허용 예시 줄은 통과한다.
- 실패 검출: 다른 이유의 plan 실패로는 S30 테스트가 통과하지 않는다. planning 문서의 다른 내부 경로와 다른 문서의 동일 경로는 거절한다.
- 보존: 운영 훅·runtime 구현, 20000ms 상수, 기존 모델·effort·오류 복구 안내와 다른 파일의 기존 예시 예외는 유지한다.

#### Interface

- 제공: 테스트 전용 Node child에서 `runtime-cli.runRuntime`을 먼저 stub하고 hook을 require한 뒤 `handle(raw)`를 호출한다. child stdout·stderr와 hook 반환값을 기존 invoke 결과와 같은 방식으로 관찰한다.
- 주입: `runRuntime(args: string[], opts: {cwd, input, timeoutMs})` stub은 `{found:true,status:null,signal:'SIGTERM',stdout:'',stderr:'',error:{code:'ETIMEDOUT'}}`를 반환한다. 기본 timeout은 1회, strong timeout은 정상 JSON 1회 뒤 timeout 1회다. 모든 `timeoutMs === 20000`, 두 번째 argv의 `--tier strong`을 확인한다.
- 경로 판정: 테스트 파일 내부에 추출한 helper는 `(relativePath: string, markdown: string)`을 받아 내부 경로 위반 여부를 판정한다. `rules/planning.md`에서 전체 줄이 정확히 ``- `packages/cli/package.json` ``인 경우만 예외다. CRLF는 줄 구분으로만 정규화한다.
- 거부: production 환경 변수·새 timeout 설정·운영 API 추가, 다른 문서나 경로 접미사까지 허용하는 넓은 예외.

#### Touch

| 경로 | 심볼 | 변경 | 현재 책임 | 계획한 변경 | 근거 |
| --- | --- | --- | --- | --- | --- |
| `test/review-dispatch.test.js` | `tierPlan`, malformed risk·CLI 구조 실패 사례 | Modify | 실패와 reviewer 부재 확인 | 두 plan 사례에 S30 코드 존재 단언 | `test/review-dispatch.test.js:1758,2530`; plan 실패 shape 소비자 |
| `test/subagent-model-hook.test.js` | `runHook`, timeout 사례 | Modify | 실제 sleep으로 timeout 실행 | child 내부 조회 stub과 호출 argv·20000ms 단언 | `test/subagent-model-hook.test.js:11,163,338`; runtime 전달 소비자는 `test/hook-runtime-cli.test.js:98`이며 계약 유지 |
| `test/build-release.test.js` | `examples`, 신규 추출 지점: 문서 내부 경로 판정 | Modify | 파일 단위 예시 예외 | planning의 한 줄 예외와 음수 사례 | `test/build-release.test.js:194`; `rules/planning.md:207` |

#### Constraints

- 기존 단언의 삭제·완화는 금지한다. 변경 허용은 이름 `runtime timeout → exit 2 with timeout and recovery guidance`와 `strong lookup timeout → config model replaces it without blocking`의 대기 fixture 교체다. exit·복구 안내·slot 결과 단언은 그대로 보존하고 호출 횟수·timeout 전달을 추가한다.
- S30은 `failures[].code`를 사용한다. 문자열 `reason`을 새로 만들거나 production 실패 shape를 변경하지 않는다.
- stub은 child 한정으로 설치해 module cache·전역 stream이 다른 테스트에 누출되지 않게 한다. 정상 종료하는 가짜 bin만으로 timeout 검출을 대체하지 않는다.
- path helper의 추출 외 검사 대상·다른 예시 파일 목록은 변경하지 않는다. 제목은 `<subject> → <expectation>`, ts/js 줄은 120자 이내를 지킨다.

### plan-workflow/retro-review-followups/002 · `eade298a`

#### Goal & intent

RETRO 3-3의 report-only salvage 설명과 Red run 부재 규칙을 맞추고 report write·rename 실패의 보존·정리 계약을 테스트한다. 수용 기준은 epic SC25·SC29다. 확정 verify는 `node scripts/check-task.js test/coordinator.test.js test/salvage-report-docs.test.js`다.

#### Current behavior

- runtime report만 있는 clean worker도 salvage에 들어간다(`packages/cli/src/coordinator-prepare.ts:550,856`; `test/coordinator.test.js:6303`). `rules/cli.md:360`은 clean worker에는 키가 없다고 설명한다.
- latest report의 literal `미제공`은 부재로 명시했지만 preserved report의 같은 값은 명시하지 않았다(`skills/bouncer-run/references/agent-dispatch.md:173,176`).
- report conflict 테스트는 temp 생성 전 충돌을 확인한다. temp write·rename 실패는 확인하지 않는다(`test/coordinator.test.js:6342`). 이미 생성한 patch의 partial salvage를 반환하는 코드는 있다(`packages/cli/src/coordinator-prepare.ts:849`).
- I/O: `copyLatestReport`는 `fs.writeFileSync(temp, bytes)` 후 `fs.renameSync`를 호출하며 catch에서 temp를 best-effort 제거한다(`packages/cli/src/coordinator-prepare.ts:442–449`). report copy는 patch 뒤·ref 생성 앞이다(`:543,552,561`). 원장 결정·worker 제거는 전체 보존 성공 뒤다(`:863,1024`).
- 재현 기반은 `salvageFixture`, `writeWorkerReports`, `prepareAgain`이다(`test/coordinator.test.js:2956,6292,6298`). 실행 결과를 새로 기록하지 않았다.

#### Target behavior

- 성공: patch·ref·report가 모두 없을 때만 `salvage` 키가 없다고 설명한다. report-only 성공에는 report가 있고 patch/ref가 없음을 확인한다.
- 실패: dirty revoked worker의 report temp write·rename 실패에서 `worker-salvage-failed`, 원래 오류 메시지와 이미 생성한 patch만 반환한다. final report와 정확한 temp 파일은 없고 patch는 적용 가능하다.
- 보존: worker report·사용자 파일 바이트, worker HEAD·branch HEAD·worktree 등록·원장 바이트를 유지한다. temp 파일명과 동시성 정책은 바꾸지 않는다.
- 문서: preserved Red run도 없거나 literal `미제공`이면 부재이며, 사용 가능한 보존본이 없을 때 `미제공`을 유지한다고 명시한다.

#### Interface

- 제공: 기존 public failure `{ok:false,reason:'worker-salvage-failed',task,message,salvage:[{task,patch}]}`와 report-only 성공을 검증한다. 새 failure shape를 만들지 않는다.
- 주입: 테스트 안에서 `fs.writeFileSync(path, bytes, ...)` 또는 `fs.renameSync(from, to)`를 정확한 report temp·destination에만 한정해 일시 교체한다. 실제 메서드를 저장하고 `finally`에서 복구한다.
- write 실패는 원래 메서드로 일부 temp 바이트를 쓴 후 식별 가능한 오류를 throw한다. rename 실패는 temp가 존재하는 호출에서 식별 가능한 오류를 throw한다. 비대상 경로는 원래 메서드로 위임한다.
- 거부: partial salvage에 `report`, `ref`, `head`, `generation`, `dirty_paths`를 추가하는 동작 변경. 테스트를 위해 runtime deps나 환경 변수는 추가하지 않는다.

#### Touch

| 경로 | 심볼 | 변경 | 현재 책임 | 계획한 변경 | 근거 |
| --- | --- | --- | --- | --- | --- |
| `rules/cli.md` | coordinate prepare salvage 설명 | Modify | clean worker에 키 없음으로 기술 | 보존할 patch·ref·report가 모두 없는 조건으로 한정 | `rules/cli.md:355–361`; 실제 report-only 소비자 `test/coordinator.test.js:6303` |
| `skills/bouncer-run/references/agent-dispatch.md` | `RED_RUN` 보존본 fallback | Modify | preserved report의 literal 값 불명시 | `미제공`도 부재라는 규칙 명시 | `skills/bouncer-run/references/agent-dispatch.md:173–176` |
| `test/coordinator.test.js` | `salvageFixture`, report 보존 사례 | Modify | 성공·충돌 경로 검증 | write·rename 주입 실패 및 부분 출력·원본 보존·temp 정리 검증 | `test/coordinator.test.js:2956,6303,6342`; `coordinator-prepare.ts:442–449,849` |
| `test/salvage-report-docs.test.js` | salvage 문서 계약 사례 | Modify | report 경로와 대체 출처 검증 | report-only와 보존본 literal 부재 문서 계약 검증 | `test/salvage-report-docs.test.js:17,21` |

#### Constraints

- fs stub은 fixture 준비 뒤·한 prepare 호출 동안만 설치하고 병렬 test 옵션을 켜지 않는다. 모든 예외 경로에서 원복한다.
- 기존 단언은 삭제·완화하지 않는다. 기존 clean worker 테스트의 이름/설명만 patch·commit·report가 모두 없는 조건으로 한정할 수 있으며, 기존 키 부재 단언은 유지한다.
- 문서 수정은 salvage 조건과 Red run 해석 문장으로 제한한다. 명령·CLI 스키마·출력 순서·다른 review 경로는 유지한다.
- 새 문서 계약 단언은 대상 문단을 찾아 의미 단위로 확인한다. 전체 문서의 문장 순서나 공백을 고정하지 않는다.

### plan-workflow/retro-review-followups/003 · `a3aa03d4`

#### Goal & intent

#287 이월 항목 중 SEC-001·SS-001과 출처·fallback이 확인된 advisory를 계획 문서·역할·계약 테스트에 반영한다. 수용 기준은 epic SC26·SC29다. 확정 verify는 `node scripts/check-task.js test/skill-bouncer-surface.test.js test/skill-context-review.test.js test/agents.test.js`다.

#### Current behavior

- step 5와 coordinator는 dispositions JSON 작성·질문·승인 뒤 close를 요구하지만, root가 동의 전에 그 내용을 표시하라는 규칙은 없다(`skills/bouncer-plan/SKILL.md:312`, `agents/bouncer-plan-coordinator.md:66`). context-review는 accepted note와 명시적 위험 수용을 요구한다(`skills/bouncer-plan/references/context-review.md:244–247`).
- step 3 끝에는 작성 후 후보를 제시하라는 주체 없는 옛 문장이 남아 있다(`skills/bouncer-plan/SKILL.md:294`). 현재 설계는 discovery checkpoint에서 경로 후보를 확인하고 planner가 그 집합으로 작성한다(`:297–300`).
- 최종 승인 표시는 경로를 보여 주라고만 하며 task frontmatter에서 직접 읽는다고 명시하지 않는다(`skills/bouncer-plan/SKILL.md:348–354`).
- fallback 한 문단이 nesting만 불가한 호스트와 subagent 자체가 없는 호스트를 합친다(`skills/bouncer-plan/SKILL.md:383`). 기존 표면 테스트는 이 문장을 그대로 고정한다(`test/skill-bouncer-surface.test.js:243–262`).
- I/O: 역할 원본은 `mdToCodexToml`의 생성 입력이며 TOML parity는 기존 테스트가 확인한다(`packages/cli/src/codex-agents.ts:46`; `test/agents.test.js:57–61`). 본 task는 runtime I/O나 상태 schema를 바꾸지 않는다.

#### Target behavior

- 동의 전 표시: root가 dispositions 파일을 읽어 각 finding의 ID·처분·note를 사용자에게 보여 준다. accepted-risk 대상에는 구체적인 위험·미수정 이유·수용 근거를 덧붙이고 해당 ID에 대한 명시적 동의를 받은 뒤 close한다.
- 경로 출처: 최종 승인 화면의 task별 `affected_paths`는 root가 해당 task frontmatter에서 직접 읽는다. coordinator 요약을 정본으로 대신 쓰지 않는다.
- 작성 handoff: step 3의 예전 표시 지시를 제거하거나 checkpoint 역할에 맞춰 좁힌다. 작성 중 기존 확인 집합 밖 경로가 필요하면 `needs_user`와 새 `plan.affected_paths` 확인으로 돌아간다.
- fallback: nesting만 불가하면 root가 coordinator 책임을 현재 ledger phase에서 이어받고 가능한 reviewer dispatch를 수행한다. subagent 자체가 없을 때만 기존 generic·inline·print fallback 순서를 따른다. review에서는 `route.next_action`을 따르고 승인 경계와 라운드 한도를 유지한다.
- 보존: step 1–8, 기존 ACQ ID와 소유권, 사용자 승인 없는 close·plan approve 금지, ledger schema, 모델 등급·리뷰 라운드 정책은 유지한다.

#### Interface

- 제공: 사용자 동의에 필요한 표시·역할 분담의 문서 계약과 해당 계약을 확인하는 기존 테스트. disposition shape `{id,status,note}`와 CLI 인자는 바꾸지 않는다.
- 승인 입력의 정본은 context-review finding/dispositions와 task frontmatter다. 원장 질문·subagent 요약·동의 문구 자체가 gate 결과를 대신하지 않는다.
- 거부: accepted-risk를 plan 승인으로 취급, `answer.text`로 close 완료 추론, 일반 blocked를 nesting fallback으로 취급, 확인된 경로 밖의 조용한 scope 확대.
- 테스트 seam은 없다. 의미상 step/heading을 찾아 역할·조건·출처를 검증하며 문서 전체 문장 순서나 공백을 새로 고정하지 않는다.

#### Touch

| 경로 | 심볼 | 변경 | 현재 책임 | 계획한 변경 | 근거 |
| --- | --- | --- | --- | --- | --- |
| `skills/bouncer-plan/SKILL.md` | step 3·5·6, Fallback | Modify | checkpoint·리뷰·최종 승인 절차 | 옛 후보 문장 정리·dispositions 표시·FM 직접 읽기·fallback 분기 | `skills/bouncer-plan/SKILL.md:294,312,354,383`; 소비자 `test/skill-bouncer-surface.test.js:243` |
| `skills/bouncer-plan/references/context-review.md` | close·accepted-risk 안내 | Modify | close 전 동의와 처분 계약 | root의 finding·근거 표시 의무를 본문과 일치 | `skills/bouncer-plan/references/context-review.md:244–247`; 소비자 `test/skill-context-review.test.js:80` |
| `agents/bouncer-plan-coordinator.md` | Procedure 6·Output contract | Modify | dispositions 파일과 사용자 질문 반환 | root 표시용 finding·위험·note handoff 명시 | `agents/bouncer-plan-coordinator.md:66`; 생성 입력 |
| `.codex/agents/bouncer-plan-coordinator.toml` | `developer_instructions` | Modify | 역할 원본 생성본 | 로컬 `mdToCodexToml`로 재생성 | 생성본 쌍; `test/agents.test.js:57–61` |
| `test/skill-bouncer-surface.test.js` | plan 위임·승인 경계 사례 | Modify | 기존 문장·ACQ 절차 검증 | 표시·FM 출처·fallback 두 조건 단언 | `test/skill-bouncer-surface.test.js:243–262` |
| `test/skill-context-review.test.js` | close·accepted-risk 사례 | Modify | route와 close 경계 검증 | consent 전 표시와 ID별 명시 동의 단언 | `test/skill-context-review.test.js:80` |

#### Constraints

- 기존 단언 중 `plan skill → delegates to the plan coordinator and keeps approvals with the root`의 nesting fallback 한 문장 기대만 새 두 조건으로 교체할 수 있다. root 전용 명령·경로 재확인·일반 blocked 중단·gate 뒤 ledger close 단언은 유지한다.
- 원문이 없는 문서 완결성·문장 순서 advisory와 unrelated 영문 편집은 포함하지 않는다. 단계 재번호·ACQ 추가·삭제를 하지 않는다.
- 역할 원본을 바꾸면 지정된 TOML만 생성기로 갱신한다. 다른 에이전트 TOML이나 설치된 plugin 캐시를 수정하지 않는다.
- CLI `--dispositions`의 기존 값 전달·파싱 계약을 변경하지 않는다. 원본과 생성본의 동기화는 로컬 generator와 parity 테스트를 기준으로 한다.

### plan-workflow/retro-review-followups/004 · `9638dd1f`

#### Goal & intent

#287의 SS-003·CT-002를 처리해 임시 git fixture 생성에서 spawn을 제거하고 status의 잘못된 ID·없는 ID 반환값을 단언한다. 수용 기준은 epic SC27·SC29다. 확정 verify는 `node scripts/check-task.js test/plan-ledger.test.js`다.

#### Current behavior

- `repo()`는 임시 디렉터리마다 `spawnSync('git',['init','-q'])`를 실행한다(`test/plan-ledger.test.js:13–16`).
- `cli()`는 Node child에서 실제 `runCli`를 실행한다. child의 종료 0과 CLI 핸들러 반환값을 구분해 결과의 `status`에 담는다(`test/plan-ledger.test.js:19–29`).
- bad ID·없는 ID는 JSON reason만 확인하고 non-git root만 `status === 1`을 확인한다(`test/plan-ledger.test.js:197–206`).
- I/O: handler는 `runtimePaths`로 main root를 해석하며 실제 `git rev-parse --git-common-dir`를 호출한다(`packages/cli/src/cli-plan-ledger-command.ts:64`; `runtime-state.ts:524`). 따라서 fixture 생성 spawn 제거가 전체 테스트의 unit 전환을 뜻하지 않는다. 현재 integration tier다(`test/tiers.json:54–55`).
- 최소 구조 `.git/HEAD`의 `ref: refs/heads/main`, `.git/objects/`, `.git/refs/`를 만들면 `git rev-parse --git-common-dir`가 `.git`을 반환함을 조사 중 실제 Git으로 확인했다. fixture 검증용 디렉터리는 제거했다.

#### Target behavior

- 성공: filesystem만으로 최소 Git 메타데이터를 만들어 현재 fixture의 main-root 인식을 유지한다. 모든 기존 CLI integration 사례가 통과한다.
- 실패: bad ID와 없는 유효 ID 모두 반환값 1과 정확한 기존 reason을 단언한다. non-git 사례의 기존 거절도 유지한다.
- 보존: real CLI child·Git 조회·원장 checkpoint·파일 불변·phase·planner 회수 단언과 integration tier는 유지한다.

#### Interface

- 제공: 테스트 helper `repo() → realpath 임시 디렉터리`의 반환 계약은 같다. 생성 과정은 `.git/HEAD`·objects·refs를 filesystem으로 만든다.
- 거부: fixture가 상위 저장소 `.git`을 우연히 찾아 성공하는 구조, 실제 CLI를 가짜 ledger 호출로 대체, runtime seam·public API 추가, 테스트 전체를 unit으로 이전.
- status는 wrapper Node의 process exit가 아니라 기존 helper가 노출하는 `runCli` 반환값이다. wrapper 정상 종료 확인을 제거하지 않는다.
- 새 production injection parameter는 없다. fixture의 세 메타데이터와 기존 실제 CLI 실행이 검증 경계다.

#### Touch

| 경로 | 심볼 | 변경 | 현재 책임 | 계획한 변경 | 근거 |
| --- | --- | --- | --- | --- | --- |
| `test/plan-ledger.test.js` | `repo`, status 거절 사례 | Modify | git init fixture와 ledger CLI 계약 검증 | fixture 생성 spawn 제거·bad/missing status 반환값 1 단언 | `test/plan-ledger.test.js:13,197`; root 소비자 `packages/cli/src/runtime-state.ts:524` |

#### Constraints

- 이전 fixture 구현을 복원했다는 이력 주장을 하지 않는다. 이력에서 이전 무spawn 구현은 찾지 못했으므로 관찰 가능한 생성 spawn 제거로 완료를 판단한다.
- 기존 단언·CLI 결과 helper와 integration 배정은 유지한다. 실제 child process의 성공과 핸들러 거절을 혼동하지 않는다.
- 테스트 이름 규칙·120자 제한을 지키며 다른 파일에 범용 fixture 추상화를 추가하지 않는다.

### plan-workflow/retro-review-followups/005

#### Goal & intent

네 구현 task가 모두 integrated된 뒤 전체 CI로 테스트·문서·생성본의 결합을 검증한다. 수용 기준은 epic SC28·SC29다. 검증 명령은 frontmatter의 `verify`를 따른다.

#### Current behavior

구현 task는 각자 변경 파일에 해당하는 task verify만 실행한다. 전체 CI는 이 terminal fan-in에서 실행한다.

#### Target behavior

- 성공: 모든 선행 task의 통합 이후 전체 CI를 실행하고 CLI가 검증 증적을 기록한다.
- 실패: source를 수동 수정하거나 성공을 기록하지 않고 coordinator의 기존 terminal failure 복구 절차로 반환한다.

#### Interface

- 제공: 구현 task가 모두 통합된 뒤 전체 검증 명령을 한 번 실행해 남기는 종단 검증 증적. 구현 task는 각자 task 전용 명령만 갖는다.
- 거부: source 변경, review 문서, commit.

#### Touch

Source 변경 경로 없음.

#### Constraints

- `affected_paths: []`, `parallel_safe: false`, 모든 구현 task 의존을 유지한다.
- 검증 성공·실패 증적은 CLI만 쓴다. 검증 명령을 본문에서 재정의하지 않는다.