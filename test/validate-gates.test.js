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

test('partial-close gate requires two waves, failure evidence, untracked plan, and confirmation', () => {
  const { checkPartialCloseEvidence } = require('../scripts/lib/validate-gates');
  const wave1 = repairDecision('003', 1, '002', 'src/a.js');
  const wave2 = repairDecision('004', 2, '002', 'src/b.js');
  const evidence = {
    status: 'awaiting_confirmation', repairWaves: [wave1, wave2], decisions: [wave1, wave2],
    tasks: [{ id: '002', execution_kind: 'verification', status: 'verifying' },
      { id: '003', status: 'integrated', decisions: [wave1] },
      { id: '004', status: 'integrated', decisions: [wave2] }],
    terminalFailure: { task: '002', command: 'npm test', summary: 'failed', paths: ['test/a.js'], exitCode: 1, repairWave: 2 },
  };
  assert.match(checkPartialCloseEvidence({ ledger: {}, userConfirmed: true }).reason, /awaiting/);
  assert.match(checkPartialCloseEvidence({ ledger: evidence, userConfirmed: true }).reason, /next-plan/);
  assert.match(checkPartialCloseEvidence({ ledger: evidence, nextPlanExists: true }).reason, /confirmation/);
  assert.match(checkPartialCloseEvidence({
    ledger: evidence, nextPlanExists: true, nextPlanTracked: true, userConfirmed: true,
  }).reason, /untracked/);
  assert.strictEqual(checkPartialCloseEvidence({
    ledger: evidence, nextPlanExists: true, nextPlanTracked: false, userConfirmed: true,
  }).ok, true);
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

test('parseTasksSections reads English headings', () => {
  const s = parseTasksSections(READY_BODY);
  assert.ok(s.goal.includes('Ship login'));
  assert.ok(s.interface.includes('validateLogin'));
  assert.ok(s.touch.includes('src/auth/'));
  assert.ok(s.doNotTouch.includes('src/payments/'));
  assert.ok(s.checklist.includes('implement validateLogin'));
});

test('explain parser recognizes optional Tasks without changing required sections', () => {
  const sections = parseExplainSections(
    `${EXPLAIN_BODY_OK || '# Explain'}\n\n## Tasks\n\n### Task 001\n\n#### Interface\nkept`,
  );
  assert.ok(sections.tasks.includes('### Task 001'));
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

function gateCandidate(filePath = 'scripts/src/lib/foo.ts') {
  return {
    path: filePath,
    score: 8,
    confidence: 'high',
    basis: ['unique seed definition'],
  };
}

function rankedGateEvidence(overrides = {}) {
  return {
    producer: 'graphify',
    generated_at: '2026-08-31T12:00:00+09:00',
    suggested_paths: ['scripts/src/lib/foo.ts'],
    basis: [
      { graph: 'source', status: 'reused', query: 'q', result: 'ok' },
      { graph: 'test', status: 'missing', query: 'q', result: 'test graph absent' },
      { graph: 'context', status: 'updated', query: 'q', result: 'ok' },
    ],
    quality: {
      status: 'ranked',
      confidence: 'high',
      reasons: ['context seeds used: 1'],
    },
    candidates: {
      implementation: [gateCandidate()],
      test: [],
      context: [gateCandidate('.bouncer/context/epics/001-auth/index.md')],
    },
    ...overrides,
  };
}

test('plan gate G4 accepts ranked quality/candidates and test basis without rewriting affected_paths', () => {
  const evidence = rankedGateEvidence();
  const docs = {
    epicIndex: doc('approved'),
    blueprintIndex: doc('approved'),
    tasks: doc('ready', {
      scope_evidence: evidence,
      affected_paths: ['src/auth/login.ts'],
    }, READY_BODY),
  };
  const failures = [];
  checkGate('plan', docs, rels, failures);
  assert.ok(!failures.some((f) => f.code === 'G4'), JSON.stringify(failures));
  assert.deepStrictEqual(docs.tasks.data.bouncer.affected_paths, ['src/auth/login.ts']);
});

test('plan gate G4 accepts low-confidence with empty suggested_paths', () => {
  const docs = {
    epicIndex: doc('approved'),
    blueprintIndex: doc('approved'),
    tasks: doc('ready', {
      scope_evidence: rankedGateEvidence({
        suggested_paths: [],
        quality: {
          status: 'low-confidence',
          confidence: 'low',
          reasons: ['no implementation candidates'],
        },
        candidates: { implementation: [], test: [], context: [] },
      }),
      affected_paths: ['src/auth/login.ts'],
    }, READY_BODY),
  };
  const failures = [];
  checkGate('plan', docs, rels, failures);
  assert.ok(!failures.some((f) => f.code === 'G4'), JSON.stringify(failures));
});

test('plan gate G4 rejects unpaired quality/candidates and bad candidate shapes', () => {
  const qualityOnly = rankedGateEvidence();
  delete qualityOnly.candidates;
  const qualityDocs = {
    epicIndex: doc('approved'),
    blueprintIndex: doc('approved'),
    tasks: doc('ready', {
      scope_evidence: qualityOnly,
      affected_paths: ['src/auth/login.ts'],
    }, READY_BODY),
  };
  const qualityFailures = [];
  checkGate('plan', qualityDocs, rels, qualityFailures);
  assert.ok(qualityFailures.some((f) => f.code === 'G4' && /quality|candidates/i.test(f.message)));

  const badCand = rankedGateEvidence({
    candidates: {
      implementation: [{ path: 'x.ts', score: '8', confidence: 'high', basis: ['b'] }],
      test: [],
      context: [],
    },
  });
  const badDocs = {
    epicIndex: doc('approved'),
    blueprintIndex: doc('approved'),
    tasks: doc('ready', {
      scope_evidence: badCand,
      affected_paths: ['src/auth/login.ts'],
    }, READY_BODY),
  };
  const badFailures = [];
  checkGate('plan', badDocs, rels, badFailures);
  assert.ok(badFailures.some((f) => f.code === 'G4' && /candidate/i.test(f.message)));
});

test('plan gate G4 rejects low-confidence non-empty suggested_paths', () => {
  const docs = {
    epicIndex: doc('approved'),
    blueprintIndex: doc('approved'),
    tasks: doc('ready', {
      scope_evidence: rankedGateEvidence({
        suggested_paths: ['scripts/src/lib/foo.ts'],
        quality: {
          status: 'low-confidence',
          confidence: 'low',
          reasons: ['generic-only seeds'],
        },
      }),
      affected_paths: ['src/auth/login.ts'],
    }, READY_BODY),
  };
  const failures = [];
  checkGate('plan', docs, rels, failures);
  assert.ok(failures.some((f) => f.code === 'G4' && /suggested_paths|low-confidence|unavailable/i.test(f.message)));
});

test('plan gate G4 rejects unavailable non-empty suggested_paths', () => {
  const docs = {
    epicIndex: doc('approved'),
    blueprintIndex: doc('approved'),
    tasks: doc('ready', {
      scope_evidence: rankedGateEvidence({
        suggested_paths: ['scripts/src/lib/foo.ts'],
        quality: {
          status: 'unavailable',
          confidence: 'low',
          reasons: ['source graph missing'],
        },
        candidates: { implementation: [], test: [], context: [] },
      }),
      affected_paths: ['src/auth/login.ts'],
    }, READY_BODY),
  };
  const failures = [];
  checkGate('plan', docs, rels, failures);
  assert.ok(failures.some((f) => f.code === 'G4' && /suggested_paths|unavailable|low-confidence/i.test(f.message)));
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

// 파싱 실패는 docs.contextReview가 비어 보이지만 파일이 없는 것과 다르다.
// parseErrors에 해당 경로 S0이 있으면 scaffold가 아니라 frontmatter 수정을 안내한다.
test('plan gate G18 reports invalid frontmatter when parseErrors has context-review S0', () => {
  const docs = planDocs(READY_BODY);
  delete docs.contextReview;
  const failures = [];
  checkGate('plan', docs, rels, failures, {
    parseErrors: [{
      code: 'S0',
      message: 'bad indentation of a mapping entry',
      file: rels.contextReview,
    }],
  });
  const g18 = failures.filter((f) => f.code === 'G18');
  assert.strictEqual(g18.length, 1);
  assert.match(g18[0].message, /invalid frontmatter/);
  assert.match(g18[0].message, /fix the S0 parse error/);
  assert.ok(!/scaffold context-review/.test(g18[0].message));
  assert.strictEqual(g18[0].file, rels.contextReview);
});

test('plan gate G18 keeps missing scaffold guidance when the file is truly absent', () => {
  const docs = planDocs(READY_BODY);
  delete docs.contextReview;
  const failures = [];
  checkGate('plan', docs, rels, failures, { parseErrors: [] });
  const g18 = failures.filter((f) => f.code === 'G18');
  assert.strictEqual(g18.length, 1);
  assert.match(g18[0].message, /context-review\.md missing/);
  assert.match(g18[0].message, /scaffold context-review/);
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

test('plan gate G18 fails when a finding status is deferred', () => {
  const docs = planDocs(READY_BODY);
  docs.contextReview = contextReviewDoc('accepted', [
    { id: 'CR-3', severity: 'minor', status: 'deferred', note: 'next epic' },
  ]);
  const failures = [];
  checkGate('plan', docs, rels, failures);
  assert.ok(failures.some((f) => (
    f.code === 'G18' && /finding CR-3 status invalid: deferred/.test(f.message)
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

// context review 수렴 계약 fixture. execute의 convergenceFinding과 달리 fingerprint가
// `context:` namespace를 갖고, round target이 commit 쌍이 아니라 계획 snapshot digest다.
const CONTEXT_TASK_FILE = '.bouncer/context/epics/001-auth/blueprints/001-login/tasks/002/tasks.md';
const CONTEXT_FINGERPRINT = `context:scope:tasks/002 interface:${CONTEXT_TASK_FILE}#interface`;

function contextFinding(overrides = {}) {
  return {
    id: 'CR-1', severity: 'major', status: 'resolved',
    category: 'scope', brief_clause: 'tasks/002 Interface', file: CONTEXT_TASK_FILE, symbol: 'interface',
    fingerprint: CONTEXT_FINGERPRINT,
    actionability: 'must_fix', origin: 'discovery', first_seen_round: 1, last_seen_round: 1,
    ...overrides,
  };
}

function contextRound(overrides = {}) {
  return {
    round: 1,
    mode: 'discovery',
    target: { digest: 'digest-1' },
    perspectives: ['cross_document', 'scope', 'korean_quality', 'success_criteria']
      .map((name) => ({ name, target_digest: 'digest-1' })),
    severity_changes: [],
    ...overrides,
  };
}

function contextReviewFailures(contextReview) {
  const docs = planDocs(READY_BODY);
  docs.contextReview = doc('accepted', { context_review: contextReview }, CONTEXT_REVIEW_BODY_OK);
  const failures = [];
  checkGate('plan', docs, rels, failures);
  return failures.filter((f) => f.code === 'G18');
}

test('findingFingerprint prefixes the context namespace', () => {
  assert.strictEqual(
    findingFingerprint({
      category: 'scope', brief_clause: 'tasks/002 Interface', file: `./${CONTEXT_TASK_FILE}`, symbol: 'interface',
    }, 'context'),
    CONTEXT_FINGERPRINT,
  );
});

test('plan gate G18 accepts a context finding in the context namespace', () => {
  assert.deepStrictEqual(contextReviewFailures({
    findings: [contextFinding()], rounds: [contextRound()],
  }), []);
});

test('plan gate G18 enforces the context convergence contract', () => {
  const duplicate = contextReviewFailures({
    findings: [contextFinding(), contextFinding({ id: 'CR-2' })], rounds: [contextRound()],
  });
  assert.ok(duplicate.some((f) => f.message === `context-review duplicate fingerprint ${CONTEXT_FINGERPRINT}`));

  // G14가 context: 접두를 거부하듯, G18은 접두 없는 execute 형식을 거부한다.
  const namespace = contextReviewFailures({
    findings: [contextFinding({ fingerprint: `scope:tasks/002 interface:${CONTEXT_TASK_FILE}#interface` })],
    rounds: [contextRound()],
  });
  assert.ok(namespace.some((f) => /context-review finding CR-1 fingerprint namespace invalid/.test(f.message)));

  const mismatch = contextReviewFailures({
    findings: [contextFinding({ fingerprint: 'context:scope:other#x' })], rounds: [contextRound()],
  });
  assert.ok(mismatch.some((f) => /context-review finding CR-1 fingerprint mismatch/.test(f.message)));

  const missing = contextReviewFailures({
    findings: [contextFinding({ origin: undefined })], rounds: [contextRound()],
  });
  assert.ok(missing.some((f) => /context-review finding CR-1 origin missing/.test(f.message)));

  const target = contextReviewFailures({
    findings: [contextFinding()],
    rounds: [contextRound({ perspectives: [{ name: 'scope', target_digest: 'digest-0' }] })],
  });
  assert.ok(target.some((f) => /context-review round 1 target mismatch scope/.test(f.message)));

  // execute 관점 이름은 계획 문서 판정 관점이 아니다.
  const perspective = contextReviewFailures({
    findings: [contextFinding()],
    rounds: [contextRound({ perspectives: [{ name: 'spec_scope', target_digest: 'digest-1' }] })],
  });
  assert.ok(perspective.some((f) => /context-review round 1 perspective invalid spec_scope/.test(f.message)));

  // mode 순서는 discovery 또는 discovery → delta뿐이다. delta는 한 번만 인증한다.
  const sequence = contextReviewFailures({
    findings: [contextFinding()],
    rounds: [
      contextRound(),
      contextRound({ round: 2, mode: 'delta', target: { digest: 'digest-2' }, perspectives: [] }),
      contextRound({ round: 3, mode: 'delta', target: { digest: 'digest-3' }, perspectives: [] }),
    ],
  });
  assert.ok(sequence.some((f) => /context-review rounds sequence invalid/.test(f.message)));

  // context review에는 critical recovery가 없다 — execute 전용 mode는 mode 자체가 무효다.
  const recovery = contextReviewFailures({
    findings: [contextFinding()],
    rounds: [
      contextRound(),
      contextRound({ round: 2, mode: 'critical_recovery', target: { digest: 'digest-2' }, perspectives: [] }),
    ],
  });
  assert.ok(recovery.some((f) => /context-review round 2 mode invalid/.test(f.message)));

  const deltaRounds = [
    contextRound(),
    contextRound({ round: 2, mode: 'delta', target: { digest: 'digest-2' }, perspectives: [] }),
  ];
  const deltaOrigin = contextReviewFailures({
    findings: [contextFinding({ first_seen_round: 2, last_seen_round: 2, origin: 'discovery' })],
    rounds: deltaRounds,
  });
  assert.ok(deltaOrigin.some((f) => /context-review finding CR-1 delta origin not allowed/.test(f.message)));
  assert.deepStrictEqual(contextReviewFailures({
    findings: [contextFinding({ first_seen_round: 2, last_seen_round: 2, origin: 'introduced_by_revision' })],
    rounds: deltaRounds,
  }), []);
});

test('plan gate G18 rejects context category, target, and delta origin violations', () => {
  // category는 context 관점 이름이어야 한다. execute 관점 이름을 fingerprint까지 맞춰
  // 적어도 계획 원장에 들어올 수 없다.
  const category = contextReviewFailures({
    findings: [contextFinding({
      category: 'spec_scope',
      fingerprint: `context:spec_scope:tasks/002 interface:${CONTEXT_TASK_FILE}#interface`,
    })],
    rounds: [contextRound()],
  });
  assert.ok(category.some((f) => f.message === 'context-review finding CR-1 category invalid: spec_scope'));

  // context round target은 digest다. digest가 없거나 execute 형식(base·head)만 있으면 무효다.
  const noDigest = contextReviewFailures({
    findings: [contextFinding()], rounds: [contextRound({ target: {}, perspectives: [] })],
  });
  assert.ok(noDigest.some((f) => f.message === 'context-review round 1 target invalid'));
  const executeTarget = contextReviewFailures({
    findings: [contextFinding()],
    rounds: [contextRound({ target: { base: 'abc', head: 'def' }, perspectives: [] })],
  });
  assert.ok(executeTarget.some((f) => f.message === 'context-review round 1 target invalid'));

  // delta의 missed_critical은 blocker·major만 허용한다. minor·nit은 discovery에서 놓친
  // 사소한 지적이라 delta 인증을 다시 여는 근거가 되지 못한다.
  const deltaRounds = [
    contextRound(),
    contextRound({ round: 2, mode: 'delta', target: { digest: 'digest-2' }, perspectives: [] }),
  ];
  for (const severity of ['minor', 'nit']) {
    const missedMinor = contextReviewFailures({
      findings: [contextFinding({
        severity, first_seen_round: 2, last_seen_round: 2, origin: 'missed_critical',
      })],
      rounds: deltaRounds,
    });
    assert.ok(missedMinor.some((f) => f.message === 'context-review finding CR-1 delta origin not allowed'));
  }
});

// rounds 없는 구문서는 이번 계약 이전과 같은 판정을 받는다: finding 정체성 필드와
// namespace를 요구하지 않고, deferred 거부 같은 기존 실패만 그대로 남는다.
test('plan gate G18 keeps legacy context-review results when rounds are absent', () => {
  assert.deepStrictEqual(contextReviewFailures({
    findings: [{ id: 'CR-1', severity: 'minor', status: 'resolved', fingerprint: 'scope:legacy#x' }],
  }), []);
  assert.deepStrictEqual(
    contextReviewFailures({
      findings: [{ id: 'CR-3', severity: 'minor', status: 'deferred', note: 'later' }],
    }).map((f) => f.message),
    ['context-review finding CR-3 status invalid: deferred'],
  );
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

test('execute gate accepts an integrated verification node without review', () => {
  const verification = passingVerificationDoc();
  const failures = [];
  checkGate('execute', {
    tasks: doc('integrated', { execution_kind: 'verification' }),
    verification,
  }, rels, failures, { deps: ledgerDeps(verification) });
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

test('findingFingerprint normalizes its identity components', () => {
  assert.strictEqual(
    findingFingerprint({ category: ' Spec ', brief_clause: 'Interface.거부', file: './a/b.ts', symbol: 'f' }),
    'spec:interface.거부:a/b.ts#f',
  );
});

test('execute gate G14 enforces the mode convergence contract', () => {
  const missing = executeReviewFailures({
    findings: [convergenceFinding({ first_seen_round: undefined })], rounds: [convergenceRound()],
  });
  assert.ok(missing.some((f) => /finding F1 first_seen_round missing/.test(f.message)));

  const fingerprint = executeReviewFailures({
    findings: [convergenceFinding({ fingerprint: 'wrong' })], rounds: [convergenceRound()],
  });
  assert.ok(fingerprint.some((f) => /finding F1 fingerprint mismatch/.test(f.message)));

  const duplicate = executeReviewFailures({
    findings: [convergenceFinding(), convergenceFinding({ id: 'F2' })], rounds: [convergenceRound()],
  });
  assert.ok(duplicate.some((f) => /duplicate fingerprint correctness:interface:src\/a\.ts#run/.test(f.message)));

  const namespace = executeReviewFailures({
    findings: [convergenceFinding({ fingerprint: 'context:correctness:interface:src/a.ts#run' })], rounds: [convergenceRound()],
  });
  assert.ok(namespace.some((f) => /finding F1 fingerprint namespace invalid/.test(f.message)));

  const enums = executeReviewFailures({
    findings: [convergenceFinding({ actionability: 'maybe', origin: 'guess' })], rounds: [convergenceRound()],
  });
  assert.ok(enums.some((f) => /finding F1 actionability invalid/.test(f.message)));
  assert.ok(enums.some((f) => /finding F1 origin invalid/.test(f.message)));

  const target = executeReviewFailures({
    findings: [convergenceFinding()], rounds: [convergenceRound({ target: { base: 'base-sha' } })],
  });
  assert.ok(target.some((f) => /round 1 target invalid/.test(f.message)));
  const perspective = executeReviewFailures({
    findings: [convergenceFinding()], rounds: [convergenceRound({ perspectives: [{ name: 'style', target_head: 'head-sha' }] })],
  });
  assert.ok(perspective.some((f) => /round 1 perspective invalid style/.test(f.message)));
  const mismatch = executeReviewFailures({
    findings: [convergenceFinding()], rounds: [convergenceRound({ perspectives: [{ name: 'correctness_tests', target_head: 'other' }] })],
  });
  assert.ok(mismatch.some((f) => /round 1 target mismatch correctness_tests/.test(f.message)));

  const sequence = executeReviewFailures({
    findings: [convergenceFinding({ first_seen_round: 2, last_seen_round: 2, origin: 'introduced_by_revision' })],
    rounds: [convergenceRound({ mode: 'delta' }), convergenceRound({ round: 2, mode: 'discovery' })],
  });
  assert.ok(sequence.some((f) => /rounds sequence invalid/.test(f.message)));

  assert.deepStrictEqual(executeReviewFailures({
    findings: [convergenceFinding({ first_seen_round: 2, last_seen_round: 2, origin: 'introduced_by_revision' })],
    rounds: [convergenceRound(), convergenceRound({ round: 2, mode: 'delta' })],
  }), []);
  const minorCritical = executeReviewFailures({
    findings: [convergenceFinding({ first_seen_round: 2, last_seen_round: 2, origin: 'missed_critical' })],
    rounds: [convergenceRound(), convergenceRound({ round: 2, mode: 'delta' })],
  });
  assert.ok(minorCritical.some((f) => /finding F1 delta origin not allowed/.test(f.message)));
  assert.deepStrictEqual(executeReviewFailures({
    findings: [convergenceFinding({ severity: 'major', first_seen_round: 2, last_seen_round: 2, origin: 'missed_critical' })],
    rounds: [convergenceRound(), convergenceRound({ round: 2, mode: 'delta' })],
  }), []);

  const openMustFix = executeReviewFailures({
    findings: [convergenceFinding({ status: 'accepted', note: 'not fixed' })], rounds: [convergenceRound()],
  });
  assert.ok(openMustFix.some((f) => /accepted with open must_fix F1/.test(f.message)));
});

test('execute gate G14 leaves mode-less legacy rounds unchanged', () => {
  assert.deepStrictEqual(executeReviewFailures({
    findings: [{ id: 'F3', severity: 'nit', status: 'deferred', note: 'independent follow-up' }],
    rounds: [roundEntry({ new: 1 })],
  }), []);
});

test('execute gate G14 accepts deferred finding with note and a valid rounds ledger', () => {
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

test('execute gate G14 fails when deferred finding has no note', () => {
  const g14 = executeReviewFailures({
    findings: [{ id: 'F4', severity: 'minor', status: 'deferred' }],
  });
  assert.ok(g14.some((f) => /finding F4 deferred without note/.test(f.message)));
});

test('execute gate G14 fails when rounds is not an array', () => {
  const g14 = executeReviewFailures({
    findings: [{ id: 'F1', severity: 'minor', status: 'resolved' }],
    rounds: { round: 1 },
  });
  assert.ok(g14.some((f) => /rounds must be an array/.test(f.message)));
});

test('execute gate G14 fails when rounds counts are negative or not integers', () => {
  const negative = executeReviewFailures({
    findings: [{ id: 'F1', severity: 'minor', status: 'resolved' }],
    rounds: [roundEntry({ new: -1 })],
  });
  assert.ok(negative.some((f) => /round 1 new invalid: -1/.test(f.message)));
  const nonInteger = executeReviewFailures({
    findings: [{ id: 'F1', severity: 'minor', status: 'resolved' }],
    rounds: [roundEntry({ resolved: 1.5 })],
  });
  assert.ok(nonInteger.some((f) => /round 1 resolved invalid: 1\.5/.test(f.message)));
});

test('execute gate G14 fails when rounds are duplicated or out of order', () => {
  const duplicate = executeReviewFailures({
    findings: [{ id: 'F1', severity: 'minor', status: 'resolved' }],
    rounds: [roundEntry({ round: 1 }), roundEntry({ round: 1, previous_finding_ids: ['F1'] })],
  });
  assert.ok(duplicate.some((f) => /rounds duplicate round: 1/.test(f.message)));
  const reversed = executeReviewFailures({
    findings: [{ id: 'F1', severity: 'minor', status: 'resolved' }],
    rounds: [roundEntry({ round: 2 }), roundEntry({ round: 1 })],
  });
  assert.ok(reversed.some((f) => /rounds out of order/.test(f.message)));
});

test('execute gate G14 fails when round types are invalid', () => {
  const badRound = executeReviewFailures({
    findings: [{ id: 'F1', severity: 'minor', status: 'resolved' }],
    rounds: [roundEntry({ round: 0 })],
  });
  assert.ok(badRound.some((f) => /rounds round invalid: 0/.test(f.message)));
  const badIds = executeReviewFailures({
    findings: [{ id: 'F1', severity: 'minor', status: 'resolved' }],
    rounds: [roundEntry({ previous_finding_ids: [1] })],
  });
  assert.ok(badIds.some((f) => /round 1 previous_finding_ids invalid/.test(f.message)));
  const badEntry = executeReviewFailures({
    findings: [{ id: 'F1', severity: 'minor', status: 'resolved' }],
    rounds: ['round-1'],
  });
  assert.ok(badEntry.some((f) => /rounds entry invalid/.test(f.message)));
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

test('finalize treats integrated verification nodes as closed while commit tasks stay verified', () => {
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
    + '* [001 auth](epics/001-auth/index.md) - auth epic\n',
  );
}

test('validateBlueprint plan gate loads tasks body from disk for G10–G12 pass', () => {
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
  writeDoc(repo, '.bouncer/context/epics/001-auth/index.md', epicDoc());
  writeDoc(repo, `${BP_REL}/index.md`, blueprintDoc());
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

test('plan gate warns only when affected_paths exceeds 20 (non-blocking)', () => {
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

test('finalize G16 does not require Distill files or promotion metadata', () => {
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
    'graphify-out/source/graph.json',
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

test('plan gate on scale light passes without a context-review document', () => {
  const failures = [];
  checkGate('plan', lightPlanDocs(LIGHT_READY_BODY), rels, failures);
  assert.deepStrictEqual(failures, []);
});

test('plan gate on scale full still demands context-review (no light exemption)', () => {
  const docs = lightPlanDocs(LIGHT_READY_BODY);
  docs.blueprintIndex = doc('approved', { scale: 'full' });
  const failures = [];
  checkGate('plan', docs, rels, failures);
  assert.ok(failures.some((f) => f.code === 'G18' && /context-review\.md missing/.test(f.message)));
  // full은 Interface·Do not touch도 여전히 필수다.
  assert.ok(failures.some(
    (f) => f.code === 'G10' && /missing implementation-ready sections: interface, doNotTouch/.test(f.message),
  ));
});

test('plan gate G10 on scale light requires only goal, touch, checklist', () => {
  for (const heading of ['## Goal & intent', '## Touch', '## Checklist']) {
    const body = LIGHT_READY_BODY.replace(`${heading}\n`, '');
    const failures = [];
    checkGate('plan', lightPlanDocs(body), rels, failures);
    assert.ok(
      failures.some((f) => f.code === 'G10'),
      `${heading} removal must fail G10`,
    );
  }
});

test('plan gate G10 on scale light reports the three-section list when no tasks doc exists', () => {
  const failures = [];
  const docs = { epicIndex: doc('approved'), blueprintIndex: doc('approved', { scale: 'light' }) };
  checkGate('plan', docs, rels, failures);
  const g10 = failures.filter((f) => f.code === 'G10');
  assert.strictEqual(g10.length, 1);
  assert.match(g10[0].message, /sections: goal, touch, checklist$/);
});

test('the shipped light tasks template cannot pass the plan gate untouched', () => {
  const failures = [];
  checkGate('plan', lightPlanDocs(TEMPLATES['tasks-light.md']), rels, failures);
  const g10 = failures.filter((f) => f.code === 'G10');
  assert.strictEqual(g10.length, 1);
  assert.match(g10[0].message, /placeholders: goal, touch, checklist/);
});

test('scale light keeps G4, G5, G11, and G12 identical to full', () => {
  // G4 / G5 — 빈 scope evidence와 빈 affected_paths는 light에서도 통과하지 못한다.
  const bare = {
    epicIndex: doc('approved'),
    blueprintIndex: doc('approved', { scale: 'light' }),
    tasks: doc('ready', { affected_paths: [] }, LIGHT_READY_BODY),
  };
  const bareFailures = [];
  checkGate('plan', bare, rels, bareFailures);
  assert.ok(bareFailures.some((f) => f.code === 'G4'));
  assert.ok(bareFailures.some((f) => f.code === 'G5'));

  // G11 — Touch가 근거를 대지 않는 경로.
  const g11 = [];
  checkGate('plan', lightPlanDocs(LIGHT_READY_BODY, {
    affected_paths: ['src/payments/charge.js'],
  }), rels, g11);
  assert.ok(g11.some((f) => f.code === 'G11' && /src\/payments\/charge\.js/.test(f.message)));

  // G12 — light 문서가 Do not touch 절을 쓰면 교차 판정은 그대로 걸린다.
  const withAvoid = LIGHT_READY_BODY.replace(
    '## Checklist',
    '## Do not touch\n- `src/auth/login.js`\n\n## Checklist',
  );
  const g12 = [];
  checkGate('plan', lightPlanDocs(withAvoid), rels, g12);
  assert.ok(g12.some((f) => f.code === 'G12' && /src\/auth\/login\.js/.test(f.message)));
});

test('an unknown scale value is not treated as light', () => {
  const docs = lightPlanDocs(LIGHT_READY_BODY);
  docs.blueprintIndex = doc('approved', { scale: 'tiny' });
  const failures = [];
  checkGate('plan', docs, rels, failures);
  assert.ok(failures.some((f) => f.code === 'G18'));
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

test('plan gate G19 accepts a valid DAG and tasks without DAG fields', () => {
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

test('plan gate G19 rejects missing, self, duplicate, and cyclic dependencies', () => {
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

test('plan gate accepts terminal verification fan-in and rejects source scope or commit successors', () => {
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

  const invalid = [];
  checkGate('plan', planDocsWithTasks([
    planTaskDoc('001'),
    planTaskDoc('002', {
      execution_kind: 'verification', affected_paths: [], depends_on: ['TASKS-001'],
      parallel_safe: false, dependency_gate: 'integrated', verify: 'node --test',
    }),
    planTaskDoc('003', { depends_on: ['TASKS-002'] }),
  ]), rels, invalid);
  assert.ok(invalid.some((f) => f.code === 'G20' && /Touch/.test(f.message)));
  assert.ok(invalid.some((f) => f.code === 'G20' && /commit task/.test(f.message)));
});
