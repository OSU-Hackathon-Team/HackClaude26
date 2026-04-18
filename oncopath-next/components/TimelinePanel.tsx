'use client';

import React, { useMemo, useState } from 'react';
import { AlertCircle, ActivitySquare } from 'lucide-react';
import { Select, SelectItem, Slider, ToggleSwitch } from '@/components/ui';
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
  baselineRisk: number | null;
  prediction: PredictionSnapshot | null;
  onOrganChange: (organ: string) => void;
  onTreatmentChange: (treatment: TreatmentPresetId) => void;
  onMonthChange: (month: number) => void;
}

const CHART_WIDTH = 640;
const CHART_HEIGHT = 220;
const CHART_PADDING_X = 44;
const CHART_PADDING_Y = 24;
const TREATMENT_IDS = new Set<string>(TIMELINE_TREATMENT_PRESETS.map((preset) => preset.id));

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
  baselineRisk,
  prediction,
  onOrganChange,
  onTreatmentChange,
  onMonthChange,
}: TimelinePanelProps) {
  const [patientFriendlyMode, setPatientFriendlyMode] = useState(true);
  const [glossaryOpen, setGlossaryOpen] = useState(false);

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
  const sourceLabel =
    timelineSource === 'backend' ? 'Live projection (backend)' : 'Instant estimate (local)';

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
            <p className="text-xs text-slate-200 leading-relaxed">{projectionSentence}</p>
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
