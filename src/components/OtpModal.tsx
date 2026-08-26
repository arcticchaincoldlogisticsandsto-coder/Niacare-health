import React, { useState, useEffect } from 'react';
import { ShieldCheck, X, RefreshCw, Smartphone, KeyRound, Check } from 'lucide-react';
import { Language, Theme } from '../types';
import { TRANSLATIONS } from '../data/translations';

interface OtpModalProps {
  isOpen: boolean;
  onClose: () => void;
  phone: string;
  onVerifySuccess: () => void;
  language: Language;
  theme?: Theme;
}

export const OtpModal: React.FC<OtpModalProps> = ({
  isOpen,
  onClose,
  phone,
  onVerifySuccess,
  language,
  theme = 'light',
}) => {
  const [otpCode, setOtpCode] = useState(['', '', '', '', '', '']);
  const [timerSeconds, setTimerSeconds] = useState(45);
  const [isVerifying, setIsVerifying] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');

  const t = TRANSLATIONS.otpModal;
  const isDark = theme === 'dark';

  // Reset timer and auto-fill on open
  useEffect(() => {
    if (isOpen) {
      setTimerSeconds(45);
      setOtpCode(['', '', '', '', '', '']);
      setErrorMessage('');
      const autoTimer = setTimeout(() => {
        setOtpCode(['8', '2', '9', '1', '4', '0']);
      }, 600);
      return () => clearTimeout(autoTimer);
    }
  }, [isOpen]);

  // Countdown timer
  useEffect(() => {
    let timer: NodeJS.Timeout;
    if (isOpen && timerSeconds > 0) {
      timer = setTimeout(() => setTimerSeconds((prev) => prev - 1), 1000);
    }
    return () => clearTimeout(timer);
  }, [isOpen, timerSeconds]);

  const handlePaste = (e: React.ClipboardEvent) => {
    e.preventDefault();
    const pastedData = e.clipboardData.getData('text');
    const cleanDigits = pastedData.replace(/\D/g, '').slice(0, 6);
    if (cleanDigits.length > 0) {
      const newOtp = ['', '', '', '', '', ''];
      for (let i = 0; i < cleanDigits.length; i++) {
        if (i < 6) {
          newOtp[i] = cleanDigits[i];
        }
      }
      setOtpCode(newOtp);
      setErrorMessage('');
      const targetIndex = Math.min(cleanDigits.length, 5);
      const nextInput = document.getElementById(`otp-digit-${targetIndex}`);
      nextInput?.focus();
    }
  };

  const handleDigitChange = (index: number, val: string) => {
    if (val.length > 1) {
      const cleanDigits = val.replace(/\D/g, '').slice(0, 6);
      if (cleanDigits.length > 0) {
        const newOtp = [...otpCode];
        for (let i = 0; i < cleanDigits.length; i++) {
          if (index + i < 6) {
            newOtp[index + i] = cleanDigits[i];
          }
        }
        setOtpCode(newOtp);
        setErrorMessage('');
        const nextIdx = Math.min(index + cleanDigits.length, 5);
        const nextInput = document.getElementById(`otp-digit-${nextIdx}`);
        nextInput?.focus();
      }
      return;
    }

    if (!/^\d*$/.test(val)) return;
    const newOtp = [...otpCode];
    newOtp[index] = val.slice(-1);
    setOtpCode(newOtp);
    setErrorMessage('');

    // Auto-focus next input
    if (val && index < 5) {
      const nextInput = document.getElementById(`otp-digit-${index + 1}`);
      nextInput?.focus();
    }
  };

  const handleKeyDown = (index: number, e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Backspace' && !otpCode[index] && index > 0) {
      const prevInput = document.getElementById(`otp-digit-${index - 1}`);
      prevInput?.focus();
    }
  };

  const handleFillDemoCode = async () => {
    let codeToUse = ['8', '2', '9', '1', '4', '0'];
    if (navigator.clipboard && navigator.clipboard.readText) {
      try {
        const clipText = await navigator.clipboard.readText();
        const clean = clipText.replace(/\D/g, '').slice(0, 6);
        if (clean.length === 6) {
          codeToUse = clean.split('');
        }
      } catch {
        // Fallback
      }
    }
    setOtpCode(codeToUse);
    setErrorMessage('');
  };

  const handleVerify = () => {
    const fullCode = otpCode.join('');
    if (fullCode.length < 6) {
      setErrorMessage(t.errorLength[language]);
      return;
    }

    setIsVerifying(true);
    setTimeout(() => {
      setIsVerifying(false);
      onVerifySuccess();
    }, 600);
  };

  if (!isOpen) return null;

  return (
    <div
      id="modal-otp-2fa"
      className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in duration-200"
    >
      <div
        className={`w-full max-w-md rounded-2xl shadow-2xl overflow-hidden border animate-in zoom-in-95 duration-200 ${
          isDark ? 'bg-[#0E1A29] text-white border-slate-700' : 'bg-white text-slate-900 border-slate-200'
        }`}
      >
        {/* Header */}
        <div className={`p-5 flex items-center justify-between ${isDark ? 'bg-[#0A1420] text-white border-b border-slate-800' : 'bg-[#0F4C81] text-white'}`}>
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-white/20 flex items-center justify-center">
              <KeyRound className="w-5 h-5 text-white" />
            </div>
            <div>
              <h3 className="text-base sm:text-lg font-bold">
                {t.title[language]}
              </h3>
              <p className="text-xs text-blue-200">
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

        {/* Content */}
        <div className="p-6 space-y-5">
          <div className="text-center">
            <div
              className={`inline-flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-full mb-2 ${
                isDark ? 'bg-cyan-950/60 text-cyan-300 border border-cyan-800' : 'bg-blue-50 text-[#0F4C81]'
              }`}
            >
              <Smartphone className="w-3.5 h-3.5" />
              <span>{phone || '+255 754 *** ***'}</span>
            </div>
            <p className={`text-xs max-w-xs mx-auto ${isDark ? 'text-slate-300' : 'text-slate-600'}`}>
              {t.instructions[language]}
            </p>
          </div>

          {/* 6 Digit Input Boxes */}
          <div className="flex justify-center gap-2 sm:gap-2.5" onPaste={handlePaste}>
            {otpCode.map((digit, idx) => (
              <input
                key={idx}
                id={`otp-digit-${idx}`}
                type="text"
                inputMode="numeric"
                autoComplete="one-time-code"
                maxLength={1}
                value={digit}
                onChange={(e) => handleDigitChange(idx, e.target.value)}
                onKeyDown={(e) => handleKeyDown(idx, e)}
                onPaste={handlePaste}
                className={`w-11 h-13 sm:w-12 sm:h-14 text-center text-xl font-mono font-black rounded-xl border-2 outline-none transition-all ${
                  digit ? 'border-cyan-500 font-extrabold shadow-xs' : ''
                } ${
                  isDark
                    ? 'text-white bg-[#0A1420] border-slate-700 focus:border-cyan-400 focus:ring-2 focus:ring-cyan-400/20'
                    : 'text-slate-900 bg-[#F4F6F8] focus:bg-white border-slate-300 focus:border-[#0F4C81] focus:ring-2 focus:ring-[#0F4C81]/20'
                }`}
              />
            ))}
          </div>

          {errorMessage && (
            <p className="text-xs text-center text-red-400 font-semibold bg-red-950/40 border border-red-800/60 py-1.5 rounded-lg">
              {errorMessage}
            </p>
          )}

          {/* Auto fill demo passkey & Timer */}
          <div className="flex items-center justify-between text-xs text-slate-500 pt-1">
            <button
              type="button"
              onClick={handleFillDemoCode}
              className={`font-bold flex items-center gap-1.5 px-2.5 py-1 rounded-lg border cursor-pointer transition-all ${
                isDark
                  ? 'bg-cyan-950/60 border-cyan-800 text-cyan-300 hover:bg-cyan-900/60 hover:text-white'
                  : 'bg-blue-50 border-blue-200 text-[#0F4C81] hover:bg-blue-100'
              }`}
              title="Auto-fill OTP code"
            >
              <Check className="w-3.5 h-3.5 text-cyan-500" />
              <span>{t.fillDemo[language]}</span>
            </button>

            <div>
              {timerSeconds > 0 ? (
                <span className={`font-mono ${isDark ? 'text-slate-400' : 'text-slate-600'}`}>
                  {t.resendIn[language]} <b className={isDark ? 'text-white' : 'text-slate-900'}>00:{timerSeconds < 10 ? `0${timerSeconds}` : timerSeconds}</b>
                </span>
              ) : (
                <button
                  type="button"
                  onClick={() => setTimerSeconds(45)}
                  className={`font-bold hover:underline flex items-center gap-1 cursor-pointer ${
                    isDark ? 'text-cyan-400' : 'text-[#0F4C81]'
                  }`}
                >
                  <RefreshCw className="w-3 h-3" />
                  {t.resendBtn[language]}
                </button>
              )}
            </div>
          </div>

          {/* Action Buttons */}
          <div className="space-y-2 pt-2">
            <button
              id="btn-confirm-otp"
              type="button"
              onClick={handleVerify}
              disabled={isVerifying}
              className={`w-full py-3 rounded-xl font-bold text-sm shadow-md flex items-center justify-center gap-2 cursor-pointer transition-all disabled:opacity-50 ${
                isDark
                  ? 'bg-cyan-500 hover:bg-cyan-400 text-slate-950 shadow-cyan-500/20'
                  : 'bg-[#0F4C81] hover:bg-[#0B3A64] text-white shadow-[#0F4C81]/20'
              }`}
            >
              {isVerifying ? (
                <RefreshCw className="w-4 h-4 animate-spin" />
              ) : (
                <ShieldCheck className="w-4 h-4" />
              )}
              <span>{t.verifyBtn[language]}</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
