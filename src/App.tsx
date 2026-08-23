import React, { useState } from 'react';
import { Header } from './components/Header';
import { EmergencyBar } from './components/EmergencyBar';
import { IdentityCard } from './components/IdentityCard';
import { TwoFactorSecurity } from './components/TwoFactorSecurity';
import { HomeOtpVerification } from './components/HomeOtpVerification';
import { SmsNotificationBanner } from './components/SmsNotificationBanner';
import { PatientHomeDashboard } from './components/PatientHomeDashboard';
import { TrustBar } from './components/TrustBar';
import { OtpModal } from './components/OtpModal';
import { BiometricModal } from './components/BiometricModal';
import { PdpaConsentModal } from './components/PdpaConsentModal';
import { SuccessPassportModal } from './components/SuccessPassportModal';
import { RegistrationModal } from './components/RegistrationModal';
import { LanguageSelectorModal } from './components/LanguageSelectorModal';
import { SettingsModal } from './components/SettingsModal';
import { AppointmentBookingModal } from './components/AppointmentBookingModal';
import { Appointment, INITIAL_APPOINTMENTS } from './data/doctors';
import { UserCategory, Language, LocalFormData, InternationalFormData, Theme, OtpDeliveryChannel } from './types';

export default function App() {
  const [language, setLanguage] = useState<Language>('en'); // Default to English, toggleable to Swahili, French, etc.
  const [theme, setTheme] = useState<Theme>('light');
  const [authMode, setAuthMode] = useState<'register' | 'login'>('register');
  const [isLanguageModalOpen, setIsLanguageModalOpen] = useState(false);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [isAppointmentsOpen, setIsAppointmentsOpen] = useState(false);
  const [appointmentsList, setAppointmentsList] = useState<Appointment[]>(INITIAL_APPOINTMENTS);
  const [userCategory, setUserCategory] = useState<UserCategory>('locals');
  const [intlContactMode, setIntlContactMode] = useState<'phone' | 'email'>('phone');
  const [isAuthenticated, setIsAuthenticated] = useState<boolean>(false);

  // Dual-mode OTP state (Phone vs Email)
  const [otpDeliveryChannel, setOtpDeliveryChannel] = useState<OtpDeliveryChannel>('phone');
  const [otpTarget, setOtpTarget] = useState<string>('');

  // In-page Home OTP states
  const [isHomeOtpActive, setIsHomeOtpActive] = useState(false);
  const [smsNotification, setSmsNotification] = useState<{
    isVisible: boolean;
    code: string;
    channel: OtpDeliveryChannel;
    target: string;
  } | null>(null);
  const [autoFillCode, setAutoFillCode] = useState<string>('');

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

  const activePhone =
    userCategory === 'locals'
      ? localData.phone ? `+255 ${localData.phone}` : '+255 754 829 140'
      : intlData.phone ? `${intlData.countryCode || '+1'} ${intlData.phone}` : '+1 791 112 3456';

  const activeEmail =
    userCategory === 'locals'
      ? localData.email || 'mwananchi@niacare.go.tz'
      : intlData.email || 'visitor@globalhealth.org';

  const activeName =
    userCategory === 'locals' ? localData.fullName : intlData.fullName;

  const handleTriggerOtp = (channel: OtpDeliveryChannel = otpDeliveryChannel, target?: string) => {
    setOtpDeliveryChannel(channel);
    const resolvedTarget = target || (channel === 'phone' ? activePhone : activeEmail);
    setOtpTarget(resolvedTarget);

    // Switch to Home OTP view right on the home page
    setIsHomeOtpActive(true);
    setAutoFillCode('');

    // Trigger incoming Notification banner (SMS or Email)
    const generatedOtp = '829140';
    setSmsNotification({
      isVisible: true,
      code: generatedOtp,
      channel,
      target: resolvedTarget,
    });

    // Automatically auto-fill the OTP when the message arrives - no manual typing required
    setTimeout(() => {
      setAutoFillCode(generatedOtp);
    }, 600);
  };

  const handleSmsAutoFill = (code: string) => {
    setAutoFillCode(code);
    setSmsNotification(null);
  };

  const handleTriggerBiometric = (mode: 'fingerprint' | 'faceid') => {
    setBiometricModal({ isOpen: true, mode });
  };

  const handleAuthSuccess = () => {
    setIsOtpOpen(false);
    setIsHomeOtpActive(false);
    setSmsNotification(null);
    setBiometricModal({ isOpen: false, mode: 'fingerprint' });
    setIsAuthenticated(true);
    setIsSuccessPassportOpen(true);
  };

  const handleResetForm = () => {
    setIsSuccessPassportOpen(false);
    setIsHomeOtpActive(false);
    setIsAuthenticated(false);
    setSmsNotification(null);
    setAutoFillCode('');
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

  const handleLogout = () => {
    setIsAuthenticated(false);
    setIsSuccessPassportOpen(false);
  };

  const isDark = theme === 'dark';

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
        <EmergencyBar language={language} />

        {/* Incoming Push Notification Banner (Dispatched via SMS or Email) */}
        {smsNotification && smsNotification.isVisible && (
          <SmsNotificationBanner
            isVisible={smsNotification.isVisible}
            code={smsNotification.code}
            channel={smsNotification.channel}
            target={smsNotification.target}
            onAutoFill={handleSmsAutoFill}
            onDismiss={() => setSmsNotification(null)}
            language={language}
            theme={theme}
          />
        )}

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
                onVerifySuccess={handleAuthSuccess}
                onBackToCredentials={() => setIsHomeOtpActive(false)}
                onResendOtp={(newChan) => handleTriggerOtp(newChan)}
                autoFillCode={autoFillCode}
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
                onSendOtp={handleTriggerOtp}
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
        onVerifySuccess={handleAuthSuccess}
        language={language}
        theme={theme}
      />

      <BiometricModal
        isOpen={biometricModal.isOpen}
        onClose={() => setBiometricModal({ ...biometricModal, isOpen: false })}
        onSuccess={handleAuthSuccess}
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

      {/* Global Appointment Booking Modal */}
      <AppointmentBookingModal
        isOpen={isAppointmentsOpen}
        onClose={() => setIsAppointmentsOpen(false)}
        language={language}
        theme={theme}
        userCategory={userCategory}
        localData={localData}
        intlData={intlData}
        appointmentsList={appointmentsList}
        setAppointmentsList={setAppointmentsList}
      />
    </div>
  );
}
