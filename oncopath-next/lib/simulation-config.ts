import type { PatientProfile } from "@/lib/api";

export const DRIVER_GENES = ["TP53", "KRAS", "APC", "PIK3CA", "ARID1A", "FGA"] as const;
export const OTHER_MUTATION_GENES = ["PTEN", "EGFR", "KMT2D", "ATM", "RB1"] as const;

export const INITIAL_PROFILE: PatientProfile = {
  age: 65,
  sex: "Male",
  primary_site: "Lung",
  oncotree_code: "LUAD",
  mutations: { TP53: 1, KRAS: 1 },
};
