'use strict';

const fs = require('node:fs');
const path = require('node:path');
import layout = require('./layout');
const { isCanonicalEpicDir } = layout;
import paths = require('./paths');
const { toPosix } = paths;
import current = require('./current');
const { resolveCurrent } = current;
import frontmatter = require('./frontmatter');
const { readDoc } = frontmatter;

const BOUNCER_DIR = '.bouncer';
const EPICS_REL = '.bouncer/context/epics';
// 정본 id만 센다. EPIC-/BP- 접두는 최댓값에 넣지 않아 구형 디렉터리가
// 다음 번호를 건너뛰게 하지 않는다.
const ID_DIR_RE = /^\d{3}-.+$/;
const MAINTENANCE_DIR_RE = /^\d{3}-maintenance$/;
const VERIFY_FILES = [
  'docker-compose.yml',
  'docker-compose.yaml',
  'compose.yml',
  'compose.yaml',
  'Makefile',
  'Taskfile.yml',
] as const;

type InspectFail = { ok: false; reason: 'not-initialized' | 'invalid-epic-dir' };

type EpicInfo = {
  dir: string;
  status: string | null;
  nextBlueprintId: string;
};

type CurrentInfo = {
  status: 'selected' | 'empty' | 'ambiguous' | 'invalid';
  blueprint: string | null;
  task: string | null;
  base: string | null;
};

type InspectOk = {
  ok: true;
  nextEpicId: string;
  epic: EpicInfo | null;
  maintenanceEpic: (EpicInfo & { id: string }) | null;
  verifySignals: string[];
  current: CurrentInfo;
};

type InspectResult = InspectOk | InspectFail;

/**
 * `\d{3}-<slug>` 디렉터리 이름만 모아 최댓값 + 1을 세 자리로 채운다.
 * 구형 `EPIC-009` / `BP-001` 이름은 정규식에서 빠지므로 번호가 그 쪽으로
 * 점프하지 않는다. 후보가 없으면 `001` — 빈 트리의 첫 id.
 *
 * @param {string[]} names - 한 부모 아래의 디렉터리 이름
 * @returns {string} zero-pad 세 자리 다음 id
 */
function nextNumericId(names: string[]): string {
  let max = 0;
  for (const name of names) {
    if (!ID_DIR_RE.test(name)) continue;
    const n = Number(name.slice(0, 3));
    if (Number.isFinite(n) && n > max) max = n;
  }
  return String(max + 1).padStart(3, '0');
}

/**
 * 한 부모의 직계 디렉터리 이름만 나열한다. 읽기 실패는 빈 목록 — inspect는
 * 추천값만 계산하므로 권한 오류를 종료로 승격하지 않는다.
 *
 * @param {string} absDir - 절대 경로
 * @returns {string[]} 디렉터리 이름
 */
function listDirNames(absDir: string): string[] {
  try {
    if (!fs.existsSync(absDir)) return [];
    const entries = fs.readdirSync(absDir, { withFileTypes: true });
    const names: string[] = [];
    for (const entry of entries) {
      if (entry.isDirectory()) names.push(entry.name);
    }
    return names;
  } catch (_e) {
    // EACCES 등만 접는다. 추천 id를 못 구하면 빈 목록으로 `001`이 나온다.
    return [];
  }
}

/**
 * epic/blueprint `index.md`의 `bouncer.status`만 읽는다. 파싱 실패는 null —
 * inspect가 문서를 고치지 않고, 없는 상태를 지어내지 않기 위함.
 *
 * @param {string} absIndex - index.md 절대 경로
 * @returns {string | null} 문자열 status, 없거나 읽을 수 없으면 null
 */
function readStatus(absIndex: string): string | null {
  try {
    const doc = readDoc(absIndex);
    const data = doc.data && typeof doc.data === 'object'
      ? doc.data as Record<string, unknown> : {};
    const bouncer = data.bouncer && typeof data.bouncer === 'object'
      ? data.bouncer as Record<string, unknown> : null;
    return bouncer && typeof bouncer.status === 'string' ? bouncer.status : null;
  } catch (_e) {
    // 부재·YAML 오류는 상태 없음으로만 접는다. inspect는 문서를 복구하지 않는다.
    return null;
  }
}

function epicInfo(repoRoot: string, dirRel: string): EpicInfo {
  const blueprintsAbs = path.join(repoRoot, dirRel, 'blueprints');
  return {
    dir: dirRel,
    status: readStatus(path.join(repoRoot, dirRel, 'index.md')),
    nextBlueprintId: nextNumericId(listDirNames(blueprintsAbs)),
  };
}

