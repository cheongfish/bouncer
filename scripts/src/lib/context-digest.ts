'use strict';
const fs = require('node:fs');
const path = require('node:path');
import distill = require('./distill');
const { readShards } = distill;
import layout = require('./layout');
const { DISTILL_SHARD_DIR } = layout;
import tasksDocs = require('./tasks-docs');
const { TASK_DIR_RE, TASK_UNIT_BASENAMES } = tasksDocs;
import frontmatter = require('./frontmatter');
const { parseFrontmatter } = frontmatter;
import commitSha = require('./commit-sha');
const { normalizeCommitSha } = commitSha;

/** graphify가 스캔할 파생 트리 (gitignore 대상 graphify-out 아래). */
const CONTEXT_DIGEST_OUT = 'graphify-out/context-src';
const DIGEST_MAP_REL = 'graphify-out/context-src/map.json';
/**
 * Distill은 context_dirs 밖이라 디렉터리 walk에 안 잡힌다.
 * freshness와 다이제스트 입력 모두에 명시적으로 넣는다.
 */
const DIGEST_WATCH_FILES = ['.bouncer/Distill.md'];

/**
 * 그래프 검색 신호가 되는 화이트리스트 문서의 헤딩 배열만 돌려준다.
 * blueprint와 task의 계약·의도는 포함하되 verification/review와 구형 task 문서는
 * 실행 기록이나 레거시 형식이므로 파생 파일을 만들지 않는다.
 *
 * @param {unknown} rel - 저장소 상대 문서 경로
 * @returns {string[] | null} 추출할 헤딩 배열 또는 비대상 경로의 null
 */
function digestRulesFor(rel: unknown): string[] | null {
  const norm = String(rel || '').replace(/\\/g, '/');
  // master Distill 본문은 ## Shards만 있다. Decisions를 찾으면 파생 산출이 0건이 된다.
  if (norm === '.bouncer/Distill.md') return ['## Shards'];
  // shard는 Invariants·Gotchas·Decisions를 문서 작성 순서대로 색인한다.
  // 셋 중 일부만 있으면 extractSections가 있는 절만 남긴다.
  if (new RegExp(`^${DISTILL_SHARD_DIR}/[^/]+\\.md$`).test(norm)) {
    return ['## Invariants', '## Gotchas', '## Decisions'];
  }
  if (/^\.bouncer\/context\/epics\/[^/]+\/index\.md$/.test(norm)) {
    return ['## Success criteria'];
  }
  if (/\/blueprints\/[^/]+\/explain\.md$/.test(norm)) {
    return ['## Background', '## Intuition', '## Code'];
  }
  if (/^\.bouncer\/context\/epics\/[^/]+\/blueprints\/[^/]+\/index\.md$/.test(norm)) {
    return ['## Intent', '## Contract'];
  }
  const unit = /^\.bouncer\/context\/epics\/[^/]+\/blueprints\/[^/]+\/tasks\/([^/]+)\/([^/]+)$/.exec(norm);
  if (unit && TASK_DIR_RE.test(unit[1]) && unit[2] === TASK_UNIT_BASENAMES[0]) {
    return ['## Goal & intent', '## Interface'];
  }
  return null;
}

/**
 * explain.md `bouncer.task_commits`에서 그래프 검색 헤딩을 파생한다.
 * tasks.md 삭제 뒤에도 task 앵커와 8자리 sha가 질의에 걸리게 한다.
 * 형식: `task-<epic>-<bp>-<id>`, 이어서 `sha`(8 hex). 깨진 항목은 건너뛴다.
 *
 * @param {string} markdown - explain 원본(frontmatter 포함)
 * @param {string} rel - 저장소 상대 경로(explain.md만 대상)
 * @returns {string[]}
 */
