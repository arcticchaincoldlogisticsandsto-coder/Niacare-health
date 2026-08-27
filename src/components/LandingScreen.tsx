import React, { useState } from 'react';
import {
  ArrowRight,
  BookOpenCheck,
  CalendarCheck,
  HeartHandshake,
  ShieldCheck,
  Siren,
  UsersRound,
  Video,
} from 'lucide-react';
import { Language, Theme } from '../types';
import familyImage from '../assets/images/welcome-family.jpg';
import logoImage from '../assets/images/niacare_app_logo_1787113371659.jpg';

interface LandingScreenProps {
  language: Language;
  theme: Theme;
  onGetStarted: () => void;
  onSignIn: () => void;
}

export const LandingScreen: React.FC<LandingScreenProps> = ({ language, theme, onGetStarted, onSignIn }) => {
  const isDark = theme === 'dark';
  const isSw = language === 'sw';
  const [imageMissing, setImageMissing] = useState(false);

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
      Icon: HeartHandshake,
      title: isSw ? 'Huduma Inayoaminika' : 'Trusted Care',
      desc: isSw ? 'Unganishwa na wataalamu waliothibitishwa.' : 'Connect with verified healthcare professionals.',
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
        <div className="grid flex-1 lg:grid-cols-[0.96fr_1.04fr]">
          <div className="relative order-2 flex flex-col justify-between px-5 py-8 sm:px-8 lg:order-1 lg:px-10 lg:py-9">
            <div>
              <div className="mb-8 flex items-center gap-2 lg:mb-12">
                <img src={logoImage} alt="NiaCare logo" className="h-9 w-9 rounded-lg object-contain" />
                <div>
                  <h1 className={`text-xl font-semibold leading-none ${isDark ? 'text-white' : 'text-[#0B1220]'}`}>
                    Nia<span className="text-primary">Care</span>
                  </h1>
                  <p className="mt-1 text-caption font-medium text-text-muted">
                    {isSw ? 'Huduma ya Afya kwa Kila Mtu' : 'Healthcare For Everyone'}
                  </p>
                </div>
              </div>

              <div className="max-w-xl">
                <h2 className={`text-heading-lg font-semibold leading-[1.1] sm:text-4xl lg:text-[44px] ${isDark ? 'text-white' : 'text-[#0B1220]'}`}>
                  {isSw ? 'Afya Yako.' : 'Your Health.'}
                  <span className="block text-primary">{isSw ? 'Kipaumbele Chetu' : 'Our Priority'}</span>
                </h2>
                <p className={`mt-5 max-w-md text-body leading-7 ${isDark ? 'text-slate-300' : 'text-text-secondary'}`}>
                  {isSw
                    ? 'Huduma bora ya afya kwako na wapendwa wako, wakati wowote, mahali popote.'
                    : 'Quality healthcare for you and your loved ones, anytime, anywhere.'}
                </p>
              </div>

              <div className="mt-7 grid gap-3 sm:grid-cols-2 lg:max-w-[520px]">
                {features.map(({ Icon, title, desc }) => (
                  <div
                    key={title}
                    className={`rounded-lg border p-3.5 ${
                      isDark ? 'border-slate-800 bg-[#101F31]' : 'border-border bg-white'
                    }`}
                  >
                    <div className="mb-2 flex h-8 w-8 items-center justify-center rounded-md bg-primary/10 text-primary">
                      <Icon className="h-4 w-4" />
                    </div>
                    <h3 className={`text-body-sm font-semibold ${isDark ? 'text-white' : 'text-[#0B1220]'}`}>{title}</h3>
                    <p className={`mt-1 text-caption leading-snug ${isDark ? 'text-slate-400' : 'text-text-secondary'}`}>
                      {desc}
                    </p>
                  </div>
                ))}
              </div>

              <div className="mt-8 flex flex-col gap-3 sm:max-w-md sm:flex-row">
                <button
                  type="button"
                  onClick={onGetStarted}
                  className="flex h-12 flex-1 items-center justify-center gap-2 rounded-lg bg-primary px-5 text-sm font-semibold text-white shadow-[0_12px_24px_rgba(13,148,136,0.24)] transition hover:bg-primary-light"
                >
                  {isSw ? 'Anza' : 'Get Started'}
                  <ArrowRight className="h-4 w-4" />
                </button>
                <button
                  type="button"
                  onClick={onSignIn}
                  className={`h-12 flex-1 rounded-lg border px-5 text-sm font-semibold transition ${
                    isDark
                      ? 'border-slate-700 bg-[#101F31] text-slate-100 hover:bg-[#16273C]'
                      : 'border-border bg-white text-[#0B1220] hover:bg-surface-elevated'
                  }`}
                >
                  {isSw ? 'Ingia' : 'Sign In'}
                </button>
              </div>
            </div>

            <div className="mt-8 grid gap-4 sm:grid-cols-3">
              {trustItems.map(({ Icon, title, desc }) => (
                <div key={title} className="flex items-start gap-3">
                  <Icon className="mt-0.5 h-5 w-5 shrink-0 text-primary" />
                  <div>
                    <h3 className={`text-body-sm font-semibold ${isDark ? 'text-white' : 'text-[#0B1220]'}`}>{title}</h3>
                    <p className={`mt-0.5 text-caption leading-snug ${isDark ? 'text-slate-400' : 'text-text-secondary'}`}>
                      {desc}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="relative order-1 min-h-[330px] overflow-hidden bg-surface-elevated sm:min-h-[440px] lg:order-2 lg:min-h-[680px]">
            <div className="absolute inset-0 bg-[linear-gradient(120deg,#F8FCFF_0%,#F0F7FE_35%,#E1F4F1_100%)]" />
            {!imageMissing && (
              <img
                src={familyImage}
                alt="Smiling family using NiaCare"
                className="absolute inset-0 h-full w-full object-cover object-center"
                onError={() => setImageMissing(true)}
              />
            )}
            <div className="absolute inset-x-0 bottom-0 h-36 bg-gradient-to-t from-[#0B1220]/35 to-transparent" />
            <div className="absolute inset-y-0 left-0 hidden w-[35%] bg-gradient-to-r from-white/80 to-transparent lg:block" />
            {imageMissing && (
              <div className="absolute inset-8 flex items-center justify-center rounded-xl bg-white shadow-inner">
                <HeartHandshake className="h-20 w-20 text-primary" />
              </div>
            )}
            <div className="absolute bottom-6 left-5 right-5 max-w-[300px] rounded-lg bg-[#0B1220]/90 px-5 py-4 text-white shadow-[0_16px_35px_rgba(11,18,32,0.35)] backdrop-blur sm:left-8">
              <p className="text-body-sm font-medium leading-5">
                {isSw ? 'Afya bora huanza na huduma sahihi.' : 'Better health starts with the right care.'}
              </p>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
};
