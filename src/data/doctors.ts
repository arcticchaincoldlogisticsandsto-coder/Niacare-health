export interface Doctor {
  id: string;
  name: string;
  title: string;
  specialty: string;
  specialtySw: string;
  hospital: string;
  hospitalLocation: string;
  region: string;
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
}

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
  status: 'confirmed' | 'in_queue' | 'completed' | 'cancelled';
  queueNumber?: string;
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

export const TANZANIA_DOCTORS: Doctor[] = [
  {
    id: 'doc-1',
    name: 'Dr. Juma Ally Mwangi',
    title: 'Consultant Cardiologist & Heart Specialist',
    specialty: 'Cardiology (Heart)',
    specialtySw: 'Bingwa wa Magonjwa ya Moyo',
    hospital: 'Muhimbili National Hospital (MNH)',
    hospitalLocation: 'Upanga, Dar es Salaam (Jakaya Kikwete Cardiac Institute - JKCI)',
    region: 'Dar es Salaam',
    rating: 4.9,
    reviewsCount: 142,
    experienceYears: 16,
    languages: ['Kiswahili', 'English'],
    mctRegistration: 'MCT-REG-84920',
    nhifAccepted: true,
    privateInsuranceAccepted: true,
    consultationFeeTzs: 45000,
    availableDays: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri'],
    availableSlots: {
      morning: ['09:00 AM', '10:15 AM', '11:30 AM'],
      afternoon: ['01:30 PM', '02:45 PM', '03:45 PM'],
      evening: ['05:00 PM', '06:00 PM'],
    },
    telehealthAvailable: true,
    avatarColor: 'from-blue-600 to-indigo-700',
    bio: 'Lead interventional cardiologist at JKCI specializing in hypertension management, arrhythmia, and preventive cardiac healthcare.',
    bioSw: 'Daktari Bingwa wa Moyo katika Taasisi ya JKCI Muhimbili anayebobea katika shinikizo la damu, mishipa ya moyo na kinga.',
  },
  {
    id: 'doc-2',
    name: 'Dr. Amina Fatuma Rashid',
    title: 'Senior Pediatrician & Child Health Specialist',
    specialty: 'Pediatrics (Child Health)',
    specialtySw: 'Bingwa wa Afya ya Watoto',
    hospital: 'The Aga Khan Hospital Dar es Salaam',
    hospitalLocation: 'Ocean Road, Dar es Salaam',
    region: 'Dar es Salaam',
    rating: 4.95,
    reviewsCount: 198,
    experienceYears: 12,
    languages: ['Kiswahili', 'English', 'French'],
    mctRegistration: 'MCT-REG-91044',
    nhifAccepted: true,
    privateInsuranceAccepted: true,
    consultationFeeTzs: 50000,
    availableDays: ['Mon', 'Wed', 'Thu', 'Sat'],
    availableSlots: {
      morning: ['08:30 AM', '09:45 AM', '11:00 AM'],
      afternoon: ['02:00 PM', '03:15 PM'],
      evening: ['04:30 PM', '05:30 PM'],
    },
    telehealthAvailable: true,
    avatarColor: 'from-emerald-600 to-teal-700',
    bio: 'Certified pediatric specialist with expertise in neonatal intensive care, child immunization schedules, and developmental milestones.',
    bioSw: 'Daktari bingwa wa watoto mwenye uzoefu wa huduma za watoto wachanga, chanjo na ukuaji bora.',
  },
  {
    id: 'doc-3',
    name: 'Dr. Josephat K. Ndemange',
    title: 'Senior Consultant Physician (Internal Medicine)',
    specialty: 'General Medicine',
    specialtySw: 'Daktari Mkuu & Tiba ya Ndani',
    hospital: 'KCMC Referral Hospital',
    hospitalLocation: 'Moshi, Kilimanjaro',
    region: 'Kilimanjaro',
    rating: 4.85,
    reviewsCount: 114,
    experienceYears: 19,
    languages: ['Kiswahili', 'English'],
    mctRegistration: 'MCT-REG-77301',
    nhifAccepted: true,
    privateInsuranceAccepted: true,
    consultationFeeTzs: 35000,
    availableDays: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri'],
    availableSlots: {
      morning: ['09:00 AM', '10:30 AM', '11:45 AM'],
      afternoon: ['01:30 PM', '03:00 PM'],
      evening: ['04:30 PM'],
    },
    telehealthAvailable: true,
    avatarColor: 'from-cyan-600 to-blue-700',
    bio: 'Internal medicine expert managing infectious tropical diseases, diabetes mellitus, asthma, and routine wellness checkups.',
    bioSw: 'Daktari mbobezi wa tiba ya ndani, kisukari, pumu, na magonjwa ya maambukizi.',
  },
  {
    id: 'doc-4',
    name: 'Dr. Zawadi Neema Mussa',
    title: 'Consultant Obstetrician & Gynecologist',
    specialty: 'Gynecology & Maternity',
    specialtySw: 'Bingwa wa Wazazi na Akina Mama',
    hospital: 'Muhimbili National Hospital (MNH)',
    hospitalLocation: 'Upanga, Dar es Salaam (Maternity Wing)',
    region: 'Dar es Salaam',
    rating: 4.9,
    reviewsCount: 160,
    experienceYears: 14,
    languages: ['Kiswahili', 'English'],
    mctRegistration: 'MCT-REG-88219',
    nhifAccepted: true,
    privateInsuranceAccepted: true,
    consultationFeeTzs: 40000,
    availableDays: ['Tue', 'Wed', 'Thu', 'Fri', 'Sat'],
    availableSlots: {
      morning: ['09:15 AM', '10:45 AM', '11:45 AM'],
      afternoon: ['02:00 PM', '03:30 PM'],
      evening: ['05:00 PM'],
    },
    telehealthAvailable: false,
    avatarColor: 'from-purple-600 to-pink-700',
    bio: 'Dedicated maternal and fetal medicine consultant focusing on safe antenatal care, reproductive health, and high-risk pregnancies.',
    bioSw: 'Bingwa wa uzazi anayesimamia ujauzito, afya ya uzazi na huduma za mama na mtoto.',
  },
  {
    id: 'doc-5',
    name: 'Dr. Michael Peter Saria',
    title: 'Dental Surgeon & Oral Health Specialist',
    specialty: 'Dental Surgery',
    specialtySw: 'Daktari wa Upasuaji wa Meno',
    hospital: 'TMJ Hospital',
    hospitalLocation: 'Mikocheni, Dar es Salaam',
    region: 'Dar es Salaam',
    rating: 4.8,
    reviewsCount: 88,
    experienceYears: 10,
    languages: ['Kiswahili', 'English'],
    mctRegistration: 'MCT-REG-94302',
    nhifAccepted: true,
    privateInsuranceAccepted: true,
    consultationFeeTzs: 35000,
    availableDays: ['Mon', 'Tue', 'Thu', 'Fri'],
    availableSlots: {
      morning: ['10:00 AM', '11:15 AM'],
      afternoon: ['01:45 PM', '03:00 PM', '04:15 PM'],
      evening: ['05:30 PM'],
    },
    telehealthAvailable: false,
    avatarColor: 'from-amber-600 to-orange-700',
    bio: 'Specialist in restorative dentistry, painless root canals, teeth whitening, and oral maxillofacial care.',
    bioSw: 'Daktari bingwa wa meno, tiba ya mizizi, usafi na kung’arisha meno.',
  },
  {
    id: 'doc-6',
    name: 'Dr. Fatma Said Al-Hadhrami',
    title: 'Consultant Ophthalmologist & Eye Surgeon',
    specialty: 'Ophthalmology (Eyes)',
    specialtySw: 'Bingwa wa Macho & Upasuaji',
    hospital: 'Mnazi Mmoja Referral Hospital',
    hospitalLocation: 'Stone Town, Zanzibar',
    region: 'Zanzibar',
    rating: 4.92,
    reviewsCount: 130,
    experienceYears: 15,
    languages: ['Kiswahili', 'English', 'Arabic'],
    mctRegistration: 'MCT-REG-81203',
    nhifAccepted: true,
    privateInsuranceAccepted: true,
    consultationFeeTzs: 40000,
    availableDays: ['Mon', 'Wed', 'Thu', 'Sat'],
    availableSlots: {
      morning: ['08:45 AM', '10:00 AM', '11:15 AM'],
      afternoon: ['02:15 PM', '03:30 PM'],
      evening: ['04:45 PM'],
    },
    telehealthAvailable: true,
    avatarColor: 'from-teal-600 to-cyan-800',
    bio: 'Cataract, glaucoma, and refractive surgery specialist in Zanzibar providing comprehensive vision care.',
    bioSw: 'Daktari bingwa wa magonjwa ya macho, mtoto wa jicho, presha ya macho na upasuaji Zanzibar.',
  },
  {
    id: 'doc-7',
    name: 'Dr. Emmanuel Baraka Mchau',
    title: 'Consultant Orthopedic & Trauma Surgeon',
    specialty: 'Orthopedics & Bones',
    specialtySw: 'Bingwa wa Mifupa & Viungo',
    hospital: 'Bugando Medical Centre (BMC)',
    hospitalLocation: 'Mwanza (Lake Zone)',
    region: 'Mwanza',
    rating: 4.88,
    reviewsCount: 95,
    experienceYears: 17,
    languages: ['Kiswahili', 'English'],
    mctRegistration: 'MCT-REG-79401',
    nhifAccepted: true,
    privateInsuranceAccepted: true,
    consultationFeeTzs: 45000,
    availableDays: ['Mon', 'Tue', 'Thu', 'Fri'],
    availableSlots: {
      morning: ['09:00 AM', '10:30 AM'],
      afternoon: ['01:30 PM', '02:45 PM', '04:00 PM'],
      evening: ['05:15 PM'],
    },
    telehealthAvailable: true,
    avatarColor: 'from-blue-700 to-slate-800',
    bio: 'Specialist in joint replacements, sports injuries, fractures, and spine orthopedic care across the Lake Zone.',
    bioSw: 'Daktari bingwa wa mifupa, maumivu ya mgongo, viungo na upasuaji wa majeraha Mwanza.',
  },
  {
    id: 'doc-8',
    name: 'Dr. Grace Rehema Lyimo',
    title: 'Consultant Dermatologist & Skin Health',
    specialty: 'Dermatology (Skin)',
    specialtySw: 'Bingwa wa Ngozi na Mizio',
    hospital: 'Regency Medical Centre',
    hospitalLocation: 'Upanga, Dar es Salaam',
    region: 'Dar es Salaam',
    rating: 4.9,
    reviewsCount: 110,
    experienceYears: 11,
    languages: ['Kiswahili', 'English'],
    mctRegistration: 'MCT-REG-96022',
    nhifAccepted: true,
    privateInsuranceAccepted: true,
    consultationFeeTzs: 40000,
    availableDays: ['Tue', 'Wed', 'Fri', 'Sat'],
    availableSlots: {
      morning: ['09:30 AM', '11:00 AM'],
      afternoon: ['02:00 PM', '03:15 PM', '04:30 PM'],
      evening: ['05:45 PM'],
    },
    telehealthAvailable: true,
    avatarColor: 'from-rose-600 to-pink-800',
    bio: 'Expert in clinical dermatology, eczema, acne solutions, allergic reactions, and tropical skin conditions.',
    bioSw: 'Bingwa wa magonjwa ya ngozi, mizio, chunusi sugu na kinga ya mionzi ya jua.',
  },
];
