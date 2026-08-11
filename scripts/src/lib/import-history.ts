'use strict';
const fs = require('node:fs');
const path = require('node:path');
const { execFileSync: realExecFileSync } = require('node:child_process');
const { CONTEXT_ROOT } = require('./layout');
const { isNumericContextId } = require('./paths');
const { listEpicDirNames, ensureEpicIndexEntry } = require('./epic-index');
const { readRuntimeCurrent } = require('./runtime-state');
const { isWorktreeDirty } = require('./migrate-ids');
const { renderDoc } = require('./render');
const { nowIsoKst } = require('./time');

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
type ImportResult = {
  ok: boolean;
  created: string[];
  committed: boolean;
  message?: string;
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

function failResult(error: ImportError): ImportResult {
  return { ok: false, created: [], committed: false, error };
}

/** 임포트 epic 본문. Success criteria 헤딩은 context digest 화이트리스트라 넣지 않는다. */
function renderEpicBody(plan: ImportPlan): string {
  const lines = [
    `# ${plan.epicId} ${plan.epicName}`,
    '',
    '## Intent',
    `- Imported from git ${plan.source}${plan.fellBack ? ' (fell back from merges)' : ''}.`,
    `- ${plan.entries.length} blueprint(s) transcribed from history.`,
    '',
    '## Blueprints',
  ];
  for (const e of plan.entries) {
    const title = e.subject || e.slug;
    lines.push(`* [${e.blueprintId} ${e.slug}](blueprints/${e.blueprintDir}/index.md) - ${title}`);
  }
  lines.push('');
  return lines.join('\n');
}

function renderBlueprintBody(plan: ImportPlan, entry: ImportEntry): string {
  const changeLines = entry.files.length
    ? entry.files.map((f) => `- ${f}`)
    : ['- (no files)'];
  return [
    `# ${entry.blueprintId} ${entry.slug}`,
    '',
    `Epic: [${plan.epicId}](../../index.md)`,
    '',
    '## Source',
    `- sha: \`${entry.sha}\``,
    `- date: ${entry.date}`,
    `- author: ${entry.author}`,
    '',
    '## Message',
    entry.subject || '(empty)',
    '',
    '## Changes',
    ...changeLines,
    '',
  ].join('\n');
}

function writeImportDoc(repoRoot: string, rel: string, data: object, body: string): string {
  const abs = path.join(repoRoot, rel);
  fs.mkdirSync(path.dirname(abs), { recursive: true });
  fs.writeFileSync(abs, renderDoc(data, body));
  return rel;
}

/**
 * 계획 → imported 문서 트리 → 단일 커밋.
 * 차단 판정은 전부 첫 파일 쓰기 전 — 부분 생성은 S13으로 저장소 전체를 깨뜨린다.
 */
function applyImport({
  repoRoot,
  plan,
  message,
  deps,
}: {
  repoRoot: string;
  plan: ImportPlan;
  message?: string;
  deps?: { execFileSync?: typeof realExecFileSync };
}): ImportResult {
  const d = deps || {};
  const execFileSync = d.execFileSync || realExecFileSync;

  if (!plan || plan.ok === false) {
    return failResult(plan && plan.error
      ? plan.error
      : { code: 'IMPORT_PLAN_INVALID', message: 'import plan is not ok' });
  }
  if (Array.isArray(plan.refusals) && plan.refusals.length > 0) {
    const first = plan.refusals[0];
    return failResult({ code: first.code, message: first.message });
  }

  const trimmed = typeof message === 'string' ? message.trim() : '';
  if (!trimmed) {
    return failResult({
      code: 'IMPORT_MESSAGE_REQUIRED',
      message: 'commit message is required to apply import',
    });
  }

  if (!Array.isArray(plan.entries) || plan.entries.length === 0) {
    return { ok: true, created: [], committed: false };
  }

  const timestamp = nowIsoKst();
  const epicRel = `${plan.epicDir}/index.md`;
  const epicDescription = `Imported history (${plan.source})`;
  const created: string[] = [];

  // 렌더 → 쓰기 → 목록 등록 → 스테이징 → 커밋. 중간에 멈추면 안 되므로
  // 거절은 위에서 전부 끝냈다.
  created.push(writeImportDoc(
    repoRoot,
    epicRel,
    {
      type: 'bouncer.epic',
      title: `${plan.epicId} ${plan.epicName}`,
      description: epicDescription,
      resource: epicRel,
      tags: ['bouncer', 'epic'],
      timestamp,
      bouncer: {
        id: plan.epicId,
        epic_id: plan.epicId,
        status: 'imported',
      },
    },
    renderEpicBody(plan),
  ));

  for (const entry of plan.entries) {
    const bpRel = `${plan.epicDir}/blueprints/${entry.blueprintDir}/index.md`;
    created.push(writeImportDoc(
      repoRoot,
      bpRel,
      {
        type: 'bouncer.blueprint',
        title: `${entry.blueprintId} ${entry.slug}`,
        description: entry.subject || `Imported ${entry.sha.slice(0, 7)}`,
        resource: bpRel,
        tags: ['bouncer', 'blueprint'],
        timestamp,
        bouncer: {
          id: entry.blueprintId,
          epic_id: plan.epicId,
          blueprint_id: entry.blueprintId,
          status: 'imported',
        },
      },
      renderBlueprintBody(plan, entry),
    ));
  }

  const indexRel = ensureEpicIndexEntry({
    repoRoot,
    epicId: plan.epicId,
    name: plan.epicName,
    description: epicDescription,
  });
  if (indexRel) created.push(indexRel);

  // 생성한 경로만 스테이징 — git add -A 는 쓰지 않는다.
  execFileSync('git', ['add', '--', ...created], {
    cwd: repoRoot,
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  // 커밋 메시지는 --message 인자 그대로. .gitmessage/문서 필드에서 조립하지 않는다.
  execFileSync('git', ['commit', '-m', message as string], {
    cwd: repoRoot,
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
  });

  return {
    ok: true,
    created,
    committed: true,
    message: message as string,
  };
}

module.exports = {
  planImport,
  applyImport,
};
