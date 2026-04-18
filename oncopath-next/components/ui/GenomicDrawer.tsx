'use client';
import React, { useState } from 'react';
import { FlaskConical, X, Image as ImageIcon, Upload, CheckCircle2 } from 'lucide-react';
import { GenomicLab } from '@/components/GenomicLab';
import { PatientProfile } from '@/lib/api';

interface GenomicDrawerProps {
  profile: PatientProfile;
  onChange: (p: PatientProfile) => void;
  onRunSimulation: (image?: string) => void;
}

export function GenomicDrawer({ profile, onChange, onRunSimulation }: GenomicDrawerProps) {
  const [open, setOpen] = useState(false);
  const [slideImage, setSlideImage] = useState<string | null>(null);
  const [fileName, setFileName] = useState<string | null>(null);
  
  const mutationCount = Object.keys(profile.mutations).length;

  return (
    <>
      {/* FAB trigger — bottom-left floating button */}
      <button
        onClick={() => setOpen(true)}
        title="Configure patient parameters"
        className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-zinc-900/80 backdrop-blur-md border border-zinc-800 hover:border-orange-600/50 text-zinc-400 hover:text-zinc-100 text-xs font-semibold tracking-wide transition-all shadow-lg group"
      >
        <FlaskConical size={14} className="group-hover:text-orange-400 transition-colors" />
        <span>Parameters</span>
        {mutationCount > 0 && (
          <span className="bg-orange-600/20 border border-orange-600/30 text-orange-400 text-[9px] font-bold px-1.5 py-0.5 rounded-full font-mono">
            {mutationCount}
          </span>
        )}
      </button>

      {/* Backdrop */}
      {open && (
        <div className="fixed inset-0 z-40 bg-black/50 backdrop-blur-[2px]" onClick={() => setOpen(false)} />
      )}

      {/* Slide-in panel from left */}
      <div className={`fixed left-0 top-0 h-full w-[340px] z-50 bg-zinc-900/95 backdrop-blur-xl border-r border-zinc-800 shadow-2xl transition-transform duration-300 ease-out flex flex-col ${open ? 'translate-x-0' : '-translate-x-full'}`}>
        <div className="flex items-center justify-between px-5 py-4 border-b border-zinc-800">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-orange-600/20 border border-orange-600/30 flex items-center justify-center">
              <FlaskConical size={14} className="text-orange-400" />
            </div>
            <div>
              <h2 className="text-sm font-bold text-zinc-100" style={{ fontFamily: "'Space Grotesk', sans-serif" }}>Patient Parameters</h2>
              <p className="text-[10px] text-zinc-500 font-mono uppercase tracking-wider">{mutationCount} mutations active</p>
            </div>
          </div>
          <button onClick={() => setOpen(false)} className="w-7 h-7 flex items-center justify-center rounded-lg hover:bg-zinc-800 text-zinc-600 hover:text-zinc-300 transition-colors">
            <X size={14} />
          </button>
        </div>
        <div className="flex-1 overflow-hidden">
          <GenomicLab profile={profile} onChange={onChange} />
        </div>
        <div className="p-4 border-t border-zinc-800 bg-zinc-900/80 space-y-3">
          {/* File Upload UI */}
          <div className="relative">
            <input 
              type="file" 
              accept="image/*" 
              className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10"
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) {
                  setFileName(file.name);
                  const reader = new FileReader();
                  reader.onload = (ev) => {
                    if (typeof ev.target?.result === 'string') {
                      setSlideImage(ev.target.result);
                    }
                  };
                  reader.readAsDataURL(file);
                }
              }}
            />
            <div className={`flex items-center justify-between px-3 py-2 rounded-lg border ${slideImage ? 'bg-emerald-500/10 border-emerald-500/30' : 'bg-zinc-800/50 border-zinc-700'} transition-colors`}>
              <div className="flex items-center gap-2">
                <ImageIcon size={14} className={slideImage ? 'text-emerald-400' : 'text-zinc-400'} />
                <span className={`text-xs ${slideImage ? 'text-emerald-300 font-medium' : 'text-zinc-400'} truncate font-mono max-w-[180px]`}>
                  {fileName || 'Upload tumor slide'}
                </span>
              </div>
              {slideImage ? <CheckCircle2 size={14} className="text-emerald-400" /> : <Upload size={14} className="text-zinc-500" />}
            </div>
          </div>

          <button 
            onClick={() => { onRunSimulation(slideImage || undefined); setOpen(false); }} 
            className="w-full py-2.5 rounded-xl bg-orange-600 hover:bg-orange-500 text-white text-sm font-bold tracking-wide transition-all shadow-[0_0_15px_rgba(234,88,12,0.4)]"
          >
            Run Simulation
          </button>
        </div>
      </div>
    </>
  );
}
