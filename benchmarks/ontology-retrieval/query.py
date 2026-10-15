"""온톨로지 색인 질의 CLI (실험 조건 B가 쓴다).

  python3 -I query.py <index.json> entity <token>   토큰을 언급한 BP와 섹션
  python3 -I query.py <index.json> file <path>      경로를 언급한 BP와 섹션 (scripts/lib/x.js ↔ scripts/src/lib/x.ts 같은 이름 변화 허용)
  python3 -I query.py <index.json> impact <token|path>  해당 BP들의 Touch에 함께 나온 경로 상위 15개

출력은 한 줄에 BP 하나: `EEE/BBB  제목  [섹션×횟수, ...]`
"""
import collections, json, os, re, sys


def stem(p):
    base = p.rstrip("/").rsplit("/", 1)[-1]
    parent = p.rstrip("/").rsplit("/", 2)[-2] if p.count("/") >= 1 else ""
    return parent, base.rsplit(".", 1)[0]


def match_entity(tok, target):
    return tok == target or re.search(r"(?<![\w-])" + re.escape(target) + r"(?![\w-])", tok) is not None


def match_file(tok, target):
    if tok == target or tok.endswith("/" + target) or target.endswith("/" + tok):
        return True
    if not re.search(r"\.(md|ts|js|cjs|json|toml|ya?ml)$", tok):
        return False
    tp, ts = stem(tok)
    gp, gs = stem(target)
    return ts == gs and ("/" not in tok or tp == gp)


def hits(index, mode, target):
    fn = match_file if mode == "file" else match_entity
    by_bp = collections.defaultdict(collections.Counter)
    for tok, e in index["entities"].items():
        if mode == "file" and e["kind"] != "path":
            continue
        if fn(tok, target):
            for m in e["mentions"]:
                by_bp[m["bp"]][m["section"][:24] or "-"] += 1
    return by_bp


def run(index, mode, target):
    lines = []
    if mode == "impact":
        is_path = "/" in target or bool(re.search(r"\.\w+$", target))
        bps = hits(index, "file" if is_path else "entity", target)
        co = collections.Counter()
        for tok, e in index["entities"].items():
            if e["kind"] != "path":
                continue
            for m in e["mentions"]:
                if m["bp"] in bps and m["section"].lower().startswith("touch"):
                    co[tok] += 1
        lines.append(f"bps {len(bps)}: " + " ".join(sorted(bps)))
        for tok, n in co.most_common(15):
            lines.append(f"{n:3} {tok}")
        return "\n".join(lines)
    for bp, secs in sorted(hits(index, mode, target).items()):
        title = (index["bps"].get(bp, {}).get("title") or "")[:40]
        s = ", ".join(f"{k}×{v}" if v > 1 else k for k, v in secs.most_common(4))
        lines.append(f"{bp}  {title}  [{s}]")
    return "\n".join(lines) or "(no match)"


if __name__ == "__main__":
    idx = json.load(open(sys.argv[1], encoding="utf-8"))
    print(run(idx, sys.argv[2], sys.argv[3]))
