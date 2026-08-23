export interface InsuranceScheme {
  id: string;
  name: string;
  type: 'public' | 'private';
  code: string;
  popular?: boolean;
}

export const TANZANIA_INSURANCE_PROVIDERS: InsuranceScheme[] = [
  { id: 'nhif', name: 'NHIF (Mfuko wa Taifa wa Bima ya Afya)', type: 'public', code: 'NHIF', popular: true },
  { id: 'chf', name: 'CHF / iCHF (Community Health Fund)', type: 'public', code: 'CHF', popular: true },
  { id: 'jubilee', name: 'Jubilee Health Insurance Tanzania', type: 'private', code: 'JUB', popular: true },
  { id: 'aar', name: 'AAR Insurance Tanzania', type: 'private', code: 'AAR', popular: true },
  { id: 'strategis', name: 'Strategis Insurance Tanzania', type: 'private', code: 'STRAT' },
  { id: 'resolution', name: 'Resolution Insurance', type: 'private', code: 'RES' },
  { id: 'britam', name: 'Britam Insurance Tanzania', type: 'private', code: 'BRIT' },
  { id: 'sanlam', name: 'Sanlam Life Insurance', type: 'private', code: 'SAN' },
  { id: 'alliance', name: 'Alliance Life Assurance', type: 'private', code: 'ALL' },
  { id: 'first_assurance', name: 'First Assurance Tanzania', type: 'private', code: 'FA' },
  { id: 'other', name: 'Bima Nyingine (Other Provider)', type: 'private', code: 'OTH' },
];
