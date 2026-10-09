'use strict';

const fs = require('node:fs');
const path = require('node:path');
import layout = require('./layout');
const { isCanonicalEpicDir, isCanonicalBlueprintDir } = layout;
import paths = require('./paths');
const { toPosix } = paths;
import current = require('./current');
const { resolveCurrent } = current;
import frontmatter = require('./frontmatter');
const { readDoc } = frontmatter;
import tasksDocs = require('./tasks-docs');
const { listTasksDocs } = tasksDocs;

const BOUNCER_DIR = '.bouncer';
const EPICS_REL = '.bouncer/context/epics';
// 정본 id만 센다. EPIC-/BP- 접두는 최댓값에 넣지 않아 구형 디렉터리가
// 다음 번호를 건너뛰게 하지 않는다.
const ID_DIR_RE = /^\d{3}-.+$/;
const MAINTENANCE_DIR_RE = /^\d{3}-maintenance$/;
const VERIFY_FILES = [
  'docker-compose.yml',
  'docker-compose.yaml',
  'compose.yml',
  'compose.yaml',
  'Makefile',
  'Taskfile.yml',
] as const;

// light/full 추천 신호용 경로 규칙. 설정 파일로 열지 않는 코드 상수 —
// review_risk(frontmatter)와 별개 계약이라 여기만 소유한다.
const SECURITY_SEGMENTS = new Set([
  'auth',
  'credential',
  'credentials',
  'secret',
  'secrets',
  'token',
  'tokens',
  'permission',
  'permissions',
]);
const MANIFEST_EXACT = new Set([
  'package.json',
  'package-lock.json',
  'bun.lock',
  'yarn.lock',
  'pnpm-lock.yaml',
  'go.mod',
]);
const MODULE_EXCLUDED = new Set(['test', 'tests', 'docs']);

type InspectFail = {
  ok: false;
  reason: 'not-initialized' | 'invalid-epic-dir' | 'invalid-blueprint-dir';
};

type EpicInfo = {
  dir: string;
  status: string | null;
  nextBlueprintId: string;
};

type CurrentInfo = {
  status: 'selected' | 'empty' | 'ambiguous' | 'invalid';
  blueprint: string | null;
  task: string | null;
  base: string | null;
};

type RiskKind = 'security' | 'manifest' | 'build' | 'migration';

type RiskPath = { path: string; kind: RiskKind };

type Routing = {
  advisory: true;
  tasks: number;
  dependencies: number;
  modules: string[];
  riskPaths: RiskPath[];
  recommendation: 'light-candidate' | 'full-candidate';
  reasons: string[];
};

type InspectOk = {
  ok: true;
  nextEpicId: string;
  epic: EpicInfo | null;
  maintenanceEpic: (EpicInfo & { id: string }) | null;
  verifySignals: string[];
  current: CurrentInfo;
  routing: Routing | null;
};

type InspectResult = InspectOk | InspectFail;

type RoutingTask = { paths: string[]; dependsOn: string[] };

/**
 * `\d{3}-<slug>` 디렉터리 이름만 모아 최댓값 + 1을 세 자리로 채운다.
 * 구형 `EPIC-009` / `BP-001` 이름은 정규식에서 빠지므로 번호가 그 쪽으로
 * 점프하지 않는다. 후보가 없으면 `001` — 빈 트리의 첫 id.
 *
 * @param {string[]} names - 한 부모 아래의 디렉터리 이름
 * @returns {string} zero-pad 세 자리 다음 id
 */
function nextNumericId(names: string[]): string {
  let max = 0;
  for (const name of names) {
    if (!ID_DIR_RE.test(name)) continue;
    const n = Number(name.slice(0, 3));
    if (Number.isFinite(n) && n > max) max = n;
  }
  return String(max + 1).padStart(3, '0');
}

