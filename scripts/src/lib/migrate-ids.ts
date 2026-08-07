'use strict';
const fs = require('node:fs');
const path = require('node:path');
const { execFileSync: realExecFileSync } = require('node:child_process');
const { CONTEXT_ROOT } = require('./layout');
const { toPosix, normalizeContextId } = require('./paths');
const { parseFrontmatter } = require('./frontmatter');
const { renderDoc } = require('./render');
const { readRuntimeCurrent, writeRuntimeCurrent } = require('./runtime-state');

// 구형 디렉터리만 본다 — layout/parsePathIds의 전이 허용에 기대면 BP-003이
// 그걸 제거한 뒤 SessionStart 훅도 함께 죽는다.
const LEGACY_EPIC_DIR_RE = /^EPIC-(\d{3})-(.+)$/;
const LEGACY_BP_DIR_RE = /^BP-(\d{3})-(.+)$/;
const NUMERIC_EPIC_DIR_RE = /^(\d{3})-(.+)$/;
const NUMERIC_BP_DIR_RE = /^(\d{3})-(.+)$/;

/**
 * 본문·경로 문자열의 구형 토큰을 정본으로 바꾼다.
 * KIND-BP-를 먼저 처리해야 TASKS-BP-001이 TASKS-001로 남는다(BP-만 먼저
 * 건드리면 동작은 같지만 의도를 분명히 둔다).
 */
function rewriteLegacyTokens(text) {
  return String(text)
    .replace(/\b(TASKS|VERIFY|REVIEW|EXPLAIN)-BP-(\d{3})\b/g, '$1-$2')
    .replace(/EPIC-(\d{3}-)/g, '$1')
    .replace(/BP-(\d{3}-)/g, '$1')
    .replace(/\bEPIC-(\d{3})\b/g, '$1')
    .replace(/\bBP-(\d{3})\b/g, '$1');
}

function listDirNames(abs) {
  if (!fs.existsSync(abs)) return [];
  try {
    return fs.readdirSync(abs);
  } catch (_e) {
    return [];
  }
}

function isDir(abs) {
  try {
    return fs.statSync(abs).isDirectory();
  } catch (_e) {
    return false;
  }
}

/**
 * `.bouncer/context/epics/`에서 구형 EPIC-/BP- 디렉터리만 수집한다.
 * hasNumeric은 혼재 판정용 — 신형 디렉터리가 하나라도 있으면 apply를 막는다.
 */
function discoverLegacyIds({ repoRoot }) {
  const epicsRoot = path.join(repoRoot, CONTEXT_ROOT, 'epics');
  const epics: Array<{ from: string; to: string; id: string; slug: string }> = [];
  const blueprints: Array<{
    from: string; to: string; epicFrom: string; epicTo: string; id: string; slug: string;
  }> = [];
  let hasNumeric = false;

  for (const name of listDirNames(epicsRoot)) {
    const epicAbs = path.join(epicsRoot, name);
    if (!isDir(epicAbs)) continue;

    const legacyEpic = LEGACY_EPIC_DIR_RE.exec(name);
    const numericEpic = !legacyEpic && NUMERIC_EPIC_DIR_RE.exec(name);
    if (numericEpic) hasNumeric = true;

    let epicFromRel: string | null = null;
    let epicToRel: string | null = null;
    if (legacyEpic) {
      const id = legacyEpic[1];
      const slug = legacyEpic[2];
      epicFromRel = toPosix(path.join(CONTEXT_ROOT, 'epics', name));
      epicToRel = toPosix(path.join(CONTEXT_ROOT, 'epics', `${id}-${slug}`));
      epics.push({ from: epicFromRel, to: epicToRel, id, slug });
    } else if (numericEpic) {
      epicFromRel = toPosix(path.join(CONTEXT_ROOT, 'epics', name));
      epicToRel = epicFromRel;
    } else {
      continue;
    }

    const bpRoot = path.join(epicAbs, 'blueprints');
    for (const bpName of listDirNames(bpRoot)) {
      const bpAbs = path.join(bpRoot, bpName);
      if (!isDir(bpAbs)) continue;
      const legacyBp = LEGACY_BP_DIR_RE.exec(bpName);
      if (!legacyBp) {
        if (NUMERIC_BP_DIR_RE.test(bpName)) hasNumeric = true;
        continue;
      }
      const id = legacyBp[1];
      const slug = legacyBp[2];
      const from = toPosix(path.join(epicFromRel!, 'blueprints', bpName));
      // apply는 bp를 epic rename보다 먼저 옮긴다. 대상은 아직 구형 epic 아래
      // (…/EPIC-001/blueprints/001-…)여야 한다. epic을 먼저 새 경로로 만들면
      // 이후 epic rename이 충돌한다.
      const to = toPosix(path.join(epicFromRel!, 'blueprints', `${id}-${slug}`));
      blueprints.push({
        from, to, epicFrom: epicFromRel!, epicTo: epicToRel!, id, slug,
      });
    }
  }

  const hasLegacy = epics.length > 0 || blueprints.length > 0;
  return { epics, blueprints, hasLegacy, hasNumeric };
}

