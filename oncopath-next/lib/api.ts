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

type RiskScores = Record<string, number>;

export type PredictionSource = "/predict" | "/simulate";

export interface PredictionSnapshot {
  source: PredictionSource;
  risk_scores: RiskScores;
  prediction_id?: string;
  status?: string;
  confidence_metrics?: Record<string, number>;
  shap_values?: Record<string, number>;
}

interface SimulateRequestPayload {
  profile: PatientProfile;
  image?: string;
}

interface PredictRequestPayload {
  age_at_sequencing: number;
  sex: string;
  primary_site: string;
  oncotree_code: string;
  genomic_markers: Record<string, number>;
}

interface PredictTimelineRequestPayload {
  profile: PatientProfile;
  baseline_risk: number;
  treatment: string;
  months: number;
  organ?: string;
}

export interface PredictionRequestOptions {
  image?: string;
  preferPredict?: boolean;
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
  if (!obj) {
    return undefined;
  }

  const out: Record<string, number> = {};
  for (const [key, rawValue] of Object.entries(obj)) {
    const parsed = typeof rawValue === "number" ? rawValue : Number(rawValue);
    if (Number.isFinite(parsed)) {
      out[key] = parsed;
    }
  }

  return Object.keys(out).length ? out : undefined;
}

export function normalizeOrganKey(rawKey: string): string {
  if (rawKey.startsWith("DMETS_DX_") || rawKey.startsWith("SYS_")) {
    return rawKey;
  }

  const normalized = rawKey.trim().toLowerCase().replace(/[^a-z0-9]+/g, "_");
  return ORGAN_KEY_ALIASES[normalized] ?? rawKey;
}

function normalizeRiskScores(value: unknown): RiskScores | null {
  const obj = objectFromUnknown(value);
  if (!obj) {
    return null;
  }

  const normalized: RiskScores = {};
  for (const [rawKey, rawValue] of Object.entries(obj)) {
    const parsed = typeof rawValue === "number" ? rawValue : Number(rawValue);
    if (!Number.isFinite(parsed)) {
      continue;
    }
    normalized[normalizeOrganKey(rawKey)] = parsed;
  }

  return Object.keys(normalized).length ? normalized : null;
}

function normalizeTimelineResponse(value: unknown): TimelinePoint[] | null {
  const obj = objectFromUnknown(value);
  if (!obj) {
    return null;
  }

  const rawTimeline = Array.isArray(obj.timeline) ? obj.timeline : null;
  if (!rawTimeline) {
    return null;
  }

  const timeline: TimelinePoint[] = [];
  for (const item of rawTimeline) {
    const point = objectFromUnknown(item);
    if (!point) {
      continue;
    }

    const rawMonth = point.month;
    const rawRisk = point.risk;
    const parsedMonth = typeof rawMonth === "number" ? rawMonth : Number(rawMonth);
    const parsedRisk = typeof rawRisk === "number" ? rawRisk : Number(rawRisk);
    if (!Number.isFinite(parsedMonth) || !Number.isFinite(parsedRisk)) {
      continue;
    }

    timeline.push({
      month: Math.max(0, Math.round(parsedMonth)),
      risk: Math.min(Math.max(parsedRisk, 0), 1),
    });
  }

  if (!timeline.length) {
    return null;
  }

  return timeline.sort((a, b) => a.month - b.month);
}

function normalizePredictResponse(value: unknown): PredictionSnapshot | null {
  const obj = objectFromUnknown(value);
  if (!obj) {
    return null;
  }

  const risk_scores = normalizeRiskScores(obj.risk_scores);
  if (!risk_scores) {
    return null;
  }

  return {
    source: "/predict",
    risk_scores,
    prediction_id: typeof obj.prediction_id === "string" ? obj.prediction_id : undefined,
    status: typeof obj.status === "string" ? obj.status : undefined,
    confidence_metrics: parseNumericMap(obj.confidence_metrics),
    shap_values: parseNumericMap(obj.shap_values),
  };
}

