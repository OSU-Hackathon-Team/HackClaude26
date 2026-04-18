'use client';

import React, { lazy, Suspense, useEffect, useMemo, useState } from 'react';
import { AlertCircle, Terminal, HelpCircle, Box, Layout } from 'lucide-react';
import { GenomicLab } from '@/components/GenomicLab';
import { TimelinePanel } from '@/components/TimelinePanel';
import { getAnatomyMeta2D } from '@/lib/anatomy';
import {
  PatientProfile,
  requestPredictTimeline,
  simulateRisk,
  type PredictionSnapshot,
} from '@/lib/api';
import {
  DEFAULT_TIMELINE_MONTHS,
  generateLocalTimelineProjection,
  getTimelinePointAtMonth,
  TIMELINE_TREATMENT_PRESETS,
  type TimelinePoint,
  type TreatmentPresetId,
} from '@/lib/timeline';

const AnatomicalBody3D = lazy(() =>
  import('@/components/AnatomicalBody3D').then((mod) => ({ default: mod.AnatomicalBody3D }))
);

const MetastaticHeatmap = lazy(() =>
  import('@/components/MetastaticHeatmap').then((mod) => ({ default: mod.MetastaticHeatmap }))
);

const INITIAL_PROFILE: PatientProfile = {
  age: 65,
  sex: 'Male',
  primary_site: 'Lung',
  oncotree_code: 'LUAD',
  mutations: { TP53: 1, KRAS: 1 },
};