/**
 * 한 부모의 직계 디렉터리 이름만 나열한다. 읽기 실패는 빈 목록 — inspect는
 * 추천값만 계산하므로 권한 오류를 종료로 승격하지 않는다.
 *
 * @param {string} absDir - 절대 경로
 * @returns {string[]} 디렉터리 이름
 */
function listDirNames(absDir: string): string[] {
  try {
    if (!fs.existsSync(absDir)) return [];
    const entries = fs.readdirSync(absDir, { withFileTypes: true });
    const names: string[] = [];
    for (const entry of entries) {
      if (entry.isDirectory()) names.push(entry.name);
    }
    return names;
  } catch (_e) {
    // EACCES 등만 접는다. 추천 id를 못 구하면 빈 목록으로 `001`이 나온다.
    return [];
  }
}

/**
 * epic/blueprint `index.md`의 `bouncer.status`만 읽는다. 파싱 실패는 null —
 * inspect가 문서를 고치지 않고, 없는 상태를 지어내지 않기 위함.
 *
 * @param {string} absIndex - index.md 절대 경로
 * @returns {string | null} 문자열 status, 없거나 읽을 수 없으면 null
 */
function readStatus(absIndex: string): string | null {
  try {
    const doc = readDoc(absIndex);
    const data = doc.data && typeof doc.data === 'object'
      ? doc.data as Record<string, unknown> : {};
    const bouncer = data.bouncer && typeof data.bouncer === 'object'
      ? data.bouncer as Record<string, unknown> : null;
    return bouncer && typeof bouncer.status === 'string' ? bouncer.status : null;
  } catch (_e) {
    // 부재·YAML 오류는 상태 없음으로만 접는다. inspect는 문서를 복구하지 않는다.
    return null;
  }
}

function epicInfo(repoRoot: string, dirRel: string): EpicInfo {
  const blueprintsAbs = path.join(repoRoot, dirRel, 'blueprints');
  return {
    dir: dirRel,
    status: readStatus(path.join(repoRoot, dirRel, 'index.md')),
    nextBlueprintId: nextNumericId(listDirNames(blueprintsAbs)),
  };
}

function presentCurrent(repoRoot: string): CurrentInfo {
  const resolved = resolveCurrent({ repoRoot });
  if (resolved.status === 'selected') {
    return {
      status: 'selected',
      blueprint: resolved.current.blueprint,
      task: resolved.current.task,
      base: resolved.current.base,
    };
  }
  // empty·ambiguous·invalid 모두 포인터 필드를 비운다. 워크플로 중단은
  // 스킬이 status를 보고 결정하며, inspect는 후보를 고르지 않는다.
  return {
    status: resolved.status,
    blueprint: null,
    task: null,
    base: null,
  };
}

/**
 * 루트 파일 존재와 `package.json`의 `scripts` 키 존재만 본다.
 * compose/Makefile 내용은 읽지 않는다. JSON 파싱은 키 존재 확인에만 쓴다.
 *
 * @param {string} repoRoot - 저장소 루트 절대 경로
 * @returns {string[]} Interface 나열 순의 신호 토큰
 */
function collectVerifySignals(repoRoot: string): string[] {
  const signals: string[] = [];
  for (const name of VERIFY_FILES) {
    if (fs.existsSync(path.join(repoRoot, name))) signals.push(name);
  }
  const pkgAbs = path.join(repoRoot, 'package.json');
  if (!fs.existsSync(pkgAbs)) return signals;
  try {
    const parsed: unknown = JSON.parse(fs.readFileSync(pkgAbs, 'utf8'));
    if (
      parsed
      && typeof parsed === 'object'
      && !Array.isArray(parsed)
      && Object.hasOwn(parsed as object, 'scripts')
    ) {
      signals.push('package.json#scripts');
    }
  } catch (_e) {
    // 깨진 JSON은 scripts 키를 확인할 수 없으므로 신호에 넣지 않는다.
  }
  return signals;
}

