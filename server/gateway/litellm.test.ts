import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, it } from "node:test";
import { meterEvents } from "../../src/meter";
import { LITELLM_DEFAULT_MAPPING, LiteLLMGatewayAdapter } from "./litellm";
import { StubGatewayAdapter } from "./stub";
import { applyAttributionMapping } from "./attribution";

const FIXTURES = join(dirname(fileURLToPath(import.meta.url)), "fixtures");
const successCallback = JSON.parse(
  readFileSync(join(FIXTURES, "litellm-success-callback.json"), "utf8"),
) as unknown;
const batchPayload = JSON.parse(readFileSync(join(FIXTURES, "litellm-batch.json"), "utf8")) as unknown;

function adapter(opts?: {
  fetch?: typeof fetch;
  workloadKeys?: Record<string, string>;
}) {
  return new LiteLLMGatewayAdapter({
    baseUrl: "http://litellm.test",
    masterKey: "sk-master",
    workloadKeys: opts?.workloadKeys ?? { "support-agent": "sk-workload-1" },
    fetch: opts?.fetch,
  });
}

describe("LiteLLMGatewayAdapter ingest", () => {
  it("throws on poll input (wrong kind is a harness bug, not empty usage)", async () => {
    await assert.rejects(
      () => adapter().ingestUsageEvents({ kind: "poll", cursor: null }),
      /push adapter/,
    );
  });

  it("normalizes a success-callback spend log into a FOCUS UsageEvent", async () => {
    const result = await adapter().ingestUsageEvents({
      kind: "push",
      payload: successCallback,
      received_at: "2026-07-09T14:05:00.000Z",
    });
    assert.equal(result.dropped.length, 0);
    assert.equal(result.cursor, null);
    assert.equal(result.events.length, 1);
    const e = result.events[0];
    assert.equal(e.workload_id, "support-agent");
    assert.equal(e.team_id, "support");
    assert.equal(e.user_id, "maya");
    assert.equal(e.feature, "draft_reply");
    assert.equal(e.customer_id, "acme-retail");
    assert.equal(e.provider, "anthropic");
    assert.equal(e.model, "claude-opus-4-8");
    assert.equal(e.resource_type, "llm");
    assert.equal(e.pricing_model, "per_token");
    assert.equal(e.unit, "tokens");
    assert.equal(e.quantity, 1600);
    assert.equal(e.cost, 0.0482);
    assert.equal(e.unit_cost, 0.0482 / 1600);
    assert.equal(e.timestamp, "2026-07-09T14:02:14.250Z");
  });

  it("keeps LiteLLM spend as cost — does not re-price tokens", async () => {
    const result = await adapter().ingestUsageEvents({
      kind: "push",
      payload: { ...((successCallback as Record<string, unknown>)), spend: 1.23, total_tokens: 10 },
      received_at: "2026-07-09T14:05:00.000Z",
    });
    assert.equal(result.events[0].cost, 1.23);
  });

  it("drops malformed records instead of inventing spend, and still returns the good ones", async () => {
    const result = await adapter().ingestUsageEvents({
      kind: "push",
      payload: batchPayload,
      received_at: "2026-07-09T14:05:00.000Z",
    });
    assert.equal(result.events.length, 1);
    assert.equal(result.events[0].feature, "triage");
    assert.equal(result.dropped.length, 1);
    assert.match(result.dropped[0].reason, /missing numeric spend/);
  });

  it("lands unmapped attributes in the unattributed bucket so totals still reconcile", async () => {
    const result = await adapter().ingestUsageEvents({
      kind: "push",
      payload: { spend: 0.01, total_tokens: 100, model: "gpt-5-mini" },
      received_at: "2026-07-09T14:05:00.000Z",
    });
    const e = result.events[0];
    assert.equal(e.workload_id, "unattributed");
    assert.equal(e.team_id, "unattributed");
    assert.equal(e.feature, "unattributed");
    assert.equal(e.customer_id, "unattributed");
    assert.equal(e.user_id, null); // autonomous, not a bucket
  });

  it("produces events the engine meter can rate unchanged", async () => {
    const result = await adapter().ingestUsageEvents({
      kind: "push",
      payload: successCallback,
      received_at: "2026-07-09T14:05:00.000Z",
    });
    const metered = meterEvents(result.events, []);
    assert.equal(metered.totals.rawCost, 0.0482);
    assert.equal(metered.totals.ratedCost, 0.0482);
  });
});

