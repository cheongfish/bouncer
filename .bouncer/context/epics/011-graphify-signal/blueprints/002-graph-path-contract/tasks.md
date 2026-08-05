---
type: bouncer.tasks
title: source_dirs 기본값을 실재 탐지로 바꾸고 신선도·산출 경로를 스캔 대상과 분리함
description: init 기본값 탐지, mtime 탐색 제외 목록, part 빌드 cwd 격리
resource: .bouncer/context/epics/011-graphify-signal/blueprints/002-graph-path-contract/tasks.md
tags:
  - bouncer
  - tasks
timestamp: '2026-08-04T15:34:53.569+09:00'
bouncer:
  id: TASKS-002
  epic_id: '011'
  blueprint_id: '002'
  status: verified
  affected_paths:
    - scripts/src/lib/init.ts
    - scripts/lib/init.js
    - scripts/src/lib/session-graph.ts
    - scripts/lib/session-graph.js
    - test/init.test.js
    - test/session-graph.test.js
    - docs/configuration.md
  graph:
    generated_at: '2026-08-04T15:42:55+09:00'
    command: graphify query (source + context)
    suggested_paths:
      - scripts/src/lib
      - scripts/lib
      - test
      - docs
    basis: source 질의 "init default config source_dirs newestMtimeUnder runGraphifyUpdate graphifyOutEnv defaultExecGraphify"는 init.ts/js와 session-graph.ts/js를 함께 돌려줬다. 두 파일이 한 커밋에 들어가는 이유가 그래프에도 그대로 보인다 — session-graph가 init을 부트스트랩 경로로 직접 require하므로, 설정 기본값과 그래프 경로 계산이 같은 호출 사슬 위에 있다. cli는 명령 진입점일 뿐이고 time은 타임스탬프 경로라 둘 다 Do not touch로 내렸다. context 질의 "init scaffold config source_dirs graph freshness output path"는 EPIC-004(starter-kit-convergence)를 집었는데, 그쪽은 init이 만드는 규칙 파일과 문서 골격을 다룬 스트림이고 config 기본값이나 그래프 경로를 건드리지 않아 겹치는 작업이 없다. 같은 질의가 다른 저장소의 절대 경로 노드(sdd-plugin)를 하나 돌려줬다 — 이전 빌드가 남긴 오염된 노드라 근거에서 제외했다. docs는 config.source_dirs 밖이라 수동으로 보탰다.
---
# Tasks

Blueprint: [002](index.md)

## Goal & intent
`bouncer init`이 저장소 루트를 보고 실재하는 디렉터리만 `source_dirs`에 넣는다. 신선도
판정의 mtime 탐색이 `graphify-out`·`node_modules`·`.git`을 건너뛰어, `source_dirs`가
`["."]`여도 두 번째 동기화가 `skip-fresh`가 된다. part 빌드는 자기 산출 디렉터리를
작업 디렉터리로 삼아, `graphify`가 고정 위치에 쓰는 `manifest.json`이 저장소 루트를
침범하지 않는다. 그래프 산출물의 경로·형식과 빌드 대상 선정 규칙은 그대로다.
검증은 `npm test`.

## Interface
- 제공: `init`의 기본 설정에서 `source_dirs`가 고정 후보 목록 중 저장소 루트에 실재하는
  디렉터리만 순서대로 담는다. 후보는 `['src', 'lib', 'app', 'packages', 'scripts', 'test',
  'tests']`이며 이 순서가 결과 순서다.
- 제공: 후보가 하나도 없으면 `source_dirs`는 `[]`이고, `init` 반환에 사용자가 값을
  직접 채워야 한다는 안내가 실린다. 기존 `gitignoreSuggestions`와 같은 층위의 필드다.
- 제공: 최신 mtime 탐색이 이름 기준 제외 목록(`graphify-out`, `node_modules`, `.git`,
  `.worktrees`)에 해당하는 디렉터리로 내려가지 않는다.
- 제공: part 빌드가 `graphify update`를 그 part의 산출 디렉터리를 cwd로 두고 호출하며,
  스캔 대상은 절대 경로로 넘긴다. 호출 전에 그 디렉터리를 생성한다.
- 거부: `init`은 이미 존재하는 `.bouncer/config.json`의 `source_dirs`를 덮어쓰지 않는다.
  탐지는 새로 만들 때만 일어난다.
- 거부: 제외 목록을 설정 키로 노출하지 않는다. 사용자가 산출물 디렉터리를 다시 스캔
  대상에 넣을 수 있으면 같은 무한 재빌드가 되살아난다.
- 거부: 심볼릭 링크를 따라 내려가지 않는다. 순환으로 탐색이 멈추지 않는 상황을 만들지
  않는다.

## Touch
- Modify `scripts/src/lib/init.ts` — 고정 `source_dirs` 기본값을 실재 탐지로 교체하고,
  후보가 없을 때의 안내를 반환에 싣는다.
- Modify `scripts/lib/init.js` — 위 소스의 빌드 산출물. `npm run build`(`pretest`)로
  재생성해 커밋한다. 손으로 편집하지 않는다.
- Modify `scripts/src/lib/session-graph.ts` — `newestMtimeUnder`에 제외 목록과 심볼릭
  링크 차단을 넣고, `runGraphifyUpdate`의 cwd·인자 계약을 바꾼다.
- Modify `scripts/lib/session-graph.js` — 위 소스의 빌드 산출물. 재생성해 커밋한다.
- Modify `test/init.test.js` — 탐지 결과, 후보 없음, 기존 설정 보존을 덮는다.
- Modify `test/session-graph.test.js` — 제외 목록이 적용된 mtime 탐색과 part 호출 계약을
  덮는다.
