// Thin reasoning server (SPEC.md §4d + §6). Holds the Anthropic API key —
// the frontend never sees it. ONE batched call per analysis window:
//   POST /api/reason  { summary: WindowSummary }  →  { cached, analysis }
//
// Responses are cached on disk keyed by a hash of (model + summary), so
// re-demoing the same window never re-calls the API. Prompt caching
// (cache_control) is deliberately NOT used here: the prompt is far below
// Opus 4.8's 4096-token cacheable minimum, and the file cache already
// eliminates repeat calls entirely.
//
//   npm run reason        (needs ANTHROPIC_API_KEY in .env, exported, or an
//                          `ant auth login` profile — the SDK resolves all three)

import Anthropic from "@anthropic-ai/sdk";
import { createHash } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import http from "node:http";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const CACHE_FILE = join(ROOT, "data", "reasoning-cache.json");
const PORT = 8787;
const MODEL = "claude-opus-4-8";

// Minimal .env loader (no dependency): only fills vars not already set, so
// an exported key or an `ant auth login` profile still wins.
const envFile = join(ROOT, ".env");
if (existsSync(envFile)) {
  for (const line of readFileSync(envFile, "utf8").split("\n")) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*?)\s*$/);
    if (m && !(m[1] in process.env)) process.env[m[1]] = m[2].replace(/^["']|["']$/g, "");
  }
}

const client = new Anthropic(); // resolves ANTHROPIC_API_KEY / auth profile

// Structured output schema (SPEC §4d: finding + explanation + ranked
// recommendations + estimated impact). additionalProperties:false is
// required on every object by the structured-outputs contract.
const ANALYSIS_SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: ["finding", "explanation", "recommendations"],
  properties: {
    finding: {
      type: "string",
      description: "One-sentence headline of the most important cost issue in this window",
    },
    explanation: {
      type: "string",
      description: "Why this happened, grounded in the specific numbers provided",
    },
    recommendations: {
      type: "array",
      description: "Ranked, most impactful first",
      items: {
        type: "object",
        additionalProperties: false,
        required: [
          "title",
          "action",
          "rationale",
          "estimated_monthly_savings_usd",
          "pricing_model",
          "priority",
        ],
        properties: {
          title: { type: "string" },
          action: { type: "string", description: "The concrete change to make" },
          rationale: {
            type: "string",
            description: "Why, showing the arithmetic from the provided figures",
          },
          estimated_monthly_savings_usd: {
            type: "number",
            description: "Derived only from figures in the summary; 0 if not quantifiable",
          },
          pricing_model: {
            type: "string",
            enum: ["per_token", "per_call", "committed", "flat"],
            description: "Which pricing lever this recommendation pulls",
          },
          priority: { type: "integer", description: "1 = highest" },
        },
      },
    },
  },
} as const;

// Frozen system prompt — the volatile window summary goes in the user turn.
const SYSTEM_PROMPT = `You are the reasoning engine of AI Spend Governor, a FinOps agent. You receive one compact JSON summary of a workload's metered spend window: totals, attribution slices, commitment utilization, a budget forecast, and any detected anomalies (already classified as cost-mix vs volume, with per-slice threshold math).

Your job: identify the single most important finding, explain it plainly, and produce ranked recommendations.

Rules:
- Ground every claim in the numbers provided. Never invent figures. Every estimated saving must be derivable from the summary — show the arithmetic in the rationale. If a saving cannot be computed from the data given, set estimated_monthly_savings_usd to 0 and say so.
- Match each recommendation to its pricing-model lever: per_token → model routing/caching; per_call → batching/caching; committed → right-size the commitment (underutilized = overpaying, projected overage = renegotiate); flat → informational.
- An anomaly marked visible_at_invoice_level: false means the blended invoice total would NOT have flagged it — worth stating, it is the reason per-slice metering exists.
- Be direct and concrete. No hedging, no filler.`;

interface CacheEntry {
  created_at: string;
  model: string;
  analysis: unknown;
}

function loadCache(): Record<string, CacheEntry> {
  try {
    return JSON.parse(readFileSync(CACHE_FILE, "utf8"));
  } catch {
    return {};
  }
}

function saveCache(cache: Record<string, CacheEntry>) {
  mkdirSync(dirname(CACHE_FILE), { recursive: true });
  writeFileSync(CACHE_FILE, JSON.stringify(cache, null, 1));
}

async function analyze(summary: unknown): Promise<{ cached: boolean; entry: CacheEntry }> {
  const key = createHash("sha256").update(MODEL + JSON.stringify(summary)).digest("hex");
  const cache = loadCache();
  if (cache[key]) return { cached: true, entry: cache[key] };

  const response = await client.messages.create({
    model: MODEL,
    max_tokens: 16000,
    thinking: { type: "adaptive" },
    system: SYSTEM_PROMPT,
    output_config: { format: { type: "json_schema", schema: ANALYSIS_SCHEMA } },
    messages: [
      {
        role: "user",
        content: `Analyze this cost window:\n${JSON.stringify(summary, null, 1)}`,
      },
    ],
  });

  const text = response.content.find((b) => b.type === "text");
  if (!text || text.type !== "text") throw new Error(`no text block (stop: ${response.stop_reason})`);

  const entry: CacheEntry = {
    created_at: new Date().toISOString(),
    model: MODEL,
    analysis: JSON.parse(text.text),
  };
  cache[key] = entry;
  saveCache(cache);
  return { cached: false, entry };
}

const server = http.createServer(async (req, res) => {
  res.setHeader("content-type", "application/json");
  if (req.method !== "POST" || req.url !== "/api/reason") {
    res.writeHead(404).end(JSON.stringify({ error: "POST /api/reason" }));
    return;
  }
  const chunks: Buffer[] = [];
  for await (const chunk of req) chunks.push(chunk);
  try {
    const { summary } = JSON.parse(Buffer.concat(chunks).toString("utf8"));
    if (!summary) throw new Error("body must be { summary: WindowSummary }");
    const { cached, entry } = await analyze(summary);
    res.writeHead(200).end(
      JSON.stringify({ cached, model: entry.model, created_at: entry.created_at, analysis: entry.analysis }),
    );
  } catch (err) {
    const status =
      err instanceof Anthropic.AuthenticationError ? 401 :
      err instanceof Anthropic.RateLimitError ? 429 :
      err instanceof Anthropic.APIError ? 502 : 400;
    res.writeHead(status).end(JSON.stringify({ error: String(err) }));
  }
});

server.listen(PORT, () => {
  console.log(`AI Spend Governor reasoning server on http://localhost:${PORT}`);
  console.log(`model: ${MODEL} · cache: ${CACHE_FILE}`);
});
