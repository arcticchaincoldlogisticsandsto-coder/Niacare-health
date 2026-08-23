import React, { useState, useEffect } from 'react';
import { Fingerprint, Scan, CheckCircle2, ShieldCheck, X, Sparkles } from 'lucide-react';
import { Language } from '../types';
import { TRANSLATIONS } from '../data/translations';

interface BiometricModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  mode: 'fingerprint' | 'faceid';
  language: Language;
}

export const BiometricModal: React.FC<BiometricModalProps> = ({
  isOpen,
  onClose,
  onSuccess,
  mode,
  language,
}) => {
  const [scanProgress, setScanProgress] = useState(0);
  const [isSuccess, setIsSuccess] = useState(false);
  const [authLatency, setAuthLatency] = useState('0.42s');

  const t = TRANSLATIONS.biometricModal;

  useEffect(() => {
    if (isOpen) {
      setScanProgress(0);
      setIsSuccess(false);

      // Simulate 1-second ultra-fast biometric authentication
      const interval = setInterval(() => {
        setScanProgress((prev) => {
          if (prev >= 100) {
            clearInterval(interval);
            setIsSuccess(true);
            setAuthLatency(`${(0.35 + Math.random() * 0.2).toFixed(2)}s`);
            setTimeout(() => {
              onSuccess();
            }, 800);
            return 100;
          }
          return prev + 25;
        });
      }, 180);

      return () => clearInterval(interval);
    }
  }, [isOpen]);

  if (!isOpen) return null;

  return (
    <div
      id="modal-biometric-auth"
      className="fixed inset-0 z-50 bg-black/75 backdrop-blur-md flex items-center justify-center p-4 animate-in fade-in duration-200"
    >
      <div className="bg-[#0B1A2C] text-white w-full max-w-sm rounded-3xl p-6 shadow-2xl border border-blue-500/30 text-center relative overflow-hidden animate-in zoom-in-95 duration-200">
        {/* Ambient background glow */}
        <div className="absolute -top-16 -left-16 w-32 h-32 bg-blue-500/20 rounded-full blur-3xl"></div>
        <div className="absolute -bottom-16 -right-16 w-32 h-32 bg-emerald-500/20 rounded-full blur-3xl"></div>

        <button
          type="button"
          onClick={onClose}
          className="absolute top-4 right-4 text-slate-400 hover:text-white p-1 rounded-full bg-white/5 hover:bg-white/10 transition-colors"
        >
          <X className="w-4 h-4" />
        </button>

        {/* Biometric Scanner Visual */}
        <div className="relative my-6 flex items-center justify-center">
          {/* Radial animated rings */}
          <div
            className={`w-32 h-32 rounded-full border-2 flex items-center justify-center relative transition-all duration-300 ${
              isSuccess
                ? 'border-emerald-400 bg-emerald-500/10 shadow-[0_0_30px_rgba(16,185,129,0.4)]'
                : 'border-blue-400/50 bg-blue-500/10 shadow-[0_0_30px_rgba(15,76,129,0.3)]'
            }`}
          >
            {/* Animated Laser Scanning Line */}
            {!isSuccess && (
              <div
                className="absolute inset-x-4 h-0.5 bg-cyan-400 shadow-[0_0_8px_#22d3ee] rounded-full transition-all duration-150"
                style={{ top: `${scanProgress}%` }}
              ></div>
            )}

            {isSuccess ? (
              <CheckCircle2 className="w-16 h-16 text-emerald-400 animate-in zoom-in duration-200" />
            ) : mode === 'fingerprint' ? (
              <Fingerprint className="w-16 h-16 text-blue-400 animate-pulse" />
            ) : (
              <Scan className="w-16 h-16 text-blue-400 animate-pulse" />
            )}
          </div>
        </div>

        {/* Status Text */}
        <div className="space-y-1.5">
          <div className="inline-flex items-center gap-1 text-[11px] bg-blue-500/20 text-blue-300 font-mono px-2.5 py-0.5 rounded-full border border-blue-400/30">
            <Sparkles className="w-3 h-3 text-cyan-300" />
            <span>
              {isSuccess
                ? `${t.verifiedIn[language]} ${authLatency}`
                : `${t.scanning[language]} ${scanProgress}%`}
            </span>
          </div>

          <h3 className="text-lg font-bold text-white">
            {isSuccess
              ? t.verifiedTitle[language]
              : mode === 'fingerprint'
              ? t.touchFingerprint[language]
              : t.lookCamera[language]}
          </h3>

          <p className="text-xs text-slate-400 max-w-xs mx-auto">
            {t.subtext[language]}
          </p>
        </div>

        {/* Security badge */}
        <div className="mt-5 pt-3 border-t border-white/10 flex items-center justify-center gap-1.5 text-[11px] text-slate-400">
          <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
          <span>FIDO2 / WebAuthn Biometric Security</span>
        </div>
      </div>
    </div>
  );
};
