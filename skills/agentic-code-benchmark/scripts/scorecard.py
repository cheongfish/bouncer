#!/usr/bin/env python3
"""Merge objective metrics + judged rubric scores into a comparable scorecard.

Subcommands:
  template   emit a blank judgment JSON for the agent to fill in
  score      metrics.json + judgment.json -> scorecard.json (+ markdown report)
  compare    two or more scorecards -> a comparison table with deltas

Composite is 0-100: 40 points measured (scripts/collect_metrics.py), 60 points
judged (references/rubric.md). Components that could not be measured are dropped
and the remaining measured weights are renormalized, so a repo without a test
command still produces a comparable score -- just a less confident one, which
the report states explicitly.
"""

import argparse
import json
import sys

DIMENSIONS = [
    ("correctness", "Correctness & spec fidelity"),
    ("scope", "Scope discipline"),
    ("tests", "Test quality"),
    ("fit", "Codebase fit"),
    ("maintainability", "Maintainability & clarity"),
]

JUDGED_TOTAL = 60.0
DIM_WEIGHT = JUDGED_TOTAL / len(DIMENSIONS)  # 12 pts per dimension, 0-5 scale

OBJECTIVE_WEIGHTS = {
    "tests_pass": 15.0,
    "static_clean": 10.0,   # lint + typecheck
    "build_ok": 5.0,
    "coverage": 5.0,
    "efficiency": 5.0,
}
OBJECTIVE_TOTAL = sum(OBJECTIVE_WEIGHTS.values())  # 40

CAPS = [
    ("blocking findings recorded", 35.0),
    ("build failed", 30.0),
    ("tests failed", 45.0),
]


def coverage_ratio(delta):
    if delta is None:
        return None
    if delta >= 2:
        return 1.0
    if delta >= 0:
        return 0.75 + 0.125 * delta
    if delta > -5:
        return 0.75 * (1 + delta / 5)
    return 0.0


def efficiency_ratio(churn):
    if churn is None:
        return None
    if churn <= 1.2:
        return 1.0
    if churn <= 2:
        return 1.0 - (churn - 1.2) * 0.375
    if churn <= 4:
        return 0.7 - (churn - 2) * 0.25
    return 0.1


def grade(score):
    for threshold, letter in ((90, "A"), (80, "B"), (70, "C"), (60, "D")):
        if score >= threshold:
            return letter
    return "F"


def objective_breakdown(metrics):
    checks = metrics.get("checks", {})
    ran = lambda name: checks.get(name, {}).get("ran")
    passed = lambda name: checks.get(name, {}).get("passed")

    parts = {}

    if ran("tests"):
        parts["tests_pass"] = 1.0 if passed("tests") else 0.0

    static = [passed(n) for n in ("lint", "typecheck") if ran(n)]
    if static:
        parts["static_clean"] = sum(1.0 for p in static if p) / len(static)

    if ran("build"):
        parts["build_ok"] = 1.0 if passed("build") else 0.0

    cov = coverage_ratio(metrics.get("coverage", {}).get("delta"))
    if cov is not None:
        parts["coverage"] = cov

    eff = efficiency_ratio(metrics.get("rework", {}).get("churn_ratio"))
    if eff is not None:
        parts["efficiency"] = eff

    available = sum(OBJECTIVE_WEIGHTS[k] for k in parts)
    if not available:
        return {"points": 0.0, "max": 0.0, "coverage_of_scale": 0.0, "parts": {}}

    scale = OBJECTIVE_TOTAL / available  # renormalize onto the full 40
    detail = {
        key: {
            "ratio": round(ratio, 3),
            "points": round(ratio * OBJECTIVE_WEIGHTS[key] * scale, 2),
            "max_points": round(OBJECTIVE_WEIGHTS[key] * scale, 2),
        }
        for key, ratio in parts.items()
    }
    return {
        "points": round(sum(d["points"] for d in detail.values()), 2),
        "max": OBJECTIVE_TOTAL,
        "coverage_of_scale": round(available / OBJECTIVE_TOTAL, 2),
        "parts": detail,
    }


def judged_breakdown(judgment):
    dims = judgment.get("dimensions", {})
    detail = {}
    for key, title in DIMENSIONS:
        entry = dims.get(key) or {}
        raw = entry.get("score")
        evidence = (entry.get("evidence") or "").strip()
        if raw is None or not evidence:
            # Rubric rule: a dimension without checkable evidence scores 0.
            raw = 0
            evidence = evidence or "MISSING EVIDENCE - scored 0 per rubric"
        raw = max(0, min(5, float(raw)))
        detail[key] = {
            "title": title,
            "score": raw,
            "points": round(raw / 5 * DIM_WEIGHT, 2),
            "max_points": DIM_WEIGHT,
            "evidence": evidence,
        }
    return {
        "points": round(sum(d["points"] for d in detail.values()), 2),
        "max": JUDGED_TOTAL,
        "parts": detail,
    }


