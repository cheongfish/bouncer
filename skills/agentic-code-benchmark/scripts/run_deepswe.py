#!/usr/bin/env python3
"""Run the DeepSWE suite once and keep only the artifacts.

One invocation clones datacurve-ai/deep-swe into an ignored work path, drives
`pier run` over the clone's `tasks` directory, rebuilds a measured copy per
task from the patch Pier left (host checkout if present, otherwise the task
project at base from task metadata), calls collect_metrics.py on each copy, moves
the artifacts into docs/benchmark/deepswe/results/<run-id>/tasks/<task-id>/
(with one run.log at the run root) and removes the work path. The work path
is removed on success, on failure and on Ctrl-C alike. A one-task run uses
the same layout; there is no flat single-task fallback.

Why metrics.json is produced here: Pier runs the agent inside a container, so
collect_metrics.py can never reach that workspace git. Without the copy this
runner rebuilds, the `--metrics` input of the scorecard bridge would not exist.

`--arm` selects the execution condition for that invocation. vanilla is
`pier run --agent` with no plugin. superpowers enables only that plugin and
never creates `.bouncer/`. bouncer leaves `bouncer init`, a light scaffold, and
`bouncer current --set` in the work path before `pier run`; the Pier agent
runs plan/execute/commit. Missing superpowers exits non-zero without installing
it or writing a results path. stdlib only.
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
# 태스크 메타데이터가 base 커밋을 적는 키. Harbor task.toml은
# base_commit_hash이고, JSON 태스크는 저장소마다 이름이 갈린다.
BASE_KEYS = (
    "base_commit_hash", "base_commit", "base_sha", "base", "commit", "environment_commit",
)
# 측정 대상은 스위트 클론이 아니라 태스크가 가리키는 프로젝트 저장소다.
REPO_URL_KEYS = ("repository_url", "repo_url", "repo")
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
    "bouncer": "install the Bouncer CLI on PATH; this runner does not install it",
}

# 비교 플러그인 arm 이름. 설치 명령은 돌리지 않고 PATH 존재만 본다.
PLUGIN_ARM = "superpowers"
# light scaffold 고정 id. 런마다 새 작업 경로라 001이 충돌하지 않는다.
BOUNCER_EPIC_SLUG = "deepswe-bench"
BOUNCER_BP_SLUG = "task"


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
    단위 디렉터리로 범위를 좁힌다. 없으면 호출 쪽이 태스크 프로젝트 트리를
    메타데이터로 복원한다. `.git` 부재만으로 metrics.json을 건너뛰지 않는다.

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


def pick_toml(path, keys):
    """TOML에서 `keys` 순서대로 첫 비어 있지 않은 따옴표 문자열을 돌려준다.

    Harbor `task.toml`의 repository_url·base_commit_hash는 한 줄 문자열이다.
    전체 TOML 파서는 러너가 안 읽는 테이블까지 끌어들이므로 쓰지 않는다.

    Args:
        path (str): task.toml 경로
        keys (tuple[str, ...]): 우선순위 키

    Returns:
        str | None: 첫 매칭 값, 없으면 None
    """
    found = {}
    try:
        with open(path, "r", errors="replace") as handle:
            for line in handle:
                match = re.match(r'^\s*([A-Za-z0-9_]+)\s*=\s*"(.*)"\s*$', line)
                if not match:
                    continue
                key, value = match.group(1), match.group(2).strip()
                if key in keys and value:
                    found[key] = value
    except OSError:
        return None
    for key in keys:
        if key in found:
            return found[key]
    return None


def collect_task_field(clone, task_id, keys):
    """클론의 태스크 디렉터리에서 JSON·TOML 메타의 첫 필드를 읽는다.

    Args:
        clone (str): deep-swe 클론 경로
        task_id (str | None): 태스크 id
        keys (tuple[str, ...]): 찾을 키

    Returns:
        str | None: 첫 값, 없거나 디렉터리가 없으면 None
    """
    if not task_id:
        return None
    task_dir = os.path.join(clone, "tasks", task_id)
    try:
        names = sorted(os.listdir(task_dir))
    except OSError:
        return None
    for name in names:
        full = os.path.join(task_dir, name)
        if name.endswith(".json"):
            value = pick(read_json(full), keys)
            if value:
                return value
        if name.endswith(".toml"):
            value = pick_toml(full, keys)
            if value:
                return value
    return None


def resolve_base(clone, task_id, copy_dir):
    """Task base commit: task metadata first, else the untouched copy's HEAD."""
    base = collect_task_field(clone, task_id, BASE_KEYS)
    if base:
        return base
    return git_out(["rev-parse", "HEAD"], copy_dir) or None


