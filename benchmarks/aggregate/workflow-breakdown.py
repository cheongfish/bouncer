#!/usr/bin/env python3
"""워크플로 토큰 분해.

benchmarks/runs/<run>/의 run.json(세션별 토큰)과 agent-transcripts(도구 호출)를 묶어
세션 역할별 입력 토큰과 도구 호출 대상 분류를 낸다. 도구 결과 크기는 transcript에 없어서
호출 수만 센다. 토큰 비중은 세션 단위 실측값으로만 판단한다.

사용:
  python3 benchmarks/aggregate/workflow-breakdown.py                  # status=finalized bouncer-full 전부
  python3 benchmarks/aggregate/workflow-breakdown.py RUN [RUN ...]    # 지정 실행 (vanilla 포함)
  python3 benchmarks/aggregate/workflow-breakdown.py --runs-dir DIR --json OUT
"""
import argparse
import collections
import glob
import json
import os
import re

PROJECT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

READ_TOOLS = {'Read', 'ReadFile', 'read_file'}
SHELL_TOOLS = {'Shell', 'run_terminal_cmd', 'Bash'}
SEARCH_TOOLS = {'Grep', 'Glob', 'codebase_search', 'grep', 'SemanticSearch'}
EDIT_TOOLS = {'Edit', 'Write', 'StrReplace', 'search_replace', 'ApplyPatch', 'MultiEdit', 'edit_file', 'Delete'}

# 묶음: 플러그인 오버헤드 / 대상 코드 탐색 / 그 외
GROUP = {
    'read.plugin': 'plugin', 'search.plugin': 'plugin', 'shell.plugin-src': 'plugin',
    'shell.bouncer-cli': 'bouncer-cli', 'read.bouncer-context': 'bouncer-context',
    'read.target-code': 'target', 'read.target-test': 'target', 'search.target': 'target',
    'shell.search-read': 'target',
}


def classify(name, inp):
    s = json.dumps(inp, ensure_ascii=False)
    p = inp.get('path') or inp.get('target_file') or inp.get('file_path') or ''
    cmd = inp.get('command', '')
    if name in READ_TOOLS:
        if '/plugins/' in p:
            return 'read.plugin'
        if '/.bouncer/' in p:
            return 'read.bouncer-context'
        if re.search(r'/(test|tests)/', p):
            return 'read.target-test'
        return 'read.target-code'
    if name in SHELL_TOOLS:
        # 플러그인 소스를 셸로 뒤지는 명령은 `$BOUNCER_ROOT`를 쓰므로 'bouncer'가 들어 있어도 CLI가 아니다.
        if re.search(r'\b(cat|sed|head|tail|grep|rg|find|ls|wc)\b[^|;&\n]*(/plugins/|\$BOUNCER_ROOT|\$\{BOUNCER_ROOT\})', cmd):
            return 'shell.plugin-src'
        if re.search(r'(?:^|[\s;&|(`])bouncer\s+[a-z]', cmd):
            return 'shell.bouncer-cli'
        if '/plugins/' in cmd:
            return 'shell.plugin-src'
        if re.search(r'\b(npm|node|pytest|python|go|cargo)\b.*\btest', cmd):
            return 'shell.test'
        if re.search(r'\bgit\b', cmd):
            return 'shell.git'
        if re.search(r'\b(rg|grep|find|ls|cat|sed|head)\b', cmd):
            return 'shell.search-read'
        return 'shell.other'
    if name in SEARCH_TOOLS:
        return 'search.plugin' if '/plugins/' in s else 'search.target'
    if name in EDIT_TOOLS:
        return 'edit'
    return f'tool.{name}'


def session_role(first_user_text):
    m = re.search(r'Skill Name: ([\w-]+)', first_user_text) or re.search(r'(bouncer-[a-z-]+)', first_user_text)
    return m.group(1) if m else '?'


