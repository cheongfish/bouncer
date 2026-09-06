'use strict';

const fs = require('node:fs');
const path = require('node:path');
const { spawnSync } = require('node:child_process');
const { SCAFFOLD_COMMENT_BODIES, normalizeCommentBody } = require('./lib/templates');
const { readCurrent } = require('./lib/current');
const { parseFrontmatter } = require('./lib/frontmatter');
const { listTasksDocs } = require('./lib/tasks-docs');

const CONTEXT_ROOT = '.bouncer/context';
const COMMENT_RE = /<!--[\s\S]*?-->/g;
const TODO_RE = /<TODO:/;
const SCAFFOLD_COMMENTS = new Set(SCAFFOLD_COMMENT_BODIES);

function runGit(repoRoot, args) {
  // ref와 경로는 사용자·CI 입력이므로 spawnSync의 argv 칸으로만 전달한다.
  // 셸을 거치면 ref가 명령 문자열로 재해석될 수 있다.
  const result = spawnSync('git', args, {
    cwd: repoRoot,
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  if (result.error) {
    throw new Error(`git 실행 실패: ${result.error.message}`);
  }
  if (result.status !== 0) {
    const detail = (result.stderr || '').trim();
    throw new Error(detail || 'git 명령 실패');
  }
  return result.stdout;
}

function gitRoot(cwd) {
  return runGit(cwd, ['rev-parse', '--show-toplevel']).trim();
}

function normalizeRelativePath(repoRoot, candidate) {
  const absolute = path.resolve(repoRoot, candidate);
  const relative = path.relative(repoRoot, absolute).split(path.sep).join('/');
  if (!relative || relative === '..' || relative.startsWith('../') || path.isAbsolute(relative)) {
    return null;
  }
  return relative;
}

function isContextMarkdown(relative) {
  return relative.startsWith(`${CONTEXT_ROOT}/`) && relative.endsWith('.md');
}

function parseArgs(argv) {
  let base = 'HEAD';
  const files = [];
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === '--') continue;
    if (arg === '--base') {
      const value = argv[i + 1];
      if (!value || value === '--') throw new Error('--base에는 Git ref가 필요합니다');
      base = value;
      i += 1;
      continue;
    }
    if (arg.startsWith('--')) throw new Error(`알 수 없는 옵션: ${arg}`);
    files.push(arg);
  }
  return { base, files };
}

function splitGitNames(output) {
  return output.split('\0').filter(Boolean);
}

function activeTaskUnit(repoRoot) {
  const current = readCurrent({ repoRoot });
  if (!current || !current.task) return null;
  const listing = listTasksDocs({ repoRoot, blueprintDir: current.blueprint });
  const unit = listing.entries.find((entry) => entry.rel === current.task);
  return unit ? { unit, units: listing.entries } : null;
}

/**
 * 후보 문서 하나의 `bouncer.status`만 읽는다. 묶음 대표값으로 합성하지 않는다.
 * 파싱 실패·필드 부재는 pending으로 추정하지 않는다 — 숨기면 깨진 sibling이
 * 자동 검사를 통과한다.
 *
 * @param {string} repoRoot - 저장소 루트 절대 경로
 * @param {string} relative - 후보 문서의 저장소 상대 경로
 * @returns {unknown} 읽은 status, 없거나 파싱에 실패하면 undefined
 */
function documentBouncerStatus(repoRoot, relative) {
  try {
    const raw = fs.readFileSync(path.join(repoRoot, relative), 'utf8');
    const { data } = parseFrontmatter(raw);
    const bouncer = data ? data.bouncer : data;
    return bouncer ? bouncer.status : undefined;
  } catch {
    return undefined;
  }
}

/**
 * 다른 listed unit의 문서이며 그 문서의 frontmatter status가 pending인지 본다.
 * 같은 묶음 leaf까지 sibling으로 보면 실행 중인 verification/review가 빠지고,
 * 경로만으로 다른 묶음 전체를 빼면 ready sibling이 숨는다.
 * 활성 포인터와 task 목록 해석은 그대로 둔다.
 *
 * @param {string} repoRoot - 저장소 루트 절대 경로
 * @param {string} relative - 후보 문서의 저장소 상대 경로
 * @param {{ dir: string, rel: string }} activeUnit - 포인터가 가리키는 현재 task 묶음
 * @param {Array<{ dir: string }>} units - 같은 blueprint의 task 묶음 목록
 * @returns {boolean} pending sibling이면 true (자동 검사에서 제외)
 */
