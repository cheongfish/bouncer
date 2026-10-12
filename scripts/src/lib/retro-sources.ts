'use strict';

const fs = require('node:fs');
const path = require('node:path');
const url = require('node:url');

type Host = 'claude-code' | 'codex' | 'cursor';
type Source = {
  host: Host;
  path: string;
  format: 'jsonl' | 'sqlite';
  mtime: string;
  size: number;
};
type SkipReason = 'root-missing' | 'permission-denied' | 'unparseable-session-meta' | 'no-project-match';
type Skipped = { host: Host; path: string; reason: SkipReason };
type Roots = { claude: string; codex: string; cursor: string };

// Codex 첫 줄(session_meta)만 읽는다. 본문 전체를 읽지 않으려는 상한이며,
// 이보다 긴 첫 줄은 해석 불가로 skipped에 남는다.
const CODEX_META_MAX_BYTES = 64 * 1024;

/**
 * 파일시스템 오류를 host별 skipped 사유로 바꾼다. 예상한 코드(없음·권한)만
 * 흡수하고 나머지는 그대로 던져 원인이 다른 실패가 한 사유로 뭉개지지 않게 한다.
 *
 * @param {unknown} err - fs 호출이 던진 값
 * @param {Host} host - 실패가 난 host
 * @param {string} target - 실패한 경로(루트 또는 파일)
 * @param {Skipped[]} skipped - 사유를 누적할 목록
 * @returns {void} 흡수하면 skipped에 한 건을 더하고 돌아오며, 모르는 오류는 다시 던진다
 */
function absorbFsError(err: unknown, host: Host, target: string, skipped: Skipped[]): void {
  const code = (err as NodeJS.ErrnoException | null)?.code;
  // ENOENT/ENOTDIR: 설치되지 않았거나 경로가 디렉터리가 아님 — 루트가 없는 것과 같다.
  if (code === 'ENOENT' || code === 'ENOTDIR') {
    skipped.push({ host, path: target, reason: 'root-missing' });
    return;
  }
  // EACCES/EPERM: 존재는 하나 읽을 수 없음. 없음과 구분해 사용자가 권한을 고치게 한다.
  if (code === 'EACCES' || code === 'EPERM') {
    skipped.push({ host, path: target, reason: 'permission-denied' });
    return;
  }
  throw err;
}

/**
 * 정규화한 경로 p가 root와 같거나 root 아래인지 판정한다. `/r2`가 `/r` 아래로
 * 오인되지 않도록 구분자를 붙여 비교한다.
 *
 * @param {string} p - 검사할 경로
 * @param {string} root - project root
 * @returns {boolean} 같거나 아래이면 true
 */
function isUnderRoot(p: string, root: string): boolean {
  const np = path.resolve(p);
  const nr = path.resolve(root);
  return np === nr || np.startsWith(nr + path.sep);
}

/**
 * 파일 하나의 stat을 Source로 만든다.
 *
 * @param {Host} host - 출처 host
 * @param {string} file - 절대 경로
 * @param {'jsonl' | 'sqlite'} format - 파일 형식
 * @returns {Source} mtime은 ISO 8601, size는 bytes
 */
function toSource(host: Host, file: string, format: 'jsonl' | 'sqlite'): Source {
  const st = fs.statSync(file);
  return { host, path: file, format, mtime: st.mtime.toISOString(), size: st.size };
}

/**
 * Claude Code 프로젝트 디렉터리 이름(slug)을 만든다. Claude Code가 cwd를
 * 디렉터리 이름으로 바꾸는 규칙과 같게 영숫자가 아닌 글자를 모두 `-`로 바꾼다.
 *
 * @param {string} projectRoot - project root 절대 경로
 * @returns {string} 예: `/home/a/repo.x` → `-home-a-repo-x`
 */
function claudeProjectSlug(projectRoot: string): string {
  return projectRoot.replace(/[^A-Za-z0-9]/g, '-');
}

/**
 * Claude Code 후보를 모은다. slug와 같은 이름, 또는 `<slug>--`로 시작하는
 * 이름(`.worktrees` 아래 worktree의 slug)의 디렉터리 바로 아래 `*.jsonl`만 본다.
 *
 * @param {string} root - claude projects 루트
 * @param {string} projectRoot - project root
 * @param {Skipped[]} skipped - 건너뛴 사유 누적 목록
 * @returns {Source[]} 후보 목록(정렬 전)
 */
function collectClaude(root: string, projectRoot: string, skipped: Skipped[]): Source[] {
  let names: string[];
  try {
    names = fs.readdirSync(root);
  } catch (err) {
    absorbFsError(err, 'claude-code', root, skipped);
    return [];
  }
  const slug = claudeProjectSlug(projectRoot);
  const out: Source[] = [];
  for (const name of names) {
    if (name !== slug && !name.startsWith(`${slug}--`)) continue;
    const dir = path.join(root, name);
    let files: string[];
    try {
      files = fs.readdirSync(dir);
    } catch (err) {
      absorbFsError(err, 'claude-code', dir, skipped);
      continue;
    }
    for (const f of files) {
      if (f.endsWith('.jsonl')) out.push(toSource('claude-code', path.join(dir, f), 'jsonl'));
    }
  }
  return out;
}

