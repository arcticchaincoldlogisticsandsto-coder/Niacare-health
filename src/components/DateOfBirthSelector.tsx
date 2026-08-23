import React from 'react';
import { Calendar, Sparkles, ChevronDown, Check } from 'lucide-react';
import { Language, Theme } from '../types';
import { DAYS_LIST, MONTHS_LIST, YEARS_LIST, calculateAgeFromDob, formatDob } from '../utils/dateUtils';
import { TRANSLATIONS } from '../data/translations';

interface DateOfBirthSelectorProps {
  birthDay?: string;
  birthMonth?: string;
  birthYear?: string;
  age?: string;
  onChange: (updates: {
    birthDay?: string;
    birthMonth?: string;
    birthYear?: string;
    age: string;
    dob: string;
  }) => void;
  language: Language;
  theme?: Theme;
  showHelp?: boolean;
}

export const DateOfBirthSelector: React.FC<DateOfBirthSelectorProps> = ({
  birthDay = '',
  birthMonth = '',
  birthYear = '',
  age = '',
  onChange,
  language,
  theme = 'light',
  showHelp = true,
}) => {
  const isDark = theme === 'dark';
  const t = TRANSLATIONS.identity;

  const handleDayChange = (newDay: string) => {
    const calculatedAge = calculateAgeFromDob(birthYear, birthMonth, newDay);
    const dobString = newDay && birthMonth && birthYear ? `${birthYear}-${birthMonth}-${newDay}` : '';
    onChange({
      birthDay: newDay,
      birthMonth,
      birthYear,
      age: calculatedAge || age,
      dob: dobString,
    });
  };

  const handleMonthChange = (newMonth: string) => {
    const calculatedAge = calculateAgeFromDob(birthYear, newMonth, birthDay);
    const dobString = birthDay && newMonth && birthYear ? `${birthYear}-${newMonth}-${birthDay}` : '';
    onChange({
      birthDay,
      birthMonth: newMonth,
      birthYear,
      age: calculatedAge || age,
      dob: dobString,
    });
  };

  const handleYearChange = (newYear: string) => {
    const calculatedAge = calculateAgeFromDob(newYear, birthMonth, birthDay);
    const dobString = birthDay && birthMonth && newYear ? `${newYear}-${birthMonth}-${birthDay}` : '';
    onChange({
      birthDay,
      birthMonth,
      birthYear: newYear,
      age: calculatedAge || age,
      dob: dobString,
    });
  };

  // Handle native date input (e.g. from calendar picker)
  const handleNativeDateChange = (dateVal: string) => {
    if (!dateVal) return;
    const parts = dateVal.split('-');
    if (parts.length === 3) {
      const [y, m, d] = parts;
      const calculatedAge = calculateAgeFromDob(y, m, d);
      onChange({
        birthDay: d,
        birthMonth: m,
        birthYear: y,
        age: calculatedAge,
        dob: dateVal,
      });
    }
  };

  const formattedDate = formatDob(birthYear, birthMonth, birthDay, language);
  const nativeDateValue =
    birthYear && birthMonth && birthDay
      ? `${birthYear}-${birthMonth.padStart(2, '0')}-${birthDay.padStart(2, '0')}`
      : '';

  return (
    <div
      id="dob-selector-container"
      className={`rounded-2xl p-3 sm:p-3.5 border transition-all ${
        isDark ? 'bg-[#08121E] border-slate-700/80' : 'bg-[#F6F9FD] border-blue-100/90'
      }`}
    >
      {/* Header with Title and Age Badge */}
      <div className="flex items-center justify-between gap-2 mb-2.5">
        <div className="flex items-center gap-1.5">
          <div
            className={`w-5 h-5 rounded-lg flex items-center justify-center ${
              isDark ? 'bg-cyan-500/20 text-cyan-400' : 'bg-[#0A4275]/10 text-[#0A4275]'
            }`}
          >
            <Calendar className="w-3.5 h-3.5" />
          </div>
          <label className={`text-xs font-bold ${isDark ? 'text-slate-200' : 'text-slate-800'}`}>
            {t.dobLabel?.[language] || 'Tarehe ya Kuzaliwa (Date of Birth)'}
          </label>
        </div>

        {/* Calculated Age Live Badge */}
        {age ? (
          <div
            className={`flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold border transition-all ${
              isDark
                ? 'bg-cyan-950/80 border-cyan-700 text-cyan-300'
                : 'bg-blue-50 border-blue-200 text-[#0A4275]'
            }`}
          >
            <Sparkles className="w-3 h-3 text-cyan-400" />
            <span>
              {age} {t.yearsOld?.[language] || 'Miaka'}
            </span>
          </div>
        ) : (
          <span className={`text-[10px] ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>
            {t.dobDesc?.[language] || 'Siku / Mwezi / Mwaka'}
          </span>
        )}
      </div>

      {/* 3 Structured Dropdowns: Day + Month + Year + Native Picker */}
      <div className="grid grid-cols-12 gap-1.5 sm:gap-2">
        {/* 1. Day Selector (Col 3) */}
        <div className="col-span-3 sm:col-span-3 relative">
          <label className={`block text-[10px] font-bold mb-1 ${isDark ? 'text-slate-400' : 'text-slate-600'}`}>
            {t.birthDayLabel?.[language] || 'Siku (Day)'}
          </label>
          <div className="relative">
            <select
              id="select-dob-day"
              value={birthDay}
              onChange={(e) => handleDayChange(e.target.value)}
              className={`w-full text-xs font-mono font-bold rounded-xl pl-2.5 pr-6 py-2.5 border outline-none appearance-none cursor-pointer ${
                isDark
                  ? 'bg-[#0E1F33] text-white border-slate-700 focus:border-cyan-400'
                  : 'bg-white text-slate-900 border-slate-200 focus:border-[#0A4275] focus:ring-1 focus:ring-[#0A4275]/15'
              }`}
            >
              <option value="">DD</option>
              {DAYS_LIST.map((day) => (
                <option key={day} value={day}>
                  {day}
                </option>
              ))}
            </select>
            <div className="absolute inset-y-0 right-0 pr-1.5 flex items-center pointer-events-none text-slate-400">
              <ChevronDown className="w-3.5 h-3.5" />
            </div>
          </div>
        </div>

        {/* 2. Month Selector (Col 5) */}
        <div className="col-span-5 sm:col-span-5 relative">
          <label className={`block text-[10px] font-bold mb-1 ${isDark ? 'text-slate-400' : 'text-slate-600'}`}>
            {t.birthMonthLabel?.[language] || 'Mwezi (Month)'}
          </label>
          <div className="relative">
            <select
              id="select-dob-month"
              value={birthMonth}
              onChange={(e) => handleMonthChange(e.target.value)}
              className={`w-full text-xs font-bold rounded-xl pl-2.5 pr-6 py-2.5 border outline-none appearance-none cursor-pointer truncate ${
                isDark
                  ? 'bg-[#0E1F33] text-white border-slate-700 focus:border-cyan-400'
                  : 'bg-white text-slate-900 border-slate-200 focus:border-[#0A4275] focus:ring-1 focus:ring-[#0A4275]/15'
              }`}
            >
              <option value="">MM (Mwezi)</option>
              {MONTHS_LIST.map((m) => {
                const monthName = m.names[language] || m.names['sw'] || m.names['en'];
                return (
                  <option key={m.value} value={m.value}>
                    {m.value} - {monthName}
                  </option>
                );
              })}
            </select>
            <div className="absolute inset-y-0 right-0 pr-1.5 flex items-center pointer-events-none text-slate-400">
              <ChevronDown className="w-3.5 h-3.5" />
            </div>
          </div>
        </div>

        {/* 3. Year Selector (Col 4) */}
        <div className="col-span-4 sm:col-span-4 relative">
          <label className={`block text-[10px] font-bold mb-1 ${isDark ? 'text-slate-400' : 'text-slate-600'}`}>
            {t.birthYearLabel?.[language] || 'Mwaka (Year)'}
          </label>
          <div className="relative">
            <select
              id="select-dob-year"
              value={birthYear}
              onChange={(e) => handleYearChange(e.target.value)}
              className={`w-full text-xs font-mono font-bold rounded-xl pl-2.5 pr-6 py-2.5 border outline-none appearance-none cursor-pointer ${
                isDark
                  ? 'bg-[#0E1F33] text-white border-slate-700 focus:border-cyan-400'
                  : 'bg-white text-slate-900 border-slate-200 focus:border-[#0A4275] focus:ring-1 focus:ring-[#0A4275]/15'
              }`}
            >
              <option value="">YYYY</option>
              {YEARS_LIST.map((yr) => (
                <option key={yr} value={yr}>
                  {yr}
                </option>
              ))}
            </select>
            <div className="absolute inset-y-0 right-0 pr-1.5 flex items-center pointer-events-none text-slate-400">
              <ChevronDown className="w-3.5 h-3.5" />
            </div>
          </div>
        </div>
      </div>

      {/* Formatted Date Result & Quick Native Calendar picker helper */}
      <div className="mt-2.5 pt-2 border-t border-slate-200/50 dark:border-slate-800 flex items-center justify-between text-[11px]">
        {formattedDate ? (
          <div className="flex items-center gap-1.5 text-emerald-600 dark:text-emerald-400 font-bold">
            <Check className="w-3.5 h-3.5" />
            <span>{formattedDate}</span>
          </div>
        ) : (
          <span className={`text-[10px] ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
            Chagua siku, mwezi na mwaka wako
          </span>
        )}

        {/* Native Calendar Picker Input for fast date choosing */}
        <label
          htmlFor="native-dob-input"
          className={`flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-lg border cursor-pointer transition-colors ${
            isDark
              ? 'bg-[#101F31] border-slate-700 text-cyan-300 hover:bg-[#162B44]'
              : 'bg-white border-slate-200 text-[#0A4275] hover:bg-blue-50'
          }`}
          title="Fungua Kalenda (Calendar View)"
        >
          <Calendar className="w-3 h-3 text-cyan-500" />
          <span>Kalenda</span>
          <input
            id="native-dob-input"
            type="date"
            max={`${new Date().getFullYear()}-12-31`}
            min="1920-01-01"
            value={nativeDateValue}
            onChange={(e) => handleNativeDateChange(e.target.value)}
            className="sr-only"
          />
        </label>
      </div>
    </div>
  );
};
