import React, { useState, useEffect } from 'react';
import {
  Shield,
  CreditCard,
  QrCode,
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
  Check,
  Clock,
  Download,
  X,
  CalendarCheck,
  Video,
  Banknote,
  FolderLock,
  FileDown,
  Bell,
  Settings,
  Siren,
} from 'lucide-react';
import { UserCategory, Language, LocalFormData, InternationalFormData, Theme } from '../types';
import { TRANSLATIONS } from '../data/translations';
import { TANZANIA_INSURANCE_PROVIDERS } from '../data/insurance';
import { AppointmentBookingModal } from './AppointmentBookingModal';
import { CheckoutProcedureModal } from './CheckoutProcedureModal';
import { MedicalRecordsModal } from './MedicalRecordsModal';
import { QrPassportModal } from './QrPassportModal';
import { PrescriptionsModal } from './PrescriptionsModal';
import { InsuranceModal } from './InsuranceModal';
import { FacilitiesModal } from './FacilitiesModal';
import { AiTriageModal } from './AiTriageModal';
import { Appointment } from '../data/doctors';
import { MedicalRecord } from '../data/medicalRecords';
import { getPatientCountry } from '../data/countries';
import { formatDob } from '../utils/dateUtils';
import { generateMedicalRecordPdf, generateCompiledMedicalPassportPdf } from '../utils/pdfGenerator';
import { fetchMedicalRecords } from '../lib/records';
import { fetchPrescriptions, updatePrescriptionTaken, Prescription } from '../lib/prescriptions';
import { logAuditEvent } from '../lib/audit';
import { Avatar } from './Avatar';
import { LaboratoryModal } from './LaboratoryModal';
import { BottomNav } from './BottomNav';

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
  authUserId: string | null;
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
  authUserId,
}) => {
  const t = TRANSLATIONS.dashboard;
  const isDark = theme === 'dark';

  // Active sub-modals for dashboard actions
  const [activeModal, setActiveModal] = useState<
    'qr' | 'appointment' | 'prescriptions' | 'records' | 'personal_files' | 'insurance' | 'facilities' | 'ai' | 'checkout' | 'laboratory' | null
  >(null);
  const [activeNav, setActiveNav] = useState<'home' | 'appointments' | 'records' | 'prescriptions' | 'profile'>('home');

  const handleNavigation = (key: typeof activeNav) => {
    setActiveNav(key);
    if (key === 'appointments') setActiveModal('appointment');
    if (key === 'records') setActiveModal('records');
    if (key === 'prescriptions') setActiveModal('prescriptions');
    if (key === 'profile') onOpenSettings();
  };

  // Quick PDF download toast notice
  const [pdfToast, setPdfToast] = useState<string | null>(null);

  // Direct download for a single record from dashboard
  const handleQuickRecordDownload = (record: MedicalRecord, e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      const patientMeta = {
        name: patientName,
        id: primaryDocNumber,
        dob: patientDob,
        bloodType: patientBloodType,
        phone: patientPhone,
        insurance: insuranceProviderName,
        docType: primaryDocType,
        docNumber: primaryDocNumber,
      };
      generateMedicalRecordPdf(record, patientMeta, language);
      if (authUserId) logAuditEvent('DOCUMENT_DOWNLOADED', 'medical_records', record.id, authUserId, { title: record.title });
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
        name: patientName,
        id: primaryDocNumber,
        dob: patientDob,
        bloodType: patientBloodType,
        phone: patientPhone,
        insurance: insuranceProviderName,
        docType: primaryDocType,
        docNumber: primaryDocNumber,
      };
      generateCompiledMedicalPassportPdf(medicalRecords, patientMeta, language);
      if (authUserId) logAuditEvent('DOCUMENT_DOWNLOADED', 'health_passport', undefined, authUserId);
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
  const [internalAppointmentsList, setInternalAppointmentsList] = useState<Appointment[]>([]);
  const appointmentsList = externalAppointmentsList || internalAppointmentsList;
  const setAppointmentsList = externalSetAppointmentsList || setInternalAppointmentsList;
  const [appointmentToast, setAppointmentToast] = useState<string | null>(null);

  // Real per-patient medical records & prescriptions loaded from Supabase.
  const [medicalRecords, setMedicalRecords] = useState<MedicalRecord[]>([]);
  const [prescriptions, setPrescriptions] = useState<Prescription[]>([]);

  useEffect(() => {
    if (!authUserId) return;
    let active = true;
    fetchMedicalRecords(authUserId).then(({ records }) => {
      if (active) setMedicalRecords(records);
    });
    fetchPrescriptions(authUserId).then(({ prescriptions: fetched }) => {
      if (active) setPrescriptions(fetched);
    });
    return () => {
      active = false;
    };
  }, [authUserId]);

  const activePrescription = prescriptions.find((p) => !p.isSos) || null;

  const handleTogglePillTaken = () => {
    if (!activePrescription) return;
    const nextValue = !activePrescription.takenToday;
    setPrescriptions((prev) =>
      prev.map((p) => (p.id === activePrescription.id ? { ...p, takenToday: nextValue } : p))
    );
    updatePrescriptionTaken(activePrescription.id, nextValue);
  };

  const isLocal = userCategory === 'locals';
  const patientName = isLocal ? localData.fullName : intlData.fullName;
  const patientAge = isLocal ? localData.age : intlData.age;
  const patientDob = isLocal
    ? formatDob(localData.birthYear, localData.birthMonth, localData.birthDay, language)
    : formatDob(intlData.birthYear, intlData.birthMonth, intlData.birthDay, language);
  const patientBloodType = (isLocal ? localData.bloodType : intlData.bloodType) || '';
  const patientGender = isLocal ? localData.gender : intlData.gender;
  const patientPhone = isLocal
    ? localData.phone ? `+255 ${localData.phone}` : ''
    : intlData.phone ? `${intlData.countryCode || ''} ${intlData.phone}` : '';

  let primaryDocType = 'NIDA / NIN';
  let primaryDocNumber = localData.nidaNumber;

  if (isLocal) {
    if (localData.selectedDocType === 'insurance') {
      primaryDocType = 'Bima ID';
      primaryDocNumber = localData.insuranceNumber;
    } else if (localData.selectedDocType === 'birth_cert') {
      primaryDocType = 'RITA Cert';
      primaryDocNumber = localData.birthCertId;
    }
  } else {
    primaryDocType = 'Passport';
    primaryDocNumber = intlData.passportNumber;
  }

  const insuranceProviderName = isLocal
    ? (TANZANIA_INSURANCE_PROVIDERS.find((p) => p.id === localData.insuranceProvider)?.name || '')
    : (intlData.travelInsuranceProvider || '');

  const patientCountry = getPatientCountry(userCategory, localData, intlData);
  const patientId = authUserId ? `NC-${patientCountry.code}-${authUserId.slice(0, 8).toUpperCase()}` : '';

  // Greeting based on real-time hour of day
  const hour = new Date().getHours();
  const greeting =
    hour < 12 ? t.greetingMorning[language] : hour < 17 ? t.greetingAfternoon[language] : t.greetingEvening[language];

  return (
    <div id="patient-home-dashboard" className="patient-mobile-shell space-y-4 animate-in fade-in slide-in-from-bottom-2 duration-300">
      {/* Patient app header - rebuilt to match the clean mobile reference. */}
      <div className="pt-3 sm:pt-4">
        <div className="flex items-center justify-between gap-3">
          <div className="flex min-w-0 items-center gap-3">
            <div className="relative">
              <Avatar name={patientName || '?'} size="lg" />
              <span className="absolute -bottom-0.5 -right-0.5 h-3.5 w-3.5 rounded-full border-2 border-white bg-emerald-500 dark:border-[#0B1522]" />
            </div>
            <div className="min-w-0">
              <p className="text-xs font-semibold nc-text-muted">{greeting}</p>
              <h1 className="truncate text-xl font-semibold leading-tight text-[#10233E] dark:text-white">
                {patientName}
              </h1>
              <p className="truncate text-[11px] font-semibold nc-text-muted">
                {patientCountry.flag} {patientCountry.name} - {primaryDocType}
              </p>
            </div>
          </div>

          <div className="flex shrink-0 items-center gap-2">
            <button
              type="button"
              className="relative flex h-10 w-10 items-center justify-center rounded-xl border nc-border bg-white text-primary shadow-sm dark:bg-[#101F31] dark:text-primary-light"
              title="Notifications"
            >
              <Bell className="h-4 w-4" />
              <span className="absolute right-2 top-2 h-2 w-2 rounded-full bg-rose-500" />
            </button>
            <button
              type="button"
              onClick={onOpenSettings}
              className="flex h-10 w-10 items-center justify-center rounded-xl border nc-border bg-white text-primary shadow-sm dark:bg-[#101F31] dark:text-primary-light"
              title="Settings"
            >
              <Settings className="h-4 w-4" />
            </button>
            <button
              type="button"
              onClick={onLogout}
              className="flex h-10 w-10 items-center justify-center rounded-xl border border-rose-100 bg-white text-rose-600 shadow-sm dark:border-rose-900 dark:bg-[#101F31]"
              title={t.switchProfile[language]}
            >
              <LogOut className="h-4 w-4" />
            </button>
          </div>
        </div>

        <button
          type="button"
          onClick={() => setActiveModal('ai')}
          className="mt-4 flex w-full items-center justify-between rounded-2xl bg-[#E52E3D] px-4 py-3 text-left text-white shadow-[0_10px_24px_rgba(229,46,61,0.18)]"
        >
          <span className="flex items-center gap-3">
            <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-white/95 text-[#E52E3D]">
              <Siren className="h-5 w-5" />
            </span>
            <span>
              <span className="block text-xs font-semibold uppercase tracking-wide">Emergency Care</span>
              <span className="block text-sm font-semibold text-white/90">1-tap help and ambulance guidance</span>
            </span>
          </span>
          <ChevronRight className="h-5 w-5" />
        </button>
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

      {/* 1. UPCOMING HOSPITAL APPOINTMENT CARD — the single most important
          thing on this screen ("what's next for me"), so it leads, before
          the health passport card below. */}
      {(() => {
        const activeAppointment = appointmentsList.find((a) => a.status !== 'cancelled');
        return (
          <div
            className={`p-4 rounded-xl border ${
              isDark ? 'bg-[#101F31] border-slate-700/80' : 'bg-white border-slate-200/90'
            }`}
          >
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <Clock className={`w-4 h-4 ${isDark ? 'text-primary-light' : 'text-primary'}`} />
                <h3 className={`text-xs sm:text-sm font-semibold ${isDark ? 'text-white' : 'text-slate-900'}`}>
                  {t.upcomingTitle[language]}
                </h3>
              </div>
              {activeAppointment ? (
                <span className="text-[10px] font-bold text-primary dark:text-primary-light bg-primary/5 dark:bg-primary/10 px-2 py-0.5 rounded-full border border-primary/20 dark:border-primary/30">
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
                className={`p-3.5 rounded-xl border flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 ${
                  isDark ? 'bg-[#091422] border-slate-800' : 'bg-[#F9FBFE] border-slate-100'
                }`}
              >
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-primary/10 text-primary dark:text-primary-light flex items-center justify-center font-semibold flex-shrink-0">
                    <Stethoscope className="w-5 h-5" />
                  </div>
                  <div>
                    <div className="flex items-center gap-1.5">
                      <h4 className="text-xs font-semibold text-slate-900 dark:text-white">
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
                    className="w-full sm:w-auto px-3 py-2 rounded-xl text-xs font-bold bg-primary text-white hover:bg-primary-light cursor-pointer transition-all flex items-center justify-center gap-1 shadow-sm"
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
                className={`p-3.5 rounded-xl border flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 ${
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
                  className="px-3 py-2 rounded-xl text-xs font-bold bg-primary text-white hover:bg-primary-light cursor-pointer transition-all flex items-center gap-1 flex-shrink-0 shadow-sm"
                >
                  <CalendarCheck className="w-3.5 h-3.5" />
                  <span>{language === 'sw' ? 'Weka Miadi' : 'Book Appointment'}</span>
                </button>
              </div>
            )}
          </div>
        );
      })()}

      {/* 2. Digital Health Passport — real functionality (QR check-in,
          PDF download), kept but de-decorated: no holographic blur, no
          gold "chip" graphic. Healthcare clarity over decoration. */}
      <div
        id="card-digital-health-passport"
        className="relative rounded-xl overflow-hidden p-4 text-white nc-gradient-passport border border-white/15"
      >
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-xl bg-white/10 flex items-center justify-center text-white/85">
              <Shield className="w-4 h-4" />
            </div>
            <div>
              <span className="text-[10px] uppercase font-mono tracking-widest text-white/70 font-semibold block">
                {patientCountry.headerTitle}
              </span>
              <h3 className="text-xs sm:text-sm font-semibold tracking-tight text-white flex items-center gap-1.5">
                <span>NIACARE HEALTH PASSPORT</span>
                <span className="text-base">{patientCountry.flag}</span>
              </h3>
            </div>
          </div>
          <span className="text-[11px] font-mono font-semibold bg-white/15 px-2 py-1 rounded-lg border border-white/20 flex items-center gap-1 text-white flex-shrink-0">
            <span>{patientCountry.flag}</span>
            <span>{patientCountry.code}</span>
          </span>
        </div>

        <div className="space-y-3 mb-4">
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 text-xs">
            <div>
              <span className="text-[9px] uppercase tracking-wider text-white/70 font-semibold block">
                {language === 'sw' ? 'JINA LA MGONJWA' : 'PATIENT NAME'}
              </span>
              <p className="font-semibold text-sm text-white truncate">{patientName}</p>
            </div>
            <div>
              <span className="text-[9px] uppercase tracking-wider text-white/70 font-semibold block">
                {language === 'sw' ? 'RAIA / NCHI' : 'CITIZENSHIP / COUNTRY'}
              </span>
              <p className="font-bold text-xs text-white truncate flex items-center gap-1">
                <span>{patientCountry.flag}</span>
                <span>{patientCountry.name}</span>
              </p>
            </div>
            <div className="col-span-2 sm:col-span-1">
              <span className="text-[9px] uppercase tracking-wider text-white/70 font-semibold block">
                {primaryDocType}
              </span>
              <p className="font-mono font-bold text-xs text-white truncate">{primaryDocNumber}</p>
            </div>
          </div>

          <div className="grid grid-cols-3 gap-2 pt-1 border-t border-white/10 text-[11px]">
            <div>
              <span className="text-[9px] text-white/70 font-semibold block">DAMU (Blood)</span>
              <span className="font-mono font-semibold text-amber-300 text-xs truncate block">
                {patientBloodType === 'unknown' ? (language === 'sw' ? 'Sina Uhakika' : 'Unknown') : `${patientBloodType} ${patientBloodType.endsWith('+') ? 'Pos' : patientBloodType.endsWith('-') ? 'Neg' : ''}`}
              </span>
            </div>
            <div>
              <span className="text-[9px] text-white/70 font-semibold block">KUZALIWA (DOB)</span>
              <span className="font-bold text-white text-xs truncate block" title={patientDob}>
                {patientDob} ({patientAge}y)
              </span>
            </div>
            <div>
              <span className="text-[9px] text-white/70 font-semibold block">STATUS</span>
              <span className="font-bold text-emerald-300 text-xs flex items-center gap-0.5">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
                Active
              </span>
            </div>
          </div>
        </div>

        <div className="p-2.5 rounded-xl bg-white/10 border border-white/15 mb-4 flex items-center justify-between text-xs">
          <div className="flex items-center gap-2">
            <Building2 className="w-4 h-4 text-white/85 flex-shrink-0" />
            <div className="truncate">
              <span className="text-[9px] text-white/70 block font-semibold leading-none">
                {t.insuranceCoverage[language]}
              </span>
              <span className="font-bold text-[11px] text-white truncate block">
                {insuranceProviderName}
              </span>
            </div>
          </div>
          <span className="text-[9px] font-semibold bg-emerald-500/90 text-white px-2 py-0.5 rounded-full uppercase tracking-wider flex-shrink-0">
            {t.activeInsuranceBadge[language]}
          </span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
          <button
            id="btn-show-qr-passport"
            type="button"
            onClick={() => setActiveModal('qr')}
            className="w-full py-2.5 px-4 rounded-xl bg-white hover:bg-white/90 text-primary font-semibold text-xs flex items-center justify-center gap-2 cursor-pointer transition-all"
          >
            <QrCode className="w-4 h-4" />
            <span>{t.viewQr[language]} (Check-in)</span>
          </button>

          <button
            id="btn-download-passport-pdf"
            type="button"
            onClick={handleDirectPassportPdfDownload}
            className="w-full py-2.5 px-4 rounded-xl bg-white/15 hover:bg-white/25 text-white border border-white/20 font-semibold text-xs flex items-center justify-center gap-2 cursor-pointer transition-all active:scale-98"
          >
            <FileDown className="w-4 h-4 text-white/85" />
            <span>{language === 'sw' ? 'Pakua Pasipoti (PDF)' : 'Download Passport (PDF)'}</span>
          </button>
        </div>
      </div>

      {/* 3. Active Prescription Banner with 1-Tap Pill Checkoff (only if a real prescription exists) */}
      {activePrescription && (
        <div
          className={`p-3.5 rounded-2xl border flex items-center justify-between gap-3 transition-all ${
            activePrescription.takenToday
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
                activePrescription.takenToday
                  ? 'bg-emerald-500 text-white'
                  : isDark
                  ? 'bg-amber-500/20 text-amber-400'
                  : 'bg-amber-100 text-amber-700'
              }`}
            >
              {activePrescription.takenToday ? <Check className="w-5 h-5" /> : <Pill className="w-5 h-5" />}
            </div>
            <div className="min-w-0">
              <span className="text-[10px] font-bold uppercase tracking-wider block opacity-80">
                {activePrescription.takenToday ? 'Dawa Imeshanywewa Leo' : 'Kumbusho la Dawa'}
              </span>
              <p className="text-xs font-bold truncate">
                {activePrescription.takenToday
                  ? `${activePrescription.medicationName} - Imethibitishwa`
                  : `${activePrescription.medicationName} (${activePrescription.dosageInstructions})`}
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={handleTogglePillTaken}
            className={`px-3 py-1.5 rounded-xl text-xs font-semibold flex-shrink-0 transition-all cursor-pointer shadow-xs ${
              activePrescription.takenToday
                ? isDark
                  ? 'bg-slate-800 text-slate-300 hover:bg-slate-700'
                  : 'bg-white text-slate-700 hover:bg-slate-100'
                : isDark
                ? 'bg-amber-500 text-slate-950 hover:bg-amber-400'
                : 'bg-amber-600 text-white hover:bg-amber-700'
            }`}
          >
            {activePrescription.takenToday ? 'Badili' : t.takePillNow[language]}
          </button>
        </div>
      )}

      {/* Appointment Toast Notification if triggered */}
      {appointmentToast && (
        <div className="p-3.5 rounded-2xl bg-gradient-to-r from-emerald-600 to-primary-dark text-white font-bold text-xs flex items-center justify-between shadow-lg animate-in slide-in-from-top duration-300">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-200" />
            <span>{appointmentToast}</span>
          </div>
          <button
            type="button"
            onClick={() => setActiveModal('appointment')}
            className="px-2 py-1 rounded bg-black/20 hover:bg-black/30 text-[11px] font-semibold underline cursor-pointer"
          >
            Tazama Tiketi
          </button>
        </div>
      )}

      {/* Prominent Quick Doctor Appointment Banner */}
      <div
        className={`hidden p-4 rounded-2xl border relative overflow-hidden transition-all ${
          isDark
            ? 'bg-gradient-to-r from-[#0C2340] via-[#0E2C52] to-[#123966] border-primary/40 text-white shadow-xl'
            : 'bg-gradient-to-r from-primary-dark via-primary to-primary-light border-primary/40 text-white shadow-md'
        }`}
      >
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 relative z-10">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold uppercase tracking-wider bg-primary text-white">
                1-TAP BOOKING
              </span>
              <span className="text-[11px] text-white/70 font-semibold">
                Madaktari Bingwa 500+ nchini
              </span>
            </div>
            <h3 className="text-sm sm:text-base font-semibold tracking-tight">
              {language === 'sw'
                ? 'Weka Miadi ya Daktari & Hospitali (Referral & Video)'
                : language === 'fr'
                ? 'Prendre Rendez-vous Médical (Hôpital & Vidéo)'
                : 'Book Doctor & Hospital Consultation (In-Person / Video)'}
            </h3>
            <p className="text-[11px] text-white/70">
              Muhimbili (MNH), Aga Khan, KCMC Moshi, Bugando Mwanza • Bima ya NHIF / Direct Pay
            </p>
          </div>

          <button
            id="btn-quick-banner-book"
            type="button"
            onClick={() => setActiveModal('appointment')}
            className="w-full sm:w-auto px-4 py-2.5 rounded-2xl bg-white hover:bg-white/90 text-primary font-semibold text-xs flex items-center justify-center gap-1.5 shadow-lg cursor-pointer transition-all flex-shrink-0"
          >
            <CalendarCheck className="w-4 h-4" />
            <span>{language === 'sw' ? 'Weka Miadi Sasa' : 'Book Appointment'}</span>
            <ChevronRight className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* 5. 6-Action Quick Health Services Grid */}
      <div
        className={`p-4 rounded-2xl border ${
          isDark ? 'bg-[#101F31] border-slate-700/80' : 'bg-white border-slate-200/90'
        }`}
      >
        <div className="flex items-center justify-between mb-3">
          <h3 className={`text-xs sm:text-sm font-semibold ${isDark ? 'text-white' : 'text-slate-900'}`}>
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
                ? 'bg-[#091422] border-slate-800 hover:border-primary hover:bg-[#0c1a2d]'
                : 'bg-[#F9FBFE] border-slate-200/80 hover:border-primary hover:bg-primary/5'
            }`}
          >
            <div className="w-9 h-9 rounded-xl bg-primary/10 text-primary dark:text-primary-light flex items-center justify-center mb-2">
              <Calendar className="w-5 h-5" />
            </div>
            <div>
              <h4 className="text-xs font-semibold text-slate-900 dark:text-white leading-tight">
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
                ? 'bg-[#091422] border-slate-800 hover:border-primary hover:bg-[#0c1a2d]'
                : 'bg-[#F9FBFE] border-slate-200/80 hover:border-primary hover:bg-primary/5'
            }`}
          >
            <div className="w-9 h-9 rounded-xl bg-primary/10 text-primary dark:text-primary-light flex items-center justify-center mb-2">
              <Banknote className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-1">
                <h4 className="text-xs font-semibold text-slate-900 dark:text-white leading-tight">
                  {t.checkoutBilling[language]}
                </h4>
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
                ? 'bg-[#091422] border-slate-800 hover:border-primary hover:bg-[#0c1a2d]'
                : 'bg-[#F9FBFE] border-slate-200/80 hover:border-primary hover:bg-primary/5'
            }`}
          >
            <div className="w-9 h-9 rounded-xl bg-primary/10 text-primary dark:text-primary-light flex items-center justify-center mb-2">
              <Pill className="w-5 h-5" />
            </div>
            <div>
              <h4 className="text-xs font-semibold text-slate-900 dark:text-white leading-tight">
                {t.prescriptions[language]}
              </h4>
              <p className="text-[10px] text-slate-500 dark:text-slate-400 mt-0.5 leading-tight">
                {t.prescriptionsSub[language]}
              </p>
            </div>
          </button>

          {/* Action 4: Lab Results (real lab_orders/lab_results, not the
              generic medical records vault) */}
          <button
            id="hub-btn-lab-records"
            type="button"
            onClick={() => setActiveModal('laboratory')}
            className={`p-3 rounded-2xl border text-left flex flex-col justify-between transition-all cursor-pointer group active:scale-98 ${
              isDark
                ? 'bg-[#091422] border-slate-800 hover:border-primary hover:bg-[#0c1a2d]'
                : 'bg-[#F9FBFE] border-slate-200/80 hover:border-primary hover:bg-primary/5'
            }`}
          >
            <div className="w-9 h-9 rounded-xl bg-primary/10 text-primary dark:text-primary-light flex items-center justify-center mb-2">
              <FileText className="w-5 h-5" />
            </div>
            <div>
              <h4 className="text-xs font-semibold text-slate-900 dark:text-white leading-tight">
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
                ? 'bg-[#091422] border-slate-800 hover:border-primary hover:bg-[#0c1a2d]'
                : 'bg-[#F9FBFE] border-slate-200/80 hover:border-primary hover:bg-primary/5'
            }`}
          >
            <div className="w-9 h-9 rounded-xl bg-primary/10 text-primary dark:text-primary-light flex items-center justify-center mb-2">
              <FolderLock className="w-5 h-5" />
            </div>
            <div>
              <h4 className="text-xs font-semibold text-slate-900 dark:text-white leading-tight">
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
                ? 'bg-[#091422] border-slate-800 hover:border-primary hover:bg-[#0c1a2d]'
                : 'bg-[#F9FBFE] border-slate-200/80 hover:border-primary hover:bg-primary/5'
            }`}
          >
            <div className="w-9 h-9 rounded-xl bg-primary/10 text-primary dark:text-primary-light flex items-center justify-center mb-2">
              <CreditCard className="w-5 h-5" />
            </div>
            <div>
              <h4 className="text-xs font-semibold text-slate-900 dark:text-white leading-tight">
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
                ? 'bg-[#091422] border-slate-800 hover:border-primary hover:bg-[#0c1a2d]'
                : 'bg-[#F9FBFE] border-slate-200/80 hover:border-primary hover:bg-primary/5'
            }`}
          >
            <div className="w-9 h-9 rounded-xl bg-primary/10 text-primary dark:text-primary-light flex items-center justify-center mb-2">
              <MapPin className="w-5 h-5" />
            </div>
            <div>
              <h4 className="text-xs font-semibold text-slate-900 dark:text-white leading-tight">
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
                ? 'bg-[#091422] border-slate-800 hover:border-primary hover:bg-[#0c1a2d]'
                : 'bg-[#F9FBFE] border-slate-200/80 hover:border-primary hover:bg-primary/5'
            }`}
          >
            <div className="flex items-center gap-2">
              <div className="w-9 h-9 rounded-xl bg-primary/15 text-primary dark:text-primary-light flex items-center justify-center flex-shrink-0">
                <Stethoscope className="w-5 h-5" />
              </div>
              <div>
                <h4 className="text-xs font-semibold text-slate-900 dark:text-white leading-tight flex items-center gap-1">
                  <span>{t.aiConsult[language]}</span>
                  <Sparkles className="w-3 h-3 text-primary" />
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
        className={`p-4 rounded-2xl border shadow-sm ${
          isDark ? 'bg-[#101F31] border-slate-700/80' : 'bg-white border-slate-200/90'
        }`}
      >
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <FileText className="w-4 h-4 text-primary" />
            <h3 className={`text-xs sm:text-sm font-semibold ${isDark ? 'text-white' : 'text-slate-900'}`}>
              {language === 'sw' ? 'Rekodi za Matibabu & Majibu ya Vipimo' : 'Medical Records & Diagnostic History'}
            </h3>
          </div>
          {medicalRecords.length > 0 && (
            <button
              id="btn-view-all-records"
              type="button"
              onClick={() => setActiveModal('records')}
              className="text-[11px] font-bold text-primary dark:text-primary-light hover:underline cursor-pointer flex items-center gap-1"
            >
              <span>
                {language === 'sw' ? `Fungua Zote (${medicalRecords.length})` : `View All (${medicalRecords.length})`}
              </span>
              <ChevronRight className="w-3 h-3" />
            </button>
          )}
        </div>

        {medicalRecords.length === 0 ? (
          <div className="text-center py-6 space-y-1.5">
            <FileText className="w-8 h-8 text-slate-400 mx-auto opacity-50" />
            <p className="text-[11px] font-semibold text-slate-500">
              {language === 'sw'
                ? 'Hakuna rekodi za matibabu bado. Zitaonekana hapa baada ya ziara yako ya kwanza.'
                : 'No medical records yet. They will appear here after your first visit.'}
            </p>
          </div>
        ) : (
        <div className="space-y-2.5">
          {/* Quick preview of top 3 records */}
          {medicalRecords.slice(0, 3).map((rec) => (
            <div
              key={rec.id}
              onClick={() => setActiveModal('records')}
              className={`p-3 rounded-2xl border flex items-center justify-between text-xs cursor-pointer transition-all ${
                isDark
                  ? 'bg-[#091422] border-slate-800/80 hover:border-primary/60'
                  : 'bg-slate-50/80 border-slate-200/70 hover:border-primary/40'
              }`}
            >
              <div className="flex items-center gap-2.5 min-w-0">
                <div
                  className={`w-2.5 h-2.5 rounded-full flex-shrink-0 ${
                    rec.category === 'lab'
                      ? 'bg-primary'
                      : rec.category === 'radiology'
                      ? 'bg-primary'
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
                  className="p-1.5 rounded-lg bg-primary/10 text-primary dark:text-primary-light hover:bg-primary/20 transition-colors"
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
        )}

        {/* Big Check Medical Records CTA Button */}
        <div className="mt-3 pt-3 border-t border-slate-200 dark:border-slate-800">
          <button
            id="btn-open-medical-records-modal"
            type="button"
            onClick={() => setActiveModal('records')}
            className="w-full py-2.5 px-4 rounded-xl bg-primary hover:bg-primary-light text-white font-semibold text-xs flex items-center justify-center gap-2 shadow-sm cursor-pointer transition-all active:scale-98"
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
      <QrPassportModal
        isOpen={activeModal === 'qr'}
        onClose={() => setActiveModal(null)}
        theme={theme}
        patientId={patientId}
        primaryDocNumber={primaryDocNumber}
      />

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
        authUserId={authUserId}
        onAppointmentBooked={(newApt) => {
          setAppointmentToast(`Miadi imepangwa: ${newApt.doctorName} (${newApt.timeSlot})`);
          setTimeout(() => setAppointmentToast(null), 4000);
        }}
      />

      {/* MODAL 4: PRESCRIPTIONS & REFILLS */}
      <PrescriptionsModal
        isOpen={activeModal === 'prescriptions'}
        onClose={() => setActiveModal(null)}
        theme={theme}
        language={language}
        prescriptions={prescriptions}
        setPrescriptions={setPrescriptions}
        onOpenCheckout={() => setActiveModal('checkout')}
      />

      {/* MODAL 5: MEDICAL RECORDS & LAB REPORTS MODAL */}
      <MedicalRecordsModal
        isOpen={activeModal === 'records' || activeModal === 'personal_files'}
        onClose={() => setActiveModal(null)}
        language={language}
        theme={theme}
        patientName={patientName}
        patientId={patientId}
        patientDob={patientDob}
        patientBloodType={patientBloodType}
        patientPhone={patientPhone}
        patientInsurance={insuranceProviderName}
        patientDocType={primaryDocType}
        patientDocNumber={primaryDocNumber}
        initialTab={activeModal === 'personal_files' ? 'personal_files' : 'records'}
        authUserId={authUserId}
      />

      {/* MODAL 6: INSURANCE & CLAIMS */}
      <InsuranceModal
        isOpen={activeModal === 'insurance'}
        onClose={() => setActiveModal(null)}
        theme={theme}
        insuranceProviderName={insuranceProviderName}
        authUserId={authUserId}
        onOpenCheckout={() => setActiveModal('checkout')}
      />

      {/* MODAL 7: NEARBY HOSPITALS MAP / DIRECTORY */}
      <FacilitiesModal
        isOpen={activeModal === 'facilities'}
        onClose={() => setActiveModal(null)}
        theme={theme}
      />

      {/* MODAL 8: NIAAI HEALTH TRIAGE CHAT */}
      <AiTriageModal
        isOpen={activeModal === 'ai'}
        onClose={() => setActiveModal(null)}
        theme={theme}
        language={language}
      />

      {/* MODAL 10: LABORATORY — real lab_orders/lab_results, pending vs
          completed, with normal/abnormal/critical clearly flagged. */}
      <LaboratoryModal
        isOpen={activeModal === 'laboratory'}
        onClose={() => setActiveModal(null)}
        theme={theme}
        patientId={authUserId}
      />

      <BottomNav active={activeNav} onChange={handleNavigation} language={language} />

      {/* MODAL 9: COMPREHENSIVE HOSPITAL CHECKOUT & BILLING PROCEDURES */}
      <CheckoutProcedureModal
        isOpen={activeModal === 'checkout'}
        onClose={() => setActiveModal(null)}
        language={language}
        theme={theme}
        userCategory={userCategory}
        localData={localData}
        intlData={intlData}
        authUserId={authUserId}
      />
    </div>
  );
};
