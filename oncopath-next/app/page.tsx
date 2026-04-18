'use client';

import React, { useState, useEffect, lazy, Suspense, useMemo } from 'react';
import { GenomicLab } from '@/components/GenomicLab';
import {
  PatientProfile,
  simulateTemporalRisk,
  TemporalMode,
  TemporalSimulationPoint,
  TreatmentType,
} from '@/lib/api';
import { AlertCircle, Box, Layout, Pause, Play } from 'lucide-react';

const AnatomicalBody3D = lazy(() =>
  import('@/components/AnatomicalBody3D').then(mod => ({ default: mod.AnatomicalBody3D }))
);

const MetastaticHeatmap = lazy(() =>
  import('@/components/MetastaticHeatmap').then(mod => ({ default: mod.MetastaticHeatmap }))
);

const INITIAL_PROFILE: PatientProfile = {
  age: 65,
  sex: "Male",
  primary_site: "Lung",
  oncotree_code: "LUAD",
  mutations: { "TP53": 1, "KRAS": 1 }
};

const TREATMENT_OPTIONS: TreatmentType[] = ["CHEMOTHERAPY", "IMMUNOTHERAPY", "ORAL_DRUG"];

function getErrorMessage(error: unknown) {
  if (error instanceof Error) {
    return error.message;
  }
  return "Failed to connect to backend";
}

