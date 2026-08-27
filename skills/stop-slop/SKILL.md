---
name: stop-slop
description: "Use when drafting or revising Korean Bouncer context prose, or when named, to strip AI writing tells; advisory, not a gate."
---

# Stop Slop

Strip predictable AI writing patterns from **Korean** bodies under
`.bouncer/context/` (epics and BP explain). Advisory — not a gate. Does not
score plan/execute/finalize success. Do not run this skill on
`.bouncer/Distill.md`.

Adapted from [Hardik Pandya's stop-slop](https://hvpandya.com) (MIT). Keep this
folder's `LICENSE` with the original copyright. Skill instructions stay English
(plugin convention); targets and examples are Korean context docs.

## When this applies

**In scope:** epic / blueprint / tasks / explain body prose under
`.bouncer/context/` that a human reads (Korean).

**Out of scope:** project Distill (`.bouncer/Distill.md`, English agent
runtime), plugin skill markdown, CLI/gate English strings, code, identifiers,
file paths, fenced code blocks, commit `type` tokens.

## Language

Context bodies are **Korean**. Keep paths, ids (`EPIC-…`, `BP-…`), commands, and
code fences as-is. Do not pad Korean with English overview sentences.

## Core rules

1. **Cut filler.** Drop throat-clearing and emphasis crutches. See
   [references/phrases.md](references/phrases.md).
2. **Break formulaic structures.** No binary contrast runways, negation lists,
   or fake drama. See [references/structures.md](references/structures.md).
3. **Name the actor.** Prefer concrete subjects and active verbs. Avoid empty
   passives and abstract subjects doing human work.
4. **Be specific.** Name the file, gate, field, or command. Drop vague
   declaratives and lazy extremes that carry no fact.
5. **Write for the reader in the room.** Prefer 직설. Skip narrator distance and
   hand-holding.
6. **Vary rhythm.** Mix sentence length. Two items beat three. No em-dash
   theatrics; no closing punch-line that only restates the section.
7. **Trust the reader.** State the fact. Skip softening and justification
   padding.
8. **Cut quotables.** If a line sounds like a poster slogan, rewrite it as a
   plain sentence.

## Quick checks

Before leaving a draft:

- Filler openers (`다음과 같습니다`, `중요한 점은`, `살펴보면`)? Cut.
- Passive with no actor? Name who does the work.
- Section ends by summarizing itself? Delete the summary.
- English overview mixed into Korean body? Translate or drop.
- Three same-length sentences in a row? Break one.
- Anything cuttable without losing a fact? Cut it.

## Scoring (self-check only)

Rate 1–10: Directness, Rhythm, Trust, Authenticity, Density. Below 35/50:
revise. Do **not** treat the score as gate evidence.

## Examples

See [references/examples.md](references/examples.md).

## Guardrails

- Advisory only — not a gate. Does not score plan/execute/finalize success.
- Do not run this skill on project Distill (`.bouncer/Distill.md`).
- Keep paths, ids, commands, and fenced code as-is.
- Do not invent verification.md or gate outcomes.

## Return

Report which documents you revised and whether any filler/structure passes
remain. Do not invent verification.md or gate outcomes.
