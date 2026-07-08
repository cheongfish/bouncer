'use strict';

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

module.exports = { parseSuperpowers, suggestedPathsFrom };
