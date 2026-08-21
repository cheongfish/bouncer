// scripts/lib/commit-hook.js
'use strict';
const path = require('node:path');
const { execFileSync } = require('node:child_process');
const { checkCommitSafety } = require('./commit-guard') as {
  checkCommitSafety: (opts: {
    files?: unknown;
    affectedPaths?: unknown;
    blueprintDir?: unknown;
  }) => { allow: boolean; violations: unknown[] };
};
const { readCurrent } = require('./current') as {
  readCurrent: (opts: { repoRoot: string; deps?: unknown }) => {
    blueprint: string;
    task?: unknown;
  } | null;
};
const { readDoc } = require('./frontmatter') as {
  readDoc: (absPath: string) => { data: unknown; body: string; path: string };
};
const { listTasksDocs } = require('./tasks-docs') as {
  listTasksDocs: (opts: { repoRoot: string; blueprintDir: string }) => {
    mixed: boolean;
    entries: Array<{ rel: string }>;
  };
};
const { toPosix } = require('./paths') as {
  toPosix: (p: unknown) => string;
};

type WordToken = { value: string; quoted: boolean; separator?: undefined };
type SepToken = { separator: true };
type Token = WordToken | SepToken;
type ResolveAlias = (name: string) => string;

type CommitHookDeps = {
  readCurrent?: (opts: { repoRoot: string }) => {
    blueprint: string;
    task?: unknown;
  } | null;
  readAffectedPaths?: (opts: { repoRoot: string; blueprintDir: string }) => string[];
  stagedFiles?: (opts: { repoRoot: string }) => string[];
  trackedModified?: (opts: { repoRoot: string }) => string[];
  mainRepoCurrent?: (opts: { repoRoot: string; deps?: unknown }) => {
    blueprint: string;
    task?: unknown;
  } | null;
};

type CommitJudgment = { commit: boolean; all: boolean };

