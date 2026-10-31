'use strict';

import fs = require('node:fs');
import path = require('node:path');
import { spawnSync } from 'node:child_process';
import frontmatter = require('./frontmatter');
const { parseFrontmatter } = frontmatter;

import contextIds = require('./context-ids');
const { parseContextPath, formatStableTaskId, formatLegacyEpicId, formatLegacyBlueprintId } = contextIds;

// 경로 모양만 거른다. 세그먼트가 번호(`NNN-slug`)인지 slug인지, 두 세그먼트의 형식이 같은지는
// parseContextPath 한 곳에서 판정한다(`layoutOf`). 정규식에 형식 규칙을 복제하면 두 곳이 갈라진다.
const EPIC_SHAPE = /^\.bouncer\/context\/epics\/[^/]+\/index\.md$/;
const BP_SHAPE = /^\.bouncer\/context\/epics\/[^/]+\/blueprints\/[^/]+\/index\.md$/;
const EXPLAIN_SHAPE = /^\.bouncer\/context\/epics\/[^/]+\/blueprints\/[^/]+\/explain\.md$/;
const TASK_SHAPE = /^\.bouncer\/context\/epics\/[^/]+\/blueprints\/[^/]+\/tasks\/(\d{3})\/tasks\.md$/;
type Layout = {
  format: 'numeric' | 'slug'; epicKey: string; blueprintKey: string | null; taskNum: string | null;
};

/**
 * 경로가 모양 정규식과 세그먼트 규칙을 모두 만족하면 key와 형식을 돌려준다.
 *
 * @param {string} p - 저장소 상대 posix 경로
 * @param {RegExp} shape - 문서 종류별 모양 정규식(task는 첫 캡처가 task 번호)
 * @returns {Layout | null} 해석 결과. 모양이 다르거나 세그먼트 규칙을 어기면 null
 */
function layoutOf(p: string, shape: RegExp): Layout | null {
  const match = shape.exec(p);
  const ids = match ? parseContextPath(p) : null;
  if (!match || !ids) return null;
  return { format: ids.format, epicKey: ids.epicKey, blueprintKey: ids.blueprintKey, taskNum: match[1] ?? null };
}