function taskCommitHeadings(markdown: string, rel: string): string[] {
  const norm = String(rel || '').replace(/\\/g, '/');
  if (!/\/blueprints\/[^/]+\/explain\.md$/.test(norm)) return [];
  let data: unknown;
  try {
    data = parseFrontmatter(markdown).data;
  } catch (_e) {
    return [];
  }
  if (!data || typeof data !== 'object') return [];
  const bouncer = (data as Record<string, unknown>).bouncer;
  if (!bouncer || typeof bouncer !== 'object') return [];
  const epicId = String((bouncer as Record<string, unknown>).epic_id || '');
  const bpId = String((bouncer as Record<string, unknown>).blueprint_id || '');
  if (!/^\d{3}$/.test(epicId) || !/^\d{3}$/.test(bpId)) return [];
  const rows = (bouncer as Record<string, unknown>).task_commits;
  if (!Array.isArray(rows)) return [];
  const out: string[] = [];
  const seen = new Set<string>();
  for (const row of rows) {
    if (!row || typeof row !== 'object') continue;
    const id = String((row as Record<string, unknown>).id || '');
    if (!TASK_DIR_RE.test(id)) continue;
    const sha = normalizeCommitSha((row as Record<string, unknown>).sha);
    if (!sha) continue;
    const taskAnchor = `task-${epicId}-${bpId}-${id}`;
    for (const label of [taskAnchor, sha]) {
      if (seen.has(label)) continue;
      seen.add(label);
      out.push(label);
    }
  }
  return out;
}

/** YAML frontmatter(`---` … `---`)만 제거. 본문 중간의 --- 는 건드리지 않는다. */
function stripFrontmatter(markdown: unknown): string {
  const text = String(markdown || '');
  if (!text.startsWith('---')) return text;
  const end = text.indexOf('\n---', 3);
  if (end === -1) return text;
  const after = text.slice(end + 4);
  return after.replace(/^\r?\n/, '');
}

/**
 * 문서 경로에서 epic→blueprint→task 계층 앵커를 파생한다.
 * 작성 본문에 앵커를 쓰지 않아도 파생 트리가 검색 좌표를 갖도록 경로 id만 읽는다.
 * 어떤 층의 선행 `\d{3}`(task는 TASK_DIR_RE)가 깨지면 그 층과 하위만 버리고
 * 유효한 상위 앵커는 남긴다. Distill·shard처럼 계층 밖 경로는 빈 배열이다.
 *
 * @param {string} rel - 저장소 상대 문서 경로
 * @returns {string[]} 가장 좁은 앵커부터 부모 순 (`task-…`, `bp-…`, `epic-…`)
 */
function anchorsFor(rel: string): string[] {
  const norm = String(rel || '').replace(/\\/g, '/');
  const m = /^\.bouncer\/context\/epics\/([^/]+)(?:\/(.*))?$/.exec(norm);
  if (!m) return [];

  // 디렉터리명 앞의 세 자리 문자열을 그대로 쓴다. Number로 바꿔 다시 pad 하지 않는다.
  const epicId = /^(\d{3})/.exec(m[1])?.[1];
  if (!epicId) return [];

  const parts = (m[2] || '').split('/').filter(Boolean);
  let bpId: string | undefined;
  let taskId: string | undefined;
  if (parts[0] === 'blueprints' && parts[1]) {
    bpId = /^(\d{3})/.exec(parts[1])?.[1];
    // bp 층이 깨지면 task도 만들지 않는다 — 없는 id를 상위 id로 대신 채우지 않는다.
    if (bpId && parts[2] === 'tasks' && parts[3] && TASK_DIR_RE.test(parts[3])) {
      taskId = parts[3];
    }
  }

  const out: string[] = [];
  if (taskId && bpId) out.push(`task-${epicId}-${bpId}-${taskId}`);
  if (bpId) out.push(`bp-${epicId}-${bpId}`);
  out.push(`epic-${epicId}`);
  return out;
}

