'use strict';
import commands = require('./coordinator-commands');

// 공개 이름은 소비자와의 호환 경계다. 구현 모듈을 통해 내보내야 기존 import 계약을 유지한다.
export = {
  readyWave: commands.readyWave,
  transition: commands.transition,
  coordinate: commands.coordinate,
  loadLedger: commands.loadLedger,
  loadLedgerBytes: commands.loadLedgerBytes,
  readBouncerBlock: commands.readBouncerBlock,
  projectCheckpoint: commands.projectCheckpoint,
  assertLedgerFence: commands.assertLedgerFence,
  LEDGER_REL: commands.LEDGER_REL,
  COORDINATE_FAILURE_HINTS: commands.COORDINATE_FAILURE_HINTS,
  withCoordinateFailureHints: commands.withCoordinateFailureHints,
  registeredIntegration: commands.registeredIntegration,
  registeredWorker: commands.registeredWorker,
  ensureIntegrationCwd: commands.ensureIntegrationCwd,
  assertLeaseShape: commands.assertLeaseShape,
  isBlueprintReviewModeAt: commands.isBlueprintReviewModeAt,
  initialWorktreeState: commands.initialWorktreeState,
  taskBriefHashOf: commands.taskBriefHashOf,
  normalizeCommitSha: commands.normalizeCommitSha,
  reportPathFor: commands.reportPathFor,
  workerCommitEvidence: commands.workerCommitEvidence,
  workerScopeDirtyPaths: commands.workerScopeDirtyPaths,
};
