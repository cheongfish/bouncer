// scripts/lib/commit-hook.js
'use strict';
const path = require('node:path');
const { execFileSync } = require('node:child_process');
const { checkCommitSafety } = require('./commit-guard');
const { readCurrent } = require('./current');
const { readDoc } = require('./frontmatter');

// The guard prevents mistakes; it is not a defense against a determined bypass
// (see the threat model in docs/security.md). Where a command cannot be decided —
// a nested shell, a shell expansion, an alias — it reports a commit rather than
// waving the command through, so the scope check still runs.
const SHELLS = new Set(['sh', 'bash', 'zsh', 'dash', 'ksh', 'ash']);
const GIT_VALUE_FLAGS = new Set([
  '-C', '-c', '--git-dir', '--work-tree', '--namespace', '--exec-path', '--super-prefix',
]);
const SHELL_COMMAND_FLAG = /^-[A-Za-z]*c$/;
const EXPANSION = /[$`]/;
const MAX_DEPTH = 4;

// Splits on whitespace and on the operators that begin a new command, both only
// outside quotes. Quoted tokens are marked: a quoted word is data (an argument),
// never a command name, so `echo "git commit"` must not read as a commit.
function tokenize(command) {
  const tokens = [];
  let value = '';
  let started = false;
  let quoted = false;
  const push = () => {
    if (started) tokens.push({ value, quoted });
    value = '';
    started = false;
    quoted = false;
  };
  for (let i = 0; i < command.length; i += 1) {
    const ch = command[i];
    if (ch === '\\' && i + 1 < command.length) {
      value += command[i + 1];
      started = true;
      i += 1;
    } else if (ch === '"' || ch === "'") {
      const end = command.indexOf(ch, i + 1);
      const stop = end === -1 ? command.length : end;
      value += command.slice(i + 1, stop);
      started = true;
      quoted = true;
      i = stop;
    } else if (/\s/.test(ch)) {
      push();
      if (ch === '\n') tokens.push({ separator: true });
    } else if (ch === ';' || ch === '&' || ch === '|') {
      push();
      tokens.push({ separator: true });
    } else {
      value += ch;
      started = true;
    }
  }
  push();
  return tokens;
}

function segments(tokens) {
  const out = [[]];
  for (const token of tokens) {
    if (token.separator) out.push([]);
    else out[out.length - 1].push(token);
  }
  return out.filter((seg) => seg.length);
}

function isWord(token, word) {
  return !token.quoted && token.value === word;
}

function aliasIsCommit(name, resolveAlias, depth) {
  if (typeof resolveAlias !== 'function') return false;
  let expansion;
  try {
    expansion = (resolveAlias(name) || '').trim();
  } catch (_e) {
    return false;
  }
  if (!expansion) return false;
  // A `!` alias runs an arbitrary shell command; anything else is git's own argv.
  return expansion.startsWith('!')
    ? detect(expansion.slice(1), resolveAlias, depth + 1)
    : detect(`git ${expansion}`, resolveAlias, depth + 1);
}

function segmentIsGitCommit(tokens, resolveAlias, depth) {
  const shellIdx = tokens.findIndex(
    (t) => !t.quoted && SHELLS.has(path.basename(t.value)),
  );
  if (shellIdx !== -1) {
    for (let i = shellIdx + 1; i < tokens.length; i += 1) {
      if (!tokens[i].quoted && SHELL_COMMAND_FLAG.test(tokens[i].value)) {
        const script = tokens[i + 1];
        // `bash -c` with nothing to read is undecidable, not harmless.
        if (!script) return true;
        return detect(script.value, resolveAlias, depth + 1);
      }
    }
  }

  const gitIdx = tokens.findIndex((t) => isWord(t, 'git'));
  if (gitIdx === -1) return false;
  let i = gitIdx + 1;
  while (i < tokens.length) {
    const t = tokens[i];
    // The word that decides this command is produced at runtime.
    if (EXPANSION.test(t.value)) return true;
    if (t.value.startsWith('-')) {
      i += GIT_VALUE_FLAGS.has(t.value) ? 2 : 1;
      continue;
    }
    if (t.value === 'commit') return true;
    return aliasIsCommit(t.value, resolveAlias, depth);
  }
  return false;
}

function detect(command, resolveAlias, depth) {
  if (typeof command !== 'string') return false;
  if (depth >= MAX_DEPTH) return true;
  return segments(tokenize(command))
    .some((seg) => segmentIsGitCommit(seg, resolveAlias, depth));
}

function realResolveAlias(cwd) {
  return (name) => {
    try {
      return execFileSync('git', ['config', '--get', `alias.${name}`], {
        cwd, encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'],
      });
    } catch (_e) {
      return '';
    }
  };
}

function isGitCommit(command, { resolveAlias, cwd }: { resolveAlias?: any; cwd?: any } = {}) {
  const resolver = resolveAlias === undefined ? realResolveAlias(cwd) : resolveAlias;
  return detect(command, resolver, 0);
}

function readAffectedPaths({ repoRoot, blueprintDir }) {
  try {
    const abs = path.join(repoRoot, blueprintDir, 'tasks.md');
    const { data } = readDoc(abs);
    const ap = data && data.bouncer ? data.bouncer.affected_paths : undefined;
    return Array.isArray(ap) ? ap : [];
  } catch (_e) {
    return [];
  }
}

function realStagedFiles({ repoRoot }) {
  const out = execFileSync('git', ['diff', '--cached', '--name-only'], {
    cwd: repoRoot, encoding: 'utf8',
  });
  return out.split('\n').filter(Boolean);
}

// The active pointer lives in the Git common directory, so primary and linked
// worktrees both resolve the same state without locating a main working tree.
function realMainRepoCurrent({ repoRoot, deps }) {
  return readCurrent({ repoRoot, deps });
}

function evaluateCommit({ command, repoRoot, deps }) {
  const d = {
    readCurrent,
    readAffectedPaths,
    stagedFiles: realStagedFiles,
    mainRepoCurrent: realMainRepoCurrent,
    ...(deps || {}),
  };
  if (!isGitCommit(command, { cwd: repoRoot })) return { block: false };
  const current = d.readCurrent({ repoRoot }) || d.mainRepoCurrent({ repoRoot });
  if (!current) return { block: false };
  const affectedPaths = d.readAffectedPaths({ repoRoot, blueprintDir: current.blueprint });
  const files = d.stagedFiles({ repoRoot });
  const { allow, violations } = checkCommitSafety({
    files, affectedPaths, blueprintDir: current.blueprint,
  });
  if (allow) return { block: false };
  return {
    block: true,
    reason: `commit blocked: files outside affected_paths: ${violations.join(', ')}`,
  };
}

module.exports = {
  isGitCommit, readAffectedPaths, evaluateCommit, realStagedFiles, realMainRepoCurrent,
};
