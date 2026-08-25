import React from 'react';
import { Building2, Users, CalendarDays, CreditCard, LogOut, Bell, ShieldCheck } from 'lucide-react';
import type { Language } from '../types';

interface ProviderDashboardProps {
  language: Language;
  authUserId: string | null;
  onLogout: () => void;
}

export const ProviderDashboard: React.FC<ProviderDashboardProps> = ({ language, authUserId, onLogout }) => {
  const isSw = language === 'sw';

  return (
    <div className="pt-2 pb-6">
      <div className="flex items-center justify-between mb-5">
        <div>
          <p className="text-xs font-semibold text-slate-500 dark:text-slate-400">{isSw ? 'Mtumishi wa Kituo' : 'Facility Staff'}</p>
          <h2 className="text-lg font-black text-slate-900 dark:text-white">{isSw ? 'Jukwaa la Kituo' : 'Provider Dashboard'}</h2>
        </div>
        <button
          type="button"
          onClick={onLogout}
          className="p-2.5 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors"
          title={isSw ? 'Toka' : 'Logout'}
        >
          <LogOut className="w-4 h-4" />
        </button>
      </div>

      <div className="grid grid-cols-2 gap-3 mb-5">
        <div className="nc-card p-4">
          <div className="flex items-center gap-2 mb-2">
            <CalendarDays className="w-4 h-4 text-cyan-600 dark:text-cyan-400" />
            <span className="text-xs font-semibold text-slate-500 dark:text-slate-400">{isSw ? 'Ziara za Leo' : "Today's Appointments"}</span>
          </div>
          <p className="text-2xl font-black text-slate-900 dark:text-white">0</p>
        </div>
        <div className="nc-card p-4">
          <div className="flex items-center gap-2 mb-2">
            <Users className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
            <span className="text-xs font-semibold text-slate-500 dark:text-slate-400">{isSw ? 'Wagonjwa Waliosubiri' : 'Queued Patients'}</span>
          </div>
          <p className="text-2xl font-black text-slate-900 dark:text-white">0</p>
        </div>
        <div className="nc-card p-4">
          <div className="flex items-center gap-2 mb-2">
            <CreditCard className="w-4 h-4 text-amber-600 dark:text-amber-400" />
            <span className="text-xs font-semibold text-slate-500 dark:text-slate-400">{isSw ? 'Malipo Yaliyobaki' : 'Pending Bills'}</span>
          </div>
          <p className="text-2xl font-black text-slate-900 dark:text-white">0</p>
        </div>
        <div className="nc-card p-4">
          <div className="flex items-center gap-2 mb-2">
            <Bell className="w-4 h-4 text-rose-500" />
            <span className="text-xs font-semibold text-slate-500 dark:text-slate-400">{isSw ? 'Dharura' : 'Emergencies'}</span>
          </div>
          <p className="text-2xl font-black text-slate-900 dark:text-white">0</p>
        </div>
      </div>

      <div className="nc-card p-4 mb-4">
        <div className="flex items-center gap-2 mb-3">
          <Building2 className="w-4 h-4 text-blue-500" />
          <h3 className="text-sm font-bold text-slate-900 dark:text-white">{isSw ? 'Kituo' : 'Facility'}</h3>
        </div>
        <p className="text-xs text-slate-500 dark:text-slate-400">
          {isSw
            ? 'Dodoso la kituo litaonekana hapa baada ya msimamizi kuunganisha akaunti yako na kituo.'
            : 'Facility details will appear here once an admin links your account to a hospital or clinic.'}
        </p>
      </div>

      <div className="nc-card p-4">
        <div className="flex items-center gap-2 mb-3">
          <ShieldCheck className="w-4 h-4 text-emerald-500" />
          <h3 className="text-sm font-bold text-slate-900 dark:text-white">{isSw ? 'Usalama wa Data' : 'Data Security'}</h3>
        </div>
        <p className="text-xs text-slate-500 dark:text-slate-400">
          {isSw
            ? 'Fikia taarifa za wagonjwa pekee kwa kufuata sera ya siri.'
            : 'Access patient data only in accordance with the privacy policy.'}
        </p>
      </div>

      {authUserId && (
        <p className="mt-5 text-[10px] text-center text-slate-400 dark:text-slate-600 font-mono">ID: {authUserId.slice(0, 12)}…</p>
      )}
    </div>
  );
};
