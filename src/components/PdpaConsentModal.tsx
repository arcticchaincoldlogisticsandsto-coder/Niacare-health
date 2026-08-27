import React from 'react';
import { ShieldCheck, X, FileLock2, Lock, HeartPulse, Check } from 'lucide-react';
import { Language } from '../types';
import { TRANSLATIONS } from '../data/translations';

interface PdpaConsentModalProps {
  isOpen: boolean;
  onClose: () => void;
  onAccept: () => void;
  language: Language;
}

export const PdpaConsentModal: React.FC<PdpaConsentModalProps> = ({
  isOpen,
  onClose,
  onAccept,
  language,
}) => {
  const t = TRANSLATIONS.pdpaModal;

  if (!isOpen) return null;

  return (
    <div
      id="modal-pdpa-consent"
      className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in duration-200"
    >
      <div className="bg-white w-full max-w-lg rounded-2xl shadow-2xl overflow-hidden border border-slate-200 max-h-[85vh] flex flex-col animate-in zoom-in-95 duration-200">
        {/* Header */}
        <div className="bg-[#0F4C81] text-white p-5 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-white/20 flex items-center justify-center">
              <FileLock2 className="w-5 h-5 text-white" />
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
            className="w-8 h-8 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center text-white transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-6 overflow-y-auto space-y-4 text-xs text-slate-700 leading-relaxed">
          <div className="bg-primary/5 border border-primary-light rounded-xl p-3 flex items-start gap-2.5">
            <ShieldCheck className="w-5 h-5 text-[#0F4C81] flex-shrink-0 mt-0.5" />
            <p className="text-slate-800">
              {t.intro[language]}
            </p>
          </div>

          <div className="space-y-3">
            <h4 className="font-bold text-slate-900 text-sm flex items-center gap-1.5">
              <Lock className="w-4 h-4 text-[#0F4C81]" />
              {t.point1Title[language]}
            </h4>
            <p>
              {t.point1Desc[language]}
            </p>

            <h4 className="font-bold text-slate-900 text-sm flex items-center gap-1.5">
              <HeartPulse className="w-4 h-4 text-[#E53E3E]" />
              {t.point2Title[language]}
            </h4>
            <p>
              {t.point2Desc[language]}
            </p>

            <h4 className="font-bold text-slate-900 text-sm flex items-center gap-1.5">
              <Check className="w-4 h-4 text-emerald-600" />
              {t.point3Title[language]}
            </h4>
            <p>
              {t.point3Desc[language]}
            </p>
          </div>
        </div>

        {/* Footer */}
        <div className="p-4 bg-slate-50 border-t border-slate-200 flex items-center justify-end gap-2">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 text-xs font-semibold text-slate-600 hover:text-slate-900 transition-colors"
          >
            {t.closeBtn[language]}
          </button>
          <button
            id="btn-modal-accept-pdpa"
            type="button"
            onClick={() => {
              onAccept();
              onClose();
            }}
            className="px-5 py-2.5 bg-[#0F4C81] hover:bg-[#0B3A64] text-white text-xs font-bold rounded-xl shadow-sm flex items-center gap-1.5 cursor-pointer"
          >
            <ShieldCheck className="w-4 h-4" />
            {t.acceptBtn[language]}
          </button>
        </div>
      </div>
    </div>
  );
};
