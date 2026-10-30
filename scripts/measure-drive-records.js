'use strict';

const fs = require('node:fs');
const path = require('node:path');
const { createHash } = require('node:crypto');
const { spawnSync } = require('node:child_process');

// drive 실행 기록(metrics snapshot의 `drive_record`)과 metrics 세션 기록을 모아 범위·충돌·CI repair wave·
// 비용을 집계한다. 문턱(direct 승격 task 수, 병렬 수, 경보 수)을 바꿔도 같은 입력에서 같은 바이트를
// 내므로, 문턱 변경의 효과를 과거 drive에 대해 재현해 비교하는 용도다. 이 스크립트는 정리된 빌드
// 산출물(`packages/cli/dist`)에 기대지 않는다 — 빌드 없이도 과거 snapshot 파일만으로 돌아가야 한다.

// 문턱 키와 기본값. direct_max_commit_tasks·max_parallel은 config.ts의 기본값과 같아야 비교가 맞는다.
const DEFAULTS = {
  direct_max_commit_tasks: 3,
  max_parallel: 2,
  ci_repair_wave_alert: 1,
  unexpected_path_alert: 1,
};
// 0 이상 정수가 기본 범위이고, max_parallel만 0으로 나누므로 1 이상이다.
const MIN_VALUE = { max_parallel: 1 };
const DEFAULT_SESSIONS = path.join('.bouncer', 'runtime', 'drive-metrics.json');

class UsageError extends Error {}
class InputError extends Error {}

