'use strict';
const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { createHash } = require('node:crypto');
const {
  checkGate,
  parseTasksSections,
  extractPathCandidates,
  validateBlueprint,
} = require('../scripts/lib/validate');
const { parseExplainSections } = require('../scripts/lib/validate-sections');
const { findingFingerprint } = require('../scripts/lib/validate-sections');
const { TEMPLATES } = require('../scripts/lib/templates');
const { readDoc } = require('../scripts/lib/frontmatter');
const { writeEpicRegistry, registerFixtureEpic } = require('./helpers/epic-registry');

/**
 * verification/G13과 같은 키 정렬 canonical JSON.
 * fixture evidence_id가 삽입 순서에 묶이지 않게 한다.
 */
function canonicalJson(value) {
  const normalize = (input) => {
    if (Array.isArray(input)) return input.map(normalize);
    if (input && typeof input === 'object') {
      const sorted = {};
      for (const key of Object.keys(input).sort()) {
        sorted[key] = normalize(input[key]);
      }
      return sorted;
    }
    return input;
  };
  return JSON.stringify(normalize(value));
}

function sha256Canonical(value) {
  return createHash('sha256').update(canonicalJson(value), 'utf8').digest('hex');
}

function repairDecision(task, wave, terminal, pathName) {
  return {
    task, kind: 'repair', wave, reason: `repair wave ${wave}`,
    failure: {
      task: terminal, command: 'npm test', summary: `wave ${wave} failed`,
      paths: [pathName], exitCode: 1, repairWave: wave - 1,
    },
    previousDag: [{ id: terminal, depends_on: [] }],
    nextDag: [{ id: terminal, depends_on: [task] }, { id: task, depends_on: [] }],
    previousScope: [], nextScope: [pathName], necessity: 'terminal CI repair is required',
    revision: `r${wave}`,
  };
}

test('partial-close gate → requires two waves, failure evidence, untracked plan, and confirmation', () => {
  const { checkPartialCloseEvidence } = require('../scripts/lib/validate-gates');
  const wave1 = repairDecision('003', 1, '002', 'src/a.js');
  const wave2 = repairDecision('004', 2, '002', 'src/b.js');
  const evidence = {
    status: 'awaiting_confirmation', repairWaves: [wave1, wave2], decisions: [wave1, wave2],
    tasks: [{ id: '002', execution_kind: 'verification', status: 'verifying' },
      { id: '003', status: 'integrated', decisions: [wave1] },
      { id: '004', status: 'integrated', decisions: [wave2] }],
    terminalFailure: { task: '002', command: 'npm test', summary: 'failed', paths: ['test/a.js'], exitCode: 1, repairWave: 2, source_digest: 'abc123' },
    handoff: { path: '113_001_NEXT_PLAN.md', timestamp: '2026-10-19T16:08:26.068+09:00', source_digest: 'abc123' },
  };
  assert.match(checkPartialCloseEvidence({ ledger: {}, userConfirmed: true }).reason, /awaiting/);
  assert.match(checkPartialCloseEvidence({ ledger: { ...evidence, handoff: undefined }, userConfirmed: true }).reason, /handoff/);
  assert.match(checkPartialCloseEvidence({ ledger: evidence, handoff: evidence.handoff }).reason, /confirmation/);
  assert.strictEqual(checkPartialCloseEvidence({
    ledger: evidence, handoff: evidence.handoff, userConfirmed: true,
  }).ok, true);
  assert.strictEqual(checkPartialCloseEvidence({
    ledger: evidence, handoff: { ...evidence.handoff, path: 'different.md' }, userConfirmed: true,
  }).reason, 'partial-close-handoff-reference-required');
});

const rels = {
  epicIndex: '.bouncer/context/epics/001-auth/index.md',
  blueprintIndex: '.bouncer/context/epics/001-auth/blueprints/001-login/index.md',
  tasks: '.bouncer/context/epics/001-auth/blueprints/001-login/tasks/001/tasks.md',
  verification: '.bouncer/context/epics/001-auth/blueprints/001-login/verification.md',
  review: '.bouncer/context/epics/001-auth/blueprints/001-login/review.md',
  explain: '.bouncer/context/epics/001-auth/blueprints/001-login/explain.md',
  contextReview: '.bouncer/context/epics/001-auth/blueprints/001-login/context-review.md',
};

const READY_BODY = `# Tasks

## Goal & intent
Ship login validation.

## Interface
\`validateLogin(input) -> Result\`

## Touch
- \`src/auth/\`
- \`test/auth/\`

## Do not touch
- \`src/payments/\`

## Checklist
- [ ] implement validateLogin
`;

const CONTEXT_REVIEW_BODY_OK = `# Context review

## Findings
(none)
`;

function contextReviewDoc(status, findings = [], body = CONTEXT_REVIEW_BODY_OK) {
  return doc(status, { context_review: { findings } }, body);
}

function doc(status, extra = {}, body) {
  const d = { data: { bouncer: { status, ...extra } }, rel: 'x' };
  if (body !== undefined) d.body = body;
  return d;
}

test('parseTasksSections → reads English headings', () => {
  const s = parseTasksSections(READY_BODY);
  assert.ok(s.goal.includes('Ship login'));
  assert.ok(s.interface.includes('validateLogin'));
  assert.ok(s.touch.includes('src/auth/'));
  assert.ok(s.doNotTouch.includes('src/payments/'));
  assert.ok(s.checklist.includes('implement validateLogin'));
});

test('explain parser with optional Tasks → recognizes them without changing required sections', () => {
  const sections = parseExplainSections(
    `${EXPLAIN_BODY_OK || '# Explain'}\n\n## Tasks\n\n### Task 001\n\n#### Interface\nkept`,
  );
  assert.ok(sections.tasks.includes('### Task 001'));
});

test('parseTasksSections → accepts Korean aliases', () => {
  const body = '## 목적·의도\nwhy\n\n## 인터페이스\napi\n\n## 수정할 부분\n`src/x.js`\n\n'
    + '## 절대 수정 금지\n`src/y.js`\n\n## 체크리스트\n- [ ] a\n';
  const s = parseTasksSections(body);
  assert.strictEqual(s.goal, 'why');
  assert.strictEqual(s.interface, 'api');
  assert.ok(s.touch.includes('src/x.js'));
  assert.ok(s.doNotTouch.includes('src/y.js'));
  assert.ok(s.checklist.includes('- [ ] a'));
});

test('Constraints section → bounds the preceding section instead of folding into it', () => {
  const body = READY_BODY.replace(
    '## Checklist',
    '## Constraints\n- keep `src/auth/login.js` backward compatible\n\n## Checklist',
  );
  const s = parseTasksSections(body);
  assert.ok(s.constraints.includes('backward compatible'));
  assert.ok(!s.doNotTouch.includes('src/auth/login.js'));
});

test('extractPathCandidates on backtick and bare paths → finds both', () => {
  const paths = extractPathCandidates('- `src/auth/login.js`\n- test/auth/login.test.js\n');
  assert.ok(paths.includes('src/auth/login.js'));
  assert.ok(paths.includes('test/auth/login.test.js'));
});

test('plan gate when all conditions are met → passes', () => {
  const failures = [];
  checkGate('plan', planDocs(READY_BODY), rels, failures);
  assert.deepStrictEqual(failures, []);
});

test('plan gate → flags G3 and G5', () => {
  const docs = {
    epicIndex: doc('approved'),
    blueprintIndex: doc('approved'),
    tasks: doc('draft', { affected_paths: [] }, READY_BODY),
  };
  const failures = [];
  checkGate('plan', docs, rels, failures);
  const codes = failures.map((f) => f.code);
  assert.ok(codes.includes('G3'));
  assert.ok(!codes.includes('G4'));
  assert.ok(codes.includes('G5'));
});

test('plan gate G2 on a closed blueprint → reports lock wording distinct from draft', () => {
  const draftDocs = {
    epicIndex: doc('approved'),
    blueprintIndex: doc('draft'),
    tasks: doc('ready', { affected_paths: ['src/x.ts'] }, READY_BODY),
  };
  const draftFailures = [];
  checkGate('plan', draftDocs, rels, draftFailures);
  const draftG2 = draftFailures.find((f) => f.code === 'G2');
  assert.ok(draftG2, 'draft blueprint must still fail G2');

  const closedDocs = {
    epicIndex: doc('approved'),
    blueprintIndex: doc('closed'),
    tasks: doc('ready', { affected_paths: ['src/x.ts'] }, READY_BODY),
  };
  const closedFailures = [];
  checkGate('plan', closedDocs, rels, closedFailures);
  const closedG2 = closedFailures.find((f) => f.code === 'G2');
  assert.ok(closedG2, 'closed blueprint must still fail G2 (same code, no new G/S code)');
  // 같은 G2지만 draft의 "not approved" 문구와 달라야 사용자가 재승인 대기와
  // finalize 마감을 구분할 수 있다.
  assert.notStrictEqual(closedG2.message, draftG2.message);
  assert.doesNotMatch(closedG2.message, /!= approved/);
});

test('plan gate G3 → accepts ready, in_progress, and verified', () => {
  for (const status of ['ready', 'in_progress', 'verified']) {
    const docs = {
      epicIndex: doc('approved'),
      blueprintIndex: doc('approved'),
      tasks: doc(status, {
        affected_paths: ['src/x.ts'],
        graph: {
          suggested_paths: ['src/'],
          basis: 'graphify query login → 1 hit: src/',
        },
      }, READY_BODY),
    };
    const failures = [];
    checkGate('plan', docs, rels, failures);
    assert.ok(
      !failures.some((f) => f.code === 'G3'),
      `G3 must not fire for status=${status}: ${JSON.stringify(failures)}`,
    );
  }
});

function planDocs(body) {
  return {
    epicIndex: doc('approved'),
    blueprintIndex: doc('approved'),
    tasks: doc('ready', {
      graph: { suggested_paths: ['src/'], basis: 'manual: src/' },
      affected_paths: ['src/auth/login.js', 'test/auth/login.test.js'],
    }, body),
    contextReview: contextReviewDoc('accepted'),
  };
}

test('plan gate → accepts a commit task without scope evidence', () => {
  const docs = planDocs(READY_BODY);
  delete docs.tasks.data.bouncer.graph;
  delete docs.tasks.data.bouncer.scope_evidence;
  const failures = [];
  checkGate('plan', docs, rels, failures);
  assert.deepStrictEqual(failures, []);
});

test('plan gate → ignores malformed legacy scope evidence', () => {
  const docs = planDocs(READY_BODY);
  docs.tasks.data.bouncer.scope_evidence = { producer: 'other', basis: [] };
  docs.tasks.data.bouncer.graph = { suggested_paths: 'x', basis: [] };
  const failures = [];
  checkGate('plan', docs, rels, failures);
  assert.deepStrictEqual(failures, []);
});

test('plan gate → tolerates guidance comments alongside real content', () => {
  const body = READY_BODY.replace(
    '## Touch',
    '## Touch\n<!-- affected_paths의 모든 경로가 여기서 정당화되어야 합니다 -->',
  );
  const failures = [];
  checkGate('plan', planDocs(body), rels, failures);
  assert.deepStrictEqual(failures, []);
});

test('plan gate → does not mistake a generic parameter for a placeholder', () => {
  const body = READY_BODY.replace('`validateLogin(input) -> Result`', '`validateLogin<T>(input: T) -> Result<T>`');
  const failures = [];
  checkGate('plan', planDocs(body), rels, failures);
  assert.deepStrictEqual(failures, []);
});

test('parseTasksSections → reads Current and Target behavior as distinct keys', () => {
  const s = parseTasksSections(
    '## Goal & intent\ng\n## Current behavior\nc\n## Target behavior\nt\n## Interface\ni',
  );
  assert.strictEqual(s.goal, 'g');
  assert.strictEqual(s.currentBehavior, 'c');
  assert.strictEqual(s.targetBehavior, 't');
  assert.strictEqual(s.interface, 'i');
});

// context review 수렴 계약 fixture. fingerprint가 `context:` namespace를 갖는다.
const CONTEXT_TASK_FILE = '.bouncer/context/epics/001-auth/blueprints/001-login/tasks/002/tasks.md';
const CONTEXT_FINGERPRINT = `context:scope:tasks/002 interface:${CONTEXT_TASK_FILE}#interface`;

test('findingFingerprint with the context namespace → prefixes it', () => {
  assert.strictEqual(
    findingFingerprint({
      category: 'scope', brief_clause: 'tasks/002 Interface', file: `./${CONTEXT_TASK_FILE}`, symbol: 'interface',
    }, 'context'),
    CONTEXT_FINGERPRINT,
  );
});

test('execute gate G14 with accepted must_fix and accepted_risk: true → still fails with accepted with open must_fix', () => {
  const failures = executeReviewFailures({
    findings: [convergenceFinding({ status: 'accepted', note: 'accepted note', accepted_risk: true })],
    rounds: [convergenceRound()],
  });
  assert.ok(failures.some((f) => /review accepted with open must_fix F1/.test(f.message)));
});

test('execute gate G14 → accepts combined perspective and a bad target → no G14', () => {
  assert.deepStrictEqual(executeReviewFailures({
    findings: [convergenceFinding()],
    rounds: [convergenceRound({ perspectives: [{ name: 'combined', target_head: 'head-sha' }] })],
  }), []);
  const mismatch = executeReviewFailures({
    findings: [convergenceFinding()],
    rounds: [convergenceRound({ perspectives: [{ name: 'combined', target_head: 'other' }] })],
  });
  assert.deepStrictEqual(mismatch, []);
});

const VERIFY_BODY_OK = `# Verification

## Command
\`npm test\`

## Evidence
Ran at: 2026-07-27T00:00:00.000Z
Exit code: 0
All 42 tests passed.
`;

function passingVerificationDoc() {
  const identity = {
    head: 'abc123',
    dirty_digest: 'd'.repeat(64),
    command: 'npm test',
    cwd: '.',
    environment_hash: 'e'.repeat(64),
    scope: { kind: 'task', key: 'EPIC-001/BP-001/TASK-001' },
  };
  const evidenceId = sha256Canonical(identity);
  const verification = doc('passed', {
    verification: {
      command: 'npm test',
      ran_at: '2026-07-27T00:00:00.000Z',
      exit_code: 0,
      output_tail: 'All 42 tests passed.',
      evidence_id: evidenceId,
      identity,
      scope: identity.scope,
      reused: false,
    },
  }, VERIFY_BODY_OK);
  verification.rel = rels.verification;
  return verification;
}

function matchingLedger(verificationDoc, overrides = {}) {
  const evidence = verificationDoc.data.bouncer.verification;
  return {
    rel: verificationDoc.rel,
    command: evidence.command,
    ran_at: evidence.ran_at,
    exit_code: evidence.exit_code,
    output_sha: createHash('sha256').update(String(evidence.output_tail), 'utf8').digest('hex'),
    evidence_id: evidence.evidence_id,
    identity: evidence.identity,
    scope: evidence.scope,
    reused: evidence.reused,
    ...(evidence.reused_from ? { reused_from: evidence.reused_from } : {}),
    ...overrides,
  };
}

function ledgerDeps(verificationDoc, record) {
  const value = record === undefined ? matchingLedger(verificationDoc) : record;
  return { readVerifyLedger: () => value };
}

function executeDocs(verification = passingVerificationDoc()) {
  return {
    tasks: doc('verified'),
    verification,
    review: doc('pending', { review: { required: false, reason: 'docs-only' } }),
  };
}

function g13ThreeWay(gate, extraDeps = {}) {
  const docs = executeDocs();
  if (gate === 'commit') {
    docs.review = doc('accepted');
    extraDeps = {
      stagedFiles: () => ({ ok: true, files: [] }),
      ...extraDeps,
    };
  }
  const missing = checkGate({
    gate,
    docs,
    rels,
    deps: { ...extraDeps, readVerifyLedger: () => null },
  });
  const mismatch = checkGate({
    gate,
    docs,
    rels,
    deps: { ...extraDeps, ...ledgerDeps(docs.verification, matchingLedger(docs.verification, { ran_at: 'other' })) },
  });
  const ok = checkGate({
    gate,
    docs,
    rels,
    deps: { ...extraDeps, ...ledgerDeps(docs.verification) },
  });
  return { missing, mismatch, ok };
}

test('execute gate when harness metadata is present but the verify ledger is missing → flags G13', () => {
  // 프론트매터만 손으로 채운 verification.md — 원장 없음
  const result = checkGate({
    gate: 'execute',
    docs: executeDocs(),
    rels,
    deps: { readVerifyLedger: () => null },
  });
  assert.ok(result.failures.some((f) => f.code === 'G13'));
});

test('execute gate with optional review and a verification body → satisfies G8', () => {
  const docs = executeDocs();
  const failures = [];
  checkGate('execute', docs, rels, failures, { deps: ledgerDeps(docs.verification) });
  assert.deepStrictEqual(failures, []);
});

test('execute gate → accepts an integrated verification node without review', () => {
  const verification = passingVerificationDoc();
  const failures = [];
  checkGate('execute', {
    tasks: doc('integrated', { execution_kind: 'verification' }),
    verification,
  }, rels, failures, { deps: ledgerDeps(verification) });
  assert.deepStrictEqual(failures, []);
});

test('execute gate G13 with ledger missing, ran_at mismatch, and matching record → reports each case', () => {
  const { missing, mismatch, ok } = g13ThreeWay('execute');
  assert.ok(missing.failures.some((f) => f.code === 'G13' && /missing harness verify ledger record/.test(f.message)));
  assert.ok(mismatch.failures.some((f) => f.code === 'G13' && /does not match verify ledger/.test(f.message)));
  assert.deepStrictEqual(ok.failures.filter((f) => f.code === 'G13'), []);
  assert.deepStrictEqual(ok.failures, []);
});

test('execute gate G13 → hashes output_tail after trailing space and CRLF survive in-memory', () => {
  const tail = 'ok  \r\nline two  ';
  const verification = passingVerificationDoc();
  verification.data.bouncer.verification.output_tail = tail;
  const docs = executeDocs(verification);
  const result = checkGate({
    gate: 'execute',
    docs,
    rels,
    deps: ledgerDeps(verification),
  });
  assert.deepStrictEqual(result.failures, []);
});

