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
  Settings,
  Siren,
  Users,
  MessageSquare,
  Share2,
  PersonStanding,
  Route,
  CalendarDays,
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
import { FacilityMapModal } from './FacilityMapModal';
import { AiTriageModal } from './AiTriageModal';
import { Appointment, DoctorProfileTarget } from '../data/doctors';
import { appointmentStatusLabel } from '../data/appointmentStatus';
import { MedicalRecord } from '../data/medicalRecords';
import { getPatientCountry } from '../data/countries';
import { formatDob } from '../utils/dateUtils';
import { generateMedicalRecordPdf, generateCompiledMedicalPassportPdf } from '../utils/pdfGenerator';
import { fetchMedicalRecords } from '../lib/records';
import { fetchPrescriptions, updatePrescriptionTaken, Prescription } from '../lib/prescriptions';
import { fetchQueuePosition, QueuePosition } from '../lib/queue';
import { logAuditEvent } from '../lib/audit';
import { Avatar } from './Avatar';
import { NotificationBell } from './NotificationBell';
import { MessagesModal } from './MessagesModal';
import { ReferralsModal } from './ReferralsModal';
import { BodyMapModal } from './BodyMapModal';
import { HealthJourneyModal } from './HealthJourneyModal';
import { CalendarModal } from './CalendarModal';
import { DoctorProfileModal } from './DoctorProfileModal';
import { FacilityProfileModal, FacilityProfileTarget } from './FacilityProfileModal';
import { ImagingModal } from './ImagingModal';
import { LaboratoryModal } from './LaboratoryModal';
import { BottomNav } from './BottomNav';

// Live "how far along am I" strip for a checked-in appointment — polls
// instead of using a realtime subscription (matches this codebase's
// existing pattern of plain fetch-on-interval, no realtime channels
// anywhere else yet) every 25s while the card is visible, and stops as
// soon as the appointment is no longer in the queue.
const QueueStatusStrip: React.FC<{ language: Language; providerId: string; date: string; queueNumber: string; doctorName?: string }> = ({
  language,
  providerId,
  date,
  queueNumber,
  doctorName,
}) => {
  const [position, setPosition] = useState<QueuePosition | null>(null);

  useEffect(() => {
    let active = true;
    const load = async () => {
      const { position: p } = await fetchQueuePosition(providerId, date, queueNumber);
      if (active && p) setPosition(p);
    };
    load();
    const interval = setInterval(load, 25000);
    return () => {
      active = false;
      clearInterval(interval);
    };
  }, [providerId, date, queueNumber]);

  if (!position) return null;
  const isSw = language === 'sw';

  return (
    <div className="w-full sm:w-auto rounded-xl bg-primary/5 dark:bg-primary/10 border border-primary/15 dark:border-primary/25 px-3.5 py-2.5 text-[11px] font-semibold text-primary dark:text-primary-light">
      <div className="flex items-center justify-between gap-3 mb-1.5">
        <span className="font-mono font-bold">{isSw ? 'Tiketi' : 'Ticket'} {queueNumber}</span>
        {doctorName && <span className="truncate">{doctorName}</span>}
      </div>
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
        <span className="flex items-center gap-1">
          <Users className="w-3.5 h-3.5" />
          {isSw ? `Wagonjwa ${position.patientsAhead} mbele yako` : `${position.patientsAhead} ahead of you`}
        </span>
        <span className="flex items-center gap-1">
          <Clock className="w-3.5 h-3.5" />
          {isSw ? `Muda uliokadiriwa: dakika ${position.estimatedWaitMinutes}` : `Est. wait: ~${position.estimatedWaitMinutes} min`}
        </span>
      </div>
      {(position.currentlyServing || position.nowServing) && (
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1 mt-1.5 pt-1.5 border-t border-primary/15 dark:border-primary/25 text-slate-500 dark:text-slate-400 font-mono text-[10px]">
          {position.currentlyServing && <span>{isSw ? 'Sasa hivi' : 'Now'}: {position.currentlyServing}</span>}
          {position.nowServing && <span>{isSw ? 'Ijayo' : 'Next'}: {position.nowServing}</span>}
        </div>
      )}
    </div>
  );
};

