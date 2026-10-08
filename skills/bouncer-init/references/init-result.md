# Init result handling

Read this reference only after `bouncer init` has returned and its result needs
rendering or a Promotion, Gitignore, or Branch consent decision.

Render `already-initialized`, created canonical-context targets, and any
Codex-agent paths from the returned fields. Root `context/` is legacy and is
not input. For `graphifyInstall`, report the recorded binary on success. On
failure, Graphify remains disabled: report the cause and direct the user to
install it manually, then recover later with `bouncer init --promote-graphify`.
Do not edit Graphify config directly. To change `subagents` keys in
`.bouncer/config.json`, run `bouncer config --help` for the key names, allowed
values, and defaults instead of reading plugin sources.

When `graphifyPromotion: 'candidate'`, ask gate `init.graphify_promotion` in this order:

- **A)** Enable and install (recommended): `bouncer init --promote-graphify`
- **B)** Enable only: `bouncer init --promote-graphify --no-graphify`
- **C)** Leave as-is: write nothing.

In a non-interactive environment, show these choices and stop. When
`gitignoreSuggestions` is non-empty, list them in gate `init.gitignore` and run `bouncer init
--write-gitignore` only after consent; decline leaves `.gitignore` untouched.
When `baseBranchUnresolved: true`, ask gate `init.base_branch` for the default branch without guessing;
on an answer write the same value to `base_branch` and `pr.base`, otherwise
leave both absent.

When the result has no `preCommitHook` field, ask gate `init.pre_commit_hook`
before writing a hook. Do not pass `--pre-commit-hook` without that answer.

- **A)** Install the git pre-commit hook (recommended): `bouncer init --pre-commit-hook`
- **B)** Do not install: leave hooks unchanged.

When `preCommitHook` is `installed`, `chained`, or `already-installed`, report
that the hook is in Git's default `hooks/pre-commit`. `chained` means a previous
user hook was moved to `pre-commit.bouncer-prev` and still runs first.
When `preCommitHook` is `skipped-hooks-path`, show `preCommitHookWarning` and do
not write a hook — `core.hooksPath` already redirects Git away from `hooks/`.
When `preCommitHook` is `skipped-no-git`, say the directory is not a Git
repository so the hook was not installed.

