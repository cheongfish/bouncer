'use strict';
// 문서 종류 분류와 경로별 구조 계약의 정본 leaf. scripts/check-doc-shape.js(CLI)와 plan 게이트가
// 같은 표를 읽어야 "verify가 가리킨 문서에 계약이 있는가"의 답이 두 곳에서 갈라지지 않는다.
// 순수 모듈이다: I/O·process 실행·문서 본문 읽기를 하지 않는다. 본문 검사(checkDocShape)와
// kind별 계약 합성은 CLI 쪽에 남는다.

// checkDocShape의 두 번째 인자와 같은 계약 객체다. 표의 항목마다 쓰는 키가 달라 모두 optional로 둔다.
type FrontmatterContract = {
  required: string[];
  nonEmpty?: string[];
  values?: Record<string, string>;
};
type HeadingsContract = { required?: string[]; order?: string[] };
type LinkContract = {
  href: string;
  resolve?: boolean;
  referencePreamble?: boolean;
  conditionalLoad?: { triggers: string[] };
};
type StepsContract = {
  required: number[];
  order?: boolean;
  acq?: number[];
  links?: Record<number, string[]>;
};
type DocContract = {
  frontmatter?: FrontmatterContract;
  headings?: HeadingsContract;
  links?: LinkContract[];
  steps?: StepsContract;
  acqIndex?: { heading: string; steps: number[]; only?: boolean };
  rejectionTable?: { required: string[] };
};
type DocKind = 'workflow' | 'agent' | 'subskill';

/**
 * 저장소 상대 경로를 skill-shape 문서 종류로 분류한다.
 * 계약이 없는 companion·NOTICE·skill-local reference는 null을 돌려 기본 스캔에서
 * 제외한다. 인자를 준 경우에는 호출부가 null을 오류로 처리한다.
 *
 * @param {string} relPath - cwd 기준 상대 경로
 * @returns {DocKind|null} 문서 종류
 */
