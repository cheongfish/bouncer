'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const { runCli } = require('../scripts/lib/cli');
const { scaffoldEpic, scaffoldBlueprint } = require('../scripts/lib/scaffold');
const { parseFrontmatter } = require('../scripts/lib/frontmatter');
const { renderDoc } = require('../scripts/lib/render');
const { validateBlueprint } = require('../scripts/lib/validate');

const TS = '2026-07-01T00:00:00+09:00';
const BP_REL = '.bouncer/context/epics/001-auth/blueprints/001-login';

const EXAMPLE_FINDING = {
  id: 'F1',
  severity: 'major',
  status: 'resolved',
  category: 'correctness',
  brief_clause: 'tasks/001 Interface',
  file: 'scripts/lib/x.js',
  symbol: 'f',
  actionability: 'must_fix',
  origin: 'discovery',
  first_seen_round: 1,
  last_seen_round: 1,
};

const EXAMPLE_ROUND = {
  round: 1,
  mode: 'discovery',
  target: { base: 'aaa', head: 'bbb' },
  perspectives: [{ name: 'combined', target_head: 'bbb' }],
  previous_finding_ids: [],
  new: 1,
  resolved: 0,
  regressed: 0,
};

function capture(argv) {
  const buf = { out: '', err: '' };
  const code = runCli(argv, {
    out: (s) => { buf.out += s; },
    err: (s) => { buf.err += s; },
  });
  return { code, ...buf };
}

/**
 * review_scope: blueprint 픽스처. 루트 review.md는 scaffold가 만든다.
 *
 * @returns {{ repo: string, blueprintDir: string, reviewPath: string }}
 */
function makeBlueprintRepo() {
  const repo = fs.mkdtempSync(path.join(os.tmpdir(), 'bouncer-review-record-'));
  scaffoldEpic({
    repoRoot: repo, epicId: '001', name: 'auth', timestamp: TS,
    description: 'Auth epic description',
  });
  scaffoldBlueprint({
    repoRoot: repo, epicDir: '.bouncer/context/epics/001-auth',
    blueprintId: '001', name: 'login', timestamp: TS,
  });
  return {
    repo,
    blueprintDir: BP_REL,
    reviewPath: path.join(repo, BP_REL, 'review.md'),
  };
}

function writeJson(dir, name, value) {
  const file = path.join(dir, name);
  fs.writeFileSync(file, `${JSON.stringify(value)}\n`);
  return file;
}

function roundPayload(round, findings, extra = {}) {
  return { round: { ...EXAMPLE_ROUND, ...round }, findings, ...extra };
}

function recordCli(repo, extra = {}) {
  const argv = ['review', 'record', '--repo', repo, '--blueprint', BP_REL, '--round', extra.round];
  if (extra.task) argv.push('--task', extra.task);
  if (extra.status) argv.push('--status', extra.status);
  return capture(argv);
}

test('review-record module is loadable', () => {
  const { recordReview } = require('../scripts/lib/review-record');
  assert.equal(typeof recordReview, 'function');
});

test('discovery round with --status addressed records fingerprint and passes G21 format', () => {
  const { repo, reviewPath } = makeBlueprintRepo();
  const roundFile = writeJson(repo, 'round.json', roundPayload(EXAMPLE_ROUND, [EXAMPLE_FINDING]));
  const { recordReview } = require('../scripts/lib/review-record');
  const result = recordReview({
    repoRoot: repo,
    blueprintDir: BP_REL,
    roundFile,
    status: 'addressed',
  });
  assert.equal(result.ok, true);
  assert.equal(result.round, 1);
  assert.equal(result.status, 'addressed');
  assert.equal(result.findings, 1);
  const { data } = parseFrontmatter(fs.readFileSync(reviewPath, 'utf8'));
  assert.equal(data.bouncer.review.rounds[0].mode, 'discovery');
  assert.equal(
    data.bouncer.review.findings[0].fingerprint,
    'correctness:tasks/001 interface:scripts/lib/x.js#f',
  );
  const validated = validateBlueprint({
    repoRoot: repo,
    blueprintDir: BP_REL,
    gate: 'finalize',
  });
  const g21 = (validated.failures || []).filter((f) => f.code === 'G21');
  assert.ok(
    !g21.some((f) => String(f.message).startsWith('review ')),
    `G21 format failures: ${JSON.stringify(g21)}`,
  );
});

