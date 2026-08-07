---
type: bouncer.verification
title: npm test — 191 passing, exit 0
description: Verification for 001
resource: .bouncer/context/epics/001-cli-usability/blueprints/001-cli-help/tasks/001/verification.md
tags:
  - bouncer
  - verification
timestamp: '2026-07-27T02:39:49.182Z'
bouncer:
  id: VERIFY-001
  epic_id: '001'
  blueprint_id: '001'
  status: passed
  verification:
    command: npm test
    ran_at: '2026-07-27T02:46:53.159Z'
    exit_code: 0
    output_tail: |-
      ✔ active surfaces contain no Superpowers integration reference (8.822431ms)
      ✔ active surfaces omit sdd names except legacy-rejection allowlist (5.687293ms)
      ✔ only focused legacy-rejection tests and detectors mention .sdd / sdd.* (4.713714ms)
      ✔ governance retains execute gate and body-contract references (0.426866ms)
      ✔ current documentation describes Bouncer native workflow without Superpowers profile (0.821533ms)
      ✔ primary checkout and linked worktree share Git-local runtime paths (18.869399ms)
      ✔ Linux XDG state path uses a stable short hash outside the repository (14.243389ms)
      ✔ platform defaults choose the required state directory (0.306451ms)
      ✔ runtime resolution is read-only and reports non-Git directories unavailable (1.435474ms)
      ✔ runtime current round-trips across primary and linked worktrees (13.918134ms)
      ✔ runtime current handles missing, corrupt, and non-Git state (20.138391ms)
      ✔ ensureWorktreeRoot is the explicit worktree directory creation boundary (12.993468ms)
      ✔ scaffoldEpic writes a valid epic index (5.551361ms)
      ✔ scaffoldBlueprint writes all five docs with correct ids and statuses (3.795511ms)
      ✔ scaffolded bodies carry the section skeleton the gates require (4.324001ms)
      ✔ scaffoldBlueprint renders bodies from .bouncer/templates when present (2.088814ms)
      ✔ scaffoldEpic renders its body from .bouncer/templates when present (1.398066ms)
      ✔ scaffoldBlueprint leaves graph.basis empty so G4 needs recorded evidence (1.770122ms)
      ✔ scaffoldBlueprint rejects a root context epic directory (0.540908ms)
      ✔ scaffoldBlueprint rejects backslash traversal outside the canonical epic (0.240028ms)
      ✔ OKF required fields are exact (1.49117ms)
      ✔ id prefix and status enum per type (0.200058ms)
      ✔ detectLegacyFormat flags .sdd dirs, sdd keys, and sdd.* types (0.703432ms)
      ✔ bootstraps missing Bouncer state before graph planning (1.100148ms)
      ✔ real bootstrap creates only safe project-local state (2.964918ms)
      ✔ skips graph work for partial Bouncer state (0.178689ms)
      ✔ skips graph work for legacy bootstrap state (0.141646ms)
      ✔ skips graph work when ready config does not opt in to graphify (0.445339ms)
      ✔ graphify opt-in retains missing graph build behavior (0.20868ms)
      ✔ skips when graphify is not on PATH (0.15154ms)
      ✔ skips when the graph is fresher than every source dir (0.148231ms)
      ✔ builds when the graph is missing (0.171335ms)
      ✔ builds when a source dir is newer than the graph (0.210806ms)
      ✔ build dirs are limited to source dirs that exist (0.162238ms)
      ✔ SessionStart reports partial state on stderr and exits zero (24.751578ms)
      ✔ SessionStart reports legacy state with corrective command and exits zero (14.21762ms)
      ✔ debugging has valid frontmatter identity (2.881106ms)
      ✔ debugging follows reproduce → isolate → failing test → minimum fix → verify (0.326256ms)
      ✔ discovery has valid frontmatter identity (3.113302ms)
      ✔ discovery clarifies goal, scope, non-goals, and success criteria (0.293073ms)
      ✔ generic skills omit legacy protocol and methodology assumptions (1.138286ms)
      ✔ graphify-runner has valid frontmatter (3.116356ms)
      ✔ graphify-runner references graphify query, suggested_paths, and graceful fallback (0.381483ms)
      ✔ graphify-runner records basis and documents freshness policy (0.204466ms)
      ✔ graphify-runner treats graphify-out as user-managed local output (0.850013ms)
      ✔ graphify-runner handles disabled auto-build with user-confirmed affected paths (0.224395ms)
      ✔ implementation has valid frontmatter identity (2.721298ms)
      ✔ implementation follows approved tasks → focused change → tests → deviations (0.252021ms)
      ✔ minimality has valid frontmatter identity (2.273991ms)
      ✔ minimality preserves required scope and escalates conflicts to planning (0.244393ms)
      ✔ review has valid frontmatter identity (2.703628ms)
      ✔ review requires Findings and actionable disposition (0.291189ms)
      ✔ spec-authoring has valid frontmatter identity (3.014535ms)
      ✔ spec-authoring documents frontmatter ownership and five task sections (0.264546ms)
      ✔ verification has valid frontmatter identity (2.046589ms)
      ✔ verification requires real Command and Evidence sections (0.205443ms)
      ✔ js-yaml is available as a dependency (11.619716ms)
      ✔ parseTasksSections reads English headings (0.821215ms)
      ✔ parseTasksSections accepts Korean aliases (0.232695ms)
      ✔ extractPathCandidates finds backtick and bare paths (0.284273ms)
      ✔ plan gate passes when all conditions met including G10–G12 (0.687011ms)
      ✔ plan gate flags G3 and G4 and G5 (0.164497ms)
      ✔ plan gate G10 fails when a section is missing (0.137609ms)
      ✔ plan gate G11 fails when affected_paths not justified by Touch (0.122115ms)
      ✔ plan gate G12 fails when do-not-touch intersects affected_paths (0.101878ms)
      ✔ execute gate: review optional satisfies G8 (with verification body) (0.207589ms)
      ✔ execute gate flags G13 when verification lacks harness metadata (0.155025ms)
      ✔ execute gate flags G13 when verification body lacks Command/Evidence (0.72088ms)
      ✔ execute gate accepts review with valid findings schema (0.188664ms)
      ✔ execute gate flags G14 when accepted finding has no note (0.088222ms)
      ✔ execute gate flags G14 when review body lacks Findings heading (0.057044ms)
      ✔ execute gate skips G14 when review.required is false (0.066899ms)
      ✔ finalize gate requires distill published (0.117436ms)
      ✔ validateBlueprint plan gate loads tasks body from disk for G10–G12 pass (8.325886ms)
      ✔ validateBlueprint plan gate G10 fails via file-loaded body when section missing (0.806446ms)
      ✔ S1: missing OKF field is reported (10.988027ms)
      ✔ S3/S6/S7 detect resource, status, affected_paths problems (0.855054ms)
      ✔ S8: leaf present but blueprint index absent (0.545516ms)
      ✔ a fully valid blueprint passes structural checks (0.898822ms)
      ✔ S0: malformed frontmatter is collected as a failure, not thrown (0.488574ms)
      ✔ legacy sdd frontmatter is rejected with bouncer-init guidance (0.564763ms)
      ✔ tasks.graph.basis is required when graph is present (0.58609ms)
      ✔ legacy root context blueprint is not a canonical validation target (0.188134ms)
      ✔ S11: a blueprint with no documents is reported as absent, not as a gate failure (0.296951ms)
      ✔ S11 does not mask a partially scaffolded blueprint (3.649592ms)
      ✔ runVerification records successful command evidence (6.041257ms)
      ✔ runVerification records failed command evidence (1.300693ms)
      ✔ runVerification rejects a missing configured command (0.656574ms)
      ✔ runVerification rejects a missing verification document (0.377675ms)
      ✔ runVerification rejects a non-canonical blueprint path before execution (0.222132ms)
      ✔ executeVerify accepts successful commands with over one megabyte of output (15.669918ms)
      ℹ tests 191
      ℹ suites 0
      ℹ pass 191
      ℹ fail 0
      ℹ cancelled 0
      ℹ skipped 0
      ℹ todo 0
      ℹ duration_ms 173.12649
