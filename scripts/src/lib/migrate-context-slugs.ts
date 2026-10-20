'use strict';
const nodeFs = require('node:fs');
const path = require('node:path');
const { execFileSync } = require('node:child_process');
import guards = require('./guards');
const { isRecord, catchMessage } = guards;
import layout = require('./layout');
const { CONTEXT_ROOT } = layout;
import contextIds = require('./context-ids');
const { parseContextPath, validateSlug, normalizeStableId } = contextIds;
import epicRegistry = require('./epic-registry');
const { readEpicRegistry, parseEpicRegistry, serializeEpicRegistry, REGISTRY_REL } = epicRegistry;
import epicIndex = require('./epic-index');
const { formatEpicIndexLine, CONTEXT_INDEX_REL } = epicIndex;
import frontmatter = require('./frontmatter');
const { parseFrontmatter } = frontmatter;
import render = require('./render');
const { renderDoc } = render;
import canonicalJson = require('./canonical-json');
const { sha256Canonical } = canonicalJson;
import validateSections = require('./validate-sections');
const { findingFingerprint, findingAutoId } = validateSections;
import planSnapshotContract = require('./plan-snapshot-contract');
const { digestPlanContent, normalizeStructure, structureKindOf } = planSnapshotContract;
import taskBriefHashModule = require('./task-brief-hash');
const { taskBriefHash } = taskBriefHashModule;
import runtimeState = require('./runtime-state');
const { runtimePaths, listNamespacePointers, COORDINATOR_LEDGER_REL } = runtimeState;
import schema = require('./schema');
const { ID_PREFIX } = schema;
import validate = require('./validate');
const { validateBlueprint } = validate;

// `bouncer migrate context-slugs`: 번호 형식(`114-slug`) epic·blueprint 디렉터리를 slug 형식으로 한 번에 옮긴다.
// 경로 형식이 바뀌는 순간 모든 epic이 새 형식으로 전환되므로(결정 10) 부분 적용 모드는 두지 않는다.
// 모든 문서 변경을 메모리에서 먼저 계산한 뒤에만 쓰기를 시작해, 계산 단계의 실패(깨진 YAML 등)가
// 디스크를 건드리지 않게 한다. 쓰기 단계의 롤백은 하지 않고 되돌리는 명령만 안내한다(답변 16).

type RegistryRead = ReturnType<typeof readEpicRegistry>;
type EpicRegistry = Extract<RegistryRead, { status: 'ok' }>['registry'];
type InjectedFs = typeof import('node:fs');
type Move = { from: string; to: string };
type BlueprintMove = Move & { number: string; slug: string; order: number };
type EpicMove = Move & { legacyId: string; slug: string; blueprints: BlueprintMove[] };
type InProgressEntry = { kind: 'pointer' | 'approval' | 'ledger' | 'worktree'; path: string };
type Deps = {
  runGit(args: string[]): { stdout: string };
  fs?: InjectedFs;
  listInProgress(): InProgressEntry[];
};
type AliasTable = Record<string, { legacy_id: string; blueprint_aliases: Record<string, string> }>;
type MigrationPlan = {
  epics: EpicMove[];
  moved: Move[];
  conflicts: string[];
  nextRegistry: EpicRegistry | null;
  aliases: AliasTable;
};
type ValidateEntry = { blueprint: string; ok: boolean; failures: unknown[] };
type MigrationSuccess = {
  ok: true;
  dryRun: boolean;
  moved: Move[];
  rewritten: string[];
  aliases: AliasTable;
  validate: ValidateEntry[];
};
type MigrationFailure = {
  ok: false;
  code: string;
  message: string;
  next: string;
  blockers?: InProgressEntry[];
  moved?: Move[];
  rewritten?: string[];
  aliases?: AliasTable;
  validate?: ValidateEntry[];
};
type MigrationResult = MigrationSuccess | MigrationFailure;
type Rewrite = { oldRel: string; newRel: string; original: string; text: string };

const RESTORE_NEXT = 'git restore --staged --worktree .bouncer && git clean -fd .bouncer/context';
// 구형 trailer·문서가 쓰던 `EPIC-ddd/BP-ddd[/TASK-ddd]` 안정 ID.
const OLD_STABLE_RE = /EPIC-\d{3}\/BP-\d{3}(?:\/TASK-\d{3})?/g;
const TASK_UNIT_DIR_RE = /\/tasks\/\d{3}\//;
// blueprint 루트에 놓일 수 있는 증적 문서 type. 구형 루트 tasks 문서는 id 규칙이 달라 여기 넣지 않는다.
const ROOT_DOC_TYPES = ['bouncer.review', 'bouncer.explain', 'bouncer.context_review'];
const TASK_DOC_RE = /^(.*)\/tasks\/(\d{3})\/tasks\.md$/;

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function failure(
  code: string,
  message: string,
  next: string,
  extra: Partial<MigrationFailure> = {},
): MigrationFailure {
  return { ok: false, code, message, next, ...extra };
}

