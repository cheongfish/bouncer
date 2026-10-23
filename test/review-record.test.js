'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { execFileSync } = require('node:child_process');

const { runCli } = require('../packages/cli/dist/cli');
const { scaffoldEpic, scaffoldBlueprint } = require('../packages/cli/dist/scaffold');
const { parseFrontmatter } = require('../packages/cli/dist/frontmatter');
const { renderDoc } = require('../packages/cli/dist/render');
const { validateBlueprint } = require('../packages/cli/dist/validate');
const { captureReviewSnapshot } = require('../packages/cli/dist/review-snapshot');

const TS = '2026-07-01T00:00:00+09:00';
const BP_REL = '.bouncer/context/epics/001-auth/blueprints/001-login';
const SHA_RE = /^[0-9a-f]{64}$/;

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

// target·perspectives는 fixture가 실제 SHA·snapshot id로 채운다(fx.round).
const EXAMPLE_ROUND = {
  round: 1,
  mode: 'discovery',
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

function gitEnv() {
  const env = { ...process.env };
  for (const key of ['GIT_DIR', 'GIT_WORK_TREE', 'GIT_INDEX_FILE', 'GIT_OBJECT_DIRECTORY']) delete env[key];
  return env;
}

function git(cwd, args) {
  return execFileSync('git', args, { cwd, encoding: 'utf8', env: gitEnv() }).trim();
}

/**
 * 실제 Git 저장소 위의 blueprint 픽스처. scaffold를 baseline으로 커밋한 뒤 소스 파일 하나를
 * untracked로 두고 그 상태를 snapshot으로 동결한다. 라운드 입력 JSON은 저장소 밖에 쓴다 —
 * 저장소 안에 두면 파일 자체가 작업 트리 변경이 되어 stale 판정을 흔든다.
 *
 * @param {{ taskMode?: boolean, contract?: string }} [opts] - taskMode면 review_scope 없이 task 001 리뷰 대상을 둔다.
 *   contract는 blueprint index의 review_contract 값('brief'·그 밖의 값). 생략하면 표식이 없는 legacy blueprint다
 * @returns {object} repo·base·head·snapshotId 등과 round/payload/freeze 헬퍼
 */
function makeFixture({ taskMode = false, contract } = {}) {
  const repo = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), 'bouncer-review-record-')));
  git(repo, ['init', '-q', '-b', 'main']);
  git(repo, ['config', 'user.email', 'test@example.com']);
  git(repo, ['config', 'user.name', 'test']);
  scaffoldEpic({
    repoRoot: repo, epicId: '001', name: 'auth', timestamp: TS,
    description: 'Auth epic description',
  });
  scaffoldBlueprint({
    repoRoot: repo, epicDir: '.bouncer/context/epics/001-auth',
    blueprintId: '001', name: 'login', timestamp: TS,
  });
  // scaffold는 새 full blueprint에 review_contract: brief를 쓴다. 기존 테스트는 표식 없는
  // 계약을 검증하므로 기본은 키를 지우고, contract를 준 테스트만 표식을 둔다.
  const indexFile = path.join(repo, BP_REL, 'index.md');
  const indexDoc = parseFrontmatter(fs.readFileSync(indexFile, 'utf8'));
  if (contract === undefined) delete indexDoc.data.bouncer.review_contract;
  else indexDoc.data.bouncer.review_contract = contract;
  fs.writeFileSync(indexFile, renderDoc(indexDoc.data, indexDoc.body));
  const rootReview = path.join(repo, BP_REL, 'review.md');
  let reviewPath = rootReview;
  if (taskMode) {
    const indexPath = path.join(repo, BP_REL, 'index.md');
    const parsed = parseFrontmatter(fs.readFileSync(indexPath, 'utf8'));
    delete parsed.data.bouncer.review_scope;
    fs.writeFileSync(indexPath, renderDoc(parsed.data, parsed.body));
    // 루트 review.md를 복사해 task 리뷰 대상 파일로 쓴다.
    reviewPath = path.join(repo, BP_REL, 'tasks', '001', 'review.md');
    fs.mkdirSync(path.dirname(reviewPath), { recursive: true });
    fs.copyFileSync(rootReview, reviewPath);
  }
  git(repo, ['add', '-A']);
  git(repo, ['commit', '-qm', 'baseline']);
  const base = git(repo, ['rev-parse', 'HEAD']);
  fs.mkdirSync(path.join(repo, 'src'));
  fs.writeFileSync(path.join(repo, 'src', 'app.js'), 'one\n');
  const taskId = taskMode ? '001' : null;
  const fx = {
    repo, base, taskId, blueprintDir: BP_REL, reviewPath, taskMode,
    head: git(repo, ['rev-parse', 'HEAD']),
    roundsDir: `${repo}-rounds`,
  };
  /** 현재 작업 트리를 (선택한 범위로) 동결하고 id를 돌려준다. */
  fx.freeze = (scopeTask = taskId) => {
    const r = captureReviewSnapshot({
      repoRoot: repo, blueprintDir: BP_REL, taskId: scopeTask, base, head: git(repo, ['rev-parse', 'HEAD']),
    });
    assert.equal(r.ok, true, r.reason);
    return r.snapshot_id;
  };
  fx.snapshotId = fx.freeze();
  fx.round = (overrides = {}) => {
    const target = { base, head: fx.head, snapshot_id: fx.snapshotId, ...(overrides.target || {}) };
    return {
      ...EXAMPLE_ROUND,
      perspectives: [{ name: 'combined', target_head: target.head }],
      ...overrides,
      target,
    };
  };
  fx.payload = (round, findings = [EXAMPLE_FINDING]) => ({ round: fx.round(round), findings });
  fx.write = (name, value) => {
    fs.mkdirSync(fx.roundsDir, { recursive: true });
    const file = path.join(fx.roundsDir, name);
    fs.writeFileSync(file, `${JSON.stringify(value)}\n`);
    return file;
  };
  fx.record = (value, extra = {}) => {
    const { recordReview } = require('../packages/cli/dist/review-record');
    return recordReview({
      repoRoot: repo,
      blueprintDir: BP_REL,
      task: taskId,
      roundFile: typeof value === 'string' ? value : fx.write(`round-${Math.random()}.json`, value),
      status: extra.status,
    });
  };
  return fx;
}

function recordCli(fx, extra = {}) {
  const argv = ['review', 'record', '--repo', fx.repo, '--blueprint', BP_REL, '--round', extra.round];
  if (extra.task) argv.push('--task', extra.task);
  if (extra.status) argv.push('--status', extra.status);
  return capture(argv);
}

