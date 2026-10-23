'use strict';
import templates = require('./templates');
const { normalizeAuthoredLines, parseIntentBody } = templates;
import commitSha = require('./commit-sha');
const { buildStableProvenance } = commitSha;


// 정본은 validate-docs의 DocLeaf·TaskUnit이다. 소비자가 일부 필드만 채운 문서를 받으므로
// 정본에서 Partial·Pick으로 파생해 필드가 갈라지지 않게 한다(런타임 import 없이 type-only).
import type { DocLeaf, TaskUnit } from './validate-docs';
type DocLeafLike = Partial<DocLeaf>;


type TaskUnitLike = Partial<Record<'tasks' | 'verification' | 'review', DocLeafLike>>
  & Partial<Pick<TaskUnit, 'number'>> & { [key: string]: unknown };


type DocsLike = {
  // loadBlueprintDocs는 파싱 실패 시 blueprintIndex를 비울 수 있다. 필수 단언은
  // 소비자 캐스트가 가리던 불일치였고, 런타임은 asRecord(undefined)로 빈 subject 경로를 탄다.
  blueprintIndex?: { data: unknown; body?: string };
  tasks?: DocLeafLike;
  taskUnits?: TaskUnitLike[];
  [key: string]: unknown;
};



function asRecord(value: unknown): Record<string, unknown> {
  return value as Record<string, unknown>;
}



// subject와 body는 프로젝트가 document field에 쓰는 commit convention을 따름;
// 구조만 Bouncer 소유. identifier와 path는 제목·본문에 넣지 않음 — blueprint
// 문서와 PR body에 있다. 기계가 읽는 식별자는 메시지 끝 Git trailer 두 줄로만
// 붙인다. 본문에 섞으면 제목 규약과 충돌하고, trailer가 아니면 cherry-pick·
// explain 소비자가 같은 키를 찾지 못한다.
// Subject: 대상 task title (없으면 blueprint title). Body: task 문서가 저작한
// 배경·의도와 변경 요약. verification title은 실행 증적이지 메시지 저작물이
// 아니므로 사용하지 않는다. 새 필드가 없는 기존 task는 제목만으로 읽는다.
// commit 경로(`bouncer commit`)가 이 빌더를 쓴다. finalize 마감 메시지는
// buildFinalizeCommitMessage — task 문서 필드를 넣지 않는다.
function authoredContainsBouncerTrailer(lines: string[]): boolean {
  // Git trailer는 줄 앞의 정확한 키다. 문장 한가운데 언급이 아니라 저작 필드가
  // 이미 trailer 한 줄을 들고 있으면, 생성기가 같은 키를 또 붙여 중복이 된다.
  return lines.some((line) => /^(?:Bouncer-Task|Bouncer-Intent)\s*:/.test(line));
}



function buildCommitMessage(docs: DocsLike, taskUnit: TaskUnitLike | null | undefined): string {
  const bp = asRecord(docs.blueprintIndex && docs.blueprintIndex.data);
  const bouncer = asRecord(bp.bouncer || {});
  const type = bouncer.commit_type || 'feat';
  const taskTitle = taskUnit && taskUnit.tasks && taskUnit.tasks.data
    ? asRecord(taskUnit.tasks.data).title
    : undefined;
  // 대상 묶음이 없거나 title이 비면 blueprint로 떨어뜨려 빈 subject를 만들지 않음.
  const subjectTitle = (typeof taskTitle === 'string' && taskTitle.trim())
    ? taskTitle.trim()
    : bp.title;
  const taskData = taskUnit && taskUnit.tasks && taskUnit.tasks.data
    ? asRecord(taskUnit.tasks.data)
    : (docs.tasks && docs.tasks.data ? asRecord(docs.tasks.data) : {});
  const taskBouncer = taskData && taskData.bouncer && typeof taskData.bouncer === 'object'
    ? asRecord(taskData.bouncer)
    : {};
  const intent = normalizeAuthoredLines(taskBouncer.commit_intent, 'commit_intent');
  const summary = normalizeAuthoredLines(taskBouncer.commit_summary, 'commit_summary');
  const bodyLines = [...intent, ...summary];
  // 저작 필드가 이미 Bouncer trailer를 들고 있으면 한 줄을 더 붙여 키가 두 번
  // 나온다. Git trailer는 키당 한 줄이므로 중복을 지우지 않고 생성을 거절한다.
  if (authoredContainsBouncerTrailer(bodyLines)) {
    throw new Error(
      'commit message authored fields already contain a Bouncer-Task or Bouncer-Intent trailer',
    );
  }
  const provenance = buildStableProvenance({
    epicId: taskBouncer.epic_id,
    blueprintId: taskBouncer.blueprint_id,
    taskId: taskBouncer.id,
  });
  const body = bodyLines.map((t) => `- ${t}`);
  const lines = [`${type}: ${subjectTitle}`];
  if (body.length) lines.push('', ...body);
  // trailer는 본문과 빈 줄로 구분한다. subject만 있어도 같은 구분자를 써서
  // Git이 제목을 trailer 블록으로 붙이지 않게 한다.
  lines.push('', ...provenance.trailers);
  return lines.join('\n');
}



// finalize 마감 커밋: subject와 body 모두 blueprint에서 읽는다. Intent를
// 파싱할 수 없으면 task 일부를 주워 메시지를 만드는 대신 즉시 실패시킨다.
// task title·verification bullet을 넣으면 이미 남긴 task 커밋과 겹친다.
function buildFinalizeCommitMessage(docs: DocsLike): string {
  const bp = asRecord(docs.blueprintIndex && docs.blueprintIndex.data);
  const bouncer = asRecord(bp.bouncer || {});
  const type = bouncer.commit_type || 'feat';
  const intent = parseIntentBody(docs.blueprintIndex && docs.blueprintIndex.body);
  const body = intent.map((t) => `- ${t}`);
  const lines = [`${type}: ${bp.title}`];
  if (body.length) lines.push('', ...body);
  return lines.join('\n');
}


export = { buildCommitMessage, buildFinalizeCommitMessage };
