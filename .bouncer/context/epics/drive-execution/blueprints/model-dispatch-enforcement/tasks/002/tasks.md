---
type: bouncer.tasks
title: Claude 호출 훅의 설정 모델 보정 추가
description: Correct Claude Bouncer Agent model inputs through a public runtime CLI hook.
resource: .bouncer/context/epics/drive-execution/blueprints/model-dispatch-enforcement/tasks/002/tasks.md
tags:
  - bouncer
  - tasks
  - subagent
  - model
  - dispatch
timestamp: '2026-10-26T14:14:47.961+09:00'
bouncer:
  id: TASKS-002
  epic_id: drive-execution
  blueprint_id: model-dispatch-enforcement
  status: verified
  execution_kind: commit
  depends_on:
    - TASKS-001
  parallel_safe: false
  dependency_gate: integrated
  affected_paths:
    - hooks/subagent-model.js
    - hooks/hooks.json
    - test/subagent-model-hook.test.js
    - test/tiers.json
  commit_intent:
    - Claude의 Bouncer Agent 호출에서 모델 누락과 불일치를 config 값으로 보정하고 변경 사실을 전달하도록 함.
  commit_summary: []
  exclusive_resources: []
  review_risk:
    - public_interface
  verify: node --test test/subagent-model-hook.test.js test/hook-runtime-cli.test.js
  commit_sha: 7c531e9a
---
# Claude 호출 훅의 설정 모델 보정 추가

Blueprint: [model-dispatch-enforcement](../../index.md)

## Goal & intent
Claude의 Bouncer Agent 호출에서 모델 누락과 불일치를 config 값으로 보정하고 변경 사실을 전달하도록 함.
수용 기준은 blueprint Contract의 작업 002 항목이며 전용 검증은 아래 Checklist와 frontmatter에 둔다.

## Current behavior
hooks/hooks.json의 PreToolUse는 Bash commit guard만 등록한다. hooks/runtime-cli.js는 공개 bouncer 실행 파일을 찾아 shell:false로 실행하는 runRuntime을 제공한다. named Agent의 model 누락·불일치를 보정하는 경로가 없다.

관찰: hooks/hooks.json:3, hooks/commit-safety.js:11. I/O: hooks/runtime-cli.js:121의 runRuntime은 spawnSync와 shell:false를 사용하고 자식 환경에 plugin root를 주입한다. 테스트: test/hook-runtime-cli.test.js:225. 조사 HEAD 9cab1962edb316460fc22b1f57660e645f460e2b 기준 관련 파일 diff가 없어 근거를 재사용한다.

## Target behavior
다섯 Bouncer 역할의 Claude Agent 호출에 한정해 공개 CLI로 claude 슬롯을 조회한다. slug이면 누락·다른 model을 해당 문자열로 바꾸고, inherit이면 명시 model을 제거한다. 같은 값이거나 상속에 model이 없으면 보정하지 않는다. 다른 도구·다른 에이전트에는 모델 조회나 입력 변경을 하지 않는다. 보정 시 additionalContext에 역할·이전값·설정 모델명·보정값과 사용자 보고 지시를 한국어로 넣는다. 컨트롤러는 이 내용을 사용자에게 알린다.

## Interface
신규 hooks/subagent-model.js는 JSON stdin의 {tool_name, tool_input, cwd}를 받고 stdout에는 유효한 hook JSON만 쓴다. tool_input.subagent_type은 canonical bouncer-<role> 또는 bouncer:bouncer-<role>만 인식한다. 역할은 reviewer/debugger/implementer/coordinator/context-reviewer 다섯 개다. stdout의 hookSpecificOutput.updatedInput에는 원래 tool_input을 보존한 전체 객체를 넣고 model만 변경한다. hookSpecificOutput.additionalContext로 변경 사실을 전달하며 permissionDecision:allow는 설정하지 않는다. Claude provider는 공개 명령 subagent-model --agent <canonical> --provider claude --repo <cwd>로 고정한다. runRuntime(args,{cwd,input,timeoutMs:20000})을 재사용해 내부 runtime 모듈을 require하지 않는다. 정상 stdout은 정확히 한 줄의 slug 또는 inherit로만 허용한다. 모델 토큰은 ASCII 영문·숫자로 시작하고 나머지는 ASCII 영문·숫자 및 `._:/@+[]-` 문자만 허용한다. 예시는 `claude-opus-5-5`, `opus`, `claude-opus-5-5[1m]`이다. 끝의 LF 또는 CRLF 하나만 제거하며 앞뒤 공백·중간 공백·제어 문자·둘 이상의 줄은 허용하지 않는다. 이는 구문 검사이며 모델 카탈로그 검증은 아니다. 단일 토큰이 실제 모델인지 여부는 호스트가 판정하고 거절 시 공통 중단 규칙을 따른다. 관련 호출의 cwd 형식 오류·runtime 미발견·timeout·비정상 exit·빈 출력·다중 줄 출력은 exit 2로 차단하고 역할·설정 확인 명령·원인을 stderr에 쓴다. JSON 파싱 실패 또는 대상 판별 불가는 입력을 보정하지 않고 종료한다. 훅은 모델 존재를 검증하거나 실제 실행 모델을 증명하지 않는다.

