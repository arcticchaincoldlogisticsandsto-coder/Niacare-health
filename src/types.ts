export type UserCategory = 'locals' | 'internationals';

export type Language = 'en' | 'sw' | 'fr';

export type Theme = 'light' | 'dark';

export type UserRole = 'patient' | 'doctor' | 'provider_staff' | 'admin';

export type UserStatus = 'pending' | 'active' | 'suspended';

export type OtpDeliveryChannel = 'phone' | 'email';

export type LocalDocType = 'nida' | 'insurance' | 'birth_cert';

export type BloodGroup = 'A+' | 'A-' | 'B+' | 'B-' | 'AB+' | 'AB-' | 'O+' | 'O-' | 'unknown' | '';

export interface LocalFormData {
  fullName: string;
  age: string;
  gender: 'male' | 'female' | 'other' | '';
  bloodType?: string;
  phone: string;
  email?: string;
  birthDay?: string;
  birthMonth?: string;
  birthYear?: string;
  dob?: string;
  selectedDocType: LocalDocType;
  nidaNumber: string;
  insuranceProvider: string;
  insuranceNumber: string;
  birthCertId: string;
}

export interface InternationalFormData {
  fullName: string;
  age: string;
  gender: 'male' | 'female' | 'other' | '';
  bloodType?: string;
  passportNumber: string;
  nationality: string;
  phone: string;
  countryCode: string;
  email: string;
  birthDay?: string;
  birthMonth?: string;
  birthYear?: string;
  dob?: string;
  travelInsuranceProvider: string;
  insuranceNumber: string;
}

export interface InsuranceOption {
  id: string;
  name: string;
  badge?: string;
  type: 'public' | 'private' | 'international';
}

export interface CountryOption {
  code: string;
  name: string;
  flag: string;
  dialCode: string;
}

export interface EmergencyDispatchState {
  isOpen: boolean;
  victimType: string;
  locationAddress: string;
  latitude: number | null;
  longitude: number | null;
  countdown: number;
  isDispatched: boolean;
  dispatchId: string | null;
}

export interface ProfileRecord {
  id: string;
  user_category: UserCategory;
  role: UserRole;
  status: UserStatus;
  full_name: string;
  age?: string | null;
  gender?: string | null;
  blood_type?: string | null;
  dob?: string | null;
  phone?: string | null;
  email?: string | null;
  doc_type?: LocalDocType | null;
  nida_number?: string | null;
  insurance_provider?: string | null;
  insurance_number?: string | null;
  birth_cert_id?: string | null;
  passport_number?: string | null;
  nationality?: string | null;
  country_code?: string | null;
  travel_insurance_provider?: string | null;
  created_at?: string;
  updated_at?: string;
}

export type UserProfile = ProfileRecord;
