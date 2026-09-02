export interface Doctor {
  id: string;
  name: string;
  title: string;
  specialty: string;
  specialtySw: string;
  hospital: string;
  hospitalLocation: string;
  region: string;
  /** providers.lat/lng — only set for a real, platform-registered facility with coordinates on file. Powers "Directions" in the Doctor Profile via the existing routing lib, never a fabricated location. */
  facilityLat?: number;
  facilityLng?: number;
  rating: number;
  reviewsCount: number;
  experienceYears: number;
  languages: string[];
  mctRegistration: string; // Medical Council of Tanganyika ID
  nhifAccepted: boolean;
  privateInsuranceAccepted: boolean;
  consultationFeeTzs: number;
  availableDays: string[];
  availableSlots: {
    morning: string[];
    afternoon: string[];
    evening: string[];
  };
  telehealthAvailable: boolean;
  avatarColor: string;
  bio: string;
  bioSw: string;
  /** Present only for real, platform-registered doctors (see src/lib/realDoctors.ts) — the facility to book/bill against via public.book_appointment(). */
  providerId?: string;
  /** doctor_profiles.is_verified — only ever true once an admin has actually verified this doctor (see AdminDashboard's Verify action). */
  isVerified?: boolean;
}

/**
 * What the patient picked in the Doctor Profile before handing off to the
 * booking modal — carries the real IDs/types already used elsewhere
 * (Doctor.id, Doctor.providerId, doctor_schedule.time_slot strings,
 * Appointment.consultationType) rather than inventing new ones.
 */
export interface SelectedBookingSlot {
  doctorId: string;
  facilityId?: string;
  date: string;
  startTime: string;
  visitType?: Appointment['consultationType'];
}

/**
 * How a caller hands off "open the Doctor Profile for this doctor" without
 * every caller needing to already have the full Doctor object loaded.
 * `doctor` — already-fetched object (doctor-browse lists). `doctorId` —
 * doctor_profiles.id (appointments, health journey). `doctorUserId` —
 * doctor_profiles.user_id (a conversation's other-party id in messaging,
 * which never carries doctor_profiles.id directly).
 */
export type DoctorProfileTarget =
  | { doctor: Doctor }
  | { doctorId: string }
  | { doctorUserId: string };

export interface Appointment {
  id: string;
  ticketNumber: string;
  doctorId: string;
  doctorName: string;
  doctorSpecialty: string;
  hospitalName: string;
  hospitalLocation: string;
  roomNumber: string;
  consultationType: 'in_person' | 'telehealth' | 'home_visit';
  date: string;
  timeSlot: string;
  status: 'confirmed' | 'arrived' | 'in_queue' | 'called' | 'in_consultation' | 'completed' | 'cancelled' | 'no_show';
  queueNumber?: string;
  providerId?: string | null;
  doctorProfileId?: string | null;
  /** Set once reception confirms arrival (check_in_appointment) — the real "check-in time" reception/patient UIs show. */
  arrivalConfirmedAt?: string | null;
  patientArrivedAt?: string | null;
  calledAt?: string | null;
  consultationStartedAt?: string | null;
  completedAt?: string | null;
  noShowReason?: string | null;
  reason: string;
  symptomsNote?: string;
  insuranceProvider: string;
  insuranceCovered: boolean;
  coPayAmountTzs: number;
  patientName: string;
  patientPhone: string;
  createdAt: string;
}

export const TANZANIA_HOSPITALS = [
  {
    id: 'mnh',
    name: 'Muhimbili National Hospital (MNH)',
    region: 'Dar es Salaam (Upanga)',
    type: 'National Referral Hospital',
    nhifAccepted: true,
    emergencyPhone: '+255 22 215 1367',
  },
  {
    id: 'agakhan',
    name: 'The Aga Khan Hospital Dar es Salaam',
    region: 'Dar es Salaam (Ocean Road)',
    type: 'Private Tertiary Hospital (JCI Accredited)',
    nhifAccepted: true,
    emergencyPhone: '+255 22 211 5151',
  },
  {
    id: 'kcmc',
    name: 'KCMC Referral Hospital',
    region: 'Moshi / Kilimanjaro',
    type: 'Zonal Referral Hospital',
    nhifAccepted: true,
    emergencyPhone: '+255 27 275 4377',
  },
  {
    id: 'bugando',
    name: 'Bugando Medical Centre (BMC)',
    region: 'Mwanza (Lake Zone)',
    type: 'Zonal Referral Hospital',
    nhifAccepted: true,
    emergencyPhone: '+255 28 250 0513',
  },
  {
    id: 'tmj',
    name: 'TMJ Hospital',
    region: 'Dar es Salaam (Mikocheni)',
    type: 'Private Specialized Hospital',
    nhifAccepted: true,
    emergencyPhone: '+255 22 277 5511',
  },
  {
    id: 'mnazi_mmoja',
    name: 'Mnazi Mmoja Referral Hospital',
    region: 'Zanzibar (Unguja)',
    type: 'Regional Teaching Hospital',
    nhifAccepted: true,
    emergencyPhone: '+255 24 223 1071',
  },
  {
    id: 'mwananyamala',
    name: 'Mwananyamala Regional Referral Hospital',
    region: 'Dar es Salaam (Kinondoni)',
    type: 'Regional Referral Hospital',
    nhifAccepted: true,
    emergencyPhone: '+255 22 277 4422',
  },
  {
    id: 'regency',
    name: 'Regency Medical Centre',
    region: 'Dar es Salaam (Upanga)',
    type: 'Private Multispecialty Hospital',
    nhifAccepted: true,
    emergencyPhone: '+255 22 215 0500',
  },
];

export const SPECIALTIES = [
  { id: 'all', name: 'All Specialties', nameSw: 'Idara Zote', icon: 'Stethoscope' },
  { id: 'general', name: 'General Medicine', nameSw: 'Daktari Mkuu (General)', icon: 'Activity' },
  { id: 'cardiology', name: 'Cardiology (Heart)', nameSw: 'Moyo & Mishipa ya Damu', icon: 'Heart' },
  { id: 'pediatrics', name: 'Pediatrics (Child Health)', nameSw: 'Afya ya Watoto', icon: 'Baby' },
  { id: 'gynecology', name: 'Gynecology & Maternity', nameSw: 'Wazazi & Akina Mama', icon: 'Users' },
  { id: 'dental', name: 'Dental Surgery', nameSw: 'Meno & Kinywa', icon: 'Smile' },
  { id: 'ophthalmology', name: 'Ophthalmology (Eyes)', nameSw: 'Magonjwa ya Macho', icon: 'Eye' },
  { id: 'orthopedics', name: 'Orthopedics & Bones', nameSw: 'Mifupa & Viungo', icon: 'Shield' },
  { id: 'dermatology', name: 'Dermatology (Skin)', nameSw: 'Ngozi & Mizio', icon: 'Sparkles' },
  { id: 'ent', name: 'ENT (Ear, Nose & Throat)', nameSw: 'Masikio, Pua & Koo', icon: 'Headphones' },
];
