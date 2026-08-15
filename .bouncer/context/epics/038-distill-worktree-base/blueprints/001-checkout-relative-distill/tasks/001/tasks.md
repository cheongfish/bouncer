---
type: bouncer.tasks
title: Distill base 해석을 현재 checkout 우선으로 변경
description: Tasks for 001
resource: .bouncer/context/epics/038-distill-worktree-base/blueprints/001-checkout-relative-distill/tasks/001/tasks.md
tags:
  - bouncer
  - tasks
timestamp: '2026-08-15T14:26:51.349+09:00'
bouncer:
  id: TASKS-001
  epic_id: '038'
  blueprint_id: '001'
  status: verified
  commit_intent:
    - linked checkout에서 Distill을 읽으면 main worktree로 강제 매핑되어 승격 대상과 커밋 대상이 갈렸음
    - Distill base 판정을 현재 checkout 우선으로 바꿔 읽기와 쓰기가 같은 checkout을 보게 함
  affected_paths:
    - scripts/src/lib/distill.ts
    - scripts/src/lib/cli-project-commands.ts
    - scripts/lib/distill.js
    - scripts/lib/cli-project-commands.js
    - test/distill.test.js
    - test/cli-project-commands.test.js
    - test/finalize.test.js
  graph:
    generated_at: '2026-08-15T14:26:51.349+09:00'
    command: graphify query
    suggested_paths:
      - scripts/src/lib
      - scripts/lib
      - test
    basis:
      - graph: source
        status: reused
        query: resolveProjectRoot / readShards / cmdDistill
        result: >-
          distill.ts, cli-project-commands.ts와 두 빌드 산출물이 한 커뮤니티로
          묶임. 인접으로 runtime-state.ts, scope.ts, layout.ts, paths.ts,
          test/distill.test.js. resolveProjectRoot는 export되지 않아 외부
          호출자 없음.
      - graph: context
        status: updated
        query: Distill promotion finalize worktree
        result: >-
          .bouncer/distill/git-worktree.md의 Decisions와 epic 037
          promotion-consent 문서가 인접. worktree 경계 규칙이 이번 변경의
          선행 결정임.
---
# Tasks

Blueprint: [001](../../index.md)

## Goal & intent
`distill.ts`의 base 해석기를 현재 checkout 우선으로 바꾸고, `bouncer distill`
명령이 그 해석 결과를 그대로 쓰게 만든다. 완료 후 linked checkout에서
`bouncer distill --all --json`을 실행하면 payload `repoRoot`가 그 checkout의
절대 경로가 되고, Distill이 없는 checkout에서는 종전대로 main worktree가 된다.

지금 `resolveProjectRoot`는 전달받은 root를 항상 `runtimePaths().projectRoot`로
덮어쓴다(`scripts/src/lib/distill.ts:24-39`). 게다가 `cmdDistill`은 아예
`readShards({ repoRoot: paths.projectRoot })`로 main root를 직접 넣는다
(`scripts/src/lib/cli-project-commands.ts:135`). 두 곳을 함께 고쳐야 `--repo`가
checkout 선택으로 동작한다.

## Interface
- 제공:
  - `scripts/src/lib/distill.ts` export에 `resolveDistillRoot`를 추가한다.
    시그니처는 `resolveDistillRoot({ repoRoot, runtime })`이고 절대 경로
    문자열을 돌려준다. 판정 순서는 blueprint Contract의 3단계와 같다.
  - `readShards`는 이 해석기를 통해 base를 정하고, 반환의 `repoRoot`에 그 값을
    담는다(기존 필드, 의미만 확정).
  - `bouncer distill --json` payload의 `repoRoot`가 해석된 base다.
- 거부:
  - `repoRoot`가 Git 저장소가 아니고 Distill도 없으면 `runtimePaths`가
    `unavailable`이므로 전달받은 root를 그대로 쓴다(기존 라이브러리 폴백 유지).
  - `bouncer distill`은 `runtimePaths`가 `unavailable`이면 지금처럼
    `distill: <reason>`을 stderr에 쓰고 exit 1. 이 분기는 유지한다.
  - 새 CLI 플래그를 만들지 않는다. checkout 선택은 기존 `--repo`와 cwd로만 한다.

