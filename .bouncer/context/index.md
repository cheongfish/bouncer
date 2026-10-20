---
okf_version: '0.1'
bouncer_schema: '0.1'
---
# Epics


* [product-surface-hosts](epics/product-surface-hosts/index.md) - `bouncer` CLI 사용성, 다중 에이전트 플러그인, 호스트 지원, 설치 환경 및 감사 후속 조치를 통합 관리
* [planning-quality-governance](epics/planning-quality-governance/index.md) - 계획 수립 가드레일, 리뷰 루브릭, 검증 래퍼, 컨텍스트 리뷰 및 스킬 문서 품질 결함을 통합 관리
* [platform-architecture](epics/platform-architecture/index.md) - TypeScript 전환, 스킬 구조, 코어 모듈 분해, 스킬 본문 골격, 구현 주석 지침 및 카탈로그 숨김을 통합 관리
* [project-distill](epics/project-distill/index.md) - 프로젝트 공용 Distill을 plan/execute/finalize 런타임에 연결한다
* [agent-orchestration](epics/agent-orchestration/index.md) - 프로바이더별 named 서브에이전트 모델을 config로 권고하고 디스패치 시점에 적용
* [numeric-context-ids](epics/numeric-context-ids/index.md) - epic/bp 경로·메타에서 EPIC-/BP- 접두를 제거하고 마이그레이션 경로를 둔다
* [task-unit-commits](epics/task-unit-commits/index.md) - blueprint 안에 여러 task 문서를 두고 task 하나를 하나의 커밋 단위로 삼는다
* [evaluation-benchmarking](epics/evaluation-benchmarking/index.md) - 워크플로 밖 개발자 도구로 벤치마크 스킬을 반입해 런 사이 비교 가능한 점수를 남긴다
* [release-security](epics/release-security/index.md) - Security, quality, public contract, and release history for the 1.0.0 open-source plugin
* [bouncer-cost-improvement](epics/bouncer-cost-improvement/index.md) - 측정 가능한 비용 절감과 경량 계획 계약으로 Bouncer의 품질 이득을 유지한다
* [graphify-search-quality](epics/graphify-search-quality/index.md) - 과거 결정과 코드 관계를 연결해 누락이 적고 신뢰도를 설명할 수 있는 변경 경로 후보를 만든다
* [structural-audit-remediation](epics/structural-audit-remediation/index.md) - Addresses measured structural audit findings through staged security, efficiency, correctness, and distribution improvements.
* [document-commit-contracts](epics/document-commit-contracts/index.md) - Organizes durable document and commit contracts so future workflow improvements remain consistent.
* [maintenance](epics/maintenance/index.md) - Maintains cross-cutting quality, docs, and minor repairs across Bouncer.
* [runtime-policy-pointer-safety](epics/runtime-policy-pointer-safety/index.md) - Unifies verification policy and isolates active blueprint state across linked worktrees.
* [workflow-reliability](epics/workflow-reliability/index.md) - Hardens workflow contracts so validation and review remain reliable across task lifecycles.
* [workflow-contract-followup](epics/workflow-contract-followup/index.md) - Coordinates implementer role synchronization, workflow skill measurements, and Graphify context ranking evaluation.
* [task-dag-coordinator](epics/task-dag-coordinator/index.md) - Delegates DAG execution to a coordinator that autonomously completes blueprint work in isolated worktrees.
* [context-runtime-rearchitecture](epics/context-runtime-rearchitecture/index.md) - Removes Project Distill, introduces ranked canonical context retrieval, and adds bounded coordinator CI recovery.
* [workflow-improvement](epics/workflow-improvement/index.md) - Incremental Bouncer workflow improvements to runtime context cost, review convergence, and execution traceability, delivered as independent blueprints.
* [task-brief-specificity](epics/task-brief-specificity/index.md) - Makes task briefs executable without extra design judgment by linking current behavior, target behavior, code symbols, and verification.
* [code-grounded-intent-provenance](epics/code-grounded-intent-provenance/index.md) - Connects code changes to durable task intent through stable task identifiers and commit provenance.
* [search-payload-context-retention](epics/search-payload-context-retention/index.md) - Bounds search payloads and retained context while preserving provenance and Node-only distribution.
* [task-intent-bundle-reuse](epics/task-intent-bundle-reuse/index.md) - Reuses task intent bundles across execute roles and creates a new revision when function or Explain inputs change.
* [plan-context-quality-efficiency](epics/plan-context-quality-efficiency/index.md) - Makes task briefs settle test seams and failure classes, ties worker reports to brief revisions, and trims plan-time context use.
* [adaptive-review-dispatch](epics/adaptive-review-dispatch/index.md) - Selects plan and execute review perspectives from deterministic size and risk signals while preserving review convergence contracts.
* [verification-reuse-checkpoint-compaction](epics/verification-reuse-checkpoint-compaction/index.md) - Reuses successful verification evidence and compacts completed coordinator state without weakening auditability.
* [rules-reorganization](epics/rules-reorganization/index.md) - Maps Bouncer rule ownership and preserves current workflow loading and behavior during reorganization.
* [parallel-run-finalize-digest](epics/parallel-run-finalize-digest/index.md) - Runs independent Bouncer tasks in parallel under coordinator leases and compresses finalize input into one CLI digest.
* [roadmap-closeout](epics/roadmap-closeout/index.md) - Closes the remaining roadmap items by shipping built CommonJS through a release branch and removing the leftover governance rule file.
* [execution-token-cost](epics/execution-token-cost/index.md) - Close execution-contract gaps and run review once at final verification to cut drive token cost
* [cli-deterministic-procedures](epics/cli-deterministic-procedures/index.md) - Move intent_sections projection, Cursor print dispatch, and review round recording from hand-assembled steps into CLI commands
* [explain-index-intent-exit](epics/explain-index-intent-exit/index.md) - Shrink the coordinator block finalize writes into explain frontmatter to a task index, and make intent sections reject a non-canonical --task with exit 1 intent-task-invalid per contract
* [drive-context-reduction](epics/drive-context-reduction/index.md) - Cut coordinator drive context by compacting coordinate output, narrowing instruction reads, and splitting the drive into per-wave coordinator sessions
* [drive-plan-copy-hygiene](epics/drive-plan-copy-hygiene/index.md) - Keep main free of closed blueprint plan copies after a drive and move scaffold authoring guidance out of templates into skills.
* [finalize-runtime-slimming](epics/finalize-runtime-slimming/index.md) - Finalize quiz, explain, and PR stop carrying drive execution records, and coordinator and gate recovery stop loading runtime rules they do not need.
* [finalize-output-cleanup](epics/finalize-output-cleanup/index.md) - Finalize resolves the PR base from the repository default branch, and finalize result JSON stops carrying coordinator drive records.
* [v153-evaluation-remediation](epics/v153-evaluation-remediation/index.md) - Works through the v1.5.3 evaluation's improvement tasks under a mistake-prevention threat model, starting with enforcement, operations, and release alignment.
* [drive-token-reduction](epics/drive-token-reduction/index.md) - Cut Bouncer drive token cost by removing coordinator recovery loops and source lookups first, then restructuring the drive, while fixing the approval and review issues found during the 1.5.4 remeasurement.
* [workflow-cost-and-light-path](epics/workflow-cost-and-light-path/index.md) - Cut planning, coordination, and closing round-trips for everyday tasks and rebuild the light path into a single-session implementation with one independent reviewer.
* [drive-reliability](epics/drive-reliability/index.md) - Prevent premature coordinator handbacks, recover early returns safely, prepare dependencies before finalize verification, and close remaining drive gaps.
* [drive-observation-cleanup](epics/drive-observation-cleanup/index.md) - Clean up digest and PR input noise, reconcile post-drive state, improve CLI error guidance, and cut duplicated context found in the 089/004 drive.
* [source-test-hygiene](epics/source-test-hygiene/index.md) - Consolidate duplicated source helpers and shift tests to behavior-focused, tiered suites with consumer-facing testing guidance.
* [benchmark-contract-stability](epics/benchmark-contract-stability/index.md) - 벤치마크 응답기가 채팅 문장 추측 대신 Bouncer의 기계 판독 계약(게이트 카탈로그·ACQ 블록·drive 요약)만 읽게 해 버전·문구 변화마다 하네스를 고치는 반복을 없앤다.
* [deepswe-benchmark](epics/deepswe-benchmark/index.md) - 벤치마크를 ledger 합성 과제에서 DeepSWE의 어려운 상류 과제로 옮겨 vanilla와 bouncer-full의 차이가 드러나게 한다
* [coding-standards-pr-retro](epics/coding-standards-pr-retro/index.md) - Give implementers and reviewers one canonical coding and test standard, add test-trust review and a test-name lint, require change diagrams and decision data in every PR, and run an evidence-based retro after finalize.
* [plan-review-convergence](epics/plan-review-convergence/index.md) - Bound planning review restarts, preserve review history, and certify document revisions without resetting the review cycle.
* [intent-fence-guard](epics/intent-fence-guard/index.md) - Make blueprint Intent parsing skip code fences and report malformed Intent as a structured failure before finalize reaches commit message generation.
* [drive-plan-cost-control](epics/drive-plan-cost-control/index.md) - Cut drive restart and plan review costs, fix environment and output faults, and close worker report and role provenance gaps with measured effects.
* [bouncer-improvements-2026-10-14](epics/bouncer-improvements-2026-10-14/index.md) - Plans and verifies prioritized Bouncer backlog improvements in independent blueprints.
* [graphify-raw-query](epics/graphify-raw-query/index.md) - Replaces the plan-time graph-suggest file estimation with raw Graphify queries plus grep and removes graph-suggest.
* [plan-review-call-reduction](epics/plan-review-call-reduction/index.md) - Cut plan context-review model calls by making review CLI help complete, writing context-review.md on close, and approving plan status in one command.
* [plan-review-loop-guard](epics/plan-review-loop-guard/index.md) - 계획 문서가 context review 전에 G19·G20과 Touch 정합성을 통과하고, 리뷰 뒤 문서 변경을 G18이 stale로 거절하게 해 plan 리뷰 반복 루프를 끊는다.
* [drive-repair-integrity](epics/drive-repair-integrity/index.md) - drive의 다중 attempt fan-in 누락, 리뷰 라운드 순서와 repair wave 상한 불일치, repair brief의 finding 누락을 고친다.
* [drive-retro-103-followups](epics/drive-retro-103-followups/index.md) - RETRO-103-001 follow-ups: reject duplicate fingerprints at context-review record and record subagent token usage
* [drive-retro-104-followups](epics/drive-retro-104-followups/index.md) - RETRO-104 follow-ups: verify failure output tail, ASCII epic description guard, and plan discovery and review guides
* [source-restructuring](epics/source-restructuring/index.md) - Remove the verification-current-coordinator cycle and give DAG, path and policy rules a single source, preserving CLI contracts.
* [workflow-cost-reduction](epics/workflow-cost-reduction/index.md) - Cut repeated sessions, evidence calls, reviews, and finalize extras across plan, run, and finalize while keeping approvals and gates.
* [implementer-navigation](epics/implementer-navigation/index.md) - Delivers task scoped source locations to implementers from the shared intent bundle.
* [context-ontology](epics/context-ontology/index.md) - Tracks deterministic context ontology retrieval and CLI delivery with source evidence and remaining verification work.
* [workflow-transition-guards](epics/workflow-transition-guards/index.md) - Reject invalid Bouncer workflow state transitions in the CLI before mutation and align skill contracts.
* [partial-finalize-recovery](epics/partial-finalize-recovery/index.md) - Adds partial finalization and owner task recovery for failed Bouncer drives.
* [consumer-epic-registry](epics/consumer-epic-registry/index.md) - Fix consumer project epics to a registry of common epics with area tags and plan gate checks
* [host-distribution](epics/host-distribution/index.md) - Plugin distribution surface: host manifests, init and install, release and public contract
* [plan-workflow](epics/plan-workflow/index.md) - Plan workflow: discovery, scaffold, task briefs, light plans and plan gate rules
* [drive-execution](epics/drive-execution/index.md) - Run workflow: coordinator, DAG, worktrees, worker dispatch, repair and drive cost
* [finalize-closeout](epics/finalize-closeout/index.md) - Finalize workflow: explain, quiz, comprehension, PR body, partial finalize and recovery
* [context-search](epics/context-search/index.md) - Context document model: ids, schema, epic registry, Distill, Graphify and ontology search
* [gates-review](epics/gates-review/index.md) - Judgement: gate codes, verification evidence, review dispatch and coding standards
* [runtime-architecture](epics/runtime-architecture/index.md) - CLI and runtime base: modules, rule structure, pointer, state transition guards
* [benchmark-cost](epics/benchmark-cost/index.md) - Evaluation and cost: benchmark harness, DeepSWE, token and time baselines
