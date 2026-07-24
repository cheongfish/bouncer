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

module.exports = { GENERIC_SKILLS, readSkill, readAllGenericSkills };
