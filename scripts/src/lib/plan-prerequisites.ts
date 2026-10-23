'use strict';

const fs = require('node:fs');
const path = require('node:path');
const { spawnSync } = require('node:child_process');
import layout = require('./layout');
const { isCanonicalBlueprintDir, normalizeRepoPath } = layout;
import frontmatter = require('./frontmatter');
const { readDoc } = frontmatter;

import schema = require('./schema');
const { PREREQUISITE_MERGED_COMMIT_RE: MERGED_COMMIT_RE } = schema;

type GitResult = { status: number; stdout: string };
type GitExec = (args: string[]) => GitResult;
type CommitState = 'merged' | 'unmerged' | 'object-missing' | 'lookup-error';
type PrerequisiteEntry = {
  blueprint: string;
  merged_commit: string;
  blueprintFound: boolean;
  commitState: CommitState;
};
type PrerequisiteReport = {
  formatIssues: string[];
  entries: PrerequisiteEntry[];
  cycles: string[][];
};

/**
 * `bouncer.prerequisites` 한 값의 형식만 판정한다. 부재(undefined)와 `[]`는 선행 없음이라 통과한다.
 * 존재·순환·병합 여부는 보지 않는다(helper가 판정 데이터로 돌려준다). validate-structural의 S39가
 * 이 목록을 그대로 실패로 옮겨, 구조 검사와 helper가 같은 형식 판정을 쓰게 한다.
 *
 * @param {unknown} value - 프론트매터의 prerequisites 값. 키가 없으면 undefined
 * @param {string} selfDir - 이 선언을 가진 blueprint의 저장소 상대 디렉터리(자기참조 판정용)
 * @returns {string[]} 위반 설명 목록. 비어 있으면 형식이 맞다
 */
function prerequisiteFormatIssues(value: unknown, selfDir: string): string[] {
  if (value === undefined) return [];
  if (!Array.isArray(value)) return ['prerequisites must be an array of {blueprint, merged_commit}'];
  const issues: string[] = [];
  const seen = new Set<string>();
  const self = normalizeRepoPath(selfDir);
  value.forEach((entry, i) => {
    const label = `prerequisites[${i}]`;
    if (entry === null || typeof entry !== 'object' || Array.isArray(entry)) {
      issues.push(`${label} must be an object with blueprint and merged_commit`);
      return;
    }
    const rec = entry as Record<string, unknown>;
    const keys = Object.keys(rec).sort().join(',');
    if (keys !== 'blueprint,merged_commit') {
      issues.push(`${label} must have exactly blueprint and merged_commit`);
      return;
    }
    const { blueprint, merged_commit: commit } = rec;
    // 백슬래시·끝 슬래시·파일 경로는 같은 blueprint를 다른 문자열로 적게 하므로 정본 문자열 그대로만 받는다.
    const canonical = typeof blueprint === 'string'
      && normalizeRepoPath(blueprint) === blueprint && isCanonicalBlueprintDir(blueprint);
    if (!canonical) issues.push(`${label}.blueprint must be a canonical blueprint directory`);
    if (typeof commit !== 'string' || !MERGED_COMMIT_RE.test(commit)) {
      issues.push(`${label}.merged_commit must be a 40-char lowercase sha`);
    }
    if (!canonical) return;
    if (blueprint === self) issues.push(`${label}.blueprint must not reference itself`);
    else if (seen.has(blueprint as string)) issues.push(`${label}.blueprint duplicates an earlier entry`);
    seen.add(blueprint as string);
  });
  return issues;
}

/**
 * 기본 Git 실행기. 셸을 거치지 않고 argv 배열로만 호출해 SHA·경로가 명령으로 해석될 여지를 없앤다.
 * spawn 자체가 실패하면(status null) -1로 돌려 "미병합"(exit 1)과 섞이지 않게 한다.
 *
 * @param {string} repoRoot - git을 실행할 저장소 루트
 * @returns {GitExec} argv → {status, stdout}
 */
function defaultExec(repoRoot: string): GitExec {
  return (args) => {
    const r = spawnSync('git', args, { cwd: repoRoot, encoding: 'utf8' });
    return { status: typeof r.status === 'number' ? r.status : -1, stdout: r.stdout || '' };
  };
}

/**
 * blueprint index.md의 prerequisites 원값을 읽는다. 문서가 없거나 frontmatter를 못 읽으면
 * found/raw를 비워 돌려준다 — 참조 누락은 report의 blueprintFound로, 형식 오류는 그 문서의 S39로
 * 따로 드러나므로 여기서 던지면 한 문서의 오류가 전체 판정을 가린다. 그 밖의 오류(권한 등)는 다시 던진다.
 *
 * @param {string} repoRoot - 저장소 루트
 * @param {string} dir - blueprint 디렉터리(저장소 상대)
 * @returns {{found: boolean, raw: unknown}} 문서 존재 여부와 prerequisites 원값
 */
function readPrerequisites(repoRoot: string, dir: string): { found: boolean; raw: unknown } {
  let data: unknown;
  try {
    data = readDoc(path.join(repoRoot, dir, 'index.md')).data;
  } catch (err) {
    const e = err as { code?: string; name?: string; message?: string };
    if (e.code === 'ENOENT' || e.code === 'ENOTDIR') return { found: false, raw: undefined };
    // 흡수: frontmatter 부재·YAML 오류(해당 문서의 구조 검사가 별도로 거절). 나머지는 그대로 올린다.
    if (e.name === 'YAMLException' || e.message === 'missing frontmatter block') {
      return { found: true, raw: undefined };
    }
    throw err;
  }
  const bouncer = (data as { bouncer?: unknown } | null)?.bouncer;
  const raw = bouncer && typeof bouncer === 'object'
    ? (bouncer as Record<string, unknown>).prerequisites : undefined;
  return { found: true, raw };
}

