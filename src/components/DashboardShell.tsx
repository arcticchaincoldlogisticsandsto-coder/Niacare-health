import React from 'react';
import { RefreshCw, LogOut, Settings, Bell } from 'lucide-react';
import { Avatar } from './Avatar';
import type { Language, Theme, UserRole } from '../types';

interface DashboardShellProps {
  role: UserRole;
  roleLabel: string;
  title: string;
  subtitle?: string;
  language: Language;
  theme: Theme;
  onLogout: () => void;
  onRefresh?: () => void;
  loading?: boolean;
  onOpenSettings?: () => void;
  children: React.ReactNode;
  actions?: React.ReactNode;
  footer?: React.ReactNode;
}

const greetingFor = (hour: number, language: Language): string => {
  const isSw = language === 'sw';
  if (hour < 12) return isSw ? 'Habari za asubuhi' : 'Good morning';
  if (hour < 17) return isSw ? 'Habari za mchana' : 'Good afternoon';
  return isSw ? 'Habari za jioni' : 'Good evening';
};

export const DashboardShell: React.FC<DashboardShellProps> = ({
  roleLabel,
  title,
  subtitle,
  language,
  theme,
  onLogout,
  onRefresh,
  loading,
  onOpenSettings,
  children,
  actions,
  footer,
}) => {
  const isDark = theme === 'dark';
  const greeting = greetingFor(new Date().getHours(), language);

  return (
    <div className="pt-2 pb-6 space-y-4">
      {/* Identity Header */}
      <div className="px-1 pt-1 pb-2">
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-3 min-w-0">
            <Avatar name={title} size="lg" />
            <div className="min-w-0">
              <p className={`text-xs font-semibold ${isDark ? 'text-primary-light' : 'text-[var(--nc-primary)]'}`}>
                {greeting}
              </p>
              <h2 className="text-lg font-semibold text-slate-900 dark:text-white truncate">{title}</h2>
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-[10px] font-bold px-2 py-1 rounded-full bg-primary/5 dark:bg-slate-800 text-[var(--nc-primary)] dark:text-slate-300">
                  {roleLabel}
                </span>
                {subtitle && (
                  <span className="text-[11px] text-slate-500 dark:text-slate-400 truncate">{subtitle}</span>
                )}
              </div>
            </div>
          </div>

          <div className="flex items-center gap-1.5 flex-shrink-0">
            {onRefresh && (
              <button
                type="button"
                onClick={onRefresh}
                className="p-2 rounded-lg bg-slate-50 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors"
                title="Refresh"
              >
                <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
              </button>
            )}
            {onOpenSettings && (
              <button
                type="button"
                onClick={onOpenSettings}
                className="p-2 rounded-lg bg-slate-50 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors"
                title="Settings"
              >
                <Settings className="w-4 h-4" />
              </button>
            )}
            <button
              type="button"
              onClick={onLogout}
              className="p-2 rounded-lg bg-slate-50 dark:bg-slate-800 text-rose-600 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/40 transition-colors"
              title="Logout"
            >
              <LogOut className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>

      {/* Optional horizontal action / tab bar */}
      {actions && (
        <div className="flex gap-1.5 overflow-x-auto pb-1">{actions}</div>
      )}

      {children}

      {footer && <div className="pt-2">{footer}</div>}
    </div>
  );
};

interface StatCardProps {
  label: string;
  value: React.ReactNode;
  sub?: string;
  Icon: React.ComponentType<{ className?: string }>;
  colorClass?: string;
  loading?: boolean;
}

export const StatCard: React.FC<StatCardProps> = ({ label, value, sub, Icon, colorClass, loading }) => (
  <div className="nc-card p-3">
    <div className="flex items-center gap-2 mb-2">
      <Icon className={`w-4 h-4 ${colorClass || 'text-[var(--nc-primary)] dark:text-primary-light'}`} />
      <span className="text-xs font-semibold text-slate-500 dark:text-slate-400 truncate">{label}</span>
    </div>
    <p className="text-2xl font-semibold text-slate-900 dark:text-white">{loading ? '—' : value}</p>
    {sub && <p className="text-[10px] text-slate-400 mt-0.5">{sub}</p>}
  </div>
);

interface Tab {
  key: string;
  label: string;
  Icon?: React.ComponentType<{ className?: string }>;
}

interface SegmentedTabsProps {
  tabs: Tab[];
  active: string;
  onChange: (key: string) => void;
}

export const SegmentedTabs: React.FC<SegmentedTabsProps> = ({ tabs, active, onChange }) => (
  <div className="flex gap-1.5 overflow-x-auto pb-1">
    {tabs.map(({ key, label, Icon }) => (
      <button
        key={key}
        type="button"
        onClick={() => onChange(key)}
        className={`flex items-center gap-1.5 whitespace-nowrap rounded-lg px-3 py-1.5 text-xs font-bold transition-colors ${
          active === key
            ? 'bg-[var(--nc-primary)] text-white dark:bg-primary dark:text-[#041D34]'
            : 'text-slate-500 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800'
        }`}
      >
        {Icon && <Icon className="w-3.5 h-3.5" />}
        {label}
      </button>
    ))}
  </div>
);
