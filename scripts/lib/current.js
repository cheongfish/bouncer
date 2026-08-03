'use strict';
Object.defineProperty(exports, "__esModule", { value: true });
const { readRuntimeCurrent, writeRuntimeCurrent, clearRuntimeCurrent } = require('./runtime-state');
function readCurrent({ repoRoot, deps }) {
    return readRuntimeCurrent({ repoRoot, deps });
}
function writeCurrent({ repoRoot, blueprint, base, deps, }) {
    return writeRuntimeCurrent({
        repoRoot, blueprint, base, deps,
    });
}
function clearCurrent({ repoRoot, deps }) {
    return clearRuntimeCurrent({ repoRoot, deps });
}
module.exports = { readCurrent, writeCurrent, clearCurrent };
