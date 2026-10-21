'use strict';
const nodeFs = require('node:fs');
const path = require('node:path');
import layout = require('./layout');
const { CONTEXT_ROOT } = layout;
import epicRegistry = require('./epic-registry');
import frontmatter = require('./frontmatter');
const { parseFrontmatter } = frontmatter;
import guards = require('./guards');
const { isRecord } = guards;

// legacy epic 병합 계획. 도메인 epic `index.md`의 `## Legacy epic 귀속` 목록과 예외 표에서 legacy blueprint별
// 이동 대상을 결정적으로 계산한다. 순수 계산이다: git·쓰기 없이 읽기 seam(`readFile`·`listDirs`)만 쓴다.
// 디스크 이동과 CLI 연결은 후속 task(적용 단계) 소관이다.

type EpicRegistry = Extract<ReturnType<typeof epicRegistry.readEpicRegistry>, { status: 'ok' }>['registry'];
type RegistryEpic = EpicRegistry['epics'][number];
type MergeMove = {
  from: string; to: string; legacyEpic: string; domainEpic: string; slug: string; order: number;
};
type UnresolvedRow = { domain: string; legacy_id: string; cell: string };
type MergeFailureCode = 'merge-mapping-invalid' | 'migrate-slug-conflict';
type MergePlanResult =
  | {
    ok: true;
    moves: MergeMove[];
    unresolved_rows: UnresolvedRow[];
    legacyEpics: Array<{ slug: string; legacy_id: string; domain: string }>;
    byDomain: Record<string, MergeMove[]>;
  }
  | { ok: false; code: MergeFailureCode; details: unknown[] };
type PlanOptions = {
  repoRoot: string;
  registry: EpicRegistry | null;
  readFile?: (rel: string) => string | null;
  listDirs?: (rel: string) => string[];
};
type ExceptionRow = { domain: string; legacy: RegistryEpic; slugs: string[] };

const EPICS_ROOT = `${CONTEXT_ROOT}/epics`;
const LIST_HEADING = '## Legacy epic 귀속';
const TABLE_HEADING = '### 다른 epic에서 이 영역으로 귀속되는 blueprint';
const LIST_LINE_RE = /^- \[[^\]\n]+\]\(\.\.\/([^/)\s]+)\/index\.md\)(?: △)?\s*$/;

/** 읽기 seam 기본 구현. 파일이 없을 때(ENOENT·ENOTDIR)만 null이고 권한 오류 등은 던진다. */
function defaultReadFile(repoRoot: string): (rel: string) => string | null {
  return (rel) => {
    try {
      return nodeFs.readFileSync(path.join(repoRoot, rel), 'utf8') as string;
    } catch (error) {
      // 없는 문서는 "그 epic에 index가 없음"이라는 정상 입력이다. 그 밖의 오류를 숨기면 계획이 틀어진다.
      const code = (error as NodeJS.ErrnoException).code;
      if (code === 'ENOENT' || code === 'ENOTDIR') return null;
      throw error;
    }
  };
}

/** 디렉터리 이름 목록 seam 기본 구현. 디렉터리가 없으면 빈 목록이고, 이름순으로 고정한다. */
function defaultListDirs(repoRoot: string): (rel: string) => string[] {
  return (rel) => {
    try {
      return (nodeFs.readdirSync(path.join(repoRoot, rel), { withFileTypes: true }) as import('node:fs').Dirent[])
        .filter((entry) => entry.isDirectory()).map((entry) => entry.name).sort();
    } catch (error) {
      const code = (error as NodeJS.ErrnoException).code;
      if (code === 'ENOENT' || code === 'ENOTDIR') return [];
      throw error;
    }
  };
}

