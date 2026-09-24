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

// 계획 snapshot digest의 단일 구현. review-dispatch(frozen target)와 plan gate
// G18이 같은 hex를 내야 하므로 둘 다 여기서 가져간다. review-dispatch는
// validate를 require하므로, 이 모듈이 validate·validate-gates·review-dispatch를
// require하면 validate-gates → plan-snapshot 경로에 순환이 생긴다 — 금지.

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
  const documents = [
    `${epicDirOf(bp)}/index.md`,
    `${bp}/index.md`,
  ];
  const listing = listTasksDocs({ repoRoot, blueprintDir: bp });
  for (const entry of listing.entries) {
    documents.push(entry.tasks.rel);
  }

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

export = { computePlanSnapshot };
