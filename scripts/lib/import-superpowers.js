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

module.exports = { parseSuperpowers };
