'use strict';

import canonicalJsonMod = require('./canonical-json');
const { sha256Canonical } = canonicalJsonMod;
import guards = require('./guards');
const { isRecord } = guards;
const path = require('node:path');

import tasksDocs = require('./tasks-docs');
const { listTasksDocs } = tasksDocs;
import frontmatter = require('./frontmatter');
const { readDoc } = frontmatter;
import config = require('./config');
const { readVerifyPolicy } = config;
import paths = require('./paths');
const { toPosix } = paths;

type ApprovalTask = {
  id: string;
  affected_paths: unknown;
  verify: string | null;
};

type ApprovalDigest = {
  digest: string;
  parts: Record<string, string>;
};

function bouncerOf(data: unknown): Record<string, unknown> {
  if (!isRecord(data) || !isRecord(data.bouncer)) return {};
  return data.bouncer;
}

/**
 * tasks.md frontmatter에서 승인 범위에 넣는 세 필드만 고른다.
 * verify는 원본 문자열만 쓴다 — `readVerifyCommand`의 config 폴백을 넣으면
 * 문서가 안 바뀌었는데도 allowlist·기본 verify 변경이 task.verify 항목으로 위장된다.
 *
 * @param {{ rel: string, id: string | null }} entry - listTasksDocs 엔트리
 * @param {string} repoRoot - 저장소 루트 절대 경로
 * @returns {{ id: string, affected_paths: unknown, verify: string | null }} id순 정렬에 쓸 task 레코드
 */
function taskFromEntry(entry: { rel: string; id: string | null }, repoRoot: string): ApprovalTask {
  const { data } = readDoc(path.join(repoRoot, entry.rel));
  const bouncer = bouncerOf(data);
  const id = typeof bouncer.id === 'string' && bouncer.id
    ? bouncer.id
    : (typeof entry.id === 'string' && entry.id ? entry.id : 'TASKS-unknown');
  const affected_paths = Object.prototype.hasOwnProperty.call(bouncer, 'affected_paths')
    ? bouncer.affected_paths
    : [];
  const verify = typeof bouncer.verify === 'string' ? bouncer.verify : null;
  return { id, affected_paths, verify };
}

/**
 * blueprint의 승인 digest와 항목별 digest를 계산한다.
 * 게이트 G24와 `current --set`이 같은 hex를 써야 활성화 직후 대조가 어긋나지 않는다.
 *
 * @param {{ repoRoot: string, blueprintDir: string }} opts - 저장소 루트와 blueprint 상대 경로
 * @returns {{ digest: string, parts: Record<string, string> }}
 *   `digest`는 `{ tasks, verify_allowlist }`의 sha256Canonical.
 *   `parts`는 `TASKS-NNN.affected_paths`·`TASKS-NNN.verify`·`verify_allowlist`·`tasks`(id 목록)별 digest
 */
function computeApprovalDigest({ repoRoot, blueprintDir }: {
  repoRoot: string;
  blueprintDir: string;
}): ApprovalDigest {
  const listing = listTasksDocs({ repoRoot, blueprintDir: toPosix(blueprintDir) });
  const tasks = listing.entries
    .map((entry) => taskFromEntry(entry, repoRoot))
    .sort((left, right) => left.id.localeCompare(right.id));
  const policy = readVerifyPolicy(repoRoot);
  // invalid config는 기본 목록으로 넓히지 않는다. 파손된 allowlist를 통과시키면
  // 운영자가 막은 명령이 승인 스냅샷에 실려 G24가 침묵한다.
  const verify_allowlist = policy.ok === true ? [...policy.allowlist] : null;
  const parts: Record<string, string> = {
    tasks: sha256Canonical(tasks.map((task) => task.id)),
    verify_allowlist: sha256Canonical(verify_allowlist),
  };
  for (const task of tasks) {
    parts[`${task.id}.affected_paths`] = sha256Canonical(task.affected_paths);
    parts[`${task.id}.verify`] = sha256Canonical(task.verify);
  }
  return {
    digest: sha256Canonical({ tasks, verify_allowlist }),
    parts,
  };
}

const TASK_LEAF_RE = /^TASKS-\d{3}\.(affected_paths|verify)$/;

/**
 * 승인 파일 `parts`와 현재 `parts`에서 바뀐 항목 이름을 고른다.
 * task 추가·삭제로만 생긴 `TASKS-NNN.*` 키는 `tasks` 항목으로 대표한다 —
 * 같은 사건을 세 이름으로 나열하면 G24 메시지가 재승인 대상을 흐린다.
 *
 * @param {Record<string, string>} approved - 승인 파일의 parts
 * @param {Record<string, string>} current - 지금 계산한 parts
 * @returns {string[]} 사전순 항목 이름
 */
function diffApprovalParts(
  approved: Record<string, string>,
  current: Record<string, string>,
): string[] {
  const names = new Set([...Object.keys(approved), ...Object.keys(current)]);
  const changed: string[] = [];
  for (const name of [...names].sort()) {
    if (approved[name] === current[name]) continue;
    if (TASK_LEAF_RE.test(name)) {
      if (
        Object.prototype.hasOwnProperty.call(approved, name)
        && Object.prototype.hasOwnProperty.call(current, name)
      ) {
        changed.push(name);
      }
      continue;
    }
    changed.push(name);
  }
  return changed;
}

export = { computeApprovalDigest, diffApprovalParts, sha256Canonical };
