'use strict';
const fs = require('node:fs');
const path = require('node:path');
import layout = require('./layout');
const { CONTEXT_ROOT } = layout;
import frontmatter = require('./frontmatter');

type StructuralFailure = { code: string; message: string; file: string };

const CONTEXT_INDEX_REL = `${CONTEXT_ROOT}/index.md`;
// init CONTEXT_INDEX와 동일 frontmatter. 파일이 없을 때만 쓰며 기존 index를
// 소급 수정하지 않는다 — 이미 있는 저장소는 사람이 bouncer_schema를 넣는다.
const EMPTY_CONTEXT_INDEX = `---
okf_version: "0.1"
bouncer_schema: "0.1"
---
# Epics

`;

// OKF §6: bundle index와 실제 디렉터리 모두 숫자 정본 경로만 비교한다.
// 구형 EPIC- 접두는 목록에서 조용히 빼지 않고 S13으로 거절한다 — 전이 종료 후
// “구형만 남은 트리”가 빈 dirs로 통과하면 안 된다.
const EPIC_LINK_RE = /\]\(epics\/(\d{3}-[^/)]+)\/index\.md\)/g;
const LEGACY_EPIC_LINK_RE = /\]\(epics\/(EPIC-\d{3}-[^/)]+)\/index\.md\)/g;
const EPIC_DIR_NAME_RE = /^\d{3}-.+$/;
const LEGACY_EPIC_DIR_NAME_RE = /^EPIC-\d{3}-.+$/;

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

/**
 * canonical epic 문서에서 색인 파생값인 description을 읽는다.
 * 파일 읽기·frontmatter·값 검증 실패를 모두 호출자에게 전달해 scaffold와
 * S13이 손상된 정본을 조용히 다른 문구로 대체하지 않게 한다.
 *
 * @param {string} repoRoot - 저장소 루트 절대 경로
 * @param {string} dirName - canonical epic 디렉터리 이름
 * @returns {string} 공백을 제거한 비어 있지 않은 description
 * @throws {Error} 파일을 읽거나 frontmatter를 해석할 수 없거나 값이 유효하지 않을 때
 */
function readEpicDescription(repoRoot: string, dirName: string): string {
  const abs = path.join(repoRoot, CONTEXT_ROOT, 'epics', dirName, 'index.md');
  let raw: string;
  try {
    raw = fs.readFileSync(abs, 'utf8');
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    throw new Error(`epic frontmatter unreadable: ${abs} (${message})`, { cause: error });
  }
  let data: unknown;
  try {
    // frontmatter는 최상단 import = require로 읽어 순환 없이 단일 YAML 정책을 재사용한다.
    // 함수 안 require+시그니처 캐스트는 경계 타입 검사를 우회하므로 쓰지 않는다.
    data = frontmatter.parseFrontmatter(raw).data;
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    throw new Error(`epic frontmatter parse failed: ${abs} (${message})`, { cause: error });
  }
  const description = isRecord(data) ? data.description : undefined;
  if (typeof description !== 'string' || !description.trim()) {
    throw new Error(`epic description must be a non-empty string: ${abs}`);
  }
  const trimmed = description.trim();
  const id = dirName.slice(0, 3);
  if (trimmed === `Epic ${id}`) {
    throw new Error(`epic description must not be a placeholder: ${abs}`);
  }
  return trimmed;
}

function escapedRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function indexRowsForDir(text: string, dirName: string): Array<{
  line: string;
  prefix: string;
  summary: string;
}> {
  const pathPart = escapedRegExp(`epics/${dirName}/index.md`);
  const re = new RegExp(`^(\\* \\[[^\\r\\n]*\\]\\(${pathPart}\\) - )(.*)$`, 'gm');
  const rows: Array<{ line: string; prefix: string; summary: string }> = [];
  let match: RegExpExecArray | null;
  while ((match = re.exec(text)) !== null) {
    rows.push({ line: match[0], prefix: match[1], summary: match[2] });
  }
  return rows;
}