describe("LiteLLMGatewayAdapter syncPolicy", () => {
  it("writes max_budget via POST /key/update and returns enforced", async () => {
    const calls: { url: string; init: RequestInit }[] = [];
    const fetchMock: typeof fetch = async (url, init) => {
      calls.push({ url: String(url), init: init ?? {} });
      return new Response(JSON.stringify({ key: "sk-workload-1" }), { status: 200 });
    };
    const result = await adapter({ fetch: fetchMock }).syncPolicy({
      kind: "budget_cap",
      workload_id: "support-agent",
      monthly_usd: 50,
    });
    assert.equal(result.mode, "enforced");
    if (result.mode === "enforced") assert.equal(result.gateway_ref, "sk-workload-1");
    assert.equal(calls.length, 1);
    assert.equal(calls[0].url, "http://litellm.test/key/update");
    assert.equal((calls[0].init.headers as Record<string, string>).Authorization, "Bearer sk-master");
    assert.deepEqual(JSON.parse(String(calls[0].init.body)), {
      key: "sk-workload-1",
      max_budget: 50,
      budget_duration: "30d",
    });
  });

  it("degrades to alert-only when the gateway is unreachable", async () => {
    const fetchMock: typeof fetch = async () => {
      throw new Error("ECONNREFUSED");
    };
    const result = await adapter({ fetch: fetchMock }).syncPolicy({
      kind: "budget_cap",
      workload_id: "support-agent",
      monthly_usd: 50,
    });
    assert.equal(result.mode, "alert-only");
    if (result.mode === "alert-only") {
      assert.equal(result.reason, "gateway_unreachable");
      assert.match(result.detail ?? "", /ECONNREFUSED/);
    }
  });

  it("degrades to alert-only rejected when LiteLLM refuses the write", async () => {
    const fetchMock: typeof fetch = async () =>
      new Response(JSON.stringify({ error: { message: "unauthorized" } }), { status: 403 });
    const result = await adapter({ fetch: fetchMock }).syncPolicy({
      kind: "rate_limit",
      workload_id: "support-agent",
      requests_per_minute: 30,
    });
    assert.equal(result.mode, "alert-only");
    if (result.mode === "alert-only") assert.equal(result.reason, "rejected");
  });

  it("rejects a cap when no virtual key is mapped for the workload", async () => {
    const result = await adapter({ workloadKeys: {} }).syncPolicy({
      kind: "budget_cap",
      workload_id: "support-agent",
      monthly_usd: 50,
    });
    assert.equal(result.mode, "alert-only");
    if (result.mode === "alert-only") {
      assert.equal(result.reason, "rejected");
      assert.match(result.detail ?? "", /no virtual key/);
    }
  });
});

describe("StubGatewayAdapter (poll / alert-only)", () => {
  it("passthrough-polls empty usage and cannot silently no-op a policy write", async () => {
    const stub = new StubGatewayAdapter();
    const ingest = await stub.ingestUsageEvents({ kind: "poll", cursor: "c1" });
    assert.deepEqual(ingest, { events: [], cursor: "c1", dropped: [] });
    await assert.rejects(() => stub.ingestUsageEvents({
      kind: "push",
      payload: {},
      received_at: "2026-07-09T00:00:00.000Z",
    }));
    const policy = await stub.syncPolicy({
      kind: "budget_cap",
      workload_id: "support-agent",
      monthly_usd: 10,
    });
    assert.equal(policy.mode, "alert-only");
    if (policy.mode === "alert-only") assert.equal(policy.reason, "unsupported");
  });
});

describe("applyAttributionMapping", () => {
  it("uses the customer mapping, not adapter-hardcoded aliases", () => {
    const attrs = applyAttributionMapping(
      { wk: "coding-agent", feat: "plan" },
      { fields: { workload_id: "wk", feature: "feat" } },
    );
    assert.equal(attrs.workload_id, "coding-agent");
    assert.equal(attrs.feature, "plan");
    assert.equal(attrs.team_id, "unattributed");
  });

  it("exposes LiteLLM default mapping keys used by the reference adapter", () => {
    assert.equal(LITELLM_DEFAULT_MAPPING.fields.workload_id, "user_api_key_alias");
  });
});
