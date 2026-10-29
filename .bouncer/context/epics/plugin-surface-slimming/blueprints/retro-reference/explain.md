---
type: bouncer.explain
title: retro-reference explain
description: Explain for retro-reference
resource: .bouncer/context/epics/plugin-surface-slimming/blueprints/retro-reference/explain.md
tags:
  - bouncer
  - explain
timestamp: '2026-10-29T11:00:29.544+09:00'
bouncer:
  id: EXPLAIN-retro-reference
  epic_id: plugin-surface-slimming
  blueprint_id: retro-reference
  status: published
  comprehension:
    - range_from: 0bb62a25139436cbbdb64728fc4de62ddd03bd44
      range_to: 65424c8f0e633ae783202da1fc0a446bf54ff5d0
      diff_sha: aa691009ded887e03fd32eea516d8f24f11c5cf12ac46613c6d41865e9858c69
      recorded_at: '2026-10-29T11:01:02.107+09:00'
  task_commits:
    - task: plugin-surface-slimming/retro-reference/001
      sha: dba5d41a
      intent_anchor: task-001
    - task: plugin-surface-slimming/retro-reference/003
      sha: 65424c8f
      intent_anchor: task-003
---
# Explain

## Background

회고(retro)는 finalize가 끝난 뒤 세션에서 드러난 문제를 개선 후보로 바꾸는 절차다. 지금까지는 `/bouncer-retro`라는 독립 skill이 있었고, 이 skill이 finalize 호출과 사용자 직접 호출을 둘 다 처리했다. 독립 진입점이 있으면 호스트마다 skill 목록, 배포물, ACQ 색인, 문서가 같이 늘어난다.

이 변경은 독립 진입점을 없애고 회고를 finalize 전용 reference로 옮긴다. 사용자가 부르는 명령은 줄지만 회고 자체는 사라지지 않는다. finalize가 닫힌 뒤 `drive_issues`에 문제가 있으면 자동으로 실행된다. 다른 세션의 기록이 필요한 경우는 CLI의 `bouncer retro sources`와 `bouncer retro read`로 따로 조회한다.

## Code

- `skills/bouncer-finalize/references/retro.md`: 이관된 회고 절차. 증거 수집, 문제 찾기, 기존 장치 확인, 후보 제안(수정 대상은 하나), 채팅 출력 순서다. 독립 호출 분기는 없고, 이 절차 안에서는 transcript를 검색하거나 파일을 다시 열지 않으며 ACQ도 열지 않는다.
- `skills/bouncer-finalize/SKILL.md`의 Auto retro: 기존 skill 파일 대신 `./references/retro.md`를 읽는다. 생략 문구와 실패 문구, 그리고 실패해도 `closed`와 pointer가 바뀌지 않는다는 조건은 그대로다.
- `skills/bouncer-retro/SKILL.md`: 삭제됐다.
- `rules/skill-shape.md`, `rules/acq-gates.json`, `rules/output.md`, `README.md`, `docs/install.md`: 독립 진입점을 목록과 안내에서 뺐다. README와 설치 문서는 별도 증거 조회 경로로 CLI 두 명령을 안내한다.
- `scripts/verify-retro-migration.js`: 빌드, 관련 테스트 네 개, `lint:docs`, `lint:test-names`를 순서대로 실행하고 실패 코드를 그대로 돌려준다.
- 테스트: workflow skill이 다섯에서 넷으로 줄었으므로 surface 테스트의 이름과 `EXPECTED_SKILL_COUNT`를 4로 바꿨다. finalize 테스트는 reference 경로와, 실패 불변 조건 및 거부 문구가 SKILL.md와 retro.md에 그대로 있는지 확인한다.
- 남은 한계: `docs/architecture/rule-ownership.md`에 retro 5라는 기록이 남아 있다. 이번 변경 범위 밖이라 고치지 않았다.

## Quiz

1. 이 변경 뒤 finalize의 Auto retro는 어떻게 동작하는가?
   - A) `drive_issues` 카운터가 모두 0이면 한 줄을 출력하고 멈추며, 아니면 `references/retro.md`를 읽어 현재 대화만으로 채팅에 후보를 낸다.
   - B) 항상 `bouncer retro sources`로 다른 세션을 검색한 뒤 후보를 낸다.
   - C) 후보를 낸 뒤 채택 여부를 ACQ로 묻고 답을 기다린다.
