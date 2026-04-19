'use client';

import React, { lazy, Suspense, useCallback, useEffect, useMemo, useState } from 'react';
import { AlertCircle, Activity } from 'lucide-react';
import { OrganPopover, type OrganPopoverData } from '@/components/ui/OrganPopover';
import { GenomicDrawer } from '@/components/ui/GenomicDrawer';
import { TimelineDrawer } from '@/components/ui/TimelineDrawer';
import { ANATOMY_MAPPING_3D } from '@/lib/anatomy3d';
import { applyTimelineCommand, type TimelineCommandResult } from '@/lib/timelineCommands';
import {
  PatientProfile,
  simulateRisk,
  requestPredictTimeline,
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
import {
  flushTimelineDropoff,
  startProductMetricsSession,
  trackTimelineControlInteraction,
  updateTimelineDropoffCandidate,
} from '@/lib/productMetrics';

const AnatomicalBody3D = lazy(() =>
  import('@/components/AnatomicalBody3D').then((m) => ({ default: m.AnatomicalBody3D }))
);
const TumorMicroScene = lazy(() =>
  import('@/components/TumorMicroScene').then((m) => ({ default: m.TumorMicroScene }))
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
type SceneMode = 'macro' | 'micro';
const DEFAULT_ORGAN_FALLBACK = 'DMETS_DX_LIVER';
const ORGAN_RISK_FALLBACK: Record<string, number> = {
  DMETS_DX_LIVER: 0.64,
  DMETS_DX_LUNG: 0.58,
  DMETS_DX_BONE: 0.41,
  DMETS_DX_CNS_BRAIN: 0.29,
  SYS_HEART: 0.17,
};

function fallbackOrganLabel(organId: string): string {
  const sanitized = organId
    .replace(/^DMETS_DX_/, '')
    .replace(/^SYS_/, '')
    .toLowerCase()
    .replace(/_/g, ' ')
    .trim();

  if (!sanitized) {
    return organId;
  }

  return sanitized.replace(/\b\w/g, (char) => char.toUpperCase());
}

function fallbackRiskForOrgan(organId: string): number {
  const mapped = ORGAN_RISK_FALLBACK[organId];
  if (Number.isFinite(mapped)) {
    return mapped;
  }

  let hash = 17;
  for (const char of organId) {
    hash = (hash * 31 + char.charCodeAt(0)) % 997;
  }
  return 0.16 + ((hash % 36) / 100);
}

interface TimelineBridgeApi {
  applyCommand: (command: unknown) => TimelineCommandResult;
  getState: () => {
    selectedOrgan: string;
    selectedTreatment: TreatmentPresetId;
    selectedMonth: number;
    isPlaying: boolean;
    actionLog: string[];
  };
}

export function BodyDashboard() {
  const [sceneMode, setSceneMode] = useState<SceneMode>('macro');
  const [profile, setProfile]           = useState<PatientProfile>(DEFAULT_PROFILE);
  const [simulationProfile, setSimulationProfile] = useState<PatientProfile>(DEFAULT_PROFILE);
  const [simulationImage, setSimulationImage]     = useState<string | undefined>(undefined);
  const [risks, setRisks]               = useState<Record<string, number>>({});
  const [prediction, setPrediction]     = useState<PredictionSnapshot | null>(null);
  const [loading, setLoading]           = useState(false);
  const [error, setError]               = useState<string | null>(null);

  // Popover state
  const [popover, setPopover] = useState<OrganPopoverData | null>(null);

  // 12-month projection for the selected organ
  const [proj12m, setProj12m] = useState<number | undefined>(undefined);
  const [selectedOrgan, setSelectedOrgan] = useState<string>('');
  const [selectedTreatment, setSelectedTreatment] = useState<TreatmentPresetId>(DEFAULT_TREATMENT);
  const [selectedMonth, setSelectedMonth] = useState<number>(0);
  const [timelineData, setTimelineData] = useState<TimelinePoint[]>([]);
  const [timelineSource, setTimelineSource] = useState<'local' | 'backend'>('local');
  const [timelinePending, setTimelinePending] = useState(false);
  const [timelineErrorMessage, setTimelineErrorMessage] = useState<string | null>(null);
  const [organLabels, setOrganLabels] = useState<Record<string, string>>({});
  const [copilotActionLog, setCopilotActionLog] = useState<string[]>([]);
  const [isTimelinePlaying, setIsTimelinePlaying] = useState(false);
  const [timelinePlaybackSpeed, setTimelinePlaybackSpeed] = useState(1);
  const [timelinePlaybackCycles, setTimelinePlaybackCycles] = useState<number | null>(null);

  const rememberOrganLabel = useCallback((organId: string, label?: string) => {
    const normalizedLabel = label?.trim();
    if (!normalizedLabel) {
      return;
    }

    setOrganLabels((prev) => (prev[organId] === normalizedLabel ? prev : { ...prev, [organId]: normalizedLabel }));
  }, []);

  const resolveOrganLabel = useCallback(
    (organId: string) =>
      organLabels[organId] ?? ANATOMY_MAPPING_3D[organId]?.label ?? fallbackOrganLabel(organId),
    [organLabels]
  );

  const popoverOrganId = popover?.organId ?? null;

  const organOptions = useMemo(() => {
    const keys = new Set<string>(Object.keys(risks));
    if (selectedOrgan) {
      keys.add(selectedOrgan);
    }
    if (popoverOrganId) {
      keys.add(popoverOrganId);
    }

    return Array.from(keys)
      .filter((key) => key.length > 0)
      .map((key) => ({ key, label: resolveOrganLabel(key) }))
      .sort((a, b) => a.label.localeCompare(b.label));
  }, [popoverOrganId, resolveOrganLabel, risks, selectedOrgan]);

  const selectedBaselineRisk = useMemo(() => {
    const baseline = risks[selectedOrgan];
    if (Number.isFinite(baseline)) {
      return baseline;
    }
    if (!selectedOrgan) {
      return null;
    }
    return fallbackRiskForOrgan(selectedOrgan);
  }, [risks, selectedOrgan]);
  const selectedTreatmentLabel = useMemo(
    () => TIMELINE_TREATMENT_PRESETS.find((preset) => preset.id === selectedTreatment)?.label ?? selectedTreatment,
    [selectedTreatment]
  );
  const selectedOrganLabel = useMemo(
    () => (selectedOrgan ? resolveOrganLabel(selectedOrgan) : 'Selected organ'),
    [resolveOrganLabel, selectedOrgan]
  );
  const activeTimelinePoint = useMemo(
    () => getTimelinePointAtMonth(timelineData, selectedMonth),
    [timelineData, selectedMonth]
  );
  const activeMicroRisk = useMemo(
    () => activeTimelinePoint?.risk ?? selectedBaselineRisk,
    [activeTimelinePoint, selectedBaselineRisk]
  );
  const microSignals = useMemo(() => {
    const risk = Number.isFinite(activeMicroRisk) ? Math.min(Math.max(activeMicroRisk ?? 0, 0), 1) : 0;
    return {
      riskPercent: Math.round(risk * 100),
      tumorScale: (0.75 + risk * 1.35).toFixed(2),
      flowBand: risk >= 0.6 ? 'Fast' : risk >= 0.3 ? 'Medium' : 'Calm',
      glowBand: risk >= 0.6 ? 'Bright' : risk >= 0.3 ? 'Steady' : 'Soft',
    };
  }, [activeMicroRisk]);

  const appendActionLog = useCallback((entry: string) => {
    setCopilotActionLog((prev) => [entry, ...prev].slice(0, 25));
  }, []);

  useEffect(() => {
    startProductMetricsSession();
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'hidden') {
        flushTimelineDropoff('visibility_hidden');
      }
    };
    const handleBeforeUnload = () => {
      flushTimelineDropoff('session_end');
    };
    document.addEventListener('visibilitychange', handleVisibilityChange);
    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      window.removeEventListener('beforeunload', handleBeforeUnload);
      flushTimelineDropoff('component_unmount');
    };
  }, []);

  useEffect(() => {
    if (selectedOrgan) {
      return;
    }

    const firstRiskOrgan = Object.keys(risks).find((key) => Number.isFinite(risks[key]));
    if (firstRiskOrgan) {
      setSelectedOrgan(firstRiskOrgan);
      return;
    }
    setSelectedOrgan(DEFAULT_ORGAN_FALLBACK);
  }, [risks, selectedOrgan]);

  // ── Simulation ─────────────────────────────────────────────────────────── //
  useEffect(() => {
    const ctrl = new AbortController();
    let cancelled = false;
    (async () => {
      setLoading(true); setError(null);
      try {
        const result = await simulateRisk(simulationProfile, { image: simulationImage });
        if (!cancelled) { setPrediction(result); setRisks(result.risk_scores); }
      } catch (e) {
        if (!cancelled) setError(e instanceof Error ? e.message : 'API unreachable');
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; ctrl.abort(); };
  }, [simulationProfile, simulationImage]);

  // ── 12-month projection for hovered organ ─────────────────────────────── //
  useEffect(() => {
    if (!popoverOrganId) { setProj12m(undefined); return; }
    const baseline = risks[popoverOrganId];
    if (!Number.isFinite(baseline)) { setProj12m(undefined); return; }

    // Optimistic local estimate immediately
    const local = generateLocalTimelineProjection({
      organKey: popoverOrganId, baselineRisk: baseline,
      treatment: selectedTreatment, months: 12,
    });
    const at12 = local.find(p => p.month === 12) ?? local[local.length - 1];
    setProj12m(at12?.risk);

    // Try to fetch from backend too
    const ctrl = new AbortController();
    let cancelled = false;
    requestPredictTimeline(baseline, selectedTreatment, DEFAULT_TIMELINE_MONTHS, ctrl.signal)
      .then(pts => {
        if (cancelled || ctrl.signal.aborted) {
          return;
        }
        const at12b = pts.find(p => p.month >= 12) ?? pts[pts.length - 1];
        if (at12b) setProj12m(at12b.risk);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
      ctrl.abort();
    };
  }, [popoverOrganId, risks, selectedTreatment]);

  useEffect(() => {
    if (sceneMode !== 'micro') {
      return;
    }
    setPopover(null);
  }, [sceneMode]);

  useEffect(() => {
    if (!selectedOrgan || selectedBaselineRisk === null) {
      setTimelineData([]);
      setTimelineSource('local');
      setTimelinePending(false);
      setTimelineErrorMessage(null);
      setSelectedMonth(0);
      return;
    }

    const localTimeline = generateLocalTimelineProjection({
      organKey: selectedOrgan,
      baselineRisk: selectedBaselineRisk,
      treatment: selectedTreatment,
      months: DEFAULT_TIMELINE_MONTHS,
    });
    const localMaxMonth = localTimeline[localTimeline.length - 1]?.month ?? DEFAULT_TIMELINE_MONTHS;
    setTimelineData(localTimeline);
    setTimelineSource('local');
    setTimelinePending(true);
    setTimelineErrorMessage(null);
    setSelectedMonth((prev) => Math.min(Math.max(prev, 0), localMaxMonth));

    const ctrl = new AbortController();
    let cancelled = false;

    requestPredictTimeline(selectedBaselineRisk, selectedTreatment, DEFAULT_TIMELINE_MONTHS, ctrl.signal)
      .then((points) => {
        if (cancelled || ctrl.signal.aborted || !points.length) {
          return;
        }
        const backendMaxMonth = points[points.length - 1].month;
        setTimelineData(points);
        setTimelineSource('backend');
        setTimelineErrorMessage(null);
        setSelectedMonth((prev) => Math.min(Math.max(prev, 0), backendMaxMonth));
      })
      .catch((err) => {
        if (cancelled || ctrl.signal.aborted) {
          return;
        }
        const reason = err instanceof Error ? err.message : 'Backend timeline unavailable';
        setTimelineSource('local');
        setTimelineErrorMessage(
          `Live timeline fetch failed (${reason}). Keeping local projection so exploration can continue.`
        );
      })
      .finally(() => {
        if (!cancelled) {
          setTimelinePending(false);
        }
      });

    return () => {
      cancelled = true;
      ctrl.abort();
      setTimelinePending(false);
    };
  }, [selectedBaselineRisk, selectedOrgan, selectedTreatment]);

  useEffect(() => {
    if (!isTimelinePlaying || timelineData.length < 2) {
      return;
    }

    const maxMonth = timelineData[timelineData.length - 1]?.month ?? 0;
    if (maxMonth <= 0) {
      return;
    }

    const safeSpeed = Math.min(Math.max(timelinePlaybackSpeed, 0.1), 4);
    const delayMs = Math.max(220, Math.round(900 / safeSpeed));

    const interval = window.setInterval(() => {
      setSelectedMonth((currentMonth) => {
        if (currentMonth < maxMonth) {
          return currentMonth + 1;
        }

        if (timelinePlaybackCycles === null) {
          return 0;
        }

        if (timelinePlaybackCycles <= 1) {
          setIsTimelinePlaying(false);
          setTimelinePlaybackCycles(null);
          return maxMonth;
        }

        setTimelinePlaybackCycles((currentCycles) =>
          currentCycles === null ? null : currentCycles - 1
        );
        return 0;
      });
    }, delayMs);

    return () => {
      window.clearInterval(interval);
    };
  }, [isTimelinePlaying, timelineData, timelinePlaybackCycles, timelinePlaybackSpeed]);

  useEffect(() => {
    setIsTimelinePlaying(false);
    setTimelinePlaybackCycles(null);
  }, [selectedOrgan, selectedTreatment]);

  // ── Organ click handler ────────────────────────────────────────────────── //
  const handleOrganSelect = useCallback((organId: string, name: string, x: number, y: number) => {
    rememberOrganLabel(organId, name);
    setSelectedOrgan(organId);
    setSelectedMonth(0);
    setPopover(prev =>
      prev?.organId === organId ? null : { organId, name, clientX: x, clientY: y }
    );
  }, [rememberOrganLabel]);

  const handleTimelineOrganChange = useCallback((organId: string, source: 'manual' | 'assistant' = 'manual') => {
    setSelectedOrgan(organId);
    setSelectedMonth(0);
    setPopover((prev) => {
      if (!prev) {
        return prev;
      }
      return {
        ...prev,
        organId,
        name: resolveOrganLabel(organId),
      };
    });
    trackTimelineControlInteraction({
      action: source === 'assistant' ? 'assistant_focus_organ' : 'organ_change',
      month: 0,
      treatment: selectedTreatment,
      organ: organId,
      isPlaying: false,
    });
  }, [resolveOrganLabel, selectedTreatment]);

  const handleTimelineTreatmentChange = useCallback(
    (treatment: TreatmentPresetId, source: 'manual' | 'assistant' = 'manual') => {
    setSelectedTreatment(treatment);
    setSelectedMonth(0);
      trackTimelineControlInteraction({
        action: source === 'assistant' ? 'assistant_set_treatment' : 'treatment_change',
        month: 0,
        treatment,
        organ: selectedOrgan || DEFAULT_ORGAN_FALLBACK,
        isPlaying: false,
      });
    },
    [selectedOrgan]
  );

  const handleTimelineMonthChange = useCallback(
    (month: number, source: 'manual' | 'assistant' = 'manual') => {
      setSelectedMonth(month);
      trackTimelineControlInteraction({
        action: source === 'assistant' ? 'assistant_set_month' : 'month_scrub',
        month,
        treatment: selectedTreatment,
        organ: selectedOrgan || DEFAULT_ORGAN_FALLBACK,
        isPlaying: isTimelinePlaying,
      });
    },
    [isTimelinePlaying, selectedOrgan, selectedTreatment]
  );

  const handleTimelinePlay = useCallback(() => {
    setIsTimelinePlaying(true);
    setTimelinePlaybackCycles(null);
    trackTimelineControlInteraction({
      action: 'play',
      month: selectedMonth,
      treatment: selectedTreatment,
      organ: selectedOrgan || DEFAULT_ORGAN_FALLBACK,
      isPlaying: true,
    });
  }, [selectedMonth, selectedOrgan, selectedTreatment]);

  const handleTimelinePause = useCallback(() => {
    setIsTimelinePlaying(false);
    setTimelinePlaybackCycles(null);
    trackTimelineControlInteraction({
      action: 'pause',
      month: selectedMonth,
      treatment: selectedTreatment,
      organ: selectedOrgan || DEFAULT_ORGAN_FALLBACK,
      isPlaying: false,
    });
  }, [selectedMonth, selectedOrgan, selectedTreatment]);

  const handleTimelineReplay = useCallback(() => {
    setSelectedMonth(0);
    setIsTimelinePlaying(true);
    setTimelinePlaybackCycles(null);
    trackTimelineControlInteraction({
      action: 'replay',
      month: 0,
      treatment: selectedTreatment,
      organ: selectedOrgan || DEFAULT_ORGAN_FALLBACK,
      isPlaying: true,
    });
  }, [selectedOrgan, selectedTreatment]);

  const handleTimelineCommand = useCallback(
    (command: unknown): TimelineCommandResult => {
      const timelineMaxMonth = timelineData[timelineData.length - 1]?.month ?? DEFAULT_TIMELINE_MONTHS;
      return applyTimelineCommand(command, {
        monthMin: 0,
        monthMax: timelineMaxMonth,
        organOptions,
        setTreatment: (treatment) => handleTimelineTreatmentChange(treatment, 'assistant'),
        setMonth: (month) => handleTimelineMonthChange(month, 'assistant'),
        focusOrgan: (organId) => handleTimelineOrganChange(organId, 'assistant'),
        setPlayback: ({ playing, speed, cycleCount }) => {
          setIsTimelinePlaying(playing);
          if (typeof speed === 'number') {
            setTimelinePlaybackSpeed(speed);
          }
          if (cycleCount !== undefined) {
            setTimelinePlaybackCycles(cycleCount ?? null);
          }
          if (!playing) {
            setTimelinePlaybackCycles(null);
          }
          trackTimelineControlInteraction({
            action: playing ? 'assistant_play' : 'assistant_pause',
            month: selectedMonth,
            treatment: selectedTreatment,
            organ: selectedOrgan || DEFAULT_ORGAN_FALLBACK,
            isPlaying: playing,
          });
        },
        appendActionLog,
      });
    },
    [
      appendActionLog,
      handleTimelineMonthChange,
      handleTimelineOrganChange,
      handleTimelineTreatmentChange,
      organOptions,
      selectedMonth,
      selectedOrgan,
      selectedTreatment,
      timelineData,
    ]
  );

  const activeMutations = useMemo(() =>
    Object.entries(profile.mutations).filter(([, v]) => v === 1).map(([k]) => k),
    [profile.mutations]
  );

  const assistantPatientSummary = useMemo(
    () => ({
      age: simulationProfile.age,
      primarySite: simulationProfile.primary_site,
      keyMutations: Object.entries(simulationProfile.mutations)
        .filter(([, value]) => value === 1)
        .map(([gene]) => gene),
    }),
    [simulationProfile]
  );

  useEffect(() => {
    const browserWindow = window as Window & { __oncopathTimelineBridge?: TimelineBridgeApi };
    browserWindow.__oncopathTimelineBridge = {
      applyCommand: handleTimelineCommand,
      getState: () => ({
        selectedOrgan,
        selectedTreatment,
        selectedMonth,
        isPlaying: isTimelinePlaying,
        actionLog: copilotActionLog,
      }),
    };

    return () => {
      delete browserWindow.__oncopathTimelineBridge;
    };
  }, [
    copilotActionLog,
    handleTimelineCommand,
    isTimelinePlaying,
    selectedMonth,
    selectedOrgan,
    selectedTreatment,
  ]);

  useEffect(() => {
    if (!selectedOrgan) {
      return;
    }
    updateTimelineDropoffCandidate({
      action: isTimelinePlaying ? 'autoplay_position_update' : 'position_update',
      month: selectedMonth,
      treatment: selectedTreatment,
      organ: selectedOrgan,
      isPlaying: isTimelinePlaying,
    });
  }, [isTimelinePlaying, selectedMonth, selectedOrgan, selectedTreatment]);

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
                {sceneMode === 'macro' ? 'Loading Anatomical Engine…' : 'Loading Micro Scene…'}
              </span>
            </div>
          </div>
        }>
          {sceneMode === 'macro' ? (
            <AnatomicalBody3D risks={risks} profile={simulationProfile} onOrganSelect={handleOrganSelect} />
          ) : (
            <TumorMicroScene
              risk={activeMicroRisk}
              selectedMonth={activeTimelinePoint?.month ?? selectedMonth}
              organLabel={selectedOrganLabel}
              treatmentLabel={selectedTreatmentLabel}
            />
          )}
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

      {/* ── Top-right mode switch ────────────────────────────────────────── */}
      <div className="absolute top-4 right-4 z-20 pointer-events-auto">
        <div className="rounded-xl border border-zinc-700/70 bg-zinc-900/75 px-3 py-2 backdrop-blur-md shadow-lg">
          <p className="text-[9px] font-mono uppercase tracking-[0.24em] text-zinc-500 mb-2">Scene mode</p>
          <div className="flex items-center rounded-lg border border-zinc-700/60 bg-zinc-950/70 p-1 gap-1">
            <button
              type="button"
              data-testid="macro-mode-button"
              aria-pressed={sceneMode === 'macro'}
              onClick={() => setSceneMode('macro')}
              className={`px-3 py-1.5 text-[11px] font-semibold rounded-md transition-colors ${
                sceneMode === 'macro' ? 'bg-orange-500/20 text-orange-200' : 'text-zinc-400 hover:text-zinc-200'
              }`}
            >
              Macro
            </button>
            <button
              type="button"
              data-testid="micro-mode-button"
              aria-pressed={sceneMode === 'micro'}
              onClick={() => setSceneMode('micro')}
              className={`px-3 py-1.5 text-[11px] font-semibold rounded-md transition-colors ${
                sceneMode === 'micro' ? 'bg-cyan-500/20 text-cyan-200' : 'text-zinc-400 hover:text-zinc-200'
              }`}
            >
              Micro
            </button>
          </div>
        </div>
      </div>

      {sceneMode === 'micro' && (
        <div
          data-testid="micro-scene-legend"
          className="absolute top-24 right-4 z-20 max-w-xs rounded-xl border border-zinc-700/70 bg-zinc-900/75 px-3.5 py-3 backdrop-blur-md text-[11px] text-zinc-200 space-y-2"
        >
          <p className="text-[9px] font-mono uppercase tracking-[0.24em] text-zinc-500">How to read this view</p>
          <ul className="space-y-1 text-zinc-300 leading-relaxed">
            <li>• Larger center mass = higher projected activity for the selected timeline point.</li>
            <li>• Faster particle motion = more intense circulation dynamics.</li>
            <li>• Brighter glow = higher risk level in this non-medical visual model.</li>
          </ul>
          <div className="rounded-lg border border-zinc-700/60 bg-zinc-950/60 p-2 space-y-1">
            <p className="text-[10px] text-zinc-400">
              {selectedOrganLabel} · Month {activeTimelinePoint?.month ?? selectedMonth}
            </p>
            <div className="flex justify-between text-zinc-300">
              <span>Risk</span>
              <span data-testid="micro-risk-indicator" className="font-mono text-cyan-300">
                {microSignals.riskPercent}%
              </span>
            </div>
            <div className="flex justify-between text-zinc-300">
              <span>Tumor scale</span>
              <span data-testid="micro-tumor-scale-indicator" className="font-mono text-orange-300">
                {microSignals.tumorScale}x
              </span>
            </div>
            <div className="flex justify-between text-zinc-300">
              <span>Flow / glow</span>
              <span data-testid="micro-flow-indicator" className="font-mono text-rose-300">
                {microSignals.flowBand} · {microSignals.glowBand}
              </span>
            </div>
          </div>
        </div>
      )}

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

      {/* ── Bottom status bar ────────────────────────────────────────────── */}
      <div className="absolute bottom-4 left-4 z-20 flex items-end gap-3 pointer-events-none">
        {/* Parameters FAB */}
        <div className="pointer-events-auto">
          <GenomicDrawer 
            profile={profile} 
            onChange={setProfile} 
            onRunSimulation={(slideImage?: string) => {
              setSimulationProfile(profile);
              setSimulationImage(slideImage);
            }} 
          />
        </div>
        <div className="pointer-events-auto">
          <TimelineDrawer
            organOptions={organOptions}
            selectedOrgan={selectedOrgan}
            selectedTreatment={selectedTreatment}
            selectedMonth={selectedMonth}
            timeline={timelineData}
            timelineSource={timelineSource}
            isTimelinePending={timelinePending}
            timelineErrorMessage={timelineErrorMessage}
            baselineRisk={selectedBaselineRisk}
            prediction={prediction}
            isTimelinePlaying={isTimelinePlaying}
            patientSummary={assistantPatientSummary}
            selectedOrganLabel={selectedOrganLabel}
            selectedTreatmentLabel={selectedTreatmentLabel}
            actionLog={copilotActionLog}
            onOrganChange={handleTimelineOrganChange}
            onTreatmentChange={handleTimelineTreatmentChange}
            onMonthChange={handleTimelineMonthChange}
            onPlaybackPlay={handleTimelinePlay}
            onPlaybackPause={handleTimelinePause}
            onPlaybackReplay={handleTimelineReplay}
          />
        </div>
      </div>

      {/* ── Organ Popover ────────────────────────────────────────────────── */}
      {sceneMode === 'macro' && popover && (
        <OrganPopover
          data={popover}
          risk={risks[popover.organId]}
          activeMutations={activeMutations}
          projectedRisk12m={proj12m}
          onClose={() => setPopover(null)}
        />
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
