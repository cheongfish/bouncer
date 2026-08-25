#!/usr/bin/env python3
"""Run the DeepSWE suite once and keep only the artifacts.

One invocation clones datacurve-ai/deep-swe into an ignored work path, drives
`pier run` over the clone's `tasks` directory, rebuilds the measured copy from
the patch Pier left, calls collect_metrics.py on that copy, moves the artifacts
into docs/benchmark/deepswe/results/<run-id>/ and removes the work path. The
work path is removed on success, on failure and on Ctrl-C alike.

Why metrics.json is produced here: Pier runs the agent inside a container, so
collect_metrics.py can never reach that workspace git. Without the copy this
runner rebuilds, the `--metrics` input of the scorecard bridge would not exist.

`--arm` is a label only. This runner can drive the vanilla arm directly through
`pier run --agent`; the superpowers and bouncer arms are set up by the
procedure in docs/benchmark/protocol.md. stdlib only.
"""

import argparse
import json
import os
import re
import shutil
import signal
import subprocess
import sys

CLONE_URL = "https://github.com/datacurve-ai/deep-swe"
WORK_ROOT = os.path.join(".benchmarks", "deepswe")
RESULT_ROOT = os.path.join("docs", "benchmark", "deepswe", "results")
# Pier가 남기는 산출물. metrics.json과 run.log는 이 러너가 직접 만든다.
PIER_ARTIFACTS = ("reward.json", "ctrf.json", "test-stdout.txt")
PATCH_NAMES = ("model_patch.diff", "patch.diff", "agent.patch", "model.patch")
# 태스크 메타데이터가 base 커밋을 적는 키. DeepSWE 태스크 JSON은 저장소마다
# 이름이 갈려서, 먼저 맞는 키 하나를 쓴다.
BASE_KEYS = ("base_commit", "base_sha", "base", "commit", "environment_commit")
TASK_ID_KEYS = ("task_id", "instance_id", "task", "id")
RUN_ID_RE = re.compile(r"^[A-Za-z0-9][A-Za-z0-9._-]*$")

# PyPI의 pier-cli는 로컬 이미지 배포 도구라 DeepSWE와 무관하다.
# 실제 배포물은 datacurve-pier. uv → pipx → pip 순으로 안내만 하고
# 러너가 설치를 실행하진 않는다 — 측정 호스트가 런마다 달라지면 안 된다.
INSTALL_HINT = {
    "pier": (
        "install Pier: uv tool install datacurve-pier (or pipx install datacurve-pier, "
        "or pip install datacurve-pier)  (see https://github.com/datacurve-ai/deep-swe)"
    ),
    "docker": "install Docker Engine: https://docs.docker.com/engine/install/",
}


def fail(message, code=2):
    print(message, file=sys.stderr)
    sys.exit(code)


def log(handle, message):
    """Send progress to stderr and to run.log at once so stdout stays clean."""
    print(message, file=sys.stderr)
    handle.write(message + "\n")
    handle.flush()


def stream(cmd, handle, cwd=None):
    """Run a command, tee its output into run.log, return the exit code."""
    handle.write("$ " + " ".join(cmd) + "\n")
    handle.flush()
    proc = subprocess.Popen(
        cmd, cwd=cwd, stdout=subprocess.PIPE, stderr=subprocess.STDOUT, text=True,
    )
    try:
        for line in proc.stdout:
            sys.stderr.write(line)
            handle.write(line)
        handle.flush()
        return proc.wait()
    except BaseException:
        # SIGINT은 이 프로세스만 받는다. 자식을 남기면 지운 작업 경로를 다시
        # 만들 수 있으므로 정리 전에 먼저 죽인다.
        proc.kill()
        proc.wait()
        raise


def git_out(args, cwd):
    proc = subprocess.run(
        ["git", *args], cwd=cwd, capture_output=True, text=True,
    )
    return proc.stdout.strip() if proc.returncode == 0 else ""


