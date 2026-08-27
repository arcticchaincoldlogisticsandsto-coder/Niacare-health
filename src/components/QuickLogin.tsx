import React, { useState } from 'react';
import {
  AlertCircle,
  BookOpenCheck,
  CalendarCheck,
  ChevronDown,
  EyeOff,
  Fingerprint,
  Globe2,
  HeartPulse,
  LockKeyhole,
  Mail,
  Phone,
  ShieldCheck,
  Siren,
  UsersRound,
  Video,
} from 'lucide-react';
import { Language, OtpDeliveryChannel, Theme } from '../types';
import familyImage from '../assets/images/welcome-family.jpg';
import logoImage from '../assets/images/niacare_app_logo_1787113371659.jpg';

interface QuickLoginProps {
  language: Language;
  theme: Theme;
  onSendOtp: (channel: OtpDeliveryChannel, target: string) => Promise<{ success: boolean; error?: string }>;
  onRegister: () => void;
  onOpenLanguageSelector?: () => void;
}

export const QuickLogin: React.FC<QuickLoginProps> = ({
  language,
  theme,
  onSendOtp,
  onRegister,
  onOpenLanguageSelector,
}) => {
  const [channel, setChannel] = useState<OtpDeliveryChannel>('email');
  const [target, setTarget] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [remember, setRemember] = useState(true);
  const [error, setError] = useState('');
  const [sending, setSending] = useState(false);
  const [imageMissing, setImageMissing] = useState(false);
  const isDark = theme === 'dark';
  const isSw = language === 'sw';
  const languageLabel = language === 'sw' ? 'Kiswahili' : language === 'fr' ? 'Francais' : 'English';

  const send = async () => {
    const value = target.trim();
    if (!value || (channel === 'email' ? !value.includes('@') : !/^\+\d{8,15}$/.test(value))) {
      setError(
        channel === 'email'
          ? 'Enter the email address linked to your account.'
          : 'Enter your phone in international format, e.g. +255754829140.'
      );
      return;
    }

    setSending(true);
    setError('');
    const result = await onSendOtp(channel, value);
    setSending(false);
    if (!result.success) setError(result.error || 'We could not send a verification code.');
  };

  const features = [
    {
      Icon: CalendarCheck,
      title: isSw ? 'Weka Miadi' : 'Book Appointments',
      desc: isSw ? 'Ratibu ziara na wataalamu.' : 'Schedule visits with trusted healthcare professionals.',
    },
    {
      Icon: BookOpenCheck,
      title: isSw ? 'Rekodi za Afya' : 'Medical Records',
      desc: isSw ? 'Rekodi zako mahali pamoja.' : 'Access your health records securely in one place.',
    },
    {
      Icon: Video,
      title: isSw ? 'Telehealth' : 'Telehealth',
      desc: isSw ? 'Ongea na daktari ukiwa nyumbani.' : 'Consult with doctors from the comfort of your home.',
    },
    {
      Icon: Siren,
      title: isSw ? 'Huduma ya Dharura' : 'Emergency Care',
      desc: isSw ? 'Pata msaada unapouhitaji.' : 'Get immediate help when you need it the most.',
    },
  ];

  const trustItems = [
    {
      Icon: ShieldCheck,
      title: isSw ? 'Salama na Faragha' : 'Secure & Private',
      desc: isSw ? 'Taarifa zako zinalindwa.' : 'Your data is protected with top-level security.',
    },
    {
      Icon: HeartPulse,
      title: isSw ? 'Huduma Inayoaminika' : 'Trusted Care',
      desc: isSw ? 'Unganishwa na wataalamu waliothibitishwa.' : 'Connect with verified healthcare professionals.',
    },
    {
      Icon: LockKeyhole,
      title: isSw ? 'Msaada 24/7' : '24/7 Support',
      desc: isSw ? 'Tupo hapa muda wowote.' : "We're here for you whenever you need us.",
    },
    {
      Icon: UsersRound,
      title: isSw ? 'Kwa Kila Mtu' : 'For Everyone',
      desc: isSw ? 'Huduma bora kwa Waafrika wote.' : 'Quality healthcare for all Africans.',
    },
  ];

  return (
    <section className={`min-h-screen w-full p-0 sm:p-3 ${isDark ? 'bg-[#080E17]' : 'bg-[#F7FAFE]'}`}>
      <div
        className={`mx-auto flex min-h-screen w-full max-w-[1180px] flex-col overflow-hidden border shadow-[0_24px_80px_rgba(15,45,80,0.08)] sm:min-h-[calc(100vh-1.5rem)] sm:rounded-xl ${
          isDark ? 'border-slate-800 bg-[#0B1522]' : 'border-[#E4EBF4] bg-white'
        }`}
      >
        <div className="grid flex-1 lg:grid-cols-[1.08fr_0.92fr]">
          <div className="relative min-h-[360px] overflow-hidden bg-surface-elevated sm:min-h-[470px] lg:min-h-[640px]">
            <div className="absolute inset-0 bg-[linear-gradient(120deg,#F8FCFF_0%,#F0F7FE_30%,#E1F4F1_100%)]" />
            {!imageMissing && (
              <img
                src={familyImage}
                alt="Smiling family using NiaCare"
                className="absolute inset-0 h-full w-full object-cover object-center"
                onError={() => setImageMissing(true)}
              />
            )}
            <div className="absolute inset-y-0 left-0 w-[78%] bg-gradient-to-r from-white via-white/95 to-white/0 sm:w-[60%] lg:w-[46%]" />
            <div className="absolute inset-x-0 bottom-0 h-40 bg-gradient-to-t from-black/25 to-transparent" />

            <div className="relative z-10 flex min-h-[360px] flex-col justify-between p-5 sm:min-h-[470px] sm:p-8 lg:min-h-[640px]">
              <div>
                <div className="mb-7 flex items-center gap-2 lg:mb-12">
                  <img
                    src={logoImage}
                    alt="NiaCare logo"
                    className="h-8 w-8 rounded-lg object-contain"
                  />
                  <div>
                    <h1 className="text-xl font-semibold leading-none text-[#0B1220]">
                      Nia<span className="text-primary">Care</span>
                    </h1>
                    <p className="mt-1 text-caption font-medium text-[#526073]">
                      {isSw ? 'Huduma ya Afya kwa Kila Mtu' : 'Healthcare For Everyone'}
                    </p>
                  </div>
                </div>

                <div className="max-w-[245px]">
                  <h2 className="text-[26px] font-semibold leading-[1.15] text-[#0B1220] sm:text-[30px]">
                    {isSw ? 'Afya Yako.' : 'Your Health.'}
                    <span className="block text-primary">{isSw ? 'Kipaumbele Chetu' : 'Our Priority'}</span>
                  </h2>
                  <p className="mt-4 text-body-sm leading-6 text-[#405266] sm:mt-5 sm:text-body sm:leading-7">
                    {isSw
                      ? 'Huduma bora ya afya kwako na wapendwa wako, wakati wowote, mahali popote.'
                      : 'Quality healthcare for you and your loved ones, anytime, anywhere.'}
                  </p>
                </div>

                <div className="mt-5 grid gap-3 sm:mt-7 sm:max-w-[510px] sm:grid-cols-2 lg:block lg:max-w-none lg:space-y-4">
                  {features.map(({ Icon, title, desc }) => (
                    <div key={title} className="flex max-w-[250px] items-start gap-3">
                      <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-white/90 text-primary shadow-sm">
                        <Icon className="h-4 w-4" />
                      </div>
                      <div>
                        <h3 className="text-body-sm font-semibold text-[#0B1220]">{title}</h3>
                        <p className="mt-0.5 text-caption leading-snug text-[#526073]">{desc}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              <div className="mt-6 max-w-[250px] rounded-lg bg-[#0B1220]/90 px-5 py-4 text-white shadow-[0_16px_35px_rgba(11,18,32,0.35)] backdrop-blur sm:ml-[30%] lg:mt-0">
                <p className="text-body-sm font-medium leading-5">
                  {isSw ? 'Afya bora huanza na huduma sahihi.' : 'Better health starts with the right care.'}
                </p>
              </div>
            </div>
          </div>

          <div className={`relative flex min-h-[560px] flex-col px-5 py-6 sm:px-12 lg:px-16 ${isDark ? 'bg-[#0B1522] text-white' : 'bg-white'}`}>
            <div className="flex justify-end">
              <button
                type="button"
                onClick={onOpenLanguageSelector}
                className={`inline-flex h-9 items-center gap-2 rounded-lg border px-3 text-xs font-semibold ${
                  isDark ? 'border-slate-700 bg-[#101F31] text-slate-200' : 'border-border bg-white text-[#243A56]'
                }`}
              >
                <Globe2 className="h-4 w-4 text-primary" />
                {languageLabel}
                <ChevronDown className="h-3.5 w-3.5 text-slate-400" />
              </button>
            </div>

            <div className="mx-auto mt-8 w-full max-w-[382px] lg:mt-16">
              <h2 className={`text-heading-lg font-semibold leading-tight ${isDark ? 'text-white' : 'text-[#0B1220]'}`}>
                {isSw ? 'Karibu Tena' : 'Welcome Back'}
              </h2>
              <p className="mt-2 text-body-sm text-text-secondary">
                {isSw ? 'Ingia ili kuendelea na akaunti yako' : 'Sign in to continue to your account'}
              </p>

              <div className="mt-8 space-y-5">
                <div>
                  <div className="mb-2 flex items-center justify-between">
                    <label className={`text-xs font-semibold ${isDark ? 'text-slate-200' : 'text-[#1E3451]'}`}>
                      {isSw ? 'Barua pepe au Namba ya Simu' : 'Email or Phone Number'}
                    </label>
                    <button
                      type="button"
                      onClick={() => {
                        setChannel(channel === 'email' ? 'phone' : 'email');
                        setTarget('');
                        setError('');
                      }}
                      className="text-[11px] font-semibold text-primary"
                    >
                      {channel === 'email' ? 'Use SMS' : 'Use Email'}
                    </button>
                  </div>
                  <div className="relative">
                    {channel === 'email' ? (
                      <Mail className="absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-[#7890AA]" />
                    ) : (
                      <Phone className="absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-[#7890AA]" />
                    )}
                    <input
                      type={channel === 'email' ? 'email' : 'tel'}
                      value={target}
                      onChange={(event) => setTarget(event.target.value)}
                      placeholder={channel === 'email' ? 'Enter your email address' : '+255754829140'}
                      className={`h-12 w-full rounded-lg border pl-11 pr-4 text-sm font-medium outline-none transition focus:border-primary focus:ring-4 focus:ring-primary/10 ${
                        isDark
                          ? 'border-slate-700 bg-[#101F31] text-white placeholder:text-slate-500'
                          : 'border-border-strong bg-white text-text placeholder:text-placeholder'
                      }`}
                    />
                  </div>
                </div>

                <div>
                  <label className={`mb-2 block text-xs font-semibold ${isDark ? 'text-slate-200' : 'text-[#1E3451]'}`}>
                    {isSw ? 'Nenosiri' : 'Password'}
                  </label>
                  <div className="relative">
                    <LockKeyhole className="absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-[#7890AA]" />
                    <input
                      type={showPassword ? 'text' : 'password'}
                      placeholder={isSw ? 'Utatumiwa kodi ya uhakiki' : 'Secure code will be sent'}
                      className={`h-12 w-full rounded-lg border pl-11 pr-11 text-sm font-medium outline-none transition focus:border-primary focus:ring-4 focus:ring-primary/10 ${
                        isDark
                          ? 'border-slate-700 bg-[#101F31] text-white placeholder:text-slate-500'
                          : 'border-border-strong bg-white text-text placeholder:text-placeholder'
                      }`}
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-4 top-1/2 -translate-y-1/2 text-[#7890AA]"
                      aria-label={showPassword ? 'Hide password' : 'Show password'}
                    >
                      <EyeOff className="h-4 w-4" />
                    </button>
                  </div>
                </div>

                <div className="flex items-center justify-between">
                  <label className="flex items-center gap-2 text-xs font-medium text-text-secondary">
                    <input
                      type="checkbox"
                      checked={remember}
                      onChange={(event) => setRemember(event.target.checked)}
                      className="h-4 w-4 rounded border-border-strong accent-primary"
                    />
                    {isSw ? 'Nikumbuke' : 'Remember me'}
                  </label>
                  <button type="button" className="text-xs font-semibold text-primary">
                    {isSw ? 'Umesahau?' : 'Forgot Password?'}
                  </button>
                </div>

                {error && (
                  <p className="flex gap-2 text-xs font-medium text-danger">
                    <AlertCircle className="h-4 w-4 shrink-0" />
                    {error}
                  </p>
                )}

                <button
                  type="button"
                  onClick={send}
                  disabled={sending}
                  className="flex h-12 w-full items-center justify-center rounded-lg bg-primary text-sm font-semibold text-white shadow-[0_12px_24px_rgba(13,148,136,0.24)] transition hover:bg-primary-light disabled:opacity-60"
                >
                  {sending ? (isSw ? 'Inatuma...' : 'Sending...') : isSw ? 'Ingia' : 'Sign In'}
                </button>

                <div className="flex items-center gap-4 py-1">
                  <div className="h-px flex-1 bg-border" />
                  <span className="text-[11px] font-semibold text-text-muted">OR</span>
                  <div className="h-px flex-1 bg-border" />
                </div>

                <button
                  type="button"
                  onClick={() => setError('Passkey sign-in is available after first OTP verification on this device.')}
                  className={`flex h-12 w-full items-center justify-center gap-2 rounded-lg border text-sm font-semibold transition ${
                    isDark
                      ? 'border-slate-700 bg-[#101F31] text-slate-100 hover:bg-[#16273C]'
                      : 'border-border bg-white text-[#0B1220] hover:bg-surface-elevated'
                  }`}
                >
                  <Fingerprint className="h-4 w-4 text-primary" />
                  {isSw ? 'Endelea na Passkey' : 'Continue with Passkey'}
                </button>

                <p className="text-center text-sm font-medium text-text-secondary">
                  {isSw ? 'Huna akaunti?' : "Don't have an account?"}{' '}
                  <button type="button" onClick={onRegister} className="font-semibold text-primary">
                    {isSw ? 'Fungua Akaunti' : 'Create Account'}
                  </button>
                </p>
              </div>
            </div>
          </div>
        </div>

        <footer className={`border-t px-5 py-5 sm:px-7 sm:py-6 ${isDark ? 'border-slate-800 bg-[#081625]' : 'border-border bg-surface-elevated'}`}>
          <div className="mx-auto grid max-w-[930px] gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {trustItems.map(({ Icon, title, desc }) => (
              <div key={title} className="flex items-center gap-3">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg text-primary">
                  <Icon className="h-7 w-7" />
                </div>
                <div>
                  <h3 className={`text-body-sm font-semibold ${isDark ? 'text-white' : 'text-[#0B1220]'}`}>{title}</h3>
                  <p className={`mt-0.5 text-caption leading-snug ${isDark ? 'text-slate-400' : 'text-text-secondary'}`}>
                    {desc}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </footer>
      </div>
    </section>
  );
};