function isPendingTaskSibling(repoRoot, relative, activeUnit, units) {
  // sibling은 다른 unit이다. 활성 묶음 안 문서는 status와 무관하게 검사한다.
  const inSiblingUnit = units.some(
    (unit) => unit.dir !== activeUnit.dir && relative.startsWith(`${unit.dir}/`),
  );
  if (!inSiblingUnit) return false;
  return documentBouncerStatus(repoRoot, relative) === 'pending';
}

function changedContextFiles(repoRoot, base) {
  // 삭제(D)는 diff 결과에 남지만 읽을 파일이 없으므로 diff-filter로 제외한다.
  const changed = splitGitNames(runGit(repoRoot, [
    'diff', '--name-only', '-z', '--diff-filter=ACMRTUXB', base, '--', CONTEXT_ROOT,
  ]));
  // ls-files는 diff에 나타나지 않는 새 미추적 파일을 보완한다.
  const untracked = splitGitNames(runGit(repoRoot, [
    'ls-files', '--others', '--exclude-standard', '-z', '--', CONTEXT_ROOT,
  ]));
  const candidates = [...new Set([...changed, ...untracked])]
    .filter((relative) => isContextMarkdown(relative))
    .filter((relative) => fs.existsSync(path.join(repoRoot, relative)));
  const active = activeTaskUnit(repoRoot);
  if (!active) return candidates;
  // 실행 포인터가 있으면 sibling 중 pending 문서만 건너뛴다. 인자로 넘긴
  // 파일 목록은 이 함수를 타지 않으므로 explicit-file 경로는 그대로 검사한다.
  return candidates.filter((relative) => (
    !isPendingTaskSibling(repoRoot, relative, active.unit, active.units)
  ));
}

function validateBase(repoRoot, base) {
  runGit(repoRoot, ['rev-parse', '--verify', `${base}^{commit}`]);
}

function explicitContextFiles(repoRoot, files) {
  const normalized = files.map((candidate) => {
    const relative = normalizeRelativePath(repoRoot, candidate);
    if (!relative || !isContextMarkdown(relative)) {
      throw new Error(`컨텍스트 Markdown 경로가 아닙니다: ${candidate}`);
    }
    return relative;
  });
  return [...new Set(normalized)].filter((relative) => fs.existsSync(path.join(repoRoot, relative)));
}

function violationsFor(body) {
  const violations = [];
  if (TODO_RE.test(body)) violations.push('<TODO: 플레이스홀더');
  for (const comment of body.matchAll(COMMENT_RE)) {
    const normalized = normalizeCommentBody(comment[0].slice(4, -3));
    if (SCAFFOLD_COMMENTS.has(normalized)) violations.push('스캐폴드 안내 주석');
  }
  return violations;
}

function checkContextComments({ repoRoot, base = 'HEAD', files = [] }) {
  // 파일 인자가 있으면 Git 상태를 추측하지 않고 그 파일만 읽는다.
  // 인자가 없을 때만 base diff와 미추적 목록을 합쳐 변경 범위를 만든다.
  validateBase(repoRoot, base);
  const targets = files.length
    ? explicitContextFiles(repoRoot, files)
    : changedContextFiles(repoRoot, base);
  const failures = [];
  for (const relative of targets) {
    const body = fs.readFileSync(path.join(repoRoot, relative), 'utf8');
    for (const violation of violationsFor(body)) failures.push({ relative, violation });
  }
  return { targets, failures };
}

function main(argv = process.argv.slice(2)) {
  try {
    const { base, files } = parseArgs(argv);
    const repoRoot = gitRoot(process.cwd());
    const result = checkContextComments({ repoRoot, base, files });
    for (const failure of result.failures) {
      process.stderr.write(`check-context-comments: ${failure.relative}: ${failure.violation}가 남아 있습니다\n`);
    }
    if (result.failures.length) return 1;
    process.stdout.write(`check-context-comments: ok (${result.targets.length} files)\n`);
    return 0;
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    process.stderr.write(`check-context-comments: ${message}\n`);
    return 1;
  }
}

if (require.main === module) process.exitCode = main();

module.exports = {
  CONTEXT_ROOT,
  changedContextFiles,
  checkContextComments,
  explicitContextFiles,
  isContextMarkdown,
  normalizeRelativePath,
  parseArgs,
  violationsFor,
};
