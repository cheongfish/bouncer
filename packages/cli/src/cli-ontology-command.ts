'use strict';

import path = require('node:path');

type CliIo = { out: (s: string) => void; err: (s: string) => void };
type WarningsMode = 'summary' | 'detail';
type Parsed = {
  mode: 'entity' | 'file' | 'impact';
  value: string;
  repoRoot: string;
  limit: number;
  warningsMode: WarningsMode;
};
type WarningItem = { code: string; source: string; line: number; detail: string };
type WarningsSummary = {
  total: number;
  by_code: Record<string, number>;
  details?: WarningItem[];
};

/**
 * ontology 명령의 argv를 검증하고, 유효한 입력에서만 메모리 색인을 만든다.
 * 잘못된 argv는 core 적재 전에 exit 2로 반환하고, 코어 입력/I/O 오류는 각각
 * 2/1로 전달하며 예상하지 않은 예외는 호출자에게 다시 던진다.
 *
 * @param {string[]} rest - `ontology` 뒤의 모드와 옵션
 * @param {CliIo} io - stdout/stderr 싱크
 * @returns {number} 명령 종료 코드
 */
function run(rest: string[], io: CliIo): number {
  const parsed = parse(rest);
  if ('error' in parsed) {
    io.err(`ontology: ${parsed.error}\n`);
    return 2;
  }
  const core = require('./context-ontology') as {
    loadContextOntology: (options: { repoRoot: string }) => unknown;
    queryContextOntology: (
      index: unknown,
      query: { mode: string; value: string; limit: number },
    ) => object;
  };
  let index: unknown;
  try {
    index = core.loadContextOntology({ repoRoot: parsed.repoRoot });
  } catch (error) {
    return reportCoreError(error, io);
  }
  try {
    const result = core.queryContextOntology(index, {
      mode: parsed.mode,
      value: parsed.value,
      limit: parsed.limit,
    }) as Record<string, unknown>;
    // 코어 배열은 유지하고 CLI만 접는다. aliases 등 이후 필드는 키 순서를 그대로 통과시킨다.
    const output: Record<string, unknown> = {};
    for (const key of Object.keys(result)) {
      output[key] = key === 'warnings'
        ? summarizeWarnings(result[key], parsed.warningsMode)
        : result[key];
    }
    io.out(`${JSON.stringify(output)}\n`);
    return 0;
  } catch (error) {
    return reportCoreError(error, io);
  }
}

/**
 * 단일 selector와 공통 옵션을 검증하고 repo 경로를 절대 경로로 정규화한다.
 *
 * @param {string[]} args - ontology mode와 option 인자
 * @returns {Parsed | { error: string }} 성공한 질의 또는 사용자 입력 오류
 */
function parse(args: string[]): Parsed | { error: string } {
  const mode = args[0];
  if (mode !== 'entity' && mode !== 'file' && mode !== 'impact') {
    return { error: 'expected entity, file, or impact mode' };
  }
  const selector = mode === 'entity' ? '--entity' : '--file';
  let value: string | undefined;
  let repo: string | undefined;
  let limit = 20;
  let warningsMode: WarningsMode = 'summary';
  const seen = new Set<string>();
  for (let i = 1; i < args.length; i++) {
    const option = args[i];
    if (
      option !== selector && option !== '--repo' && option !== '--limit' && option !== '--warnings'
    ) {
      return { error: `unknown or inapplicable option: ${option}` };
    }
    if (seen.has(option)) return { error: `${option} may be specified only once` };
    seen.add(option);
    const next = args[++i];
    if (next === undefined || next === '' || (option !== selector && next.startsWith('--'))) {
      return { error: `${option} requires a value` };
    }
    if (option === selector) value = next;
    else if (option === '--repo') repo = next;
    else if (option === '--warnings') {
      if (next !== 'summary' && next !== 'detail') {
        return { error: '--warnings must be summary or detail' };
      }
      warningsMode = next;
    } else {
      if (
        !/^\d+$/.test(next) ||
        !Number.isSafeInteger(Number(next)) ||
        Number(next) < 1 ||
        Number(next) > 100
      ) return { error: '--limit must be an integer from 1 to 100' };
      limit = Number(next);
    }
  }
  if (!value) return { error: `${selector} is required` };
  const hasNonAscii = [...value].some((char) => char.charCodeAt(0) > 0x7f);
  if (mode === 'entity' && (/[\s]/.test(value) || hasNonAscii)) {
    return { error: '--entity must be a non-empty ASCII token without whitespace' };
  }
  if (
    mode !== 'entity' &&
    (!value || value.includes('\0') || value.includes('\\') || value.startsWith('/') ||
      value.split('/').includes('..') || /[*?{}[\]]/.test(value))
  ) {
    return { error: '--file must be a safe repository-relative path' };
  }
  // 상대 경로는 process cwd 기준이다. 코어가 Git root를 검증하므로 하위 경로를 승격하지 않는다.
  return { mode, value, repoRoot: path.resolve(repo ?? process.cwd()), limit, warningsMode };
}

/**
 * 코어가 중복 제거한 경고 배열을 코드별 개수 요약으로 접는다.
 * 기본 응답에서 수백 건의 본문이 결과를 가리지 않게 하기 위함이며, detail만 원본 순서를 보존한다.
 *
 * @param {unknown} warnings - 코어 응답의 warnings 배열
 * @param {WarningsMode} mode - summary면 개수만, detail이면 details도 포함
 * @returns {WarningsSummary} total·사전순 by_code, detail일 때만 details
 */
function summarizeWarnings(warnings: unknown, mode: WarningsMode): WarningsSummary {
  const items = Array.isArray(warnings) ? warnings.filter(isWarningItem) : [];
  const counts = new Map<string, number>();
  for (const item of items) {
    counts.set(item.code, (counts.get(item.code) ?? 0) + 1);
  }
  const byCode: Record<string, number> = {};
  for (const code of [...counts.keys()].sort()) {
    byCode[code] = counts.get(code) as number;
  }
  const summary: WarningsSummary = { total: items.length, by_code: byCode };
  if (mode === 'detail') summary.details = items;
  return summary;
}

/**
 * 코어 경고 항목만 세어 요약 개수가 본문과 어긋나지 않게 한다.
 *
 * @param {unknown} value - warnings 배열의 원소
 * @returns {value is WarningItem} code가 있는 경고 항목이면 true
 */
function isWarningItem(value: unknown): value is WarningItem {
  if (!value || typeof value !== 'object') return false;
  const item = value as Partial<WarningItem>;
  return typeof item.code === 'string';
}

/**
 * 코어가 식별한 입력/I/O 오류만 CLI 종료 코드로 바꾸고 나머지는 보존한다.
 *
 * @param {unknown} error - 코어에서 발생한 예외
 * @param {CliIo} io - stderr 출력 싱크
 * @returns {number} 처리한 입력 오류 2 또는 I/O 오류 1
 */
function reportCoreError(error: unknown, io: CliIo): number {
  const code = error && typeof error === 'object' ? (error as { code?: unknown }).code : undefined;
  if (code !== 'ontology-input-invalid' && code !== 'ontology-io-failed') throw error;
  // 코어는 두 오류만 코드로 보장한다. 그 외 예외를 삼키면 버그가 입력 오류로 위장된다.
  io.err(`ontology: ${(error as Error).message}\n`);
  return code === 'ontology-input-invalid' ? 2 : 1;
}

export = { run };
