#!/usr/bin/env node
'use strict';

const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawnSync } = require('node:child_process');

const env = process.env;
const isGlobal = /^(1|true)$/i.test(env.npm_config_global || env.NPM_CONFIG_GLOBAL || '')
  || /^(global)$/i.test(env.npm_config_location || env.NPM_CONFIG_LOCATION || '');
if (!isGlobal) process.exit(0);

const prefix = env.npm_config_prefix || env.NPM_CONFIG_PREFIX;
if (!prefix) process.exit(0);

const binDir = process.platform === 'win32' ? path.resolve(prefix) : path.resolve(prefix, 'bin');
const marker = '# bouncer npm global PATH';

function addBlock(file, block) {
  let content = '';
  try { content = fs.readFileSync(file, 'utf8'); } catch (error) {
    if (error.code !== 'ENOENT') throw error;
  }
  if (content.includes(marker)) return false;
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.appendFileSync(file, `${content && !content.endsWith('\n') ? '\n' : ''}${block}\n`, { mode: 0o600 });
  return true;
}

function posix() {
  const escaped = binDir.replace(/\\/g, '\\\\').replace(/"/g, '\\"').replace(/\$/g, '\\$').replace(/`/g, '\\`');
  const line = `${marker}\nexport PATH="${escaped}:$PATH"`;
  const home = os.homedir();
  const files = [path.join(home, '.profile')];
  const shell = path.basename(env.SHELL || '');
  if (shell === 'bash') files.push(path.join(home, '.bashrc'));
  if (shell === 'zsh') files.push(path.join(home, '.zshrc'));
  if (shell === 'fish') {
    const fishLine = `${marker}\nfish_add_path --global ${JSON.stringify(binDir)}`;
    files.push(path.join(home, '.config', 'fish', 'conf.d', 'bouncer-path.fish'));
    fs.mkdirSync(path.dirname(files.at(-1)), { recursive: true });
    fs.writeFileSync(files.at(-1), `${fishLine}\n`, { mode: 0o600 });
    files.pop();
  }
  let changed = 0;
  for (const file of files) if (addBlock(file, line)) changed++;
  return changed;
}

function windows() {
  const ps = [
    '$p = [Environment]::GetEnvironmentVariable("Path", "User")',
    `$d = ${JSON.stringify(binDir)}`,
    '$parts = @($p -split ";" | Where-Object { $_ })',
    'if (-not ($parts | Where-Object { $_.TrimEnd("\\") -ieq $d.TrimEnd("\\") })) {',
    '  [Environment]::SetEnvironmentVariable("Path", (($parts + $d) -join ";"), "User")',
    '  Write-Output "added"',
    '}',
  ].join('; ');
  const result = spawnSync('powershell.exe', ['-NoProfile', '-NonInteractive', '-Command', ps], { encoding: 'utf8' });
  if (result.status !== 0) throw new Error(result.stderr || 'Could not update the Windows user PATH');
  return result.stdout.includes('added') ? 1 : 0;
}

try {
  const changed = process.platform === 'win32' ? windows() : posix();
  if (changed) process.stdout.write(`bouncer: 사용자 PATH에 ${binDir} 경로를 추가했습니다. 새 터미널에서 적용됩니다.\n`);
} catch (error) {
  process.stderr.write(`bouncer: npm 전역 경로를 PATH에 자동 등록하지 못했습니다: ${error.message}\n`);
}
