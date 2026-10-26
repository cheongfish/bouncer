'use strict';

const crypto = require('node:crypto');
const { spawnSync } = require('node:child_process');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { isStrictSemver, syncVersions } = require('./sync-versions');
const { resolveSpawn } = require('./spawn-win');

const PACKAGE = '@cheongfish/bouncer';
const REGISTRY = 'https://registry.npmjs.org';
const TAG_PREFIX = 'refs/tags/bouncer--v';
const NPM = process.platform === 'win32' ? 'npm.cmd' : 'npm';

/**
 * 외부 명령을 셸 없이 실행한다. 명령과 인자는 고정 배열로 전달해 ref/path가 셸로 해석되지 않는다.
 *
 * @param {string} command - 실행 파일
 * @param {string[]} args - 인자 배열
 * @param {{cwd: string, env: NodeJS.ProcessEnv}} opts - 작업 디렉터리와 환경
 * @returns {{status: number | null, stdout: string, stderr: string}} 프로세스 결과
 */
function defaultRun(command, args, opts) {
  const call = resolveSpawn(command, args);
  const result = spawnSync(call.command, call.args, {
    cwd: opts.cwd, env: opts.env, encoding: 'utf8', maxBuffer: 10 * 1024 * 1024, shell: call.shell,
  });
  return { status: result.status, stdout: result.stdout || '', stderr: result.stderr || result.error?.message || '' };
}

/**
 * 로컬 입력을 검사하고 npm 불변 버전을 확인한 뒤 plugin release branch를 갱신한다.
 * npm 단계가 성공하기 전에는 Git 명령을 실행하지 않으며, 동일 tree면 commit/push를 생략한다.
 *
 * @param {{mode: string, tarball: string, metadata: string, pluginTree: string, root?: string,
 *   env?: NodeJS.ProcessEnv, deps?: {run?: typeof defaultRun}}} opts - 실행 입력과 의존 경계
 * @returns {{ok: true, mode: string, version: string, npm: string, plugin: string}} 게시 결과
 */
