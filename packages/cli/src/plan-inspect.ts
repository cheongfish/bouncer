'use strict';

const fs = require('node:fs');
const path = require('node:path');
import layout = require('./layout');
const {
  isCanonicalEpicDir, isCanonicalBlueprintDir, isValidBlueprintOrder, listBlueprintOrders,
} = layout;
import contextIds = require('./context-ids');
const { parseContextPath } = contextIds;
import paths = require('./paths');
const { toPosix } = paths;
import current = require('./current');
const { resolveCurrent } = current;
import frontmatter = require('./frontmatter');
const { readDoc } = frontmatter;
import tasksDocs = require('./tasks-docs');
const { listTasksDocs } = tasksDocs;
import epicRegistry = require('./epic-registry');
const { readEpicRegistry, COMMON_EPICS } = epicRegistry;
import codexAgents = require('./codex-agents');
const { NAMED_AGENTS, codexAgentTomlFor } = codexAgents;

const BOUNCER_DIR = '.bouncer';
const EPICS_REL = '.bouncer/context/epics';
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

// nextBlueprintId는 번호 epic 전용이다. slug epic은 디렉터리에 번호가 없어 null이고, 다음 순서는
// 두 형식 모두 nextBlueprintOrder가 낸다(번호 epic은 nextBlueprintId와 같은 값의 정수).
type EpicInfo = {
  dir: string;
  status: string | null;
  nextBlueprintId: string | null;
  nextBlueprintOrder: number;
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

type InspectRegistry =
  | { status: 'missing'; next: string }
  | { status: 'invalid'; code: 'S35'; message: string; next: string }
  | {
    status: 'ok';
    profile: string;
    epics: {
      slug: string; id: string | null; dir: string | null; kind: 'common' | 'domain';
      description: string | null; include: string; exclude: string;
    }[];
    legacy: { slug: string; id: string | null; dir: string }[];
    areas: string[];
    promotions: { area: string; count: number }[];
  };

// 결합 경로: 생성 짝(pairs, 확정)과 경로 문자열 검색 후보(candidates, 근거 줄 포함)를 분리한다.
// `advisory`는 routing과 같은 이유로 둔다 — 이 값은 gate·affected_paths를 정하지 않는 참고 신호다.
type CoupledPair = {
  task: string;
  source: string;
  path: string;
  kind: 'codex-agent-toml' | 'gitignore-exception';
  covered: boolean;
};

type CoupledCandidate = {
  task: string;
  source: string;
  path: string;
  evidence: { line: number; text: string };
};

type CoupledPaths = {
  advisory: true;
  pairs: CoupledPair[];
  candidates: CoupledCandidate[];
};

type InspectOk = {
  ok: true;
  nextEpicId: string | null;
  registry: InspectRegistry;
  epic: EpicInfo | null;
  verifySignals: string[];
  current: CurrentInfo;
  routing: Routing | null;
  coupledPaths: CoupledPaths | null;
};

type InspectResult = InspectOk | InspectFail;

type RoutingTask = { paths: string[]; dependsOn: string[] };

// loadRoutingTasks가 낸 commit task. 결합 경로는 task id를 출력에 싣기 위해 id가 필요하다.
type CommitTask = RoutingTask & { id: string };

/**
 * `\d{3}-<slug>` 디렉터리 이름만 모아 최댓값 + 1을 세 자리로 채운다.
 * 구형 `EPIC-009` / `BP-001` 이름은 정규식에서 빠지므로 번호가 그 쪽으로
 * 점프하지 않는다. 후보가 없으면 `001` — 빈 트리의 첫 id. blueprint id 제안에 쓴다.
 *
 * @param {string[]} names - 한 부모 아래의 디렉터리 이름
 * @returns {string} zero-pad 세 자리 다음 id
 */
function nextNumericId(names: string[]): string {
  let max = 0;
  for (const name of names) {
    // 정본 번호 이름(`ddd-slug`)만 센다. EPIC-/BP- 접두와 slug 이름은 최댓값에 넣지 않아 구형 디렉터리가
    // 다음 번호를 건너뛰게 하지 않는다. 세그먼트 해석은 context-ids 한 곳에 맡기고, blueprint 이름도
    // epic 자리에 끼워 같은 규칙으로 읽는다.
    const parsed = parseContextPath(`epics/${name}`);
    if (!parsed || parsed.format !== 'numeric') continue;
    const n = Number(parsed.epicKey);
    if (Number.isFinite(n) && n > max) max = n;
  }
  return String(max + 1).padStart(3, '0');
}

/**
 * 활성 `features` epic의 blueprint를 `bouncer.area`별로 세어 승격 후보를 낸다.
 * 읽기 전용이며 승격은 실행하지 않는다 — 사용자 승인 뒤 스킬이 명령을 돌린다.
 *
 * @param {string} repoRoot - 저장소 루트 절대 경로
 * @param {string | null} featuresDir - 활성 features epic의 repo-relative 디렉터리(없으면 null)
 * @param {number | undefined} threshold - 등록부 `areaPromotionThreshold`
 * @returns {{ area: string, count: number }[]} count가 threshold 이상인 area(이름순)
 */
function countAreaPromotions(
  repoRoot: string,
  featuresDir: string | null,
  threshold: number | undefined,
): { area: string; count: number }[] {
  if (threshold === undefined || featuresDir === null) return [];
  const bpRoot = path.join(repoRoot, featuresDir, 'blueprints');
  const counts = new Map<string, number>();
  for (const name of listDirNames(bpRoot)) {
    try {
      const doc = readDoc(path.join(bpRoot, name, 'index.md'));
      const data = doc.data && typeof doc.data === 'object' ? doc.data as Record<string, unknown> : {};
      const bouncer = data.bouncer && typeof data.bouncer === 'object'
        ? data.bouncer as Record<string, unknown> : null;
      const area = bouncer ? bouncer.area : undefined;
      if (typeof area === 'string' && area !== '') counts.set(area, (counts.get(area) ?? 0) + 1);
    } catch (_e) {
      // index.md가 없거나 파싱 불가한 blueprint는 집계에서 뺀다. inspect는 읽기 전용이라
      // 문서를 고치지 않고, 한 문서의 오류가 나머지 집계를 막지 않게 한다.
    }
  }
  return [...counts.entries()]
    .filter(([, count]) => count >= threshold)
    .map(([area, count]) => ({ area, count }))
    .sort((a, b) => (a.area < b.area ? -1 : a.area > b.area ? 1 : 0));
}

/**
 * 등록부(`.bouncer/epics.json`)를 한 번 읽어 inspect용 후보 목록으로 바꾼다.
 * 귀속은 판단하지 않고 사실(활성 epic, 디렉터리 유무, legacy, area)만 낸다.
 * 형식 위반도 실패로 올리지 않고 `invalid`로 접어 plan이 안내를 이어가게 한다.
 *
 * @param {string} repoRoot - 저장소 루트 절대 경로
 * @param {string[]} dirNames - epics 디렉터리 직계 이름(v1 `<id>-<slug>`, v2 `<slug>`)
 * @returns {{ registry: InspectRegistry, nextEpicId: string | null }} 등록부 요약과
 *   승인됐으나 디렉터리가 없는 도메인 epic 중 가장 작은 id(없거나 등록부 불량이면 null, v2는 번호가 없어 항상 null)
 */
function summarizeRegistry(repoRoot: string, dirNames: string[]): {
  registry: InspectRegistry;
  nextEpicId: string | null;
} {
  const read = readEpicRegistry(repoRoot);
  if (read.status === 'missing') {
    return {
      registry: { status: 'missing', next: 'Run `bouncer init` to create .bouncer/epics.json.' },
      nextEpicId: null,
    };
  }
  if (read.status === 'invalid') {
    return {
      registry: {
        status: 'invalid',
        code: 'S35',
        message: `epic registry is invalid: ${read.message}`,
        next: 'Fix .bouncer/epics.json so `bouncer validate` no longer reports S35.',
      },
      nextEpicId: null,
    };
  }
  const { registry } = read;
  // v1은 `<id>-<slug>` 디렉터리와 `id`를, v2는 `<slug>` 디렉터리와 선택 `legacy_id`를 쓴다.
  // 버전은 등록부 `version`으로만 가른다(디렉터리 이름 모양으로 추측하지 않는다).
  const isV2 = registry.version === 2;
  const idOf = (entry: { id: string; legacy_id?: string }): string | null => (
    isV2 ? entry.legacy_id ?? null : entry.id
  );
  const dirOf = (entry: { id: string; slug: string }): string | null => {
    const name = isV2 ? entry.slug : `${entry.id}-${entry.slug}`;
    return dirNames.includes(name) ? `${EPICS_REL}/${name}` : null;
  };
  const epics: Extract<InspectRegistry, { status: 'ok' }>['epics'] = [];
  const legacy: { slug: string; id: string | null; dir: string }[] = [];
  const pendingDomainIds: string[] = [];
  for (const entry of registry.epics) {
    if (!entry.active) continue;
    const dir = dirOf(entry);
    const id = idOf(entry);
    if (entry.kind === 'legacy') {
      // legacy는 디렉터리가 있어야 의미가 있다. 없는 항목은 후보로 내지 않는다.
      if (dir !== null) legacy.push({ slug: entry.slug, id, dir });
      continue;
    }
    if (entry.kind === 'domain') {
      // v2 slug epic은 번호가 없어 다음 번호 후보에 넣지 않는다.
      if (dir === null && !isV2) pendingDomainIds.push(entry.id);
      epics.push({
        slug: entry.slug, id, dir, kind: 'domain',
        description: null, include: entry.approval ? entry.approval.reason : '', exclude: '',
      });
      continue;
    }
    const common = COMMON_EPICS.find((c) => c.slug === entry.slug);
    epics.push({
      slug: entry.slug, id, dir, kind: 'common',
      description: common ? common.description : null,
      include: common ? common.include : '',
      exclude: common ? common.exclude : '',
    });
  }
  pendingDomainIds.sort();
  // 상한이 남아 있을 때만 후보를 낸다: 소진되면 add-domain이 어차피 거절된다.
  const domainCount = registry.epics.filter((e) => e.kind === 'domain').length;
  const features = epics.find((e) => e.slug === 'features');
  const promotions = domainCount < registry.domainEpicLimit
    ? countAreaPromotions(repoRoot, features ? features.dir : null, registry.areaPromotionThreshold)
    : [];
  return {
    registry: {
      status: 'ok', profile: registry.profile, epics, legacy, areas: registry.areas, promotions,
    },
    nextEpicId: pendingDomainIds.length > 0 ? pendingDomainIds[0] : null,
  };
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

/**
 * slug epic의 다음 blueprint 순서를 구한다. 쓸 수 있는 `order`(양의 정수)의 최댓값 + 1이다.
 * 간격은 메우지 않는다(1·2·5 → 6) — 순서는 디렉터리 이름이 아니라 frontmatter가 가지므로
 * 중간 값을 비워 둔 채 계속 추가해도 기존 순서가 흔들리지 않는다. 읽을 수 없거나 모양이 틀린 값은
 * 최댓값에서 뺀다(그 문서의 오류는 S37이 따로 보고한다). 후보가 없으면 1이다.
 *
 * @param {string} repoRoot - 저장소 루트 절대 경로
 * @param {string} dirRel - 저장소 상대 epic 디렉터리
 * @returns {number} 다음 순서(양의 정수)
 */
function nextBlueprintOrder(repoRoot: string, dirRel: string): number {
  let max = 0;
  for (const entry of listBlueprintOrders(repoRoot, dirRel)) {
    if (isValidBlueprintOrder(entry.order) && entry.order > max) max = entry.order;
  }
  return max + 1;
}

function epicInfo(repoRoot: string, dirRel: string): EpicInfo {
  const status = readStatus(path.join(repoRoot, dirRel, 'index.md'));
  // 형식은 경로로 판정한다(호출자가 정본 검사를 통과시켰다).
  if (parseContextPath(dirRel)?.format === 'slug') {
    return { dir: dirRel, status, nextBlueprintId: null, nextBlueprintOrder: nextBlueprintOrder(repoRoot, dirRel) };
  }
  const nextBlueprintId = nextNumericId(listDirNames(path.join(repoRoot, dirRel, 'blueprints')));
  return { dir: dirRel, status, nextBlueprintId, nextBlueprintOrder: Number(nextBlueprintId) };
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

// 결합 경로 탐지의 상수. 테스트 파일 탐색 범위와 근거 길이는 계획 점검 출력의 계약이다.
const COUPLED_TEST_DIRS = ['test', 'tests'] as const;
// Node 테스트가 쓰는 확장자. 다른 확장자(md, json 등)는 경로 문자열 근거가 되기에 부적절하다.
const COUPLED_TEST_EXTENSIONS = new Set(['.js', '.cjs', '.mjs', '.ts']);
// 이보다 큰 파일은 읽지 않는다. 점검이 큰 생성물을 읽느라 느려지지 않게 하는 상한이다.
const COUPLED_TEST_MAX_BYTES = 1024 * 1024;
// 근거 줄은 사람이 훑을 길이로 자른다. 긴 줄 전체를 질문에 싣지 않는다.
const COUPLED_EVIDENCE_MAX_CHARS = 200;
// 파일 읽기·stat에서 "그 항목은 못 읽는다"는 뜻인 코드만 흡수한다. 나머지는 버그일 수 있으니 다시 던진다.
const UNREADABLE_CODES = new Set(['ENOENT', 'ENOTDIR', 'EACCES', 'EPERM', 'EISDIR', 'ELOOP']);

/**
 * 파일 시스템 오류가 "읽을 수 없음"(부재·권한·형식 불일치)인지 판별한다.
 *
 * @param {unknown} error - catch로 받은 값
 * @returns {boolean} 흡수 대상이면 true
 */
function isUnreadableError(error: unknown): boolean {
  return error instanceof Error && 'code' in error
    && typeof error.code === 'string' && UNREADABLE_CODES.has(error.code);
}

/**
 * 계획 점검 항목 한 줄을 비교용 정규형으로 바꾼다. 같은 파일을 가리키는 표기(`./x`, `x/`)가
 * 다른 짝·후보를 만들지 않게 하고, 저장소 안의 한 경로로 확정할 수 없는 값은 null로 뺀다.
 *
 * @param {string} raw - affected_paths 원문 항목
 * @returns {string | null} 정규형 경로, 짝·후보를 만들 수 없으면 null
 */
function normalizeCoupledItem(raw: string): string | null {
  // 1. 앞 `./`를 모두 떼고 끝 `/`를 하나 뗀다. `./docs/`와 `docs`를 같은 항목으로 본다.
  let rel = raw;
  while (rel.startsWith('./')) rel = rel.slice(2);
  if (rel.endsWith('/')) rel = rel.slice(0, -1);
  // 2. 빈 값과 `.`은 저장소 전체를 뜻해 짝·후보의 근거가 되지 못한다.
  if (rel === '' || rel === '.') return null;
  // 3. 절대 경로·`..`·glob 문자는 저장소 안의 한 파일로 확정되지 않는다. 검색하면 엉뚱한 근거가 나온다.
  if (path.posix.isAbsolute(rel) || rel.split('/').includes('..') || /[*?[]/.test(rel)) return null;
  return rel;
}

/**
 * 같은 task의 정규형 항목들이 `rel`을 덮는지 본다. 같은 경로이거나 그 조상 디렉터리이면 덮는다.
 *
 * @param {string[]} items - 같은 task의 정규형 항목
 * @param {string} rel - 짝 또는 후보 파일의 저장소 상대 posix 경로
 * @returns {boolean} 이미 task가 다루는 경로이면 true
 */
function coveredBy(items: string[], rel: string): boolean {
  return items.some((item) => item === rel || rel.startsWith(`${item}/`));
}

/**
 * 경로 문자열 검색 대상이 되는 파일 항목인지 본다. 디렉터리 표기(`/`로 끝남), 실제 디렉터리,
 * 확장자 없는 마지막 조각은 파일이 아닌 것으로 보고 검색하지 않는다 — `docs`처럼 흔한 디렉터리 이름이
 * 모든 테스트 파일에 걸려 근거가 소음이 되는 일을 막는다.
 *
 * @param {string} repoRoot - 저장소 루트
 * @param {string} raw - affected_paths 원문 항목(끝 `/` 여부를 보려고 원문을 받는다)
 * @param {string} norm - normalizeCoupledItem 결과
 * @returns {boolean} 검색 대상 파일 항목이면 true
 */
function isFileItem(repoRoot: string, raw: string, norm: string): boolean {
  if (raw.endsWith('/')) return false;
  if (path.posix.basename(norm).indexOf('.') < 0) return false;
  const stat = statOrNull(path.join(repoRoot, norm));
  return !(stat && stat.isDirectory());
}

/**
 * 경로의 stat을 읽는다. 없거나 못 읽는 경로는 null이다.
 *
 * @param {string} abs - 절대 경로
 * @returns {import('node:fs').Stats | null} stat, 읽을 수 없으면 null
 */
function statOrNull(abs: string): import('node:fs').Stats | null {
  try {
    return fs.statSync(abs);
  } catch (error) {
    // ENOENT 등 "없거나 못 읽는" 경로만 null로 본다. 그 밖의 오류는 버그일 수 있어 다시 던진다.
    if (isUnreadableError(error)) return null;
    throw error;
  }
}

/**
 * `test/`·`tests/` 아래의 검색 대상 테스트 파일을 정렬된 상대 경로로 모은다. symlink는 따라가지 않아
 * 저장소 밖 파일을 읽지 않게 하고, `node_modules`는 건너뛴다. 디렉터리가 없으면 빈 목록이다.
 *
 * @param {string} repoRoot - 저장소 루트
 * @returns {string[]} 저장소 상대 posix 경로, 사전순
 */
function listTestFiles(repoRoot: string): string[] {
  const out: string[] = [];
  const walk = (relDir: string) => {
    let entries: import('node:fs').Dirent[];
    try {
      entries = fs.readdirSync(path.join(repoRoot, relDir), { withFileTypes: true });
    } catch (error) {
      // 디렉터리 부재·권한 문제는 건너뛴다. 다른 오류는 다시 던진다.
      if (isUnreadableError(error)) return;
      throw error;
    }
    for (const entry of entries) {
      const rel = `${relDir}/${entry.name}`;
      // symlink는 디렉터리든 파일이든 따르지 않는다. 저장소 밖을 읽는 경로를 만들지 않는다.
      if (entry.isSymbolicLink()) continue;
      if (entry.isDirectory()) {
        if (entry.name !== 'node_modules') walk(rel);
        continue;
      }
      if (!entry.isFile() || !COUPLED_TEST_EXTENSIONS.has(path.posix.extname(entry.name))) continue;
      const stat = statOrNull(path.join(repoRoot, rel));
      if (stat && stat.size <= COUPLED_TEST_MAX_BYTES) out.push(rel);
    }
  };
  for (const dir of COUPLED_TEST_DIRS) walk(dir);
  return out.sort();
}

/**
 * 파일에서 `needle`을 포함하는 첫 줄을 찾는다. 같은 파일의 뒤 일치 줄은 근거로 싣지 않는다.
 * 근거 줄 하나면 질문이 짧고, 파일당 한 줄이면 같은 파일이 여러 번 후보로 뜨지 않는다.
 *
 * @param {string} repoRoot - 저장소 루트
 * @param {string} rel - 검색할 파일의 저장소 상대 posix 경로
 * @param {string} needle - 정규형 항목 문자열(정규식이 아닌 부분 문자열)
 * @returns {{ line: number, text: string } | null} 1부터 세는 줄 번호와 잘린 줄, 일치가 없으면 null
 */
function firstMatchingLine(
  repoRoot: string,
  rel: string,
  needle: string,
): { line: number; text: string } | null {
  let body: string;
  try {
    body = fs.readFileSync(path.join(repoRoot, rel), 'utf8');
  } catch (error) {
    // 읽을 수 없는 테스트 파일은 근거가 없는 것으로 보고 건너뛴다. 다른 오류는 다시 던진다.
    if (isUnreadableError(error)) return null;
    throw error;
  }
  const lines = body.split(/\r?\n/);
  for (let i = 0; i < lines.length; i += 1) {
    if (lines[i].includes(needle)) {
      return { line: i + 1, text: lines[i].trim().slice(0, COUPLED_EVIDENCE_MAX_CHARS) };
    }
  }
  return null;
}

/**
 * `.gitignore`가 역할 TOML을 예외로 다시 여는 줄이 빠져 있는지 본다. 세 조건이 모두 참이어야
 * 짝을 낸다: `!.codex/agents/` 디렉터리 재포함 줄이 있고, `!<toml>` 예외 줄이 없고,
 * TOML 파일이 디스크에 없다. 하나라도 거짓이면 이미 처리됐거나 생성 대상이 아니다.
 *
 * @param {string[]} gitignoreLines - 저장소 루트 `.gitignore`의 정규화된 줄(없으면 빈 배열)
 * @param {string} repoRoot - 저장소 루트
 * @param {string} toml - 짝 TOML의 저장소 상대 경로
 * @returns {boolean} 예외 짝을 내야 하면 true
 */
function gitignoreExceptionMissing(gitignoreLines: string[], repoRoot: string, toml: string): boolean {
  // 디렉터리 전체 재포함 줄만 본다. `!.codex/agents/<name>.toml` 같은 파일 예외는 이 조건이 아니다 —
  // 그런 줄이 있다고 디렉터리 규칙이 있다고 보면 조건 1이 파일 예외 줄에 끌려 참이 된다.
  const hasDirectoryRule = gitignoreLines.includes('!.codex/agents/');
  if (!hasDirectoryRule) return false;
  if (gitignoreLines.includes(`!${toml}`)) return false;
  return !fs.existsSync(path.join(repoRoot, toml));
}

/**
 * `.gitignore`를 읽어 앞뒤 공백을 뗀 줄 목록으로 돌려준다. 파일이 없거나 못 읽으면 빈 목록이다.
 *
 * @param {string} repoRoot - 저장소 루트
 * @returns {string[]} 공백을 뗀 `.gitignore` 줄
 */
function readGitignoreLines(repoRoot: string): string[] {
  try {
    return fs.readFileSync(path.join(repoRoot, '.gitignore'), 'utf8')
      .split(/\r?\n/)
      .map((line: string) => line.trim());
  } catch (error) {
    // `.gitignore`가 없는 저장소는 예외 짝을 만들 근거가 없다. 다른 오류는 다시 던진다.
    if (isUnreadableError(error)) return [];
    throw error;
  }
}

/**
 * commit task들의 affected_paths에서 결합 경로를 읽기 전용으로 계산한다. 생성 관계는 `pairs`로
 * 확정 출력하고, 경로 문자열로 찾은 테스트 파일은 `candidates`로만 낸다. 어떤 파일도 쓰지 않는다.
 *
 * 항목은 task 순서, task 안에서는 affected_paths 순서로 본다. `agents` 항목은 `NAMED_AGENTS` 전체로
 * 펼친다. 같은 task가 덮는 파일과 디렉터리 항목은 후보가 되지 않는다.
 *
 * @param {string} repoRoot - 저장소 루트. 이 아래를 읽기만 한다
 * @param {{ id: string, paths: string[] }[]} tasks - commit task 목록(verification은 호출 전에 뺀다)
 * @returns {CoupledPaths} advisory 결합 경로. 짝·후보가 없으면 빈 배열
 */
function detectCoupledPaths(repoRoot: string, tasks: { id: string; paths: string[] }[]): CoupledPaths {
  const pairs: CoupledPair[] = [];
  const candidates: CoupledCandidate[] = [];
  const gitignoreLines = readGitignoreLines(repoRoot);
  // 테스트 파일 목록은 필요할 때 한 번만 모은다. 파일 항목이 없는 저장소에서 트리를 걷지 않게 한다.
  let testFiles: string[] | null = null;

  for (const task of tasks) {
    // 1. 이 task의 정규형 항목을 affected_paths 순서대로 모은다. 거절된 항목은 짝·후보를 만들지 않는다.
    const items: { raw: string; norm: string }[] = [];
    for (const raw of task.paths) {
      const norm = normalizeCoupledItem(raw);
      if (norm !== null) items.push({ raw, norm });
    }
    const norms = items.map((item) => item.norm);

    // 2. 생성 짝. `agents` 항목은 역할 전체로 펼치고, 같은 역할 md는 한 번만 짝을 낸다.
    const seenSources = new Set<string>();
    for (const { norm } of items) {
      const sources = norm === 'agents' ? NAMED_AGENTS.map((name) => `agents/${name}.md`) : [norm];
      for (const source of sources) {
        const toml = codexAgentTomlFor(source);
        if (toml === null || seenSources.has(source)) continue;
        seenSources.add(source);
        pairs.push({
          task: task.id,
          source,
          path: toml,
          kind: 'codex-agent-toml',
          covered: coveredBy(norms, toml),
        });
        if (gitignoreExceptionMissing(gitignoreLines, repoRoot, toml)) {
          pairs.push({
            task: task.id,
            source,
            path: '.gitignore',
            kind: 'gitignore-exception',
            covered: coveredBy(norms, '.gitignore'),
          });
        }
      }
    }

    // 3. 경로 문자열 후보. 파일 항목만 검색하고, 같은 task가 덮는 파일은 뺀다.
    const seenItems = new Set<string>();
    for (const { raw, norm } of items) {
      if (!isFileItem(repoRoot, raw, norm) || seenItems.has(norm)) continue;
      seenItems.add(norm);
      if (testFiles === null) testFiles = listTestFiles(repoRoot);
      for (const file of testFiles) {
        if (coveredBy(norms, file)) continue;
        const evidence = firstMatchingLine(repoRoot, file, norm);
        if (evidence !== null) {
          candidates.push({ task: task.id, source: norm, path: file, evidence });
        }
      }
    }
  }

  return { advisory: true, pairs, candidates };
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
function loadRoutingTasks(repoRoot: string, blueprintDir: string): CommitTask[] {
  const listing = listTasksDocs({ repoRoot, blueprintDir });
  const out: CommitTask[] = [];
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
    // id가 없는 문서는 상대 경로로 식별한다. 출력 키가 빈 값이 되어 task를 구분하지 못하는 일을 막는다.
    const id = entry.tasks.id ?? entry.tasks.rel;
    out.push({ id, paths, dependsOn });
  }
  return out;
}

/**
 * 계획 스킬이 본문에서 반복하던 등록부 후보·다음 도메인 id·verify 신호·포인터 상태와
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
  let coupledPaths: CoupledPaths | null = null;
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
    // 4. 결합 경로는 routing과 같은 commit task 목록에서 읽기 전용으로 계산한다. routing·gate
    //    판정에는 넣지 않는다 — 생성 짝과 테스트 후보는 사용자가 확정할 질문이지 범위 결정이 아니다.
    const commitTasks = loadRoutingTasks(repoRoot, rel);
    routing = summarizeRouting(commitTasks);
    coupledPaths = detectCoupledPaths(repoRoot, commitTasks);
  }

  const epicNames = listDirNames(path.join(repoRoot, EPICS_REL));
  const { registry, nextEpicId } = summarizeRegistry(repoRoot, epicNames);

  return {
    ok: true,
    nextEpicId,
    registry,
    epic,
    verifySignals: collectVerifySignals(repoRoot),
    current: presentCurrent(repoRoot),
    routing,
    coupledPaths,
  };
}

export = { planInspect, classifyRoutingPaths, summarizeRouting, detectCoupledPaths };
