'use strict';
const fs = require('node:fs');
const path = require('node:path');
const { detectLegacyFormat } = require('./schema');
const { PROJECT_DISTILL } = require('./layout');
const { PROJECT_DISTILL_BODY } = require('./templates');

const CONFIG = {
  // Bouncer's own frontmatter schema version. The OKF *spec* version is a
  // different thing and is declared where OKF §11 requires it: the frontmatter
  // of the bundle-root index.md.
  schema_version: '0.x',
  source_dirs: ['src', 'test'],
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
};

// Bundle root. OKF §11 allows frontmatter here and nowhere else among index
// files; §6 fixes the body shape as `* [Title](url) - description` groups.
const CONTEXT_INDEX = `---
okf_version: "0.1"
---
# Epics

<!-- /bouncer-plan이 epic을 만들 때마다 여기에 한 줄씩 추가합니다 (OKF §6).
     * [EPIC-00x 제목](epics/EPIC-00x-slug/index.md) - 한 줄 설명 -->
`;

function writeFile(repoRoot, rel, content, created) {
  const abs = path.join(repoRoot, rel);
  fs.mkdirSync(path.dirname(abs), { recursive: true });
  fs.writeFileSync(abs, content);
  created.push(rel);
}

function projectDistillDoc(timestamp) {
  // Not a registered bouncer.* schema kind — project Distill is ungated prose
  // with OKF-shaped meta only (title/description/resource/tags/timestamp).
  const ts = timestamp || new Date().toISOString();
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

// Create Distill only when missing — never overwrite curated project notes.
function ensureProjectDistill(repoRoot, created, timestamp) {
  const abs = path.join(repoRoot, PROJECT_DISTILL);
  if (fs.existsSync(abs)) return;
  writeFile(repoRoot, PROJECT_DISTILL, projectDistillDoc(timestamp), created);
}

// Advisory only. Safe bootstrap forbids init from editing files it did not
// create, so a missing .gitignore is reported, never written. finalize ignores
// these paths regardless; the suggestion keeps the working tree readable.
const SUGGESTED_IGNORES = ['node_modules/', 'graphify-out/'];

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
    // Existing Bouncer content is preserved when config is absent or invalid.
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
    // Soft-seed Distill for repos initialized before project Distill existed.
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
  writeFile(repoRoot, '.bouncer/context/index.md', CONTEXT_INDEX, created);
  writeFile(repoRoot, '.bouncer/config.json', `${JSON.stringify(CONFIG, null, 2)}\n`, created);
  ensureProjectDistill(repoRoot, created, timestamp);
  return {
    ok: true, created, skipped: false, reason: 'initialized',
    gitignoreSuggestions: suggestions,
  };
}

module.exports = { init, inspectBootstrap, gitignoreSuggestions, SUGGESTED_IGNORES };
