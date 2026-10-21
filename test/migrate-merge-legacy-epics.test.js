'use strict';
const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');
const { execFileSync } = require('node:child_process');
const { createGitTemplate } = require('./helpers/git-fixture');
const { planLegacyEpicMerge, migrateMergeLegacyEpics } = require('../scripts/lib/migrate-merge-legacy-epics');
const { runCli } = require('../scripts/lib/cli');
const { readDoc } = require('../scripts/lib/frontmatter');
const { readEpicRegistry } = require('../scripts/lib/epic-registry');
const { resolveTaskCommits } = require('../scripts/lib/task-commits');
const { scaffoldEpic, scaffoldBlueprint } = require('../scripts/lib/scaffold');

const EPICS = '.bouncer/context/epics';

// 등록부(v2): legacy a(001: x=001, y=002), legacy b(002: z=001), domain d1·d2.
function registryOf(extra = {}) {
  return {
    version: 2,
    profile: 'default',
    domainEpicLimit: 10,
    areas: [],
    epics: [
      { slug: 'a', legacy_id: '001', kind: 'legacy', active: true, blueprint_aliases: { '001': 'x', '002': 'y' } },
      { slug: 'b', legacy_id: '002', kind: 'legacy', active: true, blueprint_aliases: { '001': 'z' } },
      { slug: 'd1', kind: 'domain', active: true },
      { slug: 'd2', kind: 'domain', active: true },
    ],
    ...extra,
  };
}

function domainIndex(list, rows = []) {
  const table = rows.length === 0 ? '' : [
    '### 다른 epic에서 이 영역으로 귀속되는 blueprint',
    '| legacy epic | blueprint | 이유 |',
    '| --- | --- | --- |',
    ...rows.map(([id, cell]) => `| ${id} | ${cell} | 이유 |`),
    '',
  ].join('\n');
  return [
    '# domain', '', '## Legacy epic 귀속', '설명', '',
    ...list.map((slug) => `- [${slug}](../${slug}/index.md)`), '', table, '## Blueprints', '',
  ].join('\n');
}

function bpIndex(order) {
  return `---\ntype: bouncer.blueprint\nbouncer:\n  status: approved\n  order: ${order}\n---\nbody\n`;
}

// 기본 입력: d1 목록 [a], d2 목록 [b] + 예외 표 (a의 y → d2)
function plan({ d1 = domainIndex(['a']), d2 = domainIndex(['b'], [['001', '002']]), dirs = {}, files = {},
  registry = registryOf() } = {}) {
  const fileMap = {
    [`${EPICS}/d1/index.md`]: d1,
    [`${EPICS}/d2/index.md`]: d2,
    [`${EPICS}/a/blueprints/x/index.md`]: bpIndex(1),
    [`${EPICS}/a/blueprints/y/index.md`]: bpIndex(2),
    [`${EPICS}/b/blueprints/z/index.md`]: bpIndex(1),
    ...files,
  };
  const dirMap = {
    [`${EPICS}/a/blueprints`]: ['x', 'y'],
    [`${EPICS}/b/blueprints`]: ['z'],
    ...dirs,
  };
  return planLegacyEpicMerge({
    repoRoot: '/nonexistent',
    registry,
    readFile: (rel) => (rel in fileMap ? fileMap[rel] : null),
    listDirs: (rel) => dirMap[rel] ?? [],
  });
}

const A = `${EPICS}/a/blueprints`;
const B = `${EPICS}/b/blueprints`;

test('귀속 목록과 예외 표가 있으면 → 예외 우선으로 이동 계획과 order가 정해진다', () => {
  const result = plan();
  assert.strictEqual(result.ok, true);
  assert.deepStrictEqual(result.moves.map((m) => [m.from, m.to, m.order]), [
    [`${A}/x`, `${EPICS}/d1/blueprints/x`, 1],
    [`${A}/y`, `${EPICS}/d2/blueprints/y`, 1],
    [`${B}/z`, `${EPICS}/d2/blueprints/z`, 2],
  ]);
  assert.deepStrictEqual(result.moves.map((m) => [m.legacyEpic, m.domainEpic, m.slug]), [
    ['a', 'd1', 'x'], ['a', 'd2', 'y'], ['b', 'd2', 'z'],
  ]);
  assert.deepStrictEqual(result.unresolved_rows, []);
});

