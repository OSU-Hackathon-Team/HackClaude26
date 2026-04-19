/**
 * lib/api.ts
 * Bridge to the FastAPI Backend.
 */

import type { TimelinePoint } from "@/lib/timeline";

export const API_URL = "http://127.0.0.1:8000";

export interface PatientProfile {
  name: string;
  age: number;
  sex: string;
  primary_site: string;
  oncotree_code: string;
  mutations: { [key: string]: number };
}

export type RiskScores = Record<string, number>;

export type PredictionSource = "/predict" | "/simulate" | "/simulate/temporal" | "/predict/timeline";

export interface PredictionSnapshot {
  source: PredictionSource;
  risk_scores: RiskScores;
  prediction_id?: string;
  status?: string;
  confidence_metrics?: Record<string, number>;
  shap_values?: Record<string, number>;
}

export interface SimulationResult {
  simulated_risks: { [key: string]: number };
  visual_lift: number;
  has_visual_data: boolean;
}

export interface TemporalSimulationPoint {
  month: number;
  risks: { [key: string]: number };
  max_risk: number;
  mean_risk: number;
}

export type TemporalMode = "untreated" | "treatment_adjusted";
export type TreatmentType = "CHEMOTHERAPY" | "IMMUNOTHERAPY" | "ORAL_DRUG";

export interface TemporalSimulationResult {
  mode: TemporalMode;
  treatment: TreatmentType | null;
  months: number;
  baseline_risks: { [key: string]: number };
  timeline: TemporalSimulationPoint[];
  visual_lift: number;
  has_visual_data: boolean;
}

export interface SystemicSimulationResult {
  status: string;
  trajectories: Record<string, TimelinePoint[]>;
  summary: string;
  treatment?: string;
  prediction_id?: string;
  confidence_metrics?: Record<string, number>;
  shap_values?: Record<string, number>;
}

export interface PredictionRequestOptions {
  image?: string;
  preferPredict?: boolean;
}

export interface TemporalSimulationParams {
  mode: TemporalMode;
  months: number;
  treatment?: TreatmentType;
  image?: string;
}

const FALLBACK_STATUSES = new Set([404, 405, 501]);

const ORGAN_KEY_ALIASES: Record<string, string> = {
  adrenal: "DMETS_DX_ADRENAL_GLAND",
  adrenal_gland: "DMETS_DX_ADRENAL_GLAND",
  biliary_tract: "DMETS_DX_BILIARY_TRACT",
  bladder: "DMETS_DX_BLADDER_UT",
  bladder_ut: "DMETS_DX_BLADDER_UT",
  bone: "DMETS_DX_BONE",
  bowel: "DMETS_DX_BOWEL",
  brain: "DMETS_DX_CNS_BRAIN",
  breast: "DMETS_DX_BREAST",
  cns_brain: "DMETS_DX_CNS_BRAIN",
  dist_ln: "DMETS_DX_DIST_LN",
  distant_ln: "DMETS_DX_DIST_LN",
  female_genital: "DMETS_DX_FEMALE_GENITAL",
  head_neck: "DMETS_DX_HEAD_NECK",
  intra_abdominal: "DMETS_DX_INTRA_ABDOMINAL",
  kidney: "DMETS_DX_KIDNEY",
  liver: "DMETS_DX_LIVER",
  lung: "DMETS_DX_LUNG",
  male_genital: "DMETS_DX_MALE_GENITAL",
  mediastinum: "DMETS_DX_MEDIASTINUM",
  ovary: "DMETS_DX_OVARY",
  pleura: "DMETS_DX_PLEURA",
  pns: "DMETS_DX_PNS",
  skin: "DMETS_DX_SKIN",
  unspecified: "DMETS_DX_UNSPECIFIED",
};

function objectFromUnknown(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return null;
  }
  return value as Record<string, unknown>;
}

