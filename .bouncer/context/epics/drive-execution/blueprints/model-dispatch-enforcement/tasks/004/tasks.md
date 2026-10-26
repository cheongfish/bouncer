---
type: bouncer.tasks
title: 모델 디스패치 변경의 플러그인 버전 갱신
description: Release plugin 0.1.12 with the required runtime compatibility range.
resource: .bouncer/context/epics/drive-execution/blueprints/model-dispatch-enforcement/tasks/004/tasks.md
tags:
  - bouncer
  - tasks
  - subagent
  - model
  - dispatch
timestamp: '2026-10-26T14:14:48.064+09:00'
bouncer:
  id: TASKS-004
  epic_id: drive-execution
  blueprint_id: model-dispatch-enforcement
  status: verified
  execution_kind: commit
  depends_on:
    - TASKS-001
    - TASKS-002
    - TASKS-003
  parallel_safe: false
  dependency_gate: integrated
  affected_paths:
    - plugin.json
    - .claude-plugin/plugin.json
    - .claude-plugin/marketplace.json
    - .codex-plugin/plugin.json
    - .cursor-plugin/plugin.json
    - rules/plugin-root.md
    - test/plugin-root.test.js
    - CHANGELOG.md
    - package.json
    - packages/cli/package.json
    - package-lock.json
    - README.md
  commit_intent:
    - 모델 디스패치 변경이 완료된 플러그인을 0.1.12로 올리고 필요한 런타임 범위를 명시함.
  commit_summary: []
  exclusive_resources: []
  review_risk:
    - public_interface
  verify: node --test test/plugin-root.test.js
  scope_revision: r1
  commit_sha: c362791f
---
# 모델 디스패치 변경의 플러그인 버전 갱신

Blueprint: [model-dispatch-enforcement](../../index.md)

## Goal & intent
모델 디스패치 변경이 완료된 플러그인을 0.1.12로 올리고 필요한 런타임 범위를 명시함.
수용 기준은 blueprint Contract의 작업 004 항목이며 전용 검증은 아래 Checklist와 frontmatter에 둔다.

## Current behavior
Plugin 정본과 네 파생 manifest는 0.1.11이고 runtimeCompatibility는 >=0.1.11 <0.2.0이다. runtime 정본·workspace·lock은 이번 세션에서 0.1.14로 변경되어 있다. 기존 changelog의 runtime 0.1.14 항목을 보존해야 한다.

관찰: plugin.json:4·5; package.json:3; CHANGELOG.md:13. I/O: scripts/sync-versions.js:77·81·88에서 runtime/plugin 정본을 따로 읽고 :104 이후 파생 metadata를 쓴다. 테스트: test/plugin-root.test.js:98·101, test/release-runtime.test.js:262. 별도 읽기 전용 조사로 현재 미커밋 버전 변경을 확인했고 runtime 0.1.14 보존과 plugin/runtime 독립 버전을 확인했다. 새 metadata 의존성 때문에 최저 runtime은 0.1.14로 결정한다.

## Target behavior
선행 구현 통합 후 plugin.json의 version을 0.1.12로 바꾸고 npm run sync:versions로 네 plugin 파생 버전을 동기화한다. 새 metadata가 runtime 0.1.14에 의존하므로 네 plugin manifest의 runtimeCompatibility를 >=0.1.14 <0.2.0으로 맞춘다. runtime 0.1.14와 기존 설치 예시는 유지한다. 공개 게시·설치 갱신은 실행하지 않는다.

## Interface
Plugin 정본은 plugin.json이고 파생 파일은 .claude-plugin/plugin.json·.claude-plugin/marketplace.json·.codex-plugin/plugin.json·.cursor-plugin/plugin.json이다. version은 다섯 곳에서 0.1.12, runtimeCompatibility는 marketplace를 제외한 네 manifest에서 >=0.1.14 <0.2.0이다. 기존 resolver 입력 resolvePluginRoot({env:{BOUNCER_HOME:<fixture>},runtimeVersion})으로 서로 다른 plugin/runtime 버전의 허용·거절을 검사한다. runtime 0.1.14는 허용하고 0.1.13은 호환성 오류로 거절한다. rules/plugin-root.md의 과거 동일 버전 요구도 runtimeCompatibility 범위 우선·범위 없는 legacy만 동일 버전 요구로 정정한다. 새 config 키·release tag·원격 변경은 만들지 않는다.

