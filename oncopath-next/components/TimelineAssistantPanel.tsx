'use client';

import React, { useEffect, useMemo, useState } from 'react';
import { Bot, ShieldAlert } from 'lucide-react';
import {
  requestTimelineExplain,
  type TimelineExplainRequest,
  type TimelineExplainResponse,
} from '@/lib/api';
import { trackTimeToFirstExplanation } from '@/lib/productMetrics';
import { getTimelinePointAtMonth, type TimelinePoint, type TreatmentPresetId } from '@/lib/timeline';

interface TimelineAssistantPanelProps {
  patientSummary: {
    age: number;
    primarySite: string;
    keyMutations: string[];
  };
  selectedOrgan: string;
  selectedOrganLabel: string;
  selectedTreatment: TreatmentPresetId;
  selectedTreatmentLabel: string;
  selectedMonth: number;
  timeline: TimelinePoint[];
  actionLog: string[];
}

function buildFallbackExplanation({
  selectedOrganLabel,
  selectedTreatmentLabel,
  selectedMonth,
  timeline,
}: {
  selectedOrganLabel: string;
  selectedTreatmentLabel: string;
  selectedMonth: number;
  timeline: TimelinePoint[];
}): TimelineExplainResponse {
  const activePoint = getTimelinePointAtMonth(timeline, selectedMonth);
  const riskText = activePoint ? `${Math.round(activePoint.risk * 100)}%` : 'unavailable';

  return {
    plain_explanation: `Assistant service is temporarily unavailable. Current projected risk for ${selectedOrganLabel} at month ${selectedMonth} with ${selectedTreatmentLabel} is ${riskText}.`,
    next_step_suggestion: 'You can keep exploring by changing month, treatment, or organ while live guidance reconnects.',
    safety_note: 'This is not medical advice.',
  };
}

