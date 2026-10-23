'use strict';
const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { execFileSync } = require('node:child_process');
const yaml = require('js-yaml');
const { parseIntentBody } = require('../packages/cli/dist/templates');
const { validateBlueprint } = require('../packages/cli/dist/validate');
const { prepareFinalizeDigest } = require('../packages/cli/dist/finalize-digest');
const { finalize } = require('../packages/cli/dist/finalize');
const { runCli } = require('../packages/cli/dist/cli');
const { ensureEpicIndexEntry } = require('../packages/cli/dist/epic-index');
const { computeDiffSha } = require('../packages/cli/dist/comprehension');
const { createGitTemplate } = require('./helpers/git-fixture');
const { registerFixtureEpic } = require('./helpers/epic-registry');

const BP_REL = '.bouncer/context/epics/001-auth/blueprints/001-login';

const FENCED_OK = [
  '## Intent',
  '문장함.',
  '```mermaid',
  'flowchart LR',
  '  A --> B',
  '```',
  '',
  '## Next',
  '',
].join('\n');

/** 043-005와 같은 구조: 불릿 문장 2개 + 빈 줄 + mermaid 펜스 */
const LITERAL_043_005 = [
  '## Intent',
  '- 문제: 네 역할이 절차·guardrail·출력 계약을 보조 스킬과 named agent 문서에 두 벌로 들고 있다.',
  '- 완료 조건: 역할별 상세 rubric이 `agents/*.md` 한 곳에만 있고, 대응 스킬은 호출 계약만 남으며, named agent가 없을 때의 인라인 fallback 경로는 그대로 살아 있다.',
  '',
  '```mermaid',
  'flowchart LR',
  '  S[진입 스킬 절차 뼈대] --> A[역할별 named agent 정본]',
  '  A --> C[CLI gate 최종 판정]',
  '```',
  '',
  '## Contract',
  '- 인터페이스',
  '',
].join('\n');

function writeDoc(repo, rel, data, body = '# x\n') {
  // plan gate가 등록부(G26–G31)를 보므로 blueprint index를 쓸 때 epic 등록과 attribution을 함께 채운다.
  const bpIndex = /epics\/(\d{3}-[^/]+)\/blueprints\/[^/]+\/index\.md$/.exec(rel);
  if (bpIndex && data && data.type === 'bouncer.blueprint') {
    registerFixtureEpic(repo, bpIndex[1]);
    data = { ...data, bouncer: { attribution: 'fixture', ...data.bouncer } };
  }
  const abs = path.join(repo, rel);
  fs.mkdirSync(path.dirname(abs), { recursive: true });
  fs.writeFileSync(abs, `---\n${yaml.dump(data)}---\n${body}`);
}

function capture() {
  const buf = { out: '', err: '' };
  return {
    io: { out: (s) => { buf.out += s; }, err: (s) => { buf.err += s; } },
    buf,
  };
}

function writeMinimalBlueprint(repo, {
  status = 'approved',
  intentBody = '## Intent\n- English only\n',
} = {}) {
  writeDoc(repo, '.bouncer/context/epics/001-auth/index.md', {
    type: 'bouncer.epic', title: 'Auth', description: 'd',
    resource: '.bouncer/context/epics/001-auth/index.md',
    tags: ['bouncer'], timestamp: '2026-07-01T00:00:00+09:00',
    bouncer: { id: '001', epic_id: '001', status: 'approved' },
  });
  ensureEpicIndexEntry({
    repoRoot: repo, epicId: '001', name: 'auth', description: 'd',
  });
  writeDoc(repo, `${BP_REL}/index.md`, {
    type: 'bouncer.blueprint', title: 'Login', description: 'd',
    resource: `${BP_REL}/index.md`,
    tags: ['bouncer'], timestamp: '2026-07-01T00:00:00+09:00',
    bouncer: {
      id: '001', epic_id: '001', blueprint_id: '001', status,
      commit_type: 'feat',
    },
  }, `# Blueprint\n\n${intentBody}`);
  writeDoc(repo, `${BP_REL}/tasks/001/tasks.md`, {
    type: 'bouncer.tasks', title: 'Impl', description: 'd',
    resource: `${BP_REL}/tasks/001/tasks.md`,
    tags: ['bouncer'], timestamp: '2026-07-01T00:00:00+09:00',
    bouncer: {
      id: 'TASKS-001', epic_id: '001', blueprint_id: '001', status: 'ready',
      affected_paths: ['src/auth/'],
    },
  }, `# Tasks

## Goal & intent
로그인 검증을 옮긴다.

## Interface
validateLogin()

## Touch
- \`src/auth/\`

## Do not touch
- \`src/payments/\`

## Checklist
- [ ] done
`);
  writeDoc(repo, `${BP_REL}/tasks/001/verification.md`, {
    type: 'bouncer.verification', title: 'V', description: 'd',
    resource: `${BP_REL}/tasks/001/verification.md`,
    tags: ['bouncer'], timestamp: '2026-07-01T00:00:00+09:00',
    bouncer: { id: 'VERIFY-001', epic_id: '001', blueprint_id: '001', status: 'pending' },
  });
  writeDoc(repo, `${BP_REL}/tasks/001/review.md`, {
    type: 'bouncer.review', title: 'R', description: 'd',
    resource: `${BP_REL}/tasks/001/review.md`,
    tags: ['bouncer'], timestamp: '2026-07-01T00:00:00+09:00',
    bouncer: {
      id: 'REVIEW-001', epic_id: '001', blueprint_id: '001', status: 'pending',
      review: { required: true },
    },
  });
}

