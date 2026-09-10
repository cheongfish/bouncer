'use strict';
const fs = require('node:fs');
const path = require('node:path');
const { execFileSync: realExecFileSync } = require('node:child_process');
const runtime = require("./runtime-state");
const { coordinatorPathsFor, runtimePaths } = runtime;
const seed = require("./seed-worktree");
const { seedCoordinatorWorker } = seed;
const frontmatter = require("./frontmatter");
const { parseFrontmatter, readDoc } = frontmatter;
const render = require("./render");
const { renderDoc } = render;
const schema = require("./schema");
const { executionKindOf } = schema;
const tasksDocs = require("./tasks-docs");
const { listTasksDocs } = tasksDocs;
function readyWave(tasks) {
    const ready = tasks.filter((task) => (task.status || 'pending') === 'pending'
        && (task.depends_on || []).every((id) => {
            const predecessor = tasks.find((other) => other.id === id);
            // successor가 요구한 gate를 predecessor status와 그대로 비교한다. gate는
            // integrated 하나뿐이므로 종단에 닿지 않은 predecessor는 successor를 열지 않는다.
            return predecessor?.status === (task.dependency_gate || 'integrated');
        })).sort((a, b) => a.id.localeCompare(b.id));
    const sequential = ready.find((task) => task.parallel_safe === false);
    return sequential ? [sequential.id] : ready.map((task) => task.id);
}
/**
 * 실행 종류별 coordinator 상태 전이를 검증한다. verification은 worker·SHA를
 * 만들지 않으므로 commit 전이와 교차할 수 없다.
 *
 * @param {string} from - 현재 ledger 상태
 * @param {string} to - 요청한 다음 상태
 * @param {'commit' | 'verification'} [executionKind] - 부재면 기존 commit 전이
 * @returns {string} 허용된 다음 상태
 */
function transition(from, to, executionKind = 'commit') {
    const allowed = executionKind === 'verification'
        ? { pending: ['ready'], ready: ['verifying'], verifying: ['integrated'] }
        : { pending: ['ready'], ready: ['prepared'], prepared: ['recorded'], recorded: ['integrated'] };
    if (!(allowed[from] || []).includes(to))
        throw new Error(`illegal state transition: ${from} -> ${to}`);
    return to;
}
function atomicWrite(file, data) {
    fs.mkdirSync(path.dirname(file), { recursive: true });
    const temporary = `${file}.${process.pid}.tmp`;
    fs.writeFileSync(temporary, `${JSON.stringify(data, null, 2)}\n`);
    fs.renameSync(temporary, file);
}
function loadLedger(file) {
    if (!fs.existsSync(file))
        return null;
    return JSON.parse(fs.readFileSync(file, 'utf8'));
}
function git(exec, cwd, args) {
    return String(exec('git', args, { cwd, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] })).trim();
}
function sourceStatus(exec, cwd) {
    // worktree 등록 대상은 source가 아니며, 프로젝트 .gitignore가 아직 없는
    // bootstrap fixture에서도 porcelain에 나타난다. 그 한 경로만 제외한다.
    return git(exec, cwd, ['status', '--porcelain']).split('\n')
        .filter((line) => !line.slice(3).startsWith('.worktrees/')).join('\n');
}
function workerOwnsSha(exec, workerPath, sha) {
    try {
        // SHA 문자열만 ledger에 넣으면 다른 worktree commit도 fan-in될 수 있다. worker
        // HEAD의 조상인지 Git에 묻고, 얕은 clone/삭제된 object 같은 오류도 거절한다.
        git(exec, workerPath, ['merge-base', '--is-ancestor', sha, 'HEAD']);
        return true;
    }
    catch (_error) {
        return false;
    }
}
function taskList(repoRoot, blueprint) {
    const listing = listTasksDocs({ repoRoot, blueprintDir: blueprint });
    return listing.entries.map((entry) => {
        const id = String(entry.number).padStart(3, '0');
        const file = path.join(repoRoot, entry.tasks.rel);
        const source = fs.existsSync(file) ? fs.readFileSync(file, 'utf8') : '';
        const data = parseFrontmatter(source).data;
        const bouncer = data && typeof data.bouncer === 'object' && data.bouncer ? data.bouncer : {};
        const rawDependencies = Array.isArray(bouncer.depends_on) ? bouncer.depends_on : [];
        const depends_on = rawDependencies.map((value) => String(value).replace(/^TASKS-/, '')).filter((value) => /^\d{3}$/.test(value));
        // task metadata의 정본은 bouncer 아래다. absence를 병렬 허용으로 바꾸면
        // 오래된 문서가 의도치 않게 같은 wave로 열리므로 명시 true만 허용한다.
        const execution_kind = entry.executionKind || executionKindOf(bouncer) || 'commit';
        return { id, depends_on, execution_kind,
            dependency_gate: typeof bouncer.dependency_gate === 'string' ? bouncer.dependency_gate : 'integrated',
            parallel_safe: bouncer.parallel_safe === true, status: 'pending' };
    });
}
/**
 * integration checkout에 terminal node의 문서와 검증 정책을 준비한다.
 * worker 전체 blueprint seed와 달리 아직 실행되지 않은 해당 bundle만 덮어써,
 * 이미 fan-in된 predecessor 증적을 되돌리지 않는다. config는 destination이
 * 없을 때만 복사해 integration checkout의 기존 정책을 보존한다.
 *
 * @param {string} repoRoot - 승인된 plan 문서가 있는 기준 checkout
 * @param {string} integrationPath - 검증을 실행할 integration checkout
 * @param {string} blueprint - blueprint 저장소 상대 경로
 * @param {string} taskId - 세 자리 terminal task 번호
 * @returns {{ ok: true } | { ok: false; reason: string; message?: string }} 준비 결과
 */
