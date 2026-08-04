---
name: discovery
description: "Use when clarifying a feature or change request into goal, scope, non-goals, and success criteria before planning or scaffolding. Confirm the framing with the user first. Use only while working inside an active Bouncer blueprint, unless the user explicitly asks for this skill by name."
---

# Discovery

Turn a raw request into a shared understanding before any scaffolding or
implementation starts.

## Flow

1. **Request** — Capture the user's ask in their words; note constraints and
   open questions.
2. **Prior art** — Read `.bouncer/context/Distill.md` and the Blueprints lists
   under `.bouncer/context/epics/*/index.md`. Note any overlapping streams in
   the framing. Empty prior-art results are fine (no epics yet, or a fresh
   Distill) — continue; do not block the flow.
3. **Goal** — State the outcome in one or two sentences.
4. **Scope** — List what is in for this unit of work.
   Ask in one pass: edge cases, failure modes, what not to do, and overlap
   with existing streams.
5. **Non-goals** — List what is explicitly out (deferrals, adjacent work).
   Ask in one pass: edge cases, failure modes, what not to do, and overlap
   with existing streams.
6. **Success criteria** — Define observable checks that prove the goal is met.
   Ask in one pass: edge cases, failure modes, what not to do, and overlap
   with existing streams.
7. **Confirmation** — Present the framing and get explicit user confirmation
   before moving on.

## Handoff

After Confirmation, carry all five items into the next step (e.g.
`spec-authoring` via `/bouncer-plan`). If any item is missing, re-run
Confirmation before handing off:

1. Goal
2. Scope
3. Non-goals
4. Numbered success criteria
5. Relationship to existing streams

## Guardrails

- Do not scaffold documents or change code during discovery.
- Prefer concrete, testable success criteria over vague aspirations.
- If the request is still ambiguous after one clarifying pass, ask again rather
  than inventing scope.
