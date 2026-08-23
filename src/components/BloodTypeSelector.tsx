import React from 'react';
import { Droplet, HelpCircle, Check } from 'lucide-react';
import { Language, Theme } from '../types';
import { TRANSLATIONS } from '../data/translations';

export const BLOOD_TYPES = [
  { value: 'O+', label: 'O+', color: 'text-rose-500' },
  { value: 'A+', label: 'A+', color: 'text-rose-500' },
  { value: 'B+', label: 'B+', color: 'text-rose-500' },
  { value: 'AB+', label: 'AB+', color: 'text-rose-500' },
  { value: 'O-', label: 'O-', color: 'text-amber-500' },
  { value: 'A-', label: 'A-', color: 'text-amber-500' },
  { value: 'B-', label: 'B-', color: 'text-amber-500' },
  { value: 'AB-', label: 'AB-', color: 'text-amber-500' },
  { value: 'unknown', label: '?', color: 'text-slate-400' },
];

interface BloodTypeSelectorProps {
  value?: string;
  onChange: (bloodType: string) => void;
  language: Language;
  theme?: Theme;
}

export const BloodTypeSelector: React.FC<BloodTypeSelectorProps> = ({
  value = '',
  onChange,
  language,
  theme = 'light',
}) => {
  const isDark = theme === 'dark';
  const t = TRANSLATIONS.identity;

  return (
    <div
      id="blood-type-selector"
      className={`rounded-2xl p-3 sm:p-3.5 border transition-all ${
        isDark ? 'bg-[#08121E] border-slate-700/80' : 'bg-[#F6F9FD] border-blue-100/90'
      }`}
    >
      <div className="flex items-center justify-between gap-2 mb-2">
        <div className="flex items-center gap-1.5">
          <div
            className={`w-5 h-5 rounded-lg flex items-center justify-center ${
              isDark ? 'bg-rose-500/20 text-rose-400' : 'bg-rose-50 text-rose-600'
            }`}
          >
            <Droplet className="w-3.5 h-3.5 fill-current" />
          </div>
          <label className={`text-xs font-bold ${isDark ? 'text-slate-200' : 'text-slate-800'}`}>
            {t.bloodTypeLabel?.[language] || 'Kundi la Damu (Blood Type)'}
          </label>
        </div>

        {value ? (
          <span
            className={`text-[11px] font-black px-2 py-0.5 rounded-full flex items-center gap-1 border ${
              value === 'unknown'
                ? isDark
                  ? 'bg-slate-800 border-slate-700 text-slate-300'
                  : 'bg-slate-100 border-slate-200 text-slate-700'
                : isDark
                ? 'bg-rose-950/80 border-rose-800 text-rose-300'
                : 'bg-rose-50 border-rose-200 text-rose-700'
            }`}
          >
            <Droplet className="w-3 h-3 fill-current" />
            {value === 'unknown' ? (t.bloodTypeUnknown?.[language] || 'Sina Uhakika') : value}
          </span>
        ) : (
          <span className={`text-[10px] ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>
            {t.bloodTypeHelp?.[language] || 'Hiari / Optional'}
          </span>
        )}
      </div>

      {/* Interactive Blood Type Badges / Pills */}
      <div className="grid grid-cols-5 sm:grid-cols-9 gap-1.5">
        {BLOOD_TYPES.map((bt) => {
          const isSelected = value === bt.value;
          const isUnknown = bt.value === 'unknown';

          return (
            <button
              key={bt.value}
              type="button"
              id={`blood-type-btn-${bt.value.replace('+', 'pos').replace('-', 'neg')}`}
              onClick={() => onChange(isSelected ? '' : bt.value)}
              className={`py-1.5 px-1 rounded-xl text-xs font-mono font-bold flex flex-col items-center justify-center transition-all cursor-pointer border ${
                isSelected
                  ? isDark
                    ? 'bg-rose-600 border-rose-500 text-white shadow-md shadow-rose-900/30 scale-102'
                    : 'bg-rose-600 border-rose-600 text-white shadow-md shadow-rose-500/20 scale-102'
                  : isDark
                  ? 'bg-[#0E1F33] border-slate-700/80 text-slate-300 hover:border-slate-500 hover:text-white'
                  : 'bg-white border-slate-200 text-slate-700 hover:border-rose-300 hover:text-rose-600'
              }`}
            >
              <span className="text-xs">{bt.label}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
};
