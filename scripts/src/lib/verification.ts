'use strict';
const fs = require('node:fs');
const path = require('node:path');
const { execSync } = require('node:child_process');
const { readDoc } = require('./frontmatter');
const { renderDoc } = require('./render');
const { isCanonicalBlueprintDir } = require('./layout');
const { nowIsoKst } = require('./time');

// A passing run is evidence that the command exited zero; the tail only needs
// to carry the summary the command prints at the end. A failing run is evidence
// of what went wrong, so it keeps far more — and keeps it in the document body
// where a reviewer reads, not only in frontmatter.
const OUTPUT_TAIL_LINES = 100;
const PASSING_OUTPUT_TAIL_LINES = 20;
const MAX_VERIFY_OUTPUT_BYTES = 10 * 1024 * 1024;

function verificationError(code, message) {
  const error = new Error(message) as Error & { code?: string };
  error.code = code;
  return error;
}

// One executable argv string only: no shell chaining, redirection, or `cd`
// prefixes. Plan S12 and runtime VERIFY_COMMAND_INVALID share this predicate
// so the two surfaces cannot drift.
const VERIFY_COMMAND_FORBIDDEN = /[&|;`<>\n]|\$\(/;

function isValidVerifyCommand(command) {
  if (typeof command !== 'string') return false;
  const trimmed = command.trim();
  if (!trimmed) return false;
  if (VERIFY_COMMAND_FORBIDDEN.test(trimmed)) return false;
  return trimmed.split(/\s+/)[0] !== 'cd';
}

function readVerifyCommand(repoRoot, blueprintDir) {
  // Blueprint declaration wins when present; missing tasks.md or missing field
  // keeps the historical config.verify path. A present-but-invalid field must
  // not silently fall through — that would hide a plan-time S12 miss.
  if (blueprintDir) {
    const tasksPath = path.join(repoRoot, blueprintDir, 'tasks.md');
    try {
      const { data } = readDoc(tasksPath);
      const declared = data && data.bouncer && data.bouncer.verify;
      if (declared !== undefined) {
        if (!isValidVerifyCommand(declared)) {
          throw verificationError(
            'VERIFY_COMMAND_INVALID',
            'verify command must be a single executable command',
          );
        }
        return declared;
      }
    } catch (error) {
      if (error && error.code === 'VERIFY_COMMAND_INVALID') throw error;
      if (!(error && error.code === 'ENOENT')) throw error;
    }
  }

  const configPath = path.join(repoRoot, '.bouncer', 'config.json');
  let config;
  try {
    config = JSON.parse(fs.readFileSync(configPath, 'utf8'));
  } catch (error) {
    if (error && error.code === 'ENOENT') {
      throw verificationError('VERIFY_CONFIG_MISSING', `verification config missing: ${configPath}`);
    }
    throw verificationError('VERIFY_CONFIG_INVALID', `verification config is invalid: ${configPath}`);
  }
  if (typeof config.verify !== 'string' || config.verify.trim() === '') {
    throw verificationError('VERIFY_CONFIG_INVALID', 'config.verify must be a non-empty string');
  }
  return config.verify;
}

function outputTail(stdout, stderr, lines = OUTPUT_TAIL_LINES) {
  const combined = [stdout, stderr].filter(Boolean).join('');
  return combined.split('\n').slice(-lines).join('\n').trim();
}

function executeVerify(command, { cwd, exec = execSync }) {
  try {
    const result = exec(command, {
      cwd,
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'pipe'],
      maxBuffer: MAX_VERIFY_OUTPUT_BYTES,
    });
    const stdout = result && typeof result === 'object' ? result.stdout : result;
    const stderr = result && typeof result === 'object' ? result.stderr : '';
    return {
      ok: true,
      exitCode: 0,
      output: outputTail(stdout, stderr, PASSING_OUTPUT_TAIL_LINES),
    };
  } catch (error) {
    return {
      ok: false,
      exitCode: Number.isInteger(error && error.status) ? error.status : 1,
      output: outputTail(error && error.stdout, error && error.stderr),
    };
  }
}

function recordVerificationResult({ repoRoot, blueprintDir, command, ranAt, exitCode, output }) {
  const verificationPath = path.join(repoRoot, blueprintDir, 'verification.md');
  let document;
  try {
    document = readDoc(verificationPath);
  } catch (error) {
    if (error && error.code === 'ENOENT') {
      throw verificationError('VERIFY_DOCUMENT_MISSING', `verification document missing: ${verificationPath}`);
    }
    throw error;
  }
  const data = document.data;
  data.bouncer = data.bouncer || {};
  data.bouncer.status = exitCode === 0 ? 'passed' : 'failed';
  data.bouncer.verification = {
    command,
    ran_at: ranAt,
    exit_code: exitCode,
    output_tail: output,
  };
  const evidence = exitCode === 0
    ? ''
    : `\n\`\`\`\n${output}\n\`\`\`\n`;
  const body = `# Verification

## Command
\`${command}\`

## Evidence
Ran at: ${ranAt}
Exit code: ${exitCode}
${evidence}`;
  fs.writeFileSync(verificationPath, renderDoc(data, body));
}

function runVerification({ repoRoot, blueprintDir, exec, now = () => new Date() }) {
  if (!isCanonicalBlueprintDir(blueprintDir)) {
    throw verificationError(
      'VERIFY_BLUEPRINT_INVALID',
      'blueprintDir must be under .bouncer/context/epics',
    );
  }
  const command = readVerifyCommand(repoRoot, blueprintDir);
  const verificationPath = path.join(repoRoot, blueprintDir, 'verification.md');
  if (!fs.existsSync(verificationPath)) {
    throw verificationError('VERIFY_DOCUMENT_MISSING', `verification document missing: ${verificationPath}`);
  }
  const execution = executeVerify(command, { cwd: repoRoot, exec });
  const ranAt = nowIsoKst(now());
  recordVerificationResult({
    repoRoot,
    blueprintDir,
    command,
    ranAt,
    exitCode: execution.exitCode,
    output: execution.output,
  });
  return { ok: execution.ok, command, exitCode: execution.exitCode };
}

module.exports = {
  OUTPUT_TAIL_LINES,
  PASSING_OUTPUT_TAIL_LINES,
  MAX_VERIFY_OUTPUT_BYTES,
  isValidVerifyCommand,
  readVerifyCommand,
  executeVerify,
  recordVerificationResult,
  runVerification,
};
