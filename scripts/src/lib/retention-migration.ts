'use strict';

const fs = require('node:fs');
const path = require('node:path');
import layout = require('./layout');
const { CONTEXT_ROOT, isCanonicalBlueprintDir, normalizeRepoPath } = layout;
import paths = require('./paths');
const { toPosix, parsePathIds } = paths;
import frontmatter = require('./frontmatter');
const { readDoc } = frontmatter;
import tasksDocs = require('./tasks-docs');
const { listTasksDocs, expectedTaskDocIds } = tasksDocs;
import validateDocs = require('./validate-docs');
const { loadBlueprintDocs, statusOf } = validateDocs;
import finalize = require('./finalize');
const {
  collectTransientRels,
  buildTaskContext,
  writeExplainTaskContext,
} = finalize;

type RetentionStatus =
  | 'eligible'
  | 'blocked-missing-explain'
  | 'blocked-invalid-task'
  | 'blocked-insufficient-intent'
  | 'already-compacted';

type RetentionRow = {
  blueprint: string;
  status: RetentionStatus;
  reason: string;
  promote: string[];
  delete: string[];
};

type AuditResult = {
  ok: boolean;
  results: RetentionRow[];
  reason?: string;
  code?: string;
};

type MigrateResult = {
  ok: boolean;
  blueprint?: string;
  status?: RetentionStatus;
  reason?: string;
  promote?: string[];
  delete?: string[];
  code?: string;
};

type MigrateDeps = {
  unlinkSync?: (abs: string) => void;
  writeFileSync?: (abs: string, content: string | Buffer) => void;
  readFileSync?: (abs: string) => Buffer;
};

const EPIC_DIR_NAME_RE = /^\d{3}-.+$/;
const BLUEPRINT_DIR_NAME_RE = /^\d{3}-.+$/;

/**
 * context 트리에서 closed Blueprint 상대 경로를 경로순으로 모은다.
 * filesystem 열거 순서를 결과에 실지 않기 위해 마지막에 localeCompare 한다.
 *
 * @param {string} repoRoot - 저장소 루트
 * @returns {string[]} closed Blueprint의 posix 상대 경로
 */
function listClosedBlueprintDirs(repoRoot: string): string[] {
  const found: string[] = [];
  const epicsRoot = path.join(repoRoot, CONTEXT_ROOT, 'epics');
  if (!fs.existsSync(epicsRoot)) return found;
  let epicNames: string[];
  try {
    epicNames = fs.readdirSync(epicsRoot);
  } catch (_e) {
    // 읽기 불가 epics 루트는 빈 감사로 끝낸다 — 부분 목록을 성공처럼 돌리지 않는다.
    return found;
  }
  for (const epicName of epicNames) {
    if (!EPIC_DIR_NAME_RE.test(epicName)) continue;
    const blueprintsRoot = path.join(epicsRoot, epicName, 'blueprints');
    if (!fs.existsSync(blueprintsRoot)) continue;
    let bpNames: string[];
    try {
      bpNames = fs.readdirSync(blueprintsRoot);
    } catch (_e) {
      continue;
    }
    for (const bpName of bpNames) {
      if (!BLUEPRINT_DIR_NAME_RE.test(bpName)) continue;
      const bpAbs = path.join(blueprintsRoot, bpName);
      let st: ReturnType<typeof fs.statSync>;
      try {
        st = fs.statSync(bpAbs);
      } catch (_e) {
        continue;
      }
      if (!st.isDirectory()) continue;
      const rel = toPosix(path.relative(repoRoot, bpAbs));
      if (!isCanonicalBlueprintDir(rel)) continue;
      const indexAbs = path.join(bpAbs, 'index.md');
      if (!fs.existsSync(indexAbs)) continue;
      try {
        const { data } = readDoc(indexAbs);
        if (statusOf({ data, body: '', rel: `${rel}/index.md` }) !== 'closed') continue;
        found.push(rel);
      } catch (_e) {
        // 깨진 index는 closed 목록에 넣지 않는다. 감사 대상이 되려면 상태를 읽을 수 있어야 한다.
      }
    }
  }
  found.sort((a, b) => a.localeCompare(b));
  return found;
}

