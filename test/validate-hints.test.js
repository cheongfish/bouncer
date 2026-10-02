'use strict';
const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const yaml = require('js-yaml');
const { GATE_FAILURE_HINTS, withGateFailureHints } = require('../scripts/lib/validate');
const { runCli } = require('../scripts/lib/cli');

const BP_REL = '.bouncer/context/epics/001-auth/blueprints/001-login';

function writeDoc(repo, rel, data) {
  const abs = path.join(repo, rel);
  fs.mkdirSync(path.dirname(abs), { recursive: true });
  fs.writeFileSync(abs, `---\n${yaml.dump(data)}---\n# x\n`);
}

function capture() {
  const buf = { out: '', err: '' };
  return {
    io: { out: (s) => { buf.out += s; }, err: (s) => { buf.err += s; } },
    buf,
  };
}

test('GATE_FAILURE_HINTS attaches next only when code and match agree', () => {
  assert.ok(Array.isArray(GATE_FAILURE_HINTS));
  assert.deepStrictEqual(GATE_FAILURE_HINTS.map((h) => h.code).sort(), ['G13', 'G18', 'G20', 'G22']);
  const f = (code, message) => ({ code, message, file: 'x.md' });
  const out = withGateFailureHints({ ok: false, failures: [
    f('G18', 'context review is stale: last round digest a != current b; rerun context review'),
    f('G18', 'context-review.status != accepted'),
    f('G13', 'verification.md missing harness verify ledger record'),
    f('G13', 'verification.md harness metadata does not match verify ledger'),
    f('G13', 'verification.md missing body sections: Command'),
    f('G13', 'verification.md verify ledger unavailable (Git common directory unavailable)'),
    f('G20', 'verification task Touch must not declare source changes: src/a.js'),
    f('G20', 'verification task cannot precede commit task: TASKS-002'),
    f('G22', 'scaffold guidance comments remain: a/index.md'),
    f('S7', 'tasks.affected_paths missing or empty'),
  ] }).failures;
  assert.match(out[0].next, /round 1 discovery[\s\S]*pending/);
  assert.match(out[2].next, /bouncer verify/);
  assert.match(out[3].next, /bouncer verify/);
  assert.match(out[6].next, /Source 변경 경로 없음\./);
  assert.match(out[8].next, /plan gate/);
  for (const i of [1, 4, 5, 7, 9]) assert.strictEqual('next' in out[i], false, out[i].message);
});

test('validate JSON includes next on G22 from the plan-gate return boundary', () => {
  const repo = fs.mkdtempSync(path.join(os.tmpdir(), 'bouncer-'));
  const tasksBody = `# Tasks

## Goal & intent
Ship login validation.

## Interface
\`validateLogin(input) -> Result\`

## Touch
- \`src/auth/\`

## Do not touch
- \`src/payments/\`

## Checklist
- [ ] implement validateLogin
`;
  const paths21 = Array.from(
    { length: 21 },
    (_, i) => `src/auth/f${String(i + 1).padStart(2, '0')}.js`,
  );
  writeDoc(repo, '.bouncer/context/epics/001-auth/index.md', {
    type: 'bouncer.epic', title: 'Auth epic', description: 'auth epic',
    resource: '.bouncer/context/epics/001-auth/index.md',
    tags: ['bouncer', 'epic'], timestamp: '2026-07-01T00:00:00+09:00',
    bouncer: { id: '001', epic_id: '001', status: 'approved' },
  });
  writeDoc(repo, `${BP_REL}/index.md`, {
    type: 'bouncer.blueprint', title: 'Login blueprint', description: '001',
    resource: `${BP_REL}/index.md`,
    tags: ['bouncer', 'blueprint'], timestamp: '2026-07-01T00:00:00+09:00',
    bouncer: { id: '001', epic_id: '001', blueprint_id: '001', status: 'approved' },
  });
  fs.appendFileSync(
    path.join(repo, `${BP_REL}/index.md`),
    '<!-- 왜 지금 이 에픽인가. 두 문장 이내. -->\n',
  );
  const tasksRel = `${BP_REL}/tasks/001/tasks.md`;
  const abs = path.join(repo, tasksRel);
  fs.mkdirSync(path.dirname(abs), { recursive: true });
  fs.writeFileSync(abs, `---\n${yaml.dump({
    type: 'bouncer.tasks', title: 'Login tasks', description: 'Tasks for 001',
    resource: tasksRel, tags: ['bouncer', 'tasks'], timestamp: '2026-07-01T00:00:00+09:00',
    bouncer: {
      id: 'TASKS-001', epic_id: '001', blueprint_id: '001', status: 'ready',
      graph: { suggested_paths: ['src/'], basis: 'manual: src/' },
      affected_paths: paths21,
    },
  })}---\n${tasksBody}`);
  writeDoc(repo, `${BP_REL}/tasks/001/verification.md`, {
    type: 'bouncer.verification', title: 'Verify 001', description: 'v',
    resource: `${BP_REL}/tasks/001/verification.md`,
    tags: ['bouncer'], timestamp: '2026-07-01T00:00:00+09:00',
    bouncer: { id: 'VERIFY-001', epic_id: '001', blueprint_id: '001', status: 'pending' },
  });
  writeDoc(repo, `${BP_REL}/tasks/001/review.md`, {
    type: 'bouncer.review', title: 'Review 001', description: 'r',
    resource: `${BP_REL}/tasks/001/review.md`,
    tags: ['bouncer'], timestamp: '2026-07-01T00:00:00+09:00',
    bouncer: { id: 'REVIEW-001', epic_id: '001', blueprint_id: '001', status: 'pending' },
  });
  writeDoc(repo, `${BP_REL}/context-review.md`, {
    type: 'bouncer.context_review', title: '001 context review', description: 'c',
    resource: `${BP_REL}/context-review.md`,
    tags: ['bouncer', 'context_review'], timestamp: '2026-07-01T00:00:00+09:00',
    bouncer: {
      id: 'CTXREVIEW-001', epic_id: '001', blueprint_id: '001', status: 'accepted',
      context_review: { findings: [] },
    },
  });
  const crAbs = path.join(repo, `${BP_REL}/context-review.md`);
  fs.writeFileSync(
    crAbs,
    fs.readFileSync(crAbs, 'utf8').replace('# x\n', '# Context review\n\n## Findings\n(none)\n'),
  );
  const indexAbs = path.join(repo, '.bouncer/context/index.md');
  fs.mkdirSync(path.dirname(indexAbs), { recursive: true });
  fs.writeFileSync(
    indexAbs,
    '---\nokf_version: "0.1"\n---\n# Epics\n\n'
    + '* [001 auth](epics/001-auth/index.md) - auth epic\n',
  );
  const { io, buf } = capture();
  const code = runCli(
    ['validate', '--repo', repo, '--blueprint', BP_REL, '--gate', 'plan'],
    io,
  );
  assert.strictEqual(code, 1, `stderr=${buf.err}`);
  const parsed = JSON.parse(buf.out);
  const g22 = parsed.failures.find((x) => x.code === 'G22');
  assert.ok(g22, JSON.stringify(parsed.failures));
  assert.match(g22.next, /plan gate/);
});
