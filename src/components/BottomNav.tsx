import React from 'react';
import { Home, Calendar, FileText, Pill, User } from 'lucide-react';
import type { Language } from '../types';

interface BottomNavProps {
  active: 'home' | 'appointments' | 'records' | 'prescriptions' | 'profile';
  onChange: (key: BottomNavProps['active']) => void;
  language: Language;
}

const ITEMS: { key: BottomNavProps['active']; label: string; labelSw: string; Icon: React.ComponentType<{ className?: string }> }[] = [
  { key: 'home', label: 'Home', labelSw: 'Nyumbani', Icon: Home },
  { key: 'appointments', label: 'Visits', labelSw: 'Ziara', Icon: Calendar },
  { key: 'records', label: 'Records', labelSw: 'Rekodi', Icon: FileText },
  { key: 'prescriptions', label: 'Meds', labelSw: 'Dawa', Icon: Pill },
  { key: 'profile', label: 'Profile', labelSw: 'Wasifu', Icon: User },
];

export const BottomNav: React.FC<BottomNavProps> = ({ active, onChange, language }) => {
  const isSw = language === 'sw';
  return (
    <div className="fixed bottom-0 left-0 right-0 z-40 flex justify-center pointer-events-none">
      <div className="w-full max-w-[430px] px-3 pb-3 pointer-events-auto">
        <nav className="rounded-xl border shadow-[0_6px_18px_rgba(35,68,104,0.12)] px-2 py-1.5 flex items-center justify-between"
          style={{ backgroundColor: 'var(--nc-surface)', borderColor: 'var(--nc-border)' }}
        >
          {ITEMS.map(({ key, label, labelSw, Icon }) => {
            const selected = active === key;
            return (
              <button
                key={key}
                type="button"
                onClick={() => onChange(key)}
                className={`flex flex-col items-center justify-center gap-0.5 px-2 py-1.5 rounded-lg min-w-[3.25rem] transition-colors ${
                  selected
                    ? 'bg-[#0A4275] text-white dark:bg-cyan-500 dark:text-[#041D34]'
                    : 'text-slate-500 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800'
                }`}
              >
                <Icon className="w-4 h-4" />
                <span className="text-[9px] font-bold">{isSw ? labelSw : label}</span>
              </button>
            );
          })}
        </nav>
      </div>
    </div>
  );
};
