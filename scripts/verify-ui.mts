import { chromium } from "playwright";

const OUT = "/private/tmp/claude-501/-Users-skurnai/f2457eeb-4787-4d21-9e3a-96944e4d2892/scratchpad";

async function main() {
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1440, height: 940 } });
  await page.goto("http://localhost:5173/", { waitUntil: "networkidle" });
  await page.waitForSelector(".kpi-grid", { timeout: 15000 });

  // 1. Full canvas at design width — KPI bar contrast + commitment pills.
  await page.screenshot({ path: `${OUT}/1-canvas-1440.png` });

  // Commitments card close-up (pill truncation check).
  const commit = page.locator(".cell", { hasText: "commitments" }).first();
  await commit.screenshot({ path: `${OUT}/2-commitments.png` });

  // KPI row close-up (progress bar contrast).
  const kpis = page.locator(".kpi-grid").first();
  await kpis.screenshot({ path: `${OUT}/3-kpis.png` });

  // 2. Heatmap via chat (column-header truncation check).
  await page.click(".suggestion-chip:has-text('heatmap')");
  await page.waitForSelector(".chat-dock .heatmap", { timeout: 20000 });
  await page.waitForTimeout(400);
  const heatChat = page.locator(".chat-dock .heatmap").first();
  await heatChat.screenshot({ path: `${OUT}/4-heatmap-dock.png` });

  // Pin it and screenshot the canvas version (wider — labels should be roomy).
  await page.click(".pin-btn");
  await page.waitForTimeout(400);
  const pinned = page.locator(".cell-pinned .heatmap").first();
  await pinned.screenshot({ path: `${OUT}/5-heatmap-pinned.png` });

  // 3. Narrow widths — KPI stacking.
  await page.setViewportSize({ width: 1000, height: 940 });
  await page.waitForTimeout(300);
  await page.locator(".kpi-grid").first().screenshot({ path: `${OUT}/6-kpis-1000.png` });

  await page.setViewportSize({ width: 700, height: 940 });
  await page.waitForTimeout(300);
  await page.screenshot({ path: `${OUT}/7-app-700.png` });

  await browser.close();
  console.log("screenshots written");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
