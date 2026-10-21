'use strict';
import commands = require('./coordinator-commands');

// 공개 이름은 명령 API 셋뿐이다. helper는 정본 모듈(coordinator-ledger·coordinator-worker·
// execution-dag 등)에서 직접 가져온다 — 호환용 재export를 두면 경계가 다시 넓어진다.
export = {
  coordinate: commands.coordinate,
  COORDINATE_FAILURE_HINTS: commands.COORDINATE_FAILURE_HINTS,
  withCoordinateFailureHints: commands.withCoordinateFailureHints,
};
