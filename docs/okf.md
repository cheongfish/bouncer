# OKF

Target OKF spec version: **0.1**, declared in the bundle-root
`.bouncer/context/index.md` frontmatter. That is the one place OKF §11 permits it.

The same bundle-root frontmatter also carries `bouncer_schema: "0.1"`. That
value is Bouncer's document-schema promise (what `bouncer.*` kinds and fields
mean), not the OKF package version. Keep it only on the bundle root — putting
it on every epic/blueprint/task document would drift. The string stays
`"0.1"` until a later epic promotes the schema; this cutover does not bump it
to `1.0`.

Every `context/**/*.md` document carries OKF frontmatter
(`type`, `title`, `description`, `resource`, `tags`, `timestamp`); Bouncer
fields live under `bouncer:`. See the schema-gates design for the full schema.

A task unit is the three-document bundle
`tasks/<NNN>/{tasks,verification,review}.md`; each file has its own OKF
frontmatter and `resource` path. Root task layouts are retained only as
migration targets during the transition.

Harness-written timestamps use **KST** (`Asia/Seoul`, offset `+09:00`), e.g.
`2026-08-03T18:00:00.000+09:00`. Pass `--timestamp` to override when scaffolding.

Known divergence from OKF v0.1: epic and blueprint concept documents are named
`index.md`, which §3.1 reserves for directory listings, so the bundle is not
yet §9-conformant. Tracked separately from template authoring.
