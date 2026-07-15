// Thin agent server (SPEC.md §4d/§4e + §6). Holds the Anthropic API key —
// the frontend never sees it. Two endpoints:
//
//   POST /api/reason  { summary }                      → one batched analysis (cached)
//   POST /api/chat    { messages, role, as_of_day }    → agent loop with tools
//
// The chat loop: model decides which tools to call → server executes them
// against the real event data (guardrail checks inside the action tools) →
// model narrates. History is client-held (stateless server); the client
// echoes the full message array back each turn, thinking blocks included.
//
// USE_MOCK_LLM=true swaps the model for a scripted mock with the identical
// response shape — the loop, tools, guardrail, and UI run unchanged.
//
//   npm run reason        (ANTHROPIC_API_KEY in .env / exported / ant profile,
//                          or USE_MOCK_LLM=true for the free deterministic path)

import Anthropic from "@anthropic-ai/sdk";
import { createHash } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import http from "node:http";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { createChatModel, MODEL_ID, mockAnalysis, USE_MOCK, type AgentBlock } from "./llm";
import type { Role } from "./policy";
import { createToolExecutor, TOOL_DEFS, type ToolEvent } from "./tools";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const CACHE_FILE = join(ROOT, "data", "reasoning-cache.json");
const CHAT_CACHE_FILE = join(ROOT, "data", "chat-cache.json");
const DATA_FILE = join(ROOT, "data", "usage-events.json");
const PORT = 8787;
const MAX_TOOL_ITERATIONS = 8;

// Minimal .env loader (no dependency): only fills vars not already set.
const envFile = join(ROOT, ".env");
if (existsSync(envFile)) {
  for (const line of readFileSync(envFile, "utf8").split("\n")) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*?)\s*$/);
    if (m && !(m[1] in process.env)) process.env[m[1]] = m[2].replace(/^["']|["']$/g, "");
  }
}

const chatModel = createChatModel();
const tools = createToolExecutor(DATA_FILE);

const CHAT_SYSTEM_PROMPT = `You are AI Spend Governor, a FinOps agent that observes a workload's metered spend. You answer through TOOLS that compute from the real event data.

Non-negotiable rules:
- Math for the meter, LLM for the judgment: NEVER compute, estimate, or extrapolate a figure yourself — not even arithmetic on numbers you already have. If a figure is needed, call the tool that provides it (get_routing_economics exists precisely so savings estimates are computed, not guessed). Quote tool numbers exactly.
- Default posture is RECOMMEND. Call action tools (cap_budget, throttle_workload) only when the user explicitly asks to act.
- Every action is checked by a deterministic guardrail before executing. When a verdict comes back "hold", that is a correct, successful outcome — report it plainly using the policy numbers in the result (role, estimated impact, authority limit), and do not apologize for it or try to work around it.
- Anomalies flagged visible_at_invoice_level: false deserve the point: the blended invoice would have missed this — per-slice metering is why it was caught.
- Roles display as "FinOps" (wire value: member) and "Eng" (wire value: admin). When narrating guardrail results, ALWAYS use the display names FinOps and Eng, never member/admin.
- SCOPE: you only answer questions about this workload's metered spend. For anything else, decline in one sentence and offer what you can do — e.g. spend overview, the anomaly, routing savings, commitment status, the cost heatmap, or budget actions. Never answer general-knowledge questions.
- Be direct and concrete. Cite the window day range when relevant. No filler.`;

// Any change to the system prompt or tool definitions must invalidate cached
// chat replies — they change what the model would say for the same messages.
const CHAT_CONFIG_HASH = createHash("sha256")
  .update(CHAT_SYSTEM_PROMPT + JSON.stringify(TOOL_DEFS))
  .digest("hex");

// ---------------------------------------------------------------------------
// /api/reason — one batched analysis per window (unchanged behavior + mock)
// ---------------------------------------------------------------------------

