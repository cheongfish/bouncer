'use strict';
const fs = require('node:fs');
const path = require('node:path');
const { readDoc } = require('./frontmatter');
const { epicDirOf, toPosix } = require('./paths');
const { readRuntimeCurrent, writeRuntimeCurrent, clearRuntimeCurrent } = require('./runtime-state');

const READY_TASK_STATUS = ['ready', 'in_progress'];

// epic `## Blueprints` 링크 대상(예: `blueprints/BP-001-slug/index.md`)과 매칭.
// blueprint directory 이름만 캡처; title 텍스트와 한 줄 purpose는 무시.
const BLUEPRINT_LINK_RE = /\]\(blueprints\/([^/)]+)\/index\.md\)/g;

function readCurrent({ repoRoot, deps }) {
  return readRuntimeCurrent({ repoRoot, deps });
}

function writeCurrent({
  repoRoot, blueprint, base, deps,
}) {
  return writeRuntimeCurrent({
    repoRoot, blueprint, base, deps,
  });
}

function clearCurrent({ repoRoot, deps }) {
  return clearRuntimeCurrent({ repoRoot, deps });
}

// approved blueprint 중 execute가 아직 열린 tasks만 side-effect 없이 스캔.
// 깨지거나 읽을 수 없는 doc은 항목별로 skip하여 corrupt blueprint 하나가
// ready list 전체를 지우지 않게 함 (pointer가 null일 때 execute가
// "planned but unset"과 "nothing planned"를 구분하는 데 사용).
function listReadyBlueprints({ repoRoot }) {
  const list: Array<{ blueprint: string; status: string }> = [];
  const epicsRoot = path.join(repoRoot, '.bouncer', 'context', 'epics');
  if (!fs.existsSync(epicsRoot)) return list;

  let epicNames: string[];
  try {
    epicNames = fs.readdirSync(epicsRoot);
  } catch (_e) {
    return list;
  }

  for (const epicName of epicNames) {
    const blueprintsRoot = path.join(epicsRoot, epicName, 'blueprints');
    if (!fs.existsSync(blueprintsRoot)) continue;
    let bpNames: string[];
    try {
      bpNames = fs.readdirSync(blueprintsRoot);
    } catch (_e) {
      continue;
    }
    for (const bpName of bpNames) {
      const bpAbs = path.join(blueprintsRoot, bpName);
      let st;
      try {
        st = fs.statSync(bpAbs);
      } catch (_e) {
        continue;
      }
      if (!st.isDirectory()) continue;
      const rel = toPosix(path.relative(repoRoot, bpAbs));
      try {
        const indexDoc = readDoc(path.join(bpAbs, 'index.md'));
        const tasksDoc = readDoc(path.join(bpAbs, 'tasks.md'));
        const bpStatus = indexDoc.data && indexDoc.data.bouncer
          ? indexDoc.data.bouncer.status
          : undefined;
        const tasksStatus = tasksDoc.data && tasksDoc.data.bouncer
          ? tasksDoc.data.bouncer.status
          : undefined;
        if (bpStatus === 'approved' && READY_TASK_STATUS.includes(tasksStatus)) {
          list.push({ blueprint: rel, status: tasksStatus });
        }
      } catch (_e) {
        // 이 blueprint만 skip — 형제는 계속 스캔.
      }
    }
  }

  list.sort((a, b) => a.blueprint.localeCompare(b.blueprint));
  return list;
}

// epic index의 `## Blueprints` section만 읽어 blueprint directory 이름을
// 링크 등장 순으로 반환. section 없음/읽기 실패 → [] (throw 없음):
// caller는 path lexicographic order로 fallback.
function parseEpicBlueprintOrder(epicIndexAbs) {
  let text: string;
  try {
    text = fs.readFileSync(epicIndexAbs, 'utf8');
  } catch (_e) {
    return [];
  }
  // YAML frontmatter를 제거해 그 안의 `## Blueprints` 문자열이 이기지 않게 함.
  const fmEnd = text.indexOf('\n---\n');
  const body = fmEnd >= 0 ? text.slice(fmEnd + 5) : text;
  const sectionMatch = /^## Blueprints\s*$/m.exec(body);
  if (!sectionMatch) return [];
  const start = sectionMatch.index + sectionMatch[0].length;
  // 다음 ATX h2가 이 section을 끝냄; 더 깊은 heading은 무시.
  const rest = body.slice(start);
  const nextH2 = /^## /m.exec(rest);
  const section = nextH2 ? rest.slice(0, nextH2.index) : rest;
  const names: string[] = [];
  BLUEPRINT_LINK_RE.lastIndex = 0;
  let m;
  while ((m = BLUEPRINT_LINK_RE.exec(section)) !== null) {
    names.push(m[1]);
  }
  return names;
}

