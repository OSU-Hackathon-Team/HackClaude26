'use client';

import React, { useMemo, useState, lazy, Suspense } from 'react';
import { AlertCircle, ActivitySquare, X, ChevronDown, ChevronUp } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { Select, SelectItem, Slider } from '@/components/ui';
import type { PredictionSnapshot } from '@/lib/api';
import { TumorCell3DView } from '@/components/TumorCell3DView';
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
const CHART_HEIGHT = 240;
const CHART_PADDING_X = 56;  // wider to fit Y-axis labels
const CHART_PADDING_Y = 28;
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
  const [isMinimized, setIsMinimized] = useState(false);
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
      CHART_PADDING_X + (month / Math.max(maxMonth, 1)) * (CHART_WIDTH - CHART_PADDING_X - 16);
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

    // Peak risk point
    const peakPoint = timeline.reduce((best, pt) => pt.risk > best.risk ? pt : best, timeline[0]);
    const peak = { x: toX(peakPoint.month), y: toY(peakPoint.risk), risk: peakPoint.risk };

    return { linePoints, areaPath, marker, toX, toY, peak };
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
    <motion.section
      initial={false}
      animate={{ height: isMinimized ? '44px' : 'auto' }}
      className="relative border-t border-slate-800/40 bg-[#060d1a]/95 backdrop-blur-md px-6 z-20 overflow-hidden shadow-[0_-10px_30px_rgba(0,0,0,0.5)] transition-colors duration-500"
    >
      {/* Draggable Handle */}
      <div
        onClick={() => setIsMinimized(!isMinimized)}
        className="w-full h-11 flex flex-col items-center justify-center cursor-pointer group hover:bg-slate-800/30 transition-colors"
      >
        <div className="w-12 h-1 bg-slate-700/50 rounded-full group-hover:bg-blue-500/50 transition-colors mb-1" />
        <div className="flex items-center gap-2 text-[10px] uppercase font-bold tracking-widest text-slate-500 group-hover:text-slate-300">
          {isMinimized ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
          {isMinimized ? 'Expand Clinical Timeline' : 'Drag or Click to Minimize'}
        </div>
      </div>

      <div className={`pb-4 ${isMinimized ? 'opacity-0' : 'opacity-100 transition-opacity duration-300 delay-100'}`}>
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
            <div className="mb-2">
              <TumorCell3DView
                risk={activePoint?.risk ?? baselineRisk ?? 0}
                baselineRisk={baselineRisk ?? 0}
                treatment={selectedTreatment}
                month={clampedMonth}
              />
            </div>
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
              <div className="rounded-lg border border-slate-800/40 bg-slate-900/20 px-3 py-2 text-[10px] text-slate-500 italic">
                Baseline risk data unavailable for selected site.
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
                className={`text-[10px] uppercase tracking-wider font-semibold rounded-md px-2 py-1 border ${timelineSource === 'backend'
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
              <div className="h-[220px] rounded-lg border border-slate-800/40 bg-slate-900/10 flex items-center justify-center px-6 text-center">
                <p className="text-xs text-slate-500 italic">
                  No projection curve available for this profile.
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
                  className="w-full h-[260px]"
                  role="img"
                  aria-label="Risk projection over time"
                >
                  <defs>
                    <linearGradient id="areaGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="rgba(239,68,68,0.28)" />
                      <stop offset="55%" stopColor="rgba(59,130,246,0.18)" />
                      <stop offset="100%" stopColor="rgba(59,130,246,0.02)" />
                    </linearGradient>
                    <linearGradient id="lineGrad" x1="0" y1="0" x2="1" y2="0">
                      <stop offset="0%" stopColor="rgb(96,165,250)" />
                      <stop offset="60%" stopColor="rgb(129,140,248)" />
                      <stop offset="100%" stopColor="rgb(167,139,250)" />
                    </linearGradient>
                  </defs>

                  {/* ── Y-axis grid lines + labels ─────────────────────── */}
                  {[0, 0.25, 0.5, 0.75, 1].map((level) => (
                    <g key={`y-${level}`}>
                      <line
                        x1={CHART_PADDING_X} y1={chart.toY(level)}
                        x2={CHART_WIDTH - 16} y2={chart.toY(level)}
                        stroke={level === 0 ? 'rgba(100,116,139,0.35)' : 'rgba(100,116,139,0.18)'}
                        strokeWidth={level === 0 ? 1.5 : 1}
                        strokeDasharray={level === 0 ? '' : '3 4'}
                      />
                      <text
                        x={CHART_PADDING_X - 6} y={chart.toY(level) + 4}
                        textAnchor="end" fontSize={9.5}
                        fontFamily="ui-monospace,monospace"
                        fill={level === 0 ? 'rgba(100,116,139,0.6)' : 'rgba(148,163,184,0.75)'}
                      >
                        {`${Math.round(level * 100)}%`}
                      </text>
                    </g>
                  ))}

                  {/* ── Y-axis spine ──────────────────────────────────── */}
                  <line
                    x1={CHART_PADDING_X} y1={CHART_PADDING_Y - 4}
                    x2={CHART_PADDING_X} y2={CHART_HEIGHT - CHART_PADDING_Y}
                    stroke="rgba(100,116,139,0.4)" strokeWidth={1.5}
                  />

                  {/* ── X-axis tick lines + month labels ─────────────── */}
                  {monthTicks.map((tick) => (
                    <g key={`x-${tick}`}>
                      <line
                        x1={chart.toX(tick)} y1={CHART_HEIGHT - CHART_PADDING_Y}
                        x2={chart.toX(tick)} y2={CHART_PADDING_Y - 4}
                        stroke="rgba(100,116,139,0.15)" strokeWidth={1}
                      />
                      <line
                        x1={chart.toX(tick)} y1={CHART_HEIGHT - CHART_PADDING_Y}
                        x2={chart.toX(tick)} y2={CHART_HEIGHT - CHART_PADDING_Y + 4}
                        stroke="rgba(100,116,139,0.5)" strokeWidth={1.5}
                      />
                      <text
                        x={chart.toX(tick)} y={CHART_HEIGHT - CHART_PADDING_Y + 14}
                        textAnchor="middle" fontSize={9}
                        fontFamily="ui-monospace,monospace"
                        fill="rgba(100,116,139,0.8)"
                      >
                        {tick === 0 ? 'Dx' : `M${tick}`}
                      </text>
                    </g>
                  ))}

                  {/* ── Baseline risk reference line ──────────────────── */}
                  {baselineRisk !== null && (
                    <>
                      <line
                        x1={CHART_PADDING_X} y1={chart.toY(baselineRisk)}
                        x2={CHART_WIDTH - 16} y2={chart.toY(baselineRisk)}
                        stroke="rgba(251,191,36,0.55)" strokeWidth={1.2}
                        strokeDasharray="5 4"
                      />
                      <text
                        x={CHART_WIDTH - 14} y={chart.toY(baselineRisk) + 4}
                        textAnchor="end" fontSize={8.5}
                        fontFamily="ui-monospace,monospace"
                        fill="rgba(251,191,36,0.8)"
                      >
                        Base
                      </text>
                    </>
                  )}

                  {/* ── Area fill + projection line ───────────────────── */}
                  <path d={chart.areaPath} fill="url(#areaGrad)" />
                  <polyline
                    fill="none"
                    stroke="url(#lineGrad)"
                    strokeWidth={2.5}
                    points={chart.linePoints}
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />

                  {/* ── Peak risk annotation ──────────────────────────── */}
                  {chart.peak.risk > (baselineRisk ?? 0) + 0.03 && (
                    <g>
                      <circle cx={chart.peak.x} cy={chart.peak.y} r={3.5}
                        fill="rgba(239,68,68,0.9)" />
                      <text
                        x={chart.peak.x} y={chart.peak.y - 9}
                        textAnchor="middle" fontSize={8.5}
                        fontFamily="ui-monospace,monospace"
                        fill="rgba(252,165,165,0.9)"
                      >
                        Peak {Math.round(chart.peak.risk * 100)}%
                      </text>
                    </g>
                  )}

                  {/* ── Scrubber marker + live callout ────────────────── */}
                  {chart.marker && activePoint && (
                    <>
                      {/* Vertical cursor */}
                      <line
                        x1={chart.marker.x} y1={CHART_HEIGHT - CHART_PADDING_Y}
                        x2={chart.marker.x} y2={CHART_PADDING_Y - 4}
                        stroke="rgba(147,197,253,0.6)" strokeWidth={1.5}
                        strokeDasharray="4 3"
                      />
                      {/* Halo + dot */}
                      <circle cx={chart.marker.x} cy={chart.marker.y} r={10}
                        fill="rgba(59,130,246,0.18)" />
                      <circle cx={chart.marker.x} cy={chart.marker.y} r={5}
                        fill="white" stroke="rgb(96,165,250)" strokeWidth={1.5} />
                      {/* Callout bubble — flip to left side when near right edge */}
                      {(() => {
                        const flipLeft = chart.marker.x > CHART_WIDTH * 0.72;
                        const bw = 82;
                        const bx = flipLeft ? chart.marker.x - bw - 8 : chart.marker.x + 8;
                        const by = Math.max(CHART_PADDING_Y, chart.marker.y - 26);
                        const delta = baselineRisk !== null
                          ? Math.round((activePoint.risk - baselineRisk) * 100)
                          : null;
                        const deltaStr = delta !== null
                          ? `${delta >= 0 ? '+' : ''}${delta}%`
                          : '';
                        const deltaColor = delta !== null && delta > 0
                          ? 'rgba(252,165,165,1)'
                          : 'rgba(110,231,183,1)';
                        return (
                          <g>
                            <rect x={bx} y={by} width={bw} height={36} rx={5}
                              fill="rgba(15,23,42,0.92)" stroke="rgba(96,165,250,0.4)" strokeWidth={1} />
                            <text x={bx + 8} y={by + 13} fontSize={10} fontFamily="ui-monospace,monospace"
                              fill="rgba(191,219,254,1)" fontWeight="700">
                              {Math.round(activePoint.risk * 100)}%
                            </text>
                            <text x={bx + 8} y={by + 26} fontSize={8.5} fontFamily="ui-monospace,monospace"
                              fill={deltaColor}>
                              {deltaStr ? `Δ ${deltaStr} vs base` : `Mo. ${activePoint.month}`}
                            </text>
                          </g>
                        );
                      })()}
                    </>
                  )}
                </svg>
              </div>
            )}
          </div>

          <div className="rounded-xl border border-slate-800/60 bg-[#0a1324] p-4 space-y-3 max-h-[50vh] overflow-y-auto overscroll-contain">
            <h3 className="text-xs font-semibold text-slate-200 uppercase tracking-wider">Explainability</h3>

            {/* ── Grouped SHAP Analysis (Primary Explainability) ────────── */}

            {/* ── Grouped SHAP Analysis ─────────────────────────────────── */}
            <div className="rounded-lg border border-slate-700/60 bg-slate-900/50 p-3 space-y-4">
              <div className="flex items-center justify-between mb-1">
                <div className="text-[10px] text-slate-400 uppercase tracking-wider font-semibold">
                  SHAP Impact Analysis
                </div>

              </div>

              {(() => {
                const source = prediction?.shap_values ?? {};
                const entries = Object.entries(source);
                if (!entries.length) return <p className="text-[10px] text-slate-500 italic">No feature attribution data available for this simulation.</p>;

                // Calculate overall top features across all categories
                const topFeatures = entries
                  .sort((a, b) => Math.abs(b[1]) - Math.abs(a[1]))
                  .slice(0, 10);

                return (
                  <div className="space-y-1.5">
                    <div className="text-[9px] text-slate-500 font-bold uppercase tracking-widest flex items-center gap-2 mb-2">
                      <span className="w-1 h-1 rounded-full bg-blue-500 animate-pulse" />
                      Primary Model Factors
                    </div>
                    <div className="space-y-2 pl-1">
                      {topFeatures.map(([key, value]) => {
                        const pctImpact = Math.round(value * 100);
                        const isPositive = value >= 0;

                        // Identify category for visual hinting
                        const isGenomic = key.startsWith('genomic_');
                        const isClinical = key.startsWith('clinical_');
                        const isDemographic = key.startsWith('demographic_');

                        const label = key
                          .replace(/^(genomic_mut_|clinical_site_|clinical_type_|demographic_)/, '')
                          .replace(/_/g, ' ')
                          .replace(/\b\w/g, c => c.toUpperCase());

                        return (
                          <div key={key} className="group transition-all duration-300">
                            <div className="flex justify-between items-center text-[9px] mb-1">
                              <div className="flex items-center gap-1.5 min-w-0">
                                <div className={`w-1 h-1 rounded-full ${isGenomic ? 'bg-amber-400' : isClinical ? 'bg-blue-400' : 'bg-slate-400'}`} />
                                <span className="text-slate-300 truncate font-medium group-hover:text-white transition-colors capitalize">{label}</span>
                              </div>
                              <span className={`font-mono font-bold ${isPositive ? 'text-rose-400' : 'text-teal-400'}`}>
                                {isPositive ? '+' : ''}{pctImpact}%
                              </span>
                            </div>
                            <div className="relative h-1 w-full bg-slate-800/40 rounded-full overflow-hidden">
                              <div
                                className={`absolute h-full rounded-full transition-all duration-1000 ease-out ${isPositive ? 'bg-rose-500 shadow-[0_0_8px_rgba(244,63,94,0.4)]' : 'bg-teal-500 shadow-[0_0_8px_rgba(20,184,166,0.3)]'}`}
                                style={{
                                  width: `${Math.min(Math.abs(value) * 150, 100)}%`, // Scaled for visual impact
                                  left: isPositive ? '0' : 'auto',
                                  right: isPositive ? 'auto' : '0'
                                }}
                              />
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                );
              })()}

              <p className="text-[8px] text-slate-600 pt-1 leading-relaxed">
                * Percentages reflect the local contribution to final predicted probability relative to the population baseline for this cancer type.
              </p>
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
              <p className={`text-[10px] leading-relaxed italic ${simulationSummary?.includes('computing') || simulationSummary?.includes('Analyzing')
                ? 'text-slate-500 animate-pulse'
                : 'text-zinc-300'
                }`}>
                {simulationSummary || "Analyzing potential genomic-treatment synergy..."}
              </p>
            </div>
          </div>
        </div>
      </div>
    </motion.section>
  );
}