function releaseRuntime(opts) {
  const root = path.resolve(opts.root || process.cwd());
  const env = opts.env || process.env;
  const run = opts.deps?.run || defaultRun;
  const meta = JSON.parse(fs.readFileSync(path.resolve(opts.metadata), 'utf8'));
  if (!Array.isArray(meta) || !meta[0] || typeof meta[0] !== 'object') {
    throw new Error('metadata must be npm pack JSON');
  }
  const pack = meta[0];
  // 버전 정본은 루트 package.json이다. 별도 검사기를 만들지 않고 syncVersions check를 재사용해
  // host manifest/lockfile drift를 어떤 외부 호출보다 먼저 막는다(drift면 여기서 throw).
  const rootVersion = syncVersions({ root, mode: 'check' }).version;
  const pluginPkg = JSON.parse(fs.readFileSync(path.join(opts.pluginTree, 'package.json'), 'utf8'));
  const pluginManifest = JSON.parse(fs.readFileSync(path.join(opts.pluginTree, 'plugin.json'), 'utf8'));
  const tag = env.GITHUB_REF || '';
  if (pack.name !== PACKAGE || rootVersion !== pack.version || pluginPkg.version !== pluginManifest.version) {
    throw new Error('package name or runtime/plugin metadata mismatch');
  }
  const { assertPluginVersion } = require('../packages/cli/dist/plugin-root');
  try {
    assertPluginVersion({
      version: pluginManifest.version,
      runtimeCompatibility: pluginManifest.runtimeCompatibility,
    }, pack.version);
  } catch (error) {
    throw new Error(`plugin runtime compatibility check failed: ${error.message}`, { cause: error });
  }
  if (opts.mode === 'publish') {
    // 전체 SemVer 문자열(+build 포함)을 비교한다. 정규식 대신 정본 검사기를 써 두 경로가 갈라지지 않게 한다.
    if (env.GITHUB_EVENT_NAME !== 'push' || !tag.startsWith(TAG_PREFIX)
      || !isStrictSemver(tag.slice(TAG_PREFIX.length)) || tag.slice(TAG_PREFIX.length) !== pack.version) {
      throw new Error('publish requires a matching bouncer--v SemVer push tag');
    }
    const bytes = fs.readFileSync(path.resolve(opts.tarball));
    const integrity = `sha512-${crypto.createHash('sha512').update(bytes).digest('base64')}`;
    if (!pack.integrity || pack.integrity !== integrity) throw new Error('tarball integrity mismatch');
  } else if (opts.mode !== 'dry-run') {
    throw new Error('mode must be dry-run or publish');
  }

  if (opts.mode === 'dry-run') return { ok: true, mode: opts.mode, version: pack.version,
    npm: 'dry-run', plugin: 'dry-run' };

  const query = run(NPM, ['view', `${PACKAGE}@${pack.version}`, '--json', '--registry', REGISTRY], { cwd: root, env });
  let npmState = 'verified-existing';
  if (query.status !== 0) {
    let error;
    try { error = JSON.parse(query.stderr || query.stdout); } catch (err) {
      if (!(err instanceof SyntaxError)) throw err;
      throw new Error(`npm registry lookup failed: ${query.stderr || query.stdout}`, { cause: err });
    }
    const registryError = error?.error || error;
    // 정확한 E404 + pkgid 일치만 "아직 없는 버전"이다. summary 같은 자유 문자열은 판정에 쓰지 않는다.
    if (registryError?.code !== 'E404' || registryError.pkgid !== `${PACKAGE}@${pack.version}`) {
      throw new Error(`npm registry lookup failed: ${query.stderr || query.stdout}`);
    }
    const publish = run(NPM, ['publish', path.resolve(opts.tarball), '--access', 'public', '--registry', REGISTRY],
      { cwd: root, env });
    if (publish.status !== 0) throw new Error(`npm publish failed: ${publish.stderr || publish.stdout}`);
    npmState = 'published';
  } else {
    assertRegistryArtifact(query.stdout, pack);
  }
  const confirmed = run(NPM, ['view', `${PACKAGE}@${pack.version}`, '--json', '--registry', REGISTRY],
    { cwd: root, env });
  if (confirmed.status !== 0) {
    throw new Error(`npm registry confirmation failed: ${confirmed.stderr || confirmed.stdout}`);
  }
  assertRegistryArtifact(confirmed.stdout, pack);

  const git = (args, cwd = root) => {
    const result = run('git', args, { cwd, env });
    return result;
  };
  const ls = git(['ls-remote', '--exit-code', '--heads', 'origin', 'refs/heads/release']);
  let remoteExists = true;
  if (ls.status === 2 && !ls.stdout.trim() && !ls.stderr.trim()) remoteExists = false;
  else if (ls.status !== 0) throw new Error(`git ls-remote failed: ${ls.stderr || ls.stdout}`);
  const temp = fs.mkdtempSync(path.join(os.tmpdir(), 'bouncer-release-'));
  const worktree = path.join(temp, 'worktree');
  try {
    if (remoteExists) {
      const fetch = git(['fetch', '--no-tags', 'origin', 'refs/heads/release:refs/remotes/origin/release']);
      if (fetch.status !== 0) throw new Error(`git fetch failed: ${fetch.stderr || fetch.stdout}`);
      const add = git(['worktree', 'add', '--detach', worktree, 'refs/remotes/origin/release']);
      if (add.status !== 0) throw new Error(`git worktree add failed: ${add.stderr || add.stdout}`);
    } else {
      const add = git(['worktree', 'add', '--detach', worktree, 'HEAD']);
      if (add.status !== 0) throw new Error(`git worktree add failed: ${add.stderr || add.stdout}`);
      const orphan = git(['checkout', '--orphan', 'release'], worktree);
      if (orphan.status !== 0) throw new Error(`git orphan checkout failed: ${orphan.stderr || orphan.stdout}`);
      const clear = git(['rm', '-rf', '--quiet', '--ignore-unmatch', '.'], worktree);
      if (clear.status !== 0) throw new Error(`git index reset failed: ${clear.stderr || clear.stdout}`);
    }
    for (const name of fs.readdirSync(worktree)) {
      if (name !== '.git') fs.rmSync(path.join(worktree, name), { recursive: true, force: true });
    }
    fs.cpSync(path.resolve(opts.pluginTree), worktree, { recursive: true });
    const addAll = git(['add', '-A'], worktree);
    if (addAll.status !== 0) throw new Error(`git add failed: ${addAll.stderr || addAll.stdout}`);
    const staged = git(['write-tree'], worktree);
    if (staged.status !== 0) throw new Error(`git write-tree failed: ${staged.stderr || staged.stdout}`);
    const head = git(['rev-parse', 'HEAD^{tree}'], worktree);
    if (remoteExists && head.status === 0 && head.stdout.trim() === staged.stdout.trim()) {
      return { ok: true, mode: opts.mode, version: pack.version, npm: npmState, plugin: 'unchanged' };
    }
    const identity = {
      ...env,
      GIT_AUTHOR_NAME: 'github-actions[bot]',
      GIT_AUTHOR_EMAIL: '41898282+github-actions[bot]@users.noreply.github.com',
      GIT_COMMITTER_NAME: 'github-actions[bot]',
      GIT_COMMITTER_EMAIL: '41898282+github-actions[bot]@users.noreply.github.com',
    };
    const commit = run('git', ['commit', '-m', `release: bouncer--v${pack.version}`], { cwd: worktree, env: identity });
    if (commit.status !== 0) throw new Error(`git commit failed: ${commit.stderr || commit.stdout}`);
    const push = git(['push', 'origin', 'HEAD:refs/heads/release'], worktree);
    if (push.status !== 0) throw new Error(`git push failed: ${push.stderr || push.stdout}`);
    return { ok: true, mode: opts.mode, version: pack.version, npm: npmState, plugin: 'pushed' };
  } finally {
    const remove = git(['worktree', 'remove', '--force', worktree]);
    if (remove.status !== 0 && fs.existsSync(worktree)) fs.rmSync(worktree, { recursive: true, force: true });
    fs.rmSync(temp, { recursive: true, force: true });
  }
}