/**
 * absPath의 실경로가 repoReal 안인지 본다. symlink로 저장소 밖을 가리키면 거절한다.
 * realpath를 못 열면(부재·루프·권한) 탈출 여부를 증명할 수 없어 같이 거절한다.
 *
 * @param {string} absPath - 검사할 절대 경로(링크 포함 가능)
 * @param {string} repoReal - fs.realpathSync(repoRoot)
 * @returns {{ ok: true, real: string } | { ok: false }}
 */
function containedRealpath(absPath: string, repoReal: string):
  | { ok: true; real: string }
  | { ok: false } {
  let real: string;
  try {
    real = fs.realpathSync(absPath);
  } catch (_e) {
    // ENOENT·ELOOP·EACCES — 실경로를 확정하지 못하면 쓰기를 허용하지 않는다.
    return { ok: false };
  }
  if (real === repoReal) return { ok: true, real };
  const prefix = repoReal.endsWith(path.sep) ? repoReal : `${repoReal}${path.sep}`;
  if (!real.startsWith(prefix)) return { ok: false };
  return { ok: true, real };
}

/**
 * 적용·단일 감사에 쓸 Blueprint 경로를 저장소 상대 정본으로 닫는다.
 * 절대 경로·`..` 탈출·정본 레이아웃이 아니거나, symlink 실경로가 repoRoot 밖이면 거절.
 *
 * @param {string} repoRoot - 저장소 루트
 * @param {unknown} blueprintDir - 호출자가 준 경로
 * @returns {{ ok: true, blueprint: string } | { ok: false, reason: string, code: string }}
 */
function resolveBlueprintDir(repoRoot: string, blueprintDir: unknown):
  | { ok: true; blueprint: string }
  | { ok: false; reason: string; code: string } {
  if (typeof blueprintDir !== 'string' || blueprintDir.trim() === '') {
    return { ok: false, reason: 'blueprintDir is required', code: 'INVALID_PATH' };
  }
  const raw = blueprintDir.trim();
  // 절대 경로는 저장소 밖을 가리켜도 상대처럼 보일 수 있어 먼저 거절한다.
  if (path.isAbsolute(raw)) {
    return { ok: false, reason: 'blueprintDir must be a repo-relative path', code: 'INVALID_PATH' };
  }
  const normalized = normalizeRepoPath(raw);
  if (normalized.split('/').includes('..')) {
    return { ok: false, reason: 'blueprintDir must not contain ..', code: 'INVALID_PATH' };
  }
  if (!isCanonicalBlueprintDir(normalized)) {
    return {
      ok: false,
      reason: `blueprintDir must be under ${CONTEXT_ROOT}/epics`,
      code: 'INVALID_PATH',
    };
  }
  const abs = path.resolve(repoRoot, normalized);
  const rootAbs = path.resolve(repoRoot);
  if (abs !== rootAbs && !abs.startsWith(`${rootAbs}${path.sep}`)) {
    return { ok: false, reason: 'blueprintDir resolves outside the repository', code: 'INVALID_PATH' };
  }
  if (!fs.existsSync(abs) || !fs.statSync(abs).isDirectory()) {
    return { ok: false, reason: 'blueprintDir does not exist', code: 'INVALID_PATH' };
  }
  // lexical 봉쇄만으로는 symlink blueprint dir이 저장소 밖으로 쓰기를 열 수 있다.
  let repoReal: string;
  try {
    repoReal = fs.realpathSync(repoRoot);
  } catch (_e) {
    return { ok: false, reason: 'repoRoot is not resolvable', code: 'INVALID_PATH' };
  }
  const contained = containedRealpath(abs, repoReal);
  if (!contained.ok) {
    return { ok: false, reason: 'blueprintDir resolves outside the repository', code: 'INVALID_PATH' };
  }
  return { ok: true, blueprint: normalized };
}

/**
 * Explain이 승격에 쓸 수 있는 형태로 있는지 본다.
 * 파일 부재·frontmatter 파싱 실패·부모 ID 부재는 모두 장기 증적 부재로 본다.
 *
 * @param {string} repoRoot - 저장소 루트
 * @param {string} blueprintDir - Blueprint 상대 경로
 * @returns {{ ok: true, rel: string } | { ok: false, reason: string }}
 */
