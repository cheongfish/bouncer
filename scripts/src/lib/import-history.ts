'use strict';
import type {
  ImportPlan, ImportEntry, ImportRefusal, ImportError, ImportResult, RawCommit,
} from './import-types';
const fs = require('node:fs');
const path = require('node:path');
const { execFileSync: realExecFileSync } = require('node:child_process');
import layout = require('./layout');
const { CONTEXT_ROOT } = layout;
import paths = require('./paths');
const { isNumericContextId } = paths;
import epicIndex = require('./epic-index');
const { listEpicDirNames, ensureEpicIndexEntry } = epicIndex;
import runtimeState = require('./runtime-state');
const { readRuntimeCurrent, isWorktreeDirty } = runtimeState;
import time = require('./time');
const { nowIsoKst } = time;
import importGit = require('./import-git');
const {
  EPIC_ID_PREFIX_RE,
  slugFromSubject,
  parseLogOutput,
  gitLogArgs,
  listChangedFiles,
} = importGit;
import importRender = require('./import-render');
const {
  renderEpicBody,
  renderBlueprintBody,
  writeImportDoc,
} = importRender;

// 계획·거절·적용 + 공개 배럴. git 파싱과 문서 렌더는 형제가 담당한다.
// CLI 는 이 파일의 planImport / applyImport 만 본다.

const DEFAULT_LIMIT = 200;
const DEFAULT_EPIC_NAME = 'imported-history';

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
  // 거절은 전부 첫 write 앞에 모은다. apply 중간에 멈추면 epic 디렉터리만
  // 생기고 context/index.md 행이 없는 반쪽이 남고, 그 상태는 저장소 전체
  // validate 를 S13 으로 깨뜨린다. 여기서 ok 를 뒤집지 않는 이유: 거절은
  // apply 입구에서 refusals 배열로 처리하고, plan 자체는 후보 목록을 돌려준다.
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

export = {
  planImport,
  applyImport,
};