/**
 * 기본 git 실행기. 실패는 던진다 — `git status`가 실패한 저장소를 깨끗하다고 보면 안 된다.
 *
 * @param {string} repoRoot - git cwd
 * @returns {(args: string[]) => { stdout: string }} `git` 뒤 argv를 받는 실행기
 */
function defaultRunGit(repoRoot: string): (args: string[]) => { stdout: string } {
  return (args) => ({
    stdout: execFileSync('git', args, {
      cwd: repoRoot, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'], maxBuffer: 256 * 1024 * 1024,
    }) as string,
  });
}

/** 디렉터리의 하위 파일 절대 경로를 모은다. 디렉터리가 없으면 빈 목록이다(ENOENT만 흡수). */
function listFilesUnder(fsApi: InjectedFs, dir: string): string[] {
  let names: string[];
  try {
    names = fsApi.readdirSync(dir);
  } catch (error) {
    // 부재(ENOENT)·디렉터리 아님(ENOTDIR)만 "없음"이다. 권한 오류는 숨기면 진행 중 상태를 놓치므로 던진다.
    const code = (error as NodeJS.ErrnoException).code;
    if (code === 'ENOENT' || code === 'ENOTDIR') return [];
    throw error;
  }
  const out: string[] = [];
  for (const name of names) {
    const abs = path.join(dir, name);
    if (fsApi.statSync(abs).isDirectory()) out.push(...listFilesUnder(fsApi, abs));
    else out.push(abs);
  }
  return out;
}

/**
 * 진행 중인 실행 상태를 모은다. 이관은 경로 키를 바꾸므로 pointer·승인 스냅샷·coordinator 원장·
 * linked worktree가 옛 키를 쥔 채 남으면 안 된다. `.bouncer/runtime/plan-*`와 context-review 캐시는
 * 경로 키를 쥐지 않는 재생성 캐시라 일부러 보지 않는다(답변 17).
 *
 * @param {object} opts - 입력
 * @param {string} opts.repoRoot - 저장소 루트 절대 경로
 * @param {(args: string[]) => { stdout: string }} opts.runGit - `git worktree list --porcelain` 실행기
 * @param {InjectedFs} opts.fsApi - 읽기용 fs
 * @returns {InProgressEntry[]} 거절 사유가 되는 항목(없으면 빈 목록)
 */
function defaultListInProgress({ repoRoot, runGit, fsApi }: {
  repoRoot: string;
  runGit: (args: string[]) => { stdout: string };
  fsApi: InjectedFs;
}): InProgressEntry[] {
  const found: InProgressEntry[] = [];
  const paths = runtimePaths({ repoRoot });
  if (paths.unavailable) return found;
  // 1. pointer: 레거시 단일 파일과 namespace 파일(깨진 파일 포함 — 깨진 주기도 진행 중으로 본다).
  if (fsApi.existsSync(paths.currentFile as string)) found.push({ kind: 'pointer', path: paths.currentFile as string });
  for (const entry of listNamespacePointers({ repoRoot })) found.push({ kind: 'pointer', path: entry.path });
  // 2. 승인 스냅샷: 파일이 하나라도 있으면 승인 후 미완료 주기다.
  for (const file of listFilesUnder(fsApi, paths.approvalsRoot as string)) found.push({ kind: 'approval', path: file });
  // 3. coordinator 원장: `.worktrees/<epic>/<bp>/integration/…/coordinator.json` (coordinatorPathsFor 배치).
  const worktreeRoot = paths.worktreeRoot as string;
  for (const epicDir of fsApi.existsSync(worktreeRoot) ? fsApi.readdirSync(worktreeRoot) : []) {
    const epicAbs = path.join(worktreeRoot, epicDir);
    if (!fsApi.statSync(epicAbs).isDirectory()) continue;
    for (const bpDir of fsApi.readdirSync(epicAbs)) {
      const ledger = path.join(epicAbs, bpDir, 'integration', ...COORDINATOR_LEDGER_REL.split('/'));
      if (fsApi.existsSync(ledger)) found.push({ kind: 'ledger', path: ledger });
    }
  }
  // 4. linked worktree: 이관을 실행하는 checkout 자신은 제외한다.
  const listed = runGit(['worktree', 'list', '--porcelain']).stdout;
  for (const line of listed.split('\n')) {
    if (!line.startsWith('worktree ')) continue;
    const wt = line.slice('worktree '.length).trim();
    if (wt !== repoRoot && wt.startsWith(`${worktreeRoot}${path.sep}`)) found.push({ kind: 'worktree', path: wt });
  }
  return found;
}

/** 등록부 항목을 v2 모양(`id` 제거, 옛 번호는 `legacy_id`)으로 복사한다. 키 순서를 고정한다. */
function toV2Epic(epic: EpicRegistry['epics'][number]): Record<string, unknown> {
  const legacyId = epic.legacy_id ?? epic.id;
  return {
    slug: epic.slug,
    ...(legacyId === undefined ? {} : { legacy_id: legacyId }),
    kind: epic.kind,
    active: epic.active,
    ...(epic.approval === undefined ? {} : { approval: epic.approval }),
    ...(epic.blueprint_aliases === undefined ? {} : { blueprint_aliases: { ...epic.blueprint_aliases } }),
  };
}

