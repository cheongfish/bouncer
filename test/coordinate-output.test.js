'use strict';
const test = require('node:test');
const assert = require('node:assert');
const { compactCoordinateOutput } = require('../scripts/lib/coordinate-output');

const lease = (status) => ({ id: 'L', generation: 1, seq: 1, status });
const tasks = [
  { id: '001', status: 'integrated', lease: lease('active'), workerPath: '/w1', branch: 'b1' },
  { id: '002', status: 'dispatched', lease: lease('active'), workerPath: '/w2', branch: 'b2' },
  { id: '003', status: 'pending', lease: lease('revoked') },
  { id: '004', status: 'prepared', lease: lease('active'), workerPath: '/w4', branch: 'b4' },
  { id: '005', status: 'ready', execution_kind: 'verification' },
];

test('compactCoordinateOutput projects prepare opened and leaves failures untouched', () => {
  const input = { ok: true, command: 'prepare', ready: ['004', '005'], tasks, decisions: [{}], checkpoint: {} };
  const out = compactCoordinateOutput('prepare', input);
  assert.deepStrictEqual(out.opened.map((t) => t.id), ['002', '004', '005']);
  assert.deepStrictEqual(Object.keys(out.opened[2]).sort(), ['id', 'status']);
  assert.deepStrictEqual(Object.keys(out.opened[1]).sort(), ['branch', 'id', 'lease', 'status', 'workerPath']);
  assert.strictEqual(out.tasks, undefined);
  assert.strictEqual(out.decisions, undefined);
  assert.ok(input.tasks && input.decisions);
  assert.deepStrictEqual(compactCoordinateOutput('prepare', { ok: true, ready: [], tasks: [], decisions: [] }).opened, []);
  const fail = { ok: false, reason: 'x', tasks: [1] };
  assert.strictEqual(compactCoordinateOutput('prepare', fail), fail);
  assert.strictEqual('opened' in compactCoordinateOutput('dispatch', { ok: true, tasks, decisions: [] }), false);
});