def build_scorecard(metrics, judgment):
    obj = objective_breakdown(metrics)
    judged = judged_breakdown(judgment)
    raw = round(obj["points"] + judged["points"], 2)

    checks = metrics.get("checks", {})
    triggered = []
    if judgment.get("blocking_findings"):
        triggered.append(CAPS[0])
    if checks.get("build", {}).get("ran") and not checks["build"].get("passed"):
        triggered.append(CAPS[1])
    if checks.get("tests", {}).get("ran") and not checks["tests"].get("passed"):
        triggered.append(CAPS[2])

    composite = raw
    applied = None
    if triggered:
        reason, cap = min(triggered, key=lambda t: t[1])
        if cap < composite:
            composite, applied = cap, reason

    return {
        "schema": "agentic-code-benchmark/scorecard/1",
        "label": judgment.get("label") or metrics.get("label"),
        "task_id": judgment.get("task_id") or metrics.get("task_id"),
        "agent_config": judgment.get("agent_config"),
        "composite": round(composite, 2),
        "raw_composite": raw,
        "grade": grade(composite),
        "cap_applied": applied,
        "confidence": obj["coverage_of_scale"],
        "objective": obj,
        "judged": judged,
        "blocking_findings": judgment.get("blocking_findings", []),
        "notes": judgment.get("notes"),
        "diff": metrics.get("diff", {}),
        "rework": metrics.get("rework", {}),
        "checks": {
            k: {"ran": v.get("ran"), "passed": v.get("passed"), "cmd": v.get("cmd")}
            for k, v in checks.items()
        },
    }


def render_report(card):
    lines = [
        f"# Benchmark scorecard: {card['label']}",
        "",
        f"**{card['composite']}/100 ({card['grade']})**"
        + (f" - capped from {card['raw_composite']} ({card['cap_applied']})" if card["cap_applied"] else ""),
        "",
        f"Task: `{card.get('task_id') or 'n/a'}` | Config: {card.get('agent_config') or 'n/a'} "
        f"| Measured-signal confidence: {int(card['confidence'] * 100)}%",
        "",
        "## Judged (60)",
        "",
        "| Dimension | Score | Points | Evidence |",
        "|---|---|---|---|",
    ]
    for key, _ in DIMENSIONS:
        part = card["judged"]["parts"][key]
        evidence = part["evidence"].replace("|", "\\|").replace("\n", " ")
        lines.append(f"| {part['title']} | {part['score']:.0f}/5 | {part['points']} | {evidence} |")

    lines += ["", f"**Judged subtotal: {card['judged']['points']}/60**", "", "## Measured (40)", ""]
    if card["objective"]["parts"]:
        lines += ["| Signal | Ratio | Points |", "|---|---|---|"]
        for key, part in card["objective"]["parts"].items():
            lines.append(f"| {key} | {part['ratio']} | {part['points']}/{part['max_points']} |")
        lines.append("")
        lines.append(f"**Measured subtotal: {card['objective']['points']}/40**")
        if card["confidence"] < 1.0:
            lines.append("")
            lines.append(
                f"> Only {int(card['confidence'] * 100)}% of the measured scale had real signal; "
                "the rest was renormalized across available checks. Compare against runs with the same checks."
            )
    else:
        lines.append("_No measured signal available - composite is judged-only and not comparable to measured runs._")

    diff = card.get("diff", {})
    rework = card.get("rework", {})
    lines += [
        "",
        "## Change shape",
        "",
        f"- {diff.get('files_changed', '?')} files "
        f"({diff.get('source_files', '?')} source, {diff.get('test_files', '?')} test), "
        f"+{diff.get('lines_added', '?')}/-{diff.get('lines_deleted', '?')}",
        f"- Test line share: {diff.get('test_line_share')}",
        f"- Churn ratio: {rework.get('churn_ratio')} over {rework.get('commits')} commits",
    ]

    if card["blocking_findings"]:
        lines += ["", "## Blocking findings", ""]
        lines += [f"- {f}" for f in card["blocking_findings"]]
    if card.get("notes"):
        lines += ["", "## Notes", "", card["notes"]]
    return "\n".join(lines) + "\n"