function normalizeRelDir(value: unknown): string | null {
  if (typeof value !== 'string' || value === '') return null;
  return toPosix(value).replace(/\/+$/, '');
}

/**
 * basename이 `prefix*suffix` 형태(단일 `*`)와 맞는지 본다.
 * 설정/외부 glob 엔진 없이 상수 규칙만 쓰기 위함.
 *
 * @param {string} name - 파일 basename
 * @param {string} prefix - `*` 앞
 * @param {string} suffix - `*` 뒤
 * @returns {boolean} 매칭 여부
 */
function matchStar(name: string, prefix: string, suffix: string): boolean {
  return name.startsWith(prefix) && name.endsWith(suffix)
    && name.length >= prefix.length + suffix.length;
}

/**
 * 경로를 `/` 조각으로 나누고 마지막 조각의 확장자를 벗긴다.
 * `tokenizer`≠`token`처럼 부분 문자열 오탐을 막으려면 확장자 없는
 * 조각과 정확히 비교해야 한다.
 *
 * @param {string} relPath - repo-relative posix 경로
 * @returns {string[]} 확장자 없는 경로 조각
 */
function pathSegments(relPath: string): string[] {
  const parts = toPosix(relPath).split('/').filter(Boolean);
  return parts.map((part, index) => {
    if (index !== parts.length - 1) return part;
    // `.github` 같은 leading-dot 디렉터리는 확장자가 아니다.
    if (part.startsWith('.')) return part;
    const dot = part.lastIndexOf('.');
    return dot > 0 ? part.slice(0, dot) : part;
  });
}

/**
 * 한 경로가 걸리는 첫 risk kind를 고른다. 우선순위는 security → manifest →
 * build → migration — 한 path에 여러 kind를 쌓지 않아 recommendation 근거가
 * 중복되지 않게 한다.
 *
 * @param {string} relPath - repo-relative 경로
 * @returns {RiskKind | null} 매칭 kind, 없으면 null
 */
function classifyOnePath(relPath: string): RiskKind | null {
  const posix = toPosix(relPath);
  const base = path.posix.basename(posix);
  const segments = pathSegments(posix);

  if (segments.some((seg) => SECURITY_SEGMENTS.has(seg))) return 'security';

  if (
    MANIFEST_EXACT.has(base)
    || matchStar(base, 'requirements', '.txt')
  ) {
    return 'manifest';
  }

  if (
    matchStar(base, 'Dockerfile', '')
    || base === 'Makefile'
    || matchStar(base, 'tsconfig', '.json')
    || posix === '.github/workflows'
    || posix.startsWith('.github/workflows/')
  ) {
    return 'build';
  }

  // migrations/ 접두·조각, schema 조각. `schemas` 복수형은 규칙에 없어 제외.
  if (
    segments.includes('migrations')
    || segments.includes('schema')
  ) {
    return 'migration';
  }
  return null;
}

/**
 * 경로 목록을 risk kind로 분류한다. I/O 없음 — 단위 테스트가 규칙만
 * 고정하고 planInspect는 집계 전에 같은 헬퍼를 재사용한다.
 *
 * @param {string[]} pathList - repo-relative 경로 목록
 * @returns {Array<{ path: string, kind: RiskKind }>} 매칭된 {path, kind}만, 입력 순
 */
function classifyRoutingPaths(pathList: string[]): RiskPath[] {
  const out: RiskPath[] = [];
  for (const relPath of pathList) {
    if (typeof relPath !== 'string' || relPath === '') continue;
    const kind = classifyOnePath(relPath);
    if (kind !== null) out.push({ path: toPosix(relPath), kind });
  }
  return out;
}

/**
 * 모듈 토큰: 첫 경로 조각. `test`/`tests`/`docs`와 루트 파일(슬래시 없음)은
 * 접촉 모듈이 아니므로 세지 않는다 — light 후보를 path count로 키우지 않기 위함.
 *
 * @param {string[]} pathList - affected_paths 합집합
 * @returns {string[]} 정렬·중복 제거된 모듈 이름
 */
