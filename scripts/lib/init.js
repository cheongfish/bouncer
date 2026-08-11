'use strict';
Object.defineProperty(exports, "__esModule", { value: true });
const fs = require('node:fs');
const path = require('node:path');
const { detectLegacyFormat } = require('./schema');
const { PROJECT_DISTILL, LEGACY_PROJECT_DISTILL } = require('./layout');
const { PROJECT_DISTILL_BODY } = require('./templates');
const { nowIsoKst } = require('./time');
const { setupGraphify } = require('./graphify');
// default source_dirs용 고정 probe 순서. init 시점에 존재하는 directory만
// 남기며, 이 목록 순서가 config에 쓰이는 순서. SOURCE_DIR_CANDIDATES를
// import하는 test와 동기 유지.
const SOURCE_DIR_CANDIDATES = ['src', 'lib', 'app', 'packages', 'scripts', 'test', 'tests'];
function detectSourceDirs(repoRoot) {
    return SOURCE_DIR_CANDIDATES.filter((name) => {
        try {
            return fs.statSync(path.join(repoRoot, name)).isDirectory();
        }
        catch (_e) {
            return false;
        }
    });
}
function defaultConfig(repoRoot) {
    return {
        // scaffold 시점에만 감지 — ready bootstrap에서는 다시 쓰지 않음.
        source_dirs: detectSourceDirs(repoRoot),
        // Bouncer context docs graph (epics/blueprints). source_dirs와 함께
        // graphify-out/source, graphify-out/context 이중 graphify 출력에 사용.
        context_dirs: ['.bouncer/context'],
        // 라이브러리 기본(install:false)은 enabled만 true — bin은 설치 성공 시에만 기록.
        // CLI는 install:true가 기본이라 실패 시 enabled:false로 내려 soft-fail한다.
        graphify: { enabled: true },
        verify: 'npm test',
        base_branch: 'develop',
        pr: { draft: true, base: 'develop', labels: ['bouncer'] },
        // host별 model ID용 placeholder slot. 모든 값은 "inherit"로 시작해 init이
        // 편집 가능한 형태를 보여 주되 model을 고정하지 않음; resolveSubagentModel은
        // "inherit"를 parent-session fallback으로 처리.
        // provider block은 분리 — host마다 model namespace가 다름
        // (Claude / Cursor / Codex / Antigravity slug는 호환되지 않음).
        subagents: {
            claude: {
                'bouncer-reviewer': 'inherit',
                'bouncer-implementer': 'inherit',
                'bouncer-debugger': 'inherit',
            },
            cursor: {
                'bouncer-reviewer': 'inherit',
                'bouncer-implementer': 'inherit',
                'bouncer-debugger': 'inherit',
            },
            codex: {
                'bouncer-reviewer': 'inherit',
                'bouncer-implementer': 'inherit',
                'bouncer-debugger': 'inherit',
            },
            antigravity: {
                'bouncer-reviewer': 'inherit',
                'bouncer-implementer': 'inherit',
                'bouncer-debugger': 'inherit',
            },
        },
    };
}
// Bundle root. OKF §11은 index file 중 여기에만 frontmatter를 허용;
// §6은 body 형태를 `* [Title](url) - description` 그룹으로 고정.
const CONTEXT_INDEX = `---
okf_version: "0.1"
---
# Epics

<!-- bouncer scaffold epic이 여기에 한 줄씩 추가합니다 (OKF §6).
     validate는 S13으로 디렉터리 ↔ 목록 일치를 검사합니다.
     * [00x 제목](epics/00x-slug/index.md) - 한 줄 설명 -->
`;
function writeFile(repoRoot, rel, content, created) {
    const abs = path.join(repoRoot, rel);
    fs.mkdirSync(path.dirname(abs), { recursive: true });
    fs.writeFileSync(abs, content);
    created.push(rel);
}
function projectDistillDoc(timestamp) {
    // 등록된 bouncer.* schema kind가 아님 — project Distill은 gate 없는 prose,
    // OKF 형태 meta만 (title/description/resource/tags/timestamp). `.bouncer/`
    // 런타임 파일이지 context OKF 번들 문서가 아니다.
    const ts = timestamp || nowIsoKst();
    return `---
title: Project Distill
description: Current project invariants, gotchas, and decisions
resource: ${PROJECT_DISTILL}
tags:
  - bouncer
  - distill
timestamp: '${ts}'
---
${PROJECT_DISTILL_BODY}`;
}
function rewriteDistillResource(body) {
    return body.replace(/^resource:\s*\.bouncer\/context\/Distill\.md\s*$/m, `resource: ${PROJECT_DISTILL}`);
}
// 없을 때만 Distill 생성 — 정리된 project note는 덮어쓰지 않음.
// 레거시 `.bouncer/context/Distill.md`만 있으면 새 경로로 옮긴다.
function ensureProjectDistill(repoRoot, created, timestamp) {
    const abs = path.join(repoRoot, PROJECT_DISTILL);
    if (fs.existsSync(abs))
        return;
    const legacyAbs = path.join(repoRoot, LEGACY_PROJECT_DISTILL);
    if (fs.existsSync(legacyAbs)) {
        const body = rewriteDistillResource(fs.readFileSync(legacyAbs, 'utf8'));
        fs.mkdirSync(path.dirname(abs), { recursive: true });
        fs.writeFileSync(abs, body);
        fs.unlinkSync(legacyAbs);
        created.push(PROJECT_DISTILL);
        return;
    }
    writeFile(repoRoot, PROJECT_DISTILL, projectDistillDoc(timestamp), created);
}
// advisory(+ 동의 시 마커 블록 쓰기) 목록. `.bouncer/.venv/`는 설치 산출물이라
// 범위 위반·실수 커밋을 막기 위해 제안과 finalize RUNTIME_ARTIFACTS에 같이 둔다.
const SUGGESTED_IGNORES = [
    'node_modules/',
    'graphify-out/',
    '.worktrees/',
    '.bouncer/.venv/',
];
const GITIGNORE_MARKER_START = '# bouncer';
const GITIGNORE_MARKER_END = '# /bouncer';
function gitignoreSuggestions({ repoRoot }) {
    let ignored = [];
    try {
        ignored = fs.readFileSync(path.join(repoRoot, '.gitignore'), 'utf8')
            .split('\n')
            .map((line) => line.trim().replace(/\/+$/, ''))
            .filter((line) => line && !line.startsWith('#'));
    }
    catch (_e) {
        ignored = [];
    }
    return SUGGESTED_IGNORES.filter((entry) => !ignored.includes(entry.replace(/\/+$/, '')));
}
/**
 * `# bouncer` … `# /bouncer` 마커 블록만 갱신한다.
 * 마커 밖 사용자 줄은 읽기만 하고 바꾸지 않는다 — 동의 신호(writeGitignore)가
 * 있을 때만 호출된다.
 * 마커 탐지는 줄 전체가 정확히 일치할 때만(substring `indexOf` 금지) —
 * `# bouncer note` 같은 사용자 주석을 마커로 오인하지 않기 위함.
 */