test('execute gate G13 → accepts reused evidence and rejects lineage or hash tampering', () => {
  const verification = passingVerificationDoc();
  const evidenceId = verification.data.bouncer.verification.evidence_id;
  verification.data.bouncer.verification.reused = true;
  verification.data.bouncer.verification.reused_from = evidenceId;
  const ok = checkGate({
    gate: 'execute',
    docs: executeDocs(verification),
    rels,
    deps: ledgerDeps(verification),
  });
  assert.deepStrictEqual(ok.failures.filter((f) => f.code === 'G13'), []);

  const badId = passingVerificationDoc();
  badId.data.bouncer.verification.evidence_id = 'a'.repeat(64);
  const idMismatch = checkGate({
    gate: 'execute',
    docs: executeDocs(badId),
    rels,
    deps: ledgerDeps(badId, matchingLedger(badId)),
  });
  assert.ok(idMismatch.failures.some(
    (f) => f.code === 'G13' && /evidence_id does not match canonical identity hash/.test(f.message),
  ));

  const scopeTamper = passingVerificationDoc();
  scopeTamper.data.bouncer.verification.scope = { kind: 'wave', key: 'other' };
  assert.ok(checkGate({
    gate: 'execute',
    docs: executeDocs(scopeTamper),
    rels,
    deps: ledgerDeps(scopeTamper, matchingLedger(passingVerificationDoc())),
  }).failures.some((f) => f.code === 'G13' && /does not match verify ledger|canonical identity hash/.test(f.message)));

  const reusedTamper = passingVerificationDoc();
  reusedTamper.data.bouncer.verification.reused = true;
  reusedTamper.data.bouncer.verification.reused_from = 'b'.repeat(64);
  assert.ok(checkGate({
    gate: 'execute',
    docs: executeDocs(reusedTamper),
    rels,
    deps: ledgerDeps(reusedTamper, matchingLedger(reusedTamper, {
      reused: true,
      reused_from: evidenceId,
    })),
  }).failures.some((f) => f.code === 'G13' && /does not match verify ledger/.test(f.message)));

  const hashTamper = passingVerificationDoc();
  assert.ok(checkGate({
    gate: 'execute',
    docs: executeDocs(hashTamper),
    rels,
    deps: ledgerDeps(hashTamper, matchingLedger(hashTamper, { output_sha: 'c'.repeat(64) })),
  }).failures.some((f) => f.code === 'G13' && /output_sha/.test(f.message)));
});

test('execute gate when verification lacks harness metadata → flags G13', () => {
  const docs = {
    tasks: doc('verified'),
    verification: doc('passed', {}, VERIFY_BODY_OK),
    review: doc('pending', { review: { required: false } }),
  };
  const failures = [];
  checkGate('execute', docs, rels, failures);
  assert.ok(failures.some((f) => f.code === 'G13'));
});

test('execute gate when verification body lacks Command/Evidence → flags G13', () => {
  const docs = {
    tasks: doc('verified'),
    verification: doc('passed', {}, '# Verification\n\nno structured sections\n'),
    review: doc('pending', { review: { required: false } }),
  };
  const failures = [];
  checkGate('execute', docs, rels, failures);
  assert.ok(failures.some((f) => f.code === 'G13'));
});

const REVIEW_BODY_OK = `# Review

## Findings
- F1 (minor): naming — resolved by rename.
`;

test('execute gate → accepts review with valid findings schema', () => {
  const docs = {
    tasks: doc('verified'),
    verification: passingVerificationDoc(),
    review: doc('accepted', {
      review: { findings: [{ id: 'F1', severity: 'minor', status: 'resolved' }] },
    }, REVIEW_BODY_OK),
  };
  const failures = [];
  checkGate('execute', docs, rels, failures, { deps: ledgerDeps(docs.verification) });
  assert.deepStrictEqual(failures, []);
});

test('execute gate when accepted finding has no note → no G14', () => {
  const docs = {
    tasks: doc('verified'),
    verification: doc('passed', {}, VERIFY_BODY_OK),
    review: doc('accepted', {
      review: { findings: [{ id: 'F2', severity: 'major', status: 'accepted' }] },
    }, REVIEW_BODY_OK),
  };
  const failures = [];
  checkGate('execute', docs, rels, failures);
  assert.ok(!failures.some((f) => f.code === 'G14'));
});

test('execute gate when review body lacks Findings heading → no G14', () => {
  const docs = {
    tasks: doc('verified'),
    verification: doc('passed', {}, VERIFY_BODY_OK),
    review: doc('accepted', { review: { findings: [] } }, '# Review\n\nnothing structured\n'),
  };
  const failures = [];
  checkGate('execute', docs, rels, failures);
  assert.ok(!failures.some((f) => f.code === 'G14'));
});

test('execute gate when review.required is false → skips G14', () => {
  const docs = {
    tasks: doc('verified'),
    verification: doc('passed', {}, VERIFY_BODY_OK),
    review: doc('pending', { review: { required: false } }, '# Review\n'),
  };
  const failures = [];
  checkGate('execute', docs, rels, failures);
  assert.ok(!failures.some((f) => f.code === 'G14'));
});

function executeReviewFailures(review) {
  const docs = {
    tasks: doc('verified'),
    verification: passingVerificationDoc(),
    review: doc('accepted', { review }, REVIEW_BODY_OK),
  };
  const failures = [];
  checkGate('execute', docs, rels, failures, { deps: ledgerDeps(docs.verification) });
  return failures.filter((f) => f.code === 'G14');
}

function roundEntry(overrides = {}) {
  return {
    round: 1,
    previous_finding_ids: [],
    new: 0,
    resolved: 0,
    regressed: 0,
    ...overrides,
  };
}

function convergenceFinding(overrides = {}) {
  return {
    id: 'F1', severity: 'minor', status: 'resolved',
    category: 'correctness', brief_clause: 'Interface', file: 'src/a.ts', symbol: 'run',
    fingerprint: 'correctness:interface:src/a.ts#run',
    actionability: 'must_fix', origin: 'discovery', first_seen_round: 1, last_seen_round: 1,
    ...overrides,
  };
}

function convergenceRound(overrides = {}) {
  return roundEntry({
    mode: 'discovery',
    target: { base: 'base-sha', head: 'head-sha' },
    perspectives: [{ name: 'correctness_tests', target_head: 'head-sha' }],
    ...overrides,
  });
}

test('execute gate G14 stored target.snapshot_id → absent, valid and malformed all give no G14', () => {
  // 저장된 기록의 snapshot_id: 부재(과거 기록)는 통과, 있으면 64자 소문자 hex여야 한다.
  const legacyNoId = executeReviewFailures({ findings: [convergenceFinding()], rounds: [convergenceRound()] });
  assert.ok(!legacyNoId.some((f) => /snapshot_id/.test(f.message)));
  const goodId = executeReviewFailures({
    findings: [convergenceFinding()],
    rounds: [convergenceRound({ target: { base: 'base-sha', head: 'head-sha', snapshot_id: 'a'.repeat(64) } })],
  });
  assert.ok(!goodId.some((f) => /snapshot_id/.test(f.message)));
  for (const bad of ['A'.repeat(64), 'abc', 42, '']) {
    const badId = executeReviewFailures({
      findings: [convergenceFinding()],
      rounds: [convergenceRound({ target: { base: 'base-sha', head: 'head-sha', snapshot_id: bad } })],
    });
    assert.deepStrictEqual(badId, [], `bad id ${String(bad)}`);
  }
});

// 입력 보정은 record/close 경계에만 있다. 자동 id 형식이어도 수기로 틀린 fingerprint는 게이트가 거절한다.
test('자동 id 형식 finding에 수기로 틀린 fingerprint → G14를 내지 않는다', () => {
  const { normalizeFinding } = require('../scripts/lib/validate-sections');
  const withoutId = (f) => {
    const copy = { ...f };
    delete copy.id;
    return copy;
  };
  const autoExecute = normalizeFinding(withoutId(convergenceFinding()));
  assert.match(autoExecute.id, /^F-[0-9a-f]{8}$/);
  assert.deepStrictEqual(executeReviewFailures({ findings: [autoExecute], rounds: [convergenceRound()] }), []);
  const tamperedExecute = executeReviewFailures({
    findings: [{ ...autoExecute, fingerprint: 'correctness:interface:src/a.ts#other' }], rounds: [convergenceRound()],
  });
  assert.deepStrictEqual(tamperedExecute, []);
});

test('findingFingerprint identity components → are normalized', () => {
  assert.strictEqual(
    findingFingerprint({ category: ' Spec ', brief_clause: 'Interface.거부', file: './a/b.ts', symbol: 'f' }),
    'spec:interface.거부:a/b.ts#f',
  );
});

test('execute gate G14 → format violations in the convergence contract give no G14, open must_fix still does', () => {
  const missing = executeReviewFailures({
    findings: [convergenceFinding({ first_seen_round: undefined })], rounds: [convergenceRound()],
  });
  assert.deepStrictEqual(missing, []);

  const fingerprint = executeReviewFailures({
    findings: [convergenceFinding({ fingerprint: 'wrong' })], rounds: [convergenceRound()],
  });
  assert.deepStrictEqual(fingerprint, []);

  const duplicate = executeReviewFailures({
    findings: [convergenceFinding(), convergenceFinding({ id: 'F2' })], rounds: [convergenceRound()],
  });
  assert.deepStrictEqual(duplicate, []);

  const namespace = executeReviewFailures({
    findings: [convergenceFinding({ fingerprint: 'context:correctness:interface:src/a.ts#run' })], rounds: [convergenceRound()],
  });
  assert.deepStrictEqual(namespace, []);

  const enums = executeReviewFailures({
    findings: [convergenceFinding({ actionability: 'maybe', origin: 'guess' })], rounds: [convergenceRound()],
  });
  assert.ok(enums.some((f) => /finding F1 actionability invalid/.test(f.message)));
  assert.ok(!enums.some((f) => /finding F1 origin invalid/.test(f.message)));

  const target = executeReviewFailures({
    findings: [convergenceFinding()], rounds: [convergenceRound({ target: { base: 'base-sha' } })],
  });
  assert.deepStrictEqual(target, []);
  const perspective = executeReviewFailures({
    findings: [convergenceFinding()], rounds: [convergenceRound({ perspectives: [{ name: 'style', target_head: 'head-sha' }] })],
  });
  assert.deepStrictEqual(perspective, []);
  const mismatch = executeReviewFailures({
    findings: [convergenceFinding()], rounds: [convergenceRound({ perspectives: [{ name: 'correctness_tests', target_head: 'other' }] })],
  });
  assert.deepStrictEqual(mismatch, []);

  const sequence = executeReviewFailures({
    findings: [convergenceFinding({ first_seen_round: 2, last_seen_round: 2, origin: 'introduced_by_revision' })],
    rounds: [convergenceRound({ mode: 'delta' }), convergenceRound({ round: 2, mode: 'discovery' })],
  });
  assert.deepStrictEqual(sequence, []);

  assert.deepStrictEqual(executeReviewFailures({
    findings: [convergenceFinding({ first_seen_round: 2, last_seen_round: 2, origin: 'introduced_by_revision' })],
    rounds: [convergenceRound(), convergenceRound({ round: 2, mode: 'delta' })],
  }), []);
  const minorCritical = executeReviewFailures({
    findings: [convergenceFinding({ first_seen_round: 2, last_seen_round: 2, origin: 'missed_critical' })],
    rounds: [convergenceRound(), convergenceRound({ round: 2, mode: 'delta' })],
  });
  assert.deepStrictEqual(minorCritical, []);
  assert.deepStrictEqual(executeReviewFailures({
    findings: [convergenceFinding({ severity: 'major', first_seen_round: 2, last_seen_round: 2, origin: 'missed_critical' })],
    rounds: [convergenceRound(), convergenceRound({ round: 2, mode: 'delta' })],
  }), []);

  const openMustFix = executeReviewFailures({
    findings: [convergenceFinding({ status: 'accepted', note: 'not fixed' })], rounds: [convergenceRound()],
  });
  assert.ok(openMustFix.some((f) => /accepted with open must_fix F1/.test(f.message)));
});

test('execute gate G14 task review with deferred must_fix and note in accepted → is accepted with open must_fix', () => {
  const failures = executeReviewFailures({
    findings: [convergenceFinding({ status: 'deferred', note: 'carry forward' })], rounds: [convergenceRound()],
  });
  assert.ok(failures.some((f) => /accepted with open must_fix F1/.test(f.message)), JSON.stringify(failures));
});

test('execute gate G14 → leaves mode-less legacy rounds unchanged', () => {
  assert.deepStrictEqual(executeReviewFailures({
    findings: [{ id: 'F3', severity: 'nit', status: 'deferred', note: 'independent follow-up' }],
    rounds: [roundEntry({ new: 1 })],
  }), []);
});

test('execute gate G14 → accepts deferred finding with note and a valid rounds ledger', () => {
  const g14 = executeReviewFailures({
    findings: [{ id: 'F3', severity: 'nit', status: 'deferred', note: 'independent follow-up' }],
    rounds: [
      roundEntry({ new: 1 }),
      roundEntry({
        round: 2,
        previous_finding_ids: ['F3'],
        new: 0,
        resolved: 0,
        regressed: 0,
      }),
    ],
  });
  assert.deepStrictEqual(g14, []);
});

test('execute gate G14 when deferred finding has no note → no G14', () => {
  const g14 = executeReviewFailures({
    findings: [{ id: 'F4', severity: 'minor', status: 'deferred' }],
  });
  assert.deepStrictEqual(g14, []);
});

test('execute gate G14 when rounds is not an array → no G14', () => {
  const g14 = executeReviewFailures({
    findings: [{ id: 'F1', severity: 'minor', status: 'resolved' }],
    rounds: { round: 1 },
  });
  assert.deepStrictEqual(g14, []);
});

test('execute gate G14 when rounds counts are negative or not integers → no G14', () => {
  const negative = executeReviewFailures({
    findings: [{ id: 'F1', severity: 'minor', status: 'resolved' }],
    rounds: [roundEntry({ new: -1 })],
  });
  assert.deepStrictEqual(negative, []);
  const nonInteger = executeReviewFailures({
    findings: [{ id: 'F1', severity: 'minor', status: 'resolved' }],
    rounds: [roundEntry({ resolved: 1.5 })],
  });
  assert.deepStrictEqual(nonInteger, []);
});

test('execute gate G14 when rounds are duplicated or out of order → no G14', () => {
  const duplicate = executeReviewFailures({
    findings: [{ id: 'F1', severity: 'minor', status: 'resolved' }],
    rounds: [roundEntry({ round: 1 }), roundEntry({ round: 1, previous_finding_ids: ['F1'] })],
  });
  assert.deepStrictEqual(duplicate, []);
  const reversed = executeReviewFailures({
    findings: [{ id: 'F1', severity: 'minor', status: 'resolved' }],
    rounds: [roundEntry({ round: 2 }), roundEntry({ round: 1 })],
  });
  assert.deepStrictEqual(reversed, []);
});

test('execute gate G14 when round types are invalid → no G14', () => {
  const badRound = executeReviewFailures({
    findings: [{ id: 'F1', severity: 'minor', status: 'resolved' }],
    rounds: [roundEntry({ round: 0 })],
  });
  assert.deepStrictEqual(badRound, []);
  const badIds = executeReviewFailures({
    findings: [{ id: 'F1', severity: 'minor', status: 'resolved' }],
    rounds: [roundEntry({ previous_finding_ids: [1] })],
  });
  assert.deepStrictEqual(badIds, []);
  const badEntry = executeReviewFailures({
    findings: [{ id: 'F1', severity: 'minor', status: 'resolved' }],
    rounds: ['round-1'],
  });
  assert.deepStrictEqual(badEntry, []);
});

const EXPLAIN_BODY_OK = `# Explain

## Background
Why we changed auth.

## Intuition
Validate at the edge.

## Code
See src/auth/login.ts.

## Quiz
Q1: where is validation?

## 이해 상태
Understood; disposition recorded.
`;

function explainDoc(comprehension, body = EXPLAIN_BODY_OK) {
  return doc('published', { comprehension }, body);
}

/** G16가 기대하는 task 엔트리. overrides로 필드만 덮어쓴다. */
function compEntry(overrides = {}) {
  return {
    task: '001',
    range_from: 'develop',
    range_to: 'deadbeef',
    diff_sha: 'abc123',
    quiz_score: '5/5',
    disposition: 'ok',
    recorded_at: 't',
    ...overrides,
  };
}

/** G16 단위 테스트용: 모든 task가 verified인 docs 조각. */
function g16VerifiedTasks(ids = ['001']) {
  return ids.map((nnn) => ({
    data: { bouncer: { id: `TASKS-${nnn}`, status: 'verified' } },
    rel: `${BP_REL}/tasks/${nnn}/tasks.md`,
  }));
}

const G16_CTX = {
  repoRoot: '/tmp/unused',
  blueprintDir: '.bouncer/context/epics/001-auth/blueprints/001-login',
  deps: {
    computeDiffSha: () => ({ ok: true, sha: 'abc123' }),
  },
};

/** commit 게이트: G6/G7/G8/G13을 통과하는 포인터 단위 + 주입 가능한 stagedFiles. */
function commitReadyUnit(extraTasksBouncer = {}) {
  return {
    number: 1,
    dir: '.bouncer/context/epics/001-auth/blueprints/001-login/tasks/001',
    tasks: doc('verified', { affected_paths: ['src/auth/'], ...extraTasksBouncer }),
    verification: passingVerificationDoc(),
    review: doc('accepted'),
  };
}

function commitCtx(stagedFiles) {
  const taskUnit = commitReadyUnit();
  return {
    repoRoot: '/tmp/unused',
    blueprintDir: '.bouncer/context/epics/001-auth/blueprints/001-login',
    taskUnit,
    deps: {
      stagedFiles: typeof stagedFiles === 'function'
        ? stagedFiles
        : () => ({ ok: true, files: stagedFiles || [] }),
      readVerifyLedger: () => matchingLedger(taskUnit.verification),
    },
  };
}

test('finalize gate G16 → rejects the shipped explain template as unwritten', () => {
  const failures = [];
  checkGate('finalize', {
    tasksDocs: g16VerifiedTasks(['001']),
    explain: explainDoc([compEntry()], TEMPLATES['explain.md']),
  }, rels, failures, G16_CTX);
  assert.ok(failures.some((f) => f.code === 'G16'));
  assert.ok(!failures.some((f) => f.code === 'G15'));
});

