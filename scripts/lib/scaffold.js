'use strict';
Object.defineProperty(exports, "__esModule", { value: true });
const fs = require('node:fs');
const path = require('node:path');
const { CONTEXT_ROOT, normalizeRepoPath, isCanonicalEpicDir } = require('./layout');
const { renderDoc } = require('./render');
const { templateBody } = require('./templates');
function writeRel(repoRoot, rel, data, body) {
    const abs = path.join(repoRoot, rel);
    fs.mkdirSync(path.dirname(abs), { recursive: true });
    fs.writeFileSync(abs, renderDoc(data, body));
    return rel;
}
function bouncerDoc(type, title, description, resource, tags, timestamp, bouncer) {
    return { type, title, description, resource, tags, timestamp, bouncer };
}
function scaffoldEpic({ repoRoot, epicId, name, timestamp }) {
    const dir = `${CONTEXT_ROOT}/epics/${epicId}-${name}`;
    const rel = `${dir}/index.md`;
    const data = bouncerDoc('bouncer.epic', `${epicId} ${name}`, `Epic ${epicId}`, rel, ['bouncer', 'epic'], timestamp, { id: epicId, epic_id: epicId, status: 'draft' });
    const body = templateBody('epic.md', { epicId, name });
    return [writeRel(repoRoot, rel, data, body)];
}
function scaffoldBlueprint({ repoRoot, epicDir, blueprintId, name, timestamp }) {
    if (!isCanonicalEpicDir(epicDir)) {
        throw new Error(`epicDir must be under ${CONTEXT_ROOT}/epics`);
    }
    const canonicalEpicDir = normalizeRepoPath(epicDir);
    const epicId = /EPIC-\d+/.exec(canonicalEpicDir)[0];
    const dir = `${canonicalEpicDir}/blueprints/${blueprintId}-${name}`;
    const created = [];
    const body = (templateName) => templateBody(templateName, { epicId, blueprintId, name });
    const idx = `${dir}/index.md`;
    created.push(writeRel(repoRoot, idx, bouncerDoc('bouncer.blueprint', `${blueprintId} ${name}`, `Blueprint ${blueprintId}`, idx, ['bouncer', 'blueprint'], timestamp, { id: blueprintId, epic_id: epicId, blueprint_id: blueprintId, status: 'draft' }), body('blueprint.md')));
    const tasks = `${dir}/tasks.md`;
    created.push(writeRel(repoRoot, tasks, bouncerDoc('bouncer.tasks', `${blueprintId} tasks`, `Tasks for ${blueprintId}`, tasks, ['bouncer', 'tasks'], timestamp, {
        id: `TASKS-${blueprintId}`, epic_id: epicId, blueprint_id: blueprintId, status: 'draft',
        affected_paths: [],
        graph: {
            generated_at: timestamp,
            command: 'mcp:graphify',
            suggested_paths: [],
            basis: '',
        },
    }), body('tasks.md')));
    const verify = `${dir}/verification.md`;
    created.push(writeRel(repoRoot, verify, bouncerDoc('bouncer.verification', `${blueprintId} verification`, `Verification for ${blueprintId}`, verify, ['bouncer', 'verification'], timestamp, { id: `VERIFY-${blueprintId}`, epic_id: epicId, blueprint_id: blueprintId, status: 'pending' }), body('verification.md')));
    const review = `${dir}/review.md`;
    created.push(writeRel(repoRoot, review, bouncerDoc('bouncer.review', `${blueprintId} review`, `Review for ${blueprintId}`, review, ['bouncer', 'review'], timestamp, { id: `REVIEW-${blueprintId}`, epic_id: epicId, blueprint_id: blueprintId, status: 'pending',
        review: { required: true } }), body('review.md')));
    const distill = `${dir}/distill.md`;
    created.push(writeRel(repoRoot, distill, bouncerDoc('bouncer.distill', `${blueprintId} distill`, `Distill for ${blueprintId}`, distill, ['bouncer', 'distill'], timestamp, { id: `DISTILL-${blueprintId}`, epic_id: epicId, blueprint_id: blueprintId, status: 'draft' }), body('distill.md')));
    return created;
}
module.exports = { CONTEXT_ROOT, scaffoldEpic, scaffoldBlueprint };