function collectModules(pathList: string[]): string[] {
  const modules = new Set<string>();
  for (const relPath of pathList) {
    const posix = toPosix(relPath);
    if (!posix.includes('/')) continue;
    const head = posix.split('/')[0];
    if (!head || MODULE_EXCLUDED.has(head)) continue;
    modules.add(head);
  }
  return [...modules].sort();
}

/**
 * commit task 요약으로 advisory routing을 만든다. 선택·승인은 하지 않고
 * recommendation/reasons만 낸다 — light 선언은 사용자 소유다.
 *
 * @param {Array<{ paths: string[], dependsOn: string[] }>} taskList - 이미
 *   commit-only로 걸러진 task 입력. paths는 affected_paths, dependsOn은 depends_on
 * @returns {Routing} advisory routing 객체
 */
function summarizeRouting(taskList: RoutingTask[]): Routing {
  const tasks = taskList.length;
  let dependencies = 0;
  const allPaths: string[] = [];
  for (const task of taskList) {
    dependencies += Array.isArray(task.dependsOn) ? task.dependsOn.length : 0;
    if (Array.isArray(task.paths)) {
      for (const p of task.paths) {
        if (typeof p === 'string' && p !== '') allPaths.push(p);
      }
    }
  }

  const modules = collectModules(allPaths);
  const riskPaths = classifyRoutingPaths(allPaths);
  const reasons: string[] = [];
  // 조건 이름 = 필드명. 스킬이 reasons를 그대로 인용할 수 있게 짧게 둔다.
  if (tasks >= 2) reasons.push('tasks');
  if (dependencies > 0) reasons.push('dependencies');
  if (modules.length >= 3) reasons.push('modules');
  if (riskPaths.length > 0) reasons.push('riskPaths');
  // empty는 full 트리거가 아니다. 근거만 남기고 light-candidate를 유지한다.
  if (allPaths.length === 0) reasons.push('affected-paths-empty');

  const recommendation = (
    tasks >= 2
    || dependencies > 0
    || modules.length >= 3
    || riskPaths.length > 0
  ) ? 'full-candidate' : 'light-candidate';

  return {
    advisory: true,
    tasks,
    dependencies,
    modules,
    riskPaths,
    recommendation,
    reasons,
  };
}

/**
 * blueprint의 commit task에서 paths/dependsOn만 모은다. verification task는
 * tasks 카운트·모듈·위험 경로에 넣지 않는다 — light 신호는 구현 커밋 범위다.
 *
 * @param {string} repoRoot - 저장소 루트
 * @param {string} blueprintDir - 정본 blueprint 상대 경로
 * @returns {RoutingTask[]} summarizeRouting 입력
 */
function loadRoutingTasks(repoRoot: string, blueprintDir: string): RoutingTask[] {
  const listing = listTasksDocs({ repoRoot, blueprintDir });
  const out: RoutingTask[] = [];
  for (const entry of listing.entries) {
    if (entry.executionKind !== 'commit') continue;
    let paths: string[] = [];
    let dependsOn: string[] = [];
    try {
      const doc = readDoc(path.join(repoRoot, entry.tasks.rel));
      const data = doc.data && typeof doc.data === 'object'
        ? doc.data as Record<string, unknown> : {};
      const bouncer = data.bouncer && typeof data.bouncer === 'object'
        ? data.bouncer as Record<string, unknown> : null;
      if (bouncer) {
        if (Array.isArray(bouncer.affected_paths)) {
          paths = bouncer.affected_paths.filter(
            (p): p is string => typeof p === 'string' && p !== '',
          );
        }
        if (Array.isArray(bouncer.depends_on)) {
          dependsOn = bouncer.depends_on.filter(
            (p): p is string => typeof p === 'string' && p !== '',
          );
        }
      }
    } catch (_e) {
      // 파싱 실패 task는 빈 paths로만 센다. inspect가 draft를 고치지 않는다.
    }
    out.push({ paths, dependsOn });
  }
  return out;
}

