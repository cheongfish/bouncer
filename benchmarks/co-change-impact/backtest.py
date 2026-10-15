"""Leave-future-out backtest: predict a BP's non-source files from its source files.

Seed  = scripts/src files the BP actually changed (assumes source discovery is solved,
        Graphify recall 0.92).
Target = non-source files the BP changed (tests, rules, agents, skills, references, ...).
Train  = only commits dated strictly before the BP's first commit.
Conditions:
  G  grep: files under doc/test dirs containing the seed file stem, at the BP's parent rev
  C  co-change: candidates with support>=MIN_SUP and conf>=MIN_CONF from training history
  CK co-change top-K by confidence
  U  G ∪ C
"""
import collections, json, os, re, subprocess, sys

REPO = sys.argv[1]
MIN_SUP, MIN_CONF, TOPK = 2, 0.2, 8
SEARCH_DIRS = ["test", "rules", "agents", "skills", "references", ".codex", "docs", "hooks", "resources"]
EXCLUDE = (".bouncer/", "scripts/lib/", "package-lock.json", "graphify-out/", "CHANGELOG.md")
GENERIC_STEMS = {"index", "types", "util", "utils", "cli"}


def git(*a):
    return subprocess.run(["git", "-C", REPO, *a], capture_output=True, text=True).stdout


def keep(p):
    return p and not p.startswith(EXCLUDE)


def is_src(p):
    return p.startswith("scripts/src/")


def category(p):
    top = p.split("/")[0]
    return top if top in {"test", "rules", "agents", "skills", "references", ".codex"} else "other"


# ---- load BPs from explain.md task_commits
bps = []
for root, _, files in os.walk(os.path.join(REPO, ".bouncer/context/epics")):
    if "explain.md" not in files:
        continue
    text = open(os.path.join(root, "explain.md")).read()
    shas = re.findall(r"^\s+sha:\s*([0-9a-f]{7,40})", text, re.M)
    commits = []
    for s in shas:
        out = git("show", "--name-only", "--format=%H %ct", s).strip().splitlines()
        if not out:
            continue
        full, ts = out[0].split()
        commits.append((int(ts), full, {p for p in out[1:] if keep(p)}))
    if commits:
        bps.append({"id": os.path.relpath(root, os.path.join(REPO, ".bouncer/context/epics")),
                    "commits": sorted(commits)})

all_commits = {}
for bp in bps:
    for ts, h, fs in bp["commits"]:
        all_commits[h] = (ts, fs)

# full git history as additional training data (non-bouncer commits too)
hist = []
cur = None
for line in git("log", "--no-merges", "--name-only", "--format=@@%H %ct").splitlines():
    if line.startswith("@@"):
        h, ts = line[2:].split()
        cur = (int(ts), h, set())
        hist.append(cur)
    elif line and cur and keep(line):
        cur[2].add(line)


def evaluate(pred, truth):
    tp = len(pred & truth)
    p = tp / len(pred) if pred else 0.0
    r = tp / len(truth) if truth else 0.0
    f = 2 * p * r / (p + r) if p + r else 0.0
    return p, r, f, tp


def cochange(train, seeds, min_sup=MIN_SUP):
    cnt = collections.Counter()
    pair = collections.Counter()
    for _, _, fs in train:
        if len(fs) > 60:  # skip mass rename/format commits
            continue
        for s in seeds & fs:
            cnt[s] += 1
            for f in fs:
                if not is_src(f):
                    pair[(s, f)] += 1
    scores = {}
    for (s, f), n in pair.items():
        c = n / cnt[s]
        if n >= min_sup:
            scores[f] = max(scores.get(f, 0), c)
    return scores


def grep_baseline(rev, seeds):
    out = set()
    for s in seeds:
        stem = os.path.basename(s).rsplit(".", 1)[0]
        if stem in GENERIC_STEMS or len(stem) < 4:
            continue
        res = git("grep", "-l", "-F", stem, rev, "--", *SEARCH_DIRS)
        out |= {l.split(":", 1)[1] for l in res.splitlines() if ":" in l}
    return {p for p in out if keep(p)}


results = []
for bp in bps:
    first_ts, first_h = bp["commits"][0][0], bp["commits"][0][1]
    changed = set().union(*(fs for _, _, fs in bp["commits"]))
    seeds = {p for p in changed if is_src(p)}
    truth = {p for p in changed if not is_src(p)}
    if not seeds or not truth:
        continue
    parent = first_h + "^"
    existing = set(git("ls-tree", "-r", "--name-only", parent).splitlines())
    train = [c for c in hist if c[0] < first_ts]
    sc = cochange(train, seeds)
    C = {f for f, c in sc.items() if c >= MIN_CONF and f in existing}
    ranked = sorted(((f, c) for f, c in sc.items() if f in existing), key=lambda x: -x[1])
    CK = {f for f, _ in ranked[:TOPK]}
    G = grep_baseline(parent, seeds)
    U = G | C
    sc1 = cochange(train, seeds, 1)
    # R: grep candidates reranked by co-change confidence, top 15; GC: grep ∩ any co-change
    R = {f for f, _ in sorted(((f, sc1.get(f, 0)) for f in G), key=lambda x: -x[1])[:15]}
    GC = {f for f in G if sc1.get(f, 0) > 0}
    # RU: top 15 from union of grep and co-change(sup>=1), ranked by co-change conf
    RU = {f for f, _ in sorted(((f, sc1.get(f, 0)) for f in (G | {f for f in sc1 if f in existing})), key=lambda x: -x[1])[:15]}
    row = {"bp": bp["id"], "seeds": len(seeds), "truth": len(truth),
           "truth_existing": len(truth & existing), "train": len(train)}
    for name, pred in [("G", G), ("C", C), ("CK", CK), ("U", U), ("R", R), ("GC", GC), ("RU", RU)]:
        p, r, f, tp = evaluate(pred, truth)
        row[name] = {"p": p, "r": r, "f": f, "n": len(pred), "tp": tp,
                     "by_cat": {cat: [len({x for x in pred & truth if category(x) == cat}),
                                      len({x for x in truth if category(x) == cat})]
                                for cat in {category(x) for x in truth}}}
    results.append(row)

json.dump(results, open(sys.argv[2], "w"), indent=1)
print("BPs evaluated:", len(results))
