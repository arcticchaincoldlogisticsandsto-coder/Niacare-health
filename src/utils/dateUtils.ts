export interface MonthOption {
  value: string; // '01' to '12'
  names: Record<string, string>; // { sw: 'Januari', en: 'January', fr: 'Janvier', ar: 'يناير' }
  shortNames: Record<string, string>; // { sw: 'Jan', en: 'Jan', fr: 'Jan', ar: 'يناير' }
}

export const MONTHS_LIST: MonthOption[] = [
  {
    value: '01',
    names: { sw: 'Januari', en: 'January', fr: 'Janvier', ar: 'يناير' },
    shortNames: { sw: 'Jan', en: 'Jan', fr: 'Jan', ar: 'يناير' },
  },
  {
    value: '02',
    names: { sw: 'Februari', en: 'February', fr: 'Février', ar: 'فبراير' },
    shortNames: { sw: 'Feb', en: 'Feb', fr: 'Fév', ar: 'فبراير' },
  },
  {
    value: '03',
    names: { sw: 'Machi', en: 'March', fr: 'Mars', ar: 'مارس' },
    shortNames: { sw: 'Mac', en: 'Mar', fr: 'Mar', ar: 'مارس' },
  },
  {
    value: '04',
    names: { sw: 'Aprili', en: 'April', fr: 'Avril', ar: 'أبريل' },
    shortNames: { sw: 'Apr', en: 'Apr', fr: 'Avr', ar: 'أبريل' },
  },
  {
    value: '05',
    names: { sw: 'Mei', en: 'May', fr: 'Mai', ar: 'مايو' },
    shortNames: { sw: 'Mei', en: 'May', fr: 'Mai', ar: 'مايو' },
  },
  {
    value: '06',
    names: { sw: 'Juni', en: 'June', fr: 'Juin', ar: 'يونيو' },
    shortNames: { sw: 'Jun', en: 'Jun', fr: 'Juin', ar: 'يونيو' },
  },
  {
    value: '07',
    names: { sw: 'Julai', en: 'July', fr: 'Juillet', ar: 'يوليو' },
    shortNames: { sw: 'Jul', en: 'Jul', fr: 'Juil', ar: 'يوليو' },
  },
  {
    value: '08',
    names: { sw: 'Agosti', en: 'August', fr: 'Août', ar: 'أغسطس' },
    shortNames: { sw: 'Ago', en: 'Aug', fr: 'Août', ar: 'أغسطس' },
  },
  {
    value: '09',
    names: { sw: 'Septemba', en: 'September', fr: 'Septembre', ar: 'سبتمبر' },
    shortNames: { sw: 'Sep', en: 'Sep', fr: 'Sep', ar: 'سبتمبر' },
  },
  {
    value: '10',
    names: { sw: 'Oktoba', en: 'October', fr: 'Octobre', ar: 'أكتوبر' },
    shortNames: { sw: 'Okt', en: 'Oct', fr: 'Oct', ar: 'أكتوبر' },
  },
  {
    value: '11',
    names: { sw: 'Novemba', en: 'November', fr: 'Novembre', ar: 'نوفمبر' },
    shortNames: { sw: 'Nov', en: 'Nov', fr: 'Nov', ar: 'نوفمبر' },
  },
  {
    value: '12',
    names: { sw: 'Desemba', en: 'December', fr: 'Décembre', ar: 'ديسمبر' },
    shortNames: { sw: 'Des', en: 'Dec', fr: 'Déc', ar: 'ديسمبر' },
  },
];

// Days array: 01 to 31
export const DAYS_LIST: string[] = Array.from({ length: 31 }, (_, i) => {
  const d = i + 1;
  return d < 10 ? `0${d}` : `${d}`;
});

// Years array: 2026 down to 1920
const CURRENT_YEAR = new Date().getFullYear();
export const YEARS_LIST: string[] = Array.from({ length: 105 }, (_, i) => `${CURRENT_YEAR - i}`);

/**
 * Calculates exact age in years from Day, Month, Year
 */