/**
 * frontmatter `tags`에서 도메인 검색 어휘만 골라 등장 순·중복 제거로 돌려준다.
 * scaffold가 모든 문서에 찍는 `bouncer`와 `type: bouncer.<kind>`에서 역산한 kind
 * 태그는 god label이 되므로 승격하지 않는다. 종류 목록을 상수로 두면 scaffold가
 * 종류를 늘릴 때 어긋나고, `distill`처럼 kind이면서 도메인 개념인 값을 영영 막는다.
 * 파서는 `tags:` 다음의 `  - value` 줄만 읽는다 — 일반 YAML을 들이면 이 소비 경로가
 * 작성기 스키마에 묶인다. 토큰 집합은 Touch 경로와 같다(`A-Za-z0-9_./-`).
 * 대소문자 변환은 하지 않는다 — graph-search가 비교 시점에 소문자화하므로 여기서
 * 바꾸면 원본 태그와 어긋난다. `description`/`title`은 읽지 않는다.
 *
 * @param {string} markdown - 원본 마크다운 (frontmatter 포함 가능)
 * @returns {string[]} 승격할 태그 배열. frontmatter·tags 배열이 없으면 []
 */
function tagLabels(markdown: string): string[] {
  const text = String(markdown || '');
  if (!text.startsWith('---')) return [];
  const end = text.indexOf('\n---', 3);
  if (end === -1) return [];
  const lines = text.slice(0, end).split(/\r?\n/);

  // 1. type에서 kind 태그 역산. bouncer. 접두만 떼고 표기는 그대로 둔다.
  let kindTag: string | undefined;
  for (const line of lines) {
    const m = /^type:\s*(\S+)\s*$/.exec(line);
    if (!m) continue;
    if (m[1].startsWith('bouncer.')) kindTag = m[1].slice('bouncer.'.length);
    break;
  }

  // 2. tags: 블록의 list item만. 스칼라·빈 블록·다른 키는 배열이 아니므로 [].
  const raw: string[] = [];
  let inTags = false;
  for (const line of lines) {
    if (!inTags) {
      if (line === 'tags:') inTags = true;
      continue;
    }
    const item = /^ {2}- (.+)$/.exec(line);
    if (!item) break;
    raw.push(item[1]);
  }
  if (!raw.length) return [];

  const TOKEN_OK = /^[A-Za-z0-9_./-]+$/;
  const out: string[] = [];
  const seen = new Set<string>();
  for (const tag of raw) {
    if (tag === 'bouncer' || (kindTag !== undefined && tag === kindTag)) continue;
    if (!TOKEN_OK.test(tag) || seen.has(tag)) continue;
    seen.add(tag);
    out.push(tag);
  }
  return out;
}

/**
 * tasks.md의 `## Touch` 절에서 백틱 경로만 등장 순서·중복 제거로 뽑는다.
 * Touch 줄은 `- Modify \`path\` — 이유`처럼 동사·설명이 섞이므로 백틱 스팬만
 * 후보로 보고, 토크나이저가 단일 토큰으로 유지하는 문자 집합
 * (`A-Za-z0-9_./-`)만으로 이뤄진 것을 남긴다. 경로 정규화는 하지 않는다 —
 * 문서 문자열이 곧 파생 헤딩이자 source_file 질의 토큰이다.
 * 절 경계는 extractSections와 같은 `^##\s`다. `## Touch`가 없으면 [].
 *
 * @param {string} markdown - 원본 마크다운 (frontmatter 포함 가능)
 * @returns {string[]} Touch 절의 경로 배열 (등장 순, 중복 제거)
 */
