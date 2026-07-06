import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { generateEvents } from "./generator";
import { customerSupportConfig, codingAgentConfig } from "./presets";

// Swap presets here — this is the one-line domain change (SPEC.md §3):
const config = customerSupportConfig; // or: codingAgentConfig

const events = generateEvents(config);

const outDir = join(dirname(fileURLToPath(import.meta.url)), "..", "data");
mkdirSync(outDir, { recursive: true });
const outFile = join(outDir, "usage-events.json");

writeFileSync(
  outFile,
  JSON.stringify({ generated_at: new Date().toISOString(), config, events }, null, 1),
);

// Quick sanity summary so a run is self-verifying.
const byDay = new Map<string, number>();
const llmByDay = new Map<string, number>();
for (const e of events) {
  const day = e.timestamp.slice(0, 10);
  byDay.set(day, (byDay.get(day) ?? 0) + e.cost);
  if (e.resource_type === "llm") llmByDay.set(day, (llmByDay.get(day) ?? 0) + e.cost);
}
const days = [...byDay.keys()].sort();
const llmCosts = days.map((d) => llmByDay.get(d) ?? 0);
const baselineLlm = llmCosts.slice(0, config.anomaly.day).reduce((a, b) => a + b, 0) / config.anomaly.day;
const peakLlm = Math.max(...llmCosts);

console.log(`preset:            ${config.preset}`);
console.log(`events:            ${events.length}`);
console.log(`range:             ${days[0]} → ${days[days.length - 1]}`);
console.log(`total cost:        $${[...byDay.values()].reduce((a, b) => a + b, 0).toFixed(2)}`);
console.log(`baseline LLM/day:  $${baselineLlm.toFixed(2)}`);
console.log(`peak LLM day:      $${peakLlm.toFixed(2)}  (${(peakLlm / baselineLlm).toFixed(1)}x baseline)`);
console.log(`wrote:             ${outFile}`);