2. 회고 절차가 실패하면 finalize 결과는 어떻게 되는가?
   - A) blueprint를 다시 열고 pointer를 복원한다.
   - B) 한 줄로 실패를 알릴 뿐 렌더링된 출력, `closed`, pointer는 그대로다.
   - C) finalize 전체를 실패로 처리한다.
3. 다른 세션의 증거로 회고하고 싶은 사용자는 무엇을 쓰는가?
   - A) `/bouncer-retro`
   - B) `bouncer finalize prepare`
   - C) `bouncer retro sources`로 후보를 찾고 `bouncer retro read --path <file>`로 읽는다.

## Tasks

### plugin-surface-slimming/retro-reference/001 · `dba5d41a`

#### Goal & intent

독립 회고 skill을 finalize reference로 이관하고 호스트 표면과 대체 안내를 일치시킨다. Epic 기준 1을 충족하고 `node scripts/verify-retro-migration.js`가 통과해야 한다.

#### Current behavior

`skills/bouncer-retro/SKILL.md:20`은 finalize 호출과 독립 호출의 증거 범위를 나눈다. `skills/bouncer-finalize/SKILL.md:107`은 종료 후 기존 skill 파일을 읽는다. `package.json:7`의 `skills/` 배포와 `test/cursor-plugin.test.js:21`, `test/skill-bouncer-surface.test.js:11`의 목록이 발견 표면을 결정한다. 기준 재현은 `node --test test/skill-bouncer-surface.test.js test/cursor-plugin.test.js test/acq-gate-ids.test.js test/skill-bouncer-finalize.test.js`로 한다.

#### Target behavior

- 성공: finalize가 새 reference를 읽고 기존 종료·생략·증거·출력 조건을 지킨다. 호스트 목록에 독립 skill이 없고 배포물에 reference가 있다.
- 실패: 오래된 진입점 참조 또는 reference 누락을 관련 검증이 실패로 감지한다. 회고 자체 실패는 finalize 결과를 변경하지 않는다.
- 보존: 기존 CLI의 sources/read, 회고 후보 근거와 대상 분류, 채팅 전용 출력 및 별도 계획 절차를 유지한다.

#### Interface

- 제공: finalize 호출용 reference와 `bouncer retro sources`, `bouncer retro read`를 이용한 별도 증거 탐색 안내.
- 거부: 독립 `/bouncer-retro` 발견과 finalize 회고에서 transcript 검색, 파일 재열기, 추가 ACQ 또는 사용자 응답 대기.

#### Touch

| 경로 | 심볼 | 변경 | 현재 책임 | 계획한 변경 | 근거 |
| --- | --- | --- | --- | --- | --- |
| `skills/bouncer-retro/SKILL.md` | `회고 절차` | Delete | 독립 진입점과 두 호출 모드 | 절차를 reference로 이관 | SKILL.md:5,20 |
| `skills/bouncer-finalize/references/retro.md` | `신규 추출 지점: 회고 절차` | Create | 없음 | finalize 호출용 절차 제공 | 기존 회고 절차 이관 |
| `scripts/verify-retro-migration.js` | `신규 추출 지점: 범위 검증` | Create | 없음 | 관련 테스트와 정적 검사 실행 | 승인된 검증 명령 |
| `skills/bouncer-finalize/SKILL.md` | `Auto retro` | Modify | 종료 후 회고 호출 | 새 reference 호출 | SKILL.md:107 |
| `rules/skill-shape.md` | `skill 목록` | Modify | skill 모양 계약 | 제거된 진입점 제외 | skill-shape.md:41 |
| `rules/acq-gates.json` | `bouncer-retro` | Modify | ACQ 색인 | 제거된 키 삭제 | acq-gates.json:8 |
| `rules/output.md` | `진행 출력 범위` | Modify | skill 출력 규칙 | 제거된 진입점 제외 | output.md:4 |
| `README.md` | `명령 목록` | Modify | 독립 명령 안내 | CLI 증거 탐색 경로 안내 | README.md:70 |
| `docs/install.md` | `설치 표면` | Modify | 호스트 명령 안내 | 제거된 진입점 제외 및 대체 안내 | install.md:198 |
| `test/skill-bouncer-surface.test.js` | `skill 목록` | Modify | 발견 표면 검증 | 제거와 reference 배포 확인 | skill-bouncer-surface.test.js:11,95,161 |
| `test/cursor-plugin.test.js` | `skill 목록` | Modify | Cursor 발견 검증 | 제거된 진입점 제외 | cursor-plugin.test.js:21 |
| `test/acq-gate-ids.test.js` | `ACQ 키` | Modify | ACQ 색인 검증 | 제거된 키 제외 | acq-gate-ids.test.js:48 |
| `test/skill-bouncer-finalize.test.js` | `retro 조건` | Modify | finalize 회고 계약 검증 | reference 및 보존 조건 검증 | skill-bouncer-finalize.test.js:79 |

