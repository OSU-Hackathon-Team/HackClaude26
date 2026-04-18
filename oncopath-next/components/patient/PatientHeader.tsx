import React from 'react';
import { Badge } from "@/components/ui/badge";

export function PatientHeader({ profile }: { profile: any }) {
  return (
    <div className="flex justify-between items-start p-6 bg-zinc-900/50 backdrop-blur-md border border-zinc-800 rounded-xl mb-6 shadow-lg">
      <div className="flex flex-col gap-1">
        <h1 className="text-2xl font-bold text-zinc-100 tracking-tight">{profile.name || "Patient File"}</h1>
        <p className="text-zinc-400 font-mono text-[11px] tracking-wider uppercase">
          ID: {profile.id || "PTH-" + Math.random().toString(10).slice(2, 8)} <span className="opacity-50">|</span> {profile.age}yo <span className="opacity-50">|</span> {profile.sex} <span className="opacity-50">|</span> {profile.primary_site} <span className="text-blue-400/80">({profile.oncotree_code})</span>
        </p>
      </div>
      <div className="flex gap-2 items-center">
        <span className="text-[10px] text-zinc-500 uppercase tracking-widest font-bold mr-2">Biomarkers</span>
        {Object.entries(profile.mutations || {}).map(([gene, status]) => (
          status === 1 && (
             <Badge key={gene} variant="outline" className="border-red-500/30 text-red-400 bg-red-500/10 hover:bg-red-500/20 px-3 py-1 font-mono tracking-widest text-[10px]">
               {gene} +
             </Badge>
          )
        ))}
      </div>
    </div>
  );
}