function planMigration({ repoRoot }) {
  const discovery = discoverLegacyIds({ repoRoot });
  // bp를 먼저 — 깊은 경로를 epic rename 전에 옮겨야 중간 경로가 유효하다.
  const renames = [
    ...discovery.blueprints.map((b) => ({ from: b.from, to: b.to, kind: 'blueprint' as const })),
    ...discovery.epics.map((e) => ({ from: e.from, to: e.to, kind: 'epic' as const })),
  ];
  return { discovery, renames };
}

function isWorktreeDirty(repoRoot, execFileSync = realExecFileSync) {
  try {
    const out = execFileSync('git', ['status', '--porcelain'], {
      cwd: repoRoot,
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'pipe'],
    });
    return String(out).trim().length > 0;
  } catch (_e) {
    // git이 없으면 apply를 막는다 — 부분 rename을 남기지 않기 위함.
    return true;
  }
}

function validateMigration({ repoRoot, plan, deps }) {
  const d = deps || {};
  const execFileSync = d.execFileSync || realExecFileSync;
  const reasons: string[] = [];
  const discovery = plan.discovery;

  if (discovery.hasLegacy && discovery.hasNumeric) {
    reasons.push(
      'mixed-tree: legacy EPIC-/BP- directories coexist with numeric directories; '
      + 'migrate only when the tree is all-legacy or all-numeric',
    );
  }

  for (const step of plan.renames) {
    const destAbs = path.join(repoRoot, step.to);
    if (fs.existsSync(destAbs)) {
      reasons.push(`collision: destination already exists: ${step.to}`);
    }
  }

  if (discovery.hasLegacy && isWorktreeDirty(repoRoot, execFileSync)) {
    reasons.push('dirty-worktree: commit or stash changes before apply');
  }

  return { ok: reasons.length === 0, reasons };
}

function walkMarkdownFiles(absDir, out: string[] = []) {
  if (!fs.existsSync(absDir)) return out;
  let entries: string[];
  try {
    entries = fs.readdirSync(absDir);
  } catch (_e) {
    return out;
  }
  for (const name of entries) {
    const abs = path.join(absDir, name);
    let st;
    try {
      st = fs.statSync(abs);
    } catch (_e) {
      continue;
    }
    if (st.isDirectory()) walkMarkdownFiles(abs, out);
    else if (name.endsWith('.md')) out.push(abs);
  }
  return out;
}

function normalizeBouncerIds(bouncer) {
  if (!bouncer || typeof bouncer !== 'object') return bouncer;
  const next = { ...bouncer };
  if (typeof next.id === 'string') next.id = normalizeContextId(next.id);
  if (typeof next.epic_id === 'string') next.epic_id = normalizeContextId(next.epic_id);
  if (typeof next.blueprint_id === 'string') {
    next.blueprint_id = normalizeContextId(next.blueprint_id);
  }
  return next;
}

