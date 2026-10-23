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
import contextIds = require('./context-ids');
const { parseContextPath, validateSlug, SLUG_MAX } = contextIds;
import epicRegistry = require('./epic-registry');
const { readEpicRegistry } = epicRegistry;
import runtimeState = require('./runtime-state');
const { readRuntimeCurrent, isWorktreeDirty } = runtimeState;
import time = require('./time');
const { nowIsoKst } = time;
import importGit = require('./import-git');
const {
  numericEpicIdOf,
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
import preCommitHook = require('./pre-commit-hook');
const { internalCommitEnv } = preCommitHook;

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
  // slug 형식 epic은 번호가 없어 번호 공간을 쓰지 않는다.
  for (const name of listEpicDirNames(repoRoot)) {
    const id = numericEpicIdOf(name);
    if (id !== null) used.add(Number(id));
  }
  for (let n = 1; n <= 999; n += 1) {
    if (!used.has(n)) return String(n).padStart(3, '0');
  }
  // 이론상만 도달 — 세 자리 공간이 가득 찬 상태.
  throw new Error('no free epic id in 001..999');
}

/**
 * 커밋 제목 slug 목록을 slug 형식 blueprint 디렉터리 이름으로 바꾼다. 번호 형식은 번호 접두가 이름을 구분했지만
 * slug 형식은 이름 자체가 식별자라, 40자 제한·숫자만/숫자 접두 금지(번호 세그먼트와 구분 불가)를 맞추고
 * 같은 이름이 겹치면 `-2`, `-3`을 붙여 유일하게 만든다. 입력 순서(오래된 커밋 먼저)를 유지한다.
 *
 * @param {string[]} slugs - slugFromSubject 결과(소문자 영숫자와 `-`)
 * @returns {string[]} 입력과 같은 길이의 유효하고 서로 다른 slug
 */
function toBlueprintSlugs(slugs: string[]): string[] {
  const used = new Set<string>();
  const clip = (value: string, max: number) => value.slice(0, max).replace(/-+$/, '');
  return slugs.map((raw) => {
    let base = clip(raw, SLUG_MAX);
    // 숫자만이거나 `ddd-`로 시작하면 번호 세그먼트와 구분되지 않는다. 접두 `bp-`로 피한다.
    if (validateSlug(base) !== null) base = clip(`bp-${base}`, SLUG_MAX);
    if (validateSlug(base) !== null) base = 'bp';
    let candidate = base;
    for (let n = 2; used.has(candidate); n += 1) {
      const suffix = `-${n}`;
      candidate = `${clip(base, SLUG_MAX - suffix.length)}${suffix}`;
    }
    used.add(candidate);
    return candidate;
  });
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

  // 새 epic의 형식: 번호를 명시하면 번호 형식, 아니면 등록부 버전이 정한다(v2면 slug epic, 그 밖에는 기존
  // 번호 배정). 경로가 아직 없는 새 epic에만 등록부 버전을 쓴다 — 이미 있는 epic의 형식은 경로가 정한다.
  const explicitId = typeof epicId === 'string' && epicId !== '';
  const registryRead = explicitId ? null : readEpicRegistry(repoRoot);
  const slugEpic = registryRead !== null && registryRead.status === 'ok' && registryRead.registry.version === 2;
  if (slugEpic) {
    const violation = validateSlug(resolvedName);
    if (violation !== null) {
      return emptyPlan({
        ok: false,
        source: (sourceSpecified ? source : 'merges') as 'merges' | 'commits',
        epicId: resolvedName,
        epicName: resolvedName,
        epicDir: `${CONTEXT_ROOT}/epics/${resolvedName}`,
        limit: resolvedLimit,
        error: {
          code: 'IMPORT_EPIC_NAME_INVALID',
          message: `epicName must be a valid slug for a v2 registry: ${violation}`,
        },
      });
    }
  }

  let resolvedEpicId: string;
  if (slugEpic) {
    resolvedEpicId = resolvedName;
  } else if (typeof epicId === 'string' && epicId) {
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

  const epicDir = slugEpic
    ? `${CONTEXT_ROOT}/epics/${resolvedName}`
    : `${CONTEXT_ROOT}/epics/${resolvedEpicId}-${resolvedName}`;
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

  const subjectSlugs = raw.map((c) => slugFromSubject(c.subject, c.sha));
  // slug epic은 순서가 번호가 아니라 apply가 쓰는 order(목록 위치)이고 이름이 곧 식별자다.
  const blueprintSlugs = slugEpic ? toBlueprintSlugs(subjectSlugs) : null;
  const entries: ImportEntry[] = raw.map((c, i) => {
    const slug = blueprintSlugs ? blueprintSlugs[i] : subjectSlugs[i];
    const blueprintId = blueprintSlugs ? slug : String(i + 1).padStart(3, '0');
    return {
      sha: c.sha,
      subject: c.subject,
      date: c.date,
      author: c.author,
      files: listChangedFiles(execFileSync, repoRoot, resolvedSource, c.sha),
      blueprintId,
      slug,
      blueprintDir: blueprintSlugs ? slug : `${blueprintId}-${slug}`,
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
  // 쓸 형식은 계획의 epicDir 경로로 읽는다. 계획은 dry-run 출력이라 사람이 거치는 값이고, 같은 경로가
  // 곧 디스크에 쓰일 위치이므로 경로와 문서 안 식별자가 어긋나지 않게 경로를 정본으로 삼는다.
  const epicPath = parseContextPath(plan.epicDir);
  const slugEpic = epicPath !== null && epicPath.format === 'slug';
  const epicKey = epicPath !== null ? epicPath.epicKey : plan.epicId;
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
      title: slugEpic ? plan.epicName : `${plan.epicId} ${plan.epicName}`,
      description: epicDescription,
      resource: epicRel,
      tags: ['bouncer', 'epic'],
      timestamp,
      bouncer: {
        id: epicKey,
        epic_id: epicKey,
        status: 'imported',
      },
    },
    renderEpicBody(plan),
  ));

  plan.entries.forEach((entry, index) => {
    const bpRel = `${plan.epicDir}/blueprints/${entry.blueprintDir}/index.md`;
    created.push(writeImportDoc(
      repoRoot,
      bpRel,
      {
        type: 'bouncer.blueprint',
        title: slugEpic ? entry.slug : `${entry.blueprintId} ${entry.slug}`,
        description: entry.subject || `Imported ${entry.sha.slice(0, 7)}`,
        resource: bpRel,
        tags: ['bouncer', 'blueprint'],
        timestamp,
        bouncer: {
          id: entry.blueprintId,
          epic_id: epicKey,
          blueprint_id: entry.blueprintId,
          status: 'imported',
          // slug 형식은 디렉터리에 번호가 없다. 계획 순서(오래된 커밋 먼저)를 1부터 order로 남긴다.
          ...(slugEpic ? { order: index + 1 } : {}),
        },
      },
      renderBlueprintBody(plan, entry),
    ));
  });

  const indexRel = ensureEpicIndexEntry({
    repoRoot,
    epicId: slugEpic ? undefined : plan.epicId,
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
  // 내부 커밋이라 hook의 commit-guard만 건너뛴다. 사용자 hook은 그대로 돈다.
  execFileSync('git', ['commit', '-m', message as string], {
    cwd: repoRoot,
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
    env: internalCommitEnv(),
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