test('같은 입력을 두 번 계산하면 → 결과가 deepStrictEqual이다', () => {
  assert.deepStrictEqual(plan(), plan());
});

test('대상 epic에 이미 blueprint가 있으면 → order가 기존 최댓값 다음부터 붙는다', () => {
  const result = plan({
    dirs: { [`${EPICS}/d2/blueprints`]: ['old'] },
    files: { [`${EPICS}/d2/blueprints/old/index.md`]: bpIndex(7) },
  });
  assert.deepStrictEqual(result.moves.map((m) => [m.slug, m.order]), [['x', 1], ['y', 8], ['z', 9]]);
});

test('예외 표가 범위이면 → 양끝 포함 모든 blueprint가 예외 대상 epic으로 간다', () => {
  const result = plan({ d2: domainIndex(['b'], [['001', '001~002']]) });
  assert.deepStrictEqual(result.moves.map((m) => [m.slug, m.domainEpic]), [
    ['x', 'd2'], ['y', 'd2'], ['z', 'd2'],
  ]);
});

test('예외 표가 번호와 slug이면 → 그 blueprint만 간다', () => {
  const result = plan({ d2: domainIndex(['b'], [['001', '002 y']]) });
  assert.strictEqual(result.ok, true);
  assert.deepStrictEqual(result.moves.map((m) => [m.slug, m.domainEpic]), [
    ['x', 'd1'], ['y', 'd2'], ['z', 'd2'],
  ]);
});

test('예외 표의 slug가 별칭과 다르면 → merge-mapping-invalid다', () => {
  const result = plan({ d2: domainIndex(['b'], [['001', '002 w']]) });
  assert.strictEqual(result.ok, false);
  assert.strictEqual(result.code, 'merge-mapping-invalid');
});

test('범위 끝이 별칭에 없으면 → merge-mapping-invalid다', () => {
  const result = plan({ d2: domainIndex(['b'], [['001', '001~004']]) });
  assert.strictEqual(result.ok, false);
  assert.strictEqual(result.code, 'merge-mapping-invalid');
});

test('예외 표 항목 일부만 해석되면 → merge-mapping-invalid다', () => {
  const result = plan({ d2: domainIndex(['b'], [['001', '002, 뭔가']]) });
  assert.strictEqual(result.ok, false);
  assert.strictEqual(result.code, 'merge-mapping-invalid');
});

test('예외 표가 자유 서술이면 → unresolved_rows에 담고 목록 규칙으로 계획한다', () => {
  const result = plan({ d1: domainIndex(['a'], [['002', '평가 후속']]) });
  assert.strictEqual(result.ok, true);
  assert.deepStrictEqual(result.unresolved_rows, [{ domain: 'd1', legacy_id: '002', cell: '평가 후속' }]);
  assert.deepStrictEqual(result.moves.find((m) => m.slug === 'z').domainEpic, 'd2');
});

test('legacy epic이 어느 목록에도 없으면 → merge-mapping-invalid다', () => {
  const result = plan({ d2: domainIndex([]) });
  assert.strictEqual(result.ok, false);
  assert.strictEqual(result.code, 'merge-mapping-invalid');
});

test('legacy epic이 두 목록에 있으면 → merge-mapping-invalid다', () => {
  const result = plan({ d2: domainIndex(['a', 'b']) });
  assert.strictEqual(result.ok, false);
  assert.strictEqual(result.code, 'merge-mapping-invalid');
});

test('목록 링크가 legacy가 아닌 epic을 가리키면 → merge-mapping-invalid다', () => {
  const result = plan({ d1: domainIndex(['a', 'd2']) });
  assert.strictEqual(result.ok, false);
  assert.strictEqual(result.code, 'merge-mapping-invalid');
});

