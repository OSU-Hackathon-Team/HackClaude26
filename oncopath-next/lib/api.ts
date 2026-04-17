/**
 * lib/api.ts
 * Bridge to the FastAPI Backend.
 */

const RAW_API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://127.0.0.1:8000";
export const API_BASE_URL = RAW_API_BASE_URL.replace(/\/+$/, "");

export interface PatientProfile {
  age: number;
  sex: string;
  primary_site: string;
  oncotree_code: string;
  mutations: Record<string, number>;
}

export interface SimulationResult {
  patient_age: number;
  primary_site: string;
  simulated_risks: Record<string, number>;
}

interface ErrorDetail {
  code?: string;
  message?: string;
}

interface ErrorResponse {
  detail?: string | ErrorDetail;
}

async function parseJsonSafely<T>(response: Response): Promise<T | null> {
  const text = await response.text();
  if (!text) {
    return null;
  }

  try {
    return JSON.parse(text) as T;
  } catch {
    return null;
  }
}

function getErrorMessage(response: Response, payload: ErrorResponse | null): string {
  if (!payload?.detail) {
    return `API Error (${response.status})`;
  }

  if (typeof payload.detail === "string") {
    return payload.detail;
  }

  if (payload.detail.message) {
    return payload.detail.message;
  }

  return `API Error (${response.status})`;
}

export async function simulateRisk(profile: PatientProfile): Promise<SimulationResult> {
  const response = await fetch(`${API_BASE_URL}/simulate`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(profile),
  });

  if (!response.ok) {
    const errorPayload = await parseJsonSafely<ErrorResponse>(response);
    throw new Error(getErrorMessage(response, errorPayload));
  }

  const result = await parseJsonSafely<SimulationResult>(response);
  if (!result) {
    throw new Error("API returned an empty or invalid response.");
  }

  return result;
}