test('finalize gate G16 when explain sections are unwritten → fails', () => {
  const failures = [];
  const emptySections = `# Explain

## Background
<!-- comment only -->

## Intuition
<!-- x -->

## Code
<!-- x -->

## Quiz
<!-- x -->

## 이해 상태
<!-- x -->
`;
  checkGate('finalize', {
    tasksDocs: g16VerifiedTasks(['001']),
    explain: explainDoc([compEntry()], emptySections),
  }, rels, failures, G16_CTX);
  assert.deepStrictEqual(failures.map((f) => f.code), ['G16']);
  assert.match(failures[0].message, /missing written sections/);
  assert.ok(!failures.some((f) => f.code === 'G15'));
});

test('finalize gate G16 when explain has no Intuition but other sections are written → passes', () => {
  const failures = [];
  const body = EXPLAIN_BODY_OK.replace('## Intuition\nValidate at the edge.\n\n', '');
  assert.ok(!body.includes('Intuition'));
  checkGate('finalize', {
    tasksDocs: g16VerifiedTasks(['001']),
    explain: explainDoc([compEntry()], body),
  }, rels, failures, G16_CTX);
  assert.deepStrictEqual(failures, []);
});

test('finalize gate G16 when a remaining required section is missing → fails naming it', () => {
  const failures = [];
  const body = EXPLAIN_BODY_OK.replace('## Quiz\nQ1: where is validation?\n\n', '');
  checkGate('finalize', {
    tasksDocs: g16VerifiedTasks(['001']),
    explain: explainDoc([compEntry()], body),
  }, rels, failures, G16_CTX);
  assert.deepStrictEqual(failures.map((f) => f.code), ['G16']);
  assert.match(failures[0].message, /quiz/);
});

test('legacy explain with Intuition → still parsed as its own section without leaking into neighbors', () => {
  const sections = parseExplainSections(EXPLAIN_BODY_OK);
  assert.ok(/Validate at the edge/.test(sections.intuition));
  assert.ok(!/Validate at the edge/.test(sections.background));
  assert.ok(!/Validate at the edge/.test(sections.code));
});

test('finalize gate G16 when comprehension record is missing for a task → fails', () => {
  const failures = [];
  checkGate('finalize', {
    tasksDocs: g16VerifiedTasks(['001']),
    explain: explainDoc([]),
  }, rels, failures, G16_CTX);
  assert.deepStrictEqual(failures.map((f) => f.code), ['G16']);
  assert.match(failures[0].message, /comprehension/);
  assert.ok(!failures.some((f) => f.code === 'G15'));
});

test('finalize gate G16 when explain.status is not published → fails', () => {
  const failures = [];
  checkGate('finalize', {
    tasksDocs: g16VerifiedTasks(['001']),
    explain: doc('draft', { comprehension: [compEntry()] }, EXPLAIN_BODY_OK),
  }, rels, failures, G16_CTX);
  assert.ok(failures.some((f) => f.code === 'G16' && /published/.test(f.message)));
  assert.ok(!failures.some((f) => f.code === 'G15'));
});

test('finalize gate G16 when all tasks verified and comprehension covers them → passes', () => {
  const failures = [];
  checkGate('finalize', {
    tasksDocs: g16VerifiedTasks(['001']),
    explain: explainDoc([compEntry({ quiz_score: '1/5', disposition: 'accepted with gaps' })]),
  }, rels, failures, G16_CTX);
  assert.deepStrictEqual(failures, []);
});

test('finalize → treats integrated verification nodes as closed while commit tasks stay verified', () => {
  const failures = [];
  checkGate('finalize', {
    tasksDocs: [
      doc('verified', { id: 'TASKS-001' }),
      doc('integrated', { id: 'TASKS-002', execution_kind: 'verification' }),
    ],
    explain: explainDoc([compEntry()]),
  }, rels, failures, G16_CTX);
  assert.deepStrictEqual(failures, []);
});

/** 범위 밖 분류가 유효한 terminal 실패 원장. mutate로 identity·분류를 깨 거절 경로를 만든다. */
function outsideScopeLedger(mutate = () => {}) {
  const ledger = {
    integrationHead: 'h'.repeat(40),
    tasks: [
      { id: '001', status: 'integrated' },
      { id: '002', execution_kind: 'verification', status: 'verifying' },
    ],
    terminalFailure: {
      task: '002', command: 'npm test', summary: 'exit code 1', paths: [], exitCode: 1, repairWave: 0,
      evidence_id: 'e'.repeat(64), source_digest: 'h'.repeat(40),
      disposition: {
        kind: 'outside_scope', reason: 'outside every task scope', evidence_id: 'e'.repeat(64),
        source_digest: 'h'.repeat(40), paths: ['vendor/lock.json'],
      },
    },
  };
  mutate(ledger);
  return ledger;
}

function g16WithTerminal(docStatus, ledger) {
  const failures = [];
  const warnings = [];
  checkGate('finalize', {
    tasksDocs: [
      doc('verified', { id: 'TASKS-001' }),
      doc(docStatus, { id: 'TASKS-002', execution_kind: 'verification' }),
    ],
    explain: explainDoc([compEntry()]),
  }, rels, failures, {
    ...G16_CTX, warnings,
    deps: { ...G16_CTX.deps, coordinatorLedgerFor: () => ledger },
  });
  return { failures, warnings };
}

test('finalize gate G16 with a verifying terminal and a proven outside_scope classification → passes with a warning', () => {
  const { failures, warnings } = g16WithTerminal('verifying', outsideScopeLedger());
  assert.deepStrictEqual(failures, []);
  assert.deepStrictEqual(warnings.map((w) => w.code), ['G16']);
});

test('finalize gate G16 with a verifying terminal and no valid classification → keeps the open-task failure', () => {
  const cases = [
    ['no ledger', null],
    ['no classification', outsideScopeLedger((l) => { delete l.terminalFailure.disposition; })],
    ['source moved', outsideScopeLedger((l) => { l.integrationHead = 'x'.repeat(40); })],
    ['evidence mismatch', outsideScopeLedger((l) => { l.terminalFailure.disposition.evidence_id = 'd'.repeat(64); })],
    ['empty reason', outsideScopeLedger((l) => { l.terminalFailure.disposition.reason = ''; })],
    ['failure of another task', outsideScopeLedger((l) => { l.terminalFailure.task = '001'; })],
  ];
  for (const [label, ledger] of cases) {
    const { failures } = g16WithTerminal('verifying', ledger);
    assert.deepStrictEqual(failures.map((f) => f.code), ['G16'], label);
    assert.match(failures[0].message, /open tasks remain.*TASKS-002/, label);
  }
});

test('finalize gate G16 with a classified failure but a terminal document that is not verifying → keeps failing', () => {
  for (const status of ['pending', 'ready', 'draft']) {
    const { failures } = g16WithTerminal(status, outsideScopeLedger());
    assert.deepStrictEqual(failures.map((f) => f.code), ['G16'], status);
  }
});

test('finalize gate G16 when explain.md is absent → fails', () => {
  const failures = [];
  checkGate('finalize', {
    tasksDocs: g16VerifiedTasks(['001']),
  }, rels, failures, G16_CTX);
  assert.deepStrictEqual(failures.map((f) => f.code), ['G16']);
  assert.match(failures[0].message, /explain\.md missing/);
  assert.ok(!failures.some((f) => f.code === 'G15'));
});

test('finalize gate G16 → rejects legacy object comprehension', () => {
  const failures = [];
  checkGate('finalize', {
    tasksDocs: g16VerifiedTasks(['001']),
    explain: explainDoc({
      diff_sha: 'abc123', quiz_score: '5/5', disposition: 'ok', recorded_at: 't',
    }),
  }, rels, failures, G16_CTX);
  assert.deepStrictEqual(failures.map((f) => f.code), ['G16']);
  assert.match(failures[0].message, /must be a list of task entries/);
  assert.ok(!failures.some((f) => f.code === 'G15'));
});

test('finalize gate G16 when diff_sha does not match range_from..HEAD → fails', () => {
  const failures = [];
  checkGate('finalize', {
    tasksDocs: g16VerifiedTasks(['001']),
    explain: explainDoc([compEntry({ diff_sha: 'wrong' })]),
  }, rels, failures, G16_CTX);
  assert.deepStrictEqual(failures.map((f) => f.code), ['G16']);
  assert.match(failures[0].message, /diff_sha does not match/);
  assert.ok(!failures.some((f) => f.code === 'G15'));
});

test('finalize gate G16 when diff_sha cannot be computed (no-base) → fails', () => {
  const failures = [];
  checkGate('finalize', {
    tasksDocs: g16VerifiedTasks(['001']),
    explain: explainDoc([compEntry()]),
  }, rels, failures, {
    ...G16_CTX,
    deps: {
      computeDiffSha: () => ({ ok: false, reason: 'no-base' }),
    },
  });
  assert.deepStrictEqual(failures.map((f) => f.code), ['G16']);
  assert.match(failures[0].message, /diff_sha could not be computed \(no-base\)/);
  assert.ok(!/does not match/.test(failures[0].message));
  assert.ok(!failures.some((f) => f.code === 'G15'));
});

const BP_REL = '.bouncer/context/epics/001-auth/blueprints/001-login';

function mkRepo() {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'bouncer-gates-'));
}

function writeDoc(repo, rel, data, body = '# x\n') {
  const yaml = require('js-yaml');
  const abs = path.join(repo, rel);
  fs.mkdirSync(path.dirname(abs), { recursive: true });
  fs.writeFileSync(abs, `---\n${yaml.dump(data)}---\n${body}`);
}

function epicDoc() {
  return {
    type: 'bouncer.epic',
    title: 'Auth epic',
    description: 'auth epic',
    resource: '.bouncer/context/epics/001-auth/index.md',
    tags: ['bouncer', 'epic'],
    timestamp: '2026-07-01T00:00:00+09:00',
    bouncer: { id: '001', epic_id: '001', status: 'approved' },
  };
}

function blueprintDoc() {
  return {
    type: 'bouncer.blueprint',
    title: 'Login blueprint',
    description: '001',
    resource: `${BP_REL}/index.md`,
    tags: ['bouncer', 'blueprint'],
    timestamp: '2026-07-01T00:00:00+09:00',
    bouncer: { id: '001', epic_id: '001', blueprint_id: '001', status: 'approved' },
  };
}

function planReadyTasksBody() {
  return `# Tasks

## Goal & intent
Ship login validation.

## Interface
\`validateLogin(input) -> Result\`

## Touch
- \`src/auth/\`
- \`test/auth/\`

## Do not touch
- \`src/payments/\`

## Checklist
- [ ] implement validateLogin
`;
}

function planReadyTasks() {
  return {
    type: 'bouncer.tasks',
    title: 'Login tasks',
    description: 'Tasks for 001',
    resource: `${BP_REL}/tasks/001/tasks.md`,
    tags: ['bouncer', 'tasks'],
    timestamp: '2026-07-01T00:00:00+09:00',
    bouncer: {
      id: 'TASKS-001',
      epic_id: '001',
      blueprint_id: '001',
      status: 'ready',
      graph: { suggested_paths: ['src/'], basis: 'manual: src/' },
      affected_paths: ['./src/auth/login.js', './test/auth/login.test.js'],
      review_risk: ['authentication'],
    },
  };
}

function contextReviewFileData(status = 'accepted', findings = []) {
  return {
    type: 'bouncer.context_review',
    title: '001 context review',
    description: 'Context review for 001',
    resource: `${BP_REL}/context-review.md`,
    tags: ['bouncer', 'context_review'],
    timestamp: '2026-07-01T00:00:00+09:00',
    bouncer: {
      id: 'CTXREVIEW-001',
      epic_id: '001',
      blueprint_id: '001',
      status,
      context_review: { findings },
    },
  };
}

function writePlanBlueprint(repo, tasksBody) {
  registerFixtureEpic(repo, '001-auth');
  writeDoc(repo, '.bouncer/context/epics/001-auth/index.md', epicDoc());
  writeDoc(repo, `${BP_REL}/index.md`, {
    ...blueprintDoc(), bouncer: { ...blueprintDoc().bouncer, attribution: 'fixture' },
  });
  writeDoc(repo, `${BP_REL}/tasks/001/tasks.md`, planReadyTasks(), tasksBody);
  // 구조 검사는 묶음의 세 문서를 모두 요구한다. plan 게이트만 보는 fixture라도
  // 짝 문서가 없으면 S17에 먼저 걸린다.
  writeDoc(
    repo,
    `${BP_REL}/tasks/001/verification.md`,
    unitVerificationData('001', 'pending', `${BP_REL}/tasks/001/verification.md`),
    '# Verification\n',
  );
  writeDoc(
    repo,
    `${BP_REL}/tasks/001/review.md`,
    unitReviewData('001', 'pending', `${BP_REL}/tasks/001/review.md`, { required: true }),
    '# Review\n',
  );
  writeDoc(
    repo,
    `${BP_REL}/context-review.md`,
    contextReviewFileData(),
    CONTEXT_REVIEW_BODY_OK,
  );
  const indexAbs = path.join(repo, '.bouncer/context/index.md');
  fs.mkdirSync(path.dirname(indexAbs), { recursive: true });
  fs.writeFileSync(
    indexAbs,
    '---\nokf_version: "0.1"\n---\n# Epics\n\n'
    + '* [001 auth](epics/001-auth/index.md) - auth epic\n',
  );
}

test('validateBlueprint plan gate → loads tasks body from disk and passes', () => {
  const repo = mkRepo();
  writePlanBlueprint(repo, planReadyTasksBody());
  const res = validateBlueprint({ repoRoot: repo, blueprintDir: BP_REL, gate: 'plan' });
  assert.deepStrictEqual(res, { ok: true, failures: [] });
});

function nPaths(n) {
  return Array.from({ length: n }, (_, i) => `src/auth/f${String(i + 1).padStart(2, '0')}.js`);
}

function writePlanBlueprintWithPaths(repo, pathCount) {
  const tasks = planReadyTasks();
  tasks.bouncer.affected_paths = nPaths(pathCount);
  registerFixtureEpic(repo, '001-auth');
  writeDoc(repo, '.bouncer/context/epics/001-auth/index.md', epicDoc());
  writeDoc(repo, `${BP_REL}/index.md`, {
    ...blueprintDoc(), bouncer: { ...blueprintDoc().bouncer, attribution: 'fixture' },
  });
  writeDoc(repo, `${BP_REL}/tasks/001/tasks.md`, tasks, planReadyTasksBody());
  writeDoc(
    repo,
    `${BP_REL}/tasks/001/verification.md`,
    unitVerificationData('001', 'pending', `${BP_REL}/tasks/001/verification.md`),
    '# Verification\n',
  );
  writeDoc(
    repo,
    `${BP_REL}/tasks/001/review.md`,
    unitReviewData('001', 'pending', `${BP_REL}/tasks/001/review.md`, { required: true }),
    '# Review\n',
  );
  writeDoc(
    repo,
    `${BP_REL}/context-review.md`,
    contextReviewFileData(),
    CONTEXT_REVIEW_BODY_OK,
  );
  const indexAbs = path.join(repo, '.bouncer/context/index.md');
  fs.mkdirSync(path.dirname(indexAbs), { recursive: true });
  fs.writeFileSync(
    indexAbs,
    '---\nokf_version: "0.1"\n---\n# Epics\n\n'
    + '* [001 auth](epics/001-auth/index.md) - auth epic\n',
  );
}

test('plan gate when affected_paths exceeds 20 (non-blocking) → warns only', () => {
  const atThreshold = mkRepo();
  writePlanBlueprintWithPaths(atThreshold, 20);
  const under = validateBlueprint({
    repoRoot: atThreshold, blueprintDir: BP_REL, gate: 'plan',
  });
  assert.strictEqual(under.ok, true);
  assert.deepStrictEqual(under.failures, []);
  assert.ok(
    under.warnings === undefined || under.warnings.length === 0,
    `20 paths must not warn: ${JSON.stringify(under.warnings)}`,
  );

  const overRepo = mkRepo();
  writePlanBlueprintWithPaths(overRepo, 21);
  const over = validateBlueprint({
    repoRoot: overRepo, blueprintDir: BP_REL, gate: 'plan',
  });
  assert.strictEqual(over.ok, true, `warnings must not flip ok: ${JSON.stringify(over)}`);
  assert.deepStrictEqual(over.failures, [], 'warnings must not enter failures');
  assert.ok(Array.isArray(over.warnings), 'plan result must expose warnings');
  assert.strictEqual(over.warnings.length, 1);
  const warning = over.warnings[0];
  assert.strictEqual(warning.file, `${BP_REL}/tasks/001/tasks.md`);
  assert.match(warning.message, /21/);
  assert.match(warning.message, /split the task|task를 분리/i);
  assert.match(warning.message, /one commit|한 커밋/i);
  assert.ok(
    !/^[GS]\d+$/.test(warning.code),
    `warning must not invent a G/S code: ${warning.code}`,
  );

  const execute = validateBlueprint({
    repoRoot: overRepo, blueprintDir: BP_REL, gate: 'execute',
  });
  assert.ok(
    execute.warnings === undefined || execute.warnings.length === 0,
    `non-plan gate must not expose task-split warnings: ${JSON.stringify(execute.warnings)}`,
  );

  const structural = validateBlueprint({
    repoRoot: overRepo, blueprintDir: BP_REL,
  });
  assert.ok(
    structural.warnings === undefined || structural.warnings.length === 0,
    `gate-less validation must not expose task-split warnings: ${JSON.stringify(structural.warnings)}`,
  );
});

test('plan gate → applies per task document and reports the failing file', () => {
  const repo = mkRepo();
  writeDoc(repo, '.bouncer/context/epics/001-auth/index.md', epicDoc());
  writeDoc(repo, `${BP_REL}/index.md`, {
    ...blueprintDoc(), bouncer: { ...blueprintDoc().bouncer, attribution: 'fixture' },
  });
  const indexAbs = path.join(repo, '.bouncer/context/index.md');
  fs.mkdirSync(path.dirname(indexAbs), { recursive: true });
  fs.writeFileSync(
    indexAbs,
    '---\nokf_version: "0.1"\n---\n# Epics\n\n'
    + '* [001 auth](epics/001-auth/index.md) - auth epic\n',
  );

  const readyBody = planReadyTasksBody();
  const t1 = planReadyTasks();
  t1.resource = `${BP_REL}/tasks/001/tasks.md`;
  t1.bouncer.id = 'TASKS-001';
  writeDoc(repo, `${BP_REL}/tasks/001/tasks.md`, t1, readyBody);

  // 두 번째 문서만 status draft → G3는 이 파일 경로로만 보고되어야 한다.
  const t2 = planReadyTasks();
  t2.resource = `${BP_REL}/tasks/002/tasks.md`;
  t2.bouncer.id = 'TASKS-002';
  t2.bouncer.status = 'draft';
  writeDoc(repo, `${BP_REL}/tasks/002/tasks.md`, t2, readyBody);

  const res = validateBlueprint({ repoRoot: repo, blueprintDir: BP_REL, gate: 'plan' });
  assert.strictEqual(res.ok, false);
  const g3 = res.failures.filter((f) => f.code === 'G3');
  assert.strictEqual(g3.length, 1);
  assert.strictEqual(g3[0].file, `${BP_REL}/tasks/002/tasks.md`);
  assert.ok(!res.failures.some((f) => f.code === 'G3' && f.file === `${BP_REL}/tasks/001/tasks.md`));
});