// --- parser -----------------------------------------------------------------

test('fenced Intent with one Korean sentence → parseIntentBody returns that sentence only', () => {
  assert.deepStrictEqual(parseIntentBody(FENCED_OK), ['문장함.']);
});

test('tilde fence, bullet fence, and indented fence → each yields the same sentence array', () => {
  const expected = ['문장함.'];
  assert.deepStrictEqual(parseIntentBody([
    '## Intent', '문장함.', '~~~mermaid', 'flowchart LR', '  A --> B', '~~~', '', '## Next', '',
  ].join('\n')), expected);
  assert.deepStrictEqual(parseIntentBody([
    '## Intent', '문장함.', '- ```mermaid', 'flowchart LR', '  A --> B', '```', '', '## Next', '',
  ].join('\n')), expected);
  assert.deepStrictEqual(parseIntentBody([
    '## Intent', '문장함.', '    ```mermaid', 'flowchart LR', '  A --> B', '```', '', '## Next', '',
  ].join('\n')), expected);
});

test('backticks inside a tilde fence → do not close it so the later sentence is skipped', () => {
  // 문장, ~~~, ```, 문장 → 첫 문장만
  assert.deepStrictEqual(parseIntentBody([
    '## Intent',
    '문장함.',
    '~~~',
    '```',
    '둘째문장임.',
    '~~~',
    '',
    '## Next',
    '',
  ].join('\n')), ['문장함.']);
});

test('a 4-backtick open is not closed by a 3-backtick line → later sentence is skipped', () => {
  assert.deepStrictEqual(parseIntentBody([
    '## Intent',
    '문장함.',
    '````',
    '```',
    '둘째문장임.',
    '````',
    '',
    '## Next',
    '',
  ].join('\n')), ['문장함.']);
});

test('a closing fence with trailing characters → does not close so later sentence is skipped', () => {
  assert.deepStrictEqual(parseIntentBody([
    '## Intent',
    '문장함.',
    '```mermaid',
    '```x',
    '둘째문장임.',
    '```',
    '',
    '## Next',
    '',
  ].join('\n')), ['문장함.']);
});

test('an unclosed fence → sentences after the open fence are not collected', () => {
  assert.deepStrictEqual(parseIntentBody([
    '## Intent',
    '문장함.',
    '```mermaid',
    'flowchart LR',
    '둘째문장임.',
    '',
    '## Next',
    '',
  ].join('\n')), ['문장함.']);
});

test('a ## heading inside a fence → still ends the Intent section as before', () => {
  // 펜스 안의 ## 가 섹션을 끝내므로 펜스 밖 둘째 문장은 Intent에 없다.
  assert.deepStrictEqual(parseIntentBody([
    '## Intent',
    '문장함.',
    '```',
    '## Fake',
    '둘째문장임.',
    '```',
    '',
  ].join('\n')), ['문장함.']);
});

test('Intent that is only a fence → throws the existing empty-section message', () => {
  assert.throws(
    () => parseIntentBody('## Intent\n```mermaid\nflowchart LR\n```\n\n## Next\n'),
    /blueprint Intent must contain 1-2 Korean terminal sentences/,
  );
});

