import React from 'react';
import { X, QrCode } from 'lucide-react';
import { Theme } from '../types';

interface QrPassportModalProps {
  isOpen: boolean;
  onClose: () => void;
  theme: Theme;
  patientId: string;
  primaryDocNumber: string;
}

export const QrPassportModal: React.FC<QrPassportModalProps> = ({
  isOpen,
  onClose,
  theme,
  patientId,
  primaryDocNumber,
}) => {
  const isDark = theme === 'dark';

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-xs animate-in fade-in">
      <div
        className={`w-full max-w-sm rounded-2xl p-6 border text-center relative ${
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

        <div className="w-12 h-12 rounded-2xl bg-primary/20 text-primary-light mx-auto flex items-center justify-center mb-3">
          <QrCode className="w-6 h-6" />
        </div>

        <h3 className="text-base font-semibold tracking-tight mb-1">NiaCare Hospital QR Check-in</h3>
        <p className="text-xs text-slate-500 dark:text-slate-400 mb-4">
          Onyesha msimbo huu kwenye kaunta ya mapokezi ya hospitali yoyote iliyosajiliwa.
        </p>

        <div className="bg-white p-4 rounded-2xl shadow-inner inline-block border-2 border-dashed border-primary-light mb-4">
          <img
            src={`https://api.qrserver.com/v1/create-qr-code/?size=180x180&data=NIACARE_PATIENT_${patientId}_${primaryDocNumber}`}
            alt="Patient QR Code"
            className="w-44 h-44 mx-auto rounded-lg"
            referrerPolicy="no-referrer"
          />
          <span className="font-mono font-bold text-xs text-slate-800 mt-2 block tracking-widest">
            {patientId}
          </span>
        </div>

        <div className="space-y-2">
          <button
            type="button"
            onClick={onClose}
            className="w-full py-3 rounded-xl bg-[var(--nc-primary)] dark:bg-primary text-white font-bold text-xs cursor-pointer shadow-md"
          >
            Imekamilika / Funga
          </button>
        </div>
      </div>
    </div>
  );
};
