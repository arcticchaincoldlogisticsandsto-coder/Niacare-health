import { supabase } from './supabaseClient';
import { Doctor } from '../data/doctors';

interface DoctorProfileRow {
  id: string;
  user_id: string;
  provider_id: string | null;
  mct_registration: string | null;
  specialty: string;
  consultation_fee_tzs: number;
  languages: string[];
  bio: string | null;
  rating: number;
  reviews_count: number;
  experience_years: number | null;
  telehealth_fee_tzs: number;
  is_verified: boolean;
  providers: ProviderRef | ProviderRef[] | null;
}

interface ProviderRef {
  id: string;
  name: string;
  region: string;
  nhif_enabled: boolean;
  lat: number | null;
  lng: number | null;
}

const AVATAR_COLORS = [
  'from-blue-600 to-indigo-700',
  'from-emerald-600 to-teal-700',
  'from-cyan-600 to-blue-700',
  'from-rose-600 to-pink-700',
  'from-amber-600 to-orange-700',
  'from-purple-600 to-violet-700',
];

const colorForId = (id: string) => {
  let hash = 0;
  for (let i = 0; i < id.length; i++) hash = (hash * 31 + id.charCodeAt(i)) >>> 0;
  return AVATAR_COLORS[hash % AVATAR_COLORS.length];
};

const first = <T,>(value: T | T[] | null): T | null => (Array.isArray(value) ? value[0] || null : value);

const DOCTOR_PROFILE_SELECT =
  'id, user_id, provider_id, mct_registration, specialty, consultation_fee_tzs, telehealth_fee_tzs, languages, bio, rating, reviews_count, experience_years, is_verified, providers(id, name, region, nhif_enabled, lat, lng)';

const mapDoctorRow = (row: DoctorProfileRow, doctorName: string): Doctor => {
  const provider = first(row.providers);
  return {
    id: row.id,
    name: doctorName,
    title: row.specialty,
    specialty: row.specialty,
    specialtySw: row.specialty,
    hospital: provider?.name || 'Unassigned facility',
    hospitalLocation: provider?.region || '',
    facilityLat: provider?.lat ?? undefined,
    facilityLng: provider?.lng ?? undefined,
    region: provider?.region || '',
    rating: row.rating,
    reviewsCount: row.reviews_count,
    experienceYears: row.experience_years || 0,
    languages: row.languages && row.languages.length > 0 ? row.languages : ['Kiswahili', 'English'],
    mctRegistration: row.mct_registration || '—',
    nhifAccepted: provider?.nhif_enabled || false,
    privateInsuranceAccepted: true,
    consultationFeeTzs: row.consultation_fee_tzs,
    availableDays: [],
    availableSlots: { morning: [], afternoon: [], evening: [] },
    telehealthAvailable: row.telehealth_fee_tzs > 0,
    avatarColor: colorForId(row.id),
    bio: row.bio || `${row.specialty} specialist.`,
    bioSw: row.bio || `Daktari bingwa wa ${row.specialty}.`,
    providerId: row.provider_id || undefined,
    isVerified: row.is_verified,
  };
};

/**
 * Real, platform-registered doctors — invited via api/invite-staff.ts, not
 * the static fictional directory. Mapped into the same Doctor shape the
 * booking UI already renders, so the wizard doesn't need restructuring;
 * availableSlots is left empty here and populated per-date separately from
 * public.doctor_schedule (real bookable slots, not a static template).
 */
export const fetchBookableDoctors = async (): Promise<{ doctors: Doctor[]; error?: string }> => {
  const { data, error } = await supabase
    .from('doctor_profiles')
    .select(DOCTOR_PROFILE_SELECT)
    .eq('is_active', true);

  if (error) return { doctors: [], error: error.message };

  const rows = (data || []) as unknown as DoctorProfileRow[];

  // doctor_profiles.user_id references auth.users, not public.profiles
  // (profiles is a separate child of auth.users), so there's no FK for
  // PostgREST to embed profiles on directly — fetch names separately.
  const userIds = rows.map((r) => r.user_id);
  const namesByUserId = new Map<string, string>();
  if (userIds.length > 0) {
    const { data: profileRows } = await supabase.from('profiles').select('id, full_name').in('id', userIds);
    for (const p of profileRows || []) namesByUserId.set(p.id, p.full_name);
  }

  const doctors: Doctor[] = rows.map((row) => mapDoctorRow(row, namesByUserId.get(row.user_id) || 'Doctor'));

  return { doctors };
};

