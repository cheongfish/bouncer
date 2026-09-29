'use strict';

const { existsSync, lstatSync, mkdirSync, readdirSync, rmSync, statSync } = require('node:fs');
const path = require('node:path');
const { spawnSync } = require('node:child_process');

// Bouncer init installs Graphify into this venv: ~200 MB per run, rebuildable, no evidence value.
const EXCLUDED = ['.git/bouncer/venv'];

function relativeEntries(root, name) {
  const skip = new Set(EXCLUDED.map((rel) => path.join(name, rel)));
  const entries = [];
  const visit = (rel) => {
    entries.push(rel);
    const abs = path.join(root, rel);
    if (!lstatSync(abs).isDirectory()) return;
    for (const child of readdirSync(abs)) {
      const next = path.join(rel, child);
      if (!skip.has(next)) visit(next);
    }
  };
  visit(name);
  return entries.sort();
}

/**
 * 끝난 run의 작업 디렉터리를 venv를 뺀 tar.gz로 보관하고, 검증된 경우에만 원본을 지운다.
 *
 * Args:
 *   workspace: 보관할 run 작업 디렉터리의 절대 경로.
 *   archiveDir: 압축본을 둘 디렉터리. 없으면 만든다.
 *
 * Returns:
 *   run.json에 남길 결과. 검증에 실패하면 원본을 그대로 두고 status 'failed'와 이유를 돌려준다.
 */
function archiveWorkspace(workspace, archiveDir) {
  const parent = path.dirname(workspace);
  const name = path.basename(workspace);
  const file = path.join(archiveDir, `${name}.tar.gz`);
  const result = { status: 'failed', path: file, excluded: EXCLUDED, bytes: null, error: null };
  if (!existsSync(workspace)) return { ...result, status: 'missing' };
  if (existsSync(file)) return { ...result, error: 'archive already exists' };
  mkdirSync(archiveDir, { recursive: true });
  const tar = (args) => spawnSync('tar', args, { encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 });
  const created = tar(['-C', parent, ...EXCLUDED.map((rel) => `--exclude=${name}/${rel}`), '-czf', file, name]);
  if (created.status !== 0) return { ...result, error: `tar create: ${created.stderr.trim()}` };
  // The listing and a byte comparison must both match before the original may go.
  const listed = tar(['-tzf', file]);
  const archived = listed.stdout.split('\n').filter(Boolean).map((entry) => entry.replace(/\/$/, '')).sort();
  if (listed.status !== 0 || JSON.stringify(archived) !== JSON.stringify(relativeEntries(parent, name))) {
    return { ...result, error: 'archive listing differs from the workspace' };
  }
  const compared = tar(['-C', parent, '-dzf', file]);
  if (compared.status !== 0) return { ...result, error: `archive content differs: ${compared.stdout.trim()}` };
  rmSync(workspace, { recursive: true, force: true });
  return { ...result, status: 'archived', bytes: statSync(file).size };
}

module.exports = { archiveWorkspace, EXCLUDED };
