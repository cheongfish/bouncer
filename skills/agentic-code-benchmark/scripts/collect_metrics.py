#!/usr/bin/env python3
"""Collect objective metrics for one agentic coding run.

Measures what a machine can measure without opinion: does it build, do tests
pass, did coverage move, how big and how churned is the diff. The subjective
half of the benchmark (rubric scoring) is produced separately by the agent and
merged in by scorecard.py.

Run with --help for usage. Output is a JSON metrics document on stdout (or to
--out), consumed by scripts/scorecard.py score --metrics.
"""

import argparse
import json
import os
import re
import shlex
import subprocess
import sys
import time

TEST_PATH_RE = re.compile(
    r"(^|/)(tests?|spec|__tests__|e2e)(/|$)|(^|/)[^/]*[._-](test|spec)s?\.[a-z]+$"
    r"|(^|/)test_[^/]*\.py$",
    re.IGNORECASE,
)

COVERAGE_PATTERNS = [
    re.compile(r"^TOTAL\s+.*?(\d+(?:\.\d+)?)%", re.MULTILINE),          # pytest-cov
    re.compile(r"^All files\s*\|\s*(\d+(?:\.\d+)?)", re.MULTILINE),      # istanbul/jest
    re.compile(r"total:\s*\(statements\)\s*(\d+(?:\.\d+)?)%"),           # go
    re.compile(r"Lines\s*:\s*(\d+(?:\.\d+)?)%"),                         # lcov summary
]


def sh(cmd, cwd, timeout=None, shell=True):
    """Run a command, return (exit_code, combined_output, duration_s)."""
    start = time.time()
    try:
        proc = subprocess.run(
            cmd if shell else shlex.split(cmd),
            cwd=cwd,
            shell=shell,
            capture_output=True,
            text=True,
            timeout=timeout,
        )
        out = (proc.stdout or "") + (proc.stderr or "")
        return proc.returncode, out, round(time.time() - start, 2)
    except subprocess.TimeoutExpired:
        return 124, f"TIMEOUT after {timeout}s", round(time.time() - start, 2)
    except FileNotFoundError as exc:
        return 127, str(exc), round(time.time() - start, 2)


def git(args, cwd):
    code, out, _ = sh("git " + args, cwd)
    return out.strip() if code == 0 else ""


def check(name, cmd, cwd, timeout):
    """Run one gate command and summarize it."""
    if not cmd:
        return {"name": name, "ran": False, "passed": None, "cmd": None}
    code, out, dur = sh(cmd, cwd, timeout)
    tail = "\n".join(out.strip().splitlines()[-40:])
    return {
        "name": name,
        "ran": True,
        "passed": code == 0,
        "exit_code": code,
        "cmd": cmd,
        "duration_s": dur,
        "output_tail": tail,
        "_full_output": out,
    }


def extract_coverage(text):
    if not text:
        return None
    for pattern in COVERAGE_PATTERNS:
        match = pattern.search(text)
        if match:
            try:
                return float(match.group(1))
            except ValueError:
                continue
    return None


def numstat(base, head, cwd):
    """Return [(added, deleted, path)] for the range, worktree included if head=WORKTREE."""
    if head == "WORKTREE":
        raw = git(f"diff --numstat {shlex.quote(base)}", cwd)
        untracked = git("ls-files --others --exclude-standard", cwd)
        rows = parse_numstat(raw)
        for path in [p for p in untracked.splitlines() if p.strip()]:
            full = os.path.join(cwd, path)
            try:
                with open(full, "r", errors="replace") as handle:
                    rows.append((sum(1 for _ in handle), 0, path))
            except OSError:
                continue
        return rows
    return parse_numstat(git(f"diff --numstat {shlex.quote(base)} {shlex.quote(head)}", cwd))


def parse_numstat(raw):
    rows = []
    for line in raw.splitlines():
        parts = line.split("\t")
        if len(parts) != 3:
            continue
        added, deleted, path = parts
        if added == "-" or deleted == "-":  # binary file
            rows.append((0, 0, path))
            continue
        rows.append((int(added), int(deleted), path))
    return rows


