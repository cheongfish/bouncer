---
type: bouncer.explain
title: 지시문 층 역할 헌장과 재진술 제거
description: 네 지시문 층의 경계를 표로 세우고 마스터 룰·core.md 재진술을 지우며 Distill 승격과 설치 안내를 그 경계에 맞춘다
resource: .bouncer/context/epics/001-product-surface-hosts/blueprints/008-instruction-layers/explain.md
tags:
  - bouncer
  - explain
timestamp: '2026-08-31T09:51:56.475+09:00'
bouncer:
  id: EXPLAIN-008
  epic_id: '001'
  blueprint_id: '008'
  status: published
  comprehension:
    - range_from: develop
      range_to: a15fa5b46caba38c678c441b40e8e0f8c68dc96e
      diff_sha: 6bc024191e7b443b5d54a7546c464962927ad601a5ee330ca59815cdc1fca4d8
      quiz_score: 3/4
      disposition: 사다리 2·3단을 stdlib→native로 골랐고 native→stdlib·YAGNI 부재가 정답임
      recorded_at: '2026-08-31T09:54:18+09:00'
---
# Explain

## Background

지시문은 하드룰, 워크플로 절차, 공유 계약, 이 저장소에서만 참인 사실 네 층인데
어느 층이 무엇을 말하는지 적은 문서가 없었다. 같은 문장이 `CLAUDE.md`와 스킬에
겹치고, `always: true`인 `.bouncer/distill/core.md`가 마스터 룰과 `rules/`를
다시 실었다. 승격은 동의만 받고 상위 층 재진술인지 묻지 않았다.

`docs/install.md`는 호스트 플러그인 설치가 `bouncer-root`를 PATH에 올린다고
적었는데, 호스트는 캐시 복사만 하고 `npm install`을 돌리지 않는다. 워크플로
셸 첫 줄이 그 명령이라 등록 전에는 `command not found`로 죽는다.

이 회차는 헌장 표를 `CLAUDE.md`에 두고, 스킬이 이미 더 구체적으로 말하는
하드룰 본문은 `Detail:` 포인터로 줄이고, 승격 제안에 재진술 제외를 넣고,
`core.md` 네 절과 implementer 사다리 순서를 정본에 맞추고, 설치 안내를
경로별로 고친다.

## Intuition

네 층 표가 정본이고, 아래 층은 위 층이 이미 말한 문장을 다시 쓰지 않는다.

## Code

- `CLAUDE.md` — `## Instruction layers` 표. 하드룰 7은 Distill 정본 경로,
  승격 동의 한 번, `--route` 합산을 샤드 본문으로 붙이지 않는다는 셋만 남기고
  절차는 스킬·레퍼런스로 포인터. 세션수칙 4는 `references/verification/index.md`.
- `test/master-rules.test.js` — 옮겨 간 문자열은 보유 파일에 `match`,
  `CLAUDE.md`에는 `doesNotMatch`.
- `skills/bouncer-finalize/references/distill-promotion.md`,
  `references/spec-authoring/index.md` — `add`/`replace` 앞에서 상위 세 층을
  보고, 제외 목록을 제안과 같은 ACQ에 싣는다. `drop`에는 제외를 적용하지 않는다.
- `.bouncer/distill/core.md` — 하드룰 1 불릿 전체, 포인터 표면 재진술,
  워크플로 순서 재진술, "minimality는 스킬에만 산다"를 지움. 포인터 파일
  경로·JSON, G16, confirm-then `--set`, `scripts/`가 Intensity 매핑을 읽지
  않는다는 문장은 남김.
- `agents/bouncer-implementer.md` — 사다리 2·3단을 native → stdlib. YAGNI
  단은 구현 경로에 없다(승인된 브리프를 줄이지 않음).
- `docs/install.md`, `rules/plugin-root.md` — 호스트 설치는 `scripts/`를
  PATH에 넣는 단계. 로컬 `npm install`은 `node_modules/.bin`. `-g` / `npm link`는
  prefix `bin`. `BOUNCER_HOME`은 한 번 오버라이드.

## Quiz

1. Distill 층(`## Instruction layers`의 Repo-true)에 앉힐 문장은 무엇인가?
   - A) 모든 호스트에서 같은 워크플로 순서
   - B) 이 체크아웃에서만 참인 사실
   - C) 게이트 코드가 읽는 설정 키

