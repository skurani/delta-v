// Demo rehearsal driver: walks DEMO_SCRIPT.md's golden path in the real UI
// (mock mode), captures each beat's reply text + screenshot. Reports; does
// not assert — the human (or the driving session) judges against the script.

import { chromium, type Page } from "playwright";

const OUT = "/private/tmp/claude-501/-Users-skurnai/f2457eeb-4787-4d21-9e3a-96944e4d2892/scratchpad";

async function agentReplies(page: Page): Promise<number> {
  return page.locator(".chat-agent .chat-bubble:not(.chat-thinking)").count();
}

async function ask(page: Page, text: string, viaChip: boolean) {
  const before = await agentReplies(page);
  if (viaChip) {
    await page.locator(`.suggestion-chip:has-text("${text.slice(0, 30)}")`).first().click();
  } else {
    await page.fill(".chat-input", text);
    await page.click(".chat-input-row .btn");
  }
  await page.waitForFunction(
    (n) => document.querySelectorAll(".chat-agent .chat-bubble:not(.chat-thinking)").length > n,
    before,
    { timeout: 30000 },
  );
  await page.waitForTimeout(400);
  const reply = await page
    .locator(".chat-agent .chat-bubble:not(.chat-thinking)")
    .last()
    .innerText();
  const tools = await page
    .locator(".chat-turn.chat-agent")
    .last()
    .locator(".tool-chip")
    .allInnerTexts();
  return { reply, tools };
}

async function shotLastTurn(page: Page, name: string) {
  await page.locator(".chat-turn.chat-agent").last().screenshot({ path: `${OUT}/${name}` });
}

async function main() {
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1440, height: 940 } });
  await page.goto("http://localhost:5173/", { waitUntil: "networkidle" });
  await page.waitForSelector(".kpi-grid");

  // Beat 1
  let r = await ask(page, "How's my spend looking this month?", true);
  console.log("=== BEAT 1 · tools:", r.tools.join(", "));
  console.log(r.reply, "\n");
  await shotLastTurn(page, "b1.png");

  // Beat 2
  r = await ask(page, "Why did my LLM spend spike?", true);
  console.log("=== BEAT 2 · tools:", r.tools.join(", "));
  console.log(r.reply, "\n");
  await shotLastTurn(page, "b2.png");

  // Beat 3
  r = await ask(page, "What would fixing it save?", true);
  console.log("=== BEAT 3 · tools:", r.tools.join(", "));
  console.log(r.reply, "\n");
  await shotLastTurn(page, "b3.png");

  // Beat 3.5 — heatmap, drill-down, pin, scrub
  r = await ask(page, "Show me the cost heatmap", true);
  console.log("=== BEAT 3.5 · tools:", r.tools.join(", "));
  console.log(r.reply, "\n");
  await shotLastTurn(page, "b35-chat.png");

  // Drill into the hottest cell ($82.05)
  await page.locator(".chat-dock .heatmap-cell", { hasText: "$82.05" }).first().click();
  await page.waitForSelector(".modal");
  const modalMeta = await page.locator(".modal-meta").innerText();
  console.log("=== BEAT 3.5 modal header:", modalMeta.replace(/\s+/g, " "));
  await page.locator(".modal").screenshot({ path: `${OUT}/b35-modal.png` });
  await page.keyboard.press("Escape");
  await page.waitForTimeout(200);

  // Pin, then scrub 10 days back and confirm the pinned card recomputes
  await page.locator(".chat-dock .pin-btn").last().click();
  await page.waitForSelector(".cell-pinned .heatmap");
  const pinnedBefore = await page.locator(".cell-pinned .heatmap-scope").innerText();
  const slider = page.locator(".scrubber input");
  await slider.focus();
  for (let i = 0; i < 10; i++) await page.keyboard.press("ArrowLeft");
  await page.waitForTimeout(400);
  const pinnedAfter = await page.locator(".cell-pinned .heatmap-scope").innerText();
  console.log("=== BEAT 3.5 pinned scope @ last day:", pinnedBefore.replace(/\s+/g, " "));
  console.log("=== BEAT 3.5 pinned scope @ -10 days:", pinnedAfter.replace(/\s+/g, " "));
  await page.locator(".cell-pinned").screenshot({ path: `${OUT}/b35-pinned-scrubbed.png` });
  await page.keyboard.press("End"); // restore to the last day
  await page.waitForTimeout(400);

  // Beat 4 — role FinOps (default), cap $20 → expect HOLD
  const role = await page.locator(".role-seg-active").innerText();
  console.log("=== BEAT 4 · active role:", role);
  r = await ask(page, "Cap the draft_reply budget at $20/mo", true);
  console.log("tools:", r.tools.join(", "));
  console.log(r.reply, "\n");
  const holdChip = await page.locator(".guardrail-card").last().locator(".chip").first().innerText();
  console.log("guardrail chip:", holdChip);
  await shotLastTurn(page, "b4-hold.png");

  // Beat 5 — toggle Eng, cap $70 → expect EXECUTED
  await page.locator(".role-seg", { hasText: "Eng" }).click();
  await page.waitForTimeout(200);
  r = await ask(page, "Cap the draft_reply budget at $70/mo", false);
  console.log("=== BEAT 5 · tools:", r.tools.join(", "));
  console.log(r.reply, "\n");
  const execChip = await page.locator(".guardrail-card").last().locator(".chip").first().innerText();
  console.log("guardrail chip:", execChip);
  await shotLastTurn(page, "b5-exec.png");

  await browser.close();
  console.log("REHEARSAL COMPLETE");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