## Touch
- Modify `scripts/src/lib/distill.ts` — `resolveProjectRoot`를
  `resolveDistillRoot`로 바꿔 checkout 우선 판정을 넣고 export에 추가한다.
- Modify `scripts/src/lib/cli-project-commands.ts` — `cmdDistill`이
  `paths.projectRoot`를 강제하지 않고 해석된 base로 `readShards`와 `readConfig`를
  호출하게 한다. `runtimePaths` 호출은 Git 가용성 판정용으로만 남긴다.
- Modify `scripts/lib/distill.js` — `npm run build` 산출물 재생성.
- Modify `scripts/lib/cli-project-commands.js` — `npm run build` 산출물 재생성.
- Modify `test/distill.test.js` — 해석기 3분기 단위 테스트를 추가한다.
- Modify `test/cli-project-commands.test.js` — 실제 `git worktree`를 만든 뒤
  linked checkout에서 `distill --all --json`의 `repoRoot`를 확인하는 e2e를
  추가한다.
- Modify `test/finalize.test.js` — 에픽 성공 조건 4의 회귀를 추가한다. linked
  checkout에 승격을 쓰고 그 checkout에서 `finalize --yes`를 돌렸을 때
  `.bouncer/Distill.md`와 등록 shard가 staged에 들어가는지 본다. 이 파일은 이미
  worktree fixture와 `writeRegisteredDistillShard` 헬퍼를 갖고 있다.

## Do not touch
- `scripts/src/lib/runtime-state.ts` — `runtimePaths`의 `projectRoot` 의미는
  `.worktrees` 계산과 pointer 파일 위치의 기준이라 바꾸면 안 된다. 이번 변경은
  그 값을 *언제 쓸지*만 바꾼다.
- `scripts/src/lib/scope.ts`, `scripts/src/lib/context-digest.ts` — 두 파일은
  base 이동의 영향을 받지만(Constraints 참조) **코드는 고치지 않는다**. 새 base가
  이들에게 옳은 인덱스를 주는지는 Checklist의 finalize 회귀가 확인한다.
- `scripts/src/lib/cli-git-commands.ts`, `scripts/src/lib/finalize.ts` —
  finalize의 git cwd 계약은 그대로 둔다.
- `CLAUDE.md`, `skills/**` — 프로즈 계약은 task 002가 담당한다.

## Constraints
- shard 인덱스 무효·부재 시의 단일 파일 폴백(`legacyResult`) 판정 경로를 바꾸지
  않는다. 해석기는 base만 고르고 폴백 사유는 종전 그대로 남는다.
- `runtimePaths` 호출은 여전히 try/catch로 감싸 throw를 삼킨다. Git이 없는
  단위 테스트가 계속 통과해야 한다.
- 하위 호환 별칭(`resolveProjectRoot` re-export)을 남기지 않는다. 내부 함수라
  외부 소비자가 없다.
- `scripts/lib` CJS 산출물은 손으로 편집하지 않고 `npm run build`로만 만든다.
- `readShards`의 다른 두 소비자(`scripts/src/lib/scope.ts:31`,
  `scripts/src/lib/context-digest.ts:133`)도 base 이동의 영향을 받는다. 해석기가
  **어느 인덱스 파일을 읽을지**를 정하므로, linked checkout에서 실행하면
  `makeFinalizeAllowed`의 등록 shard 허용 집합과 digest 후보 목록이 그 checkout의
  인덱스에서 나온다. 의도된 변화다 — 커밋 대상 checkout의 인덱스로 그 checkout의
  스테이징을 판정하는 쪽이 옳다. 두 파일의 코드는 고치지 않는다.
- 존재 확인은 `.bouncer/Distill.md` 파일 하나만 본다. shard 디렉터리 유무나
  frontmatter 유효성으로 base를 고르지 않는다 — 그러면 폴백 판정과 뒤섞인다.
