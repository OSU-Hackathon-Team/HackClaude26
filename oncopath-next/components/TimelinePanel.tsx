'use client';

import React, { useMemo, useState } from 'react';
import { AlertCircle, ActivitySquare } from 'lucide-react';
import { Select, SelectItem, Slider, ToggleSwitch } from '@/components/ui';
import type { PredictionSnapshot } from '@/lib/api';
import {
  DEFAULT_TIMELINE_MONTHS,
  generateLocalTimelineProjection,
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
  isTimelinePending: boolean;
  timelineErrorMessage: string | null;
  baselineRisk: number | null;
  prediction: PredictionSnapshot | null;
  isTimelinePlaying: boolean;
  onOrganChange: (organ: string) => void;
  onTreatmentChange: (treatment: TreatmentPresetId) => void;
  onMonthChange: (month: number) => void;
  onPlaybackPlay: () => void;
  onPlaybackPause: () => void;
  onPlaybackReplay: () => void;
}

const CHART_WIDTH = 640;
const CHART_HEIGHT = 220;
const CHART_PADDING_X = 44;
const CHART_PADDING_Y = 24;
const TREATMENT_IDS = new Set<string>(TIMELINE_TREATMENT_PRESETS.map((preset) => preset.id));

interface ChartGeometry {
  linePoints: string;
  areaPath: string;
  marker: { x: number; y: number } | null;
  toX: (month: number) => number;
  toY: (risk: number) => number;
}

