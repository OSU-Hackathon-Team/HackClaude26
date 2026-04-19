'use client';

import React, { useMemo } from 'react';
import { AlertCircle, ActivitySquare, X } from 'lucide-react';
import { Select, SelectItem, Slider } from '@/components/ui';
import type { PredictionSnapshot } from '@/lib/api';
import {
  DEFAULT_TIMELINE_MONTHS,
  getTimelinePointAtMonth,
  TIMELINE_TREATMENT_PRESETS,
  type TimelinePoint,
  type TreatmentPresetId,
} from '@/lib/timeline';

interface OrganOption {
  key: string;
  label: string;
}

interface TimelinePanelProps {
  organOptions: OrganOption[];
  selectedOrgan: string;
  selectedTreatment: TreatmentPresetId;
  selectedMonth: number;
  timeline: TimelinePoint[];
  timelineSource: 'local' | 'backend';
  simulationSummary?: string;
  isProjectionLoading?: boolean;
  confidenceMetrics?: Record<string, number>;
  baselineRisk: number | null;
  prediction: PredictionSnapshot | null;
  onOrganChange: (organ: string) => void;
  onTreatmentChange: (treatment: TreatmentPresetId) => void;
  onMonthChange: (month: number) => void;
  onClose?: () => void;
}

const CHART_WIDTH = 640;
const CHART_HEIGHT = 220;
const CHART_PADDING_X = 44;
const CHART_PADDING_Y = 24;
const TREATMENT_IDS = new Set<string>(TIMELINE_TREATMENT_PRESETS.map((preset) => preset.id));

function asPercent(risk: number): string {
  return `${Math.round(risk * 100)}%`;
}

