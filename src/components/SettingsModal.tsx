import React, { useState, useEffect } from 'react';
import {
  Settings,
  X,
  Fingerprint,
  Scan,
  ShieldCheck,
  Smartphone,
  Lock,
  Check,
  Copy,
  Moon,
  Sun,
  Globe,
  Sparkles,
  ChevronRight,
  Shield,
  Key,
  User,
  Palette,
  Languages,
  IdCard,
  AlertTriangle,
} from 'lucide-react';
import { Language, Theme, UserCategory, LocalFormData, InternationalFormData } from '../types';
import { TRANSLATIONS } from '../data/translations';
import { WORLD_LANGUAGES } from '../data/languages';
import { getPatientCountry } from '../data/countries';
import { formatDob } from '../utils/dateUtils';
import { checkBiometricSupport, hasRegisteredBiometric, unregisterAllBiometrics, BiometricSupport } from '../lib/webauthn';

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  language: Language;
  onSelectLanguage: (lang: Language) => void;
  theme: Theme;
  onToggleTheme: () => void;
  onTriggerBiometric: (mode: 'fingerprint' | 'faceid') => void;
  onOpenPdpaModal: () => void;
  onOpenLanguageModal?: () => void;
  patientName?: string;
  patientId?: string;
  userCategory?: UserCategory;
  localData?: LocalFormData;
  intlData?: InternationalFormData;
  authUserId?: string | null;
}

