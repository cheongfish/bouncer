import collections, json, random, sys

rows = json.load(open(sys.argv[1]))
conds = ["G", "C", "CK", "U", "R", "GC", "RU"]
print(f"BPs={len(rows)}  truth files={sum(r['truth'] for r in rows)}  "
      f"(existing before BP={sum(r['truth_existing'] for r in rows)})")
print(f"{'cond':4} {'macroP':>7} {'macroR':>7} {'macroF1':>8} {'microP':>7} {'microR':>7} {'avg#pred':>9}")
for c in conds:
    P = sum(r[c]["p"] for r in rows) / len(rows)
    R = sum(r[c]["r"] for r in rows) / len(rows)
    F = sum(r[c]["f"] for r in rows) / len(rows)
    tp = sum(r[c]["tp"] for r in rows)
    n = sum(r[c]["n"] for r in rows)
    t = sum(r["truth"] for r in rows)
    print(f"{c:4} {P:7.3f} {R:7.3f} {F:8.3f} {tp/max(n,1):7.3f} {tp/t:7.3f} {n/len(rows):9.1f}")

# paired bootstrap of macro F1 differences
random.seed(0)
def boot(a, b, k=5000):
    d = [r[a]["f"] - r[b]["f"] for r in rows]
    m = sum(d) / len(d)
    s = sorted(sum(random.choice(d) for _ in d) / len(d) for _ in range(k))
    return m, s[int(.025 * k)], s[int(.975 * k)]
for a, b in [("C", "G"), ("R", "G"), ("GC", "G"), ("RU", "G"), ("RU", "C")]:
    m, lo, hi = boot(a, b)
    print(f"F1 {a}-{b}: {m:+.3f}  95% CI [{lo:+.3f}, {hi:+.3f}]")

print("\nrecall by category (hit/total, micro)")
cats = sorted({k for r in rows for k in r["G"]["by_cat"]})
print(f"{'cat':11}" + "".join(f"{c:>12}" for c in conds))
for cat in cats:
    line = f"{cat:11}"
    for c in conds:
        h = sum(r[c]["by_cat"].get(cat, [0, 0])[0] for r in rows)
        t = sum(r[c]["by_cat"].get(cat, [0, 0])[1] for r in rows)
        line += f"{h:>5}/{t:<4}{h/max(t,1):.0%}".rjust(12)
    print(line)
