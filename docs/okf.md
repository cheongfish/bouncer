# OKF

Target OKF spec version: **0.1**, declared in the bundle-root
`.bouncer/context/index.md` frontmatter. That is the one place OKF §11 permits it.

Every `context/**/*.md` document carries OKF frontmatter
(`type`, `title`, `description`, `resource`, `tags`, `timestamp`); Bouncer
fields live under `bouncer:`. See the schema-gates design for the full schema.

Harness-written timestamps use **KST** (`Asia/Seoul`, offset `+09:00`), e.g.
`2026-08-03T18:00:00.000+09:00`. Pass `--timestamp` to override when scaffolding.

Known divergence from OKF v0.1: epic and blueprint concept documents are named
`index.md`, which §3.1 reserves for directory listings, so the bundle is not
yet §9-conformant. Tracked separately from template authoring.
