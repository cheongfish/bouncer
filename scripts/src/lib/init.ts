'use strict';
const fs = require('node:fs');
const path = require('node:path');
const { detectLegacyFormat } = require('./schema') as {
  detectLegacyFormat: (opts: { repoRoot?: string }) => { legacy: boolean; reason?: string };
};
const { PROJECT_DISTILL, LEGACY_PROJECT_DISTILL } = require('./layout') as {
  PROJECT_DISTILL: string;
  LEGACY_PROJECT_DISTILL: string;
};
const { ensureCodexAgents } = require('./codex-agents') as {
  ensureCodexAgents: (opts: {
    repoRoot: string;
    created: string[];
    agentsDir?: string;
  }) => void;
};
const { PROJECT_DISTILL_BODY } = require('./templates') as {
  PROJECT_DISTILL_BODY: string;
};
const { nowIsoKst } = require('./time') as {
  nowIsoKst: () => string;
};
const { setupGraphify } = require('./graphify') as {
  setupGraphify: (opts: { repoRoot?: string }) => GraphifySetupResult;
};
const {
  readConfig,
  DEFAULT_DISTILL_CONFIG,
} = require('./config') as {
  readConfig: (repoRoot: string) => unknown;
  DEFAULT_DISTILL_CONFIG: { routing_enabled: boolean; max_bytes: number };
};

type GraphifySetupResult = {
  status: string;
  bin: string | null;
  reason?: string;
};

type GraphifySetupFn = (opts: { repoRoot?: string }) => GraphifySetupResult;

// default source_dirs용 고정 probe 순서. init 시점에 존재하는 directory만
// 남기며, 이 목록 순서가 config에 쓰이는 순서. SOURCE_DIR_CANDIDATES를
// import하는 test와 동기 유지.
const SOURCE_DIR_CANDIDATES = ['src', 'lib', 'app', 'packages', 'scripts', 'test', 'tests'];

function detectSourceDirs(repoRoot: string) {
  return SOURCE_DIR_CANDIDATES.filter((name) => {
    try {
      return fs.statSync(path.join(repoRoot, name)).isDirectory();
    } catch (_e) {
      return false;
    }
  });
}

function defaultConfig(repoRoot: string) {
  return {
    // scaffold 시점에만 감지 — ready bootstrap에서는 다시 쓰지 않음.
    source_dirs: detectSourceDirs(repoRoot),
    // Bouncer context docs graph (epics/blueprints). source_dirs와 함께
    // graphify-out/source, graphify-out/context 이중 graphify 출력에 사용.
    context_dirs: ['.bouncer/context'],
    // 라이브러리 기본(install:false)은 enabled만 true — bin은 설치 성공 시에만 기록.
    // CLI는 install:true가 기본이라 실패 시 enabled:false로 내려 soft-fail한다.
    graphify: { enabled: true },
    // 샤드 소비는 명시적으로 켜기 전까지 전량 로드한다. max_bytes는 본문을
    // 자르는 제한이 아니라 샤드 분배를 검토할 때만 쓰는 경고 기준이다.
    distill: { ...DEFAULT_DISTILL_CONFIG },
    verify: 'npm test',
    base_branch: 'develop',
    autonomy: 'auto',
    pr: { draft: true, base: 'develop', labels: ['bouncer'] },
    // host별 model ID용 placeholder slot. 모든 값은 "inherit"로 시작해 init이
    // 편집 가능한 형태를 보여 주되 model을 고정하지 않음; resolveSubagentModel은
    // "inherit"를 parent-session fallback으로 처리.
    // provider block은 분리 — host마다 model namespace가 다름
    // (Claude / Cursor / Codex / Antigravity slug는 호환되지 않음).
    // plan의 context reviewer도 같은 inherit 슬롯이 있어야 init이 편집 자리를
    // 보여 준다. 키가 없으면 resolve는 null로 수렴해 동작은 같지만, 사용자가
    // 모델을 고를 자리가 사라진다. 이미 init을 돌린 소비자 config는 건드리지
    // 않는다(부모 세션 상속 = 같은 동작).
    subagents: {
      claude: {
        'bouncer-reviewer': 'inherit',
        'bouncer-implementer': 'inherit',
        'bouncer-debugger': 'inherit',
        'bouncer-context-reviewer': 'inherit',
      },
      cursor: {
        'bouncer-reviewer': 'inherit',
        'bouncer-implementer': 'inherit',
        'bouncer-debugger': 'inherit',
        'bouncer-context-reviewer': 'inherit',
      },
      codex: {
        'bouncer-reviewer': 'inherit',
        'bouncer-implementer': 'inherit',
        'bouncer-debugger': 'inherit',
        'bouncer-context-reviewer': 'inherit',
      },
      antigravity: {
        'bouncer-reviewer': 'inherit',
        'bouncer-implementer': 'inherit',
        'bouncer-debugger': 'inherit',
        'bouncer-context-reviewer': 'inherit',
      },
    },
  };
}