// 문서 경로 목록에서 같은 epic·blueprint key를 가진 경로를 찾는다. 번호/slug 디렉터리 접두 비교 대신
// 해석된 key로 비교해 두 형식이 같은 코드를 탄다.
function sameBlueprint(p: string, epicKey: string, blueprintKey: string): boolean {
  const ids = parseContextPath(p);
  return ids !== null && ids.epicKey === epicKey && ids.blueprintKey === blueprintKey;
}
const SKIP = new Set(['.git', 'node_modules', '.worktrees', 'review', 'reviews', 'verification', 'verifications']);
const TOKEN = /`([^`\n]+)`/g;

type Evidence = { source: string; line: number; kind: string; sha?: string };
type Warning = { code: string; source: string; line: number; detail: string };
type Doc = {
  id: string;
  kind: string;
  status: string;
  data: Record<string, unknown>;
  body: string;
  bodyLineOffset: number;
};
type Ontology = {
  version: 1;
  repoRoot: string;
  documents: Doc[];
  entities: Map<string, Set<string>>;
  files: Map<string, Set<string>>;
  entityEvidence: Map<string, Map<string, Evidence[]>>;
  fileEvidence: Map<string, Map<string, Evidence[]>>;
  nodes?: {
    documents: Doc[];
    entities: { token: string; kind: string }[];
    files: { path: string }[];
  };
  relationships?: { kind: string; from: string; to: string; evidence: Evidence[] }[];
  warnings: Warning[];
};
type Query = { mode: 'entity' | 'file' | 'impact'; value: string; limit?: number };
type Result = {
  blueprint: string;
  status: string;
  via: string[];
  entities: string[];
  files: string[];
  evidence: Evidence[];
};

/**
 * 현재 Git checkout의 canonical 컨텍스트 문서에서 출처를 보존한 검색 색인을 만든다.
 * 읽기 실패는 숨기지 않으며, 문서별 형식 오류는 해당 문서만 경고 후 제외한다.
 *
 * @param {{repoRoot: string}} input - 현재 checkout의 절대 경로
 * @returns {Ontology} 문서, 연결, 출처, 경고를 담은 새 색인
 */
function loadContextOntology(input: { repoRoot: string }): Ontology {
  const rootArg = typeof input?.repoRoot === 'string' ? input.repoRoot : '';
  if (!rootArg || !path.isAbsolute(rootArg)) throw inputError('repoRoot must be an absolute path');
  let root: string;
  try {
    root = fs.realpathSync(rootArg);
  } catch (error) {
    throw ioError('cannot resolve repoRoot', error);
  }
  const git = runGit(root, ['rev-parse', '--show-toplevel']);
  if (git.status !== 0) throw inputError('repoRoot is not a Git checkout');
  let gitRoot: string;
  try {
    gitRoot = fs.realpathSync(git.stdout.trim());
  } catch (error) {
    throw ioError('cannot resolve Git root', error);
  }
  if (root !== gitRoot) throw inputError('repoRoot must be the current checkout root');

  const index: Ontology = {
    version: 1,
    repoRoot: root,
    documents: [],
    entities: new Map(),
    files: new Map(),
    entityEvidence: new Map(),
    fileEvidence: new Map(),
    warnings: [],
  };
  const paths = walkContext(root, index.warnings);
  const epicPaths = paths.filter((p) => layoutOf(p, EPIC_SHAPE));
  const bpPaths = paths.filter((p) => layoutOf(p, BP_SHAPE));
  const explainPaths = paths.filter((p) => layoutOf(p, EXPLAIN_SHAPE));
  const taskPaths = paths.filter((p) => layoutOf(p, TASK_SHAPE));
  const acceptedPaths = new Set([...epicPaths, ...bpPaths, ...explainPaths, ...taskPaths]);
  for (const source of paths) {
    if (!acceptedPaths.has(source)) {
      warn(index, 'path-rejected', source, 0, 'document path is outside the canonical context layout');
    }
  }
  const tasksByBp = new Map<string, string[]>();
  for (const taskPath of taskPaths) {
    const at = layoutOf(taskPath, TASK_SHAPE)!;
    const bp = bpPaths.find((p) => sameBlueprint(p, at.epicKey, at.blueprintKey!));
    if (bp) tasksByBp.set(bp, [...(tasksByBp.get(bp) ?? []), taskPath]);
  }
  const docs = new Map<string, Doc>();
  for (const source of [...epicPaths, ...bpPaths, ...[...tasksByBp.values()].flat(), ...explainPaths].sort(compare)) {
    const parsed = readContextDoc(root, source, index.warnings);
    if (parsed) docs.set(source, parsed);
  }
  const epics = new Map<string, Doc>();
  for (const source of epicPaths) {
    const doc = docs.get(source); if (!doc) continue;
    const at = layoutOf(source, EPIC_SHAPE)!;
    const id = at.epicKey;
    // 번호 epic의 bouncer.id는 `EPIC-NNN`, slug epic은 epic slug 자체다.
    const expectedId = at.format === 'numeric' ? formatLegacyEpicId(id) : id;
    if (doc.data.type !== 'bouncer.epic' || nested(doc.data, 'bouncer', 'id') !== expectedId) {
      warn(index, 'document-invalid', source, 0, 'epic identity does not match canonical path'); continue;
    }
    epics.set(id, { ...doc, id: source, kind: 'epic' });
  }
  const blueprintDocs = new Map<string, Doc>();
  for (const source of bpPaths) {
    const doc = docs.get(source); if (!doc) continue;
    const at = layoutOf(source, BP_SHAPE)!;
    const epicId = at.epicKey;
    const bpId = at.blueprintKey!;
    // 번호 blueprint의 bouncer.id는 `EPIC-NNN/BP-NNN`, slug blueprint는 blueprint slug 자체다.
    const expectedId = at.format === 'numeric' ? formatLegacyBlueprintId(epicId, bpId) : bpId;
    if (
      doc.data.type !== 'bouncer.blueprint' ||
      nested(doc.data, 'bouncer', 'id') !== expectedId ||
      !epics.has(epicId)
    ) {
      warn(index, 'document-invalid', source, 0, 'blueprint identity does not match canonical path or epic'); continue;
    }
    blueprintDocs.set(source, { ...doc, id: source, kind: 'blueprint' });
    index.documents.push({ ...doc, id: source, kind: 'blueprint' });
  }
  index.documents.push(...epics.values());
  for (const [source, doc] of docs) if (layoutOf(source, TASK_SHAPE)) {
    const at = layoutOf(source, TASK_SHAPE)!;
    const epicId = at.epicKey;
    const bpId = at.blueprintKey!;
    const taskNum = at.taskNum!;
    const parent = [...blueprintDocs.keys()].find((p) => sameBlueprint(p, epicId, bpId));
    const stable = formatStableTaskId({ format: at.format, epicKey: epicId, blueprintKey: bpId, task: taskNum });
    if (
      !parent ||
      doc.data.type !== 'bouncer.tasks' ||
      nested(doc.data, 'bouncer', 'id') !== `TASKS-${taskNum}` ||
      nested(doc.data, 'bouncer', 'epic_id') !== epicId ||
      nested(doc.data, 'bouncer', 'blueprint_id') !== bpId
    ) {
      warn(index, 'document-invalid', source, 0, 'task identity does not match canonical path'); continue;
    }
    const taskDoc = { ...doc, id: source, kind: 'task' };
    index.documents.push(taskDoc);
    const affected = nested(doc.data, 'bouncer', 'affected_paths');
    if (Array.isArray(affected)) {
      for (const item of affected) {
        if (typeof item === 'string') {
          addPath(index, parent, item, source, lineOfValue(doc.body, item, 0) + doc.bodyLineOffset, 'affected_path');
        }
      }
    }
    extractSectionPaths(index, parent, source, doc.body, '#### Touch', 'touch', doc.bodyLineOffset);
    void stable;
  }
  for (const source of explainPaths) {
    const doc = docs.get(source); if (!doc) continue;
    const at = layoutOf(source, EXPLAIN_SHAPE)!;
    const epicId = at.epicKey;
    const bpId = at.blueprintKey!;
    const parent = [...blueprintDocs.keys()].find((p) => sameBlueprint(p, epicId, bpId));
    if (!parent) continue;
    extractSectionPaths(index, parent, source, doc.body, '## Code', 'touch', doc.bodyLineOffset);
    extractContract(index, parent, source, doc.body, doc.bodyLineOffset);
    parseCommitRows(index, parent, source, doc, epicId, bpId, at.format);
  }
  for (const [bpPath, doc] of blueprintDocs) {
    extractContract(index, bpPath, bpPath, doc.body, doc.bodyLineOffset);
  }
  index.documents.sort((a, b) => compare(a.id, b.id));
  const relationships: NonNullable<Ontology['relationships']> = [];
  for (const doc of index.documents) {
    const parent = doc.kind === 'blueprint'
      ? [...epics.entries()].find(([id]) => parseContextPath(doc.id)?.epicKey === id)?.[1].id
      : doc.kind === 'task'
        ? doc.id.replace(/\/tasks\/\d{3}\/tasks\.md$/, '/index.md')
        : undefined;
    if (parent) {
      relationships.push({
        kind: 'contains',
        from: parent,
        to: doc.id,
        evidence: [evidence(doc.id, 1, 'affected_path')],
      });
    }
  }
  for (const [bp, values] of index.entityEvidence) {
    for (const [token, ev] of values) {
      relationships.push({ kind: 'mentions', from: bp, to: token, evidence: uniqueEvidence(ev) });
    }
  }
  for (const [bp, values] of index.fileEvidence) {
    for (const [file, ev] of values) {
      relationships.push({ kind: 'touches', from: bp, to: file, evidence: uniqueEvidence(ev) });
    }
  }
  for (const [kind, map] of [['shares_entity', index.entities], ['shares_file', index.files]] as const) {
    for (const [value, bps] of map) {
      const ordered = [...bps].sort(compare);
      for (let i = 0; i < ordered.length; i++) {
        for (let j = i + 1; j < ordered.length; j++) {
          const sourceMap = kind === 'shares_entity' ? index.entityEvidence : index.fileEvidence;
          const evidenceItems = [
            ...(sourceMap.get(ordered[i])?.get(value) ?? []),
            ...(sourceMap.get(ordered[j])?.get(value) ?? []),
          ];
          relationships.push({
            kind,
            from: ordered[i],
            to: ordered[j],
            evidence: uniqueEvidence(evidenceItems),
          });
        }
      }
    }
  }
  index.nodes = {
    documents: index.documents,
    entities: [...index.entities.keys()].sort(compare).map((token) => ({
      token,
      kind: token.startsWith('G') && /^G\d+$/.test(token)
        ? 'gate'
        : token.startsWith('--')
          ? 'flag'
          : token.includes('/') ? 'path' : 'identifier',
    })),
    files: [...index.files.keys()].sort(compare).map((file) => ({ path: file })),
  };
  index.relationships = relationships.sort((a, b) =>
    compare(a.kind, b.kind) || compare(a.from, b.from) || compare(a.to, b.to),
  );
  index.warnings = uniqueWarnings(index.warnings);
  return index;
}

/**
 * 색인에서 정확 엔티티·파일 일치 또는 한 단계 영향 결과를 결정적으로 반환한다.
 * file·impact는 git --follow 이름 집합의 합집합을 쓰고, 색인 자체는 변경하지 않는다.
 *
 * @param {Ontology} index - loadContextOntology가 반환한 색인
 * @param {Query} query - entity, file, impact 중 하나와 검색 값
 * @returns {object} 정렬 및 limit 처리된 응답과 경고
 */
function queryContextOntology(index: Ontology, query: Query): object {
  if (!index || index.version !== 1 || !Array.isArray(index.documents)) {
    throw inputError('invalid ontology index');
  }
  if (!query || !['entity', 'file', 'impact'].includes(query.mode)) {
    throw inputError('unknown query mode');
  }
  const limit = query.limit === undefined ? 20 : query.limit;
  if (!Number.isInteger(limit) || limit < 1 || limit > 100) {
    throw inputError('limit must be an integer from 1 to 100');
  }
  const hasNonAscii = typeof query.value === 'string' &&
    [...query.value].some((char) => char.charCodeAt(0) > 0x7f);
  if (
    typeof query.value !== 'string' || !query.value ||
    (query.mode === 'entity' && (hasNonAscii || /\s/.test(query.value)))
  ) throw inputError('invalid entity token');
  if (query.mode !== 'entity') validateFileQuery(query.value);
  // 이름 집합은 질의마다 계산한다. 색인·모듈 캐시에 넣으면 커밋 사이 이력이 고정된다.
  const names = query.mode === 'entity'
    ? [query.value]
    : collectRenameNames(index.repoRoot, query.value);
  const aliases = query.mode === 'entity'
    ? []
    : names.filter((name) => name !== query.value).sort(compare);
  const matching = query.mode === 'entity'
    ? index.entities.get(query.value)
    : unionFileMatches(index, names);
  const direct = new Set(matching ?? []);
  let selected = direct;
  const via = new Map<string, string[]>();
  const evidenceByBp = new Map<string, Evidence[]>();
  if (query.mode === 'impact') {
    const starts = [...direct];
    for (const bp of starts) {
      via.set(bp, [bp]);
      evidenceByBp.set(bp, unionFileEvidence(index, bp, names));
    }
    const expanded = new Set<string>(starts);
    const startSet = new Set(starts);
    const link = (start: string, other: string, startEv: Evidence[], otherEv: Evidence[]): void => {
      // 시작점끼리는 각자 직접 일치이므로 이웃으로 다시 연결하지 않는다.
      if (startSet.has(other)) return;
      expanded.add(other);
      // 이웃은 연결된 시작점을 모두 via에 싣고, 연결마다의 근거를 합친다.
      const vias = via.get(other) ?? [];
      if (!vias.includes(start)) vias.push(start);
      via.set(other, vias);
      evidenceByBp.set(other, [...(evidenceByBp.get(other) ?? []), ...startEv, ...otherEv]);
    };
    for (const bp of starts) {
      // 시작점마다 그 bp가 가진 토큰·파일만 확장한다. 합집합 전체를 쓰면
      // 현재 이름 bp가 과거 이름 이웃의 via를 가로챈다.
      for (const [token, bps] of index.entities) {
        if (!bps.has(bp)) continue;
        for (const other of bps) {
          link(bp, other, index.entityEvidence.get(bp)?.get(token) ?? [], index.entityEvidence.get(other)?.get(token) ?? []);
        }
      }
      for (const [file, bps] of index.files) {
        if (!bps.has(bp)) continue;
        for (const other of bps) {
          link(bp, other, index.fileEvidence.get(bp)?.get(file) ?? [], index.fileEvidence.get(other)?.get(file) ?? []);
        }
      }
    }
    selected = expanded;
  }
  const all = [...selected].sort(compare);
  const results: Result[] = all.map((bp) => ({
    blueprint: bp,
    status: index.documents.find((d) => d.id === bp)?.status ?? 'unknown',
    via: query.mode === 'impact' ? (via.get(bp) ?? []).sort(compare) : [bp],
    entities: [...index.entities].filter(([, bps]) => bps.has(bp)).map(([token]) => token).sort(compare),
    files: [...index.files].filter(([, bps]) => bps.has(bp)).map(([file]) => file).sort(compare),
    evidence: uniqueEvidence(
      query.mode === 'impact'
        ? evidenceByBp.get(bp) ?? []
        : query.mode === 'entity'
          ? index.entityEvidence.get(bp)?.get(query.value) ?? []
          : unionFileEvidence(index, bp, names),
    ),
  }));
  const limited = results.slice(0, limit);
  return {
    version: 1,
    query: { mode: query.mode, value: query.value, limit },
    results: limited,
    total: results.length,
    truncated: results.length > limited.length,
    aliases,
    warnings: uniqueWarnings(index.warnings),
  };
}

/**
 * 질의 경로 P의 git --follow 이름 집합 N(P)를 구한다.
 * unborn HEAD와 blob이 아닌 경로에서 log가 128/오류로 떨어지는 것을 질의 실패로
 * 올리지 않기 위해, 그 경우는 P 한 키로 접는다. 옛 이름 → 새 이름은 추적하지 않는다.
 *
 * @param {string} repoRoot - 색인의 저장소 루트
 * @param {string} queryPath - validateFileQuery를 통과한 저장소 상대 경로 P
 * @returns {string[]} P를 포함한 이름 목록(등장 순, 중복 제거)
 */
function collectRenameNames(repoRoot: string, queryPath: string): string[] {
  // 1. 커밋이 없으면 log --follow가 128로 끝나 ontology-io-failed가 되므로 여기서 접는다.
  const head = runGit(repoRoot, ['rev-parse', '--verify', '--quiet', 'HEAD']);
  if (head.status === 1) return [queryPath];
  if (head.status !== 0) throw ioError('git rev-parse failed for HEAD', head);
  // 2. 디렉터리·없는 경로·pathspec 문법은 blob이 아니다. follow가 하위 파일을 끌어오거나
  // magic을 해석하기 전에 한 키 조회로 막는다.
  const objectType = runGit(repoRoot, ['cat-file', '-t', `HEAD:${queryPath}`]);
  if (objectType.status !== 0 || objectType.stdout.trim() !== 'blob') return [queryPath];
  // 3. --literal-pathspecs는 log 앞 전역 옵션이다. P를 magic 없는 리터럴로 넘긴다.
  const logged = runGit(repoRoot, [
    '--literal-pathspecs',
    'log',
    '--follow',
    '--name-only',
    '-M',
    '-z',
    '--format=',
    '--',
    queryPath,
  ]);
  if (logged.status !== 0) throw ioError(`git log failed for ${queryPath}`, logged);
  const names: string[] = [];
  const seen = new Set<string>();
  for (const part of logged.stdout.split('\0')) {
    if (!part || seen.has(part)) continue;
    seen.add(part);
    names.push(part);
  }
  if (!seen.has(queryPath)) names.push(queryPath);
  return names;
}

/**
 * N(P) 각 이름이 가리키는 blueprint를 합친다. 기록 키는 문서 문자열 그대로 둔다.
 *
 * @param {Ontology} index - 파일 맵을 가진 색인
 * @param {string[]} names - 질의 경로의 이름 집합
 * @returns {Set<string>} 일치 blueprint 경로 집합
 */
function unionFileMatches(index: Ontology, names: string[]): Set<string> {
  const matching = new Set<string>();
  for (const name of names) {
    for (const bp of index.files.get(name) ?? []) matching.add(bp);
  }
  return matching;
}

/**
 * 한 blueprint에 대해 N(P)에 속한 이름들의 file 증거를 이어 붙인다.
 *
 * @param {Ontology} index - 파일 증거 맵을 가진 색인
 * @param {string} bp - blueprint 문서 경로
 * @param {string[]} names - 질의 경로의 이름 집합
 * @returns {Evidence[]} 이름별 증거 배열을 이은 목록(중복 제거 전)
 */
function unionFileEvidence(index: Ontology, bp: string, names: string[]): Evidence[] {
  const items: Evidence[] = [];
  for (const name of names) {
    items.push(...(index.fileEvidence.get(bp)?.get(name) ?? []));
  }
  return items;
}

/**
 * canonical context 아래의 Markdown만 정렬 순회하며 symlink 경계를 경고로 보존한다.
 * 디렉터리 읽기 실패는 입력 결손으로 오인하지 않고 I/O 오류로 올린다.
 *
 * @param {string} root - canonical Git checkout
 * @param {Warning[]} warnings - 순회 중 발견한 경고를 누적하는 배열
 * @returns {string[]} 저장소 상대 Markdown 경로
 */
function walkContext(root: string, warnings: Warning[]): string[] {
  const base = path.join(root, '.bouncer', 'context');
  let entries: fs.Dirent[];
  try {
    entries = fs.readdirSync(base, { withFileTypes: true });
  } catch (error) {
    if (isMissing(error)) {
      warnings.push({
        code: 'context-missing',
        source: '.bouncer/context',
        line: 0,
        detail: 'context directory is absent',
      });
      return [];
    }
    throw ioError('cannot read context directory', error);
  }
  const found: string[] = [];
  function descend(abs: string, rel: string): void {
    let items: fs.Dirent[];
    try {
      items = fs.readdirSync(abs, { withFileTypes: true });
    } catch (error) {
      throw ioError('cannot read context directory', error);
    }
    for (const item of items.sort((a, b) => compare(a.name, b.name))) {
      const child = `${rel}/${item.name}`;
      if (SKIP.has(item.name)) {
        if (['review', 'reviews', 'verification', 'verifications'].includes(item.name)) {
          warnings.push({
            code: 'path-rejected',
            source: child,
            line: 0,
            detail: 'review and verification documents are outside the retrieval index',
          });
        }
        continue;
      }
      if (item.isSymbolicLink()) {
        warnings.push({ code: 'symlink-skipped', source: child, line: 0, detail: 'symbolic link skipped' });
        continue;
      }
      if (item.isDirectory()) descend(path.join(abs, item.name), child);
      else if (item.isFile() && item.name.endsWith('.md')) found.push(child);
    }
  }
  for (const item of entries.sort((a, b) => compare(a.name, b.name))) {
    const rel = `.bouncer/context/${item.name}`;
    const abs = path.join(base, item.name);
    if (SKIP.has(item.name)) {
      if (['review', 'reviews', 'verification', 'verifications'].includes(item.name)) {
        warnings.push({
          code: 'path-rejected',
          source: rel,
          line: 0,
          detail: 'review and verification documents are outside the retrieval index',
        });
      }
      continue;
    }
    if (item.isSymbolicLink()) {
      warnings.push({ code: 'symlink-skipped', source: rel, line: 0, detail: 'symbolic link skipped' });
      continue;
    }
    if (item.isDirectory()) descend(abs, rel);
    else if (item.isFile() && item.name.endsWith('.md')) found.push(rel);
  }
  return found;
}

/**
 * 문서 하나를 읽고 frontmatter와 필수 shape를 검증한다.
 * 예상 가능한 문서 형식 오류만 경고로 접고 권한 등 I/O 실패는 전달한다.
 *
 * @param {string} root - canonical Git checkout
 * @param {string} source - 문서의 저장소 상대 경로
 * @param {Warning[]} warnings - 문서 오류 경고 누적 배열
 * @returns {Doc | null} 유효 문서 또는 제외한 문서
 */
function readContextDoc(root: string, source: string, warnings: Warning[]): Doc | null {
  const abs = path.join(root, ...source.split('/'));
  let raw: string;
  try {
    raw = fs.readFileSync(abs, 'utf8');
  } catch (error) {
    if (isMissing(error)) {
      warnArray(warnings, 'document-invalid', source, 0, 'document disappeared during scan');
      return null;
    }
    throw ioError('cannot read context document', error);
  }
  let parsed: { data: unknown; body: string };
  try {
    parsed = parseFrontmatter(raw);
  } catch {
    warnArray(warnings, 'document-invalid', source, 0, 'frontmatter is invalid');
    return null;
  }
  if (!isRecord(parsed.data) || typeof parsed.body !== 'string') {
    warnArray(warnings, 'document-invalid', source, 0, 'document shape is invalid');
    return null;
  }
  if (typeof parsed.data.type !== 'string' || typeof nested(parsed.data, 'bouncer', 'status') !== 'string') {
    warnArray(warnings, 'document-invalid', source, 0, 'document type or status is missing');
    return null;
  }
  const bodyStart = raw.indexOf(parsed.body);
  const bodyLineOffset = raw.slice(0, bodyStart).split(/\r?\n/).length;
  return {
    id: source,
    kind: '',
    status: nested(parsed.data, 'bouncer', 'status') as string,
    data: parsed.data,
    body: parsed.body,
    bodyLineOffset,
  };
}
/**
 * Contract의 코드 펜스 밖 단일 백틱 토큰을 종류와 출처를 붙여 연결한다.
 * 범위 표기는 펼치지 않으며 비ASCII 토큰과 공백 토큰은 인덱스에 넣지 않는다.
 *
 * @param {Ontology} index - 누적 색인
 * @param {string} bp - 연결할 canonical BP 경로
 * @param {string} source - 토큰을 읽은 문서 경로
 * @param {string} body - frontmatter 뒤 본문
 * @param {number} offset - 본문 첫 줄의 문서 전체 기준 오프셋
 * @returns {void} 색인 관계를 누적한다
 */
function extractContract(index: Ontology, bp: string, source: string, body: string, offset: number): void {
  const section = getSection(body, '## Contract'); if (!section) return;
  let fence = false; const lines = body.split(/\r?\n/); let inSection = false;
  for (let i = 0; i < lines.length; i++) {
    if (lines[i].trim() === '## Contract') { inSection = true; continue; }
    if (inSection && /^## /.test(lines[i])) break;
    if (!inSection) continue;
    if (/^\s*```/.test(lines[i])) { fence = !fence; continue; }
    if (fence) continue;
    TOKEN.lastIndex = 0; let match: RegExpExecArray | null;
    while ((match = TOKEN.exec(lines[i]))) {
      const token = match[1];
      const hasNonAscii = [...token].some((char) => char.charCodeAt(0) > 0x7f);
      if (!token || /\s/.test(token) || hasNonAscii) continue;
      const kind = token.startsWith('G') && /^G\d+$/.test(token)
        ? 'gate'
        : token.startsWith('--')
          ? 'flag'
          : token.includes('/') ? 'path' : 'identifier';
      addEntity(index, bp, token, evidence(source, i + 1 + offset, 'contract'));
      if (kind === 'path') addPath(index, bp, token, source, i + 1 + offset, 'contract');
    }
  }
  void section;
}
function extractSectionPaths(
  index: Ontology,
  bp: string,
  source: string,
  body: string,
  heading: string,
  kind: string,
  offset: number,
): void {
  const lines = body.split(/\r?\n/); let active = false;
  for (let i = 0; i < lines.length; i++) {
    if (lines[i].trim() === heading) { active = true; continue; }
    if (active && /^#{1,4} /.test(lines[i])) break;
    if (!active) continue;
    TOKEN.lastIndex = 0; let match: RegExpExecArray | null;
    while ((match = TOKEN.exec(lines[i]))) {
      const val = match[1]; if (!val.includes('/')) continue;
      addPath(index, bp, val, source, i + 1 + offset, kind);
    }
  }
}
/**
 * Explain의 새 형식과 legacy task_commits를 검증하고 확정 커밋의 파일 diff를 연결한다.
 * Git 인자 배열을 유지해 경로와 SHA가 셸 문법으로 해석되지 않게 한다.
 *
 * @param {Ontology} index - 누적 색인
 * @param {string} bp - commit diff를 연결할 BP 경로
 * @param {string} source - Explain 문서 경로
 * @param {Doc} doc - 이미 파싱된 Explain
 * @param {string} epicId - 부모 epic 번호
 * @param {string} bpId - 부모 blueprint 번호
 * @param {'numeric' | 'slug'} format - 부모 key 형식(행의 task ID 형식 기대값을 정한다)
 * @returns {void} 유효 diff 경로와 경고를 색인에 누적한다
 */
function parseCommitRows(
  index: Ontology,
  bp: string,
  source: string,
  doc: Doc,
  epicId: string,
  bpId: string,
  format: 'numeric' | 'slug',
): void {
  const rows = nested(doc.data, 'bouncer', 'task_commits'); if (rows === undefined) return;
  if (!Array.isArray(rows)) { warn(index, 'document-invalid', source, 0, 'task_commits must be an array'); return; }
  let sourceLines: string[];
  try {
    sourceLines = fs.readFileSync(path.join(index.repoRoot, ...source.split('/')), 'utf8').split(/\r?\n/);
  } catch (error) {
    throw ioError('cannot reread Explain source lines', error);
  }
  for (let i = 0; i < rows.length; i++) {
    const row = rows[i];
    if (!isRecord(row)) { warn(index, 'document-invalid', source, 0, 'task_commits row is invalid'); continue; }
    const rowLine = sourceLines.findIndex((text) => /\bsha\s*:/.test(text) && typeof row.sha === 'string' && text.includes(row.sha));
    const line = rowLine < 0 ? 0 : rowLine + 1;
    const hasNew = Object.hasOwn(row, 'task') || Object.hasOwn(row, 'intent_anchor');
    const task = row.task;
    // 접두는 형식별 task ID에서 끝 세 자리(번호)만 뗀 값이다. key는 번호 또는 kebab slug라 정규식 특수문자가 없다.
    const expectedPrefix = formatStableTaskId({ format, epicKey: epicId, blueprintKey: bpId, task: '000' })
      .slice(0, -3);
    const taskPattern = new RegExp(`^${expectedPrefix}\\d{3}$`);
    const newValid = hasNew && typeof task === 'string' && taskPattern.test(task) &&
      typeof row.intent_anchor === 'string' && row.intent_anchor === `task-${task.slice(-3)}`;
    const oldValid = !hasNew && typeof row.id === 'string' &&
      (/^TASKS?[-/]\d{3}$/.test(row.id) || taskPattern.test(row.id));
    if (!(newValid || oldValid) || (typeof task === 'string' && !task.startsWith(expectedPrefix))) {
      warn(index, 'document-invalid', source, line, 'task_commits task identity is invalid');
      continue;
    }
    if (typeof row.sha !== 'string' || !/^[0-9a-fA-F]{8,40}$/.test(row.sha)) {
      warn(index, 'document-invalid', source, line, 'task_commits SHA is invalid');
      continue;
    }
    const full = runGit(index.repoRoot, ['rev-parse', '--verify', `${row.sha}^{commit}`]);
    if (full.status !== 0 || !/^[0-9a-f]{40}$/i.test(full.stdout.trim())) {
      warn(index, 'commit-unavailable', source, line, 'commit is missing or ambiguous');
      continue;
    }
    const sha = full.stdout.trim().toLowerCase();
    const diffArgs = [
      'diff-tree', '--root', '--no-commit-id', '--name-status', '-r', '-M',
      ...(hasParent(index.repoRoot, sha) ? [`${sha}^`, sha] : [sha]),
    ];
    const diff = runGit(index.repoRoot, diffArgs);
    if (diff.status !== 0) throw ioError(`git diff failed for ${sha}`, new Error(diff.stderr));
    const seen = new Set<string>();
    for (const record of diff.stdout.split(/\r?\n/)) {
      const cols = record.split('\t');
      if (cols.length < 2) continue;
      const changed = cols[0].startsWith('R') ? [cols[1], cols[2]] : [cols[1]];
      for (const file of changed) {
        if (!seen.has(file)) {
          seen.add(file);
          addPath(index, bp, file, source, line, 'commit_diff', sha);
        }
      }
    }
  }
}
function hasParent(root: string, sha: string): boolean {
  const result = runGit(root, ['rev-list', '--parents', '-n', '1', sha]);
  return result.status === 0 && result.stdout.trim().split(/\s+/).length > 1;
}
function addPath(
  index: Ontology,
  bp: string,
  value: string,
  source: string,
  line: number,
  kind: string,
  sha?: string,
): void {
  const norm = normalizePath(value);
  if (!norm) {
    warn(index, 'path-rejected', source, line, 'file path is unsafe or contains a glob');
    return;
  }
  addFile(index, bp, norm, evidence(source, line, kind, sha));
}
function addFile(index: Ontology, bp: string, file: string, ev: Evidence): void {
  addRelation(index.files, file, bp);
  addEvidence(index.fileEvidence, bp, file, ev);
}
function addEntity(index: Ontology, bp: string, token: string, ev: Evidence): void {
  addRelation(index.entities, token, bp);
  addEvidence(index.entityEvidence, bp, token, ev);
}
function addRelation(map: Map<string, Set<string>>, token: string, bp: string): void {
  if (!map.has(token)) map.set(token, new Set());
  map.get(token)!.add(bp);
}
function addEvidence(
  map: Map<string, Map<string, Evidence[]>>,
  bp: string,
  key: string,
  ev: Evidence,
): void {
  if (!map.has(bp)) map.set(bp, new Map());
  const inner = map.get(bp)!;
  inner.set(key, [...(inner.get(key) ?? []), ev]);
}
function validateFileQuery(value: string): void {
  if (
    !value || value.includes('\0') || value.includes('\\') || value.startsWith('/') ||
    value.split('/').includes('..') || /[*?{}[\]]/.test(value)
  ) throw inputError('file path must be a safe repository-relative path');
}
function normalizePath(value: string): string | null {
  if (
    typeof value !== 'string' || !value || value.includes('\0') || value.includes('\\') ||
    value.startsWith('/') || /[*?{}[\]]/.test(value)
  ) return null;
  const clean = value.startsWith('./') ? value.slice(2) : value;
  if (clean.split('/').includes('..') || clean.split('/').some((part) => !part)) return null;
  return clean;
}
function getSection(body: string, title: string): string | null {
  const at = body.indexOf(`${title}\n`);
  return at < 0 ? null : body.slice(at);
}
function lineOfValue(body: string, value: string, fallback: number): number {
  const lines = body.split(/\r?\n/);
  const idx = lines.findIndex((line) => line.includes(value));
  return idx < 0 ? fallback : idx + 1;
}
function evidence(source: string, line: number, kind: string, sha?: string): Evidence {
  return sha ? { source, line, kind, sha } : { source, line, kind };
}
function warn(index: Ontology, code: string, source: string, line: number, detail: string): void {
  warnArray(index.warnings, code, source, line, detail);
}
function warnArray(target: Warning[], code: string, source: string, line: number, detail: string): void {
  target.push({ code, source, line, detail });
}
function uniqueWarnings(items: Warning[]): Warning[] {
  const map = new Map(items.map((x) => [`${x.code}\0${x.source}\0${x.line}\0${x.detail}`, x]));
  return [...map.values()].sort((a, b) =>
    compare(a.code, b.code) || compare(a.source, b.source) || a.line - b.line || compare(a.detail, b.detail),
  );
}
function uniqueEvidence(items: Evidence[]): Evidence[] {
  const map = new Map(items.map((x) => [`${x.source}\0${x.line}\0${x.kind}\0${x.sha ?? ''}`, x]));
  return [...map.values()].sort((a, b) =>
    compare(a.source, b.source) || a.line - b.line || compare(a.kind, b.kind) || compare(a.sha ?? '', b.sha ?? ''),
  );
}
function compare(a: string, b: string): number { return a < b ? -1 : a > b ? 1 : 0; }
function nested(value: unknown, parent: string, key: string): unknown {
  return isRecord(value) && isRecord(value[parent]) ? value[parent][key] : undefined;
}
function isRecord(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === 'object' && !Array.isArray(value);
}
function isMissing(error: unknown): boolean {
  return !!error && typeof error === 'object' &&
    ['ENOENT', 'ENOTDIR'].includes(String((error as NodeJS.ErrnoException).code));
}
function inputError(message: string): Error & { code: string } {
  const error = new Error(message) as Error & { code: string };
  error.code = 'ontology-input-invalid';
  return error;
}
function ioError(message: string, cause: unknown): Error & { code: string } {
  const error = new Error(message, { cause }) as Error & { code: string };
  error.code = 'ontology-io-failed';
  return error;
}
/**
 * 셸 없이 Git 하위 명령을 실행하고 시작 실패를 명시적 I/O 오류로 전달한다.
 * 명령이 시작된 뒤의 비정상 종료는 호출자가 명령별 계약에 따라 처리한다.
 *
 * @param {string} root - Git 실행 cwd
 * @param {string[]} args - Git에 전달할 인자 배열
 * @returns {{status: number; stdout: string; stderr: string}} 프로세스 결과
 */
function runGit(
  root: string,
  args: string[],
): { status: number; stdout: string; stderr: string } {
  const result = spawnSync('git', args, { cwd: root, encoding: 'utf8', windowsHide: true });
  if (result.error) throw ioError('cannot execute git', result.error);
  return {
    status: result.status ?? 1,
    stdout: result.stdout ?? '',
    stderr: result.stderr ?? '',
  };
}

export = { loadContextOntology, queryContextOntology };