2. Distill 승격에서 상위 층이 이미 같은 계약을 말할 때 어떻게 하는가?
   - A) `drop` 목록에 넣고 게이트를 실패시킨다
   - B) `add`/`replace`에서 조용히 버린다
   - C) `add`/`replace`에서 빼되 제외 목록과 근거 경로를 같은 ACQ에 싣는다

3. 이 회차 이후 implementer 사다리 2·3단과 YAGNI는?
   - A) native 다음 stdlib. YAGNI 단은 구현 경로에 없다
   - B) stdlib 다음 native. YAGNI를 에이전트에 넣었다
   - C) native만 남기고 stdlib 단을 지웠다

4. 호스트 플러그인 설치에서 `bouncer-root`는 어떻게 등록하는가?
   - A) `"private": true`를 끄면 호스트가 bin을 링크한다
   - B) 플러그인 루트 `scripts/`를 PATH에 넣는다. 로컬 `npm install`은
     `node_modules/.bin`만 링크한다
   - C) `npm install -g bouncer`로 레지스트리 패키지를 깐다

## 이해 상태

퀴즈 4문항, 응답 4, 정답 3 (`quiz_score: 3/4`).

- Q1 Repo-true: B (정답). 응답 B. 맞음.
- Q2 승격 제외: C (정답). 응답 C. 맞음.
- Q3 사다리: A (정답, native→stdlib, YAGNI 없음). 응답 B. 틀림.
- Q4 호스트 PATH: B (정답). 응답 B. 맞음.

disposition: 사다리 2·3단을 stdlib→native로 골랐고 native→stdlib·YAGNI 부재가 정답임.
range_from `develop` .. range_to `a15fa5b46caba38c678c441b40e8e0f8c68dc96e`.
diff_sha `6bc024191e7b443b5d54a7546c464962927ad601a5ee330ca59815cdc1fca4d8`.

## Tasks

### Task 001

#### Goal & intent

`CLAUDE.md`를 읽는 세션이 "어떤 규칙이 어느 층에 사는가"를 표 하나로 판정할 수 있게 된다. 지금은 그 경계가 어디에도 없어서, 마스터 룰이 스킬·레퍼런스가 이미 실행 가능한 형태로 말하는 것을 축약 재진술한다(감사 B14 표 10행). 이 task는 `## Instruction layers` 표를 더하고, 그 헌장이 "스킬에만 있어야 한다"고 판정하는 하드룰 본문을 `Detail: <경로>` 포인터로 줄인다 — 하드룰 10이 이미 쓰고 있는 형식이 본보기다.

예산이 이 작업을 강제한다. `CLAUDE.md`는 6,127B이고 상한이 6,135B(`test/master-rules.test.js`)라 여유가 8바이트다. 표를 *더하는* 변경이므로 같은 커밋에서 회수하지 않으면 테스트가 먼저 막는다. 회수량 1순위는 하드룰 7(1,623B, 파일의 26.5%)이고, 그 내용은 plan·execute·run의 **Project root**·**Project Distill** 블록과 `skills/bouncer-finalize/references/distill-promotion.md`가 셸까지 붙여 이미 말하고 있다.

삭제는 단독 편집이 아니다. 룰 1·2·3·5·6·7·8·9·11이 `test/master-rules.test.js`의 문자열 단언에 묶여 있으므로, 본문을 줄이는 것과 그 단언을 실제 보유 파일로 옮기는 것이 **한 커밋**이다. 앵커를 약화시켜 통과시키는 것은 이 task의 실패다 — 같은 계약 문자열이 다른 파일에서 단언되어야 한다.

#### Interface

- 제공:
  - `CLAUDE.md`에 `## Instruction layers` 절. 네 행 표 — 하드룰(`CLAUDE.md`) / 절차(`skills/*/SKILL.md`) / 계약(`rules/*.md`, `references/*/index.md`) / 이 저장소에서만 참인 것(`.bouncer/Distill.md`). 각 행은 담는 것·담지 않는 것·정본 위치를 가진다. `## When to invoke` 표는 이 헌장에서 "워크플로 진입 라우팅 인덱스"로 자리를 얻고 그대로 남는다.
  - 하드룰 7 본문을 `Detail:` 포인터 형태로 축약. **잔류 계약 셋은 남긴다** — Distill 정본이 `${PROJECT_ROOT}/.bouncer/Distill.md`이고 플러그인 루트·execute worktree cwd가 기준이 아니라는 것, finalize 승격이 동의 한 번을 받는다는 것, 그리고 aggregate/`--route` 출력을 개별 샤드 본문이나 쓰기 대상으로 붙이지 않는다는 것. 나머지는 plan/execute/run과 finalize 레퍼런스를 가리키는 포인터로 바꾼다.
  - B14 표의 나머지 행은 아래 처분표대로 다룬다. 룰 번호와 제목 줄은 그대로 둔다.
  - `test/master-rules.test.js`의 앵커 갱신: `CLAUDE.md`에서 사라진 계약 문자열마다 그 문자열을 실제로 담는 파일에 대한 단언을 세운다.
