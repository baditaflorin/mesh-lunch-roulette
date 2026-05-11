// Deterministic weighted-greedy pairing.
//
// Inputs:
//   roster: string[]                     names of people in the team (no duplicates)
//   history: Record<weekISO, Pairing>    past weeks' pairings
//   currentWeek: weekISO                 the week we're computing for
//   lookbackWeeks: number                weeks to consider for "weeks since last paired"
//   seed: number                         tiebreaker seed (for "re-pair this week")
//
// Output:
//   Pairing { pairs: [a, b][], triples?: [a, b, c][] }
//
// Algorithm:
//   1. Build all unordered pairs (a, b) where a < b lexicographically.
//   2. Weight each pair:
//        - Infinity if a and b have NEVER paired within `history`.
//        - else (weeksAgo) where weeksAgo is # of distinct weeks since their last meeting.
//        - 0 if they paired this week already (skip).
//   3. Sort by (weight desc, seeded-hash asc) for determinism + variety on re-pair.
//   4. Greedy: pick the top edge whose both endpoints are still unmatched; repeat.
//   5. If roster has odd N, drop the lowest-weighted person from greedy and attach them
//      to a random existing pair as a wildcard triple.

export type Pairing = {
  pairs: [string, string][];
  triples?: [string, string, string][];
};

export type History = Record<string, Pairing>;

const NEVER = Number.POSITIVE_INFINITY;

export function pairWeek(
  roster: string[],
  history: History,
  currentWeek: string,
  lookbackWeeks: number,
  seed: number,
): Pairing {
  const people = dedupePreserveOrder(roster).filter((n) => n.trim().length > 0);
  if (people.length < 2) return { pairs: [] };

  // weeksSinceLastPaired: build a map keyed by "a||b" (a<b) → weeksAgo (Infinity if never).
  const lastPaired = buildLastPaired(history, currentWeek);

  // Restrict to recent K weeks: if a pair happened within recent K weeks, treat
  // as "off-limits" by setting weight low. We do NOT outright forbid them since
  // for small teams it would be impossible.
  const orderedPeople = [...people].sort();

  const edges: { a: string; b: string; weight: number; tiebreak: number }[] = [];
  for (let i = 0; i < orderedPeople.length; i++) {
    for (let j = i + 1; j < orderedPeople.length; j++) {
      const a = orderedPeople[i]!;
      const b = orderedPeople[j]!;
      const key = pairKey(a, b);
      const last = lastPaired.get(key);
      const w = last === undefined ? NEVER : last; // weeks since (large = good, small = bad)
      if (w === 0) continue; // paired this very week already; skip
      const t = stableTiebreak(`${seed}|${key}`);
      // Pairs within the lookback window get a penalty so they're picked last.
      const adjusted =
        last !== undefined && last < lookbackWeeks ? w * 0.0001 : w === NEVER ? 1e9 : w;
      edges.push({ a, b, weight: adjusted, tiebreak: t });
    }
  }

  edges.sort((x, y) => {
    if (y.weight !== x.weight) return y.weight - x.weight; // larger weight first
    return x.tiebreak - y.tiebreak;
  });

  // Odd-N handling: drop one person first so greedy works on an even set.
  let oddOut: string | null = null;
  if (orderedPeople.length % 2 === 1) {
    // Pick the person whose top-2 average weight is lowest (they'd be hardest to pair anyway).
    oddOut = lowestPriorityPerson(orderedPeople, edges);
  }

  const unmatched = new Set(orderedPeople);
  if (oddOut) unmatched.delete(oddOut);

  const pairs: [string, string][] = [];
  for (const e of edges) {
    if (!unmatched.has(e.a) || !unmatched.has(e.b)) continue;
    pairs.push([e.a, e.b]);
    unmatched.delete(e.a);
    unmatched.delete(e.b);
    if (unmatched.size < 2) break;
  }

  // Any remaining (shouldn't happen for even N) → leftover (concat to oddOut)
  if (unmatched.size === 1) {
    const last = unmatched.values().next().value as string;
    if (oddOut) {
      // Two leftovers; pair them.
      pairs.push([oddOut, last].sort() as [string, string]);
      oddOut = null;
    } else {
      oddOut = last;
    }
  } else if (unmatched.size > 1) {
    // Shouldn't happen but guard
    const left = [...unmatched].sort();
    for (let i = 0; i + 1 < left.length; i += 2) {
      pairs.push([left[i]!, left[i + 1]!]);
    }
    if (left.length % 2 === 1) oddOut = left[left.length - 1]!;
  }

  const triples: [string, string, string][] = [];
  if (oddOut && pairs.length > 0) {
    // Deterministically attach oddOut to one pair (the one with the largest weight).
    // We use the seed to pick which pair.
    const idx = Math.abs(stableTiebreak(`${seed}|${oddOut}|triple`)) % pairs.length;
    const target = pairs[idx]!;
    triples.push([target[0], target[1], oddOut].sort() as [string, string, string]);
    pairs.splice(idx, 1);
  }

  return triples.length > 0 ? { pairs, triples } : { pairs };
}

