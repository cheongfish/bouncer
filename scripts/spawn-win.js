'use strict';

const fs = require('node:fs');
const path = require('node:path');

// npm과 npx는 Windows에서 .cmd shim이다. Node는 CVE-2024-27980 대응으로 shell 없이 .cmd를 spawn하면
// EINVAL을 내고, 확장자 없는 `npm`은 PATHEXT를 펼치지 않아 ENOENT가 난다. 그래서 설치된 node와 같은
// 디렉터리의 npm-cli.js를 node로 직접 실행한다.
const CLI_FILES = { npm: 'npm-cli.js', npx: 'npx-cli.js' };

/**
 * spawn 대상이 npm/npx이고 Windows이면 node로 npm CLI 스크립트를 직접 실행하는 호출로 바꾼다.
 * 그 밖의 명령과 플랫폼은 그대로 돌려준다. CLI 스크립트를 찾지 못하면 `.cmd`를 shell로 실행하는
 * 호출로 되돌린다(인자는 이 저장소 코드가 정한 값이어야 한다).
 *
 * @param {string} command - 실행 파일 이름. `npm`, `npm.cmd`, `npx` 모두 받는다
 * @param {string[]} args - 인자
 * @param {{platform?: string, execPath?: string, env?: object, exists?: (p: string) => boolean}} [opts]
 *   테스트용 주입값. 생략하면 현재 프로세스 값을 쓴다
 * @returns {{command: string, args: string[], shell: boolean}} spawn에 넘길 호출
 */
function resolveSpawn(command, args, opts = {}) {
  const platform = opts.platform || process.platform;
  const tool = String(command).replace(/\.cmd$/i, '');
  if (platform !== 'win32' || !Object.hasOwn(CLI_FILES, tool)) {
    return { command, args, shell: false };
  }
  const execPath = opts.execPath || process.execPath;
  const env = opts.env || process.env;
  const exists = opts.exists || fs.existsSync;
  const candidates = [];
  if (tool === 'npm' && typeof env.npm_execpath === 'string' && /npm-cli\.js$/i.test(env.npm_execpath)) {
    candidates.push(env.npm_execpath);
  }
  candidates.push(path.win32.join(path.win32.dirname(execPath), 'node_modules', 'npm', 'bin', CLI_FILES[tool]));
  const cli = candidates.find((file) => exists(file));
  if (cli) return { command: execPath, args: [cli, ...args], shell: false };
  return { command: `${tool}.cmd`, args, shell: true };
}

module.exports = { resolveSpawn };
