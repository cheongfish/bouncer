# Init result handling

Read this reference only after `bouncer init` has returned and its result needs
rendering or a Promotion, Gitignore, or Branch consent decision.

Render `already-initialized`, seeded/migrated Distill, created targets, and any
Codex-agent paths from the returned fields. Root `context/` is legacy and is
not input. For `graphifyInstall`, report the recorded binary on success. On
failure, Graphify remains disabled: report the cause and direct the user to
install it manually, then recover later with `bouncer init --promote-graphify`.
Do not edit Graphify config directly.

When `graphifyPromotion: 'candidate'`, ask in this order:

- **A)** Enable and install (recommended): `bouncer init --promote-graphify`
- **B)** Enable only: `bouncer init --promote-graphify --no-graphify`
- **C)** Leave as-is: write nothing.

In a non-interactive environment, show these choices and stop. When
`gitignoreSuggestions` is non-empty, list them and run `bouncer init
--write-gitignore` only after consent; decline leaves `.gitignore` untouched.
When `baseBranchUnresolved: true`, ask for the default branch without guessing;
on an answer write the same value to `base_branch` and `pr.base`, otherwise
leave both absent.