function presentCurrent(repoRoot: string): CurrentInfo {
  const resolved = resolveCurrent({ repoRoot });
  if (resolved.status === 'selected') {
    return {
      status: 'selected',
      blueprint: resolved.current.blueprint,
      task: resolved.current.task,
      base: resolved.current.base,
    };
  }
  // empty·ambiguous·invalid 모두 포인터 필드를 비운다. 워크플로 중단은
  // 스킬이 status를 보고 결정하며, inspect는 후보를 고르지 않는다.
  return {
    status: resolved.status,
    blueprint: null,
    task: null,
    base: null,
  };
}

/**
 * 루트 파일 존재와 `package.json`의 `scripts` 키 존재만 본다.
 * compose/Makefile 내용은 읽지 않는다. JSON 파싱은 키 존재 확인에만 쓴다.
 *
 * @param {string} repoRoot - 저장소 루트 절대 경로
 * @returns {string[]} Interface 나열 순의 신호 토큰
 */
function collectVerifySignals(repoRoot: string): string[] {
  const signals: string[] = [];
  for (const name of VERIFY_FILES) {
    if (fs.existsSync(path.join(repoRoot, name))) signals.push(name);
  }
  const pkgAbs = path.join(repoRoot, 'package.json');
  if (!fs.existsSync(pkgAbs)) return signals;
  try {
    const parsed: unknown = JSON.parse(fs.readFileSync(pkgAbs, 'utf8'));
    if (
      parsed
      && typeof parsed === 'object'
      && !Array.isArray(parsed)
      && Object.hasOwn(parsed as object, 'scripts')
    ) {
      signals.push('package.json#scripts');
    }
  } catch (_e) {
    // 깨진 JSON은 scripts 키를 확인할 수 없으므로 신호에 넣지 않는다.
  }
  return signals;
}

function normalizeEpicDir(value: unknown): string | null {
  if (typeof value !== 'string' || value === '') return null;
  return toPosix(value).replace(/\/+$/, '');
}

/**
 * 계획 스킬이 본문에서 반복하던 id·maintenance·verify 신호·포인터 상태를
 * 한 번 계산한다. 추천값만 반환하며 어떤 경로에도 파일을 쓰지 않는다.
 *
 * @param {{ repoRoot: string, epicDir?: unknown }} opts - repoRoot는 대상 저장소,
 *   epicDir은 선택적 `.bouncer/context/epics/<ddd>-<slug>`
 * @returns {InspectResult} 성공 JSON 또는 not-initialized / invalid-epic-dir
 */
function planInspect({ repoRoot, epicDir }: {
  repoRoot: string;
  epicDir?: unknown;
}): InspectResult {
  const bouncerAbs = path.join(repoRoot, BOUNCER_DIR);
  // 1. 초기화 여부. epic-dir 형식보다 앞선다 — 없는 트리의 경로 오류로
  //    위장하면 `/bouncer-init` 안내가 빗나간다.
  if (!fs.existsSync(bouncerAbs) || !fs.statSync(bouncerAbs).isDirectory()) {
    return { ok: false, reason: 'not-initialized' };
  }

  let epic: EpicInfo | null = null;
  if (epicDir !== undefined) {
    // 2. --epic-dir는 정본 상대 경로만. 짧은 이름·EPIC- 접두·부재는 같은
    //    거절 코드라서 호출자가 형식을 추측해 재시도하지 않게 한다.
    const rel = normalizeEpicDir(epicDir);
    if (rel === null || !isCanonicalEpicDir(rel)) {
      return { ok: false, reason: 'invalid-epic-dir' };
    }
    const abs = path.join(repoRoot, rel);
    try {
      // ENOENT·ENOTDIR·EACCES는 모두 같은 거절 코드다. 형식이 맞아도
      // 없는 디렉터리를 다음 id 계산에 쓰면 없는 epic을 추천하게 된다.
      if (!fs.statSync(abs).isDirectory()) {
        return { ok: false, reason: 'invalid-epic-dir' };
      }
    } catch (_e) {
      return { ok: false, reason: 'invalid-epic-dir' };
    }
    epic = epicInfo(repoRoot, rel);
  }

  const epicNames = listDirNames(path.join(repoRoot, EPICS_REL));
  const maintenanceName = epicNames.find((name) => MAINTENANCE_DIR_RE.test(name));
  const maintenanceEpic = maintenanceName
    ? {
      ...epicInfo(repoRoot, `${EPICS_REL}/${maintenanceName}`),
      id: maintenanceName.slice(0, 3),
    }
    : null;

  return {
    ok: true,
    nextEpicId: nextNumericId(epicNames),
    epic,
    maintenanceEpic,
    verifySignals: collectVerifySignals(repoRoot),
    current: presentCurrent(repoRoot),
  };
}

export = { planInspect };
