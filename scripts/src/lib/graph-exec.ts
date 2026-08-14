'use strict';
const fs = require('node:fs');
const path = require('node:path');
const { execFileSync } = require('node:child_process');
const { resolveGraphifyBin } = require('./graphify');
const { buildContextDigest } = require('./context-digest');

// graphify 프로세스와 결과 경로 정규화. 해석기 PATH 탐색이
// execFileSync('graphify', ['--version']) 를 돌리므로 realHasGraphify 도
// 여기 둔다 — 이름은 판정처럼 보이지만 프로세스를 띄운다.
// session-graph 를 require 하지 않는다(exec → plan 순환 금지).

// PATH/`command -v` 폴백은 resolveGraphifyBin의 hasOnPath가 흡수한다.
// 해석 실패는 새 상태가 아니라 기존 skip-no-graphify와 같다.
function realHasGraphify(repoRoot) {
  return resolveGraphifyBin({ repoRoot }).bin !== null;
}

// part cwd(보통 ".") 기준 원하는 outDir. graphify가 인정할 값이 필요하면
// cwd에 대해 resolve — runGraphifyUpdate 참고. graphify join 규칙과 무관하게
// cwd-relative 계약을 테스트할 수 있도록 순수 relative helper로 유지.
function graphifyOutEnv(cwdAbs, outDirAbs) {
  return path.relative(cwdAbs, outDirAbs).split(path.sep).join('/') || '.';
}

function partOutDir(outDir, dir) {
  const slug = dir.replace(/[^a-zA-Z0-9]+/g, '-').replace(/^-+|-+$/g, '') || 'root';
  return `${outDir}/parts/${slug}`;
}

function runGraphifyUpdate(repoRoot, dir, outDir, opts = null) {
  // part outDir에 cwd를 격리해 graphify 고정
  // `<cwd>/graphify-out/manifest.json`이 repo root가 아니라 part 아래에
  // 생성되게 한다. scan target은 절대 경로 — cwd는 cache/output sandbox만.
  const partAbs = path.join(repoRoot, outDir);
  const scanAbs = path.join(repoRoot, dir);
  fs.mkdirSync(partAbs, { recursive: true });
  const exec = (opts && opts.exec) || execFileSync;
  // 실행 대상은 해석기가 준 값만 — 여기 리터럴 'graphify'를 두지 않는다.
  // 호출자(defaultExecGraphify)가 한 번 해석한 bin을 넘기는 것이 정상이며,
  // 미주입 시에만 여기서 한 번 더 해석한다(단위 테스트·직접 호출용).
  const bin = (opts && opts.bin) || resolveGraphifyBin({ repoRoot }).bin;
  // graphify는 *상대* GRAPHIFY_OUT을 scan 디렉터리에 join한다. 절대 scan
  // target이면 cwd-relative "."를 넘기면 source tree에 쓰게 되므로, graph.json이
  // partAbs에 오도록 part cwd 기준으로 resolve.
  const outEnv = path.resolve(partAbs, graphifyOutEnv(partAbs, partAbs));
  // `update`는 AST-only 경로: `extract`와 달리 LLM key 불필요.
  exec(bin, ['update', scanAbs], {
    cwd: partAbs,
    env: { ...process.env, GRAPHIFY_OUT: outEnv },
    stdio: 'ignore',
  });
}

