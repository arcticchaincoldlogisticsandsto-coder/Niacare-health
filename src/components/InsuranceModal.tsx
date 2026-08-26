import React, { useState, useEffect } from 'react';
import { X, CreditCard, Banknote, ShieldCheck } from 'lucide-react';
import { Theme } from '../types';
import { fetchBills } from '../lib/bills';
import { MedicalBill } from './CheckoutProcedureModal';

interface InsuranceModalProps {
  isOpen: boolean;
  onClose: () => void;
  theme: Theme;
  insuranceProviderName: string;
  authUserId: string | null;
  onOpenCheckout: () => void;
}

export const InsuranceModal: React.FC<InsuranceModalProps> = ({
  isOpen,
  onClose,
  theme,
  insuranceProviderName,
  authUserId,
  onOpenCheckout,
}) => {
  const isDark = theme === 'dark';
  const [bills, setBills] = useState<MedicalBill[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (!isOpen || !authUserId) return;
    let active = true;
    setIsLoading(true);
    fetchBills(authUserId).then(({ bills: fetched }) => {
      if (!active) return;
      setBills(fetched);
      setIsLoading(false);
    });
    return () => {
      active = false;
    };
  }, [isOpen, authUserId]);

  if (!isOpen) return null;

  const settledBills = bills.filter((b) => b.status === 'settled');

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
          <CreditCard className="w-5 h-5 text-amber-500" />
          <h3 className="text-base font-black">Hali ya Bima & Madai (Coverage)</h3>
        </div>

        <div className="space-y-3 text-xs">
          <div className="p-4 rounded-2xl bg-gradient-to-r from-blue-900 to-[#0A4275] text-white">
            <span className="text-[10px] text-cyan-200 uppercase font-bold block">MPANGO WA BIMA</span>
            <h4 className="text-sm font-extrabold">{insuranceProviderName}</h4>
            <div className="mt-3 flex items-center gap-1.5 text-[11px] pt-2 border-t border-white/20">
              <ShieldCheck className="w-3.5 h-3.5 text-emerald-300" />
              <span>Hali: Inatumika (Active)</span>
            </div>
          </div>

          <div className="space-y-2">
            <h5 className="font-bold text-xs">Madai ya Hivi Karibuni:</h5>
            {isLoading ? (
              <p className="text-[11px] text-slate-400 py-3 text-center">Inapakia...</p>
            ) : settledBills.length === 0 ? (
              <p className="text-[11px] text-slate-400 py-3 text-center">
                Huna madai yaliyolipwa bado. Yataonekana hapa baada ya kulipa ankara kupitia Checkout.
              </p>
            ) : (
              settledBills.map((bill) => (
                <div
                  key={bill.id}
                  className="p-2.5 rounded-xl border border-slate-200 dark:border-slate-800 flex items-center justify-between"
                >
                  <div>
                    <span className="font-bold block">{bill.facility}</span>
                    <span className="text-[10px] text-slate-400">{bill.department} • {bill.date}</span>
                  </div>
                  <span className="font-mono font-bold text-emerald-600 dark:text-emerald-400">
                    TZS {bill.totalTzs.toLocaleString()} (Imelipwa)
                  </span>
                </div>
              ))
            )}
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onOpenCheckout}
              className="flex-1 py-3 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-black text-xs cursor-pointer flex items-center justify-center gap-1.5 shadow-md"
            >
              <Banknote className="w-4 h-4" />
              <span>Taratibu za Malipo (Checkout)</span>
            </button>
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-3 rounded-xl bg-slate-200 dark:bg-slate-800 hover:bg-slate-300 dark:hover:bg-slate-700 text-slate-800 dark:text-slate-200 font-bold text-xs cursor-pointer"
            >
              Funga
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