/**
 * 번호 형식 epic·blueprint 디렉터리를 slug 형식으로 옮기는 계획을 만든다. 파일을 쓰지 않는다.
 * 겹침·규칙 위반은 `conflicts`에 모으고 계획은 계속 만든다(호출자가 한 번에 보고하도록).
 *
 * @param {object} opts - 입력
 * @param {string} opts.repoRoot - 저장소 루트 절대 경로
 * @param {EpicRegistry | null} opts.registry - 현재 등록부. 없으면 `nextRegistry`는 null이다
 * @param {Partial<Deps>} [opts.deps] - `fs` 주입(읽기)
 * @returns {MigrationPlan} 이동 목록·충돌·다음 등록부·별칭 표
 */
function planContextSlugMigration({ repoRoot, registry, deps }: {
  repoRoot: string;
  registry: EpicRegistry | null;
  deps?: Partial<Deps>;
}): MigrationPlan {
  const fsApi = deps?.fs ?? nodeFs;
  const epicsRel = `${CONTEXT_ROOT}/epics`;
  const conflicts: string[] = [];
  const epics: EpicMove[] = [];
  const epicNames = fsApi.existsSync(path.join(repoRoot, epicsRel))
    ? (fsApi.readdirSync(path.join(repoRoot, epicsRel)) as string[]).sort() : [];
  const claimedEpicSlugs = new Set<string>();
  for (const name of epicNames) {
    const ids = parseContextPath(`epics/${name}`);
    // 이미 slug인 디렉터리와 해석되지 않는 이름은 건너뛴다(재실행·비정본 이름은 이관 대상이 아니다).
    if (!ids || ids.format !== 'numeric') continue;
    if (!fsApi.statSync(path.join(repoRoot, epicsRel, name)).isDirectory()) continue;
    const slugViolation = validateSlug(ids.epicSlug);
    if (slugViolation !== null) conflicts.push(`${epicsRel}/${name}: ${slugViolation}`);
    if (claimedEpicSlugs.has(ids.epicSlug)) {
      conflicts.push(`${epicsRel}/${name}: epic slug is also claimed by another numbered epic: ${ids.epicSlug}`);
    }
    claimedEpicSlugs.add(ids.epicSlug);
    if (fsApi.existsSync(path.join(repoRoot, epicsRel, ids.epicSlug))) {
      conflicts.push(`${epicsRel}/${name}: ${epicsRel}/${ids.epicSlug} already exists`);
    }
    const move: EpicMove = {
      from: `${epicsRel}/${name}`,
      to: `${epicsRel}/${ids.epicSlug}`,
      legacyId: ids.epicKey,
      slug: ids.epicSlug,
      blueprints: [],
    };
    const bpRoot = path.join(repoRoot, move.from, 'blueprints');
    const bpNames = fsApi.existsSync(bpRoot) ? (fsApi.readdirSync(bpRoot) as string[]).sort() : [];
    const seen = new Set<string>();
    for (const bpName of bpNames) {
      if (!fsApi.statSync(path.join(bpRoot, bpName)).isDirectory()) continue;
      const bpIds = parseContextPath(`epics/${name}/blueprints/${bpName}`);
      if (!bpIds || bpIds.format !== 'numeric' || bpIds.blueprintKey === null || bpIds.blueprintSlug === null) {
        conflicts.push(`${move.from}/blueprints/${bpName}: blueprint directory is not numbered (ddd-slug)`);
        continue;
      }
      const bpViolation = validateSlug(bpIds.blueprintSlug);
      if (bpViolation !== null) conflicts.push(`${move.from}/blueprints/${bpName}: ${bpViolation}`);
      if (seen.has(bpIds.blueprintSlug)) {
        conflicts.push(`${move.from}/blueprints/${bpName}: blueprint slug repeats in this epic: `
          + `${bpIds.blueprintSlug}`);
      }
      seen.add(bpIds.blueprintSlug);
      move.blueprints.push({
        from: `${move.from}/blueprints/${bpName}`,
        to: `${move.to}/blueprints/${bpIds.blueprintSlug}`,
        number: bpIds.blueprintKey,
        slug: bpIds.blueprintSlug,
        order: Number(bpIds.blueprintKey),
      });
    }
    epics.push(move);
  }

  // 등록부: v1 항목은 `id`를 `legacy_id`로 옮기고, 번호 디렉터리를 가졌던 epic은 legacy 여부와 관계없이
  // `legacy_id`·`blueprint_aliases`를 가진다. 이미 기록된 같은 별칭은 건너뛰고 다른 값이면 충돌이다.
  const aliases: AliasTable = {};
  let nextRegistry: EpicRegistry | null = null;
  if (registry !== null) {
    const nextEpics = registry.epics.map(toV2Epic);
    for (const move of epics) {
      let entry = nextEpics.find((e) => e.slug === move.slug);
      if (entry === undefined) {
        // 등록부에 없는 번호 epic은 init의 planRegistry와 같이 legacy로 기록한다(번호 별칭을 잃지 않기 위함).
        entry = { slug: move.slug, legacy_id: move.legacyId, kind: 'legacy', active: true };
        nextEpics.push(entry);
      } else if (entry.legacy_id !== move.legacyId) {
        conflicts.push(`${move.from}: registry records legacy id ${String(entry.legacy_id)} for ${move.slug}`);
      }
      const table: Record<string, string> = { ...(entry.blueprint_aliases as Record<string, string> | undefined) };
      for (const bp of move.blueprints) {
        if (table[bp.number] !== undefined && table[bp.number] !== bp.slug) {
          conflicts.push(`${move.slug}: alias ${bp.number} already points to ${table[bp.number]}, not ${bp.slug}`);
        }
        table[bp.number] = bp.slug;
      }
      entry.blueprint_aliases = Object.fromEntries(Object.entries(table).sort(([a], [b]) => a.localeCompare(b)));
      aliases[move.slug] = {
        legacy_id: move.legacyId, blueprint_aliases: entry.blueprint_aliases as Record<string, string>,
      };
    }
    const candidate = {
      version: 2,
      profile: registry.profile,
      domainEpicLimit: registry.domainEpicLimit,
      areas: registry.areas,
      ...(registry.areaPromotionThreshold === undefined
        ? {} : { areaPromotionThreshold: registry.areaPromotionThreshold }),
      epics: nextEpics,
    };
    const parsed = parseEpicRegistry(candidate);
    if (parsed.ok) nextRegistry = parsed.registry;
    else conflicts.push(`${REGISTRY_REL}: migrated registry would be invalid: ${parsed.message}`);
  } else {
    for (const move of epics) {
      aliases[move.slug] = {
        legacy_id: move.legacyId,
        blueprint_aliases: Object.fromEntries(move.blueprints.map((bp) => [bp.number, bp.slug])),
      };
    }
  }

  const moved: Move[] = [
    ...epics.map((e) => ({ from: e.from, to: e.to })),
    ...epics.flatMap((e) => e.blueprints.map((bp) => ({ from: bp.from, to: bp.to }))),
  ];
  return { epics, moved, conflicts, nextRegistry, aliases };
}