def analyze(run_dir):
    d = json.load(open(os.path.join(run_dir, 'run.json')))
    conv = {}
    # bouncer-full은 단계별 stage_usage, vanilla는 실행 전체 usage 하나다.
    stages = d.get('stage_usage') or {'vanilla': d.get('usage') or {}}
    for stage, v in stages.items():
        for c in (v or {}).get('conversations', []):
            conv[c['conversation_id']] = (stage, c['tokens'])
    sessions = []
    transcripts = (glob.glob(os.path.join(run_dir, '*/cursor-projects/*/agent-transcripts/*/*.jsonl'))
                   + glob.glob(os.path.join(run_dir, 'cursor-projects/*/agent-transcripts/*/*.jsonl')))
    for t in sorted(transcripts):
        cid = os.path.basename(t)[:-len('.jsonl')]
        stage, tokens = conv.get(cid, ('?', {}))
        calls = collections.Counter()
        role = None
        for line in open(t):
            o = json.loads(line)
            if o.get('role') == 'user' and role is None:
                role = session_role(json.dumps(o, ensure_ascii=False)[:4000])
            if o.get('role') != 'assistant':
                continue
            for part in o['message'].get('content', []):
                if part.get('type') == 'tool_use':
                    calls[classify(part['name'], part.get('input', {}))] += 1
        # coordinator는 skill 이름이 bouncer-run으로 잡힌다.
        if role == 'bouncer-run' and sum(calls.values()) > 0 and stage == '03-run':
            role = 'bouncer-run(coordinator)'
        sessions.append(dict(stage=stage, conversation=cid, role=role or '?', tokens=tokens, calls=dict(calls)))
    totals = collections.Counter()
    for v in stages.values():
        for k, n in ((v or {}).get('tokens') or {}).items():
            if isinstance(n, (int, float)):
                totals[k] += n
    return dict(run_id=d.get('run_id'), task_id=d.get('task_id'), condition=d.get('condition'),
                bouncer_commit=d.get('bouncer_commit'), status=d.get('status'), score=d.get('score'),
                totals=dict(totals), sessions=sessions)


def report(results):
    total_calls = collections.Counter()
    total_groups = collections.Counter()
    for r in results:
        tot_in = sum(s['tokens'].get('inputTokens', 0) for s in r['sessions'])
        t = r['totals']
        processed = t.get('inputTokens', 0) + t.get('cacheReadTokens', 0)
        print(f"== {r['run_id']} task={r['task_id']} condition={r['condition']} status={r['status']} score={r['score']} "
              f"commit={(r['bouncer_commit'] or '?')[:8]} input={t.get('inputTokens', 0) // 1000}k "
              f"cache={t.get('cacheReadTokens', 0) // 1000}k processed={processed / 1e6:.2f}M")
        for s in r['sessions']:
            t = s['tokens']
            calls = collections.Counter(s['calls'])
            total_calls.update(calls)
            for k, v in calls.items():
                total_groups[GROUP.get(k, 'other')] += v
            share = t.get('inputTokens', 0) / max(1, tot_in)
            print(f"  {s['stage']:12} {s['conversation'][:8]} {s['role']:26} in={t.get('inputTokens', 0) // 1000:4}k ({share:4.0%}) "
                  f"cache={t.get('cacheReadTokens', 0) // 1000:5}k calls={sum(calls.values()):3} "
                  + ' '.join(f'{k}={v}' for k, v in calls.most_common()))
    n = sum(total_calls.values())
    print(f'\n## 도구 호출 합계 {n}')
    for k, v in total_groups.most_common():
        print(f'  {k:16} {v:5} ({v / max(1, n):.0%})')
    for k, v in total_calls.most_common():
        print(f'    {k:22} {v:5}')


def main():
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument('runs', nargs='*')
    ap.add_argument('--runs-dir', default=os.path.join(PROJECT, 'benchmarks/runs'))
    ap.add_argument('--json')
    args = ap.parse_args()
    names = args.runs
    if not names:
        names = []
        for p in sorted(glob.glob(os.path.join(args.runs_dir, '*/run.json'))):
            try:
                d = json.load(open(p))
            except ValueError:
                continue
            if d.get('condition') == 'bouncer-full' and d.get('status') == 'finalized':
                names.append(os.path.basename(os.path.dirname(p)))
    results = [analyze(os.path.join(args.runs_dir, n)) for n in names]
    report(results)
    if args.json:
        json.dump(results, open(args.json, 'w'), indent=1, ensure_ascii=False)


if __name__ == '__main__':
    main()