test('round number 3 is out of sequence and leaves bytes unchanged', () => {
  const { repo, reviewPath } = makeBlueprintRepo();
  const before = fs.readFileSync(reviewPath);
  const roundFile = writeJson(repo, 'round.json', roundPayload({ round: 3 }, [EXAMPLE_FINDING]));
  const { recordReview } = require('../scripts/lib/review-record');
  const result = recordReview({
    repoRoot: repo,
    blueprintDir: BP_REL,
    roundFile,
  });
  assert.equal(result.ok, false);
  assert.equal(result.reason, 'review-round-out-of-sequence');
  assert.deepEqual(fs.readFileSync(reviewPath), before);
});

test('findings object is review-input-invalid and leaves bytes unchanged', () => {
  const { repo, reviewPath } = makeBlueprintRepo();
  const before = fs.readFileSync(reviewPath);
  const roundFile = writeJson(repo, 'round.json', { round: EXAMPLE_ROUND, findings: {} });
  const { recordReview } = require('../scripts/lib/review-record');
  const result = recordReview({
    repoRoot: repo,
    blueprintDir: BP_REL,
    roundFile,
  });
  assert.equal(result.ok, false);
  assert.equal(result.reason, 'review-input-invalid');
  assert.deepEqual(fs.readFileSync(reviewPath), before);
});

test('open must_fix with --status accepted is review-ledger-invalid', () => {
  const { repo, reviewPath } = makeBlueprintRepo();
  const before = fs.readFileSync(reviewPath);
  const finding = {
    ...EXAMPLE_FINDING,
    status: 'deferred',
    note: 'later',
    actionability: 'must_fix',
  };
  const roundFile = writeJson(repo, 'round.json', roundPayload(EXAMPLE_ROUND, [finding]));
  const { recordReview } = require('../scripts/lib/review-record');
  const result = recordReview({
    repoRoot: repo,
    blueprintDir: BP_REL,
    roundFile,
    status: 'accepted',
  });
  assert.equal(result.ok, false);
  assert.equal(result.reason, 'review-ledger-invalid');
  assert.ok(Array.isArray(result.cause));
  assert.ok(result.cause.some((m) => String(m).includes('review accepted with open must_fix')));
  assert.deepEqual(fs.readFileSync(reviewPath), before);
});

test('--task is not allowed on blueprint review_scope', () => {
  const { repo, reviewPath } = makeBlueprintRepo();
  const before = fs.readFileSync(reviewPath);
  const roundFile = writeJson(repo, 'round.json', roundPayload(EXAMPLE_ROUND, [EXAMPLE_FINDING]));
  const { recordReview } = require('../scripts/lib/review-record');
  const result = recordReview({
    repoRoot: repo,
    blueprintDir: BP_REL,
    task: '001',
    roundFile,
  });
  assert.equal(result.ok, false);
  assert.equal(result.reason, 'review-task-not-allowed');
  assert.deepEqual(fs.readFileSync(reviewPath), before);
});

test('omitting --task without review_scope is review-task-required', () => {
  const { repo, reviewPath } = makeBlueprintRepo();
  const indexPath = path.join(repo, BP_REL, 'index.md');
  const parsed = parseFrontmatter(fs.readFileSync(indexPath, 'utf8'));
  delete parsed.data.bouncer.review_scope;
  fs.writeFileSync(indexPath, renderDoc(parsed.data, parsed.body));
  const before = fs.readFileSync(reviewPath);
  const roundFile = writeJson(repo, 'round.json', roundPayload(EXAMPLE_ROUND, [EXAMPLE_FINDING]));
  const { recordReview } = require('../scripts/lib/review-record');
  const result = recordReview({
    repoRoot: repo,
    blueprintDir: BP_REL,
    roundFile,
  });
  assert.equal(result.ok, false);
  assert.equal(result.reason, 'review-task-required');
  assert.deepEqual(fs.readFileSync(reviewPath), before);
});

