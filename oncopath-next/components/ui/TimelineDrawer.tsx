'use client';
import React, { useState } from 'react';
import { TrendingUp, X, ChevronRight } from 'lucide-react';
import { TimelinePanel } from '@/components/TimelinePanel';
import { TimelineAssistantPanel } from '@/components/TimelineAssistantPanel';
import type { PredictionSnapshot } from '@/lib/api';
import type { TimelinePoint, TreatmentPresetId } from '@/lib/timeline';

interface TimelineDrawerProps {
  organOptions: { key: string; label: string }[];
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
  patientSummary: {
    age: number;
    primarySite: string;
    keyMutations: string[];
  };
  selectedOrganLabel: string;
  selectedTreatmentLabel: string;
  actionLog: string[];
  onOrganChange: (o: string) => void;
  onTreatmentChange: (t: TreatmentPresetId) => void;
  onMonthChange: (m: number) => void;
  onPlaybackPlay: () => void;
  onPlaybackPause: () => void;
  onPlaybackReplay: () => void;
}

export function TimelineDrawer(props: TimelineDrawerProps) {
  const [open, setOpen] = useState(false);

  const activeRisk =
    props.baselineRisk !== null ? Math.round(props.baselineRisk * 100) : null;

  const riskColor =
    activeRisk === null ? 'bg-zinc-500' :
    activeRisk > 50 ? 'bg-red-500' :
    activeRisk > 20 ? 'bg-amber-500' : 'bg-blue-500';

  return (
    <>
      {/* FAB trigger */}
      <button
        onClick={() => setOpen(true)}
        className="shimmer flex items-center gap-2.5 px-4 py-2.5 rounded-xl text-xs font-semibold tracking-wide glass border border-zinc-700/60 hover:border-zinc-600 text-zinc-200 hover:text-white transition-all shadow-lg"
      >
        <TrendingUp size={14} className="text-blue-400" />
        <span>Timeline</span>
        {activeRisk !== null && (
          <span className={`${riskColor} text-white text-[9px] font-bold px-1.5 py-0.5 rounded-full`}>
            {activeRisk}%
          </span>
        )}
        <ChevronRight size={12} className="opacity-50" />
      </button>

      {/* Backdrop */}
      {open && (
        <div
          className="fixed inset-0 z-40 bg-black/40 backdrop-blur-sm"
          onClick={() => setOpen(false)}
        />
      )}

      {/* Slide-in panel from right */}
      <div
        className={`fixed right-0 top-0 h-full w-[420px] z-50 glass-strong shadow-2xl transition-transform duration-300 ease-out flex flex-col ${
          open ? 'translate-x-0' : 'translate-x-full'
        }`}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-zinc-800/60">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-zinc-700 to-zinc-800 border border-zinc-600/50 flex items-center justify-center">
              <TrendingUp size={14} className="text-blue-400" />
            </div>
            <div>
              <h2 className="text-sm font-bold text-zinc-100">Metastatic Timeline</h2>
              <p className="text-[10px] text-zinc-500 font-mono uppercase tracking-wider">
                {props.selectedOrgan ? `${props.organOptions.find(o => o.key === props.selectedOrgan)?.label ?? props.selectedOrgan} · M${props.selectedMonth}` : 'Select organ'}
              </p>
            </div>
          </div>
          <button
            onClick={() => setOpen(false)}
            className="w-7 h-7 flex items-center justify-center rounded-lg hover:bg-zinc-800 text-zinc-500 hover:text-zinc-300 transition-colors"
          >
            <X size={14} />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto">
          <TimelinePanel
            organOptions={props.organOptions}
            selectedOrgan={props.selectedOrgan}
            selectedTreatment={props.selectedTreatment}
            selectedMonth={props.selectedMonth}
            timeline={props.timeline}
            timelineSource={props.timelineSource}
            isTimelinePending={props.isTimelinePending}
            timelineErrorMessage={props.timelineErrorMessage}
            baselineRisk={props.baselineRisk}
            prediction={props.prediction}
            isTimelinePlaying={props.isTimelinePlaying}
            onOrganChange={props.onOrganChange}
            onTreatmentChange={props.onTreatmentChange}
            onMonthChange={props.onMonthChange}
            onPlaybackPlay={props.onPlaybackPlay}
            onPlaybackPause={props.onPlaybackPause}
            onPlaybackReplay={props.onPlaybackReplay}
          />
          <div className="px-5 pb-5">
            <TimelineAssistantPanel
              patientSummary={props.patientSummary}
              selectedOrgan={props.selectedOrgan}
              selectedOrganLabel={props.selectedOrganLabel}
              selectedTreatment={props.selectedTreatment}
              selectedTreatmentLabel={props.selectedTreatmentLabel}
              selectedMonth={props.selectedMonth}
              timeline={props.timeline}
              actionLog={props.actionLog}
            />
          </div>
        </div>
      </div>
    </>
  );
}
