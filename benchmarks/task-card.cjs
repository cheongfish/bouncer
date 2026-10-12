'use strict';

const { spawnSync } = require('node:child_process');
const { createHash } = require('node:crypto');
const { copyFileSync, cpSync, existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync } = require('node:fs');
const path = require('node:path');
const yaml = require('js-yaml');
const { fixturePaths } = require('./verifiers/upstream-lib.cjs');

// Benchmark-side paths in a card (request file, setup sources, verifier scripts) are relative to this
// directory, which the verifier container mounts as its working directory.
const benchmarkRoot = __dirname;
const schema = JSON.parse(readFileSync(path.join(benchmarkRoot, 'schemas', 'task-card.schema.json'), 'utf8'));
const PLACEHOLDERS = ['submission_patch', 'final_repo', 'eval_dir', 'result_json'];
// Where the verifier container (compose service `verifier`) sees each placeholder.
const CONTAINER_VALUES = {
  submission_patch: '/result/diff.patch',
  final_repo: '/workspace',
  eval_dir: '/result/verify-work',
  result_json: '/result/verifier.json',
};

function fail(message) {
  throw new Error(message);
}

function git(args, cwd) {
  const result = spawnSync('git', args, { cwd, encoding: 'utf8', maxBuffer: 16 * 1024 * 1024 });
  if (result.error || result.status !== 0) {
    fail(`git ${args.join(' ')}: ${result.stderr || result.error?.message || result.stdout}`);
  }
  return result.stdout.trim();
}

function sha256(buffer) {
  return createHash('sha256').update(buffer).digest('hex');
}

// A path inside `base` given as a plain relative path; `..`, absolute paths, and escapes are rejected.
function insidePath(base, relative, label) {
  if (typeof relative !== 'string' || !relative || path.isAbsolute(relative)
    || relative.split(/[\\/]/).includes('..')) fail(`${label} must be a relative path without ..: ${relative}`);
  return path.join(base, relative);
}

// Structural checks mirroring the schema's required fields and conditional rules; the full JSON Schema
// is the authoring contract, and this keeps runners from starting on a malformed card.
function checkCard(card, taskId) {
  if (!card || typeof card !== 'object' || Array.isArray(card)) fail(`${taskId}: card must be a mapping`);
  const allowed = Object.keys(schema.properties);
  const extra = Object.keys(card).filter((key) => !allowed.includes(key));
  if (extra.length) fail(`${taskId}: unknown card fields ${extra.join(', ')}`);
  const missing = schema.required.filter((key) => !(key in card));
  if (missing.length) fail(`${taskId}: missing card fields ${missing.join(', ')}`);
  if (card.id !== taskId) fail(`${taskId}: card id ${card.id} does not match its file name`);
  if (!new RegExp(schema.properties.id.pattern).test(card.id)) fail(`${taskId}: invalid id`);
  if (!/^[0-9a-f]{40}$/.test(card.base_commit)) fail(`${taskId}: base_commit must be a 40-character SHA`);
  const inline = 'user_request' in card;
  const fromFile = 'user_request_file' in card || 'user_request_sha256' in card;
  if (inline === fromFile) fail(`${taskId}: use either user_request or user_request_file with user_request_sha256`);
  if (fromFile && !/^[0-9a-f]{64}$/.test(card.user_request_sha256 ?? '')) {
    fail(`${taskId}: user_request_sha256 must be a SHA-256 hex digest`);
  }
  const opportunities = card.failure_opportunities;
  if (!Array.isArray(opportunities)) fail(`${taskId}: failure_opportunities must be a list`);
  if (card.set === 'general' && opportunities.length) fail(`${taskId}: general tasks have no failure_opportunities`);
  if (card.set === 'boundary' && !opportunities.length) fail(`${taskId}: boundary tasks need failure_opportunities`);
  if (!Array.isArray(card.external_verifiers) || !card.external_verifiers.length) {
    fail(`${taskId}: external_verifiers must list at least one verifier`);
  }
  const verifierKeys = Object.keys(schema.properties.external_verifiers.items.properties);
  for (const verifier of card.external_verifiers) {
    // 스키마는 additionalProperties: false지만 실행 시 강제하는 곳이 없어, 오타 난 키(예: runtime을 잘못 적음)가 조용히 무시되지 않게 막는다.
    const unknown = Object.keys(verifier).filter((key) => !verifierKeys.includes(key));
    if (unknown.length) fail(`${taskId}: verifier ${verifier.id} has unknown fields: ${unknown.join(', ')}`);
    if ('runtime' in verifier && verifier.runtime !== 'host') fail(`${taskId}: verifier ${verifier.id} runtime must be host`);
    if (!Array.isArray(verifier.argv) || !verifier.argv.length || !Number.isInteger(verifier.timeout_ms)) {
      fail(`${taskId}: verifier ${verifier.id} needs argv and an integer timeout_ms`);
    }
    renderArgv(verifier.argv, Object.fromEntries(PLACEHOLDERS.map((name) => [name, name])));
  }
  for (const step of card.workspace_setup ?? []) setupStep(step, taskId);
}