test('Intent without fences → parseIntentBody result is unchanged', () => {
  assert.deepStrictEqual(
    parseIntentBody('## Intent\n- 저작 맥락을 보존함\n- 단계별 메시지를 일관되게 만듦\n\n## Contract\n'),
    ['저작 맥락을 보존함', '단계별 메시지를 일관되게 만듦'],
  );
});

// --- validate S33 -----------------------------------------------------------

test('approved broken Intent on plan and finalize gates → each reports S33 with next', () => {
  for (const gate of ['plan', 'finalize']) {
    const repo = fs.mkdtempSync(path.join(os.tmpdir(), 'bouncer-s33-'));
    writeMinimalBlueprint(repo, {
      status: 'approved',
      intentBody: '## Intent\n- English only\n',
    });
    const res = validateBlueprint({ repoRoot: repo, blueprintDir: BP_REL, gate });
    const s33 = res.failures.find((f) => f.code === 'S33');
    assert.ok(s33, `expected S33 on ${gate}: ${JSON.stringify(res.failures)}`);
    assert.match(s33.message, /^blueprint Intent invalid:/);
    assert.match(s33.file, /index\.md$/);
    assert.ok(typeof s33.next === 'string' && s33.next.length > 0, 'S33 must carry next');
  }
});

// S33는 plan/finalize 전용. execute·commit·partial-close는 Intent 파싱을
// 돌리지 않으므로, 동일하게 깨진 Intent fixture에서도 S33가 없어야 한다.
test('approved broken Intent on execute, commit, and partial-close gates → no S33', () => {
  for (const gate of ['execute', 'commit', 'partial-close']) {
    const repo = fs.mkdtempSync(path.join(os.tmpdir(), 'bouncer-s33-skip-'));
    writeMinimalBlueprint(repo, {
      status: 'approved',
      intentBody: '## Intent\n- English only\n',
    });
    const res = validateBlueprint({ repoRoot: repo, blueprintDir: BP_REL, gate });
    assert.ok(
      !res.failures.some((f) => f.code === 'S33'),
      `unexpected S33 on ${gate}: ${JSON.stringify(res.failures)}`,
    );
  }
});

test('approved fenced valid Intent on plan and finalize gates → no S33', () => {
  for (const gate of ['plan', 'finalize']) {
    const repo = fs.mkdtempSync(path.join(os.tmpdir(), 'bouncer-s33-ok-'));
    writeMinimalBlueprint(repo, { status: 'approved', intentBody: FENCED_OK });
    const res = validateBlueprint({ repoRoot: repo, blueprintDir: BP_REL, gate });
    assert.ok(!res.failures.some((f) => f.code === 'S33'), JSON.stringify(res.failures));
  }
});

test('draft broken Intent on plan and finalize gates → no S33', () => {
  for (const gate of ['plan', 'finalize']) {
    const repo = fs.mkdtempSync(path.join(os.tmpdir(), 'bouncer-s33-draft-'));
    writeMinimalBlueprint(repo, {
      status: 'draft',
      intentBody: '## Intent\n- English only\n',
    });
    const res = validateBlueprint({ repoRoot: repo, blueprintDir: BP_REL, gate });
    assert.ok(!res.failures.some((f) => f.code === 'S33'), JSON.stringify(res.failures));
  }
});

test('approved blueprint without Intent heading on plan and finalize gates → no S33', () => {
  for (const gate of ['plan', 'finalize']) {
    const repo = fs.mkdtempSync(path.join(os.tmpdir(), 'bouncer-s33-nohd-'));
    writeMinimalBlueprint(repo, {
      status: 'approved',
      intentBody: '## Contract\n- only contract\n',
    });
    const res = validateBlueprint({ repoRoot: repo, blueprintDir: BP_REL, gate });
    assert.ok(!res.failures.some((f) => f.code === 'S33'), JSON.stringify(res.failures));
  }
});

test('043-005 shaped Intent with mermaid after two bullets → no S33 on plan gate', () => {
  const repo = fs.mkdtempSync(path.join(os.tmpdir(), 'bouncer-s33-043-'));
  writeMinimalBlueprint(repo, { status: 'approved', intentBody: LITERAL_043_005 });
  const res = validateBlueprint({ repoRoot: repo, blueprintDir: BP_REL, gate: 'plan' });
  assert.ok(!res.failures.some((f) => f.code === 'S33'), JSON.stringify(res.failures));
});

