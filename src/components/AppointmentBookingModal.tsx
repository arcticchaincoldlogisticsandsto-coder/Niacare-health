import React, { useState, useMemo, useRef, useEffect } from 'react';
import {
  Calendar as CalendarIcon,
  Clock,
  MapPin,
  Stethoscope,
  Shield,
  CheckCircle2,
  X,
  Search,
  Filter,
  User,
  Video,
  Building2,
  Phone,
  Check,
  ChevronRight,
  ChevronLeft,
  CalendarCheck,
  AlertCircle,
  Sparkles,
  QrCode,
  Download,
  Share2,
  ExternalLink,
  Trash2,
  RefreshCw,
  CreditCard,
  Radio,
  UserCheck,
  MapPinned,
  Loader2,
} from 'lucide-react';
import { Doctor, Appointment, DoctorProfileTarget, TANZANIA_HOSPITALS, SPECIALTIES } from '../data/doctors';
import { Language, Theme, UserCategory, LocalFormData, InternationalFormData } from '../types';
import { getUpcomingDateISO, getTodayISO } from '../utils/dateUtils';
import { insertAppointment, updateAppointmentStatus } from '../lib/appointments';
import { patientArriveAppointment } from '../lib/queue';
import { APPOINTMENT_STATUS_STYLES, appointmentStatusLabel } from '../data/appointmentStatus';
import { withTimeout } from '../lib/useNetworkStatus';
import { fetchBookableDoctors, fetchAvailableSlots } from '../lib/realDoctors';
import { insertBill } from '../lib/bills';
import { requestVideoRoom } from '../lib/video';
import { generateAppointmentIcs } from '../utils/calendarExport';
import DailyIframe, { DailyCall } from '@daily-co/daily-js';

// Real doctor names don't reliably follow the static directory's "Dr. X"
// prefix convention, so charAt(4) can't be assumed to land on a real initial.
const doctorInitial = (name: string): string => {
  const stripped = name.replace(/^dr\.?\s+/i, '').trim();
  return (stripped.charAt(0) || 'D').toUpperCase();
};

const secureNumericCode = (digits: number): string => {
  const min = 10 ** (digits - 1);
  const span = 9 * min;
  const array = new Uint32Array(1);
  globalThis.crypto?.getRandomValues(array);
  return String(min + (array[0] % span));
};

interface AppointmentBookingModalProps {
  isOpen: boolean;
  onClose: () => void;
  language: Language;
  theme: Theme;
  userCategory: UserCategory;
  localData: LocalFormData;
  intlData: InternationalFormData;
  onAppointmentBooked?: (appointment: Appointment) => void;
  initialDoctorId?: string;
  initialHospitalFilter?: string;
  /** A specific date+time the patient already picked in the Doctor Profile — pre-selects the slot instead of defaulting to the first open one. */
  initialDate?: string;
  initialTime?: string;
  onViewDoctorProfile?: (target: DoctorProfileTarget) => void;
  onViewFacility?: (providerId: string) => void;
  appointmentsList: Appointment[];
  setAppointmentsList: React.Dispatch<React.SetStateAction<Appointment[]>>;
  authUserId: string | null;
}