function isRecord(value) {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isCount(value) {
  return Number.isSafeInteger(value) && value >= 0;
}

function isStringArray(value) {
  return Array.isArray(value) && value.every((v) => typeof v === 'string');
}

/**
 * `drive_record`의 모양 검사. packages/cli/src/drive-record.ts의 `isDriveRecord`와 같은 규칙이다.
 * 그 모듈은 dist로 빌드되는 TS라 이 스크립트가 require할 수 없어(dist 비의존) 규칙만 복제했다.
 * 규칙이 바뀌면 두 곳을 함께 고친다. mode·promotion은 둘 다 없거나(옛 snapshot) 둘 다 있어야 한다.
 *
 * @param {unknown} value - 검사할 값
 * @returns {boolean} 모든 키와 타입이 맞으면 true
 */
function isDriveRecord(value) {
  if (!isRecord(value)) return false;
  const { decision_kinds: kinds, conflicts, repair_waves: waves, reviewer, baseline, review } = value;
  const hasMode = Object.prototype.hasOwnProperty.call(value, 'mode');
  const hasPromotion = Object.prototype.hasOwnProperty.call(value, 'promotion');
  if (hasMode !== hasPromotion) return false;
  if (hasMode) {
    if (value.mode !== 'light' && value.mode !== 'full') return false;
    const promo = value.promotion;
    if (!(promo === null || (isRecord(promo) && typeof promo.reason === 'string'
      && typeof promo.task === 'string'))) {
      return false;
    }
  }
  const reviewOk = review === null || (isRecord(review) && (review.contract === null
    || typeof review.contract === 'string') && isRecord(review.must_fix)
    && ['total', 'resolved', 'accepted', 'deferred', 'open'].every((k) => isCount(review.must_fix[k])));
  return isCount(value.tasks) && isRecord(kinds) && Object.values(kinds).every(isCount)
    && isCount(value.scope_revisions) && isCount(value.unexpected_paths) && isCount(value.overlaps)
    && isRecord(conflicts) && isCount(conflicts.fanin)
    && isRecord(waves) && isCount(waves.ci) && isCount(waves.review)
    && isRecord(reviewer) && isCount(reviewer.dispatches)
    && isStringArray(reviewer.perspectives) && isStringArray(reviewer.models)
    && (baseline === null || (isRecord(baseline) && typeof baseline.command === 'string'
      && Number.isSafeInteger(baseline.exit) && typeof baseline.accepted === 'boolean'))
    && reviewOk;
}

/**
 * snapshot 파일 하나의 판정. 모양이 틀리면 not-snapshot, drive_record 키가 없으면 no-drive-record다.
 *
 * @param {unknown} parsed - 파싱된 JSON
 * @returns {{ok: true, snapshot: object} | {ok: false, reason: string}} 사용할 snapshot 또는 건너뜀 사유
 */
function classify(parsed) {
  if (!isRecord(parsed) || parsed.version !== 1 || typeof parsed.blueprint !== 'string'
    || !isRecord(parsed.worker_tokens) || !isCount(parsed.worker_tokens.total)) {
    return { ok: false, reason: 'not-snapshot' };
  }
  if (!Object.prototype.hasOwnProperty.call(parsed, 'drive_record')) return { ok: false, reason: 'no-drive-record' };
  if (!isDriveRecord(parsed.drive_record)) return { ok: false, reason: 'not-snapshot' };
  return { ok: true, snapshot: parsed };
}

/**
 * 문턱 하나의 값을 검사한다. 소수·음수·문자는 범위 밖이다.
 *
 * @param {string} key - 문턱 키
 * @param {string} text - `k=n`의 n
 * @returns {number} 검사를 통과한 정수
 */
function parseValue(key, text) {
  if (!Object.prototype.hasOwnProperty.call(DEFAULTS, key)) throw new UsageError(`unknown threshold: ${key}`);
  const n = /^\d+$/.test(text) ? Number(text) : NaN;
  if (!Number.isSafeInteger(n) || n < (MIN_VALUE[key] ?? 0)) {
    throw new UsageError(`threshold out of range: ${key}=${text}`);
  }
  return n;
}

function splitPair(text, label) {
  const at = text.indexOf('=');
  if (at <= 0) throw new UsageError(`${label} expects k=n: ${text}`);
  return [text.slice(0, at), text.slice(at + 1)];
}

/**
 * argv를 해석한다. 알 수 없는 인자와 잘못된 문턱은 UsageError(exit 2)다.
 *
 * @param {string[]} argv - process.argv.slice(2)
 * @returns {{inputs: string[], sessions: string | null, thresholds: object, sweep: object | null}} 해석 결과
 */
function parseArgs(argv) {
  const out = { inputs: [], sessions: null, thresholds: { ...DEFAULTS }, sweep: null };
  for (let i = 0; i < argv.length; i += 1) {
    const flag = argv[i];
    if (!['--input', '--sessions', '--threshold', '--sweep'].includes(flag)) {
      throw new UsageError(`unknown argument: ${flag}`);
    }
    const value = argv[i + 1];
    if (value === undefined) throw new UsageError(`${flag} needs a value`);
    i += 1;
    if (flag === '--input') out.inputs.push(value);
    else if (flag === '--sessions') out.sessions = value;
    else if (flag === '--threshold') {
      const [key, text] = splitPair(value, '--threshold');
      out.thresholds[key] = parseValue(key, text);
    } else {
      if (out.sweep !== null) throw new UsageError('--sweep may be given only once');
      const [key, list] = splitPair(value, '--sweep');
      out.sweep = { key, values: list.split(',').map((text) => parseValue(key, text)) };
    }
  }
  return out;
}

/**
 * 한 문턱 조합의 효과를 계산한다.
 *
 * @param {object[]} records - 사용할 drive_record 배열
 * @param {object} thresholds - 문턱 키별 값
 * @returns {object} direct_eligible_drives·wave_estimate·두 경보 drive 수
 */
function effects(records, thresholds) {
  return {
    direct_eligible_drives: records.filter((r) => r.tasks <= thresholds.direct_max_commit_tasks).length,
    wave_estimate: records.reduce((n, r) => n + Math.ceil(r.tasks / thresholds.max_parallel), 0),
    ci_repair_alert_drives: records.filter((r) => r.repair_waves.ci >= thresholds.ci_repair_wave_alert).length,
    unexpected_path_alert_drives: records.filter((r) => r.unexpected_paths >= thresholds.unexpected_path_alert)
      .length,
  };
}

function sum(rows, pick) {
  return rows.reduce((n, row) => n + pick(row), 0);
}

function normalizeBlueprint(value) {
  return value.replace(/\\/g, '/').replace(/\/+$/, '');
}

function emptyModeBucket() {
  return {
    drives: 0, tasks: 0, worker_tokens: 0, session_tokens: 0,
    ci_repair_waves: 0, review_repair_waves: 0,
  };
}

/**
 * snapshot의 drive_record에서 집계 버킷 이름을 고른다. mode 키가 없으면 옛 기록이므로 unknown이다.
 *
 * @param {object} driveRecord - 검사된 drive_record
 * @returns {'light' | 'full' | 'unknown'} 버킷 키
 */
function modeBucket(driveRecord) {
  if (!Object.prototype.hasOwnProperty.call(driveRecord, 'mode')) return 'unknown';
  return driveRecord.mode === 'light' ? 'light' : 'full';
}

/**
 * 사용할 snapshot과 세션 기록으로 출력 객체를 만든다. 시각·환경을 읽지 않는 순수 함수라 같은 입력이면
 * 같은 값을 낸다. `by_mode`는 light/full/unknown으로 토큰·repair wave를 나누고, `promotions`는
 * drive_record.promotion.reason별 횟수(키 사전순)다.
 *
 * @param {object} opts - 집계 입력
 * @param {Array<{path: string, sha256: string, snapshot: object}>} opts.inputs - 사용할 snapshot(경로순)
 * @param {Array<{path: string, reason: string}>} opts.skipped - 건너뛴 파일(경로순)
 * @param {object[]} opts.sessions - metrics 세션 기록
 * @param {object} opts.thresholds - 문턱 값
 * @param {{key: string, values: number[]} | null} opts.sweep - sweep 요청
 * @returns {object} 출력 모양(version·inputs·skipped·thresholds·totals·by_mode·promotions·threshold_effects·sweep?)
 */
function aggregate({ inputs, skipped, sessions, thresholds, sweep }) {
  const records = inputs.map((i) => i.snapshot.drive_record);
  const blueprints = new Set(inputs.map((i) => normalizeBlueprint(i.snapshot.blueprint)));
  // 같은 blueprint의 snapshot이 둘 와도 세션은 한 번만 센다. 세션 토큰은 짝지은 snapshot의 mode 버킷으로 나눈다.
  const blueprintMode = new Map();
  for (const i of inputs) {
    const bp = normalizeBlueprint(i.snapshot.blueprint);
    if (!blueprintMode.has(bp)) blueprintMode.set(bp, modeBucket(i.snapshot.drive_record));
  }
  const matched = sessions.filter((s) => isRecord(s) && typeof s.blueprint === 'string'
    && blueprints.has(normalizeBlueprint(s.blueprint)));
  const num = (v) => (typeof v === 'number' && Number.isFinite(v) ? v : 0);
  const by_mode = { light: emptyModeBucket(), full: emptyModeBucket(), unknown: emptyModeBucket() };
  for (const i of inputs) {
    const r = i.snapshot.drive_record;
    const bucket = by_mode[modeBucket(r)];
    bucket.drives += 1;
    bucket.tasks += r.tasks;
    bucket.worker_tokens += i.snapshot.worker_tokens.total;
    bucket.ci_repair_waves += r.repair_waves.ci;
    bucket.review_repair_waves += r.repair_waves.review;
  }
  for (const s of matched) {
    const bucket = by_mode[blueprintMode.get(normalizeBlueprint(s.blueprint))];
    bucket.session_tokens += num(s.input_tokens) + num(s.output_tokens)
      + num(s.cache_read_tokens) + num(s.cache_write_tokens);
  }
  const promoCounts = {};
  for (const r of records) {
    if (isRecord(r.promotion) && typeof r.promotion.reason === 'string') {
      promoCounts[r.promotion.reason] = (promoCounts[r.promotion.reason] ?? 0) + 1;
    }
  }
  const promotions = Object.fromEntries(Object.keys(promoCounts).sort().map((k) => [k, promoCounts[k]]));
  const result = {
    version: 1,
    inputs: inputs.map(({ path: p, sha256 }) => ({ path: p, sha256 })),
    skipped,
    thresholds: Object.fromEntries(Object.keys(DEFAULTS).map((k) => [k, thresholds[k]])),
    totals: {
      drives: records.length,
      tasks: sum(records, (r) => r.tasks),
      scope_revisions: sum(records, (r) => r.scope_revisions),
      unexpected_paths: sum(records, (r) => r.unexpected_paths),
      overlaps: sum(records, (r) => r.overlaps),
      fanin_conflicts: sum(records, (r) => r.conflicts.fanin),
      ci_repair_waves: sum(records, (r) => r.repair_waves.ci),
      review_repair_waves: sum(records, (r) => r.repair_waves.review),
      worker_tokens: sum(inputs, (i) => i.snapshot.worker_tokens.total),
      session_tokens: sum(matched, (s) => num(s.input_tokens) + num(s.output_tokens)
        + num(s.cache_read_tokens) + num(s.cache_write_tokens)),
      cost: sum(matched, (s) => num(s.cost)),
    },
    by_mode,
    promotions,
    threshold_effects: effects(records, thresholds),
  };
  if (sweep) {
    result.sweep = sweep.values.map((value) => ({
      key: sweep.key, value, threshold_effects: effects(records, { ...thresholds, [sweep.key]: value }),
    }));
  }
  return result;
}

function git(args, cwd) {
  const r = spawnSync('git', args, { cwd, encoding: 'utf8' });
  if (r.error || r.status !== 0) return null;
  return r.stdout.trim();
}

/**
 * `--input`을 파일 목록으로 푼다. 파일은 확장자와 무관하게 그 하나이고, 디렉터리는 바로 아래의
 * 일반 파일 `*.json`뿐이다(하위 디렉터리·symlink·다른 확장자는 목록에도 skipped에도 넣지 않는다).
 *
 * @param {string} target - 파일 또는 디렉터리 경로
 * @param {boolean} explicit - 사용자가 지정한 경로인가(없으면 input-not-found)
 * @returns {string[]} 절대 경로 목록
 */
function expand(target, explicit) {
  let stat;
  try {
    stat = fs.statSync(target);
  } catch (error) {
    // ENOENT만 "없는 입력"이다. 기본 디렉터리가 아직 없으면 빈 입력으로 본다(snapshot이 한 번도 없던 저장소).
    // EACCES 같은 다른 오류는 입력을 읽을 수 없다는 뜻이라 같은 InputError로 접되 원인을 남긴다.
    if (error.code === 'ENOENT') {
      if (explicit) throw new InputError(`input-not-found: ${target}`);
      return [];
    }
    throw new InputError(`input-unreadable: ${target}: ${error.code ?? error.message}`);
  }
  if (!stat.isDirectory()) return [path.resolve(target)];
  return fs.readdirSync(target).filter((name) => name.endsWith('.json'))
    .map((name) => path.join(path.resolve(target), name))
    .filter((file) => fs.lstatSync(file).isFile());
}

function readSessions(file, explicit) {
  let raw;
  try {
    raw = fs.readFileSync(file, 'utf8');
  } catch (error) {
    // 기본 세션 파일이 없는 것만 빈 세션이다. 명시한 파일이 없거나 다른 읽기 오류는 실패다.
    if (error.code === 'ENOENT' && !explicit) return [];
    throw new InputError(`sessions-unreadable: ${file}: ${error.code ?? error.message}`);
  }
  let parsed;
  try {
    parsed = JSON.parse(raw);
  } catch (_error) {
    // SyntaxError뿐이다. 깨진 세션 기록으로 비용을 0처럼 내면 잘못된 비교가 되므로 실패시킨다.
    throw new InputError(`sessions-invalid-json: ${file}`);
  }
  if (!isRecord(parsed) || !Array.isArray(parsed.sessions)) throw new InputError(`sessions-invalid: ${file}`);
  return parsed.sessions;
}

/**
 * CLI 본체. 입력 해석 → 파일 판정 → 집계 순서로 stdout에 JSON을 쓴다.
 *
 * @param {string[]} argv - 인자
 * @param {string} cwd - 상대 경로 기준
 * @returns {number} exit code(0 성공, 1 입력 오류, 2 사용법 오류)
 */
function main(argv, cwd) {
  try {
    const args = parseArgs(argv);
    let targets = args.inputs.map((p) => ({ target: path.resolve(cwd, p), explicit: true }));
    if (targets.length === 0) {
      const common = git(['rev-parse', '--git-common-dir'], cwd);
      if (common === null) throw new InputError('git-common-dir-unavailable');
      targets = [{ target: path.join(path.resolve(cwd, common), 'bouncer', 'metrics-snapshots'), explicit: false }];
    }
    const top = git(['rev-parse', '--show-toplevel'], cwd);
    const sessionsFile = args.sessions !== null
      ? { file: path.resolve(cwd, args.sessions), explicit: true }
      : { file: path.join(top ?? cwd, DEFAULT_SESSIONS), explicit: false };
    const files = new Map();
    for (const { target, explicit } of targets) {
      for (const file of expand(target, explicit)) files.set(fs.realpathSync(file), file);
    }
    const rel = (file) => path.relative(cwd, file).split(path.sep).join('/');
    const inputs = [];
    const skipped = [];
    for (const file of [...files.values()]) {
      const bytes = fs.readFileSync(file);
      let parsed;
      try {
        parsed = JSON.parse(bytes.toString('utf8'));
      } catch (_error) {
        // SyntaxError뿐이다. 깨진 파일 하나가 전체 집계를 막지 않도록 사유를 남기고 건너뛴다.
        skipped.push({ path: rel(file), reason: 'invalid-json' });
        continue;
      }
      const verdict = classify(parsed);
      if (verdict.ok) {
        const sha256 = createHash('sha256').update(bytes).digest('hex');
        inputs.push({ path: rel(file), sha256, snapshot: verdict.snapshot });
      } else skipped.push({ path: rel(file), reason: verdict.reason });
    }
    const byPath = (a, b) => (a.path < b.path ? -1 : a.path > b.path ? 1 : 0);
    inputs.sort(byPath);
    skipped.sort(byPath);
    const sessions = readSessions(sessionsFile.file, sessionsFile.explicit);
    const result = aggregate({ inputs, skipped, sessions, thresholds: args.thresholds, sweep: args.sweep });
    process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
    return 0;
  } catch (error) {
    if (error instanceof UsageError) {
      process.stderr.write(`measure-drive-records: ${error.message}\n`);
      return 2;
    }
    if (error instanceof InputError) {
      process.stderr.write(`${error.message}\n`);
      return 1;
    }
    throw error;
  }
}

if (require.main === module) process.exitCode = main(process.argv.slice(2), process.cwd());

module.exports = { aggregate, parseArgs, classify };
