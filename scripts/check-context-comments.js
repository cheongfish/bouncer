'use strict';

const fs = require('node:fs');
const path = require('node:path');
const { spawnSync } = require('node:child_process');
const { SCAFFOLD_COMMENT_BODIES, normalizeCommentBody } = require('./lib/templates');

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

function changedContextFiles(repoRoot, base) {
  // 삭제(D)는 diff 결과에 남지만 읽을 파일이 없으므로 diff-filter로 제외한다.
  const changed = splitGitNames(runGit(repoRoot, [
    'diff', '--name-only', '-z', '--diff-filter=ACMRTUXB', base, '--', CONTEXT_ROOT,
  ]));
  // ls-files는 diff에 나타나지 않는 새 미추적 파일을 보완한다.
  const untracked = splitGitNames(runGit(repoRoot, [
    'ls-files', '--others', '--exclude-standard', '-z', '--', CONTEXT_ROOT,
  ]));
  return [...new Set([...changed, ...untracked])]
    .filter((relative) => isContextMarkdown(relative))
    .filter((relative) => fs.existsSync(path.join(repoRoot, relative)));
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
