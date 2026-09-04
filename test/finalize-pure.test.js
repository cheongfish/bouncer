// test/finalize-pure.test.js
'use strict';
const test = require('node:test');
const assert = require('node:assert');
const {
  buildCommitMessage,
  buildFinalizeCommitMessage,
  buildTaskContext,
} = require('../scripts/lib/finalize');
const { makeAllowed, isUnder } = require('../scripts/lib/scope');

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
  ].join('\n'));
  assert.ok(!msg.includes('Epic:'), 'identifiers stay out of the commit message');
  assert.ok(!msg.includes('Blueprint:'), 'identifiers stay out of the commit message');
  assert.ok(!msg.includes('Distill:'), 'paths stay out of the commit message');
  assert.ok(!msg.includes('Implemented:'), 'prose labels are replaced by bullets');
});

test('commit_intent supplies task background bullets without verification title', () => {
  const docs = {
    blueprintIndex: {
      data: {
        title: '재시도 로직 추가',
        bouncer: { commit_type: 'feat' },
      },
    },
  };
  const taskUnit = {
    number: 1,
    dir: `${BP}/tasks/001`,
    tasks: {
      data: {
        title: '재시도 간격을 지수적으로 늘림',
        bouncer: {
          commit_intent: [
            '로그인 실패 재시도가 서버에 부담을 줌',
            '지수 백오프로 안정성을 높이려 함',
          ],
        },
      },
      rel: `${BP}/tasks/001/tasks.md`,
    },
    verification: {
      data: { title: '관련 검증이 통과함을 확인함' },
      rel: `${BP}/tasks/001/verification.md`,
    },
    review: undefined,
  };
  assert.strictEqual(buildCommitMessage(docs, taskUnit), [
    'feat: 재시도 간격을 지수적으로 늘림',
    '',
    '- 로그인 실패 재시도가 서버에 부담을 줌',
    '- 지수 백오프로 안정성을 높이려 함',
  ].join('\n'));
});

test('missing commit_intent does not fall back to verification title', () => {
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

test('task authored fields are independent of blueprint and verification fields', () => {
  const bpIntent = [
    '청사진 배경: 커밋이 청사진 단위로만 묶임',
    '청사진 의도: 작업마다 다른 메시지를 쓰게 함',
  ];
  const taskIntent = [
    '작업 배경: 제목이 청사진 제목으로 고정됨',
    '작업 의도: 대상 작업 제목으로 제목을 바꿈',
  ];
  // blueprint commit_intent가 있어도 task 커밋은 쓰지 않는다.
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
          bouncer: { commit_intent: taskIntent, commit_summary: ['대상 작업 제목을 제목으로 사용함'] },
        },
        rel: `${BP}/tasks/001/tasks.md`,
      },
    }),
    [
      'feat: 게이트를 task 단위로 좁힘',
      '',
      `- ${taskIntent[0]}`,
      `- ${taskIntent[1]}`,
      '- 대상 작업 제목을 제목으로 사용함',
    ].join('\n'),
  );

  // task에 authored field가 없으면 blueprint나 verification으로 폴백하지 않는다.
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
    ].join('\n'),
  );

  // task는 한 줄 intent도 허용한다.
  assert.strictEqual(buildCommitMessage(docs, {
    ...baseUnit,
    tasks: {
      data: {
        title: '게이트를 task 단위로 좁힘',
        bouncer: { commit_intent: ['한 줄임'] },
      },
      rel: `${BP}/tasks/001/tasks.md`,
    },
  }), [
    'feat: 게이트를 task 단위로 좁힘',
    '',
    '- 한 줄임',
  ].join('\n'));

  // task가 3줄이면 slice하지 않고 메시지 생성을 거부한다.
  assert.throws(() => buildCommitMessage(docs, {
    ...baseUnit,
    tasks: {
      data: {
        title: '게이트를 task 단위로 좁힘',
        bouncer: { commit_intent: ['t1', 't2', 't3'] },
      },
      rel: `${BP}/tasks/001/tasks.md`,
    },
  }), /commit_intent.*1-2/);
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

