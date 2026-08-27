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

function readSkill(name) {
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

module.exports = { GENERIC_SKILLS, readSkill, readAllGenericSkills, readWorkflowBundle };
