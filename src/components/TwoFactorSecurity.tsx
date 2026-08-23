import React, { useState } from 'react';
import {
  Lock,
  Send,
  ShieldCheck,
  AlertCircle,
  Shield,
  Smartphone,
  Mail,
  Check,
} from 'lucide-react';
import { Language, UserCategory, LocalFormData, InternationalFormData, Theme, OtpDeliveryChannel } from '../types';
import { TRANSLATIONS } from '../data/translations';

interface TwoFactorSecurityProps {
  userCategory: UserCategory;
  localData: LocalFormData;
  setLocalData?: (data: LocalFormData) => void;
  intlData: InternationalFormData;
  setIntlData?: (data: InternationalFormData) => void;
  language: Language;
  otpChannel: OtpDeliveryChannel;
  setOtpChannel: (channel: OtpDeliveryChannel) => void;
  pdpaAccepted: boolean;
  setPdpaAccepted: (accepted: boolean) => void;
  onSendOtp: (channel: OtpDeliveryChannel, target: string) => Promise<{ success: boolean; error?: string }>;
  onOpenPdpaModal: () => void;
  onOpenRegistrationChoice: () => void;
  authMode?: 'register' | 'login';
  theme?: Theme;
}

export const TwoFactorSecurity: React.FC<TwoFactorSecurityProps> = ({
  userCategory,
  localData,
  setLocalData,
  intlData,
  setIntlData,
  language,
  otpChannel,
  setOtpChannel,
  pdpaAccepted,
  setPdpaAccepted,
  onSendOtp,
  onOpenPdpaModal,
  onOpenRegistrationChoice,
  authMode = 'register',
  theme = 'light',
}) => {
  const [customEmail, setCustomEmail] = useState('');
  const [errorMessage, setErrorMessage] = useState('');
  const [isSending, setIsSending] = useState(false);
  const t = TRANSLATIONS.twoFactor;
  const isDark = theme === 'dark';

  // Read phone directly from identity card form
  const rawPhone = userCategory === 'locals' ? localData.phone : intlData.phone;
  const displayPhone =
    userCategory === 'locals'
      ? rawPhone
        ? `+255 ${rawPhone}`
        : '+255 7XX XXX XXX'
      : rawPhone
      ? `${intlData.countryCode || '+1'} ${rawPhone}`
      : '+1 XXX XXX XXXX';

  // Read email directly or fallback to customEmail
  const activeEmail =
    userCategory === 'locals'
      ? localData.email || customEmail
      : intlData.email || customEmail;

  const handleEmailChange = (val: string) => {
    setCustomEmail(val);
    setErrorMessage('');
    if (userCategory === 'locals' && setLocalData) {
      setLocalData({ ...localData, email: val });
    } else if (userCategory === 'internationals' && setIntlData) {
      setIntlData({ ...intlData, email: val });
    }
  };

  const handleSendOtpClick = async () => {
    setErrorMessage('');

    if (otpChannel === 'phone') {
      if (!rawPhone || rawPhone.trim().length < 5) {
        setErrorMessage(t.phoneMissingError[language]);
        return;
      }
    } else {
      if (!activeEmail || !activeEmail.includes('@') || activeEmail.trim().length < 5) {
        setErrorMessage(t.emailMissingError[language]);
        return;
      }
    }

    if (!pdpaAccepted) {
      setErrorMessage(t.consentError[language]);
      return;
    }

    const targetDestination = otpChannel === 'phone' ? rawPhone : activeEmail;
    setIsSending(true);
    const result = await onSendOtp(otpChannel, targetDestination);
    setIsSending(false);
    if (!result.success) {
      setErrorMessage(result.error || t.phoneMissingError[language]);
    }
  };

  return (
    <div
      id="block-2fa-security"
      className={`rounded-3xl border p-4 sm:p-6 shadow-xs relative transition-all duration-300 mt-3 ${
        isDark
          ? 'bg-[#101F31] border-slate-700/80 text-white shadow-[0_10px_30px_rgba(0,0,0,0.3)]'
          : 'bg-white border-slate-200/90 text-slate-900'
      }`}
    >
      {/* 2FA Header */}
      <div className="flex items-center justify-between mb-3.5">
        <div className="flex items-center gap-2">
          <Shield className={`w-4 h-4 ${isDark ? 'text-cyan-400' : 'text-slate-800'}`} />
          <h3 className={`text-sm font-bold tracking-tight ${isDark ? 'text-white' : 'text-slate-900'}`}>
            {t.title[language]}
          </h3>
        </div>

        <div
          className={`inline-flex items-center gap-1 text-[11px] font-bold px-2 py-0.5 rounded-md border ${
            isDark
              ? 'bg-emerald-950/60 text-emerald-300 border-emerald-800/80'
              : 'bg-emerald-50 text-emerald-600 border-emerald-200/70'
          }`}
        >
          <Lock className="w-3 h-3" />
          <span>{t.secureBadge[language]}</span>
        </div>
      </div>

      <div className="space-y-3.5">
        {/* Delivery Method Selector (2 Ways: Phone Number or Email) */}
        <div>
          <label className={`block text-xs font-bold mb-1.5 ${isDark ? 'text-slate-200' : 'text-slate-700'}`}>
            {t.chooseMethod[language]}
          </label>
          <div
            className={`grid grid-cols-2 gap-1.5 p-1 rounded-2xl border ${
              isDark ? 'bg-[#0A1522] border-slate-800' : 'bg-[#F0F5FA] border-slate-200'
            }`}
          >
            {/* Option 1: Phone (SMS) */}
            <button
              id="btn-otp-channel-phone"
              type="button"
              onClick={() => {
                setOtpChannel('phone');
                setErrorMessage('');
              }}
              className={`py-2 px-2.5 rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 transition-all cursor-pointer ${
                otpChannel === 'phone'
                  ? isDark
                    ? 'bg-cyan-500 text-slate-950 shadow-md font-extrabold'
                    : 'bg-[#0A4275] text-white shadow-md'
                  : isDark
                  ? 'text-slate-400 hover:text-white bg-transparent'
                  : 'text-slate-600 hover:text-slate-900 bg-transparent'
              }`}
            >
              <Smartphone className="w-3.5 h-3.5" />
              <span>{t.channelPhone[language]}</span>
            </button>

            {/* Option 2: Email */}
            <button
              id="btn-otp-channel-email"
              type="button"
              onClick={() => {
                setOtpChannel('email');
                setErrorMessage('');
              }}
              className={`py-2 px-2.5 rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 transition-all cursor-pointer ${
                otpChannel === 'email'
                  ? isDark
                    ? 'bg-cyan-500 text-slate-950 shadow-md font-extrabold'
                    : 'bg-[#0A4275] text-white shadow-md'
                  : isDark
                  ? 'text-slate-400 hover:text-white bg-transparent'
                  : 'text-slate-600 hover:text-slate-900 bg-transparent'
              }`}
            >
              <Mail className="w-3.5 h-3.5" />
              <span>{t.channelEmail[language]}</span>
            </button>
          </div>
        </div>

        {/* Dynamic Channel Target Box */}
        {otpChannel === 'phone' ? (
          <div
            className={`p-2.5 sm:p-3 rounded-2xl border flex items-center justify-between text-xs transition-all ${
              isDark ? 'bg-[#0A1522] border-slate-700/80 text-slate-300' : 'bg-[#F0F5FA] border-blue-100 text-slate-700'
            }`}
          >
            <div className="flex items-center gap-2">
              <Smartphone className={`w-4 h-4 ${isDark ? 'text-cyan-400' : 'text-[#0A4275]'}`} />
              <div>
                <p className="text-[11px] text-slate-500 font-medium">
                  {t.dispatchedToPhone[language]}
                </p>
                <p className={`font-mono font-bold text-xs sm:text-sm ${isDark ? 'text-white' : 'text-slate-900'}`}>
                  {rawPhone ? displayPhone : language === 'sw' ? '(Namba iliyojazwa hapo juu)' : '(Phone entered above)'}
                </p>
              </div>
            </div>
            <span
              className={`text-[10px] font-bold px-2 py-0.5 rounded-md ${
                isDark ? 'bg-cyan-950 text-cyan-300' : 'bg-blue-100 text-[#0A4275]'
              }`}
            >
              SMS
            </span>
          </div>
        ) : (
          /* Email Channel Target Display / Input */
          <div
            className={`p-2.5 sm:p-3 rounded-2xl border text-xs transition-all space-y-2 ${
              isDark ? 'bg-[#0A1522] border-slate-700/80 text-slate-300' : 'bg-[#F0F5FA] border-blue-100 text-slate-700'
            }`}
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Mail className={`w-4 h-4 ${isDark ? 'text-cyan-400' : 'text-[#0A4275]'}`} />
                <p className="text-[11px] text-slate-500 font-medium">
                  {t.dispatchedToEmail[language]}
                </p>
              </div>
              <span
                className={`text-[10px] font-bold px-2 py-0.5 rounded-md ${
                  isDark ? 'bg-purple-950 text-purple-300' : 'bg-indigo-100 text-indigo-800'
                }`}
              >
                EMAIL
              </span>
            </div>

            {/* Email Input Field if not filled or editable */}
            <div className="relative">
              <input
                id="input-2fa-email"
                type="email"
                placeholder={t.emailInputPlaceholder[language]}
                value={activeEmail}
                onChange={(e) => handleEmailChange(e.target.value)}
                className={`w-full text-xs sm:text-sm rounded-xl px-3 py-2 border outline-none font-medium transition-all ${
                  isDark
                    ? 'bg-[#0E1A29] text-white border-slate-700 focus:border-cyan-400 placeholder:text-slate-500'
                    : 'bg-white text-slate-900 border-slate-200 focus:border-[#0A4275] focus:ring-1 focus:ring-[#0A4275] placeholder:text-slate-400'
                }`}
              />
            </div>
          </div>
        )}

        {errorMessage && (
          <p className="text-xs text-red-500 font-semibold flex items-center gap-1 bg-red-50 dark:bg-red-950/40 p-2.5 rounded-xl border border-red-200 dark:border-red-900 animate-in fade-in">
            <AlertCircle className="w-4 h-4 flex-shrink-0" />
            <span>{errorMessage}</span>
          </p>
        )}

        {/* Primary Single Click "SEND OTP" Button */}
        <button
          id="btn-tuma-otp-2fa"
          type="button"
          onClick={handleSendOtpClick}
          disabled={isSending}
          className={`w-full p-3.5 rounded-2xl font-bold flex flex-col items-center justify-center gap-0.5 transition-all transform hover:-translate-y-0.5 ${
            isSending ? 'opacity-70 cursor-wait' : 'cursor-pointer'
          } ${
            isDark
              ? 'bg-cyan-500 hover:bg-cyan-400 text-slate-950 shadow-lg shadow-cyan-500/20'
              : 'bg-[#0A4275] hover:bg-[#08365f] text-white shadow-md shadow-[#0A4275]/20'
          }`}
        >
          <div className="flex items-center justify-center gap-2 text-sm sm:text-base font-extrabold tracking-wide">
            <Send className="w-4 h-4" />
            <span>{isSending ? '...' : t.sendOtpBtn[language]}</span>
          </div>
          <span
            className={`text-[11px] sm:text-xs font-normal ${
              isDark ? 'text-slate-900/80 font-semibold' : 'text-blue-100'
            }`}
          >
            {otpChannel === 'phone'
              ? language === 'sw'
                ? 'Utapokea namba ya OTP kwa SMS kwenye ukurasa wa nyumbani'
                : language === 'fr'
                ? 'Vous recevrez le code OTP par SMS sur la page d’accueil'
                : 'You will receive the OTP code via SMS on your home page'
              : language === 'sw'
              ? 'Utapokea namba ya OTP kwa Email kwenye ukurasa wa nyumbani'
              : language === 'fr'
              ? 'Vous recevrez le code OTP par Email sur la page d’accueil'
              : 'You will receive the OTP code via Email on your home page'}
          </span>
        </button>

        {/* PDPA Data Protection Consent Checkbox */}
        <div
          className={`rounded-2xl p-3 sm:p-3.5 border flex items-center justify-between gap-2.5 ${
            isDark ? 'bg-[#0A1522] border-slate-800' : 'bg-[#F8FAFC] border-slate-200'
          }`}
        >
          <div className="flex items-start gap-2.5">
            <div className="relative flex items-center h-5 mt-0.5">
              <input
                id="checkbox-pdpa-consent"
                type="checkbox"
                checked={pdpaAccepted}
                onChange={(e) => {
                  setPdpaAccepted(e.target.checked);
                  if (e.target.checked) setErrorMessage('');
                }}
                className="w-4 h-4 text-[#0A4275] bg-white border-slate-300 rounded-sm focus:ring-[#0A4275] cursor-pointer"
              />
            </div>

            <div className="text-xs">
              <label
                htmlFor="checkbox-pdpa-consent"
                className={`font-bold leading-tight cursor-pointer block ${isDark ? 'text-white' : 'text-slate-900'}`}
              >
                {t.pdpaLabel[language]}
              </label>
              <p className={`text-[11px] mt-0.5 leading-snug ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
                {t.pdpaSubtext[language]}
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onOpenPdpaModal}
            className={`w-7 h-7 rounded-full flex items-center justify-center flex-shrink-0 transition-colors cursor-pointer ${
              isDark ? 'bg-cyan-950 text-cyan-400 hover:bg-cyan-900' : 'bg-blue-50 text-[#0A4275] hover:bg-blue-100'
            }`}
            title="Read PDPA Compliance Terms"
          >
            <ShieldCheck className="w-4 h-4" />
          </button>
        </div>

        {/* Bottom Registration / Login Link */}
        <div className="pt-1 text-center">
          <p className={`text-xs sm:text-sm font-medium ${isDark ? 'text-slate-300' : 'text-slate-700'}`}>
            <span>
              {authMode === 'register'
                ? language === 'sw'
                  ? 'Tayari umesajiliwa? '
                  : language === 'fr'
                  ? 'Déjà inscrit ? '
                  : 'Already registered? '
                : t.notRegistered[language]}
            </span>
            <button
              id="btn-link-register"
              type="button"
              onClick={onOpenRegistrationChoice}
              className={`font-black hover:underline cursor-pointer ml-1 ${
                isDark ? 'text-cyan-400 hover:text-cyan-300' : 'text-[#0A4275]'
              }`}
            >
              {authMode === 'register'
                ? language === 'sw'
                  ? 'Ingia Hapa (Login)'
                  : language === 'fr'
                  ? 'Connexion'
                  : 'Login Here'
                : t.registerHere[language]}
            </button>
          </p>
          <p className={`text-[11px] font-semibold mt-0.5 ${isDark ? 'text-cyan-300/80' : 'text-[#0A4275]'}`}>
            {t.categorySubtext[language]}
          </p>

          {/* Mobile Home Indicator Bar */}
          <div className={`w-32 h-1 rounded-full mx-auto mt-4 ${isDark ? 'bg-slate-700' : 'bg-black/80'}`}></div>
        </div>
      </div>
    </div>
  );
};
