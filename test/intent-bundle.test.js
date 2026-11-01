'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { runCli } = require('../packages/cli/dist/cli');

function capture(args) {
  let out = ''; let err = '';
  const code = runCli(['intent', 'sections', ...args], { out: (s) => { out += s; }, err: (s) => { err += s; } });
  return { code, out, err };
}

test('multiple reviewer tasks with invalid and duplicate paths → report each failure', () => {
  const result = capture(['--task', 'bad', '--task', 'bad', '--role', 'reviewer']);
  assert.equal(result.code, 1);
  const body = JSON.parse(result.out);
  assert.equal(body.reason, 'intent-sections-partial');
  assert.deepEqual(body.failures, [{ task: 'bad', reason: 'intent-task-invalid' },
    { task: 'bad', reason: 'intent-task-duplicate' }]);
});

test('multiple non-reviewer tasks → reject as intent-task-invalid', () => {
  const result = capture(['--task', 'a', '--task', 'b', '--role', 'implementer']);
  assert.equal(result.code, 1);
  assert.equal(JSON.parse(result.out).reason, 'intent-task-invalid');
});

test('reviewer task batch → preserves single projections and successful results on partial failure', (t) => {
  const fs = require('node:fs');
  const os = require('node:os');
  const path = require('node:path');
  const { execFileSync } = require('node:child_process');
  const repo = fs.mkdtempSync(path.join(os.tmpdir(), 'intent-batch-'));
  t.after(() => fs.rmSync(repo, { recursive: true, force: true }));
  execFileSync('git', ['init', '-q', repo]);
  const tasks = ['001', '002'].map((id) => `.bouncer/context/epics/sample/blueprints/demo/tasks/${id}/tasks.md`);
  for (const [index, task] of tasks.entries()) {
    const file = path.join(repo, task);
    fs.mkdirSync(path.dirname(file), { recursive: true });
    fs.writeFileSync(file, `---\nbouncer:\n  id: TASKS-00${index + 1}\n  epic_id: sample\n  blueprint_id: demo\n---\n\n## Goal & intent\nTask ${index + 1}\n`);
    let output = '';
    const code = runCli(['intent', 'bundle', '--task', task, '--no-symbols', '--repo', repo], {
      out: (s) => { output += s; }, err: (s) => { output += s; },
    });
    assert.equal(code, 0, output);
  }
  const singles = tasks.map((task) => capture(['--task', task, '--role', 'reviewer', '--repo', repo]));
  for (const single of singles) assert.equal(single.code, 0, single.out + single.err);
  const batch = capture(['--task', tasks[0], '--task', tasks[1], '--role', 'reviewer', '--repo', repo]);
  assert.equal(batch.code, 0);
  assert.deepEqual(JSON.parse(batch.out), {
    ok: true, tasks: tasks.map((task, i) => ({ task, sections: JSON.parse(singles[i].out) })),
  });
  const invalid = 'bad';
  const partial = capture(['--task', tasks[0], '--task', invalid, '--role', 'reviewer', '--repo', repo]);
  assert.equal(partial.code, 1);
  assert.deepEqual(JSON.parse(partial.out), {
    ok: false, reason: 'intent-sections-partial', failures: [{ task: invalid, reason: 'intent-task-invalid' }],
    tasks: [{ task: tasks[0], sections: JSON.parse(singles[0].out) }],
  });
  const direct = require('../packages/cli/dist/intent-bundle').projectRoleIntentSections({
    repoRoot: repo, taskFile: tasks[0], role: 'reviewer',
  });
  assert.equal(singles[0].out, `${JSON.stringify(direct, null, 2)}\n`);
});
