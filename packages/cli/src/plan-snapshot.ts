'use strict';

const fs = require('node:fs');
const path = require('node:path');
const { createHash } = require('node:crypto');

import tasksDocs = require('./tasks-docs');
const { listTasksDocs } = tasksDocs;
import frontmatter = require('./frontmatter');
const { readDoc } = frontmatter;
import paths = require('./paths');
const { toPosix, epicDirOf } = paths;
import validateSections = require('./validate-sections');
const { parseTasksSections } = validateSections;
import snapshotContract = require('./plan-snapshot-contract');
const {
  SNAPSHOT_VERSION, digestPlanContent, normalizeStructure, structureKindOf, hashBody, hashStructure,
} = snapshotContract;
import schema = require('./schema');

// 계획 snapshot digest의 단일 구현. review-dispatch(frozen target)와 context review 기록이
// 같은 hex를 내야 하므로 둘 다 여기서 가져간다. review-dispatch는
// validate를 require하므로, 이 모듈이 validate·validate-gates·review-dispatch를
// require하면 validate-gates → plan-snapshot 경로에 순환이 생긴다 — 금지.
// validate-sections는 형제 validate-* 를 끌어오지 않는 맨 아래층이라 여기 써도
// 순환이 생기지 않는다.

type PlanStructure = Record<string, unknown>;
type PlanDocContent = { body: string; structure: PlanStructure };

/**
 * epic·blueprint·tasks.md 상대 경로를 집계 digest와 같은 순서로 모은다.
 * 문서 집합이 갈라지면 context review 기록과 follow_up 판정이 서로 다른 대상을 본다.
 *
 * @param {string} repoRoot - 저장소 루트 절대 경로
 * @param {string} blueprintDir - blueprint 상대 경로(POSIX)
 * @returns {string[]} hash·parts에 넣을 저장소 상대 경로 목록
 */
function planDocumentRels(repoRoot: string, blueprintDir: string): string[] {
  const bp = toPosix(blueprintDir);
  const documents = [
    `${epicDirOf(bp)}/index.md`,
    `${bp}/index.md`,
  ];
  const listing = listTasksDocs({ repoRoot, blueprintDir: bp });
  for (const entry of listing.entries) {
    documents.push(entry.tasks.rel);
  }
  return documents;
}


type PlanContent = {
  ok: true;
  documents: string[];
  content: Record<string, PlanDocContent>;
  scope_parts: Record<string, string>;
} | { ok: false; error: string };

/**
 * plan 문서를 한 번 읽어 경로별 본문·정규화 구조와 관찰용 scope_parts를 만든다.
 * digest·parts·structure_parts가 모두 이 한 번의 읽기에서 나와야 읽기 사이에
 * 파일이 바뀌어도 서로 다른 내용을 가리키지 않는다.
 *
 * @param {string} repoRoot - 저장소 루트 절대 경로
 * @param {string} blueprintDir - blueprint 상대 경로
 * @returns {PlanContent} 성공 시 문서 순서·내용·scope_parts, 부재·파싱 실패 시 ok:false와 사유
 */
function readPlanContent(repoRoot: string, blueprintDir: string): PlanContent {
  const bp = toPosix(blueprintDir);
  const documents = planDocumentRels(repoRoot, bp);
  const content: Record<string, PlanDocContent> = {};
  const scope_parts: Record<string, string> = {};
  // low 계획만 review_risk를 구조에 싣는다. blueprint를 먼저 읽어 모든
  // normalizeStructure 호출에 같은 인자를 넘겨야 previous 재정규화가 멱등이다.
  let planComplexity: 'low' | 'standard' = 'standard';
  const bpRel = `${bp}/index.md`;
  if (documents.includes(bpRel)) {
    try {
      const bpDoc = readDoc(path.join(repoRoot, bpRel));
      const bpBouncer = (bpDoc.data as { bouncer?: unknown } | null)?.bouncer;
      const parsed = schema.complexityOf(bpBouncer);
      if (parsed === 'low') planComplexity = 'low';
    } catch (_error) {
      // index 파싱 실패는 아래 루프가 snapshot document unreadable로 돌린다.
      // 여기서 기본 standard로 두면 실패 전 digest가 바뀌지 않는다.
    }
  }

  for (const rel of documents) {
    const abs = path.join(repoRoot, rel);
    if (!fs.existsSync(abs)) {
      return { ok: false, error: `snapshot document missing: ${rel}` };
    }
    let body: string;
    let data: unknown;
    try {
      const doc = readDoc(abs);
      body = doc.body;
      data = doc.data;
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      return { ok: false, error: `snapshot document unreadable: ${rel}: ${message}` };
    }
    const bouncer = (data as { bouncer?: unknown } | null)?.bouncer;
    const kind = structureKindOf(rel, bp);
    content[rel] = { body, structure: normalizeStructure(kind, bouncer, planComplexity) };

    // epic·blueprint index는 Interface/Touch가 없다. tasks.md만 관찰용 scope_parts에 넣는다.
    if (kind !== 'task') continue;
    const sections = parseTasksSections(body);
    const interfaceBody = typeof sections.interface === 'string' ? sections.interface : '';
    const touchBody = typeof sections.touch === 'string' ? sections.touch : '';
    const structure = content[rel].structure as { affected_paths: string[]; depends_on: string[] };
    // 계약 문자열: 정렬 JSON + Interface 본문 + Touch 본문. v1 payload와 같은 공개 관찰
    // 값이라 순서·구분자를 유지한다. v2에서는 full 판정에 쓰지 않고 보관만 한다.
    const scopeMaterial = [
      JSON.stringify(structure.affected_paths),
      JSON.stringify(structure.depends_on),
      interfaceBody,
      touchBody,
    ].join('\n');
    scope_parts[rel] = createHash('sha256').update(scopeMaterial).digest('hex');
  }
  return { ok: true, documents, content, scope_parts };
}

