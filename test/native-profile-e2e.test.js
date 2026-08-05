'use strict';
const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const yaml = require('js-yaml');
const { validateBlueprint } = require('../scripts/lib/validate');

const BP_REL = '.bouncer/context/epics/001-auth/blueprints/001-login';

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
    bouncer: { id, epic_id: '001', blueprint_id: '001', status, ...extra },
  };
}

test('execute validation reruns the configured command instead of trusting evidence', () => {
  const repo = fs.mkdtempSync(path.join(os.tmpdir(), 'bouncer-native-e2e-'));

  // native Bouncer workflow: self-contained verification + review docs
  fs.mkdirSync(path.join(repo, '.bouncer'), { recursive: true });
  const cfg = { verify: 'node -e "process.exit(7)"' };
  fs.writeFileSync(path.join(repo, '.bouncer/config.json'), JSON.stringify(cfg));

  // epic + blueprint indexes
  writeDoc(repo, '.bouncer/context/epics/001-auth/index.md',
    { ...base('bouncer.epic', '001', 'approved'), resource: '.bouncer/context/epics/001-auth/index.md' },
    '# epic\n');
  writeDoc(repo, `${BP_REL}/index.md`,
    { ...base('bouncer.blueprint', '001', 'approved'), resource: `${BP_REL}/index.md` },
    '# blueprint\n');

  // tasks verified
  writeDoc(repo, `${BP_REL}/tasks.md`,
    base('bouncer.tasks', 'TASKS-001', 'verified', {
      graph: { suggested_paths: ['src/'], basis: 'manual: src/auth/' },
      affected_paths: ['src/auth/login.js'],
    }),
    '# Tasks\n\n## Goal & intent\nx\n\n## Interface\ny\n\n'
    + '## Touch\n`src/auth/`\n\n## Do not touch\n`src/pay/`\n\n## Checklist\n- [ ] a\n');

  // verification passed with body contract
  writeDoc(repo, `${BP_REL}/verification.md`,
    base('bouncer.verification', 'VERIFY-001', 'passed', {
      verification: {
        command: 'npm test',
        ran_at: '2026-07-27T00:00:00.000Z',
        exit_code: 0,
        output_tail: '42 passed.',
      },
    }),
    '# Verification\n\n## Command\n`npm test`\n\n## Evidence\n'
    + 'Ran at: 2026-07-27T00:00:00.000Z\nExit code: 0\n\n```\n42 passed.\n```\n');

  // review accepted with findings schema
  writeDoc(repo, `${BP_REL}/review.md`,
    base('bouncer.review', 'REVIEW-001', 'accepted', {
      review: { findings: [{ id: 'F1', severity: 'minor', status: 'resolved' }] },
    }),
    '# Review\n\n## Findings\n- F1 (minor): resolved.\n');

  const res = validateBlueprint({ repoRoot: repo, blueprintDir: BP_REL, gate: 'execute' });
  assert.strictEqual(res.ok, false);
  assert.ok(res.failures.some((failure) => failure.code === 'G13'));
  const verification = require('../scripts/lib/frontmatter')
    .readDoc(path.join(repo, BP_REL, 'verification.md'));
  assert.strictEqual(verification.data.bouncer.status, 'failed');
});
