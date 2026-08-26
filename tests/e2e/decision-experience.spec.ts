import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";

async function openDecisionBoard(
  page: import("@playwright/test").Page,
  viewport: { width: number; height: number },
): Promise<void> {
  await page.setViewportSize(viewport);
  await page.goto("./", { waitUntil: "domcontentloaded" });
  await expect(page.getByTestId("shared-roster")).toBeVisible();
}

async function assertActionAboveFold(
  page: import("@playwright/test").Page,
  viewport: { width: number; height: number },
): Promise<void> {
  const action = page.getByRole("button", { name: /choose this week/i });
  await expect(action).toBeVisible();
  const box = await action.boundingBox();
  expect(box, "The primary decision action should have a measurable box.").not.toBeNull();
  expect((box?.y ?? Infinity) + (box?.height ?? Infinity)).toBeLessThanOrEqual(viewport.height);
}

test("phone entry view keeps the shared roster and decision action in view without overflow", async ({
  page,
}) => {
  const viewport = { width: 390, height: 844 };
  await openDecisionBoard(page, viewport);
  await assertActionAboveFold(page, viewport);

  const dimensions = await page.evaluate(() => ({
    viewportWidth: window.innerWidth,
    scrollWidth: document.documentElement.scrollWidth,
    bodyScrollWidth: document.body.scrollWidth,
  }));
  expect(dimensions.scrollWidth).toBeLessThanOrEqual(dimensions.viewportWidth);
  expect(dimensions.bodyScrollWidth).toBeLessThanOrEqual(dimensions.viewportWidth);

  const accessibility = await new AxeBuilder({ page }).include("main").analyze();
  expect(accessibility.violations, accessibility.violations.map((v) => v.id).join(", ")).toEqual(
    [],
  );
});

test("short desktop entry view keeps the primary decision action above the fold", async ({
  page,
}) => {
  const viewport = { width: 1141, height: 602 };
  await openDecisionBoard(page, viewport);
  await assertActionAboveFold(page, viewport);
  await expect(page.getByText("Shared roster", { exact: true })).toBeVisible();
  await expect(page.getByRole("button", { name: /choose this week/i })).toBeDisabled();
});
