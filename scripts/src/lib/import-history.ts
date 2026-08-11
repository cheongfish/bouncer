'use strict';
const fs = require('node:fs');
const path = require('node:path');
const { execFileSync: realExecFileSync } = require('node:child_process');
const { CONTEXT_ROOT } = require('./layout');
const { isNumericContextId } = require('./paths');
const { listEpicDirNames } = require('./epic-index');
const { readRuntimeCurrent } = require('./runtime-state');
const { isWorktreeDirty } = require('./migrate-ids');

const DEFAULT_LIMIT = 200;
const DEFAULT_EPIC_NAME = 'imported-history';
const LOG_FORMAT = '%H%x1f%s%x1f%aI%x1f%an';
const EPIC_ID_PREFIX_RE = /^(\d{3})-/;

type ImportRefusal = { code: string; message: string };
type ImportError = { code: string; message: string };
type ImportEntry = {
  sha: string;
  subject: string;
  date: string;
  author: string;
  files: string[];
  blueprintId: string;
  slug: string;
  blueprintDir: string;
};
type ImportPlan = {
  ok: boolean;
  source: 'merges' | 'commits';
  fellBack: boolean;
  epicId: string;
  epicName: string;
  epicDir: string;
  total: number;
  limit: number;
  entries: ImportEntry[];
  refusals: ImportRefusal[];
  error?: ImportError;
};
type RawCommit = {
  sha: string;
  subject: string;
  date: string;
  author: string;
};

function emptyPlan(partial: Partial<ImportPlan> & {
  source: ImportPlan['source'];
  epicId: string;
  epicName: string;
  epicDir: string;
  limit: number;
}): ImportPlan {
  return {
    ok: false,
    fellBack: false,
    total: 0,
    entries: [],
    refusals: [],
    ...partial,
  };
}