// Bundle root. OKF §11은 index file 중 여기에만 frontmatter를 허용;
// §6은 body 형태를 `* [Title](url) - description` 그룹으로 고정.
// bouncer_schema는 번들 루트에만 둔다(문서마다 두지 않음). EMPTY_CONTEXT_INDEX와
// 같은 frontmatter여야 ensureEpicIndexEntry가 파일을 새로 만들 때도 일치한다.
const CONTEXT_INDEX = `---
okf_version: "0.1"
bouncer_schema: "0.1"
---
# Epics

<!-- bouncer scaffold epic이 여기에 한 줄씩 추가합니다 (OKF §6).
     validate는 S13으로 디렉터리 ↔ 목록 일치를 검사합니다.
     * [00x 제목](epics/00x-slug/index.md) - 한 줄 설명 -->
`;

function writeFile(repoRoot: string, rel: string, content: string, created: string[]) {
  const abs = path.join(repoRoot, rel);
  fs.mkdirSync(path.dirname(abs), { recursive: true });
  fs.writeFileSync(abs, content);
  created.push(rel);
}

function projectDistillDoc(timestamp?: string) {
  // 등록된 bouncer.* schema kind가 아님 — project Distill은 gate 없는 prose,
  // OKF 형태 meta만 (title/description/resource/tags/timestamp). `.bouncer/`
  // 런타임 파일이지 context OKF 번들 문서가 아니다.
  const ts = timestamp || nowIsoKst();
  return `---
title: Project Distill
description: Current project invariants, gotchas, and decisions
resource: ${PROJECT_DISTILL}
tags:
  - bouncer
  - distill
timestamp: '${ts}'
---
${PROJECT_DISTILL_BODY}`;
}

function rewriteDistillResource(body: string) {
  return body.replace(
    /^resource:\s*\.bouncer\/context\/Distill\.md\s*$/m,
    `resource: ${PROJECT_DISTILL}`,
  );
}

// 없을 때만 Distill 생성 — 정리된 project note는 덮어쓰지 않음.
// 레거시 `.bouncer/context/Distill.md`만 있으면 새 경로로 옮긴다.
function ensureProjectDistill(repoRoot: string, created: string[], timestamp?: string) {
  const abs = path.join(repoRoot, PROJECT_DISTILL);
  if (fs.existsSync(abs)) return;
  const legacyAbs = path.join(repoRoot, LEGACY_PROJECT_DISTILL);
  if (fs.existsSync(legacyAbs)) {
    const body = rewriteDistillResource(fs.readFileSync(legacyAbs, 'utf8'));
    fs.mkdirSync(path.dirname(abs), { recursive: true });
    fs.writeFileSync(abs, body);
    fs.unlinkSync(legacyAbs);
    created.push(PROJECT_DISTILL);
    return;
  }
  writeFile(repoRoot, PROJECT_DISTILL, projectDistillDoc(timestamp), created);
}

