import React, { useState, useEffect, useRef } from 'react';
import {
  KeyRound,
  CheckCircle2,
  RefreshCw,
  ArrowLeft,
  Smartphone,
  Mail,
  ShieldCheck,
  Sparkles,
  AlertCircle,
} from 'lucide-react';
import { Language, Theme, UserCategory, OtpDeliveryChannel } from '../types';
import { TRANSLATIONS } from '../data/translations';

interface HomeOtpVerificationProps {
  channel?: OtpDeliveryChannel;
  target?: string;
  phone?: string;
  userName?: string;
  userCategory: UserCategory;
  authMode?: 'register' | 'login';
  onVerify: (code: string) => Promise<{ success: boolean; error?: string }>;
  onBackToCredentials: () => void;
  onResendOtp?: (channel: OtpDeliveryChannel) => void;
  autoFillCode?: string;
  language: Language;
  theme?: Theme;
}

export const HomeOtpVerification: React.FC<HomeOtpVerificationProps> = ({
  channel = 'phone',
  target,
  phone,
  userName,
  userCategory,
  authMode = 'register',
  onVerify,
  onBackToCredentials,
  onResendOtp,
  autoFillCode,
  language,
  theme = 'light',
}) => {
  const [currentChannel, setCurrentChannel] = useState<OtpDeliveryChannel>(channel);
  const [otpCode, setOtpCode] = useState<string[]>(['', '', '', '', '', '']);
  const [timerSeconds, setTimerSeconds] = useState(45);
  const [isVerifying, setIsVerifying] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [showResendToast, setShowResendToast] = useState(false);

  const [isAutoFilled, setIsAutoFilled] = useState(false);

  const inputRefs = useRef<(HTMLInputElement | null)[]>([]);
  const t = TRANSLATIONS.homeOtp;
  const tOtp = TRANSLATIONS.otpModal;
  const isDark = theme === 'dark';

  const isEmail = currentChannel === 'email';
  // Email OTP is also used for existing-account access. Present it as sign-in
  // so an administrator who enters from the registration form is not misled.
  const isLogin = authMode === 'login' || isEmail;
  const displayTarget = target || phone || (isEmail ? 'user@example.com' : '+255 754 829 140');

  // Handle incoming autoFillCode from notification banner - instantly fills without manual writing
  useEffect(() => {
    if (autoFillCode && autoFillCode.length === 6) {
      setOtpCode(autoFillCode.split(''));
      setErrorMessage('');
      setIsAutoFilled(true);
      setTimeout(() => {
        inputRefs.current[5]?.focus();
      }, 50);
    }
  }, [autoFillCode]);

  // Focus first input on mount
  useEffect(() => {
    inputRefs.current[0]?.focus();
  }, []);

  // Countdown timer
  useEffect(() => {
    let timer: NodeJS.Timeout;
    if (timerSeconds > 0) {
      timer = setTimeout(() => setTimerSeconds((prev) => prev - 1), 1000);
    }
    return () => clearTimeout(timer);
  }, [timerSeconds]);

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
      inputRefs.current[targetIndex]?.focus();
    }
  };

  const handleDigitChange = (index: number, val: string) => {
    // Handle pasting or multiple chars entered at once (e.g. mobile auto-fill)
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
        inputRefs.current[nextIdx]?.focus();
      }
      return;
    }

    if (!/^\d*$/.test(val)) return;

    const newOtp = [...otpCode];
    newOtp[index] = val;
    setOtpCode(newOtp);
    setErrorMessage('');

    // Auto-focus next input
    if (val && index < 5) {
      inputRefs.current[index + 1]?.focus();
    }
  };

  const handleKeyDown = (index: number, e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Backspace' && !otpCode[index] && index > 0) {
      inputRefs.current[index - 1]?.focus();
    }
  };

  const handlePasteFromClipboard = async () => {
    if (!navigator.clipboard || !navigator.clipboard.readText) return;
    try {
      const clipText = await navigator.clipboard.readText();
      const clean = clipText.replace(/\D/g, '').slice(0, 6);
      if (clean.length === 6) {
        setOtpCode(clean.split(''));
        setErrorMessage('');
        inputRefs.current[5]?.focus();
      }
    } catch {
      // Clipboard read denied or unavailable — no-op
    }
  };

  const handleResend = (newChan?: OtpDeliveryChannel) => {
    const selected = newChan || currentChannel;
    if (newChan) setCurrentChannel(newChan);
    setTimerSeconds(45);
    setOtpCode(['', '', '', '', '', '']);
    setErrorMessage('');
    setShowResendToast(true);
    setTimeout(() => setShowResendToast(false), 3500);
    inputRefs.current[0]?.focus();
    if (onResendOtp) {
      onResendOtp(selected);
    }
  };

  const handleVerify = async () => {
    const fullCode = otpCode.join('');
    if (fullCode.length < 6) {
      setErrorMessage(tOtp.errorLength[language]);
      return;
    }

    setIsVerifying(true);
    const result = await onVerify(fullCode);
    setIsVerifying(false);

    if (!result.success) {
      setErrorMessage(
        result.error ||
          (language === 'sw'
            ? 'Namba ya OTP si sahihi. Tafadhali jaribu tena.'
            : language === 'fr'
            ? 'Code OTP invalide. Veuillez réessayer.'
            : 'Invalid OTP code. Please try again.')
      );
    }
  };

  return (
    <div
      id="card-home-otp-verification"
      className={`rounded-3xl border p-4 sm:p-6 shadow-xs relative transition-all duration-300 animate-in fade-in zoom-in-95 duration-200 ${
        isDark
          ? 'bg-[#101F31] border-slate-700/80 text-white shadow-[0_10px_30px_rgba(0,0,0,0.3)]'
          : 'bg-white border-slate-200/90 text-slate-900'
      }`}
    >
      {/* Top Bar with Back Link & First-Time Badge */}
      <div className="flex items-center justify-between mb-4">
        <button
          type="button"
          onClick={onBackToCredentials}
          className={`flex items-center gap-1 text-xs font-bold transition-colors cursor-pointer py-1 px-2 rounded-lg ${
            isDark
              ? 'text-cyan-400 hover:text-cyan-300 hover:bg-slate-800'
              : 'text-[#0A4275] hover:text-[#062847] hover:bg-blue-50'
          }`}
        >
          <ArrowLeft className="w-3.5 h-3.5" />
          <span>{t.backToEdit[language]}</span>
        </button>

        <span
          className={`inline-flex items-center gap-1 text-[11px] font-extrabold px-2.5 py-1 rounded-full border ${
            isDark
              ? 'bg-emerald-950/60 text-emerald-300 border-emerald-800/80'
              : 'bg-emerald-50 text-emerald-700 border-emerald-200'
          }`}
        >
          <ShieldCheck className="w-3 h-3 text-emerald-500" />
          <span>{isLogin ? (language === 'sw' ? 'Ingia salama' : 'Secure sign in') : t.firstTimeBadge[language]}</span>
        </span>
      </div>

      {/* Main Header */}
      <div className="flex flex-col items-center text-center mb-4">
        <div
          className={`w-12 h-12 rounded-2xl flex items-center justify-center mb-2 shadow-xs ${
            isDark ? 'bg-cyan-500/20 text-cyan-400' : 'bg-[#0A4275]/10 text-[#0A4275]'
          }`}
        >
          <KeyRound className="w-6 h-6" />
        </div>

        <h2
          className={`text-xl sm:text-2xl font-black tracking-tight ${
            isDark ? 'text-white' : 'text-slate-900'
          }`}
        >
          {isEmail ? (language === 'sw' ? 'Uthibitishaji wa barua pepe' : 'Email verification') : t.title[language]}
        </h2>

        {userName && !isLogin && (
          <p className={`text-xs font-bold mt-1 ${isDark ? 'text-cyan-300' : 'text-[#0A4275]'}`}>
            👤 {userName}
          </p>
        )}

        <p className={`text-xs sm:text-sm font-medium mt-1 max-w-xs ${isDark ? 'text-slate-300' : 'text-slate-600'}`}>
          {isLogin
            ? (language === 'sw' ? 'Weka msimbo wa tarakimu 6 uliotumwa ili kuingia.' : 'Enter the 6-digit verification code to sign in.')
            : t.enterCode[language]}
        </p>

        {/* Recipient Channel Info Pill */}
        <div
          className={`inline-flex items-center gap-2 text-xs font-semibold px-3 py-1.5 rounded-xl mt-3 border ${
            isDark
              ? 'bg-[#0A1522] border-slate-700 text-slate-200'
              : 'bg-[#F0F5FA] border-blue-100 text-slate-800'
          }`}
        >
          {isEmail ? (
            <Mail className="w-3.5 h-3.5 text-indigo-400" />
          ) : (
            <Smartphone className="w-3.5 h-3.5 text-cyan-500" />
          )}
          <span className="font-mono font-bold">{displayTarget}</span>
          <button
            type="button"
            onClick={onBackToCredentials}
            className={`text-[11px] font-bold underline cursor-pointer ml-1 ${
              isDark ? 'text-cyan-400 hover:text-cyan-300' : 'text-[#0A4275] hover:text-[#072d50]'
            }`}
          >
            {t.changeNumber[language]}
          </button>
        </div>
      </div>

      {/* 6 Digit Input Boxes */}
      <div className="space-y-4" onPaste={handlePaste}>
        <div className="flex justify-center gap-1.5 sm:gap-2.5">
          {otpCode.map((digit, idx) => (
            <input
              key={idx}
              ref={(el) => {
                inputRefs.current[idx] = el;
              }}
              id={`home-otp-digit-${idx}`}
              type="text"
              inputMode="numeric"
              autoComplete="one-time-code"
              maxLength={1}
              value={digit}
              onChange={(e) => handleDigitChange(idx, e.target.value)}
              onKeyDown={(e) => handleKeyDown(idx, e)}
              onPaste={handlePaste}
              className={`w-11 h-13 sm:w-12 sm:h-14 text-center text-xl sm:text-2xl font-mono font-black rounded-xl border-2 outline-none transition-all ${
                digit ? 'border-cyan-500 font-extrabold shadow-xs' : ''
              } ${
                isDark
                  ? 'text-white bg-[#0A1420] border-slate-700 focus:border-cyan-400 focus:ring-2 focus:ring-cyan-400/20'
                  : 'text-slate-900 bg-[#F4F6F8] focus:bg-white border-slate-300 focus:border-[#0A4275] focus:ring-2 focus:ring-[#0A4275]/20'
              }`}
            />
          ))}
        </div>

        {errorMessage && (
          <p className="text-xs text-red-500 font-semibold flex items-center justify-center gap-1 text-center animate-in fade-in">
            <AlertCircle className="w-3.5 h-3.5 flex-shrink-0" />
            {errorMessage}
          </p>
        )}

        {isAutoFilled && !errorMessage && (
          <div className="flex items-center justify-center gap-1.5 py-1 px-3 rounded-full bg-emerald-500/10 border border-emerald-500/30 text-emerald-600 dark:text-emerald-400 text-xs font-bold animate-in fade-in">
            <Sparkles className="w-3.5 h-3.5 text-emerald-500" />
            <span>
              {language === 'sw'
                ? '✨ Namba ya OTP imejazwa kiotomatiki kutoka kwenye ujumbe'
                : language === 'fr'
                ? '✨ Code OTP rempli automatiquement à partir du message'
                : '✨ OTP code auto-filled from incoming message'}
            </span>
          </div>
        )}

        {showResendToast && (
          <p className="text-xs text-emerald-500 font-semibold flex items-center justify-center gap-1 text-center animate-in fade-in">
            <CheckCircle2 className="w-3.5 h-3.5" />
            <span>
              {isEmail
                ? language === 'sw'
                  ? 'Msimbo mpya wa OTP umetumwa kwa Barua Pepe (Email)!'
                  : language === 'fr'
                  ? 'Un nouveau code OTP a été envoyé par Email !'
                  : 'A new OTP code has been dispatched via Email!'
                : TRANSLATIONS.otpModal.codeResent[language]}
            </span>
          </p>
        )}

        {/* Quick 1-Tap Auto-fill & Resend Bar */}
        <div className="flex flex-wrap items-center justify-between gap-2 text-xs px-1">
          <button
            type="button"
            onClick={handlePasteFromClipboard}
            className={`font-bold flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl border cursor-pointer transition-all ${
              isDark
                ? 'bg-cyan-950/60 border-cyan-700 text-cyan-300 hover:bg-cyan-900/60 hover:text-white'
                : 'bg-blue-50 border-blue-200 text-[#0A4275] hover:bg-blue-100'
            }`}
            title="Paste OTP code from clipboard"
          >
            <Sparkles className="w-3.5 h-3.5 text-cyan-500" />
            <span className="font-extrabold">{t.autoFillHelper[language]}</span>
          </button>

          {timerSeconds > 0 ? (
            <span className={`font-mono font-semibold ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
              {t.resendIn[language]} <span className="font-bold text-cyan-500">{timerSeconds}s</span>
            </span>
          ) : (
            <button
              type="button"
              onClick={() => handleResend()}
              className={`font-bold flex items-center gap-1 cursor-pointer transition-colors ${
                isDark ? 'text-cyan-400 hover:text-cyan-300' : 'text-[#0A4275] hover:text-[#062847]'
              }`}
            >
              <RefreshCw className="w-3 h-3" />
              <span>{t.resendNow[language]}</span>
            </button>
          )}
        </div>

        {/* Primary Verification Button */}
        <button
          id="btn-verify-home-otp"
          type="button"
          onClick={handleVerify}
          disabled={isVerifying}
          className={`w-full p-3.5 rounded-2xl font-bold flex items-center justify-center gap-2 cursor-pointer transition-all transform hover:-translate-y-0.5 ${
            isDark
              ? 'bg-cyan-500 hover:bg-cyan-400 text-slate-950 shadow-lg shadow-cyan-500/20'
              : 'bg-[#0A4275] hover:bg-[#08365f] text-white shadow-md shadow-[#0A4275]/20'
          }`}
        >
          {isVerifying ? (
            <RefreshCw className="w-4 h-4 animate-spin" />
          ) : (
            <ShieldCheck className="w-5 h-5" />
          )}
          <span className="text-sm font-extrabold tracking-wide">
            {isLogin ? (language === 'sw' ? 'THIBITISHA NA UINGIE' : 'VERIFY & SIGN IN') : t.verifyBtn[language]}
          </span>
        </button>
      </div>
    </div>
  );
};
