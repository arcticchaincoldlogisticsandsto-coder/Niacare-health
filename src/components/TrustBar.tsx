import React from 'react';
import { ShieldCheck, Ambulance, Award, Lock } from 'lucide-react';
import { Language, Theme } from '../types';
import { TRANSLATIONS } from '../data/translations';

interface TrustBarProps {
  language: Language;
  theme?: Theme;
}

export const TrustBar: React.FC<TrustBarProps> = ({ language, theme = 'light' }) => {
  const t = TRANSLATIONS.trustBar;
  const isDark = theme === 'dark';

  const trustItems = [
    {
      id: 'security',
      icon: (
        <div
          className={`w-12 h-12 rounded-2xl flex items-center justify-center flex-shrink-0 shadow-sm border ${
            isDark
              ? 'bg-blue-950/70 border-blue-800/80 text-cyan-400'
              : 'bg-blue-100/90 border-blue-200 text-[#0F4C81]'
          }`}
        >
          <ShieldCheck className="w-7 h-7" />
        </div>
      ),
      title: t.securityTitle[language],
      desc: t.securityDesc[language],
    },
    {
      id: 'speed',
      icon: (
        <div
          className={`w-12 h-12 rounded-2xl flex items-center justify-center flex-shrink-0 shadow-sm border ${
            isDark
              ? 'bg-red-950/70 border-red-800/80 text-red-400'
              : 'bg-red-100/90 border-red-200 text-[#E51E2B]'
          }`}
        >
          <Ambulance className="w-7 h-7" />
        </div>
      ),
      title: t.speedTitle[language],
      desc: t.speedDesc[language],
    },
    {
      id: 'certified',
      icon: (
        <div
          className={`w-12 h-12 rounded-2xl flex items-center justify-center flex-shrink-0 shadow-sm border ${
            isDark
              ? 'bg-cyan-950/70 border-cyan-800/80 text-cyan-300'
              : 'bg-cyan-100/90 border-cyan-200 text-cyan-700'
          }`}
        >
          <Award className="w-7 h-7" />
        </div>
      ),
      title: t.certifiedTitle[language],
      desc: t.certifiedDesc[language],
    },
    {
      id: 'privacy',
      icon: (
        <div
          className={`w-12 h-12 rounded-2xl flex items-center justify-center flex-shrink-0 shadow-sm border ${
            isDark
              ? 'bg-emerald-950/70 border-emerald-800/80 text-emerald-400'
              : 'bg-emerald-100/90 border-emerald-200 text-emerald-700'
          }`}
        >
          <Lock className="w-7 h-7" />
        </div>
      ),
      title: t.privacyTitle[language],
      desc: t.privacyDesc[language],
    },
  ];

  return (
    <div
      className={`w-full py-5 px-4 sm:px-6 mt-6 border-t transition-colors duration-300 ${
        isDark ? 'bg-[#0A1522] border-slate-800' : 'bg-[#EBF3FB] border-[#D5E5F5]'
      }`}
    >
      <div className="max-w-5xl mx-auto grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {trustItems.map((item) => (
          <div
            key={item.id}
            className={`rounded-2xl p-3.5 border flex items-center gap-3.5 shadow-xs transition-all ${
              isDark
                ? 'bg-[#101F31] border-slate-800 text-slate-200 hover:bg-[#14263D] hover:border-slate-700'
                : 'bg-white/80 backdrop-blur-xs border-[#D0E2F4] text-slate-800 hover:bg-white hover:shadow-md'
            }`}
          >
            {item.icon}
            <div className="min-w-0 flex-1">
              <h4 className={`text-sm font-bold leading-tight ${isDark ? 'text-white' : 'text-slate-900'}`}>
                {item.title}
              </h4>
              <p className={`text-[11px] leading-snug mt-0.5 ${isDark ? 'text-slate-400' : 'text-slate-600'}`}>
                {item.desc}
              </p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};
