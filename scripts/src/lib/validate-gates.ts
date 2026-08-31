'use strict';
const fs = require('node:fs');
const { createHash } = require('node:crypto');
const { toPosix } = require('./paths') as {
  toPosix: (p: unknown) => string;
};
const { computeDiffSha, EXPLAIN_SECTION_DEFS, resolveComprehensionEntry } = require('./comprehension') as {
  EXPLAIN_SECTION_DEFS: string[];
  computeDiffSha: (opts: {
    repoRoot?: unknown;
    base?: unknown;
    exec?: unknown;
  }) => { ok?: unknown; sha?: unknown; reason?: unknown } | null | undefined;
  resolveComprehensionEntry: (comp: unknown) =>
    | { ok: true; entry: { range_from?: unknown; diff_sha?: unknown } }
    | { ok: false; reason: string };
};
// finalize가 validate를 require하므로 scope 헬퍼는 finalize를 거치지 않는다.
const { makeAllowed, isRuntimeArtifact } = require('./scope') as {
  makeAllowed: (opts: { affectedPaths?: unknown; blueprintDir: unknown }) => (file: unknown) => boolean;
  isRuntimeArtifact: (file: unknown) => boolean;
};
const {
  defaultStagedFiles, resolveTaskUnit, unitLeafRel, statusOf,
} = require('./validate-docs') as {
  defaultStagedFiles: (opts: { repoRoot?: string }) =>
    | { ok: true; files: string[] }
    | { ok: false; reason?: string }
    | { ok?: unknown; files?: unknown; reason?: unknown };
  resolveTaskUnit: (docs: BlueprintDocs, opts?: {
    repoRoot?: string;
    blueprintDir?: string;
  }) => TaskUnit | null;
  unitLeafRel: (unit: TaskUnit | null | undefined, leaf: string, fallbackRel: string) => string;
  statusOf: (doc: DocLeaf | undefined | null) => unknown;
};
const { normalizeScopeEvidence } = require('./validate-structural') as {
  normalizeScopeEvidence: (bouncer: unknown) => {
    evidence: Record<string, unknown> | null;
    error: string | null;
  };
};
const { verifyLedgerPathFor } = require('./runtime-state') as {
  verifyLedgerPathFor: (opts: {
    repoRoot: string;
    verificationRel: unknown;
    deps?: unknown;
  }) => { unavailable?: boolean; reason?: string; ledgerFile?: string };
};
const {
  VERIFY_SECTION_DEFS, EXPLAIN_SECTION_HEADINGS, TODO_RE,
  parseSections, parseTasksSections, extractPathCandidates,
  pathsOverlap, pathJustifiedByTouch, collectFindingFailures,
} = require('./validate-sections') as {
  VERIFY_SECTION_DEFS: Array<{ key: string; re: RegExp }>;
  EXPLAIN_SECTION_HEADINGS: Array<{ key: string; re: RegExp }>;
  TODO_RE: RegExp;
  parseSections: (body: unknown, defs: Array<{ key: string; re: RegExp }>) => Record<string, string | null>;
  parseTasksSections: (body: unknown) => Record<string, string | null>;
  extractPathCandidates: (text: unknown) => string[];
  pathsOverlap: (a: string, b: string) => boolean;
  pathJustifiedByTouch: (ap: string, touchText: string) => boolean;
  collectFindingFailures: (opts: {
    body: unknown;
    findings: unknown;
    sectionLabel: string;
    findingLabel: string;
  }) => string[];
};

// 게이트별 G 코드 층. 문서 로드(docs)·문서 하나 구조(S)·본문 파싱은 여기 두지
// 않는다. scope evidence는 structural.normalizeScopeEvidence를 그대로 쓴다 — 여기
// 다시 구현하면 S9와 G4가 갈라진다. validate.ts를 require하지 않는다
// (validate → gates → structural, 순환 금지).

