import React, { useState, useEffect } from 'react';
import {
  Shield,
  CreditCard,
  Banknote,
  Smartphone,
  CheckCircle2,
  FileText,
  Building2,
  Download,
  Printer,
  QrCode,
  AlertCircle,
  HelpCircle,
  X,
  ChevronRight,
  ArrowRight,
  Sparkles,
  Check,
  Clock,
  ExternalLink,
  RefreshCw,
  Info,
  DollarSign,
} from 'lucide-react';
import { Language, Theme, UserCategory, LocalFormData, InternationalFormData } from '../types';
import { TANZANIA_INSURANCE_PROVIDERS } from '../data/insurance';
import { fetchBills, settleBill } from '../lib/bills';
import { insertMedicalRecord } from '../lib/records';
import { generateReceiptPdf } from '../utils/pdfGenerator';

const secureNumericCode = (digits: number): string => {
  const min = 10 ** (digits - 1);
  const span = 9 * min;
  const array = new Uint32Array(1);
  globalThis.crypto?.getRandomValues(array);
  return String(min + (array[0] % span));
};

export interface MedicalBill {
  id: string;
  invoiceNumber: string;
  facility: string;
  department: string;
  date: string;
  status: 'pending' | 'settled' | 'processing';
  items: Array<{ name: string; category: string; amountTzs: number; amountUsd: number }>;
  totalTzs: number;
  totalUsd: number;
}

interface CheckoutProcedureModalProps {
  isOpen: boolean;
  onClose: () => void;
  language: Language;
  theme: Theme;
  userCategory: UserCategory;
  localData: LocalFormData;
  intlData: InternationalFormData;
  authUserId: string | null;
}

