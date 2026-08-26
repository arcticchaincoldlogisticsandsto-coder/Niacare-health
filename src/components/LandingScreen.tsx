import React from 'react';
import { HeartHandshake, CalendarCheck, Siren, ArrowRight } from 'lucide-react';
import { Language, Theme } from '../types';

interface LandingScreenProps {
  language: Language;
  theme: Theme;
  onGetStarted: () => void;
  onSignIn: () => void;
}

export const LandingScreen: React.FC<LandingScreenProps> = ({ language, theme, onGetStarted, onSignIn }) => {
  const isDark = theme === 'dark';
  const isSw = language === 'sw';

  const features = [
    {
      Icon: CalendarCheck,
      title: isSw ? 'Weka Miadi' : 'Book Appointments',
      desc: isSw ? 'Pata daktari halisi dakika chache' : 'Real doctors, booked in minutes',
    },
    {
      Icon: HeartHandshake,
      title: isSw ? 'Huduma Kamili' : 'Complete Care',
      desc: isSw ? 'Rekodi, dawa, na maabara mahali pamoja' : 'Records, prescriptions, and labs in one place',
    },
    {
      Icon: Siren,
      title: isSw ? 'Dharura' : 'Emergency Ready',
      desc: isSw ? 'Gari la wagonjwa bila kuingia akaunti' : 'Ambulance dispatch, no login required',
    },
  ];

  return (
    <div className="pt-2 pb-6 animate-in fade-in slide-in-from-bottom-2 duration-300">
      {/* The tagline itself ("Healthcare For Everyone") is already the
          Header's slogan right above — this is the supporting line under
          it, not a second competing headline. */}
      <div className="text-center px-2 mb-6">
        <p className="text-sm text-slate-500 dark:text-slate-400">
          {isSw
            ? 'Madaktari halisi, miadi halisi, na rekodi zako za afya — mahali pamoja.'
            : 'Real doctors, real appointments, and your health records — all in one place.'}
        </p>
      </div>

      <div className="space-y-2.5 mb-6">
        {features.map(({ Icon, title, desc }) => (
          <div key={title} className={`nc-card p-4 flex items-center gap-3 ${isDark ? '' : ''}`}>
            <div className={`w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 ${isDark ? 'bg-cyan-500/15 text-cyan-300' : 'bg-blue-50 text-[#0A4275]'}`}>
              <Icon className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-slate-900 dark:text-white">{title}</h3>
              <p className="text-xs text-slate-500 dark:text-slate-400">{desc}</p>
            </div>
          </div>
        ))}
      </div>

      <div className="space-y-2.5">
        <button
          type="button"
          onClick={onGetStarted}
          className="w-full py-3.5 rounded-2xl bg-[#0A4275] dark:bg-cyan-500 text-white dark:text-[#041D34] font-black text-sm flex items-center justify-center gap-2 shadow-md active:scale-98 transition-all"
        >
          {isSw ? 'Anza — Fungua Akaunti' : 'Get Started — Create Account'}
          <ArrowRight className="w-4 h-4" />
        </button>
        <button
          type="button"
          onClick={onSignIn}
          className="w-full py-3 rounded-2xl border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 font-bold text-sm hover:bg-slate-50 dark:hover:bg-slate-800 transition-all"
        >
          {isSw ? 'Tayari una akaunti? Ingia' : 'Already have an account? Sign in'}
        </button>
      </div>
    </div>
  );
};