/** `## ` 제목 한 줄을 시작으로 같은 단계 이상의 다음 제목 전까지의 줄을 돌려준다. 제목이 없으면 null이다. */
function sectionLines(text: string, heading: string): string[] | null {
  const lines = text.split('\n');
  const start = lines.findIndex((line) => line.trim() === heading);
  if (start === -1) return null;
  const level = heading.match(/^#+/)![0].length;
  const out: string[] = [];
  for (const line of lines.slice(start + 1)) {
    const hit = /^(#+)\s/.exec(line);
    if (hit !== null && hit[1].length <= level) break;
    out.push(line);
  }
  return out;
}

/** blueprint index frontmatter의 `bouncer.order`. 문서·값이 없으면 null이다(frontmatter 부재만 흡수). */
function orderOf(readFile: (rel: string) => string | null, indexRel: string): number | null {
  const text = readFile(indexRel);
  if (text === null) return null;
  let data: unknown;
  try {
    data = parseFrontmatter(text).data;
  } catch (error) {
    // frontmatter가 없는 문서만 "order 없음"으로 본다. YAML 오류는 계획이 틀어지므로 던진다.
    if (error instanceof Error && error.message === 'missing frontmatter block') return null;
    throw error;
  }
  const bouncer = isRecord(data) ? data.bouncer : undefined;
  return isRecord(bouncer) && typeof bouncer.order === 'number' ? bouncer.order : null;
}

/**
 * legacy epic 병합 이동 계획을 계산한다. 디스크를 쓰지 않으며 같은 입력에 같은 출력을 낸다.
 *
 * 규칙: legacy epic의 blueprint는 그 legacy가 `## Legacy epic 귀속` 목록에 오른 도메인 epic으로 가되,
 * 예외 표에 오른 blueprint는 그 표가 있는 도메인 epic으로 간다. `order`는 대상 epic의 기존 최댓값 다음부터
 * (legacy_id 오름차순, 원래 order 오름차순)으로 1씩 붙는다. 자유 서술 예외 행은 `unresolved_rows`로 보고하고
 * 그 행의 blueprint는 목록 규칙으로 계획한다(적용 단계가 거절하는 근거).
 *
 * @param {object} opts - 입력
 * @param {string} opts.repoRoot - 저장소 루트 절대 경로(기본 seam이 읽을 때만 쓴다)
 * @param {EpicRegistry | null} opts.registry - v2 등록부
 * @param {(rel: string) => string | null} [opts.readFile] - 저장소 상대 경로 문서 읽기. 없으면 null
 * @param {(rel: string) => string[]} [opts.listDirs] - 저장소 상대 경로 하위 디렉터리 이름. 없으면 빈 목록
 * @returns {MergePlanResult} 성공(moves·unresolved_rows·legacyEpics·byDomain) 또는
 *   실패(`merge-mapping-invalid`·`migrate-slug-conflict`와 details). 첫 실패에서 계산을 멈춘다
 */
function planLegacyEpicMerge(opts: PlanOptions): MergePlanResult {
  const readFile = opts.readFile ?? defaultReadFile(opts.repoRoot);
  const listDirs = opts.listDirs ?? defaultListDirs(opts.repoRoot);
  const invalid = (...details: unknown[]): MergePlanResult => ({ ok: false, code: 'merge-mapping-invalid', details });
  const registry = opts.registry;
  if (registry === null || registry.version !== 2) return invalid({ reason: 'registry is not version 2' });

  const legacyBySlug = new Map(registry.epics.filter((e) => e.kind === 'legacy').map((e) => [e.slug, e]));
  const legacyByNumber = new Map<string, RegistryEpic>();
  for (const e of legacyBySlug.values()) if (e.legacy_id !== undefined) legacyByNumber.set(e.legacy_id, e);
  // 도메인은 slug 순으로 읽어 같은 입력이 항상 같은 오류·순서를 내게 한다.
  const domains = registry.epics.filter((e) => e.kind === 'domain').map((e) => e.slug).sort();

  // 1. 귀속 목록과 예외 표를 도메인 index에서 읽는다.
  const owner = new Map<string, string>(); // legacy slug → 목록을 가진 domain
  const exceptions: ExceptionRow[] = [];
  const unresolved: UnresolvedRow[] = [];
  for (const domain of domains) {
    const text = readFile(`${EPICS_ROOT}/${domain}/index.md`);
    if (text === null) continue;
    for (const line of sectionLines(text, LIST_HEADING) ?? []) {
      if (!line.startsWith('- ')) continue;
      const hit = LIST_LINE_RE.exec(line);
      if (hit === null) return invalid({ domain, line, reason: 'list line is not a legacy epic link' });
      const legacy = legacyBySlug.get(hit[1]);
      if (legacy === undefined) return invalid({ domain, epic: hit[1], reason: 'linked epic is not a legacy epic' });
      const previous = owner.get(legacy.slug);
      if (previous !== undefined) {
        return invalid({ legacy: legacy.slug, domains: [previous, domain], reason: 'legacy epic is listed twice' });
      }
      owner.set(legacy.slug, domain);
    }
    for (const line of sectionLines(text, TABLE_HEADING) ?? []) {
      if (!line.trim().startsWith('|')) continue;
      const cells = line.trim().replace(/^\||\|$/g, '').split('|').map((c) => c.trim());
      // 머리글·구분선은 행이 아니다.
      if (cells[0] === 'legacy epic' || /^:?-+:?$/.test(cells[0])) continue;
      if (cells.length !== 3) return invalid({ domain, line, reason: 'exception row must have three cells' });
      const legacy = legacyByNumber.get(cells[0]);
      if (legacy === undefined) return invalid({ domain, legacy_id: cells[0], reason: 'unknown legacy number' });
      const parsed = parseCell(cells[1], legacy);
      if (parsed.error !== undefined) {
        return invalid({ domain, legacy_id: cells[0], cell: cells[1], reason: parsed.error });
      }
      if (parsed.slugs.length === 0) unresolved.push({ domain, legacy_id: cells[0], cell: cells[1] });
      else exceptions.push({ domain, legacy, slugs: parsed.slugs });
    }
  }
  for (const legacy of legacyBySlug.values()) {
    if (!owner.has(legacy.slug)) return invalid({ legacy: legacy.slug, reason: 'legacy epic is in no list' });
  }

  // 2. 예외 대상 지도. 같은 blueprint가 서로 다른 도메인의 표에 있으면 어느 쪽인지 정할 수 없다.
  const exceptionTarget = new Map<string, string>(); // `${legacy slug}/${bp slug}` → domain
  for (const row of exceptions) {
    for (const slug of row.slugs) {
      const key = `${row.legacy.slug}/${slug}`;
      const previous = exceptionTarget.get(key);
      if (previous !== undefined && previous !== row.domain) {
        return invalid({ legacy: row.legacy.slug, blueprint: slug, domains: [previous, row.domain] });
      }
      exceptionTarget.set(key, row.domain);
    }
  }

  // 3. legacy epic별 실제 blueprint 디렉터리를 이동 후보로 모은다. 이미 옮겨진 것은 디렉터리가 없어 빠진다.
  const candidates: Array<{ legacy: RegistryEpic; slug: string; original: number; domain: string }> = [];
  for (const legacy of [...legacyBySlug.values()].sort(compareLegacy)) {
    const aliasNumberOf = new Map(Object.entries(legacy.blueprint_aliases ?? {}).map(([n, s]) => [s, Number(n)]));
    for (const slug of listDirs(`${EPICS_ROOT}/${legacy.slug}/blueprints`)) {
      const fromFrontmatter = orderOf(readFile, `${EPICS_ROOT}/${legacy.slug}/blueprints/${slug}/index.md`);
      // frontmatter `order`가 정본이고, 없으면 옛 번호 별칭, 그것도 없으면 맨 뒤(이름순)로 둔다.
      const original = fromFrontmatter ?? aliasNumberOf.get(slug) ?? Number.MAX_SAFE_INTEGER;
      const domain = exceptionTarget.get(`${legacy.slug}/${slug}`) ?? (owner.get(legacy.slug) as string);
      candidates.push({ legacy, slug, original, domain });
    }
  }
  candidates.sort((a, b) => compareLegacy(a.legacy, b.legacy) || a.original - b.original
    || (a.slug < b.slug ? -1 : a.slug > b.slug ? 1 : 0));

  // 4. 충돌 검사와 order 배정.
  const nextOrder = new Map<string, number>();
  const taken = new Map<string, Set<string>>();
  const moves: MergeMove[] = [];
  for (const c of candidates) {
    if (!taken.has(c.domain)) {
      const existing = listDirs(`${EPICS_ROOT}/${c.domain}/blueprints`);
      taken.set(c.domain, new Set(existing));
      const orders = existing.map((s) => orderOf(readFile, `${EPICS_ROOT}/${c.domain}/blueprints/${s}/index.md`));
      nextOrder.set(c.domain, orders.reduce<number>((max, o) => Math.max(max, o ?? 0), 0) + 1);
    }
    const slugs = taken.get(c.domain) as Set<string>;
    if (slugs.has(c.slug)) {
      return { ok: false, code: 'migrate-slug-conflict', details: [{
        legacy: c.legacy.slug, blueprint: c.slug, domain: c.domain,
      }] };
    }
    slugs.add(c.slug);
    const order = nextOrder.get(c.domain) as number;
    nextOrder.set(c.domain, order + 1);
    moves.push({
      from: `${EPICS_ROOT}/${c.legacy.slug}/blueprints/${c.slug}`,
      to: `${EPICS_ROOT}/${c.domain}/blueprints/${c.slug}`,
      legacyEpic: c.legacy.slug, domainEpic: c.domain, slug: c.slug, order,
    });
  }

  const byDomain: Record<string, MergeMove[]> = {};
  for (const move of moves) (byDomain[move.domainEpic] ??= []).push(move);
  const legacyEpics = [...legacyBySlug.values()].sort(compareLegacy).map((e) => ({
    slug: e.slug, legacy_id: e.legacy_id as string, domain: owner.get(e.slug) as string,
  }));
  return { ok: true, moves, unresolved_rows: unresolved, legacyEpics, byDomain };
}

/** legacy epic을 `legacy_id` 오름차순(없으면 slug)으로 비교한다. 번호는 3자리 0패딩이라 문자열 비교로 충분하다. */
function compareLegacy(a: RegistryEpic, b: RegistryEpic): number {
  const left = a.legacy_id ?? a.slug;
  const right = b.legacy_id ?? b.slug;
  return left < right ? -1 : left > right ? 1 : 0;
}

/**
 * 예외 표 blueprint 셀을 쉼표로 나눈 항목(`NNN`·`NNN~MMM`·`NNN <slug>`)으로 풀어 현재 slug 목록을 낸다.
 * 항목을 하나도 얻지 못한 셀(자유 서술)은 빈 목록이고, 일부만 해석되면 오류다.
 *
 * @param {string} cell - 표의 blueprint 셀
 * @param {RegistryEpic} legacy - 행의 legacy epic(`blueprint_aliases`를 쥔다)
 * @returns {{ slugs: string[]; error?: string }} slug 목록 또는 거절 사유
 */
function parseCell(cell: string, legacy: RegistryEpic): { slugs: string[]; error?: string } {
  const aliases = legacy.blueprint_aliases ?? {};
  const slugs: string[] = [];
  const parts = cell.split(',').map((p) => p.trim()).filter((p) => p !== '');
  let matched = 0;
  for (const part of parts) {
    const single = /^(\d{3})$/.exec(part);
    const range = /^(\d{3})~(\d{3})$/.exec(part);
    const named = /^(\d{3})\s+(\S+)$/.exec(part);
    if (single === null && range === null && named === null) continue;
    matched += 1;
    if (single !== null) {
      if (aliases[single[1]] === undefined) return { slugs, error: `blueprint number not in aliases: ${single[1]}` };
      slugs.push(aliases[single[1]]);
    } else if (range !== null) {
      const [low, high] = [Number(range[1]), Number(range[2])];
      if (low > high) return { slugs, error: `range is reversed: ${part}` };
      for (let n = low; n <= high; n += 1) {
        const key = String(n).padStart(3, '0');
        if (aliases[key] === undefined) return { slugs, error: `blueprint number not in aliases: ${key}` };
        slugs.push(aliases[key]);
      }
    } else if (named !== null) {
      if (aliases[named[1]] === undefined) return { slugs, error: `blueprint number not in aliases: ${named[1]}` };
      if (aliases[named[1]] !== named[2]) {
        return { slugs, error: `slug differs from alias: ${named[1]} is ${aliases[named[1]]}, not ${named[2]}` };
      }
      slugs.push(named[2]);
    }
  }
  if (matched > 0 && matched !== parts.length) return { slugs, error: 'cell has unparseable items' };
  return { slugs: matched === 0 ? [] : slugs };
}

export = { planLegacyEpicMerge };