export function TimelineAssistantPanel({
  patientSummary,
  selectedOrgan,
  selectedOrganLabel,
  selectedTreatment,
  selectedTreatmentLabel,
  selectedMonth,
  timeline,
  actionLog,
}: TimelineAssistantPanelProps) {
  const idleResponse: TimelineExplainResponse = {
    plain_explanation: 'Select an organ to load timeline guidance.',
    next_step_suggestion: 'Pick an organ and month to generate an explanation.',
    safety_note: 'This is not medical advice.',
  };
  const [response, setResponse] = useState<TimelineExplainResponse>({
    plain_explanation: idleResponse.plain_explanation,
    next_step_suggestion: idleResponse.next_step_suggestion,
    safety_note: idleResponse.safety_note,
  });
  const [isFallback, setIsFallback] = useState(false);
  const [resolvedRequestKey, setResolvedRequestKey] = useState('');

  const mutationSignature = useMemo(
    () => patientSummary.keyMutations.join('|'),
    [patientSummary.keyMutations]
  );
  const hasTimelineContext = selectedOrgan.length > 0 && timeline.length > 0;
  const requestKey = useMemo(() => {
    if (!hasTimelineContext) {
      return '';
    }
    const maxMonth = timeline[timeline.length - 1]?.month ?? 0;
    return [
      selectedOrgan,
      selectedTreatment,
      selectedMonth.toString(),
      mutationSignature,
      maxMonth.toString(),
    ].join('|');
  }, [hasTimelineContext, mutationSignature, selectedMonth, selectedOrgan, selectedTreatment, timeline]);
  const loading = hasTimelineContext && requestKey !== resolvedRequestKey;
  const optimisticResponse = useMemo<TimelineExplainResponse>(
    () => ({
      plain_explanation: `Preparing an updated explanation for ${selectedOrganLabel} at month ${selectedMonth}.`,
      next_step_suggestion: 'Checking timeline context and translating it into patient-friendly guidance.',
      safety_note: 'This is not medical advice.',
    }),
    [selectedMonth, selectedOrganLabel]
  );
  const visibleResponse = hasTimelineContext ? (loading ? optimisticResponse : response) : idleResponse;
  const showFallback = hasTimelineContext && isFallback && !loading;

  useEffect(() => {
    if (!hasTimelineContext) {
      return;
    }

    const payload: TimelineExplainRequest = {
      patient_summary: {
        age: patientSummary.age,
        primary_site: patientSummary.primarySite,
        key_mutations: patientSummary.keyMutations,
      },
      selected_organ: selectedOrgan,
      treatment: selectedTreatment,
      timeline_points: timeline,
      active_month: selectedMonth,
    };

    const controller = new AbortController();
    let cancelled = false;

    requestTimelineExplain(payload, controller.signal)
      .then((assistantResponse) => {
        if (cancelled || controller.signal.aborted) {
          return;
        }
        setResponse(assistantResponse);
        setIsFallback(false);
        setResolvedRequestKey(requestKey);
        trackTimeToFirstExplanation('assistant');
      })
      .catch(() => {
        if (cancelled || controller.signal.aborted) {
          return;
        }
        setResponse(
          buildFallbackExplanation({
            selectedOrganLabel,
            selectedTreatmentLabel,
            selectedMonth,
            timeline,
          })
        );
        setIsFallback(true);
        setResolvedRequestKey(requestKey);
        trackTimeToFirstExplanation('fallback');
      });

    return () => {
      cancelled = true;
      controller.abort();
    };
  }, [
    hasTimelineContext,
    mutationSignature,
    patientSummary.age,
    patientSummary.primarySite,
    patientSummary.keyMutations,
    requestKey,
    selectedMonth,
    selectedOrgan,
    selectedOrganLabel,
    selectedTreatment,
    selectedTreatmentLabel,
    timeline,
  ]);

  return (
    <section className="mt-4 rounded-xl border border-slate-800/60 bg-[#091225] p-4 space-y-3">
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-2">
          <Bot size={14} className="text-cyan-300" />
          <div>
            <h3 className="text-xs font-semibold text-slate-100 uppercase tracking-wider">
              Timeline Assistant
            </h3>
            <p
              data-testid="timeline-assistant-context"
              className="text-[10px] text-slate-400 mt-0.5"
            >
              {selectedOrganLabel} · {selectedTreatmentLabel} · M{selectedMonth}
            </p>
          </div>
        </div>
        <span className="text-[10px] rounded-md border border-slate-700/80 bg-slate-900/60 px-2 py-0.5 text-slate-300">
          {loading ? 'Refreshing…' : showFallback ? 'Fallback guidance' : 'Live guidance'}
        </span>
      </div>

      {showFallback && (
        <div className="rounded-lg border border-amber-500/30 bg-amber-950/20 p-2 text-[10px] text-amber-100 flex items-start gap-2">
          <ShieldAlert size={12} className="text-amber-300 mt-0.5 flex-shrink-0" />
          <span>Assistant API unavailable. Showing deterministic local guidance.</span>
        </div>
      )}

      <div className="rounded-lg border border-slate-700/60 bg-slate-900/50 p-3 space-y-2">
        <p className="text-[10px] uppercase tracking-wider text-slate-400 font-semibold">Explanation</p>
        <p data-testid="timeline-assistant-plain" className="text-xs text-slate-200 leading-relaxed">
          {visibleResponse.plain_explanation}
        </p>
      </div>

      <div className="rounded-lg border border-slate-700/60 bg-slate-900/50 p-3 space-y-2">
        <p className="text-[10px] uppercase tracking-wider text-slate-400 font-semibold">Next Step</p>
        <p data-testid="timeline-assistant-next-step" className="text-xs text-cyan-200 leading-relaxed">
          {visibleResponse.next_step_suggestion}
        </p>
      </div>

      <p data-testid="timeline-assistant-safety-note" className="text-[10px] text-amber-200">
        {visibleResponse.safety_note}
      </p>

      <div className="rounded-lg border border-slate-700/60 bg-slate-900/50 p-3">
        <div className="flex items-center justify-between">
          <p className="text-[10px] uppercase tracking-wider text-slate-400 font-semibold">Copilot Action Log</p>
          <span className="text-[10px] text-slate-500">{actionLog.length}</span>
        </div>
        <ul data-testid="timeline-action-log" className="mt-2 space-y-1.5">
          {actionLog.length ? (
            actionLog.slice(0, 8).map((entry, index) => (
              <li key={`${entry}-${index}`} className="text-[11px] text-slate-200">
                {entry}
              </li>
            ))
          ) : (
            <li className="text-[10px] text-slate-500">No Copilot actions applied yet.</li>
          )}
        </ul>
      </div>
    </section>
  );
}
