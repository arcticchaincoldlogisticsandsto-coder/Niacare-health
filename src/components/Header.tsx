import React from 'react';
import { Settings } from 'lucide-react';
import { Language, Theme } from '../types';
import { TRANSLATIONS } from '../data/translations';

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

  return (
    <header className="w-full pt-3 pb-3 px-3 sm:px-5 relative bg-transparent transition-colors duration-300">
      {/* Settings Button */}
      {onOpenSettingsModal && (
        <div className="flex items-center justify-end mb-3 px-1 sm:px-2">
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
        </div>
      )}

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


