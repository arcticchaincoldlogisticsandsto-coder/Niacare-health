import React, { useState, useEffect } from 'react';
import { Header } from './components/Header';
import { EmergencyBar } from './components/EmergencyBar';
import { IdentityCard } from './components/IdentityCard';
import { TwoFactorSecurity } from './components/TwoFactorSecurity';
import { HomeOtpVerification } from './components/HomeOtpVerification';
import { PatientHomeDashboard } from './components/PatientHomeDashboard';
import { TrustBar } from './components/TrustBar';
import { OtpModal } from './components/OtpModal';
import { BiometricModal } from './components/BiometricModal';
import { PdpaConsentModal } from './components/PdpaConsentModal';
import { SuccessPassportModal } from './components/SuccessPassportModal';
import { RegistrationModal } from './components/RegistrationModal';
import { LanguageSelectorModal } from './components/LanguageSelectorModal';
import { SettingsModal } from './components/SettingsModal';
import { Appointment } from './data/doctors';
import { UserCategory, Language, LocalFormData, InternationalFormData, Theme, OtpDeliveryChannel } from './types';
import { supabase } from './lib/supabaseClient';
import {
  sendOtp,
  verifyOtp,
  buildProfilePayload,
  upsertProfile,
  fetchProfile,
  mapProfileToFormData,
  signOut as supabaseSignOut,
} from './lib/auth';
import { fetchAppointments } from './lib/appointments';