function parseNumericMap(value: unknown): Record<string, number> | undefined {
  const obj = objectFromUnknown(value);
  if (!obj) return undefined;
  const out: Record<string, number> = {};
  for (const [key, rawValue] of Object.entries(obj)) {
    const parsed = typeof rawValue === "number" ? rawValue : Number(rawValue);
    if (Number.isFinite(parsed)) out[key] = parsed;
  }
  return Object.keys(out).length ? out : undefined;
}

export function normalizeOrganKey(rawKey: string): string {
  if (rawKey.startsWith("DMETS_DX_") || rawKey.startsWith("SYS_") || rawKey.startsWith("PRIMARY_")) {
    return rawKey;
  }
  const normalized = rawKey.trim().toLowerCase().replace(/[^a-z0-9]+/g, "_");
  return ORGAN_KEY_ALIASES[normalized] ?? rawKey;
}

function normalizeRiskScores(value: unknown): RiskScores | null {
  const obj = objectFromUnknown(value);
  if (!obj) return null;
  const normalized: RiskScores = {};
  for (const [rawKey, rawValue] of Object.entries(obj)) {
    const parsed = typeof rawValue === "number" ? rawValue : Number(rawValue);
    if (!Number.isFinite(parsed)) continue;
    normalized[normalizeOrganKey(rawKey)] = parsed;
  }
  return Object.keys(normalized).length ? normalized : null;
}

export function normalizeSystemicTimelineResponse(value: unknown): SystemicSimulationResult | null {
  const obj = objectFromUnknown(value);
  if (!obj) return null;
  const rawTrajectories = objectFromUnknown(obj.trajectories);
  if (!rawTrajectories) return null;
  const trajectories: Record<string, TimelinePoint[]> = {};
  for (const [site, rawPoints] of Object.entries(rawTrajectories)) {
    if (!Array.isArray(rawPoints)) continue;
    const points: TimelinePoint[] = [];
    for (const item of rawPoints) {
      const p = objectFromUnknown(item);
      if (!p) continue;
      const month = Number(p.month);
      const risk = Number(p.risk);
      if (Number.isFinite(month) && Number.isFinite(risk)) points.push({ month, risk });
    }
    trajectories[site] = points;
  }
  return {
    status: String(obj.status || "unknown"),
    trajectories,
    summary: String(obj.summary || "Biological simulation complete."),
    treatment: String(obj.treatment || ""),
    prediction_id: String(obj.prediction_id || ""),
    confidence_metrics: parseNumericMap(obj.confidence_metrics),
    shap_values: parseNumericMap(obj.shap_values)
  };
}

async function postJson(endpoint: string, body: unknown): Promise<Response> {
  return fetch(`${API_URL}${endpoint}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

export async function simulateRisk(profile: PatientProfile, image?: string): Promise<SimulationResult> {
  const response = await postJson("/simulate", { profile, image });
  if (!response.ok) throw new Error(`API Error: ${response.statusText}`);
  return response.json();
}

export async function simulateTemporalRisk(
  profile: PatientProfile,
  params: TemporalSimulationParams
): Promise<TemporalSimulationResult> {
  const response = await postJson("/simulate/temporal", {
    profile,
    image: params.image,
    months: params.months,
    mode: params.mode,
    treatment: params.mode === "treatment_adjusted" ? params.treatment : null,
  });
  if (!response.ok) throw new Error(`API Error: ${response.statusText}`);
  return response.json();
}

export async function requestPredictTimeline(
  profile: PatientProfile,
  risksSnapshot: Record<string, number>,
  treatment: string,
  months: number,
  organ?: string,
  signal?: AbortSignal
): Promise<SystemicSimulationResult> {
  const response = await fetch(`${API_URL}/predict/timeline`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      profile,
      risks: risksSnapshot,
      treatment,
      months: Math.max(1, Math.floor(months)),
      organ,
    }),
    signal,
  });

  if (!response.ok) throw new Error(`API Error: ${response.statusText}`);
  const data = await response.json();
  const normalized = normalizeSystemicTimelineResponse(data);
  if (!normalized) throw new Error("Schema mismatch from /predict/timeline");
  return normalized;
}
