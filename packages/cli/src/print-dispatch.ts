'use strict';

import guards = require('./guards');
const { isRecord, isEnoentError } = guards;
const fs = require('node:fs');
const path = require('node:path');
const { spawnSync } = require('node:child_process');
import config = require('./config');
const { readConfig } = config;
import frontmatter = require('./frontmatter');
const { parseFrontmatter } = frontmatter;
import subagents = require('./subagents');
const { resolveSubagentRole } = subagents;
import codexAgents = require('./codex-agents');
const { pluginAgentsDir } = codexAgents;

const PRINT_ROLES = ['implementer', 'reviewer', 'debugger', 'context-reviewer', 'coordinator',
  'planner', 'plan-coordinator'] as const;
type PrintRole = (typeof PRINT_ROLES)[number];

type PrintDispatchDeps = {
  agentBin?: string;
  agentsDir?: string;
};

type PrintDispatchOk = {
  ok: true;
  role: PrintRole;
  model: string | null;
  // 설정값 그대로 보고만 한다. Cursor CLI에는 effort 인자가 없어 --model에 붙이지 않으며,
  // controller가 "effort 미적용"을 알릴 근거로 쓴다.
  effort: 'low' | 'medium' | 'high' | null;
  exit_code: number;
  report: string;
  prompt: string;
  stdout: string;
  stderr: string;
};

type PrintDispatchFail = {
  ok: false;
  reason: string;
  cause: string;
  next: string;
  exit_code?: number;
  stdout?: string;
  stderr?: string;
  report?: string;
};

type PrintDispatchResult = PrintDispatchOk | PrintDispatchFail;

/**
 * Cursor print 식별 줄. 문구는 `rules/cursor-print-dispatch.md` 3항과 바이트가
 * 같아야 한다. 역할이 named agent를 다시 띄우지 못하게 고정한 문장이다.
 *
 * @param {string} role - implementer|reviewer|debugger|context-reviewer|coordinator|planner|plan-coordinator
 * @returns {string} prompt 첫 줄
 */
function identityLine(role: string): string {
  if (role === 'coordinator' || role === 'plan-coordinator') {
    // 식별 문구는 cursor-print-dispatch 3항과 바이트가 같아야 하므로 이어 붙인다.
    // plan-coordinator도 run coordinator처럼 자기 worker(planner·reviewer 등)를 띄우므로 같은 문구를 쓴다.
    // planner는 일반 worker처럼 하위 dispatch가 없어 기본 문구로 떨어진다.
    return (
      `You are the dispatched bouncer-${role} itself. `
      + 'Dispatch only your workers, each under rules/cursor-print-dispatch.md.'
    );
  }
  return (
    `You are the dispatched bouncer-${role} itself. `
    + 'Do this role\'s work directly and never dispatch any Bouncer agent.'
  );
}

/**
 * 플러그인 루트 절대 경로를 prompt에 실을 한 줄로 만든다. 문구는
 * `rules/cursor-print-dispatch.md` 3항과 바이트가 같아야 한다 — 세션이
 * `references/...`를 워크스페이스에서 찾지 않고 이 루트에 붙이게 한다.
 *
 * @param {string} pluginRoot - 플러그인 루트 절대 경로
 * @returns {string} `Plugin root: …` 한 줄
 */
function pluginRootLine(pluginRoot: string): string {
  return (
    `Plugin root: ${pluginRoot}. `
    + 'Resolve plugin-relative paths (rules/..., references/..., agents/...) against it.'
  );
}

/**
 * 역할 본문·controller 입력을 prompt 파일 순서로 붙인다. 식별 줄을 맨 앞에
 * 두는 이유는 payload가 `---`로 시작하면 CLI가 옵션으로 읽기 때문이다.
 * 루트 줄은 식별 줄 바로 뒤 — 탐색 없이 `references/`·`rules/`를 열게 한다.
 *
 * @param {{ role: string, roleMarkdown: string, input: string, pluginRoot: string }} parts
 * @param {string} parts.role - 짧은 역할 이름
 * @param {string} parts.roleMarkdown - frontmatter가 있는 역할 문서 전체
 * @param {string} parts.input - `--input` 파일 내용 그대로
 * @param {string} parts.pluginRoot - 플러그인 루트 절대 경로(`agentsDir`의 부모)
 * @returns {string} 디스크에 쓸 prompt 본문
 */
