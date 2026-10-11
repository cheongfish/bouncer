'use strict';

const { mkdirSync, writeFileSync } = require('node:fs');
const path = require('node:path');

/**
 * 답하지 못한 텍스트 질문을 run 디렉터리에 fixture 스텁으로 보관한다.
 * 파일 번호는 `unanswered` 배열 순서(두 자리)라서 host `params` 항목이 섞이면 번호에 빈 칸이 생기지만,
 * `decisions.json`의 항목 위치와 1:1로 대응해야 사람이 원본을 되짚을 수 있다.
 * `expect: null`은 TASKS-001 재생 루프가 실패로 처리하므로 사람이 저장소 fixture로 옮길 때
 * `answer`/`violation`을 정해야 한다. 텍스트 항목이 없으면 디렉터리를 만들지 않는다.
 *
 * @param {string} runDir - stage run 디렉터리 절대 경로
 * @param {{ source: string, phase: string, unanswered: object[] }} input - source는 run 기준 상대 경로, phase는 stage 이름, unanswered는 decisions.json의 미답 목록
 * @returns {string[]} 쓴 파일 경로 목록(`NN.md`들과 `cases.json`). 텍스트 항목이 없으면 빈 배열
 */
function writeUnansweredFixtures(runDir, { source, phase, unanswered }) {
  const entries = unanswered.map((entry, index) => ({ entry, number: String(index + 1).padStart(2, '0') }))
    .filter(({ entry }) => typeof entry.text === 'string' && entry.text);
  if (!entries.length) return [];
  const dir = path.join(runDir, 'unanswered');
  mkdirSync(dir, { recursive: true });
  const written = [];
  const cases = entries.map(({ entry, number }) => {
    const file = path.join(dir, `${number}.md`);
    writeFileSync(file, entry.text);
    written.push(file);
    const stub = { file: `${number}.md`, source, phase, workdir: {}, reply: null, gates: [], expect: null, method: entry.method };
    if (entry.reason) stub.reason = entry.reason;
    return stub;
  });
  const casesFile = path.join(dir, 'cases.json');
  writeFileSync(casesFile, JSON.stringify(cases, null, 2) + '\n');
  written.push(casesFile);
  return written;
}

module.exports = { writeUnansweredFixtures };