export default function Home() {
  const [profile, setProfile] = useState<PatientProfile>(INITIAL_PROFILE);
  const [prediction, setPrediction] = useState<PredictionSnapshot | null>(null);
  const [risks, setRisks] = useState<Record<string, number>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<'3d' | '2d'>('3d');
  const [selectedOrgan, setSelectedOrgan] = useState('');
  const [selectedTreatment, setSelectedTreatment] = useState<TreatmentPresetId>(
    TIMELINE_TREATMENT_PRESETS[0].id
  );
  const [selectedMonth, setSelectedMonth] = useState(0);
  const [timeline, setTimeline] = useState<TimelinePoint[]>([]);
  const [timelineSource, setTimelineSource] = useState<'local' | 'backend'>('local');

  useEffect(() => {
    async function runSimulation() {
      try {
        setLoading(true);
        setError(null);
        const result = await simulateRisk(profile);
        setPrediction(result);
        setRisks(result.risk_scores);
      } catch (err: unknown) {
        const message = err instanceof Error ? err.message : 'Failed to connect to backend';
        setError(message);
        setPrediction(null);
      } finally {
        setLoading(false);
      }
    }

    const timer = setTimeout(runSimulation, 300);
    return () => clearTimeout(timer);
  }, [profile]);

  const organOptions = useMemo(() => {
    return Object.keys(risks)
      .sort((a, b) => getAnatomyMeta2D(a).label.localeCompare(getAnatomyMeta2D(b).label))
      .map((key) => ({
        key,
        label: getAnatomyMeta2D(key).label,
      }));
  }, [risks]);

  useEffect(() => {
    if (!organOptions.length) {
      setSelectedOrgan('');
      setSelectedMonth(0);
      return;
    }
    if (!organOptions.some((organ) => organ.key === selectedOrgan)) {
      setSelectedOrgan(organOptions[0].key);
      setSelectedMonth(0);
    }
  }, [organOptions, selectedOrgan]);

  const baselineRisk = useMemo(() => {
    if (!selectedOrgan) {
      return null;
    }
    const value = risks[selectedOrgan];
    if (!Number.isFinite(value)) {
      return null;
    }
    return Math.min(Math.max(value, 0), 1);
  }, [risks, selectedOrgan]);

  useEffect(() => {
    if (!selectedOrgan || baselineRisk === null) {
      setTimeline([]);
      setTimelineSource('local');
      return;
    }

    const localProjection = generateLocalTimelineProjection({
      organKey: selectedOrgan,
      baselineRisk,
      treatment: selectedTreatment,
      months: DEFAULT_TIMELINE_MONTHS,
    });

    setTimeline(localProjection);
    setTimelineSource('local');

    const controller = new AbortController();
    requestPredictTimeline(
      baselineRisk,
      selectedTreatment,
      DEFAULT_TIMELINE_MONTHS,
      controller.signal
    )
      .then((backendTimeline) => {
        if (controller.signal.aborted || !backendTimeline.length) {
          return;
        }
        setTimeline(backendTimeline);
        setTimelineSource('backend');
      })
      .catch((err: unknown) => {
        if (controller.signal.aborted) {
          return;
        }
        if (err instanceof Error && err.name === 'AbortError') {
          return;
        }
      });

    return () => controller.abort();
  }, [baselineRisk, selectedOrgan, selectedTreatment]);

  const maxTimelineMonth = timeline.length
    ? timeline[timeline.length - 1].month
    : DEFAULT_TIMELINE_MONTHS;

  useEffect(() => {
    if (selectedMonth > maxTimelineMonth) {
      setSelectedMonth(maxTimelineMonth);
    }
  }, [maxTimelineMonth, selectedMonth]);

  const activeTimelinePoint = useMemo(
    () => getTimelinePointAtMonth(timeline, selectedMonth),
    [timeline, selectedMonth]
  );

  const displayedRisks = useMemo(() => {
    if (!selectedOrgan || baselineRisk === null || !activeTimelinePoint) {
      return risks;
    }
    return {
      ...risks,
      [selectedOrgan]: activeTimelinePoint.risk,
    };
  }, [activeTimelinePoint, baselineRisk, risks, selectedOrgan]);

  return (
    <main className="flex h-screen bg-[#030712] text-slate-100 overflow-hidden">
      <aside className="w-80 h-full flex-shrink-0">
        <GenomicLab profile={profile} onChange={setProfile} />
      </aside>

      <section className="flex-1 relative flex flex-col">
        <div className="absolute top-5 left-6 right-6 z-20 flex justify-between items-start pointer-events-none">
          <div className="bg-[#0f172a]/60 backdrop-blur-xl p-4 rounded-xl border border-slate-800/40 pointer-events-auto shadow-xl">
            <h1 className="text-lg font-bold tracking-tight mb-0.5 flex items-center gap-2">
              Anatomical Risk Nexus
              <span className="text-[9px] bg-blue-500/15 text-blue-400 px-2 py-0.5 rounded-md border border-blue-500/20 uppercase font-semibold tracking-wider">
                v5.0
              </span>
              {viewMode === '3d' && (
                <span className="text-[9px] bg-purple-500/15 text-purple-400 px-2 py-0.5 rounded-md border border-purple-500/20 uppercase font-semibold tracking-wider">
                  3D
                </span>
              )}
            </h1>
            <p className="text-[11px] text-slate-400">
              Simulating{' '}
              <span className="text-blue-400 font-mono font-medium">{profile.primary_site}</span>{' '}
              metastasis for{' '}
              <span className="text-emerald-400 font-mono font-medium italic">
                {profile.oncotree_code}
              </span>
            </p>
          </div>


        </div>

        <div className="flex-1 relative">
          <Suspense
            fallback={
              <div className="w-full h-full bg-[#030712] flex items-center justify-center">
                <div className="flex flex-col items-center gap-3">
                  <div className="relative">
                    <div className="w-10 h-10 border-[3px] border-blue-500/15 rounded-full" />
                    <div className="absolute inset-0 w-10 h-10 border-[3px] border-transparent border-t-blue-500 rounded-full animate-spin" />
                  </div>
                  <span className="text-[10px] font-mono text-blue-400/80 animate-pulse tracking-wider uppercase">
                    Loading {viewMode === '3d' ? '3D renderer' : 'visualization'}...
                  </span>
                </div>
              </div>
            }
          >
            {viewMode === '3d' ? (
              <AnatomicalBody3D risks={displayedRisks} />
            ) : (
              <MetastaticHeatmap risks={displayedRisks} />
            )}
          </Suspense>

          {loading && (
            <div className="absolute inset-0 bg-[#030712]/40 backdrop-blur-[2px] z-30 flex items-center justify-center">
              <div className="flex flex-col items-center gap-3">
                <div className="relative">
                  <div className="w-10 h-10 border-[3px] border-blue-500/15 rounded-full" />
                  <div className="absolute inset-0 w-10 h-10 border-[3px] border-transparent border-t-blue-500 rounded-full animate-spin" />
                </div>
                <span className="text-[10px] font-mono text-blue-400/80 animate-pulse tracking-wider uppercase">
                  Computing risks...
                </span>
              </div>
            </div>
          )}

          {error && (
            <div className="absolute top-6 left-1/2 -translate-x-1/2 z-50 bg-red-950/80 backdrop-blur-xl p-4 rounded-xl border border-red-500/30 flex items-start gap-3 shadow-2xl">
              <AlertCircle className="text-red-400 flex-shrink-0 mt-0.5" size={16} />
              <div className="space-y-1">
                <h4 className="text-xs font-semibold text-red-200">Connection Error</h4>
                <p className="text-[10px] text-red-300/80 leading-relaxed">
                  FastAPI server (port 8000) unreachable. Simulation suspended.
                </p>
              </div>
            </div>
          )}
        </div>

        <TimelinePanel
          organOptions={organOptions}
          selectedOrgan={selectedOrgan}
          selectedTreatment={selectedTreatment}
          selectedMonth={selectedMonth}
          timeline={timeline}
          timelineSource={timelineSource}
          baselineRisk={baselineRisk}
          prediction={prediction}
          onOrganChange={setSelectedOrgan}
          onTreatmentChange={setSelectedTreatment}
          onMonthChange={setSelectedMonth}
        />

        <div className="h-14 bg-[#0a0f1a]/80 backdrop-blur-sm border-t border-slate-800/40 flex items-center px-8 justify-between z-20">
          <div className="flex gap-6">
            {[
              { color: 'bg-red-500', shadow: 'shadow-red-500/40', label: 'High Risk (≥70%)' },
              { color: 'bg-amber-500', shadow: 'shadow-amber-500/40', label: 'Medium (40-70%)' },
              { color: 'bg-emerald-500', shadow: 'shadow-emerald-500/40', label: 'Standard (≤40%)' },
            ].map(({ color, shadow, label }) => (
              <div key={label} className="flex items-center gap-2">
                <div className={`w-2.5 h-2.5 rounded-full ${color} shadow-sm ${shadow}`} />
                <span className="text-[9px] text-slate-500 uppercase font-semibold tracking-wider">
                  {label}
                </span>
              </div>
            ))}
          </div>
          <div className="text-[9px] text-slate-600 font-mono">Seeds+Soil Metastatic Affinity Model</div>
        </div>
      </section>
    </main>
  );
}
