'use strict';
import guards = require('./guards');
const { isRecord, isEnoentError } = guards;
const fs = require('node:fs');
const path = require('node:path');

// 등록부(.bouncer/epics.json)의 형식·공통 epic 목록·프로필 펼치기를 한 곳에 둔다.
// 후속 task(init, legacy 차단)와 다른 BP는 이 모듈만 읽는다. 순수 함수와 얇은
// reader 하나로 두고, repoRoot 아래 파일 하나만 읽으며 캐시를 두지 않는다.

type EpicKind = 'common' | 'domain' | 'legacy';
type RegistryEpic = {
  slug: string; id: string; kind: EpicKind; active: boolean;
  approval?: { reason: string; approvedAt: string };
};
type EpicRegistry = {
  version: 1; profile: string; domainEpicLimit: number; areas: string[];
  areaPromotionThreshold?: number; epics: RegistryEpic[];
};
type RegistryRead = { status: 'ok'; registry: EpicRegistry } | { status: 'missing' }
  | { status: 'invalid'; message: string };
type ParseResult = { ok: true; registry: EpicRegistry } | { ok: false; message: string };
type RegistryFailure = { code: 'S35'; message: string; file: string };

const REGISTRY_REL = '.bouncer/epics.json';
const SLUG_RE = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const ID_RE = /^\d{3}$/;
const KINDS: ReadonlyArray<string> = ['common', 'domain', 'legacy'];

// 순서가 곧 ID 배정 순서다. 바꾸면 신규 저장소의 공통 epic 번호가 달라진다.
// description은 scaffoldEpic이 새 epic에 요구하는 printable ASCII 영어 한 문장이다.
const COMMON_EPICS: ReadonlyArray<{ slug: string; description: string; include: string; exclude: string }> = [
  {
    slug: 'foundation',
    description: 'Project setup, build tooling, and shared conventions every other epic relies on.',
    include: '저장소 구조, 빌드·의존성·런타임 버전, 개발 환경, lint·format, CI/CD, 배포·릴리스, 인프라 코드(IaC), 환경별 설정',
    exclude: '특정 기능의 설정값 변경 → 그 기능의 epic',
  },
  {
    slug: 'core',
    description: 'Core domain model and shared logic that feature epics build on.',
    include: '공통 모듈과 아키텍처 경계, 에러 처리, 설정 로딩, 공통 유틸',
    exclude: '한 기능에서만 쓰는 헬퍼 → 그 기능의 epic',
  },
  {
    slug: 'data',
    description: 'Persistence, schemas, migrations, and data access.',
    include: '데이터 모델, 저장소, 마이그레이션 체계, 캐시, 데이터 보존 정책',
    exclude: '한 도메인 기능에만 쓰는 테이블·필드 → `features`',
  },
  {
    slug: 'integration',
    description: 'Connections to external systems, services, and third-party APIs.',
    include: '외부 API·SDK 클라이언트, 메시징, 공개 API 계약과 버전 정책',
    exclude: '외부 연동을 사용하는 기능 동작 변경 → `features`',
  },
  {
    slug: 'identity-access',
    description: 'Authentication, authorization, and account management.',
    include: '인증, 인가, 계정, 세션, 접근 감사',
    exclude: '권한 검사를 쓰는 도메인 기능 동작 → `features`',
  },
  {
    slug: 'interface',
    description: 'User-facing interfaces such as screens, commands, and public APIs.',
    include: '사용자 접점: 화면 골격·내비게이션, 디자인 시스템, CLI 표면, 알림, 다국어, 접근성',
    exclude: '특정 도메인 화면·명령의 동작 → `features`',
  },
  {
    slug: 'features',
    description: 'End-to-end product features that combine the other epics.',
    include: '도메인 업무 규칙, 워크플로, 해당 기능 전용 화면·API·스키마·테스트',
    exclude: '공통 계층 자체의 변경 → 해당 공통 epic',
  },
  {
    slug: 'quality-ops',
    description: 'Testing, observability, release, and operational tooling.',
    include: '테스트 하네스·픽스처·E2E 인프라, 로그·메트릭·모니터링, 장애 대응, 성능 측정, 운영 스크립트',
    exclude: '특정 기능의 테스트 추가·성능 개선 → 그 기능의 epic',
  },
];