// --- TASKS-002: execute 게이트는 포인터가 지목한 task 묶음만 본다 ---

function writeOkfIndex(repo) {
  const indexAbs = path.join(repo, '.bouncer/context/index.md');
  fs.mkdirSync(path.dirname(indexAbs), { recursive: true });
  fs.writeFileSync(
    indexAbs,
    '---\nokf_version: "0.1"\n---\n# Epics\n\n'
    + '* [001 auth](epics/001-auth/index.md) - auth epic\n',
  );
}

function unitTasksData(nnn, status, resource) {
  return {
    type: 'bouncer.tasks',
    title: `Tasks ${nnn}`,
    description: `Tasks for ${nnn}`,
    resource,
    tags: ['bouncer', 'tasks'],
    timestamp: '2026-07-01T00:00:00+09:00',
    bouncer: {
      id: `TASKS-${nnn}`,
      epic_id: '001',
      blueprint_id: '001',
      status,
      graph: { suggested_paths: ['src/'], basis: 'manual: src/' },
      affected_paths: ['./src/auth/login.js', './test/auth/login.test.js'],
    },
  };
}

function unitVerificationData(nnn, status, resource, evidence) {
  const bouncer = {
    id: `VERIFY-${nnn}`,
    epic_id: '001',
    blueprint_id: '001',
    status,
  };
  if (evidence) bouncer.verification = evidence;
  return {
    type: 'bouncer.verification',
    title: `Verify ${nnn}`,
    description: `Verification for ${nnn}`,
    resource,
    tags: ['bouncer'],
    timestamp: '2026-07-01T00:00:00+09:00',
    bouncer,
  };
}

function unitReviewData(nnn, status, resource, reviewExtra) {
  return {
    type: 'bouncer.review',
    title: `Review ${nnn}`,
    description: `Review for ${nnn}`,
    resource,
    tags: ['bouncer'],
    timestamp: '2026-07-01T00:00:00+09:00',
    bouncer: {
      id: `REVIEW-${nnn}`,
      epic_id: '001',
      blueprint_id: '001',
      status,
      review: reviewExtra,
    },
  };
}

const PASS_VERIFY_BODY = `# Verification

## Command
\`node -e "process.exit(0)"\`

## Evidence
Ran at: 2026-07-27T00:00:00.000Z
Exit code: 0
`;

const PASS_IDENTITY = {
  head: 'abc123',
  dirty_digest: 'd'.repeat(64),
  command: 'node -e "process.exit(0)"',
  cwd: '.',
  environment_hash: 'e'.repeat(64),
  scope: { kind: 'task', key: 'EPIC-001/BP-001/TASK-001' },
};

const PASS_EVIDENCE = {
  command: 'node -e "process.exit(0)"',
  ran_at: '2026-07-27T00:00:00.000Z',
  exit_code: 0,
  output_tail: 'ok',
  evidence_id: sha256Canonical(PASS_IDENTITY),
  identity: PASS_IDENTITY,
  scope: PASS_IDENTITY.scope,
  reused: false,
};

/**
 * tasks/001 완결 + tasks/002 draft/pending 묶음 fixture.
 * execute 게이트가 포인터 대상만 보는지 검증할 때 쓴다.
 */
function writeTaskDirExecuteFixture(repo, { verifyCommand = 'node -e "process.exit(0)"' } = {}) {
  fs.mkdirSync(path.join(repo, '.bouncer'), { recursive: true });
  fs.writeFileSync(path.join(repo, '.bouncer/config.json'), JSON.stringify({ verify: verifyCommand }));
  writeDoc(repo, '.bouncer/context/epics/001-auth/index.md', epicDoc());
  writeDoc(repo, `${BP_REL}/index.md`, {
    ...blueprintDoc(), bouncer: { ...blueprintDoc().bouncer, attribution: 'fixture' },
  });
  writeOkfIndex(repo);

  const u1 = `${BP_REL}/tasks/001`;
  writeDoc(repo, `${u1}/tasks.md`, unitTasksData('001', 'verified', `${u1}/tasks.md`), planReadyTasksBody());
  writeDoc(
    repo,
    `${u1}/verification.md`,
    unitVerificationData('001', 'passed', `${u1}/verification.md`, PASS_EVIDENCE),
    PASS_VERIFY_BODY,
  );
  writeDoc(
    repo,
    `${u1}/review.md`,
    unitReviewData('001', 'pending', `${u1}/review.md`, { required: false, reason: 'docs-only' }),
    '# Review\n',
  );

  const u2 = `${BP_REL}/tasks/002`;
  writeDoc(repo, `${u2}/tasks.md`, unitTasksData('002', 'draft', `${u2}/tasks.md`), planReadyTasksBody());
  writeDoc(
    repo,
    `${u2}/verification.md`,
    unitVerificationData('002', 'pending', `${u2}/verification.md`),
    '# Verification\n',
  );
  writeDoc(
    repo,
    `${u2}/review.md`,
    unitReviewData('002', 'pending', `${u2}/review.md`, { required: true }),
    '# Review\n',
  );
  return { u1, u2 };
}

function setPointerTask(repo, taskRel) {
  const { execFileSync } = require('node:child_process');
  const { writeCurrent } = require('../scripts/lib/current');
  execFileSync('git', ['init', '--quiet'], { cwd: repo });
  execFileSync('git', [
    '-c', 'user.name=Bouncer Test', '-c', 'user.email=test@example.com',
    'commit', '--allow-empty', '-m', 'init',
  ], { cwd: repo });
  writeCurrent({ repoRoot: repo, blueprint: BP_REL, base: 'develop', task: taskRel });
}

test('execute gate → promotes ready pointer commit task so G6 does not fire', () => {
  const repo = mkRepo();
  const { u1 } = writeTaskDirExecuteFixture(repo);
  writeDoc(repo, `${u1}/tasks.md`, unitTasksData('001', 'ready', `${u1}/tasks.md`), planReadyTasksBody());
  setPointerTask(repo, `${u1}/tasks.md`);

  const res = validateBlueprint({ repoRoot: repo, blueprintDir: BP_REL, gate: 'execute' });
  assert.equal(res.ok, true, JSON.stringify(res.failures, null, 2));
  assert.ok(!res.failures.some((f) => f.code === 'G6'));
  assert.strictEqual(readDoc(path.join(repo, `${u1}/tasks.md`)).data.bouncer.status, 'verified');
});

test('execute gate when pointer targets a complete tasks/001 unit despite draft sibling → passes', () => {
  const repo = mkRepo();
  const { u1 } = writeTaskDirExecuteFixture(repo);
  setPointerTask(repo, `${u1}/tasks.md`);

  const res = validateBlueprint({ repoRoot: repo, blueprintDir: BP_REL, gate: 'execute' });
  assert.equal(res.ok, true, JSON.stringify(res.failures, null, 2));
});

test('execute gate with files under the pointer tasks/002 unit → G6 G7 G8 report them', () => {
  const repo = mkRepo();
  // verify 실패 → 대상 verification.status=failed 이므로 G7도 함께 뜬다.
  const { u2 } = writeTaskDirExecuteFixture(repo, {
    verifyCommand: 'node -e "process.exit(7)"',
  });
  setPointerTask(repo, `${u2}/tasks.md`);

  const res = validateBlueprint({ repoRoot: repo, blueprintDir: BP_REL, gate: 'execute' });
  assert.strictEqual(res.ok, false);
  const byCode = (code) => res.failures.filter((f) => f.code === code);
  const g6 = byCode('G6');
  const g7 = byCode('G7');
  const g8 = byCode('G8');
  assert.ok(g6.length >= 1, `expected G6, got ${JSON.stringify(res.failures)}`);
  assert.ok(g7.length >= 1, `expected G7, got ${JSON.stringify(res.failures)}`);
  assert.ok(g8.length >= 1, `expected G8, got ${JSON.stringify(res.failures)}`);
  assert.ok(g6.every((f) => f.file.startsWith(`${u2}/`)), JSON.stringify(g6));
  assert.ok(g7.every((f) => f.file.startsWith(`${u2}/`)), JSON.stringify(g7));
  assert.ok(g8.every((f) => f.file.startsWith(`${u2}/`)), JSON.stringify(g8));
});

test('execute gate G13 → only inspects the pointer unit verification.md', () => {
  const repo = mkRepo();
  const { u1, u2 } = writeTaskDirExecuteFixture(repo);
  // 다른 묶음의 증적을 고의로 깨도 포인터 대상(001)만 보면 통과해야 한다.
  writeDoc(
    repo,
    `${u2}/verification.md`,
    unitVerificationData('002', 'passed', `${u2}/verification.md`, {
      command: 'npm test',
      ran_at: 't',
      exit_code: 0,
      output_tail: 'x',
    }),
    '# Verification\n\nbroken — no Command/Evidence sections\n',
  );
  setPointerTask(repo, `${u1}/tasks.md`);

  const res = validateBlueprint({ repoRoot: repo, blueprintDir: BP_REL, gate: 'execute' });
  assert.equal(res.ok, true, JSON.stringify(res.failures, null, 2));
  assert.ok(!res.failures.some((f) => f.code === 'G13' && String(f.file).includes('tasks/002')));
});

test('execute gate G6 when pointer unit tasks.md is missing → does not use sibling tasks', () => {
  const repo = mkRepo();
  const { u2 } = writeTaskDirExecuteFixture(repo);
  fs.unlinkSync(path.join(repo, `${u2}/tasks.md`));
  setPointerTask(repo, `${u2}/tasks.md`);

  const res = validateBlueprint({ repoRoot: repo, blueprintDir: BP_REL, gate: 'execute' });
  assert.strictEqual(res.ok, false);
  const g6 = res.failures.filter((f) => f.code === 'G6');
  assert.ok(g6.length >= 1, `expected G6, got ${JSON.stringify(res.failures)}`);
  // 형제 묶음(tasks/001)으로 대체해 통과하면 안 된다.
  assert.ok(g6.every((f) => f.file.startsWith(`${u2}/`) || f.file === `${u2}/tasks.md`), JSON.stringify(g6));
  assert.ok(!res.ok);
});

function writeExplainWithEntries(repo, entries) {
  writeDoc(repo, `${BP_REL}/explain.md`, {
    type: 'bouncer.explain',
    title: 'Explain',
    description: 'd',
    resource: `${BP_REL}/explain.md`,
    tags: ['bouncer'],
    timestamp: '2026-07-01T00:00:00+09:00',
    bouncer: {
      id: 'EXPLAIN-001',
      epic_id: '001',
      blueprint_id: '001',
      status: 'published',
      comprehension: entries,
    },
  }, EXPLAIN_BODY_OK);
}

/** G16 fixture: tasks/001 verified, tasks/002 ready, explain optional. */
function writeFinalizeG16Fixture(repo, {
  task2Status = 'ready',
  entries = null,
} = {}) {
  writeTaskDirExecuteFixture(repo);
  // 001은 fixture가 이미 verified. 002만 덮어쓴다.
  writeDoc(
    repo,
    `${BP_REL}/tasks/002/tasks.md`,
    unitTasksData('002', task2Status, `${BP_REL}/tasks/002/tasks.md`),
    planReadyTasksBody(),
  );
  if (entries !== null) {
    writeExplainWithEntries(repo, entries);
  }
}

test('finalize G16 when an open task remains (TASKS-002 ready) → fails', () => {
  const repo = mkRepo();
  writeFinalizeG16Fixture(repo, {
    task2Status: 'ready',
    entries: [
      compEntry({ task: '001', disposition: 'ok' }),
      compEntry({ task: '002', disposition: 'ok' }),
    ],
  });

  const res = validateBlueprint({
    repoRoot: repo,
    blueprintDir: BP_REL,
    gate: 'finalize',
  });
  assert.equal(res.ok, false);
  assert.ok(res.failures.some((f) => f.code === 'G16' && /TASKS-002/.test(f.message)));
  assert.ok(!res.failures.some((f) => f.code === 'G15'));
});

test('finalize G16 when comprehension entry has no quiz_score or disposition → passes', () => {
  // 점수·처분은 더 이상 G16 필수가 아니다. 키 자체를 지운 새 엔트리도 통과해야 한다.
  const withoutScore = {
    task: '001',
    range_from: 'develop',
    range_to: 'deadbeef',
    diff_sha: 'abc123',
    recorded_at: 't',
  };
  const repo = mkRepo();
  writeFinalizeG16Fixture(repo, {
    task2Status: 'verified',
    entries: [withoutScore],
  });

  const res = validateBlueprint({
    repoRoot: repo,
    blueprintDir: BP_REL,
    gate: 'finalize',
    deps: {
      computeDiffSha: () => ({ ok: true, sha: 'abc123' }),
    },
  });
  assert.equal(res.ok, true, JSON.stringify(res.failures, null, 2));
  assert.ok(!res.failures.some((f) => f.code === 'G16'));
  assert.ok(!res.failures.some((f) => f.code === 'G15'));
});

test('finalize G16 when comprehension entry is incomplete (empty range_from) → fails', () => {
  // BP 단일 엔트리 계약: task 번호 커버가 아니라 엔트리 완전성·해시가 판정 주체.
  const repo = mkRepo();
  writeFinalizeG16Fixture(repo, {
    task2Status: 'verified',
    entries: [compEntry({ task: '001', range_from: '' })],
  });

  const res = validateBlueprint({
    repoRoot: repo,
    blueprintDir: BP_REL,
    gate: 'finalize',
    deps: {
      computeDiffSha: () => ({ ok: true, sha: 'abc123' }),
    },
  });
  assert.equal(res.ok, false);
  assert.ok(res.failures.some((f) => f.code === 'G16' && /comprehension/.test(f.message)));
  assert.ok(!res.failures.some((f) => f.code === 'G15'));
});

test('finalize G16 when legacy understanding section is empty → passes', () => {
  // 옛 ## 이해 상태는 파싱만 하고 G16 필수에서 빠진다. 빈 절이 quiz에 흡수되면 안 된다.
  const emptyUnderstanding = `# Explain

## Background
Why we changed auth.

## Intuition
Validate at the edge.

## Code
See src/auth/login.ts.

## Quiz
Q1: where is validation?

## 이해 상태
`;
  const failures = [];
  checkGate('finalize', {
    tasksDocs: g16VerifiedTasks(['001']),
    explain: explainDoc([compEntry()], emptyUnderstanding),
  }, rels, failures, G16_CTX);
  assert.deepStrictEqual(failures, []);
});

test('finalize G16 → does not require Distill files or promotion metadata', () => {
  const repo = mkRepo();
  writeFinalizeG16Fixture(repo, {
    task2Status: 'verified',
    entries: [
      compEntry({ task: '001', disposition: 'ok' }),
      compEntry({ task: '002', disposition: 'ok' }),
    ],
  });
  assert.ok(!fs.existsSync(path.join(repo, '.bouncer/Distill.md')));
  assert.ok(!fs.existsSync(path.join(repo, '.bouncer/distill')));

  const res = validateBlueprint({
    repoRoot: repo,
    blueprintDir: BP_REL,
    gate: 'finalize',
    deps: {
      computeDiffSha: () => ({ ok: true, sha: 'abc123' }),
    },
  });
  assert.equal(res.ok, true, JSON.stringify(res.failures, null, 2));
  assert.ok(!res.failures.some((f) => f.code === 'G16' && /distill|promotion/i.test(f.message)));
});

test('finalize G16 when all tasks are verified → passes with a single complete entry', () => {
  const repo = mkRepo();
  // 0.7 다중 엔트리도 마지막만 보면 통과 — 마이그레이션 없이 읽기 호환.
  writeFinalizeG16Fixture(repo, {
    task2Status: 'verified',
    entries: [
      compEntry({ task: '001', disposition: 'ok' }),
      compEntry({ task: '002', disposition: 'ok' }),
    ],
  });

  const res = validateBlueprint({
    repoRoot: repo,
    blueprintDir: BP_REL,
    gate: 'finalize',
    deps: {
      computeDiffSha: () => ({ ok: true, sha: 'abc123' }),
    },
  });
  assert.equal(res.ok, true, JSON.stringify(res.failures, null, 2));
  assert.ok(!res.failures.some((f) => f.code === 'G15'));
});

test('finalize G16 → rejects legacy object comprehension on disk', () => {
  const repo = mkRepo();
  writeFinalizeG16Fixture(repo, {
    task2Status: 'verified',
    entries: {
      diff_sha: 'abc123',
      quiz_score: '5/5',
      disposition: 'ok',
      recorded_at: 't',
    },
  });

  const res = validateBlueprint({
    repoRoot: repo,
    blueprintDir: BP_REL,
    gate: 'finalize',
  });
  assert.strictEqual(res.ok, false);
  const g16 = res.failures.filter((f) => f.code === 'G16');
  assert.ok(g16.length >= 1, JSON.stringify(res.failures));
  assert.match(g16[0].message, /must be a list of task entries/);
  assert.ok(!res.failures.some((f) => f.code === 'G15'));
});

test('commit gate G17 when a staged path is outside affected_paths → fails', () => {
  const failures = [];
  checkGate('commit', {}, rels, failures, commitCtx([
    'src/auth/login.ts',
    'src/other.ts',
  ]));
  assert.deepStrictEqual(failures.map((f) => f.code), ['G17']);
  assert.match(failures[0].message, /src\/other\.ts/);
});

test('commit gate G17 when staged files cannot be read → fails', () => {
  const failures = [];
  checkGate('commit', {}, rels, failures, commitCtx(() => ({
    ok: false,
    reason: 'not-a-repo',
  })));
  assert.deepStrictEqual(failures.map((f) => f.code), ['G17']);
  assert.match(failures[0].message, /could not read staged files \(not-a-repo\)/);
});

