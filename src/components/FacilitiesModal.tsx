import React from 'react';
import { X, MapPin, Phone, ShieldCheck } from 'lucide-react';
import { Theme } from '../types';
import { TANZANIA_HOSPITALS } from '../data/doctors';

interface FacilitiesModalProps {
  isOpen: boolean;
  onClose: () => void;
  theme: Theme;
}

export const FacilitiesModal: React.FC<FacilitiesModalProps> = ({ isOpen, onClose, theme }) => {
  const isDark = theme === 'dark';

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-xs animate-in fade-in">
      <div
        className={`w-full max-w-md rounded-2xl p-5 sm:p-6 border relative max-h-[90vh] overflow-y-auto ${
          isDark ? 'bg-[#0E1B2C] border-slate-700 text-white' : 'bg-white border-slate-200 text-slate-900'
        }`}
      >
        <button
          type="button"
          onClick={onClose}
          className="absolute top-4 right-4 p-2 rounded-full hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-400 hover:text-slate-700 dark:hover:text-white cursor-pointer"
        >
          <X className="w-5 h-5" />
        </button>

        <div className="flex items-center gap-2 mb-3">
          <MapPin className="w-5 h-5 text-rose-500" />
          <h3 className="text-base font-semibold">Hospitali & Vituo vya Afya Vilivyosajiliwa</h3>
        </div>

        <div className="space-y-2.5 text-xs">
          {TANZANIA_HOSPITALS.map((hospital) => (
            <div
              key={hospital.id}
              className={`p-3 rounded-2xl border flex items-center justify-between gap-3 ${
                isDark ? 'bg-slate-900 border-slate-800' : 'bg-slate-50 border-slate-200'
              }`}
            >
              <div className="min-w-0">
                <h4 className="font-bold text-slate-900 dark:text-white truncate">{hospital.name}</h4>
                <p className="text-[10px] text-slate-400">{hospital.region}</p>
                <span className="text-[9px] font-bold text-emerald-500 flex items-center gap-1 mt-0.5">
                  <ShieldCheck className="w-2.5 h-2.5" />
                  {hospital.type}
                  {hospital.nhifAccepted && ' • NHIF'}
                </span>
              </div>
              <a
                href={`tel:${hospital.emergencyPhone.replace(/\s+/g, '')}`}
                className="px-3 py-1.5 rounded-xl bg-rose-600 text-white font-bold text-[11px] flex items-center gap-1 cursor-pointer flex-shrink-0"
              >
                <Phone className="w-3 h-3" />
                <span>Piga</span>
              </a>
            </div>
          ))}

          <button
            type="button"
            onClick={onClose}
            className="w-full py-3 rounded-xl bg-[var(--nc-primary)] dark:bg-primary text-white font-bold text-xs cursor-pointer"
          >
            Funga Orodha
          </button>
        </div>
      </div>
    </div>
  );
};
