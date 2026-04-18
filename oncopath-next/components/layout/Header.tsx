import React from 'react';
import { Search, Bell, ShieldCheck } from 'lucide-react';
import { UserButton, SignInButton, Show } from '@clerk/nextjs';

export function Header() {
  return (
    <header className="w-full h-[72px] bg-zinc-950 border-b border-zinc-800/80 flex items-center justify-between px-6 z-40 flex-shrink-0">
      <div className="flex items-center gap-4 flex-1">
        <div className="relative w-full max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-500" size={16} />
          <input
            type="text"
            placeholder="Search Patient ID, Profiles, or Biomarkers..."
            className="w-full bg-zinc-900 border border-zinc-800 rounded-lg py-2 pl-10 pr-4 text-sm text-zinc-200 placeholder-zinc-500 focus:outline-none focus:ring-2 focus:ring-blue-500/50 transition-all font-medium"
          />
        </div>
      </div>

      <div className="flex items-center gap-6">
        <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-zinc-900 border border-zinc-800">
          <ShieldCheck size={14} className="text-emerald-500" />
          <span className="text-[10px] uppercase tracking-wider font-bold text-zinc-300">System Healthy</span>
        </div>

        <div className="flex items-center gap-4 pl-4 border-l border-zinc-800">
          <button className="text-zinc-400 hover:text-zinc-200 transition-colors relative">
            <Bell size={20} />
            <span className="absolute -top-1 -right-1 w-2.5 h-2.5 bg-blue-500 rounded-full border-2 border-zinc-950" />
          </button>
          
          <Show when="signed-out">
            <SignInButton forceRedirectUrl="/viewer" mode="modal">
              <button className="px-3 py-1.5 bg-blue-600/90 hover:bg-blue-500 rounded-lg text-[10px] font-bold uppercase tracking-wider text-white transition-all">
                Login
              </button>
            </SignInButton>
          </Show>
          
          <Show when="signed-in">
            <UserButton />
          </Show>
        </div>
      </div>
    </header>
  );
}