test('예외 표의 legacy 번호를 등록부에서 찾을 수 없으면 → merge-mapping-invalid다', () => {
  const result = plan({ d2: domainIndex(['b'], [['999', '001']]) });
  assert.strictEqual(result.ok, false);
  assert.strictEqual(result.code, 'merge-mapping-invalid');
});

test('한 blueprint가 두 도메인의 예외 표에 있으면 → merge-mapping-invalid다', () => {
  const result = plan({ d1: domainIndex(['a'], [['001', '002']]) });
  assert.strictEqual(result.ok, false);
  assert.strictEqual(result.code, 'merge-mapping-invalid');
});

test('등록부가 v2가 아니면 → merge-mapping-invalid다', () => {
  const result = plan({ registry: registryOf({ version: 1 }) });
  assert.strictEqual(result.ok, false);
  assert.strictEqual(result.code, 'merge-mapping-invalid');
});

test('대상 epic에 같은 slug가 이미 있으면 → migrate-slug-conflict다', () => {
  const result = plan({ dirs: { [`${EPICS}/d1/blueprints`]: ['x'] } });
  assert.strictEqual(result.ok, false);
  assert.strictEqual(result.code, 'migrate-slug-conflict');
});

test('같은 slug 둘이 한 대상 epic으로 들어오면 → migrate-slug-conflict다', () => {
  const result = plan({ dirs: { [`${B}`]: ['z', 'y'] } });
  assert.strictEqual(result.ok, false);
  assert.strictEqual(result.code, 'migrate-slug-conflict');
});

test('이미 옮겨진 상태이면 → moves가 빈 배열이다', () => {
  const result = plan({ dirs: { [A]: [], [B]: [] } });
  assert.strictEqual(result.ok, true);
  assert.deepStrictEqual(result.moves, []);
});

// ---- 적용 단계: 임시 git 저장소에서만 실행한다 ----

const TS = '2026-10-20T10:00:00+09:00';

function git(repo, ...args) {
  return execFileSync('git', args, { cwd: repo, encoding: 'utf8' });
}

function listBlueprints(repo) {
  const root = path.join(repo, EPICS);
  return fs.readdirSync(root).flatMap((epic) => {
    const dir = path.join(root, epic, 'blueprints');
    return fs.existsSync(dir) ? fs.readdirSync(dir).map((bp) => `${epic}/${bp}`) : [];
  }).sort();
}

/**
 * legacy a(x, y)·b(z)와 domain d1·d2를 가진 git 저장소. d1 목록 [a], d2 목록 [b] + 예외 (a의 002 → d2).
 * `unresolvedRow`가 true면 d1 예외 표에 자유 서술 행을 하나 더 둔다. 마지막 커밋은 옛 번호 trailer다.
 */