/** 거절은 기존 bytes를 그대로 두고 같은 디렉터리에 임시 파일을 남기지 않는다. */
function assertRejectedUntouched(fx, before, result, reason) {
  assert.equal(result.ok, false, `expected ${reason}`);
  assert.equal(result.reason, reason);
  assert.ok(result.cause);
  assert.ok(result.next);
  assert.deepEqual(fs.readFileSync(fx.reviewPath), before);
  const leftovers = fs.readdirSync(path.dirname(fx.reviewPath)).filter((n) => n.endsWith('.tmp'));
  assert.deepEqual(leftovers, []);
}

test('review-record module → is loadable', () => {
  const { recordReview } = require('../packages/cli/dist/review-record');
  assert.equal(typeof recordReview, 'function');
});

test('discovery round with --status addressed → records fingerprint and passes G21 format', () => {
  const fx = makeFixture();
  const result = fx.record(fx.payload(), { status: 'addressed' });
  assert.equal(result.ok, true, result.reason);
  assert.equal(result.round, 1);
  assert.equal(result.status, 'addressed');
  assert.equal(result.findings, 1);
  const { data } = parseFrontmatter(fs.readFileSync(fx.reviewPath, 'utf8'));
  assert.equal(data.bouncer.review.rounds[0].mode, 'discovery');
  assert.equal(data.bouncer.review.rounds[0].target.snapshot_id, fx.snapshotId);
  assert.equal(
    data.bouncer.review.findings[0].fingerprint,
    'correctness:tasks/001 interface:scripts/lib/x.js#f',
  );
  const validated = validateBlueprint({
    repoRoot: fx.repo,
    blueprintDir: BP_REL,
    gate: 'finalize',
  });
  const g21 = (validated.failures || []).filter((f) => f.code === 'G21');
  assert.ok(
    !g21.some((f) => String(f.message).startsWith('review ')),
    `G21 format failures: ${JSON.stringify(g21)}`,
  );
});

test('round number 3 → is out of sequence and leaves bytes unchanged', () => {
  const fx = makeFixture();
  const before = fs.readFileSync(fx.reviewPath);
  const result = fx.record(fx.payload({ round: 3 }));
  assertRejectedUntouched(fx, before, result, 'review-round-out-of-sequence');
});

test('findings object → is review-input-invalid and leaves bytes unchanged', () => {
  const fx = makeFixture();
  const before = fs.readFileSync(fx.reviewPath);
  const result = fx.record({ round: fx.round(), findings: {} });
  assertRejectedUntouched(fx, before, result, 'review-input-invalid');
});

test('blueprint scope deferred must_fix with note and --status accepted → records accepted', () => {
  const fx = makeFixture();
  const finding = { ...EXAMPLE_FINDING, status: 'deferred', note: 'later', actionability: 'must_fix' };
  const result = fx.record(fx.payload({}, [finding]), { status: 'accepted' });
  assert.equal(result.ok, true, JSON.stringify(result));
  const { data } = parseFrontmatter(fs.readFileSync(fx.reviewPath, 'utf8'));
  assert.equal(data.bouncer.status, 'accepted');
  assert.equal(data.bouncer.review.findings[0].status, 'deferred');
});

test('blueprint scope deferred must_fix without note and --status accepted → is review-ledger-invalid', () => {
  const fx = makeFixture();
  const before = fs.readFileSync(fx.reviewPath);
  const finding = { ...EXAMPLE_FINDING, status: 'deferred', actionability: 'must_fix' };
  const result = fx.record(fx.payload({}, [finding]), { status: 'accepted' });
  assertRejectedUntouched(fx, before, result, 'review-ledger-invalid');
  assert.ok(result.cause.some((m) => String(m).includes('deferred without note')));
});

test('blueprint scope open must_fix and --status accepted → is review-ledger-invalid', () => {
  const fx = makeFixture();
  const before = fs.readFileSync(fx.reviewPath);
  const finding = { ...EXAMPLE_FINDING, status: 'open', actionability: 'must_fix' };
  const result = fx.record(fx.payload({}, [finding]), { status: 'accepted' });
  assertRejectedUntouched(fx, before, result, 'review-ledger-invalid');
});

test('task scope deferred must_fix with note and --status accepted → is review-ledger-invalid', () => {
  const fx = makeFixture({ taskMode: true });
  const before = fs.readFileSync(fx.reviewPath);
  const finding = { ...EXAMPLE_FINDING, status: 'deferred', note: 'later', actionability: 'must_fix' };
  const result = fx.record(fx.payload({}, [finding]), { status: 'accepted' });
  assertRejectedUntouched(fx, before, result, 'review-ledger-invalid');
  assert.ok(result.cause.some((m) => String(m).includes('review accepted with open must_fix')));
});

/** open 상태 finding 여러 개를 가진 blueprint 최종 리뷰를 requested로 기록해 둔다. */
function recordOpenFindings(fx, ids) {
  const findings = ids.map((id) => ({
    ...EXAMPLE_FINDING, id, status: 'open', symbol: `s${id}`,
  }));
  const result = fx.record(fx.payload({}, findings), { status: 'requested' });
  assert.equal(result.ok, true, JSON.stringify(result));
}

function acceptRiskCli(fx, extra = {}) {
  const argv = ['review', 'accept-risk', '--repo', fx.repo, '--blueprint', BP_REL];
  argv.push('--finding', extra.finding || 'F1');
  argv.push('--note', extra.note === undefined ? 'user accepted' : extra.note);
  if (extra.yes !== false) argv.push('--yes');
  const r = capture(argv);
  return { code: r.code, result: JSON.parse(r.out) };
}

test('accept-risk on the only open must_fix → accepts the document without adding a round', () => {
  const fx = makeFixture();
  recordOpenFindings(fx, ['F1']);
  const before = parseFrontmatter(fs.readFileSync(fx.reviewPath, 'utf8')).data.bouncer.review;
  const { code, result } = acceptRiskCli(fx);
  assert.equal(code, 0, JSON.stringify(result));
  assert.equal(result.ok, true);
  assert.equal(result.finding, 'F1');
  assert.equal(result.status, 'accepted');
  assert.equal(result.open_remaining, 0);
  const { data } = parseFrontmatter(fs.readFileSync(fx.reviewPath, 'utf8'));
  assert.equal(data.bouncer.status, 'accepted');
  const finding = data.bouncer.review.findings[0];
  assert.equal(finding.status, 'accepted');
  assert.equal(finding.accepted_risk, true);
  assert.equal(finding.note, 'user accepted');
  assert.deepEqual(data.bouncer.review.rounds, before.rounds);
});

test('accept-risk on one of two open findings → keeps the document requested', () => {
  const fx = makeFixture();
  recordOpenFindings(fx, ['F1', 'F2']);
  const before = parseFrontmatter(fs.readFileSync(fx.reviewPath, 'utf8')).data.bouncer.review;
  const { code, result } = acceptRiskCli(fx);
  assert.equal(code, 0, JSON.stringify(result));
  assert.equal(result.status, 'requested');
  assert.equal(result.open_remaining, 1);
  const { data } = parseFrontmatter(fs.readFileSync(fx.reviewPath, 'utf8'));
  assert.equal(data.bouncer.status, 'requested');
  assert.deepEqual(data.bouncer.review.findings[1], before.findings[1]);
  assert.deepEqual(data.bouncer.review.rounds, before.rounds);
});