def cleanup(work_path, work_root_abs):
    """Remove the work path after re-deriving and checking it.

    인자 문자열을 그대로 rmtree에 넘기지 않는다. 항상 절대 경로로 계산한 뒤
    .benchmarks/deepswe/ 바로 아래인지 확인하고 지운다.
    """
    if not work_path:
        return
    target = os.path.abspath(work_path)
    if os.path.dirname(target) != work_root_abs:
        print(f"refusing to remove {target}: outside {work_root_abs}", file=sys.stderr)
        return
    shutil.rmtree(target, ignore_errors=True)


def walk_outputs(root, skip):
    """Walk `root` for this run's own output, never descending into `skip`.

    `skip`은 deep-swe 클론이다. 스위트가 태스크 디렉터리에 reward.json이나
    gold `*.patch` 같은 픽스처를 함께 실어 두면, 그게 이 런의 산출물로 잡혀
    결과 경로에 실리거나 패치 개수를 부풀린다. `--depth 1` 클론은 모든 파일
    mtime이 방금 찍히므로 "가장 최신" 규칙으로도 걸러지지 않는다. 그래서
    탐색 단계에서 클론 서브트리 전체를 아예 제외한다.
    """
    skip_abs = os.path.abspath(skip) if skip else None
    for dirpath, dirs, files in os.walk(root):
        if skip_abs and os.path.abspath(dirpath) == skip_abs:
            # dirs를 비워 os.walk가 클론 아래로 내려가지 않게 한다.
            dirs[:] = []
            continue
        yield dirpath, dirs, files


def find_files(root, names, skip=None):
    """Return the newest match for each of `names` under root, minus the clone."""
    found = {}
    for dirpath, _dirs, files in walk_outputs(root, skip):
        for name in files:
            if name not in names:
                continue
            full = os.path.join(dirpath, name)
            try:
                stamp = os.path.getmtime(full)
            except OSError:
                continue
            if name not in found or stamp > found[name][1]:
                found[name] = (full, stamp)
    return {name: entry[0] for name, entry in found.items()}


def find_patches(root, skip=None):
    hits = []
    for dirpath, _dirs, files in walk_outputs(root, skip):
        for name in files:
            if name in PATCH_NAMES or name.endswith(".patch"):
                hits.append(os.path.join(dirpath, name))
    return sorted(hits)


def find_workspace(root, skip):
    """Find a host-side repo checkout Pier left behind, if any.

    Pier가 워크스페이스를 호스트에 남기지 않는 구성이면 사본을 만들 수 없다.
    그 경우 metrics.json을 만들지 않고 사실만 적는다.
    """
    for dirpath, dirs, files in walk_outputs(root, skip):
        if ".git" in dirs or ".git" in files:
            return dirpath
    return None


def read_json(path):
    try:
        with open(path, "r", errors="replace") as handle:
            return json.load(handle)
    except (OSError, ValueError):
        return None


def pick(payload, keys):
    if not isinstance(payload, dict):
        return None
    for key in keys:
        value = payload.get(key)
        if isinstance(value, str) and value.strip():
            return value.strip()
    return None


def resolve_task_id(explicit, clone, artifacts, patches):
    if explicit:
        return explicit
    reward = artifacts.get("reward.json")
    from_reward = pick(read_json(reward), TASK_ID_KEYS) if reward else None
    if from_reward:
        return from_reward
    # 산출물이 태스크 id를 적지 않으면, 경로 조각을 클론의 태스크 이름과 맞춰 본다.
    tasks_dir = os.path.join(clone, "tasks")
    try:
        names = set(os.listdir(tasks_dir))
    except OSError:
        return None
    for path in list(artifacts.values()) + patches:
        for part in os.path.abspath(path).split(os.sep):
            if part in names:
                return part
    return None


def resolve_base(clone, task_id, copy_dir):
    """Task base commit: task metadata first, else the untouched copy's HEAD."""
    task_dir = os.path.join(clone, "tasks", task_id) if task_id else None
    if task_dir and os.path.isdir(task_dir):
        for name in sorted(os.listdir(task_dir)):
            if not name.endswith(".json"):
                continue
            base = pick(read_json(os.path.join(task_dir, name)), BASE_KEYS)
            if base:
                return base
    return git_out(["rev-parse", "HEAD"], copy_dir) or None


