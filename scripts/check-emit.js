'use strict';

const { spawnSync } = require('node:child_process');

// argv 배열만 넘긴다. 셸 문자열은 경로·플래그 보간에 열려 있고, 이 검사는
// CI·pre-commit이 같은 계약을 공유하므로 한곳의 interpolation 버그가 양쪽을 깨뜨린다.
function run(command, args, opts) {
  const result = spawnSync(command, args, {
    encoding: 'utf8',
    ...opts,
  });
  if (result.error) {
    process.stderr.write(`check-emit: failed to spawn ${command}: ${result.error.message}\n`);
    process.exit(1);
  }
  return result;
}

function gitRoot() {
  const result = run('git', ['rev-parse', '--show-toplevel'], {
    cwd: process.cwd(),
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  if (result.status !== 0) {
    process.stderr.write(result.stderr || 'check-emit: git rev-parse --show-toplevel failed\n');
    process.exit(result.status == null ? 1 : result.status);
  }
  return result.stdout.trim();
}

const root = gitRoot();

// Windows에서 npm 은 npm.cmd 이다. execFile/spawnSync 는 PATHEXT 를 셸처럼
// 펼치지 않으므로 확장자를 직접 고른다.
const npm = process.platform === 'win32' ? 'npm.cmd' : 'npm';
const build = run(npm, ['run', 'build'], {
  cwd: root,
  stdio: 'inherit',
});
if (build.status !== 0) {
  process.exit(build.status == null ? 1 : build.status);
}

// porcelain status 는 이미 스테이징된 정상 TS/CJS 까지 dirty 로 본다.
// 워킹트리 unstaged diff 만 보면 커밋 직전 스테이징된 emit 은 통과하고,
// 빌드가 스테이징된 CJS 를 다시 바꾼 경우에만 실패한다.
const diff = run('git', ['diff', '--exit-code', '--', 'scripts/lib'], {
  cwd: root,
  stdio: ['ignore', 'pipe', 'pipe'],
});
if (diff.status !== 0) {
  process.stderr.write('check-emit: unstaged changes under scripts/lib after build\n');
  if (diff.stdout) process.stderr.write(diff.stdout);
  if (diff.stderr) process.stderr.write(diff.stderr);
  process.exit(1);
}

const untracked = run(
  'git',
  ['ls-files', '--others', '--exclude-standard', '--', 'scripts/lib'],
  {
    cwd: root,
    stdio: ['ignore', 'pipe', 'pipe'],
  },
);
if (untracked.status !== 0) {
  process.stderr.write(untracked.stderr || 'check-emit: git ls-files failed\n');
  process.exit(untracked.status == null ? 1 : untracked.status);
}
if (untracked.stdout.trim()) {
  process.stderr.write('check-emit: untracked files under scripts/lib after build:\n');
  process.stderr.write(untracked.stdout);
  process.exit(1);
}

process.exit(0);