const PURPOSE_NAMES: ReadonlyArray<string> = [
  'performance', 'security', 'refactor', 'refactoring', 'followup', 'follow-up', 'cleanup', 'fix', 'bugfix',
];

/**
 * 등록부 JSON 값을 검사해 EpicRegistry로 돌려준다. 형식 위반은 throw하지 않고
 * 첫 위반의 message를 돌려줘 호출자가 S35로 접게 한다.
 *
 * @param {unknown} value - JSON.parse한 값
 * @returns {{ok: true, registry: EpicRegistry} | {ok: false, message: string}} 검사 결과
 */
function parseEpicRegistry(value: unknown): ParseResult {
  const fail = (message: string): ParseResult => ({ ok: false, message });
  if (!isRecord(value)) return fail('registry must be a JSON object');
  if (value.version !== 1) return fail('version must be 1');
  if (typeof value.profile !== 'string' || value.profile === '') return fail('profile must be a non-empty string');
  const limit = value.domainEpicLimit;
  if (typeof limit !== 'number' || !Number.isInteger(limit) || limit < 0) {
    return fail('domainEpicLimit must be a non-negative integer');
  }
  if (!Array.isArray(value.areas)) return fail('areas must be an array');
  const seenAreas = new Set<string>();
  for (const area of value.areas) {
    if (typeof area !== 'string' || !SLUG_RE.test(area)) return fail(`area is not a valid slug: ${String(area)}`);
    if (seenAreas.has(area)) return fail(`area is duplicated: ${area}`);
    seenAreas.add(area);
  }
  const threshold = value.areaPromotionThreshold;
  if (threshold !== undefined && (typeof threshold !== 'number' || !Number.isInteger(threshold) || threshold < 1)) {
    return fail('areaPromotionThreshold must be an integer >= 1');
  }
  if (!Array.isArray(value.epics)) return fail('epics must be an array');
  const idBySlug = new Map<string, string>();
  const slugById = new Map<string, string>();
  for (const epic of value.epics) {
    if (!isRecord(epic)) return fail('epics entries must be objects');
    const { slug, id, kind, active, approval } = epic;
    if (typeof slug !== 'string' || slug === '') return fail('epic slug must be a non-empty string');
    if (typeof id !== 'string' || !ID_RE.test(id)) return fail(`epic id must be 3 digits: ${slug}`);
    if (typeof kind !== 'string' || !KINDS.includes(kind)) return fail(`epic kind is invalid: ${slug}`);
    if (typeof active !== 'boolean') return fail(`epic active must be a boolean: ${slug}`);
    if (approval !== undefined
      && !(isRecord(approval) && typeof approval.reason === 'string' && typeof approval.approvedAt === 'string')) {
      return fail(`epic approval needs string reason and approvedAt: ${slug}`);
    }
    if (idBySlug.has(slug) && idBySlug.get(slug) !== id) return fail(`slug has more than one id: ${slug}`);
    if (slugById.has(id) && slugById.get(id) !== slug) return fail(`id has more than one slug: ${id}`);
    // 같은 (slug,id) 행이 두 번 있으면 위 두 검사를 모두 통과하므로 따로 거절한다.
    if (idBySlug.has(slug)) return fail(`epic row is duplicated: ${slug} ${id}`);
    idBySlug.set(slug, id);
    slugById.set(id, slug);
  }
  return { ok: true, registry: value as unknown as EpicRegistry };
}

