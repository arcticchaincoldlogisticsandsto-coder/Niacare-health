import React from 'react';
import { UserPlus, X, ShieldCheck, ArrowRight, Globe } from 'lucide-react';
import { Language, UserCategory, Theme } from '../types';
import { TRANSLATIONS } from '../data/translations';

interface RegistrationModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSelectCategory: (cat: UserCategory) => void;
  language: Language;
  theme?: Theme;
}

export const RegistrationModal: React.FC<RegistrationModalProps> = ({
  isOpen,
  onClose,
  onSelectCategory,
  language,
  theme = 'light',
}) => {
  const t = TRANSLATIONS.registrationModal;
  const isDark = theme === 'dark';

  if (!isOpen) return null;

  return (
    <div
      id="modal-registration-choice"
      className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in duration-200"
    >
      <div
        className={`w-full max-w-md rounded-2xl shadow-2xl overflow-hidden border animate-in zoom-in-95 duration-200 ${
          isDark ? 'bg-[#0E1A29] text-white border-slate-700' : 'bg-white text-slate-800 border-slate-200'
        }`}
      >
        <div
          className={`p-5 flex items-center justify-between ${
            isDark ? 'bg-[#0A1420] text-white border-b border-slate-800' : 'bg-[var(--nc-primary)] text-white'
          }`}
        >
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-white/20 flex items-center justify-center">
              <UserPlus className="w-5 h-5 text-white" />
            </div>
            <div>
              <h3 className="text-base sm:text-lg font-bold">
                {t.title[language]}
              </h3>
              <p className="text-xs text-primary-light">
                {t.subtitle[language]}
              </p>
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

        <div className="p-6 space-y-4">
          <p className={`text-xs leading-relaxed ${isDark ? 'text-slate-300' : 'text-slate-600'}`}>
            {t.intro[language]}
          </p>

          <div className="space-y-3">
            <button
              type="button"
              onClick={() => {
                onSelectCategory('locals');
                onClose();
              }}
              className={`w-full text-left p-4 rounded-2xl border-2 transition-all flex items-center justify-between group cursor-pointer ${
                isDark
                  ? 'bg-[#0A1522] border-slate-700 hover:border-primary-light text-white'
                  : 'bg-white border-slate-200 hover:border-[var(--nc-primary)] hover:bg-primary/5 text-slate-900'
              }`}
            >
              <div className="flex items-center gap-3">
                <span className="text-3xl">🇹🇿</span>
                <div>
                  <h4
                    className={`font-bold text-sm transition-colors ${
                      isDark ? 'text-white group-hover:text-primary-light' : 'text-slate-900 group-hover:text-[var(--nc-primary)]'
                    }`}
                  >
                    {t.localTitle[language]}
                  </h4>
                  <p className={`text-xs ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
                    {t.localDesc[language]}
                  </p>
                </div>
              </div>
              <ArrowRight className="w-5 h-5 text-slate-400 group-hover:text-primary-light transition-transform group-hover:translate-x-1" />
            </button>

            <button
              type="button"
              onClick={() => {
                onSelectCategory('internationals');
                onClose();
              }}
              className={`w-full text-left p-4 rounded-2xl border-2 transition-all flex items-center justify-between group cursor-pointer ${
                isDark
                  ? 'bg-[#0A1522] border-slate-700 hover:border-primary-light text-white'
                  : 'bg-white border-slate-200 hover:border-[var(--nc-primary)] hover:bg-primary/5 text-slate-900'
              }`}
            >
              <div className="flex items-center gap-3">
                <div
                  className={`w-9 h-9 rounded-full flex items-center justify-center ${
                    isDark ? 'bg-primary/10 text-primary-light' : 'bg-primary/10 text-[var(--nc-primary)]'
                  }`}
                >
                  <Globe className="w-5 h-5" />
                </div>
                <div>
                  <h4
                    className={`font-bold text-sm transition-colors ${
                      isDark ? 'text-white group-hover:text-primary-light' : 'text-slate-900 group-hover:text-[var(--nc-primary)]'
                    }`}
                  >
                    {t.intlTitle[language]}
                  </h4>
                  <p className={`text-xs ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
                    {t.intlDesc[language]}
                  </p>
                </div>
              </div>
              <ArrowRight className="w-5 h-5 text-slate-400 group-hover:text-primary-light transition-transform group-hover:translate-x-1" />
            </button>
          </div>

          <div className={`pt-2 flex items-center justify-center gap-2 text-[11px] ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
            <ShieldCheck className="w-3.5 h-3.5 text-emerald-500" />
            <span>{t.guarantee[language]}</span>
          </div>
        </div>
      </div>
    </div>
  );
};
