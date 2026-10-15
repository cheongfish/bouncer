"""git 이력 → 질문과 정답(questions.json).

정답은 코드가 실제로 바뀐 것만 쓴다. 문서 본문은 읽지 않는다(색인 출처와 분리).
BP와 커밋은 explain.md frontmatter의 task_commits로만 잇는다. 이 연결이 있는 BP가 평가 대상(universe)이다.

질문 종류:
  entity  "엔티티 E를 추가·수정·삭제한 BP는?"  정답: task 커밋 diff의 +/- 줄에 E가 단어로 나오는 BP
  file    "파일 F를 바꾼 BP는?"               정답: task 커밋이 F를 바꾼 BP
엔티티 후보는 HEAD의 scripts/src에서 뽑는다(문서가 아니라 코드 기준): kebab-case 문자열 리터럴,
G/S 게이트 코드, export된 심볼.

사용: python3 -I make_gold.py <repo> <out.json> [--entities 30] [--files 20] [--seed 0]
"""
import argparse, collections, glob, json, os, random, re, sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from common import git, keep, task_commits

MIN_GOLD, MAX_GOLD = 1, 10


def code_entities(repo):
    pool = {}
    for path in glob.glob(os.path.join(repo, "scripts/src/**/*.ts"), recursive=True):
        src = open(path, encoding="utf-8").read()
        for tok in re.findall(r"['\"]([a-z][a-z0-9]*(?:-[a-z0-9]+)+)['\"]", src):
            pool.setdefault(tok, "kebab-code")
        for tok in re.findall(r"['\"]([GS]\d{1,3})['\"]", src):
            pool.setdefault(tok, "gate-code")
        names = re.findall(r"export\s+(?:async\s+)?(?:function|const|class|type|interface)\s+([A-Za-z_]\w{5,})", src)
        m = re.search(r"^export\s*=\s*\{(.*?)^\};?", src, re.M | re.S)  # CommonJS 형식 export = { a, b: c }
        if m:
            names += re.findall(r"^\s*([A-Za-z_]\w{5,})\s*[,:\n]", m.group(1), re.M)
        for tok in names:
            pool.setdefault(tok, "symbol")
    return pool


def word(tok):
    return re.compile(r"(?<![\w-])" + re.escape(tok) + r"(?![\w-])")


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("repo")
    ap.add_argument("out")
    ap.add_argument("--entities", type=int, default=30)
    ap.add_argument("--files", type=int, default=20)
    ap.add_argument("--seed", type=int, default=0)
    a = ap.parse_args()

    tc = task_commits(a.repo)
    diff_lines = collections.defaultdict(list)   # bp -> changed lines
    files_by_bp = collections.defaultdict(set)
    for bp, shas in tc.items():
        for sha in shas:
            for f in git(a.repo, "show", "--name-only", "--format=", sha).splitlines():
                if keep(f):
                    files_by_bp[bp].add(f)
            cur = None
            for line in git(a.repo, "show", "-U0", "--format=", sha).splitlines():
                if line.startswith("+++ ") or line.startswith("--- "):
                    p = line[6:] if line[4:6] in ("a/", "b/") else ""
                    cur = p if keep(p) else None if line.startswith("+++ ") else cur
                    continue
                if cur and line[:1] in "+-":
                    diff_lines[bp].append(line[1:])
    universe = sorted(b for b in tc if files_by_bp[b])

    rng = random.Random(a.seed)
    questions = []
    pool = code_entities(a.repo)
    blob = {bp: "\n".join(lines) for bp, lines in diff_lines.items()}
    cand = []
    for tok, k in sorted(pool.items()):
        rx = word(tok)
        gold = sorted(bp for bp in universe if rx.search(blob.get(bp, "")))
        if MIN_GOLD <= len(gold) <= MAX_GOLD:
            cand.append({"type": "entity", "kind": k, "target": tok, "gold": gold})
    by_kind = collections.defaultdict(list)
    for c in cand:
        by_kind[c["kind"]].append(c)
    # 종류별로 고르게 뽑는다
    kinds = sorted(by_kind)
    picked = []
    while len(picked) < a.entities and any(by_kind.values()):
        for k in kinds:
            if by_kind[k] and len(picked) < a.entities:
                picked.append(by_kind[k].pop(rng.randrange(len(by_kind[k]))))
    questions += picked

    fcount = collections.defaultdict(list)
    for bp in universe:
        for f in files_by_bp[bp]:
            fcount[f].append(bp)
    fcand = [{"type": "file", "kind": "path", "target": f, "gold": sorted(b)}
             for f, b in sorted(fcount.items()) if 2 <= len(b) <= MAX_GOLD]
    questions += rng.sample(fcand, min(a.files, len(fcand)))

    for i, q in enumerate(questions, 1):
        q["id"] = f"Q{i:02d}"
    json.dump({"universe": universe, "questions": questions}, open(a.out, "w"), ensure_ascii=False, indent=1)
    print(json.dumps({"universe": len(universe), "entity_candidates": len(cand), "file_candidates": len(fcand),
                      "questions": len(questions),
                      "kinds": collections.Counter(q["kind"] for q in questions)}, ensure_ascii=False))


if __name__ == "__main__":
    main()
