---
type: bouncer.blueprint
title: read-only 디버거 서브에이전트 추가
description: bouncer-debugger 에이전트·4단계 debugging 스킬·execute verify 실패 배선
resource: .bouncer/context/epics/015-workflow-ergonomics/blueprints/004-debugger-agent/index.md
tags:
  - bouncer
  - blueprint
timestamp: '2026-08-06T09:12:53.161+09:00'
bouncer:
  id: '004'
  epic_id: '015'
  blueprint_id: '004'
  status: approved
  commit_type: feat
  commit_intent:
    - verify 실패 조사를 전담 에이전트에 맡김
    - 근본원인 없이 고치는 시도를 막음
---
# 004 debugger-agent

Epic: [015](../../index.md)

## Intent
- 문제: verify가 깨지면 컨트롤러가 조사와 수정을 한 맥락에서 같이 한다. 증상만 보고 고치기 쉽고, 조사 과정이 리뷰 가능한 산출물로 남지 않는다. `debugging` 스킬은 5줄짜리 흐름뿐이라 근본원인 우선을 강제하지 못한다.
- 완료 조건: read-only `bouncer-debugger`가 근본원인 리포트를 반환하고, `debugging` 스킬이 4단계 절차로 갱신되며, `/bouncer-execute` verify 실패가 이 에이전트로 물린다. 015 성공 조건 5.

## Contract
- 인터페이스: `agents/bouncer-debugger.md` — `name: bouncer-debugger`, `model: inherit`, `readonly: true`. 반환은 근본원인 리포트만: 재현 명령·관측 결과, 증거(파일:행), 단일 가설, 제안하는 최소 수정과 그 위치, 필요한 회귀 테스트의 형태.
- 인터페이스: 4단계 절차 — (1) 근본원인 조사(에러 전문 읽기·일관 재현·최근 변경 확인·경계별 증거 수집·데이터 흐름 역추적) (2) 패턴 분석(같은 레포의 동작하는 예시와 비교) (3) 단일 가설·최소 검증 (4) 최소 수정과 재검증. 수정 시도가 3회 실패하면 아키텍처를 의심하고 사용자에게 escalate한다.
- 인터페이스: `skills/debugging/SKILL.md`를 같은 4단계로 갱신한다. 이 스킬이 에이전트의 행동 브리프이고, 에이전트 문서는 페르소나·권한·출력 계약을 담는다(`bouncer-reviewer` ↔ `skills/review` 관계와 동일).
- 인터페이스: `/bouncer-execute` step 4에서 verify 실패 시 `resolveSubagentModel('bouncer-debugger')` → 네임드 호출 → 슬러그 거절 시 `inherit` 재시도 → 네임드 미지원이면 `debugging` 스킬 인라인 폴백. 리포트를 받은 뒤 수정은 `bouncer-implementer` 또는 컨트롤러가 한다.
- 데이터·상태: `subagents` 설정(`config.example.json`, `init` 기본값)의 provider 블록마다 `bouncer-debugger: inherit`를 추가한다.
- 수용 기준: 015 성공 조건 5. `test/agents.test.js`가 세 에이전트를 돌고, `test/init.test.js`가 새 기본값을 고정한다.
- 검증 명령: `npm test`
- 실패 모드·엣지 케이스: 조사 결과 근본원인이 환경·타이밍·외부 요인이면 그 사실과 조사한 범위를 리포트로 남긴다. 같은 실패에 대해 디버거를 무한 재디스패치하지 않는다 — 재시도 상한을 두고 그 뒤에는 사용자에게 넘긴다. 제안 수정이 `affected_paths` 밖이면 수정하지 말고 `/bouncer-plan` escalate로 보고한다. Codex는 `agents/`를 배포하지 못하므로 항상 인라인 폴백이다.

## Out of scope
- 디버거에 파일 수정·커밋·문서 상태 전환 권한 부여.
- superpowers 보조 문서(`root-cause-tracing.md`·`defense-in-depth.md`·`condition-based-waiting.md`) 복제.
- `docs/ARCHITECTURE.md` §4 generic skills 표 변경 — `debugging`은 이미 등재돼 있다.
- Codex 네임드 에이전트 라우팅 도입.
- 신규 게이트 코드·CLI.

## One-commit justification
에이전트 문서·행동 브리프·디스패치 지점·설정 기본값·이름 테스트가 하나의 계약이라, 나눠 커밋하면 이름이 있는데 부를 곳이 없거나 부르는데 문서가 없는 중간 상태가 생긴다.

## Documents
* [Tasks](tasks.md) - 구현 브리프
* [Verification](verification.md) - 검증 명령과 증적
* [Review](review.md) - 리뷰 발견사항
<!-- explain.md는 plan scaffold에 포함되지 않습니다. /bouncer-finalize가 작성합니다. -->