- 거부:
  - 하드룰 11(`Trust boundary`)의 번호·제목·본문 변경. 12곳 이상이 번호로 인용하고 `test/master-rules.test.js`가 이 룰을 신뢰 경계 SSOT로 못박는다.
  - 룰 번호 재배열. 자리는 두고 본문만 줄인다 — 인용 표면을 지키는 유일한 방법이다.
  - 앵커 단언의 삭제·약화(정규식 완화, `assert.ok(true)`, 스킵). 옮기는 것만 허용한다.
  - `## When to invoke` 표와 `## Plugin root` 절의 삭제. 각각 `test/master-rules.test.js`가 행 구조와 `bouncer-root --auto`·`BOUNCER_HOME`을 단언한다.
  - 상한 자체의 완화. 6,135B는 #80이 건 값이고 이 task의 입력이지 조정 대상이 아니다.

### B14 행별 처분
계획 시점에 앵커 보유 여부를 확인해 정한 값이다. 실행 중 판단으로 바꾸지 않는다.

| 행 | 처분 | 근거 |
| --- | --- | --- |
| 하드룰 1 후반 (루트 `context/` 비정규) | 삭제 | `skills/bouncer-init/SKILL.md`가 담고, `CLAUDE.md` 앵커가 없다 |
| 하드룰 3 (증거는 execute 게이트가 쓴다) | 축약, `execute gate` 문구 유지 | 앵커가 그 문구를 `CLAUDE.md`에서 요구한다 |
| 하드룰 5 후반 (plan은 `/bouncer-run`을 가리킨다) | 포인터화 | 순서 화살표·`/bouncer-commit`·`When to invoke` 행 앵커는 전반부와 표에 남는다 |
| 하드룰 7 | 잔류 계약 셋만 남기고 포인터화 | 회수량 1순위 |
| 하드룰 8 | **축약하지 않음** | 재진술이 아니라 유일 진술이다 — `.bouncer/context/epics/**` 본문이 한국어라는 범위 규칙을 다른 층이 말하지 않는다. `references/stop-slop/index.md`는 문체 지침이지 범위 규칙이 아니다 |
| 세션수칙 2·4 | 포인터화 | `CLAUDE.md` 앵커가 없다 |
| `## When to invoke` 표 | 유지 | blueprint Out of scope에 근거를 적었다 |

#### Touch

- Modify `CLAUDE.md` — `## Instruction layers` 표를 더하고, B14 표가 지목한 하드룰·세션수칙 본문을 `Detail:` 포인터로 축약한다.
- Modify `test/master-rules.test.js` — `CLAUDE.md`에서 옮겨간 계약 문자열의 단언을 새 보유 파일 대상으로 갱신하고, 반복 `--for` 형식을 요구하는 파일 목록에서 `CLAUDE.md`를 뺀다.

#### Constraints

