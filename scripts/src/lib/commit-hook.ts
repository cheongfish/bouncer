// scripts/lib/commit-hook.js
'use strict';
const path = require('node:path');
const { execFileSync } = require('node:child_process');
const { checkCommitSafety } = require('./commit-guard');
const { readCurrent } = require('./current');
const { readDoc } = require('./frontmatter');
const { listTasksDocs } = require('./tasks-docs');

// guard는 실수를 막습니다. 의도적 우회에 대한 방어는 아닙니다
// (docs/security.md의 threat model 참고). 명령을 판단할 수 없는 경우 —
// 중첩 셸, 셸 확장, alias — commit으로 보고하고 통과시키지 않아
// scope 검사가 여전히 실행됩니다.
const SHELLS = new Set(['sh', 'bash', 'zsh', 'dash', 'ksh', 'ash']);
const GIT_VALUE_FLAGS = new Set([
  '-C', '-c', '--git-dir', '--work-tree', '--namespace', '--exec-path', '--super-prefix',
]);
const SHELL_COMMAND_FLAG = /^-[A-Za-z]*c$/;
const EXPANSION = /[$`]/;
const MAX_DEPTH = 4;

// 공백과 새 명령을 시작하는 연산자 모두에서 분리하되, 따옴표 밖에서만.
// 따옴표 토큰은 표시됩니다: 따옴표 안 단어는 데이터(인자)이지 명령 이름이
// 아니므로 `echo "git commit"`을 commit으로 읽으면 안 됩니다.
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
  // `!` alias는 임의의 셸 명령을 실행합니다. 그 외는 git 자체 argv입니다.
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
        // 읽을 `bash -c` 내용이 없으면 무해한 게 아니라 판단 불가입니다.
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
    // 이 명령을 결정하는 단어는 런타임에 만들어집니다.
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
  // 임시 규칙(task 포인터 전): 커밋 허용 경로는 모든 task 문서 affected_paths의 합집합.
  // 검증 명령 채택(첫 선언)과 짝을 이룬다 — 둘 다 포인터가 생기면 좁혀진다.
  try {
    const listing = listTasksDocs({ repoRoot, blueprintDir });
    if (listing.mixed || listing.entries.length === 0) return [];
    const out: string[] = [];
    const seen = new Set();
    for (const entry of listing.entries) {
      try {
        const { data } = readDoc(path.join(repoRoot, entry.rel));
        const ap = data && data.bouncer ? data.bouncer.affected_paths : undefined;
        if (!Array.isArray(ap)) continue;
        for (const p of ap) {
          if (typeof p === 'string' && !seen.has(p)) {
            seen.add(p);
            out.push(p);
          }
        }
      } catch (_e) {
        // 깨진 문서는 건너뛴다.
      }
    }
    return out;
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

// active pointer는 Git common directory에 있으므로 primary와 linked worktree
// 모두 main working tree를 찾지 않고 같은 state를 resolve합니다.
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