/** 제목에서 ASCII 슬러그를 뽑고, 한글·기호만 남으면 축약 sha로 떨어뜨린다. */
function slugFromSubject(subject: string, sha: string): string {
  const slug = String(subject || '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
  return slug || sha.slice(0, 7);
}

function parseLogOutput(text: string): RawCommit[] {
  const out: RawCommit[] = [];
  for (const line of String(text || '').split('\n')) {
    if (!line.trim()) continue;
    const parts = line.split('\x1f');
    if (parts.length < 4) continue;
    const [sha, subject, date, author] = parts;
    if (!sha) continue;
    out.push({
      sha,
      subject: subject || '',
      date: date || '',
      author: author || '',
    });
  }
  return out;
}

function gitLogArgs(kind: 'merges' | 'commits', since?: string): string[] {
  const args = kind === 'merges'
    ? ['log', '--merges', '--reverse', `--format=${LOG_FORMAT}`]
    : ['log', '--reverse', `--format=${LOG_FORMAT}`];
  // --since <ref> 는 날짜 해석이 아니라 <ref>..HEAD 범위다.
  if (typeof since === 'string' && since) args.push(`${since}..HEAD`);
  return args;
}

function listChangedFiles(
  execFileSync: typeof realExecFileSync,
  repoRoot: string,
  source: 'merges' | 'commits',
  sha: string,
): string[] {
  const args = source === 'merges'
    ? ['diff', '--name-only', `${sha}^1`, sha]
    : ['show', '--name-only', '--format=', sha];
  const out = execFileSync('git', args, {
    cwd: repoRoot,
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  return String(out || '')
    .split('\n')
    .map((l) => l.trim())
    .filter(Boolean);
}

/**
 * 사용 중인 epic 번호 중 가장 작은 빈 세 자리를 고른다.
 * 연속이면 max+1, 구멍이 있으면 그 구멍 — "다음 빈"이 둘 다 커버된다.
 */
function nextEpicId(repoRoot: string): string {
  const used = new Set<number>();
  for (const name of listEpicDirNames(repoRoot)) {
    const m = EPIC_ID_PREFIX_RE.exec(name);
    if (m) used.add(Number(m[1]));
  }
  for (let n = 1; n <= 999; n += 1) {
    if (!used.has(n)) return String(n).padStart(3, '0');
  }
  // 이론상만 도달 — 세 자리 공간이 가득 찬 상태.
  throw new Error('no free epic id in 001..999');
}

function collectRefusals({
  repoRoot,
  epicDir,
  execFileSync,
}: {
  repoRoot: string;
  epicDir: string;
  execFileSync: typeof realExecFileSync;
}): ImportRefusal[] {
  const refusals: ImportRefusal[] = [];
  // 적용 단계 차단 사유만 계산한다. 여기서 ok 를 뒤집지 않는다.
  if (isWorktreeDirty(repoRoot, execFileSync)) {
    refusals.push({
      code: 'IMPORT_WORKTREE_DIRTY',
      message: 'worktree has uncommitted changes; commit or stash before apply',
    });
  }
  const current = readRuntimeCurrent({
    repoRoot,
    deps: { execFileSync },
  });
  if (current) {
    refusals.push({
      code: 'IMPORT_POINTER_ACTIVE',
      message: `active pointer exists at blueprint ${current.blueprint}`,
    });
  }
  if (fs.existsSync(path.join(repoRoot, epicDir))) {
    refusals.push({
      code: 'IMPORT_EPIC_DIR_EXISTS',
      message: `epic directory already exists: ${epicDir}`,
    });
  }
  const indexRel = `${CONTEXT_ROOT}/index.md`;
  if (!fs.existsSync(path.join(repoRoot, indexRel))) {
    refusals.push({
      code: 'IMPORT_CONTEXT_INDEX_MISSING',
      message: `missing ${indexRel}; run bouncer init before import`,
    });
  }
  return refusals;
}

function planImport({
  repoRoot,
  source,
  since,
  limit,
  epicId,
  epicName,
  deps,
}: {
  repoRoot: string;
  source?: string;
  since?: string;
  limit?: number;
  epicId?: string;
  epicName?: string;
  deps?: { execFileSync?: typeof realExecFileSync };
}): ImportPlan {
  const d = deps || {};
  const execFileSync = d.execFileSync || realExecFileSync;
  const resolvedLimit = typeof limit === 'number' && Number.isFinite(limit)
    ? limit
    : DEFAULT_LIMIT;
  const resolvedName = typeof epicName === 'string' && epicName
    ? epicName
    : DEFAULT_EPIC_NAME;

  // source 미지정 = 자동(머지 우선). 명시값만 merges|commits 화이트리스트.
  const sourceSpecified = source !== undefined && source !== null && source !== '';
  if (sourceSpecified && source !== 'merges' && source !== 'commits') {
    const id = typeof epicId === 'string' && epicId ? epicId : '000';
    return emptyPlan({
      ok: false,
      source: 'merges',
      epicId: id,
      epicName: resolvedName,
      epicDir: `${CONTEXT_ROOT}/epics/${id}-${resolvedName}`,
      limit: resolvedLimit,
      error: {
        code: 'IMPORT_SOURCE_INVALID',
        message: `source must be merges or commits, got ${JSON.stringify(source)}`,
      },
    });
  }

  let resolvedEpicId: string;
  if (typeof epicId === 'string' && epicId) {
    if (!isNumericContextId(epicId)) {
      return emptyPlan({
        ok: false,
        source: (sourceSpecified ? source : 'merges') as 'merges' | 'commits',
        epicId,
        epicName: resolvedName,
        epicDir: `${CONTEXT_ROOT}/epics/${epicId}-${resolvedName}`,
        limit: resolvedLimit,
        error: {
          code: 'IMPORT_EPIC_ID_INVALID',
          message: `epicId must be a zero-padded three-digit id (\\d{3}), got ${JSON.stringify(epicId)}`,
        },
      });
    }
    resolvedEpicId = epicId;
  } else {
    resolvedEpicId = nextEpicId(repoRoot);
  }

  const epicDir = `${CONTEXT_ROOT}/epics/${resolvedEpicId}-${resolvedName}`;
  const baseFields = {
    epicId: resolvedEpicId,
    epicName: resolvedName,
    epicDir,
    limit: resolvedLimit,
  };

  let resolvedSource: 'merges' | 'commits';
  let fellBack = false;
  let raw: RawCommit[];

  if (sourceSpecified && source === 'commits') {
    resolvedSource = 'commits';
    raw = parseLogOutput(execFileSync('git', gitLogArgs('commits', since), {
      cwd: repoRoot,
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'pipe'],
    }));
  } else if (sourceSpecified && source === 'merges') {
    // 명시 merges 는 0건이어도 일반 커밋으로 폴백하지 않는다.
    resolvedSource = 'merges';
    raw = parseLogOutput(execFileSync('git', gitLogArgs('merges', since), {
      cwd: repoRoot,
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'pipe'],
    }));
  } else {
    const merges = parseLogOutput(execFileSync('git', gitLogArgs('merges', since), {
      cwd: repoRoot,
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'pipe'],
    }));
    if (merges.length > 0) {
      resolvedSource = 'merges';
      raw = merges;
    } else {
      resolvedSource = 'commits';
      fellBack = true;
      raw = parseLogOutput(execFileSync('git', gitLogArgs('commits', since), {
        cwd: repoRoot,
        encoding: 'utf8',
        stdio: ['ignore', 'pipe', 'pipe'],
      }));
    }
  }

  const total = raw.length;
  const refusals = collectRefusals({ repoRoot, epicDir, execFileSync });

  // 상한 초과는 앞에서 잘라 일부만 돌리지 않는다 — 전체 개수와 상한을 보고 중단.
  if (total > resolvedLimit) {
    return {
      ok: false,
      source: resolvedSource,
      fellBack,
      ...baseFields,
      total,
      entries: [],
      refusals,
      error: {
        code: 'IMPORT_LIMIT_EXCEEDED',
        message: `import candidate count ${total} exceeds limit ${resolvedLimit}`,
      },
    };
  }

  const entries: ImportEntry[] = raw.map((c, i) => {
    const blueprintId = String(i + 1).padStart(3, '0');
    const slug = slugFromSubject(c.subject, c.sha);
    return {
      sha: c.sha,
      subject: c.subject,
      date: c.date,
      author: c.author,
      files: listChangedFiles(execFileSync, repoRoot, resolvedSource, c.sha),
      blueprintId,
      slug,
      blueprintDir: `${blueprintId}-${slug}`,
    };
  });

  return {
    ok: true,
    source: resolvedSource,
    fellBack,
    ...baseFields,
    total,
    entries,
    refusals,
  };
}

module.exports = {
  planImport,
};