/** 원래 경로를 이동 후 경로로 바꾼다. blueprint 이동(더 긴 접두)을 epic 이동보다 먼저 본다. */
function makePathMapper(moves: Move[]): (rel: string) => string {
  const ordered = [...moves].sort((a, b) => b.from.length - a.from.length);
  return (rel) => {
    for (const m of ordered) {
      if (rel === m.from || rel.startsWith(`${m.from}/`)) return m.to + rel.slice(m.from.length);
    }
    return rel;
  };
}

/**
 * 한 문서 안의 markdown 링크 대상 하나를 이동 후 위치 기준 상대 경로로 다시 쓴다.
 * 문서 자신이 옮겨졌거나 대상이 옮겨졌을 때만 바꾸고, 그 밖의 링크는 원문 바이트를 유지한다.
 */
function rewriteLinkTarget(
  target: string,
  oldRel: string,
  newRel: string,
  mapPath: (rel: string) => string,
): string {
  // 외부 URL·앵커·절대 경로·퍼센트 인코딩 경로는 저장소 안 상대 링크가 아니라 건드리지 않는다.
  if (/^[a-z][a-z0-9+.-]*:/i.test(target) || /^[#/<]/.test(target) || target.includes('%')) return target;
  const split = /^([^#?]*)([#?].*)?$/.exec(target) as RegExpExecArray;
  const pathPart = split[1];
  const suffix = split[2] ?? '';
  if (pathPart === '') return target;
  const resolved = path.posix.normalize(path.posix.join(path.posix.dirname(oldRel), pathPart));
  if (resolved.startsWith('..')) return target;
  const mapped = mapPath(resolved);
  if (mapped === resolved && path.posix.dirname(oldRel) === path.posix.dirname(newRel)) return target;
  let rel = path.posix.relative(path.posix.dirname(newRel), mapped.replace(/\/$/, ''));
  if (rel === '') rel = '.';
  const stripSlash = (v: string) => v.replace(/\/$/, '');
  // 이동 후에도 같은 상대 표기면(예: 같은 이동 묶음 안의 링크) 원문을 그대로 둔다.
  if (stripSlash(rel) === stripSlash(path.posix.normalize(pathPart))) return target;
  if (pathPart.endsWith('/') && !rel.endsWith('/')) rel += '/';
  if (pathPart.startsWith('./') && !rel.startsWith('.')) rel = `./${rel}`;
  return rel + suffix;
}

/**
 * 같은 문자열 집합을 한 번의 패스로 치환한다. 순차 치환은 한 치환의 결과가 다른 키와 겹칠 때
 * 연쇄 치환을 일으키므로 쓰지 않는다. 키는 식별자/해시이므로 앞뒤가 영숫자인 부분 일치는 제외한다.
 */
function replaceAllOnce(text: string, pairs: Map<string, string>): string {
  if (pairs.size === 0) return text;
  const keys = [...pairs.keys()].sort((a, b) => b.length - a.length).map(escapeRegExp);
  const re = new RegExp(`(?<![A-Za-z0-9_-])(?:${keys.join('|')})(?![A-Za-z0-9_])`, 'g');
  return text.replace(re, (hit) => pairs.get(hit) ?? hit);
}

/**
 * 계획 문서(epic index·blueprint index·tasks.md)의 digest를 메모리 내용으로 계산한다.
 * plan-snapshot의 `computePlanSnapshot`과 같은 문서 집합·순서·정규화를 쓰되 디스크 대신 주어진 내용을 읽는다 —
 * 이관은 쓰기 전에 모든 값을 확정해야 하기 때문이다. 문서가 하나라도 없으면 null이다.
 */
function planDigestOf(
  epicIndex: string,
  blueprintDir: string,
  taskNumbers: string[],
  textOf: (rel: string) => string | undefined,
): string | null {
  const documents = [
    epicIndex,
    `${blueprintDir}/index.md`,
    ...taskNumbers.map((n) => `${blueprintDir}/tasks/${n}/tasks.md`),
  ];
  const content: Record<string, { body: string; structure: Record<string, unknown> }> = {};
  for (const rel of documents) {
    const text = textOf(rel);
    if (text === undefined) return null;
    const parsed = parseFrontmatter(text);
    const bouncer = isRecord(parsed.data) ? parsed.data.bouncer : undefined;
    content[rel] = { body: parsed.body, structure: normalizeStructure(structureKindOf(rel, blueprintDir), bouncer) };
  }
  return digestPlanContent(documents, content);
}

type DocContext = { epic: EpicMove; blueprint: BlueprintMove | null };

/** fingerprint 공식이 읽는 네 필드만 뽑는다. 공식 자체는 findingFingerprint 한 곳에 둔다. */
function fingerprintFields(finding: Record<string, unknown>) {
  return {
    category: finding.category, brief_clause: finding.brief_clause, file: finding.file, symbol: finding.symbol,
  };
}

/**
 * frontmatter의 식별자·경로·파생 해시를 새 형식으로 고친다. 텍스트 치환이 끝난 문서(`text`)를 받는다.
 * 값을 다시 계산하는 규칙은 하나다: **원본이 그 값을 만든 함수의 결과와 일치했을 때만** 다시 계산한다.
 * 이미 어긋난(변조·stale) 값을 새 값으로 덮으면 이관이 검증 실패를 숨기기 때문이다.
 *
 * @param {string} original - 이관 전 문서 원문
 * @param {string} text - 링크·경로·안정 ID 치환을 마친 문서
 * @param {DocContext} ctx - 문서가 속한 epic·blueprint 이동
 * @param {string} newRel - 이동 후 저장소 상대 경로
 * @returns {{ text: string, ids: Map<string,string>, evidence: [string,string] | null }}
 *   frontmatter가 없거나 bouncer 문서가 아니면 text를 그대로 돌려준다. ids는 문서 안 finding id 치환 표다
 */
function restructure(original: string, text: string, ctx: DocContext, newRel: string): {
  text: string; ids: Map<string, string>; evidence: [string, string] | null;
} {
  const ids = new Map<string, string>();
  let before: ReturnType<typeof parseFrontmatter>;
  let after: ReturnType<typeof parseFrontmatter>;
  try {
    before = parseFrontmatter(original);
    after = parseFrontmatter(text);
  } catch (error) {
    // frontmatter가 없는 자유 형식 md만 흡수한다. YAML 오류는 던져 쓰기 전에 이관을 멈춘다.
    if (error instanceof Error && error.message === 'missing frontmatter block') return { text, ids, evidence: null };
    throw error;
  }
  const doc = after.data;
  if (!isRecord(doc) || !isRecord(doc.bouncer)) return { text, ids, evidence: null };
  const oldBouncer = isRecord(before.data) && isRecord(before.data.bouncer) ? before.data.bouncer : {};
  let bouncer: Record<string, unknown> = doc.bouncer;
  const type = doc.type;
  const epicSlug = ctx.epic.slug;
  const bpSlug = ctx.blueprint?.slug;
  doc.resource = newRel;
  if (type === 'bouncer.epic') bouncer.id = epicSlug;
  if ('epic_id' in bouncer) bouncer.epic_id = epicSlug;
  if (bpSlug !== undefined && 'blueprint_id' in bouncer) bouncer.blueprint_id = bpSlug;
  if (bpSlug !== undefined && type === 'bouncer.blueprint') {
    bouncer.id = bpSlug;
    if (bouncer.order === undefined) {
      // order는 status 바로 뒤에 둔다(scaffold가 쓰는 위치와 같다).
      const withOrder: Record<string, unknown> = {};
      for (const [key, value] of Object.entries(bouncer)) {
        withOrder[key] = value;
        if (key === 'status') withOrder.order = (ctx.blueprint as BlueprintMove).order;
      }
      if (withOrder.order === undefined) withOrder.order = (ctx.blueprint as BlueprintMove).order;
      bouncer = withOrder;
      doc.bouncer = bouncer;
    }
  } else if (bpSlug !== undefined && ROOT_DOC_TYPES.includes(type as string)
    && !TASK_UNIT_DIR_RE.test(`/${newRel}`)) {
    // blueprint 루트 문서(review·explain·context-review)의 id는 접두 + blueprint key다.
    // tasks/<NNN>/ 묶음 문서는 task 번호가 id라 그대로 둔다.
    bouncer.id = `${(ID_PREFIX as Record<string, string>)[type as string]}${bpSlug}`;
  }

  // evidence_id: identity 안의 scope.key가 새 형식이 되었으므로 같은 함수로 다시 계산한다.
  let evidence: [string, string] | null = null;
  const verification = bouncer.verification;
  const oldVerification = oldBouncer.verification;
  if (isRecord(verification) && isRecord(verification.identity) && typeof verification.evidence_id === 'string'
    && isRecord(oldVerification) && isRecord(oldVerification.identity)
    && sha256Canonical(oldVerification.identity) === verification.evidence_id) {
    const next = sha256Canonical(verification.identity);
    if (next !== verification.evidence_id) evidence = [verification.evidence_id, next];
    verification.evidence_id = next;
  }

  // finding fingerprint·자동 id: file 경로가 바뀌면 fingerprint 입력이 바뀐다. 사람이 정한 id는 그대로 둔다.
  for (const [key, namespace] of [['review', undefined], ['context_review', 'context']] as const) {
    const oldSection = oldBouncer[key];
    const newSection = bouncer[key];
    if (!isRecord(oldSection) || !isRecord(newSection)) continue;
    const oldFindings = Array.isArray(oldSection.findings) ? oldSection.findings : [];
    const newFindings = Array.isArray(newSection.findings) ? newSection.findings : [];
    newFindings.forEach((finding, index) => {
      const old = oldFindings[index];
      if (!isRecord(finding) || !isRecord(old) || typeof old.fingerprint !== 'string') return;
      const oldFp = findingFingerprint(fingerprintFields(old), namespace);
      if (old.fingerprint !== oldFp) return;
      const newFp = findingFingerprint(fingerprintFields(finding), namespace);
      finding.fingerprint = newFp;
      if (old.id === findingAutoId(oldFp, namespace)) {
        const newId = findingAutoId(newFp, namespace);
        if (newId !== old.id) {
          ids.set(old.id as string, newId);
          finding.id = newId;
        }
      }
    });
  }
  return { text: renderDoc(doc, after.body), ids, evidence };
}

/**
 * 모든 문서 변경을 메모리에서 계산한다. 디스크는 읽기만 한다.
 *
 * @param {object} opts - 입력
 * @param {string} opts.repoRoot - 저장소 루트 절대 경로
 * @param {MigrationPlan} opts.plan - 이동 계획(충돌 없음)
 * @param {Deps} opts.deps - runGit·fs
 * @returns {Rewrite[]} 문서별 이관 전/후 내용. 내용이 같으면 text === original
 */
function computeRewrites({ repoRoot, plan, runGit, fsApi }: {
  repoRoot: string;
  plan: MigrationPlan;
  runGit: (args: string[]) => { stdout: string };
  fsApi: InjectedFs;
}): Rewrite[] {
  const mapPath = makePathMapper(plan.moved);
  const tracked = runGit(['ls-files', '-z', '--', '*.md']).stdout.split('\0').filter((p) => p !== '');
  const originals = new Map<string, string>();
  for (const rel of tracked) originals.set(rel, fsApi.readFileSync(path.join(repoRoot, rel), 'utf8') as string);

  const pathRe = plan.moved.length === 0 ? null : new RegExp(
    `(?:${[...plan.moved].sort((a, b) => b.from.length - a.from.length)
      .map((m) => escapeRegExp(m.from)).join('|')})(?![A-Za-z0-9_-])`,
    'g',
  );
  const idRegistry = plan.nextRegistry;
  const contextOf = (rel: string): DocContext | null => {
    for (const epic of plan.epics) {
      if (rel !== epic.from && !rel.startsWith(`${epic.from}/`)) continue;
      const blueprint = epic.blueprints.find((bp) => rel === bp.from || rel.startsWith(`${bp.from}/`)) ?? null;
      return { epic, blueprint };
    }
    return null;
  };

  // 1. 텍스트 수준 치환: 상대 링크 → 전체 경로 문자열 → (context 문서만) 안정 ID.
  const staged = new Map<string, Rewrite & { ctx: DocContext | null }>();
  for (const [oldRel, original] of originals) {
    const newRel = mapPath(oldRel);
    let text = original
      .replace(/(\]\()([^)\s]+)((?:\s+"[^"]*")?\))/g, (_m, open, target, close) => (
        `${open}${rewriteLinkTarget(target, oldRel, newRel, mapPath)}${close}`))
      .replace(/^(\[[^\]\n]+\]:\s*)(\S+)/gm, (_m, open, target) => (
        `${open}${rewriteLinkTarget(target, oldRel, newRel, mapPath)}`));
    if (pathRe !== null) text = text.replace(pathRe, (hit) => mapPath(hit));
    if (oldRel.startsWith(`${CONTEXT_ROOT}/`)) {
      text = text.replace(OLD_STABLE_RE, (hit) => normalizeStableId(hit, idRegistry) ?? hit);
    }
    staged.set(oldRel, { oldRel, newRel, original, text, ctx: contextOf(oldRel) });
  }

  // 2. 번들 색인: epic 행의 라벨·링크를 새 형식으로 다시 만든다(S13은 링크와 요약만 비교하지만 라벨도 맞춘다).
  const indexEntry = staged.get(CONTEXT_INDEX_REL);
  if (indexEntry) {
    for (const epic of plan.epics) {
      const row = new RegExp(`^\\* \\[[^\\]\\n]*\\]\\(epics/${escapeRegExp(epic.slug)}/index\\.md\\) - (.*)$`, 'm');
      indexEntry.text = indexEntry.text.replace(row, (_m, description) => (
        formatEpicIndexLine({ name: epic.slug, description })));
    }
  }

  // 3. 이관 대상 문서의 frontmatter·파생 해시. 계획 문서(epic index·blueprint index·tasks.md)를 먼저
  //    확정해야 digest·brief hash를 계산할 수 있으므로 계획 문서와 증적 문서를 나눠 처리한다.
  const isPlanDoc = (e: { newRel: string; ctx: DocContext | null }) => {
    if (e.ctx === null) return false;
    return e.newRel === `${e.ctx.epic.to}/index.md`
      || e.newRel === `${e.ctx.blueprint?.to}/index.md`
      || TASK_DOC_RE.test(e.newRel);
  };
  const evidencePairs = new Map<string, string>();
  const docIds = new Map<string, Map<string, string>>();
  for (const entry of staged.values()) {
    if (entry.ctx === null) continue;
    const done = restructure(entry.original, entry.text, entry.ctx, entry.newRel);
    entry.text = done.text;
    docIds.set(entry.oldRel, done.ids);
    if (done.evidence) evidencePairs.set(done.evidence[0], done.evidence[1]);
  }

  // 4. blueprint별 해시 쌍(계획 digest, task brief hash)을 계산해 증적 문서에 반영한다.
  const newTextByRel = new Map([...staged.values()].map((e) => [e.newRel, e.text]));
  const oldTextByRel = originals;
  for (const epic of plan.epics) {
    for (const bp of epic.blueprints) {
      const taskNumbers = [...staged.values()]
        .map((e) => TASK_DOC_RE.exec(e.oldRel))
        .filter((m): m is RegExpExecArray => m !== null && m[1] === bp.from)
        .map((m) => m[2]).sort();
      const pairs = new Map<string, string>();
      const oldDigest = planDigestOf(`${epic.from}/index.md`, bp.from, taskNumbers, (rel) => oldTextByRel.get(rel));
      const newDigest = planDigestOf(`${epic.to}/index.md`, bp.to, taskNumbers, (rel) => newTextByRel.get(rel));
      if (oldDigest !== null && newDigest !== null && oldDigest !== newDigest) pairs.set(oldDigest, newDigest);
      for (const n of taskNumbers) {
        const oldHash = taskBriefHash(oldTextByRel.get(`${bp.from}/tasks/${n}/tasks.md`) as string);
        const newHash = taskBriefHash(newTextByRel.get(`${bp.to}/tasks/${n}/tasks.md`) as string);
        if (oldHash !== newHash) pairs.set(oldHash, newHash);
      }
      for (const entry of staged.values()) {
        if (entry.ctx?.blueprint !== bp || isPlanDoc(entry)) continue;
        const local = new Map([...pairs, ...evidencePairs, ...(docIds.get(entry.oldRel) ?? [])]);
        entry.text = replaceAllOnce(entry.text, local);
      }
    }
  }
  return [...staged.values()].map(({ oldRel, newRel, original, text }) => ({ oldRel, newRel, original, text }));
}

/** 임시 파일에 쓰고 rename해 등록부가 반쯤 써진 채 남지 않게 한다(주입한 fs로 쓴다). */
function writeRegistryAtomically(fsApi: InjectedFs, repoRoot: string, registry: EpicRegistry): void {
  const file = path.join(repoRoot, REGISTRY_REL);
  const temporary = `${file}.${process.pid}.tmp`;
  fsApi.writeFileSync(temporary, serializeEpicRegistry(registry));
  fsApi.renameSync(temporary, file);
}

/**
 * 번호 형식 epic·blueprint를 slug 형식으로 이관한다. `yes`가 없으면 계획만 돌려준다(dry-run).
 * 거절(dirty 트리·진행 중 상태·slug 충돌·등록부 문제)은 어떤 쓰기·`git mv` 전에 끝난다.
 * 쓰기 단계의 예외는 자동 롤백 없이 되돌리는 명령을 `next`에 담아 돌려준다.
 *
 * @param {object} opts - 입력
 * @param {string} opts.repoRoot - 저장소 루트 절대 경로
 * @param {boolean} [opts.yes] - true면 실제로 옮긴다
 * @param {Partial<Deps>} [opts.deps] - 테스트 seam. `runGit`·`fs`·`listInProgress`
 * @returns {MigrationResult} 성공(moved·rewritten·aliases·validate) 또는 거절(code·message·next·blockers)
 */
function migrateContextSlugs({ repoRoot, yes = false, deps }: {
  repoRoot: string;
  yes?: boolean;
  deps?: Partial<Deps>;
}): MigrationResult {
  const fsApi = deps?.fs ?? nodeFs;
  const runGit = deps?.runGit ?? defaultRunGit(repoRoot);
  const read = readEpicRegistry(repoRoot);
  if (read.status === 'invalid') {
    return failure('S35', `epic registry is invalid: ${read.message}`, `fix ${REGISTRY_REL}, then retry`);
  }
  const registry = read.status === 'ok' ? read.registry : null;
  const plan = planContextSlugMigration({ repoRoot, registry, deps: { fs: fsApi } });
  // 옮길 번호 디렉터리가 없으면 거절 검사 없이 성공이다. 이관 직후(작업 트리가 더러운 상태)의 재실행이
  // dirty 거절에 걸리면 "두 번째 실행은 moved: []인 성공"이라는 멱등 계약이 깨진다.
  if (plan.epics.length === 0) {
    return { ok: true, dryRun: !yes, moved: [], rewritten: [], aliases: {}, validate: [] };
  }
  if (registry === null) {
    return failure(
      'migrate-registry-missing',
      `${REGISTRY_REL} is missing; the registry records the aliases the migration must write`,
      'run bouncer init to create the registry, then retry',
    );
  }
  if (runGit(['status', '--porcelain']).stdout.trim() !== '') {
    return failure(
      'migrate-dirty-tree',
      'the working tree has uncommitted changes',
      'commit or stash every change (git status --porcelain must be empty), then retry',
    );
  }
  const inProgress = (deps?.listInProgress ?? (() => defaultListInProgress({ repoRoot, runGit, fsApi })))();
  if (inProgress.length > 0) {
    return failure(
      'migrate-in-progress',
      `${inProgress.length} in-progress runtime item(s) hold the old path keys`,
      'finish or discard the pointer, approvals, coordinator ledger and linked worktrees listed in blockers, '
        + 'then retry',
      { blockers: inProgress },
    );
  }
  if (plan.conflicts.length > 0) {
    return failure(
      'migrate-slug-conflict', plan.conflicts.join('; '), 'rename the conflicting directories, then retry',
    );
  }

  // 모든 문서 변경을 쓰기 전에 계산한다. 여기서 던지면(깨진 YAML 등) 디스크는 그대로다.
  const rewrites = computeRewrites({ repoRoot, plan, runGit, fsApi });
  const changed = rewrites.filter((r) => r.text !== r.original);
  const rewritten = changed.map((r) => r.newRel).sort();
  if (!yes) {
    return { ok: true, dryRun: true, moved: plan.moved, rewritten, aliases: plan.aliases, validate: [] };
  }

  try {
    // 1. epic 디렉터리를 먼저 옮기고, 그 안의 blueprint를 옮긴다(epic 이동 뒤의 경로 기준).
    for (const epic of plan.epics) runGit(['mv', epic.from, epic.to]);
    for (const epic of plan.epics) {
      for (const bp of epic.blueprints) runGit(['mv', `${epic.to}/blueprints/${path.posix.basename(bp.from)}`, bp.to]);
    }
    // 2. 문서 내용. git mv는 내용을 바꾸지 않으므로 이동한 자리(newRel)에 새 내용을 쓴다.
    for (const r of changed) fsApi.writeFileSync(path.join(repoRoot, r.newRel), r.text);
    // 3. 등록부(v2)는 문서 뒤에 쓴다 — 실패하면 문서만 새 형식인 상태가 남지만 restore 한 줄로 되돌린다.
    if (plan.nextRegistry !== null) writeRegistryAtomically(fsApi, repoRoot, plan.nextRegistry);
  } catch (error) {
    // 자동 롤백은 하지 않는다(답변 16). 어느 단계에서 던졌든 일부만 적용된 상태이므로, 모든 예외를
    // 같은 복구 안내로 접는다. 원인은 message에 그대로 싣는다.
    return failure('migrate-failed', catchMessage(error), RESTORE_NEXT, { moved: plan.moved, rewritten });
  }

  const validation: ValidateEntry[] = plan.epics.flatMap((e) => e.blueprints).map((bp) => {
    const result = validateBlueprint({ repoRoot, blueprintDir: bp.to });
    return { blueprint: bp.to, ok: result.ok, failures: result.failures };
  });
  const summary = { moved: plan.moved, rewritten, aliases: plan.aliases, validate: validation };
  if (validation.some((v) => !v.ok)) {
    return failure(
      'migrate-validate-failed',
      'bouncer validate reported failures for migrated blueprints; the moved files are kept',
      'fix the failures listed in validate (or restore with: git restore --staged --worktree .bouncer '
        + '&& git clean -fd .bouncer/context)',
      summary,
    );
  }
  return { ok: true, dryRun: false, ...summary };
}

export = { planContextSlugMigration, migrateContextSlugs, defaultListInProgress };
