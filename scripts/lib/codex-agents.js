'use strict';
const fs = require('node:fs');
const path = require('node:path');
const frontmatter = require("./frontmatter");
const { parseFrontmatter } = frontmatter;
const layout = require("./layout");
const { CODEX_AGENTS_DIR } = layout;
const NAMED_AGENTS = [
    'bouncer-reviewer',
    'bouncer-implementer',
    'bouncer-debugger',
    'bouncer-context-reviewer',
];
// 이 마커가 첫 줄이면 init이 플러그인 md와 다시 맞춘다. 마커 없는 파일은
// 사용자 소유로 보고 덮지 않는다 — Codex는 플러그인 디렉터리를 스캔하지
// 않으므로 이 사본이 유일한 로드 경로다.
const GENERATED_MARKER = '# bouncer-generated';
function isRecord(value) {
    return typeof value === 'object' && value !== null && !Array.isArray(value);
}
function pluginAgentsDir() {
    return path.join(__dirname, '..', '..', 'agents');
}
/**
 * Claude/Cursor/Antigravity용 `agents/*.md`를 Codex custom-agent TOML로 바꾼다.
 * `model: inherit`는 키를 생략해 부모 세션 모델을 쓰게 한다.
 *
 * @param {string} markdown - YAML frontmatter가 있는 에이전트 문서
 * @returns {string} Codex가 `.codex/agents/`에서 읽는 TOML
 */
function mdToCodexToml(markdown) {
    const { data, body } = parseFrontmatter(markdown);
    if (!isRecord(data)) {
        throw new Error('agent frontmatter must be a mapping');
    }
    const name = data.name;
    const description = data.description;
    if (typeof name !== 'string' || name.length === 0) {
        throw new Error('agent name required');
    }
    if (typeof description !== 'string' || description.length === 0) {
        throw new Error('agent description required');
    }
    const lines = [
        GENERATED_MARKER,
        `# Source: agents/${name}.md`,
        '',
        `name = ${JSON.stringify(name)}`,
        `description = ${JSON.stringify(description)}`,
    ];
    if (data.readonly === true) {
        lines.push('sandbox_mode = "read-only"');
    }
    const instructions = String(body).replace(/^\n+/, '').replace(/\n+$/, '');
    lines.push('developer_instructions = """');
    lines.push(instructions.replace(/"""/g, '\\"""'));
    lines.push('"""');
    lines.push('');
    return lines.join('\n');
}
function shouldRefresh(existing, next) {
    const first = existing.split(/\r?\n/, 1)[0];
    if (first !== GENERATED_MARKER)
        return false;
    return existing !== next;
}
/**
 * init이 `.codex/agents/*.toml`을 심을지. 호스트 이름·환경 변수는 신호가
 * 아니다 — Claude-only 저장소에 빈 `.codex/`가 생기는 일을 막기 위해
 * 디렉터리 존재 또는 명시적 opt-in만 본다.
 *
 * @param {string} repoRoot - 소비 저장소 루트
 * @param {boolean} [optIn=false] - CLI `--seed-codex-agents` 등 명시 요청
 * @returns {boolean}
 */
function shouldEnsureCodexAgents(repoRoot, optIn = false) {
    if (optIn === true)
        return true;
    try {
        return fs.statSync(path.join(repoRoot, '.codex')).isDirectory();
    }
    catch (_e) {
        return false;
    }
}
/**
 * 소비 저장소 `.codex/agents/<name>.toml`을 심거나, 생성본이면 md와 맞춘다.
 * 호출 측이 조건을 통과한 뒤에만 부른다. 조건 없이 호출하면 네 TOML을
 * 심거나 생성본을 맞춘다. 플러그인 agents 디렉터리가 없으면 no-op —
 * init 부트스트랩을 막지 않는다.
 *
 * @param {{ repoRoot: string, created: string[], agentsDir?: string }} opts
 * @returns {void}
 */
function ensureCodexAgents({ repoRoot, created, agentsDir, }) {
    const srcDir = agentsDir ?? pluginAgentsDir();
    if (!fs.existsSync(srcDir))
        return;
    const destDir = path.join(repoRoot, CODEX_AGENTS_DIR);
    for (const name of NAMED_AGENTS) {
        const src = path.join(srcDir, `${name}.md`);
        if (!fs.existsSync(src))
            continue;
        const next = mdToCodexToml(fs.readFileSync(src, 'utf8'));
        const rel = `${CODEX_AGENTS_DIR}/${name}.toml`;
        const dest = path.join(repoRoot, rel);
        if (fs.existsSync(dest)) {
            const existing = fs.readFileSync(dest, 'utf8');
            if (!shouldRefresh(existing, next))
                continue;
            fs.writeFileSync(dest, next);
            continue;
        }
        fs.mkdirSync(destDir, { recursive: true });
        fs.writeFileSync(dest, next);
        created.push(rel);
    }
}
module.exports = {
    NAMED_AGENTS,
    GENERATED_MARKER,
    CODEX_AGENTS_DIR,
    mdToCodexToml,
    ensureCodexAgents,
    shouldEnsureCodexAgents,
};