#### Constraints

- `test/skill-bouncer-surface.test.js`의 `canonical skill catalog → contains the five explicit workflow entries`는 네 개의 workflow skill을 기대하고, `retired entry skills → files are gone and run keeps the migrated references`는 `bouncer-retro`의 파일과 카탈로그 부재를 확인한다. `workflow skills → classify references as root or skill-local without bare collision`은 finalize의 `retro.md`가 존재하고 로컬 경로로 참조됨을 확인한다. 기존 workflow 순회 테스트의 목록과 관련 매핑에서도 `bouncer-retro`를 제외한다.
- `test/cursor-plugin.test.js`의 `workflow shells → invoke the installed bouncer launcher directly`와 `launcher shell blocks → call bouncer directly and scope root resolution to module paths`는 제거된 skill을 읽지 않고 남은 항목에 기존 단언을 적용한다.
- `test/acq-gate-ids.test.js`의 `카탈로그 workflows 키 → ACQ 절을 가진 skills/*/SKILL.md의 skill 이름 집합과 같고 순서는 정해진 목록과 같음`은 키 순서를 `bouncer-init`, `bouncer-plan`, `bouncer-run`, `bouncer-finalize`로 기대하고 발견된 skill 집합과 일치함을 확인한다.
- `test/skill-bouncer-finalize.test.js`의 `gates retro on preserved drive_issues and prints the skip line when all are 0`은 유지하고 새 경로와 회고 실패 불변 조건을 확인한다.
- reference는 기존 회고 절차의 후보 분류와 근거 규칙을 보존하고 독립 skill 호출 분기는 제거한다. README와 설치 안내에는 CLI 명령을 통한 별도 증거 조회를 명시한다.

### plugin-surface-slimming/retro-reference/002

#### Goal & intent

통합된 변경이 전체 프로젝트 테스트를 통과하는지 확인한다.

#### Interface

- 제공: 통합 후 전체 검증 증적.
- 거부: source 변경, review 문서, commit.

#### Touch

Source 변경 경로 없음.

### plugin-surface-slimming/retro-reference/003 · `65424c8f`

#### Goal & intent

최종 리뷰 finding을 수정한다.

- CT-001 (minor, correctness_tests, must_fix) — test/skill-bouncer-finalize.test.js#bouncer-finalize SKILL → reads its own retro reference and keeps the finalize-call limits — tasks/001 Constraints — note: Constraint requires the finalize test to check the retro failure invariant; only the 'retro: 실행하지 못함' prefix is asserted. 'finalize 결과는 그대로임' (SKILL.md) and retro.md step-5 invariance sentence, plus retro.md rejection phrases (no transcript search/file reopen/ACQ/wait), are unasserted.

#### Interface

- 제공: 기록된 리뷰 finding을 해소하는 최소 수정
- 거부: Blueprint 밖 scope와 새 기능

#### Touch

- Modify `test/skill-bouncer-finalize.test.js` — 기록된 리뷰 finding을 수정한다.

#### Constraints

- 원장의 실패 증적과 repair 결정 범위만 따른다.