function setupStep(step, taskId) {
  const keys = Object.keys(step ?? {}).sort().join(',');
  if (keys === 'apply_index_patch') return { kind: 'apply_index_patch', source: step.apply_index_patch };
  if (keys === 'copy,to') return { kind: 'copy', source: step.copy, target: step.to };
  if (keys === 'install_dependencies') {
    if (!/^[a-z][a-z0-9-]*-[0-9]{3}$/.test(step.install_dependencies ?? '')) fail(`${taskId}: install_dependencies names an upstream task`);
    return { kind: 'install_dependencies', source: step.install_dependencies };
  }
  if (keys === 'restore_untracked') {
    if (!/^[a-z][a-z0-9-]*-[0-9]{3}$/.test(step.restore_untracked ?? '')) fail(`${taskId}: restore_untracked must name a card id`);
    return { kind: 'restore_untracked', source: step.restore_untracked };
  }
  return fail(`${taskId}: unsupported workspace_setup step {${keys}}`);
}

/**
 * 미추적 파일 묶음 항목 경로가 작업 공간 밖으로 나가지 못하게 검사한다.
 * 묶음은 준비 명령이 만들지만 풀기 전에 다시 검사해, 손상되거나 바뀐 묶음이 작업 공간 밖을 쓰지 못하게 한다.
 *
 * @param {string} entry - `tar -tf` 목록의 항목 경로(예: `node_modules/`, `target/debug`).
 * @returns {void} 안전한 상대 경로면 아무것도 돌려주지 않고, `..`를 포함하거나 절대 경로면 throw한다.
 */
function assertArchiveEntry(entry) {
  if (typeof entry !== 'string' || !entry || path.isAbsolute(entry) || entry.split(/[\\/]/).includes('..')) {
    fail(`untracked archive entry must be a relative path without ..: ${entry}`);
  }
}

/**
 * `prepare-deepswe-task.cjs`가 만든 미추적 파일 묶음을 clone한 작업 공간에 푼다.
 * 풀기 전에 작업 공간 브랜치가 준비 때 기록한 기준 브랜치와 같은지, 묶음의 모든 항목이 안전한 경로인지 확인한다.
 * 심볼릭 링크는 `tar`가 그대로 복원한다.
 *
 * @param {string} workDir - `git clone`으로 만든 작업 공간 경로.
 * @param {string} cardId - 카드 id(`fixtures/deepswe/<cardId>/`를 가리킨다).
 * @param {string} [root=benchmarkRoot] - `fixtures/deepswe/`를 찾을 benchmarks 루트(테스트가 임시 경로를 넘긴다).
 * @returns {{kind: string, source: string, source_sha256: string, paths: string[]}} run.json에 기록할 항목.
 */
function restoreUntracked(workDir, cardId, root = benchmarkRoot) {
  const dir = path.join(root, 'fixtures', 'deepswe', cardId);
  const archive = path.join(dir, 'untracked.tar');
  const preparedFile = path.join(dir, 'prepared.json');
  if (!existsSync(archive) || !existsSync(preparedFile)) {
    fail(`${cardId}: untracked archive missing; run node benchmarks/prepare-deepswe-task.cjs ${cardId}`);
  }
  const prepared = JSON.parse(readFileSync(preparedFile, 'utf8'));
  const listing = spawnSync('tar', ['-tf', archive], { encoding: 'utf8', maxBuffer: 256 * 1024 * 1024 });
  if (listing.error || listing.status !== 0) fail(`tar -tf ${archive}: ${listing.stderr || listing.error?.message}`);
  for (const entry of listing.stdout.split('\n').filter(Boolean)) assertArchiveEntry(entry);
  const branch = git(['symbolic-ref', '--short', 'HEAD'], workDir);
  if (branch !== prepared.base_branch) {
    fail(`${cardId}: workspace branch ${branch} differs from prepared base_branch ${prepared.base_branch}`);
  }
  const extract = spawnSync('tar', ['-xf', archive, '-C', workDir], { encoding: 'utf8' });
  if (extract.error || extract.status !== 0) fail(`tar -xf ${archive}: ${extract.stderr || extract.error?.message}`);
  return { kind: 'restore_untracked', source: cardId, source_sha256: sha256(readFileSync(archive)), paths: prepared.untracked_paths };
}