function inspectExplain(repoRoot: string, blueprintDir: string):
  | { ok: true; rel: string }
  | { ok: false; reason: string } {
  const rel = `${toPosix(blueprintDir)}/explain.md`;
  const abs = path.join(repoRoot, rel);
  if (!fs.existsSync(abs)) {
    return { ok: false, reason: 'explain.md is missing' };
  }
  try {
    const { data } = readDoc(abs);
    if (!data || typeof data !== 'object') {
      return { ok: false, reason: 'explain.md frontmatter is unreadable' };
    }
    const bouncer = (data as { bouncer?: unknown }).bouncer;
    if (!bouncer || typeof bouncer !== 'object') {
      return { ok: false, reason: 'explain.md bouncer block is missing' };
    }
    const epicId = (bouncer as { epic_id?: unknown }).epic_id;
    const blueprintId = (bouncer as { blueprint_id?: unknown }).blueprint_id;
    if (typeof epicId !== 'string' || typeof blueprintId !== 'string') {
      return { ok: false, reason: 'explain.md parent ids are missing' };
    }
    return { ok: true, rel };
  } catch (_e) {
    // 깨진 YAML만 흡수한다. 다른 I/O는 상위에서 실패로 보고한다.
    return { ok: false, reason: 'explain.md could not be parsed' };
  }
}

/**
 * task 묶음이 안전한 승격 입력인지 검사한다.
 * 파싱 실패·비정본 ID·부모 ID 불일치·중복 번호·invalidDirs를 거절한다.
 *
 * @param {string} repoRoot - 저장소 루트
 * @param {string} blueprintDir - Blueprint 상대 경로
 * @returns {{ ok: true, taskUnits: NonNullable<ReturnType<typeof loadBlueprintDocs>['docs']['taskUnits']> }
 *   | { ok: false, reason: string }}
 */
