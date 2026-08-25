import React from 'react';
import { Calendar, Clock, Users, FileText, Activity, LogOut, Star } from 'lucide-react';
import type { Language } from '../types';

interface DoctorDashboardProps {
  language: Language;
  authUserId: string | null;
  onLogout: () => void;
}

export const DoctorDashboard: React.FC<DoctorDashboardProps> = ({ language, authUserId, onLogout }) => {
  const isSw = language === 'sw';

  return (
    <div className="pt-2 pb-6">
      <div className="flex items-center justify-between mb-5">
        <div>
          <p className="text-xs font-semibold text-slate-500 dark:text-slate-400">{isSw ? 'Daktari' : 'Doctor Portal'}</p>
          <h2 className="text-lg font-black text-slate-900 dark:text-white">{isSw ? 'Jukwaa la Daktari' : 'Doctor Dashboard'}</h2>
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
            <Users className="w-4 h-4 text-cyan-600 dark:text-cyan-400" />
            <span className="text-xs font-semibold text-slate-500 dark:text-slate-400">{isSw ? 'Wagonjwa wa Leo' : "Today's Patients"}</span>
          </div>
          <p className="text-2xl font-black text-slate-900 dark:text-white">0</p>
        </div>
        <div className="nc-card p-4">
          <div className="flex items-center gap-2 mb-2">
            <Calendar className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
            <span className="text-xs font-semibold text-slate-500 dark:text-slate-400">{isSw ? 'Ziara Zilizobaki' : 'Upcoming Visits'}</span>
          </div>
          <p className="text-2xl font-black text-slate-900 dark:text-white">0</p>
        </div>
        <div className="nc-card p-4">
          <div className="flex items-center gap-2 mb-2">
            <Clock className="w-4 h-4 text-amber-600 dark:text-amber-400" />
            <span className="text-xs font-semibold text-slate-500 dark:text-slate-400">{isSw ? 'Wanaosubiri' : 'In Queue'}</span>
          </div>
          <p className="text-2xl font-black text-slate-900 dark:text-white">0</p>
        </div>
        <div className="nc-card p-4">
          <div className="flex items-center gap-2 mb-2">
            <Star className="w-4 h-4 text-yellow-500" />
            <span className="text-xs font-semibold text-slate-500 dark:text-slate-400">{isSw ? 'Mkondo' : 'Rating'}</span>
          </div>
          <p className="text-2xl font-black text-slate-900 dark:text-white">—</p>
        </div>
      </div>

      <div className="nc-card p-4 mb-4">
        <div className="flex items-center gap-2 mb-3">
          <Activity className="w-4 h-4 text-rose-500" />
          <h3 className="text-sm font-bold text-slate-900 dark:text-white">{isSw ? 'Hali ya Mtu' : 'Patient Status'}</h3>
        </div>
        <p className="text-xs text-slate-500 dark:text-slate-400">
          {isSw
            ? 'Hakuna wagonjwa waliosajiliwa. Utaona hapa unapopokea rufaa au ziura mpya.'
            : 'No patients assigned yet. New referrals and appointments will appear here.'}
        </p>
      </div>

      <div className="nc-card p-4">
        <div className="flex items-center gap-2 mb-3">
          <FileText className="w-4 h-4 text-blue-500" />
          <h3 className="text-sm font-bold text-slate-900 dark:text-white">{isSw ? 'Kumbukumbu za Kliniki' : 'Clinical Notes'}</h3>
        </div>
        <p className="text-xs text-slate-500 dark:text-slate-400">
          {isSw
            ? 'Hatua ya kuandika kumbukumbu za wagonjwa utaweza hapa.'
            : 'Write medical records and prescriptions for your patients here.'}
        </p>
      </div>

      {authUserId && (
        <p className="mt-5 text-[10px] text-center text-slate-400 dark:text-slate-600 font-mono">ID: {authUserId.slice(0, 12)}…</p>
      )}
    </div>
  );
};
