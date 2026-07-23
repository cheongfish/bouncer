'use strict';
const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');
const { parseFrontmatter } = require('../scripts/lib/frontmatter');

const md = fs.readFileSync(
  path.join(__dirname, '..', 'skills', 'sdd-minimality', 'SKILL.md'), 'utf8',
);

test('sdd-minimality has valid frontmatter', () => {
  const { data } = parseFrontmatter(md);
  assert.strictEqual(data.name, 'sdd-minimality');
  assert.ok(data.description.length > 0);
});

test('sdd-minimality encodes the SDD-bounded minimality rules', () => {
  // decision ladder: reuse > stdlib/platform/installed deps > minimal new code
  assert.ok(/reuse|재사용/i.test(md));
  assert.ok(/dependenc|의존성/i.test(md));
  // guardrails: do not minimize approved requirements / tests / verification / security
  assert.ok(/require|승인/i.test(md));
  assert.ok(/test|verification|security|accessib|검증|보안|접근성/i.test(md));
  // record rationale, and escalate conflicts back to /sdd-plan
  assert.ok(/rationale|근거|record|기록/i.test(md));
  assert.ok(/\/sdd-plan/.test(md));
  // advisory, not a gate
  assert.ok(/advisory|권장|not a gate|게이트가 아/i.test(md));
});