def build_measured_copy(work, clone, task_id, handle):
    """Copy the workspace, check out the task base, apply Pier's patch.

    Returns (copy_dir, base) or None when the chain cannot be completed. 빈
    diff로 measured 필드를 채우면 "재지 않음"이 "아무것도 안 고침"으로 읽힌다.
    """
    patches = find_patches(work, clone)
    if not patches:
        log(handle, "no patch left by pier; skipping metrics.json")
        return None
    if len(patches) > 1:
        log(handle, f"{len(patches)} patches found; metrics.json covers one task only, skipping")
        return None
    workspace = find_workspace(work, clone)
    if not workspace:
        log(handle, "pier left no host-side workspace checkout; skipping metrics.json")
        return None

    # 워크스페이스는 ".git이 있는 첫 디렉터리" 휴리스틱으로 고른다. 어느
    # 디렉터리를 재고 어느 패치를 얹었는지 run.log에 남겨야 나중에 metrics.json이
    # 엉뚱한 체크아웃을 잰 건지 확인할 수 있다.
    log(handle, f"measured workspace: {workspace}")
    log(handle, f"measured patch: {patches[0]}")

    copy_dir = os.path.join(work, "measured")
    shutil.copytree(workspace, copy_dir, symlinks=True)
    base = resolve_base(clone, task_id, copy_dir)
    if not base:
        log(handle, "task base commit not found; skipping metrics.json")
        return None
    if stream(["git", "checkout", "--detach", base], handle, cwd=copy_dir) != 0:
        log(handle, f"base commit {base} not checkoutable in the copy; skipping metrics.json")
        return None
    if stream(["git", "apply", os.path.abspath(patches[0])], handle, cwd=copy_dir) != 0:
        log(handle, f"patch does not apply onto {base}; skipping metrics.json")
        return None
    return copy_dir, base


def parse_args(argv):
    parser = argparse.ArgumentParser(
        description="Clone deep-swe, run it through pier, keep only the artifacts.",
    )
    parser.add_argument("--run-id", required=True, help="run identifier; names both the work and result path")
    parser.add_argument("--arm", required=True, choices=("vanilla", "superpowers", "bouncer"),
                        help="label only; superpowers/bouncer arms are set up by protocol.md")
    parser.add_argument("--agent", required=True, help="agent name passed to pier run --agent")
    parser.add_argument("--model", default=None, help="model passed to pier run --model")
    parser.add_argument("--sample-seed", default=None, help="sampling seed for a multi-task run")
    parser.add_argument("--n-tasks", default=None, help="how many tasks to sample")
    parser.add_argument("--task", default=None, help="run this single task id instead of a sample")
    args = parser.parse_args(argv)
    if args.task and args.n_tasks:
        parser.error("--task selects one task and --n-tasks samples several; pass only one")
    if not RUN_ID_RE.match(args.run_id):
        parser.error("--run-id must be one path segment of [A-Za-z0-9._-]")
    return args


