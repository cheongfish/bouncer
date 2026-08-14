'use strict';

const { parseFlags } = require('./cli-flags');
const { init } = require('./init');
const { nowIsoKst } = require('./time');
const { syncSessionGraphs } = require('./session-graph');
const { resolveGraphifyBin } = require('./graphify');
const { migrateIds } = require('./migrate-ids');
const { migrateTaskLayout } = require('./migrate-task-layout');
const { runtimePaths } = require('./runtime-state');

function cmdInit(rest, io) {
  const f = parseFlags(rest);
  const timestamp = typeof f.timestamp === 'string' ? f.timestamp : nowIsoKst();
  // CLI 기본은 설치 on — 라이브러리 init() 기본(install:false)과 의도적으로 다르다.
  // 테스트·프로그래밍 호출이 네트워크 pip을 타지 않게 라이브러리는 opt-in.
  const install = f['no-graphify'] !== true;
  const result = init({
    repoRoot: f.repo || process.cwd(),
    timestamp,
    graphify: { install },
    promote: f['promote-graphify'] === true,
    writeGitignore: f['write-gitignore'] === true,
  });
  io.out(`${JSON.stringify({ ok: true, ...result }, null, 2)}\n`);
  // created/skipped와 무관하게 result.ok만 본다. 부분 성공을 0으로 위장하지 않음.
  return result.ok ? 0 : 1;
}

function cmdGraphSync(rest, io) {
  const f = parseFlags(rest);
  const result = syncSessionGraphs({ repoRoot: f.repo || process.cwd() });
  // missing은 상태가 아니라 오류가 아니다(그래프 부재). failed만 종료 코드를 가른다.
  io.out(`${JSON.stringify({ ok: result.failed.length === 0, ...result }, null, 2)}\n`);
  return result.failed.length === 0 ? 0 : 1;
}

function cmdGraphifyBin(rest, io) {
  const f = parseFlags(rest);
  const repoRoot = f.repo || process.cwd();
  const { bin } = resolveGraphifyBin({ repoRoot });
  if (!bin) {
    // stdout은 pipe-clean 유지 — 실패 사유는 stderr만.
    io.err('graphify-bin: graphify executable not found (config.bin, venv, or PATH)\n');
    // 환경 문제이지 사용법 오류가 아니므로 2가 아니라 1.
    return 1;
  }
  io.out(`${bin}\n`);
  return 0;
}

function cmdProjectRoot(rest, io) {
  const f = parseFlags(rest);
  const repoRoot = f.repo || process.cwd();
  // Distill·워크플로가 소비하는 정본은 main worktree다. linked cwd나
  // plugin root로 대체하면 도그푸드 Distill을 오독하므로 unavailable은
  // 빈 stdout/cwd fallback 없이 stderr+1로 거절한다.
  const paths = runtimePaths({ repoRoot });
  if (paths.unavailable || !paths.projectRoot) {
    io.err(`project-root: ${paths.reason || 'Bouncer requires a Git repository'}\n`);
    return 1;
  }
  io.out(`${paths.projectRoot}\n`);
  return 0;
}

function cmdMigrate(rest, io) {
  const [kind, ...flagArgs] = rest;
  // kind를 플래그보다 먼저 본다. 알 수 없는 kind에 --dry-run만 있어도
  // ids/task-layout 중 하나로 떨어지면 안 된다.
  if (kind !== 'ids' && kind !== 'task-layout') {
    io.err(`unknown migrate kind: ${kind || '(missing)'}\n`);
    return 2;
  }
  const f = parseFlags(flagArgs);
  const result = kind === 'ids'
    ? migrateIds({ repoRoot: f.repo || process.cwd(), dryRun: f['dry-run'] === true })
    : migrateTaskLayout({ repoRoot: f.repo || process.cwd(), dryRun: f['dry-run'] === true });
  io.out(`${JSON.stringify(result, null, 2)}\n`);
  // kind는 위에서 이미 걸렀다. 라이브러리 거절(dirty/collision)은 실행 실패(1).
  return result.ok ? 0 : 1;
}

module.exports = {
  init: {
    run: cmdInit,
    usage: `  init       Bootstrap .bouncer/ for this project. Never overwrites.
`,
  },
  'graph-sync': {
    run: cmdGraphSync,
    usage: `  graph-sync Rebuild stale graphify source + context graphs (SessionStart / plan).
`,
  },
  'graphify-bin': {
    run: cmdGraphifyBin,
    usage: `  graphify-bin
             Print the resolved graphify executable path (one line).
`,
  },
  'project-root': {
    run: cmdProjectRoot,
    usage: `  project-root
             Print the consuming project's main worktree absolute path (one line).
`,
  },
  migrate: {
    run: cmdMigrate,
    usage: `  migrate    ids [--dry-run]
             Plan or apply rename of legacy EPIC-/BP- context dirs to numeric ids.
             task-layout [--dry-run]
             Move legacy task files into tasks/<NNN>/ units.
`,
  },
};
