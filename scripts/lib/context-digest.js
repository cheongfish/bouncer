'use strict';
Object.defineProperty(exports, "__esModule", { value: true });
const fs = require('node:fs');
const path = require('node:path');
const { readShards } = require('./distill');
const { DISTILL_SHARD_DIR } = require('./layout');
/** graphify가 스캔할 파생 트리 (gitignore 대상 graphify-out 아래). */
const CONTEXT_DIGEST_OUT = 'graphify-out/context-src';
const DIGEST_MAP_REL = 'graphify-out/context-src/map.json';
/**
 * Distill은 context_dirs 밖이라 디렉터리 walk에 안 잡힌다.
 * freshness와 다이제스트 입력 모두에 명시적으로 넣는다.
 */
const DIGEST_WATCH_FILES = ['.bouncer/Distill.md'];
/**
 * 화이트리스트 문서만 헤딩 배열을 돌려준다. 그 외(tasks/verification/review,
 * blueprint index 등)는 null — 파생 파일을 만들지 않는다.
 */
function digestRulesFor(rel) {
    const norm = String(rel || '').replace(/\\/g, '/');
    if (norm === '.bouncer/Distill.md')
        return ['## Decisions'];
    if (new RegExp(`^${DISTILL_SHARD_DIR}/[^/]+\\.md$`).test(norm)) {
        return ['## Decisions'];
    }
    if (/^\.bouncer\/context\/epics\/[^/]+\/index\.md$/.test(norm)) {
        return ['## Success criteria'];
    }
    if (/\/blueprints\/[^/]+\/explain\.md$/.test(norm)) {
        return ['## Background', '## Intuition', '## Code'];
    }
    return null;
}
/** YAML frontmatter(`---` … `---`)만 제거. 본문 중간의 --- 는 건드리지 않는다. */
function stripFrontmatter(markdown) {
    const text = String(markdown || '');
    if (!text.startsWith('---'))
        return text;
    const end = text.indexOf('\n---', 3);
    if (end === -1)
        return text;
    const after = text.slice(end + 4);
    return after.replace(/^\r?\n/, '');
}
/**
 * 요청한 ## 헤딩의 본문만 다음 ## 직전까지 남긴다.
 * 헤딩이 없거나 본문이 비면 해당 섹션은 빼고, 전부 비면 '' 를 돌려
 * 호출자가 파생 파일을 만들지 않게 한다.
 */
function extractSections(markdown, headings) {
    const body = stripFrontmatter(markdown);
    const wanted = Array.isArray(headings) ? headings : [];
    if (!wanted.length)
        return '';
    const lines = body.split(/\r?\n/);
    const starts = [];
    for (let i = 0; i < lines.length; i++) {
        const line = lines[i];
        if (/^##\s/.test(line))
            starts.push({ i, line });
    }
    const chunks = [];
    for (const heading of wanted) {
        const hit = starts.find((s) => s.line.trim() === heading.trim());
        if (!hit)
            continue;
        const idx = starts.indexOf(hit);
        const from = hit.i + 1;
        const to = idx + 1 < starts.length ? starts[idx + 1].i : lines.length;
        const sectionBody = lines.slice(from, to).join('\n').replace(/^\n+|\n+$/g, '');
        if (!sectionBody.trim())
            continue;
        chunks.push(`${heading}\n\n${sectionBody}`);
    }
    return chunks.length ? chunks.join('\n\n') + '\n' : '';
}
function flattenSlug(rel) {
    return rel.replace(/[^a-zA-Z0-9]+/g, '-').replace(/^-+|-+$/g, '') || 'doc';
}
function uniqueFlatName(base, used) {
    let name = `${base}.md`;
    if (!used.has(name)) {
        used.add(name);
        return name;
    }
    let n = 2;
    while (used.has(`${base}-${n}.md`))
        n += 1;
    name = `${base}-${n}.md`;
    used.add(name);
    return name;
}
function walkMarkdownFiles(repoRoot, dir, acc) {
    const abs = path.join(repoRoot, dir);
    let entries;
    try {
        entries = fs.readdirSync(abs, { withFileTypes: true });
    }
    catch (_e) {
        return;
    }
    for (const e of entries) {
        const childRel = path.posix.join(dir.replace(/\\/g, '/'), e.name);
        if (e.isDirectory()) {
            if (e.isSymbolicLink())
                continue;
            walkMarkdownFiles(repoRoot, childRel, acc);
            continue;
        }
        if (e.isFile() && e.name.endsWith('.md'))
            acc.push(childRel);
    }
}
/**
 * context_dirs 아래 화이트리스트 문서(+ Distill)에서 섹션만 뽑아
 * 평탄 파생 트리와 map.json 을 다시 쓴다. 매 빌드 전체 재생성.
 */
function buildContextDigest({ repoRoot, contextDirs }) {
    const outRel = CONTEXT_DIGEST_OUT;
    const outAbs = path.join(repoRoot, outRel);
    fs.rmSync(outAbs, { recursive: true, force: true });
    fs.mkdirSync(outAbs, { recursive: true });
    // 상위 .gitignore 의 graphify-out/ 을 graphify detect 가 그대로 읽어
    // 이 트리를 빈 입력으로 본다. 로컬 .graphifyignore 로 .md 만 재포함한다.
    fs.writeFileSync(path.join(outAbs, '.graphifyignore'), '*\n!*.md\n');
    const candidates = [];
    for (const dir of (contextDirs || [])) {
        walkMarkdownFiles(repoRoot, dir.replace(/\\/g, '/'), candidates);
    }
    for (const watch of DIGEST_WATCH_FILES) {
        if (!candidates.includes(watch))
            candidates.push(watch);
    }
    const distill = readShards({ repoRoot });
    if (distill.sharded && distill.valid) {
        for (const shard of distill.shards) {
            // readShards가 인덱스 정본만 반환하더라도 경로 계약은 여기서 한 번 더
            // 좁힌다. 사용자 지정 경로를 그대로 그래프 원본으로 노출하지 않아야
            // map.json의 source_file이 실제 Distill 샤드 경계를 벗어나지 않는다.
            if (typeof shard.path === 'string'
                && digestRulesFor(shard.path)
                && !candidates.includes(shard.path)) {
                candidates.push(shard.path);
            }
        }
    }
    const used = new Set();
    const map = {};
    const files = [];
    for (const rel of candidates) {
        const rules = digestRulesFor(rel);
        if (!rules)
            continue;
        const abs = path.join(repoRoot, rel);
        let raw;
        try {
            raw = fs.readFileSync(abs, 'utf8');
        }
        catch (_e) {
            continue;
        }
        const extracted = extractSections(raw, rules);
        if (!extracted)
            continue;
        const flat = uniqueFlatName(flattenSlug(rel), used);
        // graphify·소비자는 파생 이름만 본다. 원본 경로는 본문 헤더와 map.json 이 잇는다.
        const body = `<!-- source: ${rel} -->\n\n${extracted}`;
        fs.writeFileSync(path.join(outAbs, flat), body);
        map[flat] = rel;
        files.push(flat);
    }
    fs.writeFileSync(path.join(repoRoot, DIGEST_MAP_REL), JSON.stringify(map, null, 2) + '\n');
    return { dir: outRel, files, map, count: files.length };
}
module.exports = {
    CONTEXT_DIGEST_OUT,
    DIGEST_MAP_REL,
    DIGEST_WATCH_FILES,
    digestRulesFor,
    extractSections,
    buildContextDigest,
};
