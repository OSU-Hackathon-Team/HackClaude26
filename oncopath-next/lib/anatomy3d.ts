/**
 * 3D Anatomy coordinate mapping for the Three.js body model.
 * Coordinates are in Three.js world units centered on the body.
 * Y-axis is vertical (up), X-axis is left-right, Z-axis is front-back.
 * Body height is approximately 10 units total.
 */

export interface OrganPosition3D {
  label: string;
  region: string;
  system: string;
  position: [number, number, number]; // [x, y, z]
  size: number; // relative size for the marker
  description: string;
}

export const ANATOMY_MAPPING_3D: Record<string, OrganPosition3D> = {
  "DMETS_DX_CNS_BRAIN": {
    label: "Brain",
    region: "Head",
    system: "Nervous",
    position: [0, 4.6, 0.05],
    size: 0.18,
    description: "Central nervous system — cerebral cortex, cerebellum, brainstem"
  },
  "DMETS_DX_HEAD_NECK": {
    label: "Head & Neck",
    region: "Head",
    system: "Multiple",
    position: [0, 3.95, 0.12],
    size: 0.12,
    description: "Oropharynx, nasopharynx, larynx, thyroid, salivary glands"
  },
  "DMETS_DX_MEDIASTINUM": {
    label: "Mediastinum",
    region: "Chest",
    system: "Respiratory",
    position: [0, 2.7, 0.15],
    size: 0.13,
    description: "Central thoracic cavity — heart, great vessels, trachea, esophagus"
  },
  "DMETS_DX_PLEURA": {
    label: "Pleura",
    region: "Chest",
    system: "Respiratory",
    position: [0.45, 2.65, 0.2],
    size: 0.1,
    description: "Serous membrane surrounding the lungs"
  },
  "DMETS_DX_LUNG": {
    label: "Lung",
    region: "Chest",
    system: "Respiratory",
    position: [-0.4, 2.75, 0.18],
    size: 0.16,
    description: "Pulmonary parenchyma — gas exchange, bronchial tree"
  },
  "DMETS_DX_BREAST": {
    label: "Breast",
    region: "Chest",
    system: "Reproductive",
    position: [0.35, 2.35, 0.45],
    size: 0.11,
    description: "Mammary gland tissue — ductal and lobular structures"
  },
  "DMETS_DX_LIVER": {
    label: "Liver",
    region: "Abdomen",
    system: "Digestive",
    position: [-0.35, 1.75, 0.25],
    size: 0.18,
    description: "Hepatic parenchyma — detoxification, bile production, glycogen storage"
  },
  "DMETS_DX_BILIARY_TRACT": {
    label: "Biliary Tract",
    region: "Abdomen",
    system: "Digestive",
    position: [-0.2, 1.6, 0.2],
    size: 0.08,
    description: "Gallbladder, common bile duct, hepatic ducts"
  },
  "DMETS_DX_INTRA_ABDOMINAL": {
    label: "Intra-Abdominal",
    region: "Abdomen",
    system: "Digestive",
    position: [0, 1.4, 0.18],
    size: 0.14,
    description: "Peritoneal cavity — omentum, mesentery, retroperitoneal space"
  },
  "DMETS_DX_BOWEL": {
    label: "Bowel",
    region: "Abdomen",
    system: "Digestive",
    position: [0, 1.1, 0.2],
    size: 0.15,
    description: "Small intestine, large intestine, cecum, appendix, rectum"
  },
  "DMETS_DX_KIDNEY": {
    label: "Kidney",
    region: "Abdomen",
    system: "Urinary",
    position: [0.4, 1.7, -0.1],
    size: 0.12,
    description: "Renal parenchyma — glomerular filtration, urine production"
  },
  "DMETS_DX_ADRENAL_GLAND": {
    label: "Adrenal Gland",
    region: "Abdomen",
    system: "Endocrine",
    position: [0.38, 1.9, -0.05],
    size: 0.08,
    description: "Suprarenal glands — cortisol, aldosterone, epinephrine production"
  },
  "DMETS_DX_BONE": {
    label: "Bone",
    region: "Skeletal",
    system: "Musculoskeletal",
    position: [-0.55, -0.3, 0.05],
    size: 0.14,
    description: "Osseous tissue — axial and appendicular skeleton, bone marrow"
  },
  "DMETS_DX_BLADDER_UT": {
    label: "Bladder",
    region: "Pelvis",
    system: "Urinary",
    position: [0, 0.6, 0.22],
    size: 0.1,
    description: "Urinary bladder — urine storage and micturition"
  },
  "DMETS_DX_OVARY": {
    label: "Ovary",
    region: "Pelvis",
    system: "Reproductive",
    position: [-0.25, 0.75, 0.12],
    size: 0.08,
    description: "Female gonad — oocyte maturation, estrogen/progesterone production"
  },
  "DMETS_DX_FEMALE_GENITAL": {
    label: "Female Genital",
    region: "Pelvis",
    system: "Reproductive",
    position: [0, 0.5, 0.18],
    size: 0.09,
    description: "Uterus, fallopian tubes, cervix, vagina"
  },
  "DMETS_DX_MALE_GENITAL": {
    label: "Male Genital",
    region: "Pelvis",
    system: "Reproductive",
    position: [0, 0.4, 0.25],
    size: 0.09,
    description: "Prostate, seminal vesicles, testes"
  },
  "DMETS_DX_SKIN": {
    label: "Skin",
    region: "Integumentary",
    system: "Integumentary",
    position: [0.75, 1.4, 0.3],
    size: 0.1,
    description: "Cutaneous tissue — epidermis, dermis, subcutaneous layer"
  },
  "DMETS_DX_DIST_LN": {
    label: "Distant Lymph Nodes",
    region: "Lymphatic",
    system: "Immune",
    position: [-0.6, 2.9, 0.2],
    size: 0.1,
    description: "Distant lymphatic stations — cervical, axillary, inguinal chains"
  },
  "DMETS_DX_PNS": {
    label: "PNS",
    region: "Nervous System",
    system: "Nervous",
    position: [-0.6, 0.3, 0.05],
    size: 0.09,
    description: "Peripheral nervous system — somatic and autonomic nerve fibers"
  },
  "DMETS_DX_UNSPECIFIED": {
    label: "Unspecified",
    region: "Unknown",
    system: "Unknown",
    position: [0.8, -1.5, 0.1],
    size: 0.08,
    description: "Metastatic site not otherwise specified"
  },
};

/**
 * Returns the body system color theme
 */
export function getSystemColor(system: string): string {
  const colors: Record<string, string> = {
    "Nervous": "#a78bfa",
    "Multiple": "#94a3b8",
    "Respiratory": "#38bdf8",
    "Reproductive": "#f472b6",
    "Digestive": "#fbbf24",
    "Urinary": "#34d399",
    "Endocrine": "#fb923c",
    "Musculoskeletal": "#e2e8f0",
    "Integumentary": "#f9a8d4",
    "Immune": "#4ade80",
    "Unknown": "#64748b",
  };
  return colors[system] || "#64748b";
}
