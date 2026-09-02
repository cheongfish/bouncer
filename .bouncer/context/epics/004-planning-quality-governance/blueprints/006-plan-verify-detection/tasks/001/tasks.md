---
type: bouncer.tasks
title: 빌드 스크립트를 감지해 검증 명령 지정을 확인하는 단계를 더함
description: Tasks for 001
resource: .bouncer/context/epics/004-planning-quality-governance/blueprints/006-plan-verify-detection/tasks/001/tasks.md
tags:
  - bouncer
  - tasks
timestamp: '2026-08-06T16:56:18.524+09:00'
bouncer:
  id: TASKS-001
  epic_id: '004'
  blueprint_id: '006'
  status: verified
  affected_paths:
    - skills/bouncer-plan/SKILL.md
    - docs/configuration.md
    - test/skill-bouncer-plan.test.js
  graph:
    generated_at: '2026-08-06T17:02:06.000+09:00'
    command: graphify query on graphify-out/source/graph.json and graphify-out/context/graph.json
    suggested_paths:
      - skills/bouncer-plan
      - docs
      - test
    basis:
      - graph: source
        status: reused
        query: plan skill verify command detection docker compose Makefile package.json scripts wrapper configuration docs contract test
        result: 67 nodes, all under test/ (validate-gates.test.js, migrate-ids.test.js, finalize-pure.test.js). source_dirs가 scripts/hooks/test라 skills/·docs/는 반환되지 않아 수동으로 더함
      - graph: context
        status: updated
        query: verify command wrapper docker compose plan skill detection configuration docs
        result: 13 nodes; 004-planning-quality-governance/003-per-task-verify-command(= tasks.bouncer.verify를 도입한 선행 작업)과 이번 블루프린트의 verification.md
---
# Tasks

Blueprint: [006](../../index.md)

## Goal & intent

`/bouncer-plan`을 돌리면 저장소 루트의 컨테이너·빌드 스크립트를 확인하고, 하나라도
있으면 이 blueprint의 검증 명령을 지정할지 사용자에게 묻는다. 지금은 그런 프로젝트도
전역 기본값을 그대로 쓰게 되어 execute 게이트가 실제 테스트를 돌리지 못한 채 통과한다.

검증 명령은 셸 체이닝·리디렉션·`cd` 접두를 허용하지 않는 단일 실행 문자열이다.
따라서 컨테이너 기동과 테스트를 한 줄로 잇는 값은 제안 대상이 아니며, 프로젝트가
그 둘을 스크립트 하나로 감싸도록 안내한다. 이 안내가 설정 문서에 남아야 감지 단계가
가리킬 곳이 생긴다.

감지는 스킬 본문에서 파일 존재를 확인하는 수준이다. 새 CLI도, 새 설정 키도, 새
frontmatter 필드도 만들지 않는다.

## Interface

- 제공:
  - `skills/bouncer-plan/SKILL.md`에 감지·제안 단계 하나. 저장소 루트의
    `docker-compose.yml` / `docker-compose.yaml` / `compose.yml` / `compose.yaml` /
    `Makefile` / `Taskfile.yml` / `package.json`의 `scripts`를 확인하고, 하나라도
    있으면 `tasks.bouncer.verify` 지정 여부를 사용자에게 묻는다.
  - `docs/configuration.md`에 래퍼 패턴 절. 단일 실행 문자열 제약, 스크립트로 감싸는
    예시, worktree별 compose 프로젝트 이름 분리, docker 없는 환경에서의 처리를 담는다.
- 거부:
  - 사용자 확인 없는 값 기록. 감지 결과만으로 `tasks.bouncer.verify`를 쓰지 않는다.
  - `&&`, `;`, 파이프, 리디렉션, `cd` 접두가 섞인 제안. 그런 값이 필요해 보이면
    래퍼 스크립트를 만들라고 안내하고 전역 설정값을 그대로 둔다.
  - `config.verify`나 `.bouncer/config.json` 수정. 이 단계는 blueprint 단위 값만 다룬다.
  - 저장소 루트 밖 탐색.

## Touch