test('accept-risk without --yes → is review-accept-risk-confirmation-required and leaves bytes unchanged', () => {
  const fx = makeFixture();
  recordOpenFindings(fx, ['F1']);
  const before = fs.readFileSync(fx.reviewPath);
  const { code, result } = acceptRiskCli(fx, { yes: false });
  assert.equal(code, 1);
  assertRejectedUntouched(fx, before, result, 'review-accept-risk-confirmation-required');
});

test('accept-risk on task review_scope → is review-accept-risk-task-scope', () => {
  const fx = makeFixture({ taskMode: true });
  const before = fs.readFileSync(fx.reviewPath);
  const { code, result } = acceptRiskCli(fx);
  assert.equal(code, 1);
  assertRejectedUntouched(fx, before, result, 'review-accept-risk-task-scope');
});

test('accept-risk with review.md missing → is review-target-missing', () => {
  const fx = makeFixture();
  recordOpenFindings(fx, ['F1']);
  fs.unlinkSync(fx.reviewPath);
  const { code, result } = acceptRiskCli(fx);
  assert.equal(code, 1);
  assert.equal(result.ok, false);
  assert.equal(result.reason, 'review-target-missing');
});

test('accept-risk with unknown finding id → is review-finding-missing', () => {
  const fx = makeFixture();
  recordOpenFindings(fx, ['F1']);
  const before = fs.readFileSync(fx.reviewPath);
  const { code, result } = acceptRiskCli(fx, { finding: 'F9' });
  assert.equal(code, 1);
  assertRejectedUntouched(fx, before, result, 'review-finding-missing');
});

test('accept-risk on a deferred finding → is review-finding-not-open', () => {
  const fx = makeFixture();
  const finding = { ...EXAMPLE_FINDING, status: 'deferred', note: 'later' };
  assert.equal(fx.record(fx.payload({}, [finding]), { status: 'accepted' }).ok, true);
  const before = fs.readFileSync(fx.reviewPath);
  const { code, result } = acceptRiskCli(fx);
  assert.equal(code, 1);
  assertRejectedUntouched(fx, before, result, 'review-finding-not-open');
});

test('accept-risk with whitespace-only note → is review-note-required', () => {
  const fx = makeFixture();
  recordOpenFindings(fx, ['F1']);
  const before = fs.readFileSync(fx.reviewPath);
  const { code, result } = acceptRiskCli(fx, { note: '   ' });
  assert.equal(code, 1);
  assertRejectedUntouched(fx, before, result, 'review-note-required');
});

test('accept-risk when the resulting ledger fails G21 → is review-ledger-invalid', () => {
  const fx = makeFixture();
  recordOpenFindings(fx, ['F1']);
  // 저장된 finding의 fingerprint를 깨 사전 검증이 실패하게 한다.
  const parsed = parseFrontmatter(fs.readFileSync(fx.reviewPath, 'utf8'));
  parsed.data.bouncer.review.findings[0].fingerprint = 'bogus';
  fs.writeFileSync(fx.reviewPath, renderDoc(parsed.data, parsed.body));
  const before = fs.readFileSync(fx.reviewPath);
  const { code, result } = acceptRiskCli(fx);
  assert.equal(code, 1);
  assertRejectedUntouched(fx, before, result, 'review-ledger-invalid');
});

test('--task on blueprint review_scope → is not allowed', () => {
  const fx = makeFixture();
  const before = fs.readFileSync(fx.reviewPath);
  const { recordReview } = require('../packages/cli/dist/review-record');
  const result = recordReview({
    repoRoot: fx.repo,
    blueprintDir: BP_REL,
    task: '001',
    roundFile: fx.write('r.json', fx.payload()),
  });
  assertRejectedUntouched(fx, before, result, 'review-task-not-allowed');
});

test('omitting --task without review_scope → is review-task-required', () => {
  const fx = makeFixture();
  const indexPath = path.join(fx.repo, BP_REL, 'index.md');
  const parsed = parseFrontmatter(fs.readFileSync(indexPath, 'utf8'));
  delete parsed.data.bouncer.review_scope;
  fs.writeFileSync(indexPath, renderDoc(parsed.data, parsed.body));
  const before = fs.readFileSync(fx.reviewPath);
  const result = fx.record(fx.payload());
  assertRejectedUntouched(fx, before, result, 'review-task-required');
});

test('missing review.md → is review-target-missing', () => {
  const fx = makeFixture();
  fs.unlinkSync(fx.reviewPath);
  const result = fx.record(fx.payload());
  assert.equal(result.ok, false);
  assert.equal(result.reason, 'review-target-missing');
  assert.equal(fs.existsSync(fx.reviewPath), false);
});

test('discovery then delta then critical_recovery without --status → is ok', () => {
  const fx = makeFixture({ taskMode: true });
  const modes = ['discovery', 'delta', 'critical_recovery'];
  for (let i = 0; i < modes.length; i += 1) {
    const round = i + 1;
    const finding = { ...EXAMPLE_FINDING, last_seen_round: round };
    const result = fx.record(fx.payload({
      round,
      mode: modes[i],
      previous_finding_ids: round === 1 ? [] : ['F1'],
      new: round === 1 ? 1 : 0,
    }, [finding]));
    assert.equal(result.ok, true, result.reason);
    assert.equal(result.round, round);
  }
  const { data } = parseFrontmatter(fs.readFileSync(fx.reviewPath, 'utf8'));
  assert.deepEqual(data.bouncer.review.rounds.map((r) => r.mode), modes);
  assert.equal(data.bouncer.status, 'pending');
});

test('in-progress ledger with --status accepted → is review-ledger-invalid', () => {
  const fx = makeFixture({ taskMode: true });
  const prefixes = ['discovery', 'delta'];
  for (let i = 0; i < prefixes.length; i += 1) {
    const round = i + 1;
    const result = fx.record(fx.payload({
      round,
      mode: prefixes[i],
      previous_finding_ids: round === 1 ? [] : ['F1'],
      new: round === 1 ? 1 : 0,
    }, [{ ...EXAMPLE_FINDING, last_seen_round: round }]));
    assert.equal(result.ok, true, result.reason);
  }
  const before = fs.readFileSync(fx.reviewPath);
  const result = fx.record(fx.payload({
    round: 3,
    mode: 'critical_recovery',
    previous_finding_ids: ['F1'],
    new: 0,
  }, [{ ...EXAMPLE_FINDING, last_seen_round: 3 }]), { status: 'accepted' });
  assertRejectedUntouched(fx, before, result, 'review-ledger-invalid');
});

