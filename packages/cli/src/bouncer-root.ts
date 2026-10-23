import fs from 'node:fs';
import { findPluginCandidates, parseHost, resolvePluginRoot, type BouncerHost } from './plugin-root';

interface Io {
  out?: (text: string) => void;
  err?: (text: string) => void;
  isTTY?: boolean;
  readInput?: () => string;
  env?: NodeJS.ProcessEnv;
  homeDir?: string;
}

export function runBouncerRoot(argv: string[], io: Io = {}): number {
  const out = io.out ?? ((text: string) => process.stdout.write(text));
  const err = io.err ?? ((text: string) => process.stderr.write(text));
  let host: BouncerHost | undefined;
  let select = false;
  for (let index = 0; index < argv.length; index += 1) {
    const flag = argv[index];
    if (flag === '--auto') continue;
    if (flag === '--select') { select = true; continue; }
    if (flag === '--host') {
      const parsedHost = parseHost(argv[index + 1]);
      if (!parsedHost) { err('bouncer-root: --host must be claude, codex, or antigravity\n'); return 1; }
      host = parsedHost;
      index += 1;
      continue;
    }
    err(`bouncer-root: unknown argument: ${flag}\n`);
    return 1;
  }
  if (select) {
    if (!(io.isTTY ?? process.stdin.isTTY)) { err('bouncer-root: --select requires a TTY\n'); return 1; }
    if ((io.env ?? process.env).BOUNCER_HOME !== undefined) {
      try { out(`${resolvePluginRoot(io, host ?? undefined).path}\n`); return 0; }
      catch (error) { err(`bouncer-root: ${(error as Error).message}\n`); return 1; }
    }
    const candidates = findPluginCandidates(io, host ?? undefined);
    if (!candidates.length) { err('bouncer-root: no valid Bouncer plugin roots found\n'); return 1; }
    candidates.forEach((candidate, index) => err(`${index + 1}) ${candidate.path} (${candidate.version})\n`));
    const input = (io.readInput ?? (() => fs.readFileSync(0, 'utf8')))().trim();
    const selected = /^\d+$/.test(input) ? candidates[Number(input) - 1] : undefined;
    if (!selected) { err('bouncer-root: invalid selection\n'); return 1; }
    out(`${selected.path}\n`);
    return 0;
  }
  try { out(`${resolvePluginRoot(io, host ?? undefined).path}\n`); return 0; }
  catch (error) { err(`bouncer-root: ${(error as Error).message}\n`); return 1; }
}