function assemblePrintPrompt({
  role,
  roleMarkdown,
  input,
  pluginRoot,
}: {
  role: string;
  roleMarkdown: string;
  input: string;
  pluginRoot: string;
}): string {
  const { body } = parseFrontmatter(roleMarkdown);
  const roleBody = body.replace(/^(?:\r?\n)+/, '').replace(/(?:\r?\n)+$/, '');
  return `${identityLine(role)}\n\n${pluginRootLine(pluginRoot)}\n\n${roleBody}\n\n${input}`;
}

function fail(
  reason: string,
  cause: string,
  next: string,
  extra?: Partial<PrintDispatchFail>,
): PrintDispatchFail {
  return { ok: false, reason, cause, next, ...extra };
}

/**
 * `.bouncer/config.json`이 cursor·print opt-in인지 본다. env provider 추론은
 * 쓰지 않는다 — print는 명시 pin일 때만 켜지고, 그 외는 items 2-4다.
 *
 * @param {string} repoRoot - 설정을 읽을 저장소 루트
 * @returns {boolean} provider가 cursor이고 dispatch가 print일 때만 true
 */
function isCursorPrintEnabled(repoRoot: string): boolean {
  const cfg = readConfig(repoRoot);
  if (!isRecord(cfg) || !isRecord(cfg.subagents)) return false;
  return cfg.subagents.provider === 'cursor' && cfg.subagents.dispatch === 'print';
}

function pathKind(absPath: string): 'file' | 'dir' | 'missing' {
  try {
    const st = fs.statSync(absPath);
    if (st.isFile()) return 'file';
    if (st.isDirectory()) return 'dir';
    return 'missing';
  } catch (error) {
    // ENOENT만 입력 부재. EACCES를 missing으로 접으면 권한 오류가 잘못된
    // `--input`/`--cwd` 안내가 된다.
    if (isEnoentError(error)) return 'missing';
    throw error;
  }
}

/**
 * stdout jsonl에서 마지막 `type: "result"` 객체를 고른다. 중간 assistant 줄은
 * report가 아니다 — 최종 result만 규칙 6항의 보고다.
 *
 * @param {string} raw - stdout 파일 내용
 * @returns {Record<string, unknown> | null} 마지막 result 또는 없음
 */
function lastResultEvent(raw: string): Record<string, unknown> | null {
  let last: Record<string, unknown> | null = null;
  for (const line of raw.split(/\r?\n/)) {
    if (line.trim() === '') continue;
    let parsed: unknown;
    try {
      parsed = JSON.parse(line);
    } catch (_error) {
      // stream-json이 아닌 줄은 건너뛴다. 한 줄 파손 때문에 전체 디스패치를
      // result-missing으로 바꾸면 실제 result가 뒤에 있어도 잃는다.
      continue;
    }
    if (isRecord(parsed) && parsed.type === 'result') last = parsed;
  }
  return last;
}

/**
 * Cursor print 한 건을 조립·실행하고 마지막 result를 돌려준다. Task
 * subagent로는 절대 내려가지 않는다. cursor·print가 아니면 prompt 파일도
 * 만들지 않는다.
 *
 * @param {{
 *   repoRoot: string, role: string, cwd: string, inputFile: string,
 *   outDir: string, deps?: PrintDispatchDeps
 * }} opts
 * @param {string} opts.repoRoot - `.bouncer/config.json`을 읽는 루트
 * @param {string} opts.role - 짧은 역할 이름
 * @param {string} opts.cwd - agent `--workspace`이자 spawn cwd
 * @param {string} opts.inputFile - controller 입력 파일
 * @param {string} opts.outDir - prompt·jsonl·log를 덮어쓸 디렉터리
 * @param {PrintDispatchDeps} [opts.deps] - 테스트 seam (`agentBin`, `agentsDir`)
 * @returns {PrintDispatchResult} 성공 객체 또는 `{ ok: false, reason, cause, next }`
 */
