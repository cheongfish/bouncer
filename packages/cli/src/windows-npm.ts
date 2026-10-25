'use strict';
const fs = require('node:fs');
const path = require('node:path');

// scripts/spawn-win.js와 같은 규칙이다. runtime 패키지에는 scripts/가 들어가지 않아 복제한다.
// npm/npx는 Windows에서 .cmd shim이라 shell 없이 spawn하면 EINVAL(Node의 CVE-2024-27980 대응),
// 확장자 없이 부르면 ENOENT가 난다. 그래서 node 옆의 npm CLI 스크립트를 node로 직접 실행한다.
const CLI_FILES: Record<string, string> = { npm: 'npm-cli.js', npx: 'npx-cli.js' };

type SpawnCall = { command: string; args: string[]; shell: boolean };

type ResolveOptions = {
  platform?: string;
  execPath?: string;
  env?: Record<string, string | undefined>;
  exists?: (file: string) => boolean;
};

/**
 * spawn 대상이 npm/npx이고 Windows이면 node로 npm CLI 스크립트를 직접 실행하는 호출로 바꾼다.
 * 그 밖의 명령과 플랫폼은 그대로 돌려준다. CLI 스크립트를 찾지 못하면 `.cmd`를 shell로 실행하는
 * 호출로 되돌린다.
 *
 * @param {string} command - 실행 파일 이름. `npm`, `npm.cmd`, `npx` 모두 받는다
 * @param {string[]} args - 인자
 * @param {ResolveOptions} [opts] - 테스트용 주입값. 생략하면 현재 프로세스 값을 쓴다
 * @returns {SpawnCall} spawn에 넘길 호출
 */
function resolveSpawn(command: string, args: string[], opts: ResolveOptions = {}): SpawnCall {
  const platform = opts.platform || process.platform;
  const tool = String(command).replace(/\.cmd$/i, '');
  if (platform !== 'win32' || !Object.hasOwn(CLI_FILES, tool)) {
    return { command, args, shell: false };
  }
  const execPath = opts.execPath || process.execPath;
  const env = opts.env || process.env;
  const exists = opts.exists || fs.existsSync;
  const candidates: string[] = [];
  const viaNpm = env.npm_execpath;
  if (tool === 'npm' && typeof viaNpm === 'string' && /npm-cli\.js$/i.test(viaNpm)) {
    candidates.push(viaNpm);
  }
  candidates.push(path.win32.join(path.win32.dirname(execPath), 'node_modules', 'npm', 'bin', CLI_FILES[tool]));
  const cli = candidates.find((file) => exists(file));
  if (cli) return { command: execPath, args: [cli, ...args], shell: false };
  return { command: `${tool}.cmd`, args, shell: true };
}

export = { resolveSpawn };
