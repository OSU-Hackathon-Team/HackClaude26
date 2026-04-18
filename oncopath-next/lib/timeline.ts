export interface TimelinePoint {
  month: number;
  risk: number;
}

export const DEFAULT_TIMELINE_MONTHS = 24;

export const TIMELINE_TREATMENT_PRESETS = [
  {
    id: "CHEMOTHERAPY",
    label: "Chemotherapy",
    localDecay: 0.06,
    floorRisk: 0.02,
    variability: 0.012,
  },
  {
    id: "IMMUNOTHERAPY",
    label: "Immunotherapy",
    localDecay: 0.045,
    floorRisk: 0.02,
    variability: 0.01,
  },
  {
    id: "TARGETED_THERAPY",
    label: "Oral Targeted Therapy",
    localDecay: 0.07,
    floorRisk: 0.015,
    variability: 0.008,
  },
  {
    id: "RADIATION",
    label: "Radiation",
    localDecay: 0.035,
    floorRisk: 0.025,
    variability: 0.009,
  },
  {
    id: "OBSERVATION",
    label: "Observation",
    localDecay: 0.015,
    floorRisk: 0.08,
    variability: 0.006,
  },
] as const;

export type TreatmentPresetId = (typeof TIMELINE_TREATMENT_PRESETS)[number]["id"];

const TREATMENT_PRESET_LOOKUP = new Map(
  TIMELINE_TREATMENT_PRESETS.map((preset) => [preset.id, preset])
);

function clampRisk(value: number): number {
  if (!Number.isFinite(value)) {
    return 0;
  }
  return Math.min(Math.max(value, 0), 1);
}

function roundRisk(value: number): number {
  return Math.round(clampRisk(value) * 10000) / 10000;
}

function hashSeed(input: string): number {
  let hash = 2166136261;
  for (let i = 0; i < input.length; i += 1) {
    hash ^= input.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return Math.abs(hash);
}

function deterministicOscillation(seed: number, month: number): number {
  const phaseA = (seed % 360) * (Math.PI / 180);
  const phaseB = ((seed >> 5) % 360) * (Math.PI / 180);
  return Math.sin(month * 0.72 + phaseA) * 0.7 + Math.cos(month * 0.37 + phaseB) * 0.3;
}

export function generateLocalTimelineProjection({
  organKey,
  baselineRisk,
  treatment,
  months = DEFAULT_TIMELINE_MONTHS,
}: {
  organKey: string;
  baselineRisk: number;
  treatment: TreatmentPresetId;
  months?: number;
}): TimelinePoint[] {
  const effectiveMonths = Math.max(1, Math.floor(months));
  const startRisk = clampRisk(baselineRisk);
  const preset = TREATMENT_PRESET_LOOKUP.get(treatment) ?? TIMELINE_TREATMENT_PRESETS[0];
  const seed = hashSeed(`${organKey}:${treatment}:${startRisk.toFixed(4)}`);
  const timeline: TimelinePoint[] = [];

  for (let month = 0; month <= effectiveMonths; month += 1) {
    const decayTrend =
      preset.floorRisk + (startRisk - preset.floorRisk) * Math.exp(-preset.localDecay * month);
    const taper = 1 - month / (effectiveMonths + 1);
    const oscillation = deterministicOscillation(seed, month) * preset.variability * taper;
    const projectedRisk = month === 0 ? startRisk : decayTrend + oscillation;

    timeline.push({
      month,
      risk: roundRisk(projectedRisk),
    });
  }

  return timeline;
}

export function getTimelinePointAtMonth(
  timeline: TimelinePoint[],
  month: number
): TimelinePoint | null {
  if (!timeline.length) {
    return null;
  }

  const clampedMonth = Math.max(0, Math.floor(month));
  const exact = timeline.find((point) => point.month === clampedMonth);
  if (exact) {
    return exact;
  }

  let closest = timeline[0];
  let smallestDistance = Math.abs(closest.month - clampedMonth);
  for (const point of timeline) {
    const distance = Math.abs(point.month - clampedMonth);
    if (distance < smallestDistance) {
      closest = point;
      smallestDistance = distance;
    }
  }

  return closest;
}
