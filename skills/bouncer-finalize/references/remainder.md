When running the finalize gate, showing the dry-run, or handling a scope or `reason: 'verify'` failure, read this reference.

The CLI owns the finalize gate, allowed paths, deletions, status transition,
and commit-message format. Run the finalize gate:
```bash
bouncer validate --blueprint <pointer.blueprint> --gate finalize
```
On any gate, verify, dry-run, or scope failure, preserve documents and worktree;
report validator code, cause, path, and recovery action, then fix every
failure before rerunning. Dry-run:
```bash
bouncer finalize --blueprint <pointer.blueprint>
```
This checks every remaining uncommitted change (tracked or untracked) against
the allowed-set. Anything out of scope is a **hard abort — nothing staged**;
show the violations and have the user fix paths or remove the stray files. On a
clean dry-run (or empty staged set), show the staged file list + generated
commit message, then return to the numbered Remainder ACQ before `--yes`.

`--yes` runs verification commands before staging. Per the shared contract,
clear the pointer. A `reason: 'verify'` failure has no bypass other than
fixing the cause and rerunning.