const ANALYSIS_SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: ["finding", "explanation", "recommendations"],
  properties: {
    finding: { type: "string", description: "One-sentence headline of the most important cost issue" },
    explanation: { type: "string", description: "Why, grounded in the specific numbers provided" },
    recommendations: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        required: ["title", "action", "rationale", "estimated_monthly_savings_usd", "pricing_model", "priority"],
        properties: {
          title: { type: "string" },
          action: { type: "string" },
          rationale: { type: "string", description: "Show the arithmetic from the provided figures" },
          estimated_monthly_savings_usd: { type: "number", description: "Derived only from summary figures; 0 if not quantifiable" },
          pricing_model: { type: "string", enum: ["per_token", "per_call", "committed", "flat"] },
          priority: { type: "integer", description: "1 = highest" },
        },
      },
    },
  },
} as const;

const REASON_SYSTEM_PROMPT = `You are the reasoning engine of AI Spend Governor, a FinOps agent. You receive one compact JSON summary of a workload's metered spend window.

Rules:
- Ground every claim in the numbers provided. Never invent figures. Every estimated saving must be derivable from the summary — show the arithmetic in the rationale. If a saving cannot be computed from the data given, set estimated_monthly_savings_usd to 0 and say so.
- Match each recommendation to its pricing-model lever: per_token → routing/caching; per_call → batching/caching; committed → right-size; flat → informational.
- An anomaly marked visible_at_invoice_level: false means the blended invoice would NOT have flagged it — state that.
- Be direct and concrete.`;

interface CacheEntry {
  created_at: string;
  model: string;
  analysis: unknown;
}

function loadChatCache(): Record<string, Awaited<ReturnType<typeof runAgentLoop>>> {
  try {
    return JSON.parse(readFileSync(CHAT_CACHE_FILE, "utf8"));
  } catch {
    return {};
  }
}

