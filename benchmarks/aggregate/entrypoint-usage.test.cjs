'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { report } = require('./entrypoint-usage.cjs');

test('reports entrypoint averages only from available measurements', () => {
  const rows = report([
    { condition: 'bouncer-full', admin_api_usage: { entrypoints: { '02-plan': {
      status: 'reported', tokens: { totalTokens: 100 }, charged_cents: 2,
      duration_ms: 1000, execution_status: 'stage_returned',
    } } } },
    { condition: 'bouncer-full', admin_api_usage: { entrypoints: { '02-plan': {
      status: 'incomplete', tokens: null, charged_cents: null,
      duration_ms: 3000, execution_status: 'awaiting_user_decision',
    } } } },
  ]);
  assert.deepEqual(rows, [{ condition: 'bouncer-full', entrypoint: '02-plan',
    samples: 2, token_samples: 1, cost_samples: 1, duration_samples: 2,
    execution_statuses: { stage_returned: 1, awaiting_user_decision: 1 },
    mean_total_tokens: 100, mean_charged_cents: 2, mean_duration_ms: 2000,
  }]);
});
