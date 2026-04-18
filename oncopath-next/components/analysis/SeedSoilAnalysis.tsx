'use client';
import React, { useState, useRef, useEffect } from 'react';
import { Info, X, Dna, FlaskConical } from 'lucide-react';
import { PatientProfile } from '@/lib/api';

interface TropismBrief {
  seed: { mutation: string; mechanism: string };
  soil: { environment: string; mechanism: string };
}

// Seed & Soil Tropism Knowledge Base
// Maps [primary_site_lowercase][organ_key] → TropismBrief
const TROPISM_MAP: Record<string, Record<string, TropismBrief>> = {
  breast: {
    DMETS_DX_DIST_LN: {
      seed: { mutation: 'ERBB2 / TP53', mechanism: 'HER2 amplification drives lymphangiogenesis, creating direct invasion channels into lymphatic vessels adjacent to the primary tumor.' },
      soil: { environment: 'Lymph Node Cortex', mechanism: 'The lymph node\'s dense network of follicular dendritic cells and high endothelial venules provides an immune-permissive niche that resists T-cell clearance of HER2+ cells.' },
    },
    DMETS_DX_BONE: {
      seed: { mutation: 'PIK3CA / BRCA1', mechanism: 'PI3K pathway activation upregulates CXCR4 receptor expression on tumor cells, creating a "homing beacon" response to CXCL12 chemokine gradients.' },
      soil: { environment: 'Bone Marrow Stroma', mechanism: 'Osteoblasts constitutively secrete CXCL12 (SDF-1), directly attracting CXCR4+ breast cancer cells. RANKL in the marrow seeds osteoclast hyperactivation ("vicious cycle").' },
    },
    DMETS_DX_LUNG: {
      seed: { mutation: 'TP53 / MYC', mechanism: 'TP53 loss eliminates anoikis resistance checkpoints, allowing circulating tumor cells to survive the pulmonary capillary bed and extravasate.' },
      soil: { environment: 'Pulmonary Microvasculature', mechanism: 'The lung\'s high oxygen tension and slow capillary transit speeds facilitate tumor cell arrest. VCAM-1 expression on lung endothelium enables tumor cell adhesion.' },
    },
    DMETS_DX_LIVER: {
      seed: { mutation: 'ERBB2 / MYC', mechanism: 'HER2-amplified cells secrete heregulin, activating hepatic stellate cell signaling and promoting an immunosuppressive pre-metastatic niche.' },
      soil: { environment: 'Hepatic Sinusoids', mechanism: 'Kupffer cells (hepatic macrophages) are reprogrammed by tumor-derived exosomes to secrete fibronectin, assembling a "landing pad" for circulating breast cancer cells.' },
    },
  },
  colon: {
    DMETS_DX_LIVER: {
      seed: { mutation: 'KRAS / SMAD4', mechanism: 'KRAS G12D mutation drives constitutive MAPK activation. Loss of SMAD4 eliminates TGF-β growth suppression, allowing unchecked proliferation in a new microenvironment.' },
      soil: { environment: 'Hepatic Extracellular Matrix', mechanism: 'The portal vein provides a direct anatomical route from the colon to the liver. The hepatic ECM is uniquely rich in fibronectin and vitronectin, to which KRAS-mutated cells show high adhesion affinity.' },
    },
    DMETS_DX_LUNG: {
      seed: { mutation: 'KRAS / TP53', mechanism: 'TP53-null CRC cells exhibit enhanced EMT (Epithelial-Mesenchymal Transition), enabling them to survive in pulmonary circulation and colonize alveolar tissue.' },
      soil: { environment: 'Pulmonary Alveoli', mechanism: 'Lung macrophages in CRC patients are skewed towards M2 immunosuppressive phenotype by the primary tumor, creating a permissive pre-metastatic niche before cells arrive.' },
    },
    DMETS_DX_INTRA_ABDOMINAL: {
      seed: { mutation: 'TP53 / APC', mechanism: 'APC loss leads to β-catenin nuclear accumulation, activating EMT programs that enable peritoneal seeding directly from the colonic wall.' },
      soil: { environment: 'Peritoneal Mesothelium', mechanism: 'The peritoneal surface expresses CD44 and EpCAM ligands that directly bind to shed tumor cells, enabling implantation across the abdominal cavity.' },
    },
  },
  lung: {
    DMETS_DX_CNS_BRAIN: {
      seed: { mutation: 'EGFR / ALK', mechanism: 'EGFR-mutated NSCLCs overexpress S100A8/A9, which disrupts the blood-brain barrier\'s tight junctions and enables trans-endothelial migration into brain parenchyma.' },
      soil: { environment: 'Brain Parenchyma', mechanism: 'Reactive astrocytes in the brain convert GABA to alanine, providing an alternative carbon source for ALK/EGFR-driven cancer cells, creating a metabolically supportive niche.' },
    },
    DMETS_DX_BONE: {
      seed: { mutation: 'KRAS / TP53', mechanism: 'KRAS-driven upregulation of PTHrP (parathyroid hormone-related protein) directly stimulates osteoclast activation, carving out bone marrow space for metastatic colonization.' },
      soil: { environment: 'Trabecular Bone', mechanism: 'The low-oxygen bone marrow microenvironment favors metabolic adaptations already present in KRAS-mutated cells. TGF-β released from bone matrix during remodeling further stimulates tumor growth.' },
    },
    DMETS_DX_ADRENAL_GLAND: {
      seed: { mutation: 'KRAS / STK11', mechanism: 'STK11 loss combined with KRAS activation generates a highly invasive, mesenchymal phenotype with strong adrenotropism mediated by IGF-1R/IGFBP signaling.' },
      soil: { environment: 'Adrenal Cortex', mechanism: 'The high lipid and cholesterol content of adrenocortical cells provides a rich metabolic substrate for KRAS-hyperactive tumor cells. The adrenal gland\'s fenestrated capillaries also facilitate extravasation.' },
    },
  },
};

