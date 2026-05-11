---
status: accepted
date: 2026-05-12
---

# 0002 — Weighted greedy bipartite matching

## Context

The mechanic of `mesh-lunch-roulette` is: given a team and the history of
who has paired with whom, produce a pairing for this week that maximizes
"freshness" — pair people who have never met first, then pair the
longest-time-since pairs, while never repeating a pair from the last K weeks
unless unavoidable.

This is the [maximum-weight perfect matching](https://en.wikipedia.org/wiki/Assignment_problem)
problem on an undirected graph. The optimal algorithm (Edmonds' Blossom for
general weighted matching) is around 500 lines of careful code. For team
sizes of N ≤ 20, the difference between optimal and greedy is negligible —
the optimal solution and a greedy one usually agree, and where they differ,
the greedy result is still "a sensible pairing this week."

## Decision

Use a **weighted greedy** algorithm:

1. Build all unordered pairs `(a, b)` with `a < b` lexicographically.
2. Compute the weight: `weeksSinceLastPaired(a, b)`, or `Infinity` if they
   have never paired in the recorded history. Pairs within the last K weeks
   get a penalty multiplier (×0.0001) so they're picked last.
3. Sort by `(weight desc, stableTiebreak asc)` — the tiebreak is FNV-1a of
   `${seed}|${pairKey}` for deterministic-but-shufflable order. Bumping
   `seed` (the "Re-pair this week" button) reshuffles ties without changing
   the strong preference for fresh pairs.
4. Walk the sorted list; pick the top edge whose both endpoints are still
   unmatched; mark both endpoints matched; repeat until ≤ 1 person remains.

**Odd-N handling.** If `|roster|` is odd, first remove one person ("oddOut")
using `lowestPriorityPerson(roster, edges)` — the person whose summed edge
weights are lowest, i.e. whose pairings would be most constrained. Run the
greedy on the remaining even set. Attach `oddOut` to the seed-chosen pair
to form a **wildcard triple**. This way the most-constrained person joins
the most freshly-paired existing duo.

## Consequences

- **Pros.**
  - 50 lines of code, easy to read and modify.
  - Deterministic: given identical inputs, every peer's view of "who pairs
    this week" is the same. No conflict-resolution needed across the mesh —
    pressing "Pair this week" on phone A and phone B simultaneously produces
    the same write to `Y.Map<history>`.
  - Re-pair button (bump `seed`) gives a controlled way to try a different
    arrangement that still respects history.
- **Cons.**
  - Greedy can occasionally pick a suboptimal global matching. For N=12
    with a thick history, optimal-minus-greedy is typically 0 or 1
    "weeks-since" sum points. Acceptable.
  - Pair "this week" is not visible until someone presses the button.
    Intentional — we don't want surprise pairings auto-generated.

## Alternatives considered

- **Edmonds' Blossom (optimal).** 500+ lines, debugging-heavy, gives 0 to
  marginal improvement for N ≤ 20. Rejected as wildly over-engineered for
  the use case.
- **Round-robin tournament.** Deterministic, easy, but loses the
  "weeks-since" weighting — you'd pair the same people in the same cycle
  forever, which is exactly what teams want to avoid.
- **Random shuffle.** Fine for the first few weeks but produces repeats
  long before everyone has met everyone. Rejected.

## Determinism guarantees

- `roster` is processed via `sort()` for stable order regardless of insertion order.
- `stableTiebreak()` is FNV-1a, machine-independent.
- ISO-week strings sort lexically the same as chronologically (within a year).
- Pair keys are always built with `a < b` so `(Alice, Bob)` and `(Bob, Alice)`
  hash identically.

All of these together mean two peers, given the same Yjs state, produce
identical pairings. There is no "leader" to break ties.
