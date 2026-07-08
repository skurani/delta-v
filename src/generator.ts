import type { GeneratorConfig, Step, UsageEvent } from "./schema";

// Deterministic PRNG (mulberry32) so a given config always produces the same
// stream — jittered, but reproducible across runs.
function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// Rough gaussian in [-1.5, 1.5] for organic-looking quantity jitter.
function gauss(rand: () => number): number {
  return rand() + rand() + rand() - 1.5;
}

function clamp(x: number, lo: number, hi: number): number {
  return Math.min(hi, Math.max(lo, x));
}

const round6 = (x: number) => Math.round(x * 1e6) / 1e6;

// Support/agent traffic peaks during business hours but never fully sleeps.
const HOUR_WEIGHTS = [
  1, 1, 1, 1, 1, 2, 4, 7, 10, 13, 14, 14, 13, 13, 14, 13, 12, 10, 8, 6, 4, 3, 2, 1,
];
const HOUR_WEIGHT_TOTAL = HOUR_WEIGHTS.reduce((a, b) => a + b, 0);

function pickHour(rand: () => number): number {
  let roll = rand() * HOUR_WEIGHT_TOTAL;
  for (let h = 0; h < 24; h++) {
    roll -= HOUR_WEIGHTS[h];
    if (roll <= 0) return h;
  }
  return 23;
}

/**
 * Anomaly intensity for a given day/hour, in [0, 1].
 * Deliberately not a clean step function: the incident ramps in over a few
 * hours on its first day, runs at full (jittered) intensity, then decays as a
 * partial tail the day after it "ends" — so the spike reads as a real
 * incident, not a synthetic rectangle.
 */
function anomalyIntensity(config: GeneratorConfig, day: number, hour: number): number {
  const { day: start, durationDays } = config.anomaly;
  if (day < start || day > start + durationDays) return 0;
  if (day === start) {
    // Outage starts mid-morning, full blast by early afternoon.
    if (hour < 9) return 0;
    return clamp((hour - 9) / 5, 0, 1);
  }
  if (day === start + durationDays) {
    // Recovery tail: backlog drains through the morning after.
    return clamp(0.45 - hour * 0.035, 0, 0.45);
  }
  return 1;
}

