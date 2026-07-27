'use strict';
const fs = require('node:fs');
const path = require('node:path');
const { execSync } = require('node:child_process');
const { readDoc } = require('./frontmatter');
const { renderDoc } = require('./render');
const { isCanonicalBlueprintDir } = require('./layout');

const OUTPUT_TAIL_LINES = 100;
const MAX_VERIFY_OUTPUT_BYTES = 10 * 1024 * 1024;

function verificationError(code, message) {
  const error = new Error(message);
  error.code = code;
  return error;
}

function readVerifyCommand(repoRoot) {
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

function outputTail(stdout, stderr) {
  const combined = [stdout, stderr].filter(Boolean).join('');
  return combined.split('\n').slice(-OUTPUT_TAIL_LINES).join('\n').trim();
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
    return { ok: true, exitCode: 0, output: outputTail(stdout, stderr) };
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
  const body = `# Verification

## Command
\`${command}\`

## Evidence
Ran at: ${ranAt}
Exit code: ${exitCode}

\`\`\`
${output}
\`\`\`
`;
  fs.writeFileSync(verificationPath, renderDoc(data, body));
}

function runVerification({ repoRoot, blueprintDir, exec, now = () => new Date() }) {
  if (!isCanonicalBlueprintDir(blueprintDir)) {
    throw verificationError(
      'VERIFY_BLUEPRINT_INVALID',
      'blueprintDir must be under .bouncer/context/epics',
    );
  }
  const command = readVerifyCommand(repoRoot);
  const verificationPath = path.join(repoRoot, blueprintDir, 'verification.md');
  if (!fs.existsSync(verificationPath)) {
    throw verificationError('VERIFY_DOCUMENT_MISSING', `verification document missing: ${verificationPath}`);
  }
  const execution = executeVerify(command, { cwd: repoRoot, exec });
  const ranAt = now().toISOString();
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
  MAX_VERIFY_OUTPUT_BYTES,
  readVerifyCommand,
  executeVerify,
  recordVerificationResult,
  runVerification,
};
