// test/cli-help.test.js
'use strict';
const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const { runCli } = require('../scripts/lib/cli');
const { NAMED_AGENTS } = require('../scripts/lib/codex-agents');

const SUBCOMMANDS = [
  'validate', 'scaffold', 'finalize', 'seed-worktree', 'verify', 'init', 'graph-sync',
  'intent',
  'graphify-bin',
  'project-root',
  'subagent-model',
  'codex-agents',
  'current',
  'migrate',
  'commit',
  'commit-guard',
  'coordinate',
  'execute',
  'plan',
  'run',
  'import',
  'review-dispatch',
  'review',
  'context-review',
  'dispatch',
  'config',
  'retro',
  'metrics',
];

function capture(argv) {
  const buf = { out: '', err: '' };
  const code = runCli(argv, {
    out: (s) => { buf.out += s; },
    err: (s) => { buf.err += s; },
  });
  return { code, ...buf };
}

test('인자 없이 bouncer를 실행하면 → usage를 출력하고 exit 0을 낸다', () => {
  const r = capture([]);
  assert.strictEqual(r.code, 0);
  assert.match(r.out, /usage/i);
  assert.strictEqual(r.err, '');
});

test('usage → task-layout migration을 나열한다', () => {
  assert.match(capture([]).out, /task-layout \[--dry-run\]/);
});