// --- prepareFinalizeDigest --------------------------------------------------

test('broken Intent with heading → prepareFinalizeDigest returns validate S33', () => {
  const { repoRoot, blueprintDir } = buildDigestFixture({
    intentBody: '## Intent\n- English only\n',
  });
  const d = prepareFinalizeDigest({ repoRoot, blueprintDir });
  assert.strictEqual(d.ok, false);
  assert.strictEqual(d.reason, 'validate');
  assert.strictEqual(d.failures[0].code, 'S33');
  assert.ok(!('next' in d.failures[0]));
});

test('blueprint without Intent heading → prepareFinalizeDigest keeps intent empty and ok', () => {
  const { repoRoot, blueprintDir } = buildDigestFixture({
    intentBody: '## Contract\n- only\n',
  });
  const d = prepareFinalizeDigest({ repoRoot, blueprintDir });
  assert.strictEqual(d.ok, true, JSON.stringify(d));
  assert.deepStrictEqual(d.blueprint.intent, []);
});

test('broken Intent via finalize prepare CLI → exit 1 and validate S33 JSON', () => {
  const { repoRoot, blueprintDir } = buildDigestFixture({
    intentBody: '## Intent\n- English only\n',
  });
  const { io, buf } = capture();
  const code = runCli(
    ['finalize', 'prepare', '--repo', repoRoot, '--blueprint', blueprintDir],
    io,
  );
  assert.strictEqual(code, 1);
  const json = JSON.parse(buf.out);
  assert.strictEqual(json.reason, 'validate');
  assert.strictEqual(json.failures[0].code, 'S33');
});

// --- finalize() -------------------------------------------------------------

const gitChangeTemplate = createGitTemplate((repo) => {
  const run = (args) => execFileSync('git', args, { cwd: repo, encoding: 'utf8' });
  run(['init', '-b', 'work']);
  run(['config', 'user.email', 't@example.com']);
  run(['config', 'user.name', 't']);
  fs.writeFileSync(path.join(repo, 'README'), 'base\n');
  run(['add', 'README']);
  run(['commit', '-m', 'base']);
  run(['branch', 'develop']);
  fs.mkdirSync(path.join(repo, 'src/auth'), { recursive: true });
  fs.writeFileSync(path.join(repo, 'src/auth/login.ts'), 'export {}\n');
  run(['add', 'src/auth/login.ts']);
  run(['commit', '-m', 'change']);
});
test.after(() => gitChangeTemplate.dispose());

function fakeGit(changed, untracked) {
  return {
    changedFiles: () => changed,
    untrackedFiles: () => untracked,
    stage: () => {},
    commit: () => {},
  };
}