function buildFixture(repo, { unresolvedRow = false } = {}) {
  git(repo, 'init', '-q', '-b', 'main');
  git(repo, 'config', 'user.email', 't@example.com');
  git(repo, 'config', 'user.name', 'tester');
  fs.writeFileSync(path.join(repo, '.gitignore'), '.worktrees/\n.bouncer/runtime/\n');
  for (const name of ['a', 'b', 'd1', 'd2']) {
    scaffoldEpic({ repoRoot: repo, name, timestamp: TS, description: `Epic ${name} description.` });
  }
  const bp = (epic, name, order) => {
    scaffoldBlueprint({
      repoRoot: repo, epicDir: `${EPICS}/${epic}`, name, order, timestamp: TS, scale: 'light',
    });
    const rel = `${EPICS}/${epic}/blueprints/${name}/tasks/001/tasks.md`;
    const doc = readDoc(path.join(repo, rel));
    doc.data.bouncer.affected_paths = ['scripts/src/lib/example.ts'];
    fs.writeFileSync(path.join(repo, rel), require('../scripts/lib/render').renderDoc(doc.data, doc.body));
  };
  bp('a', 'x', 1);
  bp('a', 'y', 2);
  bp('b', 'z', 1);
  const append = (epic, text) => fs.appendFileSync(path.join(repo, `${EPICS}/${epic}/index.md`), text);
  // scaffold가 만든 epic index에는 blueprint 링크가 없으므로 이동 뒤 링크 갱신을 볼 링크를 얹는다.
  append('a', '\n- [x](blueprints/x/index.md)\n');
  append('d1', domainIndex(['a'], unresolvedRow ? [['002', '평가 후속']] : []).split('# domain\n')[1]);
  append('d2', domainIndex(['b'], [['001', '002']]).split('# domain\n')[1]);
  fs.writeFileSync(path.join(repo, '.bouncer/epics.json'), `${JSON.stringify({
    version: 2,
    profile: 'domain-only',
    domainEpicLimit: 5,
    areas: [],
    epics: [
      { slug: 'a', legacy_id: '001', kind: 'legacy', active: true, blueprint_aliases: { '001': 'x', '002': 'y' } },
      { slug: 'b', legacy_id: '002', kind: 'legacy', active: true, blueprint_aliases: { '001': 'z' } },
      { slug: 'd1', kind: 'domain', active: true, approval: { reason: 'domain one', approvedAt: TS } },
      { slug: 'd2', kind: 'domain', active: true, approval: { reason: 'domain two', approvedAt: TS } },
    ],
  }, null, 2)}\n`);
  git(repo, 'add', '-A');
  git(repo, 'commit', '-q', '-m', 'fixture');
  git(repo, 'commit', '-q', '--allow-empty', '-m', 'feat: legacy trailer',
    '-m', 'Bouncer-Task: EPIC-001/BP-001/TASK-001\nBouncer-Intent: EPIC-001/BP-001');
}

const template = createGitTemplate((dir) => buildFixture(dir));
const unresolvedTemplate = createGitTemplate((dir) => buildFixture(dir, { unresolvedRow: true }));
test.after(() => { template.dispose(); unresolvedTemplate.dispose(); });

/** git은 실제로 실행하고, fs는 쓰기 계열 호출만 센다. `mv`도 쓰기로 센다. */
function instrument(repo, extra = {}) {
  const writes = [];
  const counted = (name) => (...args) => {
    writes.push(name);
    return fs[name](...args);
  };
  const deps = {
    runGit(args) {
      if (args[0] === 'mv') writes.push('git mv');
      return { stdout: execFileSync('git', args, { cwd: repo, encoding: 'utf8' }) };
    },
    fs: {
      ...fs,
      writeFileSync: counted('writeFileSync'),
      renameSync: counted('renameSync'),
      mkdirSync: counted('mkdirSync'),
    },
    ...extra,
  };
  return { deps, writes };
}

test('dry-run → 계획과 재작성 수를 보고하고 git·fs 쓰기가 0회다', () => {
  const repo = template.copy();
  const before = listBlueprints(repo);
  const spy = instrument(repo);
  const result = migrateMergeLegacyEpics({ repoRoot: repo, deps: spy.deps });
  assert.strictEqual(result.ok, true);
  assert.strictEqual(result.dryRun, true);
  assert.deepStrictEqual(result.moved.map((m) => [m.from, m.to, m.order]), [
    [`${A}/x`, `${EPICS}/d1/blueprints/x`, 1],
    [`${A}/y`, `${EPICS}/d2/blueprints/y`, 1],
    [`${B}/z`, `${EPICS}/d2/blueprints/z`, 2],
  ]);
  assert.deepStrictEqual(result.movedTo, { a: { x: 'd1', y: 'd2' }, b: { z: 'd2' } });
  assert.strictEqual(typeof result.rewritten, 'number');
  assert.ok(result.rewritten > 0);
  assert.deepStrictEqual(result.unresolved_rows, []);
  assert.deepStrictEqual(spy.writes, []);
  assert.deepStrictEqual(listBlueprints(repo), before);
});

