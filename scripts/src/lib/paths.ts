'use strict';

const FILE_KIND = {
  'tasks.md': 'tasks',
  'verification.md': 'verification',
  'review.md': 'review',
  'explain.md': 'explain',
};

function toPosix(p) {
  return String(p).split('\\').join('/');
}

function parsePathIds(resourcePath) {
  const norm = toPosix(resourcePath);
  const epicM = /\/epics\/EPIC-(\d+)/.exec(norm) || /^epics\/EPIC-(\d+)/.exec(norm);
  const bpM = /\/blueprints\/BP-(\d+)/.exec(norm);
  const epicId = epicM ? `EPIC-${epicM[1]}` : null;
  const blueprintId = bpM ? `BP-${bpM[1]}` : null;
  const base = norm.split('/').pop();
  let kind = FILE_KIND[base] || null;
  if (base === 'index.md') {
    kind = blueprintId ? 'blueprint' : (epicId ? 'epic' : null);
  }
  return { epicId, blueprintId, kind };
}

function epicDirOf(blueprintDir) {
  return toPosix(blueprintDir).split('/blueprints/')[0];
}

module.exports = { parsePathIds, epicDirOf, toPosix };
