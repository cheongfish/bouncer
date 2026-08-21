'use strict';
const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { createHash } = require('node:crypto');
const { checkGate, parseTasksSections, extractPathCandidates, validateBlueprint } = require('../scripts/lib/validate');
const { TEMPLATES } = require('../scripts/lib/templates');

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

test('parseTasksSections reads English headings', () => {
  const s = parseTasksSections(READY_BODY);
  assert.ok(s.goal.includes('Ship login'));
  assert.ok(s.interface.includes('validateLogin'));
  assert.ok(s.touch.includes('src/auth/'));
  assert.ok(s.doNotTouch.includes('src/payments/'));
  assert.ok(s.checklist.includes('implement validateLogin'));
});

test('parseTasksSections accepts Korean aliases', () => {
  const body = '## 목적·의도\nwhy\n\n## 인터페이스\napi\n\n## 수정할 부분\n`src/x.js`\n\n'
    + '## 절대 수정 금지\n`src/y.js`\n\n## 체크리스트\n- [ ] a\n';
  const s = parseTasksSections(body);
  assert.strictEqual(s.goal, 'why');
  assert.strictEqual(s.interface, 'api');
  assert.ok(s.touch.includes('src/x.js'));
  assert.ok(s.doNotTouch.includes('src/y.js'));
  assert.ok(s.checklist.includes('- [ ] a'));
});

test('Constraints bounds the preceding section instead of folding into it', () => {
  const body = READY_BODY.replace(
    '## Checklist',
    '## Constraints\n- keep `src/auth/login.js` backward compatible\n\n## Checklist',
  );
  const s = parseTasksSections(body);
  assert.ok(s.constraints.includes('backward compatible'));
  assert.ok(!s.doNotTouch.includes('src/auth/login.js'));
  const tasks = doc('ready', {
    affected_paths: ['src/auth/'],
    graph: { suggested_paths: [], basis: 'manual' },
  }, body);
  const failures = [];
  checkGate('plan', {
    epicIndex: doc('approved'),
    blueprintIndex: doc('approved'),
    tasks,
  }, rels, failures);
  assert.deepStrictEqual(failures.filter((f) => f.code === 'G12'), []);
});

test('extractPathCandidates finds backtick and bare paths', () => {
  const paths = extractPathCandidates('- `src/auth/login.js`\n- test/auth/login.test.js\n');
  assert.ok(paths.includes('src/auth/login.js'));
  assert.ok(paths.includes('test/auth/login.test.js'));
});

test('plan gate passes when all conditions met including G10–G12', () => {
  const failures = [];
  checkGate('plan', planDocs(READY_BODY), rels, failures);
  assert.deepStrictEqual(failures, []);
});

test('plan gate flags G3 and G4 and G5', () => {
  const docs = {
    epicIndex: doc('approved'),
    blueprintIndex: doc('approved'),
    tasks: doc('draft', { affected_paths: [] }, READY_BODY),
  };
  const failures = [];
  checkGate('plan', docs, rels, failures);
  const codes = failures.map((f) => f.code);
  assert.ok(codes.includes('G3'));
  assert.ok(codes.includes('G4'));
  assert.ok(codes.includes('G5'));
});

