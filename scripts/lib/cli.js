'use strict';
const { validateBlueprint } = require('./validate');
const { scaffoldEpic, scaffoldBlueprint } = require('./scaffold');
const { finalize } = require('./finalize');

function parseFlags(rest) {
  const flags = {};
  for (let i = 0; i < rest.length; i += 1) {
    const tok = rest[i];
    if (!tok.startsWith('--')) continue;
    const key = tok.slice(2);
    const next = rest[i + 1];
    if (next === undefined || next.startsWith('--')) {
      flags[key] = true;
    } else {
      flags[key] = next;
      i += 1;
    }
  }
  return flags;
}

function cmdValidate(rest, io) {
  const f = parseFlags(rest);
  if (typeof f.blueprint !== 'string' || f.blueprint === '') {
    io.err('validate: --blueprint is required\n');
    return 2;
  }
  const result = validateBlueprint({
    repoRoot: f.repo || process.cwd(),
    blueprintDir: f.blueprint,
    gate: typeof f.gate === 'string' ? f.gate : undefined,
  });
  io.out(`${JSON.stringify(result, null, 2)}\n`);
  return result.ok ? 0 : 1;
}

function cmdScaffold(rest, io) {
  const [kind, ...flagArgs] = rest;
  const f = parseFlags(flagArgs);
  const repoRoot = f.repo || process.cwd();
  const timestamp = typeof f.timestamp === 'string' ? f.timestamp : new Date().toISOString();
  let created;
  if (kind === 'epic') {
    created = scaffoldEpic({ repoRoot, epicId: f.id, name: f.name, timestamp });
  } else if (kind === 'blueprint') {
    created = scaffoldBlueprint({
      repoRoot, epicDir: f['epic-dir'], blueprintId: f.id, name: f.name, timestamp,
    });
  } else {
    io.err(`unknown scaffold kind: ${kind}\n`);
    return 2;
  }
  io.out(`${JSON.stringify({ ok: true, created }, null, 2)}\n`);
  return 0;
}

function cmdFinalize(rest, io) {
  const f = parseFlags(rest);
  if (typeof f.blueprint !== 'string' || f.blueprint === '') {
    io.err('finalize: --blueprint is required\n');
    return 2;
  }
  const result = finalize({
    repoRoot: f.repo || process.cwd(),
    blueprintDir: f.blueprint,
    yes: f.yes === true,
  });
  io.out(`${JSON.stringify(result, null, 2)}\n`);
  return result.ok ? 0 : 1;
}

function runCli(argv, io) {
  const out = io && io.out ? io.out : (s) => process.stdout.write(s);
  const err = io && io.err ? io.err : (s) => process.stderr.write(s);
  const sink = { out, err };
  const [cmd, ...rest] = argv;
  switch (cmd) {
    case 'validate':
      return cmdValidate(rest, sink);
    case 'scaffold':
      return cmdScaffold(rest, sink);
    case 'finalize':
      return cmdFinalize(rest, sink);
    default:
      err(`unknown command: ${cmd}\n`);
      return 2;
  }
}

module.exports = { runCli, parseFlags };
