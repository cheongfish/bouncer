'use strict';

import frontmatter = require('./frontmatter');
const { parseFrontmatter } = frontmatter;
import approvalSnapshot = require('./approval-snapshot');
const { sha256Canonical } = approvalSnapshot;

const LIFECYCLE_KEYS = ['status', 'commit_sha'];

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && Array.isArray(value) === false;
}

/**
 * task brief의 canonical SHA-256을 계산한다.
 * dispatch·record·intent bundle이 같은 값을 써야, commit이 `status`/`commit_sha`만
 * 찍거나 YAML을 다시 써도 stale-worker-report가 나지 않는다. 본문이나 그 외
 * frontmatter가 바뀌면 해시도 바뀐다.
 *
 * js-yaml은 따옴표 없는 날짜를 Date로 읽는다. canonicalJson은 Date를 객체로
 * 보고 `{}`로 접으므로, 해시 직전에 JSON 왕복으로 ISO 문자열로 고정한다.
 *
 * @param {string} markdown - tasks.md 전체 텍스트(UTF-8)
 * @returns {string} 64자리 소문자 hex
 */
function taskBriefHash(markdown: string): string {
  const parsed = parseFrontmatter(markdown);
  // 1. 입력 data를 깊은 복사한 뒤에만 lifecycle 키를 지운다. parseFrontmatter
  //    결과를 직접 delete하면 같은 객체를 쥔 호출자가 status를 잃는다.
  const data = structuredClone(parsed.data);
  if (isRecord(data) && isRecord(data.bouncer)) {
    for (const key of LIFECYCLE_KEYS) {
      delete data.bouncer[key];
    }
  }
  // 2. Date → ISO 문자열. 같은 날짜 값이 YAML 인용만 달라도 같은 해시가 된다.
  return sha256Canonical(JSON.parse(JSON.stringify({ data, body: parsed.body })));
}

export = { taskBriefHash, LIFECYCLE_KEYS };
