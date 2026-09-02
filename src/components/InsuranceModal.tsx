import React, { useState, useEffect } from 'react';
import { X, CreditCard, Banknote, ShieldCheck } from 'lucide-react';
import { Theme } from '../types';
import { fetchBills } from '../lib/bills';
import { fetchClaimsForPatient, Claim, ClaimStatus } from '../lib/claims';
import { MedicalBill } from './CheckoutProcedureModal';

const CLAIM_STATUS_STYLES: Record<ClaimStatus, string> = {
  submitted: 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300',
  under_review: 'bg-amber-50 text-amber-700 dark:bg-amber-950 dark:text-amber-300',
  approved: 'bg-primary/5 text-[var(--nc-primary)] dark:bg-primary/10 dark:text-primary-light',
  rejected: 'bg-rose-50 text-rose-700 dark:bg-rose-950 dark:text-rose-300',
  paid: 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300',
};

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
  const [claims, setClaims] = useState<Claim[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (!isOpen) return;
    if (!authUserId) { setIsLoading(false); return; }
    let active = true;
    setIsLoading(true);
    Promise.all([fetchBills(authUserId), fetchClaimsForPatient(authUserId)]).then(([billsRes, claimsRes]) => {
      if (!active) return;
      setBills(billsRes.bills);
      setClaims(claimsRes.claims);
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
          <h3 className="text-base font-semibold">Hali ya Bima & Madai (Coverage)</h3>
        </div>

        <div className="space-y-3 text-xs">
          <div className="p-4 rounded-2xl bg-gradient-to-r from-primary-dark to-[var(--nc-primary)] text-white">
            <span className="text-[10px] text-primary-light uppercase font-bold block">MPANGO WA BIMA</span>
            <h4 className="text-sm font-semibold">{insuranceProviderName}</h4>
            <div className="mt-3 flex items-center gap-1.5 text-[11px] pt-2 border-t border-white/20">
              <ShieldCheck className="w-3.5 h-3.5 text-emerald-300" />
              <span>Hali: Inatumika (Active)</span>
            </div>
          </div>

          {claims.length > 0 && (
            <div className="space-y-2">
              <h5 className="font-bold text-xs">Madai ya Bima (Insurance Claims):</h5>
              {claims.map((claim) => (
                <div
                  key={claim.id}
                  className="p-2.5 rounded-xl border border-slate-200 dark:border-slate-800 flex items-center justify-between"
                >
                  <div>
                    <span className="font-bold block">{claim.insuranceProvider}</span>
                    <span className="text-[10px] text-slate-400">
                      {claim.referenceNumber || '—'} • {new Date(claim.submittedAt).toLocaleDateString()}
                    </span>
                  </div>
                  <div className="flex flex-col items-end gap-1">
                    <span className="font-mono font-bold">TZS {claim.claimAmountTzs.toLocaleString()}</span>
                    <span className={`rounded-md px-1.5 py-0.5 text-[9px] font-bold capitalize ${CLAIM_STATUS_STYLES[claim.status]}`}>
                      {claim.status.replace('_', ' ')}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}

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
              className="flex-1 py-3 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-semibold text-xs cursor-pointer flex items-center justify-center gap-1.5 shadow-md"
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
