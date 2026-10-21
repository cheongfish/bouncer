'use strict';
const path = require('node:path');
const { execFileSync } = require('node:child_process');
import guards = require('./guards');
const { isRecord } = guards;
import layout = require('./layout');
const { CONTEXT_ROOT } = layout;
import contextIds = require('./context-ids');
const { normalizeStableId } = contextIds;
import epicRegistry = require('./epic-registry');
const { serializeEpicRegistry, REGISTRY_REL } = epicRegistry;
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

// 문서 재작성 공용 모듈. `migrate context-slugs`(번호 → slug)와 legacy epic 병합(blueprint를 다른 epic으로 이동)이
// 같은 규칙을 쓰도록 한 곳에 둔다. 해시·식별자는 "원래 값이 그 값을 만든 공식의 결과와 같을 때만" 다시 계산한다 —
// 이미 어긋난(변조·stale) 값을 덮으면 이관이 검증 실패를 숨기기 때문이다.

type RegistryRead = ReturnType<typeof epicRegistry.readEpicRegistry>;
type EpicRegistry = Extract<RegistryRead, { status: 'ok' }>['registry'];
type InjectedFs = typeof import('node:fs');
type Move = { from: string; to: string };
type InProgressEntry = { kind: 'pointer' | 'approval' | 'ledger' | 'worktree'; path: string };
type Rewrite = { oldRel: string; newRel: string; original: string; text: string };
/** blueprint 하나의 이동. slug 이관의 번호(`number`) 같은 호출자 전용 필드는 구조적 하위 타입으로 얹는다. */
type BlueprintRef = { from: string; to: string; slug: string; order: number };
/**
 * 문서 하나가 속한 이동 맥락. `blueprint`가 null이면 epic 직속 문서다.
 * `orderMode`는 blueprint index의 `order`를 다루는 방식이다: `fill-missing`은 없을 때만 넣고(slug 이관),
 * `overwrite`는 병합 대상 epic 안에서 새로 매긴 값으로 항상 덮는다.
 */
type DocContext = {
  fromEpicDir: string;
  toEpicDir: string;
  epicSlug: string;
  blueprint: BlueprintRef | null;
  orderMode: 'fill-missing' | 'overwrite';
};
/** `computeRewrites`가 읽는 이동 계획. `contexts`는 문서가 속한 epic·blueprint 맥락 목록이다. */
type RewritePlan = { moved: Move[]; nextRegistry: EpicRegistry | null; contexts: DocContext[] };

