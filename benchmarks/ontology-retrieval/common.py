"""컨텍스트 문서와 git 이력을 읽는 공용 함수."""
import os, re, subprocess

CONTEXT = ".bouncer/context/epics"
BP_DIR = re.compile(r"^(\d{3})[^/]*/blueprints/(\d{3})[^/]*")
EXCLUDE = (".bouncer/", "scripts/lib/", "package-lock.json", "graphify-out/", "CHANGELOG.md")


def git(repo, *args):
    return subprocess.run(["git", "-C", repo, *args], capture_output=True, text=True).stdout


def bp_of(relpath):
    """epics/ 아래 상대 경로 → 'EEE/BBB' 또는 None(epic 문서)."""
    m = BP_DIR.match(relpath)
    return f"{m.group(1)}/{m.group(2)}" if m else None


def iter_docs(repo):
    """(bp_id, relpath, frontmatter, body)를 낸다. epic 문서는 bp_id가 None이다."""
    root = os.path.join(repo, CONTEXT)
    for dirpath, _, files in os.walk(root):
        for name in sorted(files):
            if not name.endswith(".md"):
                continue
            path = os.path.join(dirpath, name)
            rel = os.path.relpath(path, root)
            text = open(path, encoding="utf-8").read()
            fm, body = "", text
            if text.startswith("---"):
                end = text.find("\n---", 3)
                if end != -1:
                    fm, body = text[3:end], text[end + 4:]
            yield bp_of(rel), rel, fm, body


def task_commits(repo):
    """BP → task 커밋 sha 목록. explain.md frontmatter의 task_commits에서 읽는다."""
    out = {}
    for bp, rel, fm, _ in iter_docs(repo):
        if bp and rel.endswith("explain.md"):
            shas = re.findall(r"^\s+sha:\s*([0-9a-f]{7,40})", fm, re.M)
            if shas:
                out.setdefault(bp, []).extend(shas)
    return out


def keep(path):
    return bool(path) and not path.startswith(EXCLUDE)