type FailureEntry = { code: string; message: string; file: string };
type DocLeaf = { data: unknown; body: string; rel: string };
type TaskUnit = {
  number: number | null;
  dir: string | null;
  tasks?: DocLeaf;
  verification?: DocLeaf;
  review?: DocLeaf;
};
type BlueprintRels = {
  epicIndex: string;
  blueprintIndex: string;
  tasks: string;
  verification: string;
  review: string;
  explain: string;
  contextReview: string;
  [key: string]: string;
};
type BlueprintDocs = {
  epicIndex?: DocLeaf;
  blueprintIndex?: DocLeaf;
  verification?: DocLeaf;
  review?: DocLeaf;
  explain?: DocLeaf;
  contextReview?: DocLeaf;
  tasks?: DocLeaf;
  tasksDocs?: DocLeaf[];
  taskUnits?: TaskUnit[];
};
type VerifyLedgerRecord = {
  unavailable?: boolean;
  reason?: string;
  rel?: unknown;
  command?: unknown;
  ran_at?: unknown;
  exit_code?: unknown;
  output_sha?: unknown;
};

type GateDeps = {
  computeDiffSha?: typeof computeDiffSha;
  exec?: unknown;
  stagedFiles?: typeof defaultStagedFiles;
  readVerifyLedger?: (opts: {
    repoRoot?: string;
    verificationRel?: string;
    deps?: GateDeps;
  }) => VerifyLedgerRecord | null;
  execFileSync?: unknown;
  fs?: {
    existsSync: (p: string) => boolean;
    readFileSync: (p: string, encoding: string) => string;
  };
  platform?: string;
};

type GateContext = {
  repoRoot?: string;
  blueprintDir?: string;
  deps?: GateDeps;
  taskUnit?: TaskUnit | null;
  // loader가 남긴 S0. plan G18만 context-review 경로를 본다(다른 optional 문서는 일반화하지 않음).
  parseErrors?: FailureEntry[];
};

type CheckGateOpts = {
  gate: string;
  docs?: BlueprintDocs;
  rels?: BlueprintRels;
  repoRoot?: string;
  blueprintDir?: string;
  deps?: GateDeps;
  taskUnit?: TaskUnit | null;
  parseErrors?: FailureEntry[];
};

function asData(doc: DocLeaf | undefined | null): Record<string, unknown> | undefined {
  if (!doc) return undefined;
  // 호출부가 `doc.data.bouncer`로 바로 들어가던 곳은 그대로 두기 위해
  // 여기서 data를 빈 객체로 바꾸지 않는다. null data는 예전처럼 접근 시 터진다.
  return doc.data as Record<string, unknown>;
}

function defaultReadVerifyLedger({
  repoRoot, verificationRel, deps,
}: {
  repoRoot?: string;
  verificationRel?: string;
  deps?: GateDeps;
}): VerifyLedgerRecord | null {
  const paths = verifyLedgerPathFor({
    repoRoot: repoRoot as string,
    verificationRel,
    deps,
  });
  if (paths.unavailable) {
    return { unavailable: true, reason: paths.reason };
  }
  const fsApi = (deps && deps.fs) || fs;
  if (!paths.ledgerFile || !fsApi.existsSync(paths.ledgerFile)) return null;
  try {
    const parsed: unknown = JSON.parse(fsApi.readFileSync(paths.ledgerFile, 'utf8'));
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return null;
    return parsed as VerifyLedgerRecord;
  } catch (_error) {
    return null;
  }
}