const NO_COMMIT: CommitJudgment = { commit: false, all: false };
// 판단 불가(중첩 셸·확장·깊이 초과)는 커밋으로 칠 뿐 아니라 all-flag도
// 있는 것으로 친다. -a 없이 스테이징만 보면 PreToolUse 시점에 인덱스가
// 비어 범위 밖 파일이 그대로 들어간다.
const FAIL_CLOSED: CommitJudgment = { commit: true, all: true };

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
function tokenize(command: string): Token[] {
  const tokens: Token[] = [];
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

function segments(tokens: Token[]): WordToken[][] {
  const out: WordToken[][] = [[]];
  for (const token of tokens) {
    if (token.separator) out.push([]);
    else out[out.length - 1].push(token as WordToken);
  }
  return out.filter((seg) => seg.length);
}

function isWord(token: WordToken, word: string): boolean {
  return !token.quoted && token.value === word;
}

function orJudgment(a: CommitJudgment, b: CommitJudgment): CommitJudgment {
  return { commit: a.commit || b.commit, all: a.all || b.all };
}

function argvHasAllFlag(tokens: WordToken[], start: number): boolean {
  for (let i = start; i < tokens.length; i += 1) {
    const t = tokens[i];
    // 따옴표 토큰은 데이터다. `git commit -m "-a"`의 "-a"를 --all로 읽으면 안 된다.
    if (t.quoted) continue;
    const v = t.value;
    if (v === '--message' || v === '-m') {
      i += 1;
      continue;
    }
    if (v.startsWith('--message=')) continue;
    // 롱 옵션은 이름 전체가 정확히 --all일 때만. --amend/--author=/--allow-empty는
    // '-'로 시작하고 a를 포함하지만 all-flag가 아니다.
    if (v === '--all') return true;
    if (v.startsWith('--')) continue;
    if (v.startsWith('-')) {
      if (v.includes('a')) return true;
      // -nm 처럼 m이 묶음에 있으면 다음 토큰은 메시지 값이다.
      if (v.includes('m')) i += 1;
    }
  }
  return false;
}

function aliasIsCommit(
  name: string,
  rest: WordToken[],
  resolveAlias: ResolveAlias | unknown,
  depth: number,
): CommitJudgment {
  if (typeof resolveAlias !== 'function') return NO_COMMIT;
  let expansion;
  try {
    expansion = ((resolveAlias as ResolveAlias)(name) || '').trim();
  } catch (_e) {
    return NO_COMMIT;
  }
  if (!expansion) return NO_COMMIT;
  // `!` alias는 임의의 셸 명령을 실행합니다. 그 외는 git 자체 argv입니다.
  const nested = expansion.startsWith('!')
    ? detect(expansion.slice(1), resolveAlias, depth + 1)
    : detect(`git ${expansion}`, resolveAlias, depth + 1);
  // alias 뒤에 붙은 원래 argv(-am 등)는 확장 문자열에 안 들어 있다.
  if (nested.commit && argvHasAllFlag(rest, 0)) {
    return { commit: true, all: true };
  }
  return nested;
}

function segmentIsGitCommit(
  tokens: WordToken[],
  resolveAlias: ResolveAlias | unknown,
  depth: number,
): CommitJudgment {
  const shellIdx = tokens.findIndex(
    (t) => !t.quoted && SHELLS.has(path.basename(t.value)),
  );
  if (shellIdx !== -1) {
    for (let i = shellIdx + 1; i < tokens.length; i += 1) {
      if (!tokens[i].quoted && SHELL_COMMAND_FLAG.test(tokens[i].value)) {
        const script = tokens[i + 1];
        // 읽을 `bash -c` 내용이 없으면 무해한 게 아니라 판단 불가입니다.
        if (!script) return FAIL_CLOSED;
        return detect(script.value, resolveAlias, depth + 1);
      }
    }
  }

  const gitIdx = tokens.findIndex((t) => isWord(t, 'git'));
  if (gitIdx === -1) return NO_COMMIT;
  let i = gitIdx + 1;
  while (i < tokens.length) {
    const t = tokens[i];
    // 이 명령을 결정하는 단어는 런타임에 만들어집니다.
    if (EXPANSION.test(t.value)) return FAIL_CLOSED;
    if (t.value.startsWith('-')) {
      i += GIT_VALUE_FLAGS.has(t.value) ? 2 : 1;
      continue;
    }
    if (t.value === 'commit') {
      return { commit: true, all: argvHasAllFlag(tokens, i + 1) };
    }
    return aliasIsCommit(t.value, tokens.slice(i + 1), resolveAlias, depth);
  }
  return NO_COMMIT;
}

function detect(
  command: unknown,
  resolveAlias: ResolveAlias | unknown,
  depth: number,
): CommitJudgment {
  if (typeof command !== 'string') return NO_COMMIT;
  if (depth >= MAX_DEPTH) return FAIL_CLOSED;
  return segments(tokenize(command))
    .reduce(
      (acc, seg) => orJudgment(acc, segmentIsGitCommit(seg, resolveAlias, depth)),
      NO_COMMIT,
    );
}

function realResolveAlias(cwd: unknown): ResolveAlias {
  return (name: string) => {
    try {
      return execFileSync('git', ['config', '--get', `alias.${name}`], {
        cwd, encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'],
      });
    } catch (_e) {
      return '';
    }
  };
}

function isGitCommit(command: unknown, { resolveAlias, cwd }: {
  resolveAlias?: unknown;
  cwd?: unknown;
} = {}): boolean {
  const resolver = resolveAlias === undefined ? realResolveAlias(cwd) : resolveAlias;
  return detect(command, resolver, 0).commit;
}

function pathsFromTaskDoc(repoRoot: string, entryRel: string): string[] {
  try {
    const { data } = readDoc(path.join(repoRoot, entryRel));
    const bouncer = data ? (data as Record<string, unknown>).bouncer : data;
    const ap = bouncer ? (bouncer as Record<string, unknown>).affected_paths : undefined;
    if (!Array.isArray(ap)) return [];
    return ap.filter((p) => typeof p === 'string');
  } catch (_e) {
    return [];
  }
}

function readAffectedPaths({ repoRoot, blueprintDir }: {
  repoRoot: string;
  blueprintDir: string;
}): string[] {
  // 포인터 task 가 있으면 그 문서의 affected_paths 만. 없으면 전체 합집합.
  // 가리키던 문서가 사라진 경우에만 합집합으로 폴백한다.
  try {
    const listing = listTasksDocs({ repoRoot, blueprintDir });
    if (listing.mixed || listing.entries.length === 0) return [];

    const pointer = readCurrent({ repoRoot });
    const bp = toPosix(blueprintDir);
    if (
      pointer
      && typeof pointer.task === 'string'
      && toPosix(pointer.blueprint) === bp
    ) {
      const match = listing.entries.find((e) => e.rel === toPosix(pointer.task));
      if (match) return pathsFromTaskDoc(repoRoot, match.rel);
    }

    const out: string[] = [];
    const seen = new Set<string>();
    for (const entry of listing.entries) {
      for (const p of pathsFromTaskDoc(repoRoot, entry.rel)) {
        if (!seen.has(p)) {
          seen.add(p);
          out.push(p);
        }
      }
    }
    return out;
  } catch (_e) {
    return [];
  }
}

function realStagedFiles({ repoRoot }: { repoRoot: string }): string[] {
  const out = execFileSync('git', ['diff', '--cached', '--name-only'], {
    cwd: repoRoot, encoding: 'utf8',
  }) as string;
  return out.split('\n').filter(Boolean);
}

function realTrackedModified({ repoRoot }: { repoRoot: string }): string[] {
  // -a/--all 이 담는 것은 인덱스만이 아니라 HEAD 대비 추적 중 수정이다.
  // 삭제된 경로가 섞이므로 이름을 쓸 뿐 파일 내용은 읽지 않는다.
  // git 실패는 삼키지 않는다: 훅 어댑터가 throw를 fail-closed로 exit 2 한다.
  const out = execFileSync('git', ['diff', 'HEAD', '--name-only'], {
    cwd: repoRoot, encoding: 'utf8',
  }) as string;
  return out.split('\n').filter(Boolean);
}

// active pointer는 Git common directory에 있으므로 primary와 linked worktree
// 모두 main working tree를 찾지 않고 같은 state를 resolve합니다.
function realMainRepoCurrent({ repoRoot, deps }: { repoRoot: string; deps?: unknown }) {
  return readCurrent({ repoRoot, deps });
}

function evaluateCommit({ command, repoRoot, deps }: {
  command: unknown;
  repoRoot: string;
  deps?: CommitHookDeps | null;
}) {
  const d = {
    readCurrent,
    readAffectedPaths,
    stagedFiles: realStagedFiles,
    trackedModified: realTrackedModified,
    mainRepoCurrent: realMainRepoCurrent,
    ...(deps || {}),
  };
  const judgment = detect(command, realResolveAlias(repoRoot), 0);
  if (!judgment.commit) return { block: false };
  const current = d.readCurrent({ repoRoot }) || d.mainRepoCurrent({ repoRoot });
  if (!current) return { block: false };
  const affectedPaths = d.readAffectedPaths({ repoRoot, blueprintDir: current.blueprint });
  const files = judgment.all
    ? [...new Set([...d.stagedFiles({ repoRoot }), ...d.trackedModified({ repoRoot })])]
    : d.stagedFiles({ repoRoot });
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
  isGitCommit, readAffectedPaths, evaluateCommit, realStagedFiles, realTrackedModified,
  realMainRepoCurrent,
};