/**
 * Codex rollout 파일의 첫 줄만 읽어 JSON으로 해석한다. 본문은 읽지 않는다.
 *
 * @param {string} file - rollout jsonl 절대 경로
 * @returns {unknown} 해석한 첫 줄. 줄이 없거나 JSON이 아니면 undefined
 */
function readFirstLineJson(file: string): unknown {
  const fd = fs.openSync(file, 'r');
  let text: string;
  try {
    const buf = Buffer.alloc(CODEX_META_MAX_BYTES);
    const n = fs.readSync(fd, buf, 0, CODEX_META_MAX_BYTES, 0);
    text = buf.subarray(0, n).toString('utf8');
  } finally {
    fs.closeSync(fd);
  }
  const line = text.split('\n', 1)[0];
  try {
    return JSON.parse(line);
  } catch (err) {
    // JSON.parse는 SyntaxError만 던진다. 첫 줄이 깨진 파일은 해석 불가로
    // 보고하는 것이 목적이라 흡수하고, 다른 오류가 끼어들 자리는 없다.
    if (err instanceof SyntaxError) return undefined;
    throw err;
  }
}

/**
 * Codex sessions 루트 아래 모든 `*.jsonl`을 재귀로 훑어 cwd가 project root
 * 아래인 파일을 후보로 모은다.
 *
 * @param {string} root - codex sessions 루트
 * @param {string} projectRoot - project root
 * @param {Skipped[]} skipped - 건너뛴 사유 누적 목록
 * @returns {Source[]} 후보 목록(정렬 전)
 */
function collectCodex(root: string, projectRoot: string, skipped: Skipped[]): Source[] {
  const out: Source[] = [];
  const walk = (dir: string): void => {
    let entries: Array<{ name: string; isDirectory(): boolean; isFile(): boolean }>;
    try {
      entries = fs.readdirSync(dir, { withFileTypes: true });
    } catch (err) {
      absorbFsError(err, 'codex', dir, skipped);
      return;
    }
    for (const e of entries) {
      const full = path.join(dir, e.name);
      if (e.isDirectory()) { walk(full); continue; }
      if (!e.isFile() || !e.name.endsWith('.jsonl')) continue;
      let meta: unknown;
      try {
        meta = readFirstLineJson(full);
      } catch (err) {
        absorbFsError(err, 'codex', full, skipped);
        continue;
      }
      const cwd = (meta as { payload?: { cwd?: unknown } } | undefined)?.payload?.cwd;
      if (typeof cwd !== 'string') {
        skipped.push({ host: 'codex', path: full, reason: 'unparseable-session-meta' });
        continue;
      }
      if (isUnderRoot(cwd, projectRoot)) out.push(toSource('codex', full, 'jsonl'));
    }
  };
  walk(root);
  return out;
}

/**
 * Cursor workspaceStorage를 훑어 `workspace.json`의 folder가 project root 아래인
 * 작업공간의 `state.vscdb`를 후보로 모은다.
 *
 * @param {string} root - cursor workspaceStorage 루트
 * @param {string} projectRoot - project root
 * @param {Skipped[]} skipped - 건너뛴 사유 누적 목록
 * @returns {Source[]} 후보 목록(정렬 전)
 */
function collectCursor(root: string, projectRoot: string, skipped: Skipped[]): Source[] {
  let names: string[];
  try {
    names = fs.readdirSync(root);
  } catch (err) {
    absorbFsError(err, 'cursor', root, skipped);
    return [];
  }
  const out: Source[] = [];
  for (const name of names) {
    const dir = path.join(root, name);
    let parsed: unknown;
    try {
      parsed = JSON.parse(fs.readFileSync(path.join(dir, 'workspace.json'), 'utf8'));
    } catch (err) {
      // workspace.json이 없거나(ENOENT/ENOTDIR) 깨진 작업공간은 이 프로젝트와
      // 무관한 항목이다. skipped 사유 enum에 Cursor용 해석 불가가 없어 조용히 건너뛰고,
      // 권한 오류 등 그 밖의 코드는 숨기지 않고 던진다.
      const code = (err as NodeJS.ErrnoException).code;
      if (code === 'ENOENT' || code === 'ENOTDIR' || err instanceof SyntaxError) continue;
      absorbFsError(err, 'cursor', dir, skipped);
      continue;
    }
    // JSON `null`이나 배열·원시값처럼 객체가 아닌 workspace.json은 `.folder` 접근이
    // TypeError를 던지므로, try 밖에서 형태를 확인해 folder 없음과 같게 건너뛴다.
    const folder: unknown = parsed !== null && typeof parsed === 'object'
      ? (parsed as { folder?: unknown }).folder
      : undefined;
    if (typeof folder !== 'string' || !folder.startsWith('file://')) continue;
    let folderPath: string;
    try {
      folderPath = url.fileURLToPath(folder);
    } catch (err) {
      // 이 플랫폼에서 해석할 수 없는 file URI(예: 다른 OS의 드라이브 경로)는
      // 현재 project root와 일치할 수 없으므로 건너뛴다. POSIX에서 호스트가 든
      // `file://host/...`(ERR_INVALID_FILE_URL_HOST)도 로컬 project root일 수 없어 같다.
      // 그 밖의 오류는 던진다.
      const code = (err as NodeJS.ErrnoException).code;
      if (code === 'ERR_INVALID_FILE_URL_PATH' || code === 'ERR_INVALID_FILE_URL_HOST'
        || code === 'ERR_INVALID_URL') continue;
      throw err;
    }
    if (!isUnderRoot(folderPath, projectRoot)) continue;
    const db = path.join(dir, 'state.vscdb');
    try {
      out.push(toSource('cursor', db, 'sqlite'));
    } catch (err) {
      // state.vscdb가 아직 없는 작업공간은 읽을 transcript가 없는 것이다.
      if ((err as NodeJS.ErrnoException).code === 'ENOENT') continue;
      absorbFsError(err, 'cursor', db, skipped);
    }
  }
  return out;
}