function writeFinalizeFixture(repo, intentBody) {
  fs.cpSync(gitChangeTemplate.dir, repo, { recursive: true });
  fs.mkdirSync(path.join(repo, '.bouncer'), { recursive: true });
  fs.writeFileSync(path.join(repo, '.bouncer/config.json'), '{"verify":"true"}\n');
  writeDoc(repo, '.bouncer/context/epics/001-auth/index.md', {
    type: 'bouncer.epic', title: 'Auth', description: 'd',
    resource: '.bouncer/context/epics/001-auth/index.md',
    tags: ['bouncer'], timestamp: '2026-07-01T00:00:00+09:00',
    bouncer: { id: '001', epic_id: '001', status: 'approved' },
  });
  ensureEpicIndexEntry({
    repoRoot: repo, epicId: '001', name: 'auth', description: 'd',
  });
  writeDoc(repo, `${BP_REL}/index.md`, {
    type: 'bouncer.blueprint', title: 'Login', description: 'd',
    resource: `${BP_REL}/index.md`,
    tags: ['bouncer'], timestamp: '2026-07-01T00:00:00+09:00',
    bouncer: {
      id: '001', epic_id: '001', blueprint_id: '001', status: 'approved',
      commit_type: 'feat',
    },
  }, `# Blueprint\n\n${intentBody}`);
  writeDoc(repo, `${BP_REL}/tasks/001/tasks.md`, {
    type: 'bouncer.tasks', title: 'Impl login', description: 'd',
    resource: `${BP_REL}/tasks/001/tasks.md`,
    tags: ['bouncer'], timestamp: '2026-07-01T00:00:00+09:00',
    bouncer: {
      id: 'TASKS-001', epic_id: '001', blueprint_id: '001', status: 'verified',
      affected_paths: ['src/auth/'],
      commit_sha: 'aabbccdd',
    },
  }, `# Tasks

## Goal & intent
마감은 blueprint 단위로 묶는다.

## Interface
task 설계 맥락을 explain에 남긴다.

## Touch
- \`src/auth/\`

## Do not touch
- \`src/payments/\`

## Checklist
- [ ] preserve context
`);
  writeDoc(repo, `${BP_REL}/tasks/001/verification.md`, {
    type: 'bouncer.verification', title: 'Verified', description: 'd',
    resource: `${BP_REL}/tasks/001/verification.md`,
    tags: ['bouncer'], timestamp: '2026-07-01T00:00:00+09:00',
    bouncer: { id: 'VERIFY-001', epic_id: '001', blueprint_id: '001', status: 'passed' },
  });
  writeDoc(repo, `${BP_REL}/tasks/001/review.md`, {
    type: 'bouncer.review', title: 'Review', description: 'd',
    resource: `${BP_REL}/tasks/001/review.md`,
    tags: ['bouncer'], timestamp: '2026-07-01T00:00:00+09:00',
    bouncer: {
      id: 'REVIEW-001', epic_id: '001', blueprint_id: '001', status: 'accepted',
      review: { required: false, reason: 'fixture' },
    },
  });
  const hashed = computeDiffSha({ repoRoot: repo, base: 'develop' });
  assert.strictEqual(hashed.ok, true);
  const head = execFileSync('git', ['rev-parse', 'HEAD'], {
    cwd: repo, encoding: 'utf8',
  }).trim();
  writeDoc(repo, `${BP_REL}/explain.md`, {
    type: 'bouncer.explain', title: 'Explain', description: 'd',
    resource: `${BP_REL}/explain.md`,
    tags: ['bouncer'], timestamp: '2026-07-01T00:00:00+09:00',
    bouncer: {
      id: 'EXPLAIN-001', epic_id: '001', blueprint_id: '001', status: 'published',
      comprehension: [{
        task: '001',
        range_from: 'develop',
        range_to: head,
        diff_sha: hashed.sha,
        quiz_score: '1/5',
        disposition: 'accepted',
        recorded_at: '2026-07-01T00:00:00+09:00',
      }],
    },
  }, `# Explain

## Background
Auth validation moved to the edge.

## Intuition
Reject bad input early.

## Code
src/auth/login.ts

## Quiz
Where does validation live?

## 이해 상태
Recorded after review.
`);
}

test('approved broken Intent on finalize dry-run → returns validate with S33 and does not throw', () => {
  const repo = fs.mkdtempSync(path.join(os.tmpdir(), 'bouncer-fin-s33-'));
  writeFinalizeFixture(repo, '## Intent\n- English only\n');
  const res = finalize({
    repoRoot: repo,
    blueprintDir: BP_REL,
    git: fakeGit(['src/auth/login.ts'], []),
  });
  assert.strictEqual(res.reason, 'validate');
  assert.ok(res.failures.some((f) => f.code === 'S33'), JSON.stringify(res.failures));
});

/**
 * finalize-digest.test.js의 buildStandaloneFixture와 같은 골격에 Intent만 바꾼다.
 *
 * @param {{ intentBody: string }} opts
 * @returns {{ repoRoot: string, blueprintDir: string }}
 */
