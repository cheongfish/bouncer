"""Claude Code 세션 기록에서 컨텍스트 문서 검색이 차지하는 몫을 잰다.

도구 호출을 세 가지로 나눈다.
  ctx-own    .bouncer/context 경로를 쓰는 호출 중 아래 ctx-cross가 아닌 것(현재 BP 문서 읽기·쓰기)
  ctx-cross  .bouncer/context를 grep·glob으로 훑거나 epic 여러 개를 함께 참조하는 호출(과거 결정 검색)
  other      그 외
도구 결과 크기(JSON 직렬화 바이트)를 함께 센다. 토큰과 비례하지만 같지 않다. 분류는 문자열 판정이라 근사치다.

사용:
  python3 -I benchmarks/co-change-impact/context-search-share.py ~/.claude/projects/<project-dir>
"""
import collections, glob, json, os, re, sys

root = sys.argv[1]
pat = re.compile(r"\.bouncer/context/epics/(\d{3})")
calls = collections.Counter()
sizes = collections.Counter()
sessions = 0
files = glob.glob(os.path.join(root, "*.jsonl")) + glob.glob(os.path.join(root, "*/subagents/*.jsonl"))
for f in files:
    sessions += 1
    kinds = {}
    for line in open(f, errors="replace"):
        try:
            d = json.loads(line)
        except ValueError:
            continue
        content = (d.get("message") or {}).get("content")
        if not isinstance(content, list):
            continue
        for b in content:
            if b.get("type") == "tool_use":
                s = json.dumps(b.get("input", {}), ensure_ascii=False)
                k = "other"
                if ".bouncer/context" in s:
                    cross = len(set(pat.findall(s))) > 1 or "grep" in s.lower() or b.get("name") in ("Grep", "Glob")
                    k = "ctx-cross" if cross else "ctx-own"
                kinds[b.get("id")] = k
                calls[k] += 1
            elif b.get("type") == "tool_result":
                r = b.get("content")
                sizes[kinds.get(b.get("tool_use_id"), "other")] += len(json.dumps(r, ensure_ascii=False)) if r else 0

tc, ts = sum(calls.values()), sum(sizes.values())
print(f"sessions {sessions}  calls {tc}")
for k in ("ctx-own", "ctx-cross", "other"):
    print(f"{k:10} calls {calls[k]:6} ({calls[k] / tc:.1%})  result {sizes[k] / 1e6:6.1f}MB ({sizes[k] / ts:.1%})")