/**
 * 현재 프로젝트에 속한 Claude Code·Codex·Cursor transcript 후보를 나열한다.
 * transcript 본문은 읽지 않으며(Codex 첫 줄 메타만), host별 실패는 전체 실패가
 * 아니라 skipped에 남긴다. 루트는 있으나 일치 항목이 없는 host는 `no-project-match`다.
 *
 * @param {object} opts - 탐색 입력
 * @param {string} opts.projectRoot - project root 절대 경로
 * @param {Roots} opts.roots - host별 transcript 루트(테스트는 임시 디렉터리를 주입)
 * @param {number} opts.limit - 최대 후보 수(호출자가 1..200으로 검증)
 * @returns {{project_root: string, sources: Source[], skipped: Skipped[]}}
 *   sources는 mtime 내림차순으로 limit개까지
 */
function listRetroSources(opts: { projectRoot: string; roots: Roots; limit: number }) {
  const { projectRoot, roots, limit } = opts;
  const skipped: Skipped[] = [];
  const hosts: Array<[Host, string, (r: string, p: string, s: Skipped[]) => Source[]]> = [
    ['claude-code', roots.claude, collectClaude],
    ['codex', roots.codex, collectCodex],
    ['cursor', roots.cursor, collectCursor],
  ];
  const all: Source[] = [];
  for (const [host, root, collect] of hosts) {
    const before = skipped.length;
    const found = collect(root, projectRoot, skipped);
    all.push(...found);
    // 루트 접근 실패(root-missing/permission-denied)와 겹치지 않도록, 그 사유가
    // 이 host에 이미 기록된 경우에는 no-project-match를 더하지 않는다.
    const rootFailed = skipped.slice(before).some((s) => s.host === host && s.path === root);
    if (found.length === 0 && !rootFailed) {
      skipped.push({ host, path: root, reason: 'no-project-match' });
    }
  }
  // mtime 동률은 경로로 고정해 같은 입력이 같은 순서를 내게 한다.
  all.sort((a, b) => (a.mtime < b.mtime ? 1 : a.mtime > b.mtime ? -1 : a.path.localeCompare(b.path)));
  return { project_root: projectRoot, sources: all.slice(0, limit), skipped };
}

/**
 * host별 기본 transcript 루트를 정한다. 호출자가 home·platform·env를 주입해
 * 테스트가 실제 home을 읽지 않는다.
 *
 * @param {object} opts - 입력
 * @param {string} opts.homeDir - 사용자 home
 * @param {NodeJS.Platform} opts.platform - Cursor 기본 경로를 가르는 플랫폼
 * @param {Record<string, string | undefined>} opts.env - CLAUDE_CONFIG_DIR·CODEX_HOME·APPDATA를 읽는 환경
 * @returns {Roots} claude/codex/cursor 루트
 */
function defaultRetroRoots(opts: {
  homeDir: string;
  platform: NodeJS.Platform;
  env: Record<string, string | undefined>;
}): Roots {
  const { homeDir, platform, env } = opts;
  const claude = path.join(env.CLAUDE_CONFIG_DIR || path.join(homeDir, '.claude'), 'projects');
  const codex = path.join(env.CODEX_HOME || path.join(homeDir, '.codex'), 'sessions');
  let cursorBase: string;
  if (platform === 'darwin') {
    cursorBase = path.join(homeDir, 'Library', 'Application Support');
  } else if (platform === 'win32') {
    // APPDATA가 없으면 Windows 기본 위치(home 아래 AppData/Roaming)로 추정한다.
    cursorBase = env.APPDATA || path.join(homeDir, 'AppData', 'Roaming');
  } else {
    cursorBase = path.join(homeDir, '.config');
  }
  return { claude, codex, cursor: path.join(cursorBase, 'Cursor', 'User', 'workspaceStorage') };
}

export = { listRetroSources, defaultRetroRoots, claudeProjectSlug };
