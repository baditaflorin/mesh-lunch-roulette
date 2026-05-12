---
status: accepted
date: 2026-05-12
---

# 0003 — ISO week as the period key

## Context

Pairings need to be bucketed by some period — daily would be too noisy,
monthly too sparse, and "the last 5 sessions" hides the calendar drift.
Teams naturally think in weeks: "who am I getting coffee with this week?"

## Decision

Use **ISO week strings** as the key into the `Y.Map<weekISO, Pairing>` history.

```ts
isoWeek(new Date()); // → "2026-W19"
```

The format is `YYYY-Www` where `ww` is zero-padded. This is the ISO 8601
week-date convention: weeks run Monday → Sunday, the week containing
January 4 is W01, and so on. Lexical sort of these strings matches
chronological order within a year, and remains correct across year boundaries
because the year prefix dominates.

The current "active" week is stored in the `state` Y.Map as
`state.set("week", { currentWeek: "2026-W19", seedBump: 0 })`. The "Pair this
week" button writes the result into `history[currentWeek]`. A user opening
the app gets `currentWeek` from `isoWeek(new Date())` if `state` is empty.

## Consequences

- **Pros.**
  - Human-readable. "2026-W19" tells you exactly when it was.
  - Stable across time zones up to an 8-hour window — ISO weeks roll over
    on Monday 00:00 _local_ time, but our `isoWeek()` uses UTC, so the
    "week" boundary is the same for everyone in the team within UTC offsets
    of ±12h.
  - Idempotent: a team in two time zones who both compute the week label
    for "right now" land on the same string anywhere from Monday morning
    UTC through Sunday night UTC.
  - Sorts and groups for free in JS objects and `Y.Map.keys()`.
- **Cons.**
  - On the Monday-morning-UTC boundary, a team meeting on Sunday evening in
    one zone and Monday morning in another might disagree on which week
    they're in for ~12 hours. Acceptable — they'll see the same pairing in
    both labels once any peer presses "Pair."
  - For teams crossing the international date line (rare), worst-case 24h
    disagreement.

## Re-pair semantics

Pressing **"Re-pair this week"** bumps `state.week.seedBump` by 1, then runs
the algorithm again with the new seed. The new result overwrites
`history[currentWeek]`. The history of past weeks is unchanged. The team
sees the new pairs immediately via Yjs replication.

## Clear history

The Settings drawer exposes "Clear pairing history." This deletes all entries
from `Y.Map<history>` inside a `transact` block (per the spec gotcha
about `Y.Map.clear()` not firing `observe`). After clearing, the next
"Pair this week" treats all pairs as "never paired," i.e. `Infinity` weight.

## Alternatives considered

- **Epoch-day numbers (`Math.floor(now / 86400000)`).** Compact, sortable,
  but inscrutable to humans.
- **Date-of-Monday in `YYYY-MM-DD`.** Equivalent expressiveness, slightly
  more characters, doesn't match "the week of Jan 4 is week 1" cleanly.
- **Free-form labels** (`"sprint 12"`). Nice for branding, hard to
  auto-compute "what week is it now" without per-team config.
