'use strict';
Object.defineProperty(exports, "__esModule", { value: true });
const fs = require('node:fs');
const path = require('node:path');
const { execFileSync: realExecFileSync } = require('node:child_process');
const { CONTEXT_ROOT } = require('./layout');
const { toPosix, parsePathIds } = require('./paths');
const { parseFrontmatter } = require('./frontmatter');
const { renderDoc } = require('./render');
const { readRuntimeCurrent, writeRuntimeCurrent } = require('./runtime-state');
const { isWorktreeDirty, walkMarkdownFiles } = require('./migrate-ids');
const { expectedTaskDocIds } = require('./tasks-docs');
const NUMBERED = /^tasks-(\d{3})\.md$/;
function legacyUnits(repoRoot) {
    const units = [];
    for (const abs of walkMarkdownFiles(path.join(repoRoot, CONTEXT_ROOT))) {
        const name = path.basename(abs);
        const matched = NUMBERED.exec(name);
        if (name !== 'tasks.md' && !matched)
            continue;
        const blueprint = toPosix(path.relative(repoRoot, path.dirname(abs)));
        if (!/\/blueprints\/\d{3}-[^/]+$/.test(blueprint))
            continue;
        units.push({
            blueprint,
            number: name === 'tasks.md' ? '001' : matched[1],
            tasks: toPosix(path.relative(repoRoot, abs)),
        });
    }
    return units.sort((a, b) => a.tasks.localeCompare(b.tasks));
}
function planTaskLayout(repoRoot) {
    const units = legacyUnits(repoRoot);
    const plan = [];
    for (const unit of units) {
        plan.push({ from: unit.tasks, to: `${unit.blueprint}/tasks/${unit.number}/tasks.md` });
    }
    const grouped = new Map();
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
function validateTaskLayout(repoRoot, plan, deps) {
    const reasons = [];
    const d = deps || {};
    if (plan.units.length && (d.isWorktreeDirty || isWorktreeDirty)(repoRoot, (d.execFileSync || realExecFileSync))) {
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
function rewrite(rel, repoRoot, number) {
    const abs = path.join(repoRoot, rel);
    const { data, body } = parseFrontmatter(fs.readFileSync(abs, 'utf8'));
    const doc = data;
    doc.resource = rel;
    // 묶음 안의 id는 디렉터리 번호에서 나온다. blueprint id를 쓰던 레거시 문서를
    // 그대로 두면 옮긴 직후 S5로 스스로 거절당한다.
    const ids = expectedTaskDocIds(number);
    const byType = {
        'bouncer.tasks': ids.tasks,
        'bouncer.verification': ids.verification,
        'bouncer.review': ids.review,
    };
    // data.type이 키일 때만 id를 쓴다. bouncer 부재 시 예전처럼 TypeError.
    if (byType[doc.type]) {
        doc.bouncer.id = byType[doc.type];
    }
    fs.writeFileSync(abs, renderDoc(doc, body));
}
function pending(repoRoot, bp, number, kind) {
    const { epicId, blueprintId } = parsePathIds(bp);
    const ids = expectedTaskDocIds(number);
    const rel = `${bp}/tasks/${number}/${kind}.md`;
    const data = {
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
    if (kind === 'review')
        data.bouncer.review = { required: true };
    fs.writeFileSync(path.join(repoRoot, rel), renderDoc(data, `# ${kind}\n\n## ${kind === 'review' ? 'Findings' : 'Command'}\n`));
    return rel;
}
function migrateTaskLayout({ repoRoot, dryRun = false, deps }) {
    const plan = planTaskLayout(repoRoot);
    const checked = validateTaskLayout(repoRoot, plan, deps);
    if (dryRun || !checked.ok) {
        return {
            ok: checked.ok,
            dryRun,
            plan: plan.plan,
            moved: [],
            rewritten: [],
            pointer: null,
            warnings: checked.reasons,
        };
    }
    const d = deps || {};
    const move = d.move || ((from, to) => (d.execFileSync || realExecFileSync)('git', ['mv', from, to], { cwd: repoRoot, stdio: 'ignore' }));
    for (const step of plan.plan) {
        fs.mkdirSync(path.dirname(path.join(repoRoot, step.to)), { recursive: true });
        move(step.from, step.to);
    }
    const rewritten = [];
    for (const unit of plan.units) {
        for (const kind of ['tasks', 'verification', 'review']) {
            const rel = `${unit.blueprint}/tasks/${unit.number}/${kind}.md`;
            if (fs.existsSync(path.join(repoRoot, rel))) {
                rewrite(rel, repoRoot, unit.number);
                rewritten.push(rel);
            }
            else
                rewritten.push(pending(repoRoot, unit.blueprint, unit.number, kind));
        }
    }
    let pointer = null;
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
module.exports = { migrateTaskLayout, planTaskLayout, validateTaskLayout };
