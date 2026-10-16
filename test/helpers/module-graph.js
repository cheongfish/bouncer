'use strict';
const fs = require('node:fs');
const path = require('node:path');

// 소스 한 줄에서 상대 `require('./y')`를 모두 뽑는다. 최상위 `import x = require('./y')`와
// 함수 안의 지연 `require('./y')`가 같은 문법이라 한 정규식으로 둘 다 잡힌다.
// `import type`은 컴파일 때 지워져 런타임 간선이 아니므로 읽지 않는다.
const RELATIVE_REQUIRE = /\brequire\(\s*(['"])(\.{1,2}\/[^'"]+)\1\s*\)/g;

/**
 * 한 모듈 소스에서 상대 require 대상(확장자 제거 모듈 이름)을 모은다.
 * 주석 줄은 건너뛴다 — 설명용 `require('./verification')` 문구가 가짜 간선을
 * 만들어 순환 검사를 오염시키지 않게 하기 위해서다.
 *
 * @param {string} dir - 모듈이 있는 디렉터리 절대 경로
 * @param {string} file - 읽을 `.ts` 파일 이름
 * @returns {Set<string>} 이 모듈이 상대 require 하는 모듈 이름 집합
 */
function edgesOf(dir, file) {
  const edges = new Set();
  const lines = fs.readFileSync(path.join(dir, file), 'utf8').split('\n');
  for (const line of lines) {
    const trimmed = line.trim();
    if (trimmed.startsWith('//') || trimmed.startsWith('*') || trimmed.startsWith('/*')) continue;
    for (const match of line.matchAll(RELATIVE_REQUIRE)) {
      // 번들된 vendor(js-yaml)는 빌드 산출물 기준 상대 경로라 소스 트리에서 해석되지 않는
      // 외부 leaf다. 모듈 간선이 아니므로 이 한 가지 접두만 명시적으로 건너뛴다.
      if (match[2].startsWith('../vendor/')) continue;
      const target = path.resolve(dir, match[2]).replace(/\.(?:js|ts)$/, '');
      // 해석 실패를 조용히 버리면 경계 테스트가 빈 그래프로 통과한다. 즉시 던진다.
      if (path.dirname(target) !== dir || !fs.existsSync(`${target}.ts`)) {
        throw new Error(`unresolved relative require in ${file}: ${match[2]}`);
      }
      edges.add(path.basename(target));
    }
  }
  return edges;
}

/**
 * 디렉터리의 모든 `.ts` 모듈을 읽어 모듈 의존 그래프를 만든다.
 *
 * @param {string} rawDir - 소스 디렉터리 경로(예: scripts/src/lib). 상대 경로면 절대로 바꿔 쓴다
 * @returns {Map<string, Set<string>>} 모듈 이름 → 직접 require 하는 모듈 이름 집합
 */
function loadModuleGraph(rawDir) {
  const dir = path.resolve(rawDir);
  const graph = new Map();
  for (const file of fs.readdirSync(dir).filter((name) => name.endsWith('.ts')).sort()) {
    graph.set(file.replace(/\.ts$/, ''), edgesOf(dir, file));
  }
  return graph;
}

/**
 * Tarjan SCC로 순환 묶음을 찾는다. 크기 2 이상이거나 자기 간선이 있는 묶음만 순환이다.
 *
 * @param {Map<string, Set<string>>} graph - loadModuleGraph 결과
 * @returns {string[][]} 순환 묶음 목록(각 묶음은 정렬된 모듈 이름). 순환이 없으면 빈 배열
 */
function findCycles(graph) {
  let counter = 0;
  const index = new Map();
  const low = new Map();
  const onStack = new Set();
  const stack = [];
  const cycles = [];
  const visit = (node) => {
    index.set(node, counter);
    low.set(node, counter);
    counter += 1;
    stack.push(node);
    onStack.add(node);
    for (const next of graph.get(node) || []) {
      if (!index.has(next)) {
        visit(next);
        low.set(node, Math.min(low.get(node), low.get(next)));
      } else if (onStack.has(next)) {
        low.set(node, Math.min(low.get(node), index.get(next)));
      }
    }
    if (low.get(node) !== index.get(node)) return;
    const group = [];
    let member;
    do {
      member = stack.pop();
      onStack.delete(member);
      group.push(member);
    } while (member !== node);
    if (group.length > 1 || (graph.get(node) || new Set()).has(node)) cycles.push(group.sort());
  };
  for (const node of graph.keys()) if (!index.has(node)) visit(node);
  return cycles;
}

/**
 * `from`에서 전이적으로 도달하는 모듈 집합(자기 자신 제외 — 자기 순환이면 포함).
 *
 * @param {Map<string, Set<string>>} graph - loadModuleGraph 결과
 * @param {string} from - 시작 모듈 이름
 * @returns {Set<string>} 도달 가능한 모듈 이름 집합
 * @throws {Error} `from`이 그래프에 없으면 `module not in graph: <from>` — 대상 모듈이
 *   아직 없을 때 빈 집합으로 조용히 통과하지 않게 한다.
 */
function reachable(graph, from) {
  if (!graph.has(from)) throw new Error(`module not in graph: ${from}`);
  const seen = new Set();
  const pending = [...graph.get(from)];
  while (pending.length > 0) {
    const node = pending.pop();
    if (seen.has(node)) continue;
    seen.add(node);
    for (const next of graph.get(node) || []) pending.push(next);
  }
  return seen;
}

module.exports = { loadModuleGraph, findCycles, reachable };