function checkG13(
  verificationDoc: DocLeaf | undefined | null,
  addUnit: (code: string, message: string, leaf: string) => void,
  ctx: GateContext,
): void {
  if (!verificationDoc) return;
  const vbody = typeof verificationDoc.body === 'string' ? verificationDoc.body : '';
  const vs = parseSections(vbody, VERIFY_SECTION_DEFS);
  const missingV = ['command', 'evidence'].filter((k) => !vs[k]);
  if (missingV.length) {
    addUnit('G13', `verification.md missing body sections: ${missingV.join(', ')}`, 'verification');
  }
  const vBouncer = (verificationDoc.data as Record<string, unknown>).bouncer as Record<string, unknown> | undefined;
  const evidence = vBouncer && vBouncer.verification as Record<string, unknown> | undefined;
  const validEvidence = evidence
    && typeof evidence.command === 'string'
    && evidence.command.trim()
    && typeof evidence.ran_at === 'string'
    && evidence.ran_at.trim()
    && evidence.exit_code === 0
    && typeof evidence.output_tail === 'string';
  if (!validEvidence) {
    addUnit('G13', 'verification.md missing successful harness verification metadata', 'verification');
    return;
  }
  if (
    !(vs.command as string).includes(`\`${evidence.command}\``)
    || !(vs.evidence as string).includes('Exit code: 0')
  ) {
    addUnit('G13', 'verification.md body does not match harness verification metadata', 'verification');
  }
  // 프론트매터만 맞으면 에이전트 Write로 통과하던 구멍. 원장은 git common dir
  // 아래 하네스 전용이라, 문서와 대조하지 않으면 `/bouncer-commit` 직접 호출도
  // status: passed 손기록으로 열린다.
  const deps = ctx && ctx.deps;
  const reader = (deps && deps.readVerifyLedger) || defaultReadVerifyLedger;
  const record = reader({
    repoRoot: ctx && ctx.repoRoot,
    verificationRel: verificationDoc.rel,
    deps,
  });
  if (record && record.unavailable) {
    addUnit(
      'G13',
      `verification.md verify ledger unavailable (${record.reason || 'Git common directory unavailable'})`,
      'verification',
    );
    return;
  }
  if (!record) {
    addUnit('G13', 'verification.md missing harness verify ledger record', 'verification');
    return;
  }
  if (
    record.command !== evidence.command
    || record.ran_at !== evidence.ran_at
    || record.exit_code !== evidence.exit_code
  ) {
    addUnit('G13', 'verification.md harness metadata does not match verify ledger', 'verification');
    return;
  }
  const outputSha = createHash('sha256').update(String(evidence.output_tail), 'utf8').digest('hex');
  if (record.output_sha !== outputSha) {
    addUnit('G13', 'verification.md output_tail does not match verify ledger output_sha', 'verification');
  }
}

function checkGate(
  gate: string | CheckGateOpts,
  docs?: BlueprintDocs,
  rels?: BlueprintRels,
  failures?: FailureEntry[],
  ctx?: GateContext,
): { failures: FailureEntry[] } | void {
  if (typeof gate === 'object' && gate !== null) {
    const opts = gate;
    const collected: FailureEntry[] = [];
    checkGate(opts.gate, opts.docs || {}, opts.rels as BlueprintRels, collected, {
      repoRoot: opts.repoRoot,
      blueprintDir: opts.blueprintDir,
      deps: opts.deps,
      taskUnit: opts.taskUnit,
      parseErrors: opts.parseErrors,
    });
    return { failures: collected };
  }
  return runCheckGate(gate, docs as BlueprintDocs, rels as BlueprintRels, failures as FailureEntry[], ctx || {});
}