---
# Verification

## Command
`npm test`

## Evidence
Ran at: 2026-07-27T02:46:53.159Z
Exit code: 0

```
✔ active surfaces contain no Superpowers integration reference (8.822431ms)
✔ active surfaces omit sdd names except legacy-rejection allowlist (5.687293ms)
✔ only focused legacy-rejection tests and detectors mention .sdd / sdd.* (4.713714ms)
✔ governance retains execute gate and body-contract references (0.426866ms)
✔ current documentation describes Bouncer native workflow without Superpowers profile (0.821533ms)
✔ primary checkout and linked worktree share Git-local runtime paths (18.869399ms)
✔ Linux XDG state path uses a stable short hash outside the repository (14.243389ms)
✔ platform defaults choose the required state directory (0.306451ms)
✔ runtime resolution is read-only and reports non-Git directories unavailable (1.435474ms)
✔ runtime current round-trips across primary and linked worktrees (13.918134ms)
✔ runtime current handles missing, corrupt, and non-Git state (20.138391ms)
✔ ensureWorktreeRoot is the explicit worktree directory creation boundary (12.993468ms)
✔ scaffoldEpic writes a valid epic index (5.551361ms)
✔ scaffoldBlueprint writes all five docs with correct ids and statuses (3.795511ms)
✔ scaffolded bodies carry the section skeleton the gates require (4.324001ms)
✔ scaffoldBlueprint renders bodies from .bouncer/templates when present (2.088814ms)
✔ scaffoldEpic renders its body from .bouncer/templates when present (1.398066ms)
✔ scaffoldBlueprint leaves graph.basis empty so G4 needs recorded evidence (1.770122ms)
✔ scaffoldBlueprint rejects a root context epic directory (0.540908ms)
✔ scaffoldBlueprint rejects backslash traversal outside the canonical epic (0.240028ms)
✔ OKF required fields are exact (1.49117ms)
✔ id prefix and status enum per type (0.200058ms)
✔ detectLegacyFormat flags .sdd dirs, sdd keys, and sdd.* types (0.703432ms)
✔ bootstraps missing Bouncer state before graph planning (1.100148ms)
✔ real bootstrap creates only safe project-local state (2.964918ms)
✔ skips graph work for partial Bouncer state (0.178689ms)
✔ skips graph work for legacy bootstrap state (0.141646ms)
✔ skips graph work when ready config does not opt in to graphify (0.445339ms)
✔ graphify opt-in retains missing graph build behavior (0.20868ms)
✔ skips when graphify is not on PATH (0.15154ms)
✔ skips when the graph is fresher than every source dir (0.148231ms)
✔ builds when the graph is missing (0.171335ms)
✔ builds when a source dir is newer than the graph (0.210806ms)
✔ build dirs are limited to source dirs that exist (0.162238ms)
✔ SessionStart reports partial state on stderr and exits zero (24.751578ms)
✔ SessionStart reports legacy state with corrective command and exits zero (14.21762ms)
✔ debugging has valid frontmatter identity (2.881106ms)
✔ debugging follows reproduce → isolate → failing test → minimum fix → verify (0.326256ms)
✔ discovery has valid frontmatter identity (3.113302ms)
✔ discovery clarifies goal, scope, non-goals, and success criteria (0.293073ms)
✔ generic skills omit legacy protocol and methodology assumptions (1.138286ms)
✔ graphify-runner has valid frontmatter (3.116356ms)
✔ graphify-runner references graphify query, suggested_paths, and graceful fallback (0.381483ms)
✔ graphify-runner records basis and documents freshness policy (0.204466ms)
✔ graphify-runner treats graphify-out as user-managed local output (0.850013ms)
✔ graphify-runner handles disabled auto-build with user-confirmed affected paths (0.224395ms)
✔ implementation has valid frontmatter identity (2.721298ms)
✔ implementation follows approved tasks → focused change → tests → deviations (0.252021ms)
✔ minimality has valid frontmatter identity (2.273991ms)
✔ minimality preserves required scope and escalates conflicts to planning (0.244393ms)
✔ review has valid frontmatter identity (2.703628ms)
✔ review requires Findings and actionable disposition (0.291189ms)
✔ spec-authoring has valid frontmatter identity (3.014535ms)
✔ spec-authoring documents frontmatter ownership and five task sections (0.264546ms)
✔ verification has valid frontmatter identity (2.046589ms)
✔ verification requires real Command and Evidence sections (0.205443ms)
✔ js-yaml is available as a dependency (11.619716ms)
✔ parseTasksSections reads English headings (0.821215ms)
✔ parseTasksSections accepts Korean aliases (0.232695ms)
✔ extractPathCandidates finds backtick and bare paths (0.284273ms)
✔ plan gate passes when all conditions met including G10–G12 (0.687011ms)
✔ plan gate flags G3 and G4 and G5 (0.164497ms)
✔ plan gate G10 fails when a section is missing (0.137609ms)
✔ plan gate G11 fails when affected_paths not justified by Touch (0.122115ms)
✔ plan gate G12 fails when do-not-touch intersects affected_paths (0.101878ms)
✔ execute gate: review optional satisfies G8 (with verification body) (0.207589ms)
✔ execute gate flags G13 when verification lacks harness metadata (0.155025ms)
✔ execute gate flags G13 when verification body lacks Command/Evidence (0.72088ms)
✔ execute gate accepts review with valid findings schema (0.188664ms)
✔ execute gate flags G14 when accepted finding has no note (0.088222ms)
✔ execute gate flags G14 when review body lacks Findings heading (0.057044ms)
✔ execute gate skips G14 when review.required is false (0.066899ms)
✔ finalize gate requires distill published (0.117436ms)
✔ validateBlueprint plan gate loads tasks body from disk for G10–G12 pass (8.325886ms)
✔ validateBlueprint plan gate G10 fails via file-loaded body when section missing (0.806446ms)
✔ S1: missing OKF field is reported (10.988027ms)
✔ S3/S6/S7 detect resource, status, affected_paths problems (0.855054ms)
✔ S8: leaf present but blueprint index absent (0.545516ms)
✔ a fully valid blueprint passes structural checks (0.898822ms)
✔ S0: malformed frontmatter is collected as a failure, not thrown (0.488574ms)
✔ legacy sdd frontmatter is rejected with bouncer-init guidance (0.564763ms)
✔ tasks.graph.basis is required when graph is present (0.58609ms)
✔ legacy root context blueprint is not a canonical validation target (0.188134ms)
✔ S11: a blueprint with no documents is reported as absent, not as a gate failure (0.296951ms)
✔ S11 does not mask a partially scaffolded blueprint (3.649592ms)
✔ runVerification records successful command evidence (6.041257ms)
✔ runVerification records failed command evidence (1.300693ms)
✔ runVerification rejects a missing configured command (0.656574ms)
✔ runVerification rejects a missing verification document (0.377675ms)
✔ runVerification rejects a non-canonical blueprint path before execution (0.222132ms)
✔ executeVerify accepts successful commands with over one megabyte of output (15.669918ms)
ℹ tests 191
ℹ suites 0
ℹ pass 191
ℹ fail 0
ℹ cancelled 0
ℹ skipped 0
ℹ todo 0
ℹ duration_ms 173.12649
```