def main(argv=None):
    args = parse_args(argv)

    repo_root = os.getcwd()
    if not os.path.exists(os.path.join(repo_root, ".git")):
        fail(f"{repo_root} is not a repository root; run this from the repo root")

    # 선행 조건은 클론을 뜨기 전에 본다. 네트워크를 태우고 나서 없다고 말하지 않는다.
    for tool in ("pier", "docker"):
        if shutil.which(tool) is None:
            fail(f"{tool} not found on PATH. {INSTALL_HINT[tool]}")

    results_root_abs = os.path.abspath(os.path.join(repo_root, RESULT_ROOT))
    results = os.path.join(results_root_abs, args.run_id)
    if os.path.exists(results):
        fail(f"{results} already exists; pick another --run-id")

    work_root_abs = os.path.abspath(os.path.join(repo_root, WORK_ROOT))
    work = os.path.join(work_root_abs, args.run_id)
    if os.path.exists(work):
        fail(f"{work} already exists; a run with this id is in flight or was left behind")

    # 산출물 이동 도중에 끊기면 반쪽짜리 results/<run-id>/가 남고, 그 뒤로는
    # 같은 --run-id가 위의 충돌 검사에 막혀 다시 돌릴 수 없게 된다. 충돌 거부는
    # 그대로 두고, 이 런이 직접 만든 미완성 결과 경로만 되돌린다.
    staged = {"created": False, "complete": False}

    def cleanup_results():
        if not staged["created"] or staged["complete"]:
            return
        if os.path.dirname(results) != results_root_abs:
            return
        shutil.rmtree(results, ignore_errors=True)

    def on_signal(signum, _frame):
        # 정상 종료 경로에만 걸면 Ctrl-C에 클론이 남는다. finally와 양쪽에 건다.
        cleanup_results()
        cleanup(work, work_root_abs)
        sys.exit(128 + signum)

    signal.signal(signal.SIGINT, on_signal)
    signal.signal(signal.SIGTERM, on_signal)

    try:
        os.makedirs(work)
        log_path = os.path.join(work, "run.log")
        with open(log_path, "w") as handle:
            log(handle, f"run-id={args.run_id} arm={args.arm} agent={args.agent} model={args.model or '-'}")

            clone = os.path.join(work, "deep-swe")
            # 네트워크 단계 실패는 삼키지 않고 그대로 비영 코드로 올린다.
            if stream(["git", "clone", "--depth", "1", CLONE_URL, clone], handle) != 0:
                fail(f"git clone {CLONE_URL} failed", 1)

            # -p는 한 번만 나온다. 샘플이면 tasks 디렉터리, 단일이면 그 태스크 디렉터리.
            if args.task:
                target = os.path.join(clone, "tasks", args.task)
            else:
                target = os.path.join(clone, "tasks")
            pier = ["pier", "run", "-p", target, "--agent", args.agent]
            if args.model:
                pier += ["--model", args.model]
            if not args.task:
                if args.n_tasks:
                    pier += ["--n-tasks", str(args.n_tasks)]
                if args.sample_seed:
                    pier += ["--sample-seed", str(args.sample_seed)]
            code = stream(pier, handle, cwd=work)
            if code != 0:
                fail(f"pier run exited {code}", 1)

            artifacts = find_files(work, set(PIER_ARTIFACTS), skip=clone)
            for name in PIER_ARTIFACTS:
                if name not in artifacts:
                    log(handle, f"pier left no {name}")

            task_id = resolve_task_id(args.task, clone, artifacts, find_patches(work, clone))
            measured = build_measured_copy(work, clone, task_id, handle)
            metrics_path = os.path.join(work, "metrics.json")
            if measured and not task_id:
                log(handle, "task id unresolved; skipping metrics.json so task_id never lands null")
            elif measured:
                copy_dir, base = measured
                collect = os.path.join(os.path.dirname(os.path.abspath(__file__)), "collect_metrics.py")
                # --task-id는 반드시 준다. 빠지면 002의 태스크 id 대조가 무의미해진다.
                code = stream([
                    sys.executable or "python3", collect,
                    "--repo", copy_dir, "--base", base, "--head", "WORKTREE",
                    "--task-id", task_id, "--label", args.run_id,
                    "--out", metrics_path,
                ], handle)
                if code != 0:
                    log(handle, f"collect_metrics.py exited {code}; no metrics.json")

        os.makedirs(results)
        staged["created"] = True
        for name in (*PIER_ARTIFACTS, "metrics.json"):
            source = artifacts.get(name, os.path.join(work, name))
            if os.path.exists(source):
                shutil.move(source, os.path.join(results, name))
        shutil.move(log_path, os.path.join(results, "run.log"))
        # run.log까지 옮겨진 시점부터가 온전한 결과 경로다.
        staged["complete"] = True
        print(results)
        return 0
    finally:
        cleanup_results()
        cleanup(work, work_root_abs)


if __name__ == "__main__":
    sys.exit(main())
