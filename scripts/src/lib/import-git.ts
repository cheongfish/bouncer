'use strict';
import type { RawCommit } from './import-types';

// git 로그를 읽고 파싱하는 층. 실제 spawn 은 주입된 execFileSync 만 —
// 이 파일이 child_process 를 require 하면 테스트가 주입 없이 실제 git 을
// 칠 수 있는 경로가 생긴다. import-history 를 require 하지 않는다
// (git → plan 순환 금지).
type ExecFileSyncFn = typeof import('node:child_process').execFileSync;

const LOG_FORMAT = '%H%x1f%s%x1f%aI%x1f%an';
const EPIC_ID_PREFIX_RE = /^(\d{3})-/;

/** 제목에서 ASCII 슬러그를 뽑고, 한글·기호만 남으면 축약 sha로 떨어뜨린다. */
function slugFromSubject(subject: string, sha: string): string {
  const slug = String(subject || '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
  return slug || sha.slice(0, 7);
}

function parseLogOutput(text: string): RawCommit[] {
  const out: RawCommit[] = [];
  for (const line of String(text || '').split('\n')) {
    if (!line.trim()) continue;
    const parts = line.split('\x1f');
    if (parts.length < 4) continue;
    const [sha, subject, date, author] = parts;
    if (!sha) continue;
    out.push({
      sha,
      subject: subject || '',
      date: date || '',
      author: author || '',
    });
  }
  return out;
}

function gitLogArgs(kind: 'merges' | 'commits', since?: string): string[] {
  const args = kind === 'merges'
    ? ['log', '--merges', '--reverse', `--format=${LOG_FORMAT}`]
    : ['log', '--reverse', `--format=${LOG_FORMAT}`];
  // --since <ref> 는 날짜 해석이 아니라 <ref>..HEAD 범위다.
  if (typeof since === 'string' && since) args.push(`${since}..HEAD`);
  return args;
}

function listChangedFiles(
  execFileSync: ExecFileSyncFn,
  repoRoot: string,
  source: 'merges' | 'commits',
  sha: string,
): string[] {
  // merge 커밋은 부모가 둘이라 `git show --name-only <sha>`가 결합 diff를
  // 내지 않고 파일 목록이 비어 버린다. 첫 부모(^1, 병합 대상 브랜치)와의
  // diff 로만 이번 머지가 가져온 경로가 보인다. 일반 커밋은 부모가 하나라
  // show 한 번으로 그 커밋이 건드린 파일을 얻는다.
  const args = source === 'merges'
    ? ['diff', '--name-only', `${sha}^1`, sha]
    : ['show', '--name-only', '--format=', sha];
  const out = execFileSync('git', args, {
    cwd: repoRoot,
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  return String(out || '')
    .split('\n')
    .map((l) => l.trim())
    .filter(Boolean);
}

export = {
  LOG_FORMAT,
  EPIC_ID_PREFIX_RE,
  slugFromSubject,
  parseLogOutput,
  gitLogArgs,
  listChangedFiles,
};
