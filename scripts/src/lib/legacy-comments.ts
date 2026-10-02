'use strict';
const fs = require('node:fs');
const path = require('node:path');
import templates = require('./templates');
const { findLegacyScaffoldComments } = templates;
import paths = require('./paths');
const { epicDirOf, toPosix } = paths;

/**
 * blueprint 디렉터리 아래 .md를 재귀로 모은다.
 * 디렉터리가 없으면 빈 목록을 돌려 G22를 만들지 않는다 — 그 부재는 G2·G3이 판정한다.
 *
 * @param {string} absDir - 절대 경로 디렉터리
 * @param {string} repoRoot - 저장소 루트 절대 경로
 * @returns {string[]} 저장소 상대 POSIX .md 경로
 */
function collectBlueprintMarkdown(absDir: string, repoRoot: string): string[] {
  if (!fs.existsSync(absDir)) return [];
  const found: string[] = [];
  const stack = [absDir];
  while (stack.length > 0) {
    const current = stack.pop() as string;
    // 권한 오류 등은 삼키지 않는다. plan gate·bootstrap이 잡지 않아 CLI가 기존 예외 경로로 끝난다.
    const entries = fs.readdirSync(current, { withFileTypes: true });
    for (const entry of entries) {
      const abs = path.join(current, entry.name);
      if (entry.isDirectory()) {
        stack.push(abs);
      } else if (entry.isFile() && entry.name.endsWith('.md')) {
        found.push(toPosix(path.relative(repoRoot, abs)));
      }
    }
  }
  return found;
}

/**
 * epic index와 blueprint 트리의 .md에서 옛 스캐폴드 안내 주석이 남은 경로를 모은다.
 * 판정은 findLegacyScaffoldComments에 맡기고, 저자 주석만 있는 파일은 빠진다.
 * 존재하지 않는 파일은 조용히 제외하고, 존재하지만 읽기에 실패한 파일은 예외를 그대로 올린다.
 *
 * @param {{ repoRoot: string, blueprintDir: string }} opts - 스캔 범위
 * @param {string} opts.repoRoot - 저장소 루트 절대 경로
 * @param {string} opts.blueprintDir - blueprint 디렉터리의 저장소 상대 POSIX 경로
 * @returns {string[]} 옛 주석이 있는 파일의 정렬된 저장소 상대 POSIX 경로
 */
function scanLegacyScaffoldComments(
  { repoRoot, blueprintDir }: { repoRoot: string; blueprintDir: string },
): string[] {
  const leftover: string[] = [];
  const epicIndexRel = `${toPosix(epicDirOf(blueprintDir))}/index.md`;
  const candidates = [
    epicIndexRel,
    ...collectBlueprintMarkdown(path.join(repoRoot, blueprintDir), repoRoot),
  ];
  // 같은 파일이 두 번 나오지 않게 한다. epic index는 blueprint 트리 밖이지만
  // 잘못된 blueprintDir가 epic 자신을 가리키면 겹칠 수 있다.
  const seen = new Set<string>();
  for (const rel of candidates) {
    if (seen.has(rel)) continue;
    seen.add(rel);
    const abs = path.join(repoRoot, rel);
    if (!fs.existsSync(abs) || !fs.statSync(abs).isFile()) continue;
    const body = fs.readFileSync(abs, 'utf8');
    if (findLegacyScaffoldComments(body).length > 0) leftover.push(rel);
  }
  leftover.sort((a, b) => (a < b ? -1 : a > b ? 1 : 0));
  return leftover;
}

export = { scanLegacyScaffoldComments };
