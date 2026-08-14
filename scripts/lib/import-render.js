'use strict';
Object.defineProperty(exports, "__esModule", { value: true });
const fs = require('node:fs');
const path = require('node:path');
const { renderDoc } = require('./render');
// 문서 본문 조립과 디스크 쓰기. 계획·거절 판정은 여기 두지 않는다 —
// 렌더가 거절을 알면 쓰기 직전에만 막히고, 그 앞의 부분 생성을 막지 못한다.
// import-history 를 require 하지 않는다(render → plan 순환 금지).
/** 임포트 epic 본문. Success criteria 헤딩은 context digest 화이트리스트라 넣지 않는다. */
function renderEpicBody(plan) {
    const lines = [
        `# ${plan.epicId} ${plan.epicName}`,
        '',
        '## Intent',
        `- Imported from git ${plan.source}${plan.fellBack ? ' (fell back from merges)' : ''}.`,
        `- ${plan.entries.length} blueprint(s) transcribed from history.`,
        '',
        '## Blueprints',
    ];
    for (const e of plan.entries) {
        const title = e.subject || e.slug;
        lines.push(`* [${e.blueprintId} ${e.slug}](blueprints/${e.blueprintDir}/index.md) - ${title}`);
    }
    lines.push('');
    return lines.join('\n');
}
function renderBlueprintBody(plan, entry) {
    const changeLines = entry.files.length
        ? entry.files.map((f) => `- ${f}`)
        : ['- (no files)'];
    return [
        `# ${entry.blueprintId} ${entry.slug}`,
        '',
        `Epic: [${plan.epicId}](../../index.md)`,
        '',
        '## Source',
        `- sha: \`${entry.sha}\``,
        `- date: ${entry.date}`,
        `- author: ${entry.author}`,
        '',
        '## Message',
        entry.subject || '(empty)',
        '',
        '## Changes',
        ...changeLines,
        '',
    ].join('\n');
}
function writeImportDoc(repoRoot, rel, data, body) {
    const abs = path.join(repoRoot, rel);
    fs.mkdirSync(path.dirname(abs), { recursive: true });
    fs.writeFileSync(abs, renderDoc(data, body));
    return rel;
}
module.exports = {
    renderEpicBody,
    renderBlueprintBody,
    writeImportDoc,
};