// advisory(+ 동의 시 마커 블록 쓰기) 목록. `.bouncer/.venv/`는 설치 산출물이라
// 범위 위반·실수 커밋을 막기 위해 제안과 finalize RUNTIME_ARTIFACTS에 같이 둔다.
const SUGGESTED_IGNORES = [
  'node_modules/',
  'graphify-out/',
  '.worktrees/',
  '.bouncer/.venv/',
];

const GITIGNORE_MARKER_START = '# bouncer';
const GITIGNORE_MARKER_END = '# /bouncer';

function gitignoreSuggestions({ repoRoot }: { repoRoot: string }) {
  let ignored: string[] = [];
  try {
    ignored = fs.readFileSync(path.join(repoRoot, '.gitignore'), 'utf8')
      .split('\n')
      .map((line: string) => line.trim().replace(/\/+$/, ''))
      .filter((line: string) => line && !line.startsWith('#'));
  } catch (_e) {
    ignored = [];
  }
  return SUGGESTED_IGNORES.filter(
    (entry) => !ignored.includes(entry.replace(/\/+$/, '')),
  );
}

/**
 * `# bouncer` … `# /bouncer` 마커 블록만 갱신한다.
 * 마커 밖 사용자 줄은 읽기만 하고 바꾸지 않는다 — 동의 신호(writeGitignore)가
 * 있을 때만 호출된다.
 * 마커 탐지는 줄 전체가 정확히 일치할 때만(substring `indexOf` 금지) —
 * `# bouncer note` 같은 사용자 주석을 마커로 오인하지 않기 위함.
 */
function writeGitignoreMarkerBlock(repoRoot: string) {
  const abs = path.join(repoRoot, '.gitignore');
  const block = `${GITIGNORE_MARKER_START}\n${SUGGESTED_IGNORES.join('\n')}\n${GITIGNORE_MARKER_END}`;
  let content: string;
  try {
    content = fs.readFileSync(abs, 'utf8');
  } catch (_e) {
    fs.writeFileSync(abs, `${block}\n`);
    return true;
  }

  const startMatch = /^# bouncer$/m.exec(content);
  const endMatch = /^# \/bouncer$/m.exec(content);
  if (startMatch && endMatch && endMatch.index > startMatch.index) {
    const before = content.slice(0, startMatch.index);
    const after = content.slice(endMatch.index + GITIGNORE_MARKER_END.length);
    fs.writeFileSync(abs, `${before}${block}${after}`);
    return true;
  }

  const sep = content.length === 0 || content.endsWith('\n') ? '' : '\n';
  fs.writeFileSync(abs, `${content}${sep}${block}\n`);
  return true;
}

function graphifyEnabledIsTrue(config: unknown) {
  const graphify = config && (config as { graphify?: { enabled?: unknown } }).graphify;
  return !!(
    config
    && graphify
    && typeof graphify === 'object'
    && (graphify as { enabled?: unknown }).enabled === true
  );
}

function seedDistillConfig(repoRoot: string, existing: Record<string, unknown> | null) {
  if (!existing || typeof existing !== 'object' || Array.isArray(existing)) return false;
  const current = (
    existing.distill
    && typeof existing.distill === 'object'
    && !Array.isArray(existing.distill)
  ) ? existing.distill as Record<string, unknown> : {};
  const next = {
    ...DEFAULT_DISTILL_CONFIG,
    ...current,
  };
  // 잘못된 값은 활성화가 아니라 비활성으로 수렴시킨다. 이미 true인
  // 저장소의 선택 라우팅을 init이 몰래 끄면 재실행만으로 운영 상태가
  // 바뀌므로, 유효한 true/false만 보존하고 나머지만 false로 seed한다.
  if (next.routing_enabled !== true && next.routing_enabled !== false) {
    next.routing_enabled = false;
  }
  if (!Number.isSafeInteger(next.max_bytes) || next.max_bytes <= 0) {
    next.max_bytes = DEFAULT_DISTILL_CONFIG.max_bytes;
  }
  if (JSON.stringify(existing.distill) === JSON.stringify(next)) return false;
  existing.distill = next;
  fs.writeFileSync(
    path.join(repoRoot, '.bouncer', 'config.json'),
    `${JSON.stringify(existing, null, 2)}\n`,
  );
  return true;
}

