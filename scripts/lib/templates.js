// scripts/lib/templates.js
// Document bodies shared by `bouncer init` (which writes them to
// .bouncer/templates/ so a team can adapt them) and by scaffold (which renders
// them into new documents). Every default here satisfies the body sections the
// gates require: G10 for tasks, G13 for verification, G14 for review.
'use strict';
const fs = require('node:fs');
const path = require('node:path');

const PR_TEMPLATE = `<type>(<bp-id>): <summary>

Epic: <epic-id>
Blueprint: <bp-id>

Implemented:
- <task summary>

Verified:
- <verification summary>

Distilled:
- <distill path>
`;

const TEMPLATES = {
  'epic.md': '# <EPIC-id> <name>\n\nGoal and scope of this epic.\n',
  'blueprint.md': '# <BP-id> <name>\n\nWhat this blueprint delivers and why it fits one reviewable commit.\n',
  'tasks.md': `# Tasks

## Goal & intent

## Interface

## Touch

## Do not touch

## Checklist
- [ ] <task>
`,
  'verification.md': '# Verification\n\n## Command\n<command>\n\n## Evidence\n<result>\n',
  'review.md': '# Review\n\n## Findings\n- <finding>\n',
  'distill.md': '# Distill\n\nWhat was learned; durable notes for future work.\n',
  'pr.md': PR_TEMPLATE,
};

const TEMPLATE_DIR = '.bouncer/templates';

// A project template wins over the built-in default; a missing or unreadable
// one falls back so scaffold never emits a document that cannot pass its gate.
function readTemplate(repoRoot, name) {
  const fallback = TEMPLATES[name];
  try {
    const body = fs.readFileSync(path.join(repoRoot, TEMPLATE_DIR, name), 'utf8');
    return body.trim() ? body : fallback;
  } catch (_e) {
    return fallback;
  }
}

function renderTemplate(body, { epicId, blueprintId, name }) {
  return body
    .replace(/<EPIC-id>/g, epicId || '')
    .replace(/<BP-id>/g, blueprintId || '')
    .replace(/<name>/g, name || '');
}

function templateBody(repoRoot, templateName, vars) {
  return renderTemplate(readTemplate(repoRoot, templateName), vars);
}

module.exports = {
  TEMPLATES, TEMPLATE_DIR, PR_TEMPLATE, readTemplate, renderTemplate, templateBody,
};
