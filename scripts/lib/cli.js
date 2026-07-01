'use strict';
const { validateBlueprint } = require('./validate');

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
  const result = validateBlueprint({
    repoRoot: f.repo || process.cwd(),
    blueprintDir: f.blueprint,
    gate: typeof f.gate === 'string' ? f.gate : undefined,
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
    default:
      err(`unknown command: ${cmd}\n`);
      return 2;
  }
}

module.exports = { runCli, parseFlags };
