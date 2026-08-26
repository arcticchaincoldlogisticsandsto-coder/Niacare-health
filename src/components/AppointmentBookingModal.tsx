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
} from 'lucide-react';
import { Doctor, Appointment, TANZANIA_HOSPITALS, SPECIALTIES } from '../data/doctors';
import { Language, Theme, UserCategory, LocalFormData, InternationalFormData } from '../types';
import { getUpcomingDateISO, getTodayISO } from '../utils/dateUtils';
import { insertAppointment, updateAppointmentStatus } from '../lib/appointments';
import { fetchBookableDoctors, fetchAvailableSlots } from '../lib/realDoctors';
import { insertBill } from '../lib/bills';
import { requestVideoRoom } from '../lib/video';
import DailyIframe, { DailyCall } from '@daily-co/daily-js';

// Real doctor names don't reliably follow the static directory's "Dr. X"
// prefix convention, so charAt(4) can't be assumed to land on a real initial.
const doctorInitial = (name: string): string => {
  const stripped = name.replace(/^dr\.?\s+/i, '').trim();
  return (stripped.charAt(0) || 'D').toUpperCase();
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
    fetchAvailableSlots(selectedDoctor.id, selectedDate).then((buckets) => {
      if (!active) return;
      setLiveSlots(buckets);
      const firstAvailable = buckets.morning[0] || buckets.afternoon[0] || buckets.evening[0] || '';
      setSelectedSlot(firstAvailable);
      setSlotsLoading(false);
    });
    return () => {
      active = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedDoctor?.id, selectedDate]);

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

    const randomTicketSuffix = Math.floor(1000 + Math.random() * 9000);
    const hospitalPrefix = selectedDoctor.hospital.includes('Muhimbili')
      ? 'MNH'
      : selectedDoctor.hospital.includes('Aga Khan')
      ? 'AKH'
      : selectedDoctor.hospital.includes('KCMC')
      ? 'KCMC'
      : 'NC';

    const newAppointmentData: Omit<Appointment, 'id'> = {
      ticketNumber: `NC-${hospitalPrefix}-${randomTicketSuffix}`,
      doctorId: selectedDoctor.id,
      doctorName: selectedDoctor.name,
      doctorSpecialty: selectedDoctor.specialty,
      hospitalName: selectedDoctor.hospital,
      hospitalLocation: selectedDoctor.hospitalLocation,
      roomNumber: `Chumba Na. ${Math.floor(100 + Math.random() * 300)} (Ghorofa ya 1)`,
      consultationType: consultationType,
      date: selectedDate,
      timeSlot: selectedSlot,
      status: 'confirmed',
      queueNumber: `#A-${Math.floor(10 + Math.random() * 90)}`,
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
    const { appointment, error } = await insertAppointment(
      authUserId,
      newAppointmentData,
      selectedDoctor.providerId,
      selectedDoctor.id
    );
    setIsBooking(false);

    if (error || !appointment) {
      setBookingError(error || 'Could not save the appointment. Please try again.');
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
            <div className="w-10 h-10 rounded-2xl bg-cyan-500/20 text-cyan-400 flex items-center justify-center flex-shrink-0">
              <CalendarCheck className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-base sm:text-lg font-black tracking-tight">
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
              className={`pb-3 px-3 text-xs font-black border-b-2 flex items-center gap-1.5 transition-all cursor-pointer ${
                activeTab === 'browse'
                  ? 'border-cyan-500 text-cyan-400'
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
              className={`pb-3 px-3 text-xs font-black border-b-2 flex items-center gap-1.5 transition-all cursor-pointer ${
                activeTab === 'my_appointments'
                  ? 'border-cyan-500 text-cyan-400'
                  : 'border-transparent text-slate-400 hover:text-slate-200'
              }`}
            >
              <CalendarIcon className="w-4 h-4" />
              <span>{isSwahili ? 'Miadi Yangu' : 'My Appointments'}</span>
              <span className="px-1.5 py-0.2 rounded-full text-[10px] font-bold bg-cyan-500/20 text-cyan-300">
                {appointmentsList.filter((a) => a.status !== 'cancelled').length}
              </span>
            </button>
          </div>

          <div className="hidden sm:flex items-center gap-1 text-[11px] text-slate-400">
            <span>{patientName}</span>
            <span className="text-cyan-400 font-mono font-bold">• NHIF</span>
          </div>
        </div>

        {/* ========================================================================= */}
        {/* MAIN BODY CONTENT */}
        {/* ========================================================================= */}
        <div className="p-4 sm:p-6 overflow-y-auto flex-1 space-y-4">
          {/* VIEW 1: TELEHEALTH VIDEO ROOM (real Daily.co WebRTC call) */}
          {activeVideoCall && (
            <div className="rounded-2xl border border-cyan-500/40 p-5 bg-gradient-to-br from-slate-900 via-[#0B1B30] to-slate-950 text-white space-y-4 animate-in zoom-in-95">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span
                    className={`w-3 h-3 rounded-full ${
                      videoJoinState === 'joined' ? 'bg-rose-500 animate-ping' : 'bg-amber-500 animate-pulse'
                    }`}
                  />
                  <span className="font-bold text-xs uppercase tracking-wider text-rose-400">
                    {videoJoinState === 'joined'
                      ? 'LIVE TELEHEALTH CONSULTATION (ENCRYPTED)'
                      : videoJoinState === 'error'
                      ? isSwahili
                        ? 'IMESHINDIKANA KUUNGANISHA'
                        : 'CONNECTION FAILED'
                      : isSwahili
                      ? 'INAUNGANISHA...'
                      : 'CONNECTING...'}
                  </span>
                </div>
                <button
                  type="button"
                  onClick={handleLeaveVideoCall}
                  className="px-3 py-1 bg-rose-600 hover:bg-rose-500 text-white font-bold text-xs rounded-xl cursor-pointer"
                >
                  End Call (Kata Simu)
                </button>
              </div>

              {/* Real embedded Daily.co call frame */}
              <div className="relative aspect-video rounded-2xl bg-slate-950 border border-cyan-500/30 overflow-hidden">
                {videoJoinState === 'error' ? (
                  <div className="w-full h-full flex flex-col items-center justify-center gap-2 text-center px-6">
                    <AlertCircle className="w-8 h-8 text-rose-400" />
                    <p className="text-xs text-rose-300 font-bold">
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
                        <div className="w-10 h-10 rounded-full border-2 border-cyan-400 border-t-transparent animate-spin" />
                        <p className="text-xs text-cyan-300 font-bold">
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
            <div className="rounded-2xl border border-emerald-500/40 p-5 bg-gradient-to-br from-emerald-950/40 via-slate-900 to-[#0A2238] space-y-4 animate-in zoom-in-95">
              <div className="text-center space-y-2">
                <div className="w-14 h-14 rounded-2xl bg-emerald-500 text-white mx-auto flex items-center justify-center shadow-lg shadow-emerald-500/30">
                  <Check className="w-8 h-8" />
                </div>
                <h3 className="text-lg font-black text-white">
                  {isSwahili ? 'Miadi Imethibitishwa Kikamilifu!' : 'Appointment Successfully Confirmed!'}
                </h3>
                <p className="text-xs text-slate-300 max-w-md mx-auto">
                  {isSwahili
                    ? `Namba ya Foleni na maelezo ya daktari yametumwa kupitia SMS kwenda namba ${patientPhone}.`
                    : `Confirmation ticket sent via SMS to ${patientPhone}. Show QR pass at hospital reception.`}
                </p>
              </div>

              {/* Digital Pass Card */}
              <div className="p-4 rounded-2xl bg-slate-950/80 border border-cyan-500/30 text-white space-y-3">
                <div className="flex items-center justify-between border-b border-white/10 pb-3">
                  <div>
                    <span className="text-[10px] uppercase font-mono tracking-wider text-cyan-300 font-bold block">
                      TICKET NUMBER
                    </span>
                    <span className="font-mono font-black text-lg text-emerald-400">
                      {confirmedAppointment.ticketNumber}
                    </span>
                  </div>
                  <div className="text-right">
                    <span className="text-[10px] uppercase font-mono tracking-wider text-cyan-300 font-bold block">
                      FOLENI (QUEUE NO)
                    </span>
                    <span className="font-mono font-black text-lg text-amber-300">
                      {confirmedAppointment.queueNumber}
                    </span>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3 text-xs">
                  <div>
                    <span className="text-[10px] text-slate-400 block font-semibold">Daktari (Doctor):</span>
                    <p className="font-bold text-white text-sm">{confirmedAppointment.doctorName}</p>
                    <p className="text-[11px] text-cyan-300">{confirmedAppointment.doctorSpecialty}</p>
                  </div>
                  <div>
                    <span className="text-[10px] text-slate-400 block font-semibold">Hospitali & Chumba:</span>
                    <p className="font-bold text-white text-xs">{confirmedAppointment.hospitalName}</p>
                    <p className="text-[11px] text-amber-300 font-mono">{confirmedAppointment.roomNumber}</p>
                  </div>
                  <div>
                    <span className="text-[10px] text-slate-400 block font-semibold">Tarehe & Muda:</span>
                    <p className="font-bold text-white text-xs">
                      {confirmedAppointment.date} saa {confirmedAppointment.timeSlot}
                    </p>
                  </div>
                  <div>
                    <span className="text-[10px] text-slate-400 block font-semibold">Gharama & Bima:</span>
                    <p className="font-bold text-emerald-400 text-xs">
                      {confirmedAppointment.insuranceCovered ? '0 TZS (NHIF 100% Covered)' : 'TZS 45,000'}
                    </p>
                  </div>
                </div>

                {/* QR Code fast pass */}
                <div className="pt-3 border-t border-white/10 flex items-center justify-between">
                  <div className="flex items-center gap-2.5">
                    <div className="w-12 h-12 bg-white p-1 rounded-lg">
                      <img
                        src={`https://api.qrserver.com/v1/create-qr-code/?size=100x100&data=${confirmedAppointment.ticketNumber}`}
                        alt="Appointment QR"
                        className="w-full h-full"
                        referrerPolicy="no-referrer"
                      />
                    </div>
                    <div className="text-[11px]">
                      <span className="font-bold block">Hospital Fast-Track QR</span>
                      <span className="text-[10px] text-slate-400">Onyesha reception kupunguza muda</span>
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => {
                        alert(isSwahili ? 'Miadi imeongezwa kwenye kalenda yako ya Google/Simu!' : 'Added to Calendar!');
                      }}
                      className="p-2 rounded-xl bg-white/10 hover:bg-white/20 text-white text-xs font-bold flex items-center gap-1 cursor-pointer"
                      title="Add to Calendar"
                    >
                      <CalendarIcon className="w-3.5 h-3.5" />
                      <span className="hidden sm:inline">Kalenda</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => {
                        setConfirmedAppointment(null);
                        setActiveTab('my_appointments');
                      }}
                      className="px-3.5 py-2 rounded-xl bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-black text-xs cursor-pointer shadow-md"
                    >
                      {isSwahili ? 'Tazama Orodha ya Miadi' : 'View Appointments'}
                    </button>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* VIEW 3: MY APPOINTMENTS LIST */}
          {activeTab === 'my_appointments' && !confirmedAppointment && !activeVideoCall && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-sm font-black">
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
                  className="px-3 py-1.5 rounded-xl bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-bold text-xs flex items-center gap-1 cursor-pointer"
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
                    className="px-4 py-2 bg-cyan-500 text-slate-950 font-bold text-xs rounded-xl"
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
                            ? 'bg-[#0E1C2F] border-slate-700/80 hover:border-cyan-500/50'
                            : 'bg-white border-slate-200 hover:border-blue-300 shadow-xs'
                        }`}
                      >
                        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 pb-3 border-b border-slate-700/50">
                          <div className="flex items-center gap-3">
                            <div className="w-10 h-10 rounded-xl bg-blue-500/15 text-cyan-400 flex items-center justify-center font-bold flex-shrink-0">
                              <Stethoscope className="w-5 h-5" />
                            </div>
                            <div>
                              <div className="flex items-center gap-2">
                                <h4 className="font-bold text-xs sm:text-sm text-slate-900 dark:text-white">
                                  {apt.doctorName}
                                </h4>
                                <span
                                  className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                                    isCancelled
                                                  ? 'bg-rose-500/20 text-rose-400'
                                      : 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                                  }`}
                                >
                                  {isCancelled ? 'Cancelled' : apt.queueNumber ? `Foleni: ${apt.queueNumber}` : 'Confirmed'}
                                </span>
                              </div>
                              <p className="text-[11px] text-cyan-400 font-semibold">{apt.doctorSpecialty}</p>
                            </div>
                          </div>

                          <div className="flex items-center gap-2 text-xs font-mono">
                            <span className="px-2.5 py-1 rounded-lg bg-slate-800/80 text-cyan-300 font-bold">
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
                                  <Video className="w-3.5 h-3.5 text-cyan-400" /> Ushauri wa Video (Telehealth)
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
                              Bima: <span className="font-bold text-cyan-300">{apt.insuranceProvider}</span>
                            </div>

                            <div className="flex items-center gap-2">
                              {apt.consultationType === 'telehealth' && (
                                <button
                                  type="button"
                                  onClick={() => setActiveVideoCall(apt)}
                                  className="px-3 py-1.5 rounded-xl bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-black text-xs flex items-center gap-1.5 cursor-pointer shadow-md"
                                >
                                  <Video className="w-3.5 h-3.5" />
                                  <span>Jiunge na Video Call</span>
                                </button>
                              )}

                              <button
                                type="button"
                                onClick={() => handleCancelAppointment(apt.id)}
                                className="p-1.5 rounded-lg text-rose-400 hover:bg-rose-950/40 text-xs font-bold flex items-center gap-1 cursor-pointer transition-colors"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                                <span>Ghairi (Cancel)</span>
                              </button>
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
              {/* Consultation Type Selector Header */}
              <div className="grid grid-cols-3 gap-2">
                <button
                  type="button"
                  onClick={() => setConsultationType('in_person')}
                  className={`p-3 rounded-2xl border text-center transition-all cursor-pointer ${
                    consultationType === 'in_person'
                      ? 'bg-cyan-500/20 border-cyan-400 text-cyan-300 shadow-md'
                      : isDark
                      ? 'bg-[#0E1C2F] border-slate-800 text-slate-400 hover:border-slate-700'
                      : 'bg-slate-50 border-slate-200 text-slate-600 hover:bg-slate-100'
                  }`}
                >
                  <Building2 className="w-5 h-5 mx-auto mb-1" />
                  <span className="text-xs font-black block">Hospitali (In-Person)</span>
                  <span className="text-[10px] opacity-75">Kituo cha Afya / Referral</span>
                </button>

                <button
                  type="button"
                  onClick={() => setConsultationType('telehealth')}
                  className={`p-3 rounded-2xl border text-center transition-all cursor-pointer ${
                    consultationType === 'telehealth'
                      ? 'bg-cyan-500/20 border-cyan-400 text-cyan-300 shadow-md'
                      : isDark
                      ? 'bg-[#0E1C2F] border-slate-800 text-slate-400 hover:border-slate-700'
                      : 'bg-slate-50 border-slate-200 text-slate-600 hover:bg-slate-100'
                  }`}
                >
                  <Video className="w-5 h-5 mx-auto mb-1 text-cyan-400" />
                  <span className="text-xs font-black block">Video Telehealth</span>
                  <span className="text-[10px] opacity-75">Ushauri wa Moja kwa Moja</span>
                </button>

                <button
                  type="button"
                  onClick={() => setConsultationType('home_visit')}
                  className={`p-3 rounded-2xl border text-center transition-all cursor-pointer ${
                    consultationType === 'home_visit'
                      ? 'bg-cyan-500/20 border-cyan-400 text-cyan-300 shadow-md'
                      : isDark
                      ? 'bg-[#0E1C2F] border-slate-800 text-slate-400 hover:border-slate-700'
                      : 'bg-slate-50 border-slate-200 text-slate-600 hover:bg-slate-100'
                  }`}
                >
                  <MapPin className="w-5 h-5 mx-auto mb-1 text-emerald-400" />
                  <span className="text-xs font-black block">Daktari Nyumbani</span>
                  <span className="text-[10px] opacity-75">Mobile Home Clinic</span>
                </button>
              </div>

              {/* SEARCH & SPECIALTY FILTERS */}
              <div className="space-y-2.5">
                <div className="flex flex-col sm:flex-row gap-2">
                  <div className="relative flex-1">
                    <Search className="w-4 h-4 absolute left-3 top-3 text-slate-400" />
                    <input
                      type="text"
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      placeholder={isSwahili ? 'Tafuta Daktari, Hospitali, au Ugonjwa (mf. Moyo, Malaria, Mwangi)...' : 'Search doctor, hospital, or symptoms...'}
                      className={`w-full pl-9 pr-3 py-2.5 rounded-xl border text-xs outline-none ${
                        isDark ? 'bg-[#0E1C2F] border-slate-700 text-white placeholder-slate-500 focus:border-cyan-400' : 'bg-slate-50 border-slate-200 placeholder-slate-400'
                      }`}
                    />
                  </div>

                  <select
                    value={selectedHospitalFilter}
                    onChange={(e) => setSelectedHospitalFilter(e.target.value)}
                    className={`py-2.5 px-3 rounded-xl border text-xs outline-none font-bold ${
                      isDark ? 'bg-[#0E1C2F] border-slate-700 text-white' : 'bg-slate-50 border-slate-200 text-slate-800'
                    }`}
                  >
                    <option value="all">Hospitali Zote (All Facilities)</option>
                    <option value="Muhimbili">Muhimbili National Hospital (MNH)</option>
                    <option value="Aga Khan">The Aga Khan Hospital DSM</option>
                    <option value="KCMC">KCMC Referral Moshi</option>
                    <option value="Bugando">Bugando Medical Centre Mwanza</option>
                    <option value="TMJ">TMJ Hospital Mikocheni</option>
                    <option value="Mnazi Mmoja">Mnazi Mmoja Hospital Zanzibar</option>
                    <option value="Regency">Regency Medical Centre</option>
                  </select>
                </div>

                {/* Specialty Horizontal Scroll Pills */}
                <div className="flex items-center gap-1.5 overflow-x-auto pb-1 no-scrollbar text-xs">
                  {SPECIALTIES.map((spec) => {
                    const isSelected = selectedSpecialtyId === spec.id;
                    return (
                      <button
                        key={spec.id}
                        type="button"
                        onClick={() => setSelectedSpecialtyId(spec.id)}
                        className={`px-3 py-1.5 rounded-xl whitespace-nowrap font-bold transition-all cursor-pointer ${
                          isSelected
                            ? 'bg-cyan-500 text-slate-950 shadow-xs'
                            : isDark
                            ? 'bg-[#0E1C2F] border border-slate-800 text-slate-300 hover:border-slate-700'
                            : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
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
                <div
                  className={`p-4 sm:p-5 rounded-2xl border ${
                    isDark ? 'bg-[#0F2238] border-cyan-500/40 shadow-xl' : 'bg-blue-50/70 border-blue-200'
                  }`}
                >
                  <div className="flex items-start justify-between gap-3 mb-4">
                    <div className="flex items-center gap-3">
                      <div
                        className={`w-12 h-12 rounded-2xl bg-gradient-to-br ${selectedDoctor.avatarColor} text-white flex items-center justify-center font-black text-lg shadow-md flex-shrink-0`}
                      >
                        {doctorInitial(selectedDoctor.name)}
                      </div>
                      <div>
                        <div className="flex items-center gap-1.5">
                          <h4 className="font-black text-sm text-slate-900 dark:text-white">
                            {selectedDoctor.name}
                          </h4>
                          <span className="text-[10px] font-bold px-1.5 py-0.2 bg-emerald-500/20 text-emerald-400 rounded">
                            MCT Verified ✓
                          </span>
                        </div>
                        <p className="text-xs text-cyan-400 font-bold">{selectedDoctor.specialty}</p>
                        <p className="text-[11px] text-slate-400">{selectedDoctor.hospital}</p>
                      </div>
                    </div>

                    <div className="text-right">
                      <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-400 block">
                        NHIF 100% COVERED
                      </span>
                      <span className="text-xs font-black text-slate-900 dark:text-white">
                        0 TZS Co-Pay
                      </span>
                    </div>
                  </div>

                  {/* Wizard Step 1: Slot & Date Selection */}
                  <div className="space-y-3 pt-3 border-t border-slate-700/50">
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <div>
                        <label className="text-xs font-bold block mb-1.5">
                          {isSwahili ? 'Chagua Tarehe ya Miadi:' : 'Select Appointment Date:'}
                        </label>
                        <input
                          type="date"
                          value={selectedDate}
                          min={getTodayISO()}
                          onChange={(e) => setSelectedDate(e.target.value)}
                          className={`w-full p-2.5 rounded-xl border text-xs font-bold outline-none ${
                            isDark ? 'bg-slate-900 border-slate-700 text-white' : 'bg-white border-slate-300'
                          }`}
                        />
                      </div>

                      <div>
                        <label className="text-xs font-bold block mb-1.5">
                          {isSwahili ? 'Chagua Muda (Available Slots):' : 'Select Time Slot:'}
                        </label>
                        {(() => {
                          const allSlots = [...liveSlots.morning, ...liveSlots.afternoon, ...liveSlots.evening];
                          if (slotsLoading) {
                            return <p className="text-[11px] text-slate-400 py-1.5">{isSwahili ? 'Inapakia nafasi...' : 'Loading available times…'}</p>;
                          }
                          if (allSlots.length === 0) {
                            return (
                              <p className="text-[11px] text-amber-500 font-semibold py-1.5">
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
                                  className={`py-1.5 px-2 rounded-lg text-xs font-mono font-bold transition-all cursor-pointer ${
                                    selectedSlot === slot
                                      ? 'bg-cyan-500 text-slate-950 shadow-md font-black'
                                      : isDark
                                      ? 'bg-slate-900/90 text-slate-300 border border-slate-700 hover:border-cyan-400'
                                      : 'bg-white text-slate-800 border border-slate-200 hover:bg-slate-100'
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
                      <label className="text-xs font-bold block mb-1.5">
                        {isSwahili ? 'Sababu ya Kuonana na Daktari:' : 'Reason for Consultation / Symptoms:'}
                      </label>
                      <div className="flex flex-wrap gap-1.5 mb-2">
                        {symptomPresets.map((preset) => (
                          <button
                            key={preset.key}
                            type="button"
                            onClick={() => setVisitReason(preset.label)}
                            className={`px-2.5 py-1 rounded-lg text-[11px] font-bold transition-all cursor-pointer ${
                              visitReason === preset.label
                                ? 'bg-emerald-500 text-white shadow-xs'
                                : isDark
                                ? 'bg-slate-900 border border-slate-700 text-slate-300 hover:border-slate-600'
                                : 'bg-white border border-slate-200 text-slate-700'
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
                        className={`w-full p-2.5 rounded-xl border text-xs outline-none ${
                          isDark ? 'bg-slate-900 border-slate-700 text-white' : 'bg-white border-slate-300'
                        }`}
                      />
                    </div>

                    {/* Step 3: Payment / Insurance procedure selection */}
                    <div className="space-y-2">
                      <label className="text-[11px] font-black text-slate-400 uppercase tracking-wider block">
                        {isSwahili ? 'Utaratibu wa Malipo / Bima' : 'Payment / Insurance Procedure'}
                      </label>
                      <div className="grid grid-cols-2 gap-2">
                        <button
                          type="button"
                          onClick={() => setPaymentMethod('insurance')}
                          className={`p-3 rounded-2xl border text-left transition-all cursor-pointer ${
                            paymentMethod === 'insurance'
                              ? isDark
                                ? 'bg-emerald-950/60 border-emerald-500 text-emerald-300'
                                : 'bg-emerald-50 border-emerald-600 text-emerald-950 shadow-xs'
                              : isDark
                              ? 'bg-slate-900 border-slate-700/80 text-slate-400 hover:border-slate-600'
                              : 'bg-white border-slate-200 text-slate-600 hover:border-slate-300'
                          }`}
                        >
                          <div className="flex items-center justify-between mb-1">
                            <span className="font-black text-xs flex items-center gap-1.5">
                              <Shield className="w-3.5 h-3.5 text-emerald-500" />
                              <span>{isSwahili ? 'Bima ya Afya' : 'Insurance'}</span>
                            </span>
                            <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-emerald-500/20 text-emerald-400">
                              0 TZS Co-Pay
                            </span>
                          </div>
                          <p className="text-[10px] opacity-80 truncate">
                            {insuranceName} (Pre-Auth)
                          </p>
                        </button>

                        <button
                          type="button"
                          onClick={() => setPaymentMethod('mpesa')}
                          className={`p-3 rounded-2xl border text-left transition-all cursor-pointer ${
                            paymentMethod !== 'insurance'
                              ? isDark
                                ? 'bg-cyan-950/60 border-cyan-500 text-cyan-300'
                                : 'bg-cyan-50 border-cyan-600 text-cyan-950 shadow-xs'
                              : isDark
                              ? 'bg-slate-900 border-slate-700/80 text-slate-400 hover:border-slate-600'
                              : 'bg-white border-slate-200 text-slate-600 hover:border-slate-300'
                          }`}
                        >
                          <div className="flex items-center justify-between mb-1">
                            <span className="font-black text-xs flex items-center gap-1.5">
                              <CreditCard className="w-3.5 h-3.5 text-cyan-500" />
                              <span>{isSwahili ? 'Pesa / Simu' : 'Cash / Mobile'}</span>
                            </span>
                            <span className="font-mono text-[10px] font-black text-cyan-500">
                              {selectedDoctor.consultationFeeTzs.toLocaleString()} TZS
                            </span>
                          </div>
                          <p className="text-[10px] opacity-80">
                            {isSwahili ? 'M-Pesa / Tigo / Dirishani' : 'Mobile / Cashier'}
                          </p>
                        </button>
                      </div>

                      {paymentMethod === 'insurance' ? (
                        <div
                          className={`p-2.5 rounded-xl border flex items-center justify-between gap-3 text-xs ${
                            isDark
                              ? 'bg-emerald-950/40 border-emerald-800 text-emerald-200'
                              : 'bg-emerald-50 border-emerald-200 text-emerald-900'
                          }`}
                        >
                          <div className="flex items-center gap-2">
                            <Shield className="w-4 h-4 text-emerald-400 flex-shrink-0" />
                            <div className="text-[11px]">
                              <span className="font-bold block">
                                {isSwahili ? `Imehakikiwa na Bima: ${insuranceName}` : `Verified with: ${insuranceName}`}
                              </span>
                              <span className="text-[10px] opacity-90">
                                {isSwahili ? 'Hakuna malipo ya ziada dirishani.' : 'No out-of-pocket payment required.'}
                              </span>
                            </div>
                          </div>
                          <span className="font-mono font-black text-xs text-emerald-400 bg-emerald-950/80 px-2 py-0.5 rounded">
                            0 TZS
                          </span>
                        </div>
                      ) : (
                        <div
                          className={`p-2.5 rounded-xl border flex items-center justify-between gap-3 text-xs ${
                            isDark
                              ? 'bg-blue-950/40 border-blue-800 text-blue-200'
                              : 'bg-blue-50 border-blue-200 text-blue-900'
                          }`}
                        >
                          <div className="flex items-center gap-2">
                            <CreditCard className="w-4 h-4 text-cyan-400 flex-shrink-0" />
                            <div className="text-[11px]">
                              <span className="font-bold block">
                                {isSwahili ? 'Malipo Dirishani au kwa Simu (M-Pesa / Tigo)' : 'Pay via Mobile Money or at Cashier'}
                              </span>
                              <span className="text-[10px] opacity-90">
                                {isSwahili ? 'Utapokea risiti ya kielektroniki baada ya uthibitisho.' : 'Electronic receipt generated upon confirmation.'}
                              </span>
                            </div>
                          </div>
                          <span className="font-mono font-black text-xs text-cyan-400 bg-cyan-950/80 px-2 py-0.5 rounded">
                            {selectedDoctor.consultationFeeTzs.toLocaleString()} TZS
                          </span>
                        </div>
                      )}
                    </div>

                    {/* Submit Booking Button */}
                    <div className="pt-2 space-y-2">
                      {bookingError && (
                        <p className="text-xs font-semibold text-rose-500 bg-rose-500/10 border border-rose-500/30 rounded-xl p-2.5 flex items-center gap-1.5">
                          <AlertCircle className="w-3.5 h-3.5 flex-shrink-0" />
                          {bookingError}
                        </p>
                      )}
                      <button
                        type="button"
                        onClick={handleCompleteBooking}
                        disabled={isBooking || !selectedSlot}
                        className={`w-full py-3.5 px-4 rounded-2xl bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-black text-sm flex items-center justify-center gap-2 shadow-lg shadow-cyan-500/20 transition-all active:scale-98 ${
                          isBooking || !selectedSlot ? 'opacity-70 cursor-not-allowed' : 'cursor-pointer'
                        }`}
                      >
                        <CalendarCheck className="w-4 h-4" />
                        <span>
                          {isBooking
                            ? isSwahili
                              ? 'Inathibitisha...'
                              : 'Confirming...'
                            : isSwahili
                            ? `Thibitisha Miadi na ${selectedDoctor.name}`
                            : `Confirm Appointment with ${selectedDoctor.name}`}
                        </span>
                      </button>
                    </div>
                  </div>
                </div>
              )}

              {/* LIST OF AVAILABLE SPECIALISTS */}
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <h4 className="text-xs font-black uppercase tracking-wider text-slate-400">
                    Madaktari Bingwa Waliopo ({filteredDoctors.length})
                  </h4>
                  <span className="text-[11px] text-cyan-400 font-bold">
                    Panga Miadi Haraka (1-Tap Book)
                  </span>
                </div>

                {doctorsError && (
                  <p className="text-xs font-semibold text-rose-500 bg-rose-500/10 border border-rose-500/30 rounded-xl p-3">
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

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {filteredDoctors.map((doc) => {
                    const isSelected = selectedDoctor?.id === doc.id;
                    return (
                      <div
                        key={doc.id}
                        className={`p-3.5 rounded-2xl border transition-all flex flex-col justify-between ${
                          isSelected
                            ? isDark
                              ? 'bg-[#12253D] border-cyan-400 shadow-md'
                              : 'bg-blue-50/90 border-[#0A4275]'
                            : isDark
                            ? 'bg-[#0E1C2F] border-slate-800 hover:border-slate-700'
                            : 'bg-white border-slate-200 hover:border-slate-300 shadow-xs'
                        }`}
                      >
                        <div>
                          <div className="flex items-start justify-between gap-2 mb-2">
                            <div className="flex items-center gap-2.5">
                              <div
                                className={`w-10 h-10 rounded-xl bg-gradient-to-br ${doc.avatarColor} text-white flex items-center justify-center font-black text-sm flex-shrink-0`}
                              >
                                {doctorInitial(doc.name)}
                              </div>
                              <div>
                                <h5 className="font-bold text-xs text-slate-900 dark:text-white leading-tight">
                                  {doc.name}
                                </h5>
                                <p className="text-[11px] text-cyan-400 font-semibold">{doc.specialty}</p>
                              </div>
                            </div>
                            <span className="text-[10px] font-bold text-amber-400 bg-amber-500/10 px-1.5 py-0.5 rounded">
                              ★ {doc.rating}
                            </span>
                          </div>

                          <p className="text-[11px] text-slate-400 mb-2 line-clamp-2">
                            {isSwahili ? doc.bioSw : doc.bio}
                          </p>

                          <div className="space-y-1 text-[11px] text-slate-400 mb-3">
                            <div className="flex items-center gap-1 truncate">
                              <Building2 className="w-3 h-3 text-slate-400 flex-shrink-0" />
                              <span className="truncate">{doc.hospital}</span>
                            </div>
                            <div className="flex items-center justify-between">
                              {doc.nhifAccepted ? (
                                <span className="text-emerald-400 font-bold flex items-center gap-1">
                                  <CheckCircle2 className="w-3 h-3" /> NHIF Accepted
                                </span>
                              ) : (
                                <span className="text-slate-400">{isSwahili ? 'Malipo ya Moja kwa Moja' : 'Direct Pay'}</span>
                              )}
                              <span className="font-mono text-slate-300">
                                {doc.consultationFeeTzs.toLocaleString()} TZS
                              </span>
                            </div>
                          </div>
                        </div>

                        <button
                          type="button"
                          onClick={() => startBookingWithDoctor(doc)}
                          className={`w-full py-2 rounded-xl font-bold text-xs transition-all cursor-pointer flex items-center justify-center gap-1 ${
                            isSelected
                              ? 'bg-cyan-500 text-slate-950 font-black'
                              : isDark
                              ? 'bg-slate-800 hover:bg-slate-700 text-white'
                              : 'bg-slate-100 hover:bg-[#0A4275] hover:text-white text-slate-800'
                          }`}
                        >
                          <span>{isSelected ? 'Inachaguliwa Hapo Juu ↑' : 'Weka Miadi (Book Slot)'}</span>
                          <ChevronRight className="w-3 h-3" />
                        </button>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