test('missing review.md is review-target-missing', () => {
  const { repo, reviewPath } = makeBlueprintRepo();
  fs.unlinkSync(reviewPath);
  const roundFile = writeJson(repo, 'round.json', roundPayload(EXAMPLE_ROUND, [EXAMPLE_FINDING]));
  const { recordReview } = require('../scripts/lib/review-record');
  const result = recordReview({
    repoRoot: repo,
    blueprintDir: BP_REL,
    roundFile,
  });
  assert.equal(result.ok, false);
  assert.equal(result.reason, 'review-target-missing');
  assert.equal(fs.existsSync(reviewPath), false);
});

test('discovery then delta then critical_recovery without --status is ok', () => {
  const { repo, reviewPath } = makeBlueprintRepo();
  const { recordReview } = require('../scripts/lib/review-record');
  const modes = ['discovery', 'delta', 'critical_recovery'];
  for (let i = 0; i < modes.length; i += 1) {
    const round = i + 1;
    const finding = { ...EXAMPLE_FINDING, last_seen_round: round };
    const payload = roundPayload({
      round,
      mode: modes[i],
      previous_finding_ids: round === 1 ? [] : ['F1'],
      new: round === 1 ? 1 : 0,
    }, [finding]);
    const roundFile = writeJson(repo, `round-${round}.json`, payload);
    const result = recordReview({
      repoRoot: repo,
      blueprintDir: BP_REL,
      roundFile,
    });
    assert.equal(result.ok, true, result.reason);
    assert.equal(result.round, round);
  }
  const { data } = parseFrontmatter(fs.readFileSync(reviewPath, 'utf8'));
  assert.deepEqual(data.bouncer.review.rounds.map((r) => r.mode), modes);
  assert.equal(data.bouncer.status, 'pending');
});

test('in-progress ledger with --status accepted is review-ledger-invalid', () => {
  const { repo, reviewPath } = makeBlueprintRepo();
  const { recordReview } = require('../scripts/lib/review-record');
  const prefixes = ['discovery', 'delta'];
  for (let i = 0; i < prefixes.length; i += 1) {
    const round = i + 1;
    const roundFile = writeJson(repo, `round-${round}.json`, roundPayload({
      round,
      mode: prefixes[i],
      previous_finding_ids: round === 1 ? [] : ['F1'],
      new: round === 1 ? 1 : 0,
    }, [{ ...EXAMPLE_FINDING, last_seen_round: round }]));
    const result = recordReview({
      repoRoot: repo,
      blueprintDir: BP_REL,
      roundFile,
    });
    assert.equal(result.ok, true, result.reason);
  }
  const before = fs.readFileSync(reviewPath);
  const roundFile = writeJson(repo, 'round-3.json', roundPayload({
    round: 3,
    mode: 'critical_recovery',
    previous_finding_ids: ['F1'],
    new: 0,
  }, [{ ...EXAMPLE_FINDING, last_seen_round: 3 }]));
  const result = recordReview({
    repoRoot: repo,
    blueprintDir: BP_REL,
    roundFile,
    status: 'accepted',
  });
  assert.equal(result.ok, false);
  assert.equal(result.reason, 'review-ledger-invalid');
  assert.deepEqual(fs.readFileSync(reviewPath), before);
});

test('CLI review record writes JSON on success', () => {
  const { repo } = makeBlueprintRepo();
  const roundFile = writeJson(repo, 'round.json', roundPayload(EXAMPLE_ROUND, [EXAMPLE_FINDING]));
  const r = recordCli(repo, { round: roundFile, status: 'addressed' });
  assert.equal(r.code, 0);
  const parsed = JSON.parse(r.out);
  assert.equal(parsed.ok, true);
  assert.equal(parsed.round, 1);
  assert.equal(parsed.status, 'addressed');
  assert.equal(parsed.findings, 1);
});

test('review record --help example round records on a fresh blueprint', () => {
  const help = capture(['review', 'record', '--help']);
  const fenced = help.out.match(/```json\n([\s\S]*?)\n```/);
  assert.ok(fenced, 'help must wrap the example in one ```json fence');
  const example = JSON.parse(fenced[1]);
  const { repo } = makeBlueprintRepo();
  const roundFile = writeJson(repo, 'help-round.json', example);
  const r = recordCli(repo, { round: roundFile });
  assert.equal(r.code, 0, r.err + r.out);
});
