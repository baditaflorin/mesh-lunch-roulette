import { expect, test, type Page } from "@playwright/test";
import { openTwoPeers } from "@baditaflorin/mesh-common/testing";
import { readFileSync } from "node:fs";

const pkg = JSON.parse(readFileSync(new URL("../../package.json", import.meta.url), "utf8")) as {
  name: string;
};
const storagePrefix = pkg.name;

/**
 * Load-bearing cross-peer assertion for the advertised core action:
 *
 *   "Add your team's names to the shared roster. Choose this week's table —
 *    the pairing is deterministic given the same inputs, and any peer's view
 *    is authoritative."
 *
 * The pairing RESULT is computed once (FNV-1a-seeded deterministic greedy in
 * pairing.ts) and written into a shared `Y.Map("history")` keyed by the ISO
 * week, alongside `Y.Array("roster")`. Both peers READ the same stored result,
 * so the falsifiable claim is: when peer A adds the roster and chooses the
 * table, peer B sees the *identical* pairs.
 *
 * Peer A drives the action; peer B asserts the result. The test is wired to
 * FAIL if the roster or the pairing result never crosses the mesh (e.g. the
 * write goes to React state, or A and B read/write different Y keys), or if the
 * two peers disagree on the pairing.
 */

async function addName(page: Page, name: string): Promise<void> {
  const input = page.getByPlaceholder("Name");
  await input.fill(name);
  await page.getByRole("button", { name: /^Add$/ }).click();
  await expect(input).toHaveValue("");
}

/** Read the rendered pairs list on a peer as a normalized, order-independent set. */
async function readPairs(page: Page): Promise<string[]> {
  const items = await page.locator(".lunch-pairs ul li").allInnerTexts();
  return items
    .map((t) =>
      t
        .replace(/\(triple\)/i, "")
        .replace(/\s+/g, " ")
        .trim(),
    )
    .filter(Boolean)
    .sort();
}

test("peer A's shared lunch decision is identical on peer B", async ({ browser, baseURL }) => {
  const { a, b, cleanup } = await openTwoPeers(browser, baseURL ?? "", { storagePrefix });
  try {
    // The decision board is the entry view: both peers can see the actual
    // shared roster and the decisive action without first passing a fake
    // launch screen.
    await expect(a.getByTestId("shared-roster")).toBeVisible();
    await expect(b.getByTestId("shared-roster")).toBeVisible();
    await expect(a.getByRole("button", { name: /choose this week/i })).toBeDisabled();

    // Peer A populates the shared roster (4 names → 2 clean pairs).
    const roster = ["Ada", "Babbage", "Curie", "Darwin"];
    for (const name of roster) await addName(a, name);

    // Roster crosses the mesh: peer B sees every name (proves Y.Array sync).
    for (const name of roster) {
      await expect(b.locator(".lunch-roster li", { hasText: name })).toBeVisible();
    }

    // Drive the advertised core action on peer A.
    await a.getByRole("button", { name: /Choose this week/i }).click();

    // Peer A computed + stored the pairing; assert A renders some pairs.
    await expect(a.locator(".lunch-pairs ul li").first()).toBeVisible();
    const pairsA = await readPairs(a);
    expect(pairsA.length).toBeGreaterThan(0);

    // OPPOSITE-PEER assertion: peer B observed the shared history Y.Map and now
    // renders the SAME pairing. Poll until B's list is non-empty, then compare.
    await expect(b.locator(".lunch-pairs ul li").first()).toBeVisible({ timeout: 8_000 });
    const pairsB = await readPairs(b);

    // Determinism + sync: the two peers agree on the exact pairing.
    expect(pairsB).toEqual(pairsA);
    // And it is a real pairing of the 4-person roster (2 pairs).
    expect(pairsA).toHaveLength(2);
  } finally {
    await cleanup();
  }
});
