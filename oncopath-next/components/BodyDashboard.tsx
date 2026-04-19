'use client';

import React, { lazy, Suspense, useCallback, useEffect, useMemo, useState } from 'react';
import { AlertCircle, Activity, Clock } from 'lucide-react';
import { OrganPopover, type OrganPopoverData } from '@/components/ui/OrganPopover';
import { GenomicDrawer } from '@/components/ui/GenomicDrawer';
import {
  PatientProfile,
  simulateRisk,
  requestPredictTimeline,
  type PredictionSnapshot,
} from '@/lib/api';
import { TimelinePanel } from '@/components/TimelinePanel';
import {
  DEFAULT_TIMELINE_MONTHS,
  generateLocalTimelineProjection,
  TIMELINE_TREATMENT_PRESETS,
  type TreatmentPresetId,
} from '@/lib/timeline';

const AnatomicalBody3D = lazy(() =>
  import('@/components/AnatomicalBody3D').then((m) => ({ default: m.AnatomicalBody3D }))
);

// ─── Default patient (Breast Cancer) ──────────────────────────── //
const DEFAULT_PROFILE: PatientProfile = {
  name: 'Jane Doe',
  age: 55,
  sex: 'Female',
  primary_site: 'Breast',
  oncotree_code: 'BRCA',
  mutations: { TP53: 1, PIK3CA: 1, ERBB2: 1 },
};

const DEFAULT_TREATMENT: TreatmentPresetId = TIMELINE_TREATMENT_PRESETS[0].id;

