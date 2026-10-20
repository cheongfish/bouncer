'use strict';
const fs = require('node:fs');
const path = require('node:path');
import paths = require('./paths');
const { toPosix } = paths;
import frontmatter = require('./frontmatter');
const { readDoc } = frontmatter;
import render = require('./render');
const { renderDoc } = render;
import commitSha = require('./commit-sha');
const { normalizeCommitSha } = commitSha;
import collect = require('./finalize-collect');
const { stableIdFromTaskData, taskStableParts } = collect;
function asRecord(value: unknown): Record<string, unknown> { return value as Record<string, unknown>; }

const TASK_SECTIONS = [
  ['goal', /^##\s+(Goal\s*&\s*intent|목적[·・.]?의도)\s*$/i],
  ['currentBehavior', /^##\s+(Current\s+behavior|현재\s*동작)\s*$/i],
  ['targetBehavior', /^##\s+(Target\s+behavior|목표\s*동작)\s*$/i],
  ['interface', /^##\s+(Interface|인터페이스)\s*$/i],
  ['touch', /^##\s+(Touch|수정할\s*부분)\s*$/i],
  ['doNotTouch', /^##\s+(Do\s+not\s+touch|절대\s*수정\s*금지)\s*$/i],
  ['constraints', /^##\s+(Constraints|제약)\s*$/i],
  ['checklist', /^##\s+(Checklist|체크리스트)\s*$/i],
];

/**
 * tasks.md에서 Explain에 보존하는 설계 절의 본문을 읽는다.
 * HTML 주석은 template 안내이므로 본문에서 제외하고, 누락된 절은 null로 둔다.
 *
 * @param {unknown} body - tasks.md 본문
 * @returns {Record<string, string | null>} 절 키에서 잘라낸 본문으로의 매핑
 */
function parseTasksSections(body: unknown): Record<string, string | null> {
  const lines = (typeof body === 'string' ? body : '').replace(/<!--[\s\S]*?-->/g, '').split('\n');
  const starts: Array<{ key: string; line: number }> = [];
  for (let i = 0; i < lines.length; i++) {
    for (const [key, re] of TASK_SECTIONS) if ((re as RegExp).test(lines[i].trim())) {
      starts.push({ key: key as string, line: i });
    }
  }
  const out: Record<string, string | null> = Object.fromEntries(TASK_SECTIONS.map(([key]) => [key, null]));
  for (let i = 0; i < starts.length; i++) {
    const start = starts[i];
    const end = i + 1 < starts.length ? starts[i + 1].line : lines.length;
    out[start.key] = lines.slice(start.line + 1, end).join('\n').trim() || null;
  }
  return out;
}


type DocLeafLike = { data?: unknown; body?: string; rel?: string };


type TaskUnitLike = {
  number?: number | null;
  tasks?: DocLeafLike;
  verification?: DocLeafLike;
  review?: DocLeafLike;
  [key: string]: unknown;
};


type TrailerCommit = { sha?: string; sha8: string };



type TaskCommitEntry = { task: string; sha: string; intent_anchor: string };



/**
 * explain.md frontmatter에 task_commits를 쓴다. 파일이 없으면 false.
 * 기존 배열은 통째로 교체한다 — finalize가 삭제 직전 스냅샷의 정본이다.
 * 직렬화는 `{ task, sha, intent_anchor }`만 남긴다. legacy `{ id, sha }`는 쓰지 않는다.
 * 부모 Epic·Blueprint를 못 읽거나 행의 stable ref가 그 번호와 다르면 그 행은
 * 쓰지 않는다.
 *
 * @param {object} opts
 * @param {string} opts.repoRoot - 저장소 루트
 * @param {string} opts.blueprintDir - blueprint 상대 경로
 * @param {TaskCommitEntry[]} opts.taskCommits - collectTaskCommits 결과
 * @returns {boolean} 썼으면 true, explain 부재·파싱 실패면 false
 */
function writeExplainTaskCommits({ repoRoot, blueprintDir, taskCommits }: {
  repoRoot: string;
  blueprintDir: string;
  taskCommits: TaskCommitEntry[];
}): boolean {
  const explainRel = `${toPosix(blueprintDir)}/explain.md`;
  const abs = path.join(repoRoot, explainRel);
  if (!fs.existsSync(abs)) return false;
  const { data, body } = readDoc(abs);
  if (!data || typeof data !== 'object') return false;
  const bouncer = asRecord(asRecord(data).bouncer);
  const epicId = bouncer.epic_id;
  const blueprintId = bouncer.blueprint_id;
  // collectTaskCommits가 걸러도 직접 호출이면 다른 Epic·Blueprint 행이
  // 들어온다. 부모 번호를 못 읽거나 다르면 새 행을 남기지 않는다.
  if (typeof epicId !== 'string' || typeof blueprintId !== 'string') {
    bouncer.task_commits = [];
  } else {
    bouncer.task_commits = taskCommits.flatMap((entry) => {
      const parts = taskStableParts(entry.task);
      if (!parts || parts.epicKey !== epicId || parts.blueprintKey !== blueprintId) return [];
      return [{
        task: entry.task,
        sha: entry.sha,
        intent_anchor: entry.intent_anchor,
      }];
    });
  }
  fs.writeFileSync(abs, renderDoc(data, body));
  return true;
}



/**
 * task 문서에서 장기 보존할 설계 절만 렌더링한다.
 * parseTasksSections가 반환한 본문을 그대로 사용해 작성자가 나눈 줄바꿈을
 * 보존한다. Do not touch·Checklist·verification·review는 실행 시점 범위
 * 통제·절차라서 여기 넣지 않는다 — Git history와 삭제된 task 원문이 정본이다.
 * Current/Target은 값이 있을 때만 넣어 legacy task에 두 절을 요구하지 않는다.
 * 제목은 frontmatter로 stable ID를 만들 수 있으면 `### EPIC-…/BP-…/TASK-…`(번호 경로) 또는
 * `### <epic-slug>/<bp-slug>/NNN`(slug 경로)이고,
 * `commits`에 그 ID의 sha8이 있으면 ` · \`sha8\``을 붙인다. 못 만들면 기존
 * `### Task NNN`으로 폴백한다.
 *
 * @param {TaskUnitLike[] | undefined} taskUnits - Blueprint의 task 묶음
 * @param {Map<string, TrailerCommit>} [commits] - resolveTaskCommits 결과. 선택
 * @returns {string} Explain `## Tasks` 본문. 장기 절이 없으면 빈 문자열
 */
function buildTaskContext(
  taskUnits: TaskUnitLike[] | undefined,
  commits?: Map<string, TrailerCommit>,
): string {
  const units = (Array.isArray(taskUnits) ? taskUnits : [])
    .filter((unit) => unit && unit.tasks && typeof unit.tasks.body === 'string')
    .slice()
    .sort((a, b) => (typeof a.number === 'number' ? a.number : Infinity)
      - (typeof b.number === 'number' ? b.number : Infinity));
  const rendered: string[] = [];
  for (const unit of units) {
    const sections = parseTasksSections(unit.tasks && unit.tasks.body);
    // 순서는 Plan/intent 소비자가 기대하는 장기 allowlist와 같다.
    // doNotTouch는 의도적으로 빠진다 — 후속 금지는 Interface·Constraints에 적는다.
    const selected = [
      ['Goal & intent', sections.goal],
      ['Current behavior', sections.currentBehavior],
      ['Target behavior', sections.targetBehavior],
      ['Interface', sections.interface],
      ['Touch', sections.touch],
      ['Constraints', sections.constraints],
    ].filter(([, body]) => typeof body === 'string' && body.trim()) as Array<[string, string]>;
    if (!selected.length) continue;
    const stableId = stableIdFromTaskData(unit.tasks && unit.tasks.data);
    let heading: string;
    if (stableId) {
      const hit = commits && commits.get(stableId);
      const sha8 = hit && normalizeCommitSha(hit.sha8 || hit.sha);
      // SHA가 있으면 통합 commit을 제목에 남긴다. 없으면 ID만 — trailer 해석
      // 실패·미존재 시에도 제목 형식을 깨지 않기 위함.
      heading = sha8 ? `### ${stableId} · \`${sha8}\`` : `### ${stableId}`;
    } else {
      const number = typeof unit.number === 'number'
        ? String(unit.number).padStart(3, '0')
        : 'unknown';
      heading = `### Task ${number}`;
    }
    rendered.push(
      [heading, ...selected.flatMap(([h, body]) => [
        `#### ${h}`,
        body,
      ])].join('\n\n'),
    );
  }
  return rendered.length ? `## Tasks\n\n${rendered.join('\n\n')}\n` : '';
}



function replaceTaskContext(body: string, taskContext: string): string {
  if (!taskContext) return body;
  const lines = body.split('\n');
  const start = lines.findIndex((line) => /^##\s+Tasks\s*$/i.test(line.trim()));
  if (start < 0) return `${body.replace(/\s*$/, '')}\n\n${taskContext}`;
  let end = start + 1;
  while (end < lines.length && !/^##\s+\S/.test(lines[end].trim())) end += 1;
  return [...lines.slice(0, start), taskContext.trimEnd(), ...lines.slice(end)].join('\n');
}



function writeExplainTaskContext({ repoRoot, blueprintDir, taskContext }: {
  repoRoot: string;
  blueprintDir: string;
  taskContext: string;
}): boolean {
  if (!taskContext) return false;
  const explainRel = `${toPosix(blueprintDir)}/explain.md`;
  const abs = path.join(repoRoot, explainRel);
  if (!fs.existsSync(abs)) return false;
  const { data, body } = readDoc(abs);
  if (!data || typeof data !== 'object' || typeof body !== 'string') return false;
  fs.writeFileSync(abs, renderDoc(data, replaceTaskContext(body, taskContext)));
  return true;
}


export = { writeExplainTaskCommits, buildTaskContext, writeExplainTaskContext };
