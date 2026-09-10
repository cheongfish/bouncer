'use strict';
import paths = require('./paths');
const { toPosix } = paths;

const CONTEXT_ROOT = '.bouncer/context';
// Codex는 플러그인 `agents/*.md`를 named role로 읽지 않는다. 프로젝트
// `.codex/agents/*.toml`만 스캔하므로 init이 여기에 심는다.
const CODEX_AGENTS_DIR = '.codex/agents';
// context 디렉터리는 접두 없는 zero-pad 세 자리 id만 정본으로 인정한다.
const EPIC_DIR = /^\.bouncer\/context\/epics\/\d{3}-[^/]+$/;
const BLUEPRINT_DIR =
  /^\.bouncer\/context\/epics\/\d{3}-[^/]+\/blueprints\/\d{3}-[^/]+$/;

function normalizeRepoPath(value: unknown): string {
  return toPosix(value);
}

function isCanonicalEpicDir(value: unknown): boolean {
  return EPIC_DIR.test(normalizeRepoPath(value));
}

function isCanonicalBlueprintDir(value: unknown): boolean {
  return BLUEPRINT_DIR.test(normalizeRepoPath(value));
}

export = {
  CONTEXT_ROOT,
  CODEX_AGENTS_DIR,
  normalizeRepoPath,
  isCanonicalEpicDir,
  isCanonicalBlueprintDir,
};