function runCheckGate(
  gate: string,
  docs: BlueprintDocs,
  rels: BlueprintRels,
  failures: FailureEntry[],
  ctx: GateContext,
): void {
  const add = (code: string, message: string, fileKey: string) =>
    failures.push({ code, message, file: rels[fileKey] });
  const repoRoot = ctx && ctx.repoRoot;
  const blueprintDir = ctx && ctx.blueprintDir;
  const deps = ctx && ctx.deps;

  if (gate === 'plan') {
    if (statusOf(docs.epicIndex) !== 'approved') add('G1', 'epic.status != approved', 'epicIndex');
    // closed는 finalize --yes가 마감한 blueprint의 잠금 signal(hard rule/schema 참고).
    // 미승인 draft와 같은 코드(G2)로 걸지만, 사용자가 "왜 막혔는지" draft와
    // 헷갈리지 않도록 문구를 분기한다 — 재승인 경로가 없다는 점도 여기서 안내.
    const bpStatus = statusOf(docs.blueprintIndex);
    if (bpStatus === 'closed') {
      add(
        'G2',
        'blueprint is closed (finalized) — open a new blueprint instead of resuming this one',
        'blueprintIndex',
      );
    } else if (bpStatus !== 'approved') {
      add('G2', 'blueprint.status != approved', 'blueprintIndex');
    }
    // 축약 계약의 유일한 발동 신호는 blueprint index.md의 `bouncer.scale`이다.
    // 사용자 선언(그리고 그것을 쓰는 scaffold --scale)만이 여기 도달한다 —
    // 게이트는 경로 수·diff 크기로 light를 추론하지 않는다.
    const bpData = asData(docs.blueprintIndex);
    const bpBouncer = bpData && bpData.bouncer && typeof bpData.bouncer === 'object'
      ? bpData.bouncer as Record<string, unknown>
      : undefined;
    const isLight = Boolean(bpBouncer && bpBouncer.scale === 'light');

    // G18은 blueprint 단위 — task 묶음 순회(G3–G5·G10–G12) 밖에 둔다.
    // light에는 context-review 문서가 아예 없으므로(scaffold가 만들지 않는다)
    // 판정 대상이 없다. 이 면제는 LLM 판단이 아니라 문서 세트의 결과다:
    // full은 여전히 status와 세 필드·## Findings 절을 그대로 요구한다.
    if (!isLight) {
      if (!docs.contextReview) {
        // 파일이 있는데 frontmatter 파싱이 깨지면 loader는 docs 슬롯을 비우고
        // S0만 남긴다. 부재 메시지로 가면 scaffold가 이미 있는 파일을 거절한다.
        const parseFailed = Array.isArray(ctx.parseErrors)
          && ctx.parseErrors.some(
            (e) => e.code === 'S0' && e.file === rels.contextReview,
          );
        add(
          'G18',
          parseFailed
            ? 'context-review.md has invalid frontmatter; fix the S0 parse error'
            : `context-review.md missing (${rels.contextReview}); run bouncer scaffold context-review`,
          'contextReview',
        );
      } else {
        if (statusOf(docs.contextReview) !== 'accepted') {
          add('G18', 'context-review.status != accepted', 'contextReview');
        }
        const crData = asData(docs.contextReview);
        const crBouncer = crData && crData.bouncer
          ? crData.bouncer as Record<string, unknown>
          : {};
        const crMeta = crBouncer.context_review as Record<string, unknown> | undefined;
        for (const message of collectFindingFailures({
          body: docs.contextReview.body,
          findings: crMeta && crMeta.findings,
          sectionLabel: 'context-review',
          findingLabel: 'context-review',
        })) {
          add('G18', message, 'contextReview');
        }
      }
    }
    // G10 필수 절. light는 Goal & intent·Touch·Checklist 셋만 요구한다.
    // 승인 범위 판정(G4·G5·G11·G12)은 두 경로가 똑같이 받는다 — 줄어드는 것은
    // 서술 분량이지 범위 증적이 아니다.
    const sectionKeys = isLight
      ? ['goal', 'touch', 'checklist']
      : ['goal', 'interface', 'touch', 'doNotTouch', 'checklist'];
    // plan 게이트의 task 검사는 문서마다 돌린다. file은 해당 task 경로여야
    // 어느 문서가 미달인지 알 수 있다. tasksDocs가 없으면 단위 테스트용
    // 단일 docs.tasks로 폴백.
    const tasksList = Array.isArray(docs.tasksDocs) && docs.tasksDocs.length > 0
      ? docs.tasksDocs
      : (docs.tasks ? [docs.tasks] : []);
    if (tasksList.length === 0) {
      add('G3', 'tasks.status != ready', 'tasks');
      add('G4', 'tasks.graph.suggested_paths missing', 'tasks');
      add('G5', 'tasks.affected_paths missing or empty', 'tasks');
      add('G10', `tasks missing implementation-ready sections: ${sectionKeys.join(', ')}`, 'tasks');
      return;
    }
    for (const tasksDoc of tasksList) {
      const file = tasksDoc.rel || rels.tasks;
      const addTask = (code: string, message: string) => failures.push({ code, message, file });
      // ready = plan 직후. in_progress = execute 중. verified = 같은 BP의
      // 앞 task를 이미 끝낸 뒤 next-task --set. draft만 G3.
      const taskStatus = statusOf(tasksDoc);
      if (!(['ready', 'in_progress', 'verified'] as unknown[]).includes(taskStatus)) {
        addTask('G3', 'tasks.status != ready');
      }
      // YAML data가 null/undefined면 `.bouncer`에서 터지는 게 기존 실패 형태다.
      // `data &&`로 막으면 G4/G5가 missing 메시지로 fail-open 한다.
      const taskBouncer = (tasksDoc.data as Record<string, unknown>).bouncer as
        Record<string, unknown> | undefined;
      const scopeEvidence = normalizeScopeEvidence(taskBouncer);
      if (!scopeEvidence.evidence || scopeEvidence.error) {
        addTask('G4', scopeEvidence.error || 'tasks.scope_evidence missing');
      }
      const ap = taskBouncer ? taskBouncer.affected_paths : undefined;
      if (!Array.isArray(ap) || ap.length === 0) addTask('G5', 'tasks.affected_paths missing or empty');
      const tasksBody = tasksDoc && typeof tasksDoc.body === 'string' ? tasksDoc.body : '';
      const sections = parseTasksSections(tasksBody);
      const missing = sectionKeys.filter((k) => !sections[k]);
      const unfilled = sectionKeys.filter((k) => sections[k] && TODO_RE.test(sections[k] as string));
      if (missing.length) {
        addTask('G10', `tasks missing implementation-ready sections: ${missing.join(', ')}`);
      } else if (unfilled.length) {
        // 아래 path 검사 대신 보고: 치환되지 않은 placeholder는 G11/G12 finding이
        // scope가 아니라 template 텍스트에 대한 잡음이 되게 함.
        addTask('G10', `tasks sections still contain <TODO: …> placeholders: ${unfilled.join(', ')}`);
      } else {
        const apList = Array.isArray(ap)
          ? ap.map((p) => toPosix(String(p)).replace(/^\.\//, ''))
          : [];
        const touchText = sections.touch || '';
        const avoidText = sections.doNotTouch || '';
        const unjustified = apList.filter((p) => !pathJustifiedByTouch(p, touchText));
        if (unjustified.length) {
          addTask('G11', `affected_paths not justified by Touch: ${unjustified.join(', ')}`);
        }
        const forbidden = extractPathCandidates(avoidText);
        const overlap = apList.filter((p) => forbidden.some((f) => pathsOverlap(p, f)));
        if (overlap.length) {
          addTask('G12', `do-not-touch intersects affected_paths: ${overlap.join(', ')}`);
        }
      }
    }
    return;
  }
  if (gate === 'execute') {
    // docs.tasks(첫 문서 호환 필드)는 쓰지 않는다 — 포인터 대상 묶음만 판정.
    // ctx.taskUnit이 없으면 단위 테스트용으로 평탄 docs에서 합성.
    const taskUnit = (ctx && ctx.taskUnit) || resolveTaskUnit(docs, {});
    const tasksDoc = taskUnit && taskUnit.tasks;
    const verificationDoc = taskUnit && taskUnit.verification;
    const reviewDoc = taskUnit && taskUnit.review;
    const addUnit = (code: string, message: string, leaf: string) => failures.push({
      code,
      message,
      file: unitLeafRel(taskUnit, leaf, rels[leaf]),
    });

    if (statusOf(tasksDoc) !== 'verified') {
      addUnit('G6', 'tasks.status != verified', 'tasks');
    }
    if (statusOf(verificationDoc) !== 'passed') {
      addUnit('G7', 'verification.status != passed', 'verification');
    }
    const reviewBouncer = reviewDoc
      ? (reviewDoc.data as Record<string, unknown>).bouncer as Record<string, unknown> | undefined
      : undefined;
    const review = reviewBouncer ? reviewBouncer.review as Record<string, unknown> | undefined : undefined;
    const reviewOk = statusOf(reviewDoc) === 'accepted' || (review && review.required === false);
    if (!reviewOk) {
      addUnit('G8', 'review not accepted and review.required != false', 'review');
    }
    checkG13(verificationDoc, addUnit, ctx);
    const reviewMetaBouncer = reviewDoc
      ? (reviewDoc.data as Record<string, unknown>).bouncer as Record<string, unknown> | undefined
      : undefined;
    const reviewMeta = reviewMetaBouncer
      ? reviewMetaBouncer.review as Record<string, unknown> | undefined
      : undefined;
    const reviewSkipped = reviewMeta && reviewMeta.required === false;
    if (reviewDoc && !reviewSkipped) {
      for (const message of collectFindingFailures({
        body: reviewDoc.body,
        findings: reviewMeta && reviewMeta.findings,
        sectionLabel: 'review.md',
        findingLabel: 'review',
      })) {
        addUnit('G14', message, 'review');
      }
    }
    return;
  }
  // G16: blueprint 마감. 모든 task verified + explain 본문·comprehension(BP 단일
  // 엔트리)의 diff_sha를 range_from..HEAD와 대조. G15는 폐기(결번)됐고, commit은
  // 아래에서 G6/G7/G8 + G13 + G17로 재판정한다.
  if (gate === 'finalize') {
    const tasksList = Array.isArray(docs.tasksDocs) && docs.tasksDocs.length > 0
      ? docs.tasksDocs
      : (docs.tasks ? [docs.tasks] : []);
    const openIds: string[] = [];
    for (const tasksDoc of tasksList) {
      if (statusOf(tasksDoc) !== 'verified') {
        const data = asData(tasksDoc);
        const id = data && data.bouncer
          ? (data.bouncer as Record<string, unknown>).id
          : undefined;
        openIds.push(typeof id === 'string' && id ? id : '(unknown)');
      }
    }
    if (openIds.length) {
      // 열린 task id를 메시지에 담아 어느 묶음이 남았는지 바로 보이게 한다.
      // 경고가 아니라 hard fail — 사용자가 넘길 수 없다.
      const openDoc = tasksList.find((t) => statusOf(t) !== 'verified');
      failures.push({
        code: 'G16',
        message: `open tasks remain (not verified): ${openIds.join(', ')}`,
        file: (openDoc && openDoc.rel) || rels.tasks,
      });
      return;
    }

    if (!docs.explain) {
      add('G16', 'explain.md missing', 'explain');
      return;
    }
    if (statusOf(docs.explain) !== 'published') {
      add('G16', 'explain.status != published', 'explain');
    }
    const explainBody = typeof docs.explain.body === 'string' ? docs.explain.body : '';
    const sections = parseSections(explainBody, EXPLAIN_SECTION_HEADINGS);
    const missing = EXPLAIN_SECTION_DEFS.filter((k) => !sections[k]);
    if (missing.length) {
      add('G16', `explain missing written sections: ${missing.join(', ')}`, 'explain');
      return;
    }

    const explainData = asData(docs.explain);
    const bouncer = explainData && explainData.bouncer
      ? explainData.bouncer as Record<string, unknown>
      : {};
    const comp = bouncer.comprehension;
    // BP당 엔트리 하나(배열 마지막). task 번호 루프는 쓰지 않는다 —
    // 0.7 다중 엔트리는 마지막만 보면 읽기 호환이 된다.
    const found = resolveComprehensionEntry(comp);
    // 기본 tsc(strict 꺼짐)는 `!found.ok`로 실패 분기를 좁히지 못한다.
    if (found.ok === false) {
      add(
        'G16',
        found.reason === 'not-a-list'
          ? 'explain comprehension must be a list of task entries'
          : 'explain comprehension record missing',
        'explain',
      );
      return;
    }

    // 계산 실패와 해시 불일치는 서로 다른 문자열 — 원인 분류가 메시지에 드러나야 한다.
    const shaFn = (deps && deps.computeDiffSha) || computeDiffSha;
    const computed = shaFn({
      repoRoot,
      base: found.entry.range_from,
      exec: deps && deps.exec,
    });
    if (!computed || computed.ok !== true) {
      const reason = computed && computed.reason ? computed.reason : 'exec-failed';
      add('G16', `explain diff_sha could not be computed (${reason})`, 'explain');
      return;
    }
    if (computed.sha !== String(found.entry.diff_sha).trim()) {
      // 메시지에 range_from을 쓰지 않는다 — 실패 사유는 불일치뿐; 범위는 엔트리에 있다.
      add('G16', 'explain diff_sha does not match range_from..HEAD', 'explain');
    }
    return;
  }
  // commit: explain을 보지 않는다. 포인터 task 상태(G6/G7/G8)와 G13 원장 대조,
  // 스테이징 스코프(G17)를 본다. G9·G15는 폐기 — 번호만 비워 둔다.
  if (gate === 'commit') {
    // G9 (distill.status == published)는 폐기됨 — 번호만 비워 둠.
    // G15 (explain comprehension / diff_sha)는 폐기됨 — 번호만 비워 둠.
    const taskUnit = (ctx && ctx.taskUnit) || resolveTaskUnit(docs, {
      repoRoot, blueprintDir,
    });
    const tasksDoc = taskUnit && taskUnit.tasks;
    const verificationDoc = taskUnit && taskUnit.verification;
    const reviewDoc = taskUnit && taskUnit.review;
    const addUnit = (code: string, message: string, leaf: string) => failures.push({
      code,
      message,
      file: unitLeafRel(taskUnit, leaf, rels[leaf]),
    });

    if (statusOf(tasksDoc) !== 'verified') {
      addUnit('G6', 'tasks.status != verified', 'tasks');
    }
    if (statusOf(verificationDoc) !== 'passed') {
      addUnit('G7', 'verification.status != passed', 'verification');
    }
    const commitReviewBouncer = reviewDoc
      ? (reviewDoc.data as Record<string, unknown>).bouncer as Record<string, unknown> | undefined
      : undefined;
    const review = commitReviewBouncer
      ? commitReviewBouncer.review as Record<string, unknown> | undefined
      : undefined;
    const reviewOk = statusOf(reviewDoc) === 'accepted' || (review && review.required === false);
    if (!reviewOk) {
      addUnit('G8', 'review not accepted and review.required != false', 'review');
    }
    checkG13(verificationDoc, addUnit, ctx);

    // G17은 이미 스테이징된 경로만 본다. working-tree 변경의 out-of-scope는
    // bouncer commit이 따로 막으며, 빈 스테이징은 통과(빈 커밋 방지는 명령 몫).
    const stagedFn = (deps && deps.stagedFiles) || defaultStagedFiles;
    const staged = stagedFn({ repoRoot });
    if (!staged || staged.ok !== true) {
      // `'reason' in`은 객체가 아니면 TypeError. 예전 `staged && staged.reason`은
      // primitive도 git-failed로 G17에 남겼다.
      const stagedFail = staged as { reason?: unknown } | null | undefined;
      const reason = stagedFail && stagedFail.reason ? stagedFail.reason : 'git-failed';
      failures.push({
        code: 'G17',
        message: `could not read staged files (${reason})`,
        file: unitLeafRel(taskUnit, 'tasks', rels.tasks),
      });
      return;
    }
    const taskData = asData(tasksDoc);
    const affectedPaths = taskData && taskData.bouncer
      ? (taskData.bouncer as Record<string, unknown>).affected_paths
      : [];
    const allowed = makeAllowed({ affectedPaths, blueprintDir });
    const files = Array.isArray(staged.files) ? staged.files : [];
    const violations = files
      .filter((f) => !isRuntimeArtifact(f))
      .filter((f) => !allowed(f));
    if (violations.length) {
      failures.push({
        code: 'G17',
        message: `staged path outside affected_paths: ${violations.join(', ')}`,
        file: unitLeafRel(taskUnit, 'tasks', rels.tasks),
      });
    }
    return;
  }
  throw new Error(`unknown gate: ${gate}`);
}

module.exports = { checkGate };
