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

// 계획 snapshot digest의 단일 구현. review-dispatch(frozen target)와 plan gate
// G18이 같은 hex를 내야 하므로 둘 다 여기서 가져간다. review-dispatch는
// validate를 require하므로, 이 모듈이 validate·validate-gates·review-dispatch를
// require하면 validate-gates → plan-snapshot 경로에 순환이 생긴다 — 금지.
// validate-sections는 형제 validate-* 를 끌어오지 않는 맨 아래층이라 여기 써도
// 순환이 생기지 않는다.

/**
 * epic·blueprint·tasks.md 상대 경로를 집계 digest와 같은 순서로 모은다.
 * 문서 집합이 갈라지면 G18과 follow_up 판정이 서로 다른 대상을 본다.
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

/**
 * epic·blueprint·tasks.md body를 번호 순으로 이어 sha256 digest를 만든다.
 * context-review frozen snapshot과 같은 문서 집합·순서를 유지한다.
 * frontmatter는 hash에 넣지 않는다 — status flip만으로 digest가 바뀌면
 * 승인 직후 snapshot이 곧바로 stale 판정을 받는다.
 *
 * @param {{ repoRoot: string, blueprintDir: string }} opts - 저장소 루트와 blueprint 상대 경로
 * @returns {{ ok: true, digest: string, documents: string[] } | { ok: false, error: string }}
 *   성공 시 hex digest와 hash에 넣은 문서 상대 경로 목록, 문서 부재·파싱 실패 시 ok:false와 사유
 */
function computePlanSnapshot({ repoRoot, blueprintDir }: {
  repoRoot: string;
  blueprintDir: string;
}): { ok: true; digest: string; documents: string[] } | { ok: false; error: string } {
  const bp = toPosix(blueprintDir);
  const documents = planDocumentRels(repoRoot, bp);

  const hash = createHash('sha256');
  for (const rel of documents) {
    const abs = path.join(repoRoot, rel);
    if (!fs.existsSync(abs)) {
      return { ok: false, error: `snapshot document missing: ${rel}` };
    }
    try {
      const { body } = readDoc(abs);
      hash.update(body);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      return { ok: false, error: `snapshot document unreadable: ${rel}: ${message}` };
    }
  }
  return { ok: true, digest: hash.digest('hex'), documents };
}

/**
 * 문서별 본문 digest(`parts`)와 tasks.md 범위 digest(`scope_parts`)를 만든다.
 * 집계 digest와 같은 문서 집합·본문 입력을 쓰되, 문서마다 별도 sha256을 내어
 * follow_up이 어느 문서가 바뀌었는지 가리킬 수 있게 한다. frontmatter의
 * `affected_paths`·`depends_on`은 집계 digest에 안 들어가므로 범위 변화는
 * `scope_parts`로만 잡는다.
 *
 * @param {{ repoRoot: string, blueprintDir: string }} opts - 저장소 루트와 blueprint 상대 경로
 * @returns {{ ok: true, parts: Record<string, string>, scope_parts: Record<string, string> }
 *   | { ok: false, error: string }}
 *   성공 시 경로→hex 맵, 문서 부재·파싱 실패 시 ok:false와 사유
 */
function computePlanParts({ repoRoot, blueprintDir }: {
  repoRoot: string;
  blueprintDir: string;
}): { ok: true; parts: Record<string, string>; scope_parts: Record<string, string> }
  | { ok: false; error: string } {
  const bp = toPosix(blueprintDir);
  const documents = planDocumentRels(repoRoot, bp);
  const parts: Record<string, string> = {};
  const scope_parts: Record<string, string> = {};

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
    parts[rel] = createHash('sha256').update(body).digest('hex');

    // epic·blueprint index는 범위 신호가 없다. tasks.md만 scope_parts에 넣는다.
    if (!/\/tasks\/\d{3}\/tasks\.md$/.test(rel)) continue;
    const sections = parseTasksSections(body);
    const interfaceBody = typeof sections.interface === 'string' ? sections.interface : '';
    const touchBody = typeof sections.touch === 'string' ? sections.touch : '';
    const bouncer = (data as { bouncer?: {
      affected_paths?: unknown;
      depends_on?: unknown;
    } } | null)?.bouncer;
    const affected = Array.isArray(bouncer?.affected_paths)
      ? [...bouncer.affected_paths].map(String).sort()
      : [];
    const depends = Array.isArray(bouncer?.depends_on)
      ? [...bouncer.depends_on].map(String).sort()
      : [];
    // 계약 문자열: 정렬 JSON + Interface 본문 + Touch 본문. 순서·구분자를
    // 바꾸면 이전 payload와 비교가 전부 full로 기울어진다.
    const scopeMaterial = [
      JSON.stringify(affected),
      JSON.stringify(depends),
      interfaceBody,
      touchBody,
    ].join('\n');
    scope_parts[rel] = createHash('sha256').update(scopeMaterial).digest('hex');
  }

  return { ok: true, parts, scope_parts };
}

export = { computePlanSnapshot, computePlanParts };