export function BodyDashboard() {
  const [profile, setProfile]           = useState<PatientProfile>(DEFAULT_PROFILE);
  const [simulationProfile, setSimulationProfile] = useState<PatientProfile>(DEFAULT_PROFILE);
  const [simulationImage, setSimulationImage]     = useState<string | undefined>(undefined);
  const [risks, setRisks]               = useState<Record<string, number>>({});
  const [prediction, setPrediction]     = useState<PredictionSnapshot | null>(null);
  const [loading, setLoading]           = useState(false);
  const [error, setError]               = useState<string | null>(null);

  // Popover state
  const [popover, setPopover] = useState<OrganPopoverData | null>(null);
  const [activeOrganId, setActiveOrganId] = useState<string>("");

  // 12-month projection for the selected organ
  const [proj12m, setProj12m] = useState<number | undefined>(undefined);

  // Timeline & Simulation Engine State
  const [selectedMonth, setSelectedMonth] = useState(0);
  const [selectedTreatment, setSelectedTreatment] = useState<TreatmentPresetId>(DEFAULT_TREATMENT);
  const [trajectories, setTrajectories] = useState<Record<string, any[]>>({});
  const [simulationSummary, setSimulationSummary] = useState<string>("");
  const [timelineSource, setTimelineSource] = useState<'local' | 'backend'>('local');
  const [isTimelineLoading, setIsTimelineLoading] = useState(false);
  const [isTimelineOpen, setIsTimelineOpen] = useState(false);
  const [isParametersOpen, setIsParametersOpen] = useState(false);

  // ── Simulation ─────────────────────────────────────────────────────────── //
  useEffect(() => {
    const ctrl = new AbortController();
    let cancelled = false;
    (async () => {
      setLoading(true); setError(null);
      try {
        const result = await simulateRisk(simulationProfile, { image: simulationImage });
        if (!cancelled) { 
          setPrediction(result); 
          setRisks(result.risk_scores); 
          // Default active organ to Primary Site if none selected
          const primaryKey = Object.keys(result.risk_scores).find(k => k.startsWith('PRIMARY_'));
          if (primaryKey && !activeOrganId) {
            setActiveOrganId(primaryKey);
          }
        }
      } catch (e) {
        if (!cancelled) setError(e instanceof Error ? e.message : 'API unreachable');
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; ctrl.abort(); };
  }, [simulationProfile, simulationImage]);

  // ── 12-month projection derived from active timeline ────────────────── //
  useEffect(() => {
    const activeId = activeOrganId || popover?.organId || Object.keys(risks).find(k => k.startsWith('PRIMARY_'));
    if (!activeId || !trajectories[activeId]) {
      setProj12m(undefined);
      return;
    }
    const pts = trajectories[activeId];
    const at12 = pts.find((p) => p.month >= 12) ?? pts[pts.length - 1];
    setProj12m(at12?.risk);
  }, [trajectories, activeOrganId, popover?.organId, risks]);

  // ── Long-range timeline fetch (Claude-driven) ─────────────────────────── //
  useEffect(() => {
    const activeId = activeOrganId || popover?.organId || Object.keys(risks).find(k => k.startsWith('PRIMARY_'));
    if (!activeId || risks[activeId] === undefined) return;
    
    const ctrl = new AbortController();
    // Reset summary + mark projection as loading
    setTimelineSource('local');
    setIsTimelineLoading(true);
    setSimulationSummary("Analyzing genomic-treatment interactions — computing biological rationale…");

    requestPredictTimeline(
      simulationProfile, 
      risks, 
      selectedTreatment, 
      120, 
      popover?.name || activeId, 
      ctrl.signal
    )
      .then(result => {
        setTrajectories(result.trajectories);
        setSimulationSummary(result.summary);
        setTimelineSource('backend');
        setIsTimelineLoading(false);
      })
      .catch(err => {
        if ((err as Error)?.name === 'AbortError') return;
        console.error('Temporal Fetch Failed:', err);
        const fallbackTrajectories: Record<string, any[]> = {};
        Object.entries(risks).forEach(([site, baseline]) => {
          fallbackTrajectories[site] = generateLocalTimelineProjection({
            organKey: site,
            baselineRisk: baseline,
            treatment: selectedTreatment,
            months: 120
          });
        });
        setTrajectories(fallbackTrajectories);
        setSimulationSummary("Deterministic systemic projection applied (AI agent offline).");
        setTimelineSource('local');
        setIsTimelineLoading(false);
      });

    return () => ctrl.abort();
  }, [activeOrganId, popover?.organId, risks, selectedTreatment, simulationProfile]);

  // ── Compute Active Risk (Time-Shifted) ────────────────────────────────── //
  const temporalRisks = useMemo(() => {
    if (selectedMonth === 0) return risks;
    if (Object.keys(trajectories).length === 0) return risks;

    const newRisks = { ...risks };
    Object.entries(trajectories).forEach(([site, pts]) => {
      const point = pts.find(p => p.month === selectedMonth) || 
                    pts.reduce((prev, curr) => Math.abs(curr.month - selectedMonth) < Math.abs(prev.month - selectedMonth) ? curr : prev);
      newRisks[site] = point.risk;
    });
    
    return newRisks;
  }, [risks, trajectories, selectedMonth]);

  // ── Dynamic confidence signals (update with treatment) ─────────────────── //
  const dynamicConfidenceMetrics = useMemo(() => {
    const base = prediction?.confidence_metrics ?? {};
    const trajectoryKeys = Object.keys(trajectories);
    if (trajectoryKeys.length < 2) return base;

    // Target Clarity: fraction of total risk mass in top-3 sites at projection endpoint.
    // Matches the Gini-like formula in _build_clinical_confidence_metrics on the backend.
    // This is the only metric that changes with treatment — GDS and Data Confidence are patient-level.
    const endpointRisks = trajectoryKeys
      .map(site => {
        const pts = trajectories[site];
        return pts?.length ? pts[pts.length - 1].risk : (risks[site] ?? 0);
      })
      .sort((a, b) => b - a);

    const totalRisk = endpointRisks.reduce((a, b) => a + b, 0);
    const top3Risk  = endpointRisks.slice(0, 3).reduce((a, b) => a + b, 0);
    const targetClarity = totalRisk > 0 ? top3Risk / totalRisk : 0;

    return {
      ...base,
      'Target Clarity': Math.round(targetClarity * 1000) / 1000,
    };
  }, [prediction?.confidence_metrics, trajectories, risks]);

  // ── Organ click handler ────────────────────────────────────────────────── //
  const handleOrganSelect = useCallback((organId: string, name: string, x: number, y: number) => {
    setActiveOrganId(organId);
    setPopover({ organId, name, clientX: x, clientY: y });
    setIsTimelineOpen(true);
  }, []);

  const handleManualOrganChange = useCallback((organId: string) => {
    setActiveOrganId(organId);
    // If selecting via dropdown, clear the 3D popover to avoid confusion
    setPopover(null);
    setIsTimelineOpen(true);
  }, []);

  const activeMutations = useMemo(() =>
    Object.entries(profile.mutations).filter(([, v]) => v === 1).map(([k]) => k),
    [profile.mutations]
  );

  return (
    <div
      className="relative w-full h-full bg-zinc-950 overflow-hidden"
      onClick={() => setPopover(null)} // close popover on backdrop click
    >
      {/* ── 3D Body — full viewport ─────────────────────────────────────── */}
      <div className="absolute inset-0 z-0">
        <Suspense fallback={
          <div className="w-full h-full flex items-center justify-center">
            <div className="flex flex-col items-center gap-4">
              <div className="w-10 h-10 border-2 border-orange-600/30 border-t-orange-500 rounded-full animate-spin" />
              <span className="text-[11px] font-mono text-zinc-500 animate-pulse tracking-[0.2em] uppercase">
                Loading Anatomical Engine…
              </span>
            </div>
          </div>
        }>
          <AnatomicalBody3D 
            risks={temporalRisks} 
            profile={simulationProfile} 
            onOrganSelect={handleOrganSelect} 
          />
        </Suspense>

        {/* Computing overlay */}
        {loading && (
          <div className="absolute inset-0 z-10 flex items-end justify-center pb-8 pointer-events-none">
            <div className="flex items-center gap-2 bg-zinc-900/80 backdrop-blur-md px-4 py-2 rounded-full border border-zinc-800 text-[10px] font-mono text-zinc-400 tracking-widest uppercase animate-slide-up">
              <div className="w-3 h-3 border border-orange-500/40 border-t-orange-500 rounded-full animate-spin" />
              Computing risk vectors…
            </div>
          </div>
        )}
      </div>

      {/* ── Top-left brand mark ─────────────────────────────────────────── */}
      <div className="absolute top-4 left-4 z-20 flex items-center gap-2.5 pointer-events-none">
        <div className="w-8 h-8 rounded-lg bg-orange-600/20 border border-orange-600/40 flex items-center justify-center shadow-[0_0_12px_rgba(234,88,12,0.2)]">
          <Activity size={15} className="text-orange-400" />
        </div>
        <div>
          <div className="text-zinc-100 text-sm font-bold leading-tight" style={{ fontFamily: "'Space Grotesk', sans-serif" }}>
            OncoPath
          </div>
          <div className="text-zinc-600 text-[9px] font-mono uppercase tracking-widest">
            {profile.primary_site} · {profile.oncotree_code} · Age {profile.age}
          </div>
        </div>
      </div>

      {/* ── Parameters & Timeline FABs ────────────────────────────── */}
      <div className="absolute bottom-4 left-4 z-40 flex items-center gap-3">
        <div className="pointer-events-auto">
          <GenomicDrawer 
            profile={profile} 
            open={isParametersOpen}
            hideTrigger={isTimelineOpen || isParametersOpen}
            onOpenChange={setIsParametersOpen}
            onChange={setProfile} 
            onRunSimulation={(slideImage?: string) => {
              setSimulationProfile(profile);
              setSimulationImage(slideImage);
            }} 
          />
        </div>
        
        {(!isTimelineOpen && !isParametersOpen) && (
          <div className="pointer-events-auto">
            <button
              onClick={(e) => { e.stopPropagation(); setIsTimelineOpen(!isTimelineOpen); }}
              title="Toggle treatment simulation timeline"
              className={`flex items-center gap-2 px-4 py-2.5 rounded-xl bg-zinc-900/80 backdrop-blur-md border border-zinc-800 hover:border-blue-600/50 text-xs font-semibold tracking-wide transition-all shadow-lg group ${isTimelineOpen ? 'text-blue-400 border-blue-600/40' : 'text-zinc-400 hover:text-zinc-100'}`}
            >
              <Clock size={14} className={isTimelineOpen ? 'text-blue-400' : 'group-hover:text-blue-400 transition-colors'} />
              <span>Simulation Timeline</span>
            </button>
          </div>
        )}
      </div>

      {/* ── Organ Popover ────────────────────────────────────────────────── */}
      {popover && (
        <OrganPopover
          data={popover}
          risk={risks[popover.organId]}
          activeMutations={activeMutations}
          projectedRisk12m={proj12m}
          onClose={() => setPopover(null)}
        />
      )}

      {/* ── Timeline Panel ────────────────────────────────────────────── */}
      {isTimelineOpen && (
        <div className="absolute bottom-0 left-0 right-0 z-30 pointer-events-none">
          <div className="pointer-events-auto max-h-[60vh] overflow-y-auto overscroll-contain">
            <TimelinePanel
              organOptions={Object.keys(risks).sort((a,b) => a.startsWith('PRIMARY_') ? -1 : 1).map(k => ({ 
                key: k, 
                label: k.startsWith('PRIMARY_') 
                  ? `${k.replace('PRIMARY_', '').replace(/_/g, ' ')} (Primary Site)`
                  : k.replace('DMETS_DX_', '').replace(/_/g, ' ') 
              }))}
              selectedOrgan={activeOrganId || Object.keys(risks).find(k => k.startsWith('PRIMARY_')) || ''}
              selectedTreatment={selectedTreatment}
              selectedMonth={selectedMonth}
              timeline={trajectories[activeOrganId || Object.keys(risks).find(k => k.startsWith('PRIMARY_')) || ''] || []}
              timelineSource={timelineSource}
              simulationSummary={simulationSummary}
              baselineRisk={risks[activeOrganId || Object.keys(risks).find(k => k.startsWith('PRIMARY_')) || ''] || null}
              prediction={prediction}
              confidenceMetrics={dynamicConfidenceMetrics}
              isProjectionLoading={isTimelineLoading}
              onOrganChange={handleManualOrganChange}
              onTreatmentChange={setSelectedTreatment}
              onMonthChange={setSelectedMonth}
              onClose={() => setIsTimelineOpen(false)}
            />
          </div>
        </div>
      )}

      {/* ── Error toast ─────────────────────────────────────────────────── */}
      {error && (
        <div className="fixed bottom-16 right-4 z-50 flex items-start gap-2.5 bg-zinc-900/90 backdrop-blur-xl border border-red-500/25 px-4 py-3 rounded-xl shadow-2xl max-w-xs animate-slide-up">
          <AlertCircle size={14} className="text-red-400 mt-0.5 flex-shrink-0" />
          <div>
            <p className="text-xs font-bold text-red-200">Backend Offline</p>
            <p className="text-[10px] text-red-400 font-mono mt-0.5">FastAPI not reachable · port 8000</p>
          </div>
        </div>
      )}
    </div>
  );
}
