'use strict';
const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const yaml = require('js-yaml');
const { validateBlueprint } = require('../scripts/lib/validate');
const { resolveProfile } = require('../scripts/lib/profile');

const BP_REL = 'context/epics/EPIC-001-auth/blueprints/BP-001-login';

function writeDoc(repo, rel, data, body) {
  const abs = path.join(repo, rel);
  fs.mkdirSync(path.dirname(abs), { recursive: true });
  fs.writeFileSync(abs, `---\n${yaml.dump(data)}---\n${body}`);
}

function base(type, id, status, extra) {
  return {
    type, title: `${id} doc`, description: id,
    resource: `${BP_REL}/${type.split('.')[1]}.md`,
    tags: ['bouncer'], timestamp: '2026-07-23T00:00:00+09:00',
    bouncer: { id, epic_id: 'EPIC-001', blueprint_id: 'BP-001', status, ...extra },
  };
}

test('native profile: execute gate passes on self-contained verification+review docs', () => {
  const repo = fs.mkdtempSync(path.join(os.tmpdir(), 'bouncer-native-e2e-'));

  // native profile, no superpowers anywhere
  fs.mkdirSync(path.join(repo, '.bouncer'), { recursive: true });
  const cfg = { methodology: { profile: 'native' }, verify: 'npm test' };
  fs.writeFileSync(path.join(repo, '.bouncer/config.json'), JSON.stringify(cfg));
  assert.strictEqual(resolveProfile(cfg), 'native');

  // epic + blueprint indexes
  writeDoc(repo, 'context/epics/EPIC-001-auth/index.md',
    { ...base('bouncer.epic', 'EPIC-001', 'approved'), resource: 'context/epics/EPIC-001-auth/index.md' },
    '# epic\n');
  writeDoc(repo, `${BP_REL}/index.md`,
    { ...base('bouncer.blueprint', 'BP-001', 'approved'), resource: `${BP_REL}/index.md` },
    '# blueprint\n');

  // tasks verified
  writeDoc(repo, `${BP_REL}/tasks.md`,
    base('bouncer.tasks', 'TASKS-BP-001', 'verified', {
      graph: { suggested_paths: ['src/'], basis: 'manual: src/auth/' },
      affected_paths: ['src/auth/login.js'],
    }),
    '# Tasks\n\n## Goal & intent\nx\n\n## Interface\ny\n\n## Touch\n`src/auth/`\n\n## Do not touch\n`src/pay/`\n\n## Checklist\n- [ ] a\n');

  // verification passed with body contract
  writeDoc(repo, `${BP_REL}/verification.md`,
    base('bouncer.verification', 'VERIFY-BP-001', 'passed'),
    '# Verification\n\n## Command\n`npm test`\n\n## Evidence\n42 passed, exit 0.\n');

  // review accepted with findings schema
  writeDoc(repo, `${BP_REL}/review.md`,
    base('bouncer.review', 'REVIEW-BP-001', 'accepted', {
      review: { findings: [{ id: 'F1', severity: 'minor', status: 'resolved' }] },
    }),
    '# Review\n\n## Findings\n- F1 (minor): resolved.\n');

  const res = validateBlueprint({ repoRoot: repo, blueprintDir: BP_REL, gate: 'execute' });
  assert.deepStrictEqual(res, { ok: true, failures: [] });
});