const TASK_UNIT_DIR_RE = /\/tasks\/\d{3}\//;
// blueprint 루트에 놓일 수 있는 증적 문서 type. 구형 루트 tasks 문서는 id 규칙이 달라 여기 넣지 않는다.
const ROOT_DOC_TYPES = ['bouncer.review', 'bouncer.explain', 'bouncer.context_review'];
const TASK_DOC_RE = /^(.*)\/tasks\/(\d{3})\/tasks\.md$/;

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
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
  const epicSlug = ctx.epicSlug;
  const bpSlug = ctx.blueprint?.slug;
  doc.resource = newRel;
  if (type === 'bouncer.epic') bouncer.id = epicSlug;
  if ('epic_id' in bouncer) bouncer.epic_id = epicSlug;
  if (bpSlug !== undefined && 'blueprint_id' in bouncer) bouncer.blueprint_id = bpSlug;
  if (bpSlug !== undefined && type === 'bouncer.blueprint') {
    bouncer.id = bpSlug;
    const order = (ctx.blueprint as BlueprintRef).order;
    if (bouncer.order !== undefined && ctx.orderMode === 'overwrite') {
      // 병합은 대상 epic 안의 새 순번이 정본이라 기존 값을 덮는다. 키 위치는 그대로 유지된다.
      bouncer.order = order;
    } else if (bouncer.order === undefined) {
      // order는 status 바로 뒤에 둔다(scaffold가 쓰는 위치와 같다).
      const withOrder: Record<string, unknown> = {};
      for (const [key, value] of Object.entries(bouncer)) {
        withOrder[key] = value;
        if (key === 'status') withOrder.order = order;
      }
      if (withOrder.order === undefined) withOrder.order = order;
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
 * @param {RewritePlan} opts.plan - 이동 계획(충돌 없음)
 * @param {Deps} opts.deps - runGit·fs
 * @returns {Rewrite[]} 문서별 이관 전/후 내용. 내용이 같으면 text === original
 */
function computeRewrites({ repoRoot, plan, runGit, fsApi }: {
  repoRoot: string;
  plan: RewritePlan;
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
  // blueprint 맥락이 epic 직속 맥락보다 먼저 맞아야 하므로(더 구체적) 두 번에 나눠 찾는다.
  const contextOf = (rel: string): DocContext | null => {
    const inside = (dir: string) => rel === dir || rel.startsWith(`${dir}/`);
    return plan.contexts.find((c) => c.blueprint !== null && inside(c.blueprint.from))
      ?? plan.contexts.find((c) => c.blueprint === null && inside(c.fromEpicDir)) ?? null;
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
      text = contextIds.replaceOldStableIds(text, (hit) => normalizeStableId(hit, idRegistry) ?? hit);
    }
    staged.set(oldRel, { oldRel, newRel, original, text, ctx: contextOf(oldRel) });
  }

  // 2. 번들 색인: epic 행의 라벨·링크를 새 형식으로 다시 만든다(S13은 링크와 요약만 비교하지만 라벨도 맞춘다).
  const indexEntry = staged.get(CONTEXT_INDEX_REL);
  if (indexEntry) {
    for (const ctx of plan.contexts.filter((c) => c.blueprint === null)) {
      const row = new RegExp(`^\\* \\[[^\\]\\n]*\\]\\(epics/${escapeRegExp(ctx.epicSlug)}/index\\.md\\) - (.*)$`, 'm');
      indexEntry.text = indexEntry.text.replace(row, (_m, description) => (
        formatEpicIndexLine({ name: ctx.epicSlug, description })));
    }
  }

  // 3. 이관 대상 문서의 frontmatter·파생 해시. 계획 문서(epic index·blueprint index·tasks.md)를 먼저
  //    확정해야 digest·brief hash를 계산할 수 있으므로 계획 문서와 증적 문서를 나눠 처리한다.
  const isPlanDoc = (e: { newRel: string; ctx: DocContext | null }) => {
    if (e.ctx === null) return false;
    return e.newRel === `${e.ctx.toEpicDir}/index.md`
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
  for (const ctx of plan.contexts) {
    const bp = ctx.blueprint;
    if (bp === null) continue;
    const taskNumbers = [...staged.values()]
      .map((e) => TASK_DOC_RE.exec(e.oldRel))
      .filter((m): m is RegExpExecArray => m !== null && m[1] === bp.from)
      .map((m) => m[2]).sort();
    const pairs = new Map<string, string>();
    const oldDigest = planDigestOf(`${ctx.fromEpicDir}/index.md`, bp.from, taskNumbers, (rel) => oldTextByRel.get(rel));
    const newDigest = planDigestOf(`${ctx.toEpicDir}/index.md`, bp.to, taskNumbers, (rel) => newTextByRel.get(rel));
    if (oldDigest !== null && newDigest !== null && oldDigest !== newDigest) pairs.set(oldDigest, newDigest);
    for (const n of taskNumbers) {
      const oldHash = taskBriefHash(oldTextByRel.get(`${bp.from}/tasks/${n}/tasks.md`) as string);
      const newHash = taskBriefHash(newTextByRel.get(`${bp.to}/tasks/${n}/tasks.md`) as string);
      if (oldHash !== newHash) pairs.set(oldHash, newHash);
    }
    for (const entry of staged.values()) {
      if (entry.ctx !== ctx || isPlanDoc(entry)) continue;
      const local = new Map([...pairs, ...evidencePairs, ...(docIds.get(entry.oldRel) ?? [])]);
      entry.text = replaceAllOnce(entry.text, local);
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

export = {
  defaultRunGit, defaultListInProgress, makePathMapper, rewriteLinkTarget,
  replaceAllOnce, planDigestOf, restructure, computeRewrites, writeRegistryAtomically,
};