function touchPathHeadings(markdown: string): string[] {
  const body = stripFrontmatter(markdown);
  const lines = body.split(/\r?\n/);
  const starts = [];
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (/^##\s/.test(line)) starts.push({ i, line });
  }

  const hit = starts.find((s) => s.line.trim() === '## Touch');
  if (!hit) return [];
  const idx = starts.indexOf(hit);
  const from = hit.i + 1;
  const to = idx + 1 < starts.length ? starts[idx + 1].i : lines.length;
  const section = lines.slice(from, to).join('\n');

  // 백틱 밖·자리표시자·비ASCII는 승격하지 않는다. Do not touch 절은 경계에서 잘린다.
  const PATH_OK = /^[A-Za-z0-9_./-]+$/;
  const out: string[] = [];
  const seen = new Set<string>();
  for (const m of section.matchAll(/`([^`]+)`/g)) {
    const cand = m[1];
    if (!PATH_OK.test(cand) || seen.has(cand)) continue;
    seen.add(cand);
    out.push(cand);
  }
  return out;
}

/**
 * 요청한 ## 헤딩의 본문만 다음 ## 직전까지 남긴다.
 * 헤딩이 없거나 본문이 비면 해당 섹션은 빼고, 전부 비면 '' 를 돌려준다.
 * 파생 파일 생성 여부는 호출자가 앵커와 함께 판단한다.
 */
function extractSections(markdown: unknown, headings: unknown): string {
  const body = stripFrontmatter(markdown);
  const wanted = Array.isArray(headings) ? headings : [];
  if (!wanted.length) return '';

  const lines = body.split(/\r?\n/);
  const starts = [];
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (/^##\s/.test(line)) starts.push({ i, line });
  }

  const chunks = [];
  for (const heading of wanted) {
    const hit = starts.find((s) => s.line.trim() === heading.trim());
    if (!hit) continue;
    const idx = starts.indexOf(hit);
    const from = hit.i + 1;
    const to = idx + 1 < starts.length ? starts[idx + 1].i : lines.length;
    const sectionBody = lines.slice(from, to).join('\n').replace(/^\n+|\n+$/g, '');
    if (!sectionBody.trim()) continue;
    chunks.push(`${heading}\n\n${sectionBody}`);
  }
  return chunks.length ? chunks.join('\n\n') + '\n' : '';
}

function flattenSlug(rel: string): string {
  return rel.replace(/[^a-zA-Z0-9]+/g, '-').replace(/^-+|-+$/g, '') || 'doc';
}

function uniqueFlatName(base: string, used: Set<string>): string {
  let name = `${base}.md`;
  if (!used.has(name)) {
    used.add(name);
    return name;
  }
  let n = 2;
  while (used.has(`${base}-${n}.md`)) n += 1;
  name = `${base}-${n}.md`;
  used.add(name);
  return name;
}

function walkMarkdownFiles(repoRoot: string, dir: string, acc: string[]): void {
  const abs = path.join(repoRoot, dir);
  let entries;
  try {
    entries = fs.readdirSync(abs, { withFileTypes: true });
  } catch (_e) {
    return;
  }
  for (const e of entries) {
    const childRel = path.posix.join(dir.replace(/\\/g, '/'), e.name);
    if (e.isDirectory()) {
      if (e.isSymbolicLink()) continue;
      walkMarkdownFiles(repoRoot, childRel, acc);
      continue;
    }
    if (e.isFile() && e.name.endsWith('.md')) acc.push(childRel);
  }
}

/**
 * context_dirs 아래 화이트리스트 문서(+ Distill)에서 섹션만 뽑아
 * 평탄 파생 트리와 map.json 을 다시 쓴다. 매 빌드 전체 재생성.
 */
function buildContextDigest({ repoRoot, contextDirs }: {
  repoRoot: string;
  contextDirs?: unknown;
}) {
  const outRel = CONTEXT_DIGEST_OUT;
  const outAbs = path.join(repoRoot, outRel);
  fs.rmSync(outAbs, { recursive: true, force: true });
  fs.mkdirSync(outAbs, { recursive: true });
  // 상위 .gitignore 의 graphify-out/ 을 graphify detect 가 그대로 읽어
  // 이 트리를 빈 입력으로 본다. 로컬 .graphifyignore 로 .md 만 재포함한다.
  fs.writeFileSync(path.join(outAbs, '.graphifyignore'), '*\n!*.md\n');

  const candidates: string[] = [];
  for (const dir of (contextDirs || []) as string[]) {
    walkMarkdownFiles(repoRoot, dir.replace(/\\/g, '/'), candidates);
  }
  for (const watch of DIGEST_WATCH_FILES) {
    if (!candidates.includes(watch)) candidates.push(watch);
  }
  const distill = readShards({ repoRoot });
  if (distill.sharded && distill.valid) {
    for (const shard of distill.shards!) {
      // readShards가 인덱스 정본만 반환하더라도 경로 계약은 여기서 한 번 더
      // 좁힌다. 사용자 지정 경로를 그대로 그래프 원본으로 노출하지 않아야
      // map.json의 source_file이 실제 Distill 샤드 경계를 벗어나지 않는다.
      if (
        typeof shard.path === 'string'
        && digestRulesFor(shard.path)
        && !candidates.includes(shard.path)
      ) {
        candidates.push(shard.path);
      }
    }
  }

  const used = new Set<string>();
  const map: Record<string, string> = {};
  const files: string[] = [];

  for (const rel of candidates) {
    const rules = digestRulesFor(rel);
    if (!rules) continue;
    const abs = path.join(repoRoot, rel);
    let raw;
    try {
      raw = fs.readFileSync(abs, 'utf8');
    } catch (_e) {
      continue;
    }
    const extracted = extractSections(raw, rules);
    const anchors = anchorsFor(rel);
    // Touch 경로 헤딩은 tasks.md 화이트리스트에만. epic/bp index의 Touch는 승격하지 않는다.
    const unit = /^\.bouncer\/context\/epics\/[^/]+\/blueprints\/[^/]+\/tasks\/([^/]+)\/([^/]+)$/.exec(
      String(rel || '').replace(/\\/g, '/'),
    );
    const isTasksBrief = !!(unit && TASK_DIR_RE.test(unit[1]) && unit[2] === TASK_UNIT_BASENAMES[0]);
    const touchPaths = isTasksBrief ? touchPathHeadings(raw) : [];
    // 도메인 tags는 모든 화이트리스트 문서에 붙인다. Touch와 달리 tasks.md 전용이 아니다.
    const tags = tagLabels(raw);
    const commitLabels = taskCommitHeadings(raw, String(rel || ''));
    // 절 본문이 비어도 계층 앵커만 있으면 노드로 남긴다. 둘 다 없으면 예전처럼 생략.
    if (!extracted && anchors.length === 0) continue;

    const flat = uniqueFlatName(flattenSlug(rel), used);
    // graphify·소비자는 파생 이름만 본다. 원본 경로는 본문 헤더와 map.json 이 잇는다.
    // 헤딩 순서: 앵커 → task_commits(explain) → Touch 경로(tasks.md만) → 도메인 태그 → 절 본문.
    let body = `<!-- source: ${rel} -->\n\n`;
    if (anchors.length) {
      body += `${anchors.map((a) => `## ${a}`).join('\n')}\n\n`;
    }
    if (commitLabels.length) {
      body += `${commitLabels.map((c) => `## ${c}`).join('\n')}\n\n`;
    }
    if (touchPaths.length) {
      body += `${touchPaths.map((p) => `## ${p}`).join('\n')}\n\n`;
    }
    if (tags.length) {
      body += `${tags.map((t) => `## ${t}`).join('\n')}\n\n`;
    }
    body += extracted;
    fs.writeFileSync(path.join(outAbs, flat), body);
    map[flat] = rel;
    files.push(flat);
  }

  fs.writeFileSync(path.join(repoRoot, DIGEST_MAP_REL), JSON.stringify(map, null, 2) + '\n');
  return { dir: outRel, files, map, count: files.length };
}

export = {
  CONTEXT_DIGEST_OUT,
  DIGEST_MAP_REL,
  DIGEST_WATCH_FILES,
  digestRulesFor,
  anchorsFor,
  touchPathHeadings,
  tagLabels,
  taskCommitHeadings,
  extractSections,
  buildContextDigest,
};