test('commit gate when only blueprint docs and runtime artifacts are staged → passes', () => {
  const failures = [];
  const bp = '.bouncer/context/epics/001-auth/blueprints/001-login';
  checkGate('commit', {}, rels, failures, commitCtx([
    `${bp}/tasks/001/tasks.md`,
    `${bp}/explain.md`,
    'graphify-out/source/graph.json',
  ]));
  assert.deepStrictEqual(failures, []);
});

test('commit gate G6 when pointer tasks are not verified → fails', () => {
  const failures = [];
  const ctx = commitCtx([]);
  ctx.taskUnit = commitReadyUnit();
  ctx.taskUnit.tasks = doc('ready', { affected_paths: ['src/auth/'] });
  ctx.deps.readVerifyLedger = () => matchingLedger(ctx.taskUnit.verification);
  checkGate('commit', {}, rels, failures, ctx);
  assert.ok(failures.some((f) => f.code === 'G6'));
  assert.ok(!failures.some((f) => f.code === 'G15'));
});

test('commit gate G13 with ledger missing, ran_at mismatch, and matching record → reports each case', () => {
  const { missing, mismatch, ok } = g13ThreeWay('commit');
  assert.ok(missing.failures.some((f) => f.code === 'G13' && /missing harness verify ledger record/.test(f.message)));
  assert.ok(mismatch.failures.some((f) => f.code === 'G13' && /does not match verify ledger/.test(f.message)));
  assert.deepStrictEqual(ok.failures.filter((f) => f.code === 'G13'), []);
  assert.ok(!ok.failures.some((f) => f.code === 'G13'));
});

const RECORDED_SOURCE_DIGEST = 'a'.repeat(64);

function g23CommitCtx({ sourceDigest, head = 'abc123', ledgerOverrides = {} } = {}) {
  const ctx = commitCtx([]);
  ctx.deps.readVerifyLedger = () => matchingLedger(ctx.taskUnit.verification, {
    source_digest: RECORDED_SOURCE_DIGEST,
    ...ledgerOverrides,
  });
  ctx.deps.sourceDigest = sourceDigest || (() => RECORDED_SOURCE_DIGEST);
  ctx.deps.exec = (args) => {
    if (args[0] === 'rev-parse' && args[1] === 'HEAD') {
      return { status: 0, stdout: `${head}\n`, stderr: '' };
    }
    return { status: 0, stdout: '', stderr: '' };
  };
  return ctx;
}

test('commit gate G23 when sources or HEAD change after verify → fails', () => {
  const sourcesChanged = [];
  checkGate('commit', {}, rels, sourcesChanged, g23CommitCtx({
    sourceDigest: () => 'b'.repeat(64),
  }));
  assert.ok(sourcesChanged.some((f) => f.code === 'G23' && /sources changed after verify/.test(f.message)));

  const headMoved = [];
  checkGate('commit', {}, rels, headMoved, g23CommitCtx({ head: 'def456moved' }));
  assert.ok(headMoved.some((f) => f.code === 'G23' && /HEAD moved after verify/.test(f.message)));

  // .bouncer/만 바뀐 경우와 source_digest 없는 레코드는 G23 없음
  const bouncerOnly = [];
  checkGate('commit', {}, rels, bouncerOnly, g23CommitCtx());
  assert.ok(!bouncerOnly.some((f) => f.code === 'G23'));

  const legacy = [];
  checkGate('commit', {}, rels, legacy, commitCtx([]));
  assert.ok(!legacy.some((f) => f.code === 'G23'));
});

test('unknown gate → still throws', () => {
  assert.throws(
    () => checkGate('nope', {}, rels, [], commitCtx([])),
    /unknown gate: nope/,
  );
});

// --- plan gate: scale light 축약 계약 ---
// light의 유일한 발동 신호는 blueprint index.md의 bouncer.scale이다.
const LIGHT_READY_BODY = `# Tasks

## Goal & intent
Ship login validation.

## Touch
- \`src/auth/\`
- \`test/auth/\`

## Checklist
- [ ] implement validateLogin
`;

function lightPlanDocs(body, tasksExtra = {}) {
  return {
    epicIndex: doc('approved'),
    blueprintIndex: doc('approved', { scale: 'light' }),
    tasks: doc('ready', {
      graph: { suggested_paths: ['src/'], basis: 'manual: src/' },
      affected_paths: ['src/auth/login.js', 'test/auth/login.test.js'],
      ...tasksExtra,
    }, body),
  };
}

test('plan gate on scale light → passes without a context-review document', () => {
  const failures = [];
  checkGate('plan', lightPlanDocs(LIGHT_READY_BODY), rels, failures);
  assert.deepStrictEqual(failures, []);
});

test('scale light → keeps G5 identical to full', () => {
  // G5 — 빈 affected_paths는 light에서도 통과하지 못한다. G4는 결번이라 내지 않는다.
  const bare = {
    epicIndex: doc('approved'),
    blueprintIndex: doc('approved', { scale: 'light' }),
    tasks: doc('ready', { affected_paths: [] }, LIGHT_READY_BODY),
  };
  const bareFailures = [];
  checkGate('plan', bare, rels, bareFailures);
  assert.ok(!bareFailures.some((f) => f.code === 'G4'));
  assert.ok(bareFailures.some((f) => f.code === 'G5'));
});

test('an unknown scale value → is not treated as light', () => {
  // light였다면 commit task가 둘일 때 G20 light 메시지가 나온다. 알 수 없는 scale은 full과 같다.
  const messages = g20Messages(scopedPlanDocs([
    scopedCommit('001'), scopedCommit('002'), scopedTerminal('003', ['TASKS-001', 'TASKS-002']),
  ], { scale: 'tiny' }));
  assert.deepStrictEqual(messages, []);
});

function planTaskDoc(nnn, extra = {}, body = READY_BODY) {
  return {
    data: {
      bouncer: {
        id: `TASKS-${nnn}`,
        status: 'ready',
        graph: { suggested_paths: ['src/'], basis: 'manual: src/' },
        affected_paths: ['src/auth/login.js', 'test/auth/login.test.js'],
        ...extra,
      },
    },
    body,
    rel: `.bouncer/context/epics/001-auth/blueprints/001-login/tasks/${nnn}/tasks.md`,
  };
}

function planDocsWithTasks(taskDocs) {
  return {
    epicIndex: doc('approved'),
    blueprintIndex: doc('approved'),
    tasksDocs: taskDocs,
    contextReview: contextReviewDoc('accepted'),
  };
}

test('plan gate G19 → accepts a valid DAG and tasks without DAG fields', () => {
  const withDag = [];
  checkGate('plan', planDocsWithTasks([
    planTaskDoc('001', {
      depends_on: [],
      parallel_safe: false,
      dependency_gate: 'integrated',
    }),
    planTaskDoc('002', {
      depends_on: ['TASKS-001'],
      parallel_safe: true,
      dependency_gate: 'integrated',
    }),
  ]), rels, withDag);
  assert.deepStrictEqual(withDag.filter((f) => f.code === 'G19'), []);

  const legacy = [];
  checkGate('plan', planDocsWithTasks([
    planTaskDoc('001'),
  ]), rels, legacy);
  assert.deepStrictEqual(legacy.filter((f) => f.code === 'G19'), []);
  assert.deepStrictEqual(legacy, []);
});

test('plan gate G19 → rejects missing, self, duplicate, and cyclic dependencies', () => {
  const missing = [];
  checkGate('plan', planDocsWithTasks([
    planTaskDoc('001', { depends_on: ['TASKS-999'] }),
  ]), rels, missing);
  const missingHit = missing.find((f) => f.code === 'G19');
  assert.ok(missingHit, `expected G19 missing: ${JSON.stringify(missing)}`);
  assert.match(missingHit.message, /TASKS-999|missing|unknown/i);
  assert.match(missingHit.file, /tasks\/001\/tasks\.md$/);

  const self = [];
  checkGate('plan', planDocsWithTasks([
    planTaskDoc('001', { depends_on: ['TASKS-001'] }),
  ]), rels, self);
  const selfHit = self.find((f) => f.code === 'G19');
  assert.ok(selfHit, `expected G19 self: ${JSON.stringify(self)}`);
  assert.match(selfHit.message, /self|자기/i);
  assert.match(selfHit.file, /tasks\/001\/tasks\.md$/);

  const dup = [];
  checkGate('plan', planDocsWithTasks([
    planTaskDoc('001'),
    planTaskDoc('002', { depends_on: ['TASKS-001', 'TASKS-001'] }),
  ]), rels, dup);
  const dupHit = dup.find((f) => f.code === 'G19');
  assert.ok(dupHit, `expected G19 duplicate: ${JSON.stringify(dup)}`);
  assert.match(dupHit.message, /duplicate|중복/i);
  assert.match(dupHit.file, /tasks\/002\/tasks\.md$/);

  const cycle = [];
  checkGate('plan', planDocsWithTasks([
    planTaskDoc('001', { depends_on: ['TASKS-002'] }),
    planTaskDoc('002', { depends_on: ['TASKS-001'] }),
  ]), rels, cycle);
  const cycleHit = cycle.find((f) => f.code === 'G19');
  assert.ok(cycleHit, `expected G19 cycle: ${JSON.stringify(cycle)}`);
  assert.match(cycleHit.message, /cycle|순환/i);
  assert.ok(
    /tasks\/00[12]\/tasks\.md$/.test(cycleHit.file),
    `cycle failure must carry a task path: ${cycleHit.file}`,
  );
});

test('plan gate → accepts terminal verification fan-in and rejects source scope or commit successors', () => {
  const verificationBody = READY_BODY.replace(
    /## Touch[\s\S]*?## Do not touch/,
    '## Touch\n- Source changes: none; record full CI evidence only.\n\n## Do not touch',
  );
  const valid = [];
  checkGate('plan', planDocsWithTasks([
    planTaskDoc('001'),
    planTaskDoc('002'),
    planTaskDoc('003', {
      execution_kind: 'verification', affected_paths: [], scope_evidence: undefined,
      graph: undefined, depends_on: ['TASKS-001', 'TASKS-002'], parallel_safe: false,
      dependency_gate: 'integrated', verify: 'node --test',
    }, verificationBody),
  ]), rels, valid);
  assert.deepStrictEqual(valid.filter((f) => ['G4', 'G5', 'G20'].includes(f.code)), []);

  const commandBody = READY_BODY.replace(
    /## Touch[\s\S]*?## Do not touch/,
    '## Touch\n- `npm run ci` 실행\n\n## Do not touch',
  );
  const invalid = [];
  checkGate('plan', planDocsWithTasks([
    planTaskDoc('001'),
    planTaskDoc('002', {
      execution_kind: 'verification', affected_paths: [], depends_on: ['TASKS-001'],
      parallel_safe: false, dependency_gate: 'integrated', verify: 'node --test',
    }),
    planTaskDoc('003', { depends_on: ['TASKS-002'] }),
    planTaskDoc('004', {
      execution_kind: 'verification', affected_paths: [], scope_evidence: undefined,
      graph: undefined, depends_on: ['TASKS-001'], parallel_safe: false,
      dependency_gate: 'integrated', verify: 'node --test',
    }, commandBody),
  ]), rels, invalid);
  assert.ok(invalid.some((f) => f.code === 'G20' && /Touch/.test(f.message)));
  assert.ok(invalid.some((f) => f.code === 'G20' && /commit task/.test(f.message)));
  assert.ok(invalid.some((f) => f.code === 'G20' && f.message.endsWith(': npm run ci')));
});

// scoped_terminal 정책: 구현 task 전용 명령 + 단일 마지막 verification.
function scopedPlanDocs(taskDocs, { scale, policy = 'scoped_terminal', noPolicy = false } = {}) {
  return {
    ...planDocsWithTasks(taskDocs),
    blueprintIndex: doc('approved', {
      ...(noPolicy ? {} : { verification_policy: policy }),
      ...(scale === undefined ? {} : { scale }),
    }),
  };
}

function scopedCommit(nnn, extra = {}) {
  return planTaskDoc(nnn, { verify: 'node --test test/a.test.js', ...extra });
}

function scopedTerminal(nnn, dependsOn, extra = {}) {
  return planTaskDoc(nnn, {
    execution_kind: 'verification', affected_paths: [], scope_evidence: undefined,
    graph: undefined, depends_on: dependsOn, parallel_safe: false,
    dependency_gate: 'integrated', verify: 'npm test', ...extra,
  }, READY_BODY.replace(
    /## Touch[\s\S]*?## Do not touch/,
    '## Touch\nSource 변경 경로 없음.\n\n## Do not touch',
  ));
}

function g20Messages(docs) {
  const failures = [];
  checkGate('plan', docs, rels, failures);
  return failures.filter((f) => f.code === 'G20').map((f) => f.message);
}

test('plan gate scoped_terminal → accepts per-task commands with one terminal that waits for every commit', () => {
  assert.deepStrictEqual(g20Messages(scopedPlanDocs([
    scopedCommit('001'),
    scopedCommit('002', { verify: 'node --test test/b.test.js' }),
    scopedTerminal('003', ['TASKS-001', 'TASKS-002']),
  ])), []);
  // 간접 선행도 기다리는 것으로 본다.
  assert.deepStrictEqual(g20Messages(scopedPlanDocs([
    scopedCommit('001'),
    scopedCommit('002', { depends_on: ['TASKS-001'] }),
    scopedTerminal('003', ['TASKS-002']),
  ])), []);
});

test('plan gate scoped_terminal → rejects missing, empty, shell-operator and full-suite commands on commit tasks', () => {
  const missing = g20Messages(scopedPlanDocs([
    planTaskDoc('001'), scopedTerminal('002', ['TASKS-001']),
  ]));
  assert.ok(missing.some((m) => /requires its own non-empty bouncer\.verify/.test(m)), JSON.stringify(missing));
  const empty = g20Messages(scopedPlanDocs([
    scopedCommit('001', { verify: '   ' }), scopedTerminal('002', ['TASKS-001']),
  ]));
  assert.ok(empty.some((m) => /non-empty/.test(m)), JSON.stringify(empty));
  const shell = g20Messages(scopedPlanDocs([
    scopedCommit('001', { verify: 'node --test a && node --test b' }), scopedTerminal('002', ['TASKS-001']),
  ]));
  assert.ok(shell.some((m) => /single executable command/.test(m)), JSON.stringify(shell));
  const fullSuite = g20Messages(scopedPlanDocs([
    scopedCommit('001', { verify: 'npm   test' }), scopedTerminal('002', ['TASKS-001']),
  ]));
  assert.ok(fullSuite.some((m) => /terminal full-suite command/.test(m)), JSON.stringify(fullSuite));
});

test('plan gate scoped_terminal → rejects no terminal, two terminals and a terminal that skips a commit task', () => {
  const none = g20Messages(scopedPlanDocs([scopedCommit('001')]));
  assert.ok(none.some((m) => /exactly one terminal verification task, found none/.test(m)), JSON.stringify(none));
  const two = g20Messages(scopedPlanDocs([
    scopedCommit('001'), scopedTerminal('002', ['TASKS-001']), scopedTerminal('003', ['TASKS-001']),
  ]));
  assert.ok(two.some((m) => /found 2/.test(m)), JSON.stringify(two));
  const skip = g20Messages(scopedPlanDocs([
    scopedCommit('001'), scopedCommit('002'), scopedTerminal('003', ['TASKS-001']),
  ]));
  assert.ok(skip.some((m) => /must wait for commit task: TASKS-002/.test(m)), JSON.stringify(skip));
  // 검증 뒤 구현 node는 기존 topology 거절이 그대로 맡는다.
  const after = g20Messages(scopedPlanDocs([
    scopedCommit('001'), scopedTerminal('002', ['TASKS-001']), scopedCommit('003', { depends_on: ['TASKS-002'] }),
  ]));
  assert.ok(after.some((m) => /cannot precede commit task/.test(m)), JSON.stringify(after));
});

test('plan gate scoped_terminal light → needs one independent commit task plus the terminal', () => {
  assert.deepStrictEqual(g20Messages(scopedPlanDocs([
    scopedCommit('001'), scopedTerminal('002', ['TASKS-001']),
  ], { scale: 'light' })), []);
  const two = g20Messages(scopedPlanDocs([
    scopedCommit('001'), scopedCommit('002'), scopedTerminal('003', ['TASKS-001', 'TASKS-002']),
  ], { scale: 'light' }));
  assert.ok(two.some((m) => /one independent commit task/.test(m)), JSON.stringify(two));
  const dependent = g20Messages(scopedPlanDocs([
    scopedCommit('001', { depends_on: ['TASKS-002'] }), scopedCommit('002'),
    scopedTerminal('003', ['TASKS-001']),
  ], { scale: 'light' }));
  assert.ok(dependent.some((m) => /one independent commit task/.test(m)), JSON.stringify(dependent));
});

// check-doc-shape가 명시 문서를 받는 verify: 종류/경로 계약이 없는 문서는 실행 전에 G20으로 막는다.
const DOC_SHAPE_REPO = path.join(__dirname, '..');
function docShapeVerify(args, script = 'scripts/check-doc-shape.js') {
  return `node ${script} ${args}`.trim();
}

function docShapeScoped(verify) {
  return scopedPlanDocs([scopedCommit('001', { verify }), scopedTerminal('002', ['TASKS-001'])]);
}

function docShapeG20(verify, { draft = false, repoRoot = DOC_SHAPE_REPO } = {}) {
  const failures = [];
  const docs = docShapeScoped(verify);
  if (draft) {
    const { checkPlanDraft } = require('../scripts/lib/validate-gates');
    checkPlanDraft(docs, rels, failures, { repoRoot: undefined });
  } else {
    checkGate('plan', docs, rels, failures, { repoRoot });
  }
  return failures.filter((f) => f.code === 'G20' && /check-doc-shape/.test(f.message));
}

test('scoped_terminal verify with an uncontracted check-doc-shape target → G20 on the task naming the path, same for draft', () => {
  const task = '.bouncer/context/epics/001-auth/blueprints/001-login/tasks/001/tasks.md';
  const gate = docShapeG20(docShapeVerify('docs/workflow.md'));
  assert.strictEqual(gate.length, 1, JSON.stringify(gate));
  assert.strictEqual(gate[0].file, task);
  assert.ok(gate[0].message.includes('docs/workflow.md'), gate[0].message);
  // draft는 repoRoot 없이도 같은 상대 경로 진단을 낸다.
  const draft = docShapeG20(docShapeVerify('docs/workflow.md'), { draft: true });
  assert.deepStrictEqual(draft, gate);
});

