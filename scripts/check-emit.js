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

/**
 * index에 남은 scripts/lib 경로를 거절한다.
 * 워킹트리에 emit이 있어도 추적되어 있으면 생성물을 소스로 취급한 것이고,
 * 성공 조건은 `git ls-files -- scripts/lib`가 빈 출력이라 목록을 그대로 보여
 * 어느 파일이 다시 실렸는지 보이게 한다.
 *
 * @param {string} root - git 저장소 루트 절대 경로
 * @returns {void} 추적 파일이 없으면 반환한다. 있으면 stderr 목록 후 exit 1
 */
function rejectTrackedLib(root) {
  const tracked = run('git', ['ls-files', '--', 'scripts/lib'], {
    cwd: root,
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  if (tracked.status !== 0) {
    process.stderr.write(tracked.stderr || 'check-emit: git ls-files failed\n');
    process.exit(tracked.status == null ? 1 : tracked.status);
  }
  if (tracked.stdout.trim()) {
    process.stderr.write('check-emit: scripts/lib must not be tracked\n');
    process.stderr.write(tracked.stdout);
    process.exit(1);
  }
}

/**
 * 빌드 뒤 ignore되지 않은 emit을 거절한다.
 * porcelain status는 쓰지 않고 `--others --exclude-standard`만 본다. 비어
 * 있어야 `.gitignore`의 `scripts/lib/`가 다음 커밋에 emit을 다시 실리지
 * 않게 막고 있다는 뜻이다.
 *
 * @param {string} root - git 저장소 루트 절대 경로
 * @returns {void} ignore되면 반환한다. 아니면 stderr 목록 후 exit 1
 */
function rejectUnignoredLib(root) {
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
    process.stderr.write('check-emit: scripts/lib is not ignored\n');
    process.stderr.write(untracked.stdout);
    process.exit(1);
  }
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

rejectTrackedLib(root);
rejectUnignoredLib(root);

process.exit(0);