export function TimelinePanel({
  organOptions,
  selectedOrgan,
  selectedTreatment,
  selectedMonth,
  timeline,
  timelineSource,
  simulationSummary,
  isProjectionLoading = false,
  confidenceMetrics,
  baselineRisk,
  prediction,
  onOrganChange,
  onTreatmentChange,
  onMonthChange,
  onClose,
}: TimelinePanelProps) {
  const selectedOrganLabel = useMemo(
    () => organOptions.find((option) => option.key === selectedOrgan)?.label ?? selectedOrgan,
    [organOptions, selectedOrgan]
  );

  const maxMonth = timeline.length
    ? timeline[timeline.length - 1].month
    : DEFAULT_TIMELINE_MONTHS;
  const clampedMonth = Math.min(Math.max(selectedMonth, 0), maxMonth);
  const activePoint = getTimelinePointAtMonth(timeline, clampedMonth);

  const chart = useMemo(() => {
    if (!timeline.length) {
      return null;
    }

    const toX = (month: number) =>
      CHART_PADDING_X + (month / Math.max(maxMonth, 1)) * (CHART_WIDTH - CHART_PADDING_X * 2);
    const toY = (risk: number) =>
      CHART_HEIGHT - CHART_PADDING_Y - risk * (CHART_HEIGHT - CHART_PADDING_Y * 2);

    const linePoints = timeline.map((point) => `${toX(point.month)},${toY(point.risk)}`).join(' ');
    const firstPoint = timeline[0];
    const lastPoint = timeline[timeline.length - 1];
    const areaPath = [
      `M ${toX(firstPoint.month)} ${toY(0)}`,
      `L ${toX(firstPoint.month)} ${toY(firstPoint.risk)}`,
      ...timeline.map((point) => `L ${toX(point.month)} ${toY(point.risk)}`),
      `L ${toX(lastPoint.month)} ${toY(0)}`,
      'Z',
    ].join(' ');

    const marker =
      activePoint === null
        ? null
        : {
            x: toX(activePoint.month),
            y: toY(activePoint.risk),
          };

    return { linePoints, areaPath, marker, toX, toY };
  }, [activePoint, maxMonth, timeline]);

  const monthTicks = useMemo(() => {
    const ticks = [0, Math.round(maxMonth * 0.25), Math.round(maxMonth * 0.5), Math.round(maxMonth * 0.75), maxMonth];
    return Array.from(new Set(ticks)).sort((a, b) => a - b);
  }, [maxMonth]);

  const confidenceEntries = useMemo(() => {
    // Prefer the dynamic merged metrics (updated per treatment/month) over the static snapshot
    const source = confidenceMetrics ?? prediction?.confidence_metrics ?? {};
    return Object.entries(source).sort((a, b) => b[1] - a[1]);
  }, [confidenceMetrics, prediction?.confidence_metrics]);

  const shapEntries = useMemo(() => {
    return Object.entries(prediction?.shap_values ?? {})
      .sort((a, b) => Math.abs(b[1]) - Math.abs(a[1]))
      .slice(0, 5);
  }, [prediction?.shap_values]);

  const hasOrganOptions = organOptions.length > 0;
  const sourceLabel = timelineSource === 'backend' ? 'Backend Projection' : 'Simulated Projection';

  return (
    <section className="relative border-t border-slate-800/40 bg-[#060d1a]/90 backdrop-blur-sm px-6 py-4 z-20">
      {onClose && (
        <button 
          onClick={onClose}
          className="absolute top-4 right-4 p-1.5 rounded-lg bg-slate-800/40 hover:bg-slate-800/80 text-slate-400 hover:text-slate-100 transition-all border border-slate-700/50"
          title="Close clinical timeline"
        >
          <X size={14} />
        </button>
      )}
      <div className="grid grid-cols-1 xl:grid-cols-[300px_1fr_330px] gap-4 items-start">
        <div className="rounded-xl border border-slate-800/60 bg-[#0a1324] p-4 space-y-4">
          <div>
            <h3 className="text-xs font-semibold text-slate-200 uppercase tracking-wider">Timeline Controls</h3>
            <p className="text-[10px] text-slate-500 mt-1">Select organ, treatment, and month horizon.</p>
          </div>

          <div className="space-y-1.5">
            <label className="text-[10px] text-slate-400 uppercase tracking-wider font-semibold">Organ</label>
            <Select
              value={selectedOrgan}
              onValueChange={(value) => {
                onOrganChange(value);
                onMonthChange(0);
              }}
            >
              {organOptions.map((option) => (
                <SelectItem key={option.key} value={option.key}>
                  {option.label}
                </SelectItem>
              ))}
            </Select>
          </div>

          <div className="space-y-1.5">
            <label className="text-[10px] text-slate-400 uppercase tracking-wider font-semibold">Treatment</label>
            <Select
              value={selectedTreatment}
              onValueChange={(value) => {
                if (TREATMENT_IDS.has(value)) {
                  onTreatmentChange(value as TreatmentPresetId);
                  onMonthChange(0);
                }
              }}
            >
              {TIMELINE_TREATMENT_PRESETS.map((preset) => (
                <SelectItem key={preset.id} value={preset.id}>
                  {preset.label}
                </SelectItem>
              ))}
            </Select>
          </div>

          <div className="space-y-2">
            <div className="flex justify-between text-[10px] text-slate-400 uppercase tracking-wider font-semibold">
              <span>Month</span>
              <span className="text-blue-400 font-mono">{clampedMonth}</span>
            </div>
            <Slider
              value={[clampedMonth]}
              min={0}
              max={Math.max(maxMonth, 1)}
              step={1}
              onValueChange={([value]) => onMonthChange(value)}
              className={!hasOrganOptions ? 'opacity-40 pointer-events-none' : ''}
            />
          </div>

          {activePoint && baselineRisk !== null ? (
            <div className="rounded-lg border border-slate-700/60 bg-slate-900/60 p-3 space-y-1.5">
              <div className="flex justify-between text-[10px] text-slate-400">
                <span>Baseline</span>
                <span className="font-mono text-slate-200">{asPercent(baselineRisk)}</span>
              </div>
              <div className="flex justify-between text-[10px] text-slate-400">
                <span>Month {activePoint.month}</span>
                <span className="font-mono text-blue-300">{asPercent(activePoint.risk)}</span>
              </div>
              <div className="flex justify-between text-[10px] text-slate-400">
                <span>Delta</span>
                <span className="font-mono text-emerald-300">
                  {`${activePoint.risk >= baselineRisk ? '+' : ''}${Math.round(
                    (activePoint.risk - baselineRisk) * 100
                  )}%`}
                </span>
              </div>
            </div>
          ) : (
            <div className="rounded-lg border border-amber-500/30 bg-amber-950/30 px-3 py-2 text-[10px] text-amber-200">
              No baseline risk available for this organ selection.
            </div>
          )}
        </div>

        <div className="rounded-xl border border-slate-800/60 bg-[#0a1324] p-4">
          <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
            <div>
              <h3 className="text-sm font-semibold text-slate-100 flex items-center gap-2">
                <ActivitySquare size={14} className="text-blue-400" />
                {selectedOrganLabel || 'Projection Curve'}
              </h3>
              <p className="text-[10px] text-slate-500 mt-1">
                Month marker drives active anatomical risk value.
              </p>
            </div>
            <span
              className={`text-[10px] uppercase tracking-wider font-semibold rounded-md px-2 py-1 border ${
                timelineSource === 'backend'
                  ? 'text-emerald-300 border-emerald-500/30 bg-emerald-500/10'
                  : 'text-blue-300 border-blue-500/30 bg-blue-500/10'
              }`}
            >
              {sourceLabel}
            </span>
          </div>

          {!hasOrganOptions ? (
            <div className="h-[220px] rounded-lg border border-slate-700/50 bg-slate-950/50 flex items-center justify-center px-6 text-center">
              <p className="text-xs text-slate-400">
                No baseline risk scores are available yet. Run a prediction to unlock timeline projections.
              </p>
            </div>
          ) : baselineRisk === null ? (
            <div className="h-[220px] rounded-lg border border-amber-500/30 bg-amber-950/20 flex items-center justify-center px-6 text-center gap-2">
              <AlertCircle size={14} className="text-amber-300" />
              <p className="text-xs text-amber-100">
                Selected organ has no baseline risk. Choose another organ with a valid risk score.
              </p>
            </div>
          ) : isProjectionLoading ? (
            /* ── Animated skeleton while Claude computes the projection ── */
            <div className="rounded-lg border border-blue-500/20 bg-slate-950/60 p-2 relative overflow-hidden">
              <style>{`
                @keyframes wave-drift {
                  0%   { transform: translateX(0);   }
                  100% { transform: translateX(-50%); }
                }
                @keyframes scan-sweep {
                  0%   { transform: translateX(0);   opacity: 0.8; }
                  90%  { transform: translateX(552px); opacity: 0.8; }
                  100% { transform: translateX(552px); opacity: 0; }
                }
                @keyframes label-pulse {
                  0%, 100% { opacity: 0.4; }
                  50%       { opacity: 1;   }
                }
              `}</style>
              <svg
                viewBox={`0 0 ${CHART_WIDTH} ${CHART_HEIGHT}`}
                className="w-full h-[220px]"
                aria-label="Computing projection…"
              >
                {/* Ghost grid lines */}
                {[0, 0.25, 0.5, 0.75, 1].map((level) => {
                  const y = CHART_HEIGHT - CHART_PADDING_Y - level * (CHART_HEIGHT - CHART_PADDING_Y * 2);
                  return (
                    <line key={level} x1={CHART_PADDING_X} y1={y}
                      x2={CHART_WIDTH - CHART_PADDING_X} y2={y}
                      stroke="rgba(100,116,139,0.12)" strokeWidth={1} />
                  );
                })}

                {/* Animated sine-wave skeleton — two copies tiled so loop is seamless */}
                <g style={{ animation: 'wave-drift 2.8s linear infinite' }}>
                  {[0, 1].map((offset) => {
                    const W = CHART_WIDTH - CHART_PADDING_X * 2;
                    const pts = Array.from({ length: 81 }, (_, i) => {
                      const x = CHART_PADDING_X + offset * W + (i / 80) * W;
                      const y = CHART_HEIGHT / 2 +
                        Math.sin((i / 80) * Math.PI * 4) * 28 +
                        Math.sin((i / 80) * Math.PI * 7 + 1) * 12;
                      return `${x},${y}`;
                    }).join(' ');
                    return (
                      <polyline key={offset} fill="none"
                        stroke="rgba(96,165,250,0.25)" strokeWidth={2.5}
                        strokeLinecap="round" strokeLinejoin="round"
                        points={pts} />
                    );
                  })}
                </g>

                {/* Scanning vertical beam */}
                <line
                  x1={CHART_PADDING_X} y1={CHART_PADDING_Y}
                  x2={CHART_PADDING_X} y2={CHART_HEIGHT - CHART_PADDING_Y}
                  stroke="rgba(147,197,253,0.7)" strokeWidth={1.5} strokeDasharray="4 4"
                  style={{ animation: 'scan-sweep 2s ease-in-out infinite' }}
                />

                {/* Central label */}
                <text
                  x={CHART_WIDTH / 2} y={CHART_HEIGHT / 2 + 5}
                  textAnchor="middle" fontSize={11}
                  fill="rgba(148,163,184,1)"
                  fontFamily="ui-monospace, monospace"
                  style={{ animation: 'label-pulse 1.6s ease-in-out infinite' }}
                >
                  Computing projection…
                </text>
              </svg>
            </div>
          ) : !chart ? (
            <div className="h-[220px] rounded-lg border border-slate-700/50 bg-slate-950/50 flex items-center justify-center">
              <p className="text-xs text-slate-400">Projection curve not available.</p>
            </div>
          ) : (
            <div className="rounded-lg border border-slate-700/50 bg-slate-950/40 p-2">
              <svg
                viewBox={`0 0 ${CHART_WIDTH} ${CHART_HEIGHT}`}
                className="w-full h-[220px]"
                role="img"
                aria-label="Risk projection over time"
              >
                {[0, 0.25, 0.5, 0.75, 1].map((level) => (
                  <line
                    key={`grid-${level}`}
                    x1={CHART_PADDING_X}
                    y1={chart.toY(level)}
                    x2={CHART_WIDTH - CHART_PADDING_X}
                    y2={chart.toY(level)}
                    stroke="rgba(100,116,139,0.22)"
                    strokeWidth={1}
                  />
                ))}
                {monthTicks.map((tick) => (
                  <line
                    key={`tick-${tick}`}
                    x1={chart.toX(tick)}
                    y1={CHART_HEIGHT - CHART_PADDING_Y}
                    x2={chart.toX(tick)}
                    y2={CHART_PADDING_Y}
                    stroke="rgba(100,116,139,0.2)"
                    strokeWidth={1}
                  />
                ))}
                <path d={chart.areaPath} fill="rgba(59,130,246,0.14)" />
                <polyline
                  fill="none"
                  stroke="rgb(96,165,250)"
                  strokeWidth={3}
                  points={chart.linePoints}
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
                {chart.marker && (
                  <>
                    <line
                      x1={chart.marker.x}
                      y1={CHART_HEIGHT - CHART_PADDING_Y}
                      x2={chart.marker.x}
                      y2={CHART_PADDING_Y}
                      stroke="rgba(147,197,253,0.7)"
                      strokeWidth={1.5}
                      strokeDasharray="4 4"
                    />
                    <circle cx={chart.marker.x} cy={chart.marker.y} r={6} fill="rgb(191,219,254)" />
                    <circle cx={chart.marker.x} cy={chart.marker.y} r={10} fill="rgba(59,130,246,0.25)" />
                  </>
                )}
              </svg>
              <div className="mt-1 flex items-center justify-between text-[10px] text-slate-500 px-2">
                <span>Month 0</span>
                <span>Month {maxMonth}</span>
              </div>
            </div>
          )}
        </div>

        <div className="rounded-xl border border-slate-800/60 bg-[#0a1324] p-4 space-y-3 max-h-[50vh] overflow-y-auto overscroll-contain">
          <h3 className="text-xs font-semibold text-slate-200 uppercase tracking-wider">Explainability</h3>

          {/* ── SHAP Feature Attribution ─────────────────────────────── */}
          <div className="rounded-lg border border-slate-700/60 bg-slate-900/50 p-3">
            <div className="text-[10px] text-slate-400 uppercase tracking-wider font-semibold mb-3">
              SHAP Feature Attribution
            </div>
            {shapEntries.length ? (
              <div className="space-y-2">
                {(() => {
                  const maxAbs = Math.max(...shapEntries.map(([, v]) => Math.abs(v)), 0.001);
                  return shapEntries.map(([key, value]) => {
                    const pct = Math.abs(value) / maxAbs;
                    const isPositive = value >= 0;
                    const label = key
                      .replace(/^(primary_site_|oncotree_|age_|sex_)/, (m) =>
                        m === 'primary_site_' ? 'Site · ' :
                        m === 'oncotree_' ? 'Code · ' :
                        m === 'age_' ? 'Age · ' :
                        m === 'sex_' ? 'Sex · ' : m
                      )
                      .replace(/_/g, ' ')
                      .replace(/\b\w/g, (c) => c.toUpperCase());
                    return (
                      <div key={key} className="space-y-0.5">
                        <div className="flex items-center gap-2">
                          <span className="text-[9px] text-slate-300 truncate max-w-[140px]" title={label}>
                            {label}
                          </span>
                          <span className={`text-[9px] font-mono tabular-nums ${isPositive ? 'text-rose-400' : 'text-teal-400'}`}>
                            {isPositive ? '+' : ''}{value.toFixed(4)}
                          </span>
                        </div>
                        {/* Signed waterfall bar */}
                        <div className="relative h-1.5 w-full rounded-full bg-slate-800/80 overflow-hidden">
                          <div
                            className={`absolute top-0 h-full rounded-full transition-all duration-700 ${
                              isPositive
                                ? 'left-0 bg-gradient-to-r from-rose-600 to-rose-400'
                                : 'right-0 bg-gradient-to-l from-teal-600 to-teal-400'
                            }`}
                            style={{ width: `${Math.round(pct * 100)}%` }}
                          />
                        </div>
                      </div>
                    );
                  });
                })()}
                <p className="text-[9px] text-slate-600 pt-1 italic">
                  Red = risk driver · Teal = protective factor
                </p>
              </div>
            ) : (
              <p className="text-[10px] text-slate-500">Run a simulation to generate feature attributions.</p>
            )}
          </div>

          {/* ── Confidence Metrics ───────────────────────────────────── */}
          <div className="rounded-lg border border-slate-700/60 bg-slate-900/50 p-3">
            <div className="text-[10px] text-slate-400 uppercase tracking-wider font-semibold mb-3">
              Confidence Metrics
            </div>
            {confidenceEntries.length ? (() => {
              type MetaCfg = {
                tooltip: string;
                verdict: (v: number) => string;
                note: (v: number) => string;
                // thresholds: [high, mid] — above high = green, above mid = amber, else = rose
                thresholds: [number, number];
              };
              const META: Record<string, MetaCfg> = {
                "Genetic Driver Score": {
                  tooltip: "Combined score reflecting how much the patient's specific mutations (vs. age/sex/primary site) are driving this prediction, weighted by how well those mutations are represented in training data.",
                  verdict: (v) => v > 0.65 ? "Your mutations are the primary risk driver" : v > 0.35 ? "Shared genomic & demographic influence" : "Demographics are the primary driver",
                  note: (v) => v < 0.35 ? "Genomic sequencing added limited lift over demographic baseline. Predictions rely heavily on cancer type rather than individual genetics." : "",
                  thresholds: [0.65, 0.35],
                },
                "Target Clarity": {
                  tooltip: "Fraction of total metastatic risk mass concentrated in the top 3 organs. High = the model has identified clear targets; Low = risk is spread diffusely, making targeted screening less effective.",
                  verdict: (v) => v > 0.70 ? "Clear target organs identified — focused screening recommended" : v > 0.45 ? "Moderate focus — review top-3 sites closely" : "Diffuse risk pattern — broad imaging may be warranted",
                  note: (v) => v < 0.45 ? "Risk is not concentrated in specific organs. Consider whole-body imaging rather than targeted surveillance." : "",
                  thresholds: [0.70, 0.45],
                },
                "Data Confidence": {
                  tooltip: "How well-studied this cancer profile (primary site, oncotree code, mutation panel size) is in the MSK-MET training dataset of 25,000+ patients.",
                  verdict: (v) => v > 0.75 ? "Well-studied cancer profile" : v > 0.55 ? "Moderately studied profile" : "Limited training data for this subtype",
                  note: (v) => v < 0.55 ? "This cancer subtype is less represented in training data. Treat risk scores as indicative, not definitive. Seek specialist review." : "",
                  thresholds: [0.75, 0.55],
                },
              };

              return (
                <div className="space-y-3.5">
                  {confidenceEntries.map(([key, value]) => {
                    const cfg = META[key];
                    const pct = Math.round(value * 100);
                    const [hi, mid] = cfg?.thresholds ?? [0.75, 0.5];
                    const level = value > hi ? 'high' : value > mid ? 'mid' : 'low';
                    const bar   = level === 'high' ? 'bg-emerald-500' : level === 'mid' ? 'bg-amber-500' : 'bg-rose-500';
                    const txt   = level === 'high' ? 'text-emerald-400' : level === 'mid' ? 'text-amber-400' : 'text-rose-400';
                    const clinicalNote = cfg?.note(value) ?? '';

                    return (
                      <div key={key} className="space-y-1" title={cfg?.tooltip ?? key}>
                        <div className="flex items-center justify-between">
                          <span className="text-[9px] text-slate-300 font-medium">{key}</span>
                          <span className={`text-[9px] font-mono font-bold ${txt}`}>{pct}%</span>
                        </div>
                        <div className="h-1 w-full bg-slate-800 rounded-full overflow-hidden">
                          <div className={`h-full ${bar} transition-all duration-700`} style={{ width: `${pct}%` }} />
                        </div>
                        {cfg && (
                          <p className={`text-[8.5px] font-medium ${txt}`}>{cfg.verdict(value)}</p>
                        )}
                        {clinicalNote && (
                          <p className="text-[8px] text-slate-500 italic leading-relaxed">{clinicalNote}</p>
                        )}
                      </div>
                    );
                  })}
                </div>
              );
            })() : (
              <p className="text-[10px] text-slate-500">Confidence analysis pending simulation results.</p>
            )}
          </div>

          {/* ── Biological Rationale ─────────────────────────────────── */}
          <div className="rounded-lg border border-slate-700/60 bg-slate-900/50 p-3">
            <div className="flex items-center justify-between text-[10px] text-slate-400 uppercase tracking-wider font-semibold mb-2">
              <span>Biological Rationale</span>
              {simulationSummary?.includes('computing') || simulationSummary?.includes('Analyzing') ? (
                <span className="flex items-center gap-1 text-blue-400">
                  <span className="w-1.5 h-1.5 rounded-full bg-blue-400 animate-pulse inline-block" />
                  Computing…
                </span>
              ) : null}
            </div>
            <p className={`text-[10px] leading-relaxed italic ${
              simulationSummary?.includes('computing') || simulationSummary?.includes('Analyzing')
                ? 'text-slate-500 animate-pulse'
                : 'text-zinc-300'
            }`}>
              {simulationSummary || "Analyzing potential genomic-treatment synergy..."}
            </p>
          </div>
        </div>
      </div>
    </section>
  );
}
