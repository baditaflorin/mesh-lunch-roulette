import { describe, expect, it } from "vitest";
import { pairWeek, isoWeek, stableTiebreak, type History } from "../../src/features/lunch/pairing";

/** Normalize a pairing to a sorted set of "a-b" / "a-b-c" strings for comparison. */
function asSet(p: { pairs: [string, string][]; triples?: [string, string, string][] }): string[] {
  const out = p.pairs.map(([a, b]) => [a, b].sort().join("-"));
  for (const t of p.triples ?? []) out.push([...t].sort().join("-"));
  return out.sort();
}

describe("pairWeek — shape", () => {
  it("pairs everyone on an even roster with no leftovers", () => {
    const { pairs, triples } = pairWeek(["A", "B", "C", "D"], {}, "2026-W01", 4, 0);
    expect(pairs).toHaveLength(2);
    expect(triples ?? []).toHaveLength(0);
    expect(pairs.flat().sort()).toEqual(["A", "B", "C", "D"]);
  });

  it("handles an odd roster with exactly one wildcard triple, covering everyone", () => {
    const { pairs, triples } = pairWeek(["A", "B", "C", "D", "E"], {}, "2026-W01", 4, 0);
    expect(triples ?? []).toHaveLength(1);
    const everyone = [...pairs.flat(), ...(triples ?? []).flat()].sort();
    expect(everyone).toEqual(["A", "B", "C", "D", "E"]);
  });

  it("returns no pairs when fewer than two people are on the roster", () => {
    expect(pairWeek(["A"], {}, "2026-W01", 4, 0)).toEqual({ pairs: [] });
    expect(pairWeek([], {}, "2026-W01", 4, 0)).toEqual({ pairs: [] });
  });

  it("ignores duplicate and blank names", () => {
    const { pairs } = pairWeek(["A", "A", "  ", "B"], {}, "2026-W01", 4, 0);
    expect(pairs.flat().sort()).toEqual(["A", "B"]);
  });
});

describe("pairWeek — freshness (the advertised core behavior)", () => {
  it("prefers a never-met pairing over re-running a recent one", () => {
    // A+B met last week. With only A, B, C, D available, the fresh choice is to
    // keep A+B apart and pair across the previous arrangement.
    const history: History = {
      "2026-W01": {
        pairs: [
          ["A", "B"],
          ["C", "D"],
        ],
      },
    };
    const { pairs } = pairWeek(["A", "B", "C", "D"], history, "2026-W02", 4, 0);
    const keys = asSet({ pairs });
    expect(keys).not.toContain("A-B");
    expect(keys).not.toContain("C-D");
  });

  it("cycles through every distinct pair of a 4-person team before any repeat", () => {
    // 4 people → 6 distinct pairs → 3 weeks of 2 pairs covers them all. The
    // matcher must produce 3 fully-fresh weeks before it is forced to repeat.
    const roster = ["A", "B", "C", "D"];
    const history: History = {};
    const seen = new Set<string>();
    for (const wk of ["2026-W01", "2026-W02", "2026-W03"]) {
      const p = pairWeek(roster, history, wk, 4, 0);
      history[wk] = p;
      for (const key of asSet(p)) {
        expect(seen.has(key), `repeat ${key} in ${wk} before full coverage`).toBe(false);
        seen.add(key);
      }
    }
    // All 6 distinct pairs covered across the three fresh weeks.
    expect([...seen].sort()).toEqual(["A-B", "A-C", "A-D", "B-C", "B-D", "C-D"]);
  });
});

describe("pairWeek — determinism (peers must agree)", () => {
  it("is identical for the same roster + history + seed (cross-peer guarantee)", () => {
    const roster = ["Ada", "Babbage", "Curie", "Darwin", "Euler", "Fermat"];
    const a = pairWeek(roster, {}, "2026-W10", 4, 0);
    const b = pairWeek(roster, {}, "2026-W10", 4, 0);
    expect(asSet(b)).toEqual(asSet(a));
  });

  it("is insertion-order independent — same set of names yields the same pairing", () => {
    const forward = pairWeek(["A", "B", "C", "D"], {}, "2026-W10", 4, 7);
    const shuffled = pairWeek(["D", "B", "A", "C"], {}, "2026-W10", 4, 7);
    expect(asSet(shuffled)).toEqual(asSet(forward));
  });

  it("re-pair (bumped seed) can produce a different arrangement", () => {
    // With many people and a fresh history, ties are broken by the seed, so a
    // different seed is allowed to reshuffle. We assert the seed actually
    // reaches the output for at least one of several seeds.
    const roster = ["A", "B", "C", "D", "E", "F", "G", "H"];
    const base = asSet(pairWeek(roster, {}, "2026-W10", 4, 0)).join("|");
    const differs = [1, 2, 3, 4, 5].some(
      (s) => asSet(pairWeek(roster, {}, "2026-W10", 4, s)).join("|") !== base,
    );
    expect(differs).toBe(true);
  });
});

describe("isoWeek + stableTiebreak", () => {
  it("formats ISO weeks as YYYY-Www", () => {
    expect(isoWeek(new Date("2026-01-05"))).toMatch(/^\d{4}-W\d{2}$/);
  });

  it("stableTiebreak is pure and machine-independent for a given string", () => {
    expect(stableTiebreak("seed|A||B")).toBe(stableTiebreak("seed|A||B"));
    expect(stableTiebreak("x")).not.toBe(stableTiebreak("y"));
  });
});