- Modify `skills/bouncer-plan/SKILL.md` — 감지·제안 단계를 추가하고, 거절·부재 시
  전역 설정값을 그대로 쓴다는 분기를 명시한다.
- Modify `docs/configuration.md` — `verify` 행에서 래퍼 패턴 절을 가리키고, 그 절을 새로 쓴다.
- Modify `test/skill-bouncer-plan.test.js` — 새 단계의 존재를 계약으로 고정한다.

## Do not touch

- `scripts/src/lib/validate.ts` — 검증 명령 형식 규칙(S12)은 그대로 둔다. 이번 작업은
  제안 단계이지 판정 규칙 변경이 아니다.
- `scripts/src/lib/verification.ts` — 형식 판정과 증적 기록 경로는 손대지 않는다.
- `scripts/src/lib/init.ts` — 부트스트랩 시점 탐지는 이 epic의 범위 밖이다.
- `.bouncer/config.json`, `config.example.json` — 전역 검증 명령을 자동으로 바꾸지 않는다.

## Constraints

- 새 설정 키, 새 frontmatter 필드, 새 CLI 하위 명령을 만들지 않는다. 기존
  `tasks.bouncer.verify` 하나만 쓴다.
- 감지는 파일 존재 확인까지다. compose 파일이나 `Makefile`의 내용을 해석하지 않는다.
- 문서와 스킬 본문의 사용자 대상 문자열은 한국어를 유지한다.
- `test/skill-bouncer-plan.test.js`의 기존 assert는 지우지 않고 추가만 한다. 특히
  `superpowers` 계열 금칙어 assert를 건드리지 않는다.
- 문서에 적는 검증 명령 예시는 전부 단일 실행 문자열이어야 한다. 설명을 위해서라도
  통과하지 못할 예시를 정답처럼 적지 않는다.

## Checklist

- [ ] `test/skill-bouncer-plan.test.js`에 새 계약 테스트를 먼저 추가하고 실패를 확인한다.
      감지 대상과 사용자 확인, 두 축을 모두 잡는다.
      ```js
      test('bouncer-plan detects project build scripts and asks before writing tasks verify', () => {
        const { body } = parseFrontmatter(md);
        assert.match(body, /docker-compose|compose\.ya?ml/);
        assert.match(body, /Makefile/);
        assert.match(body, /package\.json/);
        assert.match(body, /bouncer\.verify|tasks\.bouncer\.verify/);
        assert.match(body, /확인|묻|물어|ask/i);
      });
      ```
- [ ] `npm test`로 위 테스트가 실패하는 것을 확인한다.
- [ ] `skills/bouncer-plan/SKILL.md`에 감지·제안 단계를 추가한다. 스캐폴드 다음,
      문서 본문을 쓰는 단계 안에 두어 blueprint 성격을 알고 나서 묻게 한다. 본문에
      네 갈래를 모두 적는다 — 감지 대상 목록 / 발견 시 사용자에게 묻기 / 지정 시
      `tasks.bouncer.verify`에 단일 실행 문자열 기록 / 부재·거절 시 전역 설정값 유지.
- [ ] 같은 단계에 셸 체이닝이 왜 막히는지 한 문장으로 적고, 래퍼로 감싸라는 안내와
      함께 `docs/configuration.md`를 가리킨다.
- [ ] `docs/configuration.md`에 래퍼 패턴 절을 추가한다. 다음 네 가지를 모두 담는다.
      - 검증 명령은 단일 실행 문자열이라 `up`과 테스트를 한 줄로 이을 수 없다는 사실
      - 프로젝트 스크립트로 감싸는 예시 (예: `npm run test:e2e`, `make test`)
      - worktree에서 컨테이너를 띄울 때 프로젝트 이름을 분리해 원본 체크아웃과
        포트·볼륨이 겹치지 않게 하라는 지침
      - docker가 없는 환경에서는 래퍼가 스스로 건너뛰도록 권고
- [ ] `docs/configuration.md`의 `verify` 행에서 새 절로 가는 링크를 건다.
- [ ] `npm test`가 통과하는 것을 확인한다.