function inspectBootstrap({ repoRoot }: { repoRoot?: string }) {
  if (detectLegacyFormat({ repoRoot }).legacy) return 'legacy';

  const bouncerAbs = path.join(repoRoot as string, '.bouncer');
  if (!fs.existsSync(bouncerAbs)) return 'missing';

  // 파싱은 config.ts에 맡기고 유효성만 여기서 본다. 배열/원시값을 ready로
  // 올리면 이후 승격이 비객체에 키를 심는다. 깨진 JSON·비객체는 missing이
  // 아니라 partial — .bouncer가 이미 있으므로 재생성하면 기존 내용을 덮는다.
  const config = readConfig(repoRoot as string);
  const rec = config
    && typeof config === 'object'
    && !Array.isArray(config)
    ? config as Record<string, unknown>
    : null;
  const valid = rec
    && Array.isArray(rec.source_dirs)
    && typeof rec.verify === 'string'
    && typeof rec.base_branch === 'string';
  if (valid) return 'ready';
  return 'partial';
}

function init({
  repoRoot,
  timestamp,
  graphify,
  promote,
  writeGitignore,
} = {} as {
  repoRoot?: string;
  timestamp?: string;
  graphify?: { install?: boolean; setup?: GraphifySetupFn };
  promote?: boolean;
  writeGitignore?: boolean;
}) {
  const bootstrap = inspectBootstrap({ repoRoot });
  // partial/legacy는 설치·승격·gitignore 쓰기를 시도하지 않는다 — 기존 반환 유지.
  if (bootstrap === 'legacy') {
    const legacy = detectLegacyFormat({ repoRoot });
    return { ok: false, created: [], skipped: true, reason: legacy.reason };
  }
  if (bootstrap === 'partial') {
    return { ok: false, created: [], skipped: true, reason: 'partial-bouncer-state' };
  }

  // 라이브러리 기본 install:false — 테스트가 실제 pip을 타지 않게 한다.
  // CLI cmdInit만 install:true를 기본으로 넘긴다.
  const wantInstall = !!(graphify && graphify.install === true);
  const setup = (graphify && typeof graphify.setup === 'function')
    ? graphify.setup
    : setupGraphify;
  const wantPromote = promote === true;
  const wantWriteGitignore = writeGitignore === true;

  // 동의 시 마커 블록을 먼저 쓰고, 제안 목록은 최종 파일 기준으로 계산한다.
  let gitignoreWritten = false;
  if (wantWriteGitignore) {
    writeGitignoreMarkerBlock(repoRoot as string);
    gitignoreWritten = true;
  }
  const suggestions = gitignoreSuggestions({ repoRoot: repoRoot as string });

  if (bootstrap === 'ready') {
    // project Distill 이전에 init된 repo용 soft-seed.
    const created: string[] = [];
    ensureProjectDistill(repoRoot as string, created, timestamp);
    ensureCodexAgents({ repoRoot: repoRoot as string, created });

    // 승격은 객체에만 키를 심는다. readConfig는 배열/원시값도 통과시키므로
    // 여기서 걸러야 비객체에 graphify.enabled를 쓰다가 파일을 잘못된 형태로
    // 덮지 않는다. null은 승격 no-op (existing이 falsy면 write 생략).
    const raw = readConfig(repoRoot as string);
    const existing = (raw && typeof raw === 'object' && !Array.isArray(raw))
      ? raw as Record<string, unknown>
      : null;
    const distillSeeded = seedDistillConfig(repoRoot as string, existing);
    const alreadyEnabled = graphifyEnabledIsTrue(existing);
    let graphifyPromotion: string | undefined;
    let graphifyInstall: GraphifySetupResult | undefined;

    // enabled가 이미 true면 승격 경로 자체가 없다 — config를 건드리지 않는다.
    if (!alreadyEnabled) {
      if (!wantPromote) {
        // --promote-graphify 없이 기존 config가 바뀌는 경로는 없다.
        graphifyPromotion = 'candidate';
      } else {
        // 승격은 graphify.enabled(+ 설치 성공 시 bin)만 바꾼다. 파일 재생성 금지.
        if (wantInstall) {
          graphifyInstall = setup({ repoRoot });
        }
        if (existing) {
          const nextGraphify: Record<string, unknown> = {
            ...(existing.graphify && typeof existing.graphify === 'object'
              ? existing.graphify
              : {}),
            enabled: true,
          };
          if (
            graphifyInstall
            && (graphifyInstall.status === 'installed' || graphifyInstall.status === 'reused')
            && typeof graphifyInstall.bin === 'string'
            && graphifyInstall.bin
          ) {
            nextGraphify.bin = graphifyInstall.bin;
          }
          existing.graphify = nextGraphify;
          fs.writeFileSync(
            path.join(repoRoot as string, '.bouncer', 'config.json'),
            `${JSON.stringify(existing, null, 2)}\n`,
          );
        }
        graphifyPromotion = 'promoted';
      }
    }

    return {
      ok: true,
      created,
      skipped: created.length === 0,
      reason: created.includes(PROJECT_DISTILL)
        ? 'project-distill-seeded'
        : (created.length ? 'codex-agents-seeded' : 'already-initialized'),
      gitignoreSuggestions: suggestions,
      gitignoreWritten,
      ...(distillSeeded ? { distillSeeded: true } : {}),
      ...(graphifyPromotion ? { graphifyPromotion } : {}),
      ...(graphifyInstall ? { graphifyInstall } : {}),
    };
  }

  // 신규 부트스트랩
  const created: string[] = [];
  const config = defaultConfig(repoRoot as string);
  let graphifyInstall: GraphifySetupResult | undefined;
  if (wantInstall) {
    graphifyInstall = setup({ repoRoot });
    if (
      graphifyInstall
      && (graphifyInstall.status === 'installed' || graphifyInstall.status === 'reused')
      && typeof graphifyInstall.bin === 'string'
      && graphifyInstall.bin
    ) {
      // bin은 설치 성공 시에만 붙인다 — defaultConfig 추론 타입에 bin이 없어도 런타임 계약은 이 형태.
      config.graphify = { enabled: true, bin: graphifyInstall.bin } as { enabled: boolean; bin?: string };
    } else {
      // 설치 실패는 soft-fail: ok는 유지하고 enabled만 끈다.
      config.graphify = { enabled: false };
    }
  }

  writeFile(repoRoot as string, '.bouncer/context/index.md', CONTEXT_INDEX, created);
  writeFile(repoRoot as string, '.bouncer/config.json', `${JSON.stringify(config, null, 2)}\n`, created);
  ensureProjectDistill(repoRoot as string, created, timestamp);
  ensureCodexAgents({ repoRoot: repoRoot as string, created });
  // gitignoreSuggestions와 같은 advisory layer: detection이 아무것도 못 찾으면
  // operator에게 source_dirs를 채우라고 알려 빈 graph(BP-001 missing warning)에
  // opt-in하지 않게 함. dir을 찾았으면 생략.
  return {
    ok: true, created, skipped: false, reason: 'initialized',
    gitignoreSuggestions: suggestions,
    gitignoreWritten,
    ...(graphifyInstall ? { graphifyInstall } : {}),
    ...(config.source_dirs.length === 0 ? { sourceDirsUnresolved: true } : {}),
  };
}

module.exports = {
  init, inspectBootstrap, gitignoreSuggestions, SUGGESTED_IGNORES, SOURCE_DIR_CANDIDATES,
};
