'use strict';
Object.defineProperty(exports, "__esModule", { value: true });
const fs = require('node:fs');
const path = require('node:path');
const { OKF_REQUIRED, TYPES, ID_PREFIX, STATUS_ENUM, detectLegacyFormat } = require('./schema');
const { readDoc } = require('./frontmatter');
const { CONTEXT_ROOT, isCanonicalBlueprintDir } = require('./layout');
const { parsePathIds, epicDirOf, toPosix } = require('./paths');
const { isValidVerifyCommand, runVerification } = require('./verification');
const { computeDiffSha, EXPLAIN_SECTION_DEFS } = require('./comprehension');
const { readCurrent } = require('./current');
function loadBlueprintDocs({ repoRoot, blueprintDir }) {
    const bp = toPosix(blueprintDir);
    const rels = {
        epicIndex: `${epicDirOf(bp)}/index.md`,
        blueprintIndex: `${bp}/index.md`,
        tasks: `${bp}/tasks.md`,
        verification: `${bp}/verification.md`,
        review: `${bp}/review.md`,
        explain: `${bp}/explain.md`,
    };
    const docs = {};
    const parseErrors = [];
    for (const [key, rel] of Object.entries(rels)) {
        const abs = path.join(repoRoot, rel);
        if (fs.existsSync(abs)) {
            try {
                const { data, body } = readDoc(abs);
                docs[key] = { data, body, rel };
            }
            catch (e) {
                parseErrors.push({ code: 'S0', message: e.message, file: rel });
            }
        }
    }
    return { docs, rels, parseErrors };
}
// Existence only: cheap, and it must not parse, because it runs before the
// execute gate re-runs verification (which rewrites verification.md).
function blueprintDocsExist({ repoRoot, blueprintDir }) {
    const bp = toPosix(blueprintDir);
    return ['index.md', 'tasks.md', 'verification.md', 'review.md', 'explain.md']
        .some((name) => fs.existsSync(path.join(repoRoot, bp, name)));
}
function checkStructural(doc, failures) {
    const { data, rel } = doc;
    const add = (code, message) => failures.push({ code, message, file: rel });
    const legacy = detectLegacyFormat({ data });
    if (legacy.legacy) {
        add('S2', legacy.reason);
        return;
    }
    for (const f of OKF_REQUIRED) {
        const v = data[f];
        if (v === undefined || v === null || v === '')
            add('S1', `OKF field missing: ${f}`);
    }
    if (!TYPES.includes(data.type)) {
        add('S2', `unknown type: ${data.type}`);
        return; // type-dependent checks cannot proceed
    }
    if (data.resource !== rel) {
        add('S3', `resource path mismatch: ${data.resource} != ${rel}`);
    }
    const bouncer = data.bouncer || {};
    const prefix = ID_PREFIX[data.type];
    if (typeof bouncer.id !== 'string' || !bouncer.id.startsWith(prefix)) {
        add('S4', `id "${bouncer.id}" missing prefix ${prefix}`);
    }
    const parsed = parsePathIds(rel);
    if (parsed.epicId && bouncer.epic_id !== parsed.epicId) {
        add('S5', `epic_id ${bouncer.epic_id} != path ${parsed.epicId}`);
    }
    if (data.type !== 'bouncer.epic' && parsed.blueprintId && bouncer.blueprint_id !== parsed.blueprintId) {
        add('S5', `blueprint_id ${bouncer.blueprint_id} != path ${parsed.blueprintId}`);
    }
    let expectedId = null;
    if (data.type === 'bouncer.epic')
        expectedId = parsed.epicId;
    else if (data.type === 'bouncer.blueprint')
        expectedId = parsed.blueprintId;
    else if (parsed.blueprintId)
        expectedId = `${prefix}${parsed.blueprintId}`;
    if (expectedId && bouncer.id !== expectedId) {
        add('S5', `id ${bouncer.id} != expected ${expectedId} from path`);
    }
    if (!(STATUS_ENUM[data.type] || []).includes(bouncer.status)) {
        add('S6', `status "${bouncer.status}" not in enum for ${data.type}`);
    }
    if (data.type === 'bouncer.tasks') {
        const ap = bouncer.affected_paths;
        if (!Array.isArray(ap) || ap.length === 0) {
            add('S7', 'tasks.affected_paths missing or empty');
        }
        if (bouncer.graph != null) {
            const basis = bouncer.graph.basis;
            if (typeof basis !== 'string' || !basis.trim()) {
                add('S9', 'tasks.graph.basis missing or empty');
            }
        }
        // Optional field: absent keeps every pre-existing tasks.md valid. Reuse
        // verification.isValidVerifyCommand so S12 and VERIFY_COMMAND_INVALID agree.
        if (bouncer.verify !== undefined && !isValidVerifyCommand(bouncer.verify)) {
            add('S12', 'tasks.verify must be a single executable command');
        }
    }
}
function validateBlueprint({ repoRoot, blueprintDir, gate, deps }) {
    if (!isCanonicalBlueprintDir(blueprintDir)) {
        return {
            ok: false,
            failures: [{
                    code: 'S10',
                    message: `blueprintDir must be under ${CONTEXT_ROOT}/epics`,
                    file: toPosix(blueprintDir),
                }],
        };
    }
    const legacyRepo = detectLegacyFormat({ repoRoot });
    if (legacyRepo.legacy) {
        return {
            ok: false,
            failures: [{ code: 'S2', message: legacyRepo.reason, file: '.sdd' }],
        };
    }
    // No blueprint document at all means a wrong path, not a document problem.
    // Reporting that first keeps the reader from chasing the cascade of gate
    // failures an empty document set produces, and stops `execute` from running
    // the verify command for a path that does not exist. The epic index is
    // deliberately excluded: it exists for every blueprint under that epic, so a
    // mistyped blueprint name would otherwise slip past this check.
    if (!blueprintDocsExist({ repoRoot, blueprintDir })) {
        return {
            ok: false,
            failures: [{
                    code: 'S11',
                    message: 'blueprint documents not found — check the blueprint path',
                    file: toPosix(blueprintDir),
                }],
        };
    }
    const executionFailures = [];
    if (gate === 'execute') {
        try {
            const verification = runVerification({ repoRoot, blueprintDir });
            if (!verification.ok) {
                executionFailures.push({
                    code: 'G13',
                    message: `configured verify command failed with exit code ${verification.exitCode}`,
                    file: `${toPosix(blueprintDir)}/verification.md`,
                });
            }
        }
        catch (error) {
            executionFailures.push({
                code: 'G13',
                message: error.message,
                file: `${toPosix(blueprintDir)}/verification.md`,
            });
        }
    }
    // Loaded after verification so the execute gate reads the evidence it just wrote.
    const { docs, rels, parseErrors } = loadBlueprintDocs({ repoRoot, blueprintDir });
    const failures = [...executionFailures, ...parseErrors];
    const anyLeaf = ['tasks', 'verification', 'review', 'explain'].some((k) => docs[k]);
    if (anyLeaf && !docs.blueprintIndex) {
        failures.push({ code: 'S8', message: 'blueprint index.md absent', file: rels.blueprintIndex });
    }
    if (docs.blueprintIndex && !docs.epicIndex) {
        failures.push({ code: 'S8', message: 'epic index.md absent', file: rels.epicIndex });
    }
    for (const key of Object.keys(docs))
        checkStructural(docs[key], failures);
    if (gate) {
        checkGate(gate, docs, rels, failures, { repoRoot, blueprintDir, deps });
    }
    return { ok: failures.length === 0, failures };
}
function statusOf(doc) {
    return doc && doc.data && doc.data.bouncer ? doc.data.bouncer.status : undefined;
}
const SECTION_DEFS = [
    { key: 'goal', re: /^##\s+(Goal\s*&\s*intent|목적[·・.]?의도)\s*$/i },
    { key: 'interface', re: /^##\s+(Interface|인터페이스)\s*$/i },
    { key: 'touch', re: /^##\s+(Touch|수정할\s*부분)\s*$/i },
    { key: 'doNotTouch', re: /^##\s+(Do\s+not\s+touch|절대\s*수정\s*금지)\s*$/i },
    // Parsed as a boundary but absent from the G10 required list: without a def
    // here its prose would fold into Do not touch and invent G12 path overlaps.
    { key: 'constraints', re: /^##\s+(Constraints|제약)\s*$/i },
    { key: 'checklist', re: /^##\s+(Checklist|체크리스트)\s*$/i },
];
const VERIFY_SECTION_DEFS = [
    { key: 'command', re: /^##\s+(Command|명령(?:어)?)\s*$/i },
    { key: 'evidence', re: /^##\s+(Evidence|증적|증거)\s*$/i },
];
const REVIEW_SECTION_DEFS = [
    { key: 'findings', re: /^##\s+(Findings|발견사항|리뷰\s*결과)\s*$/i },
];
const REVIEW_SEVERITY = ['blocker', 'major', 'minor', 'nit'];
const REVIEW_STATUS = ['resolved', 'accepted'];
// Same emptiness contract as G10: heading present, prose after comment-strip.
// Keys mirror EXPLAIN_SECTION_DEFS so the comprehension module stays the SSOT
// for which sections exist; regexes stay here next to parseSections.
const EXPLAIN_SECTION_HEADINGS = [
    { key: 'background', re: /^##\s+Background\s*$/i },
    { key: 'intuition', re: /^##\s+Intuition\s*$/i },
    { key: 'code', re: /^##\s+Code\s*$/i },
    { key: 'quiz', re: /^##\s+Quiz\s*$/i },
    { key: 'understanding', re: /^##\s+이해\s*상태\s*$/i },
];
function readConfigFile(repoRoot) {
    try {
        return JSON.parse(fs.readFileSync(path.join(repoRoot, '.bouncer/config.json'), 'utf8'));
    }
    catch (_e) {
        return {};
    }
}
// Pointer base wins only when the pointer names this blueprint; otherwise
// config.base_branch, then develop. Keeps finalize hash stable without a
// pointer, and avoids hashing against another BP's base by accident.
function resolveFinalizeBase({ repoRoot, blueprintDir, deps }) {
    const rc = (deps && deps.readCurrent) || readCurrent;
    const cfgRead = (deps && deps.readConfig) || readConfigFile;
    const cur = rc({ repoRoot });
    const bp = toPosix(blueprintDir);
    if (cur
        && typeof cur.blueprint === 'string'
        && toPosix(cur.blueprint) === bp
        && typeof cur.base === 'string'
        && cur.base.trim()) {
        return cur.base.trim();
    }
    const cfg = cfgRead(repoRoot) || {};
    if (typeof cfg.base_branch === 'string' && cfg.base_branch.trim()) {
        return cfg.base_branch.trim();
    }
    return 'develop';
}
// Authoring guidance ships as HTML comments, so a section holding nothing but
// guidance is unwritten. Stripping comments before the emptiness test keeps
// "section present but empty" meaning what it did before templates carried
// prose. Applies to every section-parsed document, not only tasks.
function stripComments(text) {
    return text.replace(/<!--[\s\S]*?-->/g, '');
}
// The single placeholder form templates use. Distinctive enough that real
// prose never trips it — an `<T>` generic in Interface stays legal.
const TODO_RE = /<TODO:[^>\n]*>/;
function parseSections(body, defs) {
    const text = typeof body === 'string' ? stripComments(body) : '';
    const lines = text.split('\n');
    const starts = [];
    for (let i = 0; i < lines.length; i++) {
        for (const def of defs) {
            if (def.re.test(lines[i].trim()))
                starts.push({ key: def.key, line: i });
        }
    }
    const out = {};
    for (const def of defs)
        out[def.key] = null;
    for (let s = 0; s < starts.length; s++) {
        const { key, line } = starts[s];
        const end = s + 1 < starts.length ? starts[s + 1].line : lines.length;
        out[key] = lines.slice(line + 1, end).join('\n').trim() || null;
    }
    return out;
}
function parseTasksSections(body) {
    return parseSections(body, SECTION_DEFS);
}
function extractPathCandidates(text) {
    const raw = typeof text === 'string' ? text : '';
    const found = new Set();
    for (const m of raw.matchAll(/`([^`]+)`/g)) {
        const p = toPosix(m[1].trim()).replace(/^\.\//, '');
        if (p)
            found.add(p);
    }
    for (const tok of raw.split(/[\s,;]+/)) {
        const p = toPosix(tok.trim()).replace(/^\.\//, '');
        if (!p || p.includes('`'))
            continue;
        if (!/^[A-Za-z0-9_./-]+$/.test(p))
            continue;
        if (!p.includes('/') && !/\.[A-Za-z0-9]+$/.test(p))
            continue;
        found.add(p);
    }
    return [...found];
}
function pathsOverlap(a, b) {
    return a === b || a.startsWith(b + '/') || b.startsWith(a + '/');
}
function pathJustifiedByTouch(ap, touchText) {
    if (touchText.includes(ap))
        return true;
    return extractPathCandidates(touchText).some((c) => ap === c || ap.startsWith(c.endsWith('/') ? c : `${c}/`));
}
function checkGate(gate, docs, rels, failures, ctx) {
    const add = (code, message, fileKey) => failures.push({ code, message, file: rels[fileKey] });
    const repoRoot = ctx && ctx.repoRoot;
    const blueprintDir = ctx && ctx.blueprintDir;
    const deps = ctx && ctx.deps;
    if (gate === 'plan') {
        if (statusOf(docs.epicIndex) !== 'approved')
            add('G1', 'epic.status != approved', 'epicIndex');
        if (statusOf(docs.blueprintIndex) !== 'approved')
            add('G2', 'blueprint.status != approved', 'blueprintIndex');
        if (statusOf(docs.tasks) !== 'ready')
            add('G3', 'tasks.status != ready', 'tasks');
        const graph = docs.tasks && docs.tasks.data.bouncer ? docs.tasks.data.bouncer.graph : undefined;
        const suggested = graph ? graph.suggested_paths : undefined;
        if (!Array.isArray(suggested))
            add('G4', 'tasks.graph.suggested_paths missing', 'tasks');
        if (graph && (typeof graph.basis !== 'string' || !graph.basis.trim())) {
            add('G4', 'tasks.graph.basis missing or empty', 'tasks');
        }
        const ap = docs.tasks && docs.tasks.data.bouncer ? docs.tasks.data.bouncer.affected_paths : undefined;
        if (!Array.isArray(ap) || ap.length === 0)
            add('G5', 'tasks.affected_paths missing or empty', 'tasks');
        const tasksBody = docs.tasks && typeof docs.tasks.body === 'string' ? docs.tasks.body : '';
        const sections = parseTasksSections(tasksBody);
        const sectionKeys = ['goal', 'interface', 'touch', 'doNotTouch', 'checklist'];
        const missing = sectionKeys.filter((k) => !sections[k]);
        const unfilled = sectionKeys.filter((k) => sections[k] && TODO_RE.test(sections[k]));
        if (missing.length) {
            add('G10', `tasks missing implementation-ready sections: ${missing.join(', ')}`, 'tasks');
        }
        else if (unfilled.length) {
            // Reported instead of the path checks below: unreplaced placeholders make
            // G11/G12 findings noise about template text rather than about scope.
            add('G10', `tasks sections still contain <TODO: …> placeholders: ${unfilled.join(', ')}`, 'tasks');
        }
        else {
            const apList = Array.isArray(ap)
                ? ap.map((p) => toPosix(String(p)).replace(/^\.\//, ''))
                : [];
            const unjustified = apList.filter((p) => !pathJustifiedByTouch(p, sections.touch));
            if (unjustified.length) {
                add('G11', `affected_paths not justified by Touch: ${unjustified.join(', ')}`, 'tasks');
            }
            const forbidden = extractPathCandidates(sections.doNotTouch);
            const overlap = apList.filter((p) => forbidden.some((f) => pathsOverlap(p, f)));
            if (overlap.length) {
                add('G12', `do-not-touch intersects affected_paths: ${overlap.join(', ')}`, 'tasks');
            }
        }
        return;
    }
    if (gate === 'execute') {
        if (statusOf(docs.tasks) !== 'verified')
            add('G6', 'tasks.status != verified', 'tasks');
        if (statusOf(docs.verification) !== 'passed')
            add('G7', 'verification.status != passed', 'verification');
        const review = docs.review && docs.review.data.bouncer ? docs.review.data.bouncer.review : undefined;
        const reviewOk = statusOf(docs.review) === 'accepted' || (review && review.required === false);
        if (!reviewOk)
            add('G8', 'review not accepted and review.required != false', 'review');
        if (docs.verification) {
            const vbody = typeof docs.verification.body === 'string' ? docs.verification.body : '';
            const vs = parseSections(vbody, VERIFY_SECTION_DEFS);
            const missingV = ['command', 'evidence'].filter((k) => !vs[k]);
            if (missingV.length) {
                add('G13', `verification.md missing body sections: ${missingV.join(', ')}`, 'verification');
            }
            const evidence = docs.verification.data.bouncer && docs.verification.data.bouncer.verification;
            const validEvidence = evidence
                && typeof evidence.command === 'string'
                && evidence.command.trim()
                && typeof evidence.ran_at === 'string'
                && evidence.ran_at.trim()
                && evidence.exit_code === 0
                && typeof evidence.output_tail === 'string';
            if (!validEvidence) {
                add('G13', 'verification.md missing successful harness verification metadata', 'verification');
            }
            else if (!vs.command.includes(`\`${evidence.command}\``)
                || !vs.evidence.includes('Exit code: 0')) {
                add('G13', 'verification.md body does not match harness verification metadata', 'verification');
            }
        }
        const reviewMeta = docs.review && docs.review.data.bouncer ? docs.review.data.bouncer.review : undefined;
        const reviewSkipped = reviewMeta && reviewMeta.required === false;
        if (docs.review && !reviewSkipped) {
            const rbody = typeof docs.review.body === 'string' ? docs.review.body : '';
            const rs = parseSections(rbody, REVIEW_SECTION_DEFS);
            if (!rs.findings)
                add('G14', 'review.md missing ## Findings body section', 'review');
            const findings = Array.isArray(reviewMeta && reviewMeta.findings) ? reviewMeta.findings : [];
            for (const fnd of findings) {
                const id = fnd && fnd.id ? fnd.id : '(no id)';
                if (!REVIEW_SEVERITY.includes(fnd && fnd.severity)) {
                    add('G14', `review finding ${id} severity invalid: ${fnd && fnd.severity}`, 'review');
                }
                if (!REVIEW_STATUS.includes(fnd && fnd.status)) {
                    add('G14', `review finding ${id} status invalid: ${fnd && fnd.status}`, 'review');
                }
                if (fnd && fnd.status === 'accepted' && (!fnd.note || String(fnd.note).trim() === '')) {
                    add('G14', `review finding ${id} accepted without note`, 'review');
                }
            }
        }
        return;
    }
    if (gate === 'finalize') {
        // G9 (distill.status == published) is retired — number stays vacant.
        // G15 judges comprehension of the diff, not a status token alone.
        if (!docs.explain) {
            add('G15', 'explain.md missing', 'explain');
            return;
        }
        const explainBody = typeof docs.explain.body === 'string' ? docs.explain.body : '';
        const sections = parseSections(explainBody, EXPLAIN_SECTION_HEADINGS);
        // Keys come from the comprehension module so a drift between modules fails
        // tests that assert EXPLAIN_SECTION_DEFS, not a silent subset here.
        const missing = EXPLAIN_SECTION_DEFS.filter((k) => !sections[k]);
        if (missing.length) {
            add('G15', `explain missing written sections: ${missing.join(', ')}`, 'explain');
            return;
        }
        const bouncer = docs.explain.data && docs.explain.data.bouncer
            ? docs.explain.data.bouncer
            : {};
        const comp = bouncer.comprehension;
        // Empty diff_sha is "record missing", not "hash mismatch" — scaffold
        // defaults must not collapse into the wrong failure branch.
        const diffSha = comp && typeof comp.diff_sha === 'string' ? comp.diff_sha : '';
        const disposition = comp && typeof comp.disposition === 'string' ? comp.disposition : '';
        if (!comp || typeof comp !== 'object' || !disposition.trim() || !diffSha.trim()) {
            add('G15', 'explain comprehension record missing', 'explain');
            return;
        }
        // quiz_score is recorded for humans / later BPs; G15 must not interpret it.
        const shaFn = (deps && deps.computeDiffSha) || computeDiffSha;
        const base = resolveFinalizeBase({ repoRoot, blueprintDir, deps });
        const computed = shaFn({ repoRoot, base, exec: deps && deps.exec });
        if (!computed || computed.ok !== true) {
            const reason = computed && computed.reason ? computed.reason : 'exec-failed';
            add('G15', `explain diff_sha could not be computed (${reason})`, 'explain');
            return;
        }
        if (computed.sha !== diffSha.trim()) {
            add('G15', 'explain diff_sha does not match base..HEAD', 'explain');
        }
        return;
    }
    throw new Error(`unknown gate: ${gate}`);
}
module.exports = {
    loadBlueprintDocs, checkStructural, checkGate, validateBlueprint,
    parseTasksSections, parseSections, extractPathCandidates,
};