/**
 * registry 응답이 요청한 불변 산출물인지 확인한다. 무결성 누락도 재게시 사유가 아니라 거부다.
 * npm(libnpmpublish)은 게시할 때 semver.clean으로 +build metadata를 버린 버전을 저장하므로,
 * version은 pack.version이 아니라 그 저장 형태와 정확히 비교한다. semver는 직접 dependency가
 * 아니어서 새로 추가하지 않는다. 이 함수에 오는 pack.version은 이미 isStrictSemver를 통과했으므로
 * 첫 `+` 이후를 자르는 것이 semver.clean과 같은 결과다. prerelease 등 그 밖의 차이는 그대로 거부한다.
 *
 * @param {string} stdout - npm view JSON 응답
 * @param {{name: string, version: string, integrity: string}} pack - pack metadata
 * @returns {void} 일치하면 반환하고 다르면 오류
 */
function assertRegistryArtifact(stdout, pack) {
  let value;
  try { value = JSON.parse(stdout); } catch (err) {
    if (!(err instanceof SyntaxError)) throw err;
    throw new Error(`npm registry JSON invalid: ${err.message}`, { cause: err });
  }
  const storedVersion = pack.version.split('+')[0];
  // null/배열 등 객체가 아닌 성공 응답은 속성 접근 TypeError가 아니라 명시적 불일치로 거부한다.
  if (!value || typeof value !== 'object' || value.name !== pack.name || value.version !== storedVersion
    || value.dist?.integrity !== pack.integrity) {
    throw new Error('registry package name/version/integrity mismatch');
  }
}

/**
 * CLI 인자를 정확히 파싱해 성공 JSON 또는 복구 가능한 오류를 출력한다.
 *
 * @param {string[]} argv - process.argv.slice(2)
 * @returns {number} 성공 0, 실행 실패 1, 사용법 오류 2
 */
function main(argv) {
  const values = {};
  let mode;
  for (let i = 0; i < argv.length; i += 1) {
    if (argv[i] === '--dry-run' || argv[i] === '--publish') {
      if (mode) { process.stderr.write('choose one mode\n'); return 2; }
      mode = argv[i] === '--publish' ? 'publish' : 'dry-run';
    } else if (['--tarball', '--metadata', '--plugin-tree'].includes(argv[i]) && argv[i + 1]) {
      values[argv[i].slice(2)] = argv[++i];
    } else { process.stderr.write(`invalid argument: ${argv[i]}\n`); return 2; }
  }
  if (!mode || !values.tarball || !values.metadata || !values['plugin-tree']) {
    process.stderr.write(
      'usage: release-runtime.js --dry-run|--publish --tarball <path> --metadata <pack-json> '
      + '--plugin-tree <path>\n',
    );
    return 2;
  }
  try {
    const result = releaseRuntime({ mode, tarball: values.tarball, metadata: values.metadata,
      pluginTree: values['plugin-tree'], root: process.cwd() });
    process.stdout.write(`${JSON.stringify(result)}\n`);
    return 0;
  } catch (err) {
    process.stderr.write(`${err instanceof Error ? err.message : err}\n`);
    return 1;
  }
}

if (require.main === module) process.exit(main(process.argv.slice(2)));
module.exports = { releaseRuntime };