function buildDigestFixture({ intentBody }) {
  const repoRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'bouncer-digest-s33-'));
  const git = (args) => execFileSync('git', args, { cwd: repoRoot, encoding: 'utf8' }).trimEnd();
  git(['init', '-b', 'work']);
  git(['config', 'user.email', 't@example.com']);
  git(['config', 'user.name', 't']);
  fs.writeFileSync(path.join(repoRoot, 'README'), 'base\n');
  git(['add', 'README']);
  git(['commit', '-m', 'base']);
  const rangeBase = git(['rev-parse', 'HEAD']);

  writeDoc(repoRoot, '.bouncer/context/epics/001-auth/index.md', {
    type: 'bouncer.epic', title: 'Auth', description: 'd',
    resource: '.bouncer/context/epics/001-auth/index.md',
    tags: ['bouncer'], timestamp: '2026-07-01T00:00:00+09:00',
    bouncer: { id: '001', epic_id: '001', status: 'approved' },
  });
  writeDoc(repoRoot, `${BP_REL}/index.md`, {
    type: 'bouncer.blueprint', title: 'Login', description: 'd',
    resource: `${BP_REL}/index.md`,
    tags: ['bouncer'], timestamp: '2026-07-01T00:00:00+09:00',
    bouncer: {
      id: '001', epic_id: '001', blueprint_id: '001', status: 'approved',
      commit_type: 'feat', scale: 'full',
    },
  }, `# Blueprint\n\n${intentBody}\n\n## Out of scope\n- payments\n`);

  const taskMeta = (id, title) => ({
    type: 'bouncer.tasks', title, description: 'd',
    resource: `${BP_REL}/tasks/${id}/tasks.md`,
    tags: ['bouncer'], timestamp: '2026-07-01T00:00:00+09:00',
    bouncer: {
      id: `TASKS-${id}`, epic_id: '001', blueprint_id: '001', status: 'verified',
      execution_kind: 'commit',
      affected_paths: ['src/'],
      commit_sha: 'deadbeef',
    },
  });
  const taskBody = `# Tasks

## Goal & intent
greet helper

## Interface
greet()

## Touch
- \`src/\`

## Do not touch
- \`vendor/\`

## Checklist
- [ ] done
`;
  writeDoc(repoRoot, `${BP_REL}/tasks/001/tasks.md`, taskMeta('001', 'Greet'), taskBody);
  writeDoc(repoRoot, `${BP_REL}/tasks/001/verification.md`, {
    type: 'bouncer.verification', title: 'Verified', description: 'd',
    resource: `${BP_REL}/tasks/001/verification.md`,
    tags: ['bouncer'], timestamp: '2026-07-01T00:00:00+09:00',
    bouncer: {
      id: 'VERIFY-001', epic_id: '001', blueprint_id: '001', status: 'passed',
      verification: {
        command: 'true', exit_code: 0, evidence_id: 'e1', reused: false,
      },
    },
  });
  writeDoc(repoRoot, `${BP_REL}/tasks/001/review.md`, {
    type: 'bouncer.review', title: 'Review', description: 'd',
    resource: `${BP_REL}/tasks/001/review.md`,
    tags: ['bouncer'], timestamp: '2026-07-01T00:00:00+09:00',
    bouncer: {
      id: 'REVIEW-001', epic_id: '001', blueprint_id: '001', status: 'accepted',
      review: { required: false, reason: 'fixture', findings: [] },
    },
  });
  writeDoc(repoRoot, `${BP_REL}/tasks/002/tasks.md`, taskMeta('002', 'Bye'), taskBody);
  writeDoc(repoRoot, `${BP_REL}/tasks/002/verification.md`, {
    type: 'bouncer.verification', title: 'Verified', description: 'd',
    resource: `${BP_REL}/tasks/002/verification.md`,
    tags: ['bouncer'], timestamp: '2026-07-01T00:00:00+09:00',
    bouncer: {
      id: 'VERIFY-002', epic_id: '001', blueprint_id: '001', status: 'passed',
      verification: {
        command: 'true', exit_code: 0, evidence_id: 'e2', reused: false,
      },
    },
  });
  writeDoc(repoRoot, `${BP_REL}/tasks/002/review.md`, {
    type: 'bouncer.review', title: 'Review', description: 'd',
    resource: `${BP_REL}/tasks/002/review.md`,
    tags: ['bouncer'], timestamp: '2026-07-01T00:00:00+09:00',
    bouncer: {
      id: 'REVIEW-002', epic_id: '001', blueprint_id: '001', status: 'accepted',
      review: { required: false, reason: 'fixture', findings: [] },
    },
  });

  fs.mkdirSync(path.join(repoRoot, 'src'), { recursive: true });
  fs.writeFileSync(path.join(repoRoot, 'src/a.js'), 'module.exports = 1;\n');
  git(['add', '-A']);
  git(['commit', '-m', 'change\n\nBouncer-Task: TASKS-001\n']);
  const { writeCurrent } = require('../packages/cli/dist/current');
  writeCurrent({ repoRoot, blueprint: BP_REL, base: rangeBase });
  return { repoRoot, blueprintDir: BP_REL };
}
