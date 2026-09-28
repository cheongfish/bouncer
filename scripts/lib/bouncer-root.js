"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.runBouncerRoot = runBouncerRoot;
const node_fs_1 = __importDefault(require("node:fs"));
const plugin_root_1 = require("./plugin-root");
function runBouncerRoot(argv, io = {}) {
    const out = io.out ?? ((text) => process.stdout.write(text));
    const err = io.err ?? ((text) => process.stderr.write(text));
    let host;
    let select = false;
    for (let index = 0; index < argv.length; index += 1) {
        const flag = argv[index];
        if (flag === '--auto')
            continue;
        if (flag === '--select') {
            select = true;
            continue;
        }
        if (flag === '--host') {
            const parsedHost = (0, plugin_root_1.parseHost)(argv[index + 1]);
            if (!parsedHost) {
                err('bouncer-root: --host must be claude, codex, or antigravity\n');
                return 1;
            }
            host = parsedHost;
            index += 1;
            continue;
        }
        err(`bouncer-root: unknown argument: ${flag}\n`);
        return 1;
    }
    if (select) {
        if (!(io.isTTY ?? process.stdin.isTTY)) {
            err('bouncer-root: --select requires a TTY\n');
            return 1;
        }
        if ((io.env ?? process.env).BOUNCER_HOME !== undefined) {
            try {
                out(`${(0, plugin_root_1.resolvePluginRoot)(io, host ?? undefined).path}\n`);
                return 0;
            }
            catch (error) {
                err(`bouncer-root: ${error.message}\n`);
                return 1;
            }
        }
        const candidates = (0, plugin_root_1.findPluginCandidates)(io, host ?? undefined);
        if (!candidates.length) {
            err('bouncer-root: no valid Bouncer plugin roots found\n');
            return 1;
        }
        candidates.forEach((candidate, index) => err(`${index + 1}) ${candidate.path} (${candidate.version})\n`));
        const input = (io.readInput ?? (() => node_fs_1.default.readFileSync(0, 'utf8')))().trim();
        const selected = /^\d+$/.test(input) ? candidates[Number(input) - 1] : undefined;
        if (!selected) {
            err('bouncer-root: invalid selection\n');
            return 1;
        }
        out(`${selected.path}\n`);
        return 0;
    }
    try {
        out(`${(0, plugin_root_1.resolvePluginRoot)(io, host ?? undefined).path}\n`);
        return 0;
    }
    catch (error) {
        err(`bouncer-root: ${error.message}\n`);
        return 1;
    }
}
