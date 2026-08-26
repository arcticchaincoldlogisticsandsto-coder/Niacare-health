import React from 'react';
import { X, Pill, Banknote, PillBottle } from 'lucide-react';
import { Theme, Language } from '../types';
import { Prescription, updatePrescriptionRefillRequested } from '../lib/prescriptions';

interface PrescriptionsModalProps {
  isOpen: boolean;
  onClose: () => void;
  theme: Theme;
  language: Language;
  prescriptions: Prescription[];
  setPrescriptions: React.Dispatch<React.SetStateAction<Prescription[]>>;
  onOpenCheckout: () => void;
}

export const PrescriptionsModal: React.FC<PrescriptionsModalProps> = ({
  isOpen,
  onClose,
  theme,
  language,
  prescriptions,
  setPrescriptions,
  onOpenCheckout,
}) => {
  const isDark = theme === 'dark';
  const isSwahili = language === 'sw';

  if (!isOpen) return null;

  const handleRequestRefill = (id: string) => {
    setPrescriptions((prev) =>
      prev.map((p) => (p.id === id ? { ...p, refillRequested: true } : p))
    );
    updatePrescriptionRefillRequested(id, true);
  };

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
          <Pill className="w-5 h-5 text-emerald-500" />
          <h3 className="text-base font-black">{isSwahili ? 'Dawa Zangu & Kumbusho' : 'My Prescriptions & Reminders'}</h3>
        </div>

        <div className="space-y-3">
          {prescriptions.length === 0 ? (
            <div className="text-center py-10 space-y-2">
              <PillBottle className="w-10 h-10 text-slate-400 mx-auto opacity-50" />
              <p className="text-xs font-bold text-slate-500">
                {isSwahili
                  ? 'Huna dawa zilizoandikwa kwa sasa. Zitaonekana hapa baada ya daktari kukuandikia.'
                  : "You have no prescriptions yet. They'll appear here once a doctor prescribes something."}
              </p>
            </div>
          ) : (
            prescriptions.map((rx) => (
              <div
                key={rx.id}
                className={`p-3 rounded-2xl border ${
                  isDark ? 'bg-slate-900 border-slate-800' : 'bg-slate-50 border-slate-200'
                }`}
              >
                <div className="flex items-center justify-between mb-1">
                  <h4 className="font-bold text-xs text-slate-900 dark:text-white">{rx.medicationName}</h4>
                  <span
                    className={`text-[10px] font-bold px-2 py-0.5 rounded ${
                      rx.isSos
                        ? 'text-emerald-500 bg-emerald-50 dark:bg-emerald-950'
                        : 'text-amber-500 bg-amber-50 dark:bg-amber-950'
                    }`}
                  >
                    {rx.isSos
                      ? isSwahili
                        ? 'Inahitajika tu (SOS)'
                        : 'As Needed (SOS)'
                      : rx.daysRemaining !== null
                      ? isSwahili
                        ? `Zimebaki Siku ${rx.daysRemaining}`
                        : `${rx.daysRemaining} Days Left`
                      : ''}
                  </span>
                </div>
                <p className="text-[11px] text-slate-500 dark:text-slate-400">
                  {isSwahili ? 'Matumizi: ' : 'Usage: '}
                  {rx.dosageInstructions}
                </p>
                <div className="mt-2 flex items-center justify-between text-[10px]">
                  <span className="text-slate-400">
                    {isSwahili ? 'Imeandikwa na: ' : 'Prescribed by: '}
                    {rx.prescribedBy}
                  </span>
                  {!rx.isSos && (
                    <button
                      type="button"
                      onClick={() => handleRequestRefill(rx.id)}
                      disabled={rx.refillRequested}
                      className="font-bold text-emerald-600 dark:text-emerald-400 hover:underline cursor-pointer disabled:no-underline disabled:opacity-70"
                    >
                      {rx.refillRequested
                        ? isSwahili
                          ? 'Maombi Yametumwa ✓'
                          : 'Refill Requested ✓'
                        : isSwahili
                        ? 'Agiza Tena (Refill)'
                        : 'Request Refill'}
                    </button>
                  )}
                </div>
              </div>
            ))
          )}

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onOpenCheckout}
              className="flex-1 py-3 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-black text-xs cursor-pointer flex items-center justify-center gap-1.5 shadow-md"
            >
              <Banknote className="w-4 h-4" />
              <span>{isSwahili ? 'Lipa Dawa / Checkout' : 'Pay for Medication / Checkout'}</span>
            </button>
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-3 rounded-xl bg-slate-200 dark:bg-slate-800 hover:bg-slate-300 dark:hover:bg-slate-700 text-slate-800 dark:text-slate-200 font-bold text-xs cursor-pointer"
            >
              {isSwahili ? 'Funga' : 'Close'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
