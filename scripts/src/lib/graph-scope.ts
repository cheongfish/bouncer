'use strict';
const fs = require('node:fs');
const path = require('node:path');
const { readConfig } = require('./config');
const {
  CONTEXT_DIGEST_OUT,
  DIGEST_WATCH_FILES,
} = require('./context-digest');

// 설정·디렉터리 존재·mtime 판정만. 프로세스를 띄우지 않고 graphify.ts 도
// require 하지 않는다 — 그 모듈의 PATH 탐색이 execFileSync 를 돌리기 때문.
// 신선도 계산이 graphify 설치 여부를 묻기 시작하면 테스트가 deps 없이
// 안전한 함수와 아닌 함수를 구분하지 못한다.

const DEFAULT_SOURCE_OUT = 'graphify-out/source';
const DEFAULT_CONTEXT_OUT = 'graphify-out/context';
const DEFAULT_CONTEXT_DIRS = ['.bouncer/context'];
// freshness walk 전용 이름 기반 prune — config key 아님.
// graphify-out 을 건너뛰는 이유 둘:
// 1) 파생 트리는 freshness 입력이 아니다. 컨텍스트 그래프는
//    graphify-out/context-src 를 스캔하지만, 그 mtime 이 stale 을 만들면
//    매 sync 가 자기 산출물을 보고 재빌드한다.
// 2) 사용자가 source_dirs: ["."] 로 graphify-out 을 다시 넣으면
//    build 가 graphify-out 아래에 쓰기 → mtime 갱신 → rebuild 무한 루프.
const SCAN_EXCLUDED_DIRS = new Set(['graphify-out', 'node_modules', '.git', '.worktrees']);

function realGraphifyEnabled(repoRoot) {
  // ?? {}를 붙이지 않는다. 부재를 빈 객체와 같게 보면 enabled 판정이
  // "키 없음"과 "파일 없음"을 구분하지 못하게 되고, 둘 다 false로 떨어져
  // 겉보기엔 같아 보이지만 cfg?. 전제(null 유지)가 깨진다.
  const cfg = readConfig(repoRoot);
  return cfg?.graphify?.enabled === true;
}

function realSourceDirs(repoRoot) {
  const cfg = readConfig(repoRoot);
  return Array.isArray(cfg?.source_dirs) ? cfg.source_dirs : [];
}

function realContextDirs(repoRoot) {
  const cfg = readConfig(repoRoot);
  if (Array.isArray(cfg?.context_dirs)) return cfg.context_dirs;
  return DEFAULT_CONTEXT_DIRS;
}

function realExistingDirs(repoRoot, dirs) {
  return dirs.filter((d) => fs.existsSync(path.join(repoRoot, d)));
}

function newestMtimeUnder(repoRoot, dir) {
  const root = path.join(repoRoot, dir);
  let newest = 0;
  const walk = (abs) => {
    let entries;
    try { entries = fs.readdirSync(abs, { withFileTypes: true }); } catch (_e) { return; }
    for (const e of entries) {
      const child = path.join(abs, e.name);
      // exclude set 밖의 실제 디렉터리만 descend. symlink dir은
      // 따라가지 않음 — 링크가 ancestor를 가리킬 때 cycle 방지.
      if (e.isDirectory()) {
        if (!e.isSymbolicLink() && !SCAN_EXCLUDED_DIRS.has(e.name)) walk(child);
        continue;
      }
      const m = fs.statSync(child).mtimeMs;
      if (m > newest) newest = m;
    }
  };
  walk(root);
  return newest;
}

/**
 * dirs 는 보통 디렉터리 walk, watchFiles 는 Distill 같은 단일 파일 mtime.
 * 디렉터리가 아닌 경로는 walk 하지 않고 statSync 로 직접 잰다.
 */
function realNewestMtime(repoRoot, dirs, watchFiles) {
  let newest = 0;
  for (const d of dirs || []) {
    const abs = path.join(repoRoot, d);
    let st;
    try { st = fs.statSync(abs); } catch (_e) { continue; }
    if (st.isDirectory()) {
      newest = Math.max(newest, newestMtimeUnder(repoRoot, d));
    } else if (st.mtimeMs > newest) {
      newest = st.mtimeMs;
    }
  }
  for (const f of watchFiles || []) {
    const abs = path.join(repoRoot, f);
    let st;
    try { st = fs.statSync(abs); } catch (_e) { continue; }
    if (st.isDirectory()) {
      newest = Math.max(newest, newestMtimeUnder(repoRoot, f));
    } else if (st.mtimeMs > newest) {
      newest = st.mtimeMs;
    }
  }
  return newest;
}

function realGraphMtime(repoRoot, outDir) {
  const abs = path.join(repoRoot, outDir, 'graph.json');
  return fs.existsSync(abs) ? fs.statSync(abs).mtimeMs : null;
}

function resolveGraphScopes({ sourceDirs, contextDirs }) {
  return [
    { name: 'source', dirs: sourceDirs, outDir: DEFAULT_SOURCE_OUT },
    {
      name: 'context',
      dirs: contextDirs,
      outDir: DEFAULT_CONTEXT_OUT,
      // 빌드는 파생 트리를 스캔하고, freshness 는 dirs+watchFiles(원본)만 본다.
      scanDirs: [CONTEXT_DIGEST_OUT],
      watchFiles: [...DIGEST_WATCH_FILES],
    },
  ];
}

module.exports = {
  SCAN_EXCLUDED_DIRS,
  DEFAULT_SOURCE_OUT,
  DEFAULT_CONTEXT_OUT,
  DEFAULT_CONTEXT_DIRS,
  realGraphifyEnabled,
  realSourceDirs,
  realContextDirs,
  realExistingDirs,
  newestMtimeUnder,
  realNewestMtime,
  realGraphMtime,
  resolveGraphScopes,
};