function normalizeSimulationResponse(value: unknown): PredictionSnapshot {
  const obj = objectFromUnknown(value);
  if (!obj) {
    throw new Error("Schema mismatch from /simulate: expected response object");
  }

  const risk_scores = normalizeRiskScores(obj.simulated_risks);
  if (!risk_scores) {
    throw new Error("Schema mismatch from /simulate: missing simulated_risks map");
  }

  return {
    source: "/simulate",
    risk_scores,
  };
}

function toSimulatePayload(profile: PatientProfile, image?: string): SimulateRequestPayload {
  return image ? { profile, image } : { profile };
}

function toPredictPayload(profile: PatientProfile): PredictRequestPayload {
  return {
    age_at_sequencing: profile.age,
    sex: profile.sex,
    primary_site: profile.primary_site,
    oncotree_code: profile.oncotree_code,
    genomic_markers: profile.mutations,
  };
}

function isPredictPreferred(preferPredict?: boolean): boolean {
  if (typeof preferPredict === "boolean") {
    return preferPredict;
  }

  const envFlag =
    process.env.NEXT_PUBLIC_ENABLE_PREDICT_ENDPOINT ??
    process.env.NEXT_PUBLIC_PREDICT_FIRST ??
    process.env.NEXT_PUBLIC_PREDICT_ENABLED;

  if (!envFlag) {
    return false;
  }

  return ["1", "true", "yes", "on"].includes(envFlag.toLowerCase());
}

async function postJson(endpoint: PredictionSource, body: unknown): Promise<Response> {
  return fetch(`${API_URL}${endpoint}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });
}

function buildApiError(endpoint: PredictionSource, response: Response): Error {
  return new Error(`API Error (${endpoint}): ${response.status} ${response.statusText || "Unknown error"}`);
}

async function requestSimulation(profile: PatientProfile, image?: string): Promise<PredictionSnapshot> {
  const response = await postJson("/simulate", toSimulatePayload(profile, image));
  if (!response.ok) {
    throw buildApiError("/simulate", response);
  }

  const data: unknown = await response.json();
  return normalizeSimulationResponse(data);
}

export async function simulateRisk(
  profile: PatientProfile,
  options: PredictionRequestOptions = {}
): Promise<PredictionSnapshot> {
  if (!isPredictPreferred(options.preferPredict)) {
    return requestSimulation(profile, options.image);
  }

  const predictResponse = await postJson("/predict", toPredictPayload(profile));
  if (!predictResponse.ok) {
    if (FALLBACK_STATUSES.has(predictResponse.status)) {
      return requestSimulation(profile, options.image);
    }
    throw buildApiError("/predict", predictResponse);
  }

  const predictData: unknown = await predictResponse.json();
  const normalizedPrediction = normalizePredictResponse(predictData);
  if (normalizedPrediction) {
    return normalizedPrediction;
  }

  return requestSimulation(profile, options.image);
}

export async function requestPredictTimeline(
  profile: PatientProfile,
  baselineRisk: number,
  treatment: string,
  months: number,
  organ?: string,
  signal?: AbortSignal
): Promise<TimelinePoint[]> {
  const payload: PredictTimelineRequestPayload = {
    profile,
    baseline_risk: Math.min(Math.max(baselineRisk, 0), 1),
    treatment,
    months: Math.max(1, Math.floor(months)),
    organ,
  };

  const response = await fetch(`${API_URL}/predict/timeline`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
    signal,
  });

  if (!response.ok) {
    throw new Error(
      `API Error (/predict/timeline): ${response.status} ${response.statusText || "Unknown error"}`
    );
  }

  const data: unknown = await response.json();
  const normalizedTimeline = normalizeTimelineResponse(data);
  if (!normalizedTimeline) {
    throw new Error("Schema mismatch from /predict/timeline: missing timeline array");
  }

  return normalizedTimeline;
}
