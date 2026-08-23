import React, { useState, useEffect } from 'react';
import {
  User,
  Shield,
  CreditCard,
  QrCode,
  Heart,
  Activity,
  Calendar,
  Pill,
  FileText,
  Building2,
  MapPin,
  Stethoscope,
  ChevronRight,
  LogOut,
  Sparkles,
  CheckCircle2,
  Phone,
  Copy,
  Check,
  Clock,
  Download,
  AlertCircle,
  X,
  Plus,
  Send,
  Navigation,
  ExternalLink,
  CalendarCheck,
  Video,
  Banknote,
  FolderLock,
  FileDown,
} from 'lucide-react';
import { UserCategory, Language, LocalFormData, InternationalFormData, Theme } from '../types';
import { TRANSLATIONS } from '../data/translations';
import { TANZANIA_INSURANCE_PROVIDERS } from '../data/insurance';
import { AppointmentBookingModal } from './AppointmentBookingModal';
import { CheckoutProcedureModal } from './CheckoutProcedureModal';
import { MedicalRecordsModal } from './MedicalRecordsModal';
import { Appointment, INITIAL_APPOINTMENTS } from '../data/doctors';
import { INITIAL_MEDICAL_RECORDS, MedicalRecord } from '../data/medicalRecords';
import { getPatientCountry } from '../data/countries';
import { formatDob } from '../utils/dateUtils';
import { generateMedicalRecordPdf, generateCompiledMedicalPassportPdf } from '../utils/pdfGenerator';

interface PatientHomeDashboardProps {
  userCategory: UserCategory;
  localData: LocalFormData;
  intlData: InternationalFormData;
  language: Language;
  theme: Theme;
  onLogout: () => void;
  onOpenSettings: () => void;
  appointmentsList?: Appointment[];
  setAppointmentsList?: React.Dispatch<React.SetStateAction<Appointment[]>>;
}

