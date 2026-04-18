import React from 'react';
import { HelpCircle } from 'lucide-react';

export function RiskGauge({ risk, organLabel }: { risk: number | null, organLabel: string }) {
  if (risk === null) return null;

  const percentage = Math.round(risk * 100);
  
  let riskColor = 'bg-blue-500';
  let textColor = 'text-blue-400';
  let glowColor = 'shadow-blue-500/50';
  
  if (percentage > 50) {
    riskColor = 'bg-red-500';
    textColor = 'text-red-400';
    glowColor = 'shadow-red-500/50';
  } else if (percentage > 20) {
    riskColor = 'bg-orange-500';
    textColor = 'text-orange-400';
    glowColor = 'shadow-orange-500/50';
  }

  return (
    <div className="flex flex-col gap-3 p-6 bg-zinc-900/50 backdrop-blur-md border border-zinc-800 rounded-xl shadow-lg relative overflow-hidden group">
      {/* Background Pulse Effect for high risk */}
      {percentage > 50 && (
         <div className="absolute inset-0 bg-red-500/5 animate-pulse pointer-events-none" />
      )}
      
      <div className="flex justify-between items-end relative z-10">
        <div>
          <h3 className="text-sm font-semibold text-zinc-100 mb-1">Metastatic Tropism</h3>
          <p className="text-[11px] text-zinc-400 uppercase tracking-widest font-mono">Target: {organLabel}</p>
        </div>
        <div className={`text-4xl font-extrabold tracking-tighter ${textColor} font-mono`}>
          {percentage}%
        </div>
      </div>
      
      <div className="relative z-10 mt-2">
        <div className="h-1.5 w-full bg-zinc-800 rounded-full overflow-hidden flex">
          <div 
             className={`h-full ${riskColor} rounded-full transition-all duration-1000 ease-in-out shadow-[0_0_10px] ${glowColor}`} 
             style={{ width: `${percentage}%` }} 
          />
        </div>
      </div>

      <div className="relative z-10 mt-4 flex items-center gap-1.5">
        <HelpCircle size={12} className="text-zinc-500" />
        <button className="text-[10px] text-zinc-400 hover:text-zinc-200 uppercase tracking-wider font-semibold transition-colors underline decoration-zinc-700 underline-offset-4">
          Explain clinical reasoning.
        </button>
      </div>
    </div>
  );
}