function writeGitignoreMarkerBlock(repoRoot) {
    const abs = path.join(repoRoot, '.gitignore');
    const block = `${GITIGNORE_MARKER_START}\n${SUGGESTED_IGNORES.join('\n')}\n${GITIGNORE_MARKER_END}`;
    let content = null;
    try {
        content = fs.readFileSync(abs, 'utf8');
    }
    catch (_e) {
        fs.writeFileSync(abs, `${block}\n`);
        return true;
    }
    const startMatch = /^# bouncer$/m.exec(content);
    const endMatch = /^# \/bouncer$/m.exec(content);
    if (startMatch && endMatch && endMatch.index > startMatch.index) {
        const before = content.slice(0, startMatch.index);
        const after = content.slice(endMatch.index + GITIGNORE_MARKER_END.length);
        fs.writeFileSync(abs, `${before}${block}${after}`);
        return true;
    }
    const sep = content.length === 0 || content.endsWith('\n') ? '' : '\n';
    fs.writeFileSync(abs, `${content}${sep}${block}\n`);
    return true;
}
function readConfigObject(repoRoot) {
    try {
        const raw = JSON.parse(fs.readFileSync(path.join(repoRoot, '.bouncer', 'config.json'), 'utf8'));
        if (raw && typeof raw === 'object' && !Array.isArray(raw))
            return raw;
    }
    catch (_e) {
        // ready 판정은 inspectBootstrap이 이미 통과 — 여기서는 승격 실패 시 no-op.
    }
    return null;
}
function graphifyEnabledIsTrue(config) {
    return !!(config
        && config.graphify
        && typeof config.graphify === 'object'
        && config.graphify.enabled === true);
}
function inspectBootstrap({ repoRoot }) {
    if (detectLegacyFormat({ repoRoot }).legacy)
        return 'legacy';
    const bouncerAbs = path.join(repoRoot, '.bouncer');
    if (!fs.existsSync(bouncerAbs))
        return 'missing';
    const configAbs = path.join(bouncerAbs, 'config.json');
    try {
        const config = JSON.parse(fs.readFileSync(configAbs, 'utf8'));
        const valid = config
            && typeof config === 'object'
            && !Array.isArray(config)
            && Array.isArray(config.source_dirs)
            && typeof config.verify === 'string'
            && typeof config.base_branch === 'string';
        if (valid)
            return 'ready';
    }
    catch (_e) {
        // config가 없거나 invalid일 때 기존 Bouncer 내용은 보존.
    }
    return 'partial';
}
function init({ repoRoot, timestamp, graphify, promote, writeGitignore, } = {}) {
    const bootstrap = inspectBootstrap({ repoRoot });
    // partial/legacy는 설치·승격·gitignore 쓰기를 시도하지 않는다 — 기존 반환 유지.
    if (bootstrap === 'legacy') {
        const legacy = detectLegacyFormat({ repoRoot });
        return { ok: false, created: [], skipped: true, reason: legacy.reason };
    }
    if (bootstrap === 'partial') {
        return { ok: false, created: [], skipped: true, reason: 'partial-bouncer-state' };
    }
    // 라이브러리 기본 install:false — 테스트가 실제 pip을 타지 않게 한다.
    // CLI cmdInit만 install:true를 기본으로 넘긴다.
    const wantInstall = !!(graphify && graphify.install === true);
    const setup = (graphify && typeof graphify.setup === 'function')
        ? graphify.setup
        : setupGraphify;
    const wantPromote = promote === true;
    const wantWriteGitignore = writeGitignore === true;
    // 동의 시 마커 블록을 먼저 쓰고, 제안 목록은 최종 파일 기준으로 계산한다.
    let gitignoreWritten = false;
    if (wantWriteGitignore) {
        writeGitignoreMarkerBlock(repoRoot);
        gitignoreWritten = true;
    }
    const suggestions = gitignoreSuggestions({ repoRoot });
    if (bootstrap === 'ready') {
        // project Distill 이전에 init된 repo용 soft-seed.
        const created = [];
        ensureProjectDistill(repoRoot, created, timestamp);
        const existing = readConfigObject(repoRoot);
        const alreadyEnabled = graphifyEnabledIsTrue(existing);
        let graphifyPromotion;
        let graphifyInstall;
        // enabled가 이미 true면 승격 경로 자체가 없다 — config를 건드리지 않는다.
        if (!alreadyEnabled) {
            if (!wantPromote) {
                // --promote-graphify 없이 기존 config가 바뀌는 경로는 없다.
                graphifyPromotion = 'candidate';
            }
            else {
                // 승격은 graphify.enabled(+ 설치 성공 시 bin)만 바꾼다. 파일 재생성 금지.
                if (wantInstall) {
                    graphifyInstall = setup({ repoRoot });
                }
                if (existing) {
                    const nextGraphify = {
                        ...(existing.graphify && typeof existing.graphify === 'object'
                            ? existing.graphify
                            : {}),
                        enabled: true,
                    };
                    if (graphifyInstall
                        && (graphifyInstall.status === 'installed' || graphifyInstall.status === 'reused')
                        && typeof graphifyInstall.bin === 'string'
                        && graphifyInstall.bin) {
                        nextGraphify.bin = graphifyInstall.bin;
                    }
                    existing.graphify = nextGraphify;
                    fs.writeFileSync(path.join(repoRoot, '.bouncer', 'config.json'), `${JSON.stringify(existing, null, 2)}\n`);
                }
                graphifyPromotion = 'promoted';
            }
        }
        return {
            ok: true,
            created,
            skipped: created.length === 0,
            reason: created.length ? 'project-distill-seeded' : 'already-initialized',
            gitignoreSuggestions: suggestions,
            gitignoreWritten,
            ...(graphifyPromotion ? { graphifyPromotion } : {}),
            ...(graphifyInstall ? { graphifyInstall } : {}),
        };
    }
    // 신규 부트스트랩
    const created = [];
    const config = defaultConfig(repoRoot);
    let graphifyInstall;
    if (wantInstall) {
        graphifyInstall = setup({ repoRoot });
        if (graphifyInstall
            && (graphifyInstall.status === 'installed' || graphifyInstall.status === 'reused')
            && typeof graphifyInstall.bin === 'string'
            && graphifyInstall.bin) {
            // bin은 설치 성공 시에만 붙인다 — defaultConfig 추론 타입에 bin이 없어도 런타임 계약은 이 형태.
            config.graphify = { enabled: true, bin: graphifyInstall.bin };
        }
        else {
            // 설치 실패는 soft-fail: ok는 유지하고 enabled만 끈다.
            config.graphify = { enabled: false };
        }
    }
    writeFile(repoRoot, '.bouncer/context/index.md', CONTEXT_INDEX, created);
    writeFile(repoRoot, '.bouncer/config.json', `${JSON.stringify(config, null, 2)}\n`, created);
    ensureProjectDistill(repoRoot, created, timestamp);
    // gitignoreSuggestions와 같은 advisory layer: detection이 아무것도 못 찾으면
    // operator에게 source_dirs를 채우라고 알려 빈 graph(BP-001 missing warning)에
    // opt-in하지 않게 함. dir을 찾았으면 생략.
    return {
        ok: true, created, skipped: false, reason: 'initialized',
        gitignoreSuggestions: suggestions,
        gitignoreWritten,
        ...(graphifyInstall ? { graphifyInstall } : {}),
        ...(config.source_dirs.length === 0 ? { sourceDirsUnresolved: true } : {}),
    };
}
module.exports = {
    init, inspectBootstrap, gitignoreSuggestions, SUGGESTED_IGNORES, SOURCE_DIR_CANDIDATES,
};