export const SettingsModal: React.FC<SettingsModalProps> = ({
  isOpen,
  onClose,
  language,
  onSelectLanguage,
  theme,
  onToggleTheme,
  onTriggerBiometric,
  onOpenPdpaModal,
  onOpenLanguageModal,
  patientName = 'Amina Salum Bakari',
  patientId = 'NC-TZ-8849201',
  userCategory = 'local',
  localData,
  intlData,
  authUserId = null,
}) => {
  const [activeBiometricTab, setActiveBiometricTab] = useState<'fingerprint' | 'faceid'>('fingerprint');
  const [copiedId, setCopiedId] = useState(false);
  const [directOtpEnabled, setDirectOtpEnabled] = useState(true);

  // Real biometric state — checked against the actual browser/device, and
  // against whether this account has a registered WebAuthn credential.
  const [biometricSupport, setBiometricSupport] = useState<BiometricSupport | null>(null);
  const [isBiometricRegistered, setIsBiometricRegistered] = useState<boolean | null>(null);
  const [isBiometricBusy, setIsBiometricBusy] = useState(false);

  const t = TRANSLATIONS.settings;
  const isDark = theme === 'dark';
  const isSwahili = language === 'sw';
  const isLocal = userCategory === 'locals' || userCategory === 'local';
  const patientCountry = getPatientCountry(userCategory === 'internationals' ? 'internationals' : 'locals', localData, intlData);

  const refreshBiometricState = async () => {
    const support = await checkBiometricSupport();
    setBiometricSupport(support);
    if (authUserId) {
      setIsBiometricRegistered(await hasRegisteredBiometric(authUserId));
    } else {
      setIsBiometricRegistered(null);
    }
  };

  useEffect(() => {
    if (isOpen) {
      refreshBiometricState();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen, authUserId]);

  const handleToggleBiometricEnabled = async () => {
    if (!authUserId || isBiometricBusy) return;

    if (isBiometricRegistered) {
      // Turning off: actually deletes the stored credential(s).
      setIsBiometricBusy(true);
      const result = await unregisterAllBiometrics(authUserId);
      setIsBiometricBusy(false);
      if (result.success) {
        setIsBiometricRegistered(false);
      }
    } else {
      // Turning on: opens the real registration ceremony (BiometricModal).
      handleTestBiometric(activeBiometricTab);
    }
  };

  const resolvedPatientName = localData?.fullName || intlData?.fullName || patientName;
  const resolvedPatientPhone = isLocal
    ? localData?.phone ? `+255 ${localData.phone}` : '+255 754 829 140'
    : intlData?.phone ? `${intlData.countryCode || '+1'} ${intlData.phone}` : '+1 791 112 3456';

  let primaryDocType = 'NIDA / NIN';
  let primaryDocNumber = localData?.nidaNumber || '19950412111020000421';
  if (isLocal) {
    if (localData?.selectedDocType === 'insurance') {
      primaryDocType = 'Bima ID';
      primaryDocNumber = localData?.insuranceNumber || 'NHIF-TZ-8849201';
    } else if (localData?.selectedDocType === 'birth_cert') {
      primaryDocType = 'RITA Cert';
      primaryDocNumber = localData?.birthCertId || 'RITA-2018-938210';
    }
  } else {
    primaryDocType = 'Passport';
    primaryDocNumber = intlData?.passportNumber || 'US89240182A';
  }

  const quickLanguages: { code: string; label: string; nativeName: string; flag: string }[] = [
    { code: 'sw', label: 'Kiswahili', nativeName: 'Kiswahili', flag: '🇹🇿' },
    { code: 'en', label: 'English', nativeName: 'English', flag: '🇬🇧' },
    { code: 'fr', label: 'Français', nativeName: 'Français', flag: '🇫🇷' },
    { code: 'ar', label: 'العربية', nativeName: 'Arabic', flag: '🇸🇦' },
  ];

  const currentLangObj = WORLD_LANGUAGES.find((l) => l.code === language);
  const isCustomLangSelected = !quickLanguages.some((q) => q.code === language);

  if (!isOpen) return null;

  const handleCopyId = () => {
    navigator.clipboard.writeText(patientId);
    setCopiedId(true);
    setTimeout(() => setCopiedId(false), 2000);
  };

  const handleTestBiometric = (mode: 'fingerprint' | 'faceid') => {
    onClose();
    onTriggerBiometric(mode);
  };

  return (
    <div
      id="modal-settings-container"
      className="fixed inset-0 z-50 bg-black/75 backdrop-blur-md flex items-center justify-center p-3 sm:p-4 animate-in fade-in duration-200"
    >
      <div
        className={`w-full max-w-lg rounded-2xl shadow-2xl overflow-hidden border animate-in zoom-in-95 duration-200 flex flex-col max-h-[90vh] ${
          isDark
            ? 'bg-[#0E1A29] text-white border-slate-700 shadow-[0_20px_60px_rgba(0,0,0,0.6)]'
            : 'bg-white text-slate-800 border-slate-200'
        }`}
      >
        {/* Header */}
        <div
          className={`p-4 sm:p-5 flex items-center justify-between border-b ${
            isDark ? 'bg-[#0A1420] text-white border-slate-800' : 'bg-[#0A4275] text-white border-blue-900/40'
          }`}
        >
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-white/20 flex items-center justify-center">
              <Settings className="w-5 h-5 text-white" />
            </div>
            <div>
              <h3 className="font-extrabold text-base sm:text-lg tracking-tight">
                {t.title[language]}
              </h3>
              <p className="text-xs text-blue-100/90 font-medium">
                {t.subtitle[language]}
              </p>
            </div>
          </div>

          <button
            id="btn-close-settings-modal"
            type="button"
            onClick={onClose}
            className="w-8 h-8 rounded-full bg-white/10 hover:bg-white/20 text-white flex items-center justify-center transition-colors cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Scrollable Content Body */}
        <div className="p-4 sm:p-6 overflow-y-auto space-y-5 text-xs sm:text-sm">
          {/* SECTION 0: PATIENT IDENTITY & ID CREDENTIALS */}
          <div
            id="section-patient-identity"
            className={`p-4 rounded-2xl border ${
              isDark ? 'bg-[#0A1522] border-slate-800' : 'bg-[#F8FAFC] border-slate-200'
            }`}
          >
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <div
                  className={`w-7 h-7 rounded-lg flex items-center justify-center ${
                    isDark ? 'bg-cyan-500/20 text-cyan-400' : 'bg-blue-100 text-[#0A4275]'
                  }`}
                >
                  <IdCard className="w-4 h-4" />
                </div>
                <h4 className={`font-bold text-sm ${isDark ? 'text-white' : 'text-slate-900'}`}>
                  {language === 'sw' ? 'Kitambulisho cha Mgonjwa' : language === 'fr' ? 'Identifiant du Patient' : 'Patient Identity & ID'}
                </h4>
              </div>

              <span
                className={`text-[10px] font-bold px-2 py-0.5 rounded-full border flex items-center gap-1 ${
                  isDark
                    ? 'bg-emerald-950/80 text-emerald-300 border-emerald-800'
                    : 'bg-emerald-50 text-emerald-700 border-emerald-200'
                }`}
              >
                <span>{patientCountry.flag}</span>
                <span>{isLocal ? (language === 'sw' ? 'Raia wa Tanzania' : 'Tanzanian Citizen') : `${patientCountry.name}`}</span>
              </span>
            </div>

            {/* ID Card Display with Copy button */}
            <div
              className={`p-3.5 rounded-xl border flex flex-col sm:flex-row sm:items-center justify-between gap-3 ${
                isDark ? 'bg-[#08121E] border-slate-700/80' : 'bg-white border-slate-200 shadow-xs'
              }`}
            >
              <div className="space-y-0.5">
                <span className="text-[10px] uppercase font-bold text-slate-400 tracking-wider block">
                  {language === 'sw' ? 'NiaCare Patient ID' : 'Patient ID Number'}
                </span>
                <div className="flex items-center gap-2">
                  <span className="font-mono font-black text-sm text-cyan-500 dark:text-cyan-400 tracking-wide">
                    {patientId}
                  </span>
                  <span className="text-xs">{patientCountry.flag}</span>
                </div>
                <p className="text-[11px] font-medium text-slate-500 dark:text-slate-400">
                  {resolvedPatientName} • {resolvedPatientPhone}
                </p>
              </div>

              <button
                type="button"
                onClick={handleCopyId}
                className={`px-3 py-1.5 rounded-xl text-xs font-bold font-mono border flex items-center justify-center gap-1.5 cursor-pointer transition-all ${
                  copiedId
                    ? 'bg-emerald-500 text-white border-emerald-500'
                    : isDark
                    ? 'bg-slate-800 border-slate-600 text-slate-200 hover:border-cyan-400 hover:text-white'
                    : 'bg-slate-100 border-slate-300 text-slate-700 hover:bg-slate-200'
                }`}
                title="Copy Patient ID"
              >
                {copiedId ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5 text-slate-400" />}
                <span>{copiedId ? (language === 'sw' ? 'Imenakiliwa' : 'Copied') : (language === 'sw' ? 'Nakili ID' : 'Copy ID')}</span>
              </button>
            </div>

            {/* Document Details Mini Row */}
            <div className="grid grid-cols-2 gap-2 mt-2.5 pt-2.5 border-t border-slate-200 dark:border-slate-800 text-[11px]">
              <div>
                <span className="text-[10px] text-slate-400 font-semibold block">{primaryDocType}</span>
                <span className="font-mono font-bold text-slate-800 dark:text-slate-200 truncate block">
                  {primaryDocNumber}
                </span>
              </div>
              <div>
                <span className="text-[10px] text-slate-400 font-semibold block">
                  {language === 'sw' ? 'Hali ya Usajili' : 'Status'}
                </span>
                <span className="font-bold text-emerald-600 dark:text-emerald-400 flex items-center gap-1">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                  {language === 'sw' ? 'Imethibitishwa (Active)' : 'Verified (Active)'}
                </span>
              </div>
            </div>
          </div>
          {/* SECTION 1: APPEARANCE & THEME (Light / Dark) */}
          <div
            id="section-theme-settings"
            className={`p-4 rounded-2xl border ${
              isDark ? 'bg-[#0A1522] border-slate-800' : 'bg-[#F8FAFC] border-slate-200'
            }`}
          >
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-2">
                <div
                  className={`w-7 h-7 rounded-lg flex items-center justify-center ${
                    isDark ? 'bg-amber-500/20 text-amber-400' : 'bg-blue-100 text-[#0A4275]'
                  }`}
                >
                  <Palette className="w-4 h-4" />
                </div>
                <h4 className={`font-bold text-sm ${isDark ? 'text-white' : 'text-slate-900'}`}>
                  {t.appearanceSection?.[language] || 'Mandhari ya Mfumo (Appearance & Theme)'}
                </h4>
              </div>

              <span
                className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${
                  isDark
                    ? 'bg-cyan-950/80 text-cyan-300 border-cyan-800'
                    : 'bg-blue-50 text-blue-700 border-blue-200'
                }`}
              >
                {isDark ? 'Dark Mode Active' : 'Light Mode Active'}
              </span>
            </div>

            <p className={`text-xs mb-3.5 ${isDark ? 'text-slate-400' : 'text-slate-600'}`}>
              {t.appearanceDesc?.[language] || 'Chagua muundo wa mwanga au giza unaofaa macho yako.'}
            </p>

            {/* Theme Cards Selection */}
            <div className="grid grid-cols-2 gap-2.5">
              {/* Light Mode Option */}
              <button
                id="btn-settings-theme-light"
                type="button"
                onClick={() => {
                  if (isDark) onToggleTheme();
                }}
                className={`p-3 rounded-2xl border text-left cursor-pointer transition-all flex flex-col justify-between gap-2 relative ${
                  !isDark
                    ? 'bg-white border-blue-600 ring-2 ring-blue-500/20 shadow-md text-slate-900'
                    : 'bg-[#08111D] border-slate-800 hover:border-slate-700 text-slate-400'
                }`}
              >
                <div className="flex items-center justify-between">
                  <div className="w-8 h-8 rounded-xl bg-amber-100 text-amber-700 flex items-center justify-center shadow-xs">
                    <Sun className="w-4 h-4" />
                  </div>
                  {!isDark && (
                    <span className="w-5 h-5 rounded-full bg-blue-600 text-white flex items-center justify-center text-[10px] font-bold">
                      ✓
                    </span>
                  )}
                </div>
                <div>
                  <h5 className="font-bold text-xs">
                    {t.lightMode?.[language] || 'Mwanga (Light Mode)'}
                  </h5>
                  <p className="text-[10px] text-slate-500">Mchana / Clean White</p>
                </div>
              </button>

              {/* Dark Mode Option */}
              <button
                id="btn-settings-theme-dark"
                type="button"
                onClick={() => {
                  if (!isDark) onToggleTheme();
                }}
                className={`p-3 rounded-2xl border text-left cursor-pointer transition-all flex flex-col justify-between gap-2 relative ${
                  isDark
                    ? 'bg-[#13253A] border-cyan-400 ring-2 ring-cyan-500/20 shadow-md text-white'
                    : 'bg-white border-slate-200 hover:border-slate-300 text-slate-600'
                }`}
              >
                <div className="flex items-center justify-between">
                  <div className="w-8 h-8 rounded-xl bg-slate-900 text-cyan-400 flex items-center justify-center shadow-xs border border-cyan-500/30">
                    <Moon className="w-4 h-4" />
                  </div>
                  {isDark && (
                    <span className="w-5 h-5 rounded-full bg-cyan-500 text-slate-950 flex items-center justify-center text-[10px] font-bold">
                      ✓
                    </span>
                  )}
                </div>
                <div>
                  <h5 className="font-bold text-xs">
                    {t.darkMode?.[language] || 'Giza (Dark Mode)'}
                  </h5>
                  <p className="text-[10px] text-slate-400">Usiku / Obsidian Navy</p>
                </div>
              </button>
            </div>
          </div>

          {/* SECTION 2: SYSTEM LANGUAGE SELECTION */}
          <div
            id="section-language-settings"
            className={`p-4 rounded-2xl border ${
              isDark ? 'bg-[#0A1522] border-slate-800' : 'bg-[#F8FAFC] border-slate-200'
            }`}
          >
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-2">
                <div
                  className={`w-7 h-7 rounded-lg flex items-center justify-center ${
                    isDark ? 'bg-cyan-500/20 text-cyan-400' : 'bg-blue-100 text-[#0A4275]'
                  }`}
                >
                  <Languages className="w-4 h-4" />
                </div>
                <h4 className={`font-bold text-sm ${isDark ? 'text-white' : 'text-slate-900'}`}>
                  {t.languageSection?.[language] || 'Lugha ya Mfumo (Language)'}
                </h4>
              </div>

              <span
                className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${
                  isDark
                    ? 'bg-blue-950/80 text-cyan-300 border-blue-800'
                    : 'bg-blue-50 text-blue-700 border-blue-200'
                }`}
              >
                {currentLangObj ? `${currentLangObj.flag} ${currentLangObj.name}` : language.toUpperCase()}
              </span>
            </div>

            <p className={`text-xs mb-3.5 ${isDark ? 'text-slate-400' : 'text-slate-600'}`}>
              {t.languageDesc?.[language] || 'Chagua lugha kuu ya kutumia katika NiaCare.'}
            </p>

            {/* Quick Languages Grid */}
            <div className="grid grid-cols-2 gap-2 mb-3">
              {quickLanguages.map((lang) => {
                const isSelected = language === lang.code;
                return (
                  <button
                    key={lang.code}
                    id={`btn-settings-lang-${lang.code}`}
                    type="button"
                    onClick={() => onSelectLanguage(lang.code as Language)}
                    className={`p-2.5 rounded-xl border flex items-center justify-between gap-2 cursor-pointer transition-all ${
                      isSelected
                        ? isDark
                          ? 'bg-[#13253A] border-cyan-400 text-cyan-300 font-bold shadow-xs'
                          : 'bg-blue-50 border-[#0A4275] text-[#0A4275] font-bold shadow-xs'
                        : isDark
                        ? 'bg-[#08111D] border-slate-800 hover:border-slate-700 text-slate-300 font-medium'
                        : 'bg-white border-slate-200 hover:border-slate-300 text-slate-700 font-medium'
                    }`}
                  >
                    <div className="flex items-center gap-2">
                      <span className="text-base leading-none">{lang.flag}</span>
                      <span className="text-xs">{lang.label}</span>
                    </div>
                    {isSelected && (
                      <span
                        className={`w-4 h-4 rounded-full flex items-center justify-center text-[10px] font-bold ${
                          isDark ? 'bg-cyan-500 text-slate-950' : 'bg-[#0A4275] text-white'
                        }`}
                      >
                        ✓
                      </span>
                    )}
                  </button>
                );
              })}
            </div>

            {/* Custom Active Badge if using language beyond top 4 */}
            {isCustomLangSelected && currentLangObj && (
              <div className={`mb-3 p-2.5 rounded-xl border flex items-center justify-between ${
                isDark ? 'bg-[#13253A] border-cyan-500/50 text-cyan-300' : 'bg-blue-50 border-blue-300 text-[#0A4275]'
              }`}>
                <div className="flex items-center gap-2">
                  <span className="text-lg">{currentLangObj.flag}</span>
                  <div>
                    <p className="text-xs font-bold">{currentLangObj.name} ({currentLangObj.nativeName})</p>
                    <p className="text-[10px] opacity-80">{currentLangObj.region} Language Active</p>
                  </div>
                </div>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-cyan-500 text-slate-950">Active</span>
              </div>
            )}

            {/* Browse all 70+ World Languages Modal Trigger */}
            {onOpenLanguageModal && (
              <button
                id="btn-settings-open-all-languages"
                type="button"
                onClick={() => {
                  onClose();
                  onOpenLanguageModal();
                }}
                className={`w-full p-2.5 rounded-xl border text-xs font-bold flex items-center justify-between cursor-pointer transition-colors ${
                  isDark
                    ? 'bg-[#08121E] border-slate-700 text-cyan-300 hover:bg-slate-800'
                    : 'bg-white border-slate-200 text-[#0A4275] hover:bg-blue-50'
                }`}
              >
                <div className="flex items-center gap-2">
                  <Globe className="w-3.5 h-3.5 text-cyan-500" />
                  <span>{t.browseAllLanguages?.[language] || 'Tazama Lugha Zote 70+ za Dunia'}</span>
                </div>
                <ChevronRight className="w-4 h-4" />
              </button>
            )}
          </div>

          {/* SECTION 3: BIOMETRIC LOGIN & SECURITY */}
          <div
            id="section-biometric-settings"
            className={`p-4 rounded-2xl border ${
              isDark ? 'bg-[#0A1522] border-slate-800' : 'bg-[#F8FAFC] border-slate-200'
            }`}
          >
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-2">
                <div
                  className={`w-7 h-7 rounded-lg flex items-center justify-center ${
                    isDark ? 'bg-cyan-500/20 text-cyan-400' : 'bg-blue-100 text-[#0A4275]'
                  }`}
                >
                  <Fingerprint className="w-4 h-4" />
                </div>
                <h4 className={`font-bold text-sm ${isDark ? 'text-white' : 'text-slate-900'}`}>
                  {t.biometricSection[language]}
                </h4>
              </div>

              <span
                className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${
                  biometricSupport?.platformAuthenticatorAvailable
                    ? isDark
                      ? 'bg-emerald-950/80 text-emerald-300 border-emerald-800'
                      : 'bg-emerald-50 text-emerald-700 border-emerald-200'
                    : isDark
                    ? 'bg-amber-950/60 text-amber-300 border-amber-800'
                    : 'bg-amber-50 text-amber-700 border-amber-200'
                }`}
              >
                {biometricSupport === null
                  ? '...'
                  : biometricSupport.platformAuthenticatorAvailable
                  ? '✓ WebAuthn'
                  : isSwahili
                  ? '⚠ Haipo'
                  : '⚠ Unavailable'}
              </span>
            </div>

            <p className={`text-xs mb-3.5 ${isDark ? 'text-slate-400' : 'text-slate-600'}`}>
              {t.biometricDesc[language]}
            </p>

            {!authUserId ? (
              <div
                className={`mb-4 p-3 rounded-xl text-xs font-semibold flex items-center gap-2 ${
                  isDark ? 'bg-amber-950/40 text-amber-300 border border-amber-900' : 'bg-amber-50 text-amber-800 border border-amber-200'
                }`}
              >
                <AlertTriangle className="w-4 h-4 flex-shrink-0" />
                <span>{isSwahili ? 'Ingia kwenye akaunti yako kwanza kusanidi hii.' : 'Sign in to your account first to set this up.'}</span>
              </div>
            ) : biometricSupport && !biometricSupport.platformAuthenticatorAvailable ? (
              <div
                className={`mb-4 p-3 rounded-xl text-xs font-semibold flex items-center gap-2 ${
                  isDark ? 'bg-amber-950/40 text-amber-300 border border-amber-900' : 'bg-amber-50 text-amber-800 border border-amber-200'
                }`}
              >
                <AlertTriangle className="w-4 h-4 flex-shrink-0" />
                <span>
                  {isSwahili
                    ? 'Kifaa/kivinjari hiki hakina kihisi cha bayometriki (Touch ID/Face ID/Windows Hello).'
                    : 'This device or browser has no platform biometric sensor (Touch ID / Face ID / Windows Hello).'}
                </span>
              </div>
            ) : null}

            {/* Primary Action: Login with Fingerprint / Face ID Trigger Button */}
            <div className="space-y-2 mb-4">
              <button
                id="btn-settings-login-biometric"
                type="button"
                onClick={() => handleTestBiometric(activeBiometricTab)}
                disabled={!authUserId || !biometricSupport?.platformAuthenticatorAvailable}
                className={`w-full p-3.5 rounded-2xl font-bold flex items-center justify-between transition-all cursor-pointer group border disabled:opacity-50 disabled:cursor-not-allowed ${
                  isDark
                    ? 'bg-cyan-500 hover:bg-cyan-400 text-slate-950 border-cyan-400 shadow-md shadow-cyan-500/20'
                    : 'bg-[#0A4275] hover:bg-[#08365f] text-white border-[#0A4275] shadow-md shadow-[#0A4275]/20'
                }`}
              >
                <div className="flex items-center gap-2.5">
                  <div
                    className={`w-9 h-9 rounded-xl flex items-center justify-center ${
                      isDark ? 'bg-slate-950/20 text-slate-950' : 'bg-white/20 text-white'
                    }`}
                  >
                    {activeBiometricTab === 'fingerprint' ? (
                      <Fingerprint className="w-5 h-5" />
                    ) : (
                      <Scan className="w-5 h-5" />
                    )}
                  </div>
                  <div className="text-left">
                    <h5 className="font-black text-xs sm:text-sm tracking-wide">
                      {isBiometricRegistered
                        ? t.testBiometricBtn[language]
                        : isSwahili
                        ? 'Sajili Bayometriki'
                        : 'Register Biometric Login'}
                    </h5>
                    <p className={`text-[11px] ${isDark ? 'text-slate-900/80 font-medium' : 'text-blue-100'}`}>
                      {t.testBiometricSubtext[language]}
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-1">
                  <span className="text-[11px] uppercase tracking-wider font-extrabold hidden xs:inline">
                    {activeBiometricTab === 'fingerprint' ? 'Touch ID' : 'Face ID'}
                  </span>
                  <ChevronRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
                </div>
              </button>

              {/* Toggle Biometric Mode Selector */}
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => setActiveBiometricTab('fingerprint')}
                  className={`p-2.5 rounded-xl border text-xs font-bold flex items-center justify-center gap-1.5 cursor-pointer transition-all ${
                    activeBiometricTab === 'fingerprint'
                      ? isDark
                        ? 'bg-[#13253A] border-cyan-400 text-cyan-300'
                        : 'bg-blue-50 border-[#0A4275] text-[#0A4275]'
                      : isDark
                      ? 'bg-[#08111D] border-slate-700 text-slate-400'
                      : 'bg-white border-slate-200 text-slate-600'
                  }`}
                >
                  <Fingerprint className="w-3.5 h-3.5" />
                  <span>Fingerprint (Touch ID)</span>
                </button>

                <button
                  type="button"
                  onClick={() => setActiveBiometricTab('faceid')}
                  className={`p-2.5 rounded-xl border text-xs font-bold flex items-center justify-center gap-1.5 cursor-pointer transition-all ${
                    activeBiometricTab === 'faceid'
                      ? isDark
                        ? 'bg-[#13253A] border-cyan-400 text-cyan-300'
                        : 'bg-blue-50 border-[#0A4275] text-[#0A4275]'
                      : isDark
                      ? 'bg-[#08111D] border-slate-700 text-slate-400'
                      : 'bg-white border-slate-200 text-slate-600'
                  }`}
                >
                  <Scan className="w-3.5 h-3.5" />
                  <span>Face ID</span>
                </button>
              </div>
            </div>

            {/* Real Biometric Enabled Toggle — reflects (and controls) whether
                this account actually has a registered WebAuthn credential */}
            <div className="space-y-2.5 pt-1 border-t border-slate-200 dark:border-slate-800">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Fingerprint className="w-3.5 h-3.5 text-cyan-500" />
                  <span className={`text-xs font-semibold ${isDark ? 'text-slate-200' : 'text-slate-700'}`}>
                    {isSwahili ? 'Uthibitishaji wa Kibiolojia Umewashwa' : 'Biometric Login Enabled'}
                  </span>
                </div>
                <button
                  type="button"
                  onClick={handleToggleBiometricEnabled}
                  disabled={!authUserId || isBiometricBusy || !biometricSupport?.platformAuthenticatorAvailable}
                  className={`w-11 h-6 rounded-full transition-colors cursor-pointer relative p-0.5 disabled:opacity-40 disabled:cursor-not-allowed ${
                    isBiometricRegistered ? (isDark ? 'bg-cyan-500' : 'bg-[#0A4275]') : 'bg-slate-300 dark:bg-slate-700'
                  }`}
                >
                  <div
                    className={`w-5 h-5 rounded-full bg-white transition-transform ${
                      isBiometricRegistered ? 'translate-x-5' : 'translate-x-0'
                    }`}
                  />
                </button>
              </div>
              {isBiometricRegistered && (
                <p className={`text-[10px] ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>
                  {isSwahili
                    ? 'Kuzima kutafuta kifaa kilichosajiliwa kwenye akaunti yako.'
                    : 'Turning this off removes the registered credential from your account.'}
                </p>
              )}
            </div>

            {/* Hardware Status — real, not a static claim */}
            <div className={`mt-3 p-2 rounded-xl text-[11px] font-medium flex items-center gap-2 ${
              isDark ? 'bg-[#08121E] text-slate-400' : 'bg-white border border-slate-200 text-slate-600'
            }`}>
              <ShieldCheck className={`w-3.5 h-3.5 ${biometricSupport?.platformAuthenticatorAvailable ? 'text-emerald-500' : 'text-slate-400'}`} />
              <span>
                {biometricSupport === null
                  ? isSwahili
                    ? 'Inaangalia kifaa...'
                    : 'Checking device...'
                  : !biometricSupport.platformAuthenticatorAvailable
                  ? isSwahili
                    ? 'Hali ya Kifaa: Hakuna Kihisi cha Bayometriki'
                    : 'Device Status: No Biometric Sensor Detected'
                  : isBiometricRegistered
                  ? isSwahili
                    ? 'Hali ya Kifaa: Bayometriki Imesajiliwa (WebAuthn)'
                    : 'Device Status: Biometric Registered (WebAuthn)'
                  : isSwahili
                  ? 'Hali ya Kifaa: Tayari Kusajili (WebAuthn)'
                  : 'Device Status: Ready to Register (WebAuthn)'}
              </span>
            </div>
          </div>

          {/* SECTION 4: 2FA & HOME OTP DISPATCH SETTINGS */}
          <div
            className={`p-4 rounded-2xl border ${
              isDark ? 'bg-[#0A1522] border-slate-800' : 'bg-[#F8FAFC] border-slate-200'
            }`}
          >
            <div className="flex items-center gap-2 mb-2">
              <div
                className={`w-7 h-7 rounded-lg flex items-center justify-center ${
                  isDark ? 'bg-cyan-500/20 text-cyan-400' : 'bg-blue-100 text-[#0A4275]'
                }`}
              >
                <Smartphone className="w-4 h-4" />
              </div>
              <h4 className={`font-bold text-sm ${isDark ? 'text-white' : 'text-slate-900'}`}>
                {t.twoFactorSection[language]}
              </h4>
            </div>

            <div className="space-y-2.5">
              <div className="flex items-center justify-between">
                <div>
                  <p className={`text-xs font-bold ${isDark ? 'text-slate-200' : 'text-slate-800'}`}>
                    {t.smsOtpMethod[language]}
                  </p>
                  <p className={`text-[11px] ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
                    {t.directOtpDispatch[language]}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setDirectOtpEnabled(!directOtpEnabled)}
                  className={`w-11 h-6 rounded-full transition-colors cursor-pointer relative p-0.5 ${
                    directOtpEnabled ? (isDark ? 'bg-cyan-500' : 'bg-[#0A4275]') : 'bg-slate-300 dark:bg-slate-700'
                  }`}
                >
                  <div
                    className={`w-5 h-5 rounded-full bg-white transition-transform ${
                      directOtpEnabled ? 'translate-x-5' : 'translate-x-0'
                    }`}
                  />
                </button>
              </div>
            </div>
          </div>

          {/* SECTION 5: DATA PRIVACY & PDPA COMPLIANCE */}
          <div
            className={`p-4 rounded-2xl border ${
              isDark ? 'bg-[#0A1522] border-slate-800' : 'bg-[#F8FAFC] border-slate-200'
            }`}
          >
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-2">
                <div
                  className={`w-7 h-7 rounded-lg flex items-center justify-center ${
                    isDark ? 'bg-emerald-500/20 text-emerald-400' : 'bg-emerald-100 text-emerald-700'
                  }`}
                >
                  <Lock className="w-4 h-4" />
                </div>
                <h4 className={`font-bold text-sm ${isDark ? 'text-white' : 'text-slate-900'}`}>
                  {t.dataPrivacySection[language]}
                </h4>
              </div>

              <span className="text-[10px] font-bold text-emerald-500 bg-emerald-50 dark:bg-emerald-950/80 px-2 py-0.5 rounded-full border border-emerald-300 dark:border-emerald-800">
                AES-256
              </span>
            </div>

            <p className={`text-xs mb-3 ${isDark ? 'text-slate-400' : 'text-slate-600'}`}>
              {t.dataPrivacyDesc[language]}
            </p>

            <button
              type="button"
              onClick={() => {
                onClose();
                onOpenPdpaModal();
              }}
              className={`w-full p-2.5 rounded-xl border text-xs font-bold flex items-center justify-between cursor-pointer transition-colors ${
                isDark
                  ? 'bg-[#08121E] border-slate-700 text-cyan-300 hover:bg-slate-800'
                  : 'bg-white border-slate-200 text-[#0A4275] hover:bg-blue-50'
              }`}
            >
              <div className="flex items-center gap-2">
                <Shield className="w-3.5 h-3.5 text-cyan-500" />
                <span>{t.viewPdpaBtn[language]}</span>
              </div>
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Modal Bottom Actions */}
        <div
          className={`p-4 border-t flex items-center justify-end ${
            isDark ? 'bg-[#0A1420] border-slate-800' : 'bg-slate-50 border-slate-200'
          }`}
        >
          <button
            id="btn-save-settings"
            type="button"
            onClick={onClose}
            className={`w-full sm:w-auto px-6 py-2.5 rounded-xl font-bold text-xs sm:text-sm cursor-pointer transition-all shadow-md ${
              isDark
                ? 'bg-cyan-500 hover:bg-cyan-400 text-slate-950'
                : 'bg-[#0A4275] hover:bg-[#08365f] text-white'
            }`}
          >
            {t.saveChanges[language]}
          </button>
        </div>
      </div>
    </div>
  );
};

