#!/usr/bin/env python3
"""Run the DeepSWE suite once and keep only the artifacts.

One invocation clones datacurve-ai/deep-swe into an ignored work path, drives
`pier run` over the clone's `tasks` directory, rebuilds a measured copy per
task from the patch Pier left, calls collect_metrics.py on each copy, moves
the artifacts into docs/benchmark/deepswe/results/<run-id>/tasks/<task-id>/
(with one run.log at the run root) and removes the work path. The work path
is removed on success, on failure and on Ctrl-C alike. A one-task run uses
the same layout; there is no flat single-task fallback.

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


def find_task_units(root, skip):
    """Pier 산출물·패치를 그걸 직접 담은 디렉터리별로 묶는다.

    결과 경로는 `tasks/<task-id>/` 아래만 자리가 있다. 작업 경로 전체에서
    이름당 파일 하나(가장 최신)를 고르면 나머지 태스크를 담을 키가 없다.
    같은 디렉터리에 놓인 산출물과 패치를 한 단위로 본다. 그 디렉터리 이름은
    태스크 id가 아니고, id는 단위 안에서 resolve_task_id로 유도한다.

    Args:
        root (str): 탐색 시작 경로 (보통 이 런의 작업 경로)
        skip (str | None): 내려가지 않을 클론 경로

    Returns:
        dict[str, dict]: 단위 디렉터리 → {"artifacts": {이름: 경로}, "patches": [경로]}
    """
    units = {}
    for dirpath, _dirs, files in walk_outputs(root, skip):
        artifacts = {}
        patches = []
        for name in files:
            full = os.path.join(dirpath, name)
            if name in PIER_ARTIFACTS:
                artifacts[name] = full
            if name in PATCH_NAMES or name.endswith(".patch"):
                patches.append(full)
        if artifacts or patches:
            units[dirpath] = {"artifacts": artifacts, "patches": sorted(patches)}
    return units


def find_files(root, names, skip=None):
    """`root` 아래(클론 제외)에서 `names`의 가장 최신 파일을 이름별로 돌려준다.

    전역이 아니라 태스크 단위 디렉터리를 root로 넘긴다. 단위 안에서 같은 이름이
    둘이면 최신만 남긴다 — 그 단위의 산출물은 결과 경로에 이름당 한 장이다.

    Args:
        root (str): 태스크 단위 디렉터리
        names (set[str] | iterable[str]): 찾을 파일 이름
        skip (str | None): 클론 경로

    Returns:
        dict[str, str]: 파일 이름 → 경로. 없으면 그 키 자체가 없다
    """
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
    """`root` 아래(클론 제외)의 패치 경로를 정렬해 돌려준다.

    Args:
        root (str): 태스크 단위 디렉터리
        skip (str | None): 클론 경로

    Returns:
        list[str]: 패치 파일 절대/상대 경로
    """
    hits = []
    for dirpath, _dirs, files in walk_outputs(root, skip):
        for name in files:
            if name in PATCH_NAMES or name.endswith(".patch"):
                hits.append(os.path.join(dirpath, name))
    return sorted(hits)


def find_workspace(root, skip):
    """이 태스크 단위 안에서 Pier가 남긴 호스트 쪽 체크아웃을 찾는다.

    작업 경로 전체의 첫 `.git`을 쓰면 다른 태스크의 워크스페이스를 재게 된다.
    단위 디렉터리로 범위를 좁힌다. 호스트에 체크아웃이 없으면 사본을 만들 수
    없으니 metrics.json은 만들지 않고 사실만 적는다.

    Args:
        root (str): 태스크 단위 디렉터리
        skip (str | None): 클론 경로. 클론 안의 스위트 픽스처 `.git`은 제외

    Returns:
        str | None: `.git`이 있는 디렉터리, 없으면 None
    """
    for dirpath, dirs, files in walk_outputs(root, skip):
        if ".git" in dirs or ".git" in files:
            return dirpath
    return None


def usable_task_id(task_id):
    """태스크 id가 결과 경로의 한 조각으로 써도 안전할 때만 그대로 돌려준다.

    `tasks/<task-id>/`는 경로 한 단이다. `/`나 `..`이 들어가면 결과 경로 밖을
    가리키거나 상위 디렉터리를 넘는다. 순번으로 이름을 지어내지 않고, 유도
    실패와 같이 그 단위를 버린다.

    Args:
        task_id (str | None): resolve_task_id가 낸 값

    Returns:
        str | None: 안전한 한 조각이거나, 쓰면 안 되면 None
    """
    if not task_id or not isinstance(task_id, str):
        return None
    if "/" in task_id or (os.sep != "/" and os.sep in task_id) or ".." in task_id:
        return None
    if task_id in (".",):
        return None
    return task_id


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


def build_measured_copy(work, clone, task_id, handle, unit_dir):
    """이 태스크 단위의 워크스페이스를 복사하고 base에 패치를 얹는다.

    패치가 없거나 사본 체인을 끝내지 못하면 None이다. 빈 diff로 measured
    필드를 채우면 "재지 않음"이 "아무것도 안 고침"으로 읽힌다. 사본 경로는
    태스크마다 갈라서 한 런의 사본이 서로를 덮지 않게 한다.

    Args:
        work (str): 런 작업 경로
        clone (str): deep-swe 클론 경로 (패치·워크스페이스 탐색에서 제외)
        task_id (str): 이미 안전하게 걸러진 태스크 id
        handle (TextIO): run.log
        unit_dir (str): 이 태스크의 산출물·패치가 있는 디렉터리

    Returns:
        tuple[str, str] | None: (copy_dir, base) 또는 체인을 못 끝냈으면 None
    """
    patches = find_patches(unit_dir, clone)
    if not patches:
        log(handle, f"no patch left by pier for {task_id}; skipping metrics.json")
        return None
    if len(patches) > 1:
        # 전역 "패치 둘이면 런 전체를 skip"은 태스크 반복으로 대체됐다.
        # 한 단위 안에 패치가 둘이면 어느 것을 얹을지 임의로 고르지 않는다.
        log(handle, f"{len(patches)} patches in task {task_id}; skipping metrics.json")
        return None
    workspace = find_workspace(unit_dir, clone)
    if not workspace:
        log(handle, f"pier left no host-side workspace checkout for {task_id}; skipping metrics.json")
        return None

    # 워크스페이스는 이 단위 안에서 ".git이 있는 첫 디렉터리"다. 어느
    # 디렉터리를 재고 어느 패치를 얹었는지 run.log에 남겨야 나중에 metrics.json이
    # 엉뚱한 체크아웃을 잰 건지 확인할 수 있다.
    log(handle, f"measured workspace ({task_id}): {workspace}")
    log(handle, f"measured patch ({task_id}): {patches[0]}")

    os.makedirs(os.path.join(work, "measured"), exist_ok=True)
    copy_dir = os.path.join(work, "measured", task_id)
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

            # 1. 클론을 뺀 작업 경로에서 디렉터리별 산출물 묶음을 모은다.
            units = find_task_units(work, clone)
            accepted = []
            any_patch = False
            for unit_dir in sorted(units):
                # 묶음은 디렉터리 단위로 이미 잘렸다. 그 안에서만 이름당 최신을
                # 고르면 전역 "파일 하나" 규칙이 다른 태스크를 지우지 않는다.
                artifacts = find_files(unit_dir, set(PIER_ARTIFACTS), skip=clone)
                patches = find_patches(unit_dir, skip=clone)
                if patches:
                    any_patch = True
                # 2. id는 디렉터리 이름이 아니라 그 안 산출물·패치에서 유도한다.
                #    안전하지 않은 값은 유도 실패와 같다 — 순번으로 짓지 않는다.
                task_id = usable_task_id(
                    resolve_task_id(args.task, clone, artifacts, patches),
                )
                if not task_id:
                    dropped = [artifacts[name] for name in PIER_ARTIFACTS if name in artifacts]
                    dropped.extend(patches)
                    what = ", ".join(dropped) if dropped else unit_dir
                    log(handle, f"task id unresolved; discarding {what}")
                    continue
                # 3. 측정 사본은 태스크마다 다른 이름. 패치 둘 이상이면 그
                #    단위의 metrics만 건너뛰고 나머지 태스크는 계속 간다.
                measured = build_measured_copy(work, clone, task_id, handle, unit_dir)
                metrics_path = os.path.join(work, "measured", f"{task_id}.metrics.json")
                if measured:
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
                        log(handle, f"collect_metrics.py exited {code}; no metrics.json for {task_id}")
                accepted.append((task_id, artifacts, metrics_path))

            # 단위가 하나도 없거나 패치가 전부 클론 안에만 있으면, 예전에 전역
            # 탐색이 남기던 같은 한 줄을 남겨 픽스처 오인 테스트가 잡을 수 있게 한다.
            if not any_patch:
                log(handle, "no patch left by pier; skipping metrics.json")

        os.makedirs(results)
        staged["created"] = True
        # 4. 받아 둔 단위만 tasks/<task-id>/ 아래로 옮긴다. id를 못 구한 단위는
        #    결과 경로에 자리가 없으므로 reward·ctrf·stdout도 남기지 않는다.
        for task_id, artifacts, metrics_path in accepted:
            dest = os.path.join(results, "tasks", task_id)
            os.makedirs(dest, exist_ok=True)
            for name in PIER_ARTIFACTS:
                source = artifacts.get(name)
                if source and os.path.exists(source):
                    shutil.move(source, os.path.join(dest, name))
            if os.path.exists(metrics_path):
                shutil.move(metrics_path, os.path.join(dest, "metrics.json"))
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