/** Real doctors at one facility — doctor_profiles.provider_id is the only doctor↔facility link the schema has (one facility per doctor, not many-to-many), so this is a plain filter, not a join table. */
export const fetchDoctorsByProvider = async (providerId: string): Promise<{ doctors: Doctor[]; error?: string }> => {
  const { data, error } = await supabase
    .from('doctor_profiles')
    .select(DOCTOR_PROFILE_SELECT)
    .eq('provider_id', providerId)
    .eq('is_active', true);

  if (error) return { doctors: [], error: error.message };

  const rows = (data || []) as unknown as DoctorProfileRow[];
  const userIds = rows.map((r) => r.user_id);
  const namesByUserId = new Map<string, string>();
  if (userIds.length > 0) {
    const { data: profileRows } = await supabase.from('profiles').select('id, full_name').in('id', userIds);
    for (const p of profileRows || []) namesByUserId.set(p.id, p.full_name);
  }

  return { doctors: rows.map((row) => mapDoctorRow(row, namesByUserId.get(row.user_id) || 'Doctor')) };
};

/** One real doctor by doctor_profiles.id — for entry points that only hold that id (an appointment, a health journey encounter/referral). */
export const fetchDoctorById = async (doctorProfileId: string): Promise<{ doctor: Doctor | null; error?: string }> => {
  const { data, error } = await supabase
    .from('doctor_profiles')
    .select(DOCTOR_PROFILE_SELECT)
    .eq('id', doctorProfileId)
    .maybeSingle();

  if (error) return { doctor: null, error: error.message };
  if (!data) return { doctor: null };

  const row = data as unknown as DoctorProfileRow;
  const { data: profileRow } = await supabase.from('profiles').select('full_name').eq('id', row.user_id).maybeSingle();
  return { doctor: mapDoctorRow(row, profileRow?.full_name || 'Doctor') };
};

/** One real doctor by doctor_profiles.user_id — for entry points that only carry the auth user id (a messaging conversation's other party). */
export const fetchDoctorByUserId = async (userId: string): Promise<{ doctor: Doctor | null; error?: string }> => {
  const { data, error } = await supabase
    .from('doctor_profiles')
    .select(DOCTOR_PROFILE_SELECT)
    .eq('user_id', userId)
    .maybeSingle();

  if (error) return { doctor: null, error: error.message };
  if (!data) return { doctor: null };

  const row = data as unknown as DoctorProfileRow;
  const { data: profileRow } = await supabase.from('profiles').select('full_name').eq('id', row.user_id).maybeSingle();
  return { doctor: mapDoctorRow(row, profileRow?.full_name || 'Doctor') };
};

const bucketSlot = (slot: string): 'morning' | 'afternoon' | 'evening' => {
  const match = slot.match(/(\d{1,2}):\d{2}\s?(AM|PM)/i);
  if (!match) return 'morning';
  let hour = parseInt(match[1], 10);
  const period = match[2].toUpperCase();
  if (period === 'PM' && hour !== 12) hour += 12;
  if (period === 'AM' && hour === 12) hour = 0;
  if (hour < 12) return 'morning';
  if (hour < 17) return 'afternoon';
  return 'evening';
};

/**
 * Real open slots for one doctor on one date — from public.doctor_schedule,
 * not a static per-doctor template. Buckets them into morning/afternoon/
 * evening so the existing 3-column slot picker keeps working unchanged.
 */
export const fetchAvailableSlots = async (
  doctorProfileId: string,
  dateIso: string
): Promise<{ morning: string[]; afternoon: string[]; evening: string[] }> => {
  const { data } = await supabase
    .from('doctor_schedule')
    .select('time_slot')
    .eq('doctor_profile_id', doctorProfileId)
    .eq('schedule_date', dateIso)
    .eq('is_booked', false)
    .order('time_slot', { ascending: true });

  const buckets = { morning: [] as string[], afternoon: [] as string[], evening: [] as string[] };
  for (const row of data || []) {
    buckets[bucketSlot(row.time_slot)].push(row.time_slot);
  }
  return buckets;
};
