'use strict';
const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const root = path.join(__dirname, '..');
const readJson = (rel) => JSON.parse(fs.readFileSync(path.join(root, rel), 'utf8'));

test('runtime package and root package → expose bins only from the runtime workspace', () => {
  const pkg = readJson('package.json');
  const runtime = readJson('packages/cli/package.json');
  assert.strictEqual(pkg.private, true);
  assert.strictEqual(pkg.bin, undefined);
  assert.strictEqual(runtime.name, '@cheongfish/bouncer');
  assert.deepStrictEqual(runtime.bin, {
    bouncer: 'bin/bouncer',
    'bouncer-root': 'bin/bouncer-root',
  });
});

// hooks/hooks.json is loaded by convention. Naming it in the manifest as well
// makes the loader see the same file twice and reject the whole plugin with
// "Duplicate hooks file detected" — the plugin does not load at all, so this is
// a shipping blocker rather than a cosmetic manifest issue. `hooks` is only for
// *additional* hook files.
test('plugin.json → does not re-declare the conventional hooks file', () => {
  const plugin = readJson('.claude-plugin/plugin.json');
  assert.strictEqual(plugin.name, 'bouncer');
  assert.ok(!('hooks' in plugin), 'plugin.json must not declare hooks/hooks.json');
});

test('hooks.json → registers commit-safety on PreToolUse Bash', () => {
  const hooks = readJson('hooks/hooks.json');
  const pre = hooks.hooks.PreToolUse;
  assert.ok(Array.isArray(pre));
  const entry = pre.find((h) => h.matcher === 'Bash');
  assert.ok(entry, 'no Bash PreToolUse matcher');
  assert.ok(entry.hooks[0].command.includes('commit-safety.js'));
});

test('hooks.json → registers session-graph only on SessionStart', () => {
  const hooks = readJson('hooks/hooks.json');
  const start = hooks.hooks.SessionStart;
  assert.ok(Array.isArray(start));
  assert.strictEqual(start.length, 1, 'SessionStart must register only session-graph');
  const commands = start.map((entry) => entry.hooks[0].command);
  assert.ok(commands.some((c) => c.includes('session-graph.js')), 'session-graph.js missing');
  assert.ok(
    !commands.some((c) => c.includes('session-legacy-ids.js')),
    'session-legacy-ids.js must not remain wired',
  );
  assert.equal(fs.existsSync(path.join(root, 'hooks', 'session-legacy-ids.js')), false);
});

/**
 * 훅 등록 JSON의 모든 명령이 실행 비트에 의존하지 않는지 검사한다.
 * `node `로 시작하는 명령은 대상 파일 존재만 보고, bare 명령(그 외)은 대상 파일의
 * 소유자 실행 비트까지 본다. 플러그인 캐시 복사가 모드를 잃어도 node 경유 명령은 안전하다.
 * 대상 경로를 확실히 뽑지 못하면 추측하지 않고 위반으로 보고한다.
 *
 * @param {object} hooksJson - hooks.json 또는 cursor-hooks.json 파싱 결과
 * @param {string} rootDir - `${CLAUDE_PLUGIN_ROOT}`와 `./`를 풀 기준 디렉터리
 * @returns {string[]} 위반 설명 목록. 비어 있으면 통과
 */
function hookCommandViolations(hooksJson, rootDir) {
  const commands = [];
  for (const entries of Object.values(hooksJson.hooks || {})) {
    for (const entry of entries) {
      if (typeof entry.command === 'string') commands.push(entry.command);
      for (const hook of entry.hooks || []) commands.push(hook.command);
    }
  }
  const violations = [];
  for (const command of commands) {
    const viaNode = command.startsWith('node ');
    const operand = viaNode ? command.slice('node '.length) : command;
    // 따옴표로 감싼 경로 하나, 또는 공백 없는 경로 하나만 허용한다.
    const match = /^"([^"]+)"$/.exec(operand) || /^(\S+)$/.exec(operand);
    if (!match) {
      violations.push(`cannot extract target path from command: ${command}`);
      continue;
    }
    const rel = match[1].replace('${CLAUDE_PLUGIN_ROOT}', rootDir);
    const file = path.resolve(rootDir, rel);
    let stat;
    try {
      stat = fs.statSync(file);
    } catch (err) {
      if (err.code !== 'ENOENT') throw err;
      violations.push(`${file}: target file of "${command}" does not exist`);
      continue;
    }
    if (!viaNode && !(stat.mode & 0o100)) {
      violations.push(`${file}: bare command "${command}" needs the executable bit`);
    }
  }
  return violations;
}

test('hooks → run through node or an executable file', { skip: process.platform === 'win32' }, () => {
  assert.deepStrictEqual(hookCommandViolations(readJson('hooks/hooks.json'), root), []);
  assert.deepStrictEqual(hookCommandViolations(readJson('hooks/cursor-hooks.json'), root), []);
});

test('hooks/subagent-model.js → has the owner executable bit', { skip: process.platform === 'win32' }, () => {
  assert.ok(
    fs.statSync(path.join(root, 'hooks/subagent-model.js')).mode & 0o100,
    'hooks/subagent-model.js must be executable',
  );
});

test('hookCommandViolations → classifies bare and node commands by target file', {
  skip: process.platform === 'win32',
}, () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'hook-violations-'));
  fs.mkdirSync(path.join(dir, 'hooks'));
  fs.mkdirSync(path.join(dir, 'with space'));
  fs.writeFileSync(path.join(dir, 'hooks/plain.js'), '', { mode: 0o644 });
  fs.writeFileSync(path.join(dir, 'hooks/exec.js'), '', { mode: 0o755 });
  fs.writeFileSync(path.join(dir, 'with space/x.js'), '', { mode: 0o755 });
  const one = (command) => hookCommandViolations({ hooks: { E: [{ hooks: [{ command }] }] } }, dir);
  try {
    assert.strictEqual(one('${CLAUDE_PLUGIN_ROOT}/hooks/plain.js').length, 1);
    assert.strictEqual(one('${CLAUDE_PLUGIN_ROOT}/hooks/exec.js').length, 0);
    assert.strictEqual(one('node "${CLAUDE_PLUGIN_ROOT}/hooks/plain.js"').length, 0);
    assert.strictEqual(one('node "${CLAUDE_PLUGIN_ROOT}/hooks/missing.js"').length, 1);
    assert.strictEqual(one('${CLAUDE_PLUGIN_ROOT}/with space/x.js').length, 1);
    assert.strictEqual(one('node ./hooks/plain.js').length, 0);
    assert.strictEqual(one('./hooks/plain.js').length, 1);
    assert.strictEqual(one('./hooks/exec.js').length, 0);
    // cursor 형태: entry에 command가 직접 있다.
    assert.strictEqual(
      hookCommandViolations({ hooks: { E: [{ command: './hooks/plain.js' }] } }, dir).length, 1);
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});
