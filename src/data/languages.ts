export interface WorldLanguage {
  code: string;
  name: string;
  nativeName: string;
  flag: string;
  region: 'Africa' | 'Europe' | 'Americas' | 'Asia' | 'Middle East' | 'Global';
  isPopular?: boolean;
  direction?: 'ltr' | 'rtl';
}

export const WORLD_LANGUAGES: WorldLanguage[] = [
  // Primary / Featured
  { code: 'sw', name: 'Swahili', nativeName: 'Kiswahili', flag: '🇹🇿', region: 'Africa', isPopular: true },
  { code: 'en', name: 'English', nativeName: 'English', flag: '🇬🇧', region: 'Global', isPopular: true },
  { code: 'fr', name: 'French', nativeName: 'Français', flag: '🇫🇷', region: 'Europe', isPopular: true },
  { code: 'ar', name: 'Arabic', nativeName: 'العربية', flag: '🇸🇦', region: 'Middle East', isPopular: true, direction: 'rtl' },
  { code: 'es', name: 'Spanish', nativeName: 'Español', flag: '🇪🇸', region: 'Americas', isPopular: true },
  { code: 'pt', name: 'Portuguese', nativeName: 'Português', flag: '🇵🇹', region: 'Europe', isPopular: true },
  { code: 'de', name: 'German', nativeName: 'Deutsch', flag: '🇩🇪', region: 'Europe', isPopular: true },
  { code: 'zh', name: 'Chinese (Simplified)', nativeName: '中文 (简体)', flag: '🇨🇳', region: 'Asia', isPopular: true },
  { code: 'hi', name: 'Hindi', nativeName: 'हिन्दी', flag: '🇮🇳', region: 'Asia', isPopular: true },
  { code: 'ja', name: 'Japanese', nativeName: '日本語', flag: '🇯🇵', region: 'Asia', isPopular: true },
  { code: 'ru', name: 'Russian', nativeName: 'Русский', flag: '🇷🇺', region: 'Europe', isPopular: true },
  
  // Africa
  { code: 'so', name: 'Somali', nativeName: 'Soomaaliga', flag: '🇸🇴', region: 'Africa', isPopular: true },
  { code: 'am', name: 'Amharic', nativeName: 'አማርኛ', flag: '🇪🇹', region: 'Africa', isPopular: true },
  { code: 'om', name: 'Oromo', nativeName: 'Afaan Oromoo', flag: '🇪🇹', region: 'Africa' },
  { code: 'yo', name: 'Yoruba', nativeName: 'Èdè Yorùbá', flag: '🇳🇬', region: 'Africa', isPopular: true },
  { code: 'ha', name: 'Hausa', nativeName: 'Harshen Hausa', flag: '🇳🇬', region: 'Africa', isPopular: true },
  { code: 'ig', name: 'Igbo', nativeName: 'Asụsụ Igbo', flag: '🇳🇬', region: 'Africa' },
  { code: 'zu', name: 'Zulu', nativeName: 'isiZulu', flag: '🇿🇦', region: 'Africa', isPopular: true },
  { code: 'af', name: 'Afrikaans', nativeName: 'Afrikaans', flag: '🇿🇦', region: 'Africa' },
  { code: 'rw', name: 'Kinyarwanda', nativeName: 'Ikinyarwanda', flag: '🇷🇼', region: 'Africa', isPopular: true },
  { code: 'rn', name: 'Kirundi', nativeName: 'Ikirundi', flag: '🇧🇮', region: 'Africa' },
  { code: 'lg', name: 'Luganda', nativeName: 'Oluganda', flag: '🇺🇬', region: 'Africa' },
  { code: 'mg', name: 'Malagasy', nativeName: 'Fiteny Malagasy', flag: '🇲🇬', region: 'Africa' },
  { code: 'sn', name: 'Shona', nativeName: 'chiShona', flag: '🇿🇼', region: 'Africa' },
  { code: 'ny', name: 'Chichewa', nativeName: 'ChiCheŵa', flag: '🇲🇼', region: 'Africa' },
  { code: 'ti', name: 'Tigrinya', nativeName: 'ትግርኛ', flag: '🇪🇷', region: 'Africa' },
  { code: 'xh', name: 'Xhosa', nativeName: 'isiXhosa', flag: '🇿🇦', region: 'Africa' },
  { code: 'st', name: 'Sesotho', nativeName: 'Sesotho', flag: '🇱🇸', region: 'Africa' },
  { code: 'wo', name: 'Wolof', nativeName: 'Wolof', flag: '🇸🇳', region: 'Africa' },
  { code: 'ln', name: 'Lingala', nativeName: 'Lingála', flag: '🇨🇩', region: 'Africa' },
  
  // Europe
  { code: 'it', name: 'Italian', nativeName: 'Italiano', flag: '🇮🇹', region: 'Europe', isPopular: true },
  { code: 'nl', name: 'Dutch', nativeName: 'Nederlands', flag: '🇳🇱', region: 'Europe', isPopular: true },
  { code: 'tr', name: 'Turkish', nativeName: 'Türkçe', flag: '🇹🇷', region: 'Europe', isPopular: true },
  { code: 'pl', name: 'Polish', nativeName: 'Polski', flag: '🇵🇱', region: 'Europe' },
  { code: 'uk', name: 'Ukrainian', nativeName: 'Українська', flag: '🇺🇦', region: 'Europe' },
  { code: 'sv', name: 'Swedish', nativeName: 'Svenska', flag: '🇸🇪', region: 'Europe' },
  { code: 'no', name: 'Norwegian', nativeName: 'Norsk', flag: '🇳🇴', region: 'Europe' },
  { code: 'da', name: 'Danish', nativeName: 'Dansk', flag: '🇩🇰', region: 'Europe' },
  { code: 'fi', name: 'Finnish', nativeName: 'Suomi', flag: '🇫🇮', region: 'Europe' },
  { code: 'el', name: 'Greek', nativeName: 'Ελληνικά', flag: '🇬🇷', region: 'Europe' },
  { code: 'cs', name: 'Czech', nativeName: 'Čeština', flag: '🇨🇿', region: 'Europe' },
  { code: 'hu', name: 'Hungarian', nativeName: 'Magyar', flag: '🇭🇺', region: 'Europe' },
  { code: 'ro', name: 'Romanian', nativeName: 'Română', flag: '🇷🇴', region: 'Europe' },
  { code: 'bg', name: 'Bulgarian', nativeName: 'Български', flag: '🇧🇬', region: 'Europe' },
  { code: 'hr', name: 'Croatian', nativeName: 'Hrvatski', flag: '🇭🇷', region: 'Europe' },
  { code: 'sr', name: 'Serbian', nativeName: 'Српски', flag: '🇷🇸', region: 'Europe' },
  { code: 'sk', name: 'Slovak', nativeName: 'Slovenčina', flag: '🇸🇰', region: 'Europe' },
  { code: 'ga', name: 'Irish', nativeName: 'Gaeilge', flag: '🇮🇪', region: 'Europe' },

  // Asia & Pacific
  { code: 'ko', name: 'Korean', nativeName: '한국어', flag: '🇰🇷', region: 'Asia', isPopular: true },
  { code: 'id', name: 'Indonesian', nativeName: 'Bahasa Indonesia', flag: '🇮🇩', region: 'Asia', isPopular: true },
  { code: 'vi', name: 'Vietnamese', nativeName: 'Tiếng Việt', flag: '🇻🇳', region: 'Asia', isPopular: true },
  { code: 'th', name: 'Thai', nativeName: 'ไทย', flag: '🇹🇭', region: 'Asia' },
  { code: 'bn', name: 'Bengali', nativeName: 'বাংলা', flag: '🇧🇩', region: 'Asia' },
  { code: 'ur', name: 'Urdu', nativeName: 'اردو', flag: '🇵🇰', region: 'Asia', direction: 'rtl' },
  { code: 'ms', name: 'Malay', nativeName: 'Bahasa Melayu', flag: '🇲🇾', region: 'Asia' },
  { code: 'tl', name: 'Filipino (Tagalog)', nativeName: 'Tagalog', flag: '🇵🇭', region: 'Asia' },
  { code: 'ta', name: 'Tamil', nativeName: 'தமிழ்', flag: '🇮🇳', region: 'Asia' },
  { code: 'te', name: 'Telugu', nativeName: 'తెలుగు', flag: '🇮🇳', region: 'Asia' },
  { code: 'mr', name: 'Marathi', nativeName: 'मराठी', flag: '🇮🇳', region: 'Asia' },
  { code: 'gu', name: 'Gujarati', nativeName: 'ગુજરાતી', flag: '🇮🇳', region: 'Asia' },
  { code: 'pa', name: 'Punjabi', nativeName: 'ਪੰਜਾਬੀ', flag: '🇮🇳', region: 'Asia' },
  { code: 'my', name: 'Burmese', nativeName: 'မြန်မာစာ', flag: '🇲🇲', region: 'Asia' },
  { code: 'km', name: 'Khmer', nativeName: 'ភាសាខ្មែរ', flag: '🇰🇭', region: 'Asia' },
  { code: 'ne', name: 'Nepali', nativeName: 'नेपाली', flag: '🇳🇵', region: 'Asia' },
  { code: 'si', name: 'Sinhala', nativeName: 'සිංහල', flag: '🇱🇰', region: 'Asia' },

  // Middle East & West Asia
  { code: 'fa', name: 'Persian (Farsi)', nativeName: 'فارسی', flag: '🇮🇷', region: 'Middle East', direction: 'rtl' },
  { code: 'he', name: 'Hebrew', nativeName: 'עברית', flag: '🇮🇱', region: 'Middle East', direction: 'rtl' },
  { code: 'ku', name: 'Kurdish', nativeName: 'Kurdî', flag: '🇮🇶', region: 'Middle East' },
  { code: 'ps', name: 'Pashto', nativeName: 'پښتو', flag: '🇦🇫', region: 'Middle East', direction: 'rtl' },
  { code: 'az', name: 'Azerbaijani', nativeName: 'Azərbaycan dili', flag: '🇦🇿', region: 'Middle East' },
  { code: 'uz', name: 'Uzbek', nativeName: 'Oʻzbekcha', flag: '🇺🇿', region: 'Asia' },
  { code: 'kk', name: 'Kazakh', nativeName: 'Қазақ тілі', flag: '🇰🇿', region: 'Asia' },
];