export const CheckoutProcedureModal: React.FC<CheckoutProcedureModalProps> = ({
  isOpen,
  onClose,
  language,
  theme,
  userCategory,
  localData,
  intlData,
  authUserId,
}) => {
  const isDark = theme === 'dark';
  const isSwahili = language === 'sw';
  const isFrench = language === 'fr';

  const isLocal = userCategory === 'locals';
  const patientName = isLocal
    ? localData.fullName || 'Amina Salum Bakari'
    : intlData.fullName || 'Marcus Alexander Vance';
  const patientPhone = isLocal
    ? localData.phone ? `+255 ${localData.phone}` : '+255 754 829 140'
    : intlData.phone ? `${intlData.countryCode || '+1'} ${intlData.phone}` : '+1 791 112 3456';
  const defaultInsurance = isLocal
    ? localData.insuranceProvider || 'NHIF (Mfuko wa Taifa)'
    : 'Allianz Global Care / Travel Insurance';

  // Navigation tab inside modal
  const [activeTab, setActiveTab] = useState<'checkout' | 'procedures_guide' | 'history'>('checkout');

  // Bills loaded from Supabase for this patient
  const [bills, setBills] = useState<MedicalBill[]>([]);
  const [isLoadingBills, setIsLoadingBills] = useState(true);
  const [selectedBillId, setSelectedBillId] = useState<string>('');

  useEffect(() => {
    if (!isOpen || !authUserId) return;
    let active = true;
    setIsLoadingBills(true);
    fetchBills(authUserId).then(({ bills: fetched }) => {
      if (!active) return;
      setBills(fetched);
      const firstPending = fetched.find((b) => b.status === 'pending');
      setSelectedBillId(firstPending?.id || fetched[0]?.id || '');
      setIsLoadingBills(false);
    });
    return () => {
      active = false;
    };
  }, [isOpen, authUserId]);

  // Checkout Decision Mode: 'insurance' or 'cash'
  const [checkoutMode, setCheckoutMode] = useState<'insurance' | 'cash'>('insurance');

  // Insurance Checkout Flow Sub-states
  const [selectedInsuranceProvider, setSelectedInsuranceProvider] = useState<string>(defaultInsurance);
  const [insuranceCardNo, setInsuranceCardNo] = useState<string>(
    isLocal ? (localData.insuranceNumber || '23-904128-NHIF') : 'INTL-89104-AZ'
  );
  const [insuranceCoPayPct, setInsuranceCoPayPct] = useState<number>(0); // 0% co-pay = 100% insurance covered
  const [insurancePreAuthCode, setInsurancePreAuthCode] = useState<string>('AUTH-2026-9042-NHIF');
  const [isVerifyingInsurance, setIsVerifyingInsurance] = useState<boolean>(false);
  const [insuranceVerified, setInsuranceVerified] = useState<boolean>(true);

  // Cash / Direct Payment Flow Sub-states: 'mpesa' | 'cash_counter' | 'card'
  const [cashPaymentMethod, setCashPaymentMethod] = useState<'mpesa' | 'cash_counter' | 'card'>('mpesa');
  const [mobileNetwork, setMobileNetwork] = useState<'mpesa' | 'airtel' | 'tigo' | 'halopesa'>('mpesa');
  const [payerPhone, setPayerPhone] = useState<string>(patientPhone);
  const [controlNumber, setControlNumber] = useState<string>('9928 0194 8831');
  const [isProcessingPayment, setIsProcessingPayment] = useState<boolean>(false);
  const [settlementSuccess, setSettlementSuccess] = useState<boolean>(false);
  const [settlementReceipt, setSettlementReceipt] = useState<{
    receiptNo: string;
    mode: 'insurance' | 'cash';
    methodTitle: string;
    authRef: string;
    amountPaidTzs: number;
    amountPaidUsd: number;
    facility: string;
    timestamp: string;
  } | null>(null);

  if (!isOpen) return null;

  const currentBill = bills.find((b) => b.id === selectedBillId);

  // Calculate breakdown for Insurance (0 when there's no bill selected yet)
  const insuranceCoveredAmountTzs = currentBill
    ? Math.round(currentBill.totalTzs * (1 - insuranceCoPayPct / 100))
    : 0;
  const patientCoPayAmountTzs = currentBill ? currentBill.totalTzs - insuranceCoveredAmountTzs : 0;

  // Execute Insurance Claim Checkout
  const handleAuthorizeInsuranceCheckout = async () => {
    if (!currentBill || !authUserId) return;
    setIsProcessingPayment(true);
    const authRef = insurancePreAuthCode || `NHIF-CLAIM-${Date.now().toString().slice(-6)}`;
    const { success } = await settleBill(currentBill.id, 'insurance', authRef);
    setIsProcessingPayment(false);

    if (!success) return;

    setSettlementSuccess(true);
    const newReceipt = {
      receiptNo: `REC-INS-${secureNumericCode(8)}`,
      mode: 'insurance' as const,
      methodTitle: `Bima ya Afya (${selectedInsuranceProvider})`,
      authRef,
      amountPaidTzs: insuranceCoveredAmountTzs,
      amountPaidUsd: currentBill.totalUsd,
      facility: currentBill.facility,
      timestamp: new Date().toLocaleString(),
    };
    setSettlementReceipt(newReceipt);

    setBills((prev) => prev.map((b) => (b.id === currentBill.id ? { ...b, status: 'settled' } : b)));

    insertMedicalRecord(authUserId, {
      title: isSwahili ? `Ziara ya Kliniki - ${currentBill.department}` : `Clinic Visit - ${currentBill.department}`,
      category: 'consultation',
      hospitalName: currentBill.facility,
      doctorName: currentBill.department,
      date: currentBill.date,
      department: currentBill.department,
      status: 'verified',
      summaryEn: `Consultation completed and billed at ${currentBill.facility}. Settled via insurance (${selectedInsuranceProvider}).`,
      summarySw: `Huduma ilikamilika katika ${currentBill.facility}. Malipo yamekamilika kupitia bima (${selectedInsuranceProvider}).`,
    });
  };

  // Execute Cash / Mobile Money Checkout
  const handleAuthorizeCashCheckout = async () => {
    if (!currentBill || !authUserId) return;
    setIsProcessingPayment(true);
    const methodLabel =
      cashPaymentMethod === 'mpesa'
        ? `Lipa Namba / ${mobileNetwork.toUpperCase()}`
        : cashPaymentMethod === 'cash_counter'
        ? `Fedha Taslimu Kaunta (Control No: ${controlNumber})`
        : 'Kadi ya Benki (Visa/Mastercard)';
    // payments.method has a strict DB check constraint (insurance/cash/
    // mobile_money/bank_transfer/card) — the human-readable methodLabel
    // above is for the on-screen/PDF receipt only, never sent to the DB.
    const settlementMethod = cashPaymentMethod === 'mpesa' ? 'mobile_money' : cashPaymentMethod === 'card' ? 'card' : 'cash';
    const authRef = `TXN-${Date.now().toString().slice(-8)}`;
    const { success } = await settleBill(currentBill.id, settlementMethod, authRef);
    setIsProcessingPayment(false);

    if (!success) return;

    setSettlementSuccess(true);
    const newReceipt = {
      receiptNo: `REC-CSH-${secureNumericCode(8)}`,
      mode: 'cash' as const,
      methodTitle: methodLabel,
      authRef,
      amountPaidTzs: currentBill.totalTzs,
      amountPaidUsd: currentBill.totalUsd,
      facility: currentBill.facility,
      timestamp: new Date().toLocaleString(),
    };
    setSettlementReceipt(newReceipt);

    setBills((prev) => prev.map((b) => (b.id === currentBill.id ? { ...b, status: 'settled' } : b)));

    insertMedicalRecord(authUserId, {
      title: isSwahili ? `Ziara ya Kliniki - ${currentBill.department}` : `Clinic Visit - ${currentBill.department}`,
      category: 'consultation',
      hospitalName: currentBill.facility,
      doctorName: currentBill.department,
      date: currentBill.date,
      department: currentBill.department,
      status: 'verified',
      summaryEn: `Consultation completed and billed at ${currentBill.facility}. Settled via ${methodLabel}.`,
      summarySw: `Huduma ilikamilika katika ${currentBill.facility}. Malipo yamekamilika kupitia ${methodLabel}.`,
    });
  };

  const handleResetForNewCheckout = () => {
    setSettlementSuccess(false);
    setSettlementReceipt(null);
  };

  return (
    <div
      id="checkout-procedure-modal-backdrop"
      className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-5 bg-black/80 backdrop-blur-xs animate-in fade-in overflow-y-auto"
    >
      <div
        id="checkout-procedure-modal-container"
        className={`w-full max-w-4xl max-h-[92vh] flex flex-col rounded-2xl border shadow-2xl overflow-hidden my-auto ${
          isDark ? 'bg-[#0B1726] border-slate-700 text-white' : 'bg-white border-slate-200 text-slate-900'
        }`}
      >
        {/* ========================================================================= */}
        {/* HEADER */}
        {/* ========================================================================= */}
        <div
          className={`p-4 sm:p-5 border-b flex items-center justify-between flex-shrink-0 ${
            isDark ? 'bg-[#0E1F33] border-slate-800' : 'bg-gradient-to-r from-primary-light via-slate-50 to-emerald-50 border-slate-200'
          }`}
        >
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 rounded-2xl bg-emerald-500/20 text-emerald-500 dark:text-emerald-400 flex items-center justify-center font-bold flex-shrink-0 shadow-inner">
              <CreditCard className="w-6 h-6" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-base sm:text-lg font-semibold tracking-tight">
                  {isSwahili
                    ? 'Taratibu za Malipo ya Hospitali (Checkout)'
                    : isFrench
                    ? 'Procédures de Facturation & Sortie'
                    : 'Hospital Checkout & Billing Procedures'}
                </h2>
                <span className="text-[10px] font-mono font-bold px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
                  NiaCare Pay
                </span>
              </div>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                {isSwahili
                  ? 'Chagua utaratibu wa kukamilisha ankara: Bima ya Afya au Lipa Taslimu / Simu'
                  : 'Choose your settlement procedure: Health Insurance Coverage or Direct Cash / Mobile Money'}
              </p>
            </div>
          </div>

          <button
            id="btn-close-checkout-modal"
            type="button"
            onClick={onClose}
            className="p-2 rounded-full hover:bg-slate-200 dark:hover:bg-slate-800 text-slate-400 hover:text-slate-700 dark:hover:text-white transition-all cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* ========================================================================= */}
        {/* NAVIGATION TABS */}
        {/* ========================================================================= */}
        <div
          className={`flex items-center px-4 pt-2 border-b gap-2 text-xs font-bold overflow-x-auto flex-shrink-0 ${
            isDark ? 'bg-[#091422] border-slate-800' : 'bg-slate-100/70 border-slate-200'
          }`}
        >
          <button
            type="button"
            id="tab-active-checkout"
            onClick={() => {
              setActiveTab('checkout');
              setSettlementSuccess(false);
            }}
            className={`py-2.5 px-4 border-b-2 transition-all flex items-center gap-2 cursor-pointer ${
              activeTab === 'checkout'
                ? 'border-emerald-500 text-emerald-500 font-semibold'
                : 'border-transparent text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'
            }`}
          >
            <CreditCard className="w-4 h-4" />
            <span>{isSwahili ? 'Lipa Ankara ya Sasa (Checkout)' : 'Settle Medical Bill'}</span>
          </button>

          <button
            type="button"
            id="tab-procedures-guide"
            onClick={() => setActiveTab('procedures_guide')}
            className={`py-2.5 px-4 border-b-2 transition-all flex items-center gap-2 cursor-pointer ${
              activeTab === 'procedures_guide'
                ? 'border-emerald-500 text-emerald-500 font-semibold'
                : 'border-transparent text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'
            }`}
          >
            <Info className="w-4 h-4" />
            <span>{isSwahili ? 'Mwongozo wa Taratibu (Step-by-Step)' : 'Procedure Guides (How-to)'}</span>
          </button>

          <button
            type="button"
            id="tab-receipts-history"
            onClick={() => setActiveTab('history')}
            className={`py-2.5 px-4 border-b-2 transition-all flex items-center gap-2 cursor-pointer ${
              activeTab === 'history'
                ? 'border-emerald-500 text-emerald-500 font-semibold'
                : 'border-transparent text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'
            }`}
          >
            <FileText className="w-4 h-4" />
            <span>{isSwahili ? 'Risiti & Kibali cha Kutoka' : 'Receipts & Gate Clearance'}</span>
          </button>
        </div>

        {/* ========================================================================= */}
        {/* BODY CONTENT */}
        {/* ========================================================================= */}
        <div className="p-4 sm:p-6 overflow-y-auto flex-1 space-y-5">
          {/* TAB 1: LOADING STATE */}
          {activeTab === 'checkout' && !settlementSuccess && isLoadingBills && (
            <div className="text-center py-16">
              <RefreshCw className="w-6 h-6 text-slate-400 mx-auto animate-spin" />
            </div>
          )}

          {/* TAB 1: EMPTY STATE — no invoices yet */}
          {activeTab === 'checkout' && !settlementSuccess && !isLoadingBills && bills.length === 0 && (
            <div className="text-center py-16 space-y-2">
              <FileText className="w-10 h-10 text-slate-400 mx-auto opacity-50" />
              <p className="text-sm font-bold text-slate-500">
                {isSwahili
                  ? 'Huna ankara za matibabu kwa sasa. Ankara huundwa kiotomatiki unapoweka miadi na daktari.'
                  : 'You have no medical invoices yet. Invoices are generated automatically when you book a doctor appointment.'}
              </p>
            </div>
          )}

          {/* TAB 1: ACTIVE BILL CHECKOUT FLOW */}
          {activeTab === 'checkout' && !settlementSuccess && !isLoadingBills && currentBill && (
            <div className="space-y-5 animate-in fade-in">
              {/* SECTION A: Select Medical Bill / Encounter */}
              <div
                className={`p-4 rounded-2xl border ${
                  isDark ? 'bg-[#0E1E31] border-slate-800' : 'bg-slate-50/80 border-slate-200'
                }`}
              >
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-3">
                  <div>
                    <span className="text-[10px] uppercase font-bold text-slate-400 block tracking-wider">
                      {isSwahili ? 'HATUA YA 1: CHAGUA ANKARA YA MATIBABU' : 'STEP 1: SELECT MEDICAL INVOICE'}
                    </span>
                    <h3 className="text-sm font-semibold text-slate-900 dark:text-white">
                      {isSwahili ? 'Ankara za Hospitali Zisizolipwa' : 'Pending Hospital Invoices'}
                    </h3>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-mono font-bold px-2 py-0.5 rounded bg-primary/15 text-primary dark:text-primary-light">
                      Mgonjwa: {patientName}
                    </span>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {bills.map((b) => {
                    const isSelected = selectedBillId === b.id;
                    const isSettled = b.status === 'settled';
                    return (
                      <div
                        key={b.id}
                        onClick={() => !isSettled && setSelectedBillId(b.id)}
                        className={`p-3.5 rounded-2xl border transition-all cursor-pointer relative ${
                          isSelected
                            ? isDark
                              ? 'bg-[#142942] border-emerald-400 shadow-md ring-1 ring-emerald-400'
                              : 'bg-emerald-50/70 border-emerald-500 shadow-xs ring-1 ring-emerald-500'
                            : isDark
                            ? 'bg-[#091422] border-slate-800 hover:border-slate-700'
                            : 'bg-white border-slate-200 hover:border-slate-300'
                        } ${isSettled ? 'opacity-60 cursor-not-allowed' : ''}`}
                      >
                        <div className="flex items-start justify-between gap-2 mb-1.5">
                          <span className="text-xs font-semibold font-mono text-slate-900 dark:text-white">
                            {b.invoiceNumber}
                          </span>
                          <span
                            className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                              isSettled
                                ? 'bg-emerald-500/20 text-emerald-400'
                                : 'bg-amber-500/20 text-amber-400'
                            }`}
                          >
                            {isSettled ? (isSwahili ? 'Imelipwa ✓' : 'Settled ✓') : (isSwahili ? 'Inasubiri Malipo' : 'Pending Payment')}
                          </span>
                        </div>

                        <p className="text-xs font-bold text-slate-800 dark:text-slate-200 truncate">
                          {b.facility}
                        </p>
                        <p className="text-[11px] text-slate-500 dark:text-slate-400">{b.department}</p>

                        <div className="mt-2 pt-2 border-t border-slate-700/40 flex items-center justify-between text-xs">
                          <span className="text-slate-400 text-[11px]">{b.date}</span>
                          <span className="font-mono font-semibold text-sm text-emerald-600 dark:text-emerald-400">
                            TZS {b.totalTzs.toLocaleString()} <span className="text-[10px] font-normal text-slate-400">(${b.totalUsd})</span>
                          </span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* SECTION B: Itemized Service Breakdown */}
              <div
                className={`p-4 rounded-2xl border ${
                  isDark ? 'bg-[#0E1E31] border-slate-800' : 'bg-white border-slate-200 shadow-xs'
                }`}
              >
                <div className="flex items-center justify-between mb-3">
                  <h4 className="text-xs font-semibold uppercase tracking-wider text-slate-400">
                    {isSwahili ? 'Mchanganuo wa Huduma za Matibabu' : 'Itemized Medical Breakdown'} ({currentBill.items.length} items)
                  </h4>
                  <span className="text-[11px] font-bold text-slate-500 dark:text-slate-400">
                    {currentBill.facility}
                  </span>
                </div>

                <div className="space-y-2 mb-3">
                  {currentBill.items.map((item, idx) => (
                    <div
                      key={idx}
                      className={`p-2.5 rounded-xl border flex items-center justify-between text-xs ${
                        isDark ? 'bg-[#091422] border-slate-800/80' : 'bg-slate-50 border-slate-200/60'
                      }`}
                    >
                      <div className="flex items-center gap-2">
                        <div className="w-2 h-2 rounded-full bg-primary/30" />
                        <div>
                          <span className="font-bold text-slate-900 dark:text-white block">{item.name}</span>
                          <span className="text-[10px] text-slate-400 font-medium">{item.category}</span>
                        </div>
                      </div>
                      <div className="text-right font-mono font-bold text-slate-900 dark:text-white">
                        TZS {item.amountTzs.toLocaleString()}
                        <span className="text-[10px] text-slate-400 block font-normal">${item.amountUsd}</span>
                      </div>
                    </div>
                  ))}
                </div>

                <div className="pt-3 border-t border-slate-700/50 flex items-center justify-between">
                  <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">
                    Jumla Kuu ya Ankara (Total Bill):
                  </span>
                  <div className="text-right">
                    <span className="font-mono font-semibold text-base sm:text-lg text-emerald-500 dark:text-emerald-400">
                      TZS {currentBill.totalTzs.toLocaleString()}
                    </span>
                    <span className="text-xs text-slate-400 block font-mono">(${currentBill.totalUsd} USD)</span>
                  </div>
                </div>
              </div>

              {/* SECTION C: DECISION - CHOOSE CHECKOUT PROCEDURE */}
              <div
                className={`p-4 rounded-2xl border ${
                  isDark ? 'bg-[#0E1E31] border-slate-800' : 'bg-slate-50/80 border-slate-200'
                }`}
              >
                <span className="text-[10px] uppercase font-bold text-slate-400 block tracking-wider mb-1">
                  {isSwahili ? 'HATUA YA 2: CHAGUA UTARATIBU WA MALIPO' : 'STEP 2: CHOOSE CHECKOUT PROCEDURE'}
                </span>
                <h3 className="text-sm font-semibold text-slate-900 dark:text-white mb-3">
                  {isSwahili ? 'Je, unalipia kwa Bima ya Afya au Pesa Taslimu / Simu?' : 'Select Payment Procedure'}
                </h3>

                {/* Procedure Selection Toggle Tabs */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-4">
                  {/* Option 1: Insurance */}
                  <button
                    type="button"
                    id="btn-choose-insurance-checkout"
                    onClick={() => setCheckoutMode('insurance')}
                    className={`p-4 rounded-2xl border text-left transition-all cursor-pointer flex flex-col justify-between ${
                      checkoutMode === 'insurance'
                        ? isDark
                          ? 'bg-gradient-to-br from-[#0E2F48] to-[#124063] border-primary-light shadow-md ring-2 ring-primary/40'
                          : 'bg-gradient-to-br from-primary-light to-primary-light border-[var(--nc-primary)] shadow-md ring-2 ring-[var(--nc-primary)]/20'
                        : isDark
                        ? 'bg-[#091422] border-slate-800 hover:border-slate-700'
                        : 'bg-white border-slate-200 hover:border-slate-300'
                    }`}
                  >
                    <div className="flex items-start justify-between mb-2">
                      <div className="w-10 h-10 rounded-xl bg-primary/20 text-primary dark:text-primary-light flex items-center justify-center font-bold">
                        <Shield className="w-5 h-5" />
                      </div>
                      <span
                        className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                          checkoutMode === 'insurance'
                            ? 'bg-primary text-white font-semibold'
                            : 'bg-slate-700 text-slate-300'
                        }`}
                      >
                        {isSwahili ? 'Bima ya Afya (NHIF / Binafsi)' : 'Health Insurance Claim'}
                      </span>
                    </div>

                    <div>
                      <h4 className="text-sm font-semibold text-slate-900 dark:text-white mb-1">
                        1. {isSwahili ? 'Utaratibu wa Bima (Insurance Direct)' : 'Insurance Pre-Auth Settlement'}
                      </h4>
                      <p className="text-xs text-slate-500 dark:text-slate-300 leading-relaxed">
                        {isSwahili
                          ? 'Gharama inalipwa moja kwa moja na Mfuko wa Bima (NHIF, Jubilee, AAR n.k). Mgonjwa halipi au analipa co-pay ndogo tu.'
                          : 'Billed directly to your insurance policy. Instant pre-authorization and zero-hassle clearance.'}
                      </p>
                    </div>
                  </button>

                  {/* Option 2: Cash / Direct Pay */}
                  <button
                    type="button"
                    id="btn-choose-cash-checkout"
                    onClick={() => setCheckoutMode('cash')}
                    className={`p-4 rounded-2xl border text-left transition-all cursor-pointer flex flex-col justify-between ${
                      checkoutMode === 'cash'
                        ? isDark
                          ? 'bg-gradient-to-br from-[#12382B] to-[#164E3D] border-emerald-400 shadow-md ring-2 ring-emerald-400/40'
                          : 'bg-gradient-to-br from-emerald-50 to-primary-light border-emerald-600 shadow-md ring-2 ring-emerald-600/20'
                        : isDark
                        ? 'bg-[#091422] border-slate-800 hover:border-slate-700'
                        : 'bg-white border-slate-200 hover:border-slate-300'
                    }`}
                  >
                    <div className="flex items-start justify-between mb-2">
                      <div className="w-10 h-10 rounded-xl bg-emerald-500/20 text-emerald-500 dark:text-emerald-400 flex items-center justify-center font-bold">
                        <Banknote className="w-5 h-5" />
                      </div>
                      <span
                        className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                          checkoutMode === 'cash'
                            ? 'bg-emerald-500 text-white font-semibold'
                            : 'bg-slate-700 text-slate-300'
                        }`}
                      >
                        {isSwahili ? 'Pesa Taslimu / Simu / GePG' : 'Direct Cash / Mobile Pay'}
                      </span>
                    </div>

                    <div>
                      <h4 className="text-sm font-semibold text-slate-900 dark:text-white mb-1">
                        2. {isSwahili ? 'Utaratibu wa Pesa Taslimu (Direct Pay)' : 'Cash & Mobile Money Settlement'}
                      </h4>
                      <p className="text-xs text-slate-500 dark:text-slate-300 leading-relaxed">
                        {isSwahili
                          ? 'Lipa kwa M-Pesa, Tigo Pesa, Airtel Money, Kadi au Pesa Taslimu Kaunta kwa kutumia Namba ya Kumbukumbu (Control Number).'
                          : 'Pay instantly with mobile money, credit card, or at the hospital cashier counter via an Electronic Control Number.'}
                      </p>
                    </div>
                  </button>
                </div>

                {/* ========================================================================= */}
                {/* SUB-FLOW 1: INSURANCE CHECKOUT PROCEDURE FORM */}
                {/* ========================================================================= */}
                {checkoutMode === 'insurance' && (
                  <div className="p-4 rounded-2xl bg-primary/30 border border-primary/30 space-y-4 animate-in fade-in">
                    <div className="flex items-center justify-between border-b border-primary/20 pb-3">
                      <div className="flex items-center gap-2">
                        <Shield className="w-5 h-5 text-primary-light" />
                        <h4 className="text-xs font-semibold text-primary-light uppercase tracking-wider">
                          Uthibitisho wa Bima ya Afya & Idhini ya Madai (Claim Authorization)
                        </h4>
                      </div>
                      <span className="text-[10px] font-bold text-emerald-400 bg-emerald-950 px-2 py-0.5 rounded border border-emerald-800">
                        NIDA Linked ✓
                      </span>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      {/* Provider Select */}
                      <div>
                        <label className="text-xs font-bold block mb-1 text-slate-300">
                          {isSwahili ? 'Mfuko / Kampuni ya Bima:' : 'Insurance Provider:'}
                        </label>
                        <select
                          value={selectedInsuranceProvider}
                          onChange={(e) => setSelectedInsuranceProvider(e.target.value)}
                          className={`w-full p-2.5 rounded-xl border text-xs font-bold outline-none ${
                            isDark ? 'bg-slate-900 border-slate-700 text-white' : 'bg-white border-slate-300 text-slate-900'
                          }`}
                        >
                          {TANZANIA_INSURANCE_PROVIDERS.map((p) => (
                            <option key={p.name} value={p.name}>
                              {p.name} ({p.type === 'public' ? 'Serikali' : 'Binafsi'})
                            </option>
                          ))}
                          <option value="Allianz Global Care / Travel Insurance">
                            Allianz Global Care / Travel Insurance (International)
                          </option>
                          <option value="Cigna Global / Bupa International">
                            Cigna Global / Bupa International (Expat)
                          </option>
                        </select>
                      </div>

                      {/* Card / Policy Number */}
                      <div>
                        <label className="text-xs font-bold block mb-1 text-slate-300">
                          {isSwahili ? 'Namba ya Kadi ya Bima / Sera:' : 'Insurance Policy / Card ID:'}
                        </label>
                        <input
                          type="text"
                          value={insuranceCardNo}
                          onChange={(e) => setInsuranceCardNo(e.target.value)}
                          placeholder="e.g. 23-904128-NHIF"
                          className={`w-full p-2.5 rounded-xl border text-xs font-mono font-bold outline-none ${
                            isDark ? 'bg-slate-900 border-slate-700 text-white' : 'bg-white border-slate-300 text-slate-900'
                          }`}
                        />
                      </div>
                    </div>

                    {/* Pre-Auth & Coverage Details */}
                    <div className="p-3 rounded-xl bg-slate-900/80 border border-slate-700/60 text-xs space-y-2">
                      <div className="flex items-center justify-between">
                        <span className="text-slate-400">Namba ya Kibali (Pre-Authorization Code):</span>
                        <span className="font-mono font-bold text-primary-light">{insurancePreAuthCode}</span>
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-slate-400">Kiwango Kinachofunikwa na Bima (100%):</span>
                        <span className="font-mono font-semibold text-emerald-400">
                          TZS {insuranceCoveredAmountTzs.toLocaleString()}
                        </span>
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-slate-400">Gharama ya Mgonjwa (Co-Pay):</span>
                        <span className="font-mono font-bold text-slate-300">
                          TZS {patientCoPayAmountTzs.toLocaleString()} (0 TZS)
                        </span>
                      </div>
                    </div>

                    {/* Submit Insurance Checkout */}
                    <button
                      type="button"
                      id="btn-confirm-insurance-claim"
                      onClick={handleAuthorizeInsuranceCheckout}
                      disabled={isProcessingPayment}
                      className="w-full py-3.5 px-4 rounded-2xl bg-primary hover:bg-primary-light text-white font-semibold text-sm flex items-center justify-center gap-2 shadow-lg shadow-primary/20 cursor-pointer transition-all active:scale-98 disabled:opacity-50"
                    >
                      {isProcessingPayment ? (
                        <>
                          <RefreshCw className="w-4 h-4 animate-spin" />
                          <span>Inaidhinisha Madai na Mfuko wa Bima...</span>
                        </>
                      ) : (
                        <>
                          <CheckCircle2 className="w-4 h-4" />
                          <span>
                            {isSwahili
                              ? `Idhinisha Malipo ya Bima (TZS ${insuranceCoveredAmountTzs.toLocaleString()})`
                              : `Authorize Insurance Claim (TZS ${insuranceCoveredAmountTzs.toLocaleString()})`}
                          </span>
                        </>
                      )}
                    </button>
                  </div>
                )}

                {/* ========================================================================= */}
                {/* SUB-FLOW 2: CASH & MOBILE MONEY PROCEDURE FORM */}
                {/* ========================================================================= */}
                {checkoutMode === 'cash' && (
                  <div className="p-4 rounded-2xl bg-emerald-950/30 border border-emerald-500/30 space-y-4 animate-in fade-in">
                    <div className="flex items-center justify-between border-b border-emerald-500/20 pb-3">
                      <div className="flex items-center gap-2">
                        <Banknote className="w-5 h-5 text-emerald-400" />
                        <h4 className="text-xs font-semibold text-emerald-300 uppercase tracking-wider">
                          Chagua Njia ya Kulipa Taslimu au Simu ya Mkononi
                        </h4>
                      </div>
                      <span className="text-[10px] font-bold text-emerald-400 bg-emerald-950 px-2 py-0.5 rounded border border-emerald-800">
                        GePG & Mobile Push
                      </span>
                    </div>

                    {/* Method Radio Pills */}
                    <div className="grid grid-cols-3 gap-2">
                      <button
                        type="button"
                        onClick={() => setCashPaymentMethod('mpesa')}
                        className={`p-2.5 rounded-xl border text-center font-bold text-xs transition-all cursor-pointer ${
                          cashPaymentMethod === 'mpesa'
                            ? 'bg-emerald-600 text-white border-emerald-500 shadow-sm'
                            : isDark
                            ? 'bg-slate-900 border-slate-700 text-slate-300 hover:border-slate-500'
                            : 'bg-white border-slate-200 text-slate-700'
                        }`}
                      >
                        <Smartphone className="w-4 h-4 mx-auto mb-1" />
                        <span>M-Pesa / Tigo / Airtel</span>
                      </button>

                      <button
                        type="button"
                        onClick={() => setCashPaymentMethod('cash_counter')}
                        className={`p-2.5 rounded-xl border text-center font-bold text-xs transition-all cursor-pointer ${
                          cashPaymentMethod === 'cash_counter'
                            ? 'bg-emerald-600 text-white border-emerald-500 shadow-sm'
                            : isDark
                            ? 'bg-slate-900 border-slate-700 text-slate-300 hover:border-slate-500'
                            : 'bg-white border-slate-200 text-slate-700'
                        }`}
                      >
                        <Building2 className="w-4 h-4 mx-auto mb-1" />
                        <span>Dirishani (Cashier)</span>
                      </button>

                      <button
                        type="button"
                        onClick={() => setCashPaymentMethod('card')}
                        className={`p-2.5 rounded-xl border text-center font-bold text-xs transition-all cursor-pointer ${
                          cashPaymentMethod === 'card'
                            ? 'bg-emerald-600 text-white border-emerald-500 shadow-sm'
                            : isDark
                            ? 'bg-slate-900 border-slate-700 text-slate-300 hover:border-slate-500'
                            : 'bg-white border-slate-200 text-slate-700'
                        }`}
                      >
                        <CreditCard className="w-4 h-4 mx-auto mb-1" />
                        <span>Kadi (Visa/Mastercard)</span>
                      </button>
                    </div>

                    {/* Method Specific Form */}
                    {cashPaymentMethod === 'mpesa' && (
                      <div className="space-y-3 pt-2">
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                          <div>
                            <label className="text-xs font-bold block mb-1 text-slate-300">
                              Mtandao wa Simu:
                            </label>
                            <div className="grid grid-cols-4 gap-1.5 text-xs font-bold">
                              {(['mpesa', 'tigo', 'airtel', 'halopesa'] as const).map((net) => (
                                <button
                                  key={net}
                                  type="button"
                                  onClick={() => setMobileNetwork(net)}
                                  className={`py-2 px-1 rounded-lg border text-center font-mono text-[11px] uppercase transition-all cursor-pointer ${
                                    mobileNetwork === net
                                      ? 'bg-emerald-500 text-white border-emerald-400 font-semibold'
                                      : isDark
                                      ? 'bg-slate-900 border-slate-700 text-slate-300'
                                      : 'bg-white border-slate-200 text-slate-700'
                                  }`}
                                >
                                  {net === 'mpesa' ? 'M-PESA' : net === 'tigo' ? 'TIGO' : net === 'airtel' ? 'AIRTEL' : 'HALO'}
                                </button>
                              ))}
                            </div>
                          </div>

                          <div>
                            <label className="text-xs font-bold block mb-1 text-slate-300">
                              Namba ya Simu ya Mlipaji:
                            </label>
                            <input
                              type="text"
                              value={payerPhone}
                              onChange={(e) => setPayerPhone(e.target.value)}
                              placeholder="+255 754 829 140"
                              className={`w-full p-2 rounded-xl border text-xs font-mono font-bold outline-none ${
                                isDark ? 'bg-slate-900 border-slate-700 text-white' : 'bg-white border-slate-300 text-slate-900'
                              }`}
                            />
                          </div>
                        </div>

                        <div className="p-3 rounded-xl bg-slate-900/90 border border-emerald-500/30 text-xs flex items-center justify-between">
                          <div>
                            <span className="text-slate-400 block text-[11px]">Lipa Namba ya Hospitali:</span>
                            <span className="font-mono font-semibold text-amber-400">552100 (Muhimbili Pay)</span>
                          </div>
                          <div className="text-right">
                            <span className="text-slate-400 block text-[11px]">Kiasi cha Kulipa:</span>
                            <span className="font-mono font-semibold text-emerald-400 text-sm">
                              TZS {currentBill.totalTzs.toLocaleString()}
                            </span>
                          </div>
                        </div>
                      </div>
                    )}

                    {cashPaymentMethod === 'cash_counter' && (
                      <div className="space-y-3 pt-2">
                        <div className="p-3.5 rounded-2xl bg-amber-950/30 border border-amber-500/40 text-amber-200 text-xs space-y-2">
                          <div className="flex items-center gap-2 font-semibold text-amber-400">
                            <AlertCircle className="w-4 h-4" />
                            <span>Utaratibu wa Kulipa Dirishani / Kaunta ya Mapokezi:</span>
                          </div>
                          <p className="text-[11px] leading-relaxed">
                            Onyesha Namba hii ya Kumbukumbu (Control Number) kwa mweka hazina wa hospitali au tumia namba hii kwenye ATM / Wakala wa Benki.
                          </p>
                          <div className="p-2.5 rounded-xl bg-slate-950 border border-amber-500/40 text-center">
                            <span className="text-[10px] uppercase tracking-wider text-slate-400 font-mono block">
                              ELECTRONIC CONTROL NUMBER (GePG)
                            </span>
                            <span className="font-mono font-semibold text-lg text-amber-400 tracking-wider">
                              {controlNumber}
                            </span>
                          </div>
                        </div>
                      </div>
                    )}

                    {cashPaymentMethod === 'card' && (
                      <div className="space-y-3 pt-2 text-xs">
                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                          <div className="sm:col-span-2">
                            <label className="text-xs font-bold block mb-1 text-slate-300">Namba ya Kadi:</label>
                            <input
                              type="text"
                              placeholder="4123 •••• •••• 8840"
                              defaultValue="4123 8891 0021 8840"
                              className={`w-full p-2 rounded-xl border text-xs font-mono outline-none ${
                                isDark ? 'bg-slate-900 border-slate-700 text-white' : 'bg-white border-slate-300'
                              }`}
                            />
                          </div>
                          <div>
                            <label className="text-xs font-bold block mb-1 text-slate-300">Tarehe & CVV:</label>
                            <input
                              type="text"
                              placeholder="08/29 - 881"
                              defaultValue="08/29 - 881"
                              className={`w-full p-2 rounded-xl border text-xs font-mono outline-none ${
                                isDark ? 'bg-slate-900 border-slate-700 text-white' : 'bg-white border-slate-300'
                              }`}
                            />
                          </div>
                        </div>
                      </div>
                    )}

                    {/* Submit Cash/Mobile Checkout */}
                    <button
                      type="button"
                      id="btn-confirm-cash-payment"
                      onClick={handleAuthorizeCashCheckout}
                      disabled={isProcessingPayment}
                      className="w-full py-3.5 px-4 rounded-2xl bg-emerald-500 hover:bg-emerald-400 text-white font-semibold text-sm flex items-center justify-center gap-2 shadow-lg shadow-emerald-500/20 cursor-pointer transition-all active:scale-98 disabled:opacity-50"
                    >
                      {isProcessingPayment ? (
                        <>
                          <RefreshCw className="w-4 h-4 animate-spin" />
                          <span>Inathibitisha Muamala na Mfumo wa Malipo...</span>
                        </>
                      ) : (
                        <>
                          <Check className="w-4 h-4" />
                          <span>
                            {cashPaymentMethod === 'mpesa'
                              ? `Tuma Ombi la Malipo kwa M-Pesa (TZS ${currentBill.totalTzs.toLocaleString()})`
                              : cashPaymentMethod === 'cash_counter'
                              ? `Thibitisha Malipo ya Dirishani (Control No: ${controlNumber})`
                              : `Lipa kwa Kadi (TZS ${currentBill.totalTzs.toLocaleString()})`}
                          </span>
                        </>
                      )}
                    </button>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* TAB 1 SUCCESS: OFFICIAL E-RECEIPT & DISCHARGE CLEARANCE PASS */}
          {activeTab === 'checkout' && settlementSuccess && settlementReceipt && (
            <div className="space-y-4 animate-in zoom-in-95">
              <div className="text-center space-y-2">
                <div className="w-14 h-14 rounded-2xl bg-emerald-500 text-white mx-auto flex items-center justify-center shadow-lg shadow-emerald-500/30">
                  <Check className="w-8 h-8" />
                </div>
                <h3 className="text-lg font-semibold text-slate-900 dark:text-white">
                  {isSwahili ? 'Malipo Yamekamilika na Kuthibitishwa!' : 'Payment Successfully Settled & Verified!'}
                </h3>
                <p className="text-xs text-slate-500 dark:text-slate-300 max-w-md mx-auto">
                  {isSwahili
                    ? `Ankara imelipwa kikamilifu kupitia ${settlementReceipt.methodTitle}. Kibali chako cha kuruhusiwa (Discharge & Pharmacy Clearance) kiko tayari.`
                    : `Medical invoice successfully settled. Your official hospital clearance pass is ready.`}
                </p>
              </div>

              {/* Official Electronic Receipt Card */}
              <div className="p-5 rounded-2xl bg-slate-950 border border-emerald-500/40 text-white space-y-4 shadow-xl">
                <div className="flex items-center justify-between border-b border-white/10 pb-3">
                  <div>
                    <span className="text-[10px] uppercase font-mono tracking-wider text-emerald-400 font-bold block">
                      OFFICIAL ELECTRONIC RECEIPT
                    </span>
                    <span className="font-mono font-semibold text-lg text-white">
                      {settlementReceipt.receiptNo}
                    </span>
                  </div>
                  <div className="text-right">
                    <span className="text-[10px] uppercase font-mono tracking-wider text-primary-light font-bold block">
                      STATUS
                    </span>
                    <span className="font-bold text-xs text-emerald-400 px-2 py-0.5 rounded bg-emerald-950 border border-emerald-800">
                      PAID / CLEARED ✓
                    </span>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3 text-xs">
                  <div>
                    <span className="text-[10px] text-slate-400 block font-semibold">Mgonjwa (Patient):</span>
                    <p className="font-bold text-white text-sm">{patientName}</p>
                    <p className="text-[11px] text-slate-400 font-mono">{patientPhone}</p>
                  </div>
                  <div>
                    <span className="text-[10px] text-slate-400 block font-semibold">Hospitali (Facility):</span>
                    <p className="font-bold text-white text-xs">{settlementReceipt.facility}</p>
                    <p className="text-[10px] text-slate-400 font-mono">{settlementReceipt.timestamp}</p>
                  </div>
                  <div>
                    <span className="text-[10px] text-slate-400 block font-semibold">Njia ya Malipo (Method):</span>
                    <p className="font-bold text-primary-light text-xs">{settlementReceipt.methodTitle}</p>
                    <p className="text-[10px] text-slate-400 font-mono">Ref: {settlementReceipt.authRef}</p>
                  </div>
                  <div>
                    <span className="text-[10px] text-slate-400 block font-semibold">Kiasi Kilicholipwa (Amount):</span>
                    <p className="font-mono font-semibold text-emerald-400 text-sm">
                      TZS {settlementReceipt.amountPaidTzs.toLocaleString()}
                    </p>
                    <span className="text-[10px] text-slate-400">(${settlementReceipt.amountPaidUsd} USD)</span>
                  </div>
                </div>

                {/* Gate & Pharmacy QR Pass */}
                <div className="pt-3 border-t border-white/10 flex flex-col sm:flex-row items-center justify-between gap-3">
                  <div className="flex items-center gap-3">
                    <div className="w-14 h-14 bg-white p-1 rounded-xl flex-shrink-0">
                      <img
                        src={`https://api.qrserver.com/v1/create-qr-code/?size=100x100&data=NIACARE_RECEIPT_${settlementReceipt.receiptNo}`}
                        alt="Receipt Clearance QR"
                        className="w-full h-full rounded"
                        referrerPolicy="no-referrer"
                      />
                    </div>
                    <div>
                      <span className="text-[10px] font-bold text-primary-light block uppercase">
                        KIBALI CHA LANGONI NA DAWA
                      </span>
                      <p className="text-xs text-slate-300">
                        Onyesha msimbo huu duka la dawa au lango kuu la kutoka hospitali.
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 w-full sm:w-auto">
                    <button
                      type="button"
                      onClick={() =>
                        generateReceiptPdf(settlementReceipt, {
                          name: patientName,
                          id: authUserId ? `NC-${authUserId.slice(0, 8).toUpperCase()}` : 'NC-GUEST',
                        })
                      }
                      className="flex-1 sm:flex-none px-3 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-white font-semibold text-xs flex items-center justify-center gap-1 cursor-pointer"
                    >
                      <Download className="w-3.5 h-3.5" />
                      <span>Pakua PDF</span>
                    </button>
                    <button
                      type="button"
                      onClick={handleResetForNewCheckout}
                      className="flex-1 sm:flex-none px-4 py-2 rounded-xl bg-primary hover:bg-primary-light text-white font-bold text-xs flex items-center justify-center gap-1 cursor-pointer"
                    >
                      <span>Malipo Mengine</span>
                    </button>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* TAB 2: STEP-BY-STEP PROCEDURE GUIDES */}
          {activeTab === 'procedures_guide' && (
            <div className="space-y-5 animate-in fade-in">
              <div className="text-center max-w-lg mx-auto space-y-1">
                <h3 className="text-base font-semibold text-slate-900 dark:text-white">
                  {isSwahili ? 'Miongozo ya Taratibu za Malipo ya Hospitali' : 'Hospital Billing & Checkout Procedures'}
                </h3>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  {isSwahili
                    ? 'Fahamu hatua sahihi za kutumia Bima ya Afya dhidi ya Pesa Taslimu hospitalini.'
                    : 'Clear breakdown of medical settlement procedures for insured patients and cash payers.'}
                </p>
              </div>

              {/* Grid: 2 Procedure Comparison Flowcharts */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* Guide 1: Insurance Procedure */}
                <div
                  className={`p-4 sm:p-5 rounded-2xl border ${
                    isDark ? 'bg-[#0E1F33] border-primary/30' : 'bg-primary/5 border-primary/20'
                  }`}
                >
                  <div className="flex items-center gap-2.5 mb-3">
                    <div className="w-9 h-9 rounded-xl bg-primary/20 text-primary-light flex items-center justify-center">
                      <Shield className="w-5 h-5" />
                    </div>
                    <div>
                      <h4 className="text-sm font-semibold text-slate-900 dark:text-white">
                        {isSwahili ? '1. Utaratibu wa Bima ya Afya (NHIF / Binafsi)' : '1. Insurance Settlement Workflow'}
                      </h4>
                      <span className="text-[10px] text-primary dark:text-primary-light font-bold block">
                        Uhakiki wa Kidijitali kupitia NIDA & Bima ID
                      </span>
                    </div>
                  </div>

                  <div className="space-y-3 text-xs">
                    {/* Step 1 */}
                    <div className="flex items-start gap-2.5">
                      <div className="w-6 h-6 rounded-full bg-primary text-white font-semibold text-xs flex items-center justify-center flex-shrink-0 mt-0.5">
                        1
                      </div>
                      <div>
                        <h5 className="font-bold text-slate-900 dark:text-white">Uthibitisho Mapokezi (Registration):</h5>
                        <p className="text-slate-500 dark:text-slate-400 text-[11px]">
                          Onyesha Kadi ya Bima au NIDA kwenye kaunta ya mapokezi ya hospitali. Mfumo unathibitisha uhalali mara moja.
                        </p>
                      </div>
                    </div>

                    {/* Step 2 */}
                    <div className="flex items-start gap-2.5">
                      <div className="w-6 h-6 rounded-full bg-primary text-white font-semibold text-xs flex items-center justify-center flex-shrink-0 mt-0.5">
                        2
                      </div>
                      <div>
                        <h5 className="font-bold text-slate-900 dark:text-white">Huduma & Daktari (Consultation & Lab):</h5>
                        <p className="text-slate-500 dark:text-slate-400 text-[11px]">
                          Daktari anaandika vipimo na dawa zinazoingizwa kwenye mfumo wa madai ya bima (Claims Portal).
                        </p>
                      </div>
                    </div>

                    {/* Step 3 */}
                    <div className="flex items-start gap-2.5">
                      <div className="w-6 h-6 rounded-full bg-primary text-white font-semibold text-xs flex items-center justify-center flex-shrink-0 mt-0.5">
                        3
                      </div>
                      <div>
                        <h5 className="font-bold text-slate-900 dark:text-white">Idhini ya Madai (Pre-Auth / Approval):</h5>
                        <p className="text-slate-500 dark:text-slate-400 text-[11px]">
                          Mfuko wa bima unatoa Namba ya Idhini (Approval Code). Hakuna kutoa pesa mkononi isipokuwa huduma maalum za ziada.
                        </p>
                      </div>
                    </div>

                    {/* Step 4 */}
                    <div className="flex items-start gap-2.5">
                      <div className="w-6 h-6 rounded-full bg-primary text-white font-semibold text-xs flex items-center justify-center flex-shrink-0 mt-0.5">
                        4
                      </div>
                      <div>
                        <h5 className="font-bold text-slate-900 dark:text-white">Kusaini Fomu ya Madai (Claim Sign-off):</h5>
                        <p className="text-slate-500 dark:text-slate-400 text-[11px]">
                          Weka saini ya kidijitali au alama ya kidole kwenye kadi ya NiaCare kuthibitisha huduma zilizopokelewa.
                        </p>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Guide 2: Cash & Mobile Procedure */}
                <div
                  className={`p-4 sm:p-5 rounded-2xl border ${
                    isDark ? 'bg-[#0E1F33] border-emerald-500/30' : 'bg-emerald-50/70 border-emerald-200'
                  }`}
                >
                  <div className="flex items-center gap-2.5 mb-3">
                    <div className="w-9 h-9 rounded-xl bg-emerald-500/20 text-emerald-400 flex items-center justify-center">
                      <Banknote className="w-5 h-5" />
                    </div>
                    <div>
                      <h4 className="text-sm font-semibold text-slate-900 dark:text-white">
                        {isSwahili ? '2. Utaratibu wa Pesa Taslimu (Direct Pay)' : '2. Cash & Mobile Payment Workflow'}
                      </h4>
                      <span className="text-[10px] text-emerald-600 dark:text-emerald-300 font-bold block">
                        Kupitia Simu (M-Pesa/Tigo/Airtel) au Dirishani kwa Control No.
                      </span>
                    </div>
                  </div>

                  <div className="space-y-3 text-xs">
                    {/* Step 1 */}
                    <div className="flex items-start gap-2.5">
                      <div className="w-6 h-6 rounded-full bg-emerald-500 text-white font-semibold text-xs flex items-center justify-center flex-shrink-0 mt-0.5">
                        1
                      </div>
                      <div>
                        <h5 className="font-bold text-slate-900 dark:text-white">Kupokea Ankara (Receive Medical Bill):</h5>
                        <p className="text-slate-500 dark:text-slate-400 text-[11px]">
                          Hospitali inatoa ankara iliyoorodhesha ada ya daktari, maabara, dawa na wodi.
                        </p>
                      </div>
                    </div>

                    {/* Step 2 */}
                    <div className="flex items-start gap-2.5">
                      <div className="w-6 h-6 rounded-full bg-emerald-500 text-white font-semibold text-xs flex items-center justify-center flex-shrink-0 mt-0.5">
                        2
                      </div>
                      <div>
                        <h5 className="font-bold text-slate-900 dark:text-white">Namba ya Malipo (Control Number / Lipa Namba):</h5>
                        <p className="text-slate-500 dark:text-slate-400 text-[11px]">
                          Mfumo unakupa Namba ya Kumbukumbu ya Serikali (GePG) au Lipa Namba ya hospitali.
                        </p>
                      </div>
                    </div>

                    {/* Step 3 */}
                    <div className="flex items-start gap-2.5">
                      <div className="w-6 h-6 rounded-full bg-emerald-500 text-white font-semibold text-xs flex items-center justify-center flex-shrink-0 mt-0.5">
                        3
                      </div>
                      <div>
                        <h5 className="font-bold text-slate-900 dark:text-white">Ulipaji wa Papo kwa Papo (Instant Settlement):</h5>
                        <p className="text-slate-500 dark:text-slate-400 text-[11px]">
                          Lipa kwa simu kwa kuweka PIN ya M-Pesa au lipa dirishani kwa fedha taslimu na kupokea stakabadhi.
                        </p>
                      </div>
                    </div>

                    {/* Step 4 */}
                    <div className="flex items-start gap-2.5">
                      <div className="w-6 h-6 rounded-full bg-emerald-500 text-white font-semibold text-xs flex items-center justify-center flex-shrink-0 mt-0.5">
                        4
                      </div>
                      <div>
                        <h5 className="font-bold text-slate-900 dark:text-white">Risiti & Kibali cha Kutoka (E-Receipt & Gate Pass):</h5>
                        <p className="text-slate-500 dark:text-slate-400 text-[11px]">
                          Mfumo unazalisha risiti ya kielektroniki yenye msimbo wa QR ili kuchukua dawa na kupita langoni.
                        </p>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Action button to switch to checkout */}
              <div className="text-center pt-2">
                <button
                  type="button"
                  onClick={() => setActiveTab('checkout')}
                  className="px-6 py-3 rounded-2xl bg-emerald-500 hover:bg-emerald-400 text-white font-semibold text-xs inline-flex items-center gap-2 cursor-pointer shadow-lg transition-all"
                >
                  <CreditCard className="w-4 h-4" />
                  <span>{isSwahili ? 'Anza Kulipa Ankara Sasa (Proceed to Checkout)' : 'Proceed to Settle Bill'}</span>
                  <ArrowRight className="w-4 h-4" />
                </button>
              </div>
            </div>
          )}

          {/* TAB 3: RECEIPTS & GATE CLEARANCE HISTORY */}
          {activeTab === 'history' && (
            <div className="space-y-4 animate-in fade-in">
              <div className="flex items-center justify-between">
                <h4 className="text-xs font-semibold uppercase tracking-wider text-slate-400">
                  {isSwahili ? 'Historia ya Risiti & Vibali vya Kutoka' : 'Settlement History & Clearance Passes'}
                </h4>
                <span className="text-[11px] font-bold text-emerald-400">
                  Zote Zimeidhinishwa (Verified)
                </span>
              </div>

              <div className="space-y-3">
                {bills.filter((b) => b.status === 'settled').length === 0 ? (
                  <div className="text-center py-12 space-y-2">
                    <FileText className="w-10 h-10 text-slate-400 mx-auto opacity-50" />
                    <p className="text-xs font-bold text-slate-500">
                      {isSwahili
                        ? 'Huna risiti zilizolipwa bado.'
                        : 'No settled receipts yet.'}
                    </p>
                  </div>
                ) : (
                  bills
                    .filter((b) => b.status === 'settled')
                    .map((b) => (
                      <div
                        key={b.id}
                        className={`p-4 rounded-2xl border flex flex-col sm:flex-row sm:items-center justify-between gap-3 ${
                          isDark ? 'bg-[#0E1E31] border-slate-800' : 'bg-white border-slate-200 shadow-xs'
                        }`}
                      >
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 rounded-xl bg-emerald-500/20 text-emerald-400 flex items-center justify-center font-bold flex-shrink-0">
                            <CheckCircle2 className="w-5 h-5" />
                          </div>
                          <div>
                            <div className="flex items-center gap-2">
                              <h5 className="font-bold text-xs text-slate-900 dark:text-white">
                                {b.invoiceNumber}
                              </h5>
                              <span className="text-[10px] font-bold font-mono px-1.5 py-0.2 bg-emerald-500/20 text-emerald-400 rounded">
                                {isSwahili ? 'Imelipwa ✓' : 'Settled ✓'}
                              </span>
                            </div>
                            <p className="text-[11px] text-slate-500 dark:text-slate-400">
                              {b.facility} • {b.department} • {b.date}
                            </p>
                          </div>
                        </div>

                        <div className="flex items-center gap-3 justify-between sm:justify-end">
                          <div className="text-right">
                            <span className="font-mono font-semibold text-xs text-emerald-400">
                              TZS {b.totalTzs.toLocaleString()}
                            </span>
                          </div>
                        </div>
                      </div>
                    ))
                )}
              </div>
            </div>
          )}
        </div>

        {/* ========================================================================= */}
        {/* FOOTER */}
        {/* ========================================================================= */}
        <div
          className={`p-3.5 sm:p-4 border-t flex items-center justify-between text-xs flex-shrink-0 ${
            isDark ? 'bg-[#0E1F33] border-slate-800' : 'bg-slate-50 border-slate-200'
          }`}
        >
          <div className="flex items-center gap-2 text-slate-500 dark:text-slate-400">
            <Shield className="w-4 h-4 text-emerald-500" />
            <span className="text-[11px]">
              NiaCare SafePay • 256-Bit Encrypted • Inazingatia Taratibu za NHIF & GePG
            </span>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 rounded-xl bg-slate-200 dark:bg-slate-800 hover:bg-slate-300 dark:hover:bg-slate-700 font-bold text-xs cursor-pointer transition-all"
          >
            {isSwahili ? 'Funga Dirisha' : 'Close'}
          </button>
        </div>
      </div>
    </div>
  );
};
