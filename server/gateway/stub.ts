// Reference stub adapter — no gateway, no I/O. Exists so the GatewayAdapter
// seam compiles and its shape is exercised end-to-end: poll-shaped ingestion
// (cursor passthrough), the wrong-kind guard, and the compiler-enforced
// alert-only policy result an ingestion-only adapter must return.

import type {
  AttributionMapping,
  GatewayAdapter,
  GatewayAdapterInfo,
  IngestionInput,
  IngestionResult,
  PolicySpec,
  PolicySyncResult,
} from "./types";

export class StubGatewayAdapter implements GatewayAdapter {
  readonly info = {
    id: "stub",
    display_name: "Stub (reference, no gateway)",
    ingestion: "poll",
    enforcement: "alert-only",
  } as const satisfies GatewayAdapterInfo;

  // Real adapters take connection config here too; the stub only carries the
  // mapping to exercise the constructor shape.
  constructor(private mapping: AttributionMapping = { fields: {} }) {}

  async ingestUsageEvents(input: IngestionInput): Promise<IngestionResult> {
    if (input.kind !== "poll") throw new Error("stub is a poll adapter; got a push input");
    return { events: [], cursor: input.cursor, dropped: [] };
  }

  async syncPolicy(policy: PolicySpec): Promise<PolicySyncResult> {
    return { mode: "alert-only", reason: "unsupported", detail: `stub cannot enforce ${policy.kind}` };
  }
}
