import { supabase } from './supabaseClient';
import { LocalFormData, InternationalFormData, UserCategory, LocalDocType } from '../types';

export type OtpAuthChannel = 'phone' | 'email';

export interface SendOtpResult {
  success: boolean;
  error?: string;
}

/**
 * Sends a real OTP via Supabase Auth (SMS through the configured provider, or email).
 * shouldCreateUser=false makes "login" fail clearly for numbers/emails with no account,
 * instead of silently registering a new one.
 */
export const sendOtp = async (
  channel: OtpAuthChannel,
  target: string,
  shouldCreateUser: boolean
): Promise<SendOtpResult> => {
  const { error } =
    channel === 'phone'
      ? await supabase.auth.signInWithOtp({ phone: target, options: { shouldCreateUser } })
      : await supabase.auth.signInWithOtp({ email: target, options: { shouldCreateUser } });

  if (error) return { success: false, error: error.message };
  return { success: true };
};

export interface VerifyOtpResult {
  success: boolean;
  error?: string;
  userId?: string;
}

export const verifyOtp = async (
  channel: OtpAuthChannel,
  target: string,
  token: string
): Promise<VerifyOtpResult> => {
  const { data, error } =
    channel === 'phone'
      ? await supabase.auth.verifyOtp({ phone: target, token, type: 'sms' })
      : await supabase.auth.verifyOtp({ email: target, token, type: 'email' });

  if (error) return { success: false, error: error.message };
  const userId = data.user?.id;
  if (!userId) return { success: false, error: 'Verification succeeded but no session was returned.' };
  return { success: true, userId };
};

export interface ProfileRow {
  id: string;
  user_category: UserCategory;
  full_name: string;
  age: string | null;
  gender: string | null;
  blood_type: string | null;
  dob: string | null;
  phone: string | null;
  email: string | null;
  doc_type: string | null;
  nida_number: string | null;
  insurance_provider: string | null;
  insurance_number: string | null;
  birth_cert_id: string | null;
  passport_number: string | null;
  nationality: string | null;
  country_code: string | null;
  travel_insurance_provider: string | null;
}

const buildDob = (year?: string, month?: string, day?: string): string | null => {
  if (!year || !month || !day) return null;
  return `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`;
};

// Local subscriber numbers are dialed with a leading 0 (e.g. 0627990768) but
// E.164 requires it stripped (+255627990768, not +2550627990768).
const toE164Digits = (raw: string): string => raw.replace(/\D/g, '').replace(/^0+/, '');

export const buildProfilePayload = (
  userId: string,
  userCategory: UserCategory,
  localData: LocalFormData,
  intlData: InternationalFormData
): ProfileRow => {
  if (userCategory === 'locals') {
    return {
      id: userId,
      user_category: 'locals',
      full_name: localData.fullName,
      age: localData.age || null,
      gender: localData.gender || null,
      blood_type: localData.bloodType || null,
      dob: buildDob(localData.birthYear, localData.birthMonth, localData.birthDay),
      phone: localData.phone ? `+255${toE164Digits(localData.phone)}` : null,
      email: localData.email || null,
      doc_type: localData.selectedDocType,
      nida_number: localData.nidaNumber || null,
      insurance_provider: localData.insuranceProvider || null,
      insurance_number: localData.insuranceNumber || null,
      birth_cert_id: localData.birthCertId || null,
      passport_number: null,
      nationality: null,
      country_code: null,
      travel_insurance_provider: null,
    };
  }

  return {
    id: userId,
    user_category: 'internationals',
    full_name: intlData.fullName,
    age: intlData.age || null,
    gender: intlData.gender || null,
    blood_type: intlData.bloodType || null,
    dob: buildDob(intlData.birthYear, intlData.birthMonth, intlData.birthDay),
    phone: intlData.phone ? `${intlData.countryCode || ''}${toE164Digits(intlData.phone)}` : null,
    email: intlData.email || null,
    doc_type: null,
    nida_number: null,
    insurance_provider: null,
    insurance_number: intlData.insuranceNumber || null,
    birth_cert_id: null,
    passport_number: intlData.passportNumber || null,
    nationality: intlData.nationality || null,
    country_code: intlData.countryCode || null,
    travel_insurance_provider: intlData.travelInsuranceProvider || null,
  };
};

export const upsertProfile = async (payload: ProfileRow): Promise<{ success: boolean; error?: string }> => {
  const { error } = await supabase.from('profiles').upsert(payload);
  if (error) return { success: false, error: error.message };
  return { success: true };
};

export const fetchProfile = async (
  userId: string
): Promise<{ profile: ProfileRow | null; error?: string }> => {
  const { data, error } = await supabase.from('profiles').select('*').eq('id', userId).maybeSingle();
  if (error) return { profile: null, error: error.message };
  return { profile: data as ProfileRow | null };
};

export const mapProfileToFormData = (
  profile: ProfileRow
): {
  userCategory: UserCategory;
  localData?: Partial<LocalFormData>;
  intlData?: Partial<InternationalFormData>;
} => {
  const parts = profile.dob ? profile.dob.split('-') : [];
  const [birthYear, birthMonth, birthDay] = parts;

  if (profile.user_category === 'locals') {
    return {
      userCategory: 'locals',
      localData: {
        fullName: profile.full_name,
        age: profile.age || '',
        gender: (profile.gender as LocalFormData['gender']) || '',
        bloodType: profile.blood_type || '',
        birthYear,
        birthMonth,
        birthDay,
        dob: profile.dob || '',
        phone: profile.phone ? profile.phone.replace(/^\+255/, '') : '',
        email: profile.email || '',
        selectedDocType: (profile.doc_type as LocalDocType) || 'nida',
        nidaNumber: profile.nida_number || '',
        insuranceProvider: profile.insurance_provider || '',
        insuranceNumber: profile.insurance_number || '',
        birthCertId: profile.birth_cert_id || '',
      },
    };
  }

  return {
    userCategory: 'internationals',
    intlData: {
      fullName: profile.full_name,
      age: profile.age || '',
      gender: (profile.gender as InternationalFormData['gender']) || '',
      bloodType: profile.blood_type || '',
      birthYear,
      birthMonth,
      birthDay,
      dob: profile.dob || '',
      passportNumber: profile.passport_number || '',
      nationality: profile.nationality || '',
      phone:
        profile.phone && profile.country_code
          ? profile.phone.replace(profile.country_code, '')
          : profile.phone || '',
      countryCode: profile.country_code || '+1',
      email: profile.email || '',
      travelInsuranceProvider: profile.travel_insurance_provider || '',
      insuranceNumber: profile.insurance_number || '',
    },
  };
};

export const signOut = async (): Promise<void> => {
  await supabase.auth.signOut();
};
