export type UserCategory = 'locals' | 'internationals';
export type Language = string;
export type Theme = 'light' | 'dark';

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
