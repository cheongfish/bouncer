---
okf_version: '0.1'
bouncer_schema: '0.1'
---
# Epics

* [001 cli-usability](epics/001-cli-usability/index.md) - `bouncer` CLI를 팀원이 처음 만났을 때 막히지 않게 만든다
* [003 multi-agent-plugin](epics/003-multi-agent-plugin/index.md) - 한 저장소가 Claude·Cursor·Codex 세 에이전트의 네이티브 설치 경로를 모두 제공한다
* [004 starter-kit-convergence](epics/004-starter-kit-convergence/index.md) - `sdd-agent-starter-kit`이 축적한 스펙 작성 규율을 Bouncer의 섹션 골격 안으로 옮긴다
* [005 review-depth](epics/005-review-depth/index.md) - review 스킬에 Spec/Quality 루브릭과 sibling reviewer prompt를 두고 컨트롤러가 Findings를 기록하게 한다
* [006 scripts-typescript](epics/006-scripts-typescript/index.md) - `scripts/` 구현을 TypeScript 소스로 옮기고 `tsc` CommonJS 산출로 기존 소비 경로를 유지한다
* [007 project-distill](epics/007-project-distill/index.md) - 프로젝트 공용 Distill을 plan/execute/finalize 런타임에 연결한다
* [009 agent-orchestration](epics/009-agent-orchestration/index.md) - 프로바이더별 named 서브에이전트 모델을 config로 권고하고 디스패치 시점에 적용
* [014 numeric-context-ids](epics/014-numeric-context-ids/index.md) - epic/bp 경로·메타에서 EPIC-/BP- 접두를 제거하고 마이그레이션 경로를 둔다
* [017 verify-wrapper-guidance](epics/017-verify-wrapper-guidance/index.md) - plan 단계에서 프로젝트의 검증 실행 환경을 확인하고 그 프로젝트에 맞는 단일 verify 명령을 안내한다
* [018 task-unit-commits](epics/018-task-unit-commits/index.md) - blueprint 안에 여러 task 문서를 두고 task 하나를 하나의 커밋 단위로 삼는다
* [025 graphify-bootstrap](epics/025-graphify-bootstrap/index.md) - bouncer init이 .bouncer/.venv에 graphify를 설치하고, graph-sync와 graphify-runner가 PATH 대신 그 경로를 쓴다
* [028 antigravity-host](epics/028-antigravity-host/index.md) - Bouncer를 Antigravity에서 설치·구동 가능한 네 번째 호스트로 넓힌다
* [029 release-one-zero](epics/029-release-one-zero/index.md) - 1.0 호환 약속을 지탱할 표면 정리
* [033 quality-security](epics/033-quality-security/index.md) - plan 직후 문서 정합성을 게이트로 세우고 최소화 래더와 인젝션 신뢰 경계를 명문화한다
* [034 agentic-benchmark](epics/034-agentic-benchmark/index.md) - 워크플로 밖 개발자 도구로 벤치마크 스킬을 반입해 런 사이 비교 가능한 점수를 남긴다
* [035 scripts-refactor](epics/035-scripts-refactor/index.md) - scripts/src/lib의 거대 모듈을 책임 단위로 분해하고 중복 설정 리더를 통합한다
* [039 오픈소스 1.0 공개](epics/039-open-source-one-zero/index.md) - 보안·품질·공개 계약·외부 파일럿을 닫고 플러그인 1.0을 배포한다
* [043 bouncer-cost-improvement](epics/043-bouncer-cost-improvement/index.md) - 측정 가능한 비용 절감과 경량 계획 계약으로 Bouncer의 품질 이득을 유지한다
* [045 skill-shape](epics/045-skill-shape/index.md) - 스킬 본문 골격과 구현 주석 지침을 문서로 못박는다
* [048 plugin-root-resolution](epics/048-plugin-root-resolution/index.md) - 호스트 캐시 후보에서 Bouncer 플러그인 루트를 안전하게 선택하는 계약을 정의한다
* [051 deepswe-original-benchmark](epics/051-deepswe-original-benchmark/index.md) - DeepSWE 원본 태스크 10개를 임시 클론으로 돌려 Pier 판정과 이 저장소 채점을 잇는다
* [052 deepswe-arm-comparison](epics/052-deepswe-arm-comparison/index.md) - DeepSWE 원본 배관을 실제로 도는 상태로 만들고 세 arm을 같은 조건에서 돌려 비교표 한 장을 낸다
* [053 skill-doc-defects](epics/053-skill-doc-defects/index.md) - 스킬 문서가 게이트 동작·CLI 계약과 어긋난 지점을 찾아 문서 쪽을 맞춘다
* [054 skill-context-optimization](epics/054-skill-context-optimization/index.md) - 진입 스킬이 실행 중 연쇄 로드하는 지시문을 역할별 정본화와 조건부 reference 분리로 줄이고 게이트 절차는 본문에 남긴다
* [056 unpublished-helper-skills](epics/056-unpublished-helper-skills/index.md) - 워크플로가 경로로 읽는 보조 스킬을 호스 스킬 목록에서 빼 암묵 매칭을 끊는다
* [059 audit-followup](epics/059-audit-followup/index.md) - 외부 감사가 남긴 설치·지시문·경량 경로·부채 항목을 게이트 계약을 바꾸지 않고 닫는다
* [060 graphify-search-quality](epics/060-graphify-search-quality/index.md) - 과거 결정과 코드 관계를 연결해 누락이 적고 신뢰도를 설명할 수 있는 변경 경로 후보를 만든다
