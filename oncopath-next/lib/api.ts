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
}

export async function simulateRisk(profile: PatientProfile): Promise<SimulationResult> {
  const response = await fetch(`${API_URL}/simulate`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(profile),
  });

  if (!response.ok) {
    throw new Error(`API Error: ${response.statusText}`);
  }

  return response.json();
}