- Modify `docs/configuration.md` — `source_dirs` 기본값 표기를 실제 동작으로 고친다.

## Do not touch
- `hooks/session-graph.js` — 경고 출력은 001이 세운 표면이다. 이 커밋은 원인을
  줄일 뿐 신호를 바꾸지 않는다.
- `skills/graphify-runner/SKILL.md` — 같은 이유.
- `scripts/src/lib/scaffold.ts`, `scripts/src/lib/templates.ts` — 문서 스캐폴딩은 이
  변경과 무관하다. `init`이 만지는 것은 `config.json`이다.
- `scripts/src/lib/schema.ts` — 새 설정 키를 만들지 않는다.
- `scripts/src/lib/validate.ts` — 게이트 판정은 그대로다.
- `.bouncer/config.json` — 이 저장소의 설정은 이미 실재 디렉터리를 가리키고 있어 고칠
  것이 없다. 마이그레이션도 하지 않는다.

## Constraints
- 빌드 대상 선정(`planOneGraph`/`planSessionGraph`)의 판정 규칙을 바꾸지 않는다. 기존
  테스트가 수정 없이 통과해야 하며, 그것이 이 커밋의 경계다.
- 그래프 산출물의 경로와 스키마를 바꾸지 않는다 — part는
  `graphify-out/<scope>/parts/<slug>/`, 스코프 그래프는 `graphify-out/<scope>/graph.json`.
- `scripts/lib/*.js`는 `npm run build` 산출물이다. 소스는 항상 `scripts/src/**`.
- 새 런타임 의존성을 추가하지 않는다 (Node 표준 라이브러리 + 벤더링 `js-yaml`).
- 후보 목록과 제외 목록은 이름 있는 상수로 두고 테스트가 그 상수를 참조한다. 문자열을
  호출부에 흩지 않는다.
- `init`이 기존 설정을 보존한다는 현재 성질을 깨지 않는다.

## Checklist
- [ ] `test/init.test.js`에 실패 테스트를 먼저 추가하고 `npm test`로 **예상된 이유로**
      실패하는지 확인한다.
      ```js
      // lib/ 와 app/ 만 있는 저장소
      assert.deepStrictEqual(cfg.source_dirs, ['lib', 'app']);
      // 후보가 하나도 없는 저장소
      assert.deepStrictEqual(cfg.source_dirs, []);
      assert.ok(result.sourceDirsUnresolved === true);
      // 기존 config는 보존된다
      assert.deepStrictEqual(existing.source_dirs, ['custom']);
      ```
- [ ] `scripts/src/lib/init.ts`에 후보 상수를 두고 탐지를 구현한다.
      ```js
      const SOURCE_DIR_CANDIDATES = ['src', 'lib', 'app', 'packages', 'scripts', 'test', 'tests'];
      ```
      결과 순서는 이 배열의 순서다. 디렉터리인지까지 확인한다(동명 파일 제외).
- [ ] 후보가 없을 때의 안내를 `init` 반환에 싣는다. 기존 `created` /
      `gitignoreSuggestions`와 같은 층위이며, 기존 필드의 의미와 타입은 바꾸지 않는다.
- [ ] `test/session-graph.test.js`에 mtime 제외 실패 테스트를 추가하고 실패를 확인한다.
      ```js
      // dir 아래 graphify-out/ 이 더 최신이어도 무시된다
      assert.strictEqual(newestMtimeUnder(repo, '.'), mtimeOfSourceFile);
      ```
- [ ] `newestMtimeUnder`에 제외 목록과 심볼릭 링크 차단을 넣는다.
      ```js
      const SCAN_EXCLUDED_DIRS = new Set(['graphify-out', 'node_modules', '.git', '.worktrees']);
      // walk 내부: e.isDirectory() && !e.isSymbolicLink() && !SCAN_EXCLUDED_DIRS.has(e.name)
      ```
      `realExistingDirs`는 건드리지 않는다 — 실재 판정과 스캔 제외는 다른 질문이다.
- [ ] `runGraphifyUpdate`를 cwd 격리로 바꾼다. part 산출 디렉터리를 먼저 만들고, 그
      디렉터리를 cwd로, 스캔 대상을 절대 경로로 넘긴다. `graphifyOutEnv`가 새 cwd 기준
      상대경로를 내도록 함께 고치고, 주석의 전제(스캔 대상 기준 상대경로)를 실제 계약에
      맞춰 갱신한다.
- [ ] part 호출 계약의 테스트를 더한다. `execFileSync` 호출 인자를 검사하는 방식이 아니라,
      주입 가능한 실행 함수로 호출 옵션을 관측한다. 최소한 cwd가 part 산출 디렉터리이고
      스캔 대상이 절대 경로임을 단언한다.
- [ ] `docs/configuration.md`의 `source_dirs` 행에서 `["src", "test"]` 고정 표기를 실제
      동작(실재 후보 탐지, 없으면 빈 배열)으로 고친다.
- [ ] 통합 확인 A — `source_dirs: ["."]`인 임시 저장소에서 `bouncer graph-sync`를 연속
      두 번 실행해 두 번째가 `skip-fresh`인지 확인한다.
- [ ] 통합 확인 B — 저장소 루트 `graphify-out/manifest.json`에 표식을 넣고 두 개 이상의
      part를 빌드한 뒤 그 표식이 남아 있는지 확인한다. part 안에 `manifest.json`이
      떨어졌는지도 함께 본다.
- [ ] `npm test`가 통과할 때까지 마무리한다. `pretest`가 `scripts/lib/*.js`를 재생성하므로
      산출물 diff가 함께 남는지 확인한다.
