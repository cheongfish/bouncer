'use strict';
const fs = require('node:fs');
const path = require('node:path');
const { execFileSync: realExecFileSync } = require('node:child_process');
import layout = require('./layout');
const { CONTEXT_ROOT } = layout;
import paths = require('./paths');
const { toPosix, parsePathIds } = paths;
import frontmatter = require('./frontmatter');
const { parseFrontmatter } = frontmatter;
import render = require('./render');
const { renderDoc } = render;
import runtimeState = require('./runtime-state');
const { readRuntimeCurrent, writeRuntimeCurrent, isWorktreeDirty } = runtimeState;
import tasksDocs = require('./tasks-docs');
const { expectedTaskDocIds } = tasksDocs;
const NUMBERED = /^tasks-(\d{3})\.md$/;

type ExecFileSyncFn = (
  file: string,
  args?: readonly string[],
  options?: { cwd?: unknown; encoding?: unknown; stdio?: unknown },
) => string | Buffer;

type LegacyUnit = { blueprint: string; number: string; tasks: string };
type PlanStep = { from: string; to: string };
type LayoutPlan = { units: LegacyUnit[]; plan: PlanStep[] };
type LayoutDeps = {
  isWorktreeDirty?: (repoRoot: string, exec?: ExecFileSyncFn) => boolean;
  execFileSync?: ExecFileSyncFn;
  move?: (from: string, to: string) => unknown;
};