def restore_task_project(copy_dir, repo_url, handle):
    """태스크 프로젝트 저장소를 빈 측정 사본에 origin으로 붙인다.

    스위트 클론의 `tasks/`를 `--repo`로 쓰지 않기 위해 사본은 항상
    `work/measured/<task-id>`에 새로 만든다. `git clone --depth 1`은 기본
    브랜치 tip만 가져와 Harbor `base_commit_hash`가 빠지므로, 여기서는
    init+remote만 하고 SHA fetch는 호출 쪽이 한다.

    Args:
        copy_dir (str): 측정 사본 경로
        repo_url (str): 프로젝트 URL 또는 로컬 경로
        handle (TextIO): run.log

    Returns:
        bool: init과 remote 추가가 성공하면 True
    """
    os.makedirs(copy_dir, exist_ok=True)
    if stream(["git", "init"], handle, cwd=copy_dir) != 0:
        return False
    if stream(["git", "remote", "add", "origin", repo_url], handle, cwd=copy_dir) != 0:
        return False
    return True


def build_measured_copy(work, clone, task_id, handle, unit_dir):
    """이 태스크 단위의 패치를 태스크 프로젝트 base 위에 얹은 측정 사본을 만든다.

    패치가 없거나 사본 체인을 끝내지 못하면 None이다. 빈 diff로 measured
    필드를 채우면 "재지 않음"이 "아무것도 안 고침"으로 읽힌다. 호스트 `.git`이
    없어도 태스크 메타의 프로젝트 트리를 복원한다. 사본 경로는 태스크마다
    갈라서 한 런의 사본이 서로를 덮지 않게 한다.

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
    # 호스트 `.git`이 없어도 측정은 태스크 프로젝트에서 한다. Pier/Harbor는
    # 컨테이너 안에서 커밋하고 패치만 호스트에 남긴다. 스위트 클론 `tasks/`를
    # 재면 gold 픽스처와 instruction을 에이전트 diff로 오인한다.
    workspace = find_workspace(unit_dir, clone)
    os.makedirs(os.path.join(work, "measured"), exist_ok=True)
    copy_dir = os.path.join(work, "measured", task_id)

    if workspace:
        log(handle, f"measured workspace ({task_id}): {workspace}")
        shutil.copytree(workspace, copy_dir, symlinks=True)
    else:
        repo_url = collect_task_field(clone, task_id, REPO_URL_KEYS)
        if not repo_url:
            log(handle, f"task project repository not found for {task_id}; skipping metrics.json")
            return None
        log(handle, f"restored task project ({task_id}): {repo_url}")
        if not restore_task_project(copy_dir, repo_url, handle):
            log(handle, f"could not init task project copy for {task_id}; skipping metrics.json")
            return None

    log(handle, f"measured patch ({task_id}): {patches[0]}")
    base = resolve_base(clone, task_id, copy_dir)
    if not base:
        log(handle, "task base commit not found; skipping metrics.json")
        return None
    if not workspace:
        # 얕은 default-branch clone은 tip만 가져온다. SHA를 origin에서 직접 받는다.
        if stream(["git", "fetch", "--depth", "1", "origin", base], handle, cwd=copy_dir) != 0:
            if stream(["git", "fetch", "origin", base], handle, cwd=copy_dir) != 0:
                log(handle, f"base commit {base} not checkoutable in the copy; skipping metrics.json")
                return None
    if stream(["git", "checkout", "--detach", base], handle, cwd=copy_dir) != 0:
        log(handle, f"base commit {base} not checkoutable in the copy; skipping metrics.json")
        return None
    if stream(["git", "apply", os.path.abspath(patches[0])], handle, cwd=copy_dir) != 0:
        log(handle, f"patch does not apply onto {base}; skipping metrics.json")
        return None
    return copy_dir, base


def require_host_tools(arm):
    """클론 전에 PATH에서 arm이 필요로 하는 도구를 확인한다.

    없는 도구를 여기서 설치하지 않는다. 측정 호스트가 런마다 달라지면 비교가
    깨진다. 비교 플러그인 arm은 부재 시 결과 경로를 만들기 전에 비영으로 끝낸다.

    Args:
        arm (str): `--arm` 값. vanilla / superpowers / bouncer

    Returns:
        None: 통과하면 그대로 진행한다. 없으면 fail()로 프로세스가 끝난다.
    """
    for tool in ("pier", "docker"):
        if shutil.which(tool) is None:
            fail(f"{tool} not found on PATH. {INSTALL_HINT[tool]}")
    if arm == PLUGIN_ARM and shutil.which(PLUGIN_ARM) is None:
        # 설치를 시도하지 않는다. 한 줄 이유만 stderr로 남기고 결과 JSON은 없다.
        fail(
            f"{PLUGIN_ARM} not found on the host. install it first; "
            "this runner does not install it",
        )
    if arm == "bouncer" and shutil.which("bouncer") is None:
        fail(f"bouncer not found on PATH. {INSTALL_HINT['bouncer']}")


def _replace_once(path, pattern, replacement):
    """파일에서 정규식 한 건만 바꾸고, 못 바꾸면 준비를 멈춘다.

    Args:
        path (str): 절대 경로
        pattern (str): 반드시 한 번 맞아야 하는 패턴
        replacement (str): 치환 문자열. 백슬래시는 리터럴로 둔다.

    Returns:
        None: 성공 시 파일을 덮어쓴다. 0건·2건 이상이면 fail().
    """
    text = open(path, encoding="utf-8").read()
    updated, n = re.subn(pattern, replacement, text, count=1, flags=re.M)
    if n != 1:
        fail(f"could not update {path}: expected one match for {pattern!r}, got {n}", 1)
    open(path, "w", encoding="utf-8").write(updated)


def fill_light_plan(work):
    """scaffold 직후 템플릿이 plan 게이트를 통과하도록 light 본문만 채운다.

    `bouncer current --set`은 포인터를 쓰기 전에 plan 게이트를 그대로 돈다.
    light scaffold 기본값은 epic/blueprint=`draft`, tasks=`draft`, 빈
    `affected_paths`, 빈 `basis`, `<TODO:>` 본문이라 게이트가 거절한다.
    `--no-verify`로 건너뛰면 안 되므로, 러너가 쓰는 문서가 실제로 통과하게
    만든다. execute/commit CLI는 여전히 부르지 않는다.

    Args:
        work (str): 이 런의 작업 경로

    Returns:
        None: 파일이 없거나 치환이 한 건이 아니면 fail()로 끝낸다.
    """
    epic_rel = os.path.join(".bouncer", "context", "epics", f"001-{BOUNCER_EPIC_SLUG}")
    bp_rel = os.path.join(epic_rel, "blueprints", f"001-{BOUNCER_BP_SLUG}")
    epic = os.path.join(work, epic_rel, "index.md")
    blueprint = os.path.join(work, bp_rel, "index.md")
    tasks = os.path.join(work, bp_rel, "tasks", "001", "tasks.md")
    for path in (epic, blueprint, tasks):
        if not os.path.isfile(path):
            fail(f"light scaffold missing {path}", 1)
    # 프론트매터 status 한 줄만 바꾼다. 본문 플레이스홀더의 "draft"와 섞이지 않게
    # YAML 들여쓰기 두 칸을 고정한다.
    _replace_once(epic, r"^  status: draft$", "  status: approved")
    _replace_once(blueprint, r"^  status: draft$", "  status: approved")
    _replace_once(tasks, r"^  status: draft$", "  status: ready")
    # 측정 대상은 스위트 클론이다. Touch 백틱과 같은 문자열이어야 G11이 통과한다.
    _replace_once(tasks, r"^  affected_paths: \[\]$", "  affected_paths:\n    - deep-swe")
    # --no-graphify 런이라 그래프를 돌리지 않았다. 빈 basis는 S9/G4다.
    _replace_once(
        tasks,
        r"^    basis: \[\]$",
        "    basis:\n"
        "      - graph: source\n"
        "        status: skip-disabled\n"
        "        query: deepswe bench workspace\n"
        "        result: graphify skipped (--no-graphify); clone is the work tree",
    )
    _replace_once(
        tasks,
        r"^<TODO: 완료 후 시스템이 어떻게 달라지는가>$",
        "Pier가 준 DeepSWE 태스크를 Bouncer light 사이클로 구현한다.",
    )
    _replace_once(
        tasks,
        r"^- Modify `<TODO: 수정할-파일>` — <TODO: 왜 만지는가>$",
        "- Modify `deep-swe` — 스위트 클론이 에이전트가 고치는 작업 트리이다.",
    )
    _replace_once(
        tasks,
        r"^- \[ \] <TODO: 작업 항목>$",
        "- [ ] Pier 태스크를 구현하고 검증한다.",
    )


def prepare_bouncer_workspace(work, handle):
    """`pier run` 전에 light 사이클 골격만 작업 경로에 남긴다.

    init → epic/blueprint scaffold → light 본문 채움 → current --set 까지가
    러너 몫이다. plan 게이트 이후 execute/commit은 Pier 에이전트가 돌린다.
    `--no-verify`와 validate CLI는 여기서 부르지 않는다 — 게이트 우회로
    통과시키지 않기 위해.

    Args:
        work (str): 이 런의 작업 경로. `.bouncer/`를 여기에 만든다.
        handle (TextIO): run.log

    Returns:
        None: 한 단계라도 비영이면 fail()로 끝낸다.
    """
    # 작업 경로는 호스트 저장소 아래 `.benchmarks/`라, git init을 안 하면
    # `current --set`이 부모 `.git/bouncer/current`에 포인터를 쓴다. 중첩
    # 저장소로 만들어야 이 런의 워크스페이스에만 남는다.
    init_git = ["git", "init"]
    git_code = stream(init_git, handle, cwd=work)
    if git_code != 0:
        fail(f"{' '.join(init_git)} exited {git_code}", 1)
    # graphify pip 설치는 arm 조건이 아니다. 측정 호스트를 런마다 바꾸지 않는다.
    epic_dir = os.path.join(".bouncer", "context", "epics", f"001-{BOUNCER_EPIC_SLUG}")
    bp_dir = os.path.join(epic_dir, "blueprints", f"001-{BOUNCER_BP_SLUG}")
    steps = (
        ["bouncer", "init", "--no-graphify"],
        [
            "bouncer", "scaffold", "epic", "--id", "001", "--name", BOUNCER_EPIC_SLUG,
            "--description", "DeepSWE benchmark task workspace",
        ],
        [
            "bouncer", "scaffold", "blueprint",
            "--epic-dir", epic_dir, "--id", "001", "--name", BOUNCER_BP_SLUG,
            "--scale", "light",
        ],
    )
    for cmd in steps:
        code = stream(cmd, handle, cwd=work)
        if code != 0:
            fail(f"{' '.join(cmd)} exited {code}", 1)
    fill_light_plan(work)
    set_cmd = ["bouncer", "current", "--set", bp_dir, "--task", "001"]
    code = stream(set_cmd, handle, cwd=work)
    if code != 0:
        fail(f"{' '.join(set_cmd)} exited {code}", 1)


def pier_command(target, args):
    """arm 조건이 섞인 `pier run` argv를 만든다.

    판정은 Pier verifier다. 여기 인자로 통과를 다시 매기지 않는다.
    vanilla와 bouncer는 플러그인 환경 변수를 넣지 않는다. 비교 플러그인 arm만
    `--ae`로 그 플러그인을 켠다. Pier 자체에 plugin 플래그가 없기 때문이다.

    Args:
        target (str): `-p`에 넘길 태스크 또는 tasks 디렉터리
        args (argparse.Namespace): 파싱된 CLI

    Returns:
        list[str]: subprocess로 넘길 argv
    """
    cmd = ["pier", "run", "-p", target, "--agent", args.agent]
    if args.arm == PLUGIN_ARM:
        cmd += ["--ae", f"CLAUDE_CODE_PLUGIN={PLUGIN_ARM}"]
    if args.model:
        cmd += ["--model", args.model]
    if not args.task:
        if args.n_tasks:
            cmd += ["--n-tasks", str(args.n_tasks)]
        if args.sample_seed:
            cmd += ["--sample-seed", str(args.sample_seed)]
    return cmd


def parse_args(argv):
    parser = argparse.ArgumentParser(
        description="Clone deep-swe, run it through pier, keep only the artifacts.",
    )
    parser.add_argument("--run-id", required=True, help="run identifier; names both the work and result path")
    parser.add_argument(
        "--arm", required=True, choices=("vanilla", PLUGIN_ARM, "bouncer"),
        help=(
            "sets the arm run condition: vanilla=no plugin; "
            f"{PLUGIN_ARM}=that plugin only; "
            "bouncer=init+light scaffold before pier"
        ),
    )
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
    require_host_tools(args.arm)

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
            # arm 워크스페이스는 pier보다 먼저. 스텁은 이 시점의 `.bouncer/` 유무를 본다.
            if args.arm == "bouncer":
                prepare_bouncer_workspace(work, handle)
            pier = pier_command(target, args)
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
