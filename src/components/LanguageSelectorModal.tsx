import React from 'react';
import { Globe, Check, X } from 'lucide-react';
import { Language, Theme } from '../types';
import { WORLD_LANGUAGES } from '../data/languages';

interface LanguageSelectorModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentLanguage: Language;
  onSelectLanguage: (lang: Language) => void;
  theme: Theme;
}

const SUPPORTED_LANGUAGES = WORLD_LANGUAGES.filter(
  (lang): lang is typeof lang & { code: Language } => lang.code === 'en' || lang.code === 'sw' || lang.code === 'fr'
);

export const LanguageSelectorModal: React.FC<LanguageSelectorModalProps> = ({
  isOpen,
  onClose,
  currentLanguage,
  onSelectLanguage,
  theme,
}) => {
  if (!isOpen) return null;

  const isDark = theme === 'dark';

  return (
    <div
      id="modal-language-selector"
      className="fixed inset-0 z-50 bg-black/75 backdrop-blur-sm flex items-center justify-center p-3 sm:p-4 animate-in fade-in duration-200"
    >
      <div
        className={`w-full max-w-sm rounded-2xl shadow-2xl overflow-hidden border transition-all animate-in zoom-in-95 duration-200 ${
          isDark
            ? 'bg-[#0E1A29] text-white border-slate-700/60 shadow-[0_15px_40px_rgba(0,0,0,0.6)]'
            : 'bg-white text-slate-900 border-slate-200'
        }`}
      >
        {/* Header */}
        <div
          className={`p-4 sm:p-5 flex items-center justify-between border-b ${
            isDark ? 'bg-[#0B1522] border-slate-800 text-white' : 'bg-primary border-primary-dark text-white'
          }`}
        >
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-white/15 flex items-center justify-center text-white">
              <Globe className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base sm:text-lg font-semibold">Language</h3>
              <p className="text-xs text-white/80">Choose your preferred language for NiaCare</p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="w-8 h-8 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center text-white transition-colors cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Language List */}
        <div className="p-3 sm:p-4 space-y-2">
          {SUPPORTED_LANGUAGES.map((lang) => {
            const isSelected = currentLanguage === lang.code;
            return (
              <button
                id={`btn-select-lang-${lang.code}`}
                key={lang.code}
                type="button"
                onClick={() => {
                  onSelectLanguage(lang.code);
                  onClose();
                }}
                className={`w-full flex items-center justify-between p-3 rounded-2xl border text-left transition-all cursor-pointer ${
                  isSelected
                    ? isDark
                      ? 'bg-primary/15 border-primary-light text-white shadow-sm ring-1 ring-primary-light'
                      : 'bg-primary/5 border-primary text-primary shadow-xs ring-1 ring-primary'
                    : isDark
                    ? 'bg-[#111F30] border-slate-800 hover:border-slate-600 hover:bg-[#16273C] text-slate-200'
                    : 'bg-white border-slate-200 hover:border-slate-300 hover:bg-slate-50 text-slate-800'
                }`}
              >
                <div className="flex items-center gap-3 min-w-0">
                  <span className="text-2xl shrink-0">{lang.flag}</span>
                  <div className="min-w-0">
                    <span className="font-semibold text-sm block truncate">{lang.name}</span>
                    <p className="text-xs opacity-75 truncate">{lang.nativeName}</p>
                  </div>
                </div>

                {isSelected ? (
                  <div
                    className={`w-5 h-5 rounded-full flex items-center justify-center shrink-0 ${
                      isDark ? 'bg-primary/30 text-white' : 'bg-primary text-white'
                    }`}
                  >
                    <Check className="w-3 h-3" />
                  </div>
                ) : (
                  <div className="w-5 h-5 shrink-0" />
                )}
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
};
