'use strict';

const assert = require('node:assert/strict');
const { readFileSync } = require('node:fs');
const path = require('node:path');
const test = require('node:test');

/**
 * Dockerfile 본문을 `FROM … AS <name>` 단계 이름으로 나눈다.
 * 로그인 셸 PATH 수정이 bouncer 이미지에만 있는지 보려면 단계 경계를
 * 지시문 파서가 아니라 FROM 줄로 잘라야 다른 타깃으로 새지 않는다.
 *
 * @param {string} dockerfile - Dockerfile 전체 텍스트
 * @returns {Record<string, string>} AS 이름 → 해당 단계 본문(FROM 줄 포함)
 */
function splitStages(dockerfile) {
  const stages = {};
  let currentName = null;
  const chunks = [];
  for (const line of dockerfile.split('\n')) {
    const from = line.match(/^FROM\s+\S+(?:\s+AS\s+(\S+))?/i);
    if (from) {
      if (currentName !== null) {
        stages[currentName] = chunks.join('\n');
      }
      currentName = from[1] || 'unnamed';
      chunks.length = 0;
      chunks.push(line);
      continue;
    }
    if (currentName !== null) {
      chunks.push(line);
    }
  }
  if (currentName !== null) {
    stages[currentName] = chunks.join('\n');
  }
  return stages;
}

test('bouncer stage registers plugin scripts on login and non-login bash PATH', () => {
  const dockerfile = readFileSync(path.join(__dirname, 'docker', 'Dockerfile.cursor'), 'utf8');
  const stages = splitStages(dockerfile);
  const cursorBaseStage = stages['cursor-base'];
  const vanillaStage = stages.vanilla;
  const pluginBuildStage = stages['plugin-build'];
  const bouncerStage = stages.bouncer;
  const verifierStage = stages.verifier;
  assert.ok(bouncerStage, 'bouncer stage must exist');

  const exportLine = 'export PATH="/home/node/.cursor/plugins/local/bouncer/scripts:/home/node/.local/bin:$PATH"';
  // bouncer 단계: profile.d는 root RUN 하나, bashrc는 node가 덧붙임
  assert.ok(bouncerStage.includes(`'${exportLine}' > /etc/profile.d/bouncer-path.sh`));
  assert.ok(bouncerStage.includes(`'${exportLine}' >> /home/node/.bashrc`));
  const lines = bouncerStage.split('\n');
  const rootAt = lines.findIndex((l) => /^USER root\b/.test(l));
  assert.match(lines[rootAt + 1], /^RUN .*bouncer-path\.sh/);
  assert.match(lines[rootAt + 2], /^USER node\b/);
  assert.strictEqual(lines.filter((l) => /^USER root\b/.test(l)).length, 1);
  assert.ok(lines.findIndex((l) => /bouncer-root --auto/.test(l)) > rootAt + 2);
  // 나머지 단계에는 bouncer 경로가 없다
  for (const stage of [cursorBaseStage, vanillaStage, pluginBuildStage, verifierStage]) {
    assert.doesNotMatch(stage, /bouncer-path|plugins\/local\/bouncer\/scripts:/);
  }
});