## Touch
| 경로 | 심볼 | 변경 | 현재 책임 | 계획한 변경 | 근거 |
| --- | --- | --- | --- | --- | --- |
| `plugin.json` | `version · runtimeCompatibility` | Modify | plugin 정본 | 0.1.12와 새 최소 runtime 범위 | plugin.json:4·5; scripts/sync-versions.js:81 |
| `.claude-plugin/plugin.json` | `version · runtimeCompatibility` | Modify | Claude plugin manifest | 버전 동기화와 호환 범위 | scripts/sync-versions.js:15; .claude-plugin/plugin.json:4·5 |
| `.claude-plugin/marketplace.json` | `plugins[].version` | Modify | Claude marketplace 버전 | plugin 정본에서 동기화 | scripts/sync-versions.js:16; .claude-plugin/marketplace.json:13 |
| `.codex-plugin/plugin.json` | `version · runtimeCompatibility` | Modify | Codex plugin manifest | 버전 동기화와 호환 범위 | scripts/sync-versions.js:22; .codex-plugin/plugin.json:3·4 |
| `.cursor-plugin/plugin.json` | `version · runtimeCompatibility` | Modify | Cursor plugin manifest | 버전 동기화와 호환 범위 | scripts/sync-versions.js:23; .cursor-plugin/plugin.json:5·6 |
| `rules/plugin-root.md` | `runtime compatibility contract` | Modify | plugin-root 선택·호환 지침 | 동일 버전 강제 문장을 manifest 범위 판정과 legacy 동일 버전 fallback으로 수정 | rules/plugin-root.md:4·23; packages/cli/src/plugin-root.ts:180 |
| `test/plugin-root.test.js` | `resolvePluginRoot 호환 범위 사례` | Modify | asset root 호환 검사 | plugin 0.1.12와 runtime 0.1.14 허용·0.1.13 거절 회귀 | test/plugin-root.test.js:98·101; packages/cli/src/plugin-root.ts:180 |
| `CHANGELOG.md` | `Unreleased` | Modify | 배포 변경 이력 | 기능·거절 정책·plugin 최소 runtime 변경 기록 | CHANGELOG.md:11·13 |

## Do not touch
- `.bouncer/config.json`
- `packages/cli/dist`
- `scripts/lib`
- `AGENT-TEST-GUIDELINES-PROPOSAL.md`
- `GRAPHIFY-WORKFLOW-PROPOSAL.md`

## Constraints
기존 runtime 0.1.14 변경과 관련 설치 예시를 되돌리지 않는다. 동기화 스크립트와 기존 테스트 기대값은 수정하지 않고 호환 범위 사례만 추가한다. npm publish·git tag·push·설치 캐시 변경은 하지 않는다. manifest의 runtimeCompatibility는 자동 동기화 대상이 아니므로 네 파일에 직접 같은 범위를 반영한다.
영향 경로는 plan.affected_paths에서 사용자가 확인한 값이다. 검증 명령은 plan.verify_command에서 사용자가 확인했다.

## Checklist
- [ ] 현행 plugin.json의 version과 네 manifest의 runtimeCompatibility를 읽어 목표값과 비교하는 artifact 검사를 수행한다. baseline은 0.1.11 및 >=0.1.11 <0.2.0이므로 목표 불일치를 예상 Red로 기록한다. 과거 runtime 버전 변경을 Red 성공으로 소급 주장하지 않는다.
- [ ] 격리된 plugin 0.1.12 fixture에 >=0.1.14 <0.2.0을 주고 resolvePluginRoot에서 runtime 0.1.14가 허용되고 0.1.13이 거절되는 회귀를 추가한다. 기존 resolver가 이미 지원하는 범위이므로 이 회귀의 baseline 실패를 주장하지 않는다.
- [ ] 선행 작업이 통합된 뒤 plugin 정본·호환 범위·changelog를 변경하고 npm run sync:versions와 npm run check:versions를 실행한다. runtime metadata가 0.1.14로 보존되었는지 확인한다.
- [ ] 아래 전용 검증 명령으로 버전 갱신 작업을 마무리하고 최종 전체 CI는 TASKS-005에 맡긴다.

확인한 전용 검증:

```bash
node --test test/plugin-root.test.js
```