// Purely derived from fields the backend already sets on every status
// transition (see supabase/schema.sql's appointment-pipeline RPCs) — no
// separate frontend state, so this can never drift from the real status.
// "Reception confirmed" and "Added to queue" both flip from the same
// check_in_appointment() call (it sets arrival_confirmed_at and
// queue_number together, atomically) — shown as two lines because the
// spec asks for two, not because the backend treats them as separate steps.
const FLOW_STEPS: { key: string; en: string; sw: string; done: (a: Appointment) => boolean }[] = [
  { key: 'booked', en: 'Appointment booked', sw: 'Miadi imepangwa', done: () => true },
  { key: 'arrived', en: 'Arrived', sw: 'Amefika', done: (a) => !!a.patientArrivedAt || !!a.arrivalConfirmedAt },
  { key: 'confirmed', en: 'Reception confirmed', sw: 'Mapokezi yamethibitisha', done: (a) => !!a.arrivalConfirmedAt },
  { key: 'queued', en: 'Added to queue', sw: 'Umeongezwa kwenye foleni', done: (a) => !!a.queueNumber },
  { key: 'waiting', en: 'Waiting', sw: 'Unasubiri', done: (a) => !!a.calledAt || a.status === 'in_consultation' || a.status === 'completed' },
  { key: 'called', en: 'Called', sw: 'Umeitwa', done: (a) => !!a.calledAt },
  { key: 'consultation', en: 'Consultation', sw: 'Ushauri', done: (a) => !!a.consultationStartedAt },
  { key: 'completed', en: 'Completed', sw: 'Imekamilika', done: (a) => a.status === 'completed' },
];