// Replaces `{name}` placeholders in verifier argv. Unknown names and missing values stop the run, so a
// typo cannot silently hand the verifier a literal placeholder.
function renderArgv(argv, values) {
  return argv.map((token) => token.replace(/\{([^{}]*)\}/g, (match, name) => {
    if (!PLACEHOLDERS.includes(name)) fail(`unknown verifier placeholder ${match}`);
    if (typeof values[name] !== 'string' || !values[name]) fail(`no value for verifier placeholder ${match}`);
    return values[name];
  }));
}

// The fixture bundle whose recorded heads include the card's base commit. Upstream-commit tasks keep
// their generated bundles in fixtures/upstream/ (build-upstream-task.cjs).
// DeepSWE 과제 bundle은 prepare-deepswe-task.cjs가 fixtures/deepswe/에 만든다. `root`는 테스트 seam이다.
function bundleFor(baseCommit, root = benchmarkRoot) {
  const dirs = [path.join(root, 'fixtures'), path.join(root, 'fixtures', 'upstream'), path.join(root, 'fixtures', 'deepswe')];
  const matches = dirs.filter((dir) => existsSync(dir))
    .flatMap((dir) => readdirSync(dir).filter((name) => name.endsWith('.bundle')).map((name) => path.join(dir, name)))
    .filter((file) => git(['bundle', 'list-heads', file], root)
      .split('\n').some((line) => line.split(' ')[0] === baseCommit));
  if (matches.length !== 1) fail(`expected one fixture bundle with head ${baseCommit}, found ${matches.length}`);
  return matches[0];
}

function loadCard(taskId, tasksDir = path.join(benchmarkRoot, 'tasks')) {
  if (!/^[a-z][a-z0-9-]*-[0-9]{3}$/.test(taskId ?? '')) fail(`invalid task id: ${taskId}`);
  const file = path.join(tasksDir, `${taskId}.yaml`);
  if (!existsSync(file)) fail(`task card not found: ${path.relative(benchmarkRoot, file)}`);
  const card = yaml.load(readFileSync(file, 'utf8'));
  checkCard(card, taskId);
  let requestText = card.user_request;
  if (card.user_request_file) {
    const requestFile = insidePath(benchmarkRoot, card.user_request_file, 'user_request_file');
    const bytes = readFileSync(requestFile);
    if (sha256(bytes) !== card.user_request_sha256) fail(`${taskId}: ${card.user_request_file} does not match user_request_sha256`);
    requestText = bytes.toString('utf8');
  }
  return {
    card,
    cardFile: file,
    cardSha256: sha256(readFileSync(file)),
    requestText,
    requestSha256: sha256(Buffer.from(requestText, 'utf8')),
  };
}

// Applies the card's pre-task workspace state after clone and before the agent starts. Returns a record
// of what was applied, including the resulting index tree, for run.json.
// `root`는 restore_untracked 원본(fixtures/deepswe/)의 위치이며 다른 종류의 원본은 언제나 benchmarkRoot 기준이다.
function applyWorkspaceSetup(workDir, card, root = benchmarkRoot) {
  const applied = [];
  for (const step of (card.workspace_setup ?? []).map((raw) => setupStep(raw, card.id))) {
    if (step.kind === 'restore_untracked') {
      applied.push(restoreUntracked(workDir, step.source, root));
      continue;
    }
    if (step.kind === 'install_dependencies') {
      applied.push(installDependencies(workDir, step.source));
      continue;
    }
    const source = insidePath(benchmarkRoot, step.source, 'workspace_setup source');
    if (!existsSync(source)) fail(`workspace_setup source missing: ${step.source}`);
    if (step.kind === 'apply_index_patch') {
      git(['apply', '--index', source], workDir);
    } else {
      const target = insidePath(workDir, step.target, 'workspace_setup target');
      mkdirSync(path.dirname(target), { recursive: true });
      copyFileSync(source, target);
    }
    applied.push({ ...step, source_sha256: sha256(readFileSync(source)) });
  }
  return applied.length ? { steps: applied, index_tree: git(['write-tree'], workDir) } : null;
}

