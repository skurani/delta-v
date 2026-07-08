// Console sanity-check for metering + attribution (no dashboard yet).
// Reads data/usage-events.json, rates it, rolls it up, prints tables.
//   npm run report

import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { attribute, topEntries, type Rollup } from "./attribution";
import { meterEvents } from "./meter";
import type { GeneratorConfig, UsageEvent } from "./schema";

const dataFile = join(dirname(fileURLToPath(import.meta.url)), "..", "data", "usage-events.json");
const { config, events } = JSON.parse(readFileSync(dataFile, "utf8")) as {
  config: GeneratorConfig;
  events: UsageEvent[];
};

const metered = meterEvents(events, config.commitments ?? []);
const attributed = attribute(metered.events);

const $ = (x: number) => "$" + x.toFixed(2);
const pct = (x: number) => (x * 100).toFixed(1) + "%";

function printDim(title: string, dim: Record<string, Rollup>, limit = 10) {
  console.log(`\n${title}`);
  for (const [key, r] of topEntries(dim, limit)) {
    console.log(
      `  ${key.padEnd(22)} ${$(r.cost).padStart(10)}  ${pct(r.share).padStart(6)}  (${r.events} events)`,
    );
  }
}

console.log(`preset: ${config.preset}   window: ${config.days} days   events: ${events.length}`);
console.log(`raw cost (as emitted):   ${$(metered.totals.rawCost)}`);
console.log(`rated cost (metered):    ${$(metered.totals.ratedCost)}`);

console.log("\nCOMMITMENTS");
for (const c of metered.commitments) {
  console.log(
    `  ${(c.provider + " / " + c.feature).padEnd(30)} used ${c.usedQuantity.toLocaleString()} of ${c.includedQuantity.toLocaleString()} ${c.unit} (${pct(c.utilization)})  commit ${$(c.committedCost)} + overage ${$(c.overageCost)} = ${$(c.ratedCost)}  [${c.status}]`,
  );
}

printDim("BY RESOURCE TYPE", attributed.byResourceType);
printDim("BY PROVIDER", attributed.byProvider);
printDim("BY MODEL", attributed.byModel);
printDim("BY FEATURE", attributed.byFeature);
printDim("BY TEAM", attributed.byTeam);
printDim("BY WORKLOAD", attributed.byWorkload);
printDim("BY CUSTOMER", attributed.byCustomer);
printDim("SEAT vs CONSUMPTION", attributed.bySeat);
printDim("BY USER", attributed.byUser, 12);

// Reconciliation: every dimension must sum back to the rated total.
const dims = Object.entries(attributed).filter(([k]) => k.startsWith("by")) as [
  string,
  Record<string, Rollup>,
][];
console.log("\nRECONCILIATION (each dimension vs rated total)");
for (const [name, dim] of dims) {
  const sum = Object.values(dim).reduce((a, r) => a + r.cost, 0);
  const ok = Math.abs(sum - attributed.totalCost) < 0.05;
  console.log(`  ${name.padEnd(16)} ${$(sum).padStart(10)}  ${ok ? "OK" : "MISMATCH vs " + $(attributed.totalCost)}`);
}

// Compact daily series (rated) — eyeball the anomaly.
console.log("\nBY DAY (rated cost)");
const days = Object.keys(attributed.byDay).sort();
const maxCost = Math.max(...days.map((d) => attributed.byDay[d].cost));
for (const day of days) {
  const r = attributed.byDay[day];
  const bar = "#".repeat(Math.round((r.cost / maxCost) * 40));
  console.log(`  ${day}  ${$(r.cost).padStart(9)}  ${bar}`);
}
