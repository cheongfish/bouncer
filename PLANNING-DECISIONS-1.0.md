# Bouncer 1.0 계획 결정 기록

2026-08-12 세션에서 확정한 의사결정. `bouncer-followups.md`(awesome-claude-skills
저장소)와 함께 읽는다 — 그 문서의 Tier 항목 중 여기서 갱신된 것은 본문에 명시했다.

기준 커밋: `d1c62aa` (0.7.0)

---

## 권장 작업 순서

BP-1(스킬 구조·주석 규칙, 옛 §6·§7)은 PR #37에서 끝났다.
BP-2(게이트 재구성, 옛 §2)는 PR #38에서 끝났다.
BP-3(문서 스키마·레이아웃, 옛 §5)는 PR #39에서 끝났다.
BP-4(자동 루프, 옛 §1 잔여·§3·§4)는 PR #40에서 끝났다.
BP-5(품질·보안, 옛 §6·§7·§8)는 PR #41에서 끝났다. 남은 순서:

1. **BP-6 벤치마크** — 워크플로 밖 분리 스킬. 독립, 마지막

---

## 0. 전제

- **1.0의 정의** — 기능 완비가 아니라 **호환성 약속**. 공개 표면을 확정하고
  그 밖은 내부로 선언한다. 공개 표면을 건드리는 작업만 1.0 범위이고,
  내부만 건드리는 작업은 1.0 이후로 미룰 수 있다.
- **공개 표면 후보** — `.bouncer/` 디렉터리 구조, `config.json` 스키마,
  OKF frontmatter, 게이트 코드(G/S 번호), `bouncer` CLI 명령·플래그·JSON 출력,
  슬래시 커맨드 이름과 순서.
- **내부 선언 후보** — 스킬 SKILL.md 본문 구조, 서브에이전트 구성,
  `scripts/lib/` 내부 함수, worktree 경로 레이아웃.

---

## 9. 벤치마크

**개발자용 스킬로 분리**한다 — bouncer 워크플로 **밖**에 두고 게이트를 건드리지
않는다. `bouncer-followups.md`가 점수화를 제외한 근거("게이트와 별개의 두 번째
판정 체계")는 워크플로 안에 들어갈 때만 성립하므로, 분리 배치로 해소된다.

루브릭은 `Deepusleepy/ponytail-benchmark`의 4축을 차용한다:
**code size / correctness / security / robustness** (execution-graded).
처음부터 설계하지 않는다.

---

## 10. 신규 게이트 코드 정리

G17(commit 스코프)·G15 폐기·G16 `diff_sha` 흡수는 BP-2에서 반영했다.
S19(`type`↔경로)·S20(`scale` enum)은 BP-3(PR #39)에서 반영했다.
G18(`context-review.md` status / findings 형식)은 BP-5(PR #41)에서 반영했다.

각 blueprint의 `affected_paths`는 해당 `/bouncer-plan`에서 확정한다.

---

## 11. blueprint 분할 제안

```
BP-1  스킬 구조 재편        — 완료 (PR #37). 옛 §6·§7
BP-2  게이트 재구성          — 완료 (PR #38). 옛 §2
BP-3  문서 스키마·레이아웃   — 완료 (PR #39). 옛 §5
BP-4  자동 루프              — 완료 (PR #40). 옛 §1 잔여·§3·§4
BP-5  품질·보안              — 완료 (PR #41). 옛 §6·§7·§8
BP-6  벤치마크               (9)  — 분리 스킬. 마지막
```

순서 근거:

- **BP-1·BP-2·BP-3·BP-4·BP-5 완료** — 스킬 anatomy, 게이트 재배치, 문서 스키마·레이아웃,
  `/bouncer-run`·autonomy, context-review G18이 올라와 있다. 이후 BP는 이 구조를
  전제로 한다.
- **BP-6은 독립.**