const AppointmentFlowTimeline: React.FC<{ appointment: Appointment; language: Language; isDark: boolean }> = ({ appointment, language, isDark }) => {
  const [expanded, setExpanded] = useState(false);
  const isSw = language === 'sw';
  const doneFlags = FLOW_STEPS.map((s) => s.done(appointment));
  const currentIndex = doneFlags.findIndex((d) => !d);

  return (
    <div className="mt-3 pt-3 border-t border-slate-100 dark:border-slate-800">
      <button
        type="button"
        onClick={() => setExpanded((e) => !e)}
        aria-expanded={expanded}
        className="flex items-center gap-1 text-[10px] font-bold text-slate-500 dark:text-slate-400"
      >
        {isSw ? 'Ratiba ya Ziara' : 'Visit Timeline'}
        <ChevronRight className={`w-3 h-3 transition-transform ${expanded ? 'rotate-90' : ''}`} />
      </button>
      {expanded && (
        <div className="mt-2 space-y-1.5">
          {FLOW_STEPS.map((step, i) => {
            const done = doneFlags[i];
            const isCurrent = i === currentIndex;
            return (
              <div key={step.key} className="flex items-center gap-2 text-[11px]">
                {done ? (
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500 flex-shrink-0" />
                ) : isCurrent ? (
                  <span className="w-3.5 h-3.5 flex-shrink-0 flex items-center justify-center">
                    <span className="w-2 h-2 rounded-full bg-primary dark:bg-primary-light" />
                  </span>
                ) : (
                  <span className="w-3.5 h-3.5 flex-shrink-0 rounded-full border-2 border-slate-300 dark:border-slate-600" />
                )}
                <span className={done || isCurrent ? `font-semibold ${isDark ? 'text-white' : 'text-slate-900'}` : 'text-slate-400'}>
                  {isSw ? step.sw : step.en}
                </span>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};

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
    'qr' | 'appointment' | 'prescriptions' | 'records' | 'personal_files' | 'insurance' | 'facilities' | 'ai' | 'checkout' | 'laboratory' | 'messages' | 'referrals' | 'bodymap' | 'journey' | 'calendar' | 'imaging' | null
  >(null);
  const [bookingHospitalPreset, setBookingHospitalPreset] = useState<string | null>(null);
  const [bookingDoctorPreset, setBookingDoctorPreset] = useState<string | null>(null);
  const [bookingSlotPreset, setBookingSlotPreset] = useState<{ date: string; time: string } | null>(null);
  const [imagingRecordPreset, setImagingRecordPreset] = useState<string | null>(null);
  const [bodyMapRegionPreset, setBodyMapRegionPreset] = useState<string | null>(null);
  const [viewingDoctorProfile, setViewingDoctorProfile] = useState<DoctorProfileTarget | null>(null);
  const [viewingFacilityProfile, setViewingFacilityProfile] = useState<FacilityProfileTarget | null>(null);

  // Issue 3 fix: every booking preset is cleared together, and only at the
  // three points the spec calls out — modal close/cancel, a successful
  // booking, or an unrelated booking starting fresh. Never mid-session while
  // the booking modal is still open (that would blow away what the patient
  // just picked in the Doctor Profile).
  const clearBookingPresets = () => {
    setBookingHospitalPreset(null);
    setBookingDoctorPreset(null);
    setBookingSlotPreset(null);
  };

  // Shared by every "Book at this facility" entry point (Facility Map,
  // Facility Profile) so the preset-setting logic lives in exactly one
  // place.
  const handleBookAtFacility = (facilityName: string) => {
    setBookingHospitalPreset(facilityName);
    setActiveModal('appointment');
  };
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
            <NotificationBell userId={authUserId} language={language} theme={theme} />
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
        // The nearest non-final-state appointment, soonest first — a
        // completed/cancelled/no_show visit is never "what's next", so it's
        // excluded here (no_show gets its own panel below, per spec).
        const activeAppointment = appointmentsList
          .filter((a) => !['cancelled', 'completed', 'no_show'].includes(a.status))
          .sort((a, b) => (a.date + a.timeSlot).localeCompare(b.date + b.timeSlot))[0];
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

                <div className="flex flex-col items-start sm:items-end gap-2 w-full sm:w-auto">
                  {activeAppointment.status === 'in_queue' && activeAppointment.providerId && activeAppointment.queueNumber && (
                    <QueueStatusStrip
                      language={language}
                      providerId={activeAppointment.providerId}
                      date={activeAppointment.date}
                      queueNumber={activeAppointment.queueNumber}
                      doctorName={activeAppointment.doctorName}
                    />
                  )}
                  {(activeAppointment.status === 'called' || activeAppointment.status === 'in_consultation' || activeAppointment.status === 'arrived') && (
                    <span className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-[11px] font-bold bg-primary/5 dark:bg-primary/10 text-primary dark:text-primary-light border border-primary/20 dark:border-primary/30">
                      {activeAppointment.status === 'in_consultation' ? <CheckCircle2 className="w-3.5 h-3.5" /> : <Clock className="w-3.5 h-3.5" />}
                      {activeAppointment.status === 'called'
                        ? language === 'sw'
                          ? 'Umeitwa — nenda eneo la ushauri'
                          : "You've been called — please proceed"
                        : appointmentStatusLabel(activeAppointment.status, language === 'sw')}
                    </span>
                  )}
                  <div className="flex items-center gap-2 w-full sm:w-auto">
                    {activeAppointment.consultationType !== 'telehealth' && activeAppointment.providerId && (
                      <button
                        type="button"
                        onClick={() => setViewingFacilityProfile({ providerId: activeAppointment.providerId! })}
                        aria-label={language === 'sw' ? 'Pata Njia ya Kituo' : 'Get directions to facility'}
                        className={`px-3 py-2 rounded-xl text-xs font-bold cursor-pointer transition-all flex items-center justify-center gap-1 border ${
                          isDark ? 'border-slate-700 text-slate-200 hover:bg-slate-800' : 'border-slate-200 text-slate-700 hover:bg-slate-50'
                        }`}
                      >
                        <MapPin className="w-3.5 h-3.5" />
                        <span className="hidden sm:inline">{language === 'sw' ? 'Njia' : 'Directions'}</span>
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={() => setActiveModal('appointment')}
                      className="flex-1 sm:flex-initial px-3 py-2 rounded-xl text-xs font-bold bg-primary text-white hover:bg-primary-light cursor-pointer transition-all flex items-center justify-center gap-1 shadow-sm"
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
                {activeAppointment.status !== 'confirmed' && (
                  <AppointmentFlowTimeline appointment={activeAppointment} language={language} isDark={isDark} />
                )}
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

      {/* 1b. Missed appointment — only the most recent no_show, and only
          when there's no active upcoming appointment already shown above
          (once a patient has a new booking, dwelling on the missed one
          adds clutter rather than useful next-step guidance). */}
      {(() => {
        const hasActive = appointmentsList.some((a) => !['cancelled', 'completed', 'no_show'].includes(a.status));
        const missed = !hasActive
          ? appointmentsList.filter((a) => a.status === 'no_show').sort((a, b) => b.date.localeCompare(a.date))[0]
          : null;
        if (!missed) return null;
        return (
          <div className={`p-4 rounded-xl border ${isDark ? 'bg-[#101F31] border-amber-900/50' : 'bg-white border-amber-200'}`}>
            <div className="flex items-center gap-2 mb-2">
              <Clock className="w-4 h-4 text-amber-500" />
              <h3 className="text-xs sm:text-sm font-semibold text-amber-600 dark:text-amber-400">
                {language === 'sw' ? 'Miadi Uliyokosa' : 'Missed Appointment'}
              </h3>
            </div>
            <p className="text-xs text-slate-700 dark:text-slate-200">
              {missed.doctorSpecialty} • {missed.doctorName}
            </p>
            <p className="text-[11px] text-slate-500 dark:text-slate-400">
              {missed.hospitalName} • {missed.date}
            </p>
            <button
              type="button"
              onClick={() => { if (missed.doctorProfileId) setBookingDoctorPreset(missed.doctorProfileId); setActiveModal('appointment'); }}
              className="mt-2.5 px-3 py-2 rounded-xl text-xs font-bold bg-primary text-white hover:bg-primary-light cursor-pointer transition-all inline-flex items-center gap-1"
            >
              <CalendarCheck className="w-3.5 h-3.5" />
              {language === 'sw' ? 'Weka Miadi Nyingine' : 'Book Another Appointment'}
            </button>
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

      {/* 5. Quick Actions — command-style, not a wall of identical icon
          cards: three primary destinations get a real tile each; every
          other action is a dense, scannable row. Every handler below is
          unchanged from the previous per-button JSX — only the layout and
          visual weight changed. */}
      <div
        className={`p-4 rounded-2xl border ${
          isDark ? 'bg-[#101F31] border-slate-700/80' : 'bg-white border-slate-200/90'
        }`}
      >
        <h3 className={`text-xs sm:text-sm font-semibold mb-3 ${isDark ? 'text-white' : 'text-slate-900'}`}>
          {t.quickActions[language]}
        </h3>

        <div className="grid grid-cols-3 gap-2 mb-3">
          {[
            { id: 'appointment', icon: Calendar, label: t.bookAppointment[language], action: () => setActiveModal('appointment') },
            { id: 'records', icon: FileText, label: language === 'sw' ? 'Rekodi za Afya' : 'Health Records', action: () => setActiveModal('records') },
            { id: 'calendar', icon: CalendarDays, label: language === 'sw' ? 'Ziara Zangu' : 'My Visits', action: () => setActiveModal('calendar') },
          ].map((item) => (
            <button
              key={item.id}
              id={`hub-btn-${item.id}`}
              type="button"
              onClick={item.action}
              className={`p-3 rounded-xl border flex flex-col items-center text-center gap-1.5 transition-colors ${
                isDark ? 'bg-[#091422] border-slate-800 hover:border-primary' : 'bg-[#F9FBFE] border-slate-200/80 hover:border-primary'
              }`}
            >
              <div className="w-8 h-8 rounded-lg bg-primary/10 text-primary dark:text-primary-light flex items-center justify-center">
                <item.icon className="w-4 h-4" />
              </div>
              <span className="text-[11px] font-semibold text-slate-900 dark:text-white leading-tight">{item.label}</span>
            </button>
          ))}
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 sm:gap-x-4">
          {[
            { id: 'prescriptions', icon: Pill, label: t.prescriptions[language], action: () => setActiveModal('prescriptions') },
            { id: 'lab-records', icon: FileText, label: t.labResults[language], action: () => setActiveModal('laboratory') },
            { id: 'health-journey', icon: Route, label: language === 'sw' ? 'Safari ya Afya' : 'Health Journey', action: () => setActiveModal('journey') },
            { id: 'facilities', icon: MapPin, label: t.findFacility[language], action: () => setActiveModal('facilities') },
            { id: 'messages', icon: MessageSquare, label: language === 'sw' ? 'Ujumbe' : 'Messages', action: () => setActiveModal('messages') },
            { id: 'checkout', icon: Banknote, label: t.checkoutBilling[language], action: () => setActiveModal('checkout') },
            { id: 'personal-files', icon: FolderLock, label: t.personalFiles[language], action: () => setActiveModal('personal_files') },
            { id: 'insurance', icon: CreditCard, label: t.insuranceCoverage[language], action: () => setActiveModal('insurance') },
            { id: 'referrals', icon: Share2, label: language === 'sw' ? 'Rufaa Zangu' : 'Referrals', action: () => setActiveModal('referrals') },
            { id: 'bodymap', icon: PersonStanding, label: language === 'sw' ? 'Ramani ya Mwili' : 'Body Map', action: () => setActiveModal('bodymap') },
            { id: 'ai-triage', icon: Sparkles, label: t.aiConsult[language], action: () => setActiveModal('ai') },
          ].map((item) => (
            <button
              key={item.id}
              id={`hub-btn-${item.id}`}
              type="button"
              onClick={item.action}
              className="nc-list-row flex items-center gap-2.5 py-2.5 text-left"
            >
              <item.icon className="w-4 h-4 text-slate-400 flex-shrink-0" />
              <span className="text-xs font-medium text-slate-700 dark:text-slate-200 truncate">{item.label}</span>
              <ChevronRight className="w-3.5 h-3.5 text-slate-300 ml-auto flex-shrink-0" />
            </button>
          ))}
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
        onClose={() => { setActiveModal(null); clearBookingPresets(); }}
        language={language}
        theme={theme}
        userCategory={userCategory}
        localData={localData}
        intlData={intlData}
        appointmentsList={appointmentsList}
        setAppointmentsList={setAppointmentsList}
        authUserId={authUserId}
        initialHospitalFilter={bookingHospitalPreset || undefined}
        initialDoctorId={bookingDoctorPreset || undefined}
        initialDate={bookingSlotPreset?.date}
        initialTime={bookingSlotPreset?.time}
        onViewDoctorProfile={(target) => setViewingDoctorProfile(target)}
        onViewFacility={(providerId) => setViewingFacilityProfile({ providerId })}
        onAppointmentBooked={(newApt) => {
          setAppointmentToast(`Miadi imepangwa: ${newApt.doctorName} (${newApt.timeSlot})`);
          setTimeout(() => setAppointmentToast(null), 4000);
          clearBookingPresets();
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
        onOpenImaging={() => setActiveModal('imaging')}
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
      <FacilityMapModal
        isOpen={activeModal === 'facilities'}
        onClose={() => setActiveModal(null)}
        language={language}
        theme={theme}
        onBookAtFacility={handleBookAtFacility}
        onViewFacilityProfile={(facility) => setViewingFacilityProfile({ facility })}
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

      {/* MODAL 11: MESSAGES — real conversations with doctors/facilities the
          patient has an actual care relationship with. */}
      <MessagesModal
        isOpen={activeModal === 'messages'}
        onClose={() => setActiveModal(null)}
        myUserId={authUserId}
        language={language}
        theme={theme}
        onViewDoctorProfile={(target) => setViewingDoctorProfile(target)}
      />

      {/* MODAL 12: REFERRALS */}
      <ReferralsModal
        isOpen={activeModal === 'referrals'}
        onClose={() => setActiveModal(null)}
        patientId={authUserId}
        language={language}
        theme={theme}
      />

      {/* MODAL 13: BODY MAP */}
      <BodyMapModal
        isOpen={activeModal === 'bodymap'}
        onClose={() => setActiveModal(null)}
        patientId={authUserId}
        language={language}
        onViewHealthJourney={() => setActiveModal('journey')}
        initialRegionKey={bodyMapRegionPreset}
      />

      {/* MODAL 14: HEALTH JOURNEY */}
      <HealthJourneyModal
        isOpen={activeModal === 'journey'}
        onClose={() => setActiveModal(null)}
        patientId={authUserId}
        language={language}
        theme={theme}
        appointmentsList={appointmentsList}
        onViewReport={(recordId) => {
          setImagingRecordPreset(recordId);
          setActiveModal('imaging');
        }}
        onViewDoctorProfile={(target) => setViewingDoctorProfile(target)}
        onViewLabResults={() => setActiveModal('laboratory')}
        onBookFollowUp={(entry) => {
          if (entry.doctorProfileId) setBookingDoctorPreset(entry.doctorProfileId);
          setActiveModal('appointment');
        }}
        onViewFacility={(providerId) => setViewingFacilityProfile({ providerId })}
        onViewBodyMap={(regionKey) => {
          setBodyMapRegionPreset(regionKey);
          setActiveModal('bodymap');
        }}
      />

      {/* MODAL 15: CALENDAR */}
      <CalendarModal
        isOpen={activeModal === 'calendar'}
        onClose={() => setActiveModal(null)}
        appointments={appointmentsList}
        language={language}
        theme={theme}
        onViewDoctorProfile={(target) => setViewingDoctorProfile(target)}
      />

      {/* MODAL 16: DOCTOR PROFILE — the one canonical implementation, layered
          above whichever modal it was opened from (z-[60] > their z-50) so
          it can be reached from Doctor Discovery/Booking, Existing
          Appointments, Health Journey, Messages, and now Facility Profile's
          Doctors list without losing that modal's state underneath. */}
      <DoctorProfileModal
        isOpen={!!viewingDoctorProfile}
        onClose={() => setViewingDoctorProfile(null)}
        target={viewingDoctorProfile}
        language={language}
        theme={theme}
        onBookAppointment={(doc, slot) => {
          setBookingDoctorPreset(doc.id);
          setBookingSlotPreset(slot || null);
          setViewingDoctorProfile(null);
          setActiveModal('appointment');
        }}
        onViewFacility={(doc) => {
          if (!doc.providerId) return;
          setViewingDoctorProfile(null);
          setViewingFacilityProfile({ providerId: doc.providerId });
        }}
      />

      {/* MODAL 18: FACILITY PROFILE — reachable from the Facility Map/list
          (a "N doctors · View Facility Profile" link, additive to the
          existing map UI) and from Doctor Profile's "View Facility". Layered
          the same way Doctor Profile is; opening a doctor from here closes
          this and opens Doctor Profile instead of stacking a third layer,
          keeping the existing one-overlay-at-a-time navigation model. */}
      <FacilityProfileModal
        isOpen={!!viewingFacilityProfile}
        onClose={() => setViewingFacilityProfile(null)}
        target={viewingFacilityProfile}
        language={language}
        theme={theme}
        onBookAtFacility={(facilityName) => {
          setViewingFacilityProfile(null);
          handleBookAtFacility(facilityName);
        }}
        onViewDoctorProfile={(target) => {
          setViewingFacilityProfile(null);
          setViewingDoctorProfile(target);
        }}
        onBookDoctor={(doc) => {
          setBookingDoctorPreset(doc.id);
          setBookingHospitalPreset(doc.hospital);
          setViewingFacilityProfile(null);
          setActiveModal('appointment');
        }}
      />

      {/* MODAL 17: IMAGING */}
      <ImagingModal
        isOpen={activeModal === 'imaging'}
        onClose={() => { setActiveModal(null); setImagingRecordPreset(null); }}
        patientId={authUserId}
        language={language}
        theme={theme}
        initialRecordId={imagingRecordPreset}
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