test('usage → retention dry-run과 apply 형식을 나열한다', () => {
  const out = capture([]).out;
  assert.match(out, /migrate\s+retention\b/);
  assert.match(out, /Audit closed blueprints for retention \(dry-run/);
  assert.match(out, /retention --apply --blueprint <dir>/);
});

test('usage → review-scope migration 형식을 나열한다', () => {
  assert.match(capture([]).out, /migrate\s+review-scope --blueprint <dir>/);
});

test('모든 subcommand가 → usage 텍스트에 나열된다', () => {
  const r = capture([]);
  for (const name of SUBCOMMANDS) {
    // 행 머리의 서브커맨드 이름만 본다. finalize 설명의 "commit" 단어에
    // 걸려 신설 명령이 빠진 채로 통과하지 않게 한다.
    assert.match(
      r.out,
      new RegExp(`(?:^|\\n)\\s*${name}\\b`, 'm'),
      `usage omits ${name}`,
    );
  }
});

test('usage → 폐기된 distill 명령을 생략한다', () => {
  const retired = ['d', 'istill'].join('');
  assert.doesNotMatch(capture([]).out, new RegExp(`^\\s*${retired}\\b`, 'm'));
});

test('--help, -h, help → 같은 usage를 stdout에 출력한다', () => {
  const baseline = capture([]).out;
  for (const flag of [['--help'], ['-h'], ['help']]) {
    const r = capture(flag);
    assert.strictEqual(r.code, 0, `${flag} exit code`);
    assert.strictEqual(r.out, baseline, `${flag} output`);
  }
});

test('알 수 없는 명령 → 실패하지만 사용 가능한 명령을 알려준다', () => {
  const r = capture(['validat']);
  assert.strictEqual(r.code, 2);
  assert.match(r.err, /unknown command: validat/);
  assert.match(r.err, /usage/i);
  assert.strictEqual(r.out, '');
});

test('usage → scaffold task --blueprint --id를 나열한다', () => {
  const r = capture([]);
  assert.match(r.out, /task --blueprint <dir> --id <ddd>/);
});

test('usage → scaffold context-review --blueprint를 나열한다', () => {
  const r = capture([]);
  assert.match(r.out, /context-review --blueprint <dir>/);
});

test('usage → scaffold blueprint --scale light|full을 나열한다', () => {
  const r = capture([]);
  assert.match(r.out, /blueprint --epic-dir <dir> --id <ddd> --name <slug> \[--scale light\|full\]/);
});

test('graph-sync help → source와 test scope를 명시한다', () => {
  const r = capture([]);
  assert.match(r.out, /graph-sync Rebuild stale graphify source \+ test graphs/);
});

test('graph-suggest 실행 → unknown command로 exit 2를 낸다', () => {
  const r = capture(['graph-suggest', '--query', 'x']);
  assert.strictEqual(r.code, 2);
  assert.match(r.err.split('\n')[0], /^unknown command: graph-suggest$/);
});

test('help 출력 → context-search를 나열하지 않는다', () => {
  const r = capture([]);
  assert.doesNotMatch(r.out, /context-search/);
});

test('context-search → 알 수 없는 명령으로 exit 2를 낸다', () => {
  let stdout = '';
  let stderr = '';
  const code = runCli(['context-search', '--mode', 'decision', '--query', 'x'], {
    out: (s) => { stdout += s; },
    err: (s) => { stderr += s; },
  });
  assert.strictEqual(code, 2);
  assert.strictEqual(stdout, '');
  assert.match(stderr, /unknown command: context-search/);
});

test('usage → run preflight --blueprint를 나열한다', () => {
  const r = capture([]);
  assert.match(r.out, /run\s+preflight --blueprint <dir>/);
});

test('usage → current --replace를 나열한다', () => {
  const r = capture([]);
  assert.match(r.out, /current\s+\[--set <blueprint dir>.*\[--replace\]/s);
});

test('usage → intent --symbol [--candidate] [--limit]를 나열한다', () => {
  const r = capture([]);
  assert.match(r.out, /intent\s+--symbol <function-name>/);
  assert.match(r.out, /\[--candidate <qualified-ref>\]/);
  assert.match(r.out, /\[--limit <1\.\.5>\]/);
});

test('intent가 공개된 뒤 알 수 없는 명령 → 여전히 거부된다', () => {
  const r = capture(['intet']);
  assert.equal(r.code, 2);
  assert.match(r.err, /unknown command: intet/);
  assert.match(r.err, /intent/);
  assert.equal(r.out, '');
});

test('usage → finalize prepare --blueprint를 나열한다', () => {
  const r = capture([]);
  assert.match(r.out, /finalize\s+prepare --blueprint <dir>/);
  assert.match(r.out, /finalize\s+links --blueprint <dir>/);
  assert.match(r.out, /finalize\s+release-main --blueprint <dir>/);
  assert.match(r.out, /finalize\s+--blueprint <dir> \[--yes\]/);
});

test('usage → subagent-model과 codex-agents check를 나열한다', () => {
  const out = capture([]).out;
  assert.match(out, /subagent-model --agent <name> \[--provider <name>\]/);
  assert.match(out, /codex-agents check --agent <name>/);
});

test('usage → review-dispatch plan과 execute 형식을 나열한다', () => {
  const out = capture([]).out;
  assert.match(out, /review-dispatch\s+plan --blueprint <dir>/);
  assert.match(
    out,
    /review-dispatch\s+execute --blueprint <dir> \[--task <ddd>\] --base <sha> --head <sha>/,
  );
});

test('usage → review record 형식을 나열한다', () => {
  const out = capture([]).out;
  assert.match(
    out,
    /review record --blueprint <dir> \[--task <ddd>\] --round <json-file> \[--status <requested\|addressed\|accepted>\]/,
  );
});

test('review record에 --status pending, non-ddd --task, --round 누락이 있으면 → 거부한다', () => {
  const pending = capture([
    'review', 'record', '--blueprint', 'bp', '--round', 'x.json', '--status', 'pending',
  ]);
  assert.strictEqual(pending.code, 2);
  assert.match(pending.err, /status/i);
  assert.strictEqual(pending.out, '');

  const task = capture([
    'review', 'record', '--blueprint', 'bp', '--task', '1', '--round', 'x.json',
  ]);
  assert.strictEqual(task.code, 2);
  assert.match(task.err, /task/i);
  assert.strictEqual(task.out, '');

  const missingRound = capture(['review', 'record', '--blueprint', 'bp']);
  assert.strictEqual(missingRound.code, 2);
  assert.match(missingRound.err, /round/i);
  assert.strictEqual(missingRound.out, '');
});

test('subcommand 없는 review-dispatch → stderr에 exit 2를 낸다', () => {
  const r = capture(['review-dispatch']);
  assert.strictEqual(r.code, 2);
  assert.match(r.err, /review-dispatch/);
  assert.strictEqual(r.out, '');
});

test('usage → dispatch print 형식을 나열한다', () => {
  const out = capture([]).out;
  assert.match(
    out,
    /dispatch print --role <implementer\|reviewer\|debugger\|context-reviewer\|coordinator> --cwd <dir> --input <file> --out <dir>/,
  );
});


test('usage → coordinate revoke와 lease 플래그를 나열한다', () => {
  const r = capture([]);
  assert.match(r.out, /coordinate revoke/);
  assert.match(r.out, /--lease-id/);
  assert.match(r.out, /--generation/);
  assert.match(r.out, /coordinate integrate/);
  assert.match(r.out, /omit --task for the wave/);
});

test('usage → coordinate repair review-finding과 required-task CI 형식을 나열한다', () => {
  const out = capture([]).out;
  // CI 형태는 종단 verification이 필수. 선택 [--task]로 적으면 리뷰 형태와
  // 같은 생략 규칙을 암시해 coordinator의 task-required와 어긋난다.
  assert.match(
    out,
    /coordinate repair --blueprint <dir> --task <ddd> --failure-command <cmd>/,
  );
  assert.doesNotMatch(out, /\[--task <ddd>\] --failure-command/);
  assert.match(
    out,
    /coordinate repair --blueprint <dir> \[--task <ddd>\] --review-finding <id>/,
  );
  assert.match(out, /\[--review-finding <id>\]\.\.\./);
});

const COORDINATE_SUBCOMMANDS = [
  'bootstrap', 'prepare', 'ready', 'dispatch', 'report', 'record', 'rerecord', 'integrate',
  'status', 'revise', 'repair', 'partial-close', 'critical-recovery', 'revoke', 'next', 'advance',
  'promote-stop', 'session-open', 'worker-model', 'worker-tokens',
];

test('coordinate <sub> --help와 -h → 그 subcommand usage를 stdout에 출력한다', () => {
  for (const sub of COORDINATE_SUBCOMMANDS) {
    for (const flag of ['--help', '-h']) {
      const r = capture(['coordinate', sub, flag]);
      assert.strictEqual(r.code, 0, `${sub} ${flag} exit`);
      assert.strictEqual(r.err, '', `${sub} ${flag} stderr`);
      assert.ok(
        r.out.startsWith(`usage: bouncer coordinate ${sub}`),
        `${sub} ${flag} stdout prefix: ${r.out.slice(0, 80)}`,
      );
    }
  }
});

test('coordinate bootstrap --help → documents light promotion flag', () => {
  const r = capture(['coordinate', 'bootstrap', '--help']);
  assert.strictEqual(r.code, 0);
  assert.match(r.out, /--promote-light/);
});

test('coordinate next --help → 플래그, action, 응답 필드를 나열한다', () => {
  const r = capture(['coordinate', 'next', '--help']);
  assert.strictEqual(r.code, 0);
  assert.strictEqual(r.err, '');
  assert.match(r.out, /--blueprint <dir>/);
  assert.match(r.out, /\[--task <ddd>\]/);
  assert.match(r.out, /\[--repo <dir>\]/);
  assert.match(r.out, /prepare/);
  assert.match(r.out, /drive_tasks/);
  assert.match(r.out, /verification_node/);
  assert.match(r.out, /final_review/);
  assert.match(r.out, /dispatch/);
  assert.match(r.out, /implement/);
  assert.match(r.out, /action/);
  assert.match(r.out, /cwd/);
  assert.match(r.out, /argv/);
  assert.match(r.out, /judge/);
  assert.match(r.out, /task_ids/);
  assert.match(r.out, /payload/);
  assert.match(r.out, /checkpoint/);
  // card 필드와 카드를 싣는 action 10개가 한 줄에 함께 나와야 호출자가 --help만으로 첨부 규칙을 안다.
  assert.match(
    r.out,
    /^.*\bcard\b.*\bdispatch, implement, verify, review, report, revise, record, supplement, final_review, blocked\b.*$/m,
  );
});

test('coordinate advance --help → 플래그와 중단 사유를 나열한다', () => {
  const r = capture(['coordinate', 'advance', '--help']);
  assert.strictEqual(r.code, 0);
  assert.strictEqual(r.err, '');
  assert.match(r.out, /--blueprint <dir>/);
  assert.match(r.out, /\[--task <ddd>\]/);
  assert.match(r.out, /\[--max-steps <n>\]/);
  assert.match(r.out, /judge/);
  assert.match(r.out, /worker/);
  assert.match(r.out, /max-steps/);
  assert.match(r.out, /repeated-failure/);
  assert.match(r.out, /unclear-result/);
  assert.match(r.out, /advance-argv-invalid/);
});

test('coordinate report --help → report outcome enum을 나열한다', () => {
  const r = capture(['coordinate', 'report', '--help']);
  assert.strictEqual(r.code, 0);
  assert.match(r.out, /accepted\|rework\|scope_revision\|task_change\|blocked/);
});

test('coordinate --help → coordinate registry usage를 stdout에 출력한다', () => {
  const { coordinate } = require('../scripts/lib/cli-git-commands.js');
  const r = capture(['coordinate', '--help']);
  assert.strictEqual(r.code, 0);
  assert.strictEqual(r.err, '');
  assert.strictEqual(r.out, coordinate.usage);
});

test('coordinate dispatch --help가 ledger fence 누락과 함께 오면 → help가 우선한다', () => {
  const r = capture(['coordinate', 'dispatch', '--blueprint', 'x', '--task', '001', '--help']);
  assert.strictEqual(r.code, 0);
  assert.strictEqual(r.err, '');
  assert.ok(r.out.startsWith('usage: bouncer coordinate dispatch'));
  assert.doesNotMatch(r.out, /ledger-checkpoint-invalid/);
  assert.doesNotMatch(r.err, /ledger-checkpoint-invalid/);
});

test('coordinate revoke --reason -h → help가 아니라 플래그 값으로 취급한다', () => {
  const r = capture([
    'coordinate', 'revoke', '--blueprint', 'x', '--task', '001', '--reason', '-h',
    '--ledger-path', 'p', '--ledger-hash', 'h',
  ]);
  assert.ok(!r.out.startsWith('usage:'));
});

test('필수 플래그가 빠진 coordinate report → 해당 subcommand usage를 덧붙인다', () => {
  const r = capture([
    'coordinate', 'report', '--blueprint', 'x',
    '--ledger-path', 'p', '--ledger-hash', 'h', '--attempt', '1',
  ]);
  assert.strictEqual(r.code, 2);
  assert.match(r.err, /--task-brief-hash is required/);
  assert.match(r.err, /usage: bouncer coordinate report/);
  assert.strictEqual(r.out, '');
});

test('알 수 없는 coordinate subcommand → 전체 coordinate usage를 덧붙인다', () => {
  const { coordinate } = require('../scripts/lib/cli-git-commands.js');
  const r = capture(['coordinate', 'nope', '--blueprint', 'x']);
  assert.strictEqual(r.code, 2);
  assert.match(r.err, /command must be/);
  assert.ok(r.err.includes(coordinate.usage));
  assert.strictEqual(r.out, '');
});

test('review record와 dispatch print에 --help/-h를 주면 → stdout에 출력한다', () => {
  for (const argv of [
    ['review', 'record', '--help'],
    ['review', 'record', '-h'],
    ['dispatch', 'print', '--help'],
    ['dispatch', 'print', '-h'],
  ]) {
    const r = capture(argv);
    assert.strictEqual(r.code, 0, `${argv.join(' ')} exit`);
    assert.strictEqual(r.err, '', `${argv.join(' ')} stderr`);
  }
  assert.ok(capture(['review', 'record', '--help']).out.includes('finding-merge-candidate'));
  assert.ok(capture(['context-review', '--help']).out.includes('finding-merge-candidate'));
  const dispatchHelp = capture(['dispatch', 'print', '--help']);
  assert.match(dispatchHelp.out, /not JSON/);
});

test('coordinator procedure → 플러그인 소스 대신 subcommand --help를 가리킨다', () => {
  const md = fs.readFileSync('agents/bouncer-coordinator.md', 'utf8');
  assert.match(md, /--help`; do not read plugin sources for them/);
});

test('review-dispatch에 --help/-h를 주면 → context review 예시와 함께 stdout에 출력한다', () => {
  for (const argv of [
    ['review-dispatch', '--help'],
    ['review-dispatch', 'plan', '--help'],
    ['review-dispatch', 'plan', '-h'],
    ['review-dispatch', 'plan', '--blueprint', 'x', '--help'],
    ['review-dispatch', 'execute', '--help'],
  ]) {
    const r = capture(argv);
    assert.strictEqual(r.code, 0, `${argv.join(' ')} exit`);
    assert.strictEqual(r.err, '', `${argv.join(' ')} stderr`);
    assert.match(r.out, /target\.digest/, `${argv.join(' ')} digest guidance`);
    assert.match(r.out, /```yaml/, `${argv.join(' ')} example`);
  }
});

test('review-dispatch --help → previous 거부 reason 세 가지와 context-review record 안내를 공개한다', () => {
  const r = capture(['review-dispatch', '--help']);
  assert.strictEqual(r.code, 0);
  for (const reason of ['previous-payload-required', 'previous-payload-invalid', 'previous-payload-stale']) {
    assert.ok(r.out.includes(reason), reason);
  }
  assert.ok(r.out.includes('context-review record'));
});

test('잘못된 호출의 review-dispatch → 계속 거부하고 플래그 값 -h는 값으로 취급한다', () => {
  const valueH = capture(['review-dispatch', 'plan', '--blueprint', '-h']);
  assert.doesNotMatch(valueH.out, /```yaml/);
  for (const argv of [['review-dispatch'], ['review-dispatch', 'plan']]) {
    const r = capture(argv);
    assert.strictEqual(r.code, 2, `${argv.join(' ')} exit`);
    assert.strictEqual(r.out, '', `${argv.join(' ')} stdout`);
  }
});

test('coordinate status --help → --write-input을 나열한다', () => {
  const r = capture(['coordinate', 'status', '--help']);
  assert.strictEqual(r.code, 0);
  assert.match(r.out, /\[--write-input <file>\]/);
});

test('config --help/-h → subagents 키를 stdout에 출력하고 다른 argv는 거부한다', () => {
  for (const flag of ['--help', '-h']) {
    const r = capture(['config', flag]);
    assert.strictEqual(r.code, 0, `config ${flag} exit`);
    assert.strictEqual(r.err, '');
    for (const v of ['subagents.provider', 'subagents.dispatch', 'subagents.<provider>.<agent>',
      'claude', 'cursor', 'codex', 'antigravity', 'print', 'inherit', ...NAMED_AGENTS]) {
      assert.ok(r.out.includes(v), v);
    }
  }
  for (const argv of [['config'], ['config', 'set'], ['config', '--provider', 'cursor']]) {
    const r = capture(argv);
    assert.strictEqual(r.code, 2, `${argv.join(' ')} exit`);
    assert.match(r.err, /usage: bouncer config --help/);
    assert.strictEqual(r.out, '');
  }
});

test('usage와 repair help → supplement kind를 나열한다', () => {
  const out = capture([]).out;
  assert.match(out, /coordinate repair --blueprint <dir> --kind supplement/);
  assert.match(out, /--done/);
  const help = capture(['coordinate', 'repair', '--help']).out;
  assert.match(help, /--kind <product\|supplement>/);
  assert.match(help, /supplement/);
  assert.match(capture(['coordinate', 'next', '--help']).out, /Blueprint actions:[^\n]*supplement/);
});

test('usage → retro read --path [--max-chars]를 나열한다', () => {
  assert.match(capture([]).out, /retro read --path <file> \[--max-chars <n>\]/);
});

test('context-review --help와 -h → usage를 stdout에 출력하고 exit 0을 낸다', () => {
  for (const flag of ['--help', '-h']) {
    const r = capture(['context-review', flag]);
    assert.strictEqual(r.code, 0, `${flag} exit`);
    assert.strictEqual(r.err, '', `${flag} stderr`);
    assert.ok(r.out.startsWith('usage: bouncer context-review start'), r.out.slice(0, 80));
    assert.ok(r.out.includes('context-review close'), 'help includes context-review close');
  }
});

test('context-review 동사 없음·필수 플래그 누락 → usage를 stderr에 내고 exit 2를 낸다', () => {
  for (const argv of [['context-review'], ['context-review', 'start'], ['context-review', 'restart', '--blueprint', 'x', '--dispatch', 'd']]) {
    const r = capture(argv);
    assert.strictEqual(r.code, 2, argv.join(' '));
    assert.strictEqual(r.out, '');
    assert.match(r.err, /usage: bouncer context-review/);
  }
});

test('context-review --help → json 예시 블록 3개와 finding status open|resolved|accepted 출력', () => {
  const out = capture(['context-review', '--help']).out;
  assert.equal([...out.matchAll(/```json\n/g)].length, 3);
  assert.match(out, /open\|resolved\|accepted/);
});