test('plan gate G2 on a closed blueprint reports lock wording distinct from draft', () => {
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

test('plan gate G3 accepts ready, in_progress, and verified', () => {
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

test('plan gate G4 accepts a non-empty basis entry array', () => {
  const docs = {
    epicIndex: doc('approved'),
    blueprintIndex: doc('approved'),
    tasks: doc('ready', {
      graph: {
        suggested_paths: ['src/'],
        basis: [{
          graph: 'source', status: 'updated', query: 'login', result: '1 hit: src/',
        }],
      },
      affected_paths: ['src/auth/'],
    }, READY_BODY),
  };
  const failures = [];
  checkGate('plan', docs, rels, failures);
  assert.ok(!failures.some((f) => f.code === 'G4'));
});

test('plan gate G4 rejects an empty basis array', () => {
  const docs = {
    epicIndex: doc('approved'),
    blueprintIndex: doc('approved'),
    tasks: doc('ready', {
      graph: { suggested_paths: ['src/'], basis: [] },
      affected_paths: ['src/auth/'],
    }, READY_BODY),
  };
  const failures = [];
  checkGate('plan', docs, rels, failures);
  assert.ok(failures.some((f) => f.code === 'G4' && /basis/.test(f.message)));
});

test('plan gate G4 accepts scope_evidence, preserves affected_paths, and rejects mixed forms', () => {
  const scopeEvidence = {
    producer: 'graphify', generated_at: '2026-08-18T00:00:00+09:00',
    suggested_paths: ['scripts/src/lib/'], basis: 'graphify: validate gates',
  };
  const accepted = {
    epicIndex: doc('approved'), blueprintIndex: doc('approved'),
    tasks: doc('ready', {
      scope_evidence: scopeEvidence,
      affected_paths: ['src/auth/'],
    }, READY_BODY),
  };
  const passed = [];
  checkGate('plan', accepted, rels, passed);
  assert.ok(!passed.some((f) => f.code === 'G4'));
  assert.deepStrictEqual(accepted.tasks.data.bouncer.affected_paths, ['src/auth/']);

  const mixed = {
    epicIndex: doc('approved'), blueprintIndex: doc('approved'),
    tasks: doc('ready', {
      scope_evidence: scopeEvidence,
      graph: { suggested_paths: ['src/'], basis: 'legacy' },
      affected_paths: ['src/auth/'],
    }, READY_BODY),
  };
  const failed = [];
  checkGate('plan', mixed, rels, failed);
  assert.ok(failed.some((f) => f.code === 'G4' && /both/.test(f.message)));
});

test('plan gate G10 fails when a section is missing', () => {
  const body = '# Tasks\n\n## Goal & intent\nx\n\n## Interface\ny\n\n## Touch\n`src/`\n\n## Checklist\n- [ ] a\n';
  const docs = {
    epicIndex: doc('approved'),
    blueprintIndex: doc('approved'),
    tasks: doc('ready', {
      graph: { suggested_paths: ['src/'], basis: 'manual: src/' },
      affected_paths: ['src/a.js'],
    }, body),
  };
  const failures = [];
  checkGate('plan', docs, rels, failures);
  assert.ok(failures.some((f) => f.code === 'G10'));
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

test('plan gate G10 fails when a section holds only guidance comments', () => {
  const body = READY_BODY.replace('Ship login validation.', '<!-- 여기에 목표를 적습니다 -->');
  const failures = [];
  checkGate('plan', planDocs(body), rels, failures);
  const g10 = failures.filter((f) => f.code === 'G10');
  assert.strictEqual(g10.length, 1);
  assert.match(g10[0].message, /missing implementation-ready sections: goal/);
});

test('plan gate G10 fails when a TODO placeholder survives', () => {
  const body = READY_BODY.replace('- [ ] implement validateLogin', '- [ ] <TODO: 작업 항목>');
  const failures = [];
  checkGate('plan', planDocs(body), rels, failures);
  const g10 = failures.filter((f) => f.code === 'G10');
  assert.strictEqual(g10.length, 1);
  assert.match(g10[0].message, /placeholders: checklist/);
});

test('plan gate tolerates guidance comments alongside real content', () => {
  const body = READY_BODY.replace(
    '## Touch',
    '## Touch\n<!-- affected_paths의 모든 경로가 여기서 정당화되어야 합니다 (G11) -->',
  );
  const failures = [];
  checkGate('plan', planDocs(body), rels, failures);
  assert.deepStrictEqual(failures, []);
});

test('plan gate does not mistake a generic parameter for a placeholder', () => {
  const body = READY_BODY.replace('`validateLogin(input) -> Result`', '`validateLogin<T>(input: T) -> Result<T>`');
  const failures = [];
  checkGate('plan', planDocs(body), rels, failures);
  assert.deepStrictEqual(failures, []);
});

// The safety property the guidance-heavy templates must not cost us: prose in a
// section makes it non-empty, so `<TODO:` detection is the only thing keeping an
// untouched template out of the plan gate.
test('the shipped tasks template cannot pass the plan gate untouched', () => {
  const failures = [];
  checkGate('plan', planDocs(TEMPLATES['tasks.md']), rels, failures);
  const g10 = failures.filter((f) => f.code === 'G10');
  assert.strictEqual(g10.length, 1);
  assert.match(g10[0].message, /placeholders: goal, interface, touch, doNotTouch, checklist/);
});

test('plan gate G11 fails when affected_paths not justified by Touch', () => {
  const docs = {
    epicIndex: doc('approved'),
    blueprintIndex: doc('approved'),
    tasks: doc('ready', {
      graph: { suggested_paths: ['src/'], basis: 'manual: src/' },
      affected_paths: ['src/auth/login.js', 'src/unrelated/x.js'],
    }, READY_BODY),
  };
  const failures = [];
  checkGate('plan', docs, rels, failures);
  assert.ok(failures.some((f) => f.code === 'G11'));
});

test('plan gate G12 fails when do-not-touch intersects affected_paths', () => {
  const body = `# Tasks

## Goal & intent
x

## Interface
y

## Touch
- \`src/auth/\`

## Do not touch
- \`src/auth/login.js\`

## Checklist
- [ ] a
`;
  const docs = {
    epicIndex: doc('approved'),
    blueprintIndex: doc('approved'),
    tasks: doc('ready', {
      graph: { suggested_paths: ['src/'], basis: 'manual: src/' },
      affected_paths: ['src/auth/login.js'],
    }, body),
  };
  const failures = [];
  checkGate('plan', docs, rels, failures);
  assert.ok(failures.some((f) => f.code === 'G12'));
});

test('plan gate G18 fails when context-review.md is missing', () => {
  const docs = planDocs(READY_BODY);
  delete docs.contextReview;
  const failures = [];
  checkGate('plan', docs, rels, failures);
  const g18 = failures.filter((f) => f.code === 'G18');
  assert.strictEqual(g18.length, 1);
  assert.match(g18[0].message, /context-review\.md missing/);
  assert.match(g18[0].message, /scaffold context-review/);
  assert.strictEqual(g18[0].file, rels.contextReview);
});

test('plan gate G18 fails when context-review.status is pending', () => {
  const docs = planDocs(READY_BODY);
  docs.contextReview = contextReviewDoc('pending');
  const failures = [];
  checkGate('plan', docs, rels, failures);
  assert.ok(failures.some((f) => f.code === 'G18' && /status != accepted/.test(f.message)));
});

test('plan gate G18 fails when context-review body lacks Findings heading', () => {
  const docs = planDocs(READY_BODY);
  docs.contextReview = contextReviewDoc('accepted', [], '# Context review\n\nnothing structured\n');
  const failures = [];
  checkGate('plan', docs, rels, failures);
  assert.ok(failures.some((f) => f.code === 'G18' && /missing ## Findings/.test(f.message)));
});

test('plan gate G18 fails when a finding severity is invalid', () => {
  const docs = planDocs(READY_BODY);
  docs.contextReview = contextReviewDoc('accepted', [
    { id: 'CR-1', severity: 'critical', status: 'resolved' },
  ]);
  const failures = [];
  checkGate('plan', docs, rels, failures);
  assert.ok(failures.some((f) => (
    f.code === 'G18' && /finding CR-1 severity invalid: critical/.test(f.message)
  )));
});

test('plan gate G18 fails when an accepted finding has no note', () => {
  const docs = planDocs(READY_BODY);
  docs.contextReview = contextReviewDoc('accepted', [
    { id: 'CR-2', severity: 'major', status: 'accepted' },
  ]);
  const failures = [];
  checkGate('plan', docs, rels, failures);
  assert.ok(failures.some((f) => (
    f.code === 'G18' && /finding CR-2 accepted without note/.test(f.message)
  )));
});

test('plan gate G18 fails when context_review.findings is not an array', () => {
  const docs = planDocs(READY_BODY);
  docs.contextReview = doc(
    'accepted',
    { context_review: { findings: { id: 'CR-1' } } },
    CONTEXT_REVIEW_BODY_OK,
  );
  const failures = [];
  checkGate('plan', docs, rels, failures);
  assert.ok(failures.some((f) => f.code === 'G18'));
});

test('plan gate G18 passes for an accepted context-review with empty findings', () => {
  const failures = [];
  checkGate('plan', planDocs(READY_BODY), rels, failures);
  assert.deepStrictEqual(failures.filter((f) => f.code === 'G18'), []);
  assert.deepStrictEqual(failures, []);
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
  const verification = doc('passed', {
    verification: {
      command: 'npm test',
      ran_at: '2026-07-27T00:00:00.000Z',
      exit_code: 0,
      output_tail: 'All 42 tests passed.',
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

test('execute gate flags G13 when harness metadata is present but the verify ledger is missing', () => {
  // 프론트매터만 손으로 채운 verification.md — 원장 없음
  const result = checkGate({
    gate: 'execute',
    docs: executeDocs(),
    rels,
    deps: { readVerifyLedger: () => null },
  });
  assert.ok(result.failures.some((f) => f.code === 'G13'));
});

test('execute gate: review optional satisfies G8 (with verification body)', () => {
  const docs = executeDocs();
  const failures = [];
  checkGate('execute', docs, rels, failures, { deps: ledgerDeps(docs.verification) });
  assert.deepStrictEqual(failures, []);
});

test('execute gate G13 ledger missing, ran_at mismatch, and matching record', () => {
  const { missing, mismatch, ok } = g13ThreeWay('execute');
  assert.ok(missing.failures.some((f) => f.code === 'G13' && /missing harness verify ledger record/.test(f.message)));
  assert.ok(mismatch.failures.some((f) => f.code === 'G13' && /does not match verify ledger/.test(f.message)));
  assert.deepStrictEqual(ok.failures.filter((f) => f.code === 'G13'), []);
  assert.deepStrictEqual(ok.failures, []);
});

test('execute gate G13 hashes output_tail after trailing space and CRLF survive in-memory', () => {
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

test('execute gate flags G13 when verification lacks harness metadata', () => {
  const docs = {
    tasks: doc('verified'),
    verification: doc('passed', {}, VERIFY_BODY_OK),
    review: doc('pending', { review: { required: false } }),
  };
  const failures = [];
  checkGate('execute', docs, rels, failures);
  assert.ok(failures.some((f) => f.code === 'G13'));
});

test('execute gate flags G13 when verification body lacks Command/Evidence', () => {
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

test('execute gate accepts review with valid findings schema', () => {
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

test('execute gate flags G14 when accepted finding has no note', () => {
  const docs = {
    tasks: doc('verified'),
    verification: doc('passed', {}, VERIFY_BODY_OK),
    review: doc('accepted', {
      review: { findings: [{ id: 'F2', severity: 'major', status: 'accepted' }] },
    }, REVIEW_BODY_OK),
  };
  const failures = [];
  checkGate('execute', docs, rels, failures);
  assert.ok(failures.some((f) => f.code === 'G14'));
});

test('execute gate flags G14 when review body lacks Findings heading', () => {
  const docs = {
    tasks: doc('verified'),
    verification: doc('passed', {}, VERIFY_BODY_OK),
    review: doc('accepted', { review: { findings: [] } }, '# Review\n\nnothing structured\n'),
  };
  const failures = [];
  checkGate('execute', docs, rels, failures);
  assert.ok(failures.some((f) => f.code === 'G14'));
});

test('execute gate skips G14 when review.required is false', () => {
  const docs = {
    tasks: doc('verified'),
    verification: doc('passed', {}, VERIFY_BODY_OK),
    review: doc('pending', { review: { required: false } }, '# Review\n'),
  };
  const failures = [];
  checkGate('execute', docs, rels, failures);
  assert.ok(!failures.some((f) => f.code === 'G14'));
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

test('finalize gate G16 fails when explain sections are unwritten', () => {
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

test('finalize gate G16 fails when comprehension record is missing for a task', () => {
  const failures = [];
  checkGate('finalize', {
    tasksDocs: g16VerifiedTasks(['001']),
    explain: explainDoc([]),
  }, rels, failures, G16_CTX);
  assert.deepStrictEqual(failures.map((f) => f.code), ['G16']);
  assert.match(failures[0].message, /comprehension/);
  assert.ok(!failures.some((f) => f.code === 'G15'));
});

test('finalize gate G16 fails when explain.status is not published', () => {
  const failures = [];
  checkGate('finalize', {
    tasksDocs: g16VerifiedTasks(['001']),
    explain: doc('draft', { comprehension: [compEntry()] }, EXPLAIN_BODY_OK),
  }, rels, failures, G16_CTX);
  assert.ok(failures.some((f) => f.code === 'G16' && /published/.test(f.message)));
  assert.ok(!failures.some((f) => f.code === 'G15'));
});

test('finalize gate G16 passes when all tasks verified and comprehension covers them', () => {
  const failures = [];
  checkGate('finalize', {
    tasksDocs: g16VerifiedTasks(['001']),
    explain: explainDoc([compEntry({ quiz_score: '1/5', disposition: 'accepted with gaps' })]),
  }, rels, failures, G16_CTX);
  assert.deepStrictEqual(failures, []);
});

test('finalize gate G16 fails when explain.md is absent', () => {
  const failures = [];
  checkGate('finalize', {
    tasksDocs: g16VerifiedTasks(['001']),
  }, rels, failures, G16_CTX);
  assert.deepStrictEqual(failures.map((f) => f.code), ['G16']);
  assert.match(failures[0].message, /explain\.md missing/);
  assert.ok(!failures.some((f) => f.code === 'G15'));
});

test('finalize gate G16 rejects legacy object comprehension', () => {
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

test('finalize gate G16 fails when diff_sha does not match range_from..HEAD', () => {
  const failures = [];
  checkGate('finalize', {
    tasksDocs: g16VerifiedTasks(['001']),
    explain: explainDoc([compEntry({ diff_sha: 'wrong' })]),
  }, rels, failures, G16_CTX);
  assert.deepStrictEqual(failures.map((f) => f.code), ['G16']);
  assert.match(failures[0].message, /diff_sha does not match/);
  assert.ok(!failures.some((f) => f.code === 'G15'));
});

test('finalize gate G16 fails when diff_sha cannot be computed (no-base)', () => {
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
    description: '001',
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
  writeDoc(repo, '.bouncer/context/epics/001-auth/index.md', epicDoc());
  writeDoc(repo, `${BP_REL}/index.md`, blueprintDoc());
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
    + '* [001 auth](epics/001-auth/index.md) - Epic 001\n',
  );
}

test('validateBlueprint plan gate loads tasks body from disk for G10–G12 pass', () => {
  const repo = mkRepo();
  writePlanBlueprint(repo, planReadyTasksBody());
  const res = validateBlueprint({ repoRoot: repo, blueprintDir: BP_REL, gate: 'plan' });
  assert.deepStrictEqual(res, { ok: true, failures: [] });
});

test('validateBlueprint plan gate G10 fails via file-loaded body when section missing', () => {
  const repo = mkRepo();
  const body = `# Tasks

## Goal & intent
x

## Interface
y

## Touch
\`src/\`

## Checklist
- [ ] a
`;
  writePlanBlueprint(repo, body);
  const res = validateBlueprint({ repoRoot: repo, blueprintDir: BP_REL, gate: 'plan' });
  assert.strictEqual(res.ok, false);
  assert.ok(res.failures.some((f) => f.code === 'G10'));
});

test('plan gate applies per task document and reports the failing file', () => {
  const repo = mkRepo();
  writeDoc(repo, '.bouncer/context/epics/001-auth/index.md', epicDoc());
  writeDoc(repo, `${BP_REL}/index.md`, blueprintDoc());
  const indexAbs = path.join(repo, '.bouncer/context/index.md');
  fs.mkdirSync(path.dirname(indexAbs), { recursive: true });
  fs.writeFileSync(
    indexAbs,
    '---\nokf_version: "0.1"\n---\n# Epics\n\n'
    + '* [001 auth](epics/001-auth/index.md) - Epic 001\n',
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
    + '* [001 auth](epics/001-auth/index.md) - Epic 001\n',
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

const PASS_EVIDENCE = {
  command: 'node -e "process.exit(0)"',
  ran_at: '2026-07-27T00:00:00.000Z',
  exit_code: 0,
  output_tail: 'ok',
};

const PASS_VERIFY_BODY = `# Verification

## Command
\`node -e "process.exit(0)"\`

## Evidence
Ran at: 2026-07-27T00:00:00.000Z
Exit code: 0
`;

/**
 * tasks/001 완결 + tasks/002 draft/pending 묶음 fixture.
 * execute 게이트가 포인터 대상만 보는지 검증할 때 쓴다.
 */
function writeTaskDirExecuteFixture(repo, { verifyCommand = 'node -e "process.exit(0)"' } = {}) {
  fs.mkdirSync(path.join(repo, '.bouncer'), { recursive: true });
  fs.writeFileSync(path.join(repo, '.bouncer/config.json'), JSON.stringify({ verify: verifyCommand }));
  writeDoc(repo, '.bouncer/context/epics/001-auth/index.md', epicDoc());
  writeDoc(repo, `${BP_REL}/index.md`, blueprintDoc());
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
  writeCurrent({ repoRoot: repo, blueprint: BP_REL, base: 'develop', task: taskRel });
}

test('execute gate passes when pointer targets a complete tasks/001 unit despite draft sibling', () => {
  const repo = mkRepo();
  const { u1 } = writeTaskDirExecuteFixture(repo);
  setPointerTask(repo, `${u1}/tasks.md`);

  const res = validateBlueprint({ repoRoot: repo, blueprintDir: BP_REL, gate: 'execute' });
  assert.equal(res.ok, true, JSON.stringify(res.failures, null, 2));
});

test('execute gate G6 G7 G8 report files under the pointer tasks/002 unit', () => {
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

test('execute gate G13 only inspects the pointer unit verification.md', () => {
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

test('execute gate G6 when pointer unit tasks.md is missing does not use sibling tasks', () => {
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

test('finalize G16 fails when an open task remains (TASKS-002 ready)', () => {
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

test('finalize G16 fails when comprehension entry is incomplete (empty quiz_score)', () => {
  // BP 단일 엔트리 계약: task 번호 커버가 아니라 엔트리 완전성·해시가 판정 주체.
  // 빈 quiz_score는 incomplete → 기록 없음.
  const repo = mkRepo();
  writeFinalizeG16Fixture(repo, {
    task2Status: 'verified',
    entries: [compEntry({ task: '001', disposition: 'ok', quiz_score: '' })],
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

test('finalize G16 passes with a single complete entry when all tasks are verified', () => {
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

test('finalize G16 rejects legacy object comprehension on disk', () => {
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

test('commit gate G17 fails when a staged path is outside affected_paths', () => {
  const failures = [];
  checkGate('commit', {}, rels, failures, commitCtx([
    'src/auth/login.ts',
    'src/other.ts',
  ]));
  assert.deepStrictEqual(failures.map((f) => f.code), ['G17']);
  assert.match(failures[0].message, /src\/other\.ts/);
});

test('commit gate G17 fails when staged files cannot be read', () => {
  const failures = [];
  checkGate('commit', {}, rels, failures, commitCtx(() => ({
    ok: false,
    reason: 'not-a-repo',
  })));
  assert.deepStrictEqual(failures.map((f) => f.code), ['G17']);
  assert.match(failures[0].message, /could not read staged files \(not-a-repo\)/);
});

test('commit gate passes when only blueprint docs and runtime artifacts are staged', () => {
  const failures = [];
  const bp = '.bouncer/context/epics/001-auth/blueprints/001-login';
  checkGate('commit', {}, rels, failures, commitCtx([
    `${bp}/tasks/001/tasks.md`,
    `${bp}/explain.md`,
    'graphify-out/graph.json',
  ]));
  assert.deepStrictEqual(failures, []);
});

test('commit gate G6 fails when pointer tasks are not verified', () => {
  const failures = [];
  const ctx = commitCtx([]);
  ctx.taskUnit = commitReadyUnit();
  ctx.taskUnit.tasks = doc('ready', { affected_paths: ['src/auth/'] });
  ctx.deps.readVerifyLedger = () => matchingLedger(ctx.taskUnit.verification);
  checkGate('commit', {}, rels, failures, ctx);
  assert.ok(failures.some((f) => f.code === 'G6'));
  assert.ok(!failures.some((f) => f.code === 'G15'));
});

test('commit gate G13 ledger missing, ran_at mismatch, and matching record', () => {
  const { missing, mismatch, ok } = g13ThreeWay('commit');
  assert.ok(missing.failures.some((f) => f.code === 'G13' && /missing harness verify ledger record/.test(f.message)));
  assert.ok(mismatch.failures.some((f) => f.code === 'G13' && /does not match verify ledger/.test(f.message)));
  assert.deepStrictEqual(ok.failures.filter((f) => f.code === 'G13'), []);
  assert.ok(!ok.failures.some((f) => f.code === 'G13'));
});

test('unknown gate still throws', () => {
  assert.throws(
    () => checkGate('nope', {}, rels, [], commitCtx([])),
    /unknown gate: nope/,
  );
});
