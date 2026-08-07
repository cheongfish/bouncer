// test/finalize-pure.test.js
'use strict';
const test = require('node:test');
const assert = require('node:assert');
const { makeAllowed, buildCommitMessage, isUnder } = require('../scripts/lib/finalize');

const BP = '.bouncer/context/epics/001-auth/blueprints/001-login';

test('isUnder treats entries as directories', () => {
  assert.ok(isUnder('src/auth/login.ts', 'src/auth/'));
  assert.ok(isUnder('src/auth/login.ts', 'src/auth'));
  assert.ok(!isUnder('src/authx/login.ts', 'src/auth'));
});

test('allowed set covers affected paths, bp subtree, ancestor indexes', () => {
  const allowed = makeAllowed({ affectedPaths: ['src/auth/'], blueprintDir: BP });
  assert.ok(allowed('src/auth/login.ts'));
  assert.ok(allowed(`${BP}/tasks.md`));
  assert.ok(allowed('.bouncer/context/epics/001-auth/index.md'));
  assert.ok(allowed('.bouncer/context/index.md'));
  assert.ok(!allowed('context/index.md'));
  assert.ok(!allowed('context/epics/001-auth/index.md'));
  assert.ok(!allowed('src/payments/charge.ts'));
  assert.ok(!allowed('.bouncer/context/epics/002-billing/index.md'));
});

test('commit message follows the template', () => {
  const docs = {
    blueprintIndex: { data: { title: 'Login flow', bouncer: { id: '001', epic_id: '001' } } },
    tasks: { data: { title: 'Implement login' } },
    verification: { data: { title: 'Login verified' } },
    explain: { data: { resource: `${BP}/explain.md` } },
  };
  const msg = buildCommitMessage(docs);

  // 대상 묶음이 없으면 subject는 blueprint title. tasks title은 subject에 없으므로
  // 수정 내용 bullet은 verification만 (호환 필드 폴백).
  assert.strictEqual(msg, [
    'feat: Login flow',
    '',
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
    '- 관련 검증이 통과함을 확인함',
  ].join('\n'));
});

test('incomplete commit_intent falls back to verification bullet only', () => {
  const docs = {
    blueprintIndex: {
      data: {
        title: 'Login flow',
        bouncer: { commit_intent: ['only one line'] },
      },
    },
    tasks: { data: { title: 'Implement login' } },
    verification: { data: { title: 'Login verified' } },
  };
  assert.strictEqual(buildCommitMessage(docs), [
    'feat: Login flow',
    '',
    '- Login verified',
  ].join('\n'));
});

test('missing titles omit body bullets', () => {
  const docs = {
    blueprintIndex: { data: { title: 'Login flow', bouncer: { commit_type: 'fix' } } },
  };
  assert.strictEqual(buildCommitMessage(docs), 'fix: Login flow');
});

test('commit bullets prefer target taskUnit verification over docs.tasks compat field', () => {
  const docs = {
    blueprintIndex: { data: { title: 'Login flow', bouncer: { id: '001', epic_id: '001' } } },
    // 호환 필드(첫 묶음) — taskUnit이 있으면 무시되어야 한다.
    tasks: { data: { title: 'First unit title' } },
    verification: { data: { title: 'First unit verify' } },
  };
  const taskUnit = {
    number: 2,
    dir: `${BP}/tasks/002`,
    tasks: { data: { title: 'Second unit implement' }, rel: `${BP}/tasks/002/tasks.md` },
    verification: { data: { title: 'Second unit verified' }, rel: `${BP}/tasks/002/verification.md` },
    review: undefined,
  };
  // subject는 task title, 수정 내용 bullet은 verification만 (tasks title은 subject에 있음).
  assert.strictEqual(buildCommitMessage(docs, taskUnit), [
    'feat: Second unit implement',
    '',
    '- Second unit verified',
  ].join('\n'));
});

test('subject uses taskUnit tasks title over blueprint title', () => {
  const docs = {
    blueprintIndex: {
      data: { title: 'blueprint 제목', bouncer: { commit_type: 'feat' } },
    },
  };
  const taskUnit = {
    number: 1,
    dir: `${BP}/tasks/001`,
    tasks: {
      data: { title: '게이트를 task 단위로 좁힘' },
      rel: `${BP}/tasks/001/tasks.md`,
    },
    verification: {
      data: { title: '검증 통과' },
      rel: `${BP}/tasks/001/verification.md`,
    },
    review: undefined,
  };
  assert.match(
    buildCommitMessage(docs, taskUnit).split('\n')[0],
    /^feat: 게이트를 task 단위로 좁힘$/,
  );
});

