# 파일럿 안내

1–2명이 먼저 Bouncer를 붙여 보고 막히는 지점을 기록하기 위한 문서입니다.
운영자(플러그인 관리자)와 파일럿 참가자 모두 이 문서를 봅니다.

## 파일럿의 목적

파일럿의 목적은 **막히는 지점 수집**입니다. 게이트 통과/실패는 테스트가 이미
검증합니다. 파일럿이 답해야 할 질문은 다릅니다.

- 문서를 안 보고 어디까지 갈 수 있나
- 실패 코드를 보고 무엇을 해야 할지 알 수 있나
- 한 사이클에 얼마나 걸리나
- 도중에 규칙을 우회하고 싶어진 지점은 어디인가

우회 욕구가 난 지점을 설계 결함 후보로 기록하세요.

## 참가자 준비

```
/plugin marketplace add <사내-git-url>
/plugin install bouncer@chunjae-tools
```

비공개 저장소면 SSH 리모트를 쓰세요. 이유는 [install.md](install.md#비공개-저장소)에 있습니다.

## 첫 사이클 (권장 30–60분)

**실제 작업 중 가장 작은 것**을 고르세요. 한 커밋에 들어갈 크기여야 합니다.
연습용 가짜 작업은 피하세요. 진짜 작업에서만 마찰이 납니다.

1. `/bouncer-init` → 안내대로 `.bouncer/`를 **별도 커밋**
   ([이유](context-versioning.md#부트스트랩은-왜-따로-커밋해야-하나))
2. `.bouncer/config.json`을 프로젝트에 맞게 수정
   - `source_dirs`: 소스가 있는 디렉터리
   - `verify`: **execute 게이트가 실행할 명령.** 여기가 틀리면 게이트가
     의미 없어집니다
3. `/bouncer-plan` → `/bouncer-execute` → `/bouncer-commit` → `/bouncer-finalize`

각 단계에서 **막히면 즉시 기록**하세요. 나중에 정리하면 무엇이 어려웠는지 잊습니다.

### 문서 필드가 그대로 커밋 메시지가 됩니다

`/bouncer-commit`이 만드는 **task** 커밋은 이런 형태입니다.

```
<type>: <tasks 문서의 title>

- <task commit_intent[0]>   # 배경·의도
- <task commit_intent[1]>   # 배경·의도
- <verification 문서의 title>              # 수정 내용 (선택)
```

`/bouncer-finalize` remainder(보통 Distill 승격)는 blueprint `title`과,
번호 순으로 스캔한 task `commit_intent` 중 **가장 큰 번호**의 유효한 2줄만
씁니다. blueprint에는 `commit_intent`를 두지 않습니다.

즉 **task `title`·`commit_intent`와 blueprint `title`/`commit_type`을 커밋
제목·본문 줄로 쓸 수 있게 적어야 합니다.** scaffold 기본값(`001 tasks` 같은)을
그대로 두면 아무 정보 없는 커밋이 남습니다. 구조만 Bouncer가 정하고 문장은
전부 여러분이 쓴 필드에서 오므로, 팀의 커밋 규약(언어, 어미, 금지 사항)은
필드를 어떻게 쓰느냐로 지켜집니다. Epic/Blueprint/Distill 식별자는 커밋에
두지 않고 PR 본문과 blueprint 문서에 남습니다. task `commit_intent`가 없으면
`/bouncer-commit` 스킬이 커밋 전에 2줄을 채울 수 있습니다.

## 언제 Bouncer를 쓰나 (잠정: 파일럿이 답할 질문)

한 사이클은 task 묶음과 게이트 4개(plan / execute / commit / finalize)를
거칩니다. 오타 수정에까지 이걸 요구하면 사람들은 곧 우회하기 시작합니다.
현재 잠정 기준은 이렇습니다.

| 상황 | 잠정 판단 |
| --- | --- |
| 코드가 바뀌고 검증 명령이 의미 있는 결과를 내는 작업 | Bouncer 사이클 |
| 범위가 번질 위험이 있는 작업 (여러 디렉터리를 건드릴 것 같은) | Bouncer 사이클 |
| 오타·문구 수정처럼 검증할 것이 없는 변경 | 일반 커밋 |

**이 기준이 맞는지가 파일럿이 검증할 질문입니다.** "이건 Bouncer 쓰기엔
과하다"고 느낀 순간이 있으면 그 작업이 무엇이었는지 함께 기록해 주세요.

## 기록 방법

이슈 템플릿을 씁니다.

- GitHub: New issue → **막힌 지점 (friction)** 또는 **버그**
- GitLab: New issue → Description template → `friction` 또는 `bug`

**스스로 우회한 경우에도 기록해 주세요.** 우회 방법이 곧 문서에 들어갈 내용이고,
"결국 해결했으니 보고 안 함"이 가장 큰 손실입니다.

## 운영자 체크리스트

- [ ] 참가자가 설치까지 몇 분 걸렸는지 기록
- [ ] 첫 게이트 실패에서 스스로 복구했는지, 물어봤는지 기록
- [ ] 사이클 완주 시간 측정
- [ ] 수집된 friction을 GitHub/GitLab 이슈로 남기고 우선순위를 붙인다
- [ ] 파일럿 종료 후 참가자에게 "다시 쓸 의향이 있는지" 직접 질문

## 이미 알려진 마찰 (중복 보고 불필요)

이 저장소를 Bouncer로 관리하며 두 사이클(001, 002)에서 확인한 항목입니다.

**남아 있는 것**

| 증상 | 상태 |
| --- | --- |
| 문서 필드를 성의 없이 쓰면 커밋 메시지도 그렇게 남음 | 미해결. 위 「문서 필드가 그대로 커밋 메시지가 됩니다」 참고. 명령 문서에 안내를 넣는 것이 후속 과제 |
| `graphify` 비활성 시 범위 근거가 필요함 | Graphify evidence 단계/runner를 실행해 `skip-disabled` 또는 `missing` `basis` 항목을 기록한 뒤, 사용자가 `affected_paths`를 확인한다. `scope_evidence.basis`는 손으로 작성하지 않는다. |
| 계획 도중 범위가 늘면 tasks를 고치고 plan 게이트를 다시 통과해야 함 | 의도된 동작. 다만 번거롭다고 느껴지면 기록해 주세요 |

**이미 고친 것** (보고하지 않으셔도 됩니다)

| 증상 | 해결 |
| --- | --- |
| finalize 후 포인터가 남아 이후 커밋이 전부 막힘 | 0.1.0: 커밋에 성공한 finalize가 포인터를 정리 |
| `verification.md`가 검증 출력 중복으로 200줄 이상 부풀음 | 0.1.0: 통과 시 본문에서 출력 블록 제거 (229줄 → 47줄) |
| 생성 커밋 메시지에 trailer / 스코프가 팀 규약과 충돌 | Unreleased: trailer·스코프 제거, `.gitmessage` 형태만 유지 |
| 존재하지 않는 blueprint 경로가 `G9`로 잘못 보고됨 | 0.1.0: `S11`로 구분 |

## 참고

- `bouncer --help`: CLI가 무엇을 할 수 있는지 직접 확인할 수 있습니다.
- 게이트 실패 코드의 의미는 [gates.md](gates.md)와
  [troubleshooting.md](troubleshooting.md)에 정리되어 있습니다.

## 저장소 유형 × 호스트 파일럿 매트릭스

저장소 유형은 애플리케이션 저장소, 모노레포, 문서·설정 중심 저장소 세 가지로
고정한다. 호스트는 Claude Code, Cursor, Codex, Antigravity 네 가지로 고정한다.
파일럿을 실제로 실행하기 전에는 모든 조합을 `미검증`으로 둔다. 상태 어휘는
`검증됨`과 `미검증`뿐이다.

| 저장소 유형 | 호스트 | 상태 | 실행 기록 링크 |
| --- | --- | --- | --- |
| 애플리케이션 저장소 | Claude Code | 미검증 | — |
| 애플리케이션 저장소 | Cursor | 미검증 | — |
| 애플리케이션 저장소 | Codex | 미검증 | — |
| 애플리케이션 저장소 | Antigravity | 미검증 | — |
| 모노레포 | Claude Code | 미검증 | — |
| 모노레포 | Cursor | 미검증 | — |
| 모노레포 | Codex | 미검증 | — |
| 모노레포 | Antigravity | 미검증 | — |
| 문서·설정 중심 저장소 | Claude Code | 미검증 | — |
| 문서·설정 중심 저장소 | Cursor | 미검증 | — |
| 문서·설정 중심 저장소 | Codex | 미검증 | — |
| 문서·설정 중심 저장소 | Antigravity | 미검증 | — |

실행 기록은 다음 형식으로 같은 문서에 추가한다.

```text
### <저장소 유형> · <호스트> · <YYYY-MM-DD>
- 단계: init/plan/execute/commit/finalize 각각 성공 | 실패(코드)
- 사용자 개입 횟수: <n>
- 소요 시간: <분>
- 막힌 지점: <없으면 "없음">
```

## 1.2.0 태그 기준 smoke 및 릴리스 기록

파일럿 결과는 브랜치의 현재 상태가 아니라 `bouncer--v1.2.0` 태그가 가리키는
커밋을 설치 대상으로 삼아 기록한다. 따라서 태그를 만든 뒤에는 태그를
체크아웃하거나 태그를 명시한 원격 설치 경로를 사용하고, 이후 브랜치에 추가된
커밋을 결과에 섞지 않는다.

릴리스 운영자는 모든 task 커밋이 병합된 최종 HEAD에서 먼저 `npm run ci`를
성공시킨다. 그 HEAD에 `bouncer--v1.2.0`이 아직 없고 다른 커밋을 가리키는
태그도 아닌지 확인한 뒤 annotated 태그를 만든다.

```bash
git tag -a bouncer--v1.2.0 <merged-head>
git push origin bouncer--v1.2.0
```

태그 push와 원격 marketplace 설치는 인증과 외부 권한이 필요하므로 운영 시점에
별도 동의를 받는다. 태그를 이미 가진 경우에는 삭제하거나 강제로 이동하지 않고
중단한다. push가 끝난 뒤에만 3개 저장소 유형 × 4개 호스트의 smoke를 태그
기준으로 실행한다.

실행을 마치면 **동일 태그의 GitHub Release**에 태그 commit SHA와 아래 12개
조합의 결과를 함께 남긴다. 각 행에는 `성공 횟수`, `실패 횟수`, `사용자 개입
횟수`를 기록하며, smoke를 실행하지 못한 행은 `미검증`으로 유지한다. Release
본문 또는 첨부 기록에는 사용한 태그와 commit SHA가 서로 일치하는지 확인할 수
있어야 한다.

```text
태그: bouncer--v1.2.0
태그 commit SHA: <40자리 SHA>
GitHub Release: <동일 태그의 Release URL>

| 저장소 유형 | 호스트 | 상태 | 성공 횟수 | 실패 횟수 | 사용자 개입 횟수 |
| --- | --- | --- | ---: | ---: | ---: |
| 애플리케이션 저장소 | Claude Code | 미검증 | 0 | 0 | 0 |
| 애플리케이션 저장소 | Cursor | 미검증 | 0 | 0 | 0 |
| 애플리케이션 저장소 | Codex | 미검증 | 0 | 0 | 0 |
| 애플리케이션 저장소 | Antigravity | 미검증 | 0 | 0 | 0 |
| 모노레포 | Claude Code | 미검증 | 0 | 0 | 0 |
| 모노레포 | Cursor | 미검증 | 0 | 0 | 0 |
| 모노레포 | Codex | 미검증 | 0 | 0 | 0 |
| 모노레포 | Antigravity | 미검증 | 0 | 0 | 0 |
| 문서·설정 중심 저장소 | Claude Code | 미검증 | 0 | 0 | 0 |
| 문서·설정 중심 저장소 | Cursor | 미검증 | 0 | 0 | 0 |
| 문서·설정 중심 저장소 | Codex | 미검증 | 0 | 0 | 0 |
| 문서·설정 중심 저장소 | Antigravity | 미검증 | 0 | 0 | 0 |
```

위 표는 절차를 정의하는 현재 문서의 기준 상태다. 이 task에서는 태그를 만들거나
smoke를 실행하지 않으므로 어떤 행도 `검증됨`으로 바꾸지 않는다.
