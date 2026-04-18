import React from 'react';
import { Activity, Layers, ActivitySquare, Settings, Users, Database } from 'lucide-react';

const NAV = [
  { icon: <Layers size={16} />,         label: 'Dashboard',     active: true  },
  { icon: <Users size={16} />,          label: 'Patients',      active: false },
  { icon: <ActivitySquare size={16} />, label: 'Risk Models',   active: false },
  { icon: <Database size={16} />,       label: 'Scans',         active: false },
];

export function Sidebar() {
  return (
    <aside className="w-[52px] h-full bg-[#09090b] border-r border-zinc-800/80 flex flex-col items-center py-4 flex-shrink-0 z-50">
      {/* Logo mark */}
      <div className="w-8 h-8 bg-gradient-to-br from-blue-600 to-indigo-600 rounded-lg flex items-center justify-center shadow-[0_0_12px_rgba(59,130,246,0.35)] mb-6">
        <Activity className="text-white" size={15} />
      </div>

      <nav className="flex-1 flex flex-col items-center gap-1 w-full px-1.5">
        {NAV.map((item, i) => (
          <a
            key={i}
            href="#"
            title={item.label}
            className={`w-full flex items-center justify-center p-2.5 rounded-lg transition-all ${
              item.active
                ? 'bg-zinc-800 text-blue-400'
                : 'text-zinc-600 hover:text-zinc-300 hover:bg-zinc-900'
            }`}
          >
            {item.icon}
          </a>
        ))}
      </nav>

      <a
        href="#"
        title="Settings"
        className="w-full flex items-center justify-center p-2.5 rounded-lg text-zinc-600 hover:text-zinc-300 hover:bg-zinc-900 transition-all mx-1.5"
      >
        <Settings size={16} />
      </a>
    </aside>
  );
}