/**
 * repoRoot 아래 `.bouncer/epics.json` 하나만 읽는다. 부재(ENOENT)만 missing이고
 * 권한 오류·깨진 JSON·형식 위반은 invalid로 구분한다.
 *
 * @param {string} repoRoot - 저장소 루트 절대 경로
 * @returns {RegistryRead} ok / missing / invalid
 */
function readEpicRegistry(repoRoot: string): RegistryRead {
  let raw: string;
  try {
    raw = fs.readFileSync(path.join(repoRoot, REGISTRY_REL), 'utf8');
  } catch (error) {
    // ENOENT만 "등록부 없음"이다. 권한 오류 등을 missing으로 합치면 형식 위반이
    // 조용히 통과하므로 invalid로 보고한다.
    if (isEnoentError(error)) return { status: 'missing' };
    return { status: 'invalid', message: `cannot read registry: ${(error as Error).message}` };
  }
  let value: unknown;
  try {
    value = JSON.parse(raw);
  } catch (error) {
    // SyntaxError만 "깨진 JSON"으로 접는다. JSON.parse는 그 밖의 오류를 내지 않는다.
    return { status: 'invalid', message: `registry is not valid JSON: ${(error as Error).message}` };
  }
  const parsed = parseEpicRegistry(value);
  return parsed.ok ? { status: 'ok', registry: parsed.registry } : { status: 'invalid', message: parsed.message };
}

/**
 * 프로필을 등록부로 펼친다. standard는 공통 epic 8개(ID 001~008, 활성), domain-only는 0개다.
 * epics에는 공통 epic만 담는다.
 *
 * @param {'standard'|'domain-only'} profile - 프로필 이름
 * @param {{domainEpicLimit: number}} opts - 도메인 epic 상한(0 이상 정수)
 * @returns {EpicRegistry} 펼친 등록부
 * @throws {Error} 알 수 없는 프로필이거나 domainEpicLimit이 음수·비정수일 때
 */
function expandProfile(profile: 'standard' | 'domain-only', opts: { domainEpicLimit: number }): EpicRegistry {
  if (profile !== 'standard' && profile !== 'domain-only') {
    throw new Error(`unknown profile: ${String(profile)}`);
  }
  const limit = opts.domainEpicLimit;
  if (!Number.isInteger(limit) || limit < 0) {
    throw new Error(`domainEpicLimit must be a non-negative integer: ${String(limit)}`);
  }
  const epics: RegistryEpic[] = profile === 'standard'
    ? COMMON_EPICS.map((common, index) => ({
      slug: common.slug, id: String(index + 1).padStart(3, '0'), kind: 'common' as const, active: true,
    }))
    : [];
  return { version: 1, profile, domainEpicLimit: limit, areas: [], epics };
}

/**
 * 기존 epic 디렉터리에 맞춰 등록부를 만든다. 공통 slug와 같은 디렉터리는 그 ID의
 * common, 나머지는 legacy로 두고, 없는 공통 epic에는 기존 최대 번호 다음부터 ID를 배정한다.
 *
 * @param {EpicRegistry} base - expandProfile 결과(공통 epic만 담김)
 * @param {string[]} existingEpicDirs - `NNN-slug` 형식 디렉터리 이름 목록
 * @returns {{registry: EpicRegistry, scaffold: {slug: string, id: string}[]}} 등록부와 새로 만들 epic
 * @throws {Error} 한 공통 slug에 디렉터리가 둘 이상이거나 ID가 999를 넘을 때
 */
