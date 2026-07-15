// Attribution-mapping application — pure, shared by all gateway adapters so
// none reinvents the fallback semantics. Source attributes arrive as an
// untyped bag (gateway key metadata, span attributes, CSV columns); the
// mapping says which attribute fills which UsageEvent field; anything
// unmapped or missing lands in the explicit unattributed bucket so totals
// always reconcile under partial tagging.

import type { UsageEvent } from "../../src/schema";
import type { AttributionField, AttributionMapping } from "./types";

const DEFAULT_UNATTRIBUTED = "unattributed";

export function applyAttributionMapping(
  source: Record<string, unknown>,
  mapping: AttributionMapping,
): Pick<UsageEvent, AttributionField> {
  const bucket = mapping.unattributed_value ?? DEFAULT_UNATTRIBUTED;
  const lookup = (field: AttributionField): string | undefined => {
    const attr = mapping.fields[field];
    if (attr === undefined) return undefined;
    const raw = source[attr];
    if (raw === undefined || raw === null) return undefined;
    const value = String(raw).trim();
    return value === "" ? undefined : value;
  };
  return {
    workload_id: lookup("workload_id") ?? bucket,
    feature: lookup("feature") ?? bucket,
    team_id: lookup("team_id") ?? bucket,
    customer_id: lookup("customer_id") ?? bucket,
    // user_id: null already means "autonomous run" in the schema — a missing
    // seat is that, not an unattributed bucket entry.
    user_id: lookup("user_id") ?? null,
  };
}
