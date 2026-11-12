import { initialize, sample, encode } from "../src/pipeline";
import { test, expect } from "@playwright/test";
test("self-hosted IBM Plex Sans renders UI text", async ({ page }) => {
  await page.goto("/");
  await page.evaluate(() => document.fonts.ready);
  const actual = await page.evaluate(() => ({
    family: getComputedStyle(document.querySelector("h1")!).fontFamily,
    loaded: Array.from(document.fonts).some((font) => font.family === "IBM Plex Sans" && font.status === "loaded"),
  }));
  expect(actual.family).toContain("IBM Plex Sans");
  expect(actual.loaded).toBe(true);
});
test("basic tab contains only upload, wall system, and face selection", async ({ page }) => {
  await page.goto("/");
  const basic = page.getByRole("tabpanel", { name: "Basic" });
  expect(await basic.locator("input, select, button").evaluateAll((items) => items.map((el) => el.id))).toEqual(["file", "wallSystem", "pick"]);
  await expect(page.getByRole("tab", { name: "Advanced" })).toBeVisible();
  await expect(page.getByLabel("I confirm")).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Rotate X +90°" })).toBeHidden();
  await page.getByRole("tab", { name: "Advanced" }).click();
  await expect(page.getByRole("button", { name: "Rotate X +90°" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Try a sample solid" })).toBeVisible();
  await page.getByRole("tab", { name: "Basic" }).click();
  await expect(basic).toBeVisible();
});
test("Fit view is available with both Basic and Advanced controls", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByRole("tab", { name: "Basic" })).toHaveAttribute("aria-selected", "true");
  await expect(page.getByRole("button", { name: "Fit view" })).toBeVisible();
  await page.getByRole("tab", { name: "Advanced" }).click();
  await expect(page.getByRole("button", { name: "Fit view" })).toBeVisible();
  await page.getByRole("tab", { name: "Basic" }).click();
  await page.getByRole("button", { name: "Fit view" }).click();
});
test("upload and face selection permit fusion without a confirmation box", async ({ page }) => {
  await initialize();
  await page.goto("/");
  await page.locator("#file").setInputFiles({ name: "cube.stl", mimeType: "model/stl", buffer: Buffer.from(encode(sample())) });
  await expect(page.getByRole("status")).toContainText("Solid validated");
  await expect(page.getByRole("tab", { name: "Basic" })).toHaveAttribute("aria-selected", "true");
  await expect(page.locator("#modelInfo")).toContainText("40.0 × 40.0 × 20.0 mm");
  await page.getByRole("button", { name: "Choose face center" }).click();
  const canvas = page.locator("#viewport canvas");
  const box = await canvas.boundingBox();
  if (!box) throw Error("No preview canvas");
  await canvas.click({ position: { x: box.width * 0.5, y: box.height * 0.54 } });
  await expect(page.getByRole("status")).toContainText("Placement preview ready");
  await expect(page.getByRole("button", { name: "Fuse & verify" })).toBeEnabled();
  await page.getByRole("button", { name: "Fuse & verify" }).click();
  await expect(page.getByRole("status")).toContainText("Verified: one connected");
  await expect(page.getByRole("button", { name: "Download STL" })).toBeEnabled();
});
test("sample -> placement -> real worker WASM union -> download, then invalidate", async ({
  page,
}) => {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.goto("/");
  await expect(
    page.getByRole("button", { name: "Download STL" }),
  ).toBeDisabled();
  await page.getByRole("tab", { name: "Advanced" }).click();
  await page.getByRole("button", { name: "Try a sample solid" }).click();
  await expect(page.getByRole("status")).toContainText("Solid validated");
  await page.getByRole("button", { name: "Use top centre" }).click();
  await expect(page.getByRole("status")).toContainText(
    "Placement preview ready",
  );
  await page.getByRole("button", { name: "Fuse & verify" }).click();
  await expect(page.getByRole("status")).toContainText(
    "Verified: one connected",
  );
  const download = page.waitForEvent("download");
  await page.getByRole("button", { name: "Download STL" }).click();
  expect((await download).suggestedFilename()).toBe(
    "hsw-prototype-fused-mm.stl",
  );
  await page.locator("#x").fill("100");
  await page.locator("#x").blur();
  await expect(page.getByRole("status")).toContainText(
    "Placement preview ready",
  );
  await expect(
    page.getByRole("button", { name: "Download STL" }),
  ).toBeDisabled();
  await page.getByRole("button", { name: "Fuse & verify" }).click();
  await expect(page.getByRole("status")).toContainText(
    "Disconnected connector",
  );
  await expect(
    page.getByRole("button", { name: "Download STL" }),
  ).toBeDisabled();
  expect(errors).toEqual([]);
});
test("mobile workspace has no horizontal overflow", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/");
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("Attach your model");
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
});
test("a new model clears previous placement and export", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("tab", { name: "Advanced" }).click();
  await page.getByRole("button", { name: "Try a sample solid" }).click();
  await expect(page.getByRole("status")).toContainText("Solid validated");
  await page.getByRole("button", { name: "Use top centre" }).click();
  await expect(page.getByRole("status")).toContainText("Placement preview ready");
  await page.getByRole("button", { name: "Fuse & verify" }).click();
  await expect(page.getByRole("button", { name: "Download STL" })).toBeEnabled();
  await page.getByRole("button", { name: "Try a sample solid" }).click();
  await expect(page.getByRole("status")).toContainText("Solid validated");
  await expect(page.getByRole("button", { name: "Fuse & verify" })).toBeDisabled();
  await expect(page.getByRole("button", { name: "Download STL" })).toBeDisabled();
});