export function calculateAgeFromDob(year?: string, month?: string, day?: string): string {
  if (!year) return '';
  const y = parseInt(year, 10);
  if (isNaN(y) || y < 1900 || y > CURRENT_YEAR) return '';

  const m = month ? parseInt(month, 10) - 1 : 0;
  const d = day ? parseInt(day, 10) : 1;

  const today = new Date();
  const birthDate = new Date(y, m, d);

  let age = today.getFullYear() - birthDate.getFullYear();
  const monthDiff = today.getMonth() - birthDate.getMonth();

  if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birthDate.getDate())) {
    age--;
  }

  return age >= 0 ? `${age}` : '0';
}

/**
 * Formats a clean, localized Date of Birth string
 */
export function formatDob(
  year?: string,
  month?: string,
  day?: string,
  lang: string = 'en'
): string {
  if (!year) return '';
  const mObj = MONTHS_LIST.find((m) => m.value === month);
  const monthName = mObj?.names[lang] || mObj?.names['en'] || month || '';

  if (day && monthName && year) {
    return `${parseInt(day, 10)} ${monthName} ${year}`;
  }
  if (monthName && year) {
    return `${monthName} ${year}`;
  }
  return `${year}`;
}

/**
 * In Tanzania, the 20-digit NIDA National ID starts with YYYYMMDD (e.g. 19950412...)
 * Extracts birth year, month, and day if valid.
 */
export function extractDobFromNida(nidaNumber: string): {
  year?: string;
  month?: string;
  day?: string;
  isValid: boolean;
} {
  const cleaned = (nidaNumber || '').replace(/[^\d]/g, '');
  if (cleaned.length < 8) {
    return { isValid: false };
  }

  const yStr = cleaned.slice(0, 4);
  const mStr = cleaned.slice(4, 6);
  const dStr = cleaned.slice(6, 8);

  const y = parseInt(yStr, 10);
  const m = parseInt(mStr, 10);
  const d = parseInt(dStr, 10);

  if (y >= 1920 && y <= CURRENT_YEAR && m >= 1 && m <= 12 && d >= 1 && d <= 31) {
    return {
      year: yStr,
      month: mStr,
      day: dStr,
      isValid: true,
    };
  }

  return { isValid: false };
}

/**
 * Returns ISO Date string (YYYY-MM-DD) for today or N days in future
 */
export function getUpcomingDateISO(daysAhead: number = 0): string {
  const d = new Date();
  if (daysAhead !== 0) {
    d.setDate(d.getDate() + daysAhead);
  }
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export function getTodayISO(): string {
  return getUpcomingDateISO(0);
}

const SWAHILI_DAYS = ['Jumapili', 'Jumatatu', 'Jumanne', 'Jumatano', 'Alhamisi', 'Ijumaa', 'Jumamosi'];
const ENGLISH_DAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
const FRENCH_DAYS = ['Dimanche', 'Lundi', 'Mardi', 'Mercredi', 'Jeudi', 'Vendredi', 'Samedi'];

/**
 * Formats a real-time Date object into localized full date string
 */
export function formatLiveDate(date: Date, lang: string = 'en'): string {
  const dayIndex = date.getDay();
  const dayOfMonth = date.getDate();
  const monthNum = String(date.getMonth() + 1).padStart(2, '0');
  const year = date.getFullYear();

  const mObj = MONTHS_LIST.find((m) => m.value === monthNum);
  const monthName = mObj?.names[lang] || mObj?.names['en'] || 'August';

  let dayName = ENGLISH_DAYS[dayIndex];
  if (lang === 'sw') {
    dayName = SWAHILI_DAYS[dayIndex];
  } else if (lang === 'fr') {
    dayName = FRENCH_DAYS[dayIndex];
  }

  return `${dayName}, ${dayOfMonth} ${monthName} ${year}`;
}

/**
 * Formats real-time clock string
 */
export function formatLiveTime(date: Date, includeSeconds: boolean = false): string {
  const hours = String(date.getHours()).padStart(2, '0');
  const minutes = String(date.getMinutes()).padStart(2, '0');
  if (includeSeconds) {
    const seconds = String(date.getSeconds()).padStart(2, '0');
    return `${hours}:${minutes}:${seconds}`;
  }
  return `${hours}:${minutes}`;
}

