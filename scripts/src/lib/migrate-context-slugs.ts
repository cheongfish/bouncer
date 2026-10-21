'use strict';
const nodeFs = require('node:fs');
const path = require('node:path');
import guards = require('./guards');
const { catchMessage } = guards;
import layout = require('./layout');
const { CONTEXT_ROOT } = layout;
import contextIds = require('./context-ids');
const { parseContextPath, validateSlug } = contextIds;
import epicRegistry = require('./epic-registry');
const { readEpicRegistry, parseEpicRegistry, REGISTRY_REL } = epicRegistry;
import rewriteModule = require('./context-migration-rewrite');
const {
  defaultRunGit, defaultListInProgress, computeRewrites, writeRegistryAtomically,
} = rewriteModule;
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

const RESTORE_NEXT = 'git restore --staged --worktree .bouncer && git clean -fd .bouncer/context';

function failure(
  code: string,
  message: string,
  next: string,
  extra: Partial<MigrationFailure> = {},
): MigrationFailure {
  return { ok: false, code, message, next, ...extra };
}

/**
 * slug 이관 계획을 문서 재작성 공용 모듈의 이동 맥락 목록으로 바꾼다. epic마다 직속 문서용 맥락 하나와
 * blueprint마다 맥락 하나를 내며, `order`는 번호에서 온 값을 frontmatter에 없을 때만 채운다(`fill-missing`).
 *
 * @param {MigrationPlan} plan - 충돌 없는 이동 계획
 * @returns 공용 모듈 `computeRewrites`의 `plan.contexts`
 */
function rewriteContextsOf(plan: MigrationPlan) {
  return plan.epics.flatMap((epic) => {
    const base = {
      fromEpicDir: epic.from, toEpicDir: epic.to, epicSlug: epic.slug, orderMode: 'fill-missing' as const,
    };
    return [
      { ...base, blueprint: null },
      ...epic.blueprints.map((bp) => ({
        ...base, blueprint: { from: bp.from, to: bp.to, slug: bp.slug, order: bp.order },
      })),
    ];
  });
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
  const rewrites = computeRewrites({
    repoRoot,
    plan: { moved: plan.moved, nextRegistry: plan.nextRegistry, contexts: rewriteContextsOf(plan) },
    runGit,
    fsApi,
  });
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