function runPrintDispatch({
  repoRoot,
  role,
  cwd,
  inputFile,
  outDir,
  deps,
}: {
  repoRoot: string;
  role: string;
  cwd: string;
  inputFile: string;
  outDir: string;
  deps?: PrintDispatchDeps;
}): PrintDispatchResult {
  // 1. 실행 전 경로. prompt를 쓰기 전에 거절해야 실패 run이 잔여 파일을 남기지 않는다.
  if (pathKind(inputFile) !== 'file' || pathKind(cwd) !== 'dir') {
    return fail(
      'dispatch-input-invalid',
      '`--input` must be an existing file and `--cwd` an existing directory',
      'create the input file and cwd, then retry `bouncer dispatch print`',
    );
  }

  // 2. opt-in 아니면 여기서 끝. items 2-4(Task)로 조용히 내려가지 않는다.
  if (!isCursorPrintEnabled(repoRoot)) {
    return fail(
      'print-dispatch-disabled',
      '`.bouncer/config.json` is not `subagents.provider: "cursor"` and `subagents.dispatch: "print"`',
      'dispatch using `rules/subagent-model.md` items 2-4, or set those keys and retry',
    );
  }

  let agentsDir: string;
  if (deps && deps.agentsDir) {
    agentsDir = deps.agentsDir;
  } else {
    try {
      agentsDir = pluginAgentsDir();
    } catch (error) {
      // resolver의 Error(무효 BOUNCER_HOME, 유효 루트 없음)만 안내 가능한 실패로 바꾼다.
      // 그 외 예외는 버그이므로 다시 던진다.
      if (!(error instanceof Error)) throw error;
      return fail('plugin-root-unresolved', error.message, 'set BOUNCER_HOME to the plugin install and retry');
    }
  }
  // agentsDir 부모 = 플러그인 루트. 테스트 seam의 임시 root와 프로덕션 설치
  // 루트가 같은 규칙으로 잡혀야 prompt의 Plugin root 줄이 탐색 없이 동작한다.
  const pluginRoot = path.resolve(path.dirname(agentsDir));
  const rolePath = path.join(agentsDir, `bouncer-${role}.md`);
  let roleMarkdown: string;
  try {
    roleMarkdown = fs.readFileSync(rolePath, 'utf8');
  } catch (error) {
    if (isEnoentError(error)) {
      return fail(
        'role-document-invalid',
        `role document missing: ${rolePath}`,
        'install the plugin agents directory or pass a valid --role',
      );
    }
    throw error;
  }

  let prompt: string;
  try {
    prompt = assemblePrintPrompt({
      role,
      roleMarkdown,
      input: fs.readFileSync(inputFile, 'utf8'),
      pluginRoot,
    });
  } catch (error) {
    // parseFrontmatter 실패(블록 없음)와 YAML 파손만 흡수한다. 그 외는 설정·IO 버그다.
    const message = error instanceof Error ? error.message : String(error);
    if (/frontmatter|YAMLException|duplicated mapping/i.test(message)
      || (error instanceof Error && error.name === 'YAMLException')) {
      return fail(
        'role-document-invalid',
        `role document frontmatter is invalid: ${rolePath}`,
        'fix the role markdown frontmatter, then retry',
      );
    }
    throw error;
  }

  const agentBin = deps && deps.agentBin ? deps.agentBin : 'agent';

  // 3. login 확인. print argv보다 먼저 — 미로그인 세션에 prompt를 남기지 않기 위함.
  const status = spawnSync(agentBin, ['status'], {
    encoding: 'utf8',
    shell: false,
  });
  const statusText = `${status.stdout || ''}${status.stderr || ''}`;
  if (status.error
    || status.status !== 0
    || /not logged in/i.test(statusText)) {
    return fail(
      'agent-unavailable',
      status.error
        ? `cannot execute ${agentBin}: ${status.error.message}`
        : 'agent status failed or reported not logged in',
      'run `agent login`, then retry `bouncer dispatch print`',
    );
  }

  // 등급 매핑이 비었거나 roles 설정이 잘못되면 다른 모델로 대체하지 않고 거절한다.
  // prompt 파일을 쓰기 전에 걸러야 실패한 dispatch가 흔적을 남기지 않는다.
  const resolved = resolveSubagentRole({
    repoRoot,
    agentName: `bouncer-${role}`,
  });
  if (!resolved.ok) {
    return fail(
      resolved.code,
      `${resolved.message} (provider=${resolved.provider ?? '-'} role=${resolved.role} `
      + `tier=${resolved.tier ?? '-'})`,
      `set ${resolved.next} in .bouncer/config.json, then retry \`bouncer dispatch print\``,
    );
  }
  const { model, effort } = resolved;

  fs.mkdirSync(outDir, { recursive: true });
  const promptPath = path.join(outDir, `bouncer-${role}.prompt.md`);
  const stdoutPath = path.join(outDir, `bouncer-${role}.jsonl`);
  const stderrPath = path.join(outDir, `bouncer-${role}.log`);
  fs.writeFileSync(promptPath, prompt);

  const argv = [
    '--print',
    '--force',
    '--trust',
    '--output-format',
    'stream-json',
    '--workspace',
    cwd,
  ];
  if (model !== null) {
    argv.push('--model', model);
  }
  // `--`는 prompt가 `-`로 시작해도 옵션으로 읽히지 않게 한다. 내용은 argv
  // 칸으로만 넘기고 `$(cat …)` 셸은 만들지 않는다.
  argv.push('--', prompt);

  // 4. stdout/stderr는 pipe reader가 아니라 fd. tee가 파이프를 붙잡고 남는 회귀를 피한다.
  const stdinFd = fs.openSync('/dev/null', 'r');
  const stdoutFd = fs.openSync(stdoutPath, 'w');
  const stderrFd = fs.openSync(stderrPath, 'w');
  let spawned: ReturnType<typeof spawnSync>;
  try {
    spawned = spawnSync(agentBin, argv, {
      cwd,
      stdio: [stdinFd, stdoutFd, stderrFd],
      shell: false,
    });
  } finally {
    fs.closeSync(stdinFd);
    fs.closeSync(stdoutFd);
    fs.closeSync(stderrFd);
  }

  const exitCode = spawned.status == null ? 1 : spawned.status;
  if (spawned.error || exitCode !== 0) {
    return fail(
      'agent-exit-nonzero',
      spawned.error
        ? spawned.error.message
        : `agent --print exited ${exitCode}`,
      `inspect ${stdoutPath} and ${stderrPath}`,
      { exit_code: exitCode, stdout: stdoutPath, stderr: stderrPath },
    );
  }

  const stdoutRaw = fs.readFileSync(stdoutPath, 'utf8');
  const resultEvent = lastResultEvent(stdoutRaw);
  if (!resultEvent) {
    return fail(
      'result-missing',
      `no stream-json result event in ${stdoutPath}`,
      `inspect ${stdoutPath} and retry the dispatch`,
      { stdout: stdoutPath, stderr: stderrPath },
    );
  }
  const report = typeof resultEvent.result === 'string' ? resultEvent.result : '';
  if (resultEvent.is_error === true) {
    return fail(
      'result-error',
      'the final result event has is_error true',
      'fix the dispatch input from the report, then retry',
      { report, stdout: stdoutPath, stderr: stderrPath },
    );
  }
  // transport가 성공해도 보고서 문자열이 없으면 coordinator가 판정할 보고가 없다.
  // result-error 뒤에 두어 is_error + 빈 result는 기존대로 result-error로 남기고,
  // trim은 판정에만 쓰며 성공 시 report 원문은 그대로 돌려준다.
  if (report.trim().length === 0) {
    return fail(
      'report-missing',
      'the final result event has no report string',
      `inspect ${stdoutPath} and retry the dispatch`,
      { stdout: stdoutPath, stderr: stderrPath },
    );
  }

  return {
    ok: true,
    role: role as PrintRole,
    model,
    effort,
    exit_code: 0,
    report,
    prompt: promptPath,
    stdout: stdoutPath,
    stderr: stderrPath,
  };
}

export = {
  PRINT_ROLES,
  identityLine,
  assemblePrintPrompt,
  runPrintDispatch,
};
