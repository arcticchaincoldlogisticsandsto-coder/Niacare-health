import React, { useEffect, useRef, useState } from 'react';
import { Bell, CheckCheck, Calendar, FlaskConical, Pill, CreditCard, MessageSquare, ShieldCheck, Info } from 'lucide-react';
import { Language, Theme } from '../types';
import {
  fetchNotifications,
  markNotificationRead,
  markAllNotificationsRead,
  AppNotification,
  NotificationCategory,
} from '../lib/notifications';
import { LoadingSkeleton } from './LoadingSkeleton';

const CATEGORY_ICON: Record<NotificationCategory, React.ComponentType<{ className?: string }>> = {
  appointments: Calendar,
  reminders: Pill,
  results: FlaskConical,
  follow_up: Calendar,
  payments: CreditCard,
  messages: MessageSquare,
  access: ShieldCheck,
  general: Info,
};

interface NotificationBellProps {
  userId: string | null;
  language: Language;
  theme: Theme;
}

// Replaces what used to be a permanently-on fake red dot with a real,
// per-user unread count — see the "no fake notification indicators"
// rationale in supabase/schema.sql's NOTIFICATIONS section.
export const NotificationBell: React.FC<NotificationBellProps> = ({ userId, language, theme }) => {
  const isSw = language === 'sw';
  const isDark = theme === 'dark';
  const [open, setOpen] = useState(false);
  const [items, setItems] = useState<AppNotification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const rootRef = useRef<HTMLDivElement>(null);

  const load = async () => {
    if (!userId) { setLoading(false); return; }
    const { notifications, unreadCount: count, error: err } = await fetchNotifications(userId);
    if (err) setError(err); else setError('');
    setItems(notifications);
    setUnreadCount(count);
    setLoading(false);
  };

  useEffect(() => {
    load();
    const interval = setInterval(load, 45000);
    return () => clearInterval(interval);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userId]);

  useEffect(() => {
    const onClickOutside = (e: MouseEvent) => {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', onClickOutside);
    return () => document.removeEventListener('mousedown', onClickOutside);
  }, []);

  const handleOpenItem = async (item: AppNotification) => {
    if (!item.readAt) {
      await markNotificationRead(item.id);
      setItems((prev) => prev.map((n) => (n.id === item.id ? { ...n, readAt: new Date().toISOString() } : n)));
      setUnreadCount((prev) => Math.max(0, prev - 1));
    }
  };

  const handleMarkAll = async () => {
    if (!userId) return;
    await markAllNotificationsRead(userId);
    setItems((prev) => prev.map((n) => ({ ...n, readAt: n.readAt || new Date().toISOString() })));
    setUnreadCount(0);
  };

  return (
    <div className="relative" ref={rootRef}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="relative flex h-10 w-10 items-center justify-center rounded-xl border nc-border bg-white text-primary shadow-sm dark:bg-[#101F31] dark:text-primary-light"
        title={isSw ? 'Arifa' : 'Notifications'}
      >
        <Bell className="h-4 w-4" />
        {unreadCount > 0 && (
          <span className="absolute right-1.5 top-1.5 flex h-3.5 min-w-[0.875rem] items-center justify-center rounded-full bg-rose-500 px-0.5 text-[8px] font-bold text-white">
            {unreadCount > 9 ? '9+' : unreadCount}
          </span>
        )}
      </button>

      {open && (
        <div
          className={`absolute right-0 top-12 z-40 w-80 max-w-[85vw] rounded-2xl border shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-150 ${
            isDark ? 'bg-[#0B1522] border-slate-700' : 'bg-white border-slate-200'
          }`}
        >
          <div className="flex items-center justify-between px-3.5 py-2.5 border-b nc-border">
            <span className="text-xs font-bold text-slate-900 dark:text-white">{isSw ? 'Arifa' : 'Notifications'}</span>
            {unreadCount > 0 && (
              <button type="button" onClick={handleMarkAll} className="flex items-center gap-1 text-[10px] font-bold text-primary hover:underline">
                <CheckCheck className="w-3 h-3" /> {isSw ? 'Weka Zote Kama Zimesomwa' : 'Mark all read'}
              </button>
            )}
          </div>
          <div className="max-h-80 overflow-y-auto">
            {loading && <LoadingSkeleton rows={3} className="p-3" />}
            {error && <p className="text-xs text-rose-600 p-3">{error}</p>}
            {!loading && !error && items.length === 0 && (
              <p className="text-xs text-slate-500 dark:text-slate-400 p-4 text-center">
                {isSw ? 'Hakuna arifa bado.' : 'Nothing here yet.'}
              </p>
            )}
            {items.map((item) => {
              const Icon = CATEGORY_ICON[item.category];
              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => handleOpenItem(item)}
                  className={`w-full text-left flex items-start gap-2.5 px-3.5 py-2.5 border-b nc-border last:border-b-0 transition-colors ${
                    !item.readAt ? 'bg-primary/5 dark:bg-primary/10' : ''
                  } hover:bg-slate-50 dark:hover:bg-slate-800/50`}
                >
                  <div className="w-7 h-7 rounded-lg bg-primary/10 text-primary dark:text-primary-light flex items-center justify-center flex-shrink-0 mt-0.5">
                    <Icon className="w-3.5 h-3.5" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className={`text-xs truncate ${!item.readAt ? 'font-bold text-slate-900 dark:text-white' : 'font-semibold text-slate-600 dark:text-slate-300'}`}>
                      {item.title}
                    </p>
                    {item.body && <p className="text-[11px] text-slate-500 dark:text-slate-400 truncate">{item.body}</p>}
                    <p className="text-[10px] text-slate-400 mt-0.5">{new Date(item.createdAt).toLocaleString(undefined, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}</p>
                  </div>
                  {!item.readAt && <span className="w-1.5 h-1.5 rounded-full bg-primary flex-shrink-0 mt-1.5" />}
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
};