test('commit_intent prefers task over blueprint; one-line task falls to blueprint', () => {
  const bpIntent = [
    'blueprint 배경: 커밋이 blueprint 단위로만 묶임',
    'blueprint 의도: task마다 다른 메시지를 쓰게 함',
  ];
  const taskIntent = [
    'task 배경: subject가 blueprint title로 고정됨',
    'task 의도: 대상 task title로 subject를 바꿈',
  ];
  const docs = {
    blueprintIndex: {
      data: {
        title: 'blueprint 제목',
        bouncer: { commit_type: 'feat', commit_intent: bpIntent },
      },
    },
  };
  const baseUnit = {
    number: 1,
    dir: `${BP}/tasks/001`,
    verification: {
      data: { title: '검증 통과' },
      rel: `${BP}/tasks/001/verification.md`,
    },
    review: undefined,
  };

  // task에 유효한 2줄이 있으면 그 출처를 쓴다.
  assert.strictEqual(
    buildCommitMessage(docs, {
      ...baseUnit,
      tasks: {
        data: {
          title: '게이트를 task 단위로 좁힘',
          bouncer: { commit_intent: taskIntent },
        },
        rel: `${BP}/tasks/001/tasks.md`,
      },
    }),
    [
      'feat: 게이트를 task 단위로 좁힘',
      '',
      `- ${taskIntent[0]}`,
      `- ${taskIntent[1]}`,
      '- 검증 통과',
    ].join('\n'),
  );

  // task에 commit_intent가 없으면 blueprint 2줄로 떨어진다.
  assert.strictEqual(
    buildCommitMessage(docs, {
      ...baseUnit,
      tasks: {
        data: { title: '게이트를 task 단위로 좁힘' },
        rel: `${BP}/tasks/001/tasks.md`,
      },
    }),
    [
      'feat: 게이트를 task 단위로 좁힘',
      '',
      `- ${bpIntent[0]}`,
      `- ${bpIntent[1]}`,
      '- 검증 통과',
    ].join('\n'),
  );

  // task가 1줄이면 그 출처는 무효 → blueprint 2줄로 폴백.
  assert.strictEqual(
    buildCommitMessage(docs, {
      ...baseUnit,
      tasks: {
        data: {
          title: '게이트를 task 단위로 좁힘',
          bouncer: { commit_intent: ['task 한 줄만'] },
        },
        rel: `${BP}/tasks/001/tasks.md`,
      },
    }),
    [
      'feat: 게이트를 task 단위로 좁힘',
      '',
      `- ${bpIntent[0]}`,
      `- ${bpIntent[1]}`,
      '- 검증 통과',
    ].join('\n'),
  );

  // task가 3줄이면 slice하지 않고 출처 전체를 버리고 blueprint로 폴백.
  assert.strictEqual(
    buildCommitMessage(docs, {
      ...baseUnit,
      tasks: {
        data: {
          title: '게이트를 task 단위로 좁힘',
          bouncer: { commit_intent: ['t1', 't2', 't3'] },
        },
        rel: `${BP}/tasks/001/tasks.md`,
      },
    }),
    [
      'feat: 게이트를 task 단위로 좁힘',
      '',
      `- ${bpIntent[0]}`,
      `- ${bpIntent[1]}`,
      '- 검증 통과',
    ].join('\n'),
  );
});

test('empty task title falls subject to blueprint title', () => {
  const docs = {
    blueprintIndex: {
      data: {
        title: 'blueprint 제목',
        bouncer: { commit_type: 'feat' },
      },
    },
  };
  const taskUnit = {
    number: 1,
    dir: `${BP}/tasks/001`,
    tasks: {
      data: { title: '   ' },
      rel: `${BP}/tasks/001/tasks.md`,
    },
    verification: {
      data: { title: '검증 통과' },
      rel: `${BP}/tasks/001/verification.md`,
    },
    review: undefined,
  };
  assert.match(
    buildCommitMessage(docs, taskUnit).split('\n')[0],
    /^feat: blueprint 제목$/,
  );
});

test('both commit_intent sources invalid leave only verification bullet', () => {
  const docs = {
    blueprintIndex: {
      data: {
        title: 'blueprint 제목',
        bouncer: {
          commit_type: 'feat',
          // 3줄은 앞 2줄로 자르지 않고 출처 전체를 버린다.
          commit_intent: ['bp1', 'bp2', 'bp3'],
        },
      },
    },
  };
  const taskUnit = {
    number: 1,
    dir: `${BP}/tasks/001`,
    tasks: {
      data: {
        title: '게이트를 task 단위로 좁힘',
        bouncer: { commit_intent: ['task 한 줄만'] },
      },
      rel: `${BP}/tasks/001/tasks.md`,
    },
    verification: {
      data: { title: '검증 통과' },
      rel: `${BP}/tasks/001/verification.md`,
    },
    review: undefined,
  };
  assert.strictEqual(buildCommitMessage(docs, taskUnit), [
    'feat: 게이트를 task 단위로 좁힘',
    '',
    '- 검증 통과',
  ].join('\n'));
});

test('undefined taskUnit falls subject to blueprint title', () => {
  const docs = {
    blueprintIndex: {
      data: {
        title: 'blueprint 제목',
        bouncer: { commit_type: 'feat' },
      },
    },
    verification: { data: { title: '검증 통과' } },
  };
  assert.match(
    buildCommitMessage(docs, undefined).split('\n')[0],
    /^feat: blueprint 제목$/,
  );
});
