'use strict';
// 사용자 quiz 확인 이후 explain.md의 `bouncer.comprehension` 단일 entry를 생성하는 소유자.
// 수기 복사로 range/diff_sha가 어긋나는 일을 막으려고 digest·HEAD·computeDiffSha 세 곳이
// 모두 같을 때만 쓴다. G16 판정과 computeDiffSha 의미는 건드리지 않는다.
const nodeFs = require('node:fs');
const nodePath = require('node:path');
const { spawnSync } = require('node:child_process');
import comprehension = require('./comprehension');
import frontmatter = require('./frontmatter');
import render = require('./render');
import paths = require('./paths');
import timeLib = require('./time');
const { computeDiffSha, resolveComprehensionEntry } = comprehension;
const { parseFrontmatter } = frontmatter;
const { renderDoc } = render;
const { toPosix } = paths;
const { nowIsoKst } = timeLib;

type ExecResult = { status: number; stdout: string };

type ComprehensionFs = {
  readFileSync: (p: string, enc: 'utf8') => string;
  writeFileSync: (p: string, data: string) => void;
  renameSync: (from: string, to: string) => void;
};

type ComprehensionDeps = {
  exec?: (args: string[]) => ExecResult;
  now?: () => Date;
  fs?: ComprehensionFs;
};

type RecordedEntry = { range_from: string; range_to: string; diff_sha: string; recorded_at: string };

type RecordResult =
  | { ok: true; entry: RecordedEntry }
  | {
    ok: false;
    reason: 'comprehension-consent-required' | 'comprehension-input-invalid' | 'comprehension-target-stale';
  };

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function nonEmpty(value: unknown): value is string {
  return typeof value === 'string' && value.trim() !== '';
}

/**
 * 사용자 quiz 확인 뒤 blueprint explain.md에 comprehension entry를 정확히 한 개 기록한다.
 * 모든 거절은 파일 bytes를 바꾸기 전에 일어난다. 쓰기는 같은 디렉터리의 임시 파일에 쓴 뒤
 * rename하므로 쓰기 중 실패해도 기존 explain.md는 온전하다.
 *
 * @param {object} opts
 * @param {string} opts.repoRoot - 실행 checkout 루트(explain.md를 쓰는 곳)
 * @param {string} opts.blueprintDir - blueprint 상대 경로
 * @param {unknown} opts.digest - `finalize prepare`가 낸 digest JSON(파싱된 값)
 * @param {boolean} opts.confirmed - 실제 사용자 quiz 답변을 받은 controller의 --confirm-quiz
 * @param {boolean} opts.refresh - 기존 유효 기록을 후속 HEAD로 갱신하는 --refresh
 * @param {object} [opts.deps] - 테스트 seam: exec(git argv), now, fs
 * @returns {RecordResult} 기록한 entry 또는 거절 reason
 *   (consent-required: 확인·refresh 둘 다 없음, input-invalid: digest·Explain·기존 기록 손상,
 *   target-stale: digest가 현재 HEAD·diff fingerprint·기존 base와 다름)
 */
function recordComprehension({ repoRoot, blueprintDir, digest, confirmed, refresh, deps }: {
  repoRoot: string;
  blueprintDir: string;
  digest: unknown;
  confirmed: boolean;
  refresh: boolean;
  deps?: ComprehensionDeps;
}): RecordResult {
  const fs: ComprehensionFs = (deps && deps.fs) || nodeFs;
  const exec = (deps && deps.exec) || ((args: string[]): ExecResult => {
    const r = spawnSync('git', args, {
      cwd: repoRoot, encoding: 'utf8', env: { ...process.env, GIT_TERMINAL_PROMPT: '0' },
    });
    return { status: typeof r.status === 'number' ? r.status : 1, stdout: r.stdout || '' };
  });
  const now = (deps && deps.now) || (() => new Date());
  const invalid = { ok: false, reason: 'comprehension-input-invalid' } as const;
  const stale = { ok: false, reason: 'comprehension-target-stale' } as const;

  // 1. 동의가 가장 먼저다. 확인도 refresh도 없으면 입력을 읽지도 않아 어떤 검증 결과도 새지 않는다.
  if (!confirmed && !refresh) return { ok: false, reason: 'comprehension-consent-required' };

  // 2. digest 형태 검증. 필요한 필드가 문자열이 아니면 손상 입력이다.
  if (!isRecord(digest) || !isRecord(digest.blueprint) || !isRecord(digest.range)) return invalid;
  const { base, head, diff_sha: digestSha } = digest.range;
  if (!nonEmpty(base) || !nonEmpty(head) || !nonEmpty(digestSha)) return invalid;
  const bp = toPosix(blueprintDir).replace(/\/+$/, '');
  if (!nonEmpty(digest.blueprint.dir) || toPosix(digest.blueprint.dir).replace(/\/+$/, '') !== bp) return invalid;

  // 3. explain.md 읽기·파싱. 없거나 frontmatter가 깨졌으면 쓸 곳이 없다.
  const explainPath = nodePath.join(repoRoot, bp, 'explain.md');
  let parsed;
  try {
    parsed = parseFrontmatter(fs.readFileSync(explainPath, 'utf8'));
  } catch (_e) {
    // 파일 부재·읽기 실패·frontmatter 파싱 실패를 모두 "쓸 수 없는 Explain"으로 모은다.
    // 어느 경우든 아직 아무것도 쓰지 않았으므로 하나의 거절로 합쳐도 안전하다.
    return invalid;
  }
  if (!isRecord(parsed.data) || !isRecord(parsed.data.bouncer)) return invalid;
  const data = parsed.data;
  const bouncer = data.bouncer as Record<string, unknown>;

  // 4. 현재 HEAD·diff fingerprint가 digest와 같아야 한다. 후속 커밋 뒤의 낡은 digest를 거른다.
  const headNow = exec(['rev-parse', 'HEAD']);
  if (headNow.status !== 0 || headNow.stdout.trim() !== head) return stale;
  const diff = computeDiffSha({
    repoRoot, base, exec: (args: string[]) => ({ ...exec(args), stderr: '' }),
  });
  if (!diff.ok || diff.sha !== digestSha) return stale;

  // 5. refresh는 기존 유효 기록이 있을 때만, 그리고 base가 같을 때만 range_from을 유지한 채 갱신한다.
  //    quiz를 건너뛰는 최초 기록의 대체 수단이 되지 않게 한다.
  let rangeFrom = base;
  if (refresh) {
    const existing = resolveComprehensionEntry(bouncer.comprehension);
    if (!existing.ok) return invalid;
    if (existing.entry.range_from !== base) return stale;
    rangeFrom = existing.entry.range_from;
  }

  // 6. task 필드 없는 단일 entry로 배열을 통째 교체한다.
  const entry: RecordedEntry = {
    range_from: rangeFrom, range_to: head, diff_sha: digestSha, recorded_at: nowIsoKst(now()),
  };
  bouncer.comprehension = [entry];

  // 7. 임시 파일 → rename. 쓰기 실패는 호출자에게 전파하되 임시 파일은 남기지 않는다.
  const tmpPath = `${explainPath}.tmp-${process.pid}`;
  try {
    fs.writeFileSync(tmpPath, renderDoc(data, parsed.body));
    fs.renameSync(tmpPath, explainPath);
  } catch (error) {
    // 정리 실패(이미 없음 등)는 원래 오류를 가리면 안 되므로 force로 흡수한다.
    nodeFs.rmSync(tmpPath, { force: true });
    throw error;
  }
  return { ok: true, entry };
}

export = { recordComprehension };
