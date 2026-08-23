import { CountryOption, InsuranceOption, UserCategory, LocalFormData, InternationalFormData } from '../types';

export const TANZANIAN_INSURANCES: InsuranceOption[] = [
  { id: 'nhif', name: 'NHIF (National Health Insurance Fund)', badge: 'Serikali / Public', type: 'public' },
  { id: 'jubilee', name: 'Jubilee Health Insurance Tanzania', badge: 'Private Tier 1', type: 'private' },
  { id: 'aar', name: 'AAR Insurance Tanzania', badge: 'Private Tier 1', type: 'private' },
  { id: 'strategis', name: 'Strategis Insurance Tanzania', badge: 'Private Tier 1', type: 'private' },
  { id: 'britam', name: 'Britam Insurance Tanzania', badge: 'Private', type: 'private' },
  { id: 'sanlam', name: 'Sanlam Life & Health', badge: 'Private', type: 'private' },
  { id: 'chf', name: 'iCHF (Improved Community Health Fund)', badge: 'Community', type: 'public' },
  { id: 'out_of_pocket', name: 'Self Pay / Out of Pocket (Hakuna Bima)', badge: 'Direct Pay', type: 'private' },
];

export const INTERNATIONAL_INSURANCES: InsuranceOption[] = [
  { id: 'allianz', name: 'Allianz Worldwide Care / Global Health', badge: 'Global', type: 'international' },
  { id: 'bupa', name: 'Bupa Global International', badge: 'Global', type: 'international' },
  { id: 'cigna', name: 'Cigna Global Health Benefits', badge: 'Global', type: 'international' },
  { id: 'axa', name: 'AXA Global Healthcare', badge: 'Global', type: 'international' },
  { id: 'travel_guard', name: 'AIG Travel Guard Insurance', badge: 'Travel Pass', type: 'international' },
  { id: 'visitors_cover', name: 'Tanzania Inbound Visitors Emergency Cover', badge: 'Local Partner', type: 'international' },
  { id: 'no_insurance', name: 'None / Self-Pay Guarantee (Deposit)', badge: 'Self-Funded', type: 'international' },
];

export const COUNTRIES_LIST: CountryOption[] = [
  { code: 'TZ', name: 'Tanzania', flag: '🇹🇿', dialCode: '+255' },
  { code: 'KE', name: 'Kenya', flag: '🇰🇪', dialCode: '+254' },
  { code: 'UG', name: 'Uganda', flag: '🇺🇬', dialCode: '+256' },
  { code: 'RW', name: 'Rwanda', flag: '🇷🇼', dialCode: '+250' },
  { code: 'BI', name: 'Burundi', flag: '🇧🇮', dialCode: '+257' },
  { code: 'CD', name: 'DR Congo', flag: '🇨🇩', dialCode: '+243' },
  { code: 'SS', name: 'South Sudan', flag: '🇸🇸', dialCode: '+211' },
  { code: 'ZM', name: 'Zambia', flag: '🇿🇲', dialCode: '+260' },
  { code: 'MW', name: 'Malawi', flag: '🇲🇼', dialCode: '+265' },
  { code: 'MZ', name: 'Mozambique', flag: '🇲🇿', dialCode: '+258' },
  { code: 'ZA', name: 'South Africa', flag: '🇿🇦', dialCode: '+27' },
  { code: 'NG', name: 'Nigeria', flag: '🇳🇬', dialCode: '+234' },
  { code: 'GH', name: 'Ghana', flag: '🇬🇭', dialCode: '+233' },
  { code: 'EG', name: 'Egypt', flag: '🇪🇬', dialCode: '+20' },
  { code: 'ET', name: 'Ethiopia', flag: '🇪🇹', dialCode: '+251' },
  { code: 'GB', name: 'United Kingdom', flag: '🇬🇧', dialCode: '+44' },
  { code: 'US', name: 'United States', flag: '🇺🇸', dialCode: '+1' },
  { code: 'CA', name: 'Canada', flag: '🇨🇦', dialCode: '+1' },
  { code: 'DE', name: 'Germany', flag: '🇩🇪', dialCode: '+49' },
  { code: 'FR', name: 'France', flag: '🇫🇷', dialCode: '+33' },
  { code: 'IT', name: 'Italy', flag: '🇮🇹', dialCode: '+39' },
  { code: 'ES', name: 'Spain', flag: '🇪🇸', dialCode: '+34' },
  { code: 'AE', name: 'United Arab Emirates', flag: '🇦🇪', dialCode: '+971' },
  { code: 'SA', name: 'Saudi Arabia', flag: '🇸🇦', dialCode: '+966' },
  { code: 'IN', name: 'India', flag: '🇮🇳', dialCode: '+91' },
  { code: 'CN', name: 'China', flag: '🇨🇳', dialCode: '+86' },
  { code: 'JP', name: 'Japan', flag: '🇯🇵', dialCode: '+81' },
  { code: 'NL', name: 'Netherlands', flag: '🇳🇱', dialCode: '+31' },
  { code: 'SE', name: 'Sweden', flag: '🇸🇪', dialCode: '+46' },
  { code: 'NO', name: 'Norway', flag: '🇳🇴', dialCode: '+47' },
  { code: 'CH', name: 'Switzerland', flag: '🇨🇭', dialCode: '+41' },
  { code: 'AU', name: 'Australia', flag: '🇦🇺', dialCode: '+61' },
  { code: 'NZ', name: 'New Zealand', flag: '🇳🇿', dialCode: '+64' },
  { code: 'BR', name: 'Brazil', flag: '🇧🇷', dialCode: '+55' },
];

export interface PatientCountryInfo {
  code: string;
  name: string;
  flag: string;
  dialCode: string;
  nationalityLabel: string;
  headerTitle: string;
}