function seedVerificationNode(repoRoot, integrationPath, blueprint, taskId) {
    const rel = path.join(blueprint, 'tasks', taskId);
    const source = path.join(repoRoot, rel);
    if (!fs.existsSync(source))
        return { ok: false, reason: 'missing-verification-bundle' };
    try {
        fs.mkdirSync(path.dirname(path.join(integrationPath, rel)), { recursive: true });
        fs.cpSync(source, path.join(integrationPath, rel), { recursive: true, force: true });
        const configRel = path.join('.bouncer', 'config.json');
        const sourceConfig = path.join(repoRoot, configRel);
        const targetConfig = path.join(integrationPath, configRel);
        if (!fs.existsSync(targetConfig) && fs.existsSync(sourceConfig)) {
            fs.mkdirSync(path.dirname(targetConfig), { recursive: true });
            fs.copyFileSync(sourceConfig, targetConfig);
        }
        return { ok: true };
    }
    catch (error) {
        return { ok: false, reason: 'copy-failed', message: error.message };
    }
}
/**
 * verification task 문서 상태를 runner 증적과 같은 checkout에 기록한다.
 * 실패 실행은 verifying을 유지하고 성공만 integrated로 올린다.
 *
 * @param {string} integrationPath - integration checkout 절대 경로
 * @param {string} blueprint - blueprint 상대 경로
 * @param {string} taskId - 세 자리 task 번호
 * @param {'verifying' | 'integrated'} status - 기록할 lifecycle 상태
 * @returns {void}
 */