function saveChatCache(cache: Record<string, unknown>) {
  mkdirSync(dirname(CHAT_CACHE_FILE), { recursive: true });
  writeFileSync(CHAT_CACHE_FILE, JSON.stringify(cache, null, 1));
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

async function analyzeWindow(summary: unknown): Promise<{ cached: boolean; entry: CacheEntry }> {
  if (USE_MOCK) {
    return {
      cached: false,
      entry: { created_at: new Date().toISOString(), model: "mock", analysis: mockAnalysis(summary) },
    };
  }
  const key = createHash("sha256").update(MODEL_ID + REASON_SYSTEM_PROMPT + JSON.stringify(summary)).digest("hex");
  const cache = loadCache();
  if (cache[key]) return { cached: true, entry: cache[key] };

  const client = new Anthropic();
  const response = await client.messages.create({
    model: MODEL_ID,
    max_tokens: 16000,
    thinking: { type: "adaptive" },
    system: REASON_SYSTEM_PROMPT,
    output_config: { format: { type: "json_schema", schema: ANALYSIS_SCHEMA } },
    messages: [{ role: "user", content: `Analyze this cost window:\n${JSON.stringify(summary, null, 1)}` }],
  });
  const text = response.content.find((b) => b.type === "text");
  if (!text || text.type !== "text") throw new Error(`no text block (stop: ${response.stop_reason})`);
  const entry: CacheEntry = {
    created_at: new Date().toISOString(),
    model: MODEL_ID,
    analysis: JSON.parse(text.text),
  };
  cache[key] = entry;
  saveCache(cache);
  return { cached: false, entry };
}

// ---------------------------------------------------------------------------
// /api/chat — the agent loop
// ---------------------------------------------------------------------------

interface ChatRequest {
  messages: unknown[]; // full API-shaped history, echoed opaquely by the client
  role?: Role;
  as_of_day?: string;
}

async function runAgentLoop(req: ChatRequest) {
  const role: Role = req.role === "admin" ? "admin" : "member";
  const ctx = { role, asOfDay: req.as_of_day };
  const messages = [...req.messages];
  const toolEvents: ToolEvent[] = [];

  for (let i = 0; i < MAX_TOOL_ITERATIONS; i++) {
    const turn = await chatModel.chat(CHAT_SYSTEM_PROMPT, messages);
    // Append the assistant content verbatim (thinking blocks must replay
    // unchanged on the same model).
    messages.push({ role: "assistant", content: turn.content });

    const toolUses = turn.content.filter((b) => b.type === "tool_use");
    if (turn.stop_reason !== "tool_use" || toolUses.length === 0) {
      const reply = turn.content
        .filter((b): b is AgentBlock & { text: string } => b.type === "text")
        .map((b) => b.text)
        .join("\n");
      // Safety net: a turn with no usable text (e.g. end_turn with only
      // thinking blocks, or a refusal) must never reach the UI as an empty
      // bubble — degrade to a deterministic "here's what I can do" message.
      return {
        reply:
          reply.trim().length > 0
            ? reply
            : "I couldn't produce an answer for that. I can help with this workload's spend — try: " +
              '"How\'s my spend looking?", "Why did my LLM spend spike?", "What would fixing it save?", ' +
              '"Show me the cost heatmap", or a budget action like "Cap the draft_reply budget".',
        toolEvents,
        messages,
        role,
      };
    }

    // Execute every requested tool; ALL results go back in ONE user message.
    const results = toolUses.map((block) => {
      const input = (block.input ?? {}) as Record<string, unknown>;
      let result: unknown;
      try {
        result = tools.execute(String(block.name), input, ctx);
      } catch (err) {
        result = { error: String(err) };
      }
      toolEvents.push({ tool: String(block.name), input, result });
      return { type: "tool_result", tool_use_id: block.id, content: JSON.stringify(result) };
    });
    messages.push({ role: "user", content: results });
  }

  return {
    reply: "I hit the per-turn tool budget before finishing — ask a narrower question.",
    toolEvents,
    messages,
    role,
  };
}

// ---------------------------------------------------------------------------

const server = http.createServer(async (req, res) => {
  res.setHeader("content-type", "application/json");
  const chunks: Buffer[] = [];
  for await (const chunk of req) chunks.push(chunk);

  try {
    if (req.method === "POST" && req.url === "/api/reason") {
      const { summary } = JSON.parse(Buffer.concat(chunks).toString("utf8"));
      if (!summary) throw new Error("body must be { summary: WindowSummary }");
      const { cached, entry } = await analyzeWindow(summary);
      res.writeHead(200).end(
        JSON.stringify({ cached, model: entry.model, created_at: entry.created_at, analysis: entry.analysis }),
      );
      return;
    }
    if (req.method === "POST" && req.url === "/api/chat") {
      const body = JSON.parse(Buffer.concat(chunks).toString("utf8")) as ChatRequest;
      if (!Array.isArray(body.messages)) throw new Error("body must be { messages: [...], role?, as_of_day? }");
      // Response cache (real mode only; the mock is already free and
      // deterministic): an identical conversation state — same model, role,
      // as-of day, and full message history — replays without an API call,
      // so scripted re-demos are free and instant. The chip-driven golden
      // path chains identically turn over turn, so every beat hits.
      const cacheKey = USE_MOCK
        ? null
        : createHash("sha256")
            .update(JSON.stringify([MODEL_ID, CHAT_CONFIG_HASH, body.role ?? "member", body.as_of_day ?? "", body.messages]))
            .digest("hex");
      if (cacheKey) {
        const cache = loadChatCache();
        if (cache[cacheKey]) {
          res.writeHead(200).end(JSON.stringify({ ...cache[cacheKey], cached: true }));
          return;
        }
      }
      const result = await runAgentLoop(body);
      if (cacheKey) {
        const cache = loadChatCache();
        cache[cacheKey] = result;
        saveChatCache(cache);
      }
      res.writeHead(200).end(JSON.stringify(result));
      return;
    }
    res.writeHead(404).end(JSON.stringify({ error: "POST /api/reason or /api/chat" }));
  } catch (err) {
    const status =
      err instanceof Anthropic.AuthenticationError ? 401 :
      err instanceof Anthropic.RateLimitError ? 429 :
      err instanceof Anthropic.APIError ? 502 : 400;
    res.writeHead(status).end(JSON.stringify({ error: String(err) }));
  }
});

server.listen(PORT, () => {
  console.log(`AI Spend Governor server on http://localhost:${PORT}`);
  console.log(`mode: ${USE_MOCK ? "MOCK (USE_MOCK_LLM=true — scripted, free)" : `real (${MODEL_ID})`}`);
  console.log(`endpoints: POST /api/reason, POST /api/chat`);
});
