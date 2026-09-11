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

1. **Pre-read** — Before framing, consume the caller's context-search result
   from the already-synced context graph and epic indexes under
   `.bouncer/context/epics/`. Preserve its query id, mode, status, graph
   version, and selected canonical paths. Use
   its prior decisions, predecessor blueprints, and constraints only to inform
   `Overlap`; candidates remain advisory data and never set `affected_paths`.
2. **Request** — Capture the user's ask in their words; note constraints and
   open questions.
3. **Goal** — State the outcome in one or two sentences.
4. **Scope** — List what is in for this unit of work.
5. **Non-goals** — List what is explicitly out (deferrals, adjacent work).
6. **Success criteria** — Define observable checks that prove the goal is met.
7. **Edge cases & failure modes** — Ask for edge cases and failure modes the
   change must handle or deliberately reject.
8. **Overlap** — Ask how this request overlaps with existing epic/blueprint
   streams and prior context decisions; include the pre-scaffold context-search
   evidence, distinguish it from the current draft when present, and capture
   reuse vs. new work.
9. **Confirmation** — Present the framing (all six handoff outputs) and get
   explicit user confirmation before moving on.

## Question checklist

In one clarifying pass, cover at least:

- Goal, scope, explicit non-goals, and success criteria
- Edge cases the change must survive
- Failure modes (what breaks, and what the change must reject)
- Overlap with existing epic/blueprint streams and canonical context decisions
  (caller query id, status, graph version, and selected paths)

## Guardrails

- Do not scaffold documents or change code during discovery.
- Prefer concrete, testable success criteria over vague aspirations.
- If the request is still ambiguous after one clarifying pass, ask again rather
  than inventing scope.
- Do not stop discovery solely because epic indexes or graph candidates are
  missing; record the broad/zero-hit diagnosis and continue.

## Return

Pass these named outputs to `/bouncer-plan` (do not persist them as new files):

- `Goal`
- `Scope`
- `Non-goals`
- `Success criteria`
- `Edge cases & failure modes`
- `Overlap`
