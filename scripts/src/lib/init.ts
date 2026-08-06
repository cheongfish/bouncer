'use strict';
const fs = require('node:fs');
const path = require('node:path');
const { detectLegacyFormat } = require('./schema');
const { PROJECT_DISTILL, LEGACY_PROJECT_DISTILL } = require('./layout');
const { PROJECT_DISTILL_BODY } = require('./templates');
const { nowIsoKst } = require('./time');

// default source_dirs용 고정 probe 순서. init 시점에 존재하는 directory만
// 남기며, 이 목록 순서가 config에 쓰이는 순서. SOURCE_DIR_CANDIDATES를
// import하는 test와 동기 유지.
const SOURCE_DIR_CANDIDATES = ['src', 'lib', 'app', 'packages', 'scripts', 'test', 'tests'];

function detectSourceDirs(repoRoot) {
  return SOURCE_DIR_CANDIDATES.filter((name) => {
    try {
      return fs.statSync(path.join(repoRoot, name)).isDirectory();
    } catch (_e) {
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
    graphify: { enabled: false },
    verify: 'npm test',
    base_branch: 'develop',
    pr: { draft: true, base: 'develop', labels: ['bouncer'] },
    plugin_advisors: {
      ponytail: {
        enabled: true,
        plan: 'lite',
        execute: 'full',
        verify: 'full',
        review: 'review',
        finalize: 'lite',
        auto_switch: false,
      },
    },
    // host별 model ID용 placeholder slot. 모든 값은 "inherit"로 시작해 init이
    // 편집 가능한 형태를 보여 주되 model을 고정하지 않음; resolveSubagentModel은
    // "inherit"를 parent-session fallback으로 처리.
    // provider block은 분리 — host마다 model namespace가 다름
    // (Claude / Cursor / Codex slug는 호환되지 않음).
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
  return body.replace(
    /^resource:\s*\.bouncer\/context\/Distill\.md\s*$/m,
    `resource: ${PROJECT_DISTILL}`,
  );
}

// 없을 때만 Distill 생성 — 정리된 project note는 덮어쓰지 않음.
// 레거시 `.bouncer/context/Distill.md`만 있으면 새 경로로 옮긴다.
function ensureProjectDistill(repoRoot, created, timestamp) {
  const abs = path.join(repoRoot, PROJECT_DISTILL);
  if (fs.existsSync(abs)) return;
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

// advisory만. safe bootstrap은 init이 만들지 않은 file을 수정하지 않으므로
// .gitignore가 없으면 보고만 하고 쓰지 않음. finalize는 이 path를 무시;
// 제안은 working tree를 읽기 쉽게 유지.
const SUGGESTED_IGNORES = ['node_modules/', 'graphify-out/', '.worktrees/'];

function gitignoreSuggestions({ repoRoot }) {
  let ignored = [];
  try {
    ignored = fs.readFileSync(path.join(repoRoot, '.gitignore'), 'utf8')
      .split('\n')
      .map((line) => line.trim().replace(/\/+$/, ''))
      .filter((line) => line && !line.startsWith('#'));
  } catch (_e) {
    ignored = [];
  }
  return SUGGESTED_IGNORES.filter(
    (entry) => !ignored.includes(entry.replace(/\/+$/, '')),
  );
}

function inspectBootstrap({ repoRoot }) {
  if (detectLegacyFormat({ repoRoot }).legacy) return 'legacy';

  const bouncerAbs = path.join(repoRoot, '.bouncer');
  if (!fs.existsSync(bouncerAbs)) return 'missing';

  const configAbs = path.join(bouncerAbs, 'config.json');
  try {
    const config = JSON.parse(fs.readFileSync(configAbs, 'utf8'));
    const valid = config
      && typeof config === 'object'
      && !Array.isArray(config)
      && Array.isArray(config.source_dirs)
      && typeof config.verify === 'string'
      && typeof config.base_branch === 'string';
    if (valid) return 'ready';
  } catch (_e) {
    // config가 없거나 invalid일 때 기존 Bouncer 내용은 보존.
  }
  return 'partial';
}

function init({ repoRoot, timestamp }) {
  const bootstrap = inspectBootstrap({ repoRoot });
  if (bootstrap === 'legacy') {
    const legacy = detectLegacyFormat({ repoRoot });
    return { ok: false, created: [], skipped: true, reason: legacy.reason };
  }
  if (bootstrap === 'partial') {
    return { ok: false, created: [], skipped: true, reason: 'partial-bouncer-state' };
  }
  const suggestions = gitignoreSuggestions({ repoRoot });
  if (bootstrap === 'ready') {
    // project Distill 이전에 init된 repo용 soft-seed.
    const created = [];
    ensureProjectDistill(repoRoot, created, timestamp);
    return {
      ok: true,
      created,
      skipped: created.length === 0,
      reason: created.length ? 'project-distill-seeded' : 'already-initialized',
      gitignoreSuggestions: suggestions,
    };
  }

  const created = [];
  const config = defaultConfig(repoRoot);
  writeFile(repoRoot, '.bouncer/context/index.md', CONTEXT_INDEX, created);
  writeFile(repoRoot, '.bouncer/config.json', `${JSON.stringify(config, null, 2)}\n`, created);
  ensureProjectDistill(repoRoot, created, timestamp);
  // gitignoreSuggestions와 같은 advisory layer: detection이 아무것도 못 찾으면
  // operator에게 source_dirs를 채우라고 알려 빈 graph(BP-001 missing warning)에
  // opt-in하지 않게 함. dir을 찾았으면 생략.
  return {
    ok: true, created, skipped: false, reason: 'initialized',
    gitignoreSuggestions: suggestions,
    ...(config.source_dirs.length === 0 ? { sourceDirsUnresolved: true } : {}),
  };
}

module.exports = {
  init, inspectBootstrap, gitignoreSuggestions, SUGGESTED_IGNORES, SOURCE_DIR_CANDIDATES,
};
