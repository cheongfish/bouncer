# Governance

## Blueprint sizing rule

Each **task bundle** (`tasks/<NNN>/{tasks,verification,review}.md`) is sized
for **one reviewable commit**. A blueprint may hold several task bundles and
remains the review / PR unit. Root `tasks.md` and `tasks-NNN.md` documents are
legacy migration targets. If a task feels too large for one commit, split it
into more task bundles (or more blueprints). Do **not** invent a further
subtask layer beneath a task bundle.
