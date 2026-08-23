import React, { useState } from 'react';
import { ShieldCheck, QrCode, CheckCircle2, Download, Share2, Heart, Activity, RefreshCw, Calendar } from 'lucide-react';
import { UserCategory, Language, LocalFormData, InternationalFormData } from '../types';
import { TRANSLATIONS } from '../data/translations';
import { formatDob } from '../utils/dateUtils';
import { getPatientCountry } from '../data/countries';

interface SuccessPassportModalProps {
  isOpen: boolean;
  onClose: () => void;
  onReset: () => void;
  userCategory: UserCategory;
  localData: LocalFormData;
  intlData: InternationalFormData;
  language: Language;
}

export const SuccessPassportModal: React.FC<SuccessPassportModalProps> = ({
  isOpen,
  onClose,
  onReset,
  userCategory,
  localData,
  intlData,
  language,
}) => {
  const [toastMessage, setToastMessage] = useState('');
  const t = TRANSLATIONS.successModal;

  if (!isOpen) return null;

  const isLocal = userCategory === 'locals';
  const patientName = isLocal ? localData.fullName || 'Amina Salum Bakari' : intlData.fullName || 'Marcus Vance';
  const patientCountry = getPatientCountry(userCategory, localData, intlData);
  
  let idLabel = 'Passport';
  let idNumber = intlData.passportNumber || 'US89240182A';

  if (isLocal) {
    const docType = localData.selectedDocType || 'nida';
    if (docType === 'nida') {
      idLabel = 'NIDA / NIN';
      idNumber = localData.nidaNumber || '19950412111020000421';
    } else if (docType === 'insurance') {
      idLabel = 'Bima Card';
      idNumber = localData.insuranceNumber || 'NHIF-TZ-8849201';
    } else {
      idLabel = 'RITA Cert';
      idNumber = localData.birthCertId || 'RITA-2018-938210';
    }
  }

  const insuranceName = isLocal ? (localData.insuranceProvider.toUpperCase() || 'NHIF') : (intlData.travelInsuranceProvider.toUpperCase() || 'ALLIANZ GLOBAL');
  const patientId = `NC-TZ-${Math.floor(100000 + Math.random() * 900000)}`;

  const activeDob = isLocal
    ? formatDob(localData.birthYear, localData.birthMonth, localData.birthDay, language) || (localData.age ? `${localData.age} yrs` : '12 Apr 1995')
    : formatDob(intlData.birthYear, intlData.birthMonth, intlData.birthDay, language) || (intlData.age ? `${intlData.age} yrs` : '24 Aug 1990');

  const activeAge = isLocal ? localData.age || '31' : intlData.age || '35';
  const activeBloodType = (isLocal ? localData.bloodType : intlData.bloodType) || 'O+';

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(''), 3000);
  };

  return (
    <div
      id="modal-success-passport"
      className="fixed inset-0 z-50 bg-black/80 backdrop-blur-md flex items-center justify-center p-4 overflow-y-auto animate-in fade-in duration-200"
    >
      <div className="bg-[#0B1A2C] text-white w-full max-w-md rounded-3xl p-6 shadow-2xl border border-blue-500/40 relative overflow-hidden animate-in zoom-in-95 duration-200 my-auto">
        {/* Glow effects */}
        <div className="absolute top-0 right-0 w-48 h-48 bg-[#0F4C81]/40 rounded-full blur-3xl -z-10"></div>
        <div className="absolute bottom-0 left-0 w-48 h-48 bg-emerald-500/20 rounded-full blur-3xl -z-10"></div>

        {/* Top Celebration Badge */}
        <div className="text-center mb-4">
          <div className="w-14 h-14 bg-emerald-500 text-white rounded-2xl flex items-center justify-center mx-auto mb-2.5 shadow-lg shadow-emerald-500/30 ring-4 ring-emerald-400/20">
            <CheckCircle2 className="w-8 h-8 animate-bounce" />
          </div>
          <span className="text-[11px] font-mono font-bold uppercase tracking-wider text-emerald-300 bg-emerald-950/60 px-3 py-1 rounded-full border border-emerald-500/40">
            {t.authenticatedBadge[language]}
          </span>
          <h3 className="text-xl font-black text-white mt-1.5">
            {t.cardReadyTitle[language]}
          </h3>
          <p className="text-xs text-slate-400 mt-0.5">
            {t.cardReadyDesc[language]}
          </p>
        </div>

        {/* Digital Health Smart Card (NiaCare Universal Card) */}
        <div className="bg-gradient-to-br from-[#0F4C81] via-[#0B3A64] to-[#082846] rounded-2xl p-4.5 text-white border border-blue-400/40 shadow-2xl relative overflow-hidden mb-5">
          {/* Card background watermark */}
          <div className="absolute right-[-20px] bottom-[-20px] opacity-10 pointer-events-none">
            <Heart className="w-40 h-40" />
          </div>

          {/* Card Header */}
          <div className="flex items-center justify-between border-b border-white/15 pb-2.5 mb-3">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-lg bg-white p-1 flex items-center justify-center">
                <img
                  src="/src/assets/images/niacare_app_logo_1787113371659.jpg"
                  alt="Logo"
                  referrerPolicy="no-referrer"
                  className="w-full h-full object-contain rounded"
                />
              </div>
              <div>
                <span className="font-extrabold text-sm tracking-wide flex items-center gap-1.5">
                  <span>NiaCare™ Passport</span>
                  <span>{patientCountry.flag}</span>
                </span>
                <p className="text-[9px] text-blue-200 font-mono">{patientCountry.headerTitle}</p>
              </div>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="text-[10px] bg-white/15 text-white font-mono font-bold px-2 py-0.5 rounded-full border border-white/20 flex items-center gap-1">
                <span>{patientCountry.flag}</span>
                <span>{patientCountry.code}</span>
              </span>
              <span className="text-[10px] bg-emerald-400/20 text-emerald-300 font-mono font-bold px-2 py-0.5 rounded-full border border-emerald-400/40 flex items-center gap-1">
                <ShieldCheck className="w-3 h-3" /> ACTIVE
              </span>
            </div>
          </div>

          {/* Card Body */}
          <div className="grid grid-cols-3 gap-2 text-xs">
            <div className="col-span-2 space-y-2">
              <div>
                <span className="text-[9px] text-blue-200 font-medium block uppercase tracking-wider">
                  {t.patientLegalName[language]}
                </span>
                <p className="font-bold text-sm text-white tracking-tight truncate">{patientName}</p>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <span className="text-[9px] text-blue-200 font-medium block uppercase">
                    {idLabel}
                  </span>
                  <p className="font-mono font-semibold text-[11px] text-blue-100 truncate">{idNumber}</p>
                </div>
                <div>
                  <span className="text-[9px] text-blue-200 font-medium block uppercase">
                    {t.coverLabel[language]}
                  </span>
                  <p className="font-bold text-[11px] text-emerald-300 truncate">{insuranceName}</p>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <span className="text-[9px] text-blue-200 font-medium block uppercase">
                    {t.universalIdLabel[language]}
                  </span>
                  <p className="font-mono text-xs text-yellow-300 font-bold">{patientId}</p>
                </div>
                <div>
                  <span className="text-[9px] text-blue-200 font-medium block uppercase">
                    DOB / Umri
                  </span>
                  <p className="font-medium text-[11px] text-cyan-200 truncate">
                    {activeDob} ({activeAge}y)
                  </p>
                </div>
              </div>
            </div>

            {/* QR Code section */}
            <div className="flex flex-col items-center justify-center bg-white p-2 rounded-xl text-slate-900 shadow-inner">
              <QrCode className="w-16 h-16 text-[#0F4C81]" />
              <span className="text-[8px] font-mono font-bold text-slate-600 mt-1 uppercase">{t.oneTapScan[language]}</span>
            </div>
          </div>

          {/* Quick Vital Safety Strip */}
          <div className="mt-3 pt-2.5 border-t border-white/10 flex items-center justify-between text-[10px] text-blue-200">
            <span className="flex items-center gap-1.5 font-semibold text-white">
              <Activity className="w-3.5 h-3.5 text-rose-400" />
              <span>{t.bloodGroup[language]}:</span>
              <span className="text-rose-300 font-extrabold font-mono px-1.5 py-0.2 rounded bg-rose-500/20 border border-rose-400/40">
                {activeBloodType === 'unknown' ? (language === 'sw' ? 'Sina Uhakika' : 'Unknown') : activeBloodType}
              </span>
            </span>
            <span className="text-emerald-300 font-mono font-bold">{t.biometricKey[language]}</span>
          </div>
        </div>

        {/* Toast notification if triggered */}
        {toastMessage && (
          <div className="mb-3 text-center text-xs bg-emerald-500/20 border border-emerald-400/40 text-emerald-300 py-1.5 px-3 rounded-xl animate-in fade-in">
            {toastMessage}
          </div>
        )}

        {/* Action Buttons */}
        <div className="space-y-2">
          {/* Primary Action: Go to Home Dashboard */}
          <button
            id="btn-go-to-dashboard"
            type="button"
            onClick={onClose}
            className="w-full bg-cyan-500 hover:bg-cyan-400 text-slate-950 py-3 px-4 rounded-xl font-black text-sm flex items-center justify-center gap-2 shadow-lg shadow-cyan-500/20 cursor-pointer transition-all active:scale-98"
          >
            <span>{language === 'sw' ? 'Endelea kwenye Dashibodi ya Afya' : language === 'fr' ? 'Accéder au Tableau de Bord' : 'Enter Home Health Dashboard'}</span>
            <span>→</span>
          </button>

          <div className="grid grid-cols-2 gap-2">
            <button
              id="btn-download-pass"
              type="button"
              onClick={() => showToast(t.walletAlert[language])}
              className="w-full bg-white/15 hover:bg-white/25 text-white py-2.5 px-3 rounded-xl font-bold text-xs flex items-center justify-center gap-1.5 border border-white/20 shadow-md cursor-pointer transition-colors"
            >
              <Download className="w-3.5 h-3.5 text-cyan-300" />
              <span>{t.addToWallet[language]}</span>
            </button>

            <button
              id="btn-share-pass"
              type="button"
              onClick={() => showToast(t.shareAlert[language])}
              className="w-full bg-white/10 hover:bg-white/20 text-white py-2.5 px-3 rounded-xl font-bold text-xs flex items-center justify-center gap-1.5 border border-white/20 cursor-pointer transition-colors"
            >
              <Share2 className="w-3.5 h-3.5" />
              <span>{t.shareQr[language]}</span>
            </button>
          </div>

          <button
            id="btn-reset-demo"
            type="button"
            onClick={onReset}
            className="w-full bg-slate-800/80 hover:bg-slate-700 text-slate-300 py-2.5 rounded-xl font-semibold text-xs flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
          >
            <RefreshCw className="w-3.5 h-3.5" />
            <span>{t.registerAnother[language]}</span>
          </button>
        </div>
      </div>
    </div>
  );
};