test('--yes → blueprint를 옮기고 등록부 moved_to를 쓰고 검증과 trailer 해석이 통과한다', () => {
  const repo = template.copy();
  const before = listBlueprints(repo).length;
  const registryBefore = readEpicRegistry(repo).registry;
  const result = migrateMergeLegacyEpics({ repoRoot: repo, yes: true });
  assert.strictEqual(result.ok, true, JSON.stringify(result));
  assert.strictEqual(result.dryRun, false);
  assert.strictEqual(listBlueprints(repo).length, before);
  assert.deepStrictEqual(listBlueprints(repo), ['d1/x', 'd2/y', 'd2/z']);
  assert.strictEqual(result.validate.length, 3);
  assert.ok(result.validate.every((v) => v.ok), JSON.stringify(result.validate));

  const registry = readEpicRegistry(repo).registry;
  const bySlug = (slug) => registry.epics.find((e) => e.slug === slug);
  assert.deepStrictEqual(bySlug('a').moved_to, { x: 'd1', y: 'd2' });
  assert.deepStrictEqual(bySlug('b').moved_to, { z: 'd2' });
  for (const slug of ['a', 'b']) {
    const prev = registryBefore.epics.find((e) => e.slug === slug);
    assert.strictEqual(bySlug(slug).kind, prev.kind);
    assert.strictEqual(bySlug(slug).legacy_id, prev.legacy_id);
    assert.deepStrictEqual(bySlug(slug).blueprint_aliases, prev.blueprint_aliases);
  }

  const aIndex = path.join(repo, EPICS, 'a/index.md');
  assert.ok(fs.existsSync(aIndex));
  assert.ok(fs.readFileSync(aIndex, 'utf8').includes('../d1/blueprints/x/index.md'));
  const moved = readDoc(path.join(repo, EPICS, 'd2/blueprints/z/index.md')).data;
  assert.strictEqual(moved.bouncer.order, 2);
  assert.strictEqual(moved.resource, `${EPICS}/d2/blueprints/z/index.md`);

  const found = resolveTaskCommits({
    repoRoot: repo, base: 'HEAD~1', head: 'HEAD', stableIds: ['d1/x/001'], registry,
  });
  assert.ok(found.has('d1/x/001'));
});

test('이미 옮겨진 저장소에서 다시 실행하면 → 쓰기 없이 moved가 빈 배열이다', () => {
  const repo = template.copy();
  assert.strictEqual(migrateMergeLegacyEpics({ repoRoot: repo, yes: true }).ok, true);
  const spy = instrument(repo);
  const again = migrateMergeLegacyEpics({ repoRoot: repo, yes: true, deps: spy.deps });
  assert.strictEqual(again.ok, true);
  assert.deepStrictEqual(again.moved, []);
  assert.deepStrictEqual(spy.writes, []);
});

test('더러운 작업 트리이면 → migrate-dirty-tree로 쓰기 0회 거절한다', () => {
  const repo = template.copy();
  fs.writeFileSync(path.join(repo, 'stray.txt'), 'x');
  const spy = instrument(repo);
  const result = migrateMergeLegacyEpics({ repoRoot: repo, yes: true, deps: spy.deps });
  assert.strictEqual(result.ok, false);
  assert.strictEqual(result.code, 'migrate-dirty-tree');
  assert.deepStrictEqual(spy.writes, []);
});

test('진행 중인 pointer가 있으면 → migrate-in-progress로 blockers와 함께 쓰기 0회 거절한다', () => {
  const repo = template.copy();
  const blockers = [{ kind: 'pointer', path: '/x/current.json' }];
  const spy = instrument(repo, { listInProgress: () => blockers });
  const result = migrateMergeLegacyEpics({ repoRoot: repo, yes: true, deps: spy.deps });
  assert.strictEqual(result.ok, false);
  assert.strictEqual(result.code, 'migrate-in-progress');
  assert.deepStrictEqual(result.blockers, blockers);
  assert.deepStrictEqual(spy.writes, []);
});

test('등록부가 없으면 → migrate-registry-missing으로 쓰기 0회 거절한다', () => {
  const repo = template.copy();
  git(repo, 'rm', '-q', '.bouncer/epics.json');
  git(repo, 'commit', '-q', '-m', 'drop registry');
  const spy = instrument(repo);
  const result = migrateMergeLegacyEpics({ repoRoot: repo, yes: true, deps: spy.deps });
  assert.strictEqual(result.code, 'migrate-registry-missing');
  assert.deepStrictEqual(spy.writes, []);
});