test('scoped_terminal verify with kind or path-contract targets → accepted, mixed with an uncontracted one → rejected', () => {
  assert.deepStrictEqual(docShapeG20(docShapeVerify('agents/bouncer-reviewer.md')), []);
  assert.deepStrictEqual(
    docShapeG20(docShapeVerify('skills/bouncer-run/references/drive-metrics.md')), [],
  );
  assert.deepStrictEqual(docShapeG20(docShapeVerify(
    'agents/bouncer-reviewer.md skills/bouncer-run/references/drive-metrics.md',
  )), []);
  const mixed = docShapeG20(docShapeVerify('agents/bouncer-reviewer.md docs/workflow.md notes/x.md'));
  assert.strictEqual(mixed.length, 1, JSON.stringify(mixed));
  assert.ok(mixed[0].message.includes('docs/workflow.md') && mixed[0].message.includes('notes/x.md'));
  assert.ok(!mixed[0].message.includes('agents/bouncer-reviewer.md'), mixed[0].message);
});

test('check-doc-shape verify spellings → ./ absolute script and quoted file args resolve to the same target', () => {
  const abs = path.join(DOC_SHAPE_REPO, 'scripts', 'check-doc-shape.js');
  assert.strictEqual(docShapeG20(docShapeVerify('docs/workflow.md', './scripts/check-doc-shape.js')).length, 1);
  assert.strictEqual(docShapeG20(docShapeVerify('docs/workflow.md', abs)).length, 1);
  assert.strictEqual(docShapeG20(docShapeVerify('"docs/workflow.md"')).length, 1);
  assert.strictEqual(docShapeG20(docShapeVerify('./docs/workflow.md')).length, 1);
  assert.deepStrictEqual(docShapeG20(docShapeVerify('"./agents/bouncer-reviewer.md"', abs)), []);
  assert.deepStrictEqual(
    docShapeG20(docShapeVerify(path.join(DOC_SHAPE_REPO, 'agents', 'bouncer-reviewer.md'))), [],
  );
  // 저장소 밖 절대 경로는 계약이 없다.
  assert.strictEqual(docShapeG20(docShapeVerify('/tmp/outside.md')).length, 1);
});

test('check-doc-shape verify without explicit files or with other commands → no new G20', () => {
  assert.deepStrictEqual(docShapeG20(docShapeVerify('')), []);
  assert.deepStrictEqual(docShapeG20('node --test test/doc-shape-cli.test.js docs/workflow.md'), []);
  assert.deepStrictEqual(docShapeG20('npm run lint:docs docs/workflow.md'), []);
  assert.deepStrictEqual(docShapeG20('node other/check-doc-shape.js docs/workflow.md'), []);
  // 다른 argv 위반은 기존 단일 명령 G20이 맡고 새 진단은 중복하지 않는다.
  assert.deepStrictEqual(docShapeG20(`${docShapeVerify('docs/workflow.md')} && node --test`), []);
});

test('check-doc-shape verify and the checker CLI → agree on which real files have a contract', () => {
  const { runCli } = require('../scripts/check-doc-shape');
  const quiet = { write() {} };
  const files = [
    'agents/bouncer-reviewer.md',
    'skills/bouncer-run/references/drive-metrics.md',
    'skills/bouncer-plan/SKILL.md',
    'CHANGELOG.md',
    'package.json',
  ];
  for (const file of files) {
    const cliAccepts = runCli([file], { cwd: DOC_SHAPE_REPO, stdout: quiet, stderr: quiet }) === 0;
    const gateAccepts = docShapeG20(docShapeVerify(file)).length === 0;
    assert.strictEqual(gateAccepts, cliAccepts, file);
  }
});

test('legacy blueprint with an uncontracted check-doc-shape verify → no G20', () => {
  const failures = [];
  const docs = scopedPlanDocs([scopedCommit('001', { verify: docShapeVerify('docs/workflow.md') })], {
    noPolicy: true,
  });
  checkGate('plan', docs, rels, failures, { repoRoot: DOC_SHAPE_REPO });
  assert.deepStrictEqual(failures.filter((f) => f.code === 'G20'), []);
});

test('plan gate verification_policy → absent stays legacy and an unknown value is rejected', () => {
  // 표식 없는 기존 계획: 명령 없는 단일 task도 topology 변경 없이 통과한다.
  assert.deepStrictEqual(g20Messages(scopedPlanDocs([planTaskDoc('001')], { noPolicy: true })), []);
  assert.deepStrictEqual(g20Messages(scopedPlanDocs([
    planTaskDoc('001'), planTaskDoc('002'),
  ], { noPolicy: true, scale: 'light' })), []);
  for (const policy of ['legacy', 'scoped', null]) {
    const messages = g20Messages(scopedPlanDocs([scopedCommit('001'), scopedTerminal('002', ['TASKS-001'])], { policy }));
    assert.ok(messages.some((m) => /verification_policy must be/.test(m)), `${policy}: ${JSON.stringify(messages)}`);
  }
});

test('checkPlanDraft with scoped_terminal → reports the same G20 as the plan gate', () => {
  const { checkPlanDraft } = require('../scripts/lib/validate-gates');
  const failures = [];
  checkPlanDraft(scopedPlanDocs([planTaskDoc('001', { status: 'draft' })]), rels, failures, {});
  assert.ok(failures.some((f) => f.code === 'G20' && /bouncer\.verify/.test(f.message)), JSON.stringify(failures));
  assert.ok(failures.some((f) => f.code === 'G20' && /terminal verification/.test(f.message)));
});

// --- plan draft 검사: context review 전 status 무관 task 검사 ---
function draftPlanDocs(taskDocs, blueprintExtra = {}) {
  return {
    epicIndex: doc('draft'),
    blueprintIndex: doc('draft', blueprintExtra),
    tasksDocs: taskDocs,
  };
}

function draftTaskDoc(nnn, extra = {}, body = READY_BODY) {
  return planTaskDoc(nnn, { status: 'draft', ...extra }, body);
}

function draftCodes(docs) {
  const { checkPlanDraft } = require('../scripts/lib/validate-gates');
  const failures = [];
  checkPlanDraft(docs, rels, failures, {});
  return failures.map((f) => f.code);
}

function assertNoStatusCodes(codes, label) {
  for (const code of ['G1', 'G2', 'G3']) {
    assert.ok(!codes.includes(code), `${label}: ${code} must not appear in ${JSON.stringify(codes)}`);
  }
}

test('checkPlanDraft → reports G5, G19, G20 without status codes', () => {
  const commandBody = READY_BODY.replace(
    /## Touch[\s\S]*?## Do not touch/,
    '## Touch\n- `npm run ci`\n\n## Do not touch',
  );
  const cases = [
    { code: 'G5', tasks: [draftTaskDoc('001', { affected_paths: [] })] },
    { code: 'G19', tasks: [draftTaskDoc('001', { depends_on: ['TASKS-001'] })] },
    {
      code: 'G20',
      tasks: [
        draftTaskDoc('001'),
        draftTaskDoc('002', {
          execution_kind: 'verification', affected_paths: [], depends_on: ['TASKS-001'],
          parallel_safe: false, dependency_gate: 'integrated', verify: 'node --test',
        }, commandBody),
      ],
    },
  ];
  for (const { code, tasks } of cases) {
    const codes = draftCodes(draftPlanDocs(tasks));
    assert.ok(codes.includes(code), `${code} expected in ${JSON.stringify(codes)}`);
    assertNoStatusCodes(codes, code);
  }
});

// G32 fixture: 선행 선언을 가진 blueprint index만 있는 임시 저장소와 호출을 기록하는 Git seam.
const G32_SELF = '.bouncer/context/epics/e/blueprints/self';
const G32_PRE = '.bouncer/context/epics/e/blueprints/earlier';
const G32_SHA = 'c'.repeat(40);

function g32Repo({ declare = true, preExists = true } = {}) {
  const repo = fs.mkdtempSync(path.join(os.tmpdir(), 'bouncer-g32-'));
  const write = (dir, lines) => {
    fs.mkdirSync(path.join(repo, dir), { recursive: true });
    fs.writeFileSync(path.join(repo, dir, 'index.md'), `---\nbouncer:\n  status: approved\n${lines}---\n# x\n`);
  };
  const decl = declare
    ? `  prerequisites:\n    - blueprint: ${G32_PRE}\n      merged_commit: ${G32_SHA}\n` : '';
  write(G32_SELF, decl);
  if (preExists) write(G32_PRE, '');
  return repo;
}

function g32Exec({ object = 0, ancestor = 0 } = {}) {
  const calls = [];
  const exec = (args) => {
    calls.push(args);
    const status = args[0] === 'rev-parse' ? object : ancestor;
    return { status, stdout: '', stderr: '' };
  };
  return { exec, calls };
}

function g32Run(kind, repo, git) {
  const { checkPlanDraft } = require('../scripts/lib/validate-gates');
  const failures = [];
  const ctx = { repoRoot: repo, blueprintDir: G32_SELF, deps: { exec: git.exec } };
  if (kind === 'draft') {
    checkPlanDraft(draftPlanDocs([draftTaskDoc('001')]), rels, failures, ctx);
  } else {
    checkGate('plan', planDocsWithTasks([planTaskDoc('001', { status: 'ready' })]), rels, failures, ctx);
  }
  return failures.filter((f) => f.code === 'G32');
}

for (const kind of ['draft', 'plan']) {
  test(`${kind} with a prerequisite merge result outside the checkout → G32 on the blueprint index`, () => {
    const out = g32Run(kind, g32Repo(), g32Exec({ ancestor: 1 }));
    assert.strictEqual(out.length, 1);
    assert.strictEqual(out[0].file, rels.blueprintIndex);
    assert.ok(out[0].message.includes(G32_PRE) && out[0].message.includes(G32_SHA));
  });

  test(`${kind} with a missing prerequisite blueprint or git lookup error → G32 per cause`, () => {
    assert.strictEqual(g32Run(kind, g32Repo({ preExists: false }), g32Exec()).length, 1);
    assert.strictEqual(g32Run(kind, g32Repo(), g32Exec({ object: 1 })).length, 1);
    assert.strictEqual(g32Run(kind, g32Repo(), g32Exec({ ancestor: 128 })).length, 1);
  });

  test(`${kind} with a merged prerequisite or no declaration → no G32 and no git call without declaration`, () => {
    assert.deepStrictEqual(g32Run(kind, g32Repo(), g32Exec()), []);
    const git = g32Exec({ ancestor: 1 });
    assert.deepStrictEqual(g32Run(kind, g32Repo({ declare: false }), git), []);
    assert.deepStrictEqual(git.calls, []);
  });
}

test('G32 failure through the hint table → carries the prerequisite recovery next', () => {
  const { withGateFailureHints } = require('../scripts/lib/validate');
  const res = withGateFailureHints({
    ok: false, failures: [{ code: 'G32', message: 'declared prerequisite is not ready: x', file: 'bp/index.md' }],
  });
  assert.ok(res.failures[0].next.includes('bouncer.prerequisites'));
  assert.deepStrictEqual(res.gates.map((g) => g.gate), ['freshness-approval']);
});

test('plan gate → keeps per-task failure order G3 then task checks', () => {
  const docs = planDocsWithTasks([
    planTaskDoc('001', { status: 'draft', affected_paths: [] }),
    planTaskDoc('002', { status: 'draft', affected_paths: [] }),
  ]);
  const failures = [];
  checkGate('plan', docs, rels, failures);
  const codes = failures.map((f) => f.code).filter((c) => !['G1', 'G2'].includes(c));
  assert.deepStrictEqual(codes, ['G3', 'G5', 'G3', 'G5']);
});

function blueprintReviewIndex(extra = {}) {
  return {
    data: { bouncer: { status: 'approved', review_scope: 'blueprint', ...extra } },
    rel: rels.blueprintIndex,
    body: '',
  };
}

const G21_FINDINGS_BODY = `# Review

## Findings
(none)
`;

function g21ReviewDoc(status, review = {}, body = G21_FINDINGS_BODY) {
  return {
    data: { bouncer: { status, review } },
    rel: rels.review,
    body,
  };
}

function g21ValidRounds() {
  return [roundEntry({ target: { head: 'deadbeef' } })];
}

function finalizeG21(docs, extraDeps = {}) {
  const failures = [];
  checkGate('finalize', {
    tasksDocs: g16VerifiedTasks(['001']),
    explain: explainDoc([compEntry()]),
    blueprintIndex: blueprintReviewIndex(),
    ...docs,
  }, rels, failures, {
    ...G16_CTX,
    deps: { ...G16_CTX.deps, ...extraDeps },
  });
  return failures;
}

test('finalize G21 with blueprint review missing → fails', () => {
  const failures = finalizeG21({});
  assert.ok(failures.some((f) => (
    f.code === 'G21' && f.message === 'blueprint review missing' && f.file === rels.review
  )), JSON.stringify(failures));
});

test('finalize G21: pending → is not accepted', () => {
  const failures = finalizeG21({
    review: g21ReviewDoc('pending', { rounds: g21ValidRounds() }),
  });
  assert.ok(failures.some((f) => f.code === 'G21' && f.message === 'blueprint review not accepted'));
});

test('finalize G21 with review.required false → still not accepted', () => {
  const failures = finalizeG21({
    review: g21ReviewDoc('pending', { required: false, rounds: g21ValidRounds() }),
  });
  assert.ok(failures.some((f) => f.code === 'G21' && f.message === 'blueprint review not accepted'));
});

test('finalize G21 with accepted review without rounds → fails', () => {
  const failures = finalizeG21({ review: g21ReviewDoc('accepted', {}) });
  assert.ok(failures.some((f) => f.code === 'G21' && f.message === 'blueprint review has no rounds'));
});

test('finalize G21 with accepted review and empty rounds → fails', () => {
  const failures = finalizeG21({ review: g21ReviewDoc('accepted', { rounds: [] }) });
  assert.ok(failures.some((f) => f.code === 'G21' && f.message === 'blueprint review has no rounds'));
});

test('finalize G21 with last round missing target.head → fails', () => {
  const failures = finalizeG21({
    review: g21ReviewDoc('accepted', { rounds: [roundEntry({ target: { base: 'abc' } })] }),
  });
  assert.ok(failures.some((f) => f.code === 'G21' && f.message === 'blueprint review has no rounds'));
});

test('finalize G21 with accepted review and valid rounds → has no G21', () => {
  const failures = finalizeG21({
    review: g21ReviewDoc('accepted', { rounds: g21ValidRounds() }),
  });
  assert.ok(!failures.some((f) => f.code === 'G21'), JSON.stringify(failures));
});

function g21ModeRounds(modes) {
  return modes.map((mode, i) => roundEntry({
    round: i + 1,
    mode,
    previous_finding_ids: [],
    target: { base: 'base-sha', head: 'deadbeef' },
    perspectives: [{ name: 'combined', target_head: 'deadbeef' }],
  }));
}

function g21SequenceFailures(modes) {
  const failures = finalizeG21({
    review: g21ReviewDoc('accepted', { rounds: g21ModeRounds(modes), findings: [] }),
  });
  return failures.filter((f) => f.code === 'G21' && /rounds sequence invalid/.test(f.message));
}

test('finalize G21 with rounds discovery,delta,delta → has no sequence failure', () => {
  assert.deepEqual(g21SequenceFailures(['discovery', 'delta', 'delta']), []);
});

test('finalize G21 with four rounds discovery,delta,delta,delta → no G21', () => {
  assert.equal(g21SequenceFailures(['discovery', 'delta', 'delta', 'delta']).length, 0);
});

test('finalize G21 with rounds discovery,delta,critical_recovery,delta → has no sequence failure', () => {
  assert.deepEqual(g21SequenceFailures(['discovery', 'delta', 'critical_recovery', 'delta']), []);
});

test('finalize G21 with rounds discovery,delta,delta,critical_recovery,delta → no G21', () => {
  assert.equal(
    g21SequenceFailures(['discovery', 'delta', 'delta', 'critical_recovery', 'delta']).length, 0,
  );
});

function g21FindingFailures(finding) {
  const failures = finalizeG21({
    review: g21ReviewDoc('accepted', { rounds: g21ModeRounds(['discovery']), findings: [finding] }),
  });
  return failures.filter((f) => f.code === 'G21');
}

test('finalize G21 with deferred must_fix and note in accepted review → has no G21', () => {
  assert.deepEqual(g21FindingFailures(convergenceFinding({ status: 'deferred', note: 'carry forward' })), []);
});

test('finalize G21 with deferred must_fix without note in accepted review → no G21', () => {
  assert.deepStrictEqual(g21FindingFailures(convergenceFinding({ status: 'deferred' })), []);
});

test('finalize G21 with accepted_risk must_fix and note in accepted review → has no G21', () => {
  assert.deepEqual(g21FindingFailures(convergenceFinding({
    status: 'accepted', accepted_risk: true, note: 'user accepted the risk',
  })), []);
});

test('finalize G21 with accepted must_fix without accepted_risk → is accepted with open must_fix', () => {
  const failures = g21FindingFailures(convergenceFinding({ status: 'accepted', note: 'n' }));
  assert.ok(failures.some((f) => /accepted with open must_fix F1/.test(f.message)), JSON.stringify(failures));
});

test('finalize G21 with open must_fix in accepted review → is accepted with open must_fix', () => {
  const failures = g21FindingFailures(convergenceFinding({ status: 'open' }));
  assert.ok(failures.some((f) => /accepted with open must_fix F1|open in accepted review/.test(f.message)), JSON.stringify(failures));
});

function briefG21Failures(contract, review) {
  return finalizeG21({
    blueprintIndex: blueprintReviewIndex({ review_contract: contract }),
    review: g21ReviewDoc('accepted', review),
  }).filter((f) => f.code === 'G21');
}

test('finalize G21 with brief contract and accepted discovery,delta → has no G21', () => {
  const failures = briefG21Failures('brief', {
    rounds: g21ModeRounds(['discovery', 'delta']),
    findings: [convergenceFinding({ brief_clause: 'tasks/001 Interface', fingerprint: 'correctness:tasks/001 interface:src/a.ts#run' })],
  });
  assert.deepEqual(failures, []);
});

test('finalize G21 with brief contract and deferred must_fix with note → is accepted with open must_fix', () => {
  const failures = briefG21Failures('brief', {
    rounds: g21ModeRounds(['discovery']),
    findings: [convergenceFinding({ status: 'deferred', note: 'carry forward' })],
  });
  assert.ok(failures.some((f) => /accepted with open must_fix F1/.test(f.message)), JSON.stringify(failures));
});