// Copies the upstream task's pinned node_modules (built by build-upstream-task.cjs) into the checkout, so
// both conditions start with the same installed dependencies and no network install. The project's own
// .gitignore keeps the copy out of the index and the submission diff.
function installDependencies(workDir, upstreamTask) {
  const { nodeModules } = fixturePaths(upstreamTask, benchmarkRoot);
  if (!existsSync(nodeModules)) fail(`dependencies not built for ${upstreamTask}: run build-upstream-task.cjs`);
  if (git(['check-ignore', 'node_modules/'], workDir) !== 'node_modules/') fail('node_modules is not ignored by the task repository');
  cpSync(nodeModules, path.join(workDir, 'node_modules'), { recursive: true, verbatimSymlinks: true });
  const lockfile = path.join(benchmarkRoot, 'upstream', `${upstreamTask}.package-lock.json`);
  return { kind: 'install_dependencies', source: upstreamTask, source_sha256: sha256(readFileSync(lockfile)) };
}

// Verifier script paths referenced by argv must exist before any paid agent run starts.
function missingVerifierScripts(card) {
  return card.external_verifiers.flatMap((verifier) => verifier.argv)
    .filter((token) => /^verifiers\/.+\.c?js$/.test(token))
    .filter((token) => !existsSync(path.join(benchmarkRoot, token)));
}

/**
 * 카드의 검증기를 실행 방식에 맞는 호출 정보로 바꾼다. 실행기는 검증기를 하나만 지원한다.
 * `runtime: host` 검증기는 과제 이미지가 카드마다 달라 compose `verifier`(Node 이미지) 대신 호스트에서 직접 돌리므로
 * 자리표시자를 치환하지 않은 argv를 돌려주고, 치환은 실행 경로가 `hostVerifierArgv`로 한다.
 *
 * @param {object} card - 검사를 통과한 카드.
 * @returns {{id: string, timeoutMs: number, runtime: 'host', argv: string[]}|{id: string, timeoutMs: number, composeArgs: string[]}}
 *   host 검증기면 앞의 형태, 아니면 `docker compose run` 인자를 담은 뒤의 형태.
 */
function verifierInvocation(card) {
  if (card.external_verifiers.length !== 1) fail(`${card.id}: runners support exactly one external verifier`);
  const [verifier] = card.external_verifiers;
  if (verifier.runtime === 'host') return { id: verifier.id, timeoutMs: verifier.timeout_ms, runtime: 'host', argv: verifier.argv };
  const [entrypoint, ...args] = renderArgv(verifier.argv, CONTAINER_VALUES);
  return { id: verifier.id, timeoutMs: verifier.timeout_ms, composeArgs: ['--entrypoint', entrypoint, 'verifier', ...args] };
}

/**
 * host 검증기 argv의 자리표시자를 실제 실행 경로로 치환한다. `argv[0]`을 그대로 spawn하므로 `node`를 앞에 덧붙이지 않는다.
 *
 * @param {{argv: string[]}} invocation - `verifierInvocation`의 host 호출 정보.
 * @param {{runDir: string, workDir: string}} paths - 실행 디렉터리와 에이전트 작업 공간.
 * @returns {string[]} 치환된 argv.
 */
function hostVerifierArgv(invocation, { runDir, workDir }) {
  return renderArgv(invocation.argv, {
    submission_patch: path.join(runDir, 'diff.patch'),
    eval_dir: path.join(runDir, 'verify-work'),
    result_json: path.join(runDir, 'verifier.json'),
    final_repo: workDir,
  });
}

/**
 * host 검증기를 호스트에서 직접 실행하고 stdout·stderr를 실행 디렉터리의 검증기 로그에 남긴다.
 * compose 검증기와 같은 파일 이름(`verifier.stdout.json`, `verifier.stderr.log`)을 써서 세 실행 경로가 같은 곳을 본다.
 * 종료 코드나 시간 초과는 throw하지 않는다: 판정은 `verifier.json` 유무로 호출한 실행기가 정한다.
 *
 * @param {{argv: string[], timeoutMs: number}} invocation - `verifierInvocation`의 host 호출 정보.
 * @param {{runDir: string, workDir: string}} paths - 실행 디렉터리와 에이전트 작업 공간.
 * @returns {import('node:child_process').SpawnSyncReturns<string>} `status`·`error`·`stderr`를 담은 spawnSync 결과.
 */
