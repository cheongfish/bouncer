'use strict';
const fs = require('node:fs');
const path = require('node:path');
const { scaffoldEpic, scaffoldBlueprint } = require('./scaffold');
const { readDoc } = require('./frontmatter');
const { renderDoc } = require('./render');

function parseSuperpowers(markdown) {
  const titleM = /^#\s+(.+?)\s*$/m.exec(markdown);
  let title = titleM ? titleM[1].trim() : 'Imported';
  title = title.replace(/\s+Implementation Plan$/i, '').replace(/\s+design$/i, '').trim();

  const taskM = /^###\s+Task\s+/m.exec(markdown);
  if (taskM) {
    const blueprintBody = `${markdown.slice(0, taskM.index).trimEnd()}\n`;
    const tasksBody = `# Tasks\n\n${markdown.slice(taskM.index).trimEnd()}\n`;
    return { title, blueprintBody, tasksBody, hasTasks: true };
  }
  return {
    title,
    blueprintBody: `${markdown.trimEnd()}\n`,
    tasksBody: '# Tasks\n\n- [ ] TODO\n',
    hasTasks: false,
  };
}

function looksLikePath(tok, dirs) {
  const clean = tok.split(':')[0];
  if (!clean.includes('/')) return false;
  if (!/\.[A-Za-z0-9]+$/.test(clean)) return false;
  return dirs.includes(clean.split('/')[0]);
}

function suggestedPathsFrom(text, sourceDirs) {
  const dirs = Array.isArray(sourceDirs) && sourceDirs.length ? sourceDirs : ['src', 'test'];
  const found = new Set();
  const backtick = /`([^`\n]+)`/g;
  let m;
  while ((m = backtick.exec(text)) !== null) {
    const tok = m[1].trim();
    if (looksLikePath(tok, dirs)) found.add(tok.split(':')[0]);
  }
  return [...found].sort();
}

function readSourceDirs(repoRoot) {
  try {
    const cfg = JSON.parse(fs.readFileSync(path.join(repoRoot, '.bouncer/config.json'), 'utf8'));
    return Array.isArray(cfg.source_dirs) ? cfg.source_dirs : ['src', 'test'];
  } catch (_e) {
    return ['src', 'test'];
  }
}

function injectBody(repoRoot, rel, body) {
  const abs = path.join(repoRoot, rel);
  const { data } = readDoc(abs);
  fs.writeFileSync(abs, renderDoc(data, body));
}

function injectTasks(repoRoot, rel, body, suggested) {
  const abs = path.join(repoRoot, rel);
  const { data } = readDoc(abs);
  if (!data.bouncer) data.bouncer = {};
  if (!data.bouncer.graph) data.bouncer.graph = {};
  data.bouncer.graph.suggested_paths = suggested;
  if (typeof data.bouncer.graph.basis !== 'string' || !data.bouncer.graph.basis.trim()) {
    data.bouncer.graph.basis = 'import-superpowers: suggested from plan/spec paths';
  }
  fs.writeFileSync(abs, renderDoc(data, body));
}

function importSuperpowers(opts) {
  const {
    repoRoot, specPath, planPath, epicDir, epicId, epicName,
    blueprintId, name, timestamp, deps,
  } = opts;
  const readFile = (deps && deps.readFile)
    || ((rel) => fs.readFileSync(path.join(repoRoot, rel), 'utf8'));
  const sourceDirs = (deps && deps.sourceDirs) || (() => readSourceDirs(repoRoot));

  const specText = specPath ? readFile(specPath) : '';
  const planText = planPath ? readFile(planPath) : '';
  if (!specText && !planText) {
    return { ok: false, reason: 'no-input', message: 'at least one of specPath/planPath is required' };
  }

  const spec = specText ? parseSuperpowers(specText) : null;
  const plan = planText ? parseSuperpowers(planText) : null;
  const title = (spec && spec.title) || (plan && plan.title) || 'Imported';
  const blueprintBody = spec ? spec.blueprintBody : plan.blueprintBody;
  const tasksBody = (plan && plan.hasTasks) ? plan.tasksBody
    : (spec && spec.hasTasks ? spec.tasksBody : '# Tasks\n\n- [ ] TODO\n');

  let created = [];
  let ed = epicDir;
  if (!ed) {
    created = created.concat(scaffoldEpic({ repoRoot, epicId, name: epicName, timestamp }));
    ed = `context/epics/${epicId}-${epicName}`;
  }
  created = created.concat(scaffoldBlueprint({ repoRoot, epicDir: ed, blueprintId, name, timestamp }));
  const blueprintDir = `${ed}/blueprints/${blueprintId}-${name}`;

  injectBody(repoRoot, `${blueprintDir}/index.md`, blueprintBody);
  const suggested = suggestedPathsFrom(`${specText}\n${planText}`, sourceDirs());
  injectTasks(repoRoot, `${blueprintDir}/tasks.md`, tasksBody, suggested);

  return {
    ok: true,
    created,
    blueprintDir,
    epicDir: ed,
    title,
    suggested_paths: suggested,
    proposed_affected_paths: suggested,
    sources: { spec: specPath || null, plan: planPath || null },
  };
}

module.exports = { parseSuperpowers, suggestedPathsFrom, importSuperpowers };
