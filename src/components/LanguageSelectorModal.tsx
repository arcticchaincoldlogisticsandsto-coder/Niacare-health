import React, { useState, useMemo } from 'react';
import { Search, Globe, Check, X, Sparkles } from 'lucide-react';
import { Language, Theme } from '../types';
import { WORLD_LANGUAGES, WorldLanguage } from '../data/languages';

interface LanguageSelectorModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentLanguage: Language;
  onSelectLanguage: (lang: Language) => void;
  theme: Theme;
}

type RegionFilter = 'All' | 'Africa' | 'Europe' | 'Americas' | 'Asia' | 'Middle East';

export const LanguageSelectorModal: React.FC<LanguageSelectorModalProps> = ({
  isOpen,
  onClose,
  currentLanguage,
  onSelectLanguage,
  theme,
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedRegion, setSelectedRegion] = useState<RegionFilter>('All');

  const filteredLanguages = useMemo(() => {
    const q = searchQuery.toLowerCase().trim();
    return WORLD_LANGUAGES.filter((lang) => {
      const matchesRegion =
        selectedRegion === 'All' ||
        lang.region === selectedRegion ||
        (selectedRegion === 'Europe' && lang.region === 'Global');

      const matchesSearch =
        !q ||
        lang.name.toLowerCase().includes(q) ||
        lang.nativeName.toLowerCase().includes(q) ||
        lang.code.toLowerCase().includes(q);

      return matchesRegion && matchesSearch;
    });
  }, [searchQuery, selectedRegion]);

  const activeLangObject = WORLD_LANGUAGES.find((l) => l.code === currentLanguage) || {
    code: currentLanguage,
    name: 'Selected Language',
    nativeName: currentLanguage.toUpperCase(),
    flag: '🌐',
  };

  if (!isOpen) return null;

  const isDark = theme === 'dark';

  return (
    <div
      id="modal-language-selector"
      className="fixed inset-0 z-50 bg-black/75 backdrop-blur-sm flex items-center justify-center p-3 sm:p-4 animate-in fade-in duration-200"
    >
      <div
        className={`w-full max-w-lg rounded-2xl shadow-2xl overflow-hidden border flex flex-col max-h-[85vh] transition-all animate-in zoom-in-95 duration-200 ${
          isDark
            ? 'bg-[#0E1A29] text-white border-slate-700/60 shadow-[0_15px_40px_rgba(0,0,0,0.6)]'
            : 'bg-white text-slate-900 border-slate-200'
        }`}
      >
        {/* Header */}
        <div
          className={`p-4 sm:p-5 flex items-center justify-between border-b ${
            isDark
              ? 'bg-[#0B1522] border-slate-800 text-white'
              : 'bg-[#0F4C81] border-[#0A3961] text-white'
          }`}
        >
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-white/15 flex items-center justify-center text-white">
              <Globe className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-base sm:text-lg font-bold">
                  World Languages
                </h3>
                <span className="text-[10px] font-semibold uppercase tracking-wider px-2 py-0.5 rounded-full bg-white/20 text-white">
                  {WORLD_LANGUAGES.length}+ Global
                </span>
              </div>
              <p className="text-xs text-blue-100/80">
                Choose your preferred language for NiaCare
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="w-8 h-8 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center text-white transition-colors cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Search & Region Filter Bar */}
        <div
          className={`p-4 border-b space-y-3 ${
            isDark ? 'bg-[#122033] border-slate-800' : 'bg-slate-50 border-slate-200'
          }`}
        >
          {/* Search Box */}
          <div className="relative">
            <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Search language (e.g. Swahili, French, Arabic, Español, 中文)..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className={`w-full pl-10 pr-4 py-2.5 rounded-xl text-xs sm:text-sm outline-none border transition-all ${
                isDark
                  ? 'bg-[#0A1420] border-slate-700 text-white placeholder:text-slate-500 focus:border-cyan-400 focus:ring-1 focus:ring-cyan-400'
                  : 'bg-white border-slate-300 text-slate-900 placeholder:text-slate-400 focus:border-[#0F4C81] focus:ring-1 focus:ring-[#0F4C81]'
              }`}
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => setSearchQuery('')}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-200 text-xs"
              >
                Clear
              </button>
            )}
          </div>

          {/* Region Tabs */}
          <div className="flex items-center gap-1.5 overflow-x-auto pb-1 no-scrollbar text-xs">
            {(['All', 'Africa', 'Europe', 'Americas', 'Asia', 'Middle East'] as RegionFilter[]).map((region) => (
              <button
                key={region}
                type="button"
                onClick={() => setSelectedRegion(region)}
                className={`px-3 py-1 rounded-lg font-semibold whitespace-nowrap transition-all cursor-pointer ${
                  selectedRegion === region
                    ? isDark
                      ? 'bg-cyan-500 text-slate-950 shadow-xs'
                      : 'bg-[#0F4C81] text-white shadow-xs'
                    : isDark
                    ? 'bg-slate-800 text-slate-300 hover:bg-slate-700'
                    : 'bg-white text-slate-600 hover:bg-slate-200 border border-slate-200'
                }`}
              >
                {region}
              </button>
            ))}
          </div>
        </div>

        {/* Current Active Language Banner */}
        <div
          className={`px-4 py-2 flex items-center justify-between text-xs border-b ${
            isDark ? 'bg-cyan-950/40 border-cyan-900/40 text-cyan-200' : 'bg-blue-50/70 border-blue-100 text-blue-900'
          }`}
        >
          <div className="flex items-center gap-2">
            <span className="text-sm">{activeLangObject.flag}</span>
            <span>
              Active: <strong className="font-bold">{activeLangObject.name}</strong> ({activeLangObject.nativeName})
            </span>
          </div>
          <span className="text-[11px] font-mono uppercase font-semibold px-2 py-0.5 rounded bg-white/20">
            {activeLangObject.code}
          </span>
        </div>

        {/* Language Grid List */}
        <div className="p-3 sm:p-4 overflow-y-auto flex-1 grid grid-cols-1 sm:grid-cols-2 gap-2">
          {filteredLanguages.length === 0 ? (
            <div className="col-span-2 py-12 text-center text-slate-400">
              <Globe className="w-8 h-8 mx-auto mb-2 opacity-40" />
              <p className="text-sm font-medium">No languages found matching &ldquo;{searchQuery}&rdquo;</p>
              <p className="text-xs text-slate-500 mt-1">Try searching by English or native script</p>
            </div>
          ) : (
            filteredLanguages.map((lang: WorldLanguage) => {
              const isSelected = currentLanguage === lang.code;
              return (
                <button
                  id={`btn-select-lang-${lang.code}`}
                  key={lang.code}
                  type="button"
                  onClick={() => {
                    onSelectLanguage(lang.code as Language);
                    onClose();
                  }}
                  className={`flex items-center justify-between p-3 rounded-2xl border text-left transition-all cursor-pointer ${
                    isSelected
                      ? isDark
                        ? 'bg-cyan-500/15 border-cyan-400 text-white shadow-sm ring-1 ring-cyan-400'
                        : 'bg-blue-50 border-[#0F4C81] text-[#0F4C81] shadow-xs ring-1 ring-[#0F4C81]'
                      : isDark
                      ? 'bg-[#111F30] border-slate-800 hover:border-slate-600 hover:bg-[#16273C] text-slate-200'
                      : 'bg-white border-slate-200 hover:border-slate-300 hover:bg-slate-50 text-slate-800'
                  }`}
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <span className="text-xl sm:text-2xl shrink-0">{lang.flag}</span>
                    <div className="min-w-0">
                      <div className="flex items-center gap-1.5">
                        <span className="font-bold text-sm truncate">{lang.name}</span>
                        {lang.isPopular && (
                          <span
                            className={`text-[9px] px-1.5 py-0.2 rounded-full font-bold uppercase ${
                              isDark ? 'bg-blue-500/20 text-cyan-300' : 'bg-blue-100 text-blue-800'
                            }`}
                          >
                            Top
                          </span>
                        )}
                      </div>
                      <p className="text-xs opacity-75 truncate">{lang.nativeName}</p>
                    </div>
                  </div>

                  <div className="flex items-center gap-1.5 shrink-0 ml-2">
                    <span className="text-[10px] font-mono opacity-60 uppercase font-semibold">
                      {lang.code}
                    </span>
                    {isSelected ? (
                      <div
                        className={`w-5 h-5 rounded-full flex items-center justify-center ${
                          isDark ? 'bg-cyan-400 text-slate-950' : 'bg-[#0F4C81] text-white'
                        }`}
                      >
                        <Check className="w-3 h-3" />
                      </div>
                    ) : (
                      <div className="w-5 h-5" />
                    )}
                  </div>
                </button>
              );
            })
          )}
        </div>

        {/* Footer */}
        <div
          className={`p-3 text-center border-t text-xs ${
            isDark ? 'bg-[#0B1522] border-slate-800 text-slate-400' : 'bg-slate-50 border-slate-200 text-slate-500'
          }`}
        >
          <div className="flex items-center justify-center gap-1.5">
            <Sparkles className="w-3.5 h-3.5 text-cyan-500" />
            <span>NiaCare Multi-Language eHealth Network &bull; Automatic Fallback Active</span>
          </div>
        </div>
      </div>
    </div>
  );
};