- 최종 `CLAUDE.md`는 6,135 UTF-8 바이트 이하여야 한다. 검증은 `npm run ci`가 한다.
- `CLAUDE.md`는 한국어 본문 규칙(하드룰 8)의 적용 대상이 아니다 — 현행대로 영어를 유지한다. 한국어 대상은 `.bouncer/context/epics/**`와 BP `explain.md`다.
- 포인터 줄은 실재하는 경로만 가리킨다. 가리킨 파일이 그 계약을 실제로 담고 있어야 하며, 담고 있지 않으면 그 행은 축약하지 않는다.
- 하드룰 절에는 코드 펜스를 넣지 않는다(현행 테스트가 `## Session conduct` 앞 구간에 ``` 부재를 단언한다).
- `## Session conduct` 제목과 `## Plugin root` 절의 셸 블록은 유지한다.

### Task 002

#### Goal & intent

`/bouncer-finalize`의 Distill 승격이 지금은 `drop` → `replace` → `add` 목록을 만들어 동의를 **한 번** 받는 것이 전부다. "이 문장을 상위 층이 이미 말하고 있는가"를 묻는 자리가 없어서, 사이클마다 마스터 룰·`rules/`·스킬의 재진술이 Distill로 흘러들 수 있다. `.bouncer/distill/core.md`의 중복 네 문장이 그 결과물이고, `always: true` 샤드라 모든 라우트에 무조건 실린다.

이 task는 제안 목록을 만드는 단계에 **재진술 제외**를 넣는다. 후보마다 상위 층이 이미 같은 계약을 말하는지 판정하고, 말한다면 `add`/`replace` 목록에서 빼되 **버리지 않고** 제외 목록으로 보여준다 — 제외 항목과 그 근거(어느 파일이 이미 말하는가)를 같은 ACQ에 싣는다. 사용자가 그 판정을 뒤집을 수 있어야 하므로 필터는 게이트가 아니다. 하드룰 3·4가 정한 판정 주체(게이트와 사용자)는 바뀌지 않는다.

이 task는 task 001 다음에 온다. task 001이 `skills/bouncer-finalize/references/distill-promotion.md`로 옮겨 놓은 계약 앵커(`audit.shards`, `# <id>`, id 집합 불일치, 상대 경로)를 이 task의 편집이 깨뜨리면 안 된다 — 문장을 더할 뿐 옮겨온 문장을 다시 쓰지 않는다.

task 001이 세운 `## Instruction layers` 헌장이 이 판정의 기준이다. 헌장이 "이 문장은 절차 층에 산다"고 말하면, 같은 문장이 Distill(이 저장소에서만 참인 것) 층에 앉을 이유가 없다.

#### Interface

- 제공:
  - `skills/bouncer-finalize/references/distill-promotion.md`의 제안 계약에 재진술 제외 단계. 후보를 `add`/`replace`로 올리기 전에 상위 층(하드룰 `CLAUDE.md` / 절차 `skills/*/SKILL.md` / 계약 `rules/*.md`·`references/*/index.md`)이 이미 같은 계약을 진술하는지 판정한다.
  - 제외 결과의 표시 의무: 하나의 ACQ에 제안 목록과 **제외 목록**을 함께 싣고, 제외 항목마다 그렇게 판정한 근거 파일 경로를 붙인다. 제외가 0건이면 그 사실을 한 줄로 보고한다.
  - `references/spec-authoring/index.md`의 Distill 승격 절이 같은 제외 단계를 반영한다 — 승격 본문을 쓰는 쪽과 제안을 만드는 쪽의 계약이 어긋나지 않아야 한다.
- 거부:
  - 제외를 자동 적용해 후보를 조용히 버리는 것. 제외는 목록에서 빼는 것이지 삭제가 아니며, 근거 없이 제외하지 않는다.
  - 제외를 게이트로 만드는 것. 실패 코드(G/S)를 새로 만들거나 기존 게이트가 제외 결과를 읽게 하지 않는다.
  - 후보마다 따로 묻는 것. 현행 계약은 "한 번의 ACQ, 목록 전체 승인/수정/건너뛰기"이고 그대로 유지한다.
  - `drop` 판정에 제외를 적용하는 것. `drop`은 이미 Distill에 있는 낡은 문장을 지우는 방향이라 재진술 판정의 대상이 아니다.
  - `auto`·`light`에서 동의를 건너뛰는 것. 현행 계약대로 두 경우 모두 동의가 필요하다.

#### Touch

- Modify `skills/bouncer-finalize/references/distill-promotion.md` — 제안 목록 생성에 재진술 제외 단계와 제외 목록 표시 의무를 넣는다.
- Modify `references/spec-authoring/index.md` — 승격 절의 계약을 같은 제외 단계에 맞춘다.
- Modify `test/master-rules.test.js` — 두 문서가 제외 단계와 근거 표시를 담는지 단언한다(이 파일이 이미 `finalize`/`spec` 쌍을 함께 읽는 승격 계약 테스트를 가진다).

#### Constraints

- 제안·동의 계약의 기존 문장을 유지한다 — `drop` → `replace` → `add` 순서, 한 번의 ACQ, 승인/수정/건너뛰기 세 갈래, 거절 시 아무것도 쓰지 않고 다음 단계로 계속.
- 이 두 문서는 영어 지시문이다. 하드룰 8의 한국어 대상이 아니다.
- `references/spec-authoring/index.md`는 `BOUNCER_ROOT`를 해석하거나 `scripts/bouncer`를 호출하지 않는다 — 현행 단언이 이를 막고 있으므로 추가 문장도 CLI 호출을 지시하지 않는다.
- 재진술 판정의 근거 층 목록은 task 001의 `## Instruction layers` 표와 같은 네 층이어야 한다.

### Task 003

#### Goal & intent

`.bouncer/distill/core.md`는 `always: true` 샤드라 모든 라우트·모든 사이클에 무조건 실린다. 그 안에 상위 층이 이미 말하는 네 문장이 그대로 있다 — 워크플로 순서(하드룰 5), 정본 문서 위치(하드룰 1), 활성 포인터 표면(`rules/current-pointer.md`), 그리고 minimality 정본 주장(`references/minimality/index.md`). Distill 층은 "이 저장소에서만 참인 것"을 담는 자리이므로 이 넷은 층을 잘못 앉은 문장이다.

네 번째 문장은 중복일 뿐 아니라 **사실이 아니다**. `Minimality lives only in the minimality skill`이라고 적혀 있지만, `references/implementation/index.md`가 정본을 `agents/bouncer-implementer.md`로 지목하고 사다리가 실제로 거기 인라인으로 있다. 두 벌은 이미 갈라졌다 — 스킬은 7단(YAGNI 포함, native → stdlib), 에이전트는 6단(YAGNI 없음, stdlib → native). YAGNI 단의 부재는 의도로 읽힌다(구현 단계에서 승인된 브리프를 줄이면 안 된다). **순서가 뒤집힌 것은 의도로 보이지 않는다.** 게다가 스킬의 Intensity 절이 `bouncer.scale: light`에서 1–4단만 적용하라고 정하는데, `agents/bouncer-implementer.md`에는 `scale`도 `light`도 0회 등장한다 — 구현 경로에 그 매핑의 소비자가 없다.

이 task는 헌장을 새로 정하지 않는다. 이미 선언된 정본을 이행할 뿐이다.

#### Interface

- 제공:
  - `.bouncer/distill/core.md`에서 상위 층 재진술 **절(clause)** 제거. 대상 넷은 각각 더 긴 불릿 안에 있으므로 불릿 통째로 지우지 않는다 — 아래 Checklist의 절 단위 표가 무엇이 지워지고 무엇이 남는지 정한다.
  - `agents/bouncer-implementer.md` 사다리의 네이티브 플랫폼·표준 라이브러리 순서를 `references/minimality/index.md`와 같은 순서(native → stdlib)로 맞춘다.
  - 두 문서의 단 수 차이(7단 대 6단)에 대한 명시적 근거 한 줄 — YAGNI 단이 구현 경로에 없는 것은 의도이며, 승인된 브리프를 구현에서 줄이지 않기 때문이라는 진술을 에이전트 문서에 남긴다.
  - `bouncer.scale` Intensity 매핑에 대한 결정: **아무것도 더하지 않는다.** `references/minimality/index.md`의 Intensity 절이 이미 "This mapping is a skill judgment criterion — not a gate and not a CLI path"라고 적고, `docs/ARCHITECTURE.md` §E가 같은 것을 기록한다. 매핑의 소비자는 계획·리뷰 판정이고 구현 경로에는 없다는 것이 결정이며, 새 문장을 더하면 이 blueprint가 지우려는 재진술을 하나 만드는 것이다.
- 거부:
  - `.bouncer/distill/core.md`의 Distill SSOT 결정 문장 삭제. `test/master-rules.test.js`가 이 파일에 반복 `--for` 형식을 요구한다.
  - `core.md`에서 이 저장소에만 참인 문장 삭제 — 라우팅 활성화 조건, `always`-only `core`, stderr 규약, `distill.max_bytes` 경고 전용, 넓은 디렉터리 `affected_paths`의 G12 함정, `git ls-files` 미추적 파일 함정, Distill SSOT 결정, 그리고 대상 불릿 안에 함께 있는 저장소 고유 절(포인터 파일 경로와 JSON 형태, G16 차단 조건, confirm-then `--set` 인계). 이 문장들은 Distill 층에 올바로 앉아 있다.
  - 사다리 단 수를 억지로 맞추는 것. 7단과 6단의 차이는 YAGNI 하나이고 그 부재는 의도다 — 에이전트에 YAGNI 단을 넣지 않는다.
  - `references/minimality/index.md`의 7단 순서·번호 변경. `test/skill-minimality.test.js`가 native와 stdlib이 서로 다른 단 번호를 갖는지 단언하고, `docs/ARCHITECTURE.md` §E가 7단을 기록한다.
  - `scripts/`가 이 매핑을 읽게 만드는 것. 현행 진술("`scripts/`는 이 매핑을 읽지 않는다")을 유지한다.

#### Touch

- Modify `.bouncer/distill/core.md` — 상위 층 재진술 네 문장을 제거한다.
- Modify `agents/bouncer-implementer.md` — 사다리 2·3단 순서를 스킬과 맞추고, YAGNI 부재 근거와 `bouncer.scale` 관련 진술을 적는다.
- Modify `test/skill-minimality.test.js` — 에이전트 사다리의 native/stdlib 순서가 스킬과 일치하는지 단언한다.
- Modify `test/agents.test.js` — 에이전트 사다리를 읽는 기존 단언(`/[Ss]tandard library|stdlib/i`)이 순서까지 잡도록 조인다.

#### Constraints

- `.bouncer/distill/core.md`는 영어 에이전트 런타임이다(하드룰 8). 남는 문장도 영어를 유지한다.
- 샤드 프론트매터(`distill.id`, `always`, `pulls`)와 `## Invariants` / `## Gotchas` / `## Decisions` 절 구조를 유지한다.
- 문장 삭제 후 `node scripts/bouncer distill --all`이 여전히 8샤드를 렌더하고 `core`가 `always`-only여야 한다.
- 사다리 정합은 순서만 바꾼다. 각 단의 문구와 "첫 번째로 성립하는 단에서 멈춘다"는 규칙은 그대로 둔다.
- 에이전트 문서의 Authority·Hard guards·Scope·Output contract 절은 건드리지 않는다.
- `test/distill.test.js`가 실제 샤드에 `core: 4096` 바이트와 합계 상한을 건다(현재 `core.md` 4,079B, 합계 30,993B). 이 task는 지우기만 하므로 두 값 모두 내려간다 — 상한을 조정하지 않는다.

### Task 004

#### Goal & intent

`docs/install.md`의 「플러그인 루트」 절이 "패키지가 설치하면 `bouncer-root` bin이 PATH에 등록됩니다"라고 말한다. 호스트 플러그인 설치 경로에서 이 문장은 사실이 아니다. 원인은 하나다 — 호스트 설치는 저장소를 `~/.claude/plugins/cache/<marketplace>/bouncer/<version>/`로 복사하는 것이고 `npm install`을 돌리지 않는다. `package.json`이 `bin.bouncer`와 `bin.bouncer-root`를 선언하지만 그 선언을 읽어 링크할 명령이 실행되지 않으므로, 실행 파일은 그 안 `scripts/`에 남고 PATH에는 아무것도 링크되지 않는다.

`"private": true`는 이 실패의 원인이 **아니다** — `npm publish`를 막을 뿐이고, 로컬 경로에 대한 `npm link` / `npm install -g <path>`는 private 패키지에서도 bin을 링크한다. 문서가 이 둘을 섞어 적으면 사용자에게 거짓을 전달한다.

결과가 가볍지 않다. `rules/plugin-root.md`가 정한 모든 워크플로 셸의 첫 줄이 `BOUNCER_ROOT="$(bouncer-root --auto)" || exit $?`이므로, PATH 등록이 없으면 `/bouncer-plan`을 포함한 여섯 워크플로가 첫 명령에서 `command not found`로 끝난다. 이 계획 회차에서도 재현됐다. 감사가 "호스트 설치기 문제인지 저장소 레이아웃 문제인지 아직 가리지 않았다"고 남긴 항목이고, 위 두 사실이 그것을 가린다 — **설치 문서의 오기**다.

이 task는 문서만 고친다. 저장소 레이아웃(`scripts/`에 실행 파일을 두는 것)도 `bin` 선언도 바꾸지 않는다 — npm 설치 경로에서는 그 선언이 옳게 동작하고, 문제는 그 경로가 유일한 경로인 것처럼 적힌 데 있다.

**문서 수정만으로 실패가 사라지지 않는다는 것을 명시해 둔다.** `rules/plugin-root.md`가 정한 열두 소비자 셸의 첫 줄은 그대로이고, 새 호스트 설치에서 사용자가 PATH를 직접 등록하기 전까지 여섯 워크플로는 여전히 첫 명령에서 죽는다. 이 task가 닫는 것은 "문서가 사실과 다르다"이고, "등록 없이도 도는가"는 닫지 않는다. 자동 해결(런처 폴백, 호스트 설치기 배선, 레이아웃 이동)은 blueprint Out of scope이며 별도 회차 몫이다 — 이 task는 그 결정을 앞당기지 않는다.

#### Interface

- 제공:
  - `docs/install.md` 「플러그인 루트 (`bouncer-root`)」 절이 등록을 자동이라고 말하지 않는다. 대신 설치 경로별로 실제 동작하는 등록 단계를 준다 — 호스트 플러그인 설치에서는 플러그인 루트의 `scripts/` 디렉터리를 PATH에 더하고, npm 설치 경로에서는 선언된 bin이 그대로 쓰인다.
  - PATH를 쓸 수 없을 때의 대안으로 현행 `BOUNCER_HOME` 계약을 같은 자리에서 가리킨다(새 계약을 만들지 않는다).
  - PATH를 쓸 수 없을 때의 두 대안을 같은 자리에서 가리킨다 — 현행 `BOUNCER_HOME` 일회성 오버라이드, 그리고 로컬 경로에 대한 `npm link` / `npm install -g <plugin-root>`(전역 환경을 바꾸므로 기본값이 아니라 대안으로 적는다).
  - 등록이 되었는지 확인하는 한 줄(`bouncer-root --auto`가 절대 경로를 출력하는지)과, 실패했을 때 나오는 증상(`command not found`)을 함께 적는다.
  - 수용 기준: 고친 뒤 `docs/install.md`에 (1) 호스트 설치가 bin을 링크하지 않는다는 진술, (2) 실행 가능한 등록 단계, (3) 확인 명령과 실패 증상, (4) 남아 있는 제약(등록 전에는 워크플로가 첫 줄에서 실패한다)이 모두 있고, `test/public-name-regression.test.js`가 그 넷을 단언한다.
- 거부:
  - `"private": true` 때문에 bin 링크가 안 된다는 서술. 사실이 아니며 사용자를 잘못 이끈다.
  - `npm install -g bouncer`(레지스트리 이름) 안내. 이 패키지는 게시되지 않는다 — 로컬 경로 형태만 대안으로 적는다.
  - `BOUNCER_HOME`을 상시 설정값으로 승격하는 것. 현행 계약상 일회성 수동 오버라이드이고 host/provider 신호가 아니다.
  - 워크플로 셸의 첫 줄 형식 변경이나 `bouncer-root` 없이 도는 폴백 추가. `rules/plugin-root.md`가 단일 계약이고 12개 소비자 파일이 그 문자열을 그대로 담는다.
  - `scripts/`를 `bin/`으로 옮기는 저장소 레이아웃 변경.

#### Touch

- Modify `docs/install.md` — 「플러그인 루트」 절의 자동 등록 문장을 설치 경로별 명시적 등록 단계로 교체하고, 확인 방법과 실패 증상을 적는다.
- Modify `rules/plugin-root.md` — "Install the `bouncer-root` package bin on `PATH`" 문장이 *어떻게* 하는지를 `docs/install.md`로 가리키게 한다.
- Modify `test/public-name-regression.test.js` — `docs/install.md`가 자동 등록 문구를 갖지 않고 명시적 등록 단계를 갖는지 단언한다(이 파일이 이미 `install`을 읽어 `bouncer-root --auto`·`--select`를 단언한다).

#### Constraints

- `docs/install.md`는 한국어 사용자 문서다. 추가 문장도 한국어를 유지하고 경로·명령·플래그는 그대로 둔다.
- 새 명령이나 새 환경변수를 도입하지 않는다. 안내는 이미 존재하는 표면(`PATH`, `BOUNCER_HOME`, `bouncer-root --auto`)만 쓴다.
- 기존 단언이 그대로 통과해야 한다 — `docs/install.md`에 `bouncer-root --auto`와 `bouncer-root --select`가 남는다.
- 문서가 특정 호스트의 캐시 절대 경로를 고정 값으로 적지 않는다. 플러그인 루트는 호스트·버전마다 다르므로 자리표시자로 적는다.
