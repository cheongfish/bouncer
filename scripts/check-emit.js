'use strict';

const fs = require('node:fs');
const path = require('node:path');
const { spawnSync } = require('node:child_process');
const { resolveSpawn } = require('./spawn-win');

// argv 배열만 넘긴다. 셸 문자열은 경로·플래그 보간에 열려 있고, 이 검사는
// CI·pre-commit이 같은 계약을 공유하므로 한곳의 interpolation 버그가 양쪽을 깨뜨린다.
function run(command, args, opts) {
  // Windows의 npm.cmd 는 shell 없이 spawn 하면 EINVAL 이므로 node 로 npm CLI 를 직접 실행한다.
  const call = resolveSpawn(command, args);
  const result = spawnSync(call.command, call.args, {
    encoding: 'utf8',
    shell: call.shell,
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
 * index에 남은 packages/cli/dist 경로를 거절한다.
 * 워킹트리에 emit이 있어도 추적되어 있으면 생성물을 소스로 취급한 것이고,
 * 성공 조건은 `git ls-files -- packages/cli/dist`가 빈 출력이라 목록을 그대로 보여
 * 어느 파일이 다시 실렸는지 보이게 한다.
 *
 * @param {string} root - git 저장소 루트 절대 경로
 * @returns {void} 추적 파일이 없으면 반환한다. 있으면 stderr 목록 후 exit 1
 */
function rejectTrackedLib(root) {
  const tracked = run('git', ['ls-files', '--', 'packages/cli/dist'], {
    cwd: root,
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  if (tracked.status !== 0) {
    process.stderr.write(tracked.stderr || 'check-emit: git ls-files failed\n');
    process.exit(tracked.status == null ? 1 : tracked.status);
  }
  if (tracked.stdout.trim()) {
    process.stderr.write('check-emit: packages/cli/dist must not be tracked\n');
    process.stderr.write(tracked.stdout);
    process.exit(1);
  }
}

/**
 * 빌드 뒤 ignore되지 않은 emit을 거절한다.
 * porcelain status는 쓰지 않고 `--others --exclude-standard`만 본다. 비어
 * 있어야 `.gitignore`의 `packages/cli/dist/`가 다음 커밋에 emit을 다시 실리지
 * 않게 막고 있다는 뜻이다.
 *
 * @param {string} root - git 저장소 루트 절대 경로
 * @returns {void} ignore되면 반환한다. 아니면 stderr 목록 후 exit 1
 */
function rejectUnignoredLib(root) {
  const untracked = run(
    'git',
    ['ls-files', '--others', '--exclude-standard', '--', 'packages/cli/dist'],
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
    process.stderr.write('check-emit: packages/cli/dist is not ignored\n');
    process.stderr.write(untracked.stdout);
    process.exit(1);
  }
}

// 체크인 `.codex/agents/*.toml`을 만드는 명시적 fixture 설정. roles가 비어 전 역할이
// 기본 effort(medium)다. 저장소 `.bouncer/config.json`은 개발자 개인 설정이라 그것을 읽으면
// 같은 커밋이 사람마다 다른 생성본을 정본으로 삼는다.
const CODEX_FIXTURE_CONFIG = { roles: {} };

/**
 * index에 스테이징된 `.codex/agents/<name>.toml`이 fixture 설정 기준 생성본과 바이트
 * 일치하는지 검사한다. 워킹트리가 아니라 index를 보는 이유는 pre-commit이 커밋될 바이트를
 * 막아야 하기 때문이다(CI에서는 index가 HEAD와 같다). 빌드 뒤에만 호출한다 — 변환기는
 * `packages/cli/dist`에서 읽는다.
 *
 * 역할 문서 디렉터리 `agents/`가 없는 저장소(emit 추적 계약만 재현하는 fixture 등)는
 * 비교할 정본이 없으므로 건너뛴다. `agents/`가 있는데 변환기를 못 읽으면 빌드 결함이라
 * require 오류로 그대로 실패한다.
 *
 * @param {string} root - git 저장소 루트 절대 경로
 * @returns {void} 전부 일치하거나 `agents/`가 없으면 반환한다. 아니면 어긋난 경로를 stderr에 쓰고 exit 1
 */
function rejectStaleCodexAgents(root) {
  if (!fs.existsSync(path.join(root, 'agents'))) return;
  const { NAMED_AGENTS, mdToCodexToml, resolveCodexEfforts } = require(
    path.join(root, 'packages/cli/dist/codex-agents'),
  );
  const { efforts } = resolveCodexEfforts(CODEX_FIXTURE_CONFIG);
  const stale = [];
  for (const name of NAMED_AGENTS) {
    const rel = `.codex/agents/${name}.toml`;
    const staged = run('git', ['show', `:${rel}`], {
      cwd: root,
      stdio: ['ignore', 'pipe', 'pipe'],
    });
    const markdown = fs.readFileSync(path.join(root, 'agents', `${name}.md`), 'utf8');
    // 추적되지 않은 파일도 git show가 0이 아니다. 누락도 생성본 불일치로 같이 보고한다.
    if (staged.status !== 0 || staged.stdout !== mdToCodexToml(markdown, efforts[name])) {
      stale.push(rel);
    }
  }
  if (stale.length > 0) {
    process.stderr.write('check-emit: staged .codex/agents toml differs from the fixture-generated toml\n');
    process.stderr.write(`${stale.join('\n')}\n`);
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
rejectStaleCodexAgents(root);

process.exit(0);
