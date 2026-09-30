'use strict';

const { spawnSync } = require('node:child_process');
const { createHash } = require('node:crypto');
const { copyFileSync, existsSync, mkdirSync, readFileSync, readdirSync } = require('node:fs');
const path = require('node:path');
const yaml = require('js-yaml');

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
  for (const verifier of card.external_verifiers) {
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
  return fail(`${taskId}: unsupported workspace_setup step {${keys}}`);
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

// The fixture bundle whose recorded heads include the card's base commit.
function bundleFor(baseCommit) {
  const fixtures = path.join(benchmarkRoot, 'fixtures');
  const matches = readdirSync(fixtures).filter((name) => name.endsWith('.bundle'))
    .filter((name) => git(['bundle', 'list-heads', path.join(fixtures, name)], benchmarkRoot)
      .split('\n').some((line) => line.split(' ')[0] === baseCommit));
  if (matches.length !== 1) fail(`expected one fixture bundle with head ${baseCommit}, found ${matches.length}`);
  return path.join(fixtures, matches[0]);
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
function applyWorkspaceSetup(workDir, card) {
  const applied = [];
  for (const step of (card.workspace_setup ?? []).map((raw) => setupStep(raw, card.id))) {
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

// Verifier script paths referenced by argv must exist before any paid agent run starts.
function missingVerifierScripts(card) {
  return card.external_verifiers.flatMap((verifier) => verifier.argv)
    .filter((token) => /^verifiers\/.+\.c?js$/.test(token))
    .filter((token) => !existsSync(path.join(benchmarkRoot, token)));
}

// The `docker compose run` arguments that start the card's verifier; runners support one verifier.
function verifierInvocation(card) {
  if (card.external_verifiers.length !== 1) fail(`${card.id}: runners support exactly one external verifier`);
  const [verifier] = card.external_verifiers;
  const [entrypoint, ...args] = renderArgv(verifier.argv, CONTAINER_VALUES);
  return { id: verifier.id, timeoutMs: verifier.timeout_ms, composeArgs: ['--entrypoint', entrypoint, 'verifier', ...args] };
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
  CONTAINER_VALUES, PLACEHOLDERS, applyWorkspaceSetup, bundleFor, checkCard, loadCard, loadRunnableCard,
  missingVerifierScripts, renderArgv, taskRecord, verifierInvocation,
};