test('invalid task commit_intent is rejected despite blueprint fields', () => {
  const docs = {
    blueprintIndex: {
      data: {
        title: 'blueprint 제목',
        bouncer: {
          commit_type: 'feat',
          // blueprint에 유효한 2줄이 있어도 task 커밋은 쓰지 않는다.
          commit_intent: ['bp1', 'bp2'],
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
        // 3줄은 앞 2줄로 자르지 않고 출처 전체를 버린다.
        bouncer: { commit_intent: ['t1', 't2', 't3'] },
      },
      rel: `${BP}/tasks/001/tasks.md`,
    },
    verification: {
      data: { title: '검증 통과' },
      rel: `${BP}/tasks/001/verification.md`,
    },
    review: undefined,
  };
  assert.throws(() => buildCommitMessage(docs, taskUnit), /commit_intent.*1-2/);
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

// --- TASKS-003: finalize 마감 메시지는 blueprint Intent + blueprint title ---

test('finalize commit message is blueprint title plus blueprint Intent', () => {
  const docs = {
    blueprintIndex: {
      data: {
        title: 'task 단위 커밋 단계 신설과 finalize 축소',
        bouncer: {
          commit_type: 'feat',
          // legacy frontmatter intent is ignored; body Intent is authoritative.
          commit_intent: [
            'blueprint 배경은 무시됨',
            'blueprint 의도도 무시됨',
          ],
        },
      },
      body: '## Intent\n- 커밋 단위는 작업인데 마감이 청사진 하나에 묶여 있음\n- 마감은 청사진을 닫는 일만 맡게 함\n',
    },
    tasks: { data: { title: '이 task title은 마감 메시지에 없어야 함' } },
    verification: { data: { title: 'verification title도 없어야 함' } },
    taskUnits: [
      {
        number: 1,
        dir: `${BP}/tasks/001`,
        tasks: {
          data: {
            title: '첫 작업',
            bouncer: {
              commit_intent: [
                '커밋 단위는 작업인데 마감이 청사진 하나에 묶여 있음',
                '마감은 청사진을 닫는 일만 맡게 함',
              ],
            },
          },
          rel: `${BP}/tasks/001/tasks.md`,
        },
      },
    ],
  };
  assert.strictEqual(buildFinalizeCommitMessage(docs), [
    'feat: task 단위 커밋 단계 신설과 finalize 축소',
    '',
    '- 커밋 단위는 작업인데 마감이 청사진 하나에 묶여 있음',
    '- 마감은 청사진을 닫는 일만 맡게 함',
  ].join('\n'));
});

test('finalize commit message omits body when no task has valid commit_intent', () => {
  const docs = {
    blueprintIndex: {
      data: {
        title: 'Login flow',
        bouncer: {
          commit_type: 'fix',
          // blueprint만 있어도 remainder body에 쓰지 않는다.
          commit_intent: [
            'blueprint 두 줄이 있어도',
            'task가 없으면 body가 비어야 함',
          ],
        },
      },
      body: '## Intent\n- 청사진 본문을 기준으로 마감함\n- 작업 필드는 마감 메시지에서 제외함\n',
    },
    verification: { data: { title: 'Login verified' } },
    taskUnits: [
      {
        number: 1,
        dir: `${BP}/tasks/001`,
        tasks: {
          data: {
            title: '한 줄만',
            bouncer: { commit_intent: ['only one line'] },
          },
          rel: `${BP}/tasks/001/tasks.md`,
        },
      },
    ],
  };
  assert.strictEqual(buildFinalizeCommitMessage(docs), [
    'fix: Login flow',
    '',
    '- 청사진 본문을 기준으로 마감함',
    '- 작업 필드는 마감 메시지에서 제외함',
  ].join('\n'));
});

// --- TASKS-004: remainder intent는 task 문서 스캔(가장 큰 번호) ---

test('finalize remainder uses blueprint Intent, ignoring task commit_intent', () => {
  const docs = {
    blueprintIndex: {
      data: {
        title: '커밋 의도 작성 위치를 task 문서로 일원화',
        bouncer: {
          commit_type: 'feat',
          // blueprint에 있어도 remainder는 쓰지 않는다.
          commit_intent: [
            'blueprint 배경은 remainder에 들어가면 안 됨',
            'blueprint 의도도 remainder에 들어가면 안 됨',
          ],
        },
      },
      body: '## Intent\n- 커밋 의도 출처를 청사진으로 일원화함\n- 작업별 의도 스캔을 제거함\n',
    },
    taskUnits: [
      {
        number: 1,
        dir: `${BP}/tasks/001`,
        tasks: {
          data: {
            title: '첫 task',
            bouncer: {
              commit_intent: [
                '001 배경: 앞선 task의 의도',
                '001 의도: 앞선 task만의 변경',
              ],
            },
          },
          rel: `${BP}/tasks/001/tasks.md`,
        },
      },
      {
        number: 2,
        dir: `${BP}/tasks/002`,
        tasks: {
          data: {
            title: '중간 task',
            // task intent does not participate in finalize message generation.
            bouncer: { commit_intent: ['002 한 줄만'] },
          },
          rel: `${BP}/tasks/002/tasks.md`,
        },
      },
      {
        number: 3,
        dir: `${BP}/tasks/003`,
        tasks: {
          data: {
            title: '마지막 task',
            bouncer: {
              commit_intent: [
                '커밋 단위는 task인데 커밋 의도는 상위 문서에 적도록 서술돼 있어 위치가 어긋나 있음',
                '의도를 task 문서에만 쓰도록 좁히고 마감 커밋도 그 문서들에서 의도를 찾게 함',
              ],
            },
          },
          rel: `${BP}/tasks/003/tasks.md`,
        },
      },
    ],
  };
  assert.strictEqual(buildFinalizeCommitMessage(docs), [
    'feat: 커밋 의도 작성 위치를 task 문서로 일원화',
    '',
    '- 커밋 의도 출처를 청사진으로 일원화함',
    '- 작업별 의도 스캔을 제거함',
  ].join('\n'));
});

test('task context preserves authored semantic line breaks and excludes verification', () => {
  const taskUnits = [{
    number: 2,
    tasks: {
      body: `# Tasks

## Goal & intent
첫 번째 줄이다.
두 번째 줄은 저자가 나눈 의미 단위다.

## Interface
- 입력을 그대로 받는다.
- 결과는 한 줄로 반환한다.

## Do not touch
- \`src/legacy/\` 경로

## Checklist
- [ ] 구현
`,
    },
    verification: { body: 'verification evidence must not be copied' },
  }];

  assert.strictEqual(buildTaskContext(taskUnits), `## Tasks

### Task 002

#### Goal & intent

첫 번째 줄이다.
두 번째 줄은 저자가 나눈 의미 단위다.

#### Interface

- 입력을 그대로 받는다.
- 결과는 한 줄로 반환한다.

#### Do not touch

- \`src/legacy/\` 경로
`);
});

test('task message is composed from intent then authored summary', () => {
  const docs = {
    blueprintIndex: { data: { title: '로그인 흐름', bouncer: { commit_type: 'feat' } } },
  };
  const taskUnit = {
    tasks: {
      data: {
        title: '재시도 간격 조정',
        bouncer: {
          commit_intent: ['재시도가 서버에 부담을 줌', '안정적인 재시도 정책이 필요함'],
          commit_summary: ['간격을 지수적으로 늘림', '최대 간격을 제한함'],
        },
      },
    },
    verification: { data: { title: '검증 제목은 사용하지 않음' } },
  };
  assert.strictEqual(buildCommitMessage(docs, taskUnit), [
    'feat: 재시도 간격 조정',
    '',
    '- 재시도가 서버에 부담을 줌',
    '- 안정적인 재시도 정책이 필요함',
    '- 간격을 지수적으로 늘림',
    '- 최대 간격을 제한함',
  ].join('\n'));
});

test('malformed authored fields fail instead of being partially omitted', () => {
  const docs = { blueprintIndex: { data: { title: '로그인 흐름' } } };
  assert.throws(() => buildCommitMessage(docs, {
    tasks: { data: { title: '변경', bouncer: { commit_intent: ['첫 줄임', '둘째 줄임', '셋째 줄임'] } } },
  }), /commit_intent.*1-2/);
  assert.throws(() => buildCommitMessage(docs, {
    tasks: { data: { title: '변경', bouncer: { commit_summary: ['English summary'] } } },
  }), /commit_summary.*한국어/);
  assert.throws(() => buildCommitMessage(docs, {
    tasks: { data: { title: '변경', bouncer: { commit_summary: ['scripts/login.ts를 수정함'] } } },
  }), /commit_summary/);
});

test('authored fields reject package and module names but allow uppercase technical prose', () => {
  const docs = { blueprintIndex: { data: { title: '로그인 흐름' } } };
  assert.throws(() => buildCommitMessage(docs, {
    tasks: { data: { title: '변경', bouncer: { commit_intent: ['lodash 의존성을 제거함'] } } },
  }), /commit_intent/);
  assert.throws(() => buildCommitMessage(docs, {
    tasks: { data: { title: '변경', bouncer: { commit_summary: ['commit-message 모듈을 정리함'] } } },
  }), /commit_summary/);
  assert.throws(() => buildCommitMessage(docs, {
    tasks: { data: { title: '변경', bouncer: { commit_summary: ['express를 제거함'] } } },
  }), /commit_summary/);
  assert.throws(() => buildCommitMessage(docs, {
    tasks: { data: { title: '변경', bouncer: { commit_summary: ['koa 모듈을 정리함'] } } },
  }), /commit_summary/);
  assert.throws(() => buildCommitMessage(docs, {
    tasks: { data: { title: '변경', bouncer: { commit_summary: ['fs 모듈을 정리함'] } } },
  }), /commit_summary/);
  assert.doesNotThrow(() => buildCommitMessage(docs, {
    tasks: { data: { title: '변경', bouncer: { commit_summary: ['API 요청을 처리함'] } } },
  }));
  assert.doesNotThrow(() => buildCommitMessage(docs, {
    tasks: { data: { title: '변경', bouncer: { commit_summary: ['API 모듈을 정리함'] } } },
  }));
  // ALL-CAPS 약어 뒤의 버전 슬래시(HTTP/2)는 모듈 경로가 아니다.
  assert.doesNotThrow(() => buildCommitMessage(docs, {
    tasks: { data: { title: '변경', bouncer: { commit_summary: ['HTTP/2를 지원함'] } } },
  }));
  assert.throws(() => buildCommitMessage(docs, {
    tasks: { data: { title: '변경', bouncer: { commit_summary: ['scripts/lib/를 정리함'] } } },
  }), /commit_summary/);
});

test('authored fields reject lowercase package names in ordinary sentence positions', () => {
  const docs = { blueprintIndex: { data: { title: '로그인 흐름' } } };
  for (const sentence of [
    'fs를 개선함',
    'koa 동작을 개선함',
    'express 처리를 개선함',
    'express를 씀',
    'lodash로 바꿈',
    'fs가 필요함',
  ]) {
    assert.throws(() => buildCommitMessage(docs, {
      tasks: { data: { title: '변경', bouncer: { commit_intent: [sentence] } } },
    }), /commit_intent/);
  }
  assert.doesNotThrow(() => buildCommitMessage(docs, {
    tasks: { data: { title: '변경', bouncer: { commit_intent: ['`HEAD`가 스테이징 범위를 벗어나지 않게 함'] } } },
  }));
  assert.throws(() => buildCommitMessage(docs, {
    tasks: { data: { title: '변경', bouncer: { commit_summary: ['`express`를 씀'] } } },
  }), /commit_summary/);
});

test('finalize message parses blueprint Intent and ignores task authored fields', () => {
  const docs = {
    blueprintIndex: {
      data: { title: '커밋 메시지 계약', bouncer: { commit_type: 'feat' } },
      body: '# Blueprint\n\n## Intent\n- 저작 맥락을 보존함\n- 단계별 메시지를 일관되게 만듦\n\n## Contract\n- 계약\n',
    },
    taskUnits: [{
      number: 1,
      tasks: { data: { bouncer: { commit_intent: ['다른 배경임', '다른 의도임'] } } },
    }],
  };
  assert.strictEqual(buildFinalizeCommitMessage(docs), [
    'feat: 커밋 메시지 계약',
    '',
    '- 저작 맥락을 보존함',
    '- 단계별 메시지를 일관되게 만듦',
  ].join('\n'));
});

test('finalize rejects an absent or malformed blueprint Intent', () => {
  assert.throws(() => buildFinalizeCommitMessage({
    blueprintIndex: { data: { title: '계약' }, body: '# Blueprint\n' },
  }), /Intent/);
  assert.throws(() => buildFinalizeCommitMessage({
    blueprintIndex: { data: { title: '계약' }, body: '# Blueprint\n\n## Intent\n- English only\n' },
  }), /Intent.*한국어/);
});
