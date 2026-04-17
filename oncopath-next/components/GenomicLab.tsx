'use client';

import React from 'react';
import { PatientProfile } from '@/lib/api';
import {
    Label, Input, Select, SelectItem,
    Slider, ScrollArea, Badge, ToggleSwitch
} from '@/components/ui';
import { DRIVER_GENES, OTHER_MUTATION_GENES } from '@/lib/simulation-config';
import { Activity, Dna, User } from 'lucide-react';

interface GenomicLabProps {
    profile: PatientProfile;
    onChange: (profile: PatientProfile) => void;
}

export function GenomicLab({ profile, onChange }: GenomicLabProps) {
    const updateField = <K extends keyof PatientProfile>(field: K, value: PatientProfile[K]) => {
        onChange({ ...profile, [field]: value });
    };

    const toggleMutation = (gene: string, checked: boolean) => {
        const newMutations = { ...profile.mutations };
        if (checked) {
            newMutations[gene] = 1;
        } else {
            delete newMutations[gene];
        }
        onChange({ ...profile, mutations: newMutations });
    };

    const mutationCount = Object.keys(profile.mutations).length;

    return (
        <div className="flex flex-col h-full bg-[#060a14] text-slate-100 border-r border-slate-800/40">
            {/* Header */}
            <div className="p-5 pb-4">
                <div className="flex items-center gap-3">
                    <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-blue-600 to-emerald-500 flex items-center justify-center shadow-lg shadow-blue-500/20">
                        <Activity size={16} className="text-white" />
                    </div>
                    <div>
                        <h2 className="text-base font-bold tracking-tight">OncoPath</h2>
                        <p className="text-[10px] text-slate-500 uppercase tracking-wider font-medium">Metastatic Risk Engine</p>
                    </div>
                </div>
            </div>

            <div className="w-full h-px bg-gradient-to-r from-transparent via-slate-800 to-transparent" />

            <ScrollArea className="flex-1 px-5 pt-5">
                <div className="space-y-6 pb-6">
                    {/* Patient Profile */}
                    <section className="space-y-3">
                        <div className="flex items-center gap-2">
                            <User size={11} className="text-slate-600" />
                            <h3 className="text-[10px] font-semibold text-slate-500 uppercase tracking-[0.15em]">Patient Profile</h3>
                        </div>

                        <div className="bg-[#0a1020] rounded-xl border border-slate-800/40 p-4 space-y-4">
                            {/* Age */}
                            <div className="space-y-2">
                                <div className="flex justify-between items-center">
                                    <Label className="text-xs text-slate-400">Age</Label>
                                    <span className="text-sm font-bold text-blue-400 font-mono tabular-nums">{profile.age}</span>
                                </div>
                                <Slider
                                    value={[profile.age]} min={18} max={90} step={1}
                                    onValueChange={([val]) => updateField('age', val)}
                                />
                            </div>

                            {/* Sex */}
                            <div className="space-y-1.5">
                                <Label className="text-xs text-slate-400">Sex</Label>
                                <Select value={profile.sex} onValueChange={(val) => updateField('sex', val)}>
                                    <SelectItem value="Male">Male</SelectItem>
                                    <SelectItem value="Female">Female</SelectItem>
                                </Select>
                            </div>

                            {/* Primary Site */}
                            <div className="space-y-1.5">
                                <Label className="text-xs text-slate-400">Primary Site</Label>
                                <Input value={profile.primary_site} onChange={(e) => updateField('primary_site', e.target.value)} />
                            </div>

                            {/* OncoTree Code */}
                            <div className="space-y-1.5">
                                <Label className="text-xs text-slate-400">OncoTree Code</Label>
                                <Input value={profile.oncotree_code} onChange={(e) => updateField('oncotree_code', e.target.value)} />
                            </div>
                        </div>
                    </section>

                    {/* Genomic Panel */}
                    <section className="space-y-3">
                        <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2">
                                <Dna size={11} className="text-slate-600" />
                                <h3 className="text-[10px] font-semibold text-slate-500 uppercase tracking-[0.15em]">Genomic Panel</h3>
                            </div>
                            <Badge className="text-[9px] bg-blue-500/10 text-blue-400 border border-blue-500/20 px-2 py-0.5">
                                {mutationCount} active
                            </Badge>
                        </div>

                        <div className="bg-[#0a1020] rounded-xl border border-slate-800/40 p-4 space-y-4">
                            {/* Driver Genes */}
                            <div className="space-y-2.5">
                                <h4 className="text-[10px] font-semibold text-blue-400/80 uppercase tracking-wider">Driver Genes</h4>
                                <div className="space-y-1">
                                    {DRIVER_GENES.map((gene) => (
                                        <div key={gene} className="flex items-center justify-between py-1.5 px-2 rounded-lg hover:bg-slate-800/30 transition-colors">
                                            <label htmlFor={`gene-${gene}`} className="text-xs font-medium cursor-pointer text-slate-300">{gene}</label>
                                            <ToggleSwitch
                                                id={`gene-${gene}`}
                                                checked={!!profile.mutations[gene]}
                                                onChange={(checked) => toggleMutation(gene, checked)}
                                            />
                                        </div>
                                    ))}
                                </div>
                            </div>

                            <div className="w-full h-px bg-slate-800/40" />

                            {/* Other Mutations */}
                            <div className="space-y-2.5">
                                <h4 className="text-[10px] font-semibold text-emerald-400/80 uppercase tracking-wider">Other Mutations</h4>
                                <div className="space-y-1">
                                    {OTHER_MUTATION_GENES.map((gene) => (
                                        <div key={gene} className="flex items-center justify-between py-1.5 px-2 rounded-lg hover:bg-slate-800/30 transition-colors">
                                            <label htmlFor={`gene-${gene}`} className="text-xs font-medium cursor-pointer text-slate-300">{gene}</label>
                                            <ToggleSwitch
                                                id={`gene-${gene}`}
                                                checked={!!profile.mutations[gene]}
                                                onChange={(checked) => toggleMutation(gene, checked)}
                                            />
                                        </div>
                                    ))}
                                </div>
                            </div>
                        </div>
                    </section>
                </div>
            </ScrollArea>

            <div className="w-full h-px bg-gradient-to-r from-transparent via-slate-800 to-transparent" />

            <div className="p-4 text-[10px] text-slate-600 flex justify-between items-center">
                <span className="font-mono">MSK-MET v3.0</span>
                <Badge className="text-[8px] bg-slate-800/30 border border-slate-800/40 text-slate-500 uppercase tracking-wider">
                    Research Only
                </Badge>
            </div>
        </div>
    );
}
