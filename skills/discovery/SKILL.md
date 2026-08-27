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
user first. Used from `/bouncer-plan`, or when the user asks for this skill by
name.

## Steps

1. **Pre-read** — Before framing, consume the caller's
   `bouncer distill --preflight` output together with the absolute path of
   the `--all` baseline file and epic indexes under
   `.bouncer/context/epics/`. The caller also supplies the absolute Distill
   path from `/bouncer-plan` for provenance; it is never derived from plugin
   root or cwd. Do not consume `--for` or another selective route before the
   request has confirmed paths. If the baseline file is missing, instruct the
   caller to re-run `bouncer distill --all`; do not substitute a route result
   for the baseline. If an index, Distill path, or shard index is missing,
   record Overlap as "none" when the CLI's single-file fallback is empty, and
   continue — pre-read is not a hard stop.
2. **Request** — Capture the user's ask in their words; note constraints and
   open questions.
3. **Goal** — State the outcome in one or two sentences.
4. **Scope** — List what is in for this unit of work.
5. **Non-goals** — List what is explicitly out (deferrals, adjacent work).
6. **Success criteria** — Define observable checks that prove the goal is met.
7. **Edge cases & failure modes** — Ask for edge cases and failure modes the
   change must handle or deliberately reject.
8. **Overlap** — Ask how this request overlaps with existing epic/blueprint
   streams and Distill decisions; capture reuse vs. new work.
9. **Confirmation** — Present the framing (all six handoff outputs) and get
   explicit user confirmation before moving on.

## Question checklist

In one clarifying pass, cover at least:

- Goal, scope, explicit non-goals, and success criteria
- Edge cases the change must survive
- Failure modes (what breaks, and what the change must reject)
- Overlap with existing epic/blueprint streams and Distill.md
  (caller `--preflight` output plus the `--all` baseline path)

## Guardrails

- Do not scaffold documents or change code during discovery.
- Prefer concrete, testable success criteria over vague aspirations.
- If the request is still ambiguous after one clarifying pass, ask again rather
  than inventing scope.
- Do not stop discovery solely because epic indexes or Distill.md are missing;
  record Overlap as "none" and continue.

## Return

Pass these named outputs to `/bouncer-plan` (do not persist them as new files):

- `Goal`
- `Scope`
- `Non-goals`
- `Success criteria`
- `Edge cases & failure modes`
- `Overlap`