test('finalize G21 with brief contract and accepted_risk must_fix with note → has no G21', () => {
  const failures = briefG21Failures('brief', {
    rounds: g21ModeRounds(['discovery']),
    findings: [convergenceFinding({ status: 'accepted', accepted_risk: true, note: 'user accepted the risk' })],
  });
  assert.deepEqual(failures, []);
});

test('finalize G21 with review_contract other → is review-contract-invalid', () => {
  const failures = briefG21Failures('other', { rounds: g21ModeRounds(['discovery']), findings: [] });
  assert.ok(
    failures.some((f) => f.message === 'review-contract-invalid: review_contract must be brief'),
    JSON.stringify(failures),
  );
});

test('execute gate G14 with task rounds discovery,delta,delta → no G14', () => {
  const failures = executeReviewFailures({
    findings: [],
    rounds: g21ModeRounds(['discovery', 'delta', 'delta']).map((r) => ({
      ...r, perspectives: [{ name: 'correctness_tests', target_head: 'deadbeef' }],
    })),
  });
  assert.deepStrictEqual(failures, []);
});

test('finalize G21 stale: no ledger → skips git and G21', () => {
  let execCalls = 0;
  const failures = finalizeG21({
    review: g21ReviewDoc('accepted', { rounds: g21ValidRounds() }),
  }, {
    readCoordinatorLedger: () => null,
    exec: () => {
      execCalls += 1;
      return { status: 0, stdout: '', stderr: '' };
    },
  });
  assert.strictEqual(execCalls, 0);
  assert.ok(!failures.some((f) => f.code === 'G21'), JSON.stringify(failures));
});

test('finalize G21 stale check with merge-base status 1 → reports it', () => {
  const failures = finalizeG21({
    review: g21ReviewDoc('accepted', { rounds: g21ValidRounds() }),
  }, {
    readCoordinatorLedger: () => ({ blueprint: G16_CTX.blueprintDir }),
    exec: (args) => {
      if (args[0] === 'merge-base') return { status: 1, stdout: '', stderr: '' };
      return { status: 0, stdout: '', stderr: '' };
    },
  });
  assert.ok(failures.some((f) => f.code === 'G21' && f.message === 'blueprint review is stale'));
});

test('finalize G21 stale check with a non-governance diff → reports it', () => {
  const failures = finalizeG21({
    review: g21ReviewDoc('accepted', { rounds: g21ValidRounds() }),
  }, {
    readCoordinatorLedger: () => ({ blueprint: G16_CTX.blueprintDir }),
    exec: (args) => {
      if (args[0] === 'merge-base') return { status: 0, stdout: '', stderr: '' };
      if (args[0] === 'diff') return { status: 0, stdout: 'src/a.ts\n', stderr: '' };
      return { status: 0, stdout: '', stderr: '' };
    },
  });
  assert.ok(failures.some((f) => f.code === 'G21' && f.message === 'blueprint review is stale'));
});

test('finalize G21 stale: only .bouncer/ diff → is fresh', () => {
  const failures = finalizeG21({
    review: g21ReviewDoc('accepted', { rounds: g21ValidRounds() }),
  }, {
    readCoordinatorLedger: () => ({ blueprint: G16_CTX.blueprintDir }),
    exec: (args) => {
      if (args[0] === 'merge-base') return { status: 0, stdout: '', stderr: '' };
      if (args[0] === 'diff') return { status: 0, stdout: '.bouncer/x.md\n', stderr: '' };
      return { status: 0, stdout: '', stderr: '' };
    },
  });
  assert.ok(!failures.some((f) => f.code === 'G21'), JSON.stringify(failures));
});

test('finalize G21 stale: merge-base failure → reports stderr', () => {
  const failures = finalizeG21({
    review: g21ReviewDoc('accepted', { rounds: g21ValidRounds() }),
  }, {
    readCoordinatorLedger: () => ({ blueprint: G16_CTX.blueprintDir }),
    exec: (args) => {
      if (args[0] === 'merge-base') {
        return { status: 128, stdout: '', stderr: 'fatal: bad object\n' };
      }
      return { status: 0, stdout: '', stderr: '' };
    },
  });
  assert.ok(failures.some((f) => (
    f.code === 'G21'
    && f.message === 'blueprint review stale check failed (fatal: bad object)'
  )), JSON.stringify(failures));
});

const leftoverReviewFinding = {
  id: 'F2', severity: 'major', status: 'accepted',
};

test('blueprint review mode execute/commit when task review.md is absent → skip G8', () => {
  const verification = passingVerificationDoc();
  const docs = {
    blueprintIndex: blueprintReviewIndex(),
    tasks: doc('verified'),
    verification,
  };
  const executeFailures = [];
  checkGate('execute', docs, rels, executeFailures, { deps: ledgerDeps(verification) });
  assert.ok(!executeFailures.some((f) => f.code === 'G8'), JSON.stringify(executeFailures));

  const noReviewUnit = {
    number: 1,
    dir: '.bouncer/context/epics/001-auth/blueprints/001-login/tasks/001',
    tasks: doc('verified', { affected_paths: ['src/auth/'] }),
    verification,
  };
  const commitFailures = [];
  checkGate('commit', docs, rels, commitFailures, {
    ...commitCtx(),
    taskUnit: noReviewUnit,
    deps: {
      ...commitCtx().deps,
      readVerifyLedger: () => matchingLedger(verification),
    },
  });
  assert.ok(!commitFailures.some((f) => f.code === 'G8'), JSON.stringify(commitFailures));
});

test('blueprint review mode execute/commit with leftover task review.md → ignore it for G8 and G14', () => {
  const verification = passingVerificationDoc();
  const docs = {
    blueprintIndex: blueprintReviewIndex(),
    tasks: doc('verified'),
    verification,
    review: doc('pending', {
      review: { findings: [leftoverReviewFinding] },
    }, REVIEW_BODY_OK),
  };
  const executeFailures = [];
  checkGate('execute', docs, rels, executeFailures, { deps: ledgerDeps(verification) });
  assert.ok(!executeFailures.some((f) => f.code === 'G8' || f.code === 'G14'), JSON.stringify(executeFailures));

  const commitFailures = [];
  checkGate('commit', docs, rels, commitFailures, {
    ...commitCtx(),
    taskUnit: {
      ...commitReadyUnit(),
      review: docs.review,
    },
  });
  assert.ok(!commitFailures.some((f) => f.code === 'G8' || f.code === 'G14'), JSON.stringify(commitFailures));
});

test('without review_scope, missing task review.md → is still S17 even with root review.md', () => {
  const repo = mkRepo();
  writeDoc(repo, '.bouncer/context/epics/001-auth/index.md', epicDoc());
  writeDoc(repo, `${BP_REL}/index.md`, {
    ...blueprintDoc(), bouncer: { ...blueprintDoc().bouncer, attribution: 'fixture' },
  });
  writeDoc(repo, `${BP_REL}/review.md`, {
    type: 'bouncer.review',
    title: 'Root review',
    description: 'legacy root',
    resource: `${BP_REL}/review.md`,
    tags: ['bouncer'],
    timestamp: '2026-07-01T00:00:00+09:00',
    bouncer: { id: 'REVIEW-001', epic_id: '001', blueprint_id: '001', status: 'pending' },
  });
  writeDoc(repo, `${BP_REL}/tasks/001/tasks.md`, planReadyTasks(), planReadyTasksBody());
  writeDoc(repo, `${BP_REL}/tasks/001/verification.md`, {
    type: 'bouncer.verification',
    title: 'v',
    description: 'v',
    resource: `${BP_REL}/tasks/001/verification.md`,
    tags: ['bouncer'],
    timestamp: '2026-07-01T00:00:00+09:00',
    bouncer: { id: 'VERIFY-001', epic_id: '001', blueprint_id: '001', status: 'pending' },
  });
  const res = validateBlueprint({ repoRoot: repo, blueprintDir: BP_REL });
  assert.ok(res.failures.some((f) => f.code === 'S17' && /review\.md/.test(f.message)), JSON.stringify(res.failures));
});

test('without review_scope, pending task review → is still G8', () => {
  const docs = {
    tasks: doc('verified'),
    verification: passingVerificationDoc(),
    review: doc('pending'),
  };
  const failures = [];
  checkGate('execute', docs, rels, failures, { deps: ledgerDeps(docs.verification) });
  assert.ok(failures.some((f) => f.code === 'G8'));
});

test('without review_scope, accepted finding without note → no G14', () => {
  const docs = {
    tasks: doc('verified'),
    verification: passingVerificationDoc(),
    review: doc('accepted', {
      review: { findings: [leftoverReviewFinding] },
    }, REVIEW_BODY_OK),
  };
  const failures = [];
  checkGate('execute', docs, rels, failures, { deps: ledgerDeps(docs.verification) });
  assert.ok(!failures.some((f) => f.code === 'G14'));
});

function g24TaskFixture(repo) {
  writeDoc(repo, `${BP_REL}/tasks/001/tasks.md`, unitTasksData(
    '001', 'verified', `${BP_REL}/tasks/001/tasks.md`,
  ), planReadyTasksBody());
}

function g24ExecuteCtx({ readApprovalSnapshot, coordinatorLedgerFor = () => null, repoRoot }) {
  const docs = executeDocs();
  return {
    docs,
    ctx: {
      repoRoot,
      blueprintDir: BP_REL,
      deps: {
        ...ledgerDeps(docs.verification),
        readApprovalSnapshot,
        coordinatorLedgerFor,
      },
    },
  };
}

test('execute and commit G24 with changed parts, unreadable snapshots, and skips → detect each case', () => {
  const changedRepo = mkRepo();
  g24TaskFixture(changedRepo);
  const stale = {
    ok: true,
    snapshot: {
      digest: 'stale',
      parts: { 'TASKS-001.affected_paths': 'old' },
    },
  };
  const executeChanged = [];
  const { docs: executeDocsForG24, ctx: executeChangedCtx } = g24ExecuteCtx({
    repoRoot: changedRepo,
    readApprovalSnapshot: () => stale,
  });
  checkGate('execute', executeDocsForG24, rels, executeChanged, executeChangedCtx);
  assert.ok(executeChanged.some(
    (f) => f.code === 'G24' && /approved scope changed after activation/.test(f.message)
      && /TASKS-001\.affected_paths/.test(f.message),
  ));

  const commitChanged = [];
  const commitChangedCtx = commitCtx([]);
  commitChangedCtx.repoRoot = changedRepo;
  commitChangedCtx.deps.readApprovalSnapshot = () => stale;
  commitChangedCtx.deps.coordinatorLedgerFor = () => null;
  checkGate('commit', {}, rels, commitChanged, commitChangedCtx);
  assert.ok(commitChanged.some(
    (f) => f.code === 'G24' && /approved scope changed after activation/.test(f.message)
      && /TASKS-001\.affected_paths/.test(f.message),
  ));

  const unreadablePath = '/tmp/bouncer-approvals/001/001.json';
  const executeUnreadable = [];
  const { docs: executeUnreadableDocs, ctx: executeUnreadableCtx } = g24ExecuteCtx({
    repoRoot: mkRepo(),
    readApprovalSnapshot: () => ({ ok: false, path: unreadablePath }),
  });
  checkGate('execute', executeUnreadableDocs, rels, executeUnreadable, executeUnreadableCtx);
  assert.ok(executeUnreadable.some(
    (f) => f.code === 'G24' && /approval snapshot is unreadable/.test(f.message)
      && f.message.includes(unreadablePath),
  ));
  const commitUnreadable = [];
  const commitUnreadableCtx = commitCtx([]);
  commitUnreadableCtx.deps.readApprovalSnapshot = () => ({ ok: false, path: unreadablePath });
  commitUnreadableCtx.deps.coordinatorLedgerFor = () => null;
  checkGate('commit', {}, rels, commitUnreadable, commitUnreadableCtx);
  assert.ok(commitUnreadable.some(
    (f) => f.code === 'G24' && /approval snapshot is unreadable/.test(f.message)
      && f.message.includes(unreadablePath),
  ));

  const executeSkipFile = [];
  const { docs: executeSkipDocs, ctx: executeSkipCtx } = g24ExecuteCtx({
    repoRoot: mkRepo(),
    readApprovalSnapshot: () => null,
  });
  checkGate('execute', executeSkipDocs, rels, executeSkipFile, executeSkipCtx);
  assert.ok(!executeSkipFile.some((f) => f.code === 'G24'));
  const commitSkipFile = [];
  const commitSkipFileCtx = commitCtx([]);
  commitSkipFileCtx.deps.readApprovalSnapshot = () => null;
  checkGate('commit', {}, rels, commitSkipFile, commitSkipFileCtx);
  assert.ok(!commitSkipFile.some((f) => f.code === 'G24'));

  const executeSkipCoord = [];
  const { docs: executeCoordDocs, ctx: executeCoordCtx } = g24ExecuteCtx({
    repoRoot: changedRepo,
    readApprovalSnapshot: () => stale,
    coordinatorLedgerFor: () => ({ blueprint: BP_REL }),
  });
  checkGate('execute', executeCoordDocs, rels, executeSkipCoord, executeCoordCtx);
  assert.ok(!executeSkipCoord.some((f) => f.code === 'G24'));
  const commitSkipCoord = [];
  const commitSkipCoordCtx = commitCtx([]);
  commitSkipCoordCtx.deps.readApprovalSnapshot = () => stale;
  commitSkipCoordCtx.deps.coordinatorLedgerFor = () => ({ blueprint: BP_REL });
  checkGate('commit', {}, rels, commitSkipCoord, commitSkipCoordCtx);
  assert.ok(!commitSkipCoord.some((f) => f.code === 'G24'));
});


test('execute gate G14 → rejects an open advisory finding in an accepted review', () => {
  const failures = executeReviewFailures({
    findings: [{ id: 'F1', severity: 'minor', status: 'open', actionability: 'advisory' }],
  });
  assert.ok(failures.some((f) => /finding F1 open in accepted review/.test(f.message)), JSON.stringify(failures));
});

test('finalize G21 → rejects an open finding in an accepted blueprint review', () => {
  const failures = finalizeG21({
    review: g21ReviewDoc('accepted', {
      findings: [{ id: 'F1', severity: 'minor', status: 'open', actionability: 'advisory' }],
    }),
  });
  assert.ok(failures.some((f) => f.code === 'G21' && /finding F1 open in accepted review/.test(f.message)), JSON.stringify(failures));
});

// ---- execute delta round: reviewer 하나 규칙 (perspective 수) ----

test('execute G14: 관점 2개 delta round → G14 없음', () => {
  const head = 'head-sha';
  const findings = [convergenceFinding({
    status: 'resolved', first_seen_round: 1, last_seen_round: 2,
  })];
  const failures = executeReviewFailures({
    findings,
    rounds: [
      convergenceRound(),
      convergenceRound({
        round: 2,
        mode: 'delta',
        previous_finding_ids: ['F1'],
        new: 0,
        resolved: 1,
        regressed: 0,
        perspectives: [
          { name: 'spec_scope', target_head: head },
          { name: 'security', target_head: head },
        ],
      }),
    ],
  });
  assert.deepStrictEqual(failures, []);
});

test('finalize G21: blueprint root review의 관점 2개 delta round → G21 없음', () => {
  const head = 'head-sha';
  const failures = finalizeG21({
    review: g21ReviewDoc('accepted', {
      findings: [convergenceFinding({
        status: 'resolved', first_seen_round: 1, last_seen_round: 2,
      })],
      rounds: [
        convergenceRound({ target: { base: 'base-sha', head } }),
        convergenceRound({
          round: 2,
          mode: 'delta',
          target: { base: 'base-sha', head },
          previous_finding_ids: ['F1'],
          new: 0,
          resolved: 1,
          regressed: 0,
          perspectives: [
            { name: 'spec_scope', target_head: head },
            { name: 'security', target_head: head },
          ],
        }),
      ],
    }),
  });
  assert.ok(!failures.some((f) => f.code === 'G21'), JSON.stringify(failures));
});

test('execute G14: 관점 2개 discovery round와 관점 2개 critical_recovery round → 개수 메시지 없음', () => {
  const twoPerspectives = (head) => [
    { name: 'spec_scope', target_head: head },
    { name: 'security', target_head: head },
  ];
  const failures = executeReviewFailures({
    findings: [convergenceFinding({ last_seen_round: 4 })],
    rounds: [
      convergenceRound({ perspectives: twoPerspectives('head-sha') }),
      convergenceRound({ round: 2, mode: 'delta' }),
      convergenceRound({
        round: 3,
        mode: 'critical_recovery',
        perspectives: twoPerspectives('head-sha'),
      }),
      convergenceRound({ round: 4, mode: 'delta' }),
    ],
  });
  assert.ok(
    !failures.some((f) => /delta perspectives invalid/.test(f.message)),
    JSON.stringify(failures),
  );
});

// --- plan DAG 모양 경고: dag-serial-overlap / dag-disjoint-edge ---

function shapeWarnings(taskDocs, code) {
  const warnings = [];
  const failures = [];
  checkGate('plan', planDocsWithTasks(taskDocs), rels, failures, { warnings });
  return { warnings: warnings.filter((x) => x.code === code), all: warnings, failures };
}

const SHARED = ['src/auth/login.js', 'test/auth/login.test.js'];

function serialChain() {
  return [
    planTaskDoc('001', { affected_paths: SHARED, depends_on: [] }),
    planTaskDoc('002', { affected_paths: SHARED, depends_on: ['TASKS-001'] }),
    planTaskDoc('003', { affected_paths: SHARED, depends_on: ['TASKS-002'] }),
  ];
}

test('plan gate when three tasks serially share the same files → one dag-serial-overlap warning', () => {
  const { warnings: w } = shapeWarnings(serialChain(), 'dag-serial-overlap');
  assert.equal(w.length, 1);
  assert.match(w[0].message, /TASKS-001 → TASKS-002 → TASKS-003/);
  assert.equal(w[0].file, rels.blueprintIndex);
  assert.equal(w[0].next, undefined);
});

