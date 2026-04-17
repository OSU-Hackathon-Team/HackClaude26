/**
 * Anatomy coordinate mapping for the 2D body silhouette.
 * Coordinates are percentages (0-100) matching the SVG viewBox 200×480.
 * x% maps to SVG x = x/100*200, y% maps to SVG y = y/100*480.
 */
export const ANATOMY_MAPPING_2D: Record<string, { label: string; region: string; system: string; x: number; y: number }> = {
    "DMETS_DX_CNS_BRAIN": { label: "Brain", region: "Head", system: "Nervous", x: 50, y: 5.8 },
    "DMETS_DX_HEAD_NECK": { label: "Head/Neck", region: "Head", system: "Multiple", x: 50, y: 12.5 },
    "DMETS_DX_MEDIASTINUM": { label: "Mediastinum", region: "Chest", system: "Respiratory", x: 50, y: 24 },
    "DMETS_DX_PLEURA": { label: "Pleura", region: "Chest", system: "Respiratory", x: 62, y: 24.5 },
    "DMETS_DX_LUNG": { label: "Lung", region: "Chest", system: "Respiratory", x: 38, y: 26 },
    "DMETS_DX_BREAST": { label: "Breast", region: "Chest", system: "Reproductive", x: 58, y: 22 },
    "DMETS_DX_LIVER": { label: "Liver", region: "Abdomen", system: "Digestive", x: 39, y: 32 },
    "DMETS_DX_BILIARY_TRACT": { label: "Biliary Tract", region: "Abdomen", system: "Digestive", x: 43, y: 34 },
    "DMETS_DX_INTRA_ABDOMINAL": { label: "Intra-Abdominal", region: "Abdomen", system: "Digestive", x: 50, y: 36 },
    "DMETS_DX_BOWEL": { label: "Bowel", region: "Abdomen", system: "Digestive", x: 50, y: 39.5 },
    "DMETS_DX_KIDNEY": { label: "Kidney", region: "Abdomen", system: "Urinary", x: 63, y: 33 },
    "DMETS_DX_ADRENAL_GLAND": { label: "Adrenal Gland", region: "Abdomen", system: "Endocrine", x: 62, y: 31 },
    "DMETS_DX_BONE": { label: "Bone", region: "Skeletal", system: "Musculoskeletal", x: 31, y: 68 },
    "DMETS_DX_BLADDER_UT": { label: "Bladder", region: "Pelvis", system: "Urinary", x: 50, y: 43.5 },
    "DMETS_DX_OVARY": { label: "Ovary", region: "Pelvis", system: "Reproductive", x: 43, y: 42.5 },
    "DMETS_DX_FEMALE_GENITAL": { label: "Female Genital", region: "Pelvis", system: "Reproductive", x: 50, y: 45 },
    "DMETS_DX_MALE_GENITAL": { label: "Male Genital", region: "Pelvis", system: "Reproductive", x: 50, y: 46 },
    "DMETS_DX_SKIN": { label: "Skin", region: "Integumentary", system: "Integumentary", x: 78, y: 36 },
    "DMETS_DX_DIST_LN": { label: "Distant LN", region: "Lymphatic", system: "Immune", x: 30, y: 21.5 },
    "DMETS_DX_PNS": { label: "PNS", region: "Nervous System", system: "Nervous", x: 29, y: 55 },
    "DMETS_DX_UNSPECIFIED": { label: "Unspecified", region: "Unknown", system: "Unknown", x: 87, y: 91 },
};

export const getAnatomyMeta2D = (site: string) => {
    return ANATOMY_MAPPING_2D[site] || { label: site, region: "Unknown", system: "Unknown", x: 0, y: 0 };
};
