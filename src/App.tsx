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
import { useTheme } from './components/ThemeProvider';
import { Appointment } from './data/doctors';
import { UserCategory, Language, LocalFormData, InternationalFormData, OtpDeliveryChannel, UserRole } from './types';
import { getStoredLanguage, storeLanguage } from './data/translations';
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
import { DoctorDashboard } from './components/DoctorDashboard';
import { ProviderDashboard } from './components/ProviderDashboard';
import { AdminDashboard } from './components/AdminDashboard';
import { QuickLogin } from './components/QuickLogin';
import { LandingScreen } from './components/LandingScreen';

export default function App() {
  const { theme, isDark, toggleTheme } = useTheme();
  const [language, setLanguageState] = useState<Language>(() => getStoredLanguage());
  const [authMode, setAuthMode] = useState<'register' | 'login'>('register');
  // Gates the Landing/Welcome screen before the login/register forms, matching
  // the reference design's flow (Landing -> Login/Register -> Verify -> App)
  // instead of dropping a first-time visitor straight into a form.
  const [hasEnteredAuthFlow, setHasEnteredAuthFlow] = useState(false);

  const setLanguage = (lang: Language) => {
    setLanguageState(lang);
    storeLanguage(lang);
  };
  const [isLanguageModalOpen, setIsLanguageModalOpen] = useState(false);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [appointmentsList, setAppointmentsList] = useState<Appointment[]>([]);
  const [userCategory, setUserCategory] = useState<UserCategory>('locals');
  const [intlContactMode, setIntlContactMode] = useState<'phone' | 'email'>('phone');
  const [isAuthenticated, setIsAuthenticated] = useState<boolean>(false);
  const [isSessionLoading, setIsSessionLoading] = useState(true);
  const [authUserId, setAuthUserId] = useState<string | null>(null);
  const [userRole, setUserRole] = useState<UserRole>('patient');

  // Dual-mode OTP state (Phone vs Email)
  const [otpDeliveryChannel, setOtpDeliveryChannel] = useState<OtpDeliveryChannel>('phone');
  const [otpTarget, setOtpTarget] = useState<string>('');

  // In-page Home OTP states
  const [isHomeOtpActive, setIsHomeOtpActive] = useState(false);

  const handleToggleTheme = toggleTheme;

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
  const [pdpaAccepted, setPdpaAccepted] = useState(false); // Explicit consent required before OTP send

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
      ? localData.phone ? `+255 ${stripLeadingZero(localData.phone)}` : ''
      : intlData.phone
      ? `${intlData.countryCode || '+1'} ${stripLeadingZero(intlData.phone)}`
      : '';

  const activeEmail =
    userCategory === 'locals'
      ? localData.email || ''
      : intlData.email || '';

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
          setUserRole(profile.role || 'patient');
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
    channel: OtpDeliveryChannel,
    targetOverride = ''
  ): Promise<{ success: boolean; error?: string }> => {
    setOtpDeliveryChannel(channel);
    const resolvedTarget = targetOverride.trim() || (channel === 'phone' ? activePhone : activeEmail);
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

    // A profile may already exist when a staff or admin user arrives through
    // the registration-looking OTP screen. Never overwrite that assigned role.
    const { profile: existingProfile, error: existingProfileError } = await fetchProfile(userId);
    if (existingProfileError) return { success: false, error: existingProfileError };

    if (existingProfile) {
      const mapped = mapProfileToFormData(existingProfile);
      setUserCategory(mapped.userCategory);
      setUserRole(existingProfile.role || 'patient');
      if (mapped.localData) setLocalData((prev) => ({ ...prev, ...mapped.localData }));
      if (mapped.intlData) setIntlData((prev) => ({ ...prev, ...mapped.intlData }));
    } else if (authMode === 'register') {
      const payload = buildProfilePayload(userId, userCategory, localData, intlData);
      const upsertResult = await upsertProfile(payload);
      if (!upsertResult.success) {
        return { success: false, error: upsertResult.error };
      }
      setUserRole('patient');
    } else {
      return { success: false, error: 'No account profile was found. Register first or ask an administrator to provision your account.' };
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
    setPdpaAccepted(false);
    setUserRole('patient');
    setHasEnteredAuthFlow(false);
  };

  const handleLogout = async () => {
    await supabaseSignOut();
    setAuthUserId(null);
    setIsAuthenticated(false);
    setIsSuccessPassportOpen(false);
    setHasEnteredAuthFlow(false);
  };

  if (isSessionLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center nc-bg nc-text">
        <div className="flex flex-col items-center gap-3">
          <div className="w-10 h-10 rounded-2xl bg-gradient-to-br from-[#0A4275] to-[#041D34] dark:from-cyan-500 dark:to-blue-600 animate-pulse" />
          <span className="text-sm font-semibold animate-pulse">Loading NiaCare…</span>
        </div>
      </div>
    );
  }

  // Admins get a full desktop console, not the patient-facing mobile shell
  // (hero, tagline, emergency-dispatch banner) used by every other role.
  if (isAuthenticated && userRole === 'admin') {
    return (
      <AdminDashboard
        language={language}
        authUserId={authUserId}
        onLogout={handleLogout}
        theme={theme}
        onToggleTheme={toggleTheme}
      />
    );
  }

  if (!isAuthenticated && hasEnteredAuthFlow && authMode === 'login' && !isHomeOtpActive) {
    return (
      <div className="min-h-screen antialiased transition-colors duration-300 nc-bg nc-text">
        <QuickLogin
          language={language}
          theme={theme}
          onSendOtp={handleSendOtp}
          onRegister={() => setAuthMode('register')}
          onOpenLanguageSelector={() => setIsLanguageModalOpen(true)}
        />

        <LanguageSelectorModal
          isOpen={isLanguageModalOpen}
          onClose={() => setIsLanguageModalOpen(false)}
          currentLanguage={language}
          onSelectLanguage={setLanguage}
          theme={theme}
        />
      </div>
    );
  }

  if (!isAuthenticated && !hasEnteredAuthFlow) {
    return (
      <div className="min-h-screen antialiased transition-colors duration-300 nc-bg nc-text">
        <LandingScreen
          language={language}
          theme={theme}
          onGetStarted={() => { setAuthMode('register'); setHasEnteredAuthFlow(true); }}
          onSignIn={() => { setAuthMode('login'); setHasEnteredAuthFlow(true); }}
        />

        <LanguageSelectorModal
          isOpen={isLanguageModalOpen}
          onClose={() => setIsLanguageModalOpen(false)}
          currentLanguage={language}
          onSelectLanguage={setLanguage}
          theme={theme}
        />
      </div>
    );
  }

  const shellMaxWidth = isAuthenticated && userRole !== 'patient' ? 'max-w-[1180px]' : 'max-w-[430px]';

  return (
    <div className="min-h-screen flex flex-col items-center justify-start antialiased transition-colors duration-300 nc-bg nc-text app-canvas">
      {/* A focused patient workspace on mobile, with a more natural clinical layout on larger screens. */}
      <main
        className={`w-full ${shellMaxWidth} mx-auto min-h-screen flex flex-col sm:my-4 sm:min-h-[calc(100vh-2rem)] sm:rounded-xl overflow-hidden relative border transition-all duration-300 ${
          isDark
            ? 'bg-[#0B1522] border-slate-800 shadow-[0_25px_60px_rgba(0,0,0,0.85)]'
            : 'bg-white border-slate-200/80 shadow-[0_8px_28px_rgba(36,72,112,0.10)]'
        }`}
      >
        {/* Top Header Section — the full marketing hero (logo, tagline,
            shield badge) belongs on the Landing screen only. Every screen
            after that (Login, Register, Verify OTP, Passkey Setup, and every
            authenticated dashboard) uses the compact single-row bar instead
            of repeating the hero on every step. */}
        <Header
          language={language}
          theme={theme}
          onOpenSettingsModal={() => setIsSettingsOpen(true)}
          compact={isAuthenticated || hasEnteredAuthFlow}
        />

        {/* Emergency Action: Red Bar for 1-Tap Ambulance Dispatch — a patient
            safety feature, not relevant to clinical/facility staff screens.
            Held back on the bare Landing screen itself: a first-time,
            anonymous visitor shouldn't be greeted by a full-bleed red alert
            bar before they've even chosen to sign up or sign in (the
            reference design treats emergency as one equal-weight button,
            not a dominant urgent banner) -- it reappears the moment they
            commit to Login/Register, and throughout the patient dashboard. */}
        {(hasEnteredAuthFlow || isAuthenticated) && (!isAuthenticated || userRole === 'patient') && (
          <EmergencyBar language={language} authUserId={authUserId} />
        )}

        {/* Main Content: Authenticated Patient Dashboard OR Credentials Form & OTP */}
        <div className={`flex-1 flex flex-col ${isAuthenticated && userRole !== 'patient' ? 'px-4 sm:px-6 lg:px-8 pb-8' : 'px-4 pb-24'}`}>
          {isAuthenticated ? (
            /* Authenticated role-based dashboard */
            <div className="pt-2">
              {userRole === 'doctor' ? (
                <DoctorDashboard language={language} theme={theme} authUserId={authUserId} onLogout={handleLogout} />
              ) : userRole === 'provider_staff' ? (
                <ProviderDashboard language={language} authUserId={authUserId} onLogout={handleLogout} />
              ) : (
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
              )}
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
                authMode={authMode}
                onVerify={handleVerifyOtp}
                onBackToCredentials={() => setIsHomeOtpActive(false)}
                onResendOtp={(newChan) => {
                  handleSendOtp(newChan);
                }}
                language={language}
                theme={theme}
              />
            </div>
          ) : !hasEnteredAuthFlow ? (
            <LandingScreen
              language={language}
              theme={theme}
              onGetStarted={() => { setAuthMode('register'); setHasEnteredAuthFlow(true); }}
              onSignIn={() => { setAuthMode('login'); setHasEnteredAuthFlow(true); }}
            />
          ) : authMode === 'login' ? (
            <QuickLogin
              language={language}
              theme={theme}
              onSendOtp={handleSendOtp}
              onRegister={() => setAuthMode('register')}
              onOpenLanguageSelector={() => setIsLanguageModalOpen(true)}
            />
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
                onOpenRegistrationChoice={() => setAuthMode('login')}
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
        authUserId={authUserId}
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
        authUserId={authUserId}
        patientName={userCategory === 'internationals' ? intlData.fullName : localData.fullName}
      />

      <PdpaConsentModal
        isOpen={isPdpaModalOpen}
        onClose={() => setIsPdpaModalOpen(false)}
        onAccept={() => setPdpaAccepted(true)}
        language={language}
      />

      <SuccessPassportModal
        isOpen={isSuccessPassportOpen}
        onClose={() => {
          setIsSuccessPassportOpen(false);
          // Offer passkey setup right after a fresh registration completes —
          // matches the reference flow (Verify OTP -> Passkey Setup -> App)
          // instead of leaving it buried in Settings where nobody finds it.
          if (authMode === 'register') handleTriggerBiometric('fingerprint');
        }}
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