function readAffectedPaths(repoRoot, blueprintDir) {
  try {
    const doc = readDoc(path.join(repoRoot, blueprintDir, 'tasks.md'));
    const paths = doc.data && doc.data.bouncer
      ? doc.data.bouncer.affected_paths
      : undefined;
    return Array.isArray(paths) ? paths.filter((p) => typeof p === 'string') : [];
  } catch (_e) {
    return [];
  }
}

// finalize 대상 이후 다음 ready blueprint 계산 — 순수 계산, write/git/process
// 없음. 후보는 listReadyBlueprints에서만; 정렬은 finalized epic 우선, 다음
// ## Blueprints link order, epic 내 미등록은 path lexicographic, 그다음
// 다른 epic은 epic dir name 순.
function nextBlueprint({ repoRoot, blueprintDir }) {
  const selfRaw = String(blueprintDir);
  const selfPosix = toPosix(selfRaw);
  const selfEpic = epicDirOf(selfPosix);
  const ready = listReadyBlueprints({ repoRoot }).filter((entry) => {
    const bp = entry.blueprint;
    return bp !== selfRaw && bp !== selfPosix;
  });

  type Candidate = {
    blueprint: string;
    epic: string;
    sameEpic: boolean;
    bpName: string;
    epicName: string;
  };
  const ranked: Candidate[] = ready.map((entry) => {
    const bp = entry.blueprint;
    const epic = epicDirOf(bp);
    return {
      blueprint: bp,
      epic,
      sameEpic: epic === selfEpic,
      bpName: bp.split('/').pop() || bp,
      epicName: epic.split('/').pop() || epic,
    };
  });

  // Epic ## Blueprints order는 epic별; distinct epic dir마다 한 번만 읽음.
  const orderCache = new Map();
  function orderOf(epicRel) {
    if (orderCache.has(epicRel)) return orderCache.get(epicRel);
    const abs = path.join(repoRoot, epicRel, 'index.md');
    const names = parseEpicBlueprintOrder(abs);
    orderCache.set(epicRel, names);
    return names;
  }

  ranked.sort((a, b) => {
    // (1) finalize 대상과 같은 epic을 먼저
    if (a.sameEpic !== b.sameEpic) return a.sameEpic ? -1 : 1;
    if (a.sameEpic) {
      // (2)/(3) ## Blueprints 등록 순, 미등록은 path 순
      const order = orderOf(a.epic);
      const ai = order.indexOf(a.bpName);
      const bi = order.indexOf(b.bpName);
      const aListed = ai >= 0;
      const bListed = bi >= 0;
      if (aListed && bListed) return ai - bi;
      if (aListed !== bListed) return aListed ? -1 : 1;
      return a.blueprint.localeCompare(b.blueprint);
    }
    // (4) 다른 epic: epic directory name lexicographic, 다음 blueprint path
    const byEpic = a.epicName.localeCompare(b.epicName);
    if (byEpic !== 0) return byEpic;
    return a.blueprint.localeCompare(b.blueprint);
  });

  if (ranked.length === 0) return { next: null, remaining: [] };

  const finalizedPaths = readAffectedPaths(repoRoot, selfPosix);
  const [head, ...rest] = ranked;
  const candidatePaths = readAffectedPaths(repoRoot, head.blueprint);
  // candidate order로 교집합; 문자열 equality만 — directory containment
  // 추론 없음 (tasks는 정확한 path entry를 선언).
  const sharedPaths = candidatePaths.filter((p) => finalizedPaths.includes(p));

  return {
    next: {
      blueprint: head.blueprint,
      epic: head.epic,
      sameEpic: head.sameEpic,
      sharedPaths,
    },
    remaining: rest.map(({ blueprint, epic, sameEpic }) => ({ blueprint, epic, sameEpic })),
  };
}

module.exports = {
  readCurrent, writeCurrent, clearCurrent, listReadyBlueprints, nextBlueprint,
};
