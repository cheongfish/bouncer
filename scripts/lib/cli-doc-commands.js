'use strict';
Object.defineProperty(exports, "__esModule", { value: true });
const { parseFlags } = require('./cli-flags');
const { validateBlueprint } = require('./validate');
const { scaffoldEpic, scaffoldBlueprint, scaffoldExplain, scaffoldTask, scaffoldContextReview } = require('./scaffold');
const { isNumericContextId } = require('./paths');
const { runVerification } = require('./verification');
const { nowIsoKst } = require('./time');
function cmdValidate(rest, io) {
    const f = parseFlags(rest);
    // 게이트 실패(1)와 구분: 필수 플래그 누락은 호출 형식 오류(2). 없으면
    // validate가 빈 blueprint로 구조 실패를 내어 사용법 문제를 위장한다.
    if (typeof f.blueprint !== 'string' || f.blueprint === '') {
        io.err('validate: --blueprint is required\n');
        return 2;
    }
    const repoRoot = f.repo || process.cwd();
    // 빈 문자열을 넘기면 validate가 알 수 없는 gate로 본다. 생략일 때만
    // 라이브러리 기본(게이트 없이 구조 검사)이 살아 있다.
    const gate = typeof f.gate === 'string' ? f.gate : undefined;
    const result = validateBlueprint({
        repoRoot,
        blueprintDir: f.blueprint,
        gate,
    });
    io.out(`${JSON.stringify(result, null, 2)}\n`);
    // ok=false는 실패 코드가 있는 검사 결과 — 사용법이 아니므로 1.
    return result.ok ? 0 : 1;
}
function cmdVerify(rest, io) {
    const f = parseFlags(rest);
    // validate와 같은 2: 대상 없이 돌리면 게이트 실패로 위장된다.
    if (typeof f.blueprint !== 'string' || f.blueprint === '') {
        io.err('verify: --blueprint is required\n');
        return 2;
    }
    try {
        const result = runVerification({
            repoRoot: f.repo || process.cwd(),
            blueprintDir: f.blueprint,
        });
        io.out(`${JSON.stringify(result, null, 2)}\n`);
        return result.ok ? 0 : 1;
    }
    catch (error) {
        // VERIFY_DOCUMENT_MISSING 등은 throw. 플래그는 이미 통과했으므로
        // 사용법(2)이 아니라 실행 실패(1).
        io.err(`verify: ${error.message}\n`);
        return 1;
    }
}
function cmdScaffold(rest, io) {
    // kind는 위치 인자 — parseFlags에 rest 전체를 주면 epic이 플래그 키로 사라진다.
    const [kind, ...flagArgs] = rest;
    const f = parseFlags(flagArgs);
    const repoRoot = f.repo || process.cwd();
    // 테스트가 시각을 고정하려고 --timestamp를 넘긴다. 없으면 KST now.
    const timestamp = typeof f.timestamp === 'string' ? f.timestamp : nowIsoKst();
    let created;
    try {
        if (kind === 'epic' || kind === 'blueprint') {
            // EPIC-001 / 1 / 01 거절 — 정본은 zero-pad 세 자리만. 라이브러리 throw와 메시지를 맞춤.
            if (!isNumericContextId(f.id)) {
                io.err(`scaffold: --id must be a zero-padded three-digit id (\\d{3}), got ${JSON.stringify(f.id)}\n`);
                return 2;
            }
            // id 형식 다음에 name. 잘못된 id를 --name 누락으로 안내하면 고칠 곳이 빗나간다.
            if (typeof f.name !== 'string' || f.name === '') {
                io.err(`scaffold ${kind}: --name is required\n`);
                return 2;
            }
        }
        if (kind === 'epic') {
            created = scaffoldEpic({ repoRoot, epicId: f.id, name: f.name, timestamp });
        }
        else if (kind === 'blueprint') {
            // id/name 통과 뒤에만 epic-dir을 묻는다. 형식 오류를 부모 경로 누락과
            // 같은 메시지로 섞지 않기 위함.
            if (typeof f['epic-dir'] !== 'string' || f['epic-dir'] === '') {
                io.err('scaffold blueprint: --epic-dir is required\n');
                return 2;
            }
            created = scaffoldBlueprint({
                repoRoot, epicDir: f['epic-dir'], blueprintId: f.id, name: f.name, timestamp,
            });
        }
        else if (kind === 'task') {
            // --blueprint / --id 누락은 형식 오류보다 먼저 안내한다.
            if (typeof f.blueprint !== 'string' || f.blueprint === '') {
                io.err('scaffold task: --blueprint is required\n');
                return 2;
            }
            if (typeof f.id !== 'string' || f.id === '') {
                io.err('scaffold task: --id is required\n');
                return 2;
            }
            if (!isNumericContextId(f.id)) {
                io.err(`scaffold: --id must be a zero-padded three-digit id (\\d{3}), got ${JSON.stringify(f.id)}\n`);
                return 2;
            }
            created = scaffoldTask({
                repoRoot, blueprintDir: f.blueprint, taskId: f.id, timestamp,
            });
        }
        else if (kind === 'explain') {
            // explain은 id/name이 없다. blueprint만 없으면 라이브러리가 경로 throw를 낸다.
            if (typeof f.blueprint !== 'string' || f.blueprint === '') {
                io.err('scaffold explain: --blueprint is required\n');
                return 2;
            }
            created = scaffoldExplain({ repoRoot, blueprintDir: f.blueprint, timestamp });
        }
        else if (kind === 'context-review') {
            // explain과 같은 필수 플래그. 메시지를 kind별로 두어 호출자가 어느
            // scaffold인지 알게 한다.
            if (typeof f.blueprint !== 'string' || f.blueprint === '') {
                io.err('scaffold context-review: --blueprint is required\n');
                return 2;
            }
            created = scaffoldContextReview({ repoRoot, blueprintDir: f.blueprint, timestamp });
        }
        else {
            // 알려진 kind가 아니면 라이브러리를 호출하지 않는다. throw 메시지가
            // 구현 상세를 흘리지 않게 CLI가 사용법(2)로 거절한다.
            io.err(`unknown scaffold kind: ${kind}\n`);
            return 2;
        }
    }
    catch (error) {
        // closed blueprint 거절 등 라이브러리 throw. 플래그는 통과했으나
        // 호출 상태로 막을 일이라 실행 실패(1)가 아니라 사용법/상태(2).
        io.err(`scaffold: ${error.message}\n`);
        return 2;
    }
    io.out(`${JSON.stringify({ ok: true, created }, null, 2)}\n`);
    return 0;
}
// usage는 run과 같은 항목에 둔다. help 목록과 디스패치가 한쪽만 고치면
// 어긋나던 상수 나열을 구조적으로 막기 위함.
module.exports = {
    validate: {
        run: cmdValidate,
        usage: `  validate   --blueprint <dir> --gate <plan|execute|commit|finalize>
             Run the structural checks and one gate. Reports failure codes.
`,
    },
    verify: {
        run: cmdVerify,
        usage: `  verify     --blueprint <dir>
             Run the configured verify command and record its evidence.
`,
    },
    scaffold: {
        run: cmdScaffold,
        usage: `  scaffold   epic --id <ddd> --name <slug>
             blueprint --epic-dir <dir> --id <ddd> --name <slug>
             task --blueprint <dir> --id <ddd>
             explain --blueprint <dir>
             context-review --blueprint <dir>
             Create a document set with correct frontmatter.
             (explain is for finalize; epic/blueprint scaffold omit it.)
`,
    },
};