// Organ display-name mapping
const ORGAN_LABELS: Record<string, string> = {
  DMETS_DX_DIST_LN: 'Distant Lymph Nodes',
  DMETS_DX_BONE: 'Bone',
  DMETS_DX_LIVER: 'Liver',
  DMETS_DX_LUNG: 'Lung',
  DMETS_DX_CNS_BRAIN: 'Brain',
  DMETS_DX_INTRA_ABDOMINAL: 'Intra-Abdominal',
  DMETS_DX_ADRENAL_GLAND: 'Adrenal Gland',
  DMETS_DX_PLEURA: 'Pleura',
  DMETS_DX_SKIN: 'Skin',
};

function getGenericBrief(organKey: string, mutations: string[]): TropismBrief {
  const mutList = mutations.length > 0 ? mutations.join(', ') : 'multiple genomic alterations';
  const organLabel = ORGAN_LABELS[organKey] ?? 'this organ';
  return {
    seed: {
      mutation: mutList,
      mechanism: `Active mutations in ${mutList} drive genomic instability, epithelial-to-mesenchymal transition (EMT), and immune evasion — core hallmarks enabling distant metastatic seeding.`,
    },
    soil: {
      environment: organLabel,
      mechanism: `The microenvironment of ${organLabel} exhibits cytokine profiles and vascular accessibility patterns that are permissive to circulating tumor cell adhesion and colonization based on this patient's primary site profile.`,
    },
  };
}

interface SeedSoilAnalysisProps {
  organKey: string;
  riskScore: number;
  profile: PatientProfile;
}

export function SeedSoilAnalysis({ organKey, riskScore, profile }: SeedSoilAnalysisProps) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  // Close on outside click
  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    if (open) document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, [open]);

  if (riskScore < 0.30) return null;

  const primaryKey = profile.primary_site.toLowerCase();
  const organMap = TROPISM_MAP[primaryKey];
  const activeMutations = Object.keys(profile.mutations).filter(k => profile.mutations[k] > 0);
  const brief = organMap?.[organKey] ?? getGenericBrief(organKey, activeMutations);
  const organLabel = ORGAN_LABELS[organKey] ?? organKey.replace('DMETS_DX_', '').replace(/_/g, ' ');

  return (
    <div ref={ref} className="relative inline-flex items-center" onClick={(e) => e.stopPropagation()}>
      <button
        onClick={() => setOpen(!open)}
        title="Seed & Soil Analysis"
        className={`p-0.5 rounded transition-all ${open ? 'text-orange-400' : 'text-zinc-600 hover:text-orange-400'}`}
      >
        <Info size={12} />
      </button>

      {open && (
        <div
          className="absolute z-[200] right-0 bottom-6 w-[320px] rounded-xl overflow-hidden shadow-2xl"
          style={{
            background: 'rgba(9, 9, 11, 0.95)',
            border: '1px solid rgba(234, 88, 12, 0.25)',
            backdropFilter: 'blur(20px)',
          }}
        >
          {/* Header */}
          <div className="px-4 py-3 border-b border-orange-500/20 flex items-center justify-between"
            style={{ background: 'rgba(234, 88, 12, 0.08)' }}>
            <div>
              <div className="text-[9px] text-orange-500 uppercase tracking-[0.2em] font-bold mb-0.5">Seed & Soil Analysis</div>
              <div className="text-xs text-zinc-100 font-semibold">{profile.primary_site} → {organLabel}</div>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-lg font-black font-mono" style={{ color: riskScore > 0.6 ? '#ef4444' : riskScore > 0.4 ? '#f97316' : '#eab308' }}>
                {Math.round(riskScore * 100)}%
              </span>
              <button onClick={() => setOpen(false)} className="text-zinc-600 hover:text-zinc-300 transition-colors">
                <X size={12} />
              </button>
            </div>
          </div>

          {/* Body */}
          <div className="p-4 space-y-3">
            {/* Seed */}
            <div className="rounded-lg p-3" style={{ background: 'rgba(234, 88, 12, 0.07)', border: '1px solid rgba(234, 88, 12, 0.15)' }}>
              <div className="flex items-center gap-2 mb-2">
                <div className="w-5 h-5 rounded flex items-center justify-center" style={{ background: 'rgba(234, 88, 12, 0.2)' }}>
                  <Dna size={11} className="text-orange-400" />
                </div>
                <div>
                  <div className="text-[8px] text-orange-500 uppercase tracking-wider font-bold">The Seed</div>
                  <div className="text-[10px] text-orange-200 font-mono font-semibold">{brief.seed.mutation}</div>
                </div>
              </div>
              <p className="text-[11px] text-zinc-400 leading-relaxed">{brief.seed.mechanism}</p>
            </div>

            {/* Soil */}
            <div className="rounded-lg p-3" style={{ background: 'rgba(59, 130, 246, 0.05)', border: '1px solid rgba(59, 130, 246, 0.12)' }}>
              <div className="flex items-center gap-2 mb-2">
                <div className="w-5 h-5 rounded flex items-center justify-center" style={{ background: 'rgba(59, 130, 246, 0.15)' }}>
                  <FlaskConical size={11} className="text-blue-400" />
                </div>
                <div>
                  <div className="text-[8px] text-blue-400 uppercase tracking-wider font-bold">The Soil</div>
                  <div className="text-[10px] text-blue-200 font-mono font-semibold">{brief.soil.environment}</div>
                </div>
              </div>
              <p className="text-[11px] text-zinc-400 leading-relaxed">{brief.soil.mechanism}</p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