/** context 트리의 .md 절대 경로를 모은다. migrate-ids 제거 후 이 파일만 쓴다. */
function walkMarkdownFiles(absDir: string, out: string[] = []): string[] {
  if (!fs.existsSync(absDir)) return out;
  let entries: string[];
  try {
    entries = fs.readdirSync(absDir);
  } catch (_e) {
    return out;
  }
  for (const name of entries) {
    const abs = path.join(absDir, name);
    let st: ReturnType<typeof fs.statSync>;
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

function legacyUnits(repoRoot: string): LegacyUnit[] {
  const units: LegacyUnit[] = [];
  for (const abs of walkMarkdownFiles(path.join(repoRoot, CONTEXT_ROOT))) {
    const name = path.basename(abs); const matched = NUMBERED.exec(name);
    if (name !== 'tasks.md' && !matched) continue;
    const blueprint = toPosix(path.relative(repoRoot, path.dirname(abs)));
    if (!/\/blueprints\/\d{3}-[^/]+$/.test(blueprint)) continue;
    units.push({
      blueprint,
      number: name === 'tasks.md' ? '001' : matched![1],
      tasks: toPosix(path.relative(repoRoot, abs)),
    });
  }
  return units.sort((a, b) => a.tasks.localeCompare(b.tasks));
}

function planTaskLayout(repoRoot: string): LayoutPlan {
  const units = legacyUnits(repoRoot); const plan: PlanStep[] = [];
  for (const unit of units) {
    plan.push({ from: unit.tasks, to: `${unit.blueprint}/tasks/${unit.number}/tasks.md` });
  }
  const grouped = new Map<string, LegacyUnit[]>();
  for (const unit of units) {
    grouped.set(unit.blueprint, [...(grouped.get(unit.blueprint) || []), unit]);
  }
  for (const [bp, entries] of grouped) {
    for (const leaf of ['verification.md', 'review.md']) {
      const from = `${bp}/${leaf}`;
      if (fs.existsSync(path.join(repoRoot, from))) {
        plan.push({
          from,
          to: `${bp}/tasks/${entries.sort((a, b) => a.number.localeCompare(b.number))[0].number}/${leaf}`,
        });
      }
    }
  }
  return { units, plan };
}

function validateTaskLayout(
  repoRoot: string,
  plan: LayoutPlan,
  deps?: LayoutDeps | null,
): { ok: boolean; reasons: string[] } {
  const reasons: string[] = []; const d = deps || {};
  if (plan.units.length && (d.isWorktreeDirty || isWorktreeDirty)(
    repoRoot,
    (d.execFileSync || realExecFileSync) as ExecFileSyncFn,
  )) {
    reasons.push('dirty-worktree: commit or stash changes before apply');
  }
  for (const unit of plan.units) {
    if (fs.existsSync(path.join(repoRoot, unit.blueprint, 'tasks'))) {
      reasons.push(`mixed-layout: ${unit.blueprint}`);
    }
  }
  for (const step of plan.plan) {
    if (fs.existsSync(path.join(repoRoot, step.to))) {
      reasons.push(`collision: destination already exists: ${step.to}`);
    }
  }
  return { ok: reasons.length === 0, reasons };
}

function rewrite(rel: string, repoRoot: string, number: unknown): void {
  const abs = path.join(repoRoot, rel);
  const { data, body } = parseFrontmatter(fs.readFileSync(abs, 'utf8'));
  const doc = data as Record<string, unknown>;
  doc.resource = rel;
  // 묶음 안의 id는 디렉터리 번호에서 나온다. blueprint id를 쓰던 레거시 문서를
  // 그대로 두면 옮긴 직후 S5로 스스로 거절당한다.
  const ids = expectedTaskDocIds(number);
  const byType: Record<string, string> = {
    'bouncer.tasks': ids.tasks,
    'bouncer.verification': ids.verification,
    'bouncer.review': ids.review,
  };
  // data.type이 키일 때만 id를 쓴다. bouncer 부재 시 예전처럼 TypeError.
  if (byType[doc.type as string]) {
    (doc.bouncer as Record<string, unknown>).id = byType[doc.type as string];
  }
  fs.writeFileSync(abs, renderDoc(doc, body));
}

function pending(repoRoot: string, bp: string, number: string, kind: string): string {
  const { epicId, blueprintId } = parsePathIds(bp); const ids = expectedTaskDocIds(number);
  const rel = `${bp}/tasks/${number}/${kind}.md`;
  const data: {
    type: string;
    title: string;
    description: string;
    resource: string;
    tags: string[];
    timestamp: string;
    bouncer: {
      id: string;
      epic_id: string | null;
      blueprint_id: string | null;
      status: string;
      review?: { required: boolean };
    };
  } = {
    type: `bouncer.${kind}`,
    title: `${number} ${kind}`,
    description: `${kind} for ${number}`,
    resource: rel,
    tags: ['bouncer', kind],
    timestamp: new Date().toISOString(),
    bouncer: {
      id: kind === 'verification' ? ids.verification : ids.review,
      epic_id: epicId,
      blueprint_id: blueprintId,
      status: 'pending',
    },
  };
  if (kind === 'review') data.bouncer.review = { required: true };
  fs.writeFileSync(
    path.join(repoRoot, rel),
    renderDoc(data, `# ${kind}\n\n## ${kind === 'review' ? 'Findings' : 'Command'}\n`),
  );
  return rel;
}

function migrateTaskLayout({ repoRoot, dryRun = false, deps }: {
  repoRoot: string;
  dryRun?: boolean;
  deps?: LayoutDeps | null;
}) {
  const plan = planTaskLayout(repoRoot); const checked = validateTaskLayout(repoRoot, plan, deps);
  if (dryRun || !checked.ok) {
    return {
      ok: checked.ok,
      dryRun,
      plan: plan.plan,
      moved: [] as string[],
      rewritten: [] as string[],
      pointer: null as { from: unknown; to: string } | null,
      warnings: checked.reasons,
    };
  }
  const d = deps || {};
  const move = d.move || ((from: string, to: string) => (
    d.execFileSync || realExecFileSync
  )('git', ['mv', from, to], { cwd: repoRoot, stdio: 'ignore' }));
  for (const step of plan.plan) {
    fs.mkdirSync(path.dirname(path.join(repoRoot, step.to)), { recursive: true });
    move(step.from, step.to);
  }
  const rewritten: string[] = [];
  for (const unit of plan.units) {
    for (const kind of ['tasks', 'verification', 'review']) {
      const rel = `${unit.blueprint}/tasks/${unit.number}/${kind}.md`;
      if (fs.existsSync(path.join(repoRoot, rel))) {
        rewrite(rel, repoRoot, unit.number); rewritten.push(rel);
      } else rewritten.push(pending(repoRoot, unit.blueprint, unit.number, kind));
    }
  }
  let pointer: { from: unknown; to: string } | null = null;
  const current = readRuntimeCurrent({ repoRoot });
  const match = current && plan.units.find((u) => u.blueprint === current.blueprint && u.tasks === current.task);
  if (match) {
    const task = `${match.blueprint}/tasks/${match.number}/tasks.md`;
    writeRuntimeCurrent({
      repoRoot, blueprint: current.blueprint, base: current.base, task,
    });
    pointer = { from: current.task, to: task };
  }
  return { ok: true, plan: plan.plan, moved: plan.plan, rewritten, pointer, warnings: [] };
}
export = { migrateTaskLayout, planTaskLayout, validateTaskLayout };