export default function Home() {
  const [profile, setProfile] = useState<PatientProfile>(INITIAL_PROFILE);
  const [risks, setRisks] = useState<{ [key: string]: number }>({});
  const [timelineData, setTimelineData] = useState<TemporalSimulationPoint[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<'3d' | '2d'>('3d');
  const [progressionMode, setProgressionMode] = useState<TemporalMode>('untreated');
  const [treatment, setTreatment] = useState<TreatmentType>('CHEMOTHERAPY');
  const [months, setMonths] = useState(24);
  const [currentMonth, setCurrentMonth] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [visualLift, setVisualLift] = useState(0);
  const [hasVisualData, setHasVisualData] = useState(false);

  useEffect(() => {
    const runSimulation = async () => {
      try {
        setLoading(true);
        setError(null);
        const result = await simulateTemporalRisk(profile, {
          mode: progressionMode,
          treatment,
          months,
        });
        setTimelineData(result.timeline);
        setCurrentMonth(0);
        setRisks(result.baseline_risks);
        setVisualLift(result.visual_lift);
        setHasVisualData(result.has_visual_data);
      } catch (err: unknown) {
        setError(getErrorMessage(err));
        setTimelineData([]);
        setRisks({});
      } finally {
        setLoading(false);
        setIsPlaying(false);
      }
    };

    const timer = setTimeout(runSimulation, 300);
    return () => clearTimeout(timer);
  }, [profile, progressionMode, treatment, months]);

  useEffect(() => {
    if (timelineData.length === 0) return;
    const current = timelineData.find((point) => point.month === currentMonth) ?? timelineData[timelineData.length - 1];
    setRisks(current.risks);
  }, [currentMonth, timelineData]);

  useEffect(() => {
    if (!isPlaying) return;
    const timer = setInterval(() => {
      setCurrentMonth((prev) => {
        if (prev >= months) {
          setIsPlaying(false);
          return prev;
        }
        return prev + 1;
      });
    }, 900);

    return () => clearInterval(timer);
  }, [isPlaying, months]);

  useEffect(() => {
    if (currentMonth > months) {
      setCurrentMonth(months);
      setIsPlaying(false);
    }
  }, [currentMonth, months]);

  const currentTimelinePoint = useMemo(() => {
    if (timelineData.length === 0) return null;
    return timelineData.find((point) => point.month === currentMonth) ?? timelineData[timelineData.length - 1];
  }, [timelineData, currentMonth]);

  const meanRiskDelta = useMemo(() => {
    if (timelineData.length === 0) return 0;
    const baseline = timelineData[0]?.mean_risk ?? 0;
    const now = currentTimelinePoint?.mean_risk ?? baseline;
    return now - baseline;
  }, [timelineData, currentTimelinePoint]);

  const togglePlay = () => {
    if (timelineData.length === 0) return;
    if (currentMonth >= months) {
      setCurrentMonth(0);
    }
    setIsPlaying((prev) => !prev);
  };

  return (
    <main className="flex h-screen bg-[#030712] text-slate-100 overflow-hidden">
      {/* Sidebar */}
      <aside className="w-80 h-full flex-shrink-0">
        <GenomicLab profile={profile} onChange={setProfile} />
      </aside>

      {/* Main Viewport */}
      <section className="flex-1 relative flex flex-col">
        {/* Header */}
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
              <span className="text-[9px] bg-slate-700/40 text-slate-300 px-2 py-0.5 rounded-md border border-slate-600/50 uppercase font-semibold tracking-wider">
                Month {currentMonth}
              </span>
              <span className={`text-[9px] px-2 py-0.5 rounded-md border uppercase font-semibold tracking-wider ${
                progressionMode === 'untreated'
                  ? 'bg-amber-500/15 text-amber-300 border-amber-500/30'
                  : 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30'
              }`}>
                {progressionMode === 'untreated' ? 'Untreated' : treatment.replace('_', ' ')}
              </span>
            </h1>
            <p className="text-[11px] text-slate-400">
              Simulating{' '}
              <span className="text-blue-400 font-mono font-medium">{profile.primary_site}</span>{' '}
              metastasis for{' '}
              <span className="text-emerald-400 font-mono font-medium italic">{profile.oncotree_code}</span>
            </p>
            <p className="text-[10px] text-slate-500 mt-1">
              Mean trajectory shift: <span className={meanRiskDelta >= 0 ? 'text-red-400' : 'text-emerald-400'}>
                {meanRiskDelta >= 0 ? '+' : ''}{(meanRiskDelta * 100).toFixed(1)}%
              </span>
            </p>
          </div>

          <div className="flex gap-3 pointer-events-auto items-start">
            {/* View Mode Toggle */}
            <button
              onClick={() => setViewMode(viewMode === '3d' ? '2d' : '3d')}
              className={`p-2.5 backdrop-blur-xl rounded-lg border transition-all shadow-lg flex items-center gap-2 ${
                viewMode === '3d'
                  ? 'bg-purple-500/15 border-purple-500/30 hover:bg-purple-500/25'
                  : 'bg-[#0f172a]/60 border-slate-800/40 hover:bg-slate-800/60 hover:border-slate-700/60'
              }`}
              title={`Switch to ${viewMode === '3d' ? '2D' : '3D'} view`}
            >
              {viewMode === '3d' ? (
                <>
                  <Box size={14} className="text-purple-400" />
                  <span className="text-[10px] text-purple-400 font-semibold uppercase tracking-wider">3D</span>
                </>
              ) : (
                <>
                  <Layout size={14} className="text-slate-400" />
                  <span className="text-[10px] text-slate-400 font-semibold uppercase tracking-wider">2D</span>
                </>
              )}
            </button>

            <div className="bg-[#0f172a]/60 backdrop-blur-xl rounded-xl border border-slate-800/40 p-3 shadow-xl w-64">
              <div className="text-[10px] text-slate-400 uppercase tracking-wider font-semibold mb-2">Progression Mode</div>
              <div className="grid grid-cols-2 gap-1.5 mb-2">
                <button
                  onClick={() => setProgressionMode('untreated')}
                  className={`px-2 py-1.5 rounded-md text-[10px] font-semibold uppercase tracking-wider transition-all ${
                    progressionMode === 'untreated'
                      ? 'bg-amber-500/20 text-amber-300 border border-amber-500/30'
                      : 'bg-slate-800/50 text-slate-400 border border-slate-700/50 hover:text-slate-200'
                  }`}
                >
                  Untreated
                </button>
                <button
                  onClick={() => setProgressionMode('treatment_adjusted')}
                  className={`px-2 py-1.5 rounded-md text-[10px] font-semibold uppercase tracking-wider transition-all ${
                    progressionMode === 'treatment_adjusted'
                      ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                      : 'bg-slate-800/50 text-slate-400 border border-slate-700/50 hover:text-slate-200'
                  }`}
                >
                  Treatment
                </button>
              </div>

              {progressionMode === 'treatment_adjusted' && (
                <select
                  value={treatment}
                  onChange={(event) => setTreatment(event.target.value as TreatmentType)}
                  className="w-full mb-2 bg-[#0b1222] border border-slate-700/60 text-slate-100 text-[11px] rounded-md p-2"
                >
                  {TREATMENT_OPTIONS.map((option) => (
                    <option key={option} value={option}>
                      {option.replace('_', ' ')}
                    </option>
                  ))}
                </select>
              )}

              <div className="flex items-center justify-between mb-1">
                <span className="text-[10px] text-slate-500 uppercase tracking-wider">Horizon</span>
                <span className="text-[10px] text-blue-400 font-mono">{months} mo</span>
              </div>
              <input
                type="range"
                min={6}
                max={36}
                step={1}
                value={months}
                onChange={(event) => setMonths(parseInt(event.target.value, 10))}
                className="w-full"
              />
            </div>
          </div>
        </div>

        {/* Visualization */}
        <div className="flex-1 relative">
          <Suspense fallback={
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
          }>
            {viewMode === '3d' ? (
              <AnatomicalBody3D risks={risks} />
            ) : (
              <MetastaticHeatmap risks={risks} />
            )}
          </Suspense>

          {loading && (
            <div className="absolute inset-0 bg-[#030712]/40 backdrop-blur-[2px] z-30 flex items-center justify-center">
              <div className="flex flex-col items-center gap-3">
                <div className="relative">
                  <div className="w-10 h-10 border-[3px] border-blue-500/15 rounded-full" />
                  <div className="absolute inset-0 w-10 h-10 border-[3px] border-transparent border-t-blue-500 rounded-full animate-spin" />
                </div>
                <span className="text-[10px] font-mono text-blue-400/80 animate-pulse tracking-wider uppercase">Computing risks...</span>
              </div>
            </div>
          )}

          {error && (
            <div className="absolute bottom-6 right-6 z-40 bg-red-950/50 backdrop-blur-xl p-4 rounded-xl border border-red-500/20 flex items-start gap-3 shadow-xl">
              <AlertCircle className="text-red-400 flex-shrink-0 mt-0.5" size={16} />
              <div className="space-y-1">
                <h4 className="text-xs font-semibold text-red-200">Connection Error</h4>
                <p className="text-[10px] text-red-300/80 leading-relaxed">
                  {error || "FastAPI server (port 8000) unreachable. Simulation suspended."}
                </p>
              </div>
            </div>
          )}
        </div>

        {/* Legend Bar */}
        <div className="h-14 bg-[#0a0f1a]/80 backdrop-blur-sm border-t border-slate-800/40 flex items-center px-8 justify-between z-20">
          <div className="flex gap-6">
            {[
              { color: 'bg-red-500', shadow: 'shadow-red-500/40', label: 'High Risk (≥70%)' },
              { color: 'bg-amber-500', shadow: 'shadow-amber-500/40', label: 'Medium (40-70%)' },
              { color: 'bg-emerald-500', shadow: 'shadow-emerald-500/40', label: 'Standard (≤40%)' },
            ].map(({ color, shadow, label }) => (
              <div key={label} className="flex items-center gap-2">
                <div className={`w-2.5 h-2.5 rounded-full ${color} shadow-sm ${shadow}`} />
                <span className="text-[9px] text-slate-500 uppercase font-semibold tracking-wider">{label}</span>
              </div>
            ))}
          </div>
          <div className="flex items-center gap-3">
            <button
              onClick={togglePlay}
              disabled={timelineData.length === 0}
              className="p-2 bg-[#0f172a]/70 border border-slate-700/50 rounded-lg disabled:opacity-40 disabled:cursor-not-allowed"
              title={isPlaying ? 'Pause playback' : 'Play progression'}
            >
              {isPlaying ? <Pause size={12} className="text-blue-300" /> : <Play size={12} className="text-blue-300" />}
            </button>
            <input
              type="range"
              min={0}
              max={months}
              step={1}
              value={currentMonth}
              onChange={(event) => setCurrentMonth(parseInt(event.target.value, 10))}
              className="w-44"
            />
            <div className="text-[9px] text-slate-500 font-mono w-28 text-right">
              {currentTimelinePoint ? `Peak ${(currentTimelinePoint.max_risk * 100).toFixed(1)}%` : 'No timeline'}
            </div>
            <div className="text-[9px] text-slate-600 font-mono">
              Lift {hasVisualData ? `${visualLift >= 0 ? '+' : ''}${(visualLift * 100).toFixed(2)}%` : 'N/A'}
            </div>
          </div>
        </div>
      </section>
    </main>
  );
}
