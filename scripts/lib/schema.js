'use strict';

const OKF_REQUIRED = ['type', 'title', 'description', 'resource', 'tags', 'timestamp'];

const TYPES = [
  'sdd.epic',
  'sdd.blueprint',
  'sdd.tasks',
  'sdd.verification',
  'sdd.review',
  'sdd.distill',
];

const ID_PREFIX = {
  'sdd.epic': 'EPIC-',
  'sdd.blueprint': 'BP-',
  'sdd.tasks': 'TASKS-',
  'sdd.verification': 'VERIFY-',
  'sdd.review': 'REVIEW-',
  'sdd.distill': 'DISTILL-',
};

const STATUS_ENUM = {
  'sdd.epic': ['draft', 'approved', 'closed'],
  'sdd.blueprint': ['draft', 'approved', 'superseded'],
  'sdd.tasks': ['draft', 'ready', 'in_progress', 'verified'],
  'sdd.verification': ['pending', 'passed', 'failed'],
  'sdd.review': ['pending', 'requested', 'addressed', 'accepted'],
  'sdd.distill': ['draft', 'published'],
};

const KIND_TO_TYPE = {
  epic: 'sdd.epic',
  blueprint: 'sdd.blueprint',
  tasks: 'sdd.tasks',
  verification: 'sdd.verification',
  review: 'sdd.review',
  distill: 'sdd.distill',
};

module.exports = { OKF_REQUIRED, TYPES, ID_PREFIX, STATUS_ENUM, KIND_TO_TYPE };
