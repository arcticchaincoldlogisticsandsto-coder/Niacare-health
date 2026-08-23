import React, { useState, useEffect } from 'react';
import { Wifi, Settings } from 'lucide-react';
import { Language, Theme } from '../types';
import { TRANSLATIONS } from '../data/translations';
import { formatLiveTime } from '../utils/dateUtils';

interface HeaderProps {
  language: Language;
  theme: Theme;
  onOpenSettingsModal?: () => void;
}

export const Header: React.FC<HeaderProps> = ({
  language,
  theme,
  onOpenSettingsModal,
}) => {
  const isDark = theme === 'dark';
  const [currentTime, setCurrentTime] = useState<Date>(new Date());

  // Real-time clock updating every second
  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentTime(new Date());
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  const timeDisplay = formatLiveTime(currentTime, false);

  return (
    <header className="w-full pt-3 pb-3 px-3 sm:px-5 relative bg-transparent transition-colors duration-300">
      {/* Top Phone Status Bar & Controls */}
      <div
        className={`flex items-center justify-between text-xs font-semibold px-1 sm:px-2 mb-3 ${
          isDark ? 'text-slate-300' : 'text-slate-800'
        }`}
      >
        <div className="flex items-center gap-1.5 font-mono font-black text-sm tracking-tight">
          <span title="Real-time live clock">{timeDisplay}</span>
          <span className="inline-block w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" title="Live clock sync" />
        </div>

        <div className="flex items-center gap-2 sm:gap-2.5">
          {/* Settings & Profile Trigger Button */}
          {onOpenSettingsModal && (
            <button
              id="btn-open-settings"
              type="button"
              onClick={onOpenSettingsModal}
              className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-bold border transition-all cursor-pointer shadow-xs ${
                isDark
                  ? 'bg-[#16273C] border-slate-700 text-cyan-300 hover:bg-[#1E3550]'
                  : 'bg-white border-slate-200 text-[#0A4275] hover:bg-slate-50'
              }`}
              title="Settings & Profile (Mipangilio ya Akaunti)"
            >
              <Settings className="w-3.5 h-3.5 text-cyan-500" />
              <span className="text-[11px] font-bold">
                {language === 'sw' ? 'Mipangilio' : language === 'fr' ? 'Paramètres' : 'Settings'}
              </span>
            </button>
          )}

          {/* Cellular signal bars */}
          <div className="flex items-end gap-0.5 h-3 ml-0.5">
            <span className={`w-0.5 h-1 rounded-2xs ${isDark ? 'bg-slate-300' : 'bg-slate-800'}`}></span>
            <span className={`w-0.5 h-1.5 rounded-2xs ${isDark ? 'bg-slate-300' : 'bg-slate-800'}`}></span>
            <span className={`w-0.5 h-2 rounded-2xs ${isDark ? 'bg-slate-300' : 'bg-slate-800'}`}></span>
            <span className={`w-0.5 h-2.5 rounded-2xs ${isDark ? 'bg-slate-300' : 'bg-slate-800'}`}></span>
          </div>
          {/* Wifi icon */}
          <Wifi className={`w-3.5 h-3.5 ${isDark ? 'text-slate-300' : 'text-slate-800'}`} />
          {/* Battery icon */}
          <div className={`w-5 h-2.5 border rounded-xs p-0.5 flex items-center ${isDark ? 'border-slate-300' : 'border-slate-800'}`}>
            <div className={`w-full h-full rounded-2xs ${isDark ? 'bg-slate-300' : 'bg-slate-800'}`}></div>
          </div>
        </div>
      </div>

      {/* Main Logo & Slogan Header */}
      <div className="flex flex-col items-center justify-center text-center">
        {/* NiaCare Logo Container */}
        <div className="flex items-center justify-center gap-2.5 mb-1">
          {/* NiaCare App Logo */}
          <div className="w-11 h-11 relative flex items-center justify-center rounded-2xl overflow-hidden shadow-sm">
            <img
              src="/src/assets/images/niacare_app_logo_1787113371659.jpg"
              alt="NiaCare Logo"
              referrerPolicy="no-referrer"
              className="w-full h-full object-contain"
            />
          </div>

          <h1
            className={`text-3xl font-extrabold tracking-tight font-sans flex items-center transition-colors ${
              isDark ? 'text-white' : 'text-[#0A3663]'
            }`}
          >
            Nia<span className="text-[#0284C7]">Care</span>
          </h1>
        </div>

        {/* Slogan with dynamic translation */}
        <p
          className={`text-xs sm:text-[13px] font-medium tracking-normal leading-snug max-w-xs sm:max-w-none transition-colors ${
            isDark ? 'text-slate-300' : 'text-[#4A607A]'
          }`}
        >
          {TRANSLATIONS.header.slogan[language]}
        </p>
      </div>
    </header>
  );
};


