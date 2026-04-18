'use client';

import React from 'react';
import { X, Activity, Dna, Layers, TrendingUp, AlertTriangle } from 'lucide-react';
import { ANATOMY_MAPPING_3D } from '@/lib/anatomy3d';

export interface OrganPopoverData {
  organId: string;
  name: string;
  clientX: number;
  clientY: number;
}

interface OrganPopoverProps {
  data: OrganPopoverData;
  risk: number | undefined;           // 0-1 or undefined if no data
  activeMutations: string[];          // e.g. ['KRAS', 'TP53']
  projectedRisk12m: number | undefined;  // estimated after 12 months
  onClose: () => void;
}

function riskLabel(r: number) {
  if (r > 0.7) return { label: 'High Risk', color: 'text-red-400',    bar: 'bg-red-500',    glow: 'shadow-[0_0_8px_rgba(239,68,68,0.5)]' };
  if (r > 0.4) return { label: 'Moderate',  color: 'text-amber-400',  bar: 'bg-amber-500',  glow: 'shadow-[0_0_8px_rgba(245,158,11,0.4)]' };
  if (r > 0.1) return { label: 'Low Risk',  color: 'text-emerald-400',bar: 'bg-emerald-500',glow: 'shadow-[0_0_8px_rgba(16,185,129,0.4)]' };
  return               { label: 'Baseline', color: 'text-zinc-500',   bar: 'bg-zinc-700',   glow: '' };
}

export function OrganPopover({ data, risk, activeMutations, projectedRisk12m, onClose }: OrganPopoverProps) {
  const meta = ANATOMY_MAPPING_3D[data.organId];
  const r = risk ?? 0;
  const { label, color, bar, glow } = riskLabel(r);
  const pct = Math.round(r * 100);
  const p12 = projectedRisk12m !== undefined ? Math.round(projectedRisk12m * 100) : null;

  // Smart positioning — keep card on-screen
  const CARD_W = 320;
  const CARD_H = 320;
  const vw = typeof window !== 'undefined' ? window.innerWidth : 1440;
  const vh = typeof window !== 'undefined' ? window.innerHeight : 900;
  const left = Math.min(data.clientX + 16, vw - CARD_W - 16);
  const top  = Math.min(data.clientY - 20, vh - CARD_H - 16);

  return (
    <div
      className="fixed z-50 animate-slide-up"
      style={{ left, top, width: CARD_W }}
      onClick={(e) => e.stopPropagation()}
    >
      <div className="bg-zinc-900/90 backdrop-blur-xl border border-zinc-800 rounded-2xl shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="flex items-start justify-between px-4 pt-4 pb-3 border-b border-zinc-800">
          <div>
            <h3 className="text-zinc-100 font-display font-bold text-base leading-tight">{data.name}</h3>
            <p className="text-zinc-500 text-[10px] font-mono uppercase tracking-widest mt-0.5">
              {meta?.region} · {meta?.system}
            </p>
          </div>
          <button
            onClick={onClose}
            className="w-6 h-6 flex items-center justify-center rounded-lg text-zinc-600 hover:text-zinc-300 hover:bg-zinc-800 transition-colors flex-shrink-0 mt-0.5"
          >
            <X size={12} />
          </button>
        </div>

        <div className="px-4 py-3 space-y-4">
          {/* Risk score */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-1.5">
                <Activity size={12} className="text-orange-400" />
                <span className="text-zinc-400 text-[11px] font-semibold uppercase tracking-wider">Metastatic Risk</span>
              </div>
              <span className={`text-lg font-bold font-mono ${color}`}>{pct}%</span>
            </div>
            <div className="h-1.5 w-full bg-zinc-800 rounded-full overflow-hidden">
              <div
                className={`h-full rounded-full transition-all duration-700 ${bar} ${glow}`}
                style={{ width: `${Math.max(pct, 2)}%` }}
              />
            </div>
            <div className={`text-[10px] font-semibold mt-1 ${color}`}>{label}</div>
          </div>

          {/* Mutations */}
          <div>
            <div className="flex items-center gap-1.5 mb-2">
              <Dna size={12} className="text-orange-400" />
              <span className="text-zinc-400 text-[11px] font-semibold uppercase tracking-wider">Active Mutations</span>
            </div>
            {activeMutations.length > 0 ? (
              <div className="flex flex-wrap gap-1.5">
                {activeMutations.map(gene => (
                  <span key={gene} className="px-2 py-0.5 rounded-md bg-red-500/10 border border-red-500/25 text-red-400 text-[10px] font-mono font-bold tracking-widest">
                    {gene}
                  </span>
                ))}
              </div>
            ) : (
              <span className="text-zinc-600 text-[11px]">No known driver mutations</span>
            )}
          </div>

          {/* System */}
          <div className="flex items-center gap-1.5">
            <Layers size={12} className="text-orange-400" />
            <span className="text-zinc-400 text-[11px] font-semibold uppercase tracking-wider">System</span>
            <span className="ml-auto text-zinc-300 text-[11px] font-mono">{meta?.system ?? '—'}</span>
          </div>

          {/* 12-month projection */}
          {p12 !== null && (
            <div className="flex items-center gap-1.5">
              <TrendingUp size={12} className="text-orange-400" />
              <span className="text-zinc-400 text-[11px] font-semibold uppercase tracking-wider">12-month projection</span>
              <span className={`ml-auto text-[11px] font-bold font-mono ${riskLabel(p12 / 100).color}`}>
                {p12}%
                {p12 > pct && <span className="text-red-500 ml-1 text-[9px]">↑</span>}
                {p12 < pct && <span className="text-emerald-500 ml-1 text-[9px]">↓</span>}
              </span>
            </div>
          )}

          {/* Description */}
          {meta?.description && (
            <p className="text-zinc-500 text-[10px] leading-relaxed border-t border-zinc-800 pt-3">
              {meta.description}
            </p>
          )}

          {/* High risk warning */}
          {r > 0.7 && (
            <div className="flex items-start gap-2 bg-red-500/8 border border-red-500/20 rounded-lg px-3 py-2">
              <AlertTriangle size={11} className="text-red-400 mt-0.5 flex-shrink-0" />
              <p className="text-[10px] text-red-300 leading-tight">
                Elevated tropism detected. Recommend clinical evaluation of this site.
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