export const PatientHomeDashboard: React.FC<PatientHomeDashboardProps> = ({
  userCategory,
  localData,
  intlData,
  language,
  theme,
  onLogout,
  onOpenSettings,
  appointmentsList: externalAppointmentsList,
  setAppointmentsList: externalSetAppointmentsList,
}) => {
  const t = TRANSLATIONS.dashboard;
  const isDark = theme === 'dark';

  // Active sub-modals for dashboard actions
  const [activeModal, setActiveModal] = useState<
    'qr' | 'appointment' | 'prescriptions' | 'records' | 'personal_files' | 'insurance' | 'facilities' | 'ai' | 'checkout' | null
  >(null);

  // Quick PDF download toast notice
  const [pdfToast, setPdfToast] = useState<string | null>(null);

  // Direct download for a single record from dashboard
  const handleQuickRecordDownload = (record: MedicalRecord, e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      const patientMeta = {
        name: isLocal ? localData.fullName || 'Amina Salum Bakari' : intlData.fullName || 'Marcus Alexander Vance',
        id: isLocal ? localData.docNumber || 'TZ-NIDA-882194' : intlData.passportNumber || 'PASS-USA-99214',
        dob: isLocal ? formatDob(localData.dob) || '12 Apr 1995' : intlData.dob || '12 Apr 1995',
        bloodType: isLocal ? localData.bloodGroup || 'O+' : intlData.bloodGroup || 'O+',
        phone: isLocal ? localData.phone || '+255 754 829 140' : intlData.phone || '+1 415 892 0192',
        insurance: isLocal ? localData.insuranceProvider || 'NHIF Tanzania' : intlData.travelInsurance || 'Allianz Global Health',
        docType: isLocal ? localData.docType || 'NIDA / NIN' : 'International Passport',
        docNumber: isLocal ? localData.docNumber || '19950412111020000421' : intlData.passportNumber || 'A29381944',
      };
      generateMedicalRecordPdf(record, patientMeta, language);
      setPdfToast(
        language === 'sw'
          ? `Ripoti ya "${record.title}" imepakuliwa kama PDF!`
          : `Report "${record.title}" downloaded as PDF!`
      );
      setTimeout(() => setPdfToast(null), 4000);
    } catch (err) {
      console.error(err);
    }
  };

  // Direct download for complete health passport PDF
  const handleDirectPassportPdfDownload = () => {
    try {
      const patientMeta = {
        name: isLocal ? localData.fullName || 'Amina Salum Bakari' : intlData.fullName || 'Marcus Alexander Vance',
        id: isLocal ? localData.docNumber || 'TZ-NIDA-882194' : intlData.passportNumber || 'PASS-USA-99214',
        dob: isLocal ? formatDob(localData.dob) || '12 Apr 1995' : intlData.dob || '12 Apr 1995',
        bloodType: isLocal ? localData.bloodGroup || 'O+' : intlData.bloodGroup || 'O+',
        phone: isLocal ? localData.phone || '+255 754 829 140' : intlData.phone || '+1 415 892 0192',
        insurance: isLocal ? localData.insuranceProvider || 'NHIF Tanzania' : intlData.travelInsurance || 'Allianz Global Health',
        docType: isLocal ? localData.docType || 'NIDA / NIN' : 'International Passport',
        docNumber: isLocal ? localData.docNumber || '19950412111020000421' : intlData.passportNumber || 'A29381944',
      };
      generateCompiledMedicalPassportPdf(INITIAL_MEDICAL_RECORDS, patientMeta, language);
      setPdfToast(
        language === 'sw'
          ? 'Pasipoti Kamili ya Afya (NiaCare Health Passport) imepakuliwa kama PDF!'
          : 'Complete NiaCare Health Passport downloaded as compiled PDF!'
      );
      setTimeout(() => setPdfToast(null), 4000);
    } catch (err) {
      console.error(err);
    }
  };

  // Appointments Management State (internal or lifted)
  const [internalAppointmentsList, setInternalAppointmentsList] = useState<Appointment[]>(INITIAL_APPOINTMENTS);
  const appointmentsList = externalAppointmentsList || internalAppointmentsList;
  const setAppointmentsList = externalSetAppointmentsList || setInternalAppointmentsList;
  const [appointmentToast, setAppointmentToast] = useState<string | null>(null);

  const [copiedId, setCopiedId] = useState(false);
  const [pillTaken, setPillTaken] = useState(false);
  const [selectedHospital, setSelectedHospital] = useState('Muhimbili National Hospital');
  const [selectedSpecialty, setSelectedSpecialty] = useState('General Physician');
  const [refillRequested, setRefillRequested] = useState(false);

  // AI Triage Chat state
  const [aiMessage, setAiMessage] = useState('');
  const [aiChatHistory, setAiChatHistory] = useState<Array<{ sender: 'user' | 'ai'; text: string }>>([
    {
      sender: 'ai',
      text:
        language === 'sw'
          ? 'Habari! Mimi ni NiaAI, Mshauri wako wa Afya. Una dalili gani leo (mf. homa, maumivu ya kichwa, uchovu)?'
          : language === 'fr'
          ? 'Bonjour ! Je suis NiaAI, votre assistant santé. Quels symptômes ressentez-vous aujourd’hui ?'
          : 'Hello! I am NiaAI, your smart health triage assistant. What symptoms are you experiencing today?',
    },
  ]);

  const isLocal = userCategory === 'locals';
  const patientName = isLocal
    ? localData.fullName || 'Amina Salum Bakari'
    : intlData.fullName || 'Marcus Alexander Vance';

  const patientAge = isLocal ? localData.age || '29' : intlData.age || '34';
  const patientDob = isLocal
    ? formatDob(localData.birthYear, localData.birthMonth, localData.birthDay, language) || '12 Apr 1995'
    : formatDob(intlData.birthYear, intlData.birthMonth, intlData.birthDay, language) || '24 Aug 1990';
  const patientBloodType = (isLocal ? localData.bloodType : intlData.bloodType) || 'O+';
  const patientGender = isLocal ? localData.gender || 'female' : intlData.gender || 'male';
  const patientPhone = isLocal
    ? localData.phone ? `+255 ${localData.phone}` : '+255 754 829 140'
    : intlData.phone ? `${intlData.countryCode || '+1'} ${intlData.phone}` : '+1 791 112 3456';

  let primaryDocType = 'NIDA / NIN';
  let primaryDocNumber = localData.nidaNumber || '19950412111020000421';

  if (isLocal) {
    if (localData.selectedDocType === 'insurance') {
      primaryDocType = 'Bima ID';
      primaryDocNumber = localData.insuranceNumber || 'NHIF-TZ-8849201';
    } else if (localData.selectedDocType === 'birth_cert') {
      primaryDocType = 'RITA Cert';
      primaryDocNumber = localData.birthCertId || 'RITA-2018-938210';
    }
  } else {
    primaryDocType = 'Passport';
    primaryDocNumber = intlData.passportNumber || 'US89240182A';
  }

  const insuranceProviderName = isLocal
    ? (TANZANIA_INSURANCE_PROVIDERS.find((p) => p.id === localData.insuranceProvider)?.name || 'NHIF (Mfuko wa Taifa)')
    : 'Allianz Global Travel Health';

  const patientId = 'NC-TZ-8849201';
  const patientCountry = getPatientCountry(userCategory, localData, intlData);

  // Greeting based on real-time hour of day
  const hour = new Date().getHours();
  const greeting =
    hour < 12 ? t.greetingMorning[language] : hour < 17 ? t.greetingAfternoon[language] : t.greetingEvening[language];

  const handleSendAiMessage = () => {
    if (!aiMessage.trim()) return;
    const userMsg = aiMessage;
    setAiMessage('');
    setAiChatHistory((prev) => [...prev, { sender: 'user', text: userMsg }]);

    setTimeout(() => {
      let reply = '';
      if (language === 'sw') {
        reply = `Kulingana na maelezo yako ("${userMsg}"), inapendekezwa unywe maji mengi, upumzike, na upime joto. Ikiwa homa itaendelea zaidi ya saa 24, weka miadi na daktari kupitia kitufe cha "Weka Miadi" hapo juu.`;
      } else if (language === 'fr') {
        reply = `D'après vos symptômes ("${userMsg}"), il est conseillé de bien vous hydrater et de vous reposer. Si la fièvre persiste plus de 24h, veuillez consulter un médecin via l'onglet "Prendre RDV".`;
      } else {
        reply = `Based on your reported symptoms ("${userMsg}"), we recommend adequate hydration and rest. If symptoms persist beyond 24 hours, please book a clinical consultation with a physician.`;
      }
      setAiChatHistory((prev) => [...prev, { sender: 'ai', text: reply }]);
    }, 900);
  };

  return (
    <div id="patient-home-dashboard" className="space-y-4 animate-in fade-in slide-in-from-bottom-2 duration-300">
      {/* 1. Patient Profile Welcome Header */}
      <div
        className={`p-4 rounded-3xl border transition-all ${
          isDark
            ? 'bg-[#101F31] border-slate-700/90 text-white shadow-lg'
            : 'bg-white border-slate-200/90 text-slate-900 shadow-xs'
        }`}
      >
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            {/* Avatar with Online Pulse & Country Flag Overlay */}
            <div className="relative flex-shrink-0">
              <div
                className={`w-12 h-12 rounded-2xl flex items-center justify-center font-bold text-lg border-2 ${
                  isDark
                    ? 'bg-gradient-to-br from-cyan-500 to-blue-600 text-slate-950 border-cyan-400'
                    : 'bg-gradient-to-br from-[#0A4275] to-[#041D34] text-white border-blue-200'
                }`}
              >
                {patientName.charAt(0)}
              </div>
              <span className="absolute -top-1 -right-1 w-5 h-5 rounded-full bg-white dark:bg-slate-900 shadow-md border border-slate-200 dark:border-slate-700 flex items-center justify-center text-xs leading-none" title={`Country: ${patientCountry.name}`}>
                {patientCountry.flag}
              </span>
              <span className="absolute -bottom-0.5 -right-0.5 w-3 h-3 bg-emerald-500 border-2 border-white dark:border-slate-900 rounded-full" />
            </div>

            {/* Patient Name & Greeting */}
            <div>
              <div className="flex items-center gap-1.5">
                <span className={`text-xs font-semibold ${isDark ? 'text-cyan-300' : 'text-[#0A4275]'}`}>
                  {greeting} 👋
                </span>
              </div>
              <div className="flex items-center gap-2 flex-wrap">
                <h2 className="text-base sm:text-lg font-black tracking-tight leading-tight truncate max-w-[180px] sm:max-w-[260px]">
                  {patientName}
                </h2>
                <span
                  className={`inline-flex items-center gap-1 text-[11px] font-black px-2 py-0.5 rounded-full border shadow-xs ${
                    isDark
                      ? 'bg-slate-800/90 text-cyan-300 border-slate-700'
                      : 'bg-blue-50 text-[#0A4275] border-blue-200'
                  }`}
                  title={`Country / Citizenship: ${patientCountry.name}`}
                >
                  <span className="text-xs">{patientCountry.flag}</span>
                  <span>{patientCountry.code}</span>
                </span>
              </div>
              <p className="text-[11px] text-slate-500 dark:text-slate-400 font-medium flex items-center gap-1.5 mt-0.5">
                <span className="font-semibold text-slate-700 dark:text-slate-300">{patientCountry.name}</span>
                <span>•</span>
                <span className="font-mono">{primaryDocType}: {primaryDocNumber}</span>
              </p>
            </div>
          </div>

          {/* Quick Actions: Return / Switch Profile / Logout */}
          <div className="flex items-center gap-1.5">
            <button
              type="button"
              onClick={onLogout}
              className={`p-2 rounded-xl border flex items-center justify-center transition-all cursor-pointer ${
                isDark
                  ? 'bg-[#091422] border-slate-700 text-rose-400 hover:bg-rose-950/40 hover:text-rose-300 hover:border-rose-700'
                  : 'bg-slate-50 border-slate-200 text-rose-600 hover:bg-rose-50 hover:border-rose-200'
              }`}
              title={t.switchProfile[language]}
            >
              <LogOut className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>

      {/* Global Quick PDF Toast */}
      {pdfToast && (
        <div className="p-3.5 rounded-2xl bg-emerald-600 text-white text-xs font-bold flex items-center justify-between shadow-xl animate-in slide-in-from-top-2">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 flex-shrink-0" />
            <span>{pdfToast}</span>
          </div>
          <span className="text-[10px] font-mono bg-black/20 px-2 py-0.5 rounded">PDF Stored</span>
        </div>
      )}

      {/* 2. Interactive Digital Health Passport Card (NiaCare Pasipoti ya Afya) */}
      <div
        id="card-digital-health-passport"
        className="relative rounded-3xl overflow-hidden shadow-xl p-5 text-white bg-gradient-to-br from-[#062444] via-[#0A4275] to-[#041D34] border border-cyan-500/30"
      >
        {/* Holographic Watermark Pattern */}
        <div className="absolute -right-8 -bottom-8 w-44 h-44 bg-cyan-400/10 rounded-full blur-2xl pointer-events-none" />
        <div className="absolute right-4 top-4 opacity-15 pointer-events-none">
          <Shield className="w-24 h-24 text-white" />
        </div>

        {/* Card Top: Country Flag, Chip & Medical Crest */}
        <div className="flex items-center justify-between mb-4 relative z-10">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-xl bg-white/10 backdrop-blur-md border border-white/20 flex items-center justify-center text-cyan-300">
              <Shield className="w-4 h-4" />
            </div>
            <div>
              <span className="text-[10px] uppercase font-mono tracking-widest text-cyan-200 font-bold block">
                {patientCountry.headerTitle}
              </span>
              <h3 className="text-xs sm:text-sm font-black tracking-tight text-white flex items-center gap-1.5">
                <span>NIACARE HEALTH PASSPORT</span>
                <span className="text-base">{patientCountry.flag}</span>
              </h3>
            </div>
          </div>

          {/* Smart Chip Graphic & Flag Code */}
          <div className="flex items-center gap-2">
            <span className="text-[11px] font-mono font-black bg-white/15 px-2 py-1 rounded-lg border border-white/20 flex items-center gap-1 text-white shadow-xs">
              <span>{patientCountry.flag}</span>
              <span>{patientCountry.code}</span>
            </span>
            <div className="w-8 h-6 rounded-md bg-gradient-to-br from-amber-200 via-amber-400 to-amber-600 border border-amber-300/80 shadow-xs flex items-center justify-center">
              <div className="w-4 h-3 border border-amber-900/40 rounded-xs opacity-70" />
            </div>
          </div>
        </div>

        {/* Card Middle: Primary Patient Credentials */}
        <div className="space-y-3 mb-4 relative z-10">
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 text-xs">
            <div>
              <span className="text-[9px] uppercase tracking-wider text-cyan-200 font-bold block">
                {language === 'sw' ? 'JINA LA MGONJWA' : 'PATIENT NAME'}
              </span>
              <p className="font-extrabold text-sm text-white truncate">{patientName}</p>
            </div>
            <div>
              <span className="text-[9px] uppercase tracking-wider text-cyan-200 font-bold block">
                {language === 'sw' ? 'RAIA / NCHI' : 'CITIZENSHIP / COUNTRY'}
              </span>
              <p className="font-bold text-xs text-white truncate flex items-center gap-1">
                <span>{patientCountry.flag}</span>
                <span>{patientCountry.name}</span>
              </p>
            </div>
            <div className="col-span-2 sm:col-span-1">
              <span className="text-[9px] uppercase tracking-wider text-cyan-200 font-bold block">
                {primaryDocType}
              </span>
              <p className="font-mono font-bold text-xs text-white truncate">{primaryDocNumber}</p>
            </div>
          </div>

          <div className="grid grid-cols-3 gap-2 pt-1 border-t border-white/10 text-[11px]">
            <div>
              <span className="text-[9px] text-cyan-200 font-semibold block">DAMU (Blood)</span>
              <span className="font-mono font-extrabold text-amber-300 text-xs truncate block">
                {patientBloodType === 'unknown' ? (language === 'sw' ? 'Sina Uhakika' : 'Unknown') : `${patientBloodType} ${patientBloodType.endsWith('+') ? 'Pos' : patientBloodType.endsWith('-') ? 'Neg' : ''}`}
              </span>
            </div>
            <div>
              <span className="text-[9px] text-cyan-200 font-semibold block">KUZALIWA (DOB)</span>
              <span className="font-bold text-white text-xs truncate block" title={patientDob}>
                {patientDob} ({patientAge}y)
              </span>
            </div>
            <div>
              <span className="text-[9px] text-cyan-200 font-semibold block">STATUS</span>
              <span className="font-bold text-emerald-300 text-xs flex items-center gap-0.5">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                Active
              </span>
            </div>
          </div>
        </div>

        {/* Insurance Coverage Badge */}
        <div className="p-2.5 rounded-2xl bg-white/10 backdrop-blur-md border border-white/15 mb-4 flex items-center justify-between text-xs relative z-10">
          <div className="flex items-center gap-2">
            <Building2 className="w-4 h-4 text-cyan-300 flex-shrink-0" />
            <div className="truncate">
              <span className="text-[9px] text-cyan-200 block font-semibold leading-none">
                {t.insuranceCoverage[language]}
              </span>
              <span className="font-bold text-[11px] text-white truncate block">
                {insuranceProviderName}
              </span>
            </div>
          </div>
          <span className="text-[9px] font-extrabold bg-emerald-500/90 text-white px-2 py-0.5 rounded-full uppercase tracking-wider flex-shrink-0">
            {t.activeInsuranceBadge[language]}
          </span>
        </div>

        {/* Card Action Buttons: Show QR Code Check-in & Download Official PDF */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 relative z-10">
          <button
            id="btn-show-qr-passport"
            type="button"
            onClick={() => setActiveModal('qr')}
            className="w-full py-2.5 px-4 rounded-xl bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-black text-xs flex items-center justify-center gap-2 shadow-md cursor-pointer transition-all active:scale-98"
          >
            <QrCode className="w-4 h-4" />
            <span>{t.viewQr[language]} (Check-in)</span>
          </button>

          <button
            id="btn-download-passport-pdf"
            type="button"
            onClick={handleDirectPassportPdfDownload}
            className="w-full py-2.5 px-4 rounded-xl bg-white/15 hover:bg-white/25 text-white border border-white/20 font-black text-xs flex items-center justify-center gap-2 backdrop-blur-md shadow-md cursor-pointer transition-all active:scale-98"
          >
            <FileDown className="w-4 h-4 text-cyan-300" />
            <span>{language === 'sw' ? 'Pakua Pasipoti (PDF)' : 'Download Passport (PDF)'}</span>
          </button>
        </div>
      </div>

      {/* 2. UPCOMING HOSPITAL APPOINTMENT CARD (Positioned right below profile) */}
      {(() => {
        const activeAppointment = appointmentsList.find((a) => a.status !== 'cancelled');
        return (
          <div
            className={`p-4 rounded-3xl border shadow-sm ${
              isDark ? 'bg-[#101F31] border-slate-700/80' : 'bg-white border-slate-200/90'
            }`}
          >
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <Clock className={`w-4 h-4 ${isDark ? 'text-cyan-400' : 'text-[#0A4275]'}`} />
                <h3 className={`text-xs sm:text-sm font-black ${isDark ? 'text-white' : 'text-slate-900'}`}>
                  {t.upcomingTitle[language]}
                </h3>
              </div>
              {activeAppointment ? (
                <span className="text-[10px] font-bold text-cyan-600 dark:text-cyan-400 bg-cyan-50 dark:bg-cyan-950/60 px-2 py-0.5 rounded-full border border-cyan-200 dark:border-cyan-800">
                  {activeAppointment.date} • {activeAppointment.timeSlot}
                </span>
              ) : (
                <span className="text-[10px] font-bold text-slate-400 bg-slate-100 dark:bg-slate-800 px-2 py-0.5 rounded-full">
                  {language === 'sw' ? 'Hakuna Miadi Iliyopangwa' : 'No Scheduled Visits'}
                </span>
              )}
            </div>

            {activeAppointment ? (
              <div
                className={`p-3.5 rounded-2xl border flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 ${
                  isDark ? 'bg-[#091422] border-slate-800' : 'bg-[#F9FBFE] border-slate-100'
                }`}
              >
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-blue-500/15 text-blue-600 dark:text-cyan-400 flex items-center justify-center font-bold flex-shrink-0">
                    <Stethoscope className="w-5 h-5" />
                  </div>
                  <div>
                    <div className="flex items-center gap-1.5">
                      <h4 className="text-xs font-black text-slate-900 dark:text-white">
                        {activeAppointment.doctorName}
                      </h4>
                      <span className="text-[10px] font-bold font-mono px-1.5 py-0.2 bg-emerald-500/20 text-emerald-400 rounded">
                        {activeAppointment.queueNumber || 'Confirmed'}
                      </span>
                    </div>
                    <p className="text-[11px] text-slate-500 dark:text-slate-400">
                      {activeAppointment.doctorSpecialty} • {activeAppointment.hospitalName}
                    </p>
                    <div className="flex flex-wrap items-center gap-2 mt-1">
                      <span className="text-[10px] font-mono font-bold text-slate-600 dark:text-slate-300 bg-slate-200/60 dark:bg-slate-800 px-2 py-0.5 rounded">
                        {activeAppointment.roomNumber}
                      </span>
                      <span className="text-[10px] text-emerald-600 dark:text-emerald-400 font-bold">
                        {activeAppointment.insuranceCovered
                          ? language === 'sw'
                            ? 'Bima Imeidhinishwa ✓'
                            : 'Insurance Approved ✓'
                          : language === 'sw'
                          ? 'Malipo Yamethibitishwa'
                          : 'Payment Confirmed'}
                      </span>
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-2 w-full sm:w-auto">
                  <button
                    type="button"
                    onClick={() => setActiveModal('appointment')}
                    className="w-full sm:w-auto px-3 py-2 rounded-xl text-xs font-bold bg-[#0A4275] dark:bg-cyan-500 text-white dark:text-slate-950 hover:opacity-90 cursor-pointer transition-all flex items-center justify-center gap-1 shadow-sm"
                  >
                    <span>
                      {activeAppointment.consultationType === 'telehealth'
                        ? language === 'sw'
                          ? 'Tazama / Video'
                          : 'View / Video'
                        : language === 'sw'
                        ? 'Kadi ya Foleni & QR'
                        : 'Queue Pass & QR'}
                    </span>
                    <ChevronRight className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            ) : (
              <div
                className={`p-3.5 rounded-2xl border flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 ${
                  isDark ? 'bg-[#091422] border-slate-800' : 'bg-[#F9FBFE] border-slate-100'
                }`}
              >
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  {language === 'sw'
                    ? 'Huna miadi iliyopangwa kwa sasa. Unaweza kuweka miadi na daktari bingwa sasa.'
                    : 'No scheduled appointment right now. You can book an appointment with a specialist.'}
                </p>
                <button
                  type="button"
                  onClick={() => setActiveModal('appointment')}
                  className="px-3 py-2 rounded-xl text-xs font-bold bg-cyan-500 text-slate-950 hover:bg-cyan-400 cursor-pointer transition-all flex items-center gap-1 flex-shrink-0 shadow-sm"
                >
                  <CalendarCheck className="w-3.5 h-3.5" />
                  <span>{language === 'sw' ? 'Weka Miadi' : 'Book Appointment'}</span>
                </button>
              </div>
            )}
          </div>
        );
      })()}

      {/* 3. Active Prescription Banner with 1-Tap Pill Checkoff */}
      <div
        className={`p-3.5 rounded-2xl border flex items-center justify-between gap-3 transition-all ${
          pillTaken
            ? isDark
              ? 'bg-emerald-950/40 border-emerald-800 text-emerald-200'
              : 'bg-emerald-50 border-emerald-200 text-emerald-800'
            : isDark
            ? 'bg-amber-950/40 border-amber-800/80 text-amber-200'
            : 'bg-amber-50 border-amber-200 text-amber-900'
        }`}
      >
        <div className="flex items-center gap-2.5 min-w-0">
          <div
            className={`w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0 ${
              pillTaken
                ? 'bg-emerald-500 text-white'
                : isDark
                ? 'bg-amber-500/20 text-amber-400'
                : 'bg-amber-100 text-amber-700'
            }`}
          >
            {pillTaken ? <Check className="w-5 h-5" /> : <Pill className="w-5 h-5" />}
          </div>
          <div className="min-w-0">
            <span className="text-[10px] font-bold uppercase tracking-wider block opacity-80">
              {pillTaken ? 'Dawa Imeshanywewa Leo' : 'Kumbusho la Dawa (14:00)'}
            </span>
            <p className="text-xs font-bold truncate">
              {pillTaken
                ? 'Amoxicillin 500mg - Imethibitishwa'
                : 'Amoxicillin 500mg (Kidonge 1 baada ya chakula)'}
            </p>
          </div>
        </div>

        <button
          type="button"
          onClick={() => setPillTaken(!pillTaken)}
          className={`px-3 py-1.5 rounded-xl text-xs font-extrabold flex-shrink-0 transition-all cursor-pointer shadow-xs ${
            pillTaken
              ? isDark
                ? 'bg-slate-800 text-slate-300 hover:bg-slate-700'
                : 'bg-white text-slate-700 hover:bg-slate-100'
              : isDark
              ? 'bg-amber-500 text-slate-950 hover:bg-amber-400'
              : 'bg-amber-600 text-white hover:bg-amber-700'
          }`}
        >
          {pillTaken ? 'Badili' : t.takePillNow[language]}
        </button>
      </div>



      {/* Appointment Toast Notification if triggered */}
      {appointmentToast && (
        <div className="p-3.5 rounded-2xl bg-gradient-to-r from-emerald-600 to-teal-700 text-white font-bold text-xs flex items-center justify-between shadow-lg animate-in slide-in-from-top duration-300">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-200" />
            <span>{appointmentToast}</span>
          </div>
          <button
            type="button"
            onClick={() => setActiveModal('appointment')}
            className="px-2 py-1 rounded bg-black/20 hover:bg-black/30 text-[11px] font-black underline cursor-pointer"
          >
            Tazama Tiketi
          </button>
        </div>
      )}

      {/* Prominent Quick Doctor Appointment Banner */}
      <div
        className={`p-4 rounded-3xl border relative overflow-hidden transition-all ${
          isDark
            ? 'bg-gradient-to-r from-[#0C2340] via-[#0E2C52] to-[#123966] border-cyan-500/40 text-white shadow-xl'
            : 'bg-gradient-to-r from-[#0A4275] via-[#0F5A9E] to-[#186EBA] border-blue-300 text-white shadow-md'
        }`}
      >
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 relative z-10">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <span className="px-2 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider bg-cyan-400 text-slate-950">
                1-TAP BOOKING
              </span>
              <span className="text-[11px] text-cyan-200 font-semibold">
                Madaktari Bingwa 500+ nchini
              </span>
            </div>
            <h3 className="text-sm sm:text-base font-black tracking-tight">
              {language === 'sw'
                ? 'Weka Miadi ya Daktari & Hospitali (Referral & Video)'
                : language === 'fr'
                ? 'Prendre Rendez-vous Médical (Hôpital & Vidéo)'
                : 'Book Doctor & Hospital Consultation (In-Person / Video)'}
            </h3>
            <p className="text-[11px] text-cyan-100/80">
              Muhimbili (MNH), Aga Khan, KCMC Moshi, Bugando Mwanza • Bima ya NHIF / Direct Pay
            </p>
          </div>

          <button
            id="btn-quick-banner-book"
            type="button"
            onClick={() => setActiveModal('appointment')}
            className="w-full sm:w-auto px-4 py-2.5 rounded-2xl bg-cyan-400 hover:bg-cyan-300 text-slate-950 font-black text-xs flex items-center justify-center gap-1.5 shadow-lg cursor-pointer transition-all active:scale-95 flex-shrink-0"
          >
            <CalendarCheck className="w-4 h-4" />
            <span>{language === 'sw' ? 'Weka Miadi Sasa' : 'Book Appointment'}</span>
            <ChevronRight className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* 5. 6-Action Quick Health Services Grid */}
      <div
        className={`p-4 rounded-3xl border ${
          isDark ? 'bg-[#101F31] border-slate-700/80' : 'bg-white border-slate-200/90'
        }`}
      >
        <div className="flex items-center justify-between mb-3">
          <h3 className={`text-xs sm:text-sm font-black ${isDark ? 'text-white' : 'text-slate-900'}`}>
            {t.quickActions[language]}
          </h3>
          <span className="text-[10px] text-slate-400 font-medium">NiaCare Digital Hub</span>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
          {/* Action 1: Book Appointment */}
          <button
            id="hub-btn-appointment"
            type="button"
            onClick={() => setActiveModal('appointment')}
            className={`p-3 rounded-2xl border text-left flex flex-col justify-between transition-all cursor-pointer group active:scale-98 ${
              isDark
                ? 'bg-[#091422] border-slate-800 hover:border-cyan-500 hover:bg-[#0c1a2d]'
                : 'bg-[#F9FBFE] border-slate-200/80 hover:border-[#0A4275] hover:bg-blue-50/50'
            }`}
          >
            <div className="w-9 h-9 rounded-xl bg-blue-500/15 text-blue-600 dark:text-cyan-400 flex items-center justify-center mb-2 group-hover:scale-110 transition-transform">
              <Calendar className="w-5 h-5" />
            </div>
            <div>
              <h4 className="text-xs font-black text-slate-900 dark:text-white leading-tight">
                {t.bookAppointment[language]}
              </h4>
              <p className="text-[10px] text-slate-500 dark:text-slate-400 mt-0.5 leading-tight">
                {t.bookAppointmentSub[language]}
              </p>
            </div>
          </button>

          {/* Action 2: Malipo & Checkout Procedures (Insurance vs Cash) */}
          <button
            id="hub-btn-checkout"
            type="button"
            onClick={() => setActiveModal('checkout')}
            className={`p-3 rounded-2xl border text-left flex flex-col justify-between transition-all cursor-pointer group active:scale-98 ${
              isDark
                ? 'bg-gradient-to-br from-[#0c261e] to-[#091422] border-emerald-500/60 hover:border-emerald-400 hover:bg-[#0f2e24]'
                : 'bg-gradient-to-br from-emerald-50/80 to-blue-50/60 border-emerald-500/60 hover:border-emerald-600 hover:bg-emerald-100/50'
            }`}
          >
            <div className="w-9 h-9 rounded-xl bg-emerald-500/20 text-emerald-600 dark:text-emerald-400 flex items-center justify-center mb-2 group-hover:scale-110 transition-transform shadow-xs">
              <Banknote className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-1">
                <h4 className="text-xs font-black text-slate-900 dark:text-white leading-tight">
                  {t.checkoutBilling[language]}
                </h4>
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
              </div>
              <p className="text-[10px] text-emerald-600 dark:text-emerald-400 font-bold mt-0.5 leading-tight">
                {t.checkoutBillingSub[language]}
              </p>
            </div>
          </button>

          {/* Action 3: Prescriptions */}
          <button
            id="hub-btn-prescriptions"
            type="button"
            onClick={() => setActiveModal('prescriptions')}
            className={`p-3 rounded-2xl border text-left flex flex-col justify-between transition-all cursor-pointer group active:scale-98 ${
              isDark
                ? 'bg-[#091422] border-slate-800 hover:border-cyan-500 hover:bg-[#0c1a2d]'
                : 'bg-[#F9FBFE] border-slate-200/80 hover:border-[#0A4275] hover:bg-blue-50/50'
            }`}
          >
            <div className="w-9 h-9 rounded-xl bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 flex items-center justify-center mb-2 group-hover:scale-110 transition-transform">
              <Pill className="w-5 h-5" />
            </div>
            <div>
              <h4 className="text-xs font-black text-slate-900 dark:text-white leading-tight">
                {t.prescriptions[language]}
              </h4>
              <p className="text-[10px] text-slate-500 dark:text-slate-400 mt-0.5 leading-tight">
                {t.prescriptionsSub[language]}
              </p>
            </div>
          </button>

          {/* Action 4: Lab Results & Records */}
          <button
            id="hub-btn-lab-records"
            type="button"
            onClick={() => setActiveModal('records')}
            className={`p-3 rounded-2xl border text-left flex flex-col justify-between transition-all cursor-pointer group active:scale-98 ${
              isDark
                ? 'bg-[#091422] border-slate-800 hover:border-cyan-500 hover:bg-[#0c1a2d]'
                : 'bg-[#F9FBFE] border-slate-200/80 hover:border-[#0A4275] hover:bg-blue-50/50'
            }`}
          >
            <div className="w-9 h-9 rounded-xl bg-purple-500/15 text-purple-600 dark:text-purple-400 flex items-center justify-center mb-2 group-hover:scale-110 transition-transform">
              <FileText className="w-5 h-5" />
            </div>
            <div>
              <h4 className="text-xs font-black text-slate-900 dark:text-white leading-tight">
                {t.labResults[language]}
              </h4>
              <p className="text-[10px] text-slate-500 dark:text-slate-400 mt-0.5 leading-tight">
                {t.labResultsSub[language]}
              </p>
            </div>
          </button>

          {/* Action 5: Personal Files Vault (Faili Zangu) */}
          <button
            id="hub-btn-personal-files"
            type="button"
            onClick={() => setActiveModal('personal_files')}
            className={`p-3 rounded-2xl border text-left flex flex-col justify-between transition-all cursor-pointer group active:scale-98 ${
              isDark
                ? 'bg-[#091422] border-slate-800 hover:border-cyan-500 hover:bg-[#0c1a2d]'
                : 'bg-[#F9FBFE] border-slate-200/80 hover:border-[#0A4275] hover:bg-blue-50/50'
            }`}
          >
            <div className="w-9 h-9 rounded-xl bg-cyan-500/15 text-cyan-600 dark:text-cyan-400 flex items-center justify-center mb-2 group-hover:scale-110 transition-transform">
              <FolderLock className="w-5 h-5" />
            </div>
            <div>
              <h4 className="text-xs font-black text-slate-900 dark:text-white leading-tight">
                {t.personalFiles[language]}
              </h4>
              <p className="text-[10px] text-slate-500 dark:text-slate-400 mt-0.5 leading-tight">
                {t.personalFilesSub[language]}
              </p>
            </div>
          </button>

          {/* Action 6: Insurance & Claims */}
          <button
            id="hub-btn-insurance"
            type="button"
            onClick={() => setActiveModal('insurance')}
            className={`p-3 rounded-2xl border text-left flex flex-col justify-between transition-all cursor-pointer group active:scale-98 ${
              isDark
                ? 'bg-[#091422] border-slate-800 hover:border-cyan-500 hover:bg-[#0c1a2d]'
                : 'bg-[#F9FBFE] border-slate-200/80 hover:border-[#0A4275] hover:bg-blue-50/50'
            }`}
          >
            <div className="w-9 h-9 rounded-xl bg-amber-500/15 text-amber-600 dark:text-amber-400 flex items-center justify-center mb-2 group-hover:scale-110 transition-transform">
              <CreditCard className="w-5 h-5" />
            </div>
            <div>
              <h4 className="text-xs font-black text-slate-900 dark:text-white leading-tight">
                {t.insuranceCoverage[language]}
              </h4>
              <p className="text-[10px] text-slate-500 dark:text-slate-400 mt-0.5 leading-tight">
                {t.insuranceCoverageSub[language]}
              </p>
            </div>
          </button>

          {/* Action 7: Nearby Hospitals & Pharmacies */}
          <button
            id="hub-btn-facilities"
            type="button"
            onClick={() => setActiveModal('facilities')}
            className={`p-3 rounded-2xl border text-left flex flex-col justify-between transition-all cursor-pointer group active:scale-98 ${
              isDark
                ? 'bg-[#091422] border-slate-800 hover:border-cyan-500 hover:bg-[#0c1a2d]'
                : 'bg-[#F9FBFE] border-slate-200/80 hover:border-[#0A4275] hover:bg-blue-50/50'
            }`}
          >
            <div className="w-9 h-9 rounded-xl bg-rose-500/15 text-rose-600 dark:text-rose-400 flex items-center justify-center mb-2 group-hover:scale-110 transition-transform">
              <MapPin className="w-5 h-5" />
            </div>
            <div>
              <h4 className="text-xs font-black text-slate-900 dark:text-white leading-tight">
                {t.findFacility[language]}
              </h4>
              <p className="text-[10px] text-slate-500 dark:text-slate-400 mt-0.5 leading-tight">
                {t.findFacilitySub[language]}
              </p>
            </div>
          </button>

          {/* Action 8: NiaAI Health Triage */}
          <button
            id="hub-btn-ai-triage"
            type="button"
            onClick={() => setActiveModal('ai')}
            className={`p-3 rounded-2xl border text-left flex flex-col justify-between transition-all cursor-pointer group active:scale-98 sm:col-span-2 ${
              isDark
                ? 'bg-[#091422] border-slate-800 hover:border-cyan-500 hover:bg-[#0c1a2d]'
                : 'bg-[#F9FBFE] border-slate-200/80 hover:border-[#0A4275] hover:bg-blue-50/50'
            }`}
          >
            <div className="flex items-center gap-2">
              <div className="w-9 h-9 rounded-xl bg-cyan-500/20 text-cyan-600 dark:text-cyan-300 flex items-center justify-center group-hover:scale-110 transition-transform flex-shrink-0">
                <Stethoscope className="w-5 h-5" />
              </div>
              <div>
                <h4 className="text-xs font-black text-slate-900 dark:text-white leading-tight flex items-center gap-1">
                  <span>{t.aiConsult[language]}</span>
                  <Sparkles className="w-3 h-3 text-cyan-500" />
                </h4>
                <p className="text-[10px] text-slate-500 dark:text-slate-400 mt-0.5 leading-tight">
                  {t.aiConsultSub[language]}
                </p>
              </div>
            </div>
          </button>
        </div>
      </div>

      {/* 5. Medical Records & Clinical Encounters Section */}
      <div
        className={`p-4 rounded-3xl border shadow-sm ${
          isDark ? 'bg-[#101F31] border-slate-700/80' : 'bg-white border-slate-200/90'
        }`}
      >
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <FileText className="w-4 h-4 text-purple-500" />
            <h3 className={`text-xs sm:text-sm font-black ${isDark ? 'text-white' : 'text-slate-900'}`}>
              {language === 'sw' ? 'Rekodi za Matibabu & Majibu ya Vipimo' : 'Medical Records & Diagnostic History'}
            </h3>
          </div>
          <button
            id="btn-view-all-records"
            type="button"
            onClick={() => setActiveModal('records')}
            className="text-[11px] font-bold text-purple-600 dark:text-purple-400 hover:underline cursor-pointer flex items-center gap-1"
          >
            <span>{language === 'sw' ? 'Fungua Zote (5)' : 'View All (5)'}</span>
            <ChevronRight className="w-3 h-3" />
          </button>
        </div>

        <div className="space-y-2.5">
          {/* Quick preview of top 3 records */}
          {INITIAL_MEDICAL_RECORDS.slice(0, 3).map((rec) => (
            <div
              key={rec.id}
              onClick={() => setActiveModal('records')}
              className={`p-3 rounded-2xl border flex items-center justify-between text-xs cursor-pointer transition-all hover:scale-[1.005] ${
                isDark
                  ? 'bg-[#091422] border-slate-800/80 hover:border-purple-500/60'
                  : 'bg-slate-50/80 border-slate-200/70 hover:border-purple-300'
              }`}
            >
              <div className="flex items-center gap-2.5 min-w-0">
                <div
                  className={`w-2.5 h-2.5 rounded-full flex-shrink-0 ${
                    rec.category === 'lab'
                      ? 'bg-purple-500'
                      : rec.category === 'radiology'
                      ? 'bg-blue-500'
                      : rec.category === 'vaccine'
                      ? 'bg-amber-500'
                      : 'bg-emerald-500'
                  }`}
                />
                <div className="min-w-0">
                  <h5 className="font-bold text-slate-900 dark:text-white text-xs truncate">
                    {rec.title}
                  </h5>
                  <p className="text-[10px] text-slate-500 dark:text-slate-400 truncate">
                    {rec.hospitalName} • {rec.date}
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2 flex-shrink-0 ml-2">
                <button
                  type="button"
                  onClick={(e) => handleQuickRecordDownload(rec, e)}
                  className="p-1.5 rounded-lg bg-purple-500/15 text-purple-600 dark:text-purple-300 hover:bg-purple-500/25 transition-colors"
                  title="Download PDF"
                >
                  <Download className="w-3.5 h-3.5" />
                </button>
                <span className="text-[10px] font-bold font-mono px-2 py-0.5 rounded bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300">
                  {rec.status === 'verified' ? 'Verified' : 'Clear'}
                </span>
                <ChevronRight className="w-3.5 h-3.5 text-slate-400" />
              </div>
            </div>
          ))}
        </div>

        {/* Big Check Medical Records CTA Button */}
        <div className="mt-3 pt-3 border-t border-slate-200 dark:border-slate-800">
          <button
            id="btn-open-medical-records-modal"
            type="button"
            onClick={() => setActiveModal('records')}
            className="w-full py-2.5 px-4 rounded-xl bg-purple-600 hover:bg-purple-500 text-white font-black text-xs flex items-center justify-center gap-2 shadow-sm cursor-pointer transition-all active:scale-98"
          >
            <FileText className="w-4 h-4" />
            <span>
              {language === 'sw'
                ? 'Kagua Rekodi na Majibu Yote ya Maabara'
                : 'Check All Medical & Diagnostic Records'}
            </span>
          </button>
        </div>
      </div>

      {/* ========================================================================= */}
      {/* SUB-MODALS FOR DASHBOARD QUICK ACTIONS */}
      {/* ========================================================================= */}

      {/* MODAL 1: FULLSCREEN QR CODE PASSPORT SCANNER */}
      {activeModal === 'qr' && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-xs animate-in fade-in">
          <div
            className={`w-full max-w-sm rounded-3xl p-6 border text-center relative ${
              isDark ? 'bg-[#0E1B2C] border-slate-700 text-white' : 'bg-white border-slate-200 text-slate-900'
            }`}
          >
            <button
              type="button"
              onClick={() => setActiveModal(null)}
              className="absolute top-4 right-4 p-2 rounded-full hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-400 hover:text-slate-700 dark:hover:text-white cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>

            <div className="w-12 h-12 rounded-2xl bg-cyan-500/20 text-cyan-400 mx-auto flex items-center justify-center mb-3">
              <QrCode className="w-6 h-6" />
            </div>

            <h3 className="text-base font-black tracking-tight mb-1">NiaCare Hospital QR Check-in</h3>
            <p className="text-xs text-slate-500 dark:text-slate-400 mb-4">
              Onyesha msimbo huu kwenye kaunta ya mapokezi ya hospitali yoyote iliyosajiliwa.
            </p>

            {/* Generated High-Res Visual QR Block */}
            <div className="bg-white p-4 rounded-2xl shadow-inner inline-block border-2 border-dashed border-cyan-400 mb-4">
              <img
                src={`https://api.qrserver.com/v1/create-qr-code/?size=180x180&data=NIACARE_PATIENT_${patientId}_${primaryDocNumber}`}
                alt="Patient QR Code"
                className="w-44 h-44 mx-auto rounded-lg"
                referrerPolicy="no-referrer"
              />
              <span className="font-mono font-bold text-xs text-slate-800 mt-2 block tracking-widest">
                {patientId}
              </span>
            </div>

            <div className="space-y-2">
              <button
                type="button"
                onClick={() => setActiveModal(null)}
                className="w-full py-3 rounded-xl bg-[#0A4275] dark:bg-cyan-500 text-white dark:text-slate-950 font-bold text-xs cursor-pointer shadow-md"
              >
                Imekamilika / Funga
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL 2: COMPREHENSIVE DOCTOR & HOSPITAL APPOINTMENT BOOKING */}
      <AppointmentBookingModal
        isOpen={activeModal === 'appointment'}
        onClose={() => setActiveModal(null)}
        language={language}
        theme={theme}
        userCategory={userCategory}
        localData={localData}
        intlData={intlData}
        appointmentsList={appointmentsList}
        setAppointmentsList={setAppointmentsList}
        onAppointmentBooked={(newApt) => {
          setAppointmentToast(`Miadi imepangwa: ${newApt.doctorName} (${newApt.timeSlot})`);
          setTimeout(() => setAppointmentToast(null), 4000);
        }}
      />

      {/* MODAL 4: PRESCRIPTIONS & REFILLS */}
      {activeModal === 'prescriptions' && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-xs animate-in fade-in">
          <div
            className={`w-full max-w-md rounded-3xl p-5 sm:p-6 border relative max-h-[90vh] overflow-y-auto ${
              isDark ? 'bg-[#0E1B2C] border-slate-700 text-white' : 'bg-white border-slate-200 text-slate-900'
            }`}
          >
            <button
              type="button"
              onClick={() => setActiveModal(null)}
              className="absolute top-4 right-4 p-2 rounded-full hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-400 hover:text-slate-700 dark:hover:text-white cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>

            <div className="flex items-center gap-2 mb-3">
              <Pill className="w-5 h-5 text-emerald-500" />
              <h3 className="text-base font-black">Dawa Zangu & Kumbusho</h3>
            </div>

            <div className="space-y-3">
              {/* Pill 1 */}
              <div
                className={`p-3 rounded-2xl border ${
                  isDark ? 'bg-slate-900 border-slate-800' : 'bg-slate-50 border-slate-200'
                }`}
              >
                <div className="flex items-center justify-between mb-1">
                  <h4 className="font-bold text-xs text-slate-900 dark:text-white">Amoxicillin 500mg</h4>
                  <span className="text-[10px] font-bold text-amber-500 bg-amber-50 dark:bg-amber-950 px-2 py-0.5 rounded">
                    Zimebaki Siku 3
                  </span>
                </div>
                <p className="text-[11px] text-slate-500 dark:text-slate-400">
                  Matumizi: Vidonge 3 kwa siku (kila baada ya saa 8) baada ya chakula.
                </p>
                <div className="mt-2 flex items-center justify-between text-[10px]">
                  <span className="text-slate-400">Imeandikwa na: Dr. M. Kitundu</span>
                  <button
                    type="button"
                    onClick={() => {
                      setRefillRequested(true);
                      setTimeout(() => setRefillRequested(false), 3000);
                    }}
                    className="font-bold text-emerald-600 dark:text-emerald-400 hover:underline cursor-pointer"
                  >
                    {refillRequested ? 'Maombi Yametumwa ✓' : 'Agiza Tena (Refill)'}
                  </button>
                </div>
              </div>

              {/* Pill 2 */}
              <div
                className={`p-3 rounded-2xl border ${
                  isDark ? 'bg-slate-900 border-slate-800' : 'bg-slate-50 border-slate-200'
                }`}
              >
                <div className="flex items-center justify-between mb-1">
                  <h4 className="font-bold text-xs text-slate-900 dark:text-white">Paracetamol 500mg</h4>
                  <span className="text-[10px] font-bold text-emerald-500 bg-emerald-50 dark:bg-emerald-950 px-2 py-0.5 rounded">
                    Inahitajika tu (SOS)
                  </span>
                </div>
                <p className="text-[11px] text-slate-500 dark:text-slate-400">
                  Matumizi: Vidonge 2 ikiwa maumivu ya kichwa yatajitokeza.
                </p>
              </div>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setActiveModal('checkout')}
                  className="flex-1 py-3 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-black text-xs cursor-pointer flex items-center justify-center gap-1.5 shadow-md"
                >
                  <Banknote className="w-4 h-4" />
                  <span>Lipa Dawa / Checkout</span>
                </button>
                <button
                  type="button"
                  onClick={() => setActiveModal(null)}
                  className="px-4 py-3 rounded-xl bg-slate-200 dark:bg-slate-800 hover:bg-slate-300 dark:hover:bg-slate-700 text-slate-800 dark:text-slate-200 font-bold text-xs cursor-pointer"
                >
                  Funga
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* MODAL 5: MEDICAL RECORDS & LAB REPORTS MODAL */}
      <MedicalRecordsModal
        isOpen={activeModal === 'records' || activeModal === 'personal_files'}
        onClose={() => setActiveModal(null)}
        language={language}
        theme={theme}
        patientName={patientName}
        patientId={patientId}
        patientDob={isLocal ? formatDob(localData.dob) || '12 Apr 1995' : intlData.dob || '12 Apr 1995'}
        patientBloodType={isLocal ? localData.bloodGroup || 'O+' : intlData.bloodGroup || 'O+'}
        patientPhone={isLocal ? localData.phone || '+255 754 829 140' : intlData.phone || '+1 415 892 0192'}
        patientInsurance={insuranceProviderName}
        patientDocType={isLocal ? localData.docType || 'NIDA / NIN' : 'International Passport'}
        patientDocNumber={isLocal ? localData.docNumber || '19950412111020000421' : intlData.passportNumber || 'A29381944'}
        initialTab={activeModal === 'personal_files' ? 'personal_files' : 'records'}
      />

      {/* MODAL 6: INSURANCE & CLAIMS */}
      {activeModal === 'insurance' && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-xs animate-in fade-in">
          <div
            className={`w-full max-w-md rounded-3xl p-5 sm:p-6 border relative max-h-[90vh] overflow-y-auto ${
              isDark ? 'bg-[#0E1B2C] border-slate-700 text-white' : 'bg-white border-slate-200 text-slate-900'
            }`}
          >
            <button
              type="button"
              onClick={() => setActiveModal(null)}
              className="absolute top-4 right-4 p-2 rounded-full hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-400 hover:text-slate-700 dark:hover:text-white cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>

            <div className="flex items-center gap-2 mb-3">
              <CreditCard className="w-5 h-5 text-amber-500" />
              <h3 className="text-base font-black">Hali ya Bima & Madai (Coverage)</h3>
            </div>

            <div className="space-y-3 text-xs">
              <div className="p-4 rounded-2xl bg-gradient-to-r from-blue-900 to-[#0A4275] text-white">
                <span className="text-[10px] text-cyan-200 uppercase font-bold block">MPANGO WA BIMA</span>
                <h4 className="text-sm font-extrabold">{insuranceProviderName}</h4>
                <div className="mt-3 flex items-center justify-between text-[11px] pt-2 border-t border-white/20">
                  <span>Hali: Inatumika (Active)</span>
                  <span className="font-mono">Kikomo: TZS 10,000,000/Yr</span>
                </div>
              </div>

              <div className="space-y-2">
                <h5 className="font-bold text-xs">Madai ya Hivi Karibuni:</h5>
                <div className="p-2.5 rounded-xl border border-slate-200 dark:border-slate-800 flex items-center justify-between">
                  <div>
                    <span className="font-bold block">Aga Khan Hospital Consultation</span>
                    <span className="text-[10px] text-slate-400">12 Agosti 2026</span>
                  </div>
                  <span className="font-mono font-bold text-emerald-600 dark:text-emerald-400">
                    TZS 45,000 (Imelipwa)
                  </span>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setActiveModal('checkout')}
                  className="flex-1 py-3 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-black text-xs cursor-pointer flex items-center justify-center gap-1.5 shadow-md"
                >
                  <Banknote className="w-4 h-4" />
                  <span>Taratibu za Malipo (Checkout)</span>
                </button>
                <button
                  type="button"
                  onClick={() => setActiveModal(null)}
                  className="px-4 py-3 rounded-xl bg-slate-200 dark:bg-slate-800 hover:bg-slate-300 dark:hover:bg-slate-700 text-slate-800 dark:text-slate-200 font-bold text-xs cursor-pointer"
                >
                  Funga
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* MODAL 7: NEARBY HOSPITALS MAP / DIRECTORY */}
      {activeModal === 'facilities' && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-xs animate-in fade-in">
          <div
            className={`w-full max-w-md rounded-3xl p-5 sm:p-6 border relative max-h-[90vh] overflow-y-auto ${
              isDark ? 'bg-[#0E1B2C] border-slate-700 text-white' : 'bg-white border-slate-200 text-slate-900'
            }`}
          >
            <button
              type="button"
              onClick={() => setActiveModal(null)}
              className="absolute top-4 right-4 p-2 rounded-full hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-400 hover:text-slate-700 dark:hover:text-white cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>

            <div className="flex items-center gap-2 mb-3">
              <MapPin className="w-5 h-5 text-rose-500" />
              <h3 className="text-base font-black">Hospitali & Vituo vya Afya vya Karibu</h3>
            </div>

            <div className="space-y-2.5 text-xs">
              {/* Facility 1 */}
              <div
                className={`p-3 rounded-2xl border flex items-center justify-between ${
                  isDark ? 'bg-slate-900 border-slate-800' : 'bg-slate-50 border-slate-200'
                }`}
              >
                <div>
                  <h4 className="font-bold text-slate-900 dark:text-white">Muhimbili National Hospital (MNH)</h4>
                  <p className="text-[10px] text-slate-400">Upanga, Dar es Salaam • Umbali: 1.8 km</p>
                  <span className="text-[9px] font-bold text-emerald-500">Inapokea Bima zote • 24/7 ICU</span>
                </div>
                <a
                  href="tel:112"
                  className="px-3 py-1.5 rounded-xl bg-rose-600 text-white font-bold text-[11px] flex items-center gap-1 cursor-pointer"
                >
                  <Phone className="w-3 h-3" />
                  <span>Piga</span>
                </a>
              </div>

              {/* Facility 2 */}
              <div
                className={`p-3 rounded-2xl border flex items-center justify-between ${
                  isDark ? 'bg-slate-900 border-slate-800' : 'bg-slate-50 border-slate-200'
                }`}
              >
                <div>
                  <h4 className="font-bold text-slate-900 dark:text-white">The Aga Khan Hospital</h4>
                  <p className="text-[10px] text-slate-400">Ocean Road, Dar es Salaam • Umbali: 2.4 km</p>
                  <span className="text-[9px] font-bold text-emerald-500">Huduma za Dharura 24/7</span>
                </div>
                <a
                  href="tel:112"
                  className="px-3 py-1.5 rounded-xl bg-rose-600 text-white font-bold text-[11px] flex items-center gap-1 cursor-pointer"
                >
                  <Phone className="w-3 h-3" />
                  <span>Piga</span>
                </a>
              </div>

              <button
                type="button"
                onClick={() => setActiveModal(null)}
                className="w-full py-3 rounded-xl bg-[#0A4275] dark:bg-cyan-500 text-white dark:text-slate-950 font-bold text-xs cursor-pointer"
              >
                Funga Orodha
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL 8: NIAAI HEALTH TRIAGE CHAT */}
      {activeModal === 'ai' && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-xs animate-in fade-in">
          <div
            className={`w-full max-w-md rounded-3xl p-5 sm:p-6 border relative flex flex-col h-[520px] ${
              isDark ? 'bg-[#0E1B2C] border-slate-700 text-white' : 'bg-white border-slate-200 text-slate-900'
            }`}
          >
            <button
              type="button"
              onClick={() => setActiveModal(null)}
              className="absolute top-4 right-4 p-2 rounded-full hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-400 hover:text-slate-700 dark:hover:text-white cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>

            <div className="flex items-center gap-2 mb-3 flex-shrink-0">
              <div className="w-8 h-8 rounded-xl bg-cyan-500/20 text-cyan-400 flex items-center justify-center">
                <Sparkles className="w-4 h-4" />
              </div>
              <div>
                <h3 className="text-sm font-black">NiaAI Smart Triage Assistant</h3>
                <span className="text-[10px] text-emerald-500 font-semibold block leading-none">
                  ● Mfumo wa AI wa Ushauri wa Afya Mtandaoni
                </span>
              </div>
            </div>

            {/* Chat message bubbles */}
            <div className="flex-1 overflow-y-auto space-y-2.5 pr-1 text-xs">
              {aiChatHistory.map((msg, i) => (
                <div
                  key={i}
                  className={`p-3 rounded-2xl max-w-[85%] leading-relaxed ${
                    msg.sender === 'user'
                      ? 'ml-auto bg-[#0A4275] text-white rounded-br-xs'
                      : isDark
                      ? 'bg-slate-800/90 text-slate-200 rounded-bl-xs border border-slate-700/60'
                      : 'bg-slate-100 text-slate-800 rounded-bl-xs'
                  }`}
                >
                  {msg.text}
                </div>
              ))}
            </div>

            {/* Quick symptom suggestions */}
            <div className="flex items-center gap-1.5 overflow-x-auto py-2 flex-shrink-0 text-[10px]">
              <button
                type="button"
                onClick={() => setAiMessage('Nina maumivu ya kichwa na homa kidogo')}
                className="px-2.5 py-1 rounded-full border border-slate-700 bg-slate-800/60 text-slate-300 whitespace-nowrap cursor-pointer hover:border-cyan-400"
              >
                🤒 Homa & Kichwa
              </button>
              <button
                type="button"
                onClick={() => setAiMessage('Nahitaji ushauri wa kipimo cha Malaria')}
                className="px-2.5 py-1 rounded-full border border-slate-700 bg-slate-800/60 text-slate-300 whitespace-nowrap cursor-pointer hover:border-cyan-400"
              >
                🧪 Kipimo cha Malaria
              </button>
            </div>

            {/* Chat input form */}
            <div className="pt-2 flex items-center gap-2 flex-shrink-0 border-t border-slate-200 dark:border-slate-800">
              <input
                type="text"
                placeholder="Eleza dalili zako hapa..."
                value={aiMessage}
                onChange={(e) => setAiMessage(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleSendAiMessage()}
                className={`flex-1 text-xs p-3 rounded-xl border outline-none ${
                  isDark ? 'bg-slate-900 border-slate-700 text-white' : 'bg-slate-50 border-slate-200'
                }`}
              />
              <button
                type="button"
                onClick={handleSendAiMessage}
                className="p-3 rounded-xl bg-cyan-500 text-slate-950 font-bold cursor-pointer hover:bg-cyan-400 transition-all flex-shrink-0"
              >
                <Send className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL 9: COMPREHENSIVE HOSPITAL CHECKOUT & BILLING PROCEDURES */}
      <CheckoutProcedureModal
        isOpen={activeModal === 'checkout'}
        onClose={() => setActiveModal(null)}
        language={language}
        theme={theme}
        userCategory={userCategory}
        localData={localData}
        intlData={intlData}
      />
    </div>
  );
};