function buildChartGeometry({
  points,
  maxMonth,
  activePoint,
}: {
  points: TimelinePoint[];
  maxMonth: number;
  activePoint: TimelinePoint | null;
}): ChartGeometry | null {
  if (!points.length) {
    return null;
  }

  const toX = (month: number) =>
    CHART_PADDING_X + (month / Math.max(maxMonth, 1)) * (CHART_WIDTH - CHART_PADDING_X * 2);
  const toY = (risk: number) =>
    CHART_HEIGHT - CHART_PADDING_Y - risk * (CHART_HEIGHT - CHART_PADDING_Y * 2);

  const linePoints = points.map((point) => `${toX(point.month)},${toY(point.risk)}`).join(' ');
  const firstPoint = points[0];
  const lastPoint = points[points.length - 1];
  const areaPath = [
    `M ${toX(firstPoint.month)} ${toY(0)}`,
    `L ${toX(firstPoint.month)} ${toY(firstPoint.risk)}`,
    ...points.map((point) => `L ${toX(point.month)} ${toY(point.risk)}`),
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
}

function asPercent(risk: number): string {
  return `${Math.round(risk * 100)}%`;
}

type RiskBandLabel = 'Low concern' | 'Moderate concern' | 'High concern';

interface RiskBand {
  label: RiskBandLabel;
  textClassName: string;
  badgeClassName: string;
}

function getRiskBand(risk: number): RiskBand {
  if (risk < 0.2) {
    return {
      label: 'Low concern',
      textClassName: 'text-blue-300',
      badgeClassName: 'text-blue-200 border-blue-500/40 bg-blue-500/10',
    };
  }
  if (risk < 0.5) {
    return {
      label: 'Moderate concern',
      textClassName: 'text-amber-300',
      badgeClassName: 'text-amber-200 border-amber-500/40 bg-amber-500/10',
    };
  }
  return {
    label: 'High concern',
    textClassName: 'text-rose-300',
    badgeClassName: 'text-rose-200 border-rose-500/40 bg-rose-500/10',
  };
}

function getCurrentProjectionSentence({
  activePoint,
  baselineRisk,
  treatmentLabel,
}: {
  activePoint: TimelinePoint | null;
  baselineRisk: number | null;
  treatmentLabel: string;
}): string {
  if (!activePoint || baselineRisk === null) {
    return 'This is a projection estimate, and a baseline risk plus month selection are needed before a plain-language summary can be shown.';
  }

  const delta = activePoint.risk - baselineRisk;
  const trendPhrase =
    delta <= -0.03 ? 'a meaningful drop in concern' : delta >= 0.03 ? 'a rise in concern' : 'only a small change';

  return `This projection estimates that with ${treatmentLabel}, risk is about ${asPercent(
    activePoint.risk
  )} at month ${activePoint.month} versus ${asPercent(
    baselineRisk
  )} at baseline, suggesting ${trendPhrase} and not a guaranteed outcome.`;
}

export function TimelinePanel({
  organOptions,
  selectedOrgan,
  selectedTreatment,
  selectedMonth,
  timeline,
  timelineSource,
  isTimelinePending,
  timelineErrorMessage,
  baselineRisk,
  prediction,
  isTimelinePlaying,
  onOrganChange,
  onTreatmentChange,
  onMonthChange,
  onPlaybackPlay,
  onPlaybackPause,
  onPlaybackReplay,
}: TimelinePanelProps) {
  const [patientFriendlyMode, setPatientFriendlyMode] = useState(true);
  const [glossaryOpen, setGlossaryOpen] = useState(false);
  const [compareMode, setCompareMode] = useState(false);
  const [comparisonTreatment, setComparisonTreatment] = useState<TreatmentPresetId>(
    TIMELINE_TREATMENT_PRESETS.find((preset) => preset.id !== selectedTreatment)?.id ?? selectedTreatment
  );

  const selectedOrganLabel = useMemo(
    () => organOptions.find((option) => option.key === selectedOrgan)?.label ?? selectedOrgan,
    [organOptions, selectedOrgan]
  );
  const selectedTreatmentLabel = useMemo(
    () =>
      TIMELINE_TREATMENT_PRESETS.find((preset) => preset.id === selectedTreatment)?.label ?? selectedTreatment,
    [selectedTreatment]
  );

  const maxMonth = timeline.length
    ? timeline[timeline.length - 1].month
    : DEFAULT_TIMELINE_MONTHS;
  const clampedMonth = Math.min(Math.max(selectedMonth, 0), maxMonth);
  const activePoint = getTimelinePointAtMonth(timeline, clampedMonth);
  const activeRiskBand = useMemo(() => (activePoint ? getRiskBand(activePoint.risk) : null), [activePoint]);
  const projectionSentence = useMemo(
    () =>
      getCurrentProjectionSentence({
        activePoint,
        baselineRisk,
        treatmentLabel: selectedTreatmentLabel,
      }),
    [activePoint, baselineRisk, selectedTreatmentLabel]
  );

  const effectiveComparisonTreatment = useMemo(
    () =>
      comparisonTreatment === selectedTreatment
        ? (TIMELINE_TREATMENT_PRESETS.find((preset) => preset.id !== selectedTreatment)?.id ?? comparisonTreatment)
        : comparisonTreatment,
    [comparisonTreatment, selectedTreatment]
  );

  const chart = useMemo(
    () =>
      buildChartGeometry({
        points: timeline,
        maxMonth,
        activePoint,
      }),
    [activePoint, maxMonth, timeline]
  );

  const comparisonTimeline = useMemo(() => {
    if (!compareMode || !selectedOrgan || baselineRisk === null) {
      return [];
    }

    return generateLocalTimelineProjection({
      organKey: selectedOrgan,
      baselineRisk,
      treatment: effectiveComparisonTreatment,
      months: Math.max(maxMonth, DEFAULT_TIMELINE_MONTHS),
    });
  }, [baselineRisk, compareMode, effectiveComparisonTreatment, maxMonth, selectedOrgan]);
  const comparisonTreatmentLabel = useMemo(
    () =>
      TIMELINE_TREATMENT_PRESETS.find((preset) => preset.id === effectiveComparisonTreatment)?.label ??
      effectiveComparisonTreatment,
    [effectiveComparisonTreatment]
  );
  const comparisonActivePoint = useMemo(
    () => getTimelinePointAtMonth(comparisonTimeline, clampedMonth),
    [clampedMonth, comparisonTimeline]
  );
  const comparisonChart = useMemo(
    () =>
      buildChartGeometry({
        points: comparisonTimeline,
        maxMonth,
        activePoint: comparisonActivePoint,
      }),
    [comparisonActivePoint, comparisonTimeline, maxMonth]
  );
  const comparisonDeltaPercent = useMemo(() => {
    if (!activePoint || !comparisonActivePoint) {
      return null;
    }
    return Math.round((activePoint.risk - comparisonActivePoint.risk) * 100);
  }, [activePoint, comparisonActivePoint]);

  const monthTicks = useMemo(() => {
    const ticks = [0, Math.round(maxMonth * 0.25), Math.round(maxMonth * 0.5), Math.round(maxMonth * 0.75), maxMonth];
    return Array.from(new Set(ticks)).sort((a, b) => a - b);
  }, [maxMonth]);

  const confidenceEntries = useMemo(() => {
    return Object.entries(prediction?.confidence_metrics ?? {}).sort((a, b) => b[1] - a[1]);
  }, [prediction?.confidence_metrics]);

  const shapEntries = useMemo(() => {
    return Object.entries(prediction?.shap_values ?? {})
      .sort((a, b) => Math.abs(b[1]) - Math.abs(a[1]))
      .slice(0, 5);
  }, [prediction?.shap_values]);
  const shapSnippets = useMemo(
    () =>
      shapEntries.slice(0, 3).map(([key, value]) => ({
        key,
        text: `${key} is estimated to ${value >= 0 ? 'push risk higher' : 'push risk lower'} (${Math.abs(
          value
        ).toFixed(3)} impact).`,
        value,
      })),
    [shapEntries]
  );

  const hasOrganOptions = organOptions.length > 0;
  const sourceLabel = isTimelinePending
    ? 'Fetching live projection…'
    : timelineSource === 'backend'
      ? 'Live projection (backend)'
      : 'Instant estimate (local)';

  return (
    <section className="border-t border-slate-800/40 bg-[#060d1a]/90 backdrop-blur-sm px-6 py-4 z-20">
      <div className="grid grid-cols-1 xl:grid-cols-[300px_1fr_330px] gap-4 items-start">
        <div className="rounded-xl border border-slate-800/60 bg-[#0a1324] p-4 space-y-4">
          <div>
            <h3 className="text-xs font-semibold text-slate-200 uppercase tracking-wider">Timeline Controls</h3>
            <p className="text-[10px] text-slate-500 mt-1">Select organ, treatment, and month horizon.</p>
          </div>

          <div className="space-y-1.5">
            <label className="text-[10px] text-slate-400 uppercase tracking-wider font-semibold">Organ</label>
            <Select
              data-testid="timeline-organ-select"
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
              data-testid="timeline-treatment-select"
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
              <span data-testid="timeline-current-month" className="text-blue-400 font-mono">
                {clampedMonth}
              </span>
            </div>
            <Slider
              data-testid="timeline-month-slider"
              aria-label="Timeline month slider"
              value={[clampedMonth]}
              min={0}
              max={Math.max(maxMonth, 1)}
              step={1}
              onValueChange={([value]) => onMonthChange(value)}
              className={!hasOrganOptions ? 'opacity-40 pointer-events-none' : ''}
            />
          </div>

          <div className="space-y-2 rounded-lg border border-slate-700/60 bg-slate-900/40 p-3">
            <p className="text-[10px] text-slate-400 uppercase tracking-wider font-semibold">Playhead</p>
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                data-testid="timeline-play-button"
                onClick={onPlaybackPlay}
                disabled={isTimelinePlaying}
                className={`px-2.5 py-1 text-[10px] rounded-md border transition-colors ${
                  isTimelinePlaying
                    ? 'opacity-40 cursor-not-allowed border-slate-700 text-slate-500'
                    : 'border-emerald-500/40 text-emerald-200 bg-emerald-500/10 hover:bg-emerald-500/20'
                }`}
              >
                Play
              </button>
              <button
                type="button"
                data-testid="timeline-pause-button"
                onClick={onPlaybackPause}
                disabled={!isTimelinePlaying}
                className={`px-2.5 py-1 text-[10px] rounded-md border transition-colors ${
                  !isTimelinePlaying
                    ? 'opacity-40 cursor-not-allowed border-slate-700 text-slate-500'
                    : 'border-amber-500/40 text-amber-100 bg-amber-500/10 hover:bg-amber-500/20'
                }`}
              >
                Pause
              </button>
              <button
                type="button"
                data-testid="timeline-replay-button"
                onClick={onPlaybackReplay}
                className="px-2.5 py-1 text-[10px] rounded-md border border-blue-500/40 text-blue-200 bg-blue-500/10 hover:bg-blue-500/20 transition-colors"
              >
                Replay
              </button>
            </div>
            <p className="text-[10px] text-slate-500">
              {isTimelinePlaying ? 'Autoplay is running across months.' : 'Autoplay paused.'}
            </p>
          </div>

          <div className="space-y-2 rounded-lg border border-slate-700/60 bg-slate-900/40 p-3">
            <div className="flex items-center justify-between gap-2">
              <label
                htmlFor="compare-treatment-mode"
                className="text-[10px] text-slate-400 uppercase tracking-wider font-semibold"
              >
                Compare treatments
              </label>
              <ToggleSwitch
                id="compare-treatment-mode"
                checked={compareMode}
                onChange={setCompareMode}
              />
            </div>
            {compareMode && (
              <div className="space-y-1.5">
                <label className="text-[10px] text-slate-400 uppercase tracking-wider font-semibold">
                  Compare against
                </label>
                <Select
                  value={effectiveComparisonTreatment}
                  onValueChange={(value) => {
                    if (TREATMENT_IDS.has(value) && value !== selectedTreatment) {
                      setComparisonTreatment(value as TreatmentPresetId);
                    }
                  }}
                >
                  {TIMELINE_TREATMENT_PRESETS.filter((preset) => preset.id !== selectedTreatment).map((preset) => (
                    <SelectItem key={preset.id} value={preset.id}>
                      {preset.label}
                    </SelectItem>
                  ))}
                </Select>
              </div>
            )}
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
              <div className="flex justify-between text-[10px] text-slate-400">
                <span>Risk band</span>
                <span className={`font-semibold ${activeRiskBand?.textClassName ?? 'text-slate-300'}`}>
                  {activeRiskBand?.label ?? 'Not available'}
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
                  <span data-testid="timeline-chart-organ-label">{selectedOrganLabel || 'Projection Curve'}</span>
                </h3>
              <p className="text-[10px] text-slate-500 mt-1">
                Month marker drives active anatomical risk value.
              </p>
            </div>
            <span
              data-testid="timeline-source-label"
              className={`text-[10px] uppercase tracking-wider font-semibold rounded-md px-2 py-1 border ${
                timelineSource === 'backend'
                  ? 'text-emerald-300 border-emerald-500/30 bg-emerald-500/10'
                  : 'text-blue-300 border-blue-500/30 bg-blue-500/10'
              }`}
            >
              {sourceLabel}
            </span>
          </div>

          {timelineErrorMessage && (
            <div
              data-testid="timeline-guardrail-message"
              className="mb-3 rounded-lg border border-amber-500/35 bg-amber-950/30 px-3 py-2 text-[11px] text-amber-100"
            >
              {timelineErrorMessage}
            </div>
          )}
          {isTimelinePending && (
            <div
              data-testid="timeline-loading-message"
              className="mb-3 rounded-lg border border-blue-500/25 bg-blue-950/20 px-3 py-2 text-[11px] text-blue-100"
            >
              Building backend projection in the background. Local estimate stays visible meanwhile.
            </div>
          )}

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
          ) : compareMode ? (
            chart && comparisonChart ? (
              <div data-testid="timeline-compare-split" className="grid grid-cols-2 gap-2">
                {[
                  {
                    key: 'primary',
                    chartData: chart,
                    treatmentLabel: selectedTreatmentLabel,
                    sourceText: timelineSource === 'backend' ? 'Live projection' : 'Local projection',
                    stroke: 'rgb(96,165,250)',
                    area: 'rgba(59,130,246,0.14)',
                    markerFill: 'rgb(191,219,254)',
                    markerHalo: 'rgba(59,130,246,0.25)',
                  },
                  {
                    key: 'comparison',
                    chartData: comparisonChart,
                    treatmentLabel: comparisonTreatmentLabel,
                    sourceText: 'Compare projection (local)',
                    stroke: 'rgb(167,139,250)',
                    area: 'rgba(139,92,246,0.14)',
                    markerFill: 'rgb(221,214,254)',
                    markerHalo: 'rgba(139,92,246,0.28)',
                  },
                ].map((item) => (
                  <div key={item.key} className="rounded-lg border border-slate-700/50 bg-slate-950/40 p-2">
                    <p className="text-[10px] font-semibold text-slate-100 truncate">{item.treatmentLabel}</p>
                    <p className="text-[9px] text-slate-500">{item.sourceText}</p>
                    <svg
                      viewBox={`0 0 ${CHART_WIDTH} ${CHART_HEIGHT}`}
                      className="w-full h-[170px]"
                      role="img"
                      aria-label={`${item.treatmentLabel} risk projection`}
                    >
                      {[0, 0.25, 0.5, 0.75, 1].map((level) => (
                        <line
                          key={`${item.key}-grid-${level}`}
                          x1={CHART_PADDING_X}
                          y1={item.chartData.toY(level)}
                          x2={CHART_WIDTH - CHART_PADDING_X}
                          y2={item.chartData.toY(level)}
                          stroke="rgba(100,116,139,0.22)"
                          strokeWidth={1}
                        />
                      ))}
                      {monthTicks.map((tick) => (
                        <line
                          key={`${item.key}-tick-${tick}`}
                          x1={item.chartData.toX(tick)}
                          y1={CHART_HEIGHT - CHART_PADDING_Y}
                          x2={item.chartData.toX(tick)}
                          y2={CHART_PADDING_Y}
                          stroke="rgba(100,116,139,0.2)"
                          strokeWidth={1}
                        />
                      ))}
                      <path d={item.chartData.areaPath} fill={item.area} />
                      <polyline
                        fill="none"
                        stroke={item.stroke}
                        strokeWidth={3}
                        points={item.chartData.linePoints}
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      />
                      {item.chartData.marker && (
                        <>
                          <line
                            x1={item.chartData.marker.x}
                            y1={CHART_HEIGHT - CHART_PADDING_Y}
                            x2={item.chartData.marker.x}
                            y2={CHART_PADDING_Y}
                            stroke="rgba(147,197,253,0.7)"
                            strokeWidth={1.5}
                            strokeDasharray="4 4"
                          />
                          <circle cx={item.chartData.marker.x} cy={item.chartData.marker.y} r={5} fill={item.markerFill} />
                          <circle cx={item.chartData.marker.x} cy={item.chartData.marker.y} r={9} fill={item.markerHalo} />
                        </>
                      )}
                    </svg>
                    <div className="mt-1 flex items-center justify-between text-[9px] text-slate-500 px-1">
                      <span>M0</span>
                      <span>M{maxMonth}</span>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="h-[220px] rounded-lg border border-slate-700/50 bg-slate-950/50 flex items-center justify-center">
                <p className="text-xs text-slate-400">Comparison curves are loading.</p>
              </div>
            )
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

          {compareMode && activePoint && comparisonActivePoint && (
            <div className="mt-3 rounded-lg border border-slate-700/60 bg-slate-900/50 p-3">
              <p className="text-[10px] uppercase tracking-wider text-slate-400 font-semibold mb-1">
                Side-by-side readout
              </p>
              <p className="text-xs text-slate-200 leading-relaxed">
                At month {clampedMonth}, {selectedTreatmentLabel} projects {asPercent(activePoint.risk)} while{' '}
                {comparisonTreatmentLabel} projects {asPercent(comparisonActivePoint.risk)}.
                {comparisonDeltaPercent !== null && (
                  <> Difference: {comparisonDeltaPercent > 0 ? '+' : ''}{comparisonDeltaPercent}%.</>
                )}
              </p>
            </div>
          )}

          <div className="mt-3 rounded-lg border border-slate-700/60 bg-slate-900/50 p-3 space-y-2">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h4 className="text-[11px] font-semibold text-slate-100">What is happening now?</h4>
              {activePoint && activeRiskBand && (
                <span
                  className={`text-[10px] font-semibold rounded-md px-2 py-0.5 border ${activeRiskBand.badgeClassName}`}
                >
                  {asPercent(activePoint.risk)} · {activeRiskBand.label}
                </span>
              )}
            </div>
            <p data-testid="timeline-projection-sentence" className="text-xs text-slate-200 leading-relaxed">
              {projectionSentence}
            </p>
          </div>
        </div>

        <div className="rounded-xl border border-slate-800/60 bg-[#0a1324] p-4 space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h3 className="text-xs font-semibold text-slate-200 uppercase tracking-wider">Explainability</h3>
            <div className="flex items-center gap-2">
              <label htmlFor="patient-friendly-mode" className="text-[10px] text-slate-400 uppercase tracking-wider">
                Patient-friendly mode
              </label>
              <ToggleSwitch
                id="patient-friendly-mode"
                checked={patientFriendlyMode}
                onChange={setPatientFriendlyMode}
              />
            </div>
          </div>
          <p className="text-[10px] text-slate-500">
            {patientFriendlyMode
              ? 'Plain language is prioritized, and model-internal metrics are hidden.'
              : 'Technical view enabled: confidence metrics and SHAP snippets are included.'}
          </p>

          <div className="rounded-lg border border-slate-700/60 bg-slate-900/50 p-3 space-y-1">
            <div className="flex justify-between text-[10px] text-slate-400">
              <span>Status</span>
              <span className="font-mono text-slate-200">{prediction?.status ?? 'Not available'}</span>
            </div>
            <div className="flex justify-between text-[10px] text-slate-400">
              <span>Projection source</span>
              <span className="font-mono text-slate-200">{sourceLabel}</span>
            </div>
            {!patientFriendlyMode && (
              <div className="flex justify-between text-[10px] text-slate-400">
                <span>Prediction ID</span>
                <span className="font-mono text-slate-200">{prediction?.prediction_id ?? 'Not available'}</span>
              </div>
            )}
          </div>

          {!patientFriendlyMode && (
            <div className="rounded-lg border border-slate-700/60 bg-slate-900/50 p-3">
              <div className="text-[10px] text-slate-400 uppercase tracking-wider font-semibold mb-2">
                Confidence Metrics
              </div>
              {confidenceEntries.length ? (
                <div className="space-y-1.5">
                  {confidenceEntries.slice(0, 4).map(([key, value]) => (
                    <div key={key} className="flex justify-between text-[10px] text-slate-300">
                      <span className="truncate pr-2">{key}</span>
                      <span className="font-mono text-emerald-300">{value.toFixed(3)}</span>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-[10px] text-slate-500">Not available for this prediction snapshot.</p>
              )}
            </div>
          )}

          {!patientFriendlyMode && (
            <div className="rounded-lg border border-slate-700/60 bg-slate-900/50 p-3">
              <div className="text-[10px] text-slate-400 uppercase tracking-wider font-semibold mb-2">
                SHAP Snippets
              </div>
              {shapSnippets.length ? (
                <div className="space-y-1.5">
                  {shapSnippets.map(({ key, text, value }) => (
                    <div key={key} className="text-[10px] text-slate-300 leading-relaxed">
                      <span className={value >= 0 ? 'text-rose-300' : 'text-cyan-300'}>{text}</span>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-[10px] text-slate-500">Not available for this prediction snapshot.</p>
              )}
            </div>
          )}

          <div className="rounded-lg border border-slate-700/60 bg-slate-900/50 p-3">
            <button
              type="button"
              className="w-full flex items-center justify-between text-[10px] text-slate-300 uppercase tracking-wider font-semibold"
              onClick={() => setGlossaryOpen((prev) => !prev)}
            >
              <span>Glossary</span>
              <span className="text-slate-500">{glossaryOpen ? 'Hide' : 'Show'}</span>
            </button>
            {glossaryOpen && (
              <dl className="mt-2 space-y-2 text-[10px] text-slate-300">
                <div>
                  <dt className="text-slate-100 font-semibold">Metastasis</dt>
                  <dd className="text-slate-400">When cancer spreads from where it started to another body area.</dd>
                </div>
                <div>
                  <dt className="text-slate-100 font-semibold">Baseline risk</dt>
                  <dd className="text-slate-400">Your starting estimated risk before projected treatment effects.</dd>
                </div>
                <div>
                  <dt className="text-slate-100 font-semibold">Treatment response</dt>
                  <dd className="text-slate-400">How risk is projected to change after a selected treatment plan.</dd>
                </div>
                <div>
                  <dt className="text-slate-100 font-semibold">Projection horizon</dt>
                  <dd className="text-slate-400">How many future months this estimate covers on the timeline.</dd>
                </div>
              </dl>
            )}
          </div>
        </div>
      </div>
    </section>
  );
}
