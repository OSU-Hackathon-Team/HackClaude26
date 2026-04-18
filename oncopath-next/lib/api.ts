/**
 * lib/api.ts
 * Bridge to the FastAPI Backend.
 */

export const API_URL = "http://127.0.0.1:8000";

export interface PatientProfile {
  age: number;
  sex: string;
  primary_site: string;
  oncotree_code: string;
  mutations: { [key: string]: number };
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

export async function simulateRisk(profile: PatientProfile, image?: string): Promise<SimulationResult> {
  const response = await fetch(`${API_URL}/simulate`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ profile, image }),
  });

  if (!response.ok) {
    throw new Error(`API Error: ${response.statusText}`);
  }

  return response.json();
}

interface TemporalSimulationParams {
  mode: TemporalMode;
  months: number;
  treatment?: TreatmentType;
  image?: string;
}

export async function simulateTemporalRisk(
  profile: PatientProfile,
  params: TemporalSimulationParams
): Promise<TemporalSimulationResult> {
  const response = await fetch(`${API_URL}/simulate/temporal`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      profile,
      image: params.image,
      months: params.months,
      mode: params.mode,
      treatment: params.mode === "treatment_adjusted" ? params.treatment : null,
    }),
  });

  if (!response.ok) {
    throw new Error(`API Error: ${response.statusText}`);
  }

  return response.json();
}