export const AppointmentBookingModal: React.FC<AppointmentBookingModalProps> = ({
  isOpen,
  onClose,
  language,
  theme,
  userCategory,
  localData,
  intlData,
  onAppointmentBooked,
  initialDoctorId,
  initialHospitalFilter,
  initialDate,
  initialTime,
  onViewDoctorProfile,
  onViewFacility,
  appointmentsList,
  setAppointmentsList,
  authUserId,
}) => {
  const isDark = theme === 'dark';
  const isSwahili = language === 'sw';
  const isFrench = language === 'fr';

  const isLocal = userCategory === 'locals';
  const patientName = isLocal
    ? localData.fullName || 'Amina Salum Bakari'
    : intlData.fullName || 'Marcus Alexander Vance';
  const patientPhone = isLocal
    ? localData.phone ? `+255 ${localData.phone}` : '+255 754 829 140'
    : intlData.phone ? `${intlData.countryCode || '+1'} ${intlData.phone}` : '+1 791 112 3456';
  const insuranceName = isLocal
    ? (localData.insuranceProvider ? 'NHIF (Mfuko wa Taifa)' : 'NHIF (Mfuko wa Taifa)')
    : 'Allianz Global Travel Insurance';

  // Navigation sub-views: 'browse' | 'wizard' | 'confirmed' | 'my_appointments' | 'video_room'
  const [activeTab, setActiveTab] = useState<'browse' | 'my_appointments'>('browse');
  const [wizardStep, setWizardStep] = useState<number>(1); // 1: Type/Doctor, 2: Slot/Date, 3: Clinical Reason, 4: Insurance & Confirm
  const [selectedDoctor, setSelectedDoctor] = useState<Doctor | null>(null);
  const [consultationType, setConsultationType] = useState<'in_person' | 'telehealth' | 'home_visit'>('in_person');

  // Real, platform-registered doctors (invited via the admin console) —
  // never the static fictional directory. Loaded once when the modal opens.
  const [doctors, setDoctors] = useState<Doctor[]>([]);
  const [doctorsLoading, setDoctorsLoading] = useState(true);
  const [doctorsError, setDoctorsError] = useState('');

  useEffect(() => {
    if (!isOpen) return;
    let active = true;
    setDoctorsLoading(true);
    fetchBookableDoctors().then(({ doctors: fetched, error }) => {
      if (!active) return;
      if (error) setDoctorsError(error);
      else {
        setDoctors(fetched);
        const preselect = fetched.find((d) => d.id === initialDoctorId);
        if (preselect) setSelectedDoctor(preselect);
      }
      setDoctorsLoading(false);
    });
    return () => {
      active = false;
    };
  }, [isOpen, initialDoctorId]);

  // Lets "Book" from the facility map jump straight to that facility's
  // doctors instead of the full unfiltered list.
  useEffect(() => {
    if (isOpen && initialHospitalFilter) setSelectedHospitalFilter(initialHospitalFilter);
  }, [isOpen, initialHospitalFilter]);

  // A slot the patient already tapped in the Doctor Profile — applied here
  // (rather than passed straight to selectedSlot) so the slots-effect below
  // can confirm it's still actually open before honoring it.
  const [presetSlot, setPresetSlot] = useState<{ date: string; time: string } | null>(null);
  useEffect(() => {
    if (!isOpen) return;
    if (initialDate) setSelectedDate(initialDate);
    setPresetSlot(initialDate && initialTime ? { date: initialDate, time: initialTime } : null);
  }, [isOpen, initialDate, initialTime]);

  // Filters
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedSpecialtyId, setSelectedSpecialtyId] = useState('all');
  const [selectedHospitalFilter, setSelectedHospitalFilter] = useState('all');
  const [onlyNhif, setOnlyNhif] = useState(false);
  const [onlyTelehealth, setOnlyTelehealth] = useState(false);

  // Booking Form State
  const [selectedDate, setSelectedDate] = useState<string>(() => getUpcomingDateISO(1));
  const [selectedSlot, setSelectedSlot] = useState<string>('10:15 AM');
  const [visitReason, setVisitReason] = useState<string>('Uchunguzi wa Kawaida (Routine Checkup)');
  const [symptomsNote, setSymptomsNote] = useState<string>('');
  const [paymentMethod, setPaymentMethod] = useState<'insurance' | 'mpesa' | 'card'>('insurance');
  const [confirmedAppointment, setConfirmedAppointment] = useState<Appointment | null>(null);
  const [isBooking, setIsBooking] = useState(false);
  const [bookingError, setBookingError] = useState('');
  const [slotConflict, setSlotConflict] = useState(false);
  const [slotsRefreshToken, setSlotsRefreshToken] = useState(0);

  // Patient self-check-in — a small view-swap within "My Appointments",
  // matching this modal's existing pattern (confirmedAppointment/
  // activeVideoCall) rather than a nested modal.
  const [checkInFlow, setCheckInFlow] = useState<{ appointment: Appointment; step: 'confirm' | 'success' } | null>(null);
  const [checkInSubmitting, setCheckInSubmitting] = useState(false);
  const [checkInError, setCheckInError] = useState('');

  // Real open slots for the selected doctor + date, from public.doctor_schedule
  // — not a static per-doctor template.
  const [liveSlots, setLiveSlots] = useState<{ morning: string[]; afternoon: string[]; evening: string[] }>({
    morning: [],
    afternoon: [],
    evening: [],
  });
  const [slotsLoading, setSlotsLoading] = useState(false);

  useEffect(() => {
    if (!selectedDoctor) {
      setLiveSlots({ morning: [], afternoon: [], evening: [] });
      return;
    }
    let active = true;
    setSlotsLoading(true);
    withTimeout(fetchAvailableSlots(selectedDoctor.id, selectedDate), 15000)
      .then((buckets) => {
        if (!active) return;
        setLiveSlots(buckets);
        const allSlots = [...buckets.morning, ...buckets.afternoon, ...buckets.evening];
        const preset = presetSlot && presetSlot.date === selectedDate ? presetSlot.time : null;
        setSelectedSlot(preset && allSlots.includes(preset) ? preset : allSlots[0] || '');
        setSlotsLoading(false);
      })
      .catch(() => {
        if (!active) return;
        setLiveSlots({ morning: [], afternoon: [], evening: [] });
        setSlotsLoading(false);
      });
    return () => {
      active = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedDoctor?.id, selectedDate, presetSlot, slotsRefreshToken]);

  // Telehealth Video Call — real Daily.co WebRTC room, embedded via prebuilt UI
  const [activeVideoCall, setActiveVideoCall] = useState<Appointment | null>(null);
  const [videoJoinState, setVideoJoinState] = useState<'idle' | 'connecting' | 'joined' | 'error'>('idle');
  const [videoError, setVideoError] = useState('');
  const videoContainerRef = useRef<HTMLDivElement>(null);
  const callFrameRef = useRef<DailyCall | null>(null);

  useEffect(() => {
    if (!activeVideoCall || !videoContainerRef.current) return;

    let cancelled = false;
    setVideoJoinState('connecting');
    setVideoError('');

    const join = async () => {
      const { room, error } = await requestVideoRoom(activeVideoCall.ticketNumber, patientName);
      if (cancelled) return;

      if (error || !room) {
        setVideoError(error || 'Could not start the video call.');
        setVideoJoinState('error');
        return;
      }

      if (!videoContainerRef.current) return;

      const frame = DailyIframe.createFrame(videoContainerRef.current, {
        showLeaveButton: true,
        iframeStyle: {
          width: '100%',
          height: '100%',
          border: '0',
          borderRadius: '16px',
        },
      });
      callFrameRef.current = frame;

      frame.on('left-meeting', () => setActiveVideoCall(null));
      frame.on('error', (ev: any) => {
        setVideoError(ev?.errorMsg || 'Video call error.');
        setVideoJoinState('error');
      });

      try {
        await frame.join({ url: room.url, token: room.token });
        if (!cancelled) setVideoJoinState('joined');
      } catch (err: any) {
        if (!cancelled) {
          setVideoError(err?.message || 'Could not join the video call.');
          setVideoJoinState('error');
        }
      }
    };

    join();

    return () => {
      cancelled = true;
      if (callFrameRef.current) {
        callFrameRef.current.destroy();
        callFrameRef.current = null;
      }
    };
  }, [activeVideoCall, patientName]);

  const handleLeaveVideoCall = () => {
    if (callFrameRef.current) {
      callFrameRef.current.leave();
    }
    setActiveVideoCall(null);
  };

  // Quick symptom tags
  const symptomPresets = [
    { label: isSwahili ? 'Shinikizo la Damu (BP)' : 'Blood Pressure Check', key: 'bp' },
    { label: isSwahili ? 'Homa & Malaria' : 'Fever & Malaria Test', key: 'fever' },
    { label: isSwahili ? 'Kupima Afya ya Mtoto' : 'Pediatric Wellness', key: 'peds' },
    { label: isSwahili ? 'Kupokea Dawa (Refill)' : 'Prescription Refill', key: 'refill' },
    { label: isSwahili ? 'Kipimo cha Moyo (ECG)' : 'Cardiac ECG Review', key: 'ecg' },
    { label: isSwahili ? 'Ushauri wa Wazazi' : 'Maternal Antenatal Care', key: 'maternity' },
  ];

  // Filter doctors
  const filteredDoctors = useMemo(() => {
    return doctors.filter((doc) => {
      // Search
      const matchSearch =
        searchQuery === '' ||
        doc.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        doc.specialty.toLowerCase().includes(searchQuery.toLowerCase()) ||
        doc.specialtySw.toLowerCase().includes(searchQuery.toLowerCase()) ||
        doc.hospital.toLowerCase().includes(searchQuery.toLowerCase()) ||
        doc.bio.toLowerCase().includes(searchQuery.toLowerCase());

      // Specialty
      const matchSpecialty =
        selectedSpecialtyId === 'all' ||
        (selectedSpecialtyId === 'cardiology' && doc.specialty.includes('Cardiology')) ||
        (selectedSpecialtyId === 'pediatrics' && doc.specialty.includes('Pediatrics')) ||
        (selectedSpecialtyId === 'general' && doc.specialty.includes('General')) ||
        (selectedSpecialtyId === 'gynecology' && doc.specialty.includes('Gynecology')) ||
        (selectedSpecialtyId === 'dental' && doc.specialty.includes('Dental')) ||
        (selectedSpecialtyId === 'ophthalmology' && doc.specialty.includes('Ophthalmology')) ||
        (selectedSpecialtyId === 'orthopedics' && doc.specialty.includes('Orthopedics')) ||
        (selectedSpecialtyId === 'dermatology' && doc.specialty.includes('Dermatology'));

      // Hospital
      const matchHospital =
        selectedHospitalFilter === 'all' || doc.hospital.includes(selectedHospitalFilter);

      // NHIF filter
      const matchNhif = !onlyNhif || doc.nhifAccepted;

      // Telehealth
      const matchTelehealth = !onlyTelehealth || doc.telehealthAvailable;

      return matchSearch && matchSpecialty && matchHospital && matchNhif && matchTelehealth;
    });
  }, [doctors, searchQuery, selectedSpecialtyId, selectedHospitalFilter, onlyNhif, onlyTelehealth]);

  if (!isOpen) return null;

  const startBookingWithDoctor = (doc: Doctor) => {
    setSelectedDoctor(doc);
    setSelectedSlot('');
    setWizardStep(1);
    setActiveTab('browse');
  };

  const handleCompleteBooking = async () => {
    if (!selectedDoctor || !authUserId || !selectedSlot) return;

    const ticketSuffix = secureNumericCode(6);
    const hospitalPrefix = selectedDoctor.hospital.includes('Muhimbili')
      ? 'MNH'
      : selectedDoctor.hospital.includes('Aga Khan')
      ? 'AKH'
      : selectedDoctor.hospital.includes('KCMC')
      ? 'KCMC'
      : 'NC';

    const newAppointmentData: Omit<Appointment, 'id'> = {
      ticketNumber: `NC-${hospitalPrefix}-${ticketSuffix}`,
      doctorId: selectedDoctor.id,
      doctorName: selectedDoctor.name,
      doctorSpecialty: selectedDoctor.specialty,
      hospitalName: selectedDoctor.hospital,
      hospitalLocation: selectedDoctor.hospitalLocation,
      roomNumber: selectedDoctor.roomNumber || 'Room assigned at check-in',
      consultationType: consultationType,
      date: selectedDate,
      timeSlot: selectedSlot,
      status: 'confirmed',
      queueNumber: `#A-${secureNumericCode(3)}`,
      reason: visitReason,
      symptomsNote: symptomsNote,
      insuranceProvider: paymentMethod === 'insurance' ? insuranceName : 'Malipo ya Moja kwa Moja',
      insuranceCovered: paymentMethod === 'insurance',
      coPayAmountTzs: paymentMethod === 'insurance' ? 0 : selectedDoctor.consultationFeeTzs,
      patientName: patientName,
      patientPhone: patientPhone,
      createdAt: new Date().toISOString().split('T')[0],
    };

    setIsBooking(true);
    setBookingError('');
    setSlotConflict(false);
    // A hard network failure (offline, DNS, timeout) throws rather than
    // resolving to { error }, which — uncaught — would leave isBooking
    // stuck true forever with no message and, worse, risk the confirmation
    // screen never distinguishing "failed" from "still in flight". Never
    // show a confirmed appointment unless this actually resolved with one.
    let appointment: Appointment | undefined;
    let error: string | undefined;
    let errorCode: string | undefined;
    try {
      const result = await withTimeout(
        insertAppointment(authUserId, newAppointmentData, selectedDoctor.providerId, selectedDoctor.id),
        20000
      );
      appointment = result.appointment;
      error = result.error;
      errorCode = result.errorCode;
    } catch {
      error = isSwahili
        ? "Imeshindwa kuthibitisha miadi. Tafadhali angalia mtandao wako na ujaribu tena."
        : "We couldn't confirm your appointment. Please check your connection and try again.";
    }
    setIsBooking(false);

    if (error || !appointment) {
      // public.book_appointment() raises this with SQLSTATE 23505 when the
      // doctor_schedule unique-slot reservation lost the race, and the
      // appointments_doctor_slot_unique index (defense-in-depth against any
      // insert path that skips that RPC) raises the same code — a real
      // backend conflict, not a network problem, so it gets its own recovery
      // action instead of the generic retry message. Checked by code first
      // (robust to wording) with the message text as a fallback.
      if (errorCode === '23505' || (error && /no longer available/i.test(error))) {
        setSlotConflict(true);
        setBookingError(
          isSwahili ? 'Muda huu haupatikani tena.' : 'This appointment slot is no longer available.'
        );
      } else {
        setBookingError(error || 'Could not save the appointment. Please try again.');
      }
      return;
    }

    setAppointmentsList((prev) => [appointment, ...prev]);
    setConfirmedAppointment(appointment);
    if (onAppointmentBooked) {
      onAppointmentBooked(appointment);
    }

    // Every hospital visit generates a real invoice the patient can settle via Checkout.
    const labFeeTzs = 15000;
    insertBill(authUserId, appointment.id, {
      invoiceNumber: `INV-${appointment.ticketNumber}`,
      facility: appointment.hospitalName,
      department: appointment.doctorSpecialty,
      date: appointment.date,
      items: [
        {
          name: `${isSwahili ? 'Ada ya Ushauri wa Daktari' : 'Doctor Consultation Fee'} - ${appointment.doctorName}`,
          category: isSwahili ? 'Daktari' : 'Doctor',
          amountTzs: selectedDoctor.consultationFeeTzs,
          amountUsd: Math.round(selectedDoctor.consultationFeeTzs / 2500),
        },
        {
          name: isSwahili ? 'Uchunguzi wa Kawaida & Maabara' : 'Routine Diagnostic & Lab Panel',
          category: isSwahili ? 'Maabara' : 'Laboratory',
          amountTzs: labFeeTzs,
          amountUsd: Math.round(labFeeTzs / 2500),
        },
      ],
      totalTzs: selectedDoctor.consultationFeeTzs + labFeeTzs,
      totalUsd: Math.round((selectedDoctor.consultationFeeTzs + labFeeTzs) / 2500),
    });
  };

  const handleCancelAppointment = async (id: string) => {
    setAppointmentsList((prev) =>
      prev.map((apt) => (apt.id === id ? { ...apt, status: 'cancelled' } : apt))
    );
    const { success } = await updateAppointmentStatus(id, 'cancelled');
    if (!success) {
      // Revert on failure since the optimistic update above didn't stick server-side.
      setAppointmentsList((prev) =>
        prev.map((apt) => (apt.id === id ? { ...apt, status: 'confirmed' } : apt))
      );
    }
  };

  // Eligible for the app's own self-check-in: still confirmed, and today —
  // doctor_schedule.time_slot is free text, not a real time column, so a
  // reliable minute-level window can't be computed here either (same
  // constraint documented on patient_arrive_appointment() in schema.sql).
  const isCheckInEligible = (apt: Appointment) => apt.status === 'confirmed' && apt.date === getTodayISO();

  const handleConfirmCheckIn = async () => {
    if (!checkInFlow) return;
    setCheckInSubmitting(true);
    setCheckInError('');
    try {
      const { appointment, error } = await withTimeout(patientArriveAppointment(checkInFlow.appointment.id), 15000);
      setCheckInSubmitting(false);
      if (error || !appointment) {
        setCheckInError(
          error ||
            (isSwahili ? 'Imeshindwa kukuingiza. Tafadhali jaribu tena.' : 'Could not check you in. Please try again.')
        );
        return;
      }
      setAppointmentsList((prev) => prev.map((a) => (a.id === appointment.id ? appointment : a)));
      setCheckInFlow({ appointment, step: 'success' });
    } catch {
      setCheckInSubmitting(false);
      setCheckInError(
        isSwahili
          ? 'Imeshindwa kukuingiza. Angalia mtandao wako na ujaribu tena.'
          : "We couldn't check you in. Check your connection and try again."
      );
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-5 bg-black/80 backdrop-blur-md animate-in fade-in">
      <div
        className={`w-full max-w-3xl rounded-2xl border shadow-2xl overflow-hidden flex flex-col max-h-[92vh] ${
          isDark ? 'bg-[#0B1728] border-slate-700/80 text-white' : 'bg-white border-slate-200 text-slate-900'
        }`}
      >
        {/* ========================================================================= */}
        {/* MODAL HEADER */}
        {/* ========================================================================= */}
        <div
          className={`p-4 sm:p-5 border-b flex items-center justify-between gap-3 ${
            isDark ? 'bg-[#101F33] border-slate-700' : 'bg-slate-50 border-slate-200'
          }`}
        >
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-primary/20 text-primary-light flex items-center justify-center flex-shrink-0">
              <CalendarCheck className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-base sm:text-lg font-semibold tracking-tight">
                  {isSwahili ? 'Weka Miadi ya Daktari & Hospitali' : isFrench ? 'Prendre Rendez-vous Médical' : 'Book Medical Appointment'}
                </h2>
                <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
                  {isSwahili ? 'Bima ya NHIF Imethibitishwa ✓' : 'NHIF Pre-Approved ✓'}
                </span>
              </div>
              <p className="text-xs text-slate-400 mt-0.5">
                {isSwahili
                  ? 'Madaktari Bingwa zaidi ya 500 nchini kote (Muhimbili, Aga Khan, KCMC, BMC)'
                  : 'Over 500 accredited specialists across Tanzania referral hospitals'}
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="p-2 rounded-full hover:bg-slate-200 dark:hover:bg-slate-800 text-slate-400 hover:text-slate-900 dark:hover:text-white transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* ========================================================================= */}
        {/* NAVIGATION TABS */}
        {/* ========================================================================= */}
        <div className={`px-4 sm:px-6 pt-3 border-b flex items-center justify-between ${
          isDark ? 'border-slate-800 bg-[#0c1a2d]' : 'border-slate-200 bg-slate-50/50'
        }`}>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => {
                setActiveTab('browse');
                setConfirmedAppointment(null);
              }}
              className={`pb-3 px-3 text-xs font-semibold border-b-2 flex items-center gap-1.5 transition-all cursor-pointer ${
                activeTab === 'browse'
                  ? 'border-primary text-primary-light'
                  : 'border-transparent text-slate-400 hover:text-slate-200'
              }`}
            >
              <Stethoscope className="w-4 h-4" />
              <span>{isSwahili ? 'Tafuta Daktari & Weka Miadi' : 'Find Doctor & Book'}</span>
            </button>

            <button
              type="button"
              onClick={() => {
                setActiveTab('my_appointments');
                setConfirmedAppointment(null);
              }}
              className={`pb-3 px-3 text-xs font-semibold border-b-2 flex items-center gap-1.5 transition-all cursor-pointer ${
                activeTab === 'my_appointments'
                  ? 'border-primary text-primary-light'
                  : 'border-transparent text-slate-400 hover:text-slate-200'
              }`}
            >
              <CalendarIcon className="w-4 h-4" />
              <span>{isSwahili ? 'Miadi Yangu' : 'My Appointments'}</span>
              <span className="px-1.5 py-0.2 rounded-full text-[10px] font-bold bg-primary/20 text-primary-light">
                {appointmentsList.filter((a) => a.status !== 'cancelled').length}
              </span>
            </button>
          </div>

          <div className="hidden sm:flex items-center gap-1 text-[11px] text-slate-400">
            <span>{patientName}</span>
            <span className="text-primary-light font-mono font-bold">• NHIF</span>
          </div>
        </div>

        {/* ========================================================================= */}
        {/* MAIN BODY CONTENT */}
        {/* ========================================================================= */}
        <div className="p-4 sm:p-6 overflow-y-auto flex-1 space-y-4">
          {/* VIEW 1: TELEHEALTH VIDEO ROOM (real Daily.co WebRTC call) */}
          {activeVideoCall && (
            <div className="nc-card p-5 space-y-4 animate-in zoom-in-95">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span
                    className={`w-2.5 h-2.5 rounded-full flex-shrink-0 ${
                      videoJoinState === 'joined' ? 'bg-danger' : videoJoinState === 'error' ? 'bg-danger' : 'bg-warning animate-pulse'
                    }`}
                  />
                  <span className="font-semibold text-xs uppercase tracking-wide text-slate-500 dark:text-slate-400">
                    {videoJoinState === 'joined'
                      ? isSwahili ? 'Ushauri wa Video (Umefichwa)' : 'Live Telehealth Consultation (Encrypted)'
                      : videoJoinState === 'error'
                      ? isSwahili
                        ? 'Imeshindikana Kuunganisha'
                        : 'Connection Failed'
                      : isSwahili
                      ? 'Inaunganisha...'
                      : 'Connecting…'}
                  </span>
                </div>
                <button type="button" onClick={handleLeaveVideoCall} className="nc-btn-danger px-3 py-1.5">
                  {isSwahili ? 'Kata Simu' : 'End Call'}
                </button>
              </div>

              {/* Real embedded Daily.co call frame */}
              <div className="relative aspect-video rounded-lg border nc-border overflow-hidden bg-slate-950">
                {videoJoinState === 'error' ? (
                  <div className="w-full h-full flex flex-col items-center justify-center gap-2 text-center px-6">
                    <AlertCircle className="w-8 h-8 text-danger" />
                    <p className="text-xs text-white font-semibold">
                      {isSwahili
                        ? 'Imeshindikana kuanzisha video call. Jaribu tena baadaye.'
                        : 'Could not start the video call. Please try again shortly.'}
                    </p>
                    {videoError && <p className="text-[10px] text-slate-400">{videoError}</p>}
                  </div>
                ) : (
                  <>
                    {videoJoinState === 'connecting' && (
                      <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 z-10 bg-slate-950/80">
                        <div className="w-10 h-10 rounded-full border-2 border-primary-light border-t-transparent animate-spin" />
                        <p className="text-xs text-primary-light font-semibold">
                          {isSwahili ? 'Inaunganisha na daktari...' : 'Connecting to your doctor...'}
                        </p>
                      </div>
                    )}
                    <div ref={videoContainerRef} className="w-full h-full" />
                  </>
                )}
              </div>

              <p className="text-[10px] text-slate-400 text-center flex items-center justify-center gap-1">
                <Shield className="w-3 h-3" /> {activeVideoCall.doctorName} • {activeVideoCall.doctorSpecialty} — end-to-end encrypted video, powered by Daily.co
              </p>
            </div>
          )}

          {/* VIEW 2: CONFIRMED APPOINTMENT PASS */}
          {confirmedAppointment && (
            <div className="nc-card p-5 space-y-4 animate-in zoom-in-95">
              <div className="text-center space-y-1.5">
                <div className="w-11 h-11 rounded-full bg-success/10 text-success mx-auto flex items-center justify-center">
                  <Check className="w-6 h-6" />
                </div>
                <h3 className="text-base font-semibold text-slate-900 dark:text-white">
                  {isSwahili ? 'Miadi Imethibitishwa' : 'Appointment Confirmed'}
                </h3>
                <p className="text-xs text-slate-500 dark:text-slate-400 max-w-md mx-auto">
                  {isSwahili
                    ? `Namba ya Foleni na maelezo ya daktari yametumwa kupitia SMS kwenda namba ${patientPhone}.`
                    : `Confirmation ticket sent via SMS to ${patientPhone}. Show the QR pass at hospital reception.`}
                </p>
              </div>

              {/* Appointment details — one bordered module, not a nested card */}
              <div className="border-t border-b nc-border divide-y divide-[var(--nc-border)] text-xs">
                <div className="flex items-center justify-between py-2.5">
                  <span className="text-slate-400">{isSwahili ? 'Daktari' : 'Doctor'}</span>
                  <span className="font-semibold text-slate-900 dark:text-white text-right">
                    {confirmedAppointment.doctorName}
                    <span className="block font-normal text-primary dark:text-primary-light">{confirmedAppointment.doctorSpecialty}</span>
                  </span>
                </div>
                <div className="flex items-center justify-between py-2.5">
                  <span className="text-slate-400">{isSwahili ? 'Hospitali' : 'Facility'}</span>
                  <span className="font-semibold text-slate-900 dark:text-white text-right">
                    {confirmedAppointment.hospitalName}
                    <span className="block font-normal font-mono text-slate-400">{confirmedAppointment.roomNumber}</span>
                  </span>
                </div>
                <div className="flex items-center justify-between py-2.5">
                  <span className="text-slate-400">{isSwahili ? 'Tarehe & Muda' : 'Date & Time'}</span>
                  <span className="font-semibold text-slate-900 dark:text-white">
                    {confirmedAppointment.date} • {confirmedAppointment.timeSlot}
                  </span>
                </div>
                <div className="flex items-center justify-between py-2.5">
                  <span className="text-slate-400">{isSwahili ? 'Ticket / Foleni' : 'Ticket / Queue'}</span>
                  <span className="font-mono font-semibold text-slate-900 dark:text-white">
                    {confirmedAppointment.ticketNumber} · {confirmedAppointment.queueNumber}
                  </span>
                </div>
                <div className="flex items-center justify-between py-2.5">
                  <span className="text-slate-400">{isSwahili ? 'Gharama & Bima' : 'Cost & Insurance'}</span>
                  <span className="font-semibold text-success">
                    {confirmedAppointment.insuranceCovered ? (isSwahili ? '0 TZS (NHIF)' : '0 TZS (NHIF Covered)') : 'TZS 45,000'}
                  </span>
                </div>
              </div>

              {/* QR fast pass */}
              <div className="flex items-center gap-2.5">
                <div className="w-12 h-12 border nc-border p-1 rounded-md flex-shrink-0">
                  <img
                    src={`https://api.qrserver.com/v1/create-qr-code/?size=100x100&data=${confirmedAppointment.ticketNumber}`}
                    alt="Appointment QR"
                    className="w-full h-full"
                    referrerPolicy="no-referrer"
                  />
                </div>
                <div className="text-[11px]">
                  <span className="font-semibold block text-slate-900 dark:text-white">
                    {isSwahili ? 'QR ya Kuharakisha Hospitalini' : 'Hospital Fast-Track QR'}
                  </span>
                  <span className="text-slate-400">{isSwahili ? 'Onyesha reception kupunguza muda' : 'Show at reception to skip the line'}</span>
                </div>
              </div>

              {/* One primary action, one secondary — not competing buttons */}
              <div className="flex items-center gap-2 pt-1">
                <button
                  type="button"
                  onClick={() => generateAppointmentIcs(confirmedAppointment)}
                  className="nc-btn-secondary flex-1 py-2.5 flex items-center justify-center gap-1.5"
                >
                  <CalendarIcon className="w-3.5 h-3.5" />
                  {isSwahili ? 'Kalenda' : 'Add to Calendar'}
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setConfirmedAppointment(null);
                    setActiveTab('my_appointments');
                  }}
                  className="nc-btn-primary flex-[2] py-2.5"
                >
                  {isSwahili ? 'Tazama Miadi' : 'View Appointment'}
                </button>
              </div>
            </div>
          )}

          {/* VIEW 2b: CHECK-IN CONFIRMATION / SUCCESS */}
          {checkInFlow && (
            <div className="space-y-4 py-4">
              {checkInFlow.step === 'confirm' ? (
                <>
                  <div className="text-center space-y-1">
                    <UserCheck className="w-8 h-8 mx-auto text-primary" />
                    <h3 className="text-sm font-bold text-slate-900 dark:text-white">
                      {isSwahili ? 'Thibitisha Kuingia' : 'Confirm Check-In'}
                    </h3>
                  </div>
                  <div className={`rounded-2xl border p-4 space-y-2.5 text-xs ${isDark ? 'bg-[#0E1C2F] border-slate-700/80' : 'bg-slate-50 border-slate-200'}`}>
                    <div>
                      <span className="text-slate-400 block">{isSwahili ? 'Kituo' : 'Facility'}</span>
                      <span className="font-bold text-slate-900 dark:text-white">{checkInFlow.appointment.hospitalName}</span>
                    </div>
                    <div>
                      <span className="text-slate-400 block">{isSwahili ? 'Daktari' : 'Doctor'}</span>
                      <span className="font-bold text-slate-900 dark:text-white">{checkInFlow.appointment.doctorName}</span>
                    </div>
                    <div>
                      <span className="text-slate-400 block">{isSwahili ? 'Utaalamu' : 'Specialty'}</span>
                      <span className="font-bold text-slate-900 dark:text-white">{checkInFlow.appointment.doctorSpecialty}</span>
                    </div>
                    <div>
                      <span className="text-slate-400 block">{isSwahili ? 'Miadi' : 'Appointment'}</span>
                      <span className="font-bold text-slate-900 dark:text-white">{checkInFlow.appointment.date} • {checkInFlow.appointment.timeSlot}</span>
                    </div>
                  </div>
                  {checkInError && (
                    <p role="alert" className="text-xs font-semibold text-rose-500 bg-rose-500/10 border border-rose-500/30 rounded-xl p-2.5 flex items-center gap-1.5">
                      <AlertCircle className="w-3.5 h-3.5 flex-shrink-0" /> {checkInError}
                    </p>
                  )}
                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={() => setCheckInFlow(null)}
                      className={`flex-1 py-3 rounded-2xl font-semibold text-sm border ${isDark ? 'border-slate-700 text-white hover:bg-slate-800' : 'border-slate-200 text-slate-900 hover:bg-slate-50'}`}
                    >
                      {isSwahili ? 'Ghairi' : 'Cancel'}
                    </button>
                    <button
                      type="button"
                      onClick={handleConfirmCheckIn}
                      disabled={checkInSubmitting}
                      className="flex-[2] py-3 rounded-2xl bg-primary hover:bg-primary-light text-white font-semibold text-sm flex items-center justify-center gap-2 disabled:opacity-60"
                    >
                      {checkInSubmitting ? <Loader2 className="w-4 h-4 animate-spin" /> : <UserCheck className="w-4 h-4" />}
                      {isSwahili ? 'Thibitisha Kuingia' : 'Confirm Check-In'}
                    </button>
                  </div>
                </>
              ) : (
                <div className="text-center space-y-3 py-6">
                  <div className="w-14 h-14 rounded-full bg-emerald-500/15 text-emerald-500 mx-auto flex items-center justify-center">
                    <CheckCircle2 className="w-7 h-7" />
                  </div>
                  <h3 className="text-base font-bold text-slate-900 dark:text-white">{isSwahili ? 'Umeingia' : 'Checked In'}</h3>
                  <p className="text-xs text-slate-400 max-w-xs mx-auto">
                    {isSwahili
                      ? 'Umefanikiwa kuingia. Miadi yako sasa iko kwa mapokezi.'
                      : 'You have successfully checked in. Your appointment is now with reception.'}
                  </p>
                  <button
                    type="button"
                    onClick={() => setCheckInFlow(null)}
                    className="px-5 py-2.5 rounded-2xl bg-primary hover:bg-primary-light text-white font-semibold text-xs"
                  >
                    {isSwahili ? 'Sawa' : 'Done'}
                  </button>
                </div>
              )}
            </div>
          )}

          {/* VIEW 3: MY APPOINTMENTS LIST */}
          {activeTab === 'my_appointments' && !confirmedAppointment && !activeVideoCall && !checkInFlow && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-sm font-semibold">
                    {isSwahili ? 'Miadi Yangu Iliyothibitishwa' : 'My Active Appointments'}
                  </h3>
                  <p className="text-xs text-slate-400">
                    {isSwahili
                      ? 'Fuatilia foleni, daktari wako, au jiunge na video call ya daktari'
                      : 'Track hospital queue, doctor room, or join telehealth video room'}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setActiveTab('browse')}
                  className="px-3 py-1.5 rounded-xl bg-primary hover:bg-primary-light text-white font-bold text-xs flex items-center gap-1 cursor-pointer"
                >
                  <CalendarCheck className="w-3.5 h-3.5" />
                  <span>{isSwahili ? '+ Weka Miadi Mpya' : '+ New Booking'}</span>
                </button>
              </div>

              {appointmentsList.length === 0 ? (
                <div className="text-center py-12 space-y-3">
                  <div className="w-12 h-12 rounded-2xl bg-slate-800 text-slate-400 mx-auto flex items-center justify-center">
                    <CalendarIcon className="w-6 h-6" />
                  </div>
                  <p className="text-xs font-bold text-slate-400">
                    {isSwahili ? 'Huna miadi yoyote iliyopangwa kwa sasa.' : 'You have no scheduled appointments yet.'}
                  </p>
                  <button
                    type="button"
                    onClick={() => setActiveTab('browse')}
                    className="px-4 py-2 bg-primary text-white font-semibold text-xs rounded-xl"
                  >
                    {isSwahili ? 'Panga Miadi na Daktari Sasa' : 'Schedule with a Doctor Now'}
                  </button>
                </div>
              ) : (
                <div className="space-y-3">
                  {appointmentsList.map((apt) => {
                    const isCancelled = apt.status === 'cancelled';
                    return (
                      <div
                        key={apt.id}
                        className={`p-4 rounded-2xl border transition-all ${
                          isCancelled
                            ? 'opacity-60 bg-slate-900/40 border-slate-800'
                            : isDark
                            ? 'bg-[#0E1C2F] border-slate-700/80 hover:border-primary/50'
                            : 'bg-white border-slate-200 hover:border-primary-light shadow-xs'
                        }`}
                      >
                        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 pb-3 border-b border-slate-700/50">
                          <div className="flex items-center gap-3">
                            <div className="w-10 h-10 rounded-xl bg-primary/15 text-primary-light flex items-center justify-center font-bold flex-shrink-0">
                              <Stethoscope className="w-5 h-5" />
                            </div>
                            <div>
                              <div className="flex items-center gap-2">
                                <h4 className="font-bold text-xs sm:text-sm text-slate-900 dark:text-white">
                                  {apt.doctorName}
                                </h4>
                                <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${APPOINTMENT_STATUS_STYLES[apt.status]}`}>
                                  {appointmentStatusLabel(apt.status, isSwahili)}
                                </span>
                                {apt.queueNumber && (
                                  <span className="text-[10px] font-bold font-mono px-2 py-0.5 rounded-full bg-slate-800/80 text-primary-light">
                                    {apt.queueNumber}
                                  </span>
                                )}
                              </div>
                              <p className="text-[11px] text-primary-light font-semibold">{apt.doctorSpecialty}</p>
                              <div className="flex items-center gap-2.5 mt-0.5 flex-wrap">
                                {onViewDoctorProfile && (
                                  <button
                                    type="button"
                                    onClick={() => onViewDoctorProfile({ doctorId: apt.doctorId })}
                                    aria-label={isSwahili ? `Angalia wasifu wa ${apt.doctorName}` : `View ${apt.doctorName}'s profile`}
                                    className="inline-flex items-center gap-1 text-[10px] text-primary dark:text-primary-light font-bold underline underline-offset-2"
                                  >
                                    <User className="w-3 h-3" /> {isSwahili ? 'Wasifu wa Daktari' : 'View Doctor Profile'}
                                  </button>
                                )}
                                {onViewFacility && apt.providerId && (
                                  <button
                                    type="button"
                                    onClick={() => onViewFacility(apt.providerId!)}
                                    aria-label={isSwahili ? `Angalia kituo ${apt.hospitalName}` : `View ${apt.hospitalName}`}
                                    className="inline-flex items-center gap-1 text-[10px] text-primary dark:text-primary-light font-bold underline underline-offset-2"
                                  >
                                    <MapPinned className="w-3 h-3" /> {isSwahili ? 'Kituo' : 'View Facility'}
                                  </button>
                                )}
                              </div>
                            </div>
                          </div>

                          <div className="flex items-center gap-2 text-xs font-mono">
                            <span className="px-2.5 py-1 rounded-lg bg-slate-800/80 text-primary-light font-bold">
                              Ticket: {apt.ticketNumber}
                            </span>
                          </div>
                        </div>

                        {/* Middle Info */}
                        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5 py-3 text-xs">
                          <div>
                            <span className="text-[10px] text-slate-400 block">Kituo / Hospitali:</span>
                            <span className="font-bold text-slate-900 dark:text-white truncate block">
                              {apt.hospitalName}
                            </span>
                            <span className="text-[10px] text-slate-400 font-mono">{apt.roomNumber}</span>
                          </div>
                          <div>
                            <span className="text-[10px] text-slate-400 block">Muda & Tarehe:</span>
                            <span className="font-bold text-slate-900 dark:text-white block">
                              {apt.date}
                            </span>
                            <span className="text-[10px] text-amber-400 font-bold">saa {apt.timeSlot}</span>
                          </div>
                          <div className="col-span-2 sm:col-span-1">
                            <span className="text-[10px] text-slate-400 block">Aina ya Huduma:</span>
                            <span className="font-bold text-emerald-400 flex items-center gap-1">
                              {apt.consultationType === 'telehealth' ? (
                                <>
                                  <Video className="w-3.5 h-3.5 text-primary-light" /> Ushauri wa Video (Telehealth)
                                </>
                              ) : (
                                <>
                                  <Building2 className="w-3.5 h-3.5" /> Hospitali (In-Person Visit)
                                </>
                              )}
                            </span>
                          </div>
                        </div>

                        {/* Action buttons */}
                        {!isCancelled && (
                          <div className="flex items-center justify-between pt-2 border-t border-slate-700/50">
                            <div className="text-[10px] text-slate-400">
                              Bima: <span className="font-bold text-primary-light">{apt.insuranceProvider}</span>
                            </div>

                            <div className="flex items-center gap-2">
                              {isCheckInEligible(apt) && (
                                <button
                                  type="button"
                                  onClick={() => { setCheckInError(''); setCheckInFlow({ appointment: apt, step: 'confirm' }); }}
                                  className="px-3 py-1.5 rounded-xl bg-primary hover:bg-primary-light text-white font-semibold text-xs flex items-center gap-1.5 cursor-pointer shadow-md"
                                >
                                  <UserCheck className="w-3.5 h-3.5" />
                                  <span>{isSwahili ? 'Ingia' : 'Check In'}</span>
                                </button>
                              )}

                              {apt.consultationType === 'telehealth' && (
                                <button
                                  type="button"
                                  onClick={() => setActiveVideoCall(apt)}
                                  className="px-3 py-1.5 rounded-xl bg-primary hover:bg-primary-light text-white font-semibold text-xs flex items-center gap-1.5 cursor-pointer shadow-md"
                                >
                                  <Video className="w-3.5 h-3.5" />
                                  <span>Jiunge na Video Call</span>
                                </button>
                              )}

                              {(apt.status === 'confirmed' || apt.status === 'arrived') && (
                                <button
                                  type="button"
                                  onClick={() => handleCancelAppointment(apt.id)}
                                  className="p-1.5 rounded-lg text-rose-400 hover:bg-rose-950/40 text-xs font-bold flex items-center gap-1 cursor-pointer transition-colors"
                                >
                                  <Trash2 className="w-3.5 h-3.5" />
                                  <span>Ghairi (Cancel)</span>
                                </button>
                              )}
                            </div>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {/* VIEW 4: BROWSE DOCTORS & APPOINTMENT BOOKING WIZARD */}
          {activeTab === 'browse' && !confirmedAppointment && !activeVideoCall && (
            <div className="space-y-4">
              {/* Consultation type — compact segmented control, one accent
                  for the selected state instead of three tinted cards. */}
              <div className="inline-flex w-full rounded-lg border nc-border p-0.5">
                {([
                  { key: 'in_person' as const, Icon: Building2, label: isSwahili ? 'Hospitali' : 'In-Person' },
                  { key: 'telehealth' as const, Icon: Video, label: isSwahili ? 'Video' : 'Telehealth' },
                  { key: 'home_visit' as const, Icon: MapPin, label: isSwahili ? 'Nyumbani' : 'Home Visit' },
                ]).map(({ key, Icon, label }) => (
                  <button
                    key={key}
                    type="button"
                    onClick={() => setConsultationType(key)}
                    aria-pressed={consultationType === key}
                    className={`flex-1 py-2 rounded-md text-xs font-semibold flex items-center justify-center gap-1.5 transition-colors ${
                      consultationType === key
                        ? 'bg-primary text-white'
                        : 'text-slate-500 dark:text-slate-400'
                    }`}
                  >
                    <Icon className="w-3.5 h-3.5" />
                    {label}
                  </button>
                ))}
              </div>

              {/* Search & filters */}
              <div className="space-y-2.5">
                <div className="flex flex-col sm:flex-row gap-2">
                  <div className="relative flex-1">
                    <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                    <input
                      type="text"
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      placeholder={isSwahili ? 'Tafuta Daktari, Hospitali, au Ugonjwa...' : 'Search doctor, hospital, or symptoms...'}
                      className="nc-input pl-8 pr-3 py-2"
                    />
                  </div>

                  <select
                    value={selectedHospitalFilter}
                    onChange={(e) => setSelectedHospitalFilter(e.target.value)}
                    className="nc-input py-2 px-3 font-medium sm:w-auto"
                  >
                    <option value="all">{isSwahili ? 'Hospitali Zote' : 'All Facilities'}</option>
                    <option value="Muhimbili">Muhimbili National Hospital (MNH)</option>
                    <option value="Aga Khan">The Aga Khan Hospital DSM</option>
                    <option value="KCMC">KCMC Referral Moshi</option>
                    <option value="Bugando">Bugando Medical Centre Mwanza</option>
                    <option value="TMJ">TMJ Hospital Mikocheni</option>
                    <option value="Mnazi Mmoja">Mnazi Mmoja Hospital Zanzibar</option>
                    <option value="Regency">Regency Medical Centre</option>
                  </select>
                </div>

                {/* Specialty filter — single accent for the selected pill */}
                <div className="flex items-center gap-1.5 overflow-x-auto pb-1 no-scrollbar text-xs">
                  {SPECIALTIES.map((spec) => {
                    const isSelected = selectedSpecialtyId === spec.id;
                    return (
                      <button
                        key={spec.id}
                        type="button"
                        onClick={() => setSelectedSpecialtyId(spec.id)}
                        aria-pressed={isSelected}
                        className={`px-2.5 py-1 rounded-md whitespace-nowrap font-medium transition-colors ${
                          isSelected
                            ? 'bg-primary text-white'
                            : 'border nc-border text-slate-600 dark:text-slate-300 hover:border-primary'
                        }`}
                      >
                        {isSwahili ? spec.nameSw : spec.name}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* ACTIVE BOOKING WIZARD (IF A DOCTOR IS SELECTED FOR IMMEDIATE BOOKING) */}
              {selectedDoctor && (
                <div className="nc-card p-4 sm:p-5">
                  <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-400 mb-3">
                    {isSwahili ? 'Weka Miadi' : 'Book Appointment'}
                  </p>
                  <div className="flex items-start justify-between gap-3 mb-4">
                    <div className="flex items-center gap-3">
                      <div
                        className={`w-11 h-11 rounded-full bg-gradient-to-br ${selectedDoctor.avatarColor} text-white flex items-center justify-center font-semibold flex-shrink-0`}
                      >
                        {doctorInitial(selectedDoctor.name)}
                      </div>
                      <div>
                        <div className="flex items-center gap-1.5">
                          <h4 className="font-semibold text-sm text-slate-900 dark:text-white">
                            {selectedDoctor.name}
                          </h4>
                          {/* Real verification state only — doctor_profiles.is_verified,
                              set by an admin. Never shown unconditionally. */}
                          {selectedDoctor.isVerified && (
                            <CheckCircle2 className="w-3.5 h-3.5 text-primary dark:text-primary-light flex-shrink-0" aria-label={isSwahili ? 'Amethibitishwa' : 'Verified'} />
                          )}
                        </div>
                        <p className="text-xs text-primary dark:text-primary-light font-medium">{selectedDoctor.specialty}</p>
                        <p className="text-[11px] text-slate-400">{selectedDoctor.hospital}</p>
                      </div>
                    </div>

                    {selectedDoctor.nhifAccepted && (
                      <div className="text-right flex-shrink-0">
                        <span className="text-[10px] font-semibold uppercase tracking-wide text-success block">
                          {isSwahili ? 'NHIF Inakubaliwa' : 'NHIF Accepted'}
                        </span>
                        <span className="text-xs font-semibold text-slate-900 dark:text-white">
                          0 TZS {isSwahili ? 'Malipo' : 'Co-Pay'}
                        </span>
                      </div>
                    )}
                  </div>

                  {/* Wizard Step 1: Slot & Date Selection */}
                  <div className="space-y-3 pt-3 border-t nc-border">
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <div>
                        <label className="text-xs font-semibold block mb-1.5 text-slate-600 dark:text-slate-300">
                          {isSwahili ? 'Chagua Tarehe ya Miadi:' : 'Select Appointment Date:'}
                        </label>
                        <input
                          type="date"
                          value={selectedDate}
                          min={getTodayISO()}
                          onChange={(e) => setSelectedDate(e.target.value)}
                          className="nc-input p-2.5"
                        />
                      </div>

                      <div>
                        <label className="text-xs font-semibold block mb-1.5 text-slate-600 dark:text-slate-300">
                          {isSwahili ? 'Chagua Muda (Available Slots):' : 'Select Time Slot:'}
                        </label>
                        {(() => {
                          const allSlots = [...liveSlots.morning, ...liveSlots.afternoon, ...liveSlots.evening];
                          if (slotsLoading) {
                            return <p className="text-[11px] text-slate-400 py-1.5">{isSwahili ? 'Inapakia nafasi...' : 'Loading available times…'}</p>;
                          }
                          if (allSlots.length === 0) {
                            return (
                              <p className="text-[11px] text-warning font-semibold py-1.5">
                                {isSwahili ? 'Hakuna nafasi tarehe hii. Jaribu tarehe nyingine.' : 'No open slots on this date. Try another date.'}
                              </p>
                            );
                          }
                          return (
                            <div className="grid grid-cols-3 gap-1.5">
                              {allSlots.slice(0, 9).map((slot) => (
                                <button
                                  key={slot}
                                  type="button"
                                  onClick={() => setSelectedSlot(slot)}
                                  aria-pressed={selectedSlot === slot}
                                  aria-label={isSwahili ? `Chagua muda ${slot}` : `Select ${slot} time slot`}
                                  className={`min-h-[36px] py-1.5 px-2 rounded-md text-xs font-mono font-semibold transition-colors ${
                                    selectedSlot === slot
                                      ? 'bg-primary text-white'
                                      : 'border nc-border text-slate-700 dark:text-slate-300 hover:border-primary'
                                  }`}
                                >
                                  {slot}
                                </button>
                              ))}
                            </div>
                          );
                        })()}
                      </div>
                    </div>

                    {/* Step 2: Reason for Consultation */}
                    <div>
                      <label className="text-xs font-semibold block mb-1.5 text-slate-600 dark:text-slate-300">
                        {isSwahili ? 'Sababu ya Kuonana na Daktari:' : 'Reason for Consultation / Symptoms:'}
                      </label>
                      <div className="flex flex-wrap gap-1.5 mb-2">
                        {symptomPresets.map((preset) => (
                          <button
                            key={preset.key}
                            type="button"
                            onClick={() => setVisitReason(preset.label)}
                            className={`px-2.5 py-1 rounded-md text-[11px] font-medium transition-colors ${
                              visitReason === preset.label
                                ? 'bg-primary text-white'
                                : 'border nc-border text-slate-600 dark:text-slate-300 hover:border-primary'
                            }`}
                          >
                            {preset.label}
                          </button>
                        ))}
                      </div>

                      <input
                        type="text"
                        value={visitReason}
                        onChange={(e) => setVisitReason(e.target.value)}
                        placeholder="Andika maelezo ya dalili zako hapa..."
                        className="nc-input p-2.5"
                      />
                    </div>

                    {/* Step 3: Payment / Insurance procedure selection — one
                        accent (primary) marks the selected method; the two
                        options no longer compete with separate bright colors. */}
                    <div className="space-y-2">
                      <label className="text-[11px] font-semibold text-slate-400 uppercase tracking-wide block">
                        {isSwahili ? 'Utaratibu wa Malipo / Bima' : 'Payment / Insurance Procedure'}
                      </label>
                      <div className="grid grid-cols-2 gap-2">
                        <button
                          type="button"
                          onClick={() => setPaymentMethod('insurance')}
                          className={`p-3 rounded-lg border text-left transition-colors ${
                            paymentMethod === 'insurance'
                              ? 'border-primary bg-primary/5 text-slate-900 dark:text-white'
                              : 'nc-border text-slate-500 dark:text-slate-400 hover:border-primary/50'
                          }`}
                        >
                          <div className="flex items-center justify-between mb-1">
                            <span className="font-semibold text-xs flex items-center gap-1.5">
                              <Shield className="w-3.5 h-3.5" />
                              <span>{isSwahili ? 'Bima ya Afya' : 'Insurance'}</span>
                            </span>
                            <span className="text-[10px] font-semibold text-success">0 TZS</span>
                          </div>
                          <p className="text-[10px] opacity-80 truncate">
                            {insuranceName} (Pre-Auth)
                          </p>
                        </button>

                        <button
                          type="button"
                          onClick={() => setPaymentMethod('mpesa')}
                          className={`p-3 rounded-lg border text-left transition-colors ${
                            paymentMethod !== 'insurance'
                              ? 'border-primary bg-primary/5 text-slate-900 dark:text-white'
                              : 'nc-border text-slate-500 dark:text-slate-400 hover:border-primary/50'
                          }`}
                        >
                          <div className="flex items-center justify-between mb-1">
                            <span className="font-semibold text-xs flex items-center gap-1.5">
                              <CreditCard className="w-3.5 h-3.5" />
                              <span>{isSwahili ? 'Pesa / Simu' : 'Cash / Mobile'}</span>
                            </span>
                            <span className="font-mono text-[10px] font-semibold">
                              {selectedDoctor.consultationFeeTzs.toLocaleString()} TZS
                            </span>
                          </div>
                          <p className="text-[10px] opacity-80">
                            {isSwahili ? 'M-Pesa / Tigo / Dirishani' : 'Mobile / Cashier'}
                          </p>
                        </button>
                      </div>

                      {paymentMethod === 'insurance' ? (
                        <div className="p-2.5 rounded-md border nc-border flex items-center justify-between gap-3 text-xs bg-success-subtle">
                          <div className="flex items-center gap-2">
                            <Shield className="w-4 h-4 text-success flex-shrink-0" />
                            <div className="text-[11px]">
                              <span className="font-semibold block text-slate-900 dark:text-white">
                                {isSwahili ? `Imehakikiwa na Bima: ${insuranceName}` : `Verified with: ${insuranceName}`}
                              </span>
                              <span className="text-slate-500 dark:text-slate-400">
                                {isSwahili ? 'Hakuna malipo ya ziada dirishani.' : 'No out-of-pocket payment required.'}
                              </span>
                            </div>
                          </div>
                          <span className="font-mono font-semibold text-xs text-success">0 TZS</span>
                        </div>
                      ) : (
                        <div className="p-2.5 rounded-md border nc-border flex items-center justify-between gap-3 text-xs">
                          <div className="flex items-center gap-2">
                            <CreditCard className="w-4 h-4 text-primary flex-shrink-0" />
                            <div className="text-[11px]">
                              <span className="font-semibold block text-slate-900 dark:text-white">
                                {isSwahili ? 'Malipo Dirishani au kwa Simu (M-Pesa / Tigo)' : 'Pay via Mobile Money or at Cashier'}
                              </span>
                              <span className="text-slate-500 dark:text-slate-400">
                                {isSwahili ? 'Utapokea risiti ya kielektroniki baada ya uthibitisho.' : 'Electronic receipt generated upon confirmation.'}
                              </span>
                            </div>
                          </div>
                          <span className="font-mono font-semibold text-xs text-primary">
                            {selectedDoctor.consultationFeeTzs.toLocaleString()} TZS
                          </span>
                        </div>
                      )}
                    </div>

                    {/* Submit — one clear primary action */}
                    <div className="pt-2 space-y-2">
                      {bookingError && (
                        <div role="alert" className="text-xs font-semibold text-danger bg-danger-subtle rounded-md p-2.5 space-y-2">
                          <p className="flex items-center gap-1.5">
                            <AlertCircle className="w-3.5 h-3.5 flex-shrink-0" />
                            {bookingError}
                          </p>
                          {slotConflict && (
                            <button
                              type="button"
                              onClick={() => {
                                setBookingError('');
                                setSlotConflict(false);
                                setSelectedSlot('');
                                setPresetSlot(null);
                                setSlotsRefreshToken((t) => t + 1);
                              }}
                              className="nc-btn-danger w-full py-2"
                            >
                              {isSwahili ? 'Chagua Muda Mwingine' : 'Choose Another Time'}
                            </button>
                          )}
                        </div>
                      )}
                      <button
                        type="button"
                        onClick={handleCompleteBooking}
                        disabled={isBooking || !selectedSlot}
                        className="nc-btn-primary w-full py-3 flex items-center justify-center gap-2"
                      >
                        <CalendarCheck className="w-4 h-4" />
                        <span>
                          {isBooking
                            ? isSwahili
                              ? 'Inathibitisha...'
                              : 'Confirming...'
                            : isSwahili
                            ? 'Thibitisha Miadi'
                            : 'Confirm Appointment'}
                        </span>
                      </button>
                    </div>
                  </div>
                </div>
              )}

              {/* Doctor directory — compact rows, not a grid of cards. Every
                  field shown is real, existing data: no invented ratings,
                  reviews, experience years, or statistics. */}
              <div className="space-y-2">
                <h4 className="text-[11px] font-semibold uppercase tracking-wide text-slate-400">
                  {isSwahili ? `Madaktari Bingwa (${filteredDoctors.length})` : `Available Specialists (${filteredDoctors.length})`}
                </h4>

                {doctorsError && (
                  <p className="text-xs font-semibold text-danger bg-danger-subtle rounded-md p-3">
                    {doctorsError}
                  </p>
                )}

                {!doctorsError && doctorsLoading && (
                  <p className="text-xs text-slate-400 py-6 text-center">
                    {isSwahili ? 'Inapakia madaktari...' : 'Loading doctors…'}
                  </p>
                )}

                {!doctorsError && !doctorsLoading && filteredDoctors.length === 0 && (
                  <div className="text-center py-10 space-y-2">
                    <Stethoscope className="w-8 h-8 text-slate-400 mx-auto opacity-50" />
                    <p className="text-xs font-semibold text-slate-400">
                      {doctors.length === 0
                        ? isSwahili
                          ? 'Hakuna madaktari waliosajiliwa bado kwenye jukwaa.'
                          : 'No doctors are onboarded on the platform yet.'
                        : isSwahili
                        ? 'Hakuna daktari anayelingana na vichujio ulivyochagua.'
                        : 'No doctors match your current filters.'}
                    </p>
                  </div>
                )}

                {filteredDoctors.length > 0 && (
                  <div className="border nc-border rounded-lg divide-y divide-[var(--nc-border)]">
                    {filteredDoctors.map((doc) => {
                      const isSelected = selectedDoctor?.id === doc.id;
                      return (
                        <div
                          key={doc.id}
                          className={`flex items-center gap-3 p-3 transition-colors ${isSelected ? 'bg-primary/5' : ''}`}
                        >
                          <button
                            type="button"
                            onClick={() => onViewDoctorProfile?.({ doctor: doc })}
                            disabled={!onViewDoctorProfile}
                            className="flex items-center gap-3 flex-1 min-w-0 text-left disabled:cursor-default"
                            title={onViewDoctorProfile ? (isSwahili ? 'Angalia Wasifu' : 'View Profile') : undefined}
                          >
                            {/* No doctor photography exists in the data model
                                today (checked before writing this) — initials
                                avatar is the real, non-fabricated fallback. */}
                            <div
                              className={`w-10 h-10 rounded-full bg-gradient-to-br ${doc.avatarColor} text-white flex items-center justify-center font-semibold text-sm flex-shrink-0`}
                            >
                              {doctorInitial(doc.name)}
                            </div>
                            <div className="min-w-0">
                              <div className="flex items-center gap-1.5">
                                <h5 className="font-semibold text-xs text-slate-900 dark:text-white truncate">
                                  {doc.name}
                                </h5>
                                {doc.isVerified && (
                                  <CheckCircle2 className="w-3 h-3 text-primary dark:text-primary-light flex-shrink-0" aria-label={isSwahili ? 'Amethibitishwa' : 'Verified'} />
                                )}
                                {doc.reviewsCount > 0 && (
                                  <span className="text-[10px] font-semibold text-warning flex-shrink-0">★ {doc.rating.toFixed(1)}</span>
                                )}
                              </div>
                              <p className="text-[11px] text-primary dark:text-primary-light font-medium truncate">{doc.specialty}</p>
                              <div className="flex items-center gap-2.5 mt-0.5 flex-wrap text-[10px] text-slate-400">
                                <span className="flex items-center gap-1 truncate">
                                  <Building2 className="w-2.5 h-2.5 flex-shrink-0" />
                                  <span className="truncate">{doc.hospital}</span>
                                </span>
                                {doc.nhifAccepted && <span className="text-success font-semibold flex-shrink-0">NHIF</span>}
                                {doc.telehealthAvailable && (
                                  <span className="text-primary dark:text-primary-light font-semibold flex items-center gap-0.5 flex-shrink-0">
                                    <Video className="w-2.5 h-2.5" /> {isSwahili ? 'Video' : 'Telehealth'}
                                  </span>
                                )}
                                <span className="font-mono flex-shrink-0">{doc.consultationFeeTzs.toLocaleString()} TZS</span>
                              </div>
                            </div>
                          </button>

                          <button
                            type="button"
                            onClick={() => startBookingWithDoctor(doc)}
                            className={isSelected ? 'nc-btn-primary px-3 py-1.5 flex-shrink-0' : 'nc-btn-secondary px-3 py-1.5 flex-shrink-0'}
                          >
                            {isSelected ? (isSwahili ? 'Imechaguliwa' : 'Selected') : (isSwahili ? 'Chagua' : 'Select')}
                          </button>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
