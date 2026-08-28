---
distill:
  id: plugin-benchmark
  paths:
    - skills/agentic-code-benchmark/**
    - docs/benchmark/**
    - .benchmarks/**
  pulls: []
---
# plugin-benchmark

Rules for the benchmark skill, authored suite under `docs/benchmark/`, and runtime `.benchmarks/` output.

## Invariants

- Canonical authored suite files live under `docs/benchmark/` (`history.md`, `tasks/*.json`, `task-selection.md`, `protocol.md`), not under `.benchmarks/`.
- Benchmark arms are a protocol axis (vanilla / third-party comparison plugin / bouncer), not a field on task JSON. Keep prompts arm-neutral.
- Vendored Apache-2.0 skill trees keep a `NOTICE.md` inside the skill (upstream repo, path, license id, URL) when upstream has no `LICENSE` to copy. Put convention output dirs (e.g. `.benchmarks/`) in `.gitignore` so commit-safety does not see them as scope noise.

## Gotchas

- `collect_metrics.py` optional `--tokens-in` / `--tokens-out` / `--wall-s` / `--tool-calls` (`type=int`, default unset). If any is given, emit top-level `usage` with only those keys; if none, omit `usage`. Do not fill missing keys with `0`. `usage` is recording only — not scorecard input. Keep schema string `agentic-code-benchmark/metrics/1`.
- `test/public-name-regression.test.js` allowlists a third-party comparison-arm name only in `docs/benchmark/protocol.md`, `skills/agentic-code-benchmark/SKILL.md`, `skills/agentic-code-benchmark/references/task-suite.md`, `docs/benchmark/deepswe/comparison.md`, and `docs/benchmark/history.md`. Product surfaces (`docs/ARCHITECTURE.md`, `docs/install.md`) must not mention it.
- When Pier leaves no host `.git`, restore the task project from Harbor `task.toml` `repository_url` and `base_commit_hash`, apply the patch, and pass that tree to `collect_metrics.py`. Do not use the suite clone `tasks/` as `--repo`. Skip `metrics.json` when there is no patch.
- `run_deepswe.py --arm` sets the run condition, not an artifact label. vanilla is plugin-free `pier run`. The third-party comparison-plugin arm enables only that plugin and never creates `.bouncer/`; if the plugin is missing, exit non-zero without installing and without a results path. bouncer runs init, fills a light plan so `current --set` passes the plan gate, then `--set` on the work path before `pier run`. The runner does not call execute/commit CLI.
- DeepSWE comparison tables copy pass rate and usage from run artifacts only. Leave missing cells empty; do not fill `0`.
- Benchmark task JSON `base` is one round-wide short sha. An execution round bulk-updates all ten files; the sha written when the suite was authored is not the run base.

## Decisions

- Keep metrics schema and arm semantics stable across rounds; update history/protocol docs when arms or recording rules change — not Distill change-log prose.
- `usage` is recording-only and must not silently become scorecard or gate input.
