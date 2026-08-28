'use strict';
const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.join(__dirname, '..', '..');
const GENERIC_SKILLS = [
  'discovery',
  'spec-authoring',
  'implementation',
  'debugging',
  'verification',
  'review',
  'minimality',
  'stop-slop',
];

// 호스가 스캔하는 skills/*/SKILL.md 카탈로그에서 뺀 보조 본문.
// readSkill은 이 집합만 references/<name>/index.md로 읽고, 공개 스킬은 기존 경로다.
const UNPUBLISHED_HELPERS = new Set([
  'discovery',
  'spec-authoring',
  'stop-slop',
  'graphify-runner',
  'minimality',
  'context-review',
  'implementation',
  'verification',
  'debugging',
  'review',
  'explain-diff',
]);

function readSkill(name) {
  if (UNPUBLISHED_HELPERS.has(name)) {
    return fs.readFileSync(
      path.join(ROOT, 'references', name, 'index.md'),
      'utf8',
    );
  }
  return fs.readFileSync(
    path.join(ROOT, 'skills', name, 'SKILL.md'),
    'utf8',
  );
}

function readAllGenericSkills() {
  return GENERIC_SKILLS.map(readSkill).join('\n');
}

// references는 실행 조건이 맞을 때만 읽히지만, 계약 테스트는 workflow 전체를
// 검증해야 한다. git 추적 여부가 아니라 실제 디렉터리를 읽어 새 reference가
// 생성 직후에도 누락으로 오판하지 않도록 한다.
function readWorkflowBundle(name) {
  const skillDir = path.join(ROOT, 'skills', name);
  const skill = fs.readFileSync(path.join(skillDir, 'SKILL.md'), 'utf8');
  const referencesDir = path.join(skillDir, 'references');
  if (!fs.existsSync(referencesDir)) return skill;

  const references = fs.readdirSync(referencesDir)
    .filter((entry) => entry.endsWith('.md'))
    .sort()
    .map((entry) => fs.readFileSync(path.join(referencesDir, entry), 'utf8'));
  return [skill, ...references].join('\n');
}

module.exports = {
  GENERIC_SKILLS,
  UNPUBLISHED_HELPERS,
  readSkill,
  readAllGenericSkills,
  readWorkflowBundle,
};
