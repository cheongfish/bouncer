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
* [009 subagent-model-config](epics/009-subagent-model-config/index.md) - 프로바이더별 named 서브에이전트 모델을 config로 권고하고 디스패치 시점에 적용
* [011 graphify-signal](epics/011-graphify-signal/index.md) - 그래프 미생성을 무음으로 넘기지 않고 신호로 드러내며 스캐폴딩·산출 경로 계약을 실재 디렉터리에 맞춘다
* [014 numeric-context-ids](epics/014-numeric-context-ids/index.md) - epic/bp 경로·메타에서 EPIC-/BP- 접두를 제거하고 마이그레이션 경로를 둔다
* [015 workflow-ergonomics](epics/015-workflow-ergonomics/index.md) - 퀴즈 규모 적응·그래프 근거 구조화·PR 확인 1회·디버거 에이전트
* [016 advisor-removal](epics/016-advisor-removal/index.md) - 설정·명령·모듈·테스트·문서에서 Ponytail 어드바이저 경로를 걷어내 읽히지 않는 표면을 없앤다
* [017 verify-wrapper-guidance](epics/017-verify-wrapper-guidance/index.md) - plan 단계에서 프로젝트의 검증 실행 환경을 확인하고 그 프로젝트에 맞는 단일 verify 명령을 안내한다
* [018 task-unit-commits](epics/018-task-unit-commits/index.md) - blueprint 안에 여러 task 문서를 두고 task 하나를 하나의 커밋 단위로 삼는다
* [025 graphify-bootstrap](epics/025-graphify-bootstrap/index.md) - bouncer init이 .bouncer/.venv에 graphify를 설치하고, graph-sync와 graphify-runner가 PATH 대신 그 경로를 쓴다
* [026 context-graph-slim](epics/026-context-graph-slim/index.md) - context 그래프를 의사결정 섹션만 담은 파생 트리에서 빌드한다
* [027 history-import](epics/027-history-import/index.md) - git 히스토리를 imported status의 epic/blueprint 문서로 기계적으로 전사한다
* [028 antigravity-host](epics/028-antigravity-host/index.md) - Bouncer를 Antigravity에서 설치·구동 가능한 네 번째 호스트로 넓힌다
* [029 release-one-zero](epics/029-release-one-zero/index.md) - 1.0 호환 약속을 지탱할 표면 정리
* [031 document-schema](epics/031-document-schema/index.md) - 문서 표면을 코드와 일치시키고 1.0 호환 약속의 기준점을 번들 루트에 둔다
* [032 autonomous-run](epics/032-autonomous-run/index.md) - blueprint 하나를 task 소진까지 주행시키는 커맨드와 자율성 설정
* [033 quality-security](epics/033-quality-security/index.md) - plan 직후 문서 정합성을 게이트로 세우고 최소화 래더와 인젝션 신뢰 경계를 명문화한다
* [034 agentic-benchmark](epics/034-agentic-benchmark/index.md) - 워크플로 밖 개발자 도구로 벤치마크 스킬을 반입해 런 사이 비교 가능한 점수를 남긴다
* [035 scripts-refactor](epics/035-scripts-refactor/index.md) - scripts/src/lib의 거대 모듈을 책임 단위로 분해하고 중복 설정 리더를 통합한다
* [036 distill-sharding](epics/036-distill-sharding/index.md) - 경로 라우팅 기반 Project Distill 샤딩
* [037 distill-promotion-consent](epics/037-distill-promotion-consent/index.md) - finalize의 Distill 승격을 제안-동의 절차로 바꾸고 배치 판단 근거를 CLI로 노출
* [038 distill-worktree-base](epics/038-distill-worktree-base/index.md) - Distill base 판단 규칙을 CLI 해석기 한 곳에 두고 승격을 쓰는 checkout과 대상 파일을 일치시킨다
* [039 오픈소스 1.0 공개](epics/039-open-source-one-zero/index.md) - 보안·품질·공개 계약·외부 파일럿을 닫고 플러그인 1.0을 배포한다
* [040 scope-evidence](epics/040-scope-evidence/index.md) - 범위 판단 근거를 bouncer.scope_evidence로 분리하고 Graphify를 그 근거의 생성자로 명확히 한다
* [043 bouncer-cost-improvement](epics/043-bouncer-cost-improvement/index.md) - 측정 가능한 비용 절감과 경량 계획 계약으로 Bouncer의 품질 이득을 유지한다
* [045 skill-shape](epics/045-skill-shape/index.md) - 스킬 본문 골격과 구현 주석 지침을 문서로 못박는다
* [046 review-loop-cap](epics/046-review-loop-cap/index.md) - execute의 리뷰 fix 루프에 왕복 상한을 두고 그 숫자의 소유권을 execute로 모은다
* [047 컨텍스트 주입량 절감](epics/047-context-injection/index.md) - 포인터·브리프·Distill 프리플라이트에서 한 사이클 주입량을 줄이고 게이트 계약은 그대로 둔다
* [048 plugin-root-resolution](epics/048-plugin-root-resolution/index.md) - 호스트 캐시 후보에서 Bouncer 플러그인 루트를 안전하게 선택하는 계약을 정의한다
* [049 context-searchability](epics/049-context-searchability/index.md) - 다이제스트에 blueprint·task 층위를 넣고 결정 계보를 supersedes로 남겨 과거 판단이 검색에 잡히게 한다
* [050 cycle-friction](epics/050-cycle-friction/index.md) - finalize 포인터 인계, Distill 읽기 범위, 플러그인 간 비교 근거
* [051 deepswe-original-benchmark](epics/051-deepswe-original-benchmark/index.md) - DeepSWE 원본 태스크 10개를 임시 클론으로 돌려 Pier 판정과 이 저장소 채점을 잇는다
* [052 deepswe-arm-comparison](epics/052-deepswe-arm-comparison/index.md) - DeepSWE 원본 배관을 실제로 도는 상태로 만들고 세 arm을 같은 조건에서 돌려 비교표 한 장을 낸다
* [053 skill-doc-defects](epics/053-skill-doc-defects/index.md) - 스킬 문서가 게이트 동작·CLI 계약과 어긋난 지점을 찾아 문서 쪽을 맞춘다
* [054 skill-context-optimization](epics/054-skill-context-optimization/index.md) - 진입 스킬이 실행 중 연쇄 로드하는 지시문을 역할별 정본화와 조건부 reference 분리로 줄이고 게이트 절차는 본문에 남긴다
* [055 distill-injection](epics/055-distill-injection/index.md) - 재접지 지시를 경로별 반복 호출에서 다중 --for 단일 호출로 바꿔 샤드 본문 중복 주입을 없앤다
* [056 unpublished-helper-skills](epics/056-unpublished-helper-skills/index.md) - 워크플로가 경로로 읽는 보조 스킬을 호스 스킬 목록에서 빼 암묵 매칭을 끊는다
* [057 review-ready-pr](epics/057-review-ready-pr/index.md) - Explain과 검증 증적을 조합해 변경 의도부터 확인 방법까지 이어지는 PR 본문 계약을 정의한다
* [058 context-runtime-compaction](epics/058-context-runtime-compaction/index.md) - 마스터 규칙과 Project Distill의 주입량을 줄이면서 안전 계약과 선택 라우팅을 보존한다
* [059 audit-followup](epics/059-audit-followup/index.md) - 외부 감사가 남긴 설치·지시문·경량 경로·부채 항목을 게이트 계약을 바꾸지 않고 닫는다
* [060 graphify-search-quality](epics/060-graphify-search-quality/index.md) - 과거 결정과 코드 관계를 연결해 누락이 적고 신뢰도를 설명할 수 있는 변경 경로 후보를 만든다
* [061 epic-index-consistency](epics/061-epic-index-consistency/index.md) - 에픽 description을 정본으로 삼아 번들 색인 요약을 재생성하고 불일치를 S13으로 차단한다
* [062 search-language-contract](epics/062-search-language-contract/index.md) - graph-suggest 검색의 생산자와 소비자가 같은 영어 ASCII 어휘와 토큰 규칙을 쓰도록 언어 계약을 고정한다.
* [063 context-digest-search-index](epics/063-context-digest-search-index/index.md) - Generate derived search anchors, Touch path headings, and minimal fallback digests in context-digest so every context document reaches the graph with a searchable ASCII label.
* [064 scope-graph-convergence](epics/064-scope-graph-convergence/index.md) - Separate the test scope from source_dirs, report all three graph scopes consistently, and drop the last root graphify-out/graph.json references so graph-suggest role candidates and scope status agree.