test('plan gate when two commit→commit edges share no paths → one dag-disjoint-edge warning listing both', () => {
  const { warnings: e } = shapeWarnings([
    planTaskDoc('001', { affected_paths: ['src/a.js'] }),
    planTaskDoc('002', { affected_paths: ['src/b.js'], depends_on: ['TASKS-001'] }),
    planTaskDoc('003', { affected_paths: ['src/c.js'] }),
    planTaskDoc('004', { affected_paths: ['src/d.js'], depends_on: ['TASKS-003'] }),
  ], 'dag-disjoint-edge');
  assert.equal(e.length, 1);
  assert.match(e[0].message, /TASKS-001 → TASKS-002, TASKS-003 → TASKS-004/);
  assert.equal(e[0].next, undefined);
  assert.equal(e[0].file, rels.blueprintIndex);
});

test('checkPlanDraft when a serial overlap chain exists → same dag-serial-overlap warning', () => {
  const { checkPlanDraft } = require('../scripts/lib/validate-gates');
  const warnings = [];
  const failures = [];
  checkPlanDraft(planDocsWithTasks(serialChain()), rels, failures, { warnings });
  assert.equal(warnings.filter((x) => x.code === 'dag-serial-overlap').length, 1);
});

test('plan gate when the chain is only two tasks → no dag-serial-overlap warning', () => {
  const { warnings } = shapeWarnings(serialChain().slice(0, 2), 'dag-serial-overlap');
  assert.deepStrictEqual(warnings, []);
});

test('plan gate when G19 fails (cycle) → no DAG shape warnings', () => {
  const { all, failures } = shapeWarnings([
    planTaskDoc('001', { affected_paths: SHARED, depends_on: ['TASKS-003'] }),
    planTaskDoc('002', { affected_paths: SHARED, depends_on: ['TASKS-001'] }),
    planTaskDoc('003', { affected_paths: SHARED, depends_on: ['TASKS-002'] }),
  ], 'dag-serial-overlap');
  assert.ok(failures.some((f) => f.code === 'G19'));
  assert.deepStrictEqual(all.filter((x) => x.code.startsWith('dag-')), []);
});

test('plan gate when a verification node depends on a disjoint commit task → edge is not listed', () => {
  const { all } = shapeWarnings([
    planTaskDoc('001', { affected_paths: ['src/a.js'] }),
    planTaskDoc('002', { affected_paths: ['src/b.js'], depends_on: ['TASKS-001'] }),
    planTaskDoc('003', {
      execution_kind: 'verification', affected_paths: [], depends_on: ['TASKS-002'],
      parallel_safe: false, dependency_gate: 'integrated', verify: 'node --test',
    }),
  ], 'dag-disjoint-edge');
  const edge = all.find((x) => x.code === 'dag-disjoint-edge');
  assert.ok(edge);
  assert.match(edge.message, /TASKS-001 → TASKS-002/);
  assert.doesNotMatch(edge.message, /TASKS-003/);
});

test('plan gate when task-split and DAG warnings coexist → task-split comes first', () => {
  const many = Array.from({ length: 21 }, (_, i) => `src/m${i}.js`);
  const { all } = shapeWarnings([
    planTaskDoc('001', { affected_paths: many }),
    planTaskDoc('002', { affected_paths: many, depends_on: ['TASKS-001'] }),
    planTaskDoc('003', { affected_paths: many, depends_on: ['TASKS-002'] }),
    planTaskDoc('004', { affected_paths: ['docs/x.md'], depends_on: ['TASKS-003'] }),
  ], 'dag-serial-overlap');
  const codes = all.map((x) => x.code);
  assert.equal(codes.indexOf('task-split'), 0);
  assert.deepStrictEqual(
    codes.filter((c) => c.startsWith('dag-')),
    ['dag-serial-overlap', 'dag-disjoint-edge'],
  );
});

test('execute gate when a serial overlap chain exists → no DAG shape warnings', () => {
  const warnings = [];
  checkGate('execute', planDocsWithTasks(serialChain()), rels, [], { warnings });
  assert.deepStrictEqual(warnings.filter((x) => x.code.startsWith('dag-')), []);
});

// --- plan 보안 경로 경고: review-risk-missing ---

function securityBody(touchPaths) {
  return READY_BODY.replace(
    '## Touch\n- `src/auth/`\n- `test/auth/`\n',
    `## Touch\n${touchPaths.map((p) => `- \`${p}\``).join('\n')}\n`,
  );
}

function riskWarnings(touchPaths, extra = {}) {
  return shapeWarnings([
    planTaskDoc('001', { affected_paths: touchPaths, ...extra }, securityBody(touchPaths)),
  ], 'review-risk-missing');
}

test('plan task touching src/auth/login.ts with empty review_risk → warns review-risk-missing', () => {
  const { warnings, failures } = riskWarnings(['src/auth/login.ts'], { review_risk: [] });
  assert.equal(warnings.length, 1);
  assert.match(warnings[0].message, /src\/auth\/login\.ts/);
  assert.equal(warnings[0].file, planTaskDoc('001').rel);
  assert.deepStrictEqual(failures.filter((f) => f.code === 'review-risk-missing'), []);
});

test('plan task touching a security path with review_risk absent → warns review-risk-missing', () => {
  assert.equal(riskWarnings(['src/auth/login.ts']).warnings.length, 1);
});

test('plan task touching a security path with review_risk set → no review-risk-missing warning', () => {
  assert.deepStrictEqual(
    riskWarnings(['src/auth/login.ts'], { review_risk: ['authentication'] }).warnings, [],
  );
});

test('plan task touching tokenizer and sessions paths (substring/plural) → no warning', () => {
  assert.deepStrictEqual(riskWarnings(['src/tokenizer.ts', 'src/sessions/list.ts']).warnings, []);
});

test('plan task touching only .bouncer plan documents under an auth-named epic → no warning', () => {
  assert.deepStrictEqual(
    riskWarnings(['.bouncer/context/epics/080-auth-token/index.md']).warnings, [],
  );
});

test('plan task matching two security paths → one warning listing both sorted', () => {
  const { warnings } = riskWarnings(['src/login.ts', 'src/auth/x.ts']);
  assert.equal(warnings.length, 1);
  assert.match(warnings[0].message, /src\/auth\/x\.ts, src\/login\.ts;/);
});

test('plan task basename pieces split on dot underscore hyphen → password_reset.ts matches', () => {
  assert.equal(riskWarnings(['src/password_reset.ts']).warnings.length, 1);
});

test('plan task with security Touch and task-split → review-risk-missing comes after task-split', () => {
  const many = Array.from({ length: 21 }, (_, i) => `src/auth/m${i}.js`);
  const { all } = shapeWarnings([
    planTaskDoc('001', { affected_paths: many }, securityBody(['src/auth/'])),
  ], 'review-risk-missing');
  assert.deepStrictEqual(all.map((x) => x.code), ['task-split', 'review-risk-missing']);
});

test('plan task with security Touch but other sections missing → still warns review-risk-missing', () => {
  const { warnings } = shapeWarnings([
    planTaskDoc('001', {}, '# Tasks\n\n## Touch\n- `src/auth/login.ts`\n'),
  ], 'review-risk-missing');
  assert.deepStrictEqual(warnings.map((x) => x.code), ['review-risk-missing']);
});

test('plan task without a Touch section → no review-risk-missing warning', () => {
  const { warnings } = shapeWarnings([
    planTaskDoc('001', {}, '# Tasks\n\n## Goal & intent\nauth/login.ts 정리\n'),
  ], 'review-risk-missing');
  assert.deepStrictEqual(warnings, []);
});

test('plan task of verification kind with security Touch → no warning', () => {
  const { warnings } = shapeWarnings([
    planTaskDoc('001', {
      execution_kind: 'verification', affected_paths: [], depends_on: [],
      parallel_safe: false, dependency_gate: 'integrated', verify: 'node --test',
    }, securityBody(['src/auth/login.ts'])),
  ], 'review-risk-missing');
  assert.deepStrictEqual(warnings, []);
});

test('checkPlanDraft with security Touch and empty review_risk → same review-risk-missing warning', () => {
  const { checkPlanDraft } = require('../scripts/lib/validate-gates');
  const warnings = [];
  checkPlanDraft(planDocsWithTasks([
    planTaskDoc('001', { affected_paths: ['src/auth/login.ts'] }, securityBody(['src/auth/login.ts'])),
  ]), rels, [], { warnings });
  assert.equal(warnings.filter((x) => x.code === 'review-risk-missing').length, 1);
});

test('execute gate with security Touch and empty review_risk → no review-risk-missing warning', () => {
  const warnings = [];
  checkGate('execute', planDocsWithTasks([
    planTaskDoc('001', { affected_paths: ['src/auth/login.ts'] }, securityBody(['src/auth/login.ts'])),
  ]), rels, [], { warnings });
  assert.deepStrictEqual(warnings.filter((x) => x.code === 'review-risk-missing'), []);
});

test('SECURITY_PATH_TOKENS → exports the fixed token list', () => {
  const { SECURITY_PATH_TOKENS } = require('../scripts/lib/validate-gates');
  assert.deepStrictEqual(SECURITY_PATH_TOKENS, [
    'auth', 'login', 'session', 'token', 'credential', 'secret',
    'password', 'permission', 'acl', 'oauth', 'jwt',
  ]);
});

// ---- 삭제한 등록부 코드 fixture ----

const reg = (epics, areas = []) => ({
  profile: 'domain-only', domainEpicLimit: 99, areas, epics,
});
const ent = (slug, id, kind = 'common', active = true) => ({ slug, id, kind, active });

// ---- 삭제한 문서 품질 코드: 조건 하나만 어긋난 approved blueprint는 그 코드를 내지 않는다 ----

const REMOVED_TOUCH_HEAD = '| 경로 | 심볼 | 변경 | 현재 책임 | 계획한 변경 | 근거 |\n| --- | --- | --- | --- | --- | --- |\n';

/** 기본 Touch 불릿을 변경 종류가 있는 표로 바꾼 tasks 본문. Create 두 행이 affected_paths를 정당화한다. */
function touchTableBody(extraRow) {
  const rows = [
    '| `src/auth/login.js` | `a` | Create | a | b | c |',
    '| `test/auth/login.test.js` | `a` | Create | a | b | c |',
    extraRow,
  ].join('\n');
  return planReadyTasksBody().replace('## Touch\n- `src/auth/`\n- `test/auth/`', `## Touch\n${REMOVED_TOUCH_HEAD}${rows}`);
}

/** writePlanBlueprint 뒤에 한 조건만 어긋나게 고치는 변형. 각 항목은 repo를 받아 문서를 덮어쓴다. */
const REMOVED_CODE_CASES = [
  {
    name: 'a missing required section', code: 'G10',
    build: (repo) => writePlanBlueprint(repo, planReadyTasksBody().replace('## Checklist\n- [ ] implement validateLogin\n', '')),
  },
  {
    name: 'a TODO placeholder section', code: 'G10',
    build: (repo) => writePlanBlueprint(repo, planReadyTasksBody().replace('implement validateLogin', '<TODO: 작업 항목>')),
  },
  {
    name: 'affected_paths that Touch does not justify', code: 'G11',
    build: (repo) => {
      writePlanBlueprint(repo, planReadyTasksBody());
      const tasks = planReadyTasks();
      tasks.bouncer.affected_paths = ['./src/auth/login.js', './src/unrelated/x.js'];
      writeDoc(repo, `${BP_REL}/tasks/001/tasks.md`, tasks, planReadyTasksBody());
    },
  },
  {
    name: 'a Do not touch path that overlaps affected_paths', code: 'G12',
    build: (repo) => writePlanBlueprint(
      repo,
      planReadyTasksBody().replace('- `src/payments/`', '- `src/auth/login.js`'),
    ),
  },
  {
    name: 'a context-review that is not accepted', code: 'G18',
    build: (repo) => {
      writePlanBlueprint(repo, planReadyTasksBody());
      writeDoc(repo, `${BP_REL}/context-review.md`, contextReviewFileData('pending'), CONTEXT_REVIEW_BODY_OK);
    },
  },
  {
    name: 'a leftover scaffold guidance comment', code: 'G22',
    build: (repo) => {
      writePlanBlueprint(repo, planReadyTasksBody());
      writeDoc(repo, `${BP_REL}/index.md`, {
        ...blueprintDoc(), bouncer: { ...blueprintDoc().bouncer, attribution: 'fixture' },
      }, '<!-- 왜 지금 이 에픽인가. 두 문장 이내. -->\n');
    },
  },
  {
    name: 'a Touch Modify path that does not exist', code: 'G25',
    build: (repo) => writePlanBlueprint(repo, touchTableBody('| `src/missing.ts` | `a` | Modify | a | b | c |')),
  },
  {
    name: 'a Touch path outside the repository', code: 'G25',
    build: (repo) => writePlanBlueprint(repo, touchTableBody('| `../outside.ts` | `a` | Modify | a | b | c |')),
  },
  {
    name: 'a missing epic registry', code: 'G26',
    build: (repo) => {
      writePlanBlueprint(repo, planReadyTasksBody());
      fs.rmSync(path.join(repo, '.bouncer/epics.json'), { force: true });
    },
  },
  {
    name: 'an unregistered epic', code: 'G27',
    build: (repo) => {
      writePlanBlueprint(repo, planReadyTasksBody());
      writeEpicRegistry(repo, reg([ent('other', '009')]));
    },
  },
  {
    name: 'an inactive epic', code: 'G28',
    build: (repo) => {
      writePlanBlueprint(repo, planReadyTasksBody());
      writeEpicRegistry(repo, reg([ent('auth', '001', 'common', false)]));
    },
  },
  {
    name: 'a legacy epic with a new draft blueprint', code: 'G29',
    build: (repo) => {
      writePlanBlueprint(repo, planReadyTasksBody());
      writeEpicRegistry(repo, reg([ent('auth', '001', 'legacy')]));
      const idx = readDoc(path.join(repo, BP_REL, 'index.md'));
      idx.data.bouncer.status = 'draft';
      writeDoc(repo, `${BP_REL}/index.md`, idx.data, idx.body);
    },
  },
  {
    name: 'a blueprint area on a non-features epic', code: 'G30',
    build: (repo) => {
      writePlanBlueprint(repo, planReadyTasksBody());
      writeEpicRegistry(repo, reg([ent('auth', '001')]));
      const idx = readDoc(path.join(repo, BP_REL, 'index.md'));
      idx.data.bouncer.area = 'ordering';
      writeDoc(repo, `${BP_REL}/index.md`, idx.data, idx.body);
    },
  },
  {
    name: 'a missing blueprint attribution', code: 'G31',
    build: (repo) => {
      writePlanBlueprint(repo, planReadyTasksBody());
      writeEpicRegistry(repo, reg([ent('auth', '001')]));
      const idx = readDoc(path.join(repo, BP_REL, 'index.md'));
      delete idx.data.bouncer.attribution;
      writeDoc(repo, `${BP_REL}/index.md`, idx.data, idx.body);
    },
  },
];

for (const { name, code, build } of REMOVED_CODE_CASES) {
  test(`plan gate with ${name} → no ${code}`, () => {
    const repo = mkRepo();
    build(repo);
    const result = validateBlueprint({ repoRoot: repo, blueprintDir: BP_REL, gate: 'plan' });
    assert.ok(!result.failures.some((f) => f.code === code), JSON.stringify(result.failures));
  });
}

const REMOVED_DRAFT_CASES = [
  {
    name: 'a missing required section', code: 'G10',
    body: planReadyTasksBody().replace('## Checklist\n- [ ] implement validateLogin\n', ''),
  },
  {
    name: 'affected_paths that Touch does not justify', code: 'G11',
    body: planReadyTasksBody(), affected: ['./src/auth/login.js', './src/unrelated/x.js'],
  },
  {
    name: 'a Do not touch path that overlaps affected_paths', code: 'G12',
    body: planReadyTasksBody().replace('- `src/payments/`', '- `src/auth/login.js`'),
  },
];

for (const { name, code, body, affected } of REMOVED_DRAFT_CASES) {
  test(`plan draft with ${name} → no ${code}`, () => {
    const repo = mkRepo();
    writePlanBlueprint(repo, body);
    if (affected) {
      const tasks = planReadyTasks();
      tasks.bouncer.affected_paths = affected;
      writeDoc(repo, `${BP_REL}/tasks/001/tasks.md`, tasks, body);
    }
    const result = validateBlueprint({ repoRoot: repo, blueprintDir: BP_REL, planDraft: true });
    assert.ok(!result.failures.some((f) => f.code === code), JSON.stringify(result.failures));
  });
}

// ---- 실질 리뷰 판정은 gate에 남는다 ----

test('accepted review with open must_fix → G14', () => {
  const failures = executeReviewFailures({
    findings: [convergenceFinding({ status: 'open' })], rounds: [convergenceRound()],
  });
  assert.ok(failures.some((f) => /^review (accepted with open must_fix|finding F1 open in accepted review)/.test(f.message)));
});

test('accepted review with finding status Open (invalid enum) → G14', () => {
  const failures = executeReviewFailures({
    findings: [convergenceFinding({ status: 'Open' })], rounds: [convergenceRound()],
  });
  assert.ok(failures.some((f) => f.message === 'review finding F1 status invalid: Open'), JSON.stringify(failures));
});

test('accepted review with open must_fix finding that has no id → G14', () => {
  const failures = executeReviewFailures({
    findings: [convergenceFinding({ id: undefined, status: 'open' })], rounds: [convergenceRound()],
  });
  assert.ok(failures.some((f) => /^review accepted with open must_fix /.test(f.message)), JSON.stringify(failures));
});

test('blueprint review with findings not an array → G21', () => {
  const failures = finalizeG21({
    review: g21ReviewDoc('accepted', { rounds: g21ValidRounds(), findings: { id: 'F1' } }),
  });
  assert.ok(failures.some((f) => f.code === 'G21' && f.message === 'review findings must be an array'), JSON.stringify(failures));
});

test('isBlockingReviewFailure with open-in-accepted, open must_fix, open must_fix (no id), non-array, status invalid, actionability invalid, actionability missing, severity-invalid messages → true ×7, false', () => {
  const { isBlockingReviewFailure } = require('../scripts/lib/validate-gates-shared');
  for (const message of [
    'review finding F-1 open in accepted review',
    'review accepted with open must_fix F-1',
    'review accepted with open must_fix (no id)',
    'review findings must be an array',
    'review finding F-1 status invalid: Open',
    'review finding F-1 actionability invalid',
    'review finding F-1 actionability missing',
  ]) {
    assert.strictEqual(isBlockingReviewFailure(message), true, message);
  }
  assert.strictEqual(isBlockingReviewFailure('review finding F-1 severity invalid: high'), false);
});