/** 형식이 맞는 항목의 blueprint 경로만 뽑는다(순환 탐색용). 자기참조는 형식 위반이라 제외한다. */
function wellFormedTargets(raw: unknown, selfDir: string): string[] {
  if (!Array.isArray(raw)) return [];
  const out: string[] = [];
  for (const entry of raw) {
    const bp = entry && typeof entry === 'object' ? (entry as Record<string, unknown>).blueprint : undefined;
    if (typeof bp === 'string' && isCanonicalBlueprintDir(bp) && bp !== selfDir) out.push(bp);
  }
  return out;
}

/**
 * 선행 선언 그래프에서 순환을 찾는다. 선언된 blueprint 문서만 따라가며 파일은 쓰지 않는다.
 *
 * @param {string} repoRoot - 저장소 루트
 * @param {string} start - 탐색을 시작할 blueprint 디렉터리
 * @returns {string[][]} 순환 경로 목록(첫 원소와 마지막 원소가 같다). 없으면 빈 배열
 */
function findCycles(repoRoot: string, start: string): string[][] {
  const cycles: string[][] = [];
  const done = new Set<string>();
  const stack: string[] = [];
  const visit = (dir: string): void => {
    const at = stack.indexOf(dir);
    if (at >= 0) { cycles.push([...stack.slice(at), dir]); return; }
    if (done.has(dir)) return;
    stack.push(dir);
    for (const next of wellFormedTargets(readPrerequisites(repoRoot, dir).raw, dir)) visit(next);
    stack.pop();
    done.add(dir);
  };
  visit(start);
  return cycles;
}

/**
 * 한 병합 commit의 상태를 Git으로 판정한다. `rev-parse --verify --quiet`는 object 부재를 exit 1로,
 * `merge-base --is-ancestor`는 비조상을 exit 1로 알려 주고 그 밖의 실패는 둘 다 조회 오류다.
 * 어느 쪽도 통과로 접지 않는다. 기준은 현재 checkout HEAD이며 원격·저장된 base는 보지 않는다.
 *
 * @param {GitExec} exec - Git 실행 seam
 * @param {string} sha - 선언된 병합 결과 commit
 * @returns {CommitState} merged | unmerged | object-missing | lookup-error
 */
function commitStateOf(exec: GitExec, sha: string): CommitState {
  const found = exec(['rev-parse', '--verify', '--quiet', `${sha}^{commit}`]);
  if (found.status === 1) return 'object-missing';
  if (found.status !== 0) return 'lookup-error';
  const anc = exec(['merge-base', '--is-ancestor', sha, 'HEAD']);
  if (anc.status === 0) return 'merged';
  return anc.status === 1 ? 'unmerged' : 'lookup-error';
}

/**
 * blueprint가 선언한 선행 병합 근거를 읽기 전용으로 판정한다. 파일을 쓰지 않고 승인·gate에 연결하지 않는다.
 * 선언이 없으면 형식·항목·순환이 모두 비어 있는 보고를 돌려준다.
 *
 * @param {{repoRoot: string, blueprintDir: string, exec?: GitExec}} input - 저장소 루트, 대상 blueprint
 *   디렉터리, 테스트용 Git seam(기본은 셸 없는 git spawnSync)
 * @returns {PrerequisiteReport} formatIssues는 S39 후보, entries는 형식이 맞는 항목별 존재·병합 판정,
 *   cycles는 선행 선언 순환 경로
 */
function checkPrerequisites(
  { repoRoot, blueprintDir, exec }: { repoRoot: string; blueprintDir: string; exec?: GitExec },
): PrerequisiteReport {
  const run = exec || defaultExec(repoRoot);
  const dir = normalizeRepoPath(blueprintDir);
  const { raw } = readPrerequisites(repoRoot, dir);
  const formatIssues = prerequisiteFormatIssues(raw, dir);
  const entries: PrerequisiteEntry[] = [];
  if (Array.isArray(raw)) {
    for (const entry of raw) {
      const rec = (entry && typeof entry === 'object' ? entry : {}) as Record<string, unknown>;
      const { blueprint, merged_commit: commit } = rec;
      // 형식이 틀린 항목은 S39가 이미 보고하므로 Git에 보내지 않는다(잘못된 문자열을 git 인자로 넘기지 않기 위함).
      if (typeof blueprint !== 'string' || !isCanonicalBlueprintDir(blueprint) || blueprint === dir) continue;
      if (typeof commit !== 'string' || !MERGED_COMMIT_RE.test(commit)) continue;
      entries.push({
        blueprint,
        merged_commit: commit,
        blueprintFound: fs.existsSync(path.join(repoRoot, blueprint, 'index.md')),
        commitState: commitStateOf(run, commit),
      });
    }
  }
  return { formatIssues, entries, cycles: raw === undefined ? [] : findCycles(repoRoot, dir) };
}

export = { prerequisiteFormatIssues, checkPrerequisites };