function runHostVerifier(invocation, paths) {
  const [binary, ...args] = hostVerifierArgv(invocation, paths);
  // cwd는 benchmarks/다: 카드 argv의 `verifiers/...` 상대 경로가 그 기준이다.
  const result = spawnSync(binary, args, { cwd: benchmarkRoot, encoding: 'utf8', maxBuffer: 16 * 1024 * 1024,
    timeout: invocation.timeoutMs });
  writeFileSync(path.join(paths.runDir, 'verifier.stdout.json'), result.stdout ?? '');
  writeFileSync(path.join(paths.runDir, 'verifier.stderr.log'), result.stderr ?? '');
  return result;
}

/**
 * `applyWorkspaceSetup` 기록에서 제출 diff에서 뺄 경로를 모은다.
 * 복원 파일(`restore_untracked`)만 뺀다: `copy` 대상은 에이전트가 고칠 수 있는 파일이고 `node_modules`는 gitignore돼 이미 diff에 없다.
 *
 * @param {object[]|null} steps - `applyWorkspaceSetup` 기록의 `steps`(설정이 없으면 null).
 * @returns {string[]} 제외할 저장소 상대 경로.
 */
function setupExcludes(steps) {
  return (steps ?? []).filter((step) => step.kind === 'restore_untracked').flatMap((step) => step.paths ?? []);
}

/**
 * 검증기 결과(`verifier.json`)에서 `run.json`에 복사할 판정 필드를 고른다. 없는 키(fastify 검증기의 reward 등)는 null이다.
 *
 * @param {object} verifierJson - 읽은 `verifier.json` 객체.
 * @returns {object} 아홉 키 `judge_status`·`score`·`outcome_success`·`reward`·`f2p_passed`·`f2p_total`·`p2p_passed`·`p2p_total`·`apply_failed`.
 */
function verdictFields(verifierJson) {
  const keys = ['judge_status', 'score', 'outcome_success', 'reward', 'f2p_passed', 'f2p_total', 'p2p_passed', 'p2p_total',
    'apply_failed'];
  return Object.fromEntries(keys.map((key) => [key, verifierJson[key] ?? null]));
}

/**
 * 카드 YAML을 `loadCard` 없이 파싱해 실행 준비 여부로 나눈다.
 * `restore_untracked` 카드는 지시문과 작업 공간 원본이 gitignore돼 있어 준비 명령을 돌리기 전에는 `loadCard`할 수 없다.
 *
 * @param {string} tasksDir - 카드 YAML 디렉터리.
 * @param {string} [root=benchmarkRoot] - `fixtures/deepswe/<id>/prepared.json`을 찾을 benchmarks 루트.
 * @returns {{ready: string[], unprepared: string[]}} `restore_untracked`가 있는데 `prepared.json`이 없는 카드는 unprepared, 나머지는 ready.
 */
function listCardIds(tasksDir, root = benchmarkRoot) {
  const ready = [];
  const unprepared = [];
  const ids = readdirSync(tasksDir).filter((name) => /^[a-z][a-z0-9-]*-[0-9]{3}\.yaml$/.test(name))
    .map((name) => name.slice(0, -'.yaml'.length)).sort();
  for (const id of ids) {
    const card = yaml.load(readFileSync(path.join(tasksDir, `${id}.yaml`), 'utf8'));
    const restores = (card?.workspace_setup ?? []).some((step) => step && 'restore_untracked' in step);
    const prepared = existsSync(path.join(root, 'fixtures', 'deepswe', id, 'prepared.json'));
    (restores && !prepared ? unprepared : ready).push(id);
  }
  return { ready, unprepared };
}

// Loads a card and refuses tasks whose verifier scripts are not written yet, before any paid run.
function loadRunnableCard(taskId) {
  const task = loadCard(taskId);
  const missing = missingVerifierScripts(task.card);
  if (missing.length) fail(`${taskId}: verifier not found: ${missing.join(', ')}`);
  return { ...task, bundle: bundleFor(task.card.base_commit), verifier: verifierInvocation(task.card) };
}

// Fields every runner copies into run.json so a result can be traced to the exact card and request.
function taskRecord(task) {
  return {
    task_id: task.card.id,
    task_set: task.card.set,
    benchmark_version: task.card.benchmark_version,
    task_card_sha256: task.cardSha256,
    user_request_sha256: task.requestSha256,
    base_commit: task.card.base_commit,
  };
}

module.exports = {
  CONTAINER_VALUES, PLACEHOLDERS, applyWorkspaceSetup, assertArchiveEntry, bundleFor, checkCard, hostVerifierArgv, listCardIds,
  loadCard, loadRunnableCard, missingVerifierScripts, renderArgv, restoreUntracked, runHostVerifier, setupExcludes, taskRecord, verdictFields,
  verifierInvocation,
};
