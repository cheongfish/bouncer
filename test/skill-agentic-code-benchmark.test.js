'use strict';
const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');
const { parseFrontmatter } = require('../scripts/lib/frontmatter');

const root = path.join(__dirname, '..');
const skillDir = path.join(root, 'skills', 'agentic-code-benchmark');

function read(rel) {
  return fs.readFileSync(path.join(root, rel), 'utf8');
}

const TITLES = [
  'Correctness & spec fidelity',
  'Scope discipline',
  'Test quality',
  'Codebase fit',
  'Maintainability & clarity',
];

test('agentic-code-benchmark frontmatter and shipped files', () => {
  const { data } = parseFrontmatter(read('skills/agentic-code-benchmark/SKILL.md'));
  assert.strictEqual(data.name, 'agentic-code-benchmark');
  assert.doesNotMatch(String(data.description), /explicitly asks/i);
  for (const rel of [
    'NOTICE.md',
    'references/rubric.md',
    'references/task-suite.md',
    'scripts/collect_metrics.py',
    'scripts/scorecard.py',
  ]) {
    assert.ok(
      fs.existsSync(path.join(skillDir, rel)),
      `missing ${rel}`,
    );
  }
});

test('agentic-code-benchmark rubric titles match scorecard DIMENSIONS display strings', () => {
  const rubric = read('skills/agentic-code-benchmark/references/rubric.md');
  const headings = [...rubric.matchAll(/^## \d+\.\s*(.+)$/gm)].map((m) => m[1].trim());
  assert.deepStrictEqual(headings, TITLES);
  const card = read('skills/agentic-code-benchmark/scripts/scorecard.py');
  for (const t of TITLES) assert.ok(card.includes(t), t);
});

test('agentic-code-benchmark keeps no-evidence=0, blocking_findings, and 40/60', () => {
  const rubric = read('skills/agentic-code-benchmark/references/rubric.md');
  assert.match(rubric, /scored\s+without evidence is scored 0/i);
  assert.match(rubric, /blocking_findings/);
  const skill = read('skills/agentic-code-benchmark/SKILL.md');
  const card = read('skills/agentic-code-benchmark/scripts/scorecard.py');
  for (const src of [skill, card]) assert.match(src, /\b40\b[\s\S]{0,80}\b60\b/);
});

test('agentic-code-benchmark NOTICE provenance and no bouncer CLI wiring', () => {
  const skill = read('skills/agentic-code-benchmark/SKILL.md');
  assert.match(skill, /NOTICE\.md/);
  assert.doesNotMatch(skill, /BOUNCER_ROOT/);
  assert.doesNotMatch(skill, /scripts\/bouncer/);
  const notice = read('skills/agentic-code-benchmark/NOTICE.md');
  assert.match(notice, /Apache/);
  assert.match(notice, /awesome-claude-skills/);
});

test('agentic-code-benchmark sits outside ARCHITECTURE §4 table but in prose; README notes python3', () => {
  const gov = read('docs/ARCHITECTURE.md');
  assert.doesNotMatch(gov, /^\| `agentic-code-benchmark` \|/m);
  assert.match(gov, /`agentic-code-benchmark`/);
  assert.match(read('README.md'), /python3/);
});