def churn(base, head, cwd):
    """Rework signal: gross line edits across commits vs net lines in the final diff.

    1.0 means every line written survived untouched. 2.5 means the agent wrote
    roughly 2.5 lines for every line that ended up in the diff -- thrash.
    """
    rev_range = f"{base}..{'HEAD' if head == 'WORKTREE' else head}"
    revs = [r for r in git(f"rev-list {shlex.quote(rev_range)}", cwd).splitlines() if r]
    gross = 0
    for rev in revs:
        for added, deleted, _ in parse_numstat(git(f"show --numstat --format= {rev}", cwd)):
            gross += added + deleted
    if head == "WORKTREE":
        # Uncommitted work never appears in rev-list; count it once so gross
        # stays an upper bound on net rather than silently under-counting.
        gross += sum(a + d for a, d, _ in numstat("HEAD", "WORKTREE", cwd))
    net = sum(a + d for a, d, _ in numstat(base, head, cwd))
    if not net:
        return {"commits": len(revs), "gross_lines": gross, "net_lines": net, "churn_ratio": None}
    return {
        "commits": len(revs),
        "gross_lines": gross,
        "net_lines": net,
        "churn_ratio": round(max(gross, net) / net, 2),
    }


def main():
    parser = argparse.ArgumentParser(
        description="Collect objective quality metrics for an agentic coding run.",
        epilog="Example: collect_metrics.py --base main --head WORKTREE "
               "--test-cmd 'npm test' --lint-cmd 'npm run lint' --out metrics.json",
    )
    parser.add_argument("--repo", default=".", help="repo root (default: cwd)")
    parser.add_argument("--base", required=True, help="git ref the agent started from")
    parser.add_argument("--head", default="WORKTREE",
                        help="git ref the agent ended at, or WORKTREE for uncommitted work")
    parser.add_argument("--label", default=None, help="run label, e.g. 'opus-tdd' (default: base..head)")
    parser.add_argument("--task-id", default=None, help="benchmark task id this run implements")
    parser.add_argument("--test-cmd", default=None)
    parser.add_argument("--lint-cmd", default=None)
    parser.add_argument("--typecheck-cmd", default=None)
    parser.add_argument("--build-cmd", default=None)
    parser.add_argument("--coverage-before", type=float, default=None,
                        help="baseline coverage %% (else parsed from a --base test run if --coverage-baseline-cmd given)")
    parser.add_argument("--coverage-after", type=float, default=None,
                        help="post-change coverage %% (else parsed from --test-cmd output)")
    parser.add_argument("--timeout", type=int, default=900, help="per-command timeout in seconds")
    parser.add_argument("--out", default=None, help="write JSON here instead of stdout")
    args = parser.parse_args()

    repo = os.path.abspath(args.repo)
    if not os.path.isdir(os.path.join(repo, ".git")):
        parser.error(f"{repo} is not a git repository")

    # Diff first: test/build commands generate artifacts (__pycache__, dist/,
    # coverage files) that would otherwise land in the measured change shape.
    rows = numstat(args.base, args.head, repo)
    rework = churn(args.base, args.head, repo)

    checks = {
        "tests": check("tests", args.test_cmd, repo, args.timeout),
        "lint": check("lint", args.lint_cmd, repo, args.timeout),
        "typecheck": check("typecheck", args.typecheck_cmd, repo, args.timeout),
        "build": check("build", args.build_cmd, repo, args.timeout),
    }

    cov_after = args.coverage_after
    if cov_after is None:
        cov_after = extract_coverage(checks["tests"].get("_full_output"))
    for entry in checks.values():
        entry.pop("_full_output", None)

    src_files = [p for _, _, p in rows if not TEST_PATH_RE.search(p)]
    test_files = [p for _, _, p in rows if TEST_PATH_RE.search(p)]
    added = sum(a for a, _, _ in rows)
    deleted = sum(d for _, d, _ in rows)
    test_added = sum(a for a, _, p in rows if TEST_PATH_RE.search(p))

    metrics = {
        "schema": "agentic-code-benchmark/metrics/1",
        "label": args.label or f"{args.base}..{args.head}",
        "task_id": args.task_id,
        "repo": repo,
        "base": args.base,
        "head": args.head,
        "head_sha": git("rev-parse --short HEAD", repo),
        "checks": checks,
        "coverage": {
            "before": args.coverage_before,
            "after": cov_after,
            "delta": round(cov_after - args.coverage_before, 2)
            if (cov_after is not None and args.coverage_before is not None) else None,
        },
        "diff": {
            "files_changed": len(rows),
            "source_files": len(src_files),
            "test_files": len(test_files),
            "lines_added": added,
            "lines_deleted": deleted,
            "test_lines_added": test_added,
            "test_line_share": round(test_added / added, 3) if added else None,
            "paths": [p for _, _, p in rows][:200],
        },
        "rework": rework,
    }

    payload = json.dumps(metrics, indent=2)
    if args.out:
        with open(args.out, "w") as handle:
            handle.write(payload + "\n")
        print(f"wrote {args.out}", file=sys.stderr)
    else:
        print(payload)


if __name__ == "__main__":
    main()