test('등록부 형식이 깨졌으면 → S35로 쓰기 0회 거절한다', () => {
  const repo = template.copy();
  fs.writeFileSync(path.join(repo, '.bouncer/epics.json'), '{ not json');
  const spy = instrument(repo);
  const result = migrateMergeLegacyEpics({ repoRoot: repo, yes: true, deps: spy.deps });
  assert.strictEqual(result.code, 'S35');
  assert.deepStrictEqual(spy.writes, []);
});

test('대상 epic에 같은 slug가 이미 있으면 → migrate-slug-conflict로 쓰기 0회 거절한다', () => {
  const repo = template.copy();
  scaffoldBlueprint({
    repoRoot: repo, epicDir: `${EPICS}/d1`, name: 'x', order: 5, timestamp: TS, scale: 'light',
  });
  git(repo, 'add', '-A');
  git(repo, 'commit', '-q', '-m', 'clash');
  const spy = instrument(repo);
  const result = migrateMergeLegacyEpics({ repoRoot: repo, yes: true, deps: spy.deps });
  assert.strictEqual(result.code, 'migrate-slug-conflict');
  assert.deepStrictEqual(spy.writes, []);
});

test('자유 서술 예외 행이 있으면 → dry-run은 보고하고 --yes는 쓰기 0회 merge-mapping-invalid다', () => {
  const repo = unresolvedTemplate.copy();
  const dry = migrateMergeLegacyEpics({ repoRoot: repo });
  assert.strictEqual(dry.ok, true);
  assert.deepStrictEqual(dry.unresolved_rows, [{ domain: 'd1', legacy_id: '002', cell: '평가 후속' }]);
  const spy = instrument(repo);
  const yes = migrateMergeLegacyEpics({ repoRoot: repo, yes: true, deps: spy.deps });
  assert.strictEqual(yes.ok, false);
  assert.strictEqual(yes.code, 'merge-mapping-invalid');
  assert.deepStrictEqual(yes.details, dry.unresolved_rows);
  assert.deepStrictEqual(spy.writes, []);
});

test('git mv가 실패하면 → migrate-failed와 복구 명령 next를 돌려준다', () => {
  const repo = template.copy();
  const spy = instrument(repo);
  const failing = {
    ...spy.deps,
    runGit(args) {
      if (args[0] === 'mv') throw new Error('simulated git mv failure');
      return spy.deps.runGit(args);
    },
  };
  const result = migrateMergeLegacyEpics({ repoRoot: repo, yes: true, deps: failing });
  assert.strictEqual(result.code, 'migrate-failed');
  assert.ok(result.next.includes('git restore'));
});

test('CLI 인자가 잘못되면 → exit 2이고 정상 실행은 exit 0이다', () => {
  const repo = template.copy();
  const run = (...argv) => {
    const out = [];
    const err = [];
    const code = runCli(['migrate', 'merge-legacy-epics', ...argv], {
      out: (s) => out.push(s), err: (s) => err.push(s),
    });
    return { code, out: out.join(''), err: err.join('') };
  };
  assert.strictEqual(run('--repo', repo, '--yes', '--yes').code, 2);
  assert.strictEqual(run('--repo', repo, '--repo', repo).code, 2);
  assert.strictEqual(run('--repo').code, 2);
  assert.strictEqual(run('--repo', repo, '--bogus').code, 2);
  assert.strictEqual(run('--repo', repo, 'extra').code, 2);
  const dry = run('--repo', repo);
  assert.strictEqual(dry.code, 0, dry.out + dry.err);
  assert.strictEqual(JSON.parse(dry.out).dryRun, true);
  const yes = run('--repo', repo, '--yes');
  assert.strictEqual(yes.code, 0, yes.out + yes.err);
  assert.strictEqual(JSON.parse(yes.out).ok, true);
});