function writeVerificationTaskStatus(integrationPath, blueprint, taskId, status) {
    const file = path.join(integrationPath, blueprint, 'tasks', taskId, 'tasks.md');
    const doc = readDoc(file);
    const data = doc.data;
    const bouncer = data.bouncer;
    bouncer.status = status;
    fs.writeFileSync(file, renderDoc(data, doc.body));
}
function registeredWorker(exec, integrationPath, workerPath) {
    try {
        const canonicalWorker = fs.realpathSync(workerPath);
        // direct symlink worktree paths are not stable assignment boundaries even
        // when their eventual target happens to be a registered checkout.
        if (canonicalWorker !== path.resolve(workerPath))
            return false;
        const workerRoot = fs.realpathSync(path.dirname(workerPath));
        const relative = path.relative(workerRoot, canonicalWorker);
        if (relative === '' || relative.startsWith(`..${path.sep}`) || path.isAbsolute(relative))
            return false;
        const registered = git(exec, integrationPath, ['worktree', 'list', '--porcelain'])
            .split('\n').filter((line) => line.startsWith('worktree ')).map((line) => line.slice('worktree '.length));
        return registered.some((entry) => fs.realpathSync(entry) === canonicalWorker);
    }
    catch (_error) {
        return false;
    }
}
function registeredIntegration(exec, repoRoot, integrationPath) {
    try {
        const canonicalIntegration = fs.realpathSync(integrationPath);
        // integration은 ledger와 fan-in Git 명령의 기준 경계다. 경로 자체나 상위
        // 할당 경로가 symlink면 realpath 비교만으로 외부 checkout을 허용하게 된다.
        if (canonicalIntegration !== path.resolve(integrationPath))
            return false;
        const integrationRoot = fs.realpathSync(path.dirname(integrationPath));
        const relative = path.relative(integrationRoot, canonicalIntegration);
        if (relative === '' || relative.startsWith(`..${path.sep}`) || path.isAbsolute(relative))
            return false;
        const registered = git(exec, repoRoot, ['worktree', 'list', '--porcelain'])
            .split('\n').filter((line) => line.startsWith('worktree ')).map((line) => line.slice('worktree '.length));
        return registered.some((entry) => fs.realpathSync(entry) === canonicalIntegration);
    }
    catch (_error) {
        return false;
    }
}
function ensureIntegrationCwd(repoRoot, blueprint, cwd, task) {
    const paths = coordinatorPathsFor({ repoRoot, blueprint, task });
    const actual = fs.realpathSync(cwd);
    const allowed = fs.realpathSync(task ? paths.workerPath : paths.integrationPath);
    if (actual !== allowed)
        throw new Error('coordinate command must run in its assigned worktree');
    return paths;
}
function coordinate({ command, repoRoot, blueprint, cwd = repoRoot, task, sha, decision, deps = {} }) {
    const exec = deps.execFileSync || realExecFileSync;
    const main = runtimePaths({ repoRoot, execFileSync: exec });
    if (main.unavailable)
        return { ok: false, reason: 'non-git-root' };
    const base = git(exec, repoRoot, ['rev-parse', 'HEAD']);
    const paths = coordinatorPathsFor({ repoRoot, blueprint, task });
    if (command === 'bootstrap') {
        if (path.resolve(repoRoot) !== path.resolve(main.projectRoot)) {
            return { ok: false, reason: 'bootstrap-requires-main-checkout' };
        }
        const before = sourceStatus(exec, repoRoot);
        if (!fs.existsSync(paths.integrationPath)) {
            fs.mkdirSync(path.dirname(paths.integrationPath), { recursive: true });
            // argv 호출만 사용해 branch 이름과 경로가 shell 해석으로 새지 않게 한다.
            const epicId = path.basename(path.dirname(path.dirname(paths.integrationPath)));
            const integrationId = path.basename(path.dirname(paths.integrationPath));
            git(exec, repoRoot, ['worktree', 'add', '-b', `bouncer/${epicId}-${integrationId}-integration`,
                paths.integrationPath, 'HEAD']);
        }
        if (sourceStatus(exec, repoRoot) !== before)
            return { ok: false, reason: 'main-source-mutated' };
        if (!registeredIntegration(exec, repoRoot, paths.integrationPath)) {
            return { ok: false, reason: 'unassigned-integration-worktree', integrationPath: paths.integrationPath };
        }
        const ledger = loadLedger(paths.ledgerFile) || {
            version: 1, blueprint, base,
            integrationHead: git(exec, paths.integrationPath, ['rev-parse', 'HEAD']),
            tasks: taskList(repoRoot, blueprint), decisions: [],
        };
        atomicWrite(paths.ledgerFile, ledger);
        return {
            ok: true, command, integrationPath: paths.integrationPath, ready: readyWave(ledger.tasks),
            tasks: ledger.tasks, decisions: ledger.decisions,
        };
    }
    const integration = coordinatorPathsFor({ repoRoot, blueprint });
    if (!registeredIntegration(exec, repoRoot, integration.integrationPath)) {
        return { ok: false, reason: 'unassigned-integration-worktree', integrationPath: integration.integrationPath };
    }
    const ledger = loadLedger(integration.ledgerFile);
    if (!ledger)
        return { ok: false, reason: 'missing-ledger' };
    if (command === 'status') {
        ensureIntegrationCwd(repoRoot, blueprint, cwd);
        return { ok: true, command, ready: readyWave(ledger.tasks), tasks: ledger.tasks, decisions: ledger.decisions };
    }
    if (command === 'prepare') {
        ensureIntegrationCwd(repoRoot, blueprint, cwd);
        const ready = readyWave(ledger.tasks);
        for (const id of ready) {
            const item = ledger.tasks.find((x) => x.id === id);
            if (item.execution_kind === 'verification') {
                const seeded = seedVerificationNode(repoRoot, integration.integrationPath, blueprint, id);
                if (!seeded.ok)
                    return seeded;
                item.status = transition(item.status || 'pending', 'ready', 'verification');
                continue;
            }
            const worker = coordinatorPathsFor({ repoRoot, blueprint, task: id }).workerPath;
            if (!fs.existsSync(worker)) {
                fs.mkdirSync(path.dirname(worker), { recursive: true });
                const integrationId = path.basename(path.dirname(integration.integrationPath));
                const epicId = path.basename(path.dirname(path.dirname(integration.integrationPath)));
                git(exec, integration.integrationPath, ['worktree', 'add', '-b', `bouncer/${epicId}-${integrationId}-${id}`, worker, 'HEAD']);
            }
            if (!registeredWorker(exec, integration.integrationPath, worker)) {
                return { ok: false, reason: 'unassigned-worker-worktree', workerPath: worker };
            }
            const seeded = seedCoordinatorWorker({ repoRoot, blueprintDir: blueprint, worktreePath: worker });
            if (!seeded.ok)
                return seeded;
            item.status = transition(item.status || 'pending', 'ready');
            item.status = transition(item.status, 'prepared');
            item.workerPath = worker;
        }
        atomicWrite(integration.ledgerFile, ledger);
        return { ok: true, command, ready, tasks: ledger.tasks, decisions: ledger.decisions };
    }
    if (!task || !/^\d{3}$/.test(task))
        return { ok: false, reason: 'task-required' };
    const item = ledger.tasks.find((x) => x.id === task);
    if (!item)
        return { ok: false, reason: 'task-outside-blueprint' };
    if (command === 'record') {
        // record는 worker가 만든 SHA와 provenance를 ledger로 올리는 경계다. integration
        // checkout에서 다시 worker 경계를 요구하면 어떤 정상 worker도 기록할 수 없다.
        const worker = coordinatorPathsFor({ repoRoot, blueprint, task }).workerPath;
        // prepare 뒤에도 경로 치환은 가능하다. ledger에 저장한 문자열과 Git 등록을 둘 다
        // 다시 확인해야 symlink가 외부 checkout의 HEAD를 provenance로 기록할 수 없다.
        if (item.workerPath !== worker || !registeredWorker(exec, integration.integrationPath, worker)) {
            return { ok: false, reason: 'unassigned-worker-worktree', workerPath: worker };
        }
        ensureIntegrationCwd(repoRoot, blueprint, cwd, task);
        if ((item.status || 'pending') !== 'prepared')
            return { ok: false, reason: 'illegal-transition' };
        const workerHead = git(exec, cwd, ['rev-parse', 'HEAD']);
        // record 시점의 HEAD만 허용한다. caller가 임의 SHA를 주장하거나 worker가
        // 다른 commit을 향한 뒤의 값을 기록하면 coordinator provenance가 무너진다.
        if (sha && sha !== workerHead)
            return { ok: false, reason: 'sha-not-worker-head' };
        item.status = transition('prepared', 'recorded');
        item.sha = workerHead;
        if (decision !== undefined) {
            item.decisions = [...(item.decisions || []), decision];
            ledger.decisions.push({ task, decision });
        }
        atomicWrite(integration.ledgerFile, ledger);
        return { ok: true, command, task: item, decisions: ledger.decisions };
    }
    if (command === 'integrate') {
        ensureIntegrationCwd(repoRoot, blueprint, cwd);
        if (item.execution_kind === 'verification') {
            if (item.status !== 'ready')
                return { ok: false, reason: 'not-ready' };
            item.status = transition('ready', 'verifying', 'verification');
            writeVerificationTaskStatus(integration.integrationPath, blueprint, task, 'verifying');
            atomicWrite(integration.ledgerFile, ledger);
            // 실패 증적도 verification.md에 남겨야 하므로 runner 결과를 먼저 기록한다.
            // 성공한 경우에만 integrated로 올려 실패 CI가 fan-in 완료로 보이지 않게 한다.
            // verification → current → coordinator 순환을 피하려고 실제 실행 직전에만
            // runner를 로드한다. 테스트 주입도 같은 최소 계약을 따른다.
            const runner = deps.runVerification
                || require('./verification').runVerification;
            const result = runner({ repoRoot: integration.integrationPath, blueprintDir: blueprint });
            if (!result.ok)
                return { ok: false, reason: 'verification-failed', task: item, verification: result };
            item.status = transition('verifying', 'integrated', 'verification');
            writeVerificationTaskStatus(integration.integrationPath, blueprint, task, 'integrated');
            atomicWrite(integration.ledgerFile, ledger);
            return { ok: true, command, task: item, verification: result,
                ready: readyWave(ledger.tasks), decisions: ledger.decisions };
        }
        if (item.status !== 'recorded' || !item.sha)
            return { ok: false, reason: 'not-recorded' };
        const worker = coordinatorPathsFor({ repoRoot, blueprint, task }).workerPath;
        // fan-in도 worker SHA를 읽고 ledger를 갱신하는 write 경계다. record 이후의
        // symlink/ledger 경로 치환을 여기서 막아야 외부 commit을 cherry-pick하지 않는다.
        if (item.workerPath !== worker || !registeredWorker(exec, integration.integrationPath, worker)
            || !workerOwnsSha(exec, worker, item.sha)) {
            return { ok: false, reason: 'sha-not-owned-by-worker' };
        }
        if (ledger.integrationHead !== git(exec, integration.integrationPath, ['rev-parse', 'HEAD'])) {
            return { ok: false, reason: 'stale-integration-head' };
        }
        git(exec, integration.integrationPath, ['cherry-pick', item.sha]);
        item.status = transition('recorded', 'integrated');
        ledger.integrationHead = git(exec, integration.integrationPath, ['rev-parse', 'HEAD']);
        atomicWrite(integration.ledgerFile, ledger);
        return { ok: true, command, task: item, ready: readyWave(ledger.tasks), decisions: ledger.decisions };
    }
    return { ok: false, reason: 'unknown-coordinate-command' };
}
module.exports = { readyWave, transition, coordinate, loadLedger };