export function generateEvents(config: GeneratorConfig): UsageEvent[] {
  const rand = mulberry32(config.seed);
  const events: UsageEvent[] = [];

  // 30 days ending "now": start at midnight `days` days ago.
  const end = new Date();
  end.setHours(0, 0, 0, 0);
  const startMs = end.getTime() - config.days * 86_400_000;

  const base = {
    customer_id: config.customer_id,
    team_id: config.team_id,
    workload_id: config.workload_id,
  };

  for (let day = 0; day < config.days; day++) {
    const dayMs = startMs + day * 86_400_000;
    const weekday = new Date(dayMs).getDay();
    const weekendFactor = weekday === 0 || weekday === 6 ? 0.55 : 1;

    // Day-level volume: baseline * weekday shape * jitter * anomaly flood.
    // The anomaly's volume boost is itself jittered so no two anomaly hours
    // scale identically.
    const dayIntensityAvg =
      Array.from({ length: 24 }, (_, h) => anomalyIntensity(config, day, h)).reduce((a, b) => a + b, 0) / 24;
    const floodFactor = 1 + (config.anomaly.volumeMultiplier - 1) * dayIntensityAvg * (0.85 + rand() * 0.3);
    const jitter = 1 + gauss(rand) * config.dailyVariance;
    const workUnits = Math.max(1, Math.round(config.baselineVolumePerDay * weekendFactor * jitter * floodFactor));

    for (let u = 0; u < workUnits; u++) {
      const hour = pickHour(rand);
      const intensity = anomalyIntensity(config, day, hour);
      // During the flood, drop units that would have landed in pre-incident
      // hours of the first day so the extra volume clusters where the
      // incident actually is.
      if (dayIntensityAvg > 0 && intensity === 0 && rand() < (floodFactor - 1) / floodFactor) continue;

      const ts = new Date(dayMs + hour * 3_600_000 + Math.floor(rand() * 3_600_000)).toISOString();

      // The seat that owns this work unit, skewed so a few users dominate
      // (realistic seat economics). Whether a given step actually attaches to
      // the seat depends on that step's seatShare — the rest run autonomous.
      const unitUser = config.users[Math.floor(Math.pow(rand(), 1.7) * config.users.length)] ?? null;

      for (const step of config.steps) {
        const user_id = rand() < (step.seatShare ?? 0) ? unitUser : null;
        events.push(makeStepEvent(config, step, ts, intensity, rand, base, user_id));
      }
    }

    // Fixed resources: committed/flat lines that tick independently of volume.
    for (const fixed of config.fixedResources) {
      if (fixed.cadence === "monthly" && day % 30 !== 0) continue;
      const jittered = fixed.provisioned.quantity * (1 + gauss(rand) * 0.12);
      const q =
        fixed.pricing_model === "flat"
          ? fixed.provisioned.quantity
          : fixed.provisioned.unit === "calls"
            ? Math.max(0, Math.round(jittered))
            : Math.max(0, round6(jittered));
      events.push({
        ...base,
        user_id: null, // committed/flat lines are infrastructure, never seat-attached
        timestamp: new Date(dayMs + 4 * 3_600_000).toISOString(), // nightly rollup hour
        feature: fixed.feature,
        resource_type: fixed.resource_type,
        provider: fixed.provider,
        model: null,
        pricing_model: fixed.pricing_model,
        quantity: q,
        unit: fixed.provisioned.unit,
        unit_cost: fixed.provisioned.unit_cost,
        cost: round6(q * fixed.provisioned.unit_cost),
      });
    }
  }

  events.sort((a, b) => a.timestamp.localeCompare(b.timestamp));
  return events;
}

function makeStepEvent(
  config: GeneratorConfig,
  step: Step,
  ts: string,
  intensity: number,
  rand: () => number,
  base: { customer_id: string; team_id: string; workload_id: string },
  user_id: string | null,
): UsageEvent {
  if (step.routing) {
    // Effective frontier-model share: baseline, pushed toward the override by
    // the anomaly (only on the affected step), with per-event wobble so the
    // routing shift isn't a perfectly clean line.
    let share = step.routing.expensiveShare;
    if (step.feature === config.anomaly.affectedStep && intensity > 0) {
      share += (config.anomaly.expensiveShareOverride - share) * intensity;
      share = clamp(share + gauss(rand) * 0.04, 0, 1);
    }
    const price = rand() < share ? step.routing.expensive : step.routing.cheap;
    const tokens = Math.max(50, Math.round(price.avgTokens * clamp(1 + gauss(rand) * 0.45, 0.25, 3)));
    return {
      ...base,
      user_id,
      timestamp: ts,
      feature: step.feature,
      resource_type: step.resource_type,
      provider: price.provider,
      model: price.model,
      pricing_model: "per_token",
      quantity: tokens,
      unit: "tokens",
      unit_cost: price.unit_cost,
      cost: round6(tokens * price.unit_cost),
    };
  }

  const call = step.call!;
  const quantity =
    call.unit === "calls"
      ? Math.max(1, Math.round(call.avgQuantity + gauss(rand)))
      : Math.max(0.05, round6(call.avgQuantity * clamp(1 + gauss(rand) * 0.4, 0.2, 3)));
  return {
    ...base,
    user_id,
    timestamp: ts,
    feature: step.feature,
    resource_type: step.resource_type,
    provider: call.provider,
    model: null,
    pricing_model: "per_call",
    quantity,
    unit: call.unit,
    unit_cost: call.unit_cost,
    cost: round6(quantity * call.unit_cost),
  };
}