function planRegistry(
  base: EpicRegistry,
  existingEpicDirs: string[],
): { registry: EpicRegistry; scaffold: { slug: string; id: string }[] } {
  const parsedDirs: { id: string; slug: string }[] = [];
  for (const name of existingEpicDirs) {
    const match = /^(\d{3})-(.+)$/.exec(name);
    if (match) parsedDirs.push({ id: match[1], slug: match[2] });
  }
  const commonSlugs = new Set(base.epics.filter((e) => e.kind === 'common').map((e) => e.slug));
  for (const slug of commonSlugs) {
    const dirs = parsedDirs.filter((d) => d.slug === slug);
    if (dirs.length > 1) {
      const names = dirs.map((d) => `${d.id}-${d.slug}`).join(', ');
      throw new Error(`more than one existing directory for common epic ${slug}: ${names}`);
    }
  }
  let next = parsedDirs.reduce((max, d) => Math.max(max, Number(d.id)), 0) + 1;
  const epics: RegistryEpic[] = [];
  const scaffold: { slug: string; id: string }[] = [];
  for (const common of base.epics.filter((e) => e.kind === 'common')) {
    const existing = parsedDirs.find((d) => d.slug === common.slug);
    if (existing) {
      epics.push({ slug: common.slug, id: existing.id, kind: 'common', active: common.active });
      continue;
    }
    if (next > 999) throw new Error('no free epic id left (max 999)');
    const id = String(next).padStart(3, '0');
    next += 1;
    epics.push({ slug: common.slug, id, kind: 'common', active: common.active });
    scaffold.push({ slug: common.slug, id });
  }
  for (const dir of parsedDirs) {
    if (commonSlugs.has(dir.slug)) continue;
    epics.push({ slug: dir.slug, id: dir.id, kind: 'legacy', active: true });
  }
  return { registry: { ...base, epics }, scaffold };
}

/**
 * 등록부 형식 위반을 S35 실패 목록으로 돌려준다. 파일이 없으면 빈 배열이다.
 *
 * @param {{repoRoot: string}} opts - 저장소 루트
 * @returns {RegistryFailure[]} 형식 위반 S35 항목(없으면 빈 배열)
 */
function checkEpicRegistry({ repoRoot }: { repoRoot: string }): RegistryFailure[] {
  const read = readEpicRegistry(repoRoot);
  if (read.status !== 'invalid') return [];
  return [{ code: 'S35', message: `epic registry is invalid: ${read.message}`, file: REGISTRY_REL }];
}

/**
 * 등록부를 JSON 2칸 들여쓰기 + 끝 개행으로 직렬화한다. 등록부 쓰기는 이 함수 하나로 한다.
 *
 * @param {EpicRegistry} registry - 직렬화할 등록부
 * @returns {string} 파일에 쓸 문자열
 */
function serializeEpicRegistry(registry: EpicRegistry): string {
  return `${JSON.stringify(registry, null, 2)}\n`;
}

type AddFailure = { ok: false; reason: string; cause: string };

/**
 * epic slug·area 이름이 새 이름으로 쓸 수 있는 형식인지 본다. 공통 epic slug와
 * 목적형 이름은 등록부가 막으려는 대상이라 도메인 epic과 area 모두에서 거절한다.
 *
 * @param {string} name - 검사할 이름
 * @returns {string | null} 위반 사유(통과하면 null)
 */
function nameViolation(name: string): string | null {
  if (!SLUG_RE.test(name)) return `"${name}" is not a lowercase kebab-case slug`;
  if (COMMON_EPICS.some((c) => c.slug === name)) return `"${name}" is a common epic slug`;
  if (PURPOSE_NAMES.includes(name)) return `"${name}" is a purpose-style name, not a domain name`;
  return null;
}

/**
 * 등록부에 도메인 epic 하나를 더한 새 등록부를 돌려준다. 입력 등록부는 바꾸지 않으며
 * 검증을 모두 통과해야만 ok를 돌려줘 호출자가 쓰기를 한 번만 하게 한다.
 * id는 등록부 id와 디렉터리 번호 중 최대값+1이다(디렉터리만 있는 번호를 재사용하지 않기 위함).
 *
 * @param {EpicRegistry} registry - 현재 등록부
 * @param {{slug: string, reason: string, approvedAt: string}} input - 새 epic과 승인 근거
 * @param {string[]} existingEpicDirs - epics 디렉터리 직계 이름(`NNN-slug`)
 * @returns {{ok: true, registry: EpicRegistry, epic: {slug: string, id: string}} | AddFailure} 추가 결과
 */
