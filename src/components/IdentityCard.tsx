import React, { useState } from 'react';
import {
  User,
  CreditCard,
  FileText,
  Phone,
  Shield,
  Calendar,
  Sparkles,
  Info,
  ChevronDown,
  Globe,
  Mail,
  Check,
  Building2,
} from 'lucide-react';
import { UserCategory, Language, LocalFormData, InternationalFormData, Theme, LocalDocType } from '../types';
import { COUNTRIES_LIST } from '../data/countries';
import { TRANSLATIONS } from '../data/translations';
import { TANZANIA_INSURANCE_PROVIDERS } from '../data/insurance';
import { DateOfBirthSelector } from './DateOfBirthSelector';
import { BloodTypeSelector } from './BloodTypeSelector';
import { extractDobFromNida, formatDob, calculateAgeFromDob } from '../utils/dateUtils';
import { FEATURE_FLAGS } from '../config/app';

interface IdentityCardProps {
  userCategory: UserCategory;
  onCategoryChange: (cat: UserCategory) => void;
  localData: LocalFormData;
  setLocalData: React.Dispatch<React.SetStateAction<LocalFormData>>;
  intlData: InternationalFormData;
  setIntlData: React.Dispatch<React.SetStateAction<InternationalFormData>>;
  language: Language;
  intlContactMode: 'phone' | 'email';
  setIntlContactMode: (mode: 'phone' | 'email') => void;
  authMode?: 'register' | 'login';
  onAuthModeChange?: (mode: 'register' | 'login') => void;
  theme?: Theme;
}

