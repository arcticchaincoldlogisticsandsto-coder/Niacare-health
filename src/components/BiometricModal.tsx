import React, { useState, useEffect } from 'react';
import { Fingerprint, Scan, CheckCircle2, ShieldCheck, X, Sparkles, AlertCircle } from 'lucide-react';
import { Language } from '../types';
import { TRANSLATIONS } from '../data/translations';
import { registerBiometric, authenticateBiometric, hasRegisteredBiometric } from '../lib/webauthn';

interface BiometricModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  mode: 'fingerprint' | 'faceid';
  language: Language;
  authUserId: string | null;
  patientName: string;
}

export const BiometricModal: React.FC<BiometricModalProps> = ({
  isOpen,
  onClose,
  onSuccess,
  mode,
  language,
  authUserId,
  patientName,
}) => {
  const [status, setStatus] = useState<'scanning' | 'success' | 'error'>('scanning');
  const [errorMessage, setErrorMessage] = useState('');
  const [authLatency, setAuthLatency] = useState('0.00s');
  const [ceremony, setCeremony] = useState<'register' | 'authenticate'>('authenticate');

  const t = TRANSLATIONS.biometricModal;
  const isSwahili = language === 'sw';

  useEffect(() => {
    if (!isOpen) return;

    setStatus('scanning');
    setErrorMessage('');
    let cancelled = false;

    const run = async () => {
      if (!authUserId) {
        setErrorMessage(
          isSwahili ? 'Ingia kwanza kabla ya kusanidi uthibitishaji wa kibiolojia.' : 'Sign in first to set up biometric login.'
        );
        setStatus('error');
        return;
      }

      const started = performance.now();
      const alreadyRegistered = await hasRegisteredBiometric(authUserId);
      if (cancelled) return;

      setCeremony(alreadyRegistered ? 'authenticate' : 'register');

      // Triggers the real OS biometric prompt (Touch ID / Face ID / Windows
      // Hello) via the browser's WebAuthn API — this is not a timer.
      const result = alreadyRegistered
        ? await authenticateBiometric(isSwahili)
        : await registerBiometric(patientName, isSwahili);

      if (cancelled) return;

      if (result.success) {
        setAuthLatency(`${((performance.now() - started) / 1000).toFixed(2)}s`);
        setStatus('success');
        setTimeout(() => {
          if (!cancelled) onSuccess();
        }, 900);
      } else {
        setErrorMessage(result.error || (isSwahili ? 'Imeshindikana.' : 'Failed.'));
        setStatus('error');
      }
    };

    run();

    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen]);

  if (!isOpen) return null;

  return (
    <div
      id="modal-biometric-auth"
      className="fixed inset-0 z-50 bg-black/75 backdrop-blur-md flex items-center justify-center p-4 animate-in fade-in duration-200"
    >
      <div className="bg-[#0B1A2C] text-white w-full max-w-sm rounded-2xl p-6 shadow-2xl border border-primary/30 text-center relative overflow-hidden animate-in zoom-in-95 duration-200">
        {/* Ambient background glow */}
        <div className="absolute -top-16 -left-16 w-32 h-32 bg-primary/20 rounded-full blur-3xl"></div>
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
          <div
            className={`w-32 h-32 rounded-full border-2 flex items-center justify-center relative transition-all duration-300 ${
              status === 'success'
                ? 'border-emerald-400 bg-emerald-500/10 shadow-[0_0_30px_rgba(16,185,129,0.4)]'
                : status === 'error'
                ? 'border-rose-400 bg-rose-500/10 shadow-[0_0_30px_rgba(244,63,94,0.3)]'
                : 'border-primary/40 bg-primary/10 shadow-[0_0_30px_rgba(13,148,136,0.3)]'
            }`}
          >
            {status === 'success' ? (
              <CheckCircle2 className="w-16 h-16 text-emerald-400 animate-in zoom-in duration-200" />
            ) : status === 'error' ? (
              <AlertCircle className="w-16 h-16 text-rose-400 animate-in zoom-in duration-200" />
            ) : mode === 'fingerprint' ? (
              <Fingerprint className="w-16 h-16 text-primary animate-pulse" />
            ) : (
              <Scan className="w-16 h-16 text-primary animate-pulse" />
            )}
          </div>
        </div>

        {/* Status Text */}
        <div className="space-y-1.5">
          <div
            className={`inline-flex items-center gap-1 text-[11px] font-mono px-2.5 py-0.5 rounded-full border ${
              status === 'error'
                ? 'bg-rose-500/20 text-rose-300 border-rose-400/30'
                : 'bg-primary/10 text-primary-light border-primary/30'
            }`}
          >
            <Sparkles className="w-3 h-3 text-primary-light" />
            <span>
              {status === 'success'
                ? `${t.verifiedIn[language]} ${authLatency}`
                : status === 'error'
                ? (isSwahili ? 'Kosa' : 'Error')
                : ceremony === 'register'
                ? (isSwahili ? 'Inasajili kifaa...' : 'Registering this device...')
                : (isSwahili ? 'Inasubiri OS...' : 'Waiting for device prompt...')}
            </span>
          </div>

          <h3 className="text-lg font-bold text-white">
            {status === 'success'
              ? t.verifiedTitle[language]
              : status === 'error'
              ? (isSwahili ? 'Imeshindikana' : 'Authentication Failed')
              : mode === 'fingerprint'
              ? t.touchFingerprint[language]
              : t.lookCamera[language]}
          </h3>

          <p className="text-xs text-slate-400 max-w-xs mx-auto">
            {status === 'error' ? errorMessage : t.subtext[language]}
          </p>

          {status === 'error' && (
            <button
              type="button"
              onClick={() => {
                setStatus('scanning');
                setErrorMessage('');
                // Re-trigger the effect by closing then reopening isn't ideal;
                // simplest is to let the user close and tap the trigger again.
                onClose();
              }}
              className="mt-2 px-4 py-2 rounded-xl bg-white/10 hover:bg-white/20 text-white font-bold text-xs cursor-pointer"
            >
              {isSwahili ? 'Funga' : 'Close'}
            </button>
          )}
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
