// test/finalize-pure.test.js
'use strict';
const test = require('node:test');
const assert = require('node:assert');
const { makeAllowed, buildCommitMessage, isUnder } = require('../scripts/lib/finalize');

const BP = '.bouncer/context/epics/EPIC-001-auth/blueprints/BP-001-login';

test('isUnder treats entries as directories', () => {
  assert.ok(isUnder('src/auth/login.ts', 'src/auth/'));
  assert.ok(isUnder('src/auth/login.ts', 'src/auth'));
  assert.ok(!isUnder('src/authx/login.ts', 'src/auth'));
});

test('allowed set covers affected paths, bp subtree, ancestor indexes', () => {
  const allowed = makeAllowed({ affectedPaths: ['src/auth/'], blueprintDir: BP });
  assert.ok(allowed('src/auth/login.ts'));
  assert.ok(allowed(`${BP}/tasks.md`));
  assert.ok(allowed('.bouncer/context/epics/EPIC-001-auth/index.md'));
  assert.ok(allowed('.bouncer/context/index.md'));
  assert.ok(!allowed('context/index.md'));
  assert.ok(!allowed('context/epics/EPIC-001-auth/index.md'));
  assert.ok(!allowed('src/payments/charge.ts'));
  assert.ok(!allowed('.bouncer/context/epics/EPIC-002-billing/index.md'));
});

test('commit message follows the template', () => {
  const docs = {
    blueprintIndex: { data: { title: 'Login flow', bouncer: { id: 'BP-001', epic_id: 'EPIC-001' } } },
    tasks: { data: { title: 'Implement login' } },
    verification: { data: { title: 'Login verified' } },
    explain: { data: { resource: `${BP}/explain.md` } },
  };
  const msg = buildCommitMessage(docs);

  assert.strictEqual(msg, [
    'feat: Login flow',
    '',
    '- Implement login',
    '- Login verified',
  ].join('\n'));
  assert.ok(!msg.includes('Epic:'), 'identifiers stay out of the commit message');
  assert.ok(!msg.includes('Blueprint:'), 'identifiers stay out of the commit message');
  assert.ok(!msg.includes('Distill:'), 'paths stay out of the commit message');
  assert.ok(!msg.includes('Implemented:'), 'prose labels are replaced by bullets');
});

test('commit_intent prepends two background bullets before titles', () => {
  const docs = {
    blueprintIndex: {
      data: {
        title: '재시도 로직 추가',
        bouncer: {
          commit_type: 'feat',
          commit_intent: [
            '로그인 실패 재시도가 서버에 부담을 줌',
            '지수 백오프로 안정성을 높이려 함',
          ],
        },
      },
    },
    tasks: { data: { title: '재시도 간격을 지수적으로 늘림' } },
    verification: { data: { title: '관련 검증이 통과함을 확인함' } },
  };
  assert.strictEqual(buildCommitMessage(docs), [
    'feat: 재시도 로직 추가',
    '',
    '- 로그인 실패 재시도가 서버에 부담을 줌',
    '- 지수 백오프로 안정성을 높이려 함',
    '- 재시도 간격을 지수적으로 늘림',
    '- 관련 검증이 통과함을 확인함',
  ].join('\n'));
});

test('incomplete commit_intent falls back to title bullets only', () => {
  const docs = {
    blueprintIndex: {
      data: {
        title: 'Login flow',
        bouncer: { commit_intent: ['only one line'] },
      },
    },
    tasks: { data: { title: 'Implement login' } },
  };
  assert.strictEqual(buildCommitMessage(docs), [
    'feat: Login flow',
    '',
    '- Implement login',
  ].join('\n'));
});

test('missing titles omit body bullets', () => {
  const docs = {
    blueprintIndex: { data: { title: 'Login flow', bouncer: { commit_type: 'fix' } } },
  };
  assert.strictEqual(buildCommitMessage(docs), 'fix: Login flow');
});