## Touch
| 경로 | 심볼 | 변경 | 현재 책임 | 계획한 변경 | 근거 |
| --- | --- | --- | --- | --- | --- |
| `hooks/subagent-model.js` | `신규 추출 지점: Claude Agent 모델 보정` | Create | 해당 없음: 새 훅 | 공개 CLI 조회·입력 보존·보정·차단 | 사용자가 모델 보정 훅 추가를 승인함; hooks/commit-safety.js:11 |
| `hooks/hooks.json` | `PreToolUse` | Modify | Claude 훅 등록 | Agent matcher에 새 훅 등록 | hooks/hooks.json:3 |
| `test/subagent-model-hook.test.js` | `신규 추출 지점: hook 프로세스 회귀` | Create | 해당 없음: 새 사례 | 격리 CLI stub과 실제 stdin/stdout으로 훅 검사 | 신규 훅의 공개 경계; test/hook-runtime-cli.test.js:225 |
| `test/tiers.json` | `integration` | Modify | 테스트 tier 배정 | 실제 프로세스를 실행하는 신규 테스트 등록 | test/tiers.json:integration; test/hook-runtime-cli.test.js:225 |

## Do not touch
- `.bouncer/config.json`
- `packages/cli/dist`
- `scripts/lib`
- `AGENT-TEST-GUIDELINES-PROPOSAL.md`
- `GRAPHIFY-WORKFLOW-PROPOSAL.md`

## Constraints
최소 구성: 기존 runRuntime과 subagent-model CLI를 재사용한다. 새 dependency·설정 프로필·중개 agent는 추가하지 않고 독립 훅과 그 프로세스 테스트 두 파일만 만든다.
정확한 Bouncer 이름만 매칭하고 임의 suffix·다른 플러그인 namespace를 허용하지 않는다. config 전체와 prompt는 알림·오류에 출력하지 않는다. argv 배열과 JSON 직렬화를 사용하고 shell 명령 문자열로 조합하지 않는다. 기존 훅과 권한 판정을 보존한다. 모델 거절 후 inherit 재시도는 허용하지 않는다. 기존 테스트 기대값은 변경하지 않고 새 테스트만 추가한다.
영향 경로는 plan.affected_paths에서 사용자가 확인한 값이다. 검증 명령은 plan.verify_command에서 사용자가 확인했다.

## Checklist
- [ ] 새 테스트 파일을 추가하고 격리 fake bouncer가 한 줄의 claude-opus-5-5를 출력하도록 한다. hook 파일이 생기기 전에는 등록 및 구현 부재를 명시적으로 검사하는 assertion이 첫 Red가 되게 하며 require 모듈 오류를 Red로 쓰지 않는다.
- [ ] 훅 등록·모델 누락·불일치·동일값·inherit 제거·plugin namespace·알 수 없는 역할을 입력해 전체 updatedInput과 additionalContext 값을 검사한다. 기존 prompt·권한 관련 필드가 보존되어야 한다.
- [ ] runtime 부재·timeout·실패·잡음·다중 줄 출력의 exit 2와 한국어 원인·복구 안내를 검사한다. 한 줄 진단문 `warning: model unavailable`, 앞뒤 공백이 있는 ` opus`, 제어 문자가 있는 토큰은 exit 2이며 단일 모델 토큰과 끝의 LF 또는 CRLF 하나는 허용됨을 검사한다. 비대상 호출은 stub 실행 시 실패하도록 구성해 불필요한 runtime 호출이 없는지 검사한다.
- [ ] 신규 프로세스 테스트를 integration tier에 등록하고 아래 전용 검증 명령으로 완료 여부를 판단한다.

확인한 전용 검증:

```bash
node --test test/subagent-model-hook.test.js test/hook-runtime-cli.test.js
```
