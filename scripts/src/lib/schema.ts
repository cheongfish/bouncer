'use strict';

const OKF_REQUIRED = ['type', 'title', 'description', 'resource', 'tags', 'timestamp'];

const TYPES = [
  'bouncer.epic',
  'bouncer.blueprint',
  'bouncer.tasks',
  'bouncer.verification',
  'bouncer.review',
  'bouncer.explain',
];

const ID_PREFIX = {
  'bouncer.epic': 'EPIC-',
  'bouncer.blueprint': 'BP-',
  'bouncer.tasks': 'TASKS-',
  'bouncer.verification': 'VERIFY-',
  'bouncer.review': 'REVIEW-',
  'bouncer.explain': 'EXPLAIN-',
};

const STATUS_ENUM = {
  'bouncer.epic': ['draft', 'approved', 'closed'],
  'bouncer.blueprint': ['draft', 'approved', 'superseded'],
  'bouncer.tasks': ['draft', 'ready', 'in_progress', 'verified'],
  'bouncer.verification': ['pending', 'passed', 'failed'],
  'bouncer.review': ['pending', 'requested', 'addressed', 'accepted'],
  'bouncer.explain': ['draft', 'published'],
};

const KIND_TO_TYPE = {
  epic: 'bouncer.epic',
  blueprint: 'bouncer.blueprint',
  tasks: 'bouncer.tasks',
  verification: 'bouncer.verification',
  review: 'bouncer.review',
  explain: 'bouncer.explain',
};

const LEGACY_GUIDANCE =
  'Legacy SDD format detected. Re-initialize with /bouncer-init (no automatic migration).';

function detectLegacyFormat({ repoRoot, data }: { repoRoot?: any; data?: any } = {}) {
  if (repoRoot) {
    const fs = require('node:fs');
    const path = require('node:path');
    if (fs.existsSync(path.join(repoRoot, '.sdd'))) {
      return { legacy: true, reason: LEGACY_GUIDANCE };
    }
  }
  if (data && typeof data === 'object') {
    if (Object.prototype.hasOwnProperty.call(data, 'sdd')) {
      return { legacy: true, reason: LEGACY_GUIDANCE };
    }
    if (typeof data.type === 'string' && data.type.startsWith('sdd.')) {
      return { legacy: true, reason: LEGACY_GUIDANCE };
    }
  }
  return { legacy: false };
}

module.exports = {
  OKF_REQUIRED, TYPES, ID_PREFIX, STATUS_ENUM, KIND_TO_TYPE,
  LEGACY_GUIDANCE, detectLegacyFormat,
};