/**
 * epic·blueprint·tasks.md의 경로·본문·판단 구조로 v2 집계 digest를 만든다.
 * context-review frozen snapshot과 같은 문서 집합·순서를 유지한다.
 * frontmatter 중 status/title/timestamp와 commit evidence는 hash에 넣지 않는다 —
 * status flip만으로 digest가 바뀌면 승인 직후 snapshot이 곧바로 stale 판정을 받는다.
 * 반대로 affected_paths 등 실행 구조는 digest에 들어가므로 범위 변경은 stale이 된다.
 *
 * @param {{ repoRoot: string, blueprintDir: string }} opts - 저장소 루트와 blueprint 상대 경로
 * @returns {{ ok: true, digest: string, documents: string[] } | { ok: false, error: string }}
 *   성공 시 hex digest와 hash에 넣은 문서 상대 경로 목록, 문서 부재·파싱 실패 시 ok:false와 사유
 */
function computePlanSnapshot({ repoRoot, blueprintDir }: {
  repoRoot: string;
  blueprintDir: string;
}): { ok: true; digest: string; documents: string[] } | { ok: false; error: string } {
  const read = readPlanContent(repoRoot, blueprintDir);
  if (!read.ok) return read;
  return { ok: true, digest: digestPlanContent(read.documents, read.content), documents: read.documents };
}

/**
 * 문서별 본문 digest(`parts`)·구조 digest(`structure_parts`)·관찰용 `scope_parts`와
 * 이전/이후 비교에 쓰는 `documents_content`를 만든다. 문서마다 별도 sha256을 내어
 * follow_up이 어느 문서가 어떻게 바뀌었는지 가리킬 수 있게 한다.
 *
 * @param {{ repoRoot: string, blueprintDir: string }} opts - 저장소 루트와 blueprint 상대 경로
 * @returns {{ ok: true, parts: Record<string, string>, scope_parts: Record<string, string>,
 *   structure_parts: Record<string, string>, documents_content: Record<string, PlanDocContent> }
 *   | { ok: false, error: string }}
 *   성공 시 경로→값 맵들, 문서 부재·파싱 실패 시 ok:false와 사유
 */
function computePlanParts({ repoRoot, blueprintDir }: {
  repoRoot: string;
  blueprintDir: string;
}): { ok: true; parts: Record<string, string>; scope_parts: Record<string, string>;
  structure_parts: Record<string, string>; documents_content: Record<string, PlanDocContent> }
  | { ok: false; error: string } {
  const read = readPlanContent(repoRoot, blueprintDir);
  if (!read.ok) return read;
  const parts: Record<string, string> = {};
  const structure_parts: Record<string, string> = {};
  for (const rel of read.documents) {
    parts[rel] = hashBody(read.content[rel].body);
    structure_parts[rel] = hashStructure(read.content[rel].structure);
  }
  return {
    ok: true, parts, scope_parts: read.scope_parts, structure_parts, documents_content: read.content,
  };
}

export = {
  SNAPSHOT_VERSION,
  computePlanSnapshot,
  computePlanParts,
  digestPlanContent,
  normalizeStructure,
  structureKindOf,
  hashBody,
  hashStructure,
};