test('blueprint round contract → max delta count equals REPAIR_WAVE_LIMIT', () => {
  const { BLUEPRINT_ROUND_CONTRACT, REPAIR_WAVE_LIMIT } = require('../packages/cli/dist/validate-sections');
  const maxDelta = Math.max(...BLUEPRINT_ROUND_CONTRACT.sequences.map(
    (s) => s.split(',').filter((m) => m === 'delta').length,
  ));
  assert.strictEqual(maxDelta, REPAIR_WAVE_LIMIT);
});

test('blueprint scope new delta round → is final-review-single-round and leaves bytes unchanged', () => {
  const fx = makeFixture();
  const discovery = fx.record(fx.payload({}, [{ ...EXAMPLE_FINDING, status: 'open' }]), { status: 'requested' });
  assert.equal(discovery.ok, true, discovery.reason);
  const before = fs.readFileSync(fx.reviewPath);
  const delta = fx.payload({
    round: 2, mode: 'delta', previous_finding_ids: ['F1'], new: 0, resolved: 1,
  }, [{ ...EXAMPLE_FINDING, status: 'resolved', last_seen_round: 2 }]);
  const result = fx.record(delta, { status: 'accepted' });
  assertRejectedUntouched(fx, before, result, 'final-review-single-round');
});

test('blueprint scope stored discovery,delta,delta history → G21 still reads it', () => {
  const fx = makeFixture();
  const parsed = parseFrontmatter(fs.readFileSync(fx.reviewPath, 'utf8'));
  const stored = (round, mode) => ({
    round,
    mode,
    target: { base: 'aaa', head: 'bbb' },
    perspectives: [{ name: 'combined', target_head: 'bbb' }],
    previous_finding_ids: round === 1 ? [] : ['F1'],
    new: round === 1 ? 1 : 0,
    resolved: 0,
    regressed: 0,
  });
  parsed.data.bouncer.status = 'accepted';
  parsed.data.bouncer.review = {
    rounds: [stored(1, 'discovery'), stored(2, 'delta'), stored(3, 'delta')],
    findings: [{
      ...EXAMPLE_FINDING,
      status: 'resolved',
      last_seen_round: 3,
      fingerprint: 'correctness:tasks/001 interface:scripts/lib/x.js#f',
    }],
  };
  fs.writeFileSync(fx.reviewPath, renderDoc(parsed.data, parsed.body));
  const g21 = (validateBlueprint({ repoRoot: fx.repo, blueprintDir: BP_REL, gate: 'finalize' }).failures || [])
    .filter((f) => f.code === 'G21' && String(f.message).startsWith('review '));
  assert.deepEqual(g21, []);
});

test('CLI review record on success → writes JSON', () => {
  const fx = makeFixture();
  const r = recordCli(fx, { round: fx.write('round.json', fx.payload()), status: 'addressed' });
  assert.equal(r.code, 0, r.err + r.out);
  const parsed = JSON.parse(r.out);
  assert.equal(parsed.ok, true);
  assert.equal(parsed.round, 1);
  assert.equal(parsed.status, 'addressed');
  assert.equal(parsed.findings, 1);
});

/**
 * help·카드 예시의 placeholder(aaa/bbb/ccc, <snapshot_id>)를 fixture가 만든 실제 SHA·id로
 * 바꾼다. 예시가 실행 가능한 입력 모양을 그대로 보여주는지 보려고 구조는 건드리지 않는다.
 */
function bindExample(fx, example) {
  const text = JSON.stringify(example)
    .replaceAll('"aaa"', JSON.stringify(fx.base))
    .replaceAll('"bbb"', JSON.stringify(fx.head))
    .replaceAll('"ccc"', JSON.stringify(fx.head))
    .replaceAll('"<snapshot_id>"', JSON.stringify(fx.snapshotId));
  return JSON.parse(text);
}

test('review record --help example round on a fresh blueprint → records it', () => {
  const help = capture(['review', 'record', '--help']);
  const fenced = help.out.match(/```json\n([\s\S]*?)\n```/);
  assert.ok(fenced, 'help must wrap the example in one ```json fence');
  const example = JSON.parse(fenced[1]);
  const hashes = example.round.task_brief_hashes;
  const bundles = example.round.intent_bundles;
  assert.equal(example.round.target.task_brief_hashes, undefined);
  assert.equal(example.round.target.intent_bundles, undefined);
  assert.equal(typeof example.round.target.snapshot_id, 'string');
  assert.equal(typeof hashes, 'object');
  assert.ok(hashes && !Array.isArray(hashes));
  assert.equal(typeof bundles, 'object');
  assert.ok(bundles && !Array.isArray(bundles));
  const taskIds = Object.keys(hashes);
  assert.ok(taskIds.some((id) => /^TASKS-\d+$/.test(id)));
  for (const id of taskIds) {
    assert.equal(typeof hashes[id], 'string');
    assert.equal(typeof bundles[id], 'object');
    assert.equal(typeof bundles[id].id, 'string');
    assert.equal(typeof bundles[id].revision, 'number');
  }
  const fx = makeFixture();
  const r = recordCli(fx, { round: fx.write('help-round.json', bindExample(fx, example)) });
  assert.equal(r.code, 0, r.err + r.out);
  const { data } = parseFrontmatter(fs.readFileSync(fx.reviewPath, 'utf8'));
  const recorded = data.bouncer.review.rounds[0];
  assert.deepEqual(recorded.task_brief_hashes, hashes);
  assert.deepEqual(recorded.intent_bundles, bundles);
  assert.equal(recorded.target.snapshot_id, fx.snapshotId);
});

// ---- finding status `open`과 카드 repair wave 예시 ----

const CARD_DIR = path.join(__dirname, '..', 'references', 'coordinator-cards');

