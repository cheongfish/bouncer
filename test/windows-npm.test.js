'use strict';
const test = require('node:test');
const assert = require('node:assert');
const scriptHelper = require('../scripts/spawn-win');
const runtimeHelper = require('../packages/cli/dist/windows-npm');

const EXEC = 'C:\\Program Files\\nodejs\\node.exe';
const NPM_CLI = 'C:\\Program Files\\nodejs\\node_modules\\npm\\bin\\npm-cli.js';
const NPX_CLI = 'C:\\Program Files\\nodejs\\node_modules\\npm\\bin\\npx-cli.js';

// scripts/spawn-win.js와 runtime의 복제본이 같은 답을 내야 한다. 둘 다 같은 표로 검사한다.
for (const [label, helper] of [['scripts', scriptHelper], ['runtime', runtimeHelper]]) {
  const resolve = (command, args, extra = {}) => helper.resolveSpawn(command, args, {
    platform: 'win32',
    execPath: EXEC,
    env: {},
    exists: (file) => file === NPM_CLI || file === NPX_CLI,
    ...extra,
  });

  test(`${label} resolveSpawn on win32 with npm → runs npm-cli.js through node without a shell`, () => {
    assert.deepStrictEqual(resolve('npm', ['run', 'build']), {
      command: EXEC, args: [NPM_CLI, 'run', 'build'], shell: false,
    });
    assert.deepStrictEqual(resolve('npm.cmd', ['ci']), {
      command: EXEC, args: [NPM_CLI, 'ci'], shell: false,
    });
  });

  test(`${label} resolveSpawn on win32 with npx → runs npx-cli.js through node`, () => {
    assert.deepStrictEqual(resolve('npx', ['--version']), {
      command: EXEC, args: [NPX_CLI, '--version'], shell: false,
    });
  });

  test(`${label} resolveSpawn on win32 with npm_execpath → prefers that npm-cli.js`, () => {
    const viaNpm = 'D:\\tools\\npm\\bin\\npm-cli.js';
    const call = resolve('npm', ['test'], { env: { npm_execpath: viaNpm }, exists: () => true });
    assert.deepStrictEqual(call, { command: EXEC, args: [viaNpm, 'test'], shell: false });
  });

  test(`${label} resolveSpawn on win32 without npm-cli.js → falls back to npm.cmd through a shell`, () => {
    assert.deepStrictEqual(resolve('npm', ['ci'], { exists: () => false }), {
      command: 'npm.cmd', args: ['ci'], shell: true,
    });
  });

  test(`${label} resolveSpawn on win32 with another executable → leaves it unchanged`, () => {
    assert.deepStrictEqual(resolve('git', ['status']), { command: 'git', args: ['status'], shell: false });
  });

  test(`${label} resolveSpawn on linux with npm → leaves it unchanged`, () => {
    const call = helper.resolveSpawn('npm', ['ci'], { platform: 'linux' });
    assert.deepStrictEqual(call, { command: 'npm', args: ['ci'], shell: false });
  });
}
