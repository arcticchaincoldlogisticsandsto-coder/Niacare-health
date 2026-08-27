import React, { useEffect, useRef, useState } from 'react';
import {
  AlertCircle,
  ArrowLeft,
  CheckCircle2,
  KeyRound,
  Mail,
  RefreshCw,
  ShieldCheck,
  Smartphone,
  Sparkles,
} from 'lucide-react';
import { Language, OtpDeliveryChannel, Theme, UserCategory } from '../types';
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
  const isLogin = authMode === 'login' || isEmail;
  const displayTarget = target || phone || (isEmail ? 'user@example.com' : '+255 754 829 140');

  useEffect(() => {
    if (autoFillCode && autoFillCode.length === 6) {
      setOtpCode(autoFillCode.split(''));
      setErrorMessage('');
      setIsAutoFilled(true);
      setTimeout(() => inputRefs.current[5]?.focus(), 50);
    }
  }, [autoFillCode]);

  useEffect(() => {
    inputRefs.current[0]?.focus();
  }, []);

  useEffect(() => {
    if (timerSeconds <= 0) return;
    const timer = setTimeout(() => setTimerSeconds((prev) => prev - 1), 1000);
    return () => clearTimeout(timer);
  }, [timerSeconds]);

  const applyDigits = (digits: string, startIndex = 0) => {
    const cleanDigits = digits.replace(/\D/g, '').slice(0, 6);
    if (!cleanDigits) return;

    const nextOtp = [...otpCode];
    for (let i = 0; i < cleanDigits.length; i += 1) {
      if (startIndex + i < 6) nextOtp[startIndex + i] = cleanDigits[i];
    }
    setOtpCode(nextOtp);
    setErrorMessage('');
    inputRefs.current[Math.min(startIndex + cleanDigits.length, 5)]?.focus();
  };

  const handlePaste = (event: React.ClipboardEvent) => {
    event.preventDefault();
    applyDigits(event.clipboardData.getData('text'));
  };

  const handleDigitChange = (index: number, value: string) => {
    if (value.length > 1) {
      applyDigits(value, index);
      return;
    }
    if (!/^\d*$/.test(value)) return;

    const nextOtp = [...otpCode];
    nextOtp[index] = value;
    setOtpCode(nextOtp);
    setErrorMessage('');
    if (value && index < 5) inputRefs.current[index + 1]?.focus();
  };

  const handleKeyDown = (index: number, event: React.KeyboardEvent<HTMLInputElement>) => {
    if (event.key === 'Backspace' && !otpCode[index] && index > 0) {
      inputRefs.current[index - 1]?.focus();
    }
  };

  const handlePasteFromClipboard = async () => {
    if (!navigator.clipboard?.readText) return;
    try {
      const clipText = await navigator.clipboard.readText();
      const clean = clipText.replace(/\D/g, '').slice(0, 6);
      if (clean.length === 6) {
        setOtpCode(clean.split(''));
        setErrorMessage('');
        inputRefs.current[5]?.focus();
      }
    } catch {
      // Clipboard access can be denied by the browser.
    }
  };

  const handleResend = (newChannel?: OtpDeliveryChannel) => {
    const selected = newChannel || currentChannel;
    if (newChannel) setCurrentChannel(newChannel);
    setTimerSeconds(45);
    setOtpCode(['', '', '', '', '', '']);
    setErrorMessage('');
    setShowResendToast(true);
    setTimeout(() => setShowResendToast(false), 3500);
    inputRefs.current[0]?.focus();
    onResendOtp?.(selected);
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
            ? 'Code OTP invalide. Veuillez reessayer.'
            : 'Invalid OTP code. Please try again.')
      );
    }
  };

  const pageTitle = isEmail
    ? language === 'sw'
      ? 'Uthibitishaji wa Barua Pepe'
      : 'Email Verification'
    : t.title[language];

  const pageCopy = isLogin
    ? language === 'sw'
      ? 'Weka msimbo wa tarakimu 6 uliotumwa ili kuingia.'
      : 'Enter the 6-digit verification code to sign in.'
    : t.enterCode[language];

  return (
    <section className="mx-auto w-full max-w-[430px] pt-2">
      <div
        id="card-home-otp-verification"
        className={`rounded-lg border p-4 transition-colors ${
          isDark
            ? 'border-slate-800 bg-[#101F31] text-white'
            : 'border-[#DCE7F3] bg-white text-slate-900 shadow-[0_1px_2px_rgba(15,45,80,0.04)]'
        }`}
      >
        <div className="mb-4 flex items-center justify-between gap-3 border-b border-slate-100 pb-3 dark:border-slate-800">
          <button
            type="button"
            onClick={onBackToCredentials}
            className={`flex min-w-0 items-center gap-1.5 rounded-md px-2 py-1 text-left text-xs font-bold transition-colors ${
              isDark ? 'text-cyan-300 hover:bg-slate-800' : 'text-[#0A4275] hover:bg-blue-50'
            }`}
          >
            <ArrowLeft className="h-3.5 w-3.5 flex-shrink-0" />
            <span className="truncate">
              {isLogin ? (language === 'sw' ? 'Rudi kwenye kuingia' : 'Back to sign in') : t.backToEdit[language]}
            </span>
          </button>

          <span
            className={`inline-flex flex-shrink-0 items-center gap-1 rounded-md border px-2.5 py-1 text-[11px] font-extrabold ${
              isDark
                ? 'border-emerald-800/80 bg-emerald-950/50 text-emerald-300'
                : 'border-emerald-200 bg-emerald-50 text-emerald-700'
            }`}
          >
            <ShieldCheck className="h-3 w-3 text-emerald-500" />
            <span>{isLogin ? (language === 'sw' ? 'Ingia salama' : 'Secure sign in') : t.firstTimeBadge[language]}</span>
          </span>
        </div>

        <div className="mb-4 text-center">
          <div
            className={`mx-auto mb-2 flex h-9 w-9 items-center justify-center rounded-md border ${
              isDark ? 'border-slate-700 bg-[#0A1420] text-cyan-300' : 'border-[#D8E3F0] bg-[#F5F9FE] text-[#0A4275]'
            }`}
          >
            <KeyRound className="h-4 w-4" />
          </div>

          <h2 className={`text-lg font-black leading-tight ${isDark ? 'text-white' : 'text-[#0A2548]'}`}>
            {pageTitle}
          </h2>

          {userName && !isLogin && (
            <p className={`mt-1 text-xs font-bold ${isDark ? 'text-cyan-300' : 'text-[#0A4275]'}`}>
              {userCategory === 'internationals' ? 'International patient' : 'Local patient'}: {userName}
            </p>
          )}

          <p className={`mx-auto mt-1 max-w-xs text-xs font-medium leading-5 ${isDark ? 'text-slate-300' : 'text-slate-600'}`}>
            {pageCopy}
          </p>

          <div
            className={`mx-auto mt-3 inline-flex max-w-full items-center gap-2 rounded-md border px-3 py-2 text-xs font-semibold ${
              isDark ? 'border-slate-700 bg-[#0A1522] text-slate-200' : 'border-blue-100 bg-[#F0F5FA] text-slate-800'
            }`}
          >
            {isEmail ? <Mail className="h-3.5 w-3.5 text-blue-500" /> : <Smartphone className="h-3.5 w-3.5 text-cyan-500" />}
            <span className="min-w-0 truncate font-mono font-bold">{displayTarget}</span>
            <button
              type="button"
              onClick={onBackToCredentials}
              className={`ml-1 text-[11px] font-bold underline ${isDark ? 'text-cyan-300' : 'text-[#0A4275]'}`}
            >
              {t.changeNumber[language]}
            </button>
          </div>
        </div>

        <div className="space-y-3" onPaste={handlePaste}>
          <div className="grid grid-cols-6 gap-2">
            {otpCode.map((digit, index) => (
              <input
                key={index}
                ref={(element) => {
                  inputRefs.current[index] = element;
                }}
                id={`home-otp-digit-${index}`}
                type="text"
                inputMode="numeric"
                autoComplete="one-time-code"
                maxLength={1}
                value={digit}
                onChange={(event) => handleDigitChange(index, event.target.value)}
                onKeyDown={(event) => handleKeyDown(index, event)}
                onPaste={handlePaste}
                className={`h-12 w-full rounded-md border text-center font-mono text-lg font-black outline-none transition-all ${
                  digit ? 'border-[#0A4275] bg-white font-extrabold' : ''
                } ${
                  isDark
                    ? 'border-slate-700 bg-[#0A1420] text-white focus:border-cyan-400 focus:ring-2 focus:ring-cyan-400/20'
                    : 'border-[#C9D6E5] bg-[#F8FAFD] text-slate-900 focus:border-[#0A4275] focus:bg-white focus:ring-2 focus:ring-[#0A4275]/15'
                }`}
              />
            ))}
          </div>

          {errorMessage && (
            <p className="flex items-center justify-center gap-1 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-center text-xs font-semibold text-red-600">
              <AlertCircle className="h-3.5 w-3.5 flex-shrink-0" />
              {errorMessage}
            </p>
          )}

          {isAutoFilled && !errorMessage && (
            <div className="flex items-center justify-center gap-1.5 rounded-md border border-emerald-500/30 bg-emerald-500/10 px-3 py-2 text-xs font-bold text-emerald-600 dark:text-emerald-400">
              <Sparkles className="h-3.5 w-3.5 text-emerald-500" />
              <span>
                {language === 'sw'
                  ? 'OTP imejazwa kiotomatiki kutoka kwenye ujumbe'
                  : language === 'fr'
                  ? 'Code OTP rempli automatiquement'
                  : 'OTP code auto-filled from incoming message'}
              </span>
            </div>
          )}

          {showResendToast && (
            <p className="flex items-center justify-center gap-1 text-center text-xs font-semibold text-emerald-600">
              <CheckCircle2 className="h-3.5 w-3.5" />
              <span>{isEmail ? 'A new OTP code has been sent by email.' : TRANSLATIONS.otpModal.codeResent[language]}</span>
            </p>
          )}

          <div className="flex flex-wrap items-center justify-between gap-2 px-1 text-xs">
            <button
              type="button"
              onClick={handlePasteFromClipboard}
              className={`flex items-center gap-1.5 rounded-md border px-2.5 py-1.5 font-bold ${
                isDark ? 'border-cyan-800 bg-cyan-950/40 text-cyan-300' : 'border-blue-200 bg-blue-50 text-[#0A4275]'
              }`}
              title="Paste OTP code from clipboard"
            >
              <Sparkles className="h-3.5 w-3.5 text-cyan-500" />
              <span>{t.autoFillHelper[language]}</span>
            </button>

            {timerSeconds > 0 ? (
              <span className={`font-mono font-semibold ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
                {t.resendIn[language]} <span className="font-bold text-[#0A4275] dark:text-cyan-300">{timerSeconds}s</span>
              </span>
            ) : (
              <button
                type="button"
                onClick={() => handleResend()}
                className={`flex items-center gap-1 font-bold ${isDark ? 'text-cyan-300' : 'text-[#0A4275]'}`}
              >
                <RefreshCw className="h-3 w-3" />
                <span>{t.resendNow[language]}</span>
              </button>
            )}
          </div>

          <button
            id="btn-verify-home-otp"
            type="button"
            onClick={handleVerify}
            disabled={isVerifying}
            className={`flex w-full items-center justify-center gap-2 rounded-md px-4 py-3 text-sm font-black transition-colors disabled:opacity-60 ${
              isDark ? 'bg-cyan-500 text-slate-950 hover:bg-cyan-400' : 'bg-[#075FD6] text-white hover:bg-[#064FB4]'
            }`}
          >
            {isVerifying ? <RefreshCw className="h-4 w-4 animate-spin" /> : <ShieldCheck className="h-4 w-4" />}
            <span>{isLogin ? (language === 'sw' ? 'THIBITISHA NA UINGIE' : 'VERIFY & SIGN IN') : t.verifyBtn[language]}</span>
          </button>
        </div>
      </div>
    </section>
  );
};