function inspectTasks(repoRoot: string, blueprintDir: string):
  | { ok: true; taskUnits: NonNullable<ReturnType<typeof loadBlueprintDocs>['docs']['taskUnits']> }
  | { ok: false; reason: string } {
  const listing = listTasksDocs({ repoRoot, blueprintDir });
  if (listing.invalidDirs.length > 0) {
    return {
      ok: false,
      reason: `invalid task directories: ${listing.invalidDirs.join(', ')}`,
    };
  }
  const { docs, parseErrors } = loadBlueprintDocs({ repoRoot, blueprintDir });
  const taskParseErrors = parseErrors.filter((entry) => /\/tasks\//.test(entry.file));
  if (taskParseErrors.length > 0) {
    return {
      ok: false,
      reason: `task document parse failed: ${taskParseErrors.map((e) => e.file).join(', ')}`,
    };
  }
  const taskUnits = Array.isArray(docs.taskUnits) ? docs.taskUnits : [];
  const pathIds = parsePathIds(blueprintDir);
  const seenNumbers = new Set<number>();
  for (const unit of taskUnits) {
    if (typeof unit.number === 'number') {
      if (seenNumbers.has(unit.number)) {
        return { ok: false, reason: `duplicate task number ${unit.number}` };
      }
      seenNumbers.add(unit.number);
    }
    const tasksLeaf = unit.tasks;
    if (!tasksLeaf || !tasksLeaf.data || typeof tasksLeaf.data !== 'object') {
      return {
        ok: false,
        reason: `tasks.md missing or unreadable for unit ${String(unit.number)}`,
      };
    }
    const bouncer = (tasksLeaf.data as { bouncer?: Record<string, unknown> }).bouncer || {};
    const digits = typeof unit.number === 'number'
      ? String(unit.number).padStart(3, '0')
      : null;
    if (!digits) {
      return { ok: false, reason: 'task unit number is missing' };
    }
    const expected = expectedTaskDocIds(digits);
    if (bouncer.id !== expected.tasks) {
      return {
        ok: false,
        reason: `task id ${String(bouncer.id)} != expected ${expected.tasks}`,
      };
    }
    if (bouncer.epic_id !== pathIds.epicId) {
      return {
        ok: false,
        reason: `task epic_id ${String(bouncer.epic_id)} != path ${String(pathIds.epicId)}`,
      };
    }
    if (bouncer.blueprint_id !== pathIds.blueprintId) {
      return {
        ok: false,
        reason: `task blueprint_id ${String(bouncer.blueprint_id)} != path ${String(pathIds.blueprintId)}`,
      };
    }
  }
  return { ok: true, taskUnits };
}

/**
 * closed Blueprint 하나를 다섯 상태 중 하나로 분류한다.
 * already-compacted보다 blocked-missing-explain을 우선해 장기 증적 부재를 숨기지 않는다.
 *
 * @param {string} repoRoot - 저장소 루트
 * @param {string} blueprintDir - Blueprint 상대 경로
 * @returns {RetentionRow} 분류 결과
 */
function classifyClosedBlueprint(repoRoot: string, blueprintDir: string): RetentionRow {
  const deleteRels = collectTransientRels({ repoRoot, blueprintDir });
  const explain = inspectExplain(repoRoot, blueprintDir);

  // transient가 없어도 Explain 부재면 compacted로 끝내지 않는다.
  if (!explain.ok) {
    return {
      blueprint: blueprintDir,
      status: 'blocked-missing-explain',
      reason: explain.reason,
      promote: [],
      delete: [],
    };
  }

  if (deleteRels.length === 0) {
    return {
      blueprint: blueprintDir,
      status: 'already-compacted',
      reason: 'no transient documents remain',
      promote: [],
      delete: [],
    };
  }

  const tasks = inspectTasks(repoRoot, blueprintDir);
  if (!tasks.ok) {
    return {
      blueprint: blueprintDir,
      status: 'blocked-invalid-task',
      reason: tasks.reason,
      promote: [],
      delete: [],
    };
  }

  // 승격 본문이 비면 삭제만 하고 Explain을 비우는 적용을 막는다.
  const taskContext = buildTaskContext(tasks.taskUnits);
  if (!taskContext.trim()) {
    return {
      blueprint: blueprintDir,
      status: 'blocked-insufficient-intent',
      reason: 'no durable task sections to promote',
      promote: [],
      delete: [],
    };
  }

  return {
    blueprint: blueprintDir,
    status: 'eligible',
    reason: 'closed blueprint has promotable intent and transient documents',
    promote: [explain.rel],
    delete: deleteRels.slice().sort((a, b) => a.localeCompare(b)),
  };
}

/**
 * closed Blueprint retention을 쓰기 없이 감사한다.
 * blueprintDir가 있으면 그 한 경로만, 없으면 정본 context 트리의 모든 closed를 경로순으로 분류한다.
 *
 * @param {object} opts
 * @param {string} opts.repoRoot - 저장소 루트
 * @param {string} [opts.blueprintDir] - 선택적 단일 Blueprint 상대 경로
 * @returns {AuditResult} 분류 목록. 경로 오류면 ok:false
 */
function auditRetention({ repoRoot, blueprintDir }: {
  repoRoot: string;
  blueprintDir?: string;
}): AuditResult {
  if (blueprintDir !== undefined) {
    const resolved = resolveBlueprintDir(repoRoot, blueprintDir);
    if (!resolved.ok) {
      return { ok: false, results: [], reason: resolved.reason, code: resolved.code };
    }
    const indexAbs = path.join(repoRoot, resolved.blueprint, 'index.md');
    if (!fs.existsSync(indexAbs)) {
      return {
        ok: false,
        results: [],
        reason: 'blueprint index.md is missing',
        code: 'INVALID_PATH',
      };
    }
    let status: unknown;
    try {
      status = statusOf({
        data: readDoc(indexAbs).data,
        body: '',
        rel: `${resolved.blueprint}/index.md`,
      });
    } catch (_e) {
      return {
        ok: false,
        results: [],
        reason: 'blueprint index.md could not be parsed',
        code: 'INVALID_PATH',
      };
    }
    if (status !== 'closed') {
      return {
        ok: false,
        results: [],
        reason: `blueprint status is ${String(status)}, expected closed`,
        code: 'NOT_CLOSED',
      };
    }
    return { ok: true, results: [classifyClosedBlueprint(repoRoot, resolved.blueprint)] };
  }

  const dirs = listClosedBlueprintDirs(repoRoot);
  return {
    ok: true,
    results: dirs.map((dir) => classifyClosedBlueprint(repoRoot, dir)),
  };
}

type FileSnapshot = { abs: string; content: Buffer | null };

/**
 * 적용 전 바이트를 복구한다. 삭제됐던 파일은 다시 쓰고, 없었던 Explain은 지우지 않는다
 * (적용은 기존 Explain만 대상으로 한다).
 *
 * @param {FileSnapshot[]} snapshots - 절대 경로와 원본 바이트
 * @param {(abs: string, content: string | Buffer) => void} writeFileSync - 쓰기 구현
 */
function restoreSnapshots(
  snapshots: FileSnapshot[],
  writeFileSync: (abs: string, content: string | Buffer) => void,
): void {
  for (const snap of snapshots) {
    if (snap.content === null) continue;
    fs.mkdirSync(path.dirname(snap.abs), { recursive: true });
    writeFileSync(snap.abs, snap.content);
  }
}

/**
 * 복구를 최선을 다해 시도한다. 복구 자체가 던져도 호출자가 ok:false를 반환할 수 있게
 * 예외를 삼키고 사유만 돌려준다.
 *
 * @param {FileSnapshot[]} snapshots - 적용 전 스냅샷
 * @param {(abs: string, content: string | Buffer) => void} writeFileSync - 쓰기 구현
 * @returns {string | null} 복구 실패 사유. 성공이면 null
 */
function tryRestoreSnapshots(
  snapshots: FileSnapshot[],
  writeFileSync: (abs: string, content: string | Buffer) => void,
): string | null {
  try {
    restoreSnapshots(snapshots, writeFileSync);
    return null;
  } catch (restoreError) {
    // 부분 적용 뒤 복구 실패를 다시 throw하면 호출자가 ok:false를 못 받고
    // 디스크가 half-applied인 채 uncaught로 끝난다. 사유만 붙인다.
    return (restoreError as { message?: string }).message || 'restoreSnapshots failed';
  }
}

/**
 * 감사에서 eligible인 단일 closed Blueprint에 Explain 승격을 먼저 쓰고 transient를 삭제한다.
 * task_commits는 읽거나 쓰지 않는다. 어느 단계든 실패하면 적용 전 바이트로 되돌린다.
 *
 * @param {object} opts
 * @param {string} opts.repoRoot - 저장소 루트
 * @param {string} opts.blueprintDir - 저장소 상대 Blueprint 경로
 * @param {MigrateDeps} [opts.deps] - 테스트용 fs 주입
 * @returns {MigrateResult} 성공 시 적용 요약, 실패 시 ok:false와 사유
 */
function migrateRetention({ repoRoot, blueprintDir, deps }: {
  repoRoot: string;
  blueprintDir: string;
  deps?: MigrateDeps | null;
}): MigrateResult {
  const unlinkSync = deps && deps.unlinkSync ? deps.unlinkSync : fs.unlinkSync.bind(fs);
  const writeFileSync = deps && deps.writeFileSync
    ? deps.writeFileSync
    : fs.writeFileSync.bind(fs);
  const readFileSync = deps && deps.readFileSync
    ? deps.readFileSync
    : ((abs: string) => fs.readFileSync(abs));

  const resolved = resolveBlueprintDir(repoRoot, blueprintDir);
  if (!resolved.ok) {
    return { ok: false, reason: resolved.reason, code: resolved.code };
  }

  const audited = auditRetention({ repoRoot, blueprintDir: resolved.blueprint });
  if (!audited.ok || audited.results.length !== 1) {
    return {
      ok: false,
      blueprint: resolved.blueprint,
      reason: audited.reason || 'audit failed',
      code: audited.code || 'AUDIT_FAILED',
    };
  }
  const row = audited.results[0];
  if (row.status !== 'eligible') {
    return {
      ok: false,
      blueprint: row.blueprint,
      status: row.status,
      reason: row.reason,
      promote: row.promote,
      delete: row.delete,
      code: 'NOT_ELIGIBLE',
    };
  }

  let repoReal: string;
  try {
    repoReal = fs.realpathSync(repoRoot);
  } catch (_e) {
    return {
      ok: false,
      blueprint: resolved.blueprint,
      reason: 'repoRoot is not resolvable',
      code: 'INVALID_PATH',
    };
  }

  const explainRel = row.promote[0];
  const explainAbs = path.join(repoRoot, explainRel);
  // explain.md가 저장소 밖을 가리키는 symlink면 writeExplainTaskContext가
  // 링크를 따라 외부 파일에 승격 본문을 쓴다. 삭제 후보도 같은 봉쇄를 적용한다.
  if (!containedRealpath(explainAbs, repoReal).ok) {
    return {
      ok: false,
      blueprint: resolved.blueprint,
      reason: 'explain.md resolves outside the repository',
      code: 'INVALID_PATH',
    };
  }
  const deleteAbs = row.delete.map((rel) => ({
    rel,
    abs: path.join(repoRoot, rel),
  }));
  for (const entry of deleteAbs) {
    if (!fs.existsSync(entry.abs)) continue;
    if (!containedRealpath(entry.abs, repoReal).ok) {
      return {
        ok: false,
        blueprint: resolved.blueprint,
        reason: `${entry.rel} resolves outside the repository`,
        code: 'INVALID_PATH',
      };
    }
  }

  // Explain과 삭제 후보만 스냅샷한다. index.md는 적용이 건드리지 않는다.
  const snapshots: FileSnapshot[] = [
    { abs: explainAbs, content: readFileSync(explainAbs) },
    ...deleteAbs.map(({ abs }) => ({
      abs,
      content: fs.existsSync(abs) ? readFileSync(abs) : null,
    })),
  ];

  const { docs } = loadBlueprintDocs({ repoRoot, blueprintDir: resolved.blueprint });
  const taskContext = buildTaskContext(docs.taskUnits);
  if (!taskContext.trim()) {
    return {
      ok: false,
      blueprint: resolved.blueprint,
      status: 'blocked-insufficient-intent',
      reason: 'no durable task sections to promote',
      code: 'NOT_ELIGIBLE',
    };
  }

  try {
    const wrote = writeExplainTaskContext({
      repoRoot,
      blueprintDir: resolved.blueprint,
      taskContext,
    });
    if (!wrote) {
      const restoreFail = tryRestoreSnapshots(snapshots, writeFileSync);
      return {
        ok: false,
        blueprint: resolved.blueprint,
        reason: restoreFail
          ? `failed to write Explain task context; restore also failed: ${restoreFail}`
          : 'failed to write Explain task context',
        code: 'PROMOTE_FAILED',
      };
    }

    // 앞 32자만 보면 승격이 잘리거나 접두만 겹쳐도 통과한다. trim한 taskContext
    // 전체가 Explain에 들어갔는지 확인해 삭제 전에 승격을 잠근다.
    const afterPromote = readFileSync(explainAbs).toString('utf8');
    const expectedContext = taskContext.trim();
    if (!afterPromote.includes('## Tasks') || !afterPromote.includes(expectedContext)) {
      const restoreFail = tryRestoreSnapshots(snapshots, writeFileSync);
      return {
        ok: false,
        blueprint: resolved.blueprint,
        reason: restoreFail
          ? `Explain promote could not be re-read; restore also failed: ${restoreFail}`
          : 'Explain promote could not be re-read',
        code: 'PROMOTE_FAILED',
      };
    }

    for (const entry of deleteAbs) {
      if (!fs.existsSync(entry.abs)) continue;
      unlinkSync(entry.abs);
    }
  } catch (error) {
    const applyReason = (error as { message?: string }).message || 'migrateRetention failed';
    const restoreFail = tryRestoreSnapshots(snapshots, writeFileSync);
    return {
      ok: false,
      blueprint: resolved.blueprint,
      reason: restoreFail
        ? `${applyReason}; restore also failed: ${restoreFail}`
        : applyReason,
      code: 'APPLY_FAILED',
    };
  }

  return {
    ok: true,
    blueprint: resolved.blueprint,
    status: 'eligible',
    reason: row.reason,
    promote: row.promote,
    delete: row.delete,
  };
}

export = {
  auditRetention,
  migrateRetention,
  // 테스트·진단용. 공개 CLI는 audit/migrate만 노출한다.
  listClosedBlueprintDirs,
  classifyClosedBlueprint,
  resolveBlueprintDir,
};
