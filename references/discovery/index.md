---
name: discovery
description: "Use during /bouncer-plan, or when named, to frame a change request into goal, scope, non-goals, and success criteria."
---

# Discovery

Turn a raw request into a shared understanding before any scaffolding or
implementation starts.

## When this applies

When clarifying a feature or change request into goal, scope, non-goals, and
success criteria before planning or scaffolding. Confirm the framing with the
user first. Used from `/bouncer-plan`.

## Steps

1. **Pre-read** — Before framing, consume the caller's code-search hits and
   `bouncer intent` results for related functions, plus epic indexes under
   `.bouncer/context/epics/`. Use resolver-selected non-historical Explain
   bodies only to inform `Overlap`; intent and Explain remain advisory data
   and never set `affected_paths`. Also read the project's own contribution
   rules where they exist — `CONTRIBUTING.md`, project agent instructions
   (`AGENTS.md`, `CLAUDE.md`), the CI workflow, and package scripts. A file
   that does not exist is not an error; record that none was found.
2. **Request** — Capture the user's ask in their words; note constraints and
   open questions.
3. **Goal** — State the outcome in one or two sentences.
4. **Scope** — List what is in for this unit of work.
5. **Non-goals** — List what is explicitly out (deferrals, adjacent work).
6. **Success criteria** — Define observable checks that prove the goal is met.
7. **Edge cases & failure modes** — Ask for edge cases and failure modes the
   change must handle or deliberately reject.
8. **Overlap** — Ask how this request overlaps with existing epic/blueprint
   streams and prior decisions; include the caller's intent/Explain evidence
   and epic-index hits, distinguish them from the current draft when present,
   and capture reuse vs. new work.
9. **Open decisions** — List every decision the request leaves open: a
   behavior that neither the request nor the code settles, where reasonable
   implementations would produce different observable results (how a new kind
   of record enters existing totals and counts, a default, an ordering, what
   happens at a boundary). Give the options for each. Do not settle an open
   decision by taking the likeliest reading — ask the user, all open decisions
   in one message, and wait for the answers before Confirmation. Record each
   answer next to its decision. Do not ask again what the request already
   states. When nothing is open, write `none` and name the evidence.
10. **Project rules** — From the contribution rules read in Pre-read, list
    each rule this change triggers: files that are generated and how to
    regenerate them, changelog or release-note entries, tests a behavior change
    must bring, and the command the project runs before merge. Write `none
    found` when the project has no such rules.
11. **Confirmation** — Present the framing (every handoff output) and get
    explicit user confirmation before moving on.

## Question checklist

In one clarifying pass, cover at least:

- Goal, scope, explicit non-goals, and success criteria
- Edge cases the change must survive
- Failure modes (what breaks, and what the change must reject)
- Overlap with existing epic/blueprint streams and resolver-selected intent
  evidence (Explain sections that are not historical)
- Open decisions the request and the code leave unsettled
- Project contribution rules this change triggers

## Guardrails

- Do not scaffold documents or change code during discovery.
- Prefer concrete, testable success criteria over vague aspirations.
- If the request is still ambiguous after one clarifying pass, ask again rather
  than inventing scope.
- A framing that states an assumption where the user could have been asked is
  not ready for Confirmation. Confirming the framing does not answer an open
  decision the framing never showed as open.
- Do not stop discovery solely because epic indexes or intent provenance are
  missing; record the gap and continue.
- For batching independent questions, light declaration versus approval, and
  step handoff, see `${BOUNCER_ROOT}/skills/bouncer-plan/references/roundtrip.md`.

## Return

Pass these named outputs to `/bouncer-plan` (do not persist them as new files):

- `Goal`
- `Scope`
- `Non-goals`
- `Success criteria`
- `Edge cases & failure modes`
- `Overlap`
- `Open decisions` (each with the user's answer, or `none`)
- `Project rules` (or `none found`)
