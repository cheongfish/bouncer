# OKF

Target OKF spec version: **0.1**, declared in the bundle-root
`.bouncer/context/index.md` frontmatter — the one place OKF §11 permits it.
`config.json`'s `schema_version` is Bouncer's own frontmatter schema version
and is not an OKF version string.

Every `context/**/*.md` document carries OKF frontmatter
(`type`, `title`, `description`, `resource`, `tags`, `timestamp`); Bouncer
fields live under `bouncer:`. See the schema-gates design for the full schema.

Known divergence from OKF v0.1: epic and blueprint concept documents are named
`index.md`, which §3.1 reserves for directory listings, so the bundle is not
yet §9-conformant. Tracked separately from template authoring.