export const IdentityCard: React.FC<IdentityCardProps> = ({
  userCategory,
  onCategoryChange,
  localData,
  setLocalData,
  intlData,
  setIntlData,
  language,
  intlContactMode,
  setIntlContactMode,
  authMode = 'register',
  onAuthModeChange,
  theme = 'light',
}) => {
  const [showDemoNotification, setShowDemoNotification] = useState(false);
  const t = TRANSLATIONS.identity;
  const isDark = theme === 'dark';

  const selectedDocType: LocalDocType = localData.selectedDocType || 'nida';

  // Format NIDA 20-digit string
  const handleNidaChange = (rawVal: string) => {
    const cleaned = rawVal.replace(/[^\d]/g, '').slice(0, 20);
    setLocalData((prev) => ({ ...prev, nidaNumber: cleaned }));
  };

  const handleSelectDocType = (docType: LocalDocType) => {
    setLocalData((prev) => ({ ...prev, selectedDocType: docType }));
  };

  // Demo auto-fill helper
  const handleAutoFillDemo = () => {
    if (userCategory === 'locals') {
      setLocalData({
        fullName: 'Amina Salum Bakari',
        age: '31',
        gender: 'female',
        bloodType: 'O+',
        birthDay: '12',
        birthMonth: '04',
        birthYear: '1995',
        dob: '1995-04-12',
        phone: '754829140',
        email: 'amina.bakari@niacare.go.tz',
        selectedDocType: localData.selectedDocType || 'nida',
        nidaNumber: '19950412111020000421',
        insuranceProvider: 'nhif',
        insuranceNumber: 'NHIF-TZ-8849201',
        birthCertId: 'RITA-2018-938210',
      });
    } else {
      setIntlData({
        fullName: 'Marcus Alexander Vance',
        age: '35',
        gender: 'male',
        bloodType: 'A+',
        birthDay: '24',
        birthMonth: '08',
        birthYear: '1990',
        dob: '1990-08-24',
        passportNumber: 'US89240182A',
        nationality: 'United States',
        phone: '7911 123456',
        countryCode: '+1',
        email: 'marcus.vance@globalhealth.org',
        travelInsuranceProvider: 'allianz',
        insuranceNumber: 'ALZ-EXP-992014',
      });
    }
    setShowDemoNotification(true);
    setTimeout(() => setShowDemoNotification(false), 2500);
  };

  return (
    <div
      id="card-identity-credentials"
      className={`rounded-2xl border p-4 sm:p-6 shadow-xs relative transition-all duration-300 ${
        isDark
          ? 'bg-[#101F31] border-slate-700/80 text-white shadow-[0_10px_30px_rgba(0,0,0,0.3)]'
          : 'bg-white border-slate-200/90 text-slate-900'
      }`}
    >
      {/* Card Top Title */}
      <div className="flex flex-col items-center text-center mb-4 relative">
        <div className="flex items-center justify-center gap-2 mb-1">
          <div
            className={`w-8 h-8 rounded-full flex items-center justify-center ${
              isDark ? 'bg-cyan-500/20 text-cyan-400' : 'bg-[#0A4275]/10 text-[#0A4275]'
            }`}
          >
            <Shield className="w-5 h-5 fill-current opacity-80" />
          </div>
          <h2
            className={`text-xl sm:text-2xl font-black tracking-tight ${
              isDark ? 'text-white' : 'text-slate-900'
            }`}
          >
            {t.welcome[language]}
          </h2>
        </div>
        <p className={`text-xs sm:text-sm font-medium ${isDark ? 'text-slate-300' : 'text-slate-600'}`}>
          {t.welcomeSubtitle[language]}
        </p>

        {/* Demo Preset Trigger */}
        {FEATURE_FLAGS.showDemoFill && (
          <button
            type="button"
            onClick={handleAutoFillDemo}
            className={`absolute right-0 top-0 text-[11px] px-2 py-1 rounded-lg border font-bold flex items-center gap-1 cursor-pointer transition-all ${
              isDark
                ? 'text-cyan-300 bg-cyan-950/60 hover:bg-cyan-900/60 border-cyan-800'
                : 'text-[#0A4275] hover:text-[#062847] bg-blue-50 hover:bg-blue-100 border-blue-200'
            }`}
            title="Auto-fill realistic test data"
          >
            <Sparkles className="w-3 h-3" />
            <span className="hidden sm:inline">{t.demoFill[language]}</span>
          </button>
        )}
      </div>

      {/* Mode Switcher: First Time Registration vs Quick Login — same flat
          tab style as the role/status tabs on every dashboard, not an
          oversized decorative segment picker. */}
      {onAuthModeChange && (
        <div className="mb-3 flex gap-1.5">
          <button
            id="tab-mode-register"
            type="button"
            onClick={() => onAuthModeChange('register')}
            className={`flex-1 rounded-lg py-2 px-3 text-xs font-bold transition-colors ${
              authMode === 'register'
                ? isDark
                  ? 'bg-cyan-500 text-[#041D34]'
                  : 'bg-[#0A4275] text-white'
                : isDark
                ? 'text-slate-400 hover:bg-slate-800'
                : 'text-slate-600 hover:bg-slate-100'
            }`}
          >
            {t.modeRegister[language]}
          </button>
          <button
            id="tab-mode-login"
            type="button"
            onClick={() => onAuthModeChange('login')}
            className={`flex-1 rounded-lg py-2 px-3 text-xs font-bold transition-colors ${
              authMode === 'login'
                ? isDark
                  ? 'bg-cyan-500 text-[#041D34]'
                  : 'bg-[#0A4275] text-white'
                : isDark
                ? 'text-slate-400 hover:bg-slate-800'
                : 'text-slate-600 hover:bg-slate-100'
            }`}
          >
            {t.modeLogin[language]}
          </button>
        </div>
      )}

      {/* Segment Switch / Tabs: Locals (Tanzanians) vs Internationals */}
      <div className="mb-4 flex gap-1.5">
        <button
          id="tab-segment-locals"
          type="button"
          onClick={() => onCategoryChange('locals')}
          className={`flex-1 rounded-lg py-2 px-3 text-xs sm:text-sm font-bold transition-colors ${
            userCategory === 'locals'
              ? isDark
                ? 'bg-cyan-500 text-[#041D34]'
                : 'bg-[#0A4275] text-white'
              : isDark
              ? 'text-slate-400 hover:bg-slate-800'
              : 'text-slate-600 hover:bg-slate-100'
          }`}
        >
          {t.tabLocals[language]}
        </button>
        <button
          id="tab-segment-internationals"
          type="button"
          onClick={() => onCategoryChange('internationals')}
          className={`flex-1 flex items-center justify-center gap-1.5 rounded-lg py-2 px-3 text-xs sm:text-sm font-bold transition-colors ${
            userCategory === 'internationals'
              ? isDark
                ? 'bg-cyan-500 text-[#041D34]'
                : 'bg-[#0A4275] text-white'
              : isDark
              ? 'text-slate-400 hover:bg-slate-800'
              : 'text-slate-600 hover:bg-slate-100'
          }`}
        >
          <Globe className="w-3.5 h-3.5" />
          {t.tabInternationals[language]}
        </button>
      </div>

      {/* Info Notice Box */}
      <div
        className={`rounded-xl p-2.5 sm:p-3 mb-4 flex items-center gap-2.5 text-xs ${
          isDark
            ? 'bg-cyan-950/40 border border-cyan-900/50 text-cyan-200'
            : 'bg-[#EBF3FC] border border-[#D0E3F7] text-[#0A4275]'
        }`}
      >
        <Info className="w-4 h-4 flex-shrink-0" />
        <p className="font-medium text-[11px] sm:text-xs leading-snug">
          {t.infoNotice[language]}
        </p>
      </div>

      {/* SECTION 1: Taarifa Binafsi (Personal Details) */}
      <div className="mb-4">
        <div className="flex items-center gap-2 mb-3">
          <User className={`w-4 h-4 ${isDark ? 'text-cyan-400' : 'text-slate-800'}`} />
          <h3 className={`text-sm font-bold tracking-tight ${isDark ? 'text-white' : 'text-slate-900'}`}>
            {t.personalInfoTitle[language]}
          </h3>
        </div>

        {/* Dynamic Form: LOCALS (TANZANIANS) */}
        {userCategory === 'locals' ? (
          <div className="space-y-3 animate-in fade-in duration-150">
            {/* Row 1: Jina Kamili */}
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
                <User className="w-4 h-4" />
              </div>
              <input
                id="input-local-name"
                type="text"
                placeholder={t.fullNamePlaceholder[language]}
                value={localData.fullName}
                onChange={(e) => setLocalData({ ...localData, fullName: e.target.value })}
                className={`w-full text-sm rounded-xl pl-10 pr-3.5 py-3 border outline-none transition-all ${
                  isDark
                    ? 'bg-[#091422] text-white border-slate-700 placeholder:text-slate-500 focus:border-cyan-400 focus:ring-1 focus:ring-cyan-400'
                    : 'bg-white text-slate-900 border-slate-200 placeholder:text-slate-400 focus:border-[#0A4275] focus:ring-2 focus:ring-[#0A4275]/15'
                }`}
              />
            </div>

            {/* Row 2: Tarehe ya Kuzaliwa (Day, Month, Year & Auto Age) */}
            <DateOfBirthSelector
              birthDay={localData.birthDay}
              birthMonth={localData.birthMonth}
              birthYear={localData.birthYear}
              age={localData.age}
              onChange={(updates) => {
                setLocalData((prev) => ({
                  ...prev,
                  birthDay: updates.birthDay,
                  birthMonth: updates.birthMonth,
                  birthYear: updates.birthYear,
                  age: updates.age,
                  dob: updates.dob,
                }));
              }}
              language={language}
              theme={theme}
            />

            {/* Row 3: Kundi la Damu (Blood Type) */}
            <BloodTypeSelector
              value={localData.bloodType}
              onChange={(bloodType) => {
                setLocalData((prev) => ({ ...prev, bloodType }));
              }}
              language={language}
              theme={theme}
            />

            {/* Row 4: Namba ya Simu with Flag Dropdown */}
            <div className="relative flex items-center">
              <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
                <Phone className="w-4 h-4" />
              </div>
              <input
                id="input-local-phone"
                type="tel"
                placeholder={t.phonePlaceholder[language]}
                value={localData.phone}
                onChange={(e) => setLocalData({ ...localData, phone: e.target.value })}
                className={`w-full text-sm rounded-xl pl-10 pr-28 py-3 border outline-none transition-all placeholder:text-slate-400 font-mono ${
                  isDark
                    ? 'bg-[#091422] text-white border-slate-700 placeholder:text-slate-500 focus:border-cyan-400 focus:ring-1 focus:ring-cyan-400'
                    : 'bg-white text-slate-900 border-slate-200 focus:border-[#0A4275] focus:ring-2 focus:ring-[#0A4275]/15'
                }`}
              />
              {/* Flag and prefix badge */}
              <div
                className={`absolute right-2 flex items-center gap-1.5 border rounded-lg px-2.5 py-1.5 text-xs font-mono font-bold ${
                  isDark
                    ? 'bg-[#0E1F33] border-slate-700 text-slate-200'
                    : 'bg-[#F4F8FC] border-slate-200 text-slate-700'
                }`}
              >
                <span>🇹🇿</span>
                <ChevronDown className="w-3 h-3 text-slate-400" />
                <span className={isDark ? 'text-white' : 'text-slate-800'}>+255</span>
              </div>
            </div>

            {/* Credential / Document Selection for Locals: NIDA vs Insurance vs Birth Certificate */}
            <div className="pt-2">
              <label className={`block text-xs font-bold mb-1.5 ${isDark ? 'text-slate-200' : 'text-slate-700'}`}>
                {t.docSelectorLabel[language]}
              </label>

              {/* 3-Way Segment Selector */}
              <div
                className={`grid grid-cols-3 gap-1 p-1 rounded-2xl border mb-3 ${
                  isDark ? 'bg-[#09131F] border-slate-800' : 'bg-[#F0F5FA] border-slate-200'
                }`}
              >
                {/* 1. NIDA */}
                <button
                  id="tab-doc-nida"
                  type="button"
                  onClick={() => handleSelectDocType('nida')}
                  className={`py-2 px-1.5 rounded-xl text-center flex flex-col items-center justify-center gap-0.5 transition-all cursor-pointer ${
                    selectedDocType === 'nida'
                      ? isDark
                        ? 'bg-cyan-500 text-[#041D34] font-bold'
                        : 'bg-[#0A4275] text-white font-bold'
                      : isDark
                      ? 'text-slate-400 hover:text-white bg-transparent'
                      : 'text-slate-600 hover:text-slate-900 bg-transparent'
                  }`}
                >
                  <div className="flex items-center gap-1">
                    <CreditCard className="w-3.5 h-3.5" />
                    <span className="text-[11px] sm:text-xs font-extrabold">{t.docNida[language]}</span>
                  </div>
                  <span className="text-[9px] opacity-80 leading-none">{t.docNidaSub[language]}</span>
                </button>

                {/* 2. Insurance ID */}
                <button
                  id="tab-doc-insurance"
                  type="button"
                  onClick={() => handleSelectDocType('insurance')}
                  className={`py-2 px-1.5 rounded-xl text-center flex flex-col items-center justify-center gap-0.5 transition-all cursor-pointer ${
                    selectedDocType === 'insurance'
                      ? isDark
                        ? 'bg-cyan-500 text-[#041D34] font-bold'
                        : 'bg-[#0A4275] text-white font-bold'
                      : isDark
                      ? 'text-slate-400 hover:text-white bg-transparent'
                      : 'text-slate-600 hover:text-slate-900 bg-transparent'
                  }`}
                >
                  <div className="flex items-center gap-1">
                    <Shield className="w-3.5 h-3.5" />
                    <span className="text-[11px] sm:text-xs font-extrabold">{t.docInsurance[language]}</span>
                  </div>
                  <span className="text-[9px] opacity-80 leading-none">{t.docInsuranceSub[language]}</span>
                </button>

                {/* 3. Birth Certificate */}
                <button
                  id="tab-doc-birth-cert"
                  type="button"
                  onClick={() => handleSelectDocType('birth_cert')}
                  className={`py-2 px-1.5 rounded-xl text-center flex flex-col items-center justify-center gap-0.5 transition-all cursor-pointer ${
                    selectedDocType === 'birth_cert'
                      ? isDark
                        ? 'bg-cyan-500 text-[#041D34] font-bold'
                        : 'bg-[#0A4275] text-white font-bold'
                      : isDark
                      ? 'text-slate-400 hover:text-white bg-transparent'
                      : 'text-slate-600 hover:text-slate-900 bg-transparent'
                  }`}
                >
                  <div className="flex items-center gap-1">
                    <FileText className="w-3.5 h-3.5" />
                    <span className="text-[11px] sm:text-xs font-extrabold">{t.docBirthCert[language]}</span>
                  </div>
                  <span className="text-[9px] opacity-80 leading-none">{t.docBirthCertSub[language]}</span>
                </button>
              </div>

              {/* Dynamic Credential Input Block based on Selected Doc Type */}
              <div
                className={`p-3 rounded-2xl border transition-all ${
                  isDark ? 'bg-[#0A1624] border-slate-700/80' : 'bg-[#F9FBFE] border-blue-100'
                }`}
              >
                {/* 1. NIDA Option Form */}
                {selectedDocType === 'nida' && (
                  <div className="space-y-2 animate-in fade-in duration-200">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-1.5 text-xs font-bold">
                        <CreditCard className={`w-3.5 h-3.5 ${isDark ? 'text-cyan-400' : 'text-[#0A4275]'}`} />
                        <span className={isDark ? 'text-white' : 'text-slate-800'}>{t.docNida[language]}</span>
                      </div>
                      <span
                        className={`text-[10px] font-mono font-bold px-2 py-0.5 rounded-md ${
                          localData.nidaNumber.length === 20
                            ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300'
                            : isDark
                            ? 'bg-slate-800 text-slate-300'
                            : 'bg-slate-100 text-slate-600'
                        }`}
                      >
                        {localData.nidaNumber.length}/20 digits
                      </span>
                    </div>

                    <div className="relative">
                      <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
                        <CreditCard className="w-4 h-4" />
                      </div>
                      <input
                        id="input-local-nida"
                        type="text"
                        maxLength={20}
                        placeholder={t.nidaPlaceholder[language]}
                        value={localData.nidaNumber}
                        onChange={(e) => handleNidaChange(e.target.value)}
                        className={`w-full text-sm font-mono tracking-wider rounded-xl pl-10 pr-3.5 py-3 border outline-none transition-all ${
                          isDark
                            ? 'bg-[#091422] text-white border-slate-700 placeholder:text-slate-500 focus:border-cyan-400 focus:ring-1 focus:ring-cyan-400'
                            : 'bg-white text-slate-900 border-slate-200 placeholder:text-slate-400 focus:border-[#0A4275] focus:ring-2 focus:ring-[#0A4275]/15'
                        }`}
                      />
                    </div>

                    {/* NIDA Smart DOB Detection Banner */}
                    {(() => {
                      const detected = extractDobFromNida(localData.nidaNumber);
                      if (detected.isValid && detected.year && detected.month && detected.day) {
                        const isAlreadySynced =
                          localData.birthYear === detected.year &&
                          localData.birthMonth === detected.month &&
                          localData.birthDay === detected.day;
                        
                        const detectedFormatted = formatDob(detected.year, detected.month, detected.day, language);
                        const calculatedAge = calculateAgeFromDob(detected.year, detected.month, detected.day);

                        return (
                          <div
                            className={`p-2.5 rounded-xl border flex items-center justify-between gap-2 text-xs transition-all animate-in fade-in ${
                              isAlreadySynced
                                ? isDark
                                  ? 'bg-emerald-950/40 border-emerald-800 text-emerald-300'
                                  : 'bg-emerald-50 border-emerald-200 text-emerald-800'
                                : isDark
                                ? 'bg-cyan-950/60 border-cyan-800 text-cyan-200'
                                : 'bg-blue-50 border-blue-200 text-[#0A4275]'
                            }`}
                          >
                            <div className="flex items-center gap-1.5 min-w-0">
                              <Sparkles className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                              <div className="truncate">
                                <span className="font-medium text-[11px] block">
                                  {t.nidaDobSyncHint?.[language] || 'NIDA imetambua tarehe ya kuzaliwa:'}
                                </span>
                                <span className="font-bold font-mono text-[11px]">
                                  {detectedFormatted} ({calculatedAge} {t.yearsOld?.[language] || 'Miaka'})
                                </span>
                              </div>
                            </div>

                            {!isAlreadySynced ? (
                              <button
                                type="button"
                                onClick={() => {
                                  setLocalData((prev) => ({
                                    ...prev,
                                    birthDay: detected.day,
                                    birthMonth: detected.month,
                                    birthYear: detected.year,
                                    age: calculatedAge,
                                    dob: `${detected.year}-${detected.month}-${detected.day}`,
                                  }));
                                }}
                                className="px-2.5 py-1 rounded-lg text-[10px] font-black bg-cyan-500 text-slate-950 hover:bg-cyan-400 transition-colors shrink-0 cursor-pointer shadow-2xs"
                              >
                                {t.applyNidaDob?.[language] || 'Sawazisha'}
                              </button>
                            ) : (
                              <span className="text-[10px] font-bold flex items-center gap-1 text-emerald-500 shrink-0">
                                <Check className="w-3.5 h-3.5" />
                                <span>Imeunganishwa</span>
                              </span>
                            )}
                          </div>
                        );
                      }
                      return null;
                    })()}

                    <p className={`text-[11px] leading-snug ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
                      {t.nidaHelp[language]}
                    </p>
                  </div>
                )}

                {/* 2. Insurance ID Option Form */}
                {selectedDocType === 'insurance' && (
                  <div className="space-y-2.5 animate-in fade-in duration-200">
                    <div className="flex items-center gap-1.5 text-xs font-bold">
                      <Shield className={`w-3.5 h-3.5 ${isDark ? 'text-cyan-400' : 'text-[#0A4275]'}`} />
                      <span className={isDark ? 'text-white' : 'text-slate-800'}>{t.insuranceProviderLabel[language]}</span>
                    </div>

                    {/* Insurance Scheme Dropdown */}
                    <div className="relative">
                      <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
                        <Building2 className="w-4 h-4" />
                      </div>
                      <select
                        id="select-local-insurance-provider"
                        value={localData.insuranceProvider}
                        onChange={(e) => setLocalData({ ...localData, insuranceProvider: e.target.value })}
                        className={`w-full text-xs sm:text-sm rounded-xl pl-10 pr-10 py-3 border outline-none transition-all appearance-none cursor-pointer font-medium ${
                          isDark
                            ? 'bg-[#091422] text-white border-slate-700 focus:border-cyan-400'
                            : 'bg-white text-slate-900 border-slate-200 focus:border-[#0A4275] focus:ring-2 focus:ring-[#0A4275]/15'
                        }`}
                      >
                        {TANZANIA_INSURANCE_PROVIDERS.map((provider) => (
                          <option key={provider.id} value={provider.id}>
                            {provider.name}
                          </option>
                        ))}
                      </select>
                      <div className="absolute inset-y-0 right-0 pr-3.5 flex items-center pointer-events-none text-slate-400">
                        <ChevronDown className="w-4 h-4" />
                      </div>
                    </div>

                    {/* Insurance Membership / Card Number */}
                    <div className="relative">
                      <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
                        <Shield className="w-4 h-4" />
                      </div>
                      <input
                        id="input-local-insurance-id"
                        type="text"
                        placeholder={t.insuranceIdPlaceholder[language]}
                        value={localData.insuranceNumber}
                        onChange={(e) => setLocalData({ ...localData, insuranceNumber: e.target.value.toUpperCase() })}
                        className={`w-full text-sm font-mono rounded-xl pl-10 pr-3.5 py-3 border outline-none transition-all uppercase ${
                          isDark
                            ? 'bg-[#091422] text-white border-slate-700 placeholder:text-slate-500 focus:border-cyan-400 focus:ring-1 focus:ring-cyan-400'
                            : 'bg-white text-slate-900 border-slate-200 placeholder:text-slate-400 focus:border-[#0A4275] focus:ring-2 focus:ring-[#0A4275]/15'
                        }`}
                      />
                    </div>

                    <p className={`text-[11px] leading-snug ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
                      {t.insuranceHelp[language]}
                    </p>
                  </div>
                )}

                {/* 3. Birth Certificate Option Form */}
                {selectedDocType === 'birth_cert' && (
                  <div className="space-y-2 animate-in fade-in duration-200">
                    <div className="flex items-center gap-1.5 text-xs font-bold">
                      <FileText className={`w-3.5 h-3.5 ${isDark ? 'text-cyan-400' : 'text-[#0A4275]'}`} />
                      <span className={isDark ? 'text-white' : 'text-slate-800'}>{t.docBirthCert[language]}</span>
                    </div>

                    <div className="relative">
                      <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
                        <FileText className="w-4 h-4" />
                      </div>
                      <input
                        id="input-local-rita"
                        type="text"
                        placeholder={t.birthCertPlaceholder[language]}
                        value={localData.birthCertId}
                        onChange={(e) => setLocalData({ ...localData, birthCertId: e.target.value.toUpperCase() })}
                        className={`w-full text-sm font-mono rounded-xl pl-10 pr-3.5 py-3 border outline-none transition-all uppercase ${
                          isDark
                            ? 'bg-[#091422] text-white border-slate-700 placeholder:text-slate-500 focus:border-cyan-400 focus:ring-1 focus:ring-cyan-400'
                            : 'bg-white text-slate-900 border-slate-200 placeholder:text-slate-400 focus:border-[#0A4275] focus:ring-2 focus:ring-[#0A4275]/15'
                        }`}
                      />
                    </div>
                    <p className={`text-[11px] leading-snug ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
                      {t.birthCertHelp[language]}
                    </p>
                  </div>
                )}
              </div>
            </div>
          </div>
        ) : (
          /* Dynamic Form: INTERNATIONALS (matching screenshot) */
          <div className="space-y-2.5 animate-in fade-in duration-150">
            {/* Row 1: Full Name */}
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
                <User className="w-4 h-4" />
              </div>
              <input
                id="input-intl-name"
                type="text"
                placeholder={t.fullNamePlaceholder[language]}
                value={intlData.fullName}
                onChange={(e) => setIntlData({ ...intlData, fullName: e.target.value })}
                className={`w-full text-sm rounded-xl pl-10 pr-3.5 py-3 border outline-none transition-all ${
                  isDark
                    ? 'bg-[#091422] text-white border-slate-700 placeholder:text-slate-500 focus:border-cyan-400'
                    : 'bg-white text-slate-900 border-slate-200 placeholder:text-slate-400 focus:border-[#0A4275] focus:ring-2 focus:ring-[#0A4275]/15'
                }`}
              />
            </div>

            {/* Row 2: Tarehe ya Kuzaliwa (Day, Month, Year & Auto Age) */}
            <DateOfBirthSelector
              birthDay={intlData.birthDay}
              birthMonth={intlData.birthMonth}
              birthYear={intlData.birthYear}
              age={intlData.age}
              onChange={(updates) => {
                setIntlData((prev) => ({
                  ...prev,
                  birthDay: updates.birthDay,
                  birthMonth: updates.birthMonth,
                  birthYear: updates.birthYear,
                  age: updates.age,
                  dob: updates.dob,
                }));
              }}
              language={language}
              theme={theme}
            />

            {/* Row 3: Kundi la Damu (Blood Type) */}
            <BloodTypeSelector
              value={intlData.bloodType}
              onChange={(bloodType) => {
                setIntlData((prev) => ({ ...prev, bloodType }));
              }}
              language={language}
              theme={theme}
            />

            {/* Row 4: Passport ID / Number */}
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
                <CreditCard className="w-4 h-4" />
              </div>
              <input
                id="input-intl-passport"
                type="text"
                placeholder={t.passportPlaceholder[language]}
                value={intlData.passportNumber}
                onChange={(e) => setIntlData({ ...intlData, passportNumber: e.target.value.toUpperCase() })}
                className={`w-full text-sm font-mono rounded-xl pl-10 pr-3.5 py-3 border outline-none transition-all uppercase ${
                  isDark
                    ? 'bg-[#091422] text-white border-slate-700 placeholder:text-slate-500 focus:border-cyan-400'
                    : 'bg-white text-slate-900 border-slate-200 placeholder:text-slate-400 focus:border-[#0A4275] focus:ring-2 focus:ring-[#0A4275]/15'
                }`}
              />
            </div>

            {/* Row 4: Nationality Dropdown */}
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
                <Globe className="w-4 h-4" />
              </div>
              <select
                id="select-intl-nationality"
                value={intlData.nationality}
                onChange={(e) => {
                  const found = COUNTRIES_LIST.find((c) => c.name === e.target.value);
                  setIntlData({
                    ...intlData,
                    nationality: e.target.value,
                    countryCode: found ? found.dialCode : intlData.countryCode,
                  });
                }}
                className={`w-full text-sm rounded-xl pl-10 pr-10 py-3 border outline-none transition-all appearance-none cursor-pointer ${
                  isDark
                    ? 'bg-[#091422] text-white border-slate-700 focus:border-cyan-400'
                    : 'bg-white text-slate-900 border-slate-200 focus:border-[#0A4275] focus:ring-2 focus:ring-[#0A4275]/15'
                }`}
              >
                <option value="">{t.nationalitySelect[language]}</option>
                {COUNTRIES_LIST.map((c) => (
                  <option key={c.code} value={c.name}>
                    {c.flag} {c.name} ({c.dialCode})
                  </option>
                ))}
              </select>
              <div className="absolute inset-y-0 right-0 pr-3.5 flex items-center pointer-events-none text-slate-400">
                <ChevronDown className="w-4 h-4" />
              </div>
            </div>

            {/* Row 5: Phone / Email toggle block matching screenshot */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <label className={`text-xs font-semibold flex items-center gap-1.5 ${isDark ? 'text-slate-300' : 'text-slate-700'}`}>
                  <Phone className="w-3.5 h-3.5 text-slate-500" />
                  <span>{t.contactLabel[language]}</span>
                </label>

                {/* Segment toggle buttons */}
                <div
                  className={`flex items-center p-0.5 rounded-lg border ${
                    isDark ? 'bg-[#09131F] border-slate-800' : 'bg-[#F0F5FA] border-slate-200'
                  }`}
                >
                  <button
                    type="button"
                    onClick={() => setIntlContactMode('phone')}
                    className={`px-3 py-1 text-xs font-bold rounded-md transition-all cursor-pointer ${
                      intlContactMode === 'phone'
                        ? isDark
                          ? 'bg-cyan-500 text-slate-950 shadow-2xs font-extrabold'
                          : 'bg-[#0A4275] text-white shadow-2xs'
                        : isDark
                        ? 'text-slate-400 hover:text-white'
                        : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    {t.phoneTab[language]}
                  </button>
                  <button
                    type="button"
                    onClick={() => setIntlContactMode('email')}
                    className={`px-3 py-1 text-xs font-bold rounded-md transition-all cursor-pointer ${
                      intlContactMode === 'email'
                        ? isDark
                          ? 'bg-cyan-500 text-slate-950 shadow-2xs font-extrabold'
                          : 'bg-[#0A4275] text-white shadow-2xs'
                        : isDark
                        ? 'text-slate-400 hover:text-white'
                        : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    {t.emailTab[language]}
                  </button>
                </div>
              </div>

              {/* Phone input with Country Code selector */}
              {intlContactMode === 'phone' ? (
                <div className="grid grid-cols-5 gap-2">
                  <div className="col-span-2 relative">
                    <select
                      value={intlData.countryCode}
                      onChange={(e) => setIntlData({ ...intlData, countryCode: e.target.value })}
                      className={`w-full text-xs font-mono font-bold rounded-xl px-2.5 py-3 border outline-none appearance-none cursor-pointer ${
                        isDark
                          ? 'bg-[#091422] text-white border-slate-700 focus:border-cyan-400'
                          : 'bg-white text-slate-900 border-slate-200 focus:border-[#0A4275]'
                      }`}
                    >
                      {COUNTRIES_LIST.map((c) => (
                        <option key={c.code} value={c.dialCode}>
                          {c.flag} {c.dialCode}
                        </option>
                      ))}
                    </select>
                    <div className="absolute inset-y-0 right-0 pr-2 flex items-center pointer-events-none text-slate-400">
                      <ChevronDown className="w-3.5 h-3.5" />
                    </div>
                  </div>

                  <div className="col-span-3">
                    <input
                      id="input-intl-phone"
                      type="tel"
                      placeholder={t.phonePlaceholder[language]}
                      value={intlData.phone}
                      onChange={(e) => setIntlData({ ...intlData, phone: e.target.value })}
                      className={`w-full text-sm font-mono rounded-xl px-3.5 py-3 border outline-none transition-all placeholder:text-slate-400 ${
                        isDark
                          ? 'bg-[#091422] text-white border-slate-700 focus:border-cyan-400'
                          : 'bg-white text-slate-900 border-slate-200 focus:border-[#0A4275] focus:ring-2 focus:ring-[#0A4275]/15'
                      }`}
                    />
                  </div>
                </div>
              ) : (
                /* Email input */
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
                    <Mail className="w-4 h-4" />
                  </div>
                  <input
                    id="input-intl-email"
                    type="email"
                    placeholder={t.emailPlaceholder[language]}
                    value={intlData.email}
                    onChange={(e) => setIntlData({ ...intlData, email: e.target.value })}
                    className={`w-full text-sm rounded-xl pl-10 pr-3.5 py-3 border outline-none transition-all placeholder:text-slate-400 ${
                      isDark
                        ? 'bg-[#091422] text-white border-slate-700 focus:border-cyan-400'
                        : 'bg-white text-slate-900 border-slate-200 focus:border-[#0A4275] focus:ring-2 focus:ring-[#0A4275]/15'
                    }`}
                  />
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {showDemoNotification && (
        <div className="text-[11px] text-emerald-800 bg-emerald-50 border border-emerald-200 p-2 rounded-xl text-center font-bold animate-in fade-in">
          {t.demoToast[language]}
        </div>
      )}
    </div>
  );
};