function dedupePreserveOrder(xs: string[]): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const x of xs) {
    if (!seen.has(x)) {
      seen.add(x);
      out.push(x);
    }
  }
  return out;
}

function pairKey(a: string, b: string): string {
  return a < b ? `${a}||${b}` : `${b}||${a}`;
}

function buildLastPaired(history: History, currentWeek: string): Map<string, number> {
  const out = new Map<string, number>();
  const weeks = Object.keys(history).sort(); // ISO weeks sort lexically
  const currentIdx = isoWeekToOrdinal(currentWeek);
  for (const wk of weeks) {
    const p = history[wk];
    if (!p) continue;
    const weeksAgo = currentIdx - isoWeekToOrdinal(wk);
    const addPair = (a: string, b: string) => {
      const key = pairKey(a, b);
      const existing = out.get(key);
      if (existing === undefined || weeksAgo < existing) out.set(key, weeksAgo);
    };
    for (const [a, b] of p.pairs) addPair(a, b);
    for (const t of p.triples ?? []) {
      addPair(t[0], t[1]);
      addPair(t[0], t[2]);
      addPair(t[1], t[2]);
    }
  }
  return out;
}

function isoWeekToOrdinal(w: string): number {
  // "2026-W19" → 2026*60 + 19. Good enough for ordering; only differences matter.
  const m = /^(\d{4})-W(\d{2})$/.exec(w);
  if (!m) return 0;
  return Number(m[1]) * 60 + Number(m[2]);
}

function lowestPriorityPerson(
  people: string[],
  edges: { a: string; b: string; weight: number }[],
): string {
  const sum = new Map<string, number>();
  for (const p of people) sum.set(p, 0);
  for (const e of edges) {
    sum.set(e.a, (sum.get(e.a) ?? 0) + Math.min(e.weight, 1000));
    sum.set(e.b, (sum.get(e.b) ?? 0) + Math.min(e.weight, 1000));
  }
  let worst = people[0]!;
  let worstVal = Infinity;
  for (const [p, v] of sum) {
    if (v < worstVal) {
      worstVal = v;
      worst = p;
    }
  }
  return worst;
}

// FNV-1a 32-bit hash → signed-ish int, stable across machines.
export function stableTiebreak(s: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 0x01000193) >>> 0;
  }
  return h | 0;
}

// ISO week of a given date in local time (rough). Returns e.g. "2026-W19".
export function isoWeek(date: Date): string {
  const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
  const day = d.getUTCDay() || 7;
  d.setUTCDate(d.getUTCDate() + 4 - day);
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  const weekNum = Math.ceil(((d.getTime() - yearStart.getTime()) / 86400000 + 1) / 7);
  return `${d.getUTCFullYear()}-W${String(weekNum).padStart(2, "0")}`;
}
