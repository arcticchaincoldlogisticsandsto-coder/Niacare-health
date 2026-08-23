import React from 'react';
import { MessageSquare, Mail, X, ArrowRight, Sparkles } from 'lucide-react';
import { Language, Theme, OtpDeliveryChannel } from '../types';
import { TRANSLATIONS } from '../data/translations';

interface SmsNotificationBannerProps {
  isVisible: boolean;
  code: string;
  channel?: OtpDeliveryChannel;
  target?: string;
  phone?: string;
  onAutoFill: (code: string) => void;
  onDismiss: () => void;
  language: Language;
  theme?: Theme;
}

export const SmsNotificationBanner: React.FC<SmsNotificationBannerProps> = ({
  isVisible,
  code,
  channel = 'phone',
  target,
  phone,
  onAutoFill,
  onDismiss,
  language,
  theme = 'light',
}) => {
  if (!isVisible) return null;

  const t = TRANSLATIONS.homeOtp;
  const isDark = theme === 'dark';
  const displayTarget = target || phone || (channel === 'phone' ? '+255 754 829 140' : 'user@example.com');
  const isEmail = channel === 'email';

  return (
    <div
      id="banner-incoming-otp-notification"
      className="w-full px-3 pt-2 pb-1 z-30 animate-in slide-in-from-top duration-300"
    >
      <div
        className={`w-full rounded-2xl p-3.5 shadow-xl border backdrop-blur-md transition-all ${
          isDark
            ? 'bg-[#0E1F33]/95 border-cyan-500/40 text-white shadow-[0_10px_25px_rgba(0,0,0,0.6)]'
            : 'bg-white/95 border-blue-200/90 text-slate-900 shadow-lg'
        }`}
      >
        <div className="flex items-start justify-between gap-2.5">
          <div className="flex items-start gap-2.5">
            <div
              className={`w-8 h-8 rounded-xl text-white flex items-center justify-center flex-shrink-0 shadow-xs ${
                isEmail
                  ? 'bg-gradient-to-br from-indigo-600 to-purple-600'
                  : 'bg-gradient-to-br from-[#0A4275] to-cyan-500'
              }`}
            >
              {isEmail ? <Mail className="w-4 h-4" /> : <MessageSquare className="w-4 h-4" />}
            </div>

            <div className="flex-1">
              <div className="flex items-center gap-2">
                <span
                  className={`text-[10px] font-extrabold uppercase tracking-wider ${
                    isEmail ? 'text-indigo-500 dark:text-indigo-400' : 'text-cyan-600 dark:text-cyan-400'
                  }`}
                >
                  {isEmail ? t.emailNotificationHeader[language] : t.smsNotificationHeader[language]}
                </span>
                <span className="text-[10px] font-mono text-slate-400">
                  {displayTarget}
                </span>
              </div>

              <p className={`text-xs font-semibold mt-0.5 leading-snug ${isDark ? 'text-slate-200' : 'text-slate-800'}`}>
                {isEmail ? t.emailNotificationBody[language] : t.smsNotificationBody[language]}
              </p>

              <div className="flex items-center gap-2 mt-2">
                <button
                  id="btn-otp-autofill-action"
                  type="button"
                  onClick={() => onAutoFill(code)}
                  className={`px-3 py-1 rounded-lg text-xs font-bold flex items-center gap-1.5 cursor-pointer transition-all ${
                    isDark
                      ? 'bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-extrabold shadow-sm'
                      : 'bg-[#0A4275] hover:bg-[#08365f] text-white shadow-xs'
                  }`}
                >
                  <Sparkles className="w-3.5 h-3.5" />
                  <span>{t.tapToAutoFill[language]} ({code})</span>
                  <ArrowRight className="w-3 h-3" />
                </button>
              </div>
            </div>
          </div>

          <button
            type="button"
            onClick={onDismiss}
            className={`w-6 h-6 rounded-full flex items-center justify-center transition-colors cursor-pointer flex-shrink-0 ${
              isDark
                ? 'text-slate-400 hover:text-white hover:bg-slate-800'
                : 'text-slate-400 hover:text-slate-700 hover:bg-slate-100'
            }`}
            title="Dismiss notification"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>
    </div>
  );
};
