import React from 'react';
import { LayoutDashboard, Users, Building2, ShieldAlert, Activity, LogOut, Globe } from 'lucide-react';
import type { Language } from '../types';

interface AdminDashboardProps {
  language: Language;
  authUserId: string | null;
  onLogout: () => void;
}

export const AdminDashboard: React.FC<AdminDashboardProps> = ({ language, authUserId, onLogout }) => {
  const isSw = language === 'sw';

  return (
    <div className="pt-2 pb-6">
      <div className="flex items-center justify-between mb-5">
        <div>
          <p className="text-xs font-semibold text-slate-500 dark:text-slate-400">{isSw ? 'Msimamizi' : 'Administrator'}</p>
          <h2 className="text-lg font-black text-slate-900 dark:text-white">{isSw ? 'Jukwaa la Usimamizi' : 'Admin Dashboard'}</h2>
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
            <span className="text-xs font-semibold text-slate-500 dark:text-slate-400">{isSw ? 'Watumiaji' : 'Users'}</span>
          </div>
          <p className="text-2xl font-black text-slate-900 dark:text-white">—</p>
        </div>
        <div className="nc-card p-4">
          <div className="flex items-center gap-2 mb-2">
            <Building2 className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
            <span className="text-xs font-semibold text-slate-500 dark:text-slate-400">{isSw ? 'Vituo' : 'Providers'}</span>
          </div>
          <p className="text-2xl font-black text-slate-900 dark:text-white">—</p>
        </div>
        <div className="nc-card p-4">
          <div className="flex items-center gap-2 mb-2">
            <ShieldAlert className="w-4 h-4 text-amber-600 dark:text-amber-400" />
            <span className="text-xs font-semibold text-slate-500 dark:text-slate-400">{isSw ? 'Rufaa' : 'Flagged'}</span>
          </div>
          <p className="text-2xl font-black text-slate-900 dark:text-white">—</p>
        </div>
        <div className="nc-card p-4">
          <div className="flex items-center gap-2 mb-2">
            <Activity className="w-4 h-4 text-rose-500" />
            <span className="text-xs font-semibold text-slate-500 dark:text-slate-400">{isSw ? 'Dharura' : 'Dispatches'}</span>
          </div>
          <p className="text-2xl font-black text-slate-900 dark:text-white">—</p>
        </div>
      </div>

      <div className="nc-card p-4 mb-4">
        <div className="flex items-center gap-2 mb-3">
          <LayoutDashboard className="w-4 h-4 text-blue-500" />
          <h3 className="text-sm font-bold text-slate-900 dark:text-white">{isSw ? 'Shughuli za Msimamizi' : 'Admin Actions'}</h3>
        </div>
        <ul className="space-y-2 text-xs text-slate-500 dark:text-slate-400">
          <li className="flex items-center gap-2">
            <Globe className="w-3.5 h-3.5" />
            {isSw ? 'Sajili vituo vya afya na madaktari.' : 'Register health facilities and doctors.'}
          </li>
          <li className="flex items-center gap-2">
            <Users className="w-3.5 h-3.5" />
            {isSw ? 'Simamia wafanyakazi wa vituo.' : 'Manage facility staff accounts.'}
          </li>
          <li className="flex items-center gap-2">
            <ShieldAlert className="w-3.5 h-3.5" />
            {isSw ? 'Thibitisha au usitisha akaunti.' : 'Approve or suspend user accounts.'}
          </li>
        </ul>
      </div>

      {authUserId && (
        <p className="mt-5 text-[10px] text-center text-slate-400 dark:text-slate-600 font-mono">ID: {authUserId.slice(0, 12)}…</p>
      )}
    </div>
  );
};
