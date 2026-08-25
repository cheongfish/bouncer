#!/usr/bin/env python3
"""Merge a Pier verifier verdict into one metrics JSON document.

Pier decides pass/fail (reward.json, ctrf.json); collect_metrics.py measures
change shape and gates. Both describe the same run but land in different files,
so a run cannot be read as one page. This script rewrites the metrics document
with an extra `verdict` block and nothing else changed.

`schema` stays agentic-code-benchmark/metrics/1: no existing key moves or
disappears, only an optional key is added -- the same call `usage` made. So
scorecard.py score --metrics <merged> keeps working untouched, and it never
reads `verdict`: the Pier verdict is recorded, not scored.

Run with --help for usage. stdlib only.
"""

import argparse
import json
import os
import sys

METRICS_SCHEMA = "agentic-code-benchmark/metrics/1"
# Pier 산출물이 태스크 id를 적는 키. 저장소마다 이름이 갈려 먼저 맞는 하나를 쓴다
# (run_deepswe.py의 TASK_ID_KEYS와 같은 이유, 같은 목록).
TASK_ID_KEYS = ("task_id", "instance_id", "task", "id")
PASSED_KEYS = ("passed", "resolved", "success", "is_passed")
REWARD_KEYS = ("reward", "score")
# ctrf.json은 요약을 results.summary 아래에 둔다. 다른 배치도 있어 컨테이너를
# 한 겹까지만 들여다본다.
SUMMARY_CONTAINERS = ("results", "summary", "result")


def fail(message, code=2):
    # 사용법·거절 사유는 stderr로만 낸다. stdout은 파이프에 깨끗이 남긴다.
    print(message, file=sys.stderr)
    sys.exit(code)


def load_json(path):
    """Return the parsed document, or None when it is missing or not JSON."""
    try:
        with open(path, "r", errors="replace") as handle:
            return json.load(handle)
    except (OSError, ValueError):
        return None


def pick(payload, keys, want, nested=False):
    """First value under `keys` that is an instance of `want`.

    `nested=True`면 최상위에서 못 찾을 때 값이 dict인 항목 한 겹을 더 본다.
    이 깊이는 태스크 id에만 허용한다. id는 잘못 집어도 아래 대조에서 불일치로
    걸려 거부되니 안전하게 실패한다. 반면 reward/passed는 잘못 집으면 그대로
    verdict에 실려 나가므로(예: {"metadata": {"score": 3}}를 이 런의 보상으로,
    {"tests": {"success": true}}를 통과 플래그로 읽는다) 최상위만 본다. dict
    삽입 순서에 판정이 좌우되게 두지 않는다.
    """
    if not isinstance(payload, dict):
        return None
    sources = [payload]
    if nested:
        sources += [v for v in payload.values() if isinstance(v, dict)]
    for source in sources:
        for key in keys:
            value = source.get(key)
            # bool은 int의 하위형이다. 숫자를 찾을 때 True를 1로 집으면 보상 값이
            # 통과 플래그에서 흘러들어오므로, bool을 원할 때만 bool을 받는다.
            if isinstance(value, want) and (want is bool or not isinstance(value, bool)):
                return value
    return None


def pass_fraction(path):
    """Passed/total from a CTRF summary, or None when it cannot be read.

    읽지 못하면 키를 만들지 않는다. 0으로 채우면 "재지 않음"과 "전부 실패"가
    구분되지 않는다 — `usage`와 같은 규칙이다.
    """
    payload = load_json(path)
    if not isinstance(payload, dict):
        return None
    summaries = [payload]
    for key in SUMMARY_CONTAINERS:
        nested = payload.get(key)
        if isinstance(nested, dict):
            summaries.append(nested)
            inner = nested.get("summary")
            if isinstance(inner, dict):
                summaries.append(inner)
    for summary in summaries:
        total = summary.get("tests")
        passed = summary.get("passed")
        if isinstance(total, (int, float)) and isinstance(passed, (int, float)) and total > 0:
            return round(passed / total, 4)
    return None


def main(argv=None):
    parser = argparse.ArgumentParser(
        description="Merge a Pier verdict into a collect_metrics.py document.",
        epilog="Example: bridge_pier.py --metrics metrics.json --reward reward.json "
               "--arm vanilla --ctrf ctrf.json --out merged.json",
    )
    parser.add_argument("--metrics", required=True, help="collect_metrics.py output for this run")
    parser.add_argument("--reward", required=True, help="Pier reward.json for the same task")
    parser.add_argument("--arm", required=True, help="benchmark arm label this run belongs to")
    parser.add_argument("--ctrf", default=None, help="Pier ctrf.json; adds verdict.pass_fraction when readable")
    parser.add_argument("--out", required=True, help="merged metrics JSON path; refuses to overwrite")
    args = parser.parse_args(argv)

    # 경로 선점 검사를 먼저 한다. 뒤에서 거절할 입력이라도 기존 파일은 건드리지 않는다.
    if os.path.exists(args.out):
        fail(f"{args.out} already exists; refusing to overwrite a merged document")

    metrics = load_json(args.metrics)
    if not isinstance(metrics, dict):
        fail(f"{args.metrics} is missing or not a JSON object")
    if metrics.get("schema") != METRICS_SCHEMA:
        fail(f"{args.metrics} schema is {metrics.get('schema')!r}, expected {METRICS_SCHEMA!r}")

    metrics_task = metrics.get("task_id")
    if not isinstance(metrics_task, str) or not metrics_task.strip():
        # collect_metrics.py는 --task-id가 없으면 task_id에 null을 넣는다. null을
        # 통과시키면 아래 태스크 id 대조가 통째로 무력해진다.
        fail(f"{args.metrics} has no task_id; rerun collect_metrics.py with --task-id")
    metrics_task = metrics_task.strip()

    reward_doc = load_json(args.reward)
    if not isinstance(reward_doc, dict):
        # 부분 결과를 남기지 않는다. --out이 없는 것이 "판정 없음"이고, 비어 있거나
        # 실패로 채워진 --out은 "실패"로 읽힌다.
        fail(f"{args.reward} is missing or not a JSON object; no verdict written")

    reward_task = pick(reward_doc, TASK_ID_KEYS, str, nested=True)
    if reward_task and reward_task.strip() != metrics_task:
        fail(f"task id mismatch: metrics {metrics_task!r} vs reward {reward_task.strip()!r}")

    reward_value = pick(reward_doc, REWARD_KEYS, (int, float))
    if reward_value is None:
        fail(f"{args.reward} carries no numeric reward; nothing to record as a verdict")

    passed = pick(reward_doc, PASSED_KEYS, bool)
    if passed is None:
        # 명시적 통과 플래그가 없으면 보상 값으로 판정한다. Pier는 통과에만
        # 양의 보상을 준다.
        passed = reward_value > 0

    verdict = {
        "source": "pier",
        "task_id": metrics_task,
        "arm": args.arm,
        "passed": bool(passed),
        "reward": reward_value,
    }
    if args.ctrf:
        fraction = pass_fraction(args.ctrf)
        if fraction is not None:
            verdict["pass_fraction"] = fraction

    merged = dict(metrics)
    merged["verdict"] = verdict
    # 'x'는 위 존재 검사 이후에 생긴 파일도 덮어쓰지 않게 한다.
    with open(args.out, "x") as handle:
        json.dump(merged, handle, indent=2)
        handle.write("\n")
    print(f"wrote {args.out}", file=sys.stderr)
    return 0


if __name__ == "__main__":
    sys.exit(main())