export default function App() {
  const [language, setLanguage] = useState<Language>('en'); // Default to English, toggleable to Swahili, French, etc.
  const [theme, setTheme] = useState<Theme>('light');
  const [authMode, setAuthMode] = useState<'register' | 'login'>('register');
  const [isLanguageModalOpen, setIsLanguageModalOpen] = useState(false);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [appointmentsList, setAppointmentsList] = useState<Appointment[]>([]);
  const [userCategory, setUserCategory] = useState<UserCategory>('locals');
  const [intlContactMode, setIntlContactMode] = useState<'phone' | 'email'>('phone');
  const [isAuthenticated, setIsAuthenticated] = useState<boolean>(false);
  const [isSessionLoading, setIsSessionLoading] = useState(true);
  const [authUserId, setAuthUserId] = useState<string | null>(null);

  // Dual-mode OTP state (Phone vs Email)
  const [otpDeliveryChannel, setOtpDeliveryChannel] = useState<OtpDeliveryChannel>('phone');
  const [otpTarget, setOtpTarget] = useState<string>('');

  // In-page Home OTP states
  const [isHomeOtpActive, setIsHomeOtpActive] = useState(false);

  const handleToggleTheme = () => {
    setTheme((prev) => (prev === 'light' ? 'dark' : 'light'));
  };

  // Form states for Locals
  const [localData, setLocalData] = useState<LocalFormData>({
    fullName: '',
    age: '',
    gender: 'female',
    bloodType: '',
    birthDay: '',
    birthMonth: '',
    birthYear: '',
    dob: '',
    phone: '',
    email: '',
    selectedDocType: 'nida',
    nidaNumber: '',
    insuranceProvider: 'nhif',
    insuranceNumber: '',
    birthCertId: '',
  });

  // Form states for Internationals
  const [intlData, setIntlData] = useState<InternationalFormData>({
    fullName: '',
    age: '',
    gender: 'male',
    bloodType: '',
    birthDay: '',
    birthMonth: '',
    birthYear: '',
    dob: '',
    passportNumber: '',
    nationality: 'United States',
    phone: '',
    countryCode: '+1',
    email: '',
    travelInsuranceProvider: 'allianz',
    insuranceNumber: '',
  });

  // Security & 2FA states
  const [pdpaAccepted, setPdpaAccepted] = useState(true); // Pre-checked as in screenshot

  // Modals
  const [isOtpOpen, setIsOtpOpen] = useState(false);
  const [biometricModal, setBiometricModal] = useState<{ isOpen: boolean; mode: 'fingerprint' | 'faceid' }>({
    isOpen: false,
    mode: 'fingerprint',
  });
  const [isPdpaModalOpen, setIsPdpaModalOpen] = useState(false);
  const [isSuccessPassportOpen, setIsSuccessPassportOpen] = useState(false);
  const [isRegistrationChoiceOpen, setIsRegistrationChoiceOpen] = useState(false);

  // Local subscriber numbers are dialed with a leading 0 (e.g. 0627990768) but
  // E.164 phone auth requires it stripped (+255627990768, not +2550627990768).
  const stripLeadingZero = (num: string) => num.replace(/^0+/, '');

  const activePhone =
    userCategory === 'locals'
      ? localData.phone ? `+255 ${stripLeadingZero(localData.phone)}` : '+255 754 829 140'
      : intlData.phone
      ? `${intlData.countryCode || '+1'} ${stripLeadingZero(intlData.phone)}`
      : '+1 791 112 3456';

  const activeEmail =
    userCategory === 'locals'
      ? localData.email || 'mwananchi@niacare.go.tz'
      : intlData.email || 'visitor@globalhealth.org';

  const activeName =
    userCategory === 'locals' ? localData.fullName : intlData.fullName;

  // Restore an existing Supabase session on load (e.g. after a page refresh) instead of
  // always dropping back to the registration form.
  useEffect(() => {
    let active = true;

    const restoreSession = async () => {
      const { data } = await supabase.auth.getSession();
      const session = data.session;
      if (!active) return;

      if (session?.user) {
        setAuthUserId(session.user.id);
        const { profile } = await fetchProfile(session.user.id);
        if (!active) return;
        if (profile) {
          const mapped = mapProfileToFormData(profile);
          setUserCategory(mapped.userCategory);
          if (mapped.localData) {
            setLocalData((prev) => ({ ...prev, ...mapped.localData }));
          }
          if (mapped.intlData) {
            setIntlData((prev) => ({ ...prev, ...mapped.intlData }));
          }
          setIsAuthenticated(true);
        }
      }
      setIsSessionLoading(false);
    };

    restoreSession();
    return () => {
      active = false;
    };
  }, []);

  // Load the patient's real appointments from Supabase whenever they're authenticated.
  useEffect(() => {
    if (!isAuthenticated || !authUserId) return;
    let active = true;
    fetchAppointments(authUserId).then(({ appointments, error }) => {
      if (!active || error) return;
      setAppointmentsList(appointments);
    });
    return () => {
      active = false;
    };
  }, [isAuthenticated, authUserId]);

  const handleSendOtp = async (
    channel: OtpDeliveryChannel
  ): Promise<{ success: boolean; error?: string }> => {
    setOtpDeliveryChannel(channel);
    const resolvedTarget = channel === 'phone' ? activePhone : activeEmail;
    setOtpTarget(resolvedTarget);

    const normalizedTarget =
      channel === 'phone' ? `+${resolvedTarget.replace(/\D/g, '')}` : resolvedTarget.trim();

    const result = await sendOtp(channel, normalizedTarget, authMode === 'register');
    if (!result.success) {
      return result;
    }

    setIsHomeOtpActive(true);
    return { success: true };
  };

  const handleVerifyOtp = async (code: string): Promise<{ success: boolean; error?: string }> => {
    const normalizedTarget =
      otpDeliveryChannel === 'phone' ? `+${otpTarget.replace(/\D/g, '')}` : otpTarget.trim();

    const verifyResult = await verifyOtp(otpDeliveryChannel, normalizedTarget, code);
    if (!verifyResult.success || !verifyResult.userId) {
      return { success: false, error: verifyResult.error };
    }

    const userId = verifyResult.userId;
    setAuthUserId(userId);

    if (authMode === 'register') {
      const payload = buildProfilePayload(userId, userCategory, localData, intlData);
      const upsertResult = await upsertProfile(payload);
      if (!upsertResult.success) {
        return { success: false, error: upsertResult.error };
      }
    } else {
      const { profile, error } = await fetchProfile(userId);
      if (error) return { success: false, error };
      if (profile) {
        const mapped = mapProfileToFormData(profile);
        setUserCategory(mapped.userCategory);
        if (mapped.localData) {
          setLocalData((prev) => ({ ...prev, ...mapped.localData }));
        }
        if (mapped.intlData) {
          setIntlData((prev) => ({ ...prev, ...mapped.intlData }));
        }
      }
    }

    setIsOtpOpen(false);
    setIsHomeOtpActive(false);
    setBiometricModal({ isOpen: false, mode: 'fingerprint' });
    setIsAuthenticated(true);
    setIsSuccessPassportOpen(true);
    return { success: true };
  };

  const handleTriggerBiometric = (mode: 'fingerprint' | 'faceid') => {
    setBiometricModal({ isOpen: true, mode });
  };

  const handleResetForm = async () => {
    await supabaseSignOut();
    setAuthUserId(null);
    setIsSuccessPassportOpen(false);
    setIsHomeOtpActive(false);
    setIsAuthenticated(false);
    setOtpDeliveryChannel('phone');
    setOtpTarget('');
    setLocalData({
      fullName: '',
      age: '',
      gender: 'female',
      bloodType: '',
      birthDay: '',
      birthMonth: '',
      birthYear: '',
      dob: '',
      phone: '',
      email: '',
      selectedDocType: 'nida',
      nidaNumber: '',
      insuranceProvider: 'nhif',
      insuranceNumber: '',
      birthCertId: '',
    });
    setIntlData({
      fullName: '',
      age: '',
      gender: 'male',
      bloodType: '',
      birthDay: '',
      birthMonth: '',
      birthYear: '',
      dob: '',
      passportNumber: '',
      nationality: 'United States',
      phone: '',
      countryCode: '+1',
      email: '',
      travelInsuranceProvider: 'allianz',
      insuranceNumber: '',
    });
    setPdpaAccepted(true);
  };

  const handleLogout = async () => {
    await supabaseSignOut();
    setAuthUserId(null);
    setIsAuthenticated(false);
    setIsSuccessPassportOpen(false);
  };

  const isDark = theme === 'dark';

  if (isSessionLoading) {
    return (
      <div
        className={`min-h-screen flex items-center justify-center ${
          isDark ? 'bg-[#080E17] text-slate-100' : 'bg-[#F0F5FA] text-slate-800'
        }`}
      >
        <span className="text-sm font-semibold animate-pulse">Loading…</span>
      </div>
    );
  }

  return (
    <div
      className={`min-h-screen flex flex-col items-center justify-start antialiased transition-colors duration-300 ${
        isDark
          ? 'bg-[#080E17] text-slate-100 selection:bg-cyan-500 selection:text-slate-950'
          : 'bg-[#F0F5FA] text-slate-800 selection:bg-[#0A4275] selection:text-white'
      }`}
    >
      {/* Top Mobile Screen Wrapper matching Screenshot Frame */}
      <main
        className={`w-full max-w-[430px] sm:max-w-[460px] mx-auto min-h-screen flex flex-col sm:my-4 sm:rounded-[36px] overflow-hidden relative border transition-all duration-300 ${
          isDark
            ? 'bg-[#0B1522] border-slate-800 shadow-[0_25px_60px_rgba(0,0,0,0.85)]'
            : 'bg-white border-slate-200/80 shadow-xl'
        }`}
      >
        {/* Top Header Section */}
        <Header
          language={language}
          theme={theme}
          onOpenSettingsModal={() => setIsSettingsOpen(true)}
        />

        {/* Emergency Action: Red Bar for 1-Tap Ambulance Dispatch */}
        <EmergencyBar language={language} authUserId={authUserId} />

        {/* Main Content: Authenticated Patient Dashboard OR Credentials Form & OTP */}
        <div className="px-4 sm:px-5 pb-6 flex-1 flex flex-col">
          {isAuthenticated ? (
            /* Authenticated Patient Home Dashboard */
            <div className="pt-2">
              <PatientHomeDashboard
                userCategory={userCategory}
                localData={localData}
                intlData={intlData}
                language={language}
                theme={theme}
                onLogout={handleLogout}
                onOpenSettings={() => setIsSettingsOpen(true)}
                appointmentsList={appointmentsList}
                setAppointmentsList={setAppointmentsList}
                authUserId={authUserId}
              />
            </div>
          ) : isHomeOtpActive ? (
            /* Home Page In-Place OTP Verification */
            <div className="pt-2">
              <HomeOtpVerification
                channel={otpDeliveryChannel}
                target={otpTarget}
                phone={activePhone}
                userName={activeName}
                userCategory={userCategory}
                onVerify={handleVerifyOtp}
                onBackToCredentials={() => setIsHomeOtpActive(false)}
                onResendOtp={(newChan) => {
                  handleSendOtp(newChan);
                }}
                language={language}
                theme={theme}
              />
            </div>
          ) : (
            /* Credentials Form & Security Block */
            <>
              {/* Identity & Credential Card */}
              <IdentityCard
                userCategory={userCategory}
                onCategoryChange={setUserCategory}
                localData={localData}
                setLocalData={setLocalData}
                intlData={intlData}
                setIntlData={setIntlData}
                language={language}
                intlContactMode={intlContactMode}
                setIntlContactMode={setIntlContactMode}
                authMode={authMode}
                onAuthModeChange={setAuthMode}
                theme={theme}
              />

              {/* 2FA Security Block with Dual Delivery Option (Phone/Email) */}
              <TwoFactorSecurity
                userCategory={userCategory}
                localData={localData}
                setLocalData={setLocalData}
                intlData={intlData}
                setIntlData={setIntlData}
                language={language}
                otpChannel={otpDeliveryChannel}
                setOtpChannel={setOtpDeliveryChannel}
                pdpaAccepted={pdpaAccepted}
                setPdpaAccepted={setPdpaAccepted}
                onSendOtp={handleSendOtp}
                onOpenPdpaModal={() => setIsPdpaModalOpen(true)}
                onOpenRegistrationChoice={() => {
                  setAuthMode((prev) => (prev === 'register' ? 'login' : 'register'));
                  setIsRegistrationChoiceOpen(true);
                }}
                authMode={authMode}
                theme={theme}
              />
            </>
          )}
        </div>

        {/* Bottom Trust & Compliance Bar */}
        <TrustBar language={language} theme={theme} />
      </main>

      {/* Settings & Profile Modal */}
      <SettingsModal
        isOpen={isSettingsOpen}
        onClose={() => setIsSettingsOpen(false)}
        language={language}
        onSelectLanguage={setLanguage}
        theme={theme}
        onToggleTheme={handleToggleTheme}
        onTriggerBiometric={handleTriggerBiometric}
        onOpenPdpaModal={() => setIsPdpaModalOpen(true)}
        onOpenLanguageModal={() => setIsLanguageModalOpen(true)}
        userCategory={userCategory}
        localData={localData}
        intlData={intlData}
      />

      {/* World Language Selector Modal */}
      <LanguageSelectorModal
        isOpen={isLanguageModalOpen}
        onClose={() => setIsLanguageModalOpen(false)}
        currentLanguage={language}
        onSelectLanguage={setLanguage}
        theme={theme}
      />

      {/* Modals & Overlays */}
      <OtpModal
        isOpen={isOtpOpen}
        onClose={() => setIsOtpOpen(false)}
        phone={activePhone}
        onVerifySuccess={() => setIsOtpOpen(false)}
        language={language}
        theme={theme}
      />

      <BiometricModal
        isOpen={biometricModal.isOpen}
        onClose={() => setBiometricModal({ ...biometricModal, isOpen: false })}
        onSuccess={() => setBiometricModal({ ...biometricModal, isOpen: false })}
        mode={biometricModal.mode}
        language={language}
      />

      <PdpaConsentModal
        isOpen={isPdpaModalOpen}
        onClose={() => setIsPdpaModalOpen(false)}
        onAccept={() => setPdpaAccepted(true)}
        language={language}
      />

      <SuccessPassportModal
        isOpen={isSuccessPassportOpen}
        onClose={() => setIsSuccessPassportOpen(false)}
        onReset={handleResetForm}
        userCategory={userCategory}
        localData={localData}
        intlData={intlData}
        language={language}
      />

      <RegistrationModal
        isOpen={isRegistrationChoiceOpen}
        onClose={() => setIsRegistrationChoiceOpen(false)}
        onSelectCategory={(cat) => {
          setUserCategory(cat);
          setAuthMode('register');
        }}
        language={language}
        theme={theme}
      />

    </div>
  );
}
