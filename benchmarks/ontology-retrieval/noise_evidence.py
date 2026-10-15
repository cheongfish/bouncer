"""엔티티 질문의 (엔티티, 정답 BP) 쌍마다 분류 근거를 모은다.

쌍마다: BP 제목, 문서 언급 여부(색인·grep), 그 토큰이 나온 +/- 줄 수, 파일, 예시 줄.
사용: python3 -I noise_evidence.py <repo> <questions.json> <static-index.json> <out.json>
"""
import collections, json, os, re, subprocess, sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from common import CONTEXT, git, keep, task_commits
import query


def main(repo, qpath, ipath, out):
    qs = json.load(open(qpath, encoding="utf-8"))["questions"]
    idx = json.load(open(ipath, encoding="utf-8"))
    tc = task_commits(repo)
    diffs = {}
    rows = []
    for q in qs:
        if q["type"] != "entity":
            continue
        tok = q["target"]
        rx = re.compile(r"(?<![\w-])" + re.escape(tok) + r"(?![\w-])")
        qhit = set(query.hits(idx, "entity", tok))
        g = subprocess.run(["grep", "-rlw", "-F", "--", tok, CONTEXT], cwd=repo, capture_output=True, text=True).stdout
        ghit = {query_bp for query_bp in (os.path.relpath(p, CONTEXT) for p in g.splitlines())}
        for bp in q["gold"]:
            plus, minus, files, ex = 0, 0, collections.Counter(), []
            for sha in tc[bp]:
                if sha not in diffs:
                    diffs[sha] = git(repo, "show", "-U0", "--format=", sha)
                cur = None
                for line in diffs[sha].splitlines():
                    if line.startswith("+++ ") or line.startswith("--- "):
                        if line.startswith("+++ "):
                            p = line[6:] if line[4:6] == "b/" else ""
                            cur = p if keep(p) else None
                        continue
                    if cur and line[:1] in "+-" and rx.search(line[1:]):
                        plus += line[0] == "+"
                        minus += line[0] == "-"
                        files[cur] += 1
                        if len(ex) < 4:
                            ex.append(f"{line[0]} {cur.rsplit('/', 1)[-1]}: {line[1:].strip()[:130]}")
            docs = any(p.startswith(bp.split("/")[0]) and f"/blueprints/{bp.split('/')[1]}" in p for p in ghit)
            rows.append({"qid": q["id"], "kind": q["kind"], "entity": tok, "bp": bp,
                         "title": idx["bps"].get(bp, {}).get("title"), "doc_index": bp in qhit, "doc_grep": docs,
                         "plus": plus, "minus": minus, "files": dict(files.most_common(4)), "examples": ex})
    json.dump(rows, open(out, "w"), ensure_ascii=False, indent=1)
    print(len(rows))


if __name__ == "__main__":
    main(*sys.argv[1:5])