- `resolveDistillRoot`는 `readShards`가 지금 쓰는 인자 병합
  (`runtime || suppliedRuntimePaths || suppliedPaths`,
  `scripts/src/lib/distill.ts:151-157`)을 그대로 보존한다. 세 별칭 중 하나만
  받도록 좁히면 기존 호출자가 조용히 폴백 경로로 떨어진다.
- `readConfig`의 base도 함께 옮기되, config가 없을 때 인덱스 flag로 떨어지는
  기존 fail-open(`cli-project-commands.ts:136-151`)은 유지한다.

## Checklist
- [ ] fixture 전제를 먼저 맞춘다. `test/distill.test.js`의 임시 저장소 경로는
      `fs.realpathSync(os.tmpdir())` 기준으로 만든다 — `runtimePaths`가
      `path.resolve(repoRoot, git-common-dir)`로 계산하므로
      (`scripts/src/lib/runtime-state.ts:19-41`) symlink된 tmpdir에서는 fixture
      경로와 문자열이 어긋난다.
- [ ] `test/distill.test.js`에 실패 테스트를 먼저 추가한다. `git worktree`로
      linked checkout을 만들고 그쪽에만 Distill을 둔 뒤:
      ```js
      assert.strictEqual(resolveDistillRoot({ repoRoot: linked }), linked);
      ```
- [ ] 같은 파일에 폴백 두 분기를 추가한다. 두 번째 fixture는 main worktree의
      Distill을 **커밋하지 않은** 상태로 둬야 한다 — tracked면 `git worktree
      add`가 linked checkout에도 체크아웃해서 1단계에 걸린다.
      ```js
      // linked checkout에 Distill이 없으면 main worktree
      assert.strictEqual(resolveDistillRoot({ repoRoot: linkedNoDistill }), primary);
      // Git 저장소가 아니면 전달받은 root 그대로
      assert.strictEqual(resolveDistillRoot({ repoRoot: nonGit }), nonGit);
      ```
- [ ] `npm run build` 후 `node --test test/distill.test.js`를 돌린다. 아직
      `resolveDistillRoot` export가 없으므로 첫 red는 단정 실패가 아니라
      **missing export**다. `test/distill.test.js`는 빌드 산출물
      `../scripts/lib/distill`을 import하므로 이 순서가 맞다.
- [ ] `scripts/src/lib/distill.ts`에서 `resolveProjectRoot`를
      `resolveDistillRoot`로 바꾸고 1단계 존재 확인을 넣는다. 인자 병합
      (`runtime || suppliedRuntimePaths || suppliedPaths`)은 그대로 옮긴다.
      `module.exports`에 `resolveDistillRoot`를 추가한다.
- [ ] `scripts/src/lib/cli-project-commands.ts` `cmdDistill`에서
      `readShards({ repoRoot: paths.projectRoot, runtime: paths })`를 해석된
      base 기준으로 바꾸고, `readConfig`도 같은 base를 받게 한다. Git 가용성
      실패 시 stderr + exit 1 분기는 그대로 둔다.
- [ ] `npm run build`로 `scripts/lib/distill.js`와
      `scripts/lib/cli-project-commands.js`를 재생성한다.
- [ ] `test/cli-project-commands.test.js`에 e2e를 추가한다. primary와 linked
      checkout을 만들고 linked에서 실행했을 때:
      ```js
      const payload = JSON.parse(capture(['distill', '--all', '--json', '--repo', linked]).out);
      assert.strictEqual(payload.repoRoot, linked);
      ```
- [ ] `test/finalize.test.js`에 에픽 성공 조건 4의 회귀를 추가한다. linked
      checkout에 등록 shard와 Distill을 두고 그 checkout을 `repoRoot`로 삼아:
      ```js
      const res = finalize({ repoRoot: linked, blueprintDir: BP_REL, yes: true, git: g.api, clearPointer: () => true });
      assert.ok(res.staged.includes('.bouncer/Distill.md'));
      assert.ok(res.staged.includes('.bouncer/distill/core.md'));
      ```
- [ ] `npm test`가 통과한다.