function listEpicDirNames(repoRoot: string): string[] {
  const epicsRoot = path.join(repoRoot, CONTEXT_ROOT, 'epics');
  if (!fs.existsSync(epicsRoot)) return [];
  let names: string[];
  try {
    names = fs.readdirSync(epicsRoot);
  } catch (_e) {
    return [];
  }
  const dirs: string[] = [];
  for (const name of names) {
    if (!EPIC_DIR_NAME_RE.test(name)) continue;
    try {
      if (fs.statSync(path.join(epicsRoot, name)).isDirectory()) dirs.push(name);
    } catch (_e) {
      // skip unreadable entries
    }
  }
  dirs.sort();
  return dirs;
}

/** 구형 EPIC- 접두 epic 디렉터리 이름. S13 거절 대상. */
function listLegacyEpicDirNames(repoRoot: string): string[] {
  const epicsRoot = path.join(repoRoot, CONTEXT_ROOT, 'epics');
  if (!fs.existsSync(epicsRoot)) return [];
  let names: string[];
  try {
    names = fs.readdirSync(epicsRoot);
  } catch (_e) {
    return [];
  }
  const dirs: string[] = [];
  for (const name of names) {
    if (!LEGACY_EPIC_DIR_NAME_RE.test(name)) continue;
    try {
      if (fs.statSync(path.join(epicsRoot, name)).isDirectory()) dirs.push(name);
    } catch (_e) {
      // skip unreadable entries
    }
  }
  dirs.sort();
  return dirs;
}

function parseIndexEpicDirs(text: string): Set<string> {
  const listed = new Set<string>();
  EPIC_LINK_RE.lastIndex = 0;
  let m: RegExpExecArray | null;
  while ((m = EPIC_LINK_RE.exec(text)) !== null) {
    listed.add(m[1]);
  }
  return listed;
}

function parseLegacyIndexEpicDirs(text: string): Set<string> {
  const listed = new Set<string>();
  LEGACY_EPIC_LINK_RE.lastIndex = 0;
  let m: RegExpExecArray | null;
  while ((m = LEGACY_EPIC_LINK_RE.exec(text)) !== null) {
    listed.add(m[1]);
  }
  return listed;
}

function formatEpicIndexLine({ epicId, name, description }: {
  epicId: string;
  name: string;
  description?: unknown;
}): string {
  const dirName = `${epicId}-${name}`;
  if (typeof description !== 'string' || !description.trim() || description.trim() === `Epic ${epicId}`) {
    throw new Error(`epic description must be a non-placeholder string for ${dirName}`);
  }
  return `* [${epicId} ${name}](epics/${dirName}/index.md) - ${description.trim()}`;
}

/**
 * frontmatter description으로 bundle index의 한 행을 append·replace·no-op한다.
 * 기존 행은 label과 링크를 보존하고 요약만 교체하며, 변경이 없으면 파일을
 * 쓰지 않는다. 정본을 읽지 못하면 append도 거절한다.
 *
 * @param {object} options - 저장소와 epic 식별 정보
 * @param {string} options.repoRoot - 저장소 루트 절대 경로
 * @param {string} options.epicId - zero-padded epic id
 * @param {string} options.name - epic slug
 * @param {unknown} options.description - 신규 생성 시 사용할 description
 * @returns {string|null} 변경한 index 경로 또는 no-op이면 null
 */
function ensureEpicIndexEntry({ repoRoot, epicId, name, description }: {
  repoRoot: string;
  epicId: string;
  name: string;
  description?: unknown;
}): string | null {
  const abs = path.join(repoRoot, CONTEXT_INDEX_REL);
  const dirName = `${epicId}-${name}`;
  const epicPath = path.join(repoRoot, CONTEXT_ROOT, 'epics', dirName, 'index.md');
  const canonicalDescription = fs.existsSync(epicPath)
    ? readEpicDescription(repoRoot, dirName)
    : (typeof description === 'string' && description.trim() && description.trim() !== `Epic ${epicId}`
      ? description.trim()
      : (() => { throw new Error(`epic description must be provided for ${dirName}`); })());
  let text: string;
  if (!fs.existsSync(abs)) {
    fs.mkdirSync(path.dirname(abs), { recursive: true });
    text = EMPTY_CONTEXT_INDEX;
  } else {
    text = fs.readFileSync(abs, 'utf8');
  }
  const rows = indexRowsForDir(text, dirName);
  if (rows.length > 0) {
    if (rows[0].summary === canonicalDescription && rows.length === 1) return null;
    const next = text.replace(rows[0].line, `${rows[0].prefix}${canonicalDescription}`);
    fs.writeFileSync(abs, next);
    return CONTEXT_INDEX_REL;
  }
  const trimmed = text.replace(/\s*$/, '');
  const next = `${trimmed}\n${formatEpicIndexLine({ epicId, name, description: canonicalDescription })}\n`;
  fs.writeFileSync(abs, next);
  return CONTEXT_INDEX_REL;
}

