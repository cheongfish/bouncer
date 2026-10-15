"""에이전트 없이 색인 질의와 grep을 정답에 대어 본다(사전 점검).

조건:
  Q       query.py entity/file 결과의 BP
  Gw      grep -rlw -F <target> .bouncer/context/epics  (file 질문은 -w 없이 경로 그대로)
  Gs      file 질문만: 파일 이름 stem으로 grep (scripts/lib ↔ scripts/src 이름 변화 대응)
채점은 universe(task_commits가 있는 BP) 안의 예측만 센다. 밖의 예측은 맞는지 알 수 없어 따로 센다.
출력량(token 대리 지표): Q는 query.py 출력 바이트, G는 grep -rn 출력 바이트(에이전트가 보통 내용과 함께 본다).

사용: python3 -I eval_static.py <repo> <index.json> <questions.json> <out.json>
"""
import json, os, random, subprocess, sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from common import CONTEXT, bp_of
import query


def grep(repo, target, word, list_only):
    args = ["grep", "-r", "-F", "-I"]
    args += ["-l"] if list_only else ["-n"]
    if word:
        args.append("-w")
    out = subprocess.run(args + ["--", target, CONTEXT], cwd=repo, capture_output=True, text=True).stdout
    return out


def bps_from_grep(out):
    res = set()
    for line in out.splitlines():
        path = line.split(":", 1)[0]
        bp = bp_of(os.path.relpath(path, CONTEXT))
        if bp:
            res.add(bp)
    return res


def score(pred, gold, universe):
    inside = pred & universe
    tp = len(inside & gold)
    p = tp / len(inside) if inside else 0.0
    r = tp / len(gold) if gold else 0.0
    f = 2 * p * r / (p + r) if p + r else 0.0
    return {"p": p, "r": r, "f": f, "n_in": len(inside), "n_out": len(pred - universe)}


def main(repo, index_path, qpath, out):
    idx = json.load(open(index_path, encoding="utf-8"))
    qs = json.load(open(qpath, encoding="utf-8"))
    universe = set(qs["universe"])
    rows = []
    for q in qs["questions"]:
        gold, t = set(q["gold"]), q["target"]
        mode = q["type"]
        qout = query.run(idx, mode, t)
        qpred = {l.split()[0] for l in qout.splitlines() if l[:3].isdigit()}
        word = mode == "entity"
        gl = grep(repo, t, word, True)
        gn = grep(repo, t, word, False)
        row = {"id": q["id"], "type": mode, "kind": q["kind"], "target": t, "gold": len(gold),
               "Q": {**score(qpred, gold, universe), "bytes": len(qout.encode())},
               "Gw": {**score(bps_from_grep(gl), gold, universe), "bytes": len(gn.encode())}}
        if mode == "file":
            s = t.rsplit("/", 1)[-1].rsplit(".", 1)[0]
            sl, sn = grep(repo, s, True, True), grep(repo, s, True, False)
            row["Gs"] = {**score(bps_from_grep(sl), gold, universe), "bytes": len(sn.encode())}
        rows.append(row)
    json.dump(rows, open(out, "w"), ensure_ascii=False, indent=1)

    def report(sel, name):
        if not sel:
            return
        print(f"\n[{name}] n={len(sel)}")
        print(f"{'cond':4} {'P':>6} {'R':>6} {'F1':>6} {'out-of-universe':>16} {'median bytes':>13} {'mean bytes':>11}")
        for c in ("Q", "Gw", "Gs"):
            if c not in sel[0]:
                continue
            P = sum(r[c]["p"] for r in sel) / len(sel)
            R = sum(r[c]["r"] for r in sel) / len(sel)
            F = sum(r[c]["f"] for r in sel) / len(sel)
            oo = sum(r[c]["n_out"] for r in sel) / len(sel)
            b = sorted(r[c]["bytes"] for r in sel)
            print(f"{c:4} {P:6.3f} {R:6.3f} {F:6.3f} {oo:16.1f} {b[len(b) // 2]:13,} {sum(b) / len(b):11,.0f}")
        random.seed(0)
        d = [r["Q"]["f"] - r["Gw"]["f"] for r in sel]
        bs = sorted(sum(random.choice(d) for _ in d) / len(d) for _ in range(5000))
        print(f"F1 Q-Gw {sum(d) / len(d):+.3f}  95% CI [{bs[125]:+.3f}, {bs[4875]:+.3f}]")

    report(rows, "all")
    report([r for r in rows if r["type"] == "entity"], "entity")
    for k in ("gate-code", "kebab-code", "symbol"):
        report([r for r in rows if r["kind"] == k], k)
    report([r for r in rows if r["type"] == "file"], "file")


if __name__ == "__main__":
    main(*sys.argv[1:5])
