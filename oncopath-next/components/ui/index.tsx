'use client';

import * as React from 'react';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs: ClassValue[]) {
    return twMerge(clsx(inputs));
}

/* ─── Slider ─── */
export function Slider({ value, min, max, step, onValueChange, className }: {
    value: number[], min: number, max: number, step: number,
    onValueChange: (val: number[]) => void, className?: string
}) {
    return (
        <input
            type="range" min={min} max={max} step={step} value={value[0]}
            onChange={(e) => onValueChange([parseInt(e.target.value)])}
            className={cn("w-full", className)}
        />
    );
}

/* ─── Toggle Switch ─── */
export function ToggleSwitch({ checked, onChange, id }: {
    checked: boolean; onChange: (checked: boolean) => void; id?: string;
}) {
    return (
        <button
            id={id} type="button" role="switch" aria-checked={checked}
            onClick={() => onChange(!checked)}
            className={`toggle-switch ${checked ? 'active' : ''}`}
        />
    );
}

/* ─── Checkbox (legacy) ─── */
export function Checkbox({ id, checked, onCheckedChange, className }: {
    id: string, checked: boolean, onCheckedChange: (checked: boolean) => void, className?: string
}) {
    return (
        <input id={id} type="checkbox" checked={checked}
            onChange={(e) => onCheckedChange(e.target.checked)}
            className={cn("w-4 h-4 rounded border-slate-700 bg-slate-800 text-blue-600 focus:ring-blue-500", className)}
        />
    );
}

/* ─── Select ─── */
export function Select({ value, onValueChange, children }: { value: string, onValueChange: (v: string) => void, children: React.ReactNode }) {
    return (
        <div className="relative">
            <select value={value} onChange={(e) => onValueChange(e.target.value)}
                className="w-full bg-[#0f172a] border border-slate-700/60 text-slate-100 text-sm rounded-lg focus:ring-1 focus:ring-blue-500/50 focus:border-blue-500/50 block p-2.5 pr-8 appearance-none transition-colors hover:border-slate-600"
            >
                {children}
            </select>
            <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-2.5 text-slate-500">
                <svg className="fill-current h-3.5 w-3.5" viewBox="0 0 20 20"><path d="M10 12l-6-6h12l-6 6z" /></svg>
            </div>
        </div>
    );
}
export function SelectContent({ children }: { children: React.ReactNode }) { return <>{children}</>; }
export function SelectItem({ value, children }: { value: string, children: React.ReactNode }) { return <option value={value}>{children}</option>; }
export function SelectTrigger({ children }: { children: React.ReactNode }) { return <>{children}</>; }
export function SelectValue() { return null; }

/* ─── Input ─── */
export function Input({ className, ...props }: React.InputHTMLAttributes<HTMLInputElement>) {
    return (
        <input
            className={cn(
                "flex h-9 w-full rounded-lg border border-slate-700/60 bg-[#0f172a] px-3 py-1 text-sm shadow-sm transition-colors placeholder:text-slate-600 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-blue-500/50 focus-visible:border-blue-500/50 hover:border-slate-600",
                className
            )}
            {...props}
        />
    );
}

/* ─── Label ─── */
export function Label({ className, ...props }: React.LabelHTMLAttributes<HTMLLabelElement>) {
    return <label className={cn("text-sm font-medium leading-none", className)} {...props} />;
}

/* ─── ScrollArea ─── */
export function ScrollArea({ children, className }: { children: React.ReactNode, className?: string }) {
    return <div className={cn("overflow-y-auto overflow-x-hidden", className)}>{children}</div>;
}

/* ─── Badge ─── */
export function Badge({ children, className }: { children: React.ReactNode, className?: string, variant?: string }) {
    return (
        <span className={cn("inline-flex items-center rounded-full px-2 py-0.5 text-xs font-semibold", className)}>
            {children}
        </span>
    );
}

/* ─── Card ─── */
export function Card({ children, className }: { children: React.ReactNode, className?: string }) {
    return <div className={cn("rounded-xl border border-slate-800/60 bg-slate-900/50 shadow", className)}>{children}</div>;
}
export function CardHeader({ children, className }: { children: React.ReactNode, className?: string }) {
    return <div className={cn("flex flex-col space-y-1.5 p-6", className)}>{children}</div>;
}
export function CardTitle({ children, className }: { children: React.ReactNode, className?: string }) {
    return <h3 className={cn("font-semibold leading-none tracking-tight", className)}>{children}</h3>;
}
export function CardContent({ children, className }: { children: React.ReactNode, className?: string }) {
    return <div className={cn("p-6 pt-0", className)}>{children}</div>;
}