export function getPatientCountry(
  userCategory: UserCategory,
  localData?: LocalFormData,
  intlData?: InternationalFormData
): PatientCountryInfo {
  if (userCategory === 'locals') {
    return {
      code: 'TZ',
      name: 'Tanzania',
      flag: '🇹🇿',
      dialCode: '+255',
      nationalityLabel: 'Tanzanian Citizen (Raia)',
      headerTitle: 'JAMHURI YA MUUNGANO WA TANZANIA',
    };
  }

  const nationalityQuery = (intlData?.nationality || '').trim().toLowerCase();
  const countryCodeQuery = (intlData?.countryCode || '').trim();

  // 1. Direct match by name, code, or dialCode
  let match = COUNTRIES_LIST.find(
    (c) =>
      c.name.toLowerCase() === nationalityQuery ||
      c.code.toLowerCase() === nationalityQuery ||
      (countryCodeQuery && c.dialCode === countryCodeQuery)
  );

  // 2. Common aliases/substrings
  if (!match && nationalityQuery) {
    if (nationalityQuery.includes('usa') || nationalityQuery.includes('america') || nationalityQuery.includes('united states')) {
      match = COUNTRIES_LIST.find((c) => c.code === 'US');
    } else if (
      nationalityQuery.includes('uk') ||
      nationalityQuery.includes('britain') ||
      nationalityQuery.includes('british') ||
      nationalityQuery.includes('england') ||
      nationalityQuery.includes('united kingdom')
    ) {
      match = COUNTRIES_LIST.find((c) => c.code === 'GB');
    } else if (
      nationalityQuery.includes('uae') ||
      nationalityQuery.includes('dubai') ||
      nationalityQuery.includes('emirates')
    ) {
      match = COUNTRIES_LIST.find((c) => c.code === 'AE');
    } else if (nationalityQuery.includes('tanzan')) {
      match = COUNTRIES_LIST.find((c) => c.code === 'TZ');
    } else if (nationalityQuery.includes('kenya')) {
      match = COUNTRIES_LIST.find((c) => c.code === 'KE');
    } else if (nationalityQuery.includes('ugand')) {
      match = COUNTRIES_LIST.find((c) => c.code === 'UG');
    } else if (nationalityQuery.includes('rwand')) {
      match = COUNTRIES_LIST.find((c) => c.code === 'RW');
    } else if (nationalityQuery.includes('burund')) {
      match = COUNTRIES_LIST.find((c) => c.code === 'BI');
    } else if (nationalityQuery.includes('congo')) {
      match = COUNTRIES_LIST.find((c) => c.code === 'CD');
    } else if (nationalityQuery.includes('south africa')) {
      match = COUNTRIES_LIST.find((c) => c.code === 'ZA');
    } else if (nationalityQuery.includes('german')) {
      match = COUNTRIES_LIST.find((c) => c.code === 'DE');
    } else if (nationalityQuery.includes('french') || nationalityQuery.includes('france')) {
      match = COUNTRIES_LIST.find((c) => c.code === 'FR');
    } else if (nationalityQuery.includes('ital')) {
      match = COUNTRIES_LIST.find((c) => c.code === 'IT');
    } else if (nationalityQuery.includes('span') || nationalityQuery.includes('spain')) {
      match = COUNTRIES_LIST.find((c) => c.code === 'ES');
    } else if (nationalityQuery.includes('india')) {
      match = COUNTRIES_LIST.find((c) => c.code === 'IN');
    } else if (nationalityQuery.includes('china') || nationalityQuery.includes('chinese')) {
      match = COUNTRIES_LIST.find((c) => c.code === 'CN');
    } else if (nationalityQuery.includes('japan')) {
      match = COUNTRIES_LIST.find((c) => c.code === 'JP');
    } else if (nationalityQuery.includes('canad')) {
      match = COUNTRIES_LIST.find((c) => c.code === 'CA');
    } else if (nationalityQuery.includes('australi')) {
      match = COUNTRIES_LIST.find((c) => c.code === 'AU');
    }
  }

  // 3. Fallback matching by dialCode if not already matched
  if (!match && countryCodeQuery) {
    match = COUNTRIES_LIST.find((c) => c.dialCode === countryCodeQuery);
  }

  if (match) {
    return {
      code: match.code,
      name: match.name,
      flag: match.flag,
      dialCode: match.dialCode,
      nationalityLabel: `${match.name} National`,
      headerTitle: match.name.toUpperCase(),
    };
  }

  const rawName = intlData?.nationality || 'International';
  return {
    code: 'INTL',
    name: rawName,
    flag: '🌐',
    dialCode: intlData?.countryCode || '+1',
    nationalityLabel: rawName !== 'International' ? `${rawName} National` : 'International Visitor',
    headerTitle: rawName.toUpperCase(),
  };
}

export const NEARBY_HOSPITALS = [
  { name: 'Muhimbili National Hospital (MNH)', distance: '3.4 km', eta: '6 mins', type: 'Level 5 Super-Specialised', hotline: '+255 22 215 1367' },
  { name: 'The Aga Khan Hospital, Dar es Salaam', distance: '2.1 km', eta: '4 mins', type: 'JCI Accredited Trauma Center', hotline: '+255 22 211 5151' },
  { name: 'Hubert Kairuki Memorial Hospital', distance: '4.8 km', eta: '9 mins', type: 'General & Emergency Care', hotline: '+255 22 277 5510' },
  { name: 'Sanitas Hospital Mikocheni', distance: '5.2 km', eta: '11 mins', type: '24/7 Rapid Emergency Unit', hotline: '+255 754 710 400' },
];