for (const [cardName, taskMode] of [['review.md', true]]) {
  test(`${cardName} card repair wave fences bound to a real snapshot → record discovery then delta`, () => {
    const card = fs.readFileSync(path.join(CARD_DIR, cardName), 'utf8');
    const fences = [...card.matchAll(/```json\n([\s\S]*?)\n```/g)].map((m) => JSON.parse(m[1]));
    assert.equal(fences.length, 2);
    for (const fence of fences) assert.equal(typeof fence.round.target.snapshot_id, 'string');
    const fx = makeFixture({ taskMode });
    const task = taskMode ? '001' : undefined;
    const first = recordCli(fx, { round: fx.write('r1.json', bindExample(fx, fences[0])), status: 'requested', task });
    assert.equal(first.code, 0, first.err + first.out);
    const second = recordCli(fx, { round: fx.write('r2.json', bindExample(fx, fences[1])), status: 'accepted', task });
    assert.equal(second.code, 0, second.err + second.out);
    const { data } = parseFrontmatter(fs.readFileSync(fx.reviewPath, 'utf8'));
    assert.equal(data.bouncer.status, 'accepted');
    assert.equal(data.bouncer.review.findings.find((f) => f.id === 'F1').status, 'resolved');
  });

  test(`${cardName} card → has a Finding status section`, () => {
    const card = fs.readFileSync(path.join(CARD_DIR, cardName), 'utf8');
    const m = card.match(/## Finding status\n([\s\S]*?)(?=\n## |$)/);
    assert.ok(m, 'missing ## Finding status');
    for (const word of ['open', 'resolved', 'accepted', 'deferred', '--status', 'requested', 'addressed']) {
      assert.ok(m[1].includes(word), `section lacks ${word}`);
    }
  });
}

test('open must_fix with --status requested or accepted → requested records, accepted is rejected untouched', () => {
  const fx = makeFixture();
  const finding = { ...EXAMPLE_FINDING, status: 'open' };
  const roundFile = fx.write('round.json', fx.payload({}, [finding]));
  const before = fs.readFileSync(fx.reviewPath);
  const rejected = recordCli(fx, { round: roundFile, status: 'accepted' });
  assert.notEqual(rejected.code, 0);
  assert.match(rejected.out + rejected.err, /review-ledger-invalid/);
  assert.match(rejected.out + rejected.err, /open in accepted review/);
  assert.deepEqual(fs.readFileSync(fx.reviewPath), before);
  const ok = recordCli(fx, { round: roundFile, status: 'requested' });
  assert.equal(ok.code, 0, ok.err + ok.out);
  const { data } = parseFrontmatter(fs.readFileSync(fx.reviewPath, 'utf8'));
  assert.equal(data.bouncer.status, 'requested');
});

test('review record --help → lists open and shows an open example', () => {
  const help = capture(['review', 'record', '--help']);
  assert.match(help.out, /finding status: resolved\|accepted\|deferred\|open/);
  const example = JSON.parse(help.out.match(/```json\n([\s\S]*?)\n```/)[1]);
  assert.equal(example.findings[0].status, 'open');
});

test('final_review.md card fence bound to a real snapshot → records the discovery round accepted with a deferred must_fix', () => {
  const card = fs.readFileSync(path.join(CARD_DIR, 'final_review.md'), 'utf8');
  const fences = [...card.matchAll(/```json\n([\s\S]*?)\n```/g)].map((m) => JSON.parse(m[1]));
  assert.equal(fences.length, 1);
  assert.equal(fences[0].round.mode, 'discovery');
  const fx = makeFixture();
  const result = recordCli(fx, { round: fx.write('r1.json', bindExample(fx, fences[0])), status: 'accepted' });
  assert.equal(result.code, 0, result.err + result.out);
  const { data } = parseFrontmatter(fs.readFileSync(fx.reviewPath, 'utf8'));
  assert.equal(data.bouncer.status, 'accepted');
  assert.equal(data.bouncer.review.findings[0].status, 'deferred');
});

// ---- execute delta round: reviewer 하나 규칙 (perspective 수) ----

/** round 1 discovery를 기록한 뒤 round 2 delta payload 파일을 돌려준다. */
function recordDiscoveryThenDeltaFile(fx, deltaPerspectives) {
  const discovery = fx.record(fx.payload());
  assert.equal(discovery.ok, true, discovery.reason);
  const resolvedFinding = { ...EXAMPLE_FINDING, status: 'resolved', first_seen_round: 1, last_seen_round: 2 };
  return fx.write('round-2.json', fx.payload({
    round: 2,
    mode: 'delta',
    perspectives: deltaPerspectives,
    previous_finding_ids: ['F1'],
    new: 0,
    resolved: 1,
    regressed: 0,
  }, [resolvedFinding]));
}

test('관점 2개인 delta round 기록 → review-ledger-invalid', () => {
  const fx = makeFixture({ taskMode: true });
  const roundFile = recordDiscoveryThenDeltaFile(fx, [
    { name: 'spec_scope', target_head: fx.head },
    { name: 'security', target_head: fx.head },
  ]);
  const result = fx.record(roundFile);
  assert.strictEqual(result.reason, 'review-ledger-invalid');
  assert.ok(result.cause.includes('review round 2 delta perspectives invalid: 2'));
});

test('관점 1개인 delta round 기록 → ok', () => {
  const fx = makeFixture({ taskMode: true });
  const roundFile = recordDiscoveryThenDeltaFile(fx, [{ name: 'combined', target_head: fx.head }]);
  const result = fx.record(roundFile);
  assert.equal(result.ok, true, result.reason);
});

// ---- snapshot 바인딩: 새 라운드 입력은 실제 동결 상태에 묶여야 한다 ----

test('round without target.snapshot_id → is review-snapshot-required and leaves bytes unchanged', () => {
  const fx = makeFixture();
  const before = fs.readFileSync(fx.reviewPath);
  const payload = fx.payload();
  delete payload.round.target.snapshot_id;
  assertRejectedUntouched(fx, before, fx.record(payload), 'review-snapshot-required');
});

for (const [label, badId] of [
  ['uppercase hex', 'A'.repeat(64)],
  ['short hex', 'abc123'],
  ['path traversal', '../../../etc/passwd'],
  ['non-string', 12345],
  ['well-formed but never captured', 'f'.repeat(64)],
]) {
  test(`snapshot_id ${label} → is review-snapshot-invalid and leaves bytes unchanged`, () => {
    const fx = makeFixture();
    const before = fs.readFileSync(fx.reviewPath);
    const payload = fx.payload();
    payload.round.target.snapshot_id = badId;
    assertRejectedUntouched(fx, before, fx.record(payload), 'review-snapshot-invalid');
  });
}

test('snapshot artifact with corrupted bytes → is review-snapshot-invalid', () => {
  const fx = makeFixture();
  // artifact는 review-snapshots/<id>/snapshot.json에 저장된다.
  const artifact = path.join(fx.repo, '.bouncer', 'runtime', 'review-snapshots', fx.snapshotId, 'snapshot.json');
  assert.ok(fs.existsSync(artifact), 'fixture must have persisted the artifact');
  fs.writeFileSync(artifact, '{"broken":');
  const before = fs.readFileSync(fx.reviewPath);
  assertRejectedUntouched(fx, before, fx.record(fx.payload()), 'review-snapshot-invalid');
});

test('snapshot captured for another task scope → is review-snapshot-mismatch', () => {
  const fx = makeFixture();
  const otherScope = fx.freeze('002');
  const before = fs.readFileSync(fx.reviewPath);
  const payload = fx.payload();
  payload.round.target.snapshot_id = otherScope;
  assertRejectedUntouched(fx, before, fx.record(payload), 'review-snapshot-mismatch');
});

test('task review with a blueprint-scope snapshot → is review-snapshot-mismatch', () => {
  const fx = makeFixture({ taskMode: true });
  const blueprintScope = fx.freeze(null);
  const before = fs.readFileSync(fx.reviewPath);
  const payload = fx.payload();
  payload.round.target.snapshot_id = blueprintScope;
  assertRejectedUntouched(fx, before, fx.record(payload), 'review-snapshot-mismatch');
});

for (const key of ['base', 'head']) {
  test(`round target.${key} differing from the snapshot → is review-snapshot-mismatch`, () => {
    const fx = makeFixture();
    const before = fs.readFileSync(fx.reviewPath);
    const payload = fx.payload({ target: { [key]: 'e'.repeat(40) } });
    assertRejectedUntouched(fx, before, fx.record(payload), 'review-snapshot-mismatch');
  });
}

// 같은 HEAD에서 acceptance 직전에 일어날 수 있는 작업 트리 변경들.
const DRIFTS = [
  ['tracked file edited', (fx) => fs.writeFileSync(path.join(fx.repo, 'README'), 'edited\n')],
  ['untracked file added', (fx) => fs.writeFileSync(path.join(fx.repo, 'src', 'extra.js'), 'x\n')],
  ['reviewed file edited', (fx) => fs.writeFileSync(path.join(fx.repo, 'src', 'app.js'), 'two\n')],
  ['index changed only', (fx) => git(fx.repo, ['add', 'src/app.js'])],
];

for (const [label, drift] of DRIFTS) {
  test(`acceptance after ${label} at the same HEAD → is review-snapshot-stale and leaves bytes unchanged`, () => {
    const fx = makeFixture();
    drift(fx);
    const before = fs.readFileSync(fx.reviewPath);
    const result = fx.record(fx.payload(), { status: 'accepted' });
    assertRejectedUntouched(fx, before, result, 'review-snapshot-stale');
    assert.match(result.next, /review/);
  });
}

test('acceptance after HEAD moved → is review-snapshot-stale', () => {
  const fx = makeFixture();
  git(fx.repo, ['add', 'src/app.js']);
  git(fx.repo, ['commit', '-qm', 'move head']);
  const before = fs.readFileSync(fx.reviewPath);
  const result = fx.record(fx.payload(), { status: 'accepted' });
  assertRejectedUntouched(fx, before, result, 'review-snapshot-stale');
});

test('acceptance on an unchanged worktree → records accepted', () => {
  const fx = makeFixture();
  const result = fx.record(fx.payload(), { status: 'accepted' });
  assert.equal(result.ok, true, result.reason);
  assert.equal(result.status, 'accepted');
});

for (const status of ['requested', 'addressed']) {
  test(`--status ${status} with a stale snapshot → still records the bound round`, () => {
    const fx = makeFixture();
    fs.writeFileSync(path.join(fx.repo, 'src', 'app.js'), 'drift\n');
    const result = fx.record(fx.payload(), { status });
    assert.equal(result.ok, true, result.reason);
    assert.equal(result.status, status);
  });
}

test('inherited accepted status with a stale new round → is review-snapshot-stale', () => {
  const fx = makeFixture({ taskMode: true });
  assert.equal(fx.record(fx.payload(), { status: 'accepted' }).ok, true);
  fs.writeFileSync(path.join(fx.repo, 'src', 'app.js'), 'two\n');
  const before = fs.readFileSync(fx.reviewPath);
  const delta = fx.payload({
    round: 2, mode: 'delta', previous_finding_ids: ['F1'], new: 0, resolved: 1,
  }, [{ ...EXAMPLE_FINDING, last_seen_round: 2 }]);
  assertRejectedUntouched(fx, before, fx.record(delta), 'review-snapshot-stale');
});

test('delta acceptance on a fresh snapshot after a stale discovery snapshot → records accepted', () => {
  const fx = makeFixture({ taskMode: true });
  const discovery = fx.record(fx.payload({}, [{ ...EXAMPLE_FINDING, status: 'open' }]), { status: 'requested' });
  assert.equal(discovery.ok, true, discovery.reason);
  // 수정 후 새로 동결한 snapshot으로 delta를 닫는다. 앞 discovery snapshot은 이제 stale이다.
  fs.writeFileSync(path.join(fx.repo, 'src', 'app.js'), 'fixed\n');
  fx.snapshotId = fx.freeze();
  const delta = fx.payload({
    round: 2, mode: 'delta', previous_finding_ids: ['F1'], new: 0, resolved: 1,
  }, [{ ...EXAMPLE_FINDING, last_seen_round: 2 }]);
  const result = fx.record(delta, { status: 'accepted' });
  assert.equal(result.ok, true, result.reason);
  const { data } = parseFrontmatter(fs.readFileSync(fx.reviewPath, 'utf8'));
  assert.equal(data.bouncer.review.rounds.length, 2);
  assert.notEqual(data.bouncer.review.rounds[0].target.snapshot_id, data.bouncer.review.rounds[1].target.snapshot_id);
});

// ---- 기존 저장 기록 호환 ----

test('legacy stored round without snapshot_id → stays valid and accepts a bound new round', () => {
  const fx = makeFixture({ taskMode: true });
  const parsed = parseFrontmatter(fs.readFileSync(fx.reviewPath, 'utf8'));
  const legacy = {
    round: 1,
    mode: 'discovery',
    target: { base: 'aaa', head: 'bbb' },
    perspectives: [{ name: 'combined', target_head: 'bbb' }],
    previous_finding_ids: [],
    new: 1,
    resolved: 0,
    regressed: 0,
  };
  parsed.data.bouncer.review = { rounds: [legacy], findings: [{ ...EXAMPLE_FINDING, fingerprint: 'correctness:tasks/001 interface:scripts/lib/x.js#f' }] };
  fs.writeFileSync(fx.reviewPath, renderDoc(parsed.data, parsed.body));
  const g21Before = (validateBlueprint({ repoRoot: fx.repo, blueprintDir: BP_REL, gate: 'finalize' }).failures || [])
    .filter((f) => f.code === 'G21' && String(f.message).startsWith('review '));
  assert.deepEqual(g21Before, []);

  const result = fx.record(fx.payload({
    round: 2, mode: 'delta', previous_finding_ids: ['F1'], new: 0, resolved: 1,
  }, [{ ...EXAMPLE_FINDING, last_seen_round: 2 }]), { status: 'accepted' });
  assert.equal(result.ok, true, result.reason);
  const after = parseFrontmatter(fs.readFileSync(fx.reviewPath, 'utf8')).data.bouncer.review.rounds;
  assert.deepEqual(after[0], legacy);
  assert.match(after[1].target.snapshot_id, SHA_RE);
});

// 병합 후보 경고: 같은 file·symbol을 다른 category가 가리키는 finding 묶음을 알린다.
const SS_FINDING = {
  ...EXAMPLE_FINDING, id: 'SS-1', category: 'spec_scope', file: 'scripts/src/lib/a.ts', symbol: 'f',
};
const CT_FINDING = { ...SS_FINDING, id: 'CT-5', category: 'correctness_tests' };

test('같은 file·symbol에 category가 다른 finding 두 건 기록 → warnings에 병합 후보가 들어간다', () => {
  const fx = makeFixture();
  const result = fx.record(fx.payload({ new: 2 }, [SS_FINDING, CT_FINDING]), { status: 'addressed' });
  assert.equal(result.ok, true);
  assert.deepStrictEqual(result.warnings, [
    { code: 'finding-merge-candidate', file: 'scripts/src/lib/a.ts', symbol: 'f', ids: ['SS-1', 'CT-5'] },
  ]);
});

test('같은 file이어도 symbol이 다른 finding 기록 → warnings 키가 없다', () => {
  const fx = makeFixture();
  const result = fx.record(fx.payload({ new: 2 }, [SS_FINDING, { ...CT_FINDING, symbol: 'g' }]), { status: 'addressed' });
  assert.equal(result.ok, true);
  assert.equal('warnings' in result, false);
});

test('symbol이 비었거나 모양이 틀린 항목 → findingMergeCandidates가 건너뛰고 던지지 않는다', () => {
  const { findingMergeCandidates } = require('../packages/cli/dist/validate-sections');
  const blank = [{ ...SS_FINDING, symbol: ' ' }, { ...CT_FINDING, symbol: ' ' }, null, 'x', { id: 'Z', file: 3, symbol: 'f' }];
  assert.deepStrictEqual(findingMergeCandidates(blank), []);
  assert.deepStrictEqual(findingMergeCandidates('not-array'), []);
  const dotted = [SS_FINDING, { ...CT_FINDING, file: './scripts/src/lib/a.ts' }];
  assert.deepStrictEqual(findingMergeCandidates(dotted).map((c) => c.ids), [['SS-1', 'CT-5']]);
});

// finding id·fingerprint 자동 정규화. 기대 id는 정규 fingerprint 문자열의 sha256 앞 8hex로
// 요구사항에서 직접 계산한다(구현 반환값을 복사하지 않는다).
const { createHash } = require('node:crypto');
const CANONICAL_FP = 'correctness:tasks/001 interface:scripts/lib/x.js#f';
const AUTO_ID = `F-${createHash('sha256').update(CANONICAL_FP).digest('hex').slice(0, 8)}`;
const NO_ID_FINDING = (() => {
  const copy = { ...EXAMPLE_FINDING, fingerprint: 'wrong' };
  delete copy.id;
  return copy;
})();

test('id 없고 fingerprint가 틀린 finding 기록 → 성공하고 F-<8hex> 자동 id와 정규 fingerprint를 저장한다', () => {
  const fx = makeFixture();
  const result = fx.record(fx.payload({}, [NO_ID_FINDING]), { status: 'addressed' });
  assert.equal(result.ok, true, JSON.stringify(result));
  assert.deepStrictEqual(result.finding_ids, [AUTO_ID]);
  const stored = parseFrontmatter(fs.readFileSync(fx.reviewPath, 'utf8')).data.bouncer.review.findings;
  assert.equal(stored.length, 1);
  assert.equal(stored[0].id, AUTO_ID);
  assert.equal(stored[0].fingerprint, CANONICAL_FP);
});

test('표기만 다른 id 없는 finding을 다음 round에 기록 → round를 넘어 같은 자동 id로 교체된다', () => {
  const fx = makeFixture({ taskMode: true });
  assert.equal(fx.record(fx.payload({}, [{ ...NO_ID_FINDING, status: 'open' }]), { status: 'requested' }).ok, true);
  const variant = {
    ...NO_ID_FINDING, category: ' Correctness ', brief_clause: 'Tasks/001 Interface', file: './scripts/lib/x.js',
    last_seen_round: 2,
  };
  const result = fx.record(fx.payload({
    round: 2, mode: 'delta', previous_finding_ids: [AUTO_ID], new: 0, resolved: 1,
  }, [variant]), { status: 'addressed' });
  assert.equal(result.ok, true, JSON.stringify(result));
  assert.deepStrictEqual(result.finding_ids, [AUTO_ID]);
  assert.equal(result.findings, 1);
});

test('명시 id finding의 틀린 fingerprint → id는 보존하고 fingerprint만 덮어쓰며 finding_ids는 순서 유지·중복 제거된다', () => {
  const fx = makeFixture();
  const g = { ...EXAMPLE_FINDING, id: 'F2', symbol: 'g', fingerprint: 'wrong' };
  const result = fx.record(fx.payload({ new: 2 }, [g, { ...EXAMPLE_FINDING, fingerprint: 'wrong' }, g]), { status: 'addressed' });
  assert.equal(result.ok, true, JSON.stringify(result));
  assert.deepStrictEqual(result.finding_ids, ['F2', 'F1']);
  const stored = parseFrontmatter(fs.readFileSync(fx.reviewPath, 'utf8')).data.bouncer.review.findings;
  assert.deepStrictEqual(stored.map((f) => [f.id, f.fingerprint]), [
    ['F2', 'correctness:tasks/001 interface:scripts/lib/x.js#g'],
    ['F1', CANONICAL_FP],
  ]);
});

for (const [label, id] of [['null', null], ['빈 문자열', ''], ['공백', '  '], ['숫자', 3]]) {
  test(`명시 id가 ${label}인 finding 기록 → review-input-invalid로 거부하고 파일을 바꾸지 않는다`, () => {
    const fx = makeFixture();
    const before = fs.readFileSync(fx.reviewPath);
    const result = fx.record(fx.payload({}, [{ ...EXAMPLE_FINDING, id }]), { status: 'addressed' });
    assertRejectedUntouched(fx, before, result, 'review-input-invalid');
  });
}

test('다른 fingerprint의 명시 id가 자동 id와 충돌 → merge하지 않고 review-input-invalid로 거부한다', () => {
  const fx = makeFixture();
  const before = fs.readFileSync(fx.reviewPath);
  const squatter = { ...EXAMPLE_FINDING, id: AUTO_ID, symbol: 'g' };
  const result = fx.record(fx.payload({ new: 2 }, [squatter, NO_ID_FINDING]), { status: 'addressed' });
  assertRejectedUntouched(fx, before, result, 'review-input-invalid');
});

test('명시 id가 다른 같은 fingerprint 두 건 기록 → 기존 duplicate fingerprint 거절을 유지한다', () => {
  const fx = makeFixture();
  const before = fs.readFileSync(fx.reviewPath);
  const result = fx.record(fx.payload({ new: 2 }, [EXAMPLE_FINDING, { ...EXAMPLE_FINDING, id: 'F9' }]), { status: 'addressed' });
  assertRejectedUntouched(fx, before, result, 'review-ledger-invalid');
  assert.ok(result.cause.includes(`review duplicate fingerprint ${CANONICAL_FP}`));
});

// ---- review_contract: brief (표식 blueprint) ----

const BRIEF_CLAUSE_OK = ['tasks/001 Checklist', 'TASKS/002 Do not touch', 'tasks/003 Target behavior', 'Contract', 'contract 실패 모드'];
const BRIEF_CLAUSE_BAD = ['style', 'tasks/1 Checklist', 'tasks/001 Notes', 'contractual'];

function deltaPayload(fx, finding = { ...EXAMPLE_FINDING, status: 'resolved', last_seen_round: 2 }, round = 2) {
  return fx.payload({
    round, mode: 'delta', previous_finding_ids: ['F1'], new: 0, resolved: 1,
  }, [finding]);
}

test('brief blueprint discovery then delta → records discovery,delta and accepts', () => {
  const fx = makeFixture({ contract: 'brief' });
  assert.equal(fx.record(fx.payload({}, [{ ...EXAMPLE_FINDING, status: 'open' }]), { status: 'requested' }).ok, true);
  const result = fx.record(deltaPayload(fx), { status: 'accepted' });
  assert.equal(result.ok, true, JSON.stringify(result));
  const { data } = parseFrontmatter(fs.readFileSync(fx.reviewPath, 'utf8'));
  assert.deepEqual(data.bouncer.review.rounds.map((r) => r.mode), ['discovery', 'delta']);
  assert.equal(data.bouncer.status, 'accepted');
});

test('brief blueprint second delta after stored delta → is final-review-single-round and leaves bytes unchanged', () => {
  const fx = makeFixture({ contract: 'brief' });
  assert.equal(fx.record(fx.payload({}, [{ ...EXAMPLE_FINDING, status: 'open' }]), { status: 'requested' }).ok, true);
  const first = fx.record(deltaPayload(fx, { ...EXAMPLE_FINDING, status: 'open', last_seen_round: 2 }), {
    status: 'requested',
  });
  assert.equal(first.ok, true, JSON.stringify(first));
  const before = fs.readFileSync(fx.reviewPath);
  const result = fx.record(deltaPayload(fx, undefined, 3), { status: 'accepted' });
  assertRejectedUntouched(fx, before, result, 'final-review-single-round');
  assert.match(result.next, /discovery and one delta are used/);
});

for (const clause of BRIEF_CLAUSE_BAD) {
  test(`brief blueprint must_fix brief_clause ${clause} → is review-ledger-invalid`, () => {
    const fx = makeFixture({ contract: 'brief' });
    const before = fs.readFileSync(fx.reviewPath);
    const result = fx.record(fx.payload({}, [{ ...EXAMPLE_FINDING, brief_clause: clause }]));
    assertRejectedUntouched(fx, before, result, 'review-ledger-invalid');
    assert.ok(
      result.cause.some((m) => String(m).includes('review finding F1 must_fix brief_clause is not a brief section')),
      JSON.stringify(result.cause),
    );
  });
}

for (const clause of BRIEF_CLAUSE_OK) {
  test(`brief blueprint must_fix brief_clause ${clause} → records`, () => {
    const fx = makeFixture({ contract: 'brief' });
    const result = fx.record(fx.payload({}, [{ ...EXAMPLE_FINDING, brief_clause: clause }]));
    assert.equal(result.ok, true, JSON.stringify(result));
  });
}

test('brief blueprint advisory finding with free brief_clause → records', () => {
  const fx = makeFixture({ contract: 'brief' });
  const result = fx.record(fx.payload({}, [{ ...EXAMPLE_FINDING, actionability: 'advisory', brief_clause: 'style' }]));
  assert.equal(result.ok, true, JSON.stringify(result));
});

test('brief blueprint deferred must_fix with note and --status accepted → is accepted with open must_fix', () => {
  const fx = makeFixture({ contract: 'brief' });
  const before = fs.readFileSync(fx.reviewPath);
  const finding = { ...EXAMPLE_FINDING, status: 'deferred', note: 'later' };
  const result = fx.record(fx.payload({}, [finding]), { status: 'accepted' });
  assertRejectedUntouched(fx, before, result, 'review-ledger-invalid');
  assert.ok(result.cause.some((m) => String(m).includes('accepted with open must_fix')), JSON.stringify(result.cause));
});

test('brief blueprint accept-risk --yes on open must_fix → accepts the document', () => {
  const fx = makeFixture({ contract: 'brief' });
  recordOpenFindings(fx, ['F1']);
  const { code, result } = acceptRiskCli(fx);
  assert.equal(code, 0, JSON.stringify(result));
  assert.equal(result.status, 'accepted');
});

test('review_contract other → record is review-contract-invalid and leaves bytes unchanged', () => {
  const fx = makeFixture({ contract: 'other' });
  const before = fs.readFileSync(fx.reviewPath);
  const result = fx.record(fx.payload({}, [{ ...EXAMPLE_FINDING, status: 'open' }]), { status: 'requested' });
  assertRejectedUntouched(fx, before, result, 'review-contract-invalid');
});

test('review_contract other → accept-risk is review-contract-invalid and leaves bytes unchanged', () => {
  const fx = makeFixture({ contract: 'other' });
  const before = fs.readFileSync(fx.reviewPath);
  const { code, result } = acceptRiskCli(fx);
  assert.equal(code, 1);
  assertRejectedUntouched(fx, before, result, 'review-contract-invalid');
});

test('brief blueprint stored discovery,delta,delta → accept-risk is review rounds sequence invalid', () => {
  const fx = makeFixture({ contract: 'brief' });
  const parsed = parseFrontmatter(fs.readFileSync(fx.reviewPath, 'utf8'));
  const stored = (round, mode) => ({
    round, mode, target: { base: 'aaa', head: 'bbb' }, perspectives: [{ name: 'combined', target_head: 'bbb' }],
    previous_finding_ids: round === 1 ? [] : ['F1'], new: round === 1 ? 1 : 0, resolved: 0, regressed: 0,
  });
  parsed.data.bouncer.status = 'requested';
  parsed.data.bouncer.review = {
    rounds: [stored(1, 'discovery'), stored(2, 'delta'), stored(3, 'delta')],
    findings: [{
      ...EXAMPLE_FINDING,
      status: 'open',
      last_seen_round: 3,
      fingerprint: 'correctness:tasks/001 interface:scripts/lib/x.js#f',
    }],
  };
  fs.writeFileSync(fx.reviewPath, renderDoc(parsed.data, parsed.body));
  const before = fs.readFileSync(fx.reviewPath);
  const { code, result } = acceptRiskCli(fx);
  assert.equal(code, 1);
  assertRejectedUntouched(fx, before, result, 'review-ledger-invalid');
  assert.ok(result.cause.some((m) => String(m).includes('review rounds sequence invalid')), JSON.stringify(result.cause));
});