function classifyDocPath(relPath: string): DocKind | null {
  const norm = relPath.replace(/\\/g, '/').replace(/^\.\//, '');
  if (/^skills\/bouncer-[^/]+\/SKILL\.md$/.test(norm)) return 'workflow';
  if (/^agents\/[^/]+\.md$/.test(norm)) return 'agent';
  if (/^references\/[^/]+\/index\.md$/.test(norm)) return 'subskill';
  return null;
}

/**
 * coordinator 카드가 run 소유 reference를 읽을 때 요구하는 링크 계약을 만든다.
 * 카드는 skills/bouncer-run/references/ 의 reader이므로 링크가 실재하고, 대상 선두 문단과
 * 링크 문단이 같은 조건부 적재 trigger를 가져야 한다.
 *
 * @param {string} name - reference 파일 이름(확장자 제외)
 * @param {string[]} triggers - 조건부 적재가 보존해야 하는 route 의미 단위
 * @returns {LinkContract} links 계약 항목
 */
function runRefLink(name: string, triggers: string[]): LinkContract {
  return {
    href: `../../skills/bouncer-run/references/${name}.md`,
    resolve: true,
    referencePreamble: true,
    conditionalLoad: { triggers },
  };
}

// 경로별 문서 구조 계약 표. 키는 저장소 상대 경로, 값은 checkDocShape의 두 번째 인자와
// 같은 계약 객체다. 종류별 고정 계약(classifyDocPath)이 표현하지 못하는 문서별 제목·단계·
// 링크 규칙을 테스트의 인라인 계약 대신 여기에 둔다. 새 검사 종류(문장 정규식 등)는
// 넣지 않는다 — 문구 고정은 문서를 다듬을 때마다 깨질 뿐 구조를 지키지 못한다.
const READONLY_ROLE_GUARDS = 'Hard guards (read-only)';
const DRIVE_METRICS_HEADINGS = ['Per coordinator session', 'Per root-direct session', 'Closing report'];
const AGENT_DISPATCH_HEADINGS = [
  'Lightweight and implement dispatch', 'Named implementer', 'Implementer fallback', 'Intent bundle',
  'Dispatch metadata and reports', 'Debugger dispatch', 'Worker model and token records', 'Worker hand-back',
];
const PATH_CONTRACTS: Record<string, DocContract> = {
  // 역할 문서: Authority → Hard guards → 역할 절차/rubric → Output contract 순서.
  'agents/bouncer-implementer.md': {
    headings: {
      required: ['Authority', 'Hard guards', 'Procedure', 'Output contract'],
      order: ['Authority', 'Hard guards', 'Procedure', 'Output contract'],
    },
  },
  'agents/bouncer-coordinator.md': {
    headings: {
      required: ['Authority', 'Hard guards', 'Worker dispatch', 'Task round', 'Procedure', 'Output contract'],
      order: ['Authority', 'Hard guards', 'Worker dispatch', 'Task round', 'Procedure', 'Output contract'],
    },
  },
  'agents/bouncer-debugger.md': {
    headings: {
      required: ['Authority', READONLY_ROLE_GUARDS, 'Procedure', 'Output contract'],
      order: ['Authority', READONLY_ROLE_GUARDS, 'Procedure', 'Output contract'],
    },
  },
  'agents/bouncer-reviewer.md': {
    headings: {
      required: ['Authority', READONLY_ROLE_GUARDS, 'Review modes', 'Output contract'],
      order: ['Authority', READONLY_ROLE_GUARDS, 'Review modes', 'Output contract'],
    },
  },
  'agents/bouncer-context-reviewer.md': {
    headings: {
      required: ['Authority', READONLY_ROLE_GUARDS, 'Review modes', 'Output contract'],
      order: ['Authority', READONLY_ROLE_GUARDS, 'Review modes', 'Output contract'],
    },
  },
  // run 스킬의 dispatch reference: 종류가 없어 경로 계약이 유일한 구조 검사다. 기존 H2 절을
  // 순서대로 고정하며 새 검사 종류는 넣지 않는다.
  'skills/bouncer-run/references/agent-dispatch.md': {
    headings: {
      required: AGENT_DISPATCH_HEADINGS,
      order: AGENT_DISPATCH_HEADINGS,
    },
  },
  // run 스킬의 drive metrics reference: 종류가 없어 경로 계약이 유일한 구조 검사다. 기존 H2 절을
  // 순서대로 고정하며 새 검사 종류는 넣지 않는다.
  'skills/bouncer-run/references/drive-metrics.md': {
    headings: {
      required: DRIVE_METRICS_HEADINGS,
      order: DRIVE_METRICS_HEADINGS,
    },
  },
  // 루트 마스터 규칙: 하드룰 절과 검증 reference 링크(실재해야 한다).
  'AGENTS.md': {
    headings: { required: ['Hard rules'], order: ['Hard rules'] },
    links: [{ href: 'references/verification/index.md', resolve: true }],
  },
  // 제품 규칙 문서: 소유 절 제목.
  // coordinate repair의 거절 표(조건·reason 두 열)는 runCli가 coordinator-repair의 지원 reason과
  // 대조한다. 필수 행은 두 거절 경로를 각각 설명하는 reason이다.
  'rules/cli.md': {
    rejectionTable: { required: ['final-review-single-round', 'final-review-repair-do-not-touch'] },
  },
  'rules/commit-scope.md': {
    headings: {
      required: ['Commit unit and staging', 'Approved and ledger scope', 'Worktree and enforcement layers'],
      order: ['Commit unit and staging', 'Approved and ledger scope', 'Worktree and enforcement layers'],
    },
  },
  'rules/current-pointer.md': {
    headings: {
      required: ['Read and task selection', 'Moves and clears'],
      order: ['Read and task selection', 'Moves and clears'],
    },
  },
  'rules/plugin-root.md': { headings: { required: ['Master and product rules'] } },
  'rules/planning.md': { headings: { required: ['Complexity declaration'] } },
  // 102-001에서 execute 스킬의 reference가 run 소유로 옮겨졌다. coordinator 카드가 그
  // reference의 읽는 쪽이라, 링크가 실재하고 조건부 적재 문장 안에 있어야 한다.
  'references/coordinator-cards/implement.md': {
    links: [
      runRefLink('agent-dispatch', ['dispatch', 'fallback']),
    ],
  },
  'references/coordinator-cards/verify.md': {
    links: [
      runRefLink('verification-recovery', ['verify', 'recover']),
    ],
  },
  'references/coordinator-cards/review.md': {
    links: [
      runRefLink('agent-dispatch', ['dispatch', 'fallback']),
      runRefLink('review-round', ['review', 'round']),
    ],
  },
  // subskill frontmatter 정체성(종류별 계약은 frontmatter를 보지 않는다).
  'references/debugging/index.md': {
    frontmatter: { required: ['name', 'description'], nonEmpty: ['description'], values: { name: 'debugging' } },
  },
  'references/explain-diff/index.md': {
    frontmatter: { required: ['name', 'description'], nonEmpty: ['description'], values: { name: 'explain-diff' } },
  },
  'references/context-review/index.md': {
    frontmatter: { required: ['name', 'description'], nonEmpty: ['description'], values: { name: 'context-review' } },
  },
  // plan 워크플로: 여덟 번호 단계, ACQ는 1·2·3·4·6단계에만 둔다.
  'skills/bouncer-plan/SKILL.md': {
    frontmatter: { required: ['name', 'description'], values: { name: 'bouncer-plan' } },
    links: [{
      href: './references/scope-confirm.md',
      resolve: true,
      referencePreamble: true,
      conditionalLoad: { triggers: ['confirm', 'affected_paths'] },
    }],
    steps: {
      required: [1, 2, 3, 4, 5, 6, 7, 8],
      order: true,
      acq: [1, 2, 3, 4, 6],
      links: {
        3: ['./references/evidence-dispatch.md'],
        4: ['./references/scope-confirm.md'],
        5: ['./references/context-review.md'],
      },
    },
    acqIndex: { heading: 'ACQ (AskUserQuestion) gates', steps: [1, 2, 3, 4, 6], only: true },
  },
  // init 워크플로: 네 번호 단계. 결과 처리 reference는 단계 2에서만 적재하고 부트스트랩보다
  // 앞서지 않는다(단계 번호 순서가 그 선후를 고정한다). 동의 ACQ 색인은 단계 2 하나다.
  'skills/bouncer-init/SKILL.md': {
    frontmatter: { required: ['name', 'description'], values: { name: 'bouncer-init' } },
    steps: {
      required: [1, 2, 3, 4],
      order: true,
      links: { 2: ['./references/init-result.md'] },
    },
    acqIndex: { heading: 'ACQ (AskUserQuestion) gates', steps: [2], only: true },
  },
  // 출력 계약 규칙: 보고 형식 절. 워크플로가 이 문서를 적재하므로 절이 사라지면 안 된다.
  'rules/output.md': {
    headings: { required: ['compact', 'coordinator 실행', 'debug', '숨길 수 없는 항목'] },
  },
  // 루트 README: 라이선스·보안·행동강령 문서로 가는 링크(실재해야 한다).
  'README.md': {
    links: [
      { href: 'LICENSE', resolve: true },
      { href: 'SECURITY.md', resolve: true },
      { href: 'CODE_OF_CONDUCT.md', resolve: true },
    ],
  },
  // 보조 스킬(subskill): frontmatter 정체성과 절차 번호. 종류별 계약은 frontmatter를 보지 않는다.
  'references/graphify-runner/index.md': {
    frontmatter: { required: ['name', 'description'], nonEmpty: ['description'], values: { name: 'graphify-runner' } },
    steps: { required: [1, 2, 3, 4, 5], order: true },
  },
  'references/implementation/index.md': {
    frontmatter: { required: ['name', 'description'], nonEmpty: ['description'], values: { name: 'implementation' } },
    headings: {
      required: ['When this applies', 'Steps', 'Guardrails', 'Return'],
      order: ['When this applies', 'Steps', 'Guardrails', 'Return'],
    },
  },
  // 공통 코딩 표준 정본: 역할 문서가 절 이름으로 가리키므로 아홉 절이 모두 있어야 한다.
  'references/coding-standards/index.md': {
    frontmatter: { required: ['name', 'description'], nonEmpty: ['description'], values: { name: 'coding-standards' } },
    headings: {
      required: [
        'When this applies', 'Core rules', 'Tests', 'Test trust', 'Error handling',
        'Reuse and abstraction', 'Comments and docstrings', 'Guardrails', 'Return',
      ],
      order: [
        'When this applies', 'Core rules', 'Tests', 'Test trust', 'Error handling',
        'Reuse and abstraction', 'Comments and docstrings', 'Guardrails', 'Return',
      ],
    },
  },
  // minimality 사다리는 일곱 단이며 단 번호가 갈라져 있어야 native/stdlib가 한 단으로 합쳐지지 않는다.
  'references/minimality/index.md': {
    frontmatter: { required: ['name', 'description'], nonEmpty: ['description'], values: { name: 'minimality' } },
    steps: { required: [1, 2, 3, 4, 5, 6, 7], order: true },
  },
  'references/discovery/index.md': {
    frontmatter: { required: ['name', 'description'], nonEmpty: ['description'], values: { name: 'discovery' } },
    steps: { required: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11], order: true },
  },
  'references/stop-slop/index.md': {
    frontmatter: { required: ['name', 'description'], nonEmpty: ['description'], values: { name: 'stop-slop' } },
  },
};

/**
 * 경로 계약 표에서 상대 경로의 계약을 찾는다.
 *
 * @param {string} relPath - cwd 기준 상대 경로
 * @returns {DocContract|null} 표에 있으면 계약 객체, 없으면 null
 */
function pathContractFor(relPath: string): DocContract | null {
  const norm = relPath.replace(/\\/g, '/').replace(/^\.\//, '');
  return Object.prototype.hasOwnProperty.call(PATH_CONTRACTS, norm) ? PATH_CONTRACTS[norm] : null;
}

export = { classifyDocPath, pathContractFor, PATH_CONTRACTS };
