import React from 'react';
import { SignInButton, SignUpButton, Show } from "@clerk/nextjs";
import { Activity, ShieldCheck, Database, Zap } from 'lucide-react';

export default function LandingPage() {
  return (
    <main className="min-h-screen bg-[#030712] relative flex flex-col items-center overflow-hidden">
       {/* Background Effects */}
       <div className="absolute inset-0 z-0">
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[800px] h-[800px] bg-blue-900/20 rounded-full blur-[120px] pointer-events-none" />
          <div className="absolute top-[20%] left-[30%] w-[400px] h-[400px] bg-purple-900/20 rounded-full blur-[100px] pointer-events-none" />
          <div className="absolute inset-0 bg-[url('https://transparenttextures.com/patterns/dark-matter.png')] opacity-20" />
       </div>

       {/* Navigation / Header */}
       <nav className="w-full relative z-20 px-8 py-6 flex justify-between items-center max-w-7xl">
          <div className="flex items-center gap-3">
             <div className="w-10 h-10 bg-slate-900 border border-slate-800 rounded-xl flex items-center justify-center shadow-[0_0_20px_rgba(59,130,246,0.15)]">
               <Activity className="text-blue-500" size={20} />
             </div>
             <span className="text-xl font-bold tracking-tight text-slate-100 flex items-center gap-2">
               OncoPath <span className="text-slate-600 font-mono text-sm tracking-widest uppercase">Nexus</span>
             </span>
          </div>

          {/* Fallback buttons in header just in case layout header missed it */}
          <div className="flex items-center gap-4">
             <Show when="signed-out">
                <SignInButton forceRedirectUrl="/viewer" mode="modal"><button className="text-sm font-semibold text-slate-300 hover:text-white transition-colors">Sign In</button></SignInButton>
                <SignUpButton forceRedirectUrl="/viewer" mode="modal"><button className="px-5 py-2.5 bg-blue-600 hover:bg-blue-500 text-white text-sm font-semibold rounded-lg shadow-[0_0_15px_rgba(59,130,246,0.4)] transition-all">
                      Get Started Free
                   </button></SignUpButton>
             </Show>
             <Show when="signed-in">
                <a href="/viewer" className="px-5 py-2.5 bg-purple-600 hover:bg-purple-500 text-white text-sm font-semibold rounded-lg shadow-[0_0_15px_rgba(168,85,247,0.4)] transition-all flex items-center gap-2">
                   Access 3D Viewer <Zap size={14} />
                </a>
             </Show>
          </div>
       </nav>

       {/* Hero Section */}
       <div className="relative z-10 max-w-5xl w-full flex flex-col items-center justify-center flex-1 text-center px-6 mt-12 mb-32">
          <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full border border-blue-500/20 bg-blue-500/10 text-blue-400 text-xs font-semibold tracking-wider uppercase mb-8">
             <ShieldCheck size={14} />
             Authentication Required
          </div>
          
          <h1 className="text-6xl md:text-7xl font-extrabold tracking-tight text-white mb-8 leading-tight">
             Simulate Metastasis in <span className="text-transparent bg-clip-text bg-gradient-to-r from-blue-400 to-purple-500">Full 3D</span>
          </h1>
          
          <p className="text-lg md:text-xl text-slate-400 max-w-3xl mb-12 leading-relaxed">
             OncoPath leverages probabilistic genomic models mapping to precise anatomical bounds yielding 3D interactive visualizations. Securely log in to load your personalized spatial environment.
          </p>

          <Show when="signed-out">
             <div className="flex items-center gap-4">
               <SignInButton forceRedirectUrl="/viewer" mode="modal"><button className="px-8 py-4 bg-slate-800 hover:bg-slate-700 text-white text-lg font-semibold rounded-xl border border-slate-700 transition-all">
                     Log In to Dashboard
                  </button></SignInButton>
               <SignUpButton forceRedirectUrl="/viewer" mode="modal"><button className="px-8 py-4 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white text-lg font-bold rounded-xl shadow-[0_0_30px_rgba(59,130,246,0.3)] hover:shadow-[0_0_40px_rgba(59,130,246,0.5)] transition-all relative overflow-hidden group">
                     Create Free Account
                     <div className="absolute inset-0 bg-white/20 translate-x-[-100%] group-hover:translate-x-[100%] transition-transform duration-700" />
                  </button></SignUpButton>
             </div>
          </Show>

          <Show when="signed-in">
            <div className="p-8 border border-slate-800/60 bg-slate-900/50 backdrop-blur-md rounded-2xl animate-fade-in-up mt-8">
              <Database className="mx-auto text-emerald-400 mb-4" size={32} />
              <h3 className="text-2xl font-bold text-white mb-2">Welcome Back.</h3>
              <p className="text-slate-400 mb-6 font-medium">Your 3D WebGL session has been authorized. Proceed to the engine.</p>
              <a href="/viewer" className="inline-flex px-8 py-4 bg-emerald-600 hover:bg-emerald-500 text-white text-lg font-bold rounded-xl shadow-[0_0_30px_rgba(16,185,129,0.3)] hover:shadow-[0_0_40px_rgba(16,185,129,0.5)] transition-all">
                 Launch 3D Environment
              </a>
            </div>
          </Show>
       </div>
    </main>
  );
}
