'use strict';
const { readRuntimeCurrent, writeRuntimeCurrent } = require('./runtime-state');

function readCurrent({ repoRoot, deps }) {
  return readRuntimeCurrent({ repoRoot, deps });
}

function writeCurrent({
  repoRoot, blueprint, base, deps,
}) {
  return writeRuntimeCurrent({
    repoRoot, blueprint, base, deps,
  });
}

module.exports = { readCurrent, writeCurrent };