/**
 * 계획 스킬이 본문에서 반복하던 id·maintenance·verify 신호·포인터 상태와
 * (선택) light 추천 근거를 한 번 계산한다. 추천값만 반환하며 어떤 경로에도
 * 파일을 쓰지 않는다. `--blueprint`가 없으면 `routing: null`.
 *
 * @param {{ repoRoot: string, epicDir?: unknown, blueprintDir?: unknown }} opts -
 *   repoRoot는 대상 저장소, epicDir/blueprintDir은 선택적 정본 상대 경로
 * @returns {InspectResult} 성공 JSON 또는 not-initialized / invalid-*-dir
 */
function planInspect({ repoRoot, epicDir, blueprintDir }: {
  repoRoot: string;
  epicDir?: unknown;
  blueprintDir?: unknown;
}): InspectResult {
  const bouncerAbs = path.join(repoRoot, BOUNCER_DIR);
  // 1. 초기화 여부. epic-dir 형식보다 앞선다 — 없는 트리의 경로 오류로
  //    위장하면 `/bouncer-init` 안내가 빗나간다.
  if (!fs.existsSync(bouncerAbs) || !fs.statSync(bouncerAbs).isDirectory()) {
    return { ok: false, reason: 'not-initialized' };
  }

  let epic: EpicInfo | null = null;
  if (epicDir !== undefined) {
    // 2. --epic-dir는 정본 상대 경로만. 짧은 이름·EPIC- 접두·부재는 같은
    //    거절 코드라서 호출자가 형식을 추측해 재시도하지 않게 한다.
    const rel = normalizeRelDir(epicDir);
    if (rel === null || !isCanonicalEpicDir(rel)) {
      return { ok: false, reason: 'invalid-epic-dir' };
    }
    const abs = path.join(repoRoot, rel);
    try {
      // ENOENT·ENOTDIR·EACCES는 모두 같은 거절 코드다. 형식이 맞아도
      // 없는 디렉터리를 다음 id 계산에 쓰면 없는 epic을 추천하게 된다.
      if (!fs.statSync(abs).isDirectory()) {
        return { ok: false, reason: 'invalid-epic-dir' };
      }
    } catch (_e) {
      return { ok: false, reason: 'invalid-epic-dir' };
    }
    epic = epicInfo(repoRoot, rel);
  }

  let routing: Routing | null = null;
  if (blueprintDir !== undefined) {
    // 3. --blueprint는 정본 blueprint 경로만. routing은 읽기 전용 신호다.
    const rel = normalizeRelDir(blueprintDir);
    if (rel === null || !isCanonicalBlueprintDir(rel)) {
      return { ok: false, reason: 'invalid-blueprint-dir' };
    }
    const abs = path.join(repoRoot, rel);
    try {
      if (!fs.statSync(abs).isDirectory()) {
        return { ok: false, reason: 'invalid-blueprint-dir' };
      }
    } catch (_e) {
      return { ok: false, reason: 'invalid-blueprint-dir' };
    }
    routing = summarizeRouting(loadRoutingTasks(repoRoot, rel));
  }

  const epicNames = listDirNames(path.join(repoRoot, EPICS_REL));
  const maintenanceName = epicNames.find((name) => MAINTENANCE_DIR_RE.test(name));
  const maintenanceEpic = maintenanceName
    ? {
      ...epicInfo(repoRoot, `${EPICS_REL}/${maintenanceName}`),
      id: maintenanceName.slice(0, 3),
    }
    : null;

  return {
    ok: true,
    nextEpicId: nextNumericId(epicNames),
    epic,
    maintenanceEpic,
    verifySignals: collectVerifySignals(repoRoot),
    current: presentCurrent(repoRoot),
    routing,
  };
}

export = { planInspect, classifyRoutingPaths, summarizeRouting };
