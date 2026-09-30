'use strict';

const { existsSync, statSync } = require('node:fs');
const path = require('node:path');

// Stage prompts and CLI arguments shared by the ACP and print-mode stage runners.
const stages = new Map([
  ['bouncer-init', 'Invoke /bouncer-init for the supplied PRD. Set subagents.provider to cursor and '
    + 'subagents.dispatch to "print" in .bouncer/config.json. '
    + 'Ask for every required user decision.'],
  ['bouncer-plan', 'Invoke /bouncer-plan for the supplied PRD and complete its plan gate. '
    + 'Ask for every required user decision.'],
  ['bouncer-run', 'Invoke /bouncer-run on the approved blueprint. Ask for every required user decision.'],
  ['bouncer-finalize', 'Invoke /bouncer-finalize in the verified integration worktree. '
    + 'Ask for every required user decision. For the quiz, number every question Q1..QN, '
    + 'show A), B), C) options, and request all answers in one batch.'],
]);

function argsOf(argv) {
  const out = {};
  for (let i = 0; i < argv.length; i += 2) {
    const allowed = ['--task', '--stage', '--work-dir', '--session-cwd', '--run-dir', '--model', '--key-file', '--policy',
      '--timeout-minutes'];
    if (!allowed.includes(argv[i])
      || !argv[i + 1] || out[argv[i]]) throw new Error(`invalid option: ${argv[i]}`);
    out[argv[i]] = argv[i + 1];
  }
  for (const required of ['--stage', '--work-dir', '--run-dir', '--model', '--key-file', '--policy']) {
    if (!out[required]) throw new Error(`${required} is required`);
  }
  if (!stages.has(out['--stage'])) throw new Error('unknown stage');
  out.taskId = out['--task'] ?? 'ledger-001';
  const minutes = Number(out['--timeout-minutes'] ?? 30);
  if (!Number.isInteger(minutes) || minutes < 1 || minutes > 240) throw new Error('invalid timeout');
  out.timeoutMs = minutes * 60_000;
  for (const key of ['--work-dir', '--run-dir', '--key-file', '--policy']) out[key] = path.resolve(out[key]);
  if (!existsSync(out['--work-dir']) || !statSync(out['--work-dir']).isDirectory()) {
    throw new Error('work directory missing');
  }
  if (!existsSync(out['--key-file']) || statSync(out['--key-file']).size === 0) throw new Error('API key file missing');
  out.sessionCwd = out['--session-cwd'] ? path.resolve(out['--session-cwd']) : out['--work-dir'];
  const relative = path.relative(out['--work-dir'], out.sessionCwd);
  if (relative.startsWith('..') || path.isAbsolute(relative)
    || !existsSync(out.sessionCwd) || !statSync(out.sessionCwd).isDirectory()) {
    throw new Error('session cwd must be inside the work directory');
  }
  out.containerCwd = path.posix.join('/workspace', relative.split(path.sep).join('/'));
  if (existsSync(out['--run-dir'])) throw new Error('run directory already exists');
  return out;
}

module.exports = { argsOf, stages };