/** epic 디렉터리 ↔ `.bouncer/context/index.md` 목록 일치. S13 실패 목록. */
function checkEpicIndexConsistency({ repoRoot }: { repoRoot: string }): StructuralFailure[] {
  const failures: StructuralFailure[] = [];
  const legacyDirs = listLegacyEpicDirNames(repoRoot);
  for (const d of legacyDirs) {
    failures.push({
      code: 'S13',
      message: `legacy-prefixed epic directory is not canonical: ${d}`,
      file: `${CONTEXT_ROOT}/epics/${d}`,
    });
  }

  const dirs = listEpicDirNames(repoRoot);
  const abs = path.join(repoRoot, CONTEXT_INDEX_REL);
  const hasEpics = dirs.length > 0 || legacyDirs.length > 0;

  if (!hasEpics) return failures;

  if (!fs.existsSync(abs)) {
    failures.push({
      code: 'S13',
      message: 'bundle context index.md missing while epics exist',
      file: CONTEXT_INDEX_REL,
    });
    return failures;
  }

  let text: string;
  try {
    text = fs.readFileSync(abs, 'utf8');
  } catch (_e) {
    failures.push({
      code: 'S13',
      message: 'bundle context index.md unreadable',
      file: CONTEXT_INDEX_REL,
    });
    return failures;
  }

  for (const d of [...parseLegacyIndexEpicDirs(text)].sort()) {
    failures.push({
      code: 'S13',
      message: `legacy-prefixed epic link is not canonical: ${d}`,
      file: CONTEXT_INDEX_REL,
    });
  }

  // 정본 디렉터리가 하나도 없으면 구형 거절만으로 충분하다.
  if (dirs.length === 0) return failures;

  const listed = parseIndexEpicDirs(text);
  for (const d of dirs) {
    const rows = indexRowsForDir(text, d);
    if (rows.length === 0) {
      failures.push({
        code: 'S13',
        message: `epic directory not listed in context index: ${d}`,
        file: CONTEXT_INDEX_REL,
      });
      continue;
    }
    if (rows.length > 1) {
      failures.push({
        code: 'S13',
        message: `duplicate epic index rows for directory: ${d}`,
        file: CONTEXT_INDEX_REL,
      });
    }
    let description: string;
    try {
      description = readEpicDescription(repoRoot, d);
    } catch (error) {
      failures.push({
        code: 'S13',
        message: (error as Error).message,
        file: `${CONTEXT_ROOT}/epics/${d}/index.md`,
      });
      continue;
    }
    if (rows[0].summary !== description) {
      failures.push({
        code: 'S13',
        message: `epic summary mismatch for ${d}: index summary does not match frontmatter description`,
        file: CONTEXT_INDEX_REL,
      });
    }
  }
  for (const d of [...listed].sort()) {
    if (!dirs.includes(d)) {
      failures.push({
        code: 'S13',
        message: `context index lists missing epic directory: ${d}`,
        file: CONTEXT_INDEX_REL,
      });
    }
  }
  return failures;
}

export = {
  CONTEXT_INDEX_REL,
  listEpicDirNames,
  listLegacyEpicDirNames,
  parseIndexEpicDirs,
  parseLegacyIndexEpicDirs,
  formatEpicIndexLine,
  ensureEpicIndexEntry,
  checkEpicIndexConsistency,
};