/** rename 이후 트리의 md를 읽어 토큰·resource·id를 정본으로 맞춘다. */
function rewriteContextMarkdown(repoRoot) {
  const root = path.join(repoRoot, CONTEXT_ROOT);
  for (const abs of walkMarkdownFiles(root)) {
    const raw = fs.readFileSync(abs, 'utf8');
    try {
      const { data, body } = parseFrontmatter(raw);
      if (data && typeof data === 'object') {
        const doc = data as Record<string, unknown>;
        if (typeof doc.resource === 'string') {
          doc.resource = rewriteLegacyTokens(doc.resource);
        }
        if (doc.bouncer && typeof doc.bouncer === 'object') {
          doc.bouncer = normalizeBouncerIds(doc.bouncer);
        }
        const nextBody = rewriteLegacyTokens(body);
        // title/description에도 EPIC-001 같은 토큰이 있을 수 있음.
        for (const key of ['title', 'description'] as const) {
          if (typeof doc[key] === 'string') {
            doc[key] = rewriteLegacyTokens(doc[key] as string);
          }
        }
        fs.writeFileSync(abs, renderDoc(doc, nextBody));
        continue;
      }
    } catch (_e) {
      // frontmatter 없는 md(드묾)는 전체 텍스트 rewrite.
    }
    fs.writeFileSync(abs, rewriteLegacyTokens(raw));
  }
}

function rewritePointer(repoRoot) {
  const current = readRuntimeCurrent({ repoRoot });
  if (!current || typeof current.blueprint !== 'string') return null;
  const nextBlueprint = rewriteLegacyTokens(current.blueprint);
  if (nextBlueprint === current.blueprint) return null;
  writeRuntimeCurrent({
    repoRoot,
    blueprint: nextBlueprint,
    base: current.base,
  });
  return { from: current.blueprint, to: nextBlueprint };
}

/**
 * 계획 검증 후에만 디스크를 건드린다. rename → md rewrite → pointer 순.
 * 검증 실패 시 아무 것도 바꾸지 않고 reasons를 반환한다.
 */
function applyMigration({ repoRoot, plan, deps }) {
  const validation = validateMigration({ repoRoot, plan, deps });
  if (!validation.ok) {
    return { ok: false, reasons: validation.reasons, applied: false };
  }
  if (!plan.discovery.hasLegacy) {
    return { ok: true, applied: false, renames: [], message: 'no legacy ids found' };
  }

  // 1) blueprint dirs (여전히 구형 epic 아래) 2) epic dirs
  for (const step of plan.renames) {
    const fromAbs = path.join(repoRoot, step.from);
    const toAbs = path.join(repoRoot, step.to);
    fs.mkdirSync(path.dirname(toAbs), { recursive: true });
    fs.renameSync(fromAbs, toAbs);
  }

  rewriteContextMarkdown(repoRoot);
  const pointer = rewritePointer(repoRoot);

  return {
    ok: true,
    applied: true,
    renames: plan.renames,
    pointer,
  };
}

/**
 * SessionStart stderr 문구. graphSyncWarnings처럼 테스트가 문자열을 고정한다.
 * 훅은 migrate를 실행하지 않고 안내만 한다.
 */
function legacyIdsWarnings(discovery) {
  if (!discovery || !discovery.hasLegacy) return [];
  return [
    'Bouncer: legacy EPIC-/BP- context directories detected. '
    + 'Run the migrate-ids skill or `bouncer migrate ids --dry-run`, then apply '
    + 'after confirmation. See docs/troubleshooting.md.\n',
  ];
}

function migrateIds({ repoRoot, dryRun, deps }) {
  const plan = planMigration({ repoRoot });
  if (dryRun) {
    return {
      ok: true,
      dryRun: true,
      renames: plan.renames,
      legacyCount: plan.renames.length,
      hasLegacy: plan.discovery.hasLegacy,
    };
  }
  return applyMigration({ repoRoot, plan, deps });
}

module.exports = {
  discoverLegacyIds,
  planMigration,
  validateMigration,
  applyMigration,
  // task-layout도 all-or-nothing migration이므로 dirty 판정과 markdown 순회는
  // 별도 구현하지 않는다. ids 명령의 외부 동작은 이 export 추가로 변하지 않는다.
  isWorktreeDirty,
  walkMarkdownFiles,
  rewriteLegacyTokens,
  legacyIdsWarnings,
  migrateIds,
};
