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
  const { execFileSync } = require('node:child_process');
  const repo = fs.mkdtempSync(path.join(os.tmpdir(), 'bouncer-native-e2e-'));
  execFileSync('git', ['init', '--quiet'], { cwd: repo });

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

// 배포되는 것은 `scripts/lib/*.js`뿐이다. coordinator 수명주기가 그 빌드
// 산출물과 CLI 표면만으로 끝까지 도는지 확인해, TypeScript 소스가 있는
// 개발 체크아웃에서만 동작하는 경로가 생기지 않게 한다.
test('the coordinator lifecycle runs end to end through the shipped CLI surface', () => {
  const { execFileSync } = require('node:child_process');
  const { runCli } = require('../scripts/lib/cli');

  const repo = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), 'bouncer-native-coordinate-')));
  const git = (cwd, args) => execFileSync('git', args, { cwd, encoding: 'utf8' }).trim();
  git(repo, ['init', '--quiet', '-b', 'work']);
  git(repo, ['config', 'user.email', 'test@example.com']);
  git(repo, ['config', 'user.name', 'test']);
  fs.writeFileSync(path.join(repo, 'README.md'), 'fixture\n');
  fs.mkdirSync(path.join(repo, 'src'), { recursive: true });
  fs.writeFileSync(path.join(repo, 'src/login.js'), 'base\n');
  writeDoc(repo, `${BP_REL}/tasks/001/tasks.md`,
    base('bouncer.tasks', 'TASKS-001', 'ready', {
      affected_paths: ['src/login.js'], depends_on: [], parallel_safe: true,
      dependency_gate: 'integrated',
    }),
    '# Tasks\n');
  git(repo, ['add', '-A']);
  git(repo, ['commit', '-m', 'plan']);

  // CLI는 서 있는 cwd를 write boundary로 쓴다. 플래그로 경계를 지정하면
  // 실제 배포 경로가 아니라 테스트 전용 경로를 재는 셈이 된다.
  const cli = (cwd, args) => {
    let out = '';
    let err = '';
    const before = process.cwd();
    process.chdir(cwd);
    let code;
    try {
      code = runCli(args, { out: (s) => { out += s; }, err: (s) => { err += s; } });
    } finally {
      process.chdir(before);
    }
    assert.strictEqual(code, 0, `${args.join(' ')}: ${err}`);
    return JSON.parse(out);
  };

  const boot = cli(repo, ['coordinate', 'bootstrap', '--blueprint', BP_REL]);
  assert.strictEqual(boot.ok, true);
  assert.deepStrictEqual(boot.ready, ['001']);

  const prepared = cli(boot.integrationPath, ['coordinate', 'prepare', '--blueprint', BP_REL, '--repo', repo]);
  const worker = prepared.tasks[0].workerPath;

  fs.writeFileSync(path.join(worker, 'src/login.js'), 'implemented\n');
  git(worker, ['add', 'src/login.js']);
  git(worker, ['commit', '-m', 'feat: login']);
  const workerSha = git(worker, ['rev-parse', 'HEAD']);

  const recorded = cli(worker, [
    'coordinate', 'record', '--blueprint', BP_REL, '--repo', repo,
    '--task', '001', '--sha', workerSha,
  ]);
  assert.strictEqual(recorded.task.sha, workerSha);

  const integrated = cli(boot.integrationPath, [
    'coordinate', 'integrate', '--blueprint', BP_REL, '--repo', repo, '--task', '001',
  ]);
  assert.strictEqual(integrated.task.status, 'integrated');

  const ready = cli(boot.integrationPath, ['coordinate', 'ready', '--blueprint', BP_REL, '--repo', repo]);
  assert.deepStrictEqual(ready.ready, []);
  assert.strictEqual(
    fs.readFileSync(path.join(boot.integrationPath, 'src/login.js'), 'utf8'),
    'implemented\n',
  );
  // main worktree는 provenance 위치일 뿐이라 fan-in이 그 source를 바꾸지 않는다.
  assert.strictEqual(fs.readFileSync(path.join(repo, 'src/login.js'), 'utf8'), 'base\n');
});
