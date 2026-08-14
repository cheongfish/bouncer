'use strict';
const fs = require('node:fs');
const path = require('node:path');
const { detectLegacyFormat } = require('./schema');
const { CONTEXT_ROOT, isCanonicalBlueprintDir } = require('./layout');
const { toPosix } = require('./paths');
const {
  runVerification, entriesForVerify,
} = require('./verification');
const { checkEpicIndexConsistency } = require('./epic-index');
const {
  loadBlueprintDocs, resolveTaskUnit, blueprintDocsExist, statusOf,
} = require('./validate-docs');
const { checkStructural, checkDistillStructural } = require('./validate-structural');
const { checkGate } = require('./validate-gates');
const {
  parseTasksSections, parseSections, extractPathCandidates,
} = require('./validate-sections');

// 오케스트레이션 + 공개 배럴. validateBlueprint는 이 파일에 남긴다 —
// 함수 안의 레거시 `.sdd` 문자열이 public-name-regression allowlist에
// 이 파일명으로 고정되어 있어, 옮기면 그 테스트가 깨진다.
// 게이트/구조/로드/파싱 구현은 형제 모듈. 순환을 만들지 않기 위해
// 형제들은 이 파일을 require하지 않는다.

function validateBlueprint({ repoRoot, blueprintDir, gate, deps }) {
  if (!isCanonicalBlueprintDir(blueprintDir)) {
    return {
      ok: false,
      failures: [{
        code: 'S10',
        message: `blueprintDir must be under ${CONTEXT_ROOT}/epics`,
        file: toPosix(blueprintDir),
      }],
    };
  }

  const legacyRepo = detectLegacyFormat({ repoRoot });
  if (legacyRepo.legacy) {
    return {
      ok: false,
      failures: [{ code: 'S2', message: legacyRepo.reason, file: '.sdd' }],
    };
  }

  // blueprint 문서가 하나도 없으면 문서 문제가 아니라 잘못된 경로를 의미함.
  // 이를 먼저 보고하면 빈 문서 집합이 만드는 gate 실패 연쇄를 쫓지 않게 하고,
  // 존재하지 않는 경로에 대해 `execute`가 verify 명령을 실행하는 것을 막음.
  // epic index는 의도적으로 제외: 해당 epic 아래 모든 blueprint에 존재하므로,
  // 오타 난 blueprint 이름이 이 검사를 통과해 버릴 수 있음.
  if (!blueprintDocsExist({ repoRoot, blueprintDir })) {
    return {
      ok: false,
      failures: [{
        code: 'S11',
        message: 'blueprint documents not found — check the blueprint path',
        file: toPosix(blueprintDir),
      }],
    };
  }

  const executionFailures = [];
  if (gate === 'execute') {
    // G13 file은 포인터 대상 묶음의 verification 경로. 루트 고정 경로를 쓰면
    // tasks/<NNN>/ 레이아웃에서 실패 위치가 엉킨다.
    let verificationFile = `${toPosix(blueprintDir)}/verification.md`;
    try {
      const entries = entriesForVerify(repoRoot, blueprintDir);
      if (entries[0] && entries[0].verification && entries[0].verification.rel) {
        verificationFile = entries[0].verification.rel;
      }
      const verification = runVerification({ repoRoot, blueprintDir });
      if (!verification.ok) {
        executionFailures.push({
          code: 'G13',
          message: `configured verify command failed with exit code ${verification.exitCode}`,
          file: verificationFile,
        });
      }
    } catch (error) {
      executionFailures.push({
        code: 'G13',
        message: error.message,
        file: verificationFile,
      });
    }
  }

  // execute gate가 방금 기록한 증적을 읽도록 verification 이후에 로드.
  const { docs, rels, parseErrors, tasksListing } = loadBlueprintDocs({ repoRoot, blueprintDir });
  const failures = [...executionFailures, ...parseErrors];

  // 문서 구조와 별개인 Distill 샤드 경고도 public validate의 동일한 실패
  // 집합에 넣는다. 이 연결이 없으면 checkDistillStructural을 직접 부른
  // 테스트만 경고를 보고, 실제 plan/execute 호출은 활성 라우팅을 통과시킨다.
  failures.push(...checkDistillStructural({ repoRoot }).failures);

  // 한 blueprint에 레거시 tasks.md와 번호 문서가 섞이면 어느 규칙을
  // 적용할지 모호해지므로 구조 단계에서 거절한다.
  if (tasksListing && tasksListing.legacyFiles && tasksListing.legacyFiles.length) {
    failures.push({
      code: 'S15', message: `legacy task layout remains: ${tasksListing.legacyFiles.join(', ')}; run bouncer migrate task-layout`, file: toPosix(blueprintDir),
    });
  }
  for (const name of (tasksListing && tasksListing.invalidDirs) || []) failures.push({ code: 'S16', message: `non-canonical task directory: tasks/${name}`, file: `${toPosix(blueprintDir)}/tasks/${name}` });
  for (const entry of (tasksListing && tasksListing.entries) || []) for (const leaf of ['tasks', 'verification', 'review']) {
    const rel = entry[leaf].rel;
    if (!fs.existsSync(path.join(repoRoot, rel))) failures.push({ code: 'S17', message: `task unit ${entry.number} missing ${path.posix.basename(rel)}`, file: rel });
  }

  const anyLeaf = (docs.tasksDocs && docs.tasksDocs.length > 0)
    || (docs.taskUnits && docs.taskUnits.length > 0)
    || ['verification', 'review', 'explain'].some((k) => docs[k]);
  if (anyLeaf && !docs.blueprintIndex) {
    failures.push({ code: 'S8', message: 'blueprint index.md absent', file: rels.blueprintIndex });
  }
  if (docs.blueprintIndex && !docs.epicIndex) {
    failures.push({ code: 'S8', message: 'epic index.md absent', file: rels.epicIndex });
  }

  const hasTaskUnits = Array.isArray(docs.taskUnits) && docs.taskUnits.length > 0;
  // 번호 tasks가 루트 verification/review를 공유하면 같은 rel을 두 번
  // 검사하지 않는다. unit leaf에서 못 본 루트 파일은 그대로 검사한다
  // (task-dir 레이아웃에 남은 고아 루트 증적/리뷰).
  const unitSeenRels = new Set();
  for (const key of Object.keys(docs)) {
    if (key === 'taskUnits') {
      for (const unit of docs.taskUnits) {
        for (const leaf of ['tasks', 'verification', 'review']) {
          const leafDoc = unit[leaf];
          if (!leafDoc || unitSeenRels.has(leafDoc.rel)) continue;
          unitSeenRels.add(leafDoc.rel);
          checkStructural(leafDoc, failures);
        }
      }
      continue;
    }
    if (key === 'tasksDocs') {
      // taskUnits가 있으면 tasks leaf는 그쪽에서 이미 검사함.
      if (hasTaskUnits) continue;
      for (const td of docs.tasksDocs) checkStructural(td, failures);
      continue;
    }
    // tasksDocs/taskUnits가 있으면 docs.tasks는 그 첫 항목이라 중복 검사하지 않는다.
    if (key === 'tasks' && (docs.tasksDocs || hasTaskUnits)) continue;
    if (
      (key === 'verification' || key === 'review')
      && docs[key]
      && unitSeenRels.has(docs[key].rel)
    ) {
      continue;
    }
    checkStructural(docs[key], failures);
  }

  failures.push(...checkEpicIndexConsistency({ repoRoot }));

  // imported blueprint는 게이트·작업 대상이 아니다. 구조·에픽목록 검사는 유지하되
  // checkGate를 건너뛰고 S18 하나로 거절한다 — ok:true/gateSkipped로 통과시키면
  // cmdCurrent --set이 plan 통과로 포인터를 잡아버린다. epic-only imported는
  // 판정하지 않는다(기준은 blueprint status). S14는 결번이므로 재사용하지 않는다.
  if (statusOf(docs.blueprintIndex) === 'imported') {
    failures.push({
      code: 'S18',
      message: 'imported document is out of gate scope',
      file: rels.blueprintIndex,
    });
    return { ok: false, failures };
  }

  if (gate) {
    // execute·commit 모두 포인터 task 단위만 본다(G6–G8).
    const taskUnit = (gate === 'execute' || gate === 'commit')
      ? resolveTaskUnit(docs, { repoRoot, blueprintDir })
      : undefined;
    checkGate(gate, docs, rels, failures, { repoRoot, blueprintDir, deps, taskUnit });
  }

  return { ok: failures.length === 0, failures };
}

module.exports = {
  loadBlueprintDocs, resolveTaskUnit, checkStructural, checkGate, validateBlueprint,
  parseTasksSections, parseSections, extractPathCandidates,
};
