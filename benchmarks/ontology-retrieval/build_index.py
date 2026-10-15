"""컨텍스트 문서 본문 → 온톨로지 색인(index.json).

문서가 말하는 것만 쓴다. git 이력과 frontmatter의 task_commits는 쓰지 않는다(정답 출처와 분리).
노드: BP, 엔티티(본문 백틱 토큰). 관계: BP -mentions-> 엔티티 (문서·섹션 위치 포함).

사용: python3 -I build_index.py <repo> <out.json>
"""
import collections, json, os, re, sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from common import iter_docs

TICK = re.compile(r"`([^`\n]{2,200})`")
HEAD = re.compile(r"^#{1,6}\s+(.*)$")
GATE = re.compile(r"(?<![\w-])([GS]\d{1,3})(?![\w-])")
RANGE = re.compile(r"(?<![\w-])([GS])(\d{1,3})\s*[–~-]\s*[GS]?(\d{1,3})(?![\w-])")


def kind(tok):
    if re.fullmatch(r"[GS]\d{1,3}", tok):
        return "gate-code"
    if tok.startswith("bouncer ") or tok.startswith("/bouncer-"):
        return "cli"
    if tok.startswith("--"):
        return "flag"
    if "/" in tok or re.search(r"\.(md|ts|js|cjs|json|toml|yaml|yml)$", tok):
        return "path"
    if re.fullmatch(r"[a-z][a-z0-9]*(-[a-z0-9]+)+", tok):
        return "kebab-code"
    if re.fullmatch(r"[a-z][a-z0-9]*(\.[a-z_][a-z0-9_]*)+", tok):
        return "config-key"
    if re.fullmatch(r"[A-Za-z_][A-Za-z0-9_]*", tok):
        return "symbol"
    return "other"


def main(repo, out):
    bps = {}
    ent = collections.defaultdict(lambda: {"kind": None, "mentions": []})
    for bp, rel, fm, body in iter_docs(repo):
        if not bp:
            continue
        info = bps.setdefault(bp, {"title": None, "docs": []})
        info["docs"].append(rel)
        m = re.search(r"^title:\s*(.+)$", fm, re.M)
        if m and rel.endswith("/index.md") and "/tasks/" not in rel:
            info["title"] = m.group(1).strip().strip("'\"")
        section = ""
        for line in body.splitlines():
            h = HEAD.match(line)
            if h:
                section = h.group(1).strip()
                continue
            toks = [t.strip() for t in TICK.findall(line)]
            # 게이트 코드는 백틱 없이(G8·G14) 또는 범위(S15–S17)로도 쓰인다. 범위는 펼친다.
            codes = set(GATE.findall(line.replace("`", "")))
            for prefix, lo, hi in RANGE.findall(line.replace("`", "")):
                if int(hi) - int(lo) <= 20:
                    codes |= {f"{prefix}{n}" for n in range(int(lo), int(hi) + 1)}
            toks += sorted(codes - set(toks))
            for tok in toks:
                e = ent[tok]
                e["kind"] = kind(tok)
                e["mentions"].append({"bp": bp, "doc": rel.rsplit("/", 1)[-1], "section": section})
    kinds = collections.Counter(e["kind"] for e in ent.values())
    json.dump({"bps": bps, "entities": ent}, open(out, "w"), ensure_ascii=False)
    print(json.dumps({"bps": len(bps), "entities": len(ent), "kinds": kinds}, ensure_ascii=False))


if __name__ == "__main__":
    main(*sys.argv[1:3])