function addDomainEpic(
  registry: EpicRegistry,
  input: { slug: string; reason: string; approvedAt: string },
  existingEpicDirs: string[],
): { ok: true; registry: EpicRegistry; epic: { slug: string; id: string } } | AddFailure {
  const fail = (reason: string, cause: string): AddFailure => ({ ok: false, reason, cause });
  if (input.reason.trim() === '') return fail('epic-registry-reason-missing', '--reason must not be blank');
  const violation = nameViolation(input.slug);
  if (violation !== null) return fail('epic-registry-name-invalid', violation);
  if (registry.epics.some((e) => e.slug === input.slug)) {
    return fail('epic-registry-name-taken', `epic slug already registered: ${input.slug}`);
  }
  const domainCount = registry.epics.filter((e) => e.kind === 'domain').length;
  if (domainCount >= registry.domainEpicLimit) {
    const limit = registry.domainEpicLimit;
    return fail('epic-registry-domain-limit', `domain epics ${domainCount} reached domainEpicLimit ${limit}`);
  }
  let max = registry.epics.reduce((m, e) => Math.max(m, Number(e.id)), 0);
  for (const name of existingEpicDirs) {
    const match = /^(\d{3})-/.exec(name);
    if (match) max = Math.max(max, Number(match[1]));
  }
  if (max + 1 > 999) return fail('epic-registry-invalid', 'no free epic id left (max 999)');
  const id = String(max + 1).padStart(3, '0');
  const epic: RegistryEpic = {
    slug: input.slug, id, kind: 'domain', active: true,
    approval: { reason: input.reason, approvedAt: input.approvedAt },
  };
  return { ok: true, registry: { ...registry, epics: [...registry.epics, epic] }, epic: { slug: input.slug, id } };
}

/**
 * 등록부 `areas`에 이름 하나를 더한 새 등록부를 돌려준다. 입력 등록부는 바꾸지 않는다.
 *
 * @param {EpicRegistry} registry - 현재 등록부
 * @param {string} name - 추가할 area 이름
 * @returns {{ok: true, registry: EpicRegistry, area: string} | AddFailure} 추가 결과
 */
function addArea(
  registry: EpicRegistry,
  name: string,
): { ok: true; registry: EpicRegistry; area: string } | AddFailure {
  const violation = nameViolation(name);
  if (violation !== null) return { ok: false, reason: 'epic-registry-name-invalid', cause: violation };
  if (registry.areas.includes(name)) {
    return { ok: false, reason: 'epic-registry-name-taken', cause: `area already registered: ${name}` };
  }
  return { ok: true, registry: { ...registry, areas: [...registry.areas, name] }, area: name };
}

/**
 * 등록부를 `.bouncer/epics.json`에 쓴다. 호출자가 검증을 끝낸 뒤 한 번만 부른다.
 *
 * @param {string} repoRoot - 저장소 루트 절대 경로
 * @param {EpicRegistry} registry - 쓸 등록부
 * @returns {void}
 * @throws {Error} 파일 쓰기에 실패했을 때(호출자가 그대로 올린다)
 */
function writeEpicRegistry(repoRoot: string, registry: EpicRegistry): void {
  fs.writeFileSync(path.join(repoRoot, REGISTRY_REL), serializeEpicRegistry(registry));
}

export = {
  REGISTRY_REL,
  addDomainEpic,
  addArea,
  writeEpicRegistry,
  COMMON_EPICS,
  PURPOSE_NAMES,
  parseEpicRegistry,
  readEpicRegistry,
  expandProfile,
  planRegistry,
  checkEpicRegistry,
  serializeEpicRegistry,
};
