# Plugin root

Bouncer는 npm으로 배포하는 CLI runtime과 호스트가 설치하는 plugin asset root로
나뉩니다. `bouncer`와 `bouncer-root` 실행 파일은 runtime package 소유이며,
plugin 설치는 실행 파일을 제공하지 않습니다. manifest의 `runtimeCompatibility`
범위가 있으면 runtime version이 그 범위에 들어야 합니다. 범위가 없는 legacy
manifest만 plugin과 runtime의 version이 같아야 합니다. 설치 방법은
[`docs/install.md`](../docs/install.md)의 plugin root 절을 따릅니다.

Workflow skill은 plugin 디렉터리에서 `bouncer` CLI를 실행합니다. runtime이
설치되어 있고 shell에서 `bouncer-root`를 찾을 수 있을 때 각 독립 shell block은
다음을 실행합니다.

```bash
BOUNCER_ROOT="$(bouncer-root --auto)" || exit $?
```

`bouncer-root --auto`는 지원되는 host 설치 후보만 검색하고 strict-semver가 가장
높은 version(동률이면 절대 경로)을 고릅니다. `bouncer-root --select`는 TTY에서
번호 선택을 받습니다. `--host claude`, `--host codex`, `--host antigravity`로
검색 범위를 제한할 수 있습니다. `BOUNCER_HOME=/absolute/plugin/root`는 asset
root를 직접 지정하고 검증합니다. asset 탐색은 명시된 `BOUNCER_HOME`을 먼저
검사한 뒤 host 후보를 찾습니다. runtime 자체 tree를 asset root로 추론하지
않습니다. 선택된 plugin manifest의 `runtimeCompatibility`가 있으면 설치된 runtime
version이 그 범위에 들어야 하며, 범위를 벗어나면 asset을 읽기 전에 실패합니다.
범위가 없는 legacy manifest는 plugin과 runtime version이 같아야 합니다.
유효한 root에는 `agents/`, `skills/`,
`rules/`, `references/`, `hooks/`, `${BOUNCER_ROOT}/AGENTS.md`가 있어야 합니다.
순수 명령(`commit-guard`, `current`, `project-root`, `validate`, `verify`,
`graph-sync`)은 asset root를 찾지 않으므로 `BOUNCER_HOME`을 검사하거나 쓰지
않습니다.

`BOUNCER_BIN`은 hook이 상속된 `PATH`에서 `bouncer`를 찾지 못할 때 쓰는 runtime
실행 shim의 절대 경로입니다. 이는 runtime executable을 가리키며 plugin asset
root를 가리키지 않습니다. `BOUNCER_HOME`은 plugin asset root를 가리키며 runtime
executable을 가리키지 않습니다. runtime이 없다면 같은 version의 npm package를
설치하고 실행 파일을 PATH에 연결해야 합니다. plugin 파일만으로는 CLI 명령을
실행할 수 없습니다. runtime version이 manifest 호환 범위에 들도록 runtime을
설치하거나, 해당 host plugin 설치를 가리키도록 `BOUNCER_HOME`을 설정합니다.

Launcher는 `BOUNCER_HOME`으로 host를 추정하지 않고 cwd나 임의 home 디렉터리를
검색하지 않습니다. Provider 선택은 별도 설정이며 Cursor와 Antigravity 프로젝트는
config에서 `subagents.provider`를 지정합니다. asset resolver의 host 후보는 Claude
Code, Codex, Antigravity입니다. Cursor plugin 위치는 자동 검색 후보가 아니므로
Cursor workflow는 `BOUNCER_HOME`을 직접 지정합니다.

`BOUNCER_ROOT`는 skills, rules 등 **plugin** 설치 경로입니다. 사용하는 프로젝트의
main worktree는 별도이며 `bouncer project-root`로 `PROJECT_ROOT`에 해석합니다.
Canonical context 읽기와 graph freshness 검사는 그 경로를 기준으로 합니다. plugin
root나 execute worktree cwd를 대신 사용하지 않습니다. 이 저장소가 plugin을 직접
사용할 때 plugin root와 project root가 같은 경로인 것은 정상입니다.

Hook은 workflow launcher shell과 별도로 runtime을 찾습니다. Hook은 `PATH`의
`bouncer` 또는 절대 경로 `BOUNCER_BIN`을 실행하고, 자신이 띄운 자식 `bouncer`에만
자신의 plugin root를 `BOUNCER_HOME`으로 전달합니다. workflow shell에는 plugin-root
변수를 전달하지 않습니다.

## Master and product rules

Before a workflow's numbered steps, read `${BOUNCER_ROOT}/AGENTS.md`.
`${BOUNCER_ROOT}/AGENTS.md` is the only default runtime contract. Product rules are conditional detail: the owning numbered
step opens the existing rule directly when its branch needs it; do not preload
`${BOUNCER_ROOT}/rules/document-schema.md` or another product rule for every
workflow. Each master or product rule a workflow opens loads once per session.
A new workflow session loads its needed rules before that rule's use; do not
re-read them when they are already loaded in the same session. The workflow
skill keeps its `Plugin root` and `Master rules` labels so this loading point is
visible; its `Plugin root` line carries only the `bouncer-root --auto` command
and does not restate the selection rules above. `bouncer init` does not install
these plugin-owned rules into the consuming project.