def render_comparison(cards):
    baseline = cards[0]
    lines = [
        "# Benchmark comparison",
        "",
        f"Baseline: **{baseline['label']}** ({baseline['composite']}/100)",
        "",
        "| Run | Composite | Δ | Grade | Judged | Measured | Cap |",
        "|---|---|---|---|---|---|---|",
    ]
    for card in cards:
        delta = card["composite"] - baseline["composite"]
        delta_str = "-" if card is baseline else f"{delta:+.2f}"
        lines.append(
            f"| {card['label']} | {card['composite']} | {delta_str} | {card['grade']} "
            f"| {card['judged']['points']}/60 | {card['objective']['points']}/40 "
            f"| {card['cap_applied'] or '-'} |"
        )

    lines += ["", "## Per-dimension (0-5)", "", "| Dimension | " + " | ".join(c["label"] for c in cards) + " |",
              "|---" * (len(cards) + 1) + "|"]
    for key, title in DIMENSIONS:
        row = [f"{c['judged']['parts'][key]['score']:.0f}" for c in cards]
        lines.append(f"| {title} | " + " | ".join(row) + " |")

    lines += ["", "## Change shape", "", "| Metric | " + " | ".join(c["label"] for c in cards) + " |",
              "|---" * (len(cards) + 1) + "|"]
    for field, path in (
        ("Files changed", ("diff", "files_changed")),
        ("Lines added", ("diff", "lines_added")),
        ("Test line share", ("diff", "test_line_share")),
        ("Churn ratio", ("rework", "churn_ratio")),
    ):
        row = [str(c.get(path[0], {}).get(path[1])) for c in cards]
        lines.append(f"| {field} | " + " | ".join(row) + " |")

    best = max(cards, key=lambda c: c["composite"])
    spread = best["composite"] - min(c["composite"] for c in cards)
    lines += ["", "## Read"]
    lines.append(f"- Highest composite: **{best['label']}** ({best['composite']}/100), spread {spread:.2f} points.")
    if spread < 5:
        lines.append("- Spread is under 5 points: treat these runs as tied, not ranked. "
                     "One task is not a benchmark - run more tasks before drawing a conclusion.")
    confidences = {c["confidence"] for c in cards}
    if len(confidences) > 1:
        lines.append("- Runs had different measured-signal coverage; composites are not strictly comparable. "
                     "Re-run with identical check commands.")
    return "\n".join(lines) + "\n"


def load(path):
    with open(path) as handle:
        return json.load(handle)


def main():
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    sub = parser.add_subparsers(dest="cmd", required=True)

    tpl = sub.add_parser("template", help="emit a blank judgment JSON")
    tpl.add_argument("--out", default=None)

    sc = sub.add_parser("score", help="build a scorecard from metrics + judgment")
    sc.add_argument("--metrics", required=True)
    sc.add_argument("--judgment", required=True)
    sc.add_argument("--out", required=True, help="scorecard JSON path")
    sc.add_argument("--report", default=None, help="also write a markdown report here")

    cmp_ = sub.add_parser("compare", help="compare two or more scorecards")
    cmp_.add_argument("scorecards", nargs="+", help="first one is the baseline")
    cmp_.add_argument("--out", default=None, help="write markdown here instead of stdout")

    args = parser.parse_args()

    if args.cmd == "template":
        skeleton = {
            "label": "run-label",
            "task_id": None,
            "agent_config": "model / mode / prompt style used for this run",
            "dimensions": {
                key: {"score": None, "evidence": ""} for key, _ in DIMENSIONS
            },
            "blocking_findings": [],
            "notes": "",
        }
        payload = json.dumps(skeleton, indent=2)
        if args.out:
            with open(args.out, "w") as handle:
                handle.write(payload + "\n")
            print(f"wrote {args.out}", file=sys.stderr)
        else:
            print(payload)
        return

    if args.cmd == "score":
        card = build_scorecard(load(args.metrics), load(args.judgment))
        with open(args.out, "w") as handle:
            json.dump(card, handle, indent=2)
            handle.write("\n")
        report = render_report(card)
        if args.report:
            with open(args.report, "w") as handle:
                handle.write(report)
        print(report)
        return

    cards = [load(p) for p in args.scorecards]
    output = render_comparison(cards)
    if args.out:
        with open(args.out, "w") as handle:
            handle.write(output)
        print(f"wrote {args.out}", file=sys.stderr)
    else:
        print(output)


if __name__ == "__main__":
    main()