// graphify는 scan한 디렉터리 기준 source_file을 기록하고 node id를 파생하므로,
// `scripts`에서 만든 part는 `src/lib/render.ts`를 주장하고 다른 source dir 아래
// 동일 경로명과 충돌할 수 있다. 소비 전에 둘 다 repo-relative/네임스페이스
// 형태로 rewrite. opts.map 이 있으면 파생 파일명→원본 경로로 되돌리고,
// 매핑에 없는 노드는 드롭한다(폴백 없음).
function normalizeGraphPaths(repoRoot, partOut, dir, opts) {
  const graph = JSON.parse(fs.readFileSync(path.join(repoRoot, partOut, 'graph.json'), 'utf8'));
  const idPrefix = `${dir.replace(/[^a-zA-Z0-9]+/g, '_').replace(/^_+|_+$/g, '')}_`;
  const prefixId = (id) => (typeof id === 'string' ? idPrefix + id : id);
  const map = opts && opts.map;

  if (map) {
    const keptIds = new Set();
    const nodes = [];
    for (const node of graph.nodes || []) {
      const f = node.source_file;
      if (typeof f !== 'string' || !f || !Object.prototype.hasOwnProperty.call(map, f)) continue;
      node.id = prefixId(node.id);
      node.source_file = map[f];
      keptIds.add(node.id);
      nodes.push(node);
    }
    graph.nodes = nodes;
    graph.links = (graph.links || []).filter((link) => {
      link.source = prefixId(link.source);
      link.target = prefixId(link.target);
      if (!keptIds.has(link.source) || !keptIds.has(link.target)) return false;
      const f = link.source_file;
      if (typeof f === 'string' && f) {
        if (!Object.prototype.hasOwnProperty.call(map, f)) return false;
        link.source_file = map[f];
      }
      return true;
    });
    graph.hyperedges = (graph.hyperedges || []).filter((hyperedge) => {
      if (Array.isArray(hyperedge.nodes)) {
        hyperedge.nodes = hyperedge.nodes.map(prefixId);
        if (!hyperedge.nodes.every((id) => keptIds.has(id))) return false;
      }
      const f = hyperedge.source_file;
      if (typeof f === 'string' && f) {
        if (!Object.prototype.hasOwnProperty.call(map, f)) return false;
        hyperedge.source_file = map[f];
      }
      return true;
    });
  } else {
    const prefixFile = (f) => (typeof f === 'string' && f ? `${dir}/${f}` : f);
    for (const node of graph.nodes || []) {
      node.id = prefixId(node.id);
      node.source_file = prefixFile(node.source_file);
    }
    for (const link of graph.links || []) {
      link.source = prefixId(link.source);
      link.target = prefixId(link.target);
      link.source_file = prefixFile(link.source_file);
    }
    for (const hyperedge of graph.hyperedges || []) {
      if (Array.isArray(hyperedge.nodes)) hyperedge.nodes = hyperedge.nodes.map(prefixId);
      hyperedge.source_file = prefixFile(hyperedge.source_file);
    }
  }

  const rel = `${partOut}/graph.normalized.json`;
  fs.writeFileSync(path.join(repoRoot, rel), JSON.stringify(graph));
  return rel;
}

// 각 dir은 parts/ 아래 graphify state를 유지해 incremental rebuild가 graphify가
// 쓴 id를 본다; scope graph.json은 우리가 만든 파생 artifact.
function defaultExecGraphify(repoRoot, graph) {
  // 루프마다 재해석하지 않음 — config/venv/PATH 판정을 한 번만 하고 part·merge에 공유.
  const { bin } = resolveGraphifyBin({ repoRoot });
  let map = null;
  // 소비 측 계약: scanDirs || dirs. source 는 scanDirs 없이 dirs 만 쓴다.
  const scanDirs = graph.scanDirs || graph.dirs;

  if (graph.name === 'context') {
    const digest = buildContextDigest({ repoRoot, contextDirs: graph.dirs });
    if (digest.count === 0) {
      // 빈 다이제스트면 graphify를 돌리지 않고 기존 graph.json 내용도 덮지 않는다.
      // 그냥 return 하면 mtime이 그대로라 freshness가 계속 stale → 매 sync가 build.
      // 파일이 있을 때만 utimes로 판정을 가라앉힌다(내용 불변). 없으면 no-op.
      const target = path.join(repoRoot, graph.outDir, 'graph.json');
      if (fs.existsSync(target)) {
        const now = new Date();
        fs.utimesSync(target, now, now);
        return { skippedEmpty: true, touched: true };
      }
      return { skippedEmpty: true, touched: false };
    }
    map = digest.map;
  }

  const parts = scanDirs.map((dir) => {
    const partOut = partOutDir(graph.outDir, dir);
    runGraphifyUpdate(repoRoot, dir, partOut, { bin });
    // map 이 있으면 파생 basename 을 원본 경로로 되돌린다. 매핑 없는
    // 노드는 드롭 — 파생 이름을 source_file 로 남기면 suggested_paths 가
    // graphify-out 을 가리킨다.
    return normalizeGraphPaths(repoRoot, partOut, dir, map ? { map } : undefined);
  });
  const target = path.join(repoRoot, graph.outDir, 'graph.json');
  if (parts.length === 1) {
    fs.mkdirSync(path.dirname(target), { recursive: true });
    fs.copyFileSync(path.join(repoRoot, parts[0]), target);
    return;
  }
  execFileSync(bin, ['merge-graphs', ...parts, '--out', `${graph.outDir}/graph.json`], {
    cwd: repoRoot,
    stdio: 'ignore',
  });
}

module.exports = {
  realHasGraphify,
  graphifyOutEnv,
  partOutDir,
  runGraphifyUpdate,
  normalizeGraphPaths,
  defaultExecGraphify,
};
