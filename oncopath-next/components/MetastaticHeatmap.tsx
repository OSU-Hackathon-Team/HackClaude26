'use client';

import React, { useMemo, useState } from 'react';
import { ANATOMY_MAPPING_2D } from '@/lib/anatomy';
import { motion, AnimatePresence } from 'framer-motion';

interface MetastaticHeatmapProps {
    risks: { [key: string]: number };
}

interface OrganMarker {
    id: string;
    label: string;
    region: string;
    system: string;
    x: number;
    y: number;
    prob: number;
    color: string;
}

export function MetastaticHeatmap({ risks }: MetastaticHeatmapProps) {
    const [hoveredOrgan, setHoveredOrgan] = useState<string | null>(null);

    const getRiskColor = (prob: number) => {
        const risk = prob * 100;
        if (risk > 70) return '#ef4444';
        if (risk > 40) return '#f59e0b';
        return '#10b981';
    };

    const organMarkers = useMemo<OrganMarker[]>(() => {
        return Object.entries(risks).map((entry) => {
            const [site, prob] = entry;
            const meta = ANATOMY_MAPPING_2D[site];
            if (!meta || (prob * 100) < 5) return null;
            return { id: site, ...meta, prob: prob * 100, color: getRiskColor(prob) };
        }).filter((marker): marker is OrganMarker => marker !== null);
    }, [risks]);

    return (
        <div className="w-full h-full bg-[#030712] flex items-center justify-center relative overflow-hidden">
            {/* Background grid */}
            <div className="absolute inset-0 opacity-[0.03]"
                style={{ backgroundImage: 'radial-gradient(circle, #64748b 1px, transparent 1px)', backgroundSize: '24px 24px' }}
            />

            {/* Subtle crosshair */}
            <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                <div className="w-px h-full bg-gradient-to-b from-transparent via-slate-700/10 to-transparent" />
            </div>

            {/* Main visualization — aspect ratio matches SVG viewBox 200:480 = 5:12 */}
            <div className="relative h-[88%] aspect-[5/12]">
                {/* SVG Body Silhouette */}
                <svg viewBox="0 0 200 480" className="w-full h-full" fill="none" xmlns="http://www.w3.org/2000/svg">
                    {/* Head */}
                    <ellipse cx="100" cy="30" rx="24" ry="28"
                        fill="#1e293b" fillOpacity="0.5" stroke="#334155" strokeWidth="0.5" />

                    {/* Body outline */}
                    <path d={`
                        M 88 56
                        C 82 60, 72 66, 58 74
                        C 46 80, 40 88, 38 98
                        C 36 115, 34 138, 32 162
                        C 30 186, 28 212, 26 238
                        C 24 252, 26 260, 32 262
                        C 38 264, 42 258, 44 248
                        C 46 228, 48 205, 50 182
                        C 52 158, 55 132, 58 112
                        C 60 98, 64 90, 66 88
                        L 66 100
                        C 64 128, 64 152, 64 172
                        C 64 188, 66 200, 66 208
                        C 66 214, 64 220, 62 232
                        C 60 256, 58 280, 56 308
                        C 54 336, 54 365, 54 392
                        C 54 416, 52 436, 50 448
                        C 48 456, 52 464, 60 464
                        C 68 464, 74 462, 76 454
                        C 78 444, 78 432, 80 408
                        C 82 382, 84 355, 86 330
                        C 88 305, 90 280, 92 255
                        C 94 236, 97 222, 100 216
                        C 103 222, 106 236, 108 255
                        C 110 280, 112 305, 114 330
                        C 116 355, 118 382, 120 408
                        C 122 432, 122 444, 124 454
                        C 126 462, 132 464, 140 464
                        C 148 464, 152 456, 150 448
                        C 148 436, 146 416, 146 392
                        C 146 365, 146 336, 144 308
                        C 142 280, 140 256, 138 232
                        C 136 220, 134 214, 134 208
                        C 134 200, 136 188, 136 172
                        C 136 152, 136 128, 134 100
                        L 134 88
                        C 136 90, 140 98, 142 112
                        C 145 132, 148 158, 150 182
                        C 152 205, 154 228, 156 248
                        C 158 258, 162 264, 168 262
                        C 174 260, 176 252, 174 238
                        C 172 212, 170 186, 168 162
                        C 166 138, 164 115, 162 98
                        C 160 88, 154 80, 142 74
                        C 128 66, 118 60, 112 56
                        Z
                    `}
                        fill="#1e293b" fillOpacity="0.5" stroke="#334155" strokeWidth="0.5"
                    />
                </svg>

                {/* Organ markers overlay — positioned to cover the SVG exactly */}
                <div className="absolute top-0 left-0 w-full h-full" style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%' }}>
                    <AnimatePresence>
                        {organMarkers.map((marker) => (
                            <motion.div
                                key={marker.id}
                                initial={{ scale: 0, opacity: 0 }}
                                animate={{ scale: 1, opacity: 1 }}
                                exit={{ scale: 0, opacity: 0 }}
                                transition={{ type: 'spring', stiffness: 260, damping: 22 }}
                                style={{
                                    position: 'absolute',
                                    left: `${marker.x}%`,
                                    top: `${marker.y}%`,
                                    transform: 'translate(-50%, -50%)',
                                }}
                                className="flex flex-col items-center group z-20 cursor-default"
                                onMouseEnter={() => setHoveredOrgan(marker.id)}
                                onMouseLeave={() => setHoveredOrgan(null)}
                            >
                                {/* Ping ring */}
                                <div className="absolute w-6 h-6 rounded-full animate-ping-ring"
                                    style={{ backgroundColor: marker.color, opacity: 0.12, left: '50%', top: '50%' }}
                                />

                                {/* Glow halo */}
                                <div className="absolute w-10 h-10 rounded-full blur-xl animate-pulse-glow"
                                    style={{ backgroundColor: marker.color, left: '50%', top: '50%', transform: 'translate(-50%, -50%)' }}
                                />

                                {/* Dot */}
                                <div
                                    className="w-3 h-3 rounded-full border-2 border-[#030712]/80 relative z-30 transition-transform duration-200 group-hover:scale-[1.8]"
                                    style={{
                                        backgroundColor: marker.color,
                                        boxShadow: `0 0 10px ${marker.color}, 0 0 3px ${marker.color}`
                                    }}
                                />

                                {/* Tooltip */}
                                <div className={`absolute z-50 pointer-events-none transition-all duration-200 ${marker.y < 15 ? 'top-5' : 'bottom-5'
                                    } left-1/2 -translate-x-1/2 ${hoveredOrgan === marker.id ? 'opacity-100 scale-100' : 'opacity-0 scale-90'
                                    }`}>
                                    <div className="bg-[#0f172a]/95 backdrop-blur-xl border border-slate-700/50 px-3 py-2 rounded-lg shadow-2xl whitespace-nowrap">
                                        <div className="flex items-center gap-2 mb-1">
                                            <div className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: marker.color }} />
                                            <span className="text-[11px] font-semibold text-slate-100">{marker.label}</span>
                                        </div>
                                        <div className="flex items-center gap-2">
                                            <div className="flex-1 h-1 bg-slate-800 rounded-full overflow-hidden min-w-[50px]">
                                                <div className="h-full rounded-full" style={{ width: `${Math.min(marker.prob, 100)}%`, backgroundColor: marker.color }} />
                                            </div>
                                            <span className="text-[11px] font-bold font-mono" style={{ color: marker.color }}>
                                                {Math.round(marker.prob)}%
                                            </span>
                                        </div>
                                        <span className="text-[8px] text-slate-500 mt-0.5 block">{marker.system} System</span>
                                    </div>
                                </div>

                                {/* Permanent label */}
                                {marker.prob > 12 && (
                                    <span className="mt-2 text-[7px] font-semibold text-slate-500 uppercase tracking-wider pointer-events-none opacity-40 group-hover:opacity-100 transition-opacity whitespace-nowrap">
                                        {marker.label}
                                    </span>
                                )}
                            </motion.div>
                        ))}
                    </AnimatePresence>
                </div>
            </div>

            {/* HUD labels */}
            <div className="absolute top-6 left-6 z-10 space-y-1">
                <div className="flex items-center gap-2">
                    <div className="w-1.5 h-1.5 bg-emerald-500 rounded-full animate-pulse shadow-[0_0_6px_rgba(16,185,129,0.5)]" />
                    <span className="text-[9px] font-semibold text-emerald-400/70 uppercase tracking-[0.2em]">Live Anatomical HUD</span>
                </div>
                <div className="text-[8px] text-slate-600 font-mono tracking-widest ml-3.5">
                    Seed &amp; Soil Mapping v5.1
                </div>
            </div>
        </div>
    );
}