test("invalid replacement STL cannot leave the previous model fuseable", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("tab", { name: "Advanced" }).click();
  await page.getByRole("button", { name: "Try a sample solid" }).click();
  await expect(page.getByRole("status")).toContainText("Solid validated");
  await page.getByRole("button", { name: "Use top centre" }).click();
  await expect(page.getByRole("status")).toContainText("Placement preview ready");
  await page.getByRole("tab", { name: "Basic" }).click();
  await page.locator("#file").setInputFiles({ name: "bad.stl", mimeType: "model/stl", buffer: Buffer.from("bad") });
  await expect(page.getByRole("status")).toContainText("STL file must");
  await expect(page.getByRole("button", { name: "Fuse & verify" })).toBeDisabled();
});

test("auto-suggests metres for a tiny-coordinate STL and allows override", async ({ page }) => {
  await initialize();
  const metres = sample().map((v) => v / 1000);
  await page.goto("/");
  await page.locator("#file").setInputFiles({
    name: "metre-export.stl", mimeType: "model/stl", buffer: Buffer.from(encode(metres)),
  });
  await expect(page.getByRole("status")).toContainText("Solid validated");
  await expect(page.locator("#modelInfo")).toContainText("40.0 × 40.0 × 20.0 mm");
  await page.getByRole("tab", { name: "Advanced" }).click();
  await expect(page.locator("#unitInfo")).toContainText("Metres detected");
  await page.getByLabel("STL coordinate units").selectOption("mm");
  await expect(page.getByRole("status")).toContainText("Size guard");
  await page.getByLabel("STL coordinate units").selectOption("m");
  await expect(page.getByRole("status")).toContainText("Solid validated");
});

test("clicking a cube face snaps to its whole planar patch center", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("tab", { name: "Advanced" }).click();
  await page.getByRole("button", { name: "Try a sample solid" }).click();
  await expect(page.getByRole("status")).toContainText("Solid validated");
  await page.getByRole("tab", { name: "Basic" }).click();
  await page.getByRole("button", { name: "Choose face center" }).click();
  const canvas = page.locator("#viewport canvas");
  const box = await canvas.boundingBox();
  if (!box) throw Error("No preview canvas");
  await canvas.click({position: {x: box.width * 0.5, y: box.height * 0.54}});
  await page.getByRole("tab", { name: "Advanced" }).click();
  await expect(page.locator("#normal")).toContainText("Face center");
  await expect(page.locator("#normal")).toContainText("2 triangles");
  await expect(page.getByRole("status")).toContainText("Placement preview ready");
});
test("rotating a side upward changes the model and top-center placement", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("tab", { name: "Advanced" }).click();
  await page.getByRole("button", { name: "Try a sample solid" }).click();
  await expect(page.getByRole("status")).toContainText("Solid validated");
  await page.getByRole("button", { name: "Rotate X +90°" }).click();
  await expect(page.locator("#modelInfo")).toContainText("40.0 × 20.0 × 40.0 mm");
  await page.getByRole("button", { name: "Use top centre" }).click();
  await expect(page.locator("#z")).toHaveValue("20");
  await page.getByRole("button", { name: "Fuse & verify" }).click();
  await expect(page.getByRole("status")).toContainText("Verified: one connected");
  await page.getByRole("button", { name: "Reset orientation" }).click();
  await expect(page.locator("#modelInfo")).toContainText("40.0 × 40.0 × 20.0 mm");
  await expect(page.getByRole("button", { name: "Download STL" })).toBeDisabled();
});
