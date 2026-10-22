'use strict';
const test = require('node:test');
const assert = require('node:assert');
const { GATE_FAILURE_HINTS, withGateFailureHints } = require('../scripts/lib/validate');

test('GATE_FAILURE_HINTS when code and match agree → attaches next only', () => {
  assert.ok(Array.isArray(GATE_FAILURE_HINTS));
  assert.deepStrictEqual(
    GATE_FAILURE_HINTS.map((h) => h.code).sort(),
    ['G13', 'G20', 'G23', 'G24', 'S32', 'S33', 'S34', 'S35', 'S36', 'S37'],
  );
  const f = (code, message) => ({ code, message, file: 'x.md' });
  const out = withGateFailureHints({ ok: false, failures: [
    f('G13', 'verification.md missing harness verify ledger record'),
    f('G13', 'verification.md harness metadata does not match verify ledger'),
    f('G13', 'verification.md missing body sections: Command'),
    f('G13', 'verification.md verify ledger unavailable (Git common directory unavailable)'),
    f('G20', 'verification task Touch must not declare source changes: src/a.js'),
    f('G20', 'verification task cannot precede commit task: TASKS-002'),
    f('S7', 'tasks.affected_paths missing or empty'),
    f('S32', 'commit_intent must be a YAML list of 0-2 strings'),
    f('S34', 'commit_summary invalid: commit_summary must contain 1-2 Korean terminal sentences (한국어 종결 문장)'),
  ] }).failures;
  assert.match(out[0].next, /bouncer verify/);
  assert.match(out[1].next, /bouncer verify/);
  assert.match(out[4].next, /Source 변경 경로 없음\./);
  assert.match(out[7].next, /YAML list of 1-2/);
  assert.match(out[8].next, /commit_summary[\s\S]*plan gate/);
  for (const i of [2, 3, 5, 6]) assert.strictEqual('next' in out[i], false, out[i].message);
});
